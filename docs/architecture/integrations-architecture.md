# P02 — Arquitetura de integrações

**Status:** especificação COMPLETE; implementação PENDING.

Mercado Pago implementa o contrato interno `PaymentProvider` por `MercadoPagoAdapter`. O domínio não importa SDK do provedor. A criação interna da `Order` e da tentativa de pagamento precede a chamada externa; valor, BRL e referência são decididos no backend. Idempotency keys reaproveitadas apenas para a mesma intenção permitem retry seguro; timeout pode significar pagamento criado com resposta desconhecida.

Webhook é entrada não confiável: validar assinatura e formato, deduplicar, consultar estado confiável do recurso, normalizar e aplicar [máquina interna](payment-state-machine.md) com trava de concorrência e reconciliação. Evento antigo não faz downgrade nem concede acesso. Segredos são exclusivos do servidor; não salvar cartão bruto, CVV ou payload sensível por padrão. SDK e detalhes atuais de API serão confirmados antes de implantação física sem alteração automática de major.

Notificações de email são consumidor assíncrono idempotente da [outbox](refund-notification-outbox-models.md). Provedor de email: **OPEN**. Storage privado: **OPEN**; acesso só após autorização server-side e `Entitlement.ACTIVE`. Observabilidade: **OPEN**. Serviços externos ou credenciais de produção requerem autorização explícita do owner.
