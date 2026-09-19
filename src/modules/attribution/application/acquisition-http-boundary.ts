import { journeyExpiresAt } from "./acquisition-policy";

export const ACQUISITION_JOURNEY_COOKIE_NAME = "lessenc_acquisition_journey";

export const ACQUISITION_JOURNEY_REQUEST_HEADER = "x-lessenc-acquisition-journey-id";

export const ACQUISITION_OBSERVED_AT_REQUEST_HEADER = "x-lessenc-acquisition-observed-at";

export const PUBLIC_SALES_ACQUISITION_PATH = "/cronograma-capilar-inteligente";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CANONICAL_UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type PublicAcquisitionSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export type AcquisitionJourneyIdResolution = Readonly<{
  journeyId: string;
  created: boolean;
}>;

export function normalizeAcquisitionJourneyId(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();

  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export function resolveAcquisitionJourneyId(
  raw: string | null | undefined,
  createId: () => string,
): AcquisitionJourneyIdResolution {
  const existing = normalizeAcquisitionJourneyId(raw);

  if (existing !== null) {
    return Object.freeze({
      journeyId: existing,
      created: false,
    });
  }

  const created = normalizeAcquisitionJourneyId(createId());

  if (created === null) {
    throw new Error("Acquisition journey ID factory returned an invalid identifier.");
  }

  return Object.freeze({
    journeyId: created,
    created: true,
  });
}

export function acquisitionCookieExpiresAt(observedAt: Date): Date {
  return journeyExpiresAt(observedAt);
}

export function parseAcquisitionObservedAt(raw: string | null | undefined): Date | null {
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString() === raw ? parsed : null;
}

export function isAcquisitionPrefetch(headers: Headers): boolean {
  if (headers.has("next-router-prefetch")) {
    return true;
  }

  if (headers.get("purpose")?.toLowerCase() === "prefetch") {
    return true;
  }

  return headers.get("sec-purpose")?.toLowerCase().includes("prefetch") ?? false;
}

export function toCanonicalUtmSearchParams(input: PublicAcquisitionSearchParams): URLSearchParams {
  const canonical = new URLSearchParams();

  for (const key of CANONICAL_UTM_KEYS) {
    const value = input[key];

    if (typeof value === "string") {
      canonical.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        canonical.append(key, item);
      }
    }
  }

  return canonical;
}
