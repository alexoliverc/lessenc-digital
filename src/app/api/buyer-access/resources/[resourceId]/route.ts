import type { NextRequest } from "next/server";

import { getDatabaseClient } from "../../../../../infrastructure/database/client";
import { PrismaBuyerAccessCredentialRepository } from "../../../../../infrastructure/database/prisma-buyer-access-credential-repository";
import { PrismaBuyerAccessRateLimitRepository } from "../../../../../infrastructure/database/prisma-buyer-access-rate-limit-repository";
import { PrismaDigitalDeliveryAuditRepository } from "../../../../../infrastructure/database/prisma-digital-delivery-audit-repository";
import { PrismaResourceAuthorizationRepository } from "../../../../../infrastructure/database/prisma-resource-authorization-repository";
import { HmacBuyerSession } from "../../../../../infrastructure/security/hmac-buyer-session";
import { Sha256BuyerAccessRateLimitKey } from "../../../../../infrastructure/security/sha256-buyer-access-rate-limit-key";
import { createConfiguredPrivateFileStorage } from "../../../../../infrastructure/storage/configured-private-file-storage";
import { getP11BuyerSessionEnv, serverEnv } from "../../../../../lib/config/env";
import { AuthorizeDigitalResource } from "../../../../../modules/entitlements/application/authorize-digital-resource";
import { FixedWindowBuyerAccessRateLimiter } from "../../../../../modules/entitlements/application/buyer-access-rate-limit";
import { RateLimitedProtectedDownloadPreparer } from "../../../../../modules/entitlements/application/buyer-access-rate-limit-enforcement";
import {
  PrepareProtectedDelivery,
  RecordProtectedDeliveryOutcome,
} from "../../../../../modules/entitlements/application/protected-digital-delivery";
import { ValidateBuyerSession } from "../../../../../modules/entitlements/application/validate-buyer-session";
import { createProtectedDownloadHandler } from "./handler";

type RouteContext = Readonly<{
  params: Promise<{
    resourceId: string;
  }>;
}>;

export async function GET(request: NextRequest, context: RouteContext) {
  const { resourceId } = await context.params;

  const db = getDatabaseClient();

  const sessionEnv = getP11BuyerSessionEnv();

  const sessionService = new HmacBuyerSession(sessionEnv.P11_BUYER_SESSION_SECRET);

  const credentialRepository = new PrismaBuyerAccessCredentialRepository(db);

  const resourceRepository = new PrismaResourceAuthorizationRepository(db);

  const auditRepository = new PrismaDigitalDeliveryAuditRepository(db);

  const validateSession = new ValidateBuyerSession(credentialRepository, sessionService);

  const authorizeResource = new AuthorizeDigitalResource(resourceRepository);

  const storage = createConfiguredPrivateFileStorage();

  const prepareDelivery = new RateLimitedProtectedDownloadPreparer(
    new PrepareProtectedDelivery(authorizeResource, storage, auditRepository),
    new FixedWindowBuyerAccessRateLimiter(new PrismaBuyerAccessRateLimitRepository(db)),
    new Sha256BuyerAccessRateLimitKey(),
  );

  const recordOutcome = new RecordProtectedDeliveryOutcome(auditRepository);

  return createProtectedDownloadHandler({
    validateSession,
    prepareDelivery,
    recordOutcome,
    appEnv: serverEnv.APP_ENV,
  })(request, resourceId);
}
