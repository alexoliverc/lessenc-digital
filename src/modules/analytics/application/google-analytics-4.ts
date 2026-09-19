import type { AnalyticsEventRecord } from "../../attribution/application/persistence";
import type { BrowserMeasurementProjection } from "./browser-measurement";

export type Ga4EcommerceEventName = "view_item" | "begin_checkout" | "purchase";

export type Ga4EcommerceItem = Readonly<{
  item_id: string;
  price?: number;
  quantity: 1;
  lessenc_offer_id: string;
}>;

export type Ga4EcommercePayload = Readonly<{
  currency?: "BRL";
  value?: number;
  transaction_id?: string;
  items: readonly Ga4EcommerceItem[];
}>;

export type Ga4DataLayerEvent = Readonly<{
  event: Ga4EcommerceEventName;
  lessenc_event_id: string;
  ecommerce: Ga4EcommercePayload;
}>;

type Ga4MoneyProjection = Readonly<{
  currency: "BRL";
  value: number;
}>;

function requireIdentifier(value: string | null, errorCode: string): string {
  if (value === null || value.trim().length === 0) {
    throw new Error(errorCode);
  }

  return value;
}

function projectMoney(
  amountMinor: number | null,
  currency: string | null,
  required: boolean,
): Ga4MoneyProjection | null {
  if ((amountMinor === null) !== (currency === null)) {
    throw new Error("INVALID_GA4_MONEY_PAIR");
  }

  if (amountMinor === null || currency === null) {
    if (required) {
      throw new Error("MISSING_GA4_AUTHORITATIVE_MONEY");
    }

    return null;
  }

  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error("INVALID_GA4_AMOUNT_MINOR");
  }

  if (currency !== "BRL") {
    throw new Error("UNSUPPORTED_GA4_CURRENCY");
  }

  return Object.freeze({
    currency: "BRL" as const,
    value: amountMinor / 100,
  });
}

function projectItem(
  productId: string,
  offerId: string,
  money: Ga4MoneyProjection | null,
): Ga4EcommerceItem {
  return Object.freeze({
    item_id: productId,
    ...(money === null
      ? {}
      : {
          price: money.value,
        }),
    quantity: 1 as const,
    lessenc_offer_id: offerId,
  });
}

function projectEcommerce(
  input: Readonly<{
    productId: string;
    offerId: string;
    money: Ga4MoneyProjection | null;
    transactionId?: string;
  }>,
): Ga4EcommercePayload {
  return Object.freeze({
    ...(input.money === null
      ? {}
      : {
          currency: input.money.currency,
          value: input.money.value,
        }),

    ...(input.transactionId === undefined
      ? {}
      : {
          transaction_id: input.transactionId,
        }),

    items: Object.freeze([projectItem(input.productId, input.offerId, input.money)]),
  });
}

export function projectGa4BrowserEcommerce(
  measurement: BrowserMeasurementProjection,
): Ga4DataLayerEvent {
  const eventId = requireIdentifier(measurement.eventId, "INVALID_GA4_EVENT_ID");

  const productId = requireIdentifier(measurement.productId, "INVALID_GA4_PRODUCT_ID");

  const offerId = requireIdentifier(measurement.offerId, "INVALID_GA4_OFFER_ID");

  const money = projectMoney(measurement.amountMinor, measurement.currency, false);

  const event =
    measurement.measurementType === "VIEW_CONTENT"
      ? "view_item"
      : measurement.measurementType === "INITIATE_CHECKOUT"
        ? "begin_checkout"
        : null;

  if (event === null) {
    throw new Error("UNSUPPORTED_GA4_BROWSER_EVENT");
  }

  return Object.freeze({
    event,
    lessenc_event_id: eventId,
    ecommerce: projectEcommerce({
      productId,
      offerId,
      money,
    }),
  });
}

export function projectGa4CanonicalPurchase(
  analyticsEvent: AnalyticsEventRecord,
): Ga4DataLayerEvent {
  if (analyticsEvent.type !== "PURCHASE") {
    throw new Error("GA4_PURCHASE_REQUIRES_CANONICAL_PURCHASE");
  }

  const eventId = requireIdentifier(analyticsEvent.id, "INVALID_GA4_EVENT_ID");

  const orderId = requireIdentifier(analyticsEvent.orderId, "MISSING_GA4_TRANSACTION_ID");

  if (analyticsEvent.purchaseOrderKey !== orderId) {
    throw new Error("INVALID_GA4_PURCHASE_ORDER_KEY");
  }

  const productId = requireIdentifier(analyticsEvent.productId, "MISSING_GA4_PURCHASE_PRODUCT");

  const offerId = requireIdentifier(analyticsEvent.offerId, "MISSING_GA4_PURCHASE_OFFER");

  const money = projectMoney(analyticsEvent.amountMinor, analyticsEvent.currency, true);

  if (money === null) {
    throw new Error("MISSING_GA4_AUTHORITATIVE_MONEY");
  }

  return Object.freeze({
    event: "purchase",
    lessenc_event_id: eventId,
    ecommerce: projectEcommerce({
      productId,
      offerId,
      money,
      transactionId: orderId,
    }),
  });
}
export type Ga4DataLayerSink = Readonly<{
  push(value: unknown): number;
}>;

export function pushGa4EcommerceDataLayer(sink: Ga4DataLayerSink, event: Ga4DataLayerEvent): void {
  sink.push({
    ecommerce: null,
  });

  sink.push(event);
}
