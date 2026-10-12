#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const SYNTHETIC_DATABASE_URL =
  "mysql://lessenc_p17_perf:p17_perf_database_synthetic_only@127.0.0.1:3307/lessenc_test";

const FORBIDDEN_EXTERNAL_NAMES = Object.freeze([
  "ALL_PROXY",
  "GOOGLE_ADS_CONVERSION_ID",
  "GOOGLE_ADS_CONVERSION_LABEL",
  "GTM_CONTAINER_ID",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "MERCADOPAGO_ACCESS_TOKEN",
  "META_CAPI_ACCESS_TOKEN",
  "META_PIXEL_ID",
  "P16_PRIVATE_STORAGE_PROVIDER",
  "P17_ALLOW_HOSTED_READ_ONLY",
  "P17_BASE_URL",
  "PRIVATE_STORAGE_HEALTHCHECK_KEY",
  "PRIVATE_STORAGE_S3_ACCESS_KEY_ID",
  "PRIVATE_STORAGE_S3_BUCKET",
  "PRIVATE_STORAGE_S3_ENDPOINT",
  "PRIVATE_STORAGE_S3_REGION",
  "PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY",
]);

const APP_ENVIRONMENT_NAMES = Object.freeze([
  "APP_ENV",
  "APP_URL",
  "DATABASE_URL",
  "DB_RUNTIME_URL",
  "DB_TLS_CA_FILE",
  "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY",
  "NEXT_TELEMETRY_DISABLED",
  "NODE_ENV",
  "P17_OCI_IMAGE_DIGEST",
  "P17_PERF_COMMIT",
  "P17_PERF_DB_RUNTIME_URL",
  "P17_PERF_EXECUTION_AUTHORITY",
  "P17_PERF_MODE",
  "P17_PERF_RUN_ID",
  "P17_PERF_STORAGE_PATH",
  "P17_SOURCE_TREE_SHA256",
  "P17_TARGET",
  "PRIVATE_FILE_STORAGE_PATH",
  "PRIVATE_STORAGE_DRIVER",
]);

const DATABASE_ENVIRONMENT = Object.freeze({
  MYSQL_DATABASE: "lessenc_test",
  MYSQL_PASSWORD: "p17_perf_database_synthetic_only",
  MYSQL_ROOT_PASSWORD: "p17_perf_root_synthetic_only",
  MYSQL_TCP_PORT: "3307",
  MYSQL_USER: "lessenc_p17_perf",
});

function own(object, name) {
  return Object.prototype.hasOwnProperty.call(object, name);
}

function requireExact(environment, name, expected, errorCode) {
  if (!own(environment, name) || environment[name] !== expected) throw new Error(errorCode);
}

function requireMatch(environment, name, pattern, errorCode) {
  const value = environment[name];
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(errorCode);
}

function assertExactNames(environment, expectedNames, errorCode) {
  const actual = Object.keys(environment).sort();
  const expected = [...expectedNames].sort();
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    throw new Error(errorCode);
  }
}

function assertNoExternalNames(services) {
  for (const service of Object.values(services)) {
    const environment = service?.environment ?? {};
    for (const name of FORBIDDEN_EXTERNAL_NAMES) {
      if (own(environment, name)) throw new Error("P17_COMPOSE_EXTERNAL_ENVIRONMENT_FORBIDDEN");
    }
  }
}

export function auditComposeEnvironment(services) {
  if (services === null || typeof services !== "object" || Array.isArray(services)) {
    throw new Error("P17_COMPOSE_SERVICES_INVALID");
  }

  const expectedServices = ["p17-app", "p17-db", "p17-db-ca-exporter", "p17-db-ca-volume-init"];
  const actualServices = Object.keys(services).sort();
  if (
    actualServices.length !== expectedServices.length ||
    actualServices.some((name, index) => name !== expectedServices[index])
  ) {
    throw new Error("P17_COMPOSE_SERVICE_INVENTORY_INVALID");
  }

  assertNoExternalNames(services);

  const app = services["p17-app"]?.environment;
  const database = services["p17-db"]?.environment;
  if (app === null || typeof app !== "object" || Array.isArray(app)) {
    throw new Error("P17_COMPOSE_APP_ENVIRONMENT_INVALID");
  }
  if (database === null || typeof database !== "object" || Array.isArray(database)) {
    throw new Error("P17_COMPOSE_DATABASE_ENVIRONMENT_INVALID");
  }

  assertExactNames(app, APP_ENVIRONMENT_NAMES, "P17_COMPOSE_APP_ENVIRONMENT_INVENTORY_INVALID");
  assertExactNames(
    database,
    Object.keys(DATABASE_ENVIRONMENT),
    "P17_COMPOSE_DATABASE_ENVIRONMENT_INVENTORY_INVALID",
  );

  requireExact(app, "APP_ENV", "local", "P17_COMPOSE_APP_ENV_INVALID");
  requireExact(app, "NODE_ENV", "production", "P17_COMPOSE_NODE_ENV_INVALID");
  requireExact(app, "NEXT_TELEMETRY_DISABLED", "1", "P17_COMPOSE_TELEMETRY_INVALID");
  requireExact(app, "P17_TARGET", "local", "P17_COMPOSE_TARGET_INVALID");
  requireExact(app, "APP_URL", "http://127.0.0.1:3100", "P17_COMPOSE_APP_URL_INVALID");
  requireExact(app, "DATABASE_URL", SYNTHETIC_DATABASE_URL, "P17_COMPOSE_DATABASE_URL_INVALID");
  requireExact(app, "DB_RUNTIME_URL", SYNTHETIC_DATABASE_URL, "P17_COMPOSE_DB_RUNTIME_URL_INVALID");
  requireExact(
    app,
    "P17_PERF_DB_RUNTIME_URL",
    SYNTHETIC_DATABASE_URL,
    "P17_COMPOSE_PERF_DATABASE_URL_INVALID",
  );
  requireExact(
    app,
    "DB_TLS_CA_FILE",
    "/workspace/tmp/p17-db-ca/ca.pem",
    "P17_COMPOSE_DB_TLS_CA_INVALID",
  );
  requireExact(
    app,
    "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY",
    "p17_perf_public_key_synthetic_only",
    "P17_COMPOSE_PUBLIC_KEY_NOT_SYNTHETIC",
  );
  requireExact(
    app,
    "PRIVATE_STORAGE_DRIVER",
    "local-filesystem",
    "P17_COMPOSE_STORAGE_DRIVER_INVALID",
  );
  requireExact(
    app,
    "PRIVATE_FILE_STORAGE_PATH",
    "/workspace/tmp/p17-performance-storage",
    "P17_COMPOSE_STORAGE_PATH_INVALID",
  );
  requireExact(
    app,
    "P17_PERF_STORAGE_PATH",
    "/workspace/tmp/p17-performance-storage",
    "P17_COMPOSE_PERF_STORAGE_PATH_INVALID",
  );
  requireMatch(
    app,
    "P17_PERF_MODE",
    /^(?:infrastructure-only|acceptance-local)$/u,
    "P17_COMPOSE_MODE_INVALID",
  );
  requireMatch(
    app,
    "P17_PERF_RUN_ID",
    /^p17-perf-[a-z0-9][a-z0-9._-]{7,80}$/u,
    "P17_COMPOSE_RUN_ID_INVALID",
  );
  requireMatch(
    app,
    "P17_PERF_COMMIT",
    /^(?:UNVERIFIED|[0-9a-f]{40})$/u,
    "P17_COMPOSE_COMMIT_INVALID",
  );
  requireMatch(
    app,
    "P17_SOURCE_TREE_SHA256",
    /^(?:UNVERIFIED|[0-9a-f]{64})$/u,
    "P17_COMPOSE_SOURCE_TREE_INVALID",
  );
  requireMatch(
    app,
    "P17_OCI_IMAGE_DIGEST",
    /^(?:UNVERIFIED|sha256:[0-9a-f]{64})$/u,
    "P17_COMPOSE_IMAGE_DIGEST_INVALID",
  );
  requireMatch(
    app,
    "P17_PERF_EXECUTION_AUTHORITY",
    /^(?:NOT_AUTHORIZED|LES-P17-AUTONOMOUS-COMPLETION-R01)$/u,
    "P17_COMPOSE_EXECUTION_AUTHORITY_INVALID",
  );

  for (const [name, expected] of Object.entries(DATABASE_ENVIRONMENT)) {
    requireExact(database, name, expected, "P17_COMPOSE_DATABASE_IDENTITY_INVALID");
  }

  for (const serviceName of ["p17-db-ca-exporter", "p17-db-ca-volume-init"]) {
    const environment = services[serviceName]?.environment;
    if (environment !== undefined && Object.keys(environment).length !== 0) {
      throw new Error("P17_COMPOSE_CA_SERVICE_ENVIRONMENT_INVALID");
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    state: "PASS",
    services: Object.freeze(
      actualServices.map((serviceName) =>
        Object.freeze({
          name: serviceName,
          environmentNames: Object.freeze(
            Object.keys(services[serviceName]?.environment ?? {}).sort(),
          ),
        }),
      ),
    ),
    databaseIdentity: "LOOPBACK_SYNTHETIC_DISPOSABLE",
    providerCredentials: "ABSENT",
  });
}

export function verifyComposeEnvironment(repositoryRoot = process.cwd()) {
  const root = resolve(repositoryRoot);
  const composeFile = resolve(root, "e2e/performance/capsule/compose.yaml");
  const result = spawnSync(
    "docker",
    [
      "compose",
      "--profile",
      "p17-performance-authorized",
      "-f",
      composeFile,
      "config",
      "--format",
      "json",
    ],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (result.status !== 0) throw new Error("P17_COMPOSE_CONFIG_FAILED");

  let config;
  try {
    config = JSON.parse(result.stdout);
  } catch {
    throw new Error("P17_COMPOSE_CONFIG_JSON_INVALID");
  }
  return auditComposeEnvironment(config.services);
}

function main() {
  if ((process.argv[2] ?? "verify") !== "verify") {
    throw new Error("P17_COMPOSE_ENVIRONMENT_COMMAND_INVALID");
  }
  const result = verifyComposeEnvironment(process.argv[3] ?? process.cwd());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("p17-compose-environment-audit.mjs")) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "P17_COMPOSE_ENVIRONMENT_AUDIT_FAILED"}\n`,
    );
    process.exitCode = 1;
  }
}
