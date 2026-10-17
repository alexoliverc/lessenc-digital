import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Mercado Pago Card Payment Brick callbacks", () => {
  it("provides the required onReady callback with no financial side effect", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/checkout/payment/payment-choice.tsx"),
      "utf8",
    );
    const createStart = source.indexOf('.create("cardPayment", "p10-card-payment", {');
    const createEnd = source.indexOf("\n      .then((mounted)", createStart);

    expect(createStart).toBeGreaterThanOrEqual(0);
    expect(createEnd).toBeGreaterThan(createStart);

    const cardPaymentCreation = source.slice(createStart, createEnd);
    const callbacksStart = cardPaymentCreation.indexOf("callbacks: {");

    expect(callbacksStart).toBeGreaterThanOrEqual(0);

    const callbacks = cardPaymentCreation.slice(callbacksStart);

    expect(callbacks).toMatch(/\bonReady:\s*\(\)\s*=>\s*\{\}/u);
    expect(callbacks).toMatch(/\bonSubmit:\s*async\s*\(/u);
    expect(callbacks).toMatch(/\bonError:\s*\(\)\s*=>/u);
  });
});
