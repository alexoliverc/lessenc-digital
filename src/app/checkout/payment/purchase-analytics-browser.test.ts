import { describe, expect, it, vi } from "vitest";

import type { AnalyticsConsentProjection } from "@/modules/analytics/application/consent";
import type { Ga4DataLayerEvent } from "@/modules/analytics/application/google-analytics-4";

import {
  parseCanonicalGa4Purchase,
  pushCanonicalGa4PurchaseAfterConsent,
  readCurrentAnalyticsConsent,
} from "./purchase-analytics-browser";

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

const grantedConsent: AnalyticsConsentProjection = Object.freeze({
  analytics: "GRANTED",
  advertising: "DENIED",
  policyVersion: "p13-architecture-freeze-r2",
});

describe("P13-F2 canonical GA4 purchase browser delivery", () => {
  it("accepts the canonical server PURCHASE envelope", () => {
    expect(parseCanonicalGa4Purchase(purchase())).toEqual(purchase());
  });

  it("rejects malformed, non-purchase, or non-canonical quantity envelopes", () => {
    expect(parseCanonicalGa4Purchase(null)).toBeNull();

    expect(
      parseCanonicalGa4Purchase({
        ...purchase(),
        event: "view_item",
      }),
    ).toBeNull();

    expect(
      parseCanonicalGa4Purchase({
        ...purchase(),
        ecommerce: {
          ...purchase().ecommerce,
          transaction_id: "",
        },
      }),
    ).toBeNull();

    expect(
      parseCanonicalGa4Purchase({
        ...purchase(),
        ecommerce: {
          ...purchase().ecommerce,
          items: [
            {
              ...purchase().ecommerce.items[0],
              quantity: 2,
            },
          ],
        },
      }),
    ).toBeNull();
  });

  it("reads current first-party analytics consent with no-store semantics", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(grantedConsent), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
    );

    await expect(readCurrentAnalyticsConsent(fetcher)).resolves.toEqual(grantedConsent);

    expect(fetcher).toHaveBeenCalledWith("/api/analytics/consent", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
  });

  it("fails closed to UNKNOWN when current consent cannot be read", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("CONSENT_UNAVAILABLE");
    });

    await expect(readCurrentAnalyticsConsent(fetcher)).resolves.toEqual({
      analytics: "UNKNOWN",
      advertising: "UNKNOWN",
      policyVersion: "p13-architecture-freeze-r2",
    });
  });

  it("does not push purchase when current analytics consent is not granted", () => {
    const dataLayer: unknown[] = [];

    const result = pushCanonicalGa4PurchaseAfterConsent({
      purchase: purchase(),
      consent: {
        analytics: "DENIED",
        advertising: "DENIED",
        policyVersion: "p13-architecture-freeze-r2",
      },
      dataLayer,
      deliveredKeys: new Set(),
    });

    expect(result).toBe("SUPPRESSED_BY_CURRENT_CONSENT");

    expect(dataLayer).toEqual([]);
  });

  it("pushes consent update then ecommerce clear then canonical purchase", () => {
    const dataLayer: unknown[] = [];

    const stored = new Map<string, string>();

    const storage = {
      getItem(key: string) {
        return stored.get(key) ?? null;
      },

      setItem(key: string, value: string) {
        stored.set(key, value);
      },
    };

    const deliveredKeys = new Set<string>();

    expect(
      pushCanonicalGa4PurchaseAfterConsent({
        purchase: purchase(),
        consent: grantedConsent,
        dataLayer,
        deliveredKeys,
        storage,
      }),
    ).toBe("DELIVERED");

    expect(dataLayer).toEqual([
      {
        event: "lessenc_consent_update",
        analyticsAllowed: true,
        advertisingAllowed: false,
        consentPolicyVersion: "p13-architecture-freeze-r2",
      },
      {
        ecommerce: null,
      },
      purchase(),
    ]);

    expect(deliveredKeys.size).toBe(1);

    expect(stored.size).toBe(1);
  });

  it("deduplicates the same canonical purchase before a second dataLayer push", () => {
    const dataLayer: unknown[] = [];

    const deliveredKeys = new Set<string>();

    expect(
      pushCanonicalGa4PurchaseAfterConsent({
        purchase: purchase(),
        consent: grantedConsent,
        dataLayer,
        deliveredKeys,
      }),
    ).toBe("DELIVERED");

    expect(
      pushCanonicalGa4PurchaseAfterConsent({
        purchase: purchase(),
        consent: grantedConsent,
        dataLayer,
        deliveredKeys,
      }),
    ).toBe("DUPLICATE");

    expect(dataLayer).toHaveLength(3);

    expect(dataLayer[2]).toEqual(purchase());
  });
});
