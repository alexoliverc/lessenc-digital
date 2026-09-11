# Política de memória

## `MEMORY.md`

Mantém apenas decisões e estado consolidado que continuam válidos.

## `memory/YYYY-MM-DD.md`

Registra o que aconteceu em uma sessão: decisões, arquivos alterados, testes, bloqueios e próximo movimento.

## Regra de atualização

- Não registrar segredos.
- Não duplicar toda a documentação técnica.
- Corrigir o estado consolidado quando uma decisão for alterada.
- Usar datas ISO `YYYY-MM-DD`.
- Manter histórico; não apagar decisões antigas sem registrar a mudança.

## Conteúdo mínimo do registro diário

Cada registro diário deve incluir, quando aplicável:

- objetivo da sessão;
- decisões tomadas;
- arquivos alterados;
- comandos ou verificações relevantes;
- testes executados e resultado;
- riscos ou bloqueios encontrados;
- próximo movimento.

## Regras de consolidação

- `MEMORY.md` não é log.
- Informação transitória permanece somente no registro diário.
- Decisões vigentes e mudanças de estado relevantes devem ser promovidas para `MEMORY.md`.
- Quando uma decisão for substituída, registrar a nova decisão no estado consolidado e preservar o histórico no arquivo diário.
- Nunca registrar credenciais, tokens ou segredos.
