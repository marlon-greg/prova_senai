// PLANO DE ENSINO: critérios de avaliação e avaliações previstas por turma.
//
// REGRA FIXA (16/11/2026): OS CRITÉRIOS VÊM SÓ DO SISTEMA DE AUTOAVALIAÇÃO.
// O professor sobe o plano de ensino lá. Aqui não se cria nem se edita critério: o sistema de provas só lê
// e o professor só escolhe ou tira critérios na prova. Ver docs/ECOSSISTEMA.md, seção 2.
//
// De onde vêm: Firestore criteriosOficiais/{SIGLA} (ex.: criteriosOficiais/BD), no MESMO formato da importação
// do Stacktrace (ImportarConteudoBody):
//   { uc: { sigla, nome }, capacidades: [{ tipo: "TECNICA" | "SOCIOEMOCIONAL", numero, descricao,
//       criterios: [{ numero, texto, explicacao, manual? }] }], origem, atualizadoEm }
// Quem grava: o Worker, buscando na API da autoavaliação (servidor/integracao.js). Em último caso, o
// administrador principal importa à mão no painel (Organização > Critérios de avaliação), marcado como manual.
//
// IDs estáveis: UC BD + critério nº 25 → "bd.cr25"; capacidade técnica 9 → "bd.ct9"; socioemocional 2 → "bd.cs2".
// Quem usa: chame carregarCriteriosOficiais(db, { collection, getDocs }) depois do login, antes de desenhar.
// O aluno vê os CRITÉRIOS (com a explicação), não as capacidades cruas.
import { PLANO_CURSO, unidadeDaMateria, unidadePorId } from "./plano-curso.js?v=20261112d";

export const NIVEIS_RUBRICA = ["Mais que Satisfatório", "Satisfatório", "Parcialmente Satisfatório", "Não Satisfatório"];
export const COLECAO_CRITERIOS = "criteriosOficiais";

// Comportamento DESTE sistema ligado a alguns critérios (não é conteúdo do critério):
//   grupo = só faz sentido em trabalho em grupo (não entra sozinho nas provas individuais);
//   sinal = a participação no sistema de aulas gera evidência deste critério (sinaisDaParticipacao em evidencias.js).
// Se a numeração das socioemocionais mudar na autoavaliação, ajustar aqui.
const EXTRAS = {
  "bd.cr40": { sinal: "prazo" }, "bd.cr41": { grupo: true }, "bd.cr42": { sinal: "tempo" },
  "bd.cr47": { grupo: true, sinal: "coopera" }, "bd.cr49": { sinal: "busca" }, "bd.cr50": { sinal: "iniciativa" }
};

// uid -> [[id, capacidade, texto, explicação, extras]] — preenchido por usarCriteriosOficiais
export const CRITERIOS = {};
export const idCriterio = (uid, numero) => `${uid}.cr${String(numero).padStart(2, "0")}`;
const semAcento = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
// sigla da UC na autoavaliação → unidade do plano de curso (pela sigla = id, senão pelo nome)
export function unidadeDaUC(uc) {
  const sigla = semAcento(uc?.sigla), nome = semAcento(uc?.nome);
  return PLANO_CURSO.unidades.find(u => u.id === sigla) || PLANO_CURSO.unidades.find(u => semAcento(u.nome) === nome) || null;
}
// docs = conteúdo dos documentos de criteriosOficiais
export function usarCriteriosOficiais(docs) {
  for (const k of Object.keys(CRITERIOS)) delete CRITERIOS[k];
  for (const d of docs || []) {
    const u = unidadeDaUC(d?.uc); if (!u) continue;
    const lista = [];
    for (const cap of d.capacidades || []) {
      const capId = `${u.id}.${cap.tipo === "SOCIOEMOCIONAL" ? "cs" : "ct"}${cap.numero}`;
      for (const c of cap.criterios || []) {
        if (c.ativo === false || !(Number(c.numero) > 0) || !c.texto) continue;
        const id = idCriterio(u.id, c.numero);
        lista.push([id, capId, c.texto, c.explicacao || c.texto, { ...EXTRAS[id], ...(c.manual ? { manual: true } : {}) }]);
      }
    }
    CRITERIOS[u.id] = lista.sort((a, b) => a[0].localeCompare(b[0], "pt-BR", { numeric: true }));
  }
  return CRITERIOS;
}
let carregando = null;
export function carregarCriteriosOficiais(db, { collection, getDocs }, { forcar = false } = {}) {
  if (!carregando || forcar) carregando = getDocs(collection(db, COLECAO_CRITERIOS))
    .then(r => usarCriteriosOficiais(r.docs.map(x => x.data())))
    .catch(e => { carregando = null; console.warn("critérios oficiais:", e.message); return CRITERIOS; });
  return carregando;
}

// Avaliações previstas. turma = código SENAI (bate com o nome da turma no sistema, ex.: DETS-I-1A-26CT-S).
// caps/socio = capacidades avaliadas (do plano de aulas); os critérios sugeridos saem delas.
// PROVISÓRIO: as datas vêm das planilhas de BD e são as mesmas que o professor vai pôr na autoavaliação.
// Quando o plano de ensino estiver lá, estas avaliações também passam a vir de lá.
export const PLANOS_ENSINO = [
  { unidade: "bd", periodo: "2026-2", turma: "1A", planilha: "Turma 2A (EM Integrado) · terças", avaliacoes: [
    { id: "ms1", nome: "MS1 — SGBD", data: "2026-08-11", caps: [1], socio: [1, 2, 3] },
    { id: "ms2", nome: "MS2 — MER completo", data: "2026-08-25", caps: [4, 5], socio: [1, 2, 3, 4] },
    { id: "ms3", nome: "MS3 — Modelo conceitual + lógico", data: "2026-09-29", caps: [4, 5, 7], socio: [1, 2, 3] },
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
// prova.planoCurso = { unidade, avaliacao, criterios: [ids], instrumento }
export function criteriosDaProva(p) {
  const pc = p?.planoCurso || {};
  if (pc.unidade === "nenhuma") return null;
  const u = unidadePorId(pc.unidade) || unidadeDaMateria(p?.materia);
  if (!u || !criteriosDaUnidade(u.id).length) return null;
  const plano = planoDaTurma(u.id, p?.turma), av = avaliacaoDaProva(p, plano);
  const ids = Array.isArray(pc.criterios) && pc.criterios.length ? pc.criterios : criteriosSugeridos(u.id, av);
  if (!ids.length) return null;
  const sel = criteriosDaUnidade(u.id).filter(c => ids.includes(c[0]));
  if (!sel.length) return null;
  const grupos = pref => {
    const caps = (pref === "ct" ? u.tec : u.soc).filter(([cid]) => sel.some(c => c[1] === cid));
    return caps.map(([cid, nome]) => ({ id: cid, nome, criterios: sel.filter(c => c[1] === cid).map(([id, , texto, explicacao]) =>
      ({ id, codigo: codigoCriterio(id), texto, explicacao })) }));
  };
  return { unidade: u, avaliacao: av, tec: grupos("ct"), soc: grupos("cs") };
}
