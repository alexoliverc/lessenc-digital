# P18-04 — Consolidated Readiness & Evidence Assessment R01

**Data:** 18/10/2026

**Release técnica avaliada:** `a780faa6d9275b1f9abfae2ad812aa0a2d78402a`

**Estado:** `COMPLETE / FORMAL READINESS PENDING`

**Autoridade:** `LES-OWNER-AUTH-P18-COMPLETION-20261018-R01`

## Resultado

Os 57 controles P18-01, as 15 pendências P17 e os 31 riscos/bloqueadores foram reconciliados sem
perda de identidade. A fonte histórica permanece
[`p18-readiness-inventory-r01.md`](p18-readiness-inventory-r01.md); esta matriz é uma sobreposição de
estado atual, não uma reescrita retroativa.

Vocabulário atual:

- `PROVEN`: evidência suficiente no escopo e na camada indicada;
- `PARTIALLY PROVEN`: evidência útil, mas incompleta para o requisito integral;
- `BLOCKED`: critério aplicável impedido por dependência ou hard stop conhecido;
- `NOT EXECUTED`: execução obrigatória ausente;
- `UNKNOWN`: informação não obtida com autoridade suficiente;
- `NOT APPLICABLE`: requisito não se aplica ao escopo demonstrado.

`PROVEN` nunca significa produção se a coluna de autoridade disser local, Git ou staging.

## Matriz única dos 57 controles

| ID | Estado atual | Autoridade da melhor evidência | Observação de P18-04 |
| --- | --- | --- | --- |
| P18-GOV-01 | PROVEN | Git/documental | ADR-0013 e brief de conclusão integrados; revisão independente final pendente. |
| P18-GOV-02 | PROVEN | Git/documental + evidência histórica por fase | P14–P16 preservadas em seus checkpoints; não transferidas à produção. |
| P18-ARCH-01 | PROVEN | hosted/staging histórica | Arquitetura portável comprovada apenas na baseline P16. |
| P18-ARCH-02 | PROVEN | local + hosted/staging histórica | Separação de ambientes existe; production não verificada. |
| P18-ARCH-03 | PARTIALLY PROVEN | local/diagnóstico | Capacidade produtiva e SLO operacional não demonstrados. |
| P18-REL-01 | PROVEN | independently correlated P16 | Release P16 congelada; histórica. |
| P18-REL-02 | PROVEN | hosted + independently correlated P17 histórica | Não se propaga a commits posteriores. |
| P18-REL-03 | PROVEN | Git/documental | HEAD P17 atual é `a780faa…`; nenhuma equivalência hosted inferida. |
| P18-REL-04 | PROVEN | Git + evidência P16 histórica | Compatibilidade P16 não cobre release candidata atual. |
| P18-REL-05 | NOT EXECUTED | none | Deploy/smoke production proibidos pelo mandato. |
| P18-SEC-01 | PROVEN | hosted/staging histórica | CSP/headers P16; `unsafe-inline` residual e revalidação por release permanecem. |
| P18-SEC-02 | PROVEN | hosted/staging histórica | TLS/DNS são temporais; production não verificada. |
| P18-SEC-03 | PROVEN | local + hosted negatives históricos | Retenção/log pipeline production não verificados. |
| P18-SEC-04 | PROVEN | Git/static + hosted/staging histórica | Rotação/segregação production continuam pendentes. |
| P18-SEC-05 | PROVEN | local + CI hospedado P18 | Grafo completo com zero findings em `a780faa…`; runtime sem `braces`. |
| P18-SEC-06 | PROVEN | local + CI hospedado P18 | `LES-SEC-RA-001` remediado por patch mantido; sem autoridade de produção. |
| P18-ID-01 | PROVEN | local/isolated | Auth admin, MFA, sessão e RBAC cobertos por regressões; production não verificada. |
| P18-ID-02 | PROVEN | hosted/staging histórica | Admin real provado somente na release de evidência anterior. |
| P18-ID-03 | PROVEN | hosted/staging histórica + local | Cookie/sessão production não verificados. |
| P18-ID-04 | BLOCKED | Git/documental + local | Recovery administrativo segue sem fronteira atômica reissue/audit. |
| P18-SEC-07 | PROVEN | CI/CodeQL hospedado atual | PR #64 e merge `a780faa…`; branch P17 continua sem protection/ruleset ativo. |
| P18-DB-01 | PROVEN | hosted/staging histórica | TLS/identidade production não verificados. |
| P18-DB-02 | PROVEN | hosted/staging histórica + Git atual | Nove migrations atuais; aplicação hosted da nona não atestada. |
| P18-DB-03 | PROVEN | provider-private/staging histórica | Grants production não verificados. |
| P18-DB-04 | PROVEN | local/isolated histórica | F06 local; aplicação hosted não provada. |
| P18-DB-05 | NOT EXECUTED | none | DB/migrations/grants production fora do mandato. |
| P18-DB-06 | PROVEN | Git/documental atual | Schema/tree iguais entre `70430d9…` e `a780faa…`; rollback real não executado. |
| P18-PAY-01 | PROVEN | local/isolated | Autoridade financeira server-side preservada. |
| P18-PAY-02 | PROVEN | hosted/provider TEST histórica | Uma jornada Card Brick; não cobre matriz completa. |
| P18-PAY-03 | BLOCKED | provider-adjacent diagnostic | E05 continua `HMAC_MISMATCH / NEITHER_MATCH`; sem entrega autenticada. |
| P18-PAY-04 | PROVEN | local/isolated | Idempotência/retry cobertos localmente; provider real limitado. |
| P18-PAY-05 | NOT EXECUTED | none | Recusa real Mercado Pago TEST e ausência de entitlement não provadas. |
| P18-PAY-06 | PROVEN | hosted/staging histórica + local | Fulfillment positivo histórico; failure matrix incompleta. |
| P18-DEL-01 | PROVEN | local/isolated | Autorização por entitlement/recurso coberta localmente. |
| P18-DEL-02 | PROVEN | hosted/staging histórica | Range/entrega provados na release histórica. |
| P18-DEL-03 | PROVEN | provider-private/staging histórica | Least privilege R2 production não verificado. |
| P18-DEL-04 | BLOCKED | partial local | B01/B03–B07 continuam sem matriz externa/controlada completa. |
| P18-DEL-05 | PROVEN | hosted/staging histórica + local | Falhas de audit/recovery continuam nos itens B06/B07. |
| P18-BCP-01 | PROVEN | hosted mechanism P16 | Recovery unit histórica, não release P18/production. |
| P18-BCP-02 | PROVEN | independently correlated P16 | RPO histórico, não compromisso production corrente. |
| P18-BCP-03 | PROVEN | hosted/staging recovery P16 | RTO histórico, não release candidata atual. |
| P18-BCP-04 | PARTIALLY PROVEN | plan/local static | Retenção 7/4/3 permanece `PLAN_ONLY`. |
| P18-BCP-05 | NOT EXECUTED | none | Cópia final independente off-R2 não provada. |
| P18-BCP-06 | PARTIALLY PROVEN | hosted mechanism P16 | DB/R2 permanecem sequenciais, não atômicos. |
| P18-BCP-07 | PROVEN | local + hosted/staging histórica | Restore e rollback separados; não executados contra RC atual. |
| P18-OBS-01 | PROVEN | local/isolated | Correlação/telemetria implementadas; backend production não verificado. |
| P18-OBS-02 | PROVEN | hosted/staging histórica | Readiness externo depende da release. |
| P18-OBS-03 | PROVEN | hosted/staging histórica | Status público histórico. |
| P18-OPS-01 | PROVEN | Git/documental + local | Runbooks existentes; owners/janelas production pendentes. |
| P18-NET-01 | PROVEN | hosted/staging histórica | Domínio/HTTPS staging temporal. |
| P18-NET-02 | NOT EXECUTED | none | Domínio/DNS/HTTPS production não verificados. |
| P18-ANA-01 | PROVEN | local + hosted negative histórica | Consentimento first-party; production não verificada. |
| P18-ANA-02 | PROVEN | local/isolated | Analytics admin local; production não verificada. |
| P18-ANA-03 | BLOCKED | Git/documental + local | Meta CAPI permanece policy-blocked/desativado. |
| P18-ANA-04 | PROVEN | hosted/staging histórica | GTM/Meta browser foram N/A na configuração observada. |
| P18-UX-01 | BLOCKED | partial hosted | Payment Brick ainda não provado nos três viewports. |
| P18-PERF-01 | PARTIALLY PROVEN | local/isolated | 15 coortes/600 amostras são revisão numérica provisória, não Gate D. |

Contagem: `57/57` IDs reconciliados. Não há `UNKNOWN` ou `NOT APPLICABLE` novos; os N/A históricos
de analytics/3DS permanecem limitados aos cenários originais e não substituem controles.

## Quinze pendências P17

| Grupo | IDs | Estado P18-04 | Evidência faltante |
| --- | --- | --- | --- |
| webhook | P17-E05 | BLOCKED / DEFERRED | mesma notificação TEST correlacionada provider/hosted/DB com HMAC válido |
| recusa | P17-F01 | NOT EXECUTED / PENDING_EXTERNAL | recusa TEST real e nenhum entitlement/fulfillment |
| Buyer/falhas | P17-B01, B03, B04, B05, B06, B07 | BLOCKED ou NOT EXECUTED | negativos controlados na release/autoridade aplicável |
| responsividade | P17-R01, R02, R03 | PENDING_EXTERNAL | Brick real mobile/tablet/desktop |
| performance | P17-PR01, PR02, PR03, PR04 | PARTIALLY PROVEN / DEFERRED | autoridade/proveniência definitiva para aceite Gate D |

Contagem: `15/15`. Nenhum item foi fechado por inferência local.

## Trinta e um riscos/bloqueadores

Os `31/31` IDs continuam rastreados no registro original e no dossiê P18-09. A única mudança de
estado técnico é `P18-RSK-001`: `REMEDIATED_WITH_MAINTAINED_PATCH`. Os outros 30 preservam
severidade e requisito de evidência. Gate D permanece `NOT_READY`.
