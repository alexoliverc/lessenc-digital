import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readDocument(relativePath: string): string {
  return readFileSync(join(process.cwd(), "docs", ...relativePath.split("/")), "utf8");
}

describe("P15 operational documentation completeness", () => {
  it("documents every P15 execution block and hosted deferrals", () => {
    const architecture = readDocument("architecture/p15-observability-operational-readiness.md");

    for (let block = 1; block <= 8; block += 1) {
      expect(architecture).toContain(`P15-0${block}`);
    }

    expect(architecture).toContain("status.lessenc.com.br");
    expect(architecture).toContain("NOT DEPLOYED");
    expect(architecture).toContain("OPEN_STAGING_BASELINE");
  });

  it("keeps application rollback explicitly separate from data recovery", () => {
    const recovery = readDocument("operations/p15-backup-recovery-policy.md");
    const incident = readDocument("operations/p15-incident-response-runbook.md");

    expect(recovery).toContain("Application rollback versus data recovery");
    expect(recovery).toContain("It does not reverse a migration");
    expect(incident).toContain("Do not describe application rollback as database rollback");
    expect(recovery).toContain("RPO");
    expect(recovery).toContain("RTO");
  });

  it("contains actionable runbooks for every required failure class", () => {
    const incident = readDocument("operations/p15-incident-response-runbook.md");
    for (const heading of [
      "application unavailable",
      "database unavailable or degraded",
      "private storage unavailable",
      "payment provider degradation",
      "webhook or reconciliation failure",
      "entitlement or delivery failure",
      "security operational signal",
      "backup or restore validation failure",
      "rate-limit infrastructure failure",
    ]) {
      expect(incident.toLowerCase()).toContain(`runbook — ${heading}`);
    }
  });
});
