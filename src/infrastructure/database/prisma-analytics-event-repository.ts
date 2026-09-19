import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type {
  AnalyticsConsentSnapshot,
  AnalyticsEventCreateResult,
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

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function sameConsentSnapshot(
  left: AnalyticsConsentSnapshot,
  right: AnalyticsConsentSnapshot,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];

    if (leftKey === undefined || rightKey === undefined || leftKey !== rightKey) {
      return false;
    }

    if (left[leftKey] !== right[rightKey]) {
      return false;
    }
  }

  return true;
}

function isCompatibleExistingEvent(
  existing: AnalyticsEventRecord,
  input: CreateAnalyticsEvent,
): boolean {
  return (
    existing.id === input.id &&
    existing.type === input.type &&
    existing.occurredAt.getTime() === input.occurredAt.getTime() &&
    existing.journeyId === input.journeyId &&
    existing.productId === input.productId &&
    existing.offerId === input.offerId &&
    existing.orderId === input.orderId &&
    existing.amountMinor === input.amountMinor &&
    existing.currency === input.currency &&
    existing.attributionState === input.attributionState &&
    sameConsentSnapshot(existing.consentSnapshot, input.consentSnapshot) &&
    existing.schemaVersion === input.schemaVersion &&
    existing.purchaseOrderKey === input.purchaseOrderKey
  );
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

  async createIdempotent(input: CreateAnalyticsEvent): Promise<AnalyticsEventCreateResult> {
    try {
      const event = await this.create(input);

      return Object.freeze({
        state: "CREATED" as const,
        event,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      /*
       * P13-D technical deduplication is based on the canonical
       * AnalyticsEvent identity supplied by the producer.
       *
       * A different unique-key conflict, including the future
       * PURCHASE order key, is not silently converted into a
       * technical replay.
       */
      const existing = await this.findById(input.id);

      if (existing === null) {
        throw error;
      }

      if (!isCompatibleExistingEvent(existing, input)) {
        throw new Error("ANALYTICS_EVENT_ID_CONFLICT", { cause: error });
      }

      return Object.freeze({
        state: "EXISTING" as const,
        event: existing,
      });
    }
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
