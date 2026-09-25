# P16 Staging Deployment Runbook

**Status:** INTERNAL IMPLEMENTATION / REAL R2 LOCAL VALIDATION COMPLETE / DEPLOYED VALIDATION REQUIRED

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
revoke privileges itself.

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
are complete. Deployed/hosted HTTP validation remains pending.
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

## Mercado Pago TEST

The preflight requires `P16_MERCADOPAGO_CREDENTIAL_SET=test` and validates the current `APP_USR-` access/public-key shape. `APP_USR-` is format validation only and does not independently prove sandbox authority. Hosted Mercado Pago TEST validation remains mandatory before P16 closeout. Existing P10 boundaries remain:
authenticated raw-body webhook verification, bounded timestamp tolerance, request-id validation,
duplicate/malformed input rejection, idempotent persistence, replay-safe state transitions,
server-side payment authority, failure isolation and sanitized logging. Hosted validation still
requires owner-provided TEST credentials, registered TEST webhook and controlled TEST transactions.
Production credentials are prohibited in P16.

## Monitoring, alerts and service health

Use an external liveness monitor for `/api/health` and a protected monitor for `/api/readiness`.
The readiness token must be stored as a provider secret and excluded from URLs, logs and status
pages. Alert delivery, incident integration and the public status page consume the provider-neutral
P15 contracts; selecting and provisioning those services remains external.

## Backup, retention, restore and rollback

The recovery unit remains database dump + private storage + Prisma migration hashes + integrity
manifest. The P11/P15 bundle generator and verifier remain the local reference implementation.

The approved release objectives are RPO <= 24 hours, RTO <= 8 hours and retention of 7 daily, 4
weekly and 3 monthly recovery points. `npm run ops:p16:retention-plan` reads a metadata index from
`P16_BACKUP_INDEX_FILE` and produces a read-only keep/delete-candidate plan. It never deletes a
backup. Provider lifecycle configuration must apply deletion only after independent bundle
verification and authorization.

`npm run ops:p15:restore-validate -- --bundle <path>` remains non-destructive. A hosted restore must
first target an isolated staging destination and prove manifest/checksum, migration history,
database semantics, storage integrity and application behavior. Application rollback changes only
the approved artifact; it is not a schema rollback or data restore.

## Required hosted evidence

P16 cannot close until external evidence proves HTTPS/DNS, exact deployed commit, hosted DB/TLS,
guarded migration, concrete private storage, Mercado Pago TEST, security headers, independent
monitoring/alert delivery, backup scheduling/encryption/off-site copy, isolated restore, measured
RPO/RTO and rollback.

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
controlled local process. Deployed/hosted HTTP validation remains pending.

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
and local in-process HTTP evidence is recorded below; deployed/hosted HTTP evidence remains
pending.

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
in-process HTTP. Deployed/hosted HTTP and production remain unvalidated. Do not deploy until a
separate owner-authorized gate explicitly permits it. P16 remains incomplete.
