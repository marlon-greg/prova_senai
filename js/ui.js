// Componentes de interface reutilizáveis (sem Firebase). Geram HTML ou controlam comportamento.
// O comportamento é ligado por DELEGAÇÃO no document (uma vez só), então funciona também no HTML
// que as abas montam depois: basta usar as classes/atributos abaixo.
//   [data-menu]            botão que abre o menu irmão (.menu)         → menuHTML() / menu()
//   [data-popover]         botão que abre o <template> irmão           → ajudaHTML() / popover()
//   .btn-filtros           abre/fecha o .painel-filtros da .toolbar    → toolbar() / ligarFiltros()
//   details[data-chave]    lembra aberto/fechado no localStorage       → collapsible()
//   .dropzone              mostra o nome do arquivo escolhido          → dropzone()
import { $, esc } from "./common.js";

const uid = (p = "ui") => p + Math.random().toString(36).slice(2, 8);

// ---------- posicionamento de flutuantes (menu, popover) ----------
function posicionar(el, ancora, { alinhar = "fim" } = {}) {
  const r = ancora.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, vw = innerWidth, vh = innerHeight, m = 8;
  let x = alinhar === "fim" ? r.right - w : r.left, y = r.bottom + 6;
  if (y + h > vh - m && r.top - h - 6 > m) y = r.top - h - 6;   // sem espaço embaixo: abre para cima
  x = Math.max(m, Math.min(x, vw - w - m)); y = Math.max(m, Math.min(y, vh - h - m));
  el.style.left = x + "px"; el.style.top = y + "px";
}

// ---------- flutuante aberto (só um por vez) ----------
let aberto = null;   // { el, botao, fechar }
function fecharFlutuante(devolverFoco = false) {
  if (!aberto) return;
  const a = aberto; aberto = null; a.fechar();
  a.botao?.setAttribute("aria-expanded", "false");
  if (devolverFoco) a.botao?.focus();
}

// ---------- menu suspenso ----------
// itens: [{ e, t, onClick, perigo, desabilitado, atalho, id, sep, rotulo }]
export function menu(botao, itens, { alinhar = "fim" } = {}) {
  if (aberto?.botao === botao) return fecharFlutuante();
  fecharFlutuante();
  const el = document.createElement("div");
  el.className = "menu"; el.setAttribute("role", "menu"); el.id = uid("menu");
  el.innerHTML = itens.map((it, i) => it.sep ? `<hr>` : it.rotulo ? `<div class="menu-rotulo">${esc(it.rotulo)}</div>`
    : `<button type="button" role="menuitem" data-i="${i}" class="${it.perigo ? "perigo" : ""}" ${it.desabilitado ? "disabled" : ""}${it.id ? ` id="${esc(it.id)}"` : ""}>${it.e ? `<span class="e" aria-hidden="true">${it.e}</span>` : ""}<span>${esc(it.t)}</span>${it.atalho ? `<span class="atalho">${esc(it.atalho)}</span>` : ""}</button>`).join("");
  document.body.appendChild(el);
  el.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (!b) return; const it = itens[b.dataset.i]; fecharFlutuante(true); it.onClick?.(e); });
  abrirFlutuante(el, botao, alinhar, () => el.remove());
}
// menu com os botões JÁ no HTML (mantém os ids e os onclick que o JS da aba liga)
// <div class="menu-wrap"><button data-menu>Exportar ▾</button><div class="menu" role="menu" hidden> ... </div></div>
export function menuHTML({ rotulo = "⋯", aria = "Mais ações", classe = "leve", itensHTML = "", id = "" }) {
  const m = id || uid("menu");
  const icone = rotulo === "⋯";
  return `<div class="menu-wrap"><button type="button" class="${icone ? "icone" : classe}" data-menu aria-haspopup="menu" aria-expanded="false" aria-controls="${m}"${icone ? ` aria-label="${esc(aria)}" title="${esc(aria)}"` : ""}>${rotulo}</button>
    <div class="menu" role="menu" id="${m}" hidden>${itensHTML}</div></div>`;
}
// item de menu em HTML (para usar dentro de menuHTML)
export const itemMenu = ({ e = "", t, id = "", perigo = false, attrs = "" }) =>
  `<button type="button" role="menuitem"${id ? ` id="${esc(id)}"` : ""} class="${perigo ? "perigo" : ""}" ${attrs}>${e ? `<span class="e" aria-hidden="true">${e}</span>` : ""}<span>${t}</span></button>`;
function abrirMenuEstatico(botao) {
  const el = document.getElementById(botao.getAttribute("aria-controls")) || botao.parentElement.querySelector(".menu");
  if (!el) return;
  if (aberto?.botao === botao) return fecharFlutuante();
  fecharFlutuante();
  el.hidden = false;
  abrirFlutuante(el, botao, "fim", () => { el.hidden = true; });
}
function abrirFlutuante(el, botao, alinhar, fechar) {
  posicionar(el, botao, { alinhar });
  botao.setAttribute("aria-expanded", "true");
  aberto = { el, botao, fechar };
  (el.querySelector("[role=menuitem]:not(:disabled), button:not(:disabled), input, select, a[href]"))?.focus({ preventScroll: true });
}

// ---------- popover ----------
export function popover(ancora, conteudoHTML, { largura = 380, titulo = "" } = {}) {
  if (aberto?.botao === ancora) return fecharFlutuante();
  fecharFlutuante();
  const el = document.createElement("div");
  el.className = "popover"; el.setAttribute("role", "dialog"); el.id = uid("pop"); el.tabIndex = -1;
  el.style.setProperty("--largura", largura + "px");
  if (titulo) el.setAttribute("aria-label", titulo);
  el.innerHTML = (titulo ? `<p class="pop-titulo">${esc(titulo)}</p>` : "") + conteudoHTML;
  document.body.appendChild(el);
  ancora.setAttribute("aria-controls", el.id);
  abrirFlutuante(el, ancora, "fim", () => el.remove());
  el.focus({ preventScroll: true });
  return el;
}
// botão ⓘ com o texto num <template> (o conteúdo continua no HTML, só aparece no popover)
export function ajudaHTML(conteudoHTML, { titulo = "Como funciona" } = {}) {
  return `<span class="ajuda-pop"><button type="button" class="btn-ajuda" data-popover aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(titulo)}" title="${esc(titulo)}">i</button><template>${conteudoHTML}</template></span>`;
}
// transforma os <details class="ajuda"> de uma área em botões ⓘ no título do cartão
export function ajudasEmPopover(raiz = document) {
  raiz.querySelectorAll("details.ajuda:not([data-pop])").forEach(d => {
    d.dataset.pop = "1";
    const card = d.closest(".card, .drawer-corpo") || d.parentElement;
    const alvo = card.querySelector(".card-cab .cc-acoes") || card.querySelector(".card-cab h2, :scope > h2, h2");
    if (!alvo) return;
    const titulo = d.querySelector("summary")?.textContent.trim() || "Como funciona";
    const corpo = [...d.childNodes].filter(n => n.nodeName !== "SUMMARY").map(n => n.outerHTML ?? esc(n.textContent)).join("");
    const span = document.createElement("span");
    span.innerHTML = ajudaHTML(corpo, { titulo });
    const btn = span.firstElementChild;
    if (alvo.classList.contains("cc-acoes")) alvo.prepend(btn); else alvo.appendChild(btn);
    d.hidden = true;
  });
}

// ---------- toolbar de listagem ----------
// filtros: [{ id, label, opcoesHTML }] — os selects vão para o painel "Filtros" (fechado por padrão)
export function toolbar({ buscaId, placeholder = "Pesquisar…", aria = "", filtros = [], ordemId = "", ordemHTML = "", contagemId = "", extras = "", limparId = "" }) {
  const p = uid("filtros");
  return `<div class="toolbar" role="search">
    <input type="search" id="${buscaId}" placeholder="${esc(placeholder)}" aria-label="${esc(aria || placeholder)}">
    ${filtros.length ? `<button type="button" class="leve btn-filtros" aria-expanded="false" aria-controls="${p}"><span class="e" aria-hidden="true">⚙</span>Filtros<span class="badge" aria-label="filtros ativos"></span></button>` : ""}
    ${ordemId ? `<select id="${ordemId}" class="tb-ordem" aria-label="Ordenar">${ordemHTML}</select>` : ""}
    ${extras}
    ${contagemId ? `<span id="${contagemId}" class="tb-contagem" aria-live="polite"></span>` : ""}
    ${filtros.length ? `<div class="painel-filtros" id="${p}" hidden>
      ${filtros.map(f => `<label class="pf-campo"><span>${esc(f.label)}</span><select id="${f.id}" aria-label="${esc(f.label)}">${f.opcoesHTML || ""}</select></label>`).join("")}
      <div class="pf-acoes"><button type="button" class="discreto mini pf-limpar oculto"${limparId ? ` id="${limparId}"` : ""}>Limpar filtros</button></div></div>` : ""}
  </div>`;
}
// conta os filtros ativos (selects/inputs com valor no painel) e mostra "Filtros · 2" e o "Limpar"
export function atualizarFiltros(tb) {
  if (!tb) return;
  const painel = tb.querySelector(".painel-filtros");
  if (!painel) return;
  const n = [...painel.querySelectorAll("select, input:not([type=checkbox])")].filter(x => x.value && !x.dataset.padrao?.includes(x.value)).length
    + [...painel.querySelectorAll("input[type=checkbox]")].filter(x => x.checked).length;
  const badge = tb.querySelector(".btn-filtros .badge");
  if (badge) badge.textContent = n || "";
  tb.querySelector(".pf-limpar")?.classList.toggle("oculto", !n);
}
// liga uma toolbar (ou todas de uma área): o "Limpar" zera os filtros e avisa a aba pelo evento change
export function ligarFiltros(raiz = document, { onChange } = {}) {
  const tbs = raiz.matches?.(".toolbar") ? [raiz] : [...raiz.querySelectorAll(".toolbar")];
  tbs.forEach(tb => {
    if (tb.dataset.ligada) return; tb.dataset.ligada = "1";
    const painel = tb.querySelector(".painel-filtros");
    painel?.querySelectorAll("select").forEach(s => { if (s.dataset.padrao === undefined) s.dataset.padrao = s.querySelector("option")?.value ?? ""; });
    tb.addEventListener("change", () => { atualizarFiltros(tb); onChange?.(); });
    tb.querySelector(".pf-limpar")?.addEventListener("click", () => {
      painel.querySelectorAll("select").forEach(s => { s.value = s.dataset.padrao || ""; });
      painel.querySelectorAll("input[type=checkbox]").forEach(c => { c.checked = false; });
      painel.querySelector("select, input")?.dispatchEvent(new Event("change", { bubbles: true }));
      atualizarFiltros(tb);
    });
    atualizarFiltros(tb);
  });
}

// ---------- drawer (painel lateral) ----------
// corpo: string HTML OU um elemento já existente (é MOVIDO para o drawer e devolvido ao fechar, com ids e eventos)
// acoes: [{ t, classe, onClick(fechar), esquerda }] — onClick que devolve false não fecha
export function drawer({ titulo, corpoHTML = "", corpo = null, acoes = [], aoFechar = null, largo = false, ajuda = "" }) {
  const anterior = document.activeElement, idT = uid("dt");
  const fundo = document.createElement("div"); fundo.className = "drawer-fundo";
  const el = document.createElement("aside");
  el.className = "drawer" + (largo ? " largo" : ""); el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", idT);
  el.innerHTML = `<div class="drawer-cab"><h2 id="${idT}">${esc(titulo)}</h2>${ajuda ? ajudaHTML(ajuda) : ""}<button type="button" class="icone" data-fechar aria-label="Fechar painel" title="Fechar (Esc)">✕</button></div>
    <div class="drawer-corpo">${corpo ? "" : corpoHTML}</div>
    ${acoes.length ? `<div class="drawer-rodape">${acoes.map((a, i) => `<button type="button" class="${a.classe || ""}${a.esquerda ? " esquerda" : ""}" data-acao="${i}"${a.id ? ` id="${esc(a.id)}"` : ""}>${a.t}</button>`).join("")}</div>` : ""}`;
  // elemento existente: guarda o lugar para devolver depois
  let marcador = null;
  if (corpo) { marcador = document.createComment("drawer"); corpo.before(marcador); el.querySelector(".drawer-corpo").appendChild(corpo); corpo.classList.remove("oculto"); }
  document.body.append(fundo, el);
  document.body.classList.add("com-drawer");
  requestAnimationFrame(() => { fundo.classList.add("aberto"); el.classList.add("aberto"); });
  const focaveis = () => [...el.querySelectorAll("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])")].filter(x => !x.disabled && x.offsetParent !== null);
  const noTopo = () => !document.querySelector(".modal-fundo") && [...document.querySelectorAll(".drawer")].pop() === el;
  const tecla = e => {
    if (!noTopo()) return;
    if (e.key === "Escape" && !aberto) { e.preventDefault(); fechar(); }
    if (e.key === "Tab") { const fs = focaveis(), i = fs.indexOf(document.activeElement); if (!fs.length) return; e.preventDefault(); fs[(i + (e.shiftKey ? -1 : 1) + fs.length) % fs.length].focus(); }
  };
  let fechado = false;
  function fechar() {
    if (fechado) return; fechado = true;
    document.removeEventListener("keydown", tecla, true);
    el.classList.remove("aberto"); fundo.classList.remove("aberto");
    if (corpo && marcador) { marcador.after(corpo); marcador.remove(); }
    setTimeout(() => { el.remove(); fundo.remove(); if (!document.querySelector(".drawer")) document.body.classList.remove("com-drawer"); }, 260);
    aoFechar?.(); anterior?.focus?.({ preventScroll: true });
  }
  document.addEventListener("keydown", tecla, true);
  fundo.addEventListener("click", fechar);
  el.querySelector("[data-fechar]").addEventListener("click", fechar);
  el.querySelectorAll("[data-acao]").forEach(b => b.addEventListener("click", async () => {
    const a = acoes[b.dataset.acao]; if (!a.onClick) return fechar();
    b.disabled = true;
    try { if ((await a.onClick(fechar, el)) !== false) fechar(); } finally { b.disabled = false; }
  }));
  setTimeout(() => (el.querySelector(".drawer-corpo input:not([type=hidden]), .drawer-corpo select, .drawer-corpo textarea") || el.querySelector("[data-fechar]"))?.focus({ preventScroll: true }), 50);
  return { el, corpo: el.querySelector(".drawer-corpo"), fechar };
}

// ---------- bloco recolhível (lembra o estado por chave) ----------
const CHAVE_RC = "ui:recolhivel:";
// tudo que é recolhível começa FECHADO (pedido da equipe): quem quiser ver, abre
export function estaAberto() { return false; }
export function collapsible({ chave = "", titulo = "", resumoHTML = "", corpoHTML = "", aberto: padrao = false, direitaHTML = "", classe = "", attrs = "" }) {
  return `<details class="recolhivel ${classe}"${chave ? ` data-chave="${esc(chave)}"` : ""}${estaAberto(chave, padrao) ? " open" : ""} ${attrs}>
    <summary><span class="rc-titulo">${titulo}</span>${resumoHTML ? `<span class="rc-resumo">${resumoHTML}</span>` : ""}${direitaHTML ? `<span class="rc-direita">${direitaHTML}</span>` : ""}</summary>
    <div class="rc-corpo">${corpoHTML}</div></details>`;
}

// ---------- chips de seleção ----------
// opcoes: [{ v, t, e }] · retorna { valor() , definir(v) }
export function chips(container, opcoes, { multiplo = false, valor = multiplo ? [] : "", aoMudar, aria = "" } = {}) {
  let atual = multiplo ? new Set(valor) : valor;
  container.classList.add("grupo-chips"); container.setAttribute("role", "group"); if (aria) container.setAttribute("aria-label", aria);
  const desenhar = () => {
    container.innerHTML = opcoes.map(o => { const on = multiplo ? atual.has(o.v) : atual === o.v;
      return `<button type="button" class="chip${on ? " sel" : ""}" aria-pressed="${on}" data-v="${esc(o.v)}">${o.e ? `<span class="e" aria-hidden="true">${o.e}</span>` : ""}${esc(o.t)}</button>`; }).join("");
  };
  container.onclick = e => {
    const b = e.target.closest("[data-v]"); if (!b) return;
    const v = b.dataset.v;
    if (multiplo) atual.has(v) ? atual.delete(v) : atual.add(v); else atual = v;
    desenhar(); aoMudar?.(multiplo ? [...atual] : atual);
  };
  desenhar();
  return { valor: () => multiplo ? [...atual] : atual, definir: v => { atual = multiplo ? new Set(v) : v; desenhar(); } };
}

// ---------- estado vazio ----------
export function vazio({ e = "📭", texto = "Nada por aqui ainda.", acao = "" } = {}) {
  return `<div class="vazio"><span class="vz-e" aria-hidden="true">${e}</span><p>${texto}</p>${acao ? `<div class="vz-acao">${acao}</div>` : ""}</div>`;
}

// ---------- cabeçalho de cartão ----------
// primaria: HTML de um botão (ou { t, id, classe }) · menuItensHTML: itens do ⋯ · ajudaHTML: texto do ⓘ
export function cardCab({ titulo, ajuda = "", primaria = "", menuItensHTML = "", menuAria = "Mais ações", extra = "" }) {
  const p = typeof primaria === "string" ? primaria : `<button type="button"${primaria.id ? ` id="${primaria.id}"` : ""} class="${primaria.classe || ""}">${primaria.t}</button>`;
  return `<div class="card-cab"><h2>${titulo}${ajuda ? " " + ajudaHTML(ajuda) : ""}</h2><div class="cc-acoes">${extra}${p}${menuItensHTML ? menuHTML({ aria: menuAria, itensHTML: menuItensHTML }) : ""}</div></div>`;
}

// ---------- números (stat tiles) ----------
export const statTiles = itens => `<div class="stats">${itens.map(i => `<div class="stat${i.tom ? " " + i.tom : ""}"><b>${i.v}</b><span>${i.r}</span></div>`).join("")}</div>`;

// ---------- área de soltar arquivo ----------
export function dropzone({ id, accept = "", texto = "Arraste o arquivo aqui ou clique para escolher", e = "📄", compacta = false }) {
  return `<label class="dropzone${compacta ? " compacta" : ""}"><input type="file" id="${id}"${accept ? ` accept="${esc(accept)}"` : ""}><span class="dz-icone" aria-hidden="true">${e}</span><span class="dz-texto">${esc(texto)}</span><span class="dz-arquivo"></span></label>`;
}

// ---------- tarefa demorada (IA corrigindo, adaptando, lendo PDF…) ----------
// Painel fixo no canto: ampulheta animada, título, o que está fazendo agora, barra (n de total), tempo decorrido e quanto falta.
// Azul trabalhando, verde no fim, vermelho com erro. O título da aba mostra o progresso (dá para trocar de aba e acompanhar).
//   const t = tarefa({ titulo: "Corrigindo com IA", total: 12, icone: "🤖" });
//   t.passo(3, "Maria — Q2"); t.texto("Lendo o PDF…"); t.total(20); t.fim("12 corrigidas"); t.erro("Sem crédito na API")
// Sem total = barra animada (não sabe quanto falta); estimativaSeg dá uma ideia do tempo nesse caso.
let tarefasAbertas = 0;
const tituloOriginal = typeof document !== "undefined" ? document.title : "";
const relogio = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export function tarefa({ titulo, total = 0, icone = "⏳", estimativaSeg = 0, texto = "" }) {
  let pilha = document.getElementById("tarefas");
  if (!pilha) { pilha = document.createElement("div"); pilha.id = "tarefas"; pilha.className = "tarefas"; pilha.setAttribute("aria-live", "polite"); document.body.appendChild(pilha); }
  const el = document.createElement("div");
  el.className = "tarefa rodando"; el.setAttribute("role", "status");
  el.innerHTML = `<div class="tf-topo"><span class="tf-ampulheta" aria-hidden="true">⏳</span><div class="tf-tit"><b>${icone} ${esc(titulo)}</b><span class="tf-texto"></span></div>
      <button type="button" class="icone tf-fechar" aria-label="Esconder" title="Esconder (o trabalho continua)">✕</button></div>
    <div class="tf-barra${total ? "" : " indet"}"><i></i></div>
    <div class="tf-rodape"><span class="tf-n"></span><span class="tf-tempo"></span></div>`;
  pilha.appendChild(el); tarefasAbertas++;
  const ini = Date.now();
  let n = 0, tot = total, acabou = false;
  const atualizar = () => {
    const seg = (Date.now() - ini) / 1000;
    let resta = "";
    if (tot && n > 0 && n < tot) resta = ` · faltam ~${relogio(Math.max(1, seg / n * (tot - n)))}`;
    else if (!tot && estimativaSeg) resta = seg < estimativaSeg ? ` · costuma levar ~${relogio(estimativaSeg)}` : " · quase lá…";
    el.querySelector(".tf-tempo").textContent = acabou ? `em ${relogio(seg)}` : `⏱ ${relogio(seg)}${resta}`;
    el.querySelector(".tf-n").textContent = tot ? `${Math.min(n, tot)} de ${tot}` : "";
    el.querySelector(".tf-barra i").style.width = tot ? `${Math.min(100, n / tot * 100)}%` : "";
    if (!acabou) document.title = `${tot ? `(${Math.min(n, tot)}/${tot}) ` : "⏳ "}${titulo} · ${tituloOriginal}`;
  };
  const timer = setInterval(atualizar, 1000);
  el.querySelector(".tf-fechar").onclick = () => { el.classList.add("escondida"); };
  const encerrar = (classe, msg, ms) => {
    if (acabou) return; acabou = true; clearInterval(timer);
    el.classList.remove("rodando"); el.classList.add(classe);
    el.querySelector(".tf-ampulheta").textContent = classe === "ok" ? "✅" : "⚠️";
    el.querySelector(".tf-barra").classList.remove("indet");
    if (classe === "ok") { n = tot || 1; tot = tot || 1; }
    if (msg !== undefined) el.querySelector(".tf-texto").textContent = msg;
    atualizar(); el.classList.remove("escondida");
    if (--tarefasAbertas <= 0) document.title = tituloOriginal;
    setTimeout(() => { el.classList.add("saindo"); setTimeout(() => el.remove(), 400); }, ms);
  };
  const api = {
    passo(i, txt) { n = i; if (txt !== undefined) el.querySelector(".tf-texto").textContent = txt; atualizar(); return api; },
    texto(txt) { el.querySelector(".tf-texto").textContent = txt; return api; },
    total(t) { tot = t; el.querySelector(".tf-barra").classList.toggle("indet", !t); atualizar(); return api; },
    fim(msg = "Pronto!") { encerrar("ok", msg, 5000); },
    erro(msg = "Não deu certo.") { encerrar("falhou", msg, 12000); }
  };
  if (texto) api.texto(texto);
  atualizar();
  return api;
}

// ---------- delegação global (liga uma vez) ----------
if (!window.__uiLigado) {
  window.__uiLigado = true;
  document.addEventListener("click", e => {
    const bMenu = e.target.closest("[data-menu]");
    if (bMenu) { e.preventDefault(); abrirMenuEstatico(bMenu); return; }
    const bPop = e.target.closest("[data-popover]");
    if (bPop) { const t = bPop.parentElement.querySelector("template"); popover(bPop, t ? t.innerHTML : "", { titulo: bPop.getAttribute("aria-label") || "" }); return; }
    const bFil = e.target.closest(".btn-filtros");
    if (bFil) {
      const p = document.getElementById(bFil.getAttribute("aria-controls")); if (!p) return;
      p.hidden = !p.hidden; bFil.setAttribute("aria-expanded", String(!p.hidden));
      if (!p.hidden && e.detail === 0) p.querySelector("select, input")?.focus();   // só pelo teclado (o clique não deixa anel de foco preso)
      return;
    }
    // clicar num item do menu estático fecha o menu (o onclick do item continua rodando)
    if (aberto && e.target.closest(".menu [role=menuitem]") && aberto.el.contains(e.target)) { setTimeout(() => fecharFlutuante(), 0); return; }
    if (aberto && !aberto.el.contains(e.target)) fecharFlutuante();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && aberto) { e.stopPropagation(); fecharFlutuante(true); return; }
    if (aberto?.el.classList.contains("menu") && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      const itens = [...aberto.el.querySelectorAll("[role=menuitem]:not(:disabled)")], i = itens.indexOf(document.activeElement);
      e.preventDefault(); itens[(i + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length]?.focus();
    }
    // item de menu que é um <label> (ex.: enviar arquivo): Enter/Espaço clica
    if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("label[role=menuitem]")) { e.preventDefault(); e.target.click(); return; }
    // Esc fecha o painel de filtros aberto
    if (e.key === "Escape") { const p = e.target.closest?.(".painel-filtros"); if (p) { p.hidden = true; const b = document.querySelector(`[aria-controls="${p.id}"]`); b?.setAttribute("aria-expanded", "false"); b?.focus(); } }
  }, true);
  addEventListener("resize", () => fecharFlutuante());
  // rolar a página: o flutuante acompanha o botão; só fecha se o botão sair da tela
  addEventListener("scroll", e => {
    if (!aberto || aberto.el.contains(e.target)) return;
    const r = aberto.botao.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !aberto.botao.isConnected) fecharFlutuante();
    else posicionar(aberto.el, aberto.botao, { alinhar: "fim" });
  }, true);
  // details com data-chave: lembra aberto/fechado
  document.addEventListener("toggle", e => { const d = e.target; if (d.matches?.("details[data-chave]")) localStorage.setItem(CHAVE_RC + d.dataset.chave, d.open ? "1" : "0"); }, true);
  // dropzone: nome do arquivo e destaque ao arrastar
  document.addEventListener("change", e => {
    const z = e.target.closest?.(".dropzone"); if (!z || e.target.type !== "file") return;
    const f = e.target.files?.[0]; const s = z.querySelector(".dz-arquivo"); if (s) s.textContent = f ? `✔ ${f.name}` : "";
    z.classList.toggle("tem-arquivo", !!f);
  });
  ["dragenter", "dragover"].forEach(t => document.addEventListener(t, e => e.target.closest?.(".dropzone")?.classList.add("arrastando")));
  ["dragleave", "drop"].forEach(t => document.addEventListener(t, e => e.target.closest?.(".dropzone")?.classList.remove("arrastando")));
}
export { $ };
