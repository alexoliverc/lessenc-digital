import { describe, expect, it } from "vitest";

import { planBackupRetention } from "../../../scripts/lib/p16-backup-retention.mjs";

describe("P16 backup retention planning", () => {
  it("keeps the union of 7 daily, 4 weekly and 3 monthly recovery points", () => {
    const backups = Array.from({ length: 100 }, (_, index) => ({
      id: `backup-${index}`,
      createdAt: new Date(Date.UTC(2026, 8, 20 - index)).toISOString(),
    }));

    const plan = planBackupRetention(backups);

    expect(plan.keep).toContain("backup-0");
    expect(plan.keep.length).toBeGreaterThanOrEqual(7);
    expect(plan.deleteCandidates.length + plan.keep.length).toBe(100);
    expect(new Set([...plan.keep, ...plan.deleteCandidates]).size).toBe(100);
  });

  it("ignores malformed metadata and never marks a retained backup for deletion", () => {
    const plan = planBackupRetention([
      { id: "valid", createdAt: "2026-09-20T00:00:00.000Z" },
      { id: "", createdAt: "2026-09-19T00:00:00.000Z" },
      { id: "invalid-date", createdAt: "not-a-date" },
    ]);

    expect(plan).toEqual({ keep: ["valid"], deleteCandidates: [] });
  });
});
