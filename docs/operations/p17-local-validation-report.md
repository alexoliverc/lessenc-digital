# P17 — Local Validation Report

## Result first

P17-01 and the locally executable portions of P17-02 through P17-11 are implemented and validated
on isolated branch `codex/p17-end-to-end-validation`.

Local gates currently pass. Gate D does not pass.

The remaining critical evidence requires an owner-controlled P17 hosted release, Mercado Pago TEST
credentials/provider interaction, hosted private delivery, positive real-admin MFA/browser
validation and an approved numeric performance budget. These are `PENDING_EXTERNAL`; no PASS is
inferred from P10–P16 history or local tests.

## Baseline and isolation

- repository: `C:\Projetos\lessenc-digital`;
- canonical P17 branch preserved: `phase/p17-end-to-end-business-validation`;
- isolated execution branch: `codex/p17-end-to-end-validation`;
- initial HEAD and `origin/P17`: `cda824ce151d75e7dc2f496101d03d1ccd474d14`;
- initial `origin/main`: `6e269e6db928b228babd8ffd44c3f55574cade4c`;
- P16 checkpoint target: `22fad0f690618c27cabcfa58528a76ce0a580ad3`;
- initial worktree and staging: clean;
- push, PR, merge, tag, checkpoint, hosted deploy and provider mutation: not performed.

## Implemented validation infrastructure

- `playwright.config.ts` with a dedicated `e2e` test directory;
- exact local target `http://127.0.0.1:3100` or exact hosted target
  `https://lessenc.com.br` only;
- explicit hosted read-only attestation requirement;
- accidental arbitrary/credential-bearing base URLs rejected;
- per-run `P17_RUN_ID` and ignored artifacts under `output/p17/<run-id>`;
- list, JSON and HTML reporters;
- trace, screenshot and video retained only for failures;
- 30-second test timeout, 5-second expect timeout, one worker and no local retry;
- deterministic Chromium viewports: 390x844, 768x1024 and 1440x900;
- local Next server launcher with synthetic process-only secrets and optional guarded test database;
- sanitized scenario evidence attachments without cookies, credentials, raw IDs or provider material;
- Playwright artifacts excluded from ESLint without weakening source linting;
- Next `agentRules: false` so browser runs cannot rewrite canonical `AGENTS.md`.

No dependency was added: `@playwright/test@1.63.0` was already locked before this execution.
Chromium 153.0.8010.12, its headless shell and FFmpeg were provisioned outside Git.

## Release identity reconciliation

Staging preflight and migration guard now accept the phase-neutral `STAGING_RELEASE_COMMIT`.
`P16_RELEASE_COMMIT` remains a compatibility alias for the frozen P16 hosted release. If both are
present they must match. Missing/malformed values, alias conflict, HEAD mismatch and unverifiable
HEAD all fail closed with phase-neutral diagnostics.

No real Hostinger environment variable was read, changed or published. The code is deployment-ready,
but P17 hosted source/runtime binding remains `PENDING_EXTERNAL`.

## Browser scenarios executed

Final intended local matrix:

- public home in Chromium mobile, tablet and desktop;
- real DOM/hydration/navigation entry and critical CTA visibility;
- keyboard skip-link focus and horizontal-overflow checks;
- CSP and security-header checks, including absence of `unsafe-eval`;
- exact public liveness and `no-store`;
- product → checkout on desktop with isolated MySQL fixture;
- invalid checkout input rejected without persistence;
- valid checkout persisted one `Order.PENDING`, one item snapshot, BRL 2990 and zero Payment;
- post-success form/input disabled to prevent duplicate UI submission;
- unauthenticated `/admin` redirect to login;
- invalid admin identity denied generically with no admin session cookie;
- invalid well-shaped buyer credential denied generically with no buyer session cookie.

The database fixture is synthetic, targets only `127.0.0.1:3307/lessenc_test`, is guarded before
connection and is removed after the successful scenario.

## Validation results

| Command/gate | Result |
| --- | --- |
| `npm ci` | PASS; 387 packages installed deterministically |
| focused release binding/staging contract | 2 files / 29 tests PASS |
| `npm run check` | 101 files / 999 tests PASS; lint, typecheck and format PASS |
| `npm run test:integration` | 22 files / 191 tests PASS on isolated MySQL |
| final Playwright matrix | 14 PASS / 0 FAIL / 4 intentional project skips in 20.3 seconds |
| `npm run db:validate` | PASS |
| `npm run build` | PASS; 11 static pages generated and all dynamic routes compiled |
| `npm audit --omit=dev --audit-level=high` | PASS; 0 runtime vulnerabilities |
| `npm audit --audit-level=high` | 4 HIGH, development tooling only |
| `git diff --check` | required again after documentation/commit reconciliation |

The four full-tree HIGH findings are the existing `braces` → `micromatch` → `fast-glob` →
`@next/eslint-plugin-next` development-only chain. The suggested automatic fix is a breaking major
downgrade to Next ESLint 14 and was not applied. Runtime audit remains clean.

## P17-01 through P17-11

| Phase item | Current classification | Evidence boundary |
| --- | --- | --- |
| P17-01 | PASS locally | architecture, runner, browser and evidence baseline implemented |
| P17-02 | PASS locally / PENDING_EXTERNAL for staging | real browser checkout and authoritative local persistence passed |
| P17-03 | PENDING_EXTERNAL | server/provider regressions pass; no live Mercado Pago TEST run |
| P17-04 | PENDING_EXTERNAL | local buyer/delivery contracts pass; no hosted R2 protected delivery |
| P17-05 | PARTIAL PASS / PENDING_EXTERNAL | invalid admin browser boundary and integration pass; positive real admin/MFA browser flow pending |
| P17-06 | PASS locally / PENDING_EXTERNAL where provider-dependent | 191 integration tests cover failure, ordering, retry and idempotency contracts |
| P17-07 | PARTIAL PASS / PENDING_EXTERNAL | real local Chromium passed; Payment Brick/provider/3DS not executed |
| P17-08 | PARTIAL PASS / PENDING_EXTERNAL | public entry passed all three viewports; remaining critical surfaces pending |
| P17-09 | PASS locally / PENDING_EXTERNAL | storage failure/recovery regressions pass; hosted R2 fault run prohibited |
| P17-10 | PENDING_EXTERNAL | no single correlated provider-to-delivery-to-admin hosted journey exists |
| P17-11 | LOCAL GATES PASS / GATE D NOT READY | final commit/source identity and external evidence remain pending |

## Performance measurements

Development-mode timing evidence was collected in the Playwright reports. Representative local
observations include a cold public navigation around 2.7 seconds, hot public responses around
40–50 milliseconds, product rendering around 0.7 seconds after compilation, checkout navigation
around 0.2 seconds after compilation and the guarded checkout business scenario around 3.4 seconds.

These are development-machine baselines only. They are not performance PASS criteria. No numeric
owner-approved P17 budget exists, so P17-PR01 through P17-PR04 remain `PENDING_EXTERNAL`.

## Defects found and corrected

1. Chromium runtime was absent after the Playwright package installation. The exact approved
   browser/runtime bundle was provisioned outside Git.
2. `next dev` rewrote canonical `AGENTS.md`. `agentRules: false` now prevents test execution from
   mutating governance files; the generated block was removed without changing original content.
3. ESLint scanned ignored Playwright HTML artifacts. Generated artifact directories are now
   explicitly ignored by ESLint while source and specs remain linted.
4. Staging release binding was P16-specific. It is now phase-neutral with strict backward-compatible
   aliasing and conflict rejection.

No application authority, payment, webhook, entitlement, authentication or storage control was
disabled to make tests pass.

## External blockers and residual risks

- P17 hosted deploy/source binding requires later owner-controlled Hostinger mutation and deploy;
- Mercado Pago TEST credentials/provider/Brick/3DS are unavailable in this process;
- no new hosted webhook, payment, entitlement or protected R2 delivery run was executed;
- no positive real admin login/MFA/projection browser journey was executed;
- responsive coverage is not yet complete for checkout payment, buyer library/delivery and admin;
- performance has measurements but no authorized acceptance budget;
- four HIGH development-tooling findings remain, with runtime audit clean;
- local Next development emits the expected React development CSP/eval diagnostic; hosted
  production-runtime CSP must be revalidated on the P17 release;
- P16 retention/off-R2/atomicity residuals remain P16 context and are not rewritten as P17 proof.

## Gate D recommendation

`NO PASS / NOT READY`.

The local candidate is suitable for technical review and later controlled hosted certification.
Gate D must remain open until every critical hosted/provider/business-journey requirement and the
performance decision are resolved with fresh P17 evidence.

## External execution boundary reconciliation

For this local P17 execution:

- Provider TEST executions: 0.
- Hosted P17 executions: 0.
- Pagamentos reais: 0.
- Mercado Pago production credentials used: 0.
- Hosted P17 evidence remains PENDING_EXTERNAL.
- These local results MUST NOT be promoted to Gate D hosted PASS.
