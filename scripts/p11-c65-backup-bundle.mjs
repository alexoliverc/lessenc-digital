#!/usr/bin/env node
/* global console */
import process from "node:process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { constants, createReadStream, createWriteStream } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { URL, pathToFileURL } from "node:url";

const FORMAT_VERSION = 1;

const BACKUP_RESTORE_FAILURE_EVENTS =
  new Set([
    "backup_verification_failed",
    "restore_validation_failed",
  ]);

const BACKUP_RESTORE_FAILURE_CODES =
  new Set([
    "BACKUP_VERIFICATION_FAILED",
    "RESTORE_VALIDATION_FAILED",
  ]);

function emitBackupRestoreFailure(
  event,
  failureCode,
) {
  if (
    !BACKUP_RESTORE_FAILURE_EVENTS.has(
      event,
    ) ||
    !BACKUP_RESTORE_FAILURE_CODES.has(
      failureCode,
    )
  ) {
    throw new Error(
      "INVALID_BACKUP_RESTORE_FAILURE_SIGNAL",
    );
  }

  console.error(
    JSON.stringify({
      timestamp:
        new Date().toISOString(),
      level:
        "error",
      event,
      correlationId:
        randomUUID(),
      surface:
        "BACKUP_RESTORE",
      outcome:
        "FAILED",
      failureCode,
    }),
  );
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

const BACKUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;

const FORBIDDEN_STORAGE_BASENAMES = new Set([".env", "session.ps1"]);

const FORBIDDEN_STORAGE_EXTENSIONS = new Set([".pem", ".key", ".crt"]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function normalizeRelativeBackupPath(input) {
  invariant(typeof input === "string" && input.length > 0, "BACKUP_RELATIVE_PATH_INVALID");

  const normalized = input.replaceAll("\\", "/");

  invariant(
    !normalized.startsWith("/") && !/^[A-Za-z]:\//u.test(normalized),
    "BACKUP_RELATIVE_PATH_ABSOLUTE",
  );

  const segments = normalized.split("/");

  invariant(
    segments.every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    "BACKUP_RELATIVE_PATH_TRAVERSAL",
  );

  return normalized;
}

export function assertAllowedStoragePath(input) {
  const normalized = normalizeRelativeBackupPath(input);

  const basename = normalized.split("/").at(-1).toLowerCase();

  invariant(
    !FORBIDDEN_STORAGE_BASENAMES.has(basename) && !basename.startsWith(".env."),
    "BACKUP_STORAGE_SECRET_FILE_FORBIDDEN",
  );

  const dot = basename.lastIndexOf(".");

  const extension = dot >= 0 ? basename.slice(dot) : "";

  invariant(!FORBIDDEN_STORAGE_EXTENSIONS.has(extension), "BACKUP_STORAGE_SECRET_FILE_FORBIDDEN");

  return normalized;
}

export async function sha256File(path) {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

function isContainedPath(parent, child) {
  const candidate = relative(parent, child);

  return candidate === "" || (!candidate.startsWith("..") && !isAbsolute(candidate));
}

async function enumerateStorage(storageRoot) {
  invariant(isAbsolute(storageRoot), "BACKUP_STORAGE_ROOT_MUST_BE_ABSOLUTE");

  const rootLstat = await lstat(storageRoot);

  invariant(!rootLstat.isSymbolicLink(), "BACKUP_STORAGE_ROOT_SYMLINK_FORBIDDEN");

  invariant(rootLstat.isDirectory(), "BACKUP_STORAGE_ROOT_NOT_DIRECTORY");

  const canonicalRoot = await realpath(storageRoot);

  const files = [];

  async function walk(directory) {
    const entries = await readdir(directory, {
      withFileTypes: true,
    });

    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));

    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);

      const entryLstat = await lstat(absolutePath);

      invariant(
        !entry.isSymbolicLink() && !entryLstat.isSymbolicLink(),
        "BACKUP_STORAGE_SYMLINK_FORBIDDEN",
      );

      if (entry.isDirectory() && entryLstat.isDirectory()) {
        await walk(absolutePath);

        continue;
      }

      invariant(entry.isFile() && entryLstat.isFile(), "BACKUP_STORAGE_UNSUPPORTED_ENTRY");

      const canonicalPath = await realpath(absolutePath);

      invariant(isContainedPath(canonicalRoot, canonicalPath), "BACKUP_STORAGE_PATH_ESCAPE");

      const relativePath = assertAllowedStoragePath(relative(canonicalRoot, canonicalPath));

      const metadata = await stat(canonicalPath);

      files.push({
        sourcePath: canonicalPath,
        relativePath,
        bytes: metadata.size,
        mtimeMs: metadata.mtimeMs,
      });
    }
  }

  await walk(canonicalRoot);

  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));

  return {
    canonicalRoot,
    files,
  };
}

async function copyStorageTree(storageRoot, destinationRoot) {
  const inventory = await enumerateStorage(storageRoot);

  await mkdir(destinationRoot, {
    recursive: true,
  });

  const copied = [];

  for (const source of inventory.files) {
    const segments = source.relativePath.split("/");

    const destination = join(destinationRoot, ...segments);

    await mkdir(dirname(destination), {
      recursive: true,
    });

    const sourceHashBefore = await sha256File(source.sourcePath);

    await copyFile(source.sourcePath, destination, constants.COPYFILE_EXCL);

    const sourceAfter = await stat(source.sourcePath);

    invariant(
      sourceAfter.size === source.bytes && sourceAfter.mtimeMs === source.mtimeMs,
      "BACKUP_STORAGE_SOURCE_CHANGED_DURING_COPY",
    );

    const destinationHash = await sha256File(destination);

    invariant(destinationHash === sourceHashBefore, "BACKUP_STORAGE_COPY_HASH_MISMATCH");

    copied.push({
      relativePath: source.relativePath,
      bytes: source.bytes,
      sha256: destinationHash,
    });
  }

  return copied;
}

async function collectMigrationMetadata(repositoryRoot) {
  const migrationsRoot = join(repositoryRoot, "prisma", "migrations");

  const entries = await readdir(migrationsRoot, {
    withFileTypes: true,
  });

  const migrations = [];

  for (const entry of entries
    .filter((candidate) => candidate.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const migrationPath = join(migrationsRoot, entry.name, "migration.sql");

    const migrationStat = await stat(migrationPath);

    invariant(migrationStat.isFile(), "BACKUP_MIGRATION_SQL_MISSING");

    migrations.push({
      name: entry.name,
      sha256: await sha256File(migrationPath),
    });
  }

  invariant(migrations.length > 0, "BACKUP_MIGRATIONS_EMPTY");

  return migrations;
}

export function parseDatabaseUrl(rawUrl) {
  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("BACKUP_DATABASE_URL_INVALID");
  }

  invariant(url.protocol === "mysql:", "BACKUP_DATABASE_PROTOCOL_INVALID");

  invariant(Boolean(url.username) && Boolean(url.password), "BACKUP_DATABASE_CREDENTIALS_MISSING");

  const databaseName = decodeURIComponent(url.pathname.slice(1));

  invariant(databaseName.length > 0, "BACKUP_DATABASE_NAME_MISSING");

  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    databaseName,
  };
}

function safeDumpError(stderr, password) {
  const redacted = String(stderr ?? "")
    .replaceAll(password, "[REDACTED]")
    .trim();

  return redacted.slice(0, 2000);
}

async function runDockerMysqlDump({ databaseUrl, container, destination }) {
  const parsed = parseDatabaseUrl(databaseUrl);

  invariant(
    ["127.0.0.1", "localhost"].includes(parsed.hostname) && parsed.port === "3307",
    "BACKUP_DOCKER_LOCAL_DATABASE_TARGET_REFUSED",
  );

  const argumentsList = [
    "exec",
    "-i",
    "-e",
    "MYSQL_PWD",
    container,
    "mysqldump",
    "--protocol=TCP",
    "--host=127.0.0.1",
    "--port=3306",
    `--user=${parsed.username}`,
    "--single-transaction",
    "--quick",
    "--skip-lock-tables",
    "--no-tablespaces",
    "--set-gtid-purged=OFF",
    "--hex-blob",
    "--default-character-set=utf8mb4",
    "--order-by-primary",
    "--skip-comments",
    parsed.databaseName,
  ];

  const child = spawn("docker", argumentsList, {
    env: {
      ...process.env,
      MYSQL_PWD: parsed.password,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let stderr = "";

  child.stderr.setEncoding("utf8");

  child.stderr.on("data", (chunk) => {
    if (stderr.length < 64 * 1024) {
      stderr += chunk;
    }
  });

  const output = createWriteStream(destination, {
    flags: "wx",
  });

  const pipePromise = pipeline(child.stdout, output);

  const exitCode = await new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);

    child.once("close", resolveExit);
  });

  await pipePromise;

  invariant(exitCode === 0, `BACKUP_MYSQLDUMP_FAILED: ${safeDumpError(stderr, parsed.password)}`);

  const dumpMetadata = await stat(destination);

  invariant(dumpMetadata.isFile() && dumpMetadata.size > 0, "BACKUP_DATABASE_DUMP_EMPTY");

  return {
    databaseName: parsed.databaseName,
    bytes: dumpMetadata.size,
    sha256: await sha256File(destination),
  };
}

function validateMigrationMetadata(migrations) {
  invariant(
    Array.isArray(migrations) && migrations.length > 0,
    "BACKUP_MANIFEST_MIGRATIONS_INVALID",
  );

  for (const migration of migrations) {
    invariant(
      typeof migration.name === "string" && migration.name.length > 0,
      "BACKUP_MANIFEST_MIGRATION_NAME_INVALID",
    );

    invariant(SHA256_PATTERN.test(migration.sha256), "BACKUP_MANIFEST_MIGRATION_HASH_INVALID");
  }
}

export function createManifest({
  backupId,
  createdAt,
  databaseName,
  databaseDump,
  migrations,
  storageFiles,
}) {
  invariant(BACKUP_ID_PATTERN.test(backupId), "BACKUP_ID_INVALID");

  invariant(Number.isFinite(Date.parse(createdAt)), "BACKUP_CREATED_AT_INVALID");

  invariant(
    typeof databaseName === "string" && databaseName.length > 0,
    "BACKUP_DATABASE_NAME_INVALID",
  );

  invariant(
    Number.isSafeInteger(databaseDump.bytes) &&
      databaseDump.bytes > 0 &&
      SHA256_PATTERN.test(databaseDump.sha256),
    "BACKUP_DATABASE_METADATA_INVALID",
  );

  validateMigrationMetadata(migrations);

  const files = [...storageFiles]
    .map((file) => ({
      relativePath: assertAllowedStoragePath(file.relativePath),
      bytes: file.bytes,
      sha256: file.sha256,
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));

  for (const file of files) {
    invariant(
      Number.isSafeInteger(file.bytes) && file.bytes >= 0,
      "BACKUP_STORAGE_FILE_BYTES_INVALID",
    );

    invariant(SHA256_PATTERN.test(file.sha256), "BACKUP_STORAGE_FILE_HASH_INVALID");
  }

  return {
    formatVersion: FORMAT_VERSION,
    backupId,
    createdAt,
    databaseName,
    databaseDump: {
      file: "database.sql",
      bytes: databaseDump.bytes,
      sha256: databaseDump.sha256,
    },
    migrations: migrations.map((migration) => ({
      name: migration.name,
      sha256: migration.sha256,
    })),
    storage: {
      fileCount: files.length,
      totalBytes: files.reduce((total, file) => total + file.bytes, 0),
      files,
    },
  };
}

export function assertSafeManifest(manifest) {
  const forbiddenKey =
    /(password|secret|token|cookie|databaseurl|dburl|cafile|private.*storage.*path|credential)/iu;

  const forbiddenValue =
    /(mysql:\/\/|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+|lba_[A-Za-z0-9_-]+)/iu;

  function walk(value, keyPath = "manifest") {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${keyPath}[${index}]`));

      return;
    }

    if (value !== null && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        invariant(!forbiddenKey.test(key), `BACKUP_MANIFEST_FORBIDDEN_KEY:${keyPath}.${key}`);

        walk(child, `${keyPath}.${key}`);
      }

      return;
    }

    if (typeof value === "string") {
      invariant(!forbiddenValue.test(value), `BACKUP_MANIFEST_FORBIDDEN_VALUE:${keyPath}`);
    }
  }

  walk(manifest);
}

async function verifyStorageManifest(bundleDirectory, manifest) {
  const storageRoot = join(bundleDirectory, "storage");

  const inventory = await enumerateStorage(storageRoot);

  const actual = [];

  for (const file of inventory.files) {
    actual.push({
      relativePath: file.relativePath,
      bytes: file.bytes,
      sha256: await sha256File(file.sourcePath),
    });
  }

  const expected = manifest.storage.files;

  invariant(actual.length === expected.length, "BACKUP_VERIFY_STORAGE_FILE_COUNT_MISMATCH");

  for (let index = 0; index < expected.length; index += 1) {
    const expectedFile = expected[index];

    const actualFile = actual[index];

    invariant(
      actualFile.relativePath === expectedFile.relativePath &&
        actualFile.bytes === expectedFile.bytes &&
        actualFile.sha256 === expectedFile.sha256,
      "BACKUP_VERIFY_STORAGE_FILE_MISMATCH",
    );
  }

  const totalBytes = actual.reduce((total, file) => total + file.bytes, 0);

  invariant(
    manifest.storage.fileCount === actual.length && manifest.storage.totalBytes === totalBytes,
    "BACKUP_VERIFY_STORAGE_TOTAL_MISMATCH",
  );
}

export async function verifyBundle(bundleDirectory) {
  const resolvedBundle = resolve(bundleDirectory);

  const manifestPath = join(resolvedBundle, "manifest.json");

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  assertSafeManifest(manifest);

  invariant(manifest.formatVersion === FORMAT_VERSION, "BACKUP_MANIFEST_VERSION_UNSUPPORTED");

  invariant(BACKUP_ID_PATTERN.test(manifest.backupId), "BACKUP_MANIFEST_BACKUP_ID_INVALID");

  invariant(
    manifest.databaseDump?.file === "database.sql" &&
      Number.isSafeInteger(manifest.databaseDump.bytes) &&
      manifest.databaseDump.bytes > 0 &&
      SHA256_PATTERN.test(manifest.databaseDump.sha256),
    "BACKUP_MANIFEST_DATABASE_INVALID",
  );

  validateMigrationMetadata(manifest.migrations);

  invariant(
    manifest.storage && Array.isArray(manifest.storage.files),
    "BACKUP_MANIFEST_STORAGE_INVALID",
  );

  const dumpPath = join(resolvedBundle, "database.sql");

  const dumpMetadata = await stat(dumpPath);

  invariant(
    dumpMetadata.isFile() && dumpMetadata.size === manifest.databaseDump.bytes,
    "BACKUP_VERIFY_DATABASE_SIZE_MISMATCH",
  );

  invariant(
    (await sha256File(dumpPath)) === manifest.databaseDump.sha256,
    "BACKUP_VERIFY_DATABASE_HASH_MISMATCH",
  );

  await verifyStorageManifest(resolvedBundle, manifest);

  return manifest;
}

function generatedBackupId() {
  const timestamp = new Date().toISOString().replace(/[-:.]/gu, "");

  const suffix = randomBytes(4).toString("hex");

  return `p11-c65-${timestamp}-${suffix}`;
}

function parseCliArguments(argv) {
  const [mode, ...rest] = argv;

  const options = new Map();

  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];

    const value = rest[index + 1];

    invariant(key?.startsWith("--") && typeof value === "string", "BACKUP_CLI_ARGUMENT_INVALID");

    options.set(key.slice(2), value);
  }

  return {
    mode,
    options,
  };
}

async function createBundle(options) {
  const databaseEnv = options.get("database-env");

  const storageRoot = options.get("storage-root");

  const outputRoot = resolve(options.get("output-root") ?? "output/p11/c6.5");

  const container = options.get("container") ?? "lessenc-p06-mysql";

  const backupId = options.get("backup-id") ?? generatedBackupId();

  invariant(
    typeof databaseEnv === "string" && databaseEnv.length > 0,
    "BACKUP_DATABASE_ENV_REQUIRED",
  );

  invariant(
    typeof storageRoot === "string" && isAbsolute(storageRoot),
    "BACKUP_STORAGE_ROOT_REQUIRED_ABSOLUTE",
  );

  invariant(BACKUP_ID_PATTERN.test(backupId), "BACKUP_ID_INVALID");

  const databaseUrl = process.env[databaseEnv];

  invariant(
    typeof databaseUrl === "string" && databaseUrl.length > 0,
    "BACKUP_DATABASE_ENV_MISSING",
  );

  const bundleDirectory = join(outputRoot, backupId);

  const resolvedStorageRoot = resolve(storageRoot);

  invariant(
    !isContainedPath(resolvedStorageRoot, bundleDirectory) &&
      !isContainedPath(bundleDirectory, resolvedStorageRoot),
    "BACKUP_STORAGE_OUTPUT_OVERLAP",
  );

  await mkdir(outputRoot, {
    recursive: true,
  });

  await mkdir(bundleDirectory, {
    recursive: false,
  });

  try {
    const dumpPath = join(bundleDirectory, "database.sql");

    const databaseDump = await runDockerMysqlDump({
      databaseUrl,
      container,
      destination: dumpPath,
    });

    const storageFiles = await copyStorageTree(
      resolvedStorageRoot,
      join(bundleDirectory, "storage"),
    );

    const migrations = await collectMigrationMetadata(process.cwd());

    const manifest = createManifest({
      backupId,
      createdAt: new Date().toISOString(),
      databaseName: databaseDump.databaseName,
      databaseDump,
      migrations,
      storageFiles,
    });

    assertSafeManifest(manifest);

    await writeFile(
      join(bundleDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      {
        encoding: "utf8",
        flag: "wx",
      },
    );

    try {
      await verifyBundle(
        bundleDirectory,
      );
    } catch (error) {
      emitBackupRestoreFailure(
        "backup_verification_failed",
        "BACKUP_VERIFICATION_FAILED",
      );

      throw error;
    }

    return {
      bundleDirectory,
      manifest,
    };
  } catch (error) {
    await rm(bundleDirectory, {
      recursive: true,
      force: true,
    });

    throw error;
  }
}

async function main() {
  const { mode, options } = parseCliArguments(process.argv.slice(2));

  if (mode === "create") {
    const result = await createBundle(options);

    console.log(`BACKUP_BUNDLE_CREATED=${result.bundleDirectory}`);

    console.log(`BACKUP_DATABASE_NAME=${result.manifest.databaseName}`);

    console.log(`BACKUP_DATABASE_BYTES=${result.manifest.databaseDump.bytes}`);

    console.log(`BACKUP_STORAGE_FILES=${result.manifest.storage.fileCount}`);

    console.log(`BACKUP_STORAGE_BYTES=${result.manifest.storage.totalBytes}`);

    console.log(`BACKUP_MIGRATIONS=${result.manifest.migrations.length}`);

    return;
  }

  if (mode === "verify") {
    const bundle =
      options.get("bundle");

    invariant(
      typeof bundle === "string" &&
        bundle.length > 0,
      "BACKUP_VERIFY_BUNDLE_REQUIRED",
    );

    try {
      await verifyBundle(
        bundle,
      );
    } catch (error) {
      emitBackupRestoreFailure(
        "backup_verification_failed",
        "BACKUP_VERIFICATION_FAILED",
      );

      throw error;
    }

    console.log(
      `BACKUP_BUNDLE_VERIFIED=${resolve(bundle)}`,
    );

    return;
  }

  if (
    mode === "restore-validate"
  ) {
    const bundle =
      options.get("bundle");

    invariant(
      typeof bundle === "string" &&
        bundle.length > 0,
      "RESTORE_VALIDATE_BUNDLE_REQUIRED",
    );

    try {
      await verifyBundle(
        bundle,
      );
    } catch (error) {
      emitBackupRestoreFailure(
        "restore_validation_failed",
        "RESTORE_VALIDATION_FAILED",
      );

      throw error;
    }

    console.log(
      "RESTORE_BUNDLE_VALIDATED=1",
    );

    return;
  }

  throw new Error(
    "BACKUP_CLI_MODE_INVALID",
  );
}

const invokedAsScript =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsScript) {
  main().catch(() => {
    console.error(
      "P11_BACKUP_ERROR=BACKUP_OPERATION_FAILED",
    );

    process.exitCode = 1;
  });
}
