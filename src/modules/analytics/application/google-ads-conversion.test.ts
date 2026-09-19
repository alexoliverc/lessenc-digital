import { describe, expect, it } from "vitest";

import type { AnalyticsEventRecord } from "../../attribution/application/persistence";
import { projectGoogleAdsCanonicalPurchase } from "./google-ads-conversion";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function canonicalPurchase(overrides: Partial<AnalyticsEventRecord> = {}): AnalyticsEventRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    type: "PURCHASE",
    occurredAt: new Date("2026-09-19T18:00:00.000Z"),
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
    createdAt: new Date("2026-09-19T18:00:01.000Z"),
    ...overrides,
  };
}

describe("P13-F3 Google Ads canonical purchase projection", () => {
  it("projects authoritative PURCHASE into a GTM-managed Google Ads conversion event", () => {
    expect(projectGoogleAdsCanonicalPurchase(canonicalPurchase())).toEqual({
      event: "lessenc_google_ads_conversion",
      lessenc_event_id: "22222222-2222-4222-8222-222222222222",
      transaction_id: ORDER_ID,
      value: 139.9,
      currency: "BRL",
    });
  });

  it("suppresses the Ads conversion when advertising consent was denied", () => {
    expect(
      projectGoogleAdsCanonicalPurchase(
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

  it("fails closed when the canonical consent snapshot is not fully eligible for advertising", () => {
    expect(
      projectGoogleAdsCanonicalPurchase(
        canonicalPurchase({
          consentSnapshot: Object.freeze({
            analytics: "DENIED",
            advertising: "GRANTED",
            policyVersion: "p13-architecture-freeze-r2",
          }),
        }),
      ),
    ).toBeNull();

    expect(
      projectGoogleAdsCanonicalPurchase(
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

  it("refuses to reinterpret a non-PURCHASE AnalyticsEvent as a Google Ads conversion", () => {
    expect(() =>
      projectGoogleAdsCanonicalPurchase(
        canonicalPurchase({
          type: "VIEW_CONTENT",
          purchaseOrderKey: null,
        }),
      ),
    ).toThrow("GOOGLE_ADS_REQUIRES_CANONICAL_PURCHASE");
  });

  it("requires canonical Order identity and purchase-order uniqueness", () => {
    expect(() =>
      projectGoogleAdsCanonicalPurchase(
        canonicalPurchase({
          orderId: null,
        }),
      ),
    ).toThrow("MISSING_GOOGLE_ADS_TRANSACTION_ID");

    expect(() =>
      projectGoogleAdsCanonicalPurchase(
        canonicalPurchase({
          purchaseOrderKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
      ),
    ).toThrow("INVALID_GOOGLE_ADS_PURCHASE_ORDER_KEY");
  });

  it("uses only authoritative BRL money and never fabricates a conversion value", () => {
    expect(() =>
      projectGoogleAdsCanonicalPurchase(
        canonicalPurchase({
          amountMinor: null,
          currency: null,
        }),
      ),
    ).toThrow("MISSING_GOOGLE_ADS_AUTHORITATIVE_MONEY");

    expect(() =>
      projectGoogleAdsCanonicalPurchase(
        canonicalPurchase({
          amountMinor: -1,
        }),
      ),
    ).toThrow("INVALID_GOOGLE_ADS_AMOUNT_MINOR");

    expect(() =>
      projectGoogleAdsCanonicalPurchase(
        canonicalPurchase({
          currency: "USD",
        }),
      ),
    ).toThrow("UNSUPPORTED_GOOGLE_ADS_CURRENCY");
  });
});
