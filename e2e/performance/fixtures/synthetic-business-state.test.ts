import { describe, expect, it } from "vitest";

import {
  assertSyntheticAttemptNumber,
  assertSyntheticCheckoutEmail,
  createSyntheticCheckoutEmail,
} from "./synthetic-business-state";

describe("P17 disposable performance fixtures", () => {
  it("generates only bounded example.invalid checkout identities", () => {
    expect(createSyntheticCheckoutEmail("mobile", 1)).toBe(
      "p17.performance.inp.mobile.1@example.invalid",
    );
    expect(createSyntheticCheckoutEmail("desktop", 43)).toBe(
      "p17.performance.inp.desktop.43@example.invalid",
    );
    expect(() => createSyntheticCheckoutEmail("tablet", 0)).toThrow(
      "P17_PERFORMANCE_FIXTURE_ATTEMPT_INVALID",
    );
    expect(() => createSyntheticCheckoutEmail("tablet", 44)).toThrow(
      "P17_PERFORMANCE_FIXTURE_ATTEMPT_INVALID",
    );
    expect(() => assertSyntheticAttemptNumber(1.5)).toThrow(
      "P17_PERFORMANCE_FIXTURE_ATTEMPT_INVALID",
    );
  });

  it("rejects cleanup targets outside the exact synthetic namespace", () => {
    expect(() =>
      assertSyntheticCheckoutEmail("p17.performance.inp.tablet.22@example.invalid"),
    ).not.toThrow();
    for (const unsafe of [
      "buyer@example.com",
      "p17.performance.inp.mobile.0@example.invalid",
      "p17.performance.inp.mobile.44@example.invalid",
      "p17.performance.inp.mobile.1@example.com",
    ]) {
      expect(() => assertSyntheticCheckoutEmail(unsafe)).toThrow(
        "P17_PERFORMANCE_FIXTURE_EMAIL_INVALID",
      );
    }
  });
});
