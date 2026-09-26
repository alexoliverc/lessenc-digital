export const ALERT_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_OWNERS = [
  "OWNER_ON_CALL",
  "OPERATIONS",
  "COMMERCE_OPERATIONS",
  "SECURITY",
] as const;
export type AlertOwner = (typeof ALERT_OWNERS)[number];

export type AlertSignal = Readonly<{
  event: string;
  failureCode?: string;
  occurredAt: Date;
  surface?:
    | "BUYER_ACCESS_EXCHANGE"
    | "BUYER_LIBRARY"
    | "PROTECTED_DOWNLOAD"
    | "RATE_LIMIT"
    | "PRIVATE_STORAGE"
    | "DELIVERY_AUDIT"
    | "CREDENTIAL_RECOVERY"
    | "ENTITLEMENT_REVOCATION"
    | "BACKUP_RESTORE";
  scope?: "EXCHANGE_GLOBAL" | "EXCHANGE_CREDENTIAL" | "LIBRARY_CREDENTIAL" | "DOWNLOAD_CREDENTIAL";
}>;

export type AlertPartition = Readonly<{
  surface: NonNullable<AlertSignal["surface"]>;
  scope?: NonNullable<AlertSignal["scope"]>;
}>;

export type AlertRule = Readonly<{
  id: string;
  event: string;
  failureCode?: string;
  severity: AlertSeverity;
  owner: AlertOwner;
  threshold: number;
  windowSeconds: number;
  component: "WEBSITE" | "CHECKOUT" | "PAYMENTS" | "BUYER_ACCESS_DELIVERY" | "ADMIN";
}>;

export type AlertEvaluation = Readonly<{
  firing: boolean;
  count: number;
  deduplicationKey: string;
  severity: AlertSeverity;
  owner: AlertOwner;
  partition?: AlertPartition;
}>;

const FAILURE_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/u;
const EVENT_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/u;
const RULE_ID_PATTERN = /^P15-[A-Z0-9-]{1,48}$/u;
const ALERT_PARTITION_SURFACES = [
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
const ALERT_PARTITION_SCOPES = [
  "EXCHANGE_GLOBAL",
  "EXCHANGE_CREDENTIAL",
  "LIBRARY_CREDENTIAL",
  "DOWNLOAD_CREDENTIAL",
] as const;
const ALERT_COMPONENTS = [
  "WEBSITE",
  "CHECKOUT",
  "PAYMENTS",
  "BUYER_ACCESS_DELIVERY",
  "ADMIN",
] as const;

const ALERT_SCOPE_SURFACES: Readonly<
  Record<NonNullable<AlertSignal["scope"]>, readonly NonNullable<AlertSignal["surface"]>[]>
> = Object.freeze({
  EXCHANGE_GLOBAL: Object.freeze(["BUYER_ACCESS_EXCHANGE", "RATE_LIMIT"] as const),
  EXCHANGE_CREDENTIAL: Object.freeze(["BUYER_ACCESS_EXCHANGE", "RATE_LIMIT"] as const),
  LIBRARY_CREDENTIAL: Object.freeze(["BUYER_LIBRARY", "RATE_LIMIT"] as const),
  DOWNLOAD_CREDENTIAL: Object.freeze(["PROTECTED_DOWNLOAD", "RATE_LIMIT"] as const),
});

export const P15_ALERT_RULES: readonly AlertRule[] = Object.freeze([
  {
    id: "P15-DELIVERY-AUDIT-UNAVAILABLE",
    event: "delivery_audit_unavailable",
    failureCode: "DELIVERY_AUDIT_UNAVAILABLE",
    severity: "CRITICAL",
    owner: "OWNER_ON_CALL",
    threshold: 1,
    windowSeconds: 1,
    component: "BUYER_ACCESS_DELIVERY",
  },
  {
    id: "P15-STORAGE-ESCAPE-DETECTED",
    event: "private_storage_failure",
    failureCode: "STORAGE_ESCAPE_DETECTED",
    severity: "CRITICAL",
    owner: "SECURITY",
    threshold: 1,
    windowSeconds: 1,
    component: "BUYER_ACCESS_DELIVERY",
  },
  {
    id: "P15-STORAGE-ROOT-INVALID",
    event: "private_storage_failure",
    failureCode: "STORAGE_ROOT_INVALID",
    severity: "HIGH",
    owner: "OWNER_ON_CALL",
    threshold: 1,
    windowSeconds: 1,
    component: "BUYER_ACCESS_DELIVERY",
  },
  {
    id: "P15-ENTITLEMENT-REVOCATION-FAILED",
    event: "entitlement_revocation_failed",
    failureCode: "ENTITLEMENT_REVOCATION_FAILED",
    severity: "CRITICAL",
    owner: "COMMERCE_OPERATIONS",
    threshold: 1,
    windowSeconds: 1,
    component: "BUYER_ACCESS_DELIVERY",
  },
  {
    id: "P15-RATE-LIMIT-UNAVAILABLE",
    event: "buyer_access_limiter_unavailable",
    failureCode: "RATE_LIMIT_UNAVAILABLE",
    severity: "HIGH",
    owner: "OWNER_ON_CALL",
    threshold: 1,
    windowSeconds: 1,
    component: "BUYER_ACCESS_DELIVERY",
  },
  {
    id: "P15-BACKUP-VERIFY-FAILED",
    event: "backup_verification_failed",
    failureCode: "BACKUP_VERIFICATION_FAILED",
    severity: "HIGH",
    owner: "OPERATIONS",
    threshold: 1,
    windowSeconds: 1,
    component: "ADMIN",
  },
  {
    id: "P15-RESTORE-VALIDATION-FAILED",
    event: "restore_validation_failed",
    failureCode: "RESTORE_VALIDATION_FAILED",
    severity: "HIGH",
    owner: "OPERATIONS",
    threshold: 1,
    windowSeconds: 1,
    component: "ADMIN",
  },
  {
    id: "P15-RATE-LIMIT-CLEANUP-FAILED",
    event: "rate_limit_cleanup_failed",
    failureCode: "RATE_LIMIT_CLEANUP_FAILED",
    severity: "HIGH",
    owner: "OPERATIONS",
    threshold: 1,
    windowSeconds: 1,
    component: "BUYER_ACCESS_DELIVERY",
  },
  {
    id: "P15-RATE-LIMIT-STALE-AFTER-CLEANUP",
    event: "rate_limit_stale_buckets_detected",
    severity: "HIGH",
    owner: "OPERATIONS",
    threshold: 1,
    windowSeconds: 1,
    component: "BUYER_ACCESS_DELIVERY",
  },
  {
    id: "P15-STORAGE-ROOT-UNAVAILABLE-RECURRENCE",
    event: "private_storage_failure",
    failureCode: "STORAGE_ROOT_UNAVAILABLE",
    severity: "HIGH",
    owner: "OWNER_ON_CALL",
    threshold: 3,
    windowSeconds: 300,
    component: "BUYER_ACCESS_DELIVERY",
  },
  {
    id: "P15-STORAGE-UNAVAILABLE-RECURRENCE",
    event: "private_storage_failure",
    failureCode: "STORAGE_UNAVAILABLE",
    severity: "HIGH",
    owner: "OWNER_ON_CALL",
    threshold: 3,
    windowSeconds: 300,
    component: "BUYER_ACCESS_DELIVERY",
  },
  {
    id: "P15-RESOURCE-NOT-FOUND-RECURRENCE",
    event: "private_storage_failure",
    failureCode: "RESOURCE_NOT_FOUND",
    severity: "MEDIUM",
    owner: "OPERATIONS",
    threshold: 3,
    windowSeconds: 300,
    component: "BUYER_ACCESS_DELIVERY",
  },
  {
    id: "P15-STREAM-FAILED-RECURRENCE",
    event: "delivery_stream_failed",
    failureCode: "STREAM_FAILED",
    severity: "HIGH",
    owner: "OWNER_ON_CALL",
    threshold: 5,
    windowSeconds: 300,
    component: "BUYER_ACCESS_DELIVERY",
  },
  {
    id: "P15-RATE-LIMIT-429-RECURRENCE",
    event: "buyer_access_rate_limited",
    severity: "MEDIUM",
    owner: "OPERATIONS",
    threshold: 20,
    windowSeconds: 300,
    component: "BUYER_ACCESS_DELIVERY",
  },
]);

export const P15_SLI_CATALOG = Object.freeze([
  Object.freeze({
    id: "HTTP_AVAILABILITY",
    description: "successful eligible HTTP responses divided by eligible HTTP requests",
    target: "OPEN_STAGING_BASELINE",
  }),
  Object.freeze({
    id: "PAYMENT_OPERATION_SUCCESS",
    description: "successful authoritative payment operations divided by attempted operations",
    target: "OPEN_STAGING_BASELINE",
  }),
  Object.freeze({
    id: "PROTECTED_DELIVERY_SUCCESS",
    description: "successful authorized deliveries divided by authorized delivery attempts",
    target: "OPEN_STAGING_BASELINE",
  }),
  Object.freeze({
    id: "READINESS_AVAILABILITY",
    description: "ready evaluations divided by total readiness evaluations",
    target: "OPEN_STAGING_BASELINE",
  }),
]);

export function assertValidAlertRule(rule: AlertRule): void {
  if (!RULE_ID_PATTERN.test(rule.id) || !EVENT_PATTERN.test(rule.event)) {
    throw new Error("INVALID_ALERT_RULE_IDENTITY");
  }
  if (rule.failureCode !== undefined && !FAILURE_CODE_PATTERN.test(rule.failureCode)) {
    throw new Error("INVALID_ALERT_RULE_FAILURE_CODE");
  }
  if (
    !ALERT_SEVERITIES.includes(rule.severity) ||
    !ALERT_OWNERS.includes(rule.owner) ||
    !ALERT_COMPONENTS.includes(rule.component)
  ) {
    throw new Error("INVALID_ALERT_RULE_ROUTING");
  }
  if (
    !Number.isSafeInteger(rule.threshold) ||
    rule.threshold < 1 ||
    !Number.isSafeInteger(rule.windowSeconds) ||
    rule.windowSeconds < 1 ||
    rule.windowSeconds > 86_400
  ) {
    throw new Error("INVALID_ALERT_RULE_WINDOW");
  }
}

function isCanonicalAlertPartition(partition: AlertPartition): boolean {
  return (
    ALERT_PARTITION_SURFACES.includes(partition.surface) &&
    (partition.scope === undefined ||
      (ALERT_PARTITION_SCOPES.includes(partition.scope) &&
        ALERT_SCOPE_SURFACES[partition.scope].includes(partition.surface)))
  );
}

function canonicalAlertPartition(partition?: AlertPartition): AlertPartition | undefined {
  if (partition === undefined) return undefined;

  if (
    partition === null ||
    typeof partition !== "object" ||
    !isCanonicalAlertPartition(partition)
  ) {
    throw new Error("INVALID_ALERT_PARTITION");
  }

  return Object.freeze({
    surface: partition.surface,
    ...(partition.scope === undefined ? {} : { scope: partition.scope }),
  });
}

export function deriveAlertDeduplicationKey(rule: AlertRule, partition?: AlertPartition): string {
  assertValidAlertRule(rule);
  const canonicalPartition = canonicalAlertPartition(partition);

  return [rule.id, rule.component, canonicalPartition?.surface, canonicalPartition?.scope]
    .filter((value) => value !== undefined)
    .join(":");
}

function validateSignal(signal: AlertSignal): void {
  if (
    typeof signal.event !== "string" ||
    !EVENT_PATTERN.test(signal.event) ||
    (signal.failureCode !== undefined && !FAILURE_CODE_PATTERN.test(signal.failureCode)) ||
    !(signal.occurredAt instanceof Date) ||
    !Number.isFinite(signal.occurredAt.getTime()) ||
    (signal.surface !== undefined && !ALERT_PARTITION_SURFACES.includes(signal.surface)) ||
    (signal.scope !== undefined && !ALERT_PARTITION_SCOPES.includes(signal.scope)) ||
    (signal.scope !== undefined && signal.surface === undefined) ||
    (signal.surface !== undefined &&
      !isCanonicalAlertPartition({
        surface: signal.surface,
        ...(signal.scope === undefined ? {} : { scope: signal.scope }),
      }))
  ) {
    throw new Error("INVALID_ALERT_SIGNAL");
  }
}

export function evaluateAlertWindow(
  rule: AlertRule,
  signals: readonly AlertSignal[],
  evaluatedAt: Date,
  partition?: AlertPartition,
): AlertEvaluation {
  assertValidAlertRule(rule);
  if (!(evaluatedAt instanceof Date) || !Number.isFinite(evaluatedAt.getTime())) {
    throw new Error("INVALID_ALERT_EVALUATION_TIME");
  }
  const canonicalPartition = canonicalAlertPartition(partition);

  const windowStart = evaluatedAt.getTime() - rule.windowSeconds * 1000;
  const count = signals.filter((signal) => {
    validateSignal(signal);
    return (
      signal.event === rule.event &&
      (rule.failureCode === undefined || signal.failureCode === rule.failureCode) &&
      (canonicalPartition === undefined ||
        (signal.surface === canonicalPartition.surface &&
          (canonicalPartition.scope === undefined || signal.scope === canonicalPartition.scope))) &&
      signal.occurredAt.getTime() > windowStart &&
      signal.occurredAt.getTime() <= evaluatedAt.getTime()
    );
  }).length;

  return Object.freeze({
    firing: count >= rule.threshold,
    count,
    deduplicationKey: deriveAlertDeduplicationKey(rule, canonicalPartition),
    severity: rule.severity,
    owner: rule.owner,
    ...(canonicalPartition === undefined ? {} : { partition: canonicalPartition }),
  });
}
