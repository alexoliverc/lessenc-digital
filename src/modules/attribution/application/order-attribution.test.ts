import { describe, expect, it } from "vitest";

import { ATTRIBUTION_LOOKBACK_DAYS } from "./acquisition-policy";
import { buildOrderAttributionSnapshot } from "./order-attribution";
import type { AcquisitionJourneyRecord, AttributionTouchRecord } from "./persistence";

const DAY_MS = 24 * 60 * 60 * 1000;

const capturedAt = new Date("2026-09-17T12:00:00.000Z");

function journey(overrides: Partial<AcquisitionJourneyRecord> = {}): AcquisitionJourneyRecord {
  return Object.freeze({
    id: "journey-a",
    createdAt: new Date(capturedAt.getTime() - DAY_MS),
    lastSeenAt: new Date(capturedAt.getTime() - 1_000),
    expiresAt: new Date(capturedAt.getTime() + DAY_MS),
    firstTouchId: "touch-first",
    lastTouchId: "touch-last",
    analyticsConsentState: "UNKNOWN",
    advertisingConsentState: "UNKNOWN",
    policyVersion: "p13-architecture-freeze-r2",
    ...overrides,
  });
}

function touch(overrides: Partial<AttributionTouchRecord> = {}): AttributionTouchRecord {
  return Object.freeze({
    id: "touch-first",
    journeyId: "journey-a",
    occurredAt: new Date(capturedAt.getTime() - DAY_MS),
    source: "google",
    medium: "cpc",
    campaign: "launch",
    content: "hero",
    term: "cronograma",
    referrerHost: null,
    landingPath: "/cronograma-capilar-inteligente",
    touchType: "CAMPAIGN",
    ...overrides,
  });
}

function build(overrides: Partial<Parameters<typeof buildOrderAttributionSnapshot>[0]> = {}) {
  return buildOrderAttributionSnapshot({
    id: "snapshot-a",
    orderId: "order-a",
    journeyId: "journey-a",
    capturedAt,
    journey: journey(),
    firstTouch: touch(),
    lastTouch: touch({
      id: "touch-last",
      occurredAt: new Date(capturedAt.getTime() - 1_000),
      source: "referral.example",
      medium: "referral",
      campaign: null,
      content: null,
      term: null,
      referrerHost: "referral.example",
      touchType: "REFERRAL",
    }),
    ...overrides,
  });
}

describe("P13-C OrderAttribution snapshot policy", () => {
  it("copies immutable First and Last attribution into the Order snapshot", () => {
    expect(build()).toEqual({
      id: "snapshot-a",
      orderId: "order-a",
      journeyId: "journey-a",

      firstTouchId: "touch-first",
      lastTouchId: "touch-last",

      firstSource: "google",
      firstMedium: "cpc",
      firstCampaign: "launch",
      firstContent: "hero",
      firstTerm: "cronograma",

      lastSource: "referral.example",
      lastMedium: "referral",
      lastCampaign: null,
      lastContent: null,
      lastTerm: null,

      capturedAt,
    });
  });

  it("creates an explicit unattributed snapshot when no Journey is supplied", () => {
    expect(
      build({
        journeyId: null,
        journey: null,
        firstTouch: null,
        lastTouch: null,
      }),
    ).toEqual({
      id: "snapshot-a",
      orderId: "order-a",
      journeyId: null,
      firstTouchId: null,
      lastTouchId: null,
      firstSource: null,
      firstMedium: null,
      firstCampaign: null,
      firstContent: null,
      firstTerm: null,
      lastSource: null,
      lastMedium: null,
      lastCampaign: null,
      lastContent: null,
      lastTerm: null,
      capturedAt,
    });
  });

  it("keeps active Journey context while remaining unattributed when no eligible external touch exists", () => {
    const direct = touch({
      id: "touch-direct",
      touchType: "DIRECT",
      source: null,
      medium: null,
      campaign: null,
      content: null,
      term: null,
    });

    expect(
      build({
        firstTouch: direct,
        lastTouch: direct,
      }),
    ).toMatchObject({
      journeyId: "journey-a",
      firstTouchId: null,
      lastTouchId: null,
      firstSource: null,
      lastSource: null,
    });
  });

  it("does not attribute an expired Journey", () => {
    const expired = journey({
      expiresAt: new Date(capturedAt),
    });

    expect(
      build({
        journey: expired,
      }),
    ).toMatchObject({
      journeyId: null,
      firstTouchId: null,
      lastTouchId: null,
      firstSource: null,
      lastSource: null,
    });
  });

  it("includes an eligible touch exactly on the 30-day lookback boundary", () => {
    const boundary = touch({
      occurredAt: new Date(capturedAt.getTime() - ATTRIBUTION_LOOKBACK_DAYS * DAY_MS),
    });

    expect(
      build({
        firstTouch: boundary,
      }).firstTouchId,
    ).toBe("touch-first");
  });

  it("excludes a touch older than the approved 30-day lookback", () => {
    const tooOld = touch({
      occurredAt: new Date(capturedAt.getTime() - ATTRIBUTION_LOOKBACK_DAYS * DAY_MS - 1),
    });

    expect(
      build({
        firstTouch: tooOld,
      }),
    ).toMatchObject({
      firstTouchId: null,
      firstSource: null,
      firstMedium: null,
      firstCampaign: null,
    });
  });

  it("rejects a touch belonging to another Journey", () => {
    const foreign = touch({
      journeyId: "journey-other",
    });

    expect(
      build({
        firstTouch: foreign,
        lastTouch: foreign,
      }),
    ).toMatchObject({
      journeyId: "journey-a",
      firstTouchId: null,
      lastTouchId: null,
    });
  });

  it("never fabricates unknown attribution values", () => {
    const snapshot = build({
      journeyId: null,
      journey: null,
      firstTouch: null,
      lastTouch: null,
    });

    expect(JSON.stringify(snapshot).toLowerCase()).not.toContain("unknown");

    expect(snapshot.id).toBe("snapshot-a");

    expect(snapshot.orderId).toBe("order-a");

    expect(snapshot.capturedAt).toBe(capturedAt);
  });
});
