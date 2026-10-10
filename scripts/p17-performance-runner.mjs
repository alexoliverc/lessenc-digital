#!/usr/bin/env node
import process from "node:process";

import {
  buildPerformanceChildEnvironment,
  PERFORMANCE_BASE_URL,
  PERFORMANCE_DATABASE_HOST,
  PERFORMANCE_DATABASE_NAME,
  PERFORMANCE_DATABASE_PORT,
} from "../e2e/performance/helpers/isolation.ts";
import {
  NETWORK_CALIBRATION_TOLERANCE,
  PERFORMANCE_NETWORK_PROFILE,
} from "../e2e/performance/helpers/network-profile.ts";

const command = process.argv[2] ?? "describe";

function report(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function validateConfiguration() {
  const childEnvironment = buildPerformanceChildEnvironment(process.env, {
    databaseUrl: process.env.P17_PERF_DB_RUNTIME_URL,
    repositoryRoot: process.cwd(),
    storagePath: process.env.P17_PERF_STORAGE_PATH,
    runId: process.env.P17_PERF_RUN_ID ?? "p17-perf-infrastructure-validation",
  });

  report({
    state: "CONFIGURATION_VALIDATED",
    target: "local",
    baseURL: PERFORMANCE_BASE_URL,
    database: {
      host: PERFORMANCE_DATABASE_HOST,
      port: PERFORMANCE_DATABASE_PORT,
      name: PERFORMANCE_DATABASE_NAME,
    },
    childEnvironmentValueCount: Object.keys(childEnvironment).length,
    secretsPrinted: false,
    applicationStarted: false,
    performanceScenariosExecuted: false,
  });
}

try {
  switch (command) {
    case "describe":
      report({
        phase: "H9-F8-I04-A",
        target: "local-only",
        baseURL: PERFORMANCE_BASE_URL,
        viewports: [
          { name: "mobile", width: 390, height: 844 },
          { name: "tablet", width: 768, height: 1024 },
          { name: "desktop", width: 1440, height: 900 },
        ],
        network: PERFORMANCE_NETWORK_PROFILE,
        calibrationTolerance: NETWORK_CALIBRATION_TOLERANCE,
        retries: 0,
        workers: 1,
        scenariosImplemented: false,
      });
      break;

    case "validate-config":
      validateConfiguration();
      break;

    case "collect":
    case "run":
      throw new Error("P17_PERFORMANCE_I04_B_NOT_AUTHORIZED");

    default:
      throw new Error("P17_PERFORMANCE_RUNNER_COMMAND_INVALID");
  }
} catch (error) {
  const code = error instanceof Error ? error.message : "P17_PERFORMANCE_RUNNER_FAILED";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
