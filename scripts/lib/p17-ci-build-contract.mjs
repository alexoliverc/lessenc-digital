import { isAbsolute, relative, resolve, sep } from "node:path";
import process from "node:process";
import { URL } from "node:url";

export const CI_BUILD_ID = "lessenc-ci-verification-only";
export const CI_BUILD_APP_URL = "https://lessenc.invalid";

export const CI_BUILD_VALUES = Object.freeze({
  APP_ENV: "test",
  NODE_ENV: "production",
  CI: "true",
  NEXT_TELEMETRY_DISABLED: "1",
  P17_CI_BUILD_ID: CI_BUILD_ID,
  APP_URL: CI_BUILD_APP_URL,
  P08_PRODUCT_ID: "11111111-1111-4111-8111-111111111111",
  P08_OFFER_ID: "22222222-2222-4222-8222-222222222222",
  P09_SUBMISSION_SECRET: "ci-only-fictitious-p09-secret-32-characters",
  P10_PAYMENT_CONTINUATION_SECRET: "ci-only-fictitious-p10-secret-32-characters",
  P11_BUYER_SESSION_SECRET: "ci-only-fictitious-p11-secret-32-characters",
  P12_ADMIN_AUTH_SECRET: "ci-only-fictitious-p12-secret-32-characters",
  PRIVATE_STORAGE_DRIVER: "local-filesystem",
});

export const FORBIDDEN_CI_AUTHORITY_NAMES = Object.freeze([
  "DATABASE_URL",
  "DB_RUNTIME_URL",
  "DB_TLS_CA_FILE",
  "TEST_DATABASE_URL",
  "SHADOW_DATABASE_URL",
  "STAGING_RELEASE_COMMIT",
  "PRODUCTION_RELEASE_COMMIT",
  "P16_RELEASE_COMMIT",
  "P16_STAGING_ENVIRONMENT_ID",
  "P16_DATABASE_ACCESS_MODEL",
  "P16_DATABASE_MIGRATION_WINDOW",
  "P16_DATABASE_DUMP_CLIENT",
  "P16_DATABASE_EXPECTED_HOST",
  "P16_MERCADOPAGO_CREDENTIAL_SET",
  "P16_PRIVATE_STORAGE_PROVIDER",
  "P16_READINESS_TOKEN",
  "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY",
  "MERCADOPAGO_ACCESS_TOKEN",
  "MERCADOPAGO_WEBHOOK_SECRET",
  "PRIVATE_STORAGE_S3_ENDPOINT",
  "PRIVATE_STORAGE_S3_REGION",
  "PRIVATE_STORAGE_S3_BUCKET",
  "PRIVATE_STORAGE_S3_ACCESS_KEY_ID",
  "PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY",
  "PRIVATE_STORAGE_HEALTHCHECK_KEY",
  "GTM_CONTAINER_ID",
  "META_PIXEL_ID",
  "META_CAPI_ACCESS_TOKEN",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_PROFILE",
  "AWS_WEB_IDENTITY_TOKEN_FILE",
  "CLOUDFLARE_API_TOKEN",
  "CF_API_TOKEN",
  "HOSTINGER_API_TOKEN",
]);

export const CI_BUILD_CHILD_SYSTEM_NAMES = Object.freeze([
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "WINDIR",
  "ComSpec",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "USERPROFILE",
  "LOCALAPPDATA",
  "APPDATA",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "COMMONPROGRAMFILES",
  "COMMONPROGRAMFILES(X86)",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "PROCESSOR_IDENTIFIER",
  "OS",
  "USER",
  "USERNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
]);

const EXPECTED_ENVIRONMENT_FILES = new Set([".env.example"]);
const REQUIRED_CI_NAMES = new Set([...Object.keys(CI_BUILD_VALUES), "PRIVATE_FILE_STORAGE_PATH"]);
const FORBIDDEN_CI_AUTHORITY_NAME_SET = new Set(FORBIDDEN_CI_AUTHORITY_NAMES);

function isInside(parent, candidate) {
  const rel = relative(resolve(parent), resolve(candidate));
  return rel === "" || (!isAbsolute(rel) && !rel.startsWith(`..${sep}`) && rel !== "..");
}

export function normalizeEnvironmentName(name) {
  return name.toUpperCase();
}

function hasForbiddenAuthorityName(canonicalName) {
  return (
    FORBIDDEN_CI_AUTHORITY_NAME_SET.has(canonicalName) ||
    canonicalName.startsWith("HOSTINGER_") ||
    canonicalName.startsWith("MERCADOPAGO_") ||
    canonicalName.startsWith("PRIVATE_STORAGE_S3_")
  );
}

function collectEnvironmentEntries(env) {
  const entries = new Map();
  let hasCollision = false;

  for (const name of Object.keys(env)) {
    const canonicalName = normalizeEnvironmentName(name);
    const previous = entries.get(canonicalName);

    if (previous && previous.name !== name) {
      hasCollision = true;
      continue;
    }

    entries.set(canonicalName, { name, value: env[name] });
  }

  return { entries, hasCollision };
}

export function validateCiBuildEnvironment(env, options = {}) {
  const failures = [];
  const repositoryRoot = resolve(options.repositoryRoot ?? process.cwd());
  const environmentFiles = options.environmentFiles ?? [];
  const { entries, hasCollision } = collectEnvironmentEntries(env);

  if (hasCollision) failures.push("ENVIRONMENT_NAME_COLLISION");

  for (const [canonicalName, entry] of entries) {
    if (
      entry.name !== canonicalName &&
      (REQUIRED_CI_NAMES.has(canonicalName) || hasForbiddenAuthorityName(canonicalName))
    ) {
      failures.push("ENVIRONMENT_NAME_NOT_CANONICAL");
    }
  }

  for (const [name, expectedValue] of Object.entries(CI_BUILD_VALUES)) {
    if (entries.get(name)?.value !== expectedValue) failures.push(`${name}_INVALID`);
  }

  try {
    const appUrl = new URL(entries.get("APP_URL")?.value ?? "");
    if (
      appUrl.href !== `${CI_BUILD_APP_URL}/` ||
      appUrl.protocol !== "https:" ||
      !appUrl.hostname.endsWith(".invalid") ||
      appUrl.username !== "" ||
      appUrl.password !== ""
    ) {
      failures.push("APP_URL_NOT_CANONICAL_CI_INVALID");
    }
  } catch {
    failures.push("APP_URL_NOT_CANONICAL_CI_INVALID");
  }

  const storagePath = entries.get("PRIVATE_FILE_STORAGE_PATH")?.value ?? "";
  if (!isAbsolute(storagePath)) {
    failures.push("PRIVATE_FILE_STORAGE_PATH_NOT_ABSOLUTE");
  } else {
    if (isInside(repositoryRoot, storagePath)) {
      failures.push("PRIVATE_FILE_STORAGE_PATH_INSIDE_REPOSITORY");
    }
    if (resolve(storagePath).split(sep).at(-1) !== "lessenc-ci-private") {
      failures.push("PRIVATE_FILE_STORAGE_PATH_NOT_CI_DEDICATED");
    }
  }

  for (const [canonicalName, entry] of entries) {
    if (hasForbiddenAuthorityName(canonicalName) && entry.value !== undefined) {
      failures.push("HOSTED_AUTHORITY_VARIABLE_PRESENT");
    }
  }

  for (const fileName of environmentFiles) {
    if (!EXPECTED_ENVIRONMENT_FILES.has(fileName)) {
      failures.push("LOADABLE_ENVIRONMENT_FILE_PRESENT");
    }
  }

  return [...new Set(failures)].sort();
}

export function createCiBuildChildEnvironment(env) {
  const { entries } = collectEnvironmentEntries(env);
  const childEnvironment = {};

  for (const [name, value] of Object.entries(CI_BUILD_VALUES)) {
    childEnvironment[name] = value;
  }

  childEnvironment.PRIVATE_FILE_STORAGE_PATH = entries.get("PRIVATE_FILE_STORAGE_PATH")?.value;

  for (const outputName of CI_BUILD_CHILD_SYSTEM_NAMES) {
    const value = entries.get(normalizeEnvironmentName(outputName))?.value;
    if (value !== undefined) childEnvironment[outputName] = value;
  }

  return childEnvironment;
}
