import { describe, expect, it, vi } from "vitest";

import type { BuyerSubject } from "./buyer-session";
import {
  BuyerAccessRateLimitExceeded,
  RateLimitedBuyerAccessExchangeExecutor,
  RateLimitedBuyerLibraryReader,
  RateLimitedProtectedDownloadPreparer,
} from "./buyer-access-rate-limit-enforcement";

const HASH_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const HASH_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const SUBJECT: BuyerSubject = Object.freeze({
  customerId: "11111111-1111-4111-8111-111111111111",
  orderId: "22222222-2222-4222-8222-222222222222",
  credentialId: "33333333-3333-4333-8333-333333333333",
});

function allowed() {
  return {
    allowed: true,
    limit: 10,
    remaining: 9,
    retryAfterSeconds: 0,
    windowStart: new Date("2026-09-13T16:00:00.000Z"),
    windowEnd: new Date("2026-09-13T16:01:00.000Z"),
  } as const;
}

function denied(retryAfterSeconds = 37) {
  return {
    allowed: false,
    limit: 10,
    remaining: 0,
    retryAfterSeconds,
    windowStart: new Date("2026-09-13T16:00:00.000Z"),
    windowEnd: new Date("2026-09-13T16:01:00.000Z"),
  } as const;
}

function hasher() {
  return {
    hash: vi.fn((scope: string) => (scope === "EXCHANGE_GLOBAL" ? HASH_A : HASH_B)),
  };
}

describe("Buyer Access rate-limit enforcement decorators", () => {
  it("allows exchange only after both global and credential buckets allow it", async () => {
    const inner = {
      execute: vi.fn().mockResolvedValue({
        sessionToken: "session-token",
      }),
    };

    const limiter = {
      consume: vi.fn().mockResolvedValue(allowed()),
    };

    const keyHasher = hasher();

    const executor = new RateLimitedBuyerAccessExchangeExecutor(inner, limiter, keyHasher);

    await expect(executor.execute("lba_example")).resolves.toEqual({
      sessionToken: "session-token",
    });

    expect(limiter.consume).toHaveBeenCalledTimes(2);
    expect(inner.execute).toHaveBeenCalledTimes(1);
  });

  it("stops exchange immediately when the global bucket is denied", async () => {
    const inner = {
      execute: vi.fn(),
    };

    const limiter = {
      consume: vi.fn().mockResolvedValue(denied(42)),
    };

    const executor = new RateLimitedBuyerAccessExchangeExecutor(inner, limiter, hasher());

    await expect(executor.execute("lba_example")).rejects.toMatchObject({
      message: "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: 42,
    });

    expect(limiter.consume).toHaveBeenCalledTimes(1);
    expect(inner.execute).not.toHaveBeenCalled();
  });

  it("stops exchange when the credential bucket is denied", async () => {
    const inner = {
      execute: vi.fn(),
    };

    const limiter = {
      consume: vi.fn().mockResolvedValueOnce(allowed()).mockResolvedValueOnce(denied(300)),
    };

    const executor = new RateLimitedBuyerAccessExchangeExecutor(inner, limiter, hasher());

    await expect(executor.execute("lba_example")).rejects.toMatchObject({
      message: "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: 300,
    });

    expect(limiter.consume).toHaveBeenCalledTimes(2);
    expect(inner.execute).not.toHaveBeenCalled();
  });

  it("propagates limiter infrastructure failure without calling credential exchange", async () => {
    const inner = {
      execute: vi.fn(),
    };

    const limiter = {
      consume: vi.fn().mockRejectedValue(new Error("DB_UNAVAILABLE")),
    };

    const executor = new RateLimitedBuyerAccessExchangeExecutor(inner, limiter, hasher());

    await expect(executor.execute("lba_example")).rejects.toThrow("DB_UNAVAILABLE");

    expect(inner.execute).not.toHaveBeenCalled();
  });

  it("supports non-string invalid exchange material without persisting raw material", async () => {
    const inner = {
      execute: vi.fn().mockResolvedValue({
        sessionToken: "session-token",
      }),
    };

    const limiter = {
      consume: vi.fn().mockResolvedValue(allowed()),
    };

    const keyHasher = hasher();

    const executor = new RateLimitedBuyerAccessExchangeExecutor(inner, limiter, keyHasher);

    await executor.execute({
      invalid: true,
    });

    expect(keyHasher.hash).toHaveBeenNthCalledWith(2, "EXCHANGE_CREDENTIAL", '{"invalid":true}');
  });

  it("allows library access only after the credential bucket allows it", async () => {
    const inner = {
      execute: vi.fn().mockResolvedValue([]),
    };

    const limiter = {
      consume: vi.fn().mockResolvedValue(allowed()),
    };

    const reader = new RateLimitedBuyerLibraryReader(inner, limiter, hasher());

    await expect(reader.execute(SUBJECT)).resolves.toEqual([]);

    expect(inner.execute).toHaveBeenCalledWith(SUBJECT);
  });

  it("denies library access before the resource reader executes", async () => {
    const inner = {
      execute: vi.fn(),
    };

    const limiter = {
      consume: vi.fn().mockResolvedValue(denied(18)),
    };

    const reader = new RateLimitedBuyerLibraryReader(inner, limiter, hasher());

    await expect(reader.execute(SUBJECT)).rejects.toBeInstanceOf(BuyerAccessRateLimitExceeded);

    expect(inner.execute).not.toHaveBeenCalled();
  });

  it("allows protected delivery preparation after the credential bucket allows it", async () => {
    const delivery = {
      resourceId: "44444444-4444-4444-8444-444444444444",
    };

    const inner = {
      execute: vi.fn().mockResolvedValue(delivery),
    };

    const limiter = {
      consume: vi.fn().mockResolvedValue(allowed()),
    };

    const preparer = new RateLimitedProtectedDownloadPreparer(inner as never, limiter, hasher());

    await expect(preparer.execute(SUBJECT, delivery.resourceId)).resolves.toBe(delivery);
  });

  it("denies protected delivery before storage preparation executes", async () => {
    const inner = {
      execute: vi.fn(),
    };

    const limiter = {
      consume: vi.fn().mockResolvedValue(denied(12)),
    };

    const preparer = new RateLimitedProtectedDownloadPreparer(inner, limiter, hasher());

    await expect(
      preparer.execute(SUBJECT, "44444444-4444-4444-8444-444444444444"),
    ).rejects.toMatchObject({
      retryAfterSeconds: 12,
    });

    expect(inner.execute).not.toHaveBeenCalled();
  });
});
