export const READINESS_CHECK_NAMES = [
  "APPLICATION_CONTRACT",
  "DATABASE_CONNECTIVITY",
  "PRIVATE_STORAGE",
] as const;

export type ReadinessCheckName = (typeof READINESS_CHECK_NAMES)[number];

export type ReadinessCheck = Readonly<{
  name: ReadinessCheckName;
  ready: boolean;
  failureCode?: string;
}>;

export type ReadinessReport = Readonly<{
  status: "READY" | "NOT_READY";
  checks: readonly ReadinessCheck[];
}>;

const FAILURE_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/u;

function normalizeCheck(check: ReadinessCheck): ReadinessCheck {
  if (!READINESS_CHECK_NAMES.includes(check.name)) {
    throw new Error("INVALID_READINESS_CHECK_NAME");
  }

  if (typeof check.ready !== "boolean") {
    throw new Error("INVALID_READINESS_CHECK_STATE");
  }

  if (check.ready) {
    if (check.failureCode !== undefined) {
      throw new Error("INVALID_READY_FAILURE_CODE");
    }
    return Object.freeze({ name: check.name, ready: true });
  }

  if (typeof check.failureCode !== "string" || !FAILURE_CODE_PATTERN.test(check.failureCode)) {
    throw new Error("INVALID_READINESS_FAILURE_CODE");
  }

  return Object.freeze({
    name: check.name,
    ready: false,
    failureCode: check.failureCode,
  });
}

export function evaluateReadiness(input: readonly ReadinessCheck[]): ReadinessReport {
  if (!Array.isArray(input) || input.length !== READINESS_CHECK_NAMES.length) {
    throw new Error("INVALID_READINESS_CHECK_SET");
  }

  const byName = new Map<ReadinessCheckName, ReadinessCheck>();
  for (const candidate of input) {
    const check = normalizeCheck(candidate);
    if (byName.has(check.name)) {
      throw new Error("DUPLICATE_READINESS_CHECK");
    }
    byName.set(check.name, check);
  }

  const checks = READINESS_CHECK_NAMES.map((name) => {
    const check = byName.get(name);
    if (check === undefined) {
      throw new Error("MISSING_READINESS_CHECK");
    }
    return check;
  });

  return Object.freeze({
    status: checks.every((check) => check.ready) ? "READY" : "NOT_READY",
    checks: Object.freeze(checks),
  });
}

export function projectPublicReadiness(report: ReadinessReport): Readonly<{
  status: "ready" | "not_ready";
}> {
  return Object.freeze({
    status: report.status === "READY" ? "ready" : "not_ready",
  });
}
