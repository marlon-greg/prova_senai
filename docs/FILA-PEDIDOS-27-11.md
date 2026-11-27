# Fila de pedidos — 27/11/2026

Pedidos do professor (mensagem própria + prompt sobre o que a FATEC ganhou na P2 de Banco de Dados, pasta irmã
../FATEC_MATERIAIS_AULAS_ADS, só leitura). Publicar por blocos, testando antes (emulador + Chrome).

| Bloco | Pedido | Situação |
|---|---|---|
| A | SQL: escolher DENTRO da pergunta quantas tarefas ela tem e de que tipo (consulta, dados, tabela, permissões, qualquer); a quantidade de questões práticas conta só PERGUNTAS, não tarefas; funcionar nos modelos Só teoria / Teoria + prática / Só prática / Montar do zero | feito |
| A | Bancada não pode perder o que o aluno fez ao trocar de questão (fica estacionada) | feito |
| B | Correção SQL com tabela fixa (90/80/75/50/25/0), IA vê as tentativas com erro, nota em 0,05; limite de tempo nas chamadas; pente fino nunca baixa nota | feito (6aa0788) |
| C | DESCRIBE igual ao MySQL; usuários e permissões na Bancada (CREATE USER, GRANT, REVOKE, SHOW GRANTS) | feito (b5df1b9); cenários com banco de tarefas: a fazer |
| D | Diagramas: arrasto e zoom (Ctrl+rodinha, Ver tudo) já funcionavam; aqui não há diagrama de sequência; botões ilegíveis no tema escuro: corrigido | feito |
| E | Dissertativas sem pedir comando/desenho ("o que faz", "explique", lista do que se espera) em todos os bancos; dificuldade balanceada; cenários SQL viram bancos de ~10 tarefas | a fazer |
| E | 150 questões por tema, matéria por matéria (Banco de Dados → Linguagem de Marcação → demais do plano) | a fazer |

## Como ficou o modelo das perguntas de SQL (bloco A)
- Cenário SQL = banco pronto + várias tarefas independentes (cada uma corrigida a partir da base original).
- Tipo de cada tarefa: campo `cat` (`consulta`, `dados`, `estrutura`, `permissao`) ou deduzido (js/praticas-categorias.js `tipoTarefa`).
- Somativa: `sqlPerguntas = [{ tarefas: ["consulta", "estrutura", "qualquer"] }, …]`, `nSql = nº de perguntas`.
- Sorteio (js/common.js): cada pergunta recebe um cenário diferente que tenha as tarefas pedidas; as tarefas sorteadas ficam em
  `tentativa.tarefasSorteadas[qid]` (regra do Firestore liberada) e vão junto da resposta (`resposta.ids`).
- Somativa antiga (sem `sqlPerguntas`): cenário com mais de 5 tarefas entra com 4 sorteadas; os antigos continuam inteiros.
