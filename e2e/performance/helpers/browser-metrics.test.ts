import { describe, expect, it } from "vitest";

import {
  evaluateDeliveryTiming,
  evaluateInpEntries,
  evaluateLcpCandidate,
  evaluateMatchedDeliveryTiming,
  evaluateUniqueDeliveryResourceTiming,
  evaluatePaymentInitiationTiming,
  evaluateCorrelatedPaymentInitiationTiming,
} from "./browser-metrics";

describe("P17 browser metric validation", () => {
  it("keeps absent LCP and INP evidence inconclusive", () => {
    expect(evaluateLcpCandidate({ supported: true, candidateMs: null, finalized: true })).toEqual({
      state: "INCONCLUSIVE",
      reason: "ENTRY_MISSING",
    });
    expect(evaluateLcpCandidate({ supported: true, candidateMs: 100 })).toEqual({
      state: "INCONCLUSIVE",
      reason: "OBSERVATION_NOT_FINALIZED",
    });
    expect(evaluateInpEntries({ supported: true, markerEventCount: 0, interactions: [] })).toEqual({
      state: "INCONCLUSIVE",
      reason: "INTERACTION_MARKER_MISSING",
    });
    expect(evaluateInpEntries({ supported: true, markerEventCount: 1, interactions: [] })).toEqual({
      state: "INCONCLUSIVE",
      reason: "BELOW_REPORTING_THRESHOLD_OR_ENTRY_MISSING",
    });
  });

  it("ignores legitimate zero IDs when the same gesture has a positive interaction ID", () => {
    expect(
      evaluateInpEntries({
        supported: true,
        markerEventCount: 2,
        interactions: [
          { marker: "checkout-create-order", interactionId: 0, durationMs: 16, startTimeMs: 100 },
          { marker: "checkout-create-order", interactionId: 7, durationMs: 32, startTimeMs: 101 },
        ],
      }),
    ).toEqual({ state: "VALID", valueMs: 32 });

    expect(
      evaluateInpEntries({
        supported: true,
        markerEventCount: 1,
        interactions: [
          { marker: "checkout-create-order", interactionId: 0, durationMs: 16, startTimeMs: 100 },
        ],
      }),
    ).toEqual({ state: "INCONCLUSIVE", reason: "INTERACTION_ID_MISSING" });
  });

  it("requires a coherent browser-clock interaction to requestStart interval", () => {
    expect(
      evaluatePaymentInitiationTiming({
        activation: {
          marker: "payment-start-pix",
          name: "click",
          startTimeMs: 100,
          isTrusted: true,
        },
        resource: {
          pathname: "/checkout/payment/start",
          initiatorType: "fetch",
          requestStartMs: 90,
          responseStartMs: 120,
          redirectStartMs: 0,
          redirectEndMs: 0,
          responseStatus: 200,
        },
      }),
    ).toEqual({ state: "INCONCLUSIVE", reason: "TIMING_INCONSISTENT" });
  });

  it("accepts only protected HTTP success and computes TTFB without download duration", () => {
    expect(
      evaluateDeliveryTiming({
        requestStartMs: 100,
        responseStartMs: 180,
        redirectStartMs: 0,
        redirectEndMs: 0,
        responseStatus: 200,
      }),
    ).toEqual({ state: "VALID", valueMs: 80, status: 200 });
  });

  it("rejects a fast authorization error as a delivery measurement", () => {
    expect(
      evaluateDeliveryTiming({
        requestStartMs: 100,
        responseStartMs: 101,
        redirectStartMs: 0,
        redirectEndMs: 0,
        responseStatus: 401,
      }),
    ).toEqual({ state: "INCONCLUSIVE", reason: "HTTP_STATUS_INVALID" });
  });

  it("rejects redirects and impossible timing order", () => {
    expect(
      evaluateDeliveryTiming({
        requestStartMs: 100,
        responseStartMs: 120,
        redirectStartMs: 10,
        redirectEndMs: 20,
        responseStatus: 200,
      }),
    ).toEqual({ state: "INCONCLUSIVE", reason: "REDIRECT_OBSERVED" });

    expect(
      evaluateDeliveryTiming({
        requestStartMs: 200,
        responseStartMs: 150,
        redirectStartMs: 0,
        redirectEndMs: 0,
        responseStatus: 200,
      }),
    ).toEqual({ state: "INCONCLUSIVE", reason: "TIMING_INCONSISTENT" });
  });

  it("requires one proven synthetic POST and one local resource", () => {
    const activation = {
      marker: "payment-start-pix",
      name: "click",
      startTimeMs: 100,
      isTrusted: true,
    };
    const interaction = {
      marker: "payment-start-pix",
      interactionId: 7,
      durationMs: 32,
      startTimeMs: 100,
    };
    const resource = {
      pathname: "/checkout/payment/start",
      origin: "http://127.0.0.1:3100",
      queryPresent: false,
      initiatorType: "fetch",
      requestStartMs: 125,
      responseStartMs: 140,
      redirectStartMs: 0,
      redirectEndMs: 0,
      responseStatus: 200,
    };
    const valid = {
      activations: [activation],
      interactions: [interaction],
      resources: [resource],
      expectedFlow: "PIX" as const,
      capture: {
        expectedFlow: "PIX" as const,
        matchedPostCount: 1,
        methodMismatchCount: 0,
        rejectedAttemptCount: 0,
      },
    };

    expect(evaluateCorrelatedPaymentInitiationTiming(valid)).toEqual({
      state: "VALID",
      valueMs: 25,
    });

    expect(
      evaluateCorrelatedPaymentInitiationTiming({
        ...valid,
        interactions: [{ ...interaction, interactionId: 0 }, interaction],
      }),
    ).toEqual({ state: "VALID", valueMs: 25 });

    expect(
      evaluateCorrelatedPaymentInitiationTiming({
        ...valid,
        capture: undefined,
      }),
    ).toEqual({
      state: "INCONCLUSIVE",
      reason: "REQUEST_CORRELATION_INVALID",
    });

    expect(
      evaluateCorrelatedPaymentInitiationTiming({
        ...valid,
        resources: [resource, resource],
      }),
    ).toEqual({
      state: "INCONCLUSIVE",
      reason: "REQUEST_CORRELATION_INVALID",
    });

    expect(
      evaluateCorrelatedPaymentInitiationTiming({
        ...valid,
        resources: [{ ...resource, origin: "http://127.0.0.2:3100" }],
      }),
    ).toEqual({
      state: "INCONCLUSIVE",
      reason: "REQUEST_CORRELATION_INVALID",
    });

    expect(
      evaluateCorrelatedPaymentInitiationTiming({
        ...valid,
        activations: [activation, { ...activation, startTimeMs: 101 }],
      }),
    ).toEqual({
      state: "INCONCLUSIVE",
      reason: "REQUEST_CORRELATION_INVALID",
    });

    expect(
      evaluateCorrelatedPaymentInitiationTiming({
        ...valid,
        activations: [{ ...activation, isTrusted: false }],
      }),
    ).toEqual({
      state: "INCONCLUSIVE",
      reason: "REQUEST_CORRELATION_INVALID",
    });

    expect(
      evaluateCorrelatedPaymentInitiationTiming({
        ...valid,
        capture: {
          expectedFlow: "PIX",
          matchedPostCount: 2,
          methodMismatchCount: 0,
          rejectedAttemptCount: 1,
        },
      }),
    ).toEqual({
      state: "INCONCLUSIVE",
      reason: "REQUEST_CORRELATION_INVALID",
    });

    expect(
      evaluateCorrelatedPaymentInitiationTiming({
        ...valid,
        expectedFlow: "CREDIT_CARD",
      }),
    ).toEqual({
      state: "INCONCLUSIVE",
      reason: "REQUEST_CORRELATION_INVALID",
    });

    expect(
      evaluateCorrelatedPaymentInitiationTiming({
        ...valid,
        capture: {
          expectedFlow: "PIX",
          matchedPostCount: 0,
          methodMismatchCount: 1,
          rejectedAttemptCount: 0,
        },
      }),
    ).toEqual({
      state: "INCONCLUSIVE",
      reason: "REQUEST_CORRELATION_INVALID",
    });
  });
  it("accepts one local protected delivery resource", () => {
    const pathname = "/api/buyer-access/resources/17000000-0000-4000-8000-000000000103";

    const timing = {
      pathname,
      origin: "http://127.0.0.1:3100",
      queryPresent: false,
      initiatorType: "fetch",
      requestStartMs: 100,
      responseStartMs: 180,
      redirectStartMs: 0,
      redirectEndMs: 0,
      responseStatus: 200,
    };

    expect(evaluateUniqueDeliveryResourceTiming([timing], pathname, 200)).toEqual({
      state: "VALID",
      valueMs: 80,
      status: 200,
    });

    expect(evaluateUniqueDeliveryResourceTiming([], pathname, 200)).toEqual({
      state: "INCONCLUSIVE",
      reason: "RESOURCE_TIMING_MISSING",
    });

    expect(evaluateUniqueDeliveryResourceTiming([timing, timing], pathname, 200)).toEqual({
      state: "INCONCLUSIVE",
      reason: "TIMING_INCONSISTENT",
    });

    expect(
      evaluateUniqueDeliveryResourceTiming(
        [{ ...timing, origin: "http://127.0.0.2:3100" }],
        pathname,
        200,
      ),
    ).toEqual({
      state: "INCONCLUSIVE",
      reason: "RESOURCE_TIMING_MISSING",
    });

    expect(
      evaluateUniqueDeliveryResourceTiming([{ ...timing, queryPresent: true }], pathname, 200),
    ).toEqual({
      state: "INCONCLUSIVE",
      reason: "RESOURCE_TIMING_MISSING",
    });

    expect(evaluateUniqueDeliveryResourceTiming([timing], pathname, 401)).toEqual({
      state: "INCONCLUSIVE",
      reason: "HTTP_STATUS_MISMATCH",
    });
  });
  it("keeps Resource Timing status mismatch fail-closed", () => {
    expect(
      evaluateMatchedDeliveryTiming(
        {
          pathname: "/api/buyer-access/resources/17000000-0000-4000-8000-000000000103",
          initiatorType: "fetch",
          requestStartMs: 100,
          responseStartMs: 180,
          redirectStartMs: 0,
          redirectEndMs: 0,
          responseStatus: 401,
        },
        200,
      ),
    ).toEqual({ state: "INCONCLUSIVE", reason: "HTTP_STATUS_MISMATCH" });
  });
});
