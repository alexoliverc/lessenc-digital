import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

const localBaseUrl = "http://127.0.0.1:3100";
const hostedBaseUrl = "https://lessenc.com.br";
const target = process.env.P17_TARGET ?? "local";

if (target !== "local" && target !== "hosted") {
  throw new Error("P17_TARGET_INVALID");
}

if (target === "hosted" && process.env.P17_ALLOW_HOSTED_READ_ONLY !== "true") {
  throw new Error("P17_HOSTED_READ_ONLY_ATTESTATION_REQUIRED");
}

const configuredBaseUrl =
  process.env.P17_BASE_URL ?? (target === "hosted" ? hostedBaseUrl : localBaseUrl);
const parsedBaseUrl = new URL(configuredBaseUrl);

if (
  (target === "local" && configuredBaseUrl !== localBaseUrl) ||
  (target === "hosted" && configuredBaseUrl !== hostedBaseUrl) ||
  parsedBaseUrl.username !== "" ||
  parsedBaseUrl.password !== "" ||
  parsedBaseUrl.search !== "" ||
  parsedBaseUrl.hash !== ""
) {
  throw new Error("P17_BASE_URL_NOT_AUTHORIZED");
}

const generatedRunId = `p17-${target}-${new Date().toISOString().replaceAll(/[-:.TZ]/gu, "")}-${randomUUID().slice(0, 8)}`;
const runId = process.env.P17_RUN_ID ?? generatedRunId;

if (!/^p17-[a-z0-9][a-z0-9._-]{7,95}$/u.test(runId)) {
  throw new Error("P17_RUN_ID_INVALID");
}

process.env.P17_RUN_ID = runId;
process.env.P17_TARGET = target;

const evidenceRoot = join("output", "p17", runId);

export default defineConfig({
  testDir: "./e2e",
  outputDir: join(evidenceRoot, "artifacts"),
  fullyParallel: false,
  forbidOnly: true,
  retries: target === "hosted" ? 1 : 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: join(evidenceRoot, "results.json") }],
    ["html", { outputFolder: join(evidenceRoot, "html"), open: "never" }],
  ],
  use: {
    baseURL: configuredBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    serviceWorkers: "block",
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
  ...(target === "local"
    ? {
        webServer: {
          command: "node scripts/p17-e2e-server.mjs",
          url: `${localBaseUrl}/api/health`,
          reuseExistingServer: false,
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }
    : {}),
});
