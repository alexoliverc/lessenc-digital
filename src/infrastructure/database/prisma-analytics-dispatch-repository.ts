import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type {
  AnalyticsConsentSnapshot,
  AnalyticsDispatchRecord,
  AnalyticsDispatchRepository,
  AnalyticsEventRecord,
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
  if (
    row.consentSnapshot === null ||
    typeof row.consentSnapshot !== "object" ||
    Array.isArray(row.consentSnapshot)
  ) {
    throw new Error("INVALID_ANALYTICS_CONSENT_SNAPSHOT");
  }

  return Object.freeze({
    ...row,
    consentSnapshot: Object.freeze({
      ...(row.consentSnapshot as AnalyticsConsentSnapshot),
    }),
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
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

  async createIdempotent(input: CreateAnalyticsDispatch): Promise<AnalyticsDispatchRecord> {
    try {
      return await this.create(input);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.findByEventProviderChannel(
        input.analyticsEventId,
        input.provider,
        input.channel,
      );

      if (existing === null) {
        throw error;
      }

      return existing;
    }
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

  async findUndispatchedEvents(input: {
    provider: string;
    channel: string;
    limit: number;
  }): Promise<readonly AnalyticsEventRecord[]> {
    const rows = await this.db.analyticsEvent.findMany({
      where: {
        dispatches: {
          none: {
            provider: input.provider,
            channel: input.channel,
          },
        },
      },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      take: input.limit,
    });

    return Object.freeze(rows.map(toEventRecord));
  }

  async claimDue(input: {
    provider: string;
    channel: string;
    attemptedAt: Date;
  }): Promise<Readonly<{
    dispatch: AnalyticsDispatchRecord;
    event: AnalyticsEventRecord;
  }> | null> {
    return this.db.$transaction(
      async (transaction) => {
        const candidates = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT id
            FROM analytics_dispatches
            WHERE provider = ${input.provider}
              AND channel = ${input.channel}
              AND status IN ('PENDING', 'RETRYABLE')
              AND (next_attempt_at IS NULL OR next_attempt_at <= ${input.attemptedAt})
            ORDER BY COALESCE(next_attempt_at, created_at) ASC, id ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          `,
        );

        const candidate = candidates[0];

        if (candidate === undefined) {
          return null;
        }

        const claimed = await transaction.analyticsDispatch.update({
          where: {
            id: candidate.id,
          },
          data: {
            status: "PROCESSING",
            attemptCount: {
              increment: 1,
            },
            lastAttemptAt: input.attemptedAt,
            nextAttemptAt: null,
            lastErrorCode: null,
            lastErrorClass: null,
          },
          include: {
            analyticsEvent: true,
          },
        });

        return Object.freeze({
          dispatch: toRecord(claimed),
          event: toEventRecord(claimed.analyticsEvent),
        });
      },
      {
        isolationLevel: "ReadCommitted",
      },
    );
  }

  async recoverStaleProcessing(input: {
    provider: string;
    channel: string;
    staleBefore: Date;
    recoveredAt: Date;
    limit: number;
  }): Promise<number> {
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 1_000) {
      throw new Error("INVALID_ANALYTICS_DISPATCH_RECOVERY_LIMIT");
    }

    if (
      Number.isNaN(input.staleBefore.getTime()) ||
      Number.isNaN(input.recoveredAt.getTime()) ||
      input.recoveredAt.getTime() < input.staleBefore.getTime()
    ) {
      throw new Error("INVALID_ANALYTICS_DISPATCH_RECOVERY_WINDOW");
    }

    return this.db.$transaction(
      async (transaction) => {
        const candidates = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT id
            FROM analytics_dispatches
            WHERE provider = ${input.provider}
              AND channel = ${input.channel}
              AND status = 'PROCESSING'
              AND last_attempt_at IS NOT NULL
              AND last_attempt_at <= ${input.staleBefore}
            ORDER BY last_attempt_at ASC, id ASC
            LIMIT ${input.limit}
            FOR UPDATE SKIP LOCKED
          `,
        );

        if (candidates.length === 0) {
          return 0;
        }

        const ids = candidates.map((candidate) => candidate.id);

        const recovered = await transaction.analyticsDispatch.updateMany({
          where: {
            id: {
              in: ids,
            },
            provider: input.provider,
            channel: input.channel,
            status: "PROCESSING",
            lastAttemptAt: {
              lte: input.staleBefore,
            },
          },
          data: {
            status: "RETRYABLE",
            nextAttemptAt: input.recoveredAt,
            lastErrorCode: "WORKER_LEASE_EXPIRED",
            lastErrorClass: "RETRYABLE",
            completedAt: null,
          },
        });

        return recovered.count;
      },
      {
        isolationLevel: "ReadCommitted",
      },
    );
  }
  async markSuppressed(input: {
    dispatchId: string;
    completedAt: Date;
    errorCode?: string;
    errorClass?: string;
  }): Promise<AnalyticsDispatchRecord> {
    return this.transitionFromProcessing(input.dispatchId, {
      status: "SUPPRESSED",
      nextAttemptAt: null,
      lastErrorCode: input.errorCode ?? "CONSENT_NOT_GRANTED",
      lastErrorClass: input.errorClass ?? "CONSENT_POLICY",
      completedAt: input.completedAt,
    });
  }
  async markSucceeded(input: {
    dispatchId: string;
    providerEventId: string;
    completedAt: Date;
  }): Promise<AnalyticsDispatchRecord> {
    return this.transitionFromProcessing(input.dispatchId, {
      status: "SUCCEEDED",
      providerEventId: input.providerEventId,
      completedAt: input.completedAt,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorClass: null,
    });
  }

  async markRetryable(input: {
    dispatchId: string;
    nextAttemptAt: Date;
    errorCode: string;
    errorClass: string;
  }): Promise<AnalyticsDispatchRecord> {
    return this.transitionFromProcessing(input.dispatchId, {
      status: "RETRYABLE",
      nextAttemptAt: input.nextAttemptAt,
      lastErrorCode: input.errorCode,
      lastErrorClass: input.errorClass,
      completedAt: null,
    });
  }

  async markFailed(input: {
    dispatchId: string;
    errorCode: string;
    errorClass: string;
    completedAt: Date;
  }): Promise<AnalyticsDispatchRecord> {
    return this.transitionFromProcessing(input.dispatchId, {
      status: "FAILED",
      nextAttemptAt: null,
      lastErrorCode: input.errorCode,
      lastErrorClass: input.errorClass,
      completedAt: input.completedAt,
    });
  }

  private async transitionFromProcessing(
    dispatchId: string,
    data: Prisma.AnalyticsDispatchUpdateManyMutationInput,
  ): Promise<AnalyticsDispatchRecord> {
    const updated = await this.db.analyticsDispatch.updateMany({
      where: {
        id: dispatchId,
        status: "PROCESSING",
      },
      data,
    });

    if (updated.count !== 1) {
      throw new Error("ANALYTICS_DISPATCH_TRANSITION_CONFLICT");
    }

    const row = await this.db.analyticsDispatch.findUnique({
      where: {
        id: dispatchId,
      },
    });

    if (row === null) {
      throw new Error("ANALYTICS_DISPATCH_NOT_FOUND");
    }

    return toRecord(row);
  }
}
