// Painel → aba "Relatórios": notas por aluno, matéria e turma, alerta de reprovação (média < 50, peso igual por prova)
// e desempenho por tópico (o "tema" das questões). desempenhoPorTopico() é a conta que a autoavaliação vai usar (docs/INTEGRACOES.md).
import { db, esc, $, toast, traduzirErro, corrigir, bancosDaProva, temaDe, semestreDaProva, materiaDaProva, rotuloSemestre, chaveTexto } from "./common.js?v=20261113a";
import { graficoLinhas, ligarGraficos } from "./graficos.js";
import { imprimir } from "./admin-relatorio-aluno.js";
import { pl, ajudaHTML, vazio } from "./ui.js";
import { ic } from "./icones.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { situacaoCriterio, SITUACOES } from "./evidencias.js";
import { criteriosDaUnidade, codigoCriterio, CRITERIOS } from "./plano-ensino.js?v=20261113a";
import { PLANO_CURSO } from "./plano-curso.js?v=20261113a";

export const MEDIA_MINIMA = 50;
let ctx = null, base = null, compBase = null;

// toggle Notas ↔ Comparativo
function ligarToggle() {
  const btnN = $("#vistaNotas"), btnC = $("#vistaComp");
  const pN = $("#painelNotas"), pC = $("#painelComp");
  btnN.onclick = () => { btnN.classList.add("ativo"); btnC.classList.remove("ativo"); pN.classList.remove("oculto"); pC.classList.add("oculto"); };
  btnC.onclick = () => { btnC.classList.add("ativo"); btnN.classList.remove("ativo"); pC.classList.remove("oculto"); pN.classList.add("oculto"); carregarComparativo(); };
}

export function iniciarRelatorios(c) {
  ctx = c;
  ligarToggle();
  ["#rlTurma", "#rlSemestre", "#rlMateria", "#rlBusca"].forEach(id => $(id).addEventListener(id === "#rlBusca" ? "input" : "change", desenhar));
  $("#rlTopicos").onclick = calcularTopicos;
  $("#rlCSV").onclick = csv;
  // filtros comparativo
  $("#compTurma").onchange = () => { compBase = null; carregarComparativo(); };
  $("#compUnidade").onchange = () => { compBase = null; carregarComparativo(); };
  $("#rlPDF").onclick = () => {
    const filtros = [["#rlTurma", "turma"], ["#rlSemestre", "semestre"], ["#rlMateria", "matéria"]].map(([id, r]) => $(id).value ? `${r}: ${$(id).selectedOptions[0].textContent}` : "").filter(Boolean).join(" · ") || "todas as turmas, semestres e matérias";
    imprimir("Relatório de notas", `<header class="cab"><div class="marca">SENAI</div><div><h1>Relatório de notas</h1><div class="sub">${esc(filtros)} · emitido em ${new Date().toLocaleDateString("pt-BR")} · média mínima ${MEDIA_MINIMA}</div></div></header>${conteudoPDF()}
      <div style="display:flex;justify-content:space-around;margin-top:40px;text-align:center"><div style="border-top:1px solid #000;width:40%;padding-top:4px">Professor(a)</div><div style="border-top:1px solid #000;width:40%;padding-top:4px">Coordenação</div></div>`);
  };
}
const nota = t => Number.isFinite(Number(t.nota)) && t.nota !== null ? Number(t.nota) : (Number.isFinite(Number(t.notaPrevia)) && t.notaPrevia !== null ? Number(t.notaPrevia) : null);
const cor = n => n === null ? "" : n < MEDIA_MINIMA ? "rl-ruim" : n < 70 ? "rl-medio" : "rl-bom";
const fmt = n => n === null || n === undefined ? "—" : (Math.round(n * 10) / 10).toLocaleString("pt-BR");
const media = l => l.length ? l.reduce((s, x) => s + x, 0) / l.length : null;

export async function carregarRelatorios() {
  $("#rlConteudo").innerHTML = `<p class="pequeno">Carregando notas…</p>`;
  try {
    const [ps, ts, tn, bs] = await Promise.all([getDocs(collection(db, "provas")), ctx.listarTurmas(), getDocs(collection(db, "tentativas")), ctx.listarBancos()]);
    const provas = Object.fromEntries(ps.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
    const linhas = tn.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.teste !== true && t.finalizadaEm && provas[t.provaId] && nota(t) !== null).map(t => {
      const p = provas[t.provaId];
      return { t, p, email: String(t.email || "").toLowerCase(), nome: t.nome || t.email, nota: nota(t), turmaId: p.turmaId || "", semestre: semestreDaProva(p), materia: materiaDaProva(p, bs) || "Sem matéria" };
    });
    base = { provas, turmas: ts, linhas, topicos: null };
  } catch (e) { $("#rlConteudo").innerHTML = `<p class="erro-texto">${esc(traduzirErro(e))}</p>`; return; }
  const sel = (el, primeira, vals) => { const a = el.value; el.innerHTML = `<option value="">${primeira}</option>` + vals.map(([v, r]) => `<option value="${esc(v)}">${esc(r)}</option>`).join(""); el.value = vals.some(([v]) => v === a) ? a : ""; };
  sel($("#rlTurma"), "👥 Todas as turmas", base.turmas.filter(t => base.linhas.some(l => l.turmaId === t.id)).map(t => [t.id, t.nome]));
  sel($("#rlSemestre"), "📅 Todos os semestres", [...new Set(base.linhas.map(l => l.semestre))].sort().reverse().map(s => [s, rotuloSemestre(s)]));
  sel($("#rlMateria"), "📚 Todas as matérias", [...new Set(base.linhas.map(l => l.materia))].sort((a, b) => a.localeCompare(b, "pt-BR")).map(m => [m, m]));
  // popula selects do comparativo com as mesmas turmas
  const unidades = Object.keys(CRITERIOS).map(uid => { const u = PLANO_CURSO.unidades.find(x => x.id === uid); return [uid, u?.nome || uid]; });
  sel($("#compTurma"), "👥 Selecione uma turma", base.turmas.map(t => [t.id, t.nome]));
  sel($("#compUnidade"), "📚 Selecione uma unidade", unidades);
  desenhar();
}
function filtradas() {
  const fT = $("#rlTurma").value, fS = $("#rlSemestre").value, fM = $("#rlMateria").value, b = chaveTexto($("#rlBusca").value);
  return base.linhas.filter(l => (!fT || l.turmaId === fT) && (!fS || l.semestre === fS) && (!fM || l.materia === fM) && (!b || chaveTexto(`${l.nome} ${l.email}`).includes(b)));
}
// aluno -> matéria -> [notas]
function agrupar(ls) {
  const al = new Map();
  for (const l of ls) {
    if (!al.has(l.email)) al.set(l.email, { email: l.email, nome: l.nome, turmaId: l.turmaId, materias: new Map() });
    const a = al.get(l.email); if (!a.materias.has(l.materia)) a.materias.set(l.materia, []); a.materias.get(l.materia).push(l);
  }
  return [...al.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}
// o que as telas e o PDF usam
function dados() {
  const ls = filtradas(), alunos = agrupar(ls), materias = [...new Set(ls.map(l => l.materia))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const risco = alunos.flatMap(a => [...a.materias].map(([m, l]) => ({ a, m, l, med: media(l.map(x => x.nota)) })).filter(x => x.med < MEDIA_MINIMA)).sort((x, y) => x.med - y.med);
  const porTurma = new Map(); ls.forEach(l => { const k = l.turmaId; if (!porTurma.has(k)) porTurma.set(k, new Map()); const m = porTurma.get(k); if (!m.has(l.materia)) m.set(l.materia, []); m.get(l.materia).push(l.nota); });
  return { ls, alunos, materias, risco, porTurma, nomeTurma: id => base.turmas.find(t => t.id === id)?.nome || "—" };
}
const precisa = r => MEDIA_MINIMA * (r.l.length + 1) - r.l.reduce((s, x) => s + x.nota, 0);
const iniciaisDe = n => String(n || "?").trim().split(/\s+/).filter(Boolean).map((p, i, a) => i === 0 || i === a.length - 1 ? p[0] : "").join("").slice(0, 2).toUpperCase();
function porTurmaHTML({ porTurma, nomeTurma }) {
  return [...porTurma].map(([t, ms]) => `<div class="rl-turma"><b>${esc(nomeTurma(t))}</b> ${[...ms].map(([m, l]) => `<span class="chip ${media(l) < MEDIA_MINIMA ? "err" : media(l) < 70 ? "warn" : "ok"}">${esc(m)}: ${fmt(media(l))} · ${pl(l.length, "nota")}</span>`).join("")}</div>`).join("") || `<p class="help">Sem notas com esses filtros.</p>`;
}
// tendência: da primeira para a última prova da matéria
function tendencia(notas, med) {
  if (med < MEDIA_MINIMA) return `<span class="chip warn">em risco</span>`;
  if (notas.length < 2) return `<span class="meta-txt" title="Precisa de 2 provas ou mais">—</span>`;
  const d = notas.at(-1) - notas[0];
  return d > 0 ? `<span class="rl-tend sobe" title="Subiu ${fmt(d)} pontos da primeira para a última prova" role="img" aria-label="Subindo">${ic("relatorios")}</span>`
    : `<span class="rl-tend ${d < 0 ? "desce" : "igual"}" title="${d < 0 ? `Caiu ${fmt(-d)} pontos da primeira para a última prova` : "Sem mudança da primeira para a última prova"}" role="img" aria-label="${d < 0 ? "Caindo" : "Estável"}">${ic("relatorios")}</span>`;
}
function desenhar() {
  if (!base) return;
  const d = dados(), { ls, alunos, risco } = d, geral = media(ls.map(l => l.nota));
  const nRisco = new Set(risco.map(r => r.a.email)).size;
  // uma linha por aluno e matéria
  const totalProvas = (m, turmaId) => new Set(ls.filter(x => x.materia === m && x.turmaId === turmaId).map(x => x.p.id)).size;
  const linhasMedia = alunos.flatMap(a => [...a.materias].map(([m, l]) => {
    const ord = [...l].sort((x, y) => (x.t.finalizadaEm?.seconds || 0) - (y.t.finalizadaEm?.seconds || 0)), med = media(l.map(x => x.nota));
    return `<tr><td><b class="rl-nome">${esc(a.nome)}</b>${d.materias.length > 1 ? `<span class="rl-sub">${esc(m)}</span>` : ""}</td><td class="meta-txt">${l.length} de ${totalProvas(m, a.turmaId)}</td>
      <td title="${esc(ord.map(x => `${x.p.titulo}: ${fmt(x.nota)}`).join(" · "))}"><span class="rl-media"><span class="rl-barra"><i class="${cor(med)}" style="width:${Math.max(0, Math.min(100, Math.round(med)))}%"></i></span><b class="${cor(med)}">${fmt(med)}</b></span></td><td>${tendencia(ord.map(x => x.nota), med)}</td></tr>`;
  })).join("");
  $("#rlConteudo").innerHTML = `
  <div class="kpis">
    <div class="kpi"><b>${alunos.length}</b><span>alunos com nota</span></div>
    <div class="kpi"><b>${new Set(ls.map(l => l.p.id)).size}</b><span>provas finalizadas</span></div>
    <div class="kpi"><b>${fmt(geral)}</b><span>média geral</span></div>
    <div class="kpi ${nRisco ? "warn" : ""}"><b>${nRisco}</b><span>em risco · média &lt; ${MEDIA_MINIMA}</span></div></div>
  <section class="card"><div class="rl-cab"><span class="e" aria-hidden="true">⚠️</span><h3>Risco de reprovação</h3>${ajudaHTML(`<p>Média das provas da matéria abaixo de ${MEDIA_MINIMA}; cada prova vale o mesmo. "Precisa de" é a nota que o aluno tem de tirar numa próxima prova da matéria para a média chegar a ${MEDIA_MINIMA}.</p>`, { titulo: "Como é calculado o risco" })}${risco.length ? `<span class="chip warn">${pl(nRisco, "aluno")}</span>` : ""}</div>
    ${risco.length ? `<div class="rl-risco">${risco.map(r => { const prec = precisa(r);
      return `<article class="rl-risco-item" title="${esc(r.l.map(x => `${x.p.titulo}: ${fmt(x.nota)}`).join(" · "))}"><span class="avatar-p">${esc(iniciaisDe(r.a.nome))}</span><div><b>${esc(r.a.nome)}</b><span>${esc(r.m)} · média ${fmt(r.med)}</span><span>${prec > 100 ? "só com recuperação" : `precisa de ${fmt(Math.max(0, prec))} na próxima`}</span></div></article>`; }).join("")}</div>`
      : `<p class="rl-ok">${ic("check")}Ninguém abaixo de ${MEDIA_MINIMA} com esses filtros.</p>`}</section>
  <section class="card"><div class="rl-cab"><h3>Médias por aluno e matéria</h3></div>
    ${alunos.length ? `<div class="tabela sem-borda rl-tabela"><table class="rl-tab"><thead><tr><th>Aluno</th><th>Provas</th><th>Média</th><th>Tendência</th></tr></thead><tbody>${linhasMedia}</tbody></table></div>`
      : vazio({ e: "📊", texto: "Nenhuma prova finalizada com esses filtros." })}</section>
  <section class="card">${evolucaoHTML(ls)}</section>
  <section class="card"><div class="rl-cab"><h3>Por turma e matéria</h3></div>${porTurmaHTML(d)}</section>
  <section class="card" id="rlTopicosBox"><div class="rl-cab"><h3>Desempenho por tópico</h3></div>${base.topicos ? topicosHTML() : `<p class="help">Clique em <b>Calcular por tópico</b> (lê as respostas das provas filtradas; pode levar alguns segundos).</p>`}</section>`;
  ligarGraficos($("#rlConteudo"));
}
// PDF formal: tabelas completas, com as notas de cada prova e a matriz aluno × matéria
function conteudoPDF() {
  const d = dados(), { ls, alunos, materias, risco, nomeTurma } = d;
  return `<h2>Risco de reprovação</h2><p class="pequeno">Média das provas da matéria abaixo de ${MEDIA_MINIMA} (cada prova vale o mesmo).</p>
    ${risco.length ? `<div class="tabela"><table><tr><th>Aluno</th><th>Turma</th><th>Matéria</th><th>Média</th><th>Notas</th><th>Precisa na próxima*</th></tr>${risco.map(r => { const prec = precisa(r);
      return `<tr><td><b>${esc(r.a.nome)}</b><br><span class="pequeno">${esc(r.a.email)}</span></td><td>${esc(nomeTurma(r.a.turmaId))}</td><td>${esc(r.m)}</td><td><b>${fmt(r.med)}</b></td>
        <td class="pequeno">${r.l.map(x => `${esc(x.p.titulo)}: <b>${fmt(x.nota)}</b>`).join("<br>")}</td><td>${prec > 100 ? "mais de 100 (só com recuperação)" : `<b>${fmt(Math.max(0, prec))}</b>`}</td></tr>`; }).join("")}</table></div>
      <p class="pequeno">* Nota que o aluno precisa tirar numa próxima prova da matéria para a média chegar a ${MEDIA_MINIMA}.</p>` : `<p class="pequeno">Ninguém abaixo de ${MEDIA_MINIMA} com esses filtros.</p>`}
    <h2>Médias por aluno e matéria</h2>
    ${alunos.length ? `<div class="tabela"><table><tr><th>Aluno</th>${materias.map(m => `<th>${esc(m)}</th>`).join("")}<th>Geral</th></tr>${alunos.map(a => {
      const todas = [...a.materias.values()].flat().map(x => x.nota);
      return `<tr><td><b>${esc(a.nome)}</b><br><span class="pequeno">${esc(nomeTurma(a.turmaId))}</span></td>${materias.map(m => { const l = a.materias.get(m); return `<td>${fmt(l ? media(l.map(x => x.nota)) : null)}${l ? ` <span class="pequeno">(${l.length})</span>` : ""}</td>`; }).join("")}<td><b>${fmt(media(todas))}</b></td></tr>`; }).join("")}</table></div>` : `<p class="pequeno">Nenhuma prova finalizada com esses filtros.</p>`}
    <h2>Por turma e matéria</h2>${porTurmaHTML(d)}
    ${base.topicos ? `<h2>Desempenho por tópico</h2>${topicosHTML()}` : ""}`;
}

// média da turma em cada prova, em ordem de data (uma série por matéria, até 4; mais que isso: filtre a matéria)
function evolucaoHTML(ls) {
  const provas = new Map(); ls.forEach(l => { if (!provas.has(l.p.id)) provas.set(l.p.id, { p: l.p, materia: l.materia, notas: [], data: l.t.finalizadaEm?.seconds || 0 }); const x = provas.get(l.p.id); x.notas.push(l.nota); x.data = Math.max(x.data, l.t.finalizadaEm?.seconds || 0); });
  const lista = [...provas.values()].sort((a, b) => a.data - b.data);
  if (lista.length < 2) return `<div class="rl-cab"><h3>Evolução</h3></div><p class="help">Com 2 provas ou mais no filtro aparece o gráfico de evolução.</p>`;
  const materias = [...new Set(lista.map(x => x.materia))];
  if (materias.length > 4) return `<div class="rl-cab"><h3>Evolução</h3></div><p class="help">São ${materias.length} matérias: escolha uma matéria (ou turma) no filtro para ver o gráfico de evolução.</p>`;
  return graficoLinhas({ titulo: "Média da turma em cada prova (0 a 100)", rotulos: lista.map(x => x.p.titulo.slice(0, 14)),
    series: materias.map(m => ({ nome: m, valores: lista.map(x => x.materia === m ? media(x.notas) : null) })), y: { min: 0, max: 100, passo: 25 }, ref: { valor: MEDIA_MINIMA, rotulo: `mínimo ${MEDIA_MINIMA}` } });
}
// ---------- desempenho por tópico (reaproveitável: docs/INTEGRACOES.md) ----------
// tentativas = [{ t, p }] -> Map(email -> Map(tópico -> { pts, max, n, materia }))
export async function desempenhoPorTopico(itens, progresso = () => {}) {
  const bancos = {}, out = new Map();
  const lerBanco = async b => bancos[b] ??= await (async () => {
    const [qs, gs] = await Promise.all([getDocs(collection(db, "bancos", b, "questoes")), getDocs(collection(db, "bancos", b, "gabaritos"))]);
    return { q: Object.fromEntries(qs.docs.map(d => [d.id, { id: d.id, ...d.data() }])), g: Object.fromEntries(gs.docs.map(d => [d.id, d.data()])) };
  })();
  let k = 0;
  for (const { t, p, materia } of itens) {
    progresso(++k, itens.length);
    const [rs, cs] = await Promise.all([getDocs(collection(db, "tentativas", t.id, "respostas")), getDocs(collection(db, "tentativas", t.id, "correcoes"))]);
    const resp = Object.fromEntries(rs.docs.map(d => [d.id, d.data()])), corr = Object.fromEntries(cs.docs.map(d => [d.id, d.data()]));
    for (const qid of t.questoesIds || []) {
      const bId = qid.lastIndexOf("_q") > 0 ? qid.slice(0, qid.lastIndexOf("_q")) : (t.bancoId || bancosDaProva(p)[0]);
      const b = await lerBanco(bId).catch(() => null), q = b?.q[qid]; if (!q) continue;
      const peso = Number(q.peso || 1), r = resp[qid];
      let pts = corr[qid]?.pontos !== undefined ? Number(corr[qid].pontos) : corrigir(q, b.g[qid] || {}, r?.resposta, r?.perdida === true).pontos;
      const email = String(t.email || "").toLowerCase(), tema = temaDe(q);
      if (!out.has(email)) out.set(email, new Map());
      const m = out.get(email); if (!m.has(tema)) m.set(tema, { pts: 0, max: 0, n: 0, materia });
      const x = m.get(tema); x.pts += pts; x.max += peso; x.n++;
    }
  }
  return out;
}
async function calcularTopicos() {
  if (!base) return;
  const ls = filtradas();
  if (!ls.length) return toast("Nenhuma prova com esses filtros.", "erro");
  const box = $("#rlTopicosBox");
  try {
    base.topicos = { porAluno: await desempenhoPorTopico(ls.map(l => ({ t: l.t, p: l.p, materia: l.materia })), (i, n) => { if (box) box.innerHTML = `<div class="rl-cab"><h3>Desempenho por tópico</h3></div><p class="help">Lendo as respostas… ${i} de ${n} provas</p>`; }), nomes: Object.fromEntries(ls.map(l => [l.email, l.nome])) };
  } catch (e) { toast(traduzirErro(e), "erro"); }
  desenhar();
}
function topicosHTML() {
  const { porAluno, nomes } = base.topicos, turma = new Map();
  for (const [, m] of porAluno) for (const [tema, x] of m) { if (!turma.has(tema)) turma.set(tema, { pts: 0, max: 0, n: 0, materia: x.materia, alunos: 0 }); const y = turma.get(tema); y.pts += x.pts; y.max += x.max; y.n += x.n; y.alunos++; }
  const pct = x => x.max ? x.pts / x.max * 100 : null;
  const tops = [...turma].sort((a, b) => pct(a[1]) - pct(b[1]));
  return `<p class="pequeno">Acerto nas questões de cada tópico (inclui pontos parciais e correções). Os tópicos com menor acerto são os candidatos a <b>reforço</b>.</p>
    <div class="rl-topicos">${tops.map(([t, x]) => `<div class="rl-top"><div class="rl-top-cab"><b>${esc(t)}</b> <span class="pequeno">${esc(x.materia)} · ${x.n} respostas de ${x.alunos} aluno(s)</span><b class="${cor(pct(x))}">${fmt(pct(x))}%</b></div>
      <div class="rl-barra"><i class="${cor(pct(x))}" style="width:${Math.round(pct(x) || 0)}%"></i></div></div>`).join("")}</div>
    <details style="margin-top:12px"><summary><b>Por aluno</b> (os 3 tópicos com menor acerto de cada um)</summary><ul>${[...porAluno].map(([e, m]) => `<li><b>${esc(nomes[e] || e)}</b>: ${[...m].sort((a, b) => pct(a[1]) - pct(b[1])).slice(0, 3).map(([t, x]) => `${esc(t)} <span class="${cor(pct(x))}">${fmt(pct(x))}%</span>`).join(" · ")}</li>`).join("")}</ul></details>`;
}
// ---------- comparativo diagnóstico (5.3) ----------
const ICONE_SIT = { dominio:"✓", ilusao:"!", subconfianca:"↑", dificuldade:"✗", semAula:"—", ausente:"○", semDeclaracao:"?", pendente:"·" };

async function carregarComparativo() {
  const turmaId = $("#compTurma").value, unidadeId = $("#compUnidade").value;
  const box = $("#rlCompConteudo");
  if (!turmaId || !unidadeId) { box.innerHTML = `<p class="help">Selecione uma turma e uma unidade.</p>`; return; }
  if (compBase?.turmaId === turmaId && compBase?.unidadeId === unidadeId) { desenharComparativo(); return; }
  box.innerHTML = `<p class="pequeno">Carregando evidências…</p>`;
  try {
    const snap = await getDocs(query(collection(db, "evidencias"), where("turmaId", "==", turmaId)));
    const evs = snap.docs.map(d => d.data()).filter(e => e.unidade === unidadeId);
    // agrupa por email
    const porAluno = new Map();
    for (const ev of evs) {
      const k = String(ev.email || "").toLowerCase();
      if (!porAluno.has(k)) porAluno.set(k, { nome: ev.aluno || ev.email || k, evs: [] });
      porAluno.get(k).evs.push(ev);
    }
    // adiciona alunos da turma que não têm nenhuma evidência (aparecem como "pendente")
    if (base) for (const t of base.turmas.filter(t => t.id === turmaId)) for (const al of (t.alunos || [])) {
      const k = String(al.email || "").toLowerCase(); if (!k) continue;
      if (!porAluno.has(k)) porAluno.set(k, { nome: al.nome || k, evs: [] });
    }
    compBase = { turmaId, unidadeId, porAluno };
  } catch (e) { box.innerHTML = `<p class="erro-texto">${esc(traduzirErro(e))}</p>`; return; }
  desenharComparativo();
}

function desenharComparativo() {
  const box = $("#rlCompConteudo");
  if (!compBase) return;
  const { porAluno, unidadeId } = compBase;
  const criterios = criteriosDaUnidade(unidadeId);
  if (!criterios.length) { box.innerHTML = `<p class="help">Nenhum critério definido para esta unidade.</p>`; return; }
  const alunos = [...porAluno.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  // cabeçalho da tabela
  const thCrits = criterios.map(c => `<th title="${esc(c[2])}">${esc(codigoCriterio(c[0]))}</th>`).join("");
  // linhas por aluno
  const linhas = alunos.map(({ nome, evs }) => {
    const tds = criterios.map(c => {
      const r = situacaoCriterio(evs, c[0]);
      return `<td><span class="sit sit-${r.situacao}" title="${esc(SITUACOES[r.situacao]?.nome || r.situacao)}">${ICONE_SIT[r.situacao] || "·"}</span></td>`;
    }).join("");
    return `<tr><td><b>${esc(nome)}</b></td>${tds}</tr>`;
  }).join("");
  // legenda
  const legenda = Object.entries(SITUACOES).map(([k, v]) =>
    `<span class="sit sit-${k}" title="${esc(v.acao)}">${ICONE_SIT[k]} ${esc(v.nome)}</span>`
  ).join("");
  box.innerHTML = `
    <section class="card">
      <div class="rl-cab"><h3>Comparativo: aulas × autoavaliação × prova</h3></div>
      <div class="comp-wrap">
        <table class="comp-tab">
          <thead><tr><th>Aluno</th>${thCrits}</tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
      <div class="comp-legenda">${legenda}</div>
    </section>`;
}

function csv() {
  if (!base) return;
  const ls = filtradas(), nomeTurma = id => base.turmas.find(t => t.id === id)?.nome || "";
  const linhas = [["aluno", "email", "turma", "semestre", "materia", "prova", "nota"], ...ls.map(l => [l.nome, l.email, nomeTurma(l.turmaId), l.semestre, l.materia, l.p.titulo, String(l.nota).replace(".", ",")])];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + linhas.map(r => r.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv;charset=utf-8" }));
  a.download = "relatorio_notas.csv"; a.click();
}
