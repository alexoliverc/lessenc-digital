import { posix, win32 } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PRISMA_CONFIG_ONLY_URL,
  resolvePrismaDatasourceUrl,
} from "../../../scripts/lib/p16-prisma-migration-tls.mjs";

const syntheticUrl =
  "mysql://migration-user:p%40ss%2Fword@db.invalid:3306/lessenc_staging?connect_timeout=10";

function stagingInput(overrides: Record<string, string | undefined> = {}) {
  return {
    appEnvironment: "staging",
    databaseUrl: syntheticUrl,
    databaseTlsCaFile: "/srv/lessenc/secrets/usertrust.pem",
    prismaDirectory: "/srv/lessenc/prisma",
    ...overrides,
  };
}

describe("P16 Prisma migration TLS binding", () => {
  it("forces strict TLS and derives a POSIX Prisma-relative CA path", () => {
    const effective = resolvePrismaDatasourceUrl(stagingInput(), posix);
    const parsed = new URL(effective);

    expect(parsed.searchParams.get("sslaccept")).toBe("strict");
    expect(parsed.searchParams.get("sslcert")).toBe("../secrets/usertrust.pem");
    expect(parsed.searchParams.get("connect_timeout")).toBe("10");
  });

  it("preserves credentials, host, port and database without corrupting percent encoding", () => {
    const effective = resolvePrismaDatasourceUrl(stagingInput(), posix);
    const parsed = new URL(effective);

    expect(effective).toContain("migration-user:p%40ss%2Fword@db.invalid:3306");
    expect(parsed.hostname).toBe("db.invalid");
    expect(parsed.port).toBe("3306");
    expect(parsed.pathname).toBe("/lessenc_staging");
  });

  it("overrides conflicting TLS parameters instead of trusting operator input", () => {
    const databaseUrl = `${syntheticUrl}&sslaccept=accept_invalid_certs&sslcert=wrong.pem&SSLACCEPT=accept_invalid_certs&SSLCERT=also-wrong.pem`;
    const effective = resolvePrismaDatasourceUrl(stagingInput({ databaseUrl }), posix);
    const parsed = new URL(effective);

    expect(parsed.searchParams.getAll("sslaccept")).toEqual(["strict"]);
    expect(parsed.searchParams.getAll("sslcert")).toEqual(["../secrets/usertrust.pem"]);
    expect(
      [...parsed.searchParams.keys()].filter((key) => /^ssl(accept|cert)$/iu.test(key)),
    ).toEqual(["sslcert", "sslaccept"]);
  });

  it("fails closed when the staging CA is missing or relative", () => {
    expect(() =>
      resolvePrismaDatasourceUrl(stagingInput({ databaseTlsCaFile: undefined }), posix),
    ).toThrow("P16_PRISMA_MIGRATION_CA_REQUIRED");
    expect(() =>
      resolvePrismaDatasourceUrl(stagingInput({ databaseTlsCaFile: "certs/ca.pem" }), posix),
    ).toThrow("P16_PRISMA_MIGRATION_CA_MUST_BE_ABSOLUTE");
  });

  it.each([
    "not-a-url",
    "postgresql://user:password@db.invalid/lessenc_staging",
    "mysql://user:password@db.invalid/%ZZ",
  ])("fails closed for an invalid staging migration URL: %s", (databaseUrl) => {
    expect(() => resolvePrismaDatasourceUrl(stagingInput({ databaseUrl }), posix)).toThrow(
      "P16_PRISMA_MIGRATION_DATABASE_URL_INVALID",
    );
  });

  it("keeps generation/static fallback and non-staging URLs unchanged", () => {
    expect(
      resolvePrismaDatasourceUrl(
        stagingInput({ databaseUrl: undefined, databaseTlsCaFile: undefined }),
        posix,
      ),
    ).toBe(PRISMA_CONFIG_ONLY_URL);

    for (const appEnvironment of ["local", "test", undefined]) {
      expect(
        resolvePrismaDatasourceUrl(
          stagingInput({ appEnvironment, databaseTlsCaFile: undefined }),
          posix,
        ),
      ).toBe(syntheticUrl);
    }
  });

  it("uses Windows path semantics and emits forward-slash URL path syntax", () => {
    const effective = resolvePrismaDatasourceUrl(
      stagingInput({
        databaseTlsCaFile: "C:\\lessenc\\secrets\\usertrust.pem",
        prismaDirectory: "C:\\lessenc\\prisma",
      }),
      win32,
    );

    expect(new URL(effective).searchParams.get("sslcert")).toBe("../secrets/usertrust.pem");
  });

  it("URL-encodes special characters in the derived certificate path", () => {
    const effective = resolvePrismaDatasourceUrl(
      stagingInput({
        databaseTlsCaFile: "C:\\lessenc\\trusted certs\\user&trust.pem",
        prismaDirectory: "C:\\lessenc\\prisma",
      }),
      win32,
    );

    expect(new URL(effective).searchParams.get("sslcert")).toBe("../trusted certs/user&trust.pem");
    expect(effective).not.toContain("trusted certs/user&trust.pem");
  });

  it("rejects a Windows CA on a different drive because no Prisma-relative path exists", () => {
    expect(() =>
      resolvePrismaDatasourceUrl(
        stagingInput({
          databaseTlsCaFile: "D:\\secrets\\usertrust.pem",
          prismaDirectory: "C:\\lessenc\\prisma",
        }),
        win32,
      ),
    ).toThrow("P16_PRISMA_MIGRATION_CA_PATH_UNREPRESENTABLE");
  });

  it("never includes a password or complete URL in configuration failures", () => {
    const credential = "synthetic-password-that-must-not-leak";
    const fullUrl = `mysql://migration-user:${credential}@/lessenc_staging`;

    let message = "";
    try {
      resolvePrismaDatasourceUrl(stagingInput({ databaseUrl: fullUrl }), posix);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe("P16_PRISMA_MIGRATION_DATABASE_URL_INVALID");
    expect(message).not.toContain(credential);
    expect(message).not.toContain(fullUrl);
  });
});
