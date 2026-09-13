# P10 — Mercado Pago Integration — Codex Validation Report

**Data:** 2026-09-13. **Estado:** TECHNICAL REVIEW PASS — READY FOR GIT INTEGRATION; remediação pós-auditoria A01–A05 e Final Quality Gate R2 aprovados. Operações Git protegidas ainda não executadas.
**Branch:** `phase/p10-mercado-pago-integration`. **HEAD/base:** `a932c05013d286bca0ac1357162c721db887a84b`.
**Escopo:** fronteira financeira P09 Order.PENDING → continuação P10 → tentativa Payment → Orders API → observações verificadas → Payment/Order/PaymentEvent/OutboxEvent. Nenhum Entitlement ou entrega.

## Resultado físico e limites

| Área | Implementação/evidência |
| --- | --- |
| Persistência | `prisma/schema.prisma` acrescenta identidade de provedor, número/fingerprint de tentativa, marcador único de tentativa ativa, revisão e timestamps a Payment; novo PaymentEvent de journal mínimo com chave de deduplicação única. Migration aditiva `20260913_p10_mercado_pago_financial` mantém linhas legadas válidas. |
| Identidade/idempotência | Payment.id UUID gerado e gravado antes do POST, usado como `X-Idempotency-Key`; `external_reference=Order.id`. O fingerprint imutável inclui método, valor, moeda, parcela e IDs. Lock `orders FOR UPDATE`, índice único `active_attempt_key` e `@@unique([orderId,attemptNumber])` serializam a reserva. POST incerto nunca é repetido automaticamente nem libera a tentativa. |
| Provider | `PaymentProvider` neutro na Application; `MercadoPagoAdapter` em Infrastructure usa `fetch` do Node, host fixo, limite de tempo/corpo, GET com um retry controlado e Search paginada. Não há SDK backend ou nova dependência npm. |
| PIX/cartão/3DS | Valor e BRL vêm do Order persistido. PIX é criado no servidor; QR/copia e cola são apresentados somente ao portador da capability. Card Payment Brick oficial tokeniza no browser, crédito em uma parcela; backend recebe token efêmero por allowlist e não o grava. Challenge HTTPS em iframe não confirma pagamento: mensagem/polling apenas solicitam GET no servidor. |
| Continuação P09→P10 | Token P10 HMAC-SHA-256 independente do token P09, finalidade fixa, Order.id e TTL 24h; cookie `HttpOnly`, `SameSite=Lax`, `Path=/checkout`, `Secure` fora de local. A emissão para `EXISTING` exige capability P10 válida já vinculada ao mesmo pedido. POSTs de início/estado exigem Origin igual a APP_URL. Token não vai em URL. |
| Webhook | `POST /api/webhooks/mercadopago` valida parâmetros únicos, assinatura HMAC em tempo constante, `x-request-id`, timestamp de segundos/milissegundos dentro de ±300s, corpo limitado e envelope coerente; só então consulta GET. Body não é prova financeira. Falha de consulta/aplicação devolve 503 para retry. |
| Aplicação | Resposta síncrona, webhook e reconciliação usam o mesmo writer MySQL; observação, Payment, Order e outbox compartilham transação. Não há chamada de rede dentro da transação. `PAYMENT_APPROVED` ou `REFUND_COMPLETED` são persistidos uma vez na outbox; não existe consumidor P11. |
| Normalização | `processed/accredited` aprovado; processing/action_required pendente; falha conhecida rejeitada; canceled/expired encerra tentativa sem cancelar Order; full refund exige valor integral comprovado e estado anterior válido. Partial refund, chargeback, estado desconhecido, identidade/valor/moeda/método incompatíveis e transição P07 inválida vão a REVIEW; `UNKNOWN` mantém tentativa ativa. |

## Verificações executadas

| Comando/ação | Resultado |
| --- | --- |
| `prisma format`, `prisma validate`, `prisma generate` | PASS durante desenvolvimento; schema e client P10 consistentes. |
| Guard P06 + `prisma migrate deploy` para `lessenc_dev`, `lessenc_test` e `lessenc_test_rebuild` | PASS; migration P10 aplicada após a baseline P06 em bancos isolados. Nenhum banco fora da allowlist foi usado. |
| Rebuild descartável `lessenc_test_rebuild`: guard `fresh-deploy`, recriação do schema local, `npm run db:migrate:deploy:fresh` e `npx vitest run --config vitest.integration.config.mjs src/infrastructure/database/payment.integration.ts` | PASS após consentimento explícito do owner: as 3 migrations foram aplicadas desde zero e os 12 testes P10 passaram no banco reconstruído. |
| `npm run db:status` com guards P06 em `lessenc_dev` e `lessenc_test` | PASS: 3 migrations encontradas; os dois schemas estão atualizados. |
| `npx vitest run src/infrastructure/payments/mercado-pago.test.ts` | PASS, 31 testes dirigidos após a remediação pós-auditoria, incluindo POST incompleto → GET canônico e preservação de providerOrderId em ambiguidade. |
| `npx vitest run src/app/api/webhooks/mercadopago/route.test.ts` | PASS, 3 testes dirigidos da fronteira HTTP. |
| `npm run check` | PASS: lint sem warnings, typecheck, 243 testes unitários em 15 arquivos e Prettier. |
| `npm run test:integration`, `APP_ENV=test` e guard P06 | PASS: 38 testes em 4 arquivos, incluindo 19 testes financeiros P10 e regressões P09. |
| `npm audit --audit-level=high` | PASS, zero vulnerabilidades. |
| `npm run build` com `APP_ENV=local` | PASS: build otimizado, TypeScript e rotas dinâmicas de checkout/payment e webhook. |
| `git diff --check` | PASS, sem whitespace inválido no diff tracked. |
| Varredura `rg -l` por formatos usuais de credenciais no repositório e nomes dos três segredos P10 em `.next/static` | Nenhum arquivo correspondente. `.env` real não foi lido. |
| Encerramento do ambiente | Container `lessenc-p06-mysql` devolvido ao estado parado; sem listener temporário nas portas 3000/3307. |

### Critérios adversariais comprovados

Os testes de infraestrutura exercitam PIX/card/3DS, centavos e decimal, timeout, JSON inválido, GET e Search paginada, assinatura/replay, estado desconhecido, moeda e identidades incompletas. Em MySQL foram exercitados reserva concorrente, uma tentativa ativa, retry sem novo Payment, rejeição segura, UNKNOWN bloqueante, deduplicação de observação/outbox, aprovação e refund atômicos, partial refund e chargeback em revisão, expiração sem Order.CANCELED, corrida webhook/reconciliação, recuperação por busca e rollback quando a outbox falha. A suíte completa de integração inclui a regressão P09 A01–A06.

## Limites de ambiente e revisão

- **Mercado Pago TEST real:** NOT EXECUTED — TEST CREDENTIAL/ENVIRONMENT DEPENDENT. Nenhuma credencial real foi inspecionada e nenhum pagamento ou chamada financeira real foi feito. As respostas do provedor foram simuladas em HTTP controlado. A compatibilidade exata com conta TEST e callbacks reais precisa de rodada própria antes de staging.
- **Browser/runtime local:** NOT EXECUTED. A revisão automática do ambiente rejeitou duas tentativas de iniciar o servidor local com fixtures efêmeras como “blocked by policy”. Não houve servidor ou Chrome P10 iniciado; build e testes de rota não substituem avaliação visual, teclado/foco e carregamento real do Brick.
- **Rebuild do zero:** a primeira tentativa `npx prisma migrate reset --force` foi recusada pelo Prisma CLI até consentimento explícito. Após o consentimento, o comando atingiu o alvo correto mas falhou com `P3016`, pois `lessenc_test` não podia apagar `_prisma_migrations`; recriei exclusivamente o schema local `lessenc_test_rebuild` com a conta administrativa do container, concedi privilégios nesse schema ao usuário de teste e usei o script guardado `db:migrate:deploy:fresh`. As três migrations e 12 testes P10 passaram. Nenhum outro schema foi apagado.
- **Operação:** reconciliação é chamável pelos fluxos públicos e webhook; não há scheduler P15. Timeout/ambiguidade sem correspondência única permanecem bloqueados para revisão manual. Notificação sem associação local retorna 503 para retry; a P10 não cria backoffice.
- **Conta/moeda:** o token de acesso delimita a conta das consultas, e o `user_id` precisa existir na observação; GET sem currency só é complementado por Search com correspondência estrita de order, transação, conta, referência, montantes e método. Sem essas provas não ocorre aprovação. A conta TEST não pôde ser comprovada externamente nesta sessão.
- **Git:** 10 arquivos tracked modificados e 23 arquivos novos no escopo P10; branch e HEAD permanecem na base original. O `git diff --stat` normal mostra apenas tracked e deve ser lido junto com `git ls-files --others --exclude-standard` para revisar a entrega completa.

## Fronteiras e próximo gate

ADR-0005 é limitado para esta fase pela decisão explícita do owner: P10 termina no commit financeiro e na outbox persistida; Entitlement/Delivery continuam P11. Nenhum estado P07, consumidor, endpoint legado `/v1/payments`, deploy, credencial de produção, commit, tag, push, PR ou merge foi introduzido. A revisão técnica independente do ChatGPT foi concluída com PASS após remediação A01–A05. O Final Quality Gate R2 também passou. A implementação está autorizada a seguir para checkpoint e integração Git; P10 ainda não é COMPLETE enquanto commit/tag/push/PR/merge e sincronização de `main` não forem concluídos.

## Post-Review Remediation A01–A05

A auditoria técnica independente identificou cinco findings materiais. Todos foram corrigidos antes do Final Quality Gate.

| Finding | Severidade | Remediação | Evidência final |
| --- | --- | --- | --- |
| A01 — resposta incompleta de `POST /v1/orders` | HIGH | Resposta de criação incompleta não é mais usada como prova financeira. O adapter preserva o provider Order ID e consulta `GET /v1/orders/{id}` para snapshot canônico; falha temporária preserva identidade e mantém a tentativa recuperável como UNKNOWN. | 31 testes dirigidos do provider e integração MySQL de recuperação posterior. |
| A02 — recuperação com tentativas históricas | HIGH | `findRecoverableByOrderId` passou a localizar a única tentativa ativa por `activeAttemptKey`, em vez de exigir apenas um Payment histórico. | Teste MySQL com tentativa #1 rejeitada, tentativa #2 ativa, resposta perdida, webhook, Payment #2 APPROVED e Order.PAID. |
| A03 — seleção da tentativa atual e refund público | MEDIUM | Estado público usa ordenação determinística por `attemptNumber`, com fallbacks; REFUNDED possui estado público terminal próprio e não reabre controles de pagamento. | Testes MySQL de empate de timestamp e projeção REFUNDED. |
| A04 — incerteza transitória vs. review material | MEDIUM | UNKNOWN_STATUS e INCOMPLETE_SEARCH recuperáveis não criam review permanente; partial refund, chargeback, mismatch, múltiplos candidatos e demais reviews materiais permanecem sticky. | Testes de UNKNOWN → APPROVED, recovery incompleto → APPROVED e chargeback/review material preservado. |
| A05 — polling/reconciliação excessivos | MEDIUM | Polling do browser tornou-se progressivo e limitado; reconciliação pública ganhou claim atômica server-side baseada em `lastProviderSyncAt`, evitando múltiplos GETs simultâneos ao provider. | Teste MySQL com cinco consultas concorrentes e uma única reconciliação externa. |

### Final Quality Gate R2

Executado após todas as remediações:

- branch `phase/p10-mercado-pago-integration`;
- HEAD/base preservado em `a932c05013d286bca0ac1357162c721db887a84b`;
- `package.json` e `package-lock.json` inalterados;
- schema e migration P10 comprovadamente inalterados durante A01–A05;
- `npm run check`: PASS, 243/243 testes;
- testes dirigidos Mercado Pago + webhook: PASS, 34/34;
- integração MySQL: PASS, 38/38;
- Prisma validate/generate: PASS;
- `npm audit --audit-level=high`: 0 vulnerabilidades;
- production build Next.js: PASS;
- nomes dos segredos P10 ausentes de `.next/static`;
- nenhuma referência de persistência de PAN/CVV/CardToken encontrada;
- Prettier e `git diff --check`: PASS.

As limitações externas permanecem explícitas: chamada real Mercado Pago TEST e validação browser/Brick real não foram executadas por dependência de ambiente/credenciais e bloqueio do runtime automatizado. Nenhuma dessas limitações foi falsamente classificada como PASS.

**Resultado técnico final:** PASS — READY FOR GIT INTEGRATION.
## Estado Git final

`git rev-parse HEAD`: `a932c05013d286bca0ac1357162c721db887a84b`.

```text
## phase/p10-mercado-pago-integration
 M .env.example
 M MEMORY.md
 M ROADMAP.md
 M docs/README.md
 M memory/2026-09-13.md
 M prisma/schema.prisma
 M src/app/checkout/actions.ts
 M src/app/checkout/checkout-form.tsx
 M src/app/checkout/checkout-state.ts
 M vitest.config.mts
?? docs/architecture/p10-implementation-plan.md
?? docs/architecture/p10-phase-execution-brief.md
?? docs/architecture/p10-validation-report.md
?? prisma/migrations/20260913_p10_mercado_pago_financial/
?? src/app/api/webhooks/
?? src/app/checkout/payment/
?? src/infrastructure/database/payment.integration.ts
?? src/infrastructure/database/prisma-payment-repository.ts
?? src/infrastructure/http/
?? src/infrastructure/payments/
?? src/infrastructure/security/hmac-payment-continuation.ts
?? src/modules/payments/application/financial-coordinator.ts
?? src/modules/payments/application/payment-provider.ts
```

`git diff --stat` (não inclui untracked): **10 arquivos tracked, 144 inserções, 32 remoções**. `git ls-files --others --exclude-standard`: **23 arquivos novos**. `git diff --check`: PASS.
