import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import {
  evaluateTemporaryRiskAuditEvidence,
  TemporaryRiskAuditError,
} from "./lib/p17-temporary-risk-audit.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = resolve(repositoryRoot, "docs/security/les-sec-ra-001-policy.json");
const outputLimit = 16 * 1024 * 1024;
const timeoutMilliseconds = 120_000;

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new TemporaryRiskAuditError("TEMPORARY_RISK_ARGUMENTS_INVALID");
    }
    values.set(key.slice(2), value);
  }
  if (values.size !== 2 || !values.has("scope") || !values.has("app-env")) {
    throw new TemporaryRiskAuditError("TEMPORARY_RISK_ARGUMENTS_INVALID");
  }
  return { scope: values.get("scope"), applicationEnvironment: values.get("app-env") };
}

function resolveNpmCli() {
  const candidates =
    process.platform === "win32"
      ? [resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js")]
      : [resolve(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js")];
  const npmCli = candidates.find((candidate) => existsSync(candidate));
  if (!npmCli) throw new TemporaryRiskAuditError("TEMPORARY_RISK_NPM_CLI_NOT_FOUND");
  return npmCli;
}

function runNpm(npmCli, args) {
  return new Promise((complete) => {
    const child = spawn(process.execPath, [npmCli, ...args], {
      cwd: repositoryRoot,
      env: { ...process.env, NO_COLOR: "1" },
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let operationalFailure;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMilliseconds);

    function append(current, chunk) {
      const next = current + chunk.toString("utf8");
      if (Buffer.byteLength(next, "utf8") > outputLimit) {
        operationalFailure = "OUTPUT_LIMIT_EXCEEDED";
        child.kill();
        return current;
      }
      return next;
    }

    child.stdout.on("data", (chunk) => {
      if (!settled) stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      if (!settled) stderr = append(stderr, chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      complete({
        exitCode: -1,
        stdout,
        stderr,
        operationalFailure: error.code ?? "SPAWN_FAILED",
        timedOut,
      });
    });
    child.on("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      complete({
        exitCode: exitCode ?? -1,
        stdout,
        stderr,
        ...(signal ? { signal } : {}),
        ...(timedOut ? { timedOut: true } : {}),
        ...(operationalFailure ? { operationalFailure } : {}),
      });
    });
  });
}

function readJson(path, code) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new TemporaryRiskAuditError(code);
  }
}

async function main() {
  const { scope, applicationEnvironment } = parseArguments(process.argv.slice(2));
  const npmCli = resolveNpmCli();
  const [auditExecution, installedTreeExecution, runtimeTreeExecution] = await Promise.all([
    runNpm(npmCli, ["audit", "--json"]),
    runNpm(npmCli, [
      "ls",
      "@next/eslint-plugin-next",
      "fast-glob",
      "micromatch",
      "braces",
      "--all",
      "--json",
    ]),
    runNpm(npmCli, ["ls", "braces", "--omit=dev", "--all", "--json"]),
  ]);

  const result = evaluateTemporaryRiskAuditEvidence({
    policy: readJson(policyPath, "TEMPORARY_RISK_POLICY_JSON_INVALID"),
    scope,
    applicationEnvironment,
    now: new Date(),
    manifest: readJson(
      resolve(repositoryRoot, "package.json"),
      "TEMPORARY_RISK_MANIFEST_JSON_INVALID",
    ),
    lockfile: readJson(
      resolve(repositoryRoot, "package-lock.json"),
      "TEMPORARY_RISK_LOCKFILE_JSON_INVALID",
    ),
    auditExecution,
    installedTreeExecution,
    runtimeTreeExecution,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.classification === "TEMPORARY_ACCEPTED_RISK") {
    process.stderr.write(
      "LES-SEC-RA-001 TEMPORARY ACCEPTED RISK: GHSA-vfj7-8cjw-p6xm remains visible and production remains blocked.\n",
    );
  }
}

try {
  await main();
} catch (error) {
  const code =
    error instanceof TemporaryRiskAuditError
      ? error.code
      : "TEMPORARY_RISK_AUDIT_UNEXPECTED_FAILURE";
  process.stderr.write(`LES-SEC-RA-001 FAIL-CLOSED: ${code}\n`);
  process.exitCode = 1;
}
