import { type Clock, SystemClock } from "../../../shared/clock";

export const BUYER_ACCESS_RATE_LIMIT_SCOPES = [
  "EXCHANGE_GLOBAL",
  "EXCHANGE_CREDENTIAL",
  "LIBRARY_CREDENTIAL",
  "DOWNLOAD_CREDENTIAL",
] as const;

export type BuyerAccessRateLimitScope = (typeof BUYER_ACCESS_RATE_LIMIT_SCOPES)[number];

export type BuyerAccessRateLimitPolicy = Readonly<{
  limit: number;
  windowSeconds: number;
}>;

export type BuyerAccessRateLimitConsumeInput = Readonly<{
  scope: BuyerAccessRateLimitScope;
  bucketHash: string;
  windowStart: Date;
  observedAt: Date;
  limit: number;
}>;

export interface BuyerAccessRateLimitRepository {
  consume(input: BuyerAccessRateLimitConsumeInput): Promise<number>;
}

export type BuyerAccessRateLimitDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  windowStart: Date;
  windowEnd: Date;
}>;

const HASH_PATTERN = /^[a-f0-9]{64}$/u;

function validScope(value: string): value is BuyerAccessRateLimitScope {
  return (BUYER_ACCESS_RATE_LIMIT_SCOPES as readonly string[]).includes(value);
}

function requirePolicy(policy: BuyerAccessRateLimitPolicy): void {
  if (!Number.isSafeInteger(policy.limit) || policy.limit < 1 || policy.limit > 100_000) {
    throw new Error("INVALID_RATE_LIMIT_POLICY");
  }

  if (
    !Number.isSafeInteger(policy.windowSeconds) ||
    policy.windowSeconds < 1 ||
    policy.windowSeconds > 86_400
  ) {
    throw new Error("INVALID_RATE_LIMIT_POLICY");
  }
}

export class FixedWindowBuyerAccessRateLimiter {
  constructor(
    private readonly repository: BuyerAccessRateLimitRepository,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async consume(
    scope: BuyerAccessRateLimitScope,
    bucketHash: string,
    policy: BuyerAccessRateLimitPolicy,
  ): Promise<BuyerAccessRateLimitDecision> {
    if (!validScope(scope)) {
      throw new Error("INVALID_RATE_LIMIT_SCOPE");
    }

    if (!HASH_PATTERN.test(bucketHash)) {
      throw new Error("INVALID_RATE_LIMIT_BUCKET");
    }

    requirePolicy(policy);

    const observedAt = this.clock.now();
    const observedAtMs = observedAt.getTime();

    if (!Number.isFinite(observedAtMs)) {
      throw new Error("INVALID_RATE_LIMIT_CLOCK");
    }

    const windowMs = policy.windowSeconds * 1000;

    const windowStartMs = Math.floor(observedAtMs / windowMs) * windowMs;

    const windowStart = new Date(windowStartMs);
    const windowEnd = new Date(windowStartMs + windowMs);

    const requestCount = await this.repository.consume({
      scope,
      bucketHash,
      windowStart,
      observedAt,
      limit: policy.limit,
    });

    if (
      !Number.isSafeInteger(requestCount) ||
      requestCount < 1 ||
      requestCount > policy.limit + 1
    ) {
      throw new Error("INVALID_RATE_LIMIT_COUNTER");
    }

    const allowed = requestCount <= policy.limit;

    const remaining = Math.max(0, policy.limit - requestCount);

    const retryAfterSeconds = allowed
      ? 0
      : Math.max(1, Math.ceil((windowEnd.getTime() - observedAtMs) / 1000));

    return Object.freeze({
      allowed,
      limit: policy.limit,
      remaining,
      retryAfterSeconds,
      windowStart,
      windowEnd,
    });
  }
}
