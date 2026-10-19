export const CI_BUILD_ID: "lessenc-ci-verification-only";
export const CI_BUILD_APP_URL: "https://lessenc.invalid";
export const CI_BUILD_VALUES: Readonly<Record<string, string>>;
export const FORBIDDEN_CI_AUTHORITY_NAMES: readonly string[];
export const CI_BUILD_CHILD_SYSTEM_NAMES: readonly string[];

export function normalizeEnvironmentName(name: string): string;

export function validateCiBuildEnvironment(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  options?: {
    repositoryRoot?: string;
    environmentFiles?: readonly string[];
  },
): string[];

export function createCiBuildChildEnvironment(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): Record<string, string | undefined>;
