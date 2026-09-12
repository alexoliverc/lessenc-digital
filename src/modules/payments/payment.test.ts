import { describe, expect, it } from "vitest";

import { Money } from "../../shared/money";
import { fixedClock, instant, paymentFixture } from "../../test-support/p07-fixtures";
import { ApplyPaymentTransition } from "./application/apply-payment-transition";
import {
  applyPaymentFact,
  canTransitionPayment,
  paymentStatuses,
  type PaymentFact,
  type PaymentStatus,
} from "./domain/payment";

function factFor(status: PaymentStatus): PaymentFact {
  const identity = { paymentId: "payment", orderId: "order", amount: Money.of(2990, "BRL") };
  if (status === "UNKNOWN") return { ...identity, kind: "AMBIGUOUS_RESULT" };
  if (status === "REFUNDED") return { ...identity, kind: "FULL_REFUND_COMPLETED" };
  return { ...identity, kind: "CONFIRMED_STATUS", status };
}

describe("Payment transitions", () => {
  const allowed = new Set([
    "PENDING:APPROVED",
    "PENDING:REJECTED",
    "PENDING:CANCELED",
    "PENDING:UNKNOWN",
    "UNKNOWN:APPROVED",
    "UNKNOWN:REJECTED",
    "APPROVED:REFUNDED",
  ]);
  for (const from of paymentStatuses)
    for (const to of paymentStatuses) {
      it(`${from} -> ${to} obeys the canonical matrix and typed application boundary`, () => {
        const permitted = from === to || allowed.has(`${from}:${to}`);
        const payment = {
          ...paymentFixture(),
          status: from,
          approvedAt: from === "APPROVED" || from === "REFUNDED" ? instant : null,
        };
        expect(canTransitionPayment(from, to)).toBe(permitted);
        const result = new ApplyPaymentTransition(fixedClock).execute(payment, factFor(to));
        expect(result.ok).toBe(permitted);
        if (result.ok) expect(result.value.status).toBe(to);
        else expect(result.error.code).toBe("INVALID_PAYMENT_TRANSITION");
        expect(payment.status).toBe(from);
      });
    }
  it("keeps timeout UNKNOWN and never treats it as rejection or grants approval", () => {
    const unknown = applyPaymentFact(paymentFixture(), factFor("UNKNOWN"), fixedClock);
    expect(unknown).toMatchObject({ status: "UNKNOWN", approvedAt: null });
    expect(() => applyPaymentFact(unknown, factFor("PENDING"), fixedClock)).toThrow();
    expect(applyPaymentFact(unknown, factFor("APPROVED"), fixedClock).approvedAt).toBe(instant);
  });
  it("preserves approval timestamp on duplicate and refund, rejecting delayed negative information", () => {
    const approved = applyPaymentFact(paymentFixture(), factFor("APPROVED"), fixedClock);
    expect(
      applyPaymentFact(approved, factFor("APPROVED"), {
        now: () => {
          throw new Error("must not read clock");
        },
      }),
    ).toBe(approved);
    expect(applyPaymentFact(approved, factFor("REFUNDED"), fixedClock).approvedAt).toBe(instant);
    for (const delayed of ["PENDING", "REJECTED", "CANCELED", "UNKNOWN"] as const) {
      expect(() => applyPaymentFact(approved, factFor(delayed), fixedClock)).toThrow(
        expect.objectContaining({ code: "INVALID_PAYMENT_TRANSITION" }),
      );
    }
  });
  it("rejects mismatched payment, order, amount and partial refund", () => {
    const payment = paymentFixture();
    const fact = factFor("APPROVED");
    for (const invalid of [
      { ...fact, paymentId: "other" },
      { ...fact, orderId: "other" },
      { ...fact, amount: Money.of(1, "BRL") },
    ]) {
      expect(() => applyPaymentFact(payment, invalid, fixedClock)).toThrow(
        expect.objectContaining({ code: "INVALID_FINANCIAL_ORIGIN" }),
      );
    }
    const approved = applyPaymentFact(payment, fact, fixedClock);
    expect(() =>
      applyPaymentFact(
        approved,
        { ...factFor("REFUNDED"), amount: Money.of(1, "BRL") },
        fixedClock,
      ),
    ).toThrow();
  });
  it("rejects unknown runtime states instead of silently defaulting", () => {
    expect(() => canTransitionPayment("PROCESSING" as PaymentStatus, "APPROVED")).toThrow(
      "Unexpected internal discriminant",
    );
    expect(() => canTransitionPayment("PENDING", "CHARGEBACK" as PaymentStatus)).toThrow(
      "Unexpected internal discriminant",
    );
  });
});

describe("Payment snapshot timestamp invariants", () => {
  it.each(["PENDING", "UNKNOWN", "REJECTED", "CANCELED"] as const)(
    "%s rejects an approvedAt timestamp",
    (status) => {
      const invalid = {
        ...paymentFixture(),
        status,
        approvedAt: instant,
      };

      expect(() => applyPaymentFact(invalid, factFor(status), fixedClock)).toThrow(
        expect.objectContaining({ code: "INVALID_SNAPSHOT" }),
      );
    },
  );

  it.each(["APPROVED", "REFUNDED"] as const)(
    "%s requires a valid approvedAt timestamp",
    (status) => {
      const missing = {
        ...paymentFixture(),
        status,
        approvedAt: null,
      };

      expect(() => applyPaymentFact(missing, factFor(status), fixedClock)).toThrow(
        expect.objectContaining({ code: "INVALID_SNAPSHOT" }),
      );

      const malformed = {
        ...paymentFixture(),
        status,
        approvedAt: "not-a-valid-utc-instant",
      };

      expect(() => applyPaymentFact(malformed, factFor(status), fixedClock)).toThrow(
        expect.objectContaining({ code: "INVALID_SNAPSHOT" }),
      );
    },
  );

  it("preserves the original approvedAt on repeat and refund", () => {
    const approved = applyPaymentFact(paymentFixture(), factFor("APPROVED"), fixedClock);

    expect(approved.approvedAt).toBe(instant);

    expect(
      applyPaymentFact(approved, factFor("APPROVED"), {
        now: () => {
          throw new Error("clock must not be read for idempotent repeat");
        },
      }),
    ).toBe(approved);

    const refunded = applyPaymentFact(approved, factFor("REFUNDED"), fixedClock);

    expect(refunded.approvedAt).toBe(instant);
  });
});
