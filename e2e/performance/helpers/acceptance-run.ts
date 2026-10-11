import { inspectP17AcceptanceEvidence, type P17EvidenceReview } from "./acceptance-evidence.ts";
import {
  P17_ACCEPTANCE_POLICY,
  inspectP17CohortCoverage,
  p17CohortKey,
  type P17PerformanceCohort,
} from "./acceptance-policy.ts";
import type { AttemptEvidence } from "./evidence.ts";

export type P17HardwareIdentity = Readonly<{
  platform: string;
  architecture: string;
  cpuModel: string;
  logicalCpuCount: number;
  totalMemoryBytes: number;
}>;

export type P17CommitVerification = Readonly<{
  state: "VERIFIED" | "NOT_VERIFIED";
  method:
    | "READ_ONLY_GIT_HEAD_AND_CLEAN_WORKTREE"
    | "READ_ONLY_GIT_HEAD_DIRTY_WORKTREE"
    | "DECLARED_COMMIT_FILE_ONLY"
    | "NOT_AVAILABLE";
  observedCommit: string | null;
}>;

export type P17SourceVerification = Readonly<{
  state: "VERIFIED" | "NOT_VERIFIED";
  method: "READ_ONLY_SOURCE_TREE_SHA256" | "NOT_AVAILABLE";
  observedSha256: string | null;
}>;

export type P17CalibrationVerification = Readonly<{
  state: "BROWSER_LOOPBACK_OBSERVED" | "NOT_VERIFIED";
  method: "BROWSER_LOOPBACK_PROBES" | "NOT_AVAILABLE";
  cohortCount: number;
  downloadProbeCount: number;
  uploadProbeCount: number;
  roundTripProbeCount: number;
}>;

export type P17RunManifest = Readonly<{
  schemaVersion: 1;
  policyId: typeof P17_ACCEPTANCE_POLICY.id;
  runId: string;
  commit: string;
  sourceTreeSha256: string;
  browser: Readonly<{
    engine: "chromium";
    version: string;
    playwrightVersion: string;
  }>;
  nodeVersion: string;
  environment: "ISOLATED_LOCAL_CAPSULE";
  hardware: P17HardwareIdentity;
  commitVerification: P17CommitVerification;
  sourceVerification: P17SourceVerification;
  calibrationVerification: P17CalibrationVerification;
}>;

export type P17AcceptanceRunReview = Readonly<{
  state: "PROVISIONAL_NUMERIC_REVIEW_ONLY" | "NOT_PROVEN";
  reason: string;
  numericResult: "ALL_COHORTS_WITHIN_LIMIT" | "ONE_OR_MORE_COHORTS_ABOVE_LIMIT" | "NOT_EVALUATED";
  gateD: "NOT_READY";
  production: "UNAUTHORIZED";
  coverage: ReturnType<typeof inspectP17CohortCoverage>;
  cohortReviews: Readonly<Record<string, P17EvidenceReview>>;
  totals: Readonly<{
    cohorts: number;
    warmups: number;
    validSamples: number;
  }>;
}>;

function validVersion(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u.test(value);
}

function validHardware(identity: P17HardwareIdentity): boolean {
  return (
    identity.platform.trim().length > 0 &&
    identity.architecture.trim().length > 0 &&
    identity.cpuModel.trim().length > 0 &&
    Number.isSafeInteger(identity.logicalCpuCount) &&
    identity.logicalCpuCount > 0 &&
    Number.isSafeInteger(identity.totalMemoryBytes) &&
    identity.totalMemoryBytes > 0
  );
}

function cohortFromAttempt(attempt: AttemptEvidence): P17PerformanceCohort {
  return Object.freeze({
    indicator: attempt.indicator,
    viewport: attempt.viewport,
    ...(attempt.flow === undefined ? {} : { flow: attempt.flow }),
  });
}

function emptyTotals(): P17AcceptanceRunReview["totals"] {
  return Object.freeze({ cohorts: 0, warmups: 0, validSamples: 0 });
}

function reject(
  reason: string,
  coverage: ReturnType<typeof inspectP17CohortCoverage>,
  cohortReviews: Readonly<Record<string, P17EvidenceReview>> = Object.freeze({}),
  totals: P17AcceptanceRunReview["totals"] = emptyTotals(),
): P17AcceptanceRunReview {
  return Object.freeze({
    state: "NOT_PROVEN",
    reason,
    numericResult: "NOT_EVALUATED",
    gateD: "NOT_READY",
    production: "UNAUTHORIZED",
    coverage,
    cohortReviews,
    totals,
  });
}

/**
 * Reviews one complete evidence package without granting operational or Gate D authority.
 *
 * The manifest is deliberately stronger than an arbitrary caller assertion: missing hardware,
 * independently verified source bytes or browser-loopback calibration evidence keeps the package
 * NOT_PROVEN. A dirty worktree may still receive a provisional numeric review when its exact bytes
 * are verified, but it never becomes an immutable commit-bound release candidate.
 */
export function inspectP17AcceptanceRun(
  manifest: P17RunManifest,
  attempts: readonly AttemptEvidence[],
): P17AcceptanceRunReview {
  const grouped = new Map<string, AttemptEvidence[]>();

  for (const attempt of attempts) {
    const key = p17CohortKey(cohortFromAttempt(attempt));
    const group = grouped.get(key) ?? [];
    group.push(attempt);
    grouped.set(key, group);
  }

  const coverage = inspectP17CohortCoverage(
    [...grouped.values()]
      .map((group) => group[0])
      .filter((attempt): attempt is AttemptEvidence => attempt !== undefined)
      .map(cohortFromAttempt),
  );

  if (
    manifest.schemaVersion !== 1 ||
    manifest.policyId !== P17_ACCEPTANCE_POLICY.id ||
    !/^p17-perf-[a-z0-9][a-z0-9._-]{7,80}$/u.test(manifest.runId) ||
    !/^[0-9a-f]{40}$/u.test(manifest.commit) ||
    !/^[0-9a-f]{64}$/u.test(manifest.sourceTreeSha256) ||
    manifest.browser.engine !== "chromium" ||
    !validVersion(manifest.browser.version) ||
    !validVersion(manifest.browser.playwrightVersion) ||
    !validVersion(manifest.nodeVersion) ||
    manifest.environment !== "ISOLATED_LOCAL_CAPSULE"
  ) {
    return reject("RUN_MANIFEST_INVALID", coverage);
  }

  if (!validHardware(manifest.hardware)) {
    return reject("HARDWARE_IDENTITY_MISSING_OR_INVALID", coverage);
  }

  const commitVerified =
    manifest.commitVerification.state === "VERIFIED" &&
    manifest.commitVerification.method === "READ_ONLY_GIT_HEAD_AND_CLEAN_WORKTREE" &&
    manifest.commitVerification.observedCommit === manifest.commit;

  if (
    manifest.sourceVerification.state !== "VERIFIED" ||
    manifest.sourceVerification.method !== "READ_ONLY_SOURCE_TREE_SHA256" ||
    manifest.sourceVerification.observedSha256 !== manifest.sourceTreeSha256
  ) {
    return reject("SOURCE_BYTES_NOT_VERIFIED", coverage);
  }

  if (
    manifest.calibrationVerification.state !== "BROWSER_LOOPBACK_OBSERVED" ||
    manifest.calibrationVerification.method !== "BROWSER_LOOPBACK_PROBES" ||
    manifest.calibrationVerification.cohortCount !== P17_ACCEPTANCE_POLICY.requiredCohortCount ||
    manifest.calibrationVerification.downloadProbeCount !==
      P17_ACCEPTANCE_POLICY.requiredCohortCount * 3 ||
    manifest.calibrationVerification.uploadProbeCount !==
      P17_ACCEPTANCE_POLICY.requiredCohortCount * 3 ||
    manifest.calibrationVerification.roundTripProbeCount !==
      P17_ACCEPTANCE_POLICY.requiredCohortCount * 3
  ) {
    return reject("CALIBRATION_PROVENANCE_NOT_VERIFIED", coverage);
  }

  if (coverage.state !== "STRUCTURALLY_COMPLETE_ONLY") {
    return reject("REQUIRED_COHORT_COVERAGE_INCOMPLETE", coverage);
  }

  const cohortReviews: Record<string, P17EvidenceReview> = {};
  let warmups = 0;
  let validSamples = 0;
  let numericLimitExceeded = false;

  for (const [key, group] of grouped) {
    const review = inspectP17AcceptanceEvidence(group);
    cohortReviews[key] = review;

    if (review.state !== "NUMERIC_ONLY_NOT_GATE_D_PROOF") {
      return reject(
        `COHORT_REJECTED_${key}_${review.reason}`,
        coverage,
        Object.freeze(cohortReviews),
        Object.freeze({ cohorts: Object.keys(cohortReviews).length, warmups, validSamples }),
      );
    }

    if (review.numeric.comparison === "ABOVE_NUMERIC_LIMIT") {
      numericLimitExceeded = true;
    }

    const first = group[0];
    if (
      first === undefined ||
      first.runId !== manifest.runId ||
      first.commit !== manifest.commit ||
      first.browser.engine !== manifest.browser.engine ||
      first.browser.version !== manifest.browser.version ||
      first.browser.playwrightVersion !== manifest.browser.playwrightVersion
    ) {
      return reject("RUN_AND_COHORT_IDENTITY_MISMATCH", coverage, Object.freeze(cohortReviews));
    }

    warmups += review.summary.counts.WARMUP_VALID;
    validSamples += review.summary.counts.VALID;
  }

  const totals = Object.freeze({
    cohorts: grouped.size,
    warmups,
    validSamples,
  });

  if (
    totals.cohorts !== P17_ACCEPTANCE_POLICY.requiredCohortCount ||
    totals.warmups !== P17_ACCEPTANCE_POLICY.totalWarmups ||
    totals.validSamples !== P17_ACCEPTANCE_POLICY.totalValidSamples
  ) {
    return reject("RUN_TOTALS_INVALID", coverage, Object.freeze(cohortReviews), totals);
  }

  return Object.freeze({
    state: "PROVISIONAL_NUMERIC_REVIEW_ONLY",
    reason: numericLimitExceeded
      ? "ONE_OR_MORE_COHORTS_ABOVE_NUMERIC_LIMIT"
      : commitVerified
        ? "OPERATIONAL_AND_GATE_D_AUTHORITY_NOT_GRANTED"
        : "SOURCE_BYTES_VERIFIED_COMMIT_IDENTITY_NOT_VERIFIED",
    numericResult: numericLimitExceeded
      ? "ONE_OR_MORE_COHORTS_ABOVE_LIMIT"
      : "ALL_COHORTS_WITHIN_LIMIT",
    gateD: "NOT_READY",
    production: "UNAUTHORIZED",
    coverage,
    cohortReviews: Object.freeze(cohortReviews),
    totals,
  });
}
