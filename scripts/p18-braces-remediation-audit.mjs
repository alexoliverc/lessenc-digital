import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import {
  BracesRemediationError,
  evaluateBracesRemediationEvidence,
} from "./lib/p18-braces-remediation.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputLimit = 16 * 1024 * 1024;
const timeoutMilliseconds = 120_000;

function readJson(path, code) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new BracesRemediationError(code);
  }
}

function resolveNpmCli() {
  const candidates =
    process.platform === "win32"
      ? [resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js")]
      : [resolve(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js")];
  const found = candidates.find(existsSync);
  if (!found) throw new BracesRemediationError("BRACES_REMEDIATION_NPM_CLI_NOT_FOUND");
  return found;
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
    let operationalFailure;
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMilliseconds);
    const append = (current, chunk) => {
      const next = current + chunk.toString("utf8");
      if (Buffer.byteLength(next, "utf8") > outputLimit) {
        operationalFailure = "OUTPUT_LIMIT_EXCEEDED";
        child.kill();
        return current;
      }
      return next;
    };
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
      complete({ exitCode: -1, stdout, stderr, operationalFailure: error.code ?? "SPAWN_FAILED" });
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

function collectHashes(policy) {
  return Object.fromEntries(
    Object.keys(policy.fileHashesSha256).map((relativePath) => {
      const contents = readFileSync(resolve(repositoryRoot, relativePath));
      const canonicalBytes = relativePath.endsWith(".tgz")
        ? contents
        : Buffer.from(contents.toString("utf8").replace(/\r\n/gu, "\n"), "utf8");
      return [relativePath, createHash("sha256").update(canonicalBytes).digest("hex")];
    }),
  );
}

async function main() {
  const policy = readJson(
    resolve(repositoryRoot, "docs/security/les-sec-ra-001-remediation-policy.json"),
    "BRACES_REMEDIATION_POLICY_JSON_INVALID",
  );
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
  const result = evaluateBracesRemediationEvidence({
    policy,
    manifest: readJson(resolve(repositoryRoot, "package.json"), "BRACES_MANIFEST_JSON_INVALID"),
    lockfile: readJson(resolve(repositoryRoot, "package-lock.json"), "BRACES_LOCK_JSON_INVALID"),
    fileHashesSha256: collectHashes(policy),
    auditExecution,
    installedTreeExecution,
    runtimeTreeExecution,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  const code =
    error instanceof BracesRemediationError ? error.code : "BRACES_REMEDIATION_UNEXPECTED_FAILURE";
  process.stderr.write(`LES-SEC-RA-001 FAIL-CLOSED: ${code}\n`);
  process.exitCode = 1;
}
