import {
  classifyAcquisition,
  extractCanonicalUtm,
  isJourneyActive,
  journeyExpiresAt,
  sanitizeExternalReferrerHost,
  sanitizeLandingPath,
} from "./acquisition-policy";
import type {
  AcquisitionJourneyRecord,
  AttributionJourneyCaptureRepository,
  AttributionTouchRecord,
  CreateAttributionTouch,
} from "./persistence";

export const P13_ATTRIBUTION_POLICY_VERSION = "p13-architecture-freeze-r2";

export type AcquisitionIdFactory = () => string;

export type CaptureAcquisitionInput = Readonly<{
  journeyId: string | null;
  occurredAt: Date;
  searchParams: URLSearchParams;
  landingUrl: string | null;
  referrer: string | null;
  canonicalAppUrl: string;
}>;

export type CaptureAcquisitionResult = Readonly<{
  journey: AcquisitionJourneyRecord;
  touch: AttributionTouchRecord | null;
  journeyCreated: boolean;
}>;

export class CaptureAcquisitionJourney {
  constructor(
    private readonly repository: AttributionJourneyCaptureRepository,
    private readonly createId: AcquisitionIdFactory,
  ) {}

  async execute(input: CaptureAcquisitionInput): Promise<CaptureAcquisitionResult> {
    let journey: AcquisitionJourneyRecord | null = null;
    let journeyCreated = false;
    let journeyIdForCreation: string | null = null;

    if (input.journeyId !== null) {
      const recovered = await this.repository.findJourney(input.journeyId);

      if (recovered !== null && isJourneyActive(recovered.expiresAt, input.occurredAt)) {
        journey = recovered;
      } else if (recovered === null) {
        /*
         * A first-party boundary may have already issued this
         * opaque identifier before persistence runs. Reuse it
         * so browser and persistence state cannot diverge.
         */
        journeyIdForCreation = input.journeyId;
      }
    }

    if (journey === null) {
      journey = await this.repository.createJourney({
        id: journeyIdForCreation ?? this.createId(),
        expiresAt: journeyExpiresAt(input.occurredAt),
        analyticsConsentState: "UNKNOWN",
        advertisingConsentState: "UNKNOWN",
        policyVersion: P13_ATTRIBUTION_POLICY_VERSION,
      });

      journeyCreated = true;
    }

    if (journey === null) {
      throw new Error("Acquisition journey could not be established.");
    }

    const activeJourney = journey;
    const utm = extractCanonicalUtm(input.searchParams);

    const externalReferrerHost = sanitizeExternalReferrerHost(
      input.referrer,
      input.canonicalAppUrl,
    );

    const classification = classifyAcquisition(utm, externalReferrerHost);

    const referralSource = classification.touchType === "REFERRAL" ? externalReferrerHost : null;

    /*
     * AttributionTouch is an acquisition record, not a
     * generic page-view record.
     *
     * - externally attributable interactions always create
     *   a touch;
     * - the first DIRECT acquisition may create a DIRECT
     *   touch to preserve its acquisition classification;
     * - subsequent DIRECT/internal observations only refresh
     *   Journey.lastSeenAt.
     */
    const shouldRecordTouch = classification.externallyAttributable || journeyCreated;

    const touch: CreateAttributionTouch | null = shouldRecordTouch
      ? {
          id: this.createId(),
          journeyId: activeJourney.id,
          occurredAt: input.occurredAt,
          source: classification.touchType === "CAMPAIGN" ? utm.source : referralSource,
          medium:
            classification.touchType === "CAMPAIGN"
              ? utm.medium
              : classification.touchType === "REFERRAL"
                ? "referral"
                : null,
          campaign: classification.touchType === "CAMPAIGN" ? utm.campaign : null,
          content: classification.touchType === "CAMPAIGN" ? utm.content : null,
          term: classification.touchType === "CAMPAIGN" ? utm.term : null,
          referrerHost: externalReferrerHost,
          landingPath: sanitizeLandingPath(input.landingUrl),
          touchType: classification.touchType,
        }
      : null;

    const recorded = await this.repository.recordObservation({
      journeyId: activeJourney.id,
      touch,
      seenAt: input.occurredAt,
      externallyAttributable: classification.externallyAttributable,
    });

    return Object.freeze({
      journey: recorded.journey,
      touch: recorded.touch,
      journeyCreated,
    });
  }
}
