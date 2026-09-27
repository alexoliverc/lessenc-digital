export const P16_RECOVERY_MANIFEST_VERSION: 2;
export const P16_STAGING_ENVIRONMENT_ID: "lessenc-staging";
export const P16_ISOLATED_RECOVERY_ENVIRONMENT_ID: "lessenc-recovery-test";
export const P16_RPO_TARGET_SECONDS: 86400;
export const P16_RTO_TARGET_SECONDS: 28800;

export function decodeRecoveryEncryptionKey(value: string): Buffer;
export function sha256File(path: string): Promise<string>;
export function collectP16MigrationMetadata(
  repositoryRoot: string,
): Promise<readonly Readonly<{ name: string; sha256: string }>[]>;
export function calculateP16MigrationSetSha256(
  migrations: readonly Readonly<{ name: string; sha256: string }>[],
): string;
export function validateStagingDatabaseBackupEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): Readonly<{
  hostname: string;
  port: string;
  databaseName: string;
  username: string;
  tlsCaFile: string;
  environmentId: "lessenc-staging";
  dumpMode: "SINGLE_TRANSACTION_NO_LOCKS";
}>;
export function stagingMysqlDumpArguments(
  configuration: ReturnType<typeof validateStagingDatabaseBackupEnvironment>,
): readonly string[];
export function createStagingDatabaseDump(
  input: Readonly<{
    env: Readonly<Record<string, string | undefined>>;
    destinationPath: string;
    command?: string;
    commandPrefixArguments?: readonly string[];
  }>,
): Promise<
  Readonly<{
    destinationPath: string;
    databaseName: string;
    environmentId: "lessenc-staging";
    snapshotMode: "SINGLE_TRANSACTION_NO_LOCKS";
    bytes: number;
    sha256: string;
    boundedDiagnosticBytes: number;
  }>
>;

type RecoveryBundleOptions = Readonly<{
  encryptionKey: string | Buffer;
  environmentId?: string;
  databaseName?: string;
  backupId?: string;
  releaseCommit?: string;
  migrationSetSha256?: string;
}>;

export function createP16RecoveryBundle(
  input: Readonly<{
    backupId: string;
    createdAt: string | Date;
    releaseCommit: string;
    databaseName: string;
    databaseDumpPath: string;
    storageRoot: string;
    outputRoot: string;
    repositoryRoot: string;
    encryptionKey: string | Buffer;
  }>,
): Promise<Readonly<{ bundleDirectory: string; manifest: Readonly<Record<string, unknown>> }>>;

export function verifyP16RecoveryBundle(
  bundleDirectory: string,
  options: RecoveryBundleOptions,
): Promise<
  Readonly<{
    manifest: Readonly<Record<string, unknown>>;
    storageIndex: readonly Readonly<{ relativePath: string; artifactFile: string }>[];
  }>
>;

export function restoreP16RecoveryBundleIsolated(
  input: Readonly<{
    bundleDirectory: string;
    targetRoot: string;
    targetEnvironmentId: string;
    targetDatabaseName: string;
    expectedSourceDatabaseName: string;
    expectedBackupId: string;
    expectedReleaseCommit: string;
    expectedMigrationSetSha256: string;
    encryptionKey: string | Buffer;
  }>,
): Promise<
  Readonly<{
    evidenceVersion: number;
    outcome: "VALIDATED";
    evidenceScope: "LOCAL_SYNTHETIC";
    targetEnvironmentId: string;
    targetDatabaseName: string;
    backupId: string;
    sourceEnvironmentId: string;
    releaseCommit: string;
    migrationSetSha256: string;
    recoveryStartedAt: string;
    recoveryValidatedAt: string;
    durationMs: number;
  }>
>;

export function measureP16Rpo(
  input: Readonly<{
    observedAt: string | Date;
    latestVerifiedBackupAt?: string | Date | null;
    evidenceScope?: string | null;
  }>,
): Readonly<{
  status: "PASS" | "FAIL" | "UNKNOWN";
  targetSeconds: 86400;
  ageSeconds: number | null;
  reason: string;
}>;

export function measureP16Rto(
  input: Readonly<{
    recoveryStartedAt?: string | Date | null;
    recoveryValidatedAt?: string | Date | null;
    validationOutcome?: string | null;
    evidenceScope?: string | null;
  }>,
): Readonly<{
  status: "PASS" | "FAIL" | "UNKNOWN";
  targetSeconds: 28800;
  durationSeconds: number | null;
  localAssessment: "PASS" | "FAIL" | null;
  reason: string;
}>;

export function planP16ApplicationRollback(
  input: Readonly<{
    environmentId: string;
    currentRelease: string;
    targetRelease: string;
    targetApproved: boolean;
    currentMigrationSetSha256: string;
    targetCompatibleMigrationSetSha256: string;
  }>,
): Readonly<{
  mode: "APPLICATION_ROLLBACK_PLAN_ONLY";
  environmentId: string;
  currentRelease: string;
  targetRelease: string;
  migrationSetSha256: string;
  databaseRestore: false;
  schemaRollback: false;
  requiresExplicitDeploymentAuthorization: true;
}>;
