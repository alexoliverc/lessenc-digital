# Índice oficial da baseline documental LES-DIG P00–P12 + P13-A

**Estado:** P00–P12 implementadas. Gate A PASS. Gate B PASS / COMMERCE CORE READY. P11 está COMPLETE / PASS / DOCUMENTED / FROZEN / INTEGRATED. P12 está COMPLETE / PASS / DOCUMENTED / INTEGRATED. P13 está IN PROGRESS: P13-A está COMPLETE / ARCHITECTURE FROZEN R2 / DOCUMENTED / INTEGRATED; P13-B — Attribution Persistence Foundation está COMPLETE / PASS / DOCUMENTED / GIT CLOSEOUT PENDING; P13-C permanece NOT STARTED.

## Precedência e classificação das fontes

1. [AGENTS.md](../AGENTS.md) — regras operacionais;
2. [MEMORY.md](../MEMORY.md) — estado consolidado atual do projeto;
3. [ROADMAP.md](../ROADMAP.md) — roadmap e status atuais aprovados;
4. documentos canônicos atuais indexados abaixo;
5. [ADRs aceitos](decisions/README.md) — decisões arquiteturais aprovadas;
6. [memory/YYYY-MM-DD.md](../memory/README.md) — histórico operacional;
7. documentos marcados `HISTORICAL`, `SUPERSEDED` ou `INCOMPLETE` — contexto somente, nunca normativos.

Decisão explícita mais recente do owner prevalece. Em conflito entre documento histórico e baseline canônica: **CURRENT CANONICAL BASELINE WINS**. Não inferir arquitetura, produto, preço, ambientes ou stack atuais a partir de documento histórico; o estado físico instalado deve ser verificado no repositório.

## CANONICAL CURRENT DOCUMENTS

Os links das seções P00–P12, [segurança](security/README.md), [operações](operations/README.md) e [ADRs aceitos](decisions/README.md) constituem o índice canônico atual. Documentar um alvo não significa que foi instalado; os checkpoints e Final Gates identificam a implementação fisicamente validada.

## Governança P00

[AGENTS.md](../AGENTS.md) (processo e gates), [ROADMAP.md](../ROADMAP.md) (posição atual), [MEMORY.md](../MEMORY.md) (decisões consolidadas), [política](../memory/README.md) e [registro de sessão](../memory/2026-09-11.md). A missão desta baseline é a fonte da atualização; não depender de memória externa da conversa.

## Produto P01 — `docs/product/`

| Tema                       | Documento                                                                        |
| -------------------------- | -------------------------------------------------------------------------------- |
| Requisitos                 | [product-requirements.md](product/product-requirements.md)                       |
| Primeiro produto           | [first-product-definition.md](product/first-product-definition.md)               |
| Oferta e regras comerciais | [offer-commercial-rules.md](product/offer-commercial-rules.md)                   |
| Jornada                    | [customer-journey-business-rules.md](product/customer-journey-business-rules.md) |
| Rastreabilidade            | [requirements-matrix.md](product/requirements-matrix.md)                         |

## Arquitetura P02 — `docs/architecture/`

[system-architecture.md](architecture/system-architecture.md), [module-boundaries.md](architecture/module-boundaries.md), [integrations-architecture.md](architecture/integrations-architecture.md) e [deployment-architecture.md](architecture/deployment-architecture.md). Os [11 ADRs aceitos](decisions/README.md) formalizam decisões transversais; [segurança](security/README.md) consolida invariantes e controles.

## Dados e domínio P03 — `docs/architecture/`

[domain-model.md](architecture/domain-model.md), [order-state-machine.md](architecture/order-state-machine.md), [payment-state-machine.md](architecture/payment-state-machine.md), [entitlement-fulfillment-state-machines.md](architecture/entitlement-fulfillment-state-machines.md), [refund-notification-outbox-models.md](architecture/refund-notification-outbox-models.md), [relational-model-constraints.md](architecture/relational-model-constraints.md), [prisma-schema-architecture.md](architecture/prisma-schema-architecture.md), [data-integrity-concurrency-review.md](architecture/data-integrity-concurrency-review.md) e [p03-exit-review.md](architecture/p03-exit-review.md).

## Fundação P04 — especificação em `docs/architecture/`

[runtime-toolchain-baseline.md](architecture/runtime-toolchain-baseline.md), [source-architecture-module-skeleton.md](architecture/source-architecture-module-skeleton.md), [configuration-environment-system.md](architecture/configuration-environment-system.md), [shared-application-primitives.md](architecture/shared-application-primitives.md), [logging-errors-observability-foundation.md](architecture/logging-errors-observability-foundation.md), [testing-foundation.md](architecture/testing-foundation.md) e [p04-exit-review.md](architecture/p04-exit-review.md). A [baseline de segurança da aplicação](security/application-security-baseline.md) detalha os controles correspondentes. A implementação física P04 foi validada e integrada em `main` no merge `da59530`.

## Design System P05 — `docs/design-system/`

O [índice P05](design-system/README.md) liga [tokens](design-system/design-tokens.md), [componentes](design-system/component-foundation.md), [responsividade e acessibilidade](design-system/responsive-accessibility.md) e [exit review](design-system/p05-exit-review.md). A implementação P05 recebeu PASS na revisão técnica do ChatGPT e Gate A — FOUNDATION READY recebeu PASS em 12/09/2026.

## Persistência P06 — implementação física concluída

O [índice P06](persistence/README.md) liga [modelo físico](persistence/data-model.md), [MySQL local, migrações e testes](persistence/local-mysql-and-testing.md) e [exit review](persistence/p06-exit-review.md). O [bootstrap anterior](architecture/prisma-database-bootstrap.md) permanece como planejamento P04/P06 revalidado; a baseline física P06 foi encerrada com PASS.

## Core Domain & Application P07 — COMPLETE

[Brief autorizado](architecture/p07-phase-execution-brief.md), [implementação e limites](architecture/p07-core-implementation.md) e [Validation Report](architecture/p07-validation-report.md). P07 está COMPLETE após checkpoint `4c96e7b` e merge da PR #6 em `6a19eda`.

## Public Sales Experience P08 — COMPLETE

[Brief autorizado](architecture/p08-phase-execution-brief.md), [plano físico de implementação](architecture/p08-implementation-plan.md) e [Validation Report](architecture/p08-validation-report.md).

P08 está COMPLETE após ChatGPT Technical Review PASS, Final Quality Gate PASS, checkpoint `f73400a`, tag `checkpoint/p08-public-sales-experience-complete` e merge da PR #8 em `main` como `2686e39`.

A experiência pública entrega `/` estática e `/cronograma-capilar-inteligente` dinâmica e server-authoritative. Checkout, criação de Order, Mercado Pago e fulfillment permanecem fora da P08.

## Checkout & Order Creation P09 — COMPLETE

[Brief autorizado](architecture/p09-phase-execution-brief.md), [plano físico de implementação](architecture/p09-implementation-plan.md) e [Validation Report](architecture/p09-validation-report.md).

P09 está COMPLETE após ChatGPT Technical Re-Review PASS, Final Quality Gate PASS, checkpoint 62e70eb, tag checkpoint/p09-checkout-order-creation-complete e merge da PR #10 em main como cda1ae9.

A implementação entrega /checkout backend-authoritative, email mínimo do comprador, submission token assinado, resolução server-side de Product/Offer, criação atômica de Customer + Order.PENDING + OrderItem e prevenção de duplicidade/idempotência.

Payment, Mercado Pago, Entitlement e fulfillment permanecem fora da P09.

A auditoria pós-merge A01–A06 foi integralmente remediada. Checkpoint `53bdaafc0f740241807a498b0a64378bab25c683`, tag `checkpoint/p09-post-audit-remediation-complete`, PR #12 e merge `c78ae181be209ff8c91e996e785b42fb77f6edb2`.

P10 foi executada na branch própria, recebeu revisão técnica PASS após remediação A01–A05 e Final Quality Gate R2 PASS, e foi integrada em `main` pelo PR #14 no merge `6b311624c2e4824d2fc909fbcb994eab2ca9369d`.

## Mercado Pago Integration P10 — COMPLETE

[Phase Execution Brief](architecture/p10-phase-execution-brief.md), [Physical Implementation Plan](architecture/p10-implementation-plan.md) e [Validation Report](architecture/p10-validation-report.md).

P10 implementa a fronteira financeira via Checkout Transparente / Orders API, persistência de tentativas e eventos, PIX, cartão de crédito em uma parcela, 3DS, webhook verificado e reconciliação. A auditoria independente A01–A05 foi integralmente remediada, o Final Quality Gate R2 passou e o PR #14 foi integrado em `main` no merge `6b311624c2e4824d2fc909fbcb994eab2ca9369d`. Mercado Pago TEST real e browser/Brick real permanecem limitações de ambiente documentadas. Entitlement/Delivery continuam P11.

## Entitlement & Secure Digital Delivery P11 — COMPLETE

O [P11 Final Gate](operations/p11-final-gate.md) e o [Gate B — Commerce Core Ready](operations/gate-b-commerce-core-ready.md) registram o fechamento da entrega digital segura, o cenário canônico de refund/revogação/negação e a integração em `main` através da PR #16.

## Identity, Authentication & Admin P12 — COMPLETE / PASS / DOCUMENTED / INTEGRATED

A [ADR-0011](decisions/ADR-0011-better-auth-admin-identity.md) congela a decisão de identidade administrativa isolada; o [Phase Execution Brief](architecture/p12-identity-auth-admin-phase-execution-brief.md) preserva a especificação P12-A e seu resultado de implementação; o [P12 Final Gate](operations/p12-final-gate.md) consolida P12-A–H, arquitetura final, rotas, backoffice, RBAC, auditoria, evidências e limites.

P12-H Technical Gate é PASS. A PR #18 integrou o checkpoint final de implementação P12 `ea3295cf1703466763c9cd333d98e59fe6535f8e` através do merge `482e095e9c515c163dd4b057f07baf06f3450f95`; a PR #19 integrou o documentation closeout auditado `8d7a64430532b42019ba346fd8591087e2a7cc3a` através do merge `f29487c67621eb3151fa45f1337c0a9e6dd19ca5`. O primeiro OWNER não foi inicializado e nenhuma conta administrativa real foi criada. Checkpoint/tagging permanece separado, produção está fora da P12 e P13 está IN PROGRESS; P13-A está COMPLETE / ARCHITECTURE FROZEN R2 / DOCUMENTED / INTEGRATED; P13-B está COMPLETE / PASS / DOCUMENTED / GIT CLOSEOUT PENDING e P13-C permanece NOT STARTED.

<!-- P13-A-CANONICAL-DOCUMENTS -->
## P13 — Analytics, Attribution & Growth Infrastructure

P13 está **IN PROGRESS**.

P13-A — Architecture, Privacy & Measurement Contract está **COMPLETE / ARCHITECTURE FROZEN R2 / DOCUMENTED**.

P13 runtime implementation está **IN PROGRESS**: P13-B está concluída e P13-C–P13-H permanecem não iniciadas.

P13-B — Attribution Persistence Foundation está **COMPLETE / PASS / DOCUMENTED / GIT CLOSEOUT PENDING**. P13-C — Acquisition Journey & Order Attribution é o próximo bloco e permanece **NOT STARTED**.

<!-- P13-B-CANONICAL-CLOSEOUT -->
### P13-B — Attribution Persistence Foundation

P13-B está **COMPLETE / PASS / DOCUMENTED / GIT CLOSEOUT PENDING**.

O [P13-B Final Gate](operations/p13-b-final-gate.md) registra a migration física, modelos, repositories provider-neutral, provas MySQL, deduplicação, isolamento do Outbox P10/P11, regressões e a exceção documentada do débito global de Prettier.

P13-A final Git lifecycle:

- commit `86fb0d1d6b09c5375ac386f45baf47f61a63111b`;
- PR #21 MERGED;
- merge `328de43bedfb400d2b5bb0cd5f2a1014375ac2d8`;
- checkpoint `checkpoint/p13-a-architecture-freeze-r2`.

P13-B Git publication/integration has not yet occurred.

### Documentos canônicos

- [P13 Analytics, Attribution & Growth Contract](architecture/p13-analytics-attribution-growth-contract.md) — contrato de arquitetura, privacidade, consentimento, atribuição, canonical measurement, Purchase authority, GTM, GA4, Google Ads, Meta e stop conditions;
- [P13 Phase Execution Brief](architecture/p13-phase-execution-brief.md) — sequência operacional P13-A–H e responsabilidades dos blocos.

### Arquitetura de measurement aprovada

Canonical internal measurement:

- `AnalyticsEvent`.

Client-side orchestration:

- Google Tag Manager.

External analytics destination:

- Google Analytics 4.

External advertising destinations:

- Google Ads;
- Meta.

Initial delivery boundaries:

- GA4 through GTM;
- Google Ads conversion measurement through GTM;
- Meta Pixel through GTM;
- Meta Conversions API server-side.

Commerce e Payments permanecem autoridade financeira.

GTM, GA4, Google Ads e Meta não são autoridade comercial, financeira ou de entitlement.

### P13-F

P13-F foi redefinida como **Measurement & Advertising Adapters**:

- P13-F1 — Google Tag Manager Foundation;
- P13-F2 — Google Analytics 4;
- P13-F3 — Google Ads;
- P13-F4 — Meta Pixel;
- P13-F5 — Meta Conversions API;
- P13-F6 — Provider Deduplication, Consent & Failure Isolation.

Google Enhanced Conversions e Meta Advanced Matching permanecem fora do P13 MVP inicial.

## Operações
O [índice operacional](operations/README.md) reúne procedimentos do ambiente de desenvolvimento. A [baseline da workstation e VS Code](operations/development-workstation-vscode.md) registra Profile, editor, terminal, Git/SCM, extensões, segurança, performance e recuperação sem redefinir a stack ou os ambientes canônicos da aplicação.

## HISTORICAL / SUPERSEDED DOCUMENTS

Os documentos [architecture/LES-*-R01.md](architecture/README.md), o [roadmap MVP anterior](LES-ROADMAP-DIG-R01.md) e o [guia local antigo](operations/LOCAL-CONNECTIVITY-R01.md) registram a sequência anterior. São **HISTORICAL / SUPERSEDED**: não estabelecem produto, preço, oferta, ambientes, stack ou próximos gates atuais. O [LES-FLOW-DIG-R01.md](architecture/LES-FLOW-DIG-R01.md) também é **INCOMPLETE** e termina truncado; não completar suas regras por inferência. `CURRENT CANONICAL BASELINE WINS` em toda divergência. O histórico permanece legível como evidência temporal. Os diretórios não têm placeholders vazios.
