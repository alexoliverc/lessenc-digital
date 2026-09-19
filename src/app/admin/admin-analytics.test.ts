import { describe, expect, it } from "vitest";
import { buildAdminAnalyticsReport, parseAnalyticsWindow } from "./admin-analytics";

const window = {
  from: new Date("2026-09-01T00:00:00.000Z"),
  to: new Date("2026-10-01T00:00:00.000Z"),
};

describe("admin analytics reporting", () => {
  it("keeps event counts distinct from unique journeys, conversions and canonical revenue", () => {
    const report = buildAdminAnalyticsReport({
      window,
      events: [
        {
          id: "v1",
          type: "VIEW_CONTENT",
          occurredAt: new Date(),
          journeyId: "j1",
          orderId: null,
          amountMinor: null,
          currency: null,
          attributionState: "ATTRIBUTED",
        },
        {
          id: "v2",
          type: "VIEW_CONTENT",
          occurredAt: new Date(),
          journeyId: "j1",
          orderId: null,
          amountMinor: null,
          currency: null,
          attributionState: "ATTRIBUTED",
        },
        {
          id: "c1",
          type: "INITIATE_CHECKOUT",
          occurredAt: new Date(),
          journeyId: "j1",
          orderId: null,
          amountMinor: null,
          currency: null,
          attributionState: "ATTRIBUTED",
        },
        {
          id: "p1",
          type: "PURCHASE",
          occurredAt: new Date(),
          journeyId: "j1",
          orderId: "o1",
          amountMinor: 2990,
          currency: "BRL",
          attributionState: "ATTRIBUTED",
        },
        {
          id: "p2",
          type: "PURCHASE",
          occurredAt: new Date(),
          journeyId: null,
          orderId: "o2",
          amountMinor: 1990,
          currency: "BRL",
          attributionState: "UNATTRIBUTED",
        },
      ],
      dimensions: [
        {
          eventId: "v1",
          firstTouch: { source: "google", medium: "cpc", campaign: "spring" },
          lastTouch: { source: "google", medium: "cpc", campaign: "spring" },
        },
        {
          eventId: "v2",
          firstTouch: { source: "google", medium: "cpc", campaign: "spring" },
          lastTouch: { source: "google", medium: "cpc", campaign: "spring" },
        },
        {
          eventId: "c1",
          firstTouch: { source: "google", medium: "cpc", campaign: "spring" },
          lastTouch: { source: "instagram", medium: "social", campaign: "spring" },
        },
        {
          eventId: "p1",
          firstTouch: { source: "google", medium: "cpc", campaign: "spring" },
          lastTouch: { source: "email", medium: "crm", campaign: "recover" },
        },
        { eventId: "p2", firstTouch: null, lastTouch: null },
      ],
    });
    expect(report.events.VIEW_CONTENT).toEqual({ events: 2, uniqueJourneys: 1 });
    expect(report.events.PURCHASE).toEqual({ events: 2, uniqueJourneys: 1 });
    expect(report.uniqueJourneys).toBe(1);
    expect(report.conversions).toEqual({
      viewToCheckout: 100,
      checkoutToPurchase: 100,
      viewToPurchase: 100,
    });
    expect(report.revenue).toEqual({
      totalMinor: 4980,
      attributedMinor: 2990,
      unattributedMinor: 1990,
      currency: "BRL",
    });
  });

  it("uses zero for conversion with an absent denominator and preserves null dimensions", () => {
    const report = buildAdminAnalyticsReport({
      window,
      events: [
        {
          id: "p",
          type: "PURCHASE",
          occurredAt: new Date(),
          journeyId: null,
          orderId: "o",
          amountMinor: 100,
          currency: "BRL",
          attributionState: "UNATTRIBUTED",
        },
      ],
      dimensions: [{ eventId: "p", firstTouch: null, lastTouch: null }],
    });
    expect(report.conversions).toEqual({
      viewToCheckout: 0,
      checkoutToPurchase: 0,
      viewToPurchase: 0,
    });
    expect(report.firstTouch).toEqual([
      {
        source: null,
        medium: null,
        campaign: null,
        events: 1,
        uniqueJourneys: 0,
        purchases: 1,
        revenueMinor: 100,
      },
    ]);
  });

  it("normalizes a maximum ninety-day UTC reporting window", () => {
    expect(
      parseAnalyticsWindow(
        { from: "2026-09-01", to: "2026-11-29" },
        new Date("2026-12-10T13:00:00.000Z"),
      ),
    ).toEqual({
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-11-30T00:00:00.000Z"),
    });
    expect(
      parseAnalyticsWindow(
        { from: "2026-09-01", to: "2026-12-01" },
        new Date("2026-12-10T13:00:00.000Z"),
      ),
    ).toEqual({
      from: new Date("2026-11-11T00:00:00.000Z"),
      to: new Date("2026-12-11T00:00:00.000Z"),
    });
  });
});
