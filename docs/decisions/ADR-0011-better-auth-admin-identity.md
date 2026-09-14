# ADR-0011 — Better Auth for isolated administrative identity

**Status:** ACCEPTED / FROZEN — owner-approved P12-A architecture baseline. Authentication and authorization implementation remain separately protected and are not authorized by this ADR alone.

**Date:** 2026-09-14

**Phase:** P12 — Identity, Authentication & Admin

## Context

ADR-0008 established that administrative access requires individual identity, strong authentication, MFA, secure sessions, server-side authorization per operation, auditability and rate limiting.

ADR-0008 intentionally left the authentication technology/provider OPEN.

P12 must now convert that security requirement into an implementable administrative identity boundary without coupling administrator identity to customers or buyer-access credentials.

The current P12 compatibility preflight established:

- Next.js 16.3.4;
- React 19.3.0;
- Prisma / Prisma Client 7.10.0;
- MySQL through the existing PrismaMariaDb adapter;
- Node.js 24.21.0;
- npm 11.19.1;
- no existing authentication framework;
- no existing physical admin/auth implementation;
- no collision with reserved P12 administrative models;
- registry candidate `better-auth@1.7.4`;
- no package installation or repository mutation during discovery.

The exact Better Auth package version remains a P12-B implementation-time lock and must be revalidated before installation.

## Decision candidate

Use Better Auth as the authentication engine for the administrative surface, integrated with the existing Next.js application and persistent MySQL/Prisma layer.

Better Auth does not become the business authorization layer.

Authentication answers:

`Who is this administrator and is the session strongly authenticated?`

The L'Essenc Administration application layer answers:

`Is this administrator allowed to perform this operation?`

RBAC and domain authorization remain owned by L'Essenc code.

## Identity isolation

Administrative identity is a separate security principal.

The following equivalences are forbidden:

`Customer == AdminUser`

`BuyerCredential == AdminCredential`

`BuyerSession == AdminSession`

`BuyerSubject == AdminSubject`

No customer account, purchase credential or buyer-access session may automatically grant administrative identity.

No administrative credential may be accepted by buyer-access boundaries as proof of purchase entitlement.

## Authentication method

P12 administrative authentication uses:

- individual administrator account;
- verified email identifier;
- password-based primary authentication;
- mandatory TOTP MFA before privileged administrative access;
- one-time recovery / backup codes;
- database-backed sessions;
- server-side session validation;
- immediate session revocation capability.

Public administrative self-registration is forbidden.

OAuth/social login is outside P12 scope.

Passwordless authentication is outside P12 scope.

SMS OTP is outside P12 scope.

Email OTP as the primary administrative MFA factor is outside P12 scope.

Administrator impersonation is forbidden in P12.

## First OWNER bootstrap

The first OWNER must be created through a controlled non-public bootstrap path.

Requirements:

1. no public HTTP signup endpoint;
2. no default password committed to the repository;
3. no administrator secret written into source files;
4. bootstrap must fail if an OWNER already exists unless a separately authorized recovery procedure is being executed;
5. bootstrap material must come from controlled runtime input/environment;
6. successful bootstrap must be auditable;
7. the account must complete mandatory MFA enrollment before normal privileged administration;
8. bootstrap must not create customer identity or buyer access.

Exact bootstrap command and implementation belong to P12-B/P12-D and require owner authorization before execution.

## Session security policy

Administrative sessions are database-backed.

Target policy:

- idle timeout: 30 minutes;
- absolute maximum session lifetime: 8 hours;
- fresh-authentication window for sensitive security actions: 5 minutes;
- immediate server-side revocation;
- session-cookie cache disabled unless a later security review explicitly changes this decision;
- no authentication token in localStorage;
- no authentication token in sessionStorage;
- no authentication token in query strings or URL fragments;
- no cross-subdomain administrative cookie unless explicitly approved later.

Production administrative cookies must be:

- HttpOnly;
- Secure;
- host-only where supported by the chosen routing model;
- SameSite=Lax unless a proven integration requires a stricter/different policy.

Administrative session secrets must be independent from P11 buyer-session secrets.

## MFA policy

TOTP is mandatory for:

- OWNER;
- ADMIN;
- SUPPORT.

A primary credential alone must never yield an authorized `AdminSubject`.

Administrative authorization is granted only after the session has satisfied the required MFA state.

Recovery codes:

- are treated as authentication secrets;
- must never be logged;
- must never be returned after their intended one-time presentation flow;
- must be invalidated after successful use according to the chosen library mechanism;
- require security-sensitive audit events.

MFA reset is a privileged recovery operation and cannot be implemented as an unauthenticated convenience flow.

## Authorization ownership

Better Auth authenticates identity and session state.

L'Essenc owns authorization.

Authorization must execute server-side for every protected administrative operation.

UI visibility is not an authorization control.

The canonical authorization shape is:

`Admin session -> AdminSubject -> permission -> server-side authorization -> application command/query`

No admin page or API route may directly mutate domain tables as an authorization shortcut.

## Roles

P12 defines three administrative roles:

### OWNER

May:

- manage administrative identities;
- assign allowed administrative roles;
- revoke administrative sessions;
- manage security-sensitive administrative configuration;
- perform all ADMIN and SUPPORT capabilities.

OWNER still cannot arbitrarily rewrite canonical financial truth.

### ADMIN

May:

- manage catalog/product operational data through application commands;
- inspect orders;
- inspect payments;
- inspect customers;
- inspect entitlements;
- inspect deliveries;
- execute explicitly approved operational recovery commands;
- access administrative audit records appropriate to the role.

ADMIN cannot:

- set an order to PAID manually;
- forge provider payment truth;
- manually activate an entitlement without a valid domain provenance;
- bypass P10/P11 invariants.

### SUPPORT

May:

- read support-relevant customer/order/payment status;
- read entitlement and delivery status;
- execute narrowly scoped support actions explicitly exposed by the application layer, such as an approved access/delivery reissue flow.

SUPPORT cannot:

- manage administrator identities;
- change roles;
- change financial truth;
- directly activate/revoke arbitrary entitlements;
- alter catalog configuration unless later explicitly authorized.

The permission matrix must be implemented as named permissions rather than scattered role string comparisons.

## Administrative audit

Security-sensitive and business-sensitive administrative operations require structured audit records.

Audit and technical application logs remain distinct concerns.

Audit records must support at minimum:

- administrator identity;
- action;
- target type;
- target identifier when applicable;
- result/outcome;
- sanitized reason/metadata when applicable;
- timestamp;
- correlation identifier when available.

The following must never be stored in audit payloads or normal logs:

- passwords;
- password hashes;
- raw session tokens;
- MFA secrets;
- TOTP values;
- recovery codes;
- complete authentication cookies.

Critical administrative mutations must fail closed when their mandatory audit record cannot be persisted.

## Rate limiting

Authentication and MFA verification require server-side rate limiting.

Rate-limit state must not rely exclusively on browser memory.

Exact thresholds are frozen during P12-C/P12-D implementation review, but the implementation must protect at least:

- primary sign-in attempts;
- TOTP verification attempts;
- recovery-code attempts;
- sensitive account-recovery operations.

Rate limiting must avoid exposing whether an administrator identity exists through materially different public responses.

## Financial and entitlement invariants

P12 administration must not weaken P09-P11 invariants.

No administrative control may:

- mark a payment approved without authoritative payment provenance;
- directly rewrite provider transaction state;
- mark an order PAID outside canonical payment rules;
- manually create ACTIVE entitlement provenance that bypasses P11;
- expose protected storage keys to unauthorized users;
- serve protected assets without the P11 authorization boundary.

Operational tools must call explicit application commands and domain rules.

## Dependency boundary

`better-auth` is a new dependency.

Installation requires explicit owner approval under AGENTS.md.

No dependency is installed by this ADR.

The package version discovered during P12-A is `1.7.4`, but P12-B must repeat registry and compatibility validation before an exact version is pinned.

## Persistence boundary

P12 is expected to require new persistent administrative/authentication models.

Candidate logical names include:

- AdminUser;
- AdminSession;
- AdminAccount;
- AdminVerification;
- AdminTwoFactor;
- AdminAuthRateLimitBucket;
- AdminAuditEvent.

These names express the desired domain/security isolation.

Exact Better Auth generated fields and relations must be derived and reviewed in P12-B before schema mutation.

No Prisma schema change or migration is authorized by this ADR alone.

## Security properties

P12 implementation must preserve:

- CSRF defenses;
- trusted-origin validation;
- server-only credential/session secrets;
- generic authentication failures;
- secure password handling delegated to an accepted authentication implementation;
- database-backed revocation;
- no secret leakage through logs, URLs or analytics;
- fail-closed administrative authorization.

## Consequences

Positive:

- avoids implementing password/session/MFA cryptography from scratch;
- preserves local ownership of RBAC and business authorization;
- keeps administrative identity isolated from customers;
- allows persistent session revocation and audit integration;
- fits the existing Next.js / Prisma / MySQL architecture.

Costs:

- adds a security-sensitive third-party dependency;
- introduces authentication-specific persistence;
- requires careful schema-generation review;
- requires migration and dependency approval;
- requires ongoing security/update review.

## Alternatives rejected for P12

### Fully custom authentication

Rejected because implementing password storage, session lifecycle, MFA enrollment, recovery and authentication hardening from scratch creates unnecessary security surface.

### Customer/buyer identity reused as admin identity

Rejected because it collapses trust boundaries and increases privilege-escalation risk.

### Browser-only JWT administration

Rejected because revocation, secure session lifecycle and server-controlled privileged access are required.

### Public admin signup

Rejected because administrative identity provisioning is privileged.

## Approval boundary

This ADR is the owner-approved and frozen P12-A architecture baseline.

Owner freeze of ADR-0011 approves the architectural direction only.

Separate explicit authorization remains required before:

- installing Better Auth;
- changing dependencies/lockfile;
- modifying Prisma schema;
- creating or applying migrations;
- implementing authentication/authorization;
- executing first-OWNER bootstrap;
- publishing Git changes.
