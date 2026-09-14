import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins/two-factor";

import type { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseClient } from "@/infrastructure/database/client";
import { parseP12AdminAuthEnv, parseServerEnv } from "@/lib/config/env-schema";

const serverEnv = parseServerEnv(process.env);
const adminEnv = parseP12AdminAuthEnv({
  P12_ADMIN_AUTH_SECRET: process.env.P12_ADMIN_AUTH_SECRET,
});

// P12-B defines persistence only. No Next.js handler is mounted here.
export function createAdminAuth(database: PrismaClient) {
  return betterAuth({
    database: prismaAdapter(database, { provider: "mysql" }),
    secret: adminEnv.P12_ADMIN_AUTH_SECRET,
    baseURL: serverEnv.APP_URL,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: true,
    },
    // Better Auth addresses Prisma's lower-camel delegates, while the schema keeps Admin* model names.
    user: { modelName: "adminUser" },
    session: {
      modelName: "adminSession",
      expiresIn: 8 * 60 * 60,
      disableSessionRefresh: true,
      freshAge: 5 * 60,
      cookieCache: { enabled: false },
    },
    account: { modelName: "adminAccount" },
    verification: { modelName: "adminVerification" },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "adminAuthRateLimitBucket",
    },
    plugins: [
      twoFactor({
        twoFactorTable: "adminTwoFactor",
        skipVerificationOnEnable: false,
        allowPasswordless: false,
        backupCodeOptions: { storeBackupCodes: "encrypted" },
      }),
    ],
    telemetry: { enabled: false },
  });
}

export const auth = createAdminAuth(getDatabaseClient());

export { auth as adminAuth };
