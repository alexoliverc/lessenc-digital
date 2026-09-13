# Índice oficial da baseline documental LES-DIG P00–P09

**Estado:** P00–P09 COMPLETE. Gate A PASS. P09 e a remediação pós-auditoria A01–A06 estão encerradas e integradas em `main`. P10 — Mercado Pago Integration está OWNER AUTHORIZED / NOT STARTED.

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

Os links das seções P00–P09, [segurança](security/README.md), [operações](operations/README.md) e [ADRs aceitos](decisions/README.md) constituem o índice canônico atual. Documentar um alvo não significa que foi instalado.

## Governança P00

[AGENTS.md](../AGENTS.md) (processo e gates), [ROADMAP.md](../ROADMAP.md) (posição atual), [MEMORY.md](../MEMORY.md) (decisões consolidadas), [política](../memory/README.md) e [registro de sessão](../memory/2026-09-11.md). A missão desta baseline é a fonte da atualização; não depender de memória externa da conversa.

## Produto P01 — `docs/product/`

| Tema | Documento |
| --- | --- |
| Requisitos | [product-requirements.md](product/product-requirements.md) |
| Primeiro produto | [first-product-definition.md](product/first-product-definition.md) |
| Oferta e regras comerciais | [offer-commercial-rules.md](product/offer-commercial-rules.md) |
| Jornada | [customer-journey-business-rules.md](product/customer-journey-business-rules.md) |
| Rastreabilidade | [requirements-matrix.md](product/requirements-matrix.md) |

## Arquitetura P02 — `docs/architecture/`

[system-architecture.md](architecture/system-architecture.md), [module-boundaries.md](architecture/module-boundaries.md), [integrations-architecture.md](architecture/integrations-architecture.md) e [deployment-architecture.md](architecture/deployment-architecture.md). Os [10 ADRs aceitos](decisions/README.md) formalizam decisões transversais; [segurança](security/README.md) consolida invariantes e controles.

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

P10 — Mercado Pago Integration está OWNER AUTHORIZED / NOT STARTED. A trava física da remediação P09 foi encerrada; a fase ainda deve começar pelo lifecycle próprio.

## Operações

O [índice operacional](operations/README.md) reúne procedimentos do ambiente de desenvolvimento. A [baseline da workstation e VS Code](operations/development-workstation-vscode.md) registra Profile, editor, terminal, Git/SCM, extensões, segurança, performance e recuperação sem redefinir a stack ou os ambientes canônicos da aplicação.

## HISTORICAL / SUPERSEDED DOCUMENTS

Os documentos [architecture/LES-*-R01.md](architecture/README.md), o [roadmap MVP anterior](LES-ROADMAP-DIG-R01.md) e o [guia local antigo](operations/LOCAL-CONNECTIVITY-R01.md) registram a sequência anterior. São **HISTORICAL / SUPERSEDED**: não estabelecem produto, preço, oferta, ambientes, stack ou próximos gates atuais. O [LES-FLOW-DIG-R01.md](architecture/LES-FLOW-DIG-R01.md) também é **INCOMPLETE** e termina truncado; não completar suas regras por inferência. `CURRENT CANONICAL BASELINE WINS` em toda divergência. O histórico permanece legível como evidência temporal. Os diretórios não têm placeholders vazios.
