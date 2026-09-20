import { describe, expect, it } from "vitest";

import {
  checkoutPaymentSecurityHeaders,
  globalSecurityHeaders,
  securityHeaderRules,
} from "./http-security-headers";

function asMap(appEnv: string) {
  return new Map(globalSecurityHeaders(appEnv).map(({ key, value }) => [key, value]));
}

describe("global HTTP security headers", () => {
  it("applies the baseline to every application route", () => {
    const rules = securityHeaderRules("local");

    expect(rules).toHaveLength(2);
    expect(rules[0]?.source).toBe("/:path*");
    expect(rules[1]?.source).toBe("/checkout/payment");
  });

  it("uses an explicit CSP for the providers represented by the repository", () => {
    const headers = asMap("local");
    const csp = headers.get("Content-Security-Policy")!;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("https://sdk.mercadopago.com");
    expect(csp).toContain("https://www.googletagmanager.com");
    expect(csp).toContain("https://connect.facebook.net");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/(?:^|; )default-src https:/u);
    expect(csp).not.toMatch(/(?:^|; )frame-src https:(?:;|$)/u);
  });

  it("relaxes only checkout payment frames for provider-originated dynamic 3DS ACS URLs", () => {
    const csp = new Map(
      checkoutPaymentSecurityHeaders("production").map(({ key, value }) => [key, value]),
    ).get("Content-Security-Policy")!;

    expect(csp).toContain("frame-src https:");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).not.toContain("form-action https:");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("derives hosted-only policy from the APP_ENV supplied at build configuration time", () => {
    const local = securityHeaderRules("local");
    const production = securityHeaderRules("production");

    const localGlobal = new Map(local[0]!.headers.map(({ key, value }) => [key, value]));

    const productionGlobal = new Map(production[0]!.headers.map(({ key, value }) => [key, value]));

    expect(localGlobal.has("Strict-Transport-Security")).toBe(false);
    expect(productionGlobal.get("Strict-Transport-Security")).toBe("max-age=31536000");
  });

  it("sets browser hardening headers and omits HSTS outside hosted environments", () => {
    const headers = asMap("test");

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Content-Security-Policy")).not.toContain("upgrade-insecure-requests");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });

  it.each(["staging", "production"])("sets conservative HSTS in %s", (appEnv) => {
    expect(asMap(appEnv).get("Strict-Transport-Security")).toBe("max-age=31536000");

    expect(asMap(appEnv).get("Content-Security-Policy")).toContain("upgrade-insecure-requests");
  });

  it("does not request preload or includeSubDomains", () => {
    const hsts = asMap("production").get("Strict-Transport-Security")!;

    expect(hsts).not.toContain("preload");
    expect(hsts).not.toContain("includeSubDomains");
  });
});
