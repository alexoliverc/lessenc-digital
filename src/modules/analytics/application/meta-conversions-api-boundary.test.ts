import { describe, expect, it, vi } from "vitest";

import {
  META_CAPI_TRANSMISSION_BLOCK_REASON,
  type MetaCapiCanonicalPurchaseCore,
} from "./meta-conversions-api";

import {
  evaluateMetaCapiTransportBoundary,
  inspectMetaCapiServerConfiguration,
} from "./meta-conversions-api-boundary";

const EVENT_ID = "22222222-2222-4222-8222-222222222222";

const ACCESS_TOKEN = "TEST_SECRET_META_ACCESS_TOKEN";

function core(): MetaCapiCanonicalPurchaseCore {
  return {
    eventName: "Purchase",

    eventTime: 1_789_840_215,

    eventId: EVENT_ID,

    actionSource: "website",

    orderId: "11111111-1111-4111-8111-111111111111",

    productId: "33333333-3333-4333-8333-333333333333",

    offerId: "44444444-4444-4444-8444-444444444444",

    value: 139.9,

    currency: "BRL",

    quantity: 1,

    transmission: {
      state: "BLOCKED",

      reason: META_CAPI_TRANSMISSION_BLOCK_REASON,
    },
  };
}

describe("P13-F5 Meta CAPI configuration and transport kill-switch", () => {
  it("reports CAPI disabled when no server configuration exists", () => {
    expect(
      inspectMetaCapiServerConfiguration({
        pixelId: null,

        accessToken: null,
      }),
    ).toEqual({
      state: "DISABLED",
    });
  });

  it("fails configuration inspection closed when Pixel ID is missing", () => {
    expect(
      inspectMetaCapiServerConfiguration({
        accessToken: ACCESS_TOKEN,
      }),
    ).toEqual({
      state: "MISCONFIGURED",

      missing: "PIXEL_ID",
    });
  });

  it("fails configuration inspection closed when access token is missing", () => {
    expect(
      inspectMetaCapiServerConfiguration({
        pixelId: "1234567890",
      }),
    ).toEqual({
      state: "MISCONFIGURED",

      missing: "ACCESS_TOKEN",
    });
  });

  it("reports configured state without exposing the access-token value", () => {
    const result = inspectMetaCapiServerConfiguration({
      pixelId: "1234567890",

      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({
      state: "CONFIGURED",

      pixelId: "1234567890",

      accessTokenPresent: true,
    });

    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN);

    expect(Object.prototype.hasOwnProperty.call(result, "accessToken")).toBe(false);
  });

  it("policy block has precedence over configured server credentials", () => {
    const loadConfiguration = vi.fn(() =>
      inspectMetaCapiServerConfiguration({
        pixelId: "1234567890",

        accessToken: ACCESS_TOKEN,
      }),
    );

    const result = evaluateMetaCapiTransportBoundary({
      core: core(),

      loadConfiguration,
    });

    expect(result).toEqual({
      state: "BLOCKED_POLICY",

      reason: "MATCHING_DATA_POLICY_NOT_AUTHORIZED",

      eventId: EVENT_ID,

      configurationInspected: false,
    });

    expect(loadConfiguration).not.toHaveBeenCalled();
  });

  it("policy block also precedes disabled or malformed configuration", () => {
    const disabled = vi.fn(() => inspectMetaCapiServerConfiguration({}));

    const malformed = vi.fn(() =>
      inspectMetaCapiServerConfiguration({
        pixelId: "1234567890",
      }),
    );

    expect(
      evaluateMetaCapiTransportBoundary({
        core: core(),

        loadConfiguration: disabled,
      }).state,
    ).toBe("BLOCKED_POLICY");

    expect(
      evaluateMetaCapiTransportBoundary({
        core: core(),

        loadConfiguration: malformed,
      }).state,
    ).toBe("BLOCKED_POLICY");

    expect(disabled).not.toHaveBeenCalled();

    expect(malformed).not.toHaveBeenCalled();
  });

  it("preserves the canonical Pixel/CAPI event identity at the transport boundary", () => {
    const result = evaluateMetaCapiTransportBoundary({
      core: core(),

      loadConfiguration: () => ({
        state: "DISABLED",
      }),
    });

    expect(result.eventId).toBe(EVENT_ID);

    expect(result.reason).toBe(META_CAPI_TRANSMISSION_BLOCK_REASON);
  });

  it("does not require or expose a network transport while policy is blocked", () => {
    const result = evaluateMetaCapiTransportBoundary({
      core: core(),

      loadConfiguration: () => {
        throw new Error("configuration must not be inspected");
      },
    });

    expect(result).toMatchObject({
      state: "BLOCKED_POLICY",

      configurationInspected: false,
    });
  });
});
