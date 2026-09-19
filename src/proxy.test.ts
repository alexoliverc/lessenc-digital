import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  ACQUISITION_JOURNEY_COOKIE_NAME,
  ACQUISITION_JOURNEY_REQUEST_HEADER,
  ACQUISITION_OBSERVED_AT_REQUEST_HEADER,
} from "./modules/attribution/application/acquisition-http-boundary";
import { config, proxy } from "./proxy";

describe("P13-C Next.js acquisition proxy", () => {
  it("is narrowly matched only to the public sales acquisition path", () => {
    expect(config.matcher).toEqual([
      {
        source: "/cronograma-capilar-inteligente",
        missing: [
          {
            type: "header",
            key: "next-router-prefetch",
          },
          {
            type: "header",
            key: "purpose",
            value: "prefetch",
          },
        ],
      },
    ]);
  });

  it("issues an HttpOnly first-party cookie for a new acquisition journey", () => {
    const response = proxy(
      new NextRequest("https://lessenc.example/cronograma-capilar-inteligente?utm_source=google"),
    );

    const cookie = response.cookies.get(ACQUISITION_JOURNEY_COOKIE_NAME);

    expect(cookie?.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(setCookie).toContain(ACQUISITION_JOURNEY_COOKIE_NAME);

    expect(setCookie).toContain("HttpOnly");

    expect(setCookie.toLowerCase()).toContain("samesite=lax");

    expect(setCookie).toContain("Secure");

    expect(setCookie).toContain("Path=/");
  });

  it("does not refresh an already valid journey cookie", () => {
    const existing = "550e8400-e29b-41d4-a716-446655440000";

    const request = new NextRequest("https://lessenc.example/cronograma-capilar-inteligente", {
      headers: {
        cookie: `${ACQUISITION_JOURNEY_COOKIE_NAME}=${existing}`,
      },
    });

    const response = proxy(request);

    expect(response.cookies.get(ACQUISITION_JOURNEY_COOKIE_NAME)).toBeUndefined();
  });

  it("does not create acquisition state for prefetch requests", () => {
    const response = proxy(
      new NextRequest("https://lessenc.example/cronograma-capilar-inteligente", {
        headers: {
          purpose: "prefetch",
        },
      }),
    );

    expect(response.cookies.get(ACQUISITION_JOURNEY_COOKIE_NAME)).toBeUndefined();
  });

  it("does not create acquisition state for non-GET requests", () => {
    const response = proxy(
      new NextRequest("https://lessenc.example/cronograma-capilar-inteligente", {
        method: "POST",
      }),
    );

    expect(response.cookies.get(ACQUISITION_JOURNEY_COOKIE_NAME)).toBeUndefined();
  });

  it("uses private upstream request headers rather than public response headers", () => {
    const response = proxy(
      new NextRequest("https://lessenc.example/cronograma-capilar-inteligente"),
    );

    expect(response.headers.has(ACQUISITION_JOURNEY_REQUEST_HEADER)).toBe(false);

    expect(response.headers.has(ACQUISITION_OBSERVED_AT_REQUEST_HEADER)).toBe(false);

    const overridden = response.headers.get("x-middleware-override-headers") ?? "";

    expect(overridden).toContain(ACQUISITION_JOURNEY_REQUEST_HEADER);

    expect(overridden).toContain(ACQUISITION_OBSERVED_AT_REQUEST_HEADER);
  });
});
