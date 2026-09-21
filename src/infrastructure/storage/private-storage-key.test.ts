import { describe, expect, it } from "vitest";

import { PrivateResourceStorageError } from "../../modules/entitlements/application/private-resource-storage";
import { parsePrivateStorageKey } from "./private-storage-key";

describe("shared private storage key policy", () => {
  it.each([
    "resources/abc/v1.pdf",
    "resources/abc-123/v1_2.ebook",
    "catalog/product.v2/file-01.zip",
  ])("accepts safe provider-independent key %j", (storageKey) => {
    expect(parsePrivateStorageKey(storageKey)).toEqual({
      key: storageKey,
      segments: storageKey.split("/"),
    });
  });

  it.each([
    "",
    "../secret.pdf",
    "resources/../secret.pdf",
    "resources/./secret.pdf",
    "/absolute/file.pdf",
    "C:\\secret.pdf",
    "resources\\secret.pdf",
    "resources//secret.pdf",
    "resources/\u0000secret.pdf",
    "resources/á.pdf",
    `${"a".repeat(513)}`,
  ])("rejects unsafe storage key %j", (storageKey) => {
    try {
      parsePrivateStorageKey(storageKey);

      throw new Error("expected INVALID_STORAGE_KEY");
    } catch (error) {
      expect(error).toBeInstanceOf(PrivateResourceStorageError);
      expect(error).toMatchObject({
        code: "INVALID_STORAGE_KEY",
        message: "INVALID_STORAGE_KEY",
      });
    }
  });
});
