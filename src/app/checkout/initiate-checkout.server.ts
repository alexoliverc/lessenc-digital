import "server-only";

import { cookies, headers } from "next/headers";
import { after } from "next/server";

import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaAnalyticsEventRepository } from "@/infrastructure/database/prisma-analytics-event-repository";
import { PrismaAttributionJourneyRepository } from "@/infrastructure/database/prisma-attribution-journey-repository";
import {
  projectBrowserMeasurement,
  type BrowserMeasurementBoundary,
} from "@/modules/analytics/application/browser-measurement";
import { ProduceInternalMeasurement } from "@/modules/analytics/application/internal-measurement";
import {
  ACQUISITION_JOURNEY_COOKIE_NAME,
  isAcquisitionPrefetch,
  normalizeAcquisitionJourneyId,
} from "@/modules/attribution/application/acquisition-http-boundary";
import { isJourneyActive } from "@/modules/attribution/application/acquisition-policy";
import type { AcquisitionJourneyRecord } from "@/modules/attribution/application/persistence";
import { resolveRequestCorrelationId } from "@/lib/observability/correlation";
import { logger } from "@/lib/observability/logger";

import type { CheckoutInitiationMeasurementContext } from "./checkout.server";

async function resolveCheckoutJourney(
  journeyId: string | null,
  occurredAt: Date,
  correlationId: string,
): Promise<AcquisitionJourneyRecord | null> {
  if (journeyId === null) {
    return null;
  }

  try {
    const database = getDatabaseClient();

    const repository = new PrismaAttributionJourneyRepository(database);

    const journey = await repository.findJourney(journeyId);

    if (journey === null || !isJourneyActive(journey.expiresAt, occurredAt)) {
      return null;
    }

    return journey;
  } catch {
    /*
     * Journey lookup is telemetry enrichment only.
     * Checkout remains valid without attribution.
     */
    logger.error("initiate_checkout_journey_lookup_failed", {
      correlationId,
      surface: "CHECKOUT",
      outcome: "DEGRADED",
      failureCode: "JOURNEY_LOOKUP_FAILED",
    });

    return null;
  }
}

export async function scheduleCheckoutInitiation(
  measurement: CheckoutInitiationMeasurementContext,
): Promise<BrowserMeasurementBoundary | null> {
  /*
   * Request APIs must be read before after() executes.
   */
  const [requestHeaders, requestCookies] = await Promise.all([headers(), cookies()]);
  const correlationId = resolveRequestCorrelationId(requestHeaders);

  /*
   * Navigation prefetch does not represent a human
   * beginning a valid checkout journey.
   */
  if (isAcquisitionPrefetch(requestHeaders)) {
    return null;
  }

  const journeyId = normalizeAcquisitionJourneyId(
    requestCookies.get(ACQUISITION_JOURNEY_COOKIE_NAME)?.value,
  );

  const eventInput = Object.freeze({
    eventId: measurement.eventId,
    type: "INITIATE_CHECKOUT" as const,
    occurredAt: new Date(measurement.occurredAt.getTime()),
    productId: measurement.productId,
    offerId: measurement.offerId,
    amountMinor: measurement.amountMinor,
    currency: measurement.currency,
  });

  const journey = await resolveCheckoutJourney(journeyId, eventInput.occurredAt, correlationId);

  /*
   * Analytics persistence is post-response and cannot
   * become a dependency of Commerce or token issuance.
   */
  after(async () => {
    try {
      const database = getDatabaseClient();

      const producer = new ProduceInternalMeasurement(new PrismaAnalyticsEventRepository(database));

      await producer.execute({
        ...eventInput,
        journey,
      });
    } catch {
      /*
       * No token, cookie value, customer data or
       * commercial identifier is logged.
       */
      logger.error("initiate_checkout_measurement_failed", {
        correlationId,
        surface: "CHECKOUT",
        outcome: "DEGRADED",
        failureCode: "MEASUREMENT_FAILED",
      });
    }
  });

  return projectBrowserMeasurement({
    ...eventInput,
    journey,
  });
}
