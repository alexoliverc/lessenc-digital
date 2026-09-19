import type { AnalyticsConsentProjection } from "./consent";

export type GoogleConsentSignal = "granted" | "denied";

export type GoogleConsentModeState = Readonly<{
  analytics_storage: GoogleConsentSignal;
  ad_storage: GoogleConsentSignal;
  ad_user_data: GoogleConsentSignal;
  ad_personalization: GoogleConsentSignal;
}>;

export const GOOGLE_CONSENT_DEFAULT_DENIED: GoogleConsentModeState = Object.freeze({
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
});

function projectSignal(state: "UNKNOWN" | "GRANTED" | "DENIED"): GoogleConsentSignal {
  return state === "GRANTED" ? "granted" : "denied";
}

export function projectGoogleConsentMode(
  consent: Pick<AnalyticsConsentProjection, "analytics" | "advertising">,
): GoogleConsentModeState {
  const analytics = projectSignal(consent.analytics);

  const advertising = projectSignal(consent.advertising);

  return Object.freeze({
    analytics_storage: analytics,
    ad_storage: advertising,
    ad_user_data: advertising,
    ad_personalization: advertising,
  });
}

export function isGoogleTagEligible(
  consent: Pick<AnalyticsConsentProjection, "analytics" | "advertising">,
): boolean {
  return consent.analytics === "GRANTED" || consent.advertising === "GRANTED";
}
