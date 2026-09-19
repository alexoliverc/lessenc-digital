import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./client";
import { PrismaAnalyticsDispatchRepository } from "./prisma-analytics-dispatch-repository";
import { PrismaAnalyticsEventRepository } from "./prisma-analytics-event-repository";
import { PrismaAttributionJourneyRepository } from "./prisma-attribution-journey-repository";
import { PrismaOrderAttributionRepository } from "./prisma-order-attribution-repository";

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;

  if (process.env.APP_ENV !== "test" || !raw) {
    throw new Error("P13-B requires APP_ENV=test and TEST_DATABASE_URL");
  }

  const url = new URL(raw);

  if (
    url.protocol !== "mysql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "3307" ||
    url.pathname !== "/lessenc_test"
  ) {
    throw new Error("P13-B refused a non-isolated P06 test database");
  }

  return raw;
}

const cleanup = {
  journeys: new Set<string>(),
  touches: new Set<string>(),
  customers: new Set<string>(),
  orders: new Set<string>(),
  orderAttributions: new Set<string>(),
  events: new Set<string>(),
  dispatches: new Set<string>(),
};

let db: ReturnType<typeof createDatabaseClient>;
let journeys: PrismaAttributionJourneyRepository;
let orderAttributions: PrismaOrderAttributionRepository;
let events: PrismaAnalyticsEventRepository;
let dispatches: PrismaAnalyticsDispatchRepository;

async function createOrderFixture(): Promise<{
  customerId: string;
  orderId: string;
}> {
  const customerId = randomUUID();
  const orderId = randomUUID();

  cleanup.customers.add(customerId);
  cleanup.orders.add(orderId);

  await db.customer.create({
    data: {
      id: customerId,
      email: `p13-${customerId}@example.test`,
    },
  });

  await db.order.create({
    data: {
      id: orderId,
      customerId,
      status: "PENDING",
      totalMinor: 12990,
      currency: "BRL",
    },
  });

  return {
    customerId,
    orderId,
  };
}

async function cleanupFixture(): Promise<void> {
  if (cleanup.dispatches.size > 0) {
    await db.analyticsDispatch.deleteMany({
      where: {
        id: {
          in: [...cleanup.dispatches],
        },
      },
    });
  }

  if (cleanup.events.size > 0) {
    await db.analyticsEvent.deleteMany({
      where: {
        id: {
          in: [...cleanup.events],
        },
      },
    });
  }

  if (cleanup.orderAttributions.size > 0) {
    await db.orderAttribution.deleteMany({
      where: {
        id: {
          in: [...cleanup.orderAttributions],
        },
      },
    });
  }

  if (cleanup.touches.size > 0) {
    await db.attributionTouch.deleteMany({
      where: {
        id: {
          in: [...cleanup.touches],
        },
      },
    });
  }

  if (cleanup.journeys.size > 0) {
    await db.acquisitionJourney.deleteMany({
      where: {
        id: {
          in: [...cleanup.journeys],
        },
      },
    });
  }

  if (cleanup.orders.size > 0) {
    await db.order.deleteMany({
      where: {
        id: {
          in: [...cleanup.orders],
        },
      },
    });
  }

  if (cleanup.customers.size > 0) {
    await db.customer.deleteMany({
      where: {
        id: {
          in: [...cleanup.customers],
        },
      },
    });
  }

  for (const values of Object.values(cleanup)) {
    values.clear();
  }
}

describe("P13-B analytics persistence foundation on isolated MySQL", () => {
  beforeAll(async () => {
    db = createDatabaseClient(guardedTestUrl());

    await db.$connect();

    journeys = new PrismaAttributionJourneyRepository(db);

    orderAttributions = new PrismaOrderAttributionRepository(db);

    events = new PrismaAnalyticsEventRepository(db);

    dispatches = new PrismaAnalyticsDispatchRepository(db);
  });

  afterEach(cleanupFixture);

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("persists a provider-neutral journey and its attribution touch", async () => {
    const journeyId = randomUUID();
    const touchId = randomUUID();

    cleanup.journeys.add(journeyId);
    cleanup.touches.add(touchId);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);

    const createdJourney = await journeys.createJourney({
      id: journeyId,
      expiresAt,
      analyticsConsentState: "GRANTED",
      advertisingConsentState: "DENIED",
      policyVersion: "p13-r2",
    });

    expect(createdJourney).toMatchObject({
      id: journeyId,
      firstTouchId: null,
      lastTouchId: null,
      analyticsConsentState: "GRANTED",
      advertisingConsentState: "DENIED",
      policyVersion: "p13-r2",
    });

    const occurredAt = new Date();

    const touch = await journeys.createTouch({
      id: touchId,
      journeyId,
      occurredAt,
      source: "newsletter",
      medium: "email",
      campaign: "p13-foundation",
      content: null,
      term: null,
      referrerHost: "example.test",
      landingPath: "/ebook",
      touchType: "CAMPAIGN",
    });

    expect(touch).toMatchObject({
      id: touchId,
      journeyId,
      source: "newsletter",
      medium: "email",
      campaign: "p13-foundation",
      referrerHost: "example.test",
      landingPath: "/ebook",
      touchType: "CAMPAIGN",
    });

    const loaded = await journeys.findJourney(journeyId);

    expect(loaded?.id).toBe(journeyId);

    expect(
      await db.attributionTouch.count({
        where: {
          journeyId,
        },
      }),
    ).toBe(1);
  });

  it("rejects an AttributionTouch whose journey does not exist", async () => {
    const touchId = randomUUID();

    cleanup.touches.add(touchId);

    await expect(
      journeys.createTouch({
        id: touchId,
        journeyId: randomUUID(),
        occurredAt: new Date(),
        source: null,
        medium: null,
        campaign: null,
        content: null,
        term: null,
        referrerHost: null,
        landingPath: "/",
        touchType: "DIRECT",
      }),
    ).rejects.toHaveProperty("code", "P2003");
  });

  it("persists one immutable OrderAttribution snapshot per Order", async () => {
    const { orderId } = await createOrderFixture();

    const snapshotId = randomUUID();

    cleanup.orderAttributions.add(snapshotId);

    const journeyId = randomUUID();
    const firstTouchId = randomUUID();
    const lastTouchId = randomUUID();

    const snapshot = await orderAttributions.createSnapshot({
      id: snapshotId,
      orderId,
      journeyId,
      firstTouchId,
      lastTouchId,
      firstSource: "google",
      firstMedium: "cpc",
      firstCampaign: "campaign-a",
      firstContent: null,
      firstTerm: "hair mask",
      lastSource: "meta",
      lastMedium: "paid-social",
      lastCampaign: "campaign-b",
      lastContent: "creative-a",
      lastTerm: null,
      capturedAt: new Date(),
    });

    expect(snapshot).toMatchObject({
      id: snapshotId,
      orderId,
      journeyId,
      firstTouchId,
      lastTouchId,
      firstSource: "google",
      lastSource: "meta",
    });

    /*
     * journeyId / touch IDs intentionally have no FK here.
     * OrderAttribution is a durable commercial snapshot and
     * must survive the shorter journey/touch retention cycle.
     */
    expect(
      await db.acquisitionJourney.count({
        where: {
          id: journeyId,
        },
      }),
    ).toBe(0);

    const duplicateId = randomUUID();

    cleanup.orderAttributions.add(duplicateId);

    await expect(
      orderAttributions.createSnapshot({
        id: duplicateId,
        orderId,
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
        capturedAt: new Date(),
      }),
    ).rejects.toHaveProperty("code", "P2002");

    const loaded = await orderAttributions.findByOrderId(orderId);

    expect(loaded?.id).toBe(snapshotId);
  });

  it("enforces the canonical PURCHASE deduplication foundation", async () => {
    const orderKey = randomUUID();

    const eventId = randomUUID();
    cleanup.events.add(eventId);

    const first = await events.create({
      id: eventId,
      type: "PURCHASE",
      occurredAt: new Date(),
      journeyId: null,
      productId: null,
      offerId: null,
      orderId: orderKey,
      amountMinor: 12990,
      currency: "BRL",
      attributionState: "ATTRIBUTED",
      consentSnapshot: {
        analytics: "GRANTED",
        advertising: "DENIED",
        policyVersion: "p13-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: orderKey,
    });

    expect(first).toMatchObject({
      id: eventId,
      type: "PURCHASE",
      orderId: orderKey,
      amountMinor: 12990,
      currency: "BRL",
      schemaVersion: 1,
      purchaseOrderKey: orderKey,
    });

    const duplicateId = randomUUID();
    cleanup.events.add(duplicateId);

    await expect(
      events.create({
        id: duplicateId,
        type: "PURCHASE",
        occurredAt: new Date(),
        journeyId: null,
        productId: null,
        offerId: null,
        orderId: orderKey,
        amountMinor: 12990,
        currency: "BRL",
        attributionState: "ATTRIBUTED",
        consentSnapshot: {
          analytics: "GRANTED",
          advertising: "DENIED",
          policyVersion: "p13-r2",
        },
        schemaVersion: 1,
        purchaseOrderKey: orderKey,
      }),
    ).rejects.toHaveProperty("code", "P2002");

    const loaded = await events.findPurchaseByOrderKey(orderKey);

    expect(loaded?.id).toBe(eventId);
  });

  it("creates a canonical AnalyticsEvent idempotently and replays it as EXISTING", async () => {
    const eventId = randomUUID();
    cleanup.events.add(eventId);

    const occurredAt = new Date();

    const input = {
      id: eventId,
      type: "VIEW_CONTENT" as const,
      occurredAt,
      journeyId: null,
      productId: randomUUID(),
      offerId: randomUUID(),
      orderId: null,
      amountMinor: 2990,
      currency: "BRL",
      attributionState: "UNATTRIBUTED",
      consentSnapshot: {
        analytics: "UNKNOWN",
        advertising: "UNKNOWN",
        policyVersion: "p13-architecture-freeze-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: null,
    };

    const created = await events.createIdempotent(input);

    expect(created.state).toBe("CREATED");
    expect(created.event).toMatchObject({
      id: eventId,
      type: "VIEW_CONTENT",
      productId: input.productId,
      offerId: input.offerId,
      attributionState: "UNATTRIBUTED",
      schemaVersion: 1,
    });

    const replay = await events.createIdempotent(input);

    expect(replay.state).toBe("EXISTING");
    expect(replay.event.id).toBe(eventId);

    expect(
      await db.analyticsEvent.count({
        where: {
          id: eventId,
        },
      }),
    ).toBe(1);
  });

  it("serializes concurrent identical AnalyticsEvent creation into CREATED plus EXISTING", async () => {
    const eventId = randomUUID();
    cleanup.events.add(eventId);

    const input = {
      id: eventId,
      type: "INITIATE_CHECKOUT" as const,
      occurredAt: new Date(),
      journeyId: null,
      productId: randomUUID(),
      offerId: randomUUID(),
      orderId: null,
      amountMinor: 2990,
      currency: "BRL",
      attributionState: "UNATTRIBUTED",
      consentSnapshot: {
        analytics: "UNKNOWN",
        advertising: "UNKNOWN",
        policyVersion: "p13-architecture-freeze-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: null,
    };

    const [first, second] = await Promise.all([
      events.createIdempotent(input),
      events.createIdempotent(input),
    ]);

    const states = [first.state, second.state].sort();

    expect(states).toEqual(["CREATED", "EXISTING"]);

    expect(
      await db.analyticsEvent.count({
        where: {
          id: eventId,
        },
      }),
    ).toBe(1);
  });

  it("rejects the same AnalyticsEvent id when the replay payload is incompatible", async () => {
    const eventId = randomUUID();
    cleanup.events.add(eventId);

    const original = {
      id: eventId,
      type: "VIEW_CONTENT" as const,
      occurredAt: new Date(),
      journeyId: null,
      productId: randomUUID(),
      offerId: randomUUID(),
      orderId: null,
      amountMinor: 2990,
      currency: "BRL",
      attributionState: "UNATTRIBUTED",
      consentSnapshot: {
        analytics: "UNKNOWN",
        advertising: "UNKNOWN",
        policyVersion: "p13-architecture-freeze-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: null,
    };

    await expect(events.createIdempotent(original)).resolves.toMatchObject({
      state: "CREATED",
    });

    let captured: unknown;

    try {
      await events.createIdempotent({
        ...original,
        amountMinor: 3990,
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toBe("ANALYTICS_EVENT_ID_CONFLICT");

    const cause = (captured as Error & { cause?: unknown }).cause;

    expect(cause).toMatchObject({
      code: "P2002",
    });

    const persisted = await events.findById(eventId);

    expect(persisted).toMatchObject({
      id: eventId,
      amountMinor: 2990,
    });

    expect(
      await db.analyticsEvent.count({
        where: {
          id: eventId,
        },
      }),
    ).toBe(1);
  });

  it("does not misclassify a different unique-key conflict as an event-id replay", async () => {
    const orderKey = randomUUID();

    const firstId = randomUUID();
    const secondId = randomUUID();

    cleanup.events.add(firstId);
    cleanup.events.add(secondId);

    await events.createIdempotent({
      id: firstId,
      type: "PURCHASE",
      occurredAt: new Date(),
      journeyId: null,
      productId: null,
      offerId: null,
      orderId: orderKey,
      amountMinor: 12990,
      currency: "BRL",
      attributionState: "ATTRIBUTED",
      consentSnapshot: {
        analytics: "GRANTED",
        advertising: "DENIED",
        policyVersion: "p13-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: orderKey,
    });

    await expect(
      events.createIdempotent({
        id: secondId,
        type: "PURCHASE",
        occurredAt: new Date(),
        journeyId: null,
        productId: null,
        offerId: null,
        orderId: orderKey,
        amountMinor: 12990,
        currency: "BRL",
        attributionState: "ATTRIBUTED",
        consentSnapshot: {
          analytics: "GRANTED",
          advertising: "DENIED",
          policyVersion: "p13-r2",
        },
        schemaVersion: 1,
        purchaseOrderKey: orderKey,
      }),
    ).rejects.toHaveProperty("code", "P2002");

    expect(await events.findById(secondId)).toBeNull();

    expect(
      await db.analyticsEvent.count({
        where: {
          purchaseOrderKey: orderKey,
        },
      }),
    ).toBe(1);
  });

  it("enforces one dispatch per event, provider and channel", async () => {
    const eventId = randomUUID();
    cleanup.events.add(eventId);

    await events.create({
      id: eventId,
      type: "VIEW_CONTENT",
      occurredAt: new Date(),
      journeyId: null,
      productId: null,
      offerId: null,
      orderId: null,
      amountMinor: null,
      currency: null,
      attributionState: "UNATTRIBUTED",
      consentSnapshot: {
        analytics: "GRANTED",
        advertising: "GRANTED",
        policyVersion: "p13-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: null,
    });

    const dispatchId = randomUUID();
    cleanup.dispatches.add(dispatchId);

    const first = await dispatches.create({
      id: dispatchId,
      analyticsEventId: eventId,
      provider: "test-provider",
      channel: "server",
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: null,
      providerEventId: null,
      lastErrorCode: null,
      lastErrorClass: null,
      completedAt: null,
    });

    expect(first).toMatchObject({
      id: dispatchId,
      analyticsEventId: eventId,
      provider: "test-provider",
      channel: "server",
      status: "PENDING",
      attemptCount: 0,
    });

    const duplicateId = randomUUID();
    cleanup.dispatches.add(duplicateId);

    await expect(
      dispatches.create({
        id: duplicateId,
        analyticsEventId: eventId,
        provider: "test-provider",
        channel: "server",
        status: "PENDING",
        attemptCount: 0,
        nextAttemptAt: null,
        lastAttemptAt: null,
        providerEventId: null,
        lastErrorCode: null,
        lastErrorClass: null,
        completedAt: null,
      }),
    ).rejects.toHaveProperty("code", "P2002");

    const loaded = await dispatches.findByEventProviderChannel(eventId, "test-provider", "server");

    expect(loaded?.id).toBe(dispatchId);
  });

  it("creates a provider dispatch idempotently for the same event, provider and channel", async () => {
    const eventId = randomUUID();
    cleanup.events.add(eventId);

    await events.create({
      id: eventId,
      type: "VIEW_CONTENT",
      occurredAt: new Date(),
      journeyId: null,
      productId: null,
      offerId: null,
      orderId: null,
      amountMinor: null,
      currency: null,
      attributionState: "UNATTRIBUTED",
      consentSnapshot: {
        analytics: "GRANTED",
        advertising: "GRANTED",
        policyVersion: "p13-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: null,
    });

    const provider = `p13f-idem-${randomUUID().slice(0, 8)}`;
    const firstId = randomUUID();
    const replayId = randomUUID();

    cleanup.dispatches.add(firstId);
    cleanup.dispatches.add(replayId);

    const input = {
      id: firstId,
      analyticsEventId: eventId,
      provider,
      channel: "server",
      status: "PENDING" as const,
      attemptCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: null,
      providerEventId: null,
      lastErrorCode: null,
      lastErrorClass: null,
      completedAt: null,
    };

    const created = await dispatches.createIdempotent(input);

    const replay = await dispatches.createIdempotent({
      ...input,
      id: replayId,
    });

    expect(created).toMatchObject({
      id: firstId,
      analyticsEventId: eventId,
      provider,
      channel: "server",
      status: "PENDING",
      attemptCount: 0,
    });

    expect(replay.id).toBe(firstId);

    expect(
      await db.analyticsDispatch.count({
        where: {
          analyticsEventId: eventId,
          provider,
          channel: "server",
        },
      }),
    ).toBe(1);
  });

  it("discovers events that do not yet have a dispatch for the requested provider and channel", async () => {
    const firstEventId = randomUUID();
    const secondEventId = randomUUID();

    cleanup.events.add(firstEventId);
    cleanup.events.add(secondEventId);

    const firstOccurredAt = new Date(Date.now() - 1_000);
    const secondOccurredAt = new Date();

    for (const [eventId, occurredAt] of [
      [firstEventId, firstOccurredAt],
      [secondEventId, secondOccurredAt],
    ] as const) {
      await events.create({
        id: eventId,
        type: "VIEW_CONTENT",
        occurredAt,
        journeyId: null,
        productId: null,
        offerId: null,
        orderId: null,
        amountMinor: null,
        currency: null,
        attributionState: "UNATTRIBUTED",
        consentSnapshot: {
          analytics: "GRANTED",
          advertising: "GRANTED",
          policyVersion: "p13-r2",
        },
        schemaVersion: 1,
        purchaseOrderKey: null,
      });
    }

    const provider = `p13f-scan-${randomUUID().slice(0, 8)}`;

    const dispatchId = randomUUID();
    cleanup.dispatches.add(dispatchId);

    await dispatches.create({
      id: dispatchId,
      analyticsEventId: firstEventId,
      provider,
      channel: "server",
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: null,
      providerEventId: null,
      lastErrorCode: null,
      lastErrorClass: null,
      completedAt: null,
    });

    const undispatched = await dispatches.findUndispatchedEvents({
      provider,
      channel: "server",
      limit: 1000,
    });

    const ids = undispatched.map((event) => event.id);

    expect(ids).not.toContain(firstEventId);
    expect(ids).toContain(secondEventId);
  });

  it("claims one due dispatch only once under concurrent workers", async () => {
    const eventId = randomUUID();
    cleanup.events.add(eventId);

    await events.create({
      id: eventId,
      type: "INITIATE_CHECKOUT",
      occurredAt: new Date(),
      journeyId: null,
      productId: null,
      offerId: null,
      orderId: null,
      amountMinor: null,
      currency: null,
      attributionState: "UNATTRIBUTED",
      consentSnapshot: {
        analytics: "GRANTED",
        advertising: "GRANTED",
        policyVersion: "p13-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: null,
    });

    const provider = `p13f-claim-${randomUUID().slice(0, 8)}`;

    const dispatchId = randomUUID();
    cleanup.dispatches.add(dispatchId);

    await dispatches.create({
      id: dispatchId,
      analyticsEventId: eventId,
      provider,
      channel: "server",
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: null,
      providerEventId: null,
      lastErrorCode: null,
      lastErrorClass: null,
      completedAt: null,
    });

    const attemptedAt = new Date();

    const results = await Promise.all([
      dispatches.claimDue({
        provider,
        channel: "server",
        attemptedAt,
      }),
      dispatches.claimDue({
        provider,
        channel: "server",
        attemptedAt,
      }),
    ]);

    const claimed = results.filter((result) => result !== null);

    expect(claimed).toHaveLength(1);
    expect(results.filter((result) => result === null)).toHaveLength(1);

    expect(claimed[0]?.dispatch).toMatchObject({
      id: dispatchId,
      analyticsEventId: eventId,
      provider,
      channel: "server",
      status: "PROCESSING",
      attemptCount: 1,
    });

    expect(claimed[0]?.event.id).toBe(eventId);

    const persisted = await db.analyticsDispatch.findUniqueOrThrow({
      where: {
        id: dispatchId,
      },
    });

    expect(persisted.status).toBe("PROCESSING");
    expect(persisted.attemptCount).toBe(1);
    expect(persisted.lastAttemptAt?.getTime()).toBe(attemptedAt.getTime());
  });

  it("honors retry backoff, reclaims when due and completes successfully", async () => {
    const eventId = randomUUID();
    cleanup.events.add(eventId);

    await events.create({
      id: eventId,
      type: "PURCHASE",
      occurredAt: new Date(),
      journeyId: null,
      productId: null,
      offerId: null,
      orderId: randomUUID(),
      amountMinor: 12990,
      currency: "BRL",
      attributionState: "UNATTRIBUTED",
      consentSnapshot: {
        analytics: "GRANTED",
        advertising: "GRANTED",
        policyVersion: "p13-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: null,
    });

    const provider = `p13f-retry-${randomUUID().slice(0, 8)}`;

    const dispatchId = randomUUID();
    cleanup.dispatches.add(dispatchId);

    await dispatches.create({
      id: dispatchId,
      analyticsEventId: eventId,
      provider,
      channel: "server",
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: null,
      providerEventId: null,
      lastErrorCode: null,
      lastErrorClass: null,
      completedAt: null,
    });

    const firstAttemptAt = new Date();

    const firstClaim = await dispatches.claimDue({
      provider,
      channel: "server",
      attemptedAt: firstAttemptAt,
    });

    expect(firstClaim?.dispatch.status).toBe("PROCESSING");
    expect(firstClaim?.dispatch.attemptCount).toBe(1);

    const nextAttemptAt = new Date(firstAttemptAt.getTime() + 60_000);

    const retryable = await dispatches.markRetryable({
      dispatchId,
      nextAttemptAt,
      errorCode: "PROVIDER_TEMPORARY_FAILURE",
      errorClass: "RETRYABLE",
    });

    expect(retryable).toMatchObject({
      id: dispatchId,
      status: "RETRYABLE",
      attemptCount: 1,
      lastErrorCode: "PROVIDER_TEMPORARY_FAILURE",
      lastErrorClass: "RETRYABLE",
      completedAt: null,
    });

    expect(retryable.nextAttemptAt?.getTime()).toBe(nextAttemptAt.getTime());

    await expect(
      dispatches.claimDue({
        provider,
        channel: "server",
        attemptedAt: new Date(nextAttemptAt.getTime() - 1),
      }),
    ).resolves.toBeNull();

    const secondClaim = await dispatches.claimDue({
      provider,
      channel: "server",
      attemptedAt: nextAttemptAt,
    });

    expect(secondClaim?.dispatch).toMatchObject({
      id: dispatchId,
      status: "PROCESSING",
      attemptCount: 2,
      lastErrorCode: null,
      lastErrorClass: null,
    });

    const completedAt = new Date(nextAttemptAt.getTime() + 1_000);

    const providerEventId = `provider-${randomUUID()}`;

    const succeeded = await dispatches.markSucceeded({
      dispatchId,
      providerEventId,
      completedAt,
    });

    expect(succeeded).toMatchObject({
      id: dispatchId,
      status: "SUCCEEDED",
      attemptCount: 2,
      providerEventId,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorClass: null,
    });

    expect(succeeded.completedAt?.getTime()).toBe(completedAt.getTime());

    await expect(
      dispatches.claimDue({
        provider,
        channel: "server",
        attemptedAt: new Date(completedAt.getTime() + 1_000),
      }),
    ).resolves.toBeNull();
  });

  it("recovers a stale PROCESSING dispatch without reclaiming an active worker", async () => {
    const eventId = randomUUID();
    cleanup.events.add(eventId);

    await events.create({
      id: eventId,
      type: "VIEW_CONTENT",
      occurredAt: new Date(),
      journeyId: null,
      productId: null,
      offerId: null,
      orderId: null,
      amountMinor: null,
      currency: null,
      attributionState: "UNATTRIBUTED",
      consentSnapshot: {
        analytics: "GRANTED",
        advertising: "GRANTED",
        policyVersion: "p13-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: null,
    });

    const provider = `p13f-stale-${randomUUID().slice(0, 8)}`;

    const dispatchId = randomUUID();

    cleanup.dispatches.add(dispatchId);

    await dispatches.create({
      id: dispatchId,
      analyticsEventId: eventId,
      provider,
      channel: "server",
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: null,
      providerEventId: null,
      lastErrorCode: null,
      lastErrorClass: null,
      completedAt: null,
    });

    const firstAttemptAt = new Date("2026-09-19T15:00:00.000Z");

    const firstClaim = await dispatches.claimDue({
      provider,
      channel: "server",
      attemptedAt: firstAttemptAt,
    });

    expect(firstClaim?.dispatch).toMatchObject({
      id: dispatchId,
      status: "PROCESSING",
      attemptCount: 1,
    });

    const activeRecovery = await dispatches.recoverStaleProcessing({
      provider,
      channel: "server",
      staleBefore: new Date(firstAttemptAt.getTime() - 1),
      recoveredAt: new Date(firstAttemptAt.getTime() + 60_000),
      limit: 10,
    });

    expect(activeRecovery).toBe(0);

    const stillProcessing = await db.analyticsDispatch.findUniqueOrThrow({
      where: {
        id: dispatchId,
      },
    });

    expect(stillProcessing.status).toBe("PROCESSING");

    const recoveredAt = new Date(firstAttemptAt.getTime() + 10 * 60_000);

    const recovered = await dispatches.recoverStaleProcessing({
      provider,
      channel: "server",
      staleBefore: new Date(firstAttemptAt.getTime() + 5 * 60_000),
      recoveredAt,
      limit: 10,
    });

    expect(recovered).toBe(1);

    const retryable = await db.analyticsDispatch.findUniqueOrThrow({
      where: {
        id: dispatchId,
      },
    });

    expect(retryable).toMatchObject({
      status: "RETRYABLE",
      attemptCount: 1,
      lastErrorCode: "WORKER_LEASE_EXPIRED",
      lastErrorClass: "RETRYABLE",
      completedAt: null,
    });

    expect(retryable.nextAttemptAt?.getTime()).toBe(recoveredAt.getTime());

    const secondClaim = await dispatches.claimDue({
      provider,
      channel: "server",
      attemptedAt: recoveredAt,
    });

    expect(secondClaim?.dispatch).toMatchObject({
      id: dispatchId,
      status: "PROCESSING",
      attemptCount: 2,
    });

    const completedAt = new Date(recoveredAt.getTime() + 1_000);

    const succeeded = await dispatches.markSucceeded({
      dispatchId,
      providerEventId: `provider-${randomUUID()}`,
      completedAt,
    });

    expect(succeeded).toMatchObject({
      id: dispatchId,
      status: "SUCCEEDED",
      attemptCount: 2,
      lastErrorCode: null,
      lastErrorClass: null,
    });

    expect(succeeded.completedAt?.getTime()).toBe(completedAt.getTime());
  });
  it("suppresses a PROCESSING dispatch terminally and prevents later delivery", async () => {
    const eventId = randomUUID();
    cleanup.events.add(eventId);

    await events.create({
      id: eventId,
      type: "VIEW_CONTENT",
      occurredAt: new Date(),
      journeyId: null,
      productId: null,
      offerId: null,
      orderId: null,
      amountMinor: null,
      currency: null,
      attributionState: "UNATTRIBUTED",
      consentSnapshot: {
        analytics: "DENIED",
        advertising: "DENIED",
        policyVersion: "p13-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: null,
    });

    const provider = `p13f-suppress-${randomUUID().slice(0, 8)}`;

    const dispatchId = randomUUID();
    cleanup.dispatches.add(dispatchId);

    await dispatches.create({
      id: dispatchId,
      analyticsEventId: eventId,
      provider,
      channel: "server",
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: null,
      providerEventId: null,
      lastErrorCode: null,
      lastErrorClass: null,
      completedAt: null,
    });

    const completedAt = new Date("2026-09-19T16:00:00.000Z");

    await expect(
      dispatches.markSuppressed({
        dispatchId,
        completedAt,
      }),
    ).rejects.toThrow("ANALYTICS_DISPATCH_TRANSITION_CONFLICT");

    const claimed = await dispatches.claimDue({
      provider,
      channel: "server",
      attemptedAt: completedAt,
    });

    expect(claimed?.dispatch).toMatchObject({
      id: dispatchId,
      status: "PROCESSING",
      attemptCount: 1,
    });

    const suppressed = await dispatches.markSuppressed({
      dispatchId,
      completedAt,
    });

    expect(suppressed).toMatchObject({
      id: dispatchId,
      status: "SUPPRESSED",
      attemptCount: 1,
      nextAttemptAt: null,
      lastErrorCode: "CONSENT_NOT_GRANTED",
      lastErrorClass: "CONSENT_POLICY",
    });

    expect(suppressed.completedAt?.getTime()).toBe(completedAt.getTime());

    await expect(
      dispatches.claimDue({
        provider,
        channel: "server",
        attemptedAt: new Date(completedAt.getTime() + 1_000),
      }),
    ).resolves.toBeNull();

    await expect(
      dispatches.markSucceeded({
        dispatchId,
        providerEventId: randomUUID(),
        completedAt: new Date(completedAt.getTime() + 2_000),
      }),
    ).rejects.toThrow("ANALYTICS_DISPATCH_TRANSITION_CONFLICT");
  });
  it("persists a custom provider-policy suppression reason terminally for Meta CAPI", async () => {
    const eventId = randomUUID();
    const orderId = randomUUID();
    const dispatchId = randomUUID();

    cleanup.events.add(eventId);
    cleanup.dispatches.add(dispatchId);

    await events.create({
      id: eventId,
      type: "PURCHASE",
      occurredAt: new Date("2026-09-19T19:20:00.000Z"),
      journeyId: null,
      productId: null,
      offerId: null,
      orderId,
      amountMinor: 13990,
      currency: "BRL",
      attributionState: "ATTRIBUTED",
      consentSnapshot: {
        analytics: "GRANTED",
        advertising: "GRANTED",
        policyVersion: "p13-architecture-freeze-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: orderId,
    });

    await dispatches.create({
      id: dispatchId,
      analyticsEventId: eventId,
      provider: "meta",
      channel: "capi",
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: null,
      providerEventId: null,
      lastErrorCode: null,
      lastErrorClass: null,
      completedAt: null,
    });

    const attemptedAt = new Date("2026-09-19T19:21:00.000Z");

    const claimed = await dispatches.claimDue({
      provider: "meta",
      channel: "capi",
      attemptedAt,
    });

    expect(claimed?.dispatch).toMatchObject({
      id: dispatchId,
      analyticsEventId: eventId,
      provider: "meta",
      channel: "capi",
      status: "PROCESSING",
      attemptCount: 1,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorClass: null,
      completedAt: null,
    });

    expect(claimed?.event.id).toBe(eventId);

    const completedAt = new Date("2026-09-19T19:21:01.000Z");

    const suppressed = await dispatches.markSuppressed({
      dispatchId,
      completedAt,
      errorCode: "MATCHING_DATA_POLICY_NOT_AUTHORIZED",
      errorClass: "PRIVACY_POLICY",
    });

    expect(suppressed).toMatchObject({
      id: dispatchId,
      analyticsEventId: eventId,
      provider: "meta",
      channel: "capi",
      status: "SUPPRESSED",
      attemptCount: 1,
      nextAttemptAt: null,
      providerEventId: null,
      lastErrorCode: "MATCHING_DATA_POLICY_NOT_AUTHORIZED",
      lastErrorClass: "PRIVACY_POLICY",
    });

    expect(suppressed.completedAt?.getTime()).toBe(completedAt.getTime());

    const persisted = await db.analyticsDispatch.findUniqueOrThrow({
      where: {
        id: dispatchId,
      },
    });

    expect(persisted).toMatchObject({
      id: dispatchId,
      analyticsEventId: eventId,
      provider: "meta",
      channel: "capi",
      status: "SUPPRESSED",
      attemptCount: 1,
      nextAttemptAt: null,
      providerEventId: null,
      lastErrorCode: "MATCHING_DATA_POLICY_NOT_AUTHORIZED",
      lastErrorClass: "PRIVACY_POLICY",
    });

    expect(persisted.completedAt?.getTime()).toBe(completedAt.getTime());

    await expect(
      dispatches.claimDue({
        provider: "meta",
        channel: "capi",
        attemptedAt: new Date(completedAt.getTime() + 60_000),
      }),
    ).resolves.toBeNull();

    await expect(
      dispatches.markSucceeded({
        dispatchId,
        providerEventId: `meta-${randomUUID()}`,
        completedAt: new Date(completedAt.getTime() + 120_000),
      }),
    ).rejects.toThrow("ANALYTICS_DISPATCH_TRANSITION_CONFLICT");

    const terminal = await db.analyticsDispatch.findUniqueOrThrow({
      where: {
        id: dispatchId,
      },
    });

    expect(terminal).toMatchObject({
      status: "SUPPRESSED",
      attemptCount: 1,
      nextAttemptAt: null,
      lastErrorCode: "MATCHING_DATA_POLICY_NOT_AUTHORIZED",
      lastErrorClass: "PRIVACY_POLICY",
    });
  });
  it("requires PROCESSING before a terminal failure transition and prevents a second terminal transition", async () => {
    const eventId = randomUUID();
    cleanup.events.add(eventId);

    await events.create({
      id: eventId,
      type: "VIEW_CONTENT",
      occurredAt: new Date(),
      journeyId: null,
      productId: null,
      offerId: null,
      orderId: null,
      amountMinor: null,
      currency: null,
      attributionState: "UNATTRIBUTED",
      consentSnapshot: {
        analytics: "GRANTED",
        advertising: "GRANTED",
        policyVersion: "p13-r2",
      },
      schemaVersion: 1,
      purchaseOrderKey: null,
    });

    const provider = `p13f-fail-${randomUUID().slice(0, 8)}`;

    const dispatchId = randomUUID();
    cleanup.dispatches.add(dispatchId);

    await dispatches.create({
      id: dispatchId,
      analyticsEventId: eventId,
      provider,
      channel: "server",
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: null,
      providerEventId: null,
      lastErrorCode: null,
      lastErrorClass: null,
      completedAt: null,
    });

    const completedAt = new Date();

    await expect(
      dispatches.markFailed({
        dispatchId,
        errorCode: "PERMANENT_PROVIDER_FAILURE",
        errorClass: "PERMANENT",
        completedAt,
      }),
    ).rejects.toThrow("ANALYTICS_DISPATCH_TRANSITION_CONFLICT");

    await expect(
      dispatches.claimDue({
        provider,
        channel: "server",
        attemptedAt: completedAt,
      }),
    ).resolves.not.toBeNull();

    const failed = await dispatches.markFailed({
      dispatchId,
      errorCode: "PERMANENT_PROVIDER_FAILURE",
      errorClass: "PERMANENT",
      completedAt,
    });

    expect(failed).toMatchObject({
      id: dispatchId,
      status: "FAILED",
      attemptCount: 1,
      lastErrorCode: "PERMANENT_PROVIDER_FAILURE",
      lastErrorClass: "PERMANENT",
      nextAttemptAt: null,
    });

    expect(failed.completedAt?.getTime()).toBe(completedAt.getTime());

    await expect(
      dispatches.markSucceeded({
        dispatchId,
        providerEventId: randomUUID(),
        completedAt: new Date(completedAt.getTime() + 1_000),
      }),
    ).rejects.toThrow("ANALYTICS_DISPATCH_TRANSITION_CONFLICT");
  });
  it("rejects an AnalyticsDispatch for an unknown AnalyticsEvent", async () => {
    const dispatchId = randomUUID();

    cleanup.dispatches.add(dispatchId);

    await expect(
      dispatches.create({
        id: dispatchId,
        analyticsEventId: randomUUID(),
        provider: "test-provider",
        channel: "server",
        status: "PENDING",
        attemptCount: 0,
        nextAttemptAt: null,
        lastAttemptAt: null,
        providerEventId: null,
        lastErrorCode: null,
        lastErrorClass: null,
        completedAt: null,
      }),
    ).rejects.toHaveProperty("code", "P2003");
  });

  it("persists explicit consent, supports withdrawal and rejects an expired Journey", async () => {
    const journeyId = randomUUID();
    const grantedAt = new Date(Date.now() + 60_000);
    const expiresAt = new Date(grantedAt.getTime() + 24 * 60 * 60 * 1_000);
    cleanup.journeys.add(journeyId);

    await journeys.createJourney({
      id: journeyId,
      expiresAt,
      analyticsConsentState: "UNKNOWN",
      advertisingConsentState: "UNKNOWN",
      policyVersion: "p13-architecture-freeze-r2",
    });

    await expect(
      journeys.updateConsent({
        journeyId,
        analyticsConsentState: "GRANTED",
        advertisingConsentState: "GRANTED",
        policyVersion: "p13-architecture-freeze-r2",
        observedAt: grantedAt,
      }),
    ).resolves.toMatchObject({
      id: journeyId,
      analyticsConsentState: "GRANTED",
      advertisingConsentState: "GRANTED",
      lastSeenAt: grantedAt,
    });

    const withdrawn = await journeys.updateConsent({
      journeyId,
      analyticsConsentState: "DENIED",
      advertisingConsentState: "DENIED",
      policyVersion: "p13-architecture-freeze-r2",
      observedAt: new Date(grantedAt.getTime() - 1_000),
    });

    expect(withdrawn).toMatchObject({
      analyticsConsentState: "DENIED",
      advertisingConsentState: "DENIED",
      lastSeenAt: grantedAt,
    });

    await expect(
      journeys.updateConsent({
        journeyId,
        analyticsConsentState: "GRANTED",
        advertisingConsentState: "DENIED",
        policyVersion: "p13-architecture-freeze-r2",
        observedAt: expiresAt,
      }),
    ).resolves.toBeNull();

    await expect(journeys.findJourney(journeyId)).resolves.toMatchObject({
      analyticsConsentState: "DENIED",
      advertisingConsentState: "DENIED",
      lastSeenAt: grantedAt,
    });
  });
});
