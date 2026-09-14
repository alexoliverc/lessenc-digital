import { NextResponse } from "next/server";

import {
  createP11CorrelationId,
  p11Observability,
} from "../../../../lib/observability/p11-observability";
import {
  BUYER_ACCESS_MAX_BODY_BYTES,
  BUYER_ACCESS_NO_STORE_HEADERS,
  buyerAccessCookieName,
  buyerAccessCookieOptions,
  hasExpectedOrigin,
  type BuyerAccessAppEnv,
} from "../http";
import {
  BuyerAccessRateLimitExceeded,
  BuyerAccessRateLimitUnavailable,
} from "../../../../modules/entitlements/application/buyer-access-rate-limit-enforcement";

export interface BuyerAccessExchangeExecutor {
  execute(rawCredential: unknown): Promise<
    Readonly<{
      sessionToken: string;
    }>
  >;
}

type ExchangeHandlerDependencies = Readonly<{
  exchange: BuyerAccessExchangeExecutor;
  appUrl: string;
  appEnv: BuyerAccessAppEnv;
}>;

async function readCredential(request: Request): Promise<
  | Readonly<{
      ok: true;
      credential: unknown;
    }>
  | Readonly<{
      ok: false;
    }>
> {
  const contentType = request.headers.get("content-type");

  if (!contentType || !contentType.toLowerCase().startsWith("application/json")) {
    return { ok: false };
  }

  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const parsedLength = Number(contentLength);

    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > BUYER_ACCESS_MAX_BODY_BYTES
    ) {
      return { ok: false };
    }
  }

  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return { ok: false };
  }

  if (Buffer.byteLength(rawBody, "utf8") > BUYER_ACCESS_MAX_BODY_BYTES) {
    return { ok: false };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false };
  }

  const record = parsed as Record<string, unknown>;

  if (Object.keys(record).sort().join(",") !== "credential") {
    return { ok: false };
  }

  return {
    ok: true,
    credential: record.credential,
  };
}

export function createBuyerAccessExchangeHandler(dependencies: ExchangeHandlerDependencies) {
  return async function handleExchange(request: Request): Promise<NextResponse> {
    const correlationId = createP11CorrelationId();

    if (!hasExpectedOrigin(request, dependencies.appUrl)) {
      return NextResponse.json(
        {
          error: "REQUEST_INVALID",
        },
        {
          status: 403,
          headers: BUYER_ACCESS_NO_STORE_HEADERS,
        },
      );
    }

    const body = await readCredential(request);

    if (!body.ok) {
      return NextResponse.json(
        {
          error: "REQUEST_INVALID",
        },
        {
          status: 400,
          headers: BUYER_ACCESS_NO_STORE_HEADERS,
        },
      );
    }

    try {
      const result = await dependencies.exchange.execute(body.credential);

      const response = NextResponse.json(
        {
          ok: true,
        },
        {
          status: 200,
          headers: BUYER_ACCESS_NO_STORE_HEADERS,
        },
      );

      response.cookies.set(
        buyerAccessCookieName(dependencies.appEnv),
        result.sessionToken,
        buyerAccessCookieOptions(dependencies.appEnv),
      );

      return response;
    } catch (error) {
      if (error instanceof BuyerAccessRateLimitExceeded) {
        p11Observability.warn(
          "buyer_access_rate_limited",
          {
            correlationId,
            surface: "BUYER_ACCESS_EXCHANGE",
            outcome: "DENIED",
            failureCode: "RATE_LIMIT_EXCEEDED",
            retryAfterSeconds: error.retryAfterSeconds,
          },
        );

        return NextResponse.json(
          {
            error: "TOO_MANY_REQUESTS",
          },
          {
            status: 429,
            headers: {
              ...BUYER_ACCESS_NO_STORE_HEADERS,
              "Retry-After": String(error.retryAfterSeconds),
            },
          },
        );
      }

      if (error instanceof BuyerAccessRateLimitUnavailable) {
        p11Observability.error(
          "buyer_access_limiter_unavailable",
          {
            correlationId,
            surface: "RATE_LIMIT",
            scope: error.scope,
            outcome: "FAILED",
            failureCode: "RATE_LIMIT_UNAVAILABLE",
          },
        );

        return NextResponse.json(
          {
            error: "SERVICE_UNAVAILABLE",
          },
          {
            status: 503,
            headers: BUYER_ACCESS_NO_STORE_HEADERS,
          },
        );
      }

      if (error instanceof Error && error.message === "ACCESS_INVALID") {
        p11Observability.warn(
          "buyer_access_invalid",
          {
            correlationId,
            surface: "BUYER_ACCESS_EXCHANGE",
            outcome: "DENIED",
            failureCode: "ACCESS_INVALID",
          },
        );

        return NextResponse.json(
          {
            error: "ACCESS_INVALID",
          },
          {
            status: 401,
            headers: BUYER_ACCESS_NO_STORE_HEADERS,
          },
        );
      }

      return NextResponse.json(
        {
          error: "SERVICE_UNAVAILABLE",
        },
        {
          status: 503,
          headers: BUYER_ACCESS_NO_STORE_HEADERS,
        },
      );
    }
  };
}
