// Painel → aba "Gamificação" (admin): liga e desliga cada parte, e abre a simulação "ver como aluno".
// Painel → aba "Retorno dos alunos" (professor/admin): apontamentos nas questões e sugestões para o sistema.
import { db, esc, $, toast, confirmar, traduzirErro, dataBR, GAMI_PADRAO, lerGamificacao } from "./common.js";
import { CONQUISTAS_PADRAO, REGRAS, CAMPOS_DIARIO } from "./conquistas.js";
import { CATALOGO } from "./avatar.js";
import { sugerirConquistasIA } from "./ia.js";
import { menuHTML, itemMenu, vazio, collapsible, chips, tarefa } from "./ui.js";
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

// ---------- 🏅 editor das conquistas (config/conquistas.lista) ----------
let conqLista = [];
const skinsDe = id => Object.values(CATALOGO).flat().filter(i => i.trava?.medalha === id).map(i => i.nome);
export async function carregarConquistasAdmin() {
  const d = await getDoc(doc(db, "config", "conquistas")).catch(() => null);
  conqLista = structuredClone(d?.data()?.lista?.length ? d.data().lista : CONQUISTAS_PADRAO).map(c => ({ ativa: true, ...c }));
  desenharConq();
}
// temas do editor: saem da regra (dá para trocar no ✎ de cada conquista). Fechados por padrão; lembram aberto/fechado.
const TEMAS = {
  participacao: { t: "🎓 Participação", d: "fazer provas" }, notas: { t: "🎯 Notas altas", d: "notas e sequências de notas" },
  evolucao: { t: "📈 Evolução", d: "melhorar em relação à prova anterior" }, foco: { t: "❤️ Foco na prova", d: "provas sem perder vida" },
  materia: { t: "📚 Por matéria", d: "valem em cada matéria; use {materia} no título" },
  presenca: { t: "📅 Presença na sala", d: "diário · alunos com acessibilidade" }, aprendizagem: { t: "🧠 Aprendizagem na sala", d: "diário · alunos com acessibilidade" },
  estrelas: { t: "⭐ Estrelas e vitórias", d: "diário · alunos com acessibilidade" }, outras: { t: "✨ Outras", d: "" }
};
function temaAuto(c) {
  if (c.tema && TEMAS[c.tema]) return c.tema;
  const r = c.regra;
  if (r === "provas") return "participacao";
  if (["nota", "notasSeguidas", "materiasMin"].includes(r)) return "notas";
  if (r === "evolucao") return "evolucao";
  if (r === "semVidas") return "foco";
  if (String(r).startsWith("materia")) return "materia";
  if (r === "diario") return ["aulas", "sequencia"].includes(c.campo) ? "presenca" : ["estrelas", "vitorias"].includes(c.campo) ? "estrelas" : "aprendizagem";
  return "outras";
}
const nn = v => v ?? "?";
function resumoRegra(c) {
  return ({ provas: `fez ${nn(c.n)} prova(s)`, nota: `uma nota ≥ ${nn(c.min)}`, notasSeguidas: `${nn(c.n)} notas seguidas ≥ ${nn(c.min)}`, evolucao: `melhorou ${nn(c.n)} vez(es)`,
    semVidas: `${nn(c.n)} provas sem perder vida`, materiasMin: `nota ≥ ${nn(c.min)} em ${nn(c.n)} matérias`, materiaNota: `na matéria: nota ≥ ${nn(c.min)}`,
    materiaMedia: `na matéria: média ≥ ${nn(c.min)} com ${nn(c.n)} provas`, materiaEvolucao: `na matéria: melhorou ${nn(c.n)} vez(es)`,
    diario: `${CAMPOS_DIARIO[c.campo] || "diário"} ≥ ${nn(c.n)}` })[c.regra] || "regra não reconhecida";
}
let conqAbertas = new Set(), conqFiltro = { busca: "", estado: "todas" };
const normC = s => String(s || "").toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "");
function desenharConq() {
  const box = $("#conqEditor"), admin = ctx.ehAdmin(), ia = !!(ctx.iaCfg?.() || ctx.urlCorretor?.()), dis = admin ? "" : "disabled";
  const campo = (c, i, k) => k === "campo" ? `<label class="cq-num">Contador<select data-i="${i}" data-k="campo" ${dis}>${Object.entries(CAMPOS_DIARIO).map(([v, r]) => `<option value="${v}"${c.campo === v ? " selected" : ""}>${esc(r)}</option>`).join("")}</select></label>`
    : `<label class="cq-num">${k === "n" ? "N" : "mín."}<input type="number" min="0" max="${k === "min" ? 100 : 500}" data-i="${i}" data-k="${k}" value="${c[k] ?? ""}" ${dis}></label>`;
  const item = (c, i) => { const sk = skinsDe(c.id);
    return `<div class="cq-item${c.ativa === false ? " desligada" : ""}" data-item="${i}" data-busca="${esc(normC(`${c.t} ${c.d || ""} ${resumoRegra(c)}`))}">
      <span class="interruptor-g" title="Ligada"><input type="checkbox" data-i="${i}" data-k="ativa"${c.ativa !== false ? " checked" : ""} ${dis} aria-label="Conquista ${esc(c.t)} ligada"><i></i></span>
      <details class="cq-det" data-id="${esc(c.id)}"${conqAbertas.has(c.id) ? " open" : ""}>
        <summary><span class="cq-e" aria-hidden="true">${esc(c.e || "🏅")}</span><span class="cq-tit"><b>${esc(c.t)}</b><span class="pequeno">${esc(resumoRegra(c))}${c.d ? ` · ${esc(c.d)}` : ""}</span></span>
          ${sk.length ? `<span class="chip info" title="Libera: ${esc(sk.join(", "))}">🎨 ${sk.length} skin(s)</span>` : ""}<span class="cq-editar pequeno">${admin ? "✎ editar" : "ver"}</span></summary>
        <div class="cq-corpo">
          <div class="cq-l1"><label class="cq-num">Emoji<input type="text" class="cq-emoji" data-i="${i}" data-k="e" value="${esc(c.e)}" maxlength="4" ${dis}></label>
            <label class="cq-num cq-cresce">Título<input type="text" data-i="${i}" data-k="t" value="${esc(c.t)}" maxlength="60" ${dis}></label></div>
          <label class="cq-num cq-cresce">Descrição (o aluno vê)<input type="text" data-i="${i}" data-k="d" value="${esc(c.d || "")}" maxlength="160" ${dis}></label>
          <div class="cq-l1"><label class="cq-num cq-cresce">Regra (quando o aluno ganha)<select data-i="${i}" data-k="regra" ${dis}>${Object.entries(REGRAS).map(([k, r]) => `<option value="${k}"${c.regra === k ? " selected" : ""}>${esc(r.nome)}</option>`).join("")}</select></label>
            ${(REGRAS[c.regra]?.campos || []).map(k => campo(c, i, k)).join("")}
            <label class="cq-num">Tema<select data-i="${i}" data-k="tema" ${dis}><option value="">automático</option>${Object.entries(TEMAS).map(([k, x]) => `<option value="${k}"${c.tema === k ? " selected" : ""}>${esc(x.t)}</option>`).join("")}</select></label></div>
          ${sk.length ? `<p class="pequeno" style="margin:0">🎨 Libera no personagem: ${sk.map(esc).join(", ")}. Se apagar esta conquista, essas skins ficam sem jeito de liberar.</p>` : ""}
        </div></details>
      ${admin ? menuHTML({ aria: `Mais ações: ${c.t}`, itensHTML: itemMenu({ e: "⧉", t: "Duplicar", attrs: `data-dup="${i}"` }) + itemMenu({ e: "🗑", t: "Apagar", perigo: true, attrs: `data-del="${i}"` }) }) : ""}
    </div>`; };
  const porTema = {};
  conqLista.forEach((c, i) => (porTema[temaAuto(c)] ||= []).push([c, i]));
  const ligadas = conqLista.filter(c => c.ativa !== false).length;
  box.innerHTML = `<div class="cq-barra">
      <div class="toolbar" role="search"><input type="search" id="cqBusca" placeholder="Buscar conquista…" aria-label="Buscar conquista" value="${esc(conqFiltro.busca)}">
        <div id="cqEstado"></div><span class="tb-contagem" id="cqContagem">${ligadas} de ${conqLista.length} ligadas</span></div>
      ${admin ? `<div class="cq-acoes"><button type="button" class="leve" id="cqNova">+ Nova</button><button type="button" id="cqSalvar">Salvar conquistas</button>
        ${menuHTML({ aria: "Mais ações das conquistas", itensHTML: (ia ? itemMenu({ e: "🤖", t: "Sugerir novas com IA", id: "cqIA" }) : "") + itemMenu({ e: "↺", t: "Restaurar o padrão", id: "cqPadrao" }) })}</div>` : ""}
    </div>` +
    Object.keys(TEMAS).filter(k => porTema[k]?.length).map(k => { const l = porTema[k], on = l.filter(([c]) => c.ativa !== false).length;
      return collapsible({ chave: `conq:tema:${k}`, classe: "cq-tema", titulo: TEMAS[k].t, attrs: `data-tema="${k}"${l.some(([c]) => conqAbertas.has(c.id)) ? " open" : ""}`,
        resumoHTML: `<span class="chip">${l.length}</span>${on < l.length ? `<span class="chip off">${l.length - on} desligada(s)</span>` : ""}${TEMAS[k].d ? `<span class="pequeno">${esc(TEMAS[k].d)}</span>` : ""}`,
        corpoHTML: l.map(([c, i]) => item(c, i)).join("") }); }).join("") +
    `<p class="pequeno cq-nada oculto">Nenhuma conquista com esse filtro.</p>` +
    (admin ? `<p class="pequeno">As mudanças valem para todos os alunos ao recarregar a página. Clique numa conquista para editar; o ⋯ duplica ou apaga.</p>` : "");
  // filtro: busca + ligadas/desligadas (com busca, os temas abrem)
  const filtrar = () => {
    const t = normC(conqFiltro.busca), est = conqFiltro.estado;
    box.querySelectorAll(".cq-tema").forEach(tm => {
      let n = 0;
      tm.querySelectorAll(".cq-item").forEach(el => { const c = conqLista[+el.dataset.item];
        const ok = (!t || el.dataset.busca.includes(t)) && (est === "todas" || (est === "ligadas") === (c.ativa !== false)); el.classList.toggle("oculto", !ok); n += ok; });
      tm.classList.toggle("oculto", !n); if (t && n) tm.open = true;
    });
    box.querySelector(".cq-nada").classList.toggle("oculto", !!box.querySelector(".cq-tema:not(.oculto)"));
  };
  chips($("#cqEstado", box), [{ v: "todas", t: "Todas" }, { v: "ligadas", t: "Ligadas" }, { v: "desligadas", t: "Desligadas" }], { valor: conqFiltro.estado, aria: "Mostrar", aoMudar: v => { conqFiltro.estado = v; filtrar(); } });
  $("#cqBusca", box).oninput = e => { conqFiltro.busca = e.target.value; filtrar(); };
  filtrar();
  box.querySelectorAll("details.cq-det").forEach(d => d.ontoggle = () => d.open ? conqAbertas.add(d.dataset.id) : conqAbertas.delete(d.dataset.id));
  box.querySelectorAll("[data-k]").forEach(el => el.onchange = () => {
    const c = conqLista[+el.dataset.i], k = el.dataset.k;
    c[k] = k === "ativa" ? el.checked : ["n", "min"].includes(k) ? (el.value === "" ? null : Number(el.value)) : el.value;
    if (k === "tema" && !el.value) delete c.tema;
    if (k === "regra") { c.grupo = REGRAS[c.regra].grupo; if (c.regra === "diario" && !c.campo) c.campo = "aulas"; }
    if (k === "ativa") { el.closest(".cq-item").classList.toggle("desligada", !el.checked); $("#cqContagem").textContent = `${conqLista.filter(x => x.ativa !== false).length} de ${conqLista.length} ligadas`; }
    else desenharConq();   // o resumo, o tema e os campos da regra mudam
  });
  box.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { const c = conqLista[+b.dataset.del], sk = skinsDe(c.id);
    if (!(await confirmar(`Apagar a conquista "${c.t}"?${sk.length ? ` Ela libera ${sk.join(", ")} no personagem: essas skins ficam sem jeito de liberar.` : ""} (Só vale depois de Salvar conquistas.)`, { titulo: "Apagar conquista", ok: "Apagar", perigo: true }))) return;
    conqLista.splice(+b.dataset.del, 1); desenharConq(); });
  box.querySelectorAll("[data-dup]").forEach(b => b.onclick = () => { const o = conqLista[+b.dataset.dup], c = { ...structuredClone(o), id: "c-" + Date.now().toString(36), t: o.t + " (cópia)", ativa: false };
    conqLista.splice(+b.dataset.dup + 1, 0, c); conqAbertas.add(c.id); desenharConq(); });
  $("#cqNova")?.addEventListener("click", () => { const c = { id: "c-" + Date.now().toString(36), e: "🏅", t: "Nova conquista", d: "", grupo: "geral", regra: "provas", n: 1, ativa: true };
    conqLista.push(c); conqAbertas.add(c.id); conqFiltro = { busca: "", estado: "todas" }; desenharConq();
    box.querySelector(`details.cq-det[data-id="${c.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); });
  $("#cqPadrao")?.addEventListener("click", async () => {
    if (!(await confirmar("Restaurar as conquistas do padrão? As suas mudanças e as conquistas criadas somem da lista (só vale depois de Salvar conquistas).", { titulo: "Restaurar o padrão", ok: "Restaurar", perigo: true }))) return; conqLista = structuredClone(CONQUISTAS_PADRAO).map(c => ({ ativa: true, ...c })); desenharConq(); toast("Padrão carregado. Clique em Salvar para valer.", "info"); });
  $("#cqSalvar")?.addEventListener("click", async () => {
    const ruim = conqLista.find(c => !String(c.t || "").trim() || (REGRAS[c.regra]?.campos || []).some(k => k !== "campo" && !(Number(c[k]) >= 0 && c[k] !== null && c[k] !== "")));
    if (ruim) return toast(`Confira “${ruim.t || "sem título"}”: falta título ou número.`, "erro");
    if (!(await confirmar(`Salvar as ${conqLista.length} conquista(s) (${conqLista.filter(c => c.ativa !== false).length} ligadas)? Vale para todos os alunos ao recarregar a página.`, { titulo: "Salvar conquistas", ok: "Salvar" }))) return;
    try { await setDoc(doc(db, "config", "conquistas"), { lista: conqLista.map(c => ({ ...c, t: c.t.trim(), d: String(c.d || "").trim() })), atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email }); toast("Conquistas salvas 🏅", "ok"); }
    catch (e) { toast(traduzirErro(e), "erro"); }
  });
  $("#cqIA")?.addEventListener("click", async () => {
    const pedido = prompt("O que você quer de conquistas novas? (ex.: conquistas para quem melhora em Banco de Dados; algo para a semana de provas)", "") ?? null;
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
      conqLista.push(...novas.map(c => ({ ...c, ativa: false })));
      tf.fim(`${novas.length} sugestão(ões)`); novas.forEach(c => conqAbertas.add(c.id)); conqFiltro = { busca: "", estado: "desligadas" };
      desenharConq(); toast(`🤖 ${novas.length} sugestão(ões) abertas e desligadas (filtro Desligadas): revise, ligue as que gostar e salve.`, "ok");
    } catch (e) { tf.erro(e.message || traduzirErro(e)); toast("🤖 " + (e.message || traduzirErro(e)), "erro"); }
  });
}
