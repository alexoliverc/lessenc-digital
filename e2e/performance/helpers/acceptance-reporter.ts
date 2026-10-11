import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
import type { PerformanceCohortCollection } from "./spec-support";

type ReporterOptions = Readonly<{ outputFile?: string }>;

const attachmentName = /^p17-(mobile|tablet|desktop)-pr0[1-4](?:-(pix|credit_card))?-attempts$/u;

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

export default class P17AcceptanceReporter implements Reporter {
  private readonly outputFile: string;
  private readonly collections: PerformanceCohortCollection[] = [];
  private readonly failures = new Set<string>();

  constructor(options: ReporterOptions = {}) {
    const outputRoot = resolve(process.cwd(), "output", "p17-performance");
    const candidate = resolve(options.outputFile ?? resolve(outputRoot, "acceptance-package.json"));
    const relation = relative(outputRoot, candidate);
    if (relation.startsWith("..") || isAbsolute(relation)) {
      throw new Error("P17_ACCEPTANCE_REPORT_PATH_INVALID");
    }
    this.outputFile = candidate;
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    if (result.status !== "passed") {
      this.failures.add("TEST_RESULT_NOT_PASSED");
      return;
    }

    const attachments = result.attachments.filter(
      (attachment) =>
        attachment.contentType === "application/json" && attachmentName.test(attachment.name),
    );
    if (attachments.length !== 1) {
      this.failures.add("COHORT_ATTACHMENT_COUNT_INVALID");
      return;
    }

    try {
      this.collections.push(parseCollection(readAttachment(attachments[0]!)));
    } catch {
      this.failures.add("COHORT_ATTACHMENT_REJECTED");
    }
  }

  async onEnd(result: FullResult): Promise<{ status?: FullResult["status"] }> {
    mkdirSync(dirname(this.outputFile), { recursive: true, mode: 0o700 });

    try {
      if (result.status !== "passed") this.failures.add("PLAYWRIGHT_RUN_NOT_PASSED");
      if (this.collections.length !== 15) this.failures.add("COHORT_COLLECTION_COUNT_INVALID");

      if (this.failures.size > 0) {
        this.writeNotProven();
        return { status: "failed" };
      }

      const attempts = this.collections.flatMap((collection) => collection.attempts);
      const calibrations: P17CohortCalibrationEvidence[] = this.collections.map((collection) =>
        Object.freeze({ cohort: collection.cohort, calibration: collection.calibration }),
      );
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
        browserVersion: first.browser.version,
        playwrightVersion: first.browser.playwrightVersion,
        nodeVersion: process.versions.node,
        repositoryRoot: process.cwd(),
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

  private writeNotProven(): void {
    const value = Object.freeze({
      schemaVersion: 1,
      state: "NOT_PROVEN",
      authority: "PROVISIONAL_LOCAL_NUMERIC_REVIEW_ONLY",
      gateD: "NOT_READY",
      production: "UNAUTHORIZED",
      collectionCount: this.collections.length,
      reasonCodes: Object.freeze([...this.failures].sort()),
    });
    assertSanitizedEvidenceObject(value);
    writeFileSync(this.outputFile, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}
