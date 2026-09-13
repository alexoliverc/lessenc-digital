import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type CheckoutOrderRepository } from "../../modules/commerce/application/create-checkout-order";
import { type Order } from "../../modules/commerce/domain/order";
import { Money } from "../../shared/money";
import { createDatabaseClient } from "./client";
import { PrismaCheckoutOrderRepository } from "./prisma-checkout-order-repository";

type CreateInput = Parameters<CheckoutOrderRepository["create"]>[0];

const productId = randomUUID();
const offerId = randomUUID();

const createdAt = "2026-09-13T03:00:00.000Z";

const cleanup = {
  customers: new Set<string>(),
  orders: new Set<string>(),
  items: new Set<string>(),
};

let database: ReturnType<typeof createDatabaseClient>;

let repository: PrismaCheckoutOrderRepository;

function createInput(
  overrides: Readonly<{
    orderId?: string;
    itemId?: string;
    customerId?: string;
    email?: string;
    productId?: string;
    offerId?: string;
  }> = {},
): CreateInput {
  const orderId = overrides.orderId ?? randomUUID();

  const itemId = overrides.itemId ?? randomUUID();

  const customerId = overrides.customerId ?? randomUUID();

  cleanup.orders.add(orderId);
  cleanup.items.add(itemId);
  cleanup.customers.add(customerId);

  const itemProductId = overrides.productId ?? productId;

  const itemOfferId = overrides.offerId ?? offerId;

  const order: Order = Object.freeze({
    id: orderId,
    customerId,
    status: "PENDING",
    items: Object.freeze([
      Object.freeze({
        id: itemId,
        orderId,
        productId: itemProductId,
        offerId: itemOfferId,
        productNameSnapshot: "Cronograma Capilar Inteligente",
        productDescriptionSnapshot: "Descrição P09.7",
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
    email: overrides.email ?? "p09-buyer@example.invalid",
    order,
  });
}

function requireFirstOrderItem(order: Order): Order["items"][number] {
  const item = order.items[0];

  if (!item) {
    throw new Error("checkout fixture item missing");
  }

  return item;
}

async function expectSingleRetryPersistence(
  first: CreateInput,
  second: CreateInput,
): Promise<string> {
  const orderId = first.order.id;
  const firstItemId = requireFirstOrderItem(first.order).id;
  const secondItemId = requireFirstOrderItem(second.order).id;

  expect(second.order.id).toBe(orderId);
  expect(second.order.customerId).not.toBe(first.order.customerId);
  expect(secondItemId).not.toBe(firstItemId);

  const stored = await database.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { customer: true, items: true },
  });
  const winner = stored.customerId === first.order.customerId ? first : second;
  const loser = winner === first ? second : first;

  expect(stored.customerId).toBe(winner.order.customerId);
  expect(stored.customer.id).toBe(winner.order.customerId);
  expect(stored.customer.email).toBe(winner.email);
  expect(stored.items).toHaveLength(1);
  expect(stored.items[0]?.id).toBe(requireFirstOrderItem(winner.order).id);

  expect(await database.order.count({ where: { id: orderId } })).toBe(1);
  expect(await database.orderItem.count({ where: { orderId } })).toBe(1);
  expect(
    await database.customer.count({
      where: { id: { in: [first.order.customerId, second.order.customerId] } },
    }),
  ).toBe(1);
  expect(await database.customer.count({ where: { id: loser.order.customerId } })).toBe(0);
  expect(
    await database.orderItem.count({ where: { id: requireFirstOrderItem(loser.order).id } }),
  ).toBe(0);
  expect(await database.payment.count({ where: { orderId } })).toBe(0);
  expect(
    await database.entitlement.count({
      where: { orderItemId: { in: [firstItemId, secondItemId] } },
    }),
  ).toBe(0);
  expect(await database.outboxEvent.count({ where: { orderId } })).toBe(0);

  return winner.order.customerId;
}

describe("P09 checkout-order adapter on isolated MySQL", () => {
  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/p06-db-guard.mjs", "test"], {
      stdio: "pipe",
    });

    database = createDatabaseClient(process.env.TEST_DATABASE_URL!);

    await database.$connect();

    await database.product.create({
      data: {
        id: productId,
        name: "Cronograma Capilar Inteligente",
        description: "Descrição P09.7",
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

    repository = new PrismaCheckoutOrderRepository(database);
  });

  afterAll(async () => {
    if (!database) {
      return;
    }

    try {
      const orderIds = [...cleanup.orders];

      const itemIds = [...cleanup.items];

      const customerIds = [...cleanup.customers];

      if (itemIds.length > 0) {
        await database.entitlement.deleteMany({
          where: {
            orderItemId: {
              in: itemIds,
            },
          },
        });
      }

      if (orderIds.length > 0) {
        await database.outboxEvent.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });

        await database.payment.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });
      }

      if (itemIds.length > 0) {
        await database.orderItem.deleteMany({
          where: {
            id: {
              in: itemIds,
            },
          },
        });
      }

      if (orderIds.length > 0) {
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

      expect(
        await database.order.count({
          where: {
            id: {
              in: orderIds,
            },
          },
        }),
      ).toBe(0);

      expect(
        await database.customer.count({
          where: {
            id: {
              in: customerIds,
            },
          },
        }),
      ).toBe(0);

      expect(
        await database.product.count({
          where: {
            id: productId,
          },
        }),
      ).toBe(0);
    } finally {
      await database.$disconnect();
    }
  });

  it("atomically creates one Customer, Order and OrderItem", async () => {
    const candidate = createInput();

    await expect(repository.create(candidate)).resolves.toEqual({
      state: "CREATED",
    });

    await expect(
      database.customer.count({
        where: {
          id: candidate.order.customerId,
        },
      }),
    ).resolves.toBe(1);

    await expect(
      database.order.count({
        where: {
          id: candidate.order.id,
        },
      }),
    ).resolves.toBe(1);

    await expect(
      database.orderItem.count({
        where: {
          id: requireFirstOrderItem(candidate.order).id,
        },
      }),
    ).resolves.toBe(1);

    const stored = await database.order.findUniqueOrThrow({
      where: {
        id: candidate.order.id,
      },
      include: {
        customer: true,
        items: true,
      },
    });

    expect(stored).toMatchObject({
      id: candidate.order.id,
      customerId: candidate.order.customerId,
      status: "PENDING",
      totalMinor: 2990,
      currency: "BRL",
      paidAt: null,
      customer: {
        email: candidate.email,
      },
      items: [
        {
          productId,
          offerId,
          productNameSnapshot: "Cronograma Capilar Inteligente",
          productDescriptionSnapshot: "Descrição P09.7",
          unitPriceMinor: 2990,
          quantity: 1,
          totalMinor: 2990,
          currency: "BRL",
        },
      ],
    });
  });

  it("returns EXISTING for a sequential retry without duplicating persistence", async () => {
    const first = createInput();
    const second = createInput({ orderId: first.order.id });

    await expect(repository.create(first)).resolves.toEqual({
      state: "CREATED",
    });

    await expect(repository.create(second)).resolves.toEqual({
      state: "EXISTING",
    });

    expect(await expectSingleRetryPersistence(first, second)).toBe(first.order.customerId);
  });

  it("resolves two concurrent logical retries as CREATED plus EXISTING", async () => {
    const first = createInput();
    const second = createInput({ orderId: first.order.id });

    const results = await Promise.all([repository.create(first), repository.create(second)]);

    expect(results.map((result) => result.state).sort()).toEqual(["CREATED", "EXISTING"]);
    const winnerCustomerId = await expectSingleRetryPersistence(first, second);
    expect(winnerCustomerId).toBe(
      results[0]?.state === "CREATED" ? first.order.customerId : second.order.customerId,
    );
  });

  it("rolls back Customer and Order when OrderItem persistence fails", async () => {
    const candidate = createInput({
      productId: randomUUID(),
    });

    await expect(repository.create(candidate)).rejects.toHaveProperty("code", "P2003");

    expect(
      await database.customer.count({
        where: {
          id: candidate.order.customerId,
        },
      }),
    ).toBe(0);

    expect(
      await database.order.count({
        where: {
          id: candidate.order.id,
        },
      }),
    ).toBe(0);

    expect(
      await database.orderItem.count({
        where: {
          orderId: candidate.order.id,
        },
      }),
    ).toBe(0);
  });

  it("returns CONFLICT and rolls back the losing Customer for incompatible reuse of Order.id", async () => {
    const original = createInput();

    await expect(repository.create(original)).resolves.toEqual({
      state: "CREATED",
    });

    const conflictingCustomerId = randomUUID();

    const conflicting = createInput({
      orderId: original.order.id,
      itemId: randomUUID(),
      customerId: conflictingCustomerId,
      email: "different-buyer@example.invalid",
    });

    await expect(repository.create(conflicting)).resolves.toEqual({
      state: "CONFLICT",
    });

    expect(
      await database.customer.count({
        where: {
          id: conflictingCustomerId,
        },
      }),
    ).toBe(0);

    const stored = await database.order.findUniqueOrThrow({
      where: {
        id: original.order.id,
      },
    });

    expect(stored.customerId).toBe(original.order.customerId);

    expect(
      await database.order.count({
        where: {
          id: original.order.id,
        },
      }),
    ).toBe(1);

    expect(
      await database.orderItem.count({
        where: {
          orderId: original.order.id,
        },
      }),
    ).toBe(1);
  });

  it("allows the same email on independent checkout Customers", async () => {
    const sharedEmail = "shared-buyer@example.invalid";

    const first = createInput({
      email: sharedEmail,
    });

    const second = createInput({
      email: sharedEmail,
    });

    await expect(repository.create(first)).resolves.toEqual({
      state: "CREATED",
    });

    await expect(repository.create(second)).resolves.toEqual({
      state: "CREATED",
    });

    expect(
      await database.customer.count({
        where: {
          email: sharedEmail,
        },
      }),
    ).toBeGreaterThanOrEqual(2);

    expect(first.order.customerId).not.toBe(second.order.customerId);
  });

  it("creates no Payment, Entitlement or OutboxEvent during P09 order creation", async () => {
    const candidate = createInput();

    await expect(repository.create(candidate)).resolves.toEqual({
      state: "CREATED",
    });

    const item = candidate.order.items[0];

    if (!item) {
      throw new Error("checkout fixture item missing");
    }

    expect(
      await database.payment.count({
        where: {
          orderId: candidate.order.id,
        },
      }),
    ).toBe(0);

    expect(
      await database.entitlement.count({
        where: {
          orderItemId: item.id,
        },
      }),
    ).toBe(0);

    expect(
      await database.outboxEvent.count({
        where: {
          orderId: candidate.order.id,
        },
      }),
    ).toBe(0);
  });
});
