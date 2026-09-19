import "server-only";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";

import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaAttributionJourneyRepository } from "@/infrastructure/database/prisma-attribution-journey-repository";
import { serverEnv } from "@/lib/config/env";
import {
  ACQUISITION_JOURNEY_REQUEST_HEADER,
  ACQUISITION_OBSERVED_AT_REQUEST_HEADER,
  PUBLIC_SALES_ACQUISITION_PATH,
  type PublicAcquisitionSearchParams,
  normalizeAcquisitionJourneyId,
  parseAcquisitionObservedAt,
  toCanonicalUtmSearchParams,
} from "@/modules/attribution/application/acquisition-http-boundary";
import { CaptureAcquisitionJourney } from "@/modules/attribution/application/acquisition-journey";

export async function capturePublicSalesAcquisition(
  searchParams: PublicAcquisitionSearchParams,
): Promise<void> {
  const requestHeaders = await headers();

  const journeyId = normalizeAcquisitionJourneyId(
    requestHeaders.get(ACQUISITION_JOURNEY_REQUEST_HEADER),
  );

  const observedAt = parseAcquisitionObservedAt(
    requestHeaders.get(ACQUISITION_OBSERVED_AT_REQUEST_HEADER),
  );

  /*
   * Prefetches and requests outside the P13-C Proxy
   * deliberately carry no acquisition boundary headers.
   */
  if (journeyId === null || observedAt === null) {
    return;
  }

  try {
    const database = getDatabaseClient();

    const capture = new CaptureAcquisitionJourney(
      new PrismaAttributionJourneyRepository(database),
      randomUUID,
    );

    await capture.execute({
      journeyId,
      occurredAt: observedAt,
      searchParams: toCanonicalUtmSearchParams(searchParams),
      landingUrl: PUBLIC_SALES_ACQUISITION_PATH,
      referrer: requestHeaders.get("referer"),
      canonicalAppUrl: serverEnv.APP_URL,
    });
  } catch {
    /*
     * Attribution is operational telemetry and must never
     * make the public commercial experience unavailable.
     * No raw URL, referrer or customer data is logged.
     */
    console.error("P13_PUBLIC_SALES_ACQUISITION_CAPTURE_FAILED");
  }
}
