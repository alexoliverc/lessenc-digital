# P18-08 — Release Engineering & Operational Go/No-Go Package R01

**Data:** 18/10/2026

**Release candidate técnica:** `a780faa6d9275b1f9abfae2ad812aa0a2d78402a`

**Estado:** `CANDIDATE IDENTIFIED / RELEASE NOT AUTHORIZED`

## Identidade e proveniência

| Elemento | Identidade | Estado |
| --- | --- | --- |
| repositório | `alexoliverc/lessenc-digital` | verificado |
| branch de integração | `phase/p17-end-to-end-business-validation` | HEAD remoto `a780faa…` |
| primeiro pai | `70430d91644b36b47b747365ad301cc96644071d` | governança P18 integrada |
| segundo pai | `67fa2e914f741c0e70d9b957002be9f6fca14ed9` | remediação técnica P18-05 |
| PR técnico | #64 | merged; pre-merge CI/CodeQL PASS |
| `main` | `6e269e6db928b228babd8ffd44c3f55574cade4c` | inalterada |
| schema blob | `588fe8a1f620c458ed23c2899ee9dbb8b0bab0ec` | idêntico à baseline anterior |
| migrations tree | `5e873b75719f3faa25230a49021d3758e500c90e` | 9 migrations; idêntico à baseline anterior |
| patch tarball SHA-256 | `2d51d7d5d2c7742e2de93dcba052f14a8ab8295e1969822596b2abe19a83aa25` | hash-pinned |
| build CI | Next 16.3.8 / Node 24.21.0 / npm 11.19.1 | PASS sintético e hospedado; no deploy authority |
| capsule offline | cache vinculado ao lock anterior | BLOCKED / RESEAL REQUIRED |

O merge documental deste dossiê não altera `src/`, Prisma, manifest ou lockfile; portanto a
identidade técnica da candidata continua `a780faa…`. O commit documental final será registrado
separadamente como proveniência do dossiê, não como deploy.

## Matriz de configuração por ambiente

Somente nomes e responsabilidades; valores permanecem fora do documento.

| Classe | Local/TEST | Staging | Production |
| --- | --- | --- | --- |
| `APP_ENV`, URL e release binding | sintético/validável | histórico P16/P17 | NOT VERIFIED |
| DB runtime/migration URL e CA | isolado/histórico | histórico P16 | NOT VERIFIED |
| Mercado Pago credentials/webhook | TEST only | TEST histórico parcial | PROD FORBIDDEN / NOT CONFIGURED HERE |
| R2 endpoint/bucket/credentials | privado histórico | histórico P16 | NOT VERIFIED |
| auth/session secrets | fictícios em CI | privados históricos | ROTATION/SEGREGATION REQUIRED |
| analytics/provider IDs | consent-gated | Meta/GTM N/A observado | LEGAL/CONFIG REVIEW REQUIRED |
| observability/status/alerts | local/histórico | histórico P15/P16 | OWNERS/SLO/BACKEND PENDING |

## Checklist pré-release

| Gate | Condição objetiva | Estado |
| --- | --- | --- |
| source freeze | commit/parents/PR identificados | PASS Git |
| clean install/audit | `npm ci` e audit zero | PASS local + hosted CI |
| quality/build | lint/typecheck/1.132 tests/build | PASS local + hosted CI |
| CodeQL | análise da RC | PASS pre-merge; pós-merge registrada separadamente |
| schema/migrations | hashes e compatibilidade | PASS Git; hosted current release NOT VERIFIED |
| offline/reproducible capsule | cache selado para lock atual | BLOCKED |
| Gate D | todos os 15 itens aceitos | NOT_READY |
| secrets production | provisionados/rotacionados/least privilege | NOT EXECUTED |
| DB/R2 backup | recovery unit + retenção/off-R2 | BLOCKED/PARTIAL |
| DNS/HTTPS | production verified | NOT EXECUTED |
| provider TEST negatives | E05/F01 | BLOCKED/NOT EXECUTED |
| Buyer/failure matrix | B01/B03–B07 | BLOCKED/NOT EXECUTED |
| responsive/performance | R01–R03/PR01–PR04 | PARTIAL/DEFERRED |
| owner decision | Gate E GO + autorização específica | NOT AUTHORIZED |

## Smoke plan futuro — não executado

Ordem obrigatória: release identity → readiness → headers/TLS → página/oferta → checkout sem mutação
financeira → auth negatives → provider TEST autorizado → webhook/DB correlation → entitlement e
private delivery → admin/audit → observability. Cada positivo deve ter negativo correspondente;
falha CRITICAL interrompe a janela.

Critérios STOP/NO-GO imediatos:

- release/HEAD/build/schema não correlacionados;
- audit ou CodeQL com HIGH/CRITICAL não aceito;
- HMAC inválido, estado financeiro inconsistente ou entitlement indevido;
- segredo/PII em log/resposta/bundle;
- DB/R2/backup alvo desconhecido ou grants excessivos;
- rollback/backup/smoke sem evidência;
- Gate D não PASS, Gate E não GO ou autorização owner ausente.

## Árvore de rollback

1. Interromper tráfego/ativação futura antes de nova mutação.
2. Preservar logs sanitizados, release ID e correlação; não apagar dados.
3. Classificar se falha é configuração, app, schema, DB, R2 ou provider.
4. Para app-only e schema compatível, reverter current-version à release previamente atestada.
5. Para schema/data, não executar downgrade/restore sem backup verificado e plano específico.
6. Validar readiness, negativos de auth, integridade financeira e private delivery.
7. Comunicar owner/incident roles e manter NO-GO até revisão.

O target `70430d9…` é schema-compatible com a RC pelo tree/blob idêntico, mas não foi implantado nem
testado como rollback. O checkpoint P16 continua break-glass histórico e reverteria outras
correções; não é selecionado automaticamente.

## P19 — preparação somente

- **P19-A:** materializar configuração/owners/janela, reseal do capsule, backup pré-release, DNS/TLS,
  secrets e smoke/rollback; não ativa produção.
- **P19-B:** resolver E05/F01, Buyer/failures, recovery, responsive e performance com briefs e
  autoridades próprios.
- **P19-C:** somente após Gate D PASS, decisão formal P18, Gate E GO e autorização owner específica.

Nenhuma subfase P19 foi iniciada por este pacote.

## Recomendação

`NO-GO RECOMMENDED`. A candidata é identificável e buildável, mas não release-ready por Gate D,
capsule offline, recovery/backup, provider e production configuration pendentes.
