import { describe, expect, it, vi } from "vitest";

import type { FinancialObservationResult } from "../../payments/application/financial-coordinator";
import {
  DispatchPendingEntitlementGrants,
  ENTITLEMENT_GRANT_DISPATCH_LIMIT,
  type PendingPaymentApprovedEventRepository,
} from "./dispatch-pending-entitlement-grants";
import { EntitlementGrantFinancialObserver } from "./entitlement-grant-financial-observer";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function eventId(index: number): string {
  return `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`;
}

function repository(ids: readonly string[]): PendingPaymentApprovedEventRepository {
  return {
    findPendingPaymentApproved: vi.fn(async () => ids.map((id) => ({ id }))),
  };
}

describe("DispatchPendingEntitlementGrants", () => {
  it("returns an empty report without invoking the processor", async () => {
    const events = repository([]);
    const execute = vi.fn();
    const dispatcher = new DispatchPendingEntitlementGrants(events, { execute });

    await expect(dispatcher.execute(ORDER_ID)).resolves.toEqual({
      selected: 0,
      processed: 0,
      noop: 0,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(events.findPendingPaymentApproved).toHaveBeenCalledWith(
      ORDER_ID,
      ENTITLEMENT_GRANT_DISPATCH_LIMIT,
    );
  });

  it("invokes the existing processor exactly once for one pending event", async () => {
    const id = eventId(1);
    const execute = vi.fn(async () => "PROCESSED" as const);
    const dispatcher = new DispatchPendingEntitlementGrants(repository([id]), { execute });

    await expect(dispatcher.execute(ORDER_ID)).resolves.toEqual({
      selected: 1,
      processed: 1,
      noop: 0,
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(id);
  });

  it("preserves deterministic repository order and accounts for processor NOOP", async () => {
    const ids = [eventId(3), eventId(1), eventId(2)];
    const calls: string[] = [];
    const dispatcher = new DispatchPendingEntitlementGrants(repository(ids), {
      execute: async (id) => {
        calls.push(id);
        return id === ids[1] ? "NOOP" : "PROCESSED";
      },
    });

    await expect(dispatcher.execute(ORDER_ID)).resolves.toEqual({
      selected: 3,
      processed: 2,
      noop: 1,
    });
    expect(calls).toEqual(ids);
  });

  it("enforces the hard processing bound even if a repository returns too many rows", async () => {
    const ids = Array.from({ length: ENTITLEMENT_GRANT_DISPATCH_LIMIT + 3 }, (_, index) =>
      eventId(index + 1),
    );
    const execute = vi.fn(async () => "PROCESSED" as const);
    const dispatcher = new DispatchPendingEntitlementGrants(repository(ids), { execute });

    await expect(dispatcher.execute(ORDER_ID)).resolves.toEqual({
      selected: ENTITLEMENT_GRANT_DISPATCH_LIMIT,
      processed: ENTITLEMENT_GRANT_DISPATCH_LIMIT,
      noop: 0,
    });
    expect(execute).toHaveBeenCalledTimes(ENTITLEMENT_GRANT_DISPATCH_LIMIT);
  });

  it("propagates processor failure so the post-financial isolation boundary can log it", async () => {
    const first = eventId(1);
    const second = eventId(2);
    const execute = vi.fn(async () => {
      throw new Error("sensitive internal database failure");
    });
    const dispatcher = new DispatchPendingEntitlementGrants(repository([first, second]), {
      execute,
    });

    await expect(dispatcher.execute(ORDER_ID)).rejects.toThrow(
      "sensitive internal database failure",
    );
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(first);
  });
});

describe("EntitlementGrantFinancialObserver", () => {
  it.each<FinancialObservationResult>([
    {
      orderId: ORDER_ID,
      paymentId: "22222222-2222-4222-8222-222222222222",
      source: "CREATE_RESPONSE",
      result: "APPLIED",
    },
    {
      orderId: ORDER_ID,
      paymentId: "22222222-2222-4222-8222-222222222222",
      source: "WEBHOOK",
      result: "NOOP",
    },
    {
      orderId: ORDER_ID,
      paymentId: "22222222-2222-4222-8222-222222222222",
      source: "RECONCILIATION",
      result: "NOOP",
    },
    {
      orderId: ORDER_ID,
      paymentId: "22222222-2222-4222-8222-222222222222",
      source: "RECOVERY",
      result: "APPLIED",
    },
  ])("dispatches a bounded fulfillment attempt after $source/$result", async (input) => {
    const execute = vi.fn(async () => ({ selected: 0, processed: 0, noop: 0 }));
    const observer = new EntitlementGrantFinancialObserver({ execute });

    await observer.afterFinancialObservation(input);

    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(ORDER_ID);
  });

  it.each(["REJECTED", "REVIEW"] as const)(
    "does not dispatch for a non-authoritative %s observation",
    async (result) => {
      const execute = vi.fn();
      const observer = new EntitlementGrantFinancialObserver({ execute });

      await observer.afterFinancialObservation({
        orderId: ORDER_ID,
        paymentId: "22222222-2222-4222-8222-222222222222",
        source: "WEBHOOK",
        result,
      });

      expect(execute).not.toHaveBeenCalled();
    },
  );
});
