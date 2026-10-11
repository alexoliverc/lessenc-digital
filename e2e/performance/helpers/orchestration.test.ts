import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { P17_REQUIRED_COHORTS } from "./acceptance-policy";
import { evaluateCalibrationProbes } from "./calibration";
import { PERFORMANCE_NETWORK_PROFILE } from "./network-profile";
import {
  assertPerformanceCollectionAuthorized,
  createAttemptEvidence,
  createP17ExecutionPlan,
  inspectP17CalibrationPackage,
  serializeP17AcceptancePackage,
  verifyReadOnlyGitHead,
  verifySourceTree,
} from "./orchestration";

describe("P17 performance orchestration contract", () => {
  it("plans all 645 attempts without mixing cohorts", () => {
    const plan = createP17ExecutionPlan();
    expect(plan).toHaveLength(15 * 43);
    expect(plan.filter((item) => item.phase === "WARMUP")).toHaveLength(45);
    expect(plan.filter((item) => item.phase === "MEASUREMENT")).toHaveLength(600);
    expect(new Set(plan.map((item) => item.cohortKey)).size).toBe(15);
  });

  it("keeps runtime activation fail-closed outside the exact local contract", () => {
    expect(() => assertPerformanceCollectionAuthorized()).toThrow(/P17_PERFORMANCE_/u);
  });

  it("recomputes all fifteen cohort calibrations from exactly three raw probes", () => {
    const calibration = evaluateCalibrationProbes({
      downloadBitsPerSecond: [9_900_000, 10_000_000, 10_100_000],
      uploadBitsPerSecond: [1_980_000, 2_000_000, 2_020_000],
      roundTripTimeMs: [79, 80, 81],
    });
    const review = inspectP17CalibrationPackage(
      P17_REQUIRED_COHORTS.map((cohort) => ({ cohort, calibration })),
    );
    expect(review).toMatchObject({
      state: "STRUCTURALLY_COMPLETE_ONLY",
      cohortCount: 15,
      downloadProbeCount: 45,
      uploadProbeCount: 45,
      roundTripProbeCount: 45,
    });
  });

  it("does not mark an uncalibrated observation valid", () => {
    const planned = createP17ExecutionPlan()[0]!;
    const evidence = createAttemptEvidence({
      plan: planned,
      runId: "p17-perf-orchestration-test",
      commit: "d73b2d678686fc805c6eb5f26a852ae60f870b91",
      browserVersion: "153.0.8010.12",
      playwrightVersion: "1.63.0",
      metric: { state: "VALID", valueMs: 100 },
      calibration: {
        schemaVersion: 1,
        method: "BROWSER_LOOPBACK_PROBES",
        configuredProfileApplied: true,
        downloadProbeCount: 3,
        uploadProbeCount: 3,
        roundTripProbeCount: 3,
        probes: {
          downloadBitsPerSecond: [5_000_000, 5_000_000, 5_000_000],
          uploadBitsPerSecond: [2_000_000, 2_000_000, 2_000_000],
          roundTripTimeMs: [80, 80, 80],
        },
        observed: { ...PERFORMANCE_NETWORK_PROFILE, downloadBitsPerSecond: 5_000_000 },
        evaluation: {
          state: "BLOCKED",
          reason: "CALIBRATION_OUT_OF_RANGE",
          tolerance: 0.1,
        },
      },
      isolation: {
        configuration: "VALIDATED",
        capsule: "OPERATIONALLY_PROVEN",
        browserEgress: "BLOCKED_BY_CAPSULE",
        nodeEgress: "BLOCKED_BY_CAPSULE",
      },
    });
    expect(evidence.state).toBe("BLOCKED");
    expect(evidence.reason).toBe("CALIBRATION_NOT_PROVEN");
  });

  it("rejects sensitive fields from a final package", () => {
    const unsafeManifest = {
      schemaVersion: 1,
      policyId: "LES-P17-PERFORMANCE-BUDGET-R01",
      runId: "p17-perf-sensitive-field-test",
      commit: "d73b2d678686fc805c6eb5f26a852ae60f870b91",
      sourceTreeSha256: "a".repeat(64),
      browser: { engine: "chromium", version: "153.0.0", playwrightVersion: "1.63.0" },
      nodeVersion: "24.21.0",
      environment: "ISOLATED_LOCAL_CAPSULE",
      hardware: {
        platform: "linux",
        architecture: "x64",
        cpuModel: "Synthetic",
        logicalCpuCount: 4,
        totalMemoryBytes: 8_000_000_000,
      },
      commitVerification: {
        state: "VERIFIED",
        method: "READ_ONLY_GIT_HEAD_AND_CLEAN_WORKTREE",
        observedCommit: "d73b2d678686fc805c6eb5f26a852ae60f870b91",
      },
      sourceVerification: {
        state: "VERIFIED",
        method: "READ_ONLY_SOURCE_TREE_SHA256",
        observedSha256: "a".repeat(64),
      },
      calibrationVerification: {
        state: "BROWSER_LOOPBACK_OBSERVED",
        method: "BROWSER_LOOPBACK_PROBES",
        cohortCount: 15,
        downloadProbeCount: 45,
        uploadProbeCount: 45,
        roundTripProbeCount: 45,
      },
      token: "must-not-serialize",
    } as never;
    expect(() => serializeP17AcceptancePackage(unsafeManifest, [], [])).toThrow(
      "P17_EVIDENCE_SENSITIVE_FIELD_FORBIDDEN",
    );
  });

  it("never treats a declared commit as source-byte proof", () => {
    const directory = mkdtempSync(join(tmpdir(), "p17-provenance-"));
    const commit = "d73b2d678686fc805c6eb5f26a852ae60f870b91";
    const sourceTreeSha256 = "a".repeat(64);
    try {
      writeFileSync(join(directory, ".p17-declared-commit"), `${commit}\n`, "utf8");
      writeFileSync(join(directory, ".p17-source-tree.sha256"), `${sourceTreeSha256}\n`, "utf8");

      expect(verifyReadOnlyGitHead(directory, commit)).toEqual({
        state: "NOT_VERIFIED",
        method: "DECLARED_COMMIT_FILE_ONLY",
        observedCommit: commit,
      });
      expect(verifySourceTree(directory, sourceTreeSha256)).toEqual({
        state: "VERIFIED",
        method: "READ_ONLY_SOURCE_TREE_SHA256",
        observedSha256: sourceTreeSha256,
      });
      expect(verifySourceTree(directory, "b".repeat(64)).state).toBe("NOT_VERIFIED");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
