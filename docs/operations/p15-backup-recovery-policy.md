# P15 Backup, Restore and Recovery Policy

**Status:** OWNER-APPROVED RELEASE OBJECTIVES / HOSTED VALIDATION STILL PENDING

**Objective governance:** `OWNER APPROVED RELEASE OBJECTIVE / HOSTED VALIDATION REQUIRED IN P16`

## Recovery unit

The minimum recoverable unit remains the frozen P11 contract:

1. application database dump;
2. private digital-resource storage hierarchy;
3. Prisma migration inventory and hashes;
4. manifest and per-artifact integrity hashes.

A database-only or storage-only copy is not an acceptable platform backup.

## Integrity and confidentiality

Every backup must be independently verified before it can count toward recovery coverage.

Production implementation must provide:

- encryption in transit;
- encryption at rest with keys separated from the backup payload;
- at least one off-site/provider-failure-domain copy;
- access restricted by least privilege;
- immutable or deletion-resistant retention where the selected provider supports it;
- auditability of creation, verification, expiration and restore access;
- no secrets, complete database URLs, absolute private paths or raw access credentials in manifests.

Provider selection and key-management implementation remain P16/P18 decisions.

## Proposed release objectives

Every value in this section is `OWNER APPROVED RELEASE OBJECTIVE / HOSTED VALIDATION P16`. They
must still be measured in staging and are not achieved production guarantees.

| Objective | Proposed target | Current proof | Required next evidence |
| --- | --- | --- | --- |
| RPO | no more than 24 hours | local self-contained P11 bundle only | scheduled hosted backup plus loss-window drill in P16 |
| RTO | no more than 8 hours | local disposable restore duration is diagnostic only | timed hosted staging restore and application verification in P16 |
| daily retention | 7 verified daily recovery points | policy only | provider lifecycle proof |
| weekly retention | 4 verified weekly recovery points | policy only | provider lifecycle proof |
| monthly retention | 3 verified monthly recovery points | policy only | provider lifecycle proof |

If the approved values cannot be met by P16 evidence, P18 must explicitly revise them or return
NO-GO. A local restore time must never be relabeled as production RTO.

## Backup schedule policy

The proposed release policy, still pending owner approval, would require:

- at least one verified complete recovery unit every 24 hours;
- an on-demand verified recovery point before a schema migration or material release;
- verification immediately after creation;
- an alert on creation/verification failure;
- a periodic restore drill, initially at least once before production GO and after material changes
  to persistence/storage architecture.

No production scheduler is installed by P15.

## Restore procedure

The frozen detailed procedure remains
[`p11-backup-restore-runbook.md`](p11-backup-restore-runbook.md). Every restore must:

1. identify the incident and recovery objective;
2. select and independently verify a bundle;
3. verify target environment identity;
4. protect unrelated databases and storage roots;
5. obtain explicit authorization for the exact destructive target;
6. restore into an isolated target first;
7. validate DDL, constraints, migration history, data hashes and storage hashes;
8. validate application behavior against the restored target;
9. reconcile the recovery point against the owner-approved RPO;
10. obtain explicit cutover authorization;
11. retain incident evidence without secrets.

`npm run ops:p15:restore-validate -- --bundle <path>` verifies a bundle only. It does not create,
drop or restore a database and does not copy storage into a live target.

## Production safeguards

- Never restore destructively into `lessenc_dev`, `lessenc_test`, staging or production without an
  authorization naming that exact target.
- Never use `prisma migrate reset` or `prisma db push` as a recovery procedure.
- Never query Mercado Pago to invent commercial state during recovery.
- Never reconstruct raw Buyer Access credentials; only persisted hashes and authorized rotation
  semantics exist.
- An orphaned storage object grants no entitlement.
- A missing storage object is an operational delivery failure and does not revoke the commercial
  right.

## Application rollback versus data recovery

Application rollback changes the deployed application artifact to a previously approved compatible
version. It does not reverse a migration, restore rows, restore storage or undo financial events.

Database/data recovery restores a validated recovery unit under explicit destructive and cutover
authorization. It requires consistency and business-state verification.

If a release contains an additive migration, the rollback artifact must remain forward-compatible
with the migrated schema. An incompatible schema change requires its own approved roll-forward or
data-recovery plan; application rollback alone is unsafe.

## Current evidence and limits

P11 proved bundle generation/verification and a destructive restore only against the disposable
local `lessenc_test_rebuild` target, followed by semantic equivalence and application tests. P15
reuses that evidence and revalidates the preserved bundle non-destructively.

P15 performs no production/staging restore, backup scheduling, encryption setup, provider
replication or destructive database operation.
