/**
 * LES-P17-PERFORMANCE-BUDGET-R01
 *
 * Owner-approved numeric acceptance policy.
 *
 * STATIC CONTRACT ONLY:
 * - Does not run browsers, tests, servers or payments.
 * - Does not establish measurement provenance.
 * - Does not grant Gate D PASS or production authorization.
 */

import { NETWORK_CALIBRATION_TOLERANCE, PERFORMANCE_NETWORK_PROFILE } from "./network-profile.ts";

export type P17PerformanceIndicator = "PR01" | "PR02" | "PR03" | "PR04";

export type P17PerformanceViewport = "mobile" | "tablet" | "desktop";

export type P17PaymentFlow = "PIX" | "CREDIT_CARD";

export type P17PerformanceMetric = "LCP" | "INP" | "PAYMENT_POST_INITIATION" | "DELIVERY_HTTP_TTFB";

export type P17PerformancePercentile = "p75" | "p95";

export type P17PerformanceCohort = Readonly<{
  indicator: P17PerformanceIndicator;
  viewport: P17PerformanceViewport;
  flow?: P17PaymentFlow;
}>;

export const P17_ACCEPTANCE_POLICY = Object.freeze({
  id: "LES-P17-PERFORMANCE-BUDGET-R01",
  authority: "OWNER_APPROVED_CRITERIA_ONLY",
  gateD: "NOT_READY",
  production: "UNAUTHORIZED",
  warmupsPerCohort: 3,
  validSamplesPerCohort: 40,
  requiredCohortCount: 15,
  totalWarmups: 45,
  totalValidSamples: 600,
  percentileMethod: "NEAREST_RANK",
  retries: 0,
  workers: 1,
  additionalCpuThrottling: false,
  network: Object.freeze({
    downloadBitsPerSecond: PERFORMANCE_NETWORK_PROFILE.downloadBitsPerSecond,
    uploadBitsPerSecond: PERFORMANCE_NETWORK_PROFILE.uploadBitsPerSecond,
    roundTripTimeMs: PERFORMANCE_NETWORK_PROFILE.roundTripTimeMs,
    calibrationTolerance: NETWORK_CALIBRATION_TOLERANCE,
  }),
  criteria: Object.freeze({
    PR01: Object.freeze({
      metric: "LCP",
      percentile: "p75",
      limitMs: 2_500,
    }),
    PR02: Object.freeze({
      metric: "INP",
      percentile: "p75",
      limitMs: 200,
    }),
    PR03: Object.freeze({
      metric: "PAYMENT_POST_INITIATION",
      percentile: "p95",
      limitMs: 1_000,
    }),
    PR04: Object.freeze({
      metric: "DELIVERY_HTTP_TTFB",
      percentile: "p95",
      limitMs: 2_000,
    }),
  }),
} as const);

const VIEWPORTS: readonly P17PerformanceViewport[] = ["mobile", "tablet", "desktop"];

const requiredCohorts: P17PerformanceCohort[] = [];

for (const viewport of VIEWPORTS) {
  requiredCohorts.push(
    { indicator: "PR01", viewport },
    { indicator: "PR02", viewport },
    { indicator: "PR03", viewport, flow: "PIX" },
    { indicator: "PR03", viewport, flow: "CREDIT_CARD" },
    { indicator: "PR04", viewport },
  );
}

export const P17_REQUIRED_COHORTS: readonly P17PerformanceCohort[] = Object.freeze(
  requiredCohorts.map((cohort) => Object.freeze(cohort)),
);

export function p17CohortKey(cohort: P17PerformanceCohort): string {
  return [cohort.indicator, cohort.flow ?? "NO_FLOW", cohort.viewport].join(":");
}

export type P17CoverageResult = Readonly<{
  state: "STRUCTURALLY_COMPLETE_ONLY" | "INCOMPLETE";
  missing: readonly string[];
  duplicate: readonly string[];
  unexpected: readonly string[];
}>;

/**
 * Validates cohort layout only. It does not validate measurements.
 */
export function inspectP17CohortCoverage(
  cohorts: readonly P17PerformanceCohort[],
): P17CoverageResult {
  const expected = new Set(P17_REQUIRED_COHORTS.map(p17CohortKey));

  const seen = new Set<string>();
  const duplicate: string[] = [];
  const unexpected: string[] = [];

  for (const cohort of cohorts) {
    const key = p17CohortKey(cohort);

    if (!expected.has(key)) {
      unexpected.push(key);
    } else if (seen.has(key)) {
      duplicate.push(key);
    }

    seen.add(key);
  }

  const missing = [...expected].filter((key) => !seen.has(key));

  const complete =
    missing.length === 0 &&
    duplicate.length === 0 &&
    unexpected.length === 0 &&
    cohorts.length === P17_ACCEPTANCE_POLICY.requiredCohortCount;

  return Object.freeze({
    state: complete ? "STRUCTURALLY_COMPLETE_ONLY" : "INCOMPLETE",
    missing: Object.freeze(missing),
    duplicate: Object.freeze(duplicate),
    unexpected: Object.freeze(unexpected),
  });
}

export type P17ProvisionalObservation = Readonly<{
  cohort: P17PerformanceCohort;
  metric: P17PerformanceMetric;
  percentile: P17PerformancePercentile;
  observedMs: number | null;
  validWarmups: number;
  validSamples: number;
  invalidSamples: number;
  inconclusiveSamples: number;
  blockedSamples: number;
}>;

export type P17ProvisionalEvaluation = Readonly<{
  state: "NUMERIC_ONLY_NOT_GATE_D_PROOF" | "NOT_PROVEN";
  comparison: "WITHIN_NUMERIC_LIMIT" | "ABOVE_NUMERIC_LIMIT" | "NOT_EVALUATED";
  limitMs: number | null;
  reason: string;
}>;

/**
 * Provisional numeric comparison, never a release approval.
 *
 * The caller must separately prove browser instrumentation,
 * network calibration, isolation, evidence integrity and
 * the validity of all required cohorts.
 */
export function evaluateP17ProvisionalBudget(
  observation: P17ProvisionalObservation,
): P17ProvisionalEvaluation {
  const criterion = P17_ACCEPTANCE_POLICY.criteria[observation.cohort.indicator];

  const blocked = (reason: string): P17ProvisionalEvaluation =>
    Object.freeze({
      state: "NOT_PROVEN",
      comparison: "NOT_EVALUATED",
      limitMs: criterion?.limitMs ?? null,
      reason,
    });

  const expectedKey = p17CohortKey(observation.cohort);

  if (!P17_REQUIRED_COHORTS.some((cohort) => p17CohortKey(cohort) === expectedKey)) {
    return blocked("COHORT_NOT_AUTHORIZED");
  }

  if (observation.metric !== criterion.metric || observation.percentile !== criterion.percentile) {
    return blocked("METRIC_OR_PERCENTILE_MISMATCH");
  }

  const counts = [
    observation.validWarmups,
    observation.validSamples,
    observation.invalidSamples,
    observation.inconclusiveSamples,
    observation.blockedSamples,
  ];

  if (counts.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return blocked("SAMPLE_COUNT_INVALID");
  }

  if (
    observation.validWarmups !== P17_ACCEPTANCE_POLICY.warmupsPerCohort ||
    observation.validSamples !== P17_ACCEPTANCE_POLICY.validSamplesPerCohort ||
    observation.invalidSamples !== 0 ||
    observation.inconclusiveSamples !== 0 ||
    observation.blockedSamples !== 0
  ) {
    return blocked("COHORT_SAMPLES_NOT_ACCEPTABLE");
  }

  if (
    observation.observedMs === null ||
    !Number.isFinite(observation.observedMs) ||
    observation.observedMs < 0
  ) {
    return blocked("MEASUREMENT_INVALID");
  }

  return Object.freeze({
    state: "NUMERIC_ONLY_NOT_GATE_D_PROOF",
    comparison:
      observation.observedMs <= criterion.limitMs ? "WITHIN_NUMERIC_LIMIT" : "ABOVE_NUMERIC_LIMIT",
    limitMs: criterion.limitMs,
    reason: "PROVENANCE_AND_GATE_D_NOT_EVALUATED",
  });
}
