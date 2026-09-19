import type {
  AcquisitionJourneyRecord,
  AnalyticsConsentSnapshot,
  AnalyticsEventCreateResult,
  AnalyticsEventRepository,
  CreateAnalyticsEvent,
} from "../../attribution/application/persistence";

export const P13_ANALYTICS_SCHEMA_VERSION = 1;

export const P13_MEASUREMENT_POLICY_VERSION = "p13-architecture-freeze-r2";

export type P13DInternalMeasurementType = "VIEW_CONTENT" | "INITIATE_CHECKOUT";

export type AnalyticsAttributionState = "ATTRIBUTED" | "UNATTRIBUTED";

export type ProduceInternalMeasurementInput = Readonly<{
  eventId: string;
  type: P13DInternalMeasurementType;
  occurredAt: Date;
  journey: AcquisitionJourneyRecord | null;
  productId: string;
  offerId: string;
  amountMinor: number | null;
  currency: string | null;
}>;

function requireIdentifier(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`INVALID_ANALYTICS_${field}`);
  }
}

function validateMeasurementInput(input: ProduceInternalMeasurementInput): void {
  if (input.type !== "VIEW_CONTENT" && input.type !== "INITIATE_CHECKOUT") {
    throw new Error("UNSUPPORTED_P13_D_ANALYTICS_EVENT");
  }

  requireIdentifier(input.eventId, "EVENT_ID");
  requireIdentifier(input.productId, "PRODUCT_ID");
  requireIdentifier(input.offerId, "OFFER_ID");

  if (Number.isNaN(input.occurredAt.getTime())) {
    throw new Error("INVALID_ANALYTICS_OCCURRED_AT");
  }

  if ((input.amountMinor === null) !== (input.currency === null)) {
    throw new Error("INVALID_ANALYTICS_MONEY");
  }

  if (
    input.amountMinor !== null &&
    (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0)
  ) {
    throw new Error("INVALID_ANALYTICS_AMOUNT");
  }

  if (input.currency !== null && !/^[A-Z]{3}$/u.test(input.currency)) {
    throw new Error("INVALID_ANALYTICS_CURRENCY");
  }
}

export function analyticsConsentSnapshot(
  journey: AcquisitionJourneyRecord | null,
): AnalyticsConsentSnapshot {
  return Object.freeze({
    analytics: journey?.analyticsConsentState ?? "UNKNOWN",
    advertising: journey?.advertisingConsentState ?? "UNKNOWN",
    policyVersion: journey?.policyVersion ?? P13_MEASUREMENT_POLICY_VERSION,
  });
}

export function analyticsAttributionState(
  journey: AcquisitionJourneyRecord | null,
): AnalyticsAttributionState {
  if (journey === null) {
    return "UNATTRIBUTED";
  }

  return journey.firstTouchId !== null || journey.lastTouchId !== null
    ? "ATTRIBUTED"
    : "UNATTRIBUTED";
}

export function buildInternalMeasurementEvent(
  input: ProduceInternalMeasurementInput,
): CreateAnalyticsEvent {
  validateMeasurementInput(input);

  return Object.freeze({
    id: input.eventId,
    type: input.type,
    occurredAt: new Date(input.occurredAt.getTime()),
    journeyId: input.journey?.id ?? null,
    productId: input.productId,
    offerId: input.offerId,
    orderId: null,
    amountMinor: input.amountMinor,
    currency: input.currency,
    attributionState: analyticsAttributionState(input.journey),
    consentSnapshot: analyticsConsentSnapshot(input.journey),
    schemaVersion: P13_ANALYTICS_SCHEMA_VERSION,
    purchaseOrderKey: null,
  });
}

export class ProduceInternalMeasurement {
  constructor(private readonly events: AnalyticsEventRepository) {}

  execute(input: ProduceInternalMeasurementInput): Promise<AnalyticsEventCreateResult> {
    return this.events.createIdempotent(buildInternalMeasurementEvent(input));
  }
}
