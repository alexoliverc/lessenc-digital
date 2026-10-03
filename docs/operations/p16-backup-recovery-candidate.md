# P16-08 — Backup, Restore, RPO/RTO, Retention & Rollback Candidate

**Status:** P16-08 COMPLETE / REMEDIATED / INDEPENDENT AUDIT PASS

**Canonical branch:** `phase/p16-staging-deployment`

**Integrated implementation release:** `45b45e7fc21c919e97f3ef8f84785888e5e32aa4`

**R1 review baseline:** `fa70d7d3de9833394d6c4af3b99678949edc6b93`

**Operational hosted release:** `976a0472382abc0597996366db63c981b5733d6e`

**Independent-audit starting HEAD:** `0f6be4a5286db54475a39f0f64010c7ba3540739`

**Recovery objectives:** RPO <= 24 hours; RTO <= 8 hours; 7 daily, 4 weekly and 3 monthly points

**Canonical boundary:** P16-07 is COMPLETE / PASS / DOCUMENTED / HOSTED VALIDATED in the current
P16 baseline. P16-08 closed on operational release `976a0472382abc0597996366db63c981b5733d6e`;
the later local audit remediation does not redefine that hosted release or authorize publication.

This document defines the repository-side P16-08 contract and preserves the dated partial exercises
as historical evidence. The 27/09/2026 mechanism exercise did not close P16-08; the final hosted
closeout on 03/10/2026 and the independent audit below supersede its status conclusions. No section
authorizes live deletion, restore over primary staging, phase-branch publication or P16-09.

## Evidence classification

| Capability | Repository/local evidence | Hosted/provider evidence |
| --- | --- | --- |
| database guard and dump process | MariaDB-family preflight, release binding and adversarial tests PASS | final controller evidence validates isolated database restore; primary was not restored or mutated |
| encrypted recovery unit v2 | HKDF-separated encryption/authentication, HMAC and artifact binding PASS | provider-scheduled verified encrypted bundles exist; private artifacts are not exposed by the API |
| private-storage export | paginated read-only snapshot and integrity tests PASS | two objects restored in the isolated recovery boundary; source remained unchanged |
| off-R2 copy | provider-boundary contract | earlier private Google Drive mechanism bundle only; final hosted point has no independently proved off-R2 copy |
| retention 7/4/3 | deterministic `PLAN_ONLY` planner and serialized index update PASS | no deletion or lifecycle mutation; `notRetained` remains non-authoritative |
| isolated restore | exact local reconstruction remains `LOCAL_SYNTHETIC` | controller evidence validates isolated MariaDB/R2 restore, runtime grants, readiness and smoke |
| RPO <= 24 h | authoritative evaluator now requires explicit independent provider-history attestation | 01:17 event PASS at 966 ms from preserved correlated evidence; 13:17 event real but individual RPO remains pending |
| RTO <= 8 h | exact millisecond and strict provenance contracts PASS | controller-measured isolated recovery PASS at 540395 ms |
| application rollback | compatible planner remains non-mutating | recovery-only rollback to `2580994...` and roll-forward to `976a047...` demonstrated; primary preserved |

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

The authoritative RTO evaluator accepts exactly two strict machine-evidence schemas. The existing
`AUTOMATED_RECOVERY_RUN` schema remains unchanged. The additive
`CONTROLLED_OPERATOR_ASSISTED_RECOVERY_RUN` schema exists for the approved Hostinger managed
single-user model, where the recovery controller must coordinate an external provider privilege
transition. A raw/manual scope or provenance string cannot manufacture hosted PASS.

The scope marker is necessary but not sufficient: the closeout evidence must independently prove
the referenced hosted backup or exercise. Narrative timestamps do not satisfy either gate.

### Controlled operator-assisted RTO evidence

The assisted schema is exact and fail-closed. It contains these 14 fields and no others:

| Field | Required value or authority |
| --- | --- |
| `evidenceType` | `P16_HOSTED_RECOVERY_VALIDATION` |
| `evidenceScope` | `HOSTED_STAGING` |
| `provenance` | `CONTROLLED_OPERATOR_ASSISTED_RECOVERY_RUN` |
| `validationOutcome` | `VALIDATED` |
| `recoveryStartedAt` | exact-millisecond UTC generated by the recovery controller immediately before the first mutating recovery operation |
| `recoveryValidatedAt` | exact-millisecond UTC generated by the recovery controller only after every final validation below passes |
| `timestampAuthority` | `RECOVERY_CONTROLLER` |
| `providerPrivilegeRotationRequired` | `true` |
| `providerPrivilegeRotationMode` | `EXTERNAL_PROVIDER_CONTROL` |
| `databaseRestoreValidation` | `VALIDATED` |
| `r2RestoreValidation` | `VALIDATED` |
| `finalRuntimePrivilegeValidation` | `VALIDATED` |
| `authenticatedHostedReadiness` | `PASS` |
| `hostedSmokeValidation` | `PASS` |

The operator may authorize or perform the bounded control-plane transition but never supplies,
edits or confirms either RTO timestamp. The controller captures `recoveryStartedAt`, invokes the
first mutating recovery operation and captures `recoveryValidatedAt` only after database restore,
R2 restore, the canonical final runtime-grant verifier, authenticated hosted readiness and hosted
smoke all succeed. Missing, additional or non-canonical fields fail closed. The exact boundary
remains `<= 28,800,000 ms`; `28,800,001 ms` fails.

The automated schema remains exactly the original six fields: `evidenceType`, `evidenceScope`,
`provenance=AUTOMATED_RECOVERY_RUN`, `validationOutcome`, `recoveryStartedAt` and
`recoveryValidatedAt`. Assisted-only fields are rejected if added to an automated record.

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

## Hosted recovery exercise — 27/09/2026

The canonical branch and deployed Hostinger build resolved to
`45b45e7fc21c919e97f3ef8f84785888e5e32aa4`. The current migration-set SHA-256 was
`aea9e926e4910ccccf2e254465a5078b3eac0fcb2ed7a33aeab8a15dddce4567`. Public health returned
`200 / {"status":"ok"}` with `Cache-Control: no-store`; the public home route returned 200.
Unauthenticated readiness remained fail-closed as 404/no-store.

The owner-created real MariaDB dump `p16-08-20260927T222851383Z` remains mechanism evidence only.
It used MariaDB 11.8.6 against the hosted MariaDB 11.8.9 service over verified TLS, completed in
10,078 ms, produced 54,580 bytes and SHA-256
`5a1c2931629fe08d8c92eaca6b3e541c4d7c09eafc69fe84b87498713b35726a`, and recorded
`SINGLE_TRANSACTION_NO_LOCKS`, `TLS_VERIFIED` and the deployed release. Because its plaintext was
created on an unencrypted C: volume, it is explicitly excluded from the final closeout point.

A new empty work root was created outside Git with Windows EFS and an inheritance-disabled ACL
granting only the current Windows owner and SYSTEM. BitLocker/VHDX was not available without an
elevated administrator token, so EFS was used as the least-impact Windows encryption equivalent and
verified with an encrypted child probe before any provider payload was written.

The real source R2 namespace was exported read-only into that EFS root. Before/after inventory
remained exactly two objects and 22 total bytes. Local MD5 values matched the provider ETags, local
SHA-256 values were independently recorded, and both source objects retained their original
21/09/2026 last-modified timestamps. The source bucket retained disabled `r2.dev`, zero custom
domains and no source-object mutation.

The canonical CLI then created and independently verified a real-data **non-final mechanism
bundle** for the earlier dump. The manifest is version 2 and HMAC-SHA256 authenticated under key ID
`p16-08-mechanism-20260927-k1`; its five files total 60,572 bytes. The 32-byte master key was never
printed or placed in the bundle: it is held separately as a Windows DPAPI CurrentUser blob under an
owner/SYSTEM-only ACL. Canonical isolated restore produced exact database and storage hashes, was
classified `LOCAL_SYNTHETIC`, and measured 47 ms. Its restored plaintext directory was deleted
after validation.

Only the already-encrypted bundle was archived for the independent copy. The ZIP contains no
plaintext `.sql`, is 58,145 bytes and has SHA-256
`e61d027a5af337d083b2e3ec0caf7ca9ef682dde5f4c3ec6514596209d6a2cdf`. It was uploaded to a private,
not-shared Google Drive folder outside the Cloudflare failure domain. Provider inventory reported
the exact byte count and download capability; a full download round-trip reproduced the exact
SHA-256.

Storage restoration was also exercised against the new isolated R2 bucket
`lessenc-digital-recovery-test-p1608`. Both restored objects have the exact source sizes, ETags and
contents. The target has disabled `r2.dev` and zero custom domains; the staging source inventory
remained unchanged. No R2 delete or sync operation occurred, and the isolated target remains for
audit.

The retention planner ran in `PLAN_ONLY` for the one verified database point and preserved the
approved 7 daily / 4 weekly / 3 monthly UTC policy with one `keep` and zero `notRetained`. This
proves planner execution, not historical retention coverage. Eight existing Hostinger cron entries
were audited: their script names and outputs did not reference the L'Essenc staging database,
bucket or workload, so they are not accepted as P16-08 scheduler evidence. The raw RPO calculator
reported an age of 1,919,267 ms and local assessment PASS, but correctly retained hosted status
`UNKNOWN` because no authoritative automated observation exists.

The rollback planner accepted current release `45b45e7` and prior release `a6959bb` because their
migration sets are identical and emitted `APPLICATION_ROLLBACK_PLAN_ONLY`, with database restore
and schema rollback both false. No hosted deploy or rollback occurred.

The remaining blocker is exact: the current process, repository files, authenticated Hostinger
environment-variable API and surviving same-user processes expose no usable `DATABASE_URL` or
`DB_RUNTIME_URL`; Hostinger masks stored values. Resetting the live staging user's password cannot
be made safe because the API requires a full environment replacement whose other values are also
masked. Consequently the mandated new dump under encrypted working storage, isolated hosted
MariaDB import, migration/semantic checks, temporary recovery application, authoritative RPO/RTO
and hosted rollback rehearsal remain unproven. Creating a separate isolated Hostinger database is
also a provider write that requires the Hostinger connector's immediate write confirmation.

### Hosted RTO provenance reconciliation — 30/09/2026

A later isolated-target capability check established the provider constraint that governs Attempt
#2. The Hostinger Managed MariaDB identity can temporarily hold restore-time privileges, but the
sanitized result is `GRANTABLE_PRIVILEGE_COUNT=0` and
`SELF_PRIVILEGE_ROTATION=NOT AVAILABLE`. The same managed identity therefore cannot revoke its own
restore-time privileges after physical recovery. This is consistent with the already-approved
`hostinger-managed-single-user` architecture and its absence of `GRANT OPTION`; it does not justify
grant expansion or a weaker runtime verifier.

The required transition is external through the Hostinger control plane. For that provider model,
an otherwise complete hosted run may use
`CONTROLLED_OPERATOR_ASSISTED_RECOVERY_RUN`, but only under the exact controller-generated evidence
contract above. This reconciliation does not represent a recovery execution, does not relabel any
manual timestamp and did not establish RTO PASS. At that 30/09 checkpoint, a fresh hosted Attempt
#2 was still required, authoritative hosted RTO remained `UNKNOWN` and P16-08 was not complete. The
final 03/10 closeout below supersedes that then-current status without rewriting its evidence.

## Exact hosted evidence required to close P16-08

At that pre-closeout checkpoint, P16-08 remained open until an authorized independent exercise
supplied all of the following:

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
    validation after restore, including final canonical runtime-grant verification after the
    external provider privilege reduction;
11. controller-measured hosted interval from immediately before the first mutating recovery
    operation through database/R2/grants/authenticated-readiness/smoke validation <= 8 hours;
12. approved, schema-compatible application rollback rehearsal or independently acceptable proof,
    with database/data restoration remaining separate;
13. sanitized audit evidence, failure/cleanup records and independent review.

The 27/09/2026 exercise partially satisfied items 1, 3–6, 8–9 and 12, but none was allowed to mask
the absent new database point or the lack of isolated database/application validation. Hosted RPO
and RTO remain `UNKNOWN`; scheduled coverage, final same-recovery-point protection, physical
MariaDB restore and recovery-application probes remained unproven. The exact status at that
checkpoint was **P16-08 INTEGRATED / PARTIAL HOSTED RECOVERY EVIDENCE / NOT COMPLETE**.

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
database, R2, Hostinger, Mercado Pago or production operation. The later hosted exercise is
recorded separately above and also did not qualify P16-08 for completion at that checkpoint.

Closeout documentation validation on the canonical branch produced:

- focused recovery/retention/staging-contract/release-binding suite: 4 files / 94 tests PASS;
- `APP_ENV=test`, `NODE_ENV=test` full `npm run check`: lint/typecheck/Prisma generate PASS,
  100 test files / 955 tests PASS and format check PASS;
- optimized staging production build: PASS with local P06 database configuration, process-only
  synthetic secrets and an ephemeral EFS private-storage directory removed afterward;
- `npm audit --audit-level=low`: 0 vulnerabilities;
- `git diff --check` and changed-content secret scan: PASS.

An initial `npm run check` invocation without explicit `APP_ENV` was rejected by three test files
because the shell context resolved the application environment as unknown. It was not counted as a
product failure; the complete gate was rerun in the repository's canonical test environment and
passed as recorded above.

The partial closeout was committed as
`e231dd395258dfe7f01d89e4cb0020b381a604ce` (`docs(p16): record partial hosted recovery evidence`)
and pushed by fast-forward to `origin/phase/p16-staging-deployment`. Hostinger automatically built
that exact SHA from 23:25:57Z through 23:27:16Z with state `completed`. Post-deploy read-only probes
confirmed HTTP -> HTTPS 301, home 200, health 200/ok/no-store, unauthenticated readiness
404/no-store, one CSP, HSTS, nosniff, frame deny and no `X-Powered-By`. `main` was not changed.

## Final hosted closeout — 03/10/2026

Release `976a0472382abc0597996366db63c981b5733d6e` corrected hosted execution provenance by
separating `run-manual` from `run-scheduled`. The private provider runner remained scheduled at
01:17 and 13:17 UTC. Independent Hostinger history correlated the 01:17 execution with backup
`p16-hosted-auto-20261003T011702366Z-dde97c087d654185a2cc9d931a8727d4`,
`PROVIDER_SCHEDULED_EXECUTION`, `AUTOMATED_PROVIDER_OBSERVATION` and RPO age 966 ms. This is the
authoritative <= 24 hour RPO PASS.

The 13:17 provider job also executed and emitted a distinct successful backup. Its sanitized Cron
output proves provider execution context, release `976a047...`, backup completion and a distinct
backup ID, but still projects `UNKNOWN / PENDING_PROVIDER_SCHEDULER_CORRELATION`. The private
observation/history timestamps needed to calculate that run's individual RPO age are not exposed by
the Hostinger API. The correct classification is
`DUAL_WINDOW_SECOND_REAL_PROVIDER_EVENT_OBSERVED / AUTHORITATIVE_RPO_CORRELATION_PENDING`; it does
not replace or weaken the already-proved 01:17 RPO PASS.

The controlled isolated recovery produced exact controller-owned evidence spanning the first
mutating recovery action through database/R2 restore, final runtime-grant validation, authenticated
readiness and hosted smoke. Duration was 540395 ms (9 minutes and 00.395 seconds), below the exact
28,800,000 ms objective. No operator-supplied timestamp or local diagnostic was promoted to hosted
proof.

The application rollback rehearsal materialized only recovery release
`2580994f53d419070fd13c485b49dbedc4463334`. Its web surface, Prisma schema/migrations and
dependency resolution were identical to current; only the P16 backup/provenance operations surface
differed. Recovery health/home and primary health/home returned 200. No checkout, payment, webhook,
buyer-access, authenticated-admin or financial mutation was exercised. Roll-forward used the
private rehearsal repository branch `rehearsal-return` at `976a047...`; Hostinger subsequently
built that exact source and recovery health/home returned 200 while primary and scheduler authority
remained unchanged.

Retention remains strictly `PLAN_ONLY` for 7 daily, 4 weekly and 3 monthly points. No backup, R2
object or retention candidate was deleted. The private Google Drive copy proved an independent
failure-domain mechanism for the earlier encrypted mechanism bundle only; this closeout does not
claim an independent off-R2 copy of the final hosted point. Database and R2 capture were sequential,
so `SAME_RECOVERY_POINT` describes one recovery unit, not a cross-system atomic snapshot.

The independent audit dependency scan reports 7 aggregated vulnerable npm nodes: 1 critical, 5 high
and 1 moderate. `next@16.3.4` is the only direct runtime finding and the current npm audit proposes
the non-major patch `16.3.8` (the provider scanner still reports `16.3.6`), but
the repository has zero `next/og` or `ImageResponse` usage. `brace-expansion`, `braces`,
`micromatch` and `fast-glob` are dev-only lint/tooling paths; `fast-uri` is dev-optional Prisma CLI
tooling. No executable path from untrusted application input to those tooling dependencies was
found. A dependency/lockfile update is not necessary to correct the P16-08 recovery defects and
would create a new operational release requiring hosted backup/rollback revalidation, so no
`npm audit fix`, upgrade or provider patch PR was performed. This remains explicit security debt for
a separately governed dependency update and full application plus hosted regression.

### Independent audit and remediation — 03/10/2026

The independent audit did not inherit the earlier PASS. It re-read the implementation, tests,
history, canonical documentation and current read-only provider state, then found and remediated two
repository defects:

- `run-scheduled` already returned `UNKNOWN`, but its six-field observation could still be passed
  directly to `evaluateP16HostedRpoEvidence()` to manufacture a `PASS` without independent provider
  history. Scheduled execution now uses only the non-authoritative diagnostic calculator. The
  authoritative evaluator requires exact execution authority/context, backup identity,
  `AUTHORITATIVE_PROVIDER_SCHEDULER_CORRELATION` and
  `INDEPENDENT_PROVIDER_HISTORY_VERIFIED`; a raw scheduled observation fails closed.
- index-file replacement was atomic, but its read-modify-write interval was not serialized. The
  updater now acquires an exclusive mode-0600 sibling lock before reading and releases only its own
  lock after publication. Contention fails closed as `P16_HOSTED_BACKUP_INDEX_LOCKED`; write failure
  releases the current-run lock. A lock left by process termination is not auto-deleted and requires
  operator inspection, preventing a guessed stale-lock timeout from losing backup history.

Adversarial coverage now also exercises repository/backup-root overlap, malformed backup-ID suffix,
duplicate R2 keys, repeated pagination tokens, streamed-length mismatch cleanup, index/history
publication failure, cleanup failure and lock contention. Current provider/API inspection confirms
primary at `976a047...` from the canonical repository/phase branch and recovery at `976a047...` from
the private rehearsal repository/`rehearsal-return`; both health and home return 200. The two Cron
entries remain `17 1 * * *` and `17 13 * * *` and still project pending correlation in their own
output. Environment values remain masked, so the API proves only key presence, not the value of
`P16_RELEASE_COMMIT`. The private runner file, mode, hash and 11-key scheduler environment are
historical baseline evidence, not current-session API proof.

The remediation is repository-local and not deployed. It preserves the hosted operational evidence
boundary at `976a047...`; publication of this later local HEAD would require coordinated release
binding and a new hosted validation. P16-08 is complete with the limitations above recorded as
residual evidence/security debt. This does not complete P16, authorize a phase-branch push or start
P16-09.
