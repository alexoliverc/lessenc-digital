import "server-only";

import { getP11PrivateStorageEnv, getP16PrivateStorageDriverEnv } from "../../lib/config/env";
import {
  PrivateResourceStorageError,
  type PrivateResourceBody,
  type PrivateResourceMetadata,
  type PrivateResourceStorage,
} from "../../modules/entitlements/application/private-resource-storage";
import { LocalPrivateFileStorage } from "./local-private-file-storage";
import {
  assertPrivateStorageRootIsPrivate,
  PrivateStorageRootPolicyError,
} from "./private-storage-root-policy";

/*
 * Configuration and filesystem resolution are intentionally lazy.
 *
 * Constructing the HTTP route must not touch the private filesystem
 * or disclose storage configuration state before Buyer Access
 * authentication / authorization reaches the delivery boundary.
 *
 * A new adapter is created per request. Once successfully resolved
 * inside that request, the same LocalPrivateFileStorage instance is
 * reused for stat() and open().
 */
export class ConfiguredPrivateFileStorage implements PrivateResourceStorage {
  private resolvedStorage: LocalPrivateFileStorage | null = null;

  private resolveStorage(): LocalPrivateFileStorage {
    if (this.resolvedStorage !== null) {
      return this.resolvedStorage;
    }

    try {
      const driver = getP16PrivateStorageDriverEnv().PRIVATE_STORAGE_DRIVER;
      const applicationEnvironment = process.env.APP_ENV;

      if (driver === "hosted") {
        // A concrete provider adapter requires an explicit owner/provider decision.
        throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
      }

      if (applicationEnvironment === "staging" || applicationEnvironment === "production") {
        // Never promote the workstation filesystem adapter to hosted authority.
        throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
      }

      const storageEnv = getP11PrivateStorageEnv();

      assertPrivateStorageRootIsPrivate(storageEnv.PRIVATE_FILE_STORAGE_PATH);

      const storage = new LocalPrivateFileStorage(storageEnv.PRIVATE_FILE_STORAGE_PATH);

      this.resolvedStorage = storage;

      return storage;
    } catch (error) {
      if (error instanceof PrivateResourceStorageError) {
        throw error;
      }

      if (error instanceof PrivateStorageRootPolicyError) {
        throw new PrivateResourceStorageError("STORAGE_ROOT_INVALID");
      }

      if (
        error instanceof Error &&
        error.message.startsWith("Invalid P11 private storage configuration:")
      ) {
        throw new PrivateResourceStorageError("STORAGE_ROOT_INVALID");
      }

      throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
    }
  }

  async stat(storageKey: string): Promise<PrivateResourceMetadata> {
    return this.resolveStorage().stat(storageKey);
  }

  async open(storageKey: string): Promise<PrivateResourceBody> {
    return this.resolveStorage().open(storageKey);
  }
}

export function createConfiguredPrivateFileStorage(): PrivateResourceStorage {
  /*
   * IMPORTANT:
   * this function must remain side-effect free regarding storage.
   * No env parsing, realpath, stat, open, or filesystem access here.
   */
  return new ConfiguredPrivateFileStorage();
}
