import { describe, expect, it } from "vitest";

import type { AnalyticsEventRecord } from "../../attribution/application/persistence";
import {
  META_CAPI_TRANSMISSION_BLOCK_REASON,
  projectMetaCapiCanonicalPurchaseCore,
} from "./meta-conversions-api";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

const EVENT_ID = "22222222-2222-4222-8222-222222222222";

const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

const OFFER_ID = "44444444-4444-4444-8444-444444444444";

const OCCURRED_AT = new Date("2026-09-19T18:30:15.987Z");

function canonicalPurchase(overrides: Partial<AnalyticsEventRecord> = {}): AnalyticsEventRecord {
  return {
    id: EVENT_ID,

    type: "PURCHASE",

    occurredAt: OCCURRED_AT,

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

    createdAt: new Date("2026-09-19T18:30:16.000Z"),

    ...overrides,
  };
}

describe("P13-F5 Meta Conversions API canonical core", () => {
  it("projects a canonical Purchase server-event core without network concerns", () => {
    expect(projectMetaCapiCanonicalPurchaseCore(canonicalPurchase())).toEqual({
      eventName: "Purchase",

      eventTime: Math.floor(OCCURRED_AT.getTime() / 1000),

      eventId: EVENT_ID,

      actionSource: "website",

      orderId: ORDER_ID,

      productId: PRODUCT_ID,

      offerId: OFFER_ID,

      value: 139.9,

      currency: "BRL",

      quantity: 1,

      transmission: {
        state: "BLOCKED",

        reason: META_CAPI_TRANSMISSION_BLOCK_REASON,
      },
    });
  });

  it("uses the exact canonical AnalyticsEvent.id shared with Meta Pixel", () => {
    const result = projectMetaCapiCanonicalPurchaseCore(canonicalPurchase());

    expect(result?.eventId).toBe(EVENT_ID);
  });

  it("uses canonical occurredAt rather than current server clock", () => {
    const event = canonicalPurchase({
      occurredAt: new Date("2026-01-02T03:04:05.999Z"),
    });

    const result = projectMetaCapiCanonicalPurchaseCore(event);

    expect(result?.eventTime).toBe(Math.floor(event.occurredAt.getTime() / 1000));
  });

  it("preserves canonical Order, Product, Offer, and authoritative BRL value", () => {
    const result = projectMetaCapiCanonicalPurchaseCore(canonicalPurchase());

    expect(result).toMatchObject({
      orderId: ORDER_ID,

      productId: PRODUCT_ID,

      offerId: OFFER_ID,

      value: 139.9,

      currency: "BRL",

      quantity: 1,
    });
  });

  it("inherits canonical Meta purchase consent suppression", () => {
    expect(
      projectMetaCapiCanonicalPurchaseCore(
        canonicalPurchase({
          consentSnapshot: Object.freeze({
            analytics: "GRANTED",

            advertising: "DENIED",

            policyVersion: "p13-architecture-freeze-r2",
          }),
        }),
      ),
    ).toBeNull();
  });

  it("rejects invalid canonical event time", () => {
    expect(() =>
      projectMetaCapiCanonicalPurchaseCore(
        canonicalPurchase({
          occurredAt: new Date(Number.NaN),
        }),
      ),
    ).toThrow("INVALID_META_CAPI_EVENT_TIME");
  });

  it("is explicitly blocked from external transmission until matching-data policy is authorized", () => {
    const result = projectMetaCapiCanonicalPurchaseCore(canonicalPurchase());

    expect(result?.transmission).toEqual({
      state: "BLOCKED",

      reason: "MATCHING_DATA_POLICY_NOT_AUTHORIZED",
    });
  });
});
