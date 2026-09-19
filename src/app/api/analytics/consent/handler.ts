import { NextResponse } from "next/server";

import { isJourneyActive } from "../../../../modules/attribution/application/acquisition-policy";
import type {
  AcquisitionJourneyRecord,
  AttributionJourneyRepository,
} from "../../../../modules/attribution/application/persistence";
import {
  projectAnalyticsConsent,
  type AnalyticsConsentSelection,
  type UpdateAnalyticsConsent,
} from "../../../../modules/analytics/application/consent";

const MAX_CONSENT_BODY_BYTES = 256;

const NO_STORE_HEADERS = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
});

type ConsentHandlerDependencies = Readonly<{
  journeys: Pick<AttributionJourneyRepository, "findJourney">;
  updateConsent: Pick<UpdateAnalyticsConsent, "execute">;
  appUrl: string;
  now?: () => Date;
}>;

function hasExpectedOrigin(request: Request, appUrl: string): boolean {
  const rawOrigin = request.headers.get("origin");

  if (!rawOrigin) {
    return false;
  }

  try {
    return new URL(rawOrigin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

function parseState(value: unknown): "GRANTED" | "DENIED" | null {
  return value === "GRANTED" || value === "DENIED" ? value : null;
}

async function readSelection(request: Request): Promise<AnalyticsConsentSelection | null> {
  const contentType = request.headers.get("content-type");

  if (!contentType?.toLowerCase().startsWith("application/json")) {
    return null;
  }

  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    const parsedLength = Number(contentLength);

    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > MAX_CONSENT_BODY_BYTES
    ) {
      return null;
    }
  }

  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return null;
  }

  if (Buffer.byteLength(rawBody, "utf8") > MAX_CONSENT_BODY_BYTES) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;

  if (Object.keys(record).sort().join(",") !== "advertising,analytics") {
    return null;
  }

  const analytics = parseState(record.analytics);
  const advertising = parseState(record.advertising);

  if (
    analytics === null ||
    advertising === null ||
    (analytics === "DENIED" && advertising === "GRANTED")
  ) {
    return null;
  }

  return Object.freeze({
    analytics,
    advertising,
  });
}

function unknownResponse() {
  return NextResponse.json(projectAnalyticsConsent(null), {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}

export function createAnalyticsConsentHandler(dependencies: ConsentHandlerDependencies) {
  const now = dependencies.now ?? (() => new Date());

  async function findActiveJourney(
    journeyId: string | null,
  ): Promise<AcquisitionJourneyRecord | null> {
    if (journeyId === null) {
      return null;
    }

    const journey = await dependencies.journeys.findJourney(journeyId);

    return journey !== null && isJourneyActive(journey.expiresAt, now()) ? journey : null;
  }

  return Object.freeze({
    async get(journeyId: string | null): Promise<NextResponse> {
      try {
        const journey = await findActiveJourney(journeyId);

        return journey === null
          ? unknownResponse()
          : NextResponse.json(projectAnalyticsConsent(journey), {
              status: 200,
              headers: NO_STORE_HEADERS,
            });
      } catch {
        return unknownResponse();
      }
    },

    async post(request: Request, journeyId: string | null): Promise<NextResponse> {
      if (!hasExpectedOrigin(request, dependencies.appUrl)) {
        return NextResponse.json(
          {
            error: "REQUEST_INVALID",
          },
          {
            status: 403,
            headers: NO_STORE_HEADERS,
          },
        );
      }

      const selection = await readSelection(request);

      if (selection === null) {
        return NextResponse.json(
          {
            error: "REQUEST_INVALID",
          },
          {
            status: 400,
            headers: NO_STORE_HEADERS,
          },
        );
      }

      if (journeyId === null) {
        return NextResponse.json(
          {
            error: "CONSENT_UNAVAILABLE",
          },
          {
            status: 409,
            headers: NO_STORE_HEADERS,
          },
        );
      }

      try {
        const result = await dependencies.updateConsent.execute({
          journeyId,
          selection,
          observedAt: now(),
        });

        if (result === null) {
          return NextResponse.json(
            {
              error: "CONSENT_UNAVAILABLE",
            },
            {
              status: 409,
              headers: NO_STORE_HEADERS,
            },
          );
        }

        return NextResponse.json(result, {
          status: 200,
          headers: NO_STORE_HEADERS,
        });
      } catch {
        return NextResponse.json(
          {
            error: "SERVICE_UNAVAILABLE",
          },
          {
            status: 503,
            headers: NO_STORE_HEADERS,
          },
        );
      }
    },
  });
}
