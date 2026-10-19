# LES-P18-RISK-AND-BLOCKER-REGISTER-R01

**Fase:** P18 — Production Readiness Review

**Subfase:** P18-01 — Baseline & Readiness Inventory

**Data:** 18/10/2026

**Baseline:** `96b3fda29775b2db7d364b292b46b8bc3aefd364`

**Estado:** `P18-01 = PREPARATORY CANDIDATE / AWAITING INDEPENDENT RE-REVIEW`

## 1. Regra de classificação

Este registro consolida riscos e bloqueadores encontrados nas fontes canônicas sem criar nova
aceitação, severidade, responsável ou prazo. Quando a fonte não atribui esses campos, o registro usa
`NÃO DEFINIDO` em vez de inferi-los.

`DEFERRED` é sequenciamento, não encerramento. Um risco aceito continua sendo risco; uma prova de
staging continua limitada à sua release e ambiente; uma implantação informada pelo proprietário não
é elevada a atestação independente.

Estados de programa preservados:

- `P17 = ADMINISTRATIVELY CLOSED / DEFERRED ITEMS`;
- `P17-E05 = BLOCKED / DEFERRED`;
- `GATE D = NOT_READY`;
- `P18 = PREPARATORY EXECUTION AUTHORIZED / OWNER EXCEPTION`;
- `GATE E = GO NOT AUTHORIZED`;
- `PRODUCTION = NOT AUTHORIZED`.

## 2. Hard stops e bloqueadores de Gate D

| ID | Item / fonte | Tipo / severidade documentada | Estado | Exposição e impacto | Evidência faltante / condição de fechamento | Responsável documentado | Prazo documentado | Próxima ação autorizável |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P18-RSK-001 | [`LES-SEC-RA-001`](../security/les-sec-ra-001-temporary-braces-risk-acceptance.md) | HIGH / development-CI only / production hard stop | TEMPORARY ACCEPTED RISK / BLOCKED FOR PRODUCTION | `braces@3.0.3` permanece na cadeia de lint; tooling pode sofrer DoS e a aceitação não cobre produção. | Caminho oficial remove a condição; audit completo sem finding aceito; regressões e revisão explícita. | NÃO DEFINIDO; aceitação ratificada pelo owner. | 13/11/2026 23:59:59 America/Sao_Paulo; revisão até P19 closeout ou antes. | Remediação separadamente autorizada; não ampliar escopo nem prorrogar implicitamente. |
| P18-BLK-E05 | P17-E05 — [Gate D](p17-gate-d-evidence-matrix.md) | CRITICAL Gate D | BLOCKED / DEFERRED | Webhook real TEST não autenticado; `HMAC_MISMATCH / NEITHER_MATCH`; fulfillment não pode confiar na entrega. | Mesma notificação correlacionada no provider, hosted logs e DB, com HMAC válido e sem disclosure de segredo. | NÃO DEFINIDO. | NÃO DEFINIDO. | Investigação/execução read-only ou controlada sob brief e autoridade específicos. |
| P18-BLK-F01 | P17-F01 — [Gate D](p17-gate-d-evidence-matrix.md) | CRITICAL Gate D | PENDING_EXTERNAL / DEFERRED | Recusa real de provider e fail-closed comercial não provados. | Uma recusa Mercado Pago TEST real, Order/Payment reconciliados e nenhum entitlement/fulfillment. | NÃO DEFINIDO. | NÃO DEFINIDO. | Cenário TEST controlado sob autorização futura. |
| P18-BLK-B01 | P17-B01 — [Gate D](p17-gate-d-evidence-matrix.md) | CRITICAL Gate D | PENDING_EXTERNAL / DEFERRED | Credencial Buyer inválida ainda carece de autoridade externa/hosted aplicável. | Negação genérica, nenhuma sessão/byte/audit indevido e correlação na release autorizada. | NÃO DEFINIDO. | NÃO DEFINIDO. | Executar no pacote Buyer Access futuro. |
| P18-BLK-B03 | P17-B03 — [Gate D](p17-gate-d-evidence-matrix.md) | HIGH | NOT_EXECUTED / DEFERRED | Rate limit Buyer não foi exercitado na autoridade exigida. | 429/limiter fail-closed sem mutação comercial ou lockout indevido. | NÃO DEFINIDO. | NÃO DEFINIDO. | Teste controlado com limites e cleanup aprovados. |
| P18-BLK-B04 | P17-B04 — [Gate D](p17-gate-d-evidence-matrix.md) | CRITICAL Gate D | NOT_EXECUTED / DEFERRED | Indisponibilidade de storage pode interromper entrega; comportamento hospedado não provado. | Resposta sanitizada, zero byte indevido, direito comercial preservado e telemetry/audit coerentes. | NÃO DEFINIDO. | NÃO DEFINIDO. | Fault injection bounded sob brief próprio. |
| P18-BLK-B05 | P17-B05 — [Gate D](p17-gate-d-evidence-matrix.md) | HIGH | NOT_EXECUTED / DEFERRED | Falha durante stream pode deixar resposta/audit inconsistente. | Cleanup, encerramento do stream e evento de falha sem exposição de provider. | NÃO DEFINIDO. | NÃO DEFINIDO. | Teste de stream controlado sob autoridade futura. |
| P18-BLK-B06 | P17-B06 — [Gate D](p17-gate-d-evidence-matrix.md) | CRITICAL Gate D | NOT_EXECUTED / DEFERRED | Falha do audit obrigatório pode permitir entrega não auditada se a fronteira regredir. | Prova fail-closed de que nenhum byte é liberado sem audit obrigatório. | NÃO DEFINIDO. | NÃO DEFINIDO. | Teste transacional/HTTP isolado e depois correlação aplicável. |
| P18-BLK-B07 | P17-B07 — [Gate D](p17-gate-d-evidence-matrix.md) | CRITICAL Gate D | NOT_EXECUTED / DEFERRED | Recovery/reissue seguro ainda não possui fronteira atômica com `AdminAuditEvent`. | Design aprovado e prova atômica de reissue, revogação, audit e não duplicidade. | NÃO DEFINIDO. | NÃO DEFINIDO. | Work package P19-B; nenhuma atualização direta de tabela. |
| P18-BLK-R01 | P17-R01 — mobile — [Gate D](p17-gate-d-evidence-matrix.md) | HIGH / obrigatório Gate D | PENDING_EXTERNAL / DEFERRED | Brick real pode falhar/usabilidade não provada em 390x844. | Execução funcional Mercado Pago TEST no viewport aprovado. | NÃO DEFINIDO. | NÃO DEFINIDO. | Matriz real multi-viewport sob brief futuro. |
| P18-BLK-R02 | P17-R02 — tablet — [Gate D](p17-gate-d-evidence-matrix.md) | HIGH / obrigatório Gate D | PENDING_EXTERNAL / DEFERRED | Brick real não provado em 768x1024. | Execução funcional Mercado Pago TEST no viewport aprovado. | NÃO DEFINIDO. | NÃO DEFINIDO. | Matriz real multi-viewport sob brief futuro. |
| P18-BLK-R03 | P17-R03 — desktop — [Gate D](p17-gate-d-evidence-matrix.md) | HIGH / obrigatório Gate D | PENDING_EXTERNAL / DEFERRED | Brick real não provado em 1440x900. | Execução funcional Mercado Pago TEST no viewport aprovado. | NÃO DEFINIDO. | NÃO DEFINIDO. | Matriz real multi-viewport sob brief futuro. |
| P18-BLK-PR01 | P17-PR01 — public navigation — [Gate D](p17-gate-d-evidence-matrix.md) | Requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | Dados locais completos, porém provenance/authority insuficientes para PASS. | Aceite definitivo contra budget aprovado, com identidade/provenance reconciliadas. | Owner aprovou budget; executor não definido. | NÃO DEFINIDO. | Revisão da evidência e execução mínima necessária sob brief específico. |
| P18-BLK-PR02 | P17-PR02 — checkout interaction — [Gate D](p17-gate-d-evidence-matrix.md) | Requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | Mesmo limite de autoridade do pacote local. | Aceite definitivo contra budget aprovado. | Owner aprovou budget; executor não definido. | NÃO DEFINIDO. | Idem PR01. |
| P18-BLK-PR03 | P17-PR03 — payment initiation — [Gate D](p17-gate-d-evidence-matrix.md) | Requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | Medida local não prova provider/hosted release. | Aceite definitivo contra budget aprovado. | Owner aprovou budget; executor não definido. | NÃO DEFINIDO. | Idem PR01. |
| P18-BLK-PR04 | P17-PR04 — buyer delivery start — [Gate D](p17-gate-d-evidence-matrix.md) | Requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | Medida local não prova release hospedada. | Aceite definitivo contra budget aprovado. | Owner aprovou budget; executor não definido. | NÃO DEFINIDO. | Idem PR01. |

## 3. Riscos técnicos e operacionais adicionais

| ID | Item / fonte | Severidade documentada | Estado | Exposição e impacto | Condição de fechamento | Responsável / prazo documentado | Próxima ação autorizável |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P18-RSK-002 | Deploy Hostinger informado do parent técnico `202a43b…` — [brief P18](../architecture/p18-production-readiness-preparatory-phase-execution-brief.md) | NÃO ATRIBUÍDA / release blocker | OWNER-REPORTED / INDEPENDENT ATTESTATION PENDING | O HEAD Git integrado P17 é `96b3fda…`; runtime, release binding, build, publish, switch e restart do deploy informado de `202a43b…` não podem ser atribuídos de forma independente. | Correlação read-only com Git/release/env/runtime e comparação apropriada de código. | NÃO DEFINIDO / NÃO DEFINIDO. | Atividade externa fora da P18-02; exige novo brief e autorização específica; não herdar P17-L04 de `0f6534f…`. |
| P18-RSK-003 | Migration F06 hosted — [Gate D](p17-gate-d-evidence-matrix.md) | NÃO ATRIBUÍDA | LOCAL TEST PROVEN / HOSTED NOT PROVEN | O parent técnico `202a43b…` pode depender da nona migration sem atestação de schema hosted; o merge documental `96b3fda…` não adiciona prova runtime. | Release, migration tree e status hospedado reconciliados sem inferir ou aplicar mutation. | NÃO DEFINIDO / NÃO DEFINIDO. | Atividade externa fora da P18-02; exige novo brief e autorização específica antes de qualquer futura janela de migration. |
| P18-RSK-004 | Retenção 7 daily / 4 weekly / 3 monthly — [P16-08](p16-backup-recovery-candidate.md) | NÃO ATRIBUÍDA | PLAN_ONLY | Não há prova de cobertura histórica nem autoridade de deletion/lifecycle. | Política executável, cobertura verificada, revisão de deleção e rollback/hold. | NÃO DEFINIDO / NÃO DEFINIDO. | Desenhar implementação e aprovação separada; nenhuma deleção agora. |
| P18-RSK-005 | Final off-R2 copy — [P16-08](p16-backup-recovery-candidate.md) | NÃO ATRIBUÍDA | NOT PROVEN | O ponto final P16 não tem cópia independente comprovada fora do domínio R2. | Cópia cifrada, inventário, hash round-trip, acesso de restore e custódia separados. | NÃO DEFINIDO / NÃO DEFINIDO. | Work package de backup sob autoridade de provider. |
| P18-RSK-006 | Captura DB/R2 sequencial — [P16-08](p16-backup-recovery-candidate.md) | NÃO ATRIBUÍDA | LIMITATION ACCEPTED AS EVIDENCE, NOT REMEDIATED | Recovery unit não é snapshot cross-system atômico; pode existir janela lógica. | Protocolo de consistência/quiescence ou reconciliação formal provado. | NÃO DEFINIDO / NÃO DEFINIDO. | Arquitetar em P19-B se requerido pelo go/no-go. |
| P18-RSK-007 | CSP `unsafe-inline` — [P14](../security/p14-security-hardening-candidate.md) | MEDIUM script / LOW style | OPEN RESIDUAL | Strict CSP parcial; defesa XSS depende de outras camadas. | Nonce/hash architecture aprovada, provider/browser regression e hosted validation. | NÃO DEFINIDO / NÃO DEFINIDO. | Não mudar na P18-01; avaliar prioridade no formal P18. |
| P18-RSK-008 | `.htaccess`/Force HTTPS após redeploy — [P16-07](../security/p16-hosted-security-validation.md) | Risco operacional derivado do finding F02 remediado; nova severidade NÃO ATRIBUÍDA | REVALIDATION REQUIRED AFTER DEPLOY | Provider pode regenerar `.htaccess`, afetando redirect; CSP deve permanecer application-owned. | Teste funcional de redirect/CSP após cada deploy. | NÃO DEFINIDO / antes de aceitar qualquer release. | Adicionar ao checklist P19-A. |
| P18-RSK-009 | Readiness secret staging — [arquitetura P16](../architecture/p16-staging-deployment-architecture.md) | NÃO ATRIBUÍDA | ROTATION REQUIRED BEFORE PRODUCTION | Token é staging-only; reuso violaria isolamento. | Novo segredo production, transporte por secret reference, negativos e monitor autorizado. | NÃO DEFINIDO / antes de produção. | Planejar rotação sem ler/imprimir valor. |
| P18-RSK-010 | Segredos/configuração production — [brief P18](../architecture/p18-production-readiness-preparatory-phase-execution-brief.md) | NÃO ATRIBUÍDA / production blocker | PRODUCTION NOT VERIFIED | Isolamento, força, não reuso e presença efetiva não verificados. | Inventário por nome/purpose e verificação privada no ambiente autorizado. | NÃO DEFINIDO / antes de P19-C. | Preparar checklist; valores ficam fora do contexto documental. |
| P18-RSK-011 | Monitoring/SLO/component coverage — [arquitetura P16](../architecture/p16-staging-deployment-architecture.md) | NÃO ATRIBUÍDA | `OPEN_STAGING_BASELINE` / PRODUCTION NOT VERIFIED | Status público cobre Website; demais componentes e SLOs não têm sinais reais publicados. | Monitors, samples, alert routes, on-call e public projection coerentes. | Owners abstratos P15 / NÃO DEFINIDO. | Preparar plano P19-A; não inventar SLO ou owner. |
| P18-RSK-012 | Administrative delivery recovery — [P12 final](p12-final-gate.md) | NÃO ATRIBUÍDA | SAFE DEFER / BLOCKED | Não há transação atômica provada entre reissue e AdminAudit obrigatório. | Arquitetura aprovada, rollback e provas adversariais. | NÃO DEFINIDO / NÃO DEFINIDO. | P19-B separado; sem workaround manual. |
| P18-RSK-013 | GitHub platform controls — [P14](../security/p14-security-hardening-candidate.md) | INFORMATIONAL/OPEN no snapshot P14 | CURRENT STATE NOT VERIFIED | P14 observou branch protection/ruleset e recursos de security desabilitados; estado pode ter mudado. | Inspeção atual read-only e decisão de governança. | NÃO DEFINIDO / NÃO DEFINIDO. | Verificar sob autorização futura; não tratar snapshot como estado atual. |
| P18-RSK-014 | Meta CAPI/matching data — [P13-H](p13-h-final-gate.md) | Política, sem severidade técnica atribuída | POLICY BLOCKED | Ativação violaria `MATCHING_DATA_POLICY_NOT_AUTHORIZED / PRIVACY_POLICY`. | Decisão de privacidade explícita, minimização e autorização provider. | NÃO DEFINIDO / NÃO DEFINIDO. | Manter desativado. |
| P18-RSK-015 | Produção inteira — `ROADMAP.md` / [ADR-0012](../decisions/ADR-0012-p17-administrative-close-p18-preparatory-exception.md) | PROGRAM HARD STOP | PRODUCTION NOT AUTHORIZED | Ambiente, release, DB, storage, Mercado Pago PROD, webhook, backup, observabilidade, analytics, smoke e compra real não verificados. | Gate D PASS + decisão formal P18 + Gate E GO + autorização específica do owner. | Owner / NÃO DEFINIDO. | Nenhuma execução P19-C até as quatro condições. |
| P18-RSK-016 | Capacidade/scalability — [P14](../security/p14-security-hardening-candidate.md), [Gate D](p17-gate-d-evidence-matrix.md) | NÃO ATRIBUÍDA | PRODUCTION NOT VERIFIED | Rate limits possuem regressão local e performance possui pacote numérico provisório, mas banco/hosting/concorrência/SLO produtivos não foram validados. | Modelo de carga aprovado, critérios/SLO e evidência não destrutiva na release aplicável. | NÃO DEFINIDO / NÃO DEFINIDO. | Incluir no formal P18/P19-A; não executar carga externa sem autorização. |

## 4. Priorização por valor e menor risco

Esta ordem é uma recomendação de backlog, não autorização de execução. P18-02 permanece uma revisão
documental e técnica não mutativa; as atividades externas abaixo dependem de novo brief e autorização
específica, e as remediações herdadas continuam destinadas à P19-B:

1. **P18-02:** revisar integralmente os documentos, referências, classificações e propostas, sem
   consultar sistemas externos ou remediar controles.
2. **Atividade externa futura:** atestar o deploy informado de `202a43b…`, incluindo binding e
   migration status, somente sob novo brief e autorização específica.
3. **P19-B:** resolver P17-E05 por correlação read-only primeiro, evitando segredo no contexto;
   qualquer consulta privada exige procedimento e autoridade próprios.
4. **P19-B:** agrupar os cenários Mercado Pago TEST e Brick em uma janela controlada para F01 e
   R01–R03, com limites de transação e cleanup definidos.
5. **P19-B:** executar Buyer Access/failure/recovery em pacotes fail-closed, separando fault
   injection de qualquer operação comercial.
6. **P19-B:** reconciliar a autoridade da performance existente antes de gerar novas 600 amostras.
7. **P19-B/produção:** fechar hard stops: RA-001, retenção/off-R2/consistência, recovery
   administrativo, segredos e monitors de produção.

## 5. Resultado

O registro contém bloqueadores suficientes para impedir decisão GO:

`GATE D = NOT_READY`

`GATE E = GO NOT AUTHORIZED`

`PRODUCTION = NOT AUTHORIZED`

Nenhum item foi remediado, aceito novamente ou reclassificado como PASS por esta consolidação.
