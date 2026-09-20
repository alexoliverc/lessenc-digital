import { NextRequest, NextResponse } from "next/server";

import {
  createP11CorrelationId,
  p11Observability,
} from "../../../../lib/observability/p11-observability";
import type { BuyerSubject } from "../../../../modules/entitlements/application/buyer-session";
import type { BuyerDigitalResource } from "../../../../modules/entitlements/application/list-buyer-digital-resources";
import {
  BUYER_ACCESS_NO_STORE_HEADERS,
  buyerAccessCookieName,
  type BuyerAccessAppEnv,
} from "../http";
import {
  BuyerAccessRateLimitExceeded,
  BuyerAccessRateLimitUnavailable,
} from "../../../../modules/entitlements/application/buyer-access-rate-limit-enforcement";

export interface BuyerSessionValidator {
  execute(token: unknown): Promise<BuyerSubject>;
}

export interface BuyerLibraryReader {
  execute(subject: BuyerSubject): Promise<readonly BuyerDigitalResource[]>;
}

type BuyerLibraryHandlerDependencies = Readonly<{
  validateSession: BuyerSessionValidator;
  listResources: BuyerLibraryReader;
  appEnv: BuyerAccessAppEnv;
}>;

export function createBuyerAccessLibraryHandler(dependencies: BuyerLibraryHandlerDependencies) {
  return async function handleLibrary(request: NextRequest): Promise<NextResponse> {
    const correlationId = createP11CorrelationId();

    const cookieName = buyerAccessCookieName(dependencies.appEnv);

    const sessionToken = request.cookies.get(cookieName)?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          error: "SESSION_INVALID",
        },
        {
          status: 401,
          headers: BUYER_ACCESS_NO_STORE_HEADERS,
        },
      );
    }

    try {
      const subject = await dependencies.validateSession.execute(sessionToken);

      const resources = await dependencies.listResources.execute(subject);

      return NextResponse.json(
        {
          resources,
        },
        {
          status: 200,
          headers: BUYER_ACCESS_NO_STORE_HEADERS,
        },
      );
    } catch (error) {
      if (error instanceof BuyerAccessRateLimitExceeded) {
        p11Observability.warn("buyer_access_rate_limited", {
          correlationId,
          surface: "BUYER_LIBRARY",
          scope: "LIBRARY_CREDENTIAL",
          outcome: "DENIED",
          failureCode: "RATE_LIMIT_EXCEEDED",
          retryAfterSeconds: error.retryAfterSeconds,
        });

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
        p11Observability.error("buyer_access_limiter_unavailable", {
          correlationId,
          surface: "RATE_LIMIT",
          scope: error.scope,
          outcome: "FAILED",
          failureCode: "RATE_LIMIT_UNAVAILABLE",
        });

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

      if (
        error instanceof Error &&
        (error.message === "SESSION_INVALID" || error.message === "RESOURCE_NOT_AVAILABLE")
      ) {
        p11Observability.warn("buyer_access_invalid", {
          correlationId,
          surface: "BUYER_LIBRARY",
          outcome: "DENIED",
          failureCode:
            error.message === "RESOURCE_NOT_AVAILABLE"
              ? "RESOURCE_NOT_AVAILABLE"
              : "SESSION_INVALID",
        });

        return NextResponse.json(
          {
            error: "SESSION_INVALID",
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
