# LES-DATA-DIG-R01 — Modelo de Dados e Estados da L'Essenc Digital

**Projeto:** L'Essenc Digital
**Documento:** LES-DATA-DIG-R01
**Revisão:** R01
**Status:** Aprovado
**Data:** 11/09/2026
**Fase:** MVP-ARCH-01 — Arquitetura técnica do MVP

---

## 1. Objetivo

Este documento define o modelo lógico de dados e as principais máquinas de estado da primeira operação digital da L'Essenc.

Seu objetivo é estabelecer uma fonte de verdade consistente para:

- produtos;
- clientes;
- pedidos;
- itens de pedido;
- pagamentos;
- eventos financeiros;
- direitos de acesso;
- ativos digitais;
- entregas;
- usuários administrativos;
- auditoria.

Este documento não define ainda migrations, tipos SQL definitivos, índices físicos ou detalhes específicos de ORM.

---

## 2. Princípios do modelo

O modelo deverá obedecer aos seguintes princípios.

### 2.1 Separação entre pedido, pagamento e acesso

Os conceitos abaixo são independentes:

```text
Order
   │
   ▼
Payment
   │
   ▼
Entitlement
   │
   ▼
Delivery
```

Um pedido pode existir sem pagamento.

Um pagamento pode estar pendente sem gerar acesso.

Um pagamento aprovado pode gerar um direito de acesso.

O direito de acesso pode existir sem que o arquivo tenha sido baixado.

A entrega representa o mecanismo utilizado para disponibilizar o ativo ao cliente.

---

## 3. Identificadores

Entidades principais deverão possuir identificadores internos próprios.

Exemplo conceitual:

```text
Product.id
Customer.id
Order.id
Payment.id
Entitlement.id
DigitalAsset.id
Delivery.id
AdminUser.id
AuditEvent.id
```

IDs internos não deverão depender diretamente dos identificadores fornecidos pelo Mercado Pago.

Identificadores externos deverão ser armazenados separadamente.

Exemplo:

```text
Payment.id
Payment.provider
Payment.providerPaymentId
```

Isso evita que a identidade interna da L'Essenc fique acoplada ao provedor.

---

## 4. Product

Representa um produto comercializável.

### Campos conceituais

```text
Product
├── id
├── slug
├── name
├── description
├── status
├── currency
├── price
├── createdAt
└── updatedAt
```

### Estados

```text
DRAFT
ACTIVE
INACTIVE
ARCHIVED
```

### Regras

`DRAFT`

Produto em preparação e não comercializável.

`ACTIVE`

Produto disponível para novas compras.

`INACTIVE`

Produto temporariamente indisponível para novas compras.

`ARCHIVED`

Produto retirado da operação normal.

A desativação de um produto não deverá invalidar automaticamente direitos já concedidos a compradores anteriores.

---

## 5. Customer

Representa o comprador conhecido pela plataforma.

### Campos conceituais

```text
Customer
├── id
├── name
├── email
├── phone?
├── createdAt
└── updatedAt
```

Somente dados necessários à operação deverão ser armazenados.

CPF ou outros documentos não deverão ser coletados por padrão sem necessidade comercial, fiscal, antifraude ou regulatória documentada.

---

## 6. Order

Representa a intenção comercial criada pela L'Essenc.

### Campos conceituais

```text
Order
├── id
├── customerId
├── status
├── currency
├── subtotal
├── total
├── createdAt
├── updatedAt
└── completedAt?
```

O valor do pedido deverá ser calculado ou validado no backend.

Nunca deverá ser aceito como verdadeiro apenas o preço enviado pelo navegador.

---

## 7. Estados de Order

Estados iniciais:

```text
CREATED
PAYMENT_PENDING
PAID
CANCELED
EXPIRED
REFUNDED
```

Fluxo conceitual:

```text
CREATED
   │
   ▼
PAYMENT_PENDING
   │
   ├──────────────► EXPIRED
   │
   ├──────────────► CANCELED
   │
   ▼
PAID
   │
   ▼
REFUNDED
```

### CREATED

Pedido criado internamente.

Ainda pode não existir uma cobrança no provedor.

### PAYMENT_PENDING

Processo financeiro iniciado e aguardando definição.

### PAID

A plataforma possui confirmação válida de pagamento elegível.

### CANCELED

Pedido cancelado por regra interna ou processo comercial.

### EXPIRED

Pagamento não concluído dentro das regras ou prazo aplicável.

### REFUNDED

A compra paga foi posteriormente reembolsada.

O estado do pedido deverá ser derivado de regras internas e eventos financeiros válidos, e não simplesmente copiado de um texto do provedor.

---

## 8. OrderItem

Representa os produtos incluídos no pedido.

Mesmo que o MVP comercialize inicialmente apenas um produto por compra, o modelo deverá manter separação entre `Order` e `OrderItem`.

### Campos conceituais

```text
OrderItem
├── id
├── orderId
├── productId
├── productNameSnapshot
├── quantity
├── unitPrice
├── totalPrice
└── createdAt
```

O snapshot do nome e preço preserva o contexto histórico da compra caso o produto seja alterado futuramente.

---

## 9. Payment

Representa uma tentativa ou operação financeira associada a um pedido.

### Campos conceituais

```text
Payment
├── id
├── orderId
├── provider
├── providerPaymentId?
├── status
├── amount
├── currency
├── paymentMethod?
├── createdAt
├── updatedAt
└── approvedAt?
```

Fornecedor inicial:

```text
MERCADO_PAGO
```

A arquitetura deverá permitir outros provedores futuramente.

---

## 10. Estados de Payment

Estados internos iniciais:

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

Fluxo conceitual simplificado:

```text
CREATED
   │
   ▼
PENDING
   │
   ├────► PROCESSING
   │          │
   │          └────► APPROVED
   │
   ├────► APPROVED
   ├────► REJECTED
   ├────► CANCELED
   └────► EXPIRED

APPROVED
   │
   ├────► REFUNDED
   └────► CHARGEBACK
```

Nem todos os estados externos do Mercado Pago precisam ser reproduzidos literalmente.

Será criada uma camada de tradução:

```text
Mercado Pago status
        │
        ▼
Payment adapter
        │
        ▼
Estado interno L'Essenc
```

---

## 11. PaymentEvent

Registra eventos financeiros recebidos ou processados.

### Campos conceituais

```text
PaymentEvent
├── id
├── paymentId?
├── provider
├── providerEventId?
├── eventType
├── payloadHash?
├── processingStatus
├── receivedAt
├── processedAt?
└── errorCode?
```

O payload integral não deverá ser persistido automaticamente caso contenha dados desnecessários ou sensíveis.

---

## 12. Estados de processamento de PaymentEvent

```text
RECEIVED
PROCESSING
PROCESSED
IGNORED
FAILED
```

### RECEIVED

Evento recebido.

### PROCESSING

Evento em processamento.

### PROCESSED

Evento validado e aplicado.

### IGNORED

Evento conhecido, válido para recebimento, mas sem efeito sobre o estado atual.

Exemplo:

evento duplicado.

### FAILED

Falha de processamento que exige nova tentativa ou investigação.

---

## 13. Idempotência

Eventos externos poderão chegar:

- duplicados;
- fora de ordem;
- atrasados;
- simultaneamente.

A aplicação deverá garantir que processar o mesmo evento mais de uma vez não gere:

- múltiplos direitos de acesso;
- múltiplas entregas indevidas;
- múltiplas alterações inconsistentes;
- duplicação financeira interna.

Identificadores do provedor, hashes e regras de estado poderão ser utilizados para garantir idempotência.

---

## 14. Entitlement

`Entitlement` representa o direito de acesso concedido ao cliente.

É uma entidade central da arquitetura.

### Campos conceituais

```text
Entitlement
├── id
├── customerId
├── orderId
├── productId
├── status
├── grantedAt
├── revokedAt?
├── expiresAt?
└── createdAt
```

O direito de acesso deve ser criado somente por regra server-side.

---

## 15. Estados de Entitlement

```text
ACTIVE
REVOKED
EXPIRED
```

### ACTIVE

Cliente possui direito válido de acesso.

### REVOKED

Direito retirado.

Exemplos possíveis:

- reembolso;
- chargeback;
- fraude confirmada;
- decisão administrativa autorizada.

### EXPIRED

Utilizado apenas se algum produto possuir acesso com validade temporal.

Para produtos adquiridos com acesso permanente, `expiresAt` poderá permanecer nulo.

---

## 16. Regra fundamental de liberação

A criação de `Entitlement` deverá depender de uma condição financeira aprovada.

Fluxo:

```text
Payment
   │
   ▼
APPROVED
   │
   ▼
Regra de negócio
   │
   ▼
Entitlement ACTIVE
```

Nunca:

```text
Thank You Page
      │
      ▼
Entitlement
```

---

## 17. DigitalAsset

Representa um arquivo digital pertencente a um produto.

### Campos conceituais

```text
DigitalAsset
├── id
├── productId
├── name
├── storageProvider
├── storageKey
├── mimeType
├── size
├── checksum?
├── status
├── createdAt
└── updatedAt
```

O banco não deverá armazenar uma URL pública permanente como mecanismo principal de entrega.

---

## 18. Estados de DigitalAsset

```text
ACTIVE
INACTIVE
ARCHIVED
```

`storageKey` deverá identificar o recurso no mecanismo privado de armazenamento.

Exemplo conceitual:

```text
products/
  recovery-hair/
    ebook-v1.pdf
```

Isso não significa que esse caminho deverá ser publicamente acessível.

---

## 19. Delivery

Representa uma tentativa ou concessão técnica de entrega do ativo.

### Campos conceituais

```text
Delivery
├── id
├── entitlementId
├── digitalAssetId
├── status
├── tokenHash?
├── issuedAt
├── expiresAt?
├── accessedAt?
├── revokedAt?
└── createdAt
```

Tokens de acesso não deverão ser armazenados em texto puro quando puderem ser armazenados de forma derivada ou protegida.

---

## 20. Estados de Delivery

```text
ISSUED
ACCESSED
EXPIRED
REVOKED
FAILED
```

Fluxo:

```text
ISSUED
   │
   ├────► ACCESSED
   ├────► EXPIRED
   ├────► REVOKED
   └────► FAILED
```

A política definitiva de quantidade de acessos ou validade será especificada posteriormente.

---

## 21. AdminUser

Representa um usuário administrativo autorizado.

### Campos conceituais

```text
AdminUser
├── id
├── name
├── email
├── passwordHash / authReference
├── status
├── role
├── createdAt
└── updatedAt
```

Nenhuma senha deverá ser armazenada em texto puro.

A implementação definitiva de autenticação será definida em `LES-SEC-DIG-R01`.

---

## 22. Estados de AdminUser

```text
ACTIVE
DISABLED
```

Papéis iniciais poderão ser mantidos simples.

Exemplo:

```text
OWNER
ADMIN
SUPPORT
```

O princípio será menor privilégio.

---

## 23. AuditEvent

Representa uma ação administrativa ou evento crítico relevante.

### Campos conceituais

```text
AuditEvent
├── id
├── actorType
├── actorId?
├── action
├── targetType?
├── targetId?
├── metadata?
├── createdAt
└── correlationId?
```

Exemplos:

```text
ADMIN_LOGIN
ORDER_STATUS_CHANGED
ENTITLEMENT_REVOKED
DELIVERY_REISSUED
PRODUCT_UPDATED
REFUND_RECORDED
```

Logs de auditoria não deverão armazenar segredos.

---

## 24. Relacionamentos principais

```text
Customer
   │
   └──< Order
          │
          ├──< OrderItem >── Product
          │
          └──< Payment
                 │
                 └──< PaymentEvent

Customer
   │
   └──< Entitlement >── Product
              │
              └──< Delivery >── DigitalAsset

Product
   │
   └──< DigitalAsset

AdminUser
   │
   └──< AuditEvent
```

---

## 25. Cardinalidades iniciais

### Customer → Order

```text
1:N
```

Um cliente pode possuir vários pedidos.

### Order → OrderItem

```text
1:N
```

Um pedido possui um ou mais itens.

### Order → Payment

```text
1:N
```

Um pedido poderá possuir múltiplas tentativas de pagamento.

### Payment → PaymentEvent

```text
1:N
```

Um pagamento poderá receber múltiplos eventos.

### Customer → Entitlement

```text
1:N
```

Um cliente poderá possuir vários direitos de acesso.

### Product → DigitalAsset

```text
1:N
```

Um produto poderá possuir múltiplos ativos digitais.

### Entitlement → Delivery

```text
1:N
```

O sistema poderá emitir mais de uma entrega ao longo do ciclo de vida do acesso.

---

## 26. Dinheiro

Valores financeiros deverão usar representação exata.

Não utilizar ponto flutuante binário como fonte de verdade financeira.

A representação definitiva poderá utilizar:

```text
inteiro em menor unidade monetária
```

Exemplo:

```text
R$ 39,90
→
3990 centavos
```

ou tipo decimal seguro fornecido pela camada de persistência.

A escolha física será formalizada antes da implementação do banco.

---

## 27. Datas e horários

Persistência deverá utilizar timestamps consistentes.

Preferência:

```text
UTC na persistência
```

Conversões de timezone deverão ocorrer nas bordas de apresentação.

Eventos financeiros devem preservar horário suficiente para auditoria e ordenação.

---

## 28. Exclusão de registros

Entidades financeiras e de auditoria não deverão utilizar exclusão física como rotina operacional.

Pedidos, pagamentos e eventos devem preservar histórico.

Para entidades operacionais, quando apropriado, utilizar:

```text
status
archivedAt
disabledAt
```

em vez de exclusão destrutiva.

---

## 29. Dados pessoais

O modelo deverá seguir minimização de dados.

Armazenar somente informações justificadas por:

- execução da compra;
- entrega;
- suporte;
- segurança;
- obrigações legais;
- analytics legitimamente definido.

Dados pessoais não deverão ser replicados desnecessariamente em logs ou eventos técnicos.

---

## 30. Consistência transacional

Operações críticas deverão evitar estados parciais.

Exemplo:

```text
Pagamento aprovado
      │
      ▼
atualizar Payment
      +
atualizar Order
      +
criar Entitlement
```

Essas alterações deverão possuir estratégia transacional ou mecanismo equivalente que evite:

```text
Payment = APPROVED
Order = PAID
Entitlement = inexistente
```

sem possibilidade de detecção ou recuperação.

---

## 31. Reconciliação

Como provedores externos podem falhar ou atrasar eventos, a arquitetura deverá permitir reconciliação.

Exemplo:

```text
Estado local
   │
   ▼
consulta controlada
   │
   ▼
Mercado Pago
   │
   ▼
comparação
   │
   ▼
correção segura
```

Reconciliação não deverá substituir webhook, mas complementar sua confiabilidade.

---

## 32. Correlação

Fluxos importantes deverão possuir identificadores correlacionáveis.

Exemplo:

```text
Order ID
Payment ID
Provider Payment ID
Correlation ID
```

Esses identificadores permitirão investigar uma compra do início à entrega.

---

## 33. Índices lógicos esperados

Antes da definição física, já existem acessos previsíveis que precisarão ser eficientes.

Exemplos:

```text
Customer.email
Order.customerId
Order.status
Payment.orderId
Payment.providerPaymentId
Payment.status
PaymentEvent.providerEventId
Entitlement.customerId
Entitlement.orderId
Entitlement.status
Delivery.entitlementId
AuditEvent.createdAt
AuditEvent.targetId
```

A seleção final de índices será feita durante a modelagem física.

---

## 34. Restrições de unicidade esperadas

Possíveis restrições:

```text
Product.slug
AdminUser.email
Payment(provider, providerPaymentId)
PaymentEvent(provider, providerEventId)
```

`Customer.email` poderá ser único dependendo da estratégia definitiva de identidade do comprador.

Isso será confirmado antes da implementação.

---

## 35. Estratégia de migrations

Mudanças de banco deverão ser versionadas.

Nunca modificar produção manualmente como processo normal.

Fluxo futuro:

```text
Schema change
     │
     ▼
Migration versionada
     │
     ▼
Test
     │
     ▼
Backup / rollback strategy
     │
     ▼
Production
```

Detalhamento será tratado na documentação de deploy.

---

## 36. Modelo conceitual resumido

```text
PRODUCT
   │
   ├──────────────┐
   │              │
   ▼              ▼
ORDER ITEM    DIGITAL ASSET
   │              ▲
   ▼              │
ORDER             │
   │              │
   ▼              │
PAYMENT           │
   │              │
   ▼              │
PAYMENT EVENT     │
   │              │
   ▼              │
ENTITLEMENT ──────┘
   │
   ▼
DELIVERY
```

O `CUSTOMER` está associado a `ORDER` e `ENTITLEMENT`.

O `ADMIN USER` produz `AUDIT EVENT` para operações privilegiadas.

---

## 37. Critérios de aceite

O modelo R01 estará apto para aprovação quando:

- pedido, pagamento e acesso estiverem formalmente separados;
- houver suporte a múltiplas tentativas de pagamento;
- webhooks possuírem representação auditável;
- idempotência estiver prevista;
- direitos de acesso forem explícitos;
- ativos digitais não dependerem de URL pública;
- entrega possuir ciclo de vida próprio;
- ações administrativas forem auditáveis;
- dinheiro possuir representação exata;
- dados pessoais forem minimizados;
- histórico financeiro não depender de exclusão destrutiva;
- o modelo permitir futura substituição do Mercado Pago;
- transições críticas puderem ser protegidas por consistência transacional.

---

## 38. Decisão de modelagem central

A L'Essenc não tratará a compra como uma única linha de banco contendo:

```text
cliente + produto + pago = sim
```

A operação será representada por entidades separadas que reflitam corretamente:

```text
intenção comercial
→ tentativa financeira
→ confirmação
→ direito de acesso
→ entrega
```

Essa separação é necessária para segurança, auditoria, suporte, reembolsos, reconciliação e evolução futura da plataforma.
