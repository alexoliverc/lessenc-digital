export const STAGING_ENVIRONMENT_ID: "lessenc-staging";
export const STAGING_SECRET_NAMES: readonly string[];
export const DATABASE_ACCESS_MODELS: readonly ["distinct-users", "hostinger-managed-single-user"];
export const DATABASE_MIGRATION_WINDOWS: readonly ["disabled", "enabled"];
export function validateStagingEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  options?: Readonly<{ gate?: "runtime" | "migration" }>,
): readonly string[];
export function assertStagingEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  options?: Readonly<{ gate?: "runtime" | "migration" }>,
): void;
