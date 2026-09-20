import { getP11BuyerSessionEnv, serverEnv } from "../../../../lib/config/env";
import { getDatabaseClient } from "../../../../infrastructure/database/client";
import { PrismaBuyerAccessCredentialRepository } from "../../../../infrastructure/database/prisma-buyer-access-credential-repository";
import { PrismaBuyerAccessRateLimitRepository } from "../../../../infrastructure/database/prisma-buyer-access-rate-limit-repository";
import { HmacBuyerSession } from "../../../../infrastructure/security/hmac-buyer-session";
import { OpaqueBuyerAccessCredentialService } from "../../../../infrastructure/security/opaque-buyer-access-credential";
import { Sha256BuyerAccessRateLimitKey } from "../../../../infrastructure/security/sha256-buyer-access-rate-limit-key";
import { RateLimitedBuyerAccessExchangeExecutor } from "../../../../modules/entitlements/application/buyer-access-rate-limit-enforcement";
import { FixedWindowBuyerAccessRateLimiter } from "../../../../modules/entitlements/application/buyer-access-rate-limit";
import { ExchangeBuyerAccessCredential } from "../../../../modules/entitlements/application/exchange-buyer-access-credential";
import { createBuyerAccessExchangeHandler } from "./handler";

export async function POST(request: Request) {
  const db = getDatabaseClient();

  const credentialRepository = new PrismaBuyerAccessCredentialRepository(db);

  const sessionEnv = getP11BuyerSessionEnv();

  const exchange = new RateLimitedBuyerAccessExchangeExecutor(
    new ExchangeBuyerAccessCredential(
      credentialRepository,
      new OpaqueBuyerAccessCredentialService(),
      new HmacBuyerSession(sessionEnv.P11_BUYER_SESSION_SECRET),
    ),
    new FixedWindowBuyerAccessRateLimiter(new PrismaBuyerAccessRateLimitRepository(db)),
    new Sha256BuyerAccessRateLimitKey(),
  );

  return createBuyerAccessExchangeHandler({
    exchange,
    appUrl: serverEnv.APP_URL,
    appEnv: serverEnv.APP_ENV,
  })(request);
}
