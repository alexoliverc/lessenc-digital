#!/usr/bin/env node
import process from "node:process";

import {
  P16_HOSTED_BACKUP_AUTOMATION_AUTHORITY,
  runP16HostedBackupOrchestrator,
} from "./lib/p16-hosted-backup-orchestrator.mjs";

async function main() {
  const [mode, ...unexpected] = process.argv.slice(2);
  if (mode !== "run" || unexpected.length > 0) throw new Error("P16_HOSTED_BACKUP_MODE_INVALID");
  const result = await runP16HostedBackupOrchestrator({
    env: process.env,
    repositoryRoot: process.cwd(),
    executionAuthority: P16_HOSTED_BACKUP_AUTOMATION_AUTHORITY,
  });
  process.stdout.write("P16_HOSTED_BACKUP=PASS\n");
  process.stdout.write(`P16_HOSTED_BACKUP_ID=${result.backupId}\n`);
  process.stdout.write(`P16_HOSTED_BACKUP_OBJECTS=${result.objectCount}\n`);
  process.stdout.write(`P16_HOSTED_BACKUP_BYTES=${result.totalSnapshotBytes}\n`);
  process.stdout.write(`P16_HOSTED_BACKUP_RPO_STATUS=${result.rpo.status}\n`);
}

main().catch((error) => {
  const code =
    error instanceof Error && /^P16_[A-Z0-9_]+$/u.test(error.message)
      ? error.message
      : "P16_HOSTED_BACKUP_FAILED";
  process.stderr.write(`P16_HOSTED_BACKUP_ERROR=${code}\n`);
  process.exitCode = 1;
});
