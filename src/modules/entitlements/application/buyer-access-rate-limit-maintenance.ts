import {
  createP11CorrelationId,
  p11Observability,
} from "../../../lib/observability/p11-observability";
import {
  type Clock,
  SystemClock,
} from "../../../shared/clock";

export const BUYER_ACCESS_RATE_LIMIT_RETENTION_SECONDS =
  24 * 60 * 60;

export const BUYER_ACCESS_RATE_LIMIT_DEFAULT_CLEANUP_BATCH_SIZE =
  500;

export const BUYER_ACCESS_RATE_LIMIT_MAX_CLEANUP_BATCH_SIZE =
  5_000;

export interface BuyerAccessRateLimitMaintenanceRepository {
  countStaleBefore(
    cutoff: Date,
  ): Promise<number>;

  deleteStaleBatchBefore(
    cutoff: Date,
    limit: number,
  ): Promise<number>;
}

export type BuyerAccessRateLimitCleanupResult =
  Readonly<{
    cutoff: Date;
    staleBefore: number;
    deletedCount: number;
    staleAfter: number;
    batches: number;
  }>;

function requireSafeCount(
  value: number,
  code: string,
): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(code);
  }

  return value;
}

function requireBatchSize(
  value: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value >
      BUYER_ACCESS_RATE_LIMIT_MAX_CLEANUP_BATCH_SIZE
  ) {
    throw new Error(
      "INVALID_RATE_LIMIT_CLEANUP_BATCH_SIZE",
    );
  }

  return value;
}

export class CleanupBuyerAccessRateLimitBuckets {
  constructor(
    private readonly repository:
      BuyerAccessRateLimitMaintenanceRepository,
    private readonly clock: Clock =
      new SystemClock(),
  ) {}

  async execute(
    batchSize =
      BUYER_ACCESS_RATE_LIMIT_DEFAULT_CLEANUP_BATCH_SIZE,
  ): Promise<BuyerAccessRateLimitCleanupResult> {
    const normalizedBatchSize =
      requireBatchSize(batchSize);

    const observedAt =
      this.clock.now();

    const observedAtMs =
      observedAt.getTime();

    if (!Number.isFinite(observedAtMs)) {
      throw new Error(
        "INVALID_RATE_LIMIT_CLEANUP_CLOCK",
      );
    }

    const cutoff =
      new Date(
        observedAtMs -
          BUYER_ACCESS_RATE_LIMIT_RETENTION_SECONDS *
            1000,
      );

    const correlationId =
      createP11CorrelationId();

    try {
      const staleBefore =
        requireSafeCount(
          await this.repository.countStaleBefore(
            cutoff,
          ),
          "INVALID_RATE_LIMIT_STALE_COUNT",
        );

      let deletedCount = 0;
      let batches = 0;
      let remaining =
        staleBefore;

      while (remaining > 0) {
        const batchLimit =
          Math.min(
            normalizedBatchSize,
            remaining,
          );

        const deleted =
          requireSafeCount(
            await this.repository.deleteStaleBatchBefore(
              cutoff,
              batchLimit,
            ),
            "INVALID_RATE_LIMIT_CLEANUP_COUNT",
          );

        if (deleted > batchLimit) {
          throw new Error(
            "INVALID_RATE_LIMIT_CLEANUP_COUNT",
          );
        }

        batches += 1;
        deletedCount += deleted;

        if (deleted === 0) {
          break;
        }

        remaining -= deleted;
      }

      const staleAfter =
        requireSafeCount(
          await this.repository.countStaleBefore(
            cutoff,
          ),
          "INVALID_RATE_LIMIT_STALE_COUNT",
        );

      if (staleAfter > 0) {
        p11Observability.warn(
          "rate_limit_stale_buckets_detected",
          {
            correlationId,
            surface: "RATE_LIMIT",
            outcome: "DEGRADED",
            failureCode:
              "RATE_LIMIT_STALE_BUCKETS_DETECTED",
            windowSeconds:
              BUYER_ACCESS_RATE_LIMIT_RETENTION_SECONDS,
            limit:
              normalizedBatchSize,
          },
        );
      }

      p11Observability.info(
        "rate_limit_cleanup_completed",
        {
          correlationId,
          surface: "RATE_LIMIT",
          outcome: "SUCCEEDED",
          windowSeconds:
            BUYER_ACCESS_RATE_LIMIT_RETENTION_SECONDS,
          limit:
            normalizedBatchSize,
        },
      );

      return Object.freeze({
        cutoff,
        staleBefore,
        deletedCount,
        staleAfter,
        batches,
      });
    } catch (error) {
      p11Observability.error(
        "rate_limit_cleanup_failed",
        {
          correlationId,
          surface: "RATE_LIMIT",
          outcome: "FAILED",
          failureCode:
            "RATE_LIMIT_CLEANUP_FAILED",
          windowSeconds:
            BUYER_ACCESS_RATE_LIMIT_RETENTION_SECONDS,
          limit:
            normalizedBatchSize,
        },
      );

      throw error;
    }
  }
}
