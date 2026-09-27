#!/usr/bin/env node
import process from "node:process";
import { resolve } from "node:path";

import {
  P16_ISOLATED_RECOVERY_ENVIRONMENT_ID,
  P16_STAGING_ENVIRONMENT_ID,
  calculateP16MigrationSetSha256,
  collectP16MigrationMetadata,
  createP16RecoveryBundle,
  createStagingDatabaseDump,
  decodeRecoveryEncryptionKey,
  measureP16Rpo,
  measureP16Rto,
  planP16ApplicationRollback,
  restoreP16RecoveryBundleIsolated,
  stagingMysqlDumpArguments,
  validateStagingDatabaseBackupEnvironment,
  verifyP16RecoveryBundle,
} from "./lib/p16-recovery.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseOptions(argv) {
  const options = new Map();
  invariant(argv.length % 2 === 0, "P16_RECOVERY_ARGUMENTS_INVALID");
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    invariant(key?.startsWith("--") && typeof value === "string", "P16_RECOVERY_ARGUMENTS_INVALID");
    const name = key.slice(2);
    invariant(!options.has(name), "P16_RECOVERY_ARGUMENT_DUPLICATE");
    options.set(name, value);
  }
  return options;
}

function required(options, name) {
  const value = options.get(name);
  invariant(typeof value === "string" && value.length > 0, "P16_RECOVERY_ARGUMENT_REQUIRED");
  return value;
}

function encryptionKey() {
  return decodeRecoveryEncryptionKey(process.env.P16_BACKUP_ENCRYPTION_KEY);
}

async function main() {
  const [mode, ...rawOptions] = process.argv.slice(2);
  const options = parseOptions(rawOptions);

  if (mode === "database-preflight") {
    const configuration = validateStagingDatabaseBackupEnvironment(process.env);
    const argumentsList = stagingMysqlDumpArguments(configuration);
    invariant(argumentsList.length > 0, "P16_BACKUP_DUMP_ARGUMENTS_EMPTY");
    process.stdout.write("P16_DATABASE_BACKUP_PREFLIGHT=PASS\n");
    process.stdout.write("P16_DATABASE_BACKUP_MODE=SINGLE_TRANSACTION_NO_LOCKS\n");
    process.stdout.write("P16_DATABASE_BACKUP_TRANSPORT=TLS_VERIFIED\n");
    return;
  }

  if (mode === "database-dump") {
    const result = await createStagingDatabaseDump({
      env: process.env,
      destinationPath: resolve(required(options, "output")),
    });
    process.stdout.write("P16_DATABASE_BACKUP=PASS\n");
    process.stdout.write(`P16_DATABASE_BACKUP_BYTES=${result.bytes}\n`);
    process.stdout.write(`P16_DATABASE_BACKUP_SHA256=${result.sha256}\n`);
    return;
  }

  if (mode === "bundle") {
    const configuration = validateStagingDatabaseBackupEnvironment(process.env);
    const databaseName = required(options, "database-name");
    invariant(databaseName === configuration.databaseName, "P16_RECOVERY_DATABASE_MISMATCH");
    const result = await createP16RecoveryBundle({
      backupId: required(options, "backup-id"),
      createdAt: required(options, "created-at"),
      releaseCommit: required(options, "release-commit"),
      databaseName,
      databaseDumpPath: resolve(required(options, "database-dump")),
      storageRoot: resolve(required(options, "storage-root")),
      outputRoot: resolve(required(options, "output-root")),
      repositoryRoot: process.cwd(),
      encryptionKey: encryptionKey(),
    });
    process.stdout.write("P16_RECOVERY_BUNDLE_CREATED=1\n");
    process.stdout.write(`P16_RECOVERY_BACKUP_ID=${result.manifest.backupId}\n`);
    process.stdout.write(
      `P16_RECOVERY_ARTIFACTS=${result.manifest.privateStorage.fileCount + 2}\n`,
    );
    return;
  }

  if (mode === "verify") {
    const migrations = await collectP16MigrationMetadata(process.cwd());
    await verifyP16RecoveryBundle(resolve(required(options, "bundle")), {
      encryptionKey: encryptionKey(),
      environmentId: P16_STAGING_ENVIRONMENT_ID,
      databaseName: required(options, "database-name"),
      backupId: required(options, "backup-id"),
      releaseCommit: required(options, "release-commit"),
      migrationSetSha256: calculateP16MigrationSetSha256(migrations),
    });
    process.stdout.write("P16_RECOVERY_BUNDLE_VERIFIED=1\n");
    return;
  }

  if (mode === "restore-isolated") {
    const migrations = await collectP16MigrationMetadata(process.cwd());
    const evidence = await restoreP16RecoveryBundleIsolated({
      bundleDirectory: resolve(required(options, "bundle")),
      targetRoot: resolve(required(options, "target-root")),
      targetEnvironmentId: P16_ISOLATED_RECOVERY_ENVIRONMENT_ID,
      targetDatabaseName: required(options, "target-database"),
      expectedSourceDatabaseName: required(options, "source-database"),
      expectedBackupId: required(options, "backup-id"),
      expectedReleaseCommit: required(options, "release-commit"),
      expectedMigrationSetSha256: calculateP16MigrationSetSha256(migrations),
      encryptionKey: encryptionKey(),
    });
    process.stdout.write("P16_ISOLATED_RESTORE_VALIDATED=1\n");
    process.stdout.write(`P16_ISOLATED_RESTORE_DURATION_MS=${evidence.durationMs}\n`);
    return;
  }

  if (mode === "measure-rpo") {
    const result = measureP16Rpo({
      observedAt: required(options, "observed-at"),
      latestVerifiedBackupAt: options.get("latest-verified-backup-at") ?? null,
      evidenceScope: options.get("evidence-scope") ?? null,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (mode === "measure-rto") {
    const result = measureP16Rto({
      recoveryStartedAt: options.get("recovery-started-at") ?? null,
      recoveryValidatedAt: options.get("recovery-validated-at") ?? null,
      validationOutcome: options.get("validation-outcome") ?? null,
      evidenceScope: options.get("evidence-scope") ?? null,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (mode === "rollback-plan") {
    const result = planP16ApplicationRollback({
      environmentId: required(options, "environment-id"),
      currentRelease: required(options, "current-release"),
      targetRelease: required(options, "target-release"),
      targetApproved: required(options, "target-approved") === "true",
      currentMigrationSetSha256: required(options, "current-migration-set-sha256"),
      targetCompatibleMigrationSetSha256: required(
        options,
        "target-compatible-migration-set-sha256",
      ),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  throw new Error("P16_RECOVERY_MODE_INVALID");
}

main().catch(() => {
  process.stderr.write("P16_RECOVERY_ERROR=RECOVERY_OPERATION_FAILED\n");
  process.exitCode = 1;
});
