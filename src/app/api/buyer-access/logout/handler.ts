import { NextResponse } from "next/server";

import {
  BUYER_ACCESS_NO_STORE_HEADERS,
  buyerAccessCookieName,
  buyerAccessExpiredCookieOptions,
  hasExpectedOrigin,
  type BuyerAccessAppEnv,
} from "../http";

type LogoutHandlerDependencies = Readonly<{
  appUrl: string;
  appEnv: BuyerAccessAppEnv;
}>;

export function createBuyerAccessLogoutHandler(dependencies: LogoutHandlerDependencies) {
  return async function handleLogout(request: Request): Promise<NextResponse> {
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
      "",
      buyerAccessExpiredCookieOptions(dependencies.appEnv),
    );

    return response;
  };
}
