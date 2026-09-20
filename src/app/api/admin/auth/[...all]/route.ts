import { getAdminAuth } from "@/infrastructure/auth/admin-auth";
import { createAdminAuthRoute } from "@/infrastructure/auth/admin-auth-http";
import { getDatabaseClient } from "@/infrastructure/database/client";
import { serverEnv } from "@/lib/config/env";
import { resolveAdminSession } from "@/modules/administration/infrastructure/admin-subject";

function handlers() {
  const adminAuth = getAdminAuth();
  return createAdminAuthRoute(adminAuth, serverEnv.APP_URL, (headers) =>
    resolveAdminSession({ auth: adminAuth, database: getDatabaseClient(), headers }),
  );
}

export const GET = (request: Request) => handlers().GET(request);
export const POST = (request: Request) => handlers().POST(request);
