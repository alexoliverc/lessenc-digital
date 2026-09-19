import { describe, expect, it, vi } from "vitest";

import type {
  AnalyticsEventRecord,
  AnalyticsEventRepository,
} from "../../attribution/application/persistence";
import { LoadGoogleAdsCanonicalConversionForBrowser } from "./google-ads-conversion-delivery";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function canonicalPurchase(overrides: Partial<AnalyticsEventRecord> = {}): AnalyticsEventRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    type: "PURCHASE",
    occurredAt: new Date("2026-09-19T18:30:00.000Z"),
    journeyId: "33333333-3333-4333-8333-333333333333",
    productId: "44444444-4444-4444-8444-444444444444",
    offerId: "55555555-5555-4555-8555-555555555555",
    orderId: ORDER_ID,
    amountMinor: 13_990,
    currency: "BRL",
    attributionState: "ATTRIBUTED",
    consentSnapshot: Object.freeze({
      analytics: "GRANTED",
      advertising: "GRANTED",
      policyVersion: "p13-architecture-freeze-r2",
    }),
    schemaVersion: 1,
    purchaseOrderKey: ORDER_ID,
    createdAt: new Date("2026-09-19T18:30:01.000Z"),
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

describe("P13-F3 canonical Google Ads browser delivery", () => {
  it("rejects invalid Order identity before querying persistence", async () => {
    const repo = repository(canonicalPurchase());

    const delivery = new LoadGoogleAdsCanonicalConversionForBrowser(repo);

    await expect(delivery.execute("   ")).rejects.toThrow("INVALID_GOOGLE_ADS_DELIVERY_ORDER_ID");

    expect(repo.findPurchaseByOrderKey).not.toHaveBeenCalled();
  });

  it("returns null while no canonical PURCHASE exists", async () => {
    const repo = repository(null);

    const delivery = new LoadGoogleAdsCanonicalConversionForBrowser(repo);

    await expect(delivery.execute(ORDER_ID)).resolves.toBeNull();

    expect(repo.findPurchaseByOrderKey).toHaveBeenCalledWith(ORDER_ID);
  });

  it("suppresses delivery when the canonical advertising consent was denied", async () => {
    const delivery = new LoadGoogleAdsCanonicalConversionForBrowser(
      repository(
        canonicalPurchase({
          consentSnapshot: Object.freeze({
            analytics: "GRANTED",
            advertising: "DENIED",
            policyVersion: "p13-architecture-freeze-r2",
          }),
        }),
      ),
    );

    await expect(delivery.execute(ORDER_ID)).resolves.toBeNull();
  });

  it("fails closed if persistence returns a PURCHASE for another Order", async () => {
    const differentOrder = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const delivery = new LoadGoogleAdsCanonicalConversionForBrowser(
      repository(
        canonicalPurchase({
          orderId: differentOrder,
          purchaseOrderKey: differentOrder,
        }),
      ),
    );

    await expect(delivery.execute(ORDER_ID)).rejects.toThrow("GOOGLE_ADS_DELIVERY_ORDER_MISMATCH");
  });

  it("delivers only the canonical Google Ads conversion projection", async () => {
    const delivery = new LoadGoogleAdsCanonicalConversionForBrowser(
      repository(canonicalPurchase()),
    );

    await expect(delivery.execute(ORDER_ID)).resolves.toEqual({
      event: "lessenc_google_ads_conversion",
      lessenc_event_id: "22222222-2222-4222-8222-222222222222",
      transaction_id: ORDER_ID,
      value: 139.9,
      currency: "BRL",
    });
  });
});
