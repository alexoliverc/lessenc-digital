# P16 Staging Deployment Runbook

**Status:** P16-01–P16-08 COMPLETE / P16-09 REMAINING

This runbook prepares a reproducible staging release without treating repository preparation as a
deployment. No command in this document authorizes Hostinger, DNS, provider, migration, payment,
restore or production actions.

## Canonical staging identity

The staging preflight accepts only this identity:

- `APP_ENV=staging`;
- `NODE_ENV=production`;
- `APP_URL=https://lessenc.com.br`;
- `P16_STAGING_ENVIRONMENT_ID=lessenc-staging`;
- Node.js `24.x` and repository package manager `npm@11.19.1`;
- `P16_RELEASE_COMMIT` equal to the exact checked-out 40-character Git commit.

`APP_ENV` remains independent from `NODE_ENV`. The hostname does not turn staging into production.

## Configuration inventory

| Class | Variables | Rule |
| --- | --- | --- |
| non-secret application identity | `APP_ENV`, `NODE_ENV`, `APP_URL`, `P16_STAGING_ENVIRONMENT_ID`, `P16_RELEASE_COMMIT` | exact staging values; release commit must match `HEAD` |
| migration database secret | `DATABASE_URL` | MySQL hosted staging target; logical migration context |
| runtime database secret | `DB_RUNTIME_URL` | same hosted staging database; logical least-privilege runtime context |
| database trust material | `DB_TLS_CA_FILE` | absolute readable CA path; hostname verification and `rejectUnauthorized=true` remain mandatory |
| database access model | `P16_DATABASE_ACCESS_MODEL` | explicit `distinct-users` or `hostinger-managed-single-user`; never inferred from matching usernames |
| migration window | `P16_DATABASE_MIGRATION_WINDOW` | `disabled` for runtime; command-scoped `enabled` only during an authorized migration window |
| Mercado Pago TEST | `P16_MERCADOPAGO_CREDENTIAL_SET`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `P10_PAYMENT_CONTINUATION_SECRET` | `P16_MERCADOPAGO_CREDENTIAL_SET=test`; credentials must come from the Mercado Pago TEST set; `APP_USR-` validates credential shape only and does not prove sandbox authority; public key is the sole intentionally public credential |
| application secrets | `P09_SUBMISSION_SECRET`, `P11_BUYER_SESSION_SECRET`, `P12_ADMIN_AUTH_SECRET`, `P16_READINESS_TOKEN` | server-only, independently generated, at least 32 characters, never reused |
| product identity | `P08_PRODUCT_ID`, `P08_OFFER_ID` | canonical persisted staging UUIDs |
| private storage | `PRIVATE_STORAGE_DRIVER`, `P16_PRIVATE_STORAGE_PROVIDER`, `PRIVATE_STORAGE_S3_ENDPOINT`, `PRIVATE_STORAGE_S3_REGION`, `PRIVATE_STORAGE_S3_BUCKET`, `PRIVATE_STORAGE_S3_ACCESS_KEY_ID`, `PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY`, `PRIVATE_STORAGE_HEALTHCHECK_KEY` | `hosted` + `r2` in staging; bucket private; runtime credential bucket-scoped `Object Read only`; real secret values remain external |
| optional active analytics | `GTM_CONTAINER_ID` | optional validated GTM identifier; blank keeps browser providers disabled |
| documented but inactive | `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` | no active runtime reads; do not configure as proof of an integration |

No secret may use `NEXT_PUBLIC_`. `.env.example` contains names and fictitious/blank examples only.
The preflight reports failure codes and variable names, never values or complete URLs.

## Repository preflight and build

After the owner configures staging values outside Git:

```powershell
$env:APP_ENV = 'staging'
$env:NODE_ENV = 'production'
$env:APP_URL = 'https://lessenc.com.br'
$env:P16_STAGING_ENVIRONMENT_ID = 'lessenc-staging'
$env:P16_RELEASE_COMMIT = (git rev-parse HEAD)
npm ci
npm run ops:p16:preflight
npm run build
```

The build itself does not connect to MySQL or private storage. The operational preflight does
validate staging identity, runtime metadata, database isolation, TEST payment identity, secret
strength/non-reuse, CA readability, hosted storage selection and exact release commit.

The runtime preflight requires `P16_DATABASE_MIGRATION_WINDOW=disabled`. It does not elevate
privileges and does not connect to the database.

## Database migration

The only staging migration command is:

```powershell
npm run db:migrate:deploy:staging
```

It runs the fail-closed staging guard before `prisma migrate deploy`. The guard rejects local,
test, production, localhost, non-staging database names, mismatched migration/runtime targets,
an access-model mismatch, a disabled migration window, missing CA files and ambiguous application
identity. In `distinct-users`, shared usernames are rejected. In
`hostinger-managed-single-user`, only the same username/credential is accepted. It never prints
either database URL. `prisma migrate reset` and `prisma db push` are not staging procedures.

The migration guard independently executes `git rev-parse HEAD` and requires the result to match
`P16_RELEASE_COMMIT` exactly. Missing, malformed, mismatched or unverifiable release identity stops
the command before Prisma. This control does not depend on an earlier preflight execution.

For staging, operators configure the raw migration identity in `DATABASE_URL`. `DB_TLS_CA_FILE`
remains mandatory for the hosted application runtime and staging safety contract, but Prisma
Migrate does not translate that file into `sslcert`.

`prisma.config.ts` removes every case-insensitive operator-provided `sslcert` and `sslaccept`,
emits exactly one `sslaccept=strict`, emits no `sslcert`, and relies on the
Prisma/operating-system public trust store for migration certificate validation.

A malformed or non-MySQL migration URL fails closed with a value-free error code. Neither the raw
nor effective datasource URL is printed. Runtime database access separately continues to load
`DB_TLS_CA_FILE` with `rejectUnauthorized=true`.

The configuration-only fallback `mysql://127.0.0.1:1/lessenc_unconfigured` remains available when
`DATABASE_URL` is absent, so generate/static operations do not require hosted connectivity. The
approved migration chain remains guard -> Prisma config TLS binding -> `prisma migrate deploy`.

### Hostinger managed single-user migration window

The owner-approved `P16-DB-DECISION-01` compensates for Hostinger's one-user model through
controlled privilege rotation:

1. keep `P16_DATABASE_MIGRATION_WINDOW=disabled` by default;
2. create and verify the pre-migration recovery point;
3. externally grant the Hostinger account the minimum migration privileges required by the pending
   immutable migrations;
4. set the command-scoped signal to `enabled` for the guarded migration process;
5. run `npm run db:migrate:deploy:staging`;
6. externally revoke/reduce CREATE/ALTER/DROP/INDEX and every other migration/administrative grant;
7. restore the signal to `disabled`;
8. run the runtime preflight and protected readiness;
9. capture sanitized evidence that the final grants are safe.

Privilege changes are Hostinger control-plane actions. The repository never attempts to grant or
revoke privileges itself. The isolated recovery target proved
`GRANTABLE_PRIVILEGE_COUNT=0` / `SELF_PRIVILEGE_ROTATION=NOT AVAILABLE`: the managed identity can
hold restore-time privileges but cannot reduce them afterward. Every recovery privilege transition
must therefore be performed through external Hostinger provider control and followed by the
canonical runtime-grant verification.

### Runtime least privilege

The codebase audit proves the normal runtime requires `SELECT`, `INSERT`, `UPDATE` and `DELETE`.
Protected staging readiness executes the read-only statement:

```sql
SHOW GRANTS FOR CURRENT_USER()
```

Under `distinct-users`, it accepts only those four DML privileges on the exact staging schema plus
global `USAGE`.

Under explicit `hostinger-managed-single-user`, hosted evidence permits exactly two provider-managed
extras in addition to the required DML set: `DELETE HISTORY` and `SHOW CREATE ROUTINE`. The readiness
probe compensates by requiring zero `SYSTEM VERSIONED` tables and zero stored routines. Any other
additional privilege, target-surface appearance, broad privilege, foreign scope, global DML,
administrative/DDL grant, role grant or `GRANT OPTION` fails closed.

Neither the readiness response nor application logs include the raw grant statements. Hosted evidence
must separately confirm effective/inherited privileges, including `PUBLIC`, because provider
behavior cannot be proven locally.

Before execution, create and verify an on-demand complete recovery point and confirm application
rollback compatibility with all pending additive migrations. Hosted migration execution remains an
owner/external action.

## Private storage

Cloudflare R2 Standard is the owner-approved hosted private-storage provider for P16.

The application-level `PrivateResourceStorage` contract remains provider-independent and streams
`AsyncIterable<Uint8Array>`.

`LocalPrivateFileStorage` remains restricted to local/test use and cannot become authoritative
storage in staging or production.

The hosted adapter is `S3CompatiblePrivateResourceStorage`, implemented with
`@aws-sdk/client-s3` against the Cloudflare R2 S3-compatible endpoint.

Runtime rules:

- `PRIVATE_STORAGE_DRIVER=hosted`;
- `P16_PRIVATE_STORAGE_PROVIDER=r2`;
- bucket remains private;
- public `r2.dev` access remains disabled;
- no R2 custom public domain is configured for protected delivery;
- browser receives no R2 URL and no `storageKey`;
- presigned buyer URLs are not used in P16;
- application runtime uses a dedicated bucket-scoped Cloudflare `Object Read only` credential;
- provisioning/upload/admin credentials are separate from runtime credentials;
- Smith Sterling credentials or buckets must not be reused.

Adapter behavior:

- `stat(storageKey)` -> `HeadObject`;
- `open(storageKey)` -> `GetObject`;
- hosted readiness -> `HeadObject` for the dedicated private sentinel.

The canonical readiness sentinel key is `_health/p16-readiness`, supplied through
`PRIVATE_STORAGE_HEALTHCHECK_KEY`.

The hosted adapter/readiness implementation must normalize provider failures into the existing
private-storage failure boundary and must not expose endpoint, bucket, key, credentials, account
identifier or raw provider error detail.

Provider approval, adapter/environment implementation, Cloudflare provisioning, sentinel creation,
direct real-provider validation and controlled local validation through the real application paths
are complete. P16-06 later supplied deployed/hosted HTTP readiness evidence through the recurring
authenticated Grafana check. This does not replace P17 protected buyer-delivery validation.
## Protected readiness and hosted smoke

`GET /api/health` remains public and minimal. `GET /api/readiness` requires:

```text
Authorization: Bearer <P16_READINESS_TOKEN>
```

Missing, malformed, weakly configured or incorrect authorization returns generic HTTP 404 with
`Cache-Control: no-store` and does not execute database or storage probes. The token is hashed to a
fixed-length digest before timing-safe comparison. Authorized responses remain sanitized to
`ready` or `not_ready`.

In staging, an authorized readiness request also fails generically when the migration window is
enabled or the final runtime grants are not conservatively verified. It never returns grant text,
database identity, username or topology.

After an authorized deployment, run from an independent failure domain:

```powershell
$env:P16_SMOKE_BASE_URL = 'https://lessenc.com.br'
npm run ops:p16:hosted-smoke
```

The smoke checks public liveness, denial of unauthenticated readiness, authenticated readiness,
no-store and the required hosted security headers. It never prints the readiness token.

For the P16-06 hosted release, the owner-verified PowerShell smoke executed only public health and
unauthenticated readiness: health returned HTTP 200 `{"status":"ok"}`, readiness returned HTTP 404
`{"status":"not_found"}`, and both returned `Cache-Control: no-store`. Authenticated readiness was
not executed from PowerShell in that smoke; the recurring external Grafana check below supplies the
authenticated proof.

## Mercado Pago TEST

The preflight requires `P16_MERCADOPAGO_CREDENTIAL_SET=test` and validates the current `APP_USR-` access/public-key shape. `APP_USR-` is format validation only and does not independently prove sandbox authority. Hosted Mercado Pago TEST validation remains mandatory before P16 closeout. Existing P10 boundaries remain:
authenticated raw-body webhook verification, bounded timestamp tolerance, request-id validation,
duplicate/malformed input rejection, idempotent persistence, replay-safe state transitions,
server-side payment authority, failure isolation and sanitized logging. Hosted validation still
requires owner-provided TEST credentials, registered TEST webhook and controlled TEST transactions.
Production credentials are prohibited in P16.

## Monitoring, alerts and service health

The repository contract creates the canonical monitor plan from the HTTPS staging root. It permits
no base-path, user information, query string or fragment, preventing a readiness token from being
placed in a URL.

The canonical monitored surfaces are:

| Monitor | URL | Authentication | Accepted result |
| --- | --- | --- | --- |
| public liveness | `https://lessenc.com.br/api/health` | none | HTTP 200 and exact `{"status":"ok"}` |
| protected readiness | `https://lessenc.com.br/api/readiness` | `Authorization: Bearer` supplied from provider secret storage | HTTP 200 `ready` or HTTP 503 `not_ready`; unauthenticated HTTP 404 |

The provider secret value must remain exclusively in provider secret storage and server-side
application configuration. Store the reference as `P16_READINESS_TOKEN`; never place its value in
a URL, query string, HTML, browser JavaScript, logs, incident notes or the public status page.

The monitor/alert provider must be independent from the application failure domain. Hosted
validation preserves evidence for:

```text
signal
-> deterministic P15 evaluation
-> firing envelope
-> deduplication
-> destination delivery
-> acknowledgement or bounded delivery evidence
```

The provider-neutral alert envelope contains only the rule ID, sanitized service component,
severity, abstract owner, stable deduplication key, occurrence count and UTC evaluation time. It
contains no credentials, PII, provider payment IDs, database/storage detail or mutation authority.

`OWNER_ON_CALL`, `OPERATIONS`, `COMMERCE_OPERATIONS` and `SECURITY` remain abstract routing
responsibilities. P16-06 proves real e-mail delivery for the controlled Better Stack monitor
incident; it does not claim that every abstract application owner has a separately configured
paging destination.

`status.lessenc.com.br` is the canonical public-status origin. The application retains the sanitized
service-health projection as its canonical public-service model, but the current P16-06 Better Stack
status page does not directly consume that projection. Its single public `Website` resource is backed
by `L'ESSENC Public Liveness`, which monitors `https://lessenc.com.br/api/health`.

P16-06 therefore does not claim a direct service-health-projection-to-Better-Stack integration.
Future public components must be backed by sanitized operational evidence before publication. Raw
protected readiness, failure codes, topology, database/R2 detail, provider IDs, correlations,
secrets and stack traces must never be republished on the public status page.

### P16-06 owner-verified hosted evidence

- Hostinger automatically deployed branch `phase/p16-staging-deployment` at commit
  `5dae89fed133cc9db704c1e6c848cc1ef1e64ccc`; deployment status was `COMPLETED / PASS`.
- Better Stack permanent monitor `L'ESSENC Public Liveness` checks
  `https://lessenc.com.br/api/health` every three minutes, is `UP`, has keyword health validation
  active, sends notifications by e-mail and is linked to one public status page.
- Better Stack test-alert e-mail delivery passed.
- Only that one permanent Better Stack monitor remained after controlled-test cleanup.
- Grafana Cloud Synthetic Monitoring recurring scripted check `lessenc-protected-readiness` runs
  from Calgary against `https://lessenc.com.br/api/readiness`.
- Grafana retrieved secret reference `p16-readiness-token`; application configuration continues to
  use `P16_READINESS_TOKEN`. The value is not documented. Logged authorization was only
  `Bearer ***SECRET_REDACTED***`.
- The observed recurring readiness execution passed secret retrieval, GET, HTTP 200, exact
  `{"status":"ready"}` and `Cache-Control: no-store`; the three assertions were 100% for the
  observed run and recurring execution remained active.
- A temporary Better Stack monitor deliberately checked
  `https://lessenc.com.br/__p16-controlled-alert-probe__`; the expected HTTP 404 created a real
  monitor-detected incident, delivered a separate real monitor-failure e-mail notification and
  received human acknowledgement.
- Changing that temporary monitor to `https://lessenc.com.br/api/health` produced recovery
  detection and automatic incident resolution. The temporary monitor was then deleted.
- No application, database, R2, Mercado Pago, payment, entitlement or production state was
  deliberately broken for the controlled incident.
- `status.lessenc.com.br` is online with HTTPS HTTP 200. DNS is CNAME
  `statuspage.betteruptime.com` with TTL 300, owner-verified through public resolvers `1.1.1.1` and
  `8.8.8.8`.
- The Better Stack status page contains exactly one public resource, `Website`, backed by
  `L'ESSENC Public Liveness`. Do not invent public resources without real backing monitors.

Monitoring is evidence, not authority. It cannot mutate payments, orders, entitlements,
authentication authority, database state, private-storage state or Mercado Pago state. The
staging readiness token visually exposed during P16-06 was replaced in Hostinger and Grafana; the
recurring protected check returned green after reconciliation. The historical finding, safe
rotation boundary and CSP reconciliation are canonical in
[`p16-hosted-security-validation.md`](../security/p16-hosted-security-validation.md).

Hostinger Force HTTPS was disabled because it replaced the application CSP. SSL, CDN, DNS and the
Passenger/Node routing remain preserved; hosted `.htaccess` contains the manual HTTP -> HTTPS 301
redirect but no CSP. Because provider redeploys may regenerate that file, every hosted deployment
must re-prove the redirect. The application remains the sole route-sensitive CSP authority.

## Backup, retention, restore and rollback

The frozen P11/P15 v1 bundle remains historical local evidence. The additive P16-08 v2 repository
candidate is specified by
[`p16-backup-recovery-candidate.md`](./p16-backup-recovery-candidate.md): encrypted database and
private-storage artifacts, exact migration/release/environment identity, integrity verification,
isolated-only restore instructions and explicit evidence scope.

The approved release objectives are RPO <= 24 hours, RTO <= 8 hours and retention of 7 daily, 4
weekly and 3 monthly recovery points. `npm run ops:p16:retention-plan` reads a metadata index from
`P16_BACKUP_INDEX_FILE` and produces a deterministic `PLAN_ONLY` union of `keep` and
`notRetained`. It rejects malformed/future data and never deletes a backup. `notRetained` is not
deletion authority. Provider lifecycle mutation requires independent verification and explicit
authorization.

`npm run ops:p16:backup-preflight`, `ops:p16:backup-database`, `ops:p16:backup`,
`ops:p16:backup-verify`, `ops:p16:restore-isolated`, `ops:p16:measure-rpo`,
`ops:p16:measure-rto` and `ops:p16:rollback-plan` implement the repository contract. Local restore
only reconstructs verified artifacts in a new filesystem target and is marked `LOCAL_SYNTHETIC`.
A hosted restore must target a new isolated database/storage namespace and prove migration history,
database semantics, storage integrity and application behavior. Application rollback changes only
an approved compatible artifact; it is not schema rollback or data restore.

The 27/09/2026 partial hosted exercise remains mechanism history. The final 03/10/2026 closeout used
release `976a047...`, a private runner and the Hostinger schedules `17 1 * * *` and
`17 13 * * *`. The 01:17 provider event was independently correlated to its successful backup,
automated observation and 966 ms RPO age. The 13:17 job also produced a distinct successful backup,
but its individual observation/history timestamps remain unavailable through the provider API and
its RPO projection correctly remains `UNKNOWN / PENDING_PROVIDER_SCHEDULER_CORRELATION`.

`run-scheduled` is only scheduler-compatible input and cannot establish provider authority by
itself. Its observation is deliberately insufficient for `evaluateP16HostedRpoEvidence()`. A caller
must add a separately verified backup identity, scheduled execution authority/context and exact
`AUTHORITATIVE_PROVIDER_SCHEDULER_CORRELATION` /
`INDEPENDENT_PROVIDER_HISTORY_VERIFIED` fields before the evaluator can return PASS or FAIL. Cron
configuration, filename time and manual invocation never satisfy that contract.

The metadata index update uses an exclusive sibling `.lock` across the whole read-modify-write
interval, followed by atomic replacement. Lock contention fails closed and never deletes another
run's lock. If a process terminates while owning the lock, inspect the associated bundle,
observation/history and process state before explicitly removing it; there is no automatic stale
lock timeout and no deletion authority in the retention planner.

Retention remains `PLAN_ONLY` under the 7/4/3 policy and gives no deletion authority. The earlier
private Google Drive round-trip proves only the off-R2 mechanism bundle, not an independent copy of
the final hosted point. Database and R2 capture are sequential and must not be described as an
atomic cross-system snapshot.

For a Hostinger recovery, the controller may emit the strict provenance
`CONTROLLED_OPERATOR_ASSISTED_RECOVERY_RUN`. This is not permission for operator-entered timing.
The controller must create `recoveryStartedAt` immediately before the first mutating recovery
operation. After the external provider privilege reduction, it must prove database restore, R2
restore, `finalRuntimePrivilegeValidation=VALIDATED`, authenticated hosted readiness and hosted
smoke before it creates `recoveryValidatedAt`. The evidence must also declare
`providerPrivilegeRotationRequired=true`,
`providerPrivilegeRotationMode=EXTERNAL_PROVIDER_CONTROL` and
`timestampAuthority=RECOVERY_CONTROLLER`. Missing or additional fields fail closed. The original
`AUTOMATED_RECOVERY_RUN` remains accepted unchanged; raw/manual `measureP16Rto` input remains
`UNKNOWN`.

A controller-generated isolated recovery record now satisfies this reconciled contract. The
measured duration is 540395 ms, below the unchanged <= 28,800,000 ms target. The rehearsal also
proved recovery-only application rollback to `2580994...` and roll-forward to `976a047...`, with
health/home 200 and primary preserved. The smoke remains intentionally minimal and does not claim
checkout, payment, webhook, buyer-access, authenticated-admin or financial validation.

## Required hosted evidence

P16-01 through P16-08 have supplied their bounded hosted evidence. P16-06, P16-07 and P16-08 are
`COMPLETE / PASS / DOCUMENTED / HOSTED VALIDATED` within their respective scopes. P16 still cannot
close until P16-09 performs the final technical gate. P16-08 residual limitations—second-window
individual RPO correlation, no proved final off-R2 independent copy, sequential DB/R2 capture and
dependency remediation debt—remain explicit inputs to that review.

For Hostinger MariaDB this explicitly includes migration privilege elevation, subsequent reduction,
current-user and inherited/public grant evidence, and correction of the observed hosted
`APP_URL=https://staging.lessenc.com.br` to the canonical `https://lessenc.com.br`.

### Hostinger managed single-user post-migration baseline

The hosted database migration and runtime privilege-reduction procedure has been exercised against
the real staging database.

The current accepted Hostinger runtime posture is:

- global `USAGE`;
- schema `SELECT`, `INSERT`, `UPDATE`, `DELETE`;
- provider-managed `DELETE HISTORY`;
- provider-managed `SHOW CREATE ROUTINE`;
- no `ALL PRIVILEGES`;
- no `GRANT OPTION`;
- zero system-versioned tables;
- zero stored routines.

The last two privileges are not treated as application requirements. They are provider-specific
exceptions accepted only by the explicit Hostinger access model while their target surfaces remain
absent.

After an authorized migration, the migration window must be returned to `disabled` before ordinary
runtime/readiness operation. No application deployment is implied by successful database migration
or privilege verification.

<!-- P16-H3-B1-RUNBOOK-FREEZE -->

### P16-H3-B1 provider decision

Cloudflare R2 Standard is frozen for P16 hosted private storage.

This is a documentation/architecture decision only. No provider resource, token, SDK dependency,
sentinel object or staging connection is created by H3-B1.

<!-- P16-H3-C-B-R2-ADAPTER-IMPLEMENTATION-FREEZE -->

### P16-H3-C-B — Hosted adapter implementation contract

The Cloudflare R2 delivery adapter remains server-only and backend-proxied.

Implementation is frozen as:

`PrivateResourceStorage -> S3CompatiblePrivateResourceStorage -> HeadObject/GetObject -> Cloudflare R2`

The existing storage-key policy will be shared by the local and hosted adapters.

The hosted runtime adapter is read-only. It performs no object upload, deletion, listing,
bucket administration or presigned URL generation.

GetObject remains streamed. Whole-object buffering is forbidden.

HeadObject metadata is used only to produce the bounded application metadata and, when available,
to bind the following GetObject with `IfMatch` for object-consistency hardening.

Provider configuration remains lazy and is not evaluated merely by constructing the Buyer Access
route.

Readiness is not changed by H3-C and remains a separate H3-D gate.

<!-- P16-H3-C-D2-R2-ADAPTER-IMPLEMENTATION-CLOSEOUT -->

### P16-H3-C-D2 — Hosted R2 adapter implementation status

H3-C is implemented and synthetically validated.

Current runtime delivery path:

`PrivateResourceStorage -> ConfiguredPrivateFileStorage -> S3CompatiblePrivateResourceStorage -> Cloudflare R2 S3 API`

Implemented runtime operations are restricted to:

- `HeadObject`;
- `GetObject`.

The hosted resolver remains lazy. Merely constructing the protected-download route does not
parse the hosted storage credentials and does not issue an R2 request.

The same adapter instance is reused for the protected-delivery `stat()` -> `open()` sequence.

The shared logical storage-key validator is consumed by both Local and S3-compatible adapters.

The hosted runtime remains read-only and backend-proxied. No presigned URL, public object URL,
write, deletion, listing or bucket-management path exists.

The original H3-C implementation gate used synthetic SDK responses only. Subsequent H3-E-C
validation exercised the actual configured application storage factory against real R2 from a
controlled local process. P16-06 later proved the deployed readiness composition; hosted protected
buyer delivery remains a distinct P17 validation surface.

At H3-C closeout, hosted readiness remained fail-closed pending the separate H3-D implementation
recorded below.

<!-- P16-H3-D-R2-PRIVATE-READINESS-SENTINEL -->

### P16-H3-D — Private readiness sentinel procedure

H3-D is implemented, synthetically validated and validated against real R2 from a controlled local
process. When `PRIVATE_STORAGE_DRIVER=hosted`, an
authorized readiness request validates the complete hosted storage contract and performs one
metadata-only `HeadObject` for the exact key `_health/p16-readiness`.

Completed operational prerequisites outside Git:

- provision the private R2 bucket and bucket-scoped read-only runtime credential;
- create the exact private sentinel object `_health/p16-readiness`;
- keep public `r2.dev` disabled and custom domain absent (OWNER-CONFIRMED);
- configure the frozen hosted variables without printing or committing their values;
- invoke `/api/readiness` only through the existing private bearer-authenticated path;
- record real provider evidence without endpoint, account, credential, provider request ID or ETag
  value disclosure.

No sentinel content is downloaded. Any configuration, object, bucket, credential, network, TLS or
provider failure must remain `not_ready` with the generic storage failure boundary. Real provider
and local in-process HTTP evidence is recorded below. P16-06 later added owner-verified recurring
deployed/hosted HTTP readiness evidence without exposing provider detail.

<!-- P16-H3-E-REAL-R2-EVIDENCE-CLOSEOUT -->

### P16-H3-E — Real R2 evidence and remaining deployment gate

H3-E-A passed pre-provisioning only. It froze the intended staging bucket name
`lessenc-digital-staging-private`, default jurisdiction, Automatic location, Standard storage
class, privacy requirements, separate runtime/operational credential roles and the later
provisioning/validation procedure. No real Cloudflare/R2 provider contact occurred during H3-E-A:
it created no bucket or object, used no real credential and validated no provider access. The real
bucket and object state were established and reconciled only by the subsequent H3-E-B sequence.
The following three exposure facts are OWNER-CONFIRMED Cloudflare dashboard evidence, not
independent API/provider proof: the resulting bucket is private, its public `r2.dev` URL is
disabled and it has no custom domain.

The first H3-E-B attempt stopped fail-closed at `SECURE_INPUT / FAIL`. Treating remote state as
unknown prevented blind reprovisioning and prevented inference from missing evidence.

H3-E-B-R1 reconciled the existing objects with the runtime read-only identity only; it did not
request the operational identity. The controlled validation object and sentinel were
`PRESENT_AND_EXACT`, proving `REMOTE_STATE / FULLY_PROVISIONED` without write, delete, list or
presigned-URL operations. H3-E-B-R2 proved the two identities distinct: runtime real read passed,
runtime conditional write returned `403 / AccessDenied`, and the operational identity's
conditional write reached `412 / PreconditionFailed`. The false precondition prevented effective
mutation, both objects remained exact, and no delete, list or presigning occurred. The repository
remained byte-identical throughout both reconciliations.

The runtime identity is bucket-scoped `Object Read only`. The separate, bucket-scoped operational
identity has `Object Read & Write` and must never be configured as the runtime identity. The
application remains backend-proxied and has only `HeadObject`/`GetObject`, with no application
write, delete, list or presigned-URL capability.

H3-E-C passed the real configuration through the canonical parser with `APP_ENV=staging`, hosted
driver, `r2` provider, `auto` region and the exact healthcheck key. The production H3-D factory
performed real sentinel `HeadObject`, never read its body and reported `PRIVATE_STORAGE` ready.
`runReadinessProbe()` used a synthetically isolated database plus real R2 and returned global
`READY`.

The actual H3-C construction path used `createConfiguredPrivateFileStorage()`,
`ConfiguredPrivateFileStorage` and `S3CompatiblePrivateResourceStorage`. `stat()` performed a real
controlled-object `HeadObject`; `open()` performed streaming real `GetObject`; ETag/IfMatch
consistency and the exact controlled body passed. The buyer key policy rejected
`_health/p16-readiness`, keeping the operational sentinel outside buyer content.

Authorized local in-process readiness returned `200 / {"status":"ready"}`. Unauthorized readiness
returned `404 / {"status":"not_found"}` with zero provider calls, proving authentication before
provider access. Public output stayed sanitized; a synthetic provider failure projected only
`not_ready`, and the captured credential-output leak check passed.

Exact real provider operations during H3-E-C:

- one sentinel `HeadObject` through the direct H3-D probe;
- one sentinel `HeadObject` through readiness composition;
- one controlled-object `HeadObject` through H3-C `stat()`;
- one controlled-object streaming `GetObject` through H3-C `open()`;
- one sentinel `HeadObject` through authorized HTTP readiness;
- no write, delete, list, presigned URL or sentinel-body read.

`_health/p16-readiness` is an intentional zero-byte operational sentinel.
`validation/p16-h3e-readonly.txt` is an intentional controlled staging validation object. Neither
is buyer/product content.

Keep the evidence layers distinct: prior H3-C/H3-D suites are synthetic; H3-E-B is direct
real-provider validation; H3-E-C covers real application-level provider behavior and local
in-process HTTP. At the H3-E closeout, deployment and deployed HTTP were still pending. P16-06 later
supplied owner-verified Hostinger deployment and recurring deployed readiness evidence. Production,
hosted protected buyer delivery and complete P16 readiness remain unauthorized/unvalidated.
