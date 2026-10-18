import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertLesSecRa001Remediated,
  BracesRemediationError,
  evaluateBracesRemediationEvidence,
} from "./lib/p18-braces-remediation.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(
  readFileSync(resolve(root, "docs/security/les-sec-ra-001-remediation-policy.json"), "utf8"),
);
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const lockfile = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const execution = (value, exitCode = 0) => ({
  exitCode,
  stdout: JSON.stringify(value),
  stderr: "",
});

const audit = {
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
  },
};
const installedTree = {
  name: "lessenc-digital",
  version: "0.1.0",
  dependencies: {
    braces: { version: "3.0.4-lessenc.1" },
    "@next/eslint-plugin-next": {
      version: "16.3.8",
      dependencies: {
        "fast-glob": {
          version: "3.3.1",
          dependencies: {
            micromatch: {
              version: "4.0.8",
              dependencies: { braces: { version: "3.0.4-lessenc.1" } },
            },
          },
        },
      },
    },
  },
};
const runtimeTree = { name: "lessenc-digital", version: "0.1.0" };

function evidence(overrides = {}) {
  return {
    policy: clone(policy),
    manifest: clone(manifest),
    lockfile: clone(lockfile),
    fileHashesSha256: clone(policy.fileHashesSha256),
    auditExecution: execution(audit),
    installedTreeExecution: execution(installedTree),
    runtimeTreeExecution: execution(runtimeTree),
    ...overrides,
  };
}

function expectFailure(input, code) {
  assert.throws(
    () => evaluateBracesRemediationEvidence(input),
    (error) => error instanceof BracesRemediationError && error.code === code,
  );
}

test("accepts only the exact maintained patch with a complete zero-vulnerability audit", () => {
  const result = evaluateBracesRemediationEvidence(evidence());
  assert.equal(result.classification, "REMEDIATED_WITH_MAINTAINED_PATCH");
  assert.equal(result.auditVulnerabilities, 0);
  assert.equal(result.productionAuthorityGranted, false);
});

test("rejects any vulnerability finding", () => {
  const changed = clone(audit);
  changed.vulnerabilities.example = { severity: "low" };
  changed.metadata.vulnerabilities.low = 1;
  changed.metadata.vulnerabilities.total = 1;
  expectFailure(
    evidence({ auditExecution: execution(changed, 1) }),
    "BRACES_REMEDIATION_AUDIT_EXIT_CODE_INVALID",
  );
});

test("rejects manifest and lockfile drift", () => {
  const changedManifest = clone(manifest);
  changedManifest.overrides.braces = "3.0.3";
  expectFailure(evidence({ manifest: changedManifest }), "BRACES_REMEDIATION_OVERRIDE_CHANGED");
  const changedLock = clone(lockfile);
  changedLock.packages["node_modules/braces"].integrity = "sha512-drift";
  expectFailure(evidence({ lockfile: changedLock }), "BRACES_REMEDIATION_LOCK_IDENTITY_CHANGED");
});

test("rejects a patched file hash change", () => {
  const hashes = clone(policy.fileHashesSha256);
  hashes["vendor/braces/lib/parse.js"] = "0".repeat(64);
  expectFailure(evidence({ fileHashesSha256: hashes }), "BRACES_REMEDIATION_FILE_HASH_CHANGED");
});

test("rejects braces in the runtime dependency tree", () => {
  const runtime = clone(runtimeTree);
  runtime.dependencies = { braces: { version: "3.0.4-lessenc.1" } };
  expectFailure(
    evidence({ runtimeTreeExecution: execution(runtime) }),
    "BRACES_REMEDIATION_PRESENT_IN_RUNTIME_TREE",
  );
});

test("clears only LES-SEC-RA-001 and never grants production authority", () => {
  assert.deepEqual(assertLesSecRa001Remediated(policy), {
    riskId: "LES-SEC-RA-001",
    hardStop: "CLEARED_FOR_LES_SEC_RA_001_ONLY",
    productionAuthorityGranted: false,
  });
  assert.throws(
    () => assertLesSecRa001Remediated({ ...policy, productionAuthorityGranted: true }),
    (error) =>
      error instanceof BracesRemediationError &&
      error.code === "PRODUCTION_AUTHORITY_MUST_REMAIN_FALSE",
  );
});
