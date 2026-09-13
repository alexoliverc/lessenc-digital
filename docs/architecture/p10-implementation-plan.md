# P10 — Mercado Pago Integration — Physical Implementation Plan

**Data da reconciliação:** 2026-09-13.
**Status:** P10 TECHNICAL REVIEW PASS — FINAL QUALITY GATE PASS — READY FOR GIT INTEGRATION.
**Implementação financeira:** executada por autorização explícita posterior do owner, sem operações Git protegidas ou pagamentos reais.
**Branch:** `phase/p10-mercado-pago-integration`.
**Base local/remota conferida:** `a932c05013d286bca0ac1357162c721db887a84b`.
**Brief:** [p10-phase-execution-brief.md](p10-phase-execution-brief.md).
**Evidências:** [p10-validation-report.md](p10-validation-report.md).

> Este documento preserva a análise e as propostas da P10.1 como histórico da decisão. O brief posterior do owner resolveu os gates de execução. As afirmações “proposto”, “não aplicado” e “aberto” nas seções originais descrevem exclusivamente o momento P10.1; a tabela e a implementação factual abaixo prevalecem para a execução atual.

## P10 execution update — 2026-09-13

| Stop Condition P10.1 | Resolução operacional para esta implementação |
| --- | --- |
| SC-01 — ADR-0005 × P11 | A decisão explícita mais recente do owner e a baseline P00–P20 limitam o ADR: P10 grava Payment, Order, PaymentEvent e OutboxEvent em transação; Entitlement e entrega continuam P11. O ADR não foi alterado. |
| SC-02 — persistência | Migration aditiva `20260913_p10_mercado_pago_financial` aplicada apenas nos bancos P06 locais/teste autorizados; índices únicos de identidade e tentativa ativa, PaymentEvent mínimo sem payload bruto. Nenhum estado P07 foi alterado. |
| SC-03 — transições P07 | O aplicador usa somente fatos P07. UNKNOWN persistente não volta artificialmente a PENDING; transições incompatíveis produzem REVIEW sem atualizar Order ou outbox. |
| SC-04 — eventos sem representação | Partial refund e chargeback geram REVIEW; expirado/cancelado encerra somente a tentativa e mantém Order.PENDING; reembolso integral só é aplicado após comprovação do valor integral e estado prévio válido. |
| SC-05 — continuação P09 | Capability P10 separada HMAC-SHA-256, propósito fixo, TTL 24h, cookie HttpOnly/SameSite=Lax/Path `/checkout`, Secure fora de local; Origin validado nos POSTs. P09 submission token não concede pagamento. |
| SC-06 — moeda, conta, valor | BRL e totais são confrontados com Order/Payment. Quando GET omite moeda, a busca Orders API só a complementa por correspondência exata de order, transação, conta, referência, valores e método; qualquer ausência/incompatibilidade fica em REVIEW. A prova com conta e credenciais TEST ainda depende de ambiente adequado. |
| SC-07 — 3DS | Somente cartão de crédito, uma parcela, captura automática. Challenge HTTPS é apresentado em iframe; mensagem do iframe nunca confirma pagamento, apenas dispara GET no servidor. |
| SC-08 — idempotência/recovery | Payment.id local fixa X-Idempotency-Key; reserva serializada por lock de Order e índice único de tentativa ativa. POST ambíguo não é repetido automaticamente; GET/busca paginada com candidata única permitem recuperar, e múltiplas candidatas bloqueiam em REVIEW. Nova tentativa só após recusa/cancelamento seguro. |
| SC-09 — webhook temporal | Verificação HMAC em tempo constante, timestamp estritamente de 10 dígitos (segundos) ou 13 (milissegundos), janela de ±300s. O body não é autoridade; sempre consultar GET e aplicar deduplicação transacional. Retries fora da janela dependem de reconciliação. |
| SC-10 — ambiente TEST | Nenhuma credencial real foi lida ou exibida e nenhuma chamada real ao Mercado Pago foi feita. HTTP controlado e MySQL P06 são a evidência executada. Verificação TEST permanece pendente e explicitamente reportada. |

O código físico está em `src/modules/payments/application`, `src/infrastructure/payments`, `src/infrastructure/database/prisma-payment-repository.ts`, `src/app/api/webhooks/mercadopago` e `src/app/checkout/payment`. A camada de aplicação conhece apenas o contrato neutro `PaymentProvider`. A migration preserva registros antigos por campos opcionais e não reclassifica tentativas legadas. O relatório apresenta comandos, resultados, limites de runtime e riscos residuais. Esta atualização não atribui PASS técnico nem COMPLETE à P10.

## 1. Baseline física e reconciliação arquitetural

| Evidência instalada                                                                  | Consequência para P10                                                                                                                         |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/payments/domain/payment.ts` e `application/apply-payment-transition.ts` | Fatos e transições puros; ainda sem PaymentProvider ou escrita financeira                                                                     |
| `src/modules/commerce/domain/order-transition.ts`                                    | Aprovação de Payment pode gerar Order.PAID; recusa externa não equivale automaticamente a INTERNAL_FAILURE_CONFIRMED                          |
| `src/infrastructure/database/prisma-checkout-order-repository.ts`                    | P09 grava Customer/Order/OrderItem; recovery de P2002 restrito a order.create, preservando A01                                                |
| `checkout-order.integration.ts`                                                      | Retries com IDs técnicos distintos e rollback do perdedor, preservando A02                                                                    |
| `create-checkout-order.ts` e `src/app/checkout/**`                                   | PRICE_CHANGED compara preço assinado com preço resolvido; UNAVAILABLE remove UI stale; CREATED/EXISTING não retornam autorização de pagamento |
| Token v2 em `src/infrastructure/security/hmac-checkout-submission-token.ts`          | HMAC, base64url estrito, segredo mínimo de 32 bytes; issuedAt sem TTL; não autentica, autoriza ou cifra                                       |
| `src/lib/config/**`                                                                  | Configuração física fica aqui, apesar de documentos antigos mencionarem src/config                                                            |
| `prisma/schema.prisma`                                                               | Payment sem vínculo de provider; PaymentEvent ausente; OutboxEvent com deduplicationKey UNIQUE                                                |
| `package.json`                                                                       | Sem SDK Mercado Pago; Node/TypeScript/Prisma e ferramentas existentes preservados                                                             |

O owner separa a confirmação Payment/Order na P10 da ativação/entrega P11. O [ADR-0005](../decisions/ADR-0005-transactional-outbox.md), porém, exige Payment + Order + Entitlement + Outbox na mesma transação. Isso é **divergência canônica material SC-01**, não apenas referência histórica. Este plano propõe a fronteira solicitada pelo owner, sem alterar o ADR e sem declarar o conflito encerrado.

Os documentos P09 preservam restrições da sua execução. A autorização atual de MEMORY/ROADMAP/owner prevalece sobre frases antigas de P10 não autorizada. A01–A06 estão encerrados na base, não constituem novos trabalhos desta sessão.

## Current Orders API reconciliation

A baseline moderna é **Checkout Transparente via Orders API**, encapsulada pelo PaymentProvider. A referência oficial publica criação automática em `POST /v1/orders`; `X-Idempotency-Key` é obrigatório e aceita de 1 a 128 caracteres. UUID de Payment, com 36 caracteres, é compatível com esse limite e com o exemplo UUID da API. `external_reference` admite até 64 caracteres, comportando Order.id. [Create order](https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api/create-order/post).

Consulta de recurso: `GET /v1/orders/{id}`. Recuperação adicional proposta: `GET /v1/orders` com `external_reference`, paginação e intervalo temporal. A busca não é uma restrição de unicidade: encontrar uma referência não basta para vincular uma cobrança. [Get order](https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api/get-order/get), [Search order](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api/search-order/get).

Referências de [LES-INT-MP-R01](LES-INT-MP-R01.md) a `/v1/payments`, Payment.CHARGEBACK ou Payment.PROCESSING não são contratos desta implementação. Nenhuma integração híbrida Payments API/Orders API será criada por conveniência. `providerPaymentId` abaixo identifica a transação de `transactions.payments[].id` da Orders API, não autoriza consultar o endpoint legado.

Consultas externas desta sessão foram somente à documentação pública e ao código oficial de SDK; nenhuma API financeira foi chamada. Contratos consultados podem evoluir: revalidar detalhes de request/response e fixtures antes da implementação, sem atualização automática de dependências.

## 2. Portas, responsabilidades e DTOs propostos

| Componente proposto                                              | Responsabilidade                                                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/modules/payments/application/payment-provider.ts`           | Contrato neutro para criar tentativa externa, consultar recurso e procurar referências; DTOs sem Prisma/SDK/fetch |
| `src/infrastructure/payments/mercado-pago-adapter.ts`            | Requests Orders API, timeout, parsing validado, identidade externa, normalização e erros seguros                  |
| `src/infrastructure/payments/mercado-pago-webhook-verifier.ts`   | Validação de assinatura e envelope; usa node:crypto, sem decisão financeira                                       |
| `src/modules/payments/application/start-payment.ts`              | Obter tentativa autorizada, validar pedido/método/fingerprint e coordenar reserva/chamada/aplicação               |
| `src/modules/payments/application/apply-provider-observation.ts` | Único coordenador para resposta síncrona, webhook e reconciliação                                                 |
| `src/modules/payments/application/reconcile-payment.ts`          | Consulta e recuperação de resultado desconhecido; operação interna injetável e testável                           |
| `src/infrastructure/database/prisma-payment-repository.ts`       | Locks, CAS de envio, mapeamento do domínio, journal e outbox na transação local                                   |
| `src/app/api/webhooks/mercadopago/route.ts`                      | Boundary Node POST, limites de entrada, autenticação, respostas HTTP sanitizadas                                  |
| Extensão futura de `src/app/checkout/**`                         | Início de pagamento autorizado e estado público; nunca cálculo autoritativo ou transição financeira               |

Nomes são plano físico, não arquivos a criar nesta sessão. A implementação deverá manter as fronteiras do lint P07: Application/Domain não importam Node, HTTP, SDK, React ou Prisma. UUID, hash, transporte e relógio entram por composição/portas apropriadas.

Entrada de criação interna: Payment.id, Order.id, Money persistido, meio permitido e dados efêmeros mínimos do pagador. Saída do provider: união explícita entre observação verificada, resposta ambígua, erro de configuração/entrada e observação não representável. Nunca converter toda exceção em REJECTED.

Observação neutra contém identidade externa da order/transação, referência interna, valores em minor units, moeda validada, estado proposto ou motivo de revisão, instante/versão externa quando disponíveis e apresentação PIX permitida. Strings originais de status ficam apenas no adapter/journal; fatos do domínio são construídos depois das verificações. `PaymentFact`/`OrderFact` existentes não são desserializados do HTTP.

## 3. Composição de requests e validação de respostas

O backend monta `type=online`, `processing_mode=automatic`, `external_reference=Order.id`, `total_amount` e `transactions.payments[0].amount` a partir de Order persistida. Converter minor units por aritmética inteira em string decimal com duas casas; nunca usar amount enviado pelo Brick como autoridade. P10 envia uma única transação e valida quantidade/total/snapshot P09. Exemplos genéricos do provedor que encaminham o formulário inteiro não devem ser copiados.

PIX usa `payment_method.id=pix`, `type=bank_transfer` e email persistido. O provider pode responder processing antes de disponibilizar QR. Expor somente `qr_code`, `qr_code_base64` e/ou `ticket_url` validados, quando existentes; caso contrário, mostrar pendência e permitir consulta posterior. Não definir uma nova política comercial de expiração implicitamente. [Integração PIX](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix).

Cartão usa token transitório do Brick, `type=credit_card`, método reconhecido e `installments=1` imposto no servidor. A documentação apresenta token de uso único; após perda do processo não se presume capacidade de reconstruir/reutilizar o token. Metadados de identificação eventualmente necessários exigem contrato mínimo e minimização; não persistir CPF/documento por padrão. [Cartões via Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/cards).

Antes de qualquer fato financeiro, conferir:

1. Recurso consultado e providerOrderId esperado; providerPaymentId, se já vinculado, não pode mudar silenciosamente.
2. `external_reference` igual ao Order.id local, conta/aplicação/ambiente esperados, `type=online` e cardinalidade compatível. Não aceitar múltiplas transações para uma tentativa do MVP sem revisão.
3. Valor total e valor da transação iguais a Payment e Order; valor pago integral para aprovação; valor reembolsado integral para FULL_REFUND_COMPLETED. Rejeitar decimais inválidos, overflow, moedas diferentes e somas inconsistentes.
4. Coerência entre estado da order e da transação. Um único item APPROVED dentro de uma order ambígua não aprova a compra.
5. O instante/versão deve vir do recurso consultado, não de `date_created` da notificação. Preservar precisão; timestamp local de recebimento não ordena fatos financeiros.

**SC-06 — campos financeiros:** exemplos oficiais de GET nem sempre exibem moeda, enquanto Search exibe `currency`; não inventar `currency_id` nem assumir BRL porque a entrada local é BRL. A implementação depende de comprovar o campo autoritativo retornado ou um contrato explícito de conta/site/moeda e provas de totais/reembolso. Se ausente, observação vai a revisão sem aprovação. Também falta configurar/comprovar identidade da conta esperada; body de webhook não resolve isso.

Timeout/rede/5xx conservam ambiguidade. HTTP 402 pode conter order criada com falha transacional; interpretar recurso validado antes de classificar. `423`/`429` têm retry controlado com a mesma chave e backoff limitado. HTTP 409 por chave usada **não** justifica uma nova chave: buscar/reconciliar. Não fixar prazo de retenção de idempotência não comprovado. A referência tem texto genérico de 409 sugerindo nova chave; essa sugestão não prevalece sobre a proteção contra cobrança duplicada do owner. [Erros de criação](https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api/create-order/post).

## Proposed schema delta — NOT YET APPLIED

**SC-02 aberto: migration necessária para o alvo futuro, não autorizada nem aplicada nesta sessão.** Proposta aditiva mínima para tentativas concorrentes e journal, sujeita a revisão. Nenhum enum de negócio P07 muda. Campos nullable em Payment preservam registros preexistentes sem atribuir retrospectivamente um provider; novos writers P10 devem exigir os campos de controle. Não adicionar defaults que apresentem registros antigos como enviados.

```prisma
// Somente adições propostas ao model Payment existente.
model Payment {
  provider               String?        @db.VarChar(32)
  providerOrderId        String?        @map("provider_order_id") @db.VarChar(64)
  providerPaymentId      String?        @map("provider_payment_id") @db.VarChar(64)
  attemptKey             String?        @unique @map("attempt_key") @db.Char(36)
  activeOrderId          String?        @unique @map("active_order_id") @db.Char(36)
  method                 String?        @db.VarChar(16)
  requestFingerprint     String?        @map("request_fingerprint") @db.Char(64)
  createClaimedAt        DateTime?      @map("create_claimed_at") @db.DateTime(3)
  providerUpdatedAt      String?        @map("provider_updated_at") @db.VarChar(40)
  events                 PaymentEvent[]

  @@unique([provider, providerOrderId])
  @@unique([provider, providerPaymentId])
  @@index([status, updatedAt])
}

// Novo model proposto; não existe no schema instalado.
model PaymentEvent {
  id                     String    @id @default(uuid()) @db.Char(36)
  paymentId              String?   @map("payment_id") @db.Char(36)
  provider               String    @db.VarChar(32)
  providerOrderId        String    @map("provider_order_id") @db.VarChar(64)
  observationKey         String    @unique @map("observation_key") @db.Char(64)
  source                 String    @db.VarChar(24)
  outcome                String    @db.VarChar(24)
  reasonCode             String?   @map("reason_code") @db.VarChar(64)
  snapshot               Json
  correlationId          String    @map("correlation_id") @db.Char(36)
  observedAt             DateTime  @default(now()) @map("observed_at") @db.DateTime(3)
  appliedAt              DateTime? @map("applied_at") @db.DateTime(3)
  payment                Payment?  @relation(fields: [paymentId], references: [id], onDelete: Restrict, onUpdate: Restrict)

  @@index([paymentId, observedAt])
  @@index([provider, providerOrderId])
  @@index([outcome, observedAt])
  @@map("payment_events")
}
```

Este bloco é diff conceitual: não é schema completo, não substitui model Payment e não contém SQL executável de migration. IDs externos têm comprimento defensivo proposto de 64, sujeito ao contrato verificado; não truncar IDs. Preservar associação e comparação exata de IDs mesmo em MySQL com collation case-insensitive: validar formato/case no boundary e conferir strings retornadas. SQL futuro deverá explicitar collation binária para identificadores opacos quando necessário.

| Campo/decisão      | Justificativa e invariante                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| provider           | Código neutro persistido, inicialmente MERCADO_PAGO; um vendedor por ambiente/banco. Multiaccount é outro gate                                                                                           |
| providerOrderId    | Identifica a order `ORD...`, usado em GET/reconciliação; UNIQUE junto ao provider                                                                                                                        |
| providerPaymentId  | Identifica `transactions.payments[].id`, `PAY...`; não confundir com reference_id ou reference.id numérico                                                                                               |
| attemptKey         | Nonce de tentativa emitido pelo servidor no fluxo autorizado; idempotência do comando local, distinto do UUID Payment.id e do submissionId P09                                                           |
| activeOrderId      | Marcador único, igual a orderId enquanto a tentativa está pendente/ambígua/aprovada ou em revisão; evita duas tentativas ativas. Não substitui FK orderId existente                                      |
| method             | PIX ou CREDIT_CARD; contrato fechado de aplicação                                                                                                                                                        |
| requestFingerprint | SHA-256 de composição canônica/versionada da operação. Inclui identidade, valor, moeda, método, parcela e digest transitório de token/metadados quando houver; não armazena token ou payload recuperável |
| createClaimedAt    | CAS de null para instante reserva o envio. Crash após a reserva é ambíguo; não liberar/reexecutar cegamente por tempo decorrido                                                                          |
| providerUpdatedAt  | Instante externo canônico com precisão preservada; não converter silenciosamente microssegundos para DateTime(3) e alegar ordem total                                                                    |
| PaymentEvent       | Journal de observação externa confiável ou divergente; resultado independente de PaymentStatus. OutboxEvent continua exclusivamente interno                                                              |

Contrato fechado de `source`: CREATE_RESPONSE, WEBHOOK ou RECONCILIATION. `outcome`: APPLIED, NO_CHANGE, STALE ou REVIEW. Campos são validados no adapter/repository, sem strings arbitrárias do browser. `snapshot` é **allowlist**, não payload completo: IDs externos, externalReference, status/statusDetail da order e transação, amountMinor/paidAmountMinor/refundedAmountMinor/currency quando comprovados, providerUpdatedAt/versão e evidência mínima de conta/ambiente. Campos não comprovados ficam ausentes e bloqueiam a transição dependente. Sem email, documento, CardToken, cartão, assinatura, URL PIX ou QR no journal.

`observationKey = SHA256` da projeção canônica acima com versão de formato e provider; independente da origem CREATE/WEBHOOK/RECONCILIATION. Deduplica a mesma observação, não usa somente status nem ID do body não coberto pela assinatura. Registrar a primeira origem; a proposta não promete histórico de cada entrega HTTP. Sem timestamp/versão suficientes ou com mesmo instante e conteúdo financeiro incompatível, registrar REVIEW, nunca inventar precedência.

PaymentEvent.paymentId é nullable para registrar observação autenticada cujo vínculo ainda não pôde ser provado. Essa linha não cria Payment, não associa por email e não produz outbox. Observações REVIEW podem ser reaplicadas por operação interna explícita após correção autorizada; duplicidade não deve significar descartar para sempre um item ainda não aplicado. Falha transitória antes de obter snapshot gera erro seguro/retry, sem ACK enganoso nem payload cru persistido.

Payment.orderId continua não único: modelo atual permite histórico de tentativas. A proposta exige somente uma ativa por Order e nenhuma nova tentativa enquanto houver UNKNOWN/REVIEW. Trocar método ou tentar novamente após rejeição definitiva é uma **nova operação explícita**, não replay da tentativa anterior; autorização e política exatas estão em SC-08. Não liberar activeOrderId para falha HTTP genérica ou estado não representável.

Antes de eventual migration: inspecionar registros existentes em ambiente autorizado, detectar múltiplas tentativas abertas, definir backfill de campos nullable e revisar índices/collation. Nada disso é assumido executado. Reversão preferencial será desativar entrada financeira mantendo o journal e campos aditivos; não apagar histórico financeiro como rollback.

## Provider status normalization matrix

Esta é uma **proposta de interpretação interna**, não equivalência automática de enums. Pares externos confirmados nas tabelas oficiais de [order](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/order-status) e [transação](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/transaction-status). A tabela separa alvo, elegibilidade de aplicação e gaps. `pending_challenge` é documentado na transação; não presumir o mesmo par no nível order.

| Provider status / status_detail                                                               | Normalização proposta                                         | Aplicação e Stop Condition                                                                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| created / created                                                                             | PENDING                                                       | Manter PENDING; não aprovar                                                                                         |
| processed / accredited                                                                        | APPROVED                                                      | Exige concordância order/transação, total pago integral e vínculos válidos; depois fato PAYMENT_APPROVED para Order |
| processing / in_process                                                                       | PENDING                                                       | Não tratar processamento como pagamento concluído                                                                   |
| processing / pending_review_manual; processing / in_review; in_review / in_review (transação) | PENDING                                                       | Aguardar; nenhuma concessão                                                                                         |
| action_required / waiting_payment                                                             | PENDING                                                       | Ação pendente do comprador                                                                                          |
| action_required / waiting_transfer                                                            | PENDING                                                       | PIX pendente; QR não prova pagamento                                                                                |
| action_required / waiting_capture                                                             | PENDING + REVIEW                                              | Captura não ocorreu; inesperado no alvo automático, sem inventar endpoint de captura                                |
| action_required / pending_challenge (transação)                                               | PENDING                                                       | Autenticação não é aprovação; UX 3DS só após SC-07                                                                  |
| action_required / waiting_retry                                                               | PENDING                                                       | Não abrir tentativa local nova enquanto retry externo estiver em curso                                              |
| failed / failed (order) e detalhe de falha de transação reconhecido                           | REJECTED                                                      | Somente falha financeira final confirmada; HTTP 4xx isolado não é este fato; Order não vira FAILED automaticamente  |
| canceled / canceled                                                                           | CANCELED                                                      | Aplicável a Payment.PENDING; UNKNOWN → CANCELED é proibido no P07, vai a REVIEW                                     |
| expired / expired                                                                             | NÃO REPRESENTÁVEL SEM DECISÃO                                 | SC-04: não inventar Payment.EXPIRED nem converter silenciosamente para CANCELED/REJECTED                            |
| refunded / refunded                                                                           | REFUNDED                                                      | Somente reembolso integral comprovado e Payment já APPROVED/Order PAID; demais origens vão a REVIEW                 |
| processed / partially_refunded                                                                | NÃO REPRESENTÁVEL                                             | SC-04; não converter em REFUNDED nem manter como aprovação nova                                                     |
| charged_back / in_process, settled ou reimbursed                                              | NÃO REPRESENTÁVEL                                             | SC-04; nenhum Payment.CHARGEBACK ou refund presumido                                                                |
| status/status_detail desconhecido, combinação incoerente ou cardinalidade inesperada          | AMBIGUOUS_RESULT + REVIEW                                     | PENDING pode ir a UNKNOWN; UNKNOWN permanece; estado confirmado/terminal é preservado                               |
| timeout, resposta perdida, JSON incompleto, identidade/amount/currency mismatch               | Resultado ambíguo ou inválido, sem fato financeiro confirmado | UNKNOWN quando permitido; reconciliar/investigar; nunca REJECTED por inferência                                     |

Detalhes de falha da transação a exigir em fixtures/allowlist: bad_filled_card_data, invalid_card_token, high_risk, rejected_by_issuer, required_call_for_authorize, max_attempts_exceeded, card_disabled, insufficient_amount, amount_limit_exceeded, processing_error, invalid_installments, 3ds_challenge_expired e card_insufficient_amount. Detalhe novo cai na linha desconhecida, mesmo com `status=failed`. Essa lista vem da [tabela de transações](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/transaction-status); não reutilizar catálogo legado de Payments API.

**SC-03 — limitações P07:** UNKNOWN só pode sair para APPROVED ou REJECTED. Um GET confiável pendente após timeout não permite UNKNOWN → PENDING; manter UNKNOWN e registrar observação pendente, sem exigir alteração do grafo. UNKNOWN → CANCELED, reembolso observado antes de aprovação local e aprovação após REJECTED/CANCELED também não cabem. Parar a aplicação dependente, preservar estado e registrar REVIEW. Não fabricar uma aprovação intermediária para conseguir aplicar refund.

No grafo instalado APPROVED admite REFUNDED; REJECTED, CANCELED e REFUNDED só admitem repetição. Observação atrasada comprovadamente anterior pode ser STALE sem efeito; conflito não comprovadamente antigo vai a REVIEW. Nenhum evento contraditório altera diretamente status por SQL. Reembolso integral autorizado produziria FULL_REFUND_COMPLETED em Payment e Order atomicamente, com REFUND_COMPLETED na outbox; a consequência sobre acesso continua SC-01/P11.

## 4. Idempotência local e coordenação financeira

Proposta de algoritmo, condicionada a SC-02/SC-05/SC-08:

1. Validar autorização financeira específica e intento de operação. Carregar Order e itens/Customer no servidor. A identidade entregue pelo browser é localizador, não autorização.
2. Abrir transação curta. Bloquear a Order por PK (`SELECT ... FOR UPDATE` parametrizado na Infrastructure); buscar attemptKey e tentativa ativa. Comparar fingerprint da operação e Money com Order; recusar conflito. Pedido PAID/REFUNDED não inicia cobrança.
3. Retornar Payment existente para a mesma tentativa, ou criar Payment.PENDING com UUID próprio, attemptKey e activeOrderId. Nova tentativa só após decisão explícita compatível; não reaproveitar chave para mudar cartão/PIX. Commit.
4. Reservar envio via CAS de createClaimedAt, conferindo novamente estado/vínculo sob lock. Somente o vencedor faz POST; perdedor retorna estado local seguro. Se já há providerOrderId, consultar em vez de criar de novo.
5. Fora da transação, chamar adapter com `X-Idempotency-Key=Payment.id`, referência Order.id e request canônico. Retry da mesma operação mantém chave e payload. Timeout não libera outra tentativa. Token do cartão fica apenas na memória da operação e é descartado ao encerrá-la.
6. Normalizar e validar resposta; se completa e confirmável, encaminhar observação ao aplicador. Resposta parcial/ambígua pode exigir GET ou reconciliação; não assumir que status HTTP é status financeiro.
7. Abrir nova transação, na ordem de locks Order → Payment. Reler snapshots, associação do provider e marker ativo; validar a observação frente ao estado mais recente. Vincular IDs somente se vínculo ainda nulo ou exatamente igual; UNIQUE em outro Payment é conflito real.
8. Verificar/deduplicar PaymentEvent; calcular novas representações com ApplyPaymentTransition e ApplyOrderTransition. Retorno de erro do domínio não vira update parcial. Repetição mantém timestamps e não gera novo efeito.
9. Persistir Payment, Order, PaymentEvent e OutboxEvent aplicável juntos; commit. Se qualquer escrita falhar, rollback completo. Persistência de REVIEW sem alteração financeira é caminho explícito; falha desse registro exige retry seguro.
10. Responder somente estado público derivado do commit confirmado. Falha de commit após criação externa exige reconciliação, não segunda cobrança.

Fingerprint inclui versão da composição e todos os campos financeiros relevantes, inclusive diferenças de token quando presente; armazenar só digest irreversível para detectar incompatibilidade. Não tratá-lo como chave de autenticação ou forma de recuperar o token. Quando o request exato de cartão não estiver mais disponível, usar GET/busca; não retokenizar e reenviar como se fosse a mesma operação.

Não há lock ou transação MySQL durante POST/GET. Deadlock/lock timeout local pode ter retry limitado da transação local; esse retry não repete automaticamente o POST. P2002 é classificado por operação/constraint esperado, preservando a lição A01. Erros de FK, programação, eventos e outbox não são transformados genericamente em idempotência de Payment.

## 5. Matriz de concorrência e recuperação

| Corrida/falha                                     | Saída exigida                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Duas reservas com mesma attemptKey                | Um Payment; segunda chamada verifica identidade e recupera o mesmo registro                                              |
| Duas attemptKeys simultâneas para Order           | Lock + activeOrderId único; uma tentativa ativa; concorrente incompatível não chama provider                             |
| Dois envios do mesmo Payment                      | CAS permite um envio inicial; retries externos mantêm Payment.id e composição                                            |
| Timeout/resposta perdida                          | UNKNOWN ou estado confirmado preservado; nenhum novo Payment/chave automática                                            |
| Crash entre reserva e POST                        | Sem certeza de envio; reconciliar, não concluir REJECTED nem liberar outra tentativa                                     |
| Webhook chega antes de persistir resposta POST    | Resolver por providerOrderId ou busca controlada da referência; vínculo ambíguo fica REVIEW; resposta tardia relê estado |
| Webhook duplicado                                 | Pode repetir GET, mas observationKey + transação + outbox única impedem efeito financeiro duplicado                      |
| Fora de ordem                                     | Consultar recurso atual; comparar versão/instante e domínio; STALE comprovado ou REVIEW sem downgrade                    |
| Webhook × reconciliação                           | Mesmo aplicador, ordem de locks e dedup; uma transição efetiva                                                           |
| Reconciliação × resposta síncrona                 | Resposta atrasada não sobrescreve aprovação/reembolso confirmado                                                         |
| Mesma chave, mesma operação                       | Reutiliza tentativa/fingerprint; timestamps de aprovação e outbox preservados                                            |
| Mesma chave, operação incompatível                | Conflito antes de POST; nenhum overwrite do pedido ou da tentativa                                                       |
| Provider aprovado, falha de commit                | Reconsulta recupera; rollback impede Order.PAID sem Payment/journal/outbox consistente                                   |
| APPROVED local × observação terminal incompatível | Preservar confirmação, registrar divergência; sem bypass do domínio                                                      |

## 6. Webhook físico planejado

1. POST Node, body limitado e JSON validado; exigir tópico `order`. Tratar headers/query duplicados ou contraditórios como malformados. Comparar data.id de query com body quando presente; não usar fallback silencioso entre valores diferentes.
2. Extrair `ts`/`v1` de x-signature; exigir data.id e x-request-id no contrato local. Montar `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, HMAC-SHA256 e comparação de buffers de tamanho validado em tempo constante. **Preservar case de data.id**; não transportar a antiga regra de lowercase para ORD. O código oficial atual preserva case. [Validador oficial](https://raw.githubusercontent.com/mercadopago/sdk-nodejs/master/src/utils/webhook/index.ts), [notificações order](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications).
3. Signature ausente/inválida: 401; envelope inválido: 400; sem consulta financeira e sem escrita de estado. Testar hash não hexadecimal/multibyte, componentes ausentes/repetidos, query duplicada e tamanho excessivo. Nunca registrar secret, assinatura ou body.
4. Assinatura válida identifica o recurso para GET autenticado; o body não foi integralmente autenticado pelo manifesto e não determina estado, moeda, referência ou vendedor. GET deve usar host fixo `api.mercadopago.com`, ID validado/codificado e sem seguir URL arbitrária do evento; proteger contra SSRF/redirect.
5. Aplicar fluxo comum das seções 3–5. Proposta MVP síncrona limitada: 200/201 somente após commit financeiro ou journal durável de NO_CHANGE/STALE/REVIEW. Falha transitória GET/DB retorna 5xx para permitir reentrega; não responder sucesso e iniciar tarefa não durável em background.
6. Casos REVIEW já gravados não geram tempestade de efeitos: resposta segura e item consultável internamente para resolução autorizada. Reconciliação interna pode reaplicar um REVIEW após correção verificada. Não introduzir worker/cron nesta entrega.

**SC-09 — replay temporal:** a documentação tem exemplos com ts em milissegundos, enquanto o validador oficial consultado calcula tolerância em segundos. Não escolher heurística silenciosa nem janela que rejeite retries legítimos. Antes de ativar uma janela de aceitação, aprovar unidade/formato e política de reentrega com fixtures da Orders API. A assinatura, GET atual, domínio e dedup transacional permanecem obrigatórios independentemente da janela. Não alegar proteção temporal já implementada.

## 7. Reconciliação e resposta perdida

`ReconcilePayment` recebe identidade interna por invocação autorizada, carrega Payment/Order e chama PaymentProvider. Com providerOrderId, GET direto; sem ID mas com criação reclamada/ambígua, buscar `external_reference=Order.id`, intervalo cobrindo a criação e todas as páginas necessárias com limites explícitos. Não filtrar só processed/accredited e perder uma tentativa pendente/rejeitada.

Cada candidato é reconsultado por ID e comparado com referência, método, valor, moeda, conta, intervalo e vínculos existentes. Zero resultados não prova que POST não ocorreu: manter ambiguidade e permitir nova consulta limitada. Mais de um candidato ou busca incompleta não escolhe o primeiro. Em histórico com múltiplas tentativas, external_reference sozinho não identifica Payment: é necessária correlação adicional comprovável ou REVIEW. Um único candidato só é vinculável quando os demais invariantes e ausência de outra tentativa compatível forem comprovados. [Contrato de busca](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api/search-order/get).

Não foi comprovado prazo/garantia de replay de POST para todas as falhas e cenários de CardToken; SC-08 bloqueia pressupor repetição ilimitada. O plano oferece consulta como recuperação segura, sem substituir a chave. Nenhuma nova chamada financeira, retokenização automática, scheduler ou acesso administrativo público é implícito.

## 8. Outbox e fronteira P11

Proposta pendente de SC-01: produzir `ORDER_PAID` no mesmo commit que Payment.APPROVED e Order.PAID, com `deduplicationKey=order:<Order.id>:paid:v1`. Payload mínimo e versionado: orderId, paymentId, amountMinor, currency e instante confirmado interno. Não produzir simultaneamente PAYMENT_APPROVED sem consumidor/necessidade documentada, para evitar duas intenções equivalentes.

Para reembolso integral semanticamente permitido: `REFUND_COMPLETED`, chave `payment:<Payment.id>:full-refund:v1` e evidência mínima. Nenhum evento em PENDING/UNKNOWN/REJECTED/REVIEW produz autorização de entrega. Outbox não carrega payload do provider, token ou PII. Consumidores P11 verificarão estado autoritativo novamente; o desenho de ativação/revogação e o conflito do ADR devem ser reconciliados antes de implementar essa fronteira.

## 9. Checkout, configuração e dependências

A01/A02 não são refatorados pela P10. A03 mantém comparação do preço apresentado antes de criar pedido; pagamento usa snapshot já persistido. A04 mantém proteção de UI/servidor indisponível. A05 mantém finalidade exclusiva de submissão/idempotência; A06 mantém o parser de email. P10 não recalcula preço de Order histórica usando catálogo atual nem muda email do comprador por um campo do Brick.

**SC-05 — continuidade financeira:** CREATED/EXISTING atual não devolve uma capability financeira. Order.id, email e token P09 não bastam para iniciar/consultar pagamento ou divulgar QR. Recomenda-se uma capability separada, de escopo Order/ações e duração limitada, vinculada ao fluxo de criação/sessão, com proteção CSRF/Origin, armazenamento/transporte seguro e revogação apropriada. Sua emissão para EXISTING deve comprovar vínculo, não apenas posse do token P09. Forma de persistência, duração e eventual novo segredo precisam de decisão; nenhum campo/segredo adicional dessa capability foi incluído implicitamente no delta financeiro. As etapas públicas ficam bloqueadas até essa revisão.

Após fechar esse gate: `Order criada → início autorizado → escolha PIX/crédito → aguardar/ação necessária/resultado seguro`. Mostrar APPROVED apenas após estado persistido confirmado no servidor. Pending/UNKNOWN exibem mensagem de espera/reconciliação, não recusa. QR expirado não dispara nova cobrança. Sucesso/thank-you não ativa entrega. Estado/QR são privados à capability e respostas não podem ser compartilhadas por cache.

| Opção                                              | Avaliação proposta                                                                                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend fetch nativo + node:crypto                 | Preferida; sem pacote adicional. Exige timeout explícito, parsing Zod já instalado, codificação decimal, erros/retries limitados e testes de assinatura/contrato                                                                 |
| SDK backend Mercado Pago                           | Oferece Order e utilitários oficiais, mas adiciona ciclo de atualização, dependências e possíveis defaults de retry. Usar somente se vantagem concreta justificar nova autorização; não necessário para escrever esses contratos |
| Script oficial MercadoPago.js + Card Payment Brick | Preferido para frontend; carregar apenas na superfície financeira, gerenciar montagem/unmount, falha de carga e CSP mínima. Evita novo pacote npm, mas continua sendo dependência remota a validar                               |
| @mercadopago/sdk-js                                | Alternativa de loader/integração; só adotar se o wrapper resolver necessidade que o script não cumpra. Pin/revisão/aprovação antes de instalar                                                                                   |

As opções são baseadas no [SDK backend oficial](https://github.com/mercadopago/sdk-nodejs), na [inicialização oficial dos Bricks](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/common-initialization) e no [SDK JS oficial](https://github.com/mercadopago/sdk-js). O script suportado é `https://sdk.mercadopago.com/js/v2`; não hospedar cópia própria nem inventar hash SRI de um recurso mutável. PAN/CVV/validade permanecem nos campos seguros do provider; não entram em FormData/Server Action L'Essenc. Validar isso com teste de boundary antes de testes externos.

Configuração futura: validar lazily Access Token/Webhook Secret server-only, e `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` explicitamente pública. Separar ambientes pela origem das credenciais e isolamento, não apenas por prefixo textual do token. A documentação atual usa contas de teste e tokens APP_USR no fluxo Orders; a referência possui ressalvas sobre credenciais legadas TEST. Isso **não** autoriza credenciais do vendedor de produção; esclarecer SC-10 antes de qualquer teste externo. Sem ler valores nesta sessão.

## 10. Sequência física numerada — somente após nova autorização

1. **P10.1 — esta sessão:** preflight, reconciliação, brief/plano e índice. Apenas validação documental.
2. **P10.2 — revisão e gates:** ChatGPT avalia SC-01–SC-10; owner autoriza escopo exato. Não codar etapa dependente com gate aberto. Consolidar decisões canônicas somente em arquivos/escopo posteriormente permitidos.
3. **P10.3 — contratos e fixtures:** portas PaymentProvider/repository, DTOs neutros, normalização completa, composição decimal e erros explícitos; testes HTTP controlados sem provider real. Não alterar fatos/grafo P07.
4. **P10.4 — persistência autorizada:** revisar migration aditiva/backfill/constraints, aplicar somente no ambiente local/test autorizado, gerar client e provar reserva/claim/rollback em MySQL. Sem network dentro de transação.
5. **P10.5 — adapter e segurança:** POST/GET/search, timeout, assinatura, parsing, observação sanitizada e testes de proteção contra replay/incompatibilidade. Não adicionar SDK sem gate.
6. **P10.6 — aplicação transacional:** Payment/Order/PaymentEvent/Outbox, locks e dedup; provar todas as corridas da seção 5 e invariantes de P07.
7. **P10.7 — webhook/reconciliação:** rota Node e casos de uso comuns; GET depois da assinatura, resposta/ACK condicionado à durabilidade, recuperação sem providerOrderId e casos ambíguos.
8. **P10.8 — continuidade e UX financeira:** só com SC-05/SC-07 resolvidas, estender checkout e config; cartão/PIX, testes de boundaries e regressão A01–A06. Não editar P09 token para torná-lo autenticação.
9. **P10.9 — validação da implementação:** unitários, integração MySQL, typecheck, lint, format e diff; build/browser quando cabíveis à superfície implementada. Provider TEST somente em rodada autorizada separada, nunca produção.
10. **P10.10 — review e closeout:** Validation Report com resultados reais, ChatGPT Technical Review, correções autorizadas e Final Quality Gate. Commit/tag/push/PR/merge requerem autorização correspondente; P11 depende de brief próprio.

## 11. Plano de testes e critérios verificáveis

| Grupo                 | Evidência obrigatória futura                                                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normalização unitária | Todas as linhas da matriz, todos os detalhes reconhecidos de falha, desconhecidos, expired/chargeback/partial-refund, status order/transação conflitantes, UNKNOWN e estados terminais                            |
| Adapter unitário      | POST/GET/search corretos, cabeçalhos, UUID Payment.id, payload autoritativo, BRL/decimais, um payment, crédito 1 parcela, sem PAN/CVV, fingerprint incompatível, 402/409/423/429/5xx e timeout                    |
| Webhook unitário      | Assinatura válida/inválida, case ORD, ts/unidade aprovada, ausência/duplicidade de campos, body alterado sem autoridade financeira, JSON inválido/tamanho excessivo, source URL malicioso, duplicate notification |
| Identidades unitárias | amount/currency/external_reference/provider ID/conta/ambiente incompatíveis, múltiplos resultados de busca, ausência de moeda, dados incompletos, totais pagos/reembolsados divergentes                           |
| MySQL                 | Uma reserva/Payment ativo na corrida, claim único, retry idempotente, FK/UNIQUE reais, Payment + Order + journal + outbox atômicos, falha em cada estágio com rollback                                            |
| Concorrência MySQL    | Duplicação, fora de ordem, webhook × reconciliação, reconciliação × resposta síncrona; um efeito e timestamps preservados; nenhum Entitlement                                                                     |
| Continuidade/UI       | IDOR/capability inválida/expirada, CSRF/Origin, PRICE_CHANGED/unavailable, segredo ausente fail-safe, QR/status privados, pending/UNKNOWN seguros e nenhum cartão bruto no backend                                |
| Recuperação           | Provider criou mas resposta/commit se perdeu; sem nova chave, vínculo validado, zero/um/muitos candidatos e journal REVIEW reaplicável                                                                            |

Integração usa `lessenc_test`, loopback porta 3307, TLS e guards P06 preservados; fixtures por UUID, cleanup por ID, nenhum banco de produção. Mocks não comprovam concorrência: testes reais devem forçar interleavings e inspecionar contagens/rollback. Não executar MySQL ou suite financeira nesta sessão documental.

Aceite financeiro futuro: nenhuma aprovação baseada em browser/body; nenhuma dupla cobrança por retries; invariantes de identidade/valor; transações locais completas; erros reais preservados; sem segredos/logs sensíveis; P09 intacta; gates revisados. Não alegar exatamente uma cobrança externa apenas a partir de teste MySQL: validar separadamente o contrato de idempotência do provider.

## Open Stop Conditions requiring ChatGPT review

| ID    | Evidência/gap encontrado                                                              | Decisão exigida antes da etapa dependente                                                                                 |
| ----- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| SC-01 | ADR-0005 exige Entitlement no commit financeiro; owner reserva P11                    | Reconciliar atomicidade/consumo P11 formalmente; não alterar ADR nesta sessão                                             |
| SC-02 | Payment sem IDs/controle do provider; PaymentEvent ausente                            | Aprovar delta, migration, backfill, índices/collation e testes; nenhuma migration aplicada                                |
| SC-03 | UNKNOWN → PENDING/CANCELED e refund antes de APPROVED são proibidos                   | Manter UNKNOWN/REVIEW sem bypass; qualquer mudança do grafo P07 exige decisão explícita                                   |
| SC-04 | Partial refund, chargeback e expired sem representação exata                          | Definir tratamento/política; não adicionar estado nem mapear silenciosamente; runtime suspende aplicação dependente       |
| SC-05 | P09 continuation não é autenticação/autorização                                       | Aprovar capability financeira independente, vínculo, emissão/retry/TTL/revogação e eventual schema/segredo extra          |
| SC-06 | Moeda/conta/totais de refund não comprovados uniformemente nos exemplos GET           | Fixar contratos verificáveis; campos ausentes/mismatch não aprovam; nova configuração além do previsto retorna ao owner   |
| SC-07 | waiting_capture/3DS challenge não equivalem a crédito recebido                        | Definir UX e escopo 3DS; não adicionar captura manual, débito ou dependência implicitamente                               |
| SC-08 | Replay/idempotency retention, token de uso único e associação de múltiplas tentativas | Aprovar política de retry/nova tentativa/busca; sem novo token/chave em replay ambíguo, sem escolha arbitrária de recurso |
| SC-09 | Exemplos de timestamp da notificação e tolerância SDK divergem                        | Fixar unidade/janela e fixtures; preservar case atual de data.id e não reaproveitar receitas legadas                      |
| SC-10 | Nenhuma credencial inspecionada; documentação distingue teste Orders de legado        | Autorizar eventual rodada TEST e comprovar conta/ambiente; nunca chamada financeira real de produção                      |

Qualquer necessidade adicional de npm dependency, segredo/configuração, schema, mudança de P07/P09, requisito que exponha cartão ou trabalho P11+ também interrompe a etapa dependente. Nenhuma Stop Condition foi resolvida silenciosamente. Estas recomendações aguardam revisão, não conferem autorização para implementar.

## 12. Validação documental e fronteira desta sessão

Permitidos: os dois documentos P10 e indexação em docs/README. Todos os demais arquivos são protegidos. A `.prettierignore` existente exclui docs e Markdown; por isso o Prettier dirigido deverá usar `--ignore-path NUL` para realmente formatar estes três documentos no Windows, sem alterar a configuração.

Comandos desta sessão:

```powershell
npx prettier --ignore-path NUL --write docs/architecture/p10-phase-execution-brief.md docs/architecture/p10-implementation-plan.md docs/README.md
npx prettier --ignore-path NUL --check docs/architecture/p10-phase-execution-brief.md docs/architecture/p10-implementation-plan.md docs/README.md
npm run format:check
git diff --check
git diff --exit-code -- package.json package-lock.json prisma/schema.prisma prisma/migrations src .env.example
git diff --stat
git status --short --branch
```

Revisar também conteúdo dos arquivos novos, pois git diff sem staging não os inclui. Reportar seu tamanho/diff separado sem git add. Nenhuma suíte, build, browser, acesso a banco, `.env` real ou chamada financeira é necessário para P10.1. Entrega documental pronta para review não significa integração pronta para execução.
