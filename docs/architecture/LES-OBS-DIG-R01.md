# LES-OBS-DIG-R01 — Observabilidade, Logs, Métricas e Alertas da L'Essenc Digital

**Projeto:** L'Essenc Digital
**Documento:** LES-OBS-DIG-R01
**Revisão:** R01
**Status:** Aprovado
**Data:** 11/09/2026
**Fase:** MVP-ARCH-01 — Arquitetura técnica do MVP

---

## 1. Objetivo

Este documento define a arquitetura de observabilidade da L'Essenc Digital.

A plataforma deverá permitir detectar, diagnosticar e investigar:

- falhas de aplicação;
- erros de pagamento;
- inconsistências financeiras;
- falhas de webhook;
- falhas de entitlement;
- falhas de entrega digital;
- problemas de autenticação;
- incidentes de segurança;
- degradação de desempenho;
- indisponibilidade de dependências externas;
- erros administrativos;
- problemas de infraestrutura.

Observabilidade será requisito de arquitetura e não uma funcionalidade adicionada somente após incidentes.

---

## 2. Princípio central

A plataforma deverá conseguir responder:

```text
O que aconteceu?
Quando aconteceu?
Onde aconteceu?
Qual usuário/operação foi afetado?
Qual componente falhou?
Qual foi o impacto?
O sistema se recuperou?
É necessária intervenção?
```

A observabilidade será construída sobre quatro sinais principais:

```text
Logs
Métricas
Traces
Eventos/Auditoria
```

---

## 3. Separação conceitual

Os seguintes conceitos não serão tratados como equivalentes:

```text
Log técnico
≠
AuditEvent
≠
Métrica
≠
Analytics
≠
Trace
```

Cada mecanismo possui finalidade específica.

---

## 4. Logs técnicos

Logs técnicos registram comportamento operacional da aplicação.

Exemplos:

```text
request recebida
pagamento iniciado
webhook recebido
consulta externa falhou
entrega gerada
erro inesperado
```

Não constituem necessariamente evidência formal de auditoria.

---

## 5. AuditEvent

`AuditEvent` registra operações relevantes para:

```text
segurança
administração
integridade financeira
controle de acesso
investigação
```

Exemplos:

```text
admin revogou entitlement
admin reemitiu entrega
role alterada
pagamento reembolsado
produto ativado
```

Auditoria possui requisitos de retenção e integridade superiores aos logs comuns.

---

## 6. Métricas

Métricas representam valores agregáveis.

Exemplos:

```text
payment_approved_total
webhook_failed_total
http_request_duration
delivery_failed_total
active_entitlements
```

Métricas deverão evitar dados pessoais em labels.

---

## 7. Tracing

Tracing poderá ser adotado para acompanhar uma operação entre componentes.

Exemplo:

```text
HTTP Request
   ↓
OrderService
   ↓
PaymentService
   ↓
MercadoPagoAdapter
   ↓
Database
```

Cada etapa poderá produzir um span correlacionado.

---

## 8. Correlation ID

Toda operação relevante deverá possuir `correlationId`.

Exemplo:

```text
correlationId:
01J7ABC...
```

Esse identificador deverá acompanhar, quando aplicável:

```text
HTTP request
Order
Payment
PaymentEvent
Webhook
Entitlement
Delivery
AuditEvent
```

---

## 9. Request ID

Cada requisição HTTP poderá possuir identificador próprio:

```text
requestId
```

Relação:

```text
correlationId
   ├── requestId A
   ├── requestId B
   └── requestId C
```

Uma mesma operação de negócio poderá envolver várias requisições.

---

## 10. IDs de negócio

Logs deverão priorizar identificadores estruturados.

Exemplo:

```text
orderId
paymentId
providerPaymentId
customerId
entitlementId
deliveryId
paymentEventId
```

Evitar depender de texto livre para correlacionar operações.

---

## 11. Logs estruturados

Produção deverá utilizar logs estruturados.

Formato conceitual:

```json
{
  "timestamp": "...",
  "level": "info",
  "event": "payment.approved",
  "correlationId": "...",
  "orderId": "...",
  "paymentId": "...",
  "provider": "MERCADO_PAGO"
}
```

Logs puramente textuais deverão ser evitados para eventos críticos.

---

## 12. Níveis de log

Níveis iniciais:

```text
DEBUG
INFO
WARN
ERROR
FATAL
```

Produção não deverá utilizar `DEBUG` indiscriminadamente.

---

## 13. DEBUG

Usado para diagnóstico técnico local ou temporário.

Não deverá registrar:

```text
segredos
senhas
tokens
dados completos de cartão
payloads sensíveis
```

Mesmo em desenvolvimento.

---

## 14. INFO

Usado para eventos operacionais esperados.

Exemplos:

```text
order.created
payment.created
payment.approved
entitlement.granted
delivery.issued
```

---

## 15. WARN

Eventos anormais mas recuperáveis.

Exemplos:

```text
provider.timeout
webhook.duplicate
payment.reconciliation_mismatch
delivery.retry
rate_limit.triggered
```

---

## 16. ERROR

Falhas que impedem conclusão de operação esperada.

Exemplos:

```text
payment.create_failed
webhook.processing_failed
entitlement.grant_failed
delivery.failed
database.operation_failed
```

---

## 17. FATAL

Falha grave que compromete execução da aplicação ou componente essencial.

Exemplos:

```text
startup configuration invalid
database unavailable at boot
critical secret missing
```

---

## 18. Convenção de eventos

Eventos deverão possuir nomes estáveis.

Preferência:

```text
domain.action
```

Exemplos:

```text
order.created
payment.approved
payment.rejected
webhook.received
webhook.invalid_signature
entitlement.revoked
delivery.failed
admin.login_failed
```

---

## 19. Logs proibidos

Nunca registrar:

```text
senha
CVV
PAN completo
Access Token
Webhook Secret
token de sessão
reset token
chave privada
DATABASE_URL completa
token de download
```

---

## 20. Dados pessoais em logs

Dados pessoais deverão ser minimizados.

Evitar:

```text
email completo
telefone completo
nome completo
```

quando identificadores internos forem suficientes.

Se necessário, mascarar.

Exemplo:

```text
ma***@email.com
```

---

## 21. Payloads externos

Payloads completos do Mercado Pago não deverão ser registrados automaticamente.

Preferir:

```text
providerEventId
providerPaymentId
eventType
normalizedStatus
statusDetail seguro
```

---

## 22. Mensagens de erro

Erros deverão ser registrados de forma útil sem vazar informação.

Exemplo:

```text
event: payment.provider_timeout
provider: MERCADO_PAGO
paymentId: internal-id
durationMs: 3010
```

Em vez de despejar headers e credenciais.

---

## 23. Stack traces

Stack traces poderão ser registrados internamente em erros inesperados.

Não deverão ser enviados ao usuário final.

---

## 24. Métricas HTTP

Métricas iniciais:

```text
http_requests_total
http_request_duration_ms
http_errors_total
```

Dimensões permitidas:

```text
method
route normalizada
status class
environment
```

---

## 25. Cardinalidade

Labels de métricas não deverão incluir:

```text
customerId
orderId
paymentId
email
token
```

Esses campos geram cardinalidade excessiva.

Detalhes individuais pertencem a logs/traces.

---

## 26. Métricas de pedido

```text
orders_created_total
orders_paid_total
orders_expired_total
orders_canceled_total
orders_refunded_total
```

---

## 27. Métricas de pagamento

```text
payments_created_total
payments_pending_total
payments_approved_total
payments_rejected_total
payments_expired_total
payments_refunded_total
payments_chargeback_total
payment_create_failures_total
```

---

## 28. Taxa de aprovação

Indicador derivado:

```text
payments_approved
-----------------
payment_attempts
```

Deverá ser analisado por período.

---

## 29. Métricas de webhook

```text
webhooks_received_total
webhooks_valid_total
webhooks_invalid_signature_total
webhooks_duplicate_total
webhooks_processed_total
webhooks_failed_total
webhook_processing_duration_ms
```

---

## 30. Métricas de reconciliação

```text
reconciliation_runs_total
reconciliation_checked_total
reconciliation_mismatches_total
reconciliation_fixed_total
reconciliation_failed_total
```

---

## 31. Métricas de entitlement

```text
entitlements_granted_total
entitlements_revoked_total
entitlements_expired_total
entitlement_grant_failures_total
```

---

## 32. Métricas de entrega

```text
deliveries_issued_total
deliveries_accessed_total
deliveries_expired_total
deliveries_revoked_total
deliveries_failed_total
delivery_reissue_total
```

---

## 33. Métricas administrativas

```text
admin_login_success_total
admin_login_failure_total
admin_mfa_failure_total
admin_actions_denied_total
admin_critical_actions_total
```

---

## 34. Métricas de segurança

```text
authorization_denied_total
rate_limit_triggered_total
invalid_input_total
webhook_invalid_signature_total
security_event_total
```

---

## 35. Métricas de infraestrutura

Quando disponíveis:

```text
CPU
memória
disco
database connections
database latency
process uptime
event loop lag
```

---

## 36. Banco de dados

Monitorar:

```text
query duration
connection failures
pool saturation
migration failures
deadlocks quando disponíveis
```

Queries individuais sensíveis não deverão ser registradas com valores pessoais.

---

## 37. Dependências externas

Mercado Pago deverá possuir métricas de:

```text
request_total
success_total
failure_total
timeout_total
duration_ms
```

---

## 38. Storage

Monitorar:

```text
upload success
upload failure
download generation failure
storage latency
asset unavailable
```

---

## 39. Health check

A aplicação deverá possuir health endpoint.

Exemplo conceitual:

```text
GET /api/health
```

Resposta simples:

```json
{
  "status": "ok"
}
```

Não deverá expor informações sensíveis.

---

## 40. Liveness

Liveness indica se o processo está ativo.

Exemplo:

```text
process running
event loop operational
```

Não precisa verificar todas as dependências externas.

---

## 41. Readiness

Readiness indica se a aplicação está pronta para atender tráfego.

Poderá considerar:

```text
configuração válida
banco acessível
componentes essenciais prontos
```

---

## 42. Health público

Endpoint público deverá retornar informação mínima.

Nunca expor:

```text
versão detalhada de dependências
credenciais
host interno
stack
DATABASE_URL
configurações
```

---

## 43. Health interno

Uma visão administrativa interna poderá conter mais detalhes:

```text
Database: OK
Mercado Pago: OK
Storage: OK
```

mas continuará sem segredos.

---

## 44. Availability

A aplicação deverá monitorar disponibilidade.

Indicadores:

```text
uptime
request success rate
error rate
```

---

## 45. Latência

Métricas importantes:

```text
p50
p95
p99
```

para:

```text
HTTP requests
pagamento
webhook
queries críticas
entrega
```

---

## 46. Error rate

Taxa de erro poderá ser medida por:

```text
5xx / total requests
```

e também por domínios críticos.

---

## 47. SLI

Indicadores iniciais de serviço poderão incluir:

```text
availability
latency
payment processing success
webhook processing success
delivery success
```

---

## 48. SLO

SLOs formais poderão ser definidos após existir baseline real de operação.

O MVP não deverá inventar metas sem dados.

---

## 49. Alertas

Alertas deverão representar condições que exigem atenção.

Não criar alerta para todo log.

---

## 50. Severidades de alerta

Inicialmente:

```text
INFO
WARNING
CRITICAL
```

---

## 51. Alerta crítico

Exemplos:

```text
site indisponível
database indisponível
pagamentos falhando em massa
payment APPROVED sem entitlement
webhook completamente indisponível
storage indisponível
credencial crítica inválida
```

---

## 52. Alerta warning

Exemplos:

```text
aumento de rejeições
timeouts externos
fila de falhas de delivery
reconciliation mismatch
múltiplos logins administrativos falhos
```

---

## 53. Alert fatigue

Alertas deverão evitar excesso de ruído.

Regra:

> alerta deve representar uma condição acionável.

Eventos informativos pertencem a dashboard ou logs.

---

## 54. Deduplicação de alertas

A mesma causa não deverá gerar centenas de notificações idênticas.

Agrupar por:

```text
componente
tipo de erro
janela temporal
```

---

## 55. Cooldown

Alertas poderão possuir cooldown.

Exemplo:

```text
1 alerta crítico
+
atualização posterior
```

em vez de uma notificação por request.

---

## 56. Alertas financeiros

Prioridades:

```text
pagamento aprovado sem Order.PAID
Order.PAID sem Entitlement
Entitlement criado sem Payment.APPROVED
refund sem revogação correspondente
chargeback sem revogação correspondente
```

Esses representam violações de invariantes.

---

## 57. Invariantes monitoradas

Exemplos:

```text
Payment.APPROVED
→ Order.PAID

Order.PAID
→ Entitlement esperado

Entitlement.ACTIVE
→ origem válida

Delivery.ISSUED
→ Entitlement.ACTIVE
```

---

## 58. Detectores de inconsistência

A plataforma deverá possuir consultas ou jobs capazes de identificar:

```text
pagamento aprovado sem entitlement
entitlement sem pagamento/origem válida
delivery ativa para entitlement revogado
PaymentEvent FAILED
pedido pendente por tempo anormal
```

---

## 59. Reconciliação observável

Cada execução de reconciliação deverá registrar:

```text
start
quantidade analisada
divergências
correções
falhas
duration
end
```

---

## 60. Monitoramento de webhook

Dashboard interno poderá exibir:

```text
último webhook recebido
taxa de sucesso
falhas recentes
assinaturas inválidas
duplicados
latência
```

---

## 61. Monitoramento de entregas

Painel poderá mostrar:

```text
deliveries emitidas
falhas
retries
reemitidas
acessadas
```

---

## 62. Monitoramento de autenticação

Acompanhar:

```text
login success
login failure
MFA failure
account disabled
authorization denied
session revoked
```

---

## 63. Detecção básica de abuso

Sinais:

```text
muitos logins falhos
muitos 403
muitos 429
muitas requisições de delivery
muitos webhooks inválidos
```

Não implica automaticamente ataque confirmado.

---

## 64. Retenção de logs

Logs não deverão ser armazenados indefinidamente sem política.

Política inicial deverá diferenciar:

```text
logs operacionais
logs de segurança
AuditEvents
```

Prazo definitivo será definido conforme infraestrutura, custos e obrigações aplicáveis.

---

## 65. Rotação

Arquivos locais de log, quando existirem, deverão possuir rotação.

Nunca permitir crescimento ilimitado em disco.

---

## 66. Ambiente local

Local poderá usar saída console legível.

Exemplo:

```text
INFO payment.created orderId=...
```

Sem necessidade de infraestrutura completa de observabilidade.

---

## 67. Ambiente de teste

Test deverá permitir validar:

```text
logs estruturados
métricas
alertas
correlationId
health checks
```

antes de produção.

---

## 68. Produção

Produção deverá priorizar formato estruturado e coleta centralizada quando suportado pela infraestrutura escolhida.

---

## 69. Provider-neutral

A arquitetura de observabilidade deverá evitar acoplamento rígido a fornecedor.

Aplicação deverá produzir sinais padronizados.

Exemplo conceitual:

```text
Application
   ↓
Observability abstraction
   ↓
Provider atual
```

---

## 70. OpenTelemetry

OpenTelemetry poderá ser adotado como padrão para:

```text
traces
metrics
context propagation
```

quando a implementação justificar.

Não é obrigatório introduzir toda a stack no primeiro commit do MVP.

---

## 71. Instrumentação progressiva

Prioridade:

```text
1. logs estruturados
2. correlation IDs
3. métricas críticas
4. health checks
5. alertas
6. tracing distribuído
```

Isso evita complexidade prematura.

---

## 72. Dashboard operacional

O painel administrativo poderá incluir resumo:

```text
Aplicação: saudável
Banco: saudável
Pagamentos: operacional
Webhooks: operacional
Storage: operacional
```

---

## 73. Dashboard financeiro operacional

Indicadores:

```text
pagamentos aprovados
pendentes
rejeitados
timeouts
refunds
chargebacks
```

Não substitui relatório contábil.

---

## 74. Dashboard de segurança

Para OWNER, futuramente:

```text
login failures
MFA failures
rate limits
webhooks inválidos
authorization denied
```

---

## 75. Dashboard técnico

Poderá conter:

```text
5xx rate
latência
database latency
external API latency
delivery failures
```

---

## 76. Trace financeiro

Operação crítica deverá poder ser reconstruída:

```text
checkout
→ Order
→ Payment
→ request Mercado Pago
→ webhook
→ PaymentEvent
→ Payment approved
→ Entitlement
→ Delivery
```

---

## 77. Trace administrativo

Ação crítica:

```text
Admin
→ requestId
→ authorization
→ domain command
→ database
→ AuditEvent
→ response
```

---

## 78. Logs de deployment

Deploy deverá registrar:

```text
version/commit
timestamp
environment
result
```

Nunca segredos.

---

## 79. Identificação de versão

A aplicação em produção deverá permitir identificar o commit ou release ativo internamente.

Exemplo:

```text
APP_VERSION=a2145fd...
```

Sem necessidade de expor publicamente detalhes excessivos.

---

## 80. Relação erro × deploy

Observabilidade deverá permitir descobrir:

```text
erro aumentou após versão X?
```

---

## 81. Feature flags

Mudanças de feature flag deverão gerar auditoria quando afetarem comportamento crítico.

---

## 82. Jobs

Jobs futuros deverão registrar:

```text
job.started
job.completed
job.failed
duration
recordsProcessed
```

Exemplos:

```text
reconciliation
cleanup
expiration
```

---

## 83. Cron jobs

Falha silenciosa de cron não será aceitável.

Sistema deverá saber:

```text
última execução
último sucesso
última falha
```

---

## 84. Métricas de negócio

Podem incluir:

```text
revenue_confirmed
orders_paid
conversion
average_ticket
refund_rate
chargeback_rate
```

Sempre calculadas a partir de dados confiáveis.

---

## 85. Analytics de marketing

Analytics comercial será separado da observabilidade.

Exemplo:

```text
Meta Pixel
≠
métrica financeira oficial
```

---

## 86. Receita oficial

Receita apresentada no administrativo deverá derivar de:

```text
Payment.APPROVED
+
regras financeiras internas
```

e considerar refunds/chargebacks conforme indicador.

---

## 87. Privacidade

Observabilidade deverá seguir minimização de dados.

Uma plataforma de logs não deverá se transformar em cópia paralela do banco de clientes.

---

## 88. Acesso à observabilidade

Acesso a logs, dashboards e alertas deverá possuir autorização.

Logs podem conter metadados operacionais sensíveis mesmo sem segredos.

---

## 89. OWNER

Poderá acessar:

```text
dashboards completos
alertas
auditoria
saúde operacional
```

---

## 90. ADMIN

Poderá acessar observabilidade operacional necessária.

Não necessariamente detalhes internos de infraestrutura ou segurança.

---

## 91. SUPPORT

Acesso limitado a informações necessárias para suporte.

Exemplo:

```text
status do pedido
falha de entrega
timeline
```

Não deverá possuir acesso amplo a logs técnicos.

---

## 92. Resposta a incidentes

Observabilidade deverá auxiliar:

```text
detecção
triagem
contenção
investigação
recuperação
post-mortem
```

---

## 93. Evidências

Durante incidente, deverão ser preservados:

```text
correlationIds
AuditEvents
logs relevantes
timestamps
versão da aplicação
```

sem alterar evidência desnecessariamente.

---

## 94. Clock

Servidores deverão utilizar horário consistente.

Banco e logs deverão trabalhar preferencialmente em:

```text
UTC
```

Interface poderá converter para timezone operacional.

---

## 95. Formato temporal

Preferência:

```text
ISO 8601
```

Exemplo:

```text
2026-09-11T23:15:30.123Z
```

---

## 96. Monotonicidade

Duração de operações deverá utilizar mecanismos de relógio apropriados quando disponíveis, evitando erros causados por ajuste de horário do sistema.

---

## 97. PII redaction

Camada de logging deverá permitir redaction.

Exemplo:

```text
authorization
cookie
set-cookie
access_token
password
secret
```

deverão ser filtrados.

---

## 98. Error fingerprinting

Erros semelhantes poderão ser agrupados por fingerprint.

Objetivo:

```text
100 ocorrências
→ 1 problema conhecido
```

facilitando investigação.

---

## 99. Alertas externos

A escolha final de canal poderá incluir:

```text
email
push
mensageria
dashboard
```

Será definida conforme ferramentas disponíveis.

---

## 100. Dependência do provedor de monitoramento

Falha da ferramenta de observabilidade não poderá derrubar a aplicação principal.

Fluxo:

```text
app
→ tenta emitir telemetria
→ provedor indisponível
→ app continua operando quando seguro
```

---

## 101. Backpressure de logs

Logging não deverá bloquear operações críticas indefinidamente.

---

## 102. Sampling

Tracing poderá utilizar sampling se volume justificar.

Eventos financeiros críticos deverão manter rastreabilidade suficiente mesmo com sampling.

---

## 103. Testes de observabilidade

Testes deverão verificar:

```text
correlationId criado
segredos não logados
erros registrados
métricas incrementadas
health check correto
AuditEvent criado
```

---

## 104. Teste de segredo

Pipeline futuro deverá verificar que:

```text
Access Token
Webhook Secret
DATABASE_URL
```

não aparecem em logs de teste.

---

## 105. Testes de falhas

Simular:

```text
Mercado Pago timeout
database failure
storage failure
webhook inválido
entitlement failure
delivery failure
```

e verificar os sinais gerados.

---

## 106. Falha silenciosa

Uma falha crítica que não gere nenhum sinal de observabilidade será considerada defeito.

---

## 107. Definition of Done

Funcionalidade crítica não estará concluída sem:

```text
logs apropriados
erros tratados
correlationId
métricas aplicáveis
auditoria quando necessária
```

---

## 108. Critérios de aceite

O `LES-OBS-DIG-R01` estará apto para aprovação quando:

- logs estruturados estiverem previstos;
- níveis de log estiverem definidos;
- segredos forem proibidos em logs;
- dados pessoais forem minimizados;
- correlationId estiver definido;
- requestId estiver previsto;
- métricas HTTP estiverem definidas;
- métricas financeiras estiverem definidas;
- métricas de webhook estiverem definidas;
- métricas de entitlement e delivery estiverem definidas;
- health checks estiverem previstos;
- alertas críticos estiverem definidos;
- invariantes financeiras forem monitoráveis;
- reconciliação for observável;
- falhas administrativas forem rastreáveis;
- observabilidade estiver separada de analytics;
- acesso aos sinais possuir controle;
- observabilidade auxiliar resposta a incidentes;
- instrumentação puder evoluir sem acoplamento rígido a fornecedor.

---

## 109. Decisão central de observabilidade

A L'Essenc Digital deverá operar de forma que falhas críticas não sejam invisíveis.

A cadeia conceitual será:

```text
Operação
   ↓
correlationId
   ↓
logs estruturados
   ↓
métricas
   ↓
auditoria quando aplicável
   ↓
alerta se necessário
   ↓
investigação
   ↓
recuperação
```

A plataforma deverá permitir diferenciar:

```text
erro isolado
degradação
falha sistêmica
inconsistência financeira
incidente de segurança
```

sem depender exclusivamente de reclamações de clientes para descobrir problemas.
