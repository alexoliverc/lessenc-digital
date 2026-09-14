# P12 — Identity, Authentication & Admin — Phase Execution Brief

**Phase:** P12

**Status:** APPROVED / FROZEN — owner-approved P12 execution baseline. Protected implementation operations remain separately gated.

**Branch:** `phase/p12-identity-auth-admin`

**Base:** `e2da708b577af75b13afb71c3b6d01a1b915f367`

**Primary decision:** ADR-0011 — Better Auth for isolated administrative identity.

## 1. Objective

Create a secure administrative identity boundary and operational backoffice so the L'Essenc business can be operated without direct database manipulation.

P12 must add administration without weakening the already-frozen commerce core.

## 2. Frozen upstream baseline

P12 starts after:

- P06 persistence foundation;
- P07 core domain/application layer;
- P08 public experience;
- P09 checkout/order creation;
- P10 Mercado Pago integration;
- P11 entitlement and secure digital delivery;
- Gate B — Commerce Core Ready.

P11 and Gate B are frozen.

P12 may consume their public application/domain boundaries but must not reinterpret their canonical financial or entitlement truth.

## 3. Core trust boundaries

The following boundaries are mandatory:

### Buyer boundary

Buyer access proves access to purchased digital resources.

It does not prove administrative authority.

### Administrative authentication boundary

Proves the individual administrator, session validity and MFA state.

### Administrative authorization boundary

Determines whether an authenticated administrator may execute a named privileged operation.

### Business/domain boundary

Executes approved commands and queries while preserving P07-P11 invariants.

### Audit boundary

Records critical administrative actions independently from ordinary technical logs.

Canonical chain:

`Admin credential -> primary authentication -> MFA -> AdminSubject -> permission -> application command/query -> domain/repository -> audit`

Forbidden chain:

`Browser button -> direct table UPDATE`

## 4. Technology direction

Authentication engine candidate:

`better-auth@1.7.4`

The version is not yet installed or pinned.

P12-B must revalidate:

- registry availability;
- package metadata;
- compatibility with Node 24;
- compatibility with Next.js 16;
- compatibility with Prisma 7;
- compatibility with the existing PrismaMariaDb runtime;
- generated schema requirements;
- transitive dependency impact;
- npm audit/security posture.

If compatibility is not demonstrated, P12-B must stop and return to architecture review.

## 5. Identity model

Administrative identity is independent from `Customer`.

Target logical concepts:

- AdminUser;
- AdminSession;
- AdminAccount;
- AdminVerification;
- AdminTwoFactor;
- AdminAuthRateLimitBucket;
- AdminAuditEvent.

Exact physical schema is not frozen until P12-B schema review.

No schema mutation is authorized by this brief alone.

## 6. Roles

P12 exposes:

- OWNER;
- ADMIN;
- SUPPORT.

Roles are coarse administrative groupings.

Authorization is permission-based.

The implementation must use named permissions and centralized authorization rather than ad hoc role checks across routes/components.

Candidate permission families:

- `admin.identity.read`;
- `admin.identity.manage`;
- `admin.session.revoke`;
- `admin.audit.read`;
- `catalog.read`;
- `catalog.manage`;
- `order.read`;
- `payment.read`;
- `customer.read`;
- `entitlement.read`;
- `delivery.read`;
- `delivery.reissue`;
- `security.manage`.

The final permission matrix is frozen in P12-E.

## 7. Explicitly forbidden admin capabilities

No role may receive a generic ability to:

- run arbitrary SQL;
- update arbitrary Prisma models;
- mark payments APPROVED;
- force orders PAID;
- forge Mercado Pago provenance;
- manufacture ACTIVE entitlement provenance;
- bypass refund-driven revocation;
- expose arbitrary private storage keys;
- disable audit globally;
- disable MFA for convenience;
- impersonate customers;
- impersonate other administrators.

## 8. Authentication policy

Primary authentication:

- email;
- password.

Public admin registration:

`DISABLED`

MFA:

`TOTP REQUIRED`

Recovery:

`ONE-TIME BACKUP CODES`

Privileged administrative subject creation requires completed MFA.

Authentication failure responses must be generic enough to avoid useful account enumeration.

## 9. Session policy

Target:

- persistent server-side/database-backed session;
- idle timeout: 30 minutes;
- absolute maximum: 8 hours;
- fresh-auth window: 5 minutes for sensitive security actions;
- immediate revocation;
- no browser storage tokens;
- no URL tokens;
- cookie cache disabled by default.

Production cookie requirements:

- HttpOnly;
- Secure;
- SameSite=Lax;
- host-only wherever routing permits.

Administrative auth secret material must be separate from buyer-session secret material.

## 10. First OWNER bootstrap

There is no public registration flow.

A controlled bootstrap process creates the first OWNER.

The process must:

- require an empty/eligible admin baseline;
- receive credentials through controlled runtime input;
- never commit credentials;
- never print secrets;
- be auditable;
- force MFA setup before ordinary administration;
- fail closed on unexpected existing privileged identity.

Bootstrap execution is separately protected and requires owner authorization.

## 11. Administrative surfaces

Target route family:

`/admin`

Expected top-level modules:

- Dashboard;
- Products;
- Orders;
- Payments;
- Customers;
- Entitlements / Access;
- Deliveries;
- Audit;
- Administration / Security;
- My Account.

The exact navigation may evolve inside P12-F/P12-G without changing the trust model.

## 12. Dashboard

Dashboard is operational visibility, not a source of business truth.

Candidate indicators:

- recent orders;
- payment status distribution;
- paid orders;
- active entitlements;
- revoked entitlements;
- recent delivery failures;
- recent admin security events;
- operational exceptions requiring attention.

All values must originate from server-side queries.

## 13. Products

Admin product operations must use explicit catalog application commands.

No generic record editor.

Expected capabilities:

- list products;
- inspect product detail;
- create/update fields permitted by the catalog domain;
- manage publication/availability according to existing invariants.

P12 does not authorize arbitrary migration of catalog architecture.

## 14. Orders

Expected capabilities:

- search/list;
- inspect;
- see items;
- see customer linkage;
- see canonical order state;
- navigate to related payment/entitlement/delivery/audit evidence.

Order financial state is read-only unless an existing application command explicitly owns a valid transition.

No manual `PAID` control.

## 15. Payments

Expected capabilities:

- search/list;
- inspect provider linkage;
- inspect canonical internal payment state;
- inspect relevant events/reconciliation evidence.

P12 does not create a generic manual payment-state editor.

Provider truth remains owned by P10 boundaries.

## 16. Customers

Expected capabilities:

- search/list;
- inspect customer identity/contact information required for operations;
- inspect related orders/access.

Customer records must not become administrator identities.

Sensitive data exposure must follow least privilege.

## 17. Entitlements

Expected capabilities:

- inspect current entitlement state;
- inspect immutable grant/resource provenance;
- inspect revocation state and reason/provenance.

No generic `activate entitlement` action.

Any future manual exceptional action requires a dedicated domain command, reason, authorization and audit.

## 18. Deliveries

Expected capabilities:

- inspect delivery/access status;
- inspect relevant audit evidence;
- execute narrowly scoped approved recovery/reissue operations.

Recovery must preserve P11 authorization rules.

Reissue cannot silently restore revoked entitlement.

## 19. Audit

P12 introduces administrative auditability.

Expected events include:

- login success/failure security signals where appropriate;
- MFA enrollment/reset/security changes;
- session revocation;
- administrator creation/role changes;
- privileged catalog mutation;
- delivery/access recovery action;
- denied privileged operation;
- security-sensitive settings change.

Audit payloads must be sanitized.

Audit storage must not contain authentication secrets.

## 20. P12 execution blocks

### P12-A — Architecture + Auth Decision + Execution Brief

Primary execution:

ChatGPT + terminal.

Deliverables:

- ADR-0011 candidate;
- this Phase Execution Brief;
- compatibility evidence;
- protected-operation map.

Codex target:

`0%`

### P12-B — Dependency + Authentication Persistence Foundation

Primary execution:

Codex for implementation, ChatGPT/terminal for review and validation.

Expected work:

- revalidate exact Better Auth package;
- owner-approved dependency installation;
- generate/derive authentication schema requirements;
- reconcile with L'Essenc naming/isolation;
- owner-approved Prisma schema changes;
- owner-approved migration;
- persistence tests;
- first-owner bootstrap implementation, but not execution unless separately authorized.

Stop conditions:

- incompatible generated schema;
- unexpected provider coupling;
- migration risk;
- customer/admin identity coupling;
- runtime DB adapter incompatibility.

### P12-C — Primary Login + Session + Logout + Rate Limiting

Expected work:

- admin auth server configuration;
- admin login route/UI;
- primary credential flow;
- generic failures;
- session creation/validation;
- logout;
- session revocation;
- admin route protection;
- rate limiting;
- cookie/security policy tests.

No privileged AdminSubject may be issued before required MFA.

### P12-D — Mandatory TOTP MFA + Recovery

Expected work:

- enrollment;
- verification;
- mandatory MFA gate;
- backup/recovery codes;
- MFA-sensitive audit;
- recovery abuse tests;
- replay/failure tests.

### P12-E — RBAC + Authorization + Admin Audit

Expected work:

- AdminSubject;
- role representation;
- named permissions;
- centralized authorization;
- operation-level policies;
- audit persistence;
- fail-closed critical auditing;
- denied-access tests.

No business command may rely solely on client-side hiding.

### P12-F — Admin Shell + Account + Dashboard

Expected work:

- `/admin` protected shell;
- authenticated navigation;
- current administrator account surface;
- logout/session management;
- dashboard;
- security-state visibility.

Design must reuse the existing design-system baseline where appropriate.

### P12-G — Operational Backoffice Modules

Expected modules:

- Products;
- Orders;
- Payments;
- Customers;
- Entitlements;
- Deliveries;
- Audit.

Implementation must favor server-side queries and explicit application commands.

No generic database CRUD console.

### P12-H — Security / Regression / Final Gate

Expected work:

- P12 targeted tests;
- authentication adversarial tests;
- MFA tests;
- authorization matrix tests;
- IDOR/privilege escalation tests;
- CSRF/origin tests relevant to admin;
- rate-limit tests;
- session expiry/revocation tests;
- audit tests;
- full MySQL regression;
- full unit regression;
- typecheck;
- lint;
- production build;
- final architectural review.

## 21. Protected operations

The following remain individually protected by owner authorization:

- install Better Auth;
- modify `package.json`;
- modify `package-lock.json`;
- change Prisma schema;
- create migrations;
- apply migrations;
- execute first OWNER bootstrap;
- publish branch;
- create PR;
- merge;
- tag;
- deploy.

Authentication/authorization implementation itself also requires explicit owner approval according to the P12 roadmap gate.

## 22. Testing strategy

P12 tests must include positive and adversarial cases.

Minimum acceptance scenarios:

1. public user cannot access `/admin`;
2. buyer credential cannot authenticate to admin;
3. valid email/password without MFA cannot obtain privileged AdminSubject;
4. valid MFA produces allowed administrative session;
5. wrong TOTP is rejected;
6. recovery code is single-use;
7. revoked session immediately loses administrative access;
8. expired session loses access;
9. SUPPORT cannot manage administrators;
10. SUPPORT cannot mutate catalog unless specifically permitted;
11. ADMIN cannot create arbitrary PAID financial truth;
12. ADMIN cannot manufacture ACTIVE entitlement provenance;
13. OWNER can perform approved identity-management operation;
14. missing permission returns access denied server-side;
15. client-side request cannot override actor/role/permission;
16. admin IDOR attempt is denied;
17. mandatory privileged mutation produces audit;
18. audit failure causes critical mutation to fail closed;
19. authentication secrets do not appear in logs/audit;
20. P09-P11 commerce core regression remains green.

Additional acceptance cases may be added during implementation.

## 23. P12 exit criteria

P12 may be marked COMPLETE only when:

- individual administrative identity exists;
- MFA is mandatory and proven;
- server-side sessions are proven;
- OWNER/ADMIN/SUPPORT authorization is proven;
- privileged operations are audited;
- the core backoffice can operate the business;
- no direct DB manipulation is required for normal supported operations;
- P09-P11 invariants remain intact;
- targeted and full regressions pass;
- typecheck passes;
- lint passes;
- production build passes;
- final security/architecture review passes;
- documentation is current.

## 24. Codex budget policy

Codex is reserved for implementation-heavy blocks.

Preferred execution:

- P12-A: ChatGPT + terminal;
- P12-B: Codex;
- P12-C: Codex;
- P12-D: Codex;
- P12-E: Codex;
- P12-F: Codex selectively;
- P12-G: Codex selectively;
- P12-H: terminal + ChatGPT first; Codex only for actual defects.

Target P12 consumption:

approximately 9 percentage points or less of the remaining weekly Codex allowance.

Do not spend Codex credits on:

- Git status checks;
- documentation review;
- commit/PR mechanics;
- branch synchronization;
- routine test execution;
- evidence interpretation that can be performed by ChatGPT + terminal.

## 25. Current authorization state

Authorized:

- P12 planning;
- P12 specification;
- documentary preparation;
- read-only compatibility investigation.

Not yet authorized:

- dependency installation;
- dependency/lockfile mutation;
- Prisma schema mutation;
- migration creation/application;
- authentication implementation;
- authorization implementation;
- first OWNER creation;
- Git publication;
- deployment.

## 26. Next gate

P12-A documentary architecture has been owner-approved and frozen.

ADR-0011 and this Phase Execution Brief are now the frozen P12-A baseline.

P12-B remains separately blocked until the owner explicitly authorizes the protected operations that will actually be executed, including as applicable:

1. Better Auth dependency installation;
2. dependency and lockfile mutation;
3. Prisma schema mutation;
4. migration creation and application;
5. authentication and authorization implementation;
6. first-OWNER bootstrap execution.

P12-A freeze does not authorize Git publication or deployment.
