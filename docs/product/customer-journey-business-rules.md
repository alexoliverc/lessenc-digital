# P01 — Jornada do comprador e regras de negócio

**Status:** baseline documental COMPLETE; execução PENDING.

1. Paid traffic leva à página da oferta aprovada. Visita ou clique não cria compra paga.
2. O checkout recebe dados mínimos; a aplicação valida produto `ACTIVE`, preço, moeda, quantidade e disponibilidade no servidor. Conta prévia não é obrigatória.
3. Criam-se `Order`, `OrderItem` e intenção/tentativa financeira interna antes de chamar o `PaymentProvider`; dados externos ficam separados dos IDs internos.
4. O resultado do provedor é confirmado pelo backend; redirect, query param, `localStorage`, eventos analíticos ou estado de frontend não provam pagamento. Timeout/resultado ambíguo requer estado `UNKNOWN` e reconciliação, sem acesso.
5. Pagamento confirmado `APPROVED` permite `Order.PAID` e ativação idempotente de `Entitlement` por item elegível. O registro dos efeitos de negócio e do outbox é transacional; notificação e fulfillment assíncronos não desfazem o pagamento se falharem.
6. O comprador recebe acesso privado por autorização, entitlement ativo e validação do asset, com URL/segredo temporário. A página pós-compra informa estado consultado no servidor; seu carregamento não concede acesso.
7. Reembolso total confirmado revoga acesso conforme [máquina de reembolso](../architecture/refund-notification-outbox-models.md). Os demais cenários, como reembolso parcial e chargeback, exigem brief antes da implementação dependente.

Política de identificação do comprador sem conta prévia, emissão/reemissão de acesso, canal de suporte e direitos de arrependimento: **OPEN**. Ver [máquinas de pedido](../architecture/order-state-machine.md) e [pagamento](../architecture/payment-state-machine.md).
