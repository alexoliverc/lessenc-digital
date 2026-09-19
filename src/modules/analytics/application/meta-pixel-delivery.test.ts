import { describe, expect, it, vi } from "vitest";

import type {
  AnalyticsEventRecord,
  AnalyticsEventRepository,
} from "../../attribution/application/persistence";
import { LoadMetaPixelCanonicalPurchaseForBrowser } from "./meta-pixel-delivery";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

const EVENT_ID = "22222222-2222-4222-8222-222222222222";

const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

const OFFER_ID = "44444444-4444-4444-8444-444444444444";

function canonicalPurchase(overrides: Partial<AnalyticsEventRecord> = {}): AnalyticsEventRecord {
  return {
    id: EVENT_ID,
    type: "PURCHASE",
    occurredAt: new Date("2026-09-19T19:30:00.000Z"),
    journeyId: "55555555-5555-4555-8555-555555555555",
    productId: PRODUCT_ID,
    offerId: OFFER_ID,
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
    createdAt: new Date("2026-09-19T19:30:01.000Z"),
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

describe("P13-F4 canonical Meta Pixel browser delivery", () => {
  it("rejects invalid Order identity before querying persistence", async () => {
    const repo = repository(canonicalPurchase());

    const delivery = new LoadMetaPixelCanonicalPurchaseForBrowser(repo);

    await expect(delivery.execute("   ")).rejects.toThrow("INVALID_META_PIXEL_DELIVERY_ORDER_ID");

    expect(repo.findPurchaseByOrderKey).not.toHaveBeenCalled();
  });

  it("returns null while no canonical PURCHASE exists", async () => {
    const repo = repository(null);

    const delivery = new LoadMetaPixelCanonicalPurchaseForBrowser(repo);

    await expect(delivery.execute(ORDER_ID)).resolves.toBeNull();

    expect(repo.findPurchaseByOrderKey).toHaveBeenCalledWith(ORDER_ID);
  });

  it("suppresses delivery when canonical advertising consent is not eligible", async () => {
    const delivery = new LoadMetaPixelCanonicalPurchaseForBrowser(
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
    const anotherOrder = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const delivery = new LoadMetaPixelCanonicalPurchaseForBrowser(
      repository(
        canonicalPurchase({
          orderId: anotherOrder,
          purchaseOrderKey: anotherOrder,
        }),
      ),
    );

    await expect(delivery.execute(ORDER_ID)).rejects.toThrow("META_PIXEL_DELIVERY_ORDER_MISMATCH");
  });

  it("preserves canonical event identity for future Pixel/CAPI deduplication", async () => {
    const delivery = new LoadMetaPixelCanonicalPurchaseForBrowser(repository(canonicalPurchase()));

    await expect(delivery.execute(ORDER_ID)).resolves.toEqual({
      event: "lessenc_meta_pixel_purchase",
      lessenc_event_id: EVENT_ID,
      event_id: EVENT_ID,
      transaction_id: ORDER_ID,
      value: 139.9,
      currency: "BRL",
      content_ids: [PRODUCT_ID],
      content_type: "product",
      lessenc_offer_id: OFFER_ID,
    });
  });
});
