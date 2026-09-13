# MEMORY.md — Estado consolidado da L'Essenc Digital

**Última atualização:** 12/09/2026
**Projeto:** LES-DIG — L'Essenc Digital
**Estado documental:** P00–P08 COMPLETE. Gate A — FOUNDATION READY PASS. P08 — Public Sales Experience recebeu ChatGPT Technical Review PASS e Final Quality Gate PASS.
**Estado atual:** P08 — Public Sales Experience COMPLETE. Checkpoint `f73400a` preservado pela tag `checkpoint/p08-public-sales-experience-complete` e PR #8 integrada em `main` pelo merge `2686e39`. P09 — Checkout & Order Creation permanece NOT STARTED e depende de autorização explícita. Próximo gate formal: Gate B após P11.
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
- Governança e arquitetura estão documentadas; schema/migrations foram implementados na P06. Integração financeira, auth, storage privado e deploy continuam adiados.
- O modelo ChatGPT → Codex → ChatGPT review está adotado: ChatGPT responde pela direção técnica, planejamento e revisão; Codex executa somente o escopo autorizado no repositório.
- Cada execução requer Phase Execution Brief, branch, autorização de operações protegidas por `AGENTS.md`, validação e retorno ao ChatGPT antes da progressão. Repositório é a memória técnica oficial; ler os arquivos na ordem definida em AGENTS.md.
- O projeto principal de cosméticos físicos continua separado e será retomado com a formação de caixa.

## Onde encontrar as decisões

- [ROADMAP.md](ROADMAP.md): fases P00–P20, P08 encerrada e P09 como próxima candidata.
- [docs/README.md](docs/README.md): índice P00–P08, segurança, operações, ADRs e histórico anterior.
- [Persistência P06](docs/persistence/README.md): schema físico, isolamento local, migrações e testes.
- [Produto P01](docs/product/first-product-definition.md), [modelo P03](docs/architecture/domain-model.md), [stack P04](docs/architecture/runtime-toolchain-baseline.md) e [P04 exit review](docs/architecture/p04-exit-review.md).
- [Registro 11/09/2026](memory/2026-09-11.md): scaffold anterior, conflitos reconciliados, validações e histórico.
- [Registro 12/09/2026](memory/2026-09-12.md): reconciliação P04, fechamento P05 e execução P06.

## Decisões OPEN / DEFERRED

**OPEN:** provedor/tecnologia de autenticação; provedor de email; storage privado; provedor de observabilidade; provedor de rate limit distribuído em produção; framework E2E no navegador. Também domínio, política de reembolso/suporte, conteúdo final e detalhamento físico de schema/recovery dependem de decisão antes da implementação correspondente.

**DEFERRED:** fluxos P09+, coordenação financeira persistida/eventos P10, entrega P11, autenticação P12, analytics P13 e ambientes de produção até os respectivos gates. A sequência `GOV/MVP-*` e os documentos `LES-*-R01` continuam como histórico; a baseline atual P00–P20 prevalece quando divergir.

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
- P09 — Checkout & Order Creation permanece NOT STARTED e exige autorização explícita antes de planejamento ou execução.
