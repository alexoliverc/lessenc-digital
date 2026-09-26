import { describe, expect, it } from "vitest";

import {
  databaseNameFromRuntimeUrl,
  verifyRuntimeDatabasePrivileges,
} from "./runtime-database-privileges";

const row = (grant: string) => ({ "Grants for staged@%": grant });

describe("P16-HDB runtime privilege verification", () => {
  it("accepts only the four DML privileges required by repository runtime behavior", () => {
    expect(
      verifyRuntimeDatabasePrivileges(
        [
          row("GRANT USAGE ON *.* TO `staged`@`%`"),
          row("GRANT SELECT, INSERT, UPDATE, DELETE ON `lessenc_staging`.* TO `staged`@`%`"),
        ],
        "lessenc_staging",
        "distinct-users",
      ),
    ).toEqual({ safe: true, failureCode: null });
  });

  it("accepts MySQL-escaped underscores in quoted database grant scopes", () => {
    expect(
      verifyRuntimeDatabasePrivileges(
        [
          row("GRANT USAGE ON *.* TO `staged`@`%`"),
          row("GRANT SELECT, INSERT, UPDATE, DELETE ON `lessenc\\_staging`.* TO `staged`@`%`"),
        ],
        "lessenc_staging",
        "distinct-users",
      ),
    ).toEqual({ safe: true, failureCode: null });

    expect(
      verifyRuntimeDatabasePrivileges(
        [
          row("GRANT USAGE ON *.* TO `staged`@`%`"),
          row(
            "GRANT SELECT, INSERT, UPDATE, DELETE, DELETE HISTORY, SHOW CREATE ROUTINE ON `lessenc\\_staging`.* TO `staged`@`%`",
          ),
        ],
        "lessenc_staging",
        "hostinger-managed-single-user",
      ),
    ).toEqual({ safe: true, failureCode: null });
  });

  it("rejects unsupported database-scope escape sequences", () => {
    expect(
      verifyRuntimeDatabasePrivileges(
        [
          row("GRANT USAGE ON *.* TO `staged`@`%`"),
          row("GRANT SELECT, INSERT, UPDATE, DELETE ON `lessenc\\xstaging`.* TO `staged`@`%`"),
        ],
        "lessenc_staging",
        "distinct-users",
      ),
    ).toEqual({
      safe: false,
      failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
    });
  });

  it("still rejects a foreign schema after valid underscore unescaping", () => {
    expect(
      verifyRuntimeDatabasePrivileges(
        [
          row("GRANT USAGE ON *.* TO `staged`@`%`"),
          row("GRANT SELECT, INSERT, UPDATE, DELETE ON `other\\_staging`.* TO `staged`@`%`"),
        ],
        "lessenc_staging",
        "distinct-users",
      ),
    ).toEqual({
      safe: false,
      failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
    });
  });
  it.each([
    [
      "unsupported scope syntax",
      "GRANT SELECT, INSERT, UPDATE, DELETE ON `lessenc\\xstaging`.* TO `staged`@`%`",
      "SCOPE_FORMAT_UNSUPPORTED",
    ],
    [
      "foreign database scope",
      "GRANT SELECT, INSERT, UPDATE, DELETE ON `other_staging`.* TO `staged`@`%`",
      "SCOPE_NOT_EXPECTED_DATABASE",
    ],
    [
      "unexpected privilege",
      "GRANT SELECT, INSERT, UPDATE, DELETE, CREATE ON `lessenc_staging`.* TO `staged`@`%`",
      "PRIVILEGE_NOT_ALLOWED",
    ],
    [
      "missing required runtime privilege",
      "GRANT SELECT, INSERT, UPDATE ON `lessenc_staging`.* TO `staged`@`%`",
      "REQUIRED_PRIVILEGES_MISSING",
    ],
    [
      "unsupported grant statement",
      "GRANT `runtime_role` TO `staged`@`%`",
      "STATEMENT_FORMAT_UNSUPPORTED",
    ],
  ] as const)("reports only sanitized diagnostic reason for %s", (_case, grant, expectedReason) => {
    let observedReason: string | null = null;

    const result = verifyRuntimeDatabasePrivileges(
      [row("GRANT USAGE ON *.* TO `staged`@`%`"), row(grant)],
      "lessenc_staging",
      "distinct-users",
      (diagnostic) => {
        observedReason = diagnostic.reason;
      },
    );

    expect(result).toEqual({
      safe: false,
      failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
    });
    expect(observedReason).toBe(expectedReason);
  });

  it("reports only the normalized rejected privilege token", () => {
    let observedDiagnostic: Readonly<{
      reason: string;
      unexpectedPrivilege?: string;
    }> | null = null;

    const result = verifyRuntimeDatabasePrivileges(
      [
        row("GRANT USAGE ON *.* TO `staged`@`%`"),
        row(
          "GRANT SELECT, INSERT, UPDATE, DELETE, CREATE VIEW ON `lessenc_staging`.* TO `staged`@`%`",
        ),
      ],
      "lessenc_staging",
      "hostinger-managed-single-user",
      (diagnostic) => {
        observedDiagnostic = diagnostic;
      },
    );

    expect(result).toEqual({
      safe: false,
      failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
    });

    expect(observedDiagnostic).toEqual({
      reason: "PRIVILEGE_NOT_ALLOWED",
      unexpectedPrivilege: "CREATE VIEW",
    });
  });

  it("does not expose an unexpected privilege token outside the strict safe alphabet", () => {
    let unexpectedPrivilege: string | undefined;

    verifyRuntimeDatabasePrivileges(
      [
        row("GRANT USAGE ON *.* TO `staged`@`%`"),
        row(
          "GRANT SELECT, INSERT, UPDATE, DELETE, CREATE-VIEW ON `lessenc_staging`.* TO `staged`@`%`",
        ),
      ],
      "lessenc_staging",
      "hostinger-managed-single-user",
      (diagnostic) => {
        unexpectedPrivilege = diagnostic.unexpectedPrivilege;
      },
    );

    expect(unexpectedPrivilege).toBeUndefined();
  });

  it.each([
    "ALL PRIVILEGES",
    "CREATE",
    "ALTER",
    "DROP",
    "INDEX",
    "CREATE VIEW",
    "CREATE ROUTINE",
    "TRIGGER",
    "EVENT",
    "EXECUTE",
  ])("rejects broad or non-runtime privilege %s", (privilege) => {
    expect(
      verifyRuntimeDatabasePrivileges(
        [
          row(
            `GRANT SELECT, INSERT, UPDATE, DELETE, ${privilege} ON \`lessenc_staging\`.* TO \`staged\`@\`%\``,
          ),
        ],
        "lessenc_staging",
        "distinct-users",
      ),
    ).toEqual({
      safe: false,
      failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
    });
  });

  it("rejects grant option, missing DML, other schemas, global DML and uninterpreted roles", () => {
    const cases = [
      [
        row(
          "GRANT SELECT, INSERT, UPDATE, DELETE ON `lessenc_staging`.* TO `staged`@`%` WITH GRANT OPTION",
        ),
      ],
      [row("GRANT SELECT, INSERT, UPDATE ON `lessenc_staging`.* TO `staged`@`%`")],
      [row("GRANT SELECT, INSERT, UPDATE, DELETE ON `other_staging`.* TO `staged`@`%`")],
      [row("GRANT SELECT ON *.* TO `staged`@`%`")],
      [row("GRANT `runtime_role` TO `staged`@`%`")],
    ];

    for (const grants of cases) {
      expect(
        verifyRuntimeDatabasePrivileges(grants, "lessenc_staging", "distinct-users").safe,
      ).toBe(false);
    }
  });

  it("accepts only the known provider extras under explicit Hostinger mode", () => {
    const grants = [
      row("GRANT USAGE ON *.* TO `staged`@`%`"),
      row(
        "GRANT SELECT, INSERT, UPDATE, DELETE, DELETE HISTORY, SHOW CREATE ROUTINE ON `lessenc_staging`.* TO `staged`@`%`",
      ),
    ];

    expect(
      verifyRuntimeDatabasePrivileges(grants, "lessenc_staging", "hostinger-managed-single-user"),
    ).toEqual({ safe: true, failureCode: null });

    expect(verifyRuntimeDatabasePrivileges(grants, "lessenc_staging", "distinct-users")).toEqual({
      safe: false,
      failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
    });
  });

  it("accepts a stricter Hostinger grant if the provider removes its managed extras", () => {
    expect(
      verifyRuntimeDatabasePrivileges(
        [
          row("GRANT USAGE ON *.* TO `staged`@`%`"),
          row("GRANT SELECT, INSERT, UPDATE, DELETE ON `lessenc_staging`.* TO `staged`@`%`"),
        ],
        "lessenc_staging",
        "hostinger-managed-single-user",
      ),
    ).toEqual({ safe: true, failureCode: null });
  });

  it("rejects every unapproved additional privilege under Hostinger mode", () => {
    expect(
      verifyRuntimeDatabasePrivileges(
        [
          row("GRANT USAGE ON *.* TO `staged`@`%`"),
          row(
            "GRANT SELECT, INSERT, UPDATE, DELETE, DELETE HISTORY, SHOW CREATE ROUTINE, CREATE ON `lessenc_staging`.* TO `staged`@`%`",
          ),
        ],
        "lessenc_staging",
        "hostinger-managed-single-user",
      ),
    ).toEqual({
      safe: false,
      failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
    });
  });

  it("extracts only an explicit MySQL database name without exposing credentials", () => {
    expect(databaseNameFromRuntimeUrl("mysql://user:password@db.invalid/lessenc_staging")).toBe(
      "lessenc_staging",
    );
    expect(databaseNameFromRuntimeUrl("not-a-url")).toBeNull();
  });
});
