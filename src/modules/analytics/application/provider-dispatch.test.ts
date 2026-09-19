import { describe, expect, it, vi } from "vitest";

import type {
  AnalyticsDispatchRecord,
  AnalyticsDispatchRepository,
  AnalyticsEventRecord,
  CreateAnalyticsDispatch,
} from "../../attribution/application/persistence";
import {
  EnqueueProviderDispatches,
  ProcessProviderDispatch,
  ProviderDeliveryError,
  providerConsentGranted,
  providerRetryBackoffMs,
  validateProviderDispatchTarget,
  type AnalyticsProviderAdapter,
  type ProviderDispatchTarget,
} from "./provider-dispatch";

const target: ProviderDispatchTarget = Object.freeze({
  provider: "meta",
  channel: "capi",
  consentRequirement: "ADVERTISING",
  maxAttempts: 3,
  baseBackoffMs: 1_000,
  maxBackoffMs: 10_000,
});

function event(input?: {
  id?: string;
  analytics?: "UNKNOWN" | "GRANTED" | "DENIED";
  advertising?: "UNKNOWN" | "GRANTED" | "DENIED";
}): AnalyticsEventRecord {
  return Object.freeze({
    id: input?.id ?? "11111111-1111-4111-8111-111111111111",
    type: "PURCHASE",
    occurredAt: new Date("2026-09-19T15:00:00.000Z"),
    journeyId: null,
    productId: "22222222-2222-4222-8222-222222222222",
    offerId: "33333333-3333-4333-8333-333333333333",
    orderId: "44444444-4444-4444-8444-444444444444",
    amountMinor: 12990,
    currency: "BRL",
    attributionState: "UNATTRIBUTED",
    consentSnapshot: {
      analytics: input?.analytics ?? "GRANTED",
      advertising: input?.advertising ?? "GRANTED",
      policyVersion: "p13-architecture-freeze-r2",
    },
    schemaVersion: 1,
    purchaseOrderKey: "44444444-4444-4444-8444-444444444444",
    createdAt: new Date("2026-09-19T15:00:00.000Z"),
  });
}

function dispatch(input?: {
  id?: string;
  status?: AnalyticsDispatchRecord["status"];
  attemptCount?: number;
}): AnalyticsDispatchRecord {
  return Object.freeze({
    id: input?.id ?? "55555555-5555-4555-8555-555555555555",
    analyticsEventId: "11111111-1111-4111-8111-111111111111",
    provider: "meta",
    channel: "capi",
    status: input?.status ?? "PENDING",
    attemptCount: input?.attemptCount ?? 0,
    nextAttemptAt: null,
    lastAttemptAt: null,
    providerEventId: null,
    lastErrorCode: null,
    lastErrorClass: null,
    createdAt: new Date("2026-09-19T15:00:00.000Z"),
    completedAt: null,
  });
}

function repository(
  overrides: Partial<AnalyticsDispatchRepository> = {},
): AnalyticsDispatchRepository {
  return {
    create: vi.fn(),
    createIdempotent: vi.fn(),
    findByEventProviderChannel: vi.fn(),
    findUndispatchedEvents: vi.fn(),
    claimDue: vi.fn(),
    recoverStaleProcessing: vi.fn(),
    markSuppressed: vi.fn(),
    markSucceeded: vi.fn(),
    markRetryable: vi.fn(),
    markFailed: vi.fn(),
    ...overrides,
  } as unknown as AnalyticsDispatchRepository;
}

describe("P13-F provider-neutral dispatch", () => {
  it("keeps analytics and advertising consent independent and UNKNOWN denied", () => {
    const analyticsOnly = event({
      analytics: "GRANTED",
      advertising: "DENIED",
    });

    expect(providerConsentGranted(analyticsOnly, "ANALYTICS")).toBe(true);

    expect(providerConsentGranted(analyticsOnly, "ADVERTISING")).toBe(false);

    const unknown = event({
      analytics: "UNKNOWN",
      advertising: "UNKNOWN",
    });

    expect(providerConsentGranted(unknown, "ANALYTICS")).toBe(false);

    expect(providerConsentGranted(unknown, "ADVERTISING")).toBe(false);
  });

  it("validates bounded retry configuration and exponential backoff", () => {
    expect(() => validateProviderDispatchTarget(target)).not.toThrow();

    expect(providerRetryBackoffMs(target, 1)).toBe(1_000);
    expect(providerRetryBackoffMs(target, 2)).toBe(2_000);
    expect(providerRetryBackoffMs(target, 3)).toBe(4_000);
    expect(providerRetryBackoffMs(target, 10)).toBe(10_000);

    expect(() =>
      validateProviderDispatchTarget({
        ...target,
        maxAttempts: 0,
      }),
    ).toThrow("INVALID_ANALYTICS_DISPATCH_MAX_ATTEMPTS");
  });

  it("enqueues GRANTED as PENDING and DENIED as SUPPRESSED", async () => {
    const granted = event();

    const denied = event({
      id: "66666666-6666-4666-8666-666666666666",
      advertising: "DENIED",
    });

    const inputs: CreateAnalyticsDispatch[] = [];

    const repo = repository({
      findUndispatchedEvents: vi.fn().mockResolvedValue([granted, denied]),

      createIdempotent: vi.fn(async (input: CreateAnalyticsDispatch) => {
        inputs.push(input);

        return Object.freeze({
          ...dispatch({
            id: input.id,
            status: input.status,
          }),
          analyticsEventId: input.analyticsEventId,
          provider: input.provider,
          channel: input.channel,
          attemptCount: input.attemptCount,
          nextAttemptAt: input.nextAttemptAt,
          lastAttemptAt: input.lastAttemptAt,
          providerEventId: input.providerEventId,
          lastErrorCode: input.lastErrorCode,
          lastErrorClass: input.lastErrorClass,
          completedAt: input.completedAt,
        });
      }),
    });

    let sequence = 0;

    const enqueue = new EnqueueProviderDispatches(repo, () =>
      sequence++ === 0
        ? "77777777-7777-4777-8777-777777777777"
        : "88888888-8888-4888-8888-888888888888",
    );

    await expect(
      enqueue.execute({
        target,
        observedAt: new Date("2026-09-19T15:01:00.000Z"),
        limit: 10,
      }),
    ).resolves.toEqual({
      scanned: 2,
      pending: 1,
      suppressed: 1,
      existing: 0,
      failed: 0,
    });

    expect(inputs[0]).toMatchObject({
      status: "PENDING",
      lastErrorCode: null,
      completedAt: null,
    });

    expect(inputs[1]).toMatchObject({
      status: "SUPPRESSED",
      lastErrorCode: "CONSENT_NOT_GRANTED",
      lastErrorClass: "CONSENT_POLICY",
      completedAt: new Date("2026-09-19T15:01:00.000Z"),
    });
  });

  it("records provider success for a claimed canonical event", async () => {
    const canonical = event();

    const processing = dispatch({
      status: "PROCESSING",
      attemptCount: 1,
    });

    const succeeded = Object.freeze({
      ...processing,
      status: "SUCCEEDED" as const,
      providerEventId: canonical.id,
      completedAt: new Date("2026-09-19T15:02:00.000Z"),
    });

    const repo = repository({
      claimDue: vi.fn().mockResolvedValue({
        dispatch: processing,
        event: canonical,
      }),
      markSucceeded: vi.fn().mockResolvedValue(succeeded),
    });

    const adapter: AnalyticsProviderAdapter = {
      send: vi.fn().mockResolvedValue({
        providerEventId: canonical.id,
      }),
    };

    const processor = new ProcessProviderDispatch(repo, adapter);

    await expect(
      processor.execute({
        target,
        attemptedAt: new Date("2026-09-19T15:02:00.000Z"),
      }),
    ).resolves.toMatchObject({
      state: "SUCCEEDED",
      dispatch: {
        status: "SUCCEEDED",
      },
    });

    expect(adapter.send).toHaveBeenCalledWith(canonical);
  });

  it("suppresses before provider send when required consent is not granted", async () => {
    const denied = event({
      advertising: "DENIED",
    });

    const processing = dispatch({
      status: "PROCESSING",
      attemptCount: 1,
    });

    const suppressed = Object.freeze({
      ...processing,
      status: "SUPPRESSED" as const,
      lastErrorCode: "CONSENT_NOT_GRANTED",
      lastErrorClass: "CONSENT_POLICY",
      completedAt: new Date("2026-09-19T15:03:00.000Z"),
    });

    const repo = repository({
      claimDue: vi.fn().mockResolvedValue({
        dispatch: processing,
        event: denied,
      }),
      markSuppressed: vi.fn().mockResolvedValue(suppressed),
    });

    const adapter: AnalyticsProviderAdapter = {
      send: vi.fn(),
    };

    const processor = new ProcessProviderDispatch(repo, adapter);

    await expect(
      processor.execute({
        target,
        attemptedAt: new Date("2026-09-19T15:03:00.000Z"),
      }),
    ).resolves.toMatchObject({
      state: "SUPPRESSED",
    });

    expect(adapter.send).not.toHaveBeenCalled();
  });

  it("moves retryable provider failure to RETRYABLE with backoff", async () => {
    const canonical = event();

    const processing = dispatch({
      status: "PROCESSING",
      attemptCount: 1,
    });

    const retryable = Object.freeze({
      ...processing,
      status: "RETRYABLE" as const,
      nextAttemptAt: new Date("2026-09-19T15:04:01.000Z"),
    });

    const repo = repository({
      claimDue: vi.fn().mockResolvedValue({
        dispatch: processing,
        event: canonical,
      }),
      markRetryable: vi.fn().mockResolvedValue(retryable),
    });

    const adapter: AnalyticsProviderAdapter = {
      send: vi.fn().mockRejectedValue(
        new ProviderDeliveryError({
          code: "PROVIDER_UNAVAILABLE",
          errorClass: "TRANSPORT",
          retryable: true,
        }),
      ),
    };

    const processor = new ProcessProviderDispatch(repo, adapter);

    await expect(
      processor.execute({
        target,
        attemptedAt: new Date("2026-09-19T15:04:00.000Z"),
      }),
    ).resolves.toMatchObject({
      state: "RETRYABLE",
    });

    expect(repo.markRetryable).toHaveBeenCalledWith({
      dispatchId: processing.id,
      nextAttemptAt: new Date("2026-09-19T15:04:01.000Z"),
      errorCode: "PROVIDER_UNAVAILABLE",
      errorClass: "TRANSPORT",
    });
  });

  it("moves an exhausted retry budget to FAILED", async () => {
    const canonical = event();

    const processing = dispatch({
      status: "PROCESSING",
      attemptCount: 3,
    });

    const failed = Object.freeze({
      ...processing,
      status: "FAILED" as const,
      completedAt: new Date("2026-09-19T15:05:00.000Z"),
    });

    const repo = repository({
      claimDue: vi.fn().mockResolvedValue({
        dispatch: processing,
        event: canonical,
      }),
      markFailed: vi.fn().mockResolvedValue(failed),
    });

    const adapter: AnalyticsProviderAdapter = {
      send: vi.fn().mockRejectedValue(
        new ProviderDeliveryError({
          code: "PROVIDER_UNAVAILABLE",
          errorClass: "TRANSPORT",
          retryable: true,
        }),
      ),
    };

    const processor = new ProcessProviderDispatch(repo, adapter);

    await expect(
      processor.execute({
        target,
        attemptedAt: new Date("2026-09-19T15:05:00.000Z"),
      }),
    ).resolves.toMatchObject({
      state: "FAILED",
    });

    expect(repo.markRetryable).not.toHaveBeenCalled();
  });

  it("treats invalid provider event identity as permanent failure", async () => {
    const canonical = event();

    const processing = dispatch({
      status: "PROCESSING",
      attemptCount: 1,
    });

    const failed = Object.freeze({
      ...processing,
      status: "FAILED" as const,
      completedAt: new Date("2026-09-19T15:06:00.000Z"),
    });

    const repo = repository({
      claimDue: vi.fn().mockResolvedValue({
        dispatch: processing,
        event: canonical,
      }),
      markFailed: vi.fn().mockResolvedValue(failed),
    });

    const adapter: AnalyticsProviderAdapter = {
      send: vi.fn().mockResolvedValue({
        providerEventId: "   ",
      }),
    };

    const processor = new ProcessProviderDispatch(repo, adapter);

    await expect(
      processor.execute({
        target,
        attemptedAt: new Date("2026-09-19T15:06:00.000Z"),
      }),
    ).resolves.toMatchObject({
      state: "FAILED",
    });

    expect(repo.markFailed).toHaveBeenCalledWith({
      dispatchId: processing.id,
      errorCode: "INVALID_PROVIDER_EVENT_ID",
      errorClass: "PROVIDER_CONTRACT",
      completedAt: new Date("2026-09-19T15:06:00.000Z"),
    });
  });

  it("returns IDLE without contacting provider when no dispatch is due", async () => {
    const repo = repository({
      claimDue: vi.fn().mockResolvedValue(null),
    });

    const adapter: AnalyticsProviderAdapter = {
      send: vi.fn(),
    };

    const processor = new ProcessProviderDispatch(repo, adapter);

    await expect(
      processor.execute({
        target,
        attemptedAt: new Date("2026-09-19T15:07:00.000Z"),
      }),
    ).resolves.toEqual({
      state: "IDLE",
    });

    expect(adapter.send).not.toHaveBeenCalled();
  });
  it("fails closed when a provider policy gate throws before send", async () => {
    const canonical = event();

    const processing = dispatch({
      status: "PROCESSING",
      attemptCount: 1,
    });

    const attemptedAt = new Date("2026-09-19T15:08:00.000Z");

    const failed = Object.freeze({
      ...processing,
      status: "FAILED" as const,
      lastErrorCode: "PROVIDER_POLICY_ERROR",
      lastErrorClass: "PROVIDER_POLICY",
      completedAt: attemptedAt,
    });

    const repo = repository({
      claimDue: vi.fn().mockResolvedValue({
        dispatch: processing,
        event: canonical,
      }),

      markFailed: vi.fn().mockResolvedValue(failed),
    });

    const adapter: AnalyticsProviderAdapter = {
      send: vi.fn(),
    };

    const policyGate = {
      evaluate: vi.fn(() => {
        throw new Error("POLICY_EVALUATION_FAILED");
      }),
    };

    const processor = new ProcessProviderDispatch(repo, adapter, policyGate);

    await expect(
      processor.execute({
        target,
        attemptedAt,
      }),
    ).resolves.toMatchObject({
      state: "FAILED",
      dispatch: {
        status: "FAILED",
        lastErrorCode: "PROVIDER_POLICY_ERROR",
        lastErrorClass: "PROVIDER_POLICY",
      },
    });

    expect(adapter.send).not.toHaveBeenCalled();

    expect(repo.markRetryable).not.toHaveBeenCalled();

    expect(repo.markFailed).toHaveBeenCalledWith({
      dispatchId: processing.id,

      errorCode: "PROVIDER_POLICY_ERROR",

      errorClass: "PROVIDER_POLICY",

      completedAt: attemptedAt,
    });
  });
});
