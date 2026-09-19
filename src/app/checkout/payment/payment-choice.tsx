"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Image from "next/image";

import type { GoogleAdsConversionDataLayerEvent } from "@/modules/analytics/application/google-ads-conversion";
import type { MetaPixelPurchaseDataLayerEvent } from "@/modules/analytics/application/meta-pixel";
import type { Ga4DataLayerEvent } from "@/modules/analytics/application/google-analytics-4";

import styles from "./page.module.css";
import {
  deliverCanonicalGoogleAdsConversionToBrowser,
  parseCanonicalGoogleAdsConversion,
} from "./advertising-conversion-browser";
import {
  deliverCanonicalMetaPixelPurchaseToBrowser,
  parseCanonicalMetaPixelPurchase,
} from "./meta-pixel-browser";
import {
  deliverCanonicalGa4PurchaseToBrowser,
  parseCanonicalGa4Purchase,
} from "./purchase-analytics-browser";

type Presentation =
  | { kind: "PIX"; qrCode?: string; qrCodeBase64?: string; ticketUrl?: string }
  | { kind: "CHALLENGE"; url: string }
  | null;
type Result = {
  state: string;
  presentation: Presentation;
  analyticsPurchase: Ga4DataLayerEvent | null;
  advertisingConversion: GoogleAdsConversionDataLayerEvent | null;
  metaPixelPurchase: MetaPixelPurchaseDataLayerEvent | null;
};
type Brick = { unmount(): void };
type MpSdk = { bricks(): { create(name: string, id: string, settings: object): Promise<Brick> } };

async function post(path: string, body: unknown): Promise<Result> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      state: "unknown",
      presentation: null,
      analyticsPurchase: null,
      advertisingConversion: null,
      metaPixelPurchase: null,
    };
  }

  const result: unknown = await response.json();

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {
      state: "unknown",
      presentation: null,
      analyticsPurchase: null,
      advertisingConversion: null,
      metaPixelPurchase: null,
    };
  }

  const value = result as Record<string, unknown>;

  return {
    state: typeof value.state === "string" ? value.state : "unknown",

    presentation:
      value.presentation && typeof value.presentation === "object"
        ? (value.presentation as Presentation)
        : null,

    analyticsPurchase: parseCanonicalGa4Purchase(value.analyticsPurchase),

    advertisingConversion: parseCanonicalGoogleAdsConversion(value.advertisingConversion),

    metaPixelPurchase: parseCanonicalMetaPixelPurchase(value.metaPixelPurchase),
  };
}
export function PaymentChoice({
  initialState,
  amount,
  publicKey,
  gtmContainerId,
}: Readonly<{
  initialState: string;
  amount: number;
  publicKey: string;
  gtmContainerId: string | null;
}>) {
  const [mode, setMode] = useState<"PIX" | "CREDIT_CARD" | null>(null);
  const [state, setState] = useState(initialState);
  const [presentation, setPresentation] = useState<Presentation>(null);
  const [busy, setBusy] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState("");
  const iframe = useRef<HTMLIFrameElement>(null);
  const pollCount = useRef(0);
  const deliveredAnalyticsPurchases = useRef(new Set<string>());

  const deliveredAdvertisingConversions = useRef(new Set<string>());
  const deliveredMetaPixelPurchases = useRef(new Set<string>());
  async function startPix() {
    if (busy) return;
    setBusy(true);
    setError("");
    pollCount.current = 0;
    setMode("PIX");
    try {
      const result = await post("/checkout/payment/start", { method: "PIX" });
      setState(result.state);
      setPresentation(result.presentation);
    } catch {
      setError("Não foi possível iniciar o Pix. Consulte o estado antes de tentar novamente.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!scriptReady || !publicKey || mode !== "CREDIT_CARD") return;
    const mp = (window as Window & { MercadoPago?: new (key: string) => MpSdk }).MercadoPago;
    if (!mp) return;
    let disposed = false;
    let brick: Brick | null = null;
    const sdk = new mp(publicKey);
    void sdk
      .bricks()
      .create("cardPayment", "p10-card-payment", {
        initialization: { amount },
        customization: {
          paymentMethods: {
            minInstallments: 1,
            maxInstallments: 1,
            types: { excluded: ["debit_card", "prepaid_card"] },
          },
        },
        callbacks: {
          onSubmit: async (formData: unknown, additionalData: unknown) => {
            const form =
              formData && typeof formData === "object" ? (formData as Record<string, unknown>) : {};
            const additional =
              additionalData && typeof additionalData === "object"
                ? (additionalData as Record<string, unknown>)
                : {};
            const token = form.token;
            const paymentMethodId = form.payment_method_id;
            if (
              typeof token !== "string" ||
              typeof paymentMethodId !== "string" ||
              form.installments !== 1 ||
              additional.paymentTypeId !== "credit_card"
            ) {
              setError("Confira os dados do cartão e tente novamente.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              const result = await post("/checkout/payment/start", {
                method: "CREDIT_CARD",
                card: { token, paymentMethodId, installments: 1, paymentType: "credit_card" },
              });
              if (!disposed) {
                setState(result.state);
                setPresentation(result.presentation);
              }
            } catch {
              if (!disposed)
                setError("Não foi possível confirmar a tentativa. Consulte o estado do pagamento.");
            } finally {
              if (!disposed) setBusy(false);
            }
          },
          onError: () => setError("Não foi possível carregar o formulário de cartão."),
        },
      })
      .then((mounted) => {
        if (disposed) mounted.unmount();
        else brick = mounted;
      })
      .catch(() => {
        if (!disposed) setError("Pagamento com cartão indisponível.");
      });
    return () => {
      disposed = true;
      brick?.unmount();
    };
  }, [scriptReady, publicKey, mode, amount]);

  useEffect(() => {
    if (
      !["processing", "challenge_required", "unknown", "awaiting_payment"].includes(state) ||
      !mode
    )
      return;

    let stopped = false;
    let timer: number | undefined;

    const schedule = () => {
      if (stopped || pollCount.current >= 20) return;

      const delay = pollCount.current < 5 ? 8_000 : pollCount.current < 10 ? 15_000 : 30_000;

      timer = window.setTimeout(() => {
        if (stopped) return;

        void post("/checkout/payment/status", {})
          .then((result) => {
            if (stopped) return;

            pollCount.current += 1;
            setState(result.state);

            if (result.presentation) {
              setPresentation(result.presentation);
            }

            schedule();
          })
          .catch(() => {
            if (stopped) return;

            pollCount.current += 1;
            schedule();
          });
      }, delay);
    };

    schedule();

    return () => {
      stopped = true;

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [state, mode]);

  useEffect(() => {
    if (presentation?.kind !== "CHALLENGE") return;
    const expectedOrigin = new URL(presentation.url).origin;
    const listener = (event: MessageEvent) => {
      if (event.source !== iframe.current?.contentWindow || event.origin !== expectedOrigin) return;
      // Message content has no financial authority. Always fetch a fresh provider snapshot server-side.
      void post("/checkout/payment/status", {})
        .then((result) => {
          setState(result.state);
          setPresentation(result.presentation);
        })
        .catch(() => setState("unknown"));
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [presentation]);

  useEffect(() => {
    if (state !== "approved") {
      return;
    }

    let disposed = false;

    void post("/checkout/payment/status", {})
      .then(async (result) => {
        if (disposed || result.state !== "approved") {
          return;
        }

        if (result.analyticsPurchase !== null) {
          try {
            await deliverCanonicalGa4PurchaseToBrowser({
              purchase: result.analyticsPurchase,
              gtmContainerId,
              deliveredKeys: deliveredAnalyticsPurchases.current,
            });
          } catch {
            /*
             * GA4 failure is isolated from financial truth
             * and all other provider projections.
             */
          }
        }

        if (disposed) {
          return;
        }

        if (result.advertisingConversion !== null) {
          try {
            await deliverCanonicalGoogleAdsConversionToBrowser({
              conversion: result.advertisingConversion,
              gtmContainerId,
              deliveredKeys: deliveredAdvertisingConversions.current,
            });
          } catch {
            /*
             * Google Ads failure is isolated from financial
             * truth and every other provider projection.
             */
          }
        }

        if (disposed) {
          return;
        }

        if (result.metaPixelPurchase !== null) {
          try {
            await deliverCanonicalMetaPixelPurchaseToBrowser({
              purchase: result.metaPixelPurchase,
              gtmContainerId,
              deliveredKeys: deliveredMetaPixelPurchases.current,
            });
          } catch {
            /*
             * Meta Pixel delivery is best-effort and cannot
             * mutate payment, GA4, or Google Ads truth.
             */
          }
        }
      })
      .catch(() => {
        /*
         * Provider delivery is best-effort and must never
         * mutate, roll back, or reinterpret financial truth.
         */
      });

    return () => {
      disposed = true;
    };
  }, [state, gtmContainerId]);
  const terminal = ["approved", "refunded", "review_required"].includes(state);
  return (
    <section className={styles.choice} aria-live="polite">
      {publicKey && (
        <Script
          src="https://sdk.mercadopago.com/js/v2"
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
          onError={() => setError("Pagamento com cartão indisponível.")}
        />
      )}
      <div className={styles.methods}>
        <button type="button" onClick={() => void startPix()} disabled={busy || terminal}>
          Pagar com Pix
        </button>
        {publicKey && (
          <button
            type="button"
            onClick={() => {
              pollCount.current = 0;
              setMode("CREDIT_CARD");
              setError("");
            }}
            disabled={busy || terminal}
          >
            Pagar com cartão
          </button>
        )}
      </div>
      {mode === "CREDIT_CARD" && publicKey && !terminal && <div id="p10-card-payment" />}
      {busy && <p>Processando sua solicitação…</p>}
      {error && <p role="alert">{error}</p>}
      {state === "approved" && <p role="status">Pagamento confirmado pelo servidor.</p>}
      {state === "rejected" && (
        <p role="status">Pagamento recusado. Você pode escolher outra forma de pagamento.</p>
      )}
      {state === "canceled" && (
        <p role="status">Tentativa encerrada. Você pode escolher outra forma de pagamento.</p>
      )}
      {state === "refunded" && <p role="status">Este pagamento foi reembolsado.</p>}{" "}
      {state === "review_required" && (
        <p role="status">Estamos verificando este pagamento. Aguarde antes de tentar novamente.</p>
      )}
      {state === "unknown" && (
        <p role="status">O resultado está em verificação. Não faça uma nova tentativa agora.</p>
      )}
      {(state === "processing" || state === "awaiting_payment") && mode && (
        <p role="status">Aguardando confirmação do pagamento.</p>
      )}
      {presentation?.kind === "PIX" && (
        <div className={styles.pix}>
          {presentation.qrCodeBase64 && (
            <Image
              alt="QR code do Pix"
              src={`data:image/png;base64,${presentation.qrCodeBase64}`}
              width={256}
              height={256}
              unoptimized
            />
          )}
          {presentation.qrCode && (
            <>
              <p>Pix Copia e Cola</p>
              <code>{presentation.qrCode}</code>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(presentation.qrCode!)}
              >
                Copiar código Pix
              </button>
            </>
          )}
          {presentation.ticketUrl && (
            <a href={presentation.ticketUrl} target="_blank" rel="noreferrer">
              Abrir instruções do Pix
            </a>
          )}
        </div>
      )}
      {presentation?.kind === "CHALLENGE" && (
        <div>
          <p>Confirme a autenticação do cartão na janela abaixo.</p>
          <iframe
            ref={iframe}
            title="Autenticação do cartão"
            src={presentation.url}
            sandbox="allow-scripts allow-same-origin allow-forms"
            className={styles.challenge}
          />
        </div>
      )}
    </section>
  );
}
