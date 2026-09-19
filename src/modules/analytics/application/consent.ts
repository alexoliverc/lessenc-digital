import type {
  AcquisitionJourneyRecord,
  AnalyticsConsentState,
  AttributionConsentRepository,
} from "../../attribution/application/persistence";

export const P13_CONSENT_POLICY_VERSION = "p13-architecture-freeze-r2";

export type ExplicitAnalyticsConsentState = Exclude<AnalyticsConsentState, "UNKNOWN">;

export type AnalyticsConsentSelection = Readonly<{
  analytics: ExplicitAnalyticsConsentState;
  advertising: ExplicitAnalyticsConsentState;
}>;

export type AnalyticsConsentProjection = Readonly<{
  analytics: AnalyticsConsentState;
  advertising: AnalyticsConsentState;
  policyVersion: string;
}>;

export function projectAnalyticsConsent(
  journey: AcquisitionJourneyRecord | null,
): AnalyticsConsentProjection {
  return Object.freeze({
    analytics: journey?.analyticsConsentState ?? "UNKNOWN",
    advertising: journey?.advertisingConsentState ?? "UNKNOWN",
    policyVersion: journey?.policyVersion ?? P13_CONSENT_POLICY_VERSION,
  });
}

export class UpdateAnalyticsConsent {
  constructor(private readonly repository: AttributionConsentRepository) {}

  async execute(input: {
    journeyId: string;
    selection: AnalyticsConsentSelection;
    observedAt: Date;
  }): Promise<AnalyticsConsentProjection | null> {
    const journey = await this.repository.updateConsent({
      journeyId: input.journeyId,
      analyticsConsentState: input.selection.analytics,
      advertisingConsentState: input.selection.advertising,
      policyVersion: P13_CONSENT_POLICY_VERSION,
      observedAt: input.observedAt,
    });

    return journey === null ? null : projectAnalyticsConsent(journey);
  }
}
