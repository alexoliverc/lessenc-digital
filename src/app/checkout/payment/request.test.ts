import { describe, expect, it } from "vitest";

import { parsePaymentStartInput } from "./request";

describe("payment start input boundary", () => {
  it("accepts only the canonical Pix and card input shapes", () => {
    expect(parsePaymentStartInput({ method: "PIX" })).toEqual({ method: "PIX" });
    expect(
      parsePaymentStartInput({
        method: "CREDIT_CARD",
        card: {
          token: "card-token-fixture",
          paymentMethodId: "master",
          installments: 1,
          paymentType: "credit_card",
        },
      }),
    ).toEqual({
      method: "CREDIT_CARD",
      card: {
        token: "card-token-fixture",
        paymentMethodId: "master",
        installments: 1,
        paymentType: "credit_card",
      },
    });
  });

  it("rejects browser-supplied presentation URLs instead of admitting them into payment state", () => {
    const injectedPresentation = {
      kind: "CHALLENGE",
      url: "https://attacker.example/challenge",
    };

    expect(
      parsePaymentStartInput({ method: "PIX", presentation: injectedPresentation }),
    ).toBeNull();
    expect(
      parsePaymentStartInput({
        method: "CREDIT_CARD",
        card: {
          token: "card-token-fixture",
          paymentMethodId: "master",
          installments: 1,
          paymentType: "credit_card",
        },
        presentation: injectedPresentation,
      }),
    ).toBeNull();
  });
});
