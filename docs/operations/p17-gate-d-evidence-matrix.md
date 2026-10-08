# P17 — Gate D Release Candidate Evidence Matrix

## Purpose

This matrix defines the P17 validation requirements for Gate D — RELEASE CANDIDATE.

This matrix records the current reconciled P17 Gate D state. PASS is assigned only where fresh P17 evidence satisfies the applicable authority boundary.

Rows not yet executed or reconciled retain `NOT_EXECUTED` unless another outcome is explicitly supported by current P17 evidence.

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
| P17-E05 | Webhook | CRITICAL | PENDING_EXTERNAL |
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
| P17-F01 | Declined payment | CRITICAL | PENDING_EXTERNAL |
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
| P17-B01 | Invalid buyer credential | CRITICAL | PENDING_EXTERNAL |
| P17-B02 | Unauthorized resource | CRITICAL | PASS / HOSTED PROVEN |
| P17-B03 | Buyer rate limit | HIGH | NOT_EXECUTED |
| P17-B04 | Storage unavailable | CRITICAL | NOT_EXECUTED |
| P17-B05 | Stream failure | HIGH | NOT_EXECUTED |
| P17-B06 | Delivery audit failure | CRITICAL | NOT_EXECUTED |
| P17-B07 | Recovery | CRITICAL | NOT_EXECUTED |

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
| P17-R01 | Mobile | HIGH | PENDING_EXTERNAL |
| P17-R02 | Tablet | HIGH | PENDING_EXTERNAL |
| P17-R03 | Desktop | HIGH | PENDING_EXTERNAL |

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

| ID | Surface | Criticality | Initial state |
| --- | --- | --- | --- |
| P17-PR01 | Public navigation | PENDING BUDGET | NOT_EXECUTED |
| P17-PR02 | Checkout interaction | PENDING BUDGET | NOT_EXECUTED |
| P17-PR03 | Payment initiation | PENDING BUDGET | NOT_EXECUTED |
| P17-PR04 | Buyer delivery start | PENDING BUDGET | NOT_EXECUTED |

No performance item can become PASS until a numeric acceptance budget is approved.

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
- current Hostinger deployed Git release -> `0f6534fcf1d5b87588f21f6dd64005309a50c786`;
- Git delta from the evidence release to the current hosted release -> canonical documentation only; application code changes = `0`;
- documentation reconciliation parent HEAD -> `1430d68db27e7535470a3746ee418fbb2582f4db`;
- post-hosted delta to that reconciliation parent -> documentation only;
- immutable P16 checkpoint -> `22fad0f690618c27cabcfa58528a76ce0a580ad3`;
- production remains unauthorized;
- exact current Hostinger release-binding environment attestation is proven under P17-L04 for deployed commit `0f6534fcf1d5b87588f21f6dd64005309a50c786`: `STAGING_RELEASE_COMMIT` matched HEAD, `P16_RELEASE_COMMIT` matched the phase-neutral binding as compatibility alias, the fail-closed staging preflight passed, and Hostinger build, publish and Node restart completed successfully.

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

Current Hostinger deployed Git release:

`0f6534fcf1d5b87588f21f6dd64005309a50c786`

Application-code equivalence:

- the hosted G5/F3/P9 application evidence was originally exercised on `9e2ef25f4667b19f727c6ba1e277a79f55e3086f`;
- `git diff --name-only 9e2ef25f4667b19f727c6ba1e277a79f55e3086f..0f6534fcf1d5b87588f21f6dd64005309a50c786` contains only `MEMORY.md`, `docs/architecture/p17-validation-architecture.md` and `docs/operations/p17-gate-d-evidence-matrix.md`;
- therefore there are zero application-code changes between the evidence execution release and the current Hostinger deployment.

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
