// Conquistas (gamificação) — usado pela página do aluno e, como prévia, pelo painel.
// Só coisas positivas: nada de humor, crise, faltas ou textos escritos sobre o aluno.
//
// As conquistas são REGRAS configuráveis (config/conquistas.lista; sem ela vale CONQUISTAS_PADRAO).
// Cada uma: { id, e (emoji), t (título), d (descrição), grupo: "geral" | "materia" | "diario", regra, n, min, campo, ativa }
// 1) Notas (todos os alunos): tentativas finalizadas do próprio aluno.
// 2) Diário (alunos com acessibilidade): o resumo positivo gravado pela auxiliar em acessibilidade/{email}.diarioResumo.

export const REGRAS = {
  provas:          { grupo: "geral", nome: "Fez N provas", campos: ["n"] },
  nota:            { grupo: "geral", nome: "Uma nota ≥ mínimo", campos: ["min"] },
  notasSeguidas:   { grupo: "geral", nome: "N notas seguidas ≥ mínimo", campos: ["n", "min"] },
  evolucao:        { grupo: "geral", nome: "Melhorou a nota N vezes", campos: ["n"] },
  semVidas:        { grupo: "geral", nome: "N provas sem perder vida", campos: ["n"] },
  materiasMin:     { grupo: "geral", nome: "Nota ≥ mínimo em N matérias diferentes", campos: ["n", "min"] },
  materiaNota:     { grupo: "materia", nome: "Na matéria: uma nota ≥ mínimo", campos: ["min"] },
  materiaMedia:    { grupo: "materia", nome: "Na matéria: média ≥ mínimo com N provas", campos: ["n", "min"] },
  materiaEvolucao: { grupo: "materia", nome: "Na matéria: melhorou N vezes", campos: ["n"] },
  diario:          { grupo: "diario", nome: "Diário: contador ≥ N", campos: ["campo", "n"] }
};
export const CAMPOS_DIARIO = { aulas: "aulas registradas", sequencia: "aulas seguidas com presença", estrelas: "estrelas somadas", autonomia: "aulas com autonomia (4–5)",
  foco: "aulas bem focadas (4–5)", compreensao: "aulas entendendo bem (4–5)", vitorias: "vitórias do dia", topicos: "tópicos diferentes trabalhados" };

export const CONQUISTAS_PADRAO = [
  { id: "primeira-prova", e: "🎓", t: "Primeira prova", d: "Termine a sua primeira prova", grupo: "geral", regra: "provas", n: 1 },
  { id: "trinca-de-ouro", e: "🥇", t: "Trinca de ouro", d: "3 notas seguidas acima de 80 (qualquer matéria)", grupo: "geral", regra: "notasSeguidas", n: 3, min: 80 },
  { id: "constancia", e: "🛡", t: "Constância", d: "5 notas seguidas de 60 para cima", grupo: "geral", regra: "notasSeguidas", n: 5, min: 60 },
  { id: "gabaritou", e: "💯", t: "Gabaritou!", d: "Tire 100 em uma prova", grupo: "geral", regra: "nota", min: 100 },
  { id: "em-evolucao", e: "📈", t: "Em evolução", d: "Melhore a nota em relação à prova anterior 3 vezes", grupo: "geral", regra: "evolucao", n: 3 },
  { id: "coracao-intacto", e: "❤️", t: "Coração intacto", d: "5 provas sem perder nenhuma vida", grupo: "geral", regra: "semVidas", n: 5 },
  { id: "veterano", e: "🏅", t: "Veterano", d: "Faça 10 provas", grupo: "geral", regra: "provas", n: 10 },
  { id: "mandou-bem", e: "⭐", t: "Mandou bem em {materia}", d: "Uma nota de 80 para cima nesta matéria", grupo: "materia", regra: "materiaNota", min: 80 },
  { id: "mestre", e: "🧩", t: "Mestre em {materia}", d: "Média de 80 para cima com pelo menos 2 provas", grupo: "materia", regra: "materiaMedia", n: 2, min: 80 },
  { id: "decolando", e: "🚀", t: "Decolando em {materia}", d: "Melhore a nota nesta matéria 2 vezes", grupo: "materia", regra: "materiaEvolucao", n: 2 },
  { id: "primeira-aula", e: "🌱", t: "Primeira aula registrada", d: "Sua primeira aula no diário", grupo: "diario", regra: "diario", campo: "aulas", n: 1 },
  { id: "presenca-em-dia", e: "📅", t: "Presença em dia", d: "4 aulas seguidas", grupo: "diario", regra: "diario", campo: "sequencia", n: 4 },
  { id: "em-chamas", e: "🔥", t: "Em chamas", d: "10 aulas seguidas", grupo: "diario", regra: "diario", campo: "sequencia", n: 10 },
  { id: "chuva-de-estrelas", e: "⭐", t: "Chuva de estrelas", d: "Junte 25 estrelas", grupo: "diario", regra: "diario", campo: "estrelas", n: 25 },
  { id: "fiz-sozinha", e: "🦸", t: "Fiz sozinha!", d: "5 aulas fazendo as atividades com autonomia", grupo: "diario", regra: "diario", campo: "autonomia", n: 5 },
  { id: "foco-total", e: "🎯", t: "Foco total", d: "5 aulas bem focada", grupo: "diario", regra: "diario", campo: "foco", n: 5 },
  { id: "entendi-tudo", e: "🧠", t: "Entendi tudo", d: "5 aulas entendendo bem o conteúdo", grupo: "diario", regra: "diario", campo: "compreensao", n: 5 },
  { id: "exploradora", e: "📚", t: "Exploradora", d: "Trabalhe 8 tópicos diferentes", grupo: "diario", regra: "diario", campo: "topicos", n: 8 },
  { id: "colecionadora", e: "🏆", t: "Colecionadora de vitórias", d: "10 vitórias do dia", grupo: "diario", regra: "diario", campo: "vitorias", n: 10 },
  { id: "diario-de-ouro", e: "📒", t: "Diário de ouro", d: "30 aulas registradas", grupo: "diario", regra: "diario", campo: "aulas", n: 30 }
];
// lista válida (config do admin ou o padrão); só as ativas
export function listaAtiva(cfg) {
  const l = Array.isArray(cfg) && cfg.length ? cfg : CONQUISTAS_PADRAO;
  return l.filter(c => c && c.ativa !== false && REGRAS[c.regra] && c.id && c.t);
}

const isoDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// registros = documentos do diário; diasAula = [1, 3] (vazio = seg a sex)
// presença = registro completo (não justificativa) · "sem aula" não quebra a sequência
export function resumoDiario(registros, diasAula = []) {
  const dias = diasAula.length ? diasAula.map(Number) : [1, 2, 3, 4, 5];
  const presentes = new Set(registros.filter(r => r.tipo !== "justificativa").map(r => r.data));
  const semAula = new Set(registros.filter(r => r.tipo === "justificativa" && r.motivo === "semAula").map(r => r.data));
  const completos = registros.filter(r => r.tipo !== "justificativa");
  let seq = 0; const d = new Date();
  for (let i = 0; i < 400; i++, d.setDate(d.getDate() - 1)) {
    const iso = isoDe(d);
    if (!dias.includes(d.getDay()) || semAula.has(iso)) continue;
    if (presentes.has(iso)) seq++;
    else if (i > 0) break;
  }
  const topicos = new Set(completos.flatMap(r => (r.respostas?.materias || []).flatMap(m => (m.topicos || []).map(t => `${m.materia}|${t}`))));
  const n = (f) => completos.filter(f).length;
  return {
    aulas: presentes.size, sequencia: seq,
    estrelas: completos.reduce((s, r) => s + Number(r.respostas?.estrelas || 0), 0),
    autonomia: n(r => Number(r.respostas?.autonomia) >= 4), foco: n(r => Number(r.respostas?.foco) >= 4),
    compreensao: n(r => Number(r.respostas?.compreensao) >= 4), vitorias: n(r => String(r.respostas?.conquista || "").trim()),
    topicos: topicos.size, ultimaAula: [...presentes].sort().pop() || ""
  };
}
// medalhas do diário (as de grupo "diario" da lista)
export function medalhasDiario(r = {}, lista = null) {
  return listaAtiva(lista).filter(c => c.grupo === "diario").map(c => {
    const v = Number(r[c.campo] || 0), meta = Number(c.n || 1);
    return { ...c, v, meta, ok: v >= meta, prog: [Math.min(v, meta), meta] };
  });
}

// ---------- notas: todos os alunos ----------
// provas = [{ id, titulo, materia, data (ms), nota (0–100), vidasPerdidas }]
export function conquistasNotas(provas, lista = null) {
  const ps = provas.filter(p => Number.isFinite(p.nota)).sort((a, b) => a.data - b.data);
  const fmt = p => `${p.titulo}${p.materia ? ` (${p.materia})` : ""}: ${Math.round(p.nota)}`;
  const melhorSeq = (l, min) => { let m = 0, c = 0; for (const p of l) { c = p.nota >= min ? c + 1 : 0; m = Math.max(m, c); } return m; };
  const seguidas = (l, min, n) => { for (let i = 0; i + n <= l.length; i++) { const j = l.slice(i, i + n); if (j.every(p => p.nota >= min)) return j; } return null; };
  const subidas = l => { const out = []; for (let i = 1; i < l.length; i++) if (l[i].nota > l[i - 1].nota) out.push(`${fmt(l[i - 1])} → ${Math.round(l[i].nota)}`); return out; };
  const avaliar = (c, l, materia = null) => {
    const n = Number(c.n || 1), min = Number(c.min ?? 0);
    const base = { ...c, t: String(c.t).replace("{materia}", materia || ""), d: String(c.d || "").replace("{materia}", materia || "") };
    if (c.regra === "provas" ) return { ...base, ok: l.length >= n, detalhe: l.slice(0, Math.min(n, 3)).map(fmt), prog: [Math.min(l.length, n), n] };
    if (c.regra === "nota" || c.regra === "materiaNota") { const x = l.filter(p => p.nota >= min); return { ...base, ok: x.length > 0, detalhe: x.slice(0, 3).map(fmt), prog: [Math.min(x.length, 1), 1] }; }
    if (c.regra === "notasSeguidas") { const j = seguidas(l, min, n); return { ...base, ok: !!j, detalhe: (j || []).map(fmt), prog: [Math.min(n, melhorSeq(l, min)), n] }; }
    if (c.regra === "evolucao" || c.regra === "materiaEvolucao") { const s = subidas(l); return { ...base, ok: s.length >= n, detalhe: s.slice(0, 3), prog: [Math.min(s.length, n), n] }; }
    if (c.regra === "semVidas") { const x = l.filter(p => p.vidasPerdidas === 0); return { ...base, ok: x.length >= n, detalhe: x.slice(-n).map(p => p.titulo), prog: [Math.min(x.length, n), n] }; }
    if (c.regra === "materiasMin") { const ms = [...new Set(l.filter(p => p.nota >= min).map(p => p.materia || "Outras"))]; return { ...base, ok: ms.length >= n, detalhe: ms, prog: [Math.min(ms.length, n), n] }; }
    if (c.regra === "materiaMedia") { const media = l.length ? l.reduce((s, p) => s + p.nota, 0) / l.length : 0; return { ...base, ok: l.length >= n && media >= min, detalhe: l.map(fmt), prog: [l.length >= n ? Math.min(min, Math.round(media)) : Math.min(l.length, n), l.length >= n ? min : n] }; }
    return { ...base, ok: false, prog: [0, 1] };
  };
  const lst = listaAtiva(lista);
  const gerais = lst.filter(c => c.grupo === "geral").map(c => avaliar(c, ps));
  const porMateria = new Map();
  ps.forEach(p => { const m = p.materia || "Outras"; if (!porMateria.has(m)) porMateria.set(m, []); porMateria.get(m).push(p); });
  const materias = [...porMateria].map(([m, l]) => ({ materia: m, media: l.reduce((s, p) => s + p.nota, 0) / l.length, provas: l,
    conquistas: lst.filter(c => c.grupo === "materia").map(c => ({ ...avaliar(c, l, m), id: `${c.id}:${m}` })) })).sort((a, b) => a.materia.localeCompare(b.materia, "pt-BR"));
  return { gerais, materias };
}
