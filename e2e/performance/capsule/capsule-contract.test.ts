import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), "utf8");

const dockerfile = read("e2e/performance/capsule/Dockerfile");
const entrypoint = read("e2e/performance/capsule/entrypoint.sh");
const networkVerifier = read("scripts/p17-capsule-network.mjs");
const buildScript = read("e2e/performance/capsule/build-app.sh");
const compose = read("e2e/performance/capsule/compose.yaml");
const dockerignore = read(".dockerignore");
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

  it("shares only the database network namespace and publishes no ports or volumes", () => {
    expect(compose).toContain("network_mode: none");
    expect(compose).toContain("network_mode: service:p17-db");
    expect(compose).toContain("--bind-address=127.0.0.1");
    expect(compose).toContain("--port=3307");
    expect(compose).not.toMatch(/^\s+ports:/mu);
    expect(compose).not.toMatch(/^\s+volumes:/mu);
    expect(compose).not.toMatch(/^networks:/mu);
    expect(compose).not.toMatch(/^\s+privileged:/mu);
    expect(compose).not.toMatch(/^\s+extra_hosts:/mu);
    expect(compose).toContain('dns: ["127.0.0.1"]');
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("no-new-privileges:true");
  });

  it("keeps runtime commands blocked and requires loopback-only networking", () => {
    expect(entrypoint).not.toContain("P17_CAPSULE_MYSQL_MISSING");
    expect(networkVerifier).toContain("P17_CAPSULE_NON_LOOPBACK_INTERFACE_PRESENT");
    expect(networkVerifier).toContain("P17_CAPSULE_IPV4_DEFAULT_ROUTE_PRESENT");
    expect(networkVerifier).toContain("P17_CAPSULE_IPV6_DEFAULT_ROUTE_PRESENT");
    expect(networkVerifier).toContain("P17_CAPSULE_EXTERNAL_DNS_PRESENT");
    expect(entrypoint).toContain("P17_ALLOW_HOSTED_READ_ONLY");
    expect(entrypoint).toContain("MERCADOPAGO_ACCESS_TOKEN");
    expect(entrypoint).toMatch(/collect \| run \| server\)/u);
    expect(entrypoint).toContain("P17_PERFORMANCE_I04_B_NOT_AUTHORIZED");
    expect(entrypoint).toContain("P17_CAPSULE_STATIC_ISOLATION_VALIDATED");
    expect(entrypoint).toContain("P17_CAPSULE_SHARP_VERSION_INVALID");
    expect(entrypoint).toContain("P17_CAPSULE_SOURCE_MAP_JS_VERSION_INVALID");
  });

  it("uses an allowlisted build context with explicit secret exclusions", () => {
    expect(dockerignore.startsWith("**\n")).toBe(true);
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
    expect(dockerignore).toContain("!scripts/p17-npm-cache-verify.mjs");
    expect(dockerignore).toContain("npm-11.19.1/node-24.21.0/linux-amd64-glibc/");
    expect(dockerignore).not.toContain("!e2e/performance/capsule/**");
  });

  it("preserves isolation and separates performance acceptance from execution", () => {
    expect(contract.status.performanceAcceptance).toBe("BLOCKED_OWNER_BUDGET");
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
