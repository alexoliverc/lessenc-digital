import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins/two-factor";

import type { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseClient } from "@/infrastructure/database/client";
import { parseP12AdminAuthEnv, parseServerEnv } from "@/lib/config/env-schema";

export function createAdminAuth(database: PrismaClient) {
  const serverEnv = parseServerEnv(process.env);
  const adminEnv = parseP12AdminAuthEnv({
    P12_ADMIN_AUTH_SECRET: process.env.P12_ADMIN_AUTH_SECRET,
  });
  const hosted = serverEnv.APP_ENV === "staging" || serverEnv.APP_ENV === "production";

  return betterAuth({
    database: prismaAdapter(database, { provider: "mysql" }),
    secret: adminEnv.P12_ADMIN_AUTH_SECRET,
    baseURL: serverEnv.APP_URL,
    basePath: "/api/admin/auth",
    trustedOrigins: [new URL(serverEnv.APP_URL).origin],
    advanced: {
      // The explicit __Host- name must not receive Better Auth's additional __Secure- prefix.
      useSecureCookies: false,
      cookiePrefix: "lessenc_admin",
      cookies: {
        session_token: { name: hosted ? "__Host-lessenc_admin" : "lessenc_admin" },
      },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: hosted,
        sameSite: "lax",
        path: "/",
      },
    },
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
        accountLockout: { enabled: true, maxFailedAttempts: 10, durationSeconds: 15 * 60 },
      }),
    ],
    telemetry: { enabled: false },
  });
}

let singleton: ReturnType<typeof createAdminAuth> | undefined;

/** Defers secret, TLS and database evaluation until an administrative request needs it. */
export function getAdminAuth() {
  singleton ??= createAdminAuth(getDatabaseClient());
  return singleton;
}
