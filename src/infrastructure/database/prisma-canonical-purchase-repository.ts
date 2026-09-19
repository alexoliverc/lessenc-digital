import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type {
  CanonicalPurchaseProjectionResult,
  CanonicalPurchaseRepository,
} from "../../modules/analytics/application/canonical-purchase";
import { P13_ANALYTICS_SCHEMA_VERSION } from "../../modules/analytics/application/internal-measurement";
import type {
  AnalyticsConsentSnapshot,
  AnalyticsEventRecord,
} from "../../modules/attribution/application/persistence";
import { operationFingerprint } from "./prisma-payment-repository";

function toEventRecord(row: {
  id: string;
  type: AnalyticsEventRecord["type"];
  occurredAt: Date;
  journeyId: string | null;
  productId: string | null;
  offerId: string | null;
  orderId: string | null;
  amountMinor: number | null;
  currency: string | null;
  attributionState: string;
  consentSnapshot: unknown;
  schemaVersion: number;
  purchaseOrderKey: string | null;
  createdAt: Date;
}): AnalyticsEventRecord {
  const rawConsent = row.consentSnapshot;

  if (!rawConsent || typeof rawConsent !== "object" || Array.isArray(rawConsent)) {
    throw new Error("INVALID_PURCHASE_CONSENT_SNAPSHOT");
  }

  return Object.freeze({
    ...row,
    consentSnapshot: Object.freeze({
      ...(rawConsent as AnalyticsConsentSnapshot),
    }),
  });
}

function ineligible(
  reason: Extract<CanonicalPurchaseProjectionResult, { state: "INELIGIBLE" }>["reason"],
): CanonicalPurchaseProjectionResult {
  return Object.freeze({
    state: "INELIGIBLE" as const,
    reason,
  });
}

export class PrismaCanonicalPurchaseRepository implements CanonicalPurchaseRepository {
  constructor(private readonly db: PrismaClient) {}

  async project(input: {
    orderId: string;
    eventId: string;
  }): Promise<CanonicalPurchaseProjectionResult> {
    return this.db.$transaction(
      async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT id
            FROM orders
            WHERE id = ${input.orderId}
            FOR UPDATE
          `,
        );

        if (locked.length !== 1) {
          return ineligible("ORDER_NOT_FOUND");
        }

        const existing = await transaction.analyticsEvent.findUnique({
          where: {
            purchaseOrderKey: input.orderId,
          },
        });

        if (existing !== null) {
          if (existing.type !== "PURCHASE" || existing.orderId !== input.orderId) {
            throw new Error("PURCHASE_ORDER_KEY_CONFLICT");
          }

          return Object.freeze({
            state: "EXISTING" as const,
            event: toEventRecord(existing),
          });
        }

        const order = await transaction.order.findUnique({
          where: {
            id: input.orderId,
          },
          include: {
            items: true,
            payments: {
              include: {
                events: true,
              },
            },
            attribution: true,
          },
        });

        if (order === null) {
          return ineligible("ORDER_NOT_FOUND");
        }

        const approvedPayments = order.payments.filter((payment) => payment.status === "APPROVED");

        if (approvedPayments.length > 1) {
          return ineligible("AMBIGUOUS_APPROVED_PAYMENT");
        }

        const payment = approvedPayments[0];
        const paymentMethod =
          payment?.paymentMethod === "PIX" || payment?.paymentMethod === "CREDIT_CARD"
            ? payment.paymentMethod
            : null;
        const hasAuthoritativeAppliedObservation =
          payment?.events.some(
            (event) =>
              event.applicationResult === "APPLIED" &&
              event.providerOrderId === payment.providerOrderId &&
              event.providerPaymentId === payment.providerPaymentId &&
              event.amountMinor === payment.amountMinor &&
              event.currency === payment.currency,
          ) ?? false;

        if (
          order.status !== "PAID" ||
          order.paidAt === null ||
          payment === undefined ||
          payment.approvedAt === null ||
          payment.requiresReview ||
          payment.provider !== "MERCADO_PAGO" ||
          payment.providerOrderId === null ||
          payment.providerPaymentId === null ||
          paymentMethod === null ||
          payment.activeAttemptKey !== order.id ||
          payment.submittedAt === null ||
          payment.operationFingerprint !==
            operationFingerprint({
              orderId: order.id,
              paymentId: payment.id,
              amountMinor: payment.amountMinor,
              currency: payment.currency,
              paymentMethod,
            }) ||
          !hasAuthoritativeAppliedObservation ||
          payment.amountMinor !== order.totalMinor ||
          payment.currency !== order.currency ||
          order.currency !== "BRL"
        ) {
          return ineligible("FINANCIAL_STATE_NOT_AUTHORITATIVE");
        }

        const item = order.items[0];

        if (
          order.items.length !== 1 ||
          item === undefined ||
          item.quantity !== 1 ||
          item.unitPriceMinor !== order.totalMinor ||
          item.totalMinor !== order.totalMinor ||
          item.currency !== order.currency
        ) {
          return ineligible("COMMERCIAL_SNAPSHOT_INVALID");
        }

        const attribution = order.attribution;
        const journey =
          attribution?.journeyId === null || attribution?.journeyId === undefined
            ? null
            : await transaction.acquisitionJourney.findUnique({
                where: {
                  id: attribution.journeyId,
                },
              });

        const consentSnapshot: AnalyticsConsentSnapshot = Object.freeze({
          analytics: journey?.analyticsConsentState ?? "UNKNOWN",
          advertising: journey?.advertisingConsentState ?? "UNKNOWN",
          policyVersion: journey?.policyVersion ?? "p13-architecture-freeze-r2",
        });

        const row = await transaction.analyticsEvent.create({
          data: {
            id: input.eventId,
            type: "PURCHASE",
            occurredAt: order.paidAt,
            journeyId: attribution?.journeyId ?? null,
            productId: item.productId,
            offerId: item.offerId,
            orderId: order.id,
            amountMinor: order.totalMinor,
            currency: order.currency,
            attributionState:
              attribution !== null &&
              (attribution.firstTouchId !== null || attribution.lastTouchId !== null)
                ? "ATTRIBUTED"
                : "UNATTRIBUTED",
            consentSnapshot: {
              ...consentSnapshot,
            },
            schemaVersion: P13_ANALYTICS_SCHEMA_VERSION,
            purchaseOrderKey: order.id,
          },
        });

        return Object.freeze({
          state: "CREATED" as const,
          event: toEventRecord(row),
        });
      },
      {
        isolationLevel: "ReadCommitted",
      },
    );
  }

  async findEligibleMissingOrderIds(limit: number): Promise<readonly string[]> {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT o.id
        FROM orders o
        INNER JOIN order_items oi
          ON oi.order_id = o.id
        INNER JOIN payments p
          ON p.order_id = o.id
          AND p.status = 'APPROVED'
        WHERE o.status = 'PAID'
          AND o.paid_at IS NOT NULL
          AND o.currency = 'BRL'
          AND oi.quantity = 1
          AND oi.unit_price_minor = o.total_minor
          AND oi.total_minor = o.total_minor
          AND oi.currency = o.currency
          AND p.approved_at IS NOT NULL
          AND p.requires_review = 0
          AND p.provider = 'MERCADO_PAGO'
          AND p.provider_order_id IS NOT NULL
          AND p.provider_payment_id IS NOT NULL
          AND p.payment_method IN ('PIX', 'CREDIT_CARD')
          AND p.active_attempt_key = o.id
          AND p.submitted_at IS NOT NULL
          AND p.operation_fingerprint IS NOT NULL
          AND p.amount_minor = o.total_minor
          AND p.currency = o.currency
          AND EXISTS (
            SELECT 1
            FROM payment_events pe
            WHERE pe.payment_id = p.id
              AND pe.application_result = 'APPLIED'
              AND pe.provider_order_id = p.provider_order_id
              AND pe.provider_payment_id = p.provider_payment_id
              AND pe.amount_minor = p.amount_minor
              AND pe.currency = p.currency
          )
          AND NOT EXISTS (
            SELECT 1
            FROM analytics_events ae
            WHERE ae.purchase_order_key = o.id
          )
        GROUP BY o.id, o.paid_at
        HAVING COUNT(DISTINCT oi.id) = 1
          AND COUNT(DISTINCT p.id) = 1
        ORDER BY o.paid_at ASC, o.id ASC
        LIMIT ${limit}
      `,
    );

    return Object.freeze(rows.map((row) => row.id));
  }
}
