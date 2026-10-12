export interface DockerContextInventoryResult {
  readonly fileCount: number;
  readonly requiredCount: number;
  readonly inventorySha256: string;
}

export function assertDockerContextInventory(
  files: readonly string[],
  requiredFiles: readonly string[],
): DockerContextInventoryResult;

export function auditDockerBuildContext(repositoryRoot?: string): Promise<unknown>;
