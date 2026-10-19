# LES-P17-CODEX-EXEC-R14-A — Pre-Publication Validation Report

Date: 14/10/2026

Final classification:

`READY FOR CONTROLLED PUBLICATION`

This classification means the local R13 changeset passed the authorized pre-publication audit. It
does not perform or authorize commit, push, merge, tag, deploy, branch-protection changes, provider
operations, P18 or production.

## 1. Identity and preservation

- repository: `C:\Projetos\lessenc-digital`;
- branch: `phase/p17-end-to-end-business-validation`;
- HEAD: `c9859b5f535cd102f5415485ebaa638210d5b399`;
- upstream: `origin/phase/p17-end-to-end-business-validation`;
- branch relation: ahead 0 / behind 0;
- index: empty;
- pending Git operations: none;
- R13 baseline before R14: exactly 16 changed/untracked paths, matching the R13 report;
- `package.json` SHA-256:
  `C90E9910EF438539597CAB5008290AC498E91F80035470742E9C09666FA7A463`;
- `package-lock.json` SHA-256:
  `E93A35F25C59CADF6BEA860759B447CC2F86DEC16CA562B0182BB5AC02902720`.

No commit, push, merge, tag, deploy, migration, backup, restart, hosted database access or provider
operation was performed.

## 2. Owner ratification registered

The owner expressly ratified on 14/10/2026:

- risk record: `LES-SEC-RA-001`;
- advisory: `GHSA-vfj7-8cjw-p6xm`;
- package: `braces@3.0.3`;
- scope: `DEVELOPMENT / CI ONLY`;
- expiration: 13/11/2026 23:59:59 America/Sao_Paulo;
- mandatory review: by P19 closeout or earlier;
- definitive remediation: mandatory before production;
- other vulnerabilities: no automatic acceptance.

The canonical record now states the ratification explicitly. Machine metadata changed only from
`PENDING_OWNER_RATIFICATION` to `OWNER_RATIFIED` and added `ratificationDate: 2026-10-14`.

The advisory, package, four allowed nodes, installed chain, lock edges, scope, effective time,
expiration, P19 review milestone, production prohibition and current fix metadata are unchanged.
The advisory is not classified as fixed or remediated.

The R13 validation report remains historical evidence of the pre-ratification state and was not
rewritten. This R14-A report supersedes only its pending-ratification statement.

## 3. Complete local path inventory

Final R13 plus R14-A worktree inventory: 17 paths.

1. `.github/workflows/quality-security.yml`
2. `MEMORY.md`
3. `docs/README.md`
4. `docs/operations/README.md`
5. `docs/operations/les-p17-codex-exec-r13-temporary-risk-acceptance-validation-report.md`
6. `docs/operations/les-p17-codex-exec-r14-a-pre-publication-validation-report.md`
7. `docs/operations/p17-ci-build-contract.md`
8. `docs/security/README.md`
9. `docs/security/les-sec-ra-001-policy.json`
10. `docs/security/les-sec-ra-001-temporary-braces-risk-acceptance.md`
11. `memory/2026-10-14.md`
12. `scripts/fixtures/p17-temporary-risk-audit/accepted-risk.json`
13. `scripts/lib/p17-temporary-risk-audit.d.mts`
14. `scripts/lib/p17-temporary-risk-audit.mjs`
15. `scripts/p17-production-risk-hard-stop.mjs`
16. `scripts/p17-temporary-risk-audit.mjs`
17. `scripts/p17-temporary-risk-audit.test.mjs`

R14-A changed only governance/documentation metadata and added this report/session record. It did not
change the evaluator, runner, hard stop, tests, fixture, workflow logic, application or dependency
graph approved in R13.

## 4. Technical diff audit

The complete R13 implementation was re-inspected. Effective controls:

- complete `npm audit --json` is executed by the evaluator;
- exact advisory recognition uses GHSA ID, npm source, package, severity, range, CWE and CVSS;
- the only allowed vulnerable graph has four exact nodes and versions;
- manifest, lockfile edges, installed tree and runtime-only tree are independently checked;
- another vulnerability entry, another advisory involving `braces`, changed fix metadata, changed
  version/chain, runtime inclusion, invalid/incomplete JSON, network/execution failure, timeout,
  signal, unauthorized scope/environment and expiry all fail closed;
- the accepted finding stays visible as `TEMPORARY_ACCEPTED_RISK`;
- production remains independently blocked by the local hard-stop executable.

Documented or externally pending controls:

- the hard-stop enforcement point in a future production workflow is specified but is not connected
  because no production pipeline exists in this repository;
- actual GitHub Actions Ubuntu execution requires controlled publication;
- effective `main` branch-protection association to the checks is not proven by local source;
- production remediation and hosted enforcement remain future owner-authorized work.

No commercial, payment, webhook, database, authentication, authorization, entitlement or delivery
behavior changed. `package.json`, `package-lock.json`, `prisma/`, `src/` and the CodeQL workflow have
zero diff from HEAD.

## 5. Required-check name preservation

The three source-defined job names are unchanged:

1. `Application gates`;
2. `CI verification build (no deploy authority)`;
3. `JavaScript and TypeScript analysis`.

The third name remains the CodeQL analysis job. Both workflows retain pinned actions and contain no
deploy step. Local source proves name preservation, not the authenticated branch-protection settings
on GitHub.

## 6. Regression results

| Validation | Result |
| --- | --- |
| temporary-risk policy matrix | PASS, 15/15 |
| real complete npm audit through evaluator | PASS as `TEMPORARY_ACCEPTED_RISK`; 4 exact HIGH, 0 CRITICAL |
| production hard stop | PASS by expected exit 1 |
| R51 toolchain verifier | PASS, 4/4 |
| R04-R1 CI build guard | PASS, 1 file / 86 tests |
| directed P16 contracts | PASS, 2 files / 29 tests |
| lint | PASS |
| Prisma generate + typecheck | PASS |
| general Vitest suite | PASS, 105 files / 1,118 tests |
| Prettier | PASS |
| local `build:ci` negative guard | PASS by expected refusal before build: `LOADABLE_ENVIRONMENT_FILE_PRESENT` |

The build guard was not bypassed, and no `.env*` content was read or changed. The local result is
`BLOCKED_LOCAL_BY_GUARD`, not build PASS. Actual `build:ci` execution remains pending in a future
clean Ubuntu checkout after separately authorized publication.

## 7. npm audit and production hard stop

Real evaluator result after ratification:

```text
classification: TEMPORARY_ACCEPTED_RISK
advisory: GHSA-vfj7-8cjw-p6xm
package: braces@3.0.3
expirationRatification: OWNER_RATIFIED
HIGH: 4
CRITICAL: 0
productionAllowed: false
```

The four HIGH nodes reconcile only the one ratified advisory:

```text
@next/eslint-plugin-next@16.3.8
-> fast-glob@3.3.1
-> micromatch@4.0.8
-> braces@3.0.3
```

Production hard-stop result:

```text
LES-SEC-RA-001 PRODUCTION PROMOTION BLOCKED:
LES_SEC_RA_001_PRODUCTION_HARD_STOP_ACTIVE
```

The expected hard-stop exit code is 1 while the risk record is active.

## 8. Security and diff integrity

- `git diff --check`: PASS;
- changed/untracked path whitespace and conflict-marker scan: PASS;
- secret/credential-pattern and sensitive-filename scan: PASS, 17 paths / 0 findings;
- dependency and lockfile changes: none;
- application/Prisma changes: none;
- six R13 executable/test/fixture file hashes: unchanged from the reviewed R13 closeout;
- staged paths: zero.

The final 17-path inventory matches the report exactly. No unexpected path was added or removed.

## 9. Residual risks

- `braces@3.0.3` remains vulnerable in development/CI tooling.
- CI/lint availability and development supply-chain exposure remain accepted only within the exact
  ratified scope and time window.
- Registry/advisory/fix metadata can drift and intentionally causes a fail-closed result.
- GitHub Actions execution and authenticated required-check configuration remain unverified until
  controlled publication.
- The production hard stop is locally effective but only documented for future production-pipeline
  integration.
- Definitive remediation remains mandatory before production.

## 10. Divergences

Unexpected divergences: none.

Expected retained limitation: local `build:ci` remains blocked by the preexisting loadable `.env*`
guard. This control was preserved; no bypass was attempted.

## 11. Final classification

All authorized identity, ratification, audit and regression gates passed.

`LES-P17-CODEX-EXEC-R14-A = PASS`

`LES-SEC-RA-001 = TEMPORARY_ACCEPTED_RISK / OWNER_RATIFIED`

`PRE-PUBLICATION = READY FOR CONTROLLED PUBLICATION`

`PRODUCTION HARD STOP = ACTIVE`

`P17 = PARTIALLY COMPLETE`

`GATE D = NOT_READY`

`P18 = NOT STARTED`

`PRODUCTION = UNAUTHORIZED`

STOP GATE applies. Await explicit owner authorization before commit or push of the R13/R14-A
changeset to the P17 branch.
