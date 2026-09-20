function isoWeekKey(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((value.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function selectNewestPerBucket(entries, key, limit) {
  const selected = [];
  const buckets = new Set();
  for (const entry of entries) {
    const bucket = key(entry.createdAt);
    if (buckets.has(bucket)) continue;
    buckets.add(bucket);
    selected.push(entry.id);
    if (selected.length === limit) break;
  }
  return selected;
}

export function planBackupRetention(backups) {
  const normalized = backups
    .map((backup) => ({ id: backup.id, createdAt: new Date(backup.createdAt) }))
    .filter((backup) => backup.id && !Number.isNaN(backup.createdAt.getTime()))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  const keep = new Set([
    ...selectNewestPerBucket(normalized, (date) => date.toISOString().slice(0, 10), 7),
    ...selectNewestPerBucket(normalized, isoWeekKey, 4),
    ...selectNewestPerBucket(normalized, (date) => date.toISOString().slice(0, 7), 3),
  ]);

  return Object.freeze({
    keep: Object.freeze(normalized.filter((entry) => keep.has(entry.id)).map((entry) => entry.id)),
    deleteCandidates: Object.freeze(
      normalized.filter((entry) => !keep.has(entry.id)).map((entry) => entry.id),
    ),
  });
}
