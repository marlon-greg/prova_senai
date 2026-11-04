// Painel → aba "Gamificação" (admin): liga e desliga cada parte, e abre a simulação "ver como aluno".
// Painel → aba "Retorno dos alunos" (professor/admin): apontamentos nas questões e sugestões para o sistema.
import { db, esc, $, toast, traduzirErro, dataBR, GAMI_PADRAO, lerGamificacao } from "./common.js";
import { CONQUISTAS_PADRAO, REGRAS, CAMPOS_DIARIO } from "./conquistas.js";
import { CATALOGO } from "./avatar.js";
import { sugerirConquistasIA } from "./ia.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let ctx = null;
export function iniciarGamificacao(c) { ctx = c; }

const OPCOES = [
  { k: "conquistas", t: "🏅 Conquistas dos alunos", d: "Medalhas gerais, por matéria e da sala de aula (diário), com nível. Aparecem na página do aluno." },
  { k: "personagem", t: "🧑‍🎨 Personagem e skins", d: "O aluno cria o próprio personagem (rosto, cabelo, roupa…). Skins, molduras e acessórios especiais são liberados pelas conquistas." },
  { k: "download", t: "🖼 Baixar o cartão do perfil", d: "O aluno baixa o cartão com o personagem e as conquistas em PNG, JPG ou PDF para mostrar aos colegas." },
  { k: "apontamentos", t: "🚩 Apontamentos nas questões", d: "Na prova e no gabarito, o aluno avisa sobre uma questão com problema (duas respostas certas, nenhuma certa, erro de digitação…). Chega em Retorno dos alunos." },
  { k: "sugestoes", t: "💡 Sugestões para o sistema", d: "Área do aluno para mandar ideias e problemas do sistema." },
  { k: "social", t: "❤️ Parte social (curtidas e parabéns)", d: "Mural da turma com o que cada aluno ESCOLHEU mostrar (conquistas e, se ele quiser, notas). Só curtidas ❤️ e parabéns 👏, sem comentários. Nada aparece sem o aluno marcar.", beta: true },
  { k: "socialNotas", t: "📊 Permitir compartilhar notas no mural", d: "Com a parte social ligada, o aluno pode escolher mostrar notas de provas. Desligado, só conquistas podem ser mostradas.", beta: true, depende: "social" }
];

export async function carregarGamificacao() {
  carregarConquistasAdmin();
  const box = $("#gamiOpcoes"), cfg = await lerGamificacao(), admin = ctx.ehAdmin();
  box.innerHTML = OPCOES.map(o => `<label class="gami-op${o.beta ? " beta" : ""}"><span class="interruptor-g"><input type="checkbox" data-k="${o.k}"${cfg[o.k] ? " checked" : ""}${admin ? "" : " disabled"}><i></i></span>
      <span><b>${o.t}</b>${o.beta ? ` <span class="tag aviso">2ª parte · começa desligado</span>` : ""}<br><span class="pequeno">${esc(o.d)}</span></span></label>`).join("") +
    (admin ? `<div class="linha acoes" style="margin-top:12px"><button id="gamiSalvar">Salvar</button><button id="gamiPadrao" class="leve">Voltar ao padrão</button></div>` : `<p class="pequeno">Só o admin muda estas opções.</p>`);
  const dep = () => box.querySelectorAll("[data-k]").forEach(c => { const o = OPCOES.find(x => x.k === c.dataset.k); if (o.depende) { const pai = box.querySelector(`[data-k="${o.depende}"]`); c.disabled = !admin || !pai.checked; if (!pai.checked) c.checked = false; } });
  box.querySelectorAll("[data-k]").forEach(c => c.onchange = dep); dep();
  $("#gamiSalvar")?.addEventListener("click", async () => {
    const dados = Object.fromEntries([...box.querySelectorAll("[data-k]")].map(c => [c.dataset.k, c.checked]));
    try { await setDoc(doc(db, "config", "gamificacao"), { ...dados, atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email }); toast("Gamificação salva. Os alunos veem a mudança ao recarregar a página.", "ok"); }
    catch (e) { toast(traduzirErro(e), "erro"); }
  });
  $("#gamiPadrao")?.addEventListener("click", () => { box.querySelectorAll("[data-k]").forEach(c => c.checked = !!GAMI_PADRAO[c.dataset.k]); dep(); });
}

// ---------- retorno dos alunos ----------
const TIPOS_AP = { duasCertas: "Mais de uma resposta certa", nenhumaCerta: "Nenhuma resposta certa", erroTexto: "Erro de digitação ou no texto", confusa: "Enunciado confuso", gabarito: "Acho que o gabarito está errado", outro: "Outro" };
export { TIPOS_AP };
let itensRet = { ap: [], sg: [] };
export async function carregarRetorno() {
  $("#retLista").innerHTML = `<p class="pequeno">Carregando…</p>`;
  try {
    const [a, s] = await Promise.all([getDocs(collection(db, "apontamentos")), getDocs(collection(db, "sugestoesSistema"))]);
    const ord = l => l.sort((x, y) => (y.criadoEm?.seconds || 0) - (x.criadoEm?.seconds || 0));
    itensRet = { ap: ord(a.docs.map(d => ({ id: d.id, col: "apontamentos", ...d.data() }))), sg: ord(s.docs.map(d => ({ id: d.id, col: "sugestoesSistema", ...d.data() }))) };
  } catch (e) { $("#retLista").innerHTML = `<p class="erro-texto">${esc(traduzirErro(e))} (Publique o firestore.rules atual.)</p>`; return; }
  ["#retBusca", "#retTipo", "#retStatus"].forEach(id => $(id).oninput = $(id).onchange = desenharRetorno);
  desenharRetorno();
}
function desenharRetorno() {
  const b = String($("#retBusca").value || "").toLowerCase(), tipo = $("#retTipo").value, st = $("#retStatus").value;
  const lista = [...(tipo !== "sg" ? itensRet.ap : []), ...(tipo !== "ap" ? itensRet.sg : [])]
    .filter(x => (!st || (st === "aberto" ? ["aberto", "aberta"].includes(x.status) : !["aberto", "aberta"].includes(x.status))))
    .filter(x => !b || `${x.nome} ${x.email} ${x.texto} ${x.provaTitulo || ""} ${x.enunciado || ""}`.toLowerCase().includes(b));
  const abertos = [...itensRet.ap, ...itensRet.sg].filter(x => ["aberto", "aberta"].includes(x.status)).length;
  $("#retContagem").textContent = `${lista.length} item(ns) · ${abertos} aberto(s)`;
  $("#retLista").innerHTML = lista.length ? lista.map(x => `<article class="card ret-item${["aberto", "aberta"].includes(x.status) ? " aberto" : ""}">
      <div class="ret-cab">${x.col === "apontamentos" ? `<span class="tag erro">🚩 ${esc(TIPOS_AP[x.tipo] || "Apontamento")}</span>` : `<span class="tag nota">💡 ${esc(x.categoria || "Sugestão")}</span>`}
        <span class="tag ${["aberto", "aberta"].includes(x.status) ? "aviso" : x.status === "procede" || x.status === "feita" ? "ok" : "off"}">${esc(x.status)}</span>
        <span class="pequeno">${esc(x.nome || x.email)} · ${dataBR(x.criadoEm)}</span></div>
      ${x.col === "apontamentos" ? `<p class="pequeno" style="margin:6px 0 2px"><b>${esc(x.provaTitulo || "Prova")}</b> · questão <span class="mono">${esc(x.qid)}</span></p><blockquote class="ret-enun">${esc(String(x.enunciado || "").slice(0, 400))}</blockquote>` : ""}
      <p style="margin:6px 0">${esc(x.texto).replace(/\n/g, "<br>")}</p>
      ${x.resposta ? `<p class="pequeno ret-resp">↩ <b>${esc(x.respondidoPor || "equipe")}:</b> ${esc(x.resposta)}</p>` : ""}
      ${ctx.podeEditar() ? `<div class="linha acoes"><input type="text" data-resp="${x.id}" placeholder="Resposta para o aluno (ele vê na página dele)" value="${esc(x.resposta || "")}" style="flex:1 1 280px">
        ${(x.col === "apontamentos" ? [["procede", "✅ Procede"], ["nao-procede", "✖ Não procede"], ["aberto", "↺ Reabrir"]] : [["feita", "✅ Vamos fazer / feita"], ["analisada", "👀 Analisada"], ["aberta", "↺ Reabrir"]])
          .map(([v, r]) => `<button type="button" class="leve mini" data-st="${v}" data-id="${x.id}" data-col="${x.col}">${r}</button>`).join("")}</div>` : ""}</article>`).join("")
    : `<div class="vazio"><div class="icone">📬</div><p>Nada por aqui${b || st || tipo ? " com esses filtros" : " ainda"}.</p></div>`;
  $("#retLista").querySelectorAll("[data-st]").forEach(bt => bt.onclick = async () => {
    const resp = $(`[data-resp="${bt.dataset.id}"]`).value.trim();
    try {
      await updateDoc(doc(db, bt.dataset.col, bt.dataset.id), { status: bt.dataset.st, resposta: resp, respondidoPor: ctx.eu.nome || ctx.eu.email, respondidoEm: serverTimestamp() });
      const x = [...itensRet.ap, ...itensRet.sg].find(y => y.id === bt.dataset.id); Object.assign(x, { status: bt.dataset.st, resposta: resp, respondidoPor: ctx.eu.nome || ctx.eu.email });
      toast("Atualizado.", "ok"); desenharRetorno();
    } catch (e) { toast(traduzirErro(e), "erro"); }
  });
}

// ---------- 🏅 editor das conquistas (config/conquistas.lista) ----------
let conqLista = [];
const skinsDe = id => Object.values(CATALOGO).flat().filter(i => i.trava?.medalha === id).map(i => i.nome);
export async function carregarConquistasAdmin() {
  const d = await getDoc(doc(db, "config", "conquistas")).catch(() => null);
  conqLista = structuredClone(d?.data()?.lista?.length ? d.data().lista : CONQUISTAS_PADRAO).map(c => ({ ativa: true, ...c }));
  desenharConq();
}
function desenharConq() {
  const box = $("#conqEditor"), admin = ctx.ehAdmin(), ia = !!(ctx.iaCfg?.() || ctx.urlCorretor?.());
  const grupos = [["geral", "🌟 Gerais (todas as matérias)"], ["materia", "📚 Por matéria (valem em cada matéria; use {materia} no título)"], ["diario", "📔 Da sala de aula (diário, alunos com acessibilidade)"]];
  const campo = (c, i, k) => k === "campo" ? `<select data-i="${i}" data-k="campo" ${admin ? "" : "disabled"}>${Object.entries(CAMPOS_DIARIO).map(([v, r]) => `<option value="${v}"${c.campo === v ? " selected" : ""}>${esc(r)}</option>`).join("")}</select>`
    : `<label class="cq-num">${k === "n" ? "N" : "mín."}<input type="number" min="0" max="${k === "min" ? 100 : 500}" data-i="${i}" data-k="${k}" value="${c[k] ?? ""}" ${admin ? "" : "disabled"}></label>`;
  box.innerHTML = grupos.map(([g, rot]) => `<h3 class="conq-h3">${rot}</h3>` + conqLista.map((c, i) => [c, i]).filter(([c]) => (REGRAS[c.regra]?.grupo || c.grupo) === g).map(([c, i]) => `
    <div class="cq-linha${c.ativa === false ? " desligada" : ""}">
      <span class="interruptor-g" title="Ligada"><input type="checkbox" data-i="${i}" data-k="ativa"${c.ativa !== false ? " checked" : ""} ${admin ? "" : "disabled"} aria-label="Conquista ligada"><i></i></span>
      <input type="text" class="cq-emoji" data-i="${i}" data-k="e" value="${esc(c.e)}" maxlength="4" aria-label="Emoji" ${admin ? "" : "disabled"}>
      <div class="cq-textos"><input type="text" data-i="${i}" data-k="t" value="${esc(c.t)}" maxlength="60" aria-label="Título" ${admin ? "" : "disabled"}>
        <input type="text" data-i="${i}" data-k="d" value="${esc(c.d || "")}" maxlength="160" aria-label="Descrição" class="pequeno" ${admin ? "" : "disabled"}>
        ${skinsDe(c.id).length ? `<span class="pequeno">🎨 libera: ${skinsDe(c.id).map(esc).join(", ")}</span>` : ""}</div>
      <div class="cq-regra"><select data-i="${i}" data-k="regra" ${admin ? "" : "disabled"}>${Object.entries(REGRAS).map(([k, r]) => `<option value="${k}"${c.regra === k ? " selected" : ""}>${esc(r.nome)}</option>`).join("")}</select>
        <div class="linha" style="gap:6px">${(REGRAS[c.regra]?.campos || []).map(k => campo(c, i, k)).join("")}</div></div>
      ${admin ? `<button type="button" class="discreto mini perigo-txt" data-del="${i}" aria-label="Apagar a conquista ${esc(c.t)}">🗑</button>` : ""}
    </div>`).join("")).join("") +
    (admin ? `<div class="linha acoes" style="margin-top:14px"><button type="button" id="cqSalvar">Salvar conquistas</button><button type="button" class="leve" id="cqNova">+ Nova conquista</button>
      ${ia ? `<button type="button" class="leve" id="cqIA">🤖 Sugerir novas com IA</button>` : ""}<button type="button" class="leve" id="cqPadrao">↺ Restaurar o padrão</button></div>
      <p class="pequeno">As mudanças valem para todos os alunos ao recarregar a página. Conquistas com 🎨 liberam skins do personagem: se apagar, a skin fica sem jeito de liberar.</p>` : "");
  box.querySelectorAll("[data-k]").forEach(el => el.onchange = () => {
    const c = conqLista[+el.dataset.i], k = el.dataset.k;
    c[k] = k === "ativa" ? el.checked : ["n", "min"].includes(k) ? (el.value === "" ? null : Number(el.value)) : el.value;
    if (k === "regra") { c.grupo = REGRAS[c.regra].grupo; if (c.regra === "diario" && !c.campo) c.campo = "aulas"; desenharConq(); }
    if (k === "ativa") el.closest(".cq-linha").classList.toggle("desligada", !el.checked);
  });
  box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { conqLista.splice(+b.dataset.del, 1); desenharConq(); });
  $("#cqNova")?.addEventListener("click", () => { conqLista.push({ id: "c-" + Date.now().toString(36), e: "🏅", t: "Nova conquista", d: "", grupo: "geral", regra: "provas", n: 1, ativa: true }); desenharConq(); });
  $("#cqPadrao")?.addEventListener("click", () => { conqLista = structuredClone(CONQUISTAS_PADRAO).map(c => ({ ativa: true, ...c })); desenharConq(); toast("Padrão carregado. Clique em Salvar para valer.", "info"); });
  $("#cqSalvar")?.addEventListener("click", async () => {
    const ruim = conqLista.find(c => !String(c.t || "").trim() || (REGRAS[c.regra]?.campos || []).some(k => k !== "campo" && !(Number(c[k]) >= 0 && c[k] !== null && c[k] !== "")));
    if (ruim) return toast(`Confira “${ruim.t || "sem título"}”: falta título ou número.`, "erro");
    try { await setDoc(doc(db, "config", "conquistas"), { lista: conqLista.map(c => ({ ...c, t: c.t.trim(), d: String(c.d || "").trim() })), atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email }); toast("Conquistas salvas 🏅", "ok"); }
    catch (e) { toast(traduzirErro(e), "erro"); }
  });
  $("#cqIA")?.addEventListener("click", async () => {
    const pedido = prompt("O que você quer de conquistas novas? (ex.: conquistas para quem melhora em Banco de Dados; algo para a semana de provas)", "") ?? null;
    if (pedido === null) return;
    toast("🤖 Pensando em conquistas novas…");
    try {
      const existentes = conqLista.map(c => ({ t: c.t, regra: c.regra })), cfg = ctx.iaCfg?.();
      let novas;
      if (cfg) novas = await sugerirConquistasIA({ chave: cfg.chave, modelo: cfg.modelo, existentes, pedido });
      else {
        const token = await ctx.auth.currentUser.getIdToken();
        const r = await fetch(ctx.urlCorretor(), { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify({ acao: "organizar", tipo: "conquistas", existentes, pedido }) });
        const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`); novas = d.conquistas;
      }
      conqLista.push(...novas.map(c => ({ ...c, ativa: false })));
      desenharConq(); toast(`🤖 ${novas.length} sugestão(ões) no fim de cada grupo, desligadas: revise, ligue as que gostar e salve.`, "ok");
    } catch (e) { toast("🤖 " + (e.message || traduzirErro(e)), "erro"); }
  });
}
