# P03 — Máquina de estados de Payment

**Status:** especificação COMPLETE; código e testes PENDING.

| Origem | Destino permitido |
| --- | --- |
| PENDING | APPROVED, REJECTED, CANCELED, UNKNOWN |
| UNKNOWN | APPROVED, REJECTED |
| APPROVED | REFUNDED |

`UNKNOWN` representa resposta ambígua, especialmente timeout de criação ou consulta: **não equivale a REJECTED** e exige reconciliação. O status externo é normalizado no adapter; nenhuma callback do browser é prova. Aprovação confirmada não sofre downgrade por evento atrasado. Webhook assinado e consulta ao provedor seguem as mesmas regras de transição e idempotência da reconciliação. O processamento deve impedir dupla concessão mesmo com dois processos concorrentes. `CHARGEBACK` e estados operacionais adicionais presentes no histórico não são incorporados automaticamente à máquina P03; a política detalhada correspondente é **OPEN**.
