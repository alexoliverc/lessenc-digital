# P07 — Núcleo de domínio e aplicação

**Estado:** ChatGPT Technical Re-Review PASS e Final Quality Gate PASS; aguarda checkpoint/integração Git e P07 ainda não está COMPLETE.
**Base:** `e04438c1e09950d34a48051df6cc3219c580aad7`.

## Estrutura e contratos

| Local | Responsabilidade |
| --- | --- |
| `src/shared/` | Money/Currency, Clock/SystemClock, Result, ApplicationError e assertNever |
| `src/modules/catalog/domain/catalog.ts` | Product, Offer e elegibilidade |
| `src/modules/catalog/application/resolve-purchasable-offer.ts` | CatalogRepository e ResolvePurchasableOffer |
| `src/modules/commerce/domain/` | Order/OrderItem, snapshots, totais e transições |
| `src/modules/commerce/application/` | PrepareOrder e ApplyOrderTransition |
| `src/modules/payments/domain/payment.ts` | Payment, fatos internos e transições |
| `src/modules/payments/application/` | ApplyPaymentTransition |
| `src/modules/entitlements/domain/` | Entitlement, duplicidade local, ativação e revogação |
| `src/modules/entitlements/application/` | ApplyEntitlementTransition |
| `src/infrastructure/database/prisma-catalog-repository.ts` | Adapter de leitura do CatalogRepository |

Os contratos públicos entre módulos são os tipos e operações exportados nesses arquivos, sem Prisma. O lint restringe React, Next, Prisma, código gerado, Infrastructure, Mercado Pago, Node e APIs HTTP/browser em Domain/Application/shared. O adapter recebe o client por injeção; nenhum ponto público o instancia nesta fase.

`CatalogRepository.findOffer(offerId)` retorna Product/Offer do domínio ou ausência. O adapter mapeia quatro estados explicitamente, converte preço/moeda para Money e preserva descrição nullable. Usa transação de leitura `RepeatableRead` para consistência entre consultas de produto e oferta. Essa leitura não reserva preço nem bloqueia alterações posteriores.

## Invariantes

- Money aceita inteiros não negativos em BRL; rejeita NaN, Infinity, frações, moeda não suportada e overflow. O limite técnico de `4_294_967_295` minor units corresponde ao `INTEGER UNSIGNED` P06, sem nova política comercial. Igualdade inclui moeda; soma/multiplicação verificam limites.
- Nova compra exige Product ACTIVE, Offer ativa, associação correta e quantidade 1. Preço inicial: `2990 BRL`. O núcleo consulta a oferta atual do servidor, sem fixar esse preço para toda compra futura. Nenhuma oferta foi publicada.
- PrepareOrder recebe IDs internos e quantidade, sem preço/total. Preserva produto, oferta, nome, descrição nullable, preço, quantidade, total e moeda. Soma itens e valida total. O caso de uso inicial produz um item; a soma genérica não publica carrinho multiproduto.
- Money, itens e coleção preparados são imutáveis. Timestamps são strings ISO UTC, evitando mutação por Date.setTime; conversão para Date na persistência futura cabe ao adapter. Clock é injetado e consultado uma vez por preparação/transição efetiva; repetições preservam timestamps.
- Order permite PENDING→PAID/FAILED/CANCELED e PAID→REFUNDED, além de repetição validada. Payment permite o grafo canônico; UNKNOWN é distinto de REJECTED. Downgrade atrasado retorna erro tipado e preserva o objeto original.
- Entitlement nasce PENDING e rejeita duplicidade conhecida por item/ID. PENDING→ACTIVE exige pedido PAID, pagamento APPROVED, valores/associações compatíveis, item do pedido e timestamps financeiros. ACTIVE→REVOKED exige pedido/pagamento REFUNDED e confirmação integral compatível. Repetições são idempotentes. Não há expiração automática, reemissão ou reativação.

## Autoridade e transações

Fatos financeiros e decisões internas confirmadas são **contratos internos confiáveis, não DTOs HTTP**. Uma string ou tipo TypeScript não autentica origem. A camada financeira futura deverá construí-los após validação server-side e consulta autoritativa. `hasApprovedPayment` exige avaliação confiável dentro da futura transação; não pode vir do browser ou de leitura anterior à disputa concorrente.

As três operações ApplyTransition calculam representações candidatas em memória. **Não persistem aprovação, pedido pago ou acesso, nem concedem download.** A coordenação financeira opcional da seção 9 não foi implementada. P10/P11 deverão reler registros autoritativos, controlar concorrência e aplicar o domínio numa única transação MySQL com OutboxEvent, conforme ADR-0005. Chamadas isoladas não satisfazem esse requisito.

Não há repository de escrita, Unit of Work vazio ou alegação de segurança concorrente por doubles. Constraints P06 permanecem: Entitlement.orderItemId UNIQUE, OutboxEvent.deduplicationKey UNIQUE e Customer.email não globalmente UNIQUE. Leitura de catálogo não produz outbox. Alterações entre preparação e gravação devem ser revalidadas pelo futuro fluxo P09.

## Mapeamento para P06

| Domínio | Tabelas | Implementação P07 |
| --- | --- | --- |
| Product/Offer | products / offers | Leitura, enum explícito, Money e descrição nullable |
| Order/OrderItem | orders / order_items | Representações/invariantes; sem escrita |
| Payment | payments | Estados/fatos sem provedor; sem escrita |
| Entitlement | entitlements | Invariantes puras; unicidade física preservada |
| Customer | customers | Referência por ID; sem nova identidade ou regra de email |
| OutboxEvent | outbox_events | P06 preservada; sem nova coordenação financeira/worker |

Schema, migrations, client P06, dependências e overrides não mudaram. Nenhum tipo gerado foi editado manualmente.

## Erros, evidências e adiamentos

ApplicationError usa código estável, mensagem fixa e contexto fechado (`business-rule` ou `catalog-read`), sem payload arbitrário, SQL, dados pessoais ou causas brutas. Result captura somente ApplicationError. Defeitos/estados inesperados continuam exceções explícitas. O adapter traduz erros Prisma conhecidos/de inicialização e registra apenas o evento fixo `catalog.read.failed`/`PERSISTENCE_UNAVAILABLE`. O futuro boundary HTTP deverá tratar defeitos sem expor stack.

Testes unitários ficam junto aos módulos e em `src/shared/primitives.test.ts`; fixtures determinísticas em `src/test-support/p07-fixtures.ts`. `catalog.integration.ts` executa o guard P06 mesmo com Vitest direto; usa TEST_DATABASE_URL na porta 3307 e bancos de teste permitidos. Fixtures têm UUIDs próprios e cleanup por ID confirmado.

Resultados: [Validation Report P07](p07-validation-report.md). Adiados: checkout/persistência P09, confirmação financeira/concorrência/outbox P10, políticas de entitlement OPEN/entrega P11, identidade Customers, Fulfillment, notifications e provedores. Não há módulos vazios ou contratos especulativos desses fluxos.

## Correções da Technical Review

A revisão técnica inicial recebeu **PASS WITH FIXES**. Os dois findings foram corrigidos antes do Final Quality Gate.

- `Order` valida coerência entre status e `paidAt` antes de qualquer repetição idempotente. `PAID`/`REFUNDED` exigem instante UTC válido; `PENDING`/`FAILED`/`CANCELED` não podem carregar `paidAt`.
- `Payment` valida coerência entre status e `approvedAt`. `APPROVED`/`REFUNDED` exigem instante UTC válido; os demais estados não podem carregar `approvedAt`.
- `Entitlement` valida snapshots PENDING, ACTIVE e REVOKED contra `activatedAt`/`revokedAt`; política temporal de EXPIRED permanece OPEN.
- O boundary Prisma deixou de classificar qualquer `PrismaClientKnownRequestError` como indisponibilidade. `P2024` é tratado explicitamente; outros códigos conhecidos não classificados são propagados sem mascaramento. Logs permanecem livres de mensagem bruta, query, URL e credenciais.
- Testes de regressão foram adicionados para os snapshots temporalmente inconsistentes e para a classificação do boundary Prisma.

Resultado final: **ChatGPT Technical Re-Review PASS / Final Quality Gate PASS**.
