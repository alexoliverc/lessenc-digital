import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertAllowedStoragePath,
  assertSafeManifest,
  createManifest,
  normalizeRelativeBackupPath,
  parseDatabaseUrl,
  sha256File,
  verifyBundle,
} from "../../../scripts/p11-c65-backup-bundle.mjs";

const temporaryRoots = new Set<string>();

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "lessenc-p11-c65-backup-"));

  temporaryRoots.add(root);

  return root;
}

async function createValidBundle() {
  const root = await temporaryRoot();

  await mkdir(join(root, "storage", "resources"), {
    recursive: true,
  });

  const dumpPath = join(root, "database.sql");

  const storagePath = join(root, "storage", "resources", "ebook.pdf");

  await writeFile(dumpPath, "CREATE TABLE example(id INT);\n");

  await writeFile(storagePath, "ebook-content");

  const dumpHash = await sha256File(dumpPath);

  const storageHash = await sha256File(storagePath);

  const manifest = createManifest({
    backupId: "unit-backup-001",
    createdAt: "2026-09-13T17:40:00.000Z",
    databaseName: "lessenc_test",
    databaseDump: {
      bytes: 30,
      sha256: dumpHash,
    },
    migrations: [
      {
        name: "20260913_test",
        sha256: "a".repeat(64),
      },
    ],
    storageFiles: [
      {
        relativePath: "resources/ebook.pdf",
        bytes: 13,
        sha256: storageHash,
      },
    ],
  });

  await writeFile(join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    root,
    storagePath,
  };
}

afterEach(async () => {
  for (const root of temporaryRoots) {
    await rm(root, {
      recursive: true,
      force: true,
    });
  }

  temporaryRoots.clear();
});

describe("P11 C6.5 backup bundle integrity", () => {
  it("normalizes a safe relative storage path", () => {
    expect(normalizeRelativeBackupPath("resources/book/v1.pdf")).toBe("resources/book/v1.pdf");
  });

  it("rejects absolute and traversal storage paths", () => {
    expect(() => normalizeRelativeBackupPath("../secret")).toThrow(
      "BACKUP_RELATIVE_PATH_TRAVERSAL",
    );

    expect(() => normalizeRelativeBackupPath("C:/secret")).toThrow("BACKUP_RELATIVE_PATH_ABSOLUTE");
  });

  it("rejects secret/config files from private storage backup", () => {
    expect(() => assertAllowedStoragePath("resources/.env")).toThrow(
      "BACKUP_STORAGE_SECRET_FILE_FORBIDDEN",
    );

    expect(() => assertAllowedStoragePath("resources/private.key")).toThrow(
      "BACKUP_STORAGE_SECRET_FILE_FORBIDDEN",
    );
  });

  it("produces deterministic SHA-256 for a file", async () => {
    const root = await temporaryRoot();

    const file = join(root, "fixture.bin");

    await writeFile(file, "lessenc");

    expect(await sha256File(file)).toMatch(/^[0-9a-f]{64}$/u);

    expect(await sha256File(file)).toBe(await sha256File(file));
  });

  it("keeps database passwords and URLs out of manifest data", () => {
    expect(() =>
      assertSafeManifest({
        formatVersion: 1,
        databaseUrl: "mysql://user:password@localhost/db",
      }),
    ).toThrow(/BACKUP_MANIFEST_FORBIDDEN/u);

    expect(() =>
      assertSafeManifest({
        formatVersion: 1,
        databaseName: "lessenc_test",
      }),
    ).not.toThrow();
  });

  it("verifies a valid bundle and rejects later file tampering", async () => {
    const { root, storagePath } = await createValidBundle();

    await expect(verifyBundle(root)).resolves.toMatchObject({
      formatVersion: 1,
      databaseName: "lessenc_test",
    });

    await writeFile(storagePath, "tampered-content");

    await expect(verifyBundle(root)).rejects.toThrow(/BACKUP_VERIFY_STORAGE/u);
  });

  it("parses MySQL connection metadata without exposing the original URL", () => {
    const parsed = parseDatabaseUrl("mysql://runtime:password@127.0.0.1:3307/lessenc_test");

    expect(parsed.databaseName).toBe("lessenc_test");

    expect(parsed.hostname).toBe("127.0.0.1");

    expect(parsed.port).toBe("3307");

    expect(Object.keys(parsed)).not.toContain("rawUrl");
  });
});
