export const STAGING_ENVIRONMENT_ID: "lessenc-staging";
export const STAGING_SECRET_NAMES: readonly string[];
export function validateStagingEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): readonly string[];
export function assertStagingEnvironment(env: Readonly<Record<string, string | undefined>>): void;
