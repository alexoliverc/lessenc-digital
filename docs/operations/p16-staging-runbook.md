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
| migration database secret | `DATABASE_URL` | MySQL hosted staging target; logical migration context |
| runtime database secret | `DB_RUNTIME_URL` | same hosted staging database; logical least-privilege runtime context |
| database trust material | `DB_TLS_CA_FILE` | absolute readable CA path; hostname verification and `rejectUnauthorized=true` remain mandatory |
| database access model | `P16_DATABASE_ACCESS_MODEL` | explicit `distinct-users` or `hostinger-managed-single-user`; never inferred from matching usernames |
| migration window | `P16_DATABASE_MIGRATION_WINDOW` | `disabled` for runtime; command-scoped `enabled` only during an authorized migration window |
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

It accepts only those four DML privileges on the exact staging schema plus optional global
`USAGE`. Broad, missing, foreign, DDL, administrative, role or grant-option results fail closed.
Neither the readiness response nor application logs include the grant statements. Hosted evidence
must separately confirm effective/inherited privileges, including `PUBLIC`, because provider
behavior cannot be proven locally.

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

For Hostinger MariaDB this explicitly includes migration privilege elevation, subsequent reduction,
current-user and inherited/public grant evidence, and correction of the observed hosted
`APP_URL=https://staging.lessenc.com.br` to the canonical `https://lessenc.com.br`.
