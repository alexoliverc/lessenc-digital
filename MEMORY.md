# MEMORY.md — Estado consolidado da L'Essenc Digital

**Última atualização:** 13/09/2026
**Projeto:** LES-DIG — L'Essenc Digital
**Estado documental:** P00–P11 COMPLETE. Gate A — FOUNDATION READY PASS. Gate B — COMMERCE CORE READY PASS / DOCUMENTED / FROZEN. P11 está concluída no worktree controlado atual; a publicação Git desse conjunto permanece NOT AUTHORIZED / NOT PERFORMED.
**Estado atual:** Gate B — Commerce Core Ready está PASS / DOCUMENTED / FROZEN na branch `phase/p11-entitlement-digital-delivery`. O commerce core P09 -> P10 -> P11 foi validado por cenário canônico Order -> Payment -> Entitlement -> protected Delivery, regressão total e C7 refund -> revoke -> deny. P12 — Identity / Authentication / Administrative Access é o próximo candidato, mas sua implementação NÃO está autorizada. Nenhuma publicação Git foi autorizada.
**Checkpoint anterior à P04 física:** `71488f1`, tag `checkpoint/p04-baseline-reconciled`, com `pnpm` e sem Prisma.

## Decisões vigentes

- Frente inicial de geração de caixa por produtos digitais próprios em beleza e autocuidado; aquisição inicial por paid traffic. Meta comercial: 10 vendas concluídas por dia até o segundo mês, sem garantia técnica.
- Primeiro produto documental: **Cronograma Capilar Inteligente**, R$ 29,90 (`2990 BRL`), compra única, Brasil, PIX/cartão, quantidade 1 e sem conta obrigatória antes do checkout. O produto anterior e o preço R$ 39,90 pertencem ao histórico, não à oferta atual.
- Monólito modular com Presentation → Application → Domain → Infrastructure; Next.js App Router, React, TypeScript, Node.js, MySQL, Prisma, adapter Mercado Pago e transactional outbox. Ativos digitais pagos privados; browser jamais aprova pagamento; `Payment.APPROVED → Order.PAID → Entitlement.ACTIVE` coordenados; falha de email/fulfillment não desfaz pagamento.
- **SCAFFOLD ANTERIOR À P04 FÍSICA:** `pnpm`/`pnpm-lock.yaml`, Next 16.3.4, React 19.3.0, Vitest 5.0.0, sem Prisma. Preservado no checkpoint acima; não descreve automaticamente a árvore de trabalho atual.
- **APPROVED TARGET P04 BASELINE:** Node 24.21.0 LTS, `npm` 11.19.1, `package-lock.json`, `npm ci`, Next 16.3.4, React/React DOM 19.3.0, TS 6.0.3, Vitest 5.0.0, ESLint 10.10.0, Prettier 3.9.6 e as dependências de suporte existentes nas versões físicas revalidadas. Prisma/MySQL/schema/migrations pertencem à P06. A meta foi corrigida pelo brief mais recente do owner, sem downgrade de framework ou testes.
- **ESTADO FÍSICO P04 CONFIRMADO:** `main`/`origin/main` no merge `da59530`, com Node.js 24.21.0 LTS, npm 11.19.1, `packageManager: npm@11.19.1`, `package-lock.json`, `npm ci` e `APP_ENV`; P04 passou pela revisão técnica e foi integrada. O scaffold pnpm permanece apenas como histórico.
- O brief do owner de 12/09/2026 autorizou a P05 na branch própria a partir de `da59530`. A execução P05 restringe-se ao design system e à fundação UX, sem commit, tag, push ou merge antes da revisão técnica. Não houve alteração de dependências.
- O brief do owner de 12/09/2026 autorizou a P06 a partir de `c77ff9c`: MySQL 8.4 LTS local isolado, Prisma CLI/Client/adapter MariaDB exatamente 7.10.0, schema, migrations e testes físicos. Os 6 alertas transitivos iniciais foram corrigidos na P06 pelos overrides de mariadb 3.5.4, mysql2 3.24.4 e deepmerge-ts 8.0.2; auditoria P07 confirmou 0 vulnerabilidades. Não há liberação de produção.
- Ambientes aprovados na nova baseline: LOCAL, TEST, STAGING e PRODUCTION com `APP_ENV` separado de `NODE_ENV`, sem afirmar que tenham sido provisionados.
- O owner autorizou a implementação P07 em 12/09/2026, sem commit, tag, push, PR, merge ou P08. Núcleo puro de catálogo/pedido/pagamento/entitlement, primitivas e adapter de leitura de catálogo; coordenação financeira persistida/outbox permanece para o fluxo posterior. Ver [implementação P07](docs/architecture/p07-core-implementation.md).
- Governança, arquitetura, persistência P06, integração financeira P10 e entrega digital segura P11 estão documentadas e implementadas nas respectivas baselines. P12 permanece responsável pela identidade/autenticação administrativa e é somente NEXT CANDIDATE / NOT AUTHORIZED. Deploy de produção continua fora do estado autorizado atual.
- O modelo ChatGPT → Codex → ChatGPT review está adotado: ChatGPT responde pela direção técnica, planejamento e revisão; Codex executa somente o escopo autorizado no repositório.
- Cada execução requer Phase Execution Brief, branch, autorização de operações protegidas por `AGENTS.md`, validação e retorno ao ChatGPT antes da progressão. Repositório é a memória técnica oficial; ler os arquivos na ordem definida em AGENTS.md.
- O projeto principal de cosméticos físicos continua separado e será retomado com a formação de caixa.

## Onde encontrar as decisões

- [ROADMAP.md](ROADMAP.md): fases P00–P20; P11 COMPLETE / PASS / DOCUMENTED / FROZEN; Gate B PASS / COMMERCE CORE READY; P12 é o próximo candidato e permanece NOT AUTHORIZED.
- [docs/README.md](docs/README.md): índice P00–P10, segurança, operações, ADRs e histórico anterior.
- [Persistência P06](docs/persistence/README.md): schema físico, isolamento local, migrações e testes.
- [Produto P01](docs/product/first-product-definition.md), [modelo P03](docs/architecture/domain-model.md), [stack P04](docs/architecture/runtime-toolchain-baseline.md) e [P04 exit review](docs/architecture/p04-exit-review.md).
- [Registro 11/09/2026](memory/2026-09-11.md): scaffold anterior, conflitos reconciliados, validações e histórico.
- [Registro 12/09/2026](memory/2026-09-12.md): reconciliação P04, fechamento P05 e execução P06.

## Decisões OPEN / DEFERRED

**OPEN:** provedor/tecnologia de autenticação; provedor de email; storage privado; provedor de observabilidade; provedor de rate limit distribuído em produção; framework E2E no navegador. Também domínio, política de reembolso/suporte, conteúdo final e detalhamento físico de schema/recovery dependem de decisão antes da implementação correspondente.

**DEFERRED:** entrega P11, autenticação P12, analytics P13 e ambientes de produção até os respectivos gates. P10 está COMPLETE e não inclui Entitlement/Delivery. A sequência `GOV/MVP-*` e os documentos `LES-*-R01` continuam como histórico; a baseline atual P00–P20 prevalece quando divergir.

## P05 — fechamento técnico

- P05 — Design System & UX Foundation: COMPLETE.
- ChatGPT Technical Review: PASS.
- Gate A — FOUNDATION READY: PASS.
- Nenhuma dependência foi adicionada ou removida.
- P06 foi implementada e validada em 12/09/2026 na branch `phase/p06-data-persistence-foundation`; ChatGPT Technical Review PASS. Checkpoint `f4bfdfe` e tag `checkpoint/p06-data-persistence-complete` foram publicados; PR #4 foi mergeada em `main` pelo merge commit `694a085`, e o fechamento documental pela PR #5 em `e04438c`. P07 foi encerrada como COMPLETE após checkpoint `4c96e7b`, publicação da tag e merge da PR #6 em `main` como `6a19eda`. P08 foi posteriormente implementada, validada e encerrada como COMPLETE pelo checkpoint 73400a e merge 2686e39.

## P08 — Post-merge closeout

- P08 — Public Sales Experience: COMPLETE.
- ChatGPT Technical Review: PASS.
- Final Quality Gate: PASS.
- Checkpoint final: `f73400af5a0570d379bb700f752e8cb73639899b`.
- Tag: `checkpoint/p08-public-sales-experience-complete`.
- Branch publicada: `phase/p08-public-sales-experience`.
- PR #8 criada contra `main` e validada como MERGEABLE / CLEAN.
- PR #8 mergeada em `main` pelo merge commit `2686e39776cb9601dbbb643a87855923f6421d3e`.
- `main` local e `origin/main` foram sincronizadas no merge P08.
- O checkpoint P08 foi confirmado como ancestral de `main`.
- A tag anotada permanece associada ao checkpoint P08.
- P08 não implementa checkout, criação de Order, Mercado Pago, PIX, webhook ou entitlement fulfillment.
- P09 foi posteriormente autorizada, implementada, validada e integrada em `main`; ver o closeout P09 abaixo.
## P09 — Post-merge closeout

- P09 — Checkout & Order Creation: COMPLETE.
- ChatGPT Technical Review inicial: PASS WITH FIXES.
- ChatGPT Technical Re-Review: PASS.
- Final Quality Gate: PASS.
- `npm audit`: 0 vulnerabilidades.
- Suíte unitária final: 191/191 PASS.
- Integração P09 MySQL: 7/7 PASS.
- Suíte completa de integração: 19/19 PASS.
- Checkpoint final: `62e70eb7af955a72d6dff597c82f06d9fcfdd574`.
- Tag: `checkpoint/p09-checkout-order-creation-complete`.
- PR #10 mergeada.
- Merge da implementação: `cda1ae9109b71dcb4dcdbeffdbed4cb6d2f0491f`.
- Checkpoint confirmado como ancestral de `main`.
- Branch de fase e tag permanecem preservadas.
- P09 entrega checkout backend-authoritative e criação atômica de Customer + Order.PENDING + OrderItem.
- P09 não cria Payment, Entitlement ou OutboxEvent e não integra Mercado Pago.
- P10 — Mercado Pago Integration: COMPLETE. Technical Review PASS, remediação A01–A05 PASS, Final Quality Gate R2 PASS, checkpoint `28653d1f923c6532037d4f2a9bec22fcac1091ad`, PR #14 e merge `6b311624c2e4824d2fc909fbcb994eab2ca9369d` em `main`. Mercado Pago TEST real e browser/Brick real permanecem limitações de ambiente documentadas.

## P09 — Post-audit remediation closeout

- Auditoria independente pós-merge identificou A01–A06; todos os findings foram corrigidos e receberam FIXED / PASS.
- Final Quality Gate da remediação: 209/209 unitários PASS, 19/19 integrações MySQL/TLS PASS, Prisma validate PASS, `npm audit` 0 vulnerabilidades e build de produção PASS.
- Checkpoint da remediação: `53bdaafc0f740241807a498b0a64378bab25c683`.
- Tag: `checkpoint/p09-post-audit-remediation-complete`.
- Branch preservada: `fix/p09-post-audit-remediation`.
- PR #12 validada como MERGEABLE / CLEAN e mergeada em `main`.
- Merge da remediação: `c78ae181be209ff8c91e996e785b42fb77f6edb2`.
- `main` local e `origin/main` sincronizadas nesse merge.
- Checkpoint da remediação confirmado como ancestral de `main`.
- P09 e sua remediação pós-auditoria estão encerradas como COMPLETE.
- A autorização do owner para P10 permanece vigente. A trava física imposta durante a remediação P09 está encerrada.
- P10 — Mercado Pago Integration foi executada em `phase/p10-mercado-pago-integration`, recebeu PASS técnico, foi integrada pelo PR #14 e está COMPLETE em `main` no merge `6b311624c2e4824d2fc909fbcb994eab2ca9369d`.

## P11-C3 BUYER ACCESS — COMPLETE / PASS

Date: 2026-09-13

P11-C3 Buyer Access is technically complete and frozen after the full C3.8 security review.

Implemented and validated:

- C3.1 Opaque Buyer Access Credential:
  - 32 random bytes / 256-bit entropy;
  - `lba_` opaque credential;
  - SHA-256 hash persistence only;
  - raw credential never persisted;
  - no Customer, Order, Entitlement, email or storage claims encoded in the credential.

- C3.2 Issuance and persistence:
  - issuance only for eligible PAID Orders;
  - every relevant OrderItem must have ACTIVE Entitlement and persisted resource grant;
  - one ACTIVE credential per Order through `activeOrderKey`;
  - Order `FOR UPDATE` serialization;
  - concurrent issuance proven to produce only one ACTIVE credential.

- C3.3 Revoke and reissue:
  - revocation preserves credential history;
  - ACTIVE -> REVOKED;
  - `activeOrderKey` cleared;
  - `revokedAt` persisted;
  - repeated revoke is idempotent NOOP;
  - reissue uses expected credential ID to prevent stale/concurrent rotation;
  - concurrent reissue produces exactly one winning ACTIVE replacement.

- C3.4 HMAC Buyer Session:
  - dedicated server-only `P11_BUYER_SESSION_SECRET`;
  - HMAC-SHA256;
  - timing-safe signature verification;
  - explicit v1 / BUYER_SESSION purpose;
  - strict payload;
  - 24-hour lifetime;
  - payload limited to customerId, orderId, credentialId, issuedAt and expiresAt;
  - no email, resourceId, entitlementId or storageKey claims.

- C3.5 Credential exchange:
  - opaque raw credential is validated and SHA-256 hashed before persistence lookup;
  - ACTIVE credential, Order and Entitlement eligibility rechecked;
  - invalid public outcomes converge to `ACCESS_INVALID`;
  - valid exchange updates `lastUsedAt`;
  - old raw credential fails after reissue;
  - valid exchange returns HMAC Buyer Session.

- C3.6 Session revalidation:
  - HMAC validity alone is insufficient;
  - each protected validation rechecks persisted credential, Order ownership and entitlement state;
  - revoked or rotated credential invalidates an otherwise cryptographically valid session on the next request;
  - refunded Order or revoked Entitlement invalidates the session;
  - validation does not refresh `lastUsedAt`.

- C3.7 HTTP boundary:
  - POST `/api/buyer-access/exchange`;
  - POST `/api/buyer-access/logout`;
  - same-origin enforcement;
  - bounded strict JSON request body;
  - generic public errors;
  - no credential/request logging;
  - production/staging/test cookie `__Host-lessenc_buyer`;
  - local non-HTTPS cookie `lessenc_buyer`;
  - HttpOnly;
  - SameSite=Lax;
  - Secure outside local;
  - Path=/;
  - no Domain;
  - 24-hour Max-Age;
  - private/no-store and no-referrer responses;
  - logout expires the Buyer Session cookie.

C3.8 final security review evidence:

- required C3 file surface: PASS;
- opaque credential security: PASS;
- raw credential persistence boundary: PASS;
- HMAC session crypto: PASS;
- server-only P11 secret: PASS;
- lifecycle/concurrency: PASS;
- credential exchange: PASS;
- session revalidation: PASS;
- HTTP/cookie security: PASS;
- POST-only route surface: PASS;
- no localStorage/sessionStorage/document.cookie use: PASS;
- no credential query-string transport: PASS;
- no raw Buyer Access HTTP logging: PASS;
- no test session secret in production source: PASS;
- Prisma validate/generate: PASS;
- targeted C3 security tests: 46/46 PASS;
- targeted Buyer Access MySQL: 28/28 PASS;
- unit regression: 292/292 PASS;
- integration regression: 82/82 PASS;
- typecheck: PASS;
- lint: PASS;
- Next.js production build: PASS;
- git diff --check: PASS.

Observed non-blocking test-performance signal:
the final full MySQL regression took approximately 80 seconds, mainly due to `entitlement-grant.integration.ts`. All tests passed; monitor future runs for recurring contention or test-environment slowdown.

C3 does NOT authorize digital resources or stream protected files. Those responsibilities remain explicitly separated into P11-C4 Resource Authorization and P11-C5 Protected Delivery.

No commit, push, tag, PR, merge or deploy was authorized or performed during the C3 closeout.

Next checkpoint: P11-C4 — Resource Authorization.

## P11-C4 RESOURCE AUTHORIZATION — COMPLETE / PASS

Date: 2026-09-13

P11-C4 Resource Authorization is technically complete and frozen after the C4.3 full security review.

Implemented and validated:

- C4.1 internal authorization contract:
  - `BuyerSubject` + `resourceId` are inputs;
  - public/client-supplied `resourceId` never proves authorization;
  - authorization is derived from persisted ownership and grant state;
  - successful authorization returns server-only `AuthorizedDigitalResource`.

- `AuthorizedDigitalResource` contains:
  - resourceId;
  - entitlementId;
  - storageKey;
  - filename;
  - mediaType.

- Authorization source of truth:
  - `EntitlementDigitalResource` is the immutable purchase-time grant;
  - `ProductDigitalResource` is not an authorization source;
  - current Product status is not an authorization source for historical purchases.

- Required current persisted state:
  - Buyer Access Credential ACTIVE;
  - credential belongs to the BuyerSubject Order;
  - activeOrderKey matches Order;
  - credential not revoked;
  - Order belongs to BuyerSubject Customer;
  - Order PAID;
  - paidAt present;
  - Entitlement ACTIVE;
  - activatedAt present;
  - revokedAt null;
  - EntitlementDigitalResource grant exists;
  - DigitalResource ACTIVE.

- Generic failed authorization:
  - `RESOURCE_NOT_AVAILABLE`.

- Historical purchase invariants proven:
  - removing current ProductDigitalResource mapping does not remove a historical grant;
  - making the current Product INACTIVE does not revoke a historical grant;
  - adding a new resource only to current ProductDigitalResource does not grant it to a past buyer.

- C4.2 Buyer Library:
  - GET `/api/buyer-access/library`;
  - requires Buyer Session cookie;
  - HMAC session is revalidated against persisted credential / Order / Entitlement state before library access;
  - public resource metadata is limited to:
    - resourceId;
    - filename;
    - mediaType.
  - public responses do not expose:
    - storageKey;
    - entitlementId;
    - customerId;
    - orderId;
    - credentialId.
  - authenticated responses use private/no-store and no-referrer policy;
  - unexpected failures return generic `SERVICE_UNAVAILABLE`;
  - missing/invalid session returns generic `SESSION_INVALID`.

C4.3 final security review evidence:

- required C4 file surface: PASS;
- internal authorization contract: PASS;
- safe public library contract: PASS;
- immutable purchase grant source: PASS;
- current catalog independence: PASS;
- persisted authorization-state requirements: PASS;
- no public storage locator exposure: PASS;
- Buyer Session revalidation wiring: PASS;
- GET-only library route: PASS;
- private/no-store response security: PASS;
- no Buyer Library request/session logging: PASS;
- no filesystem access in C4: PASS;
- no protected-file streaming in C4: PASS;
- C4 HTTP tests: 6/6 PASS;
- C4 MySQL tests: 17/17 PASS;
- unit regression: 298/298 PASS;
- full integration regression: 99/99 PASS;
- Prisma validate/generate: PASS;
- typecheck: PASS;
- lint: PASS;
- Next.js production build: PASS;
- git diff --check: PASS.

C4 intentionally does NOT open private files, resolve physical filesystem paths, create download streams or emit Content-Disposition download responses.

Those responsibilities remain isolated to P11-C5 Protected Delivery.

No commit, push, tag, PR, merge or deploy was authorized or performed during the C4 closeout.

Next checkpoint: P11-C5 — Protected Delivery.

## P11-C5 — Protected Delivery — COMPLETE / PASS

Date: 2026-09-13

P11-C5 Protected Delivery completed its implementation, validation, remediation, and final adversarial security review.

### C5.1 — Private Storage Contract / Local Adapter

Status: COMPLETE / PASS

- Application storage contract remains provider-independent through `AsyncIterable<Uint8Array>`.
- Node.js `Readable` remains an infrastructure-only implementation detail.
- `LocalPrivateFileStorage` streams files instead of performing whole-file reads.
- Storage keys reject traversal, absolute paths, Windows drive paths, backslashes, null bytes, invalid segments, and out-of-root access.
- Canonical path validation uses `realpath` and containment checks.
- Symlink escape protection and `O_NOFOLLOW` hardening are implemented.
- `PRIVATE_FILE_STORAGE_PATH` is required and absolute.
- No production storage fallback exists.

### C5.2 — Protected Delivery Application Service / Audit

Status: COMPLETE / PASS

- C4 authorization executes before private storage access.
- Authorized delivery uses `storage.stat()` followed by `storage.open()`.
- Authorization failure does not create a delivery event.
- Storage/preparation failures create append-only `DigitalDeliveryEvent` records with `FAILED`.
- `SUCCEEDED` is not recorded during preparation.
- Delivery audit failures fail closed.
- Public delivery errors remain generic while internal causes are preserved.

### C5.3 — Protected HTTP Download Boundary

Status: COMPLETE / PASS

Protected route:

`GET /api/buyer-access/resources/[resourceId]`

Security and delivery behavior:

- Buyer Session validation precedes delivery preparation.
- Client supplies only `resourceId`.
- `storageKey` and filesystem paths remain server-only.
- Invalid session returns generic `SESSION_INVALID`.
- Unauthorized resource returns generic `RESOURCE_NOT_AVAILABLE`.
- Delivery/storage preparation failure returns generic `SERVICE_UNAVAILABLE`.
- Download response uses attachment disposition with sanitized ASCII fallback plus UTF-8 filename metadata.
- Control characters and header-injection characters are sanitized.
- `Cache-Control: private, no-store`.
- `Referrer-Policy: no-referrer`.
- `X-Content-Type-Options: nosniff`.
- `Accept-Ranges: none`.
- Range/partial delivery is not implemented.
- `highWaterMark: 0` prevents automatic stream prefetch.
- `SUCCEEDED` is persisted only when body consumption actually begins and before requesting the first resource chunk.
- Stream failure after start records `FAILED / STREAM_FAILED`.
- If the `SUCCEEDED` audit cannot be persisted, resource bytes are not released.

### C5.4 — Full Protected Delivery Security Review

Status: COMPLETE / PASS

The first adversarial review found five issues:

1. no explicit proof that private storage could not reside below a public/static application root;
2. private storage configuration was composed directly in the Buyer API route;
3. protected delivery lacked an explicit PDF/ZIP/EPUB MIME allowlist;
4. HTTP Content-Type trusted persisted `mediaType` without protected-delivery enforcement;
5. the internal `STREAM_FAILED` literal existed in the HTTP handler.

All five findings were remediated.

Final architecture includes:

- `private-storage-root-policy.ts`;
- explicit rejection of storage roots below `public`, `static`, or `.next/static`;
- server-only configured private storage factory;
- no private storage path/configuration details in the Buyer API runtime;
- explicit protected-delivery MIME allowlist:
  - `application/pdf`;
  - `application/zip`;
  - `application/epub+zip`;
- unsupported media fails closed before private storage access;
- internal storage/delivery failure tokens are not exposed by the HTTP boundary.

### Final C5 Security Gate

Final adversarial review result:

- `RESULT: PASS`
- `SECURITY FINDINGS: 0`

Final validation:

- targeted C5 security: 56/56;
- full unit regression: 339/339;
- full MySQL integration regression: 103/103;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- `git diff --check`: PASS;
- `lessenc_dev` restore/guard: PASS.

### Frozen C5 Invariants

`valid BuyerSubject -> C4 authorization -> private storage -> protected backend stream -> append-only delivery audit`

The browser never receives a storage key, filesystem path, or direct private-file URL.

Private delivery remains backend-proxied.

No schema or migration change was introduced by C5 beyond the P11 foundation already created in C1.

No commit, push, tag, PR, merge, or deploy was performed during C5.

Next P11 checkpoint: C6 — Security & Recovery.

Important remaining P11 requirement: canonical full-refund processing must revoke ACTIVE Entitlements before P11 can be declared complete.
## P11-C6.1 — Full Refund Entitlement Revocation — COMPLETE / PASS

Date: 2026-09-13

P11-C6.1 implemented and validated the canonical full-refund entitlement revocation flow.

### Canonical flow

`P10 authoritative full refund -> REFUND_COMPLETED v1 -> P11 consumer -> Entitlement ACTIVE -> REVOKED`

The P10 outbox contract consumed by P11 is:

- type: `REFUND_COMPLETED`;
- payload version: `1`;
- payload fields:
  - `orderId`;
  - `paymentId`.

### Application / Repository

Implemented:

- `process-entitlement-revocation.ts`;
- `prisma-entitlement-revocation-repository.ts`;
- application unit tests;
- vertical MySQL scenarios integrated into `entitlement-grant.integration.ts`.

The refund consumer:

- locks the OutboxEvent with `FOR UPDATE`;
- requires `REFUND_COMPLETED`;
- returns `NOOP` for an already processed event;
- requires `PENDING` for a new event;
- validates payload version/order/payment identity;
- locks the Order before authoritative state validation;
- requires:
  - Order `REFUNDED`;
  - Payment `REFUNDED`;
  - non-null `paidAt`;
  - non-null `approvedAt`;
  - matching order/payment financial origin;
- calls the existing Entitlement domain through `REFUNDED_ORDER / FULL_REFUND_COMPLETED`;
- changes ACTIVE Entitlement to REVOKED;
- preserves activation timestamp;
- records revocation timestamp;
- preserves `sourceOutboxEventId` from the original PAYMENT_APPROVED activation;
- preserves historical `EntitlementDigitalResource` grants;
- does not invent an Entitlement if the approval grant was never consumed;
- does not automatically revoke BuyerAccessCredential;
- does not query or re-enter Mercado Pago;
- marks REFUND_COMPLETED PROCESSED only after entitlement persistence;
- runs under ReadCommitted transaction semantics.

### Security / Consistency scenarios

Validated:

- real P10 REFUND_COMPLETED -> ACTIVE Entitlement -> REVOKED;
- replay -> NOOP;
- concurrent consumers -> one PROCESSED + one NOOP;
- tampered payload fails closed;
- invalid financial origin fails closed atomically;
- refund-before-grant creates no commercial right;
- delayed PAYMENT_APPROVED after refund remains NOOP;
- historical digital-resource grants remain preserved;
- activation `sourceOutboxEventId` remains preserved;
- BuyerAccessCredential remains persisted but protected authorization is denied after refund.

### Final C6.1 security gate

- RESULT: PASS;
- SECURITY FINDINGS: 0;
- application tests: 3/3;
- targeted MySQL: 23/23;
- full unit regression: 342/342;
- full MySQL regression: 110/110;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- git diff --check: PASS;
- lessenc_dev restore/guard: PASS.

No schema change or migration was introduced by C6.1.

No commit, push, tag, PR, merge, or deploy was performed.

Next checkpoint: P11-C6.2 — Buyer Access Recovery / Credential Compromise.

P11 remains open. C7 must still re-prove the complete refund-to-protected-download denial path before final P11 completion.
## P11-C6.2 — Buyer Access Recovery / Credential Compromise — COMPLETE / PASS

Date: 2026-09-13

P11-C6.2 validated and froze the Buyer Access credential recovery and compromise model.

### Recovery model

Buyer Access recovery is rotation-only.

The previously issued raw credential is not recoverable because persistence stores only its SHA-256 `secretHash`.

Recovery semantics are:

`lost/compromised credential -> trusted operational identity boundary -> revoke expected ACTIVE credential -> issue new opaque credential`

The previous raw credential is never reconstructed or returned.

### Existing lifecycle capabilities

Validated server-side capabilities:

- `RevokeBuyerAccessCredential`;
- `ReissueBuyerAccessCredential`;
- transactional Prisma lifecycle implementation;
- Order-level serialization;
- ReadCommitted transaction semantics;
- expected credential identity enforcement;
- exactly one ACTIVE credential per Order;
- stale rotation detection through `BUYER_ACCESS_CREDENTIAL_ROTATED`;
- idempotent explicit revocation.

### Session and raw credential invalidation

Validated:

- old raw credential fails exchange after reissue;
- replacement raw credential exchanges successfully;
- HMAC session from a revoked credential can remain cryptographically valid but is rejected after persisted database revalidation;
- old session is rejected after reissue;
- replacement credential/session remains valid when commercial eligibility is unchanged.

### Commercial-right isolation

Credential revoke/reissue does not mutate:

- Order;
- Payment;
- Entitlement;
- Entitlement status;
- activation/revocation state of Entitlement;
- EntitlementDigitalResource grants;
- historical commercial-right provenance.

Additional C6.2 integration tests explicitly proved:

- revoke preserves Order, Entitlement and historical grants;
- reissue rotates only access material;
- stale recovery attempts preserve the replacement credential and commercial right.

### Public recovery boundary

No public revoke/reissue/recovery endpoint exists.

No runtime `ACCESS_REISSUE_REQUESTED` producer or consumer is active.

A future public recovery flow must not be based only on `orderId`, email possession, or other weak identifiers.

Until a trusted authenticated administrative or identity-verification boundary exists, revoke/reissue remains a server-side/internal capability.

### Security separation

Rate limiting and abuse controls are not part of C6.2 and remain assigned to P11-C6.3.

No direct recovery secret logging was found.

No schema change or migration was introduced by C6.2.

### Final C6.2 security gate

- RESULT: PASS;
- SECURITY FINDINGS: 0;
- targeted Buyer Access MySQL: 31/31;
- unit regression: 342/342;
- MySQL integration regression: 113/113;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- git diff --check: PASS;
- lessenc_dev restore/guard: PASS.

No commit, push, tag, PR, merge, or deploy was performed.

Next checkpoint: P11-C6.3 — Rate Limiting & Abuse Controls.

P11 remains open.
## P11-C6.3 — Rate Limiting & Abuse Controls — FROZEN

Status: **COMPLETE / PASS / DOCUMENTED / FROZEN**

### Frozen security contract

- Buyer Access rate limiting uses shared MySQL state; no process-local production limiter.
- Algorithm: fixed window with concurrency-safe atomic counters.
- Isolation: `ReadCommitted`.
- Counter saturation: `limit + 1`.
- Persistence model: `BuyerAccessRateLimitBucket`.
- Table: `buyer_access_rate_limit_buckets`.
- Primary key: `(scope, bucketHash, windowStart)`.
- Rate-limit persistence has no foreign keys to Order, Payment, Entitlement, BuyerAccessCredential, Customer, Resource, or other commercial-right state.
- Bucket identity is a lowercase SHA-256 fingerprint with scope/domain separation.
- Raw Buyer Access credentials are never persisted in rate-limit storage.
- No raw credential, Buyer Session secret, session token, Authorization value, DB URL, or private storage path is introduced into limiter logging.
- `429` is operational throttling only; it never revokes or mutates BuyerAccessCredential, Entitlement, Order, Payment, grants, or digital-resource rights.
- Rate limiting performs no Mercado Pago/provider re-query or provider-state interpretation.
- No `X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `request.ip`, remote-address, or client-IP trust boundary is enabled in C6.3.
- A future verified proxy/edge boundary may introduce an IP dimension only after explicit trusted-proxy design.

### Frozen HTTP policies

- `EXCHANGE_GLOBAL`: 120 requests / 60 seconds.
- `EXCHANGE_CREDENTIAL`: 6 requests / 600 seconds.
- `LIBRARY_CREDENTIAL`: 120 requests / 60 seconds.
- `DOWNLOAD_CREDENTIAL`: 30 requests / 60 seconds.
- Throttled HTTP response: `429`.
- Generic response code: `TOO_MANY_REQUESTS`.
- `Retry-After` is returned as integer seconds.
- Exchange ordering: same-origin validation -> body validation -> global limiter -> credential-fingerprint limiter -> credential exchange.
- Library ordering: persisted Buyer Session validation -> credential limiter -> resource listing.
- Download ordering: persisted Buyer Session validation -> credential limiter -> authorization/storage/audit preparation.
- Download throttling occurs before protected delivery preparation, therefore a `429` does not produce a successful or failed DigitalDeliveryEvent.

### Persistence / migration

Migration:

`20260913165037_p11_buyer_access_rate_limit_buckets`

SHA-256:

`E761A9592681C39EAFDF15FD8B68EC095C924ACC01D4F8F82A0E012D3556E072`

The migration is additive, creates only `buyer_access_rate_limit_buckets`, introduces no FK to commercial state, and is applied/current on both `lessenc_dev` and `lessenc_test`.

P06 privilege separation remains intact:

- migrations use `lessenc_migrate`;
- normal `lessenc_test` runtime/integration access remains DML-only;
- no permanent privilege elevation was introduced.

### Validation evidence

- C6.3-C targeted unit: **14/14 PASS**
- C6.3-C targeted MySQL: **7/7 PASS**
- C6.3-D1 targeted HTTP/enforcement: **42/42 PASS**
- C6.3-D2 Buyer Access targeted security: **56/56 PASS**
- Full unit regression: **368/368 PASS**
- Full MySQL integration regression: **120/120 PASS**
- Prisma validate: **PASS**
- Typecheck: **PASS**
- Lint: **PASS**
- Production build: **PASS**
- `lessenc_dev` migration status: **CURRENT**
- `lessenc_test` migration status: **CURRENT**
- Migration count: **5**
- `git diff --check`: **PASS**
- Security findings: **0**

### Freeze decision

`P11-C6.3 = COMPLETE / PASS / DOCUMENTED / FROZEN`

No further C6.3 behavioral or schema change is authorized implicitly by this closeout.

Next checkpoint:

`P11-C6.4 — Storage Failure Recovery`

## P11-C6.4 — Storage Failure Recovery

Status: P11-C6.4 = COMPLETE / PASS / DOCUMENTED / FROZEN

Date: 2026-09-13

### Scope

P11-C6.4 defines and proves recovery behavior for operational failures in the protected private digital-delivery storage path.

Storage failure remains an operational delivery failure. It does not remove, rewrite, revoke, expire, or otherwise mutate the buyer's commercial right.

### Frozen recovery contract

- Authentication and persisted Buyer Access validation occur before protected delivery.
- Authorization occurs before private storage access.
- Configured private storage is lazy: route composition does not resolve PRIVATE_FILE_STORAGE_PATH or touch the filesystem.
- There is no automatic same-request storage retry or retry loop.
- Recovery occurs through a new authenticated and authorized request after the underlying storage condition has been repaired.
- RESOURCE_NOT_FOUND is recorded as a FAILED DigitalDeliveryEvent and maps to the generic HTTP 503 SERVICE_UNAVAILABLE boundary.
- STORAGE_ROOT_UNAVAILABLE is recorded as a FAILED DigitalDeliveryEvent and maps to the generic HTTP 503 SERVICE_UNAVAILABLE boundary.
- Unexpected storage failures remain normalized through the established storage/delivery error boundary.
- A later successful delivery creates a new SUCCEEDED DigitalDeliveryEvent.
- Delivery audit is append-only: the original FAILED event is retained and is never rewritten into SUCCEEDED.
- Storage recovery does not mutate BuyerAccessCredential, Entitlement, Order, Payment, or EntitlementDigitalResource.
- Storage recovery does not query, reinterpret, or otherwise interact with Mercado Pago or another payment provider.
- No new schema model or migration was introduced by C6.4.
- A stream that fails after delivery begins is not resumed inside the same response. A later request starts a fresh delivery from the beginning.
- Range/resume behavior remains outside the protected-delivery contract established by C5.
- HTTP storage failure responses remain generic and do not expose storageKey, entitlement identifiers, resource internals, absolute filesystem paths, or infrastructure details.

### Storage configuration hardening

C6.4 changed configured private storage from eager construction-time resolution to a lazy adapter.

createConfiguredPrivateFileStorage() is construction-only.

Environment parsing, private-root policy validation, LocalPrivateFileStorage construction, and filesystem resolution occur only when stat/open are actually required by an authorized delivery attempt.

This preserves the security ordering:

buyer session validation -> resource authorization -> storage resolution -> audit/delivery.

A production build also succeeds without PRIVATE_FILE_STORAGE_PATH being present during route composition, proving that private-storage configuration is not eagerly resolved at build/import time.

### Recovery proof

The C6.4 end-to-end integration uses:

- the real protected-download HTTP handler;
- the real Prisma resource-authorization repository;
- the real Prisma DigitalDeliveryEvent audit repository;
- the real Buyer Access session validation path;
- an isolated P06 MySQL test database;
- a real temporary private filesystem root.

Two recovery paths are proven:

1. RESOURCE_NOT_FOUND -> HTTP 503 -> FAILED audit -> object restored -> new request -> HTTP 200 -> SUCCEEDED audit.
2. STORAGE_ROOT_UNAVAILABLE -> HTTP 503 -> FAILED audit -> root restored -> new request -> HTTP 200 -> SUCCEEDED audit.

For both paths:

- the FAILED event remains unchanged after recovery;
- the SUCCEEDED event is a distinct appended event;
- Order remains PAID;
- Entitlement remains ACTIVE;
- BuyerAccessCredential remains ACTIVE;
- immutable EntitlementDigitalResource remains unchanged;
- no payment-provider interaction occurs.

### FileHandle lifecycle

C6.4 detected a test-only FileHandle lifecycle problem where successful recovery tests opened the real delivery body but recorded success without consuming the stream.

The tests were corrected to consume delivery.body before recording SUCCEEDED.

Final validation reports zero Node DEP0137 / garbage-collected FileHandle warnings in targeted and full unit validation.

### C6.3 regression remediation discovered during C6.4

During the C6.4 full MySQL regression, the previously frozen C6.3 rate-limit concurrency test exposed a reproducible Prisma interactive-transaction startup timeout.

Observed environment:

- Prisma 7.10.0;
- @prisma/client 7.10.0;
- database adapter connectionLimit = 5;
- 20 concurrent rate-limit consumers;
- Prisma default interactive-transaction maxWait = 2000 ms.

The rate-limit concurrency test passed 3/3 when executed as the isolated test, while the complete rate-limit file could reproduce transaction-start acquisition failure after preceding database activity.

The controlled remediation was limited to:

- maxWait: 5_000 on the Buyer Access rate-limit repository interactive transaction.

The following C6.3 invariants remain unchanged:

- global database connectionLimit remains 5;
- concurrency test remains 20 consumers;
- fixed-window policies remain unchanged;
- MySQL INSERT ... ON DUPLICATE KEY UPDATE remains unchanged;
- request_count remains capped with LEAST(request_count + 1, limit + 1);
- SELECT ... FOR UPDATE remains unchanged;
- isolation remains ReadCommitted;
- no schema or migration change;
- no commercial-right mutation;
- no payment-provider interaction.

Post-remediation proof:

- complete rate-limit integration file: 7/7 PASS in 3 consecutive runs;
- C6.4 recovery integration: 2/2 PASS;
- full MySQL regression: 122/122 PASS;
- full unit regression: 372/372 PASS.

C6.3 remains COMPLETE / PASS / DOCUMENTED / FROZEN with the R2 operational remediation incorporated into the current baseline.

### Final C6.4 validation

- targeted storage/security: 40/40 PASS;
- C6.4 real HTTP/MySQL recovery: 2/2 PASS;
- C6.3 rate-limit MySQL re-proof: 7/7 PASS;
- full unit regression: 372/372 PASS;
- full MySQL regression: 122/122 PASS;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- FileHandle GC warnings: 0;
- security findings: 0;
- migrations: 5;
- C6.3 rate-limit migration SHA-256 preserved as E761A9592681C39EAFDF15FD8B68EC095C924ACC01D4F8F82A0E012D3556E072.

### Explicit non-goals

C6.4 does not implement backup/restore, global storage replication, disaster recovery, retention, broad observability, alerting, or rate-limit bucket cleanup.

Those remain later C6 responsibilities.

Next: P11-C6.5 — Backup / Restore.

<!-- P11-C6.5-CLOSEOUT -->

## P11-C6.5 — Backup / Restore — COMPLETE / PASS / DOCUMENTED / FROZEN

P11-C6.5 completed and froze the backup and restore contract for secure digital delivery.

Canonical operational runbook:

- docs/operations/p11-backup-restore-runbook.md

### Frozen backup contract

The P11 recovery unit is the application database plus private digital-resource storage.

The backup implementation produces a self-contained version-1 bundle containing database.sql, manifest.json, and the private storage hierarchy.

Integrity metadata includes:

- database SHA-256;
- per-file storage SHA-256;
- Prisma migration names and SHA-256.

The manifest does not persist application secrets, complete database URLs, Mercado Pago credentials, HMAC/session secrets, raw Buyer Access credentials, private keys, or absolute private-storage paths.

The proven database backup mechanism is mysqldump --single-transaction.

### C6.5-C1 backup proof

The real local backup used lessenc_dev as the source database.

Results:

- real local backup: PASS;
- independent bundle verification: PASS;
- migration hashes: 5/5;
- storage hashes: 2/2;
- self-contained bundle: PASS;
- targeted backup tests: 7/7;
- full unit tests: 379/379;
- full MySQL tests: 122/122;
- typecheck: PASS;
- lint: PASS.

### C6.5-C2 restore drill

Destructive restore authorization was limited exclusively to lessenc_test_rebuild.

Protected databases:

- lessenc_dev;
- lessenc_test.

The disposable database was dropped, recreated, and restored from the C6.5 backup.

Restore proof:

- tables: 16/16;
- charset/collation: PASS;
- exact SHOW CREATE TABLE: 16/16;
- table metadata: PASS;
- foreign keys: PASS;
- indexes: PASS;
- per-table row counts: PASS;
- per-table data SHA-256: 16/16;
- Prisma migrations: 5/5;
- storage SHA-256: 2/2;
- missing DB-referenced storage files: 0.

Raw aggregate mysqldump SHA-256 equality is not the canonical restore-equivalence gate because aggregate serialization can differ after a semantically exact restore.

Canonical equivalence is frozen on exact DDL, metadata, migration history, per-table data SHA-256, and storage integrity.

### Post-restore application proof

Application traffic was routed to the restored lessenc_test_rebuild target.

Results:

- restored-target integration test files: 10/10;
- restored-target integration tests: 122/122;
- restored tables after tests: 16;
- restored migrations after tests: 5;
- full unit test files: 31/31;
- full unit tests: 379/379;
- typecheck: PASS;
- lint: PASS.

lessenc_dev remained unchanged.

lessenc_test remained unchanged.

### Operational boundaries

RPO remains OPEN.

RTO remains OPEN.

Backup retention remains OPEN.

The measured local restore duration is not a production RTO.

Production scheduling, encryption, off-site replication, and provider decisions remain future operational work.

No production or staging restore was performed.

No destructive restore was performed against lessenc_dev or lessenc_test.

No commit, push, tag, PR, merge, or deploy was performed as part of C6.5.

Next checkpoint:

P11-C6.6 — Observability / Alerts

<!-- P11-C6.6-C5B-DOC-FREEZE -->

## P11-C6.6 — Observability / Alerts — C5B Documentation Freeze

Date: 2026-09-13

Status:

`P11-C6.6-C5B = COMPLETE / PASS / DOCUMENTED / FROZEN`

Canonical operational runbook:

- `docs/operations/p11-observability-alerting-runbook.md`

### Frozen observability contract

C6.6 uses provider-neutral structured observability.

Correlation IDs are server-generated.

Routine observability is low-cardinality and must not log raw Buyer Access credentials, Buyer Session cookies/tokens, Authorization values, HMAC/session secrets, Mercado Pago credentials, complete DB URLs/passwords, absolute private-storage paths, request bodies, complete emails, arbitrary `error.message`, or routine customer/order/resource/credential/IP identifiers.

Frozen events include:

- `buyer_access_invalid`;
- `buyer_access_rate_limited`;
- `buyer_access_limiter_unavailable`;
- `private_storage_failure`;
- `delivery_audit_unavailable`;
- `delivery_stream_failed`;
- `credential_recovery_failed`;
- `entitlement_revocation_failed`;
- `backup_verification_failed`;
- `restore_validation_failed`;
- `rate_limit_cleanup_completed`;
- `rate_limit_cleanup_failed`;
- `rate_limit_stale_buckets_detected`.

### Immediate alert signals

Immediate one-occurrence conditions are frozen for:

- `DELIVERY_AUDIT_UNAVAILABLE`;
- `STORAGE_ESCAPE_DETECTED`;
- `STORAGE_ROOT_INVALID`;
- `ENTITLEMENT_REVOCATION_FAILED`;
- `RATE_LIMIT_UNAVAILABLE`;
- `BACKUP_VERIFICATION_FAILED`;
- `RESTORE_VALIDATION_FAILED`;
- `RATE_LIMIT_CLEANUP_FAILED`;
- stale rate-limit buckets remaining after cleanup.

### Deferred recurrence rules

The following require a future real collector/aggregator:

- `STORAGE_ROOT_UNAVAILABLE >= 3 / 5m`;
- `STORAGE_UNAVAILABLE >= 3 / 5m`;
- `RESOURCE_NOT_FOUND >= 3 / 5m`;
- `STREAM_FAILED >= 5 / 5m`;
- rate-limit `429 >= 20 / 5m` per surface/scope.

No fake process-local rolling-window evaluator was introduced.

### Operational health

Public `/api/health` remains liveness-only.

Deep health is available through:

`npm run ops:p11:operational-health -- --target-database=<database>`

The probe is read-only and evaluates five checks:

- APPLICATION_CONTRACT;
- DATABASE_CONNECTIVITY;
- RATE_LIMIT_RETENTION;
- PRIVATE_STORAGE;
- OBSERVABILITY_CONTRACT.

Statuses are `OK`, `DEGRADED`, and `FAILED`.

### Rate-limit retention

Rate-limit bucket retention is 24 hours.

Cleanup remains outside the HTTP request path and is executed explicitly with:

`npm run ops:p11:rate-limit-cleanup -- --target-database=<database>`

The command is dry-run-first and performs controlled batched cleanup only when explicitly authorized by its execution flags.

No commercial-right state is mutated.

### Backup / restore observability

Backup verification failures emit `backup_verification_failed`.

Restore validation failures emit `restore_validation_failed`.

The backup CLI exposes only the generic failure marker `P11_BACKUP_ERROR=BACKUP_OPERATION_FAILED`.

`restore-validate` is read-only and does not perform a physical restore.

The authorized C6.5 physical restore drill remains unchanged.

### C6.6-C4 final proof

- targeted C4: 15/15 PASS;
- full unit: 417/417 PASS;
- full MySQL: 125/125 PASS;
- operational-health SQL: 2/2 SELECT-only;
- typecheck: PASS;
- lint: PASS;
- public deep-health exposure: none;
- external observability provider: none;
- fake in-memory aggregation: none;
- schema change: none;
- new migration: none.

### OPEN / DEFERRED

Still OPEN or DEFERRED:

- external observability provider;
- five-minute event aggregation infrastructure;
- production cleanup scheduler;
- actual restore executor;
- RPO;
- RTO;
- backup retention;
- production backup schedule;
- encryption;
- off-site replication;
- backup provider.

C6.6 is not yet declared overall complete by C5B alone.

Next checkpoint:

`P11-C6.6-C5C — Final Regression / Documentation Consistency / C6.6 Closeout`

No commit, push, tag, PR, merge, or deploy was authorized or performed by C5B.

<!-- P11-C6.6-CLOSEOUT -->

## P11-C6.6 — Observability / Alerts — COMPLETE / PASS / DOCUMENTED / FROZEN

Date: 2026-09-13

Canonical runbook:

- `docs/operations/p11-observability-alerting-runbook.md`

P11-C6.6 completed C1 through C5.

Final validation:

- targeted C6.6: 32/32 PASS;
- full unit: 417/417 PASS;
- full MySQL: 125/125 PASS;
- operational health: 5/5 OK;
- operational-health database calls: 2/2 SELECT-only;
- rate-limit cleanup dry-run: PASS;
- observability privacy gate: PASS;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- schema change: none;
- migration count: 5;
- C6.3 migration checksum preserved.

Frozen boundaries:

- `/api/health` remains liveness-only;
- deep operational health remains explicit and read-only;
- rate-limit bucket retention is 24 hours;
- cleanup remains outside request paths;
- backup/restore failures use safe structured signals;
- `restore-validate` remains read-only;
- no actual restore executor was introduced;
- no external observability provider was selected;
- no fake in-memory five-minute aggregator was introduced.

OPEN / DEFERRED:

- external observability provider;
- persistent log/metric collector;
- five-minute recurrence evaluator;
- production rate-limit cleanup schedule;
- RPO;
- RTO;
- backup retention;
- production backup scheduling/encryption/off-site replication/provider;
- actual production restore executor.

Final result:

`P11-C6.6 = COMPLETE / PASS / DOCUMENTED / FROZEN`

Next:

`P11-C6.7 — Final Security & Recovery Review`

P11 remains open.

C7 must still re-prove the canonical full-refund -> Entitlement REVOKED -> protected-download denied path.

No commit, push, tag, PR, merge, or deploy was authorized or performed during C6.6 closeout.

<!-- P11-C6.7-CLOSEOUT -->

## P11-C6 — Security & Recovery — COMPLETE / PASS / DOCUMENTED / FROZEN

Date: 2026-09-13

C6.1 through C6.7 are complete.

Final adversarial evidence:

- targeted adversarial unit: 100/100 PASS;
- targeted adversarial MySQL: 43/43 PASS;
- full unit: 417/417 PASS;
- full MySQL: 125/125 PASS;
- operational health: 5/5 OK;
- rate-limit cleanup dry-run: PASS;
- retention: 86400 seconds;
- backup verification failure signal: PASS;
- restore validation failure signal: PASS;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- schema/migrations unchanged.

Frozen security/recovery boundaries:

- full refund is the commercial revocation authority;
- credential recovery rotates credentials without revoking entitlement;
- storage failures preserve entitlement;
- 429/rate limiting preserves entitlement;
- observability and backup failures preserve commercial rights;
- no P11 recovery provider re-query;
- no public recovery endpoint;
- no trusted client-IP boundary yet;
- no actual production restore executor;
- `/api/health` remains liveness-only;
- no external observability provider;
- no fake five-minute aggregator.

Canonical review:

- `docs/operations/p11-security-recovery-review.md`

OPEN / DEFERRED:

- RPO;
- RTO;
- backup retention;
- production backup schedule;
- encryption;
- off-site replication;
- backup provider;
- production restore executor;
- production cleanup scheduler;
- external observability provider;
- persistent five-minute aggregation;
- trusted proxy/IP boundary.

Final result:

`P11-C6 = COMPLETE / PASS / DOCUMENTED / FROZEN`

P11 remains open.

Next:

`P11-C7 — Regression / Final Gate`

C7 must independently re-prove:

authoritative full refund
-> REFUND_COMPLETED v1
-> Entitlement REVOKED
-> resource authorization denied
-> protected download denied

No commit, push, tag, PR, merge, or deploy was authorized or performed.

<!-- P11-C7-CLOSEOUT -->

## P11 — COMPLETE / PASS / DOCUMENTED / FROZEN

Date: 2026-09-13

P11 C1 through C7 are complete.

Final C7 evidence:

- canonical C7 scenario: 1/1 PASS;
- entitlement-grant integration: 23/23 PASS;
- protected-download HTTP boundary: 10/10 PASS;
- full MySQL: 125/125 PASS;
- full unit: 417/417 PASS;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- schema unchanged;
- migration count: 5;
- P11 migration checksums preserved.

Canonical chain:

authoritative full refund
-> REFUND_COMPLETED v1
-> Entitlement ACTIVE -> REVOKED
-> immutable grant retained
-> Buyer Access credential retained ACTIVE
-> resource authorization denied
-> protected download 404 RESOURCE_NOT_AVAILABLE
-> protected delivery stage not reached
-> no protected resource bytes released
-> no DigitalDeliveryEvent created
-> refund replay NOOP
-> revokedAt unchanged

No direct Mercado Pago re-query occurs in the P11 final-gate path.

Canonical final review:

- `docs/operations/p11-final-gate.md`

P11 final result:

`P11 = COMPLETE / PASS / DOCUMENTED / FROZEN`

Git publication remains NOT AUTHORIZED.

No commit, push, tag, PR, merge, or deploy was authorized or performed.

Next macro-checkpoint:

`Gate B`

<!-- GATE-B-MEMORY-CLOSEOUT -->

## Gate B — PASS / COMMERCE CORE READY

Date: 2026-09-13

Gate B technical review and documentary closeout are complete.

Canonical question:

`Can a customer create an order, pay and receive access safely, reliably and auditably?`

Result:

`PASS`

Canonical positive chain:

`Order -> Payment -> Entitlement -> protected Delivery`

Canonical adversarial chain:

`Full refund -> REFUND_COMPLETED v1 -> Entitlement REVOKED -> authorization denied -> protected download 404 -> zero protected resource bytes`

Final evidence:

- Gate B commerce-core scenario: 1/1 PASS;
- MySQL: 12 files / 126 tests PASS;
- unit: 37 files / 417 tests PASS;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- acceptance matrix: 20/20 PASS.

Final document:

`docs/operations/gate-b-commerce-core-ready.md`

Next candidate:

`P12 — Identity / Authentication / Administrative Access`

P12 is NOT AUTHORIZED by this closeout.

Git publication remains NOT AUTHORIZED.

No commit, push, tag, PR, merge or deploy was authorized or performed.
