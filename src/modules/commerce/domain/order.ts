import { ApplicationError } from "../../../shared/application-error";
import { assertNever } from "../../../shared/assert-never";
import { isUtcInstant } from "../../../shared/clock";
import { Money } from "../../../shared/money";
import { requirePurchasable, type CatalogOffer } from "../../catalog/domain/catalog";

export const orderStatuses = ["PENDING", "PAID", "FAILED", "CANCELED", "REFUNDED"] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export type OrderItem = Readonly<{
  id: string;
  orderId: string;
  productId: string;
  offerId: string;
  productNameSnapshot: string;
  productDescriptionSnapshot: string | null;
  unitPrice: Money;
  quantity: number;
  total: Money;
  createdAt: string;
}>;

export type Order = Readonly<{
  id: string;
  customerId: string;
  status: OrderStatus;
  items: readonly OrderItem[];
  total: Money;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}>;

export function buildOrderItem(
  catalog: CatalogOffer,
  identity: Readonly<{ id: string; orderId: string; productId: string }>,
  quantity: number,
  createdAt: string,
): OrderItem {
  requirePurchasable(catalog, identity.productId);

  if (quantity !== 1) {
    throw new ApplicationError("INVALID_QUANTITY");
  }

  if (!identity.id || !identity.orderId || !catalog.product.name.trim()) {
    throw new ApplicationError("INVALID_SNAPSHOT");
  }

  return Object.freeze({
    id: identity.id,
    orderId: identity.orderId,
    productId: catalog.product.id,
    offerId: catalog.offer.id,
    productNameSnapshot: catalog.product.name,
    productDescriptionSnapshot: catalog.product.description,
    unitPrice: catalog.offer.price,
    quantity,
    total: catalog.offer.price.multiply(quantity),
    createdAt,
  });
}

export function calculateOrderTotal(items: readonly OrderItem[]): Money {
  if (items.length === 0) {
    throw new ApplicationError("INVALID_SNAPSHOT");
  }

  return items.reduce(
    (sum, item) => {
      if (!item.unitPrice.multiply(item.quantity).equals(item.total)) {
        throw new ApplicationError("INCONSISTENT_TOTAL");
      }

      return sum.add(item.total);
    },
    Money.of(0, "BRL"),
  );
}

export function validateOrder(order: Order): void {
  const uniqueIds = new Set(order.items.map((item) => item.id));

  if (
    !order.id ||
    !order.customerId ||
    uniqueIds.size !== order.items.length ||
    order.items.some((item) => !item.id || item.orderId !== order.id)
  ) {
    throw new ApplicationError("INVALID_SNAPSHOT");
  }

  switch (order.status) {
    case "PENDING":
    case "FAILED":
    case "CANCELED":
      if (order.paidAt !== null) {
        throw new ApplicationError("INVALID_SNAPSHOT");
      }
      break;

    case "PAID":
    case "REFUNDED":
      if (!isUtcInstant(order.paidAt)) {
        throw new ApplicationError("INVALID_SNAPSHOT");
      }
      break;

    default:
      return assertNever(order.status);
  }

  if (!calculateOrderTotal(order.items).equals(order.total)) {
    throw new ApplicationError("INCONSISTENT_TOTAL");
  }
}
