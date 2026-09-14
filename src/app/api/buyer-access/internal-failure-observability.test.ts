import { NextRequest } from "next/server";

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  BuyerAccessRateLimitUnavailable,
  RateLimitedBuyerAccessExchangeExecutor,
} from "../../../modules/entitlements/application/buyer-access-rate-limit-enforcement";
import type { BuyerSubject } from "../../../modules/entitlements/application/buyer-session";
import {
  ReissueBuyerAccessCredential,
  RevokeBuyerAccessCredential,
} from "../../../modules/entitlements/application/manage-buyer-access-credential";
import { ProcessEntitlementRevocation } from "../../../modules/entitlements/application/process-entitlement-revocation";
import { createBuyerAccessExchangeHandler } from "./exchange/handler";
import { createBuyerAccessLibraryHandler } from "./library/handler";
import { createProtectedDownloadHandler } from "./resources/[resourceId]/handler";

const APP_URL =
  "https://lessenc.example";

const ORDER_ID =
  "22222222-2222-4222-8222-222222222222";

const CREDENTIAL_ID =
  "33333333-3333-4333-8333-333333333333";

const RESOURCE_ID =
  "44444444-4444-4444-8444-444444444444";

const OUTBOX_EVENT_ID =
  "55555555-5555-4555-8555-555555555555";

const SUBJECT: BuyerSubject =
  Object.freeze({
    customerId:
      "11111111-1111-4111-8111-111111111111",
    orderId: ORDER_ID,
    credentialId: CREDENTIAL_ID,
  });

function record(
  value: unknown,
): Record<string, unknown> {
  return JSON.parse(
    String(value),
  ) as Record<string, unknown>;
}

describe("P11 internal failure observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes a limiter backend failure without invoking the protected operation", async () => {
    const inner = {
      execute: vi.fn().mockResolvedValue({
        sessionToken: "should-not-run",
      }),
    };

    const limiter = {
      consume: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "DB_UNAVAILABLE",
          ),
        ),
    };

    const hasher = {
      hash: vi
        .fn()
        .mockReturnValue(
          "a".repeat(64),
        ),
    };

    const service =
      new RateLimitedBuyerAccessExchangeExecutor(
        inner,
        limiter,
        hasher,
      );

    const failure =
      await service
        .execute("lba_test")
        .catch((error: unknown) => error);

    expect(
      failure,
    ).toBeInstanceOf(
      BuyerAccessRateLimitUnavailable,
    );

    expect(failure).toMatchObject({
      message: "DB_UNAVAILABLE",
      scope: "EXCHANGE_GLOBAL",
    });

    expect(inner.execute).not.toHaveBeenCalled();
  });

  it("logs exchange limiter unavailability and keeps backend details private", async () => {
    const diagnostic = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const handler =
      createBuyerAccessExchangeHandler({
        exchange: {
          execute: vi
            .fn()
            .mockRejectedValue(
              new BuyerAccessRateLimitUnavailable(
                "EXCHANGE_GLOBAL",
                {
                  cause: new Error(
                    "mysql://private-user:private-password@database",
                  ),
                },
              ),
            ),
        },
        appUrl: APP_URL,
        appEnv: "production",
      });

    const response =
      await handler(
        new Request(
          `${APP_URL}/api/buyer-access/exchange`,
          {
            method: "POST",
            headers: {
              origin: APP_URL,
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              credential:
                `lba_${"x".repeat(43)}`,
            }),
          },
        ),
      );

    expect(response.status).toBe(503);

    const serialized =
      String(
        diagnostic.mock.calls[0]?.[0],
      );

    expect(serialized).not.toContain(
      "private-password",
    );

    expect(record(serialized)).toMatchObject({
      event:
        "buyer_access_limiter_unavailable",
      surface: "RATE_LIMIT",
      scope: "EXCHANGE_GLOBAL",
      outcome: "FAILED",
      failureCode:
        "RATE_LIMIT_UNAVAILABLE",
    });
  });

  it("logs library limiter unavailability with the correct scope", async () => {
    const diagnostic = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const handler =
      createBuyerAccessLibraryHandler({
        validateSession: {
          execute: vi
            .fn()
            .mockResolvedValue(SUBJECT),
        },
        listResources: {
          execute: vi
            .fn()
            .mockRejectedValue(
              new BuyerAccessRateLimitUnavailable(
                "LIBRARY_CREDENTIAL",
                {
                  cause:
                    new Error(
                      "database unavailable",
                    ),
                },
              ),
            ),
        },
        appEnv: "production",
      });

    const response =
      await handler(
        new NextRequest(
          `${APP_URL}/api/buyer-access/library`,
          {
            headers: {
              cookie:
                "__Host-lessenc_buyer=session-token",
            },
          },
        ),
      );

    expect(response.status).toBe(503);

    expect(
      record(
        diagnostic.mock.calls[0]?.[0],
      ),
    ).toMatchObject({
      event:
        "buyer_access_limiter_unavailable",
      surface: "RATE_LIMIT",
      scope: "LIBRARY_CREDENTIAL",
      outcome: "FAILED",
      failureCode:
        "RATE_LIMIT_UNAVAILABLE",
    });
  });

  it("logs download limiter unavailability with the correct scope", async () => {
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
              new BuyerAccessRateLimitUnavailable(
                "DOWNLOAD_CREDENTIAL",
                {
                  cause:
                    new Error(
                      "database unavailable",
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
        new NextRequest(
          `${APP_URL}/api/buyer-access/resources/${RESOURCE_ID}`,
          {
            headers: {
              cookie:
                "__Host-lessenc_buyer=session-token",
            },
          },
        ),
        RESOURCE_ID,
      );

    expect(response.status).toBe(503);

    const serialized =
      String(
        diagnostic.mock.calls[0]?.[0],
      );

    expect(serialized).not.toContain(
      RESOURCE_ID,
    );

    expect(record(serialized)).toMatchObject({
      event:
        "buyer_access_limiter_unavailable",
      surface: "RATE_LIMIT",
      scope: "DOWNLOAD_CREDENTIAL",
      outcome: "FAILED",
      failureCode:
        "RATE_LIMIT_UNAVAILABLE",
    });
  });

  it("logs credential revocation failure without order or credential identifiers", async () => {
    const diagnostic = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const repository = {
      revoke: vi
        .fn()
        .mockRejectedValue(
          new Error(
            `private failure ${ORDER_ID} ${CREDENTIAL_ID}`,
          ),
        ),
      reissue: vi.fn(),
    };

    const service =
      new RevokeBuyerAccessCredential(
        repository,
      );

    await expect(
      service.execute(
        ORDER_ID,
        CREDENTIAL_ID,
      ),
    ).rejects.toThrow();

    const serialized =
      String(
        diagnostic.mock.calls[0]?.[0],
      );

    expect(serialized).not.toContain(
      ORDER_ID,
    );

    expect(serialized).not.toContain(
      CREDENTIAL_ID,
    );

    expect(record(serialized)).toMatchObject({
      event:
        "credential_recovery_failed",
      surface: "CREDENTIAL_RECOVERY",
      outcome: "FAILED",
      failureCode:
        "CREDENTIAL_REVOCATION_FAILED",
    });
  });

  it("logs credential reissue failure without exposing generated credential material", async () => {
    const diagnostic = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const rawCredential =
      `lba_${"z".repeat(43)}`;

    const repository = {
      revoke: vi.fn(),
      reissue: vi
        .fn()
        .mockRejectedValue(
          new Error(
            `private failure ${rawCredential}`,
          ),
        ),
    };

    const secretService = {
      issue: vi.fn().mockReturnValue({
        rawCredential,
        secretHash:
          "a".repeat(64),
      }),

      hash: vi.fn().mockReturnValue({
        ok: false as const,
        reason:
          "MALFORMED_CREDENTIAL" as const,
      }),
    };

    const service =
      new ReissueBuyerAccessCredential(
        repository,
        secretService,
      );

    await expect(
      service.execute(
        ORDER_ID,
        CREDENTIAL_ID,
      ),
    ).rejects.toThrow();

    const serialized =
      String(
        diagnostic.mock.calls[0]?.[0],
      );

    expect(serialized).not.toContain(
      rawCredential,
    );

    expect(serialized).not.toContain(
      ORDER_ID,
    );

    expect(serialized).not.toContain(
      CREDENTIAL_ID,
    );

    expect(record(serialized)).toMatchObject({
      event:
        "credential_recovery_failed",
      surface: "CREDENTIAL_RECOVERY",
      outcome: "FAILED",
      failureCode:
        "CREDENTIAL_REISSUE_FAILED",
    });
  });

  it("logs refund entitlement revocation failure without exposing the outbox event id", async () => {
    const diagnostic = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const service =
      new ProcessEntitlementRevocation({
        processRefundCompleted:
          vi
            .fn()
            .mockRejectedValue(
              new Error(
                `persistence failure ${OUTBOX_EVENT_ID}`,
              ),
            ),
      });

    await expect(
      service.execute(
        OUTBOX_EVENT_ID,
      ),
    ).rejects.toThrow();

    const serialized =
      String(
        diagnostic.mock.calls[0]?.[0],
      );

    expect(serialized).not.toContain(
      OUTBOX_EVENT_ID,
    );

    expect(record(serialized)).toMatchObject({
      event:
        "entitlement_revocation_failed",
      surface:
        "ENTITLEMENT_REVOCATION",
      outcome: "FAILED",
      failureCode:
        "ENTITLEMENT_REVOCATION_FAILED",
    });
  });
});
