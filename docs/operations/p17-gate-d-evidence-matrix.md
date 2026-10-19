# P17 — Gate D Release Candidate Evidence Matrix

## Purpose

This matrix defines the P17 validation requirements for Gate D — RELEASE CANDIDATE.

This matrix records the current reconciled P17 Gate D state. PASS is assigned only where fresh P17 evidence satisfies the applicable authority boundary.

Rows not yet executed or reconciled retain `NOT_EXECUTED` unless another outcome is explicitly supported by current P17 evidence.

## Administrative disposition — 17/10/2026

Owner decision `LES-OWNER-DEC-20261017-P17-P18-R01` sets:

- `P17 = ADMINISTRATIVELY CLOSED / DEFERRED ITEMS`;
- `P17-E05 = BLOCKED / DEFERRED`;
- `GATE D = NOT_READY`;
- `P18 = PREPARATORY EXECUTION AUTHORIZED / OWNER EXCEPTION`;
- `GATE E = GO NOT AUTHORIZED`;
- `PRODUCTION = NOT AUTHORIZED`.

This disposition does not alter historical evidence, convert an unresolved row into PASS or create a
P17 quality checkpoint. `DEFERRED` identifies future remediation sequencing; the underlying
technical evidence classification remains visible in each row and in its historical sections.

## Outcome vocabulary

- NOT_EXECUTED
- PASS
- FAIL
- BLOCKED
- PENDING_EXTERNAL
- NOT_APPLICABLE
- HISTORICAL_SUPPORT_ONLY

Historical P10–P16 evidence cannot become a P17 Gate D PASS when P17 requires new real-browser,
real-provider or complete-journey evidence.

## Core journey matrix

| ID | Surface | Gate D criticality | Current state |
| --- | --- | --- | --- |
| P17-E01 | Public Experience | CRITICAL | PASS / HOSTED PROVEN |
| P17-E02 | Checkout | CRITICAL | PASS / HOSTED PROVEN |
| P17-E03 | Order | CRITICAL | PASS / HOSTED PROVEN |
| P17-E04 | Mercado Pago TEST | CRITICAL | PASS / HOSTED PROVEN |
| P17-E05 | Webhook | CRITICAL | BLOCKED / DEFERRED — authenticated real TEST delivery NOT PROVEN; latest diagnostic classification HMAC_MISMATCH / NEITHER_MATCH |
| P17-E06 | Payment | CRITICAL | PASS / HOSTED PROVEN |
| P17-E07 | Entitlement | CRITICAL | PASS / HOSTED PROVEN |
| P17-E08 | Buyer Access | CRITICAL | PASS / HOSTED PROVEN |
| P17-E09 | Protected Delivery | CRITICAL | PASS / HOSTED PROVEN |
| P17-E10 | Delivery Audit | CRITICAL | PASS / HOSTED PROVEN |
| P17-E11 | Admin | CRITICAL | PASS / HOSTED PROVEN |
| P17-E12 | Audit | CRITICAL | PASS / HOSTED PROVEN |

## Failure matrix

| ID | Scenario | Gate D criticality | Current state |
| --- | --- | --- | --- |
| P17-F01 | Declined payment | CRITICAL | PENDING_EXTERNAL / DEFERRED |
| P17-F02 | Timeout | CRITICAL | PASS / TEST PROVEN |
| P17-F03 | Duplicate webhook | CRITICAL | PASS / TEST PROVEN |
| P17-F04 | Out-of-order webhook | CRITICAL | PASS / TEST PROVEN |
| P17-F05 | Retry | CRITICAL | PASS / TEST PROVEN |
| P17-F06 | Expired order | CRITICAL | PASS / TEST PROVEN / REGRESSION PROVEN |
| P17-F07 | Duplicate attempt | CRITICAL | PASS / TEST PROVEN |
| P17-F08 | Invalid webhook authorization | CRITICAL | PASS / TEST PROVEN |

<!-- P17-R15-I8-F06-RECONCILIATION -->
### R15 — Failure Matrix technical reconciliation (07/10/2026)

R15 local validation establishes F02-F08 as PASS / TEST PROVEN. These are isolated local technical results, not proof of real hosted Mercado Pago webhook delivery. F01 remains PENDING_EXTERNAL.

F06-POLICY-R1 is implemented and regression proven. Only provider-confirmed `expired/expired` or `canceled/expired` expires a PENDING Order. The transition records `Order.EXPIRED` and `expiredAt`, resolves the Payment as CANCELED and releases the active attempt in the persistence transaction. An expired Order cannot accept another attempt. A later approval enters REVIEW without reopening the Order, granting entitlement or emitting a paid outbox event.

Generic `canceled/canceled`, local elapsed time, HTTP timeout, token expiry and UNKNOWN do not independently expire an Order. Provider-confirmed expiration may resolve a previously UNKNOWN Payment to CANCELED.

Implementation authority: commit `920283ae473a12bbfcbacb1020bb6cb8dd3c7194` (20 files). Test-hygiene authority: commit `fbf45f146c7796956ca9263dbc46bec2996c4f27` (2 integration-test files). Both were published exclusively on the P17 branch; neither was merged into main or deployed to Hostinger.

Local migration `20261007_p17_f06_expired_order` was applied to isolated `lessenc_test` using the canonical `lessenc_migrate` identity. The schema contains `OrderStatus.EXPIRED` and nullable `expired_at DATETIME(3)`. The earlier failed journal attempt was marked rolled back; the subsequent attempt applied successfully, with no unresolved migration. The runtime identity `lessenc_test` retained DML-only privileges.

R15-I5: 55 Order, 47 Payment and 22 transactional MySQL tests passed (124 total). R15-I6-R4: lint PASS, typecheck PASS, 1,030 unit tests PASS and 199 integration tests PASS. All 27 application-table row counts matched before and after regression. Administrative integration fixture hygiene was independently repaired and verified.

Authority boundaries: F06 is TEST PROVEN / REGRESSION PROVEN / PUBLISHED ON P17, but not HOSTED PROVEN. P17-E05 remains PENDING_EXTERNAL / NOT PROVEN. P17-B01, P17-B03-B07, P17-R01-R03 and P17-PR01-PR04 preserve their separate unresolved requirements. Gate D remains NOT READY and production remains unauthorized.

## Buyer and delivery matrix

| ID | Scenario | Gate D criticality | Current state |
| --- | --- | --- | --- |
| P17-B01 | Invalid buyer credential | CRITICAL | PENDING_EXTERNAL / DEFERRED |
| P17-B02 | Unauthorized resource | CRITICAL | PASS / HOSTED PROVEN |
| P17-B03 | Buyer rate limit | HIGH | NOT_EXECUTED / DEFERRED |
| P17-B04 | Storage unavailable | CRITICAL | NOT_EXECUTED / DEFERRED |
| P17-B05 | Stream failure | HIGH | NOT_EXECUTED / DEFERRED |
| P17-B06 | Delivery audit failure | CRITICAL | NOT_EXECUTED / DEFERRED |
| P17-B07 | Recovery | CRITICAL | NOT_EXECUTED / DEFERRED |

### Hosted byte-range reconciliation evidence

G5-D does not create a new Gate D scenario ID.

It is supporting evidence for the existing Buyer Access and Protected Delivery requirements.

Canonical acceptance requires a hosted adversarial matrix proving that Range does not bypass Buyer Session validation or protected resource authorization.

The authorized-resource case may resolve as HTTP 206 at the hosting transport layer after the protected backend path succeeds.

Hosted authority:

`9e2ef25f4667b19f727c6ba1e277a79f55e3086f`

Hosted adversarial matrix executed on 06/10/2026:

- missing Buyer Session plus `Range: bytes=0-0` -> `401 SESSION_INVALID` / PASS;
- invalid Buyer Session plus `Range: bytes=0-0` -> `401 SESSION_INVALID` / PASS;
- valid Buyer Session plus unauthorized resource plus Range -> `404 RESOURCE_NOT_AVAILABLE` / PASS;
- unauthorized resource produced no `DigitalDeliveryEvent`;
- valid Buyer Session plus authorized resource plus Range -> `206 Partial Content` / PASS;
- authorized hosted response returned `Content-Range: bytes 0-0/242`;
- authorized Range delivery produced exactly one new `DigitalDeliveryEvent / SUCCEEDED`;
- `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff` remained enforced;
- Buyer Session remained mandatory;
- resource authorization remained mandatory;
- R2 remained private;
- storage keys and direct R2 URLs were not exposed;
- Order remained `PAID`;
- Payment remained `APPROVED`;
- PAYMENT_APPROVED OutboxEvent remained `PROCESSED`;
- Entitlement remained `ACTIVE`;
- no new payment, commercial-state mutation, outbox processing, entitlement mutation or R2 mutation occurred.

Repository reconciliation status: `PASS / HOSTED PROVEN`.

G5-D status: `COMPLETE / PASS / HOSTED PROVEN`.

G5 status: `COMPLETE / PASS / HOSTED PROVEN`.

This closes the Buyer Access and Protected Delivery G5 scope only.

Gate D remains `NOT READY` until the remaining mandatory P17 scenarios, provider/browser evidence, responsive validation, performance acceptance and release-closeout requirements are resolved. Hosted administrative validation is now `COMPLETE / PASS / HOSTED PROVEN`.

### Hosted F3 commercial/browser evidence

Hosted authority:

`9e2ef25f4667b19f727c6ba1e277a79f55e3086f`

The hosted F3 execution established a real interactive Mercado Pago Card Payment Brick and exactly one successful Mercado Pago TEST submission.

The resulting authority was Order `PAID`, Payment `APPROVED`, provider `processed / accredited`, and `CREATE_RESPONSE / APPLIED`.

No 3DS/challenge was triggered by TEST during F3. This is `NOT_APPLICABLE` for the execution, not a synthetic PASS.

After the final CSP, `mlstatic` and `onReady` corrections, the successful hosted Brick execution produced no new CSP or `unsafe-eval` failure.

Real Mercado Pago TEST webhook delivery remains `NOT PROVEN`.

## Browser/provider matrix

| ID | Surface | Gate D criticality | Current state |
| --- | --- | --- | --- |
| P17-P01 | Payment Brick | CRITICAL | PASS / HOSTED PROVEN |
| P17-P02 | 3DS/challenge | CRITICAL WHEN TRIGGERED | NOT_APPLICABLE |
| P17-P03 | CSP | CRITICAL | PASS / HOSTED PROVEN |
| P17-P04 | unsafe-eval | CRITICAL | PASS / HOSTED PROVEN |
| P17-P05 | GTM | MEDIUM | NOT_APPLICABLE |
| P17-P06 | Meta browser provider | MEDIUM | NOT_APPLICABLE |

## Responsive matrix

| ID | Viewport | Criticality | Current state |
| --- | --- | --- | --- |
| P17-R01 | Mobile | HIGH | PENDING_EXTERNAL / DEFERRED |
| P17-R02 | Tablet | HIGH | PENDING_EXTERNAL / DEFERRED |
| P17-R03 | Desktop | HIGH | PENDING_EXTERNAL / DEFERRED |

## Administrative matrix

| ID | Scenario | Criticality | Current state |
| --- | --- | --- | --- |
| P17-A01 | Login | CRITICAL | PASS / HOSTED PROVEN |
| P17-A02 | MFA | CRITICAL | PASS / HOSTED PROVEN |
| P17-A03 | Session | CRITICAL | PASS / HOSTED PROVEN |
| P17-A04 | RBAC | CRITICAL | PASS / HOSTED PROVEN |
| P17-A05 | Order projection | HIGH | PASS / HOSTED PROVEN |
| P17-A06 | Payment projection | HIGH | PASS / HOSTED PROVEN |
| P17-A07 | Entitlement projection | HIGH | PASS / HOSTED PROVEN |
| P17-A08 | Delivery projection | HIGH | PASS / HOSTED PROVEN |
| P17-A09 | Audit projection | CRITICAL | PASS / HOSTED PROVEN |

### Hosted administrative evidence — 06/10/2026

Hosted technical release authority:

`9e2ef25f4667b19f727c6ba1e277a79f55e3086f`

The existing OWNER identity completed real login, MFA and authenticated session establishment. Protected administrative routes then reconciled the existing F3 authority in read-only mode:

- Order `e56f6f12-a1f2-489e-8f88-5c626aabc402` -> `PAID`;
- Payment `408c927d-67d6-4e5c-92ff-05cfff704cbf` -> `APPROVED`, `MERCADO_PAGO`, `processed / accredited`, `CREATE_RESPONSE / APPLIED`;
- Entitlement `3e05674c-dc24-4713-9515-148162a36825` -> `ACTIVE`;
- protected resource `8f03dee8-84d1-4e2f-972b-166fa88a8f8c` -> `ACTIVE`;
- four `DigitalDeliveryEvent` records -> all `SUCCEEDED`;
- administrative audit surface -> OWNER-authorized, append-only/read-only presentation, legitimate empty state, `AdminAuditEvent.totalCount = 0`.

A09 does not claim an exercised `AdminAuditEvent` write path. Administrative audit authority remains distinct from `PaymentEvent`, `OutboxEvent`, `Entitlement` and `DigitalDeliveryEvent`.

No new AdminUser, role change, MFA reset, second payment, commercial mutation, manual outbox processing, entitlement mutation, R2 mutation or G5 reopening occurred.

Real Mercado Pago TEST webhook delivery remains `NOT PROVEN`.

`P17-HV-P9-A = PASS`

`P17-HV-P9-B = COMPLETE / PASS / HOSTED PROVEN`

`P17-HV-P9 = COMPLETE / PASS / HOSTED PROVEN`

## Performance matrix

| ID | Surface | Gate D requirement | Budget authority | Current state |
| --- | --- | --- | --- | --- |
| P17-PR01 | Public navigation | REQUIRED | OWNER APPROVED | PROVISIONAL LOCAL NUMERIC EVIDENCE / DEFINITIVE ACCEPTANCE DEFERRED |
| P17-PR02 | Checkout interaction | REQUIRED | OWNER APPROVED | PROVISIONAL LOCAL NUMERIC EVIDENCE / DEFINITIVE ACCEPTANCE DEFERRED |
| P17-PR03 | Payment initiation | REQUIRED | OWNER APPROVED | PROVISIONAL LOCAL NUMERIC EVIDENCE / DEFINITIVE ACCEPTANCE DEFERRED |
| P17-PR04 | Buyer delivery start | REQUIRED | OWNER APPROVED | PROVISIONAL LOCAL NUMERIC EVIDENCE / DEFINITIVE ACCEPTANCE DEFERRED |

REQUIRED denotes a mandatory Gate D acceptance requirement, not a CRITICAL/HIGH severity assignment. The owner approved LES-P17-PERFORMANCE-BUDGET-R01 on 10/10/2026. This resolves the budget-approval dependency only. No performance item can become PASS without authorized execution and valid measurements against the approved acceptance criteria.

### Owner performance budget reconciliation — 10/10/2026

The owner explicitly approved the numeric limits and methodology defined in `LES-P17-PERFORMANCE-BUDGET-R01`:

- PR01: LCP P75 <= 2,500 ms.
- PR02: INP P75 <= 200 ms.
- PR03: browser-side payment POST initiation P95 <= 1,000 ms.
- PR04: protected delivery HTTP TTFB P95 <= 2,000 ms.

The approval covers 15 independent cohorts, 40 valid measurements and 3 valid warmups per cohort; nearest-rank; zero retries; mobile 390x844, tablet 768x1024, desktop 1440x900; 10 Mbps download, 2 Mbps upload, RTT 80 ms and +/-10% network calibration tolerance.

The historical 240 unthrottled, uncalibrated loopback samples remain diagnostic-only. PR01 has no acceptance PASS. PR02-PR04 remain NOT_EXECUTED.

This section supersedes the historical owner-budget-blocked wording solely as to the later budget decision; it does not change the historical measurement facts or promote existing local evidence to hosted/provider authority.

The approval does not authorize implementation, testing, payment operations, database operations, deployment or production. All unresolved E05, F01, B01/B03-B07 and R01-R03 requirements remain unchanged. G5, F3, P9 and release-identity evidence retain their established scopes.

GATE D = NOT READY. PRODUCTION = UNAUTHORIZED.

## Release identity matrix

| ID | Requirement | Criticality | Current state |
| --- | --- | --- | --- |
| P17-L01 | Exact P17 RC source commit known | CRITICAL | PASS / HOSTED PROVEN |
| P17-L02 | Hosted release reconciles to P17 RC | CRITICAL | PASS / HOSTED PROVEN |
| P17-L03 | P16 checkpoint remains immutable | CRITICAL | PASS / HISTORICAL_SUPPORT_ONLY |
| P17-L04 | Release binding is P17-compatible before deploy | CRITICAL | PASS / HOSTED PROVEN |
| P17-L05 | Production remains unauthorized | CRITICAL | PASS |

### Current P17 release identity evidence

- hosted G5/F3/P9 application-evidence execution release -> `9e2ef25f4667b19f727c6ba1e277a79f55e3086f`;
- last independently attested Hostinger deployed Git release recorded in this documentation -> `0f6534fcf1d5b87588f21f6dd64005309a50c786`;
- Git delta from the evidence release to that historical hosted release -> canonical documentation only; application code changes = `0`;
- documentation reconciliation parent HEAD -> `1430d68db27e7535470a3746ee418fbb2582f4db`;
- post-hosted delta to that reconciliation parent -> documentation only;
- immutable P16 checkpoint -> `22fad0f690618c27cabcfa58528a76ce0a580ad3`;
- production remains unauthorized;
- P17-L04 independently attests the historical deployed commit `0f6534fcf1d5b87588f21f6dd64005309a50c786`: `STAGING_RELEASE_COMMIT` matched HEAD, `P16_RELEASE_COMMIT` matched the phase-neutral binding as compatibility alias, the fail-closed staging preflight passed, and Hostinger build, publish and Node restart completed successfully.
- Post-merge reconciliation dated 18/10/2026: P17 documentary integration HEAD after PR #59 ->
  `96b3fda29775b2db7d364b292b46b8bc3aefd364`, classified as
  `P17 DOCUMENTARY INTEGRATION HEAD / GIT ONLY`; pre-PR #59 technical HEAD ->
  `202a43bffd30ed2b85c22c83825da7697139e3a8`, classified as
  `PRE-PR59 TECHNICAL HEAD / R04 INTEGRATED`. No further R04 integration PR is required. The
  owner reports a Hostinger deployment of `202a43bffd30ed2b85c22c83825da7697139e3a8`, while
  independent release-binding, build, publish, current-version switch and restart attestation remains
  pending. Neither the historical P17-L04 PASS nor the historical application-code-equivalence
  statement is propagated to either later commit.

## Gate D rule

Gate D may be PASS only when:

1. every CRITICAL mandatory scenario is PASS;
2. no CRITICAL scenario remains FAIL, BLOCKED or unresolved PENDING_EXTERNAL;
3. source/release identity is reconciled;
4. real browser/provider evidence exists where required;
5. hosted protected buyer delivery is proved;
6. performance budget is approved and evaluated;
7. residual non-critical limitations are recorded;
8. production remains unauthorized.

GATE D = NOT READY

## Autonomous acceptance closeout — 11/10/2026

The owner-authorized local-only execution of `LES-P17-AUTONOMOUS-CLOSEOUT-R01` materialized and
exercised the approved `LES-P17-PERFORMANCE-BUDGET-R01` harness without using hosted/provider
authority. The execution remained fail-closed and did not produce a performance acceptance PASS.

| ID | Executed local evidence | Acceptance classification | Gate D classification |
| --- | --- | --- | --- |
| P17-PR01 | Mobile cohort completed 3 warmups plus 40 valid LCP observations in the latest run | PARTIAL COHORT SUPPORT ONLY / ACCEPTANCE NOT PROVEN | NOT READY |
| P17-PR02 | First mobile warmup reached the expected functional post-click state, but Chromium emitted no qualifying Event Timing entry | BLOCKED_LOCAL_OBSERVABILITY / ACCEPTANCE NOT PROVEN | NOT READY |
| P17-PR03 | Not reached after the PR02 fail-closed stop | NOT_EXECUTED | NOT READY |
| P17-PR04 | Not reached after the PR02 fail-closed stop | NOT_EXECUTED | NOT READY |

The latest run is `p17-perf-acceptance-20261011-1312`. It stopped at PR02 with
`ENTRY_MISSING`; no arbitrary duration, synthetic Event Timing entry or retry was substituted.
Earlier attempts identified and corrected local harness defects in loader selection, TLS CA
delivery, calibration transport, click targeting, consent setup and interaction correlation.
Invalid or incomplete attempts remain historical diagnostics and are not acceptance samples.

The accepted network profile continues to be evaluated on gross observed calibration values.
Baseline loopback timing is attached only as diagnostic context and is not subtracted from the
approved 80 ms RTT target. This preserves the policy's explicit 10% tolerance instead of silently
changing the metric.

The historical 10/10 wording `BLOCKED_OWNER_BUDGET` is superseded by the approved-budget state.
It remains historically accurate for the earlier run, but the current state is
`ACCEPTANCE NOT PROVEN`, not budget-blocked.

Local regression authority established during closeout:

- `npm run check`: lint, Prisma generation/typecheck, 104 test files / 1,032 tests and formatting
  PASS;
- `npm run test:performance:infra`: 14 files / 78 tests PASS;
- runtime dependency audit: zero vulnerabilities;
- full dependency audit: four HIGH findings confined to the development lint chain; the offered
  automatic remediation is breaking and was not applied;
- two isolated MySQL integration launches applied all nine migrations, but Vitest stopped before
  collecting tests because its internal token path was not writable in the read-only capsule.

The integration result is therefore `NOT_EXECUTED / BLOCKED_LOCAL_CAPSULE_WRITABLE_RUNTIME_PATH`,
not a test failure and not a PASS. Both disposable database executions were cleaned up. No hosted
database, provider endpoint, production credential, real payment, deployment or Git publication
was used.

P17-E05 real Mercado Pago TEST webhook evidence remains `PENDING_EXTERNAL`; P17-F01 remains
`PENDING_EXTERNAL`; the provider-sensitive responsive matrix remains `PENDING_EXTERNAL`.
Consequently:

`P17 = PARTIALLY COMPLETE`

`GATE D = NOT READY`

`PRODUCTION = UNAUTHORIZED`

## LES-P17-R50 — R49 final-image full local performance evidence — 12/10/2026

<!-- LES-P17-R50-R49-FINAL-IMAGE-FULL-LOCAL-PERFORMANCE-20261012 -->

The commit-bound R49 final image completed a new full local matrix after the remediation checkpoint.
This supersedes only the prior statement that no post-R49 full run existed; it does not mutate or
relabel historical R42 evidence.

| Performance control | Local result | Gate D authority |
| --- | --- | --- |
| Image/source identity | OCI `sha256:22c54f0c643615677bd0e6921b5c4f92ac609748ece66ea92ab6d600fd0c8ece`; source SHA-256 `8f961f5bbb2e54e8a95ffc13005581d4ad2c3db5b0a89b805e761d24443a2bea` verified | Source bytes verified; commit remains declared-only in the capsule |
| Browser matrix | PASS locally; 15 expected, 0 unexpected, 0 skipped, 0 flaky | Local Playwright execution only |
| Coverage | 15 cohorts, 45 warmups, 600 valid samples; zero missing, duplicate or unexpected cohorts | Structurally complete local package only |
| Calibration | 15 cohorts and 45 download/upload/RTT probes per axis | `STRUCTURALLY_COMPLETE_ONLY`; recomputed from raw probes |
| Numeric budgets | `ALL_COHORTS_WITHIN_LIMIT`; all 15 governing values within their configured limits (p75 for PR01/PR02, p95 for PR03/PR04) | `PROVISIONAL_LOCAL_NUMERIC_REVIEW_ONLY` |
| Isolation/cleanup | Fresh disposable MySQL project; zero project containers, volumes or networks after evidence export | Local cleanup evidence only |
| R34 preservation | Same container/start/restart/data-volume identity and active CA hash | Local preservation evidence only |

The official package state is `PROVISIONAL_NUMERIC_REVIEW_ONLY`, reason
`SOURCE_BYTES_VERIFIED_COMMIT_IDENTITY_NOT_VERIFIED`. Each cohort remains
`NUMERIC_ONLY_NOT_GATE_D_PROOF`. Sanitized evidence is outside the repository at
`C:\Users\Alex Oliveira\AppData\Local\Lessenc\P17\r49-final-performance\20261012-194500`;
summary SHA-256 `28c2a449c653d1e918382f6033053f5c813b05b422c70a412b3d70fbb190a124`.

Real Mercado Pago TEST webhook delivery, provider-declined behavior, provider-sensitive buyer and
responsive proof, and hosted release correlation remain unresolved. No provider, hosted, deployment
or production authority is inferred from the local matrix.

`R49 FINAL-SOURCE LOCAL PERFORMANCE NUMERIC REVIEW = ALL_COHORTS_WITHIN_LIMIT`

`P17 = PARTIALLY COMPLETE`

`GATE D = NOT_READY`

`PRODUCTION = UNAUTHORIZED`

## Interrupted autonomous closeout evidence — 12/10/2026

<!-- LES-P17-AUTONOMOUS-CLOSEOUT-R01-INTERRUPTED-MATRIX -->

The bounded local `PR03 / PIX / mobile` cohort is supported by 3 valid excluded warmups and 40/40
valid measured samples, with nearest-rank p95 3.5 ms against a 1,000 ms budget and valid network
calibration. It proves only that one browser/payment-mode/viewport combination. It does not close
PR03, the 15-cohort performance package, any hosted row or Gate D.

The effective Compose environment audit passed against the exact synthetic capsule contract and
rejected forbidden provider credentials and unexpected environment names. This corrects the prior
classification of the synthetic `DATABASE_URL` name as a provider-sensitive false positive; it
does not authorize or evidence a hosted database connection.

The post-cohort selective-reporter correction passed source tests but could not be rebuilt and
executed after Docker/BuildKit failed with RPC `Unavailable` / `EOF`. Execution was then stopped by
owner instruction. No final-source image, full performance run, isolated MySQL rerun, external
provider operation or hosted correlation was produced.

The authoritative unresolved Gate D list remains unchanged, including P17-E05, P17-F01,
provider-sensitive buyer/responsive scenarios and the complete performance package.

`P17 = PARTIALLY COMPLETE`

`GATE D = NOT READY`

`PRODUCTION = UNAUTHORIZED`

## Local execution snapshot — 04/10/2026

This snapshot records evidence produced on the isolated local Codex branch. It does not rewrite the
scenario tables above as staging PASS.

| Scope | Local result | Gate D state | Evidence boundary |
| --- | --- | --- | --- |
| P17-01 architecture/tooling | PASS | PASS locally | Playwright 1.63.0, Chromium 153, deterministic mobile/tablet/desktop projects, sanitized run artifacts |
| P17-E01 public experience | PASS | PENDING_EXTERNAL | real local Chromium; hosted P17 release not deployed |
| P17-E02 checkout | PASS | PENDING_EXTERNAL | real local Chromium plus isolated `lessenc_test` |
| P17-E03 order | PASS | PENDING_EXTERNAL | one synthetic PENDING order persisted with canonical snapshot and cleaned after the run |
| P17-E04–E06 provider/payment | server regression PASS | PENDING_EXTERNAL | 191 MySQL integration tests; no Mercado Pago TEST credential/provider run |
| P17-E07–E10 buyer/delivery | server regression PASS | PENDING_EXTERNAL | local contracts/recovery re-executed; no hosted protected R2 delivery |
| P17-E11–E12 admin/audit | negative browser boundary PASS; integration PASS | PENDING_EXTERNAL | invalid admin identity denied; positive real-admin MFA/projection browser run not executed |
| P17-F01–F08 failure matrix | server regression PASS | PENDING_EXTERNAL where provider evidence is required | local deterministic tests are support, not hosted/provider authority |
| P17-B01 invalid buyer credential | PASS locally | PENDING_EXTERNAL | real local Chromium fetch returned generic 401/no buyer cookie |
| P17-P03/P17-P04 CSP/unsafe-eval | PASS locally | PENDING_EXTERNAL | real local Chromium response CSP; hosted P17 CSP remains untested |
| P17-R01–R03 responsive | PASS for public entry | PENDING_EXTERNAL | 390x844, 768x1024 and 1440x900; checkout/payment/buyer/admin full matrix remains pending |
| P17-PR01–PR04 performance | MEASURED LOCALLY | PENDING_EXTERNAL | development timings only; no owner-approved numeric budget exists |
| P17-L01 exact RC source | NOT_EXECUTED | NOT_EXECUTED | requires frozen local commit after review-ready commits |
| P17-L02 hosted RC binding | NOT_EXECUTED | PENDING_EXTERNAL | deploy and Hostinger environment mutation prohibited in this execution |
| P17-L03 P16 checkpoint immutable | PASS | HISTORICAL_SUPPORT_ONLY | still dereferences to `22fad0f690618c27cabcfa58528a76ce0a580ad3` |
| P17-L04 phase-neutral binding | PASS locally | PASS locally | new binding accepts phase-neutral value, preserves P16 alias and rejects conflicts/mismatch |
| P17-L05 production unauthorized | PASS | PASS | no production action or credential used |

Current counts and detailed commands are recorded in
[`p17-local-validation-report.md`](p17-local-validation-report.md).

GATE D remains `NOT READY`.

### Hosted public/provider/release/responsive reconciliation — 06/10/2026

Last independently attested Hostinger deployed Git release:

`0f6534fcf1d5b87588f21f6dd64005309a50c786`

Application-code equivalence:

- the hosted G5/F3/P9 application evidence was originally exercised on `9e2ef25f4667b19f727c6ba1e277a79f55e3086f`;
- `git diff --name-only 9e2ef25f4667b19f727c6ba1e277a79f55e3086f..0f6534fcf1d5b87588f21f6dd64005309a50c786` contains only `MEMORY.md`, `docs/architecture/p17-validation-architecture.md` and `docs/operations/p17-gate-d-evidence-matrix.md`;
- therefore there are zero application-code changes between the evidence execution release and that historical Hostinger deployment.

New hosted authority established without a new payment or commercial-state mutation:

- `P17-E01 Public Experience` -> `PASS / HOSTED PROVEN`: `/` and `/cronograma-capilar-inteligente` returned HTTP 200 in hosted Chromium and rendered successfully in mobile, tablet and desktop viewports;
- `P17-P05 GTM` -> `NOT_APPLICABLE`: `GTM_CONTAINER_ID` is absent in Hostinger and hosted validation observed no GTM/GA provider script, global or network request;
- `P17-P06 Meta browser provider` -> `NOT_APPLICABLE`: `META_PIXEL_ID` is absent in Hostinger and hosted validation observed no Meta browser script, `fbq` global or provider network request;
- `P17-L04 Release binding` -> `PASS / HOSTED PROVEN`: Hostinger checked out `0f6534fcf1d5b87588f21f6dd64005309a50c786`, both release-binding variables were aligned with that HEAD, the fail-closed staging preflight passed, and build, publish, current-version switch and Node restart completed successfully.

Responsive hosted evidence now covers:

- public surfaces in `390x844`, `768x1024` and `1440x900`;
- checkout guard state in all three viewport classes;
- payment guard state in all three viewport classes;
- unauthenticated administrative boundary in all three viewport classes;
- authenticated OWNER administrative surfaces `/admin`, `/admin/orders`, `/admin/payments`, `/admin/entitlements`, `/admin/deliveries` and `/admin/audit` in all three viewport classes;
- authenticated administrative functional-content consistency after stabilization, with no horizontal overflow, page errors, console errors or post-auth non-read requests;
- no separate buyer-facing `page.tsx` exists in the current MVP; Buyer Access remains an API/protected-delivery boundary already covered by G5.

`P17-R01`, `P17-R02` and `P17-R03` are not PASS. They move from `NOT_EXECUTED` to `PENDING_EXTERNAL` because substantial hosted responsive execution now exists, while the real interactive Mercado Pago Payment Brick has not been proven across mobile, tablet and desktop. The earlier F3 execution proves a real interactive hosted Brick and one Mercado Pago TEST submission, but it does not prove the three-viewport responsive matrix.

The earlier pre-hosted/local snapshot remains historical support evidence only and is not current Gate D authority. The current-state matrix rows and this hosted reconciliation govern wherever they differ from that historical snapshot.

Confirmed remaining authorities include real Mercado Pago TEST webhook P17-E05; the unresolved failure matrix; P17-B01 and P17-B03-B07; complete responsive P17-R01-R03 with real Payment Brick multi-viewport proof; and owner-approved performance budget and P17-PR01-PR04 evaluation. Gate D remains `NOT READY`.

P17-P02 is `NOT_APPLICABLE` for F3 because TEST did not trigger 3DS/challenge.

G5 and P9 remain closed and are not reopened by this reconciliation.

## Autonomous local closeout reconciliation — 10/10/2026

Implementation commit `7ab1777a3363c969cd882d8bac0ffee25afe1b13` closes the work that can be
proved safely and locally without provider, hosted-database or deployment authority.

Fresh local supporting evidence includes:

- a digest-pinned, non-root Docker capsule built offline with Node 24.21.0, npm 11.19.1,
  Playwright 1.63.0, Chromium 153.0.8010.12, Prisma 7.10.0 and a separately verified Prisma Schema
  Engine for `debian-openssl-3.0.x`;
- a Linux npm cache tied to the final lockfile and verified for all 390 target entries, 13 required
  packages, 786 files and a successful network-disabled replay;
- zero runtime dependency vulnerabilities after `sharp 0.35.5` and `source-map-js 1.2.2` security
  overrides; four HIGH findings remain confined to the development lint chain;
- 104 files / 1,032 unit tests, 22 files / 199 isolated MySQL integration tests, 7 files / 42
  performance-infrastructure tests and 14 real-Chromium E2E scenarios passing;
- 240 unthrottled loopback navigation samples for `/` and the product route across mobile, tablet
  and desktop.

The navigation samples make P17-PR01 `DIAGNOSTIC_ONLY / BLOCKED_OWNER_BUDGET`; they do not create an
acceptance PASS. P17-PR02–PR04 remain `NOT_EXECUTED`. The authoritative unresolved Gate D list is
unchanged: P17-E05, P17-F01, P17-B01/P17-B03–B07, P17-R01–R03 and approved-budget performance
evaluation. Production remains unauthorized and `GATE D = NOT READY`.

## R02-C5 — F6-CA / OCI local infrastructure supporting evidence — 11/10/2026

<!-- LES-P17-R02-C5-T06-F01-CA-OCI-EVIDENCE -->

The local CA-volume initialization and export correction (`F6-CA`) was validated against OCI image `lessenc/p17-performance-app:r02-source-23a6187f`, with source-tree SHA-256 `23a6187f3829c3729230da6d23dfe774bef9022997f224664dedd2b1054868fc`. The source manifest contains 462 files, including 11 container-recipe inputs. The BuildKit context audit, 14 targeted regression tests, in-image provenance recomputation, isolated Prisma SQL/TLS-positive smoke test and disposable resource cleanup passed within local technical authority.

Detailed execution identifiers, image identity, test results and limitations are recorded in [p17-local-validation-report.md](p17-local-validation-report.md), section `R02-C5 — Local F6-CA and OCI technical evidence`.

This evidence concerns infrastructure, not the `P17-F06` expired-order scenario. It does not change any core journey, failure, buyer, browser, responsive, performance, administrative or release-identity matrix row. The exact Prisma negative TLS error classification and any independent archival of raw execution logs remain separate evidence limitations.

The complete P17 Gate D acceptance requirements remain applicable.

`F6-CA LOCAL TECHNICAL VALIDATION = PASS`

`GATE D = NOT READY`

`PRODUCTION = UNAUTHORIZED`

## LES-P17-R49 — Remediation authorized, execution not yet revalidated — 12/10/2026

<!-- LES-P17-R49-REMEDIATION-STARTED-20261012 -->

Owner authorized remediation of the three R48 review findings. This entry documents the proposed
local source changes, not completed acceptance. The R42 evidence package remains immutable with
SHA-256 `76ce09696341d38a4b2d72a1004add2bbe2015a7f122367d0fd3dd090472fbd7`.

- F01: acceptance reporter unit-test provenance must be isolated in a disposable test directory;
  existing root provenance files must not be replaced or deleted.
- F02: validation evidence must not store raw command arguments and must constrain subprocess
  execution on Windows; redact all argument values in archived command metadata.
- F03: perform a fail-closed authenticated TLS SQL handshake against the running disposable
  MySQL before any integration or performance execution. Re-export the active CA when MySQL
  is recreated; a stale exported CA must fail prior to migration or Playwright.

Prior R38 integration (199/199) and R42 performance (15/15 calibrated cohorts, 600 valid samples)
refer exclusively to the pre-R49 source digest `06ba5492eb69f797de8cf2b13d1e07aaa3c56d6503f18a66d78897efe3502ff3`.
After R49 edits, source provenance and OCI image identity change and require new validation.
No historical evidence is rewritten, and the R42 official reviewer remains
`PROVISIONAL_LOCAL_NUMERIC_REVIEW_ONLY`.

`R49 = IMPLEMENTATION PENDING REGRESSION`

`GATE D = NOT_READY`

`PRODUCTION = UNAUTHORIZED`

## LES-P17-R49 — Commit-bound local remediation evidence — 12/10/2026

<!-- LES-P17-R49-FINAL-LOCAL-REMEDIATION-CLOSEOUT-20261012 -->

R49 F01, F02 and F03 are locally revalidated on implementation commit
`7ddfbf668d1648cf968eb3243748c89f288539cc`, source-tree SHA-256
`8f961f5bbb2e54e8a95ffc13005581d4ad2c3db5b0a89b805e761d24443a2bea` and commit-bound OCI image
`sha256:22c54f0c643615677bd0e6921b5c4f92ac609748ece66ea92ab6d600fd0c8ece`. The image revision
label and in-image declared commit match the implementation commit.

| R49 control | Local result | Gate D authority |
| --- | --- | --- |
| F01 provenance preservation | PASS; disposable sandbox covers success, malformed intermediate evidence and output cleanup without changing preexisting provenance bytes | Local regression only |
| F02 evidence confidentiality | PASS; archived args fully redacted, path-selected executables rejected, Windows npm execution has no shell, synthetic argument/environment values absent from captured output | Local regression only |
| F03 positive preflight | PASS; real image entrypoint, loopback namespace, read-only active CA, exit 0, `TLS_AES_256_GCM_SHA384`, authenticated CA chain | Local synthetic OCI runtime only |
| F03 negative preflight | PASS; incompatible independent CA, exit 1, fail-closed marker, no later controller/migration/test marker | Local synthetic OCI runtime only |
| R34 preservation | PASS; identical 28-table/9-row logical digest, active CA hash and container/data-volume identity before/after | Local preservation evidence only |
| Isolated MySQL regression | PASS; fresh project, 9 migrations, 22 files / 199 tests, complete project cleanup | Local integration only |
| General quality | PASS; 104 files / 1,032 tests and 25 files / 117 performance-infrastructure tests | Local source evidence only |

Because the synthetic certificate lacks a loopback SAN, `checkServerIdentity` remains overridden.
F03 therefore authenticates the CA chain and TLS cipher but does not prove hostname identity. This
limitation is emitted explicitly at runtime and is not promoted.

R42 remains immutable with reviewer authority `PROVISIONAL_LOCAL_NUMERIC_REVIEW_ONLY`. At this R49
checkpoint, no post-R49 15-cohort/600-measurement performance run had been executed; the R50
entry in this matrix records the final-image local numeric run without altering R42. Real Mercado
Pago TEST webhook, declined provider result, remaining provider-sensitive buyer/responsive controls
and hosted release correlation remain unresolved.

`R49 F01 / F02 / F03 LOCAL REMEDIATION = PASS`

`FINAL R49 SOURCE LOCAL NUMERIC REVIEW = ALL_COHORTS_WITHIN_LIMIT / PROVISIONAL_ONLY`

`GATE D = NOT_READY`

`PRODUCTION = UNAUTHORIZED`
