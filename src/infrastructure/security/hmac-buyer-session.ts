import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  BuyerSession,
  BuyerSessionService,
  BuyerSubject,
} from "../../modules/entitlements/application/buyer-session";
import { type Clock, SystemClock } from "../../shared/clock";

const TOKEN_PREFIX = "v1";
const TOKEN_PATTERN = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

const MIN_SECRET_BYTES = 32;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 2048;

type BuyerSessionPayload = Readonly<{
  version: 1;
  purpose: "BUYER_SESSION";
  customerId: string;
  orderId: string;
  credentialId: string;
  issuedAt: number;
  expiresAt: number;
}>;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function decodeBase64UrlStrict(value: string): Buffer | null {
  if (!value || !BASE64URL_PATTERN.test(value)) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, "base64url");

    if (decoded.length === 0 || decoded.toString("base64url") !== value) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function canonicalKeys(value: Record<string, unknown>): string {
  return Object.keys(value).sort().join(",");
}

function sign(payloadSegment: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${TOKEN_PREFIX}.${payloadSegment}`, "utf8").digest();
}

export class HmacBuyerSession implements BuyerSessionService {
  constructor(
    private readonly secret: string,
    private readonly clock: Clock = new SystemClock(),
  ) {
    if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
      throw new Error("P11_BUYER_SESSION_CONFIGURATION_UNAVAILABLE");
    }
  }

  issue(subject: BuyerSubject): string {
    if (!isUuid(subject.customerId) || !isUuid(subject.orderId) || !isUuid(subject.credentialId)) {
      throw new Error("INVALID_BUYER_SESSION_SUBJECT");
    }

    const issuedAt = this.clock.now().getTime();

    if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) {
      throw new Error("INVALID_BUYER_SESSION_TIME");
    }

    const payload: BuyerSessionPayload = Object.freeze({
      version: 1,
      purpose: "BUYER_SESSION",
      customerId: subject.customerId.toLowerCase(),
      orderId: subject.orderId.toLowerCase(),
      credentialId: subject.credentialId.toLowerCase(),
      issuedAt,
      expiresAt: issuedAt + TTL_MS,
    });

    const payloadSegment = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

    const signatureSegment = sign(payloadSegment, this.secret).toString("base64url");

    return [TOKEN_PREFIX, payloadSegment, signatureSegment].join(".");
  }

  verify(token: unknown): BuyerSession | null {
    if (
      typeof token !== "string" ||
      token.length > MAX_TOKEN_LENGTH ||
      !TOKEN_PATTERN.test(token)
    ) {
      return null;
    }

    const [prefix, payloadSegment, signatureSegment] = token.split(".");

    if (prefix !== TOKEN_PREFIX || !payloadSegment || !signatureSegment) {
      return null;
    }

    const payloadBytes = decodeBase64UrlStrict(payloadSegment);

    const actualSignature = decodeBase64UrlStrict(signatureSegment);

    if (!payloadBytes || !actualSignature) {
      return null;
    }

    const expectedSignature = sign(payloadSegment, this.secret);

    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      return null;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(payloadBytes.toString("utf8"));
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const claims = parsed as Record<string, unknown>;

    if (
      canonicalKeys(claims) !==
      ["credentialId", "customerId", "expiresAt", "issuedAt", "orderId", "purpose", "version"].join(
        ",",
      )
    ) {
      return null;
    }

    if (
      claims.version !== 1 ||
      claims.purpose !== "BUYER_SESSION" ||
      !isUuid(claims.customerId) ||
      !isUuid(claims.orderId) ||
      !isUuid(claims.credentialId) ||
      typeof claims.issuedAt !== "number" ||
      typeof claims.expiresAt !== "number" ||
      !Number.isSafeInteger(claims.issuedAt) ||
      !Number.isSafeInteger(claims.expiresAt) ||
      claims.issuedAt < 0 ||
      claims.expiresAt - claims.issuedAt !== TTL_MS
    ) {
      return null;
    }

    const now = this.clock.now().getTime();

    if (!Number.isSafeInteger(now) || now < claims.issuedAt || now >= claims.expiresAt) {
      return null;
    }

    return Object.freeze({
      version: 1,
      purpose: "BUYER_SESSION",
      customerId: claims.customerId.toLowerCase(),
      orderId: claims.orderId.toLowerCase(),
      credentialId: claims.credentialId.toLowerCase(),
      issuedAt: claims.issuedAt,
      expiresAt: claims.expiresAt,
    });
  }
}
