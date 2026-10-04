export type ReleaseHeadResolver = () => string;

export function resolveRepositoryHead(): string;
export function validateReleaseCommitBinding(
  releaseCommit: string | undefined,
  resolveHead?: ReleaseHeadResolver,
): readonly string[];
export function resolveStagingReleaseCommit(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  releaseCommit: string | undefined;
  source: "STAGING_RELEASE_COMMIT" | "P16_RELEASE_COMMIT" | null;
  failures: readonly string[];
}>;
export function validateStagingReleaseCommitBinding(
  environment: Readonly<Record<string, string | undefined>>,
  resolveHead?: ReleaseHeadResolver,
): readonly string[];
