import "server-only";

import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { getP16HostedPrivateStorageEnv } from "../../lib/config/env";

const P16_READINESS_SENTINEL_KEY = "_health/p16-readiness";

export type HostedPrivateStorageReadinessProbe = Readonly<{
  check(): Promise<void>;
}>;

type S3CompatiblePrivateStorageReadinessOptions = Readonly<{
  client: Pick<S3Client, "send">;
  bucket: string;
  sentinelKey: string;
}>;

export class S3CompatiblePrivateStorageReadinessProbe implements HostedPrivateStorageReadinessProbe {
  private readonly client: Pick<S3Client, "send">;

  private readonly bucket: string;

  private readonly sentinelKey: string;

  constructor(options: S3CompatiblePrivateStorageReadinessOptions) {
    if (
      options.bucket.length === 0 ||
      options.bucket.trim() !== options.bucket ||
      options.sentinelKey !== P16_READINESS_SENTINEL_KEY
    ) {
      throw new Error("Invalid private storage readiness configuration");
    }

    this.client = options.client;
    this.bucket = options.bucket;
    this.sentinelKey = options.sentinelKey;
  }

  async check(): Promise<void> {
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.sentinelKey,
      }),
    );

    if (
      typeof response.ContentLength !== "number" ||
      !Number.isSafeInteger(response.ContentLength) ||
      response.ContentLength < 0
    ) {
      throw new Error("Invalid private storage readiness response");
    }
  }
}

export function createConfiguredHostedPrivateStorageReadinessProbe(): HostedPrivateStorageReadinessProbe {
  const hosted = getP16HostedPrivateStorageEnv();
  const client = new S3Client({
    endpoint: hosted.PRIVATE_STORAGE_S3_ENDPOINT,
    region: hosted.PRIVATE_STORAGE_S3_REGION,
    credentials: {
      accessKeyId: hosted.PRIVATE_STORAGE_S3_ACCESS_KEY_ID,
      secretAccessKey: hosted.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY,
    },
  });

  return new S3CompatiblePrivateStorageReadinessProbe({
    client,
    bucket: hosted.PRIVATE_STORAGE_S3_BUCKET,
    sentinelKey: hosted.PRIVATE_STORAGE_HEALTHCHECK_KEY,
  });
}
