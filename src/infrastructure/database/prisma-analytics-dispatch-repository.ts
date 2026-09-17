import type { PrismaClient } from "../../generated/prisma/client";
import type {
  AnalyticsDispatchRecord,
  AnalyticsDispatchRepository,
  CreateAnalyticsDispatch,
} from "../../modules/attribution/application/persistence";

function toRecord(
  row: Readonly<{
    id: string;
    analyticsEventId: string;
    provider: string;
    channel: string;
    status: "PENDING" | "PROCESSING" | "RETRYABLE" | "SUCCEEDED" | "FAILED" | "SUPPRESSED";
    attemptCount: number;
    nextAttemptAt: Date | null;
    lastAttemptAt: Date | null;
    providerEventId: string | null;
    lastErrorCode: string | null;
    lastErrorClass: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }>,
): AnalyticsDispatchRecord {
  return Object.freeze({
    id: row.id,
    analyticsEventId: row.analyticsEventId,
    provider: row.provider,
    channel: row.channel,
    status: row.status,
    attemptCount: row.attemptCount,
    nextAttemptAt: row.nextAttemptAt,
    lastAttemptAt: row.lastAttemptAt,
    providerEventId: row.providerEventId,
    lastErrorCode: row.lastErrorCode,
    lastErrorClass: row.lastErrorClass,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  });
}

export class PrismaAnalyticsDispatchRepository implements AnalyticsDispatchRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateAnalyticsDispatch): Promise<AnalyticsDispatchRecord> {
    const row = await this.db.analyticsDispatch.create({
      data: {
        id: input.id,
        analyticsEventId: input.analyticsEventId,
        provider: input.provider,
        channel: input.channel,
        status: input.status,
        attemptCount: input.attemptCount,
        nextAttemptAt: input.nextAttemptAt,
        lastAttemptAt: input.lastAttemptAt,
        providerEventId: input.providerEventId,
        lastErrorCode: input.lastErrorCode,
        lastErrorClass: input.lastErrorClass,
        completedAt: input.completedAt,
      },
    });

    return toRecord(row);
  }

  async findByEventProviderChannel(
    analyticsEventId: string,
    provider: string,
    channel: string,
  ): Promise<AnalyticsDispatchRecord | null> {
    const row = await this.db.analyticsDispatch.findUnique({
      where: {
        analyticsEventId_provider_channel: {
          analyticsEventId,
          provider,
          channel,
        },
      },
    });

    return row ? toRecord(row) : null;
  }
}
