import { describe, expect, it, vi } from "vitest";

import { ApplicationError } from "./application-error";
import { assertNever } from "./assert-never";
import { SystemClock, utcNow } from "./clock";
import { Money, parseCurrency } from "./money";
import { attempt, attemptAsync } from "./result";

describe("Money and Currency", () => {
  it.each([-1, 29.9, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, Money.maxMinor + 1])(
    "rejects invalid amount %s",
    (amount) => {
      expect(() => Money.of(amount, "BRL")).toThrow(
        expect.objectContaining({ code: "INVALID_MONEY" }),
      );
    },
  );
  it("uses deterministic minor units, includes currency in equality and freezes values", () => {
    const value = Money.of(2990, "BRL");
    expect(value.add(value).amountMinor).toBe(5980);
    expect(value.multiply(3).amountMinor).toBe(8970);
    expect(value.equals(Money.of(2990, "BRL"))).toBe(true);
    expect(value.equals(Money.of(2991, "BRL"))).toBe(false);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Money.of(0, "BRL").amountMinor).toBe(0);
    expect(Money.of(Money.maxMinor, "BRL").amountMinor).toBe(Money.maxMinor);
  });
  it("rejects unsupported currency and incompatible values from an untyped boundary", () => {
    expect(() => parseCurrency("USD")).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_CURRENCY" }),
    );
    const value = Money.of(2990, "BRL");
    const foreign = { amountMinor: 2990, currency: "USD" } as unknown as Money;
    expect(value.equals(foreign)).toBe(false);
    expect(() => value.add(foreign)).toThrow(
      expect.objectContaining({ code: "CURRENCY_MISMATCH" }),
    );
  });
  it("detects overflow in addition and multiplication", () => {
    expect(() => Money.of(Money.maxMinor, "BRL").add(Money.of(1, "BRL"))).toThrow(ApplicationError);
    expect(() => Money.of(Money.maxMinor, "BRL").multiply(2)).toThrow(ApplicationError);
  });
  it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid multiplier %s", (quantity) => {
    expect(() => Money.of(2990, "BRL").multiply(quantity)).toThrow(
      expect.objectContaining({ code: "INVALID_QUANTITY" }),
    );
  });
});

describe("Application primitives", () => {
  it("exposes stable safe errors and never masks programming defects", async () => {
    const result = attempt(() => {
      throw new ApplicationError("INVALID_MONEY");
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.toJSON()).toEqual({
        code: "INVALID_MONEY",
        message: "Invalid monetary amount",
        context: { operation: "business-rule" },
      });
    expect(attempt(() => 42)).toEqual({ ok: true, value: 42 });
    expect(() =>
      attempt(() => {
        throw new TypeError("defect");
      }),
    ).toThrow(TypeError);
    await expect(
      attemptAsync(async () => {
        throw new TypeError("defect");
      }),
    ).rejects.toThrow(TypeError);
    await expect(
      attemptAsync(async () => {
        throw new ApplicationError("OFFER_UNAVAILABLE");
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "OFFER_UNAVAILABLE" } });
  });
  it("uses UTC and supports a deterministic system clock", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-12T17:00:00-03:00"));
      expect(utcNow(new SystemClock())).toBe("2026-09-12T20:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });
  it("fails explicitly on an unexpected discriminant without echoing its value", () => {
    expect(() => assertNever("untrusted-value" as never)).toThrow(
      "Unexpected internal discriminant",
    );
  });
});
