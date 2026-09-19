import type { AnalyticsEventType } from "@/modules/attribution/application/persistence";

export type AnalyticsWindow = Readonly<{ from: Date; to: Date }>;

export type AdminAnalyticsEvent = Readonly<{
  id: string;
  type: AnalyticsEventType;
  occurredAt: Date;
  journeyId: string | null;
  orderId: string | null;
  amountMinor: number | null;
  currency: string | null;
  attributionState: string;
}>;

export type AnalyticsDimension = Readonly<{
  source: string | null;
  medium: string | null;
  campaign: string | null;
}>;

export type AdminAnalyticsEventDimension = Readonly<{
  eventId: string;
  firstTouch: AnalyticsDimension | null;
  lastTouch: AnalyticsDimension | null;
}>;

export type AnalyticsMetric = Readonly<{ events: number; uniqueJourneys: number }>;
export type AnalyticsRevenue = Readonly<{
  totalMinor: number;
  attributedMinor: number;
  unattributedMinor: number;
  currency: "BRL";
}>;
export type AnalyticsDimensionRow = Readonly<
  AnalyticsDimension & {
    events: number;
    uniqueJourneys: number;
    purchases: number;
    revenueMinor: number;
  }
>;

export type AdminAnalyticsReport = Readonly<{
  window: AnalyticsWindow;
  events: Readonly<Record<AnalyticsEventType, AnalyticsMetric>>;
  uniqueJourneys: number;
  conversions: Readonly<{
    viewToCheckout: number;
    checkoutToPurchase: number;
    viewToPurchase: number;
  }>;
  revenue: AnalyticsRevenue;
  firstTouch: readonly AnalyticsDimensionRow[];
  lastTouch: readonly AnalyticsDimensionRow[];
}>;

const DAY_MS = 24 * 60 * 60 * 1_000;
const EVENT_TYPES = ["VIEW_CONTENT", "INITIATE_CHECKOUT", "PURCHASE"] as const;

function utcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function parseDay(value: string | undefined): Date | null {
  if (value === undefined || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
}

/** Window is [from, to): dates are UTC calendar dates and the end date is inclusive in the UI. */
export function parseAnalyticsWindow(
  input: Record<string, string | string[] | undefined>,
  now = new Date(),
): AnalyticsWindow {
  const rawFrom = Array.isArray(input.from) ? input.from[0] : input.from;
  const rawTo = Array.isArray(input.to) ? input.to[0] : input.to;
  const today = utcDay(now);
  const defaultFrom = new Date(today.getTime() - 29 * DAY_MS);
  const defaultTo = new Date(today.getTime() + DAY_MS);
  const from = parseDay(rawFrom) ?? defaultFrom;
  const selectedTo = parseDay(rawTo);
  const to = selectedTo === null ? defaultTo : new Date(selectedTo.getTime() + DAY_MS);
  const maxTo = new Date(from.getTime() + 90 * DAY_MS);

  if (to <= from || to > maxTo || to > new Date(today.getTime() + DAY_MS)) {
    return Object.freeze({ from: defaultFrom, to: defaultTo });
  }

  return Object.freeze({ from, to });
}

function metric(events: readonly AdminAnalyticsEvent[]): AnalyticsMetric {
  return Object.freeze({
    events: events.length,
    uniqueJourneys: new Set(
      events.flatMap((event) => (event.journeyId === null ? [] : [event.journeyId])),
    ).size,
  });
}

function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2));
}

function dimensions(
  events: readonly AdminAnalyticsEvent[],
  resolved: readonly AdminAnalyticsEventDimension[],
  kind: "firstTouch" | "lastTouch",
): readonly AnalyticsDimensionRow[] {
  const byEvent = new Map(resolved.map((item) => [item.eventId, item]));
  const grouped = new Map<
    string,
    {
      dimension: AnalyticsDimension;
      events: number;
      journeys: Set<string>;
      purchases: number;
      revenueMinor: number;
    }
  >();

  for (const event of events) {
    const dimension = byEvent.get(event.id)?.[kind] ?? null;
    const canonical = dimension ?? { source: null, medium: null, campaign: null };
    const key = JSON.stringify([canonical.source, canonical.medium, canonical.campaign]);
    const current = grouped.get(key) ?? {
      dimension: canonical,
      events: 0,
      journeys: new Set<string>(),
      purchases: 0,
      revenueMinor: 0,
    };
    current.events += 1;
    if (event.journeyId !== null) current.journeys.add(event.journeyId);
    if (event.type === "PURCHASE") {
      current.purchases += 1;
      current.revenueMinor += event.amountMinor ?? 0;
    }
    grouped.set(key, current);
  }

  return Object.freeze(
    [...grouped.values()]
      .map(({ dimension, events: count, journeys, purchases, revenueMinor }) =>
        Object.freeze({
          ...dimension,
          events: count,
          uniqueJourneys: journeys.size,
          purchases,
          revenueMinor,
        }),
      )
      .sort((left, right) => right.events - left.events || right.revenueMinor - left.revenueMinor),
  );
}

export function buildAdminAnalyticsReport(
  input: Readonly<{
    window: AnalyticsWindow;
    events: readonly AdminAnalyticsEvent[];
    dimensions: readonly AdminAnalyticsEventDimension[];
  }>,
): AdminAnalyticsReport {
  const eventsByType = Object.fromEntries(
    EVENT_TYPES.map((type) => [type, input.events.filter((event) => event.type === type)]),
  ) as Record<AnalyticsEventType, AdminAnalyticsEvent[]>;
  const views = metric(eventsByType.VIEW_CONTENT);
  const checkouts = metric(eventsByType.INITIATE_CHECKOUT);
  const purchases = metric(eventsByType.PURCHASE);
  const purchaseEvents = eventsByType.PURCHASE;
  const revenue = purchaseEvents.reduce(
    (totals, event) => {
      const value = event.amountMinor ?? 0;
      totals.totalMinor += value;
      if (event.attributionState === "ATTRIBUTED") totals.attributedMinor += value;
      if (event.attributionState === "UNATTRIBUTED") totals.unattributedMinor += value;
      return totals;
    },
    { totalMinor: 0, attributedMinor: 0, unattributedMinor: 0 },
  );

  return Object.freeze({
    window: input.window,
    events: Object.freeze({
      VIEW_CONTENT: views,
      INITIATE_CHECKOUT: checkouts,
      PURCHASE: purchases,
    }),
    uniqueJourneys: new Set(
      input.events.flatMap((event) => (event.journeyId === null ? [] : [event.journeyId])),
    ).size,
    conversions: Object.freeze({
      viewToCheckout: safeRate(checkouts.uniqueJourneys, views.uniqueJourneys),
      checkoutToPurchase: safeRate(purchases.uniqueJourneys, checkouts.uniqueJourneys),
      viewToPurchase: safeRate(purchases.uniqueJourneys, views.uniqueJourneys),
    }),
    revenue: Object.freeze({ ...revenue, currency: "BRL" }),
    firstTouch: dimensions(input.events, input.dimensions, "firstTouch"),
    lastTouch: dimensions(input.events, input.dimensions, "lastTouch"),
  });
}
