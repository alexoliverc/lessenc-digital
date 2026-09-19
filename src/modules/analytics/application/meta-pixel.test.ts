import { describe, expect, it } from "vitest";

import type { AnalyticsEventRecord } from "../../attribution/application/persistence";
import { projectMetaPixelCanonicalPurchase } from "./meta-pixel";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

const EVENT_ID = "22222222-2222-4222-8222-222222222222";

const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

const OFFER_ID = "44444444-4444-4444-8444-444444444444";

function canonicalPurchase(overrides: Partial<AnalyticsEventRecord> = {}): AnalyticsEventRecord {
  return {
    id: EVENT_ID,

    type: "PURCHASE",

    occurredAt: new Date("2026-09-19T19:00:00.000Z"),

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

    createdAt: new Date("2026-09-19T19:00:01.000Z"),

    ...overrides,
  };
}

describe("P13-F4 Meta Pixel canonical purchase projection", () => {
  it("projects canonical PURCHASE into a GTM-managed Meta Pixel event", () => {
    expect(projectMetaPixelCanonicalPurchase(canonicalPurchase())).toEqual({
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

  it("uses exactly the canonical AnalyticsEvent.id as future Pixel/CAPI dedupe identity", () => {
    const result = projectMetaPixelCanonicalPurchase(canonicalPurchase());

    expect(result).not.toBeNull();

    expect(result?.event_id).toBe(EVENT_ID);

    expect(result?.lessenc_event_id).toBe(EVENT_ID);

    expect(result?.event_id).toBe(result?.lessenc_event_id);
  });

  it("suppresses Pixel projection unless advertising consent is canonically eligible", () => {
    expect(
      projectMetaPixelCanonicalPurchase(
        canonicalPurchase({
          consentSnapshot: Object.freeze({
            analytics: "GRANTED",

            advertising: "DENIED",

            policyVersion: "p13-architecture-freeze-r2",
          }),
        }),
      ),
    ).toBeNull();

    expect(
      projectMetaPixelCanonicalPurchase(
        canonicalPurchase({
          consentSnapshot: Object.freeze({
            analytics: "UNKNOWN",

            advertising: "UNKNOWN",

            policyVersion: "p13-architecture-freeze-r2",
          }),
        }),
      ),
    ).toBeNull();
  });

  it("refuses to reinterpret a non-PURCHASE AnalyticsEvent as Pixel Purchase", () => {
    expect(() =>
      projectMetaPixelCanonicalPurchase(
        canonicalPurchase({
          type: "VIEW_CONTENT",

          purchaseOrderKey: null,
        }),
      ),
    ).toThrow("META_PIXEL_REQUIRES_CANONICAL_PURCHASE");
  });

  it("requires canonical Order, Product, Offer, and purchase uniqueness", () => {
    expect(() =>
      projectMetaPixelCanonicalPurchase(
        canonicalPurchase({
          orderId: null,
        }),
      ),
    ).toThrow("MISSING_META_PIXEL_TRANSACTION_ID");

    expect(() =>
      projectMetaPixelCanonicalPurchase(
        canonicalPurchase({
          purchaseOrderKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
      ),
    ).toThrow("INVALID_META_PIXEL_PURCHASE_ORDER_KEY");

    expect(() =>
      projectMetaPixelCanonicalPurchase(
        canonicalPurchase({
          productId: null,
        }),
      ),
    ).toThrow("MISSING_META_PIXEL_PRODUCT_ID");

    expect(() =>
      projectMetaPixelCanonicalPurchase(
        canonicalPurchase({
          offerId: null,
        }),
      ),
    ).toThrow("MISSING_META_PIXEL_OFFER_ID");
  });

  it("uses only authoritative BRL money and never fabricates Pixel value", () => {
    expect(() =>
      projectMetaPixelCanonicalPurchase(
        canonicalPurchase({
          amountMinor: null,

          currency: null,
        }),
      ),
    ).toThrow("MISSING_META_PIXEL_AUTHORITATIVE_MONEY");

    expect(() =>
      projectMetaPixelCanonicalPurchase(
        canonicalPurchase({
          amountMinor: -1,
        }),
      ),
    ).toThrow("INVALID_META_PIXEL_AMOUNT_MINOR");

    expect(() =>
      projectMetaPixelCanonicalPurchase(
        canonicalPurchase({
          currency: "USD",
        }),
      ),
    ).toThrow("UNSUPPORTED_META_PIXEL_CURRENCY");
  });
});
