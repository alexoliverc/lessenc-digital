import { NextRequest } from "next/server";

import { describe, expect, it, vi } from "vitest";

import type { PreparedProtectedDelivery } from "../../../modules/entitlements/application/protected-digital-delivery";
import { createProtectedDownloadHandler } from "./resources/[resourceId]/handler";

const SESSION_TOKEN = "v1.payload.signature";

const RESOURCE_ID = "44444444-4444-4444-8444-444444444444";

const SUBJECT = Object.freeze({
  customerId: "11111111-1111-4111-8111-111111111111",
  orderId: "22222222-2222-4222-8222-222222222222",
  credentialId: "33333333-3333-4333-8333-333333333333",
});

async function* body(chunks: readonly Uint8Array[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function delivery(overrides: Partial<PreparedProtectedDelivery> = {}): PreparedProtectedDelivery {
  return Object.freeze({
    resourceId: RESOURCE_ID,
    entitlementId: "55555555-5555-4555-8555-555555555555",
    buyerAccessCredentialId: SUBJECT.credentialId,
    filename: "lessenc-resource.pdf",
    mediaType: "application/pdf",
    sizeBytes: 3,
    body: body([new Uint8Array([1, 2, 3])]),
    ...overrides,
  });
}

function request(cookie?: string) {
  const headers = new Headers();

  if (cookie) {
    headers.set("cookie", cookie);
  }

  return new NextRequest(`https://lessenc.example/api/buyer-access/resources/${RESOURCE_ID}`, {
    method: "GET",
    headers,
  });
}

describe("P11 protected download HTTP boundary", () => {
  it("returns a protected attachment and records SUCCEEDED only when the body starts", async () => {
    const succeeded = vi.fn().mockResolvedValue(undefined);

    const streamFailed = vi.fn();

    const prepareDelivery = vi.fn().mockResolvedValue(delivery());

    const handler = createProtectedDownloadHandler({
      validateSession: {
        execute: vi.fn().mockResolvedValue(SUBJECT),
      },
      prepareDelivery: {
        execute: prepareDelivery,
      },
      recordOutcome: {
        succeeded,
        streamFailed,
      },
      appEnv: "production",
    });

    const response = await handler(request(`__Host-lessenc_buyer=${SESSION_TOKEN}`), RESOURCE_ID);

    expect(response.status).toBe(200);

    expect(succeeded).not.toHaveBeenCalled();

    expect(response.headers.get("content-type")).toBe("application/pdf");

    expect(response.headers.get("content-length")).toBe("3");

    expect(response.headers.get("content-disposition")).toContain("attachment;");

    expect(response.headers.get("cache-control")).toBe("private, no-store");

    expect(response.headers.get("referrer-policy")).toBe("no-referrer");

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");

    const bytes = new Uint8Array(await response.arrayBuffer());

    expect([...bytes]).toEqual([1, 2, 3]);

    expect(succeeded).toHaveBeenCalledTimes(1);

    expect(streamFailed).not.toHaveBeenCalled();

    expect(prepareDelivery).toHaveBeenCalledWith(SUBJECT, RESOURCE_ID);
  });

  it("rejects a missing session before protected delivery preparation", async () => {
    const prepareDelivery = vi.fn();

    const handler = createProtectedDownloadHandler({
      validateSession: {
        execute: vi.fn(),
      },
      prepareDelivery: {
        execute: prepareDelivery,
      },
      recordOutcome: {
        succeeded: vi.fn(),
        streamFailed: vi.fn(),
      },
      appEnv: "production",
    });

    const response = await handler(request(), RESOURCE_ID);

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toEqual({
      error: "SESSION_INVALID",
    });

    expect(prepareDelivery).not.toHaveBeenCalled();
  });

  it("rejects an invalid persisted Buyer Session before protected delivery", async () => {
    const prepareDelivery = vi.fn();

    const handler = createProtectedDownloadHandler({
      validateSession: {
        execute: vi.fn().mockRejectedValue(new Error("SESSION_INVALID")),
      },
      prepareDelivery: {
        execute: prepareDelivery,
      },
      recordOutcome: {
        succeeded: vi.fn(),
        streamFailed: vi.fn(),
      },
      appEnv: "production",
    });

    const response = await handler(request(`__Host-lessenc_buyer=${SESSION_TOKEN}`), RESOURCE_ID);

    expect(response.status).toBe(401);

    expect(prepareDelivery).not.toHaveBeenCalled();
  });

  it("returns generic 404 when C4 denies the requested resource", async () => {
    const handler = createProtectedDownloadHandler({
      validateSession: {
        execute: vi.fn().mockResolvedValue(SUBJECT),
      },
      prepareDelivery: {
        execute: vi.fn().mockRejectedValue(new Error("RESOURCE_NOT_AVAILABLE")),
      },
      recordOutcome: {
        succeeded: vi.fn(),
        streamFailed: vi.fn(),
      },
      appEnv: "production",
    });

    const response = await handler(request(`__Host-lessenc_buyer=${SESSION_TOKEN}`), RESOURCE_ID);

    expect(response.status).toBe(404);

    await expect(response.json()).resolves.toEqual({
      error: "RESOURCE_NOT_AVAILABLE",
    });
  });

  it("returns generic 503 when storage or delivery audit preparation fails", async () => {
    const handler = createProtectedDownloadHandler({
      validateSession: {
        execute: vi.fn().mockResolvedValue(SUBJECT),
      },
      prepareDelivery: {
        execute: vi.fn().mockRejectedValue(new Error("DELIVERY_UNAVAILABLE")),
      },
      recordOutcome: {
        succeeded: vi.fn(),
        streamFailed: vi.fn(),
      },
      appEnv: "production",
    });

    const response = await handler(request(`__Host-lessenc_buyer=${SESSION_TOKEN}`), RESOURCE_ID);

    expect(response.status).toBe(503);

    const serialized = await response.text();

    expect(serialized).toContain("SERVICE_UNAVAILABLE");

    expect(serialized).not.toContain("DELIVERY_UNAVAILABLE");
  });

  it("does not expose storage locators or internal identifiers in the response", async () => {
    const handler = createProtectedDownloadHandler({
      validateSession: {
        execute: vi.fn().mockResolvedValue(SUBJECT),
      },
      prepareDelivery: {
        execute: vi.fn().mockResolvedValue(delivery()),
      },
      recordOutcome: {
        succeeded: vi.fn().mockResolvedValue(undefined),
        streamFailed: vi.fn(),
      },
      appEnv: "production",
    });

    const response = await handler(request(`__Host-lessenc_buyer=${SESSION_TOKEN}`), RESOURCE_ID);

    const headerText = [...response.headers.entries()].flat().join(" ");

    expect(headerText).not.toContain("storageKey");

    expect(headerText).not.toContain("entitlementId");

    expect(headerText).not.toContain("resources/abc");

    await response.arrayBuffer();
  });

  it("sanitizes the ASCII filename while preserving UTF-8 filename metadata", async () => {
    const handler = createProtectedDownloadHandler({
      validateSession: {
        execute: vi.fn().mockResolvedValue(SUBJECT),
      },
      prepareDelivery: {
        execute: vi.fn().mockResolvedValue(
          delivery({
            filename: 'ébook"\r\nmalicioso.pdf',
          }),
        ),
      },
      recordOutcome: {
        succeeded: vi.fn().mockResolvedValue(undefined),
        streamFailed: vi.fn(),
      },
      appEnv: "production",
    });

    const response = await handler(request(`__Host-lessenc_buyer=${SESSION_TOKEN}`), RESOURCE_ID);

    const disposition = response.headers.get("content-disposition") ?? "";

    expect(disposition).not.toContain("\r");

    expect(disposition).not.toContain("\n");

    expect(disposition).toContain("filename*=UTF-8''");

    await response.arrayBuffer();
  });

  it("records STREAM_FAILED when the prepared body fails after delivery start", async () => {
    async function* failingBody() {
      yield new Uint8Array([1]);

      throw new Error("private stream failure");
    }

    const succeeded = vi.fn().mockResolvedValue(undefined);

    const streamFailed = vi.fn().mockResolvedValue(undefined);

    const handler = createProtectedDownloadHandler({
      validateSession: {
        execute: vi.fn().mockResolvedValue(SUBJECT),
      },
      prepareDelivery: {
        execute: vi.fn().mockResolvedValue(
          delivery({
            sizeBytes: 2,
            body: failingBody(),
          }),
        ),
      },
      recordOutcome: {
        succeeded,
        streamFailed,
      },
      appEnv: "production",
    });

    const response = await handler(request(`__Host-lessenc_buyer=${SESSION_TOKEN}`), RESOURCE_ID);

    await expect(response.arrayBuffer()).rejects.toBeDefined();

    expect(succeeded).toHaveBeenCalledTimes(1);

    expect(streamFailed).toHaveBeenCalledTimes(1);
  });

  it("does not release body bytes when the SUCCEEDED audit cannot be persisted", async () => {
    let pulled = false;

    async function* guardedBody() {
      pulled = true;

      yield new Uint8Array([1]);
    }

    const handler = createProtectedDownloadHandler({
      validateSession: {
        execute: vi.fn().mockResolvedValue(SUBJECT),
      },
      prepareDelivery: {
        execute: vi.fn().mockResolvedValue(
          delivery({
            sizeBytes: 1,
            body: guardedBody(),
          }),
        ),
      },
      recordOutcome: {
        succeeded: vi.fn().mockRejectedValue(new Error("DELIVERY_AUDIT_UNAVAILABLE")),
        streamFailed: vi.fn(),
      },
      appEnv: "production",
    });

    const response = await handler(request(`__Host-lessenc_buyer=${SESSION_TOKEN}`), RESOURCE_ID);

    await expect(response.arrayBuffer()).rejects.toBeDefined();

    expect(pulled).toBe(false);
  });

  it("uses the local Buyer Session cookie name in local development", async () => {
    const handler = createProtectedDownloadHandler({
      validateSession: {
        execute: vi.fn().mockResolvedValue(SUBJECT),
      },
      prepareDelivery: {
        execute: vi.fn().mockResolvedValue(delivery()),
      },
      recordOutcome: {
        succeeded: vi.fn().mockResolvedValue(undefined),
        streamFailed: vi.fn(),
      },
      appEnv: "local",
    });

    const response = await handler(
      new NextRequest(`http://localhost:3000/api/buyer-access/resources/${RESOURCE_ID}`, {
        method: "GET",
        headers: {
          cookie: `lessenc_buyer=${SESSION_TOKEN}`,
        },
      }),
      RESOURCE_ID,
    );

    expect(response.status).toBe(200);

    await response.arrayBuffer();
  });
});
