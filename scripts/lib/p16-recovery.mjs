import { Buffer } from "node:buffer";
import process from "node:process";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { constants as fsConstants, createReadStream, createWriteStream } from "node:fs";
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
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { URL } from "node:url";

import {
  normalizeDatabaseHostname,
  validateStagingDatabaseAuthority,
} from "./p16-staging-contract.mjs";
import { validateReleaseCommitBinding } from "./p16-release-binding.mjs";

export const P16_RECOVERY_MANIFEST_VERSION = 2;
export const P16_STAGING_ENVIRONMENT_ID = "lessenc-staging";
export const P16_ISOLATED_RECOVERY_ENVIRONMENT_ID = "lessenc-recovery-test";
export const P16_RPO_TARGET_SECONDS = 24 * 60 * 60;
export const P16_RTO_TARGET_SECONDS = 8 * 60 * 60;
export const P16_RPO_TARGET_MS = P16_RPO_TARGET_SECONDS * 1000;
export const P16_RTO_TARGET_MS = P16_RTO_TARGET_SECONDS * 1000;
export const P16_DATABASE_DUMP_CLIENT = "mariadb";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const BACKUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const SAFE_DATABASE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const MIGRATION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const RECOVERY_DATABASE_PATTERN = /^lessenc_(?:test_)?recovery(?:_[a-z0-9]+)?$/u;
const MAX_STORAGE_INDEX_BYTES = 16 * 1024 * 1024;
const ALGORITHM = "aes-256-gcm";
const MANIFEST_INTEGRITY_ALGORITHM = "HMAC-SHA256";
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const MANIFEST_AUTH_CONTEXT = Buffer.from(
  "lessenc:p16:recovery:v2:manifest-authentication",
  "utf8",
);
const ARTIFACT_ENCRYPTION_CONTEXT = Buffer.from(
  "lessenc:p16:recovery:v2:artifact-encryption",
  "utf8",
);
const RECOVERY_HKDF_SALT = Buffer.from("lessenc:p16:recovery:v2", "utf8");
const MAX_MANIFEST_BYTES = 1024 * 1024;
const DUMP_EVIDENCE_VERSION = 1;

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

async function assertNoSymlinkComponents(path, failureCode) {
  let current = resolve(path);
  while (true) {
    const metadata = await lstat(current);
    invariant(!metadata.isSymbolicLink(), failureCode);
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

export function decodeRecoveryEncryptionKey(value) {
  invariant(typeof value === "string" && value.length > 0, "P16_RECOVERY_KEY_REQUIRED");
  const key = Buffer.from(value, "base64");
  invariant(key.length === 32, "P16_RECOVERY_KEY_INVALID");
  invariant(key.toString("base64") === value, "P16_RECOVERY_KEY_INVALID");
  return key;
}

function normalizeMasterKey(value) {
  const key = Buffer.isBuffer(value) ? value : decodeRecoveryEncryptionKey(value);
  invariant(key.length === 32, "P16_RECOVERY_KEY_INVALID");
  return key;
}

function deriveRecoveryKeys(masterKey) {
  return Object.freeze({
    artifactEncryptionKey: Buffer.from(
      hkdfSync("sha256", masterKey, RECOVERY_HKDF_SALT, ARTIFACT_ENCRYPTION_CONTEXT, 32),
    ),
    manifestAuthenticationKey: Buffer.from(
      hkdfSync("sha256", masterKey, RECOVERY_HKDF_SALT, MANIFEST_AUTH_CONTEXT, 32),
    ),
  });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function manifestAuthenticationPayload(manifest) {
  const authenticated = {
    ...manifest,
    manifestIntegrity: { ...manifest?.manifestIntegrity },
  };
  invariant(authenticated?.manifestIntegrity, "P16_RECOVERY_MANIFEST_INTEGRITY_INVALID");
  delete authenticated.manifestIntegrity.mac;
  return Buffer.from(canonicalJson(authenticated), "utf8");
}

function authenticateManifest(manifest, authenticationKey, keyId) {
  manifest.manifestIntegrity = {
    algorithm: MANIFEST_INTEGRITY_ALGORITHM,
    keyId,
    mac: "",
  };
  manifest.manifestIntegrity.mac = createHmac("sha256", authenticationKey)
    .update(manifestAuthenticationPayload(manifest))
    .digest("hex");
}

function verifyManifestAuthentication(manifest, authenticationKey, expectedKeyId) {
  exactKeys(
    manifest?.manifestIntegrity,
    ["algorithm", "keyId", "mac"],
    "P16_RECOVERY_MANIFEST_INTEGRITY_INVALID",
  );
  const integrity = manifest.manifestIntegrity;
  invariant(
    integrity.algorithm === MANIFEST_INTEGRITY_ALGORITHM &&
      KEY_ID_PATTERN.test(integrity.keyId) &&
      SHA256_PATTERN.test(integrity.mac),
    "P16_RECOVERY_MANIFEST_INTEGRITY_INVALID",
  );
  if (expectedKeyId !== undefined) {
    invariant(integrity.keyId === expectedKeyId, "P16_RECOVERY_KEY_ID_MISMATCH");
  }
  const expected = createHmac("sha256", authenticationKey)
    .update(manifestAuthenticationPayload(manifest))
    .digest();
  const actual = Buffer.from(integrity.mac, "hex");
  invariant(
    actual.length === expected.length && timingSafeEqual(actual, expected),
    "P16_RECOVERY_MANIFEST_INTEGRITY_INVALID",
  );
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
    hostname: normalizeDatabaseHostname(url.hostname),
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

async function canonicalExistingPath(path, kind, failureCode) {
  invariant(isAbsolute(path ?? ""), failureCode);
  const resolved = resolve(path);
  const metadata = await lstat(resolved);
  invariant(!metadata.isSymbolicLink(), failureCode);
  invariant(kind === "file" ? metadata.isFile() : metadata.isDirectory(), failureCode);
  await assertNoSymlinkComponents(resolved, failureCode);
  const canonical = await realpath(resolved);
  return canonical;
}

async function canonicalProspectivePath(path, failureCode) {
  invariant(isAbsolute(path ?? ""), failureCode);
  const resolved = resolve(path);
  let existing = resolved;
  while (true) {
    try {
      const metadata = await lstat(existing);
      invariant(!metadata.isSymbolicLink() && metadata.isDirectory(), failureCode);
      await assertNoSymlinkComponents(existing, failureCode);
      break;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
      const parent = dirname(existing);
      invariant(parent !== existing, failureCode);
      existing = parent;
    }
  }
  const canonicalParent = await realpath(existing);
  return resolve(canonicalParent, relative(existing, resolved));
}

async function assertOutsideRepository(path, repositoryRoot, failureCode) {
  const canonicalRepository = await canonicalExistingPath(
    resolve(repositoryRoot),
    "directory",
    "P16_RECOVERY_REPOSITORY_ROOT_INVALID",
  );
  invariant(!isContainedPath(canonicalRepository, path), failureCode);
}

function requireValidReleaseBinding(releaseCommit, resolveHead) {
  const failures = validateReleaseCommitBinding(releaseCommit, resolveHead);
  invariant(failures.length === 0, failures[0] ?? "P16_RELEASE_COMMIT_HEAD_UNVERIFIABLE");
}

export async function validateStagingDatabaseBackupEnvironment(env) {
  invariant(env.APP_ENV === "staging", "P16_BACKUP_APP_ENV_INVALID");
  invariant(env.NODE_ENV === "production", "P16_BACKUP_NODE_ENV_INVALID");
  invariant(
    env.P16_STAGING_ENVIRONMENT_ID === P16_STAGING_ENVIRONMENT_ID,
    "P16_BACKUP_ENVIRONMENT_ID_INVALID",
  );
  const authorityFailures = validateStagingDatabaseAuthority(env, { gate: "runtime" });
  invariant(
    authorityFailures.length === 0,
    `P16_BACKUP_DATABASE_AUTHORITY_INVALID:${authorityFailures.join(",")}`,
  );
  invariant(env.P16_DATABASE_DUMP_CLIENT === P16_DATABASE_DUMP_CLIENT, "P16_BACKUP_CLIENT_INVALID");
  let tlsCaFile;
  try {
    tlsCaFile = await canonicalExistingPath(
      env.DB_TLS_CA_FILE,
      "file",
      "P16_BACKUP_TLS_CA_INVALID",
    );
    await access(tlsCaFile, fsConstants.R_OK);
  } catch (error) {
    if (error instanceof Error && error.message === "P16_BACKUP_TLS_CA_INVALID") throw error;
    throw new Error("P16_BACKUP_TLS_CA_INVALID", { cause: error });
  }
  const target = parseDatabaseUrl(env.DB_RUNTIME_URL);
  invariant(
    target.hostname === normalizeDatabaseHostname(env.P16_DATABASE_EXPECTED_HOST),
    "P16_BACKUP_DATABASE_HOST_MISMATCH",
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
    tlsCaFile,
    environmentId: P16_STAGING_ENVIRONMENT_ID,
    dumpMode: "SINGLE_TRANSACTION_NO_LOCKS",
  });
}

function boundedProcess(command, argumentsList, options = {}) {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(command, argumentsList, {
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const chunks = [];
    let bytes = 0;
    const collect = (chunk) => {
      if (bytes >= 64 * 1024) return;
      const bounded = chunk.subarray(0, 64 * 1024 - bytes);
      chunks.push(bounded);
      bytes += bounded.length;
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", () => rejectProcess(new Error("P16_BACKUP_CLIENT_PREFLIGHT_FAILED")));
    child.once("close", (code, signal) => {
      if (code !== 0 || signal !== null) {
        rejectProcess(new Error("P16_BACKUP_CLIENT_PREFLIGHT_FAILED"));
        return;
      }
      resolveProcess(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

export async function inspectMariaDbDumpClient(input = {}) {
  const command = input.command ?? "mariadb-dump";
  const prefixArguments = input.commandPrefixArguments ?? [];
  invariant(
    typeof command === "string" &&
      command.length > 0 &&
      Array.isArray(prefixArguments) &&
      prefixArguments.every((argument) => typeof argument === "string"),
    "P16_BACKUP_COMMAND_INVALID",
  );
  const childEnvironment = databaseDumpChildEnvironment(input.env ?? process.env, "");
  delete childEnvironment.MYSQL_PWD;
  const versionOutput = await boundedProcess(command, [...prefixArguments, "--version"], {
    env: childEnvironment,
  });
  invariant(
    /mariadb-dump/iu.test(versionOutput) && /MariaDB/iu.test(versionOutput),
    "P16_BACKUP_CLIENT_FAMILY_UNSUPPORTED",
  );
  const versionMatch =
    versionOutput.match(/Distrib\s+(\d+)\.(\d+)\.(\d+)-MariaDB/iu) ??
    versionOutput.match(/(\d+)\.(\d+)\.(\d+)[^\r\n]*MariaDB/iu);
  invariant(versionMatch, "P16_BACKUP_CLIENT_VERSION_UNSUPPORTED");
  const major = Number(versionMatch[1]);
  const minor = Number(versionMatch[2]);
  invariant((major === 10 && minor >= 11) || major === 11, "P16_BACKUP_CLIENT_VERSION_UNSUPPORTED");
  const helpOutput = await boundedProcess(command, [...prefixArguments, "--help"], {
    env: childEnvironment,
  });
  for (const capability of ["--ssl-ca", "--ssl-verify-server-cert", "--single-transaction"]) {
    invariant(helpOutput.includes(capability), "P16_BACKUP_CLIENT_CAPABILITY_MISSING");
  }
  return Object.freeze({
    family: P16_DATABASE_DUMP_CLIENT,
    version: `${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}`,
    executable: basename(command),
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
  const destinationPath = await canonicalProspectivePath(
    input.destinationPath,
    "P16_BACKUP_DESTINATION_INVALID",
  );
  invariant(destinationPath.toLowerCase().endsWith(".sql"), "P16_BACKUP_DESTINATION_INVALID");
  await assertOutsideRepository(
    destinationPath,
    input.repositoryRoot ?? process.cwd(),
    "P16_BACKUP_DESTINATION_IN_REPOSITORY_REFUSED",
  );
  await assertPathDoesNotExist(destinationPath, "P16_BACKUP_DESTINATION_EXISTS");
  const configuration = await validateStagingDatabaseBackupEnvironment(input.env);
  const credentials = parseDatabaseUrl(input.env.DB_RUNTIME_URL);
  requireValidReleaseBinding(input.env.P16_RELEASE_COMMIT, input.resolveHead);
  const client = await inspectMariaDbDumpClient({
    command: input.command,
    commandPrefixArguments: input.commandPrefixArguments,
    env: input.env,
  });
  const partialPath = `${destinationPath}.partial-${randomUUID()}`;
  await mkdir(dirname(destinationPath), { recursive: true });
  const command = input.command ?? "mariadb-dump";
  const prefixArguments = input.commandPrefixArguments ?? [];
  invariant(
    typeof command === "string" &&
      command.length > 0 &&
      Array.isArray(prefixArguments) &&
      prefixArguments.every((argument) => typeof argument === "string"),
    "P16_BACKUP_COMMAND_INVALID",
  );

  const startedAt = (input.clock?.() ?? new Date()).toISOString();
  let child;
  let closed;
  let destinationCreated = false;
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
    destinationCreated = true;
    const completedAt = (input.clock?.() ?? new Date()).toISOString();
    const sha256 = await sha256File(destinationPath);
    const tlsCaSha256 = await sha256File(configuration.tlsCaFile);
    const evidence = {
      evidenceVersion: DUMP_EVIDENCE_VERSION,
      evidenceType: "P16_DATABASE_DUMP",
      generatedBy: "scripts/p16-recovery.mjs",
      startedAt,
      completedAt,
      source: {
        environmentId: configuration.environmentId,
        database: {
          hostname: configuration.hostname,
          port: configuration.port,
          name: configuration.databaseName,
        },
      },
      artifact: { file: basename(destinationPath), bytes: metadata.size, sha256 },
      dumpClient: client,
      snapshot: {
        mode: configuration.dumpMode,
        transport: "TLS_VERIFIED",
        tlsCaSha256,
      },
      release: { commit: input.env.P16_RELEASE_COMMIT, authority: "REPOSITORY_HEAD_BOUND" },
    };
    const evidencePath = `${destinationPath}.evidence.json`;
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
    return Object.freeze({
      destinationPath,
      evidencePath,
      evidence: Object.freeze(evidence),
      bytes: metadata.size,
      sha256,
      boundedDiagnosticBytes: stderrBytes,
    });
  } catch (error) {
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
    if (closed) await closed;
    await rm(partialPath, { force: true });
    if (destinationCreated) await rm(destinationPath, { force: true });
    await rm(`${destinationPath}.evidence.json`, { force: true });
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
    "--no-defaults",
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
  const canonical = await realpath(path);
  invariant(isContainedPath(bundleRoot, canonical), "P16_RECOVERY_ARTIFACT_PATH_ESCAPE");
  invariant(metadata.size === artifact.bytes, "P16_RECOVERY_ARTIFACT_SIZE_MISMATCH");
  invariant(
    (await sha256File(canonical)) === artifact.sha256,
    "P16_RECOVERY_ARTIFACT_HASH_MISMATCH",
  );
  return canonical;
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

function validateDumpEvidenceShape(evidence) {
  exactKeys(
    evidence,
    [
      "evidenceVersion",
      "evidenceType",
      "generatedBy",
      "startedAt",
      "completedAt",
      "source",
      "artifact",
      "dumpClient",
      "snapshot",
      "release",
    ],
    "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
  );
  invariant(
    evidence.evidenceVersion === DUMP_EVIDENCE_VERSION &&
      evidence.evidenceType === "P16_DATABASE_DUMP" &&
      evidence.generatedBy === "scripts/p16-recovery.mjs",
    "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
  );
  const startedAt = normalizeTimestamp(evidence.startedAt, "P16_RECOVERY_DUMP_EVIDENCE_INVALID");
  const completedAt = normalizeTimestamp(
    evidence.completedAt,
    "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
  );
  invariant(completedAt >= startedAt, "P16_RECOVERY_DUMP_EVIDENCE_INVALID");
  exactKeys(evidence.source, ["environmentId", "database"], "P16_RECOVERY_DUMP_EVIDENCE_INVALID");
  exactKeys(
    evidence.source.database,
    ["hostname", "port", "name"],
    "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
  );
  invariant(
    evidence.source.environmentId === P16_STAGING_ENVIRONMENT_ID &&
      normalizeDatabaseHostname(evidence.source.database.hostname) ===
        evidence.source.database.hostname &&
      /^\d{1,5}$/u.test(evidence.source.database.port) &&
      SAFE_DATABASE_PATTERN.test(evidence.source.database.name) &&
      isStagingDatabaseName(evidence.source.database.name),
    "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
  );
  exactKeys(evidence.artifact, ["file", "bytes", "sha256"], "P16_RECOVERY_DUMP_EVIDENCE_INVALID");
  invariant(
    basename(evidence.artifact.file) === evidence.artifact.file &&
      evidence.artifact.file.toLowerCase().endsWith(".sql") &&
      Number.isSafeInteger(evidence.artifact.bytes) &&
      evidence.artifact.bytes > 0 &&
      SHA256_PATTERN.test(evidence.artifact.sha256),
    "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
  );
  exactKeys(
    evidence.dumpClient,
    ["family", "version", "executable"],
    "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
  );
  invariant(
    evidence.dumpClient.family === P16_DATABASE_DUMP_CLIENT &&
      /^\d+\.\d+\.\d+$/u.test(evidence.dumpClient.version) &&
      typeof evidence.dumpClient.executable === "string" &&
      evidence.dumpClient.executable.length > 0,
    "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
  );
  exactKeys(
    evidence.snapshot,
    ["mode", "transport", "tlsCaSha256"],
    "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
  );
  invariant(
    evidence.snapshot.mode === "SINGLE_TRANSACTION_NO_LOCKS" &&
      evidence.snapshot.transport === "TLS_VERIFIED" &&
      SHA256_PATTERN.test(evidence.snapshot.tlsCaSha256),
    "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
  );
  exactKeys(evidence.release, ["commit", "authority"], "P16_RECOVERY_DUMP_EVIDENCE_INVALID");
  invariant(
    COMMIT_PATTERN.test(evidence.release.commit) &&
      evidence.release.authority === "REPOSITORY_HEAD_BOUND",
    "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
  );
  return evidence;
}

async function loadDatabaseDumpEvidence(input) {
  const evidencePath = await canonicalExistingPath(
    input.databaseEvidencePath,
    "file",
    "P16_RECOVERY_DUMP_EVIDENCE_PATH_INVALID",
  );

  invariant(evidencePath.endsWith(".sql.evidence.json"), "P16_RECOVERY_DUMP_EVIDENCE_PATH_INVALID");

  let evidence;

  try {
    const text = await readFile(evidencePath, "utf8");

    invariant(
      Buffer.byteLength(text, "utf8") <= MAX_MANIFEST_BYTES,
      "P16_RECOVERY_DUMP_EVIDENCE_INVALID",
    );

    evidence = validateDumpEvidenceShape(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("P16_RECOVERY_DUMP_EVIDENCE_INVALID", {
        cause: error,
      });
    }

    throw error;
  }

  const dumpPath = await canonicalExistingPath(
    join(dirname(evidencePath), evidence.artifact.file),
    "file",
    "P16_RECOVERY_DATABASE_DUMP_PATH_INVALID",
  );

  invariant(
    `${dumpPath}.evidence.json` === evidencePath,
    "P16_RECOVERY_DUMP_EVIDENCE_ARTIFACT_MISMATCH",
  );

  const metadata = await lstat(dumpPath);

  invariant(
    metadata.size === evidence.artifact.bytes &&
      (await sha256File(dumpPath)) === evidence.artifact.sha256,
    "P16_RECOVERY_DUMP_EVIDENCE_ARTIFACT_MISMATCH",
  );

  const expected = input.expectedDatabaseConfiguration;

  invariant(
    expected !== null &&
      typeof expected === "object" &&
      typeof expected.environmentId === "string" &&
      typeof expected.hostname === "string" &&
      typeof expected.databaseName === "string" &&
      typeof expected.tlsCaFile === "string" &&
      typeof expected.dumpMode === "string",
    "P16_RECOVERY_DATABASE_EXPECTATION_INVALID",
  );

  const expectedTlsCaFile = await canonicalExistingPath(
    expected.tlsCaFile,
    "file",
    "P16_RECOVERY_DATABASE_CA_INVALID",
  );

  const expectedTlsCaSha256 = await sha256File(expectedTlsCaFile);

  invariant(
    evidence.source.environmentId === expected.environmentId &&
      evidence.source.database.hostname === expected.hostname &&
      String(evidence.source.database.port) === String(expected.port) &&
      evidence.source.database.name === expected.databaseName &&
      evidence.snapshot.mode === expected.dumpMode &&
      evidence.snapshot.transport === "TLS_VERIFIED" &&
      evidence.snapshot.tlsCaSha256 === expectedTlsCaSha256 &&
      evidence.dumpClient.family === "mariadb",
    "P16_RECOVERY_DATABASE_EVIDENCE_MISMATCH",
  );

  requireValidReleaseBinding(evidence.release.commit, input.resolveHead);

  return Object.freeze({
    evidence,
    dumpPath,
    evidencePath,
  });
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
      "resilience",
      "manifestIntegrity",
    ],
    "P16_RECOVERY_MANIFEST_INVALID",
  );
  assertSafeManifest(manifest);
  exactKeys(
    manifest.manifestIntegrity,
    ["algorithm", "keyId", "mac"],
    "P16_RECOVERY_MANIFEST_INTEGRITY_INVALID",
  );
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
    ["name", "snapshotMode", "dumpEvidence", "artifact"],
    "P16_RECOVERY_DATABASE_INVALID",
  );
  invariant(
    SAFE_DATABASE_PATTERN.test(manifest.database.name) &&
      isStagingDatabaseName(manifest.database.name) &&
      manifest.database.snapshotMode === "SINGLE_TRANSACTION_NO_LOCKS",
    "P16_RECOVERY_DATABASE_INVALID",
  );
  validateArtifactMetadata(manifest.database.artifact);
  validateDumpEvidenceShape(manifest.database.dumpEvidence);
  invariant(
    manifest.database.dumpEvidence.source.database.name === manifest.database.name &&
      manifest.database.dumpEvidence.release.commit === manifest.release.commit &&
      manifest.database.dumpEvidence.completedAt === manifest.createdAt &&
      manifest.database.dumpEvidence.artifact.bytes === manifest.database.artifact.plaintextBytes &&
      manifest.database.dumpEvidence.artifact.sha256 === manifest.database.artifact.plaintextSha256,
    "P16_RECOVERY_DATABASE_EVIDENCE_MISMATCH",
  );
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
  exactKeys(
    manifest.resilience,
    ["sourceFailureDomain", "independentCopyRequired", "independentCopyStatus"],
    "P16_RECOVERY_RESILIENCE_INVALID",
  );
  invariant(
    manifest.resilience.sourceFailureDomain === "cloudflare-r2" &&
      manifest.resilience.independentCopyRequired === true &&
      manifest.resilience.independentCopyStatus === "NOT_ATTESTED",
    "P16_RECOVERY_RESILIENCE_INVALID",
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
  invariant(KEY_ID_PATTERN.test(input.encryptionKeyId ?? ""), "P16_RECOVERY_KEY_ID_INVALID");
  const masterKey = normalizeMasterKey(input.encryptionKey);
  const keys = deriveRecoveryKeys(masterKey);
  const repositoryRoot = await canonicalExistingPath(
    input.repositoryRoot,
    "directory",
    "P16_RECOVERY_REPOSITORY_ROOT_INVALID",
  );
  const storageRoot = await canonicalExistingPath(
    input.storageRoot,
    "directory",
    "P16_RECOVERY_STORAGE_ROOT_INVALID",
  );
  const outputRoot = await canonicalProspectivePath(
    input.outputRoot,
    "P16_RECOVERY_OUTPUT_ROOT_INVALID",
  );
  const dump = await loadDatabaseDumpEvidence({
    databaseEvidencePath: input.databaseEvidencePath,
    expectedDatabaseConfiguration: input.expectedDatabaseConfiguration,
    resolveHead: input.resolveHead,
  });
  await assertOutsideRepository(
    storageRoot,
    repositoryRoot,
    "P16_RECOVERY_STORAGE_IN_REPOSITORY_REFUSED",
  );
  await assertOutsideRepository(
    dump.dumpPath,
    repositoryRoot,
    "P16_RECOVERY_DUMP_IN_REPOSITORY_REFUSED",
  );
  await assertOutsideRepository(
    dump.evidencePath,
    repositoryRoot,
    "P16_RECOVERY_DUMP_EVIDENCE_IN_REPOSITORY_REFUSED",
  );
  await assertOutsideRepository(
    outputRoot,
    repositoryRoot,
    "P16_RECOVERY_OUTPUT_IN_REPOSITORY_REFUSED",
  );
  const finalRoot = join(outputRoot, input.backupId);
  const partialRoot = join(outputRoot, `.${input.backupId}.partial-${randomUUID()}`);
  invariant(
    !isContainedPath(storageRoot, finalRoot) && !isContainedPath(finalRoot, storageRoot),
    "P16_RECOVERY_OUTPUT_OVERLAP",
  );
  invariant(
    !isContainedPath(dump.dumpPath, finalRoot) && !isContainedPath(finalRoot, dump.dumpPath),
    "P16_RECOVERY_OUTPUT_OVERLAP",
  );
  await mkdir(outputRoot, { recursive: true });
  await assertPathDoesNotExist(finalRoot, "P16_RECOVERY_BUNDLE_ALREADY_EXISTS");
  await mkdir(partialRoot, { recursive: false });
  try {
    const migrations = await collectP16MigrationMetadata(repositoryRoot);
    const databaseArtifact = await encryptFile(
      dump.dumpPath,
      join(partialRoot, "database", "database.sql.enc"),
      keys.artifactEncryptionKey,
      partialRoot,
    );
    const storageFiles = await enumerateStorage(storageRoot);
    const objectArtifacts = [];
    const index = [];
    for (const file of storageFiles) {
      const objectName = `${createHash("sha256").update(file.relativePath, "utf8").digest("hex")}.enc`;
      const destination = join(partialRoot, "storage", "objects", objectName);
      const artifact = await encryptFile(
        file.sourcePath,
        destination,
        keys.artifactEncryptionKey,
        partialRoot,
      );
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
      keys.artifactEncryptionKey,
      partialRoot,
    );
    const manifest = {
      manifestVersion: P16_RECOVERY_MANIFEST_VERSION,
      backupId: input.backupId,
      createdAt: dump.evidence.completedAt,
      source: { appEnv: "staging", environmentId: P16_STAGING_ENVIRONMENT_ID },
      release: { commit: dump.evidence.release.commit },
      database: {
        name: dump.evidence.source.database.name,
        snapshotMode: "SINGLE_TRANSACTION_NO_LOCKS",
        dumpEvidence: dump.evidence,
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
      resilience: {
        sourceFailureDomain: "cloudflare-r2",
        independentCopyRequired: true,
        independentCopyStatus: "NOT_ATTESTED",
      },
      manifestIntegrity: null,
    };
    authenticateManifest(manifest, keys.manifestAuthenticationKey, input.encryptionKeyId);
    validateManifest(manifest, {
      environmentId: P16_STAGING_ENVIRONMENT_ID,
      databaseName: dump.evidence.source.database.name,
      backupId: input.backupId,
      releaseCommit: dump.evidence.release.commit,
    });
    await writeFile(join(partialRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
    });
    await verifyP16RecoveryBundle(partialRoot, {
      encryptionKey: masterKey,
      encryptionKeyId: input.encryptionKeyId,
      repositoryRoot,
      environmentId: P16_STAGING_ENVIRONMENT_ID,
      databaseName: dump.evidence.source.database.name,
      backupId: input.backupId,
      releaseCommit: dump.evidence.release.commit,
    });
    await rename(partialRoot, finalRoot);
    return Object.freeze({ bundleDirectory: finalRoot, manifest: Object.freeze(manifest) });
  } catch (error) {
    await rm(partialRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function verifyP16RecoveryBundle(bundleDirectory, options) {
  const bundleRoot = await canonicalExistingPath(
    bundleDirectory,
    "directory",
    "P16_RECOVERY_BUNDLE_ROOT_INVALID",
  );
  await assertOutsideRepository(
    bundleRoot,
    options.repositoryRoot ?? process.cwd(),
    "P16_RECOVERY_BUNDLE_IN_REPOSITORY_REFUSED",
  );
  const keys = deriveRecoveryKeys(normalizeMasterKey(options.encryptionKey));
  let manifest;
  try {
    const manifestPath = await canonicalExistingPath(
      join(bundleRoot, "manifest.json"),
      "file",
      "P16_RECOVERY_MANIFEST_UNREADABLE",
    );
    const serialized = await readFile(manifestPath, "utf8");
    invariant(
      Buffer.byteLength(serialized, "utf8") <= MAX_MANIFEST_BYTES,
      "P16_RECOVERY_MANIFEST_UNREADABLE",
    );
    manifest = JSON.parse(serialized);
  } catch {
    throw new Error("P16_RECOVERY_MANIFEST_UNREADABLE");
  }
  verifyManifestAuthentication(manifest, keys.manifestAuthenticationKey, options.encryptionKeyId);
  validateManifest(manifest, options);
  await verifyCiphertext(bundleRoot, manifest.database.artifact);
  for (const artifact of manifest.privateStorage.objectArtifacts)
    await verifyCiphertext(bundleRoot, artifact);
  const indexBuffer = await decryptArtifactToBuffer(
    bundleRoot,
    manifest.privateStorage.indexArtifact,
    keys.artifactEncryptionKey,
  );
  const index = await parseStorageIndex(indexBuffer, manifest);
  await verifyArtifactPlaintext(bundleRoot, manifest.database.artifact, keys.artifactEncryptionKey);
  for (const entry of index) {
    const artifact = manifest.privateStorage.objectArtifacts.find(
      (candidate) => candidate.file === entry.artifactFile,
    );
    await verifyArtifactPlaintext(bundleRoot, artifact, keys.artifactEncryptionKey);
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
  const targetRoot = await canonicalProspectivePath(
    input.targetRoot,
    "P16_RESTORE_TARGET_ROOT_INVALID",
  );
  const bundleRoot = await canonicalExistingPath(
    input.bundleDirectory,
    "directory",
    "P16_RECOVERY_BUNDLE_ROOT_INVALID",
  );
  await assertOutsideRepository(
    targetRoot,
    input.repositoryRoot ?? process.cwd(),
    "P16_RESTORE_TARGET_IN_REPOSITORY_REFUSED",
  );
  invariant(
    !isContainedPath(bundleRoot, targetRoot) && !isContainedPath(targetRoot, bundleRoot),
    "P16_RESTORE_TARGET_OVERLAP",
  );
  await assertPathDoesNotExist(targetRoot, "P16_RESTORE_TARGET_EXISTS");
  const startedAt = new Date();
  const partialRoot = `${targetRoot}.partial-${randomUUID()}`;
  const verified = await verifyP16RecoveryBundle(bundleRoot, {
    encryptionKey: input.encryptionKey,
    encryptionKeyId: input.encryptionKeyId,
    repositoryRoot: input.repositoryRoot,
    environmentId: P16_STAGING_ENVIRONMENT_ID,
    databaseName: input.expectedSourceDatabaseName,
    backupId: input.expectedBackupId,
    releaseCommit: input.expectedReleaseCommit,
    migrationSetSha256: input.expectedMigrationSetSha256,
  });
  const key = deriveRecoveryKeys(normalizeMasterKey(input.encryptionKey)).artifactEncryptionKey;
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

export function calculateP16Rpo(input) {
  const observedAt = normalizeTimestamp(input.observedAt, "P16_RPO_OBSERVED_AT_INVALID");
  const backupAt = normalizeTimestamp(input.latestVerifiedBackupAt, "P16_RPO_BACKUP_AT_INVALID");
  invariant(backupAt.getTime() <= observedAt.getTime(), "P16_RPO_FUTURE_BACKUP_REFUSED");
  const ageMs = observedAt.getTime() - backupAt.getTime();
  return Object.freeze({
    assessment: ageMs <= P16_RPO_TARGET_MS ? "PASS" : "FAIL",
    targetMs: P16_RPO_TARGET_MS,
    targetSeconds: P16_RPO_TARGET_SECONDS,
    ageMs,
    ageSeconds: ageMs / 1000,
  });
}

export function measureP16Rpo(input) {
  if (input.latestVerifiedBackupAt === null || input.latestVerifiedBackupAt === undefined) {
    return Object.freeze({
      status: "UNKNOWN",
      targetMs: P16_RPO_TARGET_MS,
      targetSeconds: P16_RPO_TARGET_SECONDS,
      ageMs: null,
      ageSeconds: null,
      localAssessment: null,
      reason: "NO_DIAGNOSTIC_INPUT",
    });
  }
  const calculation = calculateP16Rpo(input);
  return Object.freeze({
    status: "UNKNOWN",
    targetMs: calculation.targetMs,
    targetSeconds: calculation.targetSeconds,
    ageMs: calculation.ageMs,
    ageSeconds: calculation.ageSeconds,
    localAssessment: calculation.assessment,
    reason: "RAW_INPUT_NOT_AUTHORITATIVE_HOSTED_EVIDENCE",
  });
}

export function evaluateP16HostedRpoEvidence(evidence) {
  exactKeys(
    evidence,
    [
      "evidenceType",
      "evidenceScope",
      "provenance",
      "executionAuthority",
      "executionContext",
      "rpoAuthority",
      "providerSchedulerAttestation",
      "outcome",
      "backupId",
      "observedAt",
      "latestVerifiedBackupAt",
    ],
    "P16_RPO_HOSTED_EVIDENCE_INVALID",
  );
  invariant(
    evidence.evidenceType === "P16_HOSTED_BACKUP_OBSERVATION" &&
      evidence.evidenceScope === "HOSTED_STAGING" &&
      evidence.provenance === "AUTOMATED_PROVIDER_OBSERVATION" &&
      evidence.executionAuthority === "PROVIDER_SCHEDULED_EXECUTION" &&
      evidence.executionContext === "PROVIDER_SCHEDULED" &&
      evidence.rpoAuthority === "AUTHORITATIVE_PROVIDER_SCHEDULER_CORRELATION" &&
      evidence.providerSchedulerAttestation === "INDEPENDENT_PROVIDER_HISTORY_VERIFIED" &&
      BACKUP_ID_PATTERN.test(evidence.backupId ?? "") &&
      evidence.outcome === "VERIFIED",
    "P16_RPO_HOSTED_EVIDENCE_INVALID",
  );
  const calculation = calculateP16Rpo(evidence);
  return Object.freeze({
    status: calculation.assessment,
    targetMs: calculation.targetMs,
    targetSeconds: calculation.targetSeconds,
    ageMs: calculation.ageMs,
    ageSeconds: calculation.ageSeconds,
    reason: calculation.assessment === "PASS" ? "WITHIN_TARGET" : "STALE_BACKUP",
  });
}

export function calculateP16Rto(input) {
  const startedAt = normalizeTimestamp(input.recoveryStartedAt, "P16_RTO_STARTED_AT_INVALID");
  const validatedAt = normalizeTimestamp(input.recoveryValidatedAt, "P16_RTO_VALIDATED_AT_INVALID");
  invariant(validatedAt.getTime() >= startedAt.getTime(), "P16_RTO_INTERVAL_INVALID");
  const durationMs = validatedAt.getTime() - startedAt.getTime();
  return Object.freeze({
    assessment: durationMs <= P16_RTO_TARGET_MS ? "PASS" : "FAIL",
    targetMs: P16_RTO_TARGET_MS,
    targetSeconds: P16_RTO_TARGET_SECONDS,
    durationMs,
    durationSeconds: durationMs / 1000,
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
      targetMs: P16_RTO_TARGET_MS,
      targetSeconds: P16_RTO_TARGET_SECONDS,
      durationMs: null,
      durationSeconds: null,
      localAssessment: null,
      reason: "NO_VALIDATED_RECOVERY_EVIDENCE",
    });
  }
  const calculation = calculateP16Rto(input);
  return Object.freeze({
    status: "UNKNOWN",
    targetMs: calculation.targetMs,
    targetSeconds: calculation.targetSeconds,
    durationMs: calculation.durationMs,
    durationSeconds: calculation.durationSeconds,
    localAssessment: calculation.assessment,
    reason: "RAW_INPUT_NOT_AUTHORITATIVE_HOSTED_EVIDENCE",
  });
}

export function evaluateP16HostedRtoEvidence(evidence) {
  const failureCode = "P16_RTO_HOSTED_EVIDENCE_INVALID";
  invariant(evidence && typeof evidence === "object" && !Array.isArray(evidence), failureCode);

  if (evidence.provenance === "AUTOMATED_RECOVERY_RUN") {
    exactKeys(
      evidence,
      [
        "evidenceType",
        "evidenceScope",
        "provenance",
        "validationOutcome",
        "recoveryStartedAt",
        "recoveryValidatedAt",
      ],
      failureCode,
    );
  } else if (evidence.provenance === "CONTROLLED_OPERATOR_ASSISTED_RECOVERY_RUN") {
    exactKeys(
      evidence,
      [
        "evidenceType",
        "evidenceScope",
        "provenance",
        "validationOutcome",
        "recoveryStartedAt",
        "recoveryValidatedAt",
        "timestampAuthority",
        "providerPrivilegeRotationRequired",
        "providerPrivilegeRotationMode",
        "databaseRestoreValidation",
        "r2RestoreValidation",
        "finalRuntimePrivilegeValidation",
        "authenticatedHostedReadiness",
        "hostedSmokeValidation",
      ],
      failureCode,
    );
    invariant(
      evidence.timestampAuthority === "RECOVERY_CONTROLLER" &&
        evidence.providerPrivilegeRotationRequired === true &&
        evidence.providerPrivilegeRotationMode === "EXTERNAL_PROVIDER_CONTROL" &&
        evidence.databaseRestoreValidation === "VALIDATED" &&
        evidence.r2RestoreValidation === "VALIDATED" &&
        evidence.finalRuntimePrivilegeValidation === "VALIDATED" &&
        evidence.authenticatedHostedReadiness === "PASS" &&
        evidence.hostedSmokeValidation === "PASS",
      failureCode,
    );
  } else {
    invariant(false, failureCode);
  }

  invariant(
    evidence.evidenceType === "P16_HOSTED_RECOVERY_VALIDATION" &&
      evidence.evidenceScope === "HOSTED_STAGING" &&
      evidence.validationOutcome === "VALIDATED",
    failureCode,
  );
  const calculation = calculateP16Rto(evidence);
  return Object.freeze({
    status: calculation.assessment,
    targetMs: calculation.targetMs,
    targetSeconds: calculation.targetSeconds,
    durationMs: calculation.durationMs,
    durationSeconds: calculation.durationSeconds,
    reason: calculation.assessment === "PASS" ? "WITHIN_TARGET" : "RECOVERY_EXCEEDED_TARGET",
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
