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
