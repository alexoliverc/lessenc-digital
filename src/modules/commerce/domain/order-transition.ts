import { ApplicationError } from "../../../shared/application-error";
import { assertNever } from "../../../shared/assert-never";
import { type Clock, utcNow } from "../../../shared/clock";
import {
  requireFinancialMatch,
  type Payment,
  type FullRefundConfirmation,
} from "../../payments/domain/payment";
import { validateOrder, type Order, type OrderStatus } from "./order";

export type OrderFact =
  | Readonly<{ kind: "PAYMENT_APPROVED"; payment: Payment }>
  | Readonly<{
      kind: "INTERNAL_FAILURE_CONFIRMED" | "ELIGIBLE_CANCELLATION_CONFIRMED";
      orderId: string;
      hasApprovedPayment: boolean;
    }>
  | FullRefundConfirmation;

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  switch (to) {
    case "PENDING":
    case "PAID":
    case "FAILED":
    case "CANCELED":
    case "REFUNDED":
      break;
    default:
      return assertNever(to);
  }
  switch (from) {
    case "PENDING":
      return to === "PENDING" || to === "PAID" || to === "FAILED" || to === "CANCELED";
    case "PAID":
      return to === "PAID" || to === "REFUNDED";
    case "FAILED":
      return to === "FAILED";
    case "CANCELED":
      return to === "CANCELED";
    case "REFUNDED":
      return to === "REFUNDED";
    default:
      return assertNever(from);
  }
}

export function applyOrderFact(order: Order, fact: OrderFact, clock: Clock): Order {
  validateOrder(order);
  let target: OrderStatus;
  switch (fact.kind) {
    case "PAYMENT_APPROVED":
      requireFinancialMatch({ orderId: order.id, amount: order.total }, fact.payment);
      if (fact.payment.status !== "APPROVED" || !fact.payment.approvedAt) {
        throw new ApplicationError("INVALID_FINANCIAL_ORIGIN");
      }
      target = "PAID";
      break;
    case "INTERNAL_FAILURE_CONFIRMED":
    case "ELIGIBLE_CANCELLATION_CONFIRMED":
      if (fact.orderId !== order.id || fact.hasApprovedPayment !== false) {
        throw new ApplicationError("INVALID_FINANCIAL_ORIGIN");
      }
      target = fact.kind === "INTERNAL_FAILURE_CONFIRMED" ? "FAILED" : "CANCELED";
      break;
    case "FULL_REFUND_COMPLETED":
      requireFinancialMatch({ orderId: order.id, amount: order.total }, fact);
      target = "REFUNDED";
      break;
    default:
      return assertNever(fact);
  }
  if (!canTransitionOrder(order.status, target)) {
    throw new ApplicationError("INVALID_ORDER_TRANSITION");
  }
  if (order.status === target) return order;
  const now = utcNow(clock);
  return Object.freeze({
    ...order,
    status: target,
    updatedAt: now,
    paidAt: target === "PAID" ? now : order.paidAt,
  });
}
