import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import {
  getP11PrivateStorageEnv,
  getP16HostedPrivateStorageEnv,
  getP16PrivateStorageDriverEnv,
} from "../../lib/config/env";
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
import { S3CompatiblePrivateResourceStorage } from "./s3-compatible-private-resource-storage";

/*
 * Configuration and physical storage resolution are intentionally lazy.
 *
 * Constructing the HTTP route must not parse hosted credentials,
 * touch the local filesystem or issue provider requests before
 * Buyer Access authentication / authorization reaches the delivery
 * boundary.
 *
 * A new resolver is created per protected-delivery request. Once the
 * concrete adapter has been resolved, that same adapter is reused for
 * stat() and open().
 */
export class ConfiguredPrivateFileStorage implements PrivateResourceStorage {
  private resolvedStorage: PrivateResourceStorage | null = null;

  private resolveStorage(): PrivateResourceStorage {
    if (this.resolvedStorage !== null) {
      return this.resolvedStorage;
    }

    try {
      const driver = getP16PrivateStorageDriverEnv().PRIVATE_STORAGE_DRIVER;
      const applicationEnvironment = process.env.APP_ENV;

      if (driver === "hosted") {
        const hosted = getP16HostedPrivateStorageEnv();

        const client = new S3Client({
          endpoint: hosted.PRIVATE_STORAGE_S3_ENDPOINT,
          region: hosted.PRIVATE_STORAGE_S3_REGION,
          credentials: {
            accessKeyId: hosted.PRIVATE_STORAGE_S3_ACCESS_KEY_ID,
            secretAccessKey: hosted.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY,
          },
        });

        const storage = new S3CompatiblePrivateResourceStorage({
          client,
          bucket: hosted.PRIVATE_STORAGE_S3_BUCKET,
        });

        this.resolvedStorage = storage;

        return storage;
      }

      if (applicationEnvironment === "staging" || applicationEnvironment === "production") {
        /*
         * Hosted environments must never fall back to workstation or
         * host-local filesystem authority.
         */
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

      /*
       * Hosted configuration/provider-construction details must never
       * escape this infrastructure boundary.
       */
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
   *
   * No environment parsing, S3 request, filesystem realpath/stat/open
   * or provider network access is permitted here.
   */
  return new ConfiguredPrivateFileStorage();
}
