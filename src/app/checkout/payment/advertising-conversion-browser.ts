import type { GoogleAdsConversionDataLayerEvent } from "@/modules/analytics/application/google-ads-conversion";
import {
  createGoogleTagManagerBrowserEnvironment,
  getGoogleTagDataLayer,
} from "@/modules/analytics/application/google-tag-manager-browser";
import { synchronizeGoogleTagManager } from "@/modules/analytics/application/google-tag-manager-runtime";

import { readCurrentAnalyticsConsent } from "./purchase-analytics-browser";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type StorageLike = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}>;

type DataLayerSink = Readonly<{
  push(value: unknown): number;
}>;

export type GoogleAdsBrowserDeliveryResult =
  | "DELIVERED"
  | "NO_CONVERSION"
  | "INVALID_CONVERSION"
  | "SUPPRESSED_BY_CURRENT_CONSENT"
  | "GTM_DISABLED"
  | "GTM_UNAVAILABLE"
  | "DUPLICATE";

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function parseCanonicalGoogleAdsConversion(
  value: unknown,
): GoogleAdsConversionDataLayerEvent | null {
  const source = record(value);

  if (
    source === null ||
    Object.keys(source).sort().join(",") !==
      "currency,event,lessenc_event_id,transaction_id,value" ||
    source.event !== "lessenc_google_ads_conversion" ||
    !nonEmptyString(source.lessenc_event_id) ||
    !nonEmptyString(source.transaction_id) ||
    !validMoney(source.value) ||
    source.currency !== "BRL"
  ) {
    return null;
  }

  return Object.freeze({
    event: "lessenc_google_ads_conversion" as const,
    lessenc_event_id: source.lessenc_event_id,
    transaction_id: source.transaction_id,
    value: source.value,
    currency: "BRL" as const,
  });
}

export function pushCanonicalGoogleAdsConversionAfterConsent(
  input: Readonly<{
    conversion: GoogleAdsConversionDataLayerEvent;
    analyticsConsent: "UNKNOWN" | "GRANTED" | "DENIED";
    advertisingConsent: "UNKNOWN" | "GRANTED" | "DENIED";
    dataLayer: DataLayerSink;
    deliveredKeys: Set<string>;
    storage?: StorageLike;
  }>,
): GoogleAdsBrowserDeliveryResult {
  if (input.analyticsConsent !== "GRANTED" || input.advertisingConsent !== "GRANTED") {
    return "SUPPRESSED_BY_CURRENT_CONSENT";
  }

  const parsed = parseCanonicalGoogleAdsConversion(input.conversion);

  if (parsed === null) {
    return "INVALID_CONVERSION";
  }

  const deliveryKey = `lessenc_google_ads_conversion:${parsed.lessenc_event_id}:${parsed.transaction_id}`;

  if (input.deliveredKeys.has(deliveryKey)) {
    return "DUPLICATE";
  }

  try {
    if (input.storage?.getItem(deliveryKey) === "pushed") {
      input.deliveredKeys.add(deliveryKey);

      return "DUPLICATE";
    }
  } catch {
    // Storage availability never controls financial or consent truth.
  }

  input.dataLayer.push(parsed);

  input.deliveredKeys.add(deliveryKey);

  try {
    input.storage?.setItem(deliveryKey, "pushed");
  } catch {
    // In-memory dedupe remains active for the current page lifetime.
  }

  return "DELIVERED";
}

export async function deliverCanonicalGoogleAdsConversionToBrowser(
  input: Readonly<{
    conversion: GoogleAdsConversionDataLayerEvent | null;
    gtmContainerId: string | null;
    deliveredKeys: Set<string>;
    fetcher?: FetchLike;
  }>,
): Promise<GoogleAdsBrowserDeliveryResult> {
  if (input.conversion === null) {
    return "NO_CONVERSION";
  }

  const parsed = parseCanonicalGoogleAdsConversion(input.conversion);

  if (parsed === null) {
    return "INVALID_CONVERSION";
  }

  const fetcher = input.fetcher ?? ((resource, init) => globalThis.fetch(resource, init));

  const consent = await readCurrentAnalyticsConsent(fetcher);

  if (consent.analytics !== "GRANTED" || consent.advertising !== "GRANTED") {
    return "SUPPRESSED_BY_CURRENT_CONSENT";
  }

  if (input.gtmContainerId === null) {
    return "GTM_DISABLED";
  }

  try {
    const environment = createGoogleTagManagerBrowserEnvironment();

    const synchronization = synchronizeGoogleTagManager({
      containerId: input.gtmContainerId,
      consent,
      ...environment,
      now: () => new Date(),
    });

    if (synchronization.state !== "LOADED" && synchronization.state !== "CONSENT_UPDATED") {
      return "GTM_UNAVAILABLE";
    }

    let storage: StorageLike | undefined;

    try {
      storage = globalThis.sessionStorage;
    } catch {
      storage = undefined;
    }

    return pushCanonicalGoogleAdsConversionAfterConsent({
      conversion: parsed,
      analyticsConsent: consent.analytics,
      advertisingConsent: consent.advertising,
      dataLayer: getGoogleTagDataLayer(),
      deliveredKeys: input.deliveredKeys,
      ...(storage === undefined
        ? {}
        : {
            storage,
          }),
    });
  } catch {
    return "GTM_UNAVAILABLE";
  }
}
