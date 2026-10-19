import { describe, expect, it } from "vitest";

import { inspectP17AcceptanceEvidence } from "./acceptance-evidence";
import type { AttemptEvidence } from "./evidence";
import { PERFORMANCE_NETWORK_PROFILE } from "./network-profile";

function attempts(): AttemptEvidence[] {
  return Array.from({ length: 43 }, (_, index) => ({
    schemaVersion: 1,
    runId: "p17-perf-acceptance-evidence-test",
    indicator: "PR01",
    viewport: "mobile",
    attempt: index + 1,
    state: index < 3 ? "WARMUP_VALID" : "VALID",
    milestones: { metricValueMs: index + 1 },
    browser: {
      engine: "chromium",
      version: "153.0.8010.12",
      playwrightVersion: "1.63.0",
    },
    network: PERFORMANCE_NETWORK_PROFILE,
    calibration: {
      downloadBitsPerSecond: 10_000_000,
      uploadBitsPerSecond: 2_000_000,
      roundTripTimeMs: 80,
    },
    commit: "d73b2d678686fc805c6eb5f26a852ae60f870b91",
    isolation: {
      configuration: "VALIDATED",
      capsule: "OPERATIONALLY_PROVEN",
      browserEgress: "BLOCKED_BY_CAPSULE",
      nodeEgress: "BLOCKED_BY_CAPSULE",
    },
  }));
}

describe("P17 acceptance evidence adapter", () => {
  it("accepts exactly three ordered warmups followed by forty measurements", () => {
    const review = inspectP17AcceptanceEvidence(attempts());
    expect(review.state).toBe("NUMERIC_ONLY_NOT_GATE_D_PROOF");
    if (review.state === "NUMERIC_ONLY_NOT_GATE_D_PROOF") {
      expect(review.summary.counts.WARMUP_VALID).toBe(3);
      expect(review.summary.counts.VALID).toBe(40);
    }
  });

  it("rejects acquisition reordering instead of sorting the records", () => {
    const evidence = attempts();
    [evidence[3], evidence[4]] = [evidence[4]!, evidence[3]!];
    expect(inspectP17AcceptanceEvidence(evidence)).toMatchObject({
      state: "NOT_PROVEN",
      reason: "ATTEMPT_SEQUENCE_NOT_UNIQUE",
    });
  });

  it("rejects a gap, a duplicate and any inconclusive attempt", () => {
    const gap = attempts();
    gap[10] = { ...gap[10]!, attempt: 12 };
    expect(inspectP17AcceptanceEvidence(gap).state).toBe("NOT_PROVEN");

    const inconclusive = attempts();
    inconclusive[20] = {
      ...inconclusive[20]!,
      state: "INCONCLUSIVE",
      reason: "METRIC_ENTRY_MISSING",
      milestones: {},
    };
    expect(inspectP17AcceptanceEvidence(inconclusive).state).toBe("NOT_PROVEN");
  });

  it("rejects mixed commit and browser identities", () => {
    const evidence = attempts();
    evidence[42] = {
      ...evidence[42]!,
      commit: "0000000000000000000000000000000000000000",
    };
    expect(inspectP17AcceptanceEvidence(evidence)).toMatchObject({
      state: "NOT_PROVEN",
      reason: "MIXED_RUNTIME_IDENTITY",
    });
  });
});
