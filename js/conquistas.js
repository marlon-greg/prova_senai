// Conquistas (gamificação) — usado pela página do aluno e, como prévia, pelo painel.
// Só coisas positivas: nada de humor, crise, faltas ou textos escritos sobre o aluno.
//
// As conquistas são REGRAS configuráveis (config/conquistas.lista; sem ela vale CONQUISTAS_PADRAO).
// Cada uma: { id, e (emoji), t (título), d (descrição), grupo: "geral" | "materia" | "diario", regra, campo, ativa, niveis: [{ n, min, nome }], materia? }
// niveis vão do mais fácil ao mais difícil; sem niveis (listas antigas) vale { n, min } da raiz como um nível só. materia = vale só nessa matéria.
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
  { id: "provas-feitas", e: "🎓", t: "Provas feitas", d: "Termine provas", grupo: "geral", regra: "provas", niveis: [{ n: 1, nome: "Estreante" }, { n: 2, nome: "Em ritmo" }, { n: 3, nome: "Veterano" }, { n: 4, nome: "Maratonista" }] },
  { id: "sequencia", e: "🏆", t: "Sequência", d: "Notas seguidas acima do mínimo (qualquer matéria)", grupo: "geral", regra: "notasSeguidas", niveis: [{ n: 2, min: 60, nome: "Aquecendo" }, { n: 3, min: 80, nome: "Trinca de ouro" }, { n: 4, min: 80, nome: "Constância" }] },
  { id: "gabaritou", e: "💯", t: "Gabaritou!", d: "Uma nota alta em uma prova", grupo: "geral", regra: "nota", niveis: [{ min: 60, nome: "Bom de prova" }, { min: 80, nome: "Mandou muito" }, { min: 100, nome: "Gabaritou!" }] },
  { id: "em-evolucao", e: "📈", t: "Em evolução", d: "Melhore a nota em relação à prova anterior", grupo: "geral", regra: "evolucao", niveis: [{ n: 1, nome: "Subindo" }, { n: 2, nome: "Em evolução" }, { n: 3, nome: "Sempre melhor" }] },
  { id: "coracao-intacto", e: "❤️", t: "Coração intacto", d: "Provas sem perder nenhuma vida", grupo: "geral", regra: "semVidas", niveis: [{ n: 1, nome: "Atento" }, { n: 2, nome: "Concentrado" }, { n: 3, nome: "Focado" }, { n: 4, nome: "Coração intacto" }] },
  { id: "mestre", e: "🧩", t: "Mestre de {materia}", d: "Média alta nesta matéria ao longo do semestre", grupo: "materia", regra: "materiaMedia", niveis: [{ n: 2, min: 70, nome: "Aprendiz de {materia}" }, { n: 3, min: 80, nome: "Praticante de {materia}" }, { n: 4, min: 85, nome: "Mestre de {materia}" }] },
  { id: "mandou-bem", e: "⭐", t: "Mandou bem em {materia}", d: "Uma nota alta nesta matéria", grupo: "materia", regra: "materiaNota", niveis: [{ min: 60, nome: "Bom em {materia}" }, { min: 80, nome: "Mandou bem em {materia}" }, { min: 100, nome: "Gabaritou {materia}" }] },
  { id: "decolando", e: "🚀", t: "Decolando em {materia}", d: "Melhore a nota nesta matéria", grupo: "materia", regra: "materiaEvolucao", niveis: [{ n: 1, nome: "Decolando em {materia}" }, { n: 2, nome: "Voando em {materia}" }, { n: 3, nome: "Nas alturas em {materia}" }] },
  { id: "primeira-aula", e: "🌱", t: "Primeira aula registrada", d: "Sua primeira aula no diário", grupo: "diario", regra: "diario", campo: "aulas", n: 1 },
  { id: "presenca", e: "🔥", t: "Presença", d: "Aulas seguidas com presença", grupo: "diario", regra: "diario", campo: "sequencia", niveis: [{ n: 5, nome: "Presente" }, { n: 10, nome: "Em chamas" }, { n: 15, nome: "Inabalável" }, { n: 30, nome: "Lenda da sala" }] },
  { id: "chuva-de-estrelas", e: "⭐", t: "Chuva de estrelas", d: "Junte 25 estrelas", grupo: "diario", regra: "diario", campo: "estrelas", n: 25 },
  { id: "fiz-sozinha", e: "🦸", t: "Fiz sozinha!", d: "5 aulas fazendo as atividades com autonomia", grupo: "diario", regra: "diario", campo: "autonomia", n: 5 },
  { id: "foco-total", e: "🎯", t: "Foco total", d: "5 aulas bem focada", grupo: "diario", regra: "diario", campo: "foco", n: 5 },
  { id: "entendi-tudo", e: "🧠", t: "Entendi tudo", d: "5 aulas entendendo bem o conteúdo", grupo: "diario", regra: "diario", campo: "compreensao", n: 5 },
  { id: "exploradora", e: "📚", t: "Exploradora", d: "Trabalhe 8 tópicos diferentes", grupo: "diario", regra: "diario", campo: "topicos", n: 8 },
  { id: "colecionadora", e: "🏆", t: "Colecionadora de vitórias", d: "10 vitórias do dia", grupo: "diario", regra: "diario", campo: "vitorias", n: 10 },
  { id: "diario-de-ouro", e: "📒", t: "Diário de ouro", d: "30 aulas registradas", grupo: "diario", regra: "diario", campo: "aulas", n: 30 }
];
// ids antigos que viraram um nível de uma conquista nova: as skins travadas por eles continuam valendo
export const ALIASES = { "primeira-prova": { id: "provas-feitas", nivel: 1 }, veterano: { id: "provas-feitas", nivel: 3 }, "trinca-de-ouro": { id: "sequencia", nivel: 2 }, constancia: { id: "sequencia", nivel: 3 },
  "presenca-em-dia": { id: "presenca", nivel: 1 }, "em-chamas": { id: "presenca", nivel: 2 } };
// sem niveis: a conquista antiga vira um nível só, com o próprio título
export const niveisDe = c => Array.isArray(c.niveis) && c.niveis.length ? c.niveis : [{ ...(c.n !== undefined ? { n: c.n } : {}), ...(c.min !== undefined ? { min: c.min } : {}), nome: c.t }];
export const normalizarConquista = c => ({ ...c, niveis: niveisDe(c).map(x => ({ ...x })) });
// ganhas = conquistas ganhas (a trava por medalha usa o id da conquista e, se pedir, o nível mínimo)
export function temMedalha(ganhas, medalha, nivelMin = 1) {
  const testar = (id, nec) => ganhas.some(g => (g.id === id || String(g.id || "").startsWith(id + ":")) && (g.nivelAtual === undefined || g.nivelAtual + 1 >= Math.min(nec, g.niveisTotal || nec)));
  const a = ALIASES[medalha];
  return testar(medalha, nivelMin) || (!!a && testar(a.id, Math.max(a.nivel, nivelMin)));
}
// quantos níveis o aluno já subiu no total: é o que conta para as travas "N conquistas" e para o nível do perfil
export const pontosConquistas = ganhas => ganhas.reduce((s, g) => s + (g.nivelAtual === undefined ? 1 : g.nivelAtual + 1), 0);
export function nomeMedalha(id, nivel = 1) {
  const a = ALIASES[id], c = CONQUISTAS_PADRAO.find(x => x.id === (a?.id || id));
  if (!c) return id;
  const n = Math.max(a?.nivel || 1, nivel);
  return niveisDe(c)[Math.min(n, niveisDe(c).length) - 1]?.nome || c.t;
}
// a medalha na tela (aluno e prévia do diário). Com i, vira botão que abre o detalhe.
const escM = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function medalhaHTML(m, { i = null, nova = false } = {}) {
  const tag = i === null ? "div" : "button", nome = m.nivelNome || m.t, p = m.prog || [0, 1];
  return `<${tag}${i === null ? "" : ` type="button" data-m="${i}"`} class="medalha-n${m.ok ? " ganha" : ""}${m.maximo ? " maximo" : ""}${nova ? " nova" : ""}" title="${escM(m.d || m.t)}">
    <span class="mn-disco e" aria-hidden="true">${m.e}</span><b>${escM(nome)}</b>${m.nivelNome && m.nivelNome !== m.t ? `<span class="mn-tit">${escM(m.t)}</span>` : `<span class="mn-tit">${m.ok ? "conquistada" : escM(m.d || "")}</span>`}
    ${m.maximo ? `<span class="chip ok">nível máximo</span>` : `<span class="barra-fina"><i style="width:${Math.round(p[0] / Math.max(1, p[1]) * 100)}%"></i></span><small>${p[0]}/${p[1]} para <b>${escM(m.proximo?.nome || nome)}</b></small>`}</${tag}>`;
}
// lista válida (config do admin ou o padrão); só as ativas
export function listaAtiva(cfg) {
  const l = Array.isArray(cfg) && cfg.length ? cfg : CONQUISTAS_PADRAO;
  return l.filter(c => c && c.ativa !== false && REGRAS[c.regra] && c.id && c.t).map(normalizarConquista);
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
    const v = Number(r[c.campo] || 0), ns = c.niveis;
    let a = -1; ns.forEach((x, i) => { if (v >= Number(x.n || 1)) a = i; });
    const prox = ns[a + 1] || null, meta = Number((prox || ns[ns.length - 1]).n || 1);
    return { ...c, v, meta, ok: a >= 0, prog: [Math.min(v, meta), meta], nivelAtual: a, nivelNome: a >= 0 ? ns[a].nome : null, proximo: prox, maximo: a === ns.length - 1, niveisTotal: ns.length };
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
  // cada nível é avaliado pela mesma regra; o maior atingido vence
  const avaliarNiveis = (c, l, materia = null) => {
    const ns = c.niveis, nomeNv = x => x ? { ...x, nome: String(x.nome || "").replaceAll("{materia}", materia || "") } : null;
    const rs = ns.map(x => avaliar({ ...c, n: x.n, min: x.min }, l, materia));
    let a = -1; rs.forEach((r, i) => { if (r.ok) a = i; });
    const ref = rs[Math.min(a + 1, ns.length - 1)];
    return { ...ref, ok: a >= 0, detalhe: a >= 0 ? rs[a].detalhe : ref.detalhe, nivelAtual: a, nivelNome: a >= 0 ? nomeNv(ns[a]).nome : null, proximo: nomeNv(ns[a + 1]), maximo: a === ns.length - 1, niveisTotal: ns.length };
  };
  const lst = listaAtiva(lista);
  // conquista com matéria definida vale só nela (as geradas do plano de ensino)
  const daMateria = (c, m) => !c.materia || String(c.materia).toLowerCase() === String(m).toLowerCase();
  const gerais = lst.filter(c => c.grupo === "geral").map(c => avaliarNiveis(c, c.materia ? ps.filter(p => daMateria(c, p.materia || "Outras")) : ps));
  const porMateria = new Map();
  ps.forEach(p => { const m = p.materia || "Outras"; if (!porMateria.has(m)) porMateria.set(m, []); porMateria.get(m).push(p); });
  const materias = [...porMateria].map(([m, l]) => ({ materia: m, media: l.reduce((s, p) => s + p.nota, 0) / l.length, provas: l,
    conquistas: lst.filter(c => c.grupo === "materia" && daMateria(c, m)).map(c => ({ ...avaliarNiveis(c, l, m), id: `${c.id}:${m}` })) })).sort((a, b) => a.materia.localeCompare(b.materia, "pt-BR"));
  return { gerais, materias };
}
