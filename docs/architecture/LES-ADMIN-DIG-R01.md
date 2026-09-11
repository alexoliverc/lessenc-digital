# LES-ADMIN-DIG-R01 — Arquitetura do Painel Administrativo da L'Essenc Digital

**Projeto:** L'Essenc Digital
**Documento:** LES-ADMIN-DIG-R01
**Revisão:** R01
**Status:** Aprovado
**Data:** 11/09/2026
**Fase:** MVP-ARCH-01 — Arquitetura técnica do MVP

---

## 1. Objetivo

Este documento define a arquitetura funcional, operacional e de segurança do painel administrativo da L'Essenc Digital.

O painel será o cockpit operacional da plataforma e deverá permitir:

- acompanhar vendas;
- administrar produtos;
- consultar pedidos;
- acompanhar pagamentos;
- consultar clientes;
- gerenciar acesso aos produtos digitais;
- acompanhar entregas;
- visualizar indicadores;
- consultar eventos de auditoria;
- executar ações administrativas autorizadas.

O painel não deverá permitir alterações arbitrárias que quebrem as regras financeiras, de segurança ou de acesso definidas nos documentos anteriores.

---

## 2. Princípio central

O painel administrativo será uma interface sobre regras de domínio já existentes.

Nunca:

```text
Admin UI
   ↓
UPDATE direto no banco
```

O fluxo correto será:

```text
Admin UI
   ↓
Admin API
   ↓
Autenticação
   ↓
Autorização
   ↓
Regra de domínio
   ↓
Persistência
   ↓
AuditEvent
```

---

## 3. Autoridade do painel

O painel poderá solicitar operações.

Ele não será a autoridade final sobre:

- pagamento;
- entitlement;
- reembolso;
- chargeback;
- autorização;
- integridade financeira.

A autoridade continuará no backend.

---

## 4. Áreas principais

O MVP administrativo possuirá:

```text
Dashboard
Produtos
Pedidos
Pagamentos
Clientes
Acessos
Entregas
Auditoria
Configurações
Conta
```

Módulos poderão ser expandidos posteriormente.

---

## 5. Navegação principal

Estrutura conceitual:

```text
Admin
├── Dashboard
├── Produtos
├── Pedidos
├── Pagamentos
├── Clientes
├── Acessos
├── Entregas
├── Auditoria
├── Configurações
└── Minha conta
```

A navegação exibida deverá respeitar as permissões do usuário autenticado.

---

## 6. Dashboard

O dashboard deverá apresentar visão operacional resumida.

Indicadores iniciais:

```text
vendas hoje
vendas período
receita bruta
pedidos pagos
pagamentos pendentes
pagamentos rejeitados
reembolsos
chargebacks
entitlements ativos
falhas de entrega
```

---

## 7. Dashboard não financeiro-contábil

Indicadores serão operacionais.

O painel não será tratado inicialmente como:

```text
ERP
contabilidade
conciliação bancária completa
sistema fiscal
```

Esses domínios poderão ser integrados futuramente.

---

## 8. Filtros de período

Dashboard deverá permitir períodos como:

```text
Hoje
Ontem
Últimos 7 dias
Últimos 30 dias
Mês atual
Período personalizado
```

Filtros deverão utilizar timezone definido pela operação, sem alterar timestamps armazenados em UTC.

---

## 9. Indicadores de conversão

Quando houver dados suficientes, poderão ser exibidos:

```text
visitas
inícios de checkout
pedidos criados
pagamentos aprovados
conversão
```

Analytics não será autoridade financeira.

A receita deverá ser baseada em dados internos confirmados.

---

## 10. Produtos

O módulo Produtos permitirá:

```text
listar
criar
visualizar
editar
ativar
desativar
arquivar
```

produtos digitais.

---

## 11. Lista de produtos

Campos esperados:

```text
nome
slug
status
preço
moeda
data de criação
data de atualização
```

Estados:

```text
DRAFT
ACTIVE
INACTIVE
ARCHIVED
```

---

## 12. Criação de produto

Criação deverá permitir inicialmente:

```text
nome
slug
descrição
preço
moeda
status
```

O produto deverá nascer como:

```text
DRAFT
```

salvo regra explicitamente aprovada.

---

## 13. Alteração de preço

Mudanças de preço terão efeito sobre futuras compras.

Nunca deverão alterar retrospectivamente:

```text
OrderItem.unitPrice
Order.total
Payment.amount
```

de pedidos históricos.

---

## 14. Ativação de produto

Produto poderá receber vendas somente quando:

```text
Product.status = ACTIVE
```

e possuir configuração operacional mínima necessária.

---

## 15. Arquivamento

Produto arquivado permanecerá no histórico.

Arquivar não deverá apagar:

```text
Orders
OrderItems
Payments
Entitlements
Deliveries
AuditEvents
```

---

## 16. Ativos digitais

Dentro do produto será possível visualizar ativos digitais associados.

Informações esperadas:

```text
nome lógico
status
tipo
tamanho
checksum quando disponível
data de criação
```

O caminho físico privado não deverá ser apresentado desnecessariamente.

---

## 17. Upload de conteúdo

Usuário autorizado poderá enviar novo arquivo.

O fluxo será:

```text
Admin
  ↓
Upload
  ↓
validação
  ↓
storage privado
  ↓
DigitalAsset
  ↓
AuditEvent
```

---

## 18. Substituição de ativo

Substituir conteúdo não deverá sobrescrever silenciosamente o histórico.

Preferência:

```text
novo DigitalAsset
+
desativar versão anterior
```

Isso permitirá rastreabilidade e rollback.

---

## 19. Pedidos

O módulo Pedidos permitirá consulta operacional.

Lista inicial:

```text
Order ID
cliente
status
valor
moeda
data
```

---

## 20. Filtros de pedidos

Filtros:

```text
ID
email
status
produto
período
valor
```

Pesquisa deverá possuir limites e paginação.

---

## 21. Detalhe do pedido

A tela deverá exibir:

```text
Order
Customer
OrderItems
Payments
Entitlements relacionados
Deliveries relacionadas
timeline
AuditEvents relevantes
```

---

## 22. Timeline do pedido

Exemplo:

```text
18:01 Pedido criado
18:02 Pagamento criado
18:03 Pagamento pendente
18:04 Webhook recebido
18:04 Pagamento aprovado
18:04 Pedido pago
18:04 Entitlement concedido
18:05 Entrega emitida
```

A timeline deverá derivar de eventos reais.

---

## 23. Alteração manual de pedido

O painel não deverá permitir edição livre do status.

Nunca:

```text
dropdown
Order = PAID
```

por decisão manual simples.

Ações excepcionais deverão passar por comando específico e auditado.

---

## 24. Pagamentos

Módulo Pagamentos permitirá observar:

```text
Payment ID interno
provider
providerPaymentId
Order ID
status interno
valor
método
data
```

---

## 25. Status financeiros

Estados poderão incluir:

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

Estados externos adicionais poderão aparecer apenas como informação técnica secundária.

---

## 26. Detalhe do pagamento

Exibir:

```text
ID interno
ID externo
pedido
cliente
valor
moeda
status
método
timestamps
PaymentEvents
reconciliation state
```

Sem exibir credenciais sensíveis.

---

## 27. Reconsulta ao provedor

Usuário autorizado poderá solicitar reconciliação manual.

Fluxo:

```text
Admin
  ↓
Reconciliar pagamento
  ↓
ReconciliationService
  ↓
Mercado Pago
  ↓
PaymentStateService
  ↓
resultado
```

A UI não altera estado diretamente.

---

## 28. Reembolso

Se reembolso iniciado pela plataforma for implementado, deverá exigir:

```text
permissão específica
+
confirmação explícita
+
motivo
+
reautenticação quando aplicável
```

Toda operação deverá gerar auditoria.

---

## 29. Confirmação de ação crítica

Operações críticas utilizarão confirmação reforçada.

Exemplo:

```text
Você está prestes a reembolsar R$39,90.

Esta ação poderá revogar o acesso do cliente.
```

O administrador deverá confirmar conscientemente.

---

## 30. Clientes

Lista de clientes:

```text
Customer ID
nome
email
data de criação
número de pedidos
número de acessos
```

Dados pessoais exibidos serão minimizados.

---

## 31. Detalhe do cliente

A tela poderá conter:

```text
dados básicos
pedidos
pagamentos
entitlements
deliveries
timeline operacional
```

Nunca exibir dados financeiros sensíveis desnecessários.

---

## 32. Busca por cliente

Busca poderá utilizar:

```text
email
nome
Customer ID
Order ID
```

Evitar mecanismos de busca excessivamente permissivos.

---

## 33. Exclusão de cliente

Exclusão física não será ação comum do painel.

Dados vinculados a:

```text
pagamentos
auditoria
pedidos
```

não deverão ser removidos de forma arbitrária.

Demandas de privacidade terão fluxo específico futuro.

---

## 34. Acessos

O módulo Acessos representará `Entitlement`.

Lista:

```text
cliente
produto
pedido
status
data de concessão
data de revogação
```

---

## 35. Estados de acesso

```text
ACTIVE
REVOKED
EXPIRED
```

A UI deverá apresentar claramente o motivo quando disponível.

---

## 36. Conceder acesso manual

Acesso manual não será operação comum.

Quando permitido:

```text
OWNER/ADMIN autorizado
      ↓
motivo obrigatório
      ↓
regra de domínio
      ↓
Entitlement
      ↓
AuditEvent
```

---

## 37. Revogar acesso

Operação deverá exigir:

```text
permissão
motivo
confirmação
auditoria
```

Após revogação:

```text
novas entregas = bloqueadas
entregas existentes = revogadas quando possível
```

---

## 38. Reativar acesso

Reativação será comando explícito.

Nunca:

```text
editar status na tabela
```

Fluxo:

```text
Admin autorizado
→ motivo
→ regra
→ ACTIVE
→ AuditEvent
```

---

## 39. Entregas

O módulo Entregas permitirá consulta de:

```text
Delivery ID
cliente
produto
Entitlement
status
issuedAt
accessedAt
expiresAt
```

---

## 40. Reemitir entrega

SUPPORT poderá possuir essa permissão quando:

```text
Entitlement = ACTIVE
```

Fluxo:

```text
SUPPORT
   ↓
Reemitir
   ↓
DeliveryService
   ↓
nova Delivery
   ↓
AuditEvent
```

---

## 41. Entitlement inválido

Se:

```text
REVOKED
EXPIRED
```

a ação padrão de reemissão deverá ser bloqueada.

---

## 42. Auditoria

O módulo Auditoria será somente leitura na operação normal.

Campos:

```text
timestamp
ator
ação
tipo do alvo
ID do alvo
resultado
correlationId
contexto seguro
```

---

## 43. Pesquisa de auditoria

Filtros:

```text
ator
ação
recurso
ID
período
resultado
```

Logs de auditoria não poderão ser apagados normalmente pelo painel.

---

## 44. Configurações

O módulo Configurações será restrito.

Poderá conter:

```text
configurações operacionais
integrações
parâmetros públicos
feature flags aprovadas
```

Segredos nunca serão exibidos integralmente.

---

## 45. Segredos no painel

Quando for necessário indicar uma configuração sensível:

```text
Mercado Pago
Access Token: configurado
Webhook Secret: configurado
```

Nunca:

```text
Access Token: APP_USR-123...
```

---

## 46. Roles

Papéis iniciais:

```text
OWNER
ADMIN
SUPPORT
```

---

## 47. OWNER

Possui maior nível administrativo.

Pode:

```text
gerenciar admins
gerenciar configurações críticas
gerenciar produtos
consultar financeiro
executar ações financeiras autorizadas
gerenciar acessos
consultar auditoria
```

---

## 48. ADMIN

Pode operar a plataforma sem possuir controle total de infraestrutura.

Exemplo:

```text
produtos
pedidos
pagamentos
clientes
acessos
entregas
indicadores
auditoria
```

Permissões finais serão definidas na implementação.

---

## 49. SUPPORT

Permissões reduzidas.

Exemplo:

```text
consultar pedido
consultar cliente
consultar acesso
consultar entrega
reemitir entrega quando permitido
```

Não poderá:

```text
alterar segredos
alterar usuários privilegiados
iniciar operações financeiras críticas
alterar arquitetura/configuração sensível
```

---

## 50. Matriz conceitual de permissões

```text
                         OWNER   ADMIN   SUPPORT

Dashboard                  ✓       ✓       ✓
Produtos                   ✓       ✓       leitura
Pedidos                    ✓       ✓       ✓
Pagamentos                 ✓       ✓       leitura
Clientes                   ✓       ✓       ✓
Acessos                    ✓       ✓       limitado
Entregas                   ✓       ✓       ✓
Auditoria                  ✓       ✓       limitado
Configurações críticas     ✓       —       —
Usuários administrativos  ✓       —       —
```

A matriz definitiva será codificada no backend.

---

## 51. Permissão server-side

Ocultar botão não constitui autorização.

Mesmo que a UI esconda:

```text
Reembolso
```

o endpoint deverá verificar:

```text
currentUser.permissions
```

antes de executar.

---

## 52. Gestão de administradores

Apenas `OWNER` poderá gerenciar contas administrativas no MVP.

Operações:

```text
convidar
ativar
desativar
alterar role
revogar sessões
```

---

## 53. Conta administrativa

Tela "Minha conta" poderá permitir:

```text
nome
email
MFA
senha
sessões
logout
```

Alterações sensíveis poderão exigir reautenticação.

---

## 54. Desativação de admin

Ao desativar:

```text
AdminUser.status = DISABLED
```

sessões ativas deverão ser invalidadas quando tecnicamente possível.

---

## 55. MFA

Status de MFA deverá ser visível para `OWNER`.

Exemplo:

```text
Alex Oliveira
Role: OWNER
MFA: ativo
```

Nunca exibir segredos ou seeds.

---

## 56. Sessões

O painel poderá futuramente permitir visualizar:

```text
sessões ativas
data
dispositivo aproximado
último uso
```

e revogá-las.

---

## 57. Alertas internos

O dashboard poderá apresentar alertas operacionais.

Exemplos:

```text
Pagamento aprovado sem entitlement
Falha de entrega
Webhook com falha
Reconciliação divergente
Produto sem asset ativo
```

---

## 58. Severidade

Alertas poderão usar:

```text
INFO
WARNING
CRITICAL
```

Sem depender apenas de cor para indicar severidade.

---

## 59. Paginação

Listas administrativas deverão utilizar paginação server-side.

Nunca carregar milhares de:

```text
Orders
Payments
Customers
AuditEvents
```

em uma única resposta.

---

## 60. Ordenação

Ordenação deverá utilizar campos permitidos.

Nunca aceitar coluna arbitrária enviada pelo cliente diretamente em query SQL.

---

## 61. Exportação

Exportação CSV poderá existir futuramente.

Caso implementada:

```text
permissão específica
limite de dados
auditoria
proteção contra CSV Injection
```

Dados pessoais deverão ser minimizados.

---

## 62. Datas

Banco continuará armazenando timestamps em UTC.

Painel converterá para timezone operacional configurado.

O timezone deverá ser mostrado ou inferido de forma consistente.

---

## 63. Moeda

Valores deverão ser exibidos como:

```text
R$ 39,90
```

mas continuar armazenados conforme regra de precisão definida em `LES-DATA-DIG-R01`.

---

## 64. Estados visuais

Estados deverão possuir representação consistente.

Exemplo:

```text
APPROVED
PENDING
REJECTED
REFUNDED
```

Não depender apenas de cores.

Texto e ícone deverão permanecer compreensíveis.

---

## 65. Busca global

Futuramente poderá existir busca por:

```text
Order ID
Payment ID
Customer ID
email
```

Não deverá pesquisar indiscriminadamente todas as tabelas.

---

## 66. Responsividade

O painel será prioritariamente desktop.

Deverá continuar funcional em tablet e dispositivos menores para operações básicas.

Operações complexas poderão priorizar desktop.

---

## 67. Acessibilidade

Interface deverá considerar:

```text
navegação por teclado
labels
contraste
foco visível
semântica HTML
mensagens de erro acessíveis
```

---

## 68. Performance

Telas administrativas deverão evitar queries N+1 e agregações custosas sem necessidade.

Indicadores pesados poderão utilizar:

```text
queries agregadas
cache
pré-cálculo
```

quando necessário.

---

## 69. Segurança de cache

Dados administrativos não deverão ser armazenados em cache público.

Rotas sensíveis deverão utilizar política de cache apropriada.

---

## 70. Analytics no admin

Analytics comercial de terceiros deverá ser desativado no painel por padrão.

Não há necessidade de enviar comportamento administrativo para pixels publicitários.

---

## 71. Erros

Mensagens administrativas poderão possuir mais contexto que as públicas, mas nunca expor:

```text
segredos
stack trace bruto
SQL
connection strings
```

Detalhes técnicos ficarão nos logs internos.

---

## 72. Estado vazio

Listas deverão possuir estados claros:

```text
Nenhum pedido encontrado.
Nenhum pagamento pendente.
Nenhuma falha de entrega.
```

Evitar telas vazias sem orientação.

---

## 73. Loading

Operações críticas deverão indicar processamento.

Botões deverão evitar duplo envio.

Exemplo:

```text
Reembolsando...
```

e não permitir segunda execução simultânea.

---

## 74. Operações idempotentes

Onde aplicável, comandos administrativos deverão ser idempotentes.

Exemplo:

```text
reemitir entrega
reconciliar pagamento
revogar acesso
```

deverão proteger contra duplo clique e retry de rede.

---

## 75. Confirmações destrutivas

Ações com impacto importante terão modal de confirmação.

Exemplo:

```text
Revogar acesso de maria@email.com ao produto X?

Motivo:
[________________]

[Cancelar] [Revogar acesso]
```

---

## 76. Motivos administrativos

Ações críticas poderão exigir motivo estruturado ou textual.

Exemplos:

```text
Solicitação do cliente
Reembolso
Fraude
Chargeback
Correção operacional
Outro
```

Motivo integra auditoria.

---

## 77. Feature flags

Funcionalidades incompletas poderão permanecer atrás de flag.

Flags críticas deverão ser server-side.

Nunca usar feature flag client-side como controle de segurança.

---

## 78. Observabilidade administrativa

Ações administrativas deverão produzir:

```text
log técnico
AuditEvent
correlationId
métrica quando aplicável
```

Isso permitirá investigar incidentes.

---

## 79. Integridade da auditoria

O mesmo usuário que executa uma ação não deverá possuir caminho normal para apagar o registro dessa ação.

---

## 80. Dashboard inicial do MVP

Primeira versão deverá priorizar:

```text
Receita hoje
Vendas hoje
Pedidos pagos
Pagamentos pendentes
Pagamentos rejeitados
Reembolsos
Falhas de entrega
Últimos pedidos
Alertas críticos
```

Evitar dashboards excessivamente complexos antes de existir volume real.

---

## 81. Últimos pedidos

Tabela resumida:

```text
Pedido
Cliente
Produto
Valor
Status
Horário
```

com acesso ao detalhe.

---

## 82. Indicadores futuros

Poderão ser adicionados:

```text
ticket médio
ROAS
CAC
LTV
taxa de aprovação
refund rate
chargeback rate
conversion rate
```

quando dados forem confiáveis.

---

## 83. Limites do MVP

Não fazem parte obrigatória da primeira versão:

```text
ERP
CRM completo
contabilidade
NF-e
help desk completo
marketing automation
BI avançado
multiempresa
multimoeda avançada
marketplace
multi-seller
```

A arquitetura não deverá impedir evolução futura.

---

## 84. Rotas conceituais

Exemplos:

```text
/admin
/admin/products
/admin/orders
/admin/payments
/admin/customers
/admin/entitlements
/admin/deliveries
/admin/audit
/admin/settings
```

Rotas são indicativas.

---

## 85. APIs conceituais

Exemplo:

```text
GET  /api/admin/orders
GET  /api/admin/orders/:id

GET  /api/admin/payments
POST /api/admin/payments/:id/reconcile

GET  /api/admin/entitlements
POST /api/admin/entitlements/:id/revoke

POST /api/admin/deliveries/reissue
```

Assinaturas finais serão definidas na implementação.

---

## 86. Arquitetura do frontend

Estrutura conceitual:

```text
src/app/admin
src/modules/admin
src/modules/orders
src/modules/payments
src/modules/customers
src/modules/entitlements
src/modules/deliveries
```

Lógica de domínio permanecerá fora dos componentes visuais.

---

## 87. Separação entre UI e domínio

Nunca:

```text
Button.onClick
→ prisma.order.update()
```

Correto:

```text
Button
→ API/Server Action autorizada
→ Service
→ Domain
→ Repository
```

---

## 88. Testes do painel

Deverão existir testes para:

```text
autenticação
RBAC
acesso negado
operações críticas
filtros
paginação
reembolso
revogação
reemissão
auditoria
```

---

## 89. Testes de autorização

Exemplo:

```text
SUPPORT
→ POST refund
→ 403
```

```text
ADMIN
→ reemitir entrega ACTIVE
→ sucesso
```

```text
ADMIN
→ reemitir entrega REVOKED
→ bloqueado
```

---

## 90. Critérios de aceite

O `LES-ADMIN-DIG-R01` estará apto para aprovação quando:

- dashboard possuir escopo definido;
- módulos administrativos estiverem definidos;
- produtos possuírem ciclo operacional;
- pedidos forem somente alteráveis por regras de domínio;
- pagamentos não puderem ser alterados arbitrariamente;
- clientes possuírem visão consolidada;
- entitlement possuir operação explícita;
- delivery possuir reemissão controlada;
- auditoria estiver disponível;
- roles e responsabilidades estiverem definidas;
- permissões forem verificadas server-side;
- ações críticas exigirem confirmação;
- segredos não forem expostos;
- operações críticas gerarem auditoria;
- paginação e filtros forem server-side;
- limites do MVP estiverem claros.

---

## 91. Decisão central do painel administrativo

O painel da L'Essenc Digital será uma ferramenta operacional segura sobre o domínio da plataforma.

Seu modelo será:

```text
Administrador
      ↓
Painel
      ↓
Autenticação
      ↓
Autorização
      ↓
Comando explícito
      ↓
Regra de domínio
      ↓
Persistência
      ↓
AuditEvent
      ↓
Feedback operacional
```

O painel não será um editor livre do banco de dados.

Essa decisão preservará:

```text
integridade financeira
segurança
auditabilidade
consistência
suporte operacional
capacidade de crescimento
```
