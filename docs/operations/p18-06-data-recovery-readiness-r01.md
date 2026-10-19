# P18-06 — Data Integrity, Backup & Disaster Recovery Readiness R01

**Data:** 18/10/2026

**Release técnica:** `a780faa6d9275b1f9abfae2ad812aa0a2d78402a`

**Estado:** `LOCAL CONTRACT VERIFIED / HOSTED CURRENT-RELEASE RECOVERY PENDING`

## Resultado

Schema e migration tree são byte-identical entre a baseline anterior ao work package de segurança
`70430d91644b36b47b747365ad301cc96644071d` e a release técnica `a780faa…`. Não houve alteração de
modelo, migration ou código de aplicação em `src/`. A remediação de dependência não exige migration.

Nenhum banco compartilhado/hospedado, backup comercial, R2, restore ou dado real foi alterado.

## Proveniência de schema e migrations

| Item | Resultado |
| --- | --- |
| Prisma schema SHA-256 | `fa84f513a47fd9b6fda88aabbe635ab3f6375f65d12fff4411475467375e0615` |
| Git blob schema atual/anterior | `588fe8a1f620c458ed23c2899ee9dbb8b0bab0ec` / idêntico |
| Git tree migrations atual/anterior | `5e873b75719f3faa25230a49021d3758e500c90e` / idêntico |
| migrations | 9 diretórios / 9 arquivos SQL |
| `prisma validate` | PASS local |
| delta `prisma/` e `src/` no work package | nenhum |

Hashes SHA-256 das migrations, em ordem:

| Migration | SHA-256 |
| --- | --- |
| `20260912175129_p06_initial_foundation` | `7e870ffba653de9ec6943f9e54f79863cd52891acb1216e245f972f49b2b3b9c` |
| `20260912180120_p06_description_snapshot` | `d92a0fbacfc97d1170efa8ed5cd665e798ed0283cb6e4f2349949b525c58f462` |
| `20260913_p10_mercado_pago_financial` | `8eee86062484e4930e6c6387540cd1af24f0951cde5b3f71e68b3220609f9d05` |
| `20260913133509_p11_entitlement_digital_delivery_foundation` | `04574ae9eabcb9442c50e530f8be782151a1337d7339003e077373aef462e942` |
| `20260913165037_p11_buyer_access_rate_limit_buckets` | `e761a9592681c39eafdf15fd8b68ec095c924acc01d4f8f82a0e012d3556e072` |
| `20260914035939_p12_admin_auth_persistence_foundation` | `8fd91aece9eb3b81dec7375e65acf77b43e4057a01213408df7758e261cc893c` |
| `20260914092012_p12_admin_session_rbac_audit` | `8854b8b0611d213a5ed385ebb99e8c2e484d868796c216bb859f4d9fe4c65268` |
| `20260917002445_p13_attribution_persistence_foundation` | `fc996bfe634dacf41c98c9c989f482ec580420eae0d74d2ce787d5c0384db33b` |
| `20261007_p17_f06_expired_order` | `682543255381cd1e8f8b78b11bb7d4a8907963bb8f9937196028a5b91860b639` |

## Controles de integridade

| Controle | Estado | Limite |
| --- | --- | --- |
| Order/Payment/Entitlement/audit invariants | PROVEN LOCAL | 1.132 testes gerais; autoridade production ausente |
| TLS DB/hostname | HISTORICAL HOSTED PROVEN | baseline P16/staging; endpoint production não verificado |
| runtime vs migration least privilege | HISTORICAL HOSTED PROVEN | grants production não verificados |
| rollback application/schema | PROVEN GIT FOR CURRENT DELTA | sem delta schema/src entre `70430d9…` e `a780faa…`; deploy rollback não executado |
| RPO <= 24 h | HISTORICAL P16 PROVEN | não atribuído automaticamente à RC/production |
| RTO <= 8 h | HISTORICAL P16 PROVEN | não atribuído automaticamente à RC/production |
| retenção 7/4/3 | PLAN_ONLY | implementação e execução não provadas |
| cópia final off-R2 | NOT EXECUTED | hard evidence ausente |
| consistência DB/R2 | PARTIALLY PROVEN | recovery unit sequencial; atomicidade ausente |
| restore isolado da RC | NOT EXECUTED | artefatos/autoridade hospedada atual ausentes |
| backup antes da release | NOT EXECUTED | janela de release não autorizada |

## Resultado do capsule offline

O `package-lock.json` mudou pela remediação de `braces`. O cache offline P17 permanece vinculado ao
hash anterior `E93A35F…` e não pode ser usado como prova da RC. Na execução local, 112/117 testes de
infra passaram; dois rejeitaram corretamente o novo lock contra o contrato antigo e três não
puderam calcular proveniência porque `npm-11.19.1.tgz`, `libssl3...deb` e `schema-engine.gz` não
estão materializados neste checkout. Classificação: `BLOCKED / OFFLINE CAPSULE RESEAL REQUIRED`.

Não foi criada exceção, não se reutilizou cache antigo e não se alegou build offline da RC.

## Rollback e restore

- rollback de aplicação para `70430d9…` é schema-compatible pelo tree/blob idêntico;
- isso não prova compatibilidade de configuração, provider ou artefato hospedado;
- rollback real requer backup verificado, identidade exata do alvo, current-version conhecido,
  smoke negativo/positivo e autorização específica;
- restore DB e recuperação R2 continuam procedimentos separados;
- nenhuma restauração destrutiva ou migration hospedada foi executada.

## Conclusão

`P18-06 = PREPARATORY REVIEW COMPLETE / FORMAL RECOVERY READINESS PENDING`.

Bloqueadores: retenção 7/4/3, off-R2 final, restore isolado da RC, grants/endpoint production,
backup pré-release e reseal do capsule offline.
