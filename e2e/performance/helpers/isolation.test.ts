import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertCapsuleNetworkSnapshot,
  assertNoExternalServiceEnvironment,
  assertLocalPerformanceExecutionAuthorized,
  assertOperationalIsolation,
  assertPerformanceExecutionContract,
  assertPerformanceStorage,
  assertPerformanceTargetEnvironment,
  buildPerformanceChildEnvironment,
  PERFORMANCE_EXECUTION_AUTHORITY,
  performanceStorageRoot,
  validatePerformanceDatabaseUrl,
} from "./isolation";

const repositoryRoot = resolve("C:/synthetic/lessenc-digital");
const databaseUrl =
  "mysql://lessenc_p17_perf:p17_perf_password@127.0.0.1:3307/lessenc_p17_perf_test";

describe("P17 performance isolation guards", () => {
  it("rejects hosted and any base URL override", () => {
    expect(() => assertPerformanceTargetEnvironment({ P17_TARGET: "hosted" })).toThrow(
      "P17_PERFORMANCE_TARGET_NOT_LOCAL",
    );
    expect(() =>
      assertPerformanceTargetEnvironment({ P17_BASE_URL: "https://example.invalid" }),
    ).toThrow("P17_PERFORMANCE_BASE_URL_OVERRIDE_FORBIDDEN");
  });

  it("rejects retries, extra workers, service workers and non-local origin", () => {
    const valid = {
      retries: 0,
      workers: 1,
      serviceWorkers: "block",
      baseURL: "http://127.0.0.1:3100",
    };

    expect(() => assertPerformanceExecutionContract({ ...valid, retries: 1 })).toThrow(
      "P17_PERFORMANCE_RETRIES_NOT_ZERO",
    );
    expect(() => assertPerformanceExecutionContract({ ...valid, workers: 2 })).toThrow(
      "P17_PERFORMANCE_WORKERS_NOT_ONE",
    );
    expect(() => assertPerformanceExecutionContract({ ...valid, serviceWorkers: "allow" })).toThrow(
      "P17_PERFORMANCE_SERVICE_WORKERS_NOT_BLOCKED",
    );
    expect(() =>
      assertPerformanceExecutionContract({ ...valid, baseURL: "https://example.invalid" }),
    ).toThrow("P17_PERFORMANCE_BASE_URL_NOT_LOCAL");
  });

  it("accepts only the dedicated loopback database identity", () => {
    expect(validatePerformanceDatabaseUrl(databaseUrl)).toEqual({
      host: "127.0.0.1",
      port: "3307",
      database: "lessenc_p17_perf_test",
      user: "lessenc_p17_perf",
    });

    expect(() =>
      validatePerformanceDatabaseUrl(
        "mysql://lessenc_p17_perf:p17_perf_password@db.example.invalid:3307/lessenc_p17_perf_test",
      ),
    ).toThrow("P17_PERFORMANCE_DATABASE_HOST_NOT_LOOPBACK");
    expect(() =>
      validatePerformanceDatabaseUrl(
        "mysql://lessenc_p17_perf:p17_perf_password@127.0.0.1:3307/lessenc_staging",
      ),
    ).toThrow("P17_PERFORMANCE_DATABASE_NAME_INVALID");
    expect(() =>
      validatePerformanceDatabaseUrl(
        "mysql://lessenc_p17_perf:p17_perf_password@127.0.0.1:3306/lessenc_p17_perf_test",
      ),
    ).toThrow("P17_PERFORMANCE_DATABASE_PORT_NOT_AUTHORIZED");
  });

  it("keeps storage inside the synthetic private root", () => {
    const root = performanceStorageRoot(repositoryRoot);
    expect(
      assertPerformanceStorage({
        driver: "local-filesystem",
        path: root,
        repositoryRoot,
      }),
    ).toBe(root);
    expect(() =>
      assertPerformanceStorage({ driver: "hosted", path: root, repositoryRoot }),
    ).toThrow("P17_PERFORMANCE_STORAGE_DRIVER_INVALID");
    expect(() =>
      assertPerformanceStorage({
        driver: "local-filesystem",
        path: resolve(repositoryRoot, "public", "resource.pdf"),
        repositoryRoot,
      }),
    ).toThrow("P17_PERFORMANCE_STORAGE_PATH_OUTSIDE_SYNTHETIC_ROOT");
  });

  it("constructs a child environment by allowlist without inherited service secrets", () => {
    const child = buildPerformanceChildEnvironment(
      {
        PATH: "synthetic-path",
        MERCADOPAGO_ACCESS_TOKEN: "must-not-be-copied",
        PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY: "must-not-be-copied",
        UNRELATED_PARENT_VALUE: "must-not-be-copied",
      },
      {
        databaseUrl,
        repositoryRoot,
        runId: "p17-perf-isolation-unit-test",
        commit: "d73b2d678686fc805c6eb5f26a852ae60f870b91",
      },
    );

    expect(child.PATH).toBe("synthetic-path");
    expect(child.APP_ENV).toBe("local");
    expect(child.NODE_ENV).toBe("production");
    expect(child.P17_TARGET).toBe("local");
    expect(child.P17_PERF_COMMIT).toBe("d73b2d678686fc805c6eb5f26a852ae60f870b91");
    expect(child.MERCADOPAGO_ACCESS_TOKEN).toBeUndefined();
    expect(child.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY).toBeUndefined();
    expect(child.UNRELATED_PARENT_VALUE).toBeUndefined();
  });

  it("rejects a third-party secret in the final child environment without using its value", () => {
    expect(() =>
      assertNoExternalServiceEnvironment({ MERCADOPAGO_ACCESS_TOKEN: "synthetic-hidden-value" }),
    ).toThrow("P17_PERFORMANCE_EXTERNAL_SERVICE_ENV_FORBIDDEN");
  });

  it("authorizes only the exact local acceptance contract with complete provenance", () => {
    const sourceTreeSha256 = "a".repeat(64);
    const child = buildPerformanceChildEnvironment(
      { PATH: "synthetic-path" },
      {
        databaseUrl,
        repositoryRoot,
        runId: "p17-perf-authorized-local-test",
        commit: "d73b2d678686fc805c6eb5f26a852ae60f870b91",
        sourceTreeSha256,
        mode: "acceptance-local",
        executionAuthority: PERFORMANCE_EXECUTION_AUTHORITY,
      },
    );

    expect(() => assertLocalPerformanceExecutionAuthorized(child, repositoryRoot)).not.toThrow();
    expect(child.P17_PERF_MODE).toBe("acceptance-local");
    expect(child.P17_SOURCE_TREE_SHA256).toBe(sourceTreeSha256);
    expect(child.P17_PERF_EXECUTION_AUTHORITY).toBe(PERFORMANCE_EXECUTION_AUTHORITY);

    expect(() =>
      buildPerformanceChildEnvironment(
        { PATH: "synthetic-path" },
        {
          databaseUrl,
          repositoryRoot,
          runId: "p17-perf-unauthorized-local-test",
          commit: "d73b2d678686fc805c6eb5f26a852ae60f870b91",
          sourceTreeSha256,
          mode: "acceptance-local",
          executionAuthority: "NOT_AUTHORIZED",
        },
      ),
    ).toThrow("P17_PERFORMANCE_EXECUTION_AUTHORITY_INVALID");
  });

  it("requires loopback-only interfaces, no default route and no external DNS", () => {
    const validSnapshot = {
      interfaces: ["lo"],
      ipv4Routes: ["local 127.0.0.0/8 dev lo"],
      ipv6Routes: ["local ::1 dev lo"],
      dnsServers: [] as string[],
    };

    expect(() => assertCapsuleNetworkSnapshot(validSnapshot)).not.toThrow();
    expect(() =>
      assertCapsuleNetworkSnapshot({ ...validSnapshot, interfaces: ["eth0", "lo"] }),
    ).toThrow("P17_PERFORMANCE_CAPSULE_INTERFACE_INVALID");
    expect(() =>
      assertCapsuleNetworkSnapshot({ ...validSnapshot, ipv4Routes: ["default via 172.17.0.1"] }),
    ).toThrow("P17_PERFORMANCE_CAPSULE_DEFAULT_ROUTE_PRESENT");
    expect(() =>
      assertCapsuleNetworkSnapshot({ ...validSnapshot, dnsServers: ["8.8.8.8"] }),
    ).toThrow("P17_PERFORMANCE_CAPSULE_EXTERNAL_DNS_PRESENT");
  });

  it("requires both loopback function and negative Node/Chromium egress probes", () => {
    const evidence = {
      snapshot: {
        interfaces: ["lo"],
        ipv4Routes: [] as string[],
        ipv6Routes: [] as string[],
        dnsServers: [] as string[],
      },
      loopbackNode: true,
      loopbackChromium: true,
      loopbackDatabase: true,
      nodeEgressBlocked: true,
      chromiumEgressBlocked: true,
    };

    expect(() => assertOperationalIsolation(evidence)).not.toThrow();
    expect(() => assertOperationalIsolation({ ...evidence, chromiumEgressBlocked: false })).toThrow(
      "P17_PERFORMANCE_CAPSULE_EGRESS_NOT_PROVEN",
    );
  });
});
