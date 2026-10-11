#!/usr/bin/env node
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import process from "node:process";

const TOP_LEVEL_FILES = Object.freeze([
  "next-env.d.ts",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "playwright.performance.config.ts",
  "prisma.config.ts",
  "tsconfig.json",
  "vitest.config.mts",
  "vitest.integration.config.mjs",
  "vitest.performance.config.mts",
]);

const DIRECTORY_ROOTS = Object.freeze([
  "e2e/helpers",
  "e2e/performance/fixtures",
  "e2e/performance/helpers",
  "prisma",
  "scripts",
  "src",
]);

const PERFORMANCE_SPEC_PATTERN = /^e2e\/performance\/[^/]+\.perf\.spec\.ts$/u;
const E2E_SPEC_PATTERN = /^e2e\/[^/]+\.spec\.ts$/u;
const CAPSULE_RUNTIME_FILES = new Set([
  "e2e/performance/capsule/build-app.sh",
  "e2e/performance/capsule/contract.json",
  "e2e/performance/capsule/entrypoint.sh",
]);

function portable(path) {
  return path.split(sep).join("/");
}

function walk(root, directory, output) {
  const absolute = resolve(root, directory);
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const path = join(absolute, entry.name);
    const repositoryPath = portable(relative(root, path));
    if (entry.isSymbolicLink()) throw new Error("P17_SOURCE_PROVENANCE_SYMLINK_FORBIDDEN");
    if (entry.isDirectory()) {
      if (
        repositoryPath === "e2e/performance/capsule/offline" ||
        repositoryPath === "src/generated/prisma"
      ) {
        continue;
      }
      walk(root, repositoryPath, output);
    } else if (entry.isFile()) {
      output.push(repositoryPath);
    } else {
      throw new Error("P17_SOURCE_PROVENANCE_FILE_TYPE_INVALID");
    }
  }
}

export function sourceProvenanceFiles(repositoryRoot) {
  const root = resolve(repositoryRoot);
  const files = [...TOP_LEVEL_FILES];

  for (const directory of DIRECTORY_ROOTS) walk(root, directory, files);
  walk(root, "e2e", files);

  const selected = [...new Set(files)].filter((path) => {
    if (path.startsWith("src/generated/prisma/")) return false;
    if (path.startsWith("scripts/")) {
      return /(?:\.mjs|\.d\.mts|\.sh)$/u.test(path);
    }
    if (TOP_LEVEL_FILES.includes(path)) return true;
    if (DIRECTORY_ROOTS.some((directory) => path.startsWith(`${directory}/`))) return true;
    if (E2E_SPEC_PATTERN.test(path) || PERFORMANCE_SPEC_PATTERN.test(path)) return true;
    return CAPSULE_RUNTIME_FILES.has(path);
  });

  selected.sort((left, right) => left.localeCompare(right, "en"));
  if (selected.length === 0) throw new Error("P17_SOURCE_PROVENANCE_EMPTY");

  for (const path of selected) {
    const absolute = resolve(root, path);
    const relation = relative(root, absolute);
    if (relation.startsWith("..") || statSync(absolute).isFile() !== true) {
      throw new Error("P17_SOURCE_PROVENANCE_PATH_INVALID");
    }
  }

  return Object.freeze(selected);
}

export function computeSourceProvenance(repositoryRoot) {
  const root = resolve(repositoryRoot);
  const files = sourceProvenanceFiles(root);
  const hash = createHash("sha256");

  for (const path of files) {
    const bytes = readFileSync(resolve(root, path));
    const pathBytes = Buffer.from(path, "utf8");
    const length = Buffer.alloc(8);
    length.writeBigUInt64BE(BigInt(bytes.byteLength));
    hash.update(pathBytes);
    hash.update(Buffer.from([0]));
    hash.update(length);
    hash.update(bytes);
  }

  return Object.freeze({
    schemaVersion: 1,
    algorithm: "SHA-256",
    fileCount: files.length,
    digest: hash.digest("hex"),
  });
}

function main() {
  const command = process.argv[2] ?? "print";
  const root = resolve(process.argv[3] ?? process.cwd());
  const result = computeSourceProvenance(root);

  if (command === "print") {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (command === "write") {
    const output = resolve(process.argv[4] ?? join(root, ".p17-source-tree.sha256"));
    const relation = relative(root, output);
    if (relation.startsWith("..")) throw new Error("P17_SOURCE_PROVENANCE_OUTPUT_INVALID");
    writeFileSync(output, `${result.digest}\n`, { encoding: "utf8", mode: 0o444 });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  throw new Error("P17_SOURCE_PROVENANCE_COMMAND_INVALID");
}

if (process.argv[1]?.endsWith("p17-source-provenance.mjs")) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "P17_SOURCE_PROVENANCE_FAILED"}\n`,
    );
    process.exitCode = 1;
  }
}
