import type { AnalyticsConsentProjection } from "@/modules/analytics/application/consent";
import {
  pushGa4EcommerceDataLayer,
  type Ga4DataLayerEvent,
  type Ga4DataLayerSink,
} from "@/modules/analytics/application/google-analytics-4";
import {
  createGoogleTagManagerBrowserEnvironment,
  getGoogleTagDataLayer,
} from "@/modules/analytics/application/google-tag-manager-browser";
import { synchronizeGoogleTagManager } from "@/modules/analytics/application/google-tag-manager-runtime";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type StorageLike = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}>;

export type Ga4PurchaseBrowserDeliveryResult =
  | "DELIVERED"
  | "NO_PURCHASE"
  | "INVALID_PURCHASE"
  | "SUPPRESSED_BY_CURRENT_CONSENT"
  | "GTM_DISABLED"
  | "GTM_UNAVAILABLE"
  | "DUPLICATE";

const UNKNOWN_CONSENT: AnalyticsConsentProjection = Object.freeze({
  analytics: "UNKNOWN",
  advertising: "UNKNOWN",
  policyVersion: "p13-architecture-freeze-r2",
});

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

export function parseCanonicalGa4Purchase(value: unknown): Ga4DataLayerEvent | null {
  if (value === null || value === undefined) {
    return null;
  }

  const source = record(value);

  if (source === null || source.event !== "purchase" || !nonEmptyString(source.lessenc_event_id)) {
    return null;
  }

  const ecommerce = record(source.ecommerce);

  if (
    ecommerce === null ||
    ecommerce.currency !== "BRL" ||
    !validMoney(ecommerce.value) ||
    !nonEmptyString(ecommerce.transaction_id) ||
    !Array.isArray(ecommerce.items) ||
    ecommerce.items.length === 0
  ) {
    return null;
  }

  const items = [];

  for (const candidate of ecommerce.items) {
    const item = record(candidate);

    if (
      item === null ||
      !nonEmptyString(item.item_id) ||
      !validMoney(item.price) ||
      item.quantity !== 1 ||
      !nonEmptyString(item.lessenc_offer_id)
    ) {
      return null;
    }

    items.push(
      Object.freeze({
        item_id: item.item_id,
        price: item.price,
        quantity: 1 as const,
        lessenc_offer_id: item.lessenc_offer_id,
      }),
    );
  }

  return Object.freeze({
    event: "purchase" as const,
    lessenc_event_id: source.lessenc_event_id,
    ecommerce: Object.freeze({
      currency: "BRL" as const,
      value: ecommerce.value,
      transaction_id: ecommerce.transaction_id,
      items: Object.freeze(items),
    }),
  });
}

function parseConsent(value: unknown): AnalyticsConsentProjection {
  const source = record(value);

  if (
    source === null ||
    !["UNKNOWN", "GRANTED", "DENIED"].includes(String(source.analytics)) ||
    !["UNKNOWN", "GRANTED", "DENIED"].includes(String(source.advertising)) ||
    !nonEmptyString(source.policyVersion)
  ) {
    return UNKNOWN_CONSENT;
  }

  const analytics = source.analytics as AnalyticsConsentProjection["analytics"];

  const advertising = source.advertising as AnalyticsConsentProjection["advertising"];

  if (analytics === "DENIED" && advertising === "GRANTED") {
    return UNKNOWN_CONSENT;
  }

  return Object.freeze({
    analytics,
    advertising,
    policyVersion: source.policyVersion,
  });
}

export async function readCurrentAnalyticsConsent(
  fetcher: FetchLike,
): Promise<AnalyticsConsentProjection> {
  try {
    const response = await fetcher("/api/analytics/consent", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      return UNKNOWN_CONSENT;
    }

    return parseConsent(await response.json());
  } catch {
    return UNKNOWN_CONSENT;
  }
}

export function pushCanonicalGa4PurchaseAfterConsent(
  input: Readonly<{
    purchase: Ga4DataLayerEvent;
    consent: AnalyticsConsentProjection;
    dataLayer: Ga4DataLayerSink;
    deliveredKeys: Set<string>;
    storage?: StorageLike;
  }>,
): Ga4PurchaseBrowserDeliveryResult {
  if (input.consent.analytics !== "GRANTED") {
    return "SUPPRESSED_BY_CURRENT_CONSENT";
  }

  const parsed = parseCanonicalGa4Purchase(input.purchase);

  if (parsed === null) {
    return "INVALID_PURCHASE";
  }

  const transactionId = parsed.ecommerce.transaction_id;

  if (transactionId === undefined) {
    return "INVALID_PURCHASE";
  }

  const deliveryKey = `lessenc_ga4_purchase:${parsed.lessenc_event_id}:${transactionId}`;

  if (input.deliveredKeys.has(deliveryKey)) {
    return "DUPLICATE";
  }

  try {
    if (input.storage?.getItem(deliveryKey) === "pushed") {
      input.deliveredKeys.add(deliveryKey);

      return "DUPLICATE";
    }
  } catch {
    // Storage availability must not control financial UI or analytics eligibility.
  }

  input.dataLayer.push({
    event: "lessenc_consent_update",
    analyticsAllowed: true,
    advertisingAllowed: input.consent.advertising === "GRANTED",
    consentPolicyVersion: input.consent.policyVersion,
  });

  pushGa4EcommerceDataLayer(input.dataLayer, parsed);

  input.deliveredKeys.add(deliveryKey);

  try {
    input.storage?.setItem(deliveryKey, "pushed");
  } catch {
    // In-memory deduplication remains active for this page lifetime.
  }

  return "DELIVERED";
}

export async function deliverCanonicalGa4PurchaseToBrowser(
  input: Readonly<{
    purchase: Ga4DataLayerEvent | null;
    gtmContainerId: string | null;
    deliveredKeys: Set<string>;
    fetcher?: FetchLike;
  }>,
): Promise<Ga4PurchaseBrowserDeliveryResult> {
  if (input.purchase === null) {
    return "NO_PURCHASE";
  }

  const parsed = parseCanonicalGa4Purchase(input.purchase);

  if (parsed === null) {
    return "INVALID_PURCHASE";
  }

  const fetcher = input.fetcher ?? ((resource, init) => globalThis.fetch(resource, init));

  const consent = await readCurrentAnalyticsConsent(fetcher);

  if (consent.analytics !== "GRANTED") {
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

    return pushCanonicalGa4PurchaseAfterConsent({
      purchase: parsed,
      consent,
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
