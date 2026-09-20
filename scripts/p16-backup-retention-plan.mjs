#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

import { planBackupRetention } from "./lib/p16-backup-retention.mjs";

const indexFile = process.env.P16_BACKUP_INDEX_FILE;
if (!indexFile) {
  process.stderr.write("P16_BACKUP_INDEX_FILE is required for a read-only retention plan.\n");
  process.exitCode = 1;
} else {
  const source = JSON.parse(await readFile(indexFile, "utf8"));
  if (!Array.isArray(source)) throw new Error("P16_BACKUP_INDEX_INVALID");

  const plan = planBackupRetention(source);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}
