import { describe, expect, it } from "vitest";

import type { AnalyticsEventRecord } from "../../attribution/application/persistence";
import type { BrowserMeasurementProjection } from "./browser-measurement";
import {
  projectGa4BrowserEcommerce,
  projectGa4CanonicalPurchase,
  pushGa4EcommerceDataLayer,
} from "./google-analytics-4";

function browserMeasurement(
  overrides: Partial<BrowserMeasurementProjection> = {},
): BrowserMeasurementProjection {
  return {
    event: "lessenc_measurement",
    eventId: "analytics-event-1",
    measurementType: "VIEW_CONTENT",
    productId: "product-1",
    offerId: "offer-1",
    amountMinor: 13_990,
    currency: "BRL",
    schemaVersion: 1,
    ...overrides,
  };
}

function canonicalPurchase(overrides: Partial<AnalyticsEventRecord> = {}): AnalyticsEventRecord {
  return {
    id: "purchase-event-1",
    type: "PURCHASE",
    occurredAt: new Date("2026-09-19T12:00:00.000Z"),
    journeyId: "journey-1",
    productId: "product-1",
    offerId: "offer-1",
    orderId: "order-1",
    amountMinor: 13_990,
    currency: "BRL",
    attributionState: "ATTRIBUTED",
    consentSnapshot: Object.freeze({
      analytics: "GRANTED",
      advertising: "DENIED",
      policyVersion: "p13-architecture-freeze-r2",
    }),
    schemaVersion: 1,
    purchaseOrderKey: "order-1",
    createdAt: new Date("2026-09-19T12:00:01.000Z"),
    ...overrides,
  };
}

describe("P13-F2 GA4 ecommerce projection", () => {
  it("maps canonical VIEW_CONTENT to GA4 view_item with BRL ecommerce value", () => {
    expect(projectGa4BrowserEcommerce(browserMeasurement())).toEqual({
      event: "view_item",
      lessenc_event_id: "analytics-event-1",
      ecommerce: {
        currency: "BRL",
        value: 139.9,
        items: [
          {
            item_id: "product-1",
            price: 139.9,
            quantity: 1,
            lessenc_offer_id: "offer-1",
          },
        ],
      },
    });
  });

  it("maps canonical INITIATE_CHECKOUT to GA4 begin_checkout", () => {
    expect(
      projectGa4BrowserEcommerce(
        browserMeasurement({
          measurementType: "INITIATE_CHECKOUT",
          eventId: "analytics-event-2",
        }),
      ),
    ).toEqual({
      event: "begin_checkout",
      lessenc_event_id: "analytics-event-2",
      ecommerce: {
        currency: "BRL",
        value: 139.9,
        items: [
          {
            item_id: "product-1",
            price: 139.9,
            quantity: 1,
            lessenc_offer_id: "offer-1",
          },
        ],
      },
    });
  });

  it("does not invent browser revenue when measurement has no monetary snapshot", () => {
    expect(
      projectGa4BrowserEcommerce(
        browserMeasurement({
          amountMinor: null,
          currency: null,
        }),
      ),
    ).toEqual({
      event: "view_item",
      lessenc_event_id: "analytics-event-1",
      ecommerce: {
        items: [
          {
            item_id: "product-1",
            quantity: 1,
            lessenc_offer_id: "offer-1",
          },
        ],
      },
    });
  });

  it("rejects incomplete or unsupported browser money", () => {
    expect(() =>
      projectGa4BrowserEcommerce(
        browserMeasurement({
          amountMinor: 13_990,
          currency: null,
        }),
      ),
    ).toThrow("INVALID_GA4_MONEY_PAIR");

    expect(() =>
      projectGa4BrowserEcommerce(
        browserMeasurement({
          currency: "USD",
        }),
      ),
    ).toThrow("UNSUPPORTED_GA4_CURRENCY");
  });

  it("maps canonical PURCHASE using trusted Order identity and persisted value", () => {
    expect(projectGa4CanonicalPurchase(canonicalPurchase())).toEqual({
      event: "purchase",
      lessenc_event_id: "purchase-event-1",
      ecommerce: {
        currency: "BRL",
        value: 139.9,
        transaction_id: "order-1",
        items: [
          {
            item_id: "product-1",
            price: 139.9,
            quantity: 1,
            lessenc_offer_id: "offer-1",
          },
        ],
      },
    });
  });

  it("refuses to reinterpret a non-PURCHASE AnalyticsEvent as GA4 purchase", () => {
    expect(() =>
      projectGa4CanonicalPurchase(
        canonicalPurchase({
          type: "VIEW_CONTENT",
          purchaseOrderKey: null,
        }),
      ),
    ).toThrow("GA4_PURCHASE_REQUIRES_CANONICAL_PURCHASE");
  });

  it("requires canonical Order identity and purchase-order uniqueness proof", () => {
    expect(() =>
      projectGa4CanonicalPurchase(
        canonicalPurchase({
          orderId: null,
        }),
      ),
    ).toThrow("MISSING_GA4_TRANSACTION_ID");

    expect(() =>
      projectGa4CanonicalPurchase(
        canonicalPurchase({
          purchaseOrderKey: "different-order",
        }),
      ),
    ).toThrow("INVALID_GA4_PURCHASE_ORDER_KEY");
  });

  it("requires authoritative product, offer, value and BRL currency for PURCHASE", () => {
    expect(() =>
      projectGa4CanonicalPurchase(
        canonicalPurchase({
          productId: null,
        }),
      ),
    ).toThrow("MISSING_GA4_PURCHASE_PRODUCT");

    expect(() =>
      projectGa4CanonicalPurchase(
        canonicalPurchase({
          offerId: null,
        }),
      ),
    ).toThrow("MISSING_GA4_PURCHASE_OFFER");

    expect(() =>
      projectGa4CanonicalPurchase(
        canonicalPurchase({
          amountMinor: null,
          currency: null,
        }),
      ),
    ).toThrow("MISSING_GA4_AUTHORITATIVE_MONEY");

    expect(() =>
      projectGa4CanonicalPurchase(
        canonicalPurchase({
          currency: "USD",
        }),
      ),
    ).toThrow("UNSUPPORTED_GA4_CURRENCY");
  });

  it("clears stale ecommerce state before pushing a browser GA4 ecommerce event", () => {
    const dataLayer: unknown[] = [];

    pushGa4EcommerceDataLayer(dataLayer, projectGa4BrowserEcommerce(browserMeasurement()));

    expect(dataLayer).toEqual([
      {
        ecommerce: null,
      },
      {
        event: "view_item",
        lessenc_event_id: "analytics-event-1",
        ecommerce: {
          currency: "BRL",
          value: 139.9,
          items: [
            {
              item_id: "product-1",
              price: 139.9,
              quantity: 1,
              lessenc_offer_id: "offer-1",
            },
          ],
        },
      },
    ]);
  });

  it("emits exactly one ecommerce event after the clear boundary", () => {
    const dataLayer: unknown[] = [];

    pushGa4EcommerceDataLayer(
      dataLayer,
      projectGa4BrowserEcommerce(
        browserMeasurement({
          measurementType: "INITIATE_CHECKOUT",
          eventId: "checkout-event-1",
        }),
      ),
    );

    expect(dataLayer).toHaveLength(2);

    expect(dataLayer[0]).toEqual({
      ecommerce: null,
    });

    expect(dataLayer[1]).toMatchObject({
      event: "begin_checkout",
      lessenc_event_id: "checkout-event-1",
    });
  });
});
