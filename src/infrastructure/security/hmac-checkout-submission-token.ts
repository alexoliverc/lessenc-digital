import { createHmac, timingSafeEqual } from "node:crypto";

import {
  type CheckoutSubmissionTokenIssueError,
  type CheckoutSubmissionTokenIssueResult,
  type CheckoutSubmissionTokenService,
  type CheckoutSubmissionTokenVerifyError,
  type CheckoutSubmissionTokenVerifyResult,
} from "../../modules/commerce/application/checkout-submission-token";
import { isUtcInstant } from "../../shared/clock";

const TOKEN_VERSION = 2;
const MIN_SECRET_BYTES = 32;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

type CheckoutSubmissionPayload = Readonly<{
  v: number;
  submissionId: string;
  issuedAt: string;
  presentedAmountMinor: number;
  presentedCurrency: "BRL";
}>;

function hasValidSecret(secret: string): boolean {
  return Buffer.byteLength(secret, "utf8") >= MIN_SECRET_BYTES;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64UrlStrict(value: string): Buffer | null {
  if (!value || !BASE64URL_PATTERN.test(value)) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, "base64url");

    if (decoded.length === 0) {
      return null;
    }

    if (decoded.toString("base64url") !== value) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function createSignature(payloadSegment: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payloadSegment, "utf8").digest();
}

function issueFailure(
  reason: CheckoutSubmissionTokenIssueError,
): CheckoutSubmissionTokenIssueResult {
  return Object.freeze({
    ok: false,
    reason,
  });
}

function verifyFailure(
  reason: CheckoutSubmissionTokenVerifyError,
): CheckoutSubmissionTokenVerifyResult {
  return Object.freeze({
    ok: false,
    reason,
  });
}

export class HmacCheckoutSubmissionTokenService implements CheckoutSubmissionTokenService {
  constructor(private readonly secret: string) {}

  issue(
    input: Readonly<{
      submissionId: string;
      issuedAt: string;
      presentedAmountMinor: number;
      presentedCurrency: string;
    }>,
  ): CheckoutSubmissionTokenIssueResult {
    if (!hasValidSecret(this.secret)) {
      return issueFailure("INVALID_SECRET");
    }

    if (!isUuid(input.submissionId)) {
      return issueFailure("INVALID_SUBMISSION_ID");
    }

    if (!isUtcInstant(input.issuedAt)) {
      return issueFailure("INVALID_ISSUED_AT");
    }

    if (!Number.isSafeInteger(input.presentedAmountMinor) || input.presentedAmountMinor <= 0) {
      return issueFailure("INVALID_PRESENTED_AMOUNT");
    }

    if (input.presentedCurrency !== "BRL") {
      return issueFailure("INVALID_PRESENTED_CURRENCY");
    }

    const payload: CheckoutSubmissionPayload = Object.freeze({
      v: TOKEN_VERSION,
      submissionId: input.submissionId.toLowerCase(),
      issuedAt: input.issuedAt,
      presentedAmountMinor: input.presentedAmountMinor,
      presentedCurrency: input.presentedCurrency,
    });

    const payloadSegment = encodeBase64Url(JSON.stringify(payload));

    const signatureSegment = createSignature(payloadSegment, this.secret).toString("base64url");

    return Object.freeze({
      ok: true,
      token: `${payloadSegment}.${signatureSegment}`,
    });
  }

  verify(token: string): CheckoutSubmissionTokenVerifyResult {
    if (!hasValidSecret(this.secret)) {
      return verifyFailure("INVALID_SECRET");
    }

    if (typeof token !== "string" || !token) {
      return verifyFailure("MALFORMED_TOKEN");
    }

    const segments = token.split(".");

    if (segments.length !== 2) {
      return verifyFailure("MALFORMED_TOKEN");
    }

    const [payloadSegment, signatureSegment] = segments;

    if (!payloadSegment || !signatureSegment) {
      return verifyFailure("MALFORMED_TOKEN");
    }

    const payloadBytes = decodeBase64UrlStrict(payloadSegment);
    const signatureBytes = decodeBase64UrlStrict(signatureSegment);

    if (!payloadBytes || !signatureBytes) {
      return verifyFailure("MALFORMED_TOKEN");
    }

    const expectedSignature = createSignature(payloadSegment, this.secret);

    if (
      signatureBytes.length !== expectedSignature.length ||
      !timingSafeEqual(signatureBytes, expectedSignature)
    ) {
      return verifyFailure("INVALID_SIGNATURE");
    }

    let payload: unknown;

    try {
      payload = JSON.parse(payloadBytes.toString("utf8"));
    } catch {
      return verifyFailure("INVALID_PAYLOAD");
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return verifyFailure("INVALID_PAYLOAD");
    }

    const record = payload as Record<string, unknown>;

    if (record.v !== TOKEN_VERSION) {
      return verifyFailure("UNSUPPORTED_VERSION");
    }

    if (
      !isUuid(record.submissionId) ||
      typeof record.issuedAt !== "string" ||
      !isUtcInstant(record.issuedAt) ||
      !Number.isSafeInteger(record.presentedAmountMinor) ||
      (record.presentedAmountMinor as number) <= 0 ||
      record.presentedCurrency !== "BRL"
    ) {
      return verifyFailure("INVALID_PAYLOAD");
    }

    return Object.freeze({
      ok: true,
      value: Object.freeze({
        submissionId: record.submissionId.toLowerCase(),
        issuedAt: record.issuedAt,
        presentedAmountMinor: record.presentedAmountMinor as number,
        presentedCurrency: "BRL",
      }),
    });
  }
}
