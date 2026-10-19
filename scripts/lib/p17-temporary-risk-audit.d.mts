export interface CommandEvidence {
  exitCode: number;
  stdout: string;
  stderr?: string;
  operationalFailure?: string;
  timedOut?: boolean;
  signal?: string;
}

export interface TemporaryRiskAuditInput {
  policy: Record<string, unknown>;
  scope: string;
  applicationEnvironment: string;
  now: Date;
  manifest: Record<string, unknown>;
  lockfile: Record<string, unknown>;
  auditExecution: CommandEvidence;
  installedTreeExecution: CommandEvidence;
  runtimeTreeExecution: CommandEvidence;
}

export class TemporaryRiskAuditError extends Error {
  code: string;
}

export function evaluateTemporaryRiskAuditEvidence(input: TemporaryRiskAuditInput): {
  riskId: string;
  scope: string;
  applicationEnvironment: string;
  evaluatedAt: string;
  productionAllowed: false;
  classification: "PASS" | "TEMPORARY_ACCEPTED_RISK";
  acceptedRisk: Record<string, unknown> | null;
  counts: Record<string, number>;
};

export function assertProductionPromotionBlocked(policy: Record<string, unknown>): {
  productionPromotion: "ALLOWED";
};
