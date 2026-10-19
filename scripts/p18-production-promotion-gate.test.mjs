import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertP18CleanWorktree,
  assertP18ReleaseIdentity,
  assertP18PromotionEvidence,
  P18PromotionGateError,
} from "./lib/p18-production-promotion-gate.mjs";

const sha = "a".repeat(40);

const validAudit = {
  riskId: "LES-SEC-RA-001",
  classification: "REMEDIATED_WITH_MAINTAINED_PATCH",
  advisoryId: "GHSA-vfj7-8cjw-p6xm",
  patchVersion: "3.0.4-lessenc.1",
  auditVulnerabilities: 0,
  runtimeDependencyPresent: false,
  productionHardStop: "CLEARED_FOR_LES_SEC_RA_001_ONLY",
  productionAuthorityGranted: false,
};

const git = (commit = sha) => ({
  status: 0,
  stdout: `${commit}\n`,
  stderr: "",
});

const audit = (value = validAudit, status = 0) => ({
  status,
  stdout: JSON.stringify(value),
  stderr: "",
});

function rejects(callback, code) {
  assert.throws(callback, (error) => error instanceof P18PromotionGateError && error.code === code);
}

test("requires an explicit exact release SHA", () => {
  rejects(() => assertP18ReleaseIdentity(undefined, sha), "P18_RELEASE_COMMIT_REQUIRED");
  rejects(() => assertP18ReleaseIdentity("invalid", sha), "P18_RELEASE_COMMIT_REQUIRED");
});

test("rejects release mismatch", () => {
  rejects(
    () => assertP18PromotionEvidence(sha, git("b".repeat(40)), audit()),
    "P18_RELEASE_COMMIT_MISMATCH",
  );
});

test("rejects unavailable Git evidence", () => {
  rejects(
    () => assertP18PromotionEvidence(sha, { status: 1, stdout: "" }, audit()),
    "P18_GIT_IDENTITY_UNAVAILABLE",
  );
});

test("rejects a failed complete audit", () => {
  rejects(
    () => assertP18PromotionEvidence(sha, git(), audit(validAudit, 1)),
    "P18_FULL_REMEDIATION_AUDIT_FAILED",
  );
});

test("rejects an incomplete or forged success contract", () => {
  rejects(
    () =>
      assertP18PromotionEvidence(
        sha,
        git(),
        audit({
          ...validAudit,
          productionAuthorityGranted: true,
        }),
      ),
    "P18_FULL_REMEDIATION_AUDIT_CONTRACT_INVALID",
  );
  rejects(
    () =>
      assertP18PromotionEvidence(sha, git(), {
        status: 0,
        stdout: "not-json",
      }),
    "P18_FULL_REMEDIATION_AUDIT_OUTPUT_INVALID",
  );
});

test("accepts only complete audit evidence bound to Git", () => {
  assert.deepEqual(assertP18PromotionEvidence(sha, git(), audit()), {
    commit: sha,
    riskId: "LES-SEC-RA-001",
    hardStop: "CLEARED_FOR_LES_SEC_RA_001_ONLY",
    productionAuthorityGranted: false,
  });
});
test("rejects dirty or unavailable release worktree evidence", () => {
  assert.doesNotThrow(() =>
    assertP18CleanWorktree({
      status: 0,
      stdout: "",
      stderr: "",
    }),
  );

  rejects(
    () =>
      assertP18CleanWorktree({
        status: 0,
        stdout: " M package-lock.json\n",
      }),
    "P18_RELEASE_WORKTREE_NOT_CLEAN",
  );

  rejects(
    () =>
      assertP18CleanWorktree({
        status: 0,
        stdout: "?? scripts/untracked-file.mjs\n",
      }),
    "P18_RELEASE_WORKTREE_NOT_CLEAN",
  );

  rejects(
    () =>
      assertP18CleanWorktree({
        status: 1,
        stdout: "",
      }),
    "P18_RELEASE_WORKTREE_NOT_CLEAN",
  );
});
