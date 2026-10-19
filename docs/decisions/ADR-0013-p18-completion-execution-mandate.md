# ADR-0013 — P18 completion execution mandate

**Status:** ACCEPTED — owner mandate `LES-OWNER-AUTH-P18-COMPLETION-20261018-R01`

**Date:** 2026-10-18

**Phases:** P18-04 through P18-09

## Context

ADR-0012 separated the administrative closeout of P17 from technical Gate D acceptance and allowed
only documentary preparation in P18. P18-01 through P18-03 produced the initial inventory,
architecture/security review and operational-readiness package. Their evidence boundaries and the
unresolved P17 items remain valid.

The owner has now issued a later, explicit mandate for the controlled technical completion of
P18-04 through P18-09. This is execution authority, not independent acceptance, Gate E authority or
production-launch authority.

## Decision

The execution team may, inside P18 and on isolated worktrees:

- inspect the complete repository, current Git/GitHub state and versioned configuration;
- change application code, tests, scripts, dependencies and documentation when demonstrably
  necessary for P18 readiness;
- change authentication, authorization, payments, webhooks, storage or database implementation
  only through minimal, reversible and tested changes that preserve fail-closed behavior;
- execute local/isolated validations and safe TEST/STAGING checks when target identity, isolation,
  rollback and evidence authority are explicit;
- create branches, commits, pushes and pull requests and merge approved work packages only into
  `phase/p17-end-to-end-business-validation` after required checks pass;
- progress from P18-04 through P18-09 without a new approval for each reversible in-scope work
  package.

The canonical integration baseline at authorization is
`183ed6825b726556f22c5eac3361d71caf0ee9b6`, merge commit of PR #62. `main` remains fixed outside
this mandate at `6e269e6db928b228babd8ffd44c3f55574cade4c`.

## Evidence and subphase contract

The normalized execution sequence is:

1. **P18-04 — Consolidated Readiness & Evidence Assessment:** reconcile 57 controls, 15 P17
   deferred items and 31 risk/blocker records against current implementation.
2. **P18-05 — Security, Privacy & Compliance Readiness:** inspect and safely remediate security,
   privacy, supply-chain and financial-integrity gaps, including `LES-SEC-RA-001`.
3. **P18-06 — Data Integrity, Backup & Disaster Recovery Readiness:** validate persistence,
   recovery, RPO/RTO, retention, off-R2 and release/schema compatibility without destructive shared
   data operations.
4. **P18-07 — Commerce, Delivery & Operational Validation:** validate the commercial and
   operational paths, preserving provider/hosted blockers that cannot be proved safely.
5. **P18-08 — Release Engineering & Operational Go/No-Go Preparation:** identify a reproducible
   release candidate and prepare non-activating launch/rollback material.
6. **P18-09 — Final Production Readiness Review & CEO Decision Dossier:** consolidate evidence and
   issue a preparatory recommendation for independent review.

Permitted evidence classifications are `PROVEN`, `PARTIALLY PROVEN`, `BLOCKED`, `NOT EXECUTED`,
`UNKNOWN` and `NOT APPLICABLE`, qualified by the applicable local, Git, hosted, provider or
independently correlated authority. Absence of evidence never becomes PASS.

## Non-delegated and prohibited operations

This mandate does not authorize:

- modifying or merging into `main`, moving historical tags or creating a permanent P18 completion
  tag before independent acceptance;
- production deploy, DNS/traffic switch, Mercado Pago PROD activation, real purchase or real-money
  transaction;
- forcing `PAID`, `APPROVED` or `Entitlement.ACTIVE`, bypassing HMAC/MFA/RBAC/rate limits, or adding
  permissive compatibility fallbacks;
- destructive migration or restore against a shared database, deletion of commercial data or
  backups, or an irreversible provider operation without additional target-specific authority;
- reading, printing, persisting or transmitting secret values, raw signatures, cookies, passwords,
  personal data or financial identifiers as evidence;
- declaring Gate D PASS, Gate E GO, production readiness or legal certification without the complete
  required evidence and the reserved owner/ChatGPT review.

TEST/STAGING work must remain non-production, bounded and recoverable. A blocker that requires any
prohibited operation stays open.

## Relationship to ADR-0012

ADR-0012 remains the historical and normative source for P17 administrative closeout, the deferred
item set and the fail-closed production sequence. This ADR supersedes only ADR-0012's earlier limit
that P18 could perform documentary preparation exclusively. It does not rewrite past authority or
promote any historical evidence.

The mandatory states remain:

- `P17 = ADMINISTRATIVELY CLOSED / DEFERRED ITEMS`;
- `P17-E05 = BLOCKED / DEFERRED` until complete new evidence proves otherwise;
- `GATE D = NOT_READY` until all applicable Gate D criteria are demonstrated;
- `P18 = PREPARATORY EXECUTION AUTHORIZED / OWNER EXCEPTION`;
- `GATE E = GO NOT AUTHORIZED`;
- `P19 = FUTURE PREPARATION / PRODUCTION ACTIVATION CONDITIONED`;
- `PRODUCTION = NOT AUTHORIZED`.

## Completion and independent review

Each work package requires diff review, applicable tests, secret scanning, CI and CodeQL evidence,
and exact Git identity. The final permissible P18 outcome may be
`PREPARATORY REVIEW COMPLETE`, `FORMAL READINESS PENDING`, `NO-GO RECOMMENDED` or `GO CANDIDATE`.
Only the owner, with the reserved independent ChatGPT review, may accept P18 and decide Gate E.
