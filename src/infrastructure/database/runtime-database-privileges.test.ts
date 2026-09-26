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
