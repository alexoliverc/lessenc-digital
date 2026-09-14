import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type {
  EntitlementRevocationProcessResult,
  EntitlementRevocationRepository,
} from "../../modules/entitlements/application/process-entitlement-revocation";
import type { Order as DomainOrder } from "../../modules/commerce/domain/order";
import {
  applyEntitlementFact,
  type Entitlement as DomainEntitlement,
} from "../../modules/entitlements/domain/entitlement";
import type { Payment as DomainPayment } from "../../modules/payments/domain/payment";
import { type Clock, SystemClock } from "../../shared/clock";
import { Money } from "../../shared/money";

type Tx = Prisma.TransactionClient;

type RefundCompletedPayload = Readonly<{
  version: 1;
  orderId: string;
  paymentId: string;
}>;

function parseRefundCompletedPayload(
  payload: unknown,
  eventOrderId: string,
): RefundCompletedPayload {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("INVALID_REFUND_COMPLETED_PAYLOAD");
  }

  const candidate = payload as Record<string, unknown>;

  if (
    candidate.version !== 1 ||
    typeof candidate.orderId !== "string" ||
    !candidate.orderId ||
    typeof candidate.paymentId !== "string" ||
    !candidate.paymentId ||
    candidate.orderId !== eventOrderId
  ) {
    throw new Error("INVALID_REFUND_COMPLETED_PAYLOAD");
  }

  return {
    version: 1,
    orderId: candidate.orderId,
    paymentId: candidate.paymentId,
  };
}

export class PrismaEntitlementRevocationRepository implements EntitlementRevocationRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  private async lockOutboxEvent(tx: Tx, eventId: string): Promise<void> {
    await tx.$queryRaw`
      SELECT id
      FROM outbox_events
      WHERE id = ${eventId}
      FOR UPDATE
    `;
  }

  private async lockOrder(tx: Tx, orderId: string): Promise<void> {
    await tx.$queryRaw`
      SELECT id
      FROM orders
      WHERE id = ${orderId}
      FOR UPDATE
    `;
  }

  private toDomainEntitlement(
    entitlement: Readonly<{
      id: string;
      orderItemId: string;
      status: "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED";
      createdAt: Date;
      updatedAt: Date;
      activatedAt: Date | null;
      revokedAt: Date | null;
    }>,
  ): DomainEntitlement {
    return {
      id: entitlement.id,
      orderItemId: entitlement.orderItemId,
      status: entitlement.status,
      createdAt: entitlement.createdAt.toISOString(),
      updatedAt: entitlement.updatedAt.toISOString(),
      activatedAt: entitlement.activatedAt?.toISOString() ?? null,
      revokedAt: entitlement.revokedAt?.toISOString() ?? null,
    };
  }

  async processRefundCompleted(eventId: string): Promise<EntitlementRevocationProcessResult> {
    return this.db.$transaction(
      async (tx) => {
        await this.lockOutboxEvent(tx, eventId);

        const event = await tx.outboxEvent.findUnique({
          where: {
            id: eventId,
          },
        });

        if (!event) {
          throw new Error("OUTBOX_EVENT_NOT_FOUND");
        }

        if (event.type !== "REFUND_COMPLETED") {
          throw new Error("OUTBOX_EVENT_TYPE_UNSUPPORTED");
        }

        if (event.status === "PROCESSED") {
          return "NOOP";
        }

        if (event.status !== "PENDING") {
          throw new Error("OUTBOX_EVENT_NOT_PROCESSABLE");
        }

        const payload = parseRefundCompletedPayload(event.payload, event.orderId);

        await this.lockOrder(tx, payload.orderId);

        const order = await tx.order.findUnique({
          where: {
            id: payload.orderId,
          },
          include: {
            items: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

        if (!order) {
          throw new Error("ENTITLEMENT_ORDER_NOT_FOUND");
        }

        const payment = await tx.payment.findUnique({
          where: {
            id: payload.paymentId,
          },
        });

        if (!payment) {
          throw new Error("ENTITLEMENT_PAYMENT_NOT_FOUND");
        }

        const sameFinancialOrigin =
          payment.orderId === order.id &&
          payment.amountMinor === order.totalMinor &&
          payment.currency === order.currency;

        if (
          order.status !== "REFUNDED" ||
          payment.status !== "REFUNDED" ||
          order.paidAt === null ||
          payment.approvedAt === null ||
          !sameFinancialOrigin
        ) {
          throw new Error("ENTITLEMENT_REFUND_FINANCIAL_ORIGIN_INVALID");
        }

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
          paidAt: order.paidAt.toISOString(),
        };

        const domainPayment: DomainPayment = {
          id: payment.id,
          orderId: payment.orderId,
          status: payment.status,
          amount: Money.of(payment.amountMinor, payment.currency),
          createdAt: payment.createdAt.toISOString(),
          updatedAt: payment.updatedAt.toISOString(),
          approvedAt: payment.approvedAt.toISOString(),
        };

        const refundFact = Object.freeze({
          kind: "REFUNDED_ORDER" as const,
          order: domainOrder,
          payment: domainPayment,
          refund: Object.freeze({
            kind: "FULL_REFUND_COMPLETED" as const,
            paymentId: payment.id,
            orderId: order.id,
            amount: Money.of(payment.amountMinor, payment.currency),
          }),
        });

        for (const item of order.items) {
          const existing = await tx.entitlement.findUnique({
            where: {
              orderItemId: item.id,
            },
          });

          /*
           * A valid full refund may exist for an Order whose
           * PAYMENT_APPROVED event was never consumed.
           *
           * In that case there is no commercial right to revoke.
           */
          if (!existing) {
            continue;
          }

          const current = this.toDomainEntitlement(existing);

          const next = applyEntitlementFact(current, refundFact, this.clock);

          /*
           * REVOKED -> REVOKED is domain-idempotent.
           * Preserve the original revocation timestamp.
           */
          if (next === current) {
            continue;
          }

          await tx.entitlement.update({
            where: {
              id: existing.id,
            },
            data: {
              status: next.status,
              updatedAt: new Date(next.updatedAt),
              activatedAt: next.activatedAt ? new Date(next.activatedAt) : null,
              revokedAt: next.revokedAt ? new Date(next.revokedAt) : null,
            },
          });
        }

        /*
         * EntitlementDigitalResource grants are historical
         * purchase snapshots and are intentionally retained.
         *
         * BuyerAccessCredential is also intentionally not
         * auto-revoked here. Persisted Order/Entitlement state
         * invalidates access on subsequent validation.
         */

        await tx.outboxEvent.update({
          where: {
            id: event.id,
          },
          data: {
            status: "PROCESSED",
            processedAt: this.clock.now(),
          },
        });

        return "PROCESSED";
      },
      {
        isolationLevel: "ReadCommitted",
      },
    );
  }
}
