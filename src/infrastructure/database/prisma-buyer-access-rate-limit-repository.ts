import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type {
  BuyerAccessRateLimitConsumeInput,
  BuyerAccessRateLimitRepository,
} from "../../modules/entitlements/application/buyer-access-rate-limit";
import type { BuyerAccessRateLimitMaintenanceRepository } from "../../modules/entitlements/application/buyer-access-rate-limit-maintenance";

type CounterRow = Readonly<{
  request_count: number | bigint;
}>;

const HASH_PATTERN = /^[a-f0-9]{64}$/u;

export class PrismaBuyerAccessRateLimitRepository
  implements BuyerAccessRateLimitRepository, BuyerAccessRateLimitMaintenanceRepository
{
  constructor(private readonly db: PrismaClient) {}

  async countStaleBefore(cutoff: Date): Promise<number> {
    if (!Number.isFinite(cutoff.getTime())) {
      throw new Error("INVALID_RATE_LIMIT_CLEANUP_CUTOFF");
    }

    return this.db.buyerAccessRateLimitBucket.count({
      where: {
        windowStart: {
          lt: cutoff,
        },
      },
    });
  }

  async deleteStaleBatchBefore(cutoff: Date, limit: number): Promise<number> {
    if (
      !Number.isFinite(cutoff.getTime()) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 5_000
    ) {
      throw new Error("INVALID_RATE_LIMIT_CLEANUP_INPUT");
    }

    return this.db.$executeRaw`
      DELETE FROM buyer_access_rate_limit_buckets
      WHERE window_start < ${cutoff}
      ORDER BY window_start ASC
      LIMIT ${limit}
    `;
  }

  async consume(input: BuyerAccessRateLimitConsumeInput): Promise<number> {
    if (
      !input.scope ||
      input.scope.length > 32 ||
      !HASH_PATTERN.test(input.bucketHash) ||
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100_000 ||
      !Number.isFinite(input.windowStart.getTime()) ||
      !Number.isFinite(input.observedAt.getTime())
    ) {
      throw new Error("INVALID_RATE_LIMIT_INPUT");
    }

    const counterCap = input.limit + 1;

    return this.db.$transaction(
      async (tx) => {
        /*
         * The composite primary key identifies one
         * fixed-window bucket.
         *
         * INSERT ... ON DUPLICATE KEY UPDATE is atomic
         * in MySQL and serializes concurrent increments
         * on the same bucket row.
         *
         * The counter saturates at limit + 1. We only
         * need to distinguish allowed from denied; an
         * attacker must not grow an unsigned counter
         * without bound.
         */
        await tx.$executeRaw`
          INSERT INTO buyer_access_rate_limit_buckets (
            scope,
            bucket_hash,
            window_start,
            request_count,
            created_at,
            updated_at
          )
          VALUES (
            ${input.scope},
            ${input.bucketHash},
            ${input.windowStart},
            1,
            ${input.observedAt},
            ${input.observedAt}
          )
          ON DUPLICATE KEY UPDATE
            request_count = LEAST(request_count + 1, ${counterCap}),
            updated_at = ${input.observedAt}
        `;

        const rows = await tx.$queryRaw<CounterRow[]>`
          SELECT request_count
          FROM buyer_access_rate_limit_buckets
          WHERE scope = ${input.scope}
            AND bucket_hash = ${input.bucketHash}
            AND window_start = ${input.windowStart}
          FOR UPDATE
        `;

        if (rows.length !== 1) {
          throw new Error("RATE_LIMIT_COUNTER_NOT_FOUND");
        }

        const requestCount = Number(rows[0]?.request_count);

        if (!Number.isSafeInteger(requestCount) || requestCount < 1 || requestCount > counterCap) {
          throw new Error("INVALID_RATE_LIMIT_COUNTER");
        }

        return requestCount;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5_000,
      },
    );
  }
}
