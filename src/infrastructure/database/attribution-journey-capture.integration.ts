import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./client";
import { PrismaAttributionJourneyRepository } from "./prisma-attribution-journey-repository";

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;

  if (process.env.APP_ENV !== "test" || !raw) {
    throw new Error("P13-C integration requires APP_ENV=test and TEST_DATABASE_URL");
  }

  return raw;
}

const cleanup = {
  journeys: new Set<string>(),
  touches: new Set<string>(),
};

let db: ReturnType<typeof createDatabaseClient>;
let repository: PrismaAttributionJourneyRepository;

async function cleanupFixture() {
  if (cleanup.touches.size > 0) {
    await db.attributionTouch.deleteMany({
      where: {
        id: {
          in: [...cleanup.touches],
        },
      },
    });

    cleanup.touches.clear();
  }

  if (cleanup.journeys.size > 0) {
    await db.acquisitionJourney.deleteMany({
      where: {
        id: {
          in: [...cleanup.journeys],
        },
      },
    });

    cleanup.journeys.clear();
  }
}

async function createJourney() {
  const id = randomUUID();

  cleanup.journeys.add(id);

  return repository.createJourney({
    id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    analyticsConsentState: "UNKNOWN",
    advertisingConsentState: "UNKNOWN",
    policyVersion: "p13-architecture-freeze-r2",
  });
}

describe("P13-C Prisma acquisition journey capture", () => {
  beforeAll(async () => {
    db = createDatabaseClient(guardedTestUrl());

    await db.$connect();

    repository = new PrismaAttributionJourneyRepository(db);
  });

  afterEach(cleanupFixture);

  afterAll(async () => {
    await cleanupFixture();
    await db.$disconnect();
  });

  it("atomically persists an external touch and establishes First and Last Touch", async () => {
    const journey = await createJourney();
    const touchId = randomUUID();

    cleanup.touches.add(touchId);

    const seenAt = new Date(Date.now() + 60_000);

    const result = await repository.recordObservation({
      journeyId: journey.id,
      touch: {
        id: touchId,
        journeyId: journey.id,
        occurredAt: seenAt,
        source: "google",
        medium: "cpc",
        campaign: "integration",
        content: null,
        term: null,
        referrerHost: "google.com",
        landingPath: "/cronograma-capilar-inteligente",
        touchType: "CAMPAIGN",
      },
      seenAt,
      externallyAttributable: true,
    });

    expect(result.touch?.id).toBe(touchId);

    expect(result.journey.firstTouchId).toBe(touchId);

    expect(result.journey.lastTouchId).toBe(touchId);

    const persisted = await db.acquisitionJourney.findUniqueOrThrow({
      where: {
        id: journey.id,
      },
    });

    expect(persisted.firstTouchId).toBe(touchId);

    expect(persisted.lastTouchId).toBe(touchId);

    expect(
      await db.attributionTouch.count({
        where: {
          journeyId: journey.id,
        },
      }),
    ).toBe(1);
  });

  it("refreshes a Journey for subsequent DIRECT traffic without creating another AttributionTouch", async () => {
    const journey = await createJourney();

    const externalTouchId = randomUUID();

    cleanup.touches.add(externalTouchId);

    const externalSeenAt = new Date(Date.now() + 60_000);

    await repository.recordObservation({
      journeyId: journey.id,
      touch: {
        id: externalTouchId,
        journeyId: journey.id,
        occurredAt: externalSeenAt,
        source: "newsletter",
        medium: "email",
        campaign: "launch",
        content: null,
        term: null,
        referrerHost: null,
        landingPath: "/cronograma-capilar-inteligente",
        touchType: "CAMPAIGN",
      },
      seenAt: externalSeenAt,
      externallyAttributable: true,
    });

    const directSeenAt = new Date(externalSeenAt.getTime() + 60_000);

    const direct = await repository.recordObservation({
      journeyId: journey.id,
      touch: null,
      seenAt: directSeenAt,
      externallyAttributable: false,
    });

    expect(direct.touch).toBeNull();

    expect(direct.journey.firstTouchId).toBe(externalTouchId);

    expect(direct.journey.lastTouchId).toBe(externalTouchId);

    expect(direct.journey.lastSeenAt.getTime()).toBe(directSeenAt.getTime());

    expect(
      await db.attributionTouch.count({
        where: {
          journeyId: journey.id,
        },
      }),
    ).toBe(1);
  });

  it("serializes concurrent external observations and keeps Last Touch on the most recent occurredAt", async () => {
    const journey = await createJourney();

    const olderTouchId = randomUUID();
    const newerTouchId = randomUUID();

    cleanup.touches.add(olderTouchId);
    cleanup.touches.add(newerTouchId);

    const olderAt = new Date(Date.now() + 60_000);

    const newerAt = new Date(olderAt.getTime() + 10_000);

    await Promise.all([
      repository.recordObservation({
        journeyId: journey.id,
        touch: {
          id: newerTouchId,
          journeyId: journey.id,
          occurredAt: newerAt,
          source: "meta",
          medium: "paid_social",
          campaign: "newer",
          content: null,
          term: null,
          referrerHost: null,
          landingPath: "/cronograma-capilar-inteligente",
          touchType: "CAMPAIGN",
        },
        seenAt: newerAt,
        externallyAttributable: true,
      }),

      repository.recordObservation({
        journeyId: journey.id,
        touch: {
          id: olderTouchId,
          journeyId: journey.id,
          occurredAt: olderAt,
          source: "google",
          medium: "cpc",
          campaign: "older",
          content: null,
          term: null,
          referrerHost: null,
          landingPath: "/cronograma-capilar-inteligente",
          touchType: "CAMPAIGN",
        },
        seenAt: olderAt,
        externallyAttributable: true,
      }),
    ]);

    const persisted = await db.acquisitionJourney.findUniqueOrThrow({
      where: {
        id: journey.id,
      },
    });

    expect([olderTouchId, newerTouchId]).toContain(persisted.firstTouchId);

    expect(persisted.lastTouchId).toBe(newerTouchId);

    expect(persisted.lastSeenAt.getTime()).toBe(newerAt.getTime());

    expect(
      await db.attributionTouch.count({
        where: {
          journeyId: journey.id,
        },
      }),
    ).toBe(2);
  });

  it("supports concurrent creation of the same first-party Journey identifier idempotently", async () => {
    const journeyId = randomUUID();

    cleanup.journeys.add(journeyId);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const create = () =>
      repository.createJourney({
        id: journeyId,
        expiresAt,
        analyticsConsentState: "UNKNOWN",
        advertisingConsentState: "UNKNOWN",
        policyVersion: "p13-architecture-freeze-r2",
      });

    const [first, second] = await Promise.all([create(), create()]);

    expect(first.id).toBe(journeyId);
    expect(second.id).toBe(journeyId);

    expect(
      await db.acquisitionJourney.count({
        where: {
          id: journeyId,
        },
      }),
    ).toBe(1);
  });

  it("rejects an externally attributable observation when no AttributionTouch is supplied", async () => {
    const journey = await createJourney();

    await expect(
      repository.recordObservation({
        journeyId: journey.id,
        touch: null,
        seenAt: new Date(),
        externallyAttributable: true,
      }),
    ).rejects.toThrow("Externally attributable observation requires a touch.");

    expect(
      await db.attributionTouch.count({
        where: {
          journeyId: journey.id,
        },
      }),
    ).toBe(0);
  });
});
