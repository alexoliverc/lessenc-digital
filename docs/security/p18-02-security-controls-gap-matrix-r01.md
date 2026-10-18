# LES-P18-02 — Security Controls & Gap Matrix R01

**Baseline:** `95a422a694988e3cc656b103026ef34fa8b7b2e9`  
**Natureza:** revisão documental e inspeção estática não mutativa  
**Estado:** `P18-02 = PREPARATORY CANDIDATE / AWAITING INDEPENDENT REVIEW`

## 1. Regra de classificação

Esta matriz complementa o [inventário P18-01](../operations/p18-readiness-inventory-r01.md), sem
substituí-lo nem promover implementação estática a evidência runtime. Severidades são repetidas
somente quando já atribuídas pela fonte; nos demais casos permanece `NÃO ATRIBUÍDA`.

`LES-SEC-RA-001` permanece `HIGH / DEVELOPMENT-CI ONLY / PRODUCTION BLOCKED`, expira em
`13/11/2026 23:59:59 America/Sao_Paulo` e não é renovada, ampliada ou aceita novamente por esta
revisão.

## 2. Matriz de controles e gaps

| Família de controle | P18-01 | Implementação estática observada | Evidência de maior autoridade já documentada | Gap atual | Risco/bloqueio | Condição de fechamento |
| --- | --- | --- | --- | --- | --- | --- |
| Governança e gates | GOV-01–02 | precedência e estados codificados em fontes canônicas | documental/Git | revisão independente pendente; gates fechados | RSK-015 | revisão favorável sem alterar Gate D/E |
| Ambientes e configuração | ARCH-01–02 | schema estrito; produção separada; hosted sem fallback local | hosted P16/staging | production não verificada | RSK-009, RSK-010, RSK-015 | inventário por nome, segregação e validação privada autorizada |
| Capacidade | ARCH-03 | rate limit DB e pool limitado | local/diagnostic | capacidade/SLO produtivos desconhecidos | RSK-011, RSK-016 | modelo e evidência não destrutiva aceitos |
| Identidade de release | REL-01–05 | release binding/guards versionados | P16 `22fad0f…`; P17 histórico `0f6534f…` | HEAD atual e deploy informado sem atestação | RSK-002, RSK-003, RSK-015 | correlação release/runtime/schema independente |
| CSP e headers | SEC-01–02 | HSTS, CSP route-sensitive, nosniff, frame/referrer/permissions | hosted P16 | `unsafe-inline`; edge/redirect temporal | RSK-007, RSK-008 | nonce/hash se aprovado e revalidação pós-deploy |
| Logging/redaction | SEC-03 | logger estruturado, allowlists e redação recursiva | local + negativos hosted históricos | retenção e integrações production não verificadas | RSK-010, RSK-011 | smoke e inspeção de logs sem valores sensíveis |
| Segredos | SEC-04 | env schema e valores client/server separados | static/hosted histórico | rotação e não reuso production não verificados | RSK-009, RSK-010 | secret references segregadas e negativos autorizados |
| Supply chain | SEC-05–07 | workflows/CodeQL/Dependabot e evaluator fail-closed | CI histórica/local | quatro nós HIGH dev/CI; plataforma atual não consultada | RSK-001, RSK-013 | remediação oficial, audit completo e governança atual |
| Admin auth/MFA | ID-01–03 | Better Auth, MFA, sessão persistida, cookie `__Host-`, fresh auth | hosted P17 histórico | produção/release atual não verificadas | RSK-010, RSK-015 | negativos e configuração na release autorizada |
| Admin recovery/audit | ID-04 | permissão definida; ação não exposta | local/documental | atomicidade reissue/audit ausente | BLK-B07, RSK-012 | desenho, transação, rollback e adversariais |
| DB/TLS/grants | DB-01–03 | CA/rejectUnauthorized, hostname, verifier least privilege | hosted P16 | production não verificada | RSK-010, RSK-015 | TLS/endpoint/grants produtivos verificados |
| Migrations/rollback | DB-04–06 | guard, release binding e compatibility tooling | F06 local; P16 rollback histórico | nona migration hosted e rollback atual não atestados | RSK-002, RSK-003, RSK-006 | árvore/schema/release e plano reconciliados |
| Autoridade financeira | PAY-01, PAY-04, PAY-06 | readback, idempotência, transação e entitlement server-side | local + happy path hosted histórico | evidência release-bound; migration F06 | RSK-002, RSK-003 | preservar invariantes e reconciliar release/schema |
| Webhook HMAC | PAY-03 | manifest canônico, HMAC SHA-256, timing-safe compare, diagnóstico sanitizado | negativos locais | real TEST `HMAC_MISMATCH / NEITHER_MATCH` | BLK-E05 | mesma entrega correlacionada com HMAC válido |
| Provider/Brick | PAY-02, PAY-05 | adapter estrito e presentation boundary | Card Brick TEST histórico | recusa real e viewports faltam; PROD não autorizado | BLK-F01, BLK-R01–03 | janela TEST controlada e matriz responsiva |
| Buyer identity/access | DEL-01–02 | token opaco/digest, sessão HMAC, entitlement server-side | G5 hosted histórico | B01 externo e release atual | BLK-B01 | negação/correlação na release autorizada |
| Delivery fail-closed | DEL-04–05 | autorização antes do storage; audit antes de bytes | local/hosted histórico parcial | rate limit/storage/stream/audit/recovery não fechados | BLK-B03–07 | fault matrix e recovery atômico |
| R2 private storage | DEL-03 | Head/Get only, no public/presigned/list/write, streaming | P16 hosted | production e fault paths não verificados | BLK-B04–05, RSK-005 | least privilege e falhas em ambiente autorizado |
| Backup/integridade | BCP-01–03 | recovery unit v2 cifrada/autenticada, restore isolado | P16 hosted RPO/RTO | release atual e cópia independente | RSK-005, RSK-006 | cópia off-R2, restore e consistência comprovados |
| Retenção | BCP-04 | planner determinístico `PLAN_ONLY` | local/documental | nenhuma cobertura/deletion/lifecycle | RSK-004 | 7/4/3 executável com hold, rollback e prova |
| RPO/RTO/rollback | BCP-05–07 | evaluators de autoridade estrita; rollback plan-only | P16 RPO 888 ms/RTO < 8 h | não prova lançamento atual; rollback live não executado | RSK-005, RSK-006, RSK-015 | rehearsal e objetivos vinculados à release final |
| Readiness/alerts | OBS-01–03 | liveness separada, bearer timing-safe, alert catalog/dedupe | staging P16 histórico | SLO/monitors/on-call production ausentes | RSK-009, RSK-011 | secret novo, monitors, routes e amostras |
| Incidentes | OPS-01 | runbooks e severidades documentados | documental/local | owners/escalation/drill production não verificados | RSK-011, RSK-015 | ownership e exercício autorizado |
| HTTPS/DNS | NET-01–02 | application headers e URLs canônicas | hosted P16 histórico | edge/DNS/certificados são temporais | RSK-008, RSK-015 | revalidação temporal pós-deploy |
| Consent/analytics | ANA-01–04 | consent snapshot, dispatch isolado, Meta policy block | local histórico | privacy/retention/config production não verificadas | RSK-010, RSK-014, RSK-015 | decisão de privacidade e smoke autorizado |
| UX/performance | UX-01, PERF-01 | projetos de viewport e cápsula versionados | local/provisional | R01–03 e PR01–04 não aceitos | BLK-R01–03, BLK-PR01–04, RSK-016 | prova responsiva/provider e provenance aceita |

## 3. Transporte integral das 15 pendências P17

| P17 | Registro P18 | Estado preservado | Evidência que falta | Resultado P18-02 |
| --- | --- | --- | --- | --- |
| P17-E05 | P18-BLK-E05 | BLOCKED / DEFERRED | webhook real TEST autenticado e correlacionado | inalterado |
| P17-F01 | P18-BLK-F01 | PENDING_EXTERNAL / DEFERRED | recusa provider TEST real e ausência de entitlement | inalterado |
| P17-B01 | P18-BLK-B01 | PENDING_EXTERNAL / DEFERRED | negação Buyer na autoridade aplicável | inalterado |
| P17-B03 | P18-BLK-B03 | NOT_EXECUTED / DEFERRED | rate limit Buyer controlado | inalterado |
| P17-B04 | P18-BLK-B04 | NOT_EXECUTED / DEFERRED | storage unavailable fail-closed | inalterado |
| P17-B05 | P18-BLK-B05 | NOT_EXECUTED / DEFERRED | stream failure/cleanup/audit | inalterado |
| P17-B06 | P18-BLK-B06 | NOT_EXECUTED / DEFERRED | nenhum byte sem audit obrigatório | inalterado |
| P17-B07 | P18-BLK-B07 | NOT_EXECUTED / DEFERRED | recovery/reissue/audit atômicos | inalterado |
| P17-R01 | P18-BLK-R01 | PENDING_EXTERNAL / DEFERRED | Brick real em 390x844 | inalterado |
| P17-R02 | P18-BLK-R02 | PENDING_EXTERNAL / DEFERRED | Brick real em 768x1024 | inalterado |
| P17-R03 | P18-BLK-R03 | PENDING_EXTERNAL / DEFERRED | Brick real em 1440x900 | inalterado |
| P17-PR01 | P18-BLK-PR01 | PROVISIONAL / DEFERRED | public navigation com provenance/authority aceitas | inalterado |
| P17-PR02 | P18-BLK-PR02 | PROVISIONAL / DEFERRED | checkout interaction contra budget aprovado | inalterado |
| P17-PR03 | P18-BLK-PR03 | PROVISIONAL / DEFERRED | payment initiation na autoridade requerida | inalterado |
| P17-PR04 | P18-BLK-PR04 | PROVISIONAL / DEFERRED | buyer delivery start na release hospedada | inalterado |

## 4. Transporte integral dos 31 riscos e bloqueadores

A descrição completa, impacto, condição de fechamento, owner/prazo e próxima ação de cada registro
permanecem no [registro canônico P18-01](../operations/p18-risk-and-blocker-register-r01.md). A tabela
abaixo transporta todos os IDs e seus estados sem reclassificação.

| ID | Severidade/classificação herdada | Estado herdado | Dependência candidata | Disposição P18-02 |
| --- | --- | --- | --- | --- |
| P18-RSK-001 | HIGH / development-CI only / production hard stop | TEMPORARY ACCEPTED RISK / BLOCKED FOR PRODUCTION | P19-B05 | inalterado; expira 13/11/2026 23:59:59 America/Sao_Paulo |
| P18-BLK-E05 | CRITICAL Gate D | BLOCKED / DEFERRED | P19-B01 | inalterado |
| P18-BLK-F01 | CRITICAL Gate D | PENDING_EXTERNAL / DEFERRED | P19-B02 | inalterado |
| P18-BLK-B01 | CRITICAL Gate D | PENDING_EXTERNAL / DEFERRED | P19-B03 | inalterado |
| P18-BLK-B03 | HIGH | NOT_EXECUTED / DEFERRED | P19-B03 | inalterado |
| P18-BLK-B04 | CRITICAL Gate D | NOT_EXECUTED / DEFERRED | P19-B03 | inalterado |
| P18-BLK-B05 | HIGH | NOT_EXECUTED / DEFERRED | P19-B03 | inalterado |
| P18-BLK-B06 | CRITICAL Gate D | NOT_EXECUTED / DEFERRED | P19-B03 | inalterado |
| P18-BLK-B07 | CRITICAL Gate D | NOT_EXECUTED / DEFERRED | P19-B07 | inalterado |
| P18-BLK-R01 | HIGH / obrigatório Gate D | PENDING_EXTERNAL / DEFERRED | P19-B02 | inalterado |
| P18-BLK-R02 | HIGH / obrigatório Gate D | PENDING_EXTERNAL / DEFERRED | P19-B02 | inalterado |
| P18-BLK-R03 | HIGH / obrigatório Gate D | PENDING_EXTERNAL / DEFERRED | P19-B02 | inalterado |
| P18-BLK-PR01 | requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | P19-B04 | inalterado |
| P18-BLK-PR02 | requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | P19-B04 | inalterado |
| P18-BLK-PR03 | requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | P19-B04 | inalterado |
| P18-BLK-PR04 | requisito obrigatório; severidade NÃO ATRIBUÍDA | PROVISIONAL / DEFERRED | P19-B04 | inalterado |
| P18-RSK-002 | NÃO ATRIBUÍDA / release blocker | OWNER-REPORTED / INDEPENDENT ATTESTATION PENDING | P19-A01 | inalterado |
| P18-RSK-003 | NÃO ATRIBUÍDA | LOCAL TEST PROVEN / HOSTED NOT PROVEN | P19-A01 | inalterado |
| P18-RSK-004 | NÃO ATRIBUÍDA | PLAN_ONLY | P19-B06 | inalterado |
| P18-RSK-005 | NÃO ATRIBUÍDA | NOT PROVEN | P19-B06 | inalterado |
| P18-RSK-006 | NÃO ATRIBUÍDA | LIMITATION ACCEPTED AS EVIDENCE, NOT REMEDIATED | P19-B06 | inalterado |
| P18-RSK-007 | MEDIUM script / LOW style | OPEN RESIDUAL | P19-B08 | inalterado |
| P18-RSK-008 | severidade nova NÃO ATRIBUÍDA | REVALIDATION REQUIRED AFTER DEPLOY | P19-A03/P19-B08 | inalterado |
| P18-RSK-009 | NÃO ATRIBUÍDA | ROTATION REQUIRED BEFORE PRODUCTION | P19-A02 | inalterado |
| P18-RSK-010 | NÃO ATRIBUÍDA / production blocker | PRODUCTION NOT VERIFIED | P19-A02 | inalterado |
| P18-RSK-011 | NÃO ATRIBUÍDA | OPEN_STAGING_BASELINE / PRODUCTION NOT VERIFIED | P19-B09 | inalterado |
| P18-RSK-012 | NÃO ATRIBUÍDA | SAFE DEFER / BLOCKED | P19-B07 | inalterado |
| P18-RSK-013 | INFORMATIONAL/OPEN no snapshot P14 | CURRENT STATE NOT VERIFIED | P19-B05 | inalterado |
| P18-RSK-014 | política; severidade técnica NÃO ATRIBUÍDA | POLICY BLOCKED | P19-B10 | inalterado |
| P18-RSK-015 | PROGRAM HARD STOP | PRODUCTION NOT AUTHORIZED | gate owner/P19-C futuro | inalterado |
| P18-RSK-016 | NÃO ATRIBUÍDA | PRODUCTION NOT VERIFIED | P19-B09 | inalterado |

Contagem: `16 hard stops/bloqueadores + 15 riscos adicionais = 31 registros`.

## 5. Hard stops de segurança

Nenhum pacote futuro pode contornar estes limites:

1. E05 permanece bloqueado até existir autenticação HMAC real e correlação independente.
2. Nenhuma recuperação administrativa pode usar update direto ou liberar ação sem audit atômico.
3. Nenhum byte de produto pode ser liberado sem entitlement, autorização de recurso, storage privado
   e audit obrigatório.
4. A aceitação `LES-SEC-RA-001` não cobre produção.
5. Meta CAPI/matching data permanece `POLICY BLOCKED`.
6. Credenciais staging não podem ser reutilizadas em produção.
7. Código, teste local ou documento não substituem release binding e evidência hospedada.
8. Gate D, decisão formal P18, Gate E GO e autorização específica do owner são cumulativos antes de
   qualquer P19-C/produção.

## 6. Resultado

Não foi identificado nem atribuído novo PASS de segurança. Os controles implementados formam uma
base defensiva, mas as lacunas transportadas são suficientes para manter:

`GATE D = NOT_READY`

`GATE E = GO NOT AUTHORIZED`

`PRODUCTION = NOT AUTHORIZED`
