import { afterEach, describe, expect, it, vi } from "vitest";

import type { FinancialObservationResult } from "./financial-coordinator";
import {
  IndependentFinancialObservers,
  type IndependentFinancialObserver,
} from "./independent-financial-observers";

const observation: FinancialObservationResult = {
  orderId: "11111111-1111-4111-8111-111111111111",
  paymentId: "22222222-2222-4222-8222-222222222222",
  source: "CREATE_RESPONSE",
  result: "APPLIED",
};

function canonical(
  observer: IndependentFinancialObserver["observer"],
): IndependentFinancialObserver {
  return {
    observer,
    failureEvent: "canonical_purchase_projection_failed",
    failureCode: "CANONICAL_PURCHASE_PROJECTION_FAILED",
  };
}

function entitlement(
  observer: IndependentFinancialObserver["observer"],
): IndependentFinancialObserver {
  return {
    observer,
    failureEvent: "entitlement_grant_dispatch_failed",
    failureCode: "ENTITLEMENT_GRANT_DISPATCH_FAILED",
  };
}

describe("IndependentFinancialObservers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs entitlement even when canonical analytics fails", async () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const entitlementCall = vi.fn(async () => undefined);
    const observers = new IndependentFinancialObservers([
      canonical({
        afterFinancialObservation: async () => {
          throw new Error("sensitive analytics failure");
        },
      }),
      entitlement({ afterFinancialObservation: entitlementCall }),
    ]);

    await expect(observers.afterFinancialObservation(observation)).resolves.toBeUndefined();
    expect(entitlementCall).toHaveBeenCalledOnce();

    const serialized = diagnostic.mock.calls.flat().join(" ");
    expect(JSON.parse(serialized)).toMatchObject({
      event: "canonical_purchase_projection_failed",
      failureCode: "CANONICAL_PURCHASE_PROJECTION_FAILED",
      surface: "PAYMENTS",
      outcome: "DEGRADED",
    });
    expect(serialized).not.toContain("sensitive analytics failure");
  });

  it("runs canonical analytics and logs the correct code when entitlement fails", async () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const canonicalCall = vi.fn(async () => undefined);
    const observers = new IndependentFinancialObservers([
      canonical({ afterFinancialObservation: canonicalCall }),
      entitlement({
        afterFinancialObservation: async () => {
          throw new Error("sensitive entitlement failure");
        },
      }),
    ]);

    await expect(observers.afterFinancialObservation(observation)).resolves.toBeUndefined();
    expect(canonicalCall).toHaveBeenCalledOnce();

    const serialized = diagnostic.mock.calls.flat().join(" ");
    expect(JSON.parse(serialized)).toMatchObject({
      event: "entitlement_grant_dispatch_failed",
      failureCode: "ENTITLEMENT_GRANT_DISPATCH_FAILED",
      surface: "PAYMENTS",
      outcome: "DEGRADED",
    });
    expect(serialized).not.toContain("sensitive entitlement failure");
    expect(serialized).not.toContain("CANONICAL_PURCHASE_PROJECTION_FAILED");
  });
});
