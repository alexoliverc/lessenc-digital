import console from "node:console";
import {
  readFileSync,
} from "node:fs";
import process from "node:process";
import {
  URL,
} from "node:url";
import {
  randomUUID,
} from "node:crypto";
import {
  checkServerIdentity,
} from "node:tls";

import mariadb from "mariadb";

import {
  logger,
} from "../src/lib/observability/logger.ts";

const RETENTION_SECONDS =
  24 * 60 * 60;

const DEFAULT_BATCH_SIZE =
  500;

const MAX_BATCH_SIZE =
  5_000;

function argumentValue(name) {
  const prefix =
    `--${name}=`;

  const argument =
    process.argv
      .slice(2)
      .find((value) =>
        value.startsWith(prefix),
      );

  return argument
    ? argument.slice(prefix.length)
    : undefined;
}

function hasFlag(name) {
  return process.argv
    .slice(2)
    .includes(`--${name}`);
}

function requireBatchSize() {
  const raw =
    argumentValue("batch-size");

  if (typeof raw === "undefined") {
    return DEFAULT_BATCH_SIZE;
  }

  const value =
    Number(raw);

  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_BATCH_SIZE
  ) {
    throw new Error(
      "INVALID_RATE_LIMIT_CLEANUP_BATCH_SIZE",
    );
  }

  return value;
}

function requireDatabaseConfiguration() {
  const rawUrl =
    process.env.DB_RUNTIME_URL;

  const caFile =
    process.env.DB_TLS_CA_FILE;

  const appEnv =
    process.env.APP_ENV;

  if (!rawUrl) {
    throw new Error(
      "DB_RUNTIME_URL_REQUIRED",
    );
  }

  if (!caFile) {
    throw new Error(
      "DB_TLS_CA_FILE_REQUIRED",
    );
  }

  if (
    ![
      "local",
      "test",
      "production",
    ].includes(appEnv ?? "")
  ) {
    throw new Error(
      "INVALID_APP_ENV",
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
    !expectedDatabase ||
    expectedDatabase !== database
  ) {
    throw new Error(
      "RATE_LIMIT_CLEANUP_TARGET_MISMATCH",
    );
  }

  if (
    appEnv === "production" &&
    !hasFlag("allow-production")
  ) {
    throw new Error(
      "PRODUCTION_CLEANUP_REQUIRES_EXPLICIT_AUTHORIZATION",
    );
  }

  const localCertificate =
    ["local", "test"].includes(
      appEnv,
    ) &&
    [
      "127.0.0.1",
      "localhost",
    ].includes(url.hostname) &&
    url.port === "3307";

  return Object.freeze({
    appEnv,
    database,
    connection: {
      host: url.hostname,
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
      timezone: "Z",
      connectionLimit: 2,
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
    },
  });
}

function safeCount(
  value,
  code,
) {
  const normalized =
    Number(value);

  if (
    !Number.isSafeInteger(
      normalized,
    ) ||
    normalized < 0
  ) {
    throw new Error(code);
  }

  return normalized;
}

function mysqlUtcDateTime(
  value,
) {
  if (
    !(value instanceof Date) ||
    !Number.isFinite(
      value.getTime(),
    )
  ) {
    throw new Error(
      "INVALID_RATE_LIMIT_CLEANUP_CUTOFF",
    );
  }

  return value
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");
}

async function countStale(
  pool,
  cutoff,
) {
  const rows =
    await pool.query(
      `
        SELECT COUNT(*) AS count
        FROM buyer_access_rate_limit_buckets
        WHERE window_start < ?
      `,
      [cutoff],
    );

  return safeCount(
    rows[0]?.count,
    "INVALID_RATE_LIMIT_STALE_COUNT",
  );
}

async function deleteBatch(
  pool,
  cutoff,
  limit,
) {
  const result =
    await pool.query(
      `
        DELETE FROM buyer_access_rate_limit_buckets
        WHERE window_start < ?
        ORDER BY window_start ASC
        LIMIT ${limit}
      `,
      [cutoff],
    );

  return safeCount(
    result.affectedRows,
    "INVALID_RATE_LIMIT_CLEANUP_COUNT",
  );
}

const correlationId =
  randomUUID();

let pool;

try {
  const configuration =
    requireDatabaseConfiguration();

  const batchSize =
    requireBatchSize();

  const execute =
    hasFlag("execute");

  const observedAt =
    new Date();

  const cutoff =
    new Date(
      observedAt.getTime() -
        RETENTION_SECONDS * 1000,
    );

  /*
   * Do not bind JavaScript Date objects directly through
   * mariadb for this operational comparison.
   *
   * C6.6-C3C diagnostics proved that Date binding shifts the
   * effective comparison in the local Windows/MariaDB setup,
   * while an explicit UTC DATETIME string matches MySQL
   * UTC_TIMESTAMP semantics.
   */
  const cutoffSql =
    mysqlUtcDateTime(
      cutoff,
    );

  pool =
    mariadb.createPool(
      configuration.connection,
    );

  const staleBefore =
    await countStale(
      pool,
      cutoffSql,
    );

  if (!execute) {
    console.log(
      JSON.stringify({
        status: "ok",
        mode: "dry-run",
        database:
          configuration.database,
        retentionSeconds:
          RETENTION_SECONDS,
        batchSize,
        staleBefore,
      }),
    );

    process.exitCode = 0;
  } else {
    let deletedCount = 0;
    let batches = 0;
    let remaining =
      staleBefore;

    while (remaining > 0) {
      const limit =
        Math.min(
          batchSize,
          remaining,
        );

      const deleted =
        await deleteBatch(
          pool,
          cutoffSql,
          limit,
        );

      if (deleted > limit) {
        throw new Error(
          "INVALID_RATE_LIMIT_CLEANUP_COUNT",
        );
      }

      batches += 1;
      deletedCount += deleted;

      if (deleted === 0) {
        break;
      }

      remaining -= deleted;
    }

    const staleAfter =
      await countStale(
        pool,
        cutoffSql,
      );

    if (staleAfter > 0) {
      logger.warn(
        "rate_limit_stale_buckets_detected",
        {
          correlationId,
          surface: "RATE_LIMIT",
          outcome: "DEGRADED",
          failureCode:
            "RATE_LIMIT_STALE_BUCKETS_DETECTED",
          windowSeconds:
            RETENTION_SECONDS,
          limit:
            batchSize,
        },
      );
    }

    logger.info(
      "rate_limit_cleanup_completed",
      {
        correlationId,
        surface: "RATE_LIMIT",
        outcome: "SUCCEEDED",
        windowSeconds:
          RETENTION_SECONDS,
        limit:
          batchSize,
      },
    );

    console.log(
      JSON.stringify({
        status: "ok",
        mode: "execute",
        database:
          configuration.database,
        retentionSeconds:
          RETENTION_SECONDS,
        batchSize,
        staleBefore,
        deletedCount,
        staleAfter,
        batches,
      }),
    );
  }
} catch {
  logger.error(
    "rate_limit_cleanup_failed",
    {
      correlationId,
      surface: "RATE_LIMIT",
      outcome: "FAILED",
      failureCode:
        "RATE_LIMIT_CLEANUP_FAILED",
      windowSeconds:
        RETENTION_SECONDS,
    },
  );

  process.exitCode = 1;
} finally {
  if (pool) {
    await pool.end();
  }
}
