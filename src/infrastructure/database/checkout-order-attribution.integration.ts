import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { type CheckoutOrderRepository } from "../../modules/commerce/application/create-checkout-order";
import { type Order } from "../../modules/commerce/domain/order";
import { Money } from "../../shared/money";

import { createDatabaseClient } from "./client";
import { PrismaCheckoutOrderRepository } from "./prisma-checkout-order-repository";

type CreateInput = Parameters<CheckoutOrderRepository["create"]>[0];

const DAY_MS = 24 * 60 * 60 * 1_000;

const productId = randomUUID();
const offerId = randomUUID();

const cleanup = {
  customers: new Set<string>(),
  orders: new Set<string>(),
  items: new Set<string>(),
  journeys: new Set<string>(),
  touches: new Set<string>(),
};

let database: ReturnType<typeof createDatabaseClient>;

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;

  if (process.env.APP_ENV !== "test" || !raw) {
    throw new Error("P13-C requires APP_ENV=test and TEST_DATABASE_URL.");
  }

  const parsed = new URL(raw);

  const databaseName = decodeURIComponent(parsed.pathname.slice(1));

  if (
    parsed.protocol !== "mysql:" ||
    !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    parsed.port !== "3307" ||
    !["lessenc_test", "lessenc_test_rebuild"].includes(databaseName)
  ) {
    throw new Error("P13-C integration target is not an approved P06 test database.");
  }

  return raw;
}

function createInput(
  overrides: Readonly<{
    orderId?: string;
    itemId?: string;
    customerId?: string;
    email?: string;
  }> = {},
): CreateInput {
  const orderId = overrides.orderId ?? randomUUID();

  const itemId = overrides.itemId ?? randomUUID();

  const customerId = overrides.customerId ?? randomUUID();

  cleanup.orders.add(orderId);
  cleanup.items.add(itemId);
  cleanup.customers.add(customerId);

  const createdAt = new Date().toISOString();

  const order: Order = Object.freeze({
    id: orderId,
    customerId,
    status: "PENDING",

    items: Object.freeze([
      Object.freeze({
        id: itemId,
        orderId,
        productId,
        offerId,

        productNameSnapshot: "Cronograma Capilar Inteligente",

        productDescriptionSnapshot: "P13-C atomic OrderAttribution",

        unitPrice: Money.of(2990, "BRL"),

        quantity: 1,

        total: Money.of(2990, "BRL"),

        createdAt,
      }),
    ]),

    total: Money.of(2990, "BRL"),

    createdAt,
    updatedAt: createdAt,
    paidAt: null,
  });

  return Object.freeze({
    email: overrides.email ?? "p13c-order@example.invalid",

    order,
  });
}

async function createAttributedJourney(
  source: string,
  campaign: string,
): Promise<{
  journeyId: string;
  touchId: string;
}> {
  const journeyId = randomUUID();
  const touchId = randomUUID();

  cleanup.journeys.add(journeyId);
  cleanup.touches.add(touchId);

  const now = new Date();

  await database.acquisitionJourney.create({
    data: {
      id: journeyId,

      expiresAt: new Date(now.getTime() + DAY_MS),

      policyVersion: "p13-architecture-freeze-r2",
    },
  });

  await database.attributionTouch.create({
    data: {
      id: touchId,
      journeyId,

      occurredAt: new Date(now.getTime() - 1_000),

      source,
      medium: "cpc",
      campaign,
      content: "hero",
      term: "cronograma",

      referrerHost: null,

      landingPath: "/cronograma-capilar-inteligente",

      touchType: "CAMPAIGN",
    },
  });

  await database.acquisitionJourney.update({
    where: {
      id: journeyId,
    },

    data: {
      lastSeenAt: now,
      firstTouchId: touchId,
      lastTouchId: touchId,
    },
  });

  return {
    journeyId,
    touchId,
  };
}

async function createSnapshotIdCollision(snapshotId: string): Promise<void> {
  const customerId = randomUUID();
  const orderId = randomUUID();

  cleanup.customers.add(customerId);
  cleanup.orders.add(orderId);

  await database.customer.create({
    data: {
      id: customerId,
      email: `p13c-seed-${customerId}@example.invalid`,
    },
  });

  await database.order.create({
    data: {
      id: orderId,
      customerId,
      status: "PENDING",
      totalMinor: 2990,
      currency: "BRL",
    },
  });

  await database.orderAttribution.create({
    data: {
      id: snapshotId,
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
    },
  });
}

async function cleanupFixtures(): Promise<void> {
  const orderIds = [...cleanup.orders];

  const customerIds = [...cleanup.customers];

  const touchIds = [...cleanup.touches];

  const journeyIds = [...cleanup.journeys];

  if (orderIds.length > 0) {
    await database.orderAttribution.deleteMany({
      where: {
        orderId: {
          in: orderIds,
        },
      },
    });

    await database.orderItem.deleteMany({
      where: {
        orderId: {
          in: orderIds,
        },
      },
    });

    await database.order.deleteMany({
      where: {
        id: {
          in: orderIds,
        },
      },
    });
  }

  if (customerIds.length > 0) {
    await database.customer.deleteMany({
      where: {
        id: {
          in: customerIds,
        },
      },
    });
  }

  if (touchIds.length > 0) {
    await database.attributionTouch.deleteMany({
      where: {
        id: {
          in: touchIds,
        },
      },
    });
  }

  if (journeyIds.length > 0) {
    await database.acquisitionJourney.deleteMany({
      where: {
        id: {
          in: journeyIds,
        },
      },
    });
  }

  cleanup.customers.clear();
  cleanup.orders.clear();
  cleanup.items.clear();
  cleanup.journeys.clear();
  cleanup.touches.clear();
}

describe("P13-C atomic OrderAttribution on isolated MySQL", () => {
  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/p06-db-guard.mjs", "test"], {
      stdio: "pipe",
    });

    database = createDatabaseClient(guardedTestUrl());

    await database.$connect();

    await database.product.create({
      data: {
        id: productId,

        name: "P13-C Atomic Attribution Product",

        description: "P13-C isolated integration fixture",

        status: "ACTIVE",

        offers: {
          create: {
            id: offerId,
            priceMinor: 2990,
            currency: "BRL",
            isActive: true,
          },
        },
      },
    });
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();

    await database.offer.deleteMany({
      where: {
        id: offerId,
      },
    });

    await database.product.deleteMany({
      where: {
        id: productId,
      },
    });

    await database.$disconnect();
  });

  it("commits Order and attributed OrderAttribution together for a newly created Order", async () => {
    const acquisition = await createAttributedJourney("google", "atomic-created");

    const candidate = createInput();

    const repository = new PrismaCheckoutOrderRepository(database, {
      journeyId: acquisition.journeyId,
    });

    await expect(repository.create(candidate)).resolves.toEqual({
      state: "CREATED",
    });

    const persistedOrder = await database.order.findUnique({
      where: {
        id: candidate.order.id,
      },
    });

    const persistedItem = await database.orderItem.findUnique({
      where: {
        id: candidate.order.items[0]!.id,
      },
    });

    const snapshot = await database.orderAttribution.findUnique({
      where: {
        orderId: candidate.order.id,
      },
    });

    expect(persistedOrder).not.toBeNull();
    expect(persistedItem).not.toBeNull();

    expect(snapshot).toMatchObject({
      orderId: candidate.order.id,

      journeyId: acquisition.journeyId,

      firstTouchId: acquisition.touchId,

      lastTouchId: acquisition.touchId,

      firstSource: "google",
      firstMedium: "cpc",
      firstCampaign: "atomic-created",

      lastSource: "google",
      lastMedium: "cpc",
      lastCampaign: "atomic-created",
    });

    expect(snapshot?.capturedAt.toISOString()).toBe(candidate.order.createdAt);

    expect(
      await database.orderAttribution.count({
        where: {
          orderId: candidate.order.id,
        },
      }),
    ).toBe(1);
  });

  it("creates exactly one explicit unattributed snapshot when the checkout has no Journey", async () => {
    const candidate = createInput();

    const repository = new PrismaCheckoutOrderRepository(database, {
      journeyId: null,
    });

    await expect(repository.create(candidate)).resolves.toEqual({
      state: "CREATED",
    });

    const snapshot = await database.orderAttribution.findUnique({
      where: {
        orderId: candidate.order.id,
      },
    });

    expect(snapshot).toMatchObject({
      orderId: candidate.order.id,

      journeyId: null,
      firstTouchId: null,
      lastTouchId: null,

      firstSource: null,
      firstMedium: null,
      firstCampaign: null,

      lastSource: null,
      lastMedium: null,
      lastCampaign: null,
    });

    expect(
      await database.orderAttribution.count({
        where: {
          orderId: candidate.order.id,
        },
      }),
    ).toBe(1);
  });

  it("rolls back Customer, Order and OrderItem when OrderAttribution persistence fails", async () => {
    const duplicateSnapshotId = randomUUID();

    await createSnapshotIdCollision(duplicateSnapshotId);

    const candidate = createInput();

    const repository = new PrismaCheckoutOrderRepository(
      database,
      {
        journeyId: null,
      },
      () => duplicateSnapshotId,
    );

    await expect(repository.create(candidate)).rejects.toHaveProperty("code", "P2002");

    expect(
      await database.customer.findUnique({
        where: {
          id: candidate.order.customerId,
        },
      }),
    ).toBeNull();

    expect(
      await database.order.findUnique({
        where: {
          id: candidate.order.id,
        },
      }),
    ).toBeNull();

    expect(
      await database.orderItem.findUnique({
        where: {
          id: candidate.order.items[0]!.id,
        },
      }),
    ).toBeNull();

    expect(
      await database.orderAttribution.findUnique({
        where: {
          orderId: candidate.order.id,
        },
      }),
    ).toBeNull();

    expect(
      await database.orderAttribution.findUnique({
        where: {
          id: duplicateSnapshotId,
        },
      }),
    ).not.toBeNull();
  });

  it("returns EXISTING without rewriting attribution from a newer Journey", async () => {
    const firstJourney = await createAttributedJourney("google", "original-attribution");

    const newerJourney = await createAttributedJourney("meta", "must-not-rewrite");

    const first = createInput();

    const retry = createInput({
      orderId: first.order.id,
    });

    const firstRepository = new PrismaCheckoutOrderRepository(database, {
      journeyId: firstJourney.journeyId,
    });

    const retryRepository = new PrismaCheckoutOrderRepository(database, {
      journeyId: newerJourney.journeyId,
    });

    await expect(firstRepository.create(first)).resolves.toEqual({
      state: "CREATED",
    });

    const before = await database.orderAttribution.findUniqueOrThrow({
      where: {
        orderId: first.order.id,
      },
    });

    await expect(retryRepository.create(retry)).resolves.toEqual({
      state: "EXISTING",
    });

    const after = await database.orderAttribution.findUniqueOrThrow({
      where: {
        orderId: first.order.id,
      },
    });

    expect(after).toEqual(before);

    expect(after).toMatchObject({
      journeyId: firstJourney.journeyId,

      firstTouchId: firstJourney.touchId,

      lastTouchId: firstJourney.touchId,

      firstSource: "google",
      firstCampaign: "original-attribution",
    });

    expect(after.journeyId).not.toBe(newerJourney.journeyId);

    expect(
      await database.orderAttribution.count({
        where: {
          orderId: first.order.id,
        },
      }),
    ).toBe(1);
  });

  it("resolves concurrent retries as CREATED plus EXISTING with exactly one winner-owned attribution snapshot", async () => {
    const journeyA = await createAttributedJourney("google", "concurrent-a");

    const journeyB = await createAttributedJourney("meta", "concurrent-b");

    const first = createInput();

    const second = createInput({
      orderId: first.order.id,
    });

    const firstRepository = new PrismaCheckoutOrderRepository(database, {
      journeyId: journeyA.journeyId,
    });

    const secondRepository = new PrismaCheckoutOrderRepository(database, {
      journeyId: journeyB.journeyId,
    });

    const results = await Promise.all([
      firstRepository.create(first),
      secondRepository.create(second),
    ]);

    expect(results.map((result) => result.state).sort()).toEqual(["CREATED", "EXISTING"]);

    const firstWon = results[0]?.state === "CREATED";

    const winningJourney = firstWon ? journeyA : journeyB;

    const winningInput = firstWon ? first : second;

    const losingInput = firstWon ? second : first;

    const persistedOrder = await database.order.findUniqueOrThrow({
      where: {
        id: first.order.id,
      },
    });

    expect(persistedOrder.customerId).toBe(winningInput.order.customerId);

    expect(persistedOrder.customerId).not.toBe(losingInput.order.customerId);

    const snapshot = await database.orderAttribution.findUniqueOrThrow({
      where: {
        orderId: first.order.id,
      },
    });

    expect(snapshot).toMatchObject({
      journeyId: winningJourney.journeyId,

      firstTouchId: winningJourney.touchId,

      lastTouchId: winningJourney.touchId,
    });

    expect(
      await database.orderAttribution.count({
        where: {
          orderId: first.order.id,
        },
      }),
    ).toBe(1);

    expect(
      await database.orderItem.count({
        where: {
          orderId: first.order.id,
        },
      }),
    ).toBe(1);

    expect(
      await database.customer.count({
        where: {
          id: {
            in: [first.order.customerId, second.order.customerId],
          },
        },
      }),
    ).toBe(1);
  });
});
