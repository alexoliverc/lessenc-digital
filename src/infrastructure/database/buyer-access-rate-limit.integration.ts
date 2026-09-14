import { createHash, randomUUID } from "node:crypto";

import {
  afterAll,
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import { createDatabaseClient } from "./client";
import { PrismaBuyerAccessRateLimitRepository } from "./prisma-buyer-access-rate-limit-repository";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required");
}

const database =
  createDatabaseClient(
    process.env.TEST_DATABASE_URL,
  );

const repository =
  new PrismaBuyerAccessRateLimitRepository(
    database,
  );

const createdHashes =
  new Set<string>();

function hash(): string {
  const value =
    createHash("sha256")
      .update(randomUUID())
      .digest("hex");

  createdHashes.add(value);

  return value;
}

const windowStart =
  new Date("2026-09-13T16:00:00.000Z");

function input(
  overrides: Partial<{
    scope:
      | "EXCHANGE_GLOBAL"
      | "EXCHANGE_CREDENTIAL"
      | "LIBRARY_CREDENTIAL"
      | "DOWNLOAD_CREDENTIAL";
    bucketHash: string;
    windowStart: Date;
    observedAt: Date;
    limit: number;
  }> = {},
) {
  return {
    scope:
      overrides.scope ??
      "EXCHANGE_GLOBAL",
    bucketHash:
      overrides.bucketHash ??
      hash(),
    windowStart:
      overrides.windowStart ??
      windowStart,
    observedAt:
      overrides.observedAt ??
      new Date("2026-09-13T16:00:05.000Z"),
    limit:
      overrides.limit ??
      10,
  } as const;
}

afterEach(async () => {
  const hashes =
    [...createdHashes];

  if (hashes.length > 0) {
    await database.buyerAccessRateLimitBucket.deleteMany({
      where: {
        bucketHash: {
          in: hashes,
        },
      },
    });
  }

  createdHashes.clear();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("P11 Buyer Access rate-limit repository on isolated MySQL", () => {
  it("creates a new fixed-window bucket at request count 1", async () => {
    const value =
      input();

    expect(
      await repository.consume(value),
    ).toBe(1);

    const row =
      await database.buyerAccessRateLimitBucket.findFirst({
        where: {
          scope: value.scope,
          bucketHash: value.bucketHash,
          windowStart: value.windowStart,
        },
      });

    expect(row?.requestCount).toBe(1);
  });

  it("increments the same scope, hash, and window", async () => {
    const value =
      input();

    expect(
      await repository.consume(value),
    ).toBe(1);

    expect(
      await repository.consume(value),
    ).toBe(2);

    expect(
      await repository.consume(value),
    ).toBe(3);
  });

  it("saturates the persisted counter at limit plus one", async () => {
    const value =
      input({
        limit: 2,
      });

    expect(
      await repository.consume(value),
    ).toBe(1);

    expect(
      await repository.consume(value),
    ).toBe(2);

    expect(
      await repository.consume(value),
    ).toBe(3);

    expect(
      await repository.consume(value),
    ).toBe(3);

    expect(
      await repository.consume(value),
    ).toBe(3);

    const row =
      await database.buyerAccessRateLimitBucket.findFirstOrThrow({
        where: {
          scope: value.scope,
          bucketHash: value.bucketHash,
          windowStart: value.windowStart,
        },
      });

    expect(row.requestCount).toBe(3);
  });

  it("isolates identical hashes across scopes", async () => {
    const bucketHash =
      hash();

    const first =
      input({
        scope: "LIBRARY_CREDENTIAL",
        bucketHash,
      });

    const second =
      input({
        scope: "DOWNLOAD_CREDENTIAL",
        bucketHash,
      });

    expect(
      await repository.consume(first),
    ).toBe(1);

    expect(
      await repository.consume(first),
    ).toBe(2);

    expect(
      await repository.consume(second),
    ).toBe(1);
  });

  it("isolates distinct hashes inside the same scope", async () => {
    const first =
      input();

    const second =
      input();

    expect(
      await repository.consume(first),
    ).toBe(1);

    expect(
      await repository.consume(first),
    ).toBe(2);

    expect(
      await repository.consume(second),
    ).toBe(1);
  });

  it("isolates the same scope and hash across fixed windows", async () => {
    const bucketHash =
      hash();

    const first =
      input({
        bucketHash,
        windowStart:
          new Date("2026-09-13T16:00:00.000Z"),
      });

    const second =
      input({
        bucketHash,
        windowStart:
          new Date("2026-09-13T16:01:00.000Z"),
        observedAt:
          new Date("2026-09-13T16:01:05.000Z"),
      });

    expect(
      await repository.consume(first),
    ).toBe(1);

    expect(
      await repository.consume(first),
    ).toBe(2);

    expect(
      await repository.consume(second),
    ).toBe(1);
  });

  it("serializes concurrent consumers without losing increments", async () => {
    const value =
      input({
        limit: 100,
      });

    const results =
      await Promise.all(
        Array.from(
          {
            length: 20,
          },
          () =>
            repository.consume(value),
        ),
      );

    expect(
      [...results].sort(
        (left, right) =>
          left - right,
      ),
    ).toEqual(
      Array.from(
        {
          length: 20,
        },
        (_, index) =>
          index + 1,
      ),
    );

    const row =
      await database.buyerAccessRateLimitBucket.findFirstOrThrow({
        where: {
          scope: value.scope,
          bucketHash: value.bucketHash,
          windowStart: value.windowStart,
        },
      });

    expect(row.requestCount).toBe(20);
  });
});
