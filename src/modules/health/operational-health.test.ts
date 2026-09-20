import { describe, expect, it } from "vitest";

import {
  evaluateOperationalHealth,
  OPERATIONAL_HEALTH_CHECK_NAMES,
  type OperationalHealthCheckInput,
} from "./operational-health";

function healthyChecks(): OperationalHealthCheckInput[] {
  return OPERATIONAL_HEALTH_CHECK_NAMES.map((name) => ({
    name,
    status: "OK" as const,
  }));
}

describe("P11 operational health core", () => {
  it("reports OK when every required operational check is healthy", () => {
    const result = evaluateOperationalHealth(healthyChecks());

    expect(result.status).toBe("OK");

    expect(result.checks.map((check) => check.name)).toEqual(OPERATIONAL_HEALTH_CHECK_NAMES);

    expect(result.checks.every((check) => check.status === "OK")).toBe(true);
  });

  it("reports DEGRADED when at least one check is degraded and none has failed", () => {
    const checks = healthyChecks();

    checks[2] = {
      name: "RATE_LIMIT_RETENTION",
      status: "DEGRADED",
      failureCode: "RATE_LIMIT_STALE_BUCKETS_DETECTED",
    };

    const result = evaluateOperationalHealth(checks);

    expect(result.status).toBe("DEGRADED");
  });

  it("reports FAILED with precedence over DEGRADED", () => {
    const checks = healthyChecks();

    checks[2] = {
      name: "RATE_LIMIT_RETENTION",
      status: "DEGRADED",
      failureCode: "RATE_LIMIT_STALE_BUCKETS_DETECTED",
    };

    checks[1] = {
      name: "DATABASE_CONNECTIVITY",
      status: "FAILED",
      failureCode: "DATABASE_UNAVAILABLE",
    };

    const result = evaluateOperationalHealth(checks);

    expect(result.status).toBe("FAILED");
  });

  it("requires the complete frozen check set exactly once", () => {
    const missing = healthyChecks().slice(0, -1);

    expect(() => evaluateOperationalHealth(missing)).toThrow(
      "INVALID_OPERATIONAL_HEALTH_CHECK_SET",
    );

    const duplicate = healthyChecks();

    duplicate[4] = {
      ...duplicate[0]!,
    };

    expect(() => evaluateOperationalHealth(duplicate)).toThrow(
      "DUPLICATE_OPERATIONAL_HEALTH_CHECK",
    );
  });

  it("rejects unknown names and statuses", () => {
    const invalidName = healthyChecks();

    invalidName[0] = {
      name: "UNKNOWN" as never,
      status: "OK",
    };

    expect(() => evaluateOperationalHealth(invalidName)).toThrow(
      "INVALID_OPERATIONAL_HEALTH_CHECK_NAME",
    );

    const invalidStatus = healthyChecks();

    invalidStatus[0] = {
      name: "APPLICATION_CONTRACT",
      status: "UNKNOWN" as never,
    };

    expect(() => evaluateOperationalHealth(invalidStatus)).toThrow(
      "INVALID_OPERATIONAL_HEALTH_CHECK_STATUS",
    );
  });

  it("requires safe failure codes only for non-OK checks", () => {
    const okWithFailure = healthyChecks();

    okWithFailure[0] = {
      name: "APPLICATION_CONTRACT",
      status: "OK",
      failureCode: "SHOULD_NOT_EXIST",
    };

    expect(() => evaluateOperationalHealth(okWithFailure)).toThrow(
      "INVALID_OPERATIONAL_HEALTH_OK_FAILURE_CODE",
    );

    const degradedWithoutCode = healthyChecks();

    degradedWithoutCode[0] = {
      name: "APPLICATION_CONTRACT",
      status: "DEGRADED",
    };

    expect(() => evaluateOperationalHealth(degradedWithoutCode)).toThrow(
      "INVALID_OPERATIONAL_HEALTH_FAILURE_CODE",
    );

    const unsafeCode = healthyChecks();

    unsafeCode[0] = {
      name: "APPLICATION_CONTRACT",
      status: "FAILED",
      failureCode: "secret-path:C:\\private",
    };

    expect(() => evaluateOperationalHealth(unsafeCode)).toThrow(
      "INVALID_OPERATIONAL_HEALTH_FAILURE_CODE",
    );
  });

  it("copies only the safe contract fields and drops arbitrary extra data", () => {
    const checks = healthyChecks();

    checks[1] = {
      name: "DATABASE_CONNECTIVITY",
      status: "FAILED",
      failureCode: "DATABASE_UNAVAILABLE",
      databaseUrl: "mysql://user:password@private/database",
      customerId: "customer-private-id",
      storagePath: "C:\\private\\storage",
      errorMessage: "private failure detail",
    } as OperationalHealthCheckInput;

    const result = evaluateOperationalHealth(checks);

    const serialized = JSON.stringify(result);

    expect(serialized).toContain("DATABASE_UNAVAILABLE");

    expect(serialized).not.toContain("mysql://");

    expect(serialized).not.toContain("customer-private-id");

    expect(serialized).not.toContain("C:\\\\private");

    expect(serialized).not.toContain("private failure detail");

    expect(result.checks[1]).toEqual({
      name: "DATABASE_CONNECTIVITY",
      status: "FAILED",
      failureCode: "DATABASE_UNAVAILABLE",
    });
  });
});
