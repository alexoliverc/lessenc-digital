import { describe, expect, it } from "vitest";

import {
  GOOGLE_CONSENT_DEFAULT_DENIED,
  isGoogleTagEligible,
  projectGoogleConsentMode,
} from "./google-consent-mode";

describe("P13-F1 Google Consent Mode projection", () => {
  it("defaults all Google consent signals to denied", () => {
    expect(GOOGLE_CONSENT_DEFAULT_DENIED).toEqual({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  it("never promotes UNKNOWN to granted", () => {
    expect(
      projectGoogleConsentMode({
        analytics: "UNKNOWN",
        advertising: "UNKNOWN",
      }),
    ).toEqual({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    expect(
      isGoogleTagEligible({
        analytics: "UNKNOWN",
        advertising: "UNKNOWN",
      }),
    ).toBe(false);
  });

  it("projects analytics consent independently from advertising consent", () => {
    expect(
      projectGoogleConsentMode({
        analytics: "GRANTED",
        advertising: "DENIED",
      }),
    ).toEqual({
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    expect(
      isGoogleTagEligible({
        analytics: "GRANTED",
        advertising: "DENIED",
      }),
    ).toBe(true);
  });

  it("projects advertising consent to all three Google advertising signals", () => {
    expect(
      projectGoogleConsentMode({
        analytics: "GRANTED",
        advertising: "GRANTED",
      }),
    ).toEqual({
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
  });

  it("keeps explicit denial denied", () => {
    expect(
      projectGoogleConsentMode({
        analytics: "DENIED",
        advertising: "DENIED",
      }),
    ).toEqual({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    expect(
      isGoogleTagEligible({
        analytics: "DENIED",
        advertising: "DENIED",
      }),
    ).toBe(false);
  });

  it("does not invent a dependency between provider signals", () => {
    expect(
      projectGoogleConsentMode({
        analytics: "DENIED",
        advertising: "GRANTED",
      }),
    ).toEqual({
      analytics_storage: "denied",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
  });
});
