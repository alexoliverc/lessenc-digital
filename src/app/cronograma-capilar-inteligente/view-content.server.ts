import "server-only";

import { headers } from "next/headers";
import { after } from "next/server";

import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaAnalyticsEventRepository } from "@/infrastructure/database/prisma-analytics-event-repository";
import {
  projectBrowserMeasurement,
  type BrowserMeasurementBoundary,
} from "@/modules/analytics/application/browser-measurement";
import {
  normalizeMeasurementEventId,
  VIEW_CONTENT_EVENT_REQUEST_HEADER,
} from "@/modules/analytics/application/measurement-http-boundary";
import { ProduceInternalMeasurement } from "@/modules/analytics/application/internal-measurement";
import {
  ACQUISITION_OBSERVED_AT_REQUEST_HEADER,
  parseAcquisitionObservedAt,
} from "@/modules/attribution/application/acquisition-http-boundary";
import type { AcquisitionJourneyRecord } from "@/modules/attribution/application/persistence";

import type { PublicSalesMeasurementContext } from "./public-sales.server";

export type SchedulePublicSalesViewContentInput = Readonly<{
  journey: AcquisitionJourneyRecord | null;
  measurement: PublicSalesMeasurementContext;
}>;

export async function schedulePublicSalesViewContent(
  input: SchedulePublicSalesViewContentInput,
): Promise<BrowserMeasurementBoundary | null> {
  /*
   * Request APIs must be consumed during the Server
   * Component render lifecycle, before after() runs.
   */
  const requestHeaders = await headers();

  const eventId = normalizeMeasurementEventId(
    requestHeaders.get(VIEW_CONTENT_EVENT_REQUEST_HEADER),
  );

  const occurredAt = parseAcquisitionObservedAt(
    requestHeaders.get(ACQUISITION_OBSERVED_AT_REQUEST_HEADER),
  );

  /*
   * Requests that did not cross the canonical Proxy
   * boundary are not valid VIEW_CONTENT occurrences.
   */
  if (eventId === null || occurredAt === null) {
    return null;
  }

  const eventInput = Object.freeze({
    eventId,
    type: "VIEW_CONTENT" as const,
    occurredAt: new Date(occurredAt.getTime()),
    journey: input.journey,
    productId: input.measurement.productId,
    offerId: input.measurement.offerId,
    amountMinor: input.measurement.amountMinor,
    currency: input.measurement.currency,
  });

  /*
   * Canonical internal measurement is intentionally
   * post-response. Analytics must never become a
   * dependency of the public commercial response.
   */
  after(async () => {
    try {
      const database = getDatabaseClient();

      const producer = new ProduceInternalMeasurement(new PrismaAnalyticsEventRepository(database));

      await producer.execute(eventInput);
    } catch {
      /*
       * No raw request data, identifiers, URLs,
       * referrers or customer data are logged.
       */
      console.error("P13_VIEW_CONTENT_MEASUREMENT_FAILED");
    }
  });

  return projectBrowserMeasurement(eventInput);
}
