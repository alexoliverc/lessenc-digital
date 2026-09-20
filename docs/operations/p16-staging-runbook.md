# P16 Staging Deployment Runbook

**Status:** INTERNAL IMPLEMENTATION / HOSTED VALIDATION REQUIRED

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
| migration database secret | `DATABASE_URL` | MySQL hosted staging target; dedicated migration user |
| runtime database secret | `DB_RUNTIME_URL` | same hosted staging database; distinct least-privilege runtime user |
| database trust material | `DB_TLS_CA_FILE` | absolute readable CA path; hostname verification and `rejectUnauthorized=true` remain mandatory |
| Mercado Pago TEST | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `P10_PAYMENT_CONTINUATION_SECRET` | TEST credentials only; public key is the sole intentionally public credential |
| application secrets | `P09_SUBMISSION_SECRET`, `P11_BUYER_SESSION_SECRET`, `P12_ADMIN_AUTH_SECRET`, `P16_READINESS_TOKEN` | server-only, independently generated, at least 32 characters, never reused |
| product identity | `P08_PRODUCT_ID`, `P08_OFFER_ID` | canonical persisted staging UUIDs |
| private storage | `PRIVATE_STORAGE_DRIVER`, provider-specific future configuration | `hosted` in staging; provider adapter/credentials require the selected provider |
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

## Database migration

The only staging migration command is:

```powershell
npm run db:migrate:deploy:staging
```

It runs the fail-closed staging guard before `prisma migrate deploy`. The guard rejects local,
test, production, localhost, non-staging database names, mismatched migration/runtime targets,
shared database users, missing CA files and ambiguous application identity. It never prints either
database URL. `prisma migrate reset` and `prisma db push` are not staging procedures.

Before execution, create and verify an on-demand complete recovery point and confirm application
rollback compatibility with all pending additive migrations. Hosted migration execution remains an
owner/external action.

## Private storage

The application-level `PrivateResourceStorage` interface remains provider-independent and streams
`AsyncIterable<Uint8Array>`. `LocalPrivateFileStorage` is accepted only in local/test. Staging and
production fail closed when it is selected.

`PRIVATE_STORAGE_DRIVER=hosted` records the required hosted boundary, but no provider is invented.
Until an explicitly selected provider adapter supplies private-by-default storage, integrity,
streaming, backup and health operations, protected delivery and readiness remain unavailable.

## Protected readiness and hosted smoke

`GET /api/health` remains public and minimal. `GET /api/readiness` requires:

```text
Authorization: Bearer <P16_READINESS_TOKEN>
```

Missing, malformed, weakly configured or incorrect authorization returns generic HTTP 404 with
`Cache-Control: no-store` and does not execute database or storage probes. The token is hashed to a
fixed-length digest before timing-safe comparison. Authorized responses remain sanitized to
`ready` or `not_ready`.

After an authorized deployment, run from an independent failure domain:

```powershell
$env:P16_SMOKE_BASE_URL = 'https://lessenc.com.br'
npm run ops:p16:hosted-smoke
```

The smoke checks public liveness, denial of unauthenticated readiness, authenticated readiness,
no-store and the required hosted security headers. It never prints the readiness token.

## Mercado Pago TEST

The preflight permits only TEST-shaped access/public keys. Existing P10 boundaries remain:
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
