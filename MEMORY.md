# MEMORY.md — Estado consolidado da L'Essenc Digital

**Última atualização:** 12/09/2026
**Projeto:** LES-DIG — L'Essenc Digital
**Estado documental:** P00, P01, P02, P03 e P04 COMPLETE. P05 — Design System & UX Foundation é a próxima fase candidata e ainda NÃO está autorizada.
**Próxima fase:** P05 — Design System, ainda não iniciada nem autorizada.
**Checkpoint anterior à P04 física:** `71488f1`, tag `checkpoint/p04-baseline-reconciled`, com `pnpm` e sem Prisma.

## Decisões vigentes

- Frente inicial de geração de caixa por produtos digitais próprios em beleza e autocuidado; aquisição inicial por paid traffic. Meta comercial: 10 vendas concluídas por dia até o segundo mês, sem garantia técnica.
- Primeiro produto documental: **Cronograma Capilar Inteligente**, R$ 29,90 (`2990 BRL`), compra única, Brasil, PIX/cartão, quantidade 1 e sem conta obrigatória antes do checkout. O produto anterior e o preço R$ 39,90 pertencem ao histórico, não à oferta atual.
- Monólito modular com Presentation → Application → Domain → Infrastructure; Next.js App Router, React, TypeScript, Node.js, MySQL, Prisma, adapter Mercado Pago e transactional outbox. Ativos digitais pagos privados; browser jamais aprova pagamento; `Payment.APPROVED → Order.PAID → Entitlement.ACTIVE` coordenados; falha de email/fulfillment não desfaz pagamento.
- **SCAFFOLD ANTERIOR À P04 FÍSICA:** `pnpm`/`pnpm-lock.yaml`, Next 16.3.4, React 19.3.0, Vitest 5.0.0, sem Prisma. Preservado no checkpoint acima; não descreve automaticamente a árvore de trabalho atual.
- **APPROVED TARGET P04 BASELINE:** Node 24.21.0 LTS, `npm` 11.19.1, `package-lock.json`, `npm ci`, Next 16.3.4, React/React DOM 19.3.0, TS 6.0.3, Vitest 5.0.0, ESLint 10.10.0, Prettier 3.9.6 e as dependências de suporte existentes nas versões físicas revalidadas. Prisma/MySQL/schema/migrations pertencem à P06. A meta foi corrigida pelo brief mais recente do owner, sem downgrade de framework ou testes.
- **ESTADO FÍSICO ATUAL, NÃO COMITADO:** branch `phase/p04-physical-reconciliation` reconciliada para Node.js 24.21.0 LTS, npm 11.19.1, `packageManager: npm@11.19.1`, `package-lock.json`, `npm ci` e `APP_ENV`; gates técnicos e smoke test finais PASS.
- O brief do owner de 12/09/2026 autorizou a execução física, mas não commit, tag, push ou merge. O host continua em Node 24.19.0/npm 11.17.0, sem gerenciador local de versões estabelecido; não declarar conformidade com Node 24.21.0/npm 11.19.1. Atualização global não foi improvisada.
- Ambientes aprovados na nova baseline: LOCAL, TEST, STAGING e PRODUCTION com `APP_ENV` separado de `NODE_ENV`, sem afirmar que tenham sido provisionados.
- Governança, arquitetura e P03 estão documentadas; nenhuma migration, integração financeira, auth, storage privado ou deploy foi implementado nesta consolidação.
- O modelo ChatGPT → Codex → ChatGPT review está adotado: ChatGPT responde pela direção técnica, planejamento e revisão; Codex executa somente o escopo autorizado no repositório.
- Cada execução requer Phase Execution Brief, branch, autorização de operações protegidas por `AGENTS.md`, validação e retorno ao ChatGPT antes da progressão. Repositório é a memória técnica oficial; ler os arquivos na ordem definida em AGENTS.md.
- O projeto principal de cosméticos físicos continua separado e será retomado com a formação de caixa.

## Onde encontrar as decisões

- [ROADMAP.md](ROADMAP.md): fases P00–P26 e próximo passo P05.
- [docs/README.md](docs/README.md): índice P00–P04, segurança, operações, ADRs e histórico anterior.
- [Produto P01](docs/product/first-product-definition.md), [modelo P03](docs/architecture/domain-model.md), [stack P04](docs/architecture/runtime-toolchain-baseline.md) e [P04 exit review](docs/architecture/p04-exit-review.md).
- [Registro 11/09/2026](memory/2026-09-11.md): scaffold anterior, conflitos reconciliados, validações e histórico.
- [Registro 12/09/2026](memory/2026-09-12.md): execução física P04, gates, desvios e pendência de revisão.

## Decisões OPEN / DEFERRED

**OPEN:** provedor/tecnologia de autenticação; provedor de email; storage privado; provedor de observabilidade; provedor de rate limit distribuído em produção; framework E2E no navegador. Também domínio, política de reembolso/suporte, conteúdo final e detalhamento físico de schema/recovery dependem de decisão antes da implementação correspondente.

**DEFERRED:** Prisma/MySQL/schema/migrations para P06; P05 até seu brief e autorização; atualização do host para Node 24.21.0/npm 11.19.1 até mecanismo autorizado e validado. A sequência `GOV/MVP-*` e os documentos `LES-*-R01` continuam como histórico; a baseline atual P00–P26 prevalece quando divergir.
