import { describe, expect, it } from "vitest";

import type { GoogleAdsConversionDataLayerEvent } from "@/modules/analytics/application/google-ads-conversion";

import {
  parseCanonicalGoogleAdsConversion,
  pushCanonicalGoogleAdsConversionAfterConsent,
} from "./advertising-conversion-browser";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function conversion(): GoogleAdsConversionDataLayerEvent {
  return {
    event: "lessenc_google_ads_conversion",
    lessenc_event_id: "22222222-2222-4222-8222-222222222222",
    transaction_id: ORDER_ID,
    value: 139.9,
    currency: "BRL",
  };
}

describe("P13-F3 Google Ads browser delivery", () => {
  it("accepts only the canonical server conversion envelope", () => {
    expect(parseCanonicalGoogleAdsConversion(conversion())).toEqual(conversion());
  });

  it("rejects malformed, provider-configured, or PII-extended envelopes", () => {
    expect(parseCanonicalGoogleAdsConversion(null)).toBeNull();

    expect(
      parseCanonicalGoogleAdsConversion({
        ...conversion(),
        event: "purchase",
      }),
    ).toBeNull();

    expect(
      parseCanonicalGoogleAdsConversion({
        ...conversion(),
        transaction_id: "",
      }),
    ).toBeNull();

    expect(
      parseCanonicalGoogleAdsConversion({
        ...conversion(),
        value: Number.NaN,
      }),
    ).toBeNull();

    expect(
      parseCanonicalGoogleAdsConversion({
        ...conversion(),
        currency: "USD",
      }),
    ).toBeNull();

    expect(
      parseCanonicalGoogleAdsConversion({
        ...conversion(),
        email: "buyer@example.invalid",
      }),
    ).toBeNull();

    expect(
      parseCanonicalGoogleAdsConversion({
        ...conversion(),
        send_to: "AW-000000/label",
      }),
    ).toBeNull();
  });

  it("suppresses delivery when analytics consent is not currently granted", () => {
    const dataLayer: unknown[] = [];

    expect(
      pushCanonicalGoogleAdsConversionAfterConsent({
        conversion: conversion(),
        analyticsConsent: "DENIED",
        advertisingConsent: "GRANTED",
        dataLayer,
        deliveredKeys: new Set(),
      }),
    ).toBe("SUPPRESSED_BY_CURRENT_CONSENT");

    expect(dataLayer).toEqual([]);
  });

  it("suppresses delivery when advertising consent is not currently granted", () => {
    const dataLayer: unknown[] = [];

    expect(
      pushCanonicalGoogleAdsConversionAfterConsent({
        conversion: conversion(),
        analyticsConsent: "GRANTED",
        advertisingConsent: "DENIED",
        dataLayer,
        deliveredKeys: new Set(),
      }),
    ).toBe("SUPPRESSED_BY_CURRENT_CONSENT");

    expect(dataLayer).toEqual([]);
  });

  it("pushes exactly the canonical conversion when current consent is fully eligible", () => {
    const dataLayer: unknown[] = [];

    const deliveredKeys = new Set<string>();

    const stored = new Map<string, string>();

    const storage = {
      getItem(key: string) {
        return stored.get(key) ?? null;
      },

      setItem(key: string, value: string) {
        stored.set(key, value);
      },
    };

    expect(
      pushCanonicalGoogleAdsConversionAfterConsent({
        conversion: conversion(),
        analyticsConsent: "GRANTED",
        advertisingConsent: "GRANTED",
        dataLayer,
        deliveredKeys,
        storage,
      }),
    ).toBe("DELIVERED");

    expect(dataLayer).toEqual([conversion()]);

    expect(deliveredKeys.size).toBe(1);

    expect(stored.size).toBe(1);
  });

  it("deduplicates replay within the same page lifetime", () => {
    const dataLayer: unknown[] = [];

    const deliveredKeys = new Set<string>();

    expect(
      pushCanonicalGoogleAdsConversionAfterConsent({
        conversion: conversion(),
        analyticsConsent: "GRANTED",
        advertisingConsent: "GRANTED",
        dataLayer,
        deliveredKeys,
      }),
    ).toBe("DELIVERED");

    expect(
      pushCanonicalGoogleAdsConversionAfterConsent({
        conversion: conversion(),
        analyticsConsent: "GRANTED",
        advertisingConsent: "GRANTED",
        dataLayer,
        deliveredKeys,
      }),
    ).toBe("DUPLICATE");

    expect(dataLayer).toEqual([conversion()]);
  });

  it("deduplicates replay across fresh in-memory state using session storage", () => {
    const dataLayer: unknown[] = [];

    const stored = new Map<string, string>();

    const storage = {
      getItem(key: string) {
        return stored.get(key) ?? null;
      },

      setItem(key: string, value: string) {
        stored.set(key, value);
      },
    };

    expect(
      pushCanonicalGoogleAdsConversionAfterConsent({
        conversion: conversion(),
        analyticsConsent: "GRANTED",
        advertisingConsent: "GRANTED",
        dataLayer,
        deliveredKeys: new Set(),
        storage,
      }),
    ).toBe("DELIVERED");

    expect(
      pushCanonicalGoogleAdsConversionAfterConsent({
        conversion: conversion(),
        analyticsConsent: "GRANTED",
        advertisingConsent: "GRANTED",
        dataLayer,
        deliveredKeys: new Set(),
        storage,
      }),
    ).toBe("DUPLICATE");

    expect(dataLayer).toHaveLength(1);
  });
});
