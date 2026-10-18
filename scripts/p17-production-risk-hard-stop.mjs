import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assertLesSecRa001Remediated,
  BracesRemediationError,
} from "./lib/p18-braces-remediation.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const policy = JSON.parse(
    readFileSync(
      resolve(repositoryRoot, "docs/security/les-sec-ra-001-remediation-policy.json"),
      "utf8",
    ),
  );
  const result = assertLesSecRa001Remediated(policy);
  process.stdout.write(
    `${result.riskId} HARD STOP CLEARED FOR THIS RISK ONLY; GLOBAL PRODUCTION AUTHORITY NOT GRANTED\n`,
  );
} catch (error) {
  const code =
    error instanceof BracesRemediationError ? error.code : "LES_SEC_RA_001_HARD_STOP_FAILURE";
  process.stderr.write(`LES-SEC-RA-001 PRODUCTION PROMOTION BLOCKED: ${code}\n`);
  process.exitCode = 1;
}
