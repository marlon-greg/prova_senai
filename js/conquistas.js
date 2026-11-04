// Conquistas (gamificação) — usado pela página do aluno e, como prévia, pelo painel.
// Só coisas positivas: nada de humor, crise, faltas ou textos escritos sobre o aluno.
//
// 1) Diário (alunos com acessibilidade): a auxiliar preenche; o resumo positivo vai para acessibilidade/{email}.diarioResumo
//    (o aluno lê esse documento; o diário em si fica em acessibilidadePrivado, que ele não lê).
// 2) Notas (todos os alunos): calculadas das tentativas finalizadas do próprio aluno.

const diaSemana = iso => new Date(iso + "T12:00:00").getDay();
const isoDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// registros = documentos do diário; diasAula = [1, 3] (vazio = seg a sex)
// presença = registro completo (não justificativa) · "sem aula" não quebra a sequência
export function resumoDiario(registros, diasAula = []) {
  const dias = diasAula.length ? diasAula.map(Number) : [1, 2, 3, 4, 5];
  const presentes = new Set(registros.filter(r => r.tipo !== "justificativa").map(r => r.data));
  const semAula = new Set(registros.filter(r => r.tipo === "justificativa" && r.motivo === "semAula").map(r => r.data));
  const completos = registros.filter(r => r.tipo !== "justificativa");
  // sequência: aulas seguidas com presença, de hoje para trás (hoje sem registro ainda não quebra)
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
export function medalhasDiario(r = {}) {
  const v = k => Number(r[k] || 0);
  return [
    { e: "🌱", t: "Primeira aula registrada", d: "Sua primeira aula no diário", v: v("aulas"), meta: 1 },
    { e: "📅", t: "Presença em dia", d: "4 aulas seguidas", v: v("sequencia"), meta: 4 },
    { e: "🔥", t: "Em chamas", d: "10 aulas seguidas", v: v("sequencia"), meta: 10 },
    { e: "⭐", t: "Chuva de estrelas", d: "Junte 25 estrelas", v: v("estrelas"), meta: 25 },
    { e: "🦸", t: "Fiz sozinha!", d: "5 aulas fazendo as atividades com autonomia", v: v("autonomia"), meta: 5 },
    { e: "🎯", t: "Foco total", d: "5 aulas bem focada", v: v("foco"), meta: 5 },
    { e: "🧠", t: "Entendi tudo", d: "5 aulas entendendo bem o conteúdo", v: v("compreensao"), meta: 5 },
    { e: "📚", t: "Exploradora", d: "Trabalhe 8 tópicos diferentes", v: v("topicos"), meta: 8 },
    { e: "🏆", t: "Colecionadora de vitórias", d: "10 vitórias do dia", v: v("vitorias"), meta: 10 },
    { e: "📒", t: "Diário de ouro", d: "30 aulas registradas", v: v("aulas"), meta: 30 }
  ].map(m => ({ ...m, ok: m.v >= m.meta, prog: [Math.min(m.v, m.meta), m.meta] }));
}

// ---------- notas: todos os alunos ----------
// provas = [{ id, titulo, materia, data (ms), nota (0–100), vidasPerdidas, semVidas? }] em ordem de data
export function conquistasNotas(provas) {
  const ps = provas.filter(p => Number.isFinite(p.nota)).sort((a, b) => a.data - b.data);
  const out = [];
  const add = (e, t, d, ok, detalhe = [], prog = null) => out.push({ e, t, d, ok, detalhe, prog });
  const fmt = p => `${p.titulo}${p.materia ? ` (${p.materia})` : ""}: ${Math.round(p.nota)}`;
  // gerais
  add("🎓", "Primeira prova", "Termine a sua primeira prova", ps.length >= 1, ps.slice(0, 1).map(fmt), [Math.min(ps.length, 1), 1]);
  const trinca = (min, n) => { for (let i = 0; i + n <= ps.length; i++) { const j = ps.slice(i, i + n); if (j.every(p => p.nota >= min)) return j; } return null; };
  const melhorSeq = min => { let m = 0, c = 0; for (const p of ps) { c = p.nota >= min ? c + 1 : 0; m = Math.max(m, c); } return m; };
  const t80 = trinca(80, 3);
  add("🥇", "Trinca de ouro", "3 notas seguidas acima de 80 (qualquer matéria)", !!t80, (t80 || []).map(fmt), [Math.min(3, melhorSeq(80)), 3]);
  const t60 = trinca(60, 5);
  add("🛡", "Constância", "5 notas seguidas de 60 para cima", !!t60, (t60 || []).map(fmt), [Math.min(5, melhorSeq(60)), 5]);
  const cem = ps.filter(p => p.nota >= 100);
  add("💯", "Gabaritou!", "Tire 100 em uma prova", cem.length > 0, cem.slice(0, 3).map(fmt), [Math.min(cem.length, 1), 1]);
  let subidas = 0, melhor = [];
  for (let i = 1; i < ps.length; i++) if (ps[i].nota > ps[i - 1].nota) { subidas++; if (melhor.length < 3) melhor.push(`${fmt(ps[i - 1])} → ${Math.round(ps[i].nota)}`); }
  add("📈", "Em evolução", "Melhore a nota em relação à prova anterior 3 vezes", subidas >= 3, melhor, [Math.min(subidas, 3), 3]);
  const limpas = ps.filter(p => p.vidasPerdidas === 0);
  add("❤️", "Coração intacto", "5 provas sem perder nenhuma vida", limpas.length >= 5, limpas.slice(-5).map(p => p.titulo), [Math.min(limpas.length, 5), 5]);
  add("🏅", "Veterano", "Faça 10 provas", ps.length >= 10, [], [Math.min(ps.length, 10), 10]);
  // por matéria
  const porMateria = new Map();
  ps.forEach(p => { const m = p.materia || "Outras"; if (!porMateria.has(m)) porMateria.set(m, []); porMateria.get(m).push(p); });
  const materias = [...porMateria].map(([m, l]) => {
    const media = l.reduce((s, p) => s + p.nota, 0) / l.length;
    const cs = [];
    const c = (e, t, d, ok, detalhe = [], prog = null) => cs.push({ e, t, d, ok, detalhe, prog });
    c("⭐", `Mandou bem em ${m}`, "Uma nota de 80 para cima nesta matéria", l.some(p => p.nota >= 80), l.filter(p => p.nota >= 80).slice(0, 3).map(fmt), [Math.min(1, l.filter(p => p.nota >= 80).length), 1]);
    c("🧩", `Mestre em ${m}`, "Média de 80 para cima com pelo menos 2 provas", l.length >= 2 && media >= 80, l.map(fmt), [l.length >= 2 ? Math.min(80, Math.round(media)) : 0, 80]);
    let sub = 0; for (let i = 1; i < l.length; i++) if (l[i].nota > l[i - 1].nota) sub++;
    c("🚀", `Decolando em ${m}`, "Melhore a nota nesta matéria 2 vezes", sub >= 2, [], [Math.min(sub, 2), 2]);
    return { materia: m, media, provas: l, conquistas: cs };
  }).sort((a, b) => a.materia.localeCompare(b.materia, "pt-BR"));
  return { gerais: out, materias };
}
