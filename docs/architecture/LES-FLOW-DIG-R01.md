# LES-FLOW-DIG-R01 — Fluxos Funcionais e Máquinas de Estado da L'Essenc Digital

**STATUS: HISTORICAL / INCOMPLETE.** Este arquivo foi preservado como evidência histórica, está truncado e **MUST NOT** ser usado como fonte autoritativa de regras de negócio atuais ou decisões de implementação. Consulte [docs/README.md](../README.md) e os documentos canônicos P03. Não reconstruir seu conteúdo ausente por suposição.

> **Baseline histórica incompleta:** o arquivo preservado termina no meio da seção 25. Para a baseline aprovada LES-DIG P03, consulte os documentos de máquinas de estado indexados em [docs/README.md](../README.md). O histórico não deve ser usado para inventar regras ausentes.

**Projeto:** L'Essenc Digital
**Documento:** LES-FLOW-DIG-R01
**Revisão:** R01
**Status:** Aprovado
**Data:** 11/09/2026
**Fase:** MVP-ARCH-01 — Arquitetura técnica do MVP

---

## 1. Objetivo

Este documento define os fluxos funcionais críticos da L'Essenc Digital e as regras que governam as transições entre estados de:

- pedidos;
- pagamentos;
- eventos financeiros;
- direitos de acesso;
- entregas digitais;
- reembolsos;
- chargebacks;
- operações administrativas.

Seu objetivo é impedir que comportamento crítico seja decidido informalmente durante a implementação.

A plataforma deverá possuir regras explícitas, auditáveis e testáveis para cada transição relevante.

---

## 2. Princípio central

A jornada comercial será tratada como uma sequência de estados controlados pelo backend.

A sequência conceitual principal é:

```text
VISITA
  ↓
OFERTA
  ↓
CHECKOUT
  ↓
ORDER
  ↓
PAYMENT
  ↓
CONFIRMAÇÃO FINANCEIRA
  ↓
ENTITLEMENT
  ↓
DELIVERY
  ↓
ACESSO
```

Nenhuma etapa posterior deverá ser inferida apenas pela navegação do usuário.

---

## 3. Fontes de autoridade

Cada tipo de decisão possuirá uma fonte de autoridade.

### Navegação

Fonte:

```text
Frontend
```

Utilizada apenas para experiência do usuário.

### Pedido

Fonte:

```text
Backend L'Essenc
```

### Pagamento

Fonte:

```text
Estado interno validado
+
informação confiável do provedor
```

### Direito de acesso

Fonte:

```text
Backend L'Essenc
```

### Entrega

Fonte:

```text
Entitlement válido
+
DigitalAsset ativo
+
regra de entrega
```

### Analytics

Fonte:

```text
Eventos analíticos
```

Analytics nunca será autoridade financeira ou de autorização.

---

## 4. Fluxo principal de compra

### 4.1 Entrada

O usuário acessa a página de vendas.

```text
Visitante
   ↓
Sales Page
```

Eventos analíticos poderão ser registrados.

Nenhum pedido deverá ser criado apenas por visualização.

---

## 5. Início do checkout

Ao selecionar a compra:

```text
Sales Page
   ↓
CTA
   ↓
Checkout
```

O backend deverá determinar:

- produto;
- preço vigente;
- moeda;
- disponibilidade;
- identificador interno da operação.

O navegador poderá informar intenção, mas não determinar o valor final.

---

## 6. Criação do pedido

Antes ou durante a criação da cobrança, o backend cria:

```text
Order = CREATED
```

O pedido recebe:

```text
orderId
customerId
currency
subtotal
total
createdAt
```

e um ou mais `OrderItem`.

---

## 7. Início do pagamento

Após o pedido ser válido:

```text
Order.CREATED
      ↓
criar Payment
      ↓
Payment.CREATED
      ↓
iniciar operação no Mercado Pago
```

Quando o processo financeiro for iniciado com sucesso:

```text
Order = PAYMENT_PENDING
Payment = PENDING
```

---

## 8. Falha ao iniciar pagamento

Se o provedor não puder iniciar a transação:

```text
Payment.CREATED
      ↓
erro externo
      ↓
Payment permanece não aprovado
```

O sistema deverá:

- não criar entitlement;
- não liberar conteúdo;
- registrar erro técnico;
- permitir nova tentativa quando seguro;
- preservar o pedido.

---

## 9. Redirecionamento e experiência de pagamento

Dependendo da integração escolhida, o cliente poderá:

```text
Checkout L'Essenc
      ↓
Mercado Pago
      ↓
resultado de navegação
      ↓
L'Essenc
```

O retorno do navegador não deverá atualizar sozinho o estado financeiro.

---

## 10. Página de agradecimento

A página de agradecimento poderá ser exibida após o fluxo de pagamento.

Ela deverá comunicar um estado de experiência, não um estado financeiro definitivo.

Possíveis mensagens:

```text
Pagamento confirmado
Pagamento em análise
Pagamento ainda sendo processado
Não foi possível confirmar o pagamento
```

A página deverá consultar o backend para determinar o estado conhecido.

---

## 11. Regra absoluta da página de agradecimento

É proibido utilizar:

```text
acessou /obrigado
        ↓
liberar produto
```

O fluxo correto é:

```text
/obrigado
   ↓
consulta Order/Payment
   ↓
backend
   ↓
estado confirmado
```

---

## 12. Recebimento de webhook

Fluxo:

```text
Mercado Pago
    ↓
Webhook Endpoint
    ↓
validação inicial
    ↓
PaymentEvent.RECEIVED
```

O evento deverá ser persistido ou registrado de forma suficiente antes de operações irreversíveis, quando aplicável.

---

## 13. Processamento do webhook

```text
PaymentEvent.RECEIVED
        ↓
PaymentEvent.PROCESSING
        ↓
validar evento
        ↓
identificar Payment
        ↓
consultar estado confiável
        ↓
aplicar transição
```

Ao finalizar:

```text
PaymentEvent.PROCESSED
```

---

## 14. Evento duplicado

Se o mesmo evento for recebido novamente:

```text
Webhook duplicado
      ↓
identificação de idempotência
      ↓
PaymentEvent.IGNORED
```

Nenhum novo entitlement deverá ser criado.

Nenhuma nova alteração financeira indevida deverá ocorrer.

---

## 15. Evento inválido

Caso um webhook falhe em requisitos de autenticidade, formato ou consistência:

```text
Webhook
   ↓
validação falha
   ↓
rejeitar processamento
```

O sistema deverá:

- não modificar pagamento;
- não gerar acesso;
- registrar evento técnico seguro;
- evitar exposição de informações sensíveis.

---

## 16. Pagamento pendente

Quando o estado financeiro continuar pendente:

```text
Payment = PENDING
Order = PAYMENT_PENDING
```

Nenhum acesso será concedido.

O sistema poderá aguardar:

- novo webhook;
- processamento do provedor;
- mecanismo de reconciliação.

---

## 17. Pagamento em processamento

Quando aplicável:

```text
Payment = PROCESSING
Order = PAYMENT_PENDING
```

O usuário poderá visualizar mensagem equivalente a:

> Estamos confirmando seu pagamento.

Nenhum entitlement deverá ser criado ainda.

---

## 18. Pagamento aprovado

Fluxo crítico:

```text
Payment.PENDING
      ↓
confirmação válida
      ↓
Payment.APPROVED
```

A operação de aprovação deverá coordenar:

```text
Payment = APPROVED
Order = PAID
Entitlement = ACTIVE
```

Essas transições deverão evitar estado parcial não detectável.

---

## 19. Concessão de entitlement

Após confirmação financeira válida:

```text
Payment.APPROVED
      ↓
regra de concessão
      ↓
Entitlement.ACTIVE
```

Antes de criar um novo entitlement, o sistema deverá verificar se já existe direito equivalente.

Objetivo:

```text
1 compra válida
≠
N entitlements duplicados
```

---

## 20. Pagamento aprovado duplicadamente

Caso dois processos concorrentes tentem tratar a mesma aprovação:

```text
Webhook A ──┐
            ├──► mesma Payment
Webhook B ──┘
```

O resultado final deverá permanecer:

```text
1 Payment APPROVED
1 Entitlement válido
```

A implementação deverá utilizar restrições, transações ou mecanismos equivalentes.

---

## 21. Pagamento rejeitado

Fluxo:

```text
Payment.PENDING
      ↓
REJECTED
```

Resultado:

```text
Payment = REJECTED
Order ≠ PAID
Entitlement = inexistente
```

O pedido poderá permitir nova tentativa financeira.

---

## 22. Nova tentativa de pagamento

Um mesmo pedido poderá possuir:

```text
Order
 ├── Payment #1 → REJECTED
 └── Payment #2 → PENDING
```

Se a segunda tentativa for aprovada:

```text
Payment #2 → APPROVED
Order → PAID
Entitlement → ACTIVE
```

A tentativa rejeitada permanece no histórico.

---

## 23. Pagamento expirado

Quando o provedor ou regra interna determinar expiração:

```text
Payment = EXPIRED
```

Se não existir outra tentativa válida:

```text
Order = EXPIRED
```

Nenhum entitlement deverá ser concedido.

---

## 24. Pedido cancelado

O pedido poderá ser cancelado quando ainda não houver pagamento aprovado.

Fluxo:

```text
CREATED / PAYMENT_PENDING
          ↓
       CANCELED
```

Cancelamento não deverá apagar dados históricos.

---

## 25. Reconciliação

Webhooks não serão a única forma de confirmar consistência.

Um processo controlado poderá executar:

```text
Payment local
    ↓
consulta Mercado Pago
    ↓
estado externo
    ↓
compar
