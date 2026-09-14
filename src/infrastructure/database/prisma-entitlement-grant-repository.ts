import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type {
  EntitlementGrantProcessResult,
  EntitlementGrantRepository,
} from "../../modules/entitlements/application/process-entitlement-grant";
import type { Order as DomainOrder } from "../../modules/commerce/domain/order";
import {
  applyEntitlementFact,
  prepareEntitlement,
  type Entitlement as DomainEntitlement,
} from "../../modules/entitlements/domain/entitlement";
import type { Payment as DomainPayment } from "../../modules/payments/domain/payment";
import { type Clock, SystemClock } from "../../shared/clock";
import { Money } from "../../shared/money";

type Tx = Prisma.TransactionClient;

type PaymentApprovedPayload = Readonly<{
  version: 1;
  orderId: string;
  paymentId: string;
}>;

function parsePaymentApprovedPayload(
  payload: unknown,
  eventOrderId: string,
): PaymentApprovedPayload {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("INVALID_PAYMENT_APPROVED_PAYLOAD");
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
    throw new Error("INVALID_PAYMENT_APPROVED_PAYLOAD");
  }

  return {
    version: 1,
    orderId: candidate.orderId,
    paymentId: candidate.paymentId,
  };
}

export class PrismaEntitlementGrantRepository implements EntitlementGrantRepository {
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

  private async resourceIdsForProduct(tx: Tx, productId: string): Promise<string[]> {
    const mappings = await tx.productDigitalResource.findMany({
      where: { productId },
      include: { resource: true },
      orderBy: { resourceId: "asc" },
    });

    const active = mappings
      .filter((mapping) => mapping.resource.status === "ACTIVE")
      .map((mapping) => mapping.resourceId);

    if (active.length === 0) {
      throw new Error("ENTITLEMENT_RESOURCE_MAPPING_MISSING");
    }

    return active;
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

  async processPaymentApproved(eventId: string): Promise<EntitlementGrantProcessResult> {
    return this.db.$transaction(
      async (tx) => {
        await this.lockOutboxEvent(tx, eventId);

        const event = await tx.outboxEvent.findUnique({
          where: { id: eventId },
        });

        if (!event) {
          throw new Error("OUTBOX_EVENT_NOT_FOUND");
        }

        if (event.type !== "PAYMENT_APPROVED") {
          throw new Error("OUTBOX_EVENT_TYPE_UNSUPPORTED");
        }

        if (event.status === "PROCESSED") {
          return "NOOP";
        }

        if (event.status !== "PENDING") {
          throw new Error("OUTBOX_EVENT_NOT_PROCESSABLE");
        }

        const payload = parsePaymentApprovedPayload(event.payload, event.orderId);

        await this.lockOrder(tx, payload.orderId);

        const order = await tx.order.findUnique({
          where: { id: payload.orderId },
          include: {
            items: {
              orderBy: { createdAt: "asc" },
            },
          },
        });

        if (!order) {
          throw new Error("ENTITLEMENT_ORDER_NOT_FOUND");
        }

        const payment = await tx.payment.findUnique({
          where: { id: payload.paymentId },
        });

        if (!payment) {
          throw new Error("ENTITLEMENT_PAYMENT_NOT_FOUND");
        }

        const sameFinancialOrigin =
          payment.orderId === order.id &&
          payment.amountMinor === order.totalMinor &&
          payment.currency === order.currency;

        /*
         * A PAYMENT_APPROVED event may remain pending while a
         * later, authoritative P10 refund is persisted.
         *
         * In that situation the historical approval must not
         * create access and must not become a poison event.
         */
        if (
          order.status === "REFUNDED" &&
          payment.status === "REFUNDED" &&
          order.paidAt !== null &&
          payment.approvedAt !== null &&
          sameFinancialOrigin
        ) {
          await tx.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: "PROCESSED",
              processedAt: this.clock.now(),
            },
          });

          return "NOOP";
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
          paidAt: order.paidAt?.toISOString() ?? null,
        };

        const domainPayment: DomainPayment = {
          id: payment.id,
          orderId: payment.orderId,
          status: payment.status,
          amount: Money.of(payment.amountMinor, payment.currency),
          createdAt: payment.createdAt.toISOString(),
          updatedAt: payment.updatedAt.toISOString(),
          approvedAt: payment.approvedAt?.toISOString() ?? null,
        };

        for (const item of order.items) {
          const existing = await tx.entitlement.findUnique({
            where: { orderItemId: item.id },
          });

          if (existing?.sourceOutboxEventId && existing.sourceOutboxEventId !== event.id) {
            throw new Error("ENTITLEMENT_FINANCIAL_ORIGIN_CONFLICT");
          }

          let entitlementId: string;
          let next: DomainEntitlement;

          if (existing) {
            next = applyEntitlementFact(
              this.toDomainEntitlement(existing),
              {
                kind: "PAID_ORDER",
                order: domainOrder,
                payment: domainPayment,
              },
              this.clock,
            );

            entitlementId = existing.id;

            await tx.entitlement.update({
              where: { id: entitlementId },
              data: {
                sourceOutboxEventId: event.id,
                status: next.status,
                updatedAt: new Date(next.updatedAt),
                activatedAt: next.activatedAt ? new Date(next.activatedAt) : null,
                revokedAt: next.revokedAt ? new Date(next.revokedAt) : null,
              },
            });
          } else {
            const prepared = prepareEntitlement(
              {
                id: randomUUID(),
                orderItemId: item.id,
              },
              [],
              this.clock,
            );

            next = applyEntitlementFact(
              prepared,
              {
                kind: "PAID_ORDER",
                order: domainOrder,
                payment: domainPayment,
              },
              this.clock,
            );

            entitlementId = next.id;

            await tx.entitlement.create({
              data: {
                id: next.id,
                orderItemId: next.orderItemId,
                sourceOutboxEventId: event.id,
                status: next.status,
                createdAt: new Date(next.createdAt),
                updatedAt: new Date(next.updatedAt),
                activatedAt: next.activatedAt ? new Date(next.activatedAt) : null,
                revokedAt: next.revokedAt ? new Date(next.revokedAt) : null,
              },
            });
          }

          const resourceIds = await this.resourceIdsForProduct(tx, item.productId);

          const existingGrants = await tx.entitlementDigitalResource.findMany({
            where: { entitlementId },
            select: { resourceId: true },
            orderBy: {
              resourceId: "asc",
            },
          });

          if (existingGrants.length === 0) {
            await tx.entitlementDigitalResource.createMany({
              data: resourceIds.map((resourceId) => ({
                entitlementId,
                resourceId,
              })),
            });
          } else {
            const existingResourceIds = existingGrants.map((grant) => grant.resourceId);

            const expectedResourceIds = [...resourceIds].sort();

            if (
              existingResourceIds.length !== expectedResourceIds.length ||
              existingResourceIds.some(
                (resourceId, index) => resourceId !== expectedResourceIds[index],
              )
            ) {
              throw new Error("ENTITLEMENT_RESOURCE_GRANT_CONFLICT");
            }
          }
        }

        await tx.outboxEvent.update({
          where: { id: event.id },
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
