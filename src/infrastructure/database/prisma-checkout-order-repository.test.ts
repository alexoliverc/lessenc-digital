import { describe, expect, it } from "vitest";

import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { type CheckoutOrderRepository } from "../../modules/commerce/application/create-checkout-order";
import { type Order } from "../../modules/commerce/domain/order";
import { Money } from "../../shared/money";
import { PrismaCheckoutOrderRepository } from "./prisma-checkout-order-repository";

const orderId = "123e4567-e89b-12d3-a456-426614174000";

const itemId = "123e4567-e89b-12d3-a456-426614174001";

const customerId = "123e4567-e89b-12d3-a456-426614174002";

const productId = "123e4567-e89b-12d3-a456-426614174003";

const offerId = "123e4567-e89b-12d3-a456-426614174004";

const email = "Alex.Sales@example.com";

const instant = "2026-09-13T02:00:00.000Z";

type CreateInput = Parameters<CheckoutOrderRepository["create"]>[0];

type ExistingOrder = Readonly<{
  id: string;
  totalMinor: number;
  currency: string;
  customer: Readonly<{
    email: string;
  }>;
  items: readonly Readonly<{
    productId: string;
    offerId: string;
    productNameSnapshot: string;
    productDescriptionSnapshot: string | null;
    unitPriceMinor: number;
    quantity: number;
    totalMinor: number;
    currency: string;
  }>[];
}>;

type Call = Readonly<{
  model: "customer" | "order" | "orderItem";
  data: unknown;
}>;

function order(): Order {
  return Object.freeze({
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
        productDescriptionSnapshot: "Um método prático para organizar os cuidados capilares.",
        unitPrice: Money.of(2990, "BRL"),
        quantity: 1,
        total: Money.of(2990, "BRL"),
        createdAt: instant,
      }),
    ]),
    total: Money.of(2990, "BRL"),
    createdAt: instant,
    updatedAt: instant,
    paidAt: null,
  });
}

function input(): CreateInput {
  return {
    email,
    order: order(),
  };
}

function compatibleExisting(): ExistingOrder {
  return {
    id: orderId,
    totalMinor: 2990,
    currency: "BRL",
    customer: {
      email,
    },
    items: [
      {
        productId,
        offerId,
        productNameSnapshot: "Cronograma Capilar Inteligente",
        productDescriptionSnapshot: "Um método prático para organizar os cuidados capilares.",
        unitPriceMinor: 2990,
        quantity: 1,
        totalMinor: 2990,
        currency: "BRL",
      },
    ],
  };
}

function uniqueError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("sensitive unique constraint details", {
    code: "P2002",
    clientVersion: "7.10.0",
  });
}

function fakeDatabase(
  options?: Readonly<{
    transactionError?: unknown;
    existing?: ExistingOrder | null;
  }>,
) {
  const calls: Call[] = [];

  const transaction = {
    customer: {
      create: async (args: { data: unknown }) => {
        calls.push({
          model: "customer",
          data: args.data,
        });

        return {};
      },
    },

    order: {
      create: async (args: { data: unknown }) => {
        calls.push({
          model: "order",
          data: args.data,
        });

        return {};
      },
    },

    orderItem: {
      create: async (args: { data: unknown }) => {
        calls.push({
          model: "orderItem",
          data: args.data,
        });

        return {};
      },
    },
  };

  const database = {
    $transaction: async (callback: (transactionClient: typeof transaction) => Promise<unknown>) => {
      if (options?.transactionError) {
        throw options.transactionError;
      }

      return callback(transaction);
    },

    order: {
      findUnique: async () => options?.existing ?? null,
    },
  } as unknown as PrismaClient;

  return {
    database,
    calls,
  };
}

describe("PrismaCheckoutOrderRepository", () => {
  it("creates Customer, Order and OrderItem in one transaction", async () => {
    const fixture = fakeDatabase();

    const repository = new PrismaCheckoutOrderRepository(fixture.database);

    await expect(repository.create(input())).resolves.toEqual({
      state: "CREATED",
    });

    expect(fixture.calls.map((call) => call.model)).toEqual(["customer", "order", "orderItem"]);
  });

  it("maps authoritative order values into persistence data", async () => {
    const fixture = fakeDatabase();

    const repository = new PrismaCheckoutOrderRepository(fixture.database);

    await repository.create(input());

    expect(fixture.calls[0]).toEqual({
      model: "customer",
      data: {
        id: customerId,
        email,
      },
    });

    expect(fixture.calls[1]).toEqual({
      model: "order",
      data: {
        id: orderId,
        customerId,
        status: "PENDING",
        totalMinor: 2990,
        currency: "BRL",
        createdAt: new Date(instant),
        updatedAt: new Date(instant),
        paidAt: null,
      },
    });

    expect(fixture.calls[2]).toEqual({
      model: "orderItem",
      data: {
        id: itemId,
        orderId,
        productId,
        offerId,
        productNameSnapshot: "Cronograma Capilar Inteligente",
        productDescriptionSnapshot: "Um método prático para organizar os cuidados capilares.",
        unitPriceMinor: 2990,
        quantity: 1,
        totalMinor: 2990,
        currency: "BRL",
        createdAt: new Date(instant),
      },
    });
  });

  it("returns EXISTING when P2002 corresponds to the same logical Order", async () => {
    const fixture = fakeDatabase({
      transactionError: uniqueError(),
      existing: compatibleExisting(),
    });

    const repository = new PrismaCheckoutOrderRepository(fixture.database);

    await expect(repository.create(input())).resolves.toEqual({
      state: "EXISTING",
    });
  });

  it("returns CONFLICT when the existing Order has a different buyer email", async () => {
    const existing = compatibleExisting();

    const fixture = fakeDatabase({
      transactionError: uniqueError(),
      existing: {
        ...existing,
        customer: {
          email: "different@example.com",
        },
      },
    });

    const repository = new PrismaCheckoutOrderRepository(fixture.database);

    await expect(repository.create(input())).resolves.toEqual({
      state: "CONFLICT",
    });
  });

  it("returns CONFLICT when authoritative commercial snapshot differs", async () => {
    const existing = compatibleExisting();
    const existingItem = existing.items[0];

    if (!existingItem) {
      throw new Error("compatible fixture item missing");
    }

    const fixture = fakeDatabase({
      transactionError: uniqueError(),
      existing: {
        ...existing,
        totalMinor: 3990,
        items: [
          {
            ...existingItem,
            unitPriceMinor: 3990,
            totalMinor: 3990,
          },
        ],
      },
    });

    const repository = new PrismaCheckoutOrderRepository(fixture.database);

    await expect(repository.create(input())).resolves.toEqual({
      state: "CONFLICT",
    });
  });

  it("rethrows P2002 when the intended Order does not exist", async () => {
    const error = uniqueError();

    const fixture = fakeDatabase({
      transactionError: error,
      existing: null,
    });

    const repository = new PrismaCheckoutOrderRepository(fixture.database);

    await expect(repository.create(input())).rejects.toBe(error);
  });

  it("does not classify unrelated Prisma failures as idempotency", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("sensitive foreign key details", {
      code: "P2003",
      clientVersion: "7.10.0",
    });

    const fixture = fakeDatabase({
      transactionError: error,
      existing: compatibleExisting(),
    });

    const repository = new PrismaCheckoutOrderRepository(fixture.database);

    await expect(repository.create(input())).rejects.toBe(error);
  });

  it("does not mask programming defects", async () => {
    const defect = new TypeError("defect");

    const fixture = fakeDatabase({
      transactionError: defect,
      existing: compatibleExisting(),
    });

    const repository = new PrismaCheckoutOrderRepository(fixture.database);

    await expect(repository.create(input())).rejects.toBe(defect);
  });
});
