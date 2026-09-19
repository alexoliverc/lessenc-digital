import { describe, expect, it } from "vitest";

import type {
  AcquisitionJourneyRecord,
  AttributionConsentRepository,
  UpdateAcquisitionConsent,
} from "../../attribution/application/persistence";
import {
  P13_CONSENT_POLICY_VERSION,
  UpdateAnalyticsConsent,
  projectAnalyticsConsent,
} from "./consent";

function journey(overrides: Partial<AcquisitionJourneyRecord> = {}): AcquisitionJourneyRecord {
  return Object.freeze({
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: new Date("2026-09-19T12:00:00.000Z"),
    lastSeenAt: new Date("2026-09-19T12:00:00.000Z"),
    expiresAt: new Date("2026-10-19T12:00:00.000Z"),
    firstTouchId: null,
    lastTouchId: null,
    analyticsConsentState: "UNKNOWN",
    advertisingConsentState: "UNKNOWN",
    policyVersion: P13_CONSENT_POLICY_VERSION,
    ...overrides,
  });
}

class RecordingConsentRepository implements AttributionConsentRepository {
  readonly inputs: UpdateAcquisitionConsent[] = [];

  constructor(private readonly result: AcquisitionJourneyRecord | null) {}

  async updateConsent(input: UpdateAcquisitionConsent): Promise<AcquisitionJourneyRecord | null> {
    this.inputs.push(input);

    return this.result;
  }
}

describe("P13-D analytics consent", () => {
  it("projects explicit UNKNOWN without a Journey", () => {
    expect(projectAnalyticsConsent(null)).toEqual({
      analytics: "UNKNOWN",
      advertising: "UNKNOWN",
      policyVersion: P13_CONSENT_POLICY_VERSION,
    });
  });

  it("persists an explicit, reversible consent selection with the canonical policy", async () => {
    const observedAt = new Date("2026-09-19T12:05:00.000Z");
    const repository = new RecordingConsentRepository(
      journey({
        analyticsConsentState: "GRANTED",
        advertisingConsentState: "DENIED",
        lastSeenAt: observedAt,
      }),
    );
    const update = new UpdateAnalyticsConsent(repository);

    await expect(
      update.execute({
        journeyId: "11111111-1111-4111-8111-111111111111",
        selection: {
          analytics: "GRANTED",
          advertising: "DENIED",
        },
        observedAt,
      }),
    ).resolves.toEqual({
      analytics: "GRANTED",
      advertising: "DENIED",
      policyVersion: P13_CONSENT_POLICY_VERSION,
    });

    expect(repository.inputs).toEqual([
      {
        journeyId: "11111111-1111-4111-8111-111111111111",
        analyticsConsentState: "GRANTED",
        advertisingConsentState: "DENIED",
        policyVersion: P13_CONSENT_POLICY_VERSION,
        observedAt,
      },
    ]);
  });

  it("does not invent consent when the Journey is unavailable", async () => {
    const update = new UpdateAnalyticsConsent(new RecordingConsentRepository(null));

    await expect(
      update.execute({
        journeyId: "11111111-1111-4111-8111-111111111111",
        selection: {
          analytics: "DENIED",
          advertising: "DENIED",
        },
        observedAt: new Date("2026-09-19T12:05:00.000Z"),
      }),
    ).resolves.toBeNull();
  });
});
