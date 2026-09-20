import type { NextRequest } from "next/server";

import { getDatabaseClient } from "../../../../infrastructure/database/client";
import { PrismaBuyerAccessCredentialRepository } from "../../../../infrastructure/database/prisma-buyer-access-credential-repository";
import { PrismaBuyerAccessRateLimitRepository } from "../../../../infrastructure/database/prisma-buyer-access-rate-limit-repository";
import { PrismaResourceAuthorizationRepository } from "../../../../infrastructure/database/prisma-resource-authorization-repository";
import { HmacBuyerSession } from "../../../../infrastructure/security/hmac-buyer-session";
import { Sha256BuyerAccessRateLimitKey } from "../../../../infrastructure/security/sha256-buyer-access-rate-limit-key";
import { getP11BuyerSessionEnv, serverEnv } from "../../../../lib/config/env";
import { FixedWindowBuyerAccessRateLimiter } from "../../../../modules/entitlements/application/buyer-access-rate-limit";
import { RateLimitedBuyerLibraryReader } from "../../../../modules/entitlements/application/buyer-access-rate-limit-enforcement";
import { ListBuyerDigitalResources } from "../../../../modules/entitlements/application/list-buyer-digital-resources";
import { ValidateBuyerSession } from "../../../../modules/entitlements/application/validate-buyer-session";
import { createBuyerAccessLibraryHandler } from "./handler";

export async function GET(request: NextRequest) {
  const db = getDatabaseClient();

  const sessionEnv = getP11BuyerSessionEnv();

  const sessionService = new HmacBuyerSession(sessionEnv.P11_BUYER_SESSION_SECRET);

  const validateSession = new ValidateBuyerSession(
    new PrismaBuyerAccessCredentialRepository(db),
    sessionService,
  );

  const listResources = new RateLimitedBuyerLibraryReader(
    new ListBuyerDigitalResources(new PrismaResourceAuthorizationRepository(db)),
    new FixedWindowBuyerAccessRateLimiter(new PrismaBuyerAccessRateLimitRepository(db)),
    new Sha256BuyerAccessRateLimitKey(),
  );

  return createBuyerAccessLibraryHandler({
    validateSession,
    listResources,
    appEnv: serverEnv.APP_ENV,
  })(request);
}
