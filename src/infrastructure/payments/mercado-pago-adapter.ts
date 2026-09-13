import type {
  CreateProviderPayment,
  PaymentProvider,
  ProviderSearchResult,
  ProviderSnapshot,
  SearchProviderPayments,
} from "../../modules/payments/application/payment-provider";
import { ProviderError } from "../../modules/payments/application/payment-provider";
import { readBoundedText } from "../http/read-bounded-text";
import { minorToDecimal, normalizeMercadoPagoOrder } from "./normalize-mercado-pago-order";

const API = "https://api.mercadopago.com";
const ORDER_ID = /^ORD[A-Za-z0-9]{1,60}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const MAX_RESPONSE_BYTES = 256_000;

function hasAuthoritativeFinancialEvidence(snapshot: ProviderSnapshot): boolean {
  return (
    Boolean(snapshot.providerOrderId) &&
    Boolean(snapshot.providerPaymentId) &&
    Boolean(snapshot.providerAccountId) &&
    Boolean(snapshot.externalReference) &&
    snapshot.amountMinor !== null &&
    snapshot.paymentAmountMinor !== null &&
    snapshot.currency === "BRL" &&
    snapshot.paymentMethod !== null
  );
}

function preservePresentation(
  canonical: ProviderSnapshot,
  created: ProviderSnapshot,
): ProviderSnapshot {
  if (canonical.presentation || !created.presentation) return canonical;

  return Object.freeze({
    ...canonical,
    presentation: created.presentation,
  });
}
export class MercadoPagoAdapter implements PaymentProvider {
  constructor(
    private readonly accessToken: string,
    private readonly transport: typeof fetch = fetch,
  ) {
    if (!accessToken || accessToken.length < 16) throw new ProviderError("CONFIGURATION");
  }

  private async request(
    path: string,
    method: "GET" | "POST",
    body?: string,
    key?: string,
    retry = 0,
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
    if (key) headers["X-Idempotency-Key"] = key;
    let response: Response;
    try {
      response = await this.transport(`${API}${path}`, {
        method,
        headers,
        ...(body ? { body } : {}),
        signal: AbortSignal.timeout(6000),
        redirect: "error",
        cache: "no-store",
      });
    } catch {
      if (method === "GET" && retry === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return this.request(path, method, body, key, 1);
      }
      throw new ProviderError(method === "POST" ? "AMBIGUOUS" : "TRANSIENT", true);
    }
    if (response.status === 429 || response.status >= 500) {
      if (method === "GET" && retry === 0) {
        const retryHeader = response.headers.get("retry-after");
        const retryAfter = retryHeader === null ? NaN : Number(retryHeader);
        const delay =
          response.status === 429 && Number.isFinite(retryAfter) ? retryAfter * 1000 : 250;
        if (delay >= 0 && delay <= 1500) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request(path, method, body, key, 1);
        }
      }
      throw new ProviderError(method === "POST" ? "AMBIGUOUS" : "TRANSIENT", true);
    }
    if (response.status === 409 || response.status === 423) {
      throw new ProviderError("AMBIGUOUS", false);
    }
    if (!response.ok) {
      throw new ProviderError(method === "POST" ? "AMBIGUOUS" : "UNAVAILABLE");
    }
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES)
      throw new ProviderError("INVALID_RESPONSE");
    let raw: string;
    try {
      raw = await readBoundedText(response.body, MAX_RESPONSE_BYTES);
    } catch {
      throw new ProviderError(method === "POST" ? "AMBIGUOUS" : "TRANSIENT");
    }
    if (raw.length > MAX_RESPONSE_BYTES) throw new ProviderError("INVALID_RESPONSE");
    try {
      return JSON.parse(raw);
    } catch {
      throw new ProviderError("INVALID_RESPONSE");
    }
  }

  async createPayment(input: CreateProviderPayment): Promise<ProviderSnapshot> {
    if (!UUID.test(input.paymentId) || !UUID.test(input.orderId) || input.currency !== "BRL") {
      throw new ProviderError("INVALID_INPUT");
    }
    const amount = minorToDecimal(input.amountMinor);
    const paymentMethod =
      input.paymentMethod === "PIX"
        ? { id: "pix", type: "bank_transfer" }
        : input.paymentMethod === "CREDIT_CARD" &&
            input.card &&
            input.card.installments === 1 &&
            input.card.paymentType === "credit_card" &&
            /^[A-Za-z0-9_-]{2,40}$/u.test(input.card.paymentMethodId) &&
            typeof input.card.token === "string" &&
            input.card.token.length > 0
          ? {
              id: input.card.paymentMethodId,
              type: "credit_card",
              token: input.card.token,
              installments: 1,
            }
          : null;
    if (!paymentMethod || !input.payerEmail || input.payerEmail.length > 320) {
      throw new ProviderError("INVALID_INPUT");
    }
    const body = JSON.stringify({
      type: "online",
      processing_mode: "automatic",
      capture_mode: "automatic",
      external_reference: input.orderId,
      total_amount: amount,
      payer: { email: input.payerEmail },
      transactions: { payments: [{ amount, payment_method: paymentMethod }] },
      ...(input.paymentMethod === "CREDIT_CARD"
        ? {
            config: {
              online: {
                transaction_security: { validation: "on_fraud_risk", liability_shift: "required" },
              },
            },
          }
        : {}),
    });
    const result = await this.request("/v1/orders", "POST", body, input.paymentId);

    let created: ProviderSnapshot;

    try {
      created = normalizeMercadoPagoOrder(result);
    } catch {
      throw new ProviderError("INVALID_RESPONSE");
    }

    if (hasAuthoritativeFinancialEvidence(created)) {
      return created;
    }

    try {
      const canonical = await this.getSnapshot(created.providerOrderId);

      if (!hasAuthoritativeFinancialEvidence(canonical)) {
        throw new ProviderError("INVALID_RESPONSE");
      }

      return preservePresentation(canonical, created);
    } catch {
      throw new ProviderError("AMBIGUOUS", true, created.providerOrderId);
    }
  }

  async getSnapshot(providerOrderId: string): Promise<ProviderSnapshot> {
    if (!ORDER_ID.test(providerOrderId)) throw new ProviderError("INVALID_INPUT");
    const result = await this.request(`/v1/orders/${encodeURIComponent(providerOrderId)}`, "GET");
    try {
      return await this.withVerifiedCurrency(normalizeMercadoPagoOrder(result), result);
    } catch {
      throw new ProviderError("INVALID_RESPONSE");
    }
  }

  private async withVerifiedCurrency(
    snapshot: ProviderSnapshot,
    raw: unknown,
  ): Promise<ProviderSnapshot> {
    const order =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null;
    if (
      snapshot.currency ||
      !snapshot.externalReference ||
      !snapshot.createdAt ||
      !snapshot.providerOrderId ||
      !snapshot.providerPaymentId ||
      !snapshot.providerAccountId ||
      !snapshot.amountMinor ||
      !snapshot.paymentAmountMinor ||
      !snapshot.paymentMethod ||
      order?.processing_mode !== "automatic" ||
      (order.capture_mode !== undefined && order.capture_mode !== "automatic")
    )
      return snapshot;
    const created = Date.parse(snapshot.createdAt);
    if (!Number.isFinite(created)) return snapshot;
    try {
      const results = await this.searchPayments({
        externalReference: snapshot.externalReference,
        beginDate: new Date(created - 5 * 60_000).toISOString(),
        endDate: new Date(created + 2 * 60 * 60_000).toISOString(),
      });
      if (!results.complete) return snapshot;
      const matching = results.snapshots.filter(
        (candidate) =>
          candidate.providerOrderId === snapshot.providerOrderId &&
          candidate.externalReference === snapshot.externalReference &&
          candidate.amountMinor === snapshot.amountMinor &&
          candidate.paymentAmountMinor === snapshot.paymentAmountMinor &&
          candidate.providerPaymentId === snapshot.providerPaymentId &&
          candidate.paymentMethod === snapshot.paymentMethod &&
          candidate.providerAccountId === snapshot.providerAccountId,
      );
      if (matching.length !== 1 || matching[0]?.currency !== "BRL") return snapshot;
      return {
        ...snapshot,
        currency: "BRL",
        requiresReview:
          snapshot.reviewReason === "INVALID_FINANCIAL_DATA" ? false : snapshot.requiresReview,
        reviewReason:
          snapshot.reviewReason === "INVALID_FINANCIAL_DATA" ? null : snapshot.reviewReason,
      };
    } catch {
      return snapshot;
    }
  }

  async searchPayments(input: SearchProviderPayments): Promise<ProviderSearchResult> {
    if (
      !UUID.test(input.externalReference) ||
      !Number.isFinite(Date.parse(input.beginDate)) ||
      !Number.isFinite(Date.parse(input.endDate))
    )
      throw new ProviderError("INVALID_INPUT");
    const snapshots: ProviderSnapshot[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const query = new URLSearchParams({
        external_reference: input.externalReference,
        begin_date: input.beginDate,
        end_date: input.endDate,
        type: "online",
        page: String(page),
        page_size: "20",
      });
      const raw = await this.request(`/v1/orders?${query}`, "GET");
      const envelope = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
      const data = envelope?.data;
      const paging =
        envelope?.paging && typeof envelope.paging === "object"
          ? (envelope.paging as Record<string, unknown>)
          : null;
      if (!Array.isArray(data) || !paging) throw new ProviderError("INVALID_RESPONSE");
      for (const item of data) {
        try {
          snapshots.push(normalizeMercadoPagoOrder(item));
        } catch {
          throw new ProviderError("INVALID_RESPONSE");
        }
      }
      const pages = Number(paging.total_pages);
      if (!Number.isSafeInteger(pages) || pages < 0) throw new ProviderError("INVALID_RESPONSE");
      if (page >= pages) return { snapshots, complete: true };
    }
    return { snapshots, complete: false };
  }
}
