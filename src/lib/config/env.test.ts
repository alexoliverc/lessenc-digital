import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseP08CommercialEnv,
  parseP09SubmissionEnv,
  parseP11BuyerSessionEnv,
  parseP12AdminAuthEnv,
  parseP11PrivateStorageEnv,
  parseP13GoogleTagEnv,
  parseP16ReadinessEnv,
  parseP16PrivateStorageDriverEnv,
  parseP16HostedPrivateStorageEnv,
  parseServerEnv,
} from "./env-schema";

describe("parseServerEnv", () => {
  it.each(["local", "test", "staging", "production"] as const)(
    "accepts the %s application environment",
    (APP_ENV) => {
      expect(parseServerEnv({ APP_ENV }).APP_ENV).toBe(APP_ENV);
    },
  );

  it("rejects a missing or unknown application environment", () => {
    expect(() => parseServerEnv({})).toThrow("Invalid server environment configuration");

    expect(() => parseServerEnv({ APP_ENV: "preview" })).toThrow(
      "Invalid server environment configuration",
    );
  });

  it("keeps APP_ENV independent from NODE_ENV and preserves the APP_URL default", () => {
    expect(parseServerEnv({ APP_ENV: "staging", NODE_ENV: "production" })).toEqual({
      APP_ENV: "staging",
      APP_URL: "http://localhost:3000",
      NODE_ENV: "production",
    });
  });
});

describe("parseP13GoogleTagEnv", () => {
  it("accepts a valid GTM web container identifier", () => {
    expect(
      parseP13GoogleTagEnv({
        GTM_CONTAINER_ID: "GTM-ABC1234",
      }),
    ).toEqual({
      GTM_CONTAINER_ID: "GTM-ABC1234",
    });
  });

  it("keeps Google Tag Manager disabled when configuration is absent or blank", () => {
    expect(parseP13GoogleTagEnv({})).toEqual({
      GTM_CONTAINER_ID: null,
    });

    expect(
      parseP13GoogleTagEnv({
        GTM_CONTAINER_ID: "   ",
      }),
    ).toEqual({
      GTM_CONTAINER_ID: null,
    });
  });

  it("rejects malformed or non-GTM container identifiers", () => {
    expect(() =>
      parseP13GoogleTagEnv({
        GTM_CONTAINER_ID: "G-ABC123",
      }),
    ).toThrow("Invalid P13 Google Tag configuration");

    expect(() =>
      parseP13GoogleTagEnv({
        GTM_CONTAINER_ID: "gtm-abc123",
      }),
    ).toThrow("Invalid P13 Google Tag configuration");

    expect(() =>
      parseP13GoogleTagEnv({
        GTM_CONTAINER_ID: "https://www.googletagmanager.com",
      }),
    ).toThrow("Invalid P13 Google Tag configuration");
  });
});
describe("parseP12AdminAuthEnv", () => {
  const SECRET = "p12-admin-auth-secret-32-bytes-minimum-value";

  it("accepts a dedicated server-only admin auth secret", () => {
    expect(parseP12AdminAuthEnv({ P12_ADMIN_AUTH_SECRET: SECRET })).toEqual({
      P12_ADMIN_AUTH_SECRET: SECRET,
    });
  });

  it("rejects missing or weak admin auth secrets", () => {
    expect(() => parseP12AdminAuthEnv({})).toThrow("Invalid P12 admin auth configuration");
    expect(() => parseP12AdminAuthEnv({ P12_ADMIN_AUTH_SECRET: "too-short" })).toThrow(
      "Invalid P12 admin auth configuration",
    );
  });
});

describe("parseP08CommercialEnv", () => {
  const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
  const OFFER_ID = "22222222-2222-4222-8222-222222222222";

  it("accepts valid Product and Offer UUIDs", () => {
    expect(
      parseP08CommercialEnv({
        P08_PRODUCT_ID: PRODUCT_ID,
        P08_OFFER_ID: OFFER_ID,
      }),
    ).toEqual({
      P08_PRODUCT_ID: PRODUCT_ID,
      P08_OFFER_ID: OFFER_ID,
    });
  });

  it("rejects missing P08 commercial identifiers", () => {
    expect(() => parseP08CommercialEnv({})).toThrow("Invalid P08 commercial configuration");
  });

  it("rejects invalid P08 commercial identifiers", () => {
    expect(() =>
      parseP08CommercialEnv({
        P08_PRODUCT_ID: "cronograma-capilar-inteligente",
        P08_OFFER_ID: "offer",
      }),
    ).toThrow("Invalid P08 commercial configuration");
  });
});

describe("parseP09SubmissionEnv", () => {
  const SECRET = "p09-test-secret-32-bytes-minimum-value";

  it("accepts a server-only checkout submission secret", () => {
    expect(
      parseP09SubmissionEnv({
        P09_SUBMISSION_SECRET: SECRET,
      }),
    ).toEqual({
      P09_SUBMISSION_SECRET: SECRET,
    });
  });

  it("rejects a missing submission secret", () => {
    expect(() => parseP09SubmissionEnv({})).toThrow("Invalid P09 submission configuration");
  });

  it("rejects submission secrets shorter than 32 characters", () => {
    expect(() =>
      parseP09SubmissionEnv({
        P09_SUBMISSION_SECRET: "too-short",
      }),
    ).toThrow("Invalid P09 submission configuration");
  });
});
describe("parseP11BuyerSessionEnv", () => {
  const SECRET = "p11-buyer-session-secret-32-bytes-minimum-value";

  it("accepts a dedicated buyer session secret", () => {
    expect(
      parseP11BuyerSessionEnv({
        P11_BUYER_SESSION_SECRET: SECRET,
      }),
    ).toEqual({
      P11_BUYER_SESSION_SECRET: SECRET,
    });
  });

  it("rejects a missing buyer session secret", () => {
    expect(() => parseP11BuyerSessionEnv({})).toThrow("Invalid P11 buyer session configuration");
  });

  it("rejects buyer session secrets shorter than 32 characters", () => {
    expect(() =>
      parseP11BuyerSessionEnv({
        P11_BUYER_SESSION_SECRET: "too-short",
      }),
    ).toThrow("Invalid P11 buyer session configuration");
  });
});
describe("parseP11PrivateStorageEnv", () => {
  const STORAGE_ROOT = resolve("tmp", "p11-private-storage-test");

  it("accepts an absolute private storage root", () => {
    expect(
      parseP11PrivateStorageEnv({
        PRIVATE_FILE_STORAGE_PATH: STORAGE_ROOT,
      }),
    ).toEqual({
      PRIVATE_FILE_STORAGE_PATH: STORAGE_ROOT,
    });
  });

  it("rejects a missing private storage root", () => {
    expect(() => parseP11PrivateStorageEnv({})).toThrow(
      "Invalid P11 private storage configuration",
    );
  });

  it("rejects a relative private storage root", () => {
    expect(() =>
      parseP11PrivateStorageEnv({
        PRIVATE_FILE_STORAGE_PATH: "private/resources",
      }),
    ).toThrow("Invalid P11 private storage configuration");
  });
});

describe("parseP16ReadinessEnv", () => {
  const TOKEN = "p16-readiness-machine-token-32-bytes-minimum";

  it("accepts a dedicated server-only machine token", () => {
    expect(parseP16ReadinessEnv({ P16_READINESS_TOKEN: TOKEN })).toEqual({
      P16_READINESS_TOKEN: TOKEN,
    });
  });

  it("rejects missing and weak machine tokens", () => {
    expect(() => parseP16ReadinessEnv({})).toThrow("Invalid P16 readiness configuration");
    expect(() => parseP16ReadinessEnv({ P16_READINESS_TOKEN: "too-short" })).toThrow(
      "Invalid P16 readiness configuration",
    );
  });
});

describe("parseP16PrivateStorageDriverEnv", () => {
  it("defaults to the local adapter and recognizes the unresolved hosted boundary", () => {
    expect(parseP16PrivateStorageDriverEnv({})).toEqual({
      PRIVATE_STORAGE_DRIVER: "local-filesystem",
    });
    expect(parseP16PrivateStorageDriverEnv({ PRIVATE_STORAGE_DRIVER: "hosted" })).toEqual({
      PRIVATE_STORAGE_DRIVER: "hosted",
    });
  });

  it("rejects arbitrary provider names", () => {
    expect(() =>
      parseP16PrivateStorageDriverEnv({ PRIVATE_STORAGE_DRIVER: "public-filesystem" }),
    ).toThrow("Invalid P16 private storage configuration");
  });
});

// P16-H3-B2-HOSTED-STORAGE-ENV-TESTS
describe("parseP16HostedPrivateStorageEnv", () => {
  const VALID = Object.freeze({
    P16_PRIVATE_STORAGE_PROVIDER: "r2",
    PRIVATE_STORAGE_S3_ENDPOINT:
      "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    PRIVATE_STORAGE_S3_REGION: "auto",
    PRIVATE_STORAGE_S3_BUCKET: "lessenc-staging-private",
    PRIVATE_STORAGE_S3_ACCESS_KEY_ID: "synthetic-r2-access-key-id",
    PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY: "synthetic-r2-secret-access-key-01234567890123456789",
    PRIVATE_STORAGE_HEALTHCHECK_KEY: "_health/p16-readiness",
  });

  it("accepts the frozen Cloudflare R2 staging contract", () => {
    expect(parseP16HostedPrivateStorageEnv(VALID)).toEqual(VALID);
  });

  it.each([
    {
      field: "P16_PRIVATE_STORAGE_PROVIDER",
      value: "s3",
    },
    {
      field: "PRIVATE_STORAGE_S3_ENDPOINT",
      value: "http://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    },
    {
      field: "PRIVATE_STORAGE_S3_ENDPOINT",
      value: "https://storage.example.com",
    },
    {
      field: "PRIVATE_STORAGE_S3_REGION",
      value: "us-east-1",
    },
    {
      field: "PRIVATE_STORAGE_S3_BUCKET",
      value: "Invalid Bucket",
    },
    {
      field: "PRIVATE_STORAGE_S3_ACCESS_KEY_ID",
      value: "short",
    },
    {
      field: "PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY",
      value: "too-short",
    },
    {
      field: "PRIVATE_STORAGE_HEALTHCHECK_KEY",
      value: "_health/other",
    },
  ])("rejects invalid hosted storage field $field", ({ field, value }) => {
    expect(() =>
      parseP16HostedPrivateStorageEnv({
        ...VALID,
        [field]: value,
      }),
    ).toThrow("Invalid P16 hosted private storage configuration");
  });

  it("rejects missing hosted storage configuration", () => {
    expect(() => parseP16HostedPrivateStorageEnv({})).toThrow(
      "Invalid P16 hosted private storage configuration",
    );
  });
});
