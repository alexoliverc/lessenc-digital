import { describe, expect, it } from "vitest";

import { inspectPerformanceRequest } from "./browser-network-guard";

describe("P17 browser egress guard", () => {
  it("allows only explicit local application paths and methods", () => {
    expect(
      inspectPerformanceRequest({
        rawUrl: "http://127.0.0.1:3100/checkout/payment/start",
        method: "POST",
      }),
    ).toEqual({
      state: "REJECT",
      reason: "PAYMENT_ENDPOINT_SYNTHETIC_ONLY",
    });
    expect(
      inspectPerformanceRequest({
        rawUrl:
          "http://127.0.0.1:3100/api/buyer-access/resources/17000000-0000-4000-8000-000000000103",
        method: "GET",
      }),
    ).toEqual({ state: "ALLOW" });
  });

  it("blocks payment endpoints if synthetic interception is absent", () => {
    for (const rawUrl of [
      "http://127.0.0.1:3100/checkout/payment/start?unexpected=1",
      "http://127.0.0.1:3100/checkout/payment/status",
    ]) {
      expect(inspectPerformanceRequest({ rawUrl, method: "POST" })).toEqual({
        state: "REJECT",
        reason: "PAYMENT_ENDPOINT_SYNTHETIC_ONLY",
      });
    }
  });
  it("rejects Mercado Pago and every unexpected external origin", () => {
    expect(
      inspectPerformanceRequest({
        rawUrl: "https://sdk.mercadopago.com/js/v2",
        method: "GET",
      }),
    ).toEqual({ state: "REJECT", reason: "ORIGIN_NOT_ALLOWED" });
    expect(
      inspectPerformanceRequest({
        rawUrl: "https://example.invalid/collect",
        method: "POST",
      }),
    ).toEqual({ state: "REJECT", reason: "ORIGIN_NOT_ALLOWED" });
  });

  it("restricts the calibration origin to its three fixed endpoints", () => {
    expect(
      inspectPerformanceRequest({
        rawUrl: "http://127.0.0.1:3101/calibration/download",
        method: "GET",
      }),
    ).toEqual({ state: "ALLOW" });
    expect(
      inspectPerformanceRequest({
        rawUrl: "http://127.0.0.1:3101/arbitrary",
        method: "GET",
      }),
    ).toEqual({ state: "REJECT", reason: "CALIBRATION_PATH_NOT_ALLOWED" });
  });

  it("allows only the exact local consent endpoint methods needed to clear the overlay", () => {
    expect(
      inspectPerformanceRequest({
        rawUrl: "http://127.0.0.1:3100/api/analytics/consent",
        method: "GET",
      }),
    ).toEqual({ state: "ALLOW" });
    expect(
      inspectPerformanceRequest({
        rawUrl: "http://127.0.0.1:3100/api/analytics/consent",
        method: "POST",
      }),
    ).toEqual({ state: "ALLOW" });
    expect(
      inspectPerformanceRequest({
        rawUrl: "http://127.0.0.1:3100/api/analytics/consent/other",
        method: "POST",
      }),
    ).toEqual({ state: "REJECT", reason: "METHOD_NOT_ALLOWED" });
  });
});
