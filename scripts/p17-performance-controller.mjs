import { spawn } from "node:child_process";
import { once } from "node:events";
import { connect } from "node:net";
import process from "node:process";
import { setTimeout as wait } from "node:timers/promises";

import {
  assertLocalPerformanceExecutionAuthorized,
  buildPerformanceChildEnvironment,
} from "../e2e/performance/helpers/isolation.ts";
import { createPerformanceCalibrationServer } from "./p17-performance-calibration-server.mjs";

const LOOPBACK_DATABASE = Object.freeze({ host: "127.0.0.1", port: 3307 });
const LOOPBACK_APPLICATION_HEALTH = "http://127.0.0.1:3100/api/health";
const LOOPBACK_CALIBRATION_RTT = "http://127.0.0.1:3101/calibration/rtt?probe=controller-smoke";

async function waitForDatabase(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const connected = await new Promise((resolve) => {
      const socket = connect(LOOPBACK_DATABASE);
      socket.setTimeout(1_000);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => resolve(false));
    });
    if (connected) return;
    await wait(250);
  }
  throw new Error("P17_PERFORMANCE_DATABASE_START_TIMEOUT");
}

async function waitForApplication(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(LOOPBACK_APPLICATION_HEALTH, {
        cache: "no-store",
        redirect: "error",
      });
      if (response.status === 200) return;
    } catch {
      // Bounded loopback readiness retry only.
    }
    await wait(250);
  }
  throw new Error("P17_PERFORMANCE_APPLICATION_START_TIMEOUT");
}

async function verifyCalibrationServer() {
  const response = await globalThis.fetch(LOOPBACK_CALIBRATION_RTT, {
    cache: "no-store",
    headers: { Origin: "http://127.0.0.1:3100" },
    redirect: "error",
    signal: globalThis.AbortSignal.timeout(2_000),
  });
  if (response.status !== 204) {
    throw new Error("P17_PERFORMANCE_CALIBRATION_SMOKE_INVALID");
  }
}

async function runFixedChild(executable, args, environment) {
  const child = spawn(executable, args, {
    cwd: process.cwd(),
    env: environment,
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });
  const [code, signal] = await once(child, "exit");
  if (code !== 0 || signal !== null) {
    throw new Error("P17_PERFORMANCE_CHILD_PROCESS_FAILED");
  }
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), wait(5_000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

export function selectPerformancePlaywrightArgs(scope = "FULL") {
  const full = ["test", "--config=playwright.performance.config.ts"];

  if (scope === "FULL") return full;

  if (scope === "PR03_PIX_MOBILE") {
    return [
      ...full,
      "pr03-payment-initiation.perf.spec.ts",
      "--project=chromium-mobile",
      "--grep=measures PIX interaction to browser requestStart",
    ];
  }

  throw new Error("P17_PERFORMANCE_SELECTION_NOT_AUTHORIZED");
}

export async function executePerformanceControllerPlan(operations, scope = "FULL") {
  const playwrightArgs = selectPerformancePlaywrightArgs(scope);

  let application = null;
  let calibrationStarted = false;

  try {
    await operations.waitForDatabase();
    await operations.runCommand("./node_modules/.bin/prisma", ["migrate", "deploy"]);
    await operations.startCalibration();
    calibrationStarted = true;
    await operations.verifyCalibration();
    application = operations.startApplication();
    await operations.waitForApplication();
    await operations.runCommand("./node_modules/.bin/playwright", playwrightArgs);
  } finally {
    if (application !== null) await operations.stopApplication(application);
    if (calibrationStarted) await operations.stopCalibration();
  }
}

/**
 * Runs only under the exact local-only authority, provenance and isolation contract validated by
 * the capsule entrypoint. Hosted targets and inherited provider credentials remain fail-closed.
 */
export async function runLocalPerformanceAcceptance(scope = "FULL") {
  assertLocalPerformanceExecutionAuthorized(process.env, process.cwd());
  const childEnvironment = buildPerformanceChildEnvironment(process.env, {
    databaseUrl: process.env.P17_PERF_DB_RUNTIME_URL,
    repositoryRoot: process.cwd(),
    storagePath: process.env.P17_PERF_STORAGE_PATH,
    runId: process.env.P17_PERF_RUN_ID,
    commit: process.env.P17_PERF_COMMIT,
    sourceTreeSha256: process.env.P17_SOURCE_TREE_SHA256,
    imageDigest: process.env.P17_OCI_IMAGE_DIGEST,
    mode: "acceptance-local",
    executionAuthority: process.env.P17_PERF_EXECUTION_AUTHORITY,
    scope,
  });
  const calibrationServer = createPerformanceCalibrationServer();

  await executePerformanceControllerPlan(
    {
      waitForDatabase,
      runCommand: (executable, args) => runFixedChild(executable, args, childEnvironment),
      startCalibration: async () => {
        calibrationServer.listen(3101, "127.0.0.1");
        await once(calibrationServer, "listening");
      },
      verifyCalibration: verifyCalibrationServer,
      startApplication: () =>
        spawn("./node_modules/.bin/next", ["start", "--hostname", "127.0.0.1", "--port", "3100"], {
          cwd: process.cwd(),
          env: childEnvironment,
          shell: false,
          stdio: "inherit",
          windowsHide: true,
        }),
      waitForApplication,
      stopApplication: stopChild,
      stopCalibration: async () => {
        if (calibrationServer.listening) {
          calibrationServer.close();
          await once(calibrationServer, "close");
        }
      },
    },
    scope,
  );
}

export const PERFORMANCE_CONTROLLER_PLAN = Object.freeze({
  activation: "OWNER_AUTHORIZED_LOCAL_ONLY_FAIL_CLOSED",
  database: "LOOPBACK_SYNTHETIC_DISPOSABLE",
  application: "LOOPBACK_PRODUCTION_BUILD",
  calibration: "LOOPBACK_INDEPENDENT_PROBES",
  browser: "CHROMIUM_THREE_VIEWPORTS",
  providerEgress: "FORBIDDEN",
  gateD: "NOT_READY",
  production: "UNAUTHORIZED",
});

if (process.argv[1]?.endsWith("p17-performance-controller.mjs")) {
  if (
    process.argv[2] !== "run-local-acceptance" &&
    process.argv[2] !== "run-local-pr03-pix-mobile"
  ) {
    process.stderr.write("P17_PERFORMANCE_CONTROLLER_COMMAND_INVALID\n");
    process.exitCode = 1;
  } else {
    runLocalPerformanceAcceptance(
      process.argv[2] === "run-local-pr03-pix-mobile" ? "PR03_PIX_MOBILE" : "FULL",
    ).catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "P17_PERFORMANCE_CONTROLLER_FAILED"}\n`,
      );
      process.exitCode = 1;
    });
  }
}
