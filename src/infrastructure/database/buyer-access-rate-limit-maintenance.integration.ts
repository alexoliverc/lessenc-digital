import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  afterAll,
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createDatabaseClient,
} from "./client";
import {
  PrismaBuyerAccessRateLimitRepository,
} from "./prisma-buyer-access-rate-limit-repository";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is required",
  );
}

const database =
  createDatabaseClient(
    process.env.TEST_DATABASE_URL,
  );

const repository =
  new PrismaBuyerAccessRateLimitRepository(
    database,
  );

const hashes =
  new Set<string>();

function fixtureHash(): string {
  const value =
    createHash("sha256")
      .update(
        randomUUID(),
      )
      .digest("hex");

  hashes.add(value);

  return value;
}

async function insertBucket(
  windowStart: Date,
): Promise<string> {
  const bucketHash =
    fixtureHash();

  await database
    .buyerAccessRateLimitBucket
    .create({
      data: {
        scope:
          "EXCHANGE_GLOBAL",
        bucketHash,
        windowStart,
        requestCount: 1,
      },
    });

  return bucketHash;
}

afterEach(async () => {
  if (hashes.size > 0) {
    await database
      .buyerAccessRateLimitBucket
      .deleteMany({
        where: {
          bucketHash: {
            in: [...hashes],
          },
        },
      });
  }

  hashes.clear();
});

afterAll(async () => {
  await database.$disconnect();
});

describe(
  "P11 Buyer Access rate-limit cleanup on isolated MySQL",
  () => {
    const cutoff =
      new Date(
        "2026-09-12T20:00:00.000Z",
      );

    it(
      "counts only buckets strictly older than the cutoff",
      async () => {
        await insertBucket(
          new Date(
            "2026-09-12T19:59:59.999Z",
          ),
        );

        await insertBucket(
          new Date(
            "2026-09-12T20:00:00.000Z",
          ),
        );

        await insertBucket(
          new Date(
            "2026-09-13T20:00:00.000Z",
          ),
        );

        expect(
          await repository
            .countStaleBefore(
              cutoff,
            ),
        ).toBe(1);
      },
    );

    it(
      "deletes only the requested stale batch and preserves recent buckets",
      async () => {
        const oldest =
          await insertBucket(
            new Date(
              "2026-09-10T20:00:00.000Z",
            ),
          );

        const middle =
          await insertBucket(
            new Date(
              "2026-09-11T20:00:00.000Z",
            ),
          );

        const newestStale =
          await insertBucket(
            new Date(
              "2026-09-12T19:00:00.000Z",
            ),
          );

        const recent =
          await insertBucket(
            new Date(
              "2026-09-13T19:00:00.000Z",
            ),
          );

        expect(
          await repository
            .deleteStaleBatchBefore(
              cutoff,
              2,
            ),
        ).toBe(2);

        expect(
          await database
            .buyerAccessRateLimitBucket
            .count({
              where: {
                bucketHash: {
                  in: [
                    oldest,
                    middle,
                  ],
                },
              },
            }),
        ).toBe(0);

        expect(
          await database
            .buyerAccessRateLimitBucket
            .count({
              where: {
                bucketHash:
                  newestStale,
              },
            }),
        ).toBe(1);

        expect(
          await database
            .buyerAccessRateLimitBucket
            .count({
              where: {
                bucketHash:
                  recent,
              },
            }),
        ).toBe(1);
      },
    );

    it(
      "is idempotent after all stale buckets are deleted",
      async () => {
        await insertBucket(
          new Date(
            "2026-09-10T20:00:00.000Z",
          ),
        );

        await insertBucket(
          new Date(
            "2026-09-11T20:00:00.000Z",
          ),
        );

        expect(
          await repository
            .deleteStaleBatchBefore(
              cutoff,
              500,
            ),
        ).toBe(2);

        expect(
          await repository
            .deleteStaleBatchBefore(
              cutoff,
              500,
            ),
        ).toBe(0);

        expect(
          await repository
            .countStaleBefore(
              cutoff,
            ),
        ).toBe(0);
      },
    );
  },
);
