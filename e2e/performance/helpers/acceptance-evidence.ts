/**
 * LES-P17-PERFORMANCE-I04-B1-R02
 *
 * Static adapter between the existing P17 evidence model
 * and the owner-approved numeric acceptance policy.
 *
 * No browser execution, network request, payment operation,
 * release decision or production authorization.
 *
 * Conservative interim rule: exactly 3 valid warmups
 * followed by 40 valid measurements, with no discarded
 * attempts. Owner approval of a broader attempt-discard
 * policy has not been established.
 */

import { createCohortSummary, type AttemptEvidence, type CohortSummary } from "./evidence.ts";

import {
  P17_ACCEPTANCE_POLICY,
  P17_REQUIRED_COHORTS,
  evaluateP17ProvisionalBudget,
  p17CohortKey,
  type P17PerformanceCohort,
  type P17ProvisionalEvaluation,
} from "./acceptance-policy.ts";

export type P17EvidenceReview =
  | Readonly<{
      state: "NOT_PROVEN";
      cohortKey: string | null;
      reason: string;
      numeric: null;
    }>
  | Readonly<{
      state: "NUMERIC_ONLY_NOT_GATE_D_PROOF";
      cohortKey: string;
      reason: "PROVENANCE_AND_GATE_D_NOT_EVALUATED";
      numeric: P17ProvisionalEvaluation;
      summary: CohortSummary;
    }>;

function rejectEvidence(reason: string, cohortKey: string | null = null): P17EvidenceReview {
  return Object.freeze({
    state: "NOT_PROVEN",
    cohortKey,
    reason,
    numeric: null,
  });
}

/**
 * Performs a conservative cohort-level evidence review.
 *
 * Existing evidence validation protects sample schemas,
 * environment isolation and network calibration records.
 * This adapter additionally checks cohort composition,
 * attempt ordering and numeric policy alignment.
 *
 * The result never represents Gate D performance proof.
 */
export function inspectP17AcceptanceEvidence(
  attempts: readonly AttemptEvidence[],
): P17EvidenceReview {
  const first = attempts[0];

  if (first === undefined) {
    return rejectEvidence("COHORT_EMPTY");
  }

  const cohort: P17PerformanceCohort = {
    indicator: first.indicator,
    viewport: first.viewport,
    ...(first.flow === undefined ? {} : { flow: first.flow }),
  };

  const key = p17CohortKey(cohort);

  const authorized = P17_REQUIRED_COHORTS.some((required) => p17CohortKey(required) === key);

  if (!authorized) {
    return rejectEvidence("COHORT_NOT_AUTHORIZED", key);
  }

  const requiredCount =
    P17_ACCEPTANCE_POLICY.warmupsPerCohort + P17_ACCEPTANCE_POLICY.validSamplesPerCohort;

  if (attempts.length !== requiredCount) {
    return rejectEvidence("STRICT_ATTEMPT_COUNT_NOT_SATISFIED", key);
  }

  let summary: CohortSummary;

  try {
    summary = createCohortSummary(attempts);
  } catch {
    return rejectEvidence("EVIDENCE_SCHEMA_OR_ISOLATION_REJECTED", key);
  }

  // Validate the original acquisition order; never sort evidence.
  for (let index = 0; index < attempts.length; index++) {
    const sample = attempts[index];

    if (sample === undefined || sample.attempt !== index + 1) {
      return rejectEvidence("ATTEMPT_SEQUENCE_NOT_UNIQUE", key);
    }

    if (
      sample.commit !== first.commit ||
      sample.browser.version !== first.browser.version ||
      sample.browser.playwrightVersion !== first.browser.playwrightVersion
    ) {
      return rejectEvidence("MIXED_RUNTIME_IDENTITY", key);
    }

    const expectedState = index < P17_ACCEPTANCE_POLICY.warmupsPerCohort ? "WARMUP_VALID" : "VALID";

    if (sample.state !== expectedState) {
      return rejectEvidence("WARMUP_OR_MEASUREMENT_ORDER_INVALID", key);
    }

    const value = sample.milestones.metricValueMs;

    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return rejectEvidence("MEASUREMENT_MISSING_OR_INVALID", key);
    }
  }

  if (
    summary.evaluation !== "READY_FOR_PERCENTILES" ||
    summary.percentiles === null ||
    summary.counts.WARMUP_VALID !== P17_ACCEPTANCE_POLICY.warmupsPerCohort ||
    summary.counts.VALID !== P17_ACCEPTANCE_POLICY.validSamplesPerCohort ||
    summary.counts.INVALID !== 0 ||
    summary.counts.INCONCLUSIVE !== 0 ||
    summary.counts.BLOCKED !== 0
  ) {
    return rejectEvidence("COHORT_EVIDENCE_NOT_ACCEPTABLE", key);
  }

  const criterion = P17_ACCEPTANCE_POLICY.criteria[cohort.indicator];

  const observedMs = summary.percentiles[criterion.percentile];

  const numeric = evaluateP17ProvisionalBudget({
    cohort,
    metric: criterion.metric,
    percentile: criterion.percentile,
    observedMs,
    validWarmups: summary.counts.WARMUP_VALID,
    validSamples: summary.counts.VALID,
    invalidSamples: summary.counts.INVALID,
    inconclusiveSamples: summary.counts.INCONCLUSIVE,
    blockedSamples: summary.counts.BLOCKED,
  });

  if (numeric.state !== "NUMERIC_ONLY_NOT_GATE_D_PROOF") {
    return rejectEvidence("NUMERIC_POLICY_NOT_PROVEN", key);
  }

  return Object.freeze({
    state: "NUMERIC_ONLY_NOT_GATE_D_PROOF",
    cohortKey: key,
    reason: "PROVENANCE_AND_GATE_D_NOT_EVALUATED",
    numeric,
    summary,
  });
}
