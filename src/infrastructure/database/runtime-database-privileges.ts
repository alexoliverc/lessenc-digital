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

function normalizeScope(scope: string): string {
  return scope.replaceAll("`", "").trim();
}

/**
 * Conservatively validates SHOW GRANTS FOR CURRENT_USER() output.
 * Grant text is never returned or included in failure codes.
 */
export function verifyRuntimeDatabasePrivileges(
  rows: readonly Readonly<Record<string, unknown>>[],
  expectedDatabase: string,
  accessModel: RuntimeDatabaseAccessModel,
): RuntimePrivilegeVerification {
  if (
    rows.length === 0 ||
    !/^[A-Za-z0-9_-]+$/u.test(expectedDatabase) ||
    (accessModel !== "distinct-users" && accessModel !== "hostinger-managed-single-user")
  ) {
    return unsafe();
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
    if (statement === null || /\bWITH\s+GRANT\s+OPTION\b/iu.test(statement)) return unsafe();

    const match = statement.match(/^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+/iu);
    if (!match) return unsafe();

    const privileges = (match[1] ?? "")
      .split(",")
      .map((privilege) => privilege.trim().replace(/\s+/gu, " ").toUpperCase());
    const scope = normalizeScope(match[2] ?? "");

    if (privileges.length === 0 || privileges.some((privilege) => privilege.length === 0)) {
      return unsafe();
    }

    if (scope === "*.*") {
      if (privileges.length !== 1 || privileges[0] !== "USAGE") return unsafe();
      continue;
    }

    if (scope !== `${expectedDatabase}.*`) return unsafe();

    for (const privilege of privileges) {
      if (!allowedRuntimePrivileges.has(privilege)) return unsafe();

      if (REQUIRED_RUNTIME_PRIVILEGES.has(privilege)) {
        observedRuntimePrivileges.add(privilege);
      }
    }
  }

  if (
    observedRuntimePrivileges.size !== REQUIRED_RUNTIME_PRIVILEGES.size ||
    [...REQUIRED_RUNTIME_PRIVILEGES].some((privilege) => !observedRuntimePrivileges.has(privilege))
  ) {
    return unsafe();
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
