export class P18PromotionGateError extends Error {
  constructor(code) {
    super(code);
    this.name = "P18PromotionGateError";
    this.code = code;
  }
}

function requireCondition(condition, code) {
  if (!condition) throw new P18PromotionGateError(code);
}

const shaPattern = /^[a-f0-9]{40}$/;

export function assertP18CleanWorktree(execution) {
  requireCondition(
    execution &&
      execution.status === 0 &&
      !execution.error &&
      !execution.signal &&
      typeof execution.stdout === "string" &&
      execution.stdout.trim().length === 0,
    "P18_RELEASE_WORKTREE_NOT_CLEAN",
  );
}
export function assertP18ReleaseIdentity(expected, actual) {
  requireCondition(
    typeof expected === "string" && shaPattern.test(expected),
    "P18_RELEASE_COMMIT_REQUIRED",
  );
  requireCondition(typeof actual === "string" && shaPattern.test(actual), "P18_GIT_HEAD_INVALID");
  requireCondition(expected === actual, "P18_RELEASE_COMMIT_MISMATCH");
  return actual;
}

export function assertP18PromotionEvidence(expectedCommit, gitExecution, auditExecution) {
  requireCondition(
    gitExecution && gitExecution.status === 0 && !gitExecution.error && !gitExecution.signal,
    "P18_GIT_IDENTITY_UNAVAILABLE",
  );

  const commit = assertP18ReleaseIdentity(expectedCommit, gitExecution.stdout?.trim());

  requireCondition(
    auditExecution &&
      auditExecution.status === 0 &&
      !auditExecution.error &&
      !auditExecution.signal,
    "P18_FULL_REMEDIATION_AUDIT_FAILED",
  );

  let result;
  try {
    result = JSON.parse(auditExecution.stdout);
  } catch {
    throw new P18PromotionGateError("P18_FULL_REMEDIATION_AUDIT_OUTPUT_INVALID");
  }

  requireCondition(
    result &&
      result.riskId === "LES-SEC-RA-001" &&
      result.classification === "REMEDIATED_WITH_MAINTAINED_PATCH" &&
      result.patchVersion === "3.0.4-lessenc.1" &&
      result.advisoryId === "GHSA-vfj7-8cjw-p6xm" &&
      result.auditVulnerabilities === 0 &&
      result.runtimeDependencyPresent === false &&
      result.productionHardStop === "CLEARED_FOR_LES_SEC_RA_001_ONLY" &&
      result.productionAuthorityGranted === false,
    "P18_FULL_REMEDIATION_AUDIT_CONTRACT_INVALID",
  );

  return {
    commit,
    riskId: result.riskId,
    hardStop: "CLEARED_FOR_LES_SEC_RA_001_ONLY",
    productionAuthorityGranted: false,
  };
}
