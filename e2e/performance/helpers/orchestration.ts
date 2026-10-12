import { cpus, totalmem } from "node:os";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  P17_ACCEPTANCE_POLICY,
  P17_REQUIRED_COHORTS,
  inspectP17CohortCoverage,
  p17CohortKey,
  type P17PerformanceCohort,
} from "./acceptance-policy.ts";
import {
  inspectP17AcceptanceRun,
  type P17CommitVerification,
  type P17RunManifest,
  type P17SourceVerification,
} from "./acceptance-run.ts";
import type { BrowserMetricResult } from "./browser-metrics.ts";
import { evaluateCalibrationProbes, type NetworkCalibrationEvidence } from "./calibration.ts";
import {
  assertSanitizedEvidenceObject,
  serializeAttemptEvidence,
  type AttemptEvidence,
  type IsolationEvidenceState,
} from "./evidence.ts";
import { PERFORMANCE_NETWORK_PROFILE } from "./network-profile.ts";
import { assertLocalPerformanceExecutionAuthorized } from "./isolation.ts";

export type P17PlannedAttempt = Readonly<{
  cohort: P17PerformanceCohort;
  cohortKey: string;
  attempt: number;
  phase: "WARMUP" | "MEASUREMENT";
}>;

export type P17CohortCalibrationEvidence = Readonly<{
  cohort: P17PerformanceCohort;
  calibration: NetworkCalibrationEvidence;
}>;

export type P17CalibrationPackageReview = Readonly<{
  state: "STRUCTURALLY_COMPLETE_ONLY" | "NOT_PROVEN";
  reason: string;
  cohortCount: number;
  downloadProbeCount: number;
  uploadProbeCount: number;
  roundTripProbeCount: number;
}>;

export function inspectP17CalibrationPackage(
  calibrations: readonly P17CohortCalibrationEvidence[],
): P17CalibrationPackageReview {
  const coverage = new Map<string, number>();
  let downloadProbeCount = 0;
  let uploadProbeCount = 0;
  let roundTripProbeCount = 0;

  const reject = (reason: string): P17CalibrationPackageReview =>
    Object.freeze({
      state: "NOT_PROVEN",
      reason,
      cohortCount: coverage.size,
      downloadProbeCount,
      uploadProbeCount,
      roundTripProbeCount,
    });

  for (const entry of calibrations) {
    const key = p17CohortKey(entry.cohort);
    coverage.set(key, (coverage.get(key) ?? 0) + 1);
    const calibration = entry.calibration;
    downloadProbeCount += calibration.downloadProbeCount;
    uploadProbeCount += calibration.uploadProbeCount;
    roundTripProbeCount += calibration.roundTripProbeCount;

    let reconstructed: NetworkCalibrationEvidence;
    try {
      reconstructed = evaluateCalibrationProbes(calibration.probes);
    } catch {
      return reject("CALIBRATION_PROBES_INVALID");
    }

    if (
      calibration.schemaVersion !== 1 ||
      calibration.method !== "BROWSER_LOOPBACK_PROBES" ||
      calibration.configuredProfileApplied !== true ||
      calibration.downloadProbeCount !== 3 ||
      calibration.uploadProbeCount !== 3 ||
      calibration.roundTripProbeCount !== 3 ||
      calibration.evaluation.state !== "VALID" ||
      reconstructed.evaluation.state !== "VALID" ||
      calibration.evaluation.tolerance !== reconstructed.evaluation.tolerance ||
      reconstructed.observed.downloadBitsPerSecond !== calibration.observed.downloadBitsPerSecond ||
      reconstructed.observed.uploadBitsPerSecond !== calibration.observed.uploadBitsPerSecond ||
      reconstructed.observed.roundTripTimeMs !== calibration.observed.roundTripTimeMs
    ) {
      return reject("CALIBRATION_EVIDENCE_INCONSISTENT");
    }
  }

  const cohortCoverage = inspectP17CohortCoverage(calibrations.map((entry) => entry.cohort));
  if (
    cohortCoverage.state !== "STRUCTURALLY_COMPLETE_ONLY" ||
    [...coverage.values()].some((count) => count !== 1)
  ) {
    return reject("CALIBRATION_COHORT_COVERAGE_INVALID");
  }

  return Object.freeze({
    state: "STRUCTURALLY_COMPLETE_ONLY",
    reason: "CALIBRATION_VALUES_RECOMPUTED_FROM_RAW_PROBES",
    cohortCount: coverage.size,
    downloadProbeCount,
    uploadProbeCount,
    roundTripProbeCount,
  });
}

export function createP17ExecutionPlan(): readonly P17PlannedAttempt[] {
  const plan: P17PlannedAttempt[] = [];

  for (const cohort of P17_REQUIRED_COHORTS) {
    const key = p17CohortKey(cohort);
    const attempts =
      P17_ACCEPTANCE_POLICY.warmupsPerCohort + P17_ACCEPTANCE_POLICY.validSamplesPerCohort;

    for (let index = 0; index < attempts; index += 1) {
      plan.push(
        Object.freeze({
          cohort,
          cohortKey: key,
          attempt: index + 1,
          phase: index < P17_ACCEPTANCE_POLICY.warmupsPerCohort ? "WARMUP" : "MEASUREMENT",
        }),
      );
    }
  }

  return Object.freeze(plan);
}

/**
 * Collection is authorized only by the exact local-only contract from the active owner brief.
 * Operational capsule isolation is independently re-established before any sample is collected.
 */
export function assertPerformanceCollectionAuthorized(): void {
  assertLocalPerformanceExecutionAuthorized(process.env, process.cwd());
}

export function createAttemptEvidence(
  input: Readonly<{
    plan: P17PlannedAttempt;
    runId: string;
    commit: string;
    browserVersion: string;
    playwrightVersion: string;
    metric: BrowserMetricResult;
    calibration: NetworkCalibrationEvidence;
    isolation: IsolationEvidenceState;
  }>,
): AttemptEvidence {
  const calibrated = input.calibration.evaluation.state === "VALID";
  const operationallyIsolated =
    input.isolation.configuration === "VALIDATED" &&
    input.isolation.capsule === "OPERATIONALLY_PROVEN" &&
    input.isolation.browserEgress === "BLOCKED_BY_CAPSULE" &&
    input.isolation.nodeEgress === "BLOCKED_BY_CAPSULE";

  const valid = input.metric.state === "VALID" && calibrated && operationallyIsolated;
  const blocked = !calibrated || !operationallyIsolated;

  const state: AttemptEvidence["state"] = valid
    ? input.plan.phase === "WARMUP"
      ? "WARMUP_VALID"
      : "VALID"
    : blocked
      ? "BLOCKED"
      : "INCONCLUSIVE";

  const reason =
    state === "BLOCKED"
      ? !operationallyIsolated
        ? "ISOLATION_NOT_PROVEN"
        : "CALIBRATION_NOT_PROVEN"
      : state === "INCONCLUSIVE"
        ? `METRIC_${"reason" in input.metric ? input.metric.reason : "TIMING_INCONSISTENT"}`
        : undefined;

  return Object.freeze({
    schemaVersion: 1,
    runId: input.runId,
    indicator: input.plan.cohort.indicator,
    ...(input.plan.cohort.flow === undefined ? {} : { flow: input.plan.cohort.flow }),
    viewport: input.plan.cohort.viewport,
    attempt: input.plan.attempt,
    state,
    ...(reason === undefined ? {} : { reason }),
    milestones:
      input.metric.state === "VALID"
        ? Object.freeze({ metricValueMs: input.metric.valueMs })
        : Object.freeze({}),
    browser: Object.freeze({
      engine: "chromium",
      version: input.browserVersion,
      playwrightVersion: input.playwrightVersion,
    }),
    network: PERFORMANCE_NETWORK_PROFILE,
    calibration: input.calibration.observed,
    commit: input.commit,
    isolation: input.isolation,
  });
}

export function createRunManifest(
  input: Readonly<{
    runId: string;
    commit: string;
    sourceTreeSha256: string;
    imageDigest: string;
    browserVersion: string;
    playwrightVersion: string;
    nodeVersion: string;
    repositoryRoot: string;
    calibrations: readonly P17CohortCalibrationEvidence[];
  }>,
): P17RunManifest {
  const processors = cpus();
  const cpuModel = processors[0]?.model.trim() ?? "";
  const calibrationReview = inspectP17CalibrationPackage(input.calibrations);
  const calibrationVerified = calibrationReview.state === "STRUCTURALLY_COMPLETE_ONLY";

  return Object.freeze({
    schemaVersion: 1,
    policyId: P17_ACCEPTANCE_POLICY.id,
    runId: input.runId,
    commit: input.commit,
    sourceTreeSha256: input.sourceTreeSha256,
    imageDigest: input.imageDigest,
    browser: Object.freeze({
      engine: "chromium",
      version: input.browserVersion,
      playwrightVersion: input.playwrightVersion,
    }),
    nodeVersion: input.nodeVersion,
    environment: "ISOLATED_LOCAL_CAPSULE",
    hardware: Object.freeze({
      platform: process.platform,
      architecture: process.arch,
      cpuModel,
      logicalCpuCount: processors.length,
      totalMemoryBytes: totalmem(),
    }),
    commitVerification: verifyReadOnlyGitHead(input.repositoryRoot, input.commit),
    sourceVerification: verifySourceTree(input.repositoryRoot, input.sourceTreeSha256),
    calibrationVerification: Object.freeze({
      state: calibrationVerified ? "BROWSER_LOOPBACK_OBSERVED" : "NOT_VERIFIED",
      method: calibrationVerified ? "BROWSER_LOOPBACK_PROBES" : "NOT_AVAILABLE",
      cohortCount: calibrationReview.cohortCount,
      downloadProbeCount: calibrationReview.downloadProbeCount,
      uploadProbeCount: calibrationReview.uploadProbeCount,
      roundTripProbeCount: calibrationReview.roundTripProbeCount,
    }),
  });
}

export function verifyReadOnlyGitHead(
  repositoryRoot: string,
  expectedCommit: string,
): P17CommitVerification {
  if (!/^[0-9a-f]{40}$/u.test(expectedCommit)) {
    return Object.freeze({ state: "NOT_VERIFIED", method: "NOT_AVAILABLE", observedCommit: null });
  }

  try {
    const observed = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    }).trim();

    if (/^[0-9a-f]{40}$/u.test(observed) && observed !== expectedCommit) {
      return Object.freeze({
        state: "NOT_VERIFIED",
        method: "NOT_AVAILABLE",
        observedCommit: observed,
      });
    }

    if (observed === expectedCommit) {
      const status = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5_000,
      }).trim();

      if (status !== "") {
        return Object.freeze({
          state: "NOT_VERIFIED",
          method: "READ_ONLY_GIT_HEAD_DIRTY_WORKTREE",
          observedCommit: observed,
        });
      }

      return Object.freeze({
        state: "VERIFIED",
        method: "READ_ONLY_GIT_HEAD_AND_CLEAN_WORKTREE",
        observedCommit: observed,
      });
    }
  } catch {
    // A runtime image deliberately excludes .git; verify its read-only build provenance below.
  }

  try {
    const observed = readFileSync(join(repositoryRoot, ".p17-declared-commit"), "utf8").trim();
    return Object.freeze({
      state: "NOT_VERIFIED",
      method: "DECLARED_COMMIT_FILE_ONLY",
      observedCommit: /^[0-9a-f]{40}$/u.test(observed) ? observed : null,
    });
  } catch {
    return Object.freeze({ state: "NOT_VERIFIED", method: "NOT_AVAILABLE", observedCommit: null });
  }
}

export function verifySourceTree(
  repositoryRoot: string,
  expectedSha256: string,
): P17SourceVerification {
  if (!/^[0-9a-f]{64}$/u.test(expectedSha256)) {
    return Object.freeze({ state: "NOT_VERIFIED", method: "NOT_AVAILABLE", observedSha256: null });
  }

  try {
    const observed = readFileSync(join(repositoryRoot, ".p17-source-tree.sha256"), "utf8").trim();
    if (/^[0-9a-f]{64}$/u.test(observed) && observed === expectedSha256) {
      return Object.freeze({
        state: "VERIFIED",
        method: "READ_ONLY_SOURCE_TREE_SHA256",
        observedSha256: observed,
      });
    }
    return Object.freeze({
      state: "NOT_VERIFIED",
      method: "NOT_AVAILABLE",
      observedSha256: /^[0-9a-f]{64}$/u.test(observed) ? observed : null,
    });
  } catch {
    return Object.freeze({ state: "NOT_VERIFIED", method: "NOT_AVAILABLE", observedSha256: null });
  }
}

export function serializeP17AcceptancePackage(
  manifest: P17RunManifest,
  attempts: readonly AttemptEvidence[],
  calibrations: readonly P17CohortCalibrationEvidence[],
): string {
  const review = inspectP17AcceptanceRun(manifest, attempts);
  const calibrationReview = inspectP17CalibrationPackage(calibrations);
  assertSanitizedEvidenceObject(manifest);
  assertSanitizedEvidenceObject(review);
  assertSanitizedEvidenceObject(calibrations);
  assertSanitizedEvidenceObject(calibrationReview);

  return `${JSON.stringify(
    {
      schemaVersion: 1,
      policyId: P17_ACCEPTANCE_POLICY.id,
      authority: "PROVISIONAL_LOCAL_NUMERIC_REVIEW_ONLY",
      gateD: "NOT_READY",
      production: "UNAUTHORIZED",
      manifest,
      calibrations,
      calibrationReview,
      attempts: attempts.map((attempt) => JSON.parse(serializeAttemptEvidence(attempt))),
      review,
    },
    null,
    2,
  )}\n`;
}
