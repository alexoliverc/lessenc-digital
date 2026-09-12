# MEMORY.md — Estado consolidado da L'Essenc Digital

**Última atualização:** 11/09/2026
**Projeto:** LES-DIG — L'Essenc Digital
**Estado documental:** P00, P01, P02 e P03 COMPLETE; P04 specification COMPLETE, physical implementation PENDING.
**Próxima fase documental:** P05 — Design System. Nenhuma implementação de nova fase está autorizada por este estado.
**Estado físico antes desta consolidação:** scaffold legado no commit `4507a27`, branch `phase/mvp-impl-01-foundation`, com `pnpm` e sem Prisma. Após o commit documental consultar `git log -1` para o HEAD efetivo.

## Decisões vigentes

- Frente inicial de geração de caixa por produtos digitais próprios em beleza e autocuidado; aquisição inicial por paid traffic. Meta comercial: 10 vendas concluídas por dia até o segundo mês, sem garantia técnica.
- Primeiro produto documental: **Cronograma Capilar Inteligente**, R$ 29,90 (`2990 BRL`), compra única, Brasil, PIX/cartão, quantidade 1 e sem conta obrigatória antes do checkout. O produto anterior e o preço R$ 39,90 pertencem ao histórico, não à oferta atual.
- Monólito modular com Presentation → Application → Domain → Infrastructure; Next.js App Router, React, TypeScript, Node.js, MySQL, Prisma, adapter Mercado Pago e transactional outbox. Ativos digitais pagos privados; browser jamais aprova pagamento; `Payment.APPROVED → Order.PAID → Entitlement.ACTIVE` coordenados; falha de email/fulfillment não desfaz pagamento.
- **CURRENT PHYSICAL SCAFFOLD:** `pnpm`/`pnpm-lock.yaml`, Next 16.3.4, React 19.3.0, Vitest 5.0.0, sem Prisma. Esse é o estado instalado verificável, não a stack P04.
- **APPROVED TARGET P04 BASELINE:** Node 24.21.0 LTS, `npm` 11.19.1, `package-lock.json`, `npm ci`, Next 16.2.11, React/React DOM 19.2.7, TS 6.0.3, Prisma 7.9.1, Vitest 4.1.11, ESLint 10.10.0, eslint-config-next 16.2.11 e Prettier 3.9.6. **DOCUMENTED / APPROVED TARGET STACK ≠ CURRENT INSTALLED SCAFFOLD STACK**: as versões aprovadas são alvos arquiteturais; as instaladas continuam evidência factual até reconciliação deliberada. A divergência é intencional e permanece sem resolução porque a implementação física P04 está pendente.
- Até a etapa física P04 explicitamente autorizada, não migrar automaticamente o gerenciador, executar `npm install` só porque npm é a meta, gerar `package-lock.json` junto ao lockfile pnpm, remover `pnpm-lock.yaml` ou atualizar dependências para igualar o documento. A reconciliação do gerenciador é uma operação própria P04; depois dela, deve restar exatamente um lockfile autoritativo.
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

## Decisões OPEN / DEFERRED

**OPEN:** provedor/tecnologia de autenticação; provedor de email; storage privado; provedor de observabilidade; provedor de rate limit distribuído em produção; framework E2E no navegador. Também domínio, política de reembolso/suporte, conteúdo final e detalhamento físico de schema/recovery dependem de decisão antes da implementação correspondente.

**DEFERRED:** migração física para npm/Prisma e versões P04 até brief, verificação de compatibilidade/security patches e autorizações específicas. A sequência `GOV/MVP-*` e os documentos `LES-*-R01` continuam como histórico; a baseline atual P00–P26 prevalece quando divergir.
