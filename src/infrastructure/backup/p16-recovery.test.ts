import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { afterEach, describe, expect, it } from "vitest";

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
} from "../../../scripts/lib/p16-recovery.mjs";

const RELEASE = "5".repeat(40);
const BACKUP_ID = "staging-20260926T120000Z";
const DATABASE = "lessenc_staging";
const KEY = randomBytes(32);
const roots = new Set<string>();

type TestManifest = {
  manifestVersion: number;
  backupId: string;
  createdAt: string;
  source: { appEnv: string; environmentId: string };
  release: { commit: string };
  database: { name: string; artifact: { file: string } };
  migrations: { name: string; sha256: string }[];
  migrationSetSha256: string;
  privateStorage: {
    fileCount: number;
    objectArtifacts: { file: string }[];
  };
  protection: { atRest: string; publicAccess: string; keySeparation: string };
  recovery: { mode: string; targetEnvironmentId: string };
};

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "lessenc-p16-recovery-"));
  roots.add(root);
  return root;
}

async function createFixture() {
  const root = await temporaryRoot();
  const storageRoot = join(root, "storage-source");
  const outputRoot = join(root, "bundles");
  const dumpPath = join(root, "database.sql");
  await mkdir(join(storageRoot, "products"), { recursive: true });
  await writeFile(dumpPath, "CREATE TABLE recovery_probe(id INT);\n", "utf8");
  await writeFile(join(storageRoot, "products", "ebook.pdf"), "private-pdf", "utf8");
  await writeFile(join(storageRoot, "empty.bin"), Buffer.alloc(0));
  const result = await createP16RecoveryBundle({
    backupId: BACKUP_ID,
    createdAt: "2026-09-26T12:00:00.000Z",
    releaseCommit: RELEASE,
    databaseName: DATABASE,
    databaseDumpPath: dumpPath,
    storageRoot,
    outputRoot,
    repositoryRoot: resolve("."),
    encryptionKey: KEY,
  });
  const migrations = await collectP16MigrationMetadata(resolve("."));
  return {
    root,
    bundleRoot: result.bundleDirectory,
    manifest: result.manifest as unknown as TestManifest,
    migrationSetSha256: calculateP16MigrationSetSha256(migrations),
  };
}

function verificationOptions(migrationSetSha256: string) {
  return {
    encryptionKey: KEY,
    environmentId: P16_STAGING_ENVIRONMENT_ID,
    databaseName: DATABASE,
    backupId: BACKUP_ID,
    releaseCommit: RELEASE,
    migrationSetSha256,
  };
}

afterEach(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
  roots.clear();
});

describe("P16 staging database backup contract", () => {
  const validEnvironment = {
    APP_ENV: "staging",
    NODE_ENV: "production",
    P16_STAGING_ENVIRONMENT_ID: P16_STAGING_ENVIRONMENT_ID,
    P16_DATABASE_MIGRATION_WINDOW: "disabled",
    DB_TLS_CA_FILE: "C:\\private\\hosted-ca.pem",
    DB_RUNTIME_URL: "mysql://runtime:private@db.example.internal:3306/lessenc_staging",
    PRIVATE_STORAGE_DRIVER: "hosted",
    P16_PRIVATE_STORAGE_PROVIDER: "r2",
  };

  it("accepts only the explicit remote staging identity and returns no password", () => {
    const configuration = validateStagingDatabaseBackupEnvironment(validEnvironment);
    expect(configuration).toMatchObject({
      hostname: "db.example.internal",
      databaseName: DATABASE,
      environmentId: P16_STAGING_ENVIRONMENT_ID,
      dumpMode: "SINGLE_TRANSACTION_NO_LOCKS",
    });
    expect(Object.keys(configuration)).not.toContain("password");
    expect(JSON.stringify(configuration)).not.toContain(":private@");
  });

  it("builds a TLS-verified, single-transaction, no-lock dump invocation without secrets", () => {
    const configuration = validateStagingDatabaseBackupEnvironment(validEnvironment);
    const args = stagingMysqlDumpArguments(configuration);
    expect(args).toEqual(
      expect.arrayContaining([
        "--ssl-verify-server-cert",
        "--single-transaction",
        "--quick",
        "--skip-lock-tables",
      ]),
    );
    expect(args.join(" ")).not.toMatch(/--password|:private@|mysql:\/\//u);
  });

  it("streams a bounded database dump to an atomic destination and records integrity", async () => {
    const root = await temporaryRoot();
    const fixtureScript = join(root, "synthetic-dump.mjs");
    const destinationPath = join(root, "staging.sql");
    await writeFile(
      fixtureScript,
      'process.stderr.write("synthetic diagnostic"); process.stdout.write("SELECT 1;\\n");\n',
    );
    const evidence = await createStagingDatabaseDump({
      env: { ...process.env, ...validEnvironment },
      destinationPath,
      command: process.execPath,
      commandPrefixArguments: [fixtureScript],
    });

    expect(evidence).toMatchObject({
      destinationPath,
      databaseName: DATABASE,
      environmentId: P16_STAGING_ENVIRONMENT_ID,
      snapshotMode: "SINGLE_TRANSACTION_NO_LOCKS",
      bytes: 10,
      boundedDiagnosticBytes: 20,
    });
    expect(evidence.sha256).toMatch(/^[0-9a-f]{64}$/u);
    await expect(readFile(destinationPath, "utf8")).resolves.toBe("SELECT 1;\n");
  });

  it("returns a generic failure and removes partial output after an interrupted dump", async () => {
    const root = await temporaryRoot();
    const destinationPath = join(root, "staging.sql");
    await expect(
      createStagingDatabaseDump({
        env: { ...process.env, ...validEnvironment },
        destinationPath,
        command: join(root, "missing-dump-command"),
      }),
    ).rejects.toThrow("P16_BACKUP_DATABASE_DUMP_FAILED");
    expect(await readdir(root)).not.toEqual(
      expect.arrayContaining([expect.stringContaining(".partial-")]),
    );
  });

  it.each([
    ["APP_ENV", "production", "P16_BACKUP_APP_ENV_INVALID"],
    ["NODE_ENV", "development", "P16_BACKUP_NODE_ENV_INVALID"],
    ["P16_DATABASE_MIGRATION_WINDOW", "enabled", "P16_BACKUP_MIGRATION_WINDOW_INVALID"],
    [
      "DB_RUNTIME_URL",
      "mysql://u:p@127.0.0.1:3307/lessenc_staging",
      "P16_BACKUP_LOCALHOST_REFUSED",
    ],
    [
      "DB_RUNTIME_URL",
      "mysql://u:p@db.example/lessenc_production",
      "P16_BACKUP_DATABASE_NOT_STAGING",
    ],
    ["PRIVATE_STORAGE_DRIVER", "filesystem", "P16_BACKUP_PRIVATE_STORAGE_INVALID"],
  ])("fails closed when %s is unsafe", (name, value, failure) => {
    expect(() =>
      validateStagingDatabaseBackupEnvironment({ ...validEnvironment, [name]: value }),
    ).toThrow(failure);
  });
});

describe("P16 encrypted recovery unit", () => {
  it("creates and verifies an encrypted, secret-free v2 recovery unit", async () => {
    const fixture = await createFixture();
    const verified = await verifyP16RecoveryBundle(
      fixture.bundleRoot,
      verificationOptions(fixture.migrationSetSha256),
    );
    const manifestText = await readFile(join(fixture.bundleRoot, "manifest.json"), "utf8");
    const encryptedDatabase = await readFile(
      join(fixture.bundleRoot, fixture.manifest.database.artifact.file),
    );

    expect(verified.storageIndex).toHaveLength(2);
    expect(fixture.manifest).toMatchObject({
      manifestVersion: 2,
      protection: {
        atRest: "AES_256_GCM",
        publicAccess: "DENY",
        keySeparation: "KEY_NOT_IN_BUNDLE",
      },
      recovery: {
        mode: "ISOLATED_RESTORE_ONLY",
        targetEnvironmentId: P16_ISOLATED_RECOVERY_ENVIRONMENT_ID,
      },
    });
    expect(manifestText).not.toMatch(/mysql:\/\/|private-pdf|CREATE TABLE/u);
    expect(encryptedDatabase.toString("utf8")).not.toContain("CREATE TABLE");
  });

  it("restores database and private storage only into a new isolated target", async () => {
    const fixture = await createFixture();
    const targetRoot = join(fixture.root, "isolated-restore");
    const evidence = await restoreP16RecoveryBundleIsolated({
      bundleDirectory: fixture.bundleRoot,
      targetRoot,
      targetEnvironmentId: P16_ISOLATED_RECOVERY_ENVIRONMENT_ID,
      targetDatabaseName: "lessenc_test_recovery_p16",
      expectedSourceDatabaseName: DATABASE,
      expectedBackupId: BACKUP_ID,
      expectedReleaseCommit: RELEASE,
      expectedMigrationSetSha256: fixture.migrationSetSha256,
      encryptionKey: KEY,
    });

    expect(evidence.outcome).toBe("VALIDATED");
    expect(evidence.evidenceScope).toBe("LOCAL_SYNTHETIC");
    await expect(readFile(join(targetRoot, "database.sql"), "utf8")).resolves.toContain(
      "recovery_probe",
    );
    await expect(
      readFile(join(targetRoot, "storage", "products", "ebook.pdf"), "utf8"),
    ).resolves.toBe("private-pdf");
  });

  it("rejects ciphertext tampering", async () => {
    const fixture = await createFixture();
    const artifactPath = join(fixture.bundleRoot, fixture.manifest.database.artifact.file);
    const ciphertext = await readFile(artifactPath);
    ciphertext[0] = (ciphertext[0] ?? 0) ^ 0xff;
    await writeFile(artifactPath, ciphertext);
    await expect(
      verifyP16RecoveryBundle(fixture.bundleRoot, verificationOptions(fixture.migrationSetSha256)),
    ).rejects.toThrow("P16_RECOVERY_ARTIFACT_HASH_MISMATCH");
  });

  it("rejects ciphertext size mismatch", async () => {
    const fixture = await createFixture();
    const artifactPath = join(fixture.bundleRoot, fixture.manifest.database.artifact.file);
    await writeFile(artifactPath, "truncated");
    await expect(
      verifyP16RecoveryBundle(fixture.bundleRoot, verificationOptions(fixture.migrationSetSha256)),
    ).rejects.toThrow("P16_RECOVERY_ARTIFACT_SIZE_MISMATCH");
  });

  it("rejects a missing recovery artifact", async () => {
    const fixture = await createFixture();
    await unlink(join(fixture.bundleRoot, fixture.manifest.database.artifact.file));
    await expect(
      verifyP16RecoveryBundle(fixture.bundleRoot, verificationOptions(fixture.migrationSetSha256)),
    ).rejects.toThrow("P16_RECOVERY_ARTIFACT_MISSING");
  });

  it("rejects the wrong decryption key", async () => {
    const fixture = await createFixture();
    await expect(
      verifyP16RecoveryBundle(fixture.bundleRoot, {
        ...verificationOptions(fixture.migrationSetSha256),
        encryptionKey: randomBytes(32),
      }),
    ).rejects.toThrow("P16_RECOVERY_DECRYPTION_FAILED");
  });

  it.each([
    ["environmentId", "different-staging", "P16_RECOVERY_ENVIRONMENT_MISMATCH"],
    ["databaseName", "other_staging", "P16_RECOVERY_DATABASE_MISMATCH"],
    ["backupId", "other-backup", "P16_RECOVERY_BACKUP_ID_MISMATCH"],
    ["releaseCommit", "6".repeat(40), "P16_RECOVERY_RELEASE_MISMATCH"],
    ["migrationSetSha256", "a".repeat(64), "P16_RECOVERY_MIGRATION_IDENTITY_MISMATCH"],
  ])("rejects expected identity mismatch for %s", async (name, value, failure) => {
    const fixture = await createFixture();
    await expect(
      verifyP16RecoveryBundle(fixture.bundleRoot, {
        ...verificationOptions(fixture.migrationSetSha256),
        [name]: value,
      }),
    ).rejects.toThrow(failure);
  });

  it("rejects malformed or secret-bearing manifest data", async () => {
    const fixture = await createFixture();
    const manifestPath = join(fixture.bundleRoot, "manifest.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify({ ...fixture.manifest, databaseUrl: "mysql://u:p@host/db" })}\n`,
    );
    await expect(
      verifyP16RecoveryBundle(fixture.bundleRoot, verificationOptions(fixture.migrationSetSha256)),
    ).rejects.toThrow("P16_RECOVERY_MANIFEST_INVALID");
  });

  it("rejects invalid manifest migration metadata and release identity", async () => {
    const fixture = await createFixture();
    const manifestPath = join(fixture.bundleRoot, "manifest.json");
    const invalidMigration = structuredClone(fixture.manifest);
    invalidMigration.migrations[0]!.sha256 = "invalid";
    await writeFile(manifestPath, `${JSON.stringify(invalidMigration)}\n`);
    await expect(
      verifyP16RecoveryBundle(fixture.bundleRoot, verificationOptions(fixture.migrationSetSha256)),
    ).rejects.toThrow("P16_RECOVERY_MIGRATION_INVALID");

    const invalidRelease = structuredClone(fixture.manifest);
    invalidRelease.release.commit = "not-a-release";
    await writeFile(manifestPath, `${JSON.stringify(invalidRelease)}\n`);
    await expect(
      verifyP16RecoveryBundle(fixture.bundleRoot, verificationOptions(fixture.migrationSetSha256)),
    ).rejects.toThrow("P16_RECOVERY_RELEASE_INVALID");
  });

  it("refuses live/staging database restore targets and existing destinations", async () => {
    const fixture = await createFixture();
    const base = {
      bundleDirectory: fixture.bundleRoot,
      targetRoot: join(fixture.root, "target"),
      targetEnvironmentId: P16_ISOLATED_RECOVERY_ENVIRONMENT_ID,
      targetDatabaseName: "lessenc_test_recovery",
      expectedSourceDatabaseName: DATABASE,
      expectedBackupId: BACKUP_ID,
      expectedReleaseCommit: RELEASE,
      expectedMigrationSetSha256: fixture.migrationSetSha256,
      encryptionKey: KEY,
    };
    await expect(
      restoreP16RecoveryBundleIsolated({ ...base, targetEnvironmentId: "lessenc-staging" }),
    ).rejects.toThrow("P16_RESTORE_LIVE_ENVIRONMENT_REFUSED");
    await expect(
      restoreP16RecoveryBundleIsolated({ ...base, targetEnvironmentId: "production" }),
    ).rejects.toThrow("P16_RESTORE_LIVE_ENVIRONMENT_REFUSED");
    await expect(
      restoreP16RecoveryBundleIsolated({ ...base, targetDatabaseName: "lessenc_staging" }),
    ).rejects.toThrow("P16_RESTORE_DATABASE_TARGET_REFUSED");
    await mkdir(base.targetRoot);
    await expect(restoreP16RecoveryBundleIsolated(base)).rejects.toThrow(
      "P16_RESTORE_TARGET_EXISTS",
    );
  });

  it("refuses secret/config files in the private-storage source", async () => {
    const root = await temporaryRoot();
    const storageRoot = join(root, "storage");
    await mkdir(storageRoot);
    await writeFile(join(storageRoot, ".env"), "SECRET=value");
    await writeFile(join(root, "database.sql"), "SELECT 1;");
    await expect(
      createP16RecoveryBundle({
        backupId: BACKUP_ID,
        createdAt: "2026-09-26T12:00:00.000Z",
        releaseCommit: RELEASE,
        databaseName: DATABASE,
        databaseDumpPath: join(root, "database.sql"),
        storageRoot,
        outputRoot: join(root, "output"),
        repositoryRoot: resolve("."),
        encryptionKey: KEY,
      }),
    ).rejects.toThrow("P16_RECOVERY_STORAGE_SECRET_FILE_REFUSED");
  });

  it("fails closed on missing storage and removes the incomplete bundle", async () => {
    const root = await temporaryRoot();
    const outputRoot = join(root, "output");
    await writeFile(join(root, "database.sql"), "SELECT 1;");
    await expect(
      createP16RecoveryBundle({
        backupId: BACKUP_ID,
        createdAt: "2026-09-26T12:00:00.000Z",
        releaseCommit: RELEASE,
        databaseName: DATABASE,
        databaseDumpPath: join(root, "database.sql"),
        storageRoot: join(root, "missing-storage"),
        outputRoot,
        repositoryRoot: resolve("."),
        encryptionKey: KEY,
      }),
    ).rejects.toThrow();
    expect(await readdir(outputRoot)).toEqual([]);
  });

  it("validates only canonical 32-byte base64 keys", () => {
    expect(decodeRecoveryEncryptionKey(KEY.toString("base64"))).toEqual(KEY);
    expect(() => decodeRecoveryEncryptionKey("not-a-valid-key")).toThrow(
      "P16_RECOVERY_KEY_INVALID",
    );
  });
});

describe("P16 recovery objectives and rollback separation", () => {
  it("classifies RPO as PASS, FAIL or UNKNOWN against 24 hours", () => {
    expect(
      measureP16Rpo({
        observedAt: "2026-09-26T12:00:00.000Z",
        latestVerifiedBackupAt: "2026-09-25T12:00:00.000Z",
        evidenceScope: "HOSTED_STAGING",
      }).status,
    ).toBe("PASS");
    expect(
      measureP16Rpo({
        observedAt: "2026-09-26T12:00:01.000Z",
        latestVerifiedBackupAt: "2026-09-25T12:00:00.000Z",
        evidenceScope: "HOSTED_STAGING",
      }).status,
    ).toBe("FAIL");
    expect(
      measureP16Rpo({ observedAt: "2026-09-26T12:00:00.000Z", latestVerifiedBackupAt: null }),
    ).toMatchObject({ status: "UNKNOWN", reason: "NO_HOSTED_EVIDENCE" });
    expect(
      measureP16Rpo({
        observedAt: "2026-09-26T12:00:00.000Z",
        latestVerifiedBackupAt: "2026-09-26T11:00:00.000Z",
        evidenceScope: "LOCAL_SYNTHETIC",
      }),
    ).toMatchObject({ status: "UNKNOWN", reason: "NO_HOSTED_EVIDENCE" });
  });

  it("classifies RTO as PASS, FAIL or UNKNOWN only from validated evidence", () => {
    expect(
      measureP16Rto({
        recoveryStartedAt: "2026-09-26T00:00:00.000Z",
        recoveryValidatedAt: "2026-09-26T08:00:00.000Z",
        validationOutcome: "VALIDATED",
        evidenceScope: "HOSTED_STAGING",
      }).status,
    ).toBe("PASS");
    expect(
      measureP16Rto({
        recoveryStartedAt: "2026-09-26T00:00:00.000Z",
        recoveryValidatedAt: "2026-09-26T08:00:01.000Z",
        validationOutcome: "VALIDATED",
        evidenceScope: "HOSTED_STAGING",
      }).status,
    ).toBe("FAIL");
    expect(measureP16Rto({ validationOutcome: "VALIDATED" })).toMatchObject({
      status: "UNKNOWN",
      reason: "NO_VALIDATED_RECOVERY_EVIDENCE",
    });
    expect(
      measureP16Rto({
        recoveryStartedAt: "2026-09-26T00:00:00.000Z",
        recoveryValidatedAt: "2026-09-26T01:00:00.000Z",
        validationOutcome: "VALIDATED",
        evidenceScope: "LOCAL_SYNTHETIC",
      }),
    ).toMatchObject({
      status: "UNKNOWN",
      localAssessment: "PASS",
      reason: "LOCAL_EVIDENCE_NOT_HOSTED_PROOF",
    });
  });

  it("keeps application rollback plan-only and refuses schema-incompatible targets", () => {
    const digest = "a".repeat(64);
    expect(
      planP16ApplicationRollback({
        environmentId: P16_STAGING_ENVIRONMENT_ID,
        currentRelease: "1".repeat(40),
        targetRelease: "2".repeat(40),
        targetApproved: true,
        currentMigrationSetSha256: digest,
        targetCompatibleMigrationSetSha256: digest,
      }),
    ).toMatchObject({
      mode: "APPLICATION_ROLLBACK_PLAN_ONLY",
      databaseRestore: false,
      schemaRollback: false,
      requiresExplicitDeploymentAuthorization: true,
    });
    expect(() =>
      planP16ApplicationRollback({
        environmentId: P16_STAGING_ENVIRONMENT_ID,
        currentRelease: "1".repeat(40),
        targetRelease: "2".repeat(40),
        targetApproved: true,
        currentMigrationSetSha256: digest,
        targetCompatibleMigrationSetSha256: "b".repeat(64),
      }),
    ).toThrow("P16_ROLLBACK_SCHEMA_INCOMPATIBLE");
  });
});
