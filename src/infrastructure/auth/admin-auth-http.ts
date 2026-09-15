import { toNextJsHandler } from "better-auth/next-js";

const BASE_PATH = "/api/admin/auth";
const ALLOWED = new Map<string, "GET" | "POST">([
  ["/sign-in/email", "POST"],
  ["/get-session", "GET"],
  ["/sign-out", "POST"],
  ["/two-factor/enable", "POST"],
  ["/two-factor/verify-totp", "POST"],
  ["/two-factor/verify-backup-code", "POST"],
  ["/two-factor/generate-backup-codes", "POST"],
]);

function json(status: number, body: Record<string, unknown>, upstream?: Response): Response {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  if (upstream) {
    for (const cookie of upstream.headers.getSetCookie()) headers.append("set-cookie", cookie);
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) headers.set("retry-after", retryAfter);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function sameOriginMutation(request: Request, canonicalOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin !== canonicalOrigin) return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin";
}

async function safeMfaBody(request: Request, path: string): Promise<boolean> {
  if (!path.startsWith("/two-factor/")) return true;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) return false;
  let body: unknown;
  try {
    const raw = await request.clone().text();
    if (Buffer.byteLength(raw, "utf8") > 4096) return false;
    body = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const input = body as Record<string, unknown>;
  if (input.trustDevice !== undefined && input.trustDevice !== false) return false;
  if (input.disableSession !== undefined && input.disableSession !== false) return false;
  if (path === "/two-factor/enable" && input.method !== undefined && input.method !== "totp")
    return false;
  return true;
}

export function createAdminAuthRoute(
  auth: { handler: (request: Request) => Promise<Response> },
  canonicalAppUrl: string,
  sessionPolicy: (headers: Headers) => Promise<{ mfaComplete: boolean; fresh: boolean } | null>,
) {
  const next = toNextJsHandler(auth);
  const canonicalOrigin = new URL(canonicalAppUrl).origin;

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.startsWith(`${BASE_PATH}/`)
      ? url.pathname.slice(BASE_PATH.length)
      : "";
    if (url.origin !== canonicalOrigin || url.search || ALLOWED.get(path) !== request.method) {
      return json(404, { code: "NOT_FOUND" });
    }
    if (request.method === "POST" && !sameOriginMutation(request, canonicalOrigin)) {
      return json(403, { code: "FORBIDDEN" });
    }
    if (!(await safeMfaBody(request, path))) return json(400, { code: "INVALID_REQUEST" });

    if (path === "/get-session") {
      const state = await sessionPolicy(request.headers);
      return json(200, { authenticated: state !== null, mfaComplete: state?.mfaComplete ?? false });
    }
    if (path === "/two-factor/enable") {
      const state = await sessionPolicy(request.headers);
      if (!state || state.mfaComplete) return json(403, { code: "FORBIDDEN" });
    }
    if (path === "/two-factor/generate-backup-codes") {
      const state = await sessionPolicy(request.headers);
      if (!state?.mfaComplete || !state.fresh) return json(403, { code: "FORBIDDEN" });
    }

    const response = request.method === "GET" ? await next.GET(request) : await next.POST(request);
    if (path === "/sign-in/email" && !response.ok) {
      return response.status === 429
        ? json(429, { code: "RATE_LIMITED" }, response)
        : json(401, { code: "INVALID_CREDENTIALS" }, response);
    }
    if (!response.ok) {
      return response.status === 429
        ? json(429, { code: "RATE_LIMITED" }, response)
        : json(401, { code: "AUTHENTICATION_FAILED" }, response);
    }
    if (path === "/sign-in/email") {
      const result: unknown = await response.clone().json();
      if (result && typeof result === "object" && "twoFactorRedirect" in result) {
        return json(200, { next: "TOTP_REQUIRED" }, response);
      }
      return json(200, { next: "MFA_ENROLLMENT_REQUIRED" }, response);
    }
    if (path === "/sign-out") return json(200, { status: "SIGNED_OUT" }, response);
    if (path === "/two-factor/verify-totp" || path === "/two-factor/verify-backup-code") {
      return json(200, { status: "VERIFIED" }, response);
    }
    return response;
  }

  return { GET: handle, POST: handle };
}

export const adminAuthRouteAllowlist = Object.freeze([...ALLOWED.keys()]);
