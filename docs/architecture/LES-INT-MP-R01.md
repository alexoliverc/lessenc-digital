# LES-INT-MP-R01 — Integração Mercado Pago da L'Essenc Digital

**Projeto:** L'Essenc Digital
**Documento:** LES-INT-MP-R01
**Revisão:** R01
**Status:** Aprovado
**Data:** 11/09/2026
**Fase:** MVP-ARCH-01 — Arquitetura técnica do MVP

---

## 1. Objetivo

Este documento define a arquitetura de integração entre a L'Essenc Digital e o Mercado Pago.

A integração deverá suportar:

- criação segura de pagamentos;
- correlação entre pedidos internos e operações externas;
- confirmação de estado;
- webhooks;
- autenticação de notificações;
- idempotência;
- retries;
- reconciliação;
- reembolsos;
- chargebacks;
- observabilidade;
- separação entre ambientes;
- proteção de credenciais.

O Mercado Pago será o provedor inicial, mas não deverá se tornar a fonte central das regras de negócio da L'Essenc.

---

## 2. Princípio arquitetural

A relação deverá ser:

```text
L'Essenc Domain
      │
      ▼
PaymentProvider interface
      │
      ▼
MercadoPagoAdapter
      │
      ▼
Mercado Pago API
```

Nunca:

```text
OrderService
   │
   └── chamadas Mercado Pago espalhadas pelo código
```

Toda dependência específica do Mercado Pago deverá permanecer encapsulada.

---

## 3. Autoridades

O Mercado Pago será autoridade sobre o estado da operação financeira processada em sua infraestrutura.

A L'Essenc será autoridade sobre:

- `Order`;
- estado interno normalizado;
- `Entitlement`;
- acesso;
- entrega;
- auditoria;
- regras de negócio.

Um status externo não deverá ser copiado diretamente para todas as entidades internas.

---

## 4. Componentes da integração

A arquitetura conceitual possuirá:

```text
Frontend
   │
   ▼
Payment UI / MercadoPago.js
   │
   ▼
Backend L'Essenc
   │
   ├── PaymentService
   ├── MercadoPagoAdapter
   ├── WebhookService
   ├── ReconciliationService
   └── PaymentStateService
            │
            ▼
      Mercado Pago API
```

---

## 5. Credenciais

A integração utilizará credenciais distintas conforme necessidade.

Conceitualmente:

```text
PUBLIC KEY
```

Pode ser utilizada no frontend conforme o fluxo oficial adotado.

```text
ACCESS TOKEN
```

É credencial privada e deverá permanecer exclusivamente no backend.

```text
WEBHOOK SECRET
```

É segredo utilizado para validação das notificações Webhook.

Nunca deverá ser enviado ao frontend.

---

## 6. Separação de ambientes

Credenciais deverão ser separadas entre:

```text
Local/Test
Production
```

Nunca utilizar credenciais de produção em testes locais normais.

Variáveis conceituais:

```text
MERCADOPAGO_PUBLIC_KEY
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
```

Valores reais não serão armazenados no Git.

---

## 7. Captura de cartão

Quando cartões forem oferecidos, a L'Essenc deverá evitar manipulação direta desnecessária de dados brutos de cartão.

A direção técnica será utilizar MercadoPago.js, Checkout Bricks ou mecanismo oficial equivalente aprovado para produzir um token de pagamento no client-side.

O fluxo documentado atualmente pelo Mercado Pago é:

```text
Comprador
   ↓
componente Mercado Pago no frontend
   ↓
tokenização
   ↓
CardToken
   ↓
Backend L'Essenc
   ↓
API Mercado Pago
```

O Mercado Pago documenta que o token representa os dados de cartão de forma segura e que o backend utiliza esse token para criar o pagamento. citeturn484318search1turn484318search5

---

## 8. Dados de cartão

A L'Essenc não deverá armazenar:

```text
PAN completo
CVV
dados brutos de cartão
```

em:

- banco;
- logs;
- memória do projeto;
- arquivos;
- analytics;
- auditoria.

A arquitetura deverá reduzir a superfície PCI utilizando os componentes oficiais do provedor.

---

## 9. Criação interna antes do provedor

A operação financeira deverá nascer internamente.

Fluxo:

```text
Customer
   ↓
Order.CREATED
   ↓
Payment.CREATED
   ↓
MercadoPagoAdapter.createPayment()
```

Assim, mesmo que a API externa falhe, existe identidade interna para rastrear a tentativa.

---

## 10. Valor da cobrança

O valor enviado ao Mercado Pago deverá ser calculado ou confirmado pelo backend.

Nunca:

```text
frontend envia R$ 1,00
backend confia
```

O backend deverá utilizar:

```text
Order
+
OrderItem
+
regras comerciais vigentes
```

para determinar o valor autorizado.

---

## 11. Chave de idempotência de criação

Toda operação externa que possa produzir efeito financeiro deverá usar idempotência quando o Mercado Pago exigir ou suportar.

Para criação de pagamentos, a documentação atual exige o header:

```text
X-Idempotency-Key
```

para evitar execução duplicada em retries ou falhas de comunicação. citeturn934882search0turn934882search2

A L'Essenc deverá gerar e persistir a relação entre a intenção interna e a chave utilizada.

---

## 12. Formato da chave de idempotência

A implementação deverá preferir identificador aleatório forte, como UUID compatível com a API.

Exemplo conceitual:

```text
550e8400-e29b-41d4-a716-446655440000
```

A mesma intenção de criação deverá reutilizar a mesma chave durante um retry seguro.

Uma nova tentativa financeira legítima deverá receber uma nova identidade e nova chave.

---

## 13. Regra de retry na criação

Se houver:

```text
timeout
reset de conexão
resposta desconhecida
```

não assumir automaticamente que o pagamento não foi criado.

Fluxo:

```text
request enviada
      ↓
resultado desconhecido
      ↓
retry com MESMA idempotency key
```

Objetivo:

```text
1 intenção
=
no máximo 1 efeito financeiro
```

---

## 14. Identificador externo

Após criação válida, armazenar o identificador retornado pelo provedor separadamente:

```text
Payment.id                → ID interno
Payment.provider          → MERCADO_PAGO
Payment.providerPaymentId → ID externo
```

O ID externo nunca substituirá o ID interno.

---

## 15. Referência à operação interna

Quando a API adotada permitir referência externa, a L'Essenc deverá enviar identificador correlacionável do pedido ou pagamento interno.

Exemplo conceitual:

```text
external_reference = identificador seguro da Order
```

Essa referência é auxiliar.

A identificação final deverá combinar registros internos e dados retornados pelo provedor.

---

## 16. Resposta da criação

A resposta da API deverá ser traduzida pelo adapter.

Exemplo conceitual:

```text
Mercado Pago
status = ...
status_detail = ...
id = ...

        ↓

MercadoPagoAdapter

        ↓

PaymentProviderResult
{
  providerPaymentId
  normalizedStatus
  rawStatusReference
}
```

As camadas de domínio não deverão depender diretamente de strings específicas do Mercado Pago.

---

## 17. Normalização de estados

Estados externos serão mapeados para o modelo interno:

```text
CREATED
PENDING
PROCESSING
APPROVED
REJECTED
CANCELED
EXPIRED
REFUNDED
CHARGEBACK
```

O mapeamento exato entre estados atuais da API e estados internos deverá permanecer concentrado no `MercadoPagoAdapter`.

---

## 18. Estado desconhecido

Caso o Mercado Pago introduza ou retorne um estado não reconhecido:

```text
external status desconhecido
        ↓
não presumir aprovação
        ↓
registrar
        ↓
investigar/reconciliar
```

Regra:

> estado desconhecido nunca concede acesso.

---

## 19. Endpoint de webhook

A L'Essenc possuirá endpoint dedicado.

Exemplo conceitual:

```text
POST /api/webhooks/mercadopago
```

O endereço deverá ser HTTPS em ambientes externos.

O endpoint não utilizará autenticação de sessão do cliente.

Sua autenticidade será determinada pelo mecanismo próprio de assinatura do provedor.

---

## 20. Conteúdo da notificação

O Webhook não deverá ser tratado como representação completa e definitiva do pagamento.

O Mercado Pago envia notificações contendo o tipo do recurso e identificador associado; após o recebimento, a documentação orienta obter os dados completos consultando o endpoint correspondente. citeturn240982view3

Fluxo:

```text
Webhook
   ↓
identificar recurso
   ↓
validar origem
   ↓
consultar API Mercado Pago
   ↓
obter estado atual confiável
   ↓
normalizar
   ↓
aplicar transição
```

---

## 21. Validação de assinatura

As notificações Webhook atuais do Mercado Pago utilizam, entre outros elementos:

```text
x-signature
x-request-id
data.id
WEBHOOK SECRET
```

A documentação oficial fornece validadores nos SDKs para verificar a assinatura da notificação utilizando esses dados. citeturn240982view1

Notificação cuja validação falhe não poderá produzir efeitos financeiros internos.

---

## 22. Uso do SDK para assinatura

Quando o SDK oficial da versão adotada fornecer validador compatível, deverá ser preferido sobre implementação criptográfica caseira, salvo justificativa técnica documentada.

Exemplo conceitual:

```text
validateWebhookSignature(
    xSignature,
    xRequestId,
    dataId,
    secret
)
```

---

## 23. Falha de assinatura

Fluxo:

```text
Webhook
   ↓
assinatura inválida
   ↓
rejeitar
   ↓
não consultar como evento confiável
   ↓
não alterar Payment
   ↓
não criar Entitlement
```

Registrar apenas informações seguras necessárias ao diagnóstico.

---

## 24. Registro do evento

Após validação suficiente para aceitar o evento:

```text
PaymentEvent.RECEIVED
```

Deverão ser registrados dados mínimos úteis à:

- idempotência;
- correlação;
- auditoria;
- processamento;
- retry.

Não armazenar payload integral automaticamente se ele contiver informações sem necessidade operacional.

---

## 25. Idempotência de webhook

O mesmo evento poderá ser entregue várias vezes.

Portanto:

```text
Webhook #1
Webhook #2
Webhook #3
     │
     ▼
mesmo efeito lógico
```

O processamento deverá utilizar identificadores disponíveis, estado atual e restrições internas para impedir efeitos duplicados.

---

## 26. Resposta HTTP ao webhook

A documentação atual do Mercado Pago informa que o endpoint deve responder `200 OK` ou `201 CREATED` para confirmar o recebimento. O provedor possui mecanismo de novas tentativas quando essa confirmação não ocorre. citeturn240982view1

A L'Essenc não deverá depender do tempo máximo permitido pelo provedor para executar trabalho pesado.

---

## 27. Estratégia de confirmação rápida

Direção arquitetural:

```text
Webhook
   ↓
validar
   ↓
registrar evento durável
   ↓
responder sucesso
   ↓
processar efeito
```

quando a infraestrutura escolhida permitir processamento seguro posterior.

Caso o processamento permaneça síncrono no MVP, deverá ser curto, previsível e idempotente.

---

## 28. Retry do provedor

A política de retry do Mercado Pago é comportamento externo e poderá mudar.

A documentação atualmente informa timeout de confirmação e novas tentativas posteriores quando o endpoint não confirma o recebimento. citeturn240982view1

A arquitetura da L'Essenc não dependerá de intervalos específicos do provedor como garantia de negócio.

---

## 29. Consulta após webhook

Para notificações de pagamento, o backend deverá consultar o recurso correspondente na API do Mercado Pago antes de aplicar transições críticas quando essa for a estratégia prescrita pela integração adotada.

A documentação atual indica o endpoint de consulta de pagamento:

```text
GET /v1/payments/{ID}
```

para os fluxos compatíveis. citeturn240982view1

---

## 30. Pagamento aprovado

Somente após obtenção de estado financeiro confiável:

```text
Mercado Pago
     ↓
estado confirmado
     ↓
MercadoPagoAdapter
     ↓
APPROVED
```

poderá ocorrer:

```text
Payment.APPROVED
Order.PAID
Entitlement.ACTIVE
```

---

## 31. Regra de confiança

Não concedem acesso isoladamente:

```text
query string
redirect
return URL
frontend callback
analytics event
texto do navegador
Webhook não validado
```

A aprovação depende da camada server-side.

---

## 32. Concorrência webhook × reconciliação

É possível ocorrer:

```text
Webhook
   +
Reconciliation Job
```

simultaneamente.

Ambos deverão chamar a mesma camada:

```text
PaymentStateService
```

e não implementar lógica financeira independente.

---

## 33. Reconciliação

A aplicação deverá conseguir reconsultar pagamentos relevantes.

Objetivos:

- recuperar webhook perdido;
- corrigir estado local atrasado;
- identificar falha de processamento;
- detectar pagamento aprovado sem entitlement;
- investigar divergências.

---

## 34. Candidatos à reconciliação

Exemplos:

```text
Payment.PENDING por período anormal
Payment.PROCESSING por período anormal
PaymentEvent.FAILED
Order.PAID sem Entitlement
resultado de criação desconhecido
```

A política temporal definitiva será definida durante implementação/observabilidade.

---

## 35. Regra de reconciliação

Reconciliação deverá ser:

```text
consulta
→ normalização
→ máquina de estados
→ efeito idempotente
```

Nunca:

```text
consulta
→ UPDATE arbitrário no banco
```

---

## 36. Reembolso

Reembolsos originados no Mercado Pago deverão refletir no modelo interno após confirmação válida.

Fluxo:

```text
provedor
   ↓
REFUNDED
   ↓
Payment.REFUNDED
   ↓
Order.REFUNDED
   ↓
Entitlement.REVOKED
```

quando a política comercial aplicável determinar revogação.

Operações de reembolso iniciadas pela L'Essenc deverão utilizar idempotência quando exigida pela API.

---

## 37. Chargeback

Evento de chargeback confirmado deverá ser mapeado para:

```text
Payment.CHARGEBACK
```

e produzir os efeitos aprovados no `LES-FLOW-DIG-R01`, incluindo revogação de acesso quando aplicável.

---

## 38. Falhas da API

Falhas deverão ser classificadas conceitualmente em:

```text
erro de entrada
erro de autenticação
rate limit
indisponibilidade externa
timeout
falha de rede
erro interno do provedor
estado desconhecido
```

Nem todo erro deverá gerar retry automático.

---

## 39. Retry seguro

Retry automático deverá ser permitido somente quando:

```text
operação é idempotente
OR
existe chave de idempotência reutilizável
```

e a causa for compatível com retry.

Erros funcionais ou de validação não devem entrar em loop automático.

---

## 40. Backoff

Retries internos deverão adotar espera progressiva quando apropriado.

Exemplo conceitual:

```text
attempt 1
   ↓
espera
   ↓
attempt 2
   ↓
espera maior
   ↓
attempt 3
```

Adicionar jitter quando necessário para evitar sincronização de múltiplas tentativas.

---

## 41. Timeouts

Chamadas externas deverão possuir timeouts explícitos.

Nunca deixar requisição crítica dependente indefinidamente de resposta externa.

Timeout não significa automaticamente:

```text
pagamento não criado
```

Pode significar:

```text
resultado desconhecido
```

que deverá ser tratado com idempotência e reconciliação.

---

## 42. Circuit breaker

Não é requisito obrigatório da primeira implementação.

Entretanto, o adapter deverá permitir introdução futura de proteção contra cascata de falhas se indisponibilidades do provedor justificarem.

---

## 43. Logs

Logs da integração poderão conter:

```text
internalPaymentId
orderId
providerPaymentId
eventType
normalizedStatus
correlationId
request outcome
duration
```

Não deverão conter:

```text
Access Token
Webhook Secret
PAN
CVV
token de cartão completo
payload sensível indiscriminado
```

---

## 44. Correlação

Cada fluxo deverá permitir rastrear:

```text
Order.id
   ↓
Payment.id
   ↓
providerPaymentId
   ↓
PaymentEvent
   ↓
Entitlement
```

Um `correlationId` poderá acompanhar a operação técnica ponta a ponta.

---

## 45. Métricas

Métricas iniciais poderão incluir:

```text
payment_create_success
payment_create_failure
payment_pending
payment_approved
payment_rejected
webhook_received
webhook_invalid_signature
webhook_processed
webhook_failed
reconciliation_mismatch
entitlement_grant_failure
```

Métricas não deverão expor dados pessoais.

---

## 46. Alertas

Situações candidatas a alerta:

```text
aumento de falha na criação
aumento de assinatura inválida
fila de eventos falhos
pagamento aprovado sem entitlement
falha contínua na API externa
reconciliação com divergências
```

Os thresholds serão definidos no documento de observabilidade.

---

## 47. Ambientes de teste

Antes de produção, deverão ser validados:

```text
pagamento aprovado
pagamento pendente
pagamento rejeitado
evento duplicado
webhook inválido
timeout
retry
reconciliação
reembolso
revogação de entitlement
```

Utilizando recursos e credenciais de teste disponibilizados pelo provedor quando aplicáveis.

---

## 48. Promoção para produção

Nenhuma credencial de teste deverá ser reutilizada como produção.

Antes do go-live verificar:

```text
Access Token de produção
Public Key de produção
Webhook Secret de produção
URL de webhook de produção
HTTPS
variáveis de ambiente
logs sem segredos
testes críticos
rollback
```

---

## 49. Webhook por ambiente

Ambientes deverão possuir endpoints e segredos independentes sempre que a configuração do provedor permitir.

Exemplo:

```text
Test
https://test.../api/webhooks/mercadopago

Production
https://.../api/webhooks/mercadopago
```

Nunca permitir que evento de teste atualize banco de produção.

---

## 50. Interface conceitual

A camada de domínio deverá depender de contrato semelhante a:

```text
PaymentProvider

createPayment(input)
getPayment(providerPaymentId)
refundPayment(input)
normalizeStatus(providerResult)
validateWebhook(input)
```

A assinatura definitiva será estabelecida na implementação.

---

## 51. MercadoPagoAdapter

Responsabilidades:

- montar request externo;
- autenticar chamadas;
- aplicar `X-Idempotency-Key`;
- mapear respostas;
- consultar pagamentos;
- validar Webhooks;
- normalizar estados;
- traduzir erros externos;
- esconder peculiaridades do provedor.

Não é responsabilidade do adapter:

```text
criar Entitlement
decidir acesso
alterar Product
definir política de reembolso
```

Essas são regras do domínio.

---

## 52. PaymentService

Responsabilidades:

```text
criar tentativa interna
determinar valor autorizado
invocar provider
persistir resultado
coordenar máquina de estados
```

---

## 53. WebhookService

Responsabilidades:

```text
receber
validar
registrar
deduplicar
resolver recurso
consultar provedor
normalizar
aplicar transição
registrar resultado
```

---

## 54. ReconciliationService

Responsabilidades:

```text
selecionar candidatos
consultar provedor
comparar estado
aplicar máquina de estados
registrar divergência
```

---

## 55. Dependência de SDK

O SDK oficial poderá ser utilizado quando reduzir risco e manutenção, especialmente para recursos como validação de assinatura.

A adoção de versão específica deverá ocorrer com:

- versão fixada;
- revisão de changelog;
- testes;
- atualização controlada.

Não utilizar atualização automática irrestrita de dependência crítica de pagamento.

---

## 56. Mudanças da API

Detalhes externos sujeitos a mudança deverão permanecer isolados.

Exemplo:

```text
header
payload
nome de status
endpoint
SDK
regra de assinatura
```

Se o Mercado Pago alterar API futura:

```text
MercadoPagoAdapter muda
```

e não:

```text
todo domínio L'Essenc muda
```

---

## 57. Segurança de credenciais

O Access Token e Webhook Secret devem ser tratados como segredos de alta criticidade.

Devem existir procedimentos futuros para:

- armazenamento seguro;
- rotação;
- revogação;
- substituição;
- resposta a exposição.

Nunca registrar o valor em documentação ou memória.

---

## 58. Rotação do webhook secret

A arquitetura deverá permitir troca do segredo sem reconstrução da aplicação.

A documentação atual do Mercado Pago permite redefinir a assinatura secreta da aplicação; portanto, o segredo será tratado como configuração externa rotacionável. citeturn240982view3

---

## 59. Critério de segurança financeira

O sistema deverá permanecer seguro mesmo se um atacante conhecer:

```text
Order ID
Payment ID externo
URL /obrigado
estrutura do frontend
```

Nenhum desses elementos isoladamente concede direito de acesso.

---

## 60. Critérios de aceite

O `LES-INT-MP-R01` estará apto para aprovação quando:

- Mercado Pago estiver encapsulado por adapter;
- Access Token estiver restrito ao backend;
- dados brutos de cartão não forem persistidos pela L'Essenc;
- valor financeiro for determinado pelo backend;
- criação de pagamento utilizar idempotência;
- identificadores externos forem separados dos internos;
- Webhooks forem autenticados;
- eventos duplicados forem seguros;
- estado completo puder ser consultado na API;
- estados externos forem normalizados;
- estado desconhecido nunca liberar acesso;
- retries forem idempotentes;
- timeout não significar rejeição automática;
- reconciliação estiver prevista;
- reembolso e chargeback utilizarem a máquina de estados;
- logs não exponham segredos;
- ambientes de teste e produção estiverem separados;
- regras de negócio não dependerem diretamente do SDK do Mercado Pago.

---

## 61. Decisão de integração central

A L'Essenc tratará o Mercado Pago como **processador financeiro externo**, não como seu domínio de negócio.

O fluxo será:

```text
Order L'Essenc
      ↓
Payment L'Essenc
      ↓
MercadoPagoAdapter
      ↓
Mercado Pago
      ↓
Webhook / Consulta
      ↓
MercadoPagoAdapter
      ↓
PaymentStateService
      ↓
Order / Payment / Entitlement
```

O resultado comercial jamais será determinado apenas pelo retorno do navegador.

A combinação obrigatória será:

```text
idempotência
+
validação server-side
+
assinatura de webhook
+
consulta do recurso
+
máquina de estados
+
reconciliação
+
auditoria
```

para proteger receita, acesso e consistência operacional.
