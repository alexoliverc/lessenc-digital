import type { AnalyticsEventRecord } from "../../attribution/application/persistence";

export type MetaPixelPurchaseDataLayerEvent = Readonly<{
  event: "lessenc_meta_pixel_purchase";
  lessenc_event_id: string;
  event_id: string;
  transaction_id: string;
  value: number;
  currency: "BRL";
  content_ids: readonly [string];
  content_type: "product";
  lessenc_offer_id: string;
}>;

function requireIdentifier(value: string | null, errorCode: string): string {
  if (value === null || value.trim().length === 0) {
    throw new Error(errorCode);
  }

  return value;
}

function projectBrlValue(amountMinor: number | null, currency: string | null): number {
  if (amountMinor === null || currency === null) {
    throw new Error("MISSING_META_PIXEL_AUTHORITATIVE_MONEY");
  }

  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error("INVALID_META_PIXEL_AMOUNT_MINOR");
  }

  if (currency !== "BRL") {
    throw new Error("UNSUPPORTED_META_PIXEL_CURRENCY");
  }

  return amountMinor / 100;
}

export function projectMetaPixelCanonicalPurchase(
  analyticsEvent: AnalyticsEventRecord,
): MetaPixelPurchaseDataLayerEvent | null {
  if (analyticsEvent.type !== "PURCHASE") {
    throw new Error("META_PIXEL_REQUIRES_CANONICAL_PURCHASE");
  }

  if (
    analyticsEvent.consentSnapshot.analytics !== "GRANTED" ||
    analyticsEvent.consentSnapshot.advertising !== "GRANTED"
  ) {
    return null;
  }

  const eventId = requireIdentifier(analyticsEvent.id, "INVALID_META_PIXEL_EVENT_ID");

  const orderId = requireIdentifier(analyticsEvent.orderId, "MISSING_META_PIXEL_TRANSACTION_ID");

  if (analyticsEvent.purchaseOrderKey !== orderId) {
    throw new Error("INVALID_META_PIXEL_PURCHASE_ORDER_KEY");
  }

  const productId = requireIdentifier(analyticsEvent.productId, "MISSING_META_PIXEL_PRODUCT_ID");

  const offerId = requireIdentifier(analyticsEvent.offerId, "MISSING_META_PIXEL_OFFER_ID");

  const value = projectBrlValue(analyticsEvent.amountMinor, analyticsEvent.currency);

  return Object.freeze({
    event: "lessenc_meta_pixel_purchase" as const,

    lessenc_event_id: eventId,

    /*
     * This identifier is intentionally equal to the
     * canonical AnalyticsEvent.id. P13-F5 Meta CAPI
     * must reuse the same value for browser/server
     * deduplication.
     */
    event_id: eventId,

    transaction_id: orderId,

    value,

    currency: "BRL" as const,

    content_ids: Object.freeze([productId]) as readonly [string],

    content_type: "product" as const,

    lessenc_offer_id: offerId,
  });
}
