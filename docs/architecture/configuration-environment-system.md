# P04 — Configuração e ambientes

**Status:** specification COMPLETE; physical configuration foundation implementada e validada localmente, com revisão técnica pendente.

## Canonical application environments

A aplicação reconhece:

- `local`;
- `test`;
- `staging`;
- `production`.

O ambiente da aplicação é representado por:

`APP_ENV`

e permanece conceitualmente separado de:

`NODE_ENV`

`NODE_ENV` governa comportamento do runtime/framework.

`APP_ENV` representa o ambiente operacional da aplicação.

Na fundação física P04, `APP_ENV` é obrigatório e não recebe default implícito. O schema aceita exatamente os quatro valores acima e rejeita ausência ou valor desconhecido. `.env.example` documenta um valor fictício, mas não é carregado automaticamente pelo runtime; cada ambiente deve fornecer `APP_ENV` explicitamente. O default anterior de `APP_URL` é preservado.

## P04 responsibility

P04 deve estabelecer a fundação de configuração necessária para:

- validar `APP_ENV`;
- validar variáveis de ambiente por schema;
- disponibilizar configuração tipada;
- manter configuração server-side fora do bundle cliente;
- separar configuração pública e privada;
- impedir secrets em Git, logs e bundles;
- manter `.env.example` somente com valores fictícios.

O scaffold auditado antes da P04 possuía `src/lib/config/env.ts`, `NODE_ENV` e `APP_URL`, mas não implementava integralmente a política canônica de `APP_ENV`. A implementação P04 em `src/lib/config/env-schema.ts` exige `APP_ENV` com um dos quatro valores acima, valida e fornece configuração server-side tipada. `NODE_ENV` mantém validação separada e o padrão existente de `APP_URL` foi preservado. Os testes locais da configuração passaram; a revisão técnica da fase permanece pendente.

## Provider-specific configuration

A existência dos quatro ambientes não significa que todos os providers serão fisicamente implementados durante P04.

Configurações específicas serão introduzidas nas fases responsáveis por cada capability.

Exemplos:

- banco e persistência → P06;
- Mercado Pago → P10;
- storage privado e digital delivery → P11;
- analytics externos → P13;
- hosted staging → P16;
- production providers → P19.

P04 deve fornecer a fundação de configuração, não antecipar a implementação desses providers.

## Secrets

Secrets:

- nunca entram no Git;
- nunca devem ser expostos por `NEXT_PUBLIC_*`;
- nunca devem aparecer em logs;
- devem permanecer server-side;
- devem ser configurados por ambiente na fase responsável pelo provider.

Este documento não autoriza criação de credenciais, alteração de infraestrutura ou leitura de arquivos `.env` reais.
