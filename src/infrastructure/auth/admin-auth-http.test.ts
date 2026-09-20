import { describe, expect, it } from "vitest";

import { adminAuthRouteAllowlist, createAdminAuthRoute } from "./admin-auth-http";

const APP_URL = "http://localhost:3000";
const handler = createAdminAuthRoute(
  {
    handler: async (request) => {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/sign-in/email")) {
        return new Response(JSON.stringify({ code: "UNKNOWN_USER" }), { status: 401 });
      }
      return new Response(JSON.stringify({ status: true }), { status: 200 });
    },
  },
  APP_URL,
  async () => ({ mfaComplete: true, fresh: true }),
);

function request(path: string, method: "GET" | "POST" = "POST", body = "{}") {
  return new Request(`${APP_URL}/api/admin/auth${path}`, {
    method,
    headers: { origin: APP_URL, "content-type": "application/json" },
    ...(method === "POST" ? { body } : {}),
  });
}

describe("administrative Better Auth HTTP boundary", () => {
  it("exposes only the explicit C/D endpoint allowlist", async () => {
    expect(adminAuthRouteAllowlist).toEqual([
      "/sign-in/email",
      "/get-session",
      "/sign-out",
      "/two-factor/enable",
      "/two-factor/verify-totp",
      "/two-factor/verify-backup-code",
      "/two-factor/generate-backup-codes",
    ]);
    for (const path of [
      "/sign-up/email",
      "/two-factor/disable",
      "/two-factor/send-otp",
      "/sign-in/social",
      "/magic-link/send",
      "/forget-password",
    ]) {
      expect((await handler.POST(request(path))).status).toBe(404);
    }
  });

  it("rejects untrusted Origin and cross-site mutation", async () => {
    const missing = request("/sign-out");
    missing.headers.delete("origin");
    expect((await handler.POST(missing)).status).toBe(403);
    const untrusted = request("/sign-out");
    untrusted.headers.set("origin", "https://attacker.invalid");
    expect((await handler.POST(untrusted)).status).toBe(403);
    const crossSite = request("/sign-out");
    crossSite.headers.set("sec-fetch-site", "cross-site");
    expect((await handler.POST(crossSite)).status).toBe(403);
    expect((await handler.POST(request("/sign-out"))).status).toBe(200);
  });

  it("rejects unsupported methods, unexpected query strings and malformed payloads", async () => {
    expect((await handler.POST(request("/sign-out?returnTo=/admin"))).status).toBe(404);

    const unsupported = new Request(`${APP_URL}/api/admin/auth/sign-out`, {
      method: "PUT",
      headers: { origin: APP_URL, "content-type": "application/json" },
      body: "{}",
    });
    expect((await handler.POST(unsupported)).status).toBe(404);

    expect((await handler.POST(request("/sign-in/email", "POST", "{malformed"))).status).toBe(400);

    const wrongType = request("/sign-in/email");
    wrongType.headers.set("content-type", "text/plain");
    expect((await handler.POST(wrongType)).status).toBe(400);
  });

  it("rejects oversized authentication payloads before Better Auth", async () => {
    const response = await handler.POST(
      request("/sign-in/email", "POST", JSON.stringify({ password: "x".repeat(9000) })),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "INVALID_REQUEST" });
  });

  it("blocks trusted-device and raw-session responses from second-factor input", async () => {
    for (const body of [
      '{"code":"123456","trustDevice":true}',
      '{"code":"123456","disableSession":true}',
    ]) {
      expect((await handler.POST(request("/two-factor/verify-totp", "POST", body))).status).toBe(
        400,
      );
      expect(
        (await handler.POST(request("/two-factor/verify-backup-code", "POST", body))).status,
      ).toBe(400);
    }
    expect(
      (await handler.POST(request("/two-factor/enable", "POST", '{"method":"otp"}'))).status,
    ).toBe(400);
  });

  it("maps sign-in failures to one generic external response", async () => {
    const response = await handler.POST(request("/sign-in/email"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "INVALID_CREDENTIALS" });
  });
});
