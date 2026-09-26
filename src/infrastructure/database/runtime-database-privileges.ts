const REQUIRED_RUNTIME_PRIVILEGES = new Set(["SELECT", "INSERT", "UPDATE", "DELETE"]);

const HOSTINGER_MANAGED_RUNTIME_PRIVILEGE_EXTRAS = new Set([
  "DELETE HISTORY",
  "SHOW CREATE ROUTINE",
]);

export type RuntimeDatabaseAccessModel = "distinct-users" | "hostinger-managed-single-user";

export type RuntimePrivilegeVerification = Readonly<{
  safe: boolean;
  failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE" | null;
}>;

export type RuntimePrivilegeDiagnosticReason =
  | "INPUT_INVALID"
  | "ROW_SHAPE_INVALID"
  | "GRANT_OPTION_PRESENT"
  | "STATEMENT_FORMAT_UNSUPPORTED"
  | "PRIVILEGE_LIST_INVALID"
  | "GLOBAL_SCOPE_NOT_USAGE"
  | "SCOPE_FORMAT_UNSUPPORTED"
  | "SCOPE_NOT_EXPECTED_DATABASE"
  | "PRIVILEGE_NOT_ALLOWED"
  | "REQUIRED_PRIVILEGES_MISSING";

export type RuntimePrivilegeDiagnostic = Readonly<{
  reason: RuntimePrivilegeDiagnosticReason;
  unexpectedPrivilege?: string;
}>;

function unsafe(): RuntimePrivilegeVerification {
  return Object.freeze({
    safe: false,
    failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
  });
}

function grantStatement(row: Readonly<Record<string, unknown>>): string | null {
  const values = Object.values(row).filter((value): value is string => typeof value === "string");
  return values.length === 1 ? (values[0] ?? null) : null;
}

function normalizeScope(scope: string): string | null {
  const trimmed = scope.trim();

  if (trimmed === "*.*") return trimmed;

  const unquoted = trimmed.match(/^([A-Za-z0-9_-]+)\.\*$/u);
  if (unquoted) return `${unquoted[1]}.*`;

  const quoted = trimmed.match(/^`((?:[A-Za-z0-9_-]|\\_)+)`\.\*$/u);
  if (!quoted) return null;

  const database = (quoted[1] ?? "").replaceAll("\\_", "_");
  return `${database}.*`;
}

/**
 * Conservatively validates SHOW GRANTS FOR CURRENT_USER() output.
 * Grant text is never returned or included in failure codes.
 */
export function verifyRuntimeDatabasePrivileges(
  rows: readonly Readonly<Record<string, unknown>>[],
  expectedDatabase: string,
  accessModel: RuntimeDatabaseAccessModel,
  diagnosticSink?: (diagnostic: RuntimePrivilegeDiagnostic) => void,
): RuntimePrivilegeVerification {
  const fail = (
    reason: RuntimePrivilegeDiagnosticReason,
    unexpectedPrivilege?: string,
  ): RuntimePrivilegeVerification => {
    diagnosticSink?.(
      Object.freeze({
        reason,
        ...(unexpectedPrivilege ? { unexpectedPrivilege } : {}),
      }),
    );
    return unsafe();
  };

  if (
    rows.length === 0 ||
    !/^[A-Za-z0-9_-]+$/u.test(expectedDatabase) ||
    (accessModel !== "distinct-users" && accessModel !== "hostinger-managed-single-user")
  ) {
    return fail("INPUT_INVALID");
  }

  const allowedRuntimePrivileges = new Set(REQUIRED_RUNTIME_PRIVILEGES);

  if (accessModel === "hostinger-managed-single-user") {
    for (const privilege of HOSTINGER_MANAGED_RUNTIME_PRIVILEGE_EXTRAS) {
      allowedRuntimePrivileges.add(privilege);
    }
  }

  const observedRuntimePrivileges = new Set<string>();

  for (const row of rows) {
    const statement = grantStatement(row);

    if (statement === null) {
      return fail("ROW_SHAPE_INVALID");
    }

    if (/\bWITH\s+GRANT\s+OPTION\b/iu.test(statement)) {
      return fail("GRANT_OPTION_PRESENT");
    }

    const match = statement.match(/^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+/iu);

    if (!match) {
      return fail("STATEMENT_FORMAT_UNSUPPORTED");
    }

    const privileges = (match[1] ?? "")
      .split(",")
      .map((privilege) => privilege.trim().replace(/\s+/gu, " ").toUpperCase());

    const scope = normalizeScope(match[2] ?? "");

    if (privileges.length === 0 || privileges.some((privilege) => privilege.length === 0)) {
      return fail("PRIVILEGE_LIST_INVALID");
    }

    if (scope === "*.*") {
      if (privileges.length !== 1 || privileges[0] !== "USAGE") {
        return fail("GLOBAL_SCOPE_NOT_USAGE");
      }

      continue;
    }

    if (scope === null) {
      return fail("SCOPE_FORMAT_UNSUPPORTED");
    }

    if (scope !== `${expectedDatabase}.*`) {
      return fail("SCOPE_NOT_EXPECTED_DATABASE");
    }

    for (const privilege of privileges) {
      if (!allowedRuntimePrivileges.has(privilege)) {
        const sanitizedUnexpectedPrivilege = /^[A-Z][A-Z ]{0,63}$/u.test(privilege)
          ? privilege
          : undefined;

        return fail("PRIVILEGE_NOT_ALLOWED", sanitizedUnexpectedPrivilege);
      }

      if (REQUIRED_RUNTIME_PRIVILEGES.has(privilege)) {
        observedRuntimePrivileges.add(privilege);
      }
    }
  }

  if (
    observedRuntimePrivileges.size !== REQUIRED_RUNTIME_PRIVILEGES.size ||
    [...REQUIRED_RUNTIME_PRIVILEGES].some((privilege) => !observedRuntimePrivileges.has(privilege))
  ) {
    return fail("REQUIRED_PRIVILEGES_MISSING");
  }

  return Object.freeze({ safe: true, failureCode: null });
}

export function databaseNameFromRuntimeUrl(rawUrl: string | undefined): string | null {
  try {
    if (!rawUrl) return null;
    const url = new URL(rawUrl);
    const database = decodeURIComponent(url.pathname.slice(1));
    return url.protocol === "mysql:" && database ? database : null;
  } catch {
    return null;
  }
}
