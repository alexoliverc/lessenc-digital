# Índice oficial da baseline documental LES-DIG P00–P05

**Estado:** documentação e implementação P00–P05 COMPLETE. Gate A — FOUNDATION READY PASS. P06 ainda não foi iniciada.

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

Os links das seções P00–P05, [segurança](security/README.md), [operações](operations/README.md) e [ADRs aceitos](decisions/README.md) constituem o índice canônico atual. Documentar um alvo não significa que foi instalado.

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

O [índice P05](design-system/README.md) liga [tokens](design-system/design-tokens.md), [componentes](design-system/component-foundation.md), [responsividade e acessibilidade](design-system/responsive-accessibility.md) e [exit review](design-system/p05-exit-review.md). A validação local passou; a revisão técnica está pendente e Gate A não foi avaliado.


## Persistência P06 — planejamento

O [bootstrap Prisma/MySQL](architecture/prisma-database-bootstrap.md) preserva o planejamento arquitetural necessário para a futura **P06 — Data & Persistence Foundation**. Prisma, MySQL, schema, migrations e persistência não fazem parte da execução física da P04 e deverão ser revalidados no Phase Execution Brief da P06 antes de qualquer implementação.
## Operações

O [índice operacional](operations/README.md) reúne procedimentos do ambiente de desenvolvimento. A [baseline da workstation e VS Code](operations/development-workstation-vscode.md) registra Profile, editor, terminal, Git/SCM, extensões, segurança, performance e recuperação sem redefinir a stack ou os ambientes canônicos da aplicação.

## HISTORICAL / SUPERSEDED DOCUMENTS

Os documentos [architecture/LES-*-R01.md](architecture/README.md), o [roadmap MVP anterior](LES-ROADMAP-DIG-R01.md) e o [guia local antigo](operations/LOCAL-CONNECTIVITY-R01.md) registram a sequência anterior. São **HISTORICAL / SUPERSEDED**: não estabelecem produto, preço, oferta, ambientes, stack ou próximos gates atuais. O [LES-FLOW-DIG-R01.md](architecture/LES-FLOW-DIG-R01.md) também é **INCOMPLETE** e termina truncado; não completar suas regras por inferência. `CURRENT CANONICAL BASELINE WINS` em toda divergência. O histórico permanece legível como evidência temporal. Os diretórios não têm placeholders vazios.
