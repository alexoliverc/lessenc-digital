# P16-08 — Backup, Restore, RPO/RTO, Retention & Rollback Candidate

**Status:** P16-08 FIXED CANDIDATE / READY FOR INDEPENDENT RE-REVIEW

**Isolated branch:** `phase/p16-08-backup-recovery`

**R1 review baseline:** `fa70d7d3de9833394d6c4af3b99678949edc6b93`

**Recovery objectives:** RPO <= 24 hours; RTO <= 8 hours; 7 daily, 4 weekly and 3 monthly points

**Canonical boundary:** P16-07 is COMPLETE / PASS / DOCUMENTED / HOSTED VALIDATED in the current
P16 baseline. This P16-08 fixed candidate does not reinterpret P16-07 and does not close P16-08.

This document defines the repository-side P16-08 candidate. It does not prove that a hosted backup
has run, that R2 has been exported, that retention has been scheduled, or that a controlled hosted
restore has passed. It authorizes no deploy, provider mutation, live deletion or staging restore.

## Evidence classification

| Capability | Repository/local evidence | Hosted/provider evidence |
| --- | --- | --- |
| database guard and dump process | MariaDB-family preflight and synthetic PASS | real client/provider compatibility NOT EXECUTED |
| encrypted recovery unit v2 | HKDF-separated encryption/authentication and synthetic PASS | NOT EXECUTED |
| manifest verification | canonical HMAC and artifact binding synthetic PASS | NOT EXECUTED |
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
- complete machine-generated dump evidence: start/completion, exact database identity, client
  family/version, TLS CA digest, artifact size/hash and repository-bound release;
- every `prisma/migrations/*/migration.sql` SHA-256 and a canonical migration-set SHA-256;
- R2 relationship `SAME_RECOVERY_POINT`, encrypted storage index and encrypted object artifacts;
- ciphertext and plaintext size/SHA-256 plus AES-256-GCM IV/authentication tag for every artifact;
- TLS, denied public access and encryption-key-separation assertions;
- isolated-restore-only instructions and the accepted recovery target identity.
- an independent-failure-domain requirement whose local status is `NOT_ATTESTED`.

The manifest schema and ordered migration/storage indexes are deterministic. The whole manifest,
including database/storage artifact metadata and key identifier, is canonically serialized and
authenticated with HMAC-SHA-256. HKDF-SHA-256 expands the 32-byte master key into independent,
domain-separated keys using `lessenc:p16:recovery:v2:artifact-encryption` and
`lessenc:p16:recovery:v2:manifest-authentication`. `--key-id` identifies the active key for rotation
without putting key material in the bundle. Verification authenticates the manifest before trusting
any identity or artifact metadata. AES-GCM IVs are random, so ciphertext and hashes differ between
backups. The master key is supplied only through `P16_BACKUP_ENCRYPTION_KEY`. Passwords,
authenticated URLs, tokens, cookies, credentials and private keys are forbidden in the manifest.

The P11 v1 bundle remains frozen. P16 v2 is additive and does not reinterpret old evidence.

## Staging database backup procedure

The database commands require all of the following before starting a process:

- exact `APP_ENV=staging`, `NODE_ENV=production` and `P16_STAGING_ENVIRONMENT_ID=lessenc-staging`;
- the canonical `P16_DATABASE_ACCESS_MODEL`, `P16_DATABASE_MIGRATION_WINDOW=disabled`, matching
  `DATABASE_URL`/`DB_RUNTIME_URL` target identity and exact `P16_DATABASE_EXPECTED_HOST`;
- hosted R2 selection and an absolute, existing, regular, readable, non-symlink `DB_TLS_CA_FILE`;
- `P16_DATABASE_DUMP_CLIENT=mariadb` and a preflighted `mariadb-dump` in the supported MariaDB
  10.11 or 11.x families, with the required TLS and consistent-snapshot options present;
- rejection of loopback aliases and the whole IPv4 127/8 range, including `localhost.`, `[::1]`,
  `127.0.0.2`, and every host different from the exact expected host.

`npm run ops:p16:backup-database` launches `mariadb-dump` with TLS hostname verification,
`--single-transaction`, `--quick`, `--skip-lock-tables`, deterministic primary-key ordering and no
table locks. The MySQL-only `--set-gtid-purged` option is absent. Before the dump, `--version` and
`--help` must prove the client family, supported version and TLS/snapshot capabilities; unknown or
mismatched clients fail closed. The password is passed only as `MYSQL_PWD` in a minimal child
environment; it is absent from arguments and output. Stdout streams into an exclusively-created
mode-0600 partial file. A zero, signaled, spawn, stream, empty-output or evidence-write failure
returns a non-zero generic CLI failure and removes every output created by the failed run. Success
writes adjacent machine evidence as `<dump>.evidence.json`. Local validation does not prove the real
hosted MariaDB binary or endpoint compatibility.

The option-family baseline follows the official
[`mariadb-dump` reference](https://mariadb.com/docs/server/clients-and-utilities/backup-restore-and-import-clients/mariadb-dump);
the executable's own `--help` remains the runtime authority checked by preflight.

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
  --database-evidence "$dumpPath.evidence.json" `
  --storage-root $r2ExportRoot `
  --output-root $bundleRoot `
  --key-id $env:P16_BACKUP_KEY_ID
```

The operator must place the working directory on private encrypted storage with restrictive ACLs,
verify the v2 bundle, securely remove the transient plaintext SQL and R2 export, and record cleanup.
The repository tool cleans its own partial outputs but cannot establish host disk encryption or
Windows ACL policy. It never logs `DB_RUNTIME_URL` or the encryption key.

## Private storage and encryption boundary

The v2 builder consumes an already-created filesystem snapshot of the canonical private R2 data and
the machine dump-evidence file—not operator-supplied timestamps, release, database name or dump
metadata. It uses `lstat` and `realpath` on existing paths and the canonical existing parent for a
new child. It rejects symlinks/junctions in any path component, path escape, overlapping
source/output/restore trees, repository-contained plaintext/export/output paths, non-files and
`.env`, session, PEM, key and certificate files. Each object is independently encrypted with
AES-256-GCM; only a separately encrypted path index is stored. Empty objects are valid and verified.

No new storage authority is introduced. A hosted run still requires a controlled R2 export at the
same recovery point. The application runtime identity remains object-read-only and must not be
silently expanded. If enumeration is required, use a separate, time-bounded, bucket-scoped backup
identity with least privilege, TLS and no public access. Proving provider-side encryption, bucket
policy, key prefix, lifecycle and backup-object privacy is hosted work. Because the source is R2,
an R2-only copy remains in the same relevant provider failure domain and is insufficient. At least
one verified encrypted copy must reside outside that domain. This repair records the requirement;
it does not provision, copy or delete provider objects.

## Integrity verification

`npm run ops:p16:backup-verify` requires the expected backup ID, database name, release commit,
staging environment and current repository migration-set identity. Verification fails closed for:

- unreadable, extra-field or structurally malformed manifests;
- invalid HMAC, wrong master key, wrong key ID or any changed identity/artifact metadata;
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

Pure RPO/RTO calculators compare exact integer milliseconds: target minus 1 ms and the exact target
are PASS; target plus 1 ms is FAIL. No seconds-flooring can accept an overrun.

`npm run ops:p16:measure-rpo` compares raw diagnostic timestamps but always returns hosted status
`UNKNOWN`, even if a caller supplies the string `HOSTED_STAGING`; it may expose only a local
assessment. Future evidence is rejected.

`npm run ops:p16:measure-rto` measures from recovery start through successful recovery validation.
At exactly 8 hours the result is PASS; longer is FAIL; reversed intervals are rejected. Raw/local
input returns hosted status `UNKNOWN`, plus a `localAssessment` proving calculation machinery.

Separate authoritative evaluators accept only strict machine-evidence schemas with the expected
hosted evidence type, scope, automated provenance and successful outcome. A raw/manual scope string
cannot manufacture hosted PASS.

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

Focused tests cover exact remote/staging authority, localhost aliases/IPv6/127/8/unexpected hosts,
CA and source/output symlinks, password/URL omission, MariaDB family/version/TLS capabilities,
atomic dump/evidence success, interrupted cleanup, encrypted bundle creation, zero-byte objects,
manifest secrecy, canonical HMAC, database/storage splice, timestamp/backup/release/database/
artifact/MAC tampering, wrong key/key ID, missing/corrupt artifacts, expected identity mismatch,
live/staging/wrong restore targets, forbidden storage files, retention boundaries, exact RPO/RTO
millisecond boundaries, raw-scope provenance rejection and incompatible rollback.

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
5. at least one verified encrypted copy outside the Cloudflare R2 failure domain, with independent
   inventory and restore-access evidence;
6. persisted v2 HMAC-authenticated manifest and successful independent verification;
7. scheduler history demonstrating a latest verified backup age <= 24 hours;
8. provider inventory plus a reviewed `PLAN_ONLY` result implementing the 7/4/3 union; no deletion
   is required or authorized by this candidate;
9. controlled restore into a new isolated database and storage namespace, never live staging;
10. migration-history/compatibility, database semantic, private-object and application-level
   validation after restore;
11. measured hosted interval from recovery start through successful validation <= 8 hours;
12. approved, schema-compatible application rollback rehearsal or independently acceptable proof,
    with database/data restoration remaining separate;
13. sanitized audit evidence, failure/cleanup records and independent review.

Until then, hosted RPO and RTO are `UNKNOWN`, retention scheduling and provider protection are
unproven. The repair may be labeled **P16-08 FIXED CANDIDATE / READY FOR INDEPENDENT RE-REVIEW**;
P16-08 itself is not complete.

## Repository validation evidence

Validation on the isolated candidate branch produced:

- focused recovery/staging-contract/release-binding suite: 3 files, 85 tests, 85 PASS;
- full `npm run check`: lint PASS with zero warnings, Prisma Client 7.10.0 generation PASS,
  typecheck PASS, 100 test files / 955 tests PASS and format check PASS;
- synthetic production build: PASS, with an ephemeral local-filesystem private-storage directory
  removed after use;
- `npm audit --audit-level=low`: 0 vulnerabilities;
- `git diff --check`: PASS;
- changed-content high-risk secret-pattern scan: PASS.

The build used explicit synthetic overrides for its database, authentication and private-storage
inputs. Next.js reported the existing `.env.local` in its normal environment inventory; that file
was not inspected or altered, and no value from it was printed. The build performed no hosted
database, R2, Hostinger, Mercado Pago or production operation. The evidence above qualifies the
repository candidate for independent review, not P16-08 completion.
