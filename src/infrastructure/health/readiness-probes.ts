import { realpath, stat } from "node:fs/promises";

import { getDatabaseClient } from "@/infrastructure/database/client";
import {
  databaseNameFromRuntimeUrl,
  verifyRuntimeDatabasePrivileges,
} from "@/infrastructure/database/runtime-database-privileges";
import { createCorrelationId } from "@/lib/observability/correlation";
import { logger } from "@/lib/observability/logger";
import {
  assertPrivateStorageRootIsPrivate,
  PrivateStorageRootPolicyError,
} from "@/infrastructure/storage/private-storage-root-policy";
import type { HostedPrivateStorageReadinessProbe } from "@/infrastructure/storage/hosted-private-storage-readiness";
import { getHealthStatus } from "@/modules/health/health";
import {
  evaluateReadiness,
  type ReadinessCheck,
  type ReadinessReport,
} from "@/modules/health/readiness";

type HostedPrivateStorageResolver = () => Promise<HostedPrivateStorageReadinessProbe>;

function runtimeGrantRowShape(row: Readonly<Record<string, unknown>>) {
  const values = Object.values(row);
  const stringValueCount = values.filter((value) => typeof value === "string").length;
  const binaryValueCount = values.filter((value) => value instanceof Uint8Array).length;

  return Object.freeze({
    fieldCount: values.length,
    stringValueCount,
    binaryValueCount,
    otherValueCount: values.length - stringValueCount - binaryValueCount,
  });
}

export type ReadinessProbeDependencies = Readonly<{
  resolveHostedPrivateStorage?: HostedPrivateStorageResolver;
}>;

async function resolveConfiguredHostedPrivateStorage(): Promise<HostedPrivateStorageReadinessProbe> {
  const { createConfiguredHostedPrivateStorageReadinessProbe } =
    await import("@/infrastructure/storage/hosted-private-storage-readiness");

  return createConfiguredHostedPrivateStorageReadinessProbe();
}

function applicationCheck(): ReadinessCheck {
  try {
    const status = getHealthStatus();
    return status.status === "ok" && Object.keys(status).length === 1
      ? Object.freeze({ name: "APPLICATION_CONTRACT", ready: true })
      : Object.freeze({
          name: "APPLICATION_CONTRACT",
          ready: false,
          failureCode: "APPLICATION_CONTRACT_INVALID",
        });
  } catch {
    return Object.freeze({
      name: "APPLICATION_CONTRACT",
      ready: false,
      failureCode: "APPLICATION_CONTRACT_INVALID",
    });
  }
}

async function databaseCheck(correlationId: string): Promise<ReadinessCheck> {
  try {
    const database = getDatabaseClient();
    const rows = await database.$queryRaw<Array<{ readiness: bigint | number }>>`
      SELECT 1 AS readiness
    `;
    if (Number(rows[0]?.readiness) !== 1) {
      return Object.freeze({
        name: "DATABASE_CONNECTIVITY",
        ready: false,
        failureCode: "DATABASE_UNAVAILABLE",
      });
    }

    if (process.env.APP_ENV === "staging") {
      const accessModel = process.env.P16_DATABASE_ACCESS_MODEL;
      const migrationWindow = process.env.P16_DATABASE_MIGRATION_WINDOW;
      const databaseName = databaseNameFromRuntimeUrl(process.env.DB_RUNTIME_URL);

      if (
        (accessModel !== "distinct-users" && accessModel !== "hostinger-managed-single-user") ||
        migrationWindow !== "disabled" ||
        databaseName === null
      ) {
        return Object.freeze({
          name: "DATABASE_CONNECTIVITY",
          ready: false,
          failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
        });
      }

      const grants = await database.$queryRawUnsafe<Array<Record<string, unknown>>>(
        "SHOW GRANTS FOR CURRENT_USER()",
      );
      const verification = verifyRuntimeDatabasePrivileges(grants, databaseName, accessModel);
      if (!verification.safe) {
        logger.error("readiness_database_privilege_check_failed", {
          correlationId,
          surface: "DATABASE",
          outcome: "FAILED",
          failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
          diagnosticStage: "GRANT_VERIFICATION",
          grantRowCount: grants.length,
          grantRowShape: grants.map(runtimeGrantRowShape),
        });
        return Object.freeze({
          name: "DATABASE_CONNECTIVITY",
          ready: false,
          failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
        });
      }

      if (accessModel === "hostinger-managed-single-user") {
        const [versionedTables, storedRoutines] = await Promise.all([
          database.$queryRaw<Array<{ total: bigint | number }>>`
            SELECT COUNT(*) AS total
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ${databaseName}
              AND TABLE_TYPE = 'SYSTEM VERSIONED'
          `,
          database.$queryRaw<Array<{ total: bigint | number }>>`
            SELECT COUNT(*) AS total
            FROM information_schema.ROUTINES
            WHERE ROUTINE_SCHEMA = ${databaseName}
          `,
        ]);

        const versionedTableCount = Number(versionedTables[0]?.total ?? -1);
        const storedRoutineCount = Number(storedRoutines[0]?.total ?? -1);

        if (versionedTableCount !== 0 || storedRoutineCount !== 0) {
          logger.error("readiness_database_privilege_check_failed", {
            correlationId,
            surface: "DATABASE",
            outcome: "FAILED",
            failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
            diagnosticStage: "PROVIDER_TARGET_SURFACE",
            systemVersionedTableCount: versionedTableCount,
            storedRoutineCount,
          });
          return Object.freeze({
            name: "DATABASE_CONNECTIVITY",
            ready: false,
            failureCode: "DATABASE_RUNTIME_PRIVILEGES_UNSAFE",
          });
        }
      }
    }

    return Object.freeze({ name: "DATABASE_CONNECTIVITY", ready: true });
  } catch (error) {
    const prismaCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      /^P\d{4}$/.test(error.code)
        ? error.code
        : undefined;
    logger.error("readiness_database_probe_failed", {
      correlationId,
      surface: "DATABASE",
      outcome: "FAILED",
      failureCode: "DATABASE_UNAVAILABLE",
      ...(prismaCode ? { prismaCode } : {}),
      error,
    });
    return Object.freeze({
      name: "DATABASE_CONNECTIVITY",
      ready: false,
      failureCode: "DATABASE_UNAVAILABLE",
    });
  }
}

async function privateStorageCheck(
  correlationId: string,
  resolveHostedPrivateStorage: HostedPrivateStorageResolver,
): Promise<ReadinessCheck> {
  const applicationEnvironment = process.env.APP_ENV;
  const driver = process.env.PRIVATE_STORAGE_DRIVER ?? "local-filesystem";
  if (
    (applicationEnvironment === "staging" || applicationEnvironment === "production") &&
    driver !== "hosted"
  ) {
    return Object.freeze({
      name: "PRIVATE_STORAGE",
      ready: false,
      failureCode: "STORAGE_ROOT_INVALID",
    });
  }
  if (driver === "hosted") {
    try {
      const readinessProbe = await resolveHostedPrivateStorage();

      await readinessProbe.check();

      return Object.freeze({ name: "PRIVATE_STORAGE", ready: true });
    } catch {
      logger.error("readiness_private_storage_probe_failed", {
        correlationId,
        surface: "STORAGE",
        outcome: "FAILED",
        failureCode: "STORAGE_ROOT_UNAVAILABLE",
      });

      return Object.freeze({
        name: "PRIVATE_STORAGE",
        ready: false,
        failureCode: "STORAGE_ROOT_UNAVAILABLE",
      });
    }
  }

  const root = process.env.PRIVATE_FILE_STORAGE_PATH;

  if (typeof root !== "string" || root.trim().length === 0) {
    return Object.freeze({
      name: "PRIVATE_STORAGE",
      ready: false,
      failureCode: "STORAGE_ROOT_INVALID",
    });
  }

  try {
    assertPrivateStorageRootIsPrivate(root);
    const canonicalRoot = await realpath(root);
    const metadata = await stat(canonicalRoot);

    return metadata.isDirectory()
      ? Object.freeze({ name: "PRIVATE_STORAGE", ready: true })
      : Object.freeze({
          name: "PRIVATE_STORAGE",
          ready: false,
          failureCode: "STORAGE_ROOT_INVALID",
        });
  } catch (error) {
    return Object.freeze({
      name: "PRIVATE_STORAGE",
      ready: false,
      failureCode:
        error instanceof PrivateStorageRootPolicyError
          ? "STORAGE_ROOT_INVALID"
          : "STORAGE_ROOT_UNAVAILABLE",
    });
  }
}

export async function runReadinessProbe(
  correlationId: string = createCorrelationId(),
  dependencies: ReadinessProbeDependencies = {},
): Promise<ReadinessReport> {
  const resolveHostedPrivateStorage =
    dependencies.resolveHostedPrivateStorage ?? resolveConfiguredHostedPrivateStorage;
  const [database, privateStorage] = await Promise.all([
    databaseCheck(correlationId),
    privateStorageCheck(correlationId, resolveHostedPrivateStorage),
  ]);

  return evaluateReadiness([applicationCheck(), database, privateStorage]);
}
