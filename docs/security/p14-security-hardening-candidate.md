# P14 — Security Hardening — implementation and PR candidate

**Status:** P14 IMPLEMENTATION PASS / PR #36 / HOSTED CI PASS / AWAITING FINAL MERGE AUDIT
**Branch:** `phase/p14-security-hardening`
**Canonical parent:** `420ee72753816ec69b4639f6cfdf357b45df817d`
**Implementation commit:** `2acc5f8aad0fb1e697171358f2b25355e3a04b69`
**Pull request:** [#36 — P14 Security Hardening](https://github.com/alexoliverc/lessenc-digital/pull/36)
**Deployment:** NOT PERFORMED

This document records the independently audited P14-01 through P14-06 implementation and its
hosted CI validation. It does not declare P14 complete, merged, checkpointed, deployed or ready for
production; final merge audit remains pending.

## P14-01 — HTTP security headers and CSP

The application now emits a global application-level baseline from `next.config.ts`:

- Content-Security-Policy;
- X-Content-Type-Options `nosniff`;
- Referrer-Policy `strict-origin-when-cross-origin`;
- Permissions-Policy with unused sensitive capabilities disabled;
- X-Frame-Options `DENY`, aligned with CSP `frame-ancestors 'none'`;
- HSTS with one-year `max-age` only for staging/production APP_ENV, without `preload` or
  `includeSubDomains`.

`next.config.ts` headers are materialized into the Next.js build artifact. `APP_ENV` is therefore a
build-time invariant for this policy: staging/production artifacts must be built with the matching
canonical value. Changing `APP_ENV` only after the artifact is built is not claimed to rewrite the
baked CSP/HSTS rules. Real HTTPS and HSTS behavior remains a P16 validation.

Physical proof: the local build manifest contained two CSP rules and no HSTS. Starting that same
artifact with `APP_ENV=production` did not add HSTS or `upgrade-insecure-requests`, confirming that a
startup-only environment change cannot correct an artifact built with the wrong value. The policy is
not recomputed per request.

Next.js applies matching `next.config` header rules in order and the later value overrides an earlier
header with the same key; this is the mechanism used for the narrow `/checkout/payment` CSP override:
[Next.js headers documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers).

Endpoint-specific `private, no-store` and `no-referrer` policies remain stricter where previously
implemented.

### CSP evidence matrix

| Directive | Sources | Repository evidence / reason |
| --- | --- | --- |
| `default-src` | `'self'` | default fail-closed application boundary |
| `base-uri` | `'self'` | prevents hostile base-URL rewriting |
| `object-src` | `'none'` | no plugin/object content exists |
| `frame-ancestors` | `'none'` | application is not designed to be framed |
| `form-action` | `'self'` | forms and server actions submit only to L'Essenc |
| `script-src` | self plus `'unsafe-inline'`, Mercado Pago SDK, GTM, Meta Pixel | `payment-choice.tsx`, Google Tag runtime, P13 Meta Pixel adapter; no nonce pipeline exists |
| `script-src-attr` | `'none'` | React handlers are registered by JavaScript; inline event-handler attributes are not used |
| `style-src` | self plus `'unsafe-inline'` | current Next/React/provider rendering has no nonce pipeline |
| `img-src` | self, data/blob, explicit Google/Meta endpoints | local assets, PIX QR data URI and measurement providers |
| `connect-src` | self, Mercado Pago domains, explicit Google/Meta endpoints | payment/Brick and consent-gated measurement transports |
| `frame-src` | Mercado Pago `.com` and `.com.br` globally; HTTPS only on `/checkout/payment` | Card Payment Brick plus the direct iframe for a provider-originated dynamic issuer/card-network ACS URL |
| `worker-src` | self/blob | bounded browser worker compatibility |
| `manifest-src` | self | no external manifest |

`unsafe-eval` is not allowed. Generic `https:` is absent globally and appears only as the
route-specific `/checkout/payment` `frame-src`, because issuer/card-network ACS hostnames are dynamic
and cannot be safely represented by a static Mercado Pago allowlist. `form-action 'self'` remains
unchanged because the current Orders API flow assigns the provider URL directly to an iframe; the
L'Essenc parent page does not create or submit an ACS form. Descendant behavior inside the external
frame is controlled by that framed origin.

`script-src 'unsafe-inline'` is a **MEDIUM RESIDUAL HARDENING RISK / CSP PARTIAL** until a nonce/hash
architecture is approved and proven. `style-src 'unsafe-inline'` is a separate LOW residual. A nonce
migration would require broader rendering/cache/provider work and is not forced in this correction.
`script-src-attr 'none'` was added to prevent inline event-handler attributes while retaining the
currently required inline script elements. Hosted Brick/ACS behavior and HSTS effectiveness remain
P16/P17 validations.

## P14-02 — Authentication, authorization, CSRF and IDOR/BOLA

The established P11/P12 architecture is preserved: isolated buyer/admin sessions, mandatory admin
MFA, persistent session revalidation, OWNER/ADMIN/SUPPORT RBAC and entitlement-derived resource
authorization.

P14 adds an 8192-byte bounded JSON envelope to every allowed admin authentication POST before
Better Auth executes. Missing/foreign Origin, cross-site requests, malformed or oversized JSON,
unsupported methods, forbidden paths and query strings fail closed. Existing suites continue to
cover missing/invalid/revoked buyer sessions, resource denial, hidden identifiers, audit failure,
rate limiting and role denial.

Administrative authentication initialization is now lazy. Import/build no longer evaluates the
admin secret, database URL or TLS CA. Protected admin routes remain dynamic and create the singleton
only while processing an administrative request.

## P14-03 — Input, SQL, SSRF, payment and webhook boundary

Static inventory found 20 tagged raw operations in 11 runtime files. They are Prisma tagged-template
or `Prisma.sql` operations with value interpolation; no `$queryRawUnsafe` or `$executeRawUnsafe`
exists. The operations are bounded locks, candidate claims, counters/cleanup or reconciliation
queries inside their documented transaction boundaries. No dynamic table/column identifier is
derived from user input.

The only server-side external payment transport targets the constant
`https://api.mercadopago.com`, rejects redirects, uses a six-second timeout and caps responses at
256,000 bytes. Browser fetches are same-origin or provider adapters with fixed provider code paths.

### Physical 3DS presentation flow

The repository does not use Mercado Pago Status Screen Brick. Its physical flow is:

1. `payment-choice.tsx` loads MercadoPago.js and mounts Card Payment Brick only to tokenize card
   fields in the provider-controlled browser component;
2. the browser sends the ephemeral token and a strict allowlisted card shape to
   `POST /checkout/payment/start`;
3. `MercadoPagoAdapter` calls the fixed HTTPS `https://api.mercadopago.com/v1/orders` boundary;
4. `normalizeMercadoPagoOrder` accepts a challenge only for the canonical
   `action_required/pending_challenge` state and complete, internally consistent provider identity;
5. `FinancialCoordinator` exposes the presentation only after the repository accepts the provider
   snapshot against the local Order/Payment identity, amount, currency and method;
6. the server response reaches `PaymentChoice`, which assigns the challenge URL directly to a
   sandboxed iframe;
7. iframe messages have no financial authority and only trigger a fresh same-origin status request,
   which re-queries the provider server-side.

This matches the Orders API 3DS contract in which `action_required/pending_challenge` returns
`payment_method.transaction_security.url` for presentation in a checkout iframe, while the iframe
event is only a signal to query the provider again:
[Mercado Pago Orders API 3DS documentation](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/integrate-3ds).

No browser-supplied presentation field is accepted, there is no direct L'Essenc form POST to an ACS
and no provider status is accepted as financial truth in the browser.

The initial P14-G03 correction incorrectly applied the PIX Mercado Pago hostname allowlist to 3DS.
That was a blocking provider-compatibility regression because legitimate ACS endpoints can be owned
by an issuer/card network. Mercado Pago's documented 3DS contract also shows an issuer/card-network
ACS such as `acs-public.tp.mastercard.com` in `three_ds_info.external_resource_url`:
[Mercado Pago 3DS external ACS example](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/how-tos/integrate-3ds).
The correction separates the policies:

- PIX `ticket_url` remains restricted to Mercado Pago `.com`/`.com.br` and their subdomains;
- a 3DS challenge may use an eligible external HTTPS DNS hostname because it originates only from
  the fixed server-side Mercado Pago response boundary;
- malformed/non-HTTPS URLs, credentials, localhost, literal IPv4/IPv6 destinations and non-default
  ports are rejected;
- a URL is never valid in isolation: invalid status, method, identifiers, financial data or local
  association suppresses presentation and produces review/rejection;
- a stale challenge is never carried from a create response into a different canonical provider
  state.

Webhook negative coverage includes missing/malformed/incorrect signatures, timestamps more than
five minutes old or in the future, request-ID mismatch, duplicate query parameters, inconsistent
envelopes, invalid JSON and oversized bodies. Invalid traffic does not enter financial coordination.

## P14-04 — Sensitive data, logging and secrets

Sensitive categories include passwords/hashes, MFA secrets and backup codes, session IDs/tokens,
cookies, payment/provider tokens and identifiers, authorization headers, DB URLs/credentials,
private keys/storage paths, emails, IP/User-Agent and error objects.

The structured logger now redacts normalized aliases for these categories recursively, including
arrays, while preserving operational fields such as event, level, timestamp, correlation ID and
state. Arbitrary `Error.message` remains excluded.

Direct runtime console calls were classified. Application calls outside the canonical logger emit
only constant failure codes or JSON limited to event/correlation/code. Operational scripts emit
bounded health/backup metadata and have their own secret/path safeguards. No blanket mechanical
replacement was performed.

A safe tracked-content scan found placeholders and variable/schema names, not a tracked real
credential. `.env.example` remains fictitious and `.gitignore` excludes `.env*` except the example,
keys, certificates, logs, generated Prisma output and local output directories.

## P14-05 — Dependency, CI and supply chain

Repository-versioned controls now include:

- PR/main quality workflow using `npm ci`, lint, typecheck, the complete unit/application suite, full
  dependency audit and production build;
- CodeQL JavaScript/TypeScript `security-extended` analysis for PR/main and weekly schedule;
- Dependabot weekly updates for npm and GitHub Actions;
- least-privilege workflow permissions, timeouts and concurrency cancellation;
- official actions pinned to immutable commits verified against their release tags:
  checkout v7.0.1, setup-node v7.0.0 and CodeQL v4.38.1.

CodeQL v4.38.1 requires a distinct tag-object/commit distinction: annotated tag object
`c23de5a82f64bb08c6d9f28844551440ca298e76`; underlying pinned commit
`1c5b675653bb5c22dbe9b12b556ec555138e09fd`. The workflow uses the underlying commit, not the
annotated tag object.

No production/staging credential or database is used by CI. MySQL integration remains outside the
hosted workflow because the canonical suite requires the isolated P06 TLS/guard contract and the
repository has no approved ephemeral TLS bootstrap for GitHub Actions. It remains a mandatory local
technical gate until a safe CI harness is separately designed.

The repository workflow now uses `npm audit --audit-level=high` over the complete dependency graph,
including build/test/dev tooling. A production-only audit remains useful as additional local evidence
but is not the sole CI gate. The local full audit reported 0 vulnerabilities: 0 critical, high,
moderate, low or informational across 416 total dependency records. No dependency or lockfile changed.

Quality/security and CodeQL executed successfully in PR #36. Hosted CodeQL downloaded, initialized
and analyzed with `github/codeql-action/*@1c5b675653bb5c22dbe9b12b556ec555138e09fd`; no code-scanning
alert was returned for the branch. `dependabot.yml` configures version updates, but platform
inspection found Dependabot Alerts, Dependabot Security Updates, Secret Scanning and Push Protection
disabled; `main` has neither branch protection nor a ruleset. Those platform settings were not
changed in P14.

## Original finding closure

| Finding | Original | Candidate evidence | Current status | Remaining limitation |
| --- | --- | --- | --- | --- |
| P14-G01 | missing global headers | global/route-specific CSP/header policy plus eight tests and optimized-runtime smoke | IMPLEMENTED | hosted CSP/HSTS validation P16 |
| P14-G02 | no versioned CI/security gates | quality workflow and CodeQL committed, PR #36 hosted execution PASS; Dependabot configuration versioned | IMPLEMENTED / HOSTED CI PASS | platform settings and CI MySQL harness remain open |
| P14-G03 | arbitrary HTTPS payment presentation; first P14 fix conflated PIX and 3DS | provenance-bound dynamic ACS validation, strict PIX allowlist, state/association binding and negative tests | IMPLEMENTED AS CORRECTED / RE-AUDIT PENDING | provider TEST/browser validation P16/P17 |
| P14-U01 | hosted CORS/headers unknown | same-origin route controls and application headers reviewed | UNKNOWN / NEEDS HOSTED VALIDATION | P16 |
| P14-U02 | CSP/provider compatibility unknown | explicit source matrix and unit tests | PARTIAL | real Brick/GTM/Meta behavior P16/P17 |
| P14-U03 | production rate-limit capacity unknown | existing DB-backed controls/regression preserved | DEFERRED TO CANONICAL FUTURE PHASE | P15/P16 |
| P14-U04 | raw SQL review pending | complete runtime inventory; no unsafe API/dynamic identifiers | IMPLEMENTED | continue review on every new raw query |
| P14-U05 | redaction alias coverage incomplete | expanded recursive alias/array tests | IMPLEMENTED | retention/operations P15 |
| P14-U06 | hosted secrets/DB/storage unknown | no real value accessed; local contracts validated | DEFERRED TO CANONICAL FUTURE PHASE | P16/P18 |

## P14-06 — Regression and residual risk

Candidate evidence:

- R1 targeted CSP/payment/input/webhook/auth/logger set: 7 files / 73 tests PASS;
- full unit/application: 77 files / 689 tests PASS;
- isolated P06 MySQL: 21 files / 190 tests PASS against `127.0.0.1:3307/lessenc_test`;
- local optimized-runtime header smoke: public, checkout, admin, health, buyer access, download,
  webhook and analytics-consent responses all carried CSP, nosniff, Referrer-Policy,
  Permissions-Policy and X-Frame-Options; HSTS was correctly absent outside staging/production;
- lint PASS;
- typecheck/Prisma generation PASS;
- production build PASS; the isolated lazy-import test proves that importing admin auth does not
  evaluate database URL, TLS CA or admin-secret configuration;
- optimized-runtime R1 smoke: `/` and `/checkout/payment` returned 200; only the payment route
  received generic HTTPS `frame-src`, while `form-action 'self'` and `script-src-attr 'none'`
  remained present and HSTS remained absent from the local artifact;
- all new P14 files and changed paths without inherited formatting debt pass scoped Prettier; the
  global check continues to identify the same 36 pre-existing files, including the two logger files
  touched by narrow semantic additions and 34 paths outside P14;
- npm audit: 0 vulnerabilities;
- Prisma schema/migrations unchanged;
- dependencies/package lock unchanged.

Final classification:

| Area | Status |
| --- | --- |
| authentication, MFA, sessions, cookies | IMPLEMENTED |
| authorization, RBAC, IDOR/BOLA | IMPLEMENTED |
| CSRF/origin and input bounds | IMPLEMENTED |
| global headers | IMPLEMENTED |
| CSP | PARTIAL — hosted/provider validation required |
| XSS | MITIGATIONS IMPLEMENTED / NO CONFIRMED XSS FOUND / STRICT CSP PARTIAL |
| open redirect | NO CONFIRMED FINDING / MITIGATIONS VERIFIED FOR CURRENT SURFACES |
| SQL injection | NO CONFIRMED FINDING / RAW QUERIES REVIEWED AND PARAMETERIZED |
| SSRF | NO CONFIRMED SERVER-SIDE SSRF / OUTBOUND PROVIDER BOUNDARY VERIFIED |
| rate limiting/brute force | IMPLEMENTED locally; production capacity deferred |
| secrets/PII/log redaction | IMPLEMENTED |
| audit/download/webhook/payment/provider boundaries | IMPLEMENTED |
| dependency audit | IMPLEMENTED over the complete dependency graph |
| repository CI tooling | IMPLEMENTED / HOSTED CI PASS / platform controls remain open |
| TLS/HSTS effectiveness, hosted CORS, production cookies/secrets/storage | UNKNOWN / NEEDS HOSTED VALIDATION |
| observability/incident response consolidation | DEFERRED TO CANONICAL FUTURE PHASE P15 |
| staging/provider/browser E2E | DEFERRED TO CANONICAL FUTURE PHASE P16/P17 |

No CRITICAL or HIGH finding remains. Residual MEDIUM risks are hosted CSP/provider compatibility and
production-like `script-src 'unsafe-inline'` until P16/P17 validation and an approved strict-CSP
architecture. `style-src 'unsafe-inline'` remains a LOW residual. GitHub workflow execution, platform
settings and hosted integration automation are INFORMATIONAL/open operational items, not falsely
represented as complete.

Independent audit should verify the CSP source matrix against real staging network behavior, review
the lazy admin-auth lifecycle and bounded request reconstruction, confirm the separated PIX/3DS trust
models and route-specific CSP, inspect immutable action pins and reproduce the complete test matrix
before any Git lifecycle action.
