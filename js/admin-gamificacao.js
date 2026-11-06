// Painel → aba "Gamificação" (admin): liga e desliga cada parte, e abre a simulação "ver como aluno".
// Painel → aba "Retorno dos alunos" (professor/admin): apontamentos nas questões e sugestões para o sistema.
import { db, esc, $, toast, confirmar, traduzirErro, dataBR, GAMI_PADRAO, lerGamificacao, rotuloSemestre, dataCurta } from "./common.js";
import { CONQUISTAS_PADRAO, REGRAS, CAMPOS_DIARIO, ALIASES, normalizarConquista } from "./conquistas.js";
import { CATALOGO } from "./avatar.js";
import { sugerirConquistasIA, nomesNiveisIA } from "./ia.js";
import { listarPlanos } from "./admin-org.js";
import { menuHTML, itemMenu, vazio, collapsible, chips, tarefa, drawer, drawerForm, pl, seta } from "./ui.js";
import { ic } from "./icones.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let ctx = null;
export function iniciarGamificacao(c) { ctx = c; }

const OPCOES = [
  { k: "conquistas", t: "🏅 Conquistas dos alunos", d: "Medalhas gerais, por matéria e da sala de aula (diário), com nível. Aparecem na página do aluno." },
  { k: "personagem", t: "🎨 Personagem e skins", d: "O aluno cria o próprio personagem (rosto, cabelo, roupa…). Skins, molduras e acessórios especiais são liberados pelas conquistas." },
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
    if (!(await confirmar("Salvar as opções de gamificação? Os alunos veem a mudança ao recarregar a página.", { titulo: "Salvar gamificação", ok: "Salvar" }))) return;
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
  ["#retBusca", "#retStatus"].forEach(id => $(id).oninput = $(id).onchange = desenharRetorno);
  desenharRetorno();
}
// duas partes separadas: 🚩 erros reportados nas questões (agrupados por prova) e 💡 sugestões (agrupadas por assunto)
let retAba = "ap";
const aberto = x => ["aberto", "aberta"].includes(x.status);
function desenharAbasRetorno() {
  const n = l => l.filter(aberto).length;
  $("#retAbas").innerHTML = [["ap", "🚩", "Erros nas questões", "O aluno avisou que uma questão tem problema", itensRet.ap], ["sg", "💡", "Sugestões para o sistema", "Ideias e problemas do site", itensRet.sg]]
    .map(([k, e, t, d, l]) => `<button type="button" role="tab" class="ret-aba${retAba === k ? " sel" : ""}" aria-selected="${retAba === k}" data-retaba="${k}"><span class="ra-e">${e}</span><span class="ra-t"><b>${t}</b><small>${d}</small></span>
      <span class="ra-n">${n(l) ? `<span class="chip aviso">${n(l)} abert${k === "ap" ? "o" : "a"}(s)</span>` : ""}<span class="chip">${l.length}</span></span></button>`).join("");
  $("#retAbas").querySelectorAll("[data-retaba]").forEach(b => b.onclick = () => { retAba = b.dataset.retaba; desenharRetorno(); });
}
function desenharRetorno() {
  desenharAbasRetorno();
  const b = String($("#retBusca").value || "").toLowerCase(), tipo = retAba, st = $("#retStatus").value;
  const lista = [...(tipo === "ap" ? itensRet.ap : itensRet.sg)]
    .filter(x => (!st || (st === "aberto" ? ["aberto", "aberta"].includes(x.status) : !["aberto", "aberta"].includes(x.status))))
    .filter(x => !b || `${x.nome} ${x.email} ${x.texto} ${x.provaTitulo || ""} ${x.enunciado || ""}`.toLowerCase().includes(b));
  const abertos = [...itensRet.ap, ...itensRet.sg].filter(x => ["aberto", "aberta"].includes(x.status)).length;
  $("#retContagem").textContent = `${lista.length} item(ns) · ${abertos} aberto(s)`;
  const grupoDe = x => tipo === "ap" ? (x.provaTitulo || "Prova sem nome") : (x.categoria || "Outro"), grupos = new Map();
  lista.forEach(x => (grupos.get(grupoDe(x)) || grupos.set(grupoDe(x), []).get(grupoDe(x))).push(x));
  const itemRet = x => `<article class="card ret-item${["aberto", "aberta"].includes(x.status) ? " aberto" : ""}">
      <div class="ret-cab">${x.col === "apontamentos" ? `<span class="chip err"><span class="e" aria-hidden="true">🚩</span>${esc(TIPOS_AP[x.tipo] || "Apontamento")}</span>` : `<span class="chip info"><span class="e" aria-hidden="true">💡</span>${esc(x.categoria || "Sugestão")}</span>`}
        <span class="chip ${["aberto", "aberta"].includes(x.status) ? "warn" : x.status === "procede" || x.status === "feita" ? "ok" : "off"}">${esc(x.status)}</span>
        <span class="meta-txt">${esc(x.nome || x.email)} · ${dataBR(x.criadoEm)}</span></div>
      ${x.col === "apontamentos" ? `<p class="pequeno" style="margin:6px 0 2px"><b>${esc(x.provaTitulo || "Prova")}</b> · questão <span class="mono">${esc(x.qid)}</span></p><blockquote class="ret-enun">${esc(String(x.enunciado || "").slice(0, 400))}</blockquote>` : ""}
      <p style="margin:6px 0">${esc(x.texto).replace(/\n/g, "<br>")}</p>
      ${x.resposta ? `<p class="pequeno ret-resp">↩ <b>${esc(x.respondidoPor || "equipe")}:</b> ${esc(x.resposta)}</p>` : ""}
      ${ctx.podeEditar() ? `<div class="ret-resposta"><input type="text" data-resp="${x.id}" placeholder="Resposta para o aluno (ele vê na página dele)" value="${esc(x.resposta || "")}" aria-label="Resposta para ${esc(x.nome || x.email)}">
        ${menuHTML({ rotulo: `Responder e marcar${ic("chev", { size: 14 })}`, classe: "leve mini", aria: "Responder e marcar", itensHTML: (x.col === "apontamentos" ? [["procede", "check", "Procede"], ["nao-procede", "x", "Não procede"], ["aberto", "refresh", "Reabrir"]] : [["feita", "check", "Vamos fazer / feita"], ["analisada", "eye", "Analisada"], ["aberta", "refresh", "Reabrir"]])
          .map(([v, i, r]) => itemMenu({ i, t: r, attrs: `data-st="${v}" data-id="${x.id}" data-col="${x.col}"` })).join("") })}</div>` : ""}</article>`;
  $("#retLista").innerHTML = lista.length ? [...grupos].map(([g, l]) => collapsible({ chave: `ret:${tipo}:${g}`, aberto: true, classe: "ret-grupo", titulo: esc(g),
      resumoHTML: `<span class="meta-txt">${l.length}</span>${l.filter(aberto).length ? `<span class="chip warn">${l.filter(aberto).length} em aberto</span>` : ""}`, corpoHTML: l.map(itemRet).join("") })).join("")
    : vazio({ e: tipo === "ap" ? "🚩" : "💡", texto: `${tipo === "ap" ? "Nenhum erro reportado" : "Nenhuma sugestão"}${b || st ? " com esses filtros" : " ainda"}.` });
  $("#retLista").querySelectorAll("[data-st]").forEach(bt => bt.onclick = async () => {
    const resp = $(`[data-resp="${bt.dataset.id}"]`).value.trim(), rotSt = bt.textContent.trim();
    if (!(await confirmar(`Marcar como "${rotSt}"${resp ? " e enviar a resposta ao aluno" : ""}? O aluno vê isso na página dele.`, { titulo: "Responder", ok: "Confirmar" }))) return;
    try {
      await updateDoc(doc(db, bt.dataset.col, bt.dataset.id), { status: bt.dataset.st, resposta: resp, respondidoPor: ctx.eu.nome || ctx.eu.email, respondidoEm: serverTimestamp() });
      const x = [...itensRet.ap, ...itensRet.sg].find(y => y.id === bt.dataset.id); Object.assign(x, { status: bt.dataset.st, resposta: resp, respondidoPor: ctx.eu.nome || ctx.eu.email });
      toast("Atualizado.", "ok"); desenharRetorno();
    } catch (e) { toast(traduzirErro(e), "erro"); }
  });
}

// ---------- 🏅 editor das conquistas (config/conquistas.lista): lista + painel de edição ao lado (quadro 6) ----------
let conqLista = [], conqSel = -1, conqRasc = null, conqAlt = 0, conqFiltro = { busca: "", aba: "todas" }, drawerConq = null;
const grupoEstado = {};   // grupos abertos ou fechados pelo professor
const GRUPOS = { geral: { e: "🌟", t: "Gerais", aberto: true }, materia: { e: "📚", t: "Por matéria", aberto: true }, diario: { e: "📔", t: "Sala de aula (diário)", aberto: false } };
const grupoDe = c => REGRAS[c.regra]?.grupo || c.grupo || "geral";
const normC = s => String(s || "").toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "");
const skinsDe = id => Object.values(CATALOGO).flat().filter(i => i.trava?.medalha && (i.trava.medalha === id || ALIASES[i.trava.medalha]?.id === id)).map(i => i.nome);
const usaN = c => (REGRAS[c.regra]?.campos || []).includes("n"), usaMin = c => (REGRAS[c.regra]?.campos || []).includes("min");
const REGRAS_DE_PROVA = ["provas", "semVidas", "evolucao", "materiaEvolucao", "materiaMedia"];
const textoNiveis = c => c.niveis.map(x => usaN(c) && usaMin(c) ? `${x.n ?? "?"}/${x.min ?? "?"}` : usaMin(c) ? (x.min ?? "?") : (x.n ?? "?")).join(" · ");
function validarConq(c) {
  if (!String(c.t || "").trim()) return "Escreva o título.";
  if (!c.niveis?.length) return "Crie pelo menos 1 nível.";
  if (c.niveis.some(x => !String(x.nome || "").trim())) return "Dê um nome a cada nível.";
  const campos = ["n", "min"].filter(k => (REGRAS[c.regra]?.campos || []).includes(k));
  if (c.niveis.some(x => campos.some(k => x[k] === "" || x[k] === null || x[k] === undefined || !(Number(x[k]) >= 0)))) return "Preencha os números de cada nível.";
  for (let i = 1; i < c.niveis.length; i++) { const a = c.niveis[i - 1], b = c.niveis[i];
    if (campos.some(k => Number(b[k]) < Number(a[k])) || campos.every(k => Number(b[k]) === Number(a[k]))) return "Os níveis têm de estar em ordem crescente de dificuldade."; }
  return "";
}
export async function carregarConquistasAdmin() {
  const d = await getDoc(doc(db, "config", "conquistas")).catch(() => null);
  conqLista = structuredClone(d?.data()?.lista?.length ? d.data().lista : CONQUISTAS_PADRAO).map(c => normalizarConquista({ ativa: true, ...c }));
  conqSel = -1; conqRasc = null; conqAlt = 0;
  desenharConq();
}
function desenharConq() {
  const box = $("#conqEditor"), admin = ctx.ehAdmin(), dis = admin ? "" : "disabled", ia = !!(ctx.iaCfg?.() || ctx.urlCorretor?.());
  const linha = (c, i) => { const sk = skinsDe(c.id);
    return `<div class="cq-linha${i === conqSel ? " sel" : ""}${c.ativa === false ? " desligada" : ""}" data-linha="${i}" data-busca="${esc(normC(`${c.t} ${c.d || ""} ${c.niveis.map(x => x.nome).join(" ")}`))}">
      <input type="checkbox" class="switch" data-ativa="${i}"${c.ativa !== false ? " checked" : ""} ${dis} aria-label="Conquista ${esc(c.t)} ligada">
      <span class="cq-e e" aria-hidden="true">${esc(c.e || "🏅")}</span>
      <span class="cq-texto"><b>${esc(c.t)}</b><span>${esc(REGRAS[c.regra]?.nome || "regra não reconhecida")} · <b>${esc(textoNiveis(c))}</b></span></span>
      ${c.sugerida ? `<span class="chip info">sugerida</span>` : ""}${sk.length ? `<span class="chip off" title="Libera: ${esc(sk.join(", "))}"><span class="e" aria-hidden="true">🎨</span>${esc(sk.slice(0, 2).join(", "))}${sk.length > 2 ? ` +${sk.length - 2}` : ""}</span>` : ""}
      <button type="button" class="icone mini" data-editar-c="${i}" aria-label="Editar ${esc(c.t)}" title="Editar">${ic("edit", { size: 16 })}</button></div>`; };
  const grupos = Object.keys(GRUPOS).map(g => { const l = conqLista.map((c, i) => [c, i]).filter(([c]) => grupoDe(c) === g); if (!l.length) return "";
    const aberto = grupoEstado[g] ?? GRUPOS[g].aberto;
    return `<details class="cq-grupo" data-grupo-c="${g}" ${aberto ? "open" : ""}><summary class="grupo-cab">${seta()}<span class="e cq-ge" aria-hidden="true">${GRUPOS[g].e}</span><h3 class="gc-titulo">${GRUPOS[g].t}</h3><span class="chip navy">${l.length}</span></summary>
      <div class="cq-linhas">${l.map(([c, i]) => linha(c, i)).join("")}</div></details>`; }).join("");
  const nLig = conqLista.filter(c => c.ativa !== false).length, nSug = conqLista.filter(c => c.sugerida).length;
  box.innerHTML = `<div class="cq-layout"><div class="cq-col">
      <div class="card cq-barra">
        ${conqAlt ? `<span class="chip warn">${pl(conqAlt, "alteração não salva", "alterações não salvas")}</span>` : ""}
        <input type="search" id="cqBusca" placeholder="Buscar conquista…" aria-label="Buscar conquista" value="${esc(conqFiltro.busca)}">
        <div id="cqAbas"></div>
        ${admin ? `<div class="cq-acoes"><button type="button" class="leve" id="cqGerar">${ic("cal", { size: 16 })}Gerar do plano de ensino</button><button type="button" id="cqSalvar">Salvar conquistas</button>
          ${menuHTML({ aria: "Mais ações das conquistas", itensHTML: itemMenu({ i: "plus", t: "Nova conquista", id: "cqNova" }) + (ia ? itemMenu({ i: "sparkle", t: "Sugerir novas com IA", id: "cqIA" }) : "") + "<hr>" + itemMenu({ i: "refresh", t: "Restaurar o padrão", id: "cqPadrao", perigo: true }) })}</div>` : ""}
      </div>
      <div class="card cq-lista">${grupos}<p class="help cq-nada oculto">Nenhuma conquista com esse filtro.</p></div>
    </div><aside class="card cq-lado" id="cqLado" hidden></aside></div>`;
  chips($("#cqAbas", box), [{ v: "todas", t: `Todas · ${conqLista.length}` }, { v: "ligadas", t: `Ligadas · ${nLig}` }, { v: "sugeridas", t: `Sugeridas pela IA · ${nSug}` }], { valor: conqFiltro.aba, aria: "Mostrar", aoMudar: v => { conqFiltro.aba = v; filtrar(); } });
  const filtrar = () => {
    const t = normC(conqFiltro.busca);
    box.querySelectorAll(".cq-grupo").forEach(g => { let n = 0;
      g.querySelectorAll(".cq-linha").forEach(el => { const c = conqLista[+el.dataset.linha], ok = (!t || el.dataset.busca.includes(t)) && (conqFiltro.aba === "todas" || (conqFiltro.aba === "ligadas" ? c.ativa !== false : !!c.sugerida)); el.classList.toggle("oculto", !ok); n += ok; });
      g.classList.toggle("oculto", !n); if ((t || conqFiltro.aba === "sugeridas") && n) g.open = true; });
    box.querySelector(".cq-nada").classList.toggle("oculto", !!box.querySelector(".cq-grupo:not(.oculto)"));
  };
  $("#cqBusca", box).oninput = e => { conqFiltro.busca = e.target.value; filtrar(); };
  filtrar();
  box.querySelectorAll("[data-grupo-c]").forEach(d => d.ontoggle = () => { if (!conqFiltro.busca && conqFiltro.aba !== "sugeridas") grupoEstado[d.dataset.grupoC] = d.open; });
  box.querySelectorAll("[data-ativa]").forEach(el => { el.onclick = e => e.stopPropagation(); el.onchange = () => { conqLista[+el.dataset.ativa].ativa = el.checked; conqAlt++; desenharConq(); }; });
  box.querySelectorAll("[data-editar-c]").forEach(b => b.onclick = e => { e.stopPropagation(); abrirEditorConq(+b.dataset.editarC); });
  box.querySelectorAll("[data-linha]").forEach(el => el.onclick = () => abrirEditorConq(+el.dataset.linha));
  $("#cqGerar")?.addEventListener("click", abrirGerarDoPlano);
  $("#cqNova")?.addEventListener("click", () => { const c = { id: "c-" + Date.now().toString(36), e: "🏅", t: "Nova conquista", d: "", grupo: "geral", regra: "provas", niveis: [{ n: 1, nome: "Nova conquista" }], ativa: true };
    conqLista.push(c); conqAlt++; conqFiltro = { busca: "", aba: "todas" }; abrirEditorConq(conqLista.length - 1); });
  $("#cqPadrao")?.addEventListener("click", async () => {
    if (!(await confirmar("Restaurar as conquistas do padrão? As suas mudanças e as conquistas criadas somem da lista (só vale depois de Salvar conquistas).", { titulo: "Restaurar o padrão", ok: "Restaurar", perigo: true }))) return;
    fecharEditorConq(); conqLista = structuredClone(CONQUISTAS_PADRAO).map(c => normalizarConquista({ ativa: true, ...c })); conqAlt++; desenharConq(); toast("Padrão carregado. Clique em Salvar conquistas para valer.", "info"); });
  $("#cqSalvar")?.addEventListener("click", async () => {
    const ruim = conqLista.find(c => validarConq(c));
    if (ruim) return toast(`Confira “${ruim.t || "sem título"}”: ${validarConq(ruim)}`, "erro");
    if (!(await confirmar(`Salvar as ${conqLista.length} conquista(s) (${conqLista.filter(c => c.ativa !== false).length} ligadas)? Vale para todos os alunos ao recarregar a página.`, { titulo: "Salvar conquistas", ok: "Salvar" }))) return;
    try { await setDoc(doc(db, "config", "conquistas"), { lista: conqLista.map(c => ({ ...c, t: c.t.trim(), d: String(c.d || "").trim(), grupo: grupoDe(c) })), atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email }); conqAlt = 0; desenharConq(); toast("Conquistas salvas 🏅", "ok"); }
    catch (e) { toast(traduzirErro(e), "erro"); }
  });
  $("#cqIA")?.addEventListener("click", async () => {
    const pedido = await pedirTexto();
    if (pedido === null) return;
    const tf = tarefa({ titulo: "Pensando em conquistas novas", icone: "🤖", estimativaSeg: 30 });
    try {
      const existentes = conqLista.map(c => ({ t: c.t, regra: c.regra })), cfg = ctx.iaCfg?.();
      let novas;
      if (cfg) novas = await sugerirConquistasIA({ chave: cfg.chave, modelo: cfg.modelo, existentes, pedido });
      else {
        const token = await ctx.auth.currentUser.getIdToken();
        const r = await fetch(ctx.urlCorretor(), { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify({ acao: "organizar", tipo: "conquistas", existentes, pedido }) });
        const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`); novas = d.conquistas;
      }
      conqLista.push(...novas.map(c => normalizarConquista({ ...c, ativa: false, sugerida: true }))); conqAlt += novas.length;
      tf.fim(`${pl(novas.length, "sugestão", "sugestões")}`); conqFiltro = { busca: "", aba: "sugeridas" };
      desenharConq(); toast(`🤖 ${pl(novas.length, "sugestão", "sugestões")}, desligadas: revise, ligue as que gostar e salve.`, "ok");
    } catch (e) { tf.erro(e.message || traduzirErro(e)); toast("🤖 " + (e.message || traduzirErro(e)), "erro"); }
  });
  if (conqSel >= 0 && matchMedia("(min-width:1200px)").matches) pintarLado();
}
function pedirTexto() {
  return new Promise(resolve => { let valor = null;
    drawerForm({ titulo: "Sugerir conquistas com IA", largo: false, ok: "Pedir sugestões", conteudo: `<label for="cqPedido">O que você quer de conquistas novas?</label><textarea id="cqPedido" style="min-height:120px" placeholder="Ex.: conquistas para quem melhora em Banco de Dados; algo para a semana de provas"></textarea>`,
      antesDeConfirmar: c => { valor = $("#cqPedido", c).value.trim(); } }).then(ok => resolve(ok ? valor : null)); });
}

// ---------- painel "Editar conquista": ao lado da lista em tela larga; drawer por cima nas outras ----------
function abrirEditorConq(i) {
  fecharEditorConq();
  conqSel = i; conqRasc = structuredClone(conqLista[i]);
  if (matchMedia("(min-width:1200px)").matches) return desenharConq();
  document.querySelectorAll(".cq-linha.sel").forEach(x => x.classList.remove("sel")); document.querySelector(`[data-linha="${i}"]`)?.classList.add("sel");
  drawerConq = drawer({ titulo: "Editar conquista", aoFechar: () => { drawerConq = null; conqSel = -1; conqRasc = null; document.querySelectorAll(".cq-linha.sel").forEach(x => x.classList.remove("sel")); },
    acoes: [{ t: "Aplicar", onClick: () => aplicarConq() }, { t: "Cancelar", classe: "leve" }, { t: "Apagar", classe: "discreto vermelho", esquerda: true, onClick: async () => { await apagarConq(); return false; } }] });
  pintarCorpoConq(drawerConq.corpo);
}
function fecharEditorConq() {
  const tinha = conqSel >= 0; conqSel = -1; conqRasc = null;
  if (drawerConq) drawerConq.fechar();
  else if (tinha && $("#conqEditor .cq-layout")) desenharConq();
}
function pintarLado() {
  const lado = $("#cqLado"); lado.hidden = false;
  lado.innerHTML = `<div class="cq-lado-cab"><h2>Editar conquista</h2><button type="button" class="icone" id="cqFechar" aria-label="Fechar" title="Fechar">${ic("x")}</button></div>
    <div class="cq-lado-corpo" id="cqLadoCorpo"></div>
    <div class="cq-lado-rodape"><button type="button" id="cqAplicar">Aplicar</button><button type="button" class="leve" id="cqCancelar">Cancelar</button><button type="button" class="discreto vermelho" id="cqApagar">${ic("trash", { size: 16 })}Apagar</button></div>`;
  pintarCorpoConq($("#cqLadoCorpo"));
  $("#cqFechar").onclick = $("#cqCancelar").onclick = () => fecharEditorConq();
  $("#cqAplicar").onclick = () => { if (aplicarConq() !== false) desenharConq(); };
  $("#cqApagar").onclick = () => apagarConq();
}
function aplicarConq() {
  const r = conqRasc, erro = validarConq(r);
  if (erro) { toast(erro, "erro"); return false; }
  delete r.n; delete r.min; r.grupo = grupoDe(r); delete r.sugerida;
  conqLista[conqSel] = r; conqAlt++;
  conqSel = -1; conqRasc = null; desenharConq();
  return true;
}
async function apagarConq() {
  const c = conqLista[conqSel], sk = skinsDe(c.id);
  if (!(await confirmar(`Apagar a conquista "${c.t}"?${sk.length ? ` Ela libera ${sk.join(", ")} no personagem: essas skins ficam sem jeito de liberar.` : ""} (Só vale depois de Salvar conquistas.)`, { titulo: "Apagar conquista", ok: "Apagar", perigo: true }))) return;
  conqLista.splice(conqSel, 1); conqAlt++;
  const d = drawerConq; conqSel = -1; conqRasc = null; d?.fechar(); desenharConq();
}
const MATERIA_EXEMPLO = "Banco de Dados";
function previaAluno() {
  const r = conqRasc, ns = r.niveis, at = Math.min(1, ns.length - 1), nome = x => String(x?.nome || "").replaceAll("{materia}", MATERIA_EXEMPLO), prox = ns[at + 1];
  const titulo = String(r.t || "").replaceAll("{materia}", MATERIA_EXEMPLO), un = REGRAS_DE_PROVA.includes(r.regra) ? " provas" : "";
  const meta = prox ? Number(prox.n ?? prox.min ?? 1) : 1, val = prox ? Math.max(0, meta - 1) : 1;
  return `<span class="cq-med e" aria-hidden="true">${esc(r.e || "🏅")}</span><div class="cq-prev-txt"><b>${esc(nome(ns[at]) || titulo)}</b><span>${esc(titulo)} · nível ${at + 1} de ${ns.length}</span>
    <div class="barra-fina"><i style="width:${prox ? Math.round(val / meta * 100) : 100}%"></i></div><small>${prox ? `${val}/${meta}${un} para <b>${esc(nome(prox))}</b>` : "nível máximo"}</small></div>`;
}
function pintarCorpoConq(box) {
  const r = conqRasc, admin = ctx.ehAdmin(), iaNav = !!ctx.iaCfg?.(), n = usaN(r), m = usaMin(r), deProva = REGRAS_DE_PROVA.includes(r.regra);
  const rotuloN = deProva ? "Provas" : "N", colunas = `${n ? "70px " : ""}${m ? "70px " : ""}minmax(0, 1fr) 32px`;
  box.innerHTML = `<div class="cq-ed">
    <div class="cq-ed-l1"><input type="text" class="cq-emoji" id="cqEdEmoji" value="${esc(r.e || "")}" maxlength="4" aria-label="Emoji da conquista"><div class="cq-cresce"><label for="cqEdTitulo">Título</label><input type="text" id="cqEdTitulo" value="${esc(r.t || "")}" maxlength="60"></div></div>
    <div><label for="cqEdDesc">Descrição</label><input type="text" id="cqEdDesc" value="${esc(r.d || "")}" maxlength="160"></div>
    <div><label for="cqEdRegra">Regra</label><select id="cqEdRegra">${Object.entries(REGRAS).map(([k, x]) => `<option value="${k}"${r.regra === k ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></div>
    ${r.regra === "diario" ? `<div><label for="cqEdCampo">Contador</label><select id="cqEdCampo">${Object.entries(CAMPOS_DIARIO).map(([v, t]) => `<option value="${v}"${r.campo === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>` : ""}
    ${r.materia ? `<p class="help">Vale só em <b>${esc(r.materia)}</b>.</p>` : ""}
    <div class="cq-niveis-cab"><b>Níveis</b>${iaNav ? `<button type="button" class="leve mini" id="cqNomesIA">${ic("sparkle", { size: 16 })}Sugerir nomes com IA</button>` : ""}</div>
    <div class="cq-niveis">
      <div class="cq-nv cq-nv-cab" style="--cols:${colunas}"><span></span>${n ? `<span>${rotuloN}</span>` : ""}${m ? `<span>Mín.</span>` : ""}<span>Nome do nível</span><span></span></div>
      ${r.niveis.map((x, i) => `<div class="cq-nv" style="--cols:${colunas}"><span class="cq-nv-n">${i + 1}</span>
        ${n ? `<input type="number" min="0" max="500" data-nv="${i}" data-c="n" value="${x.n ?? ""}" aria-label="${rotuloN} do nível ${i + 1}" class="${deProva && Number(x.n) > 4 ? "campo-erro" : ""}">` : ""}${m ? `<input type="number" min="0" max="100" data-nv="${i}" data-c="min" value="${x.min ?? ""}" aria-label="Mínimo do nível ${i + 1}">` : ""}
        <input type="text" data-nv="${i}" data-c="nome" value="${esc(x.nome || "")}" maxlength="60" aria-label="Nome do nível ${i + 1}">
        <button type="button" class="icone mini" data-tira="${i}" aria-label="Tirar o nível ${i + 1}" title="Tirar"${r.niveis.length < 2 ? " disabled" : ""}>${ic("x", { size: 14 })}</button></div>`).join("")}
    </div>
    <button type="button" class="discreto mini cq-add" id="cqAddNivel">${ic("plus", { size: 16 })}Adicionar nível</button>
    <p class="help">Provas são poucas no semestre: o sistema sugere no máximo 4 níveis por prova feita. Níveis maiores (5 · 10 · 15 · 30) ficam para presença e diário.</p>
    <p class="cq-aviso oculto" id="cqAvisoN">Provas no semestre são poucas: use 4 ou menos nesta regra.</p>
    <div><b class="cq-sub">Como a aluna vê</b><div class="cq-previa" id="cqPrevia">${previaAluno()}</div></div>
    ${skinsDe(r.id).length ? `<p class="help">Libera no personagem: ${skinsDe(r.id).map(esc).join(", ")}.</p>` : ""}
    ${admin ? `<button type="button" class="discreto mini cq-add" id="cqDuplicar">${ic("copy", { size: 16 })}Duplicar esta conquista</button>` : ""}
  </div>`;
  const prev = () => { $("#cqPrevia", box).innerHTML = previaAluno(); $("#cqAvisoN", box).classList.toggle("oculto", !(deProva && r.niveis.some(x => Number(x.n) > 4))); };
  prev();
  $("#cqEdEmoji", box).oninput = e => { r.e = e.target.value; prev(); };
  $("#cqEdTitulo", box).oninput = e => { r.t = e.target.value; prev(); };
  $("#cqEdDesc", box).oninput = e => { r.d = e.target.value; };
  $("#cqEdCampo", box)?.addEventListener("change", e => { r.campo = e.target.value; });
  $("#cqEdRegra", box).onchange = e => { r.regra = e.target.value; r.grupo = REGRAS[r.regra].grupo; if (r.regra === "diario" && !r.campo) r.campo = "aulas";
    r.niveis.forEach((x, i) => { if (usaN(r) && x.n === undefined) x.n = i + 1; if (usaMin(r) && x.min === undefined) x.min = [60, 80, 100, 100][Math.min(i, 3)]; }); pintarCorpoConq(box); };
  box.querySelectorAll("[data-nv]").forEach(el => el.oninput = () => { const x = r.niveis[+el.dataset.nv], k = el.dataset.c;
    x[k] = k === "nome" ? el.value : el.value === "" ? null : Number(el.value);
    if (k === "n") el.classList.toggle("campo-erro", deProva && Number(el.value) > 4); prev(); });
  box.querySelectorAll("[data-tira]").forEach(b => b.onclick = () => { r.niveis.splice(+b.dataset.tira, 1); pintarCorpoConq(box); });
  $("#cqAddNivel", box).onclick = () => { const u = r.niveis.at(-1) || {}, novo = { nome: "" }; if (n) novo.n = Number(u.n || 0) + 1; if (m) novo.min = Math.min(100, Number(u.min || 50) + (n ? 0 : 10)); r.niveis.push(novo); pintarCorpoConq(box); };
  $("#cqDuplicar", box)?.addEventListener("click", () => { const c = { ...structuredClone(r), id: "c-" + Date.now().toString(36), t: r.t + " (cópia)", ativa: false }; conqLista.splice(conqSel + 1, 0, c); conqAlt++; abrirEditorConq(conqSel + 1); });
  $("#cqNomesIA", box)?.addEventListener("click", async e => { const b = e.currentTarget; b.disabled = true;
    try { const cfg = ctx.iaCfg(), nomes = await nomesNiveisIA({ chave: cfg.chave, modelo: cfg.modelo, conquistas: [{ id: "a", t: r.t, d: r.d, regra: REGRAS[r.regra]?.nome, niveis: r.niveis.map(x => ({ n: x.n, min: x.min })) }] });
      (nomes.a || []).forEach((t, i) => { if (r.niveis[i]) r.niveis[i].nome = t; }); pintarCorpoConq(box); toast("Nomes sugeridos. Revise e clique em Aplicar.", "ok"); }
    catch (x) { toast("🤖 " + (x.message || traduzirErro(x)), "erro"); b.disabled = false; } });
}

// ---------- gerar conquistas a partir do plano de ensino: criadas desligadas, marcadas como sugeridas ----------
const slug = s => normC(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function tiposDoPlano(materia, N) {
  const teto = Math.max(1, N), ate = (l, f) => l.slice(0, Math.max(1, Math.min(l.length, f)));
  const mestre = [{ n: 2, min: 70, nome: "Aprendiz de {materia}" }, { n: 3, min: 80, nome: "Praticante de {materia}" }, { n: 4, min: 85, nome: "Mestre de {materia}" }].filter(x => x.n <= teto);
  const marcos = [["primeira", "🎬", "Primeira prova do semestre", 1], ["metade", "🚩", "Metade do caminho", Math.ceil(N / 2)], ["fechou", "🏁", "Fechou o semestre", N]].filter(([, , , n], i, l) => n >= 1 && l.findIndex(y => y[3] === n) === i);
  return [
    { id: "mestre", titulo: "Mestre de {materia}", itens: [{ tipo: "mestre", e: "🧩", t: "Mestre de {materia}", d: "Média alta nesta matéria ao longo do semestre", regra: "materiaMedia", niveis: mestre.length ? mestre : [{ n: 1, min: 70, nome: "Aprendiz de {materia}" }] }] },
    { id: "mandou", titulo: "Mandou bem em {materia}", itens: [{ tipo: "mandou", e: "⭐", t: "Mandou bem em {materia}", d: "Uma nota alta nesta matéria", regra: "materiaNota", niveis: [{ min: 60, nome: "Bom em {materia}" }, { min: 80, nome: "Mandou bem em {materia}" }, { min: 100, nome: "Gabaritou {materia}" }] }] },
    ...(N >= 2 ? [{ id: "decolando", titulo: "Decolando em {materia}", itens: [{ tipo: "decolando", e: "🚀", t: "Decolando em {materia}", d: "Melhorou a nota nesta matéria", regra: "materiaEvolucao", niveis: ate([{ n: 1, nome: "Decolando em {materia}" }, { n: 2, nome: "Voando em {materia}" }, { n: 3, nome: "Nas alturas em {materia}" }, { n: 4, nome: "Em órbita em {materia}" }], N - 1) }] }] : []),
    { id: "marcos", titulo: "Marcos do semestre", itens: marcos.map(([k, e, t, n]) => ({ tipo: k, e, t, d: `${pl(n, "prova feita", "provas feitas")} em ${materia}`, regra: "provas", niveis: [{ n, nome: t }] })) }
  ];
}
async function abrirGerarDoPlano() {
  const planos = await listarPlanos().catch(() => []);
  const comProvas = planos.filter(p => p.turmaId && p.materia);
  if (!comProvas.length) return toast("Nenhum plano de ensino cadastrado. Crie em Organização.", "info");
  let turma = comProvas[0].turmaId, semestre = "", planoId = "", tipos = [], ligados = {}, nomesIA = {};
  const corpoHTML = `<div class="ge-campos"><div><label for="geTurma">Turma</label><select id="geTurma"></select></div><div><label for="geSem">Semestre</label><select id="geSem"></select></div><div><label for="geMat">Matéria</label><select id="geMat"></select></div></div><div id="geResumo"></div>`;
  const d = drawer({ titulo: "Gerar do plano de ensino", corpoHTML, largo: true, acoes: [{ t: "Gerar", onClick: () => gerar() }, { t: "Cancelar", classe: "leve" }] });
  const c = d.corpo, opts = (el, vals, atual) => { el.innerHTML = vals.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(""); el.value = vals.some(([v]) => v === atual) ? atual : vals[0]?.[0] ?? ""; return el.value; };
  const plano = () => comProvas.find(p => p.id === planoId);
  const pintar = () => {
    turma = opts($("#geTurma", c), [...new Map(comProvas.map(p => [p.turmaId, p.turma || p.turmaId]))], turma);
    const daTurma = comProvas.filter(p => p.turmaId === turma);
    semestre = opts($("#geSem", c), [...new Set(daTurma.map(p => p.semestre))].sort().reverse().map(s => [s, rotuloSemestre(s)]), semestre);
    planoId = opts($("#geMat", c), daTurma.filter(p => p.semestre === semestre).map(p => [p.id, p.materia]), planoId);
    const p = plano(), prevs = p?.provas || [], N = prevs.length;
    tipos = p ? tiposDoPlano(p.materia, N) : [];
    tipos.forEach(t => { if (ligados[t.id] === undefined) ligados[t.id] = true; });
    const nome = x => String(nomesIA[x] ?? x);
    $("#geResumo", c).innerHTML = !p ? "" : `<h3 class="cq-sub">Provas previstas · ${N}</h3>
      ${N ? `<ul class="ge-provas">${prevs.map(x => `<li><span class="chip off">${ic("cal", { size: 14 })}${x.data ? dataCurta(x.data) : "sem data"}</span>${esc(x.titulo || "Prova")}</li>`).join("")}</ul>` : `<p class="help" style="max-width:none">O plano ainda não tem provas previstas: os níveis de prova ficam limitados a 1. Cadastre as provas em Organização para um teto real.</p>`}
      <div class="ge-cab"><h3 class="cq-sub">O que criar</h3>${ctx.iaCfg?.() ? `<button type="button" class="leve mini" id="geIA">${ic("sparkle", { size: 16 })}Nomes temáticos com IA</button>` : ""}</div>
      ${tipos.map(t => `<div class="ge-tipo"><label class="switch-linha"><input type="checkbox" class="switch" data-tipo="${t.id}"${ligados[t.id] ? " checked" : ""}> <b>${esc(t.titulo.replaceAll("{materia}", p.materia))}</b></label>
        <div class="ge-niveis">${t.itens.flatMap(i => i.niveis.map(x => ({ ...x, vez: i.regra === "materiaEvolucao" }))).map(x => `<span class="chip off">${esc([x.n !== undefined ? (x.vez ? `${x.n} ${x.n === 1 ? "vez" : "vezes"}` : `${x.n} ${x.n === 1 ? "prova" : "provas"}`) : "", x.min !== undefined ? `mín. ${x.min}` : ""].filter(Boolean).join(" · "))} · ${esc(nome(x.nome).replaceAll("{materia}", p.materia))}</span>`).join("")}</div></div>`).join("")}
      <p class="help" style="max-width:none">As conquistas são criadas <b>desligadas</b> e marcadas como sugeridas. Ligue as que quiser e clique em Salvar conquistas.</p>`;
    c.querySelectorAll("[data-tipo]").forEach(el => el.onchange = () => { ligados[el.dataset.tipo] = el.checked; });
    $("#geIA", c)?.addEventListener("click", async e => { const b = e.currentTarget; b.disabled = true;
      try { const cfg = ctx.iaCfg(), lista = tipos.flatMap(t => t.itens).map(i => ({ id: i.tipo, t: i.t, d: i.d, regra: i.regra, niveis: i.niveis.map(x => ({ n: x.n, min: x.min, nomeAtual: x.nome })) }));
        const r = await nomesNiveisIA({ chave: cfg.chave, modelo: cfg.modelo, materia: p.materia, topicos: (p.topicos || []).map(x => x.nome), conquistas: lista });
        tipos.flatMap(t => t.itens).forEach(i => (r[i.tipo] || []).forEach((n, k) => { if (i.niveis[k]) nomesIA[i.niveis[k].nome] = n; })); pintar(); toast("Nomes sugeridos pela IA.", "ok"); }
      catch (x) { toast("🤖 " + (x.message || traduzirErro(x)), "erro"); b.disabled = false; } });
  };
  $("#geTurma", c).onchange = e => { turma = e.target.value; semestre = ""; planoId = ""; pintar(); };
  $("#geSem", c).onchange = e => { semestre = e.target.value; planoId = ""; pintar(); };
  $("#geMat", c).onchange = e => { planoId = e.target.value; pintar(); };
  pintar();
  function gerar() {
    const p = plano(); if (!p) return false;
    const itens = tipos.filter(t => ligados[t.id]).flatMap(t => t.itens);
    if (!itens.length) { toast("Ligue pelo menos um tipo.", "erro"); return false; }
    itens.forEach(i => {
      const id = `auto-${p.semestre}-${slug(p.materia)}-${i.tipo}`, ant = conqLista.findIndex(x => x.id === id);
      const nova = { id, e: i.e, t: i.t.replaceAll("{materia}", p.materia), d: i.d, regra: i.regra, grupo: REGRAS[i.regra].grupo, materia: p.materia, niveis: i.niveis.map(x => ({ ...x, nome: String(nomesIA[x.nome] ?? x.nome).replaceAll("{materia}", p.materia) })), ativa: false, sugerida: true };
      if (ant >= 0) conqLista[ant] = { ...nova, ativa: conqLista[ant].ativa }; else conqLista.push(nova);
    });
    conqAlt += itens.length; conqFiltro = { busca: "", aba: "sugeridas" }; desenharConq();
    toast(`${pl(itens.length, "conquista sugerida", "conquistas sugeridas")}: revise, ligue as que quiser e salve.`, "ok");
  }
}
