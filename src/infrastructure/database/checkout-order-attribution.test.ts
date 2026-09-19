import type { Prisma } from "../../generated/prisma/client";
import { describe, expect, it } from "vitest";

import { createOrderAttributionInTransaction } from "./checkout-order-attribution";

const capturedAt = new Date("2026-09-17T12:00:00.000Z");

function fakeTransaction(
  options: Readonly<{
    journey?: null | {
      id: string;
      createdAt: Date;
      lastSeenAt: Date;
      expiresAt: Date;
      firstTouchId: string | null;
      lastTouchId: string | null;
      analyticsConsentState: string;
      advertisingConsentState: string;
      policyVersion: string;
    };
    touches?: Readonly<
      Record<
        string,
        {
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
        }
      >
    >;
  }> = {},
) {
  const calls: string[] = [];
  let persisted: Readonly<Record<string, unknown>> | null = null;

  const transaction = {
    $queryRaw: async () => {
      calls.push("lock");
      return [];
    },

    acquisitionJourney: {
      findUnique: async () => {
        calls.push("journey");

        return options.journey ?? null;
      },
    },

    attributionTouch: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        calls.push(`touch:${where.id}`);

        return options.touches?.[where.id] ?? null;
      },
    },

    orderAttribution: {
      create: async ({ data }: { data: Readonly<Record<string, unknown>> }) => {
        calls.push("snapshot");
        persisted = data;

        return data;
      },
    },
  } as unknown as Prisma.TransactionClient;

  return {
    transaction,
    calls,
    get persisted() {
      return persisted;
    },
  };
}

describe("P13-C transactional OrderAttribution adapter", () => {
  it("creates an explicit unattributed snapshot without touching Journey state when no Journey ID exists", async () => {
    const fixture = fakeTransaction();

    const snapshot = await createOrderAttributionInTransaction(fixture.transaction, {
      snapshotId: "snapshot-unattributed",
      orderId: "order-a",
      journeyId: null,
      capturedAt,
    });

    expect(fixture.calls).toEqual(["snapshot"]);

    expect(snapshot).toEqual({
      id: "snapshot-unattributed",
      orderId: "order-a",
      journeyId: null,
      firstTouchId: null,
      lastTouchId: null,
      firstSource: null,
      firstMedium: null,
      firstCampaign: null,
      firstContent: null,
      firstTerm: null,
      lastSource: null,
      lastMedium: null,
      lastCampaign: null,
      lastContent: null,
      lastTerm: null,
      capturedAt,
    });

    expect(fixture.persisted).toEqual(snapshot);
  });

  it("locks the Journey before reading First/Last Touch and persists the resulting immutable snapshot", async () => {
    const firstId = "touch-first";
    const lastId = "touch-last";

    const fixture = fakeTransaction({
      journey: {
        id: "journey-a",
        createdAt: new Date(capturedAt.getTime() - 86_400_000),
        lastSeenAt: new Date(capturedAt.getTime() - 1_000),
        expiresAt: new Date(capturedAt.getTime() + 86_400_000),
        firstTouchId: firstId,
        lastTouchId: lastId,
        analyticsConsentState: "UNKNOWN",
        advertisingConsentState: "UNKNOWN",
        policyVersion: "p13-architecture-freeze-r2",
      },

      touches: {
        [firstId]: {
          id: firstId,
          journeyId: "journey-a",
          occurredAt: new Date(capturedAt.getTime() - 60_000),
          source: "google",
          medium: "cpc",
          campaign: "launch",
          content: "hero",
          term: "cronograma",
          referrerHost: null,
          landingPath: "/cronograma-capilar-inteligente",
          touchType: "CAMPAIGN",
        },

        [lastId]: {
          id: lastId,
          journeyId: "journey-a",
          occurredAt: new Date(capturedAt.getTime() - 1_000),
          source: "referral.example",
          medium: "referral",
          campaign: null,
          content: null,
          term: null,
          referrerHost: "referral.example",
          landingPath: "/cronograma-capilar-inteligente",
          touchType: "REFERRAL",
        },
      },
    });

    const snapshot = await createOrderAttributionInTransaction(fixture.transaction, {
      snapshotId: "snapshot-attributed",
      orderId: "order-a",
      journeyId: "journey-a",
      capturedAt,
    });

    expect(fixture.calls).toEqual([
      "lock",
      "journey",
      `touch:${firstId}`,
      `touch:${lastId}`,
      "snapshot",
    ]);

    expect(snapshot).toMatchObject({
      id: "snapshot-attributed",
      orderId: "order-a",
      journeyId: "journey-a",

      firstTouchId: firstId,
      firstSource: "google",
      firstMedium: "cpc",
      firstCampaign: "launch",

      lastTouchId: lastId,
      lastSource: "referral.example",
      lastMedium: "referral",
    });

    expect(fixture.persisted).toEqual(snapshot);
  });

  it("creates an unattributed snapshot if the supplied first-party Journey no longer exists", async () => {
    const fixture = fakeTransaction({
      journey: null,
    });

    const snapshot = await createOrderAttributionInTransaction(fixture.transaction, {
      snapshotId: "snapshot-missing-journey",
      orderId: "order-a",
      journeyId: "journey-missing",
      capturedAt,
    });

    expect(fixture.calls).toEqual(["lock", "journey", "snapshot"]);

    expect(snapshot).toMatchObject({
      journeyId: null,
      firstTouchId: null,
      lastTouchId: null,
      firstSource: null,
      lastSource: null,
    });
  });
});
