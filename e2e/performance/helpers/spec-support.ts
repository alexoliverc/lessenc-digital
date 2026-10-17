import { createRequire } from "node:module";
import { resolve } from "node:path";

import type { Browser, Page, TestInfo } from "@playwright/test";

import { type P17PerformanceCohort, p17CohortKey } from "./acceptance-policy";
import { installPerformanceObservers, type BrowserMetricResult } from "./browser-metrics";
import { installPerformanceRequestGuard } from "./browser-network-guard";
import {
  collectNetworkCalibration,
  collectRoundTripBaseline,
  type NetworkCalibrationEvidence,
} from "./calibration";
import type { AttemptEvidence, IsolationEvidenceState } from "./evidence";
import { establishPerformanceIsolationEvidence, PERFORMANCE_BASE_URL } from "./isolation";
import { applyPerformanceNetworkProfile } from "./network-profile";
import { createAttemptEvidence, createP17ExecutionPlan } from "./orchestration";

const require = createRequire(resolve(process.cwd(), "package.json"));
const playwrightPackage = require("@playwright/test/package.json") as { version?: unknown };

export type PerformanceAttemptContext = Readonly<{
  page: Page;
  attempt: number;
  phase: "WARMUP" | "MEASUREMENT";
}>;

export type PerformanceCohortCollection = Readonly<{
  cohort: P17PerformanceCohort;
  calibration: NetworkCalibrationEvidence;
  attempts: readonly AttemptEvidence[];
}>;

export function performanceCollectionAttachmentName(cohort: P17PerformanceCohort): string {
  const flow = cohort.flow === undefined ? "" : `-${cohort.flow.toLowerCase()}`;
  return `p17-${cohort.viewport}-${cohort.indicator.toLowerCase()}${flow}-attempts`;
}

function requiredIdentity(name: string, value: string | undefined, pattern: RegExp): string {
  if (!value || !pattern.test(value)) {
    throw new Error(`P17_PERFORMANCE_${name}_INVALID`);
  }
  return value;
}

function viewportForProject(projectName: string): Readonly<{ width: number; height: number }> {
  switch (projectName) {
    case "chromium-mobile":
      return Object.freeze({ width: 390, height: 844 });
    case "chromium-tablet":
      return Object.freeze({ width: 768, height: 1024 });
    case "chromium-desktop":
      return Object.freeze({ width: 1440, height: 900 });
    default:
      throw new Error("P17_PERFORMANCE_PROJECT_INVALID");
  }
}

export function cohortForProject(
  testInfo: TestInfo,
  indicator: P17PerformanceCohort["indicator"],
  flow?: P17PerformanceCohort["flow"],
): P17PerformanceCohort {
  const viewport = testInfo.project.name.replace("chromium-", "");
  if (viewport !== "mobile" && viewport !== "tablet" && viewport !== "desktop") {
    throw new Error("P17_PERFORMANCE_VIEWPORT_INVALID");
  }

  return Object.freeze({
    indicator,
    viewport,
    ...(flow === undefined ? {} : { flow }),
  });
}

export async function collectPerformanceCohort(
  input: Readonly<{
    browser: Browser;
    testInfo: TestInfo;
    cohort: P17PerformanceCohort;
    measure: (context: PerformanceAttemptContext) => Promise<BrowserMetricResult>;
  }>,
): Promise<PerformanceCohortCollection> {
  const runId = requiredIdentity(
    "RUN_ID",
    process.env.P17_PERF_RUN_ID,
    /^p17-perf-[a-z0-9][a-z0-9._-]{7,80}$/u,
  );
  const commit = requiredIdentity("COMMIT", process.env.P17_PERF_COMMIT, /^[0-9a-f]{40}$/u);
  const playwrightVersion = requiredIdentity(
    "PLAYWRIGHT_VERSION",
    typeof playwrightPackage.version === "string" ? playwrightPackage.version : undefined,
    /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u,
  );
  const browserVersion = input.browser.version();
  const viewport = viewportForProject(input.testInfo.project.name);
  const selectedPlan = createP17ExecutionPlan().filter(
    (planned) => planned.cohortKey === p17CohortKey(input.cohort),
  );

  if (selectedPlan.length !== 43) {
    throw new Error("P17_PERFORMANCE_COHORT_PLAN_INVALID");
  }

  const provenIsolation: IsolationEvidenceState = await establishPerformanceIsolationEvidence(
    input.browser,
  );

  const calibrationContext = await input.browser.newContext({
    viewport,
    baseURL: PERFORMANCE_BASE_URL,
    serviceWorkers: "block",
    // The application CSP intentionally limits connect-src. This isolated context measures only
    // the separately guarded loopback calibration service; measurement contexts keep CSP enabled.
    bypassCSP: true,
  });
  let calibration: NetworkCalibrationEvidence;
  try {
    await installPerformanceObservers(calibrationContext);
    const page = await calibrationContext.newPage();
    await installPerformanceRequestGuard(page);
    const session = await calibrationContext.newCDPSession(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const baselineRoundTripTimeMs = await collectRoundTripBaseline(page);
    await applyPerformanceNetworkProfile(session);
    calibration = await collectNetworkCalibration(page, baselineRoundTripTimeMs);
  } finally {
    await calibrationContext.close();
  }

  await input.testInfo.attach(`p17-${p17CohortKey(input.cohort)}-network-calibration`, {
    body: Buffer.from(`${JSON.stringify(calibration, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });

  const attempts: AttemptEvidence[] = [];

  try {
    if (calibration.evaluation.state !== "VALID") {
      throw new Error("P17_PERFORMANCE_CALIBRATION_NOT_VALID");
    }

    for (const planned of selectedPlan) {
      const context = await input.browser.newContext({
        viewport,
        baseURL: PERFORMANCE_BASE_URL,
        serviceWorkers: "block",
      });

      try {
        await installPerformanceObservers(context);
        const page = await context.newPage();
        await installPerformanceRequestGuard(page);
        const session = await context.newCDPSession(page);
        await applyPerformanceNetworkProfile(session);

        let metric: BrowserMetricResult;
        try {
          metric = await input.measure({
            page,
            attempt: planned.attempt,
            phase: planned.phase,
          });
        } catch {
          metric = Object.freeze({ state: "INCONCLUSIVE", reason: "TIMING_INCONSISTENT" });
        }

        const evidence = createAttemptEvidence({
          plan: planned,
          runId,
          commit,
          browserVersion,
          playwrightVersion,
          metric,
          calibration,
          isolation: provenIsolation,
        });
        attempts.push(evidence);

        const expectedState = planned.phase === "WARMUP" ? "WARMUP_VALID" : "VALID";
        if (evidence.state !== expectedState) {
          const classification = planned.attempt === 1 ? "smoke-failure" : "invalid-attempt";
          await input.testInfo.attach(
            `p17-${p17CohortKey(input.cohort)}-${classification}-${planned.attempt}`,
            {
              body: Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`, "utf8"),
              contentType: "application/json",
            },
          );
          throw new Error(
            `P17_PERFORMANCE_COHORT_${planned.attempt === 1 ? "SMOKE" : "ATTEMPT"}_NOT_VALID_${evidence.reason ?? evidence.state}`,
          );
        }
      } finally {
        await context.close();
      }
    }
  } catch (error) {
    const partial = Object.freeze({
      cohort: input.cohort,
      calibration,
      attempts: Object.freeze([...attempts]),
    });
    await input.testInfo.attach(performanceCollectionAttachmentName(input.cohort), {
      body: Buffer.from(`${JSON.stringify(partial, null, 2)}\n`, "utf8"),
      contentType: "application/json",
    });
    throw error;
  }

  return Object.freeze({
    cohort: input.cohort,
    calibration,
    attempts: Object.freeze(attempts),
  });
}
