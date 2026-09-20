type BackupMetadata = Readonly<{ id: string; createdAt: string | Date }>;
type RetentionPlan = Readonly<{
  keep: readonly string[];
  deleteCandidates: readonly string[];
}>;
export function planBackupRetention(backups: readonly BackupMetadata[]): RetentionPlan;
