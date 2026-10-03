import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { afterEach, describe, expect, it } from "vitest";

import {
  type P16ControlledOperatorAssistedHostedRtoEvidence,
  P16_ISOLATED_RECOVERY_ENVIRONMENT_ID,
  P16_STAGING_ENVIRONMENT_ID,
  calculateP16MigrationSetSha256,
  calculateP16Rpo,
  calculateP16Rto,
  collectP16MigrationMetadata,
  createP16RecoveryBundle,
  createStagingDatabaseDump,
  decodeRecoveryEncryptionKey,
  evaluateP16HostedRpoEvidence,
  evaluateP16HostedRtoEvidence,
  inspectMariaDbDumpClient,
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
const KEY_ID = "p16-staging-2026-09";
const roots = new Set<string>();

function controlledOperatorAssistedRtoEvidence(
  durationMs = 28_800_000,
): P16ControlledOperatorAssistedHostedRtoEvidence {
  const recoveryStartedAt = "2026-09-26T00:00:00.000Z";
  return {
    evidenceType: "P16_HOSTED_RECOVERY_VALIDATION",
    evidenceScope: "HOSTED_STAGING",
    provenance: "CONTROLLED_OPERATOR_ASSISTED_RECOVERY_RUN",
    validationOutcome: "VALIDATED",
    recoveryStartedAt,
    recoveryValidatedAt: new Date(Date.parse(recoveryStartedAt) + durationMs).toISOString(),
    timestampAuthority: "RECOVERY_CONTROLLER",
    providerPrivilegeRotationRequired: true,
    providerPrivilegeRotationMode: "EXTERNAL_PROVIDER_CONTROL",
    databaseRestoreValidation: "VALIDATED",
    r2RestoreValidation: "VALIDATED",
    finalRuntimePrivilegeValidation: "VALIDATED",
    authenticatedHostedReadiness: "PASS",
    hostedSmokeValidation: "PASS",
  };
}

function evaluateUncheckedHostedRtoEvidence(evidence: Readonly<Record<string, unknown>>) {
  return evaluateP16HostedRtoEvidence(evidence as never);
}

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
  manifestIntegrity: { algorithm: string; keyId: string; mac: string };
};

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "lessenc-p16-recovery-"));
  roots.add(root);
  return root;
}

async function writeSyntheticDumpEvidence(root: string) {
  const dumpPath = join(root, "database.sql");
  const dump = "CREATE TABLE recovery_probe(id INT);\n";
  await writeFile(dumpPath, dump, "utf8");
  const evidencePath = `${dumpPath}.evidence.json`;
  await writeFile(
    evidencePath,
    `${JSON.stringify(
      {
        evidenceVersion: 1,
        evidenceType: "P16_DATABASE_DUMP",
        generatedBy: "scripts/p16-recovery.mjs",
        startedAt: "2026-09-26T11:59:59.000Z",
        completedAt: "2026-09-26T12:00:00.000Z",
        source: {
          environmentId: P16_STAGING_ENVIRONMENT_ID,
          database: { hostname: "db.example.internal", port: "3306", name: DATABASE },
        },
        artifact: {
          file: "database.sql",
          bytes: Buffer.byteLength(dump),
          sha256: createHash("sha256").update(dump).digest("hex"),
        },
        dumpClient: { family: "mariadb", version: "10.11.8", executable: "mariadb-dump" },
        snapshot: {
          mode: "SINGLE_TRANSACTION_NO_LOCKS",
          transport: "TLS_VERIFIED",
          tlsCaSha256: SYNTHETIC_CA_SHA256,
        },
        release: { commit: RELEASE, authority: "REPOSITORY_HEAD_BOUND" },
      },
      null,
      2,
    )}\n`,
  );
  return evidencePath;
}

const SYNTHETIC_CA_CONTENT = "synthetic-ca";

const SYNTHETIC_CA_SHA256 = createHash("sha256").update(SYNTHETIC_CA_CONTENT, "utf8").digest("hex");

async function createExpectedDatabaseConfiguration(root: string) {
  const tlsCaFile = join(root, "hosted-ca.pem");

  await writeFile(tlsCaFile, SYNTHETIC_CA_CONTENT, "utf8");

  return {
    hostname: "db.example.internal",
    port: "3306",
    databaseName: DATABASE,
    tlsCaFile,
    environmentId: P16_STAGING_ENVIRONMENT_ID,
    dumpMode: "SINGLE_TRANSACTION_NO_LOCKS",
  };
}

type SyntheticDumpEvidenceForMutation = {
  source: {
    environmentId: string;
    database: {
      hostname: string;
      port: string;
      name: string;
    };
  };
  dumpClient: {
    family: string;
    version: string;
    executable: string;
  };
  snapshot: {
    mode: string;
    transport: string;
    tlsCaSha256: string;
  };
};

async function mutateSyntheticDumpEvidence(
  evidencePath: string,
  mutate: (evidence: SyntheticDumpEvidenceForMutation) => void,
) {
  const evidence = JSON.parse(
    await readFile(evidencePath, "utf8"),
  ) as SyntheticDumpEvidenceForMutation;

  mutate(evidence);

  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

async function expectDatabaseEvidenceRejected(
  mutate: (evidence: SyntheticDumpEvidenceForMutation) => void,
  expectedFailureCode: string,
) {
  const root = await temporaryRoot();
  const storageRoot = join(root, "storage");

  await mkdir(storageRoot);

  const evidencePath = await writeSyntheticDumpEvidence(root);

  await mutateSyntheticDumpEvidence(evidencePath, mutate);

  await expect(
    createP16RecoveryBundle({
      backupId: BACKUP_ID,
      databaseEvidencePath: evidencePath,
      expectedDatabaseConfiguration: await createExpectedDatabaseConfiguration(root),
      storageRoot,
      outputRoot: join(root, "output"),
      repositoryRoot: resolve("."),
      encryptionKey: KEY,
      encryptionKeyId: KEY_ID,
      resolveHead: () => RELEASE,
    }),
  ).rejects.toThrow(expectedFailureCode);
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
  const dumpBytes = Buffer.byteLength("CREATE TABLE recovery_probe(id INT);\n", "utf8");
  const dumpSha256 = createHash("sha256")
    .update("CREATE TABLE recovery_probe(id INT);\n", "utf8")
    .digest("hex");
  const evidencePath = `${dumpPath}.evidence.json`;
  await writeFile(
    evidencePath,
    `${JSON.stringify(
      {
        evidenceVersion: 1,
        evidenceType: "P16_DATABASE_DUMP",
        generatedBy: "scripts/p16-recovery.mjs",
        startedAt: "2026-09-26T11:59:59.000Z",
        completedAt: "2026-09-26T12:00:00.000Z",
        source: {
          environmentId: P16_STAGING_ENVIRONMENT_ID,
          database: { hostname: "db.example.internal", port: "3306", name: DATABASE },
        },
        artifact: { file: "database.sql", bytes: dumpBytes, sha256: dumpSha256 },
        dumpClient: { family: "mariadb", version: "10.11.8", executable: "mariadb-dump" },
        snapshot: {
          mode: "SINGLE_TRANSACTION_NO_LOCKS",
          transport: "TLS_VERIFIED",
          tlsCaSha256: SYNTHETIC_CA_SHA256,
        },
        release: { commit: RELEASE, authority: "REPOSITORY_HEAD_BOUND" },
      },
      null,
      2,
    )}\n`,
  );
  const result = await createP16RecoveryBundle({
    backupId: BACKUP_ID,
    databaseEvidencePath: evidencePath,
    expectedDatabaseConfiguration: await createExpectedDatabaseConfiguration(root),
    storageRoot,
    outputRoot,
    repositoryRoot: resolve("."),
    encryptionKey: KEY,
    encryptionKeyId: KEY_ID,
    resolveHead: () => RELEASE,
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
    encryptionKeyId: KEY_ID,
    repositoryRoot: resolve("."),
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
  async function validEnvironment(root: string) {
    const ca = join(root, "hosted-ca.pem");
    await writeFile(ca, "synthetic-ca", "utf8");
    return {
      APP_ENV: "staging",
      NODE_ENV: "production",
      P16_STAGING_ENVIRONMENT_ID: P16_STAGING_ENVIRONMENT_ID,
      P16_DATABASE_ACCESS_MODEL: "distinct-users",
      P16_DATABASE_MIGRATION_WINDOW: "disabled",
      P16_DATABASE_EXPECTED_HOST: "db.example.internal",
      P16_DATABASE_DUMP_CLIENT: "mariadb",
      P16_RELEASE_COMMIT: RELEASE,
      DB_TLS_CA_FILE: ca,
      DATABASE_URL: "mysql://migrate:private@db.example.internal:3306/lessenc_staging",
      DB_RUNTIME_URL: "mysql://runtime:private@db.example.internal:3306/lessenc_staging",
      PRIVATE_STORAGE_DRIVER: "hosted",
      P16_PRIVATE_STORAGE_PROVIDER: "r2",
    };
  }

  it("accepts only the exact hosted staging identity and returns no password", async () => {
    const root = await temporaryRoot();
    const configuration = await validateStagingDatabaseBackupEnvironment(
      await validEnvironment(root),
    );
    expect(configuration).toMatchObject({
      hostname: "db.example.internal",
      databaseName: DATABASE,
      environmentId: P16_STAGING_ENVIRONMENT_ID,
      dumpMode: "SINGLE_TRANSACTION_NO_LOCKS",
    });
    expect(Object.keys(configuration)).not.toContain("password");
    expect(JSON.stringify(configuration)).not.toContain(":private@");
  });

  it("builds a MariaDB TLS-verified invocation without MySQL-only GTID flags", async () => {
    const root = await temporaryRoot();
    const configuration = await validateStagingDatabaseBackupEnvironment(
      await validEnvironment(root),
    );
    const args = stagingMysqlDumpArguments(configuration);
    expect(args).toEqual(
      expect.arrayContaining([
        "--ssl-verify-server-cert",
        "--single-transaction",
        "--quick",
        "--skip-lock-tables",
        "--no-defaults",
      ]),
    );
    expect(args).not.toContain("--set-gtid-purged=OFF");
    expect(args.join(" ")).not.toMatch(/--password|:private@|mysql:\/\//u);
  });

  it("streams a bounded database dump to an atomic destination and records integrity", async () => {
    const root = await temporaryRoot();
    const fixtureScript = join(root, "synthetic-dump.mjs");
    const destinationPath = join(root, "staging.sql");
    await writeFile(
      fixtureScript,
      `const mode = process.argv.at(-1);
if (mode === "--version") process.stdout.write("mariadb-dump Ver 10.11.8-MariaDB\\n");
else if (mode === "--help") process.stdout.write("--ssl-ca --ssl-verify-server-cert --single-transaction\\n");
else { process.stderr.write("synthetic diagnostic"); process.stdout.write("SELECT 1;\\n"); }
`,
    );
    const env = await validEnvironment(root);
    const times = [new Date("2026-09-26T11:59:59.000Z"), new Date("2026-09-26T12:00:00.000Z")];
    const evidence = await createStagingDatabaseDump({
      env: { ...process.env, ...env },
      destinationPath,
      repositoryRoot: resolve("."),
      command: process.execPath,
      commandPrefixArguments: [fixtureScript],
      resolveHead: () => RELEASE,
      clock: () => times.shift()!,
    });

    expect(evidence).toMatchObject({
      bytes: 10,
      boundedDiagnosticBytes: 20,
      evidence: {
        startedAt: "2026-09-26T11:59:59.000Z",
        completedAt: "2026-09-26T12:00:00.000Z",
        dumpClient: { family: "mariadb", version: "10.11.8" },
        release: { commit: RELEASE, authority: "REPOSITORY_HEAD_BOUND" },
      },
    });
    expect(evidence.sha256).toMatch(/^[0-9a-f]{64}$/u);
    await expect(readFile(evidence.destinationPath, "utf8")).resolves.toBe("SELECT 1;\n");
  });

  it("returns a generic failure and removes partial output after an interrupted dump", async () => {
    const root = await temporaryRoot();
    const fixtureScript = join(root, "interrupted-dump.mjs");
    const destinationPath = join(root, "staging.sql");
    const env = await validEnvironment(root);

    await writeFile(
      fixtureScript,
      `const mode = process.argv.at(-1);
if (mode === "--version") {
  process.stdout.write("mariadb-dump Ver 10.11.8-MariaDB\\n");
  process.exit(0);
}
if (mode === "--help") {
  process.stdout.write("--ssl-ca --ssl-verify-server-cert --single-transaction\\n");
  process.exit(0);
}
process.stdout.write("SELECT 1;\\n");
process.stderr.write("synthetic interrupted dump");
process.exit(7);
`,
      "utf8",
    );

    await expect(
      createStagingDatabaseDump({
        env: { ...process.env, ...env },
        destinationPath,
        repositoryRoot: resolve("."),
        command: process.execPath,
        commandPrefixArguments: [fixtureScript],
        resolveHead: () => RELEASE,
      }),
    ).rejects.toThrow("P16_BACKUP_DATABASE_DUMP_FAILED");

    const remaining = await readdir(root);

    expect(remaining).not.toContain("staging.sql");
    expect(remaining).not.toContain("staging.sql.evidence.json");
    expect(remaining.some((name) => name.startsWith("staging.sql.partial-"))).toBe(false);
  });

  it("refuses a database dump destination contained inside the repository root", async () => {
    const root = await temporaryRoot();
    const repositoryRoot = join(root, "synthetic-repository");
    const destinationPath = join(repositoryRoot, "backup", "staging.sql");
    const env = await validEnvironment(root);

    await mkdir(repositoryRoot);

    await expect(
      createStagingDatabaseDump({
        env: { ...process.env, ...env },
        destinationPath,
        repositoryRoot,
        resolveHead: () => RELEASE,
      }),
    ).rejects.toThrow("P16_BACKUP_DESTINATION_IN_REPOSITORY_REFUSED");
  });

  it.each([
    ["APP_ENV", "production", "P16_BACKUP_APP_ENV_INVALID"],
    ["NODE_ENV", "development", "P16_BACKUP_NODE_ENV_INVALID"],
    ["P16_DATABASE_MIGRATION_WINDOW", "enabled", "P16_DATABASE_MIGRATION_WINDOW_MUST_BE_DISABLED"],
    [
      "DB_RUNTIME_URL",
      "mysql://u:p@127.0.0.1:3307/lessenc_staging",
      "DB_RUNTIME_URL_NOT_UNAMBIGUOUS_STAGING",
    ],
    [
      "DB_RUNTIME_URL",
      "mysql://u:p@db.example.internal/lessenc_production",
      "DB_RUNTIME_URL_NOT_UNAMBIGUOUS_STAGING",
    ],
    ["PRIVATE_STORAGE_DRIVER", "filesystem", "P16_BACKUP_PRIVATE_STORAGE_INVALID"],
  ])("fails closed when %s is unsafe", async (name, value, failure) => {
    const root = await temporaryRoot();
    await expect(
      validateStagingDatabaseBackupEnvironment({
        ...(await validEnvironment(root)),
        [name]: value,
      }),
    ).rejects.toThrow(failure);
  });

  it.each(["localhost.", "[::1]", "127.0.0.2", "other.example.internal"])(
    "rejects non-canonical or unexpected database host %s",
    async (hostname) => {
      const root = await temporaryRoot();
      const env = await validEnvironment(root);
      env.DATABASE_URL = `mysql://migrate:private@${hostname}/lessenc_staging`;
      env.DB_RUNTIME_URL = `mysql://runtime:private@${hostname}/lessenc_staging`;
      await expect(validateStagingDatabaseBackupEnvironment(env)).rejects.toThrow(
        "P16_BACKUP_DATABASE_AUTHORITY_INVALID",
      );
    },
  );

  it.each([
    [
      "wrong family",
      'process.stdout.write(process.argv.at(-1) === "--version" ? "mysqldump Ver 8.4.0\\n" : "--ssl-ca --ssl-verify-server-cert --single-transaction\\n");',
      "P16_BACKUP_CLIENT_FAMILY_UNSUPPORTED",
    ],
    [
      "unsupported version",
      'process.stdout.write(process.argv.at(-1) === "--version" ? "mariadb-dump Ver 10.6.20-MariaDB\\n" : "--ssl-ca --ssl-verify-server-cert --single-transaction\\n");',
      "P16_BACKUP_CLIENT_VERSION_UNSUPPORTED",
    ],
    [
      "missing TLS capability",
      'process.stdout.write(process.argv.at(-1) === "--version" ? "mariadb-dump Ver 10.11.8-MariaDB\\n" : "--ssl-ca --single-transaction\\n");',
      "P16_BACKUP_CLIENT_CAPABILITY_MISSING",
    ],
  ])("fails deterministic client preflight for %s", async (_name, script, failure) => {
    const root = await temporaryRoot();
    const fixtureScript = join(root, "client-preflight.mjs");
    await writeFile(fixtureScript, script, "utf8");
    await expect(
      inspectMariaDbDumpClient({
        command: process.execPath,
        commandPrefixArguments: [fixtureScript],
        env: process.env,
      }),
    ).rejects.toThrow(failure);
  });

  it("rejects a TLS CA reached through a symlink", async () => {
    const root = await temporaryRoot();
    const env = await validEnvironment(root);
    const link = join(root, "linked-directory");
    await symlink(root, link, "junction");
    env.DB_TLS_CA_FILE = join(link, "hosted-ca.pem");
    await expect(validateStagingDatabaseBackupEnvironment(env)).rejects.toThrow(
      "P16_BACKUP_TLS_CA_INVALID",
    );
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
      encryptionKeyId: KEY_ID,
      repositoryRoot: resolve("."),
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
    ).rejects.toThrow("P16_RECOVERY_MANIFEST_INTEGRITY_INVALID");
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
    ).rejects.toThrow("P16_RECOVERY_MANIFEST_INTEGRITY_INVALID");
  });

  it.each([
    [
      "createdAt",
      (manifest: TestManifest) => {
        manifest.createdAt = "2026-09-26T12:00:01.000Z";
      },
    ],
    [
      "backup",
      (manifest: TestManifest) => {
        manifest.backupId = "tampered-backup";
      },
    ],
    [
      "release",
      (manifest: TestManifest) => {
        manifest.release.commit = "6".repeat(40);
      },
    ],
    [
      "database",
      (manifest: TestManifest) => {
        manifest.database.name = "other_staging";
      },
    ],
    [
      "artifact metadata",
      (manifest: TestManifest) => {
        manifest.database.artifact.file = "database/other.enc";
      },
    ],
    [
      "MAC",
      (manifest: TestManifest) => {
        manifest.manifestIntegrity.mac = "0".repeat(64);
      },
    ],
  ])("rejects %s manifest tampering before identity is trusted", async (_name, mutate) => {
    const fixture = await createFixture();
    const manifestPath = join(fixture.bundleRoot, "manifest.json");
    const manifest = structuredClone(fixture.manifest);
    mutate(manifest);
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    await expect(
      verifyP16RecoveryBundle(fixture.bundleRoot, verificationOptions(fixture.migrationSetSha256)),
    ).rejects.toThrow("P16_RECOVERY_MANIFEST_INTEGRITY_INVALID");
  });

  it("rejects database and storage artifacts spliced from another authenticated bundle", async () => {
    const first = await createFixture();
    const second = await createFixture();
    await writeFile(
      join(first.bundleRoot, first.manifest.database.artifact.file),
      await readFile(join(second.bundleRoot, second.manifest.database.artifact.file)),
    );
    await expect(
      verifyP16RecoveryBundle(first.bundleRoot, verificationOptions(first.migrationSetSha256)),
    ).rejects.toThrow("P16_RECOVERY_ARTIFACT_HASH_MISMATCH");
  });

  it("rejects a private-storage ciphertext spliced from another authenticated bundle", async () => {
    const first = await createFixture();
    const second = await createFixture();
    const firstArtifact = first.manifest.privateStorage.objectArtifacts[1]!;
    const secondArtifact = second.manifest.privateStorage.objectArtifacts[1]!;
    await writeFile(
      join(first.bundleRoot, firstArtifact.file),
      await readFile(join(second.bundleRoot, secondArtifact.file)),
    );
    await expect(
      verifyP16RecoveryBundle(first.bundleRoot, verificationOptions(first.migrationSetSha256)),
    ).rejects.toThrow("P16_RECOVERY_ARTIFACT_HASH_MISMATCH");
  });

  it("binds key rotation identity into the authenticated manifest", async () => {
    const fixture = await createFixture();
    await expect(
      verifyP16RecoveryBundle(fixture.bundleRoot, {
        ...verificationOptions(fixture.migrationSetSha256),
        encryptionKeyId: "other-key-id",
      }),
    ).rejects.toThrow("P16_RECOVERY_KEY_ID_MISMATCH");
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
      encryptionKeyId: KEY_ID,
      repositoryRoot: resolve("."),
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
    const evidencePath = await writeSyntheticDumpEvidence(root);
    await expect(
      createP16RecoveryBundle({
        backupId: BACKUP_ID,
        databaseEvidencePath: evidencePath,
        expectedDatabaseConfiguration: await createExpectedDatabaseConfiguration(root),
        storageRoot,
        outputRoot: join(root, "output"),
        repositoryRoot: resolve("."),
        encryptionKey: KEY,
        encryptionKeyId: KEY_ID,
        resolveHead: () => RELEASE,
      }),
    ).rejects.toThrow("P16_RECOVERY_STORAGE_SECRET_FILE_REFUSED");
  });

  it("fails closed on missing storage and removes the incomplete bundle", async () => {
    const root = await temporaryRoot();
    const outputRoot = join(root, "output");
    const evidencePath = await writeSyntheticDumpEvidence(root);
    await mkdir(outputRoot);
    await expect(
      createP16RecoveryBundle({
        backupId: BACKUP_ID,
        databaseEvidencePath: evidencePath,
        expectedDatabaseConfiguration: await createExpectedDatabaseConfiguration(root),
        storageRoot: join(root, "missing-storage"),
        outputRoot,
        repositoryRoot: resolve("."),
        encryptionKey: KEY,
        encryptionKeyId: KEY_ID,
        resolveHead: () => RELEASE,
      }),
    ).rejects.toThrow();
    expect(await readdir(outputRoot)).toEqual([]);
  });

  it("rejects dump evidence with a different staging environment identity", async () => {
    await expectDatabaseEvidenceRejected((evidence) => {
      evidence.source.environmentId = "lessenc-staging-other";
    }, "P16_RECOVERY_DUMP_EVIDENCE_INVALID");
  });

  it("rejects dump evidence whose database hostname differs from canonical staging", async () => {
    await expectDatabaseEvidenceRejected((evidence) => {
      evidence.source.database.hostname = "db-other.example.internal";
    }, "P16_RECOVERY_DATABASE_EVIDENCE_MISMATCH");
  });

  it("rejects dump evidence whose database port differs from canonical staging", async () => {
    await expectDatabaseEvidenceRejected((evidence) => {
      evidence.source.database.port = "3307";
    }, "P16_RECOVERY_DATABASE_EVIDENCE_MISMATCH");
  });

  it("rejects dump evidence whose database name differs from canonical staging", async () => {
    await expectDatabaseEvidenceRejected((evidence) => {
      evidence.source.database.name = "lessenc_other_staging";
    }, "P16_RECOVERY_DATABASE_EVIDENCE_MISMATCH");
  });

  it("rejects dump evidence whose TLS CA digest differs from the validated CA", async () => {
    await expectDatabaseEvidenceRejected((evidence) => {
      evidence.snapshot.tlsCaSha256 = "b".repeat(64);
    }, "P16_RECOVERY_DATABASE_EVIDENCE_MISMATCH");
  });

  it("rejects dump evidence with a different snapshot mode", async () => {
    await expectDatabaseEvidenceRejected((evidence) => {
      evidence.snapshot.mode = "SINGLE_TRANSACTION_WITH_LOCKS";
    }, "P16_RECOVERY_DUMP_EVIDENCE_INVALID");
  });

  it("rejects dump evidence produced by a non-MariaDB client family", async () => {
    await expectDatabaseEvidenceRejected((evidence) => {
      evidence.dumpClient.family = "mysql";
    }, "P16_RECOVERY_DUMP_EVIDENCE_INVALID");
  });

  it("rejects dump evidence whose bytes/hash no longer match the regular dump file", async () => {
    const root = await temporaryRoot();
    const storageRoot = join(root, "storage");
    await mkdir(storageRoot);
    const evidencePath = await writeSyntheticDumpEvidence(root);
    await writeFile(join(root, "database.sql"), "tampered dump", "utf8");
    await expect(
      createP16RecoveryBundle({
        backupId: BACKUP_ID,
        databaseEvidencePath: evidencePath,
        expectedDatabaseConfiguration: await createExpectedDatabaseConfiguration(root),
        storageRoot,
        outputRoot: join(root, "output"),
        repositoryRoot: resolve("."),
        encryptionKey: KEY,
        encryptionKeyId: KEY_ID,
        resolveHead: () => RELEASE,
      }),
    ).rejects.toThrow("P16_RECOVERY_DUMP_EVIDENCE_ARTIFACT_MISMATCH");
  });

  it("rejects machine dump evidence whose release is not the repository HEAD", async () => {
    const root = await temporaryRoot();
    const storageRoot = join(root, "storage");
    await mkdir(storageRoot);
    const evidencePath = await writeSyntheticDumpEvidence(root);
    await expect(
      createP16RecoveryBundle({
        backupId: BACKUP_ID,
        databaseEvidencePath: evidencePath,
        expectedDatabaseConfiguration: await createExpectedDatabaseConfiguration(root),
        storageRoot,
        outputRoot: join(root, "output"),
        repositoryRoot: resolve("."),
        encryptionKey: KEY,
        encryptionKeyId: KEY_ID,
        resolveHead: () => "6".repeat(40),
      }),
    ).rejects.toThrow("P16_RELEASE_COMMIT_DOES_NOT_MATCH_HEAD");
  });

  it("refuses repository-contained storage and output paths", async () => {
    const root = await temporaryRoot();
    const evidencePath = await writeSyntheticDumpEvidence(root);
    const storageRoot = join(root, "storage");
    await mkdir(storageRoot);
    const base = {
      backupId: BACKUP_ID,
      databaseEvidencePath: evidencePath,
      expectedDatabaseConfiguration: await createExpectedDatabaseConfiguration(root),
      storageRoot,
      outputRoot: join(root, "output"),
      repositoryRoot: resolve("."),
      encryptionKey: KEY,
      encryptionKeyId: KEY_ID,
      resolveHead: () => RELEASE,
    };
    await expect(
      createP16RecoveryBundle({ ...base, storageRoot: resolve("prisma") }),
    ).rejects.toThrow("P16_RECOVERY_STORAGE_IN_REPOSITORY_REFUSED");
    await expect(
      createP16RecoveryBundle({ ...base, outputRoot: resolve("output", "p16-forbidden") }),
    ).rejects.toThrow("P16_RECOVERY_OUTPUT_IN_REPOSITORY_REFUSED");
  });

  it("refuses canonical overlap between storage source and bundle output", async () => {
    const root = await temporaryRoot();
    const evidencePath = await writeSyntheticDumpEvidence(root);
    const storageRoot = join(root, "storage");
    await mkdir(storageRoot);
    await expect(
      createP16RecoveryBundle({
        backupId: BACKUP_ID,
        databaseEvidencePath: evidencePath,
        expectedDatabaseConfiguration: await createExpectedDatabaseConfiguration(root),
        storageRoot,
        outputRoot: join(storageRoot, "bundles"),
        repositoryRoot: resolve("."),
        encryptionKey: KEY,
        encryptionKeyId: KEY_ID,
        resolveHead: () => RELEASE,
      }),
    ).rejects.toThrow("P16_RECOVERY_OUTPUT_OVERLAP");
  });

  it("rejects canonical path escapes through storage and output symlinks", async () => {
    const root = await temporaryRoot();
    const realStorage = join(root, "real-storage");
    const realOutput = join(root, "real-output");
    await mkdir(realStorage);
    await mkdir(realOutput);
    const storageLink = join(root, "storage-link");
    const outputLink = join(root, "output-link");
    await symlink(realStorage, storageLink, "junction");
    await symlink(realOutput, outputLink, "junction");
    const evidencePath = await writeSyntheticDumpEvidence(root);
    const base = {
      backupId: BACKUP_ID,
      databaseEvidencePath: evidencePath,
      expectedDatabaseConfiguration: await createExpectedDatabaseConfiguration(root),
      outputRoot: realOutput,
      storageRoot: realStorage,
      repositoryRoot: resolve("."),
      encryptionKey: KEY,
      encryptionKeyId: KEY_ID,
      resolveHead: () => RELEASE,
    };
    await expect(createP16RecoveryBundle({ ...base, storageRoot: storageLink })).rejects.toThrow(
      "P16_RECOVERY_STORAGE_ROOT_INVALID",
    );
    await expect(createP16RecoveryBundle({ ...base, outputRoot: outputLink })).rejects.toThrow(
      "P16_RECOVERY_OUTPUT_ROOT_INVALID",
    );
  });

  it("validates only canonical 32-byte base64 keys", () => {
    expect(decodeRecoveryEncryptionKey(KEY.toString("base64"))).toEqual(KEY);
    expect(() => decodeRecoveryEncryptionKey("not-a-valid-key")).toThrow(
      "P16_RECOVERY_KEY_INVALID",
    );
  });
});

describe("P16 recovery objectives and rollback separation", () => {
  it("uses exact millisecond RPO boundaries and raw scope strings cannot manufacture PASS", () => {
    const observedAt = "2026-09-26T12:00:00.000Z";
    for (const [deltaMs, assessment] of [
      [86_399_999, "PASS"],
      [86_400_000, "PASS"],
      [86_400_001, "FAIL"],
    ] as const) {
      expect(
        calculateP16Rpo({
          observedAt,
          latestVerifiedBackupAt: new Date(Date.parse(observedAt) - deltaMs),
        }),
      ).toMatchObject({
        assessment,
        ageMs: deltaMs,
      });
    }
    expect(
      measureP16Rpo({ observedAt: "2026-09-26T12:00:00.000Z", latestVerifiedBackupAt: null }),
    ).toMatchObject({ status: "UNKNOWN", reason: "NO_DIAGNOSTIC_INPUT" });
    expect(
      measureP16Rpo({
        observedAt: "2026-09-26T12:00:00.000Z",
        latestVerifiedBackupAt: "2026-09-26T11:00:00.000Z",
        evidenceScope: "HOSTED_STAGING",
      }),
    ).toMatchObject({
      status: "UNKNOWN",
      localAssessment: "PASS",
      reason: "RAW_INPUT_NOT_AUTHORITATIVE_HOSTED_EVIDENCE",
    });
    const scheduledObservation = {
      evidenceType: "P16_HOSTED_BACKUP_OBSERVATION" as const,
      evidenceScope: "HOSTED_STAGING" as const,
      provenance: "AUTOMATED_PROVIDER_OBSERVATION" as const,
      outcome: "VERIFIED" as const,
      observedAt,
      latestVerifiedBackupAt: new Date(Date.parse(observedAt) - 86_400_001).toISOString(),
    };
    expect(() => evaluateP16HostedRpoEvidence(scheduledObservation as never)).toThrow(
      "P16_RPO_HOSTED_EVIDENCE_INVALID",
    );
    expect(
      evaluateP16HostedRpoEvidence({
        ...scheduledObservation,
        backupId: "p16-hosted-auto-20260926T120000000Z-0123456789abcdef",
        executionAuthority: "PROVIDER_SCHEDULED_EXECUTION",
        executionContext: "PROVIDER_SCHEDULED",
        rpoAuthority: "AUTHORITATIVE_PROVIDER_SCHEDULER_CORRELATION",
        providerSchedulerAttestation: "INDEPENDENT_PROVIDER_HISTORY_VERIFIED",
      }),
    ).toMatchObject({ status: "FAIL", ageMs: 86_400_001 });
  });

  it("uses exact millisecond RTO boundaries and preserves automated hosted evidence", () => {
    const recoveryStartedAt = "2026-09-26T00:00:00.000Z";
    for (const [deltaMs, assessment] of [
      [28_799_999, "PASS"],
      [28_800_000, "PASS"],
      [28_800_001, "FAIL"],
    ] as const) {
      expect(
        calculateP16Rto({
          recoveryStartedAt,
          recoveryValidatedAt: new Date(Date.parse(recoveryStartedAt) + deltaMs),
        }),
      ).toMatchObject({
        assessment,
        durationMs: deltaMs,
      });
    }
    expect(measureP16Rto({ validationOutcome: "VALIDATED" })).toMatchObject({
      status: "UNKNOWN",
      reason: "NO_VALIDATED_RECOVERY_EVIDENCE",
    });
    expect(
      measureP16Rto({
        recoveryStartedAt: "2026-09-26T00:00:00.000Z",
        recoveryValidatedAt: "2026-09-26T01:00:00.000Z",
        validationOutcome: "VALIDATED",
        evidenceScope: "HOSTED_STAGING",
        provenance: "CONTROLLED_OPERATOR_ASSISTED_RECOVERY_RUN",
      }),
    ).toMatchObject({
      status: "UNKNOWN",
      localAssessment: "PASS",
      reason: "RAW_INPUT_NOT_AUTHORITATIVE_HOSTED_EVIDENCE",
    });
    expect(
      evaluateP16HostedRtoEvidence({
        evidenceType: "P16_HOSTED_RECOVERY_VALIDATION",
        evidenceScope: "HOSTED_STAGING",
        provenance: "AUTOMATED_RECOVERY_RUN",
        validationOutcome: "VALIDATED",
        recoveryStartedAt,
        recoveryValidatedAt: new Date(Date.parse(recoveryStartedAt) + 28_800_000).toISOString(),
      }),
    ).toMatchObject({ status: "PASS", durationMs: 28_800_000 });
  });

  it("accepts only complete controlled operator-assisted hosted recovery evidence", () => {
    expect(evaluateP16HostedRtoEvidence(controlledOperatorAssistedRtoEvidence())).toMatchObject({
      status: "PASS",
      durationMs: 28_800_000,
    });

    expect(
      evaluateP16HostedRtoEvidence(controlledOperatorAssistedRtoEvidence(28_800_001)),
    ).toMatchObject({ status: "FAIL", durationMs: 28_800_001 });
  });

  it("rejects incomplete or invalid privilege-rotation and final-validation evidence", () => {
    const valid = controlledOperatorAssistedRtoEvidence();
    const missingRotationMode: Record<string, unknown> = { ...valid };
    delete missingRotationMode.providerPrivilegeRotationMode;

    expect(() => evaluateUncheckedHostedRtoEvidence(missingRotationMode)).toThrow(
      "P16_RTO_HOSTED_EVIDENCE_INVALID",
    );
    expect(() =>
      evaluateUncheckedHostedRtoEvidence({
        ...valid,
        providerPrivilegeRotationRequired: false,
      }),
    ).toThrow("P16_RTO_HOSTED_EVIDENCE_INVALID");
    expect(() =>
      evaluateUncheckedHostedRtoEvidence({
        ...valid,
        finalRuntimePrivilegeValidation: "FAILED",
      }),
    ).toThrow("P16_RTO_HOSTED_EVIDENCE_INVALID");
    expect(() =>
      evaluateUncheckedHostedRtoEvidence({
        ...valid,
        hostedSmokeValidation: "UNKNOWN",
      }),
    ).toThrow("P16_RTO_HOSTED_EVIDENCE_INVALID");
  });

  it("rejects manual provenance and extra or missing assisted evidence fields", () => {
    const valid = controlledOperatorAssistedRtoEvidence();
    const missingR2Validation: Record<string, unknown> = { ...valid };
    delete missingR2Validation.r2RestoreValidation;

    expect(() =>
      evaluateUncheckedHostedRtoEvidence({
        ...valid,
        provenance: "MANUAL_OPERATOR_TIMESTAMPS",
      }),
    ).toThrow("P16_RTO_HOSTED_EVIDENCE_INVALID");
    expect(() =>
      evaluateUncheckedHostedRtoEvidence({
        ...valid,
        operatorSuppliedStartedAt: valid.recoveryStartedAt,
      }),
    ).toThrow("P16_RTO_HOSTED_EVIDENCE_INVALID");
    expect(() => evaluateUncheckedHostedRtoEvidence(missingR2Validation)).toThrow(
      "P16_RTO_HOSTED_EVIDENCE_INVALID",
    );
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
