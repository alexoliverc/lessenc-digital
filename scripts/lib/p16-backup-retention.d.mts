type BackupMetadata = Readonly<{ id: string; createdAt: string | Date }>;
type RetentionPlan = Readonly<{
  mode: "PLAN_ONLY";
  evaluatedAt: string;
  policy: Readonly<{ daily: 7; weekly: 4; monthly: 3; timezone: "UTC" }>;
  keep: readonly Readonly<{
    id: string;
    createdAt: string;
    reasons: readonly string[];
  }>[];
  notRetained: readonly Readonly<{ id: string; createdAt: string }>[];
}>;
export function planBackupRetention(
  backups: readonly BackupMetadata[],
  options?: Readonly<{ now?: string | Date }>,
): RetentionPlan;
