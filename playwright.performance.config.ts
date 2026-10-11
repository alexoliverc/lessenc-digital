import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

import {
  assertPerformanceExecutionContract,
  assertPerformanceTargetEnvironment,
  PERFORMANCE_BASE_URL,
} from "./e2e/performance/helpers/isolation";

assertPerformanceTargetEnvironment(process.env);

const executionContract = Object.freeze({
  retries: 0,
  workers: 1,
  serviceWorkers: "block",
  baseURL: PERFORMANCE_BASE_URL,
});

assertPerformanceExecutionContract(executionContract);

const configuredRunId = process.env.P17_PERF_RUN_ID;
const runId =
  configuredRunId ??
  `p17-perf-${new Date().toISOString().replaceAll(/[-:.TZ]/gu, "")}-${randomUUID().slice(0, 8)}`;

if (!/^p17-perf-[a-z0-9][a-z0-9._-]{7,80}$/u.test(runId)) {
  throw new Error("P17_PERFORMANCE_RUN_ID_INVALID");
}

const evidenceRoot = join("output", "p17-performance", runId);
const acceptanceOutput = join(evidenceRoot, "acceptance-package.json");

export default defineConfig({
  testDir: "./e2e/performance",
  testMatch: "**/*.perf.spec.ts",
  outputDir: join(evidenceRoot, "artifacts"),
  fullyParallel: false,
  forbidOnly: true,
  maxFailures: 1,
  retries: executionContract.retries,
  workers: executionContract.workers,
  timeout: 1_800_000,
  expect: { timeout: 5_000 },
  reporter: [
    ["list"],
    ["./e2e/performance/helpers/acceptance-reporter.ts", { outputFile: acceptanceOutput }],
    ["json", { outputFile: join(evidenceRoot, "results.json") }],
  ],
  use: {
    baseURL: executionContract.baseURL,
    serviceWorkers: executionContract.serviceWorkers,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium-mobile",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
    {
      name: "chromium-tablet",
      use: { browserName: "chromium", viewport: { width: 768, height: 1024 } },
    },
    {
      name: "chromium-desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
  ],
});
