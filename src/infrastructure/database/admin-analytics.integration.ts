import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readAdminAnalytics } from "@/app/admin/admin-analytics-query";
import { createDatabaseClient } from "./client";

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;
  if (process.env.APP_ENV !== "test" || !raw)
    throw new Error("P13-G requires isolated test configuration");
  const url = new URL(raw);
  if (
    url.protocol !== "mysql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "3307" ||
    url.pathname !== "/lessenc_test"
  ) {
    throw new Error("P13-G refused a non-isolated test database");
  }
  return raw;
}

const ids = {
  customer: randomUUID(),
  order: randomUUID(),
  journey: randomUUID(),
  first: randomUUID(),
  later: randomUUID(),
  view: randomUUID(),
  checkout: randomUUID(),
  purchase: randomUUID(),
  attribution: randomUUID(),
};
const db = createDatabaseClient(guardedTestUrl());

describe("P13-G admin analytics on isolated MySQL", () => {
  beforeAll(async () => {
    await db.customer.create({
      data: { id: ids.customer, email: `${ids.customer}@example.invalid` },
    });
    await db.order.create({
      data: {
        id: ids.order,
        customerId: ids.customer,
        status: "PAID",
        totalMinor: 2990,
        currency: "BRL",
        paidAt: new Date("2026-09-05T14:00:00.000Z"),
      },
    });
    await db.acquisitionJourney.create({
      data: {
        id: ids.journey,
        expiresAt: new Date("2026-10-01T00:00:00.000Z"),
        firstTouchId: ids.first,
        lastTouchId: ids.later,
        policyVersion: "fixture",
      },
    });
    await db.attributionTouch.createMany({
      data: [
        {
          id: ids.first,
          journeyId: ids.journey,
          occurredAt: new Date("2026-09-05T10:00:00.000Z"),
          source: "google",
          medium: "cpc",
          campaign: "first",
          touchType: "CAMPAIGN",
        },
        {
          id: ids.later,
          journeyId: ids.journey,
          occurredAt: new Date("2026-09-05T12:00:00.000Z"),
          source: "instagram",
          medium: "social",
          campaign: "later",
          touchType: "CAMPAIGN",
        },
      ],
    });
    await db.orderAttribution.create({
      data: {
        id: ids.attribution,
        orderId: ids.order,
        journeyId: ids.journey,
        firstTouchId: ids.first,
        lastTouchId: ids.later,
        firstSource: "email",
        firstMedium: "crm",
        firstCampaign: "purchase-first",
        lastSource: "affiliate",
        lastMedium: "partner",
        lastCampaign: "purchase-last",
      },
    });
    await db.analyticsEvent.createMany({
      data: [
        {
          id: ids.view,
          type: "VIEW_CONTENT",
          occurredAt: new Date("2026-09-05T11:00:00.000Z"),
          journeyId: ids.journey,
          attributionState: "ATTRIBUTED",
          consentSnapshot: {},
          schemaVersion: 1,
        },
        {
          id: ids.checkout,
          type: "INITIATE_CHECKOUT",
          occurredAt: new Date("2026-09-05T13:00:00.000Z"),
          journeyId: ids.journey,
          attributionState: "ATTRIBUTED",
          consentSnapshot: {},
          schemaVersion: 1,
        },
        {
          id: ids.purchase,
          type: "PURCHASE",
          occurredAt: new Date("2026-09-05T14:00:00.000Z"),
          journeyId: ids.journey,
          orderId: ids.order,
          amountMinor: 2990,
          currency: "BRL",
          attributionState: "ATTRIBUTED",
          consentSnapshot: {},
          schemaVersion: 1,
          purchaseOrderKey: ids.order,
        },
      ],
    });
  });

  afterAll(async () => {
    await db.analyticsEvent.deleteMany({
      where: { id: { in: [ids.view, ids.checkout, ids.purchase] } },
    });
    await db.orderAttribution.deleteMany({ where: { id: ids.attribution } });
    await db.attributionTouch.deleteMany({ where: { id: { in: [ids.first, ids.later] } } });
    await db.acquisitionJourney.deleteMany({ where: { id: ids.journey } });
    await db.order.deleteMany({ where: { id: ids.order } });
    await db.customer.deleteMany({ where: { id: ids.customer } });
    await db.$disconnect();
  });

  it("aggregates bounded canonical events without future-touch leakage and uses immutable Purchase attribution", async () => {
    const report = await readAdminAnalytics(db, {
      from: new Date("2026-09-05T00:00:00.000Z"),
      to: new Date("2026-09-06T00:00:00.000Z"),
    });
    expect(report.events).toEqual({
      VIEW_CONTENT: { events: 1, uniqueJourneys: 1 },
      INITIATE_CHECKOUT: { events: 1, uniqueJourneys: 1 },
      PURCHASE: { events: 1, uniqueJourneys: 1 },
    });
    expect(report.revenue).toEqual({
      totalMinor: 2990,
      attributedMinor: 2990,
      unattributedMinor: 0,
      currency: "BRL",
    });
    expect(report.lastTouch).toContainEqual(
      expect.objectContaining({ source: "google", medium: "cpc", campaign: "first", events: 1 }),
    );
    expect(report.lastTouch).toContainEqual(
      expect.objectContaining({
        source: "affiliate",
        medium: "partner",
        campaign: "purchase-last",
        purchases: 1,
        revenueMinor: 2990,
      }),
    );
  });
});
