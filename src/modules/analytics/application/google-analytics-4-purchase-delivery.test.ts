import { describe, expect, it, vi } from "vitest";

import type {
  AnalyticsEventRecord,
  AnalyticsEventRepository,
} from "../../attribution/application/persistence";
import { LoadGa4CanonicalPurchaseForBrowser } from "./google-analytics-4-purchase-delivery";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function canonicalPurchase(overrides: Partial<AnalyticsEventRecord> = {}): AnalyticsEventRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    type: "PURCHASE",
    occurredAt: new Date("2026-09-19T15:00:00.000Z"),
    journeyId: "33333333-3333-4333-8333-333333333333",
    productId: "44444444-4444-4444-8444-444444444444",
    offerId: "55555555-5555-4555-8555-555555555555",
    orderId: ORDER_ID,
    amountMinor: 13_990,
    currency: "BRL",
    attributionState: "ATTRIBUTED",
    consentSnapshot: Object.freeze({
      analytics: "GRANTED",
      advertising: "DENIED",
      policyVersion: "p13-architecture-freeze-r2",
    }),
    schemaVersion: 1,
    purchaseOrderKey: ORDER_ID,
    createdAt: new Date("2026-09-19T15:00:01.000Z"),
    ...overrides,
  };
}

function repository(
  event: AnalyticsEventRecord | null,
): Pick<AnalyticsEventRepository, "findPurchaseByOrderKey"> {
  return {
    findPurchaseByOrderKey: vi.fn(async () => event),
  };
}

describe("P13-F2 canonical GA4 purchase browser delivery", () => {
  it("rejects an invalid Order identity before querying analytics persistence", async () => {
    const repo = repository(canonicalPurchase());

    const delivery = new LoadGa4CanonicalPurchaseForBrowser(repo);

    await expect(delivery.execute("   ")).rejects.toThrow("INVALID_GA4_PURCHASE_DELIVERY_ORDER_ID");

    expect(repo.findPurchaseByOrderKey).not.toHaveBeenCalled();
  });

  it("returns null when no canonical PURCHASE exists yet", async () => {
    const repo = repository(null);

    const delivery = new LoadGa4CanonicalPurchaseForBrowser(repo);

    await expect(delivery.execute(ORDER_ID)).resolves.toBeNull();

    expect(repo.findPurchaseByOrderKey).toHaveBeenCalledWith(ORDER_ID);
  });

  it("suppresses browser delivery when canonical analytics consent is not granted", async () => {
    const repo = repository(
      canonicalPurchase({
        consentSnapshot: Object.freeze({
          analytics: "DENIED",
          advertising: "DENIED",
          policyVersion: "p13-architecture-freeze-r2",
        }),
      }),
    );

    const delivery = new LoadGa4CanonicalPurchaseForBrowser(repo);

    await expect(delivery.execute(ORDER_ID)).resolves.toBeNull();
  });

  it("fails closed if persistence returns a PURCHASE belonging to another Order", async () => {
    const repo = repository(
      canonicalPurchase({
        orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        purchaseOrderKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    );

    const delivery = new LoadGa4CanonicalPurchaseForBrowser(repo);

    await expect(delivery.execute(ORDER_ID)).rejects.toThrow(
      "GA4_PURCHASE_DELIVERY_ORDER_MISMATCH",
    );
  });

  it("delivers only the canonical persisted PURCHASE projection when analytics consent is granted", async () => {
    const repo = repository(canonicalPurchase());

    const delivery = new LoadGa4CanonicalPurchaseForBrowser(repo);

    await expect(delivery.execute(ORDER_ID)).resolves.toEqual({
      event: "purchase",
      lessenc_event_id: "22222222-2222-4222-8222-222222222222",
      ecommerce: {
        currency: "BRL",
        value: 139.9,
        transaction_id: ORDER_ID,
        items: [
          {
            item_id: "44444444-4444-4444-8444-444444444444",
            price: 139.9,
            quantity: 1,
            lessenc_offer_id: "55555555-5555-4555-8555-555555555555",
          },
        ],
      },
    });
  });
});
