# P16-08 — Backup, Restore, RPO/RTO, Retention & Rollback Candidate

**Status:** P16-08 REPOSITORY CANDIDATE / LOCAL-SYNTHETICALLY VALIDATED / HOSTED EVIDENCE PENDING

**Isolated branch:** `phase/p16-08-backup-recovery`

**Source baseline:** `50601497899d11bd8fc01a4ae51fcb8402fe13c0`

**Recovery objectives:** RPO <= 24 hours; RTO <= 8 hours; 7 daily, 4 weekly and 3 monthly points

**Canonical boundary:** P16-07 is COMPLETE / PASS / DOCUMENTED / HOSTED VALIDATED in the current
P16 baseline. This P16-08 candidate does not reinterpret P16-07, does not provide hosted recovery
evidence and does not close P16-08.

This document defines the repository-side P16-08 candidate. It does not prove that a hosted backup
has run, that R2 has been exported, that retention has been scheduled, or that a controlled hosted
restore has passed. It authorizes no deploy, provider mutation, live deletion or staging restore.

## Evidence classification

| Capability | Repository/local evidence | Hosted/provider evidence |
| --- | --- | --- |
| database guard and dump process | implemented and synthetic PASS | NOT EXECUTED |
| encrypted recovery unit v2 | implemented and synthetic PASS | NOT EXECUTED |
| manifest verification | implemented and synthetic PASS | NOT EXECUTED |
| private-storage export | consumes a synthetic filesystem export | real R2 export NOT EXECUTED |
| retention 7/4/3 | deterministic planner PASS | schedule/lifecycle/delete NOT EXECUTED |
| isolated restore | encrypted artifacts restored to a new local target | physical DB/R2/app exercise NOT EXECUTED |
| RPO <= 24 h | calculation contract PASS | status UNKNOWN — no hosted backup evidence |
| RTO <= 8 h | local timing machinery PASS | status UNKNOWN — no hosted restore evidence |
| application rollback | compatibility planner PASS | deployment/rollback NOT EXECUTED |

## Canonical recovery unit v2

`scripts/lib/p16-recovery.mjs` creates one directory per `backupId`, atomically promoted from a
random partial directory only after complete verification. Its `manifest.json` contains:

- manifest version `2`, backup identity and UTC timestamp;
- source `appEnv=staging` and `environmentId=lessenc-staging`;
- exact 40-character application release commit;
- database name, `SINGLE_TRANSACTION_NO_LOCKS` snapshot mode and encrypted SQL artifact metadata;
- every `prisma/migrations/*/migration.sql` SHA-256 and a canonical migration-set SHA-256;
- R2 relationship `SAME_RECOVERY_POINT`, encrypted storage index and encrypted object artifacts;
- ciphertext and plaintext size/SHA-256 plus AES-256-GCM IV/authentication tag for every artifact;
- TLS, denied public access and encryption-key-separation assertions;
- isolated-restore-only instructions and the accepted recovery target identity.

The manifest schema and ordered migration/storage indexes are deterministic. AES-GCM IVs are
deliberately random, so ciphertext and its hashes are not reproducible across two backups. The
encryption key is supplied only through `P16_BACKUP_ENCRYPTION_KEY` and is never written to the
bundle. Passwords, authenticated URLs, tokens, cookies, credentials and private keys are forbidden
in manifest keys or values.

The P11 v1 bundle remains frozen. P16 v2 is additive and does not reinterpret old evidence.

## Staging database backup procedure

The database commands require all of the following before starting a process:

- exact `APP_ENV=staging`, `NODE_ENV=production` and `P16_STAGING_ENVIRONMENT_ID=lessenc-staging`;
- `P16_DATABASE_MIGRATION_WINDOW=disabled`;
- hosted R2 selection and an absolute `DB_TLS_CA_FILE`;
- an authenticated MySQL `DB_RUNTIME_URL` whose host is not localhost and whose database identity
  contains `stage`/`staging` but no production, live, development, local or test token.

`npm run ops:p16:backup-database` launches `mysqldump` with TLS hostname verification,
`--single-transaction`, `--quick`, `--skip-lock-tables`, deterministic primary-key ordering and no
table locks. The password is passed only as `MYSQL_PWD` in a minimal child environment; it is absent
from arguments and output. Stdout streams into an exclusively-created mode-0600 partial file. A
zero, signaled, spawn, stream or empty-output failure returns a non-zero generic CLI failure and
removes the partial file. Success atomically renames the file and prints only byte count and SHA-256.

Operator example, only after hosted credentials and a private working directory are supplied
outside Git:

```powershell
$privateRoot = 'C:\P16-08-private-work'
$dumpPath = Join-Path $privateRoot 'staging.sql'
$bundleRoot = Join-Path $privateRoot 'bundles'
$r2ExportRoot = Join-Path $privateRoot 'r2-export'

npm run ops:p16:backup-preflight
npm run ops:p16:backup-database -- --output $dumpPath
npm run ops:p16:backup -- `
  --backup-id 'OWNER_ASSIGNED_BACKUP_ID' `
  --created-at 'OWNER_SUPPLIED_UTC_TIMESTAMP' `
  --release-commit 'EXACT_DEPLOYED_RELEASE_SHA' `
  --database-name 'EXACT_STAGING_DATABASE_NAME' `
  --database-dump $dumpPath `
  --storage-root $r2ExportRoot `
  --output-root $bundleRoot
```

The operator must place the working directory on private encrypted storage with restrictive ACLs,
verify the v2 bundle, securely remove the transient plaintext SQL and R2 export, and record cleanup.
The repository tool cleans its own partial outputs but cannot establish host disk encryption or
Windows ACL policy. It never logs `DB_RUNTIME_URL` or the encryption key.

## Private storage and encryption boundary

The v2 builder consumes an already-created filesystem snapshot of the canonical private R2 data. It
recursively rejects symlinks, path escape, non-files and `.env`, session, PEM, key and certificate
files. It encrypts each object independently with AES-256-GCM and stores only a separately encrypted
path index. Empty objects are valid and verified.

No new storage authority is introduced. A hosted run still requires a controlled R2 export at the
same recovery point. The application runtime identity remains object-read-only and must not be
silently expanded. If enumeration is required, use a separate, time-bounded, bucket-scoped backup
identity with least privilege, TLS and no public access. Proving that provider-side encryption,
bucket policy, key prefix, lifecycle and backup-object privacy match this contract is hosted work.

## Integrity verification

`npm run ops:p16:backup-verify` requires the expected backup ID, database name, release commit,
staging environment and current repository migration-set identity. Verification fails closed for:

- unreadable, extra-field or structurally malformed manifests;
- forbidden secret-bearing manifest keys/values;
- unsupported version, malformed UTC timestamp, release or backup identity;
- missing artifact, size mismatch or ciphertext SHA-256 mismatch;
- invalid AES-GCM authentication, plaintext size mismatch or plaintext SHA-256 mismatch;
- database, environment, backup, release or migration-set identity mismatch;
- duplicate, missing, escaped or inconsistent storage-index entries.

Only a completely verified bundle can enter isolated restoration.

## Retention planning

`npm run ops:p16:retention-plan` reads the metadata-only JSON array named by
`P16_BACKUP_INDEX_FILE`. Optional `P16_RETENTION_EVALUATED_AT` freezes evaluation time. Both values
must use exact millisecond UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).

The planner sorts newest-first with backup ID as a stable tie-break, then retains the newest point
per UTC day for 7 distinct days, per ISO week for 4 distinct weeks and per UTC month for 3 distinct
months. The union records every tier reason. Duplicate IDs, malformed IDs/timestamps and future
timestamps fail closed. Empty and small sets are valid. Host timezone and DST cannot change output.

Output mode is always `PLAN_ONLY`; it separates `keep` from `notRetained`. There is no delete
command. `notRetained` is not deletion authority. Live deletion, lifecycle mutation and R2 object
deletion remain prohibited until independently reviewed and explicitly authorized.

## Isolated restore

`npm run ops:p16:restore-isolated` accepts only:

- target environment `lessenc-recovery-test` (fixed internally by the CLI);
- a new, absent absolute target directory outside the bundle;
- database names matching `lessenc_recovery*` or `lessenc_test_recovery*`;
- exact expected source database, backup, release and current migration-set identities.

It verifies every artifact first, decrypts into a random partial directory, verifies plaintext size
and SHA-256, restores the storage tree without path traversal, writes sanitized local evidence and
atomically promotes the target. Failure cleans the partial tree. The evidence is permanently marked
`LOCAL_SYNTHETIC`; it cannot establish hosted RTO PASS.

This harness reconstructs `database.sql` and private-storage files. It does not import into a real
database or run application HTTP/business probes. The hosted closeout must restore into a new
isolated database/storage namespace, reconcile migration history, validate database semantics and
execute application-level probes before recording successful recovery.

## RPO and RTO contracts

`npm run ops:p16:measure-rpo` compares an observation timestamp with the latest independently
verified backup timestamp. At exactly 24 hours the result is PASS; older is FAIL; future evidence is
rejected. Without `--evidence-scope HOSTED_STAGING`, the result is `UNKNOWN / NO_HOSTED_EVIDENCE`.

`npm run ops:p16:measure-rto` measures from recovery start through successful recovery validation.
At exactly 8 hours the result is PASS; longer is FAIL; reversed intervals are rejected. Local
synthetic evidence returns hosted status `UNKNOWN`, plus a `localAssessment` proving calculation
machinery. Only `HOSTED_STAGING` evidence may yield hosted PASS/FAIL.

The scope marker is necessary but not sufficient: the closeout evidence must independently prove
the referenced hosted backup or exercise. Narrative timestamps do not satisfy either gate.

## Application rollback is not database restore

`npm run ops:p16:rollback-plan` only emits `APPLICATION_ROLLBACK_PLAN_ONLY`. It requires staging,
different valid current/target release SHAs, explicit target approval and identical current/target
compatible migration-set hashes. It sets `databaseRestore=false`, `schemaRollback=false` and
`requiresExplicitDeploymentAuthorization=true`.

The planner cannot deploy, reverse a migration or restore data. A schema-incompatible prior release
fails closed. Actual hosted rollback and its health/readiness/payment/storage checks require a
separate deployment authorization.

## Negative evidence covered locally

Focused tests cover remote/staging identity, localhost/production fallback, password/URL omission,
atomic dump success, interrupted dump cleanup, encrypted bundle creation, zero-byte objects,
manifest secrecy, missing/corrupt artifacts, wrong key, environment/database/backup/release/
migration mismatch, malformed manifests, live/staging/wrong restore targets, existing restore
destinations, forbidden storage files, invalid keys, retention duplicates/calendar/DST/malformed/
future input, RPO PASS/FAIL/UNKNOWN, RTO PASS/FAIL/UNKNOWN/local-only behavior, and incompatible
rollback.

OS permission-denial injection is not portable on the Windows validation host and was not claimed.
The code preserves unexpected filesystem errors and the hosted exercise must include denied
read/write identities without destructive injection.

## Exact hosted evidence required to close P16-08

P16-08 remains open until an authorized independent exercise supplies all of the following:

1. deployed release and current migration-set identity;
2. successful guarded dump from the real remote staging database, with sanitized exit/size/hash;
3. same-recovery-point export of the real private R2 namespace;
4. proof of TLS in transit, encrypted private backup storage, denied public access, bucket/prefix
   boundary, separate key custody and cleanup of plaintext temporary data;
5. persisted v2 manifest and successful independent verification;
6. scheduler history demonstrating a latest verified backup age <= 24 hours;
7. provider inventory plus a reviewed `PLAN_ONLY` result implementing the 7/4/3 union; no deletion
   is required or authorized by this candidate;
8. controlled restore into a new isolated database and storage namespace, never live staging;
9. migration-history/compatibility, database semantic, private-object and application-level
   validation after restore;
10. measured hosted interval from recovery start through successful validation <= 8 hours;
11. approved, schema-compatible application rollback rehearsal or independently acceptable proof,
    with database/data restoration remaining separate;
12. sanitized audit evidence, failure/cleanup records and independent review.

Until then, hosted RPO and RTO are `UNKNOWN`, retention scheduling and provider protection are
unproven, and the only allowed final label is **P16-08 REPOSITORY CANDIDATE**.

## Repository validation evidence

Validation on the isolated candidate branch produced:

- focused reference/recovery suite: 3 files, 46 tests, 46 PASS;
- full `npm run check`: lint PASS with zero warnings, Prisma Client 7.10.0 generation PASS,
  typecheck PASS, 100 test files / 925 tests PASS and format check PASS;
- synthetic production build: PASS, with an ephemeral local-filesystem private-storage directory
  removed after use;
- `npm audit --audit-level=low`: 0 vulnerabilities;
- `git diff --check`: PASS;
- staged high-risk secret-pattern scan: PASS.

The build used explicit synthetic overrides for its database, authentication and private-storage
inputs. Next.js reported the existing `.env.local` in its normal environment inventory; that file
was not inspected or altered, and no value from it was printed. The build performed no hosted
database, R2, Hostinger, Mercado Pago or production operation. The evidence above qualifies the
repository candidate for independent review, not P16-08 completion.
