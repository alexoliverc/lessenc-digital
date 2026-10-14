# LES-P17-CODEX-EXEC-R13 — Temporary Risk Acceptance Validation Report

Date: 14/10/2026

Final classification:

`LOCAL IMPLEMENTATION PASS / TEMPORARY ACCEPTED RISK / PRODUCTION HARD STOP ACTIVE`

This report does not declare the vulnerability fixed, P17 complete, Gate D ready or production
authorized.

## 1. Git Preservation

- repository: `C:\Projetos\lessenc-digital`;
- branch: `phase/p17-end-to-end-business-validation`;
- initial HEAD: `c9859b5f535cd102f5415485ebaa638210d5b399`;
- upstream: `origin/phase/p17-end-to-end-business-validation`;
- initial branch relation: ahead 0 / behind 0;
- initial worktree and index: clean;
- no merge, rebase, cherry-pick or revert operation was active;
- P16, R51, R04-R1, R07 and R10 source/history were preserved;
- no commit, push, merge, tag, deploy, migration, backup, restart or provider operation was
  performed.

The implementation remains exclusively in the local worktree. `main` and the remote branch were not
changed.

## 2. Formal Risk Record

The canonical record is
[`LES-SEC-RA-001`](../security/les-sec-ra-001-temporary-braces-risk-acceptance.md), with a separate
[machine-readable policy](../security/les-sec-ra-001-policy.json).

Recorded classification:

`TEMPORARY ACCEPTED RISK / HIGH / DEVELOPMENT-CI ONLY / PRODUCTION BLOCKED`

The record includes owner authority, advisory and package identity, exact dependency chain,
non-runtime evidence, residual availability/supply-chain risks, evidence limitations, compensating
controls, monitoring, revocation criteria, expiry, mandatory P19 review and pre-production
remediation duty.

## 3. Scope and Expiration

The only accepted evaluator scope is `P17_DEVELOPMENT_CI_PRE_PRODUCTION` with application environment
`test`. Staging/production scope is rejected.

Effective window:

- effective: 14/10/2026 00:00:00 America/Sao_Paulo;
- provisional technical expiry: 13/11/2026 23:59:59 America/Sao_Paulo;
- expiry ratification: `PENDING_OWNER_RATIFICATION`;
- mandatory review: `P19_CLOSEOUT_OR_EARLIER`.

The owner must ratify or replace the provisional deadline. The evaluator automatically fails after
it; there is no open-ended fallback.

## 4. Audit Policy Design

`scripts/p17-temporary-risk-audit.mjs` executes, without a command shell and with bounded output/time:

1. complete `npm audit --json`;
2. installed-tree `npm ls` for the four affected nodes;
3. runtime-only `npm ls braces --omit=dev --all --json`.

The evaluator then verifies:

- policy identity, scope, environment and time window;
- complete audit schema and internally consistent counts;
- manifest classification;
- exact lockfile nodes, `dev: true` flags and dependency edges;
- exact installed versions and logical chain;
- absence of every allowed node from the runtime tree;
- exact advisory metadata and current fix metadata;
- absence of any other vulnerability/advisory.

Exit 1 from npm is accepted only as transport of structurally valid audit JSON containing the exact
approved finding. Network/registry failure, timeout, signal, invalid JSON, incomplete JSON or another
exit/result combination fails closed.

## 5. Exact Allowed Advisory

- risk record: `LES-SEC-RA-001`;
- advisory: `GHSA-vfj7-8cjw-p6xm` / npm source `1240992`;
- package: `braces@3.0.3`;
- severity: `HIGH`;
- exact vulnerable nodes:
  - `@next/eslint-plugin-next@16.3.8`;
  - `fast-glob@3.3.1`;
  - `micromatch@4.0.8`;
  - `braces@3.0.3`.

The real evaluator output remained explicit:

`TEMPORARY_ACCEPTED_RISK / 4 HIGH / 0 CRITICAL / productionAllowed=false`

It did not print or infer zero vulnerabilities.

## 6. Fail-Closed Regression Matrix

| Scenario | Expected/observed result |
| --- | --- |
| exact approved advisory only | PASS with `TEMPORARY_ACCEPTED_RISK` warning |
| complete audit with zero vulnerabilities | PASS without accepted-risk claim |
| another HIGH | FAIL |
| CRITICAL | FAIL |
| second advisory involving braces | FAIL |
| version/dependency-chain change | FAIL |
| braces in runtime tree | FAIL |
| network/execution failure | FAIL |
| invalid JSON | FAIL |
| incomplete JSON | FAIL |
| expired policy | FAIL |
| unauthorized scope | FAIL |
| production application environment | FAIL |
| active-risk production promotion | FAIL |
| explicit future remediated state | hard-stop checker can pass only with `REMEDIATED` plus production authorization |

Automated result: 15/15 policy tests PASS.

## 7. Local CI Integration

The `Application gates` job name and its existing lint, typecheck, general tests and R51 step were
preserved. The former raw audit command was replaced by:

- deterministic policy regression;
- complete structured audit through the evaluator.

There is no `continue-on-error`, `|| true`, reduced audit level, `audit=false` or `--omit=dev`
substitution for the full audit. The independent `CI verification build (no deploy authority)` job,
its pinned actions and `build:ci` contract remain unchanged. CodeQL remains in its separate existing
workflow. No deployment step was added.

The edited workflow was not executed on GitHub Actions because publication is prohibited. Its actual
Ubuntu execution and effective branch-protection requirement remain unverified external evidence.

## 8. Production Hard Stop

`scripts/p17-production-risk-hard-stop.mjs` reads the same policy and returns non-zero while the
record is active. Local proof returned:

`LES-SEC-RA-001 PRODUCTION PROMOTION BLOCKED: LES_SEC_RA_001_PRODUCTION_HARD_STOP_ACTIVE`

The required future enforcement point is before every production artifact build/promotion,
production migration, provider credential activation, deploy, DNS/current-version switch or real
transaction. A future owner-authorized production workflow must make the hard stop a mandatory
predecessor and prove both active-risk rejection and remediated-state progression on its actual
runner.

No production pipeline exists in the current repository, so hosted enforcement is not claimed.

## 9. Tests Executed

| Validation | Result |
| --- | --- |
| temporary-risk policy regression | PASS, 15/15 |
| real complete npm audit through evaluator | PASS as `TEMPORARY_ACCEPTED_RISK`, 4 exact HIGH, 0 CRITICAL |
| production hard stop | PASS by expected non-zero rejection |
| R51 toolchain verifier regression | PASS, 4/4 |
| R04-R1 CI build guard | PASS, 1 file / 86 tests |
| directed P16 contracts | PASS, 2 files / 29 tests |
| lint | PASS |
| Prisma generate + typecheck | PASS |
| general Vitest suite | PASS, 105 files / 1,118 tests |
| Prettier format check | PASS |
| `git diff --check` plus all-path whitespace/conflict scan | PASS |
| secret/credential-pattern and sensitive-filename scan | PASS, 16 changed/untracked paths, 0 findings |
| local `build:ci` attempt | `BLOCKED_LOCAL_BY_GUARD`; preexisting loadable `.env*` presence detected, build not started |

The real audit used Node `24.21.0` and npm `11.19.1`. No dependency install, update, override or audit
fix was executed.

The first local `build:ci` attempt also used a nonconforming temporary-storage path and was rejected
for both that reason and the loadable environment-file presence. After correcting only the synthetic
path, the guard again rejected the run solely with `LOADABLE_ENVIRONMENT_FILE_PRESENT`. No `.env*`
content was read or changed, and the build subprocess did not start. This is a fail-closed guard
result, not a build PASS or application failure.

Still dependent on GitHub Actions Ubuntu:

- YAML/workflow execution on the hosted runner;
- actual `build:ci` execution in the clean Ubuntu checkout;
- policy evaluator behavior against the runner's registry/network conditions;
- continued independence of the two workflow jobs;
- actual required-check/branch-protection configuration;
- future production-workflow enforcement, once such a workflow is authorized and exists.

## 10. Source Diff

Changed surfaces are limited to:

- `.github/workflows/quality-security.yml`;
- canonical security record/policy and indexes;
- P17 CI contract and this validation report;
- evaluator, production hard stop, declaration, synthetic fixture and regression tests;
- consolidated/project daily memory.

`package.json`, `package-lock.json`, dependencies, Next.js, application runtime, payments,
authentication, Prisma schema/migrations and provider configuration are unchanged. The lockfile
remains at SHA-256
`E93A35F25C59CADF6BEA860759B447CC2F86DEC16CA562B0182BB5AC02902720`.

The complete 16-path local changeset was reviewed. The index remains empty.

## 11. Residual Risks

- The vulnerable development dependency remains installed and can affect CI/lint availability.
- The accepted condition remains a supply-chain exposure in development tooling.
- Advisory/fix metadata can change after this local evaluation; drift intentionally blocks.
- Registry/network availability remains necessary for authoritative audit evidence.
- The provisional expiry is not yet owner-ratified.
- GitHub Actions execution and effective `main` required-check configuration remain unverified.
- Production hard-stop enforcement is specified/tested locally but not integrated into a
  nonexistent production workflow.

## 12. Owner Decisions Remaining

1. Ratify or replace the provisional expiry of 13/11/2026 23:59:59 America/Sao_Paulo.
2. After review, separately authorize publication if the local implementation is accepted.
3. Before production, authorize definitive remediation and the production pipeline enforcement
   work; this temporary record cannot authorize production.

## 13. Final Classification

`LES-P17-CODEX-EXEC-R13 = LOCAL IMPLEMENTATION PASS`

`LES-SEC-RA-001 = TEMPORARY_ACCEPTED_RISK / OWNER EXPIRY RATIFICATION PENDING`

`PRODUCTION HARD STOP = ACTIVE / LOCALLY PROVEN / HOSTED ENFORCEMENT NOT YET PRESENT`

`P17 = PARTIALLY COMPLETE`

`GATE D = NOT_READY`

`P18 = NOT STARTED`

`PRODUCTION = UNAUTHORIZED`

STOP GATE applies before commit, push, merge, tag or deploy.
