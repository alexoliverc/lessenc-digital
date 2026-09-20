import { describe, expect, it } from "vitest";

import {
  recordOperationalMetric,
  startOperationalSpan,
  type OperationalMetricSample,
  type OperationalSpan,
  type OperationalTelemetrySink,
} from "./telemetry";

const correlationId = "11111111-1111-4111-8111-111111111111";

function collector() {
  const metrics: OperationalMetricSample[] = [];
  const spans: OperationalSpan[] = [];
  const sink: OperationalTelemetrySink = {
    metric: (sample) => metrics.push(sample),
    span: (span) => spans.push(span),
  };
  return { metrics, spans, sink };
}

describe("P15 provider-neutral operational telemetry", () => {
  it("emits a low-cardinality allowlisted metric sample", () => {
    const target = collector();

    const sample = recordOperationalMetric(
      {
        name: "http_requests_total",
        value: 1,
        labels: {
          surface: "HEALTH",
          operation: "LIVENESS_CHECK",
          outcome: "SUCCEEDED",
          method: "GET",
          statusClass: "2XX",
          customerId: "private-customer",
        } as never,
        correlationId,
      },
      target.sink,
    );

    expect(sample.labels).toEqual({
      surface: "HEALTH",
      operation: "LIVENESS_CHECK",
      outcome: "SUCCEEDED",
      method: "GET",
      statusClass: "2XX",
    });
    expect(JSON.stringify(sample)).not.toContain("private-customer");
    expect(target.metrics).toEqual([sample]);
  });

  it("rejects arbitrary metric names, labels and invalid counter values", () => {
    expect(() =>
      recordOperationalMetric(
        {
          name: "customer_revenue_by_email" as never,
          value: 1,
          labels: {
            surface: "HEALTH",
            operation: "LIVENESS_CHECK",
            outcome: "SUCCEEDED",
          },
        },
        collector().sink,
      ),
    ).toThrow("INVALID_OPERATIONAL_METRIC_NAME");

    expect(() =>
      recordOperationalMetric(
        {
          name: "http_requests_total",
          value: 2,
          labels: {
            surface: "HEALTH",
            operation: "LIVENESS_CHECK",
            outcome: "SUCCEEDED",
          },
        },
        collector().sink,
      ),
    ).toThrow("INVALID_OPERATIONAL_COUNTER_INCREMENT");
  });

  it("records a local span without adopting unvalidated distributed trace context", () => {
    const target = collector();
    const times = [100, 145];
    const ids = ["a".repeat(32), "b".repeat(16)];

    const span = startOperationalSpan(
      {
        correlationId,
        surface: "PAYMENTS",
        operation: "PAYMENT_RECONCILIATION",
      },
      target.sink,
      () => times.shift() ?? 145,
      () => ids.shift() ?? "",
    );

    const completed = span.end({ outcome: "FAILED", failureCode: "PROVIDER_UNAVAILABLE" });

    expect(completed).toMatchObject({
      traceId: "a".repeat(32),
      spanId: "b".repeat(16),
      correlationId,
      durationMs: 45,
      outcome: "FAILED",
      failureCode: "PROVIDER_UNAVAILABLE",
    });
    expect(target.spans).toEqual([completed]);
    expect(() => span.end({ outcome: "SUCCEEDED" })).toThrow("OPERATIONAL_SPAN_ALREADY_ENDED");
  });

  it("rejects free-form failure detail from trace payloads", () => {
    const span = startOperationalSpan(
      {
        correlationId,
        surface: "PRIVATE_STORAGE",
        operation: "STORAGE_ACCESS",
      },
      collector().sink,
      () => 0,
      (bytes) => (bytes === 16 ? "a".repeat(32) : "b".repeat(16)),
    );

    expect(() => span.end({ outcome: "FAILED", failureCode: "path C:\\private\\secret" })).toThrow(
      "INVALID_OPERATIONAL_SPAN_FAILURE_CODE",
    );
  });
});
