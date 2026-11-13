// PLANO DE ENSINO: critérios de avaliação e avaliações previstas por turma.
// O aluno vê os CRITÉRIOS (com explicação), não as capacidades cruas: a capacidade é ampla demais
// e o conhecimento é só o meio. Toda avaliação leva capacidade técnica E socioemocional.
// Os mesmos critérios (IDs estáveis) vão para a autoavaliação, para comparar o que o aluno declarou
// com o que mostrou na prova. Um critério pode voltar em várias provas até a capacidade ser completada.
//
// Fonte: Plano_Ensino_BD_2026_2sem_Turma_2A.xlsx / _2B.xlsx (aba Critérios, igual nas duas turmas).
// As socioemocionais de cada avaliação seguem a aula dela no Plano de Aulas (completadas em 12/11/2026).
// Critério: [id, capacidade (do plano-curso.js), texto literal do plano de ensino, explicação para o aluno, extras]
//   extras.grupo = só faz sentido em trabalho em grupo (não entra sozinho nas provas individuais).
//   extras.sinal = a participação no sistema de aulas gera evidência deste critério (ver sinaisDaParticipacao em evidencias.js).
// Detalhados = critérios da RUBRICA de uma prova (mais específicos), sempre ligados a um critério oficial.
//   Níveis da rubrica: Mais que Satisfatório, Satisfatório, Parcialmente Satisfatório, Não Satisfatório.
import { unidadeDaMateria, unidadePorId } from "./plano-curso.js?v=20261112d";

export const NIVEIS_RUBRICA = ["Mais que Satisfatório", "Satisfatório", "Parcialmente Satisfatório", "Não Satisfatório"];

export const CRITERIOS = {
  bd: [
    ["bd.cr01", "bd.ct1", "Distinguiu banco relacional (tabelas fixas, ex.: MySQL) de não relacional (ex.: MongoDB) explicando o que muda", "Saber explicar o que muda entre um banco organizado em tabelas (relacional, ex.: MySQL) e um banco sem tabelas fixas (não relacional, ex.: MongoDB)."],
    ["bd.cr02", "bd.ct1", "Classificou cada SGBD dado (MySQL, PostgreSQL, MongoDB, Redis…) como relacional ou não relacional", "Dado o nome de um SGBD (MySQL, PostgreSQL, MongoDB, Redis…), dizer se ele é relacional ou não relacional."],
    ["bd.cr03", "bd.ct1", "Citou pelo menos 2 vantagens e 2 desvantagens de cada tipo de banco e indicou quando usar cada um", "Citar pelo menos 2 pontos fortes e 2 pontos fracos de cada tipo de banco e saber quando usar cada um."],
    ["bd.cr04", "bd.ct2", "Instalou o SGBD pedido e demonstrou que ele abre e aceita conexão", "Instalar o MySQL (ou o SGBD pedido) e deixar ele funcionando no computador."],
    ["bd.cr05", "bd.ct2", "Criou um banco de dados que aceita tabelas e inserção de dados sem erro", "Criar um banco de dados (database) que abre e aceita tabelas e dados."],
    ["bd.cr06", "bd.ct2", "Conectou ao banco e executou comandos pelo Workbench ou pela linha de comando", "Conectar no banco e trabalhar nele, pelo Workbench ou pela linha de comando."],
    ["bd.cr07", "bd.ct3", "Usou INT ou BIGINT para inteiros, DECIMAL para valores monetários, VARCHAR para texto, DATE para datas e BOOLEAN para verdadeiro/falso", "Escolher o tipo certo para cada campo: número inteiro, decimal, texto, data, verdadeiro/falso."],
    ["bd.cr08", "bd.ct3", "Explicou por que cada campo usa aquele tipo — ex.: preço em DECIMAL e não em INT porque precisa de casas decimais", "Explicar por que escolheu cada tipo (ex.: preço em DECIMAL, e não em INT ou VARCHAR)."],
    ["bd.cr09", "bd.ct3", "Os dados inseridos cabem nos tipos declarados sem gerar erro de tipo ou de tamanho", "Criar tabelas em que os dados inseridos cabem nos tipos escolhidos, sem erro de tipo ou de tamanho."],
    ["bd.cr10", "bd.ct4", "Desenhou o DER com todas as entidades, atributos e relacionamentos do enunciado — sem elemento faltante nem sobressalente", "Desenhar o diagrama com todas as entidades, atributos e relacionamentos que o problema pede, sem faltar nem sobrar."],
    ["bd.cr11", "bd.ct4", "Classificou cada relacionamento como 1:1, 1:N ou N:N de acordo com o que o enunciado descreve", "Marcar certo se cada relacionamento é 1:1, 1:N ou N:N, de acordo com o que o enunciado descreve."],
    ["bd.cr12", "bd.ct4", "Usou retângulo (entidade), círculo (atributo) e losango (relacionamento) no padrão brModelo, legível por qualquer leitor", "Usar os símbolos do padrão (no brModelo: retângulo, círculo, losango, chave preenchida) de um jeito legível."],
    ["bd.cr13", "bd.ct5", "Toda tabela tem PK definida e as tabelas do lado N de cada 1:N têm a FK apontando para a tabela certa", "Toda tabela com chave primária (PK) e as chaves estrangeiras (FK) no lugar certo para ligar as tabelas."],
    ["bd.cr14", "bd.ct5", "FK com ON DELETE e ON UPDATE definidos de forma que nenhum registro aponte para um ID inexistente", "Ligar as tabelas de forma que nenhum registro aponte para algo que não existe (FK válida, ON DELETE / ON UPDATE)."],
    ["bd.cr15", "bd.ct5", "Criou tabela associativa com as duas FKs sempre que o relacionamento é N:N", "Quando o relacionamento é N:N, criar uma tabela no meio que guarda as duas chaves."],
    ["bd.cr16", "bd.ct6", "Apontou os dados repetidos em uma tabela não normalizada e os problemas que causam ao inserir, alterar ou apagar", "Olhar uma tabela mal feita e apontar os dados repetidos e os problemas que eles causam ao inserir, alterar ou apagar."],
    ["bd.cr17", "bd.ct6", "Aplicou 1FN (valor atômico), 2FN (sem dependência parcial da PK) e 3FN (sem dependência transitiva) no modelo", "Aplicar as três formas normais: valores atômicos (1FN), sem dependência parcial da chave (2FN) e sem dependência transitiva (3FN)."],
    ["bd.cr18", "bd.ct6", "Dividiu as tabelas de modo que cada informação apareça em um único lugar no modelo", "Dividir as tabelas para que cada informação fique guardada em um lugar só."],
    ["bd.cr19", "bd.ct7", "Dicionário de dados tem nome, tipo, descrição e restrições (PK, FK, NOT NULL…) preenchidos para cada campo", "Montar a tabela que descreve cada campo: nome, tipo, descrição e restrições (PK, FK, NOT NULL…)."],
    ["bd.cr20", "bd.ct7", "Cada campo do dicionário tem o mesmo nome, tipo e restrição do que foi criado no banco — sem divergência", "O que está escrito no dicionário de dados é igual ao que foi criado no banco."],
    ["bd.cr21", "bd.ct7", "Dicionário com todos os campos preenchidos e legível por qualquer membro da equipe sem precisar perguntar ao autor", "O dicionário está organizado e fácil de outra pessoa ler e entender."],
    ["bd.cr22", "bd.ct8", "Criou usuários com CREATE USER e atribuiu permissões específicas com GRANT", "Criar usuários no banco (CREATE USER) e dar permissões a eles com GRANT."],
    ["bd.cr23", "bd.ct8", "Cada usuário tem só as permissões que o exercício define — nenhuma a mais", "Dar a cada usuário só as permissões que o exercício pede, nada a mais (princípio do menor privilégio)."],
    ["bd.cr24", "bd.ct8", "Retirou uma permissão específica de um usuário com REVOKE sem remover as outras", "Tirar uma permissão específica de um usuário com REVOKE."],
    ["bd.cr25", "bd.ct9", "Escreveu CREATE TABLE que executa sem erro, com colunas, tipos e restrições todos declarados", "Escrever CREATE TABLE que roda sem erro, com colunas, tipos e restrições certas."],
    ["bd.cr26", "bd.ct9", "Usou ALTER TABLE para adicionar, alterar ou remover coluna ou restrição sem quebrar dados existentes", "Mudar uma tabela que já existe (adicionar, alterar ou remover coluna ou restrição) com ALTER TABLE sem quebrar nada."],
    ["bd.cr27", "bd.ct9", "Usou DROP TABLE e CREATE/DROP INDEX sabendo o que cada comando apaga ou cria antes de executar", "Usar DROP TABLE e CREATE/DROP INDEX sabendo o que cada comando apaga ou cria."],
    ["bd.cr28", "bd.ct10", "Usou INSERT, UPDATE e DELETE com cláusula WHERE que afeta só as linhas especificadas no enunciado", "Inserir, alterar e apagar dados usando WHERE para mexer só nas linhas certas."],
    ["bd.cr29", "bd.ct10", "Montou SELECT com WHERE para filtrar, ORDER BY para ordenar e LIMIT para restringir o número de linhas", "Montar consultas SELECT claras, filtrando com WHERE, ordenando com ORDER BY e limitando com LIMIT."],
    ["bd.cr30", "bd.ct10", "Usou +, -, *, /, =, <>, <, >, AND, OR, NOT nos lugares certos, sem erro de lógica que inverta ou omita resultado", "Usar operadores de conta (+ - * /), de comparação (= <> < >) e lógicos (AND, OR, NOT) do jeito certo."],
    ["bd.cr31", "bd.ct11", "Usou COUNT, SUM, AVG, CONCAT, UPPER, NOW ou DATEDIFF para responder a uma pergunta do enunciado", "Usar funções de agregação (COUNT, SUM, AVG…), de texto (CONCAT, UPPER…) e de data (NOW, DATEDIFF…) para responder perguntas."],
    ["bd.cr32", "bd.ct11", "Agrupou com GROUP BY, filtrou grupos com HAVING e combinou consultas com UNION no contexto do enunciado", "Agrupar resultados com GROUP BY, filtrar os grupos com HAVING e juntar consultas com UNION."],
    ["bd.cr33", "bd.ct11", "Escolheu INNER, LEFT, RIGHT ou CROSS JOIN de acordo com quais linhas o enunciado pede incluir", "Juntar tabelas com o JOIN certo para cada caso: INNER, LEFT, RIGHT ou CROSS."],
    ["bd.cr34", "bd.ct12", "Criou VIEW e STORED PROCEDURE que executam sem erro e devolvem o resultado descrito no enunciado", "Criar VIEWs e STORED PROCEDUREs que funcionam e fazem o que a regra de negócio pede."],
    ["bd.cr35", "bd.ct12", "Criou FUNCTION que devolve o valor esperado e TRIGGER que dispara no evento (INSERT/UPDATE/DELETE) definido no enunciado", "Criar FUNCTIONs que devolvem o valor certo e TRIGGERs que disparam na hora certa."],
    ["bd.cr36", "bd.ct12", "Agendou tarefa com EVENT e usou COMMIT, ROLLBACK e SAVEPOINT para confirmar ou desfazer transações", "Agendar tarefas com EVENT e usar COMMIT, ROLLBACK e SAVEPOINT para confirmar ou desfazer transações."],
    ["bd.cr37", "bd.ct13", "Gerou o backup completo do banco com mysqldump ou pelo Workbench sem erro de execução", "Gerar o backup completo do banco (ex.: mysqldump ou exportação do Workbench)."],
    ["bd.cr38", "bd.ct13", "Importou o arquivo .sql e o banco voltou ao estado original sem erro de estrutura ou de chave", "Restaurar um arquivo .sql no banco sem erro de estrutura ou de chave."],
    ["bd.cr39", "bd.ct13", "Conferiu, após a importação, que todos os registros chegaram e nenhum campo ficou vazio ou distorcido", "Conferir, depois da importação, que os dados chegaram todos e certos."],
    ["bd.cr40", "bd.cs1", "Entrega as atividades no prazo combinado em aula — sem depender de prorrogação", "Entregar as atividades no prazo combinado.", { sinal: "prazo" }],
    ["bd.cr41", "bd.cs1", "Distribui as tarefas do grupo de forma que cada integrante tem parte definida e sabida por todos", "Organizar o próprio trabalho (e o do grupo) e dividir as tarefas de forma justa.", { grupo: true }],
    ["bd.cr42", "bd.cs1", "O que entrega em aula e na somativa é compatível com o tempo disponível, sem ficar em branco nem desperdiçar tempo", "Usar bem o tempo da aula e da prova: o que você entrega combina com o tempo que teve.", { sinal: "tempo" }],
    ["bd.cr43", "bd.cs2", "Encontrou o erro no próprio código e propôs uma correção antes de pedir ajuda", "Encontrar o erro sozinho e propor uma correção."],
    ["bd.cr44", "bd.cs2", "Monta a consulta ou o modelo do problema ao resultado sem etapa desnecessária ou resultado contraditório", "Montar consultas e modelos com um raciocínio que faz sentido do começo ao fim."],
    ["bd.cr45", "bd.cs2", "Leu o enunciado e adaptou o SQL ou o modelo para resolver aquele problema específico, não um modelo genérico", "Entender o problema do enunciado e adaptar o SQL ou o modelo para resolver."],
    ["bd.cr46", "bd.cs3", "Recebeu uma correção ou crítica e respondeu sem hostilidade, usando o retorno para ajustar o trabalho", "Receber correções e críticas com respeito e usar para melhorar."],
    ["bd.cr47", "bd.cs3", "Ajudou e trabalhou junto com os colegas em dupla ou em grupo sem delegar tudo nem monopolizar", "Ajudar e trabalhar junto com os colegas em dupla ou em grupo.", { grupo: true, sinal: "coopera" }],
    ["bd.cr48", "bd.cs3", "Manteve a postura quando algo deu erro e continuou tentando até resolver, sem desistir ou travar", "Manter a calma quando algo dá erro e seguir tentando até resolver."],
    ["bd.cr49", "bd.cs4", "Consultou a documentação ou exemplos por conta própria antes de pedir ajuda ao professor", "Procurar sozinho na documentação e em exemplos quando tem dúvida.", { sinal: "busca" }],
    ["bd.cr50", "bd.cs4", "Foi além do conteúdo da aula: testou variações, consultou documentação e aplicou sem ser pedido", "Ir além do que foi mostrado em aula, testando e explorando por conta própria.", { sinal: "iniciativa" }],
    ["bd.cr51", "bd.cs4", "Fez a própria parte do projeto sem precisar que o professor ou colega mandasse prosseguir", "Fazer a sua parte do projeto sem depender de alguém mandando."]
  ]
  // próximas unidades: montar com o professor a partir do plano de ensino de cada uma
};

// Textos alternativos dos critérios para instrumento seminário (apresentação oral).
// Sobrescreve apenas o textoLiteral (3ª coluna) — a explicacaoParaOAluno (4ª) permanece igual.
export const CRITERIOS_SEM = {
  "bd.cr01": "Explicou em voz alta a diferença entre banco relacional (tabelas fixas, ex.: MySQL) e não relacional (ex.: MongoDB)",
  "bd.cr02": "Citou exemplos de SGBDs durante a apresentação e classificou cada um como relacional ou não relacional",
  "bd.cr03": "Apresentou pelo menos 2 vantagens e 2 desvantagens de cada tipo e justificou oralmente quando usar cada um",
  "bd.cr04": "Demonstrou o SGBD pedido funcionando ao vivo — conectou e mostrou o banco ativo para a banca",
  "bd.cr05": "Demonstrou o banco de dados criado aceitando tabelas e inserção de dados durante a apresentação",
  "bd.cr06": "Operou o banco ao vivo pelo Workbench ou pela linha de comando na frente da banca",
  "bd.cr07": "Justificou oralmente a escolha de INT, DECIMAL, VARCHAR, DATE ou BOOLEAN para cada campo",
  "bd.cr08": "Explicou em voz alta por que cada campo usa aquele tipo — ex.: preço em DECIMAL e não em INT",
  "bd.cr09": "Apresentou tabelas onde os dados inseridos cabem nos tipos sem gerar erro — verificado ao vivo",
  "bd.cr10": "Apresentou o DER com todas as entidades, atributos e relacionamentos do enunciado, explicando cada elemento à banca",
  "bd.cr11": "Explicou cada relacionamento do DER — por que é 1:1, 1:N ou N:N, de acordo com o enunciado",
  "bd.cr12": "Apresentou o diagrama com retângulo (entidade), círculo (atributo) e losango (relacionamento) legível para a banca",
  "bd.cr13": "Apontou no banco ou no diagrama cada PK e FK, explicando o papel de cada uma para a banca",
  "bd.cr14": "Demonstrou como a FK garante integridade referencial e o que acontece com ON DELETE/UPDATE",
  "bd.cr15": "Mostrou a tabela associativa do N:N e explicou oralmente por que ela é necessária",
  "bd.cr16": "Identificou e explicou oralmente as redundâncias e anomalias na estrutura apresentada",
  "bd.cr17": "Explicou as três formas normais aplicadas no modelo: o que mudou de 1FN para 2FN para 3FN",
  "bd.cr18": "Mostrou como as tabelas foram divididas para que cada informação apareça em um único lugar",
  "bd.cr19": "Apresentou o dicionário de dados com todos os campos preenchidos e explicou cada coluna à banca",
  "bd.cr20": "Demonstrou ao vivo que o dicionário bate com o banco implementado — campo por campo",
  "bd.cr21": "Apresentou o dicionário organizado de forma que a banca leu e entendeu sem perguntas adicionais",
  "bd.cr22": "Demonstrou ao vivo a criação de usuário com CREATE USER e a atribuição de permissões com GRANT",
  "bd.cr23": "Mostrou que cada usuário tem só as permissões definidas no exercício — verificou com SHOW GRANTS",
  "bd.cr24": "Demonstrou o uso de REVOKE para retirar uma permissão específica sem afetar as outras",
  "bd.cr25": "Apresentou CREATE TABLE executando sem erro, com colunas, tipos e restrições visíveis à banca",
  "bd.cr26": "Demonstrou ALTER TABLE adicionando ou removendo coluna sem perder os dados existentes",
  "bd.cr27": "Explicou o que DROP TABLE e CREATE/DROP INDEX fazem antes de executar cada comando",
  "bd.cr28": "Mostrou INSERT, UPDATE e DELETE com WHERE, explicando por que aquela condição afeta só as linhas certas",
  "bd.cr29": "Apresentou SELECT com WHERE, ORDER BY e LIMIT, explicando o papel de cada cláusula à banca",
  "bd.cr30": "Usou e explicou operadores aritméticos, relacionais e lógicos sem erro de lógica visível",
  "bd.cr31": "Demonstrou COUNT, SUM, AVG, CONCAT ou DATEDIFF respondendo a uma pergunta do enunciado ao vivo",
  "bd.cr32": "Apresentou GROUP BY, HAVING e UNION em uso e explicou o que cada um faz no contexto",
  "bd.cr33": "Demonstrou INNER, LEFT, RIGHT ou CROSS JOIN e explicou à banca por que escolheu aquele tipo",
  "bd.cr34": "Apresentou VIEW e STORED PROCEDURE executando e devolvendo o resultado descrito no enunciado",
  "bd.cr35": "Demonstrou FUNCTION devolvendo o valor esperado e TRIGGER disparando no evento correto",
  "bd.cr36": "Mostrou EVENT agendado e usou COMMIT, ROLLBACK e SAVEPOINT durante a demonstração ao vivo",
  "bd.cr37": "Demonstrou a exportação completa do banco com mysqldump ou pelo Workbench ao vivo",
  "bd.cr38": "Importou o arquivo .sql ao vivo e mostrou o banco restaurado sem erro para a banca",
  "bd.cr39": "Verificou ao vivo, após a importação, que todos os registros chegaram sem perda ou distorção",
  "bd.cr40": "Apresentou dentro do tempo combinado — sem ultrapassar nem encerrar muito antes do mínimo",
  "bd.cr41": "Dividiu a apresentação de forma que cada integrante apresentou sua parte, sem ninguém ficar de fora",
  "bd.cr42": "Usou o tempo da apresentação de forma equilibrada entre os tópicos, sem ficar em branco nem acelerar",
  "bd.cr43": "Respondeu às perguntas da banca identificando o ponto de dúvida e propondo a resposta por conta própria",
  "bd.cr44": "Organizou a apresentação do problema à solução sem etapa desnecessária ou fio solto",
  "bd.cr45": "Adaptou a explicação ao que a banca perguntou, mostrando que entendeu o problema específico",
  "bd.cr46": "Respondeu a perguntas e críticas da banca com respeito, usando o retorno durante a apresentação",
  "bd.cr47": "Cada integrante participou da apresentação e da sessão de perguntas sem delegar tudo a um único membro",
  "bd.cr48": "Manteve a postura quando a banca fez uma pergunta difícil ou apontou um erro — continuou sem travar",
  "bd.cr49": "Citou referências (documentação, exemplos) consultadas na preparação, sem precisar que a banca pedisse",
  "bd.cr50": "Apresentou algo além do conteúdo da aula — testou, explorou e trouxe sem ser pedido",
  "bd.cr51": "Conduziu sua parte da apresentação sem depender do professor ou colega para lembrar o que falar"
};

// Avaliações previstas. turma = código SENAI (bate com o nome da turma no sistema, ex.: DETS-I-1A-26CT-S).
// caps/socio = capacidades avaliadas (do plano de aulas); os critérios sugeridos saem delas.
// detalhados: rubrica da prova (preencher junto com o professor para as próximas).
const MS3_1A_RUBRICA = [
  { id: "d1", titulo: "Identificação de entidades", liga: "bd.cr10", pontos: 8, texto: "O número de entidades no diagrama é igual ao citado no enunciado da sua versão, e cada nome corresponde a um termo do enunciado." },
  { id: "d2", titulo: "Classificação de atributos", liga: "bd.cr10", pontos: 8, texto: "Os atributos especiais (composto, multivalorado, derivado) aparecem com o símbolo próprio, diferente do círculo simples." },
  { id: "d3", titulo: "Cardinalidades", liga: "bd.cr11", pontos: 8, texto: "Todo relacionamento tem o mínimo e o máximo escritos dos dois lados, batendo com o enunciado." },
  { id: "d4", titulo: "Obrigatoriedade / participação", liga: "bd.cr11", pontos: 8, texto: "O mínimo (0 ou 1) de cada lado segue o enunciado: 0 quando ele diz \"pode\" ou \"nem todo\", 1 quando diz \"todo\" ou \"sempre\"." },
  { id: "d5", titulo: "Notação brModelo 3", liga: "bd.cr12", pontos: 8, texto: "Entidade = retângulo, atributo = círculo, relacionamento = losango com nome, chave = círculo preenchido, no diagrama inteiro." },
  { id: "d6", titulo: "Regras de conversão (MER para lógico)", liga: "bd.cr13", pontos: 10, texto: "As transformações do conceitual aparecem no modelo lógico: atributo composto, multivalorado, 1:N, N:N e generalização convertidos." },
  { id: "d7", titulo: "Chaves primárias e estrangeiras", liga: "bd.cr13", pontos: 10, texto: "Toda tabela tem [PK] e toda tabela do lado N de um 1:N tem a [FK] apontando para a tabela certa." },
  { id: "d8", titulo: "Coerência referencial", liga: "bd.cr14", pontos: 10, texto: "Em todo 1:N a FK está na tabela do lado N (nunca do lado 1)." },
  { id: "d9", titulo: "Tabelas associativas", liga: "bd.cr15", pontos: 10, texto: "Todo N:N virou uma tabela nova cuja PK é a junção das 2 FKs." },
  { id: "d10", titulo: "Autoverificação do modelo lógico", liga: "bd.cr43", pontos: 20, texto: "Você confere o SEU modelo e aponta elementos concretos dele (nome de tabela ou coluna), em vez de responder de forma genérica." }
];
export const PLANOS_ENSINO = [
  { unidade: "bd", periodo: "2026-2", turma: "1A", planilha: "Turma 2A (EM Integrado) · terças", avaliacoes: [
    { id: "ms1", nome: "MS1 — SGBD", data: "2026-08-11", caps: [1], socio: [1, 2, 3] },
    { id: "ms2", nome: "MS2 — MER completo", data: "2026-08-25", caps: [4, 5], socio: [1, 2, 3, 4] },
    { id: "ms3", nome: "MS3 — Modelo conceitual + lógico", data: "2026-09-29", caps: [4, 5, 7], socio: [1, 2, 3], detalhados: MS3_1A_RUBRICA },
    { id: "ms4", nome: "MS4 — Modelo físico (DDL, DCL, import/export)", data: "2026-10-27", caps: [8, 9, 13], socio: [1, 2, 3, 4] },
    { id: "ms5", nome: "MS5 — SQL prático", data: "2026-11-24", caps: [10, 11], socio: [1, 2, 3, 4] },
    { id: "som", nome: "SOM GERAL — Projeto final em grupo + prova oral", data: "2026-12-15", grupo: true, caps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], socio: [1, 2, 3, 4] }
  ] },
  { unidade: "bd", periodo: "2026-2", turma: "1B", planilha: "Turma 2B (EM Integrado) · quartas", avaliacoes: [
    { id: "ms1", nome: "MS1 — SGBD", data: "2026-08-12", caps: [1], socio: [1, 2, 3] },
    { id: "ms2", nome: "MS2 — MER completo", data: "2026-08-26", caps: [4, 5], socio: [1, 2, 3, 4] },
    { id: "ms3", nome: "MS3 — Modelo relacional", data: "2026-09-23", caps: [5, 7], socio: [1, 2, 3] },
    { id: "ms4", nome: "MS4 — Normalização", data: "2026-10-14", caps: [6], socio: [1, 2, 3] },
    { id: "som1", nome: "SOMATIVA 1 — Aetheria: modelagem completa", data: "2026-11-04", caps: [1, 2, 3, 4, 5, 6, 7, 8, 9], socio: [1, 2, 3, 4] },
    { id: "ms5", nome: "MS5 — SQL prático", data: "2026-12-02", caps: [10, 11], socio: [1, 2, 3, 4] },
    { id: "som2", nome: "SOMATIVA 2 — ArenaCraft: operação completa", data: "2026-12-16", caps: [5, 10, 11, 12, 13], socio: [1, 2, 3, 4] }
  ] }
];

// ---------- consultas ----------
export const criteriosDaUnidade = uid => CRITERIOS[uid] || [];
export const criterioPorId = id => criteriosDaUnidade(id.split(".")[0]).find(c => c[0] === id) || null;
export const codigoCriterio = id => "C" + id.split(".cr")[1];   // "bd.cr10" -> "C10"
// "DETS-I-1A-26CT-S" -> "1A"
export const codigoTurma = nome => (String(nome || "").toUpperCase().match(/(?:^|[^0-9A-Z])(\d[A-Z])(?=[^0-9A-Z]|$)/) || [])[1] || "";
// plano da turma; turma sem plano (ex.: turma de teste) usa o primeiro plano da unidade (critérios são iguais entre turmas)
export function planoDaTurma(unidadeId, turmaNome, { exato = false } = {}) {
  const c = codigoTurma(turmaNome), daUnidade = PLANOS_ENSINO.filter(p => p.unidade === unidadeId).sort((a, b) => b.periodo.localeCompare(a.periodo));
  return daUnidade.find(p => p.turma === c) || (exato ? null : daUnidade[0] || null);
}
// critérios sugeridos para uma avaliação prevista: os das capacidades dela (os de grupo só em avaliação de grupo)
export function criteriosSugeridos(uid, av) {
  if (!av) return [];
  const caps = new Set([...(av.caps || []).map(n => `${uid}.ct${n}`), ...(av.socio || []).map(n => `${uid}.cs${n}`)]);
  return criteriosDaUnidade(uid).filter(c => caps.has(c[1]) && (av.grupo || !c[4]?.grupo)).map(c => c[0]);
}
// avaliação prevista que corresponde à prova: a escolhida, ou pelo título (MS5, SOM…), ou pela data,
// ou (sem nada disso) a próxima prevista a partir da data da prova (ou de hoje)
export function avaliacaoDaProva(p, plano) {
  if (!plano) return null;
  const pc = p?.planoCurso || {};
  if (pc.avaliacao) return plano.avaliacoes.find(a => a.id === pc.avaliacao) || null;
  const t = String(p?.titulo || "").toUpperCase(), ms = t.match(/\bMS\s*-?\s*(\d)\b/);
  return (ms && plano.avaliacoes.find(a => a.id === "ms" + ms[1]))
    || (p?.dataProva && plano.avaliacoes.find(a => a.data === p.dataProva))
    || proximaAvaliacao(plano, p?.dataProva || undefined) || plano.avaliacoes[plano.avaliacoes.length - 1] || null;
}
const hojeISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
// próxima avaliação prevista (hoje ou depois), para destacar no formulário
export const proximaAvaliacao = (plano, hoje = hojeISO()) => plano?.avaliacoes.find(a => a.data >= hoje) || null;

// O que a prova avalia, em critérios. null = a unidade não tem critérios cadastrados (cai nas capacidades).
// prova.planoCurso = { unidade, avaliacao, criterios: [ids], detalhados: [{ id, titulo, texto, liga, pontos }] }
export function criteriosDaProva(p) {
  const pc = p?.planoCurso || {};
  if (pc.unidade === "nenhuma") return null;
  const u = unidadePorId(pc.unidade) || unidadeDaMateria(p?.materia);
  if (!u || !criteriosDaUnidade(u.id).length) return null;
  const plano = planoDaTurma(u.id, p?.turma), av = avaliacaoDaProva(p, plano);
  const ids = Array.isArray(pc.criterios) && pc.criterios.length ? pc.criterios : criteriosSugeridos(u.id, av);
  if (!ids.length) return null;
  const det = Array.isArray(pc.detalhados) ? pc.detalhados : (!pc.criterios && av?.detalhados) || [];
  const sel = criteriosDaUnidade(u.id).filter(c => ids.includes(c[0]));
  const grupos = pref => {
    const caps = (pref === "ct" ? u.tec : u.soc).filter(([cid]) => sel.some(c => c[1] === cid));
    return caps.map(([cid, nome]) => ({ id: cid, nome, criterios: sel.filter(c => c[1] === cid).map(([id, , texto, explicacao]) =>
      ({ id, codigo: codigoCriterio(id), texto, explicacao, detalhados: det.filter(d => d.liga === id) })) }));
  };
  return { unidade: u, avaliacao: av, tec: grupos("ct"), soc: grupos("cs"), detalhados: det };
}
