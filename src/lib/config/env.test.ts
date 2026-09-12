import { describe, expect, it } from "vitest";

import { parseServerEnv } from "./env-schema";

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
