import { describe, expect, it } from "vitest";

import type {
  AcquisitionJourneyRecord,
  AnalyticsEventCreateResult,
  AnalyticsEventRecord,
  AnalyticsEventRepository,
  CreateAnalyticsEvent,
} from "../../attribution/application/persistence";
import {
  P13_ANALYTICS_SCHEMA_VERSION,
  P13_MEASUREMENT_POLICY_VERSION,
  ProduceInternalMeasurement,
  analyticsAttributionState,
  analyticsConsentSnapshot,
  buildInternalMeasurementEvent,
  type ProduceInternalMeasurementInput,
} from "./internal-measurement";

function journey(overrides: Partial<AcquisitionJourneyRecord> = {}): AcquisitionJourneyRecord {
  return Object.freeze({
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: new Date("2026-09-19T12:00:00.000Z"),
    lastSeenAt: new Date("2026-09-19T12:05:00.000Z"),
    expiresAt: new Date("2026-10-19T12:00:00.000Z"),
    firstTouchId: "22222222-2222-4222-8222-222222222222",
    lastTouchId: "33333333-3333-4333-8333-333333333333",
    analyticsConsentState: "GRANTED",
    advertisingConsentState: "DENIED",
    policyVersion: "p13-architecture-freeze-r2",
    ...overrides,
  });
}

function measurementInput(
  overrides: Partial<ProduceInternalMeasurementInput> = {},
): ProduceInternalMeasurementInput {
  return Object.freeze({
    eventId: "44444444-4444-4444-8444-444444444444",
    type: "VIEW_CONTENT",
    occurredAt: new Date("2026-09-19T12:10:00.000Z"),
    journey: journey(),
    productId: "55555555-5555-4555-8555-555555555555",
    offerId: "66666666-6666-4666-8666-666666666666",
    amountMinor: 2990,
    currency: "BRL",
    ...overrides,
  });
}

function toRecord(input: CreateAnalyticsEvent): AnalyticsEventRecord {
  return Object.freeze({
    ...input,
    consentSnapshot: Object.freeze({
      ...input.consentSnapshot,
    }),
    createdAt: new Date("2026-09-19T12:10:01.000Z"),
  });
}

class RecordingAnalyticsEventRepository implements AnalyticsEventRepository {
  readonly idempotentInputs: CreateAnalyticsEvent[] = [];

  constructor(private readonly replayState: "CREATED" | "EXISTING" = "CREATED") {}

  async create(input: CreateAnalyticsEvent): Promise<AnalyticsEventRecord> {
    return toRecord(input);
  }

  async createIdempotent(input: CreateAnalyticsEvent): Promise<AnalyticsEventCreateResult> {
    this.idempotentInputs.push(input);

    return Object.freeze({
      state: this.replayState,
      event: toRecord(input),
    });
  }

  async findById(): Promise<AnalyticsEventRecord | null> {
    return null;
  }

  async findPurchaseByOrderKey(): Promise<AnalyticsEventRecord | null> {
    return null;
  }
}

describe("P13-D internal measurement", () => {
  it("builds an attributed VIEW_CONTENT from authoritative commercial context", () => {
    const input = measurementInput();

    const event = buildInternalMeasurementEvent(input);

    expect(event).toEqual({
      id: input.eventId,
      type: "VIEW_CONTENT",
      occurredAt: input.occurredAt,
      journeyId: input.journey?.id,
      productId: input.productId,
      offerId: input.offerId,
      orderId: null,
      amountMinor: 2990,
      currency: "BRL",
      attributionState: "ATTRIBUTED",
      consentSnapshot: {
        analytics: "GRANTED",
        advertising: "DENIED",
        policyVersion: "p13-architecture-freeze-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: null,
    });

    expect(event.occurredAt).not.toBe(input.occurredAt);
    expect(P13_ANALYTICS_SCHEMA_VERSION).toBe(1);
  });

  it("keeps a direct-only Journey UNATTRIBUTED while preserving its consent snapshot", () => {
    const directJourney = journey({
      firstTouchId: null,
      lastTouchId: null,
      analyticsConsentState: "DENIED",
      advertisingConsentState: "GRANTED",
    });

    expect(analyticsAttributionState(directJourney)).toBe("UNATTRIBUTED");

    expect(analyticsConsentSnapshot(directJourney)).toEqual({
      analytics: "DENIED",
      advertising: "GRANTED",
      policyVersion: "p13-architecture-freeze-r2",
    });
  });

  it("uses explicit UNKNOWN consent and UNATTRIBUTED when no Journey exists", () => {
    const event = buildInternalMeasurementEvent(
      measurementInput({
        journey: null,
      }),
    );

    expect(event.journeyId).toBeNull();
    expect(event.attributionState).toBe("UNATTRIBUTED");

    expect(event.consentSnapshot).toEqual({
      analytics: "UNKNOWN",
      advertising: "UNKNOWN",
      policyVersion: P13_MEASUREMENT_POLICY_VERSION,
    });
  });

  it("builds INITIATE_CHECKOUT without inventing Order or PURCHASE authority", () => {
    const event = buildInternalMeasurementEvent(
      measurementInput({
        type: "INITIATE_CHECKOUT",
        eventId: "77777777-7777-4777-8777-777777777777",
      }),
    );

    expect(event.type).toBe("INITIATE_CHECKOUT");
    expect(event.orderId).toBeNull();
    expect(event.purchaseOrderKey).toBeNull();
    expect(event.amountMinor).toBe(2990);
    expect(event.currency).toBe("BRL");
  });

  it("rejects incomplete or malformed monetary context", () => {
    expect(() =>
      buildInternalMeasurementEvent(
        measurementInput({
          amountMinor: 2990,
          currency: null,
        }),
      ),
    ).toThrow("INVALID_ANALYTICS_MONEY");

    expect(() =>
      buildInternalMeasurementEvent(
        measurementInput({
          amountMinor: -1,
          currency: "BRL",
        }),
      ),
    ).toThrow("INVALID_ANALYTICS_AMOUNT");

    expect(() =>
      buildInternalMeasurementEvent(
        measurementInput({
          amountMinor: 2990,
          currency: "brl",
        }),
      ),
    ).toThrow("INVALID_ANALYTICS_CURRENCY");
  });

  it("uses the repository idempotent boundary and preserves EXISTING replays", async () => {
    const repository = new RecordingAnalyticsEventRepository("EXISTING");
    const producer = new ProduceInternalMeasurement(repository);

    const result = await producer.execute(measurementInput());

    expect(result.state).toBe("EXISTING");
    expect(repository.idempotentInputs).toHaveLength(1);

    expect(repository.idempotentInputs[0]).toMatchObject({
      type: "VIEW_CONTENT",
      attributionState: "ATTRIBUTED",
      schemaVersion: 1,
    });
  });

  it("rejects PURCHASE at the P13-D producer boundary", () => {
    const invalidInput = {
      ...measurementInput(),
      type: "PURCHASE",
    } as unknown as ProduceInternalMeasurementInput;

    expect(() => buildInternalMeasurementEvent(invalidInput)).toThrow(
      "UNSUPPORTED_P13_D_ANALYTICS_EVENT",
    );
  });
});
