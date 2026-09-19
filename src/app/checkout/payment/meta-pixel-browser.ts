import type { MetaPixelPurchaseDataLayerEvent } from "@/modules/analytics/application/meta-pixel";
import {
  createGoogleTagManagerBrowserEnvironment,
  getGoogleTagDataLayer,
} from "@/modules/analytics/application/google-tag-manager-browser";
import { synchronizeGoogleTagManager } from "@/modules/analytics/application/google-tag-manager-runtime";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ConsentState = "UNKNOWN" | "GRANTED" | "DENIED";

type CurrentConsent = Readonly<{
  analytics: ConsentState;
  advertising: ConsentState;
  policyVersion: string;
}>;

type StorageLike = Readonly<{
  getItem(key: string): string | null;

  setItem(key: string, value: string): void;
}>;

type DataLayerSink = Readonly<{
  push(value: unknown): number;
}>;

export type MetaPixelBrowserDeliveryResult =
  | "DELIVERED"
  | "NO_PURCHASE"
  | "INVALID_PURCHASE"
  | "SUPPRESSED_BY_CURRENT_CONSENT"
  | "GTM_DISABLED"
  | "GTM_UNAVAILABLE"
  | "DUPLICATE";

const UNKNOWN_CURRENT_CONSENT: CurrentConsent = Object.freeze({
  analytics: "UNKNOWN",

  advertising: "UNKNOWN",

  policyVersion: "unknown",
});

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function consentState(value: unknown): ConsentState | null {
  return value === "UNKNOWN" || value === "GRANTED" || value === "DENIED" ? value : null;
}

function validMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/*
 * Meta belongs to the advertising consent category.
 *
 * This reader intentionally preserves the two current consent
 * dimensions independently. In particular:
 *
 *   analytics = DENIED
 *   advertising = GRANTED
 *
 * is a valid current state for advertising delivery.
 *
 * Any transport or contract failure returns UNKNOWN/UNKNOWN.
 */
export async function readCurrentMetaConsent(fetcher: FetchLike): Promise<CurrentConsent> {
  try {
    const response = await fetcher("/api/analytics/consent", {
      method: "GET",

      credentials: "same-origin",

      cache: "no-store",

      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return UNKNOWN_CURRENT_CONSENT;
    }

    const payload: unknown = await response.json();

    const source = record(payload);

    if (source === null) {
      return UNKNOWN_CURRENT_CONSENT;
    }

    const analytics = consentState(source.analytics);

    const advertising = consentState(source.advertising);

    if (analytics === null || advertising === null || !nonEmptyString(source.policyVersion)) {
      return UNKNOWN_CURRENT_CONSENT;
    }

    return Object.freeze({
      analytics,

      advertising,

      policyVersion: source.policyVersion,
    });
  } catch {
    return UNKNOWN_CURRENT_CONSENT;
  }
}

export function parseCanonicalMetaPixelPurchase(
  value: unknown,
): MetaPixelPurchaseDataLayerEvent | null {
  const source = record(value);

  if (source === null) {
    return null;
  }

  const exactKeys = [
    "content_ids",
    "content_type",
    "currency",
    "event",
    "event_id",
    "lessenc_event_id",
    "lessenc_offer_id",
    "transaction_id",
    "value",
  ].sort();

  if (Object.keys(source).sort().join(",") !== exactKeys.join(",")) {
    return null;
  }

  if (
    source.event !== "lessenc_meta_pixel_purchase" ||
    !nonEmptyString(source.lessenc_event_id) ||
    !nonEmptyString(source.event_id) ||
    source.event_id !== source.lessenc_event_id ||
    !nonEmptyString(source.transaction_id) ||
    !validMoney(source.value) ||
    source.currency !== "BRL" ||
    !Array.isArray(source.content_ids) ||
    source.content_ids.length !== 1 ||
    !nonEmptyString(source.content_ids[0]) ||
    source.content_type !== "product" ||
    !nonEmptyString(source.lessenc_offer_id)
  ) {
    return null;
  }

  return Object.freeze({
    event: "lessenc_meta_pixel_purchase" as const,

    lessenc_event_id: source.lessenc_event_id,

    event_id: source.event_id,

    transaction_id: source.transaction_id,

    value: source.value,

    currency: "BRL" as const,

    content_ids: Object.freeze([source.content_ids[0]]) as readonly [string],

    content_type: "product" as const,

    lessenc_offer_id: source.lessenc_offer_id,
  });
}

export function pushCanonicalMetaPixelPurchaseAfterConsent(
  input: Readonly<{
    purchase: MetaPixelPurchaseDataLayerEvent;

    advertisingConsent: ConsentState;

    dataLayer: DataLayerSink;

    deliveredKeys: Set<string>;

    storage?: StorageLike;
  }>,
): MetaPixelBrowserDeliveryResult {
  if (input.advertisingConsent !== "GRANTED") {
    return "SUPPRESSED_BY_CURRENT_CONSENT";
  }

  const parsed = parseCanonicalMetaPixelPurchase(input.purchase);

  if (parsed === null) {
    return "INVALID_PURCHASE";
  }

  const deliveryKey = `lessenc_meta_pixel_purchase:${parsed.event_id}:${parsed.transaction_id}`;

  if (input.deliveredKeys.has(deliveryKey)) {
    return "DUPLICATE";
  }

  try {
    if (input.storage?.getItem(deliveryKey) === "pushed") {
      input.deliveredKeys.add(deliveryKey);

      return "DUPLICATE";
    }
  } catch {
    /*
     * Browser storage availability never controls
     * consent, payment, or canonical event truth.
     */
  }

  input.dataLayer.push(parsed);

  input.deliveredKeys.add(deliveryKey);

  try {
    input.storage?.setItem(deliveryKey, "pushed");
  } catch {
    /*
     * Page-lifetime dedupe remains active even when
     * sessionStorage is unavailable.
     */
  }

  return "DELIVERED";
}

export async function deliverCanonicalMetaPixelPurchaseToBrowser(
  input: Readonly<{
    purchase: MetaPixelPurchaseDataLayerEvent | null;

    gtmContainerId: string | null;

    deliveredKeys: Set<string>;

    fetcher?: FetchLike;
  }>,
): Promise<MetaPixelBrowserDeliveryResult> {
  if (input.purchase === null) {
    return "NO_PURCHASE";
  }

  const parsed = parseCanonicalMetaPixelPurchase(input.purchase);

  if (parsed === null) {
    return "INVALID_PURCHASE";
  }

  const fetcher = input.fetcher ?? ((resource, init) => globalThis.fetch(resource, init));

  const consent = await readCurrentMetaConsent(fetcher);

  if (consent.advertising !== "GRANTED") {
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

    return pushCanonicalMetaPixelPurchaseAfterConsent({
      purchase: parsed,

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
