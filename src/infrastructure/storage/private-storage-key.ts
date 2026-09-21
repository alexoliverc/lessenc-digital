import { PrivateResourceStorageError } from "../../modules/entitlements/application/private-resource-storage";

const MAX_STORAGE_KEY_LENGTH = 512;

const STORAGE_KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export type ParsedPrivateStorageKey = Readonly<{
  key: string;
  segments: readonly string[];
}>;

export function parsePrivateStorageKey(storageKey: unknown): ParsedPrivateStorageKey {
  if (
    typeof storageKey !== "string" ||
    storageKey.length === 0 ||
    storageKey.length > MAX_STORAGE_KEY_LENGTH ||
    storageKey.includes("\u0000") ||
    storageKey.includes("\\") ||
    storageKey.startsWith("/") ||
    /^[A-Za-z]:/u.test(storageKey)
  ) {
    throw new PrivateResourceStorageError("INVALID_STORAGE_KEY");
  }

  const segments = storageKey.split("/");

  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        !STORAGE_KEY_SEGMENT.test(segment),
    )
  ) {
    throw new PrivateResourceStorageError("INVALID_STORAGE_KEY");
  }

  return Object.freeze({
    key: storageKey,
    segments: Object.freeze([...segments]),
  });
}
