export const OBSERVABILITY_SERVICE_NAME = "lessenc-digital";

export const CORRELATION_RESPONSE_HEADER = "x-correlation-id";

export const INTERNAL_CORRELATION_REQUEST_HEADER = "x-lessenc-correlation-id";

export const P11_OBSERVABILITY_SURFACES = [
  "BUYER_ACCESS_EXCHANGE",
  "BUYER_LIBRARY",
  "PROTECTED_DOWNLOAD",
  "RATE_LIMIT",
  "PRIVATE_STORAGE",
  "DELIVERY_AUDIT",
  "CREDENTIAL_RECOVERY",
  "ENTITLEMENT_REVOCATION",
  "BACKUP_RESTORE",
] as const;

export const P11_OBSERVABILITY_EVENTS = [
  "buyer_access_invalid",
  "buyer_access_rate_limited",
  "buyer_access_limiter_unavailable",
  "private_storage_failure",
  "delivery_audit_unavailable",
  "delivery_stream_failed",
  "credential_recovery_failed",
  "entitlement_revocation_failed",
  "backup_verification_failed",
  "restore_validation_failed",
  "rate_limit_cleanup_completed",
  "rate_limit_cleanup_failed",
  "rate_limit_stale_buckets_detected",
] as const;

export const OPERATIONAL_METRIC_DEFINITIONS = Object.freeze({
  http_requests_total: Object.freeze({ kind: "COUNTER", unit: "request" }),
  http_request_duration_ms: Object.freeze({ kind: "HISTOGRAM", unit: "millisecond" }),
  operational_failures_total: Object.freeze({ kind: "COUNTER", unit: "failure" }),
  payment_operations_total: Object.freeze({ kind: "COUNTER", unit: "operation" }),
  webhook_operations_total: Object.freeze({ kind: "COUNTER", unit: "operation" }),
  delivery_operations_total: Object.freeze({ kind: "COUNTER", unit: "operation" }),
  rate_limit_decisions_total: Object.freeze({ kind: "COUNTER", unit: "decision" }),
  storage_failures_total: Object.freeze({ kind: "COUNTER", unit: "failure" }),
  operational_jobs_total: Object.freeze({ kind: "COUNTER", unit: "job" }),
  readiness_evaluations_total: Object.freeze({ kind: "COUNTER", unit: "evaluation" }),
});
