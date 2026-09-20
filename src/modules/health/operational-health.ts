export const OPERATIONAL_HEALTH_STATUSES = ["OK", "DEGRADED", "FAILED"] as const;

export type OperationalHealthStatus = (typeof OPERATIONAL_HEALTH_STATUSES)[number];

export const OPERATIONAL_HEALTH_CHECK_NAMES = [
  "APPLICATION_CONTRACT",
  "DATABASE_CONNECTIVITY",
  "RATE_LIMIT_RETENTION",
  "PRIVATE_STORAGE",
  "OBSERVABILITY_CONTRACT",
] as const;

export type OperationalHealthCheckName = (typeof OPERATIONAL_HEALTH_CHECK_NAMES)[number];

export type OperationalHealthCheckInput = Readonly<{
  name: OperationalHealthCheckName;
  status: OperationalHealthStatus;
  failureCode?: string;
}>;

export type OperationalHealthCheck = Readonly<{
  name: OperationalHealthCheckName;
  status: OperationalHealthStatus;
  failureCode?: string;
}>;

export type OperationalHealthReport = Readonly<{
  status: OperationalHealthStatus;
  checks: readonly OperationalHealthCheck[];
}>;

const FAILURE_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/u;

const STATUS_PRIORITY: Readonly<Record<OperationalHealthStatus, number>> = Object.freeze({
  OK: 0,
  DEGRADED: 1,
  FAILED: 2,
});

function contains<T extends string>(values: readonly T[], candidate: string): candidate is T {
  return (values as readonly string[]).includes(candidate);
}

function normalizeCheck(check: OperationalHealthCheckInput): OperationalHealthCheck {
  if (typeof check !== "object" || check === null) {
    throw new Error("INVALID_OPERATIONAL_HEALTH_CHECK");
  }

  if (typeof check.name !== "string" || !contains(OPERATIONAL_HEALTH_CHECK_NAMES, check.name)) {
    throw new Error("INVALID_OPERATIONAL_HEALTH_CHECK_NAME");
  }

  if (typeof check.status !== "string" || !contains(OPERATIONAL_HEALTH_STATUSES, check.status)) {
    throw new Error("INVALID_OPERATIONAL_HEALTH_CHECK_STATUS");
  }

  if (check.status === "OK") {
    if (typeof check.failureCode !== "undefined") {
      throw new Error("INVALID_OPERATIONAL_HEALTH_OK_FAILURE_CODE");
    }

    return Object.freeze({
      name: check.name,
      status: check.status,
    });
  }

  if (typeof check.failureCode !== "string" || !FAILURE_CODE_PATTERN.test(check.failureCode)) {
    throw new Error("INVALID_OPERATIONAL_HEALTH_FAILURE_CODE");
  }

  return Object.freeze({
    name: check.name,
    status: check.status,
    failureCode: check.failureCode,
  });
}

export function evaluateOperationalHealth(
  input: readonly OperationalHealthCheckInput[],
): OperationalHealthReport {
  if (!Array.isArray(input)) {
    throw new Error("INVALID_OPERATIONAL_HEALTH_CHECK_SET");
  }

  if (input.length !== OPERATIONAL_HEALTH_CHECK_NAMES.length) {
    throw new Error("INVALID_OPERATIONAL_HEALTH_CHECK_SET");
  }

  const byName = new Map<OperationalHealthCheckName, OperationalHealthCheck>();

  for (const candidate of input) {
    const check = normalizeCheck(candidate);

    if (byName.has(check.name)) {
      throw new Error("DUPLICATE_OPERATIONAL_HEALTH_CHECK");
    }

    byName.set(check.name, check);
  }

  const checks = OPERATIONAL_HEALTH_CHECK_NAMES.map((name) => {
    const check = byName.get(name);

    if (!check) {
      throw new Error("MISSING_OPERATIONAL_HEALTH_CHECK");
    }

    return check;
  });

  let status: OperationalHealthStatus = "OK";

  for (const check of checks) {
    if (STATUS_PRIORITY[check.status] > STATUS_PRIORITY[status]) {
      status = check.status;
    }
  }

  return Object.freeze({
    status,
    checks: Object.freeze([...checks]),
  });
}
