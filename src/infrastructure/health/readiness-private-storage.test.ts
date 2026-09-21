import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const databaseQuery = vi.hoisted(() => vi.fn());
const databaseQueryUnsafe = vi.hoisted(() => vi.fn());

vi.mock("@/infrastructure/database/client", () => ({
  getDatabaseClient: () => ({
    $queryRaw: databaseQuery,
    $queryRawUnsafe: databaseQueryUnsafe,
  }),
}));

import { S3CompatiblePrivateStorageReadinessProbe } from "@/infrastructure/storage/hosted-private-storage-readiness";

import { runReadinessProbe } from "./readiness-probes";

const CORRELATION_ID = "11111111-1111-4111-8111-111111111111";
const SENTINEL_KEY = "_health/p16-readiness";
const BUCKET = "lessenc-staging-private";

const ENV_KEYS = [
  "APP_ENV",
  "DB_RUNTIME_URL",
  "P16_DATABASE_ACCESS_MODEL",
  "P16_DATABASE_MIGRATION_WINDOW",
  "PRIVATE_STORAGE_DRIVER",
  "PRIVATE_FILE_STORAGE_PATH",
  "P16_PRIVATE_STORAGE_PROVIDER",
  "PRIVATE_STORAGE_S3_ENDPOINT",
  "PRIVATE_STORAGE_S3_REGION",
  "PRIVATE_STORAGE_S3_BUCKET",
  "PRIVATE_STORAGE_S3_ACCESS_KEY_ID",
  "PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY",
  "PRIVATE_STORAGE_HEALTHCHECK_KEY",
] as const;

const originalEnvironment = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function configureDatabaseReady(): void {
  process.env.DB_RUNTIME_URL = "mysql://runtime:synthetic@db.invalid/lessenc_staging";
  process.env.P16_DATABASE_ACCESS_MODEL = "distinct-users";
  process.env.P16_DATABASE_MIGRATION_WINDOW = "disabled";

  databaseQuery.mockResolvedValue([{ readiness: 1 }]);
  databaseQueryUnsafe.mockResolvedValue([
    {
      "Grants for runtime@%": "GRANT USAGE ON *.* TO `runtime`@`%`",
    },
    {
      "Grants for runtime@%":
        "GRANT SELECT, INSERT, UPDATE, DELETE ON `lessenc_staging`.* TO `runtime`@`%`",
    },
  ]);
}

function configureSyntheticHostedStorage(): void {
  process.env.APP_ENV = "staging";
  process.env.PRIVATE_STORAGE_DRIVER = "hosted";
  process.env.P16_PRIVATE_STORAGE_PROVIDER = "r2";
  process.env.PRIVATE_STORAGE_S3_ENDPOINT =
    "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com";
  process.env.PRIVATE_STORAGE_S3_REGION = "auto";
  process.env.PRIVATE_STORAGE_S3_BUCKET = BUCKET;
  process.env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID = "synthetic-r2-access-key-id";
  process.env.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY =
    "synthetic-r2-secret-access-key-material-000000000";
  process.env.PRIVATE_STORAGE_HEALTHCHECK_KEY = SENTINEL_KEY;
}

function providerError(name: string, httpStatusCode?: number): Error {
  return Object.assign(new Error("provider-private-detail"), {
    name,
    ...(httpStatusCode === undefined ? {} : { $metadata: { httpStatusCode } }),
  });
}

function storageCheck(report: Awaited<ReturnType<typeof runReadinessProbe>>) {
  return report.checks.find((check) => check.name === "PRIVATE_STORAGE");
}

function createHostedStorage(send: ReturnType<typeof vi.fn>) {
  const readinessProbe = new S3CompatiblePrivateStorageReadinessProbe({
    client: { send } as unknown as S3Client,
    bucket: BUCKET,
    sentinelKey: SENTINEL_KEY,
  });

  return {
    resolveHostedPrivateStorage: async () => readinessProbe,
  };
}

beforeEach(() => {
  configureDatabaseReady();
  configureSyntheticHostedStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
  databaseQuery.mockReset();
  databaseQueryUnsafe.mockReset();

  for (const key of ENV_KEYS) {
    const original = originalEnvironment.get(key);
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe("P16 H3-D private readiness sentinel", () => {
  it("uses only HeadObject for the exact private sentinel and reports storage READY", async () => {
    const send = vi.fn();
    send.mockResolvedValueOnce({ ContentLength: 0 });

    const report = await runReadinessProbe(CORRELATION_ID, createHostedStorage(send));

    expect(report.status).toBe("READY");
    expect(storageCheck(report)).toEqual({ name: "PRIVATE_STORAGE", ready: true });
    expect(send).toHaveBeenCalledTimes(1);

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(HeadObjectCommand);
    expect(command).not.toBeInstanceOf(GetObjectCommand);
    expect((command as HeadObjectCommand).input).toEqual({
      Bucket: BUCKET,
      Key: SENTINEL_KEY,
    });
  });

  it("maps a missing sentinel to generic NOT_READY without provider disclosure", async () => {
    const send = vi.fn();
    send.mockRejectedValueOnce(providerError("NoSuchKey", 404));
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const report = await runReadinessProbe(CORRELATION_ID, createHostedStorage(send));
    const serialized = JSON.stringify({ report, logs: output.mock.calls });

    expect(report.status).toBe("NOT_READY");
    expect(storageCheck(report)).toEqual({
      name: "PRIVATE_STORAGE",
      ready: false,
      failureCode: "STORAGE_ROOT_UNAVAILABLE",
    });
    expect(serialized).not.toContain("provider-private-detail");
    expect(serialized).not.toContain(BUCKET);
    expect(serialized).not.toContain(SENTINEL_KEY);
    expect(serialized).not.toContain("cloudflarestorage");
  });

  it.each([
    ["missing bucket", "NoSuchBucket", 404],
    ["authentication", "InvalidAccessKeyId", 403],
    ["authorization", "AccessDenied", 403],
    ["network", "TimeoutError", undefined],
    ["TLS", "TlsError", undefined],
  ])("fails closed when the provider reports %s failure", async (_case, name, status) => {
    const send = vi.fn();
    send.mockRejectedValueOnce(providerError(name, status));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const report = await runReadinessProbe(CORRELATION_ID, createHostedStorage(send));

    expect(report.status).toBe("NOT_READY");
    expect(storageCheck(report)?.ready).toBe(false);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
  });

  it("fails closed when HeadObject resolves with an unexpected metadata response", async () => {
    const send = vi.fn().mockResolvedValue({});
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const report = await runReadinessProbe(CORRELATION_ID, createHostedStorage(send));

    expect(report.status).toBe("NOT_READY");
    expect(storageCheck(report)?.ready).toBe(false);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
  });

  it("fails closed on malformed hosted configuration before provider access", async () => {
    process.env.PRIVATE_STORAGE_S3_ENDPOINT = "https://example.invalid";
    const send = vi.spyOn(
      S3Client.prototype as unknown as { send(command: unknown): Promise<unknown> },
      "send",
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const report = await runReadinessProbe(CORRELATION_ID);

    expect(report.status).toBe("NOT_READY");
    expect(storageCheck(report)?.ready).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("calls only the provider-neutral metadata check through the injected boundary", async () => {
    const check = vi.fn().mockResolvedValue(undefined);

    const report = await runReadinessProbe(CORRELATION_ID, {
      resolveHostedPrivateStorage: async () => ({ check }),
    });

    expect(report.status).toBe("READY");
    expect(check).toHaveBeenCalledOnce();
  });

  it("preserves local/test readiness without resolving hosted storage", async () => {
    process.env.APP_ENV = "test";
    process.env.PRIVATE_STORAGE_DRIVER = "local-filesystem";
    process.env.PRIVATE_FILE_STORAGE_PATH = process.cwd();
    const resolveHostedPrivateStorage = vi.fn();

    const report = await runReadinessProbe(CORRELATION_ID, { resolveHostedPrivateStorage });

    expect(report.status).toBe("READY");
    expect(storageCheck(report)).toEqual({ name: "PRIVATE_STORAGE", ready: true });
    expect(resolveHostedPrivateStorage).not.toHaveBeenCalled();
  });

  it.each(["staging", "production"])(
    "keeps local filesystem forbidden as %s storage authority",
    async (applicationEnvironment) => {
      process.env.APP_ENV = applicationEnvironment;
      process.env.PRIVATE_STORAGE_DRIVER = "local-filesystem";
      const resolveHostedPrivateStorage = vi.fn();

      const report = await runReadinessProbe(CORRELATION_ID, { resolveHostedPrivateStorage });

      expect(report.status).toBe("NOT_READY");
      expect(storageCheck(report)?.ready).toBe(false);
      expect(resolveHostedPrivateStorage).not.toHaveBeenCalled();
    },
  );
});
