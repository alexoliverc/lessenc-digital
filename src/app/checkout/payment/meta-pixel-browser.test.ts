import { describe, expect, it } from "vitest";

import type { MetaPixelPurchaseDataLayerEvent } from "@/modules/analytics/application/meta-pixel";

import {
  deliverCanonicalMetaPixelPurchaseToBrowser,
  parseCanonicalMetaPixelPurchase,
  pushCanonicalMetaPixelPurchaseAfterConsent,
  readCurrentMetaConsent,
} from "./meta-pixel-browser";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

const EVENT_ID = "22222222-2222-4222-8222-222222222222";

function purchase(): MetaPixelPurchaseDataLayerEvent {
  return {
    event: "lessenc_meta_pixel_purchase",

    lessenc_event_id: EVENT_ID,

    event_id: EVENT_ID,

    transaction_id: ORDER_ID,

    value: 139.9,

    currency: "BRL",

    content_ids: ["33333333-3333-4333-8333-333333333333"],

    content_type: "product",

    lessenc_offer_id: "44444444-4444-4444-8444-444444444444",
  };
}

function consentResponse(
  analytics: "UNKNOWN" | "GRANTED" | "DENIED",

  advertising: "UNKNOWN" | "GRANTED" | "DENIED",
): Response {
  return new Response(
    JSON.stringify({
      analytics,
      advertising,
      policyVersion: "p13-architecture-freeze-r2",
    }),
    {
      status: 200,

      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

describe("P13-F4 Meta Pixel browser delivery", () => {
  it("accepts only the canonical server Meta purchase envelope", () => {
    expect(parseCanonicalMetaPixelPurchase(purchase())).toEqual(purchase());
  });

  it("rejects malformed, PII-extended, Pixel-configured, or identity-mismatched envelopes", () => {
    expect(parseCanonicalMetaPixelPurchase(null)).toBeNull();

    expect(
      parseCanonicalMetaPixelPurchase({
        ...purchase(),
        event: "Purchase",
      }),
    ).toBeNull();

    expect(
      parseCanonicalMetaPixelPurchase({
        ...purchase(),
        event_id: "different-event-id",
      }),
    ).toBeNull();

    expect(
      parseCanonicalMetaPixelPurchase({
        ...purchase(),
        content_ids: [],
      }),
    ).toBeNull();

    expect(
      parseCanonicalMetaPixelPurchase({
        ...purchase(),
        value: Number.NaN,
      }),
    ).toBeNull();

    expect(
      parseCanonicalMetaPixelPurchase({
        ...purchase(),
        email: "buyer@example.invalid",
      }),
    ).toBeNull();

    expect(
      parseCanonicalMetaPixelPurchase({
        ...purchase(),
        pixel_id: "000000000000000",
      }),
    ).toBeNull();

    expect(
      parseCanonicalMetaPixelPurchase({
        ...purchase(),
        _fbp: "fb.1.invalid",
      }),
    ).toBeNull();
  });

  it("suppresses browser delivery when current advertising consent is denied", () => {
    const dataLayer: unknown[] = [];

    expect(
      pushCanonicalMetaPixelPurchaseAfterConsent({
        purchase: purchase(),

        advertisingConsent: "DENIED",

        dataLayer,

        deliveredKeys: new Set(),
      }),
    ).toBe("SUPPRESSED_BY_CURRENT_CONSENT");

    expect(dataLayer).toEqual([]);
  });

  it("uses advertising consent independently at the browser push boundary", () => {
    const dataLayer: unknown[] = [];

    expect(
      pushCanonicalMetaPixelPurchaseAfterConsent({
        purchase: purchase(),

        advertisingConsent: "GRANTED",

        dataLayer,

        deliveredKeys: new Set(),
      }),
    ).toBe("DELIVERED");

    expect(dataLayer).toEqual([purchase()]);
  });

  it("pushes exactly one canonical Meta event and records session dedupe", () => {
    const dataLayer: unknown[] = [];

    const deliveredKeys = new Set<string>();

    const values = new Map<string, string>();

    const storage = {
      getItem(key: string) {
        return values.get(key) ?? null;
      },

      setItem(key: string, value: string) {
        values.set(key, value);
      },
    };

    expect(
      pushCanonicalMetaPixelPurchaseAfterConsent({
        purchase: purchase(),

        advertisingConsent: "GRANTED",

        dataLayer,

        deliveredKeys,

        storage,
      }),
    ).toBe("DELIVERED");

    expect(dataLayer).toEqual([purchase()]);

    expect(deliveredKeys.size).toBe(1);

    expect(values.size).toBe(1);
  });

  it("deduplicates replay within the same page lifetime", () => {
    const dataLayer: unknown[] = [];

    const deliveredKeys = new Set<string>();

    expect(
      pushCanonicalMetaPixelPurchaseAfterConsent({
        purchase: purchase(),

        advertisingConsent: "GRANTED",

        dataLayer,

        deliveredKeys,
      }),
    ).toBe("DELIVERED");

    expect(
      pushCanonicalMetaPixelPurchaseAfterConsent({
        purchase: purchase(),

        advertisingConsent: "GRANTED",

        dataLayer,

        deliveredKeys,
      }),
    ).toBe("DUPLICATE");

    expect(dataLayer).toEqual([purchase()]);
  });

  it("deduplicates replay across fresh page-memory state using sessionStorage", () => {
    const dataLayer: unknown[] = [];

    const values = new Map<string, string>();

    const storage = {
      getItem(key: string) {
        return values.get(key) ?? null;
      },

      setItem(key: string, value: string) {
        values.set(key, value);
      },
    };

    expect(
      pushCanonicalMetaPixelPurchaseAfterConsent({
        purchase: purchase(),

        advertisingConsent: "GRANTED",

        dataLayer,

        deliveredKeys: new Set(),

        storage,
      }),
    ).toBe("DELIVERED");

    expect(
      pushCanonicalMetaPixelPurchaseAfterConsent({
        purchase: purchase(),

        advertisingConsent: "GRANTED",

        dataLayer,

        deliveredKeys: new Set(),

        storage,
      }),
    ).toBe("DUPLICATE");

    expect(dataLayer).toHaveLength(1);
  });

  it("preserves advertising GRANTED when current analytics consent is DENIED", async () => {
    const consent = await readCurrentMetaConsent(async () => consentResponse("DENIED", "GRANTED"));

    expect(consent).toEqual({
      analytics: "DENIED",

      advertising: "GRANTED",

      policyVersion: "p13-architecture-freeze-r2",
    });
  });

  it("does not suppress Meta for analytics DENIED when advertising is GRANTED", async () => {
    const result = await deliverCanonicalMetaPixelPurchaseToBrowser({
      purchase: purchase(),

      /*
       * Null GTM is intentional. Reaching GTM_DISABLED
       * proves the advertising-consent gate was passed.
       */
      gtmContainerId: null,

      deliveredKeys: new Set(),

      fetcher: async () => consentResponse("DENIED", "GRANTED"),
    });

    expect(result).toBe("GTM_DISABLED");
  });

  it("fails closed when the current consent endpoint is invalid or unavailable", async () => {
    const invalid = await readCurrentMetaConsent(
      async () =>
        new Response(
          JSON.stringify({
            analytics: "DENIED",

            advertising: "INVALID",
          }),
          {
            status: 200,
          },
        ),
    );

    expect(invalid).toEqual({
      analytics: "UNKNOWN",

      advertising: "UNKNOWN",

      policyVersion: "unknown",
    });

    const unavailable = await deliverCanonicalMetaPixelPurchaseToBrowser({
      purchase: purchase(),

      gtmContainerId: "GTM-ABC1234",

      deliveredKeys: new Set(),

      fetcher: async () => {
        throw new Error("network unavailable");
      },
    });

    expect(unavailable).toBe("SUPPRESSED_BY_CURRENT_CONSENT");
  });
});
