import { describe, expect, it } from "vitest";

import { planBackupRetention } from "../../../scripts/lib/p16-backup-retention.mjs";

const NOW = "2026-09-26T12:00:00.000Z";

describe("P16 backup retention planning", () => {
  it("keeps the UTC union of 7 daily, 4 weekly and 3 monthly recovery points", () => {
    const backups = Array.from({ length: 100 }, (_, index) => ({
      id: `backup-${String(index).padStart(3, "0")}`,
      createdAt: new Date(Date.UTC(2026, 8, 26 - index, 1)).toISOString(),
    }));
    const plan = planBackupRetention(backups, { now: NOW });

    expect(plan.mode).toBe("PLAN_ONLY");
    expect(plan.policy).toEqual({ daily: 7, weekly: 4, monthly: 3, timezone: "UTC" });
    expect(plan.keep.map(({ id }) => id)).toContain("backup-000");
    expect(
      plan.keep.flatMap(({ reasons }) => reasons).filter((reason) => reason.startsWith("daily:")),
    ).toHaveLength(7);
    expect(
      plan.keep.flatMap(({ reasons }) => reasons).filter((reason) => reason.startsWith("weekly:")),
    ).toHaveLength(4);
    expect(
      plan.keep.flatMap(({ reasons }) => reasons).filter((reason) => reason.startsWith("monthly:")),
    ).toHaveLength(3);
    expect(plan.notRetained.length + plan.keep.length).toBe(100);
    expect(new Set([...plan.keep, ...plan.notRetained].map(({ id }) => id)).size).toBe(100);
  });

  it("selects only the newest point in duplicate UTC periods and records every tier reason", () => {
    const plan = planBackupRetention(
      [
        { id: "older", createdAt: "2026-09-26T01:00:00.000Z" },
        { id: "newer", createdAt: "2026-09-26T11:00:00.000Z" },
      ],
      { now: NOW },
    );

    expect(plan.keep).toEqual([
      {
        id: "newer",
        createdAt: "2026-09-26T11:00:00.000Z",
        reasons: ["daily:2026-09-26", "weekly:2026-W39", "monthly:2026-09"],
      },
    ]);
    expect(plan.notRetained).toEqual([{ id: "older", createdAt: "2026-09-26T01:00:00.000Z" }]);
  });

  it("uses ISO weeks across the UTC year boundary", () => {
    const plan = planBackupRetention(
      [
        { id: "december", createdAt: "2025-12-31T23:59:59.000Z" },
        { id: "january", createdAt: "2026-01-01T00:00:01.000Z" },
      ],
      { now: "2026-01-02T00:00:00.000Z" },
    );
    const weeklyReasons = plan.keep.flatMap(({ reasons }) =>
      reasons.filter((reason) => reason.startsWith("weekly:")),
    );

    expect(weeklyReasons).toEqual(["weekly:2026-W01"]);
  });

  it("is deterministic regardless of input order and host DST", () => {
    const points = [
      { id: "b", createdAt: "2026-03-08T07:30:00.000Z" },
      { id: "a", createdAt: "2026-03-08T07:30:00.000Z" },
      { id: "c", createdAt: "2026-03-07T23:30:00.000Z" },
    ];
    const now = "2026-03-09T00:00:00.000Z";

    expect(planBackupRetention(points, { now })).toEqual(
      planBackupRetention([...points].reverse(), { now }),
    );
    expect(planBackupRetention(points, { now }).keep[0]?.id).toBe("a");
  });

  it("handles empty and small indexes without inventing deletion authority", () => {
    expect(planBackupRetention([], { now: NOW })).toEqual({
      mode: "PLAN_ONLY",
      evaluatedAt: NOW,
      policy: { daily: 7, weekly: 4, monthly: 3, timezone: "UTC" },
      keep: [],
      notRetained: [],
    });
  });

  it.each([
    [[{ id: "", createdAt: "2026-09-20T00:00:00.000Z" }], "P16_RETENTION_BACKUP_ID_INVALID"],
    [[{ id: "invalid-date", createdAt: "not-a-date" }], "P16_RETENTION_CREATED_AT_INVALID"],
    [
      [
        { id: "duplicate", createdAt: "2026-09-20T00:00:00.000Z" },
        { id: "duplicate", createdAt: "2026-09-21T00:00:00.000Z" },
      ],
      "P16_RETENTION_DUPLICATE_BACKUP_ID",
    ],
    [
      [{ id: "future", createdAt: "2026-09-27T00:00:00.000Z" }],
      "P16_RETENTION_FUTURE_BACKUP_REFUSED",
    ],
  ])("fails closed for invalid retention input: %s", (backups, failure) => {
    expect(() => planBackupRetention(backups, { now: NOW })).toThrow(failure);
  });
});
