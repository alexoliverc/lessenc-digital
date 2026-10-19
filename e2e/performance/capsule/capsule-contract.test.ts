import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), "utf8");

const dockerfile = read("e2e/performance/capsule/Dockerfile");
const entrypoint = read("e2e/performance/capsule/entrypoint.sh");
const networkVerifier = read("scripts/p17-capsule-network.mjs");
const performanceController = read("scripts/p17-performance-controller.mjs");
const specSupport = read("e2e/performance/helpers/spec-support.ts");
const calibrationServer = read("scripts/p17-performance-calibration-server.mjs");
const buildScript = read("e2e/performance/capsule/build-app.sh");
const caInitializer = read("e2e/performance/capsule/init-db-ca-volume.sh");
const caExporter = read("e2e/performance/capsule/export-db-ca.sh");
const compose = read("e2e/performance/capsule/compose.yaml");
const dockerignore = read(".dockerignore");
const dockerignoreSnapshot = read("e2e/performance/capsule/dockerignore.snapshot");
const contract = JSON.parse(read("e2e/performance/capsule/contract.json")) as {
  status: Record<string, string>;
  network: Record<string, string | number>;
  offlineCache: {
    key: string;
    root: string;
    identity: Record<string, string>;
    requiredPackages: Array<{ lockPath: string; version: string }>;
  };
};

describe("P17 two-container performance capsule contract", () => {
  it("pins only the authorized Node and Playwright application bases", () => {
    expect(dockerfile).toContain("node:24.21.0-bookworm-slim@sha256:");
    expect(dockerfile).toContain("mcr.microsoft.com/playwright:v1.63.0-noble@sha256:");
    expect(dockerfile).not.toMatch(/\b(?:latest|apt-get|apk|curl|wget)\b/u);
    expect(dockerfile).not.toMatch(/^COPY\s+\.\s+/mu);
    expect(dockerfile).not.toContain("mysqld");
    expect(dockerfile.match(/RUN --network=none/gu)?.length).toBeGreaterThanOrEqual(3);
  });

  it("creates the fixed non-root identity before using COPY --chown", () => {
    const identity = dockerfile.indexOf('groupadd --gid "${P17_PERF_GID}" p17perf');
    const ownedCopy = dockerfile.indexOf("COPY --chown=p17perf:p17perf");

    expect(identity).toBeGreaterThan(-1);
    expect(ownedCopy).toBeGreaterThan(identity);
    expect(dockerfile).toContain("USER p17perf");
  });

  it("requires a materialized offline cache and bypasses package lifecycle prebuild", () => {
    expect(buildScript).toContain("P17_CAPSULE_NPM_CACHE_NOT_MATERIALIZED");
    expect(buildScript).toContain("npm ci");
    expect(buildScript).toContain("--offline");
    expect(buildScript).toContain("--ignore-scripts");
    expect(buildScript).toContain("p17-npm-cache-verify.mjs verify-cache");
    expect(buildScript).toContain("P17_CAPSULE_NPM_VERSION_INVALID");
    expect(buildScript).toContain("./node_modules/.bin/prisma generate");
    expect(buildScript).toContain("./node_modules/.bin/next build");
    expect(buildScript).not.toContain("npm run build");
  });

  it("shares only loopback networking and a dedicated public-CA volume with the application", () => {
    expect(compose).toContain("network_mode: none");
    expect(compose).toContain("network_mode: service:p17-db");
    expect(compose).toContain("--bind-address=127.0.0.1");
    expect(compose).toContain("--port=3307");
    expect(compose).not.toMatch(/^\s+ports:/mu);
    expect(compose).toContain("p17-db-data:/var/lib/mysql");
    expect(compose).toContain("p17-db-data:/var/lib/mysql:ro");
    expect(compose).not.toContain("p17-db-data:/workspace");
    expect(compose).toContain("p17-db-ca:/workspace/tmp/p17-db-ca:ro");
    expect(compose).toContain("p17-db-ca:/p17-ca");

    const f6Compose = compose.replace(/\r\n/g, "\n");

    const f6Initializer = f6Compose
      .split("  p17-db-ca-volume-init:\n")[1]
      ?.split("\n  p17-db-ca-exporter:\n")[0];

    expect(f6Initializer).toBeDefined();
    expect(f6Initializer).toContain('user: "0:0"');
    expect(f6Initializer).toContain("network_mode: none");
    expect(f6Initializer).toContain("read_only: true");
    expect(f6Initializer).toContain("no-new-privileges:true");
    expect(f6Initializer).toContain("cap_drop:\n      - ALL");
    expect(f6Initializer).toContain("cap_add:\n      - CHOWN");
    expect(f6Initializer).toContain("p17-db-ca:/p17-ca");
    expect(f6Initializer).not.toContain("p17-db-data:");
    expect(f6Initializer).not.toContain("ports:");
    expect(f6Initializer).not.toContain("privileged:");
    expect(f6Initializer).toContain("init-db-ca-volume.sh");
    expect(caInitializer).toContain("P17_DB_CA_VOLUME_ALREADY_INITIALIZED_PASS");
    expect(caInitializer).toContain("stat -c '%u:%g:%a' \"$target_dir\"");
    expect(caInitializer).toContain("P17_DB_CA_INIT_DIRECTORY_NOT_EMPTY");

    const f6Exporter = f6Compose.split("  p17-db-ca-exporter:\n")[1]?.split("\n  p17-app:\n")[0];

    expect(f6Exporter).toContain(
      "p17-db-ca-volume-init:\n        condition: service_completed_successfully",
    );
    expect(compose).toContain("p17-output-data:/workspace/output");
    expect(compose).toContain("DB_TLS_CA_FILE: /workspace/tmp/p17-db-ca/ca.pem");
    expect(caExporter).toContain("P17_DB_CA_EXPORT_PRIVATE_KEY_FORBIDDEN");
    expect(caExporter).toContain("P17_DB_CA_EXPORT_OUTPUT_INVENTORY_INVALID");
    expect(compose).toContain("type: tmpfs");
    expect(compose).not.toMatch(/^networks:/mu);
    expect(compose).not.toMatch(/^\s+privileged:/mu);
    expect(compose).not.toMatch(/^\s+extra_hosts:/mu);
    expect(compose).toContain('dns: ["127.0.0.1"]');
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("no-new-privileges:true");
  });

  it("governs runtime commands and requires loopback-only networking", () => {
    expect(entrypoint).not.toContain("P17_CAPSULE_MYSQL_MISSING");
    expect(networkVerifier).toContain("P17_CAPSULE_NON_LOOPBACK_INTERFACE_PRESENT");
    expect(networkVerifier).toContain("P17_CAPSULE_IPV4_DEFAULT_ROUTE_PRESENT");
    expect(networkVerifier).toContain("P17_CAPSULE_IPV6_DEFAULT_ROUTE_PRESENT");
    expect(networkVerifier).toContain("P17_CAPSULE_EXTERNAL_DNS_PRESENT");
    expect(entrypoint).toContain("P17_ALLOW_HOSTED_READ_ONLY");
    expect(entrypoint).toContain("MERCADOPAGO_ACCESS_TOKEN");
    expect(entrypoint).toMatch(/^ {2}run\)$/mu);
    expect(entrypoint).toMatch(/^ {2}integration\)$/mu);
    expect(entrypoint).toMatch(/^ {2}collect \| server\)$/mu);
    expect(entrypoint).toContain("P17_PERFORMANCE_COMMAND_NOT_AUTHORIZED");
    expect(entrypoint).toContain("P17_CAPSULE_EXECUTION_AUTHORITY_INVALID");
    expect(entrypoint).toContain("P17_CAPSULE_STATIC_ISOLATION_VALIDATED");
    expect(entrypoint).toContain("P17_CAPSULE_SHARP_VERSION_INVALID");
    expect(entrypoint).toContain("P17_CAPSULE_SOURCE_MAP_JS_VERSION_INVALID");
    expect(entrypoint).toContain("P17_CAPSULE_DB_TLS_CA_PRIVATE_KEY_FORBIDDEN");
    expect(entrypoint).toContain("P17_CAPSULE_OCI_IMAGE_DIGEST_INVALID");
    expect(entrypoint).toContain("P17_CAPSULE_DATABASE_ACCEPTING_CONNECTIONS");
    expect(entrypoint).toContain("P17_CAPSULE_DB_TLS_HANDSHAKE_PASS");
    expect(entrypoint).toContain("P17_CAPSULE_DB_TLS_HANDSHAKE_FAILED");
    expect(entrypoint).toContain("P17_CAPSULE_DB_TLS_CIPHER=");
    expect(entrypoint).toContain(
      "P17_CAPSULE_DB_TLS_HOSTNAME_IDENTITY=NOT_VERIFIED_LOOPBACK_OVERRIDE",
    );
    expect(entrypoint).toContain("rejectUnauthorized: true");
    expect(entrypoint).toContain("checkServerIdentity: () => undefined");
    expect(entrypoint).toContain("TLS_CIPHER_NOT_NEGOTIATED");
    expect((entrypoint.match(/verify_authenticated_mysql_tls/g) ?? []).length).toBe(5);
    expect(entrypoint).toContain(
      'wait_for_loopback_database\n    verify_authenticated_mysql_tls\n    APP_ENV=test TEST_DATABASE_URL="${DATABASE_URL}" ./node_modules/.bin/prisma migrate deploy',
    );
    const tlsPreflightStart = entrypoint.indexOf("  tls-preflight)\n");
    const tlsPreflightEnd = entrypoint.indexOf("\n    ;;", tlsPreflightStart);
    expect(tlsPreflightStart).toBeGreaterThan(-1);
    expect(tlsPreflightEnd).toBeGreaterThan(tlsPreflightStart);
    const tlsPreflight = entrypoint.slice(tlsPreflightStart, tlsPreflightEnd);
    expect(tlsPreflight).toContain("LES-P17-MASTER-AUTONOMOUS-CONTINUATION-R01");
    expect(tlsPreflight).toContain("wait_for_loopback_database");
    expect(tlsPreflight).toContain("verify_authenticated_mysql_tls");
    expect(tlsPreflight).toContain("P17_CAPSULE_DB_TLS_PREFLIGHT_ONLY_COMPLETE");
    expect(tlsPreflight).not.toContain("p17-performance-controller");
    expect(tlsPreflight).not.toContain("prisma migrate");
    expect(tlsPreflight).not.toContain("vitest");
    expect(performanceController).toContain("runLocalPerformanceAcceptance");
    expect(performanceController).toContain("assertLocalPerformanceExecutionAuthorized");
    expect(performanceController).toContain("P17_PERFORMANCE_CALIBRATION_SMOKE_INVALID");
    expect(specSupport).toContain("bypassCSP: true");
    expect(calibrationServer).toContain("P17_PERFORMANCE_CALIBRATION_SERVER_NOT_AUTHORIZED");
    expect(dockerfile).toContain("P17_SOURCE_COMMIT=UNVERIFIED");
    expect(dockerfile).toContain("/workspace/.p17-declared-commit");
    expect(dockerfile).toContain("/workspace/.p17-source-tree.sha256");
    expect(compose).toContain("P17_SOURCE_COMMIT: ${P17_SOURCE_COMMIT:-UNVERIFIED}");
    expect(compose).toContain("P17_PERF_COMMIT: ${P17_SOURCE_COMMIT:-UNVERIFIED}");
    expect(compose).toContain("P17_SOURCE_TREE_SHA256: ${P17_SOURCE_TREE_SHA256:-UNVERIFIED}");
    expect(entrypoint).toContain("LES-P17-AUTONOMOUS-COMPLETION-R01");
    expect(dockerfile).toContain("com.lessenc.p17.source-provenance.sha256");
    expect(dockerfile).toContain("org.opencontainers.image.revision");
    expect(compose).toContain("P17_OCI_IMAGE_DIGEST: ${P17_OCI_IMAGE_DIGEST:-UNVERIFIED}");
  });

  it("uses an allowlisted build context with explicit secret exclusions", () => {
    expect(dockerignore.startsWith("**\n")).toBe(true);
    expect(dockerignoreSnapshot).toBe(dockerignore);
    for (const pattern of [
      "**/.env",
      "**/.npmrc",
      "**/*.pem",
      "**/.git",
      "**/node_modules",
      "**/.next",
    ]) {
      expect(dockerignore).toContain(pattern);
    }
    expect(dockerignore).toContain("!src/**");
    expect(dockerignore).toContain("!e2e/performance/capsule/Dockerfile");
    expect(dockerignore).toContain("!e2e/performance/capsule/build-app.sh");
    expect(dockerignore).toContain("!e2e/performance/capsule/entrypoint.sh");
    expect(dockerignore).toContain("!e2e/performance/capsule/context-audit.Dockerfile");
    expect(dockerignore).toContain("!e2e/performance/capsule/dockerignore.snapshot");
    expect(dockerignore).toContain("!e2e/performance/capsule/export-db-ca.sh");
    expect(dockerignore).toContain("!scripts/p17-npm-cache-verify.mjs");
    expect(dockerignore).toContain("!prisma/migrations/**/migration.sql");
    expect(dockerignore).toContain("npm-11.19.1/node-24.21.0/linux-amd64-glibc/");
    expect(dockerignore).not.toContain("!e2e/performance/capsule/**");
    const finalDenyBlock = dockerignore.indexOf("# Final defense in depth");
    expect(finalDenyBlock).toBeGreaterThan(0);
    expect(dockerignore.slice(finalDenyBlock)).not.toMatch(/^!/mu);
    expect(compose).toContain("/workspace/node_modules/.vite-temp:rw");
    expect(compose).toContain("/home/p17perf/.local/share/vitest:rw");
    expect(compose).not.toContain("/workspace/node_modules:rw");
  });

  it("preserves isolation and separates performance acceptance from execution", () => {
    expect(contract.status.ownerPerformanceBudget).toBe("APPROVED_LES_P17_PERFORMANCE_BUDGET_R01");
    expect(contract.status.performanceExecutionAuthorization).toBe(
      "AUTHORIZED_LOCAL_ONLY_LES_P17_AUTONOMOUS_COMPLETION_R01",
    );
    expect(contract.status.performanceAcceptance).toBe("NOT_PROVEN");
    expect(contract.status.gateD).toBe("NOT_READY");
    expect(contract.status.productionAuthorization).toBe("UNAUTHORIZED");
    expect(contract.network.databaseMode).toBe("none");
    expect(contract.network.applicationMode).toBe("service:p17-db");
    expect(contract.network.publishedPorts).toBe(0);
  });

  it("binds the future cache to the approved Linux identity and packages", () => {
    expect(contract.offlineCache.key).toContain("npm-11.19.1/node-24.21.0/linux-amd64-glibc/");
    expect(contract.offlineCache.root).toContain(contract.offlineCache.key);
    expect(contract.offlineCache.identity.packageLockSha256).toBe(
      "E93A35F25C59CADF6BEA860759B447CC2F86DEC16CA562B0182BB5AC02902720",
    );
    expect(contract.offlineCache.identity.registryOrigin).toBe("https://registry.npmjs.org");
    expect(contract.offlineCache.requiredPackages).toEqual(
      expect.arrayContaining([
        {
          lockPath: "node_modules/@next/swc-linux-x64-gnu",
          version: "16.3.8",
        },
        {
          lockPath: "node_modules/@img/sharp-linux-x64",
          version: "0.35.5",
        },
        {
          lockPath: "node_modules/@rolldown/binding-linux-x64-gnu",
          version: "1.2.8",
        },
        {
          lockPath: "node_modules/lightningcss-linux-x64-gnu",
          version: "1.33.0",
        },
      ]),
    );
  });
});
