import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assertProductionPromotionBlocked,
  TemporaryRiskAuditError,
} from "./lib/p17-temporary-risk-audit.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const policy = JSON.parse(
    readFileSync(resolve(repositoryRoot, "docs/security/les-sec-ra-001-policy.json"), "utf8"),
  );
  assertProductionPromotionBlocked(policy);
  process.stdout.write("LES-SEC-RA-001 PRODUCTION PROMOTION ALLOWED\n");
} catch (error) {
  const code =
    error instanceof TemporaryRiskAuditError ? error.code : "LES_SEC_RA_001_HARD_STOP_FAILURE";
  process.stderr.write(`LES-SEC-RA-001 PRODUCTION PROMOTION BLOCKED: ${code}\n`);
  process.exitCode = 1;
}
