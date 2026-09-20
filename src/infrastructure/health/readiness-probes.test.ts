import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseQuery = vi.hoisted(() => vi.fn());

vi.mock("@/infrastructure/database/client", () => ({
  getDatabaseClient: () => ({
    $queryRaw: databaseQuery,
  }),
}));

import { runReadinessProbe } from "./readiness-probes";

const correlationId = "11111111-1111-4111-8111-111111111111";
const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function databaseFailureRecord(calls: readonly unknown[][]): Record<string, unknown> {
  const serialized = calls
    .map((call) => String(call[0]))
    .find((entry) => entry.includes('"event":"readiness_database_probe_failed"'));

  if (serialized === undefined) {
    throw new Error("READINESS_DATABASE_FAILURE_LOG_NOT_FOUND");
  }

  return JSON.parse(serialized) as Record<string, unknown>;
}

describe("P15 readiness diagnostic correlation", () => {
  beforeEach(() => {
    databaseQuery.mockRejectedValue(new Error("synthetic readiness failure"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    databaseQuery.mockReset();
  });

  it("uses the request correlation ID for a database diagnostic failure", async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const report = await runReadinessProbe(correlationId);
    const record = databaseFailureRecord(output.mock.calls);

    expect(report.status).toBe("NOT_READY");
    expect(record.correlationId).toBe(correlationId);
    expect(record.failureCode).toBe("DATABASE_UNAVAILABLE");
    expect(JSON.stringify(record)).not.toContain("synthetic readiness failure");
  });

  it("generates a fresh canonical server ID outside an HTTP request", async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await runReadinessProbe();

    expect(databaseFailureRecord(output.mock.calls).correlationId).toMatch(canonicalUuidPattern);
  });
});
