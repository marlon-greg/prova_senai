// Simulação → 🏗 AMBIENTE DE TESTE: cria dados FICTÍCIOS de verdade no banco para testar e demonstrar TODAS as telas
// (turma, alunos fake, banco de questões, provas, tentativas com respostas e notas, alunos com acessibilidade e diário,
// perfis com status do dia). Tudo tem id começando com "sim" e o título com 🧪 TESTE; "Apagar" remove tudo de uma vez.
// Os e-mails dos alunos são @simulacao.teste: ninguém consegue entrar com eles.
import { db, semestreDe, periodoLetivo } from "./common.js";
import { resumoDiario } from "./conquistas.js";
import { avatarAleatorio } from "./avatar.js";
import { PERFIS_DEMO } from "./demo-acess-dados.js";
import { collection, doc, getDoc, getDocs, writeBatch, query, where, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const SIM = { turma: "sim-turma-1", banco: "sim-banco-sql", provas: ["sim-prova-1", "sim-prova-2", "sim-prova-3"] };
const DOMINIO = "simulacao.teste";
// alunos fake: "acerta" = chance de acertar (deixa as notas variadas); acess = perfil de acessibilidade (demo)
const ALUNOS = [
  { nome: "Ana Clara Souza", acerta: .7, acess: "ana", status: "🎯 Focado(a)", corpo: "feminino" },
  { nome: "Bruno Henrique Lima", acerta: .45, acess: "bruno", status: "😔 Triste", corpo: "masculino" },
  { nome: "Carla Mendes", acerta: .75, acess: "carla", status: "📚 Estudando", corpo: "feminino" },
  { nome: "Diego Rocha", acerta: .9, status: "💻 Programando", corpo: "masculino" },
  { nome: "Eduarda Pires", acerta: .55, status: "😰 Ansioso(a)", corpo: "feminino" },
  { nome: "Felipe Santos", acerta: .35, status: "😴 Com sono", corpo: "masculino" },
  { nome: "Gabriela Nunes", acerta: .8, status: "🚀 Motivado(a)", corpo: "feminino" },
  { nome: "Heitor Alves", acerta: .6, status: "🙂 De boa", corpo: "masculino" }
].map((a, i) => ({ ...a, uid: `sim-u${i + 1}`, email: `${a.nome.split(" ")[0].toLowerCase()}.${a.nome.split(" ").at(-1).toLowerCase()}@${DOMINIO}` }));

export const ALUNOS_ACESS_SIM = ALUNOS.filter(a => a.acess).map(a => ({ nome: a.nome, email: a.email }));

const QUESTOES = [
  { tema: "Consultas", tipo: "alternativa", enunciado: "Em SQL, qual comando é usado para consultar (ler) registros de uma tabela?", alternativas: ["SELECT", "INSERT", "UPDATE", "DELETE"], correta: 0, explicacao: "SELECT lê os dados; INSERT inclui, UPDATE altera e DELETE apaga." },
  { tema: "Modelagem", tipo: "alternativa", enunciado: "O que define corretamente uma chave primária (PRIMARY KEY)?", alternativas: ["Coluna que aceita valores repetidos", "Coluna que identifica cada registro de forma única e não aceita nulos", "Coluna que aponta para outra tabela", "Índice só para ordenar"], correta: 1, explicacao: "A chave primária identifica cada linha: não repete e não é nula." },
  { tema: "Consultas", tipo: "alternativa", enunciado: "Qual é a ordem correta das cláusulas numa consulta?", alternativas: ["FROM, SELECT, WHERE, ORDER BY", "SELECT, FROM, WHERE, ORDER BY", "SELECT, WHERE, FROM, ORDER BY", "WHERE, SELECT, FROM, ORDER BY"], correta: 1, explicacao: "SELECT (o quê), FROM (de onde), WHERE (filtro), ORDER BY (ordem)." },
  { tema: "Tipos de dados", tipo: "alternativa", enunciado: "Qual tipo é o mais adequado para guardar nomes de alunos?", alternativas: ["INT", "DATE", "VARCHAR", "DECIMAL"], correta: 2, explicacao: "VARCHAR guarda texto de tamanho variável." },
  { tema: "DCL", tipo: "alternativa", enunciado: "Qual comando dá a um usuário a permissão de fazer SELECT numa tabela?", alternativas: ["REVOKE", "GRANT", "COMMIT", "ALTER"], correta: 1, explicacao: "GRANT dá permissão; REVOKE tira." },
  { tema: "Consultas", tipo: "alternativa", enunciado: "Para mostrar só os alunos com idade maior que 18, qual cláusula usamos?", alternativas: ["ORDER BY idade > 18", "GROUP BY idade > 18", "WHERE idade > 18", "HAVING idade"], correta: 2, explicacao: "WHERE filtra as linhas." },
  { tema: "DDL e DML", tipo: "dissertativa", enunciado: "Explique a diferença entre os comandos DELETE e DROP TABLE.", respostasAceitas: ["O DELETE apaga linhas e a tabela continua; o DROP TABLE apaga a tabela inteira."], palavrasChave: ["delete", "drop", "tabela"], explicacao: "DELETE remove registros; DROP TABLE remove a tabela toda." },
  { tema: "DDL e DML", tipo: "dissertativa", enunciado: "Para que serve o comando UPDATE? Dê um exemplo.", respostasAceitas: ["Altera dados que já existem. Ex.: UPDATE aluno SET nome = 'Ana' WHERE id = 1;"], palavrasChave: ["update", "set", "where"], explicacao: "UPDATE muda dados existentes; sem WHERE altera todas as linhas." }
];
const qid = i => `${SIM.banco}_q${String(i + 1).padStart(3, "0")}`;
const TEMAS = [...new Set(QUESTOES.map(q => q.tema))].sort((a, b) => a.localeCompare(b, "pt-BR"));
// respostas escritas de exemplo (boa, parcial, fraca)
const ESCRITAS = {
  6: ["O DELETE apaga as linhas da tabela, mas a tabela continua existindo. O DROP TABLE apaga a tabela inteira com a estrutura.", "O delete apaga dados e o drop apaga tudo.", "Os dois apagam."],
  7: ["O UPDATE altera dados que já existem. Exemplo: UPDATE aluno SET nome = 'Ana' WHERE id = 1;", "Serve para atualizar, tipo update aluno set nome.", "Serve para atualizar o banco."]
};

// sorteio estável (mesmos dados a cada criação)
function gerador(semente) { let h = 2166136261; for (const c of String(semente)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507), h = Math.imul(h ^ (h >>> 13), 3266489909), (h ^= h >>> 16) >>> 0) / 4294967296); }
const isoDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const diasAtras = (n, h = 9) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d; };

// lotes de até 450 gravações
function lotes() {
  let atual = writeBatch(db), n = 0; const todos = [atual];
  const op = f => { if (n >= 450) { atual = writeBatch(db); todos.push(atual); n = 0; } f(atual); n++; };
  return { set: (ref, d) => op(b => b.set(ref, d)), del: ref => op(b => b.delete(ref)), commit: async progresso => { for (const [i, b] of todos.entries()) { await b.commit(); progresso?.(i + 1, todos.length); } } };
}

export async function existeAmbiente() { return (await getDoc(doc(db, "turmas", SIM.turma)).catch(() => null))?.exists() || false; }

export async function criarAmbiente({ eu, progresso = () => {} }) {
  const L = lotes(), agora = new Date(), sem = semestreDe(), por = eu.email;
  progresso("Turma e alunos fake…");
  L.set(doc(db, "turmas", SIM.turma), { nome: "🧪 TESTE · DS-SIM-1A", teste: true, semestreCurso: 2, semestreCursoRef: periodoLetivo(), diasAula: [1, 3, 5],
    alunos: ALUNOS.map(a => ({ nome: a.nome, email: a.email })), emails: ALUNOS.map(a => a.email), nomesChave: [], vinculos: {}, criadoEm: serverTimestamp(), criadoPor: por });
  progresso("Banco de questões…");
  L.set(doc(db, "bancos", SIM.banco), { nome: "🧪 TESTE · SQL básico", materia: "Banco de Dados", semestre: sem, nQuestoes: QUESTOES.length, temas: TEMAS, teste: true, criadoEm: serverTimestamp(), criadoPor: por });
  QUESTOES.forEach((q, i) => {
    L.set(doc(db, "bancos", SIM.banco, "questoes", qid(i)), { ordem: i + 1, tipo: q.tipo, enunciado: q.enunciado, peso: 1, tema: q.tema, ...(q.tipo === "alternativa" ? { alternativas: q.alternativas } : {}) });
    L.set(doc(db, "bancos", SIM.banco, "gabaritos", qid(i)), q.tipo === "alternativa" ? { correta: q.correta, explicacao: q.explicacao } : { respostasAceitas: q.respostasAceitas, palavrasChave: q.palavrasChave, explicacao: q.explicacao });
  });
  progresso("Provas…");
  const base = { turmaId: SIM.turma, turma: "🧪 TESTE · DS-SIM-1A", semestre: sem, materia: "Banco de Dados", codigoAcesso: "", permitirVoltar: false, tempoMinutos: 30, modoExibicao: "uma",
    permitirTrocaAba: false, permitirColar: false, maxTrocasDeAba: 3, colarTiraVida: true, acaoAoExceder: "encerrar", materialConsultaUrl: "", materiaisConsultaIds: [], materialConsultaArquivoId: null, materialConsultaTitulo: "",
    bancoId: SIM.banco, bancoIds: [SIM.banco], temasPorBanco: { [SIM.banco]: TEMAS }, temas: TEMAS, nQuestoes: 6, nAlternativas: 5, nDissertativas: 1, teste: true, criadoEm: serverTimestamp(), criadoPor: por };
  const PROVAS = [
    { id: SIM.provas[0], titulo: "🧪 TESTE · Prova 1 — SQL (corrigida, gabarito liberado)", dataProva: isoDe(diasAtras(21)), resultadosLiberados: true, liberada: false, questoes: [0, 1, 2, 3, 4, 6], fazem: 8, corrigida: true, dias: 21 },
    { id: SIM.provas[1], titulo: "🧪 TESTE · Prova 2 — SQL (escritas para corrigir)", dataProva: isoDe(diasAtras(3)), resultadosLiberados: false, liberada: false, questoes: [0, 2, 3, 5, 4, 7], fazem: 6, corrigida: false, dias: 3 },
    { id: SIM.provas[2], titulo: "🧪 TESTE · Prova 3 — rascunho (ninguém fez)", dataProva: isoDe(diasAtras(-7)), resultadosLiberados: false, liberada: false, questoes: [], fazem: 0, dias: 0 }
  ];
  PROVAS.forEach(p => { const { questoes, fazem, corrigida, dias, id, ...dados } = p; L.set(doc(db, "provas", id), { ...base, ...dados }); });
  progresso("Tentativas, respostas e notas dos alunos fake…");
  for (const p of PROVAS.filter(x => x.fazem)) {
    ALUNOS.slice(0, p.fazem).forEach(a => {
      const r = gerador(a.uid + p.id), tid = `sim_${a.uid}_${p.id}`, ids = p.questoes.map(qid);
      let pts = 0, acertos = 0, pendentes = 0;
      const ini = diasAtras(p.dias, 8), fim = new Date(ini.getTime() + (12 + r() * 18) * 60000), trocas = r() < .25 ? 1 + Math.floor(r() * 2) : 0;
      const respostas = p.questoes.map(i => {
        const q = QUESTOES[i], bom = r() < a.acerta;
        if (q.tipo === "alternativa") { const resp = bom ? q.correta : (q.correta + 1 + Math.floor(r() * (q.alternativas.length - 1))) % q.alternativas.length; if (bom) { pts++; acertos++; } return { i, resp }; }
        const nivel = a.acerta > .75 ? 0 : a.acerta > .5 ? 1 : 2;
        return { i, resp: ESCRITAS[i][nivel], nivel };
      });
      respostas.forEach(({ i, resp, nivel }) => {
        L.set(doc(db, "tentativas", tid, "respostas", qid(i)), { resposta: resp, enviadaEm: Timestamp.fromDate(fim), segundos: 40 + Math.floor(r() * 200) });
        if (QUESTOES[i].tipo === "dissertativa") {
          if (p.corrigida) { const v = [1, .5, 0][nivel]; pts += v; if (v === 1) acertos++;
            L.set(doc(db, "tentativas", tid, "correcoes", qid(i)), { pontos: v, comentario: ["Muito bem explicado!", "Faltou dizer que a tabela continua existindo.", "Revise a diferença entre apagar linhas e apagar a tabela."][nivel], corrigidoPor: por, corrigidoEm: serverTimestamp() }); }
          else pendentes++;
        }
      });
      const nota = Math.round(pts / ids.length * 1000) / 10;
      L.set(doc(db, "tentativas", tid), { uid: a.uid, email: a.email, nome: a.nome, provaId: p.id, bancoId: SIM.banco, questoesIds: ids, simulado: true,
        iniciadaEm: Timestamp.fromDate(ini), finalizadaEm: Timestamp.fromDate(fim), indiceAtual: ids.length, trocasDeAba: trocas, saidasTelaCheia: trocas, tentativasColar: 0,
        tempoTotalSegundos: Math.round((fim - ini) / 1000), acertos, totalQuestoes: ids.length, notaPrevia: nota, aguardandoCorrecao: pendentes,
        ...(p.corrigida ? { nota, notaMaxima: 100, corrigidaEm: serverTimestamp(), corrigidaPor: por } : {}) });
    });
  }
  progresso("Alunos com acessibilidade e diário…");
  for (const a of ALUNOS.filter(x => x.acess)) {
    const perfil = PERFIS_DEMO.find(p => p.id === a.acess), r = gerador("diario" + a.uid), regs = [];
    for (let n = 30; n >= 1; n--) {
      const d = diasAtras(n); if (![1, 3, 5].includes(d.getDay())) continue;
      const t = (30 - n) / 30, nivel = v => Math.max(1, Math.min(5, Math.round(v + t * 1.4 + (r() - .5))));   // melhora ao longo do mês
      const sobre = r() < .18 - t * .1 ? (r() < .5 ? "sim" : "leve") : "nao";
      regs.push({ id: `${isoDe(d)}_sim`, data: isoDe(d), tipo: "diario", autor: "auxiliar@" + DOMINIO, autorNome: "Auxiliar (fictícia)", papel: "inclusao", nComentarios: 0, completo: 90,
        respostas: { humorChegada: nivel(2.4), humorSaida: nivel(3), energia: ["baixa", "media", "media", "alta"][Math.floor(r() * 4)], compreensao: nivel(2.2), autonomia: nivel(2), foco: nivel(2.6), comunicacao: nivel(3), estrelas: nivel(2.8),
          materias: [{ materia: "Banco de Dados", topicos: [["SELECT", "WHERE", "Chave primária", "Tipos de dados"][Math.floor(r() * 4)]], feito: ["Fez consultas SELECT com apoio do passo a passo.", "Montou uma tabela no Workbench seguindo o modelo.", "Resolveu exercícios de WHERE com a auxiliar.", "Ligou os tipos de dados aos exemplos."][Math.floor(r() * 4)] }],
          interacao: ["Com a auxiliar", r() < .5 ? "Com colegas" : "Com o professor"], sobrecarga: sobre, ...(sobre !== "nao" ? { gatilhos: [["Barulho", "Mudança de rotina", "Cansaço"][Math.floor(r() * 3)]] } : {}),
          estrategias: ["Instrução passo a passo", ["Apoio visual / imagem", "Pausa / intervalo", "Reforço positivo"][Math.floor(r() * 3)]], dificuldades: [["Texto longo", "Muitas etapas", "Cálculos"][Math.floor(r() * 3)]],
          humorTexto: r() < .3 ? "Chegou um pouco agitada por causa do ônibus e melhorou depois do intervalo." : "", comportamentoTexto: "Participou bem, pediu ajuda quando travou e respeitou os combinados.",
          funcionou: "Dividir o exercício em partes e mostrar um exemplo antes.", conquista: r() < .35 ? "Fez sozinha o SELECT com WHERE e explicou para a colega." : "",
          paraProvas: r() < .3 ? "Entende melhor quando a questão tem um exemplo pronto; trava com enunciado longo." : "" } });
    }
    L.set(doc(db, "acessibilidade", a.email), { email: a.email, nome: a.nome, ativo: true, uid: a.uid, auxiliares: [], visual: perfil.visual, prova: perfil.prova, teste: true,
      diarioResumo: resumoDiario(regs, [1, 3, 5]), diarioResumoEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
    L.set(doc(db, "acessibilidadePrivado", a.email), { descricao: `${perfil.resumo} (perfil FICTÍCIO). ${perfil.descricao}` });
    regs.forEach(({ id, ...reg }) => L.set(doc(db, "acessibilidadePrivado", a.email, "diario", id), { ...reg, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() }));
  }
  progresso("Perfis e status do dia…");
  const g = Array.from({ length: 6 }, (_, i) => ({ id: "x" + i }));
  ALUNOS.forEach(a => L.set(doc(db, "perfis", a.uid), { avatar: avatarAleatorio(g, { corpo: a.corpo }), apelido: a.nome.split(" ")[0], status: a.status, statusEm: serverTimestamp(), email: a.email, atualizadoEm: serverTimestamp() }));
  await L.commit((i, n) => progresso(`Gravando… parte ${i} de ${n}`));
  return { alunos: ALUNOS.length, provas: PROVAS.length, questoes: QUESTOES.length };
}

export async function apagarAmbiente({ progresso = () => {} } = {}) {
  const L = lotes();
  progresso("Procurando os dados de teste…");
  const subs = async (caminho, nomes) => { for (const n of nomes) (await getDocs(collection(db, ...caminho, n)).catch(() => null))?.forEach(d => L.del(d.ref)); };
  for (const p of SIM.provas) {
    const ts = await getDocs(query(collection(db, "tentativas"), where("provaId", "==", p))).catch(() => null);
    for (const t of ts?.docs || []) { await subs(["tentativas", t.id], ["respostas", "correcoes"]); L.del(t.ref); }
    L.del(doc(db, "provas", p));
  }
  await subs(["bancos", SIM.banco], ["questoes", "gabaritos"]); L.del(doc(db, "bancos", SIM.banco));
  for (const a of ALUNOS) {
    L.del(doc(db, "perfis", a.uid));
    if (a.acess) { await subs(["acessibilidadePrivado", a.email], ["diario"]); L.del(doc(db, "acessibilidadePrivado", a.email)); L.del(doc(db, "acessibilidade", a.email)); }
  }
  L.del(doc(db, "turmas", SIM.turma));
  await L.commit((i, n) => progresso(`Apagando… parte ${i} de ${n}`));
}
