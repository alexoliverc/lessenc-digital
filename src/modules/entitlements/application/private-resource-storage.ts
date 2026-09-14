export type PrivateResourceMetadata = Readonly<{
  sizeBytes: number;
}>;

/*
 * Provider-independent binary body contract.
 *
 * Infrastructure adapters may satisfy this with Node.js
 * Readable streams, cloud SDK streams, or any other
 * async iterable of binary chunks.
 *
 * Application code must not depend on node:stream.
 */
export type PrivateResourceBody = AsyncIterable<Uint8Array>;

export interface PrivateResourceStorage {
  stat(storageKey: string): Promise<PrivateResourceMetadata>;

  open(storageKey: string): Promise<PrivateResourceBody>;
}

export type PrivateResourceStorageErrorCode =
  | "INVALID_STORAGE_KEY"
  | "RESOURCE_NOT_FOUND"
  | "RESOURCE_NOT_FILE"
  | "STORAGE_ESCAPE_DETECTED"
  | "STORAGE_ROOT_INVALID"
  | "STORAGE_ROOT_UNAVAILABLE"
  | "STORAGE_UNAVAILABLE";

export class PrivateResourceStorageError extends Error {
  readonly code: PrivateResourceStorageErrorCode;

  constructor(code: PrivateResourceStorageErrorCode) {
    super(code);

    this.name = "PrivateResourceStorageError";

    this.code = code;
  }
}
