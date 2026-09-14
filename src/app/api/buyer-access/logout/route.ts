import { serverEnv } from "../../../../lib/config/env";
import { createBuyerAccessLogoutHandler } from "./handler";

export async function POST(request: Request) {
  return createBuyerAccessLogoutHandler({
    appUrl: serverEnv.APP_URL,
    appEnv: serverEnv.APP_ENV,
  })(request);
}
