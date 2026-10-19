import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assertP18CleanWorktree,
  assertP18PromotionEvidence,
  assertP18ReleaseIdentity,
  P18PromotionGateError,
} from "./lib/p18-production-promotion-gate.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedCommit = process.env.P18_RELEASE_COMMIT;

try {
  // Release binding: the caller must identify the exact Git commit.
  assertP18ReleaseIdentity(expectedCommit, expectedCommit);

  const gitExecution = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: 64 * 1024,
  });

  const worktreeStatus = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: 256 * 1024,
  });

  assertP18CleanWorktree(worktreeStatus);
  // Never trust a policy-only flag or an unverified CI claim.
  // Re-execute the existing full local maintained-patch auditor.
  const auditExecution = spawnSync(
    process.execPath,
    [resolve(repositoryRoot, "scripts/p18-braces-remediation-audit.mjs")],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 256 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const worktreeStatusAfter = spawnSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 256 * 1024,
    },
  );

  assertP18CleanWorktree(worktreeStatusAfter);
  const result = assertP18PromotionEvidence(expectedCommit, gitExecution, auditExecution);

  process.stdout.write(
    `${result.riskId} HARD STOP CLEARED FOR THIS RISK ONLY; ` +
      `RELEASE BINDING VERIFIED; GLOBAL PRODUCTION AUTHORITY NOT GRANTED\n`,
  );
} catch (error) {
  const code =
    error instanceof P18PromotionGateError ? error.code : "P18_PROMOTION_GATE_UNEXPECTED_FAILURE";

  process.stderr.write(`P18 PROMOTION GATE BLOCKED: ${code}\n`);
  process.exitCode = 1;
}
