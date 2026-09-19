import { describe, expect, it, vi } from "vitest";

import type { Ga4DataLayerEvent } from "@/modules/analytics/application/google-analytics-4";

import {
  attachCanonicalAnalyticsPurchase,
  type CanonicalPurchaseBrowserLoader,
} from "./analytics-purchase";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function purchase(): Ga4DataLayerEvent {
  return {
    event: "purchase",
    lessenc_event_id: "22222222-2222-4222-8222-222222222222",
    ecommerce: {
      currency: "BRL",
      value: 139.9,
      transaction_id: ORDER_ID,
      items: [
        {
          item_id: "33333333-3333-4333-8333-333333333333",
          price: 139.9,
          quantity: 1,
          lessenc_offer_id: "44444444-4444-4444-8444-444444444444",
        },
      ],
    },
  };
}

describe("P13-F2 payment status canonical analytics envelope", () => {
  it("does not query analytics for a non-approved financial state", async () => {
    const execute = vi.fn<CanonicalPurchaseBrowserLoader["execute"]>();

    const result = await attachCanonicalAnalyticsPurchase({
      orderId: ORDER_ID,
      payment: {
        state: "processing",
        presentation: null,
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
    });
  });

  it("attaches the canonical purchase only after the financial state is approved", async () => {
    const canonicalPurchase = purchase();

    const execute = vi.fn<CanonicalPurchaseBrowserLoader["execute"]>(async () => canonicalPurchase);

    const result = await attachCanonicalAnalyticsPurchase({
      orderId: ORDER_ID,
      payment: {
        state: "approved",
        presentation: null,
      },
      loader: {
        execute,
      },
    });

    expect(execute).toHaveBeenCalledTimes(1);

    expect(execute).toHaveBeenCalledWith(ORDER_ID);

    expect(result).toEqual({
      state: "approved",
      presentation: null,
      analyticsPurchase: canonicalPurchase,
    });
  });

  it("returns approved financial truth with null analytics when canonical delivery is suppressed", async () => {
    const execute = vi.fn<CanonicalPurchaseBrowserLoader["execute"]>(async () => null);

    const result = await attachCanonicalAnalyticsPurchase({
      orderId: ORDER_ID,
      payment: {
        state: "approved",
        presentation: null,
      },
      loader: {
        execute,
      },
    });

    expect(result).toEqual({
      state: "approved",
      presentation: null,
      analyticsPurchase: null,
    });
  });

  it("isolates analytics failure without changing approved financial truth", async () => {
    const failure = vi.fn();

    const execute = vi.fn<CanonicalPurchaseBrowserLoader["execute"]>(async () => {
      throw new Error("ANALYTICS_UNAVAILABLE");
    });

    const result = await attachCanonicalAnalyticsPurchase({
      orderId: ORDER_ID,
      payment: {
        state: "approved",
        presentation: null,
      },
      loader: {
        execute,
      },
      onFailure: failure,
    });

    expect(failure).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      state: "approved",
      presentation: null,
      analyticsPurchase: null,
    });
  });
});
