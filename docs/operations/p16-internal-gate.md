# P16 Internal Repository Gate

**Phase:** P16 — Staging Deployment

**Status:** P16 INTERNAL IMPLEMENTATION COMPLETE / REAL DB AND R2 VALIDATED / DEPLOYED AND EXTERNAL OPERATIONS PENDING

**Starting baseline:** `11c4a18e4c2b479ebd8155f8a5397e8820e49513`

## Internal scope delivered

- staging environment/secrets contract and safe `.env.example` reconciliation;
- Node.js 24.x runtime declaration;
- fail-closed staging preflight and `prisma migrate deploy` guard;
- explicit provider-neutral private-storage selection with local filesystem forbidden in hosted
  environments;
- reproducible build/release metadata contract and hosted smoke tooling;
- Mercado Pago TEST-only preflight while preserving P10 financial authority;
- machine-authenticated readiness with no unauthorized dependency probes;
- read-only 7 daily / 4 weekly / 3 monthly retention planning;
- hosted deployment, recovery and rollback runbook.

## Finding disposition

| Finding | Internal result | Remaining evidence |
| --- | --- | --- |
| P16-F01 environment contract drift | REMEDIATED | configure real values outside Git |
| P16-F02 documentation state drift | REMEDIATED | none internally |
| P16-F03 runtime toolchain drift | REMEDIATED | hosted runtime observation |
| P16-F04 staging migration guard missing | REMEDIATED | owner-authorized hosted execution |
| P16-F05 hosted database validation | CODE READY | provider provisioning, TLS and migration proof |
| P16-F06 hosted private-storage adapter | REAL PROVIDER + APPLICATION VALIDATED LOCALLY | deployed/hosted HTTP proof |
| P16-F07 hosted readiness access control | REMEDIATED IN CODE | hosted HTTP proof |
| P16-F08 hosted recovery implementation | PARTIAL / CODE READY | scheduler, encryption, off-site copy and restore drill |
| P16-F09 hosted observability delivery | APPLICATION CONTRACT READY | external monitor, alert destination and status page |
| P16-HDB-F01 migration release binding | REMEDIATED IN FIX01 | hosted migration remains separately authorized and pending |
| P16-HDB-F02 Prisma migration TLS binding | REMEDIATED IN P16-HDB-02 | hosted validation exposed P16-HDB-F03 |
| P16-HDB-F03 explicit Prisma `sslcert` incompatibility | REMEDIATED IN P16-HDB-03 | hosted strict-system-trust revalidation PASS |

## Gate evidence

| Gate | Result |
| --- | --- |
| P16 focused payment/webhook/storage/readiness security | 7 files / 83 tests PASS |
| complete unit/application regression | 91 files / 740 tests PASS |
| isolated P06 MySQL regression | 22 files / 191 tests PASS |
| lint | PASS, zero warnings |
| typecheck + Prisma generate | PASS |
| Prisma validate | PASS |
| global Prettier check | PASS |
| `npm run check` | PASS |
| dependency audit | PASS, 0 vulnerabilities |
| optimized staging build | PASS, Next.js 16.3.4, no real DB connection |
| synthetic staging preflight / migration guard | PASS / PASS; migration not executed |
| missing-configuration negative preflight / guard | expected fail-closed exit 1 / exit 1 |
| environment inventory | 23/23 active variables represented; one intentional `NEXT_PUBLIC_` key |
| secret/private-key scan | PASS; no real credential/private-key evidence |
| Prisma schema and migration diff | unchanged |
| `git diff --check` | PASS |

Local success never represents hosted deployment or provider validation.

## Mandatory stop boundary

No Hostinger change, DNS change, hosted migration, provider provisioning, webhook registration,
real payment, backup deletion, destructive restore, push, PR, merge, tag, release or deployment is
performed by this internal gate.

## P16-HDB-01 additive adaptation

`P16-DB-DECISION-01` records the owner-selected Hostinger Managed MariaDB single-user model. The
repository now supports explicit `distinct-users` and `hostinger-managed-single-user` modes,
requires an enabled migration window only for guarded migration, requires a disabled window for
runtime, and validates runtime grants conservatively through protected readiness.

At the time of P16-HDB-01 this adaptation had not yet connected to Hostinger or proved TLS,
effective privileges, migration success or runtime readiness. Subsequent P16 hosted validation has
since proved database TLS, completed all eight hosted migrations, reconciled effective runtime
privileges and validated the provider-specific privilege constraint.

Database and private-storage provider readiness now have bounded real evidence. Full deployed
application readiness is still not proven because deployed/hosted HTTP and the remaining P16 hosted
operational dependencies remain incomplete. P16 therefore remains incomplete.

`P16-HDB-01-FIX01` makes release binding an independent migration-guard control: the configured
40-hex release commit must equal the current Git `HEAD`, and inability to resolve `HEAD` fails
closed. The fix tests only the guard and does not execute Prisma migration.

FIX01 local evidence: 5 P16-HDB files / 41 tests PASS; complete regression 93 files / 772 tests
PASS; lint, typecheck, formatting, dependency audit and synthetic staging build PASS. MySQL
integration was not repeated because the fix does not change database, Prisma or persistence code.

P16-HDB-02 originally derived the staging Prisma datasource from `DATABASE_URL` and
`DB_TLS_CA_FILE`, forcing explicit `sslcert` and `sslaccept=strict`. Its local proof passed, but
hosted H2-I-D1/H2-I-D2 exposed P16-HDB-F03: every tested explicit `sslcert` representation returned
`P1001`.

P16-HDB-03 supersedes that migration-specific strategy. The staging Prisma datasource now strips
all case-insensitive `sslcert`/`sslaccept` operator parameters, emits exactly one
`sslaccept=strict`, emits no `sslcert`, preserves the no-database generation fallback and relies on
the Prisma/operating-system public trust store.

This does not alter runtime database TLS: `DB_TLS_CA_FILE` and `rejectUnauthorized=true` remain
mandatory for application database access.

P16-HDB-03 final validation evidence:

- complete local quality gate: 94 files / 788 tests PASS;
- Prisma validate: PASS;
- Prisma generate 7.10.0: PASS;
- dependency audit: 0 vulnerabilities;
- Prisma schema, migrations, packages and runtime database client: unchanged;
- secret/hosted-identifier scan: 0 findings;
- real hosted Prisma positive control with canonical hostname: migration-state inspection reached;
- real hosted negative control using the same endpoint by IP: rejected with `P1011` and TLS evidence;
- canonical-hostname positive reconfirmation: migration-state inspection reached;
- synthetic staging production build: PASS;
- local `.env.local` quarantine and restore: PASS;
- `prisma migrate deploy`: NOT EXECUTED;
- database mutation: NOT PERFORMED.

P16-HDB-02 local evidence: 6 focused files / 53 tests PASS; complete regression 94 files / 784
tests PASS; staging-config Prisma validate/generate, lint, typecheck, formatting, dependency audit
and synthetic staging build PASS. No database connection or migration was executed.

## P16-H2-M1 — Hosted database privilege reconciliation

Hosted execution completed the Hostinger database migration and post-migration privilege analysis.

Evidence established:

- all 8 repository migrations applied successfully;
- subsequent Prisma migration status reported the hosted schema up to date;
- migration window returned to `disabled`;
- runtime connectivity and authentication passed through the MariaDB driver;
- Prisma migration-state inspection passed under the same locked runtime credential;
- effective global privilege is `USAGE` only;
- required schema privileges `SELECT`, `INSERT`, `UPDATE`, `DELETE` are present;
- `ALL PRIVILEGES` is absent;
- `GRANT OPTION` is absent;
- Hostinger retains `DELETE HISTORY` and `SHOW CREATE ROUTINE` as provider-managed extras;
- hPanel does not expose individual controls for those two extras;
- real hosted inspection found zero system-versioned tables and zero stored routines.

H2-M1B reconciles runtime readiness with that provider constraint without weakening the generic
database-security contract. `distinct-users` remains restricted to the four required DML
privileges. `hostinger-managed-single-user` additionally permits only the two observed
provider-managed extras and fails closed if either corresponding target surface becomes present.

Focused validation after remediation:

- 4 test files passed;
- 42 tests passed;
- TypeScript typecheck passed;
- ESLint passed;
- `git diff --check` passed;
- code/test scope remained exactly four files before this documentation reconciliation.

Application deployment remains NOT EXECUTED. P16 remains incomplete because deployed/hosted HTTP
and the remaining hosted operational validation are still pending.

<!-- P16-H3-B1-INTERNAL-GATE -->

## P16-H3-B1 — Hosted private-storage provider freeze

Cloudflare R2 Standard is owner approved as the physical hosted private-storage provider for P16.

Frozen controls:

- application contract remains `PrivateResourceStorage`;
- infrastructure adapter will be `S3CompatiblePrivateResourceStorage`;
- Cloudflare integration will use `@aws-sdk/client-s3`;
- bucket remains private;
- runtime uses a dedicated L'Essenc bucket-scoped `Object Read only` credential;
- administrative/upload credentials remain separate;
- Smith Sterling bucket/token/credentials are not reusable;
- protected buyer delivery remains backend-proxied;
- direct/public/presigned buyer access is forbidden for P16;
- readiness will use read-only `HeadObject` against `_health/p16-readiness`.

H3-B1 performs documentation freeze only.

At H3-B1, adapter implementation, environment schema, SDK installation, external bucket/token
provisioning, sentinel creation and hosted proof were still pending. H3-C/H3-D later completed and
synthetically validated the application paths; H3-E then supplied bounded real-provider and local
application evidence.

P16 remains incomplete and application deployment remains NOT EXECUTED.

<!-- P16-H3-C-B-R2-ADAPTER-IMPLEMENTATION-FREEZE -->

## P16-H3-C-B — R2 adapter implementation freeze

Status:

`DESIGN FROZEN / IMPLEMENTATION NOT STARTED`

Frozen H3-C acceptance boundary:

- `PrivateResourceStorage` application contract unchanged;
- shared logical storage-key validation;
- `HeadObject` implements `stat()`;
- `GetObject` implements `open()`;
- AWS SDK types stay inside infrastructure;
- streamed body remains `AsyncIterable<Uint8Array>`;
- no whole-object buffering;
- ETag/IfMatch protects the HeadObject -> GetObject transition when ETag is available;
- known missing object -> `RESOURCE_NOT_FOUND`;
- infrastructure/provider failures -> `STORAGE_UNAVAILABLE`;
- hosted resolution remains lazy;
- local filesystem remains prohibited in hosted authority;
- no Put/Delete/List/bucket administration;
- no presigned or public object delivery;
- H3-C does not make hosted readiness READY.

At this design-freeze gate, SDK installation, code implementation, synthetic adapter tests,
Cloudflare credentials and real provider access were pending. The implementation and synthetic
tests were later completed by H3-C/H3-D; bounded real-provider and local application evidence was
later supplied by H3-E.

<!-- P16-H3-C-D2-R2-ADAPTER-IMPLEMENTATION-CLOSEOUT -->

## P16-H3-C — Hosted private-resource adapter current state

Status:

`IMPLEMENTED / SYNTHETICALLY VALIDATED / REAL PROVIDER VALIDATED LOCALLY`

Verified:

- `@aws-sdk/client-s3@3.1136.0` installed exactly;
- shared provider-independent storage-key validation implemented;
- local adapter consumes shared storage-key validation;
- `S3CompatiblePrivateResourceStorage` implemented;
- `HeadObject` implements `stat()`;
- `GetObject` implements incremental `open()`;
- ETag -> `IfMatch` consistency guard implemented;
- missing object normalization implemented;
- provider/infrastructure failure normalization implemented;
- raw provider failure detail remains private;
- configured hosted resolver implemented;
- hosted resolution remains lazy;
- adapter reused across `stat()` -> `open()`;
- local filesystem remains forbidden as staging/production authority;
- AWS/S3 types remain inside infrastructure;
- application `PrivateResourceStorage` contract unchanged;
- no write/delete/list/bucket administration;
- no public or presigned object delivery;
- no whole-object buffering;
- focused H3-C tests: 49 passing;
- full repository tests: 841 passing across 96 files;
- dependency audit: zero vulnerabilities.

Completed after H3-C through H3-D/H3-E:

- real Cloudflare R2 provisioning and separated credential configuration;
- private sentinel creation;
- direct provider validation;
- real application-level H3-C/H3-D validation;
- local in-process authenticated readiness HTTP validation.

Still pending:

- deployed/hosted HTTP validation;
- staging deployment;
- final P16 operational evidence.

H3-C does not authorize a staging deploy by itself.

<!-- P16-H3-D-R2-PRIVATE-READINESS-SENTINEL -->

## P16-H3-D — Private readiness sentinel current state

Status:

`IMPLEMENTED / SYNTHETICALLY VALIDATED / REAL PROVIDER VALIDATED LOCALLY`

Verified in code:

- hosted readiness resolves a dedicated infrastructure metadata probe;
- the probe has only `check()` and issues `HeadObject` for `_health/p16-readiness`;
- no `GetObject`, content download, write, delete, list or bucket operation exists in the probe;
- any configuration/provider/sentinel failure fails closed through
  `STORAGE_ROOT_UNAVAILABLE`;
- public readiness and structured logs disclose no provider-private detail;
- readiness authentication still rejects before dependency probes;
- local/test behavior remains available;
- local filesystem remains forbidden as staging/production storage authority;
- the H3-C buyer delivery contract and storage-key parser remain unchanged.

Synthetic focused evidence: 88 tests passing across 10 files. Full quality evidence: 854 tests
passing across 97 files, lint/typecheck/formatting/build passing and zero production dependency
vulnerabilities. Subsequent H3-E evidence verified the real sentinel through the production H3-D
factory and the authenticated local readiness path. Deployed/hosted HTTP remains pending. P16
remains incomplete and deployment is not authorized by H3-D.

<!-- P16-H3-E-REAL-R2-EVIDENCE-CLOSEOUT -->

## P16-H3-E — Real-provider evidence closeout

Status:

`H3-E-A COMPLETE / H3-E-B COMPLETE / H3-E-C COMPLETE / DEPLOYMENT PENDING`

H3-E-A passed pre-provisioning only. It froze the intended staging bucket name
`lessenc-digital-staging-private`, default jurisdiction, Automatic location, Standard storage
class, privacy requirements, separate runtime/operational credential roles and the later
provisioning/validation procedure. No real Cloudflare/R2 provider contact occurred during H3-E-A:
it created no bucket or object, used no real credential and validated no provider access. The real
bucket and object state were established and reconciled only by the subsequent H3-E-B sequence.
The following three exposure facts are OWNER-CONFIRMED Cloudflare dashboard evidence, not
independent API/provider proof: the resulting bucket is private, its public `r2.dev` URL is
disabled and it has no custom domain.

The initial H3-E-B attempt failed closed at `SECURE_INPUT / FAIL`. Remote state was classified as
unknown; provisioning was not repeated blindly and absent evidence was not converted into an
assumption of provider state.

H3-E-B-R1 used the runtime read-only credential only. The operational credential was not requested.
The controlled validation object and sentinel were both `PRESENT_AND_EXACT`, and remote state was
`FULLY_PROVISIONED`. There was no write, delete, list or presigning, and the repository remained
byte-identical.

H3-E-B-R2 proved distinct runtime and operational credential identities. Runtime real read access
passed, its conditional write was rejected with `403 / AccessDenied`, and the operational
identity's conditional write reached `412 / PreconditionFailed`. The false conditional barrier
prevented effective mutation; both objects remained exact. No delete, list or presigning occurred,
real-provider validation passed and the repository remained byte-identical.

The runtime identity is bucket-scoped `Object Read only`, with proven real read and denied effective
write. The separate operational identity is bucket-scoped `Object Read & Write` and is not runtime
configuration. Application runtime remains backend-proxied and limited to `HeadObject` and
`GetObject`, without application `PutObject`, `DeleteObject`, `ListObjects` or presigning.

H3-E-C validated the real R2 configuration through the canonical parser under `APP_ENV=staging`,
hosted driver, `r2` provider, `auto` region and the exact sentinel key. The production H3-D factory
used real R2 `HeadObject`, made no sentinel `GetObject` and reported `PRIVATE_STORAGE` ready.
`runReadinessProbe()` combined real R2 with a synthetically isolated database and returned global
`READY`.

The production H3-C construction path used `createConfiguredPrivateFileStorage()`,
`ConfiguredPrivateFileStorage` and `S3CompatiblePrivateResourceStorage`. `stat()` performed real
`HeadObject`; `open()` performed streaming real `GetObject`; the ETag/IfMatch consistency path and
controlled body passed. The buyer-content key policy rejected `_health/p16-readiness`.

Local in-process HTTP evidence returned `200 / {"status":"ready"}` when authorized and
`404 / {"status":"not_found"}` when unauthorized. The unauthorized request caused zero provider
access, proving authentication before provider probing. Output remained sanitized; a synthetic
provider failure exposed only `not_ready`, and the captured credential-output leak check passed.

Exact H3-E-C real operations were three sentinel `HeadObject` calls, one controlled-object
`HeadObject` and one controlled-object streaming `GetObject`. There was no write, delete, list,
presigned URL or sentinel-body read.

Two intentional infrastructure objects exist: `_health/p16-readiness`, the zero-byte operational
sentinel, and `validation/p16-h3e-readonly.txt`, the controlled staging validation object. Neither
is buyer/product content.

Evidence classification remains strict:

- earlier H3-C/H3-D tests: synthetic validation;
- H3-E-B: direct real-provider validation;
- H3-E-C application paths: real application-level provider validation;
- H3-E-C HTTP path: local in-process HTTP validation;
- deployed/hosted HTTP: not yet validated;
- production: not validated.

Application deployment has not been executed. P16 remains incomplete.
