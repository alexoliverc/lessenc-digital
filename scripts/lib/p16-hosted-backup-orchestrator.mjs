import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import process from "node:process";
import { pipeline } from "node:stream/promises";
import { URL } from "node:url";

import { planBackupRetention } from "./p16-backup-retention.mjs";
import {
  P16_STAGING_ENVIRONMENT_ID,
  createP16RecoveryBundle,
  createStagingDatabaseDump,
  decodeRecoveryEncryptionKey,
  measureP16Rpo,
  validateStagingDatabaseBackupEnvironment,
  verifyP16RecoveryBundle,
} from "./p16-recovery.mjs";

const BACKUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const RELEASE_COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const BUCKET_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/u;
const RUN_HISTORY_VERSION = 2;
const MANUAL_AUTHORITY = "CONTROLLED_MANUAL_EXECUTION";
const SCHEDULED_AUTHORITY = "PROVIDER_SCHEDULED_EXECUTION";
const MANUAL_EXECUTION_CONTEXT = "CONTROLLED_MANUAL";
const SCHEDULED_EXECUTION_CONTEXT = "PROVIDER_SCHEDULED";
const MANUAL_OBSERVATION_PROVENANCE = "MANUAL_CONTROLLED_OBSERVATION";
const SCHEDULED_OBSERVATION_PROVENANCE = "AUTOMATED_PROVIDER_OBSERVATION";
const MANUAL_RPO_AUTHORITY = "NOT_AUTHORITATIVE";
const SCHEDULED_RPO_AUTHORITY = "PENDING_PROVIDER_SCHEDULER_CORRELATION";
const MANUAL_PROVIDER_ATTESTATION = "NOT_APPLICABLE_MANUAL_EXECUTION";
const SCHEDULED_PROVIDER_ATTESTATION = "PENDING_INDEPENDENT_PROVIDER_HISTORY";
const SDK_PACKAGE = "@aws-sdk/client-s3";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, expected, failureCode) {
  invariant(value && typeof value === "object" && !Array.isArray(value), failureCode);
  invariant(Object.keys(value).sort().join(",") === [...expected].sort().join(","), failureCode);
}

function isContainedPath(parent, child) {
  const candidate = relative(parent, child);
  return candidate === "" || (!candidate.startsWith("..") && !isAbsolute(candidate));
}

function pathsOverlap(left, right) {
  return isContainedPath(left, right) || isContainedPath(right, left);
}

function normalizeTimestamp(value, failureCode) {
  const serialized = value instanceof Date ? value.toISOString() : value;
  invariant(typeof serialized === "string" && UTC_TIMESTAMP_PATTERN.test(serialized), failureCode);
  const date = new Date(serialized);
  invariant(!Number.isNaN(date.getTime()) && date.toISOString() === serialized, failureCode);
  return date;
}

function stableFailureCode(error) {
  const message = error instanceof Error ? error.message : "";
  return message.match(/^(P16_[A-Z0-9_]+)/u)?.[1] ?? "P16_HOSTED_BACKUP_FAILED";
}

function executionProfile(authority) {
  if (authority === MANUAL_AUTHORITY) {
    return Object.freeze({
      executionContext: MANUAL_EXECUTION_CONTEXT,
      observationProvenance: MANUAL_OBSERVATION_PROVENANCE,
      rpoAuthority: MANUAL_RPO_AUTHORITY,
      providerSchedulerAttestation: MANUAL_PROVIDER_ATTESTATION,
    });
  }
  if (authority === SCHEDULED_AUTHORITY) {
    return Object.freeze({
      executionContext: SCHEDULED_EXECUTION_CONTEXT,
      observationProvenance: SCHEDULED_OBSERVATION_PROVENANCE,
      rpoAuthority: SCHEDULED_RPO_AUTHORITY,
      providerSchedulerAttestation: SCHEDULED_PROVIDER_ATTESTATION,
    });
  }
  throw new Error("P16_HOSTED_BACKUP_EXECUTION_AUTHORITY_INVALID");
}

export function resolveHostedBackupCliExecutionAuthority(mode, unexpected = []) {
  invariant(Array.isArray(unexpected) && unexpected.length === 0, "P16_HOSTED_BACKUP_MODE_INVALID");
  if (mode === "run-manual") return MANUAL_AUTHORITY;
  if (mode === "run-scheduled") return SCHEDULED_AUTHORITY;
  throw new Error("P16_HOSTED_BACKUP_MODE_INVALID");
}

async function canonicalExistingDirectory(
  path,
  failureCode,
  platform = process.platform,
  requirePrivate = true,
) {
  invariant(typeof path === "string" && isAbsolute(path), failureCode);
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (error) {
    throw new Error(failureCode, { cause: error });
  }
  invariant(metadata.isDirectory() && !metadata.isSymbolicLink(), failureCode);
  if (requirePrivate && platform !== "win32") {
    invariant((metadata.mode & 0o077) === 0, failureCode);
  }
  return realpath(path);
}

async function canonicalProspectiveFile(path, failureCode, platform = process.platform) {
  invariant(typeof path === "string" && isAbsolute(path), failureCode);
  const parent = await canonicalExistingDirectory(dirname(path), failureCode, platform);
  const target = join(parent, basename(path));
  try {
    const metadata = await lstat(target);
    invariant(metadata.isFile() && !metadata.isSymbolicLink(), failureCode);
  } catch (error) {
    if (!(error && typeof error === "object" && error.code === "ENOENT")) throw error;
  }
  return target;
}

function assertSeparateRoots(roots, repositoryRoot) {
  for (const root of roots) {
    invariant(!pathsOverlap(root, repositoryRoot), "P16_HOSTED_BACKUP_PATH_IN_REPOSITORY_REFUSED");
  }
  for (let left = 0; left < roots.length; left += 1) {
    for (let right = left + 1; right < roots.length; right += 1) {
      invariant(!pathsOverlap(roots[left], roots[right]), "P16_HOSTED_BACKUP_PATH_OVERLAP");
    }
  }
}

function validateR2Configuration(env) {
  let endpoint;
  try {
    endpoint = new URL(env.PRIVATE_STORAGE_S3_ENDPOINT);
  } catch {
    throw new Error("P16_HOSTED_BACKUP_S3_ENDPOINT_INVALID");
  }
  invariant(
    endpoint.protocol === "https:" &&
      endpoint.username === "" &&
      endpoint.password === "" &&
      endpoint.search === "" &&
      endpoint.hash === "",
    "P16_HOSTED_BACKUP_S3_ENDPOINT_INVALID",
  );
  invariant(env.PRIVATE_STORAGE_S3_REGION === "auto", "P16_HOSTED_BACKUP_S3_REGION_INVALID");
  invariant(
    BUCKET_PATTERN.test(env.PRIVATE_STORAGE_S3_BUCKET ?? ""),
    "P16_HOSTED_BACKUP_BUCKET_INVALID",
  );
  invariant(
    typeof env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID === "string" &&
      env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID.length >= 16 &&
      env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID.length <= 128,
    "P16_HOSTED_BACKUP_S3_ACCESS_KEY_INVALID",
  );
  invariant(
    typeof env.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY === "string" &&
      env.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY.length >= 32 &&
      env.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY.length <= 256,
    "P16_HOSTED_BACKUP_S3_SECRET_INVALID",
  );
}

export async function validateHostedBackupOrchestratorConfiguration(input) {
  const { env } = input;
  invariant(env && typeof env === "object", "P16_HOSTED_BACKUP_ENV_INVALID");
  const execution = executionProfile(input.executionAuthority);
  invariant(
    KEY_ID_PATTERN.test(env.P16_BACKUP_ENCRYPTION_KEY_ID ?? ""),
    "P16_RECOVERY_KEY_ID_INVALID",
  );
  invariant(
    RELEASE_COMMIT_PATTERN.test(env.P16_RELEASE_COMMIT ?? ""),
    "P16_RELEASE_COMMIT_INVALID",
  );
  const encryptionKey = decodeRecoveryEncryptionKey(env.P16_BACKUP_ENCRYPTION_KEY);
  validateR2Configuration(env);

  const repositoryRoot = await canonicalExistingDirectory(
    resolve(input.repositoryRoot),
    "P16_HOSTED_BACKUP_REPOSITORY_ROOT_INVALID",
    input.platform,
    false,
  );
  const workRoot = await canonicalExistingDirectory(
    env.P16_HOSTED_BACKUP_WORK_ROOT,
    "P16_HOSTED_BACKUP_WORK_ROOT_INVALID",
    input.platform,
  );
  const outputRoot = await canonicalExistingDirectory(
    env.P16_HOSTED_BACKUP_OUTPUT_ROOT,
    "P16_HOSTED_BACKUP_OUTPUT_ROOT_INVALID",
    input.platform,
  );
  const runHistoryRoot = await canonicalExistingDirectory(
    env.P16_HOSTED_BACKUP_RUN_HISTORY_ROOT,
    "P16_HOSTED_BACKUP_HISTORY_ROOT_INVALID",
    input.platform,
  );
  assertSeparateRoots([workRoot, outputRoot, runHistoryRoot], repositoryRoot);
  const indexFile = await canonicalProspectiveFile(
    env.P16_BACKUP_INDEX_FILE,
    "P16_HOSTED_BACKUP_INDEX_FILE_INVALID",
    input.platform,
  );
  invariant(!pathsOverlap(indexFile, workRoot), "P16_HOSTED_BACKUP_PATH_OVERLAP");
  invariant(!pathsOverlap(indexFile, outputRoot), "P16_HOSTED_BACKUP_PATH_OVERLAP");
  invariant(
    !isContainedPath(repositoryRoot, indexFile),
    "P16_HOSTED_BACKUP_PATH_IN_REPOSITORY_REFUSED",
  );

  if (env.P16_HOSTED_NODE_RUNTIME_PACKAGE_JSON !== undefined) {
    invariant(
      isAbsolute(env.P16_HOSTED_NODE_RUNTIME_PACKAGE_JSON),
      "P16_HOSTED_BACKUP_RUNTIME_ANCHOR_INVALID",
    );
  }

  return Object.freeze({
    repositoryRoot,
    workRoot,
    outputRoot,
    runHistoryRoot,
    indexFile,
    runtimePackageJson: env.P16_HOSTED_NODE_RUNTIME_PACKAGE_JSON,
    encryptionKey,
    encryptionKeyId: env.P16_BACKUP_ENCRYPTION_KEY_ID,
    releaseCommit: env.P16_RELEASE_COMMIT,
    execution,
    s3: Object.freeze({
      endpoint: env.PRIVATE_STORAGE_S3_ENDPOINT,
      region: env.PRIVATE_STORAGE_S3_REGION,
      bucket: env.PRIVATE_STORAGE_S3_BUCKET,
      accessKeyId: env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID,
      secretAccessKey: env.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY,
    }),
  });
}

function hasRequiredSdkCapabilities(candidate) {
  return (
    candidate &&
    typeof candidate.S3Client === "function" &&
    typeof candidate.ListObjectsV2Command === "function" &&
    typeof candidate.GetObjectCommand === "function"
  );
}

function packageWasNotResolved(error) {
  return (
    error &&
    typeof error === "object" &&
    error.code === "MODULE_NOT_FOUND" &&
    typeof error.message === "string" &&
    error.message.includes(SDK_PACKAGE)
  );
}

function selectSdkCapabilities(candidate, resolution) {
  invariant(hasRequiredSdkCapabilities(candidate), "P16_HOSTED_BACKUP_AWS_SDK_CAPABILITY_MISSING");
  return Object.freeze({
    S3Client: candidate.S3Client,
    ListObjectsV2Command: candidate.ListObjectsV2Command,
    GetObjectCommand: candidate.GetObjectCommand,
    resolution,
  });
}

async function assertRuntimeAnchor(anchor) {
  invariant(
    typeof anchor === "string" && isAbsolute(anchor),
    "P16_HOSTED_BACKUP_RUNTIME_ANCHOR_REQUIRED",
  );
  let metadata;
  try {
    metadata = await lstat(anchor);
  } catch (error) {
    throw new Error("P16_HOSTED_BACKUP_RUNTIME_ANCHOR_INVALID", { cause: error });
  }
  invariant(
    metadata.isFile() && !metadata.isSymbolicLink(),
    "P16_HOSTED_BACKUP_RUNTIME_ANCHOR_INVALID",
  );
}

export async function resolveS3SdkCapabilities(input) {
  const createRequireImpl = input.createRequire ?? createRequire;
  const localAnchor = resolve(input.repositoryPackageJson);
  let localModule;
  try {
    localModule = createRequireImpl(localAnchor)(SDK_PACKAGE);
  } catch (error) {
    if (!packageWasNotResolved(error)) {
      throw new Error("P16_HOSTED_BACKUP_AWS_SDK_LOAD_FAILED", { cause: error });
    }
  }
  if (localModule !== undefined) {
    return selectSdkCapabilities(localModule, "repository");
  }

  await (input.assertRuntimeAnchor ?? assertRuntimeAnchor)(input.runtimePackageJson);
  let hostedModule;
  try {
    hostedModule = createRequireImpl(input.runtimePackageJson)(SDK_PACKAGE);
  } catch (error) {
    throw new Error("P16_HOSTED_BACKUP_AWS_SDK_LOAD_FAILED", { cause: error });
  }
  return selectSdkCapabilities(hostedModule, "runtime-anchor");
}

function normalizeObjectKey(key) {
  invariant(typeof key === "string" && key.length > 0, "P16_HOSTED_BACKUP_OBJECT_KEY_UNSAFE");
  invariant(
    !key.startsWith("/") &&
      !/^[A-Za-z]:/u.test(key) &&
      !key.includes("\\") &&
      [...key].every((character) => {
        const codePoint = character.codePointAt(0);
        return codePoint !== undefined && codePoint >= 32 && codePoint !== 127;
      }),
    "P16_HOSTED_BACKUP_OBJECT_KEY_UNSAFE",
  );
  const segments = key.split("/");
  invariant(
    segments.every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    "P16_HOSTED_BACKUP_OBJECT_KEY_UNSAFE",
  );
  return segments.join("/");
}

async function* normalizedBody(body) {
  if (body && typeof body[Symbol.asyncIterator] === "function") {
    for await (const value of body) {
      invariant(
        typeof value === "string" || value instanceof Uint8Array,
        "P16_HOSTED_BACKUP_OBJECT_BODY_INVALID",
      );
      yield typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
    }
    return;
  }
  if (body instanceof Uint8Array) {
    yield Buffer.from(body);
    return;
  }
  if (body && typeof body.transformToWebStream === "function") {
    const stream = body.transformToWebStream();
    const reader = stream.getReader();
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) return;
        yield Buffer.from(result.value);
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    throw new Error("P16_HOSTED_BACKUP_OBJECT_BODY_INVALID");
  }
}

async function ensureMaterializationParent(snapshotRoot, destination) {
  const parent = dirname(destination);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  let current = parent;
  while (true) {
    const metadata = await lstat(current);
    invariant(
      metadata.isDirectory() && !metadata.isSymbolicLink(),
      "P16_HOSTED_BACKUP_SNAPSHOT_PATH_UNSAFE",
    );
    if (current === snapshotRoot) return;
    const next = dirname(current);
    invariant(
      next !== current && isContainedPath(snapshotRoot, next),
      "P16_HOSTED_BACKUP_SNAPSHOT_PATH_UNSAFE",
    );
    current = next;
  }
}

export async function materializeR2Snapshot(input) {
  const destinationRoot = resolve(input.destinationRoot);
  const rootMetadata = await lstat(destinationRoot);
  invariant(
    rootMetadata.isDirectory() && !rootMetadata.isSymbolicLink(),
    "P16_HOSTED_BACKUP_SNAPSHOT_ROOT_INVALID",
  );
  const snapshotRoot = await realpath(destinationRoot);
  const keys = [];
  const seenKeys = new Set();
  const seenTokens = new Set();
  let continuationToken;
  do {
    const response = await input.client.send(
      new input.ListObjectsV2Command({
        Bucket: input.bucket,
        ...(continuationToken === undefined ? {} : { ContinuationToken: continuationToken }),
      }),
    );
    invariant(response && typeof response === "object", "P16_HOSTED_BACKUP_LIST_RESPONSE_INVALID");
    const contents = response.Contents ?? [];
    invariant(Array.isArray(contents), "P16_HOSTED_BACKUP_LIST_RESPONSE_INVALID");
    for (const entry of contents) {
      const key = normalizeObjectKey(entry?.Key);
      invariant(!seenKeys.has(key), "P16_HOSTED_BACKUP_DUPLICATE_OBJECT_KEY");
      seenKeys.add(key);
      keys.push(key);
    }
    if (response.IsTruncated === true) {
      const nextToken = response.NextContinuationToken;
      invariant(
        typeof nextToken === "string" && nextToken.length > 0 && !seenTokens.has(nextToken),
        "P16_HOSTED_BACKUP_PAGINATION_INVALID",
      );
      seenTokens.add(nextToken);
      continuationToken = nextToken;
    } else {
      continuationToken = undefined;
    }
  } while (continuationToken !== undefined);

  keys.sort((left, right) => left.localeCompare(right, "en"));
  let totalBytes = 0;
  for (const key of keys) {
    const destination = resolve(snapshotRoot, ...key.split("/"));
    invariant(
      isContainedPath(snapshotRoot, destination) && destination !== snapshotRoot,
      "P16_HOSTED_BACKUP_OBJECT_KEY_UNSAFE",
    );
    await ensureMaterializationParent(snapshotRoot, destination);
    const response = await input.client.send(
      new input.GetObjectCommand({ Bucket: input.bucket, Key: key }),
    );
    let objectBytes = 0;
    let destinationHandle;
    let destinationCreated = false;
    try {
      destinationHandle = await open(destination, "wx", 0o600);
      destinationCreated = true;
      await pipeline(
        normalizedBody(response?.Body),
        async function* countBytes(source) {
          for await (const chunk of source) {
            objectBytes += chunk.length;
            yield chunk;
          }
        },
        destinationHandle.createWriteStream(),
      );
      destinationHandle = undefined;
      if (response.ContentLength !== undefined) {
        invariant(
          Number.isSafeInteger(response.ContentLength) && response.ContentLength === objectBytes,
          "P16_HOSTED_BACKUP_OBJECT_LENGTH_MISMATCH",
        );
      }
      totalBytes += objectBytes;
    } catch (error) {
      if (destinationHandle) {
        try {
          await destinationHandle.close();
        } catch {
          // The stream may already have closed the handle while propagating its failure.
        }
      }
      if (destinationCreated) await rm(destination, { force: true });
      if (error instanceof Error && error.message.startsWith("P16_")) throw error;
      throw new Error("P16_HOSTED_BACKUP_OBJECT_MATERIALIZATION_FAILED", { cause: error });
    }
  }
  return Object.freeze({ objectCount: keys.length, totalBytes, objectKeys: Object.freeze(keys) });
}

export function createHostedBackupId(input = {}) {
  const timestamp = normalizeTimestamp(input.now ?? new Date(), "P16_HOSTED_BACKUP_CLOCK_INVALID")
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(".", "");
  const suffix = input.randomSuffix ?? randomUUID().replaceAll("-", "");
  invariant(/^[a-z0-9]{8,32}$/u.test(suffix), "P16_HOSTED_BACKUP_RANDOM_SUFFIX_INVALID");
  const backupId = `p16-hosted-auto-${timestamp}-${suffix}`;
  invariant(BACKUP_ID_PATTERN.test(backupId), "P16_HOSTED_BACKUP_ID_INVALID");
  return backupId;
}

async function readRetentionIndex(indexFile, now) {
  let source;
  try {
    source = JSON.parse(await readFile(indexFile, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return [];
    throw new Error("P16_HOSTED_BACKUP_INDEX_INVALID", { cause: error });
  }
  invariant(Array.isArray(source), "P16_RETENTION_INDEX_INVALID");
  for (const entry of source) {
    exactKeys(entry, ["id", "createdAt"], "P16_RETENTION_ENTRY_INVALID");
  }
  planBackupRetention(source, { now });
  return source;
}

async function writeReplacementJsonAtomic(path, value, randomId = randomUUID) {
  const temporary = join(dirname(path), `.${basename(path)}.partial-${randomId()}`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function writeExclusiveJsonAtomic(path, value, randomId = randomUUID) {
  const temporary = join(dirname(path), `.${basename(path)}.partial-${randomId()}`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    await link(temporary, path);
    await unlink(temporary);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function acquireBackupIndexLock(indexFile) {
  const lockPath = `${indexFile}.lock`;
  try {
    const handle = await open(lockPath, "wx", 0o600);
    return Object.freeze({ handle, lockPath });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      throw new Error("P16_HOSTED_BACKUP_INDEX_LOCKED", { cause: error });
    }
    throw new Error("P16_HOSTED_BACKUP_INDEX_LOCK_FAILED", { cause: error });
  }
}

async function releaseBackupIndexLock(lock) {
  try {
    await lock.handle.close();
    await unlink(lock.lockPath);
  } catch (error) {
    throw new Error("P16_HOSTED_BACKUP_INDEX_LOCK_CLEANUP_FAILED", { cause: error });
  }
}

export async function updateBackupIndexAtomic(input) {
  const lock = await acquireBackupIndexLock(input.indexFile);
  let result;
  let operationError;
  try {
    const createdAt = normalizeTimestamp(
      input.createdAt,
      "P16_RETENTION_CREATED_AT_INVALID",
    ).toISOString();
    const current = await readRetentionIndex(input.indexFile, input.now ?? createdAt);
    invariant(
      !current.some((entry) => entry.id === input.backupId),
      "P16_RETENTION_DUPLICATE_BACKUP_ID",
    );
    const updated = [...current, { id: input.backupId, createdAt }];
    planBackupRetention(updated, { now: input.now ?? createdAt });
    updated.sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
        left.id.localeCompare(right.id, "en"),
    );
    await (input.writeJsonAtomic ?? writeReplacementJsonAtomic)(input.indexFile, updated);
    result = Object.freeze(updated.map((entry) => Object.freeze({ ...entry })));
  } catch (error) {
    operationError = error;
  }

  try {
    await releaseBackupIndexLock(lock);
  } catch (error) {
    operationError ??= error;
  }
  if (operationError) throw operationError;
  return result;
}

async function removeBrokenBundle(bundleDirectory, outputRoot, backupId) {
  const expected = join(outputRoot, backupId);
  invariant(resolve(bundleDirectory) === expected, "P16_HOSTED_BACKUP_BUNDLE_CLEANUP_REFUSED");
  const metadata = await lstat(expected);
  invariant(
    metadata.isDirectory() && !metadata.isSymbolicLink(),
    "P16_HOSTED_BACKUP_BUNDLE_CLEANUP_REFUSED",
  );
  await rm(expected, { recursive: true, force: false });
}

export async function cleanupHostedBackupWorkspace(input) {
  const workspace = resolve(input.workspace);
  const workRoot = await realpath(input.workRoot);
  const repositoryRoot = await realpath(input.repositoryRoot);
  const outputRoot = await realpath(input.outputRoot);
  invariant(workspace !== parse(workspace).root, "P16_HOSTED_BACKUP_WORKSPACE_CLEANUP_REFUSED");
  invariant(workspace !== resolve(homedir()), "P16_HOSTED_BACKUP_WORKSPACE_CLEANUP_REFUSED");
  invariant(dirname(workspace) === workRoot, "P16_HOSTED_BACKUP_WORKSPACE_CLEANUP_REFUSED");
  invariant(
    basename(workspace).startsWith("run-p16-hosted-auto-"),
    "P16_HOSTED_BACKUP_WORKSPACE_CLEANUP_REFUSED",
  );
  invariant(
    !pathsOverlap(workspace, repositoryRoot) && !pathsOverlap(workspace, outputRoot),
    "P16_HOSTED_BACKUP_WORKSPACE_CLEANUP_REFUSED",
  );
  const metadata = await lstat(workspace);
  invariant(
    metadata.isDirectory() && !metadata.isSymbolicLink(),
    "P16_HOSTED_BACKUP_WORKSPACE_CLEANUP_REFUSED",
  );
  const canonicalWorkspace = await realpath(workspace);
  invariant(
    dirname(canonicalWorkspace) === workRoot,
    "P16_HOSTED_BACKUP_WORKSPACE_CLEANUP_REFUSED",
  );
  await rm(canonicalWorkspace, { recursive: true, force: false });
}

function createRunHistory(input) {
  return Object.freeze({
    historyVersion: RUN_HISTORY_VERSION,
    evidenceType: "P16_HOSTED_BACKUP_RUN",
    executionContext: input.executionContext,
    observationProvenance: input.observationProvenance,
    rpoAuthority: input.rpoAuthority,
    providerSchedulerAttestation: input.providerSchedulerAttestation,
    backupId: input.backupId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    outcome: input.outcome,
    releaseCommit: input.releaseCommit,
    objectCount: input.objectCount,
    totalSnapshotBytes: input.totalSnapshotBytes,
    verifiedBackupAt: input.verifiedBackupAt,
    failureCode: input.failureCode,
  });
}

export async function runP16HostedBackupOrchestrator(input, dependencies = {}) {
  const clock = dependencies.clock ?? (() => new Date());
  const startedAt = normalizeTimestamp(clock(), "P16_HOSTED_BACKUP_CLOCK_INVALID").toISOString();
  const configuration = await validateHostedBackupOrchestratorConfiguration({
    env: input.env,
    repositoryRoot: input.repositoryRoot,
    executionAuthority: input.executionAuthority,
    platform: dependencies.platform,
  });
  const databaseConfiguration = await (
    dependencies.validateDatabaseEnvironment ?? validateStagingDatabaseBackupEnvironment
  )(input.env);
  const sdk = await (dependencies.resolveS3Sdk ?? resolveS3SdkCapabilities)({
    repositoryPackageJson: join(configuration.repositoryRoot, "package.json"),
    runtimePackageJson: configuration.runtimePackageJson,
  });
  const backupId = createHostedBackupId({
    now: startedAt,
    randomSuffix: dependencies.randomSuffix?.(),
  });
  const workspace = join(configuration.workRoot, `run-${backupId}`);
  const dumpPath = join(workspace, "database", "staging.sql");
  const snapshotRoot = join(workspace, "r2-snapshot");
  const historyPath = join(configuration.runHistoryRoot, `${backupId}.run.json`);
  const observationPath = join(configuration.runHistoryRoot, `${backupId}.observation.json`);
  let workspaceCreated = false;
  let bundleDirectory;
  let bundleVerified = false;
  let snapshot = { objectCount: 0, totalBytes: 0 };
  let verifiedBackupAt = null;
  let result;
  let operationError;
  let history;

  try {
    await mkdir(workspace, { recursive: false, mode: 0o700 });
    workspaceCreated = true;
    if (process.platform !== "win32") await chmod(workspace, 0o700);
    await mkdir(snapshotRoot, { recursive: false, mode: 0o700 });
    const databaseDump = await (dependencies.createDatabaseDump ?? createStagingDatabaseDump)({
      env: input.env,
      destinationPath: dumpPath,
      repositoryRoot: configuration.repositoryRoot,
      resolveHead: dependencies.resolveHead,
      clock,
    });
    const client = (
      dependencies.createS3Client ??
      ((resolvedSdk, s3) =>
        new resolvedSdk.S3Client({
          endpoint: s3.endpoint,
          region: s3.region,
          credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
        }))
    )(sdk, configuration.s3);
    snapshot = await (dependencies.materializeSnapshot ?? materializeR2Snapshot)({
      client,
      ListObjectsV2Command: sdk.ListObjectsV2Command,
      GetObjectCommand: sdk.GetObjectCommand,
      bucket: configuration.s3.bucket,
      destinationRoot: snapshotRoot,
    });
    const bundle = await (dependencies.createBundle ?? createP16RecoveryBundle)({
      backupId,
      databaseEvidencePath: databaseDump.evidencePath,
      expectedDatabaseConfiguration: databaseConfiguration,
      storageRoot: snapshotRoot,
      outputRoot: configuration.outputRoot,
      repositoryRoot: configuration.repositoryRoot,
      encryptionKey: configuration.encryptionKey,
      encryptionKeyId: configuration.encryptionKeyId,
      resolveHead: dependencies.resolveHead,
    });
    bundleDirectory = bundle.bundleDirectory;
    let verified;
    try {
      verified = await (dependencies.verifyBundle ?? verifyP16RecoveryBundle)(bundleDirectory, {
        encryptionKey: configuration.encryptionKey,
        encryptionKeyId: configuration.encryptionKeyId,
        repositoryRoot: configuration.repositoryRoot,
        environmentId: P16_STAGING_ENVIRONMENT_ID,
        databaseName: databaseConfiguration.databaseName,
        backupId,
        releaseCommit: configuration.releaseCommit,
      });
      bundleVerified = true;
    } catch (error) {
      await (dependencies.removeBrokenBundle ?? removeBrokenBundle)(
        bundleDirectory,
        configuration.outputRoot,
        backupId,
      );
      throw error;
    }
    verifiedBackupAt = normalizeTimestamp(
      verified.manifest.createdAt,
      "P16_HOSTED_BACKUP_VERIFIED_TIMESTAMP_INVALID",
    ).toISOString();
    const observedAt = normalizeTimestamp(clock(), "P16_HOSTED_BACKUP_CLOCK_INVALID").toISOString();
    const observation = Object.freeze({
      evidenceType: "P16_HOSTED_BACKUP_OBSERVATION",
      evidenceScope: "HOSTED_STAGING",
      provenance: configuration.execution.observationProvenance,
      outcome: "VERIFIED",
      observedAt,
      latestVerifiedBackupAt: verifiedBackupAt,
    });
    const rpoEvaluation = (dependencies.measureRpo ?? measureP16Rpo)({
      observedAt,
      latestVerifiedBackupAt: verifiedBackupAt,
      evidenceScope: configuration.execution.executionContext,
    });
    const rpo =
      configuration.execution.executionContext === SCHEDULED_EXECUTION_CONTEXT
        ? Object.freeze({
            ...rpoEvaluation,
            status: "UNKNOWN",
            candidateAssessment: rpoEvaluation.localAssessment,
            reason: "PROVIDER_SCHEDULER_ATTESTATION_PENDING",
          })
        : rpoEvaluation;
    await (dependencies.writeObservation ?? writeExclusiveJsonAtomic)(observationPath, observation);
    await (dependencies.updateIndex ?? updateBackupIndexAtomic)({
      indexFile: configuration.indexFile,
      backupId,
      createdAt: verifiedBackupAt,
      now: observedAt,
    });
    const completedAt = normalizeTimestamp(
      clock(),
      "P16_HOSTED_BACKUP_CLOCK_INVALID",
    ).toISOString();
    history = createRunHistory({
      ...configuration.execution,
      backupId,
      startedAt,
      completedAt,
      outcome: "SUCCESS",
      releaseCommit: configuration.releaseCommit,
      objectCount: snapshot.objectCount,
      totalSnapshotBytes: snapshot.totalBytes,
      verifiedBackupAt,
      failureCode: null,
    });
    await (dependencies.writeHistory ?? writeExclusiveJsonAtomic)(historyPath, history);
    result = Object.freeze({
      backupId,
      bundleDirectory,
      observation,
      rpo,
      rpoEvaluation,
      history,
      executionContext: configuration.execution.executionContext,
      observationProvenance: configuration.execution.observationProvenance,
      rpoAuthority: configuration.execution.rpoAuthority,
      providerSchedulerAttestation: configuration.execution.providerSchedulerAttestation,
      objectCount: snapshot.objectCount,
      totalSnapshotBytes: snapshot.totalBytes,
      sdkResolution: sdk.resolution,
    });
  } catch (error) {
    operationError = error;
    const completedAt = normalizeTimestamp(
      clock(),
      "P16_HOSTED_BACKUP_CLOCK_INVALID",
    ).toISOString();
    history = createRunHistory({
      ...configuration.execution,
      backupId,
      startedAt,
      completedAt,
      outcome: "FAIL",
      releaseCommit: configuration.releaseCommit,
      objectCount: snapshot.objectCount,
      totalSnapshotBytes: snapshot.totalBytes,
      verifiedBackupAt,
      failureCode: stableFailureCode(error),
    });
    if (workspaceCreated) {
      try {
        await (
          dependencies.writeFailureHistory ??
          dependencies.writeHistory ??
          writeExclusiveJsonAtomic
        )(historyPath, history);
      } catch {
        // The original stable failure remains authoritative; no uncontrolled error is serialized.
      }
    }
  }

  if (workspaceCreated) {
    try {
      await (dependencies.cleanupWorkspace ?? cleanupHostedBackupWorkspace)({
        workspace,
        workRoot: configuration.workRoot,
        repositoryRoot: configuration.repositoryRoot,
        outputRoot: configuration.outputRoot,
      });
    } catch (error) {
      operationError = new Error("P16_HOSTED_BACKUP_PLAINTEXT_CLEANUP_FAILED", { cause: error });
      const failedHistory = createRunHistory({
        ...configuration.execution,
        backupId,
        startedAt,
        completedAt: normalizeTimestamp(clock(), "P16_HOSTED_BACKUP_CLOCK_INVALID").toISOString(),
        outcome: "FAIL",
        releaseCommit: configuration.releaseCommit,
        objectCount: snapshot.objectCount,
        totalSnapshotBytes: snapshot.totalBytes,
        verifiedBackupAt,
        failureCode: "P16_HOSTED_BACKUP_PLAINTEXT_CLEANUP_FAILED",
      });
      try {
        await (dependencies.replaceHistory ?? writeReplacementJsonAtomic)(
          historyPath,
          failedHistory,
        );
      } catch {
        // Cleanup failure is returned with a stable code even if history storage is unavailable.
      }
    }
  }

  if (operationError) {
    throw new Error(stableFailureCode(operationError), { cause: operationError });
  }
  invariant(bundleVerified && result, "P16_HOSTED_BACKUP_FAILED");
  return result;
}

export const P16_HOSTED_BACKUP_MANUAL_AUTHORITY = MANUAL_AUTHORITY;
export const P16_HOSTED_BACKUP_SCHEDULED_AUTHORITY = SCHEDULED_AUTHORITY;
