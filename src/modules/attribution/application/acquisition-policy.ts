import type { AttributionTouchType } from "./persistence";

export const ATTRIBUTION_LOOKBACK_DAYS = 30;
export const JOURNEY_LIFETIME_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const FIELD_LIMITS = Object.freeze({
  source: 96,
  medium: 96,
  campaign: 191,
  content: 191,
  term: 191,
  referrerHost: 253,
  landingPath: 1024,
});

export type CanonicalUtm = Readonly<{
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
}>;

export type AcquisitionClassification = Readonly<{
  touchType: AttributionTouchType;
  externallyAttributable: boolean;
}>;

function normalizeBoundedText(value: string | null, maxLength: number): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

export function extractCanonicalUtm(searchParams: URLSearchParams): CanonicalUtm {
  return Object.freeze({
    source: normalizeBoundedText(searchParams.get("utm_source"), FIELD_LIMITS.source),
    medium: normalizeBoundedText(searchParams.get("utm_medium"), FIELD_LIMITS.medium),
    campaign: normalizeBoundedText(searchParams.get("utm_campaign"), FIELD_LIMITS.campaign),
    content: normalizeBoundedText(searchParams.get("utm_content"), FIELD_LIMITS.content),
    term: normalizeBoundedText(searchParams.get("utm_term"), FIELD_LIMITS.term),
  });
}

export function hasCanonicalUtm(utm: CanonicalUtm): boolean {
  return (
    utm.source !== null ||
    utm.medium !== null ||
    utm.campaign !== null ||
    utm.content !== null ||
    utm.term !== null
  );
}

export function sanitizeLandingPath(rawValue: string | null | undefined): string | null {
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "https://lessenc.invalid");

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const pathname = parsed.pathname.length > 0 ? parsed.pathname : "/";

    return pathname.slice(0, FIELD_LIMITS.landingPath);
  } catch {
    return null;
  }
}

export function sanitizeExternalReferrerHost(
  rawReferrer: string | null | undefined,
  canonicalAppUrl: string,
): string | null {
  if (typeof rawReferrer !== "string" || rawReferrer.trim().length === 0) {
    return null;
  }

  try {
    const referrer = new URL(rawReferrer);
    const application = new URL(canonicalAppUrl);

    if (
      (referrer.protocol !== "http:" && referrer.protocol !== "https:") ||
      (application.protocol !== "http:" && application.protocol !== "https:")
    ) {
      return null;
    }

    if (referrer.origin === application.origin) {
      return null;
    }

    const host = referrer.hostname.trim().toLowerCase();

    if (host.length === 0) {
      return null;
    }

    return host.slice(0, FIELD_LIMITS.referrerHost);
  } catch {
    return null;
  }
}

export function classifyAcquisition(
  utm: CanonicalUtm,
  externalReferrerHost: string | null,
): AcquisitionClassification {
  if (hasCanonicalUtm(utm)) {
    return Object.freeze({
      touchType: "CAMPAIGN",
      externallyAttributable: true,
    });
  }

  if (externalReferrerHost !== null) {
    return Object.freeze({
      touchType: "REFERRAL",
      externallyAttributable: true,
    });
  }

  return Object.freeze({
    touchType: "DIRECT",
    externallyAttributable: false,
  });
}

export function journeyExpiresAt(startedAt: Date): Date {
  return new Date(startedAt.getTime() + JOURNEY_LIFETIME_DAYS * DAY_MS);
}

export function isJourneyActive(expiresAt: Date, now: Date): boolean {
  return now.getTime() < expiresAt.getTime();
}

export function isWithinAttributionLookback(occurredAt: Date, conversionAt: Date): boolean {
  const elapsedMs = conversionAt.getTime() - occurredAt.getTime();

  return elapsedMs >= 0 && elapsedMs <= ATTRIBUTION_LOOKBACK_DAYS * DAY_MS;
}

export function nextFirstTouchId(
  currentFirstTouchId: string | null,
  candidateTouchId: string,
  externallyAttributable: boolean,
): string | null {
  if (currentFirstTouchId !== null) {
    return currentFirstTouchId;
  }

  return externallyAttributable ? candidateTouchId : null;
}

export function nextLastTouchId(
  currentLastTouchId: string | null,
  candidateTouchId: string,
  externallyAttributable: boolean,
): string | null {
  return externallyAttributable ? candidateTouchId : currentLastTouchId;
}
