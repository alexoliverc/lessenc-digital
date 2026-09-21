import { GetObjectCommand, HeadObjectCommand, type S3Client } from "@aws-sdk/client-s3";

import {
  PrivateResourceStorageError,
  type PrivateResourceBody,
  type PrivateResourceMetadata,
  type PrivateResourceStorage,
} from "../../modules/entitlements/application/private-resource-storage";
import { parsePrivateStorageKey } from "./private-storage-key";

type HeadSnapshot = Readonly<{
  key: string;
  sizeBytes: number;
  etag?: string;
}>;

export type S3CompatiblePrivateResourceStorageOptions = Readonly<{
  client: S3Client;
  bucket: string;
}>;

function providerErrorName(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name;
  }

  return undefined;
}

function providerHttpStatus(error: unknown): number | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("$metadata" in error) ||
    typeof error.$metadata !== "object" ||
    error.$metadata === null ||
    !("httpStatusCode" in error.$metadata) ||
    typeof error.$metadata.httpStatusCode !== "number"
  ) {
    return undefined;
  }

  return error.$metadata.httpStatusCode;
}

function normalizeProviderError(error: unknown): PrivateResourceStorageError {
  if (error instanceof PrivateResourceStorageError) {
    return error;
  }

  const name = providerErrorName(error);
  const status = providerHttpStatus(error);

  /*
   * NoSuchBucket is infrastructure failure, not missing buyer content.
   * A bare HTTP 404 is deliberately not enough to classify an object
   * as missing.
   */
  if (name === "NoSuchBucket") {
    return new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
  }

  if (name === "NoSuchKey" || (name === "NotFound" && status === 404)) {
    return new PrivateResourceStorageError("RESOURCE_NOT_FOUND");
  }

  return new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
}

function validContentLength(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return false;
  }

  const candidate = value as {
    [Symbol.asyncIterator]?: unknown;
  };

  return typeof candidate[Symbol.asyncIterator] === "function";
}

async function* normalizedStreamingBody(
  body: AsyncIterable<unknown>,
): AsyncGenerator<Uint8Array, void, void> {
  const iterator = body[Symbol.asyncIterator]();

  try {
    while (true) {
      let next: IteratorResult<unknown>;

      try {
        next = await iterator.next();
      } catch {
        throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
      }

      if (next.done) {
        return;
      }

      if (!(next.value instanceof Uint8Array)) {
        throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
      }

      yield next.value;
    }
  } finally {
    if (iterator.return) {
      try {
        await iterator.return();
      } catch {
        // Best-effort provider stream release only.
      }
    }
  }
}

export class S3CompatiblePrivateResourceStorage implements PrivateResourceStorage {
  private readonly client: S3Client;

  private readonly bucket: string;

  private headSnapshot: HeadSnapshot | null = null;

  constructor(options: S3CompatiblePrivateResourceStorageOptions) {
    if (
      typeof options.bucket !== "string" ||
      options.bucket.length === 0 ||
      options.bucket.trim() !== options.bucket
    ) {
      throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
    }

    this.client = options.client;
    this.bucket = options.bucket;
  }

  async stat(storageKey: string): Promise<PrivateResourceMetadata> {
    const { key } = parsePrivateStorageKey(storageKey);

    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      if (!validContentLength(response.ContentLength)) {
        throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
      }

      const etag =
        typeof response.ETag === "string" && response.ETag.length > 0 ? response.ETag : undefined;

      this.headSnapshot = Object.freeze({
        key,
        sizeBytes: response.ContentLength,
        ...(etag ? { etag } : {}),
      });

      return Object.freeze({
        sizeBytes: response.ContentLength,
      });
    } catch (error) {
      this.headSnapshot = null;

      throw normalizeProviderError(error);
    }
  }

  async open(storageKey: string): Promise<PrivateResourceBody> {
    const { key } = parsePrivateStorageKey(storageKey);

    const snapshot = this.headSnapshot?.key === key ? this.headSnapshot : null;

    /*
     * A metadata snapshot is single-use. The normal protected delivery path
     * calls stat() followed immediately by open() on the same adapter.
     */
    this.headSnapshot = null;

    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ...(snapshot?.etag ? { IfMatch: snapshot.etag } : {}),
        }),
      );

      if (response.ContentLength !== undefined && !validContentLength(response.ContentLength)) {
        throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
      }

      if (
        snapshot !== null &&
        response.ContentLength !== undefined &&
        response.ContentLength !== snapshot.sizeBytes
      ) {
        throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
      }

      if (!isAsyncIterable(response.Body)) {
        throw new PrivateResourceStorageError("STORAGE_UNAVAILABLE");
      }

      return normalizedStreamingBody(response.Body);
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }
}
