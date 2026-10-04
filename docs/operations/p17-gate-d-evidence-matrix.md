# P17 — Gate D Release Candidate Evidence Matrix

## Purpose

This matrix defines the P17 validation requirements for Gate D — RELEASE CANDIDATE.

It does not claim that any scenario has already passed.

Initial state is `NOT_EXECUTED` unless explicitly stated otherwise.

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

| ID | Surface | Gate D criticality | Initial state |
| --- | --- | --- | --- |
| P17-E01 | Public Experience | CRITICAL | NOT_EXECUTED |
| P17-E02 | Checkout | CRITICAL | NOT_EXECUTED |
| P17-E03 | Order | CRITICAL | NOT_EXECUTED |
| P17-E04 | Mercado Pago TEST | CRITICAL | NOT_EXECUTED |
| P17-E05 | Webhook | CRITICAL | NOT_EXECUTED |
| P17-E06 | Payment | CRITICAL | NOT_EXECUTED |
| P17-E07 | Entitlement | CRITICAL | NOT_EXECUTED |
| P17-E08 | Buyer Access | CRITICAL | NOT_EXECUTED |
| P17-E09 | Protected Delivery | CRITICAL | NOT_EXECUTED |
| P17-E10 | Delivery Audit | CRITICAL | NOT_EXECUTED |
| P17-E11 | Admin | CRITICAL | NOT_EXECUTED |
| P17-E12 | Audit | CRITICAL | NOT_EXECUTED |

## Failure matrix

| ID | Scenario | Gate D criticality | Initial state |
| --- | --- | --- | --- |
| P17-F01 | Declined payment | CRITICAL | NOT_EXECUTED |
| P17-F02 | Timeout | CRITICAL | NOT_EXECUTED |
| P17-F03 | Duplicate webhook | CRITICAL | NOT_EXECUTED |
| P17-F04 | Out-of-order webhook | CRITICAL | NOT_EXECUTED |
| P17-F05 | Retry | CRITICAL | NOT_EXECUTED |
| P17-F06 | Expired order | CRITICAL | NOT_EXECUTED |
| P17-F07 | Duplicate attempt | CRITICAL | NOT_EXECUTED |
| P17-F08 | Invalid webhook authorization | CRITICAL | NOT_EXECUTED |

## Buyer and delivery matrix

| ID | Scenario | Gate D criticality | Initial state |
| --- | --- | --- | --- |
| P17-B01 | Invalid buyer credential | CRITICAL | NOT_EXECUTED |
| P17-B02 | Unauthorized resource | CRITICAL | NOT_EXECUTED |
| P17-B03 | Buyer rate limit | HIGH | NOT_EXECUTED |
| P17-B04 | Storage unavailable | CRITICAL | NOT_EXECUTED |
| P17-B05 | Stream failure | HIGH | NOT_EXECUTED |
| P17-B06 | Delivery audit failure | CRITICAL | NOT_EXECUTED |
| P17-B07 | Recovery | CRITICAL | NOT_EXECUTED |

## Browser/provider matrix

| ID | Surface | Gate D criticality | Initial state |
| --- | --- | --- | --- |
| P17-P01 | Payment Brick | CRITICAL | NOT_EXECUTED |
| P17-P02 | 3DS/challenge | CRITICAL WHEN TRIGGERED | NOT_EXECUTED |
| P17-P03 | CSP | CRITICAL | NOT_EXECUTED |
| P17-P04 | unsafe-eval | CRITICAL | NOT_EXECUTED |
| P17-P05 | GTM | MEDIUM | NOT_EXECUTED |
| P17-P06 | Meta browser provider | MEDIUM | NOT_EXECUTED |

## Responsive matrix

| ID | Viewport | Criticality | Initial state |
| --- | --- | --- | --- |
| P17-R01 | Mobile | HIGH | NOT_EXECUTED |
| P17-R02 | Tablet | HIGH | NOT_EXECUTED |
| P17-R03 | Desktop | HIGH | NOT_EXECUTED |

## Administrative matrix

| ID | Scenario | Criticality | Initial state |
| --- | --- | --- | --- |
| P17-A01 | Login | CRITICAL | NOT_EXECUTED |
| P17-A02 | MFA | CRITICAL | NOT_EXECUTED |
| P17-A03 | Session | CRITICAL | NOT_EXECUTED |
| P17-A04 | RBAC | CRITICAL | NOT_EXECUTED |
| P17-A05 | Order projection | HIGH | NOT_EXECUTED |
| P17-A06 | Payment projection | HIGH | NOT_EXECUTED |
| P17-A07 | Entitlement projection | HIGH | NOT_EXECUTED |
| P17-A08 | Delivery projection | HIGH | NOT_EXECUTED |
| P17-A09 | Audit projection | CRITICAL | NOT_EXECUTED |

## Performance matrix

| ID | Surface | Criticality | Initial state |
| --- | --- | --- | --- |
| P17-PR01 | Public navigation | PENDING BUDGET | NOT_EXECUTED |
| P17-PR02 | Checkout interaction | PENDING BUDGET | NOT_EXECUTED |
| P17-PR03 | Payment initiation | PENDING BUDGET | NOT_EXECUTED |
| P17-PR04 | Buyer delivery start | PENDING BUDGET | NOT_EXECUTED |

No performance item can become PASS until a numeric acceptance budget is approved.

## Release identity matrix

| ID | Requirement | Criticality | Initial state |
| --- | --- | --- | --- |
| P17-L01 | Exact P17 RC source commit known | CRITICAL | NOT_EXECUTED |
| P17-L02 | Hosted release reconciles to P17 RC | CRITICAL | NOT_EXECUTED |
| P17-L03 | P16 checkpoint remains immutable | CRITICAL | HISTORICAL_SUPPORT_ONLY |
| P17-L04 | Release binding is P17-compatible before deploy | CRITICAL | BLOCKED |
| P17-L05 | Production remains unauthorized | CRITICAL | NOT_EXECUTED |

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
