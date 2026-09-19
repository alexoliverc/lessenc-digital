import type { PrismaClient } from "@/generated/prisma/client";
import {
  buildAdminAnalyticsReport,
  type AdminAnalyticsEventDimension,
  type AnalyticsDimension,
  type AnalyticsWindow,
} from "./admin-analytics";

function dimension(
  touch: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
  } | null,
): AnalyticsDimension | null {
  return touch === null
    ? null
    : Object.freeze({ source: touch.source, medium: touch.medium, campaign: touch.campaign });
}

export async function readAdminAnalytics(database: PrismaClient, window: AnalyticsWindow) {
  const events = await database.analyticsEvent.findMany({
    where: { occurredAt: { gte: window.from, lt: window.to } },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      type: true,
      occurredAt: true,
      journeyId: true,
      orderId: true,
      amountMinor: true,
      currency: true,
      attributionState: true,
    },
  });
  const journeyIds = [
    ...new Set(events.flatMap((event) => (event.journeyId === null ? [] : [event.journeyId]))),
  ];
  const orderIds = [
    ...new Set(
      events.flatMap((event) =>
        event.type === "PURCHASE" && event.orderId !== null ? [event.orderId] : [],
      ),
    ),
  ];
  const [journeys, orderAttributions] = await Promise.all([
    journeyIds.length === 0
      ? Promise.resolve([])
      : database.acquisitionJourney.findMany({
          where: { id: { in: journeyIds } },
          select: {
            id: true,
            firstTouchId: true,
            touches: {
              orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
              select: { id: true, occurredAt: true, source: true, medium: true, campaign: true },
            },
          },
        }),
    orderIds.length === 0
      ? Promise.resolve([])
      : database.orderAttribution.findMany({
          where: { orderId: { in: orderIds } },
          select: {
            orderId: true,
            firstSource: true,
            firstMedium: true,
            firstCampaign: true,
            lastSource: true,
            lastMedium: true,
            lastCampaign: true,
          },
        }),
  ]);
  const byJourney = new Map(journeys.map((journey) => [journey.id, journey]));
  const byOrder = new Map(
    orderAttributions.map((attribution) => [attribution.orderId, attribution]),
  );
  const resolved: AdminAnalyticsEventDimension[] = events.map((event) => {
    if (event.type === "PURCHASE") {
      const purchase = event.orderId === null ? undefined : byOrder.get(event.orderId);
      return Object.freeze({
        eventId: event.id,
        firstTouch:
          purchase === undefined
            ? null
            : Object.freeze({
                source: purchase.firstSource,
                medium: purchase.firstMedium,
                campaign: purchase.firstCampaign,
              }),
        lastTouch:
          purchase === undefined
            ? null
            : Object.freeze({
                source: purchase.lastSource,
                medium: purchase.lastMedium,
                campaign: purchase.lastCampaign,
              }),
      });
    }
    const journey = event.journeyId === null ? undefined : byJourney.get(event.journeyId);
    const first = journey?.touches.find((touch) => touch.id === journey.firstTouchId) ?? null;
    const last =
      [...(journey?.touches ?? [])]
        .reverse()
        .find((touch) => touch.occurredAt <= event.occurredAt) ?? null;
    return Object.freeze({
      eventId: event.id,
      firstTouch: dimension(first),
      lastTouch: dimension(last),
    });
  });
  return buildAdminAnalyticsReport({ window, events, dimensions: resolved });
}
