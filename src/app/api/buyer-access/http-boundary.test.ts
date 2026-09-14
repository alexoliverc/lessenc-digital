import { describe, expect, it, vi } from "vitest";

import { createBuyerAccessExchangeHandler } from "./exchange/handler";
import { createBuyerAccessLogoutHandler } from "./logout/handler";

const APP_URL = "https://lessenc.example";

const RAW_CREDENTIAL = `lba_${"a".repeat(43)}`;

const SESSION_TOKEN = "v1.payload.signature";

function request(
  path: string,
  options: {
    origin?: string | undefined;
    body?: unknown;
    contentType?: string;
  } = {},
) {
  const headers = new Headers();

  if (options.origin !== undefined) {
    headers.set("origin", options.origin);
  }

  if (options.contentType !== undefined) {
    headers.set("content-type", options.contentType);
  }

  const init: RequestInit = {
    method: "POST",
    headers,
  };

  if (options.body !== undefined) {
    init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  return new Request(`${APP_URL}${path}`, init);
}

describe("P11 buyer access HTTP boundary", () => {
  it("sets a production __Host buyer session cookie without exposing the token in JSON", async () => {
    const execute = vi.fn().mockResolvedValue({
      sessionToken: SESSION_TOKEN,
    });

    const handler = createBuyerAccessExchangeHandler({
      exchange: {
        execute,
      },
      appUrl: APP_URL,
      appEnv: "production",
    });

    const response = await handler(
      request("/api/buyer-access/exchange", {
        origin: APP_URL,
        contentType: "application/json",
        body: {
          credential: RAW_CREDENTIAL,
        },
      }),
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      ok: true,
    });

    expect(execute).toHaveBeenCalledWith(RAW_CREDENTIAL);

    const cookie = response.headers.get("set-cookie");

    expect(cookie).toContain("__Host-lessenc_buyer=");
    expect(cookie).toContain(SESSION_TOKEN);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).toMatch(/Max-Age=86400/i);
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it("uses a non-__Host local cookie when HTTPS Secure semantics are unavailable", async () => {
    const handler = createBuyerAccessExchangeHandler({
      exchange: {
        execute: vi.fn().mockResolvedValue({
          sessionToken: SESSION_TOKEN,
        }),
      },
      appUrl: "http://localhost:3000",
      appEnv: "local",
    });

    const response = await handler(
      new Request("http://localhost:3000/api/buyer-access/exchange", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          credential: RAW_CREDENTIAL,
        }),
      }),
    );

    const cookie = response.headers.get("set-cookie");

    expect(cookie).toContain("lessenc_buyer=");

    expect(cookie).not.toContain("__Host-lessenc_buyer=");

    expect(cookie).not.toMatch(/;\s*Secure/i);

    expect(cookie).toMatch(/HttpOnly/i);
  });

  it.each([undefined, "https://evil.example", "not-a-valid-origin"])(
    "rejects missing or foreign Origin before credential exchange: %s",
    async (origin) => {
      const execute = vi.fn();

      const handler = createBuyerAccessExchangeHandler({
        exchange: {
          execute,
        },
        appUrl: APP_URL,
        appEnv: "production",
      });

      const response = await handler(
        request("/api/buyer-access/exchange", {
          origin,
          contentType: "application/json",
          body: {
            credential: RAW_CREDENTIAL,
          },
        }),
      );

      expect(response.status).toBe(403);

      await expect(response.json()).resolves.toEqual({
        error: "REQUEST_INVALID",
      });

      expect(execute).not.toHaveBeenCalled();

      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );

  it.each([
    {
      contentType: "text/plain",
      body: JSON.stringify({
        credential: RAW_CREDENTIAL,
      }),
    },
    {
      contentType: "application/json",
      body: "{invalid-json",
    },
    {
      contentType: "application/json",
      body: JSON.stringify({
        credential: RAW_CREDENTIAL,
        orderId: "should-not-be-accepted",
      }),
    },
  ])("rejects malformed request bodies before exchange", async ({ contentType, body }) => {
    const execute = vi.fn();

    const handler = createBuyerAccessExchangeHandler({
      exchange: {
        execute,
      },
      appUrl: APP_URL,
      appEnv: "production",
    });

    const response = await handler(
      request("/api/buyer-access/exchange", {
        origin: APP_URL,
        contentType,
        body,
      }),
    );

    expect(response.status).toBe(400);

    expect(execute).not.toHaveBeenCalled();

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects an oversized body before credential exchange", async () => {
    const execute = vi.fn();

    const handler = createBuyerAccessExchangeHandler({
      exchange: {
        execute,
      },
      appUrl: APP_URL,
      appEnv: "production",
    });

    const response = await handler(
      request("/api/buyer-access/exchange", {
        origin: APP_URL,
        contentType: "application/json",
        body: JSON.stringify({
          credential: "x".repeat(5000),
        }),
      }),
    );

    expect(response.status).toBe(400);

    expect(execute).not.toHaveBeenCalled();
  });

  it("maps invalid credentials to one generic public error without setting a cookie", async () => {
    const handler = createBuyerAccessExchangeHandler({
      exchange: {
        execute: vi.fn().mockRejectedValue(new Error("ACCESS_INVALID")),
      },
      appUrl: APP_URL,
      appEnv: "production",
    });

    const response = await handler(
      request("/api/buyer-access/exchange", {
        origin: APP_URL,
        contentType: "application/json",
        body: {
          credential: RAW_CREDENTIAL,
        },
      }),
    );

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toEqual({
      error: "ACCESS_INVALID",
    });

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("fails closed on unexpected exchange errors without leaking internal details", async () => {
    const handler = createBuyerAccessExchangeHandler({
      exchange: {
        execute: vi.fn().mockRejectedValue(new Error("database connection string secret details")),
      },
      appUrl: APP_URL,
      appEnv: "production",
    });

    const response = await handler(
      request("/api/buyer-access/exchange", {
        origin: APP_URL,
        contentType: "application/json",
        body: {
          credential: RAW_CREDENTIAL,
        },
      }),
    );

    expect(response.status).toBe(503);

    const body = await response.text();

    expect(body).toContain("SERVICE_UNAVAILABLE");

    expect(body).not.toContain("database connection string");

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("clears the production buyer session cookie on same-origin logout", async () => {
    const handler = createBuyerAccessLogoutHandler({
      appUrl: APP_URL,
      appEnv: "production",
    });

    const response = await handler(
      request("/api/buyer-access/logout", {
        origin: APP_URL,
      }),
    );

    expect(response.status).toBe(200);

    const cookie = response.headers.get("set-cookie");

    expect(cookie).toContain("__Host-lessenc_buyer=");

    expect(cookie).toMatch(/Max-Age=0/i);

    expect(cookie).toMatch(/HttpOnly/i);

    expect(cookie).toMatch(/Secure/i);

    expect(cookie).toMatch(/Path=\//i);
  });

  it("rejects cross-origin logout and does not mutate the cookie", async () => {
    const handler = createBuyerAccessLogoutHandler({
      appUrl: APP_URL,
      appEnv: "production",
    });

    const response = await handler(
      request("/api/buyer-access/logout", {
        origin: "https://evil.example",
      }),
    );

    expect(response.status).toBe(403);

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("marks exchange and logout responses as private no-store", async () => {
    const exchange = createBuyerAccessExchangeHandler({
      exchange: {
        execute: vi.fn().mockResolvedValue({
          sessionToken: SESSION_TOKEN,
        }),
      },
      appUrl: APP_URL,
      appEnv: "production",
    });

    const exchangeResponse = await exchange(
      request("/api/buyer-access/exchange", {
        origin: APP_URL,
        contentType: "application/json",
        body: {
          credential: RAW_CREDENTIAL,
        },
      }),
    );

    const logout = createBuyerAccessLogoutHandler({
      appUrl: APP_URL,
      appEnv: "production",
    });

    const logoutResponse = await logout(
      request("/api/buyer-access/logout", {
        origin: APP_URL,
      }),
    );

    expect(exchangeResponse.headers.get("cache-control")).toBe("private, no-store");

    expect(logoutResponse.headers.get("cache-control")).toBe("private, no-store");

    expect(exchangeResponse.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
