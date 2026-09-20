import { describe, expect, it } from "vitest";

import { validateStagingEnvironment } from "../../../scripts/lib/p16-staging-contract.mjs";

function validEnvironment(): Record<string, string> {
  const unique = (name: string) => `${name}-0123456789012345678901234567890123456789`;
  return {
    APP_ENV: "staging",
    NODE_ENV: "production",
    APP_URL: "https://lessenc.com.br",
    P16_STAGING_ENVIRONMENT_ID: "lessenc-staging",
    P16_RELEASE_COMMIT: "a".repeat(40),
    DATABASE_URL: "mysql://migrate:secret@db.example/staging_lessenc",
    DB_RUNTIME_URL: "mysql://runtime:secret@db.example/staging_lessenc",
    DB_TLS_CA_FILE: "C:\\hosted\\ca.pem",
    PRIVATE_STORAGE_DRIVER: "hosted",
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
        "DATABASE_PRIVILEGE_BOUNDARY_MISSING",
        "DATABASE_USERS_MUST_BE_DISTINCT",
        "MERCADOPAGO_ACCESS_TOKEN_NOT_TEST",
        "MERCADOPAGO_PUBLIC_KEY_NOT_TEST",
      ]),
    );
  });
});
