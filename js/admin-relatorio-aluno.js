// Diário → 📈 Relatório completo do aluno com acessibilidade: junta NOTAS das provas, desempenho por TÓPICO e o DIÁRIO,
// por período (semana, mês, semestre ou datas) e agrupado por dia, semana ou mês, com gráficos de evolução.
import { db, esc, $, toast, traduzirErro, dataCurta, semestreDe, materiaDaProva, chaveTexto, textoHorario, rotuloDias } from "./common.js";
import { HUMOR } from "./diario-perguntas.js";
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
  let topicos = null;
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
    $("#raCorpo").innerHTML = `
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
    $("#raTopicos")?.addEventListener("click", async e => {
      e.target.disabled = true; e.target.textContent = "Lendo…";
      try { topicos = (await desempenhoPorTopico(notas.map(x => ({ t: x.t, p: x.p, materia: x.materia })))).get(ctx.aluno.email.toLowerCase()) || new Map(); }
      catch (err) { toast(traduzirErro(err), "erro"); }
      desenhar();
    });
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
    details>summary{display:none}details{display:block}.rl-ruim{color:#c1272d;font-weight:bold}.rl-medio{color:#9a5b00}.rl-bom{color:#1f7a4d}.pequeno{font-size:9pt;color:#444}tr{page-break-inside:avoid}
  </style></head><body>${corpo}<script>document.querySelectorAll("details").forEach(d=>d.open=true);window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);
  w.document.close();
}
