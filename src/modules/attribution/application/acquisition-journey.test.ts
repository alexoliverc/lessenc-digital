import { describe, expect, it } from "vitest";

import { nextFirstTouchId, nextLastTouchId } from "./acquisition-policy";
import { CaptureAcquisitionJourney, P13_ATTRIBUTION_POLICY_VERSION } from "./acquisition-journey";
import type {
  AcquisitionJourneyRecord,
  AttributionJourneyCaptureRepository,
  AttributionTouchRecord,
  CreateAcquisitionJourney,
  CreateAttributionTouch,
  RecordAttributionObservation,
  RecordAttributionObservationResult,
} from "./persistence";

const DAY_MS = 24 * 60 * 60 * 1000;

class MemoryJourneyRepository implements AttributionJourneyCaptureRepository {
  readonly journeys = new Map<string, AcquisitionJourneyRecord>();

  readonly touches = new Map<string, AttributionTouchRecord>();

  async createJourney(input: CreateAcquisitionJourney): Promise<AcquisitionJourneyRecord> {
    const existing = this.journeys.get(input.id);

    if (existing) {
      return existing;
    }

    const createdAt = new Date(input.expiresAt.getTime() - 30 * DAY_MS);

    const journey = Object.freeze({
      id: input.id,
      createdAt,
      lastSeenAt: createdAt,
      expiresAt: input.expiresAt,
      firstTouchId: null,
      lastTouchId: null,
      analyticsConsentState: input.analyticsConsentState,
      advertisingConsentState: input.advertisingConsentState,
      policyVersion: input.policyVersion,
    });

    this.journeys.set(journey.id, journey);

    return journey;
  }

  async findJourney(journeyId: string): Promise<AcquisitionJourneyRecord | null> {
    return this.journeys.get(journeyId) ?? null;
  }

  async createTouch(input: CreateAttributionTouch): Promise<AttributionTouchRecord> {
    const touch = Object.freeze({ ...input });

    this.touches.set(touch.id, touch);

    return touch;
  }

  async recordObservation(
    input: RecordAttributionObservation,
  ): Promise<RecordAttributionObservationResult> {
    const current = this.journeys.get(input.journeyId);

    if (!current) {
      throw new Error("journey missing");
    }

    if (input.touch !== null && input.touch.journeyId !== input.journeyId) {
      throw new Error("touch journey mismatch");
    }

    if (input.externallyAttributable && input.touch === null) {
      throw new Error("external acquisition requires touch");
    }

    const touch = input.touch === null ? null : await this.createTouch(input.touch);

    const firstTouchId =
      touch === null
        ? current.firstTouchId
        : nextFirstTouchId(current.firstTouchId, touch.id, input.externallyAttributable);

    let lastTouchId = current.lastTouchId;

    if (touch !== null && input.externallyAttributable) {
      const currentLast =
        current.lastTouchId === null ? null : (this.touches.get(current.lastTouchId) ?? null);

      if (currentLast === null || currentLast.occurredAt.getTime() <= touch.occurredAt.getTime()) {
        lastTouchId = nextLastTouchId(current.lastTouchId, touch.id, true);
      }
    }

    const updated = Object.freeze({
      ...current,
      lastSeenAt:
        current.lastSeenAt.getTime() >= input.seenAt.getTime() ? current.lastSeenAt : input.seenAt,
      firstTouchId,
      lastTouchId,
    });

    this.journeys.set(updated.id, updated);

    return Object.freeze({
      journey: updated,
      touch,
    });
  }
}

function sequenceFactory(...values: string[]) {
  let index = 0;

  return () => {
    const value = values[index];

    if (!value) {
      throw new Error("ID sequence exhausted");
    }

    index += 1;

    return value;
  };
}

function activeJourney(id: string, now: Date): AcquisitionJourneyRecord {
  return Object.freeze({
    id,
    createdAt: new Date(now.getTime() - DAY_MS),
    lastSeenAt: new Date(now.getTime() - DAY_MS),
    expiresAt: new Date(now.getTime() + DAY_MS),
    firstTouchId: null,
    lastTouchId: null,
    analyticsConsentState: "UNKNOWN",
    advertisingConsentState: "UNKNOWN",
    policyVersion: P13_ATTRIBUTION_POLICY_VERSION,
  });
}

function input(
  now: Date,
  overrides: Partial<{
    journeyId: string | null;
    searchParams: URLSearchParams;
    landingUrl: string | null;
    referrer: string | null;
    canonicalAppUrl: string;
  }> = {},
) {
  return {
    journeyId: overrides.journeyId ?? null,
    occurredAt: now,
    searchParams: overrides.searchParams ?? new URLSearchParams(),
    landingUrl: overrides.landingUrl ?? "https://lessenc.example/cronograma-capilar-inteligente",
    referrer: overrides.referrer ?? null,
    canonicalAppUrl: overrides.canonicalAppUrl ?? "https://lessenc.example",
  };
}

describe("P13-C CaptureAcquisitionJourney", () => {
  const now = new Date("2026-09-17T02:00:00.000Z");

  it("creates a new first-party DIRECT journey without fabricating attribution pointers", async () => {
    const repository = new MemoryJourneyRepository();

    const useCase = new CaptureAcquisitionJourney(
      repository,
      sequenceFactory("journey-new", "touch-direct"),
    );

    const result = await useCase.execute(input(now));

    expect(result.journeyCreated).toBe(true);
    expect(result.journey.id).toBe("journey-new");
    expect(result.touch?.touchType).toBe("DIRECT");
    expect(result.journey.firstTouchId).toBeNull();
    expect(result.journey.lastTouchId).toBeNull();
    expect(repository.touches.size).toBe(1);
  });

  it("reuses a supplied first-party journey ID when persistence does not exist yet", async () => {
    const repository = new MemoryJourneyRepository();

    const useCase = new CaptureAcquisitionJourney(repository, sequenceFactory("touch-direct"));

    const result = await useCase.execute(
      input(now, {
        journeyId: "browser-journey",
      }),
    );

    expect(result.journeyCreated).toBe(true);
    expect(result.journey.id).toBe("browser-journey");
    expect(result.touch?.journeyId).toBe("browser-journey");
  });

  it("recovers an active journey", async () => {
    const repository = new MemoryJourneyRepository();

    repository.journeys.set("journey-active", activeJourney("journey-active", now));

    const useCase = new CaptureAcquisitionJourney(repository, sequenceFactory("touch-campaign"));

    const result = await useCase.execute(
      input(now, {
        journeyId: "journey-active",
        searchParams: new URLSearchParams({
          utm_source: "google",
          utm_medium: "cpc",
        }),
      }),
    );

    expect(result.journeyCreated).toBe(false);
    expect(result.journey.id).toBe("journey-active");
  });

  it("replaces an expired journey with a distinct identifier", async () => {
    const repository = new MemoryJourneyRepository();

    const expired = Object.freeze({
      ...activeJourney("journey-expired", now),
      expiresAt: new Date(now),
    });

    repository.journeys.set(expired.id, expired);

    const useCase = new CaptureAcquisitionJourney(
      repository,
      sequenceFactory("journey-replacement", "touch-direct"),
    );

    const result = await useCase.execute(
      input(now, {
        journeyId: expired.id,
      }),
    );

    expect(result.journeyCreated).toBe(true);
    expect(result.journey.id).toBe("journey-replacement");
    expect(repository.journeys.get("journey-expired")).toBe(expired);
  });

  it("creates a CAMPAIGN touch from canonical UTM context", async () => {
    const repository = new MemoryJourneyRepository();

    const useCase = new CaptureAcquisitionJourney(
      repository,
      sequenceFactory("journey-a", "touch-a"),
    );

    const result = await useCase.execute(
      input(now, {
        searchParams: new URLSearchParams({
          utm_source: "google",
          utm_medium: "cpc",
          utm_campaign: "launch",
          gclid: "must-not-be-persisted",
        }),
      }),
    );

    expect(result.touch).toMatchObject({
      touchType: "CAMPAIGN",
      source: "google",
      medium: "cpc",
      campaign: "launch",
    });

    expect(JSON.stringify(result.touch)).not.toContain("gclid");
  });

  it("creates a provider-neutral REFERRAL touch from an external host", async () => {
    const repository = new MemoryJourneyRepository();

    const useCase = new CaptureAcquisitionJourney(
      repository,
      sequenceFactory("journey-a", "touch-referral"),
    );

    const result = await useCase.execute(
      input(now, {
        referrer: "https://example.org/article?secret=do-not-store",
      }),
    );

    expect(result.touch).toMatchObject({
      touchType: "REFERRAL",
      source: "example.org",
      medium: "referral",
      referrerHost: "example.org",
    });

    expect(JSON.stringify(result.touch)).not.toContain("secret");
  });

  it("establishes First Touch once and advances Last Touch", async () => {
    const repository = new MemoryJourneyRepository();

    const first = new CaptureAcquisitionJourney(
      repository,
      sequenceFactory("journey-a", "touch-first"),
    );

    const firstResult = await first.execute(
      input(now, {
        searchParams: new URLSearchParams({
          utm_source: "google",
        }),
      }),
    );

    const second = new CaptureAcquisitionJourney(repository, sequenceFactory("touch-second"));

    const secondResult = await second.execute(
      input(new Date(now.getTime() + 1000), {
        journeyId: firstResult.journey.id,
        referrer: "https://example.org/referral",
      }),
    );

    expect(secondResult.journey.firstTouchId).toBe("touch-first");

    expect(secondResult.journey.lastTouchId).toBe("touch-second");
  });

  it("subsequent DIRECT traffic refreshes the Journey without creating another touch", async () => {
    const repository = new MemoryJourneyRepository();

    const external = new CaptureAcquisitionJourney(
      repository,
      sequenceFactory("journey-a", "touch-external"),
    );

    const attributed = await external.execute(
      input(now, {
        searchParams: new URLSearchParams({
          utm_source: "google",
        }),
      }),
    );

    const touchCountBefore = repository.touches.size;

    const direct = new CaptureAcquisitionJourney(repository, sequenceFactory());

    const later = new Date(now.getTime() + 1000);

    const result = await direct.execute(
      input(later, {
        journeyId: attributed.journey.id,
      }),
    );

    expect(result.touch).toBeNull();

    expect(result.journey.firstTouchId).toBe("touch-external");

    expect(result.journey.lastTouchId).toBe("touch-external");

    expect(result.journey.lastSeenAt).toEqual(later);

    expect(repository.touches.size).toBe(touchCountBefore);
  });

  it("same-origin navigation is treated like subsequent DIRECT traffic", async () => {
    const repository = new MemoryJourneyRepository();

    repository.journeys.set("journey-active", activeJourney("journey-active", now));

    const useCase = new CaptureAcquisitionJourney(repository, sequenceFactory());

    const result = await useCase.execute(
      input(now, {
        journeyId: "journey-active",
        referrer: "https://lessenc.example/other-page",
      }),
    );

    expect(result.touch).toBeNull();
    expect(repository.touches.size).toBe(0);
  });

  it("does not move Last Touch backwards for an older external observation", async () => {
    const repository = new MemoryJourneyRepository();

    const first = new CaptureAcquisitionJourney(
      repository,
      sequenceFactory("journey-a", "touch-newer"),
    );

    const newer = await first.execute(
      input(now, {
        searchParams: new URLSearchParams({
          utm_source: "google",
        }),
      }),
    );

    const older = new CaptureAcquisitionJourney(repository, sequenceFactory("touch-older"));

    const result = await older.execute(
      input(new Date(now.getTime() - 1000), {
        journeyId: newer.journey.id,
        referrer: "https://older.example/referral",
      }),
    );

    expect(result.journey.firstTouchId).toBe("touch-newer");

    expect(result.journey.lastTouchId).toBe("touch-newer");
  });
});
