#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const REQUIRED_CONTEXT_PATHS = Object.freeze([
  "package.json",
  "package-lock.json",
  "src/app/page.tsx",
  "e2e/performance/capsule/Dockerfile",
  "e2e/performance/capsule/compose.yaml",
  "e2e/performance/capsule/init-db-ca-volume.sh",
  "e2e/performance/capsule/dockerignore.snapshot",
  "e2e/performance/capsule/bootstrap-toolchain.sh",
  "e2e/performance/capsule/supply-chain.json",
  "e2e/performance/capsule/offline/artifacts/npm-11.19.1.tgz",
]);

const forbiddenSegment =
  /(^|\/)(?:\.git|\.github|\.vscode|\.next|node_modules|coverage|output|tmp|playwright-report|test-results|memory|docs)(?:\/|$)/u;
const forbiddenName =
  /(^|\/)(?:\.env(?:\..*)?|\.npmrc(?:\..*)?|[^/]+\.(?:pem|key|crt|cer|p12|pfx|jks|keystore))$/u;

function portable(path) {
  return path.split(sep).join("/");
}

function walk(root, directory = root, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) walk(root, absolute, output);
    else if (entry.isFile()) output.push(portable(relative(root, absolute)));
  }
  return output;
}

export function assertDockerContextInventory(paths, required = REQUIRED_CONTEXT_PATHS) {
  const normalized = [...new Set(paths.map((path) => portable(path)))].sort();
  const forbidden = normalized.filter(
    (path) => forbiddenSegment.test(path) || forbiddenName.test(path),
  );
  const missing = required.filter((path) => !normalized.includes(path));
  if (forbidden.length > 0) {
    throw new Error(`P17_DOCKER_CONTEXT_FORBIDDEN_PATH_${forbidden[0]}`);
  }
  if (missing.length > 0) {
    throw new Error(`P17_DOCKER_CONTEXT_REQUIRED_PATH_MISSING_${missing[0]}`);
  }
  return Object.freeze({ paths: Object.freeze(normalized), requiredCount: required.length });
}

function runBuildContextExport(context, dockerfile, destination) {
  const result = spawnSync(
    "docker",
    [
      "buildx",
      "build",
      "--network=none",
      "--file",
      dockerfile,
      "--output",
      `type=local,dest=${destination}`,
      context,
    ],
    {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 600_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ""}`.trim().slice(-2_000);
    throw new Error(`P17_DOCKER_CONTEXT_EXPORT_FAILED_${detail}`);
  }
}

function createNegativeFixture(repositoryRoot, fixtureRoot) {
  copyFileSync(resolve(repositoryRoot, ".dockerignore"), join(fixtureRoot, ".dockerignore"));
  mkdirSync(join(fixtureRoot, "e2e", "performance", "capsule"), { recursive: true });
  copyFileSync(
    resolve(repositoryRoot, "e2e/performance/capsule/context-audit.Dockerfile"),
    join(fixtureRoot, "e2e", "performance", "capsule", "context-audit.Dockerfile"),
  );

  const fixtures = {
    "src/allowed.ts": "export const allowed = true;\n",
    "scripts/allowed.mjs": "export const allowed = true;\n",
    "src/.env": "FORBIDDEN=true\n",
    "src/.env.spec.ts": "FORBIDDEN=true\n",
    "scripts/private.pem": "FORBIDDEN\n",
    ".npmrc": "FORBIDDEN=true\n",
    "e2e/fixture.key": "FORBIDDEN\n",
    "docs/private.md": "FORBIDDEN\n",
    "memory/private.md": "FORBIDDEN\n",
    "output/private.json": "FORBIDDEN\n",
  };

  for (const [path, value] of Object.entries(fixtures)) {
    const absolute = join(fixtureRoot, ...path.split("/"));
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, value, { encoding: "utf8", mode: 0o600 });
  }
}

function inventoryDigest(root, paths) {
  const hash = createHash("sha256");
  let bytes = 0;
  for (const path of paths) {
    const size = statSync(resolve(root, path)).size;
    bytes += size;
    hash.update(`${path}\0${size}\n`, "utf8");
  }
  return Object.freeze({ fileCount: paths.length, bytes, digest: hash.digest("hex") });
}

export function verifyDockerContext(repositoryRoot) {
  const root = resolve(repositoryRoot);
  const scratch = mkdtempSync(join(tmpdir(), "p17-docker-context-"));
  const actualOutput = join(scratch, "actual-output");
  const fixtureRoot = join(scratch, "negative-fixture");
  const fixtureOutput = join(scratch, "fixture-output");
  mkdirSync(actualOutput, { recursive: true });
  mkdirSync(fixtureRoot, { recursive: true });
  mkdirSync(fixtureOutput, { recursive: true });

  try {
    const dockerfile = resolve(root, "e2e/performance/capsule/context-audit.Dockerfile");
    runBuildContextExport(root, dockerfile, actualOutput);
    const effectiveRoot = join(actualOutput, "effective-context");
    const actual = assertDockerContextInventory(walk(effectiveRoot));

    createNegativeFixture(root, fixtureRoot);
    const fixtureDockerfile = join(
      fixtureRoot,
      "e2e",
      "performance",
      "capsule",
      "context-audit.Dockerfile",
    );
    runBuildContextExport(fixtureRoot, fixtureDockerfile, fixtureOutput);
    const fixturePaths = walk(join(fixtureOutput, "effective-context"));
    const fixture = assertDockerContextInventory(fixturePaths, [
      "src/allowed.ts",
      "scripts/allowed.mjs",
      "e2e/performance/capsule/context-audit.Dockerfile",
    ]);

    return Object.freeze({
      schemaVersion: 1,
      state: "PASS",
      actual: inventoryDigest(effectiveRoot, actual.paths),
      negativeFixture: Object.freeze({
        state: "PASS",
        included: fixture.paths,
        forbiddenFixtureCount: 0,
      }),
      dockerignoreSha256: createHash("sha256")
        .update(readFileSync(resolve(root, ".dockerignore")))
        .digest("hex"),
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function main() {
  if ((process.argv[2] ?? "verify") !== "verify") {
    throw new Error("P17_DOCKER_CONTEXT_COMMAND_INVALID");
  }
  const repositoryRoot = resolve(process.argv[3] ?? process.cwd());
  const result = verifyDockerContext(repositoryRoot);
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  const output = process.argv[4];
  if (output !== undefined) {
    const target = resolve(output);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, serialized, { encoding: "utf8", mode: 0o600 });
  }
  process.stdout.write(serialized);
}

if (process.argv[1]?.endsWith("p17-docker-context-audit.mjs")) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "P17_DOCKER_CONTEXT_AUDIT_FAILED"}\n`,
    );
    process.exitCode = 1;
  }
}
