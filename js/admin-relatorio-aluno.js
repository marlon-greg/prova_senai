// Diário → 📈 Relatório completo do aluno com acessibilidade: junta NOTAS das provas, desempenho por TÓPICO e o DIÁRIO,
// por período (semana, mês, semestre ou datas) e agrupado por dia, semana ou mês, com gráficos de evolução.
import { db, esc, $, toast, traduzirErro, dataCurta, semestreDe, materiaDaProva, chaveTexto, textoHorario, rotuloDias } from "./common.js";
import { HUMOR, ITENS_AUX } from "./diario-perguntas.js";
import { analiseDiarioIA } from "./ia.js";
import { graficoLinhas, ligarGraficos } from "./graficos.js";
import { desempenhoPorTopico, MEDIA_MINIMA } from "./admin-relatorios.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const isoDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const media = l => l.length ? l.reduce((s, x) => s + x, 0) / l.length : null;
const fmt = v => v === null || v === undefined ? "—" : (Math.round(v * 10) / 10).toLocaleString("pt-BR");
// chave do grupo: dia "2026-09-01", semana (segunda-feira da semana) ou mês "2026-09"
function grupo(iso, por) {
  if (por === "mes") return iso.slice(0, 7);
  if (por === "semana") { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDe(d); }
  return iso;
}
const rotuloGrupo = (k, por) => por === "mes" ? `${k.slice(5, 7)}/${k.slice(2, 4)}` : por === "semana" ? `sem. ${k.slice(8, 10)}/${k.slice(5, 7)}` : `${k.slice(8, 10)}/${k.slice(5, 7)}`;

// ctx = { aluno: { email, nome, uid }, turmas: [{ turmaId, turma, diasAula }], registros (diário), horario, voltar() }
export async function relatorioAluno(box, ctx) {
  const h = isoDe(new Date()), sem = semestreDe(), semIni = `${sem.slice(0, 4)}-${sem.endsWith("1") ? "01" : "07"}-01`;
  const ini = n => { const d = new Date(); d.setDate(d.getDate() - n); return isoDe(d); };
  box.innerHTML = `<section class="card relatorio-aluno">
    <div class="ed-topo"><div><h2>📈 Relatório completo — ${esc(ctx.aluno.nome || ctx.aluno.email)}</h2><span class="pequeno">Notas das provas, desempenho por tópico e diário, no mesmo lugar.</span></div>
      <button type="button" class="discreto mini" id="raVoltar">← Voltar ao diário</button></div>
    <div class="barra-filtros"><select id="raPeriodo" aria-label="Período"><option value="${ini(6)}|${h}">Última semana</option><option value="${h.slice(0, 7)}-01|${h}">Este mês</option><option value="${ini(29)}|${h}">Últimos 30 dias</option>
        <option value="${semIni}|${h}" selected>Este semestre</option><option value="2000-01-01|${h}">Tudo</option><option value="outro">Escolher datas…</option></select>
      <input type="date" id="raDe" value="${semIni}" max="${h}" aria-label="De"><input type="date" id="raAte" value="${h}" max="${h}" aria-label="Até">
      <select id="raPor" aria-label="Agrupar por"><option value="dia">Por dia</option><option value="semana" selected>Por semana</option><option value="mes">Por mês</option></select>
      <button type="button" class="leve mini" id="raPdf">📄 PDF</button></div>
    <div id="raCorpo"><p class="pequeno">Carregando as provas…</p></div></section>`;
  $("#raVoltar").onclick = ctx.voltar;
  // provas do aluno: as das turmas dele, tentativa lida pelo id (<uid>_<prova>) — funciona para a auxiliar de inclusão
  let provasAluno = [];
  try {
    const uid = ctx.aluno.uid || (await getDoc(doc(db, "acessibilidade", ctx.aluno.email)).catch(() => null))?.data()?.uid;
    const ids = new Set(ctx.turmas.map(t => t.turmaId));
    const [ps, bs] = await Promise.all([getDocs(collection(db, "provas")), getDocs(collection(db, "bancos")).catch(() => null)]);
    const bancos = (bs?.docs || []).map(d => ({ id: d.id, ...d.data() }));
    const provas = ps.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => ids.has(p.turmaId));
    if (uid) provasAluno = (await Promise.all(provas.map(async p => {
      const t = await getDoc(doc(db, "tentativas", `${uid}_${p.id}`)).catch(() => null);
      if (!t?.exists() || !t.data().finalizadaEm) return null;
      const n = Number.isFinite(Number(t.data().nota)) && t.data().nota !== null ? Number(t.data().nota) : Number(t.data().notaPrevia);
      return Number.isFinite(n) ? { t: { id: t.id, ...t.data() }, p, materia: materiaDaProva(p, bancos) || "Sem matéria", nota: n, data: isoDe(t.data().finalizadaEm.toDate ? t.data().finalizadaEm.toDate() : new Date()) } : null;
    }))).filter(Boolean).sort((a, b) => a.data.localeCompare(b.data));
  } catch (e) { console.warn("relatório: provas", e); }
  let topicos = null, analise = null, analiseDe = "";
  const desenhar = async () => {
    const de = $("#raDe").value, ate = $("#raAte").value, por = $("#raPor").value;
    const regs = ctx.registros.filter(r => r.data >= de && r.data <= ate), diarios = regs.filter(r => r.tipo !== "justificativa");
    const notas = provasAluno.filter(x => x.data >= de && x.data <= ate);
    // grupos de tempo (com diário ou prova)
    const chaves = [...new Set([...diarios.map(r => grupo(r.data, por)), ...notas.map(x => grupo(x.data, por))])].sort();
    const ind = [["compreensao", "Compreensão"], ["autonomia", "Autonomia"], ["foco", "Foco"], ["humorSaida", "Humor na saída"]];
    const serieDiario = ind.map(([id, nome]) => ({ nome, valores: chaves.map(k => media(diarios.filter(r => grupo(r.data, por) === k).map(r => Number(r.respostas?.[id])).filter(Boolean))) }));
    const temDiario = serieDiario.some(s => s.valores.some(v => v !== null));
    const faltas = regs.filter(r => r.tipo === "justificativa" && r.motivo === "faltou").length;
    // tópicos: aulas no diário x acerto nas provas
    const aulasTopico = {}; diarios.forEach(r => (r.respostas?.materias || []).forEach(m => (m.topicos || []).forEach(t => { const k = chaveTexto(t); (aulasTopico[k] ||= { nome: t, materia: m.materia, aulas: 0 }).aulas++; })));
    const porMateria = {}; notas.forEach(x => (porMateria[x.materia] ||= []).push(x.nota));
    if (analiseDe !== `${de}|${ate}`) analise = null;
    $("#raCorpo").innerHTML = `
      <h3 class="diario-h3">🧭 Retrato do período <span class="pequeno">${dataCurta(de)} a ${dataCurta(ate)}</span></h3>
      ${retratoHTML(diarios)}
      ${analise ? analiseHTML(analise) : diarios.length ? `<div class="rt-card rt-ia-chamada"><span>🤖 Quer uma análise escrita do período, lendo também as descrições da auxiliar e os comentários dos professores?</span><button type="button" id="raIA">Analisar com IA</button></div>` : ""}
      <h3 class="diario-h3" style="margin-top:18px">📊 Provas e evolução</h3>
      <div class="numeros">
        <div class="numero"><b>${notas.length}</b><span>provas no período</span></div>
        <div class="numero ${notas.length && media(notas.map(x => x.nota)) < MEDIA_MINIMA ? "aviso" : ""}"><b>${fmt(media(notas.map(x => x.nota)))}</b><span>média das provas</span></div>
        <div class="numero"><b>${diarios.length}</b><span>aulas registradas no diário</span></div>
        <div class="numero ${faltas ? "aviso" : ""}"><b>${faltas}</b><span>faltas</span></div></div>
      ${notas.length ? graficoLinhas({ titulo: "Notas das provas ao longo do tempo (0 a 100)", rotulos: notas.map(x => dataCurta(x.data).slice(0, 5)),
          series: [{ nome: "Nota", valores: notas.map(x => x.nota) }], y: { min: 0, max: 100, passo: 25 }, ref: { valor: MEDIA_MINIMA, rotulo: `mínimo ${MEDIA_MINIMA}` } })
        : `<p class="pequeno">Nenhuma prova finalizada no período.</p>`}
      ${notas.length ? `<div class="tabela"><table><tr><th>Data</th><th>Prova</th><th>Matéria</th><th>Nota</th></tr>${notas.map(x => `<tr><td>${dataCurta(x.data)}</td><td>${esc(x.p.titulo)}</td><td>${esc(x.materia)}</td><td class="${x.nota < MEDIA_MINIMA ? "rl-ruim" : x.nota < 70 ? "rl-medio" : "rl-bom"}">${fmt(x.nota)}</td></tr>`).join("")}</table></div>
        <p class="pequeno">Média por matéria: ${Object.entries(porMateria).map(([m, l]) => `<b>${esc(m)}</b> ${fmt(media(l))}`).join(" · ")}</p>` : ""}
      ${temDiario ? graficoLinhas({ titulo: `Diário: como foram as aulas (média ${por === "dia" ? "do dia" : por === "semana" ? "da semana" : "do mês"}, 1 a 5)`, rotulos: chaves.map(k => rotuloGrupo(k, por)), series: serieDiario, y: { min: 1, max: 5, passo: 1 } })
        : `<p class="pequeno">Sem registros do diário no período.</p>`}
      <h3 class="diario-h3" style="margin-top:18px">🧩 Tópicos: aulas trabalhadas × acerto nas provas</h3>
      ${topicos ? topicosHTML(topicos, aulasTopico) : `<p class="pequeno">${notas.length ? `<button type="button" class="leve mini" id="raTopicos">📊 Calcular o acerto por tópico</button> (lê as respostas das provas do período)` : "Sem provas no período."}</p>
        ${Object.keys(aulasTopico).length ? `<p class="pequeno">Tópicos trabalhados no diário: ${Object.values(aulasTopico).map(x => `${esc(x.nome)} (${x.aulas})`).join(" · ")}</p>` : ""}`}`;
    ligarGraficos($("#raCorpo"));
    $("#raIA")?.addEventListener("click", async e => {
      e.target.disabled = true; e.target.textContent = "🤖 Lendo o diário…";
      try { analise = await analisar(diarios, regs, de, ate); analiseDe = `${de}|${ate}`; }
      catch (err) { toast("🤖 " + (err.message || traduzirErro(err)), "erro"); }
      desenhar();
    });
    $("#raTopicos")?.addEventListener("click", async e => {
      e.target.disabled = true; e.target.textContent = "Lendo…";
      try { topicos = (await desempenhoPorTopico(notas.map(x => ({ t: x.t, p: x.p, materia: x.materia })))).get(ctx.aluno.email.toLowerCase()) || new Map(); }
      catch (err) { toast(traduzirErro(err), "erro"); }
      desenhar();
    });
  };
  // IA: com a chave no navegador lê aqui; sem ela, pede ao servidor (que lê o diário com as permissões da pessoa)
  const analisar = async (diarios, regs, de, ate) => {
    const ia = ctx.ia || {}, periodo = `${dataCurta(de)} a ${dataCurta(ate)}`;
    if (ia.cfg?.()) {
      const coms = (await Promise.all(diarios.filter(r => r.nComentarios).slice(0, 15).map(r => getDocs(collection(db, "acessibilidadePrivado", ctx.aluno.email, "diario", r.id, "comentarios")).catch(() => null)))).flatMap(s => s?.docs.map(d => d.data()) || []);
      return analiseDiarioIA({ chave: ia.cfg().chave, modelo: ia.cfg().modelo, periodo, registros: regs, comentarios: coms });
    }
    if (!ia.url?.()) throw new Error("A IA não está configurada (Configuração).");
    const token = await ia.auth.currentUser.getIdToken();
    const r = await fetch(ia.url(), { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify({ acao: "analiseDiario", email: ctx.aluno.email, de, ate }) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`);
    return d.analise;
  };
  const topicosHTML = (mapa, aulas) => {
    const linhas = [...new Set([...mapa.keys(), ...Object.values(aulas).map(a => a.nome)])].map(t => {
      const x = mapa.get(t) || [...mapa].find(([k]) => chaveTexto(k) === chaveTexto(t))?.[1], a = aulas[chaveTexto(t)];
      return { t, materia: x?.materia || a?.materia || "", aulas: a?.aulas || 0, pct: x?.max ? x.pts / x.max * 100 : null, n: x?.n || 0 };
    }).sort((p, q) => (p.pct ?? 101) - (q.pct ?? 101));
    return linhas.length ? `<div class="tabela"><table><tr><th>Tópico</th><th>Matéria</th><th>Aulas no diário</th><th>Acerto nas provas</th><th>Leitura</th></tr>${linhas.map(l => `<tr><td><b>${esc(l.t)}</b></td><td>${esc(l.materia)}</td><td>${l.aulas}</td>
      <td class="${l.pct === null ? "" : l.pct < 50 ? "rl-ruim" : l.pct < 70 ? "rl-medio" : "rl-bom"}">${l.pct === null ? "—" : fmt(l.pct) + "%"} <span class="pequeno">${l.n ? `(${l.n} questões)` : ""}</span></td>
      <td class="pequeno">${l.pct === null ? "ainda não caiu em prova" : l.pct < 50 && l.aulas ? "🔴 trabalhado em aula e ainda difícil: reforço" : l.pct < 50 ? "🔴 reforço (pouco trabalhado no diário)" : l.pct < 70 ? "🟡 atenção" : "🟢 bem"}</td></tr>`).join("")}</table></div>` : `<p class="pequeno">Nenhum tópico.</p>`;
  };
  $("#raPeriodo").onchange = () => { const v = $("#raPeriodo").value; if (v !== "outro") { const [a, b] = v.split("|"); $("#raDe").value = a; $("#raAte").value = b; } topicos = null; desenhar(); };
  $("#raDe").onchange = $("#raAte").onchange = () => { topicos = null; desenhar(); };
  $("#raPor").onchange = desenhar;
  $("#raPdf").onclick = () => imprimir(`Relatório — ${ctx.aluno.nome || ctx.aluno.email}`, `<header class="cab"><div class="marca">SENAI</div><div><h1>Relatório de acompanhamento — ${esc(ctx.aluno.nome || ctx.aluno.email)}</h1>
    <div class="sub">${esc(ctx.turmas.map(t => `${t.turma}${rotuloDias(t.diasAula) ? ` (${rotuloDias(t.diasAula)})` : ""}`).join(", "))} · período ${dataCurta($("#raDe").value)} a ${dataCurta($("#raAte").value)} · ${esc(textoHorario(ctx.horario))}</div></div></header>${$("#raCorpo").innerHTML}`);
  desenhar();
}

// PDF (janela de impressão) com o mesmo conteúdo da tela, tabelas abertas
export function imprimir(titulo, corpo) {
  const w = window.open("", "_blank");
  if (!w) return toast("O navegador bloqueou a janela. Libere pop-ups.", "erro");
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(titulo)}</title><style>
    @page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;font-size:10.5pt;color:#111;margin:0}.cab{display:flex;gap:12px;align-items:center;border-bottom:3px solid #c1272d;padding-bottom:8px;margin-bottom:12px}
    .marca{background:#c1272d;color:#fff;font-weight:bold;padding:6px 10px;letter-spacing:2px}h1{font-size:15pt;margin:0}.sub{color:#555;font-size:9.5pt}h2,h3{font-size:12pt;margin:14px 0 6px}
    table{width:100%;border-collapse:collapse;margin:4px 0}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;font-size:9.5pt}th{background:#f1f1f1}
    .numeros{display:flex;gap:8px;margin-bottom:8px}.numero{border:1px solid #ccc;border-radius:6px;padding:6px 10px;flex:1}.numero b{display:block;font-size:14pt}.numero span{font-size:8.5pt;color:#555}
    figure{margin:10px 0;page-break-inside:avoid}figcaption{font-weight:bold;margin-bottom:4px}.graf{width:100%;height:auto}.graf-eixo{font-size:11px;fill:#555}.graf-rot{font-size:11px;fill:#111}
    .graf-legenda span{margin-right:12px;font-size:9pt}.graf-legenda i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px}.graf-dica,button,.graf-pt circle[fill=transparent]{display:none}
    ${CSS_RETRATO}
    details>summary{display:none}details{display:block}.rl-ruim{color:#c1272d;font-weight:bold}.rl-medio{color:#9a5b00}.rl-bom{color:#1f7a4d}.pequeno{font-size:9pt;color:#444}tr{page-break-inside:avoid}
  </style></head><body>${corpo}<script>document.querySelectorAll("details").forEach(d=>d.open=true);window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);
  w.document.close();
}

// ---------- 🧭 retrato do período: emojis e médias do diário, tendência e leitura automática ----------
const ESCALAS = [["compreensao", "🧠", "Compreensão"], ["autonomia", "🦸", "Autonomia"], ["foco", "🎯", "Foco e atenção"], ["comunicacao", "💬", "Comunicação"]];
const rotuloDe = (id, v) => { const it = ITENS_AUX.find(x => x.id === id); return v == null ? "" : it?.rotulos?.[Math.max(0, Math.min(4, Math.round(v) - 1))] || ""; };
const carinha = v => v == null ? "❔" : HUMOR[Math.max(0, Math.min(4, Math.round(v) - 1))].e;
const contar = (diarios, id) => { const c = {}; diarios.forEach(r => [].concat(r.respostas?.[id] || []).forEach(x => c[x] = (c[x] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
// média da 1ª e da 2ª metade dos registros (em ordem de data) para mostrar a tendência
function tendencia(diarios, id) {
  const l = diarios.slice().sort((a, b) => a.data.localeCompare(b.data)).map(r => Number(r.respostas?.[id])).filter(Boolean);
  if (l.length < 4) return null;
  const m = Math.floor(l.length / 2), a = media(l.slice(0, m)), b = media(l.slice(m));
  return { a, b, d: b - a };
}
const seta = t => !t ? "" : t.d >= .35 ? `<span class="rt-tend sobe" title="1ª metade ${fmt(t.a)} → 2ª metade ${fmt(t.b)}">↗ subiu</span>` : t.d <= -.35 ? `<span class="rt-tend desce" title="1ª metade ${fmt(t.a)} → 2ª metade ${fmt(t.b)}">↘ caiu</span>` : `<span class="rt-tend igual" title="1ª metade ${fmt(t.a)} → 2ª metade ${fmt(t.b)}">→ estável</span>`;
export function retratoHTML(diarios) {
  if (!diarios.length) return `<div class="rt-vazio">📔 Sem registros do diário neste período.</div>`;
  const m = id => media(diarios.map(r => Number(r.respostas?.[id])).filter(Boolean));
  const hc = m("humorChegada"), hs = m("humorSaida"), est = m("estrelas");
  const energia = ITENS_AUX.find(x => x.id === "energia").opcoes, cEn = Object.fromEntries(contar(diarios, "energia"));
  const sob = { nao: 0, leve: 0, sim: 0 }; diarios.forEach(r => { const s = r.respostas?.sobrecarga; if (s in sob) sob[s]++; });
  const chips = (id, n = 6) => contar(diarios, id).slice(0, n).map(([k, q]) => `<span class="rt-chip">${esc(k)} <b>${q}</b></span>`).join("") || `<span class="pequeno">—</span>`;
  const vitorias = diarios.filter(r => r.respostas?.conquista).slice(-5).reverse();
  // leitura automática (frases a partir dos números e das marcações)
  const frases = [];
  if (hc != null && hs != null) frases.push(hs - hc >= .3 ? `O humor <b>melhora durante a aula</b>: chega ${carinha(hc)} (${fmt(hc)}) e sai ${carinha(hs)} (${fmt(hs)}).` : hc - hs >= .3 ? `O humor <b>cai ao longo da aula</b>: chega ${carinha(hc)} (${fmt(hc)}) e sai ${carinha(hs)} (${fmt(hs)}). Vale observar o que acontece no meio do dia.` : `O humor fica <b>estável</b> na aula: em média ${carinha(hs)} (${fmt(hs)}).`);
  ESCALAS.forEach(([id, , nome]) => { const t = tendencia(diarios, id); if (t && Math.abs(t.d) >= .35) frases.push(`${nome} <b>${t.d > 0 ? "subiu" : "caiu"}</b> de ${fmt(t.a)} para ${fmt(t.b)} entre a primeira e a segunda metade do período.`); });
  const melhor = ESCALAS.map(([id, , nome]) => [nome, m(id)]).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
  if (melhor.length > 1) frases.push(`Ponto mais forte: <b>${melhor[0][0].toLowerCase()}</b> (${fmt(melhor[0][1])}); o que mais pede apoio: <b>${melhor.at(-1)[0].toLowerCase()}</b> (${fmt(melhor.at(-1)[1])}).`);
  if (sob.leve + sob.sim) frases.push(`Sinais de sobrecarga em <b>${sob.leve + sob.sim} de ${diarios.length}</b> aula(s)${contar(diarios, "gatilhos")[0] ? `, mais ligados a: ${contar(diarios, "gatilhos").slice(0, 3).map(([k]) => k.toLowerCase()).join(", ")}` : ""}.`);
  else frases.push(`Nenhum sinal de sobrecarga registrado no período. 🟢`);
  if (contar(diarios, "estrategias")[0]) frases.push(`O que mais funcionou: ${contar(diarios, "estrategias").slice(0, 3).map(([k]) => k.toLowerCase()).join(", ")}.`);
  const dif = contar(diarios, "dificuldades").filter(([k]) => k !== "Nada foi difícil");
  if (dif[0]) frases.push(`Dificuldades mais citadas: ${dif.slice(0, 3).map(([k]) => k.toLowerCase()).join(", ")}.`);
  return `<div class="rt">
    <div class="rt-linha">
      <div class="rt-card rt-humor"><span class="rt-tit">😊 Humor</span><div class="rt-faces"><div><span class="rt-face">${carinha(hc)}</span><small>chegada · ${fmt(hc)}</small></div><span class="rt-seta">→</span><div><span class="rt-face">${carinha(hs)}</span><small>saída · ${fmt(hs)}</small></div></div></div>
      <div class="rt-card"><span class="rt-tit">⚡ Energia</span><div class="rt-energia">${energia.map(([k, r]) => `<div><span>${r.split(" ")[0]}</span><b>${cEn[k] || 0}</b><small>${esc(r.split(" ").slice(1).join(" "))}</small></div>`).join("")}</div></div>
      <div class="rt-card"><span class="rt-tit">🏆 Dia, no geral</span><div class="rt-estrelas" title="${fmt(est)} de 5">${est == null ? "—" : "★".repeat(Math.round(est)) + `<span>${"★".repeat(5 - Math.round(est))}</span>`}</div><small>média ${fmt(est)} de 5 · ${diarios.length} aula(s)</small></div>
      <div class="rt-card"><span class="rt-tit">🌡 Sobrecarga</span><div class="rt-energia"><div><span>🟢</span><b>${sob.nao}</b><small>sem sinais</small></div><div><span>🟡</span><b>${sob.leve}</b><small>leve</small></div><div><span>🔴</span><b>${sob.sim}</b><small>crise</small></div></div></div>
    </div>
    <div class="rt-card rt-escalas">${ESCALAS.map(([id, e, nome]) => { const v = m(id); return `<div class="rt-esc"><span class="rt-esc-n">${e} ${nome}</span>
      <span class="rt-barra"><i style="width:${v == null ? 0 : (v / 5) * 100}%"></i></span><b>${fmt(v)}</b><span class="rt-esc-r">${esc(rotuloDe(id, v))} ${seta(tendencia(diarios, id))}</span></div>`; }).join("")}</div>
    <div class="rt-linha">
      <div class="rt-card"><span class="rt-tit">🧩 O que funcionou</span><div class="rt-chips">${chips("estrategias")}</div></div>
      <div class="rt-card"><span class="rt-tit">🧗 O que foi difícil</span><div class="rt-chips">${chips("dificuldades")}</div></div>
      <div class="rt-card"><span class="rt-tit">🤝 Interações</span><div class="rt-chips">${chips("interacao")}</div></div>
    </div>
    ${vitorias.length ? `<div class="rt-card"><span class="rt-tit">🏆 Vitórias registradas</span><ul class="rt-vitorias">${vitorias.map(r => `<li><b>${dataCurta(r.data).slice(0, 5)}</b> ${esc(r.respostas.conquista)}</li>`).join("")}</ul></div>` : ""}
    <div class="rt-card rt-leitura"><span class="rt-tit">🔎 Leitura do período (automática, pelos números)</span><ul>${frases.map(f => `<li>${f}</li>`).join("")}</ul></div>
  </div>`;
}
// análise da IA (texto estruturado) em HTML
export const analiseHTML = a => `<div class="rt-card rt-ia"><span class="rt-tit">🤖 Análise dos registros e das descrições da auxiliar</span>
  <p class="rt-resumo">${esc(a.resumo)}</p>
  <div class="rt-linha">${[["😊 Humor e bem-estar", a.humor], ["📚 Aprendizagem", a.aprendizagem], ["🤝 Convivência", a.convivencia]].filter(([, t]) => t).map(([t, x]) => `<div><b>${t}</b><p>${esc(x)}</p></div>`).join("")}</div>
  <div class="rt-linha">${[["🌱 Avanços", a.avancos], ["⚠️ Pontos de atenção", a.atencao], ["🎯 Recomendações", a.recomendacoes]].filter(([, l]) => l?.length).map(([t, l]) => `<div><b>${t}</b><ul>${l.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>
  <p class="pequeno">Gerada por IA a partir do diário do período; revise antes de enviar para fora da equipe.</p></div>`;

// visual do retrato: o mesmo na tela e no PDF
const CSS_RETRATO = `.rt{display:flex;flex-direction:column;gap:10px;margin:6px 0 14px}
.rt-linha{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.rt-card{border:1px solid #e3e6ec;border-radius:14px;padding:12px 14px;background:#fff;break-inside:avoid;page-break-inside:avoid}
.rt-tit{display:block;font-weight:700;font-size:.92em;color:#14213d;margin-bottom:8px}
.rt-faces{display:flex;align-items:center;justify-content:center;gap:14px;text-align:center}.rt-faces small,.rt-card>small{display:block;color:#6b7280;font-size:.78em}
.rt-face{font-size:2.6em;line-height:1.1}.rt-seta{font-size:1.6em;color:#9ca3af}
.rt-energia{display:flex;justify-content:space-around;text-align:center;gap:6px}.rt-energia div{display:flex;flex-direction:column;align-items:center}.rt-energia span{font-size:1.6em}.rt-energia b{font-size:1.1em}.rt-energia small{color:#6b7280;font-size:.72em}
.rt-estrelas{font-size:1.9em;color:#f59e0b;letter-spacing:2px;text-align:center}.rt-estrelas span{color:#e5e7eb}
.rt-escalas{display:flex;flex-direction:column;gap:8px}
.rt-esc{display:grid;grid-template-columns:170px 1fr 40px minmax(160px,1.1fr);gap:10px;align-items:center}.rt-esc-n{font-weight:600}
.rt-barra{height:12px;border-radius:999px;background:#eef0f4;overflow:hidden}.rt-barra i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#60a5fa,#1d4ed8)}
.rt-esc-r{font-size:.85em;color:#4b5563}.rt-tend{display:inline-block;margin-left:6px;font-size:.85em;font-weight:700;padding:0 8px;border-radius:999px}
.rt-tend.sobe{background:#dcfce7;color:#166534}.rt-tend.desce{background:#fee2e2;color:#991b1b}.rt-tend.igual{background:#f1f5f9;color:#475569}
.rt-chips{display:flex;flex-wrap:wrap;gap:6px}.rt-chip{background:#f1f5f9;border-radius:999px;padding:3px 10px;font-size:.85em}.rt-chip b{color:#1d4ed8;margin-left:2px}
.rt-vitorias{margin:0;padding-left:18px}.rt-vitorias li{margin:3px 0}
.rt-leitura ul{margin:0;padding-left:18px}.rt-leitura li{margin:4px 0;line-height:1.45}
.rt-ia{border-color:#c7d2fe;background:#f8faff}.rt-ia .rt-resumo{font-size:1.02em;line-height:1.5;margin:0 0 10px}.rt-ia p{margin:4px 0 8px;line-height:1.45}.rt-ia ul{margin:4px 0;padding-left:18px}
.rt-ia-chamada{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#f8faff;border-style:dashed}
.rt-vazio{padding:14px;border:1px dashed #d1d5db;border-radius:12px;color:#6b7280;text-align:center}
@media (max-width:700px){.rt-esc{grid-template-columns:1fr 40px}.rt-esc .rt-barra{grid-column:1/-1;order:3}.rt-esc-r{grid-column:1/-1;order:4}}`;
if (typeof document !== "undefined" && !document.getElementById("cssRetrato")) { const st = document.createElement("style"); st.id = "cssRetrato"; st.textContent = CSS_RETRATO; document.head.append(st); }
