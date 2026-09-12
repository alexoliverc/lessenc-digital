# P06 — MySQL local, migração e testes

## Isolamento físico

O ambiente local usa a imagem já disponível `mysql:8.4.11` em contêiner `lessenc-p06-mysql`, volume `lessenc-p06-mysql-data` e bind exclusivo `127.0.0.1:3307`. Os bancos são `lessenc_dev`, `lessenc_test` e `lessenc_shadow`; `lessenc_test_rebuild` é descartável e serve à prova de reconstrução integral. Usuários distintos têm privilégios de migration, DML de desenvolvimento e DML de teste. O contêiner `smith-sterling-mysql` preexistente permanece separado em `127.0.0.1:3306`; nenhuma operação P06 é direcionada a ele. Não reutilizar seu volume, banco ou credenciais.

Credenciais locais e a CA exportada do contêiner ficam em `output/p06/`, ignorado pelo Git. O contêiner usa TLS; o client exige `DB_TLS_CA_FILE`. O certificado automático da imagem não tem SAN para `127.0.0.1`, então a verificação do nome é dispensada **somente** para `APP_ENV=local/test` na porta 3307, com cadeia assinada pela CA local ainda exigida. Staging/produção deverão usar certificado com nome válido, CA própria e nova autorização. Os pins Prisma 7.10.0 têm alertas de segurança transitivos registrados no exit review; esta configuração local não constitui aprovação para produção.

## Variáveis, nomes apenas

| Variável | Finalidade |
| --- | --- |
| `APP_ENV` | `local` para migração dev ou `test` para integração/deploy de teste; separado de `NODE_ENV` |
| `DATABASE_URL` | Conta migradora para o alvo explicitamente autorizado pelo script |
| `DB_RUNTIME_URL` | Conta DML da aplicação no banco de desenvolvimento; lida só quando o client é usado |
| `TEST_DATABASE_URL` | Conta DML do banco `lessenc_test`, obrigatória nos testes |
| `SHADOW_DATABASE_URL` | Conta migradora no banco separado `lessenc_shadow` |
| `DB_TLS_CA_FILE` | Caminho local do certificado CA confiável para o driver |

`.env.example` contém exemplos fictícios; não é carregado automaticamente. O arquivo ignorado usado nesta execução não deve ser versionado nem copiado para documentação. O fallback sem credenciais em `prisma.config.ts` aponta para a porta inacessível 1: permite `prisma generate` e build sem MySQL, mas não permite aplicar migrations acidentalmente. Os scripts de migração verificam `APP_ENV`, host, porta e nome do banco antes do comando Prisma.

## Fluxo PowerShell autorizado localmente

Após provisionar um MySQL 8.4 **exclusivo da L'Essenc** e fornecer as variáveis acima no processo:

```powershell
npm ci
npm run db:validate
npm run db:format
npm run db:generate
npm run db:migrate:dev -- --name descricao_da_migracao
npm run db:status
$env:APP_ENV = 'test'
# DATABASE_URL deve apontar para lessenc_test com conta migradora.
npm run db:migrate:deploy:test
npm run test:integration
```

`db:migrate:dev` só aceita `lessenc_dev` em `127.0.0.1:3307` com shadow distinto; `db:migrate:deploy:test` só aceita `lessenc_test` no mesmo endpoint. Para reconstrução do zero, `db:migrate:deploy:fresh` exige `DATABASE_URL` e `TEST_DATABASE_URL` apontando explicitamente para `lessenc_test_rebuild`; o mesmo `test:integration` roda nesse banco. O teste checa seu próprio alvo antes de conectar. A migração deve ser revisada em SQL **antes** da aplicação. `migrate reset`, `db push`, drops em banco persistente e migrações de staging/produção não fazem parte deste fluxo.

O client gerado fica fora do Git em `src/generated/prisma/`. `typecheck`, `test:integration` e o hook `prebuild` executam `db:generate`; assim, `npm ci` seguido dos gates documentados não depende de um artefato prévio nem de conexão de banco para construir a página estática. `npm run test` executa apenas testes unitários; `npm run test:integration` usa configuração Vitest separada e limpa os registros de fixture por ID. Não há seed P06: a oferta real não foi publicada e os testes usam somente dados `.invalid` e valores documentados. A migração inicial e a migração aditiva de descrição foram aplicadas juntas em `lessenc_test_rebuild` vazio, sem reset de `lessenc_dev`.
