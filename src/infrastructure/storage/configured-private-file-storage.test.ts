import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PrivateResourceStorageError } from "../../modules/entitlements/application/private-resource-storage";
import { createConfiguredPrivateFileStorage } from "./configured-private-file-storage";

const originalEnvironment = process.env.APP_ENV;
const originalDriver = process.env.PRIVATE_STORAGE_DRIVER;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = originalEnvironment;

  if (originalDriver === undefined) delete process.env.PRIVATE_STORAGE_DRIVER;
  else process.env.PRIVATE_STORAGE_DRIVER = originalDriver;
});

describe("P16 configured private storage", () => {
  it("refuses to promote local filesystem storage into staging", async () => {
    process.env.APP_ENV = "staging";
    process.env.PRIVATE_STORAGE_DRIVER = "local-filesystem";

    await expect(
      createConfiguredPrivateFileStorage().stat("resources/example/v1.pdf"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PrivateResourceStorageError>>({
        code: "STORAGE_UNAVAILABLE",
      }),
    );
  });

  it("fails closed while a concrete hosted provider adapter is not configured", async () => {
    process.env.APP_ENV = "staging";
    process.env.PRIVATE_STORAGE_DRIVER = "hosted";

    await expect(
      createConfiguredPrivateFileStorage().open("resources/example/v1.pdf"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PrivateResourceStorageError>>({
        code: "STORAGE_UNAVAILABLE",
      }),
    );
  });
});
