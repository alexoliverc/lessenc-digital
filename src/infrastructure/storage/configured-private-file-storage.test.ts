import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PrivateResourceStorageError } from "../../modules/entitlements/application/private-resource-storage";
import { createConfiguredPrivateFileStorage } from "./configured-private-file-storage";

const STORAGE_KEY = "resources/example/v1.pdf";
const BUCKET = "lessenc-staging-private";

const ENV_KEYS = [
  "APP_ENV",
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

function clearHostedEnvironment(): void {
  delete process.env.P16_PRIVATE_STORAGE_PROVIDER;
  delete process.env.PRIVATE_STORAGE_S3_ENDPOINT;
  delete process.env.PRIVATE_STORAGE_S3_REGION;
  delete process.env.PRIVATE_STORAGE_S3_BUCKET;
  delete process.env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID;
  delete process.env.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY;
  delete process.env.PRIVATE_STORAGE_HEALTHCHECK_KEY;
}

function configureSyntheticHostedEnvironment(): void {
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
  process.env.PRIVATE_STORAGE_HEALTHCHECK_KEY = "_health/p16-readiness";
}

async function* syntheticBody(): AsyncGenerator<Uint8Array> {
  yield new Uint8Array([1, 2]);
  yield new Uint8Array([3]);
}

async function consume(body: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of body) {
    chunks.push(chunk);
  }

  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);

  const combined = new Uint8Array(size);

  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return combined;
}

afterEach(() => {
  vi.restoreAllMocks();

  for (const key of ENV_KEYS) {
    const original = originalEnvironment.get(key);

    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

describe("P16 configured private storage", () => {
  it.each(["staging", "production"])(
    "refuses to promote local filesystem storage into %s",
    async (applicationEnvironment) => {
      const send = vi.spyOn(
        S3Client.prototype as unknown as {
          send(command: unknown): Promise<unknown>;
        },
        "send",
      );

      process.env.APP_ENV = applicationEnvironment;
      process.env.PRIVATE_STORAGE_DRIVER = "local-filesystem";

      await expect(createConfiguredPrivateFileStorage().stat(STORAGE_KEY)).rejects.toEqual(
        expect.objectContaining<Partial<PrivateResourceStorageError>>({
          code: "STORAGE_UNAVAILABLE",
        }),
      );

      expect(send).not.toHaveBeenCalled();
    },
  );

  it("keeps hosted configuration and provider access lazy until storage is used", async () => {
    const send = vi.spyOn(
      S3Client.prototype as unknown as {
        send(command: unknown): Promise<unknown>;
      },
      "send",
    );

    process.env.APP_ENV = "staging";
    process.env.PRIVATE_STORAGE_DRIVER = "hosted";

    clearHostedEnvironment();

    expect(() => createConfiguredPrivateFileStorage()).not.toThrow();

    expect(send).not.toHaveBeenCalled();

    await expect(createConfiguredPrivateFileStorage().stat(STORAGE_KEY)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      message: "STORAGE_UNAVAILABLE",
    });

    expect(send).not.toHaveBeenCalled();
  });

  it("resolves the synthetic hosted R2 adapter and reuses it for stat and open", async () => {
    configureSyntheticHostedEnvironment();

    const send = vi.spyOn(
      S3Client.prototype as unknown as {
        send(command: unknown): Promise<unknown>;
      },
      "send",
    );

    send
      .mockResolvedValueOnce({
        ContentLength: 3,
        ETag: '"configured-etag-v1"',
      })
      .mockResolvedValueOnce({
        ContentLength: 3,
        Body: syntheticBody(),
      });

    const storage = createConfiguredPrivateFileStorage();

    expect(send).not.toHaveBeenCalled();

    await expect(storage.stat(STORAGE_KEY)).resolves.toEqual({
      sizeBytes: 3,
    });

    const body = await storage.open(STORAGE_KEY);

    await expect(consume(body)).resolves.toEqual(new Uint8Array([1, 2, 3]));

    expect(send).toHaveBeenCalledTimes(2);

    const headCommand = send.mock.calls[0]?.[0];
    const getCommand = send.mock.calls[1]?.[0];

    expect(headCommand).toBeInstanceOf(HeadObjectCommand);
    expect(getCommand).toBeInstanceOf(GetObjectCommand);

    expect((headCommand as HeadObjectCommand).input).toEqual({
      Bucket: BUCKET,
      Key: STORAGE_KEY,
    });

    expect((getCommand as GetObjectCommand).input).toEqual({
      Bucket: BUCKET,
      Key: STORAGE_KEY,
      IfMatch: '"configured-etag-v1"',
    });
  });

  it("normalizes invalid hosted configuration without provider access", async () => {
    const send = vi.spyOn(
      S3Client.prototype as unknown as {
        send(command: unknown): Promise<unknown>;
      },
      "send",
    );

    configureSyntheticHostedEnvironment();

    process.env.PRIVATE_STORAGE_S3_ENDPOINT = "https://example.invalid";

    const storage = createConfiguredPrivateFileStorage();

    await expect(storage.open(STORAGE_KEY)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      message: "STORAGE_UNAVAILABLE",
    });

    expect(send).not.toHaveBeenCalled();
  });
});
