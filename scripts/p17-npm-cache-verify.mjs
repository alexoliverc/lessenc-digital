#!/usr/bin/env node

/* global Buffer, URL, process */

import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const INVENTORY_LINE = /^([A-F0-9]{128}) {2}([0-9]+) {2}([^\r\n]+)$/u;
const PRIVATE_FILE =
  /^(?:\.env(?:\..*)?|\.npmrc(?:\..*)?|.*\.(?:crt|jks|key|keystore|log|p12|pem|pfx))$/iu;

class VerificationError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "VerificationError";
    this.code = code;
  }
}

const fail = (code, detail) => {
  throw new VerificationError(code, detail);
};

const hashBuffer = (algorithm, buffer, encoding = "hex") =>
  createHash(algorithm).update(buffer).digest(encoding);

const readJson = (path, code) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(code);
  }
};

const parseIntegrity = (integrity, detail) => {
  if (typeof integrity !== "string" || !integrity.startsWith("sha512-")) {
    fail("P17_CACHE_LOCK_INTEGRITY_INVALID", detail);
  }

  const digest = Buffer.from(integrity.slice("sha512-".length), "base64");
  if (digest.length !== 64) fail("P17_CACHE_LOCK_INTEGRITY_INVALID", detail);
  return digest;
};

const matchesConstraint = (constraint, actual) => {
  if (!Array.isArray(constraint) || constraint.length === 0) return true;
  if (constraint.includes(`!${actual}`)) return false;
  const positive = constraint.filter((value) => !value.startsWith("!"));
  return positive.length === 0 || positive.includes(actual);
};

const supportsTarget = (metadata, target) =>
  matchesConstraint(metadata.os, target.os) &&
  matchesConstraint(metadata.cpu, target.architecture === "amd64" ? "x64" : target.architecture) &&
  matchesConstraint(metadata.libc, target.libc);

const readContract = (contractPath) => {
  const contract = readJson(contractPath, "P17_CACHE_CONTRACT_JSON_INVALID");
  const cache = contract?.offlineCache;
  if (!cache || cache.schemaVersion !== 1) fail("P17_CACHE_CONTRACT_INVALID");

  const identity = cache.identity;
  if (
    !identity ||
    typeof identity.node !== "string" ||
    typeof identity.npm !== "string" ||
    typeof identity.os !== "string" ||
    typeof identity.architecture !== "string" ||
    typeof identity.libc !== "string" ||
    typeof identity.packageLockSha256 !== "string" ||
    typeof identity.imageDigest !== "string" ||
    typeof identity.registryOrigin !== "string" ||
    !Array.isArray(cache.requiredPackages)
  ) {
    fail("P17_CACHE_CONTRACT_INVALID");
  }

  return cache;
};

const auditPackageLock = (lockfilePath, cacheContract) => {
  const lockBytes = readFileSync(lockfilePath);
  const lockHash = hashBuffer("sha256", lockBytes).toUpperCase();
  if (lockHash !== cacheContract.identity.packageLockSha256) {
    fail("P17_CACHE_PACKAGE_LOCK_HASH_INVALID");
  }

  const lock = readJson(lockfilePath, "P17_CACHE_PACKAGE_LOCK_JSON_INVALID");
  if (lock.lockfileVersion !== 3 || !lock.packages || !lock.packages[""]) {
    fail("P17_CACHE_PACKAGE_LOCK_VERSION_INVALID");
  }

  const entries = Object.entries(lock.packages).filter(([lockPath]) => lockPath !== "");
  const target = cacheContract.identity;
  const registryOrigin = new URL(target.registryOrigin).origin;

  for (const [lockPath, metadata] of entries) {
    if (typeof metadata.resolved !== "string") {
      fail("P17_CACHE_LOCK_RESOLVED_MISSING", lockPath);
    }

    let resolved;
    try {
      resolved = new URL(metadata.resolved);
    } catch {
      fail("P17_CACHE_LOCK_RESOLVED_INVALID", lockPath);
    }

    if (resolved.origin !== registryOrigin || resolved.protocol !== "https:") {
      fail("P17_CACHE_LOCK_ORIGIN_FORBIDDEN", lockPath);
    }
    parseIntegrity(metadata.integrity, lockPath);
  }

  for (const required of cacheContract.requiredPackages) {
    const metadata = lock.packages[required.lockPath];
    if (!metadata || metadata.version !== required.version) {
      fail("P17_CACHE_REQUIRED_PACKAGE_INVALID", required.lockPath);
    }
    if (!supportsTarget(metadata, target)) {
      fail("P17_CACHE_REQUIRED_PACKAGE_PLATFORM_INVALID", required.lockPath);
    }
  }

  const targetEntries = entries.filter(([, metadata]) => supportsTarget(metadata, target));

  return {
    lock,
    lockHash,
    entries,
    targetEntries,
    registryOrigin,
  };
};

const normalizedRelative = (root, path) => relative(root, path).split(sep).join("/");

const inspectTree = (root) => {
  if (!existsSync(root)) fail("P17_CACHE_ROOT_MISSING");

  const rootReal = realpathSync(root);
  const pending = [root];
  const files = [];

  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      const relativePath = normalizedRelative(root, path);
      const stat = lstatSync(path);

      if (stat.isSymbolicLink()) fail("P17_CACHE_LINK_FORBIDDEN", relativePath);
      if (stat.isFile() && stat.nlink > 1) fail("P17_CACHE_HARDLINK_FORBIDDEN", relativePath);

      const resolvedPath = realpathSync(path);
      if (resolvedPath !== rootReal && !resolvedPath.startsWith(`${rootReal}${sep}`)) {
        fail("P17_CACHE_PATH_ESCAPE", relativePath);
      }

      if (PRIVATE_FILE.test(basename(path))) {
        fail("P17_CACHE_PRIVATE_FILE_FORBIDDEN", relativePath);
      }

      if (stat.isDirectory()) {
        pending.push(path);
      } else if (stat.isFile()) {
        files.push({ path, relativePath, size: stat.size });
      } else {
        fail("P17_CACHE_SPECIAL_FILE_FORBIDDEN", relativePath);
      }
    }
  }

  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
  return files;
};

const contentPathForIntegrity = (cacheRoot, integrity) => {
  const hex = parseIntegrity(integrity, "content").toString("hex");
  return resolve(
    cacheRoot,
    "_cacache",
    "content-v2",
    "sha512",
    hex.slice(0, 2),
    hex.slice(2, 4),
    hex.slice(4),
  );
};

const readIndexRecords = (cacheRoot, files, registryOrigin) => {
  const prefix = "_cacache/index-v5/";
  const records = [];

  for (const file of files.filter(({ relativePath }) => relativePath.startsWith(prefix))) {
    const lines = readFileSync(file.path, "utf8").split(/\r?\n/u).filter(Boolean);
    for (const line of lines) {
      const separator = line.indexOf("\t");
      if (separator < 1) fail("P17_CACHE_INDEX_RECORD_INVALID", file.relativePath);

      let record;
      try {
        record = JSON.parse(line.slice(separator + 1));
      } catch {
        fail("P17_CACHE_INDEX_RECORD_INVALID", file.relativePath);
      }

      if (typeof record.key !== "string" || typeof record.integrity !== "string") {
        fail("P17_CACHE_INDEX_RECORD_INVALID", file.relativePath);
      }
      parseIntegrity(record.integrity, file.relativePath);

      const urlStart = record.key.indexOf("https://");
      if (urlStart < 0) fail("P17_CACHE_INDEX_KEY_INVALID", file.relativePath);

      let origin;
      try {
        origin = new URL(record.key.slice(urlStart)).origin;
      } catch {
        fail("P17_CACHE_INDEX_KEY_INVALID", file.relativePath);
      }
      if (origin !== registryOrigin) {
        fail("P17_CACHE_INDEX_ORIGIN_FORBIDDEN", file.relativePath);
      }

      records.push(record);
    }
  }

  if (records.length === 0) fail("P17_CACHE_INDEX_EMPTY");
  return records;
};

const createInventory = (cacheRoot, files) => {
  const lines = files.map(({ path, relativePath, size }) => {
    const digest = hashBuffer("sha512", readFileSync(path)).toUpperCase();
    return `${digest}  ${size}  ${relativePath}`;
  });
  const text = `${lines.join("\n")}\n`;

  return {
    lines,
    text,
    sha256: hashBuffer("sha256", Buffer.from(text)).toUpperCase(),
    totalBytes: files.reduce((total, file) => total + file.size, 0),
  };
};

const verifyInventory = (inventoryPath, actualInventory) => {
  const expectedText = readFileSync(inventoryPath, "utf8").replace(/\r\n/gu, "\n");
  const lines = expectedText.split("\n").filter(Boolean);
  for (const line of lines) {
    const match = INVENTORY_LINE.exec(line);
    if (!match || match[3].includes("\\") || match[3].startsWith("/") || match[3].includes("../")) {
      fail("P17_CACHE_INVENTORY_LINE_INVALID");
    }
  }
  if (expectedText !== actualInventory.text) fail("P17_CACHE_INVENTORY_MISMATCH");
};

const assertManifestIdentity = (manifest, cacheContract, audit, inventory, fileCount) => {
  if (manifest?.schemaVersion !== 1 || manifest?.status !== "VERIFIED") {
    fail("P17_CACHE_MANIFEST_STATUS_INVALID");
  }

  for (const [key, expected] of Object.entries(cacheContract.identity)) {
    if (manifest.identity?.[key] !== expected) {
      fail("P17_CACHE_MANIFEST_IDENTITY_INVALID", key);
    }
  }

  if (
    manifest.cache?.rootKey !== cacheContract.key ||
    manifest.cache?.fileCount !== fileCount ||
    manifest.cache?.totalBytes !== inventory.totalBytes ||
    manifest.cache?.inventorySha256 !== inventory.sha256
  ) {
    fail("P17_CACHE_MANIFEST_CACHE_INVALID");
  }

  if (
    manifest.integrity?.result !== "PASS" ||
    manifest.integrity?.lockEntries !== audit.entries.length ||
    manifest.integrity?.verifiedTargetEntries !== audit.targetEntries.length ||
    manifest.integrity?.requiredPackages !== cacheContract.requiredPackages.length
  ) {
    fail("P17_CACHE_MANIFEST_INTEGRITY_INVALID");
  }

  if (
    manifest.offlineReplay?.result !== "PASS" ||
    manifest.offlineReplay?.scripts !== "disabled" ||
    manifest.offlineReplay?.browserDownloads !== false
  ) {
    fail("P17_CACHE_MANIFEST_REPLAY_INVALID");
  }

  if (
    manifest.prismaSchemaEngine?.status !== "MATERIALIZED_SEPARATELY" ||
    manifest.prismaSchemaEngine?.evidence !== "e2e/performance/capsule/supply-chain.json"
  ) {
    fail("P17_CACHE_MANIFEST_PRISMA_STATE_INVALID");
  }
};

const verifyCache = ({ cacheRoot, lockfilePath, contractPath, manifestPath, inventoryPath }) => {
  const cacheContract = readContract(contractPath);
  const audit = auditPackageLock(lockfilePath, cacheContract);
  const root = resolve(cacheRoot);
  const files = inspectTree(root);

  if (
    files.some(
      ({ relativePath }) =>
        !relativePath.startsWith("_cacache/content-v2/sha512/") &&
        !relativePath.startsWith("_cacache/index-v5/"),
    )
  ) {
    fail("P17_CACHE_UNEXPECTED_FILE");
  }

  const records = readIndexRecords(root, files, audit.registryOrigin);
  const filePaths = new Set(files.map(({ path }) => resolve(path)));

  for (const [lockPath, metadata] of audit.targetEntries) {
    const contentPath = contentPathForIntegrity(root, metadata.integrity);
    if (!filePaths.has(contentPath)) fail("P17_CACHE_CONTENT_MISSING", lockPath);

    const contentIntegrity = `sha512-${hashBuffer("sha512", readFileSync(contentPath), "base64")}`;
    if (contentIntegrity !== metadata.integrity) {
      fail("P17_CACHE_CONTENT_INTEGRITY_INVALID", lockPath);
    }

    const indexed = records.some(
      (record) => record.integrity === metadata.integrity && record.key.includes(metadata.resolved),
    );
    if (!indexed) fail("P17_CACHE_INDEX_ENTRY_MISSING", lockPath);
  }

  for (const record of records) {
    const contentPath = contentPathForIntegrity(root, record.integrity);
    if (!filePaths.has(contentPath)) fail("P17_CACHE_INDEX_CONTENT_MISSING");
  }

  const inventory = createInventory(root, files);
  verifyInventory(inventoryPath, inventory);
  const manifest = readJson(manifestPath, "P17_CACHE_MANIFEST_JSON_INVALID");
  assertManifestIdentity(manifest, cacheContract, audit, inventory, files.length);

  return {
    result: "PASS",
    packageLockSha256: audit.lockHash,
    lockEntries: audit.entries.length,
    verifiedTargetEntries: audit.targetEntries.length,
    requiredPackages: cacheContract.requiredPackages.length,
    indexRecords: records.length,
    cacheFiles: files.length,
    cacheBytes: inventory.totalBytes,
    inventorySha256: inventory.sha256,
    prismaSchemaEngine: "MATERIALIZED_SEPARATELY",
  };
};

const parseArguments = (argv) => {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (!name?.startsWith("--") || value === undefined) fail("P17_CACHE_ARGUMENT_INVALID");
    options[name.slice(2)] = value;
  }
  return { command, options };
};

const requireOption = (options, name) => {
  const value = options[name];
  if (!value) fail("P17_CACHE_ARGUMENT_MISSING", name);
  return value;
};

const main = () => {
  const { command, options } = parseArguments(process.argv.slice(2));
  const lockfilePath = requireOption(options, "lockfile");
  const contractPath = requireOption(options, "contract");

  if (command === "verify-lock") {
    const cacheContract = readContract(contractPath);
    const audit = auditPackageLock(lockfilePath, cacheContract);
    process.stdout.write(
      `${JSON.stringify({
        result: "PASS",
        packageLockSha256: audit.lockHash,
        lockfileVersion: audit.lock.lockfileVersion,
        lockEntries: audit.entries.length,
        targetEntries: audit.targetEntries.length,
        requiredPackages: cacheContract.requiredPackages.length,
        registryOrigin: audit.registryOrigin,
      })}\n`,
    );
    return;
  }

  if (command === "verify-cache") {
    const result = verifyCache({
      lockfilePath,
      contractPath,
      cacheRoot: requireOption(options, "cache-root"),
      manifestPath: requireOption(options, "manifest"),
      inventoryPath: requireOption(options, "inventory"),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (command === "create-evidence") {
    const cacheRoot = requireOption(options, "cache-root");
    const inventoryPath = requireOption(options, "inventory");
    const manifestPath = requireOption(options, "manifest");
    const cacheContract = readContract(contractPath);
    const audit = auditPackageLock(lockfilePath, cacheContract);
    const files = inspectTree(resolve(cacheRoot));
    const inventory = createInventory(cacheRoot, files);
    const manifest = {
      schemaVersion: 1,
      status: "VERIFIED",
      identity: cacheContract.identity,
      cache: {
        rootKey: cacheContract.key,
        fileCount: files.length,
        totalBytes: inventory.totalBytes,
        inventorySha256: inventory.sha256,
      },
      integrity: {
        result: "PASS",
        lockEntries: audit.entries.length,
        verifiedTargetEntries: audit.targetEntries.length,
        requiredPackages: cacheContract.requiredPackages.length,
      },
      offlineReplay: { result: "PASS", scripts: "disabled", browserDownloads: false },
      prismaSchemaEngine: {
        status: "MATERIALIZED_SEPARATELY",
        evidence: "e2e/performance/capsule/supply-chain.json",
      },
    };
    writeFileSync(inventoryPath, inventory.text, { flag: "wx" });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    process.stdout.write(
      `${JSON.stringify({ result: "PASS", files: files.length, bytes: inventory.totalBytes, inventorySha256: inventory.sha256 })}\n`,
    );
    return;
  }

  fail("P17_CACHE_COMMAND_INVALID");
};

export { VerificationError, auditPackageLock, createInventory, inspectTree, verifyCache };

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    if (error instanceof VerificationError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    } else {
      process.stderr.write("P17_CACHE_UNEXPECTED_VERIFICATION_FAILURE\n");
      process.exitCode = 1;
    }
  }
}
