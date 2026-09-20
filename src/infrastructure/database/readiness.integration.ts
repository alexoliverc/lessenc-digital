import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runReadinessProbe } from "@/infrastructure/health/readiness-probes";

describe("P15 readiness against isolated MySQL and private storage", () => {
  let storageRoot: string;
  const originalDatabaseUrl = process.env.DB_RUNTIME_URL;
  const originalStorageRoot = process.env.PRIVATE_FILE_STORAGE_PATH;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error("TEST_DATABASE_URL_REQUIRED");
    }

    storageRoot = await mkdtemp(join(tmpdir(), "lessenc-p15-readiness-"));
    process.env.DB_RUNTIME_URL = process.env.TEST_DATABASE_URL;
    process.env.PRIVATE_FILE_STORAGE_PATH = storageRoot;
  });

  afterAll(async () => {
    if (originalDatabaseUrl === undefined) delete process.env.DB_RUNTIME_URL;
    else process.env.DB_RUNTIME_URL = originalDatabaseUrl;

    if (originalStorageRoot === undefined) delete process.env.PRIVATE_FILE_STORAGE_PATH;
    else process.env.PRIVATE_FILE_STORAGE_PATH = originalStorageRoot;

    await rm(storageRoot, { recursive: true, force: true });
  });

  it("reports every essential check ready without mutating application state", async () => {
    const report = await runReadinessProbe();

    expect(report).toEqual({
      status: "READY",
      checks: [
        { name: "APPLICATION_CONTRACT", ready: true },
        { name: "DATABASE_CONNECTIVITY", ready: true },
        { name: "PRIVATE_STORAGE", ready: true },
      ],
    });
  }, 30_000);
});
