# Pedido padrão: cenários SQL como "banco de tarefas" (para agentes)

Sistema de provas do SENAI (técnico em Desenvolvimento de Sistemas, Banco de Dados, MySQL 8, alunos de 15 a 18 anos).
Repositório: /mnt/d/DOCUMENTOS/GITHUB/prova_senai (WSL; node: "/mnt/c/Program Files/nodejs/node.exe", rodando na pasta do repo).

LEIA: docs/PADRAO-QUESTOES.md (seção "Prática de SQL") e um cenário de exemplo em bancos/banco_sql_workbench.json.

Na prova, o professor monta cada pergunta escolhendo quantas tarefas ela tem e de que tipo (consulta, dados, tabela,
permissões); o sistema sorteia um cenário e, dentro dele, tarefas desses tipos. Por isso cada cenário precisa de MUITAS
tarefas independentes de todos os tipos. Cada tarefa é corrigida rodando o SQL do aluno numa base NOVA (só o setup) e
comparando o resultado da verificação com o do gabarito.

Cada cenário (questão "tipo": "sql") deve ter **10 tarefas** (ids t1…t10), nesta proporção:
- 3 × `"cat": "consulta"` — `"tipo": "consulta"`; SELECT com WHERE/ORDER BY, JOIN, GROUP BY/HAVING, funções, subconsulta
  (variar). O texto diz QUAIS colunas e em que ordem aparecem e a ordenação, quando importa (`"ordemImporta": true` no
  gabarito só se o texto pede ordenação).
- 3 × `"cat": "dados"` — INSERT, UPDATE, DELETE (pelo menos um de cada), `"tipo": "alteracao"`,
  `"verificacao": "SELECT ... FROM tabela ORDER BY id;"` (só as colunas que importam). Respeitar Safe Updates (WHERE pela chave
  ou pelo menos uma coluna) — se a tarefa precisa de WHERE sem chave, o gabarito começa com `SET SQL_SAFE_UPDATES = 0;`.
- 3 × `"cat": "estrutura"` — CREATE TABLE com PK/AUTO_INCREMENT/NOT NULL/UNIQUE/DEFAULT/ENUM; CREATE TABLE com FK para tabela
  do setup; ALTER TABLE (ADD COLUMN, MODIFY, ADD CONSTRAINT…). `"tipo": "alteracao"`, `"verificacao": "DESCRIBE tabela;"`.
  O texto lista as colunas NA ORDEM, com tipo e restrições ("id_x (INT, chave primária, AUTO_INCREMENT); nome (VARCHAR(60),
  obrigatório); …"), para não existirem duas respostas certas com DESCRIBE diferente. Sem FK dentro de PK composta.
- 1 × `"cat": "permissao"` — `"tipo": "alteracao"`, `"verificacao": "SHOW GRANTS FOR 'usuario'@'localhost';"`. O setup do
  cenário já cria o usuário com `CREATE USER 'nome'@'localhost' IDENTIFIED BY 'senha123';` e a tarefa pede GRANT ou REVOKE de
  privilégios bem definidos (ex.: "dê ao usuário caixa permissão de consultar e inserir na tabela venda do banco loja").
  A Bancada simula CREATE/DROP/ALTER USER, GRANT, REVOKE e SHOW GRANTS.
Regras: tarefas independentes (nenhuma depende de outra); nenhuma tarefa de alteração pode ficar "certa sem fazer nada"
(o resultado da verificação com o gabarito tem que ser diferente do resultado sem fazer nada); textos curtos e claros, sem
ambiguidade; nível de aula do técnico; nomes de tabela/coluna em minúsculas sem acento; dados variados no setup (10–15 linhas
por tabela principal). Gabarito em `"gabarito": { "tarefas": { "t1": { "sql": "...", "ordemImporta": false }, ... } }`.
Campos da questão: "tipo": "sql", "tema": "SQL prático — cenário completo (várias tarefas)", "capacidade": "bd.ct10",
"dificuldade": "media", "peso": 3, "enunciado" (o cenário em 2–3 frases: empresa, banco e tabelas, + "Use a Bancada SQL:
escreva o SQL de cada tarefa na aba dela e execute para conferir. Cada tarefa é corrigida separadamente, sempre a partir da
base original (o botão ↺ Restaurar base volta os dados ao início)."), "banco": { "nome", "setup" }, "tarefas", "gabarito",
"explicacao" (uma linha por tarefa: o que o gabarito faz).

VALIDE com o motor da Bancada (roda o gabarito de cada tarefa):
  "/mnt/c/Program Files/nodejs/node.exe" bancos/validar-sql.mjs <arquivo>
e também "/mnt/c/Program Files/nodejs/node.exe" bancos/validar.mjs <arquivo> (formato). Corrija até "✔ sem erros".
Se a Bancada não aceitar algum comando (mensagem "A Bancada SQL não simula…"), troque a tarefa por outra. Não faça commit.
No fim, responda curto: quantos cenários, tarefas por tipo, resultado dos dois validadores e o que ficou de fora/duvidoso.
