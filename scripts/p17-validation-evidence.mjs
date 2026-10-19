#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";

import { computeSourceProvenance } from "./p17-source-provenance.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const approvedExecutables = new Set([
  "node",
  "node.exe",
  "npm",
  "npm.cmd",
  "git",
  "git.exe",
  "docker",
  "docker.exe",
  "pwsh",
  "pwsh.exe",
]);

export function sanitizeValidationCommand(command, args) {
  if (
    typeof command !== "string" ||
    !Array.isArray(args) ||
    args.some((arg) => typeof arg !== "string")
  ) {
    throw new Error("P17_VALIDATION_COMMAND_INVALID");
  }
  const normalizedCommand = command.replaceAll("\\", "/");
  const executable = basename(normalizedCommand).toLowerCase();
  if (normalizedCommand !== executable) {
    throw new Error("P17_VALIDATION_COMMAND_PATH_FORBIDDEN");
  }
  if (!approvedExecutables.has(executable)) {
    throw new Error("P17_VALIDATION_COMMAND_NOT_ALLOWED");
  }
  // Command-line arguments can contain passwords, paths and bearer tokens: never persist them.
  return Object.freeze([executable, ...args.map(() => "<ARGUMENT_REDACTED>")]);
}

function resolveNpmCli() {
  const candidates = [
    process.env.npm_execpath,
    resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  const npmCli = candidates.find(
    (candidate) =>
      typeof candidate === "string" &&
      /(?:^|[\\/])npm-cli\.js$/iu.test(candidate) &&
      existsSync(candidate),
  );
  if (npmCli === undefined) throw new Error("P17_VALIDATION_NPM_CLI_UNAVAILABLE");
  return npmCli;
}

function run(command, args, options = {}) {
  const safeMetadata = sanitizeValidationCommand(command, args);
  if (args.some((arg) => /[\0\r\n]/u.test(arg))) {
    throw new Error("P17_VALIDATION_ARGUMENT_CONTROL_CHARACTER_FORBIDDEN");
  }
  const npmOnWindows =
    process.platform === "win32" && (safeMetadata[0] === "npm" || safeMetadata[0] === "npm.cmd");
  const executable = npmOnWindows ? process.execPath : command;
  const invocationArgs = npmOnWindows ? [resolveNpmCli(), ...args] : args;
  return spawnSync(executable, invocationArgs, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    env: options.env ?? process.env,
    shell: false,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function version(command, args) {
  const result = run(command, args);
  return result.status === 0 ? result.stdout.trim() : "UNAVAILABLE";
}

function collectSensitiveValues(args, environment) {
  const values = new Set();
  const add = (candidate) => {
    if (typeof candidate !== "string" || candidate.length < 3) return;
    values.add(candidate);
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded !== candidate && decoded.length >= 3) values.add(decoded);
    } catch {
      // Non-URL values remain covered by their original bytes.
    }
  };

  for (const arg of args) {
    add(arg);
    const separator = arg.indexOf("=");
    if (separator >= 0) add(arg.slice(separator + 1));
    for (const match of arg.matchAll(/["']([^"'\r\n]{3,})["']/gu)) add(match[1]);
    try {
      const url = new URL(arg);
      add(url.username);
      add(url.password);
    } catch {
      // Most command arguments are not URLs.
    }
  }

  const sensitiveEnvironmentName =
    /(?:authorization|cookie|credential|database.*url|db_.*url|password|private.*key|secret|token|access.*key)/iu;
  for (const [name, environmentValue] of Object.entries(environment ?? {})) {
    if (sensitiveEnvironmentName.test(name)) add(environmentValue);
  }
  return [...values].sort((left, right) => right.length - left.length);
}

export function sanitizeValidationOutput(value, repositoryRoot, sensitiveValues = []) {
  const profile = process.env.USERPROFILE;
  let sanitized = String(value ?? "");
  for (const sensitiveValue of sensitiveValues) {
    sanitized = sanitized.replaceAll(sensitiveValue, "<REDACTED>");
  }
  return sanitized
    .replaceAll(resolve(repositoryRoot), "<REPOSITORY_ROOT>")
    .replaceAll(resolve(repositoryRoot).replaceAll("\\", "/"), "<REPOSITORY_ROOT>")
    .replace(
      profile ? new RegExp(profile.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "giu") : /$^/u,
      "<USER_PROFILE>",
    )
    .replace(/mysql:\/\/[^\s:@/]+:[^\s@/]+@/giu, "mysql://<REDACTED>@")
    .replace(/(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s]+/giu, "$1<REDACTED>")
    .replace(
      /((?:access[_-]?token|secret|password|private[_-]?key)\s*[:=]\s*)[^\s,;]+/giu,
      "$1<REDACTED>",
    );
}

export function collectValidationEvidence({ label, command, args, repositoryRoot, environment }) {
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/u.test(label)) {
    throw new Error("P17_VALIDATION_LABEL_INVALID");
  }
  if (!command || !Array.isArray(args)) throw new Error("P17_VALIDATION_COMMAND_INVALID");

  const root = resolve(repositoryRoot);
  const startedAt = new Date();
  const result = run(command, args, { cwd: root, env: environment });
  const completedAt = new Date();
  const sensitiveValues = collectSensitiveValues(args, environment ?? process.env);
  const stdout = sanitizeValidationOutput(result.stdout, root, sensitiveValues);
  const stderr = sanitizeValidationOutput(result.stderr, root, sensitiveValues);
  const gitBranch = run("git", ["branch", "--show-current"], { cwd: root });
  const gitHead = run("git", ["rev-parse", "HEAD"], { cwd: root });
  const source = computeSourceProvenance(root);
  const lockBytes = readFileSync(resolve(root, "package-lock.json"));

  return Object.freeze({
    schemaVersion: 1,
    authority: "LES-P17-AUTONOMOUS-COMPLETION-R01",
    label,
    classification: result.status === 0 ? "PASS" : "FAIL",
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    command: sanitizeValidationCommand(command, args),
    exitCode: result.status,
    signal: result.signal ?? null,
    versions: Object.freeze({
      node: process.version,
      npm: version("npm", ["--version"]),
      git: version("git", ["--version"]),
      docker: version("docker", ["--version"]),
    }),
    git: Object.freeze({
      branch: gitBranch.status === 0 ? gitBranch.stdout.trim() : "UNAVAILABLE",
      head: gitHead.status === 0 ? gitHead.stdout.trim() : "UNAVAILABLE",
      declaredCommitAuthority: "METADATA_ONLY_NOT_SOURCE_BYTE_PROOF",
    }),
    provenance: Object.freeze({
      sourceTreeSha256: source.digest,
      sourceFileCount: source.fileCount,
      sourceComponents: source.components,
      packageLockSha256: sha256(lockBytes),
    }),
    output: Object.freeze({
      stdout,
      stderr,
      stdoutSha256: sha256(stdout),
      stderrSha256: sha256(stderr),
    }),
  });
}

function main() {
  const separator = process.argv.indexOf("--");
  if (separator < 5) throw new Error("P17_VALIDATION_ARGUMENTS_INVALID");
  const [, , output, label, repositoryRoot, , command, ...args] = process.argv;
  const root = resolve(repositoryRoot);
  const destination = resolve(output);
  if (relative(root, destination) === "") throw new Error("P17_VALIDATION_OUTPUT_INVALID");
  const evidence = collectValidationEvidence({
    label,
    command,
    args,
    repositoryRoot: root,
    environment: process.env,
  });
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o444,
  });
  process.stdout.write(
    `${JSON.stringify({
      label: evidence.label,
      classification: evidence.classification,
      exitCode: evidence.exitCode,
      evidenceSha256: sha256(readFileSync(destination)),
    })}\n`,
  );
  if (evidence.exitCode !== 0) process.exitCode = evidence.exitCode ?? 1;
}

if (process.argv[1]?.endsWith("p17-validation-evidence.mjs")) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "P17_VALIDATION_EVIDENCE_FAILED"}\n`,
    );
    process.exitCode = 1;
  }
}
