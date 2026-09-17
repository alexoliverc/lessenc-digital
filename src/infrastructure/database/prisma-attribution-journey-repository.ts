import type { PrismaClient } from "../../generated/prisma/client";
import type {
  AcquisitionJourneyRecord,
  AttributionJourneyRepository,
  AttributionTouchRecord,
  CreateAcquisitionJourney,
  CreateAttributionTouch,
} from "../../modules/attribution/application/persistence";

export class PrismaAttributionJourneyRepository implements AttributionJourneyRepository {
  constructor(private readonly db: PrismaClient) {}

  async createJourney(input: CreateAcquisitionJourney): Promise<AcquisitionJourneyRecord> {
    const row = await this.db.acquisitionJourney.create({
      data: {
        id: input.id,
        expiresAt: input.expiresAt,
        analyticsConsentState: input.analyticsConsentState,
        advertisingConsentState: input.advertisingConsentState,
        policyVersion: input.policyVersion,
      },
    });

    return Object.freeze({
      id: row.id,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      expiresAt: row.expiresAt,
      firstTouchId: row.firstTouchId,
      lastTouchId: row.lastTouchId,
      analyticsConsentState: row.analyticsConsentState,
      advertisingConsentState: row.advertisingConsentState,
      policyVersion: row.policyVersion,
    });
  }

  async findJourney(journeyId: string): Promise<AcquisitionJourneyRecord | null> {
    const row = await this.db.acquisitionJourney.findUnique({
      where: {
        id: journeyId,
      },
    });

    if (!row) {
      return null;
    }

    return Object.freeze({
      id: row.id,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      expiresAt: row.expiresAt,
      firstTouchId: row.firstTouchId,
      lastTouchId: row.lastTouchId,
      analyticsConsentState: row.analyticsConsentState,
      advertisingConsentState: row.advertisingConsentState,
      policyVersion: row.policyVersion,
    });
  }

  async createTouch(input: CreateAttributionTouch): Promise<AttributionTouchRecord> {
    const row = await this.db.attributionTouch.create({
      data: {
        id: input.id,
        journeyId: input.journeyId,
        occurredAt: input.occurredAt,
        source: input.source,
        medium: input.medium,
        campaign: input.campaign,
        content: input.content,
        term: input.term,
        referrerHost: input.referrerHost,
        landingPath: input.landingPath,
        touchType: input.touchType,
      },
    });

    return Object.freeze({
      id: row.id,
      journeyId: row.journeyId,
      occurredAt: row.occurredAt,
      source: row.source,
      medium: row.medium,
      campaign: row.campaign,
      content: row.content,
      term: row.term,
      referrerHost: row.referrerHost,
      landingPath: row.landingPath,
      touchType: row.touchType,
    });
  }
}
