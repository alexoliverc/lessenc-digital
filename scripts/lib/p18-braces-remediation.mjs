const ZERO_COUNTS = ["info", "low", "moderate", "high", "critical", "total"];

export class BracesRemediationError extends Error {
  constructor(code) {
    super(code);
    this.name = "BracesRemediationError";
    this.code = code;
  }
}

function invariant(condition, code) {
  if (!condition) throw new BracesRemediationError(code);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseExecution(execution, label, exitCodes = [0]) {
  invariant(isObject(execution), `${label}_EXECUTION_MISSING`);
  invariant(!execution.operationalFailure, `${label}_OPERATIONAL_FAILURE`);
  invariant(!execution.timedOut, `${label}_TIMEOUT`);
  invariant(!execution.signal, `${label}_SIGNAL_FAILURE`);
  invariant(exitCodes.includes(execution.exitCode), `${label}_EXIT_CODE_INVALID`);
  invariant(typeof execution.stdout === "string", `${label}_STDOUT_INVALID`);
  try {
    const parsed = JSON.parse(execution.stdout);
    invariant(isObject(parsed) && !parsed.error, `${label}_JSON_INCOMPLETE`);
    return parsed;
  } catch (error) {
    if (error instanceof BracesRemediationError) throw error;
    throw new BracesRemediationError(`${label}_JSON_INVALID`);
  }
}

function validatePolicy(policy) {
  invariant(isObject(policy), "BRACES_REMEDIATION_POLICY_INVALID");
  invariant(policy.schemaVersion === 1, "BRACES_REMEDIATION_POLICY_SCHEMA_INVALID");
  invariant(policy.riskId === "LES-SEC-RA-001", "BRACES_REMEDIATION_POLICY_ID_INVALID");
  invariant(
    policy.status === "REMEDIATED_WITH_MAINTAINED_PATCH",
    "BRACES_REMEDIATION_POLICY_STATUS_INVALID",
  );
  invariant(policy.riskAcceptanceActive === false, "BRACES_RISK_ACCEPTANCE_STILL_ACTIVE");
  invariant(policy.productionHardStopActive === false, "BRACES_HARD_STOP_STILL_ACTIVE");
  invariant(policy.productionAuthorityGranted === false, "PRODUCTION_AUTHORITY_MUST_REMAIN_FALSE");
  invariant(
    policy.advisory?.id === "GHSA-vfj7-8cjw-p6xm" &&
      policy.advisory?.package === "braces" &&
      policy.advisory?.affectedRange === "<=3.0.3" &&
      policy.advisory?.officialPatchedReleaseAvailable === false,
    "BRACES_REMEDIATION_ADVISORY_INVALID",
  );
  invariant(
    policy.patch?.version === "3.0.4-lessenc.1" &&
      policy.patch?.upstreamBaseVersion === "3.0.3" &&
      policy.patch?.candidateCommit === "28d440b5dd449dbf1fe6f3506cf94ecca4d02660" &&
      policy.patch?.maximumInputDepth === 100,
    "BRACES_REMEDIATION_PATCH_IDENTITY_INVALID",
  );
  invariant(isObject(policy.fileHashesSha256), "BRACES_REMEDIATION_HASH_POLICY_INVALID");
}

function validateManifestAndLock(policy, manifest, lockfile) {
  invariant(manifest?.name === "lessenc-digital", "BRACES_REMEDIATION_MANIFEST_INVALID");
  invariant(
    manifest.devDependencies?.braces === policy.manifest.directDevelopmentDependency,
    "BRACES_REMEDIATION_MANIFEST_SPEC_CHANGED",
  );
  invariant(
    manifest.overrides?.braces === policy.manifest.override,
    "BRACES_REMEDIATION_OVERRIDE_CHANGED",
  );
  invariant(manifest.dependencies?.braces === undefined, "BRACES_PRESENT_AS_RUNTIME_DEPENDENCY");

  const root = lockfile?.packages?.[""];
  const locked = lockfile?.packages?.["node_modules/braces"];
  invariant(isObject(root) && isObject(locked), "BRACES_REMEDIATION_LOCK_NODE_MISSING");
  invariant(
    root.devDependencies?.braces === policy.manifest.directDevelopmentDependency,
    "BRACES_REMEDIATION_LOCK_ROOT_CHANGED",
  );
  invariant(
    locked.version === policy.patch.version &&
      locked.resolved === `file:${policy.patch.tarball}` &&
      locked.integrity === policy.patch.integrity &&
      locked.dev === true,
    "BRACES_REMEDIATION_LOCK_IDENTITY_CHANGED",
  );
}

function validateAudit(audit, exitCode) {
  invariant(exitCode === 0, "BRACES_REMEDIATION_AUDIT_FAILED");
  invariant(audit.auditReportVersion === 2, "BRACES_REMEDIATION_AUDIT_VERSION_INVALID");
  invariant(isObject(audit.vulnerabilities), "BRACES_REMEDIATION_AUDIT_INCOMPLETE");
  invariant(
    Object.keys(audit.vulnerabilities).length === 0,
    "BRACES_REMEDIATION_VULNERABILITY_PRESENT",
  );
  const counts = audit.metadata?.vulnerabilities;
  invariant(
    isObject(counts) && ZERO_COUNTS.every((key) => counts[key] === 0),
    "BRACES_REMEDIATION_AUDIT_COUNTS_NONZERO",
  );
}

function cleanNode(node) {
  invariant(isObject(node), "BRACES_REMEDIATION_NPM_TREE_INCOMPLETE");
  invariant(
    !node.invalid && !node.missing && !node.extraneous,
    "BRACES_REMEDIATION_NPM_TREE_INVALID",
  );
  invariant(!node.problems || node.problems.length === 0, "BRACES_REMEDIATION_NPM_TREE_INVALID");
  return node;
}

function validateTrees(policy, installedTree, runtimeTree) {
  const expected = policy.expectedInstalledChain;
  const direct = cleanNode(installedTree.dependencies?.braces);
  invariant(direct.version === expected.braces, "BRACES_REMEDIATION_DIRECT_VERSION_CHANGED");
  const plugin = cleanNode(installedTree.dependencies?.["@next/eslint-plugin-next"]);
  const fastGlob = cleanNode(plugin.dependencies?.["fast-glob"]);
  const micromatch = cleanNode(fastGlob.dependencies?.micromatch);
  const nestedBraces = cleanNode(micromatch.dependencies?.braces);
  invariant(plugin.version === expected.nextPlugin, "BRACES_REMEDIATION_CHAIN_CHANGED");
  invariant(fastGlob.version === expected.fastGlob, "BRACES_REMEDIATION_CHAIN_CHANGED");
  invariant(micromatch.version === expected.micromatch, "BRACES_REMEDIATION_CHAIN_CHANGED");
  invariant(nestedBraces.version === expected.braces, "BRACES_REMEDIATION_CHAIN_CHANGED");
  invariant(!runtimeTree.dependencies?.braces, "BRACES_REMEDIATION_PRESENT_IN_RUNTIME_TREE");
}

function validateHashes(policy, hashes) {
  invariant(isObject(hashes), "BRACES_REMEDIATION_HASH_EVIDENCE_INVALID");
  const expected = policy.fileHashesSha256;
  invariant(
    Object.keys(hashes).length === Object.keys(expected).length,
    "BRACES_REMEDIATION_HASH_SET_CHANGED",
  );
  for (const [path, digest] of Object.entries(expected)) {
    invariant(hashes[path] === digest, "BRACES_REMEDIATION_FILE_HASH_CHANGED");
  }
}

export function evaluateBracesRemediationEvidence(input) {
  invariant(isObject(input), "BRACES_REMEDIATION_EVIDENCE_INVALID");
  validatePolicy(input.policy);
  validateManifestAndLock(input.policy, input.manifest, input.lockfile);
  const audit = parseExecution(input.auditExecution, "BRACES_REMEDIATION_AUDIT");
  const installed = parseExecution(input.installedTreeExecution, "BRACES_REMEDIATION_TREE");
  const runtime = parseExecution(input.runtimeTreeExecution, "BRACES_REMEDIATION_RUNTIME", [0, 1]);
  validateAudit(audit, input.auditExecution.exitCode);
  validateTrees(input.policy, installed, runtime);
  validateHashes(input.policy, input.fileHashesSha256);
  return {
    riskId: input.policy.riskId,
    classification: "REMEDIATED_WITH_MAINTAINED_PATCH",
    advisoryId: input.policy.advisory.id,
    patchVersion: input.policy.patch.version,
    auditVulnerabilities: 0,
    runtimeDependencyPresent: false,
    productionHardStop: "CLEARED_FOR_LES_SEC_RA_001_ONLY",
    productionAuthorityGranted: false,
  };
}

export function assertLesSecRa001Remediated(policy) {
  validatePolicy(policy);
  return {
    riskId: policy.riskId,
    hardStop: "CLEARED_FOR_LES_SEC_RA_001_ONLY",
    productionAuthorityGranted: false,
  };
}
