import { describe, expect, it } from "vitest";

import {
  ATTRIBUTION_LOOKBACK_DAYS,
  classifyAcquisition,
  extractCanonicalUtm,
  hasCanonicalUtm,
  isJourneyActive,
  isWithinAttributionLookback,
  journeyExpiresAt,
  nextFirstTouchId,
  nextLastTouchId,
  sanitizeExternalReferrerHost,
  sanitizeLandingPath,
} from "./acquisition-policy";

describe("P13-C acquisition policy", () => {
  describe("UTM normalization", () => {
    it("accepts only the canonical UTM allowlist", () => {
      const search = new URLSearchParams({
        utm_source: " google ",
        utm_medium: " cpc ",
        utm_campaign: "launch",
        utm_content: "hero",
        utm_term: "hair care",
        arbitrary: "must-not-survive",
        gclid: "provider-specific-id",
        fbclid: "provider-specific-id",
      });

      expect(extractCanonicalUtm(search)).toEqual({
        source: "google",
        medium: "cpc",
        campaign: "launch",
        content: "hero",
        term: "hair care",
      });
    });

    it("normalizes empty values to null", () => {
      const search = new URLSearchParams({
        utm_source: "   ",
        utm_medium: "",
      });

      expect(extractCanonicalUtm(search)).toEqual({
        source: null,
        medium: null,
        campaign: null,
        content: null,
        term: null,
      });
    });

    it("bounds persisted UTM values to schema lengths", () => {
      const search = new URLSearchParams({
        utm_source: "s".repeat(200),
        utm_medium: "m".repeat(200),
        utm_campaign: "c".repeat(300),
        utm_content: "x".repeat(300),
        utm_term: "t".repeat(300),
      });

      const result = extractCanonicalUtm(search);

      expect(result.source).toHaveLength(96);
      expect(result.medium).toHaveLength(96);
      expect(result.campaign).toHaveLength(191);
      expect(result.content).toHaveLength(191);
      expect(result.term).toHaveLength(191);
    });

    it("detects whether canonical UTM context exists", () => {
      expect(
        hasCanonicalUtm(
          extractCanonicalUtm(
            new URLSearchParams({
              utm_campaign: "launch",
            }),
          ),
        ),
      ).toBe(true);

      expect(hasCanonicalUtm(extractCanonicalUtm(new URLSearchParams()))).toBe(false);
    });
  });

  describe("landing path sanitation", () => {
    it("removes query parameters and fragments from a relative landing URL", () => {
      expect(sanitizeLandingPath("/cronograma?utm_source=google&secret=x#buy")).toBe("/cronograma");
    });

    it("stores only the path from an absolute landing URL", () => {
      expect(
        sanitizeLandingPath(
          "https://lessenc.example/cronograma-capilar-inteligente?utm_campaign=launch",
        ),
      ).toBe("/cronograma-capilar-inteligente");
    });

    it("returns null for unsupported URL schemes", () => {
      expect(sanitizeLandingPath("javascript:alert(1)")).toBeNull();
    });

    it("handles missing landing data safely", () => {
      expect(sanitizeLandingPath(null)).toBeNull();
      expect(sanitizeLandingPath(undefined)).toBeNull();
      expect(sanitizeLandingPath("")).toBeNull();
    });
  });

  describe("external referrer sanitation", () => {
    const appUrl = "https://lessenc.example";

    it("stores only a sanitized external hostname", () => {
      expect(
        sanitizeExternalReferrerHost(
          "https://WWW.EXAMPLE.COM/article?token=secret#fragment",
          appUrl,
        ),
      ).toBe("www.example.com");
    });

    it("does not classify same-origin navigation as external referral", () => {
      expect(
        sanitizeExternalReferrerHost("https://lessenc.example/cronograma?internal=value", appUrl),
      ).toBeNull();
    });

    it("rejects malformed or unsupported referrers", () => {
      expect(sanitizeExternalReferrerHost("not a url", appUrl)).toBeNull();
      expect(sanitizeExternalReferrerHost("javascript:alert(1)", appUrl)).toBeNull();
      expect(sanitizeExternalReferrerHost(null, appUrl)).toBeNull();
    });
  });

  describe("acquisition classification", () => {
    it("prioritizes canonical campaign context over referral", () => {
      const utm = extractCanonicalUtm(
        new URLSearchParams({
          utm_source: "google",
        }),
      );

      expect(classifyAcquisition(utm, "example.com")).toEqual({
        touchType: "CAMPAIGN",
        externallyAttributable: true,
      });
    });

    it("classifies external referrer as REFERRAL when no UTM exists", () => {
      expect(
        classifyAcquisition(extractCanonicalUtm(new URLSearchParams()), "example.com"),
      ).toEqual({
        touchType: "REFERRAL",
        externallyAttributable: true,
      });
    });

    it("classifies absence of external acquisition context as DIRECT", () => {
      expect(classifyAcquisition(extractCanonicalUtm(new URLSearchParams()), null)).toEqual({
        touchType: "DIRECT",
        externallyAttributable: false,
      });
    });
  });

  describe("30-day policy", () => {
    const startedAt = new Date("2026-09-16T12:00:00.000Z");

    it("creates an exact 30-day journey lifetime", () => {
      expect(journeyExpiresAt(startedAt).toISOString()).toBe("2026-10-16T12:00:00.000Z");
    });

    it("keeps a journey active strictly before expiry", () => {
      const expiresAt = journeyExpiresAt(startedAt);

      expect(isJourneyActive(expiresAt, new Date("2026-10-16T11:59:59.999Z"))).toBe(true);
    });

    it("expires a journey at the exact expiry instant", () => {
      const expiresAt = journeyExpiresAt(startedAt);

      expect(isJourneyActive(expiresAt, expiresAt)).toBe(false);
    });

    it("accepts attribution exactly at the 30-day lookback boundary", () => {
      const conversionAt = new Date(
        startedAt.getTime() + ATTRIBUTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      );

      expect(isWithinAttributionLookback(startedAt, conversionAt)).toBe(true);
    });

    it("rejects attribution older than 30 days", () => {
      const conversionAt = new Date(
        startedAt.getTime() + ATTRIBUTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000 + 1,
      );

      expect(isWithinAttributionLookback(startedAt, conversionAt)).toBe(false);
    });

    it("rejects a touch occurring after conversion", () => {
      expect(
        isWithinAttributionLookback(
          new Date("2026-09-17T00:00:00.000Z"),
          new Date("2026-09-16T00:00:00.000Z"),
        ),
      ).toBe(false);
    });
  });

  describe("First Touch and Last Touch pointer policy", () => {
    it("establishes First Touch from the first eligible external interaction", () => {
      expect(nextFirstTouchId(null, "touch-a", true)).toBe("touch-a");
    });

    it("never overwrites an existing First Touch", () => {
      expect(nextFirstTouchId("touch-a", "touch-b", true)).toBe("touch-a");
    });

    it("does not establish First Touch from DIRECT traffic", () => {
      expect(nextFirstTouchId(null, "direct-touch", false)).toBeNull();
    });

    it("updates Last Touch for a later eligible external interaction", () => {
      expect(nextLastTouchId("touch-a", "touch-b", true)).toBe("touch-b");
    });

    it("does not erase an existing Last Touch on DIRECT or internal navigation", () => {
      expect(nextLastTouchId("touch-a", "direct-touch", false)).toBe("touch-a");
    });

    it("keeps Last Touch null when no eligible external touch exists", () => {
      expect(nextLastTouchId(null, "direct-touch", false)).toBeNull();
    });
  });
});
