import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type {
  AcquisitionJourneyRecord,
  AttributionJourneyCaptureRepository,
  AttributionTouchRecord,
  CreateAcquisitionJourney,
  CreateAttributionTouch,
  RecordAttributionObservation,
  RecordAttributionObservationResult,
} from "../../modules/attribution/application/persistence";

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toJourneyRecord(
  row: Readonly<{
    id: string;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
    firstTouchId: string | null;
    lastTouchId: string | null;
    analyticsConsentState: AcquisitionJourneyRecord["analyticsConsentState"];
    advertisingConsentState: AcquisitionJourneyRecord["advertisingConsentState"];
    policyVersion: string;
  }>,
): AcquisitionJourneyRecord {
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

function toTouchRecord(
  row: Readonly<{
    id: string;
    journeyId: string;
    occurredAt: Date;
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
    referrerHost: string | null;
    landingPath: string | null;
    touchType: AttributionTouchRecord["touchType"];
  }>,
): AttributionTouchRecord {
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

function touchCreateData(input: CreateAttributionTouch) {
  return {
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
  };
}

export class PrismaAttributionJourneyRepository implements AttributionJourneyCaptureRepository {
  constructor(private readonly db: PrismaClient) {}

  async createJourney(input: CreateAcquisitionJourney): Promise<AcquisitionJourneyRecord> {
    try {
      const row = await this.db.acquisitionJourney.create({
        data: {
          id: input.id,
          expiresAt: input.expiresAt,
          analyticsConsentState: input.analyticsConsentState,
          advertisingConsentState: input.advertisingConsentState,
          policyVersion: input.policyVersion,
        },
      });

      return toJourneyRecord(row);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.db.acquisitionJourney.findUnique({
        where: {
          id: input.id,
        },
      });

      if (!existing) {
        throw error;
      }

      return toJourneyRecord(existing);
    }
  }

  async findJourney(journeyId: string): Promise<AcquisitionJourneyRecord | null> {
    const row = await this.db.acquisitionJourney.findUnique({
      where: {
        id: journeyId,
      },
    });

    return row ? toJourneyRecord(row) : null;
  }

  async createTouch(input: CreateAttributionTouch): Promise<AttributionTouchRecord> {
    const row = await this.db.attributionTouch.create({
      data: touchCreateData(input),
    });

    return toTouchRecord(row);
  }

  async recordObservation(
    input: RecordAttributionObservation,
  ): Promise<RecordAttributionObservationResult> {
    if (input.touch !== null && input.touch.journeyId !== input.journeyId) {
      throw new Error("Attribution touch does not belong to the target journey.");
    }

    if (input.externallyAttributable && input.touch === null) {
      throw new Error("Externally attributable observation requires a touch.");
    }

    return this.db.$transaction(async (transaction) => {
      const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
            SELECT id
            FROM acquisition_journeys
            WHERE id = ${input.journeyId}
            FOR UPDATE
          `,
      );

      if (lockedRows.length !== 1) {
        throw new Error("Acquisition journey not found.");
      }

      const current = await transaction.acquisitionJourney.findUnique({
        where: {
          id: input.journeyId,
        },
      });

      if (!current) {
        throw new Error("Acquisition journey disappeared after lock.");
      }

      const touchRow =
        input.touch === null
          ? null
          : await transaction.attributionTouch.create({
              data: touchCreateData(input.touch),
            });

      let firstTouchId = current.firstTouchId;
      let lastTouchId = current.lastTouchId;

      if (input.externallyAttributable && touchRow !== null) {
        if (firstTouchId === null) {
          firstTouchId = touchRow.id;
        }

        let shouldAdvanceLastTouch = true;

        if (current.lastTouchId !== null) {
          const currentLastTouch = await transaction.attributionTouch.findUnique({
            where: {
              id: current.lastTouchId,
            },
            select: {
              occurredAt: true,
            },
          });

          if (
            currentLastTouch &&
            currentLastTouch.occurredAt.getTime() > touchRow.occurredAt.getTime()
          ) {
            shouldAdvanceLastTouch = false;
          }
        }

        if (shouldAdvanceLastTouch) {
          lastTouchId = touchRow.id;
        }
      }

      const lastSeenAt =
        current.lastSeenAt.getTime() >= input.seenAt.getTime() ? current.lastSeenAt : input.seenAt;

      const journeyRow = await transaction.acquisitionJourney.update({
        where: {
          id: current.id,
        },
        data: {
          lastSeenAt,
          firstTouchId,
          lastTouchId,
        },
      });

      return Object.freeze({
        journey: toJourneyRecord(journeyRow),
        touch: touchRow === null ? null : toTouchRecord(touchRow),
      });
    });
  }
}
