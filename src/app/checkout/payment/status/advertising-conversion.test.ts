import { describe, expect, it, vi } from "vitest";

import type { GoogleAdsConversionDataLayerEvent } from "@/modules/analytics/application/google-ads-conversion";

import {
  attachCanonicalAdvertisingConversion,
  type CanonicalGoogleAdsConversionLoader,
} from "./advertising-conversion";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function conversion(): GoogleAdsConversionDataLayerEvent {
  return {
    event: "lessenc_google_ads_conversion",
    lessenc_event_id: "22222222-2222-4222-8222-222222222222",
    transaction_id: ORDER_ID,
    value: 139.9,
    currency: "BRL",
  };
}

describe("P13-F3 payment status canonical Google Ads envelope", () => {
  it("does not query Ads projection for a non-approved financial state", async () => {
    const execute = vi.fn<CanonicalGoogleAdsConversionLoader["execute"]>();

    const result = await attachCanonicalAdvertisingConversion({
      orderId: ORDER_ID,
      payment: {
        state: "processing",
        presentation: null,
        analyticsPurchase: null,
      },
      loader: {
        execute,
      },
    });

    expect(execute).not.toHaveBeenCalled();

    expect(result).toEqual({
      state: "processing",
      presentation: null,
      analyticsPurchase: null,
      advertisingConversion: null,
    });
  });

  it("attaches canonical Ads conversion only after approved financial truth", async () => {
    const canonicalConversion = conversion();

    const execute = vi.fn<CanonicalGoogleAdsConversionLoader["execute"]>(
      async () => canonicalConversion,
    );

    const result = await attachCanonicalAdvertisingConversion({
      orderId: ORDER_ID,
      payment: {
        state: "approved",
        presentation: null,
        analyticsPurchase: null,
      },
      loader: {
        execute,
      },
    });

    expect(execute).toHaveBeenCalledWith(ORDER_ID);

    expect(result).toEqual({
      state: "approved",
      presentation: null,
      analyticsPurchase: null,
      advertisingConversion: canonicalConversion,
    });
  });

  it("preserves approved financial and GA4 truth when Ads conversion is suppressed", async () => {
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

    const result = await attachCanonicalAdvertisingConversion({
      orderId: ORDER_ID,
      payment: {
        state: "approved",
        presentation: null,
        analyticsPurchase,
      },
      loader: {
        execute: async () => null,
      },
    });

    expect(result).toEqual({
      state: "approved",
      presentation: null,
      analyticsPurchase,
      advertisingConversion: null,
    });
  });

  it("isolates Google Ads failure without changing payment or GA4 projection", async () => {
    const failure = vi.fn();

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

    const result = await attachCanonicalAdvertisingConversion({
      orderId: ORDER_ID,
      payment: {
        state: "approved",
        presentation: null,
        analyticsPurchase,
      },
      loader: {
        execute: async () => {
          throw new Error("ADS_UNAVAILABLE");
        },
      },
      onFailure: failure,
    });

    expect(failure).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      state: "approved",
      presentation: null,
      analyticsPurchase,
      advertisingConversion: null,
    });
  });
});
