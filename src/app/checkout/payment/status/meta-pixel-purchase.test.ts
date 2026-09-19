import { describe, expect, it, vi } from "vitest";

import type { MetaPixelPurchaseDataLayerEvent } from "@/modules/analytics/application/meta-pixel";

import {
  attachCanonicalMetaPixelPurchase,
  type CanonicalMetaPixelPurchaseLoader,
} from "./meta-pixel-purchase";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function metaPurchase(): MetaPixelPurchaseDataLayerEvent {
  return {
    event: "lessenc_meta_pixel_purchase",
    lessenc_event_id: "22222222-2222-4222-8222-222222222222",
    event_id: "22222222-2222-4222-8222-222222222222",
    transaction_id: ORDER_ID,
    value: 139.9,
    currency: "BRL",
    content_ids: ["33333333-3333-4333-8333-333333333333"],
    content_type: "product",
    lessenc_offer_id: "44444444-4444-4444-8444-444444444444",
  };
}

describe("P13-F4 payment status canonical Meta Pixel envelope", () => {
  it("does not query Meta projection before approved financial truth", async () => {
    const execute = vi.fn<CanonicalMetaPixelPurchaseLoader["execute"]>();

    const result = await attachCanonicalMetaPixelPurchase({
      orderId: ORDER_ID,
      payment: {
        state: "processing",
        presentation: null,
        analyticsPurchase: null,
        advertisingConversion: null,
      },
      loader: {
        execute,
      },
    });

    expect(execute).not.toHaveBeenCalled();

    expect(result.metaPixelPurchase).toBeNull();
  });

  it("attaches canonical Meta Pixel projection only after approved financial truth", async () => {
    const canonical = metaPurchase();

    const execute = vi.fn<CanonicalMetaPixelPurchaseLoader["execute"]>(async () => canonical);

    const result = await attachCanonicalMetaPixelPurchase({
      orderId: ORDER_ID,
      payment: {
        state: "approved",
        presentation: null,
        analyticsPurchase: null,
        advertisingConversion: null,
      },
      loader: {
        execute,
      },
    });

    expect(execute).toHaveBeenCalledWith(ORDER_ID);

    expect(result.metaPixelPurchase).toEqual(canonical);
  });

  it("preserves GA4 and Google Ads projections when Meta is suppressed", async () => {
    const analyticsPurchase = {
      event: "purchase" as const,
      lessenc_event_id: "ga4-event",
      ecommerce: {
        currency: "BRL" as const,
        value: 139.9,
        transaction_id: ORDER_ID,
        items: [
          {
            item_id: "product-1",
            price: 139.9,
            quantity: 1 as const,
            lessenc_offer_id: "offer-1",
          },
        ],
      },
    };

    const advertisingConversion = {
      event: "lessenc_google_ads_conversion" as const,
      lessenc_event_id: "ads-event",
      transaction_id: ORDER_ID,
      value: 139.9,
      currency: "BRL" as const,
    };

    const result = await attachCanonicalMetaPixelPurchase({
      orderId: ORDER_ID,
      payment: {
        state: "approved",
        presentation: null,
        analyticsPurchase,
        advertisingConversion,
      },
      loader: {
        execute: async () => null,
      },
    });

    expect(result.analyticsPurchase).toBe(analyticsPurchase);

    expect(result.advertisingConversion).toBe(advertisingConversion);

    expect(result.metaPixelPurchase).toBeNull();
  });

  it("isolates Meta failure without changing payment, GA4, or Google Ads truth", async () => {
    const failure = vi.fn();

    const advertisingConversion = {
      event: "lessenc_google_ads_conversion" as const,
      lessenc_event_id: "ads-event",
      transaction_id: ORDER_ID,
      value: 139.9,
      currency: "BRL" as const,
    };

    const result = await attachCanonicalMetaPixelPurchase({
      orderId: ORDER_ID,
      payment: {
        state: "approved",
        presentation: null,
        analyticsPurchase: null,
        advertisingConversion,
      },
      loader: {
        execute: async () => {
          throw new Error("META_PIXEL_UNAVAILABLE");
        },
      },
      onFailure: failure,
    });

    expect(failure).toHaveBeenCalledTimes(1);

    expect(result.state).toBe("approved");

    expect(result.advertisingConversion).toBe(advertisingConversion);

    expect(result.metaPixelPurchase).toBeNull();
  });
});
