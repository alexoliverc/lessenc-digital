import { randomBytes } from "node:crypto";

import { normalizeCorrelationId } from "./correlation";
import { OPERATIONAL_METRIC_DEFINITIONS } from "./contracts";
import { logger } from "./logger";

export { OPERATIONAL_METRIC_DEFINITIONS } from "./contracts";

export const OPERATIONAL_SURFACES = [
  "PUBLIC_SITE",
  "CHECKOUT",
  "PAYMENTS",
  "WEBHOOK",
  "BUYER_ACCESS",
  "ADMIN",
  "HEALTH",
  "OPERATIONS",
  "DATABASE",
  "PRIVATE_STORAGE",
] as const;

export type OperationalSurface = (typeof OPERATIONAL_SURFACES)[number];

export const OPERATIONAL_OPERATIONS = [
  "HTTP_REQUEST",
  "LIVENESS_CHECK",
  "READINESS_CHECK",
  "PAYMENT_CREATE",
  "PAYMENT_STATUS",
  "PAYMENT_RECONCILIATION",
  "WEBHOOK_PROCESS",
  "BUYER_ACCESS_EXCHANGE",
  "BUYER_LIBRARY",
  "PROTECTED_DOWNLOAD",
  "RATE_LIMIT_DECISION",
  "STORAGE_ACCESS",
  "BACKUP_VERIFY",
  "RESTORE_VALIDATE",
  "MAINTENANCE_JOB",
] as const;

export type OperationalOperation = (typeof OPERATIONAL_OPERATIONS)[number];

export const OPERATIONAL_OUTCOMES = [
  "SUCCEEDED",
  "FAILED",
  "DENIED",
  "DEGRADED",
  "UNKNOWN",
] as const;

export type OperationalOutcome = (typeof OPERATIONAL_OUTCOMES)[number];

export type OperationalMetricName = keyof typeof OPERATIONAL_METRIC_DEFINITIONS;

export type OperationalMetricLabels = Readonly<{
  surface: OperationalSurface;
  operation: OperationalOperation;
  outcome: OperationalOutcome;
  method?: "GET" | "POST" | "JOB";
  statusClass?: "2XX" | "4XX" | "5XX" | "NONE";
}>;

export type OperationalMetricSample = Readonly<{
  name: OperationalMetricName;
  kind: "COUNTER" | "HISTOGRAM";
  unit: string;
  value: number;
  labels: OperationalMetricLabels;
  correlationId?: string;
}>;

export type OperationalSpan = Readonly<{
  traceId: string;
  spanId: string;
  correlationId: string;
  surface: OperationalSurface;
  operation: OperationalOperation;
  outcome: OperationalOutcome;
  durationMs: number;
  failureCode?: string;
}>;

export interface OperationalTelemetrySink {
  metric(sample: OperationalMetricSample): void;
  span(span: OperationalSpan): void;
}

const FAILURE_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/u;

function contains<T extends string>(values: readonly T[], candidate: string): candidate is T {
  return (values as readonly string[]).includes(candidate);
}

function normalizeLabels(labels: OperationalMetricLabels): OperationalMetricLabels {
  if (!contains(OPERATIONAL_SURFACES, labels.surface)) {
    throw new Error("INVALID_OPERATIONAL_METRIC_SURFACE");
  }

  if (!contains(OPERATIONAL_OPERATIONS, labels.operation)) {
    throw new Error("INVALID_OPERATIONAL_METRIC_OPERATION");
  }

  if (!contains(OPERATIONAL_OUTCOMES, labels.outcome)) {
    throw new Error("INVALID_OPERATIONAL_METRIC_OUTCOME");
  }

  const safe: {
    surface: OperationalSurface;
    operation: OperationalOperation;
    outcome: OperationalOutcome;
    method?: "GET" | "POST" | "JOB";
    statusClass?: "2XX" | "4XX" | "5XX" | "NONE";
  } = {
    surface: labels.surface,
    operation: labels.operation,
    outcome: labels.outcome,
  };

  if (labels.method !== undefined) {
    if (!["GET", "POST", "JOB"].includes(labels.method)) {
      throw new Error("INVALID_OPERATIONAL_METRIC_METHOD");
    }
    safe.method = labels.method;
  }

  if (labels.statusClass !== undefined) {
    if (!["2XX", "4XX", "5XX", "NONE"].includes(labels.statusClass)) {
      throw new Error("INVALID_OPERATIONAL_METRIC_STATUS_CLASS");
    }
    safe.statusClass = labels.statusClass;
  }

  return Object.freeze(safe);
}

function normalizeCorrelation(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeCorrelationId(value);
  if (normalized === null) {
    throw new Error("INVALID_OPERATIONAL_TELEMETRY_CORRELATION_ID");
  }

  return normalized;
}

export const structuredOperationalTelemetrySink: OperationalTelemetrySink = Object.freeze({
  metric(sample: OperationalMetricSample) {
    logger.info("operational_metric", sample);
  },
  span(span: OperationalSpan) {
    const level = span.outcome === "FAILED" ? "error" : "info";
    logger[level]("operational_span_completed", span);
  },
});

export function recordOperationalMetric(
  input: Readonly<{
    name: OperationalMetricName;
    value: number;
    labels: OperationalMetricLabels;
    correlationId?: string;
  }>,
  sink: OperationalTelemetrySink = structuredOperationalTelemetrySink,
): OperationalMetricSample {
  const definition = OPERATIONAL_METRIC_DEFINITIONS[input.name];
  if (definition === undefined) {
    throw new Error("INVALID_OPERATIONAL_METRIC_NAME");
  }

  if (!Number.isFinite(input.value) || input.value < 0) {
    throw new Error("INVALID_OPERATIONAL_METRIC_VALUE");
  }

  if (definition.kind === "COUNTER" && input.value !== 1) {
    throw new Error("INVALID_OPERATIONAL_COUNTER_INCREMENT");
  }

  const correlationId = normalizeCorrelation(input.correlationId);
  const sample: OperationalMetricSample = Object.freeze({
    name: input.name,
    kind: definition.kind,
    unit: definition.unit,
    value: input.value,
    labels: normalizeLabels(input.labels),
    ...(correlationId === undefined ? {} : { correlationId }),
  });

  sink.metric(sample);
  return sample;
}

export function statusClass(status: number): "2XX" | "4XX" | "5XX" | "NONE" {
  if (status >= 200 && status < 300) return "2XX";
  if (status >= 400 && status < 500) return "4XX";
  if (status >= 500 && status < 600) return "5XX";
  return "NONE";
}

export function startOperationalSpan(
  input: Readonly<{
    correlationId: string;
    surface: OperationalSurface;
    operation: OperationalOperation;
  }>,
  sink: OperationalTelemetrySink = structuredOperationalTelemetrySink,
  clock: () => number = Date.now,
  idFactory: (bytes: number) => string = (bytes) => randomBytes(bytes).toString("hex"),
): Readonly<{
  traceId: string;
  spanId: string;
  end(result: Readonly<{ outcome: OperationalOutcome; failureCode?: string }>): OperationalSpan;
}> {
  const correlationId = normalizeCorrelation(input.correlationId);
  if (correlationId === undefined) {
    throw new Error("INVALID_OPERATIONAL_TELEMETRY_CORRELATION_ID");
  }
  if (!contains(OPERATIONAL_SURFACES, input.surface)) {
    throw new Error("INVALID_OPERATIONAL_SPAN_SURFACE");
  }
  if (!contains(OPERATIONAL_OPERATIONS, input.operation)) {
    throw new Error("INVALID_OPERATIONAL_SPAN_OPERATION");
  }

  const traceId = idFactory(16);
  const spanId = idFactory(8);
  if (!/^[0-9a-f]{32}$/u.test(traceId) || !/^[0-9a-f]{16}$/u.test(spanId)) {
    throw new Error("INVALID_OPERATIONAL_SPAN_ID");
  }

  const startedAt = clock();
  let ended = false;

  return Object.freeze({
    traceId,
    spanId,
    end(result) {
      if (ended) {
        throw new Error("OPERATIONAL_SPAN_ALREADY_ENDED");
      }
      ended = true;

      if (!contains(OPERATIONAL_OUTCOMES, result.outcome)) {
        throw new Error("INVALID_OPERATIONAL_SPAN_OUTCOME");
      }
      if (result.failureCode !== undefined && !FAILURE_CODE_PATTERN.test(result.failureCode)) {
        throw new Error("INVALID_OPERATIONAL_SPAN_FAILURE_CODE");
      }

      const durationMs = Math.max(0, clock() - startedAt);
      if (!Number.isFinite(durationMs)) {
        throw new Error("INVALID_OPERATIONAL_SPAN_DURATION");
      }

      const span: OperationalSpan = Object.freeze({
        traceId,
        spanId,
        correlationId,
        surface: input.surface,
        operation: input.operation,
        outcome: result.outcome,
        durationMs,
        ...(result.failureCode === undefined ? {} : { failureCode: result.failureCode }),
      });

      sink.span(span);
      return span;
    },
  });
}
