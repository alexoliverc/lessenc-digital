# P04 — Configuração e ambientes

**Status:** specification COMPLETE; physical configuration foundation PENDING.

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

## P04 responsibility

P04 deve estabelecer a fundação de configuração necessária para:

- validar `APP_ENV`;
- validar variáveis de ambiente por schema;
- disponibilizar configuração tipada;
- manter configuração server-side fora do bundle cliente;
- separar configuração pública e privada;
- impedir secrets em Git, logs e bundles;
- manter `.env.example` somente com valores fictícios.

O scaffold atual possui `src/lib/config/env.ts`, `NODE_ENV` e `APP_URL`, mas ainda não implementa integralmente a política canônica de `APP_ENV`.

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
