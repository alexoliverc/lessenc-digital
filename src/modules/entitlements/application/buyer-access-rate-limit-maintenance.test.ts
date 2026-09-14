import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { Clock } from "../../../shared/clock";
import {
  BUYER_ACCESS_RATE_LIMIT_RETENTION_SECONDS,
  CleanupBuyerAccessRateLimitBuckets,
  type BuyerAccessRateLimitMaintenanceRepository,
} from "./buyer-access-rate-limit-maintenance";

const NOW =
  new Date(
    "2026-09-13T20:30:00.000Z",
  );

const EXPECTED_CUTOFF =
  new Date(
    "2026-09-12T20:30:00.000Z",
  );

function clock(
  value: Date = NOW,
): Clock {
  return {
    now: () =>
      new Date(
        value.getTime(),
      ),
  };
}

function repository(
  overrides: Partial<
    BuyerAccessRateLimitMaintenanceRepository
  > = {},
): BuyerAccessRateLimitMaintenanceRepository {
  return {
    countStaleBefore:
      vi.fn()
        .mockResolvedValue(0),

    deleteStaleBatchBefore:
      vi.fn()
        .mockResolvedValue(0),

    ...overrides,
  };
}

function parseRecord(
  value: unknown,
): Record<string, unknown> {
  return JSON.parse(
    String(value),
  ) as Record<string, unknown>;
}

describe(
  "Buyer Access rate-limit maintenance",
  () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it(
      "uses the frozen 24-hour cutoff and is idempotent when no stale buckets exist",
      async () => {
        const info =
          vi.spyOn(
            console,
            "info",
          ).mockImplementation(
            () => undefined,
          );

        const repo =
          repository();

        const service =
          new CleanupBuyerAccessRateLimitBuckets(
            repo,
            clock(),
          );

        const result =
          await service.execute();

        expect(
          BUYER_ACCESS_RATE_LIMIT_RETENTION_SECONDS,
        ).toBe(86_400);

        expect(
          repo.countStaleBefore,
        ).toHaveBeenCalledTimes(2);

        expect(
          repo.countStaleBefore,
        ).toHaveBeenNthCalledWith(
          1,
          EXPECTED_CUTOFF,
        );

        expect(
          repo.deleteStaleBatchBefore,
        ).not.toHaveBeenCalled();

        expect(result).toEqual({
          cutoff:
            EXPECTED_CUTOFF,
          staleBefore: 0,
          deletedCount: 0,
          staleAfter: 0,
          batches: 0,
        });

        expect(
          parseRecord(
            info.mock.calls[0]?.[0],
          ),
        ).toMatchObject({
          event:
            "rate_limit_cleanup_completed",
          surface: "RATE_LIMIT",
          outcome: "SUCCEEDED",
          windowSeconds: 86_400,
          limit: 500,
        });
      },
    );

    it(
      "deletes stale buckets in bounded batches using one frozen cutoff",
      async () => {
        const repo =
          repository({
            countStaleBefore:
              vi.fn()
                .mockResolvedValueOnce(
                  1_200,
                )
                .mockResolvedValueOnce(
                  0,
                ),

            deleteStaleBatchBefore:
              vi.fn()
                .mockResolvedValueOnce(
                  500,
                )
                .mockResolvedValueOnce(
                  500,
                )
                .mockResolvedValueOnce(
                  200,
                ),
          });

        const service =
          new CleanupBuyerAccessRateLimitBuckets(
            repo,
            clock(),
          );

        const result =
          await service.execute(
            500,
          );

        expect(
          repo.deleteStaleBatchBefore,
        ).toHaveBeenNthCalledWith(
          1,
          EXPECTED_CUTOFF,
          500,
        );

        expect(
          repo.deleteStaleBatchBefore,
        ).toHaveBeenNthCalledWith(
          2,
          EXPECTED_CUTOFF,
          500,
        );

        expect(
          repo.deleteStaleBatchBefore,
        ).toHaveBeenNthCalledWith(
          3,
          EXPECTED_CUTOFF,
          200,
        );

        expect(result).toEqual({
          cutoff:
            EXPECTED_CUTOFF,
          staleBefore: 1_200,
          deletedCount: 1_200,
          staleAfter: 0,
          batches: 3,
        });
      },
    );

    it(
      "emits stale-bucket degradation when old rows remain after cleanup",
      async () => {
        const warning =
          vi.spyOn(
            console,
            "warn",
          ).mockImplementation(
            () => undefined,
          );

        const repo =
          repository({
            countStaleBefore:
              vi.fn()
                .mockResolvedValueOnce(
                  10,
                )
                .mockResolvedValueOnce(
                  10,
                ),

            deleteStaleBatchBefore:
              vi.fn()
                .mockResolvedValue(
                  0,
                ),
          });

        const service =
          new CleanupBuyerAccessRateLimitBuckets(
            repo,
            clock(),
          );

        const result =
          await service.execute(
            100,
          );

        expect(
          result.staleAfter,
        ).toBe(10);

        expect(
          parseRecord(
            warning.mock.calls[0]?.[0],
          ),
        ).toMatchObject({
          event:
            "rate_limit_stale_buckets_detected",
          surface: "RATE_LIMIT",
          outcome: "DEGRADED",
          failureCode:
            "RATE_LIMIT_STALE_BUCKETS_DETECTED",
          windowSeconds: 86_400,
          limit: 100,
        });
      },
    );

    it(
      "rejects invalid batch sizes before touching persistence",
      async () => {
        for (
          const value of [
            0,
            -1,
            5_001,
            1.5,
            Number.NaN,
          ]
        ) {
          const repo =
            repository();

          const service =
            new CleanupBuyerAccessRateLimitBuckets(
              repo,
              clock(),
            );

          await expect(
            service.execute(
              value,
            ),
          ).rejects.toThrow(
            "INVALID_RATE_LIMIT_CLEANUP_BATCH_SIZE",
          );

          expect(
            repo.countStaleBefore,
          ).not.toHaveBeenCalled();

          expect(
            repo.deleteStaleBatchBefore,
          ).not.toHaveBeenCalled();
        }
      },
    );

    it(
      "rejects an invalid clock before touching persistence",
      async () => {
        const repo =
          repository();

        const service =
          new CleanupBuyerAccessRateLimitBuckets(
            repo,
            clock(
              new Date(
                Number.NaN,
              ),
            ),
          );

        await expect(
          service.execute(),
        ).rejects.toThrow(
          "INVALID_RATE_LIMIT_CLEANUP_CLOCK",
        );

        expect(
          repo.countStaleBefore,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "logs cleanup failure without serializing persistence error details",
      async () => {
        const diagnostic =
          vi.spyOn(
            console,
            "error",
          ).mockImplementation(
            () => undefined,
          );

        const privateMessage =
          "mysql://private-user:private-password@database";

        const repo =
          repository({
            countStaleBefore:
              vi.fn()
                .mockRejectedValue(
                  new Error(
                    privateMessage,
                  ),
                ),
          });

        const service =
          new CleanupBuyerAccessRateLimitBuckets(
            repo,
            clock(),
          );

        await expect(
          service.execute(),
        ).rejects.toThrow(
          privateMessage,
        );

        const serialized =
          String(
            diagnostic.mock.calls[0]?.[0],
          );

        expect(
          serialized,
        ).not.toContain(
          privateMessage,
        );

        expect(
          parseRecord(
            serialized,
          ),
        ).toMatchObject({
          event:
            "rate_limit_cleanup_failed",
          surface: "RATE_LIMIT",
          outcome: "FAILED",
          failureCode:
            "RATE_LIMIT_CLEANUP_FAILED",
          windowSeconds: 86_400,
          limit: 500,
        });
      },
    );

    it(
      "fails closed when a repository returns an impossible delete count",
      async () => {
        const repo =
          repository({
            countStaleBefore:
              vi.fn()
                .mockResolvedValue(
                  10,
                ),

            deleteStaleBatchBefore:
              vi.fn()
                .mockResolvedValue(
                  11,
                ),
          });

        const service =
          new CleanupBuyerAccessRateLimitBuckets(
            repo,
            clock(),
          );

        await expect(
          service.execute(
            10,
          ),
        ).rejects.toThrow(
          "INVALID_RATE_LIMIT_CLEANUP_COUNT",
        );
      },
    );
  },
);
