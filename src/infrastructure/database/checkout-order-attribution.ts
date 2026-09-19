import type { Prisma } from "../../generated/prisma/client";
import { buildOrderAttributionSnapshot } from "../../modules/attribution/application/order-attribution";
import type {
  AcquisitionJourneyRecord,
  AttributionTouchRecord,
  CreateOrderAttributionSnapshot,
} from "../../modules/attribution/application/persistence";

type Tx = Prisma.TransactionClient;

export type CheckoutOrderAttributionContext = Readonly<{
  journeyId: string | null;
}>;

export type CreateTransactionalOrderAttributionInput = Readonly<{
  snapshotId: string;
  orderId: string;
  journeyId: string | null;
  capturedAt: Date;
}>;

function toJourneyRecord(
  row: Readonly<{
    id: string;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
    firstTouchId: string | null;
    lastTouchId: string | null;
    analyticsConsentState: string;
    advertisingConsentState: string;
    policyVersion: string;
  }>,
): AcquisitionJourneyRecord {
  if (
    !["UNKNOWN", "GRANTED", "DENIED"].includes(row.analyticsConsentState) ||
    !["UNKNOWN", "GRANTED", "DENIED"].includes(row.advertisingConsentState)
  ) {
    throw new Error("Invalid persisted acquisition consent state.");
  }

  return Object.freeze({
    id: row.id,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
    firstTouchId: row.firstTouchId,
    lastTouchId: row.lastTouchId,
    analyticsConsentState:
      row.analyticsConsentState as AcquisitionJourneyRecord["analyticsConsentState"],
    advertisingConsentState:
      row.advertisingConsentState as AcquisitionJourneyRecord["advertisingConsentState"],
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
    touchType: string;
  }>,
): AttributionTouchRecord {
  if (!["CAMPAIGN", "REFERRAL", "DIRECT"].includes(row.touchType)) {
    throw new Error("Invalid persisted attribution touch type.");
  }

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
    touchType: row.touchType as AttributionTouchRecord["touchType"],
  });
}

async function loadTouch(
  transaction: Tx,
  touchId: string | null,
): Promise<AttributionTouchRecord | null> {
  if (touchId === null) {
    return null;
  }

  const row = await transaction.attributionTouch.findUnique({
    where: {
      id: touchId,
    },
  });

  return row === null ? null : toTouchRecord(row);
}

export async function createOrderAttributionInTransaction(
  transaction: Tx,
  input: CreateTransactionalOrderAttributionInput,
): Promise<CreateOrderAttributionSnapshot> {
  /*
   * recordObservation() also locks acquisition_journeys.
   *
   * Sharing the same row lock means Order conversion observes
   * a serialized First/Last Touch state instead of racing an
   * acquisition update.
   */
  if (input.journeyId !== null) {
    await transaction.$queryRaw`
      SELECT id
      FROM acquisition_journeys
      WHERE id = ${input.journeyId}
      FOR UPDATE
    `;
  }

  const journeyRow =
    input.journeyId === null
      ? null
      : await transaction.acquisitionJourney.findUnique({
          where: {
            id: input.journeyId,
          },
        });

  const journey = journeyRow === null ? null : toJourneyRecord(journeyRow);

  const firstTouch = journey === null ? null : await loadTouch(transaction, journey.firstTouchId);

  const lastTouch =
    journey === null
      ? null
      : journey.lastTouchId === journey.firstTouchId
        ? firstTouch
        : await loadTouch(transaction, journey.lastTouchId);

  const snapshot = buildOrderAttributionSnapshot({
    id: input.snapshotId,
    orderId: input.orderId,
    journeyId: input.journeyId,
    capturedAt: input.capturedAt,
    journey,
    firstTouch,
    lastTouch,
  });

  await transaction.orderAttribution.create({
    data: {
      id: snapshot.id,
      orderId: snapshot.orderId,
      journeyId: snapshot.journeyId,
      firstTouchId: snapshot.firstTouchId,
      lastTouchId: snapshot.lastTouchId,
      firstSource: snapshot.firstSource,
      firstMedium: snapshot.firstMedium,
      firstCampaign: snapshot.firstCampaign,
      firstContent: snapshot.firstContent,
      firstTerm: snapshot.firstTerm,
      lastSource: snapshot.lastSource,
      lastMedium: snapshot.lastMedium,
      lastCampaign: snapshot.lastCampaign,
      lastContent: snapshot.lastContent,
      lastTerm: snapshot.lastTerm,
      capturedAt: snapshot.capturedAt,
    },
  });

  return snapshot;
}
