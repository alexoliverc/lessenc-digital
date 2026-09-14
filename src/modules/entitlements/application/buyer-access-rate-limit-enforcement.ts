import type {
  BuyerAccessRateLimitDecision,
  BuyerAccessRateLimitPolicy,
  BuyerAccessRateLimitScope,
} from "./buyer-access-rate-limit";
import type { BuyerSubject } from "./buyer-session";
import type { BuyerDigitalResource } from "./list-buyer-digital-resources";
import type { PreparedProtectedDelivery } from "./protected-digital-delivery";

export const BUYER_ACCESS_RATE_LIMIT_POLICIES = Object.freeze({
  EXCHANGE_GLOBAL: Object.freeze({
    limit: 120,
    windowSeconds: 60,
  }),
  EXCHANGE_CREDENTIAL: Object.freeze({
    limit: 6,
    windowSeconds: 600,
  }),
  LIBRARY_CREDENTIAL: Object.freeze({
    limit: 120,
    windowSeconds: 60,
  }),
  DOWNLOAD_CREDENTIAL: Object.freeze({
    limit: 30,
    windowSeconds: 60,
  }),
} satisfies Record<BuyerAccessRateLimitScope, BuyerAccessRateLimitPolicy>);

export interface BuyerAccessRateLimiter {
  consume(
    scope: BuyerAccessRateLimitScope,
    bucketHash: string,
    policy: BuyerAccessRateLimitPolicy,
  ): Promise<BuyerAccessRateLimitDecision>;
}

export interface BuyerAccessRateLimitKeyHasher {
  hash(scope: BuyerAccessRateLimitScope, material: string): string;
}

export class BuyerAccessRateLimitExceeded extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("RATE_LIMIT_EXCEEDED");

    if (
      !Number.isSafeInteger(retryAfterSeconds) ||
      retryAfterSeconds < 1 ||
      retryAfterSeconds > 86_400
    ) {
      throw new Error("INVALID_RATE_LIMIT_RETRY_AFTER");
    }

    this.name = "BuyerAccessRateLimitExceeded";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class BuyerAccessRateLimitUnavailable extends Error {
  readonly scope: BuyerAccessRateLimitScope;

  constructor(
    scope: BuyerAccessRateLimitScope,
    options: ErrorOptions,
  ) {
    super(
      options.cause instanceof Error &&
        options.cause.message.trim()
        ? options.cause.message
        : "RATE_LIMIT_UNAVAILABLE",
      options,
    );

    this.name = "BuyerAccessRateLimitUnavailable";
    this.scope = scope;
  }
}

type ExchangeExecutor = Readonly<{
  execute(rawCredential: unknown): Promise<
    Readonly<{
      sessionToken: string;
    }>
  >;
}>;

type LibraryReader = Readonly<{
  execute(subject: BuyerSubject): Promise<readonly BuyerDigitalResource[]>;
}>;

type DownloadPreparer = Readonly<{
  execute(subject: BuyerSubject, resourceId: unknown): Promise<PreparedProtectedDelivery>;
}>;

async function enforce(
  limiter: BuyerAccessRateLimiter,
  hasher: BuyerAccessRateLimitKeyHasher,
  scope: BuyerAccessRateLimitScope,
  material: string,
  policy: BuyerAccessRateLimitPolicy,
): Promise<void> {
  const bucketHash = hasher.hash(scope, material);

  let decision: BuyerAccessRateLimitDecision;

  try {
    decision = await limiter.consume(
      scope,
      bucketHash,
      policy,
    );
  } catch (error) {
    throw new BuyerAccessRateLimitUnavailable(
      scope,
      {
        cause: error,
      },
    );
  }

  if (!decision.allowed) {
    throw new BuyerAccessRateLimitExceeded(
      decision.retryAfterSeconds,
    );
  }
}

function exchangeCredentialMaterial(rawCredential: unknown): string {
  if (typeof rawCredential === "string") {
    return rawCredential;
  }

  const serialized = JSON.stringify(rawCredential);

  if (typeof serialized === "string" && serialized.length > 0) {
    return serialized;
  }

  return String(rawCredential);
}

export class RateLimitedBuyerAccessExchangeExecutor {
  constructor(
    private readonly inner: ExchangeExecutor,
    private readonly limiter: BuyerAccessRateLimiter,
    private readonly hasher: BuyerAccessRateLimitKeyHasher,
  ) {}

  async execute(
    rawCredential: unknown,
  ): Promise<Readonly<{ sessionToken: string }>> {
    await enforce(
      this.limiter,
      this.hasher,
      "EXCHANGE_GLOBAL",
      "buyer-access-exchange-global-v1",
      BUYER_ACCESS_RATE_LIMIT_POLICIES.EXCHANGE_GLOBAL,
    );

    await enforce(
      this.limiter,
      this.hasher,
      "EXCHANGE_CREDENTIAL",
      exchangeCredentialMaterial(rawCredential),
      BUYER_ACCESS_RATE_LIMIT_POLICIES.EXCHANGE_CREDENTIAL,
    );

    return this.inner.execute(rawCredential);
  }
}

export class RateLimitedBuyerLibraryReader {
  constructor(
    private readonly inner: LibraryReader,
    private readonly limiter: BuyerAccessRateLimiter,
    private readonly hasher: BuyerAccessRateLimitKeyHasher,
  ) {}

  async execute(subject: BuyerSubject): Promise<readonly BuyerDigitalResource[]> {
    await enforce(
      this.limiter,
      this.hasher,
      "LIBRARY_CREDENTIAL",
      subject.credentialId,
      BUYER_ACCESS_RATE_LIMIT_POLICIES.LIBRARY_CREDENTIAL,
    );

    return this.inner.execute(subject);
  }
}

export class RateLimitedProtectedDownloadPreparer {
  constructor(
    private readonly inner: DownloadPreparer,
    private readonly limiter: BuyerAccessRateLimiter,
    private readonly hasher: BuyerAccessRateLimitKeyHasher,
  ) {}

  async execute(
    subject: BuyerSubject,
    resourceId: unknown,
  ): Promise<PreparedProtectedDelivery> {
    await enforce(
      this.limiter,
      this.hasher,
      "DOWNLOAD_CREDENTIAL",
      subject.credentialId,
      BUYER_ACCESS_RATE_LIMIT_POLICIES.DOWNLOAD_CREDENTIAL,
    );

    return this.inner.execute(
      subject,
      resourceId,
    );
  }
}
