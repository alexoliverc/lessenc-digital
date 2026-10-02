type Environment = Readonly<Record<string, string | undefined>>;

export const P16_HOSTED_BACKUP_MANUAL_AUTHORITY: "CONTROLLED_MANUAL_EXECUTION";
export const P16_HOSTED_BACKUP_SCHEDULED_AUTHORITY: "PROVIDER_SCHEDULED_EXECUTION";

export function resolveHostedBackupCliExecutionAuthority(
  mode: string | undefined,
  unexpected?: readonly string[],
): "CONTROLLED_MANUAL_EXECUTION" | "PROVIDER_SCHEDULED_EXECUTION";

export function createHostedBackupId(
  input?: Readonly<{
    now?: string | Date;
    randomSuffix?: string;
  }>,
): string;

export function resolveS3SdkCapabilities(
  input: Readonly<{
    repositoryPackageJson: string;
    runtimePackageJson?: string;
    createRequire?: (anchor: string) => (specifier: string) => Record<string, unknown>;
    assertRuntimeAnchor?: (anchor: string | undefined) => Promise<void>;
  }>,
): Promise<Readonly<Record<string, unknown> & { resolution: "repository" | "runtime-anchor" }>>;

export function materializeR2Snapshot(
  input: Readonly<{
    client: { send(command: unknown): Promise<Record<string, unknown>> };
    ListObjectsV2Command: new (input: Record<string, unknown>) => unknown;
    GetObjectCommand: new (input: Record<string, unknown>) => unknown;
    bucket: string;
    destinationRoot: string;
  }>,
): Promise<
  Readonly<{
    objectCount: number;
    totalBytes: number;
    objectKeys: readonly string[];
  }>
>;

export function updateBackupIndexAtomic(
  input: Readonly<{
    indexFile: string;
    backupId: string;
    createdAt: string | Date;
    now?: string | Date;
    writeJsonAtomic?: (path: string, value: unknown) => Promise<void>;
  }>,
): Promise<readonly Readonly<{ id: string; createdAt: string }>[]>;

export function cleanupHostedBackupWorkspace(
  input: Readonly<{
    workspace: string;
    workRoot: string;
    repositoryRoot: string;
    outputRoot: string;
  }>,
): Promise<void>;

export function validateHostedBackupOrchestratorConfiguration(
  input: Readonly<{
    env: Environment;
    repositoryRoot: string;
    executionAuthority: string;
    platform?: NodeJS.Platform;
  }>,
): Promise<Readonly<Record<string, unknown>>>;

export function runP16HostedBackupOrchestrator(
  input: Readonly<{
    env: Environment;
    repositoryRoot: string;
    executionAuthority: string;
  }>,
  dependencies?: Record<string, unknown>,
): Promise<Readonly<Record<string, unknown>>>;
