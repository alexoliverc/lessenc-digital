export type ReleaseHeadResolver = () => string;

export function resolveRepositoryHead(): string;
export function validateReleaseCommitBinding(
  releaseCommit: string | undefined,
  resolveHead?: ReleaseHeadResolver,
): readonly string[];
