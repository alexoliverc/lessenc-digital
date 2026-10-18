# LES-SEC-RA-001 — Remediação mantida de `braces`

## Resultado

Em 18/10/2026, a condição vulnerável descrita por `GHSA-vfj7-8cjw-p6xm` foi removida do grafo de
dependências instalado da L'Essenc por um patch mantido, versionado e verificado no repositório.

Classificação:

`REMEDIATED_WITH_MAINTAINED_PATCH / ZERO AUDIT FINDINGS / DEVELOPMENT DEPENDENCY / PRODUCTION NOT AUTHORIZED`

Esta classificação encerra a aceitação temporária `LES-SEC-RA-001` e seu hard stop específico. Ela
não representa release oficial do upstream, certificação independente, conformidade legal, Gate D,
Gate E ou autorização global para produção.

## Fundamentação da abordagem

Na data da remediação, o advisory oficial ainda classificava `braces <= 3.0.3` como afetado e não
indicava versão corrigida. A investigação encontrou o PR upstream `micromatch/braces#72`, fechado
sem merge, que implementa limite de profundidade, rejeição de ciclos e regressões específicas. O
conteúdo usado está fixado no commit candidato
`28d440b5dd449dbf1fe6f3506cf94ecca4d02660` do fork `FSDevelop/braces`.

Por não existir release oficial corrigida, a solução é deliberadamente identificada como patch
mantido e não como upgrade upstream. O retorno futuro à distribuição oficial exige nova revisão,
`npm audit` completo e todas as regressões.

## Implementação

- fontes vendorizados em `vendor/braces`, preservando licença e documentação;
- versão interna imutável `3.0.4-lessenc.1`;
- tarball determinístico `vendor/braces-3.0.4-lessenc.1.tgz`;
- dependência de desenvolvimento direta apontando para o tarball local;
- override npm `braces: $braces`, fazendo toda a cadeia de lint usar exatamente o artefato fixado;
- política executável em `les-sec-ra-001-remediation-policy.json`;
- verificador fail-closed `scripts/p18-braces-remediation-audit.mjs`;
- regressões negativas em `scripts/p18-braces-remediation.test.mjs`;
- verificação obrigatória no workflow `Quality and security`.

A tentativa de usar diretamente `file:vendor/braces` foi rejeitada porque o override por diretório
não materializou `fill-range`. A tentativa de usar o tarball diretamente no override também foi
rejeitada porque npm resolveu o caminho relativamente ao pacote dependente. A combinação final —
dependência direta local mais override `$braces` — passou em instalação limpa e manteve todas as
dependências do pacote.

## Proveniência e integridade

O manifesto machine-readable contém todos os hashes SHA-256. Identificadores principais:

| Artefato | Identificador |
| --- | --- |
| candidato upstream | `28d440b5dd449dbf1fe6f3506cf94ecca4d02660` |
| tarball mantido | `2d51d7d5d2c7742e2de93dcba052f14a8ab8295e1969822596b2abe19a83aa25` |
| integridade npm | `sha512-FyUprlwI1dHxnZMvDzBthmTnpzYQC6AkISCXqPGEYz+bpQeqB399FUmlGM7FUSowlBeIrpcM9S2un0fiqwUatQ==` |
| versão instalada | `3.0.4-lessenc.1` |
| limite de profundidade | `100` |

O verificador recalcula os hashes de todos os fontes e do tarball, compara manifesto e lockfile,
confere as versões da cadeia instalada, exige ausência no grafo de runtime e só aceita um
`npm audit --json` completo com zero findings em todas as severidades.

## Evidências locais de validação

Executado em Node `24.21.0` e npm `11.19.1`:

- instalação limpa com `npm ci`: `PASS`;
- suíte do candidato upstream após instalação do harness: `904 passing`;
- expansão funcional `{1..3}`: `PASS`;
- entrada aninhada em profundidade 101: `SyntaxError` fail-closed com máximo 100;
- regressões do evaluator mantido: `6/6 PASS`;
- `npm audit --json`: zero findings;
- grafo completo: cadeia Next/fast-glob/micromatch em `braces@3.0.4-lessenc.1`;
- grafo `--omit=dev`: nenhum `braces`;
- suíte completa, build e CI hospedado: registrados no relatório do work package e no dossiê P18.

A primeira tentativa de executar `npm ci` no clone upstream não foi um teste de patch: o repositório
candidato não possui `package-lock.json`, portanto o harness não foi instalado. O teste foi repetido
com `npm install --ignore-scripts` e então concluiu com 904 casos aprovados. Os findings legados do
harness upstream não pertencem ao grafo da aplicação L'Essenc.

## Estado residual e manutenção

- Não existe, nesta data, release oficial corrigida de `braces` para substituir o patch.
- A L'Essenc passa a ser responsável por revisar o advisory e o upstream, manter o artefato e
  revalidar qualquer alteração de hash, lockfile ou cadeia.
- Um novo finding, erro operacional de audit, mudança de conteúdo, presença em runtime ou drift da
  árvore instalada falha fechado em CI.
- O controle não transforma desenvolvimento/CI em evidência hospedada, de provedor ou produção.
- Os bloqueios externos de Gate D, Gate E e produção permanecem independentes e ativos.

## Encerramento da aceitação temporária

A política histórica `les-sec-ra-001-policy.json` é preservada sem reescrever a decisão anterior. A
fonte atual de verdade para o estado do risco é `les-sec-ra-001-remediation-policy.json`. O script de
hard stop confirma somente:

`HARD STOP CLEARED FOR THIS RISK ONLY; GLOBAL PRODUCTION AUTHORITY NOT GRANTED`

Qualquer pipeline futuro de produção deverá validar, separadamente, todos os demais requisitos e a
autorização explícita do proprietário.
