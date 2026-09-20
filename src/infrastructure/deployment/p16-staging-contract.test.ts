import { describe, expect, it } from "vitest";

import { validateStagingEnvironment } from "../../../scripts/lib/p16-staging-contract.mjs";

function validEnvironment(): Record<string, string> {
  const unique = (name: string) => `${name}-0123456789012345678901234567890123456789`;
  return {
    APP_ENV: "staging",
    NODE_ENV: "production",
    APP_URL: "https://lessenc.com.br",
    P16_STAGING_ENVIRONMENT_ID: "lessenc-staging",
    P16_DATABASE_ACCESS_MODEL: "distinct-users",
    P16_DATABASE_MIGRATION_WINDOW: "disabled",
    P16_RELEASE_COMMIT: "a".repeat(40),
    DATABASE_URL: "mysql://migrate:secret@db.example/staging_lessenc",
    DB_RUNTIME_URL: "mysql://runtime:secret@db.example/staging_lessenc",
    DB_TLS_CA_FILE: "C:\\hosted\\ca.pem",
    PRIVATE_STORAGE_DRIVER: "hosted",
    P16_PRIVATE_STORAGE_PROVIDER: "r2",
    PRIVATE_STORAGE_S3_ENDPOINT:
      "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    PRIVATE_STORAGE_S3_REGION: "auto",
    PRIVATE_STORAGE_S3_BUCKET: "lessenc-staging-private",
    PRIVATE_STORAGE_S3_ACCESS_KEY_ID: "synthetic-r2-access-key-id",
    PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY: unique("r2-secret"),
    PRIVATE_STORAGE_HEALTHCHECK_KEY: "_health/p16-readiness",
    NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: "TEST-public-key",
    MERCADOPAGO_ACCESS_TOKEN: `TEST-${unique("access")}`,
    MERCADOPAGO_WEBHOOK_SECRET: unique("webhook"),
    P09_SUBMISSION_SECRET: unique("p09"),
    P10_PAYMENT_CONTINUATION_SECRET: unique("p10"),
    P11_BUYER_SESSION_SECRET: unique("p11"),
    P12_ADMIN_AUTH_SECRET: unique("p12"),
    P16_READINESS_TOKEN: unique("p16"),
  };
}

describe("P16 staging configuration contract", () => {
  it("accepts isolated staging identities without exposing values", () => {
    expect(validateStagingEnvironment(validEnvironment())).toEqual([]);
  });

  it("rejects local, production-like, shared-credential and non-TEST targets", () => {
    const env = validEnvironment();
    env.APP_ENV = "production";
    env.DATABASE_URL = "mysql://same:secret@localhost/lessenc_prod";
    env.DB_RUNTIME_URL = env.DATABASE_URL;
    env.MERCADOPAGO_ACCESS_TOKEN = "APP_USR-production-shaped-token-value";
    env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY = "APP_USR-public";

    expect(validateStagingEnvironment(env)).toEqual(
      expect.arrayContaining([
        "APP_ENV_INVALID",
        "DATABASE_URL_NOT_UNAMBIGUOUS_STAGING",
        "DB_RUNTIME_URL_NOT_UNAMBIGUOUS_STAGING",
        "DATABASE_USERS_MUST_BE_DISTINCT",
        "MERCADOPAGO_ACCESS_TOKEN_NOT_TEST",
        "MERCADOPAGO_PUBLIC_KEY_NOT_TEST",
      ]),
    );
  });

  it("preserves the valid legacy distinct-user model", () => {
    const env = validEnvironment();

    expect(validateStagingEnvironment(env, { gate: "runtime" })).toEqual([]);
  });

  it("accepts an explicit Hostinger managed single-user runtime model", () => {
    const env = validEnvironment();
    env.P16_DATABASE_ACCESS_MODEL = "hostinger-managed-single-user";
    env.DATABASE_URL = "mysql://hostinger:secret@db.example/lessenc_staging";
    env.DB_RUNTIME_URL = env.DATABASE_URL;

    expect(validateStagingEnvironment(env, { gate: "runtime" })).toEqual([]);
  });

  it("never infers Hostinger mode merely because usernames match", () => {
    const env = validEnvironment();
    env.DB_RUNTIME_URL = "mysql://migrate:other-secret@db.example/staging_lessenc";

    expect(validateStagingEnvironment(env)).toContain("DATABASE_USERS_MUST_BE_DISTINCT");
  });

  it("requires the same physical identity in explicit Hostinger mode", () => {
    const env = validEnvironment();
    env.P16_DATABASE_ACCESS_MODEL = "hostinger-managed-single-user";

    expect(validateStagingEnvironment(env)).toContain(
      "HOSTINGER_MANAGED_DATABASE_IDENTITY_MISMATCH",
    );
  });

  it("rejects a migration outside an explicit command-scoped window", () => {
    const env = validEnvironment();

    expect(validateStagingEnvironment(env, { gate: "migration" })).toContain(
      "P16_DATABASE_MIGRATION_WINDOW_REQUIRED",
    );
  });

  it("accepts a fully synthetic Hostinger migration window", () => {
    const env = validEnvironment();
    env.P16_DATABASE_ACCESS_MODEL = "hostinger-managed-single-user";
    env.P16_DATABASE_MIGRATION_WINDOW = "enabled";
    env.DATABASE_URL = "mysql://hostinger:secret@db.example/lessenc_staging";
    env.DB_RUNTIME_URL = env.DATABASE_URL;

    expect(validateStagingEnvironment(env, { gate: "migration" })).toEqual([]);
  });

  it("requires the migration window to be disabled for the ordinary runtime gate", () => {
    const env = validEnvironment();
    env.P16_DATABASE_MIGRATION_WINDOW = "enabled";

    expect(validateStagingEnvironment(env, { gate: "runtime" })).toContain(
      "P16_DATABASE_MIGRATION_WINDOW_MUST_BE_DISABLED",
    );
  });

  it.each([
    {
      DATABASE_URL: "mysql://migrate:secret@one.example/lessenc_staging",
      DB_RUNTIME_URL: "mysql://runtime:secret@two.example/lessenc_staging",
      failure: "DATABASE_TARGETS_DO_NOT_MATCH",
    },
    {
      DATABASE_URL: "mysql://migrate:secret@localhost/lessenc_staging",
      DB_RUNTIME_URL: "mysql://runtime:secret@localhost/lessenc_staging",
      failure: "DATABASE_URL_NOT_UNAMBIGUOUS_STAGING",
    },
    {
      DATABASE_URL: "mysql://migrate:secret@db.example/lessenc_staging_prod",
      DB_RUNTIME_URL: "mysql://runtime:secret@db.example/lessenc_staging_prod",
      failure: "DATABASE_URL_NOT_UNAMBIGUOUS_STAGING",
    },
    {
      DATABASE_URL: "mysql://migrate:secret@db.example/lessenc_stagingproduction",
      DB_RUNTIME_URL: "mysql://runtime:secret@db.example/lessenc_stagingproduction",
      failure: "DATABASE_URL_NOT_UNAMBIGUOUS_STAGING",
    },
    {
      DATABASE_URL: "mysql://migrate:secret@db.example/backstage_lessenc",
      DB_RUNTIME_URL: "mysql://runtime:secret@db.example/backstage_lessenc",
      failure: "DATABASE_URL_NOT_UNAMBIGUOUS_STAGING",
    },
  ])("rejects unsafe database targets: $failure", ({ DATABASE_URL, DB_RUNTIME_URL, failure }) => {
    const env = validEnvironment();
    env.DATABASE_URL = DATABASE_URL;
    env.DB_RUNTIME_URL = DB_RUNTIME_URL;

    expect(validateStagingEnvironment(env)).toContain(failure);
  });

  it("rejects missing TLS CA and malformed access control values", () => {
    const env = validEnvironment();
    env.DB_TLS_CA_FILE = "relative/ca.pem";
    env.P16_DATABASE_ACCESS_MODEL = "automatic";
    env.P16_DATABASE_MIGRATION_WINDOW = "sometimes";

    expect(validateStagingEnvironment(env)).toEqual(
      expect.arrayContaining([
        "DB_TLS_CA_FILE_MUST_BE_ABSOLUTE",
        "P16_DATABASE_ACCESS_MODEL_INVALID",
        "P16_DATABASE_MIGRATION_WINDOW_INVALID",
      ]),
    );
  });
});

// P16-H3-B2-STAGING-STORAGE-CONTRACT
describe("P16 hosted private storage staging contract", () => {
  it("accepts the frozen Cloudflare R2 environment contract", () => {
    expect(validateStagingEnvironment(validEnvironment())).toEqual([]);
  });

  it("rejects provider, endpoint, region, bucket, access-key and sentinel drift", () => {
    const env = validEnvironment();

    env.P16_PRIVATE_STORAGE_PROVIDER = "other";
    env.PRIVATE_STORAGE_S3_ENDPOINT = "http://storage.example.com";
    env.PRIVATE_STORAGE_S3_REGION = "us-east-1";
    env.PRIVATE_STORAGE_S3_BUCKET = "Invalid Bucket";
    env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID = "short";
    env.PRIVATE_STORAGE_HEALTHCHECK_KEY = "_health/other";

    expect(validateStagingEnvironment(env)).toEqual(
      expect.arrayContaining([
        "P16_PRIVATE_STORAGE_PROVIDER_INVALID",
        "PRIVATE_STORAGE_S3_ENDPOINT_INVALID",
        "PRIVATE_STORAGE_S3_REGION_INVALID",
        "PRIVATE_STORAGE_S3_BUCKET_INVALID",
        "PRIVATE_STORAGE_S3_ACCESS_KEY_ID_MISSING_OR_INVALID",
        "PRIVATE_STORAGE_HEALTHCHECK_KEY_INVALID",
      ]),
    );
  });

  it("rejects missing or weak hosted storage secret material", () => {
    const env = validEnvironment();

    env.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY = "too-short";

    expect(validateStagingEnvironment(env)).toContain(
      "PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY_MISSING_OR_WEAK",
    );
  });

  it("forbids reuse of the R2 runtime secret with another staging secret", () => {
    const env = validEnvironment();

    env.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY = env.P16_READINESS_TOKEN!;

    expect(validateStagingEnvironment(env)).toContain("STAGING_SECRET_REUSE_FORBIDDEN");
  });
});
