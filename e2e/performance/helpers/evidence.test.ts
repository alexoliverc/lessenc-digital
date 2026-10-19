import { describe, expect, it } from "vitest";

import { PERFORMANCE_NETWORK_PROFILE } from "./network-profile";
import {
  createCohortSummary,
  serializeAttemptEvidence,
  serializeCohortSummary,
  type AttemptEvidence,
} from "./evidence";

function attempt(overrides: Partial<AttemptEvidence> = {}): AttemptEvidence {
  return {
    schemaVersion: 1,
    runId: "p17-perf-evidence-unit-test",
    indicator: "PR01",
    viewport: "mobile",
    attempt: 1,
    state: "VALID",
    milestones: { metricValueMs: 100 },
    browser: {
      engine: "chromium",
      version: "153.0.0",
      playwrightVersion: "1.63.0",
    },
    network: PERFORMANCE_NETWORK_PROFILE,
    calibration: {
      downloadBitsPerSecond: 10_000_000,
      uploadBitsPerSecond: 2_000_000,
      roundTripTimeMs: 80,
    },
    commit: "7f28c6f6bfcea034571e94e0306ff242a26e12fd",
    isolation: {
      configuration: "VALIDATED",
      capsule: "OPERATIONALLY_PROVEN",
      browserEgress: "BLOCKED_BY_CAPSULE",
      nodeEgress: "BLOCKED_BY_CAPSULE",
    },
    ...overrides,
  };
}

describe("P17 performance evidence", () => {
  it("serializes one sanitized JSONL record", () => {
    const line = serializeAttemptEvidence(attempt());

    expect(line.endsWith("\n")).toBe(true);
    expect(JSON.parse(line)).toMatchObject({
      indicator: "PR01",
      state: "VALID",
      viewport: "mobile",
    });
  });

  it("rejects a sensitive field even when passed around static typing", () => {
    const unsafe = {
      ...attempt(),
      cookie: "must-never-be-persisted",
    } as unknown as AttemptEvidence;

    expect(() => serializeAttemptEvidence(unsafe)).toThrow(
      "P17_EVIDENCE_SENSITIVE_FIELD_FORBIDDEN",
    );
  });

  it("rejects an unrecognized field that could carry personal data", () => {
    const unsafe = {
      ...attempt(),
      email: "person@example.invalid",
    } as unknown as AttemptEvidence;

    expect(() => serializeAttemptEvidence(unsafe)).toThrow("P17_EVIDENCE_FIELD_NOT_ALLOWED");
  });

  it("rejects a valid sample backed only by static isolation", () => {
    expect(() =>
      serializeAttemptEvidence(
        attempt({
          isolation: {
            configuration: "VALIDATED",
            capsule: "STATIC_ONLY",
            browserEgress: "NOT_PROVEN",
            nodeEgress: "NOT_PROVEN",
          },
        }),
      ),
    ).toThrow("P17_EVIDENCE_VALID_ATTEMPT_NOT_ISOLATED");
  });

  it("does not calculate percentiles before forty valid samples", () => {
    const summary = createCohortSummary([attempt()]);

    expect(summary.evaluation).toBe("INCONCLUSIVE");
    expect(summary.percentiles).toBeNull();
  });

  it("calculates a summary only from forty valid samples and never declares PASS", () => {
    const attempts = Array.from({ length: 40 }, (_, index) =>
      attempt({ attempt: index + 1, milestones: { metricValueMs: index + 1 } }),
    );

    const summary = createCohortSummary(attempts);
    const serialized = serializeCohortSummary(summary);

    expect(summary.evaluation).toBe("READY_FOR_PERCENTILES");
    expect(summary.percentiles).toEqual({ p50: 20, p75: 30, p95: 38 });
    expect(serialized).not.toContain('"PASS"');
  });

  it("keeps BLOCKED authoritative over valid samples", () => {
    const summary = createCohortSummary([
      attempt(),
      attempt({ attempt: 2, state: "BLOCKED", reason: "ISOLATION_NOT_PROVEN" }),
    ]);

    expect(summary.evaluation).toBe("BLOCKED");
    expect(summary.percentiles).toBeNull();
  });
});
