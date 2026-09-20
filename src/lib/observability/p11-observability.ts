import { logger, type LogContext } from "./logger";
import { createCorrelationId } from "./correlation";
import { P11_OBSERVABILITY_EVENTS, P11_OBSERVABILITY_SURFACES } from "./contracts";
import {
  recordOperationalMetric,
  type OperationalMetricName,
  type OperationalOperation,
  type OperationalSurface,
} from "./telemetry";

export { P11_OBSERVABILITY_EVENTS, P11_OBSERVABILITY_SURFACES } from "./contracts";

export type P11ObservabilitySurface = (typeof P11_OBSERVABILITY_SURFACES)[number];

export const P11_OBSERVABILITY_SCOPES = [
  "EXCHANGE_GLOBAL",
  "EXCHANGE_CREDENTIAL",
  "LIBRARY_CREDENTIAL",
  "DOWNLOAD_CREDENTIAL",
] as const;

export type P11ObservabilityScope = (typeof P11_OBSERVABILITY_SCOPES)[number];

export const P11_OBSERVABILITY_OUTCOMES = ["SUCCEEDED", "FAILED", "DENIED", "DEGRADED"] as const;

export type P11ObservabilityOutcome = (typeof P11_OBSERVABILITY_OUTCOMES)[number];

export type P11ObservabilityEvent = (typeof P11_OBSERVABILITY_EVENTS)[number];

export type P11ObservabilityContext = Readonly<{
  correlationId: string;
  surface: P11ObservabilitySurface;
  scope?: P11ObservabilityScope;
  outcome?: P11ObservabilityOutcome;
  failureCode?: string;
  retryAfterSeconds?: number;
  windowSeconds?: number;
  limit?: number;
}>;

const CORRELATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const FAILURE_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/u;

function contains<T extends string>(values: readonly T[], candidate: string): candidate is T {
  return (values as readonly string[]).includes(candidate);
}

function requirePositiveSafeInteger(value: number | undefined, field: string): void {
  if (typeof value === "undefined") {
    return;
  }

  if (!Number.isSafeInteger(value) || value < 1 || value > 86_400) {
    throw new Error(`INVALID_P11_OBSERVABILITY_${field}`);
  }
}

function toSafeContext(context: P11ObservabilityContext): LogContext {
  if (
    typeof context.correlationId !== "string" ||
    !CORRELATION_ID_PATTERN.test(context.correlationId)
  ) {
    throw new Error("INVALID_P11_OBSERVABILITY_CORRELATION_ID");
  }

  if (!contains(P11_OBSERVABILITY_SURFACES, context.surface)) {
    throw new Error("INVALID_P11_OBSERVABILITY_SURFACE");
  }

  if (typeof context.scope !== "undefined" && !contains(P11_OBSERVABILITY_SCOPES, context.scope)) {
    throw new Error("INVALID_P11_OBSERVABILITY_SCOPE");
  }

  if (
    typeof context.outcome !== "undefined" &&
    !contains(P11_OBSERVABILITY_OUTCOMES, context.outcome)
  ) {
    throw new Error("INVALID_P11_OBSERVABILITY_OUTCOME");
  }

  if (
    typeof context.failureCode !== "undefined" &&
    !FAILURE_CODE_PATTERN.test(context.failureCode)
  ) {
    throw new Error("INVALID_P11_OBSERVABILITY_FAILURE_CODE");
  }

  requirePositiveSafeInteger(context.retryAfterSeconds, "RETRY_AFTER");

  requirePositiveSafeInteger(context.windowSeconds, "WINDOW_SECONDS");

  requirePositiveSafeInteger(context.limit, "LIMIT");

  const safe: Record<string, unknown> = {
    correlationId: context.correlationId,
    surface: context.surface,
  };

  if (typeof context.scope !== "undefined") {
    safe.scope = context.scope;
  }

  if (typeof context.outcome !== "undefined") {
    safe.outcome = context.outcome;
  }

  if (typeof context.failureCode !== "undefined") {
    safe.failureCode = context.failureCode;
  }

  if (typeof context.retryAfterSeconds !== "undefined") {
    safe.retryAfterSeconds = context.retryAfterSeconds;
  }

  if (typeof context.windowSeconds !== "undefined") {
    safe.windowSeconds = context.windowSeconds;
  }

  if (typeof context.limit !== "undefined") {
    safe.limit = context.limit;
  }

  return Object.freeze(safe);
}

function requireEvent(event: P11ObservabilityEvent): void {
  if (!contains(P11_OBSERVABILITY_EVENTS, event)) {
    throw new Error("INVALID_P11_OBSERVABILITY_EVENT");
  }
}

function emitP11Metric(event: P11ObservabilityEvent, context: P11ObservabilityContext): void {
  let name: OperationalMetricName | null = null;
  let surface: OperationalSurface = "OPERATIONS";
  let operation: OperationalOperation = "MAINTENANCE_JOB";

  switch (event) {
    case "buyer_access_rate_limited":
      name = "rate_limit_decisions_total";
      surface = "BUYER_ACCESS";
      operation = "RATE_LIMIT_DECISION";
      break;
    case "buyer_access_limiter_unavailable":
      name = "operational_failures_total";
      surface = "BUYER_ACCESS";
      operation = "RATE_LIMIT_DECISION";
      break;
    case "private_storage_failure":
      name = "storage_failures_total";
      surface = "PRIVATE_STORAGE";
      operation = "STORAGE_ACCESS";
      break;
    case "delivery_audit_unavailable":
    case "delivery_stream_failed":
      name = "delivery_operations_total";
      surface = "BUYER_ACCESS";
      operation = "PROTECTED_DOWNLOAD";
      break;
    case "credential_recovery_failed":
    case "entitlement_revocation_failed":
    case "backup_verification_failed":
    case "restore_validation_failed":
    case "rate_limit_cleanup_completed":
    case "rate_limit_cleanup_failed":
    case "rate_limit_stale_buckets_detected":
      name = "operational_jobs_total";
      break;
    case "buyer_access_invalid":
      return;
  }

  recordOperationalMetric({
    name,
    value: 1,
    correlationId: context.correlationId,
    labels: {
      surface,
      operation,
      outcome: context.outcome ?? "UNKNOWN",
      statusClass: "NONE",
    },
  });
}

export function createP11CorrelationId(): string {
  return createCorrelationId();
}

export const p11Observability = Object.freeze({
  info(event: P11ObservabilityEvent, context: P11ObservabilityContext): void {
    requireEvent(event);

    logger.info(event, toSafeContext(context));
    emitP11Metric(event, context);
  },

  warn(event: P11ObservabilityEvent, context: P11ObservabilityContext): void {
    requireEvent(event);

    logger.warn(event, toSafeContext(context));
    emitP11Metric(event, context);
  },

  error(event: P11ObservabilityEvent, context: P11ObservabilityContext): void {
    requireEvent(event);

    logger.error(event, toSafeContext(context));
    emitP11Metric(event, context);
  },
});
