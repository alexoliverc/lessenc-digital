export type CheckoutEmailError = "INVALID_TYPE" | "REQUIRED" | "TOO_LONG" | "INVALID_FORMAT";

export type CheckoutEmailResult =
  | Readonly<{
      ok: true;
      value: string;
    }>
  | Readonly<{
      ok: false;
      reason: CheckoutEmailError;
    }>;

const MAX_EMAIL_LENGTH = 320;
const MAX_LOCAL_PART_LENGTH = 64;
const MAX_DOMAIN_LENGTH = 255;

const INTERNAL_WHITESPACE_PATTERN = /\s/u;

const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

function failure(reason: CheckoutEmailError): CheckoutEmailResult {
  return Object.freeze({
    ok: false,
    reason,
  });
}

function containsAsciiControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) {
      return true;
    }
  }

  return false;
}

export function parseCheckoutEmail(input: unknown): CheckoutEmailResult {
  if (typeof input !== "string") {
    return failure("INVALID_TYPE");
  }

  if (containsAsciiControlCharacter(input)) {
    return failure("INVALID_FORMAT");
  }

  const trimmed = input.trim();

  if (!trimmed) {
    return failure("REQUIRED");
  }

  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return failure("TOO_LONG");
  }

  if (INTERNAL_WHITESPACE_PATTERN.test(trimmed)) {
    return failure("INVALID_FORMAT");
  }

  const firstAt = trimmed.indexOf("@");
  const lastAt = trimmed.lastIndexOf("@");

  if (firstAt <= 0 || firstAt !== lastAt || firstAt === trimmed.length - 1) {
    return failure("INVALID_FORMAT");
  }

  const localPart = trimmed.slice(0, firstAt);
  const rawDomain = trimmed.slice(firstAt + 1);

  if (
    !localPart ||
    localPart.length > MAX_LOCAL_PART_LENGTH ||
    !rawDomain ||
    rawDomain.length > MAX_DOMAIN_LENGTH
  ) {
    return failure("INVALID_FORMAT");
  }

  const normalizedDomain = rawDomain.toLowerCase();
  const labels = normalizedDomain.split(".");

  if (
    labels.length === 0 ||
    labels.some(
      (label) => label.length === 0 || label.length > 63 || !DOMAIN_LABEL_PATTERN.test(label),
    )
  ) {
    return failure("INVALID_FORMAT");
  }

  const normalized = `${localPart}@${normalizedDomain}`;

  if (normalized.length > MAX_EMAIL_LENGTH) {
    return failure("TOO_LONG");
  }

  return Object.freeze({
    ok: true,
    value: normalized,
  });
}
