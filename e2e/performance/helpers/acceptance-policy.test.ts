import { describe, expect, it } from "vitest";

import {
  P17_ACCEPTANCE_POLICY,
  P17_REQUIRED_COHORTS,
  evaluateP17ProvisionalBudget,
  inspectP17CohortCoverage,
} from "./acceptance-policy";

describe("LES-P17-PERFORMANCE-BUDGET-R01", () => {
  it("keeps the four limits in one canonical policy", () => {
    expect(P17_ACCEPTANCE_POLICY.criteria).toEqual({
      PR01: { metric: "LCP", percentile: "p75", limitMs: 2_500 },
      PR02: { metric: "INP", percentile: "p75", limitMs: 200 },
      PR03: { metric: "PAYMENT_POST_INITIATION", percentile: "p95", limitMs: 1_000 },
      PR04: { metric: "DELIVERY_HTTP_TTFB", percentile: "p95", limitMs: 2_000 },
    });
  });

  it("contains exactly fifteen isolated cohorts including PIX and card", () => {
    expect(P17_REQUIRED_COHORTS).toHaveLength(15);
    expect(inspectP17CohortCoverage(P17_REQUIRED_COHORTS).state).toBe("STRUCTURALLY_COMPLETE_ONLY");
    expect(P17_REQUIRED_COHORTS.filter((cohort) => cohort.flow === "PIX")).toHaveLength(3);
    expect(P17_REQUIRED_COHORTS.filter((cohort) => cohort.flow === "CREDIT_CARD")).toHaveLength(3);
  });

  it("rejects duplicates, missing cohorts and payment-flow mixing", () => {
    const withoutCardDesktop = P17_REQUIRED_COHORTS.filter(
      (cohort) =>
        !(
          cohort.indicator === "PR03" &&
          cohort.viewport === "desktop" &&
          cohort.flow === "CREDIT_CARD"
        ),
    );
    const mixed = [
      ...withoutCardDesktop,
      { indicator: "PR03" as const, viewport: "desktop" as const, flow: "PIX" as const },
    ];
    const review = inspectP17CohortCoverage(mixed);
    expect(review.state).toBe("INCOMPLETE");
    expect(review.duplicate).toContain("PR03:PIX:desktop");
    expect(review.missing).toContain("PR03:CREDIT_CARD:desktop");
  });

  it("compares the boundary numerically without granting Gate D authority", () => {
    const result = evaluateP17ProvisionalBudget({
      cohort: { indicator: "PR02", viewport: "mobile" },
      metric: "INP",
      percentile: "p75",
      observedMs: 200,
      validWarmups: 3,
      validSamples: 40,
      invalidSamples: 0,
      inconclusiveSamples: 0,
      blockedSamples: 0,
    });
    expect(result.state).toBe("NUMERIC_ONLY_NOT_GATE_D_PROOF");
    expect(result.comparison).toBe("WITHIN_NUMERIC_LIMIT");
  });
});
