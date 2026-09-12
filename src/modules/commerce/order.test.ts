import { describe, expect, it } from "vitest";

import { Money } from "../../shared/money";
import {
  catalogFixture,
  fixedClock,
  instant,
  orderFixture,
  paymentFixture,
} from "../../test-support/p07-fixtures";
import { ResolvePurchasableOffer } from "../catalog/application/resolve-purchasable-offer";
import { ApplyOrderTransition } from "./application/apply-order-transition";
import { PrepareOrder } from "./application/prepare-order";
import {
  buildOrderItem,
  calculateOrderTotal,
  orderStatuses,
  validateOrder,
  type OrderStatus,
} from "./domain/order";
import { applyOrderFact, canTransitionOrder } from "./domain/order-transition";

describe("Order preparation and historical snapshots", () => {
  const input = {
    orderId: "order",
    itemId: "item",
    customerId: "customer",
    productId: "product",
    offerId: "offer",
    quantity: 1,
  };
  it("uses catalog price, copies description, calculates totals and ignores extra browser values", async () => {
    const catalog = catalogFixture();
    const service = new PrepareOrder(
      new ResolvePurchasableOffer({ findOffer: async () => catalog }),
      fixedClock,
    );
    const result = await service.execute({ ...input, ...{ price: 1, total: 1 } });
    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    expect(result.value).toMatchObject({
      status: "PENDING",
      createdAt: instant,
      total: { amountMinor: 2990, currency: "BRL" },
      paidAt: null,
    });
    expect(result.value.items[0]).toMatchObject({
      productId: "product",
      offerId: "offer",
      productNameSnapshot: "Cronograma Capilar Inteligente",
      productDescriptionSnapshot: "Rotina educativa de cuidados",
      quantity: 1,
      unitPrice: { amountMinor: 2990 },
      total: { amountMinor: 2990 },
    });
    Object.assign(catalog.product, { name: "Novo nome", description: "Nova descrição" });
    Object.assign(catalog.offer, { price: Money.of(3990, "BRL") });
    expect(result.value.items[0]?.productDescriptionSnapshot).toBe("Rotina educativa de cuidados");
    expect(result.value.items[0]?.productNameSnapshot).toBe("Cronograma Capilar Inteligente");
    expect(result.value.total.amountMinor).toBe(2990);
    expect(Object.isFrozen(result.value.items)).toBe(true);
    expect(Object.isFrozen(result.value.items[0])).toBe(true);
    const updated = await service.execute(input);
    expect(updated).toMatchObject({ ok: true, value: { total: { amountMinor: 3990 } } });
  });
  it.each([0, -1, 2, 1.5, NaN])("rejects noncanonical initial quantity %s", async (quantity) => {
    const service = new PrepareOrder(
      new ResolvePurchasableOffer({ findOffer: async () => catalogFixture() }),
      fixedClock,
    );
    expect(await service.execute({ ...input, quantity })).toMatchObject({
      ok: false,
      error: { code: "INVALID_QUANTITY" },
    });
  });
  it("preserves a null description and propagates catalog rejection", async () => {
    const catalog = catalogFixture();
    const item = buildOrderItem(
      { ...catalog, product: { ...catalog.product, description: null } },
      { id: "item", orderId: "order", productId: "product" },
      1,
      instant,
    );
    expect(item.productDescriptionSnapshot).toBeNull();
    const service = new PrepareOrder(
      new ResolvePurchasableOffer({ findOffer: async () => null }),
      fixedClock,
    );
    expect(await service.execute(input)).toMatchObject({
      ok: false,
      error: { code: "OFFER_UNAVAILABLE" },
    });
  });
  it("sums items and rejects item totals, order totals, mixed currencies and broken identity", () => {
    const order = orderFixture();
    const item = order.items[0]!;
    expect(calculateOrderTotal([item, { ...item, id: "second" }]).amountMinor).toBe(5980);
    expect(() => calculateOrderTotal([])).toThrow(
      expect.objectContaining({ code: "INVALID_SNAPSHOT" }),
    );
    expect(() => calculateOrderTotal([{ ...item, total: Money.of(1, "BRL") }])).toThrow(
      expect.objectContaining({ code: "INCONSISTENT_TOTAL" }),
    );
    expect(() => validateOrder({ ...order, total: Money.of(1, "BRL") })).toThrow(
      expect.objectContaining({ code: "INCONSISTENT_TOTAL" }),
    );
    expect(() => validateOrder({ ...order, items: [item, item] })).toThrow(
      expect.objectContaining({ code: "INVALID_SNAPSHOT" }),
    );
    expect(() => validateOrder({ ...order, items: [{ ...item, orderId: "other" }] })).toThrow(
      expect.objectContaining({ code: "INVALID_SNAPSHOT" }),
    );
    const foreign = { ...item.total, currency: "USD" } as unknown as Money;
    expect(() => calculateOrderTotal([item, { ...item, total: foreign }])).toThrow();
  });
});

describe("Order state machine", () => {
  const allowed = new Set(["PENDING:PAID", "PENDING:FAILED", "PENDING:CANCELED", "PAID:REFUNDED"]);
  for (const from of orderStatuses)
    for (const to of orderStatuses) {
      it(`${from} -> ${to} follows the canonical matrix including idempotent repeats`, () => {
        expect(canTransitionOrder(from, to)).toBe(from === to || allowed.has(`${from}:${to}`));
      });
    }
  it("requires matching approved financial origin, preserves first timestamp and rejects downgrades", () => {
    const order = orderFixture();
    const payment = { ...paymentFixture(), status: "APPROVED" as const, approvedAt: instant };
    const service = new ApplyOrderTransition(fixedClock);
    expect(
      service.execute(order, { kind: "PAYMENT_APPROVED", payment: paymentFixture() }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_FINANCIAL_ORIGIN" } });
    expect(
      service.execute(order, {
        kind: "PAYMENT_APPROVED",
        payment: { ...payment, amount: Money.of(1, "BRL") },
      }),
    ).toMatchObject({ ok: false });
    const paid = applyOrderFact(order, { kind: "PAYMENT_APPROVED", payment }, fixedClock);
    expect(paid.paidAt).toBe(instant);
    expect(
      applyOrderFact(
        paid,
        { kind: "PAYMENT_APPROVED", payment },
        {
          now: () => {
            throw new Error("clock must not be consulted for repeat");
          },
        },
      ),
    ).toBe(paid);
    expect(
      service.execute(paid, {
        kind: "INTERNAL_FAILURE_CONFIRMED",
        orderId: order.id,
        hasApprovedPayment: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_ORDER_TRANSITION" } });
    expect(order.status).toBe("PENDING");
  });
  it("applies confirmed failure/cancellation only without approved payment and validates total refund", () => {
    const order = orderFixture();
    for (const kind of ["INTERNAL_FAILURE_CONFIRMED", "ELIGIBLE_CANCELLATION_CONFIRMED"] as const) {
      expect(() =>
        applyOrderFact(order, { kind, orderId: order.id, hasApprovedPayment: true }, fixedClock),
      ).toThrow();
      expect(
        applyOrderFact(order, { kind, orderId: order.id, hasApprovedPayment: false }, fixedClock)
          .status,
      ).toBe(kind === "INTERNAL_FAILURE_CONFIRMED" ? "FAILED" : "CANCELED");
    }
    const paid = { ...order, status: "PAID" as const, paidAt: instant };
    const fact = {
      kind: "FULL_REFUND_COMPLETED" as const,
      paymentId: "payment",
      orderId: "order",
      amount: order.total,
    };
    expect(applyOrderFact(paid, fact, fixedClock).status).toBe("REFUNDED");
    expect(() =>
      applyOrderFact(paid, { ...fact, amount: Money.of(1, "BRL") }, fixedClock),
    ).toThrow();
  });
  it("rejects unexpected states at runtime", () => {
    expect(() => canTransitionOrder("EXPIRED" as OrderStatus, "PAID")).toThrow(
      "Unexpected internal discriminant",
    );
    expect(() => canTransitionOrder("PENDING", "CREATED" as OrderStatus)).toThrow(
      "Unexpected internal discriminant",
    );
  });
});

describe("Order snapshot timestamp invariants", () => {
  it.each(["PENDING", "FAILED", "CANCELED"] as const)("%s rejects a paidAt timestamp", (status) => {
    expect(() =>
      validateOrder({
        ...orderFixture(),
        status,
        paidAt: instant,
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_SNAPSHOT" }));
  });

  it.each(["PAID", "REFUNDED"] as const)("%s requires a valid paidAt timestamp", (status) => {
    expect(() =>
      validateOrder({
        ...orderFixture(),
        status,
        paidAt: null,
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_SNAPSHOT" }));

    expect(() =>
      validateOrder({
        ...orderFixture(),
        status,
        paidAt: "not-a-valid-utc-instant",
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_SNAPSHOT" }));
  });

  it("accepts coherent PAID/REFUNDED snapshots and preserves the original paidAt", () => {
    const payment = {
      ...paymentFixture(),
      status: "APPROVED" as const,
      approvedAt: instant,
    };

    const paid = applyOrderFact(orderFixture(), { kind: "PAYMENT_APPROVED", payment }, fixedClock);

    validateOrder(paid);
    expect(paid.paidAt).toBe(instant);

    expect(
      applyOrderFact(
        paid,
        { kind: "PAYMENT_APPROVED", payment },
        {
          now: () => {
            throw new Error("clock must not be read for idempotent repeat");
          },
        },
      ),
    ).toBe(paid);

    const refunded = applyOrderFact(
      paid,
      {
        kind: "FULL_REFUND_COMPLETED",
        paymentId: "payment",
        orderId: "order",
        amount: paid.total,
      },
      fixedClock,
    );

    validateOrder(refunded);
    expect(refunded.paidAt).toBe(instant);
  });
});
