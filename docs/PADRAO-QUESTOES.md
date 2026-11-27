# Padrão das questões dos bancos (27/11/2026)

Vale para todo banco novo ou reescrito (bancos/*.json e bancos/gerados/**). Escrito a partir dos pedidos do professor e do
que funcionou na P2 de Banco de Dados da FATEC.

## Regras gerais
- Nível do conteúdo dado em aula no curso técnico do SENAI (alunos de 15 a 18 anos). Português do Brasil, frases curtas, pouco jargão.
- Questão que cita tabela/coluna **descreve a tabela no enunciado**: "Numa tabela `veiculo` com as colunas id_veiculo, modelo e valor_diaria…".
- Contextos variados e brasileiros (padaria, pet shop, oficina, escola, clínica, academia, biblioteca…). Nada de marcas reais.
- Cada questão tem `dificuldade`: `"facil"`, `"media"` ou `"dificil"`. Num banco: ~40% fácil, ~40% média, ~20% difícil.
  O sorteio monta cada prova balanceada (ex.: 6 alternativas → 2 difíceis e o resto média/fácil).
- Não repetir questão que já existe (mesma pergunta com outro contexto também é repetição; use `grupo` igual para variações
  propositais da mesma pergunta: o sorteio nunca põe duas do mesmo grupo na mesma prova).
- Questões novas entram com `"revisao": "pendente"` (só caem na turma de TESTE até o professor aprovar).
- `capacidade`: id da capacidade técnica do plano de curso (js/plano-curso.js), ex.: `"bd.ct9"`. Nunca inventar.

## Alternativa
```json
{ "tipo": "alternativa", "tema": "DDL — CREATE TABLE e restrições", "capacidade": "bd.ct9", "dificuldade": "media",
  "revisao": "pendente", "peso": 1,
  "enunciado": "Numa tabela `aluno` com as colunas id_aluno, nome e email, o e-mail não pode se repetir. Qual restrição garante isso?",
  "alternativas": ["NOT NULL", "UNIQUE", "DEFAULT", "AUTO_INCREMENT"], "correta": 1,
  "explicacao": "UNIQUE impede valores repetidos na coluna. NOT NULL só obriga a preencher." }
```
- 4 alternativas, uma só correta, distratores plausíveis (erros comuns de aluno), tamanhos parecidos.
- A posição da correta varia (0 a 3) de forma equilibrada no banco.
- Sem "todas as anteriores"/"nenhuma das anteriores".

## Dissertativa — NUNCA pede comando nem desenho
Comando (SQL, HTML, CSS, código, terminal) e diagrama são cobrados **só nas práticas** (Bancada SQL, Bancada Web, editor de
diagramas). A dissertativa cobra **explicar, justificar, comparar, decidir, interpretar**:
- "O que faz o comando `DELETE FROM pedido;` e qual o risco de rodá-lo assim?"
- "Explique a diferença entre `DROP TABLE` e `TRUNCATE TABLE`."
- "Neste diagrama (descrito no texto), por que a relação entre ALUNO e CURSO precisa de uma tabela associativa?"
- Proibido: "Escreva o comando…", "Crie a tabela…", "Monte o SELECT…", "Desenhe o diagrama…", "Escreva o código…".

O enunciado termina com **o que se espera da resposta em lista numerada** (a tela do aluno destaca essa lista):
```
… pergunta …

Na sua resposta:
1. diga o que o comando faz;
2. explique o risco de usá-lo sem WHERE.
```
```json
{ "tipo": "dissertativa", "tema": "DML — DELETE", "capacidade": "bd.ct10", "dificuldade": "media", "revisao": "pendente", "peso": 2,
  "enunciado": "Numa tabela `pedido` (id_pedido, cliente, valor), o que faz o comando `DELETE FROM pedido;`?\n\nNa sua resposta:\n1. diga o que o comando faz;\n2. explique o risco de usá-lo sem WHERE.",
  "respostasAceitas": ["Apaga todas as linhas da tabela pedido (a tabela continua existindo). Sem WHERE não há filtro: todos os pedidos são perdidos."],
  "palavrasChave": [],
  "explicacao": "Espera-se: 1) apaga todos os registros, a estrutura fica; 2) sem WHERE apaga tudo, não só o pedido desejado." }
```
- `respostasAceitas[0]` = resposta-modelo CURTA (a IA usa como referência). `palavrasChave` fica vazio (a correção por palavras
  dava nota cheia por acaso); a IA corrige pela resposta-modelo e pela `explicacao`.
- Correção: resposta curta que atende em essência = nota cheia; nunca descontar por "poderia ser mais específico".

## Prática de SQL (cenário = banco de tarefas)
Um cenário = um banco pronto (`banco.setup`) + **8 a 12 tarefas independentes** de tipos variados (o professor escolhe na
somativa quantas tarefas cada pergunta tem e de que tipo; o sorteio tira as tarefas do cenário):
- `"cat": "consulta"` — SELECT (`"tipo": "consulta"`), compara o resultado.
- `"cat": "dados"` — INSERT/UPDATE/DELETE (`"tipo": "alteracao"`, `"verificacao": "SELECT … ORDER BY …;"`).
- `"cat": "estrutura"` — CREATE/ALTER TABLE (`"tipo": "alteracao"`, `"verificacao": "DESCRIBE tabela;"`): o enunciado diz as
  colunas NA ORDEM, com tipo e restrições ("id_produto (INT, chave primária, AUTO_INCREMENT); nome (VARCHAR(60), obrigatório)…")
  para não haver duas respostas certas com DESCRIBE diferente. Evitar FK dentro de PK composta (não aparece no DESCRIBE).
- `"cat": "permissao"` — CREATE USER/GRANT/REVOKE (`"tipo": "alteracao"`, `"verificacao": "SHOW GRANTS FOR 'usuario'@'localhost';"`).
- Cada tarefa é corrigida a partir da base ORIGINAL (não depende de outra tarefa).
- Gabarito em `gabarito.tarefas[id].sql`; a importação roda o gabarito na Bancada e guarda o resultado (hash).
