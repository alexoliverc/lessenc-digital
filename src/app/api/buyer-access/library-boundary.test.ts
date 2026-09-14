import { NextRequest } from "next/server";

import { describe, expect, it, vi } from "vitest";

import { createBuyerAccessLibraryHandler } from "./library/handler";

const APP_URL = "https://lessenc.example";

const SESSION_TOKEN = "v1.payload.signature";

const SUBJECT = Object.freeze({
  customerId: "11111111-1111-4111-8111-111111111111",
  orderId: "22222222-2222-4222-8222-222222222222",
  credentialId: "33333333-3333-4333-8333-333333333333",
});

function libraryRequest(cookie?: string) {
  const headers = new Headers();

  if (cookie) {
    headers.set("cookie", cookie);
  }

  return new NextRequest(`${APP_URL}/api/buyer-access/library`, {
    method: "GET",
    headers,
  });
}

describe("P11 buyer resource library HTTP boundary", () => {
  it("returns only safe buyer resource metadata from a valid production session cookie", async () => {
    const validateSession = vi.fn().mockResolvedValue(SUBJECT);

    const listResources = vi.fn().mockResolvedValue([
      {
        resourceId: "44444444-4444-4444-8444-444444444444",
        filename: "lessenc-resource.pdf",
        mediaType: "application/pdf",
      },
    ]);

    const handler = createBuyerAccessLibraryHandler({
      validateSession: {
        execute: validateSession,
      },
      listResources: {
        execute: listResources,
      },
      appEnv: "production",
    });

    const response = await handler(libraryRequest(`__Host-lessenc_buyer=${SESSION_TOKEN}`));

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body).toEqual({
      resources: [
        {
          resourceId: "44444444-4444-4444-8444-444444444444",
          filename: "lessenc-resource.pdf",
          mediaType: "application/pdf",
        },
      ],
    });

    const serialized = JSON.stringify(body);

    for (const forbidden of [
      "storageKey",
      "entitlementId",
      "customerId",
      "orderId",
      "credentialId",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    expect(validateSession).toHaveBeenCalledWith(SESSION_TOKEN);

    expect(listResources).toHaveBeenCalledWith(SUBJECT);
  });

  it("rejects a missing Buyer Session cookie before library access", async () => {
    const validateSession = vi.fn();

    const listResources = vi.fn();

    const handler = createBuyerAccessLibraryHandler({
      validateSession: {
        execute: validateSession,
      },
      listResources: {
        execute: listResources,
      },
      appEnv: "production",
    });

    const response = await handler(libraryRequest());

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toEqual({
      error: "SESSION_INVALID",
    });

    expect(validateSession).not.toHaveBeenCalled();

    expect(listResources).not.toHaveBeenCalled();
  });

  it("rejects an invalid persisted session before querying buyer resources", async () => {
    const validateSession = vi.fn().mockRejectedValue(new Error("SESSION_INVALID"));

    const listResources = vi.fn();

    const handler = createBuyerAccessLibraryHandler({
      validateSession: {
        execute: validateSession,
      },
      listResources: {
        execute: listResources,
      },
      appEnv: "production",
    });

    const response = await handler(libraryRequest(`__Host-lessenc_buyer=${SESSION_TOKEN}`));

    expect(response.status).toBe(401);

    expect(listResources).not.toHaveBeenCalled();
  });

  it("uses the non-__Host cookie name in local development", async () => {
    const validateSession = vi.fn().mockResolvedValue(SUBJECT);

    const handler = createBuyerAccessLibraryHandler({
      validateSession: {
        execute: validateSession,
      },
      listResources: {
        execute: vi.fn().mockResolvedValue([]),
      },
      appEnv: "local",
    });

    const response = await handler(
      new NextRequest("http://localhost:3000/api/buyer-access/library", {
        method: "GET",
        headers: {
          cookie: `lessenc_buyer=${SESSION_TOKEN}`,
        },
      }),
    );

    expect(response.status).toBe(200);

    expect(validateSession).toHaveBeenCalledWith(SESSION_TOKEN);
  });

  it("fails closed on unexpected library errors without leaking internals", async () => {
    const handler = createBuyerAccessLibraryHandler({
      validateSession: {
        execute: vi.fn().mockResolvedValue(SUBJECT),
      },
      listResources: {
        execute: vi.fn().mockRejectedValue(new Error("private database storage path")),
      },
      appEnv: "production",
    });

    const response = await handler(libraryRequest(`__Host-lessenc_buyer=${SESSION_TOKEN}`));

    expect(response.status).toBe(503);

    const body = await response.text();

    expect(body).toContain("SERVICE_UNAVAILABLE");

    expect(body).not.toContain("database");

    expect(body).not.toContain("storage path");
  });

  it("marks the authenticated library response private no-store and no-referrer", async () => {
    const handler = createBuyerAccessLibraryHandler({
      validateSession: {
        execute: vi.fn().mockResolvedValue(SUBJECT),
      },
      listResources: {
        execute: vi.fn().mockResolvedValue([]),
      },
      appEnv: "production",
    });

    const response = await handler(libraryRequest(`__Host-lessenc_buyer=${SESSION_TOKEN}`));

    expect(response.headers.get("cache-control")).toBe("private, no-store");

    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
