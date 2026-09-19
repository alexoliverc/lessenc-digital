import type { AnalyticsEventRecord } from "../../attribution/application/persistence";
import { projectMetaPixelCanonicalPurchase } from "./meta-pixel";

export const META_CAPI_TRANSMISSION_BLOCK_REASON = "MATCHING_DATA_POLICY_NOT_AUTHORIZED" as const;

export type MetaCapiTransmissionBlockReason = typeof META_CAPI_TRANSMISSION_BLOCK_REASON;

export type MetaCapiCanonicalPurchaseCore = Readonly<{
  eventName: "Purchase";

  eventTime: number;

  eventId: string;

  actionSource: "website";

  orderId: string;

  productId: string;

  offerId: string;

  value: number;

  currency: "BRL";

  quantity: 1;

  transmission: Readonly<{
    state: "BLOCKED";

    reason: MetaCapiTransmissionBlockReason;
  }>;
}>;

function eventTimeSeconds(occurredAt: Date): number {
  const milliseconds = occurredAt.getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error("INVALID_META_CAPI_EVENT_TIME");
  }

  const seconds = Math.floor(milliseconds / 1000);

  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new Error("INVALID_META_CAPI_EVENT_TIME");
  }

  return seconds;
}

export function projectMetaCapiCanonicalPurchaseCore(
  analyticsEvent: AnalyticsEventRecord,
): MetaCapiCanonicalPurchaseCore | null {
  /*
   * Reuse the already validated Pixel projection as the
   * shared Meta Purchase eligibility + identity boundary.
   *
   * This guarantees that Pixel and future CAPI use the
   * same AnalyticsEvent.id for event deduplication.
   */
  const pixel = projectMetaPixelCanonicalPurchase(analyticsEvent);

  if (pixel === null) {
    return null;
  }

  const productId = pixel.content_ids[0];

  return Object.freeze({
    eventName: "Purchase" as const,

    eventTime: eventTimeSeconds(analyticsEvent.occurredAt),

    eventId: pixel.event_id,

    actionSource: "website" as const,

    orderId: pixel.transaction_id,

    productId,

    offerId: pixel.lessenc_offer_id,

    value: pixel.value,

    currency: "BRL" as const,

    quantity: 1 as const,

    /*
     * P13 initial MVP intentionally has no authorized
     * CAPI user-data matching policy.
     *
     * A transport adapter must not convert this core into
     * an external request until that policy is explicitly
     * approved and validated.
     */
    transmission: Object.freeze({
      state: "BLOCKED" as const,

      reason: META_CAPI_TRANSMISSION_BLOCK_REASON,
    }),
  });
}
