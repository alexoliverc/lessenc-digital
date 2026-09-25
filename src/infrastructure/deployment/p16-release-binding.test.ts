import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { validateReleaseCommitBinding } from "../../../scripts/lib/p16-release-binding.mjs";

const guardPath = resolve("scripts/p16-staging-migration-guard.mjs");
const readableSyntheticCaPath = resolve("package.json");

function currentHead(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function guardEnvironment(releaseCommit?: string): NodeJS.ProcessEnv {
  const unique = (name: string) => `${name}-0123456789012345678901234567890123456789`;
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    APP_ENV: "staging",
    NODE_ENV: "production",
    APP_URL: "https://lessenc.com.br",
    P16_STAGING_ENVIRONMENT_ID: "lessenc-staging",
    P16_DATABASE_ACCESS_MODEL: "hostinger-managed-single-user",
    P16_DATABASE_MIGRATION_WINDOW: "enabled",
    DATABASE_URL: "mysql://hostinger:synthetic@db.invalid/lessenc_staging",
    DB_RUNTIME_URL: "mysql://hostinger:synthetic@db.invalid/lessenc_staging",
    DB_TLS_CA_FILE: readableSyntheticCaPath,
    PRIVATE_STORAGE_DRIVER: "hosted",
    P16_PRIVATE_STORAGE_PROVIDER: "r2",
    PRIVATE_STORAGE_S3_ENDPOINT:
      "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    PRIVATE_STORAGE_S3_REGION: "auto",
    PRIVATE_STORAGE_S3_BUCKET: "lessenc-staging-private",
    PRIVATE_STORAGE_S3_ACCESS_KEY_ID: "synthetic-r2-access-key-id",
    PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY: unique("r2-secret"),
    PRIVATE_STORAGE_HEALTHCHECK_KEY: "_health/p16-readiness",
    P16_MERCADOPAGO_CREDENTIAL_SET: "test",
    NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: "APP_USR-public-test-key",
    MERCADOPAGO_ACCESS_TOKEN: `APP_USR-${unique("access")}`,
    MERCADOPAGO_WEBHOOK_SECRET: unique("webhook"),
    P09_SUBMISSION_SECRET: unique("p09"),
    P10_PAYMENT_CONTINUATION_SECRET: unique("p10"),
    P11_BUYER_SESSION_SECRET: unique("p11"),
    P12_ADMIN_AUTH_SECRET: unique("p12"),
    P16_READINESS_TOKEN: unique("p16"),
  };

  if (releaseCommit === undefined) delete environment.P16_RELEASE_COMMIT;
  else environment.P16_RELEASE_COMMIT = releaseCommit;

  return environment;
}

function runGuard(releaseCommit?: string) {
  return spawnSync(process.execPath, [guardPath], {
    cwd: process.cwd(),
    env: guardEnvironment(releaseCommit),
    encoding: "utf8",
  });
}

describe("P16 staging migration release binding", () => {
  it("makes the migration guard eligible only for the exact repository HEAD", () => {
    const result = runGuard(currentHead());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("migration target verified");
  });

  it("refuses a different but syntactically valid release commit", () => {
    const result = runGuard("0".repeat(40));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P16_RELEASE_COMMIT_DOES_NOT_MATCH_HEAD");
  });

  it("refuses a missing release commit", () => {
    const result = runGuard();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P16_RELEASE_COMMIT_INVALID");
  });

  it("refuses a malformed release commit", () => {
    const result = runGuard("not-a-commit");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P16_RELEASE_COMMIT_INVALID");
  });

  it("fails closed when repository HEAD cannot be resolved", () => {
    const failures = validateReleaseCommitBinding(currentHead(), () => {
      throw new Error("synthetic git lookup failure");
    });

    expect(failures).toContain("P16_RELEASE_COMMIT_HEAD_UNVERIFIABLE");
  });
});
