import { GetObjectCommand, HeadObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { PrivateResourceStorageError } from "../../modules/entitlements/application/private-resource-storage";
import { S3CompatiblePrivateResourceStorage } from "./s3-compatible-private-resource-storage";

const BUCKET = "lessenc-staging-private";
const KEY = "resources/abc/v1.pdf";

function fixture() {
  const send = vi.fn();

  const client = {
    send,
  } as unknown as S3Client;

  return {
    send,
    storage: new S3CompatiblePrivateResourceStorage({
      client,
      bucket: BUCKET,
    }),
  };
}

function providerError(
  name: string,
  httpStatusCode?: number,
): Error & {
  $metadata?: {
    httpStatusCode: number;
  };
} {
  return Object.assign(new Error("provider-private-detail"), {
    name,
    ...(httpStatusCode === undefined
      ? {}
      : {
          $metadata: {
            httpStatusCode,
          },
        }),
  });
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

describe("S3CompatiblePrivateResourceStorage", () => {
  it("maps stat to HeadObject and returns only bounded size metadata", async () => {
    const { send, storage } = fixture();

    send.mockResolvedValueOnce({
      ContentLength: 3,
      ETag: '"etag-v1"',
    });

    await expect(storage.stat(KEY)).resolves.toEqual({
      sizeBytes: 3,
    });

    expect(send).toHaveBeenCalledTimes(1);

    const command = send.mock.calls[0]?.[0];

    expect(command).toBeInstanceOf(HeadObjectCommand);

    expect((command as HeadObjectCommand).input).toEqual({
      Bucket: BUCKET,
      Key: KEY,
    });
  });

  it("rejects an unsafe storage key before any provider call", async () => {
    const { send, storage } = fixture();

    await expect(storage.stat("../secret.pdf")).rejects.toMatchObject({
      code: "INVALID_STORAGE_KEY",
      message: "INVALID_STORAGE_KEY",
    });

    expect(send).not.toHaveBeenCalled();
  });

  it.each([undefined, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "fails closed on unsafe HeadObject ContentLength %j",
    async (contentLength) => {
      const { send, storage } = fixture();

      send.mockResolvedValueOnce({
        ContentLength: contentLength,
      });

      await expect(storage.stat(KEY)).rejects.toMatchObject({
        code: "STORAGE_UNAVAILABLE",
      });
    },
  );

  it("normalizes a known missing object to RESOURCE_NOT_FOUND", async () => {
    const { send, storage } = fixture();

    send.mockRejectedValueOnce(providerError("NoSuchKey", 404));

    await expect(storage.stat(KEY)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      message: "RESOURCE_NOT_FOUND",
    });
  });

  it("does not classify a missing bucket or bare 404 as a missing buyer object", async () => {
    const missingBucket = fixture();

    missingBucket.send.mockRejectedValueOnce(providerError("NoSuchBucket", 404));

    await expect(missingBucket.storage.stat(KEY)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });

    const generic404 = fixture();

    generic404.send.mockRejectedValueOnce(providerError("ProviderFailure", 404));

    await expect(generic404.storage.stat(KEY)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
  });

  it("uses the HeadObject ETag as GetObject IfMatch on the immediate open", async () => {
    const { send, storage } = fixture();

    send
      .mockResolvedValueOnce({
        ContentLength: 3,
        ETag: '"etag-v1"',
      })
      .mockResolvedValueOnce({
        ContentLength: 3,
        Body: (async function* () {
          yield new Uint8Array([1, 2, 3]);
        })(),
      });

    await storage.stat(KEY);

    const body = await storage.open(KEY);

    await expect(consume(body)).resolves.toEqual(new Uint8Array([1, 2, 3]));

    const command = send.mock.calls[1]?.[0];

    expect(command).toBeInstanceOf(GetObjectCommand);

    expect((command as GetObjectCommand).input).toEqual({
      Bucket: BUCKET,
      Key: KEY,
      IfMatch: '"etag-v1"',
    });
  });

  it("streams GetObject incrementally instead of buffering the complete resource", async () => {
    const { send, storage } = fixture();

    let pulls = 0;

    async function* providerBody() {
      pulls += 1;
      yield new Uint8Array([1, 2]);

      pulls += 1;
      yield new Uint8Array([3, 4]);
    }

    send.mockResolvedValueOnce({
      Body: providerBody(),
    });

    const body = await storage.open(KEY);

    expect(pulls).toBe(0);

    const iterator = body[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: new Uint8Array([1, 2]),
    });

    expect(pulls).toBe(1);

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: new Uint8Array([3, 4]),
    });

    expect(pulls).toBe(2);

    await iterator.return?.();
  });

  it("fails closed when GetObject does not return an async-iterable body", async () => {
    const { send, storage } = fixture();

    send.mockResolvedValueOnce({
      Body: undefined,
    });

    await expect(storage.open(KEY)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
  });

  it("normalizes a missing object observed by GetObject", async () => {
    const { send, storage } = fixture();

    send.mockRejectedValueOnce(providerError("NotFound", 404));

    await expect(storage.open(KEY)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });

  it("fails closed when object length changes between stat and open", async () => {
    const { send, storage } = fixture();

    send
      .mockResolvedValueOnce({
        ContentLength: 3,
        ETag: '"etag-v1"',
      })
      .mockResolvedValueOnce({
        ContentLength: 4,
        Body: (async function* () {
          yield new Uint8Array([1, 2, 3, 4]);
        })(),
      });

    await storage.stat(KEY);

    await expect(storage.open(KEY)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
  });

  it("fails closed on GetObject precondition failure without leaking provider detail", async () => {
    const { send, storage } = fixture();

    send
      .mockResolvedValueOnce({
        ContentLength: 3,
        ETag: '"etag-v1"',
      })
      .mockRejectedValueOnce(providerError("PreconditionFailed", 412));

    await storage.stat(KEY);

    try {
      await storage.open(KEY);

      throw new Error("expected storage failure");
    } catch (error) {
      expect(error).toBeInstanceOf(PrivateResourceStorageError);
      expect(error).toMatchObject({
        code: "STORAGE_UNAVAILABLE",
        message: "STORAGE_UNAVAILABLE",
      });

      expect(String(error)).not.toContain("provider-private-detail");
    }
  });

  it("normalizes provider stream failure while preserving incremental delivery semantics", async () => {
    const { send, storage } = fixture();

    async function* failingProviderBody() {
      yield new Uint8Array([1]);

      throw new Error("provider-secret-stream-detail");
    }

    send.mockResolvedValueOnce({
      Body: failingProviderBody(),
    });

    const body = await storage.open(KEY);

    const iterator = body[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: new Uint8Array([1]),
    });

    try {
      await iterator.next();

      throw new Error("expected streaming failure");
    } catch (error) {
      expect(error).toBeInstanceOf(PrivateResourceStorageError);
      expect(error).toMatchObject({
        code: "STORAGE_UNAVAILABLE",
        message: "STORAGE_UNAVAILABLE",
      });

      expect(String(error)).not.toContain("provider-secret-stream-detail");
    }
  });

  it("rejects unexpected provider chunk shapes", async () => {
    const { send, storage } = fixture();

    send.mockResolvedValueOnce({
      Body: (async function* () {
        yield "unexpected-string-chunk";
      })(),
    });

    const body = await storage.open(KEY);

    await expect(body[Symbol.asyncIterator]().next()).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
  });
});
