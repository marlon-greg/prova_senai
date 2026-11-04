// Painel → aba "Diário": o diário de cada aluno com acessibilidade.
// A auxiliar de inclusão registra o dia (perguntas em etapas, humor com carinhas, escalas, chips);
// o professor lê e comenta (modelo próprio, nada obrigatório), sem mudar o registro.
// acessibilidadePrivado/{email}/diario/{AAAA-MM-DD_autor} = { data, autor, autorNome, papel, respostas, completo, nComentarios, ... }
// acessibilidadePrivado/{email}/diario/{id}/comentarios/{c} = { autor, autorNome, papel, respostas, criadoEm }
// (o aluno nunca lê acessibilidadePrivado)
import { db, esc, $, toast, confirmar, modal, traduzirErro, iniciais, dataBR, semestreDe, chaveTexto, dataCurta, diaDeAula, rotuloDias, textoHorario } from "./common.js";
import { resumoDiario, medalhasDiario } from "./conquistas.js";
import { HUMOR, humorEmoji, SECOES_AUX, ITENS_AUX, ITENS_PROF, visivel, respondido, completude } from "./diario-perguntas.js";
import { listarPlanos } from "./admin-org.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, orderBy, serverTimestamp, increment }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let ctx = null;   // { eu, podeEditar, souDono, alunosDasTurmas }
let alunos = [], atual = null, registros = [], planos = [], turmasAluno = [], mes = null, aberto = null;
const ehInclusao = () => ctx.eu.papel === "inclusao";
const podeRegistrar = () => ehInclusao() || ctx.souDono();
const colDiario = e => collection(db, "acessibilidadePrivado", e, "diario");
const hojeISO = () => isoDe(new Date());
const isoDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dia = s => new Date(s + "T12:00:00");
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dataLonga = s => { const d = dia(s); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };

export function iniciarDiario(c) { ctx = c; }

// ---------- lista de alunos ----------
export async function carregarDiario() {
  const box = $("#diarioAlunos");
  box.innerHTML = `<p class="pequeno">Carregando…</p>`;
  try {
    const q = ehInclusao() ? query(collection(db, "acessibilidade"), where("auxiliares", "array-contains", ctx.eu.email)) : collection(db, "acessibilidade");
    alunos = (await getDocs(q)).docs.map(d => ({ email: d.id, ...d.data() })).filter(a => a.ativo !== false)
      .sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR"));
  } catch (e) { box.innerHTML = `<p class="erro-texto">${esc(traduzirErro(e))}</p>`; return; }
  if (!alunos.length) {
    box.innerHTML = `<div class="vazio"><div class="icone">📔</div><p><b>${ehInclusao() ? "Nenhum aluno vinculado a você ainda." : "Nenhum aluno com acessibilidade."}</b></p>
      <p class="pequeno">O diário é dos alunos marcados na aba Acessibilidade${ehInclusao() ? "; peça ao professor para vincular você." : "."}</p></div>`;
    $("#diarioPainel").innerHTML = ""; return;
  }
  const tds = await ctx.alunosDasTurmas().catch(() => []);
  const turmaDe = e => tds.filter(x => x.email === e);
  const ts = new Map(); alunos.forEach(a => turmaDe(a.email).forEach(t => ts.set(t.turmaId, t.turma)));
  box.innerHTML = (alunos.length > 1 ? `<div class="barra-filtros" role="search" style="margin-top:8px">
      <input type="search" id="dBusca" placeholder="🔎 Pesquisar aluno…" aria-label="Pesquisar aluno">
      ${ts.size > 1 ? `<select id="dTurma" aria-label="Filtrar por turma"><option value="">👥 Todas as turmas</option>${[...ts].map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("")}</select>` : ""}</div>` : "") +
    `<div class="diario-alunos">` + alunos.map(a => `<button type="button" class="diario-aluno${a.email === atual?.email ? " ativo" : ""}" data-al="${esc(a.email)}"
      data-busca="${esc(chaveTexto(`${a.nome || ""} ${a.email}`))}" data-turmas="${esc(turmaDe(a.email).map(t => t.turmaId).join(" "))}">
      <span class="avatar">${esc(iniciais(a.nome || a.email))}</span><span><b>${esc(a.nome || a.email)}</b><span class="pequeno">${esc(turmaDe(a.email).map(t => t.turma).join(", ") || a.email)}</span></span></button>`).join("") + `</div>`;
  box.querySelectorAll("[data-al]").forEach(b => b.onclick = () => abrirAluno(b.dataset.al));
  const filtrar = () => {
    const q = chaveTexto($("#dBusca")?.value), t = $("#dTurma")?.value || "";
    box.querySelectorAll("[data-al]").forEach(b => b.classList.toggle("oculto", !!(q && !b.dataset.busca.includes(q)) || !!(t && !b.dataset.turmas.split(" ").includes(t))));
  };
  $("#dBusca")?.addEventListener("input", filtrar); $("#dTurma")?.addEventListener("change", filtrar);
  abrirAluno(atual && alunos.some(a => a.email === atual.email) ? atual.email : alunos[0].email);
}

async function abrirAluno(email) {
  atual = alunos.find(a => a.email === email); aberto = null;
  document.querySelectorAll("[data-al]").forEach(b => b.classList.toggle("ativo", b.dataset.al === email));
  $("#diarioPainel").innerHTML = `<div class="card"><p class="pequeno">Carregando o diário…</p></div>`;
  try {
    const [rs, ps, al] = await Promise.all([getDocs(colDiario(email)), listarPlanos().catch(() => []), ctx.alunosDasTurmas().catch(() => [])]);
    registros = rs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.data.localeCompare(a.data) || String(a.autor).localeCompare(String(b.autor)));
    planos = ps; turmasAluno = al.filter(x => x.email === email);
  } catch (e) { $("#diarioPainel").innerHTML = `<div class="card"><p class="erro-texto">${esc(traduzirErro(e))} (Publique o firestore.rules atual.)</p></div>`; return; }
  mes = mes || hojeISO().slice(0, 7);
  desenharPainel();
}

// ---------- dias de aula e conquistas da aluna ----------
const diasAulaAluno = () => [...new Set(turmasAluno.flatMap(t => t.diasAula || []))];
const ehDiaDeAula = iso => diaDeAula(turmasAluno.length ? turmasAluno : [{}], iso);
const completos = () => registros.filter(r => r.tipo !== "justificativa");
const resumo = () => resumoDiario(registros, diasAulaAluno());
// o resumo positivo vai para acessibilidade/{email} (a aluna lê esse documento e vê as medalhas)
async function atualizarResumo() {
  try { await updateDoc(doc(db, "acessibilidade", atual.email), { diarioResumo: resumo(), diarioResumoEm: serverTimestamp() }); }
  catch (e) { console.warn("resumo do diário", e); }
}
export const MOTIVOS = { atrasado: ["📝", "Registro atrasado (teve aula e ela estava)"], faltou: ["🚫", "Ela faltou"], semAula: ["📭", "Não teve aula (feriado, evento, aula cancelada)"],
  extra: ["➕", "Aula extra / reposição"], outro: ["💬", "Outro motivo"] };
const media = l => l.length ? l.reduce((s, x) => s + x, 0) / l.length : null;

// ---------- painel do aluno ----------
function desenharPainel() {
  const a = atual, meds = medalhasDiario(resumo());
  const doMes = completos().filter(r => r.data.startsWith(mes));
  const faltasMes = registros.filter(r => r.data.startsWith(mes) && r.tipo === "justificativa" && r.motivo === "faltou").length;
  const est = media(doMes.map(r => Number(r.respostas?.estrelas)).filter(Boolean));
  const hum = media(doMes.flatMap(r => [r.respostas?.humorChegada, r.respostas?.humorSaida].map(Number).filter(Boolean)));
  const ultimos = [...new Set(completos().map(r => r.data))].slice(0, 10).reverse();
  const turma = turmasAluno.map(t => `${t.turma}${rotuloDias(t.diasAula) ? ` (${rotuloDias(t.diasAula)})` : ""}`).join(", ");
  const meuHoje = registros.find(r => r.data === hojeISO() && r.autor === ctx.eu.email);
  $("#diarioPainel").innerHTML = `
  <section class="card diario-hero">
    <div class="dh-aluno"><span class="avatar grande">${esc(iniciais(a.nome || a.email))}</span>
      <div><h2>${esc(a.nome || a.email)}</h2><span class="pequeno">${turma ? `👥 ${esc(turma)} · ` : ""}${esc(a.email)}</span>
        <span class="pequeno" style="display:block">🕖 ${esc(textoHorario(ctx.horario?.()))}</span>
        <div class="dh-humores" title="Humor na saída, últimos registros">${ultimos.map(d => { const r = registros.find(x => x.data === d); return `<span title="${dataCurta(d)}">${humorEmoji(r?.respostas?.humorSaida || r?.respostas?.humorChegada) || "·"}</span>`; }).join("") || `<span class="pequeno">ainda sem registros</span>`}</div></div></div>
    <div class="dh-numeros">
      <div class="dh-num"><b>📒 ${doMes.length}</b><span>aulas registradas no mês</span></div>
      <div class="dh-num"><b>🚫 ${faltasMes}</b><span>faltas no mês</span></div>
      <div class="dh-num"><b>${est ? "⭐ " + est.toFixed(1) : "—"}</b><span>estrelas no mês</span></div>
      <div class="dh-num"><b>${hum ? humorEmoji(Math.round(hum)) + " " + hum.toFixed(1) : "—"}</b><span>humor no mês</span></div>
    </div>
    <div class="dh-acao">${podeRegistrar() ? `<button id="dNovo" class="grande-btn">${meuHoje ? "✎ Continuar o registro de hoje" : ehDiaDeAula(hojeISO()) ? "✍ Registrar a aula de hoje" : "✍ Registrar hoje (não é dia de aula)"}</button>
      <div class="outro-dia" role="group" aria-label="Registrar outro dia"><span class="pequeno">Outro dia:</span>
        ${atalhosDias().map(([iso, rot]) => `<button type="button" class="chip-dia" data-rapido="${iso}" title="${dataLonga(iso)}">${rot}</button>`).join("")}
        <label class="chip-dia botao-data">📆 Escolher data<input type="date" id="dOutroDia" max="${hojeISO()}" aria-label="Escolher a data do registro"></label></div>` : `<p class="pequeno" style="margin:0">Você lê os registros e deixa o seu comentário em cada dia. Quem escreve o diário é a auxiliar de inclusão.</p>`}
      <button id="dRelatorio" class="leve" type="button" title="Relatório formal do período, para enviar à coordenação, direção ou sede">📄 Relatório formal (PDF)</button></div>
  </section>
  <details class="card prev-conquistas">
    <summary><h3 class="diario-h3" style="display:inline">🏅 Conquistas que a aluna vê</h3> <span class="pequeno">— ${meds.filter(m => m.ok).length} de ${meds.length} · ela vê isto na página dela (só coisas positivas, nada dos textos do diário)</span></summary>
    <div class="medalhas">${meds.map(m => `<div class="medalha${m.ok ? " ganha" : ""}" title="${esc(m.d || m.t)}"><span class="m-emoji">${m.e}</span><b>${esc(m.t)}</b>
      <span class="pequeno">${m.ok ? "conquistada!" : `${Math.min(m.v, m.meta)}/${m.meta}`}</span>${m.ok ? "" : `<i class="m-barra"><i style="width:${Math.round(Math.min(m.v, m.meta) / m.meta * 100)}%"></i></i>`}</div>`).join("")}</div>
  </details>
  <div class="diario-grade">
    <section class="card diario-cal">${calendarioHTML()}</section>
    <section class="card" id="dDetalhe">${aberto ? "" : ultimosHTML()}</section>
  </div>`;
  $("#dNovo")?.addEventListener("click", () => iniciarRegistro(hojeISO()));
  const od = $("#dOutroDia");
  if (od) {
    od.onchange = () => { if (od.value) iniciarRegistro(od.value); };
    od.closest("label").onclick = e => { if (e.target !== od) { e.preventDefault(); try { od.showPicker(); } catch (x) { od.focus(); } } };
  }
  document.querySelectorAll("[data-rapido]").forEach(b => b.onclick = () => iniciarRegistro(b.dataset.rapido));
  $("#dRelatorio").onclick = () => relatorioFormal();
  ligarCalendario();
  if (aberto) mostrarDia(aberto);
  else ligarUltimos();
}

function calendarioHTML() {
  const [ano, m] = mes.split("-").map(Number), primeiro = new Date(ano, m - 1, 1), ndias = new Date(ano, m, 0).getDate();
  const porDia = {}; registros.filter(r => r.data.startsWith(mes)).forEach(r => (porDia[r.data] ||= []).push(r));
  let cel = Array(primeiro.getDay()).fill(`<span class="cal-vazio"></span>`);
  for (let d = 1; d <= ndias; d++) {
    const iso = `${mes}-${String(d).padStart(2, "0")}`, rs = porDia[iso] || [], r = rs.find(x => x.tipo !== "justificativa") || rs[0], fds = !ehDiaDeAula(iso);
    const coment = rs.reduce((s, x) => s + (x.nComentarios || 0), 0);
    cel.push(`<button type="button" class="cal-dia${rs.length ? " tem" : ""}${iso === hojeISO() ? " hoje" : ""}${fds ? " fds" : ""}${iso === aberto ? " aberto" : ""}" data-dia="${iso}" ${!rs.length && !podeRegistrar() ? "disabled" : ""}
      aria-label="${dataLonga(iso)}${rs.length ? ", com registro" : ""}"><span class="cal-n">${d}</span>${r ? `<span class="cal-emoji">${r.tipo === "justificativa" ? (MOTIVOS[r.motivo] || MOTIVOS.outro)[0] : humorEmoji(r.respostas?.humorSaida || r.respostas?.humorChegada) || "📝"}</span>` : ""}
      ${coment ? `<span class="cal-com" title="${coment} comentário(s)">💬${coment}</span>` : ""}</button>`);
  }
  return `<div class="cal-topo"><button type="button" class="leve mini" data-mes="-1" aria-label="Mês anterior">◀</button><h3>${MESES[m - 1]} ${ano}</h3><button type="button" class="leve mini" data-mes="1" aria-label="Próximo mês">▶</button></div>
    <div class="cal-grade">${DIAS.map(x => `<span class="cal-sem">${x}</span>`).join("")}${cel.join("")}</div>
    <p class="pequeno cal-leg">Carinha = humor na saída · 🚫 faltou · 📭 sem aula · 💬 comentários · dias em cinza não são dias de aula${diasAulaAluno().length ? ` (aulas: ${rotuloDias(diasAulaAluno())})` : ""}</p>`;
}
function ligarCalendario() {
  document.querySelectorAll("[data-mes]").forEach(b => b.onclick = () => {
    const [a, m] = mes.split("-").map(Number), d = new Date(a, m - 1 + Number(b.dataset.mes), 1);
    mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; desenharPainel();
  });
  document.querySelectorAll("[data-dia]").forEach(b => b.onclick = () => {
    const iso = b.dataset.dia;
    if (registros.some(r => r.data === iso)) { aberto = iso; desenharPainel(); $("#dDetalhe").scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (podeRegistrar() && iso <= hojeISO()) iniciarRegistro(iso);
  });
}
function ultimosHTML() {
  const rs = registros.slice(0, 6);
  return `<h3 class="diario-h3">🗒 Últimos registros</h3>` + (rs.length ? rs.map(r => `<button type="button" class="ult-reg" data-dia-reg="${r.data}">
    <span class="ult-emoji">${r.tipo === "justificativa" ? (MOTIVOS[r.motivo] || MOTIVOS.outro)[0] : humorEmoji(r.respostas?.humorSaida || r.respostas?.humorChegada) || "📝"}</span>
    <span><b>${dataLonga(r.data)}</b> <span class="pequeno">· ${esc(r.autorNome || r.autor)}${r.nComentarios ? ` · 💬 ${r.nComentarios}` : ""}</span>
    <span class="pequeno ult-txt">${r.tipo === "justificativa" ? esc((MOTIVOS[r.motivo] || MOTIVOS.outro)[1] + (r.texto ? ": " + r.texto : "")).slice(0, 140) : esc(String(r.respostas?.atividades || r.respostas?.conquista || "").slice(0, 120))}</span></span>
    <span class="ult-estrelas">${"★".repeat(Number(r.respostas?.estrelas || 0))}</span></button>`).join("")
    : `<div class="vazio"><div class="icone">📔</div><p>Nenhum registro ainda.${podeRegistrar() ? " Comece pelo dia de hoje: leva uns 3 minutos." : ""}</p></div>`);
}
function ligarUltimos() { document.querySelectorAll("[data-dia-reg]").forEach(b => b.onclick = () => { aberto = b.dataset.diaReg; desenharPainel(); }); }

// ---------- leitura de um dia ----------
function valorHTML(it, v) {
  if (it.tipo === "emoji") { const h = HUMOR.find(x => x.v === Number(v)); return h ? `<span class="v-emoji">${h.e}</span> ${esc(h.r)}` : ""; }
  if (it.tipo === "escala") return `<span class="v-escala" aria-label="${v} de 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= v ? "on" : ""}"></i>`).join("")}</span> ${it.icone || ""} ${esc(it.rotulos?.[v - 1] || "")}`;
  if (it.tipo === "escolha") return esc((it.opcoes.find(o => o[0] === v) || [, v])[1]);
  if (it.tipo === "chips") return (v || []).map(x => `<span class="tag">${esc(x)}</span>`).join("");
  if (it.tipo === "estrelas") return `<span class="v-estrelas">${"★".repeat(v)}<span>${"★".repeat(5 - v)}</span></span>`;
  if (it.tipo === "materias") return (v || []).map(m => `<div>📚 <b>${esc(m.materia)}</b>${m.topicos?.length ? `: ${m.topicos.map(t => `<span class="tag nota">${esc(t)}</span>`).join("")}` : ""}</div>`).join("");
  if (it.tipo === "materia1") return v ? `📚 ${esc(v)}` : "";
  return `<span class="v-texto">${esc(v).replace(/\n/g, "<br>")}</span>`;
}
async function mostrarDia(iso) {
  const box = $("#dDetalhe"), rs = registros.filter(r => r.data === iso);
  box.innerHTML = `<div class="det-topo"><h3 class="diario-h3">📖 ${dataLonga(iso)}</h3><button type="button" class="discreto mini" id="dFechar">✕ fechar</button></div>` + rs.map(r => {
    const meu = r.autor === ctx.eu.email;
    return `<article class="registro" data-reg="${esc(r.id)}">
      <div class="reg-cab"><span class="pequeno">✍ ${esc(r.autorNome || r.autor)} · ${r.completo ?? completude(r.respostas)}% preenchido · ${dataBR(r.atualizadoEm || r.criadoEm)}</span>
        ${meu && podeRegistrar() ? `<span><button type="button" class="leve mini" data-editreg="${esc(r.data)}">${r.tipo === "justificativa" ? "📝 Preencher o diário" : "✎ Editar"}</button> <button type="button" class="discreto mini perigo-txt" data-delreg="${esc(r.id)}">🗑</button></span>` : ""}</div>
      ${r.tipo === "justificativa" ? `<div class="reg-secao" style="--cor:#64748b"><h4>${(MOTIVOS[r.motivo] || MOTIVOS.outro)[0]} Justificativa</h4><p style="margin:0"><b>${esc((MOTIVOS[r.motivo] || MOTIVOS.outro)[1])}</b>${r.texto ? `<br>${esc(r.texto)}` : ""}</p></div>` : ""}
      ${r.outroDia ? `<p class="pequeno">${(MOTIVOS[r.outroDia.motivo] || MOTIVOS.outro)[0]} Registrado depois: ${esc((MOTIVOS[r.outroDia.motivo] || MOTIVOS.outro)[1])}${r.outroDia.texto ? ` — ${esc(r.outroDia.texto)}` : ""}</p>` : ""}
      ${r.tipo === "justificativa" ? "" : SECOES_AUX.map(s => {
        const its = s.itens.filter(it => visivel(it, r.respostas) && respondido(it, r.respostas));
        return its.length ? `<div class="reg-secao" style="--cor:${s.cor}"><h4>${s.icone} ${esc(s.titulo)}</h4><dl>${its.map(it => `<div><dt>${esc(it.rot)}</dt><dd>${valorHTML(it, r.respostas[it.id])}</dd></div>`).join("")}</dl></div>` : "";
      }).join("")}
      <div class="comentarios" id="com-${esc(r.id)}"><p class="pequeno">Carregando comentários…</p></div>
    </article>`;
  }).join("");
  $("#dFechar").onclick = () => { aberto = null; desenharPainel(); };
  box.querySelectorAll("[data-editreg]").forEach(b => b.onclick = () => { const r = registros.find(x => x.data === b.dataset.editreg && x.autor === ctx.eu.email); abrirEditor(b.dataset.editreg, r?.tipo === "justificativa" ? { motivo: r.motivo, texto: r.texto } : r?.outroDia || null); });
  box.querySelectorAll("[data-delreg]").forEach(b => b.onclick = async () => {
    if (!(await confirmar("Apagar este registro do diário? Os comentários dele também somem.", { titulo: "Apagar registro", ok: "Apagar", perigo: true }))) return;
    try {
      const cs = await getDocs(collection(db, "acessibilidadePrivado", atual.email, "diario", b.dataset.delreg, "comentarios"));
      await Promise.all(cs.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(colDiario(atual.email), b.dataset.delreg));
      registros = registros.filter(r => r.id !== b.dataset.delreg); aberto = registros.some(r => r.data === iso) ? iso : null; desenharPainel(); atualizarResumo();
    } catch (e) { toast(traduzirErro(e), "erro"); }
  });
  for (const r of rs) carregarComentarios(r);
}

async function carregarComentarios(r) {
  const box = document.getElementById("com-" + r.id); if (!box) return;
  let cs = [];
  try { cs = (await getDocs(query(collection(db, "acessibilidadePrivado", atual.email, "diario", r.id, "comentarios"), orderBy("criadoEm")))).docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { box.innerHTML = `<p class="pequeno erro-texto">${esc(traduzirErro(e))}</p>`; return; }
  const prof = ctx.podeEditar();
  const itens = prof ? ITENS_PROF : ITENS_PROF.filter(x => x.id === "comentario");
  box.innerHTML = `<h4>💬 Comentários${cs.length ? ` (${cs.length})` : ""}</h4>` + cs.map(c => `<div class="comentario${c.papel === "inclusao" ? " da-aux" : ""}">
      <div class="pequeno"><b>${esc(c.autorNome || c.autor)}</b> · ${c.papel === "inclusao" ? "auxiliar de inclusão" : esc(c.papel || "")} · ${dataBR(c.criadoEm)}
        ${c.autor === ctx.eu.email ? `<button type="button" class="discreto mini perigo-txt" data-delcom="${c.id}" aria-label="Apagar comentário">🗑</button>` : ""}</div>
      <dl>${ITENS_PROF.filter(it => respondido(it, c.respostas)).map(it => `<div><dt>${esc(it.rot)}</dt><dd>${valorHTML(it, c.respostas[it.id])}</dd></div>`).join("")}</dl></div>`).join("") +
    `<details class="novo-com"${prof && !cs.length ? " open" : ""}><summary>${prof ? "➕ Comentar este registro" : "➕ Responder"}</summary>
      <p class="pequeno">${prof ? "Você não muda o registro da auxiliar: deixa sua visão da aula. Nada é obrigatório; preencha o que fizer sentido." : "Responda aos comentários dos professores."}</p>
      <div class="form-com">${itens.map(it => campoHTML(it, {}, "c" + r.id)).join("")}</div>
      <button type="button" class="mini" data-enviarcom="${esc(r.id)}">Enviar comentário</button></details>`;
  const resp = {};
  ligarCampos(box.querySelector(".form-com"), resp, itens);
  box.querySelector("[data-enviarcom]").onclick = async ev => {
    if (!itens.some(it => respondido(it, resp))) return toast("Preencha pelo menos um campo.", "erro");
    ev.target.disabled = true;
    try {
      await addDoc(collection(db, "acessibilidadePrivado", atual.email, "diario", r.id, "comentarios"),
        { autor: ctx.eu.email, autorNome: ctx.eu.nome || ctx.eu.email, papel: ctx.eu.papel, respostas: limpar(resp, itens), criadoEm: serverTimestamp() });
      await updateDoc(doc(colDiario(atual.email), r.id), { nComentarios: increment(1), ultimoComentarioEm: serverTimestamp() }).catch(() => {});
      r.nComentarios = (r.nComentarios || 0) + 1;
      toast("Comentário enviado 💬", "ok"); carregarComentarios(r);
    } catch (e) { toast(traduzirErro(e), "erro"); ev.target.disabled = false; }
  };
  box.querySelectorAll("[data-delcom]").forEach(b => b.onclick = async () => {
    if (!(await confirmar("Apagar o seu comentário?", { titulo: "Apagar comentário", ok: "Apagar", perigo: true }))) return;
    try {
      await deleteDoc(doc(db, "acessibilidadePrivado", atual.email, "diario", r.id, "comentarios", b.dataset.delcom));
      await updateDoc(doc(colDiario(atual.email), r.id), { nComentarios: increment(-1) }).catch(() => {});
      r.nComentarios = Math.max(0, (r.nComentarios || 1) - 1); carregarComentarios(r);
    } catch (e) { toast(traduzirErro(e), "erro"); }
  });
}

// ---------- campos (formulário do diário e do comentário) ----------
function materiasDoAluno(iso) {
  const sem = semestreDe(iso), ids = new Set(turmasAluno.map(t => t.turmaId));
  return planos.filter(p => ids.has(p.turmaId) && p.semestre === sem).sort((a, b) => a.materia.localeCompare(b.materia, "pt-BR"));
}
function campoHTML(it, r, pre = "", iso = hojeISO()) {
  const v = r[it.id], id = `${pre}_${it.id}`;
  const cab = `<div class="campo-rot" id="${id}_r">${esc(it.rot)}${it.obrig ? ` <span class="obrig" title="importante">*</span>` : ""}</div>${it.dica && it.tipo !== "texto" ? `<p class="pequeno campo-dica">${esc(it.dica)}</p>` : ""}`;
  let corpo = "";
  if (it.tipo === "emoji") corpo = `<div class="op-emoji" role="radiogroup" aria-labelledby="${id}_r">${HUMOR.map(h => `<button type="button" role="radio" aria-checked="${v === h.v}" class="${v === h.v ? "sel" : ""}" data-c="${it.id}" data-v="${h.v}"><span>${h.e}</span><small>${h.r}</small></button>`).join("")}</div>`;
  else if (it.tipo === "escala") corpo = `<div class="op-escala" role="radiogroup" aria-labelledby="${id}_r">${it.rotulos.map((rt, i) => `<button type="button" role="radio" aria-checked="${v === i + 1}" class="${v >= i + 1 ? "cheio" : ""}${v === i + 1 ? " sel" : ""}" data-c="${it.id}" data-v="${i + 1}"><b>${it.icone || ""}${i + 1}</b><small>${esc(rt)}</small></button>`).join("")}</div>`;
  else if (it.tipo === "escolha") corpo = `<div class="op-pilulas" role="radiogroup" aria-labelledby="${id}_r">${it.opcoes.map(([k, rt]) => `<button type="button" role="radio" aria-checked="${v === k}" class="${v === k ? "sel" : ""}" data-c="${it.id}" data-v="${esc(k)}">${esc(rt)}</button>`).join("")}</div>`;
  else if (it.tipo === "chips") corpo = `<div class="op-pilulas" role="group" aria-labelledby="${id}_r">${it.opcoes.map(o => `<button type="button" aria-pressed="${(v || []).includes(o)}" class="${(v || []).includes(o) ? "sel" : ""}" data-c="${it.id}" data-chip="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
  else if (it.tipo === "estrelas") corpo = `<div class="op-estrelas" role="radiogroup" aria-labelledby="${id}_r">${[1, 2, 3, 4, 5].map(i => `<button type="button" role="radio" aria-checked="${v === i}" aria-label="${i} estrela(s)" class="${v >= i ? "sel" : ""}" data-c="${it.id}" data-v="${i}">★</button>`).join("")}</div>`;
  else if (it.tipo === "materia1") { const ms = materiasDoAluno(iso).map(p => p.materia); corpo = `<input type="text" data-c="${it.id}" list="${id}_l" value="${esc(v || "")}" aria-labelledby="${id}_r" placeholder="Ex.: Banco de Dados"><datalist id="${id}_l">${ms.map(m => `<option value="${esc(m)}">`).join("")}</datalist>`; }
  else if (it.tipo === "materias") corpo = `<div class="op-materias" data-materias="${it.id}"></div>`;
  else corpo = `<textarea data-c="${it.id}" aria-labelledby="${id}_r" placeholder="${esc(it.dica || "")}">${esc(v || "")}</textarea>`;
  return `<div class="campo-diario" data-campo="${it.id}">${cab}${corpo}</div>`;
}
// liga os cliques; r = objeto das respostas (mudado no lugar); aoMudar chamado a cada mudança
function ligarCampos(raiz, r, itens, aoMudar = () => {}, iso = hojeISO()) {
  raiz.querySelectorAll("[data-c][data-v]").forEach(b => b.onclick = () => {
    const it = itens.find(x => x.id === b.dataset.c), num = ["emoji", "escala", "estrelas"].includes(it.tipo);
    const val = num ? Number(b.dataset.v) : b.dataset.v;
    r[it.id] = r[it.id] === val ? null : val;   // clicar de novo desmarca
    raiz.querySelectorAll(`[data-c="${it.id}"][data-v]`).forEach(x => {
      const xv = num ? Number(x.dataset.v) : x.dataset.v, sel = xv === r[it.id];
      x.classList.toggle("sel", it.tipo === "estrelas" ? r[it.id] >= xv : sel);
      if (it.tipo === "escala") x.classList.toggle("cheio", r[it.id] >= xv);
      x.setAttribute("aria-checked", sel);
    });
    if (it.tipo === "emoji" && r[it.id]) pulo(b);
    aoMudar(it);
  });
  raiz.querySelectorAll("[data-c][data-chip]").forEach(b => b.onclick = () => {
    const l = new Set(r[b.dataset.c] || []); l.has(b.dataset.chip) ? l.delete(b.dataset.chip) : l.add(b.dataset.chip);
    r[b.dataset.c] = [...l]; b.classList.toggle("sel"); b.setAttribute("aria-pressed", l.has(b.dataset.chip));
    aoMudar(itens.find(x => x.id === b.dataset.c));
  });
  raiz.querySelectorAll("textarea[data-c], input[data-c]").forEach(t => {
    t.oninput = () => { r[t.dataset.c] = t.value; if (t.tagName === "TEXTAREA") crescer(t); aoMudar(itens.find(x => x.id === t.dataset.c)); };
    if (t.tagName === "TEXTAREA") crescer(t);
  });
  raiz.querySelectorAll("[data-materias]").forEach(box => desenharMaterias(box, r, iso, aoMudar));
}
const crescer = t => { t.style.height = "auto"; t.style.height = Math.min(400, Math.max(72, t.scrollHeight + 2)) + "px"; };
function pulo(el) { el.classList.remove("pulo"); void el.offsetWidth; el.classList.add("pulo"); }
// matérias do plano da turma (semestre do dia) com os tópicos; "outra" para matéria sem plano
function desenharMaterias(box, r, iso, aoMudar) {
  const id = box.dataset.materias, sel = r[id] ||= [], ps = materiasDoAluno(iso);
  const tem = m => sel.find(x => chaveTexto(x.materia) === chaveTexto(m));
  const nomes = [...ps.map(p => p.materia), ...sel.map(x => x.materia).filter(m => !ps.some(p => chaveTexto(p.materia) === chaveTexto(m)))];
  box.innerHTML = `<div class="op-pilulas">${nomes.map(m => `<button type="button" class="${tem(m) ? "sel" : ""}" aria-pressed="${!!tem(m)}" data-mat="${esc(m)}">📚 ${esc(m)}</button>`).join("")}
      <span class="mat-outra"><input type="text" placeholder="+ outra matéria" aria-label="Outra matéria"><button type="button" class="leve mini">Adicionar</button></span></div>
    ${!ps.length ? `<p class="pequeno">A turma não tem plano de ensino cadastrado neste semestre (aba Organização): escreva o nome da matéria.</p>` : ""}
    ${sel.map(x => { const p = ps.find(p => chaveTexto(p.materia) === chaveTexto(x.materia)); return p?.topicos?.length ? `<div class="mat-topicos"><span class="pequeno">Tópicos de <b>${esc(x.materia)}</b>:</span>
      ${p.topicos.map(t => `<button type="button" class="tp${x.topicos?.includes(t.nome) ? " sel" : ""}" aria-pressed="${!!x.topicos?.includes(t.nome)}" data-tmat="${esc(x.materia)}" data-top="${esc(t.nome)}">${esc(t.nome)}</button>`).join("")}</div>` : ""; }).join("")}`;
  box.querySelectorAll("[data-mat]").forEach(b => b.onclick = () => {
    const m = b.dataset.mat, i = sel.findIndex(x => chaveTexto(x.materia) === chaveTexto(m));
    i >= 0 ? sel.splice(i, 1) : sel.push({ materia: m, topicos: [] });
    desenharMaterias(box, r, iso, aoMudar); aoMudar({ id });
  });
  box.querySelectorAll("[data-tmat]").forEach(b => b.onclick = () => {
    const x = tem(b.dataset.tmat), l = new Set(x.topicos || []); l.has(b.dataset.top) ? l.delete(b.dataset.top) : l.add(b.dataset.top);
    x.topicos = [...l]; b.classList.toggle("sel"); b.setAttribute("aria-pressed", l.has(b.dataset.top)); aoMudar({ id });
  });
  const inp = box.querySelector(".mat-outra input"), add = () => { const m = inp.value.trim(); if (m && !tem(m)) sel.push({ materia: m, topicos: [] }); desenharMaterias(box, r, iso, aoMudar); aoMudar({ id }); };
  box.querySelector(".mat-outra button").onclick = add;
  inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); add(); } };
}
// só os campos do modelo, sem vazios
function limpar(r, itens) {
  const o = {};
  for (const it of itens) if (respondido(it, r) && visivel(it, r)) o[it.id] = typeof r[it.id] === "string" ? r[it.id].trim().slice(0, 4000) : r[it.id];
  return o;
}

// ---------- editor do dia (em etapas) ----------
const chaveRascunho = iso => `diario:${atual.email}:${iso}:${ctx.eu.email}`;
// atalhos: ontem e as últimas aulas sem registro (até 2)
function atalhosDias() {
  const tem = new Set(registros.map(r => r.data)), out = [], d = new Date();
  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1); const isoOntem = isoDe(ontem);
  out.push([isoOntem, `Ontem${tem.has(isoOntem) ? " ✓" : ""}`]);
  for (let i = 1; i < 30 && out.length < 3; i++) {
    d.setDate(d.getDate() - 1); const iso = isoDe(d);
    if (iso !== isoOntem && ehDiaDeAula(iso) && !tem.has(iso)) out.push([iso, `⚠ ${DIAS[d.getDay()]} ${dataCurta(iso).slice(0, 5)} sem registro`]);
  }
  return out;
}
// outro dia / dia sem aula: pergunta o motivo e se quer preencher o diário ou só justificar
async function iniciarRegistro(iso) {
  if (!podeRegistrar()) return;
  if (iso > hojeISO()) return toast("Não dá para registrar um dia que ainda não chegou.", "erro");
  const meu = registros.find(r => r.data === iso && r.autor === ctx.eu.email);
  if (meu) return meu.tipo === "justificativa" ? (aberto = iso, desenharPainel()) : abrirEditor(iso, meu.outroDia || null);
  if (iso === hojeISO() && ehDiaDeAula(iso)) return abrirEditor(iso);
  const aula = ehDiaDeAula(iso);
  let escolha = null;
  const html = `<p style="margin-top:0"><b>${dataLonga(iso)}</b> ${aula ? "é dia de aula" : `<span class="tag aviso">não é dia de aula da turma${diasAulaAluno().length ? ` (${rotuloDias(diasAulaAluno())})` : ""}</span>`}. Por que você vai registrar este dia?</p>
    <div class="op-pilulas op-motivos" role="radiogroup" aria-label="Motivo">${Object.entries(MOTIVOS).filter(([k]) => aula || k !== "atrasado").map(([k, [e, t]]) => `<button type="button" role="radio" aria-checked="false" data-motivo="${k}">${e} ${esc(t)}</button>`).join("")}</div>
    <label for="jTexto" style="margin-top:12px">Explique (opcional)</label>
    <textarea id="jTexto" style="min-height:70px" placeholder="Ex.: atestado médico; palestra no auditório; esqueci de registrar na hora."></textarea>
    <p class="pequeno">Depois você escolhe: <b>preencher o diário</b> deste dia ou <b>só deixar a justificativa</b> registrada.</p>`;
  const ok = await modal({ titulo: "📆 Registrar outro dia", conteudo: html, ok: "📝 Preencher o diário", cancelar: "Cancelar", largo: true,
    aoAbrir: caixa => {
      const so = document.createElement("button"); so.type = "button"; so.className = "leve"; so.textContent = "✔ Só justificar";
      caixa.querySelector(".modal-acoes").insertBefore(so, caixa.querySelector("[data-r='1']"));
      caixa.querySelectorAll("[data-motivo]").forEach(b => b.onclick = () => {
        escolha = { motivo: b.dataset.motivo };
        caixa.querySelectorAll("[data-motivo]").forEach(x => { x.classList.toggle("sel", x === b); x.setAttribute("aria-checked", x === b); });
      });
      so.onclick = async () => {
        if (!escolha) return toast("Escolha o motivo.", "erro");
        so.disabled = true;
        try { await salvarJustificativa(iso, escolha.motivo, $("#jTexto", caixa).value.trim()); caixa.querySelector("[data-r='0']").click(); }
        catch (e) { so.disabled = false; toast(traduzirErro(e), "erro"); }
      };
    },
    antesDeConfirmar: caixa => { if (!escolha) { toast("Escolha o motivo.", "erro"); return false; } escolha.texto = $("#jTexto", caixa).value.trim(); return true; } });
  if (ok && escolha) abrirEditor(iso, escolha);
}
async function salvarJustificativa(iso, motivo, texto) {
  const id = `${iso}_${ctx.eu.email}`;
  const dados = { data: iso, tipo: "justificativa", motivo, texto: texto.slice(0, 1000), autor: ctx.eu.email, autorNome: ctx.eu.nome || ctx.eu.email, papel: ctx.eu.papel,
    respostas: {}, completo: 0, nComentarios: 0, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() };
  await setDoc(doc(colDiario(atual.email), id), dados);
  registros = [{ id, ...dados, atualizadoEm: { toDate: () => new Date() } }, ...registros.filter(r => r.id !== id)].sort((a, b) => b.data.localeCompare(a.data));
  toast("Justificativa registrada.", "ok");
  aberto = iso; mes = iso.slice(0, 7); desenharPainel(); atualizarResumo();
}
function abrirEditor(iso, outroDia = null) {
  if (!podeRegistrar()) return;
  if (iso > hojeISO()) return toast("Não dá para registrar um dia que ainda não chegou.", "erro");
  const id = `${iso}_${ctx.eu.email}`, existente = registros.find(r => r.id === id);
  let rasc = null; try { rasc = JSON.parse(localStorage.getItem(chaveRascunho(iso)) || "null"); } catch (e) { /* sem rascunho */ }
  const r = structuredClone(rasc || existente?.respostas || {});
  let passo = 0;
  const box = $("#diarioPainel");
  const desenhar = () => {
    const s = SECOES_AUX[passo], pct = completude(r);
    box.innerHTML = `<section class="card editor-diario" style="--cor:${s.cor}">
      <div class="ed-topo"><div><h2>${existente ? "✎ Editando" : "✍ Diário de"} ${esc(atual.nome || atual.email)}</h2><span class="pequeno">${dataLonga(iso)}${rasc ? " · rascunho recuperado" : ""}</span></div>
        <button type="button" class="discreto mini" id="edSair">✕ Sair</button></div>
      <div class="ed-progresso" aria-label="Registro ${pct}% preenchido"><i style="width:${pct}%"></i><span>${pct}% preenchido ${pct >= 100 ? "🌟" : ""}</span></div>
      <nav class="ed-passos" aria-label="Etapas">${SECOES_AUX.map((x, i) => {
        const ok = x.itens.filter(it => visivel(it, r)).every(it => !it.obrig || respondido(it, r)) && x.itens.some(it => respondido(it, r));
        return `<button type="button" class="${i === passo ? "atual" : ""}${ok ? " feito" : ""}" data-passo="${i}" style="--cor:${x.cor}" aria-current="${i === passo ? "step" : "false"}"><span>${ok && i !== passo ? "✓" : x.icone}</span><small>${esc(x.titulo)}</small></button>`;
      }).join("")}</nav>
      <h3 class="ed-titulo"><span>${s.icone}</span> ${esc(s.titulo)} <span class="pequeno">etapa ${passo + 1} de ${SECOES_AUX.length}</span></h3>
      <div class="ed-campos">${s.itens.filter(it => visivel(it, r)).map(it => campoHTML(it, r, "ed", iso)).join("")}</div>
      <div class="ed-acoes">${passo ? `<button type="button" class="leve" id="edVoltar">← Voltar</button>` : "<span></span>"}
        ${passo < SECOES_AUX.length - 1 ? `<button type="button" id="edProx">Próximo: ${SECOES_AUX[passo + 1].icone} ${esc(SECOES_AUX[passo + 1].titulo)} →</button>` : `<button type="button" class="ok" id="edSalvar">✓ Salvar o dia</button>`}</div>
      <p class="pequeno ed-rodape">Tudo fica salvo neste computador enquanto você preenche. Os campos com * são os mais importantes; o resto ajuda os relatórios e as provas.</p>
    </section>`;
    ligarCampos(box.querySelector(".ed-campos"), r, ITENS_AUX, it => {
      localStorage.setItem(chaveRascunho(iso), JSON.stringify(r));
      const p = completude(r); box.querySelector(".ed-progresso i").style.width = p + "%"; box.querySelector(".ed-progresso span").textContent = `${p}% preenchido ${p >= 100 ? "🌟" : ""}`;
      if (it && ITENS_AUX.some(x => x.seCampo?.[0] === it.id)) desenhar();   // mostra/esconde perguntas dependentes
    }, iso);
    box.querySelectorAll("[data-passo]").forEach(b => b.onclick = () => { passo = Number(b.dataset.passo); desenhar(); topo(); });
    $("#edVoltar")?.addEventListener("click", () => { passo--; desenhar(); topo(); });
    $("#edProx")?.addEventListener("click", () => { passo++; desenhar(); topo(); });
    $("#edSalvar")?.addEventListener("click", salvar);
    $("#edSair").onclick = async () => {
      if (localStorage.getItem(chaveRascunho(iso)) && !(await confirmar("Sair sem salvar? O rascunho fica guardado neste computador para continuar depois.", { titulo: "Sair do registro", ok: "Sair" }))) return;
      desenharPainel();
    };
  };
  const topo = () => box.scrollIntoView({ behavior: "smooth", block: "start" });
  const salvar = async () => {
    const falta = ITENS_AUX.filter(it => it.obrig && visivel(it, r) && !respondido(it, r));
    if (falta.length) {
      passo = SECOES_AUX.findIndex(s => s.itens.includes(falta[0])); desenhar();
      return toast(`Falta: ${falta.map(f => f.rot).join(" · ")}`, "erro");
    }
    const antes = medalhasDiario(resumo()).filter(m => m.ok).map(m => m.t);
    const respostas = limpar(r, ITENS_AUX), dados = { data: iso, tipo: "diario", autor: ctx.eu.email, autorNome: ctx.eu.nome || ctx.eu.email, papel: ctx.eu.papel,
      respostas, completo: completude(respostas), outroDia: outroDia || null, atualizadoEm: serverTimestamp() };
    $("#edSalvar").disabled = true;
    try {
      if (existente) await updateDoc(doc(colDiario(atual.email), id), { ...dados, motivo: null, texto: null });
      else await setDoc(doc(colDiario(atual.email), id), { ...dados, nComentarios: 0, criadoEm: serverTimestamp() });
    } catch (e) { $("#edSalvar").disabled = false; return toast(String(e?.code || "").endsWith("permission-denied") ? "Sem permissão: publique o firestore.rules atual." : traduzirErro(e), "erro"); }
    localStorage.removeItem(chaveRascunho(iso));
    const novo = { id, ...dados, nComentarios: existente?.nComentarios || 0, atualizadoEm: { toDate: () => new Date() } };
    registros = [novo, ...registros.filter(x => x.id !== id)].sort((a, b) => b.data.localeCompare(a.data));
    const ganhou = medalhasDiario(resumo()).filter(m => m.ok && !antes.includes(m.t));
    festa(respostas, ganhou);
    aberto = iso; mes = iso.slice(0, 7); desenharPainel(); atualizarResumo();
  };
  desenhar(); topo();
}

// comemoração ao salvar: confete de emojis e a medalha nova que a aluna ganhou
function festa(resp, ganhou) {
  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const f = document.createElement("div");
  f.className = "festa-diario"; f.setAttribute("role", "status");
  const emojis = ["⭐", "🎉", humorEmoji(resp.humorSaida) || "😊", "💪", "✨", "🏆"];
  f.innerHTML = (reduz ? "" : Array.from({ length: 28 }, (_, i) => `<span class="conf" style="left:${Math.random() * 100}%;animation-delay:${Math.random() * .6}s;font-size:${18 + Math.random() * 22}px">${emojis[i % emojis.length]}</span>`).join("")) +
    `<div class="festa-caixa"><div class="festa-grande">${ganhou.length ? ganhou[0].e : "📔"}</div><b>Registro salvo!</b>
      ${ganhou.map(m => `<p>🏅 ${esc(atual.nome?.split(" ")[0] || "A aluna")} ganhou a medalha <b>${esc(m.t)}</b>!</p>`).join("")}
      ${resp.conquista ? `<p class="pequeno">🏆 ${esc(String(resp.conquista).slice(0, 120))}</p>` : ""}</div>`;
  document.body.appendChild(f);
  const fechar = () => f.remove();
  f.onclick = fechar; setTimeout(fechar, ganhou.length ? 4200 : 2600);
}

// ---------- relatório formal (para coordenação, direção, sede) ----------
async function relatorioFormal() {
  const h = hojeISO(), ini = n => { const d = new Date(); d.setDate(d.getDate() - n); return isoDe(d); };
  const sem = semestreDe(), semIni = `${sem.slice(0, 4)}-${sem.endsWith("1") ? "01" : "07"}-01`;
  const html = `<div class="grade">
      <div><label for="rfPeriodo">Período</label><select id="rfPeriodo">
        <option value="${ini(6)}|${h}">Últimos 7 dias</option><option value="${h.slice(0, 7)}-01|${h}" selected>Este mês</option>
        <option value="${ini(29)}|${h}">Últimos 30 dias</option><option value="${semIni}|${h}">Este semestre</option><option value="outro">Escolher datas…</option></select></div>
      <div><label for="rfDe">De</label><input type="date" id="rfDe" value="${h.slice(0, 7)}-01" max="${h}"></div>
      <div><label for="rfAte">Até</label><input type="date" id="rfAte" value="${h}" max="${h}"></div></div>
    <label class="check"><input type="checkbox" id="rfComentarios" checked> <span>Incluir os comentários dos professores</span></label>
    <label class="check"><input type="checkbox" id="rfDiario" checked> <span>Incluir o registro dia a dia (anexo)</span></label>
    <label class="check"><input type="checkbox" id="rfSaude"> <span>Incluir "algo fora da rotina" (saúde, sono, medicação, família) <span class="pequeno">— informação sensível: só marque se o destinatário precisar</span></span></label>
    <label for="rfConsid" style="margin-top:12px">Considerações finais da auxiliar (opcional)</label>
    <textarea id="rfConsid" style="min-height:90px" placeholder="Síntese do período, avanços observados, encaminhamentos sugeridos…"></textarea>
    <label for="rfDest" style="margin-top:12px">Destinatário (opcional)</label><input type="text" id="rfDest" placeholder="Ex.: Direção da unidade / Coordenação pedagógica">`;
  let op = null;
  const ok = await modal({ titulo: "📄 Relatório formal de acompanhamento", conteudo: html, ok: "Gerar PDF", cancelar: "Cancelar", largo: true,
    aoAbrir: c => { $("#rfPeriodo", c).onchange = () => { const v = $("#rfPeriodo", c).value; if (v !== "outro") { const [a, b] = v.split("|"); $("#rfDe", c).value = a; $("#rfAte", c).value = b; } }; },
    antesDeConfirmar: c => {
      op = { de: $("#rfDe", c).value, ate: $("#rfAte", c).value, coment: $("#rfComentarios", c).checked, diario: $("#rfDiario", c).checked, saude: $("#rfSaude", c).checked,
        consid: $("#rfConsid", c).value.trim(), dest: $("#rfDest", c).value.trim() };
      if (!op.de || !op.ate || op.de > op.ate) { toast("Confira as datas do período.", "erro"); return false; }
      return true;
    } });
  if (!ok) return;
  const w = window.open("", "_blank");
  if (!w) return toast("O navegador bloqueou a janela. Libere pop-ups para este site.", "erro");
  w.document.write("<p style='font-family:sans-serif'>Montando o relatório…</p>");
  const rs = registros.filter(r => r.data >= op.de && r.data <= op.ate).sort((a, b) => a.data.localeCompare(b.data));
  const diarios = rs.filter(r => r.tipo !== "justificativa"), justs = rs.filter(r => r.tipo === "justificativa");
  const coments = {};
  if (op.coment) await Promise.all(rs.filter(r => r.nComentarios).map(async r => {
    coments[r.id] = (await getDocs(collection(db, "acessibilidadePrivado", atual.email, "diario", r.id, "comentarios")).catch(() => null))?.docs.map(d => d.data()) || [];
  }));
  // dias de aula previstos no período
  let previstos = 0; for (let d = dia(op.de); isoDe(d) <= op.ate; d.setDate(d.getDate() + 1)) if (ehDiaDeAula(isoDe(d))) previstos++;
  const semAula = justs.filter(j => j.motivo === "semAula").length, faltas = justs.filter(j => j.motivo === "faltou").length;
  const med = id => { const l = diarios.map(r => Number(r.respostas?.[id])).filter(Boolean); return l.length ? (l.reduce((s, x) => s + x, 0) / l.length) : null; };
  const nivel = (it, v) => v == null ? "—" : `${v.toFixed(1)} / 5 — ${it.rotulos ? it.rotulos[Math.max(0, Math.min(4, Math.round(v) - 1))] : HUMOR[Math.max(0, Math.min(4, Math.round(v) - 1))].r}`;
  const conta = id => { const c = {}; diarios.forEach(r => (r.respostas?.[id] || []).forEach(x => c[x] = (c[x] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
  const mats = {}; diarios.forEach(r => (r.respostas?.materias || []).forEach(m => { const x = mats[m.materia] ||= { aulas: 0, topicos: {} }; x.aulas++; (m.topicos || []).forEach(t => x.topicos[t] = (x.topicos[t] || 0) + 1); }));
  const sobre = { leve: diarios.filter(r => r.respostas?.sobrecarga === "leve").length, sim: diarios.filter(r => r.respostas?.sobrecarga === "sim").length };
  const it = id => ITENS_AUX.find(x => x.id === id);
  const p = s => esc(s || "").replace(/\n/g, "<br>");
  const auxiliares = [...new Set(rs.map(r => r.autorNome || r.autor))];
  const turma = turmasAluno.map(t => `${t.turma}${rotuloDias(t.diasAula) ? ` (aulas: ${rotuloDias(t.diasAula)})` : ""}`).join(", ") || "—";
  const linhaInd = id => `<tr><td>${esc(it(id).rot)}</td><td>${nivel(it(id), med(id))}</td></tr>`;
  const corpo = `
  <header class="cab"><div class="marca">SENAI</div><div><h1>Relatório de acompanhamento pedagógico</h1><div class="sub">Educação inclusiva · Registro da auxiliar de inclusão</div></div></header>
  <table class="ident">
    <tr><th>Aluno(a)</th><td>${esc(atual.nome || atual.email)}</td><th>Turma</th><td>${esc(turma)}</td></tr>
    <tr><th>Período</th><td>${dataCurta(op.de)} a ${dataCurta(op.ate)}</td><th>Horário</th><td>${esc(textoHorario(ctx.horario?.()))}</td></tr>
    <tr><th>Responsável(is) pelo registro</th><td>${esc(auxiliares.join(", ") || "—")}</td><th>Emitido em</th><td>${new Date().toLocaleDateString("pt-BR")}</td></tr>
    ${op.dest ? `<tr><th>Destinatário</th><td colspan="3">${esc(op.dest)}</td></tr>` : ""}
  </table>
  <h2>1. Frequência</h2>
  <table><tr><th>Dias de aula previstos</th><th>Aulas com registro</th><th>Faltas</th><th>Sem aula (feriado, evento…)</th><th>Outras justificativas</th></tr>
    <tr><td>${previstos}</td><td>${diarios.length}</td><td>${faltas}</td><td>${semAula}</td><td>${justs.length - faltas - semAula}</td></tr></table>
  ${justs.length ? `<p class="peq">${justs.map(j => `${dataCurta(j.data)}: ${esc(MOTIVOS[j.motivo]?.[1] || "Outro")}${j.texto ? ` — ${esc(j.texto)}` : ""}`).join(" · ")}</p>` : ""}
  <h2>2. Indicadores do período <span class="peq">(média dos registros, escala de 1 a 5)</span></h2>
  <table><tr><th>Indicador</th><th>Resultado</th></tr>${["compreensao", "autonomia", "foco", "comunicacao", "humorChegada", "humorSaida", "estrelas"].map(id => id === "estrelas"
    ? `<tr><td>Avaliação geral do dia</td><td>${med("estrelas") == null ? "—" : med("estrelas").toFixed(1) + " / 5"}</td></tr>` : linhaInd(id)).join("")}</table>
  <h2>3. Conteúdos trabalhados</h2>
  ${Object.keys(mats).length ? `<table><tr><th>Matéria</th><th>Aulas</th><th>Tópicos (nº de aulas)</th></tr>${Object.entries(mats).map(([m, x]) => `<tr><td>${esc(m)}</td><td>${x.aulas}</td><td>${Object.entries(x.topicos).map(([t, n]) => `${esc(t)} (${n})`).join("; ") || "—"}</td></tr>`).join("")}</table>` : `<p class="peq">Nenhuma matéria registrada no período.</p>`}
  <h2>4. Comportamento e convivência</h2>
  <table><tr><th>Sinais de sobrecarga</th><td>${sobre.leve} leve(s) · ${sobre.sim} com crise · ${diarios.length - sobre.leve - sobre.sim} sem sinais ou não informado</td></tr>
    <tr><th>Possíveis causas observadas</th><td>${conta("gatilhos").map(([k, n]) => `${esc(k)} (${n})`).join("; ") || "—"}</td></tr>
    <tr><th>Interações</th><td>${conta("interacao").map(([k, n]) => `${esc(k)} (${n})`).join("; ") || "—"}</td></tr></table>
  <h2>5. Estratégias que funcionaram</h2>
  <p>${conta("estrategias").map(([k, n]) => `${esc(k)} (${n})`).join("; ") || "—"}</p>
  ${diarios.some(r => r.respostas?.paraProvas) ? `<h2>6. Recomendações para avaliações</h2><ul>${diarios.filter(r => r.respostas?.paraProvas).map(r => `<li><b>${dataCurta(r.data)}:</b> ${p(r.respostas.paraProvas)}</li>`).join("")}</ul>` : ""}
  ${op.coment && Object.values(coments).some(l => l.length) ? `<h2>7. Observações dos professores</h2>${rs.filter(r => coments[r.id]?.length).map(r => coments[r.id].map(c => `<div class="bloco"><b>${dataCurta(r.data)} · ${esc(c.autorNome || c.autor)}${c.respostas?.materia ? ` (${esc(c.respostas.materia)})` : ""}</b>${c.respostas?.participacao ? ` · participação ${c.respostas.participacao}/5` : ""}<br>${p(c.respostas?.comentario)}${c.respostas?.sugestao ? `<br><i>Sugestão:</i> ${p(c.respostas.sugestao)}` : ""}</div>`).join("")).join("")}` : ""}
  ${op.consid ? `<h2>Considerações finais</h2><p>${p(op.consid)}</p>` : ""}
  ${op.diario && diarios.length ? `<h2 class="quebra-antes">Anexo — Registro dia a dia</h2><table class="anexo"><tr><th style="width:70px">Data</th><th>Atividades</th><th>Observações</th></tr>${diarios.map(r => `<tr><td>${dataCurta(r.data)}</td>
    <td>${(r.respostas?.materias || []).map(m => `<b>${esc(m.materia)}</b>${m.topicos?.length ? ": " + m.topicos.map(esc).join(", ") : ""}`).join("<br>")}${r.respostas?.atividades ? `<br>${p(r.respostas.atividades)}` : ""}</td>
    <td>${[r.respostas?.comportamentoTexto, r.respostas?.funcionou && "Funcionou: " + r.respostas.funcionou, r.respostas?.dificil && "Dificuldade: " + r.respostas.dificil, r.respostas?.conquista && "Conquista: " + r.respostas.conquista, op.saude && r.respostas?.foraRotina && "Fora da rotina: " + r.respostas.foraRotina].filter(Boolean).map(p).join("<br>") || "—"}</td></tr>`).join("")}</table>` : ""}
  <div class="assin"><div>${esc(auxiliares[0] || "")}<br>Auxiliar de inclusão</div><div><br>Coordenação pedagógica</div></div>
  <p class="peq rodape">Documento de uso interno, com informações pessoais do(a) aluno(a). Compartilhe apenas com quem precisa.</p>`;
  w.document.open();
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório — ${esc(atual.nome || atual.email)} — ${dataCurta(op.de)} a ${dataCurta(op.ate)}</title>
  <style>@page{size:A4;margin:16mm 14mm}body{font-family:Arial,sans-serif;font-size:10.5pt;color:#111;margin:0}
  .cab{display:flex;gap:12px;align-items:center;border-bottom:3px solid #c1272d;padding-bottom:8px;margin-bottom:12px}.marca{background:#c1272d;color:#fff;font-weight:bold;padding:6px 10px;letter-spacing:2px}
  h1{font-size:15pt;margin:0}.sub{color:#555;font-size:9.5pt}h2{font-size:11.5pt;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
  table{width:100%;border-collapse:collapse;margin:4px 0}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f1f1f1;font-weight:bold}
  .ident th{width:18%}.peq{font-size:9pt;color:#444}.bloco{border-left:3px solid #999;padding:3px 8px;margin:6px 0;page-break-inside:avoid}
  .anexo td{font-size:9.5pt}.quebra-antes{page-break-before:always}.assin{display:flex;justify-content:space-around;margin-top:48px;text-align:center}.assin div{border-top:1px solid #000;width:40%;padding-top:4px;font-size:9.5pt}
  .rodape{margin-top:18px;text-align:center}tr{page-break-inside:avoid}</style></head>
  <body>${corpo}<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
  w.document.close();
}
