#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import process from "node:process";

import {
  createCiBuildChildEnvironment,
  validateCiBuildEnvironment,
} from "./lib/p17-ci-build-contract.mjs";

const repositoryRoot = process.cwd();

function environmentFileNames() {
  return readdirSync(repositoryRoot, { withFileTypes: true })
    .filter((entry) => {
      const normalizedName = entry.name.toLowerCase();
      return normalizedName === ".env" || normalizedName.startsWith(".env.");
    })
    .map((entry) => entry.name);
}

function validate() {
  try {
    return validateCiBuildEnvironment(process.env, {
      repositoryRoot,
      environmentFiles: environmentFileNames(),
    });
  } catch {
    return ["CI_BUILD_PREFLIGHT_INTERNAL_ERROR"];
  }
}

function refuse(failures) {
  process.stderr.write(`CI verification build refused operation: ${failures.join(",")}\n`);
  process.exit(1);
}

function localCli(relativePath, failureCode) {
  try {
    const candidate = resolve(repositoryRoot, relativePath);
    const realPath = realpathSync(candidate);
    const pathFromRoot = relative(repositoryRoot, realPath);
    const isInsideRepository =
      pathFromRoot !== "" &&
      !isAbsolute(pathFromRoot) &&
      !pathFromRoot.startsWith(`..${sep}`) &&
      pathFromRoot !== "..";

    if (!isInsideRepository || !statSync(realPath).isFile()) refuse([failureCode]);
    return realPath;
  } catch {
    refuse([failureCode]);
  }
}

function run(cliPath, args) {
  const failures = validate();
  if (failures.length > 0) refuse(failures);

  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repositoryRoot,
    env: createCiBuildChildEnvironment(process.env),
    stdio: "inherit",
  });

  if (result.error) {
    process.stderr.write("CI verification build child process could not start.\n");
    process.exit(1);
  }
  if (result.signal !== null) {
    process.stderr.write("CI verification build child process was interrupted.\n");
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const initialFailures = validate();
if (initialFailures.length > 0) refuse(initialFailures);

process.stdout.write(
  "CI verification preflight passed; artifact has no staging or production authority.\n",
);

const prismaCli = localCli("node_modules/prisma/build/index.js", "PRISMA_CLI_UNVERIFIABLE");
const nextCli = localCli("node_modules/next/dist/bin/next", "NEXT_CLI_UNVERIFIABLE");

run(prismaCli, ["generate"]);
run(nextCli, ["build"]);
