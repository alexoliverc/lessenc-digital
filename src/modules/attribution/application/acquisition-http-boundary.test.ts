import { describe, expect, it } from "vitest";

import {
  ACQUISITION_JOURNEY_COOKIE_NAME,
  acquisitionCookieExpiresAt,
  isAcquisitionPrefetch,
  normalizeAcquisitionJourneyId,
  parseAcquisitionObservedAt,
  resolveAcquisitionJourneyId,
  toCanonicalUtmSearchParams,
} from "./acquisition-http-boundary";

describe("P13-C acquisition HTTP boundary", () => {
  it("uses the canonical first-party cookie name", () => {
    expect(ACQUISITION_JOURNEY_COOKIE_NAME).toBe("lessenc_acquisition_journey");
  });

  it("accepts and normalizes an opaque UUID journey identifier", () => {
    expect(normalizeAcquisitionJourneyId("550E8400-E29B-41D4-A716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("rejects malformed journey identifiers", () => {
    expect(normalizeAcquisitionJourneyId("not-a-journey-id")).toBeNull();

    expect(normalizeAcquisitionJourneyId("")).toBeNull();

    expect(normalizeAcquisitionJourneyId(null)).toBeNull();
  });

  it("reuses a valid first-party journey identifier", () => {
    const resolved = resolveAcquisitionJourneyId("550e8400-e29b-41d4-a716-446655440000", () => {
      throw new Error("factory must not run");
    });

    expect(resolved).toEqual({
      journeyId: "550e8400-e29b-41d4-a716-446655440000",
      created: false,
    });
  });

  it("creates a journey identifier when the cookie is absent or invalid", () => {
    const resolved = resolveAcquisitionJourneyId(
      "invalid",
      () => "550e8400-e29b-41d4-a716-446655440001",
    );

    expect(resolved).toEqual({
      journeyId: "550e8400-e29b-41d4-a716-446655440001",
      created: true,
    });
  });

  it("uses the same 30-day lifetime as the canonical journey", () => {
    const observedAt = new Date("2026-09-17T12:00:00.000Z");

    expect(acquisitionCookieExpiresAt(observedAt).toISOString()).toBe("2026-10-17T12:00:00.000Z");
  });

  it("accepts only canonical ISO timestamps from the internal boundary", () => {
    expect(parseAcquisitionObservedAt("2026-09-17T12:00:00.000Z")?.toISOString()).toBe(
      "2026-09-17T12:00:00.000Z",
    );

    expect(parseAcquisitionObservedAt("2026-09-17 12:00:00")).toBeNull();

    expect(parseAcquisitionObservedAt("not-a-date")).toBeNull();
  });

  it("detects Next.js and browser prefetch signals", () => {
    expect(
      isAcquisitionPrefetch(
        new Headers({
          "next-router-prefetch": "1",
        }),
      ),
    ).toBe(true);

    expect(
      isAcquisitionPrefetch(
        new Headers({
          purpose: "prefetch",
        }),
      ),
    ).toBe(true);

    expect(
      isAcquisitionPrefetch(
        new Headers({
          "sec-purpose": "prefetch;prerender",
        }),
      ),
    ).toBe(true);

    expect(isAcquisitionPrefetch(new Headers())).toBe(false);
  });

  it("forwards only the five canonical UTM fields", () => {
    const result = toCanonicalUtmSearchParams({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "launch",
      utm_content: "hero",
      utm_term: "hair",
      gclid: "must-not-pass",
      fbclid: "must-not-pass",
      email: "sensitive@example.invalid",
    });

    expect([...result.keys()]).toEqual([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ]);

    expect(result.get("utm_source")).toBe("google");

    expect(result.has("gclid")).toBe(false);
    expect(result.has("fbclid")).toBe(false);
    expect(result.has("email")).toBe(false);
  });

  it("preserves deterministic first-value semantics for repeated UTM values", () => {
    const result = toCanonicalUtmSearchParams({
      utm_source: ["first", "second"],
    });

    expect(result.getAll("utm_source")).toEqual(["first", "second"]);

    expect(result.get("utm_source")).toBe("first");
  });
});
