import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import P17AcceptanceReporter from "./acceptance-reporter";
import { P17_REQUIRED_COHORTS, p17CohortKey } from "./acceptance-policy";
import { evaluateCalibrationProbes } from "./calibration";
import { createAttemptEvidence, createP17ExecutionPlan } from "./orchestration";
import type { PerformanceCohortCollection } from "./spec-support";

const repositoryRoot = process.cwd();
const temporaryPaths: string[] = [];
const originalEnvironment = { ...process.env };

const commit = "e484f35352ec9bcedde645239342e15d3327cc25";
const sourceTreeSha256 = "a".repeat(64);
const imageDigest = `sha256:${"b".repeat(64)}`;
const runId = "p17-perf-reporter-behavior-test";

function validCalibration() {
  return evaluateCalibrationProbes({
    downloadBitsPerSecond: [9_900_000, 10_000_000, 10_100_000],
    uploadBitsPerSecond: [1_980_000, 2_000_000, 2_020_000],
    roundTripTimeMs: [79, 80, 81],
  });
}

function collectionForCohort(
  cohort: (typeof P17_REQUIRED_COHORTS)[number],
  attemptCount = 43,
): PerformanceCohortCollection {
  const calibration = validCalibration();
  const plans = createP17ExecutionPlan()
    .filter((entry) => entry.cohortKey === p17CohortKey(cohort))
    .slice(0, attemptCount);
  const attempts = plans.map((plan) =>
    createAttemptEvidence({
      plan,
      runId,
      commit,
      browserVersion: "153.0.8010.12",
      playwrightVersion: "1.63.0",
      metric: { state: "VALID", valueMs: 100 },
      calibration,
      isolation: {
        configuration: "VALIDATED",
        capsule: "OPERATIONALLY_PROVEN",
        browserEgress: "BLOCKED_BY_CAPSULE",
        nodeEgress: "BLOCKED_BY_CAPSULE",
      },
    }),
  );
  return Object.freeze({ cohort, calibration, attempts: Object.freeze(attempts) });
}

function attachmentName(cohort: (typeof P17_REQUIRED_COHORTS)[number]): string {
  const flow = cohort.flow === undefined ? "" : `-${cohort.flow.toLowerCase()}`;
  return `p17-${cohort.viewport}-${cohort.indicator.toLowerCase()}${flow}-attempts`;
}

function testResult(collection: PerformanceCohortCollection, status: "passed" | "failed") {
  return {
    status,
    attachments: [
      {
        name: attachmentName(collection.cohort),
        contentType: "application/json",
        body: Buffer.from(`${JSON.stringify(collection)}\n`, "utf8"),
      },
    ],
  } as never;
}

function createOutput(): { outputFile: string; directory: string } {
  const directory = resolve(
    repositoryRoot,
    "output",
    "p17-performance",
    `reporter-test-${randomUUID()}`,
  );
  mkdirSync(directory, { recursive: true });
  temporaryPaths.push(directory);
  return { directory, outputFile: resolve(directory, "acceptance-package.json") };
}

function createProvenanceSandbox(): {
  directory: string;
  sourceFile: string;
  bundleFile: string;
  sourceBytes: Buffer;
  bundleBytes: Buffer;
} {
  const directory = mkdtempSync(resolve(tmpdir(), "p17-reporter-provenance-"));
  temporaryPaths.push(directory);
  const sourceFile = resolve(directory, ".p17-source-tree.sha256");
  const bundleFile = resolve(directory, ".p17-source-provenance.json");
  const sourceBytes = Buffer.from(`${sourceTreeSha256}\n`, "utf8");
  const bundleBytes = Buffer.from(
    `${JSON.stringify({ schemaVersion: 2, digest: sourceTreeSha256 })}\n`,
    "utf8",
  );
  writeFileSync(sourceFile, sourceBytes);
  writeFileSync(bundleFile, bundleBytes);
  return { directory, sourceFile, bundleFile, sourceBytes, bundleBytes };
}

function configureProvenance(): void {
  process.env.P17_PERF_RUN_ID = runId;
  process.env.P17_PERF_COMMIT = commit;
  process.env.P17_SOURCE_TREE_SHA256 = sourceTreeSha256;
  process.env.P17_OCI_IMAGE_DIGEST = imageDigest;
  process.env.P17_EXPECTED_CHROMIUM_VERSION = "153.0.8010.12";
  process.env.P17_EXPECTED_PLAYWRIGHT_VERSION = "1.63.0";
}

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
  while (temporaryPaths.length > 0) {
    rmSync(temporaryPaths.pop()!, { recursive: true, force: true });
  }
});

describe("P17 acceptance reporter evidence preservation", () => {
  it("writes the complete package on a successful fifteen-cohort run", async () => {
    configureProvenance();
    const { outputFile } = createOutput();
    const provenance = createProvenanceSandbox();
    const reporter = new P17AcceptanceReporter({
      outputFile,
      repositoryRoot: provenance.directory,
    });

    for (const cohort of P17_REQUIRED_COHORTS) {
      reporter.onTestEnd({} as never, testResult(collectionForCohort(cohort), "passed"));
    }

    await expect(reporter.onEnd({ status: "passed" } as never)).resolves.toEqual({});
    const evidence = JSON.parse(readFileSync(outputFile, "utf8")) as Record<string, unknown>;
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      gateD: "NOT_READY",
      production: "UNAUTHORIZED",
      manifest: { runId, sourceTreeSha256, imageDigest },
      review: {
        state: "PROVISIONAL_NUMERIC_REVIEW_ONLY",
        numericResult: "ALL_COHORTS_WITHIN_LIMIT",
      },
    });
    expect(evidence.attempts).toHaveLength(645);
    expect(evidence.calibrations).toHaveLength(15);
    expect(readFileSync(provenance.sourceFile)).toEqual(provenance.sourceBytes);
    expect(readFileSync(provenance.bundleFile)).toEqual(provenance.bundleBytes);
  });

  it("preserves preexisting provenance through an intermediate attachment failure", async () => {
    configureProvenance();
    const { outputFile } = createOutput();
    const provenance = createProvenanceSandbox();
    const reporter = new P17AcceptanceReporter({
      outputFile,
      repositoryRoot: provenance.directory,
    });
    reporter.onTestEnd(
      {} as never,
      {
        status: "passed",
        attachments: [
          {
            name: "p17-mobile-pr01-attempts",
            contentType: "application/json",
            body: Buffer.from("{not-json", "utf8"),
          },
        ],
      } as never,
    );

    await expect(reporter.onEnd({ status: "passed" } as never)).resolves.toEqual({
      status: "failed",
    });
    expect(readFileSync(provenance.sourceFile)).toEqual(provenance.sourceBytes);
    expect(readFileSync(provenance.bundleFile)).toEqual(provenance.bundleBytes);
  });

  it("removes only disposable reporter output during cleanup", () => {
    const { directory } = createOutput();
    const provenance = createProvenanceSandbox();
    writeFileSync(resolve(directory, "partial-evidence.json"), "{}\n");

    rmSync(directory, { recursive: true, force: true });

    expect(existsSync(directory)).toBe(false);
    expect(readFileSync(provenance.sourceFile)).toEqual(provenance.sourceBytes);
    expect(readFileSync(provenance.bundleFile)).toEqual(provenance.bundleBytes);
  });

  it("preserves partial attempts, calibration and identities after failure", async () => {
    configureProvenance();
    const { outputFile } = createOutput();
    const reporter = new P17AcceptanceReporter({ outputFile });
    reporter.onTestEnd(
      {} as never,
      testResult(collectionForCohort(P17_REQUIRED_COHORTS[0]!, 1), "failed"),
    );

    await expect(reporter.onEnd({ status: "failed" } as never)).resolves.toEqual({
      status: "failed",
    });
    const evidence = JSON.parse(readFileSync(outputFile, "utf8")) as Record<string, unknown>;
    expect(evidence).toMatchObject({
      schemaVersion: 2,
      state: "NOT_PROVEN",
      identity: {
        runId,
        declaredCommit: commit,
        sourceTreeSha256,
        imageDigest,
        browser: {
          engine: "chromium",
          version: "153.0.8010.12",
          playwrightVersion: "1.63.0",
        },
      },
      collectionCount: 1,
      calibrationCount: 1,
      attemptCount: 1,
    });
    expect(evidence.calibrations).toHaveLength(1);
    expect(evidence.attempts).toHaveLength(1);
    expect(evidence.reasonCodes).toEqual(
      expect.arrayContaining([
        "COHORT_COLLECTION_COUNT_INVALID",
        "PLAYWRIGHT_RUN_NOT_PASSED",
        "TEST_RESULT_NOT_PASSED",
      ]),
    );
  });

  it("passes a valid selective PR03 PIX mobile diagnostic while preserving global NOT_PROVEN", async () => {
    configureProvenance();
    const { outputFile } = createOutput();
    const reporter = new P17AcceptanceReporter({ outputFile, scope: "PR03_PIX_MOBILE" });
    const cohort = P17_REQUIRED_COHORTS.find(
      (candidate) => p17CohortKey(candidate) === "PR03:PIX:mobile",
    );
    expect(cohort).toBeDefined();
    reporter.onTestEnd({} as never, testResult(collectionForCohort(cohort!), "passed"));

    await expect(reporter.onEnd({ status: "passed" } as never)).resolves.toEqual({});
    const evidence = JSON.parse(readFileSync(outputFile, "utf8")) as Record<string, unknown>;
    expect(evidence).toMatchObject({
      schemaVersion: 2,
      state: "NOT_PROVEN",
      executionScope: "PR03_PIX_MOBILE",
      selectiveResult: "PASS",
      collectionCount: 1,
      attemptCount: 43,
      reasonCodes: ["FULL_ACCEPTANCE_SCOPE_NOT_EXECUTED"],
    });
  });

  it("fails a selective run that collected the wrong cohort", async () => {
    configureProvenance();
    const { outputFile } = createOutput();
    const reporter = new P17AcceptanceReporter({ outputFile, scope: "PR03_PIX_MOBILE" });
    reporter.onTestEnd(
      {} as never,
      testResult(collectionForCohort(P17_REQUIRED_COHORTS[0]!), "passed"),
    );

    await expect(reporter.onEnd({ status: "passed" } as never)).resolves.toEqual({
      status: "failed",
    });
    const evidence = JSON.parse(readFileSync(outputFile, "utf8")) as Record<string, unknown>;
    expect(evidence).toMatchObject({
      state: "NOT_PROVEN",
      executionScope: "PR03_PIX_MOBILE",
      selectiveResult: "FAIL",
    });
    expect(evidence.reasonCodes).toEqual(["SELECTIVE_SCOPE_RESULT_INVALID"]);
  });

  it("records missing provenance explicitly instead of dropping the report", async () => {
    delete process.env.P17_PERF_RUN_ID;
    delete process.env.P17_PERF_COMMIT;
    delete process.env.P17_SOURCE_TREE_SHA256;
    delete process.env.P17_OCI_IMAGE_DIGEST;
    delete process.env.P17_EXPECTED_CHROMIUM_VERSION;
    delete process.env.P17_EXPECTED_PLAYWRIGHT_VERSION;
    const { outputFile } = createOutput();
    const reporter = new P17AcceptanceReporter({ outputFile });

    await reporter.onEnd({ status: "failed" } as never);
    const evidence = JSON.parse(readFileSync(outputFile, "utf8")) as Record<string, unknown>;
    expect(evidence.identity).toMatchObject({
      runId: null,
      declaredCommit: null,
      sourceTreeSha256: null,
      imageDigest: null,
      browser: { engine: "chromium", version: null, playwrightVersion: null },
    });
    expect(evidence.attempts).toEqual([]);
    expect(evidence.calibrations).toEqual([]);
    expect(evidence.state).toBe("NOT_PROVEN");
  });
});
