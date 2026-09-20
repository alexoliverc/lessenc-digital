import { isAbsolute } from "node:path";
import { URL } from "node:url";

export const STAGING_ENVIRONMENT_ID = "lessenc-staging";
export const DATABASE_ACCESS_MODELS = Object.freeze([
  "distinct-users",
  "hostinger-managed-single-user",
]);
export const DATABASE_MIGRATION_WINDOWS = Object.freeze(["disabled", "enabled"]);

export const STAGING_SECRET_NAMES = Object.freeze([
  "MERCADOPAGO_ACCESS_TOKEN",
  "MERCADOPAGO_WEBHOOK_SECRET",
  "P09_SUBMISSION_SECRET",
  "P10_PAYMENT_CONTINUATION_SECRET",
  "P11_BUYER_SESSION_SECRET",
  "P12_ADMIN_AUTH_SECRET",
  "P16_READINESS_TOKEN",
  "PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY",
]);

function parseDatabaseUrl(raw) {
  try {
    const url = new URL(raw);
    const database = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !url.hostname || !url.username || !url.password || !database) {
      return null;
    }
    return { url, database };
  } catch {
    return null;
  }
}

function isHostedDatabase(target) {
  const databaseTokens = target?.database.toLowerCase().split(/[_-]+/u) ?? [];
  return (
    target !== null &&
    !["127.0.0.1", "localhost", "::1"].includes(target.url.hostname.toLowerCase()) &&
    databaseTokens.some((token) => token === "stage" || token === "staging") &&
    !/(dev(elopment)?|local|test|prod(uction)?|live)/iu.test(target.database)
  );
}

function isCanonicalR2Endpoint(raw) {
  try {
    const endpoint = new URL(raw);

    return (
      endpoint.protocol === "https:" &&
      endpoint.username === "" &&
      endpoint.password === "" &&
      endpoint.pathname === "/" &&
      endpoint.search === "" &&
      endpoint.hash === "" &&
      /^[a-z0-9-]+\.r2\.cloudflarestorage\.com$/iu.test(endpoint.hostname)
    );
  } catch {
    return false;
  }
}

function isValidR2BucketName(raw) {
  return (
    typeof raw === "string" &&
    raw.length >= 3 &&
    raw.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/u.test(raw)
  );
}

export function validateStagingEnvironment(env, options = {}) {
  const failures = [];
  const gate = options.gate ?? "runtime";
  const requireExact = (name, expected) => {
    if (env[name] !== expected) failures.push(`${name}_INVALID`);
  };

  requireExact("APP_ENV", "staging");
  requireExact("NODE_ENV", "production");
  requireExact("APP_URL", "https://lessenc.com.br");
  requireExact("P16_STAGING_ENVIRONMENT_ID", STAGING_ENVIRONMENT_ID);
  requireExact("PRIVATE_STORAGE_DRIVER", "hosted");
  requireExact("P16_PRIVATE_STORAGE_PROVIDER", "r2");
  requireExact("PRIVATE_STORAGE_S3_REGION", "auto");
  requireExact("PRIVATE_STORAGE_HEALTHCHECK_KEY", "_health/p16-readiness");

  if (!isCanonicalR2Endpoint(env.PRIVATE_STORAGE_S3_ENDPOINT)) {
    failures.push("PRIVATE_STORAGE_S3_ENDPOINT_INVALID");
  }

  if (!isValidR2BucketName(env.PRIVATE_STORAGE_S3_BUCKET)) {
    failures.push("PRIVATE_STORAGE_S3_BUCKET_INVALID");
  }

  if (
    typeof env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID !== "string" ||
    env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID.length < 16 ||
    env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID.length > 128
  ) {
    failures.push("PRIVATE_STORAGE_S3_ACCESS_KEY_ID_MISSING_OR_INVALID");
  }

  const accessModel = env.P16_DATABASE_ACCESS_MODEL;
  if (!DATABASE_ACCESS_MODELS.includes(accessModel)) {
    failures.push("P16_DATABASE_ACCESS_MODEL_INVALID");
  }

  const migrationWindow = env.P16_DATABASE_MIGRATION_WINDOW;
  if (!DATABASE_MIGRATION_WINDOWS.includes(migrationWindow)) {
    failures.push("P16_DATABASE_MIGRATION_WINDOW_INVALID");
  } else if (gate === "migration" && migrationWindow !== "enabled") {
    failures.push("P16_DATABASE_MIGRATION_WINDOW_REQUIRED");
  } else if (gate === "runtime" && migrationWindow !== "disabled") {
    failures.push("P16_DATABASE_MIGRATION_WINDOW_MUST_BE_DISABLED");
  } else if (gate !== "migration" && gate !== "runtime") {
    failures.push("P16_DATABASE_GATE_INVALID");
  }

  const migration = parseDatabaseUrl(env.DATABASE_URL);
  const runtime = parseDatabaseUrl(env.DB_RUNTIME_URL);
  if (!isHostedDatabase(migration)) failures.push("DATABASE_URL_NOT_UNAMBIGUOUS_STAGING");
  if (!isHostedDatabase(runtime)) failures.push("DB_RUNTIME_URL_NOT_UNAMBIGUOUS_STAGING");
  if (migration && runtime) {
    if (
      migration.url.hostname !== runtime.url.hostname ||
      migration.url.port !== runtime.url.port ||
      migration.database !== runtime.database
    ) {
      failures.push("DATABASE_TARGETS_DO_NOT_MATCH");
    }

    if (accessModel === "distinct-users" && migration.url.username === runtime.url.username) {
      failures.push("DATABASE_USERS_MUST_BE_DISTINCT");
    }

    if (
      accessModel === "hostinger-managed-single-user" &&
      (migration.url.username !== runtime.url.username ||
        migration.url.password !== runtime.url.password)
    ) {
      failures.push("HOSTINGER_MANAGED_DATABASE_IDENTITY_MISMATCH");
    }
  }

  if (!env.DB_TLS_CA_FILE || !isAbsolute(env.DB_TLS_CA_FILE)) {
    failures.push("DB_TLS_CA_FILE_MUST_BE_ABSOLUTE");
  }

  for (const name of STAGING_SECRET_NAMES) {
    if (typeof env[name] !== "string" || env[name].length < 32) {
      failures.push(`${name}_MISSING_OR_WEAK`);
    }
  }

  if (!env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.startsWith("TEST-")) {
    failures.push("MERCADOPAGO_PUBLIC_KEY_NOT_TEST");
  }
  if (!env.MERCADOPAGO_ACCESS_TOKEN?.startsWith("TEST-")) {
    failures.push("MERCADOPAGO_ACCESS_TOKEN_NOT_TEST");
  }
  if (!/^[0-9a-f]{40}$/iu.test(env.P16_RELEASE_COMMIT ?? "")) {
    failures.push("P16_RELEASE_COMMIT_INVALID");
  }

  const configuredSecrets = STAGING_SECRET_NAMES.map((name) => env[name]).filter(
    (value) => typeof value === "string" && value.length >= 32,
  );
  if (new Set(configuredSecrets).size !== configuredSecrets.length) {
    failures.push("STAGING_SECRET_REUSE_FORBIDDEN");
  }

  return Object.freeze([...new Set(failures)].sort());
}

export function assertStagingEnvironment(env, options = {}) {
  const failures = validateStagingEnvironment(env, options);
  if (failures.length > 0) {
    throw new Error(`P16_STAGING_PREFLIGHT_FAILED:${failures.join(",")}`);
  }
}
