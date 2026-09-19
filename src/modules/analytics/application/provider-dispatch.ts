import type {
  AnalyticsDispatchRecord,
  AnalyticsDispatchRepository,
  AnalyticsEventRecord,
} from "../../attribution/application/persistence";

export type ProviderConsentRequirement = "ANALYTICS" | "ADVERTISING";

export type ProviderDispatchTarget = Readonly<{
  provider: string;
  channel: string;
  consentRequirement: ProviderConsentRequirement;
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
}>;

export type ProviderDeliveryResult = Readonly<{
  providerEventId: string;
}>;

export interface AnalyticsProviderAdapter {
  send(event: AnalyticsEventRecord): Promise<ProviderDeliveryResult>;
}

export type ProviderSuppressionDecision = Readonly<{
  errorCode: string;
  errorClass: string;
}>;

export interface ProviderDispatchPolicyGate {
  evaluate(
    event: AnalyticsEventRecord,
  ): ProviderSuppressionDecision | null | Promise<ProviderSuppressionDecision | null>;
}

export class ProviderDeliveryError extends Error {
  readonly code: string;
  readonly errorClass: string;
  readonly retryable: boolean;

  constructor(input: { code: string; errorClass: string; retryable: boolean }) {
    super(input.code);

    this.name = "ProviderDeliveryError";
    this.code = input.code;
    this.errorClass = input.errorClass;
    this.retryable = input.retryable;
  }
}

export type AnalyticsDispatchIdFactory = () => string;

export type ProviderDispatchEnqueueReport = Readonly<{
  scanned: number;
  pending: number;
  suppressed: number;
  existing: number;
  failed: number;
}>;

export type ProviderDispatchProcessingResult =
  | Readonly<{
      state: "IDLE";
    }>
  | Readonly<{
      state: "SUCCEEDED";
      dispatch: AnalyticsDispatchRecord;
    }>
  | Readonly<{
      state: "RETRYABLE";
      dispatch: AnalyticsDispatchRecord;
    }>
  | Readonly<{
      state: "FAILED";
      dispatch: AnalyticsDispatchRecord;
    }>
  | Readonly<{
      state: "SUPPRESSED";
      dispatch: AnalyticsDispatchRecord;
    }>;

function requireBoundedIdentifier(value: string, field: string): void {
  const normalized = value.trim();

  if (normalized.length < 1 || normalized.length > 32) {
    throw new Error(`INVALID_ANALYTICS_DISPATCH_${field}`);
  }
}

function requireDate(value: Date, field: string): void {
  if (Number.isNaN(value.getTime())) {
    throw new Error(`INVALID_ANALYTICS_DISPATCH_${field}`);
  }
}

export function validateProviderDispatchTarget(target: ProviderDispatchTarget): void {
  requireBoundedIdentifier(target.provider, "PROVIDER");

  requireBoundedIdentifier(target.channel, "CHANNEL");

  if (
    !Number.isSafeInteger(target.maxAttempts) ||
    target.maxAttempts < 1 ||
    target.maxAttempts > 10
  ) {
    throw new Error("INVALID_ANALYTICS_DISPATCH_MAX_ATTEMPTS");
  }

  if (
    !Number.isSafeInteger(target.baseBackoffMs) ||
    target.baseBackoffMs < 1_000 ||
    target.baseBackoffMs > 60 * 60 * 1_000
  ) {
    throw new Error("INVALID_ANALYTICS_DISPATCH_BASE_BACKOFF");
  }

  if (
    !Number.isSafeInteger(target.maxBackoffMs) ||
    target.maxBackoffMs < target.baseBackoffMs ||
    target.maxBackoffMs > 24 * 60 * 60 * 1_000
  ) {
    throw new Error("INVALID_ANALYTICS_DISPATCH_MAX_BACKOFF");
  }
}

export function providerConsentGranted(
  event: AnalyticsEventRecord,
  requirement: ProviderConsentRequirement,
): boolean {
  const field = requirement === "ANALYTICS" ? "analytics" : "advertising";

  return event.consentSnapshot[field] === "GRANTED";
}

export function providerRetryBackoffMs(
  target: ProviderDispatchTarget,
  attemptCount: number,
): number {
  validateProviderDispatchTarget(target);

  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1) {
    throw new Error("INVALID_ANALYTICS_DISPATCH_ATTEMPT_COUNT");
  }

  const multiplier = 2 ** Math.min(attemptCount - 1, 30);

  return Math.min(target.baseBackoffMs * multiplier, target.maxBackoffMs);
}

function normalizedDeliveryFailure(error: unknown): ProviderDeliveryError {
  if (error instanceof ProviderDeliveryError) {
    return error;
  }

  return new ProviderDeliveryError({
    code: "PROVIDER_DELIVERY_ERROR",
    errorClass: "UNEXPECTED",
    retryable: true,
  });
}

export class EnqueueProviderDispatches {
  constructor(
    private readonly repository: AnalyticsDispatchRepository,
    private readonly createId: AnalyticsDispatchIdFactory,
  ) {}

  async execute(input: {
    target: ProviderDispatchTarget;
    observedAt: Date;
    limit?: number;
  }): Promise<ProviderDispatchEnqueueReport> {
    validateProviderDispatchTarget(input.target);
    requireDate(input.observedAt, "OBSERVED_AT");

    const limit = input.limit ?? 100;

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("INVALID_ANALYTICS_DISPATCH_ENQUEUE_LIMIT");
    }

    const events = await this.repository.findUndispatchedEvents({
      provider: input.target.provider,
      channel: input.target.channel,
      limit,
    });

    let pending = 0;
    let suppressed = 0;
    let existing = 0;
    let failed = 0;

    for (const event of events) {
      const id = this.createId();

      const eligible = providerConsentGranted(event, input.target.consentRequirement);

      try {
        const dispatch = await this.repository.createIdempotent({
          id,
          analyticsEventId: event.id,
          provider: input.target.provider,
          channel: input.target.channel,
          status: eligible ? "PENDING" : "SUPPRESSED",
          attemptCount: 0,
          nextAttemptAt: null,
          lastAttemptAt: null,
          providerEventId: null,
          lastErrorCode: eligible ? null : "CONSENT_NOT_GRANTED",
          lastErrorClass: eligible ? null : "CONSENT_POLICY",
          completedAt: eligible ? null : new Date(input.observedAt.getTime()),
        });

        if (dispatch.id !== id) {
          existing += 1;
        } else if (dispatch.status === "SUPPRESSED") {
          suppressed += 1;
        } else {
          pending += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return Object.freeze({
      scanned: events.length,
      pending,
      suppressed,
      existing,
      failed,
    });
  }
}

export class ProcessProviderDispatch {
  constructor(
    private readonly repository: AnalyticsDispatchRepository,
    private readonly adapter: AnalyticsProviderAdapter,
    private readonly policyGate?: ProviderDispatchPolicyGate,
  ) {}

  async execute(input: {
    target: ProviderDispatchTarget;
    attemptedAt: Date;
  }): Promise<ProviderDispatchProcessingResult> {
    validateProviderDispatchTarget(input.target);
    requireDate(input.attemptedAt, "ATTEMPTED_AT");

    const claimed = await this.repository.claimDue({
      provider: input.target.provider,
      channel: input.target.channel,
      attemptedAt: input.attemptedAt,
    });

    if (claimed === null) {
      return Object.freeze({
        state: "IDLE",
      });
    }

    if (!providerConsentGranted(claimed.event, input.target.consentRequirement)) {
      const dispatch = await this.repository.markSuppressed({
        dispatchId: claimed.dispatch.id,
        completedAt: input.attemptedAt,
      });

      return Object.freeze({
        state: "SUPPRESSED",
        dispatch,
      });
    }

    if (this.policyGate) {
      try {
        const suppression = await this.policyGate.evaluate(claimed.event);

        if (suppression !== null) {
          const errorCode = suppression.errorCode.trim();

          const errorClass = suppression.errorClass.trim();

          if (
            errorCode.length < 1 ||
            errorCode.length > 128 ||
            errorClass.length < 1 ||
            errorClass.length > 64
          ) {
            throw new Error("INVALID_PROVIDER_SUPPRESSION_DECISION");
          }

          const dispatch = await this.repository.markSuppressed({
            dispatchId: claimed.dispatch.id,

            completedAt: input.attemptedAt,

            errorCode,

            errorClass,
          });

          return Object.freeze({
            state: "SUPPRESSED" as const,

            dispatch,
          });
        }
      } catch {
        const dispatch = await this.repository.markFailed({
          dispatchId: claimed.dispatch.id,

          errorCode: "PROVIDER_POLICY_ERROR",

          errorClass: "PROVIDER_POLICY",

          completedAt: input.attemptedAt,
        });

        return Object.freeze({
          state: "FAILED" as const,

          dispatch,
        });
      }
    }

    try {
      const delivered = await this.adapter.send(claimed.event);

      const providerEventId = delivered.providerEventId.trim();

      if (providerEventId.length < 1 || providerEventId.length > 128) {
        throw new ProviderDeliveryError({
          code: "INVALID_PROVIDER_EVENT_ID",
          errorClass: "PROVIDER_CONTRACT",
          retryable: false,
        });
      }

      const dispatch = await this.repository.markSucceeded({
        dispatchId: claimed.dispatch.id,
        providerEventId,
        completedAt: input.attemptedAt,
      });

      return Object.freeze({
        state: "SUCCEEDED",
        dispatch,
      });
    } catch (error) {
      const failure = normalizedDeliveryFailure(error);

      if (failure.retryable && claimed.dispatch.attemptCount < input.target.maxAttempts) {
        const nextAttemptAt = new Date(
          input.attemptedAt.getTime() +
            providerRetryBackoffMs(input.target, claimed.dispatch.attemptCount),
        );

        const dispatch = await this.repository.markRetryable({
          dispatchId: claimed.dispatch.id,
          nextAttemptAt,
          errorCode: failure.code,
          errorClass: failure.errorClass,
        });

        return Object.freeze({
          state: "RETRYABLE",
          dispatch,
        });
      }

      const dispatch = await this.repository.markFailed({
        dispatchId: claimed.dispatch.id,
        errorCode: failure.code,
        errorClass: failure.errorClass,
        completedAt: input.attemptedAt,
      });

      return Object.freeze({
        state: "FAILED",
        dispatch,
      });
    }
  }
}
