// Painel → aba "Diário": o diário de cada aluno com acessibilidade.
// A auxiliar de inclusão registra o dia (perguntas em etapas, humor com carinhas, escalas, chips);
// o professor lê e comenta (modelo próprio, nada obrigatório), sem mudar o registro.
// acessibilidadePrivado/{email}/diario/{AAAA-MM-DD_autor} = { data, autor, autorNome, papel, respostas, completo, nComentarios, ... }
// acessibilidadePrivado/{email}/diario/{id}/comentarios/{c} = { autor, autorNome, papel, respostas, criadoEm }
// (o aluno nunca lê acessibilidadePrivado)
import { db, esc, $, toast, confirmar, traduzirErro, iniciais, dataBR, semestreDe, chaveTexto, dataCurta } from "./common.js";
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
  box.innerHTML = `<div class="diario-alunos">` + alunos.map(a => `<button type="button" class="diario-aluno${a.email === atual?.email ? " ativo" : ""}" data-al="${esc(a.email)}">
      <span class="avatar">${esc(iniciais(a.nome || a.email))}</span><span><b>${esc(a.nome || a.email)}</b><span class="pequeno">${esc(a.email)}</span></span></button>`).join("") + `</div>`;
  box.querySelectorAll("[data-al]").forEach(b => b.onclick = () => abrirAluno(b.dataset.al));
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

// ---------- gamificação ----------
// dias úteis seguidos com registro, contando de hoje (ou do último dia útil, se hoje ainda não tem)
function sequencia() {
  const tem = new Set(registros.map(r => r.data));
  const d = new Date(); let n = 0, primeiro = true;
  for (let i = 0; i < 400; i++) {
    const dw = d.getDay();
    if (dw !== 0 && dw !== 6) {
      if (tem.has(isoDe(d))) n++;
      else if (!primeiro) break;
      primeiro = false;
    }
    d.setDate(d.getDate() - 1);
  }
  return n;
}
function medalhas() {
  const n = registros.length, seq = sequencia();
  const completos = registros.filter(r => (r.completo || 0) >= 100).length;
  const vitorias = registros.filter(r => String(r.respostas?.conquista || "").trim()).length;
  const comentados = registros.filter(r => (r.nComentarios || 0) > 0).length;
  return [
    { e: "🌱", t: "Primeiro registro", v: n, meta: 1 },
    { e: "📅", t: "Semana completa", d: "5 dias úteis seguidos", v: seq, meta: 5 },
    { e: "🔥", t: "Em chamas", d: "10 dias úteis seguidos", v: seq, meta: 10 },
    { e: "🔎", t: "Olhar atento", d: "10 registros 100% completos", v: completos, meta: 10 },
    { e: "🏆", t: "Colecionadora de vitórias", d: "10 vitórias do dia", v: vitorias, meta: 10 },
    { e: "🤝", t: "Trabalho em equipe", d: "5 registros comentados por professores", v: comentados, meta: 5 },
    { e: "📚", t: "Memória viva", d: "30 registros", v: n, meta: 30 }
  ].map(m => ({ ...m, ok: m.v >= m.meta }));
}
const media = l => l.length ? l.reduce((s, x) => s + x, 0) / l.length : null;

// ---------- painel do aluno ----------
function desenharPainel() {
  const a = atual, seq = sequencia(), meds = medalhas();
  const doMes = registros.filter(r => r.data.startsWith(mes));
  const est = media(doMes.map(r => Number(r.respostas?.estrelas)).filter(Boolean));
  const hum = media(doMes.flatMap(r => [r.respostas?.humorChegada, r.respostas?.humorSaida].map(Number).filter(Boolean)));
  const ultimos = [...new Set(registros.map(r => r.data))].slice(0, 10).reverse();
  const turma = turmasAluno.map(t => t.turma).join(", ");
  const meuHoje = registros.find(r => r.data === hojeISO() && r.autor === ctx.eu.email);
  $("#diarioPainel").innerHTML = `
  <section class="card diario-hero">
    <div class="dh-aluno"><span class="avatar grande">${esc(iniciais(a.nome || a.email))}</span>
      <div><h2>${esc(a.nome || a.email)}</h2><span class="pequeno">${turma ? `👥 ${esc(turma)} · ` : ""}${esc(a.email)}</span>
        <div class="dh-humores" title="Humor na saída, últimos registros">${ultimos.map(d => { const r = registros.find(x => x.data === d); return `<span title="${dataCurta(d)}">${humorEmoji(r?.respostas?.humorSaida || r?.respostas?.humorChegada) || "·"}</span>`; }).join("") || `<span class="pequeno">ainda sem registros</span>`}</div></div></div>
    <div class="dh-numeros">
      <div class="dh-num fogo${seq ? " aceso" : ""}"><b>🔥 ${seq}</b><span>dia(s) seguidos</span></div>
      <div class="dh-num"><b>📒 ${registros.length}</b><span>registros</span></div>
      <div class="dh-num"><b>${est ? "⭐ " + est.toFixed(1) : "—"}</b><span>estrelas no mês</span></div>
      <div class="dh-num"><b>${hum ? humorEmoji(Math.round(hum)) + " " + hum.toFixed(1) : "—"}</b><span>humor no mês</span></div>
    </div>
    ${podeRegistrar() ? `<div class="dh-acao"><button id="dNovo" class="grande-btn">${meuHoje ? "✎ Continuar o registro de hoje" : "✍ Registrar o dia de hoje"}</button>
      <label class="pequeno">ou outro dia: <input type="date" id="dOutroDia" max="${hojeISO()}"></label></div>` : `<p class="pequeno dh-acao">Você lê os registros e deixa o seu comentário em cada dia. Quem escreve o diário é a auxiliar de inclusão.</p>`}
  </section>
  <section class="card">
    <h3 class="diario-h3">🏅 Medalhas</h3>
    <div class="medalhas">${meds.map(m => `<div class="medalha${m.ok ? " ganha" : ""}" title="${esc(m.d || m.t)}"><span class="m-emoji">${m.e}</span><b>${esc(m.t)}</b>
      <span class="pequeno">${m.ok ? "conquistada!" : `${Math.min(m.v, m.meta)}/${m.meta}`}</span>${m.ok ? "" : `<i class="m-barra"><i style="width:${Math.round(Math.min(m.v, m.meta) / m.meta * 100)}%"></i></i>`}</div>`).join("")}</div>
  </section>
  <div class="diario-grade">
    <section class="card diario-cal">${calendarioHTML()}</section>
    <section class="card" id="dDetalhe">${aberto ? "" : ultimosHTML()}</section>
  </div>`;
  $("#dNovo")?.addEventListener("click", () => abrirEditor(hojeISO()));
  const od = $("#dOutroDia"); if (od) od.onchange = () => { if (od.value) abrirEditor(od.value); };
  ligarCalendario();
  if (aberto) mostrarDia(aberto);
  else ligarUltimos();
}

function calendarioHTML() {
  const [ano, m] = mes.split("-").map(Number), primeiro = new Date(ano, m - 1, 1), ndias = new Date(ano, m, 0).getDate();
  const porDia = {}; registros.filter(r => r.data.startsWith(mes)).forEach(r => (porDia[r.data] ||= []).push(r));
  let cel = Array(primeiro.getDay()).fill(`<span class="cal-vazio"></span>`);
  for (let d = 1; d <= ndias; d++) {
    const iso = `${mes}-${String(d).padStart(2, "0")}`, rs = porDia[iso] || [], r = rs[0], fds = [0, 6].includes(new Date(ano, m - 1, d).getDay());
    const coment = rs.reduce((s, x) => s + (x.nComentarios || 0), 0);
    cel.push(`<button type="button" class="cal-dia${rs.length ? " tem" : ""}${iso === hojeISO() ? " hoje" : ""}${fds ? " fds" : ""}${iso === aberto ? " aberto" : ""}" data-dia="${iso}" ${!rs.length && !podeRegistrar() ? "disabled" : ""}
      aria-label="${dataLonga(iso)}${rs.length ? ", com registro" : ""}"><span class="cal-n">${d}</span>${r ? `<span class="cal-emoji">${humorEmoji(r.respostas?.humorSaida || r.respostas?.humorChegada) || "📝"}</span>` : ""}
      ${coment ? `<span class="cal-com" title="${coment} comentário(s)">💬${coment}</span>` : ""}</button>`);
  }
  return `<div class="cal-topo"><button type="button" class="leve mini" data-mes="-1" aria-label="Mês anterior">◀</button><h3>${MESES[m - 1]} ${ano}</h3><button type="button" class="leve mini" data-mes="1" aria-label="Próximo mês">▶</button></div>
    <div class="cal-grade">${DIAS.map(x => `<span class="cal-sem">${x}</span>`).join("")}${cel.join("")}</div>
    <p class="pequeno cal-leg">A carinha é o humor na saída · 💬 comentários dos professores</p>`;
}
function ligarCalendario() {
  document.querySelectorAll("[data-mes]").forEach(b => b.onclick = () => {
    const [a, m] = mes.split("-").map(Number), d = new Date(a, m - 1 + Number(b.dataset.mes), 1);
    mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; desenharPainel();
  });
  document.querySelectorAll("[data-dia]").forEach(b => b.onclick = () => {
    const iso = b.dataset.dia;
    if (registros.some(r => r.data === iso)) { aberto = iso; desenharPainel(); $("#dDetalhe").scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (podeRegistrar() && iso <= hojeISO()) abrirEditor(iso);
  });
}
function ultimosHTML() {
  const rs = registros.slice(0, 6);
  return `<h3 class="diario-h3">🗒 Últimos registros</h3>` + (rs.length ? rs.map(r => `<button type="button" class="ult-reg" data-dia-reg="${r.data}">
    <span class="ult-emoji">${humorEmoji(r.respostas?.humorSaida || r.respostas?.humorChegada) || "📝"}</span>
    <span><b>${dataLonga(r.data)}</b> <span class="pequeno">· ${esc(r.autorNome || r.autor)}${r.nComentarios ? ` · 💬 ${r.nComentarios}` : ""}</span>
    <span class="pequeno ult-txt">${esc(String(r.respostas?.atividades || r.respostas?.conquista || "").slice(0, 120))}</span></span>
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
        ${meu && podeRegistrar() ? `<span><button type="button" class="leve mini" data-editreg="${esc(r.data)}">✎ Editar</button> <button type="button" class="discreto mini perigo-txt" data-delreg="${esc(r.id)}">🗑</button></span>` : ""}</div>
      ${SECOES_AUX.map(s => {
        const its = s.itens.filter(it => visivel(it, r.respostas) && respondido(it, r.respostas));
        return its.length ? `<div class="reg-secao" style="--cor:${s.cor}"><h4>${s.icone} ${esc(s.titulo)}</h4><dl>${its.map(it => `<div><dt>${esc(it.rot)}</dt><dd>${valorHTML(it, r.respostas[it.id])}</dd></div>`).join("")}</dl></div>` : "";
      }).join("")}
      <div class="comentarios" id="com-${esc(r.id)}"><p class="pequeno">Carregando comentários…</p></div>
    </article>`;
  }).join("");
  $("#dFechar").onclick = () => { aberto = null; desenharPainel(); };
  box.querySelectorAll("[data-editreg]").forEach(b => b.onclick = () => abrirEditor(b.dataset.editreg));
  box.querySelectorAll("[data-delreg]").forEach(b => b.onclick = async () => {
    if (!(await confirmar("Apagar este registro do diário? Os comentários dele também somem.", { titulo: "Apagar registro", ok: "Apagar", perigo: true }))) return;
    try {
      const cs = await getDocs(collection(db, "acessibilidadePrivado", atual.email, "diario", b.dataset.delreg, "comentarios"));
      await Promise.all(cs.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(colDiario(atual.email), b.dataset.delreg));
      registros = registros.filter(r => r.id !== b.dataset.delreg); aberto = registros.some(r => r.data === iso) ? iso : null; desenharPainel();
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
function abrirEditor(iso) {
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
    const antes = { seq: sequencia(), meds: medalhas().filter(m => m.ok).map(m => m.t) };
    const respostas = limpar(r, ITENS_AUX), dados = { data: iso, autor: ctx.eu.email, autorNome: ctx.eu.nome || ctx.eu.email, papel: ctx.eu.papel,
      respostas, completo: completude(respostas), atualizadoEm: serverTimestamp() };
    $("#edSalvar").disabled = true;
    try {
      if (existente) await updateDoc(doc(colDiario(atual.email), id), dados);
      else await setDoc(doc(colDiario(atual.email), id), { ...dados, nComentarios: 0, criadoEm: serverTimestamp() });
    } catch (e) { $("#edSalvar").disabled = false; return toast(String(e?.code || "").endsWith("permission-denied") ? "Sem permissão: publique o firestore.rules atual." : traduzirErro(e), "erro"); }
    localStorage.removeItem(chaveRascunho(iso));
    const novo = { id, ...dados, nComentarios: existente?.nComentarios || 0, atualizadoEm: { toDate: () => new Date() } };
    registros = [novo, ...registros.filter(x => x.id !== id)].sort((a, b) => b.data.localeCompare(a.data));
    const depois = { seq: sequencia(), meds: medalhas().filter(m => m.ok) };
    const ganhou = depois.meds.filter(m => !antes.meds.includes(m.t));
    festa(respostas, depois.seq > antes.seq ? depois.seq : 0, ganhou);
    aberto = iso; mes = iso.slice(0, 7); desenharPainel();
  };
  desenhar(); topo();
}

// comemoração ao salvar: confete de emojis, sequência e medalha nova
function festa(resp, seq, ganhou) {
  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const f = document.createElement("div");
  f.className = "festa-diario"; f.setAttribute("role", "status");
  const emojis = ["⭐", "🎉", humorEmoji(resp.humorSaida) || "😊", "💪", "✨", "🏆"];
  f.innerHTML = (reduz ? "" : Array.from({ length: 28 }, (_, i) => `<span class="conf" style="left:${Math.random() * 100}%;animation-delay:${Math.random() * .6}s;font-size:${18 + Math.random() * 22}px">${emojis[i % emojis.length]}</span>`).join("")) +
    `<div class="festa-caixa"><div class="festa-grande">${ganhou.length ? ganhou[0].e : "📔"}</div><b>Registro salvo!</b>
      ${seq ? `<p>🔥 ${seq} dia(s) seguido(s) de diário</p>` : ""}
      ${ganhou.map(m => `<p>🏅 Medalha nova: <b>${esc(m.t)}</b></p>`).join("")}
      ${resp.conquista ? `<p class="pequeno">🏆 ${esc(String(resp.conquista).slice(0, 120))}</p>` : ""}</div>`;
  document.body.appendChild(f);
  const fechar = () => f.remove();
  f.onclick = fechar; setTimeout(fechar, ganhou.length ? 4200 : 2600);
}
