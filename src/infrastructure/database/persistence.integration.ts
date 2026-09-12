import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./client";

let database: ReturnType<typeof createDatabaseClient>;
const created = { product: "", offer: "", customer: "", order: "", item: "" };

function testDatabaseUrl() {
  const raw = process.env.TEST_DATABASE_URL;
  if (process.env.APP_ENV !== "test" || !raw) {
    throw new Error("Persistence integration tests require APP_ENV=test and TEST_DATABASE_URL");
  }
  const url = new URL(raw);
  if (
    url.protocol !== "mysql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "3307" ||
    !["/lessenc_test", "/lessenc_test_rebuild"].includes(url.pathname) ||
    !url.username ||
    !url.password
  ) {
    throw new Error("Persistence integration tests refuse a non-P06 test database");
  }
  return raw;
}

describe("P06 persistence on isolated MySQL", () => {
  beforeAll(async () => {
    database = createDatabaseClient(testDatabaseUrl());
    await database.$connect();
    created.product = (
      await database.product.create({
        data: {
          name: "Produto de teste P06",
          description: "Descrição de teste P06",
          status: "ACTIVE",
        },
      })
    ).id;
    created.offer = (
      await database.offer.create({
        data: { productId: created.product, priceMinor: 2990, currency: "BRL", isActive: true },
      })
    ).id;
    created.customer = (
      await database.customer.create({
        data: { email: "p06-buyer@example.invalid" },
      })
    ).id;
    created.order = (
      await database.order.create({
        data: { customerId: created.customer, totalMinor: 2990, currency: "BRL" },
      })
    ).id;
    created.item = (
      await database.orderItem.create({
        data: {
          orderId: created.order,
          productId: created.product,
          offerId: created.offer,
          productNameSnapshot: "Produto de teste P06",
          productDescriptionSnapshot: "Descrição de teste P06",
          unitPriceMinor: 2990,
          quantity: 1,
          totalMinor: 2990,
          currency: "BRL",
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (!database) return;
    try {
      if (created.item)
        await database.entitlement.deleteMany({ where: { orderItemId: created.item } });
      if (created.order)
        await database.outboxEvent.deleteMany({ where: { orderId: created.order } });
      if (created.order) await database.payment.deleteMany({ where: { orderId: created.order } });
      if (created.item) await database.orderItem.deleteMany({ where: { id: created.item } });
      if (created.order) await database.order.deleteMany({ where: { id: created.order } });
      if (created.offer) await database.offer.deleteMany({ where: { id: created.offer } });
      if (created.customer) await database.customer.deleteMany({ where: { id: created.customer } });
      if (created.product) await database.product.deleteMany({ where: { id: created.product } });
    } finally {
      await database.$disconnect();
    }
  });

  it("connects and reads the isolated database", async () => {
    await expect(database.product.count({ where: { id: created.product } })).resolves.toBe(1);
  });

  it("preserves item money and product snapshots when an offer changes", async () => {
    await database.offer.update({ where: { id: created.offer }, data: { priceMinor: 3990 } });
    await database.product.update({
      where: { id: created.product },
      data: { description: "Nova descrição" },
    });
    const item = await database.orderItem.findUniqueOrThrow({ where: { id: created.item } });
    expect(item.unitPriceMinor).toBe(2990);
    expect(item.totalMinor).toBe(2990);
    expect(item.currency).toBe("BRL");
    expect(item.productNameSnapshot).toBe("Produto de teste P06");
    expect(item.productDescriptionSnapshot).toBe("Descrição de teste P06");
  });

  it("enforces one entitlement per order item", async () => {
    await database.entitlement.create({ data: { orderItemId: created.item } });
    await expect(
      database.entitlement.create({ data: { orderItemId: created.item } }),
    ).rejects.toHaveProperty("code", "P2002");
  });

  it("rejects an orphan item and negative money", async () => {
    await expect(
      database.orderItem.create({
        data: {
          orderId: randomUUID(),
          productId: created.product,
          offerId: created.offer,
          productNameSnapshot: "Órfão",
          productDescriptionSnapshot: "Descrição de teste P06",
          unitPriceMinor: 2990,
          quantity: 1,
          totalMinor: 2990,
          currency: "BRL",
        },
      }),
    ).rejects.toHaveProperty("code", "P2003");
    await expect(
      database.offer.create({
        data: { productId: created.product, priceMinor: -1, currency: "BRL" },
      }),
    ).rejects.toThrow();
  });

  it("rolls back payment and outbox records together", async () => {
    let paymentId = "";
    let outboxId = "";
    await expect(
      database.$transaction(async (transaction) => {
        paymentId = (
          await transaction.payment.create({
            data: { orderId: created.order, amountMinor: 2990, currency: "BRL" },
          })
        ).id;
        outboxId = (
          await transaction.outboxEvent.create({
            data: {
              orderId: created.order,
              type: "ORDER_PAID",
              deduplicationKey: randomUUID(),
              payload: {},
            },
          })
        ).id;
        throw new Error("intentional transaction rollback");
      }),
    ).rejects.toThrow("intentional transaction rollback");
    expect(paymentId).not.toBe("");
    expect(outboxId).not.toBe("");
    await expect(database.payment.count({ where: { id: paymentId } })).resolves.toBe(0);
    await expect(database.outboxEvent.count({ where: { id: outboxId } })).resolves.toBe(0);
  });
});
