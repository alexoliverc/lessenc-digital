import { describe, expect, it } from "vitest";

import type { AcquisitionJourneyRecord } from "../../attribution/application/persistence";
import { projectBrowserMeasurement } from "./browser-measurement";

const journey: AcquisitionJourneyRecord = Object.freeze({
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: new Date("2026-09-19T12:00:00.000Z"),
  lastSeenAt: new Date("2026-09-19T12:05:00.000Z"),
  expiresAt: new Date("2026-10-19T12:00:00.000Z"),
  firstTouchId: "22222222-2222-4222-8222-222222222222",
  lastTouchId: "22222222-2222-4222-8222-222222222222",
  analyticsConsentState: "GRANTED",
  advertisingConsentState: "DENIED",
  policyVersion: "p13-architecture-freeze-r2",
});

describe("P13-D browser-safe measurement projection", () => {
  it("projects only provider-neutral commercial fields and consent", () => {
    const projected = projectBrowserMeasurement({
      eventId: "33333333-3333-4333-8333-333333333333",
      type: "VIEW_CONTENT",
      journey,
      productId: "44444444-4444-4444-8444-444444444444",
      offerId: "55555555-5555-4555-8555-555555555555",
      amountMinor: 2990,
      currency: "BRL",
    });

    expect(projected).toEqual({
      consent: {
        analytics: "GRANTED",
        advertising: "DENIED",
        policyVersion: "p13-architecture-freeze-r2",
      },
      measurement: {
        event: "lessenc_measurement",
        eventId: "33333333-3333-4333-8333-333333333333",
        measurementType: "VIEW_CONTENT",
        productId: "44444444-4444-4444-8444-444444444444",
        offerId: "55555555-5555-4555-8555-555555555555",
        amountMinor: 2990,
        currency: "BRL",
        schemaVersion: 1,
      },
    });

    const serialized = JSON.stringify(projected);

    expect(serialized).not.toContain(journey.id);
    expect(serialized).not.toMatch(/email|phone|cpf|ipAddress|userAgent|token|secret/i);
  });
});
