import { describe, expect, it } from "vitest";

import { auditComposeEnvironment } from "../../../scripts/p17-compose-environment-audit.mjs";

const databaseUrl =
  "mysql://lessenc_p17_perf:p17_perf_database_synthetic_only@127.0.0.1:3307/lessenc_test";

type MutableServiceMap = Record<string, { environment?: Record<string, string> }>;

function validServices(): MutableServiceMap {
  return {
    "p17-app": {
      environment: {
        APP_ENV: "local",
        APP_URL: "http://127.0.0.1:3100",
        DATABASE_URL: databaseUrl,
        DB_RUNTIME_URL: databaseUrl,
        DB_TLS_CA_FILE: "/workspace/tmp/p17-db-ca/ca.pem",
        NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: "p17_perf_public_key_synthetic_only",
        NEXT_TELEMETRY_DISABLED: "1",
        NODE_ENV: "production",
        P17_OCI_IMAGE_DIGEST: `sha256:${"b".repeat(64)}`,
        P17_PERF_COMMIT: "a".repeat(40),
        P17_PERF_DB_RUNTIME_URL: databaseUrl,
        P17_PERF_EXECUTION_AUTHORITY: "LES-P17-AUTONOMOUS-COMPLETION-R01",
        P17_PERF_MODE: "acceptance-local",
        P17_PERF_RUN_ID: "p17-perf-compose-environment-test",
        P17_PERF_STORAGE_PATH: "/workspace/tmp/p17-performance-storage",
        P17_SOURCE_TREE_SHA256: "c".repeat(64),
        P17_TARGET: "local",
        PRIVATE_FILE_STORAGE_PATH: "/workspace/tmp/p17-performance-storage",
        PRIVATE_STORAGE_DRIVER: "local-filesystem",
      },
    },
    "p17-db": {
      environment: {
        MYSQL_DATABASE: "lessenc_test",
        MYSQL_PASSWORD: "p17_perf_database_synthetic_only",
        MYSQL_ROOT_PASSWORD: "p17_perf_root_synthetic_only",
        MYSQL_TCP_PORT: "3307",
        MYSQL_USER: "lessenc_p17_perf",
      },
    },
    "p17-db-ca-exporter": {},
    "p17-db-ca-volume-init": {},
  };
}

describe("P17 effective Compose environment policy", () => {
  it("accepts only the exact disposable loopback database and synthetic public key", () => {
    expect(auditComposeEnvironment(validServices())).toMatchObject({
      state: "PASS",
      databaseIdentity: "LOOPBACK_SYNTHETIC_DISPOSABLE",
      providerCredentials: "ABSENT",
    });
  });

  it("rejects a real provider credential name without inspecting or returning its value", () => {
    const services = validServices();
    services["p17-app"]!.environment!.MERCADOPAGO_ACCESS_TOKEN = "must-remain-hidden";

    expect(() => auditComposeEnvironment(services)).toThrow(
      "P17_COMPOSE_EXTERNAL_ENVIRONMENT_FORBIDDEN",
    );
  });

  it("rejects a database URL outside the exact synthetic loopback identity", () => {
    const services = validServices();
    services["p17-app"]!.environment!.DATABASE_URL =
      "mysql://lessenc_p17_perf:p17_perf_database_synthetic_only@db.example.invalid:3306/lessenc";

    expect(() => auditComposeEnvironment(services)).toThrow("P17_COMPOSE_DATABASE_URL_INVALID");
  });

  it("rejects a non-synthetic Mercado Pago public key", () => {
    const services = validServices();
    services["p17-app"]!.environment!.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY = "public-key-other";

    expect(() => auditComposeEnvironment(services)).toThrow("P17_COMPOSE_PUBLIC_KEY_NOT_SYNTHETIC");
  });

  it("rejects an unexpected secret-bearing variable even when it is not a known provider name", () => {
    const services = validServices();
    services["p17-app"]!.environment!.UNEXPECTED_API_TOKEN = "must-remain-hidden";

    expect(() => auditComposeEnvironment(services)).toThrow(
      "P17_COMPOSE_APP_ENVIRONMENT_INVENTORY_INVALID",
    );
  });
});
