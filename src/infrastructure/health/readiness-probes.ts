import { realpath, stat } from "node:fs/promises";

import { getDatabaseClient } from "@/infrastructure/database/client";
import { createCorrelationId } from "@/lib/observability/correlation";
import { logger } from "@/lib/observability/logger";
import {
  assertPrivateStorageRootIsPrivate,
  PrivateStorageRootPolicyError,
} from "@/infrastructure/storage/private-storage-root-policy";
import { getHealthStatus } from "@/modules/health/health";
import {
  evaluateReadiness,
  type ReadinessCheck,
  type ReadinessReport,
} from "@/modules/health/readiness";

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
    return Number(rows[0]?.readiness) === 1
      ? Object.freeze({ name: "DATABASE_CONNECTIVITY", ready: true })
      : Object.freeze({
          name: "DATABASE_CONNECTIVITY",
          ready: false,
          failureCode: "DATABASE_UNAVAILABLE",
        });
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

async function privateStorageCheck(): Promise<ReadinessCheck> {
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
): Promise<ReadinessReport> {
  const [database, privateStorage] = await Promise.all([
    databaseCheck(correlationId),
    privateStorageCheck(),
  ]);

  return evaluateReadiness([applicationCheck(), database, privateStorage]);
}
