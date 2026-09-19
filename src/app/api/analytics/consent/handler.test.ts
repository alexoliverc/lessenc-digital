import { describe, expect, it, vi } from "vitest";

import type { AcquisitionJourneyRecord } from "../../../../modules/attribution/application/persistence";
import { createAnalyticsConsentHandler } from "./handler";

const APP_URL = "https://lessenc.example";
const JOURNEY_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-19T12:05:00.000Z");

function journey(overrides: Partial<AcquisitionJourneyRecord> = {}): AcquisitionJourneyRecord {
  return Object.freeze({
    id: JOURNEY_ID,
    createdAt: new Date("2026-09-19T12:00:00.000Z"),
    lastSeenAt: new Date("2026-09-19T12:00:00.000Z"),
    expiresAt: new Date("2026-10-19T12:00:00.000Z"),
    firstTouchId: null,
    lastTouchId: null,
    analyticsConsentState: "UNKNOWN",
    advertisingConsentState: "UNKNOWN",
    policyVersion: "p13-architecture-freeze-r2",
    ...overrides,
  });
}

function postRequest(body: unknown, origin: string | null = APP_URL): Request {
  const headers = new Headers({
    "content-type": "application/json",
  });

  if (origin !== null) {
    headers.set("origin", origin);
  }

  return new Request(`${APP_URL}/api/analytics/consent`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function dependencies(
  overrides: {
    journey?: AcquisitionJourneyRecord | null;
    result?: Readonly<{
      analytics: "GRANTED" | "DENIED";
      advertising: "GRANTED" | "DENIED";
      policyVersion: string;
    }> | null;
  } = {},
) {
  const findJourney = vi.fn(async () => overrides.journey ?? journey());
  const execute = vi.fn(async () =>
    overrides.result === undefined
      ? {
          analytics: "GRANTED" as const,
          advertising: "DENIED" as const,
          policyVersion: "p13-architecture-freeze-r2",
        }
      : overrides.result,
  );

  return {
    findJourney,
    execute,
    handler: createAnalyticsConsentHandler({
      journeys: {
        findJourney,
      },
      updateConsent: {
        execute,
      },
      appUrl: APP_URL,
      now: () => NOW,
    }),
  };
}

describe("P13-D analytics consent HTTP boundary", () => {
  it("returns UNKNOWN without exposing a missing Journey identifier", async () => {
    const { handler } = dependencies();
    const response = await handler.get(null);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({
      analytics: "UNKNOWN",
      advertising: "UNKNOWN",
      policyVersion: "p13-architecture-freeze-r2",
    });
  });

  it("reads the active Journey consent without returning its identifier", async () => {
    const { handler } = dependencies({
      journey: journey({
        analyticsConsentState: "GRANTED",
        advertisingConsentState: "DENIED",
      }),
    });
    const response = await handler.get(JOURNEY_ID);
    const body = await response.json();

    expect(body).toEqual({
      analytics: "GRANTED",
      advertising: "DENIED",
      policyVersion: "p13-architecture-freeze-r2",
    });
    expect(JSON.stringify(body)).not.toContain(JOURNEY_ID);
  });

  it("accepts an explicit same-origin selection and supports withdrawal", async () => {
    const { handler, execute } = dependencies({
      result: {
        analytics: "DENIED",
        advertising: "DENIED",
        policyVersion: "p13-architecture-freeze-r2",
      },
    });
    const response = await handler.post(
      postRequest({
        analytics: "DENIED",
        advertising: "DENIED",
      }),
      JOURNEY_ID,
    );

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith({
      journeyId: JOURNEY_ID,
      selection: {
        analytics: "DENIED",
        advertising: "DENIED",
      },
      observedAt: NOW,
    });
  });

  it.each([null, "https://evil.example", "not-a-valid-origin"])(
    "rejects a missing or foreign Origin: %s",
    async (origin) => {
      const { handler, execute } = dependencies();
      const response = await handler.post(
        postRequest(
          {
            analytics: "GRANTED",
            advertising: "DENIED",
          },
          origin,
        ),
        JOURNEY_ID,
      );

      expect(response.status).toBe(403);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      analytics: "UNKNOWN",
      advertising: "UNKNOWN",
    },
    {
      analytics: "DENIED",
      advertising: "GRANTED",
    },
    {
      analytics: "GRANTED",
      advertising: "DENIED",
      journeyId: JOURNEY_ID,
    },
    "{invalid-json",
  ])("rejects malformed or non-explicit consent: %#", async (body) => {
    const { handler, execute } = dependencies();
    const response = await handler.post(postRequest(body), JOURNEY_ID);

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("fails closed when there is no active Journey", async () => {
    const { handler, execute } = dependencies();
    const response = await handler.post(
      postRequest({
        analytics: "GRANTED",
        advertising: "DENIED",
      }),
      null,
    );

    expect(response.status).toBe(409);
    expect(execute).not.toHaveBeenCalled();
  });
});
