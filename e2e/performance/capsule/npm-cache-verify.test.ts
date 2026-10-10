import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const verifier = resolve(repositoryRoot, "scripts/p17-npm-cache-verify.mjs");
const contract = resolve(repositoryRoot, "e2e/performance/capsule/contract.json");
const lockfile = resolve(repositoryRoot, "package-lock.json");
const temporaryRoots: string[] = [];

const sha = (algorithm: "sha256" | "sha512", value: Buffer | string, encoding: "hex" | "base64") =>
  createHash(algorithm).update(value).digest(encoding);

const runVerifier = (...args: string[]) =>
  spawnSync(process.execPath, [verifier, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });

const listFiles = (root: string) => {
  const pending = [root];
  const files: string[] = [];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else files.push(path);
    }
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
};

const createSyntheticFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "p17-npm-cache-verifier-"));
  temporaryRoots.push(root);

  const cacheRoot = join(root, "cache");
  const packageBytes = Buffer.from("synthetic approved package bytes\n", "utf8");
  const integrity = `sha512-${sha("sha512", packageBytes, "base64")}`;
  const digestHex = Buffer.from(integrity.slice("sha512-".length), "base64").toString("hex");
  const contentPath = join(
    cacheRoot,
    "_cacache",
    "content-v2",
    "sha512",
    digestHex.slice(0, 2),
    digestHex.slice(2, 4),
    digestHex.slice(4),
  );
  const indexPath = join(cacheRoot, "_cacache", "index-v5", "aa", "bb", "synthetic-index");
  mkdirSync(resolve(contentPath, ".."), { recursive: true });
  mkdirSync(resolve(indexPath, ".."), { recursive: true });
  writeFileSync(contentPath, packageBytes);

  const resolved = "https://registry.npmjs.org/p17-synthetic/-/p17-synthetic-1.0.0.tgz";
  writeFileSync(
    indexPath,
    `synthetic\t${JSON.stringify({
      key: `make-fetch-happen:request-cache:${resolved}`,
      integrity,
      time: 0,
    })}\n`,
  );

  const syntheticLock = {
    name: "p17-cache-verifier-fixture",
    version: "1.0.0",
    lockfileVersion: 3,
    packages: {
      "": { dependencies: { "p17-synthetic": "1.0.0" } },
      "node_modules/p17-synthetic": {
        version: "1.0.0",
        resolved,
        integrity,
      },
    },
  };
  const lockPath = join(root, "package-lock.json");
  const lockText = `${JSON.stringify(syntheticLock, null, 2)}\n`;
  writeFileSync(lockPath, lockText);
  const lockHash = sha("sha256", lockText, "hex").toUpperCase();

  const identity = {
    node: "24.21.0",
    npm: "11.19.1",
    os: "linux",
    architecture: "amd64",
    libc: "glibc",
    packageLockSha256: lockHash,
    imageDigest: `sha256:${"a".repeat(64)}`,
    registryOrigin: "https://registry.npmjs.org",
  };
  const cacheKey = `npm-11.19.1/node-24.21.0/linux-amd64-glibc/${lockHash}`;
  const contractPath = join(root, "contract.json");
  writeFileSync(
    contractPath,
    `${JSON.stringify(
      {
        offlineCache: {
          schemaVersion: 1,
          key: cacheKey,
          identity,
          requiredPackages: [{ lockPath: "node_modules/p17-synthetic", version: "1.0.0" }],
        },
      },
      null,
      2,
    )}\n`,
  );

  const files = listFiles(cacheRoot);
  const inventoryLines = files.map((path) => {
    const relativePath = relative(cacheRoot, path).split(sep).join("/");
    return `${sha("sha512", readFileSync(path), "hex").toUpperCase()}  ${
      statSync(path).size
    }  ${relativePath}`;
  });
  const inventoryText = `${inventoryLines.join("\n")}\n`;
  const inventoryPath = join(root, "files.sha512");
  writeFileSync(inventoryPath, inventoryText);

  const manifestPath = join(root, "manifest.json");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        status: "VERIFIED",
        identity,
        cache: {
          rootKey: cacheKey,
          fileCount: files.length,
          totalBytes: files.reduce((total, path) => total + statSync(path).size, 0),
          inventorySha256: sha("sha256", inventoryText, "hex").toUpperCase(),
        },
        integrity: {
          result: "PASS",
          lockEntries: 1,
          verifiedTargetEntries: 1,
          requiredPackages: 1,
        },
        offlineReplay: {
          result: "PASS",
          scripts: "disabled",
          browserDownloads: false,
        },
        prismaSchemaEngine: {
          status: "MATERIALIZED_SEPARATELY",
          evidence: "e2e/performance/capsule/supply-chain.json",
        },
      },
      null,
      2,
    )}\n`,
  );

  return {
    cacheRoot,
    contentPath,
    contractPath,
    inventoryPath,
    lockPath,
    manifestPath,
  };
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("P17 Linux npm cache verifier", () => {
  it("audits the canonical lockfile without touching the cache", () => {
    const result = runVerifier("verify-lock", "--lockfile", lockfile, "--contract", contract);

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      result: "PASS",
      lockfileVersion: 3,
      lockEntries: 445,
      targetEntries: 390,
      requiredPackages: 13,
      registryOrigin: "https://registry.npmjs.org",
    });
  });

  it("accepts a complete, indexed, hashed and replay-attested synthetic cache", () => {
    const fixture = createSyntheticFixture();
    const result = runVerifier(
      "verify-cache",
      "--lockfile",
      fixture.lockPath,
      "--contract",
      fixture.contractPath,
      "--cache-root",
      fixture.cacheRoot,
      "--manifest",
      fixture.manifestPath,
      "--inventory",
      fixture.inventoryPath,
    );

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      result: "PASS",
      lockEntries: 1,
      verifiedTargetEntries: 1,
      requiredPackages: 1,
      indexRecords: 1,
      cacheFiles: 2,
      prismaSchemaEngine: "MATERIALIZED_SEPARATELY",
    });
  });

  it("rejects content that no longer matches the lock integrity", () => {
    const fixture = createSyntheticFixture();
    writeFileSync(fixture.contentPath, "tampered\n");

    const result = runVerifier(
      "verify-cache",
      "--lockfile",
      fixture.lockPath,
      "--contract",
      fixture.contractPath,
      "--cache-root",
      fixture.cacheRoot,
      "--manifest",
      fixture.manifestPath,
      "--inventory",
      fixture.inventoryPath,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P17_CACHE_CONTENT_INTEGRITY_INVALID");
  });

  it("rejects private npm configuration inside the cache", () => {
    const fixture = createSyntheticFixture();
    writeFileSync(join(fixture.cacheRoot, ".npmrc"), "registry=https://example.invalid\n");

    const result = runVerifier(
      "verify-cache",
      "--lockfile",
      fixture.lockPath,
      "--contract",
      fixture.contractPath,
      "--cache-root",
      fixture.cacheRoot,
      "--manifest",
      fixture.manifestPath,
      "--inventory",
      fixture.inventoryPath,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P17_CACHE_PRIVATE_FILE_FORBIDDEN:.npmrc");
  });

  it("fails closed when the selected cache root is absent", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "p17-cache-absent-"));
    temporaryRoots.push(temporaryRoot);
    const canonicalContract = JSON.parse(readFileSync(contract, "utf8")) as {
      offlineCache: { root: string; manifest: string; inventory: string };
    };
    const result = runVerifier(
      "verify-cache",
      "--lockfile",
      lockfile,
      "--contract",
      contract,
      "--cache-root",
      join(temporaryRoot, "absent-cache"),
      "--manifest",
      resolve(repositoryRoot, canonicalContract.offlineCache.manifest),
      "--inventory",
      resolve(repositoryRoot, canonicalContract.offlineCache.inventory),
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P17_CACHE_ROOT_MISSING");
  });
});
