import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertProductionPromotionBlocked,
  evaluateTemporaryRiskAuditEvidence,
  TemporaryRiskAuditError,
} from "./lib/p17-temporary-risk-audit.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(
  readFileSync(resolve(repositoryRoot, "docs/security/les-sec-ra-001-policy.json"), "utf8"),
);
const fixture = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, "scripts/fixtures/p17-temporary-risk-audit/accepted-risk.json"),
    "utf8",
  ),
);

const clone = (value) => JSON.parse(JSON.stringify(value));
const execution = (value, exitCode = 0) => ({
  exitCode,
  stdout: JSON.stringify(value),
  stderr: "",
});

function evidence(overrides = {}) {
  const current = clone(fixture);
  return {
    policy: clone(policy),
    scope: "P17_DEVELOPMENT_CI_PRE_PRODUCTION",
    applicationEnvironment: "test",
    now: new Date("2026-10-14T12:00:00-03:00"),
    manifest: current.manifest,
    lockfile: current.lockfile,
    auditExecution: execution(current.audit, 1),
    installedTreeExecution: execution(current.installedTree),
    runtimeTreeExecution: execution(current.runtimeTree, 1),
    ...overrides,
  };
}

function expectFailure(input, code) {
  assert.throws(
    () => evaluateTemporaryRiskAuditEvidence(input),
    (error) => error instanceof TemporaryRiskAuditError && error.code === code,
  );
}

test("accepts only the exact approved advisory while keeping the finding visible", () => {
  const result = evaluateTemporaryRiskAuditEvidence(evidence());
  assert.equal(result.classification, "TEMPORARY_ACCEPTED_RISK");
  assert.equal(result.acceptedRisk.advisoryId, "GHSA-vfj7-8cjw-p6xm");
  assert.equal(result.acceptedRisk.package, "braces@3.0.3");
  assert.equal(result.acceptedRisk.severity, "HIGH");
  assert.equal(result.acceptedRisk.productionAllowed, false);
  assert.deepEqual(result.acceptedRisk.vulnerableNodes, [
    "@next/eslint-plugin-next@16.3.8",
    "fast-glob@3.3.1",
    "micromatch@4.0.8",
    "braces@3.0.3",
  ]);
});

test("passes a complete audit with zero vulnerabilities without claiming accepted risk", () => {
  const audit = clone(fixture.audit);
  audit.vulnerabilities = {};
  audit.metadata.vulnerabilities = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };
  const result = evaluateTemporaryRiskAuditEvidence(evidence({ auditExecution: execution(audit) }));
  assert.equal(result.classification, "PASS");
  assert.equal(result.acceptedRisk, null);
});

test("rejects another HIGH vulnerability", () => {
  const audit = clone(fixture.audit);
  audit.vulnerabilities.unapproved = {
    name: "unapproved",
    severity: "high",
    isDirect: false,
    via: [],
    effects: [],
    nodes: ["node_modules/unapproved"],
    fixAvailable: false,
  };
  audit.metadata.vulnerabilities.high = 5;
  audit.metadata.vulnerabilities.total = 5;
  expectFailure(
    evidence({ auditExecution: execution(audit, 1) }),
    "TEMPORARY_RISK_UNAPPROVED_VULNERABILITY_PRESENT",
  );
});

test("rejects a CRITICAL vulnerability", () => {
  const audit = clone(fixture.audit);
  audit.vulnerabilities.criticalPackage = {
    name: "criticalPackage",
    severity: "critical",
    isDirect: false,
    via: [],
    effects: [],
    nodes: ["node_modules/criticalPackage"],
    fixAvailable: false,
  };
  audit.metadata.vulnerabilities.critical = 1;
  audit.metadata.vulnerabilities.total = 5;
  expectFailure(
    evidence({ auditExecution: execution(audit, 1) }),
    "TEMPORARY_RISK_UNAPPROVED_VULNERABILITY_PRESENT",
  );
});

test("rejects a second advisory involving braces", () => {
  const audit = clone(fixture.audit);
  audit.vulnerabilities.braces.via.push({
    ...clone(audit.vulnerabilities.braces.via[0]),
    source: 9999999,
    url: "https://github.com/advisories/GHSA-xxxx-yyyy-zzzz",
  });
  expectFailure(
    evidence({ auditExecution: execution(audit, 1) }),
    "TEMPORARY_RISK_ADVISORY_SET_CHANGED",
  );
});

test("rejects a changed installed version or dependency chain", () => {
  const installedTree = clone(fixture.installedTree);
  installedTree.dependencies["@next/eslint-plugin-next"].dependencies[
    "fast-glob"
  ].dependencies.micromatch.dependencies.braces.version = "3.0.4";
  expectFailure(
    evidence({ installedTreeExecution: execution(installedTree) }),
    "TEMPORARY_RISK_INSTALLED_CHAIN_CHANGED",
  );

  const lockfile = clone(fixture.lockfile);
  lockfile.packages["node_modules/micromatch"].dependencies.braces = "^3.0.4";
  expectFailure(evidence({ lockfile }), "TEMPORARY_RISK_LOCK_EDGE_CHANGED");
});

test("rejects changed official fix metadata for mandatory review", () => {
  const audit = clone(fixture.audit);
  for (const vulnerability of Object.values(audit.vulnerabilities)) {
    vulnerability.fixAvailable = {
      name: "@next/eslint-plugin-next",
      version: "16.3.9",
      isSemVerMajor: false,
    };
  }
  expectFailure(
    evidence({ auditExecution: execution(audit, 1) }),
    "TEMPORARY_RISK_FIX_METADATA_CHANGED",
  );
});

test("rejects braces in the runtime tree", () => {
  const runtimeTree = clone(fixture.runtimeTree);
  runtimeTree.dependencies = { braces: { version: "3.0.3" } };
  expectFailure(
    evidence({ runtimeTreeExecution: execution(runtimeTree) }),
    "TEMPORARY_RISK_NODE_PRESENT_IN_RUNTIME_TREE",
  );
});

test("rejects an audit network or execution failure", () => {
  expectFailure(
    evidence({
      auditExecution: {
        exitCode: 1,
        stdout: JSON.stringify({ error: { code: "ENETUNREACH" } }),
        stderr: "network unavailable",
        operationalFailure: "ENETUNREACH",
      },
    }),
    "TEMPORARY_RISK_AUDIT_OPERATIONAL_FAILURE",
  );
});

test("rejects invalid and incomplete audit JSON", () => {
  expectFailure(
    evidence({ auditExecution: { exitCode: 1, stdout: "not-json", stderr: "" } }),
    "TEMPORARY_RISK_AUDIT_JSON_INVALID",
  );

  const incomplete = clone(fixture.audit);
  delete incomplete.metadata;
  expectFailure(
    evidence({ auditExecution: execution(incomplete, 1) }),
    "TEMPORARY_RISK_AUDIT_JSON_INCOMPLETE",
  );
});

test("rejects an expired policy", () => {
  expectFailure(
    evidence({ now: new Date("2026-11-14T03:00:00Z") }),
    "TEMPORARY_RISK_POLICY_EXPIRED",
  );
});

test("rejects use outside the approved scope or application environment", () => {
  expectFailure(evidence({ scope: "PRODUCTION" }), "TEMPORARY_RISK_SCOPE_NOT_AUTHORIZED");
  expectFailure(
    evidence({ applicationEnvironment: "production" }),
    "TEMPORARY_RISK_ENVIRONMENT_NOT_AUTHORIZED",
  );
});

test("treats operational failures independently from accepted vulnerabilities", () => {
  expectFailure(
    evidence({ auditExecution: { exitCode: 2, stdout: "{}", stderr: "failure" } }),
    "TEMPORARY_RISK_AUDIT_EXIT_CODE_INVALID",
  );
});

test("keeps production promotion fail-closed while LES-SEC-RA-001 is active", () => {
  assert.throws(
    () => assertProductionPromotionBlocked(policy),
    (error) =>
      error instanceof TemporaryRiskAuditError &&
      error.code === "LES_SEC_RA_001_PRODUCTION_HARD_STOP_ACTIVE",
  );
});

test("allows the future production check only after an explicit remediated policy state", () => {
  assert.deepEqual(
    assertProductionPromotionBlocked({
      ...policy,
      status: "REMEDIATED",
      productionAllowed: true,
    }),
    { productionPromotion: "ALLOWED" },
  );
});
