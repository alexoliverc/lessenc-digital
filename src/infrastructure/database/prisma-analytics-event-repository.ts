import type { PrismaClient } from "../../generated/prisma/client";
import type {
  AnalyticsConsentSnapshot,
  AnalyticsEventRecord,
  AnalyticsEventRepository,
  CreateAnalyticsEvent,
} from "../../modules/attribution/application/persistence";

function consentSnapshot(value: unknown): AnalyticsConsentSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("INVALID_ANALYTICS_CONSENT_SNAPSHOT");
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, string | number | boolean | null> = {};

  for (const [key, candidate] of Object.entries(source)) {
    if (
      candidate !== null &&
      typeof candidate !== "string" &&
      typeof candidate !== "number" &&
      typeof candidate !== "boolean"
    ) {
      throw new Error("INVALID_ANALYTICS_CONSENT_SNAPSHOT");
    }

    result[key] = candidate;
  }

  return Object.freeze(result);
}

function toRecord(
  row: Readonly<{
    id: string;
    type: "VIEW_CONTENT" | "INITIATE_CHECKOUT" | "PURCHASE";
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
  }>,
): AnalyticsEventRecord {
  return Object.freeze({
    id: row.id,
    type: row.type,
    occurredAt: row.occurredAt,
    journeyId: row.journeyId,
    productId: row.productId,
    offerId: row.offerId,
    orderId: row.orderId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    attributionState: row.attributionState,
    consentSnapshot: consentSnapshot(row.consentSnapshot),
    schemaVersion: row.schemaVersion,
    purchaseOrderKey: row.purchaseOrderKey,
    createdAt: row.createdAt,
  });
}

export class PrismaAnalyticsEventRepository implements AnalyticsEventRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateAnalyticsEvent): Promise<AnalyticsEventRecord> {
    const row = await this.db.analyticsEvent.create({
      data: {
        id: input.id,
        type: input.type,
        occurredAt: input.occurredAt,
        journeyId: input.journeyId,
        productId: input.productId,
        offerId: input.offerId,
        orderId: input.orderId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        attributionState: input.attributionState,
        consentSnapshot: {
          ...input.consentSnapshot,
        },
        schemaVersion: input.schemaVersion,
        purchaseOrderKey: input.purchaseOrderKey,
      },
    });

    return toRecord(row);
  }

  async findById(eventId: string): Promise<AnalyticsEventRecord | null> {
    const row = await this.db.analyticsEvent.findUnique({
      where: {
        id: eventId,
      },
    });

    return row ? toRecord(row) : null;
  }

  async findPurchaseByOrderKey(orderKey: string): Promise<AnalyticsEventRecord | null> {
    const row = await this.db.analyticsEvent.findUnique({
      where: {
        purchaseOrderKey: orderKey,
      },
    });

    return row ? toRecord(row) : null;
  }
}
