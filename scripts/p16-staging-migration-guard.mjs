#!/usr/bin/env node
import { access } from "node:fs/promises";
import process from "node:process";

import { validateStagingEnvironment } from "./lib/p16-staging-contract.mjs";

const failures = validateStagingEnvironment(process.env).filter(
  (failure) =>
    failure.startsWith("APP_") ||
    failure.startsWith("NODE_") ||
    failure.startsWith("P16_STAGING_") ||
    failure.startsWith("DATABASE_") ||
    failure.startsWith("DB_RUNTIME_") ||
    failure.startsWith("DB_TLS_"),
);

try {
  await access(process.env.DB_TLS_CA_FILE ?? "");
} catch {
  failures.push("DB_TLS_CA_FILE_UNREADABLE");
}

if (failures.length > 0) {
  process.stderr.write(
    `P16 staging migration guard refused operation: ${[...new Set(failures)].sort().join(",")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write("P16 staging migration target verified for prisma migrate deploy.\n");
}
