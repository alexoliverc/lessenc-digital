"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { BrowserMeasurementBoundary } from "@/modules/analytics/application/browser-measurement";
import {
  projectGa4BrowserEcommerce,
  pushGa4EcommerceDataLayer,
} from "@/modules/analytics/application/google-analytics-4";
import type {
  AnalyticsConsentProjection,
  AnalyticsConsentSelection,
} from "@/modules/analytics/application/consent";
import {
  createGoogleTagManagerBrowserEnvironment,
  getGoogleTagDataLayer,
} from "@/modules/analytics/application/google-tag-manager-browser";
import { synchronizeGoogleTagManager } from "@/modules/analytics/application/google-tag-manager-runtime";

import styles from "./analytics-consent-boundary.module.css";

type AnalyticsConsentBoundaryProps = Readonly<{
  boundary: BrowserMeasurementBoundary | null;
  gtmContainerId: string | null;
}>;

function isConsentProjection(value: unknown): value is AnalyticsConsentProjection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    (record.analytics === "UNKNOWN" ||
      record.analytics === "GRANTED" ||
      record.analytics === "DENIED") &&
    (record.advertising === "UNKNOWN" ||
      record.advertising === "GRANTED" ||
      record.advertising === "DENIED") &&
    typeof record.policyVersion === "string"
  );
}

function pushConsentProjection(consent: AnalyticsConsentProjection): void {
  getGoogleTagDataLayer().push({
    event: "lessenc_consent_update",
    analyticsAllowed: consent.analytics === "GRANTED",
    advertisingAllowed: consent.advertising === "GRANTED",
    consentPolicyVersion: consent.policyVersion,
  });
}

function pushMeasurement(boundary: BrowserMeasurementBoundary): void {
  if (boundary.consent.analytics !== "GRANTED") {
    return;
  }

  const storageKey = `lessenc_measurement:${boundary.measurement.eventId}`;

  try {
    if (globalThis.sessionStorage.getItem(storageKey) === "pushed") {
      return;
    }

    globalThis.sessionStorage.setItem(storageKey, "pushed");
  } catch {
    // Storage availability must not control measurement or Commerce.
  }

  const dataLayer = getGoogleTagDataLayer();

  dataLayer.push({
    ...boundary.measurement,
    analyticsAllowed: true,
    advertisingAllowed: boundary.consent.advertising === "GRANTED",
    consentPolicyVersion: boundary.consent.policyVersion,
  });

  try {
    pushGa4EcommerceDataLayer(dataLayer, projectGa4BrowserEcommerce(boundary.measurement));
  } catch {
    // Provider projection must not block canonical measurement or Commerce.
  }
}

export function AnalyticsConsentBoundary({
  boundary,
  gtmContainerId,
}: AnalyticsConsentBoundaryProps) {
  const [consent, setConsent] = useState<AnalyticsConsentProjection>(
    boundary?.consent ?? {
      analytics: "UNKNOWN",
      advertising: "UNKNOWN",
      policyVersion: "p13-architecture-freeze-r2",
    },
  );
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const lastProjectedConsent = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetch("/api/analytics/consent", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const value: unknown = await response.json();

        return isConsentProjection(value) ? value : null;
      })
      .then((value) => {
        if (active && value !== null) {
          setConsent(value);
        }
      })
      .catch(() => {
        // Consent stays UNKNOWN or at its server-projected value on failure.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      const environment = createGoogleTagManagerBrowserEnvironment();

      const googleState = synchronizeGoogleTagManager({
        containerId: gtmContainerId,
        consent,
        ...environment,
        now: () => new Date(),
      });

      if (googleState.state === "BLOCKED_BY_CONSENT") {
        return;
      }
    } catch {
      // Google measurement must never control consent UI, measurement persistence or Commerce.
    }

    const projectionKey = `${consent.analytics}:${consent.advertising}:${consent.policyVersion}`;

    if (lastProjectedConsent.current !== projectionKey) {
      pushConsentProjection(consent);
      lastProjectedConsent.current = projectionKey;
    }

    if (boundary !== null) {
      pushMeasurement({
        ...boundary,
        consent,
      });
    }
  }, [boundary, consent, gtmContainerId]);

  const updateConsent = useCallback(async (selection: AnalyticsConsentSelection) => {
    setPending(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/analytics/consent", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selection),
      });

      const value: unknown = await response.json();

      if (!response.ok || !isConsentProjection(value)) {
        throw new Error("CONSENT_UPDATE_FAILED");
      }

      setConsent(value);
      setFeedback("Preferências salvas.");
    } catch {
      setFeedback("Não foi possível salvar agora. As medições opcionais permanecem desativadas.");
    } finally {
      setPending(false);
    }
  }, []);

  const isUnknown = consent.analytics === "UNKNOWN" || consent.advertising === "UNKNOWN";

  return (
    <aside className={styles.boundary} aria-label="Preferências de privacidade">
      <details open={isUnknown || undefined}>
        <summary>Preferências de privacidade</summary>

        <div className={styles.content}>
          <p>
            Você escolhe se permite medição de uso e publicidade. A compra e o acesso ao conteúdo
            não dependem dessa escolha.
          </p>

          <div className={styles.actions}>
            <Button
              type="button"
              size="small"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                void updateConsent({
                  analytics: "GRANTED",
                  advertising: "DENIED",
                })
              }
            >
              Permitir só medição
            </Button>

            <Button
              type="button"
              size="small"
              disabled={pending}
              onClick={() =>
                void updateConsent({
                  analytics: "GRANTED",
                  advertising: "GRANTED",
                })
              }
            >
              Permitir medição e publicidade
            </Button>

            <Button
              type="button"
              size="small"
              variant="outline"
              disabled={pending}
              onClick={() =>
                void updateConsent({
                  analytics: "DENIED",
                  advertising: "DENIED",
                })
              }
            >
              Recusar opcionais
            </Button>
          </div>

          <p className={styles.status} role="status" aria-live="polite">
            {feedback ??
              (isUnknown
                ? "Nenhuma medição opcional foi autorizada."
                : `Medição: ${consent.analytics === "GRANTED" ? "permitida" : "recusada"}. Publicidade: ${consent.advertising === "GRANTED" ? "permitida" : "recusada"}.`)}
          </p>
        </div>
      </details>
    </aside>
  );
}
