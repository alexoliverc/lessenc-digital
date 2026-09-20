import { NextRequest } from "next/server";

import { AuthorizeDigitalResource } from "../../modules/entitlements/application/authorize-digital-resource";
import { createProtectedDownloadHandler } from "../../app/api/buyer-access/resources/[resourceId]/handler";
import { PrismaEntitlementRevocationRepository } from "./prisma-entitlement-revocation-repository";
import { PrismaResourceAuthorizationRepository } from "./prisma-resource-authorization-repository";
import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ProviderSnapshot } from "../../modules/payments/application/payment-provider";
import { createDatabaseClient } from "./client";
import { PrismaEntitlementGrantRepository } from "./prisma-entitlement-grant-repository";
import { PrismaPaymentRepository } from "./prisma-payment-repository";

let db: ReturnType<typeof createDatabaseClient>;
let repo: PrismaEntitlementGrantRepository;

type Fixture = {
  productIds: string[];
  offerIds: string[];
  customerId: string;
  orderId: string;
  itemIds: string[];
  paymentId: string;
  eventId: string;
  resourceIds: string[];
};

let fixture: Fixture;

function firstItemId(): string {
  const id = fixture.itemIds[0];
  if (!id) throw new Error("P11 fixture has no order item");
  return id;
}

function firstProductId(): string {
  const id = fixture.productIds[0];
  if (!id) throw new Error("P11 fixture has no product");
  return id;
}

function firstResourceId(): string {
  const id = fixture.resourceIds[0];
  if (!id) throw new Error("P11 fixture has no resource");
  return id;
}

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;
  if (process.env.APP_ENV !== "test" || !raw) {
    throw new Error("P11 requires APP_ENV=test and TEST_DATABASE_URL");
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
    throw new Error("P11 refused a non-isolated P06 test database");
  }
  return raw;
}

async function addResource(productId: string, active = true): Promise<string> {
  const id = randomUUID();
  fixture.resourceIds.push(id);
  await db.digitalResource.create({
    data: {
      id,
      logicalKey: `p11-${id}`,
      storageKey: `p11-fixtures/${id}`,
      filename: `${id}.pdf`,
      mediaType: "application/pdf",
      status: active ? "ACTIVE" : "INACTIVE",
    },
  });
  await db.productDigitalResource.create({ data: { productId, resourceId: id } });
  return id;
}

async function addItem(priceMinor = 2990): Promise<{ productId: string; itemId: string }> {
  const productId = randomUUID();
  const offerId = randomUUID();
  const itemId = randomUUID();
  fixture.productIds.push(productId);
  fixture.offerIds.push(offerId);
  fixture.itemIds.push(itemId);
  await db.product.create({ data: { id: productId, name: `P11 ${productId}`, status: "ACTIVE" } });
  await db.offer.create({
    data: { id: offerId, productId, priceMinor, currency: "BRL", isActive: true },
  });
  await db.orderItem.create({
    data: {
      id: itemId,
      orderId: fixture.orderId,
      productId,
      offerId,
      productNameSnapshot: `P11 ${productId}`,
      unitPriceMinor: priceMinor,
      quantity: 1,
      totalMinor: priceMinor,
      currency: "BRL",
    },
  });
  return { productId, itemId };
}

async function createFixture(): Promise<void> {
  fixture = {
    productIds: [],
    offerIds: [],
    customerId: randomUUID(),
    orderId: randomUUID(),
    itemIds: [],
    paymentId: randomUUID(),
    eventId: randomUUID(),
    resourceIds: [],
  };
  await db.customer.create({
    data: { id: fixture.customerId, email: `${fixture.customerId}@example.invalid` },
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
  const { productId } = await addItem();
  await addResource(productId);
  await db.payment.create({
    data: {
      id: fixture.paymentId,
      orderId: fixture.orderId,
      status: "APPROVED",
      amountMinor: 2990,
      currency: "BRL",
      approvedAt: new Date("2026-09-13T10:00:00.000Z"),
    },
  });
  await db.outboxEvent.create({
    data: {
      id: fixture.eventId,
      orderId: fixture.orderId,
      type: "PAYMENT_APPROVED",
      status: "PENDING",
      deduplicationKey: `p11-payment-approved:${fixture.eventId}`,
      payload: { version: 1, orderId: fixture.orderId, paymentId: fixture.paymentId },
    },
  });
}

async function cleanupFixture(): Promise<void> {
  if (!fixture) return;
  const { orderId, itemIds, productIds, offerIds, customerId, resourceIds } = fixture;
  const entitlements = await db.entitlement.findMany({
    where: { orderItemId: { in: itemIds } },
    select: { id: true },
  });
  const entitlementIds = entitlements.map(({ id }) => id);
  await db.digitalDeliveryEvent.deleteMany({ where: { entitlementId: { in: entitlementIds } } });
  await db.entitlementDigitalResource.deleteMany({
    where: { entitlementId: { in: entitlementIds } },
  });
  await db.buyerAccessCredential.deleteMany({ where: { orderId } });
  await db.entitlement.deleteMany({ where: { id: { in: entitlementIds } } });
  await db.productDigitalResource.deleteMany({ where: { productId: { in: productIds } } });
  await db.digitalResource.deleteMany({ where: { id: { in: resourceIds } } });
  await db.outboxEvent.deleteMany({ where: { orderId } });
  await db.paymentEvent.deleteMany({ where: { payment: { orderId } } });
  await db.payment.deleteMany({ where: { orderId } });
  await db.orderItem.deleteMany({ where: { id: { in: itemIds } } });
  await db.order.deleteMany({ where: { id: orderId } });
  await db.customer.deleteMany({ where: { id: customerId } });
  await db.offer.deleteMany({ where: { id: { in: offerIds } } });
  await db.product.deleteMany({ where: { id: { in: productIds } } });
}

async function expectNoGrant(): Promise<void> {
  expect(await db.entitlement.count({ where: { orderItemId: { in: fixture.itemIds } } })).toBe(0);
  expect(
    await db.entitlementDigitalResource.count({
      where: { entitlement: { orderItemId: { in: fixture.itemIds } } },
    }),
  ).toBe(0);
  const event = await db.outboxEvent.findUniqueOrThrow({ where: { id: fixture.eventId } });
  expect(event.status).toBe("PENDING");
  expect(event.processedAt).toBeNull();
}

describe("P11 entitlement grant on isolated MySQL", () => {
  beforeAll(async () => {
    db = createDatabaseClient(guardedTestUrl());
    await db.$connect();
    repo = new PrismaEntitlementGrantRepository(db);
  });
  beforeEach(createFixture);
  afterEach(cleanupFixture);
  afterAll(async () => {
    await db?.$disconnect();
  });

  it("grants the active mapped resource and marks the outbox only after persistence", async () => {
    expect(await repo.processPaymentApproved(fixture.eventId)).toBe("PROCESSED");
    const entitlements = await db.entitlement.findMany({
      where: { orderItemId: firstItemId() },
      include: { resources: true },
    });
    expect(entitlements).toHaveLength(1);
    const entitlement = entitlements[0];
    if (!entitlement) throw new Error("P11 grant was not persisted");
    expect(entitlement).toMatchObject({
      orderItemId: firstItemId(),
      sourceOutboxEventId: fixture.eventId,
      status: "ACTIVE",
    });
    expect(entitlement.activatedAt).toBeInstanceOf(Date);
    expect(entitlement.resources.map((grant) => grant.resourceId)).toEqual(fixture.resourceIds);
    const event = await db.outboxEvent.findUniqueOrThrow({ where: { id: fixture.eventId } });
    expect(event.status).toBe("PROCESSED");
    expect(event.processedAt).toBeInstanceOf(Date);
  });

  it("replays an already processed event without changing entitlement or grant IDs", async () => {
    expect(await repo.processPaymentApproved(fixture.eventId)).toBe("PROCESSED");
    const before = await db.entitlement.findUniqueOrThrow({
      where: { orderItemId: firstItemId() },
      include: { resources: true },
    });
    const processedAt = (await db.outboxEvent.findUniqueOrThrow({ where: { id: fixture.eventId } }))
      .processedAt;
    expect(await repo.processPaymentApproved(fixture.eventId)).toBe("NOOP");
    const after = await db.entitlement.findUniqueOrThrow({
      where: { orderItemId: firstItemId() },
      include: { resources: true },
    });
    expect(after.id).toBe(before.id);
    expect(after.resources).toEqual(before.resources);
    expect(await db.entitlement.count({ where: { orderItemId: firstItemId() } })).toBe(1);
    expect(
      (await db.outboxEvent.findUniqueOrThrow({ where: { id: fixture.eventId } })).processedAt,
    ).toEqual(processedAt);
  });

  it("serializes concurrent consumers of the same approval", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => repo.processPaymentApproved(fixture.eventId)),
    );
    expect(results.filter((result) => result === "PROCESSED")).toHaveLength(1);
    expect(results.filter((result) => result === "NOOP")).toHaveLength(3);
    expect(await db.entitlement.count({ where: { orderItemId: firstItemId() } })).toBe(1);
    expect(
      await db.entitlementDigitalResource.count({
        where: { entitlement: { orderItemId: firstItemId() } },
      }),
    ).toBe(1);
  });

  it("consumes the real PAYMENT_APPROVED event persisted by P10", async () => {
    // Remove the manually prepared financial state used by the isolated C2 fixtures.
    await db.outboxEvent.deleteMany({
      where: { orderId: fixture.orderId },
    });
    await db.payment.deleteMany({
      where: { orderId: fixture.orderId },
    });
    await db.order.update({
      where: { id: fixture.orderId },
      data: {
        status: "PENDING",
        paidAt: null,
      },
    });

    const paymentRepository = new PrismaPaymentRepository(db);

    const { attempt } = await paymentRepository.reserve(fixture.orderId, "PIX");

    const observation: ProviderSnapshot = {
      providerOrderId: `ORD${randomUUID().replaceAll("-", "")}`,
      providerPaymentId: `PAY${randomUUID().replaceAll("-", "")}`,
      providerAccountId: null,
      externalReference: fixture.orderId,
      amountMinor: 2990,
      paymentAmountMinor: 2990,
      currency: "BRL",
      paymentMethod: "PIX",
      paidAmountMinor: 2990,
      refundedAmountMinor: null,
      status: "APPROVED",
      requiresReview: false,
      reviewReason: null,
      providerStatus: "processed",
      providerStatusDetail: "accredited",
      occurredAt: "2026-09-13T10:00:00Z",
      createdAt: "2026-09-13T09:59:00Z",
      presentation: null,
    };

    expect(
      await paymentRepository.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: observation,
        source: "CREATE_RESPONSE",
      }),
    ).toBe("APPLIED");

    const payment = await db.payment.findUniqueOrThrow({
      where: { id: attempt.paymentId },
    });

    expect(payment.status).toBe("APPROVED");

    const order = await db.order.findUniqueOrThrow({
      where: { id: fixture.orderId },
    });

    expect(order.status).toBe("PAID");
    expect(order.paidAt).toBeInstanceOf(Date);

    const events = await db.outboxEvent.findMany({
      where: {
        orderId: fixture.orderId,
        type: "PAYMENT_APPROVED",
      },
    });

    expect(events).toHaveLength(1);

    const event = events[0];

    if (!event) {
      throw new Error("P10 PAYMENT_APPROVED event was not persisted");
    }

    expect(event.status).toBe("PENDING");
    expect(event.deduplicationKey).toBe(`payment-approved:${attempt.paymentId}`);
    expect(event.payload).toEqual({
      version: 1,
      orderId: fixture.orderId,
      paymentId: attempt.paymentId,
    });

    expect(await repo.processPaymentApproved(event.id)).toBe("PROCESSED");

    const entitlement = await db.entitlement.findUniqueOrThrow({
      where: {
        orderItemId: firstItemId(),
      },
      include: {
        resources: true,
      },
    });

    expect(entitlement.status).toBe("ACTIVE");
    expect(entitlement.sourceOutboxEventId).toBe(event.id);
    expect(entitlement.resources.map((grant) => grant.resourceId)).toEqual([firstResourceId()]);

    const processedEvent = await db.outboxEvent.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(processedEvent.status).toBe("PROCESSED");
    expect(processedEvent.processedAt).toBeInstanceOf(Date);
  });

  it.each([
    ["wrong version", { version: 2 }],
    ["wrong order", { orderId: randomUUID() }],
    ["missing payment", { paymentId: randomUUID() }],
  ])("rejects tampered payload: %s", async (_label, override) => {
    await db.outboxEvent.update({
      where: { id: fixture.eventId },
      data: {
        payload: {
          version: 1,
          orderId: fixture.orderId,
          paymentId: fixture.paymentId,
          ...override,
        },
      },
    });
    await expect(repo.processPaymentApproved(fixture.eventId)).rejects.toThrow();
    await expectNoGrant();
  });

  it("refuses an outbox event of another type", async () => {
    await db.outboxEvent.update({
      where: { id: fixture.eventId },
      data: { type: "ORDER_PAID" },
    });
    await expect(repo.processPaymentApproved(fixture.eventId)).rejects.toThrow(
      "OUTBOX_EVENT_TYPE_UNSUPPORTED",
    );
    await expectNoGrant();
  });

  it.each([
    ["order", "PENDING"],
    ["payment", "PENDING"],
  ] as const)("rejects invalid financial state: %s", async (target, status) => {
    if (target === "order") {
      await db.order.update({
        where: { id: fixture.orderId },
        data: { status, paidAt: null },
      });
    } else {
      await db.payment.update({
        where: { id: fixture.paymentId },
        data: { status, approvedAt: null },
      });
    }
    await expect(repo.processPaymentApproved(fixture.eventId)).rejects.toThrow();
    await expectNoGrant();
  });

  it("rolls back the entitlement when the product has no active resource mapping", async () => {
    await db.productDigitalResource.deleteMany({ where: { productId: firstProductId() } });
    await expect(repo.processPaymentApproved(fixture.eventId)).rejects.toThrow(
      "ENTITLEMENT_RESOURCE_MAPPING_MISSING",
    );
    await expectNoGrant();
  });

  it("keeps an immutable grant snapshot when the product mapping later changes", async () => {
    const second = await addResource(firstProductId());
    const inactive = await addResource(firstProductId(), false);
    expect(await repo.processPaymentApproved(fixture.eventId)).toBe("PROCESSED");
    const entitlement = await db.entitlement.findUniqueOrThrow({
      where: { orderItemId: firstItemId() },
      include: { resources: true },
    });
    expect(entitlement.resources.map((grant) => grant.resourceId).sort()).toEqual(
      [firstResourceId(), second].sort(),
    );
    expect(entitlement.resources.map((grant) => grant.resourceId)).not.toContain(inactive);
    const third = await addResource(firstProductId());

    expect(await repo.processPaymentApproved(fixture.eventId)).toBe("NOOP");

    const after = await db.entitlementDigitalResource.findMany({
      where: { entitlementId: entitlement.id },
      orderBy: { resourceId: "asc" },
    });

    expect(after).toEqual(
      [...entitlement.resources].sort((a, b) => a.resourceId.localeCompare(b.resourceId)),
    );

    expect(after.map((grant) => grant.resourceId)).not.toContain(third);
  });

  it("rejects a persisted grant set that conflicts with the current mapping", async () => {
    const wrongResource = await addResource(firstProductId());
    await db.productDigitalResource.delete({
      where: {
        productId_resourceId: { productId: firstProductId(), resourceId: wrongResource },
      },
    });
    const existing = await db.entitlement.create({
      data: {
        orderItemId: firstItemId(),
        sourceOutboxEventId: fixture.eventId,
        status: "PENDING",
      },
    });
    await db.entitlementDigitalResource.create({
      data: { entitlementId: existing.id, resourceId: wrongResource },
    });
    await expect(repo.processPaymentApproved(fixture.eventId)).rejects.toThrow(
      "ENTITLEMENT_RESOURCE_GRANT_CONFLICT",
    );
    const after = await db.entitlement.findUniqueOrThrow({ where: { id: existing.id } });
    expect(after.status).toBe("PENDING");
    expect(after.activatedAt).toBeNull();
    expect(
      await db.entitlementDigitalResource.findMany({ where: { entitlementId: existing.id } }),
    ).toHaveLength(1);
    expect(
      (await db.outboxEvent.findUniqueOrThrow({ where: { id: fixture.eventId } })).status,
    ).toBe("PENDING");
  });

  it("consumes a delayed approval after a matching full refund without granting access", async () => {
    await db.order.update({ where: { id: fixture.orderId }, data: { status: "REFUNDED" } });
    await db.payment.update({ where: { id: fixture.paymentId }, data: { status: "REFUNDED" } });
    expect(await repo.processPaymentApproved(fixture.eventId)).toBe("NOOP");
    expect(await db.entitlement.count({ where: { orderItemId: firstItemId() } })).toBe(0);
    expect(
      await db.entitlementDigitalResource.count({
        where: { entitlement: { orderItemId: { in: fixture.itemIds } } },
      }),
    ).toBe(0);
    const event = await db.outboxEvent.findUniqueOrThrow({ where: { id: fixture.eventId } });
    expect(event.status).toBe("PROCESSED");
    expect(event.processedAt).toBeInstanceOf(Date);
  });

  it("grants every item in a valid multi-item order", async () => {
    const second = await addItem(1490);
    const secondResource = await addResource(second.productId);
    await db.order.update({ where: { id: fixture.orderId }, data: { totalMinor: 4480 } });
    await db.payment.update({ where: { id: fixture.paymentId }, data: { amountMinor: 4480 } });
    expect(await repo.processPaymentApproved(fixture.eventId)).toBe("PROCESSED");
    const grants = await db.entitlement.findMany({
      where: { orderItemId: { in: fixture.itemIds } },
      include: { resources: true },
    });
    expect(grants).toHaveLength(2);
    expect(grants.every((grant) => grant.status === "ACTIVE")).toBe(true);
    expect(
      Object.fromEntries(
        grants.map((grant) => [grant.orderItemId, grant.resources[0]?.resourceId]),
      ),
    ).toEqual({ [firstItemId()]: firstResourceId(), [second.itemId]: secondResource });
  });

  it("rolls back all items when the later item has no resource mapping", async () => {
    await addItem(1490);
    await db.order.update({ where: { id: fixture.orderId }, data: { totalMinor: 4480 } });
    await db.payment.update({ where: { id: fixture.paymentId }, data: { amountMinor: 4480 } });
    await expect(repo.processPaymentApproved(fixture.eventId)).rejects.toThrow(
      "ENTITLEMENT_RESOURCE_MAPPING_MISSING",
    );
    await expectNoGrant();
  });

  // P11 C6.1 refund revocation vertical integration

  async function establishRealP10ApprovedPurchase() {
    await db.outboxEvent.deleteMany({
      where: {
        orderId: fixture.orderId,
      },
    });

    await db.payment.deleteMany({
      where: {
        orderId: fixture.orderId,
      },
    });

    await db.order.update({
      where: {
        id: fixture.orderId,
      },
      data: {
        status: "PENDING",
        paidAt: null,
      },
    });

    const paymentRepository = new PrismaPaymentRepository(db);

    const { attempt } = await paymentRepository.reserve(fixture.orderId, "PIX");

    const approved: ProviderSnapshot = {
      providerOrderId: `ORD${randomUUID().replaceAll("-", "")}`,
      providerPaymentId: `PAY${randomUUID().replaceAll("-", "")}`,
      providerAccountId: null,
      externalReference: fixture.orderId,
      amountMinor: 2990,
      paymentAmountMinor: 2990,
      currency: "BRL",
      paymentMethod: "PIX",
      paidAmountMinor: 2990,
      refundedAmountMinor: null,
      status: "APPROVED",
      requiresReview: false,
      reviewReason: null,
      providerStatus: "processed",
      providerStatusDetail: "accredited",
      occurredAt: "2026-09-13T10:00:00Z",
      createdAt: "2026-09-13T09:59:00Z",
      presentation: null,
    };

    expect(
      await paymentRepository.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: approved,
        source: "CREATE_RESPONSE",
      }),
    ).toBe("APPLIED");

    const approvalEvent = await db.outboxEvent.findFirstOrThrow({
      where: {
        orderId: fixture.orderId,
        type: "PAYMENT_APPROVED",
      },
    });

    expect(approvalEvent.payload).toEqual({
      version: 1,
      orderId: fixture.orderId,
      paymentId: attempt.paymentId,
    });

    return {
      paymentRepository,
      attempt,
      approved,
      approvalEvent,
    };
  }

  async function activateRealP10Purchase() {
    const established = await establishRealP10ApprovedPurchase();

    expect(await repo.processPaymentApproved(established.approvalEvent.id)).toBe("PROCESSED");

    const entitlement = await db.entitlement.findUniqueOrThrow({
      where: {
        orderItemId: firstItemId(),
      },
      include: {
        resources: {
          orderBy: {
            resourceId: "asc",
          },
        },
      },
    });

    expect(entitlement.status).toBe("ACTIVE");

    return {
      ...established,
      entitlement,
    };
  }

  async function persistRealP10FullRefund(
    context: Awaited<ReturnType<typeof establishRealP10ApprovedPurchase>>,
  ) {
    const refunded: ProviderSnapshot = {
      ...context.approved,
      status: "REFUNDED",
      providerStatus: "refunded",
      providerStatusDetail: "refunded",
      paidAmountMinor: 2990,
      refundedAmountMinor: 2990,
      occurredAt: "2026-09-13T11:00:00Z",
    };

    expect(
      await context.paymentRepository.applyObservation({
        paymentId: context.attempt.paymentId,
        snapshot: refunded,
        source: "WEBHOOK",
      }),
    ).toBe("APPLIED");

    const refundEvent = await db.outboxEvent.findFirstOrThrow({
      where: {
        orderId: fixture.orderId,
        type: "REFUND_COMPLETED",
      },
    });

    expect(refundEvent.status).toBe("PENDING");

    expect(refundEvent.deduplicationKey).toBe(`refund-completed:${context.attempt.paymentId}`);

    expect(refundEvent.payload).toEqual({
      version: 1,
      orderId: fixture.orderId,
      paymentId: context.attempt.paymentId,
    });

    return refundEvent;
  }

  it("revokes an ACTIVE entitlement from the real P10 REFUND_COMPLETED event and preserves historical grants", async () => {
    const active = await activateRealP10Purchase();

    const before = await db.entitlement.findUniqueOrThrow({
      where: {
        id: active.entitlement.id,
      },
      include: {
        resources: {
          orderBy: {
            resourceId: "asc",
          },
        },
      },
    });

    const refundEvent = await persistRealP10FullRefund(active);

    const revocation = new PrismaEntitlementRevocationRepository(db);

    expect(await revocation.processRefundCompleted(refundEvent.id)).toBe("PROCESSED");

    const after = await db.entitlement.findUniqueOrThrow({
      where: {
        id: active.entitlement.id,
      },
      include: {
        resources: {
          orderBy: {
            resourceId: "asc",
          },
        },
      },
    });

    expect(after.status).toBe("REVOKED");

    expect(after.activatedAt).toEqual(before.activatedAt);

    expect(after.revokedAt).toBeInstanceOf(Date);

    expect(after.sourceOutboxEventId).toBe(active.approvalEvent.id);

    expect(after.resources.map((grant) => grant.resourceId)).toEqual(
      before.resources.map((grant) => grant.resourceId),
    );

    const processedRefund = await db.outboxEvent.findUniqueOrThrow({
      where: {
        id: refundEvent.id,
      },
    });

    expect(processedRefund.status).toBe("PROCESSED");

    expect(processedRefund.processedAt).toBeInstanceOf(Date);
  });

  it("is idempotent when the same REFUND_COMPLETED event is replayed", async () => {
    const active = await activateRealP10Purchase();

    const refundEvent = await persistRealP10FullRefund(active);

    const revocation = new PrismaEntitlementRevocationRepository(db);

    expect(await revocation.processRefundCompleted(refundEvent.id)).toBe("PROCESSED");

    const first = await db.entitlement.findUniqueOrThrow({
      where: {
        id: active.entitlement.id,
      },
    });

    expect(await revocation.processRefundCompleted(refundEvent.id)).toBe("NOOP");

    const replay = await db.entitlement.findUniqueOrThrow({
      where: {
        id: active.entitlement.id,
      },
    });

    expect(replay.status).toBe("REVOKED");

    expect(replay.revokedAt).toEqual(first.revokedAt);

    expect(replay.sourceOutboxEventId).toBe(active.approvalEvent.id);
  });

  it("serializes concurrent REFUND_COMPLETED consumers into one PROCESSED and one NOOP", async () => {
    const active = await activateRealP10Purchase();

    const refundEvent = await persistRealP10FullRefund(active);

    const firstConsumer = new PrismaEntitlementRevocationRepository(db);

    const secondConsumer = new PrismaEntitlementRevocationRepository(db);

    const results = await Promise.all([
      firstConsumer.processRefundCompleted(refundEvent.id),
      secondConsumer.processRefundCompleted(refundEvent.id),
    ]);

    expect([...results].sort()).toEqual(["NOOP", "PROCESSED"]);

    const entitlement = await db.entitlement.findUniqueOrThrow({
      where: {
        id: active.entitlement.id,
      },
    });

    expect(entitlement.status).toBe("REVOKED");
  });

  it("rejects a tampered REFUND_COMPLETED payload without revoking the entitlement", async () => {
    const active = await activateRealP10Purchase();

    const refundEvent = await persistRealP10FullRefund(active);

    await db.outboxEvent.update({
      where: {
        id: refundEvent.id,
      },
      data: {
        payload: {
          version: 2,
          orderId: fixture.orderId,
          paymentId: active.attempt.paymentId,
        },
      },
    });

    const revocation = new PrismaEntitlementRevocationRepository(db);

    await expect(revocation.processRefundCompleted(refundEvent.id)).rejects.toThrow(
      "INVALID_REFUND_COMPLETED_PAYLOAD",
    );

    const event = await db.outboxEvent.findUniqueOrThrow({
      where: {
        id: refundEvent.id,
      },
    });

    const entitlement = await db.entitlement.findUniqueOrThrow({
      where: {
        id: active.entitlement.id,
      },
    });

    expect(event.status).toBe("PENDING");

    expect(entitlement.status).toBe("ACTIVE");
  });

  it("rejects an invalid authoritative financial origin atomically", async () => {
    const active = await activateRealP10Purchase();

    const refundEvent = await persistRealP10FullRefund(active);

    await db.payment.update({
      where: {
        id: active.attempt.paymentId,
      },
      data: {
        amountMinor: 4480,
      },
    });

    const revocation = new PrismaEntitlementRevocationRepository(db);

    await expect(revocation.processRefundCompleted(refundEvent.id)).rejects.toThrow(
      "ENTITLEMENT_REFUND_FINANCIAL_ORIGIN_INVALID",
    );

    const event = await db.outboxEvent.findUniqueOrThrow({
      where: {
        id: refundEvent.id,
      },
    });

    const entitlement = await db.entitlement.findUniqueOrThrow({
      where: {
        id: active.entitlement.id,
      },
    });

    expect(event.status).toBe("PENDING");

    expect(event.processedAt).toBeNull();

    expect(entitlement.status).toBe("ACTIVE");
  });

  it("processes refund before grant without inventing an entitlement and later approval remains a NOOP", async () => {
    const approved = await establishRealP10ApprovedPurchase();

    const refundEvent = await persistRealP10FullRefund(approved);

    const revocation = new PrismaEntitlementRevocationRepository(db);

    expect(await revocation.processRefundCompleted(refundEvent.id)).toBe("PROCESSED");

    expect(
      await db.entitlement.count({
        where: {
          orderItem: {
            orderId: fixture.orderId,
          },
        },
      }),
    ).toBe(0);

    expect(await repo.processPaymentApproved(approved.approvalEvent.id)).toBe("NOOP");

    expect(
      await db.entitlement.count({
        where: {
          orderItem: {
            orderId: fixture.orderId,
          },
        },
      }),
    ).toBe(0);
  });

  it("C7 final gate denies protected download after the real full refund while preserving grant and credential", async () => {
    const active = await activateRealP10Purchase();

    expect(active.entitlement.status).toBe("ACTIVE");

    const grantedResourceIds = active.entitlement.resources.map((grant) => grant.resourceId);

    expect(grantedResourceIds).toContain(firstResourceId());

    const order = await db.order.findUniqueOrThrow({
      where: {
        id: fixture.orderId,
      },
    });

    const credentialId = randomUUID();

    const secretHash = randomUUID().replaceAll("-", "").repeat(2);

    await db.buyerAccessCredential.create({
      data: {
        id: credentialId,
        orderId: fixture.orderId,
        secretHash,
        status: "ACTIVE",
        activeOrderKey: fixture.orderId,
      },
    });

    try {
      const authorization = new AuthorizeDigitalResource(
        new PrismaResourceAuthorizationRepository(db),
      );

      const subject = {
        customerId: order.customerId,
        orderId: fixture.orderId,
        credentialId,
      };

      const credentialBeforeRefund = await db.buyerAccessCredential.findUniqueOrThrow({
        where: {
          id: credentialId,
        },
      });

      expect(credentialBeforeRefund.status).toBe("ACTIVE");
      expect(credentialBeforeRefund.revokedAt).toBeNull();

      await expect(authorization.execute(subject, firstResourceId())).resolves.toMatchObject({
        resourceId: firstResourceId(),
        entitlementId: active.entitlement.id,
      });

      expect(
        await db.digitalDeliveryEvent.count({
          where: {
            buyerAccessCredentialId: credentialId,
          },
        }),
      ).toBe(0);

      const refundEvent = await persistRealP10FullRefund(active);

      expect(refundEvent.type).toBe("REFUND_COMPLETED");

      expect(refundEvent.payload).toEqual({
        version: 1,
        orderId: fixture.orderId,
        paymentId: active.attempt.paymentId,
      });

      const revocation = new PrismaEntitlementRevocationRepository(db);

      expect(await revocation.processRefundCompleted(refundEvent.id)).toBe("PROCESSED");

      const processedRefund = await db.outboxEvent.findUniqueOrThrow({
        where: {
          id: refundEvent.id,
        },
      });

      expect(processedRefund.status).toBe("PROCESSED");

      const revoked = await db.entitlement.findUniqueOrThrow({
        where: {
          id: active.entitlement.id,
        },
        include: {
          resources: {
            orderBy: {
              resourceId: "asc",
            },
          },
        },
      });

      expect(revoked.status).toBe("REVOKED");
      expect(revoked.revokedAt).toBeInstanceOf(Date);
      expect(revoked.resources.map((grant) => grant.resourceId)).toEqual(grantedResourceIds);

      const credentialAfterRefund = await db.buyerAccessCredential.findUniqueOrThrow({
        where: {
          id: credentialId,
        },
      });

      expect(credentialAfterRefund.status).toBe("ACTIVE");
      expect(credentialAfterRefund.activeOrderKey).toBe(fixture.orderId);
      expect(credentialAfterRefund.revokedAt).toBeNull();

      await expect(authorization.execute(subject, firstResourceId())).rejects.toThrow(
        "RESOURCE_NOT_AVAILABLE",
      );

      let protectedDeliveryStageReached = false;
      let succeededCalls = 0;
      let streamFailedCalls = 0;

      const handler = createProtectedDownloadHandler({
        validateSession: {
          execute: async () => subject,
        },
        prepareDelivery: {
          execute: async (validatedSubject, resourceId) => {
            const authorized = await authorization.execute(validatedSubject, resourceId);

            protectedDeliveryStageReached = true;

            throw new Error(`C7_PROTECTED_DELIVERY_SHOULD_NOT_BE_REACHED:${authorized.resourceId}`);
          },
        },
        recordOutcome: {
          succeeded: async () => {
            succeededCalls += 1;
          },
          streamFailed: async () => {
            streamFailedCalls += 1;
          },
        },
        appEnv: "production",
      });

      const request = new NextRequest(
        `https://lessenc.example/api/buyer-access/resources/${firstResourceId()}`,
        {
          method: "GET",
          headers: {
            cookie: "__Host-lessenc_buyer=c7-final-gate-session",
          },
        },
      );

      const response = await handler(request, firstResourceId());

      expect(response.status).toBe(404);

      await expect(response.json()).resolves.toEqual({
        error: "RESOURCE_NOT_AVAILABLE",
      });

      expect(protectedDeliveryStageReached).toBe(false);
      expect(succeededCalls).toBe(0);
      expect(streamFailedCalls).toBe(0);

      expect(
        await db.digitalDeliveryEvent.count({
          where: {
            buyerAccessCredentialId: credentialId,
          },
        }),
      ).toBe(0);

      const revokedAtBeforeReplay = revoked.revokedAt;

      expect(await revocation.processRefundCompleted(refundEvent.id)).toBe("NOOP");

      const replayed = await db.entitlement.findUniqueOrThrow({
        where: {
          id: active.entitlement.id,
        },
        include: {
          resources: {
            orderBy: {
              resourceId: "asc",
            },
          },
        },
      });

      expect(replayed.status).toBe("REVOKED");
      expect(replayed.revokedAt).toEqual(revokedAtBeforeReplay);
      expect(replayed.resources.map((grant) => grant.resourceId)).toEqual(grantedResourceIds);

      const credentialAfterReplay = await db.buyerAccessCredential.findUniqueOrThrow({
        where: {
          id: credentialId,
        },
      });

      expect(credentialAfterReplay.status).toBe("ACTIVE");
      expect(credentialAfterReplay.revokedAt).toBeNull();
    } finally {
      await db.digitalDeliveryEvent.deleteMany({
        where: {
          buyerAccessCredentialId: credentialId,
        },
      });

      await db.buyerAccessCredential.deleteMany({
        where: {
          id: credentialId,
        },
      });
    }
  });
});
