import { describe, expect, it } from "vitest";

import { Money } from "../../shared/money";
import { fixedClock, instant, orderFixture, paymentFixture } from "../../test-support/p07-fixtures";
import { ApplyEntitlementTransition } from "./application/apply-entitlement-transition";
import {
  applyEntitlementFact,
  entitlementStatuses,
  prepareEntitlement,
  type EntitlementStatus,
} from "./domain/entitlement";

const paidOrder = () => ({ ...orderFixture(), status: "PAID" as const, paidAt: instant });
const approvedPayment = () => ({
  ...paymentFixture(),
  status: "APPROVED" as const,
  approvedAt: instant,
});
const pendingEntitlement = () =>
  prepareEntitlement({ id: "entitlement", orderItemId: "item" }, [], fixedClock);

describe("Entitlement financial invariants", () => {
  it("prepares pending entitlement and rejects duplicate item or ID without claiming concurrent safety", () => {
    const existing = pendingEntitlement();
    expect(existing).toMatchObject({ status: "PENDING", createdAt: instant, activatedAt: null });
    expect(() =>
      prepareEntitlement({ id: "second", orderItemId: "item" }, [existing], fixedClock),
    ).toThrow(expect.objectContaining({ code: "DUPLICATE_ENTITLEMENT" }));
    expect(() =>
      prepareEntitlement({ id: "entitlement", orderItemId: "other" }, [existing], fixedClock),
    ).toThrow();
  });
  it.each(entitlementStatuses)("activation from %s follows only approved behavior", (status) => {
    const entitlement = {
      ...pendingEntitlement(),
      status,
      activatedAt: status === "ACTIVE" ? instant : null,
    };
    const result = new ApplyEntitlementTransition(fixedClock).execute(entitlement, {
      kind: "PAID_ORDER",
      order: paidOrder(),
      payment: approvedPayment(),
    });
    expect(result.ok).toBe(status === "PENDING" || status === "ACTIVE");
    if (result.ok) expect(result.value.activatedAt).toBe(instant);
  });
  it("rejects UI-like requests with unpaid order, ambiguous payment or mismatched financial origin", () => {
    const service = new ApplyEntitlementTransition(fixedClock);
    const entitlement = pendingEntitlement();
    expect(
      service.execute(entitlement, {
        kind: "PAID_ORDER",
        order: orderFixture(),
        payment: approvedPayment(),
      }),
    ).toMatchObject({ ok: false });
    for (const status of ["PENDING", "UNKNOWN", "REJECTED", "CANCELED", "REFUNDED"] as const) {
      expect(
        service.execute(entitlement, {
          kind: "PAID_ORDER",
          order: paidOrder(),
          payment: { ...approvedPayment(), status },
        }),
      ).toMatchObject({ ok: false, error: { code: "INVALID_FINANCIAL_ORIGIN" } });
    }
    for (const payment of [
      { ...approvedPayment(), orderId: "other" },
      { ...approvedPayment(), amount: Money.of(1, "BRL") },
    ]) {
      expect(
        service.execute(entitlement, { kind: "PAID_ORDER", order: paidOrder(), payment }),
      ).toMatchObject({ ok: false });
    }
    expect(
      service.execute(
        { ...entitlement, orderItemId: "other" },
        { kind: "PAID_ORDER", order: paidOrder(), payment: approvedPayment() },
      ),
    ).toMatchObject({ ok: false });
  });
  it("activates and revokes idempotently on confirmed full refund, retaining history", () => {
    const activation = {
      kind: "PAID_ORDER" as const,
      order: paidOrder(),
      payment: approvedPayment(),
    };
    const active = applyEntitlementFact(pendingEntitlement(), activation, fixedClock);
    expect(applyEntitlementFact(active, activation, fixedClock)).toBe(active);
    const refund = {
      kind: "REFUNDED_ORDER" as const,
      order: { ...paidOrder(), status: "REFUNDED" as const },
      payment: { ...approvedPayment(), status: "REFUNDED" as const },
      refund: {
        kind: "FULL_REFUND_COMPLETED" as const,
        paymentId: "payment",
        orderId: "order",
        amount: Money.of(2990, "BRL"),
      },
    };
    const revoked = applyEntitlementFact(active, refund, fixedClock);
    expect(revoked).toMatchObject({ status: "REVOKED", activatedAt: instant, revokedAt: instant });
    expect(applyEntitlementFact(revoked, refund, fixedClock)).toBe(revoked);
    expect(() => applyEntitlementFact(revoked, activation, fixedClock)).toThrow();
    expect(() =>
      applyEntitlementFact(
        active,
        { ...refund, refund: { ...refund.refund, amount: Money.of(1, "BRL") } },
        fixedClock,
      ),
    ).toThrow();
    expect(() =>
      applyEntitlementFact(
        active,
        { ...refund, refund: { ...refund.refund, paymentId: "other" } },
        fixedClock,
      ),
    ).toThrow();
  });
  it("does not invent expiration or reissue behavior and fails explicitly for unknown states", () => {
    const fact = { kind: "PAID_ORDER" as const, order: paidOrder(), payment: approvedPayment() };
    expect(() =>
      applyEntitlementFact({ ...pendingEntitlement(), status: "EXPIRED" }, fact, fixedClock),
    ).toThrow(expect.objectContaining({ code: "INVALID_ENTITLEMENT_TRANSITION" }));
    expect(() =>
      applyEntitlementFact(
        { ...pendingEntitlement(), status: "GRANTED" as EntitlementStatus },
        fact,
        fixedClock,
      ),
    ).toThrow("Unexpected internal discriminant");
  });
});

describe("Entitlement snapshot timestamp invariants", () => {
  const activation = () => ({
    kind: "PAID_ORDER" as const,
    order: paidOrder(),
    payment: approvedPayment(),
  });

  const refund = () => ({
    kind: "REFUNDED_ORDER" as const,
    order: {
      ...paidOrder(),
      status: "REFUNDED" as const,
    },
    payment: {
      ...approvedPayment(),
      status: "REFUNDED" as const,
    },
    refund: {
      kind: "FULL_REFUND_COMPLETED" as const,
      paymentId: "payment",
      orderId: "order",
      amount: Money.of(2990, "BRL"),
    },
  });

  it("rejects PENDING with activation or revocation timestamps", () => {
    const pending = pendingEntitlement();

    for (const invalid of [
      { ...pending, activatedAt: instant },
      { ...pending, revokedAt: instant },
      { ...pending, activatedAt: instant, revokedAt: instant },
    ]) {
      expect(() => applyEntitlementFact(invalid, activation(), fixedClock)).toThrow(
        expect.objectContaining({ code: "INVALID_SNAPSHOT" }),
      );
    }
  });

  it("rejects ACTIVE without valid activatedAt or with revokedAt", () => {
    const active = {
      ...pendingEntitlement(),
      status: "ACTIVE" as const,
    };

    for (const invalid of [
      { ...active, activatedAt: null },
      { ...active, activatedAt: "not-a-valid-utc-instant" },
      { ...active, activatedAt: instant, revokedAt: instant },
    ]) {
      expect(() => applyEntitlementFact(invalid, activation(), fixedClock)).toThrow(
        expect.objectContaining({ code: "INVALID_SNAPSHOT" }),
      );
    }
  });

  it("rejects REVOKED without both valid historical timestamps", () => {
    const revoked = {
      ...pendingEntitlement(),
      status: "REVOKED" as const,
    };

    for (const invalid of [
      { ...revoked, activatedAt: null, revokedAt: instant },
      { ...revoked, activatedAt: instant, revokedAt: null },
      {
        ...revoked,
        activatedAt: "not-a-valid-utc-instant",
        revokedAt: instant,
      },
      {
        ...revoked,
        activatedAt: instant,
        revokedAt: "not-a-valid-utc-instant",
      },
    ]) {
      expect(() => applyEntitlementFact(invalid, refund(), fixedClock)).toThrow(
        expect.objectContaining({ code: "INVALID_SNAPSHOT" }),
      );
    }
  });

  it("accepts coherent ACTIVE/REVOKED repeats without rewriting timestamps", () => {
    const active = applyEntitlementFact(pendingEntitlement(), activation(), fixedClock);

    expect(
      applyEntitlementFact(active, activation(), {
        now: () => {
          throw new Error("clock must not be read for idempotent repeat");
        },
      }),
    ).toBe(active);

    const revoked = applyEntitlementFact(active, refund(), fixedClock);

    expect(revoked.activatedAt).toBe(instant);
    expect(revoked.revokedAt).toBe(instant);

    expect(
      applyEntitlementFact(revoked, refund(), {
        now: () => {
          throw new Error("clock must not be read for idempotent repeat");
        },
      }),
    ).toBe(revoked);
  });
});
