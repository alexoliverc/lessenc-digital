#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";

import { validateReleaseCommitBinding } from "./lib/p16-release-binding.mjs";
import { validateStagingEnvironment } from "./lib/p16-staging-contract.mjs";

const failures = [
  ...validateStagingEnvironment(process.env),
  ...validateReleaseCommitBinding(process.env.P16_RELEASE_COMMIT),
];

if (process.versions.node.split(".")[0] !== "24") failures.push("NODE_RUNTIME_NOT_24_X");

try {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  if (packageJson.engines?.node !== "24.x") failures.push("PACKAGE_NODE_ENGINE_INVALID");
  if (packageJson.packageManager !== "npm@11.19.1") failures.push("PACKAGE_MANAGER_INVALID");
} catch {
  failures.push("PACKAGE_METADATA_UNREADABLE");
}

try {
  await access(process.env.DB_TLS_CA_FILE ?? "");
} catch {
  failures.push("DB_TLS_CA_FILE_UNREADABLE");
}

const uniqueFailures = [...new Set(failures)].sort();
if (uniqueFailures.length > 0) {
  process.stderr.write(`P16 staging preflight refused operation: ${uniqueFailures.join(",")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("P16 staging preflight passed without disclosing configuration values.\n");
}
