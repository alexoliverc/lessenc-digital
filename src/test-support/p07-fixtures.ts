import { type CatalogOffer } from "../modules/catalog/domain/catalog";
import { buildOrderItem, type Order } from "../modules/commerce/domain/order";
import { type Payment } from "../modules/payments/domain/payment";
import { type Clock } from "../shared/clock";
import { Money } from "../shared/money";

export const instant = "2026-09-12T20:00:00.000Z";
export const fixedClock: Clock = { now: () => new Date(instant) };

export function catalogFixture(): CatalogOffer {
  return {
    product: {
      id: "product",
      name: "Cronograma Capilar Inteligente",
      description: "Rotina educativa de cuidados",
      status: "ACTIVE",
    },
    offer: { id: "offer", productId: "product", price: Money.of(2990, "BRL"), isActive: true },
  };
}

export function orderFixture(): Order {
  const item = buildOrderItem(
    catalogFixture(),
    { id: "item", orderId: "order", productId: "product" },
    1,
    instant,
  );
  return {
    id: "order",
    customerId: "customer",
    status: "PENDING",
    items: [item],
    total: item.total,
    createdAt: instant,
    updatedAt: instant,
    paidAt: null,
  };
}

export function paymentFixture(): Payment {
  return {
    id: "payment",
    orderId: "order",
    status: "PENDING",
    amount: Money.of(2990, "BRL"),
    createdAt: instant,
    updatedAt: instant,
    approvedAt: null,
  };
}
