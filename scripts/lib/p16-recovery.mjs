import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { URL } from "node:url";

export const P16_RECOVERY_MANIFEST_VERSION = 2;
export const P16_STAGING_ENVIRONMENT_ID = "lessenc-staging";
export const P16_ISOLATED_RECOVERY_ENVIRONMENT_ID = "lessenc-recovery-test";
export const P16_RPO_TARGET_SECONDS = 24 * 60 * 60;
export const P16_RTO_TARGET_SECONDS = 8 * 60 * 60;

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const BACKUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const SAFE_DATABASE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const MIGRATION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const RECOVERY_DATABASE_PATTERN = /^lessenc_(?:test_)?recovery(?:_[a-z0-9]+)?$/u;
const MAX_STORAGE_INDEX_BYTES = 16 * 1024 * 1024;
const ALGORITHM = "aes-256-gcm";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, expected, failureCode) {
  invariant(value && typeof value === "object" && !Array.isArray(value), failureCode);
  invariant(Object.keys(value).sort().join(",") === [...expected].sort().join(","), failureCode);
}

function normalizeTimestamp(value, failureCode) {
  const serialized = value instanceof Date ? value.toISOString() : value;
  invariant(typeof serialized === "string" && UTC_TIMESTAMP_PATTERN.test(serialized), failureCode);
  const date = new Date(serialized);
  invariant(!Number.isNaN(date.getTime()) && date.toISOString() === serialized, failureCode);
  return date;
}

function normalizeRelativePath(value, failureCode = "P16_RECOVERY_PATH_INVALID") {
  invariant(typeof value === "string" && value.length > 0, failureCode);
  const normalized = value.replaceAll("\\", "/");
  invariant(!normalized.startsWith("/") && !/^[A-Za-z]:\//u.test(normalized), failureCode);
  invariant(
    normalized
      .split("/")
      .every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    failureCode,
  );
  return normalized;
}

function isContainedPath(parent, child) {
  const candidate = relative(parent, child);
  return candidate === "" || (!candidate.startsWith("..") && !isAbsolute(candidate));
}

export function decodeRecoveryEncryptionKey(value) {
  invariant(typeof value === "string" && value.length > 0, "P16_RECOVERY_KEY_REQUIRED");
  const key = Buffer.from(value, "base64");
  invariant(key.length === 32, "P16_RECOVERY_KEY_INVALID");
  invariant(key.toString("base64") === value, "P16_RECOVERY_KEY_INVALID");
  return key;
}

export async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function migrationSetSha256(migrations) {
  const canonical = migrations.map((entry) => `${entry.name}:${entry.sha256}`).join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export async function collectP16MigrationMetadata(repositoryRoot) {
  const migrationsRoot = join(repositoryRoot, "prisma", "migrations");
  const entries = await readdir(migrationsRoot, { withFileTypes: true });
  const migrations = [];
  for (const entry of entries
    .filter((candidate) => candidate.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const migrationPath = join(migrationsRoot, entry.name, "migration.sql");
    const metadata = await stat(migrationPath);
    invariant(metadata.isFile(), "P16_RECOVERY_MIGRATION_SQL_MISSING");
    migrations.push({ name: entry.name, sha256: await sha256File(migrationPath) });
  }
  invariant(migrations.length > 0, "P16_RECOVERY_MIGRATIONS_EMPTY");
  return Object.freeze(migrations.map((entry) => Object.freeze(entry)));
}

export function calculateP16MigrationSetSha256(migrations) {
  return migrationSetSha256(migrations);
}

async function assertPathDoesNotExist(path, failureCode) {
  try {
    await access(path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(failureCode);
}

function parseDatabaseUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("P16_BACKUP_DATABASE_URL_INVALID");
  }
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  invariant(
    url.protocol === "mysql:" &&
      Boolean(url.hostname) &&
      Boolean(url.username) &&
      Boolean(url.password) &&
      SAFE_DATABASE_PATTERN.test(databaseName),
    "P16_BACKUP_DATABASE_URL_INVALID",
  );
  return {
    hostname: url.hostname.toLowerCase(),
    port: url.port || "3306",
    databaseName,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

function isStagingDatabaseName(databaseName) {
  const tokens = databaseName.toLowerCase().split(/[_-]+/u);
  return (
    tokens.some((token) => token === "stage" || token === "staging") &&
    !/(prod(uction)?|live|dev(elopment)?|local|test)/iu.test(databaseName)
  );
}

export function validateStagingDatabaseBackupEnvironment(env) {
  invariant(env.APP_ENV === "staging", "P16_BACKUP_APP_ENV_INVALID");
  invariant(env.NODE_ENV === "production", "P16_BACKUP_NODE_ENV_INVALID");
  invariant(
    env.P16_STAGING_ENVIRONMENT_ID === P16_STAGING_ENVIRONMENT_ID,
    "P16_BACKUP_ENVIRONMENT_ID_INVALID",
  );
  invariant(
    env.P16_DATABASE_MIGRATION_WINDOW === "disabled",
    "P16_BACKUP_MIGRATION_WINDOW_INVALID",
  );
  invariant(
    typeof env.DB_TLS_CA_FILE === "string" && isAbsolute(env.DB_TLS_CA_FILE),
    "P16_BACKUP_TLS_CA_INVALID",
  );
  const target = parseDatabaseUrl(env.DB_RUNTIME_URL);
  invariant(
    !["127.0.0.1", "localhost", "::1"].includes(target.hostname),
    "P16_BACKUP_LOCALHOST_REFUSED",
  );
  invariant(isStagingDatabaseName(target.databaseName), "P16_BACKUP_DATABASE_NOT_STAGING");
  invariant(
    env.PRIVATE_STORAGE_DRIVER === "hosted" && env.P16_PRIVATE_STORAGE_PROVIDER === "r2",
    "P16_BACKUP_PRIVATE_STORAGE_INVALID",
  );
  return Object.freeze({
    hostname: target.hostname,
    port: target.port,
    databaseName: target.databaseName,
    username: target.username,
    tlsCaFile: env.DB_TLS_CA_FILE,
    environmentId: P16_STAGING_ENVIRONMENT_ID,
    dumpMode: "SINGLE_TRANSACTION_NO_LOCKS",
  });
}

function databaseDumpChildEnvironment(env, password) {
  const childEnvironment = { MYSQL_PWD: password };
  for (const name of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP"]) {
    if (typeof env[name] === "string") childEnvironment[name] = env[name];
  }
  return childEnvironment;
}

export async function createStagingDatabaseDump(input) {
  invariant(isAbsolute(input.destinationPath ?? ""), "P16_BACKUP_DESTINATION_INVALID");
  const destinationPath = resolve(input.destinationPath);
  invariant(destinationPath.toLowerCase().endsWith(".sql"), "P16_BACKUP_DESTINATION_INVALID");
  await assertPathDoesNotExist(destinationPath, "P16_BACKUP_DESTINATION_EXISTS");
  const configuration = validateStagingDatabaseBackupEnvironment(input.env);
  const credentials = parseDatabaseUrl(input.env.DB_RUNTIME_URL);
  const partialPath = `${destinationPath}.partial-${randomUUID()}`;
  await mkdir(dirname(destinationPath), { recursive: true });
  const command = input.command ?? "mysqldump";
  const prefixArguments = input.commandPrefixArguments ?? [];
  invariant(
    typeof command === "string" &&
      command.length > 0 &&
      Array.isArray(prefixArguments) &&
      prefixArguments.every((argument) => typeof argument === "string"),
    "P16_BACKUP_COMMAND_INVALID",
  );

  let child;
  let closed;
  try {
    child = spawn(command, [...prefixArguments, ...stagingMysqlDumpArguments(configuration)], {
      env: databaseDumpChildEnvironment(input.env, credentials.password),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stderrBytes = 0;
    child.stderr.on("data", (chunk) => {
      stderrBytes = Math.min(stderrBytes + chunk.length, 8192);
    });
    closed = new Promise((resolveClose) => child.once("close", resolveClose));
    const exit = new Promise((resolveExit, rejectExit) => {
      child.once("error", rejectExit);
      child.once("close", (code, signal) => {
        if (code === 0 && signal === null) resolveExit();
        else rejectExit(new Error("P16_BACKUP_DATABASE_DUMP_FAILED"));
      });
    });
    await Promise.all([
      pipeline(child.stdout, createWriteStream(partialPath, { flags: "wx", mode: 0o600 })),
      exit,
    ]);
    const metadata = await lstat(partialPath);
    invariant(
      metadata.isFile() && !metadata.isSymbolicLink() && metadata.size > 0,
      "P16_BACKUP_DATABASE_DUMP_EMPTY",
    );
    await rename(partialPath, destinationPath);
    return Object.freeze({
      destinationPath,
      databaseName: configuration.databaseName,
      environmentId: configuration.environmentId,
      snapshotMode: configuration.dumpMode,
      bytes: metadata.size,
      sha256: await sha256File(destinationPath),
      boundedDiagnosticBytes: stderrBytes,
    });
  } catch (error) {
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
    if (closed) await closed;
    await rm(partialPath, { force: true });
    throw new Error("P16_BACKUP_DATABASE_DUMP_FAILED", { cause: error });
  }
}

export function stagingMysqlDumpArguments(configuration) {
  exactKeys(
    configuration,
    ["hostname", "port", "databaseName", "username", "tlsCaFile", "environmentId", "dumpMode"],
    "P16_BACKUP_DATABASE_CONFIGURATION_INVALID",
  );
  invariant(
    configuration.environmentId === P16_STAGING_ENVIRONMENT_ID &&
      configuration.dumpMode === "SINGLE_TRANSACTION_NO_LOCKS",
    "P16_BACKUP_DATABASE_CONFIGURATION_INVALID",
  );
  return Object.freeze([
    "--protocol=TCP",
    `--host=${configuration.hostname}`,
    `--port=${configuration.port}`,
    `--user=${configuration.username}`,
    `--ssl-ca=${configuration.tlsCaFile}`,
    "--ssl-verify-server-cert",
    "--single-transaction",
    "--quick",
    "--skip-lock-tables",
    "--no-tablespaces",
    "--set-gtid-purged=OFF",
    "--hex-blob",
    "--default-character-set=utf8mb4",
    "--order-by-primary",
    "--skip-comments",
    configuration.databaseName,
  ]);
}

async function enumerateStorage(storageRoot) {
  invariant(isAbsolute(storageRoot), "P16_RECOVERY_STORAGE_ROOT_MUST_BE_ABSOLUTE");
  const rootMetadata = await lstat(storageRoot);
  invariant(
    rootMetadata.isDirectory() && !rootMetadata.isSymbolicLink(),
    "P16_RECOVERY_STORAGE_ROOT_INVALID",
  );
  const canonicalRoot = await realpath(storageRoot);
  const files = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const candidate = join(directory, entry.name);
      const metadata = await lstat(candidate);
      invariant(!metadata.isSymbolicLink(), "P16_RECOVERY_STORAGE_SYMLINK_REFUSED");
      if (metadata.isDirectory()) {
        await walk(candidate);
        continue;
      }
      invariant(metadata.isFile(), "P16_RECOVERY_STORAGE_ENTRY_INVALID");
      const canonical = await realpath(candidate);
      invariant(isContainedPath(canonicalRoot, canonical), "P16_RECOVERY_STORAGE_PATH_ESCAPE");
      const relativePath = normalizeRelativePath(relative(canonicalRoot, canonical));
      invariant(
        !/(^|\/)(?:\.env(?:\..*)?|session\.ps1)$/iu.test(relativePath) &&
          !/\.(?:pem|key|crt)$/iu.test(relativePath),
        "P16_RECOVERY_STORAGE_SECRET_FILE_REFUSED",
      );
      files.push({ sourcePath: canonical, relativePath, bytes: metadata.size });
    }
  }
  await walk(canonicalRoot);
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
  return files;
}

async function encryptFile(source, destination, key, relativeBase) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  await mkdir(dirname(destination), { recursive: true });
  await pipeline(createReadStream(source), cipher, createWriteStream(destination, { flags: "wx" }));
  const authTag = cipher.getAuthTag();
  const [plainMetadata, encryptedMetadata, plaintextSha256, sha256] = await Promise.all([
    stat(source),
    stat(destination),
    sha256File(source),
    sha256File(destination),
  ]);
  return Object.freeze({
    file: normalizeRelativePath(relative(relativeBase, destination)),
    bytes: encryptedMetadata.size,
    sha256,
    plaintextBytes: plainMetadata.size,
    plaintextSha256,
    encryption: Object.freeze({
      algorithm: ALGORITHM,
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
    }),
  });
}

async function encryptBuffer(buffer, destination, key, relativeBase) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, encrypted, { flag: "wx" });
  return Object.freeze({
    file: normalizeRelativePath(relative(relativeBase, destination)),
    bytes: encrypted.length,
    sha256: createHash("sha256").update(encrypted).digest("hex"),
    plaintextBytes: buffer.length,
    plaintextSha256: createHash("sha256").update(buffer).digest("hex"),
    encryption: Object.freeze({
      algorithm: ALGORITHM,
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
    }),
  });
}

function validateEncryptionMetadata(encryption) {
  exactKeys(encryption, ["algorithm", "iv", "authTag"], "P16_RECOVERY_ENCRYPTION_INVALID");
  invariant(encryption.algorithm === ALGORITHM, "P16_RECOVERY_ENCRYPTION_INVALID");
  const iv = Buffer.from(encryption.iv, "base64");
  const authTag = Buffer.from(encryption.authTag, "base64");
  invariant(
    iv.length === 12 &&
      iv.toString("base64") === encryption.iv &&
      authTag.length === 16 &&
      authTag.toString("base64") === encryption.authTag,
    "P16_RECOVERY_ENCRYPTION_INVALID",
  );
  return { iv, authTag };
}

function validateArtifactMetadata(artifact) {
  exactKeys(
    artifact,
    ["file", "bytes", "sha256", "plaintextBytes", "plaintextSha256", "encryption"],
    "P16_RECOVERY_ARTIFACT_INVALID",
  );
  normalizeRelativePath(artifact.file);
  invariant(
    Number.isSafeInteger(artifact.bytes) && artifact.bytes >= 0,
    "P16_RECOVERY_ARTIFACT_INVALID",
  );
  invariant(
    Number.isSafeInteger(artifact.plaintextBytes) && artifact.plaintextBytes >= 0,
    "P16_RECOVERY_ARTIFACT_INVALID",
  );
  invariant(
    SHA256_PATTERN.test(artifact.sha256) && SHA256_PATTERN.test(artifact.plaintextSha256),
    "P16_RECOVERY_ARTIFACT_INVALID",
  );
  validateEncryptionMetadata(artifact.encryption);
}

function safeArtifactPath(bundleRoot, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const candidate = resolve(bundleRoot, ...normalized.split("/"));
  invariant(isContainedPath(bundleRoot, candidate), "P16_RECOVERY_ARTIFACT_PATH_ESCAPE");
  return candidate;
}

async function verifyCiphertext(bundleRoot, artifact) {
  validateArtifactMetadata(artifact);
  const path = safeArtifactPath(bundleRoot, artifact.file);
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error("P16_RECOVERY_ARTIFACT_MISSING", { cause: error });
    }
    throw error;
  }
  invariant(metadata.isFile() && !metadata.isSymbolicLink(), "P16_RECOVERY_ARTIFACT_MISSING");
  invariant(metadata.size === artifact.bytes, "P16_RECOVERY_ARTIFACT_SIZE_MISMATCH");
  invariant((await sha256File(path)) === artifact.sha256, "P16_RECOVERY_ARTIFACT_HASH_MISMATCH");
  return path;
}

async function decryptArtifactToBuffer(bundleRoot, artifact, key) {
  const source = await verifyCiphertext(bundleRoot, artifact);
  invariant(artifact.bytes <= MAX_STORAGE_INDEX_BYTES, "P16_RECOVERY_INDEX_TOO_LARGE");
  const encrypted = await readFile(source);
  const { iv, authTag } = validateEncryptionMetadata(artifact.encryption);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let plaintext;
  try {
    plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    throw new Error("P16_RECOVERY_DECRYPTION_FAILED");
  }
  invariant(plaintext.length === artifact.plaintextBytes, "P16_RECOVERY_PLAINTEXT_SIZE_MISMATCH");
  invariant(
    createHash("sha256").update(plaintext).digest("hex") === artifact.plaintextSha256,
    "P16_RECOVERY_PLAINTEXT_HASH_MISMATCH",
  );
  return plaintext;
}

async function verifyArtifactPlaintext(bundleRoot, artifact, key) {
  const source = await verifyCiphertext(bundleRoot, artifact);
  const { iv, authTag } = validateEncryptionMetadata(artifact.encryption);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of createReadStream(source).pipe(decipher)) {
      bytes += chunk.length;
      hash.update(chunk);
    }
  } catch {
    throw new Error("P16_RECOVERY_DECRYPTION_FAILED");
  }
  invariant(bytes === artifact.plaintextBytes, "P16_RECOVERY_PLAINTEXT_SIZE_MISMATCH");
  invariant(
    hash.digest("hex") === artifact.plaintextSha256,
    "P16_RECOVERY_PLAINTEXT_HASH_MISMATCH",
  );
}

async function decryptArtifactToFile(bundleRoot, artifact, destination, key) {
  const source = await verifyCiphertext(bundleRoot, artifact);
  const { iv, authTag } = validateEncryptionMetadata(artifact.encryption);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  await mkdir(dirname(destination), { recursive: true });
  try {
    await pipeline(
      createReadStream(source),
      decipher,
      createWriteStream(destination, { flags: "wx" }),
    );
  } catch {
    throw new Error("P16_RECOVERY_DECRYPTION_FAILED");
  }
  const metadata = await stat(destination);
  invariant(metadata.size === artifact.plaintextBytes, "P16_RECOVERY_PLAINTEXT_SIZE_MISMATCH");
  invariant(
    (await sha256File(destination)) === artifact.plaintextSha256,
    "P16_RECOVERY_PLAINTEXT_HASH_MISMATCH",
  );
}

function assertSafeManifest(manifest) {
  const forbiddenKey = /(password|secret|token|cookie|databaseurl|dburl|credential|privatekey)/iu;
  const forbiddenValue = /(mysql:\/\/|\bBearer\s+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/iu;
  function walk(value) {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        invariant(!forbiddenKey.test(key), "P16_RECOVERY_MANIFEST_FORBIDDEN_KEY");
        walk(child);
      }
    } else if (typeof value === "string") {
      invariant(!forbiddenValue.test(value), "P16_RECOVERY_MANIFEST_FORBIDDEN_VALUE");
    }
  }
  walk(manifest);
}

function validateMigrations(migrations, expectedDigest) {
  invariant(Array.isArray(migrations) && migrations.length > 0, "P16_RECOVERY_MIGRATIONS_INVALID");
  const names = new Set();
  for (const migration of migrations) {
    exactKeys(migration, ["name", "sha256"], "P16_RECOVERY_MIGRATION_INVALID");
    invariant(
      typeof migration.name === "string" &&
        MIGRATION_NAME_PATTERN.test(migration.name) &&
        !names.has(migration.name),
      "P16_RECOVERY_MIGRATION_INVALID",
    );
    invariant(SHA256_PATTERN.test(migration.sha256), "P16_RECOVERY_MIGRATION_INVALID");
    names.add(migration.name);
  }
  const sorted = [...migrations].sort((left, right) => left.name.localeCompare(right.name, "en"));
  invariant(
    JSON.stringify(sorted) === JSON.stringify(migrations),
    "P16_RECOVERY_MIGRATIONS_UNSORTED",
  );
  invariant(
    migrationSetSha256(migrations) === expectedDigest,
    "P16_RECOVERY_MIGRATION_SET_MISMATCH",
  );
}

function validateManifest(manifest, expectations = {}) {
  exactKeys(
    manifest,
    [
      "manifestVersion",
      "backupId",
      "createdAt",
      "source",
      "release",
      "database",
      "migrations",
      "migrationSetSha256",
      "privateStorage",
      "protection",
      "recovery",
    ],
    "P16_RECOVERY_MANIFEST_INVALID",
  );
  assertSafeManifest(manifest);
  invariant(
    manifest.manifestVersion === P16_RECOVERY_MANIFEST_VERSION,
    "P16_RECOVERY_MANIFEST_VERSION_UNSUPPORTED",
  );
  invariant(BACKUP_ID_PATTERN.test(manifest.backupId), "P16_RECOVERY_BACKUP_ID_INVALID");
  normalizeTimestamp(manifest.createdAt, "P16_RECOVERY_CREATED_AT_INVALID");
  exactKeys(manifest.source, ["appEnv", "environmentId"], "P16_RECOVERY_SOURCE_INVALID");
  invariant(
    manifest.source.appEnv === "staging" &&
      manifest.source.environmentId === P16_STAGING_ENVIRONMENT_ID,
    "P16_RECOVERY_SOURCE_INVALID",
  );
  exactKeys(manifest.release, ["commit"], "P16_RECOVERY_RELEASE_INVALID");
  invariant(COMMIT_PATTERN.test(manifest.release.commit), "P16_RECOVERY_RELEASE_INVALID");
  exactKeys(
    manifest.database,
    ["name", "snapshotMode", "artifact"],
    "P16_RECOVERY_DATABASE_INVALID",
  );
  invariant(
    SAFE_DATABASE_PATTERN.test(manifest.database.name) &&
      isStagingDatabaseName(manifest.database.name) &&
      manifest.database.snapshotMode === "SINGLE_TRANSACTION_NO_LOCKS",
    "P16_RECOVERY_DATABASE_INVALID",
  );
  validateArtifactMetadata(manifest.database.artifact);
  invariant(
    manifest.database.artifact.file === "database/database.sql.enc",
    "P16_RECOVERY_DATABASE_INVALID",
  );
  invariant(SHA256_PATTERN.test(manifest.migrationSetSha256), "P16_RECOVERY_MIGRATION_SET_INVALID");
  validateMigrations(manifest.migrations, manifest.migrationSetSha256);
  exactKeys(
    manifest.privateStorage,
    [
      "provider",
      "relationship",
      "fileCount",
      "totalPlaintextBytes",
      "indexArtifact",
      "objectArtifacts",
    ],
    "P16_RECOVERY_STORAGE_INVALID",
  );
  invariant(
    manifest.privateStorage.provider === "r2" &&
      manifest.privateStorage.relationship === "SAME_RECOVERY_POINT",
    "P16_RECOVERY_STORAGE_INVALID",
  );
  invariant(
    Number.isSafeInteger(manifest.privateStorage.fileCount) &&
      manifest.privateStorage.fileCount >= 0 &&
      Number.isSafeInteger(manifest.privateStorage.totalPlaintextBytes) &&
      manifest.privateStorage.totalPlaintextBytes >= 0 &&
      Array.isArray(manifest.privateStorage.objectArtifacts) &&
      manifest.privateStorage.objectArtifacts.length === manifest.privateStorage.fileCount,
    "P16_RECOVERY_STORAGE_INVALID",
  );
  validateArtifactMetadata(manifest.privateStorage.indexArtifact);
  manifest.privateStorage.objectArtifacts.forEach(validateArtifactMetadata);
  invariant(
    manifest.privateStorage.indexArtifact.file === "storage/index.json.enc",
    "P16_RECOVERY_STORAGE_INVALID",
  );
  const objectArtifactFiles = manifest.privateStorage.objectArtifacts.map(
    (artifact) => artifact.file,
  );
  invariant(
    objectArtifactFiles.every((file) => /^storage\/objects\/[0-9a-f]{64}\.enc$/u.test(file)) &&
      new Set(objectArtifactFiles).size === objectArtifactFiles.length &&
      JSON.stringify(
        [...objectArtifactFiles].sort((left, right) => left.localeCompare(right, "en")),
      ) === JSON.stringify(objectArtifactFiles),
    "P16_RECOVERY_STORAGE_INVALID",
  );
  exactKeys(
    manifest.protection,
    ["transport", "atRest", "publicAccess", "keySeparation"],
    "P16_RECOVERY_PROTECTION_INVALID",
  );
  invariant(
    manifest.protection.transport === "TLS_REQUIRED" &&
      manifest.protection.atRest === "AES_256_GCM" &&
      manifest.protection.publicAccess === "DENY" &&
      manifest.protection.keySeparation === "KEY_NOT_IN_BUNDLE",
    "P16_RECOVERY_PROTECTION_INVALID",
  );
  exactKeys(
    manifest.recovery,
    ["mode", "targetEnvironmentId", "databaseTargetPattern", "requiresExplicitAuthorization"],
    "P16_RECOVERY_INSTRUCTIONS_INVALID",
  );
  invariant(
    manifest.recovery.mode === "ISOLATED_RESTORE_ONLY" &&
      manifest.recovery.targetEnvironmentId === P16_ISOLATED_RECOVERY_ENVIRONMENT_ID &&
      manifest.recovery.databaseTargetPattern === "lessenc_(test_)?recovery(_<id>)?" &&
      manifest.recovery.requiresExplicitAuthorization === true,
    "P16_RECOVERY_INSTRUCTIONS_INVALID",
  );
  if (expectations.environmentId !== undefined) {
    invariant(
      manifest.source.environmentId === expectations.environmentId,
      "P16_RECOVERY_ENVIRONMENT_MISMATCH",
    );
  }
  if (expectations.databaseName !== undefined) {
    invariant(
      manifest.database.name === expectations.databaseName,
      "P16_RECOVERY_DATABASE_MISMATCH",
    );
  }
  if (expectations.backupId !== undefined) {
    invariant(manifest.backupId === expectations.backupId, "P16_RECOVERY_BACKUP_ID_MISMATCH");
  }
  if (expectations.releaseCommit !== undefined) {
    invariant(
      manifest.release.commit === expectations.releaseCommit,
      "P16_RECOVERY_RELEASE_MISMATCH",
    );
  }
  if (expectations.migrationSetSha256 !== undefined) {
    invariant(
      manifest.migrationSetSha256 === expectations.migrationSetSha256,
      "P16_RECOVERY_MIGRATION_IDENTITY_MISMATCH",
    );
  }
}

async function parseStorageIndex(buffer, manifest) {
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error("P16_RECOVERY_STORAGE_INDEX_INVALID");
  }
  invariant(Array.isArray(parsed), "P16_RECOVERY_STORAGE_INDEX_INVALID");
  invariant(
    parsed.length === manifest.privateStorage.fileCount,
    "P16_RECOVERY_STORAGE_INDEX_MISMATCH",
  );
  const seenPaths = new Set();
  const seenArtifacts = new Set();
  let total = 0;
  for (const entry of parsed) {
    exactKeys(entry, ["relativePath", "artifactFile"], "P16_RECOVERY_STORAGE_INDEX_INVALID");
    const relativePath = normalizeRelativePath(entry.relativePath);
    const artifactFile = normalizeRelativePath(entry.artifactFile);
    invariant(
      !seenPaths.has(relativePath) && !seenArtifacts.has(artifactFile),
      "P16_RECOVERY_STORAGE_INDEX_DUPLICATE",
    );
    seenPaths.add(relativePath);
    seenArtifacts.add(artifactFile);
    const artifact = manifest.privateStorage.objectArtifacts.find(
      (candidate) => candidate.file === artifactFile,
    );
    invariant(artifact, "P16_RECOVERY_STORAGE_INDEX_MISMATCH");
    total += artifact.plaintextBytes;
  }
  invariant(
    total === manifest.privateStorage.totalPlaintextBytes,
    "P16_RECOVERY_STORAGE_TOTAL_MISMATCH",
  );
  const sorted = [...parsed].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, "en"),
  );
  invariant(
    JSON.stringify(sorted) === JSON.stringify(parsed),
    "P16_RECOVERY_STORAGE_INDEX_UNSORTED",
  );
  return parsed;
}

export async function createP16RecoveryBundle(input) {
  invariant(BACKUP_ID_PATTERN.test(input.backupId ?? ""), "P16_RECOVERY_BACKUP_ID_INVALID");
  const createdAt = normalizeTimestamp(
    input.createdAt,
    "P16_RECOVERY_CREATED_AT_INVALID",
  ).toISOString();
  invariant(COMMIT_PATTERN.test(input.releaseCommit ?? ""), "P16_RECOVERY_RELEASE_INVALID");
  invariant(
    SAFE_DATABASE_PATTERN.test(input.databaseName ?? "") &&
      isStagingDatabaseName(input.databaseName),
    "P16_RECOVERY_DATABASE_INVALID",
  );
  invariant(isAbsolute(input.databaseDumpPath ?? ""), "P16_RECOVERY_DATABASE_DUMP_PATH_INVALID");
  invariant(isAbsolute(input.outputRoot ?? ""), "P16_RECOVERY_OUTPUT_ROOT_INVALID");
  const key = Buffer.isBuffer(input.encryptionKey)
    ? input.encryptionKey
    : decodeRecoveryEncryptionKey(input.encryptionKey);
  invariant(key.length === 32, "P16_RECOVERY_KEY_INVALID");
  const outputRoot = resolve(input.outputRoot);
  const finalRoot = join(outputRoot, input.backupId);
  const partialRoot = join(outputRoot, `.${input.backupId}.partial-${randomUUID()}`);
  const storageRoot = resolve(input.storageRoot);
  const dumpPath = resolve(input.databaseDumpPath);
  invariant(
    !isContainedPath(storageRoot, finalRoot) && !isContainedPath(finalRoot, storageRoot),
    "P16_RECOVERY_OUTPUT_OVERLAP",
  );
  invariant(
    !isContainedPath(dumpPath, finalRoot) && !isContainedPath(finalRoot, dumpPath),
    "P16_RECOVERY_OUTPUT_OVERLAP",
  );
  await mkdir(outputRoot, { recursive: true });
  await assertPathDoesNotExist(finalRoot, "P16_RECOVERY_BUNDLE_ALREADY_EXISTS");
  await mkdir(partialRoot, { recursive: false });
  try {
    const migrations = await collectP16MigrationMetadata(input.repositoryRoot);
    const databaseArtifact = await encryptFile(
      dumpPath,
      join(partialRoot, "database", "database.sql.enc"),
      key,
      partialRoot,
    );
    const storageFiles = await enumerateStorage(storageRoot);
    const objectArtifacts = [];
    const index = [];
    for (const file of storageFiles) {
      const objectName = `${createHash("sha256").update(file.relativePath, "utf8").digest("hex")}.enc`;
      const destination = join(partialRoot, "storage", "objects", objectName);
      const artifact = await encryptFile(file.sourcePath, destination, key, partialRoot);
      objectArtifacts.push(artifact);
      index.push({ relativePath: file.relativePath, artifactFile: artifact.file });
    }
    objectArtifacts.sort((left, right) => left.file.localeCompare(right.file, "en"));
    index.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
    const indexBuffer = Buffer.from(`${JSON.stringify(index)}\n`, "utf8");
    invariant(indexBuffer.length <= MAX_STORAGE_INDEX_BYTES, "P16_RECOVERY_INDEX_TOO_LARGE");
    const indexArtifact = await encryptBuffer(
      indexBuffer,
      join(partialRoot, "storage", "index.json.enc"),
      key,
      partialRoot,
    );
    const manifest = {
      manifestVersion: P16_RECOVERY_MANIFEST_VERSION,
      backupId: input.backupId,
      createdAt,
      source: { appEnv: "staging", environmentId: P16_STAGING_ENVIRONMENT_ID },
      release: { commit: input.releaseCommit },
      database: {
        name: input.databaseName,
        snapshotMode: "SINGLE_TRANSACTION_NO_LOCKS",
        artifact: databaseArtifact,
      },
      migrations,
      migrationSetSha256: migrationSetSha256(migrations),
      privateStorage: {
        provider: "r2",
        relationship: "SAME_RECOVERY_POINT",
        fileCount: storageFiles.length,
        totalPlaintextBytes: objectArtifacts.reduce(
          (total, artifact) => total + artifact.plaintextBytes,
          0,
        ),
        indexArtifact,
        objectArtifacts,
      },
      protection: {
        transport: "TLS_REQUIRED",
        atRest: "AES_256_GCM",
        publicAccess: "DENY",
        keySeparation: "KEY_NOT_IN_BUNDLE",
      },
      recovery: {
        mode: "ISOLATED_RESTORE_ONLY",
        targetEnvironmentId: P16_ISOLATED_RECOVERY_ENVIRONMENT_ID,
        databaseTargetPattern: "lessenc_(test_)?recovery(_<id>)?",
        requiresExplicitAuthorization: true,
      },
    };
    validateManifest(manifest, {
      environmentId: P16_STAGING_ENVIRONMENT_ID,
      databaseName: input.databaseName,
      backupId: input.backupId,
      releaseCommit: input.releaseCommit,
    });
    await writeFile(join(partialRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
    });
    await verifyP16RecoveryBundle(partialRoot, {
      encryptionKey: key,
      environmentId: P16_STAGING_ENVIRONMENT_ID,
      databaseName: input.databaseName,
      backupId: input.backupId,
      releaseCommit: input.releaseCommit,
    });
    await rename(partialRoot, finalRoot);
    return Object.freeze({ bundleDirectory: finalRoot, manifest: Object.freeze(manifest) });
  } catch (error) {
    await rm(partialRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function verifyP16RecoveryBundle(bundleDirectory, options) {
  const bundleRoot = resolve(bundleDirectory);
  const key = Buffer.isBuffer(options.encryptionKey)
    ? options.encryptionKey
    : decodeRecoveryEncryptionKey(options.encryptionKey);
  invariant(key.length === 32, "P16_RECOVERY_KEY_INVALID");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(bundleRoot, "manifest.json"), "utf8"));
  } catch {
    throw new Error("P16_RECOVERY_MANIFEST_UNREADABLE");
  }
  validateManifest(manifest, options);
  await verifyCiphertext(bundleRoot, manifest.database.artifact);
  for (const artifact of manifest.privateStorage.objectArtifacts)
    await verifyCiphertext(bundleRoot, artifact);
  const indexBuffer = await decryptArtifactToBuffer(
    bundleRoot,
    manifest.privateStorage.indexArtifact,
    key,
  );
  const index = await parseStorageIndex(indexBuffer, manifest);
  await verifyArtifactPlaintext(bundleRoot, manifest.database.artifact, key);
  for (const entry of index) {
    const artifact = manifest.privateStorage.objectArtifacts.find(
      (candidate) => candidate.file === entry.artifactFile,
    );
    await verifyArtifactPlaintext(bundleRoot, artifact, key);
  }
  return Object.freeze({ manifest: Object.freeze(manifest), storageIndex: Object.freeze(index) });
}

export async function restoreP16RecoveryBundleIsolated(input) {
  invariant(
    input.targetEnvironmentId === P16_ISOLATED_RECOVERY_ENVIRONMENT_ID,
    "P16_RESTORE_LIVE_ENVIRONMENT_REFUSED",
  );
  invariant(
    RECOVERY_DATABASE_PATTERN.test(input.targetDatabaseName ?? ""),
    "P16_RESTORE_DATABASE_TARGET_REFUSED",
  );
  invariant(isAbsolute(input.targetRoot ?? ""), "P16_RESTORE_TARGET_ROOT_INVALID");
  const targetRoot = resolve(input.targetRoot);
  const bundleRoot = resolve(input.bundleDirectory);
  invariant(
    !isContainedPath(bundleRoot, targetRoot) && !isContainedPath(targetRoot, bundleRoot),
    "P16_RESTORE_TARGET_OVERLAP",
  );
  await assertPathDoesNotExist(targetRoot, "P16_RESTORE_TARGET_EXISTS");
  const startedAt = new Date();
  const partialRoot = `${targetRoot}.partial-${randomUUID()}`;
  const verified = await verifyP16RecoveryBundle(bundleRoot, {
    encryptionKey: input.encryptionKey,
    environmentId: P16_STAGING_ENVIRONMENT_ID,
    databaseName: input.expectedSourceDatabaseName,
    backupId: input.expectedBackupId,
    releaseCommit: input.expectedReleaseCommit,
    migrationSetSha256: input.expectedMigrationSetSha256,
  });
  const key = Buffer.isBuffer(input.encryptionKey)
    ? input.encryptionKey
    : decodeRecoveryEncryptionKey(input.encryptionKey);
  await mkdir(partialRoot, { recursive: false });
  try {
    await decryptArtifactToFile(
      bundleRoot,
      verified.manifest.database.artifact,
      join(partialRoot, "database.sql"),
      key,
    );
    for (const entry of verified.storageIndex) {
      const artifact = verified.manifest.privateStorage.objectArtifacts.find(
        (candidate) => candidate.file === entry.artifactFile,
      );
      const destination = safeArtifactPath(join(partialRoot, "storage"), entry.relativePath);
      await decryptArtifactToFile(bundleRoot, artifact, destination, key);
    }
    const validatedAt = new Date();
    const evidence = {
      evidenceVersion: 1,
      outcome: "VALIDATED",
      evidenceScope: "LOCAL_SYNTHETIC",
      targetEnvironmentId: input.targetEnvironmentId,
      targetDatabaseName: input.targetDatabaseName,
      backupId: verified.manifest.backupId,
      sourceEnvironmentId: verified.manifest.source.environmentId,
      releaseCommit: verified.manifest.release.commit,
      migrationSetSha256: verified.manifest.migrationSetSha256,
      recoveryStartedAt: startedAt.toISOString(),
      recoveryValidatedAt: validatedAt.toISOString(),
      durationMs: validatedAt.getTime() - startedAt.getTime(),
    };
    await writeFile(
      join(partialRoot, "recovery-evidence.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      { flag: "wx" },
    );
    await rename(partialRoot, targetRoot);
    return Object.freeze(evidence);
  } catch (error) {
    await rm(partialRoot, { recursive: true, force: true });
    throw error;
  }
}

export function measureP16Rpo(input) {
  const observedAt = normalizeTimestamp(input.observedAt, "P16_RPO_OBSERVED_AT_INVALID");
  if (
    input.evidenceScope !== "HOSTED_STAGING" ||
    input.latestVerifiedBackupAt === null ||
    input.latestVerifiedBackupAt === undefined
  ) {
    return Object.freeze({
      status: "UNKNOWN",
      targetSeconds: P16_RPO_TARGET_SECONDS,
      ageSeconds: null,
      reason: "NO_HOSTED_EVIDENCE",
    });
  }
  const backupAt = normalizeTimestamp(input.latestVerifiedBackupAt, "P16_RPO_BACKUP_AT_INVALID");
  invariant(backupAt.getTime() <= observedAt.getTime(), "P16_RPO_FUTURE_BACKUP_REFUSED");
  const ageSeconds = Math.floor((observedAt.getTime() - backupAt.getTime()) / 1000);
  return Object.freeze({
    status: ageSeconds <= P16_RPO_TARGET_SECONDS ? "PASS" : "FAIL",
    targetSeconds: P16_RPO_TARGET_SECONDS,
    ageSeconds,
    reason: ageSeconds <= P16_RPO_TARGET_SECONDS ? "WITHIN_TARGET" : "STALE_BACKUP",
  });
}

export function measureP16Rto(input) {
  if (
    !input.recoveryStartedAt ||
    !input.recoveryValidatedAt ||
    input.validationOutcome !== "VALIDATED"
  ) {
    return Object.freeze({
      status: "UNKNOWN",
      targetSeconds: P16_RTO_TARGET_SECONDS,
      durationSeconds: null,
      localAssessment: null,
      reason: "NO_VALIDATED_RECOVERY_EVIDENCE",
    });
  }
  const startedAt = normalizeTimestamp(input.recoveryStartedAt, "P16_RTO_STARTED_AT_INVALID");
  const validatedAt = normalizeTimestamp(input.recoveryValidatedAt, "P16_RTO_VALIDATED_AT_INVALID");
  invariant(validatedAt.getTime() >= startedAt.getTime(), "P16_RTO_INTERVAL_INVALID");
  const durationSeconds = Math.floor((validatedAt.getTime() - startedAt.getTime()) / 1000);
  const assessment = durationSeconds <= P16_RTO_TARGET_SECONDS ? "PASS" : "FAIL";
  if (input.evidenceScope !== "HOSTED_STAGING") {
    return Object.freeze({
      status: "UNKNOWN",
      targetSeconds: P16_RTO_TARGET_SECONDS,
      durationSeconds,
      localAssessment: assessment,
      reason: "LOCAL_EVIDENCE_NOT_HOSTED_PROOF",
    });
  }
  return Object.freeze({
    status: assessment,
    targetSeconds: P16_RTO_TARGET_SECONDS,
    durationSeconds,
    localAssessment: null,
    reason: assessment === "PASS" ? "WITHIN_TARGET" : "RECOVERY_EXCEEDED_TARGET",
  });
}

export function planP16ApplicationRollback(input) {
  invariant(input.environmentId === P16_STAGING_ENVIRONMENT_ID, "P16_ROLLBACK_ENVIRONMENT_REFUSED");
  invariant(
    COMMIT_PATTERN.test(input.currentRelease ?? "") &&
      COMMIT_PATTERN.test(input.targetRelease ?? ""),
    "P16_ROLLBACK_RELEASE_INVALID",
  );
  invariant(input.currentRelease !== input.targetRelease, "P16_ROLLBACK_RELEASE_UNCHANGED");
  invariant(input.targetApproved === true, "P16_ROLLBACK_TARGET_NOT_APPROVED");
  invariant(
    SHA256_PATTERN.test(input.currentMigrationSetSha256 ?? "") &&
      SHA256_PATTERN.test(input.targetCompatibleMigrationSetSha256 ?? ""),
    "P16_ROLLBACK_MIGRATION_IDENTITY_INVALID",
  );
  invariant(
    input.currentMigrationSetSha256 === input.targetCompatibleMigrationSetSha256,
    "P16_ROLLBACK_SCHEMA_INCOMPATIBLE",
  );
  return Object.freeze({
    mode: "APPLICATION_ROLLBACK_PLAN_ONLY",
    environmentId: input.environmentId,
    currentRelease: input.currentRelease,
    targetRelease: input.targetRelease,
    migrationSetSha256: input.currentMigrationSetSha256,
    databaseRestore: false,
    schemaRollback: false,
    requiresExplicitDeploymentAuthorization: true,
  });
}
