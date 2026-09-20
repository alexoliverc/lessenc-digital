import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { VIEW_CONTENT_EVENT_REQUEST_HEADER } from "./modules/analytics/application/measurement-http-boundary";
import {
  ACQUISITION_JOURNEY_COOKIE_NAME,
  ACQUISITION_JOURNEY_REQUEST_HEADER,
  ACQUISITION_OBSERVED_AT_REQUEST_HEADER,
} from "./modules/attribution/application/acquisition-http-boundary";
import { config, proxy } from "./proxy";
import {
  CORRELATION_RESPONSE_HEADER,
  INTERNAL_CORRELATION_REQUEST_HEADER,
} from "./lib/observability/correlation";

describe("P13-C Next.js acquisition proxy", () => {
  it("covers application requests while excluding static framework assets", () => {
    expect(config.matcher).toEqual([
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
      },
    ]);
  });

  it("replaces client correlation input with a server-generated request and response value", () => {
    const response = proxy(
      new NextRequest("https://lessenc.example/api/health", {
        headers: {
          [CORRELATION_RESPONSE_HEADER]: "11111111-1111-4111-8111-111111111111",
          [INTERNAL_CORRELATION_REQUEST_HEADER]: "22222222-2222-4222-8222-222222222222",
        },
      }),
    );

    const correlationId = response.headers.get(CORRELATION_RESPONSE_HEADER);
    const upstreamCorrelationId = response.headers.get(
      `x-middleware-request-${INTERNAL_CORRELATION_REQUEST_HEADER}`,
    );

    expect(correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
    expect(upstreamCorrelationId).toBe(correlationId);
    expect(correlationId).not.toBe("11111111-1111-4111-8111-111111111111");
    expect(correlationId).not.toBe("22222222-2222-4222-8222-222222222222");
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

  it("issues a fresh private VIEW_CONTENT event identity for each eligible request", () => {
    const first = proxy(new NextRequest("https://lessenc.example/cronograma-capilar-inteligente"));

    const second = proxy(new NextRequest("https://lessenc.example/cronograma-capilar-inteligente"));

    const middlewareHeader = `x-middleware-request-${VIEW_CONTENT_EVENT_REQUEST_HEADER}`;

    const firstEventId = first.headers.get(middlewareHeader);

    const secondEventId = second.headers.get(middlewareHeader);

    expect(first.headers.has(VIEW_CONTENT_EVENT_REQUEST_HEADER)).toBe(false);

    expect(second.headers.has(VIEW_CONTENT_EVENT_REQUEST_HEADER)).toBe(false);

    expect(firstEventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    expect(secondEventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    expect(secondEventId).not.toBe(firstEventId);

    const firstOverrides = first.headers.get("x-middleware-override-headers") ?? "";

    expect(firstOverrides).toContain(VIEW_CONTENT_EVENT_REQUEST_HEADER);
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
