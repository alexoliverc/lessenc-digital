import { createHmac, timingSafeEqual } from "node:crypto";

const ID = /^ORD[A-Za-z0-9]{1,60}$/u;
const REQUEST_ID = /^[A-Za-z0-9_-]{1,100}$/u;

/** Matches the signed manifest in the official Mercado Pago webhook validator. */
export function verifyMercadoPagoWebhook(
  input: Readonly<{
    dataId: unknown;
    requestId: unknown;
    signature: unknown;
    secret: string;
    now?: number;
  }>,
): boolean {
  const { dataId, requestId, signature, secret } = input;
  if (
    typeof dataId !== "string" ||
    !ID.test(dataId) ||
    typeof requestId !== "string" ||
    !REQUEST_ID.test(requestId) ||
    typeof signature !== "string" ||
    !secret ||
    signature.length > 160
  )
    return false;
  const parts = signature.split(",");
  if (parts.length !== 2) return false;
  const tsPart = parts.find((part) => part.startsWith("ts="));
  const v1Part = parts.find((part) => part.startsWith("v1="));
  if (!tsPart || !v1Part) return false;
  const ts = tsPart.slice(3);
  const digest = v1Part.slice(3);
  if (!/^(\d{10}|\d{13})$/u.test(ts) || !/^[0-9a-f]{64}$/u.test(digest)) return false;
  // Official examples use milliseconds; the official SDK validator uses seconds.
  const signedTimeMs = ts.length === 10 ? Number(ts) * 1000 : Number(ts);
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(now) || Math.abs(now - signedTimeMs) > 300_000) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  const actual = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
