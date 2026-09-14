import console from "node:console";
import {
  readFileSync,
} from "node:fs";
import {
  realpath,
  stat,
} from "node:fs/promises";
import process from "node:process";
import {
  checkServerIdentity,
} from "node:tls";
import {
  URL,
} from "node:url";

import mariadb from "mariadb";

import {
  getHealthStatus,
} from "../src/modules/health/health.ts";
import {
  evaluateOperationalHealth,
} from "../src/modules/health/operational-health.ts";
import {
  assertPrivateStorageRootIsPrivate,
  PrivateStorageRootPolicyError,
} from "../src/infrastructure/storage/private-storage-root-policy.ts";

const REQUIRED_OBSERVABILITY_EVENTS = [
  "buyer_access_rate_limited",
  "buyer_access_limiter_unavailable",
  "private_storage_failure",
  "delivery_audit_unavailable",
  "delivery_stream_failed",
  "credential_recovery_failed",
  "entitlement_revocation_failed",
  "backup_verification_failed",
  "restore_validation_failed",
  "rate_limit_cleanup_completed",
  "rate_limit_cleanup_failed",
  "rate_limit_stale_buckets_detected",
];

function argumentValue(name) {
  const prefix =
    `--${name}=`;

  const entry =
    process.argv
      .slice(2)
      .find(
        (argument) =>
          argument.startsWith(
            prefix,
          ),
      );

  return entry
    ? entry.slice(
        prefix.length,
      )
    : undefined;
}

function failed(
  name,
  failureCode,
) {
  return Object.freeze({
    name,
    status: "FAILED",
    failureCode,
  });
}

function degraded(
  name,
  failureCode,
) {
  return Object.freeze({
    name,
    status: "DEGRADED",
    failureCode,
  });
}

function healthy(name) {
  return Object.freeze({
    name,
    status: "OK",
  });
}

function applicationCheck() {
  try {
    const status =
      getHealthStatus();

    if (
      !status ||
      status.status !== "ok" ||
      Object.keys(status).length !== 1
    ) {
      return failed(
        "APPLICATION_CONTRACT",
        "APPLICATION_CONTRACT_INVALID",
      );
    }

    return healthy(
      "APPLICATION_CONTRACT",
    );
  } catch {
    return failed(
      "APPLICATION_CONTRACT",
      "APPLICATION_CONTRACT_INVALID",
    );
  }
}

function observabilityCheck() {
  try {
    const source =
      readFileSync(
        new URL(
          "../src/lib/observability/p11-observability.ts",
          import.meta.url,
        ),
        "utf8",
      );

    if (
      !source.includes(
        '"BACKUP_RESTORE"',
      )
    ) {
      return failed(
        "OBSERVABILITY_CONTRACT",
        "OBSERVABILITY_CONTRACT_INVALID",
      );
    }

    for (
      const event
      of REQUIRED_OBSERVABILITY_EVENTS
    ) {
      if (
        !source.includes(
          `"${event}"`,
        )
      ) {
        return failed(
          "OBSERVABILITY_CONTRACT",
          "OBSERVABILITY_CONTRACT_INVALID",
        );
      }
    }

    return healthy(
      "OBSERVABILITY_CONTRACT",
    );
  } catch {
    return failed(
      "OBSERVABILITY_CONTRACT",
      "OBSERVABILITY_CONTRACT_INVALID",
    );
  }
}

async function storageCheck() {
  const root =
    process.env
      .PRIVATE_FILE_STORAGE_PATH;

  if (
    typeof root !== "string" ||
    root.trim().length === 0
  ) {
    return failed(
      "PRIVATE_STORAGE",
      "STORAGE_ROOT_INVALID",
    );
  }

  try {
    assertPrivateStorageRootIsPrivate(
      root,
      process.cwd(),
    );
  } catch (error) {
    if (
      error instanceof
      PrivateStorageRootPolicyError
    ) {
      return failed(
        "PRIVATE_STORAGE",
        "STORAGE_ROOT_INVALID",
      );
    }

    return failed(
      "PRIVATE_STORAGE",
      "STORAGE_ROOT_INVALID",
    );
  }

  try {
    const canonicalRoot =
      await realpath(root);

    const metadata =
      await stat(
        canonicalRoot,
      );

    if (!metadata.isDirectory()) {
      return failed(
        "PRIVATE_STORAGE",
        "STORAGE_ROOT_INVALID",
      );
    }

    return healthy(
      "PRIVATE_STORAGE",
    );
  } catch {
    return degraded(
      "PRIVATE_STORAGE",
      "STORAGE_ROOT_UNAVAILABLE",
    );
  }
}

function databaseConfiguration() {
  const rawUrl =
    process.env.DB_RUNTIME_URL;

  const caFile =
    process.env.DB_TLS_CA_FILE;

  const appEnv =
    process.env.APP_ENV;

  if (
    typeof rawUrl !== "string" ||
    rawUrl.length === 0 ||
    typeof caFile !== "string" ||
    caFile.length === 0 ||
    ![
      "local",
      "test",
      "staging",
      "production",
    ].includes(appEnv ?? "")
  ) {
    throw new Error(
      "INVALID_DATABASE_CONFIGURATION",
    );
  }

  let url;

  try {
    url =
      new URL(rawUrl);
  } catch {
    throw new Error(
      "INVALID_DATABASE_CONFIGURATION",
    );
  }

  const database =
    decodeURIComponent(
      url.pathname.slice(1),
    );

  if (
    url.protocol !== "mysql:" ||
    !url.hostname ||
    !url.username ||
    !url.password ||
    !database
  ) {
    throw new Error(
      "INVALID_DATABASE_CONFIGURATION",
    );
  }

  const expectedDatabase =
    argumentValue(
      "target-database",
    );

  if (
    typeof expectedDatabase !==
      "string" ||
    expectedDatabase.length === 0 ||
    expectedDatabase !== database
  ) {
    throw new Error(
      "OPERATIONAL_HEALTH_TARGET_MISMATCH",
    );
  }

  const localCertificate =
    ["local", "test"].includes(
      appEnv,
    ) &&
    [
      "127.0.0.1",
      "localhost",
    ].includes(
      url.hostname,
    ) &&
    url.port === "3307";

  return Object.freeze({
    host:
      url.hostname,
    port:
      Number(
        url.port || 3306,
      ),
    user:
      decodeURIComponent(
        url.username,
      ),
    password:
      decodeURIComponent(
        url.password,
      ),
    database,
    ssl: {
      ca:
        readFileSync(
          caFile,
        ),
      rejectUnauthorized: true,
      checkServerIdentity:
        localCertificate
          ? () => undefined
          : checkServerIdentity,
    },
  });
}

async function databaseChecks() {
  let pool;

  try {
    const configuration =
      databaseConfiguration();

    pool =
      mariadb.createPool({
        ...configuration,
        timezone: "Z",
        connectionLimit: 1,
      });

    const connectivityRows =
      await pool.query(
        "SELECT 1 AS operational_health",
      );

    if (
      Number(
        connectivityRows[0]
          ?.operational_health,
      ) !== 1
    ) {
      return Object.freeze({
        database:
          failed(
            "DATABASE_CONNECTIVITY",
            "DATABASE_UNAVAILABLE",
          ),
        rateLimit:
          failed(
            "RATE_LIMIT_RETENTION",
            "DATABASE_UNAVAILABLE",
          ),
      });
    }

    let staleRows;

    try {
      staleRows =
        await pool.query(`
          SELECT COUNT(*) AS stale_count
          FROM buyer_access_rate_limit_buckets
          WHERE window_start <
            UTC_TIMESTAMP(3) - INTERVAL 24 HOUR
        `);
    } catch {
      return Object.freeze({
        database:
          healthy(
            "DATABASE_CONNECTIVITY",
          ),
        rateLimit:
          failed(
            "RATE_LIMIT_RETENTION",
            "RATE_LIMIT_RETENTION_UNAVAILABLE",
          ),
      });
    }

    const staleCount =
      Number(
        staleRows[0]
          ?.stale_count,
      );

    if (
      !Number.isSafeInteger(
        staleCount,
      ) ||
      staleCount < 0
    ) {
      return Object.freeze({
        database:
          healthy(
            "DATABASE_CONNECTIVITY",
          ),
        rateLimit:
          failed(
            "RATE_LIMIT_RETENTION",
            "RATE_LIMIT_RETENTION_UNAVAILABLE",
          ),
      });
    }

    return Object.freeze({
      database:
        healthy(
          "DATABASE_CONNECTIVITY",
        ),
      rateLimit:
        staleCount > 0
          ? degraded(
              "RATE_LIMIT_RETENTION",
              "RATE_LIMIT_STALE_BUCKETS_DETECTED",
            )
          : healthy(
              "RATE_LIMIT_RETENTION",
            ),
    });
  } catch {
    return Object.freeze({
      database:
        failed(
          "DATABASE_CONNECTIVITY",
          "DATABASE_UNAVAILABLE",
        ),
      rateLimit:
        failed(
          "RATE_LIMIT_RETENTION",
          "DATABASE_UNAVAILABLE",
        ),
    });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

export async function runOperationalHealthProbe() {
  const [
    database,
    storage,
  ] =
    await Promise.all([
      databaseChecks(),
      storageCheck(),
    ]);

  return evaluateOperationalHealth([
    applicationCheck(),
    database.database,
    database.rateLimit,
    storage,
    observabilityCheck(),
  ]);
}

const report =
  await runOperationalHealthProbe();

console.log(
  JSON.stringify(report),
);

process.exitCode =
  report.status === "FAILED"
    ? 1
    : 0;
