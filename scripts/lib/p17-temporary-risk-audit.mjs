const REQUIRED_COUNT_KEYS = ["info", "low", "moderate", "high", "critical", "total"];

export class TemporaryRiskAuditError extends Error {
  constructor(code) {
    super(code);
    this.name = "TemporaryRiskAuditError";
    this.code = code;
  }
}

function invariant(condition, code) {
  if (!condition) throw new TemporaryRiskAuditError(code);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameArray(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function sameObject(actual, expected) {
  return (
    isObject(actual) &&
    Object.keys(actual).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, value]) => actual[key] === value)
  );
}

function parseExecution(execution, label, allowedExitCodes) {
  invariant(isObject(execution), `${label}_EXECUTION_MISSING`);
  invariant(!execution.operationalFailure, `${label}_OPERATIONAL_FAILURE`);
  invariant(!execution.timedOut, `${label}_TIMEOUT`);
  invariant(!execution.signal, `${label}_SIGNAL_FAILURE`);
  invariant(
    Number.isInteger(execution.exitCode) && allowedExitCodes.includes(execution.exitCode),
    `${label}_EXIT_CODE_INVALID`,
  );
  invariant(typeof execution.stdout === "string", `${label}_STDOUT_INVALID`);

  let parsed;
  try {
    parsed = JSON.parse(execution.stdout);
  } catch {
    throw new TemporaryRiskAuditError(`${label}_JSON_INVALID`);
  }

  invariant(isObject(parsed), `${label}_JSON_INCOMPLETE`);
  invariant(!parsed.error, `${label}_JSON_ERROR`);
  return parsed;
}

function validatePolicy(policy, scope, applicationEnvironment, now) {
  invariant(isObject(policy), "TEMPORARY_RISK_POLICY_INVALID");
  invariant(policy.schemaVersion === 1, "TEMPORARY_RISK_POLICY_SCHEMA_INVALID");
  invariant(policy.riskId === "LES-SEC-RA-001", "TEMPORARY_RISK_POLICY_ID_INVALID");
  invariant(policy.status === "TEMPORARY_ACCEPTED_RISK", "TEMPORARY_RISK_POLICY_STATUS_INVALID");
  invariant(policy.productionAllowed === false, "TEMPORARY_RISK_PRODUCTION_MUST_BE_BLOCKED");
  invariant(scope === policy.approvedScope, "TEMPORARY_RISK_SCOPE_NOT_AUTHORIZED");
  invariant(
    Array.isArray(policy.allowedApplicationEnvironments) &&
      policy.allowedApplicationEnvironments.includes(applicationEnvironment),
    "TEMPORARY_RISK_ENVIRONMENT_NOT_AUTHORIZED",
  );
  invariant(
    policy.expirationRatification === "PENDING_OWNER_RATIFICATION" ||
      policy.expirationRatification === "OWNER_RATIFIED",
    "TEMPORARY_RISK_EXPIRATION_RATIFICATION_INVALID",
  );

  const effectiveAt = Date.parse(policy.effectiveAt);
  const expiresAt = Date.parse(policy.expiresAt);
  const evaluatedAt = now instanceof Date ? now.getTime() : Number.NaN;
  invariant(
    Number.isFinite(effectiveAt) && Number.isFinite(expiresAt) && effectiveAt < expiresAt,
    "TEMPORARY_RISK_POLICY_WINDOW_INVALID",
  );
  invariant(Number.isFinite(evaluatedAt), "TEMPORARY_RISK_EVALUATION_TIME_INVALID");
  invariant(evaluatedAt >= effectiveAt, "TEMPORARY_RISK_POLICY_NOT_EFFECTIVE");
  invariant(evaluatedAt <= expiresAt, "TEMPORARY_RISK_POLICY_EXPIRED");

  invariant(isObject(policy.advisory), "TEMPORARY_RISK_ADVISORY_POLICY_INVALID");
  invariant(
    policy.advisory.id === "GHSA-vfj7-8cjw-p6xm" &&
      policy.advisory.package === "braces" &&
      policy.advisory.version === "3.0.3" &&
      policy.advisory.severity === "high",
    "TEMPORARY_RISK_ADVISORY_POLICY_INVALID",
  );
  invariant(
    Array.isArray(policy.allowedVulnerabilityNodes) &&
      policy.allowedVulnerabilityNodes.length === 4,
    "TEMPORARY_RISK_NODE_POLICY_INVALID",
  );
  invariant(
    Array.isArray(policy.installedChain) && policy.installedChain.length === 4,
    "TEMPORARY_RISK_CHAIN_POLICY_INVALID",
  );
  invariant(
    Array.isArray(policy.lockEdges) && policy.lockEdges.length === 3,
    "TEMPORARY_RISK_LOCK_POLICY_INVALID",
  );
}

function validateManifestAndLock(policy, manifest, lockfile) {
  invariant(isObject(manifest), "TEMPORARY_RISK_MANIFEST_INVALID");
  invariant(isObject(lockfile) && isObject(lockfile.packages), "TEMPORARY_RISK_LOCKFILE_INVALID");
  invariant(manifest.name === "lessenc-digital", "TEMPORARY_RISK_MANIFEST_IDENTITY_CHANGED");
  invariant(manifest.version === "0.1.0", "TEMPORARY_RISK_MANIFEST_IDENTITY_CHANGED");
  invariant(
    manifest.devDependencies?.["@next/eslint-plugin-next"] === "16.3.8",
    "TEMPORARY_RISK_DIRECT_DEV_DEPENDENCY_CHANGED",
  );

  for (const node of policy.allowedVulnerabilityNodes) {
    invariant(
      manifest.dependencies?.[node.name] === undefined,
      "TEMPORARY_RISK_NODE_PRESENT_IN_RUNTIME_MANIFEST",
    );
    const locked = lockfile.packages[node.path];
    invariant(isObject(locked), "TEMPORARY_RISK_LOCK_NODE_MISSING");
    invariant(locked.version === node.version, "TEMPORARY_RISK_LOCK_VERSION_CHANGED");
    invariant(locked.dev === true, "TEMPORARY_RISK_LOCK_NODE_NOT_DEV_ONLY");

    const matchingKeys = Object.keys(lockfile.packages).filter(
      (key) => key === node.path || key.endsWith(`/${node.path}`),
    );
    invariant(matchingKeys.length === 1, "TEMPORARY_RISK_LOCK_NODE_MULTIPLICITY_CHANGED");
  }

  for (const edge of policy.lockEdges) {
    invariant(
      lockfile.packages[edge.from]?.dependencies?.[edge.to] === edge.specifier,
      "TEMPORARY_RISK_LOCK_EDGE_CHANGED",
    );
  }
}

function collectSelectedChains(tree, selectedNames) {
  const chains = [];

  function visit(node, chain) {
    if (!isObject(node)) return;
    invariant(
      !node.invalid && !node.missing && !node.extraneous,
      "TEMPORARY_RISK_NPM_TREE_INVALID",
    );
    invariant(
      !Array.isArray(node.problems) || node.problems.length === 0,
      "TEMPORARY_RISK_NPM_TREE_INVALID",
    );

    if (!isObject(node.dependencies)) return;
    for (const [name, dependency] of Object.entries(node.dependencies)) {
      invariant(isObject(dependency), "TEMPORARY_RISK_NPM_TREE_INVALID");
      invariant(typeof dependency.version === "string", "TEMPORARY_RISK_NPM_TREE_INCOMPLETE");
      const next = [...chain, `${name}@${dependency.version}`];
      if (selectedNames.has(name)) chains.push(next.join(">"));
      visit(dependency, next);
    }
  }

  invariant(
    typeof tree.name === "string" && typeof tree.version === "string",
    "TEMPORARY_RISK_NPM_TREE_INCOMPLETE",
  );
  visit(tree, [`${tree.name}@${tree.version}`]);
  return chains.sort();
}

function validateInstalledAndRuntimeTrees(policy, installedTree, runtimeTree) {
  const selectedNames = new Set(policy.allowedVulnerabilityNodes.map(({ name }) => name));
  const installedChains = collectSelectedChains(installedTree, selectedNames);
  invariant(
    sameArray(installedChains, [...policy.installedChain].sort()),
    "TEMPORARY_RISK_INSTALLED_CHAIN_CHANGED",
  );

  const runtimeChains = collectSelectedChains(runtimeTree, selectedNames);
  invariant(runtimeChains.length === 0, "TEMPORARY_RISK_NODE_PRESENT_IN_RUNTIME_TREE");
}

function validateAuditMetadata(audit, vulnerabilities) {
  invariant(audit.auditReportVersion === 2, "TEMPORARY_RISK_AUDIT_VERSION_INVALID");
  invariant(isObject(audit.metadata), "TEMPORARY_RISK_AUDIT_JSON_INCOMPLETE");
  invariant(isObject(audit.metadata.vulnerabilities), "TEMPORARY_RISK_AUDIT_JSON_INCOMPLETE");
  invariant(isObject(audit.metadata.dependencies), "TEMPORARY_RISK_AUDIT_JSON_INCOMPLETE");

  const counts = audit.metadata.vulnerabilities;
  for (const key of REQUIRED_COUNT_KEYS) {
    invariant(
      Number.isInteger(counts[key]) && counts[key] >= 0,
      "TEMPORARY_RISK_AUDIT_COUNTS_INVALID",
    );
  }
  invariant(
    counts.info + counts.low + counts.moderate + counts.high + counts.critical === counts.total,
    "TEMPORARY_RISK_AUDIT_COUNTS_INVALID",
  );
  invariant(
    Object.keys(vulnerabilities).length === counts.total,
    "TEMPORARY_RISK_AUDIT_COUNTS_INCOMPLETE",
  );
  invariant(
    ["prod", "dev", "optional", "peer", "peerOptional", "total"].every((key) =>
      Number.isInteger(audit.metadata.dependencies[key]),
    ),
    "TEMPORARY_RISK_AUDIT_DEPENDENCY_COUNTS_INVALID",
  );
  return counts;
}

function advisoryIdFromVia(via) {
  if (!isObject(via) || typeof via.url !== "string") return null;
  const match = via.url.match(/GHSA-[0-9a-z-]+$/u);
  return match?.[0] ?? null;
}

function validateAcceptedFinding(policy, audit, auditExitCode) {
  invariant(isObject(audit.vulnerabilities), "TEMPORARY_RISK_AUDIT_JSON_INCOMPLETE");
  const vulnerabilities = audit.vulnerabilities;
  const counts = validateAuditMetadata(audit, vulnerabilities);

  if (counts.total === 0) {
    invariant(auditExitCode === 0, "TEMPORARY_RISK_AUDIT_EXIT_RESULT_MISMATCH");
    return { classification: "PASS", acceptedRisk: null, counts };
  }

  invariant(auditExitCode === 1, "TEMPORARY_RISK_AUDIT_EXIT_RESULT_MISMATCH");
  invariant(
    counts.info === 0 &&
      counts.low === 0 &&
      counts.moderate === 0 &&
      counts.high === 4 &&
      counts.critical === 0 &&
      counts.total === 4,
    "TEMPORARY_RISK_UNAPPROVED_VULNERABILITY_PRESENT",
  );

  const expectedNames = policy.allowedVulnerabilityNodes.map(({ name }) => name).sort();
  invariant(
    sameArray(Object.keys(vulnerabilities).sort(), expectedNames),
    "TEMPORARY_RISK_UNAPPROVED_VULNERABILITY_PRESENT",
  );

  const advisoryObjects = [];
  for (const expected of policy.allowedVulnerabilityNodes) {
    const actual = vulnerabilities[expected.name];
    invariant(isObject(actual), "TEMPORARY_RISK_AUDIT_NODE_MISSING");
    invariant(
      actual.name === expected.name &&
        actual.severity === "high" &&
        actual.isDirect === expected.isDirect &&
        sameArray(actual.nodes, [expected.path]) &&
        sameArray(actual.effects, expected.effects),
      "TEMPORARY_RISK_AUDIT_NODE_CHANGED",
    );
    invariant(
      sameObject(actual.fixAvailable, policy.currentFix),
      "TEMPORARY_RISK_FIX_METADATA_CHANGED",
    );

    if (expected.name === policy.advisory.package) {
      invariant(
        Array.isArray(actual.via) && actual.via.length === 1,
        "TEMPORARY_RISK_ADVISORY_SET_CHANGED",
      );
      const advisory = actual.via[0];
      invariant(isObject(advisory), "TEMPORARY_RISK_ADVISORY_SET_CHANGED");
      advisoryObjects.push(advisory);
      invariant(
        typeof advisory.title === "string" &&
          advisory.title.length > 0 &&
          advisoryIdFromVia(advisory) === policy.advisory.id &&
          advisory.source === policy.advisory.source &&
          advisory.name === policy.advisory.package &&
          advisory.dependency === policy.advisory.package &&
          advisory.url === policy.advisory.url &&
          advisory.severity === policy.advisory.severity &&
          advisory.range === policy.advisory.range &&
          sameArray(advisory.cwe, policy.advisory.cwe) &&
          advisory.cvss?.score === policy.advisory.cvssScore &&
          advisory.cvss?.vectorString === policy.advisory.cvssVector,
        "TEMPORARY_RISK_ADVISORY_METADATA_CHANGED",
      );
    } else {
      invariant(sameArray(actual.via, expected.via), "TEMPORARY_RISK_AUDIT_CHAIN_CHANGED");
    }
  }

  invariant(advisoryObjects.length === 1, "TEMPORARY_RISK_ADVISORY_SET_CHANGED");
  return {
    classification: "TEMPORARY_ACCEPTED_RISK",
    acceptedRisk: {
      riskId: policy.riskId,
      advisoryId: policy.advisory.id,
      advisorySource: policy.advisory.source,
      title: advisoryObjects[0].title,
      package: `${policy.advisory.package}@${policy.advisory.version}`,
      severity: policy.advisory.severity.toUpperCase(),
      url: policy.advisory.url,
      cwe: policy.advisory.cwe,
      cvssScore: policy.advisory.cvssScore,
      cvssVector: policy.advisory.cvssVector,
      range: policy.advisory.range,
      vulnerableNodes: policy.allowedVulnerabilityNodes.map(
        ({ name, version }) => `${name}@${version}`,
      ),
      installedChain: policy.installedChain,
      currentFix: policy.currentFix,
      expiration: policy.expiresAt,
      expirationRatification: policy.expirationRatification,
      productionAllowed: false,
    },
    counts,
  };
}

export function evaluateTemporaryRiskAuditEvidence(input) {
  invariant(isObject(input), "TEMPORARY_RISK_EVIDENCE_INVALID");
  validatePolicy(input.policy, input.scope, input.applicationEnvironment, input.now);
  validateManifestAndLock(input.policy, input.manifest, input.lockfile);

  const audit = parseExecution(input.auditExecution, "TEMPORARY_RISK_AUDIT", [0, 1]);
  const installedTree = parseExecution(
    input.installedTreeExecution,
    "TEMPORARY_RISK_INSTALLED_TREE",
    [0],
  );
  const runtimeTree = parseExecution(
    input.runtimeTreeExecution,
    "TEMPORARY_RISK_RUNTIME_TREE",
    [0, 1],
  );
  validateInstalledAndRuntimeTrees(input.policy, installedTree, runtimeTree);

  return {
    riskId: input.policy.riskId,
    scope: input.scope,
    applicationEnvironment: input.applicationEnvironment,
    evaluatedAt: input.now.toISOString(),
    productionAllowed: false,
    ...validateAcceptedFinding(input.policy, audit, input.auditExecution.exitCode),
  };
}

export function assertProductionPromotionBlocked(policy) {
  invariant(isObject(policy), "TEMPORARY_RISK_POLICY_INVALID");
  invariant(
    policy.status === "REMEDIATED" && policy.productionAllowed === true,
    "LES_SEC_RA_001_PRODUCTION_HARD_STOP_ACTIVE",
  );
  return { productionPromotion: "ALLOWED" };
}
