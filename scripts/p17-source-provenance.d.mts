export interface SourceProvenanceComponent {
  readonly fileCount: number;
  readonly digest: string;
}

export interface SourceProvenanceResult {
  readonly schemaVersion: 2;
  readonly algorithm: "SHA-256";
  readonly fileCount: number;
  readonly digest: string;
  readonly components: Readonly<
    Record<
      "applicationSource" | "containerRecipes" | "dependencyLock" | "supplyChain",
      SourceProvenanceComponent
    >
  >;
}

export function sourceProvenanceFiles(repositoryRoot: string): readonly string[];
export function computeSourceProvenance(repositoryRoot: string): SourceProvenanceResult;
export function computeFramedFileDigest(repositoryRoot: string, files: readonly string[]): string;
