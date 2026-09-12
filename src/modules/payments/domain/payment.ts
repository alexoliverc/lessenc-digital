import { ApplicationError } from "../../../shared/application-error";
import { assertNever } from "../../../shared/assert-never";
import { isUtcInstant, type Clock, utcNow } from "../../../shared/clock";
import { Money } from "../../../shared/money";

export const paymentStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELED",
  "REFUNDED",
  "UNKNOWN",
] as const;

export type PaymentStatus = (typeof paymentStatuses)[number];

export type Payment = Readonly<{
  id: string;
  orderId: string;
  status: PaymentStatus;
  amount: Money;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}>;

// Internal evidence, never an input DTO for an HTTP handler. Verification belongs to P10.
export type FullRefundConfirmation = Readonly<{
  kind: "FULL_REFUND_COMPLETED";
  paymentId: string;
  orderId: string;
  amount: Money;
}>;

export type PaymentFact =
  | Readonly<{
      kind: "CONFIRMED_STATUS";
      paymentId: string;
      orderId: string;
      amount: Money;
      status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
    }>
  | Readonly<{
      kind: "AMBIGUOUS_RESULT";
      paymentId: string;
      orderId: string;
      amount: Money;
    }>
  | FullRefundConfirmation;

export function validatePaymentSnapshot(payment: Payment): void {
  switch (payment.status) {
    case "PENDING":
    case "UNKNOWN":
    case "REJECTED":
    case "CANCELED":
      if (payment.approvedAt !== null) {
        throw new ApplicationError("INVALID_SNAPSHOT");
      }
      break;

    case "APPROVED":
    case "REFUNDED":
      if (!isUtcInstant(payment.approvedAt)) {
        throw new ApplicationError("INVALID_SNAPSHOT");
      }
      break;

    default:
      return assertNever(payment.status);
  }
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  switch (to) {
    case "PENDING":
    case "APPROVED":
    case "REJECTED":
    case "CANCELED":
    case "REFUNDED":
    case "UNKNOWN":
      break;

    default:
      return assertNever(to);
  }

  switch (from) {
    case "PENDING":
      return (
        to === "PENDING" ||
        to === "APPROVED" ||
        to === "REJECTED" ||
        to === "CANCELED" ||
        to === "UNKNOWN"
      );

    case "UNKNOWN":
      return to === "UNKNOWN" || to === "APPROVED" || to === "REJECTED";

    case "APPROVED":
      return to === "APPROVED" || to === "REFUNDED";

    case "REJECTED":
      return to === "REJECTED";

    case "CANCELED":
      return to === "CANCELED";

    case "REFUNDED":
      return to === "REFUNDED";

    default:
      return assertNever(from);
  }
}

export function requireFinancialMatch(
  expected: Readonly<{ orderId: string; amount: Money }>,
  actual: Readonly<{ orderId: string; amount: Money }>,
): void {
  if (expected.orderId !== actual.orderId || !expected.amount.equals(actual.amount)) {
    throw new ApplicationError("INVALID_FINANCIAL_ORIGIN");
  }
}

export function applyPaymentFact(payment: Payment, fact: PaymentFact, clock: Clock): Payment {
  validatePaymentSnapshot(payment);
  requireFinancialMatch(payment, fact);

  if (fact.paymentId !== payment.id) {
    throw new ApplicationError("INVALID_FINANCIAL_ORIGIN");
  }

  let target: PaymentStatus;

  switch (fact.kind) {
    case "CONFIRMED_STATUS":
      switch (fact.status) {
        case "PENDING":
        case "APPROVED":
        case "REJECTED":
        case "CANCELED":
          target = fact.status;
          break;

        default:
          return assertNever(fact.status);
      }
      break;

    case "AMBIGUOUS_RESULT":
      target = "UNKNOWN";
      break;

    case "FULL_REFUND_COMPLETED":
      target = "REFUNDED";
      break;

    default:
      return assertNever(fact);
  }

  if (!canTransitionPayment(payment.status, target)) {
    throw new ApplicationError("INVALID_PAYMENT_TRANSITION");
  }

  if (payment.status === target) {
    return payment;
  }

  const now = utcNow(clock);

  return Object.freeze({
    ...payment,
    status: target,
    updatedAt: now,
    approvedAt: target === "APPROVED" ? now : payment.approvedAt,
  });
}
