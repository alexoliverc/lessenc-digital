import { calculatePerformancePercentiles, REQUIRED_VALID_SAMPLES } from "./percentiles";
import {
  evaluateNetworkCalibration,
  NETWORK_CALIBRATION_TOLERANCE,
  PERFORMANCE_NETWORK_PROFILE,
  type NetworkCalibration,
} from "./network-profile";

export const ATTEMPT_STATES = [
  "WARMUP_VALID",
  "VALID",
  "INVALID",
  "INCONCLUSIVE",
  "BLOCKED",
] as const;

export type AttemptState = (typeof ATTEMPT_STATES)[number];
export type PerformanceIndicator = "PR01" | "PR02" | "PR03" | "PR04";
export type PerformanceViewport = "mobile" | "tablet" | "desktop";

export type IsolationEvidenceState = Readonly<{
  configuration: "VALIDATED" | "BLOCKED";
  capsule: "STATIC_ONLY" | "OPERATIONALLY_PROVEN" | "BLOCKED";
  browserEgress: "NOT_PROVEN" | "BLOCKED_BY_CAPSULE";
  nodeEgress: "NOT_PROVEN" | "BLOCKED_BY_CAPSULE";
}>;

export type AttemptEvidence = Readonly<{
  schemaVersion: 1;
  runId: string;
  indicator: PerformanceIndicator;
  flow?: "PIX" | "CREDIT_CARD";
  viewport: PerformanceViewport;
  attempt: number;
  state: AttemptState;
  reason?: string;
  milestones: Readonly<Record<string, number>>;
  browser: Readonly<{
    engine: "chromium";
    version: string;
    playwrightVersion: string;
  }>;
  network: typeof PERFORMANCE_NETWORK_PROFILE;
  calibration: NetworkCalibration | null;
  commit: string;
  isolation: IsolationEvidenceState;
}>;

const sensitiveKey =
  /(authorization|cookie|credential|header|password|secret|token|financial|body|url)/iu;
const normalizedReason = /^[A-Z][A-Z0-9_]{2,79}$/u;
const safeRunId = /^p17-perf-[a-z0-9][a-z0-9._-]{7,80}$/u;
const safeVersion = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u;
const safeMilestone = /^[a-z][a-zA-Z0-9]{1,63}$/u;

function assertOnlyKeys(value: object, allowed: readonly string[]): void {
  const allowedKeys = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new Error("P17_EVIDENCE_FIELD_NOT_ALLOWED");
  }
}

function assertNoSensitiveKeys(value: unknown, path = "evidence"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveKeys(item, `${path}.${index}`));
    return;
  }

  if (value === null || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (sensitiveKey.test(key)) {
      throw new Error("P17_EVIDENCE_SENSITIVE_FIELD_FORBIDDEN");
    }
    assertNoSensitiveKeys(child, `${path}.${key}`);
  }
}

function assertAttemptEvidence(evidence: AttemptEvidence): void {
  assertNoSensitiveKeys(evidence);

  assertOnlyKeys(evidence, [
    "schemaVersion",
    "runId",
    "indicator",
    "flow",
    "viewport",
    "attempt",
    "state",
    "reason",
    "milestones",
    "browser",
    "network",
    "calibration",
    "commit",
    "isolation",
  ]);
  assertOnlyKeys(evidence.browser, ["engine", "version", "playwrightVersion"]);
  assertOnlyKeys(evidence.network, [
    "downloadBitsPerSecond",
    "uploadBitsPerSecond",
    "roundTripTimeMs",
    "downloadBytesPerSecond",
    "uploadBytesPerSecond",
  ]);
  assertOnlyKeys(evidence.isolation, ["configuration", "capsule", "browserEgress", "nodeEgress"]);
  if (evidence.calibration !== null) {
    assertOnlyKeys(evidence.calibration, [
      "downloadBitsPerSecond",
      "uploadBitsPerSecond",
      "roundTripTimeMs",
    ]);
  }

  if (evidence.schemaVersion !== 1) throw new Error("P17_EVIDENCE_SCHEMA_INVALID");
  if (!safeRunId.test(evidence.runId)) throw new Error("P17_EVIDENCE_RUN_ID_INVALID");
  if (!["PR01", "PR02", "PR03", "PR04"].includes(evidence.indicator))
    throw new Error("P17_EVIDENCE_INDICATOR_INVALID");
  if (!["mobile", "tablet", "desktop"].includes(evidence.viewport))
    throw new Error("P17_EVIDENCE_VIEWPORT_INVALID");
  if (!ATTEMPT_STATES.includes(evidence.state)) throw new Error("P17_EVIDENCE_STATE_INVALID");
  if (!Number.isInteger(evidence.attempt) || evidence.attempt < 1 || evidence.attempt > 50)
    throw new Error("P17_EVIDENCE_ATTEMPT_INVALID");
  if (evidence.reason !== undefined && !normalizedReason.test(evidence.reason))
    throw new Error("P17_EVIDENCE_REASON_INVALID");
  if (!/^[0-9a-f]{40}$/u.test(evidence.commit)) throw new Error("P17_EVIDENCE_COMMIT_INVALID");
  if (!safeVersion.test(evidence.browser.version))
    throw new Error("P17_EVIDENCE_BROWSER_VERSION_INVALID");
  if (!safeVersion.test(evidence.browser.playwrightVersion))
    throw new Error("P17_EVIDENCE_PLAYWRIGHT_VERSION_INVALID");
  if (evidence.browser.engine !== "chromium") throw new Error("P17_EVIDENCE_BROWSER_INVALID");
  if (evidence.indicator !== "PR03" && evidence.flow !== undefined)
    throw new Error("P17_EVIDENCE_FLOW_NOT_APPLICABLE");
  if (evidence.indicator === "PR03" && evidence.flow === undefined)
    throw new Error("P17_EVIDENCE_FLOW_REQUIRED");
  if (evidence.flow !== undefined && !["PIX", "CREDIT_CARD"].includes(evidence.flow))
    throw new Error("P17_EVIDENCE_FLOW_INVALID");

  if (
    evidence.network.downloadBitsPerSecond !== PERFORMANCE_NETWORK_PROFILE.downloadBitsPerSecond ||
    evidence.network.uploadBitsPerSecond !== PERFORMANCE_NETWORK_PROFILE.uploadBitsPerSecond ||
    evidence.network.roundTripTimeMs !== PERFORMANCE_NETWORK_PROFILE.roundTripTimeMs ||
    evidence.network.downloadBytesPerSecond !==
      PERFORMANCE_NETWORK_PROFILE.downloadBytesPerSecond ||
    evidence.network.uploadBytesPerSecond !== PERFORMANCE_NETWORK_PROFILE.uploadBytesPerSecond
  ) {
    throw new Error("P17_EVIDENCE_NETWORK_PROFILE_INVALID");
  }

  if (
    evidence.calibration !== null &&
    (!Number.isFinite(evidence.calibration.downloadBitsPerSecond) ||
      !Number.isFinite(evidence.calibration.uploadBitsPerSecond) ||
      !Number.isFinite(evidence.calibration.roundTripTimeMs) ||
      evidence.calibration.downloadBitsPerSecond <= 0 ||
      evidence.calibration.uploadBitsPerSecond <= 0 ||
      evidence.calibration.roundTripTimeMs <= 0)
  ) {
    throw new Error("P17_EVIDENCE_CALIBRATION_INVALID");
  }

  if (
    !["VALIDATED", "BLOCKED"].includes(evidence.isolation.configuration) ||
    !["STATIC_ONLY", "OPERATIONALLY_PROVEN", "BLOCKED"].includes(evidence.isolation.capsule) ||
    !["NOT_PROVEN", "BLOCKED_BY_CAPSULE"].includes(evidence.isolation.browserEgress) ||
    !["NOT_PROVEN", "BLOCKED_BY_CAPSULE"].includes(evidence.isolation.nodeEgress)
  ) {
    throw new Error("P17_EVIDENCE_ISOLATION_STATE_INVALID");
  }

  if (evidence.state === "VALID" || evidence.state === "WARMUP_VALID") {
    if (
      evidence.isolation.configuration !== "VALIDATED" ||
      evidence.isolation.capsule !== "OPERATIONALLY_PROVEN" ||
      evidence.isolation.browserEgress !== "BLOCKED_BY_CAPSULE" ||
      evidence.isolation.nodeEgress !== "BLOCKED_BY_CAPSULE"
    ) {
      throw new Error("P17_EVIDENCE_VALID_ATTEMPT_NOT_ISOLATED");
    }

    if (evaluateNetworkCalibration(evidence.calibration).state !== "VALID") {
      throw new Error("P17_EVIDENCE_VALID_ATTEMPT_NOT_CALIBRATED");
    }
  }

  for (const [name, value] of Object.entries(evidence.milestones)) {
    if (!safeMilestone.test(name) || !Number.isFinite(value) || value < 0)
      throw new Error("P17_EVIDENCE_MILESTONE_INVALID");
  }
}

export function serializeAttemptEvidence(evidence: AttemptEvidence): string {
  assertAttemptEvidence(evidence);
  return `${JSON.stringify(evidence)}\n`;
}

export type CohortSummary = Readonly<{
  schemaVersion: 1;
  runId: string;
  indicator: PerformanceIndicator;
  flow?: "PIX" | "CREDIT_CARD";
  viewport: PerformanceViewport;
  counts: Readonly<Record<AttemptState, number>>;
  evaluation: "READY_FOR_PERCENTILES" | "INCONCLUSIVE" | "BLOCKED";
  percentiles: Readonly<{ p50: number; p75: number; p95: number }> | null;
  requiredValidSamples: typeof REQUIRED_VALID_SAMPLES;
  calibrationTolerance: typeof NETWORK_CALIBRATION_TOLERANCE;
}>;

export function createCohortSummary(attempts: readonly AttemptEvidence[]): CohortSummary {
  if (attempts.length === 0) throw new Error("P17_EVIDENCE_COHORT_EMPTY");

  attempts.forEach(assertAttemptEvidence);

  const first = attempts[0];
  if (first === undefined) throw new Error("P17_EVIDENCE_COHORT_EMPTY");

  for (const attempt of attempts) {
    if (
      attempt.runId !== first.runId ||
      attempt.indicator !== first.indicator ||
      attempt.flow !== first.flow ||
      attempt.viewport !== first.viewport
    ) {
      throw new Error("P17_EVIDENCE_COHORT_MIXED");
    }
  }

  const counts: Record<AttemptState, number> = {
    WARMUP_VALID: 0,
    VALID: 0,
    INVALID: 0,
    INCONCLUSIVE: 0,
    BLOCKED: 0,
  };

  for (const attempt of attempts) counts[attempt.state] += 1;

  const validValues = attempts
    .filter((attempt) => attempt.state === "VALID")
    .map((attempt) => attempt.milestones.metricValueMs)
    .filter((value): value is number => value !== undefined);

  let evaluation: CohortSummary["evaluation"] = "INCONCLUSIVE";
  if (counts.BLOCKED > 0) evaluation = "BLOCKED";
  else if (counts.INCONCLUSIVE === 0 && validValues.length === REQUIRED_VALID_SAMPLES)
    evaluation = "READY_FOR_PERCENTILES";

  const percentiles =
    evaluation === "READY_FOR_PERCENTILES" ? calculatePerformancePercentiles(validValues) : null;

  return Object.freeze({
    schemaVersion: 1,
    runId: first.runId,
    indicator: first.indicator,
    ...(first.flow === undefined ? {} : { flow: first.flow }),
    viewport: first.viewport,
    counts: Object.freeze(counts),
    evaluation,
    percentiles,
    requiredValidSamples: REQUIRED_VALID_SAMPLES,
    calibrationTolerance: NETWORK_CALIBRATION_TOLERANCE,
  });
}

export function serializeCohortSummary(summary: CohortSummary): string {
  assertNoSensitiveKeys(summary);
  return `${JSON.stringify(summary, null, 2)}\n`;
}
