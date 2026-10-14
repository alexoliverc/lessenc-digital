import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CI_BUILD_CHILD_SYSTEM_NAMES,
  CI_BUILD_VALUES,
  FORBIDDEN_CI_AUTHORITY_NAMES,
  createCiBuildChildEnvironment,
  validateCiBuildEnvironment,
} from "../../../scripts/lib/p17-ci-build-contract.mjs";
import {
  parseP08CommercialEnv,
  parseP09SubmissionEnv,
  parseP11BuyerSessionEnv,
  parseP11PrivateStorageEnv,
  parseP12AdminAuthEnv,
  parseP16PrivateStorageDriverEnv,
  parseServerEnv,
} from "../../lib/config/env-schema";

const repositoryRoot = resolve("synthetic-repository");
const storagePath = resolve("..", "lessenc-ci-private");
type BuildEnvironment = Record<string, string | undefined>;

function validEnvironment(): BuildEnvironment {
  return {
    ...CI_BUILD_VALUES,
    PRIVATE_FILE_STORAGE_PATH: storagePath,
  };
}

function validate(
  environment: BuildEnvironment,
  environmentFiles: readonly string[] = [".env.example"],
) {
  return validateCiBuildEnvironment(environment, {
    repositoryRoot,
    environmentFiles,
  });
}

describe("P17 synthetic CI build contract", () => {
  it("accepts only the canonical verification identity and consumed synthetic app settings", () => {
    const environment = validEnvironment();

    expect(validate(environment)).toEqual([]);
    expect(() => parseServerEnv(environment)).not.toThrow();
    expect(() =>
      parseP08CommercialEnv({
        P08_PRODUCT_ID: environment.P08_PRODUCT_ID,
        P08_OFFER_ID: environment.P08_OFFER_ID,
      }),
    ).not.toThrow();
    expect(() =>
      parseP09SubmissionEnv({ P09_SUBMISSION_SECRET: environment.P09_SUBMISSION_SECRET }),
    ).not.toThrow();
    expect(() =>
      parseP11BuyerSessionEnv({
        P11_BUYER_SESSION_SECRET: environment.P11_BUYER_SESSION_SECRET,
      }),
    ).not.toThrow();
    expect(() =>
      parseP12AdminAuthEnv({ P12_ADMIN_AUTH_SECRET: environment.P12_ADMIN_AUTH_SECRET }),
    ).not.toThrow();
    expect(() =>
      parseP11PrivateStorageEnv({
        PRIVATE_FILE_STORAGE_PATH: environment.PRIVATE_FILE_STORAGE_PATH,
      }),
    ).not.toThrow();
    expect(() =>
      parseP16PrivateStorageDriverEnv({
        PRIVATE_STORAGE_DRIVER: environment.PRIVATE_STORAGE_DRIVER,
      }),
    ).not.toThrow();
  });

  it.each([
    ["APP_ENV", "staging"],
    ["NODE_ENV", "test"],
    ["CI", "false"],
    ["NEXT_TELEMETRY_DISABLED", "0"],
    ["P17_CI_BUILD_ID", "staging"],
    ["APP_URL", "https://staging.lessenc.invalid"],
    ["P08_PRODUCT_ID", "33333333-3333-4333-8333-333333333333"],
    ["P08_OFFER_ID", "44444444-4444-4444-8444-444444444444"],
    ["P09_SUBMISSION_SECRET", "a-real-looking-secret-with-enough-length"],
    ["P10_PAYMENT_CONTINUATION_SECRET", "a-real-looking-secret-with-enough-length"],
    ["P11_BUYER_SESSION_SECRET", "a-real-looking-secret-with-enough-length"],
    ["P12_ADMIN_AUTH_SECRET", "a-real-looking-secret-with-enough-length"],
    ["PRIVATE_STORAGE_DRIVER", "hosted"],
  ])("rejects non-canonical %s", (name, value) => {
    const environment = validEnvironment();
    environment[name] = value;

    expect(validate(environment)).toContain(`${name}_INVALID`);
  });

  it.each(FORBIDDEN_CI_AUTHORITY_NAMES)("rejects hosted authority variable %s", (name) => {
    const environment = validEnvironment();
    environment[name] = "synthetic-but-forbidden";

    expect(validate(environment)).toContain("HOSTED_AUTHORITY_VARIABLE_PRESENT");
  });

  it.each(["HOSTINGER_CUSTOM_SECRET", "MERCADOPAGO_CUSTOM_SECRET", "PRIVATE_STORAGE_S3_CUSTOM"])(
    "rejects authority variable family %s",
    (name) => {
      const environment = validEnvironment();
      environment[name] = "synthetic-but-forbidden";

      expect(validate(environment)).toContain("HOSTED_AUTHORITY_VARIABLE_PRESENT");
    },
  );

  it("rejects storage paths inside the repository", () => {
    const environment = validEnvironment();
    environment.PRIVATE_FILE_STORAGE_PATH = resolve(repositoryRoot, "lessenc-ci-private");

    expect(validate(environment)).toContain("PRIVATE_FILE_STORAGE_PATH_INSIDE_REPOSITORY");
  });

  it("rejects a storage path that is not dedicated to the CI build", () => {
    const environment = validEnvironment();
    environment.PRIVATE_FILE_STORAGE_PATH = resolve("..", "other-storage");

    expect(validate(environment)).toContain("PRIVATE_FILE_STORAGE_PATH_NOT_CI_DEDICATED");
  });

  it.each([".env", ".env.local", ".env.production", ".env.production.local"])(
    "rejects a Next-loadable environment file %s without reading it",
    (fileName) => {
      expect(validate(validEnvironment(), [".env.example", fileName])).toContain(
        "LOADABLE_ENVIRONMENT_FILE_PRESENT",
      );
    },
  );

  it.each([".ENV", ".ENV.LOCAL", ".Env.Production", ".ENV.EXAMPLE"])(
    "rejects case variants of a Next-loadable environment file %s",
    (fileName) => {
      expect(validate(validEnvironment(), [".env.example", fileName])).toContain(
        "LOADABLE_ENVIRONMENT_FILE_PRESENT",
      );
    },
  );

  it.each([
    "database_url",
    "Database_Url",
    "mercadopago_access_token",
    "private_storage_s3_secret_access_key",
    "hostinger_api_token",
  ])("rejects non-canonical or lowercase authority identifier %s", (name) => {
    const environment = validEnvironment();
    environment[name] = "synthetic-but-forbidden";

    expect(validate(environment)).toEqual(
      expect.arrayContaining([
        "ENVIRONMENT_NAME_NOT_CANONICAL",
        "HOSTED_AUTHORITY_VARIABLE_PRESENT",
      ]),
    );
  });

  it("rejects a mixed-case required identifier", () => {
    const environment = validEnvironment();
    delete environment.APP_ENV;
    environment.App_Env = "test";

    expect(validate(environment)).toContain("ENVIRONMENT_NAME_NOT_CANONICAL");
  });

  it("rejects collisions after environment-name normalization", () => {
    const environment = validEnvironment();
    environment.DATABASE_URL = "synthetic-forbidden";
    environment.database_url = "synthetic-forbidden";

    expect(validate(environment)).toContain("ENVIRONMENT_NAME_COLLISION");
  });

  it.each(Object.keys(CI_BUILD_VALUES))("rejects missing required variable %s", (name) => {
    const environment = validEnvironment();
    delete environment[name];

    expect(validate(environment)).toContain(`${name}_INVALID`);
  });

  it("rejects a missing private storage path", () => {
    const environment = validEnvironment();
    delete environment.PRIVATE_FILE_STORAGE_PATH;

    expect(validate(environment)).toContain("PRIVATE_FILE_STORAGE_PATH_NOT_ABSOLUTE");
  });

  it("builds an allowlisted child environment without inherited credentials or npm_execpath", () => {
    const environment = {
      ...validEnvironment(),
      PATH: "synthetic-path",
      SystemRoot: "synthetic-system-root",
      GITHUB_TOKEN: "must-not-cross-boundary",
      npm_execpath: "must-not-cross-boundary",
      UNEXPECTED_CREDENTIAL: "must-not-cross-boundary",
    };

    const childEnvironment = createCiBuildChildEnvironment(environment);
    const expectedNames = new Set([
      ...Object.keys(CI_BUILD_VALUES),
      "PRIVATE_FILE_STORAGE_PATH",
      "PATH",
      "SystemRoot",
    ]);

    expect(new Set(Object.keys(childEnvironment))).toEqual(expectedNames);
    expect(childEnvironment.GITHUB_TOKEN).toBeUndefined();
    expect(childEnvironment.npm_execpath).toBeUndefined();
    expect(childEnvironment.UNEXPECTED_CREDENTIAL).toBeUndefined();
    expect(CI_BUILD_CHILD_SYSTEM_NAMES).toContain("PATH");
  });

  it("never includes rejected values in failure codes", () => {
    const environment = validEnvironment();
    const rejectedValue = "credential-value-that-must-not-be-reported";
    environment.database_url = rejectedValue;

    expect(JSON.stringify(validate(environment))).not.toContain(rejectedValue);
  });
});
