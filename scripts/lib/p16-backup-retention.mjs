function isoWeekKey(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((value.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const BACKUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeTimestamp(value, failureCode) {
  const serialized = value instanceof Date ? value.toISOString() : value;
  invariant(typeof serialized === "string" && UTC_TIMESTAMP_PATTERN.test(serialized), failureCode);
  const date = new Date(serialized);
  invariant(!Number.isNaN(date.getTime()) && date.toISOString() === serialized, failureCode);
  return date;
}

function selectNewestPerBucket(entries, key, limit, tier, reasons) {
  const buckets = new Set();
  for (const entry of entries) {
    const bucket = key(entry.createdAt);
    if (buckets.has(bucket)) continue;
    buckets.add(bucket);
    const entryReasons = reasons.get(entry.id) ?? [];
    entryReasons.push(`${tier}:${bucket}`);
    reasons.set(entry.id, entryReasons);
    if (buckets.size === limit) break;
  }
}

export function planBackupRetention(backups, options = {}) {
  invariant(Array.isArray(backups), "P16_RETENTION_INDEX_INVALID");
  const now = normalizeTimestamp(options.now ?? new Date(), "P16_RETENTION_NOW_INVALID");
  const identifiers = new Set();
  const normalized = backups.map((backup) => {
    invariant(backup && typeof backup === "object", "P16_RETENTION_ENTRY_INVALID");
    invariant(BACKUP_ID_PATTERN.test(backup.id ?? ""), "P16_RETENTION_BACKUP_ID_INVALID");
    invariant(!identifiers.has(backup.id), "P16_RETENTION_DUPLICATE_BACKUP_ID");
    identifiers.add(backup.id);
    const createdAt = normalizeTimestamp(backup.createdAt, "P16_RETENTION_CREATED_AT_INVALID");
    invariant(createdAt.getTime() <= now.getTime(), "P16_RETENTION_FUTURE_BACKUP_REFUSED");
    return { id: backup.id, createdAt };
  });

  normalized.sort(
    (left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id, "en"),
  );

  const reasons = new Map();
  selectNewestPerBucket(normalized, (date) => date.toISOString().slice(0, 10), 7, "daily", reasons);
  selectNewestPerBucket(normalized, isoWeekKey, 4, "weekly", reasons);
  selectNewestPerBucket(
    normalized,
    (date) => date.toISOString().slice(0, 7),
    3,
    "monthly",
    reasons,
  );

  return Object.freeze({
    mode: "PLAN_ONLY",
    evaluatedAt: now.toISOString(),
    policy: Object.freeze({ daily: 7, weekly: 4, monthly: 3, timezone: "UTC" }),
    keep: Object.freeze(
      normalized
        .filter((entry) => reasons.has(entry.id))
        .map((entry) =>
          Object.freeze({
            id: entry.id,
            createdAt: entry.createdAt.toISOString(),
            reasons: Object.freeze(reasons.get(entry.id)),
          }),
        ),
    ),
    notRetained: Object.freeze(
      normalized
        .filter((entry) => !reasons.has(entry.id))
        .map((entry) => Object.freeze({ id: entry.id, createdAt: entry.createdAt.toISOString() })),
    ),
  });
}
