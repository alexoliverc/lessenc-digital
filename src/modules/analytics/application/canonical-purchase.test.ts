import { describe, expect, it, vi } from "vitest";

import type { AnalyticsEventRecord } from "../../attribution/application/persistence";
import {
  ProjectCanonicalPurchase,
  ReconcileCanonicalPurchases,
  type CanonicalPurchaseProjectionResult,
  type CanonicalPurchaseRepository,
} from "./canonical-purchase";
import { CanonicalPurchaseFinancialObserver } from "./canonical-purchase-observer";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";

function event(id = EVENT_ID): AnalyticsEventRecord {
  return Object.freeze({
    id,
    type: "PURCHASE",
    occurredAt: new Date("2026-09-19T15:00:00.000Z"),
    journeyId: null,
    productId: "33333333-3333-4333-8333-333333333333",
    offerId: "44444444-4444-4444-8444-444444444444",
    orderId: ORDER_ID,
    amountMinor: 2990,
    currency: "BRL",
    attributionState: "UNATTRIBUTED",
    consentSnapshot: {
      analytics: "UNKNOWN",
      advertising: "UNKNOWN",
      policyVersion: "p13-architecture-freeze-r2",
    },
    schemaVersion: 1,
    purchaseOrderKey: ORDER_ID,
    createdAt: new Date("2026-09-19T15:00:01.000Z"),
  });
}

class FakePurchaseRepository implements CanonicalPurchaseRepository {
  readonly projections: Array<{ orderId: string; eventId: string }> = [];
  missingOrderIds: readonly string[] = [];
  results = new Map<string, CanonicalPurchaseProjectionResult>();
  failures = new Set<string>();

  async project(input: {
    orderId: string;
    eventId: string;
  }): Promise<CanonicalPurchaseProjectionResult> {
    this.projections.push(input);

    if (this.failures.has(input.orderId)) {
      throw new Error("TEST_PROJECTION_FAILURE");
    }

    return (
      this.results.get(input.orderId) ??
      Object.freeze({
        state: "CREATED" as const,
        event: event(input.eventId),
      })
    );
  }

  async findEligibleMissingOrderIds(): Promise<readonly string[]> {
    return this.missingOrderIds;
  }
}

describe("P13-E canonical Purchase application", () => {
  it("creates a technical event identity and delegates authoritative projection", async () => {
    const repository = new FakePurchaseRepository();
    const projector = new ProjectCanonicalPurchase(repository, () => EVENT_ID);

    await expect(projector.execute(ORDER_ID)).resolves.toMatchObject({
      state: "CREATED",
      event: {
        id: EVENT_ID,
        orderId: ORDER_ID,
        type: "PURCHASE",
      },
    });

    expect(repository.projections).toEqual([
      {
        orderId: ORDER_ID,
        eventId: EVENT_ID,
      },
    ]);
  });

  it("rejects an empty Order identity before persistence", async () => {
    const repository = new FakePurchaseRepository();
    const projector = new ProjectCanonicalPurchase(repository, () => EVENT_ID);

    expect(() => projector.execute(" ")).toThrow("INVALID_PURCHASE_ORDER_ID");
    expect(repository.projections).toHaveLength(0);
  });

  it("reconciles a bounded batch and isolates an individual projection failure", async () => {
    const repository = new FakePurchaseRepository();
    const existingOrderId = "55555555-5555-4555-8555-555555555555";
    const ineligibleOrderId = "66666666-6666-4666-8666-666666666666";
    const failedOrderId = "77777777-7777-4777-8777-777777777777";

    repository.missingOrderIds = [ORDER_ID, existingOrderId, ineligibleOrderId, failedOrderId];
    repository.results.set(existingOrderId, {
      state: "EXISTING",
      event: event("88888888-8888-4888-8888-888888888888"),
    });
    repository.results.set(ineligibleOrderId, {
      state: "INELIGIBLE",
      reason: "FINANCIAL_STATE_NOT_AUTHORITATIVE",
    });
    repository.failures.add(failedOrderId);

    let id = 0;
    const projector = new ProjectCanonicalPurchase(
      repository,
      () => `99999999-9999-4999-8999-${String(id++).padStart(12, "0")}`,
    );
    const reconciliation = new ReconcileCanonicalPurchases(repository, projector);

    await expect(reconciliation.execute(25)).resolves.toEqual({
      scanned: 4,
      created: 1,
      existing: 1,
      ineligible: 1,
      failed: 1,
    });
  });

  it.each([0, 501, 1.5])("rejects an invalid reconciliation limit: %s", async (limit) => {
    const repository = new FakePurchaseRepository();
    const reconciliation = new ReconcileCanonicalPurchases(
      repository,
      new ProjectCanonicalPurchase(repository, () => EVENT_ID),
    );

    await expect(reconciliation.execute(limit)).rejects.toThrow(
      "INVALID_PURCHASE_RECONCILIATION_LIMIT",
    );
  });

  it("observes only non-rejected committed financial outcomes", async () => {
    const execute = vi.fn().mockResolvedValue({
      state: "CREATED",
      event: event(),
    });
    const observer = new CanonicalPurchaseFinancialObserver({ execute });

    await observer.afterFinancialObservation({
      orderId: ORDER_ID,
      paymentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source: "WEBHOOK",
      result: "APPLIED",
    });
    await observer.afterFinancialObservation({
      orderId: ORDER_ID,
      paymentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source: "WEBHOOK",
      result: "NOOP",
    });
    await observer.afterFinancialObservation({
      orderId: ORDER_ID,
      paymentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source: "WEBHOOK",
      result: "REJECTED",
    });
    await observer.afterFinancialObservation({
      orderId: ORDER_ID,
      paymentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source: "WEBHOOK",
      result: "REVIEW",
    });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenNthCalledWith(1, ORDER_ID);
    expect(execute).toHaveBeenNthCalledWith(2, ORDER_ID);
  });
});
