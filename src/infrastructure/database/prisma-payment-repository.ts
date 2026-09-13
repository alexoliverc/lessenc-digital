import { createHash, randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { applyOrderFact } from "../../modules/commerce/domain/order-transition";
import type { Order as DomainOrder } from "../../modules/commerce/domain/order";
import {
  applyPaymentFact,
  type Payment as DomainPayment,
} from "../../modules/payments/domain/payment";
import type {
  PaymentMethod,
  ProviderSnapshot,
} from "../../modules/payments/application/payment-provider";
import { SystemClock } from "../../shared/clock";
import { Money } from "../../shared/money";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const clock = new SystemClock();
type Tx = Prisma.TransactionClient;

export function operationFingerprint(
  input: Readonly<{
    orderId: string;
    paymentId: string;
    amountMinor: number;
    currency: string;
    paymentMethod: PaymentMethod;
  }>,
): string {
  return sha256(
    JSON.stringify([
      1,
      "MERCADO_PAGO",
      input.orderId,
      input.paymentId,
      input.amountMinor,
      input.currency,
      input.paymentMethod,
      1,
    ]),
  );
}

export type PaymentAttempt = Readonly<{
  paymentId: string;
  orderId: string;
  amountMinor: number;
  currency: "BRL";
  paymentMethod: PaymentMethod;
  payerEmail: string;
  status: string;
  providerOrderId: string | null;
  createdAt: Date;
  requiresReview: boolean;
}>;

export type PublicPaymentState = Readonly<{
  state:
    | "awaiting_payment"
    | "processing"
    | "challenge_required"
    | "approved"
    | "rejected"
    | "canceled"
    | "refunded"
    | "unknown"
    | "review_required";
  paymentId: string | null;
  orderId: string;
}>;

export class PrismaPaymentRepository {
  constructor(private readonly db: PrismaClient) {}

  private async lockOrder(tx: Tx, orderId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
  }

  async reserve(
    orderId: string,
    paymentMethod: PaymentMethod,
  ): Promise<{ attempt: PaymentAttempt; send: boolean }> {
    return this.db.$transaction(
      async (tx) => {
        await this.lockOrder(tx, orderId);
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            customer: true,
            items: true,
            payments: { orderBy: { attemptNumber: "desc" } },
          },
        });
        if (
          !order ||
          order.status !== "PENDING" ||
          order.currency !== "BRL" ||
          !Number.isSafeInteger(order.totalMinor) ||
          order.totalMinor <= 0 ||
          order.items.length !== 1 ||
          order.items[0]?.totalMinor !== order.totalMinor ||
          order.items[0]?.currency !== "BRL"
        )
          throw new Error("PAYMENT_ORDER_INELIGIBLE");
        const active = order.payments.find((p) => p.activeAttemptKey === orderId);
        if (active) {
          if (
            active.paymentMethod !== paymentMethod ||
            active.amountMinor !== order.totalMinor ||
            active.currency !== order.currency ||
            active.provider !== "MERCADO_PAGO" ||
            active.operationFingerprint !==
              operationFingerprint({
                orderId,
                paymentId: active.id,
                amountMinor: order.totalMinor,
                currency: order.currency,
                paymentMethod,
              })
          )
            throw new Error("PAYMENT_ATTEMPT_CONFLICT");
          return { attempt: this.toAttempt(active, order.customer.email), send: false };
        }
        // Legacy or reviewed attempts without a marker must never permit a second charge.
        if (
          order.payments.some(
            (p) =>
              p.requiresReview ||
              p.status === "PENDING" ||
              p.status === "UNKNOWN" ||
              p.status === "APPROVED" ||
              p.status === "REFUNDED",
          )
        ) {
          throw new Error("PAYMENT_ATTEMPT_BLOCKED");
        }
        const paymentId = randomUUID();
        const attemptNumber =
          order.payments.reduce((max, p) => Math.max(max, p.attemptNumber ?? 0), 0) + 1;
        const payment = await tx.payment.create({
          data: {
            id: paymentId,
            orderId,
            status: "PENDING",
            amountMinor: order.totalMinor,
            currency: "BRL",
            provider: "MERCADO_PAGO",
            attemptNumber,
            activeAttemptKey: orderId,
            paymentMethod,
            operationFingerprint: operationFingerprint({
              orderId,
              paymentId,
              amountMinor: order.totalMinor,
              currency: "BRL",
              paymentMethod,
            }),
            submittedAt: new Date(),
          },
        });
        return { attempt: this.toAttempt(payment, order.customer.email), send: true };
      },
      { isolationLevel: "ReadCommitted" },
    );
  }

  private toAttempt(
    payment: Readonly<{
      id: string;
      orderId: string;
      amountMinor: number;
      currency: string;
      paymentMethod: string | null;
      status: string;
      providerOrderId: string | null;
      createdAt: Date;
      requiresReview: boolean;
    }>,
    payerEmail: string,
  ): PaymentAttempt {
    if (
      payment.currency !== "BRL" ||
      !["PIX", "CREDIT_CARD"].includes(payment.paymentMethod ?? "")
    ) {
      throw new Error("INVALID_PAYMENT_SNAPSHOT");
    }
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amountMinor: payment.amountMinor,
      currency: "BRL",
      paymentMethod: payment.paymentMethod as PaymentMethod,
      payerEmail,
      status: payment.status,
      providerOrderId: payment.providerOrderId,
      createdAt: payment.createdAt,
      requiresReview: payment.requiresReview,
    };
  }

  async load(paymentId: string): Promise<PaymentAttempt | null> {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: { order: { include: { customer: true } } },
    });
    return payment ? this.toAttempt(payment, payment.order.customer.email) : null;
  }

  async findByProviderOrderId(providerOrderId: string): Promise<PaymentAttempt | null> {
    const payment = await this.db.payment.findUnique({
      where: { providerOrderId },
      include: { order: { include: { customer: true } } },
    });
    return payment ? this.toAttempt(payment, payment.order.customer.email) : null;
  }

  async findRecoverableByOrderId(orderId: string): Promise<PaymentAttempt | null> {
    const payment = await this.db.payment.findUnique({
      where: { activeAttemptKey: orderId },
      include: { order: { include: { customer: true } } },
    });

    if (!payment || payment.orderId !== orderId) return null;

    return this.toAttempt(payment, payment.order.customer.email);
  }

  async rememberProviderOrderId(paymentId: string, providerOrderId: string): Promise<void> {
    if (!providerOrderId || providerOrderId.length > 64) {
      throw new Error("INVALID_PROVIDER_ORDER_ID");
    }

    await this.db.$transaction(
      async (tx) => {
        const initial = await tx.payment.findUnique({
          where: { id: paymentId },
        });

        if (!initial) throw new Error("PAYMENT_NOT_FOUND");

        await this.lockOrder(tx, initial.orderId);

        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
        });

        if (payment.providerOrderId && payment.providerOrderId !== providerOrderId) {
          throw new Error("PROVIDER_ORDER_ID_CONFLICT");
        }

        if (!payment.providerOrderId) {
          await tx.payment.update({
            where: { id: paymentId },
            data: { providerOrderId },
          });
        }
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
  async claimReconciliation(paymentId: string, minimumIntervalMs: number): Promise<boolean> {
    if (
      !Number.isSafeInteger(minimumIntervalMs) ||
      minimumIntervalMs < 1_000 ||
      minimumIntervalMs > 300_000
    ) {
      throw new Error("INVALID_RECONCILIATION_INTERVAL");
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - minimumIntervalMs);

    const claimed = await this.db.payment.updateMany({
      where: {
        id: paymentId,
        OR: [{ lastProviderSyncAt: null }, { lastProviderSyncAt: { lte: cutoff } }],
      },
      data: {
        lastProviderSyncAt: now,
      },
    });

    return claimed.count === 1;
  }
  async recordRecoveryReview(
    paymentId: string,
    reason: "MULTIPLE_CANDIDATES" | "INCOMPLETE_SEARCH",
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const initial = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      await this.lockOrder(tx, initial.orderId);
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      const hash = sha256(JSON.stringify([1, paymentId, "RECOVERY", reason]));
      const sticky = reason === "MULTIPLE_CANDIDATES";

      const existing = await tx.paymentEvent.findUnique({
        where: { deduplicationKey: `mp-recovery:${hash}` },
      });

      if (!existing)
        await tx.paymentEvent.create({
          data: {
            paymentId,
            source: "RECOVERY",
            providerStatus: sticky ? "recovery_review" : "recovery_incomplete",
            deduplicationKey: `mp-recovery:${hash}`,
            snapshotHash: hash,
            applicationResult: sticky ? "REVIEW" : "NOOP",
          },
        });

      if (sticky && !payment.requiresReview)
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            requiresReview: true,
            reviewReason: reason,
          },
        });
    });
  }

  async state(orderId: string): Promise<PublicPaymentState | null> {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          orderBy: [{ attemptNumber: "desc" }, { createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
      },
    });
    if (!order) return null;
    const payment = order.payments[0];
    let state: PublicPaymentState["state"] = "awaiting_payment";
    if (payment?.requiresReview) state = "review_required";
    else if (order.status === "REFUNDED" && payment?.status === "REFUNDED") state = "refunded";
    else if (order.status === "PAID" && payment?.status === "APPROVED") state = "approved";
    else if (payment?.status === "REJECTED") state = "rejected";
    else if (payment?.status === "CANCELED") state = "canceled";
    else if (payment?.status === "UNKNOWN") state = "unknown";
    else if (payment?.status === "PENDING") state = "processing";
    return { state, paymentId: payment?.id ?? null, orderId };
  }

  async markAmbiguous(paymentId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!existing) return;
      await this.lockOrder(tx, existing.orderId);
      const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (current.status === "PENDING") {
        await tx.payment.update({ where: { id: paymentId }, data: { status: "UNKNOWN" } });
      }
    });
  }

  async applyObservation(
    input: Readonly<{
      paymentId: string;
      snapshot: ProviderSnapshot;
      source: "CREATE_RESPONSE" | "WEBHOOK" | "RECONCILIATION" | "RECOVERY";
      providerEventId?: string;
    }>,
  ): Promise<"APPLIED" | "NOOP" | "REVIEW" | "REJECTED"> {
    const { snapshot } = input;
    return this.db.$transaction(
      async (tx) => {
        const initial = await tx.payment.findUnique({ where: { id: input.paymentId } });
        if (!initial) throw new Error("PAYMENT_NOT_FOUND");
        await this.lockOrder(tx, initial.orderId);
        const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
        const order = await tx.order.findUniqueOrThrow({
          where: { id: payment.orderId },
          include: { items: true },
        });
        const financialMatch =
          snapshot.externalReference === order.id &&
          snapshot.providerOrderId.length <= 64 &&
          (!payment.providerOrderId || payment.providerOrderId === snapshot.providerOrderId) &&
          (!payment.providerPaymentId ||
            payment.providerPaymentId === snapshot.providerPaymentId) &&
          snapshot.amountMinor === order.totalMinor &&
          snapshot.amountMinor === payment.amountMinor &&
          snapshot.paymentAmountMinor === order.totalMinor &&
          snapshot.currency === "BRL" &&
          payment.currency === "BRL" &&
          snapshot.paymentMethod === payment.paymentMethod &&
          order.items.length === 1 &&
          order.items[0]?.totalMinor === order.totalMinor;
        const recoverableUnknownSnapshot =
          snapshot.requiresReview &&
          snapshot.reviewReason === "UNKNOWN_STATUS" &&
          (payment.status === "PENDING" || payment.status === "UNKNOWN");

        const incompatibleFinancialState =
          (snapshot.status === "APPROVED" &&
            payment.status !== "APPROVED" &&
            order.status !== "PENDING") ||
          (snapshot.status === "REFUNDED" &&
            !(
              (payment.status === "APPROVED" && order.status === "PAID") ||
              (payment.status === "REFUNDED" && order.status === "REFUNDED")
            )) ||
          (snapshot.status === "REFUNDED" && snapshot.refundedAmountMinor !== payment.amountMinor);
        const projection = [
          1,
          payment.id,
          snapshot.providerOrderId,
          snapshot.providerPaymentId,
          snapshot.externalReference,
          snapshot.amountMinor,
          snapshot.paymentAmountMinor,
          snapshot.currency,
          snapshot.paymentMethod,
          snapshot.providerStatus,
          snapshot.providerStatusDetail,
          snapshot.refundedAmountMinor,
          snapshot.occurredAt,
        ];
        const hash = sha256(JSON.stringify(projection));
        const key = `mp-snapshot:${hash}`;
        const duplicate = await tx.paymentEvent.findUnique({ where: { deduplicationKey: key } });
        if (duplicate) return "NOOP";
        let result: "APPLIED" | "NOOP" | "REVIEW" | "REJECTED";
        let nextPayment: DomainPayment | null = null;
        let nextOrder: DomainOrder | null = null;
        let reviewReason: string | null = null;
        if (!financialMatch) {
          result = "REJECTED";
          reviewReason = "IDENTITY_OR_AMOUNT_MISMATCH";
        } else if (payment.requiresReview || incompatibleFinancialState) {
          result = "REVIEW";
          reviewReason = payment.reviewReason ?? "INCOMPATIBLE_FINANCIAL_STATE";
        } else if (snapshot.requiresReview && !recoverableUnknownSnapshot) {
          result = "REVIEW";
          reviewReason = snapshot.reviewReason ?? "UNKNOWN_STATUS";
        } else {
          const domainPayment: DomainPayment = {
            id: payment.id,
            orderId: payment.orderId,
            status: payment.status,
            amount: Money.of(payment.amountMinor, payment.currency),
            createdAt: payment.createdAt.toISOString(),
            updatedAt: payment.updatedAt.toISOString(),
            approvedAt: payment.approvedAt?.toISOString() ?? null,
          };
          const fact =
            snapshot.status === "REFUNDED"
              ? {
                  kind: "FULL_REFUND_COMPLETED" as const,
                  paymentId: payment.id,
                  orderId: order.id,
                  amount: domainPayment.amount,
                }
              : snapshot.status === "UNKNOWN"
                ? {
                    kind: "AMBIGUOUS_RESULT" as const,
                    paymentId: payment.id,
                    orderId: order.id,
                    amount: domainPayment.amount,
                  }
                : {
                    kind: "CONFIRMED_STATUS" as const,
                    paymentId: payment.id,
                    orderId: order.id,
                    amount: domainPayment.amount,
                    status: snapshot.status,
                  };
          try {
            nextPayment = applyPaymentFact(domainPayment, fact, clock);
            const domainOrder: DomainOrder = {
              id: order.id,
              customerId: order.customerId,
              status: order.status,
              total: Money.of(order.totalMinor, order.currency),
              items: order.items.map((item) => ({
                id: item.id,
                orderId: item.orderId,
                productId: item.productId,
                offerId: item.offerId,
                productNameSnapshot: item.productNameSnapshot,
                productDescriptionSnapshot: item.productDescriptionSnapshot,
                unitPrice: Money.of(item.unitPriceMinor, item.currency),
                quantity: item.quantity,
                total: Money.of(item.totalMinor, item.currency),
                createdAt: item.createdAt.toISOString(),
              })),
              createdAt: order.createdAt.toISOString(),
              updatedAt: order.updatedAt.toISOString(),
              paidAt: order.paidAt?.toISOString() ?? null,
            };
            if (nextPayment.status === "APPROVED" && order.status === "PENDING") {
              nextOrder = applyOrderFact(
                domainOrder,
                { kind: "PAYMENT_APPROVED", payment: nextPayment },
                clock,
              );
            } else if (nextPayment.status === "REFUNDED" && order.status === "PAID") {
              nextOrder = applyOrderFact(
                domainOrder,
                fact as Extract<typeof fact, { kind: "FULL_REFUND_COMPLETED" }>,
                clock,
              );
            }
            result =
              nextPayment.status !== payment.status || nextOrder !== null ? "APPLIED" : "NOOP";
          } catch {
            result = "REVIEW";
            reviewReason = "INVALID_DOMAIN_TRANSITION";
          }
        }
        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            source: input.source,
            providerOrderId: snapshot.providerOrderId,
            providerPaymentId: snapshot.providerPaymentId,
            providerEventId: input.providerEventId ?? null,
            providerStatus: snapshot.providerStatus,
            providerStatusDetail: snapshot.providerStatusDetail,
            amountMinor: snapshot.amountMinor,
            currency: snapshot.currency,
            deduplicationKey: key,
            snapshotHash: hash,
            applicationResult: result,
            providerOccurredAt:
              snapshot.occurredAt && Number.isFinite(Date.parse(snapshot.occurredAt))
                ? new Date(snapshot.occurredAt)
                : null,
          },
        });
        const now = new Date();
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            ...(financialMatch
              ? {
                  providerOrderId: snapshot.providerOrderId,
                  providerPaymentId: snapshot.providerPaymentId,
                }
              : {}),
            providerStatus: snapshot.providerStatus,
            providerStatusDetail: snapshot.providerStatusDetail,
            lastProviderSyncAt: now,
            requiresReview:
              result === "REVIEW" || result === "REJECTED" ? true : payment.requiresReview,
            reviewReason: reviewReason ?? payment.reviewReason,
            ...(result === "APPLIED" && nextPayment
              ? {
                  status: nextPayment.status,
                  approvedAt: nextPayment.approvedAt ? new Date(nextPayment.approvedAt) : null,
                  activeAttemptKey: ["REJECTED", "CANCELED"].includes(nextPayment.status)
                    ? null
                    : payment.activeAttemptKey,
                }
              : {}),
          },
        });
        if (result === "APPLIED" && nextOrder) {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: nextOrder.status,
              paidAt: nextOrder.paidAt ? new Date(nextOrder.paidAt) : null,
            },
          });
          const type = nextOrder.status === "PAID" ? "PAYMENT_APPROVED" : "REFUND_COMPLETED";
          const deduplicationKey =
            nextOrder.status === "PAID"
              ? `payment-approved:${payment.id}`
              : `refund-completed:${payment.id}`;
          await tx.outboxEvent.create({
            data: {
              orderId: order.id,
              type,
              deduplicationKey,
              payload: { version: 1, orderId: order.id, paymentId: payment.id },
            },
          });
        }
        return result;
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
}
