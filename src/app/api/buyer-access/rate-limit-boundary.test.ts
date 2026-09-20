import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { BuyerAccessRateLimitExceeded } from "../../../modules/entitlements/application/buyer-access-rate-limit-enforcement";
import type { BuyerSubject } from "../../../modules/entitlements/application/buyer-session";
import { createBuyerAccessExchangeHandler } from "./exchange/handler";
import { createBuyerAccessLibraryHandler } from "./library/handler";
import { createProtectedDownloadHandler } from "./resources/[resourceId]/handler";

const APP_URL = "https://lessenc.example";

const SUBJECT: BuyerSubject = Object.freeze({
  customerId: "11111111-1111-4111-8111-111111111111",
  orderId: "22222222-2222-4222-8222-222222222222",
  credentialId: "33333333-3333-4333-8333-333333333333",
});

describe("Buyer Access HTTP rate-limit boundary", () => {
  it("maps exchange throttling to generic 429 with Retry-After and no session cookie", async () => {
    const exchange = {
      execute: vi.fn().mockRejectedValue(new BuyerAccessRateLimitExceeded(57)),
    };

    const handler = createBuyerAccessExchangeHandler({
      exchange,
      appUrl: APP_URL,
      appEnv: "production",
    });

    const response = await handler(
      new Request(`${APP_URL}/api/buyer-access/exchange`, {
        method: "POST",
        headers: {
          origin: APP_URL,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          credential: "lba_example",
        }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("57");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({
      error: "TOO_MANY_REQUESTS",
    });
  });

  it("maps authenticated library throttling to 429 before listing resources", async () => {
    const validateSession = {
      execute: vi.fn().mockResolvedValue(SUBJECT),
    };

    const listResources = {
      execute: vi.fn().mockRejectedValue(new BuyerAccessRateLimitExceeded(23)),
    };

    const handler = createBuyerAccessLibraryHandler({
      validateSession,
      listResources,
      appEnv: "production",
    });

    const request = new NextRequest(`${APP_URL}/api/buyer-access/library`, {
      headers: {
        cookie: "__Host-lessenc_buyer=session-token",
      },
    });

    const response = await handler(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("23");
    expect(await response.json()).toEqual({
      error: "TOO_MANY_REQUESTS",
    });

    expect(validateSession.execute).toHaveBeenCalledTimes(1);
    expect(listResources.execute).toHaveBeenCalledTimes(1);
  });

  it("maps protected-download throttling to 429 before delivery preparation can succeed", async () => {
    const validateSession = {
      execute: vi.fn().mockResolvedValue(SUBJECT),
    };

    const prepareDelivery = {
      execute: vi.fn().mockRejectedValue(new BuyerAccessRateLimitExceeded(11)),
    };

    const recordOutcome = {
      succeeded: vi.fn(),
      streamFailed: vi.fn(),
    };

    const handler = createProtectedDownloadHandler({
      validateSession,
      prepareDelivery,
      recordOutcome,
      appEnv: "production",
    });

    const request = new NextRequest(
      `${APP_URL}/api/buyer-access/resources/44444444-4444-4444-8444-444444444444`,
      {
        headers: {
          cookie: "__Host-lessenc_buyer=session-token",
        },
      },
    );

    const response = await handler(request, "44444444-4444-4444-8444-444444444444");

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("11");
    expect(await response.json()).toEqual({
      error: "TOO_MANY_REQUESTS",
    });

    expect(recordOutcome.succeeded).not.toHaveBeenCalled();
    expect(recordOutcome.streamFailed).not.toHaveBeenCalled();
  });
});
