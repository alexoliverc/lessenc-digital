import { describe, expect, it } from "vitest";

import {
  evaluateReadiness,
  projectPublicReadiness,
  READINESS_CHECK_NAMES,
  type ReadinessCheck,
} from "./readiness";

function readyChecks(): ReadinessCheck[] {
  return READINESS_CHECK_NAMES.map((name) => ({ name, ready: true }));
}

describe("P15 readiness contract", () => {
  it("reports READY only when every essential dependency is ready", () => {
    const report = evaluateReadiness(readyChecks());

    expect(report.status).toBe("READY");
    expect(projectPublicReadiness(report)).toEqual({ status: "ready" });
  });

  it("reports NOT_READY without exposing internal failure detail publicly", () => {
    const checks = readyChecks();
    checks[1] = {
      name: "DATABASE_CONNECTIVITY",
      ready: false,
      failureCode: "DATABASE_UNAVAILABLE",
      databaseUrl: "mysql://secret@private/database",
    } as ReadinessCheck;

    const report = evaluateReadiness(checks);
    const publicStatus = projectPublicReadiness(report);

    expect(report.status).toBe("NOT_READY");
    expect(report.checks[1]).toEqual({
      name: "DATABASE_CONNECTIVITY",
      ready: false,
      failureCode: "DATABASE_UNAVAILABLE",
    });
    expect(publicStatus).toEqual({ status: "not_ready" });
    expect(JSON.stringify(publicStatus)).not.toContain("DATABASE");
    expect(JSON.stringify(report)).not.toContain("mysql://");
  });

  it("requires the exact check set and safe failure codes", () => {
    expect(() => evaluateReadiness(readyChecks().slice(0, -1))).toThrow(
      "INVALID_READINESS_CHECK_SET",
    );

    const unsafe = readyChecks();
    unsafe[2] = {
      name: "PRIVATE_STORAGE",
      ready: false,
      failureCode: "C:\\private\\secret",
    };

    expect(() => evaluateReadiness(unsafe)).toThrow("INVALID_READINESS_FAILURE_CODE");
  });
});
