# P16 — Staging Deployment Architecture

**Phase:** P16 — Staging Deployment
**Status:** P16-01–P16-05 COMPLETE / P16-06 INTERNAL IMPLEMENTATION CANDIDATE / EXTERNAL OBSERVABILITY PROOF PENDING
**Original P16 baseline:** `671c974345496092e8dc17bb4c37ead2e1952140`
**Current P16 working baseline and hosted release:** `acd03ada8a452fdb68c0da9c812f95b981f8f05d`
**Application hosting:** Hostinger Managed Node / Web App
**Current staging hostname:** `https://lessenc.com.br`

## 1. Purpose

P16 deploys L'Essenc Digital into a hosted staging environment representative of the intended production architecture.

P16 does not authorize production launch or real production payments.

P17 remains responsible for complete Release Candidate validation.

P18 remains responsible for Production Readiness Review.

P19 remains responsible for owner-authorized Production Launch.

## 2. Environment model

The canonical environments remain:

- `local`
- `test`
- `staging`
- `production`

`APP_ENV` identifies the application environment.

`NODE_ENV` identifies the Node.js execution mode and does not replace `APP_ENV`.

Current hosted staging configuration:

- `APP_ENV=staging`
- `NODE_ENV=production`
- `APP_URL=https://lessenc.com.br`

The owner selected `lessenc.com.br` as the hostname currently used during P16.

Using this hostname does not convert staging into production.

Staging and production remain isolated by database, storage, secrets, payment credentials and operational configuration.

## 3. Application hosting

The initial runtime is Hostinger Managed Node / Web App running the Next.js monolith.

The application must remain portable.

Business and domain rules must not depend on Hostinger-specific APIs.

Application deployment, application rollback and data recovery remain separate operational concerns.

## 4. Deployment source

Deployments use explicitly approved Git commits.

The P16 implementation branch is:

`phase/p16-staging-deployment`

The current hosted staging release commit is:

`acd03ada8a452fdb68c0da9c812f95b981f8f05d`

That commit has demonstrated the reproducible hosted release path and completed P16-05 Mercado Pago
TEST validation. It preserves the earlier hosted build evidence for dependency installation, Prisma
Client generation, Next.js compilation, TypeScript validation and static generation.

This does not yet prove complete P16 staging readiness. P16-06 observability delivery, P16-07
hosted security and P16-08 recovery evidence remain separate gates.

## 5. Runtime toolchain

The repository currently declares:

- package manager: `npm@11.19.1`
- Node engines: not declared

P16 must explicitly define the supported Node.js 24.x runtime family.

Provider-managed runtime differences must be recorded rather than silently treated as canonical repository configuration.

## 6. Hosted configuration and secrets

Secrets must remain outside Git.

Secrets must not use `NEXT_PUBLIC_`.

Secrets must not appear in application logs.

Staging secrets must remain independent from production secrets.

Required configuration must fail closed when absent.

Known configuration drift:

`P11_BUYER_SESSION_SECRET` is used by source code but is missing from `.env.example`.

P16-02 owns correction of the hosted configuration contract.

## 7. Database

The hosted application requires a MySQL-compatible relational database.

The current runtime uses:

- `@prisma/adapter-mariadb`
- `DB_RUNTIME_URL`
- `DB_TLS_CA_FILE`

Database transport currently requires authenticated access and CA-backed TLS with certificate verification.

P16 must not weaken the existing TLS boundary merely to accommodate a hosting provider.

A Hostinger database may only be accepted after compatibility, migration and transport validation.

If it cannot satisfy the frozen requirements, the application may remain on Hostinger while the database uses another compatible hosted provider.

### P16-DB-DECISION-01 — Hostinger managed database access

**Provider:** Hostinger Managed MariaDB

**Access model:** one managed database identity with controlled privilege rotation

**Reason:** the selected Hostinger service exposes one database user for the database

**Status:** OWNER APPROVED / CODE ADAPTATION COMPLETE / HOSTED DATABASE VALIDATION COMPLETE / APPLICATION READINESS PENDING

P16 supports two explicit access models through `P16_DATABASE_ACCESS_MODEL`:

- `distinct-users`: migration and runtime usernames must differ;
- `hostinger-managed-single-user`: `DATABASE_URL` and `DB_RUNTIME_URL` remain separate logical
  configuration names but must carry the same physical username and credential for the same hosted
  staging database.

Matching usernames never infer the Hostinger mode. An unknown or absent mode fails closed.

The security compensation for the Hostinger model is an explicit migration window plus mandatory
post-migration runtime privilege verification. `P16_DATABASE_MIGRATION_WINDOW=enabled` is accepted
only by the migration gate. Ordinary runtime/preflight requires `disabled`.

Privilege elevation and reduction are Hostinger control-plane actions outside the repository:

1. authorize and enable the migration window;
2. temporarily grant the schema privileges required by `prisma migrate deploy`;
3. execute the guarded migration;
4. revoke migration/DDL privileges;
5. disable the migration window;
6. validate runtime grants and protected readiness.

Repository runtime behavior demonstrably requires `SELECT`, `INSERT`, `UPDATE` and `DELETE`.

Under `distinct-users`, the runtime verifier continues to permit only those four DML privileges on
the exact staging schema plus global `USAGE`.

Hosted Hostinger validation proved that the managed single-user control plane retains two additional
schema privileges which are not individually exposed by hPanel: `DELETE HISTORY` and
`SHOW CREATE ROUTINE`. They are accepted only when
`P16_DATABASE_ACCESS_MODEL=hostinger-managed-single-user`.

This is a provider-specific fail-closed exception, not a general privilege expansion. The readiness
contract permits no other additional privilege, continues to reject `ALL PRIVILEGES`,
`GRANT OPTION`, global DML, foreign scopes, incomplete DML, DDL/administrative privileges and
uninterpreted role grants, and continuously requires zero `SYSTEM VERSIONED` tables and zero stored
routines. If either provider-extra target surface appears, staging readiness returns
`DATABASE_RUNTIME_PRIVILEGES_UNSAFE`.

## 8. Staging migrations

The canonical hosted migration operation is:

`prisma migrate deploy`

Normal staging operation must never use:

`prisma migrate reset`

or:

`prisma db push`

The current P06 guard has no staging deployment mode.

P16 must implement a fail-closed staging migration guard before hosted staging migrations are executed.

The implemented guard additionally requires `P16_DATABASE_MIGRATION_WINDOW=enabled`. Default and
runtime configuration use `disabled`; migration authorization is not a credential and is never
required by ordinary application startup.

`P16-HDB-01-FIX01` also binds the migration guard directly to the checked-out release. The guard
independently resolves `git rev-parse HEAD` and requires an exact match with the valid 40-hex
`P16_RELEASE_COMMIT`. Missing, malformed, mismatched or unverifiable release identity fails closed;
running the staging preflight beforehand is not assumed.

`P16-HDB-02` originally attempted to bind Prisma Migrate to the explicit runtime trust anchor by
deriving `sslcert` from `DB_TLS_CA_FILE` and forcing `sslaccept=strict`. Hosted H2-I-D1/H2-I-D2
validation showed that every tested explicit `sslcert` representation returned `P1001`, while
`sslaccept=strict` with the Prisma/operating-system public trust store reached migration-state
inspection.

`P16-HDB-03` supersedes that migration-specific trust strategy. In staging, `prisma.config.ts`
removes every case-insensitive operator-provided `sslcert` and `sslaccept`, emits exactly one
`sslaccept=strict`, emits no `sslcert`, and never logs the raw or effective datasource URL.
Application runtime TLS remains separate and continues to require `DB_TLS_CA_FILE`, explicit CA
loading and `rejectUnauthorized=true`.

## 9. Private digital storage

The application contract remains provider-independent through:

`PrivateResourceStorage`

The current configured physical implementation uses:

`LocalPrivateFileStorage`

That implementation is not accepted as the authoritative hosted digital-asset architecture.

P16 must provide hosted private storage preserving authorization, private-by-default access, streaming, integrity and recoverability.

The hosted storage provider for P16 is OWNER APPROVED and frozen as Cloudflare R2 Standard. The application contract remains provider-neutral and the concrete infrastructure adapter uses the S3-compatible API.

## 10. Health and readiness

`GET /api/health` remains the public minimal liveness endpoint.

It must not disclose database or storage details.

`GET /api/readiness` evaluates application, database and private-storage readiness.

Its response remains sanitized.

The readiness endpoint is a machine/internal operational boundary.

P16 must implement hosted machine authentication or equivalent infrastructure access control before readiness is considered valid for hosted operation.

Unauthorized requests must not trigger dependency probing.

## 11. Administrative runtime

Hosted administrative authentication depends on:

- `APP_URL`
- `APP_ENV`
- `DB_RUNTIME_URL`
- `DB_TLS_CA_FILE`
- `P12_ADMIN_AUTH_SECRET`

Staging must use its own administrative secret and staging database.

No production administrative credentials may be reused.

Administrative account bootstrap remains a separately controlled operation.

## 12. Mercado Pago

P16 uses Mercado Pago TEST credentials only. Static preflight requires `P16_MERCADOPAGO_CREDENTIAL_SET=test` and validates the observed `APP_USR-` credential shape, but the prefix is not treated as proof of sandbox authority. P16-05 subsequently supplied the hosted operational proof.

Relevant configuration includes:

- `P16_MERCADOPAGO_CREDENTIAL_SET`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- `P10_PAYMENT_CONTINUATION_SECRET`

Production Mercado Pago credentials are prohibited during P16.

P16-05 is COMPLETE / PASS. Its evidence includes hosted Pix presentation, persisted provider
references, an expected pending/action-required state, an HTTP 200 TEST webhook and idempotent
duplicate handling. No real payment or production credential was used.

## 13. HTTP security

Hosted staging must validate the actual HTTP response policy including:

- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- X-Frame-Options
- upgrade-insecure-requests

Source-code configuration alone is not sufficient evidence.

## 14. Observability

P15 supplied the application-side observability foundation.

P16-06 preserves the following topology:

```text
application
-> canonical structured logs / metrics / completed local spans
-> provider-neutral monitoring and alert contracts
-> future external collector / monitor / alert provider
-> future incident destination
-> sanitized public status projection
```

The repository now defines a provider-neutral hosted monitoring plan for exactly:

- public `GET https://lessenc.com.br/api/health`, HTTP 200 and exact
  `{"status":"ok"}`;
- protected `GET https://lessenc.com.br/api/readiness`, with bearer authentication supplied only
  from the provider secret reference `P16_READINESS_TOKEN`, HTTP 200 `ready` or HTTP 503
  `not_ready`; unauthorized remains HTTP 404.

Monitor URLs must be HTTPS roots without user information, query strings or fragments. A readiness
token is never accepted in a URL or serialized into the monitoring plan.

The alert-delivery foundation accepts only a firing result from the deterministic P15 rules and
projects a bounded envelope with rule, public component, severity, abstract owner, stable
deduplication key, occurrence count and UTC evaluation time. A future provider adapter receives no
Payment, Order, Entitlement, database or mutation capability. No provider adapter or live
destination is selected or configured by P16-06.

The public-status foundation remains the existing sanitized service-health projection for Website,
Checkout, Payments, Buyer Access / Digital Delivery and Admin. `status.lessenc.com.br` is only the
planned public origin; there is no DNS/TLS/hosting/publication action in this gate, and raw readiness
is never a public-status data source.

P16 must still provide hosted operational validation including independent external liveness,
protected readiness monitoring, real alert delivery, acknowledgement/evidence, incident routing
and hosted service-health evidence.

External monitoring must not depend exclusively on the same failure domain as the application.

Numerical SLO targets remain `OPEN_STAGING_BASELINE` until hosted samples exist. Monitoring,
logging, alerts and status projections remain evidence only and cannot mutate financial,
commercial, entitlement or authorization state.

## 15. Backup and recovery

Owner-approved release objectives remain:

- RPO <= 24 hours
- RTO <= 8 hours
- 7 daily backups
- 4 weekly backups
- 3 monthly backups

These remain objectives until hosted evidence validates them.

P16 must validate recovery covering database, private storage, migration metadata and integrity evidence.

Application rollback is distinct from database recovery.

## 16. P16 findings

### P16-F01 — Environment contract drift

`REMEDIATED`: `.env.example` includes the server-only buyer-session secret name without a value.

### P16-F02 — Documentation state drift

`REMEDIATED INTERNALLY`: canonical summaries identify P16 as internally in progress while
preserving the factual statement that no deployment occurred.

### P16-F03 — Runtime toolchain drift

`REMEDIATED`: `package.json` and the root lockfile declare Node.js `24.x`.

### P16-F04 — Staging migration guard missing

`REMEDIATED IN CODE`: the P16 staging guard precedes `prisma migrate deploy`; hosted execution is
still pending.

### P16-F05 — Hosted database validation pending

Database compatibility, TLS and hosted migrations have not yet been proven.

### P16-HDB-F01 — Migration release-commit binding

`REMEDIATED IN P16-HDB-01-FIX01`: the migration guard now independently verifies that
`P16_RELEASE_COMMIT` exactly matches the repository `HEAD` before `prisma migrate deploy` can be
eligible. Hosted execution remains pending and was not performed by the fix.

### P16-HDB-F02 — Prisma migration TLS binding missing

`REMEDIATED INTERNALLY IN P16-HDB-02 / HOSTED VALIDATION EXPOSED P16-HDB-F03`: P16-HDB-02
introduced strict TLS canonicalization with explicit `sslcert`. Local validation passed, but hosted
validation later demonstrated that the explicit `sslcert` strategy was incompatible with the tested
Prisma Schema Engine path.

### P16-HDB-F03 — Prisma explicit sslcert incompatible with hosted Schema Engine

`REMEDIATED IN P16-HDB-03 / HOSTED REVALIDATION PASS`: H2-I-D1 and H2-I-D2 demonstrated that
`sslaccept=strict` with the Prisma/operating-system public trust store reaches migration-state
inspection. Raw relative, encoded relative, Prisma-directory root-CA and Prisma-directory full-bundle
`sslcert` variants returned `P1001`.

The canonical Prisma Migrate contract therefore forces exactly one `sslaccept=strict`, removes all
operator-provided `sslcert` parameters and emits no `sslcert`. Runtime database access continues to
require `DB_TLS_CA_FILE` and `rejectUnauthorized=true`. No `prisma migrate deploy` or database
mutation was performed during these hosted diagnostics.

Final P16-HDB-03 hosted revalidation passed against the real Hostinger staging endpoint: the
canonical hostname with `APP_ENV=staging` reached Prisma migration-state inspection under the final
configuration; the same endpoint addressed by IP was rejected with `P1011` and TLS evidence; and a
second canonical-hostname attempt reached migration-state inspection again. This proves that the
final migration path remains strict rather than permissive.

A subsequent synthetic staging production build also passed with `APP_ENV=staging`,
`NODE_ENV=production`, synthetic `.invalid` database targets and the local environment file
temporarily quarantined and restored. No hosted database connection, deploy, migration or database
mutation occurred during that build.

### P16-F10 — Hostinger single-user database lifecycle validated

`P16-DB-DECISION-01` is implemented in code and its hosted database lifecycle has been exercised
against the real staging database. The authorized migration window was opened for
`prisma migrate deploy`, all eight repository migrations were applied successfully, the migration
window was returned to `disabled`, and subsequent Prisma migration-state inspection reported the
schema up to date.

Post-migration privilege reduction was also exercised through the Hostinger control plane. Effective
`SHOW GRANTS FOR CURRENT_USER()` evidence established global `USAGE`, required schema
`SELECT`/`INSERT`/`UPDATE`/`DELETE`, absence of `ALL PRIVILEGES` and absence of `GRANT OPTION`.

Hostinger retains `DELETE HISTORY` and `SHOW CREATE ROUTINE` as provider-managed schema extras not
individually exposed by hPanel. H2-M1 reconciles those exact exceptions with continuous fail-closed
readiness controls requiring zero system-versioned tables and zero stored routines.

The database lifecycle portion of P16-F10 is therefore validated. Real private-storage provisioning
and controlled local application/provider validation were subsequently completed in H3-E. Full
deployed application readiness remains pending with the other P16 hosted operational dependencies.

### P16-F11 — Hosted APP_URL drift

The observed Hostinger value `https://staging.lessenc.com.br` conflicts with the canonical P16
value `https://lessenc.com.br`. The repository continues to fail closed on the canonical value;
the Hostinger environment must be corrected externally.

### P16-F06 — Cloudflare R2 private storage validated locally

`OWNER APPROVED / IMPLEMENTED / REAL PROVIDER VALIDATED LOCALLY / DEPLOYMENT PENDING`.

Cloudflare R2 Standard is the canonical hosted private-storage provider for P16.

The provider-neutral application boundary remains `PrivateResourceStorage`. The infrastructure
implementation is `S3CompatiblePrivateResourceStorage` and uses the S3-compatible API through
`@aws-sdk/client-s3`.

The adapter, environment contract, dedicated private staging bucket, bucket-scoped runtime
credentials and readiness sentinel are complete. Direct real-provider validation and controlled
local validation through the actual H3-C/H3-D application paths pass. Deployed/hosted HTTP proof
remains pending; this evidence does not claim production validation.
### P16-F07 — Hosted readiness access control missing

`REMEDIATED IN CODE`: server-only bearer authentication denies generic unauthorized requests before
dependency probes. Hosted validation remains required.

### P16-F08 — Hosted recovery implementation pending

Hosted backup scheduling, retention and measured restore evidence remain pending.

### P16-F09 — Hosted observability delivery pending

`REPOSITORY FOUNDATION IMPLEMENTED / EXTERNAL PROOF PENDING`: monitor configuration, safe secret
reference, deterministic alert-delivery envelope, incident-routing metadata and sanitized public
status projection exist without a provider dependency. External collector/monitor selection,
independent probe execution, real delivery, acknowledgement evidence, incident destination,
status-page provisioning and DNS/TLS remain pending owner/provider decisions.

## 17. Execution sequence

P16 proceeds through:

P16-00 — Opening Audit & Canonical Reconciliation
P16-01 — Hosted Architecture & Staging Topology Freeze
P16-02 — Hosted Configuration & Secrets
P16-03 — Staging Database & Private Storage
P16-04 — Reproducible Staging Deployment
P16-05 — Mercado Pago TEST Hosted Validation
P16-06 — Hosted Observability, Alerting & Service Health
P16-07 — Hosted Security Validation
P16-08 — Backup, Restore, RPO/RTO, Retention & Rollback
P16-09 — Final Technical Gate

## 18. P16-01 decision

Hosted architecture discovery is complete.

The architecture is frozen sufficiently to begin P16-02.

P16-01 does not claim complete database, storage, payment, readiness, backup, monitoring or complete staging readiness.

Those proofs belong to subsequent P16 subphases.

## P16-H2-M1 — Hostinger managed runtime privilege exception

Real hosted validation established the final Hostinger managed grant posture after migration and
privilege reduction:

- global scope: `USAGE`;
- required schema DML: `SELECT`, `INSERT`, `UPDATE`, `DELETE`;
- provider-managed schema extras: `DELETE HISTORY`, `SHOW CREATE ROUTINE`;
- `ALL PRIVILEGES`: absent;
- `GRANT OPTION`: absent;
- system-versioned tables: zero;
- stored routines: zero.

The hPanel database-permission surface exposes the four required DML permissions but does not expose
individual controls for `DELETE HISTORY` or `SHOW CREATE ROUTINE`. The application therefore binds
those two exact exceptions exclusively to `hostinger-managed-single-user`.

The runtime readiness probe now continuously verifies both the effective grant allowlist and the
absence of target surfaces for the two provider-managed extras. A new system-versioned table, stored
routine, unexpected privilege, foreign schema grant, global DML, grant option or broad privilege
fails closed.

The hosted staging database migration itself is complete: all eight repository migrations were
applied successfully and subsequent Prisma migration-state inspection reported the schema up to
date. The migration window was returned to `disabled`.

This remediation does not authorize an application deployment. Hosted private storage and the
remaining P16 hosted operational controls remain separate blockers.

<!-- P16-H3-B1-CLOUDFLARE-R2-FREEZE -->

## P16-H3-B1 — Cloudflare R2 hosted private-storage freeze

**Status:** OWNER APPROVED / ARCHITECTURE FROZEN / IMPLEMENTATION NOT STARTED

The owner approved Cloudflare R2 Standard as the P16 hosted private-storage provider.

### Frozen application boundary

The application remains isolated from the provider through:

`PrivateResourceStorage`

The interface remains:

- `stat(storageKey)` -> private resource metadata;
- `open(storageKey)` -> `AsyncIterable<Uint8Array>`.

Application/domain code must not depend directly on Cloudflare APIs, AWS SDK types, Node.js
streams or provider-specific object representations.

### Frozen infrastructure adapter

The hosted infrastructure adapter will be:

`S3CompatiblePrivateResourceStorage`

The P16 physical provider is Cloudflare R2, accessed through its S3-compatible HTTPS API with
`@aws-sdk/client-s3`.

The adapter name intentionally remains provider-neutral so that a future S3-compatible provider
change does not require changing the application contract.

### Object operations

The P16 adapter is restricted to the protected-delivery/readiness surface:

- `stat(storageKey)` maps to `HeadObject`;
- `open(storageKey)` maps to `GetObject`;
- readiness maps to `HeadObject` against a dedicated sentinel object.

The application adapter must not use bucket administration, object deletion, object writes or
public object URLs.

The Cloudflare permission class may technically include object listing, but the application
adapter does not require or intentionally call `ListObjects`/`ListObjectsV2`.

### Private-by-default policy

The staging bucket must remain private.

The following are prohibited for the P16 buyer-delivery path:

- public `r2.dev` access;
- R2 custom public domain;
- anonymous bucket/object access;
- public object URL;
- presigned buyer-delivery URL;
- direct browser access to R2.

The canonical buyer flow remains:

`Buyer Session -> rate limit -> C4 authorization -> server-only storageKey -> PrivateResourceStorage -> private R2 object -> backend stream -> protected HTTP response -> append-only delivery audit`

### Runtime least privilege

The application runtime credential must be:

- dedicated to L'Essenc;
- dedicated to the staging storage boundary;
- Cloudflare R2 `Object Read only`;
- scoped to the dedicated L'Essenc staging bucket.

Runtime credentials must not be reused by Smith Sterling or any other project.

Any credential used for provisioning, upload, rotation or administration is operationally
separate and must never be configured as the application runtime credential.

### Environment contract frozen for implementation

The following variable names are approved for H3-B2/H3-C:

`PRIVATE_STORAGE_DRIVER=hosted`

`P16_PRIVATE_STORAGE_PROVIDER=r2`

`PRIVATE_STORAGE_S3_ENDPOINT`

`PRIVATE_STORAGE_S3_REGION=auto`

`PRIVATE_STORAGE_S3_BUCKET`

`PRIVATE_STORAGE_S3_ACCESS_KEY_ID`

`PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY`

`PRIVATE_STORAGE_HEALTHCHECK_KEY`

Real endpoint identifiers, bucket credentials, Access Key IDs, Secret Access Keys and secret
values must never be committed to Git or written to canonical documentation.

### Readiness sentinel

The hosted readiness control will perform a read-only `HeadObject` against a dedicated private
sentinel object whose object key is supplied through `PRIVATE_STORAGE_HEALTHCHECK_KEY`.

The intended canonical key is:

`_health/p16-readiness`

Successful readiness therefore proves the configured runtime can reach the S3-compatible R2
endpoint, authenticate, target the configured bucket and read metadata for the dedicated private
sentinel.

No protected ebook bytes are downloaded by the readiness check.

Public readiness output remains sanitized and must not expose endpoint, account identifier,
bucket, object key, Access Key ID, credential material or provider error detail.

### Smith Sterling isolation

Existing Cloudflare usage by Smith Sterling does not authorize resource or credential reuse.

P16 requires L'Essenc-specific:

- bucket identity;
- runtime credentials;
- operational/upload credentials;
- readiness sentinel.

A separate Cloudflare account is not required by P16, but project-level credentials and storage
resources must remain isolated.

### Explicit non-actions

This freeze does not:

- create an R2 bucket;
- create or rotate an API token;
- install `@aws-sdk/client-s3`;
- modify runtime code;
- modify readiness code;
- upload a sentinel;
- upload a digital product;
- connect staging to Cloudflare;
- deploy the application.

Those actions belong to subsequent H3 gates.

<!-- P16-H3-C-B-R2-ADAPTER-IMPLEMENTATION-FREEZE -->

## P16-H3-C-B — R2 / S3-compatible adapter implementation freeze

**Status:** IMPLEMENTATION DESIGN FROZEN / SDK NOT INSTALLED / PROVIDER NOT ACCESSED

H3-C-A confirmed that the existing application boundary is already suitable for hosted
object storage:

`PrivateResourceStorage`

The contract remains unchanged:

- `stat(storageKey)` returns `PrivateResourceMetadata`;
- `open(storageKey)` returns `AsyncIterable<Uint8Array>`.

No AWS SDK, Cloudflare or Node stream type may cross into the application/domain contract.

### Planned infrastructure files

H3-C implementation is frozen around these responsibilities:

`src/infrastructure/storage/private-storage-key.ts`

Canonical provider-independent validation of the logical `storageKey`. The exact safety policy
currently embedded in `LocalPrivateFileStorage` will be extracted without weakening it. Both the
local filesystem adapter and the S3-compatible adapter must consume the same parser.

`src/infrastructure/storage/s3-compatible-private-resource-storage.ts`

Implementation of `PrivateResourceStorage` over an injected S3-compatible `S3Client`.

`src/infrastructure/storage/s3-compatible-private-resource-storage.test.ts`

Network-free unit contract for HeadObject/GetObject, error normalization, key validation,
streaming and object-consistency behavior.

`src/infrastructure/storage/configured-private-file-storage.ts`

Remains the lazy application-facing resolver. It will resolve the hosted driver only when
`stat()` or `open()` is reached after the existing Buyer Access authorization boundary.

### Cloudflare R2 client construction

The hosted path will construct an AWS SDK v3 `S3Client` with only:

- endpoint from `PRIVATE_STORAGE_S3_ENDPOINT`;
- region from `PRIVATE_STORAGE_S3_REGION`, frozen as `auto`;
- Access Key ID from the server-only hosted-storage configuration;
- Secret Access Key from the server-only hosted-storage configuration.

The implementation does not require public R2 URLs, `forcePathStyle`, region redirects,
presigned-URL packages or browser credentials.

### Shared storage-key policy

The existing local adapter already rejects:

- empty keys;
- keys longer than 512 characters;
- NUL bytes;
- backslashes;
- absolute paths;
- Windows drive paths;
- empty path segments;
- `.` segments;
- `..` segments;
- characters outside the current bounded segment grammar.

H3-C extracts this exact policy into one infrastructure helper. The policy must not be weakened
during extraction.

R2 receives only a key that has passed this canonical parser.

### stat(storageKey)

`stat()` maps to `HeadObject`.

The adapter must:

1. validate the storage key before any SDK call;
2. send only `Bucket` and `Key`;
3. require `ContentLength` to be a non-negative safe integer;
4. return only `{ sizeBytes }` to the application;
5. retain the returned ETag internally for the immediately related object access when available;
6. never expose bucket, endpoint, ETag, provider metadata or storage key to the application.

### open(storageKey)

`open()` maps to `GetObject`.

The adapter must:

1. validate the storage key before any SDK call;
2. send `Bucket` and `Key`;
3. when a HeadObject ETag snapshot is available from the same adapter/request, send it through
   `IfMatch`;
4. fail closed if the object changed between metadata acquisition and GetObject;
5. require a response body that can be consumed as an async iterable;
6. expose only `AsyncIterable<Uint8Array>`;
7. stream incrementally without `transformToByteArray()`, `arrayBuffer()`, full buffering or
   whole-object concatenation.

Buffers yielded by the Node.js SDK satisfy `Uint8Array`. Any unexpected streamed chunk shape
fails closed.

### Stream lifecycle

The hosted body wrapper must preserve backpressure and must release the underlying iterator on
consumer cancellation or completion whenever `return()` is available.

Provider errors produced after HTTP delivery begins are normalized internally and continue
through the existing `STREAM_FAILED` delivery-audit boundary. Raw R2/AWS error text must not be
logged or sent to the buyer.

### Object consistency

The metadata/body transition is hardened against object replacement.

When HeadObject provides an ETag, GetObject uses `IfMatch` with that ETag. A failed precondition
or inconsistent provider result is treated as `STORAGE_UNAVAILABLE`.

If both HeadObject and GetObject expose a content length, a disagreement also fails closed.

This protection remains internal to the infrastructure adapter and does not change
`PrivateResourceStorage`.

### Error normalization

Hosted object storage must map failures only into the existing canonical storage error model.

`INVALID_STORAGE_KEY`:
local validation rejected the logical object key before provider access.

`RESOURCE_NOT_FOUND`:
known object-missing responses such as S3 `NoSuchKey` / object `NotFound`.

`STORAGE_UNAVAILABLE`:
authentication failure, authorization failure, NoSuchBucket, signature failure, endpoint/DNS/TLS
failure, timeout, network failure, 5xx, conditional-object mismatch, malformed metadata, missing
body, unsupported body shape or any unknown provider failure.

`RESOURCE_NOT_FILE`, `STORAGE_ESCAPE_DETECTED`, `STORAGE_ROOT_INVALID` and
`STORAGE_ROOT_UNAVAILABLE` remain filesystem/root-specific semantics and are not synthesized by
the R2 adapter.

A generic HTTP 404 must not blindly become `RESOURCE_NOT_FOUND` when provider identity indicates
a missing bucket or other infrastructure failure.

### Configured storage resolution

`ConfiguredPrivateFileStorage` changes its internal cached type from
`LocalPrivateFileStorage | null` to `PrivateResourceStorage | null`.

For `PRIVATE_STORAGE_DRIVER=hosted` it will:

- parse `getP16HostedPrivateStorageEnv()` lazily;
- require the frozen R2 contract;
- construct the S3-compatible adapter;
- cache that adapter for the request;
- use the same adapter instance for `stat()` and `open()`.

Local/test behavior remains unchanged.

Local filesystem remains forbidden as staging or production authority.

### Explicitly forbidden operations

The runtime adapter must not call:

- PutObject;
- DeleteObject;
- DeleteObjects;
- CopyObject;
- CreateBucket;
- DeleteBucket;
- ListBuckets;
- ListObjects;
- ListObjectsV2;
- ACL operations;
- presigned URL generation.

The runtime surface is read-only and bounded to HeadObject and GetObject.

### H3-C test freeze

The implementation test suite must prove at minimum:

- safe key -> HeadObject -> correct `sizeBytes`;
- invalid key -> `INVALID_STORAGE_KEY` with zero SDK calls;
- missing object on HeadObject -> `RESOURCE_NOT_FOUND`;
- provider/auth/network/bucket errors -> `STORAGE_UNAVAILABLE`;
- malformed or unsafe ContentLength -> `STORAGE_UNAVAILABLE`;
- GetObject returns an incremental multi-chunk `AsyncIterable<Uint8Array>`;
- open does not buffer the complete object;
- missing GetObject body -> `STORAGE_UNAVAILABLE`;
- missing object during GetObject -> `RESOURCE_NOT_FOUND`;
- unexpected stream failure does not expose raw provider detail;
- ETag from HeadObject becomes GetObject `IfMatch`;
- precondition/object drift fails closed;
- configured hosted storage remains lazy;
- route construction still performs no storage/provider access;
- local filesystem remains blocked in staging.

H3-C does not change the readiness probe. Hosted readiness remains fail-closed until H3-D.

<!-- P16-H3-C-D2-R2-ADAPTER-IMPLEMENTATION-CLOSEOUT -->

## P16-H3-C-D2 — R2 / S3-compatible adapter implementation closeout

**Current status:** IMPLEMENTED / SYNTHETICALLY VALIDATED / REAL PROVIDER VALIDATED LOCALLY

The H3-C-B design freeze remains the historical design authority for this implementation.
H3-C-C1, H3-C-C2 and H3-C-D1 subsequently implemented and reconciled that design.

### Implemented dependency

The hosted private-resource adapter now uses:

`@aws-sdk/client-s3@3.1136.0`

The exact dependency is recorded in both `package.json` and `package-lock.json`.

No additional presigning, upload, bucket-administration or browser SDK package was introduced.

### Implemented shared storage-key policy

The provider-independent logical storage-key policy now lives in:

`src/infrastructure/storage/private-storage-key.ts`

`LocalPrivateFileStorage` and `S3CompatiblePrivateResourceStorage` both consume the same
validation policy.

The extraction preserved the established protections against:

- empty or overlong keys;
- NUL bytes;
- backslashes;
- absolute paths;
- Windows drive paths;
- empty segments;
- `.` and `..` path traversal segments;
- characters outside the bounded segment grammar.

The application-facing `PrivateResourceStorage` contract was not changed.

### Implemented S3-compatible adapter

The following infrastructure adapter now exists:

`src/infrastructure/storage/s3-compatible-private-resource-storage.ts`

Implemented operations:

- `stat(storageKey)` -> `HeadObject`;
- `open(storageKey)` -> `GetObject`;
- response body -> incremental `AsyncIterable<Uint8Array>`.

The adapter does not perform complete-object buffering.

When `HeadObject` supplies an ETag, the immediately related `GetObject` uses that value through
`IfMatch`.

The metadata snapshot is single-use and internal to the adapter.

If both metadata operations expose content length and the values disagree, the adapter fails
closed.

### Implemented error normalization

The hosted adapter normalizes known object absence to:

`RESOURCE_NOT_FOUND`

Known infrastructure/provider failures remain:

`STORAGE_UNAVAILABLE`

In particular:

- `NoSuchKey` -> `RESOURCE_NOT_FOUND`;
- `NoSuchBucket` -> `STORAGE_UNAVAILABLE`;
- conditional/object-version mismatch -> `STORAGE_UNAVAILABLE`;
- authentication, authorization, network, endpoint, malformed metadata/body and unknown provider
  failures -> `STORAGE_UNAVAILABLE`.

A bare unknown HTTP 404 is not automatically interpreted as a missing buyer resource.

Raw provider exception text is not exposed through the storage error contract.

### Implemented configured hosted resolution

`ConfiguredPrivateFileStorage` now resolves the hosted driver lazily.

For `PRIVATE_STORAGE_DRIVER=hosted` it:

1. evaluates the validated P16 hosted-storage environment only when storage is first used;
2. constructs the server-only `S3Client`;
3. constructs `S3CompatiblePrivateResourceStorage`;
4. caches that adapter;
5. reuses the same adapter for `stat()` and `open()`.

Creating `ConfiguredPrivateFileStorage` itself remains storage-side-effect free.

The hosted S3 client uses only the validated server-side:

- endpoint;
- region;
- bucket;
- Access Key ID;
- Secret Access Key.

No R2/AWS type crosses into the application contract.

### Preserved prohibitions

The H3-C implementation contains no runtime:

- PutObject;
- DeleteObject;
- DeleteObjects;
- CopyObject;
- ListObjects/ListObjectsV2;
- bucket creation/deletion;
- presigned URL generation;
- public object delivery;
- complete-resource buffering.

Local filesystem authority remains rejected for staging and production.

### Synthetic validation evidence

H3-C-D1 reconciled the complete implementation with:

- 49 focused storage tests passing;
- 4 focused test files passing;
- full quality gate passing;
- 96 total test files passing;
- 841 total tests passing;
- formatting passing;
- production dependency audit reporting zero vulnerabilities.

All provider interactions in the original H3-C-D1 validation were synthetic/mocked. No real
Cloudflare R2 request was executed in that gate. H3-E-C subsequently validated the same configured
factory and adapter path against real R2 from a controlled local process.

### Remaining boundary

At H3-C closeout, hosted readiness was not yet complete.

`PRIVATE_STORAGE_HEALTHCHECK_KEY=_health/p16-readiness` remains reserved for H3-D.

The following H3-D gate implemented and synthetically validated that independent sentinel path.
H3-E-C subsequently supplied bounded real-provider application evidence; deployed/hosted HTTP
validation remains pending.

<!-- P16-H3-D-R2-PRIVATE-READINESS-SENTINEL -->

## P16-H3-D — R2 private readiness sentinel

**Current status:** IMPLEMENTED / SYNTHETICALLY VALIDATED / REAL PROVIDER VALIDATED LOCALLY

Hosted readiness now resolves a dedicated infrastructure-only metadata probe. The probe validates
the frozen hosted configuration and issues exactly one `HeadObject` for
`_health/p16-readiness`. Its interface exposes only `check()`; it has no content-returning method
and cannot issue `GetObject`.

This operational sentinel path is deliberately separate from the protected-delivery
`PrivateResourceStorage` contract. The buyer resource-key parser and the H3-C `stat()` -> `open()`
contract therefore remain unchanged and cannot treat the reserved `_health` namespace as buyer
content.

Any invalid hosted configuration, missing sentinel, unavailable bucket, authentication or
authorization rejection, network/TLS failure, unexpected provider response or probe failure maps
to the existing generic `PRIVATE_STORAGE` / `STORAGE_ROOT_UNAVAILABLE` readiness failure. Public
readiness remains only `ready` or `not_ready`; endpoint, bucket, sentinel key, credentials,
provider metadata and raw provider errors are not returned or logged.

The existing authorization boundary is unchanged: an unauthorized `/api/readiness` request is
rejected before database or storage probes execute. Local/test filesystem behavior is preserved,
and local filesystem authority remains prohibited in staging and production.

The original H3-D implementation gate used only synthetic SDK responses. Subsequent H3-E evidence
created and verified the real private sentinel, exercised the production H3-D factory against R2
from a controlled local process and validated the authenticated readiness composition. Deployment
and deployed/hosted HTTP evidence remain pending.

Validated evidence at the H3-D pre-commit boundary:

- focused readiness/storage/auth suite: 10 files and 88 tests passing;
- full repository suite: 97 files and 854 tests passing;
- lint, typecheck, formatting and optimized staging build passing;
- production dependency audit reporting zero vulnerabilities.

<!-- P16-H3-E-REAL-R2-EVIDENCE-CLOSEOUT -->

## P16-H3-E — Real R2 provisioning and application evidence

**Current status:** H3-E-A COMPLETE / H3-E-B COMPLETE / H3-E-C COMPLETE / DEPLOYMENT PENDING

H3-E-A was pre-provisioning only. It froze the intended bucket name
`lessenc-digital-staging-private`, default jurisdiction, Automatic location, Standard storage
class, privacy requirements, separate runtime/operational credential roles and the later
provisioning/validation procedure. No real Cloudflare/R2 provider contact occurred during H3-E-A:
it created no bucket or object, used no real credential and validated no provider access. The real
bucket and object state were established and reconciled only by the subsequent H3-E-B sequence.
The following three exposure facts are OWNER-CONFIRMED Cloudflare dashboard evidence, not
independent API/provider proof: the resulting bucket is private, its public `r2.dev` URL is
disabled and it has no custom domain.

The first H3-E-B attempt failed closed at `SECURE_INPUT / FAIL`. Its remote state remained unknown,
no state was inferred from absent evidence and provisioning was not repeated blindly.

H3-E-B-R1 used only the runtime read-only identity and established that
`validation/p16-h3e-readonly.txt` and `_health/p16-readiness` were `PRESENT_AND_EXACT`, yielding
`REMOTE_STATE / FULLY_PROVISIONED` without write, delete, list or presigned-URL operations.
H3-E-B-R2 then proved separate credential identities and authorization scopes: runtime real read
passed, its conditional write was denied with `403 / AccessDenied`, and the operational identity's
conditional write reached `412 / PreconditionFailed`. The false precondition prevented effective
mutation, both objects remained exact and no delete, list or presigning occurred. The repository
remained byte-identical during both reconciliations.

The runtime identity is bucket-scoped `Object Read only`. The distinct, bucket-scoped operational
identity has `Object Read & Write` and is not application runtime configuration. The application
continues to expose only backend-proxied `HeadObject`/`GetObject`; it has no application
`PutObject`, `DeleteObject`, `ListObjects` or presigning capability.

H3-E-C passed real configuration through the canonical parser with `APP_ENV=staging`, hosted
driver, `r2` provider, `auto` region and exact healthcheck key. The production H3-D factory issued
real sentinel `HeadObject` without sentinel `GetObject` and made `PRIVATE_STORAGE` ready.
`runReadinessProbe()` combined that real R2 result with a synthetically isolated database and
returned global `READY`.

The actual H3-C factory chain—`createConfiguredPrivateFileStorage()`,
`ConfiguredPrivateFileStorage` and `S3CompatiblePrivateResourceStorage`—performed real
controlled-object `HeadObject` through `stat()` and streaming `GetObject` through `open()`. The
ETag/IfMatch consistency path and exact controlled body passed. The shared buyer-content key policy
rejected `_health/p16-readiness`, keeping the readiness sentinel outside the buyer namespace.

Authorized local in-process readiness returned `200 / {"status":"ready"}`. Unauthorized readiness
returned `404 / {"status":"not_found"}` with zero provider calls, proving authentication precedes
provider access. Public output remained sanitized, a synthetic provider failure projected only
`not_ready`, and the captured credential-output leakage check passed.

H3-E-C made exactly three real sentinel `HeadObject` calls—direct H3-D probe, readiness composition
and authorized HTTP readiness—one controlled-object `HeadObject` for H3-C `stat()` and one
controlled-object streaming `GetObject` for H3-C `open()`. It made no write, delete, list,
presigned-URL or sentinel-body-read operation.

`_health/p16-readiness` intentionally exists as a zero-byte operational sentinel.
`validation/p16-h3e-readonly.txt` intentionally exists as controlled staging validation
infrastructure. Neither is buyer/product content.

Evidence levels are not interchangeable: pre-existing H3-C/H3-D suites are synthetic; H3-E-B is
direct real-provider validation; H3-E-C is real application-level provider validation and local
in-process HTTP validation. Deployed/hosted HTTP and production are not validated. No application
deployment has been executed, so P16 remains incomplete.
