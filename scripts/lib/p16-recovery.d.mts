export const P16_RECOVERY_MANIFEST_VERSION: 2;
export const P16_STAGING_ENVIRONMENT_ID: "lessenc-staging";
export const P16_ISOLATED_RECOVERY_ENVIRONMENT_ID: "lessenc-recovery-test";
export const P16_RPO_TARGET_SECONDS: 86400;
export const P16_RTO_TARGET_SECONDS: 28800;
export const P16_RPO_TARGET_MS: 86400000;
export const P16_RTO_TARGET_MS: 28800000;
export const P16_DATABASE_DUMP_CLIENT: "mariadb";

type Environment = Readonly<Record<string, string | undefined>>;
type Assessment = "PASS" | "FAIL";

export type DatabaseBackupConfiguration = Readonly<{
  hostname: string;
  port: string;
  databaseName: string;
  username: string;
  tlsCaFile: string;
  environmentId: "lessenc-staging";
  dumpMode: "SINGLE_TRANSACTION_NO_LOCKS";
}>;

export function decodeRecoveryEncryptionKey(value: string): Buffer;
export function sha256File(path: string): Promise<string>;
export function collectP16MigrationMetadata(
  repositoryRoot: string,
): Promise<readonly Readonly<{ name: string; sha256: string }>[]>;
export function calculateP16MigrationSetSha256(
  migrations: readonly Readonly<{ name: string; sha256: string }>[],
): string;
export function validateStagingDatabaseBackupEnvironment(
  env: Environment,
): Promise<DatabaseBackupConfiguration>;
export function stagingMysqlDumpArguments(
  configuration: DatabaseBackupConfiguration,
): readonly string[];
export function inspectMariaDbDumpClient(
  input?: Readonly<{
    command?: string;
    commandPrefixArguments?: readonly string[];
    env?: Environment;
  }>,
): Promise<Readonly<{ family: "mariadb"; version: string; executable: string }>>;
export function createStagingDatabaseDump(
  input: Readonly<{
    env: Environment;
    destinationPath: string;
    repositoryRoot?: string;
    command?: string;
    commandPrefixArguments?: readonly string[];
    resolveHead?: () => string;
    clock?: () => Date;
  }>,
): Promise<
  Readonly<{
    destinationPath: string;
    evidencePath: string;
    evidence: Readonly<Record<string, unknown>>;
    bytes: number;
    sha256: string;
    boundedDiagnosticBytes: number;
  }>
>;

type RecoveryBundleOptions = Readonly<{
  encryptionKey: string | Buffer;
  encryptionKeyId?: string;
  repositoryRoot?: string;
  environmentId?: string;
  databaseName?: string;
  backupId?: string;
  releaseCommit?: string;
  migrationSetSha256?: string;
}>;

export function createP16RecoveryBundle(
  input: Readonly<{
    backupId: string;
    databaseEvidencePath: string;
    expectedDatabaseConfiguration: Readonly<{
      hostname: string;
      port: string | number;
      databaseName: string;
      tlsCaFile: string;
      environmentId: string;
      dumpMode: string;
    }>;
    storageRoot: string;
    outputRoot: string;
    repositoryRoot: string;
    encryptionKey: string | Buffer;
    encryptionKeyId: string;
    resolveHead?: () => string;
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
    encryptionKeyId: string;
    repositoryRoot?: string;
  }>,
): Promise<Readonly<Record<string, unknown>>>;

export function calculateP16Rpo(
  input: Readonly<{
    observedAt: string | Date;
    latestVerifiedBackupAt: string | Date;
  }>,
): Readonly<{
  assessment: Assessment;
  targetMs: 86400000;
  targetSeconds: 86400;
  ageMs: number;
  ageSeconds: number;
}>;
export function measureP16Rpo(
  input: Readonly<{
    observedAt: string | Date;
    latestVerifiedBackupAt?: string | Date | null;
    evidenceScope?: string | null;
  }>,
): Readonly<Record<string, unknown>>;
export function evaluateP16HostedRpoEvidence(
  evidence: Readonly<Record<string, unknown>>,
): Readonly<{
  status: Assessment;
  targetMs: 86400000;
  targetSeconds: 86400;
  ageMs: number;
  ageSeconds: number;
  reason: string;
}>;

export function calculateP16Rto(
  input: Readonly<{
    recoveryStartedAt: string | Date;
    recoveryValidatedAt: string | Date;
  }>,
): Readonly<{
  assessment: Assessment;
  targetMs: 28800000;
  targetSeconds: 28800;
  durationMs: number;
  durationSeconds: number;
}>;
export function measureP16Rto(
  input: Readonly<{
    recoveryStartedAt?: string | Date | null;
    recoveryValidatedAt?: string | Date | null;
    validationOutcome?: string | null;
    evidenceScope?: string | null;
    provenance?: string | null;
  }>,
): Readonly<Record<string, unknown>>;

export type P16AutomatedHostedRtoEvidence = Readonly<{
  evidenceType: "P16_HOSTED_RECOVERY_VALIDATION";
  evidenceScope: "HOSTED_STAGING";
  provenance: "AUTOMATED_RECOVERY_RUN";
  validationOutcome: "VALIDATED";
  recoveryStartedAt: string | Date;
  recoveryValidatedAt: string | Date;
}>;

export type P16ControlledOperatorAssistedHostedRtoEvidence = Readonly<{
  evidenceType: "P16_HOSTED_RECOVERY_VALIDATION";
  evidenceScope: "HOSTED_STAGING";
  provenance: "CONTROLLED_OPERATOR_ASSISTED_RECOVERY_RUN";
  validationOutcome: "VALIDATED";
  recoveryStartedAt: string | Date;
  recoveryValidatedAt: string | Date;
  timestampAuthority: "RECOVERY_CONTROLLER";
  providerPrivilegeRotationRequired: true;
  providerPrivilegeRotationMode: "EXTERNAL_PROVIDER_CONTROL";
  databaseRestoreValidation: "VALIDATED";
  r2RestoreValidation: "VALIDATED";
  finalRuntimePrivilegeValidation: "VALIDATED";
  authenticatedHostedReadiness: "PASS";
  hostedSmokeValidation: "PASS";
}>;

export function evaluateP16HostedRtoEvidence(
  evidence: P16AutomatedHostedRtoEvidence | P16ControlledOperatorAssistedHostedRtoEvidence,
): Readonly<{
  status: Assessment;
  targetMs: 28800000;
  targetSeconds: 28800;
  durationMs: number;
  durationSeconds: number;
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
