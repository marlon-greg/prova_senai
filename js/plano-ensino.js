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
// Detalhados = critérios da RUBRICA de uma prova (mais específicos), sempre ligados a um critério oficial.
//   Níveis da rubrica: Mais que Satisfatório, Satisfatório, Parcialmente Satisfatório, Não Satisfatório.
import { unidadeDaMateria, unidadePorId } from "./plano-curso.js?v=20261112d";

export const NIVEIS_RUBRICA = ["Mais que Satisfatório", "Satisfatório", "Parcialmente Satisfatório", "Não Satisfatório"];

export const CRITERIOS = {
  bd: [
    ["bd.cr01", "bd.ct1", "Reconheceu corretamente a diferença entre bancos relacionais e não relacionais", "Saber explicar o que muda entre um banco organizado em tabelas (relacional, ex.: MySQL) e um banco sem tabelas fixas (não relacional, ex.: MongoDB)."],
    ["bd.cr02", "bd.ct1", "Associou corretamente exemplos de SGBDs aos seus respectivos modelos", "Dado o nome de um SGBD (MySQL, PostgreSQL, MongoDB, Redis…), dizer se ele é relacional ou não relacional."],
    ["bd.cr03", "bd.ct1", "Apontou pelo menos duas vantagens e desvantagens de cada tipo", "Citar pelo menos 2 pontos fortes e 2 pontos fracos de cada tipo de banco e saber quando usar cada um."],
    ["bd.cr04", "bd.ct2", "Instalou com sucesso o SGBD proposto no ambiente", "Instalar o MySQL (ou o SGBD pedido) e deixar ele funcionando no computador."],
    ["bd.cr05", "bd.ct2", "Criou uma base de dados funcional", "Criar um banco de dados (database) que abre e aceita tabelas e dados."],
    ["bd.cr06", "bd.ct2", "Conseguiu acessar e operar o banco por interface gráfica ou CLI", "Conectar no banco e trabalhar nele, pelo Workbench ou pela linha de comando."],
    ["bd.cr07", "bd.ct3", "Escolheu tipos de dados apropriados para os campos", "Escolher o tipo certo para cada campo: número inteiro, decimal, texto, data, verdadeiro/falso."],
    ["bd.cr08", "bd.ct3", "Justificou corretamente as escolhas de tipo", "Explicar por que escolheu cada tipo (ex.: preço em DECIMAL, e não em INT ou VARCHAR)."],
    ["bd.cr09", "bd.ct3", "Criou tabelas sem conflitos de tipos nos dados inseridos", "Criar tabelas em que os dados inseridos cabem nos tipos escolhidos, sem erro de tipo ou de tamanho."],
    ["bd.cr10", "bd.ct4", "Elaborou um DER completo com entidades, atributos e relacionamentos", "Desenhar o diagrama com todas as entidades, atributos e relacionamentos que o problema pede, sem faltar nem sobrar."],
    ["bd.cr11", "bd.ct4", "Representou corretamente os tipos de relacionamento (1:1, 1:N, N:N)", "Marcar certo se cada relacionamento é 1:1, 1:N ou N:N, de acordo com o que o enunciado descreve."],
    ["bd.cr12", "bd.ct4", "Utilizou notação adequada e padronizada no diagrama", "Usar os símbolos do padrão (no brModelo: retângulo, círculo, losango, chave preenchida) de um jeito legível."],
    ["bd.cr13", "bd.ct5", "Definiu corretamente chaves primárias e estrangeiras nas tabelas", "Toda tabela com chave primária (PK) e as chaves estrangeiras (FK) no lugar certo para ligar as tabelas."],
    ["bd.cr14", "bd.ct5", "Implementou relacionamentos com integridade referencial (ON DELETE/UPDATE)", "Ligar as tabelas de forma que nenhum registro aponte para algo que não existe (FK válida, ON DELETE / ON UPDATE)."],
    ["bd.cr15", "bd.ct5", "Estruturou tabelas associativas para relacionamentos N:N quando necessário", "Quando o relacionamento é N:N, criar uma tabela no meio que guarda as duas chaves."],
    ["bd.cr16", "bd.ct6", "Identificou redundâncias e anomalias em estrutura não normalizada", "Olhar uma tabela mal feita e apontar os dados repetidos e os problemas que eles causam ao inserir, alterar ou apagar."],
    ["bd.cr17", "bd.ct6", "Aplicou corretamente as 1ª, 2ª e 3ª formas normais", "Aplicar as três formas normais: valores atômicos (1FN), sem dependência parcial da chave (2FN) e sem dependência transitiva (3FN)."],
    ["bd.cr18", "bd.ct6", "Reestruturou o modelo para minimizar a duplicidade de dados", "Dividir as tabelas para que cada informação fique guardada em um lugar só."],
    ["bd.cr19", "bd.ct7", "Criou tabela de dicionário com nome, tipo, descrição e restrições", "Montar a tabela que descreve cada campo: nome, tipo, descrição e restrições (PK, FK, NOT NULL…)."],
    ["bd.cr20", "bd.ct7", "Garantiu a consistência entre o dicionário e o banco implementado", "O que está escrito no dicionário de dados é igual ao que foi criado no banco."],
    ["bd.cr21", "bd.ct7", "Apresentou clareza e organização no documento", "O dicionário está organizado e fácil de outra pessoa ler e entender."],
    ["bd.cr22", "bd.ct8", "Criou corretamente um ou mais usuários com GRANT", "Criar usuários no banco (CREATE USER) e dar permissões a eles com GRANT."],
    ["bd.cr23", "bd.ct8", "Limitou permissões conforme solicitado no exercício", "Dar a cada usuário só as permissões que o exercício pede, nada a mais (princípio do menor privilégio)."],
    ["bd.cr24", "bd.ct8", "Utilizou REVOKE para retirar acessos específicos", "Tirar uma permissão específica de um usuário com REVOKE."],
    ["bd.cr25", "bd.ct9", "Criou tabelas corretamente com CREATE TABLE", "Escrever CREATE TABLE que roda sem erro, com colunas, tipos e restrições certas."],
    ["bd.cr26", "bd.ct9", "Alterou estruturas com ALTER TABLE sem erros", "Mudar uma tabela que já existe (adicionar, alterar ou remover coluna ou restrição) com ALTER TABLE sem quebrar nada."],
    ["bd.cr27", "bd.ct9", "Utilizou DROP TABLE e CREATE/DROP INDEX com consciência dos efeitos", "Usar DROP TABLE e CREATE/DROP INDEX sabendo o que cada comando apaga ou cria."],
    ["bd.cr28", "bd.ct10", "Utilizou INSERT, UPDATE e DELETE com filtros e condições apropriadas", "Inserir, alterar e apagar dados usando WHERE para mexer só nas linhas certas."],
    ["bd.cr29", "bd.ct10", "Estruturou SELECT com clareza, aplicando WHERE, ORDER BY e LIMIT corretamente", "Montar consultas SELECT claras, filtrando com WHERE, ordenando com ORDER BY e limitando com LIMIT."],
    ["bd.cr30", "bd.ct10", "Aplicou operadores aritméticos, relacionais e lógicos com precisão", "Usar operadores de conta (+ - * /), de comparação (= <> < >) e lógicos (AND, OR, NOT) do jeito certo."],
    ["bd.cr31", "bd.ct11", "Utilizou funções de agregação, string e data em consultas contextualizadas", "Usar funções de agregação (COUNT, SUM, AVG…), de texto (CONCAT, UPPER…) e de data (NOW, DATEDIFF…) para responder perguntas."],
    ["bd.cr32", "bd.ct11", "Aplicou GROUP BY, HAVING e UNION corretamente para consolidação de dados", "Agrupar resultados com GROUP BY, filtrar os grupos com HAVING e juntar consultas com UNION."],
    ["bd.cr33", "bd.ct11", "Utilizou diferentes tipos de JOINs (INNER, LEFT, RIGHT, CROSS) conforme a necessidade", "Juntar tabelas com o JOIN certo para cada caso: INNER, LEFT, RIGHT ou CROSS."],
    ["bd.cr34", "bd.ct12", "Criou VIEWs e STORED PROCEDUREs funcionais atendendo à regra de negócio", "Criar VIEWs e STORED PROCEDUREs que funcionam e fazem o que a regra de negócio pede."],
    ["bd.cr35", "bd.ct12", "Implementou FUNCTIONs e TRIGGERs com lógica correta", "Criar FUNCTIONs que devolvem o valor certo e TRIGGERs que disparam na hora certa."],
    ["bd.cr36", "bd.ct12", "Programou EVENTs e utilizou TCL (COMMIT, ROLLBACK, SAVEPOINT) em transações", "Agendar tarefas com EVENT e usar COMMIT, ROLLBACK e SAVEPOINT para confirmar ou desfazer transações."],
    ["bd.cr37", "bd.ct13", "Realizou exportação completa da base com ferramentas adequadas", "Gerar o backup completo do banco (ex.: mysqldump ou exportação do Workbench)."],
    ["bd.cr38", "bd.ct13", "Importou arquivos SQL sem erros de estrutura ou chave", "Restaurar um arquivo .sql no banco sem erro de estrutura ou de chave."],
    ["bd.cr39", "bd.ct13", "Validou se os dados foram mantidos corretamente após a migração", "Conferir, depois da importação, que os dados chegaram todos e certos."],
    ["bd.cr40", "bd.cs1", "Entrega tarefas dentro do prazo acordado", "Entregar as atividades no prazo combinado."],
    ["bd.cr41", "bd.cs1", "Organiza o projeto e divide o trabalho adequadamente", "Organizar o próprio trabalho (e o do grupo) e dividir as tarefas de forma justa.", { grupo: true }],
    ["bd.cr42", "bd.cs1", "Apresenta consistência entre as atividades e o tempo dedicado", "Usar bem o tempo da aula e da prova: o que você entrega combina com o tempo que teve."],
    ["bd.cr43", "bd.cs2", "Identifica falhas e propõe soluções", "Encontrar o erro sozinho e propor uma correção."],
    ["bd.cr44", "bd.cs2", "Demonstra lógica coerente ao estruturar consultas e fluxos de dados", "Montar consultas e modelos com um raciocínio que faz sentido do começo ao fim."],
    ["bd.cr45", "bd.cs2", "Interpreta problemas e adapta o script SQL para solucioná-los", "Entender o problema do enunciado e adaptar o SQL ou o modelo para resolver."],
    ["bd.cr46", "bd.cs3", "Responde de forma respeitosa a críticas ou correções", "Receber correções e críticas com respeito e usar para melhorar."],
    ["bd.cr47", "bd.cs3", "Coopera com colegas em atividades em dupla ou grupo", "Ajudar e trabalhar junto com os colegas em dupla ou em grupo.", { grupo: true }],
    ["bd.cr48", "bd.cs3", "Lida com frustrações durante a depuração e ajustes no código", "Manter a calma quando algo dá erro e seguir tentando até resolver."],
    ["bd.cr49", "bd.cs4", "Busca referências (documentação, exemplos) por conta própria", "Procurar sozinho na documentação e em exemplos quando tem dúvida."],
    ["bd.cr50", "bd.cs4", "Demonstra iniciativa ao explorar além do que foi mostrado", "Ir além do que foi mostrado em aula, testando e explorando por conta própria."],
    ["bd.cr51", "bd.cs4", "Contribui para o desenvolvimento do próprio projeto de forma independente", "Fazer a sua parte do projeto sem depender de alguém mandando."]
  ]
  // próximas unidades: montar com o professor a partir do plano de ensino de cada uma
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
