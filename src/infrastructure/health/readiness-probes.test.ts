import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseQuery = vi.hoisted(() => vi.fn());
const databaseQueryUnsafe = vi.hoisted(() => vi.fn());

vi.mock("@/infrastructure/database/client", () => ({
  getDatabaseClient: () => ({
    $queryRaw: databaseQuery,
    $queryRawUnsafe: databaseQueryUnsafe,
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
    databaseQueryUnsafe.mockReset();
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

  it("fails staging readiness generically when runtime grants remain over-privileged", async () => {
    const previous = {
      APP_ENV: process.env.APP_ENV,
      DB_RUNTIME_URL: process.env.DB_RUNTIME_URL,
      P16_DATABASE_ACCESS_MODEL: process.env.P16_DATABASE_ACCESS_MODEL,
      P16_DATABASE_MIGRATION_WINDOW: process.env.P16_DATABASE_MIGRATION_WINDOW,
      PRIVATE_STORAGE_DRIVER: process.env.PRIVATE_STORAGE_DRIVER,
    };

    process.env.APP_ENV = "staging";
    process.env.DB_RUNTIME_URL = "mysql://hostinger:synthetic@db.invalid/lessenc_staging";
    process.env.P16_DATABASE_ACCESS_MODEL = "hostinger-managed-single-user";
    process.env.P16_DATABASE_MIGRATION_WINDOW = "disabled";
    process.env.PRIVATE_STORAGE_DRIVER = "hosted";

    databaseQuery.mockResolvedValue([{ readiness: 1 }]);
    databaseQueryUnsafe.mockResolvedValue([
      {
        "Grants for staged@%": "GRANT ALL PRIVILEGES ON `lessenc_staging`.* TO `staged`@`%`",
      },
    ]);

    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const report = await runReadinessProbe(correlationId);
      const serialized = JSON.stringify(report);

      expect(report.status).toBe("NOT_READY");
      expect(serialized).not.toContain("ALL PRIVILEGES");
      expect(serialized).not.toContain("staged@%");
      expect(serialized).not.toContain("lessenc_staging");
      const logs = JSON.stringify(output.mock.calls);

      expect(logs).not.toContain("ALL PRIVILEGES");
      expect(logs).toContain("unexpectedPrivilegeFingerprint");
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("accepts the Hostinger-managed grant baseline when provider-extra target surfaces are absent", async () => {
    const previous = {
      APP_ENV: process.env.APP_ENV,
      DB_RUNTIME_URL: process.env.DB_RUNTIME_URL,
      P16_DATABASE_ACCESS_MODEL: process.env.P16_DATABASE_ACCESS_MODEL,
      P16_DATABASE_MIGRATION_WINDOW: process.env.P16_DATABASE_MIGRATION_WINDOW,
      PRIVATE_STORAGE_DRIVER: process.env.PRIVATE_STORAGE_DRIVER,
    };

    process.env.APP_ENV = "staging";
    process.env.DB_RUNTIME_URL = "mysql://hostinger:synthetic@db.invalid/lessenc_staging";
    process.env.P16_DATABASE_ACCESS_MODEL = "hostinger-managed-single-user";
    process.env.P16_DATABASE_MIGRATION_WINDOW = "disabled";
    process.env.PRIVATE_STORAGE_DRIVER = "hosted";

    databaseQuery.mockReset();
    databaseQueryUnsafe.mockReset();

    databaseQuery
      .mockResolvedValueOnce([{ readiness: 1 }])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ total: 0 }]);

    databaseQueryUnsafe.mockResolvedValue([
      {
        "Grants for staged@%": "GRANT USAGE ON *.* TO `staged`@`%`",
      },
      {
        "Grants for staged@%":
          "GRANT SELECT, INSERT, UPDATE, DELETE, DELETE HISTORY, SHOW CREATE ROUTINE ON `lessenc_staging`.* TO `staged`@`%`",
      },
    ]);

    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const report = await runReadinessProbe(correlationId);
      const logs = JSON.stringify(output.mock.calls);

      expect(report.status).toBe("NOT_READY");
      expect(logs).not.toContain("readiness_database_privilege_check_failed");
      expect(logs).not.toContain("DELETE HISTORY");
      expect(logs).not.toContain("SHOW CREATE ROUTINE");
      expect(databaseQueryUnsafe).toHaveBeenCalledTimes(1);
      expect(databaseQuery).toHaveBeenCalledTimes(3);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it.each([
    ["system-versioned table", 1, 0],
    ["stored routine", 0, 1],
  ])(
    "fails closed when a Hostinger provider-managed privilege gains a %s target surface",
    async (_surface, versionedTableCount, storedRoutineCount) => {
      const previous = {
        APP_ENV: process.env.APP_ENV,
        DB_RUNTIME_URL: process.env.DB_RUNTIME_URL,
        P16_DATABASE_ACCESS_MODEL: process.env.P16_DATABASE_ACCESS_MODEL,
        P16_DATABASE_MIGRATION_WINDOW: process.env.P16_DATABASE_MIGRATION_WINDOW,
        PRIVATE_STORAGE_DRIVER: process.env.PRIVATE_STORAGE_DRIVER,
      };

      process.env.APP_ENV = "staging";
      process.env.DB_RUNTIME_URL = "mysql://hostinger:synthetic@db.invalid/lessenc_staging";
      process.env.P16_DATABASE_ACCESS_MODEL = "hostinger-managed-single-user";
      process.env.P16_DATABASE_MIGRATION_WINDOW = "disabled";
      process.env.PRIVATE_STORAGE_DRIVER = "hosted";

      databaseQuery.mockReset();
      databaseQueryUnsafe.mockReset();

      databaseQuery
        .mockResolvedValueOnce([{ readiness: 1 }])
        .mockResolvedValueOnce([{ total: versionedTableCount }])
        .mockResolvedValueOnce([{ total: storedRoutineCount }]);

      databaseQueryUnsafe.mockResolvedValue([
        {
          "Grants for staged@%": "GRANT USAGE ON *.* TO `staged`@`%`",
        },
        {
          "Grants for staged@%":
            "GRANT SELECT, INSERT, UPDATE, DELETE, DELETE HISTORY, SHOW CREATE ROUTINE ON `lessenc_staging`.* TO `staged`@`%`",
        },
      ]);

      const output = vi.spyOn(console, "error").mockImplementation(() => undefined);

      try {
        const report = await runReadinessProbe(correlationId);
        const logs = JSON.stringify(output.mock.calls);

        expect(report.status).toBe("NOT_READY");
        expect(logs).toContain("readiness_database_privilege_check_failed");
        expect(logs).toContain("DATABASE_RUNTIME_PRIVILEGES_UNSAFE");
        expect(logs).not.toContain("DELETE HISTORY");
        expect(logs).not.toContain("SHOW CREATE ROUTINE");
      } finally {
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    },
  );
});
