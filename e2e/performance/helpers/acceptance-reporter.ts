import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

import { inspectP17AcceptanceRun } from "./acceptance-run";
import { assertSanitizedEvidenceObject, type AttemptEvidence } from "./evidence";
import {
  createRunManifest,
  inspectP17CalibrationPackage,
  serializeP17AcceptancePackage,
  type P17CohortCalibrationEvidence,
} from "./orchestration";
import { p17CohortKey, type P17PerformanceCohort } from "./acceptance-policy";
import type { NetworkCalibrationEvidence } from "./calibration";
import type { PerformanceCohortCollection } from "./spec-support";

type ReporterOptions = Readonly<{
  outputFile?: string;
  scope?: "FULL" | "PR03_PIX_MOBILE";
  repositoryRoot?: string;
}>;

const attachmentName = /^p17-(mobile|tablet|desktop)-pr0[1-4](?:-(pix|credit_card))?-attempts$/u;
const calibrationAttachmentName =
  /^p17-(mobile|tablet|desktop)-pr0([1-4])(?:-(pix|credit_card))?-network-calibration$/u;
const safeRunId = /^p17-perf-[a-z0-9][a-z0-9._-]{7,80}$/u;
const safeCommit = /^[0-9a-f]{40}$/u;
const safeSha256 = /^[0-9a-f]{64}$/u;
const safeImageDigest = /^sha256:[0-9a-f]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readAttachment(attachment: TestResult["attachments"][number]): unknown {
  const bytes =
    attachment.body ?? (attachment.path === undefined ? null : readFileSync(attachment.path));
  if (bytes === null) throw new Error("P17_ACCEPTANCE_ATTACHMENT_BODY_MISSING");
  return JSON.parse(bytes.toString("utf8")) as unknown;
}

function parseCollection(value: unknown): PerformanceCohortCollection {
  assertSanitizedEvidenceObject(value);
  if (
    !isRecord(value) ||
    !isRecord(value.cohort) ||
    !isRecord(value.calibration) ||
    !Array.isArray(value.attempts)
  ) {
    throw new Error("P17_ACCEPTANCE_ATTACHMENT_SCHEMA_INVALID");
  }
  return value as unknown as PerformanceCohortCollection;
}

function parseCalibration(value: unknown): NetworkCalibrationEvidence {
  assertSanitizedEvidenceObject(value);
  if (!isRecord(value) || value.schemaVersion !== 1 || value.method !== "BROWSER_LOOPBACK_PROBES") {
    throw new Error("P17_CALIBRATION_ATTACHMENT_SCHEMA_INVALID");
  }
  return value as unknown as NetworkCalibrationEvidence;
}

function cohortFromCalibrationAttachment(name: string): P17PerformanceCohort | null {
  const match = calibrationAttachmentName.exec(name);
  if (!match) return null;
  const viewport = match[1];
  const indicator = match[2];
  const flow = match[3];
  if (
    (viewport !== "mobile" && viewport !== "tablet" && viewport !== "desktop") ||
    (indicator !== "1" && indicator !== "2" && indicator !== "3" && indicator !== "4")
  ) {
    return null;
  }
  return Object.freeze({
    indicator: `PR0${indicator}` as P17PerformanceCohort["indicator"],
    viewport,
    ...(flow === undefined
      ? {}
      : { flow: flow === "pix" ? ("PIX" as const) : ("CREDIT_CARD" as const) }),
  });
}

function firstValid(value: string | undefined, pattern: RegExp): string | null {
  return value !== undefined && pattern.test(value) ? value : null;
}

function hardwareIdentity() {
  const processors = cpus();
  return Object.freeze({
    platform: process.platform,
    architecture: process.arch,
    cpuModel: processors[0]?.model.trim() ?? "",
    logicalCpuCount: processors.length,
    totalMemoryBytes: totalmem(),
  });
}

export default class P17AcceptanceReporter implements Reporter {
  private readonly outputFile: string;
  private readonly scope: "FULL" | "PR03_PIX_MOBILE";
  private readonly repositoryRoot: string;
  private readonly collections: PerformanceCohortCollection[] = [];
  private readonly calibrations = new Map<string, P17CohortCalibrationEvidence>();
  private readonly failures = new Set<string>();

  constructor(options: ReporterOptions = {}) {
    const outputRoot = resolve(process.cwd(), "output", "p17-performance");
    const candidate = resolve(options.outputFile ?? resolve(outputRoot, "acceptance-package.json"));
    const relation = relative(outputRoot, candidate);
    if (relation.startsWith("..") || isAbsolute(relation)) {
      throw new Error("P17_ACCEPTANCE_REPORT_PATH_INVALID");
    }
    this.outputFile = candidate;
    this.repositoryRoot = resolve(options.repositoryRoot ?? process.cwd());
    this.scope = options.scope ?? "FULL";
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    if (result.status !== "passed") this.failures.add("TEST_RESULT_NOT_PASSED");

    const attachments = result.attachments.filter(
      (attachment) =>
        attachment.contentType === "application/json" && attachmentName.test(attachment.name),
    );
    if (attachments.length > 1 || (result.status === "passed" && attachments.length !== 1)) {
      this.failures.add("COHORT_ATTACHMENT_COUNT_INVALID");
    }

    if (attachments.length === 1) {
      try {
        const collection = parseCollection(readAttachment(attachments[0]!));
        this.collections.push(collection);
        this.calibrations.set(
          p17CohortKey(collection.cohort),
          Object.freeze({ cohort: collection.cohort, calibration: collection.calibration }),
        );
      } catch {
        this.failures.add("COHORT_ATTACHMENT_REJECTED");
      }
    }

    for (const attachment of result.attachments.filter(
      (candidate) =>
        candidate.contentType === "application/json" &&
        calibrationAttachmentName.test(candidate.name),
    )) {
      try {
        const cohort = cohortFromCalibrationAttachment(attachment.name);
        if (cohort === null) throw new Error("P17_CALIBRATION_ATTACHMENT_NAME_INVALID");
        this.calibrations.set(
          p17CohortKey(cohort),
          Object.freeze({ cohort, calibration: parseCalibration(readAttachment(attachment)) }),
        );
      } catch {
        this.failures.add("CALIBRATION_ATTACHMENT_REJECTED");
      }
    }
  }

  async onEnd(result: FullResult): Promise<{ status?: FullResult["status"] }> {
    mkdirSync(dirname(this.outputFile), { recursive: true, mode: 0o700 });

    try {
      if (result.status !== "passed") this.failures.add("PLAYWRIGHT_RUN_NOT_PASSED");

      if (this.scope === "PR03_PIX_MOBILE") {
        const collection = this.collections[0];
        const selectiveValid =
          this.failures.size === 0 &&
          this.collections.length === 1 &&
          collection !== undefined &&
          p17CohortKey(collection.cohort) === "PR03:PIX:mobile" &&
          collection.calibration.evaluation.state === "VALID" &&
          collection.attempts.length === 43 &&
          collection.attempts.slice(0, 3).every((attempt) => attempt.state === "WARMUP_VALID") &&
          collection.attempts.slice(3).every((attempt) => attempt.state === "VALID");

        if (!selectiveValid) {
          this.failures.add("SELECTIVE_SCOPE_RESULT_INVALID");
          this.writeNotProven("FAIL");
          return { status: "failed" };
        }

        this.failures.add("FULL_ACCEPTANCE_SCOPE_NOT_EXECUTED");
        this.writeNotProven("PASS");
        return {};
      }

      if (this.collections.length !== 15) this.failures.add("COHORT_COLLECTION_COUNT_INVALID");

      if (this.failures.size > 0) {
        this.writeNotProven();
        return { status: "failed" };
      }

      const attempts = this.collections.flatMap((collection) => collection.attempts);
      const calibrations = [...this.calibrations.values()];
      const first: AttemptEvidence | undefined = attempts[0];
      if (first === undefined) {
        this.failures.add("ATTEMPT_EVIDENCE_EMPTY");
        this.writeNotProven();
        return { status: "failed" };
      }

      const manifest = createRunManifest({
        runId: first.runId,
        commit: first.commit,
        sourceTreeSha256: process.env.P17_SOURCE_TREE_SHA256 ?? "",
        imageDigest: process.env.P17_OCI_IMAGE_DIGEST ?? "",
        browserVersion: first.browser.version,
        playwrightVersion: first.browser.playwrightVersion,
        nodeVersion: process.versions.node,
        repositoryRoot: this.repositoryRoot,
        calibrations,
      });
      const calibrationReview = inspectP17CalibrationPackage(calibrations);
      const acceptanceReview = inspectP17AcceptanceRun(manifest, attempts);
      const serialized = serializeP17AcceptancePackage(manifest, attempts, calibrations);
      writeFileSync(this.outputFile, serialized, { encoding: "utf8", mode: 0o600 });

      if (
        calibrationReview.state !== "STRUCTURALLY_COMPLETE_ONLY" ||
        acceptanceReview.state !== "PROVISIONAL_NUMERIC_REVIEW_ONLY" ||
        acceptanceReview.numericResult !== "ALL_COHORTS_WITHIN_LIMIT"
      ) {
        return { status: "failed" };
      }

      return {};
    } catch {
      this.failures.add("ACCEPTANCE_PACKAGE_ASSEMBLY_FAILED");
      this.writeNotProven();
      return { status: "failed" };
    }
  }

  private writeNotProven(selectiveResult?: "PASS" | "FAIL"): void {
    const attempts = this.collections.flatMap((collection) => collection.attempts);
    const first = attempts[0];
    const runId = first?.runId ?? firstValid(process.env.P17_PERF_RUN_ID, safeRunId);
    const commit = first?.commit ?? firstValid(process.env.P17_PERF_COMMIT, safeCommit);
    const sourceTreeSha256 = firstValid(process.env.P17_SOURCE_TREE_SHA256, safeSha256);
    const imageDigest = firstValid(process.env.P17_OCI_IMAGE_DIGEST, safeImageDigest);
    const browserVersion =
      first?.browser.version ??
      firstValid(process.env.P17_EXPECTED_CHROMIUM_VERSION, /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u);
    const playwrightVersion =
      first?.browser.playwrightVersion ??
      firstValid(
        process.env.P17_EXPECTED_PLAYWRIGHT_VERSION,
        /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u,
      );
    const value = Object.freeze({
      schemaVersion: 2,
      state: "NOT_PROVEN",
      authority: "PROVISIONAL_LOCAL_NUMERIC_REVIEW_ONLY",
      gateD: "NOT_READY",
      production: "UNAUTHORIZED",
      executionScope: this.scope,
      ...(selectiveResult === undefined ? {} : { selectiveResult }),
      identity: Object.freeze({
        runId,
        declaredCommit: commit,
        sourceTreeSha256,
        imageDigest,
        browser: Object.freeze({ engine: "chromium", version: browserVersion, playwrightVersion }),
        nodeVersion: process.versions.node,
        environment: "ISOLATED_LOCAL_CAPSULE",
        hardware: hardwareIdentity(),
      }),
      collectionCount: this.collections.length,
      calibrationCount: this.calibrations.size,
      attemptCount: attempts.length,
      calibrations: Object.freeze([...this.calibrations.values()]),
      attempts: Object.freeze(attempts),
      reasonCodes: Object.freeze([...this.failures].sort()),
    });
    assertSanitizedEvidenceObject(value);
    writeFileSync(this.outputFile, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}
