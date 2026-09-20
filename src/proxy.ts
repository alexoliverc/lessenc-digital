import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { VIEW_CONTENT_EVENT_REQUEST_HEADER } from "./modules/analytics/application/measurement-http-boundary";
import {
  CORRELATION_RESPONSE_HEADER,
  createCorrelationId,
  INTERNAL_CORRELATION_REQUEST_HEADER,
} from "./lib/observability/correlation";
import {
  ACQUISITION_JOURNEY_COOKIE_NAME,
  ACQUISITION_JOURNEY_REQUEST_HEADER,
  ACQUISITION_OBSERVED_AT_REQUEST_HEADER,
  acquisitionCookieExpiresAt,
  isAcquisitionPrefetch,
  resolveAcquisitionJourneyId,
} from "./modules/attribution/application/acquisition-http-boundary";

export function proxy(request: NextRequest) {
  const correlationId = createCorrelationId();
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(INTERNAL_CORRELATION_REQUEST_HEADER, correlationId);

  const isPublicSalesAcquisition =
    request.nextUrl.pathname === "/cronograma-capilar-inteligente" &&
    request.method === "GET" &&
    !isAcquisitionPrefetch(request.headers);

  if (!isPublicSalesAcquisition) {
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    response.headers.set(CORRELATION_RESPONSE_HEADER, correlationId);

    return response;
  }

  const observedAt = new Date();

  const resolved = resolveAcquisitionJourneyId(
    request.cookies.get(ACQUISITION_JOURNEY_COOKIE_NAME)?.value,
    randomUUID,
  );

  requestHeaders.set(ACQUISITION_JOURNEY_REQUEST_HEADER, resolved.journeyId);

  requestHeaders.set(ACQUISITION_OBSERVED_AT_REQUEST_HEADER, observedAt.toISOString());

  requestHeaders.set(VIEW_CONTENT_EVENT_REQUEST_HEADER, randomUUID());

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(CORRELATION_RESPONSE_HEADER, correlationId);

  if (resolved.created) {
    response.cookies.set({
      name: ACQUISITION_JOURNEY_COOKIE_NAME,
      value: resolved.journeyId,
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      expires: acquisitionCookieExpiresAt(observedAt),
    });
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
    },
  ],
};
