import { cookies } from "next/headers";

import { getDatabaseClient } from "../../../../infrastructure/database/client";
import { PrismaAttributionJourneyRepository } from "../../../../infrastructure/database/prisma-attribution-journey-repository";
import { serverEnv } from "../../../../lib/config/env";
import { UpdateAnalyticsConsent } from "../../../../modules/analytics/application/consent";
import {
  ACQUISITION_JOURNEY_COOKIE_NAME,
  normalizeAcquisitionJourneyId,
} from "../../../../modules/attribution/application/acquisition-http-boundary";
import { createAnalyticsConsentHandler } from "./handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dependencies() {
  const database = getDatabaseClient();
  const journeys = new PrismaAttributionJourneyRepository(database);
  const cookieStore = await cookies();
  const journeyId = normalizeAcquisitionJourneyId(
    cookieStore.get(ACQUISITION_JOURNEY_COOKIE_NAME)?.value,
  );

  return {
    handler: createAnalyticsConsentHandler({
      journeys,
      updateConsent: new UpdateAnalyticsConsent(journeys),
      appUrl: serverEnv.APP_URL,
    }),
    journeyId,
  };
}

export async function GET() {
  const resolved = await dependencies();

  return resolved.handler.get(resolved.journeyId);
}

export async function POST(request: Request) {
  const resolved = await dependencies();

  return resolved.handler.post(request, resolved.journeyId);
}
