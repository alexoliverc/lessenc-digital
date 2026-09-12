# P03 — Entitlement e Fulfillment

**Status:** especificação COMPLETE; invariantes puros de ativação/revogação de Entitlement implementados na [P07](p07-core-implementation.md), agora COMPLETE. Entrega, Fulfillment e políticas OPEN permanecem adiados.

`Entitlement`: `PENDING`, `ACTIVE`, `REVOKED`, `EXPIRED`. A concessão/ativação depende de `Order.PAID` derivado de pagamento aprovado; a mesma origem financeira válida não deve criar direitos duplicados. Reembolso integral confirmado revoga o entitlement. Solicitação de download exige direito `ACTIVE`, asset válido, comprador autorizado e segredo temporário; nenhuma URL permanente pública para conteúdo pago. Regra precisa para expiração, identidade do comprador e reemissão: **OPEN**.

`Fulfillment`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `CANCELED`. Falha de fulfillment é recuperável/observável, sem mudar `Order.PAID` nem `Payment.APPROVED`. Notificação por email falha sem revogar direito. A transação crítica registra estado de negócio e OutboxEvent; consumidores posteriores são idempotentes. Detalhes de retries e janelas temporais: **OPEN**, não números inventados.
