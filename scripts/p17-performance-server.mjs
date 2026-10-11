#!/usr/bin/env node
import process from "node:process";

import { buildPerformanceChildEnvironment } from "../e2e/performance/helpers/isolation.ts";

const command = process.argv[2] ?? "validate-config";

try {
  const childEnvironment = buildPerformanceChildEnvironment(process.env, {
    databaseUrl: process.env.P17_PERF_DB_RUNTIME_URL,
    repositoryRoot: process.cwd(),
    storagePath: process.env.P17_PERF_STORAGE_PATH,
    runId: process.env.P17_PERF_RUN_ID ?? "p17-perf-server-validation",
    commit: process.env.P17_PERF_COMMIT,
  });

  if (command !== "validate-config") {
    throw new Error("P17_PERFORMANCE_SERVER_START_RESERVED_FOR_I04_B");
  }

  process.stdout.write(
    `${JSON.stringify({
      state: "SERVER_ENVIRONMENT_VALIDATED",
      childEnvironmentValueCount: Object.keys(childEnvironment).length,
      inheritedEnvironment: false,
      secretsPrinted: false,
      applicationStarted: false,
    })}\n`,
  );
} catch (error) {
  const code = error instanceof Error ? error.message : "P17_PERFORMANCE_SERVER_FAILED";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
