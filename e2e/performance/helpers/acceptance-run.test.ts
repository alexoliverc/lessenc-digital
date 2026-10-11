import { describe, expect, it } from "vitest";

import type { P17RunManifest } from "./acceptance-run";
import { inspectP17AcceptanceRun } from "./acceptance-run";
import { P17_REQUIRED_COHORTS } from "./acceptance-policy";
import type { AttemptEvidence } from "./evidence";
import { PERFORMANCE_NETWORK_PROFILE } from "./network-profile";

const commit = "d73b2d678686fc805c6eb5f26a852ae60f870b91";
const sourceTreeSha256 = "a".repeat(64);
const runId = "p17-perf-complete-run-test";

function manifest(): P17RunManifest {
  return {
    schemaVersion: 1,
    policyId: "LES-P17-PERFORMANCE-BUDGET-R01",
    runId,
    commit,
    sourceTreeSha256,
    browser: { engine: "chromium", version: "153.0.8010.12", playwrightVersion: "1.63.0" },
    nodeVersion: "24.21.0",
    environment: "ISOLATED_LOCAL_CAPSULE",
    hardware: {
      platform: "linux",
      architecture: "x64",
      cpuModel: "Synthetic CPU",
      logicalCpuCount: 4,
      totalMemoryBytes: 8_000_000_000,
    },
    commitVerification: {
      state: "VERIFIED",
      method: "READ_ONLY_GIT_HEAD_AND_CLEAN_WORKTREE",
      observedCommit: commit,
    },
    sourceVerification: {
      state: "VERIFIED",
      method: "READ_ONLY_SOURCE_TREE_SHA256",
      observedSha256: sourceTreeSha256,
    },
    calibrationVerification: {
      state: "BROWSER_LOOPBACK_OBSERVED",
      method: "BROWSER_LOOPBACK_PROBES",
      cohortCount: 15,
      downloadProbeCount: 45,
      uploadProbeCount: 45,
      roundTripProbeCount: 45,
    },
  };
}

function completeAttempts(): AttemptEvidence[] {
  return P17_REQUIRED_COHORTS.flatMap((cohort) =>
    Array.from({ length: 43 }, (_, index) => ({
      schemaVersion: 1 as const,
      runId,
      indicator: cohort.indicator,
      ...(cohort.flow === undefined ? {} : { flow: cohort.flow }),
      viewport: cohort.viewport,
      attempt: index + 1,
      state: (index < 3 ? "WARMUP_VALID" : "VALID") as AttemptEvidence["state"],
      milestones: { metricValueMs: 100 },
      browser: {
        engine: "chromium" as const,
        version: "153.0.8010.12",
        playwrightVersion: "1.63.0",
      },
      network: PERFORMANCE_NETWORK_PROFILE,
      calibration: {
        downloadBitsPerSecond: 10_000_000,
        uploadBitsPerSecond: 2_000_000,
        roundTripTimeMs: 80,
      },
      commit,
      isolation: {
        configuration: "VALIDATED" as const,
        capsule: "OPERATIONALLY_PROVEN" as const,
        browserEgress: "BLOCKED_BY_CAPSULE" as const,
        nodeEgress: "BLOCKED_BY_CAPSULE" as const,
      },
    })),
  );
}

describe("P17 full-run acceptance review", () => {
  it("requires 15 cohorts, 45 warmups and 600 valid measurements", () => {
    const review = inspectP17AcceptanceRun(manifest(), completeAttempts());
    expect(review.state).toBe("PROVISIONAL_NUMERIC_REVIEW_ONLY");
    expect(review.numericResult).toBe("ALL_COHORTS_WITHIN_LIMIT");
    expect(review.totals).toEqual({ cohorts: 15, warmups: 45, validSamples: 600 });
    expect(review.gateD).toBe("NOT_READY");
    expect(review.production).toBe("UNAUTHORIZED");
  });

  it("rejects a legacy label that overstates calibration independence", () => {
    const legacy = {
      ...manifest(),
      calibrationVerification: {
        ...manifest().calibrationVerification,
        state: "INDEPENDENTLY_MEASURED",
      },
    } as unknown as P17RunManifest;

    const review = inspectP17AcceptanceRun(legacy, completeAttempts());

    expect(review.state).toBe("NOT_PROVEN");
    expect(review.reason).toBe("CALIBRATION_PROVENANCE_NOT_VERIFIED");
    expect(review.gateD).toBe("NOT_READY");
    expect(review.production).toBe("UNAUTHORIZED");
  });
  it("reports an exceeded cohort instead of implying all budgets are within limit", () => {
    const evidence = completeAttempts();
    for (let index = 3; index < 43; index += 1) {
      evidence[index] = { ...evidence[index]!, milestones: { metricValueMs: 3_000 } };
    }
    const review = inspectP17AcceptanceRun(manifest(), evidence);
    expect(review.state).toBe("PROVISIONAL_NUMERIC_REVIEW_ONLY");
    expect(review.numericResult).toBe("ONE_OR_MORE_COHORTS_ABOVE_LIMIT");
    expect(review.reason).toBe("ONE_OR_MORE_COHORTS_ABOVE_NUMERIC_LIMIT");
  });

  it("fails closed without hardware or verified source-byte provenance", () => {
    const noHardware = {
      ...manifest(),
      hardware: { ...manifest().hardware, cpuModel: "" },
    };
    expect(inspectP17AcceptanceRun(noHardware, completeAttempts()).reason).toBe(
      "HARDWARE_IDENTITY_MISSING_OR_INVALID",
    );

    const unverifiedCommit = {
      ...manifest(),
      commitVerification: {
        state: "NOT_VERIFIED" as const,
        method: "NOT_AVAILABLE" as const,
        observedCommit: null,
      },
    };
    expect(inspectP17AcceptanceRun(unverifiedCommit, completeAttempts()).reason).toBe(
      "SOURCE_BYTES_VERIFIED_COMMIT_IDENTITY_NOT_VERIFIED",
    );

    const unverifiedSource = {
      ...manifest(),
      sourceVerification: {
        state: "NOT_VERIFIED" as const,
        method: "NOT_AVAILABLE" as const,
        observedSha256: null,
      },
    };
    expect(inspectP17AcceptanceRun(unverifiedSource, completeAttempts()).reason).toBe(
      "SOURCE_BYTES_NOT_VERIFIED",
    );
  });

  it("rejects incomplete coverage and never emits Gate D PASS", () => {
    const incomplete = completeAttempts().filter(
      (attempt) => !(attempt.indicator === "PR04" && attempt.viewport === "desktop"),
    );
    const serialized = JSON.stringify(inspectP17AcceptanceRun(manifest(), incomplete));
    expect(serialized).toContain("REQUIRED_COHORT_COVERAGE_INCOMPLETE");
    expect(serialized).not.toContain('"gateD":"PASS"');
  });
});
