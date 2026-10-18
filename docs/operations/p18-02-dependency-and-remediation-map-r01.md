# LES-P18-02 — Dependency & Remediation Map R01

**Baseline:** `95a422a694988e3cc656b103026ef34fa8b7b2e9`  
**Natureza:** propostas futuras; nenhuma execução ou autorização P19  
**Estado:** `P18-02 = PREPARATORY CANDIDATE / AWAITING INDEPENDENT REVIEW`

## 1. Finalidade e regra de autoridade

Este mapa transforma os gaps reconciliados em candidatos revisáveis de work package. Os nomes
`P19-Axx` e `P19-Bxx` são identificadores de planejamento, não fases iniciadas nem autorizações de
execução. Cada pacote futuro exige brief próprio, baseline/branch explícitas, approval gates,
critérios de aceite e autoridade proporcional aos sistemas envolvidos.

Nenhum pacote abaixo autoriza provider, credencial, `.env`, pagamento, webhook, migration, deploy,
fault injection, mudança de código ou produção.

## 2. Dependências de entrada comuns

Antes de qualquer execução futura, o brief específico deve:

1. congelar source commit, migration tree e release alvo;
2. declarar a camada de evidência exigida: local, hosted, provider, independente ou production;
3. nomear owner, executor, janela, stop conditions, cleanup e rollback;
4. definir tratamento de segredo sem leitura ou impressão em contexto compartilhado;
5. separar inspeção read-only de mutações externas;
6. preservar evidência anterior e impedir que uma release substitua outra por inferência;
7. estabelecer impacto comercial, limites de transação e dados de teste quando aplicável;
8. exigir relatório de validação e revisão técnica independente antes de progressão.

## 3. Candidatos P19-A — preparação de launch/produção

### P19-A01 — Release, migration e provenance reconciliation

**Objetivo proposto:** estabelecer a identidade exata entre source, build, release hospedada,
runtime e schema antes de qualquer planejamento de lançamento.

**Entradas:** `95a422a…`, `96b3fda…`, parent técnico `202a43b…`, última release atestada
`0f6534f…`, árvore de migrations e registros do provider.

**Riscos/gaps:** `P18-RSK-002`, `P18-RSK-003`; suporte a `P18-REL-03`, `P18-DB-04`,
`P18-DB-06`.

**Sequência proposta:** comparação Git read-only → identidade de build/release → current-version e
runtime → migration status/schema → relatório de equivalência ou divergência. Qualquer divergência
interrompe o pacote antes de mutação.

**Authority gate:** acesso read-only a Hostinger/runtime/DB metadata requer autorização específica;
nenhum deploy ou migration está incluído.

**Saída mínima:** uma identidade independente e reproduzível ou `BLOCKED/UNKNOWN`, nunca PASS por
relato do owner.

### P19-A02 — Production environment and secret-control checklist

**Objetivo proposto:** preparar e, somente em etapa autorizada, verificar isolamento de production,
nomes/purposes de configuração, DB, R2, Mercado Pago, readiness e analytics.

**Riscos/gaps:** `P18-RSK-009`, `P18-RSK-010`, `P18-RSK-015`; suporte a `P18-ARCH-02`,
`P18-SEC-04`, `P18-DB-05`, `P18-DEL-03` e `P18-ANA-01`–`04`.

**Checklist documental:** recursos separados; credenciais PROD/TEST não intercambiáveis; readiness
secret novo; secret references; menor privilégio; rotação/revogação; nenhum valor em log/evidência;
fallback local proibido; Meta CAPI preservada como policy-blocked.

**Authority gate:** qualquer criação, leitura de valor, rotação ou configuração externa exige
autorização protegida e procedimento privado. O pacote preparatório pode registrar somente nomes e
finalidades.

### P19-A03 — Launch validation, rollback and communication plan

**Objetivo proposto:** produzir árvore de decisão para deploy/smoke/rollback/incident communication
da release final, sem executar lançamento.

**Riscos/gaps:** `P18-RSK-008`, `P18-RSK-011`, `P18-RSK-015`; suporte a `P18-REL-04`–`05`,
`P18-OBS-01`–`03`, `P18-OPS-01`, `P18-NET-01`–`02`.

**Conteúdo mínimo:** preconditions cumulativas; backup válido; migration/rollback compatibility;
smokes positivos e negativos; headers/HTTPS/redirect; readiness privada; monitor/alert routes;
critérios de rollback; comunicação; owner e janela; separação de application rollback e data
recovery.

**Authority gate:** P19-C e produção continuam fora do escopo. O plano não concede deploy.

## 4. Candidatos P19-B — remediação técnica e evidência faltante

### P19-B01 — E05 webhook HMAC differential and correlation

**Escopo proposto:** investigar `HMAC_MISMATCH / NEITHER_MATCH` com a mesma notificação identificada
em provider, logs sanitizados e DB; comparar bytes/manifest de forma segura; provar uma entrega
autenticada sem expor segredo.

**Mapeamento:** `P18-BLK-E05`; `P18-PAY-03`.

**Dependências:** P19-A01 para release binding; autorização Mercado Pago/Hostinger/DB; procedimento
privado de segredo; stop imediato em divergência ou disclosure risk.

**Fechamento:** HMAC válido, readback/reconciliação aplicados e correlação independente. Nenhuma
normalização diagnóstica pode virar bypass.

### P19-B02 — Mercado Pago refusal and responsive Brick matrix

**Escopo proposto:** executar uma janela TEST controlada para F01 e R01–R03, com limites de
transação, viewports aprovados, cleanup e ausência de entitlement em recusa.

**Mapeamento:** `P18-BLK-F01`, `P18-BLK-R01`–`03`; `P18-PAY-02`, `P18-PAY-05`, `P18-UX-01`.

**Dependências:** P19-A01; E05 não precisa ser artificialmente marcado PASS para observar F01, mas
qualquer claim de jornada completa continua bloqueado; credenciais TEST e browser/provider authority.

**Fechamento:** recusa real fail-closed e Brick funcional nos três viewports, com evidência
release-bound e nenhum pagamento PROD.

### P19-B03 — Buyer Access and delivery failure matrix

**Escopo proposto:** B01/B03–B06 em pacotes bounded: credencial inválida, rate limit, storage
unavailable, stream failure e audit failure. B07 fica isolado em P19-B07.

**Mapeamento:** `P18-BLK-B01`, `P18-BLK-B03`–`B06`; `P18-DEL-01`–`05`.

**Dependências:** release/storage binding; fixtures não comerciais; fault injection explicitamente
autorizada; garantia de zero byte indevido e cleanup.

**Fechamento:** respostas sanitizadas, direitos preservados, audit/telemetry coerentes e nenhum dado
de provider exposto.

### P19-B04 — Performance evidence authority and acceptance

**Escopo proposto:** reconciliar primeiro a provenance da cápsula existente; executar somente a
medição mínima ainda necessária contra o budget aprovado.

**Mapeamento:** `P18-BLK-PR01`–`04`; `P18-PERF-01`.

**Dependências:** P19-A01; ambiente e release imutáveis; metodologia aprovada; ausência de carga
externa sem autorização.

**Fechamento:** identidade verificável, critérios aplicados sem seleção de amostras e classificação
por cenário. Resultado numérico sozinho continua insuficiente.

### P19-B05 — Supply-chain remediation and platform governance

**Escopo proposto:** remover a condição `braces@3.0.3` por caminho oficial suportado, repetir audit e
regressões e verificar read-only os controles atuais da plataforma GitHub.

**Mapeamento:** `P18-RSK-001`, `P18-RSK-013`; `P18-SEC-05`–`07`.

**Prazo herdado:** antes de `13/11/2026 23:59:59 America/Sao_Paulo` ou do P19 closeout, o que vier
primeiro. Expiração é fail-closed.

**Dependências:** autorização para alterar dependências; análise de compatibilidade; CI; revisão do
source diff. Não reduzir pacote para uma versão major incompatível só para silenciar audit.

**Fechamento:** audit completo sem finding aceito, runtime/dev trees entendidas, regressões e revisão
independente.

### P19-B06 — Backup retention, off-R2 and consistency

**Escopo proposto:** separar três subproblemas: execução segura 7/4/3, cópia cifrada em domínio
independente e consistência/reconciliação do ponto sequencial DB/R2.

**Mapeamento:** `P18-RSK-004`, `P18-RSK-005`, `P18-RSK-006`; `P18-BCP-01`–`07`.

**Dependências:** owner de dados; política de retenção/legal hold; provider access; chaves sob
custódia separada; restore isolado; nenhuma deleção antes de dry-run, revisão e rollback.

**Fechamento:** cobertura histórica verificada, lifecycle/deletion auditável, round-trip off-R2 e
protocolo de consistência provado. RPO/RTO P16 não fecha automaticamente esses gaps.

### P19-B07 — Administrative delivery recovery atomicity

**Escopo proposto:** aprovar e implementar a unidade atômica de revogação, reissue, unicidade e
`AdminAuditEvent`, com rollback e adversariais.

**Mapeamento:** `P18-BLK-B07`, `P18-RSK-012`; `P18-ID-04`, `P18-DEL-04`–`05`.

**Dependências:** decisão arquitetural; autorização para auth/admin e possivelmente schema/migration;
RBAC/fresh-auth; testes MySQL isolados. Nenhum update direto ou workaround manual.

**Fechamento:** sucesso e todas as falhas preservam atomicidade, audit obrigatório e não duplicidade.

### P19-B08 — CSP, headers and redeploy hardening

**Escopo proposto:** decidir arquitetura nonce/hash, preservar compatibilidade do Payment Brick e
revalidar CSP/HTTPS/redirect após deploy.

**Mapeamento:** `P18-RSK-007`, `P18-RSK-008`; `P18-SEC-01`–`02`, `P18-NET-01`–`02`.

**Dependências:** browser/provider regressions; ambiente hospedado autorizado; ownership da CSP pela
aplicação; inspeção da camada Hostinger.

**Fechamento:** CSP forte sem regressão, headers/redirect coerentes e resultado vinculado à release.

### P19-B09 — Production observability, SLO and capacity

**Escopo proposto:** definir owners e SLOs; completar monitor coverage, alert routes/on-call e modelo
de capacidade não destrutivo.

**Mapeamento:** `P18-RSK-011`, `P18-RSK-016`; `P18-ARCH-03`, `P18-OBS-01`–`03`, `P18-OPS-01`,
`P18-PERF-01`.

**Dependências:** P19-A01/A02; baseline de tráfego e recursos; política de dados; autorização para
monitores externos/teste de alerta. Nenhum owner ou SLO deve ser inventado.

**Fechamento:** sinais por componente, amostras, thresholds, escalonamento, status projection e
capacidade aceitos para a release candidata.

### P19-B10 — Privacy and analytics authorization

**Escopo proposto:** revisar minimização, retenção, consent mapping e configuração de analytics; manter
Meta CAPI bloqueada até decisão explícita sobre matching data/privacy.

**Mapeamento:** `P18-RSK-014`; `P18-ANA-01`–`04`.

**Dependências:** owner/legal/privacy; inventário de providers; P19-A02; teste sem PII em evidência.

**Fechamento:** decisão documentada, configuração consent-aware, retenção e smoke autorizados. A
ausência de autorização resulta em manter a integração desligada, não em bypass.

## 5. Sequenciamento recomendado

```text
Independent review of P18-02
  -> briefs e autorizações próprios
  -> P19-A01 release/schema identity
     -> P19-B01/B02/B03/B04 evidence gaps
     -> P19-A02 environment/secrets
        -> P19-B06/B08/B09/B10 readiness controls
  -> P19-B05 antes da expiração e antes de produção
  -> P19-B07 somente após decisão arquitetural protegida
  -> P19-A03 consolida plano de launch/rollback
  -> decisão formal P18 + Gate D PASS + Gate E GO + autorização owner
  -> somente então um eventual P19-C
```

Dependências podem ser executadas em paralelo apenas quando seus briefs autorizarem e não houver
contaminação de evidência, concorrência em provider ou risco comercial compartilhado.

## 6. Matriz de cobertura dos 31 registros

| Pacote candidato | Registros primários |
| --- | --- |
| P19-A01 | RSK-002, RSK-003 |
| P19-A02 | RSK-009, RSK-010 |
| P19-A03 | RSK-008, RSK-015 |
| P19-B01 | BLK-E05 |
| P19-B02 | BLK-F01, BLK-R01, BLK-R02, BLK-R03 |
| P19-B03 | BLK-B01, BLK-B03, BLK-B04, BLK-B05, BLK-B06 |
| P19-B04 | BLK-PR01, BLK-PR02, BLK-PR03, BLK-PR04 |
| P19-B05 | RSK-001, RSK-013 |
| P19-B06 | RSK-004, RSK-005, RSK-006 |
| P19-B07 | BLK-B07, RSK-012 |
| P19-B08 | RSK-007; RSK-008 compartilhado com A03 |
| P19-B09 | RSK-011, RSK-016 |
| P19-B10 | RSK-014 |

Todos os 31 registros possuem rota candidata. Rotear não equivale a aceitar, remediar, atribuir
owner, definir prazo novo ou autorizar execução.

## 7. Stop gates cumulativos

- `GATE D = NOT_READY` impede tratar o backlog herdado como tecnicamente encerrado.
- A decisão formal P18 ainda não existe.
- `GATE E = GO NOT AUTHORIZED` impede launch approval.
- `PRODUCTION = NOT AUTHORIZED` impede P19-C, deploy, smoke, compra real e operação produtiva.
- `LES-SEC-RA-001` é hard stop independente enquanto o finding estiver presente.
- Qualquer baseline divergence, segredo exposto, identidade de release desconhecida ou autoridade
  insuficiente resulta em `BLOCKED/UNKNOWN`, não em inferência.

## 8. Resultado

Este documento é um mapa preparatório e não inicia P19-A, P19-B ou P19-C.

`P18-02 = PREPARATORY CANDIDATE / AWAITING INDEPENDENT REVIEW`

`GATE E = GO NOT AUTHORIZED`

`PRODUCTION = NOT AUTHORIZED`
