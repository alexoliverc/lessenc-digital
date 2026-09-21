import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { FileHandle } from "node:fs/promises";
import type { Readable } from "node:stream";

import {
  PrivateResourceStorageError,
  type PrivateResourceMetadata,
  type PrivateResourceStorage,
} from "../../modules/entitlements/application/private-resource-storage";
import { parsePrivateStorageKey } from "./private-storage-key";

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isInsideRoot(root: string, candidate: string): boolean {
  const child = relative(root, candidate);

  return child.length > 0 && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

export class LocalPrivateFileStorage implements PrivateResourceStorage {
  private readonly rootPath: string;

  constructor(rootPath: string) {
    if (typeof rootPath !== "string" || rootPath.trim().length === 0 || !isAbsolute(rootPath)) {
      throw new PrivateResourceStorageError("STORAGE_ROOT_INVALID");
    }

    this.rootPath = resolve(rootPath);
  }

  private async canonicalRoot(): Promise<string> {
    try {
      return await realpath(this.rootPath);
    } catch {
      throw new PrivateResourceStorageError("STORAGE_ROOT_UNAVAILABLE");
    }
  }

  private async resolveResourcePath(storageKey: string): Promise<string> {
    const { segments } = parsePrivateStorageKey(storageKey);

    const root = await this.canonicalRoot();

    const lexicalCandidate = resolve(root, ...segments);

    if (!isInsideRoot(root, lexicalCandidate)) {
      throw new PrivateResourceStorageError("STORAGE_ESCAPE_DETECTED");
    }

    let canonicalCandidate: string;

    try {
      canonicalCandidate = await realpath(lexicalCandidate);
    } catch (error) {
      if (isNodeError(error) && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
        throw new PrivateResourceStorageError("RESOURCE_NOT_FOUND");
      }

      throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
    }

    if (!isInsideRoot(root, canonicalCandidate)) {
      throw new PrivateResourceStorageError("STORAGE_ESCAPE_DETECTED");
    }

    return canonicalCandidate;
  }

  private async openHandle(storageKey: string): Promise<
    Readonly<{
      handle: FileHandle;
      sizeBytes: number;
    }>
  > {
    const path = await this.resolveResourcePath(storageKey);

    /*
     * O_NOFOLLOW protects the final path component
     * on Unix-like production hosts. Windows local
     * development already operates on the canonical
     * realpath resolved above.
     */
    const noFollowFlag = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;

    let handle: FileHandle;

    try {
      handle = await open(path, constants.O_RDONLY | noFollowFlag);
    } catch (error) {
      if (isNodeError(error) && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
        throw new PrivateResourceStorageError("RESOURCE_NOT_FOUND");
      }

      if (isNodeError(error) && error.code === "ELOOP") {
        throw new PrivateResourceStorageError("STORAGE_ESCAPE_DETECTED");
      }

      throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
    }

    try {
      const metadata = await handle.stat();

      if (!metadata.isFile()) {
        await handle.close();

        throw new PrivateResourceStorageError("RESOURCE_NOT_FILE");
      }

      if (!Number.isSafeInteger(metadata.size) || metadata.size < 0) {
        await handle.close();

        throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
      }

      return Object.freeze({
        handle,
        sizeBytes: metadata.size,
      });
    } catch (error) {
      if (error instanceof PrivateResourceStorageError) {
        throw error;
      }

      await handle.close().catch(() => undefined);

      throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
    }
  }

  async stat(storageKey: string): Promise<PrivateResourceMetadata> {
    const opened = await this.openHandle(storageKey);

    try {
      return Object.freeze({
        sizeBytes: opened.sizeBytes,
      });
    } finally {
      await opened.handle.close();
    }
  }

  async open(storageKey: string): Promise<Readable> {
    const opened = await this.openHandle(storageKey);

    try {
      return opened.handle.createReadStream({
        autoClose: true,
      });
    } catch {
      await opened.handle.close().catch(() => undefined);

      throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
    }
  }
}
