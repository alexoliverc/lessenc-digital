import { NextRequest } from "next/server";

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { BuyerAccessRateLimitExceeded } from "../../../modules/entitlements/application/buyer-access-rate-limit-enforcement";
import type { BuyerSubject } from "../../../modules/entitlements/application/buyer-session";
import { PrivateResourceStorageError } from "../../../modules/entitlements/application/private-resource-storage";
import type { PreparedProtectedDelivery } from "../../../modules/entitlements/application/protected-digital-delivery";
import { createBuyerAccessExchangeHandler } from "./exchange/handler";
import { createBuyerAccessLibraryHandler } from "./library/handler";
import { createProtectedDownloadHandler } from "./resources/[resourceId]/handler";

const APP_URL = "https://lessenc.example";

const RAW_CREDENTIAL =
  `lba_${"x".repeat(43)}`;

const SESSION_TOKEN =
  "v1.private-session.signature";

const RESOURCE_ID =
  "44444444-4444-4444-8444-444444444444";

const SUBJECT: BuyerSubject =
  Object.freeze({
    customerId:
      "11111111-1111-4111-8111-111111111111",
    orderId:
      "22222222-2222-4222-8222-222222222222",
    credentialId:
      "33333333-3333-4333-8333-333333333333",
  });

function exchangeRequest(): Request {
  return new Request(
    `${APP_URL}/api/buyer-access/exchange`,
    {
      method: "POST",
      headers: {
        origin: APP_URL,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        credential: RAW_CREDENTIAL,
      }),
    },
  );
}

function libraryRequest(): NextRequest {
  return new NextRequest(
    `${APP_URL}/api/buyer-access/library`,
    {
      headers: {
        cookie:
          `__Host-lessenc_buyer=${SESSION_TOKEN}`,
      },
    },
  );
}

function downloadRequest(): NextRequest {
  return new NextRequest(
    `${APP_URL}/api/buyer-access/resources/${RESOURCE_ID}`,
    {
      headers: {
        cookie:
          `__Host-lessenc_buyer=${SESSION_TOKEN}`,
      },
    },
  );
}

async function* successfulBody() {
  yield new Uint8Array([1, 2, 3]);
}

function delivery(
  body: AsyncIterable<Uint8Array> =
    successfulBody(),
): PreparedProtectedDelivery {
  return Object.freeze({
    resourceId: RESOURCE_ID,
    entitlementId:
      "55555555-5555-4555-8555-555555555555",
    buyerAccessCredentialId:
      SUBJECT.credentialId,
    filename: "resource.pdf",
    mediaType: "application/pdf",
    sizeBytes: 3,
    body,
  });
}

function parseRecord(
  value: unknown,
): Record<string, unknown> {
  return JSON.parse(
    String(value),
  ) as Record<string, unknown>;
}

describe("P11 Buyer Access observability boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs invalid Buyer Access without credential or token disclosure", async () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const handler =
      createBuyerAccessExchangeHandler({
        exchange: {
          execute: vi
            .fn()
            .mockRejectedValue(
              new Error("ACCESS_INVALID"),
            ),
        },
        appUrl: APP_URL,
        appEnv: "production",
      });

    const response =
      await handler(exchangeRequest());

    expect(response.status).toBe(401);
    expect(warning).toHaveBeenCalledTimes(1);

    const serialized =
      String(warning.mock.calls[0]?.[0]);

    expect(serialized).not.toContain(
      RAW_CREDENTIAL,
    );

    expect(serialized).not.toContain(
      SESSION_TOKEN,
    );

    const record =
      parseRecord(serialized);

    expect(record).toMatchObject({
      level: "warn",
      event: "buyer_access_invalid",
      surface: "BUYER_ACCESS_EXCHANGE",
      outcome: "DENIED",
      failureCode: "ACCESS_INVALID",
    });

    expect(record.correlationId).toMatch(
      /^[0-9a-f-]{36}$/iu,
    );
  });

  it("logs HTTP rate limiting without exposing raw credential material", async () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const handler =
      createBuyerAccessExchangeHandler({
        exchange: {
          execute: vi
            .fn()
            .mockRejectedValue(
              new BuyerAccessRateLimitExceeded(17),
            ),
        },
        appUrl: APP_URL,
        appEnv: "production",
      });

    const response =
      await handler(exchangeRequest());

    expect(response.status).toBe(429);
    expect(
      response.headers.get("retry-after"),
    ).toBe("17");

    expect(warning).toHaveBeenCalledTimes(1);

    const serialized =
      String(warning.mock.calls[0]?.[0]);

    expect(serialized).not.toContain(
      RAW_CREDENTIAL,
    );

    expect(
      parseRecord(serialized),
    ).toMatchObject({
      event: "buyer_access_rate_limited",
      surface: "BUYER_ACCESS_EXCHANGE",
      outcome: "DENIED",
      failureCode: "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: 17,
    });
  });

  it("logs invalid persisted library session without logging the session token", async () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const handler =
      createBuyerAccessLibraryHandler({
        validateSession: {
          execute: vi
            .fn()
            .mockRejectedValue(
              new Error("SESSION_INVALID"),
            ),
        },
        listResources: {
          execute: vi.fn(),
        },
        appEnv: "production",
      });

    const response =
      await handler(libraryRequest());

    expect(response.status).toBe(401);

    const serialized =
      String(warning.mock.calls[0]?.[0]);

    expect(serialized).not.toContain(
      SESSION_TOKEN,
    );

    expect(
      parseRecord(serialized),
    ).toMatchObject({
      event: "buyer_access_invalid",
      surface: "BUYER_LIBRARY",
      outcome: "DENIED",
      failureCode: "SESSION_INVALID",
    });
  });

  it("logs protected resource denial without high-cardinality identifiers", async () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const handler =
      createProtectedDownloadHandler({
        validateSession: {
          execute: vi
            .fn()
            .mockResolvedValue(SUBJECT),
        },
        prepareDelivery: {
          execute: vi
            .fn()
            .mockRejectedValue(
              new Error(
                "RESOURCE_NOT_AVAILABLE",
              ),
            ),
        },
        recordOutcome: {
          succeeded: vi.fn(),
          streamFailed: vi.fn(),
        },
        appEnv: "production",
      });

    const response =
      await handler(
        downloadRequest(),
        RESOURCE_ID,
      );

    expect(response.status).toBe(404);

    const serialized =
      String(warning.mock.calls[0]?.[0]);

    expect(serialized).not.toContain(
      RESOURCE_ID,
    );
    expect(serialized).not.toContain(
      SUBJECT.orderId,
    );
    expect(serialized).not.toContain(
      SUBJECT.credentialId,
    );

    expect(
      parseRecord(serialized),
    ).toMatchObject({
      event: "buyer_access_invalid",
      surface: "PROTECTED_DOWNLOAD",
      outcome: "DENIED",
      failureCode:
        "RESOURCE_NOT_AVAILABLE",
    });
  });

  it("logs normalized private storage failures without paths or locators", async () => {
    const diagnostic = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const handler =
      createProtectedDownloadHandler({
        validateSession: {
          execute: vi
            .fn()
            .mockResolvedValue(SUBJECT),
        },
        prepareDelivery: {
          execute: vi
            .fn()
            .mockRejectedValue(
              new Error(
                "DELIVERY_UNAVAILABLE",
                {
                  cause:
                    new PrivateResourceStorageError(
                      "STORAGE_ROOT_UNAVAILABLE",
                    ),
                },
              ),
            ),
        },
        recordOutcome: {
          succeeded: vi.fn(),
          streamFailed: vi.fn(),
        },
        appEnv: "production",
      });

    const response =
      await handler(
        downloadRequest(),
        RESOURCE_ID,
      );

    expect(response.status).toBe(503);
    expect(diagnostic).toHaveBeenCalledTimes(1);

    const serialized =
      String(diagnostic.mock.calls[0]?.[0]);

    expect(serialized).not.toContain(
      "C:\\",
    );
    expect(serialized).not.toContain(
      RESOURCE_ID,
    );

    expect(
      parseRecord(serialized),
    ).toMatchObject({
      event: "private_storage_failure",
      surface: "PRIVATE_STORAGE",
      outcome: "FAILED",
      failureCode:
        "STORAGE_ROOT_UNAVAILABLE",
    });
  });

  it("logs delivery audit unavailability before releasing response bytes", async () => {
    const diagnostic = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    let bodyPulled = false;

    async function* guardedBody() {
      bodyPulled = true;
      yield new Uint8Array([1]);
    }

    const handler =
      createProtectedDownloadHandler({
        validateSession: {
          execute: vi
            .fn()
            .mockResolvedValue(SUBJECT),
        },
        prepareDelivery: {
          execute: vi
            .fn()
            .mockResolvedValue(
              delivery(guardedBody()),
            ),
        },
        recordOutcome: {
          succeeded: vi
            .fn()
            .mockRejectedValue(
              new Error(
                "DELIVERY_AUDIT_UNAVAILABLE",
              ),
            ),
          streamFailed: vi.fn(),
        },
        appEnv: "production",
      });

    const response =
      await handler(
        downloadRequest(),
        RESOURCE_ID,
      );

    await expect(
      response.arrayBuffer(),
    ).rejects.toBeDefined();

    expect(bodyPulled).toBe(false);

    expect(
      parseRecord(
        diagnostic.mock.calls[0]?.[0],
      ),
    ).toMatchObject({
      event:
        "delivery_audit_unavailable",
      surface: "DELIVERY_AUDIT",
      outcome: "FAILED",
      failureCode:
        "DELIVERY_AUDIT_UNAVAILABLE",
    });
  });

  it("logs stream failure after delivery start without logging internal exception text", async () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    async function* failingBody() {
      yield new Uint8Array([1]);

      throw new Error(
        "C:\\private\\secret-resource.pdf",
      );
    }

    const handler =
      createProtectedDownloadHandler({
        validateSession: {
          execute: vi
            .fn()
            .mockResolvedValue(SUBJECT),
        },
        prepareDelivery: {
          execute: vi
            .fn()
            .mockResolvedValue(
              delivery(failingBody()),
            ),
        },
        recordOutcome: {
          succeeded: vi
            .fn()
            .mockResolvedValue(undefined),
          streamFailed: vi
            .fn()
            .mockResolvedValue(undefined),
        },
        appEnv: "production",
      });

    const response =
      await handler(
        downloadRequest(),
        RESOURCE_ID,
      );

    await expect(
      response.arrayBuffer(),
    ).rejects.toBeDefined();

    expect(warning).toHaveBeenCalledTimes(1);

    const serialized =
      String(warning.mock.calls[0]?.[0]);

    expect(serialized).not.toContain(
      "secret-resource.pdf",
    );
    expect(serialized).not.toContain(
      RESOURCE_ID,
    );

    expect(
      parseRecord(serialized),
    ).toMatchObject({
      event: "delivery_stream_failed",
      surface: "PROTECTED_DOWNLOAD",
      outcome: "FAILED",
      failureCode: "STREAM_FAILED",
    });
  });
});
