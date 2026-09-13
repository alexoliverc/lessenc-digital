import { describe, expect, it } from "vitest";

import { parseP08CommercialEnv, parseServerEnv } from "./env-schema";

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
