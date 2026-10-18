# LES-SEC-RA-001 — Temporary braces risk acceptance

> **Estado histórico encerrado em 18/10/2026.** A condição foi substituída pela
> [remediação mantida de `braces`](les-sec-ra-001-braces-remediation.md). Este documento permanece
> imutável como registro da aceitação temporária; não é mais a política operacional vigente.

## Decision

The owner of L'Essenc Digital expressly accepts, temporarily and only for the pre-production
development/CI path, the known risk identified as `GHSA-vfj7-8cjw-p6xm` in `braces@3.0.3`.

Classification:

`TEMPORARY ACCEPTED RISK / HIGH / DEVELOPMENT-CI ONLY / PRODUCTION BLOCKED`

This record does not classify the vulnerability as fixed, remediated, suppressed or absent. The
finding must remain visible whenever it is present. Definitive remediation remains mandatory before
production.

The machine-readable policy is
[`les-sec-ra-001-policy.json`](les-sec-ra-001-policy.json). It is the exact evaluator contract, not a
replacement for this risk analysis.

## Advisory and affected package

- advisory: `GHSA-vfj7-8cjw-p6xm`;
- npm advisory source: `1240992`;
- package: `braces@3.0.3`;
- severity: `HIGH`;
- weakness: `CWE-674`;
- CVSS 3.1: `7.5 / AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`;
- affected range reported on 14/10/2026: `<=3.0.3`;
- risk class: stack-exhaustion denial of service through deeply nested patterns.

The current `npm audit --json` result reports four HIGH vulnerability nodes, all representing that
single advisory through the following exact development-tooling chain:

```text
lessenc-digital@0.1.0
└─ @next/eslint-plugin-next@16.3.8 (direct devDependency)
   └─ fast-glob@3.3.1
      └─ micromatch@4.0.8
         └─ braces@3.0.3 (GHSA-vfj7-8cjw-p6xm)
```

The currently reported automatic fix is `@next/eslint-plugin-next@14.2.35` and is marked as a
semver-major change relative to the installed chain. This record does not authorize that downgrade,
an override, a fork, a patch, an artificial version change or a lockfile change.

## Scope and temporary validity

Authorized scope:

- complete dependency audit in the P17 pre-production development/CI quality path;
- exact application environment `test`;
- local source implementation and future GitHub Actions validation after separately authorized
  publication;
- continuation of technical review toward P18/P19 without treating a green development CI result as
  production authorization.

Outside scope:

- staging or production promotion authority;
- production build, deploy, provider activation, migration, DNS/current-version switch or real
  transaction;
- any other advisory, package, version, dependency chain, severity or runtime occurrence;
- bypassing audit execution or accepting malformed/partial evidence.

The policy is effective from 14/10/2026. On that same date, the owner expressly ratified the exact
expiration of 13/11/2026 23:59:59 America/Sao_Paulo for the `DEVELOPMENT / CI ONLY` scope. The
evaluator fails closed after that instant. The ratification does not increase the scope or duration,
does not accept any other vulnerability and does not authorize production. Independent of the date,
review is mandatory by P19 closeout or earlier, and active acceptance cannot cross the
production-promotion boundary.

## Current non-runtime evidence

Evidence collected locally on 14/10/2026 against branch
`phase/p17-end-to-end-business-validation`, HEAD
`c9859b5f535cd102f5415485ebaa638210d5b399`:

- `package.json` declares `@next/eslint-plugin-next@16.3.8` only under `devDependencies`;
- all four affected lock nodes are marked `dev: true`;
- `npm ls @next/eslint-plugin-next fast-glob micromatch braces --all --json` resolves exactly the
  chain and versions above;
- `npm ls braces --omit=dev --all --json` returns no `braces` node in the installed runtime tree;
- the pre-change `package-lock.json` SHA-256 is
  `E93A35F25C59CADF6BEA860759B447CC2F86DEC16CA562B0182BB5AC02902720`.

This proves the package is absent from the npm production dependency tree represented by the current
manifest, lockfile and installed tree. It does not prove that every future artifact, runner, external
tool or provider environment is free of the package. It is not hosted or production evidence.

## Residual risks

- Availability: a hostile or unexpectedly deep glob pattern reaching the vulnerable development
  tooling can exhaust the JavaScript stack and interrupt lint/CI work.
- Supply chain: the vulnerable transitive package remains installed during development and CI, so
  compromise or unreviewed graph drift in that toolchain remains relevant even without runtime
  inclusion.
- Evidence drift: registry advisory metadata, fix availability, npm audit schema or dependency
  resolution can change independently of repository source.
- Operational dependence: `npm audit` requires valid registry evidence. Network failure, registry
  failure, invalid JSON, timeout or incomplete output cannot be interpreted as accepted risk.
- Enforcement gap: no production release workflow exists in this repository today, so the required
  production hard stop is specified and locally tested but is not claimed as hosted enforcement.

## Compensating controls

- Run the complete `npm audit --json`; no `--omit=dev`, reduced audit level, `audit=false`,
  `continue-on-error` or success-on-failure behavior.
- Recognize the advisory by exact GHSA ID, npm source, package, severity, CWE, CVSS and affected
  range.
- Allow only the four exact vulnerability nodes, versions, paths, edges and installed chain.
- Verify `package.json`, `package-lock.json`, the installed full tree and the runtime-only tree on
  every evaluation.
- Reject every other vulnerability entry, including another advisory involving `braces`.
- Reject changed fix metadata so a new official remediation path forces review rather than silently
  extending this acceptance.
- Keep R51, lint, typecheck, general tests, the independent synthetic build and CodeQL unchanged.
- Preserve the finding in evaluator output as `TEMPORARY_ACCEPTED_RISK`; never print `ZERO
  VULNERABILITIES` while it exists.
- Keep production promotion blocked independently from the development audit result.

## Monitoring and revocation criteria

The advisory and official releases of `braces`, `micromatch`, `fast-glob`,
`@next/eslint-plugin-next` and Next.js must be reviewed whenever CI detects metadata/graph drift,
Dependabot reports a change, or before the P19 closeout review.

This acceptance is revoked or must stop immediately when any of the following occurs:

- the provisional or owner-ratified expiry is reached;
- the owner revokes the decision;
- production promotion is proposed;
- P19 reaches closeout without a completed review;
- `braces` appears in the runtime dependency tree;
- another advisory, HIGH or CRITICAL is present;
- any allowed node, version, path, edge or fix metadata changes;
- audit evidence is unavailable, invalid, incomplete or operationally failed;
- an official compatible remediation becomes available and passes the required regressions;
- the risk is definitively remediated and a separate review formally closes this record.

Definitive closure requires removal of the vulnerable condition through an authorized official
dependency path, complete audit with no accepted finding, regressions, review of the source diff and
explicit change of this record's status. Absence in a single transient audit does not silently revoke
the record.

## Production hard stop

While this record has status `TEMPORARY_ACCEPTED_RISK`, production promotion must fail before any
production artifact build/promotion, production migration, provider credential activation, deploy,
DNS/current-version switch or real transaction.

The local specification is executable through:

```text
node scripts/p17-production-risk-hard-stop.mjs
```

Its expected result while this record is active is a non-zero exit with
`LES_SEC_RA_001_PRODUCTION_HARD_STOP_ACTIVE`. A future owner-authorized production release workflow
must make this check a mandatory predecessor to every production promotion job and validate the
negative and remediated paths on its actual Linux runner. No such hosted enforcement is claimed now.

## Owner ratification

Ratified by the L'Essenc Digital owner on 14/10/2026:

- advisory: `GHSA-vfj7-8cjw-p6xm`;
- package: `braces@3.0.3`;
- scope: `DEVELOPMENT / CI ONLY`;
- expiration: 13/11/2026 23:59:59 America/Sao_Paulo;
- mandatory review: by P19 closeout or earlier;
- definitive remediation: mandatory before production;
- other vulnerabilities: not accepted automatically.

This ratification changes only the governance metadata from `PENDING_OWNER_RATIFICATION` to
`OWNER_RATIFIED`. The accepted advisory, package, versions, scope, expiration, fail-closed behavior
and production prohibition are unchanged.

## Closure record — 18/10/2026

The temporary acceptance was closed after the repository adopted the maintained, hash-pinned
`braces@3.0.4-lessenc.1` patch, a clean full dependency audit and fail-closed regression controls.
See `les-sec-ra-001-braces-remediation.md` and
`les-sec-ra-001-remediation-policy.json`. Closure removes only this risk-specific hard stop; it does
not authorize Gate D, Gate E, a production release or production operations.
