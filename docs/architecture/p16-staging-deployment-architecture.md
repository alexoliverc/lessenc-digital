# P16 — Staging Deployment Architecture

**Phase:** P16 — Staging Deployment
**Status:** ARCHITECTURE FROZEN / INTERNAL REPOSITORY IMPLEMENTATION COMPLETE / HOSTED VALIDATION PENDING
**Original P16 baseline:** `671c974345496092e8dc17bb4c37ead2e1952140`
**Current P16 working baseline:** `300a5db6755b238606f0aa91e05981b2af121acc`
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

The currently proven hosted build commit is:

`300a5db6755b238606f0aa91e05981b2af121acc`

That commit has already demonstrated successful dependency installation, Prisma Client generation, Next.js compilation, TypeScript validation, static generation and hosted build completion.

This does not yet prove complete staging readiness.

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

## 8. Staging migrations

The canonical hosted migration operation is:

`prisma migrate deploy`

Normal staging operation must never use:

`prisma migrate reset`

or:

`prisma db push`

The current P06 guard has no staging deployment mode.

P16 must implement a fail-closed staging migration guard before hosted staging migrations are executed.

## 9. Private digital storage

The application contract remains provider-independent through:

`PrivateResourceStorage`

The current configured physical implementation uses:

`LocalPrivateFileStorage`

That implementation is not accepted as the authoritative hosted digital-asset architecture.

P16 must provide hosted private storage preserving authorization, private-by-default access, streaming, integrity and recoverability.

The hosted storage provider remains an implementation decision within P16.

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

P16 uses Mercado Pago TEST credentials only.

Relevant configuration includes:

- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- `P10_PAYMENT_CONTINUATION_SECRET`

Production Mercado Pago credentials are prohibited during P16.

Hosted TEST validation belongs to P16-05.

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

P16 must provide hosted operational validation including external liveness monitoring, protected readiness monitoring, alert delivery and hosted service-health evidence.

External monitoring must not depend exclusively on the same failure domain as the application.

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

### P16-F06 — Hosted private-storage adapter missing

`BLOCKED EXTERNALLY`: the provider-neutral boundary and hosted/local selection fail closed, but a
concrete hosted provider decision and adapter remain required.

### P16-F07 — Hosted readiness access control missing

`REMEDIATED IN CODE`: server-only bearer authentication denies generic unauthorized requests before
dependency probes. Hosted validation remains required.

### P16-F08 — Hosted recovery implementation pending

Hosted backup scheduling, retention and measured restore evidence remain pending.

### P16-F09 — Hosted observability delivery pending

External monitoring and real alert delivery remain pending.

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
