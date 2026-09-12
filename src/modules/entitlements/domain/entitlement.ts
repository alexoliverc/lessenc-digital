import { ApplicationError } from "../../../shared/application-error";
import { assertNever } from "../../../shared/assert-never";
import { isUtcInstant, type Clock, utcNow } from "../../../shared/clock";
import { validateOrder, type Order } from "../../commerce/domain/order";
import {
  requireFinancialMatch,
  type FullRefundConfirmation,
  type Payment,
} from "../../payments/domain/payment";

export const entitlementStatuses = ["PENDING", "ACTIVE", "REVOKED", "EXPIRED"] as const;
export type EntitlementStatus = (typeof entitlementStatuses)[number];

export type Entitlement = Readonly<{
  id: string;
  orderItemId: string;
  status: EntitlementStatus;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  revokedAt: string | null;
}>;

export type EntitlementFact =
  | Readonly<{
      kind: "PAID_ORDER";
      order: Order;
      payment: Payment;
    }>
  | Readonly<{
      kind: "REFUNDED_ORDER";
      order: Order;
      payment: Payment;
      refund: FullRefundConfirmation;
    }>;

export function validateEntitlementSnapshot(entitlement: Entitlement): void {
  switch (entitlement.status) {
    case "PENDING":
      if (entitlement.activatedAt !== null || entitlement.revokedAt !== null) {
        throw new ApplicationError("INVALID_SNAPSHOT");
      }
      break;

    case "ACTIVE":
      if (!isUtcInstant(entitlement.activatedAt) || entitlement.revokedAt !== null) {
        throw new ApplicationError("INVALID_SNAPSHOT");
      }
      break;

    case "REVOKED":
      if (!isUtcInstant(entitlement.activatedAt) || !isUtcInstant(entitlement.revokedAt)) {
        throw new ApplicationError("INVALID_SNAPSHOT");
      }
      break;

    case "EXPIRED":
      // Temporal policy for expiration remains OPEN.
      break;

    default:
      return assertNever(entitlement.status);
  }
}

export function prepareEntitlement(
  identity: Readonly<{ id: string; orderItemId: string }>,
  existing: readonly Entitlement[],
  clock: Clock,
): Entitlement {
  if (!identity.id || !identity.orderItemId) {
    throw new ApplicationError("INVALID_SNAPSHOT");
  }

  if (
    existing.some((entry) => entry.orderItemId === identity.orderItemId || entry.id === identity.id)
  ) {
    throw new ApplicationError("DUPLICATE_ENTITLEMENT");
  }

  const now = utcNow(clock);

  return Object.freeze({
    ...identity,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    activatedAt: null,
    revokedAt: null,
  });
}

export function applyEntitlementFact(
  entitlement: Entitlement,
  fact: EntitlementFact,
  clock: Clock,
): Entitlement {
  validateEntitlementSnapshot(entitlement);

  const { order, payment } = fact;

  validateOrder(order);
  requireFinancialMatch({ orderId: order.id, amount: order.total }, payment);

  if (
    !order.items.some((item) => item.id === entitlement.orderItemId) ||
    !order.paidAt ||
    !payment.approvedAt
  ) {
    throw new ApplicationError("INVALID_FINANCIAL_ORIGIN");
  }

  let target: "ACTIVE" | "REVOKED";

  switch (fact.kind) {
    case "PAID_ORDER":
      if (order.status !== "PAID" || payment.status !== "APPROVED") {
        throw new ApplicationError("INVALID_FINANCIAL_ORIGIN");
      }

      target = "ACTIVE";
      break;

    case "REFUNDED_ORDER":
      requireFinancialMatch(payment, fact.refund);

      if (
        order.status !== "REFUNDED" ||
        payment.status !== "REFUNDED" ||
        fact.refund.paymentId !== payment.id
      ) {
        throw new ApplicationError("INVALID_FINANCIAL_ORIGIN");
      }

      target = "REVOKED";
      break;

    default:
      return assertNever(fact);
  }

  switch (entitlement.status) {
    case "PENDING":
      if (target !== "ACTIVE") {
        throw new ApplicationError("INVALID_ENTITLEMENT_TRANSITION");
      }
      break;

    case "ACTIVE":
      if (target === "ACTIVE") {
        return entitlement;
      }
      break;

    case "REVOKED":
      if (target === "REVOKED") {
        return entitlement;
      }

      throw new ApplicationError("INVALID_ENTITLEMENT_TRANSITION");

    case "EXPIRED":
      throw new ApplicationError("INVALID_ENTITLEMENT_TRANSITION");

    default:
      return assertNever(entitlement.status);
  }

  const now = utcNow(clock);

  return Object.freeze({
    ...entitlement,
    status: target,
    updatedAt: now,
    activatedAt: target === "ACTIVE" ? now : entitlement.activatedAt,
    revokedAt: target === "REVOKED" ? now : entitlement.revokedAt,
  });
}
