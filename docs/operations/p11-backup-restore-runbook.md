# P11 Backup and Restore Runbook

Status: P11-C6.5 = COMPLETE / PASS / DOCUMENTED / FROZEN

## Purpose

This runbook defines the frozen backup and restore contract for P11 Entitlement & Secure Digital Delivery.

The recovery unit is composed of:

1. the application database;
2. the private digital-resource storage tree.

A database-only backup is insufficient.

A storage-only backup is insufficient.

A restore is not proven until database structure, application data, migration history, private storage integrity, and application behavior have been validated.

## Backup contract

The frozen P11 backup bundle contains:

- database.sql;
- manifest.json;
- the private storage hierarchy.

The manifest format is version 1.

The manifest records safe recovery metadata including:

- backup identifier;
- UTC creation time;
- safe source database name;
- database dump byte size;
- database dump SHA-256;
- Prisma migration names;
- Prisma migration SHA-256;
- storage file count;
- storage total bytes;
- relative storage paths;
- per-file byte size;
- per-file SHA-256.

The manifest must not contain:

- database passwords;
- complete database URLs;
- application secrets;
- HMAC or session secrets;
- Mercado Pago credentials;
- cookies;
- authorization headers;
- raw Buyer Access credentials;
- private keys;
- absolute private-storage paths.

## Database backup

The proven database backup mechanism is:

mysqldump --single-transaction

The C6.5 proof confirmed that the backup dump does not contain database-routing operations such as:

- CREATE DATABASE;
- DROP DATABASE;
- USE database;
- schema-qualified lessenc_dev routing.

Backup generation does not mutate application data.

## Private storage backup

Private storage is included in the same recovery unit as the database.

Every copied storage object is represented by a safe relative path and SHA-256.

The backup implementation rejects unsafe conditions including:

- path escape;
- unsafe relative paths;
- symlink or reparse ambiguity;
- unsupported filesystem objects;
- selected secret or configuration files.

The local proof used two controlled fixture objects.

Both objects continued to verify after the original fixture source was deleted, proving that the generated backup bundle was self-contained.

## Backup verification

The backup verifier checks:

- manifest version;
- database dump presence;
- database byte size;
- database SHA-256;
- storage inventory;
- per-file storage SHA-256;
- safe relative storage paths;
- Prisma migration inventory;
- migration SHA-256.

C6.5 backup proof:

- backup generator: PASS;
- real local backup: PASS;
- database dump verification: PASS;
- migration hashes: 5/5;
- storage hashes: 2/2;
- self-contained bundle: PASS;
- secret exposure: none detected;
- targeted backup tests: 7/7;
- full unit tests: 379/379;
- full MySQL integration tests: 122/122;
- typecheck: PASS;
- lint: PASS.

## Restore safety boundary

The authorized disposable restore database was:

lessenc_test_rebuild

The protected databases were:

- lessenc_dev;
- lessenc_test.

The restore target was verified as local:

- host: 127.0.0.1;
- port: 3307;
- database: lessenc_test_rebuild.

The P06 fresh-deploy guard passed before destructive execution.

Explicit destructive authorization was limited exclusively to lessenc_test_rebuild.

No destructive authorization was granted for:

- lessenc_dev;
- lessenc_test;
- staging;
- production.

## Restore procedure

The proven recovery sequence is:

1. verify the backup bundle;
2. verify the disposable restore target;
3. capture protected-database integrity baselines;
4. obtain explicit destructive authorization;
5. drop only the authorized disposable database;
6. recreate only the authorized disposable database;
7. restore database.sql;
8. restore private storage into an isolated recovery root;
9. validate the restored table set;
10. validate database charset and collation;
11. validate exact table definitions;
12. validate foreign keys;
13. validate indexes;
14. validate application data;
15. validate Prisma migration history;
16. validate storage SHA-256;
17. cross-check database storage references;
18. validate the application against the restored target;
19. re-prove protected databases unchanged.

The physical restore drill executed DROP DATABASE and CREATE DATABASE only against lessenc_test_rebuild.

## Restore equivalence

Raw whole-file SHA-256 equality between two separately generated aggregate mysqldump files is not the canonical restore-equivalence gate.

During C6.5, the raw aggregate dump hash differed even though the source and restored databases were semantically equivalent.

The first raw difference was classified inside CREATE TABLE body serialization.

Canonical restore equivalence is instead proven by deterministic semantic checks.

C6.5 equivalence results:

- table set: 16/16 PASS;
- database charset: PASS;
- database collation: PASS;
- table engine metadata: PASS;
- table collation metadata: PASS;
- row format metadata: PASS;
- AUTO_INCREMENT metadata: PASS;
- create options: PASS;
- exact SHOW CREATE TABLE: 16/16 PASS;
- foreign-key signature: PASS;
- index signature: PASS;
- per-table row counts: PASS;
- per-table data SHA-256: 16/16 PASS;
- Prisma migrations: 5/5 PASS;
- triggers: 0/0 PASS;
- routines: 0/0 PASS;
- events: 0/0 PASS.

The raw aggregate dump hash remains a diagnostic artifact only.

It is not the canonical restore-equivalence criterion.

## Database and storage consistency

Every DigitalResource.storageKey must resolve safely inside the restored private-storage root.

The database remains the authorization authority.

An orphan storage object does not grant entitlement or delivery rights.

The local C6.5 drill proved:

- restored storage SHA-256: 2/2 PASS;
- missing DB-referenced storage files: 0.

The source database contained zero DigitalResource rows at backup time.

Therefore the two controlled restored fixture files were intentionally unreferenced.

## Application validation

A structurally correct restore is not sufficient.

The restored state must also function through the application.

The application was temporarily routed to lessenc_test_rebuild for C6.5-C2B.

Post-restore validation results:

- restored-target MySQL test files: 10/10 PASS;
- restored-target MySQL tests: 122/122 PASS;
- post-test restored tables: 16;
- post-test restored migrations: 5;
- full unit test files: 31/31 PASS;
- full unit tests: 379/379 PASS;
- typecheck: PASS;
- lint: PASS.

lessenc_dev remained logically unchanged.

lessenc_test remained logically unchanged.

No second DROP, CREATE DATABASE, or restore was performed during application validation.

## Commercial and security invariants

Backup and restore do not reinterpret payment-provider state.

Recovery must not:

- query Mercado Pago to reconstruct entitlement state;
- invent commercial rights;
- invent an entitlement;
- invent a Buyer Access credential;
- expose a raw Buyer Access credential;
- weaken the resource-authorization chain;
- revoke commercial rights merely because storage or backup failed.

Commercial and authorization truth is restored from backed-up application state.

## Evidence

Local engineering evidence is stored under:

output/p11/c6.5/

Evidence exists for:

- backup creation;
- independent backup verification;
- physical restore;
- restore-equivalence diagnosis;
- application validation.

The output directory is Git-ignored.

Local engineering evidence is not a production retention system.

## RPO, RTO, and retention

The following production operational decisions remain OPEN:

- RPO;
- RTO;
- backup retention;
- production backup schedule;
- production backup encryption;
- off-site backup replication;
- production backup provider.

The measured local restore duration is not a production RTO.

No production RTO has been defined by C6.5.

## Frozen result

P11-C6.5-A Technical Preflight = COMPLETE / PASS

P11-C6.5-B Backup and Restore Design = FROZEN

P11-C6.5-C1 Backup Implementation = COMPLETE / PASS

P11-C6.5-C2A Physical Restore Drill = COMPLETE / PASS

P11-C6.5-C2B Application Validation = COMPLETE / PASS

P11-C6.5 = COMPLETE / PASS / DOCUMENTED / FROZEN

Next checkpoint:

P11-C6.6 — Observability / Alerts

<!-- P11-C6.6-OBSERVABILITY-ADDENDUM -->

## C6.6 observability addendum

P11-C6.6 does not change the frozen physical backup or restore contract established by C6.5.

It adds safe operational failure signaling around backup verification and restore validation.

Backup verification failure emits `backup_verification_failed` with `BACKUP_VERIFICATION_FAILED`.

Restore validation failure emits `restore_validation_failed` with `RESTORE_VALIDATION_FAILED`.

Both signals use the `BACKUP_RESTORE` surface, `FAILED` outcome, and a server-generated correlation ID.

The CLI no longer exposes arbitrary `error.message` values. Its generic failure boundary is `P11_BACKUP_ERROR=BACKUP_OPERATION_FAILED`.

C6.6 also adds `restore-validate`, which reuses the frozen bundle verifier before a future restore operation.

`restore-validate` is read-only and is not a restore executor.

It does not drop or create databases, import `database.sql`, restore private storage, or mutate application state.

A successful validation produces `RESTORE_BUNDLE_VALIDATED=1`.

The authorized C6.5 physical restore drill against `lessenc_test_rebuild` remains the canonical physical restore evidence.

RPO, RTO, backup retention, production scheduling, production encryption, off-site replication, and production provider selection remain OPEN.
