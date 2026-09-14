import { adminAuth } from "@/infrastructure/auth/admin-auth";
import { createAdminAuthRoute } from "@/infrastructure/auth/admin-auth-http";
import { getDatabaseClient } from "@/infrastructure/database/client";
import { serverEnv } from "@/lib/config/env";
import { resolveAdminSession } from "@/modules/administration/infrastructure/admin-subject";

const handlers = createAdminAuthRoute(adminAuth, serverEnv.APP_URL, (headers) =>
  resolveAdminSession({ auth: adminAuth, database: getDatabaseClient(), headers }),
);

export const GET = handlers.GET;
export const POST = handlers.POST;
