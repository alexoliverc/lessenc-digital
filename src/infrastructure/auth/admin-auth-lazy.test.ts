import { describe, expect, it, vi } from "vitest";

describe("administrative authentication initialization", () => {
  it("does not evaluate database, TLS or auth-secret configuration on module import", async () => {
    vi.resetModules();
    const previous = {
      DB_RUNTIME_URL: process.env.DB_RUNTIME_URL,
      DB_TLS_CA_FILE: process.env.DB_TLS_CA_FILE,
      P12_ADMIN_AUTH_SECRET: process.env.P12_ADMIN_AUTH_SECRET,
    };

    delete process.env.DB_RUNTIME_URL;
    delete process.env.DB_TLS_CA_FILE;
    delete process.env.P12_ADMIN_AUTH_SECRET;

    try {
      const authModule = await import("./admin-auth");
      expect(authModule.getAdminAuth).toBeTypeOf("function");
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
