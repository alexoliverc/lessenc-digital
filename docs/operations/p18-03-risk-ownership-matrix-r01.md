# LES-P18-03 — Operational Risk, Ownership & Evidence Matrix R01

**Estado:** `PREPARATORY / NO RISK ACCEPTANCE`

**Baseline Git:** `659684121a0e55bdb37192e29100999f1533912d`

## 1. Regra de precedência

A [matriz de riscos P18-01](p18-risk-and-blocker-register-r01.md) é a
fonte da classificação e do estado abaixo.
O [mapa P18-02](p18-02-dependency-and-remediation-map-r01.md)
fornece somente as propostas de roteamento para P19.

Severidade e estado são transportados literalmente da fonte, sem
reclassificação. O roteamento não atribui owner, não cria prazo nem
autoriza trabalho P19.

## 2. Os 31 registros canônicos — reconciliação R02

As linhas abaixo transportam campos do
[Risk and Blocker Register P18-01](p18-risk-and-blocker-register-r01.md)
e os roteamentos previamente propostos no
[Dependency & Remediation Map P18-02](p18-02-dependency-and-remediation-map-r01.md).

**Regra de evidência:** a fonte combina evidência requerida e critério de
fechamento nos primeiros 16 registros. Nesses casos, ambos os campos reproduzem
o mesmo texto canônico intencionalmente. Nos demais 15 registros, a fonte
não separa uma coluna de evidência faltante: essa ausência é declarada
explicitamente e o critério de fechamento é copiado literalmente.
Não foram inventadas provas, responsabilidades, prazos ou estados.

| ID | Severidade | Estado | Exposição/impacto herdado | Evidência requerida | Condição de fechamento | Responsável | Prazo | Próxima ação autorizável | Rota candidata |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P18-RSK-001` | HIGH / development-CI only / production hard stop | TEMPORARY ACCEPTED RISK / BLOCKED FOR PRODUCTION | `braces@3.0.3` permanece na cadeia de lint; tooling pode sofrer DoS e a aceitação não cobre produção. | Caminho oficial remove a condição; audit completo sem finding aceito; regressões e revisão explícita. | Caminho oficial remove a condição; audit completo sem finding aceito; regressões e revisão explícita. | NÃO DEFINIDO; aceitação ratificada pelo owner. | 13/11/2026 23:59:59 America/Sao_Paulo; revisão até P19 closeout ou antes. | Remediação separadamente autorizada; não ampliar escopo nem prorrogar implicitamente. | `P19-B05` |
| `P18-BLK-E05` | CRITICAL Gate D | BLOCKED / DEFERRED | Webhook real TEST não autenticado; `HMAC_MISMATCH / NEITHER_MATCH`; fulfillment não pode confiar na entrega. | Mesma notificação correlacionada no provider, hosted logs e DB, com HMAC válido e sem disclosure de segredo. | Mesma notificação correlacionada no provider, hosted logs e DB, com HMAC válido e sem disclosure de segredo. | NÃO DEFINIDO. | NÃO DEFINIDO. | Investigação/execução read-only ou controlada sob brief e autoridade específicos. | `P19-B01` |
| `P18-BLK-F01` | CRITICAL Gate D | PENDING_EXTERNAL / DEFERRED | Recusa real de provider e fail-closed comercial não provados. | Uma recusa Mercado Pago TEST real, Order/Payment reconciliados e nenhum entitlement/fulfillment. | Uma recusa Mercado Pago TEST real, Order/Payment reconciliados e nenhum entitlement/fulfillment. | NÃO DEFINIDO. | NÃO DEFINIDO. | Cenário TEST controlado sob autorização futura. | `P19-B02` |
| `P18-BLK-B01` | CRITICAL Gate D | PENDING_EXTERNAL / DEFERRED | Credencial Buyer inválida ainda carece de autoridade externa/hosted aplicável. | Negação genérica, nenhuma sessão/byte/audit indevido e correlação na release autorizada. | Negação genérica, nenhuma sessão/byte/audit indevido e correlação na release autorizada. | NÃO DEFINIDO. | NÃO DEFINIDO. | Executar no pacote Buyer Access futuro. | `P19-B03` |
| `P18-BLK-B03` | HIGH | NOT_EXECUTED / DEFERRED | Rate limit Buyer não foi exercitado na autoridade exigida. | 429/limiter fail-closed sem mutação comercial ou lockout indevido. | 429/limiter fail-closed sem mutação comercial ou lockout indevido. | NÃO DEFINIDO. | NÃO DEFINIDO. | Teste controlado com limites e cleanup aprovados. | `P19-B03` |
| `P18-BLK-B04` | CRITICAL Gate D | NOT_EXECUTED / DEFERRED | Indisponibilidade de storage pode interromper entrega; comportamento hospedado não provado. | Resposta sanitizada, zero byte indevido, direito comercial preservado e telemetry/audit coerentes. | Resposta sanitizada, zero byte indevido, direito comercial preservado e telemetry/audit coerentes. | NÃO DEFINIDO. | NÃO DEFINIDO. | Fault injection bounded sob brief próprio. | `P19-B03` |
| `P18-BLK-B05` | HIGH | NOT_EXECUTED / DEFERRED | Falha durante stream pode deixar resposta/audit inconsistente. | Cleanup, encerramento do stream e evento de falha sem exposição de provider. | Cleanup, encerramento do stream e evento de falha sem exposição de provider. | NÃO DEFINIDO. | NÃO DEFINIDO. | Teste de stream controlado sob autoridade futura. | `P19-B03` |
| `P18-BLK-B06` | CRITICAL Gate D | NOT_EXECUTED / DEFERRED | Falha do audit obrigatório pode permitir entrega não auditada se a fronteira regredir. | Prova fail-closed de que nenhum byte é liberado sem audit obrigatório. | Prova fail-closed de que nenhum byte é liberado sem audit obrigatório. | NÃO DEFINIDO. | NÃO DEFINIDO. | Teste transacional/HTTP isolado e depois correlação aplicável. | `P19-B03` |
| `P18-BLK-B07` | CRITICAL Gate D | NOT_EXECUTED / DEFERRED | Recovery/reissue seguro ainda não possui fronteira atômica com `AdminAuditEvent`. | Design aprovado e prova atômica de reissue, revogação, audit e não duplicidade. | Design aprovado e prova atômica de reissue, revogação, audit e não duplicidade. | NÃO DEFINIDO. | NÃO DEFINIDO. | Work package P19-B; nenhuma atualização direta de tabela. | `P19-B07` |
| `P18-BLK-R01` | HIGH / obrigatório Gate D | PENDING_EXTERNAL / DEFERRED | Brick real pode falhar/usabilidade não provada em 390x844. | Execução funcional Mercado Pago TEST no viewport aprovado. | Execução funcional Mercado Pago TEST no viewport aprovado. | NÃO DEFINIDO. | NÃO DEFINIDO. | Matriz real multi-viewport sob brief futuro. | `P19-B02` |
| `P18-BLK-R02` | HIGH / obrigatório Gate D | PENDING_EXTERNAL / DEFERRED | Brick real não provado em 768x1024. | Execução funcional Mercado Pago TEST no viewport aprovado. | Execução funcional Mercado Pago TEST no viewport aprovado. | NÃO DEFINIDO. | NÃO DEFINIDO. | Matriz real multi-viewport sob brief futuro. | `P19-B02` |
| `P18-BLK-R03` | HIGH / obrigatório Gate D | PENDING_EXTERNAL / DEFERRED | Brick real não provado em 1440x900. | Execução funcional Mercado Pago TEST no viewport aprovado. | Execução funcional Mercado Pago TEST no viewport aprovado. | NÃO DEFINIDO. | NÃO DEFINIDO. | Matriz real multi-viewport sob brief futuro. | `P19-B02` |
| `P18-BLK-PR01` | Requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | Dados locais completos, porém provenance/authority insuficientes para PASS. | Aceite definitivo contra budget aprovado, com identidade/provenance reconciliadas. | Aceite definitivo contra budget aprovado, com identidade/provenance reconciliadas. | Owner aprovou budget; executor não definido. | NÃO DEFINIDO. | Revisão da evidência e execução mínima necessária sob brief específico. | `P19-B04` |
| `P18-BLK-PR02` | Requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | Mesmo limite de autoridade do pacote local. | Aceite definitivo contra budget aprovado. | Aceite definitivo contra budget aprovado. | Owner aprovou budget; executor não definido. | NÃO DEFINIDO. | Idem PR01. | `P19-B04` |
| `P18-BLK-PR03` | Requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | Medida local não prova provider/hosted release. | Aceite definitivo contra budget aprovado. | Aceite definitivo contra budget aprovado. | Owner aprovou budget; executor não definido. | NÃO DEFINIDO. | Idem PR01. | `P19-B04` |
| `P18-BLK-PR04` | Requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | Medida local não prova release hospedada. | Aceite definitivo contra budget aprovado. | Aceite definitivo contra budget aprovado. | Owner aprovou budget; executor não definido. | NÃO DEFINIDO. | Idem PR01. | `P19-B04` |
| `P18-RSK-002` | NÃO ATRIBUÍDA / release blocker | OWNER-REPORTED / INDEPENDENT ATTESTATION PENDING | O HEAD Git integrado P17 é `96b3fda…`; runtime, release binding, build, publish, switch e restart do deploy informado de `202a43b…` não podem ser atribuídos de forma independente. | NÃO SEGREGADA NA FONTE; ver fechamento | Correlação read-only com Git/release/env/runtime e comparação apropriada de código. | NÃO DEFINIDO | NÃO DEFINIDO. | Atividade externa fora da P18-02; exige novo brief e autorização específica; não herdar P17-L04 de `0f6534f…`. | `P19-A01` |
| `P18-RSK-003` | NÃO ATRIBUÍDA | LOCAL TEST PROVEN / HOSTED NOT PROVEN | O parent técnico `202a43b…` pode depender da nona migration sem atestação de schema hosted; o merge documental `96b3fda…` não adiciona prova runtime. | NÃO SEGREGADA NA FONTE; ver fechamento | Release, migration tree e status hospedado reconciliados sem inferir ou aplicar mutation. | NÃO DEFINIDO | NÃO DEFINIDO. | Atividade externa fora da P18-02; exige novo brief e autorização específica antes de qualquer futura janela de migration. | `P19-A01` |
| `P18-RSK-004` | NÃO ATRIBUÍDA | PLAN_ONLY | Não há prova de cobertura histórica nem autoridade de deletion/lifecycle. | NÃO SEGREGADA NA FONTE; ver fechamento | Política executável, cobertura verificada, revisão de deleção e rollback/hold. | NÃO DEFINIDO | NÃO DEFINIDO. | Desenhar implementação e aprovação separada; nenhuma deleção agora. | `P19-B06` |
| `P18-RSK-005` | NÃO ATRIBUÍDA | NOT PROVEN | O ponto final P16 não tem cópia independente comprovada fora do domínio R2. | NÃO SEGREGADA NA FONTE; ver fechamento | Cópia cifrada, inventário, hash round-trip, acesso de restore e custódia separados. | NÃO DEFINIDO | NÃO DEFINIDO. | Work package de backup sob autoridade de provider. | `P19-B06` |
| `P18-RSK-006` | NÃO ATRIBUÍDA | LIMITATION ACCEPTED AS EVIDENCE, NOT REMEDIATED | Recovery unit não é snapshot cross-system atômico; pode existir janela lógica. | NÃO SEGREGADA NA FONTE; ver fechamento | Protocolo de consistência/quiescence ou reconciliação formal provado. | NÃO DEFINIDO | NÃO DEFINIDO. | Arquitetar em P19-B se requerido pelo go/no-go. | `P19-B06` |
| `P18-RSK-007` | MEDIUM script / LOW style | OPEN RESIDUAL | Strict CSP parcial; defesa XSS depende de outras camadas. | NÃO SEGREGADA NA FONTE; ver fechamento | Nonce/hash architecture aprovada, provider/browser regression e hosted validation. | NÃO DEFINIDO | NÃO DEFINIDO. | Não mudar na P18-01; avaliar prioridade no formal P18. | `P19-B08` |
| `P18-RSK-008` | Risco operacional derivado do finding F02 remediado; nova severidade NÃO ATRIBUÍDA | REVALIDATION REQUIRED AFTER DEPLOY | Provider pode regenerar `.htaccess`, afetando redirect; CSP deve permanecer application-owned. | NÃO SEGREGADA NA FONTE; ver fechamento | Teste funcional de redirect/CSP após cada deploy. | NÃO DEFINIDO | antes de aceitar qualquer release. | Adicionar ao checklist P19-A. | `P19-A03/P19-B08` |
| `P18-RSK-009` | NÃO ATRIBUÍDA | ROTATION REQUIRED BEFORE PRODUCTION | Token é staging-only; reuso violaria isolamento. | NÃO SEGREGADA NA FONTE; ver fechamento | Novo segredo production, transporte por secret reference, negativos e monitor autorizado. | NÃO DEFINIDO | antes de produção. | Planejar rotação sem ler/imprimir valor. | `P19-A02` |
| `P18-RSK-010` | NÃO ATRIBUÍDA / production blocker | PRODUCTION NOT VERIFIED | Isolamento, força, não reuso e presença efetiva não verificados. | NÃO SEGREGADA NA FONTE; ver fechamento | Inventário por nome/purpose e verificação privada no ambiente autorizado. | NÃO DEFINIDO | antes de P19-C. | Preparar checklist; valores ficam fora do contexto documental. | `P19-A02` |
| `P18-RSK-011` | NÃO ATRIBUÍDA | `OPEN_STAGING_BASELINE` / PRODUCTION NOT VERIFIED | Status público cobre Website; demais componentes e SLOs não têm sinais reais publicados. | NÃO SEGREGADA NA FONTE; ver fechamento | Monitors, samples, alert routes, on-call e public projection coerentes. | Owners abstratos P15 | NÃO DEFINIDO. | Preparar plano P19-A; não inventar SLO ou owner. | `P19-B09` |
| `P18-RSK-012` | NÃO ATRIBUÍDA | SAFE DEFER / BLOCKED | Não há transação atômica provada entre reissue e AdminAudit obrigatório. | NÃO SEGREGADA NA FONTE; ver fechamento | Arquitetura aprovada, rollback e provas adversariais. | NÃO DEFINIDO | NÃO DEFINIDO. | P19-B separado; sem workaround manual. | `P19-B07` |
| `P18-RSK-013` | INFORMATIONAL/OPEN no snapshot P14 | CURRENT STATE NOT VERIFIED | P14 observou branch protection/ruleset e recursos de security desabilitados; estado pode ter mudado. | NÃO SEGREGADA NA FONTE; ver fechamento | Inspeção atual read-only e decisão de governança. | NÃO DEFINIDO | NÃO DEFINIDO. | Verificar sob autorização futura; não tratar snapshot como estado atual. | `P19-B05` |
| `P18-RSK-014` | Política, sem severidade técnica atribuída | POLICY BLOCKED | Ativação violaria `MATCHING_DATA_POLICY_NOT_AUTHORIZED / PRIVACY_POLICY`. | NÃO SEGREGADA NA FONTE; ver fechamento | Decisão de privacidade explícita, minimização e autorização provider. | NÃO DEFINIDO | NÃO DEFINIDO. | Manter desativado. | `P19-B10` |
| `P18-RSK-015` | PROGRAM HARD STOP | PRODUCTION NOT AUTHORIZED | Ambiente, release, DB, storage, Mercado Pago PROD, webhook, backup, observabilidade, analytics, smoke e compra real não verificados. | NÃO SEGREGADA NA FONTE; ver fechamento | Gate D PASS + decisão formal P18 + Gate E GO + autorização específica do owner. | Owner | NÃO DEFINIDO. | Nenhuma execução P19-C até as quatro condições. | `P19-A03` |
| `P18-RSK-016` | NÃO ATRIBUÍDA | PRODUCTION NOT VERIFIED | Rate limits possuem regressão local e performance possui pacote numérico provisório, mas banco/hosting/concorrência/SLO produtivos não foram validados. | NÃO SEGREGADA NA FONTE; ver fechamento | Modelo de carga aprovado, critérios/SLO e evidência não destrutiva na release aplicável. | NÃO DEFINIDO | NÃO DEFINIDO. | Incluir no formal P18/P19-A; não executar carga externa sem autorização. | `P19-B09` |

## 3. As 15 pendências P17

Cada linha continua dependente da matriz Gate D original.
Nenhuma pendência é encerrada por sua inclusão neste relatório.

| Pendência original | Registro P18 | Rota candidata |
| --- | --- | --- |
| `P17-E05` | `P18-BLK-E05` | `P19-B01` |
| `P17-F01` | `P18-BLK-F01` | `P19-B02` |
| `P17-B01` | `P18-BLK-B01` | `P19-B03` |
| `P17-B03` | `P18-BLK-B03` | `P19-B03` |
| `P17-B04` | `P18-BLK-B04` | `P19-B03` |
| `P17-B05` | `P18-BLK-B05` | `P19-B03` |
| `P17-B06` | `P18-BLK-B06` | `P19-B03` |
| `P17-B07` | `P18-BLK-B07` | `P19-B07` |
| `P17-R01` | `P18-BLK-R01` | `P19-B02` |
| `P17-R02` | `P18-BLK-R02` | `P19-B02` |
| `P17-R03` | `P18-BLK-R03` | `P19-B02` |
| `P17-PR01` | `P18-BLK-PR01` | `P19-B04` |
| `P17-PR02` | `P18-BLK-PR02` | `P19-B04` |
| `P17-PR03` | `P18-BLK-PR03` | `P19-B04` |
| `P17-PR04` | `P18-BLK-PR04` | `P19-B04` |

## 4. Responsabilidade, prazo e autoridade

Os campos de owner e prazo permanecem aqueles definidos na
fonte canônica, inclusive `NÃO DEFINIDO` quando aplicável.
Não atribuir pessoas, SLOs, severidades ou novas datas por inferência.

A aceitação `LES-SEC-RA-001` continua HIGH, development/CI only,
com expiração em 13/11/2026 23:59:59 America/Sao_Paulo.
Ela é hard stop para promoção produtiva, mesmo antes da expiração.

Para qualquer pacote futuro, exigir owner formal, brief, autoridade,
janela, stop gate, rollback, cleanup e evidência independente.

## 5. Resultado

57 controles P18-01 permanecem no inventário canônico.
15 pendências P17 e 31 registros de risco/bloqueio permanecem abertos
nos respectivos estados de origem.

`GATE D = NOT_READY`

`GATE E = GO NOT AUTHORIZED`

`PRODUCTION = NOT AUTHORIZED`
