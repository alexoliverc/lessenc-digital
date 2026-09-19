import { describe, expect, it, vi } from "vitest";

import type {
  AnalyticsDispatchRecord,
  AnalyticsDispatchRepository,
  AnalyticsEventRecord,
} from "../../attribution/application/persistence";

import {
  META_CAPI_DISPATCH_TARGET,
  MetaCapiDispatchPolicyGate,
} from "./meta-conversions-api-dispatch";

import { ProcessProviderDispatch, type AnalyticsProviderAdapter } from "./provider-dispatch";

const EVENT_ID = "22222222-2222-4222-8222-222222222222";

const DISPATCH_ID = "55555555-5555-4555-8555-555555555555";

function purchase(
  input?: Readonly<{
    analytics?: "UNKNOWN" | "GRANTED" | "DENIED";

    advertising?: "UNKNOWN" | "GRANTED" | "DENIED";
  }>,
): AnalyticsEventRecord {
  return Object.freeze({
    id: EVENT_ID,

    type: "PURCHASE",

    occurredAt: new Date("2026-09-19T19:00:00.000Z"),

    journeyId: null,

    productId: "33333333-3333-4333-8333-333333333333",

    offerId: "44444444-4444-4444-8444-444444444444",

    orderId: "11111111-1111-4111-8111-111111111111",

    amountMinor: 13_990,

    currency: "BRL",

    attributionState: "ATTRIBUTED",

    consentSnapshot: {
      analytics: input?.analytics ?? "GRANTED",

      advertising: input?.advertising ?? "GRANTED",

      policyVersion: "p13-architecture-freeze-r2",
    },

    schemaVersion: 1,

    purchaseOrderKey: "11111111-1111-4111-8111-111111111111",

    createdAt: new Date("2026-09-19T19:00:01.000Z"),
  });
}

function processingDispatch(): AnalyticsDispatchRecord {
  return Object.freeze({
    id: DISPATCH_ID,

    analyticsEventId: EVENT_ID,

    provider: "meta",

    channel: "capi",

    status: "PROCESSING",

    attemptCount: 1,

    nextAttemptAt: null,

    lastAttemptAt: new Date("2026-09-19T19:01:00.000Z"),

    providerEventId: null,

    lastErrorCode: null,

    lastErrorClass: null,

    createdAt: new Date("2026-09-19T19:00:30.000Z"),

    completedAt: null,
  });
}

function repository(overrides: Partial<AnalyticsDispatchRepository>): AnalyticsDispatchRepository {
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

describe("P13-F5 Meta CAPI F6 dispatch policy", () => {
  it("uses the existing F6 meta/capi advertising dispatch target", () => {
    expect(META_CAPI_DISPATCH_TARGET).toEqual({
      provider: "meta",

      channel: "capi",

      consentRequirement: "ADVERTISING",

      maxAttempts: 3,

      baseBackoffMs: 1_000,

      maxBackoffMs: 10_000,
    });
  });

  it("maps the canonical CAPI transmission block to a privacy-policy suppression", () => {
    const loadConfiguration = vi.fn(() => ({
      state: "CONFIGURED" as const,

      pixelId: "1234567890",

      accessTokenPresent: true as const,
    }));

    const gate = new MetaCapiDispatchPolicyGate(loadConfiguration);

    expect(gate.evaluate(purchase())).toEqual({
      errorCode: "MATCHING_DATA_POLICY_NOT_AUTHORIZED",

      errorClass: "PRIVACY_POLICY",
    });

    expect(loadConfiguration).not.toHaveBeenCalled();
  });

  it("suppresses a claimed canonical Purchase before adapter send and without retry", async () => {
    const canonical = purchase();

    const processing = processingDispatch();

    const completedAt = new Date("2026-09-19T19:02:00.000Z");

    const suppressed = Object.freeze({
      ...processing,

      status: "SUPPRESSED" as const,

      nextAttemptAt: null,

      lastErrorCode: "MATCHING_DATA_POLICY_NOT_AUTHORIZED",

      lastErrorClass: "PRIVACY_POLICY",

      completedAt,
    });

    const repo = repository({
      claimDue: vi.fn().mockResolvedValue({
        dispatch: processing,

        event: canonical,
      }),

      markSuppressed: vi.fn().mockResolvedValue(suppressed),
    });

    const adapter: AnalyticsProviderAdapter = {
      send: vi.fn(),
    };

    const loadConfiguration = vi.fn(() => ({
      state: "CONFIGURED" as const,

      pixelId: "1234567890",

      accessTokenPresent: true as const,
    }));

    const processor = new ProcessProviderDispatch(
      repo,
      adapter,
      new MetaCapiDispatchPolicyGate(loadConfiguration),
    );

    await expect(
      processor.execute({
        target: META_CAPI_DISPATCH_TARGET,

        attemptedAt: completedAt,
      }),
    ).resolves.toMatchObject({
      state: "SUPPRESSED",

      dispatch: {
        status: "SUPPRESSED",

        nextAttemptAt: null,

        lastErrorCode: "MATCHING_DATA_POLICY_NOT_AUTHORIZED",

        lastErrorClass: "PRIVACY_POLICY",
      },
    });

    expect(repo.markSuppressed).toHaveBeenCalledWith({
      dispatchId: DISPATCH_ID,

      completedAt,

      errorCode: "MATCHING_DATA_POLICY_NOT_AUTHORIZED",

      errorClass: "PRIVACY_POLICY",
    });

    expect(adapter.send).not.toHaveBeenCalled();

    expect(repo.markRetryable).not.toHaveBeenCalled();

    expect(repo.markSucceeded).not.toHaveBeenCalled();

    expect(loadConfiguration).not.toHaveBeenCalled();
  });

  it("preserves canonical Meta eligibility suppression without reading credentials", () => {
    const loadConfiguration = vi.fn(() => ({
      state: "CONFIGURED" as const,

      pixelId: "1234567890",

      accessTokenPresent: true as const,
    }));

    const gate = new MetaCapiDispatchPolicyGate(loadConfiguration);

    expect(
      gate.evaluate(
        purchase({
          analytics: "DENIED",

          advertising: "GRANTED",
        }),
      ),
    ).toEqual({
      errorCode: "CANONICAL_META_NOT_ELIGIBLE",

      errorClass: "CONSENT_POLICY",
    });

    expect(loadConfiguration).not.toHaveBeenCalled();
  });

  it("suppresses unsupported non-Purchase analytics events before any CAPI transport", () => {
    const loadConfiguration = vi.fn();

    const gate = new MetaCapiDispatchPolicyGate(loadConfiguration);

    expect(
      gate.evaluate({
        ...purchase(),

        type: "VIEW_CONTENT",

        purchaseOrderKey: null,
      }),
    ).toEqual({
      errorCode: "META_CAPI_EVENT_UNSUPPORTED",

      errorClass: "PROVIDER_POLICY",
    });

    expect(loadConfiguration).not.toHaveBeenCalled();
  });
});
