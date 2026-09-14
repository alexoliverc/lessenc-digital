import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./client";
import { PrismaDigitalDeliveryAuditRepository } from "./prisma-digital-delivery-audit-repository";

let db: ReturnType<typeof createDatabaseClient>;

let repository: PrismaDigitalDeliveryAuditRepository;

type Fixture = {
  customerId: string;
  productId: string;
  offerId: string;
  orderId: string;
  orderItemId: string;
  entitlementId: string;
  resourceId: string;
  credentialId: string;
};

let fixture: Fixture;

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;

  if (process.env.APP_ENV !== "test" || !raw) {
    throw new Error("P11 C5 audit requires APP_ENV=test and TEST_DATABASE_URL");
  }

  const url = new URL(raw);

  if (
    url.protocol !== "mysql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "3307" ||
    !["/lessenc_test", "/lessenc_test_rebuild"].includes(url.pathname) ||
    !url.username ||
    !url.password
  ) {
    throw new Error("P11 C5 audit refused a non-isolated P06 test database");
  }

  return raw;
}

async function createFixture() {
  fixture = {
    customerId: randomUUID(),
    productId: randomUUID(),
    offerId: randomUUID(),
    orderId: randomUUID(),
    orderItemId: randomUUID(),
    entitlementId: randomUUID(),
    resourceId: randomUUID(),
    credentialId: randomUUID(),
  };

  await db.customer.create({
    data: {
      id: fixture.customerId,
      email: `${fixture.customerId}@example.invalid`,
    },
  });

  await db.product.create({
    data: {
      id: fixture.productId,
      name: `P11 C5 ${fixture.productId}`,
      status: "ACTIVE",
    },
  });

  await db.offer.create({
    data: {
      id: fixture.offerId,
      productId: fixture.productId,
      priceMinor: 2990,
      currency: "BRL",
      isActive: true,
    },
  });

  await db.order.create({
    data: {
      id: fixture.orderId,
      customerId: fixture.customerId,
      status: "PAID",
      totalMinor: 2990,
      currency: "BRL",
      paidAt: new Date("2026-09-13T10:00:00.000Z"),
    },
  });

  await db.orderItem.create({
    data: {
      id: fixture.orderItemId,
      orderId: fixture.orderId,
      productId: fixture.productId,
      offerId: fixture.offerId,
      productNameSnapshot: `P11 C5 ${fixture.productId}`,
      unitPriceMinor: 2990,
      quantity: 1,
      totalMinor: 2990,
      currency: "BRL",
    },
  });

  await db.entitlement.create({
    data: {
      id: fixture.entitlementId,
      orderItemId: fixture.orderItemId,
      status: "ACTIVE",
      activatedAt: new Date("2026-09-13T10:00:01.000Z"),
    },
  });

  await db.digitalResource.create({
    data: {
      id: fixture.resourceId,
      logicalKey: `p11-c5-${fixture.resourceId}`,
      version: 1,
      storageKey: `resources/${fixture.resourceId}/v1.bin`,
      filename: "lessenc-resource.pdf",
      mediaType: "application/pdf",
      status: "ACTIVE",
    },
  });

  await db.entitlementDigitalResource.create({
    data: {
      entitlementId: fixture.entitlementId,
      resourceId: fixture.resourceId,
    },
  });

  await db.buyerAccessCredential.create({
    data: {
      id: fixture.credentialId,
      orderId: fixture.orderId,
      secretHash: "b".repeat(64),
      status: "ACTIVE",
      activeOrderKey: fixture.orderId,
    },
  });
}

async function cleanupFixture() {
  if (!fixture) {
    return;
  }

  await db.digitalDeliveryEvent.deleteMany({
    where: {
      entitlementId: fixture.entitlementId,
    },
  });

  await db.buyerAccessCredential.deleteMany({
    where: {
      id: fixture.credentialId,
    },
  });

  await db.entitlementDigitalResource.deleteMany({
    where: {
      entitlementId: fixture.entitlementId,
    },
  });

  await db.entitlement.deleteMany({
    where: {
      id: fixture.entitlementId,
    },
  });

  await db.digitalResource.deleteMany({
    where: {
      id: fixture.resourceId,
    },
  });

  await db.orderItem.deleteMany({
    where: {
      id: fixture.orderItemId,
    },
  });

  await db.order.deleteMany({
    where: {
      id: fixture.orderId,
    },
  });

  await db.offer.deleteMany({
    where: {
      id: fixture.offerId,
    },
  });

  await db.product.deleteMany({
    where: {
      id: fixture.productId,
    },
  });

  await db.customer.deleteMany({
    where: {
      id: fixture.customerId,
    },
  });
}

describe("P11 C5 DigitalDeliveryEvent audit on isolated MySQL", () => {
  beforeAll(async () => {
    db = createDatabaseClient(guardedTestUrl());

    await db.$connect();

    repository = new PrismaDigitalDeliveryAuditRepository(db);
  });

  beforeEach(createFixture);

  afterEach(cleanupFixture);

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("persists a SUCCEEDED delivery event without a failure code", async () => {
    await repository.record({
      entitlementId: fixture.entitlementId,
      resourceId: fixture.resourceId,
      buyerAccessCredentialId: fixture.credentialId,
      outcome: "SUCCEEDED",
      failureCode: null,
    });

    const events = await db.digitalDeliveryEvent.findMany({
      where: {
        entitlementId: fixture.entitlementId,
      },
    });

    expect(events).toHaveLength(1);

    expect(events[0]).toMatchObject({
      entitlementId: fixture.entitlementId,
      resourceId: fixture.resourceId,
      buyerAccessCredentialId: fixture.credentialId,
      outcome: "SUCCEEDED",
      failureCode: null,
    });
  });

  it("persists a FAILED delivery event with a bounded internal failure code", async () => {
    await repository.record({
      entitlementId: fixture.entitlementId,
      resourceId: fixture.resourceId,
      buyerAccessCredentialId: fixture.credentialId,
      outcome: "FAILED",
      failureCode: "RESOURCE_NOT_FOUND",
    });

    const event = await db.digitalDeliveryEvent.findFirstOrThrow({
      where: {
        entitlementId: fixture.entitlementId,
      },
    });

    expect(event).toMatchObject({
      outcome: "FAILED",
      failureCode: "RESOURCE_NOT_FOUND",
    });
  });

  it("keeps delivery audit append-only across multiple attempts", async () => {
    await repository.record({
      entitlementId: fixture.entitlementId,
      resourceId: fixture.resourceId,
      buyerAccessCredentialId: fixture.credentialId,
      outcome: "FAILED",
      failureCode: "STREAM_FAILED",
    });

    await repository.record({
      entitlementId: fixture.entitlementId,
      resourceId: fixture.resourceId,
      buyerAccessCredentialId: fixture.credentialId,
      outcome: "SUCCEEDED",
      failureCode: null,
    });

    await expect(
      db.digitalDeliveryEvent.count({
        where: {
          entitlementId: fixture.entitlementId,
        },
      }),
    ).resolves.toBe(2);
  });

  it("fails closed when audit identifiers do not satisfy the persisted FK boundary", async () => {
    await expect(
      repository.record({
        entitlementId: fixture.entitlementId,
        resourceId: fixture.resourceId,
        buyerAccessCredentialId: randomUUID(),
        outcome: "SUCCEEDED",
        failureCode: null,
      }),
    ).rejects.toBeDefined();

    await expect(
      db.digitalDeliveryEvent.count({
        where: {
          entitlementId: fixture.entitlementId,
        },
      }),
    ).resolves.toBe(0);
  });
});
