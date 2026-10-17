import { createHmac, timingSafeEqual } from "node:crypto";

const ID = /^ORD[A-Za-z0-9]{1,60}$/u;
const REQUEST_ID = /^[A-Za-z0-9_-]{1,100}$/u;

export type MercadoPagoWebhookRejectionReason =
  | "SECRET_MISSING"
  | "DATA_ID_MISSING"
  | "DATA_ID_INVALID"
  | "SIGNATURE_MISSING"
  | "SIGNATURE_MALFORMED"
  | "REQUEST_ID_MISSING"
  | "REQUEST_ID_INVALID"
  | "TIMESTAMP_MISSING"
  | "TIMESTAMP_INVALID"
  | "DIGEST_MISSING"
  | "DIGEST_INVALID"
  | "TIMESTAMP_OUT_OF_WINDOW"
  | "HMAC_MISMATCH";

export type MercadoPagoWebhookHmacDifferential =
  "ORIGINAL_CASE_MATCH" | "LOWERCASE_CASE_MATCH" | "NEITHER_MATCH" | "NOT_COMPARABLE";

type MercadoPagoWebhookNonHmacRejectionReason = Exclude<
  MercadoPagoWebhookRejectionReason,
  "HMAC_MISMATCH"
>;

export type MercadoPagoWebhookVerification =
  | Readonly<{ valid: true }>
  | Readonly<{ valid: false; reason: MercadoPagoWebhookNonHmacRejectionReason }>
  | Readonly<{
      valid: false;
      reason: "HMAC_MISMATCH";
      hmacDifferential: MercadoPagoWebhookHmacDifferential;
    }>;

type MercadoPagoWebhookVerificationInput = Readonly<{
  dataId: unknown;
  requestId: unknown;
  signature: unknown;
  secret: string;
  now?: number;
}>;

type MercadoPagoWebhookHmacDifferentialInput = Readonly<{
  dataId: unknown;
  requestId: unknown;
  timestamp: unknown;
  digest: unknown;
  secret: unknown;
}>;

function rejected(
  reason: MercadoPagoWebhookNonHmacRejectionReason,
): MercadoPagoWebhookVerification {
  return { valid: false, reason };
}

function hmacMatches(
  dataId: string,
  requestId: string,
  timestamp: string,
  digest: string,
  secret: string,
): boolean {
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  const actual = Buffer.from(digest, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Compares only synthetic/in-memory HMAC candidates and returns a closed, value-free category.
 * ORIGINAL_CASE_MATCH is a consistency control: diagnoseMercadoPagoWebhook accepts that case, so
 * the route never emits it as a rejection diagnostic.
 */
export function classifyMercadoPagoWebhookHmacDifferential(
  input: MercadoPagoWebhookHmacDifferentialInput,
): MercadoPagoWebhookHmacDifferential {
  const { dataId, requestId, timestamp, digest, secret } = input;
  if (
    typeof secret !== "string" ||
    secret.length === 0 ||
    typeof dataId !== "string" ||
    !ID.test(dataId) ||
    typeof requestId !== "string" ||
    !REQUEST_ID.test(requestId) ||
    typeof timestamp !== "string" ||
    !/^(\d{10}|\d{13})$/u.test(timestamp) ||
    typeof digest !== "string" ||
    !/^[0-9a-f]{64}$/u.test(digest)
  ) {
    return "NOT_COMPARABLE";
  }

  if (hmacMatches(dataId, requestId, timestamp, digest, secret)) {
    return "ORIGINAL_CASE_MATCH";
  }

  if (hmacMatches(dataId.toLowerCase(), requestId, timestamp, digest, secret)) {
    return "LOWERCASE_CASE_MATCH";
  }

  return "NEITHER_MATCH";
}

/**
 * Classifies signature rejection without returning or logging any request value.
 * Acceptance remains fail-closed and identical to verifyMercadoPagoWebhook.
 */
export function diagnoseMercadoPagoWebhook(
  input: MercadoPagoWebhookVerificationInput,
): MercadoPagoWebhookVerification {
  const { dataId, requestId, signature, secret } = input;

  if (!secret) return rejected("SECRET_MISSING");
  if (typeof dataId !== "string" || dataId.length === 0) return rejected("DATA_ID_MISSING");
  if (!ID.test(dataId)) return rejected("DATA_ID_INVALID");
  if (typeof signature !== "string" || signature.length === 0) return rejected("SIGNATURE_MISSING");
  if (signature.length > 160) return rejected("SIGNATURE_MALFORMED");
  if (typeof requestId !== "string" || requestId.length === 0)
    return rejected("REQUEST_ID_MISSING");
  if (!REQUEST_ID.test(requestId)) return rejected("REQUEST_ID_INVALID");

  const parts = signature.split(",");
  if (parts.length !== 2) return rejected("SIGNATURE_MALFORMED");
  const tsPart = parts.find((part) => part.startsWith("ts="));
  const v1Part = parts.find((part) => part.startsWith("v1="));
  if (!tsPart) return rejected("TIMESTAMP_MISSING");
  if (!v1Part) return rejected("DIGEST_MISSING");
  const ts = tsPart.slice(3);
  const digest = v1Part.slice(3);
  if (!/^(\d{10}|\d{13})$/u.test(ts)) return rejected("TIMESTAMP_INVALID");
  if (!/^[0-9a-f]{64}$/u.test(digest)) return rejected("DIGEST_INVALID");
  // Official examples use milliseconds; the official SDK validator uses seconds.
  const signedTimeMs = ts.length === 10 ? Number(ts) * 1000 : Number(ts);
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(now) || Math.abs(now - signedTimeMs) > 300_000)
    return rejected("TIMESTAMP_OUT_OF_WINDOW");
  // Acceptance remains case-preserving. The lowercase candidate is diagnostic-only after this
  // original-case comparison fails and is never accepted as a fallback.
  const hmacDifferential = classifyMercadoPagoWebhookHmacDifferential({
    dataId,
    requestId,
    timestamp: ts,
    digest,
    secret,
  });

  return hmacDifferential === "ORIGINAL_CASE_MATCH"
    ? { valid: true }
    : { valid: false, reason: "HMAC_MISMATCH", hmacDifferential };
}

/** Preserves the boolean verification API for existing callers. */
export function verifyMercadoPagoWebhook(input: MercadoPagoWebhookVerificationInput): boolean {
  return diagnoseMercadoPagoWebhook(input).valid;
}
