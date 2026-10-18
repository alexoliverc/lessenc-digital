# P18-04–P18-09 — Completion Phase Execution Brief

**Brief ID:** `LES-P18-COMPLETION-BRIEF-R01`

**Owner authority:** `LES-OWNER-AUTH-P18-COMPLETION-20261018-R01`

**Governance:** [ADR-0013](../decisions/ADR-0013-p18-completion-execution-mandate.md)

**Integration branch:** `phase/p17-end-to-end-business-validation`

**Starting baseline:** `183ed6825b726556f22c5eac3361d71caf0ee9b6`

**Status:** EXECUTION AUTHORIZED / INDEPENDENT ACCEPTANCE RESERVED

## Objective

Execute P18-04 through P18-09, repair safely remediable readiness gaps, validate the current source,
and deliver a reproducible production-readiness dossier without activating production or inventing
external evidence.

## Inherited truth

P18-01 through P18-03 are preparatory candidates and remain evidence inputs rather than technical
acceptance. Reconcile, do not silently replace, their 57 controls, 15 deferred P17 items and 31
risk/blocker records. Gate D starts `NOT_READY`; Gate E and production remain unauthorized.

## Work packages and acceptance

| Subphase | Required output | Internal acceptance |
| --- | --- | --- |
| P18-04 | unified current-state evidence matrix | exact 57/15/31 reconciliation, source references and explicit authority per result |
| P18-05 | security/privacy assessment and safe remediations | regressions pass; residual risks/deadlines visible; no legal-certification claim |
| P18-06 | data/recovery assessment and safe isolated proofs | schema/release compatibility and recovery limits explicit; no destructive shared target |
| P18-07 | commerce/delivery/operations validation | fail-closed scenarios proved at their actual layer; external blockers preserved |
| P18-08 | release-candidate and non-activating launch package | immutable Git identity, build/migration/config provenance, rollback/STOP criteria |
| P18-09 | executive and technical dossier | complete traceability, hashes, risks, Gate D/E conditions and independent-review handoff |

## Technical constraints

- Use isolated worktrees and small traceable PRs targeting only the authorized P17 integration
  branch.
- Refresh and recheck the target HEAD before every integration; never overwrite concurrent work.
- Preserve financial and access authority. Unknown/ambiguous states fail closed.
- Do not read `.env` files or capture secret values. Configuration evidence uses names, presence
  state and sanitized metadata only.
- Local proof stays local; TEST stays TEST; historical P16/P17 evidence stays bound to its recorded
  release.
- Prefer official supported dependency remediation. If no supported patch exists, keep the finding
  visible and document any bounded mitigation or maintained patch separately; never manufacture a
  clean audit by exclusion.

## Required validation

As applicable to each diff:

- Prettier, ESLint, TypeScript and Prisma validation;
- focused unit/security/adversarial tests and complete unit regression;
- isolated MySQL integration regression for persistence-sensitive changes;
- real-Chromium E2E and performance infrastructure where the work package affects those contracts;
- production build without deployment;
- full and runtime-only dependency audit;
- GitHub Quality/security and CodeQL checks before and after integration;
- Markdown/link/hash/count integrity for evidence documents;
- staged/diff secret scan and complete diff review.

A command not run is `NOT EXECUTED` with its reason. A failed mandatory gate blocks the affected
integration until fixed or explicitly carried as a blocker.

## External and irreversible stop gates

Stop the dependent path before production, real money, PROD credentials, DNS/traffic mutation,
destructive migration/restore, deletion, or an irreversible provider operation. Continue independent
local/documentary work and record the blocker.

## Git integration contract

For each work package: branch from the latest confirmed P17 HEAD, implement, validate, review the
full diff, commit, push, open a PR, wait for mandatory Quality/security and CodeQL success, merge
without force, inspect merge parents/files/checks, and confirm `main` is unchanged. Do not create a
permanent P18 tag before independent acceptance.

## Final report

The P18-09 dossier must distinguish implementation, correction, documentation and unresolved work;
list files, commands, tests, Git/PR identities and residual risks; state Gate D, Gate E, release and
production separately; and include SHA-256 manifests sufficient for independent reproduction.

The execution ends at handoff. It does not begin P19 or assign Gate E GO.
