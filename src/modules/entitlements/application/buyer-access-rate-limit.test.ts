import { describe, expect, it } from "vitest";

import type { Clock } from "../../../shared/clock";
import {
  FixedWindowBuyerAccessRateLimiter,
  type BuyerAccessRateLimitConsumeInput,
  type BuyerAccessRateLimitRepository,
} from "./buyer-access-rate-limit";

const HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

class FixedClock implements Clock {
  constructor(private readonly value: Date) {}

  now(): Date {
    return new Date(this.value);
  }
}

class StubRepository implements BuyerAccessRateLimitRepository {
  readonly inputs: BuyerAccessRateLimitConsumeInput[] = [];

  constructor(private readonly result: number) {}

  async consume(input: BuyerAccessRateLimitConsumeInput): Promise<number> {
    this.inputs.push(input);

    return this.result;
  }
}

describe("FixedWindowBuyerAccessRateLimiter", () => {
  it("allows a request inside the configured limit", async () => {
    const repository = new StubRepository(1);

    const limiter = new FixedWindowBuyerAccessRateLimiter(
      repository,
      new FixedClock(new Date("2026-09-13T16:00:05.000Z")),
    );

    const result = await limiter.consume("EXCHANGE_GLOBAL", HASH, {
      limit: 5,
      windowSeconds: 60,
    });

    expect(result).toEqual({
      allowed: true,
      limit: 5,
      remaining: 4,
      retryAfterSeconds: 0,
      windowStart: new Date("2026-09-13T16:00:00.000Z"),
      windowEnd: new Date("2026-09-13T16:01:00.000Z"),
    });
  });

  it("denies the first request above the limit", async () => {
    const repository = new StubRepository(6);

    const limiter = new FixedWindowBuyerAccessRateLimiter(
      repository,
      new FixedClock(new Date("2026-09-13T16:00:05.250Z")),
    );

    const result = await limiter.consume("EXCHANGE_GLOBAL", HASH, {
      limit: 5,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBe(55);
  });

  it("passes the exact fixed-window start and observation time to persistence", async () => {
    const repository = new StubRepository(1);
    const observedAt = new Date("2026-09-13T16:01:59.999Z");

    const limiter = new FixedWindowBuyerAccessRateLimiter(repository, new FixedClock(observedAt));

    await limiter.consume("LIBRARY_CREDENTIAL", HASH, {
      limit: 10,
      windowSeconds: 60,
    });

    expect(repository.inputs).toHaveLength(1);

    expect(repository.inputs[0]).toEqual({
      scope: "LIBRARY_CREDENTIAL",
      bucketHash: HASH,
      windowStart: new Date("2026-09-13T16:01:00.000Z"),
      observedAt,
      limit: 10,
    });
  });

  it("moves to a distinct bucket after the fixed window boundary", async () => {
    const firstRepository = new StubRepository(1);

    const first = new FixedWindowBuyerAccessRateLimiter(
      firstRepository,
      new FixedClock(new Date("2026-09-13T16:00:59.999Z")),
    );

    await first.consume("DOWNLOAD_CREDENTIAL", HASH, {
      limit: 2,
      windowSeconds: 60,
    });

    const secondRepository = new StubRepository(1);

    const second = new FixedWindowBuyerAccessRateLimiter(
      secondRepository,
      new FixedClock(new Date("2026-09-13T16:01:00.000Z")),
    );

    await second.consume("DOWNLOAD_CREDENTIAL", HASH, {
      limit: 2,
      windowSeconds: 60,
    });

    expect(firstRepository.inputs[0]?.windowStart).toEqual(new Date("2026-09-13T16:00:00.000Z"));

    expect(secondRepository.inputs[0]?.windowStart).toEqual(new Date("2026-09-13T16:01:00.000Z"));
  });

  it("rejects an unsupported runtime scope", async () => {
    const limiter = new FixedWindowBuyerAccessRateLimiter(
      new StubRepository(1),
      new FixedClock(new Date("2026-09-13T16:00:00.000Z")),
    );

    await expect(
      limiter.consume("INVALID" as never, HASH, {
        limit: 1,
        windowSeconds: 60,
      }),
    ).rejects.toThrow("INVALID_RATE_LIMIT_SCOPE");
  });

  it("rejects a malformed bucket hash", async () => {
    const limiter = new FixedWindowBuyerAccessRateLimiter(
      new StubRepository(1),
      new FixedClock(new Date("2026-09-13T16:00:00.000Z")),
    );

    await expect(
      limiter.consume("EXCHANGE_GLOBAL", "raw-secret-must-not-be-a-bucket-key", {
        limit: 1,
        windowSeconds: 60,
      }),
    ).rejects.toThrow("INVALID_RATE_LIMIT_BUCKET");
  });

  it("rejects an invalid request limit", async () => {
    const limiter = new FixedWindowBuyerAccessRateLimiter(
      new StubRepository(1),
      new FixedClock(new Date("2026-09-13T16:00:00.000Z")),
    );

    await expect(
      limiter.consume("EXCHANGE_GLOBAL", HASH, {
        limit: 0,
        windowSeconds: 60,
      }),
    ).rejects.toThrow("INVALID_RATE_LIMIT_POLICY");
  });

  it("rejects an invalid window duration", async () => {
    const limiter = new FixedWindowBuyerAccessRateLimiter(
      new StubRepository(1),
      new FixedClock(new Date("2026-09-13T16:00:00.000Z")),
    );

    await expect(
      limiter.consume("EXCHANGE_GLOBAL", HASH, {
        limit: 5,
        windowSeconds: 0,
      }),
    ).rejects.toThrow("INVALID_RATE_LIMIT_POLICY");
  });
});
