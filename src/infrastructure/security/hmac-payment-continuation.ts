import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const TTL_MS = 24 * 60 * 60 * 1000;

export type PaymentContinuation = Readonly<{
  version: 1;
  purpose: "PAYMENT_CONTINUATION";
  orderId: string;
  issuedAt: number;
  expiresAt: number;
}>;

export class HmacPaymentContinuation {
  constructor(private readonly secret: string) {
    if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("P10 configuration unavailable");
  }

  issue(orderId: string, now = Date.now()): string {
    if (!UUID_PATTERN.test(orderId) || !Number.isSafeInteger(now) || now < 0) {
      throw new Error("Invalid payment continuation input");
    }
    const payload: PaymentContinuation = {
      version: 1,
      purpose: "PAYMENT_CONTINUATION",
      orderId,
      issuedAt: now,
      expiresAt: now + TTL_MS,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const mac = createHmac("sha256", this.secret).update(body).digest("base64url");
    return `${body}.${mac}`;
  }

  verify(token: unknown, now = Date.now()): PaymentContinuation | null {
    if (typeof token !== "string" || token.length > 1024 || !TOKEN_PATTERN.test(token)) return null;
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    const decoded = Buffer.from(body, "base64url");
    const actual = Buffer.from(signature, "base64url");
    if (decoded.toString("base64url") !== body || actual.toString("base64url") !== signature)
      return null;
    const expected = createHmac("sha256", this.secret).update(body).digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    let value: unknown;
    try {
      value = JSON.parse(decoded.toString("utf8"));
    } catch {
      return null;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const claims = value as Record<string, unknown>;
    if (
      Object.keys(claims).sort().join(",") !== "expiresAt,issuedAt,orderId,purpose,version" ||
      claims.version !== 1 ||
      claims.purpose !== "PAYMENT_CONTINUATION" ||
      typeof claims.orderId !== "string" ||
      !UUID_PATTERN.test(claims.orderId) ||
      typeof claims.issuedAt !== "number" ||
      typeof claims.expiresAt !== "number" ||
      !Number.isSafeInteger(claims.issuedAt) ||
      !Number.isSafeInteger(claims.expiresAt) ||
      claims.expiresAt - claims.issuedAt !== TTL_MS ||
      now < claims.issuedAt ||
      now >= claims.expiresAt
    )
      return null;
    return claims as PaymentContinuation;
  }
}
