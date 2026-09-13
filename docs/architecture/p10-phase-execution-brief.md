# P10 — Mercado Pago Integration — Phase Execution Brief

**Data:** 2026-09-13. **Status da fase:** IMPLEMENTED — AWAITING CHATGPT TECHNICAL REVIEW.
**Escopo original:** P10.1 — Architecture Reconciliation + Phase Execution Brief + Physical Implementation Plan.
**Execução posterior:** o owner autorizou explicitamente a execução física completa P10 neste novo brief; código, migration local/test, testes e relatório foram produzidos sem commit, tag, push, PR, merge ou deploy.
**Branch:** `phase/p10-mercado-pago-integration`.
**Base:** `a932c05013d286bca0ac1357162c721db887a84b`.
**Plano:** [p10-implementation-plan.md](p10-implementation-plan.md).
**Evidências:** [p10-validation-report.md](p10-validation-report.md).

> As seções 1–14 abaixo registram o estado e as restrições específicas da P10.1 documental. O brief posterior do owner autoriza a execução P10 e prevalece nos pontos em que essas seções dizem “futuro”, “não iniciado” ou “não autorizado”. A implementação factual e os limites de validação constam do relatório. A revisão técnica do ChatGPT e o Final Quality Gate continuam pendentes.

## 1. Autorização, baseline e precedência

O brief do owner de 13/09/2026 autoriza exclusivamente planejamento documental nesta sessão. Diretório, `main` local, `origin/main`, HEAD remoto consultado e working tree limpa foram conferidos antes da criação da branch. P09 A01–A06 está integrada; checkpoint `53bdaafc0f740241807a498b0a64378bab25c683`, merge `c78ae181be209ff8c91e996e785b42fb77f6edb2` e closeout em `a932c05`.

Aplicar [AGENTS.md](../../AGENTS.md), [MEMORY.md](../../MEMORY.md), [ROADMAP.md](../../ROADMAP.md) e [índice](../README.md). Decisão explícita mais recente do owner prevalece: **CURRENT CANONICAL BASELINE WINS**. Restrições antigas de P10 nos documentos da execução P09 não cancelam a autorização atual. `LES-*-R01` é histórico quando divergir.

Stop Conditions identificadas são devolvidas para revisão; documentar uma proposta não fecha o gate nem autoriza migrations, dependências, operações financeiras ou mudança de domínio. A exigência específica de alterar somente os documentos permitidos prevalece sobre a atualização habitual de memória: `MEMORY.md`, `ROADMAP.md` e diários permanecem intactos nesta sessão.

## 2. Objetivo e critérios de comportamento

Planejar uma tentativa financeira local antes de qualquer chamada externa; criar/consultar uma order Mercado Pago por adapter; autenticar notificações; aplicar somente fatos financeiros verificados através do domínio P07; persistir Payment, Order e efeitos internos atomicamente. Nenhum retorno de browser constitui aprovação.

Alvo de produto: Checkout Transparente com PIX e cartão de crédito em **uma parcela**, `processing_mode=automatic`. Valor e BRL vêm do pedido persistido. Identidade própria de Payment precede o provedor.

## 3. Escopo e fora de escopo

Nesta P10.1: reconciliar contratos atuais, limites físicos e documentação externa; propor persistência mínima; especificar concorrência, testes, etapas físicas e gates. Os artefatos distinguem decisões já tomadas, recomendações e questões abertas.

Alvo futuro da P10, condicionado à autorização: `PaymentProvider`, `MercadoPagoAdapter`, criação local idempotente, PIX/cartão, verificação de webhook, normalização, reconciliação interna chamável/testável, transação financeira e outbox deduplicada.

Fora do escopo: código nesta sessão; débito, boleto, recorrência, cartão salvo, parcelamento adicional, checkout Pro, chamadas de criação/cancelamento/reembolso reais, cron/scheduler novo, deploy, autenticação administrativa, observabilidade como serviço, Entitlement, ebook e qualquer execução P11+. A observação de reembolso integral será planejada; iniciar um reembolso no provedor não está incluído.

## 4. API, contratos e fronteiras

Decisão do owner: Orders API, `POST /v1/orders` e `GET /v1/orders/{id}`. A busca `GET /v1/orders` por `external_reference` é uma proposta de recuperação documentada no plano. `/v1/payments` não comandará código novo.

`Presentation → Application → Domain`, com portas de aplicação implementadas na Infrastructure. `PaymentProvider → MercadoPagoAdapter` recebe entradas internas e devolve observações normalizadas. Tipos, estados, SDK e JSON Mercado Pago ficam no adapter. Prisma fica na Infrastructure; fatos P07 jamais são DTOs públicos.

Reutilizar `ApplyPaymentTransition`, `ApplyOrderTransition`, `Money`, `Clock` e as regras de snapshots existentes. O plano não altera as máquinas P07. O código atual contém apenas transições puras em Payments; não contém integração financeira, PaymentProvider, PaymentEvent ou writer coordenado de pagamentos.

## 5. Cartão, PIX, configuração e privacidade

- Cartão: tokenização no browser por MercadoPago.js/Card Payment Brick. PAN, CVV e validade nunca atravessam o backend L'Essenc. Backend recebe somente token e metadados estritamente necessários, validados por allowlist. Token é transitório, não é persistido, logado ou colocado em outbox.
- PIX: criação server-side com amount/total derivados de Order. Resposta pública limitada a estado seguro, QR code, copia e cola e/ou instrução validada. Não persistir resposta integral ou URL de ticket como log.
- Credenciais existentes por nome: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`. Propor `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` somente como configuração pública do frontend. Não abrir `.env`, ler valores reais, gerar segredos ou mudar `.env.example` nesta sessão.
- Preferência: `fetch` nativo + `node:crypto` no backend; script oficial remoto no frontend. A comparação com SDK e os custos de manutenção estão no plano. Nenhuma dependência será instalada.
- Logs: códigos fechados, IDs internos/correlation IDs e duração; sem credenciais, CardToken, cartão, email cru ou payload integral. Exceções HTTP/Prisma não são serializadas para o público.

## 6. Identidades e idempotência

`external_reference = Order.id`. `Payment.id` continua interno; `providerOrderId` e `providerPaymentId` identificam recursos externos distintos. Proposta: UUID local de Payment como `X-Idempotency-Key`, estável em toda repetição da mesma operação.

Comparar a identidade imutável da tentativa antes de reutilizar a chave. Troca de valor, moeda, método, token ou operação não vira retry equivalente. Timeout, resposta perdida e HTTP ambíguo exigem recuperação com a identidade original; nunca gerar outra chave automaticamente.

Detalhes de reservas locais, fingerprint, restrições únicas, envio exclusivo e recuperação constam no plano. Nova tentativa financeira após recusa definitiva precisa de regra explícita; múltiplas cobranças simultâneas do mesmo pedido são proibidas.

## 7. Webhook e reconciliação

Planejar `POST /api/webhooks/mercadopago`, runtime Node, tópico `order`. Validar estrutura, `x-signature`, `x-request-id`, `data.id` e assinatura com `MERCADOPAGO_WEBHOOK_SECRET`. Rejeitar ausência/inconsistência antes de consulta financeira.

Após autenticar: consultar `GET /v1/orders/{data.id}` e verificar identidade externa/interna, ambiente/conta, valores, moeda e cardinalidade. Normalizar somente o recurso consultado. Body da notificação serve à correlação, não prova saldo ou aprovação.

Webhook, resposta síncrona e reconciliação convergem no mesmo aplicador transacional. Reconciliação com providerOrderId consulta diretamente; sem esse ID, tenta busca controlada por external_reference, valida resultados e deixa casos ambíguos para revisão. Não há scheduler implícito.

## 8. Persistência, concorrência e outbox

O [delta conceitual](p10-implementation-plan.md#proposed-schema-delta--not-yet-applied) propõe campos neutros de identidade/controle em Payment e um journal PaymentEvent para observações externas mínimas. Nada foi aplicado; schema/migration é gate aberto.

Dois limites transacionais: reservar/obter Payment e encerrar a transação; chamar provider; abrir nova transação para reler, bloquear, aplicar fatos P07, gravar observação e outbox, e confirmar. **Nunca manter MySQL aberto durante chamada de rede.**

Cobrir: criação simultânea, timeout, resposta perdida, mesma chave/operação, chave/operação incompatível, notificações duplicadas/fora de ordem, webhook × reconciliação e reconciliação × resposta síncrona. Locks e constraints físicos devem ser provados em MySQL, não apenas em mocks.

OutboxEvent permanece um evento/efeito interno; não substitui PaymentEvent. Propor `ORDER_PAID` deduplicado para sinalizar aprovação consistente à fase posterior, sem ativar Entitlement. Há conflito explícito com ADR-0005, registrado como SC-01; o acordo inter-fases precisa de revisão.

## 9. Estados e checkout

Estados internos preservados: Payment `PENDING/APPROVED/REJECTED/CANCELED/REFUNDED/UNKNOWN`; Order `PENDING/PAID/FAILED/CANCELED/REFUNDED`. A [matriz](p10-implementation-plan.md#provider-status-normalization-matrix) separa normalização de aplicação: um alvo externo conhecido não torna válida uma transição proibida.

`UNKNOWN` e timeout não significam rejeição. Partial refund, chargeback, combinações desconhecidas e transições incompatíveis ficam em revisão, sem mapeamento silencioso ou concessão de acesso. Expiração também demanda decisão semântica; não acrescentar estado ao domínio.

P09 entrega Order.PENDING e estado público, sem autorização financeira. Preservar A01/A02, `PRICE_CHANGED`, proteção contra oferta stale/unavailable, token v2 HMAC estrito sem confidencialidade/autorização e validação de email. Planejar jornada `pedido criado → continuidade financeira autorizada → PIX/cartão → estado seguro → confirmação server-side`. O desenho dessa autorização está aberto; não promover o token P09 a credencial.

## 10. Stop Conditions

Consultar [Open Stop Conditions requiring ChatGPT review](p10-implementation-plan.md#open-stop-conditions-requiring-chatgpt-review). Suspender a etapa dependente e reportar caso seja necessário:

- alterar estados/semântica P07, representar chargeback ou partial refund;
- alterar schema/migration, adicionar npm dependency ou configuração/segredo além do previsto;
- alterar semântica do token P09 ou usar continuidade como autorização sem desenho aprovado;
- resolver divergência canônica, incluindo ADR-0005 versus separação P10/P11;
- expor cartão, fazer chamada financeira real, modificar P11+ ou adotar scheduler;
- assumir garantias de replay, moeda, conta ou identificação que o contrato consultado não comprove.

Esses pontos não foram resolvidos por implementação. As seções propostas são material de revisão, não autorização para superá-los.

## 11. Testes exigidos para implementação futura

Unitários: matriz completa de estados e desconhecidos, fatos permitidos/proibidos, idempotency derivation, request composition, fingerprint incompatível, assinatura válida/inválida/malformada/replay, dados repetidos/inconsistentes, amount/currency/external_reference/provider identity mismatch, timeout/UNKNOWN e duplicate notification. Fixtures controladas de HTTP sem credenciais reais.

MySQL isolado: Payment local, duas requisições concorrentes, retry idempotente, rollback, aplicação Payment + Order + Outbox atomicamente, deduplicação, ordens de chegada invertidas, webhook × reconciliação × resposta síncrona e preservação dos testes P09. Nenhum Entitlement criado.

Provedor: mocks/controlador HTTP por padrão. Testes externos de ambiente TEST exigem autorização posterior, isolamento comprovado e credenciais adequadas à Orders API; nenhuma chamada financeira de produção. Browser testing financeiro também fica para a autorização de implementação.

## 12. Acceptance criteria e lifecycle

P10.1 aceita quando: baseline conferida; apenas documentos permitidos alterados; contratos e delta revisáveis; matriz sem coerção de estados; concorrência e recuperação especificadas; gaps identificados; referências oficiais datadas; Prettier dirigido, format check e diff check aprovados; todos os arquivos protegidos intactos.

Futura P10 exige adicionalmente testes da seção 11, nenhuma cobrança duplicada, origem financeira verificada, logs sanitizados, regressões P09 preservadas e revisão técnica favorável. Aprovação deste plano não declara a integração concluída.

Lifecycle: P10.1 documentos → ChatGPT P10 Plan Review → decisões dos gates → nova autorização específica do owner → execução numerada do plano → Validation Report → ChatGPT Technical Review → correções autorizadas → Final Quality Gate → operações Git apenas quando autorizadas → closeout. Não há progressão automática.

## 13. Arquivos permitidos e protegidos nesta sessão

Criar somente `docs/architecture/p10-phase-execution-brief.md` e `docs/architecture/p10-implementation-plan.md`. Atualizar `docs/README.md` somente para indexação e formatação exigida.

Proteger todos os demais arquivos, especialmente `src/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `prisma.config.ts`, `package.json`, `package-lock.json`, `.env.example`, arquivos de credenciais, `MEMORY.md`, `ROADMAP.md`, diários e ADRs. Sem commit, tag, push, PR, merge ou rebase.

## 14. Fontes materiais lidas

Preflight: AGENTS, MEMORY, diário de 13/09/2026, ROADMAP, docs/README e política de memória. Base física: schema/config Prisma, `.env.example`, package.json; módulos Payments/Commerce, repository/client/integrações de banco, checkout, token HMAC e configuração em `src/lib/config`.

Baseline arquitetural: ADR-0004, ADR-0005, integrations-architecture, payment-state-machine, data-integrity-concurrency-review, system-architecture, security-architecture, application-security-baseline; brief/implementação/Validation Report P07; brief/plano/Validation Report P09. LES-INT-MP-R01 foi consultado como histórico. Fontes externas oficiais e incertezas verificadas estão junto das decisões no plano.
