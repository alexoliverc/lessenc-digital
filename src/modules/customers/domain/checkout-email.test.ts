import { describe, expect, it } from "vitest";

import { parseCheckoutEmail } from "./checkout-email";

describe("parseCheckoutEmail", () => {
  it("accepts a normal email address", () => {
    expect(parseCheckoutEmail("alex@example.com")).toEqual({
      ok: true,
      value: "alex@example.com",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseCheckoutEmail("  alex@example.com  ")).toEqual({
      ok: true,
      value: "alex@example.com",
    });
  });

  it("normalizes the domain to lowercase", () => {
    expect(parseCheckoutEmail("alex@EXAMPLE.COM")).toEqual({
      ok: true,
      value: "alex@example.com",
    });
  });

  it("preserves local-part case", () => {
    expect(parseCheckoutEmail("Alex.Sales@EXAMPLE.COM")).toEqual({
      ok: true,
      value: "Alex.Sales@example.com",
    });
  });

  it("rejects non-string input", () => {
    expect(parseCheckoutEmail(null)).toEqual({
      ok: false,
      reason: "INVALID_TYPE",
    });
  });

  it("rejects an empty value", () => {
    expect(parseCheckoutEmail("   ")).toEqual({
      ok: false,
      reason: "REQUIRED",
    });
  });

  it("rejects addresses without exactly one at-sign", () => {
    expect(parseCheckoutEmail("alex.example.com")).toEqual({
      ok: false,
      reason: "INVALID_FORMAT",
    });

    expect(parseCheckoutEmail("alex@@example.com")).toEqual({
      ok: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("rejects internal whitespace", () => {
    expect(parseCheckoutEmail("alex @example.com")).toEqual({
      ok: false,
      reason: "INVALID_FORMAT",
    });

    expect(parseCheckoutEmail("alex@exam ple.com")).toEqual({
      ok: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("rejects control characters", () => {
    expect(parseCheckoutEmail("alex@example.com\u0000")).toEqual({
      ok: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("rejects a local part longer than 64 characters", () => {
    expect(parseCheckoutEmail(`${"a".repeat(65)}@example.com`)).toEqual({
      ok: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("accepts the 320-character persistence boundary", () => {
    const localPart = "a".repeat(64);
    const domain = ["b".repeat(63), "c".repeat(63), "d".repeat(63), "e".repeat(63)].join(".");

    const email = `${localPart}@${domain}`;

    expect(email).toHaveLength(320);

    expect(parseCheckoutEmail(email)).toEqual({
      ok: true,
      value: email,
    });
  });

  it("rejects values longer than 320 characters", () => {
    const domain = ["b".repeat(63), "c".repeat(63), "d".repeat(63), "e".repeat(63)].join(".");

    const email = `${"a".repeat(65)}@${domain}`;

    expect(email.length).toBeGreaterThan(320);

    expect(parseCheckoutEmail(email)).toEqual({
      ok: false,
      reason: "TOO_LONG",
    });
  });

  it("rejects invalid domain labels", () => {
    for (const email of [
      "alex@-example.com",
      "alex@example-.com",
      "alex@example..com",
      "alex@exam_ple.com",
    ]) {
      expect(parseCheckoutEmail(email)).toEqual({
        ok: false,
        reason: "INVALID_FORMAT",
      });
    }
  });
});
