import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { VIEW_CONTENT_EVENT_REQUEST_HEADER } from "./modules/analytics/application/measurement-http-boundary";
import {
  ACQUISITION_JOURNEY_COOKIE_NAME,
  ACQUISITION_JOURNEY_REQUEST_HEADER,
  ACQUISITION_OBSERVED_AT_REQUEST_HEADER,
  acquisitionCookieExpiresAt,
  isAcquisitionPrefetch,
  resolveAcquisitionJourneyId,
} from "./modules/attribution/application/acquisition-http-boundary";

export function proxy(request: NextRequest) {
  if (request.method !== "GET" || isAcquisitionPrefetch(request.headers)) {
    return NextResponse.next();
  }

  const observedAt = new Date();

  const resolved = resolveAcquisitionJourneyId(
    request.cookies.get(ACQUISITION_JOURNEY_COOKIE_NAME)?.value,
    randomUUID,
  );

  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(ACQUISITION_JOURNEY_REQUEST_HEADER, resolved.journeyId);

  requestHeaders.set(ACQUISITION_OBSERVED_AT_REQUEST_HEADER, observedAt.toISOString());

  requestHeaders.set(VIEW_CONTENT_EVENT_REQUEST_HEADER, randomUUID());

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

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
  ],
};
