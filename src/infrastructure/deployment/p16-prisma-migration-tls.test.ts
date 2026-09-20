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
    ...overrides,
  };
}

describe("P16 Prisma migration TLS binding", () => {
  it("forces exactly one sslaccept=strict and does not emit sslcert", () => {
    const effective = resolvePrismaDatasourceUrl(stagingInput());
    const parsed = new URL(effective);

    expect(parsed.searchParams.getAll("sslaccept")).toEqual(["strict"]);

    expect(parsed.searchParams.getAll("sslcert")).toEqual([]);

    expect([...parsed.searchParams.keys()].filter((key) => /^sslaccept$/iu.test(key))).toEqual([
      "sslaccept",
    ]);

    expect([...parsed.searchParams.keys()].filter((key) => /^sslcert$/iu.test(key))).toEqual([]);
  });

  it("preserves credentials, host, port and database without corrupting percent encoding", () => {
    const effective = resolvePrismaDatasourceUrl(stagingInput());
    const parsed = new URL(effective);

    expect(effective).toContain("migration-user:p%40ss%2Fword@db.invalid:3306");

    expect(parsed.hostname).toBe("db.invalid");
    expect(parsed.port).toBe("3306");
    expect(parsed.pathname).toBe("/lessenc_staging");
  });

  it("preserves non-TLS query parameters", () => {
    const effective = resolvePrismaDatasourceUrl(stagingInput());
    const parsed = new URL(effective);

    expect(parsed.searchParams.get("connect_timeout")).toBe("10");
  });

  it("removes conflicting lowercase TLS parameters", () => {
    const databaseUrl =
      `${syntheticUrl}` + "&sslaccept=accept_invalid_certs" + "&sslcert=wrong.pem";

    const effective = resolvePrismaDatasourceUrl(stagingInput({ databaseUrl }));

    const parsed = new URL(effective);

    expect(parsed.searchParams.getAll("sslaccept")).toEqual(["strict"]);

    expect(parsed.searchParams.getAll("sslcert")).toEqual([]);
  });

  it("removes conflicting mixed-case TLS parameters", () => {
    const databaseUrl =
      `${syntheticUrl}` +
      "&SSLACCEPT=accept_invalid_certs" +
      "&SSLCERT=also-wrong.pem" +
      "&SslAccept=accept_invalid_certs" +
      "&SslCert=another-wrong.pem";

    const effective = resolvePrismaDatasourceUrl(stagingInput({ databaseUrl }));

    const parsed = new URL(effective);

    const tlsKeys = [...parsed.searchParams.keys()].filter((key) =>
      /^ssl(accept|cert)$/iu.test(key),
    );

    expect(tlsKeys).toEqual(["sslaccept"]);
    expect(parsed.searchParams.get("sslaccept")).toBe("strict");
    expect(parsed.searchParams.getAll("sslcert")).toEqual([]);
  });

  it.each([
    "not-a-url",
    "postgresql://user:password@db.invalid/lessenc_staging",
    "mysql://user:password@db.invalid/%ZZ",
    "mysql://db.invalid/lessenc_staging",
    "mysql://user:password@/lessenc_staging",
    "mysql://user:password@db.invalid/",
  ])("fails closed for invalid staging migration URL: %s", (databaseUrl) => {
    expect(() => resolvePrismaDatasourceUrl(stagingInput({ databaseUrl }))).toThrow(
      "P16_PRISMA_MIGRATION_DATABASE_URL_INVALID",
    );
  });

  it("keeps config-only fallback when DATABASE_URL is absent", () => {
    expect(
      resolvePrismaDatasourceUrl({
        appEnvironment: "staging",
        databaseUrl: undefined,
      }),
    ).toBe(PRISMA_CONFIG_ONLY_URL);
  });

  it("keeps local, test and undefined environments unchanged", () => {
    for (const appEnvironment of ["local", "test", undefined]) {
      expect(
        resolvePrismaDatasourceUrl({
          appEnvironment,
          databaseUrl: syntheticUrl,
        }),
      ).toBe(syntheticUrl);
    }
  });

  it("never leaks password or complete URL in configuration failures", () => {
    const credential = "synthetic-password-that-must-not-leak";

    const fullUrl = `mysql://migration-user:${credential}` + "@/lessenc_staging";

    let message = "";

    try {
      resolvePrismaDatasourceUrl(stagingInput({ databaseUrl: fullUrl }));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe("P16_PRISMA_MIGRATION_DATABASE_URL_INVALID");

    expect(message).not.toContain(credential);
    expect(message).not.toContain(fullUrl);
  });

  it("never allows operator-provided sslcert in staging", () => {
    const databaseUrl =
      `${syntheticUrl}` + "&sslcert=../secret/custom.pem" + "&SSLCERT=/tmp/another.pem";

    const effective = resolvePrismaDatasourceUrl(stagingInput({ databaseUrl }));

    const parsed = new URL(effective);

    expect(
      [...parsed.searchParams.entries()].some(([key]) => key.toLowerCase() === "sslcert"),
    ).toBe(false);
  });

  it("never allows accept_invalid_certs as effective staging policy", () => {
    const databaseUrl = `${syntheticUrl}` + "&sslaccept=accept_invalid_certs";

    const effective = resolvePrismaDatasourceUrl(stagingInput({ databaseUrl }));

    const parsed = new URL(effective);

    expect(parsed.searchParams.get("sslaccept")).toBe("strict");

    expect(effective).not.toContain("accept_invalid_certs");
  });
});
