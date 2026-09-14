import { createHmac, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAdminAuthRoute } from "@/infrastructure/auth/admin-auth-http";
import {
  resolveAdminSession,
  resolveAdminSubject,
} from "@/modules/administration/infrastructure/admin-subject";
import { createDatabaseClient } from "./client";

const APP_URL = "http://localhost:3000";
const PASSWORD = "P12-synthetic-only-password-42!";

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;
  if (process.env.APP_ENV !== "test" || !raw)
    throw new Error("P12 auth flow requires a test database");
  const url = new URL(raw);
  if (
    url.protocol !== "mysql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "3307" ||
    url.pathname !== "/lessenc_test" ||
    !url.username ||
    !url.password
  ) {
    throw new Error("P12 auth flow refused a non-isolated P06 test database");
  }
  return raw;
}

const db = createDatabaseClient(guardedTestUrl());
const userId = randomUUID();
const accountId = randomUUID();
const email = `p12-auth-${userId}@example.invalid`;
let route: ReturnType<typeof createAdminAuthRoute>;
let auth: Awaited<
  ReturnType<(typeof import("@/infrastructure/auth/admin-auth"))["createAdminAuth"]>
>;
let previousRuntimeUrl: string | undefined;
let previousSecret: string | undefined;
let backupCode: string;
let unusedBackupCode: string;
let totpUri: string;
let requestCounter = 0;
const ipPrefix = `198.${Number.parseInt(userId.slice(0, 2), 16)}.${Number.parseInt(userId.slice(2, 4), 16)}.`;
const requestIPs: string[] = [];
const challengeIdentifiers: string[] = [];

function request(
  path: string,
  body?: Record<string, unknown>,
  cookie?: string,
  method: "GET" | "POST" = "POST",
) {
  const ip = `${ipPrefix}${++requestCounter}`;
  requestIPs.push(ip);
  return new Request(`${APP_URL}/api/admin/auth${path}`, {
    method,
    headers: {
      origin: APP_URL,
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...(cookie ? { cookie } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
  });
}

function cookie(response: Response, name: string): string | null {
  const line = response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  return line?.split(";", 1)[0] ?? null;
}

function challengeCookie(response: Response): string {
  const value = response.headers
    .getSetCookie()
    .filter((line) => line.includes("two_factor="))
    .map((line) => line.split(";", 1)[0])
    .join("; ");
  const identifier = value.match(/2fa-[A-Za-z0-9]+/u)?.[0];
  if (identifier) challengeIdentifiers.push(identifier);
  return value;
}

function totpCode(uri: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const encoded = new URL(uri).searchParams.get("secret") ?? "";
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of encoded.toUpperCase()) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error("Invalid fixture TOTP URI");
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = (digest.at(-1) ?? 0) & 15;
  const number =
    (((digest[offset] ?? 0) & 127) << 24) |
    ((digest[offset + 1] ?? 0) << 16) |
    ((digest[offset + 2] ?? 0) << 8) |
    (digest[offset + 3] ?? 0);
  return (number % 1_000_000).toString().padStart(6, "0");
}

describe("P12 real administrative Better Auth route", () => {
  beforeAll(async () => {
    previousRuntimeUrl = process.env.DB_RUNTIME_URL;
    previousSecret = process.env.P12_ADMIN_AUTH_SECRET;
    process.env.DB_RUNTIME_URL = guardedTestUrl();
    process.env.P12_ADMIN_AUTH_SECRET = "p12-route-integration-secret-over-32-characters";
    const authModule = await import("@/infrastructure/auth/admin-auth");
    auth = authModule.createAdminAuth(db);
    route = createAdminAuthRoute(auth, APP_URL, (headers) =>
      resolveAdminSession({ auth, database: db, headers }),
    );
    const hash = await (await auth.$context).password.hash(PASSWORD);
    await db.adminUser.create({
      data: { id: userId, name: "P12 synthetic fixture", email, emailVerified: true },
    });
    await db.adminAccount.create({
      data: { id: accountId, userId, accountId: userId, providerId: "credential", password: hash },
    });
  });

  afterAll(async () => {
    await db.adminSession.deleteMany({ where: { userId } });
    await db.adminTwoFactor.deleteMany({ where: { userId } });
    await db.adminAccount.deleteMany({ where: { userId } });
    await db.adminVerification.deleteMany({
      where: {
        identifier: { in: challengeIdentifiers.flatMap((id) => [id, `2fa-attempts-${id}`]) },
      },
    });
    await db.adminAuthRateLimitBucket.deleteMany({
      where: { OR: requestIPs.map((ip) => ({ key: { startsWith: `${ip}|` } })) },
    });
    await db.adminUser.deleteMany({ where: { id: userId } });
    await db.$disconnect();
    if (previousRuntimeUrl === undefined) delete process.env.DB_RUNTIME_URL;
    else process.env.DB_RUNTIME_URL = previousRuntimeUrl;
    if (previousSecret === undefined) delete process.env.P12_ADMIN_AUTH_SECRET;
    else process.env.P12_ADMIN_AUTH_SECRET = previousSecret;
  });

  it("denies public signup and makes unknown email and wrong password indistinguishable", async () => {
    expect(
      (await route.POST(request("/sign-up/email", { email, password: PASSWORD }))).status,
    ).toBe(404);
    const unknown = await route.POST(
      request("/sign-in/email", { email: `unknown-${userId}@example.invalid`, password: PASSWORD }),
    );
    const wrong = await route.POST(
      request("/sign-in/email", { email, password: "wrong-password" }),
    );
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await unknown.text()).toBe(await wrong.text());
  });

  it("enforces an enrollment-only session, verifies TOTP, and revokes logout", async () => {
    const signedIn = await route.POST(request("/sign-in/email", { email, password: PASSWORD }));
    expect(signedIn.status).toBe(200);
    expect(await signedIn.json()).toEqual({ next: "MFA_ENROLLMENT_REQUIRED" });
    const firstCookie = cookie(signedIn, "lessenc_admin");
    expect(firstCookie).not.toBeNull();
    const attributes =
      signedIn.headers.getSetCookie().find((value) => value.startsWith("lessenc_admin=")) ?? "";
    expect(attributes).toContain("HttpOnly");
    expect(attributes).toMatch(/SameSite=Lax/iu);
    expect(attributes).toContain("Path=/");
    expect(attributes).not.toMatch(/Domain=/iu);
    expect(firstCookie?.startsWith("p11_")).toBe(false);
    expect(
      await resolveAdminSubject({
        auth,
        database: db,
        headers: new Headers({ cookie: firstCookie ?? "" }),
      }),
    ).toBeNull();

    const deniedEnrollment = await route.POST(
      request(
        "/two-factor/enable",
        { password: "wrong-password", method: "totp" },
        firstCookie ?? "",
      ),
    );
    expect(deniedEnrollment.status).toBe(401);
    expect(await db.adminTwoFactor.count({ where: { userId } })).toBe(0);
    const enabled = await route.POST(
      request("/two-factor/enable", { password: PASSWORD, method: "totp" }, firstCookie ?? ""),
    );
    expect(enabled.status).toBe(200);
    const enrollment: { totpURI?: string; backupCodes?: string[] } = await enabled.json();
    expect(Boolean(enrollment.totpURI)).toBe(true);
    expect((enrollment.backupCodes?.length ?? 0) > 0).toBe(true);
    backupCode = enrollment.backupCodes?.[0] ?? "";
    unusedBackupCode = enrollment.backupCodes?.[1] ?? "";
    totpUri = enrollment.totpURI ?? "";
    expect(
      await db.adminTwoFactor.findFirst({ where: { userId }, select: { verified: true } }),
    ).toMatchObject({ verified: false });
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: userId } })).twoFactorEnabled).toBe(
      false,
    );

    const verified = await route.POST(
      request(
        "/two-factor/verify-totp",
        { code: totpCode(enrollment.totpURI ?? "") },
        firstCookie ?? "",
      ),
    );
    expect(verified.status).toBe(200);
    const activeCookie = cookie(verified, "lessenc_admin");
    expect(activeCookie).not.toBeNull();
    expect(
      await resolveAdminSubject({
        auth,
        database: db,
        headers: new Headers({ cookie: activeCookie ?? "" }),
      }),
    ).toMatchObject({ adminUserId: userId, role: "SUPPORT" });

    const current = await route.GET(request("/get-session", undefined, activeCookie ?? "", "GET"));
    expect(await current.json()).toEqual({ authenticated: true, mfaComplete: true });
    const signedOut = await route.POST(request("/sign-out", {}, activeCookie ?? ""));
    expect(signedOut.status).toBe(200);
    const invalid = await route.GET(request("/get-session", undefined, activeCookie ?? "", "GET"));
    expect(await invalid.json()).toEqual({ authenticated: false, mfaComplete: false });
  });

  it("requires a second factor on the next sign-in and consumes a backup code once", async () => {
    const challenged = await route.POST(request("/sign-in/email", { email, password: PASSWORD }));
    expect(challenged.status).toBe(200);
    expect(await challenged.json()).toEqual({ next: "TOTP_REQUIRED" });
    const challenge = challengeCookie(challenged);
    expect(challenge).not.toBe("");
    expect(
      await resolveAdminSubject({
        auth,
        database: db,
        headers: new Headers({ cookie: challenge }),
      }),
    ).toBeNull();

    const incorrect = await route.POST(
      request("/two-factor/verify-totp", { code: "000000" }, challenge),
    );
    expect(incorrect.status).toBe(401);
    expect(await incorrect.json()).toEqual({ code: "AUTHENTICATION_FAILED" });
    const recovered = await route.POST(
      request("/two-factor/verify-backup-code", { code: backupCode }, challenge),
    );
    expect(recovered.status).toBe(200);
    const recoveredCookie = cookie(recovered, "lessenc_admin");
    expect(recoveredCookie).not.toBeNull();
    expect(
      await resolveAdminSubject({
        auth,
        database: db,
        headers: new Headers({ cookie: recoveredCookie ?? "" }),
      }),
    ).toMatchObject({ adminUserId: userId });

    expect(
      (await db.adminTwoFactor.findFirstOrThrow({ where: { userId } })).failedVerificationCount,
    ).toBe(0);
    const repeated = await route.POST(
      request("/two-factor/verify-backup-code", { code: backupCode }, challenge),
    );
    expect(repeated.status).toBe(401);
    const regenerated = await route.POST(
      request("/two-factor/generate-backup-codes", { password: PASSWORD }, recoveredCookie ?? ""),
    );
    expect(regenerated.status).toBe(200);
    const newCodes: { backupCodes?: string[] } = await regenerated.json();
    expect((newCodes.backupCodes?.length ?? 0) > 0).toBe(true);
    expect(newCodes.backupCodes).not.toContain(backupCode);
    const secondChallenge = await route.POST(
      request("/sign-in/email", { email, password: PASSWORD }),
    );
    expect(secondChallenge.status).toBe(200);
    const secondChallengeCookie = challengeCookie(secondChallenge);
    expect(secondChallengeCookie).not.toBe("");
    expect(
      (
        await route.POST(
          request(
            "/two-factor/verify-backup-code",
            { code: unusedBackupCode },
            secondChallengeCookie,
          ),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await route.POST(
          request(
            "/two-factor/verify-backup-code",
            { code: newCodes.backupCodes?.[0] ?? "" },
            secondChallengeCookie,
          ),
        )
      ).status,
    ).toBe(200);
  });

  it("persists rate-limit buckets and locks repeated second-factor failures", async () => {
    const bucketCount = await db.adminAuthRateLimitBucket.count({
      where: { key: { startsWith: ipPrefix } },
    });
    expect(bucketCount).toBeGreaterThan(0);
    for (let challengeNumber = 0; challengeNumber < 2; challengeNumber++) {
      const signedIn = await route.POST(request("/sign-in/email", { email, password: PASSWORD }));
      expect(signedIn.status).toBe(200);
      const challenge = challengeCookie(signedIn);
      expect(challenge).not.toBe("");
      for (let attempt = 0; attempt < 5; attempt++) {
        const failure = await route.POST(
          request("/two-factor/verify-totp", { code: "000000" }, challenge),
        );
        expect(failure.status).toBe(401);
      }
    }
    const factor = await db.adminTwoFactor.findFirstOrThrow({ where: { userId } });
    expect(factor.failedVerificationCount).toBeGreaterThanOrEqual(10);
    expect(factor.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    const signedIn = await route.POST(request("/sign-in/email", { email, password: PASSWORD }));
    expect(signedIn.status).toBe(200);
    const challenge = challengeCookie(signedIn);
    const blocked = await route.POST(
      request("/two-factor/verify-totp", { code: totpCode(totpUri) }, challenge),
    );
    expect(blocked.status).toBe(429);
  });
});
