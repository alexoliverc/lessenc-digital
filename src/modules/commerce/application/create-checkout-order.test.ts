import { describe, expect, it } from "vitest";

import { type Clock } from "../../../shared/clock";
import { Money } from "../../../shared/money";
import {
  type CatalogRepository,
  ResolvePurchasableOffer,
} from "../../catalog/application/resolve-purchasable-offer";
import { type CatalogOffer } from "../../catalog/domain/catalog";
import {
  type CheckoutOrderPersistenceResult,
  type CheckoutOrderRepository,
  CreateCheckoutOrder,
} from "./create-checkout-order";
import { PrepareOrder } from "./prepare-order";

const orderId = "123e4567-e89b-12d3-a456-426614174000";

const itemId = "123e4567-e89b-12d3-a456-426614174001";

const customerId = "123e4567-e89b-12d3-a456-426614174002";

const productId = "123e4567-e89b-12d3-a456-426614174003";

const offerId = "123e4567-e89b-12d3-a456-426614174004";

const email = "Alex.Sales@example.com";

const now = "2026-09-13T01:30:00.000Z";

class FixedClock implements Clock {
  now(): Date {
    return new Date(now);
  }
}

class FakeCatalogRepository implements CatalogRepository {
  constructor(private readonly selected: CatalogOffer | null) {}

  async findOffer(requestedOfferId: string): Promise<CatalogOffer | null> {
    if (!this.selected || this.selected.offer.id !== requestedOfferId) {
      return null;
    }

    return this.selected;
  }
}

class RecordingCheckoutOrderRepository implements CheckoutOrderRepository {
  readonly calls: Array<{
    email: string;
    order: Parameters<CheckoutOrderRepository["create"]>[0]["order"];
  }> = [];

  constructor(private readonly result: CheckoutOrderPersistenceResult) {}

  async create(
    input: Parameters<CheckoutOrderRepository["create"]>[0],
  ): Promise<CheckoutOrderPersistenceResult> {
    this.calls.push({
      email: input.email,
      order: input.order,
    });

    return this.result;
  }
}

class ThrowingCheckoutOrderRepository implements CheckoutOrderRepository {
  async create(): Promise<CheckoutOrderPersistenceResult> {
    throw new Error("database socket exploded");
  }
}

function catalogOffer(amountMinor = 2990): CatalogOffer {
  return Object.freeze({
    product: Object.freeze({
      id: productId,
      name: "Cronograma Capilar Inteligente",
      description: "Um método prático para organizar os cuidados capilares.",
      status: "ACTIVE" as const,
    }),
    offer: Object.freeze({
      id: offerId,
      productId,
      price: Money.of(amountMinor, "BRL"),
      isActive: true,
    }),
  });
}

function createPrepareOrder(selected: CatalogOffer | null = catalogOffer()): PrepareOrder {
  return new PrepareOrder(
    new ResolvePurchasableOffer(new FakeCatalogRepository(selected)),
    new FixedClock(),
  );
}

function validInput() {
  return {
    orderId,
    itemId,
    customerId,
    productId,
    offerId,
    email,
    presentedAmountMinor: 2990,
    presentedCurrency: "BRL",
  };
}

describe("CreateCheckoutOrder", () => {
  it("prepares and persists an authoritative PENDING order", async () => {
    const repository = new RecordingCheckoutOrderRepository({
      state: "CREATED",
    });

    const useCase = new CreateCheckoutOrder(createPrepareOrder(), repository);

    const result = await useCase.execute(validInput());

    expect(result).toEqual({
      ok: true,
      value: {
        state: "CREATED",
      },
    });

    expect(repository.calls).toHaveLength(1);

    const persisted = repository.calls[0];

    expect(persisted).toBeDefined();

    if (!persisted) {
      throw new Error("persistence call missing");
    }

    expect(persisted.email).toBe(email);

    expect(persisted.order).toMatchObject({
      id: orderId,
      customerId,
      status: "PENDING",
      paidAt: null,
      createdAt: now,
      updatedAt: now,
      total: {
        amountMinor: 2990,
        currency: "BRL",
      },
    });

    expect(persisted.order.items).toHaveLength(1);

    expect(persisted.order.items[0]).toMatchObject({
      id: itemId,
      orderId,
      productId,
      offerId,
      productNameSnapshot: "Cronograma Capilar Inteligente",
      productDescriptionSnapshot: "Um método prático para organizar os cuidados capilares.",
      quantity: 1,
      unitPrice: {
        amountMinor: 2990,
        currency: "BRL",
      },
      total: {
        amountMinor: 2990,
        currency: "BRL",
      },
      createdAt: now,
    });
  });

  it("ignores extra caller price and quantity fields and keeps P07 authority", async () => {
    const repository = new RecordingCheckoutOrderRepository({
      state: "CREATED",
    });

    const useCase = new CreateCheckoutOrder(createPrepareOrder(), repository);

    const browserLikeInput = {
      ...validInput(),
      price: 1,
      total: 1,
      quantity: 99,
      currency: "USD",
      status: "PAID",
    };

    const result = await useCase.execute(browserLikeInput);

    expect(result.ok).toBe(true);

    const persisted = repository.calls[0];

    expect(persisted).toBeDefined();

    if (!persisted) {
      throw new Error("persistence call missing");
    }

    expect(persisted.order.status).toBe("PENDING");

    expect(persisted.order.total).toEqual(Money.of(2990, "BRL"));

    expect(persisted.order.items[0]?.quantity).toBe(1);

    expect(persisted.order.items[0]?.unitPrice).toEqual(Money.of(2990, "BRL"));
  });

  it("returns PRICE_CHANGED without persistence when the authoritative amount changed", async () => {
    const repository = new RecordingCheckoutOrderRepository({
      state: "CREATED",
    });

    const useCase = new CreateCheckoutOrder(createPrepareOrder(catalogOffer(3990)), repository);

    const result = await useCase.execute(validInput());

    expect(result).toEqual({
      ok: true,
      value: {
        state: "PRICE_CHANGED",
      },
    });

    expect(repository.calls).toHaveLength(0);
  });

  it("returns PRICE_CHANGED without persistence when the presented currency differs", async () => {
    const repository = new RecordingCheckoutOrderRepository({
      state: "CREATED",
    });

    const useCase = new CreateCheckoutOrder(createPrepareOrder(), repository);

    const result = await useCase.execute({
      ...validInput(),
      presentedCurrency: "USD",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        state: "PRICE_CHANGED",
      },
    });

    expect(repository.calls).toHaveLength(0);
  });
  it("preserves EXISTING from the repository", async () => {
    const repository = new RecordingCheckoutOrderRepository({
      state: "EXISTING",
    });

    const useCase = new CreateCheckoutOrder(createPrepareOrder(), repository);

    await expect(useCase.execute(validInput())).resolves.toEqual({
      ok: true,
      value: {
        state: "EXISTING",
      },
    });
  });

  it("preserves CONFLICT as a typed persistence outcome", async () => {
    const repository = new RecordingCheckoutOrderRepository({
      state: "CONFLICT",
    });

    const useCase = new CreateCheckoutOrder(createPrepareOrder(), repository);

    await expect(useCase.execute(validInput())).resolves.toEqual({
      ok: true,
      value: {
        state: "CONFLICT",
      },
    });
  });

  it("does not call persistence when the authoritative offer is unavailable", async () => {
    const repository = new RecordingCheckoutOrderRepository({
      state: "CREATED",
    });

    const useCase = new CreateCheckoutOrder(createPrepareOrder(null), repository);

    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("unavailable offer unexpectedly succeeded");
    }

    expect(result.error.code).toBe("OFFER_UNAVAILABLE");

    expect(repository.calls).toHaveLength(0);
  });

  it("does not mask unexpected repository failures as business errors", async () => {
    const useCase = new CreateCheckoutOrder(
      createPrepareOrder(),
      new ThrowingCheckoutOrderRepository(),
    );

    await expect(useCase.execute(validInput())).rejects.toThrow("database socket exploded");
  });

  it("forwards the already-normalized buyer email without treating it as identity", async () => {
    const repository = new RecordingCheckoutOrderRepository({
      state: "CREATED",
    });

    const useCase = new CreateCheckoutOrder(createPrepareOrder(), repository);

    const normalized = "CaseSensitive.Local@example.com";

    await useCase.execute({
      ...validInput(),
      email: normalized,
    });

    expect(repository.calls[0]?.email).toBe(normalized);
  });
});
