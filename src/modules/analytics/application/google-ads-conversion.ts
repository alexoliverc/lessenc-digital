import type { AnalyticsEventRecord } from "../../attribution/application/persistence";

export type GoogleAdsConversionDataLayerEvent = Readonly<{
  event: "lessenc_google_ads_conversion";
  lessenc_event_id: string;
  transaction_id: string;
  value: number;
  currency: "BRL";
}>;

function requireIdentifier(value: string | null, errorCode: string): string {
  if (value === null || value.trim().length === 0) {
    throw new Error(errorCode);
  }

  return value;
}

function projectBrlValue(amountMinor: number | null, currency: string | null): number {
  if (amountMinor === null || currency === null) {
    throw new Error("MISSING_GOOGLE_ADS_AUTHORITATIVE_MONEY");
  }

  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error("INVALID_GOOGLE_ADS_AMOUNT_MINOR");
  }

  if (currency !== "BRL") {
    throw new Error("UNSUPPORTED_GOOGLE_ADS_CURRENCY");
  }

  return amountMinor / 100;
}

export function projectGoogleAdsCanonicalPurchase(
  analyticsEvent: AnalyticsEventRecord,
): GoogleAdsConversionDataLayerEvent | null {
  if (analyticsEvent.type !== "PURCHASE") {
    throw new Error("GOOGLE_ADS_REQUIRES_CANONICAL_PURCHASE");
  }

  if (
    analyticsEvent.consentSnapshot.analytics !== "GRANTED" ||
    analyticsEvent.consentSnapshot.advertising !== "GRANTED"
  ) {
    return null;
  }

  const eventId = requireIdentifier(analyticsEvent.id, "INVALID_GOOGLE_ADS_EVENT_ID");

  const orderId = requireIdentifier(analyticsEvent.orderId, "MISSING_GOOGLE_ADS_TRANSACTION_ID");

  if (analyticsEvent.purchaseOrderKey !== orderId) {
    throw new Error("INVALID_GOOGLE_ADS_PURCHASE_ORDER_KEY");
  }

  const value = projectBrlValue(analyticsEvent.amountMinor, analyticsEvent.currency);

  return Object.freeze({
    event: "lessenc_google_ads_conversion" as const,
    lessenc_event_id: eventId,
    transaction_id: orderId,
    value,
    currency: "BRL" as const,
  });
}
