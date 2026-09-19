import { isJourneyActive, isWithinAttributionLookback } from "./acquisition-policy";
import type {
  AcquisitionJourneyRecord,
  AttributionTouchRecord,
  CreateOrderAttributionSnapshot,
} from "./persistence";

export type BuildOrderAttributionSnapshotInput = Readonly<{
  id: string;
  orderId: string;
  journeyId: string | null;
  capturedAt: Date;
  journey: AcquisitionJourneyRecord | null;
  firstTouch: AttributionTouchRecord | null;
  lastTouch: AttributionTouchRecord | null;
}>;

function isEligibleExternalTouch(
  touch: AttributionTouchRecord | null,
  journeyId: string,
  capturedAt: Date,
): touch is AttributionTouchRecord {
  if (touch === null) {
    return false;
  }

  if (touch.journeyId !== journeyId) {
    return false;
  }

  if (touch.touchType !== "CAMPAIGN" && touch.touchType !== "REFERRAL") {
    return false;
  }

  return isWithinAttributionLookback(touch.occurredAt, capturedAt);
}

function unattributedSnapshot(
  input: BuildOrderAttributionSnapshotInput,
): CreateOrderAttributionSnapshot {
  return Object.freeze({
    id: input.id,
    orderId: input.orderId,
    journeyId: null,
    firstTouchId: null,
    lastTouchId: null,
    firstSource: null,
    firstMedium: null,
    firstCampaign: null,
    firstContent: null,
    firstTerm: null,
    lastSource: null,
    lastMedium: null,
    lastCampaign: null,
    lastContent: null,
    lastTerm: null,
    capturedAt: input.capturedAt,
  });
}

export function buildOrderAttributionSnapshot(
  input: BuildOrderAttributionSnapshotInput,
): CreateOrderAttributionSnapshot {
  if (
    input.journeyId === null ||
    input.journey === null ||
    input.journey.id !== input.journeyId ||
    !isJourneyActive(input.journey.expiresAt, input.capturedAt)
  ) {
    return unattributedSnapshot(input);
  }

  const firstTouch = isEligibleExternalTouch(input.firstTouch, input.journey.id, input.capturedAt)
    ? input.firstTouch
    : null;

  const lastTouch = isEligibleExternalTouch(input.lastTouch, input.journey.id, input.capturedAt)
    ? input.lastTouch
    : null;

  /*
   * The Journey may remain useful pseudonymous context even
   * when it contains no eligible external attribution.
   *
   * Such an Order is still unattributed: its First/Last
   * attribution fields remain null and no synthetic value
   * such as "unknown" is created.
   */
  return Object.freeze({
    id: input.id,
    orderId: input.orderId,
    journeyId: input.journey.id,

    firstTouchId: firstTouch?.id ?? null,
    lastTouchId: lastTouch?.id ?? null,

    firstSource: firstTouch?.source ?? null,
    firstMedium: firstTouch?.medium ?? null,
    firstCampaign: firstTouch?.campaign ?? null,
    firstContent: firstTouch?.content ?? null,
    firstTerm: firstTouch?.term ?? null,

    lastSource: lastTouch?.source ?? null,
    lastMedium: lastTouch?.medium ?? null,
    lastCampaign: lastTouch?.campaign ?? null,
    lastContent: lastTouch?.content ?? null,
    lastTerm: lastTouch?.term ?? null,

    capturedAt: input.capturedAt,
  });
}
