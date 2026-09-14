import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PrivateResourceStorageError } from "../../modules/entitlements/application/private-resource-storage";
import { LocalPrivateFileStorage } from "./local-private-file-storage";

const createdPaths: string[] = [];

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));

  createdPaths.push(directory);

  return directory;
}

async function createStorageFixture() {
  const root = await temporaryDirectory("lessenc-p11-storage-");

  const resourceDirectory = join(root, "resources", "abc");

  await mkdir(resourceDirectory, {
    recursive: true,
  });

  const body = Buffer.from("private-lessenc-resource", "utf8");

  await writeFile(join(resourceDirectory, "v1.pdf"), body);

  return {
    root,
    body,
    storageKey: "resources/abc/v1.pdf",
  };
}

afterEach(async () => {
  while (createdPaths.length > 0) {
    const path = createdPaths.pop();

    if (path) {
      await rm(path, {
        recursive: true,
        force: true,
      });
    }
  }
});

describe("LocalPrivateFileStorage", () => {
  it("returns metadata for a regular private resource", async () => {
    const fixture = await createStorageFixture();

    const storage = new LocalPrivateFileStorage(fixture.root);

    await expect(storage.stat(fixture.storageKey)).resolves.toEqual({
      sizeBytes: fixture.body.length,
    });
  });

  it("opens a private resource as a stream instead of buffering the file", async () => {
    const fixture = await createStorageFixture();

    const storage = new LocalPrivateFileStorage(fixture.root);

    const stream = await storage.open(fixture.storageKey);

    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    expect(Buffer.concat(chunks)).toEqual(fixture.body);
  });

  it.each([
    "",
    "../secret.pdf",
    "resources/../secret.pdf",
    "/absolute/file.pdf",
    "C:\\secret.pdf",
    "resources\\secret.pdf",
    "resources/\u0000secret.pdf",
  ])("rejects unsafe storage key %j", async (storageKey) => {
    const fixture = await createStorageFixture();

    const storage = new LocalPrivateFileStorage(fixture.root);

    await expect(storage.stat(storageKey)).rejects.toMatchObject({
      code: "INVALID_STORAGE_KEY",
    });
  });

  it("returns RESOURCE_NOT_FOUND without exposing the physical root", async () => {
    const fixture = await createStorageFixture();

    const storage = new LocalPrivateFileStorage(fixture.root);

    try {
      await storage.stat("resources/abc/missing.pdf");

      throw new Error("expected storage error");
    } catch (error) {
      expect(error).toBeInstanceOf(PrivateResourceStorageError);

      expect(error).toMatchObject({
        code: "RESOURCE_NOT_FOUND",
        message: "RESOURCE_NOT_FOUND",
      });

      expect(String(error)).not.toContain(fixture.root);
    }
  });

  it("rejects directories as downloadable resources", async () => {
    const fixture = await createStorageFixture();

    await mkdir(join(fixture.root, "resources", "directory"), {
      recursive: true,
    });

    const storage = new LocalPrivateFileStorage(fixture.root);

    await expect(storage.stat("resources/directory")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FILE",
    });
  });

  it("rejects a symlink or junction that escapes the private storage root", async () => {
    const fixture = await createStorageFixture();

    const outside = await temporaryDirectory("lessenc-p11-outside-");

    await writeFile(join(outside, "secret.pdf"), "outside");

    const escapePath = join(fixture.root, "escape");

    await symlink(outside, escapePath, process.platform === "win32" ? "junction" : "dir");

    const storage = new LocalPrivateFileStorage(fixture.root);

    await expect(storage.stat("escape/secret.pdf")).rejects.toMatchObject({
      code: "STORAGE_ESCAPE_DETECTED",
    });
  });

  it("fails closed when the configured storage root is unavailable", async () => {
    const root = resolve(tmpdir(), `lessenc-p11-missing-${Date.now()}-${Math.random()}`);

    const storage = new LocalPrivateFileStorage(root);

    await expect(storage.stat("resources/abc/v1.pdf")).rejects.toMatchObject({
      code: "STORAGE_ROOT_UNAVAILABLE",
    });
  });

  it("rejects a relative private storage root", () => {
    expect(() => new LocalPrivateFileStorage("relative/private-storage")).toThrow(
      "STORAGE_ROOT_INVALID",
    );
  });
});
