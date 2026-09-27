#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

import { planBackupRetention } from "./lib/p16-backup-retention.mjs";

async function main() {
  const indexFile = process.env.P16_BACKUP_INDEX_FILE;
  if (!indexFile) throw new Error("P16_BACKUP_INDEX_FILE_REQUIRED");
  const source = JSON.parse(await readFile(indexFile, "utf8"));
  if (!Array.isArray(source)) throw new Error("P16_RETENTION_INDEX_INVALID");

  const plan = planBackupRetention(source, {
    now: process.env.P16_RETENTION_EVALUATED_AT ?? new Date(),
  });
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

main().catch(() => {
  process.stderr.write("P16_RETENTION_PLAN_ERROR=RETENTION_PLAN_FAILED\n");
  process.exitCode = 1;
});
