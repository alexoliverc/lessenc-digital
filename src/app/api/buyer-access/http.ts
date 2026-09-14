export type BuyerAccessAppEnv = "local" | "test" | "staging" | "production";

export const BUYER_SESSION_TTL_SECONDS = 24 * 60 * 60;

export const BUYER_ACCESS_MAX_BODY_BYTES = 4096;

export const BUYER_ACCESS_NO_STORE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
});

export function buyerAccessCookieName(appEnv: BuyerAccessAppEnv): string {
  return appEnv === "local" ? "lessenc_buyer" : "__Host-lessenc_buyer";
}

export function buyerAccessCookieOptions(appEnv: BuyerAccessAppEnv) {
  return Object.freeze({
    httpOnly: true,
    sameSite: "lax" as const,
    secure: appEnv !== "local",
    path: "/",
    maxAge: BUYER_SESSION_TTL_SECONDS,
  });
}

export function buyerAccessExpiredCookieOptions(appEnv: BuyerAccessAppEnv) {
  return Object.freeze({
    httpOnly: true,
    sameSite: "lax" as const,
    secure: appEnv !== "local",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export function hasExpectedOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
