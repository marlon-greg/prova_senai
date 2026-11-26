// Editores de Levantamento de Requisitos para as questões do tipo "diagrama": casos de uso e atividades (SVG),
// matriz de rastreabilidade, documento de requisitos, quadro Kanban, histórias de usuário e mapa de empatia.
// Nada de prompt()/alert()/confirm(): na prova, caixas do navegador tiram da tela cheia (conta como saída).
// A edição é sempre no próprio lugar (campos e caixas de texto sobre o desenho).
//
// API:
//   montarDiagramaReq(container, { tipo, valor, onMudar(valorString), somenteLeitura })
//        → { valor(): string ('' se vazio), destruir() }
//   htmlDiagramaReq(valor) → HTML/SVG só leitura (gabarito, painel do professor)
//
// O formato guardado e a lógica (texto para a IA, comparação) ficam em servidor/diagramas-req.js.
// O editor preenche a altura do container (dê uma altura fixa a ele); o CSS vem de css/diagramas-req.css.

import {
  TIPOS, AREAS_EMPATIA, TIPOS_REQ, CATEGORIAS_RNF, PRIORIDADES, STATUS_REQ, TIPOS_COL,
  lerDiagrama, novoDiagrama, diagramaVazio, dentro, novoId
} from "../servidor/diagramas-req.js";

export { TIPOS };

const CSS_URL = new URL("../css/diagramas-req.css", import.meta.url).href;
let cssPronto = null;
// promessa resolvida quando o CSS carregou (as alturas das caixas de texto dependem dele)
function garantirCss() {
  if (typeof document === "undefined" || document.querySelector("link[data-dreq-css]")) return;
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === CSS_URL)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = CSS_URL; l.setAttribute("data-dreq-css", "1");
  cssPronto = new Promise((ok) => { l.onload = l.onerror = ok; });
  document.head.appendChild(l);
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const limpa = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const ehCampo = (el) => !!el && el.matches?.("input:not([type=checkbox]):not([type=radio]):not([type=button]), textarea, select, [contenteditable=true]");
let seq = 0;

// classe de cor da prioridade
function classePrio(p) {
  const k = String(p || "").toLowerCase();
  if (k === "alta" || k === "must") return "alta";
  if (k === "média" || k === "media" || k === "should") return "media";
  if (k === "baixa" || k === "could") return "baixa";
  if (k === "won't") return "nao";
  return "";
}
function opcoes(lista, atual, vazio = "—") {
  return (vazio != null ? `<option value="">${esc(vazio)}</option>` : "") +
    lista.map((o) => { const [v, r] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${v === atual ? " selected" : ""}>${esc(r)}</option>`; }).join("");
}
function opcoesPrio(atual) {
  return `<option value="">—</option><optgroup label="Nível">${opcoes(["Alta", "Média", "Baixa"], atual, null)}</optgroup><optgroup label="MoSCoW">${opcoes(["Must", "Should", "Could", "Won't"], atual, null)}</optgroup>` +
    (atual && !PRIORIDADES.includes(atual) ? `<option selected>${esc(atual)}</option>` : "");
}
// próximo código livre: RF01, RF02...
function proximoCod(lista, prefixo) {
  let max = 0;
  const re = new RegExp("^" + prefixo + "(\\d+)$", "i");
  lista.forEach((o) => { const m = re.exec(limpa(o.cod)); if (m) max = Math.max(max, Number(m[1])); });
  return prefixo + String(max + 1).padStart(2, "0");
}
function moverNoVetor(vet, i, j) { if (i < 0 || j < 0 || i >= vet.length || j >= vet.length) return; const [x] = vet.splice(i, 1); vet.splice(j, 0, x); }
// altura da caixa de texto acompanha o conteúdo (field-sizing no Chrome; nos outros, pelo scrollHeight)
const TAMANHO_CSS = typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content");
function autoAltura(t) { if (TAMANHO_CSS) return; t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; }

/* ══════════════════════ desenho SVG (casos de uso / atividades) ══════════════════════ */
const COR = "#1e293b", FUNDO = "#ffffff", SUAVE = "#eef2f7", AZUL = "#2459c7";

function quebrar(txt, largura, tam) {
  const max = Math.max(4, Math.floor(largura / (tam * 0.56))), out = [];
  String(txt || "").split("\n").forEach((par) => {
    let linha = "";
    par.split(/\s+/).forEach((p) => {
      if (!p) return;
      if ((linha + " " + p).trim().length > max && linha) { out.push(linha); linha = p; } else linha = (linha + " " + p).trim();
    });
    out.push(linha);
  });
  return out;
}
function textoSVG(txt, cx, cy, largura, opt = {}) {
  const tam = opt.tam || 13, ls = quebrar(txt, largura, tam), alt = tam * 1.2, y0 = cy - ((ls.length - 1) * alt) / 2;
  return `<text x="${cx}" y="${y0}" font-size="${tam}" text-anchor="${opt.ancora || "middle"}" dominant-baseline="middle" fill="${opt.cor || COR}"` +
    (opt.peso ? ` font-weight="${opt.peso}"` : "") + (opt.italico ? ' font-style="italic"' : "") + ' font-family="Inter,Segoe UI,Arial,sans-serif">' +
    ls.map((l, i) => `<tspan x="${cx}" y="${y0 + i * alt}">${esc(l)}</tspan>`).join("") + "</text>";
}
function forma(t) { return t === "caso" || t === "inicio" || t === "fim" ? "eli" : t === "decisao" ? "los" : "ret"; }
function borda(e, alvo) {
  // ator: sai do centro do boneco; para baixo, só depois do nome (a seta não cobre o texto)
  if (e.t === "ator") {
    const cx = e.x + e.w / 2, cy = e.y + 35, dx = alvo.x - cx, dy = alvo.y - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const k = Math.min(22 / Math.abs(dx || 1e-9), (dy > 0 ? e.h - 35 + 4 : 37) / Math.abs(dy || 1e-9));
    return { x: cx + dx * k, y: cy + dy * k };
  }
  const caixa = e;
  const cx = caixa.x + caixa.w / 2, cy = caixa.y + caixa.h / 2, dx = alvo.x - cx, dy = alvo.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const a = caixa.w / 2, b = caixa.h / 2, f = forma(e.t);
  let k;
  if (f === "eli") k = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
  else if (f === "los") k = 1 / (Math.abs(dx) / a + Math.abs(dy) / b);
  else k = Math.min(a / Math.abs(dx || 1e-9), b / Math.abs(dy || 1e-9));
  return { x: cx + dx * k, y: cy + dy * k };
}
const centroDe = (e) => (e.t === "ator" ? { x: e.x + e.w / 2, y: e.y + 35 } : { x: e.x + e.w / 2, y: e.y + e.h / 2 });
function boneco(cx, y) {
  return `<circle cx="${cx}" cy="${y + 11}" r="10" fill="${FUNDO}" stroke="${COR}" stroke-width="1.6"/>` +
    `<path d="M${cx} ${y + 21} V${y + 48} M${cx - 17} ${y + 30} H${cx + 17} M${cx} ${y + 48} L${cx - 14} ${y + 66} M${cx} ${y + 48} L${cx + 14} ${y + 66}" stroke="${COR}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
}
function desenharEl(e) {
  const { x, y, w, h } = e, cx = x + w / 2, cy = y + h / 2, st = ` stroke="${COR}" stroke-width="1.6"`;
  switch (e.t) {
    case "sistema":
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#f8fafc"${st}/>` + textoSVG(e.txt, cx, y + 20, w - 20, { peso: 700 });
    case "ator":
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/>` + boneco(cx, y) + textoSVG(e.txt, cx, y + 84, w + 60);
    case "caso":
      return `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="${FUNDO}"${st}/>` + textoSVG(e.txt, cx, cy, w - 30);
    case "nota":
      return `<path d="M${x} ${y} H${x + w - 14} L${x + w} ${y + 14} V${y + h} H${x} Z" fill="#fefce8"${st}/>` +
        `<path d="M${x + w - 14} ${y} V${y + 14} H${x + w}" fill="none"${st}/>` + textoSVG(e.txt, cx, cy, w - 16, { tam: 12 });
    case "raia":
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f8fafc"${st}/><rect x="${x}" y="${y}" width="${w}" height="36" fill="${SUAVE}"${st}/>` +
        textoSVG(e.txt, cx, y + 18, w - 12, { peso: 700 });
    case "inicio": return `<circle cx="${cx}" cy="${cy}" r="${w / 2}" fill="${COR}"/>`;
    case "fim": return `<circle cx="${cx}" cy="${cy}" r="${w / 2}" fill="${FUNDO}"${st}/><circle cx="${cx}" cy="${cy}" r="${Math.max(3, w / 2 - 6)}" fill="${COR}"/>`;
    case "acao": return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${FUNDO}"${st}/>` + textoSVG(e.txt, cx, cy, w - 20);
    case "decisao":
      return `<path d="M${cx} ${y} L${x + w} ${cy} L${cx} ${y + h} L${x} ${cy} Z" fill="${FUNDO}"${st}/>` +
        (limpa(e.txt) ? textoSVG(e.txt, x + w + 6, y - 6, 180, { ancora: "start", tam: 12, italico: true }) : "");
    case "fork": return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${COR}"/>`;
    default: return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FUNDO}"${st}/>` + textoSVG(e.txt, cx, cy, w - 10);
  }
}
function marcadores(p) {
  const m = (id, d, cheio, cor) => `<marker id="${p}${id}" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="${d}" fill="${cheio ? cor : "none"}" stroke="${cor}" stroke-width="1.4"/></marker>`;
  return "<defs>" + m("seta", "M1 1 L11 6 L1 11 Z", true, COR) + m("aberta", "M1 1 L11 6 L1 11", false, COR) +
    m("setaS", "M1 1 L11 6 L1 11 Z", true, AZUL) + m("abertaS", "M1 1 L11 6 L1 11", false, AZUL) +
    `<marker id="${p}triang" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M1 1 L13 7 L1 13 Z" fill="${FUNDO}" stroke="${COR}" stroke-width="1.4"/></marker>` +
    `<marker id="${p}triangS" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M1 1 L13 7 L1 13 Z" fill="${FUNDO}" stroke="${AZUL}" stroke-width="1.4"/></marker></defs>`;
}
function desenharLi(l, d, porId, p, selecionado) {
  const a = porId[l.de], b = porId[l.para];
  if (!a || !b) return "";
  const comNota = a.t === "nota" || b.t === "nota";
  const est = comNota ? { tr: true } : l.t === "include" || l.t === "extend" ? { tr: true, fim: "aberta" } : l.t === "gen" ? { fim: "triang" } : l.t === "assoc" ? {} : { fim: "seta" };
  const T = TIPOS[d.tipo], rotulo = ((T.li[l.t]?.estereotipo && !comNota ? T.li[l.t].estereotipo + " " : "") + (l.txt || "")).trim();
  const cor = selecionado ? AZUL : COR;
  let p1 = borda(a, centroDe(b)), p2 = borda(b, centroDe(a));
  // ida e volta entre as mesmas peças: afasta as duas linhas para não ficarem uma sobre a outra
  if (d.li.some((o) => o !== l && o.de === l.para && o.para === l.de)) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1, nx = (-dy / len) * 9, ny = (dx / len) * 9;
    p1 = { x: p1.x + nx, y: p1.y + ny }; p2 = { x: p2.x + nx, y: p2.y + ny };
  }
  const caminho = `M${p1.x} ${p1.y} L${p2.x} ${p2.y}`, mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2 - 10;
  let s = `<g data-li="${esc(l.id)}"><path d="${caminho}" stroke="transparent" stroke-width="16" fill="none" style="cursor:pointer"/>` +
    `<path d="${caminho}" stroke="${cor}" stroke-width="${selecionado ? 2.4 : 1.6}" fill="none"${est.tr ? ' stroke-dasharray="7 5"' : ""}${est.fim ? ` marker-end="url(#${p}${est.fim}${selecionado ? "S" : ""})"` : ""}/>`;
  if (rotulo) {
    const lw = Math.min(260, rotulo.length * 7 + 12);
    s += `<rect x="${mx - lw / 2}" y="${my - 9}" width="${lw}" height="18" rx="4" fill="${FUNDO}" opacity=".92"/>` +
      `<text x="${mx}" y="${my}" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="${cor}" font-family="Inter,Segoe UI,Arial,sans-serif">${esc(rotulo)}</text>`;
  }
  return s + "</g>";
}
function ordemDesenho(d) { const T = TIPOS[d.tipo]; return d.el.slice().sort((a, b) => (T.el[b.t].cont ? 1 : 0) - (T.el[a.t].cont ? 1 : 0)); }
function conteudoSVG(d, p, sel, extra) {
  const porId = Object.fromEntries(d.el.map((e) => [e.id, e])), T = TIPOS[d.tipo];
  let h = marcadores(p);
  ordemDesenho(d).forEach((e) => {
    const s = sel && sel.k === "el" && sel.id === e.id;
    h += `<g data-el="${esc(e.id)}" style="cursor:move">` + desenharEl(e);
    if (s) {
      h += `<rect x="${e.x - 4}" y="${e.y - 4}" width="${e.w + 8}" height="${e.h + 8}" fill="none" stroke="${AZUL}" stroke-width="1.5" stroke-dasharray="4 3" pointer-events="none"/>`;
      if (e.t !== "ator" && e.t !== "inicio" && e.t !== "fim") h += `<rect data-handle="1" x="${e.x + e.w - 2}" y="${e.y + e.h - 2}" width="12" height="12" rx="2" fill="${AZUL}" style="cursor:nwse-resize"/>`;
      if (!T.el[e.t].cont) { const cx = e.x + e.w + 16, cy = e.t === "ator" ? e.y + 35 : e.y + e.h / 2; h += `<g data-conector="1" style="cursor:crosshair"><circle cx="${cx}" cy="${cy}" r="11" fill="${AZUL}"/><path d="M${cx - 5} ${cy} H${cx + 5} M${cx} ${cy - 5} V${cy + 5}" stroke="#fff" stroke-width="2"/><title>Arraste até outra peça para ligar</title></g>`; }
    }
    h += "</g>";
  });
  d.li.forEach((l) => { h += desenharLi(l, d, porId, p, sel && sel.k === "li" && sel.id === l.id); });
  if (extra) h += extra;
  return h;
}
function limites(d) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  d.el.forEach((e) => {
    const extraX = e.t === "ator" ? 40 : e.t === "decisao" && limpa(e.txt) ? 180 : 0;
    x0 = Math.min(x0, e.x - (e.t === "ator" ? 40 : 0)); y0 = Math.min(y0, e.y - (e.t === "decisao" && limpa(e.txt) ? 20 : 0));
    x1 = Math.max(x1, e.x + e.w + extraX); y1 = Math.max(y1, e.y + e.h + (e.t === "ator" ? 14 : 0));
  });
  return isFinite(x0) ? { x0, y0, x1, y1 } : null;
}
function svgGrafico(d) {
  const lim = limites(d) || { x0: 0, y0: 0, x1: 300, y1: 80 }, p = "dv" + (++seq) + "_";
  const vb = `${lim.x0 - 20} ${lim.y0 - 20} ${lim.x1 - lim.x0 + 40} ${lim.y1 - lim.y0 + 40}`;
  return `<svg class="dreq-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" style="max-width:${Math.round(lim.x1 - lim.x0 + 40)}px" role="img" aria-label="${esc(TIPOS[d.tipo].nome)}">` +
    conteudoSVG(d, p, null) + (d.el.length ? "" : `<text x="10" y="40" fill="#64748b" font-size="13">(diagrama em branco)</text>`) + "</svg>";
}

/* ══════════════════════ visões só leitura ══════════════════════ */
const chipPrio = (p) => (limpa(p) ? `<span class="dreq-prio dreq-prio-${classePrio(p)}">${esc(p)}</span>` : "");
function verMatriz(d) {
  const cod = (r) => esc(limpa(r.cod) || "?");
  const marcas = new Set(d.x.map((p) => p[0] + "|" + p[1]));
  let h = `<div class="dreq-rolagem"><table class="dreq-tab dreq-matriz dreq-ver-tab"><thead><tr><th>ID</th><th class="dreq-c-desc">Requisito</th><th>Tipo</th><th>Prioridade</th>` +
    (d.req.some((r) => limpa(r.origem) || limpa(r.status)) ? "<th>Origem</th><th>Status</th>" : "") +
    d.col.map((c) => `<th class="dreq-art dreq-art-${c.tipo}" title="${esc(c.nome)}"><div class="dreq-art-tipo">${esc(TIPOS_COL[c.tipo])}</div><b>${esc(c.cod || "?")}</b>${limpa(c.nome) ? `<div class="dreq-art-nome">${esc(c.nome)}</div>` : ""}</th>`).join("") + "</tr></thead><tbody>";
  const det = d.req.some((r) => limpa(r.origem) || limpa(r.status));
  d.req.forEach((r) => {
    h += `<tr><td><b>${cod(r)}</b></td><td class="dreq-c-desc">${esc(r.desc)}</td><td><span class="dreq-tipo dreq-tipo-${r.tipo}">${r.tipo}</span></td><td>${chipPrio(r.prio)}</td>` +
      (det ? `<td>${esc(r.origem)}</td><td>${esc(r.status)}</td>` : "") +
      d.col.map((c) => `<td class="dreq-cel">${marcas.has(r.id + "|" + c.id) ? '<span class="dreq-x dreq-x-ro" aria-pressed="true">✕</span>' : ""}</td>`).join("") + "</tr>";
  });
  if (!d.req.length) h += `<tr><td colspan="${4 + d.col.length}" class="dreq-vazio">(sem requisitos)</td></tr>`;
  h += "</tbody></table></div>";
  if (d.dep.length) {
    const dep = new Set(d.dep.map((p) => p[0] + "|" + p[1]));
    h += `<h4 class="dreq-sub">Dependências (linha depende da coluna)</h4><div class="dreq-rolagem"><table class="dreq-tab dreq-matriz dreq-ver-tab"><thead><tr><th></th>${d.req.map((r) => `<th title="${esc(r.desc)}">${cod(r)}</th>`).join("")}</tr></thead><tbody>` +
      d.req.map((r) => `<tr><td><b>${cod(r)}</b></td>${d.req.map((c) => `<td class="dreq-cel${c === r ? " dreq-diag" : ""}">${dep.has(r.id + "|" + c.id) ? '<span class="dreq-x dreq-x-ro" aria-pressed="true">✕</span>' : ""}</td>`).join("")}</tr>`).join("") + "</tbody></table></div>";
  }
  return h;
}
function verRequisitos(d) {
  const c = d.cab;
  let h = `<div class="dreq-doc-cab"><div><span>Projeto</span><b>${esc(c.projeto) || "—"}</b></div><div><span>Versão</span><b>${esc(c.versao) || "—"}</b></div><div><span>Data</span><b>${esc(c.data) || "—"}</b></div><div><span>Autor</span><b>${esc(c.autor) || "—"}</b></div></div>`;
  if (d.hist.length) h += `<h4 class="dreq-sub">Histórico de revisões</h4><table class="dreq-tab dreq-ver-tab"><thead><tr><th>Versão</th><th>Data</th><th>Autor</th><th>Descrição da mudança</th></tr></thead><tbody>` +
    d.hist.map((x) => `<tr><td>${esc(x.versao)}</td><td>${esc(x.data)}</td><td>${esc(x.autor)}</td><td>${esc(x.desc)}</td></tr>`).join("") + "</tbody></table>";
  h += `<h4 class="dreq-sub">Requisitos</h4><table class="dreq-tab dreq-ver-tab"><thead><tr><th>ID</th><th>Tipo</th><th class="dreq-c-desc">Descrição</th><th>Prioridade</th><th>Origem</th></tr></thead><tbody>` +
    (d.itens.length ? d.itens.map((r) => `<tr><td><b>${esc(r.cod)}</b></td><td><span class="dreq-tipo dreq-tipo-${r.tipo}">${r.tipo}</span>${r.tipo === "RNF" && r.cat ? `<div class="dreq-pequeno">${esc(r.cat)}</div>` : ""}</td><td class="dreq-c-desc">${esc(r.desc)}</td><td>${chipPrio(r.prio)}</td><td>${esc(r.origem)}</td></tr>`).join("")
      : '<tr><td colspan="5" class="dreq-vazio">(sem requisitos)</td></tr>') + "</tbody></table>";
  return h;
}
function verKanban(d) {
  return `<div class="dreq-quadro">` + d.cols.map((c) => {
    const cs = d.cards.filter((k) => k.col === c.id), acima = c.wip && cs.length > c.wip;
    return `<section class="dreq-kcol${acima ? " dreq-acima" : ""}"><header class="dreq-kcab"><b>${esc(c.nome) || "(sem nome)"}</b><span class="dreq-wip">${cs.length}${c.wip ? "/" + c.wip : ""}</span></header><div class="dreq-klista">` +
      cs.map((k) => `<article class="dreq-card"><div class="dreq-card-txt">${esc(k.txt)}</div>${k.resp || k.prio ? `<div class="dreq-card-pe">${k.resp ? `<span>👤 ${esc(k.resp)}</span>` : ""}${chipPrio(k.prio)}</div>` : ""}</article>`).join("") + "</div></section>";
  }).join("") + "</div>";
}
function verHistorias(d) {
  if (!d.itens.length) return '<p class="dreq-vazio">(sem histórias)</p>';
  return `<ol class="dreq-backlog dreq-backlog-ro">` + d.itens.map((x) => `<li class="dreq-hist"><div class="dreq-hist-cab"><b>${esc(x.cod)}</b>${chipPrio(x.prio)}${x.pontos ? `<span class="dreq-pontos">${esc(x.pontos)} pts</span>` : ""}</div>` +
    `<p class="dreq-frase">Como <b>${esc(x.papel) || "…"}</b>, quero <b>${esc(x.acao) || "…"}</b>, para <b>${esc(x.beneficio) || "…"}</b>.</p>` +
    (x.criterios.length ? `<div class="dreq-pequeno">Critérios de aceitação</div><ul class="dreq-crit-ro">${x.criterios.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "") + "</li>").join("") + "</ol>";
}
function verEmpatia(d) {
  return `<div class="dreq-empatia">` + AREAS_EMPATIA.map((a) => `<section class="dreq-area-emp dreq-emp-${a.id}"><h5>${esc(a.nome)}</h5><div class="dreq-notas">` +
    d.notas.filter((n) => n.area === a.id).map((n) => `<div class="dreq-nota"><div class="dreq-nota-txt">${esc(n.txt)}</div></div>`).join("") + "</div></section>").join("") +
    `<section class="dreq-persona"><div class="dreq-rosto" aria-hidden="true">${ROSTO}</div><div class="dreq-persona-txt">${esc(d.persona) || "(persona)"}</div></section></div>`;
}
const ROSTO = '<svg viewBox="0 0 64 64" width="56" height="56"><circle cx="32" cy="32" r="27" fill="#fff" stroke="#1f3160" stroke-width="2.5"/><circle cx="23" cy="27" r="3" fill="#1f3160"/><circle cx="41" cy="27" r="3" fill="#1f3160"/><path d="M21 40 Q32 49 43 40" fill="none" stroke="#1f3160" stroke-width="2.5" stroke-linecap="round"/></svg>';

/** HTML só leitura de um valor (gabarito, painel do professor). '' se o valor não for um diagrama. */
export function htmlDiagramaReq(valor) {
  garantirCss();
  const d = lerDiagrama(valor);
  if (!d) return "";
  const corpo = TIPOS[d.tipo].grafico ? svgGrafico(d) : { rastreabilidade: verMatriz, requisitos: verRequisitos, kanban: verKanban, historias: verHistorias, empatia: verEmpatia }[d.tipo](d);
  return `<div class="dreq-ver dreq-t-${d.tipo}">${corpo}${limpa(d.obs) ? `<div class="dreq-ver-obs"><b>Observações:</b> ${esc(d.obs)}</div>` : ""}</div>`;
}

/* ══════════════════════ casca comum (barra, desfazer/refazer, campos, teclado) ══════════════════════ */

/** Monta o editor no container. */
export function montarDiagramaReq(container, opts = {}) {
  garantirCss();
  const inicial = lerDiagrama(opts.valor);
  const tipo = opts.tipo || inicial?.tipo;
  if (!TIPOS[tipo]) throw new Error("Tipo de diagrama desconhecido: " + tipo);
  let d0 = inicial && inicial.tipo === tipo ? inicial : novoDiagrama(tipo);
  const valorDe = (d) => (diagramaVazio(d) ? "" : JSON.stringify(lerDiagrama(d)));

  if (opts.somenteLeitura) {
    container.innerHTML = `<div class="dreq dreq-ro"><div class="dreq-corpo">${htmlDiagramaReq(d0) || '<p class="dreq-vazio">(em branco)</p>'}</div></div>`;
    return { valor: () => valorDe(d0), destruir: () => { container.innerHTML = ""; } };
  }

  // estado + histórico (o editor sempre lê n.d, que é trocado ao desfazer)
  const n = { d: d0, hist: [], futuro: [] };
  n.mudou = () => { atualizarBotoes(); opts.onMudar?.(valorDe(n.d)); };
  n.guardar = (antes = JSON.stringify(n.d)) => { n.hist.push(antes); if (n.hist.length > 100) n.hist.shift(); n.futuro = []; atualizarBotoes(); };

  const E = EDITORES[tipo];
  container.innerHTML = `<div class="dreq dreq-t-${tipo}" data-dreq="${seq++}" tabindex="-1">` +
    `<div class="dreq-barra" role="toolbar" aria-label="Ferramentas">${E.barra(n.d)}<span class="dreq-esp"></span>` +
    `<span class="dreq-grupo"><button type="button" class="dreq-b" data-acao="desfazer" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">↶</button><button type="button" class="dreq-b" data-acao="refazer" title="Refazer (Ctrl+Y)" aria-label="Refazer">↷</button></span></div>` +
    `<div class="dreq-dica" aria-live="polite"></div><div class="dreq-corpo"></div>` +
    `<details class="dreq-obs"${n.d.obs ? " open" : ""}><summary>Observações / justificativa (opcional)</summary><textarea data-ref="d::obs" rows="2" maxlength="3000" placeholder="Use se a questão pedir para justificar alguma escolha"></textarea></details></div>`;
  const raiz = container.firstElementChild, corpo = raiz.querySelector(".dreq-corpo"), dicaEl = raiz.querySelector(".dreq-dica"), obs = raiz.querySelector(".dreq-obs textarea");
  obs.value = n.d.obs || "";

  const ctx = {
    n, raiz, corpo, tipo,
    dica(msg, html) { if (html) dicaEl.innerHTML = msg; else dicaEl.textContent = msg; },
    // mudança estrutural: guarda o estado anterior, aplica, redesenha e foca (seletor opcional)
    alterar(fn, foco) {
      const antes = JSON.stringify(n.d);
      if (fn(n.d) === false) return;
      if (JSON.stringify(n.d) === antes) return;
      n.guardar(antes); ed.render(typeof foco === "function" ? foco() : foco); n.mudou();
    }
  };
  const ed = E.criar(ctx);
  function atualizarBotoes() {
    raiz.querySelector('[data-acao="desfazer"]').disabled = !n.hist.length;
    raiz.querySelector('[data-acao="refazer"]').disabled = !n.futuro.length;
  }
  function trocar(de, para) {
    if (!de.length) return;
    const a = document.activeElement;
    if (a && raiz.contains(a) && ehCampo(a)) { a.blur(); } // grava o campo em edição antes
    ed.antesDesfazer?.();
    para.push(JSON.stringify(n.d));
    n.d = JSON.parse(de.pop());
    obs.value = n.d.obs || "";
    ed.render(); n.mudou();
  }
  const desfazer = () => trocar(n.hist, n.futuro), refazer = () => trocar(n.futuro, n.hist);

  // campos ligados por data-ref="lista:id:prop" (lista "d" = o próprio diagrama, "cab" = cabeçalho)
  function alvoDe(ref) {
    const [lista, id, prop, extra] = ref.split(":");
    if (lista === "d") return { o: n.d, prop };
    if (lista === "cab") return { o: n.d.cab, prop };
    if (lista === "crit") { const h = n.d.itens.find((x) => x.id === id); return h ? { o: h.criterios, prop: Number(prop) } : null; }
    const o = (n.d[lista] || []).find((x) => x.id === id);
    return o ? { o, prop, extra } : null;
  }
  function aplicar(c) {
    const a = alvoDe(c.dataset.ref); if (!a) return null;
    let v = c.type === "checkbox" ? c.checked : c.value;
    if (c.type === "number") v = Math.max(0, Math.min(99, parseInt(c.value, 10) || 0));
    a.o[a.prop] = v;
    return a;
  }
  let campoAntes = null, campoValor0 = null;
  raiz.addEventListener("focusin", (ev) => {
    const c = ev.target.closest?.("[data-ref]");
    if (c) { campoAntes = JSON.stringify(n.d); campoValor0 = c.value; }
  });
  raiz.addEventListener("input", (ev) => {
    const c = ev.target.closest?.("[data-ref]"); if (!c || c.tagName === "SELECT") return;
    if (!aplicar(c)) return;
    if (c.classList.contains("dreq-auto")) autoAltura(c);
    ed.aoDigitar?.(c);
    n.mudou();
  });
  raiz.addEventListener("change", (ev) => {
    const c = ev.target.closest?.("[data-ref]"); if (!c) return;
    const antes = campoAntes || JSON.stringify(n.d);
    const a = aplicar(c); if (!a) return;
    const redesenhar = ed.aoMudarCampo?.(c, a);
    if (JSON.stringify(n.d) !== antes) { n.guardar(antes); campoAntes = JSON.stringify(n.d); campoValor0 = c.value; }
    if (redesenhar) ed.render();
    n.mudou();
  });
  raiz.addEventListener("focusout", (ev) => {
    const c = ev.target.closest?.("[data-ref]"); if (!c) return;
    if (campoAntes && JSON.stringify(n.d) !== campoAntes) n.guardar(campoAntes);
    campoAntes = null;
  });
  raiz.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-acao]"); if (!b || !raiz.contains(b) || b.disabled) return;
    const acao = b.dataset.acao;
    if (acao === "desfazer") desfazer();
    else if (acao === "refazer") refazer();
    else ed.acao?.(acao, b, ev);
  });
  raiz.addEventListener("keydown", (ev) => {
    if (ev.defaultPrevented) return;
    const k = ev.key.toLowerCase(), ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && (k === "z" || k === "y")) {
      // dentro de um campo que já foi alterado, vale o desfazer do próprio campo
      if (ehCampo(ev.target) && ev.target.value !== campoValor0) return;
      ev.preventDefault();
      if (k === "y" || ev.shiftKey) refazer(); else desfazer();
      return;
    }
    if (ehCampo(ev.target)) return;
    ed.tecla?.(ev);
  });
  ed.render();
  atualizarBotoes();
  cssPronto?.then(() => raiz.querySelectorAll("textarea.dreq-auto").forEach(autoAltura));
  return {
    valor: () => valorDe(n.d),
    destruir: () => { ed.destruir?.(); container.innerHTML = ""; }
  };
}

// redesenha o HTML de um corpo mantendo rolagem e foco (pelo data-ref ou data-foco do elemento ativo)
function trocarHtml(corpo, html, foco) {
  const a = document.activeElement, chave = a && corpo.contains(a) ? a.getAttribute("data-ref") || a.getAttribute("data-foco") : null;
  const sel = chave && typeof a.selectionStart === "number" ? [a.selectionStart, a.selectionEnd] : null;
  const st = corpo.scrollTop, sl = corpo.scrollLeft;
  corpo.innerHTML = html;
  corpo.querySelectorAll("textarea.dreq-auto").forEach(autoAltura);
  corpo.scrollTop = st; corpo.scrollLeft = sl;
  const alvo = foco ? corpo.querySelector(foco) : chave ? corpo.querySelector(`[data-ref="${CSS.escape(chave)}"], [data-foco="${CSS.escape(chave)}"]`) : null;
  if (alvo) {
    alvo.focus({ preventScroll: !foco });
    if (foco) alvo.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (sel && !foco) try { alvo.setSelectionRange(sel[0], sel[1]); } catch { /* select/checkbox */ }
    if (foco && alvo.select) alvo.select();
  } else if (chave || (a && a !== document.body && !document.contains(a))) {
    corpo.closest(".dreq")?.focus({ preventScroll: true }); // o teclado (Ctrl+Z, Delete) continua no editor
  }
}

// arrastar itens (cartões, notas, histórias) entre listas [data-solta] pela alça [data-arrastar]
function ativarArrasto(raiz, corpo, { item, aoSoltar }) {
  raiz.addEventListener("pointerdown", (ev) => {
    const alca = ev.target.closest("[data-arrastar]");
    if (!alca || ev.button > 0 || !raiz.contains(alca)) return;
    const el = alca.closest(item); if (!el) return;
    ev.preventDefault();
    const x0 = ev.clientX, y0 = ev.clientY;
    let fant = null, marca = null, destino = null, antesDe = null, dx = 0, dy = 0, rolar = 0;
    alca.setPointerCapture(ev.pointerId);
    const mover = (e) => {
      if (!fant) {
        if (Math.hypot(e.clientX - x0, e.clientY - y0) < 5) return;
        const r = el.getBoundingClientRect();
        dx = x0 - r.left; dy = y0 - r.top;
        fant = el.cloneNode(true); fant.classList.add("dreq-fantasma"); fant.style.width = r.width + "px";
        document.body.appendChild(fant);
        el.classList.add("dreq-arrastando");
        marca = document.createElement("div"); marca.className = "dreq-marca";
      }
      fant.style.left = e.clientX - dx + "px"; fant.style.top = e.clientY - dy + "px";
      const sob = document.elementFromPoint(e.clientX, e.clientY), lista = sob?.closest("[data-solta]");
      if (lista && raiz.contains(lista)) {
        const filhos = [...lista.children].filter((f) => f.matches(item) && f !== el);
        antesDe = filhos.find((f) => { const r = f.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 || (e.clientY < r.bottom && e.clientX < r.left + r.width / 2 && r.width < lista.clientWidth * 0.7); }) || null;
        destino = lista;
        if (antesDe) lista.insertBefore(marca, antesDe); else lista.appendChild(marca);
      } else { destino = null; antesDe = null; marca.remove(); }
      // rola o corpo perto das bordas
      const rc = corpo.getBoundingClientRect();
      rolar = e.clientY < rc.top + 36 ? -14 : e.clientY > rc.bottom - 36 ? 14 : 0;
      const rx = e.clientX < rc.left + 36 ? -14 : e.clientX > rc.right - 36 ? 14 : 0;
      if (rolar || rx) corpo.scrollBy(rx, rolar);
    };
    const fim = (e) => {
      alca.removeEventListener("pointermove", mover); alca.removeEventListener("pointerup", fim); alca.removeEventListener("pointercancel", fim);
      if (!fant) return;
      fant.remove(); marca.remove(); el.classList.remove("dreq-arrastando");
      if (destino && e.type === "pointerup") aoSoltar(el.dataset.id, destino.dataset.solta, antesDe ? antesDe.dataset.id : null);
    };
    alca.addEventListener("pointermove", mover); alca.addEventListener("pointerup", fim); alca.addEventListener("pointercancel", fim);
  });
}
// coloca o item id antes de antesId (ou no fim do grupo) num vetor ordenado por grupo
function reposicionar(vet, id, grupoProp, grupo, antesId) {
  const i = vet.findIndex((x) => x.id === id); if (i < 0) return;
  const [x] = vet.splice(i, 1);
  if (grupoProp) x[grupoProp] = grupo;
  let j = antesId ? vet.findIndex((o) => o.id === antesId) : -1;
  if (j < 0) { j = vet.length; if (grupoProp) for (let k = vet.length - 1; k >= 0; k--) if (vet[k][grupoProp] === grupo) { j = k + 1; break; } }
  vet.splice(j, 0, x);
}
const btn = (acao, rot, tit, extra = "") => `<button type="button" class="dreq-b" data-acao="${acao}"${tit ? ` title="${esc(tit)}"` : ""}${extra}>${rot}</button>`;
const mini = (acao, id, rot, tit, extra = "") => `<button type="button" class="dreq-mini" data-acao="${acao}" data-id="${esc(id)}" title="${esc(tit)}" aria-label="${esc(tit)}"${extra}>${rot}</button>`;

/* ══════════════════════ editor gráfico (casos de uso, atividades) ══════════════════════ */
const ZOOMS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const ICONES = {
  sistema: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  ator: '<svg viewBox="0 0 20 20"><circle cx="10" cy="4.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 7.2v6M5.5 9.5h9M10 13.2l-3.5 4.6M10 13.2l3.5 4.6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
  caso: '<svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="8.5" ry="5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  nota: '<svg viewBox="0 0 20 20"><path d="M3 3h10l4 4v10H3z M13 3v4h4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  raia: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 6h14" stroke="currentColor" stroke-width="1.5"/></svg>',
  inicio: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="currentColor"/></svg>',
  acao: '<svg viewBox="0 0 20 20"><rect x="2" y="5" width="16" height="10" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  decisao: '<svg viewBox="0 0 20 20"><path d="M10 2l8 8-8 8-8-8z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  fork: '<svg viewBox="0 0 20 20"><rect x="2" y="8.5" width="16" height="3" fill="currentColor"/></svg>',
  fim: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="4" fill="currentColor"/></svg>',
  assoc: '<svg viewBox="0 0 20 20"><path d="M3 16L17 4" stroke="currentColor" stroke-width="1.7"/></svg>',
  include: '<svg viewBox="0 0 20 20"><path d="M3 16L16 5" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M11 4.5h5.5V10" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  gen: '<svg viewBox="0 0 20 20"><path d="M3 17L12 8" stroke="currentColor" stroke-width="1.6"/><path d="M10 4l6-1-1 6z" fill="#fff" stroke="currentColor" stroke-width="1.5"/></svg>',
  fluxo: '<svg viewBox="0 0 20 20"><path d="M3 10h12" stroke="currentColor" stroke-width="1.7"/><path d="M12 6l5 4-5 4z" fill="currentColor"/></svg>'
};
ICONES.extend = ICONES.include;

function barraGrafico(d) {
  const T = TIPOS[d.tipo];
  const ico = (k) => `<span class="dreq-ico" aria-hidden="true">${ICONES[k] || ""}</span>`;
  return `<span class="dreq-grupo"><b>Peças</b>${Object.keys(T.el).map((t) => btn("add", ico(t) + esc(T.el[t].rot), "Adicionar " + T.el[t].rot.toLowerCase(), ` data-t="${t}"`)).join("")}</span>` +
    `<span class="dreq-grupo"><b>Ligações</b>${Object.keys(T.li).map((t) => btn("ligar", ico(t) + esc(T.li[t].rot), T.li[t].dica + ". Clique na origem e depois no destino (ou arraste o ⊕ da peça).", ` data-t="${t}"`)).join("")}</span>` +
    `<span class="dreq-grupo">${btn("texto", "✎ Texto", "Editar o texto (ou dois cliques / Enter)")}${d.tipo === "casos-de-uso" ? btn("inverter", "⇄ Inverter", "Inverte a direção da ligação selecionada") : btn("inverter", "⇄ Inverter", "Inverte a direção do fluxo selecionado")}${btn("excluir", "🗑 Excluir", "Exclui a peça ou ligação selecionada (Delete)")}</span>` +
    `<span class="dreq-grupo dreq-zoom"><b>Zoom</b>${btn("zoomMenos", "−", "Diminuir (Ctrl + rodinha)", ' aria-label="Diminuir zoom"')}${btn("zoom100", "100%", "Tamanho normal")}${btn("zoomMais", "+", "Aumentar (Ctrl + rodinha)", ' aria-label="Aumentar zoom"')}${btn("zoomAjustar", "⤢ Ver tudo", "Encaixa o diagrama inteiro na tela")}</span>`;
}

function criarGrafico(ctx) {
  const { n, corpo, raiz } = ctx, tipo = ctx.tipo, T = TIPOS[tipo];
  const p = "dq" + (++seq) + "_";
  corpo.classList.add("dreq-corpo-svg");
  corpo.innerHTML = '<div class="dreq-area" tabindex="0" aria-label="Área de desenho: Delete exclui, Enter edita o texto, setas movem"><svg class="dreq-tela" xmlns="http://www.w3.org/2000/svg"></svg></div>';
  const area = corpo.firstElementChild, tela = area.firstElementChild;
  let sel = null, modo = null, arrasto = null, zoom = 1, editando = null, acrescimo = 0, ultimoClique = null, quadro = 0;
  let aviso = ""; // aviso de ligação recusada: sobrevive ao próximo redesenho
  const avisar = (msg) => { aviso = "⚠ " + msg; ctx.dica(aviso); };
  const porId = (id) => n.d.el.find((e) => e.id === id) || null;
  const liPorId = (id) => n.d.li.find((l) => l.id === id) || null;

  function dicaPadrao() {
    if (aviso) { ctx.dica(aviso); aviso = ""; return; }
    if (modo) ctx.dica(`<b>${esc(T.li[modo.t].rot)}:</b> ${modo.de ? "agora clique na peça de <b>destino</b>." : "clique na peça de <b>origem</b>."} <button type="button" class="dreq-link" data-acao="cancelar">cancelar</button>`, true);
    else if (sel?.k === "el") ctx.dica("Peça selecionada: arraste para mover, o quadradinho muda o tamanho, o ⊕ cria uma ligação. Dois cliques (ou Enter) editam o texto. Delete exclui.");
    else if (sel?.k === "li") ctx.dica("Ligação selecionada: escolha outro tipo na barra para trocar, ⇄ inverte a direção, dois cliques escrevem um rótulo" + (tipo === "atividades" ? " (guarda [condição])" : "") + ". Delete exclui.");
    else ctx.dica(tipo === "casos-de-uso"
      ? "Adicione o limite do sistema, os atores (fora) e os casos de uso (dentro). Para ligar: selecione a peça e arraste o ⊕ até a outra, ou escolha a ligação na barra."
      : "Adicione início, ações, decisões e fim. Para ligar: selecione a peça e arraste o ⊕ até a próxima, ou use “Fluxo” na barra. Raias são opcionais.");
  }
  function desenhar() {
    const lim = limites(n.d) || { x1: 0, y1: 0 };
    const W = Math.max(Math.ceil(area.clientWidth / zoom), lim.x1 + 200), H = Math.max(Math.ceil(area.clientHeight / zoom), lim.y1 + 200);
    tela.setAttribute("width", Math.round(W * zoom)); tela.setAttribute("height", Math.round(H * zoom));
    tela.setAttribute("viewBox", `0 0 ${W} ${H}`);
    tela.style.backgroundSize = `${20 * zoom}px ${20 * zoom}px`;
    let extra = "";
    if (arrasto?.tipo === "ligar") { const a = porId(arrasto.de), c = a && centroDe(a); if (c) extra = `<line x1="${c.x}" y1="${c.y}" x2="${arrasto.x}" y2="${arrasto.y}" stroke="${AZUL}" stroke-width="1.8" stroke-dasharray="5 4" pointer-events="none"/>`; }
    tela.innerHTML = conteudoSVG(n.d, p, sel, extra);
    raiz.querySelector('[data-acao="zoom100"]').textContent = Math.round(zoom * 100) + "%";
    raiz.querySelectorAll('[data-acao="ligar"]').forEach((b) => { const on = (modo && modo.t === b.dataset.t) || (!modo && sel?.k === "li" && liPorId(sel.id)?.t === b.dataset.t); b.classList.toggle("on", !!on); b.setAttribute("aria-pressed", String(!!on)); });
    raiz.querySelector('[data-acao="texto"]').disabled = !sel;
    raiz.querySelector('[data-acao="excluir"]').disabled = !sel;
    const lsel = sel?.k === "li" ? liPorId(sel.id) : null;
    raiz.querySelector('[data-acao="inverter"]').disabled = !lsel || lsel.t === "assoc";
    dicaPadrao();
  }
  const agendar = () => { if (!quadro) quadro = requestAnimationFrame(() => { quadro = 0; desenhar(); }); };
  function ponto(ev) { const r = tela.getBoundingClientRect(); return { x: (ev.clientX - r.left) / zoom, y: (ev.clientY - r.top) / zoom }; }
  function mudarZoom(novo, cx, cy) {
    novo = Math.min(2, Math.max(0.4, Math.round(novo * 100) / 100));
    if (novo === zoom) return;
    editando?.blur();
    if (cx == null) { cx = area.clientWidth / 2; cy = area.clientHeight / 2; }
    const dx = (area.scrollLeft + cx) / zoom, dy = (area.scrollTop + cy) / zoom;
    zoom = novo; desenhar();
    area.scrollLeft = dx * zoom - cx; area.scrollTop = dy * zoom - cy;
  }
  function passoZoom(dir) {
    const z = dir > 0 ? ZOOMS.find((v) => v > zoom + 1e-6) ?? 2 : [...ZOOMS].reverse().find((v) => v < zoom - 1e-6) ?? 0.4;
    mudarZoom(z);
  }
  function ajustarZoom() {
    const lim = limites(n.d);
    if (!lim) { mudarZoom(1); return; }
    editando?.blur();
    const z = Math.min((area.clientWidth - 30) / (lim.x1 - Math.min(0, lim.x0) + 40), (area.clientHeight - 30) / (lim.y1 - Math.min(0, lim.y0) + 40));
    zoom = Math.min(2, Math.max(0.4, Math.floor(z * 100) / 100)); desenhar();
    area.scrollLeft = Math.max(0, (lim.x0 - 20) * zoom); area.scrollTop = Math.max(0, (lim.y0 - 20) * zoom);
  }
  function adicionar(t) {
    const def = T.el[t], e = { id: novoId("e"), t, x: 0, y: 0, w: def.w, h: def.h, txt: def.txt };
    const vis = { x: area.scrollLeft / zoom, y: area.scrollTop / zoom, w: area.clientWidth / zoom, h: area.clientHeight / zoom };
    acrescimo = (acrescimo + 26) % 156;
    if (t === "raia") {
      let bx = 20, alt = def.h;
      n.d.el.forEach((o) => { if (o.t === "raia") { bx = Math.max(bx, o.x + o.w); alt = Math.max(alt, o.h); } });
      e.x = bx; e.y = 20; e.h = alt;
      const k = n.d.el.filter((o) => o.t === "raia").length; e.txt = ["Cliente", "Atendente", "Sistema", "Gerente"][k] || "Responsável";
    } else if (t === "sistema") {
      e.x = Math.round(vis.x + Math.max(150, vis.w / 2 - e.w / 2)); e.y = Math.round(vis.y + 30);
      if (n.d.el.some((o) => o.t === "sistema")) { e.x += 40; e.y += 40; }
    } else if (tipo === "casos-de-uso" && t === "ator") {
      // atores nascem fora do limite do sistema, à esquerda
      const s = n.d.el.find((o) => o.t === "sistema"), k = n.d.el.filter((o) => o.t === "ator").length;
      if (s) { e.x = Math.max(10, s.x - 150); e.y = s.y + 30 + (k % 3) * 125; if (k >= 3) e.x = s.x + s.w + 80; } else { e.x = Math.round(vis.x + 40); e.y = Math.round(vis.y + 40 + (k % 3) * 125); }
    } else if (tipo === "casos-de-uso" && t === "caso") {
      // casos nascem dentro do limite, um abaixo do outro
      const s = n.d.el.find((o) => o.t === "sistema");
      if (s) {
        const dentroS = n.d.el.filter((o) => o.t === "caso" && dentro(o, s));
        e.x = s.x + Math.round((s.w - e.w) / 2); e.y = s.y + 48 + dentroS.length * (e.h + 16);
        if (e.y + e.h > s.y + s.h - 10) s.h = e.y + e.h + 20 - s.y;
      } else { e.x = Math.round(vis.x + vis.w / 2 - e.w / 2 + acrescimo - 78); e.y = Math.round(vis.y + 60 + acrescimo / 2); }
    } else { e.x = Math.round(vis.x + vis.w / 2 - e.w / 2 + acrescimo - 78); e.y = Math.round(vis.y + Math.min(vis.h / 2, 160) - e.h / 2 + acrescimo / 2); }
    e.x = Math.max(10, e.x); e.y = Math.max(10, e.y);
    n.guardar(); n.d.el.push(e); sel = { k: "el", id: e.id }; modo = null;
    desenhar(); n.mudou();
    if (!area.contains(document.activeElement)) area.focus({ preventScroll: true });
    if (e.txt) editarTexto();
  }
  function excluir() {
    if (!sel) return;
    n.guardar();
    if (sel.k === "el") { const id = sel.id; n.d.el = n.d.el.filter((e) => e.id !== id); n.d.li = n.d.li.filter((l) => l.de !== id && l.para !== id); }
    else n.d.li = n.d.li.filter((l) => l.id !== sel.id);
    sel = null; desenhar(); n.mudou();
  }
  function tipoPadrao(a, b) {
    if (modo) return modo.t;
    if (tipo !== "casos-de-uso") return "fluxo";
    if (a.t === "caso" && b.t === "caso") return "include";
    if (a.t === "ator" && b.t === "ator") return "gen";
    return "assoc";
  }
  function validar(t, a, b, ignorar) {
    if (a === b) return "Escolha outra peça como destino.";
    if (T.el[a.t].cont || T.el[b.t].cont) return tipo === "casos-de-uso" ? "Ligue atores e casos de uso, não o limite do sistema." : "Ligue as etapas, não a raia.";
    if (a.t === "nota" || b.t === "nota") {
      if (a.t === "nota" && b.t === "nota") return "Ligue a nota a uma peça.";
      if (t !== T.ligPadrao) return "Nota só se prende a uma peça com a linha simples (" + T.li[T.ligPadrao].rot + ").";
    } else if (tipo === "casos-de-uso") {
      if (t === "assoc" && !((a.t === "ator" && b.t === "caso") || (a.t === "caso" && b.t === "ator"))) return "A associação liga um ATOR a um CASO DE USO." + (a.t === "caso" ? " Entre dois casos use «include» ou «extend»." : " Entre atores use a generalização.");
      if ((t === "include" || t === "extend") && !(a.t === "caso" && b.t === "caso")) return "«include» e «extend» ligam dois casos de uso.";
      if (t === "gen" && a.t !== b.t) return "A generalização liga peças do mesmo tipo (ator → ator ou caso → caso).";
    } else {
      if (b.t === "inicio") return "O nó inicial não recebe fluxo.";
      if (a.t === "fim") return "O nó final não tem saída.";
    }
    const dup = n.d.li.some((l) => l !== ignorar && l.t === t && ((l.de === a.id && l.para === b.id) || (t === "assoc" && l.de === b.id && l.para === a.id)));
    return dup ? "Essa ligação já existe." : null;
  }
  function criarLigacao(t, de, para) {
    const a = porId(de), b = porId(para);
    const erro = validar(t, a, b);
    if (erro) { avisar(erro); return false; }
    n.guardar();
    const l = { id: novoId("l"), t, de, para, txt: "" };
    n.d.li.push(l); sel = { k: "li", id: l.id };
    desenhar(); n.mudou();
    if (tipo === "atividades" && a.t === "decisao") { modo = null; editarTexto(); }
    return true;
  }
  function editarTexto() {
    if (!sel || editando) return;
    const alvo = sel.k === "el" ? porId(sel.id) : liPorId(sel.id); if (!alvo) return;
    if (sel.k === "el" && ["inicio", "fim", "fork"].includes(alvo.t)) { ctx.dica("Esta peça não tem texto."); return; }
    let x, y, w;
    if (sel.k === "el") {
      w = Math.max(170, alvo.w); x = alvo.x + alvo.w / 2 - w / 2;
      y = alvo.t === "ator" ? alvo.y + alvo.h - 24 : T.el[alvo.t].cont ? alvo.y + 2 : alvo.t === "decisao" ? alvo.y - 30 : alvo.y + Math.max(0, alvo.h / 2 - 18);
      if (alvo.t === "decisao") x = alvo.x + alvo.w + 4;
    } else {
      const a = porId(alvo.de), b = porId(alvo.para); if (!a || !b) return;
      const ca = centroDe(a), cb = centroDe(b);
      w = 220; x = (ca.x + cb.x) / 2 - 110; y = (ca.y + cb.y) / 2 - 20;
    }
    const ed = document.createElement("textarea");
    ed.className = "dreq-edit"; ed.value = alvo.txt || ""; ed.rows = 2; ed.maxLength = 300;
    ed.placeholder = sel.k === "li" ? (tipo === "atividades" ? "[condição] (opcional)" : "rótulo (opcional)") : alvo.t === "decisao" ? "pergunta / condição (opcional)" : "texto";
    ed.setAttribute("aria-label", "Texto da peça");
    ed.style.left = Math.max(0, x * zoom) + "px"; ed.style.top = Math.max(0, y * zoom) + "px"; ed.style.width = Math.max(170, w * zoom) + "px";
    area.appendChild(ed);
    editando = ed; ed.focus({ preventScroll: true }); ed.select();
    const antes = JSON.stringify(n.d);
    let feito = false;
    const fim = (cancelar) => {
      if (feito) return; feito = true;
      if (!cancelar) alvo.txt = ed.value.replace(/\s+$/, "").slice(0, 300);
      ed.remove(); editando = null;
      if (JSON.stringify(n.d) !== antes) { n.guardar(antes); n.mudou(); }
      desenhar(); area.focus({ preventScroll: true });
    };
    ed.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); fim(); }
      else if (ev.key === "Escape") { ev.preventDefault(); fim(true); }
    });
    ed.addEventListener("blur", () => fim());
  }

  /* ── ponteiro (mouse, caneta e toque) ── */
  tela.addEventListener("pointerdown", (ev) => {
    if (ev.button > 0) return;
    ev.preventDefault(); // sem isto o foco muda no mousedown e a caixa de texto recém-aberta fecha sozinha
    if (editando) editando.blur();
    const pt = ponto(ev), alvo = ev.target;
    const g = alvo.closest("[data-el]"), gl = alvo.closest("[data-li]");
    if (alvo.closest("[data-conector]") && sel?.k === "el") {
      arrasto = { tipo: "ligar", de: sel.id, x: pt.x, y: pt.y };
    } else if (alvo.hasAttribute("data-handle") && sel?.k === "el") {
      const e = porId(sel.id); arrasto = { tipo: "tam", e, x0: pt.x, y0: pt.y, w0: e.w, h0: e.h, antes: JSON.stringify(n.d) };
    } else if (modo && g) {
      const id = g.getAttribute("data-el"), e = porId(id);
      if (!modo.de) {
        if (T.el[e.t].cont) { avisar((tipo === "casos-de-uso" ? "Ligue atores e casos de uso, não o limite do sistema." : "Ligue as etapas, não a raia.")); return; }
        modo.de = id; dicaPadrao(); area.focus({ preventScroll: true }); return;
      }
      if (criarLigacao(modo.t, modo.de, id) && modo) modo = { t: modo.t, de: null };
      if (!editando) { desenhar(); area.focus({ preventScroll: true }); } // a caixa da guarda pode ter aberto
      return;
    } else if (gl) {
      sel = { k: "li", id: gl.getAttribute("data-li") }; modo = null; desenhar();
    } else if (g) {
      sel = { k: "el", id: g.getAttribute("data-el") }; modo = null;
      const el = porId(sel.id), filhos = [];
      if (T.el[el.t].cont) n.d.el.forEach((o) => { if (o !== el && !T.el[o.t].cont && dentro(o, el)) filhos.push({ o, x: o.x, y: o.y }); });
      arrasto = { tipo: "mover", e: el, x0: pt.x, y0: pt.y, ex: el.x, ey: el.y, filhos, antes: JSON.stringify(n.d) };
      desenhar();
    } else {
      sel = null; if (modo) modo.de = null;
      arrasto = { tipo: "pan", cx: ev.clientX, cy: ev.clientY, sl: area.scrollLeft, st: area.scrollTop };
      desenhar();
    }
    if (arrasto) tela.setPointerCapture(ev.pointerId);
    if (!editando) area.focus({ preventScroll: true });
    // dois cliques/toques detectados aqui: o redesenho troca o elemento e o "dblclick" do navegador se perde
    const chave = sel ? sel.k + ":" + sel.id : "", agora = Date.now();
    if (chave && arrasto?.tipo !== "ligar" && ultimoClique && ultimoClique.chave === chave && agora - ultimoClique.em < 450 && Math.abs(pt.x - ultimoClique.x) < 10 && Math.abs(pt.y - ultimoClique.y) < 10) {
      ultimoClique = null; arrasto = null; desenhar(); editarTexto();
    } else ultimoClique = { chave, em: agora, x: pt.x, y: pt.y };
  });
  tela.addEventListener("pointermove", (ev) => {
    if (!arrasto) return;
    if (arrasto.tipo === "pan") { area.scrollLeft = arrasto.sl - (ev.clientX - arrasto.cx); area.scrollTop = arrasto.st - (ev.clientY - arrasto.cy); return; }
    const pt = ponto(ev);
    if (arrasto.tipo === "ligar") { arrasto.x = pt.x; arrasto.y = pt.y; agendar(); return; }
    const dx = Math.round(pt.x - arrasto.x0), dy = Math.round(pt.y - arrasto.y0);
    if (!arrasto.moveu && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    if (arrasto.tipo === "mover") {
      const e = arrasto.e, grade = (v) => Math.round(v / 5) * 5;
      e.x = Math.max(0, grade(arrasto.ex + dx)); e.y = Math.max(0, grade(arrasto.ey + dy));
      arrasto.filhos.forEach((f) => { f.o.x = Math.max(0, f.x + (e.x - arrasto.ex)); f.o.y = Math.max(0, f.y + (e.y - arrasto.ey)); });
    } else if (arrasto.tipo === "tam") {
      const e = arrasto.e, mh = e.t === "fork" ? 6 : 24;
      e.w = Math.max(30, arrasto.w0 + dx); e.h = Math.max(mh, arrasto.h0 + dy);
      if (e.t === "decisao") e.h = e.w; // losango fica proporcional
    }
    arrasto.moveu = true; agendar();
  });
  const soltar = (ev) => {
    if (!arrasto) return;
    const a = arrasto; arrasto = null;
    if (a.tipo === "ligar") {
      const sob = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("[data-el]");
      const para = sob && tela.contains(sob) ? sob.getAttribute("data-el") : null;
      const b = para && porId(para), de = porId(a.de);
      if (b && b !== de && de) {
        // soltou sobre o limite do sistema/raia: procura a peça de verdade embaixo do ponteiro
        let alvoB = b;
        if (T.el[b.t].cont) { const pt = ponto(ev); alvoB = n.d.el.filter((o) => !T.el[o.t].cont && pt.x >= o.x && pt.x <= o.x + o.w && pt.y >= o.y && pt.y <= o.y + o.h).pop() || b; }
        criarLigacao(tipoPadrao(de, alvoB), de.id, alvoB.id);
      }
      desenhar(); return;
    }
    if (a.moveu && a.antes) { n.guardar(a.antes); n.mudou(); }
    desenhar();
  };
  tela.addEventListener("pointerup", soltar);
  tela.addEventListener("pointercancel", () => { arrasto = null; desenhar(); });
  area.addEventListener("wheel", (ev) => {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    const r = area.getBoundingClientRect();
    mudarZoom(zoom * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => agendar()) : null;
  ro?.observe(area);

  return {
    render: desenhar,
    antesDesfazer() { editando?.blur(); sel = null; modo = null; },
    destruir() { ro?.disconnect(); cancelAnimationFrame(quadro); },
    tecla(ev) {
      if (editando) return;
      const k = ev.key;
      if (k === "Delete" || k === "Backspace") { ev.preventDefault(); excluir(); }
      else if (k === "Enter" || k === "F2") { if (sel) { ev.preventDefault(); editarTexto(); } }
      else if (k === "Escape") { modo = null; sel = null; desenhar(); }
      else if (k.startsWith("Arrow") && sel?.k === "el") {
        ev.preventDefault();
        const e = porId(sel.id), passo = ev.shiftKey ? 1 : 10, dx = k === "ArrowLeft" ? -passo : k === "ArrowRight" ? passo : 0, dy = k === "ArrowUp" ? -passo : k === "ArrowDown" ? passo : 0;
        n.guardar();
        const filhos = T.el[e.t].cont ? n.d.el.filter((o) => o !== e && !T.el[o.t].cont && dentro(o, e)) : [];
        [e, ...filhos].forEach((o) => { o.x = Math.max(0, o.x + dx); o.y = Math.max(0, o.y + dy); });
        desenhar(); n.mudou();
      }
    },
    acao(a, b) {
      if (a === "add") adicionar(b.dataset.t);
      else if (a === "ligar") {
        const t = b.dataset.t, l = !modo && sel?.k === "li" ? liPorId(sel.id) : null;
        if (l) { // troca o tipo da ligação selecionada
          if (l.t === t) return;
          const erro = validar(t, porId(l.de), porId(l.para), l);
          if (erro) { avisar(erro); return; }
          n.guardar(); l.t = t; desenhar(); n.mudou();
        } else { modo = modo && modo.t === t ? null : { t, de: sel?.k === "el" && !T.el[porId(sel.id)?.t]?.cont ? sel.id : null }; if (!modo || !modo.de) sel = null; desenhar(); }
      } else if (a === "excluir") excluir();
      else if (a === "texto") { if (sel) editarTexto(); }
      else if (a === "inverter") {
        const l = sel?.k === "li" ? liPorId(sel.id) : null; if (!l) return;
        const erro = validar(l.t, porId(l.para), porId(l.de), l);
        if (erro) { avisar(erro); return; }
        n.guardar(); [l.de, l.para] = [l.para, l.de]; desenhar(); n.mudou();
      } else if (a === "cancelar") { modo = null; desenhar(); }
      else if (a === "zoomMenos") passoZoom(-1);
      else if (a === "zoomMais") passoZoom(1);
      else if (a === "zoom100") mudarZoom(1);
      else if (a === "zoomAjustar") ajustarZoom();
      if (!editando && a !== "cancelar") area.focus({ preventScroll: true });
    }
  };
}

/* ══════════════════════ matriz de rastreabilidade ══════════════════════ */
const PREFIXO_COL = { UC: "UC", TL: "TL", CT: "CT", OUT: "AR" };
function barraMatriz() {
  return `<span class="dreq-grupo"><b>Linhas</b>${btn("addReq", "+ Requisito", "Adiciona uma linha (requisito)")}</span>` +
    `<span class="dreq-grupo"><b>Colunas</b>${btn("addCol", "+ Caso de uso", "Coluna UC", ' data-t="UC"')}${btn("addCol", "+ Tela", "Coluna TL", ' data-t="TL"')}${btn("addCol", "+ Caso de teste", "Coluna CT", ' data-t="CT"')}${btn("addCol", "+ Outro", "Outro artefato", ' data-t="OUT"')}</span>` +
    `<span class="dreq-grupo dreq-abas" role="tablist"><b>Visão</b>${btn("vista", "Requisito × artefato", "Rastreia cada requisito até casos de uso, telas e testes", ' data-v="art" role="tab"')}${btn("vista", "Requisito × requisito", "Dependências entre requisitos (a linha depende da coluna)", ' data-v="dep" role="tab"')}</span>` +
    `<label class="dreq-check"><input type="checkbox" data-acao="detalhes"> Origem e status</label>`;
}
function criarMatriz(ctx) {
  const { n, corpo, raiz } = ctx;
  let vista = n.d.modo === "dep" ? "dep" : "art", selLinha = null, detalhes = n.d.req.some((r) => limpa(r.origem) || limpa(r.status));
  raiz.querySelector('[data-acao="detalhes"]').checked = detalhes;
  function render(foco) {
    const d = n.d, dep = vista === "dep";
    raiz.querySelectorAll('[data-acao="vista"]').forEach((b) => { b.classList.toggle("on", b.dataset.v === vista); b.setAttribute("aria-selected", String(b.dataset.v === vista)); });
    raiz.querySelectorAll('[data-acao="addCol"]').forEach((b) => { b.disabled = dep; });
    const cols = dep ? d.req.map((r) => ({ id: r.id, cod: r.cod, nome: r.desc, ehReq: true })) : d.col;
    const marcas = new Set((dep ? d.dep : d.x).map((p) => p[0] + "|" + p[1]));
    const fixas = 5 + (detalhes ? 2 : 0);
    let h = `<table class="dreq-tab dreq-matriz"><thead><tr><th class="dreq-c-n" title="Clique no número para selecionar a linha">#</th><th class="dreq-c-cod">ID</th><th class="dreq-c-desc">Requisito</th><th>Tipo</th><th>Prioridade</th>` +
      (detalhes ? "<th>Origem</th><th>Status</th>" : "");
    cols.forEach((c, j) => {
      if (c.ehReq) h += `<th class="dreq-art dreq-art-REQ" data-c="${j}" title="${esc(c.nome)}"><div class="dreq-art-tipo">depende de</div><b>${esc(c.cod || "?")}</b></th>`;
      else h += `<th class="dreq-art dreq-art-${c.tipo}" data-c="${j}"><div class="dreq-art-tipo">${esc(TIPOS_COL[c.tipo])}</div>` +
        `<input class="dreq-in dreq-in-cod" data-ref="col:${c.id}:cod" value="${esc(c.cod)}" maxlength="20" aria-label="ID do artefato" placeholder="ID">` +
        `<input class="dreq-in dreq-in-mini" data-ref="col:${c.id}:nome" value="${esc(c.nome)}" maxlength="120" placeholder="nome" title="${esc(c.nome)}" aria-label="Nome do artefato ${esc(c.cod)}">` +
        `<div class="dreq-art-acoes">${mini("colEsq", c.id, "◀", "Mover coluna para a esquerda", j === 0 ? " disabled" : "")}${mini("colDir", c.id, "▶", "Mover coluna para a direita", j === cols.length - 1 ? " disabled" : "")}${mini("colDel", c.id, "×", "Excluir coluna " + (c.cod || ""))}</div></th>`;
    });
    h += `<th class="dreq-c-tot" title="Quantidade de marcas na linha">Σ</th></tr></thead><tbody>`;
    d.req.forEach((r, i) => {
      const total = cols.filter((c) => marcas.has(r.id + "|" + c.id)).length;
      h += `<tr data-id="${r.id}"${selLinha === r.id ? ' class="dreq-sel"' : ""}><td class="dreq-c-n"><button type="button" class="dreq-num" data-acao="selLinha" data-id="${r.id}" data-foco="n-${r.id}" title="Selecionar a linha (Delete exclui)">${i + 1}</button>` +
        `<span class="dreq-linha-acoes">${mini("reqSobe", r.id, "↑", "Subir", i === 0 ? " disabled" : "")}${mini("reqDesce", r.id, "↓", "Descer", i === d.req.length - 1 ? " disabled" : "")}${mini("reqDel", r.id, "×", "Excluir requisito")}</span></td>` +
        `<td class="dreq-c-cod"><input class="dreq-in dreq-in-cod" data-ref="req:${r.id}:cod" value="${esc(r.cod)}" maxlength="20" aria-label="ID do requisito ${i + 1}" placeholder="RF01"></td>` +
        `<td class="dreq-c-desc"><textarea class="dreq-in dreq-auto" rows="1" data-ref="req:${r.id}:desc" maxlength="600" aria-label="Descrição do requisito ${esc(r.cod)}" placeholder="O sistema deve…">${esc(r.desc)}</textarea></td>` +
        `<td><select class="dreq-in dreq-tipo-sel dreq-tipo-${r.tipo}" data-ref="req:${r.id}:tipo" aria-label="Tipo">${opcoes([["RF", "RF"], ["RNF", "RNF"], ["RN", "RN"]], r.tipo, null)}</select></td>` +
        `<td><select class="dreq-in dreq-prio-sel dreq-prio-${classePrio(r.prio)}" data-ref="req:${r.id}:prio" aria-label="Prioridade">${opcoesPrio(r.prio)}</select></td>` +
        (detalhes ? `<td><input class="dreq-in" data-ref="req:${r.id}:origem" value="${esc(r.origem)}" maxlength="120" placeholder="stakeholder" aria-label="Origem"></td><td><select class="dreq-in" data-ref="req:${r.id}:status" aria-label="Status">${opcoes(STATUS_REQ, r.status)}</select></td>` : "");
      cols.forEach((c, j) => {
        if (c.ehReq && c.id === r.id) { h += '<td class="dreq-cel dreq-diag" aria-hidden="true"></td>'; return; }
        const on = marcas.has(r.id + "|" + c.id);
        h += `<td class="dreq-cel" data-c="${j}"><button type="button" class="dreq-x" data-acao="marcar" data-id="${r.id}|${c.id}" data-foco="x-${r.id}|${c.id}" data-r="${i}" data-c="${j}" aria-pressed="${on}" aria-label="${esc((r.cod || "?") + (dep ? " depende de " : " → ") + (c.cod || "?"))}">${on ? "✕" : ""}</button></td>`;
      });
      h += `<td class="dreq-c-tot${total ? "" : " dreq-alerta"}" title="${total ? total + " marca(s)" : dep ? "sem dependências" : "Requisito sem rastreio"}">${total || (dep ? "0" : "⚠ 0")}</td></tr>`;
    });
    if (!d.req.length) h += `<tr><td colspan="${fixas + cols.length + 1}" class="dreq-vazio">Nenhum requisito. Use <b>+ Requisito</b> na barra.</td></tr>`;
    h += `</tbody><tfoot><tr><td colspan="${fixas}" class="dreq-pe-rot">${dep ? "Requisitos que dependem deste" : "Requisitos por artefato"}</td>` +
      cols.map((c, j) => { const t = d.req.filter((r) => marcas.has(r.id + "|" + c.id)).length; return `<td class="dreq-c-tot${t || dep ? "" : " dreq-alerta"}" data-c="${j}">${t}</td>`; }).join("") + "<td></td></tr></tfoot></table>";
    if (!cols.length && !dep) h += `<p class="dreq-vazio">Adicione colunas de artefatos (casos de uso, telas, casos de teste) pela barra.</p>`;
    trocarHtml(corpo, h, foco);
    ctx.dica(dep ? "Marque ✕ quando o requisito da LINHA depende do requisito da COLUNA." : "Clique na célula para marcar ✕ (o requisito da linha é atendido/verificado pelo artefato da coluna). Setas navegam entre as células; Espaço marca.");
  }
  // destaca a coluna sob o ponteiro
  corpo.addEventListener("pointerover", (ev) => {
    const c = ev.target.closest("[data-c]")?.dataset.c;
    corpo.querySelectorAll(".dreq-col-foco").forEach((x) => x.classList.remove("dreq-col-foco"));
    if (c != null) corpo.querySelectorAll(`[data-c="${c}"]`).forEach((x) => { if (x.tagName !== "BUTTON") x.classList.add("dreq-col-foco"); });
  });
  const novoReq = (d) => { const r = { id: novoId("r"), cod: proximoCod(d.req, "RF"), desc: "", tipo: "RF", prio: "", origem: "", status: "" }; d.req.push(r); return r; };
  return {
    render,
    aoMudarCampo(c, a) {
      if (c.dataset.ref.endsWith(":tipo")) { // troca o prefixo do código automático
        const r = a.o;
        if (/^(RF|RNF|RN)\d+$/i.test(limpa(r.cod)) || !limpa(r.cod)) { r.cod = ""; r.cod = proximoCod(n.d.req, r.tipo); }
      }
      return c.tagName === "SELECT";
    },
    tecla(ev) {
      if ((ev.key === "Delete" || ev.key === "Backspace") && selLinha && ev.target.closest?.(".dreq-num")) { ev.preventDefault(); const id = selLinha; selLinha = null; ctx.alterar((d) => { d.req = d.req.filter((r) => r.id !== id); d.x = d.x.filter((p) => p[0] !== id); d.dep = d.dep.filter((p) => p[0] !== id && p[1] !== id); }); return; }
      const b = ev.target.closest?.(".dreq-x"); if (!b || !ev.key.startsWith("Arrow")) return;
      ev.preventDefault();
      let r = Number(b.dataset.r), c = Number(b.dataset.c);
      if (ev.key === "ArrowUp") r--; else if (ev.key === "ArrowDown") r++; else if (ev.key === "ArrowLeft") c--; else c++;
      const prox = corpo.querySelector(`.dreq-x[data-r="${r}"][data-c="${c}"]`) || (ev.key === "ArrowRight" ? corpo.querySelector(`.dreq-x[data-r="${r}"][data-c="${c + 1}"]`) : ev.key === "ArrowLeft" ? corpo.querySelector(`.dreq-x[data-r="${r}"][data-c="${c - 1}"]`) : null);
      prox?.focus();
    },
    acao(a, b) {
      const id = b.dataset.id;
      if (a === "vista") { vista = b.dataset.v; render(); }
      else if (a === "detalhes") { detalhes = b.checked; render(); }
      else if (a === "addReq") { let novo; ctx.alterar((d) => { novo = novoReq(d); }, () => `[data-ref="req:${novo.id}:desc"]`); }
      else if (a === "addCol") {
        if (vista === "dep") return;
        let c; ctx.alterar((d) => { const t = b.dataset.t; c = { id: novoId("c"), cod: proximoCod(d.col, PREFIXO_COL[t]), nome: "", tipo: t }; d.col.push(c); }, () => `[data-ref="col:${c.id}:nome"]`);
      } else if (a === "marcar") {
        const [r, c] = id.split("|");
        ctx.alterar((d) => { const v = vista === "dep" ? d.dep : d.x, i = v.findIndex((p) => p[0] === r && p[1] === c); if (i >= 0) v.splice(i, 1); else v.push([r, c]); });
      } else if (a === "selLinha") { selLinha = selLinha === id ? null : id; render(); }
      else if (a === "reqSobe" || a === "reqDesce") ctx.alterar((d) => { const i = d.req.findIndex((r) => r.id === id); moverNoVetor(d.req, i, i + (a === "reqSobe" ? -1 : 1)); });
      else if (a === "reqDel") ctx.alterar((d) => { d.req = d.req.filter((r) => r.id !== id); d.x = d.x.filter((p) => p[0] !== id); d.dep = d.dep.filter((p) => p[0] !== id && p[1] !== id); if (selLinha === id) selLinha = null; });
      else if (a === "colEsq" || a === "colDir") ctx.alterar((d) => { const i = d.col.findIndex((c) => c.id === id); moverNoVetor(d.col, i, i + (a === "colEsq" ? -1 : 1)); });
      else if (a === "colDel") ctx.alterar((d) => { d.col = d.col.filter((c) => c.id !== id); d.x = d.x.filter((p) => p[1] !== id); });
    }
  };
}

/* ══════════════════════ documento de requisitos ══════════════════════ */
const PREFIXO_REQ = { RF: "RF", RNF: "RNF", RN: "RN", RES: "RES" };
function barraRequisitos() {
  return `<span class="dreq-grupo"><b>Adicionar</b>${btn("addItem", "+ RF", "Requisito funcional", ' data-t="RF"')}${btn("addItem", "+ RNF", "Requisito não funcional", ' data-t="RNF"')}${btn("addItem", "+ Regra de negócio", "Regra de negócio (RN)", ' data-t="RN"')}${btn("addItem", "+ Restrição", "Restrição do projeto", ' data-t="RES"')}</span>` +
    `<span class="dreq-grupo">${btn("addHist", "+ Revisão", "Nova linha no histórico de revisões (controle de versões)")}</span>`;
}
function criarRequisitos(ctx) {
  const { n, corpo } = ctx;
  function render(foco) {
    const d = n.d, c = d.cab;
    let h = `<section class="dreq-sec"><h4 class="dreq-sub">Identificação do documento</h4><div class="dreq-cab">` +
      `<label class="dreq-cab-proj"><span>Projeto</span><input class="dreq-in" data-ref="cab::projeto" value="${esc(c.projeto)}" maxlength="160" placeholder="Nome do sistema"></label>` +
      `<label><span>Versão</span><input class="dreq-in" data-ref="cab::versao" value="${esc(c.versao)}" maxlength="20" placeholder="1.0"></label>` +
      `<label><span>Data</span><input class="dreq-in" type="date" data-ref="cab::data" value="${esc(c.data)}"></label>` +
      `<label><span>Autor</span><input class="dreq-in" data-ref="cab::autor" value="${esc(c.autor)}" maxlength="120" placeholder="Analista"></label></div></section>`;
    h += `<section class="dreq-sec"><h4 class="dreq-sub">Histórico de revisões <span class="dreq-pequeno">(controle de versões)</span></h4>`;
    if (d.hist.length) {
      h += `<table class="dreq-tab"><thead><tr><th>Versão</th><th>Data</th><th>Autor</th><th class="dreq-c-desc">Descrição da mudança</th><th></th></tr></thead><tbody>` +
        d.hist.map((x) => `<tr><td><input class="dreq-in dreq-in-cod" data-ref="hist:${x.id}:versao" value="${esc(x.versao)}" maxlength="20" placeholder="1.1" aria-label="Versão"></td>` +
          `<td><input class="dreq-in" type="date" data-ref="hist:${x.id}:data" value="${esc(x.data)}" aria-label="Data"></td>` +
          `<td><input class="dreq-in" data-ref="hist:${x.id}:autor" value="${esc(x.autor)}" maxlength="120" aria-label="Autor"></td>` +
          `<td class="dreq-c-desc"><textarea class="dreq-in dreq-auto" rows="1" data-ref="hist:${x.id}:desc" maxlength="400" placeholder="O que mudou nesta versão" aria-label="Descrição da mudança">${esc(x.desc)}</textarea></td>` +
          `<td>${mini("histDel", x.id, "×", "Excluir revisão")}</td></tr>`).join("") + "</tbody></table>";
    } else h += `<p class="dreq-vazio">Sem revisões. Use <b>+ Revisão</b> para registrar uma versão.</p>`;
    h += `</section><section class="dreq-sec"><h4 class="dreq-sub">Requisitos <span class="dreq-pequeno">${Object.keys(TIPOS_REQ).map((t) => t + ": " + d.itens.filter((r) => r.tipo === t).length).join(" · ")}</span></h4>`;
    if (d.itens.length) {
      h += `<table class="dreq-tab dreq-reqs"><thead><tr><th class="dreq-c-n">#</th><th class="dreq-c-cod">ID</th><th>Tipo</th><th>Categoria (RNF)</th><th class="dreq-c-desc">Descrição</th><th>Prioridade</th><th>Origem</th></tr></thead><tbody>` +
        d.itens.map((r, i) => `<tr data-id="${r.id}"><td class="dreq-c-n"><span class="dreq-num-ro">${i + 1}</span><span class="dreq-linha-acoes">${mini("itemSobe", r.id, "↑", "Subir", i === 0 ? " disabled" : "")}${mini("itemDesce", r.id, "↓", "Descer", i === d.itens.length - 1 ? " disabled" : "")}${mini("itemDel", r.id, "×", "Excluir requisito")}</span></td>` +
          `<td class="dreq-c-cod"><input class="dreq-in dreq-in-cod" data-ref="itens:${r.id}:cod" value="${esc(r.cod)}" maxlength="20" aria-label="ID"></td>` +
          `<td><select class="dreq-in dreq-tipo-sel dreq-tipo-${r.tipo}" data-ref="itens:${r.id}:tipo" aria-label="Tipo">${opcoes(Object.entries(TIPOS_REQ).map(([k, v]) => [k, k + " — " + v]), r.tipo, null)}</select></td>` +
          `<td><select class="dreq-in" data-ref="itens:${r.id}:cat" aria-label="Categoria"${r.tipo === "RNF" ? "" : " disabled"}>${r.tipo === "RNF" ? opcoes(CATEGORIAS_RNF, r.cat, "escolha…") : '<option value="">—</option>'}</select></td>` +
          `<td class="dreq-c-desc"><textarea class="dreq-in dreq-auto" rows="1" data-ref="itens:${r.id}:desc" maxlength="800" placeholder="${r.tipo === "RF" ? "O sistema deve permitir…" : r.tipo === "RNF" ? "O sistema deve responder em até…" : r.tipo === "RN" ? "Regra: …" : "O sistema deve ser desenvolvido em…"}" aria-label="Descrição">${esc(r.desc)}</textarea></td>` +
          `<td><select class="dreq-in dreq-prio-sel dreq-prio-${classePrio(r.prio)}" data-ref="itens:${r.id}:prio" aria-label="Prioridade">${opcoesPrio(r.prio)}</select></td>` +
          `<td><input class="dreq-in" data-ref="itens:${r.id}:origem" value="${esc(r.origem)}" maxlength="120" placeholder="quem pediu" aria-label="Origem"></td></tr>`).join("") + "</tbody></table>";
    } else h += `<p class="dreq-vazio">Nenhum requisito. Use os botões <b>+ RF</b>, <b>+ RNF</b>, <b>+ Regra de negócio</b> ou <b>+ Restrição</b>.</p>`;
    h += "</section>";
    trocarHtml(corpo, h, foco);
    ctx.dica("RF = o que o sistema faz · RNF = como/qualidade (escolha a categoria) · RN = regra do negócio · Restrição = limite imposto ao projeto.");
  }
  return {
    render,
    aoMudarCampo(c, a) {
      if (c.dataset.ref.endsWith(":tipo")) {
        const r = a.o;
        if (r.tipo !== "RNF") r.cat = "";
        if (!limpa(r.cod) || /^(RF|RNF|RN|RES)\d+$/i.test(limpa(r.cod))) { r.cod = ""; r.cod = proximoCod(n.d.itens, PREFIXO_REQ[r.tipo]); }
      }
      return c.tagName === "SELECT";
    },
    acao(a, b) {
      const id = b.dataset.id;
      if (a === "addItem") { let r; ctx.alterar((d) => { const t = b.dataset.t; r = { id: novoId("q"), cod: proximoCod(d.itens, PREFIXO_REQ[t]), tipo: t, cat: "", desc: "", prio: "", origem: "" }; d.itens.push(r); }, () => `[data-ref="itens:${r.id}:desc"]`); }
      else if (a === "addHist") {
        let x; ctx.alterar((d) => { const ult = d.hist[d.hist.length - 1]; x = { id: novoId("h"), versao: ult ? proximaVersao(ult.versao) : d.cab.versao || "1.0", data: new Date().toISOString().slice(0, 10), autor: d.cab.autor || "", desc: "" }; d.hist.push(x); }, () => `[data-ref="hist:${x.id}:desc"]`);
      } else if (a === "histDel") ctx.alterar((d) => { d.hist = d.hist.filter((x) => x.id !== id); });
      else if (a === "itemDel") ctx.alterar((d) => { d.itens = d.itens.filter((x) => x.id !== id); });
      else if (a === "itemSobe" || a === "itemDesce") ctx.alterar((d) => { const i = d.itens.findIndex((x) => x.id === id); moverNoVetor(d.itens, i, i + (a === "itemSobe" ? -1 : 1)); });
    }
  };
}
function proximaVersao(v) { const m = /^(\d+)\.(\d+)$/.exec(limpa(v)); return m ? m[1] + "." + (Number(m[2]) + 1) : ""; }

/* ══════════════════════ quadro Kanban ══════════════════════ */
function barraKanban() { return `<span class="dreq-grupo">${btn("addCol", "+ Coluna", "Nova etapa do fluxo de trabalho")}</span>`; }
function criarKanban(ctx) {
  const { n, corpo, raiz } = ctx;
  let selCard = null;
  // atualiza o contador "n/WIP" sem redesenhar (o campo continua com o foco)
  function atualizarWip(c) {
    const col = n.d.cols.find((x) => c.dataset.ref === `cols:${x.id}:wip`); if (!col) return;
    const sec = c.closest(".dreq-kcol"), qtd = n.d.cards.filter((k) => k.col === col.id).length, acima = col.wip && qtd > col.wip;
    sec.classList.toggle("dreq-acima", !!acima);
    sec.querySelector(".dreq-wip").textContent = qtd + (col.wip ? "/" + col.wip : "");
  }
  function render(foco) {
    const d = n.d;
    let h = `<div class="dreq-quadro">`;
    d.cols.forEach((c, j) => {
      const cs = d.cards.filter((k) => k.col === c.id), acima = c.wip && cs.length > c.wip;
      h += `<section class="dreq-kcol${acima ? " dreq-acima" : ""}" aria-label="Coluna ${esc(c.nome)}"><header class="dreq-kcab">` +
        `<input class="dreq-in dreq-kcol-nome" data-ref="cols:${c.id}:nome" value="${esc(c.nome)}" maxlength="60" placeholder="Etapa" aria-label="Nome da coluna">` +
        `<span class="dreq-wip" title="${acima ? "Acima do limite WIP!" : "Cartões / limite WIP"}">${cs.length}${c.wip ? "/" + c.wip : ""}</span>` +
        `<div class="dreq-kcab-l2"><label title="Limite de trabalho em andamento (0 = sem limite)">WIP <input class="dreq-in dreq-in-wip" type="number" min="0" max="99" data-ref="cols:${c.id}:wip" value="${c.wip || 0}" aria-label="Limite WIP de ${esc(c.nome)}"></label>` +
        `<span>${mini("colEsq", c.id, "◀", "Mover coluna para a esquerda", j === 0 ? " disabled" : "")}${mini("colDir", c.id, "▶", "Mover coluna para a direita", j === d.cols.length - 1 ? " disabled" : "")}${mini("colDel", c.id, "×", "Excluir coluna e seus cartões")}</span></div></header>` +
        `<div class="dreq-klista" data-solta="${c.id}">` +
        cs.map((k) => `<article class="dreq-card${selCard === k.id ? " dreq-sel" : ""} dreq-card-${classePrio(k.prio)}" data-id="${k.id}" tabindex="-1" data-foco="card-${k.id}">` +
          `<div class="dreq-card-topo"><span class="dreq-alca" data-arrastar title="Arraste para outra coluna" aria-hidden="true">⠿</span>` +
          `<select class="dreq-in dreq-prio-sel dreq-prio-${classePrio(k.prio)}" data-ref="cards:${k.id}:prio" aria-label="Prioridade">${opcoesPrio(k.prio)}</select><span class="dreq-esp"></span>` +
          `${mini("cardEsq", k.id, "◀", "Mover para a coluna anterior", j === 0 ? " disabled" : "")}${mini("cardDir", k.id, "▶", "Mover para a próxima coluna", j === d.cols.length - 1 ? " disabled" : "")}${mini("cardDel", k.id, "×", "Excluir cartão")}</div>` +
          `<textarea class="dreq-in dreq-auto dreq-card-txt" rows="2" data-ref="cards:${k.id}:txt" maxlength="300" placeholder="Tarefa / item de trabalho" aria-label="Texto do cartão">${esc(k.txt)}</textarea>` +
          `<input class="dreq-in dreq-card-resp" data-ref="cards:${k.id}:resp" value="${esc(k.resp)}" maxlength="60" placeholder="👤 responsável" aria-label="Responsável"></article>`).join("") +
        `</div><button type="button" class="dreq-add-card" data-acao="addCard" data-id="${c.id}">+ Cartão</button></section>`;
    });
    if (!d.cols.length) h += `<p class="dreq-vazio">Sem colunas. Use <b>+ Coluna</b>.</p>`;
    trocarHtml(corpo, h + "</div>", foco);
    ctx.dica("Arraste o cartão pela alça ⠿ (ou use ◀ ▶). O número no topo da coluna fica vermelho quando passa do limite WIP.");
  }
  ativarArrasto(raiz, corpo, { item: ".dreq-card", aoSoltar: (id, col, antes) => ctx.alterar((d) => reposicionar(d.cards, id, "col", col, antes)) });
  corpo.addEventListener("pointerdown", (ev) => { const k = ev.target.closest(".dreq-card"); if (k && !ehCampo(ev.target)) { selCard = k.dataset.id; corpo.querySelectorAll(".dreq-card").forEach((x) => x.classList.toggle("dreq-sel", x === k)); } });
  return {
    render,
    aoDigitar(c) { if (c.type === "number") atualizarWip(c); },
    aoMudarCampo(c) { if (c.type === "number") atualizarWip(c); return c.tagName === "SELECT"; },
    tecla(ev) { if ((ev.key === "Delete") && selCard) { ev.preventDefault(); const id = selCard; selCard = null; ctx.alterar((d) => { d.cards = d.cards.filter((k) => k.id !== id); }); } },
    acao(a, b) {
      const id = b.dataset.id;
      if (a === "addCol") { let c; ctx.alterar((d) => { c = { id: novoId("k"), nome: "", wip: 0 }; d.cols.push(c); }, () => `[data-ref="cols:${c.id}:nome"]`); }
      else if (a === "colDel") ctx.alterar((d) => { d.cols = d.cols.filter((c) => c.id !== id); d.cards = d.cards.filter((k) => k.col !== id); });
      else if (a === "colEsq" || a === "colDir") ctx.alterar((d) => { const i = d.cols.findIndex((c) => c.id === id); moverNoVetor(d.cols, i, i + (a === "colEsq" ? -1 : 1)); });
      else if (a === "addCard") { let k; ctx.alterar((d) => { k = { id: novoId("t"), col: id, txt: "", resp: "", prio: "" }; reposicionar((d.cards.push(k), d.cards), k.id, "col", id, null); }, () => `[data-ref="cards:${k.id}:txt"]`); }
      else if (a === "cardDel") ctx.alterar((d) => { d.cards = d.cards.filter((k) => k.id !== id); });
      else if (a === "cardEsq" || a === "cardDir") ctx.alterar((d) => {
        const k = d.cards.find((x) => x.id === id), j = d.cols.findIndex((c) => c.id === k.col) + (a === "cardEsq" ? -1 : 1);
        if (j < 0 || j >= d.cols.length) return false;
        reposicionar(d.cards, id, "col", d.cols[j].id, null);
      }, () => `[data-foco="card-${id}"]`);
    }
  };
}

/* ══════════════════════ histórias de usuário (backlog) ══════════════════════ */
const PONTOS = ["1", "2", "3", "5", "8", "13", "21", "?"];
function barraHistorias() { return `<span class="dreq-grupo">${btn("addHist", "+ História de usuário", "Como <papel>, quero <ação>, para <benefício>")}</span>`; }
function criarHistorias(ctx) {
  const { n, corpo, raiz } = ctx;
  function render(foco) {
    const d = n.d;
    let h = `<ol class="dreq-backlog" data-solta="backlog">`;
    d.itens.forEach((x, i) => {
      h += `<li class="dreq-hist" data-id="${x.id}"><div class="dreq-hist-cab"><span class="dreq-alca" data-arrastar title="Arraste para mudar a ordem do backlog" aria-hidden="true">⠿</span><span class="dreq-ordem">${i + 1}</span>` +
        `<input class="dreq-in dreq-in-cod" data-ref="itens:${x.id}:cod" value="${esc(x.cod)}" maxlength="20" aria-label="Código da história">` +
        `<label>Prioridade <select class="dreq-in dreq-prio-sel dreq-prio-${classePrio(x.prio)}" data-ref="itens:${x.id}:prio">${opcoesPrio(x.prio)}</select></label>` +
        `<label>Pontos <select class="dreq-in" data-ref="itens:${x.id}:pontos">${opcoes(PONTOS, x.pontos)}</select></label><span class="dreq-esp"></span>` +
        `${mini("sobe", x.id, "↑", "Subir no backlog", i === 0 ? " disabled" : "")}${mini("desce", x.id, "↓", "Descer no backlog", i === d.itens.length - 1 ? " disabled" : "")}${mini("del", x.id, "×", "Excluir história")}</div>` +
        `<div class="dreq-frase-ed"><span>Como</span><input class="dreq-in" data-ref="itens:${x.id}:papel" value="${esc(x.papel)}" maxlength="120" placeholder="papel (ex.: recepcionista)" aria-label="Papel">` +
        `<span>, quero</span><textarea class="dreq-in dreq-auto" rows="1" data-ref="itens:${x.id}:acao" maxlength="300" placeholder="ação / funcionalidade" aria-label="Ação">${esc(x.acao)}</textarea>` +
        `<span>, para</span><textarea class="dreq-in dreq-auto" rows="1" data-ref="itens:${x.id}:beneficio" maxlength="300" placeholder="benefício / valor" aria-label="Benefício">${esc(x.beneficio)}</textarea></div>` +
        `<div class="dreq-crit"><div class="dreq-pequeno">Critérios de aceitação</div>` +
        x.criterios.map((c, ci) => `<div class="dreq-crit-l"><span aria-hidden="true">✓</span><input class="dreq-in" data-ref="crit:${x.id}:${ci}" value="${esc(c)}" maxlength="300" placeholder="Dado… quando… então…" aria-label="Critério ${ci + 1}">${mini("critDel", x.id, "×", "Excluir critério", ` data-i="${ci}"`)}</div>`).join("") +
        `<button type="button" class="dreq-link" data-acao="critAdd" data-id="${x.id}">+ critério</button></div></li>`;
    });
    h += "</ol>";
    if (!d.itens.length) h += `<p class="dreq-vazio">Backlog vazio. Use <b>+ História de usuário</b>. A ordem da lista é a prioridade (o topo é feito primeiro).</p>`;
    trocarHtml(corpo, h, foco);
    ctx.dica("Escreva cada história no formato Como… quero… para…, com critérios de aceitação. Ordene o backlog arrastando pela alça ⠿ ou com ↑ ↓.");
  }
  ativarArrasto(raiz, corpo, { item: ".dreq-hist", aoSoltar: (id, _g, antes) => ctx.alterar((d) => reposicionar(d.itens, id, null, null, antes)) });
  return {
    render,
    aoMudarCampo(c) { return c.tagName === "SELECT"; },
    acao(a, b) {
      const id = b.dataset.id;
      if (a === "addHist") { let x; ctx.alterar((d) => { x = { id: novoId("u"), cod: proximoCod(d.itens, "US"), papel: "", acao: "", beneficio: "", criterios: [""], prio: "", pontos: "" }; d.itens.push(x); }, () => `[data-ref="itens:${x.id}:papel"]`); }
      else if (a === "del") ctx.alterar((d) => { d.itens = d.itens.filter((x) => x.id !== id); });
      else if (a === "sobe" || a === "desce") ctx.alterar((d) => { const i = d.itens.findIndex((x) => x.id === id); moverNoVetor(d.itens, i, i + (a === "sobe" ? -1 : 1)); });
      else if (a === "critAdd") { let i; ctx.alterar((d) => { const x = d.itens.find((o) => o.id === id); i = x.criterios.length; x.criterios.push(""); }, () => `[data-ref="crit:${id}:${i}"]`); }
      else if (a === "critDel") ctx.alterar((d) => { const x = d.itens.find((o) => o.id === id); x.criterios.splice(Number(b.dataset.i), 1); });
    }
  };
}

/* ══════════════════════ mapa de empatia ══════════════════════ */
function barraEmpatia() { return `<span class="dreq-grupo"><b>Nota em</b>${AREAS_EMPATIA.map((a) => btn("addNota", esc(a.nome.replace(/^O que /, "").replace("?", "")), "Nova nota em " + a.nome, ` data-a="${a.id}"`)).join("")}</span>`; }
function criarEmpatia(ctx) {
  const { n, corpo, raiz } = ctx;
  let selNota = null;
  function render(foco) {
    const d = n.d;
    let h = `<div class="dreq-empatia">`;
    AREAS_EMPATIA.forEach((a) => {
      h += `<section class="dreq-area-emp dreq-emp-${a.id}"><h5>${esc(a.nome)} <span class="dreq-pequeno">${esc(a.dica)}</span></h5><div class="dreq-notas" data-solta="${a.id}">` +
        d.notas.filter((x) => x.area === a.id).map((x) => `<div class="dreq-nota${selNota === x.id ? " dreq-sel" : ""}" data-id="${x.id}" tabindex="-1" data-foco="nota-${x.id}"><div class="dreq-nota-topo"><span class="dreq-alca" data-arrastar title="Arraste para outra área" aria-hidden="true">⠿</span>${mini("notaDel", x.id, "×", "Excluir nota")}</div>` +
          `<textarea class="dreq-in dreq-auto" rows="2" data-ref="notas:${x.id}:txt" maxlength="300" aria-label="Nota em ${esc(a.nome)}">${esc(x.txt)}</textarea></div>`).join("") +
        `</div><button type="button" class="dreq-link" data-acao="addNota" data-a="${a.id}">+ nota</button></section>`;
    });
    h += `<section class="dreq-persona"><div class="dreq-rosto" aria-hidden="true">${ROSTO}</div><textarea class="dreq-in dreq-auto" rows="3" data-ref="d::persona" maxlength="300" placeholder="Quem é a persona? (nome, idade, contexto)" aria-label="Persona">${esc(d.persona)}</textarea></section></div>`;
    trocarHtml(corpo, h, foco);
    ctx.dica("Descreva a persona no centro e cole notas nas seis áreas. Arraste a nota pela alça ⠿ para mudar de área.");
  }
  ativarArrasto(raiz, corpo, { item: ".dreq-nota", aoSoltar: (id, area, antes) => ctx.alterar((d) => reposicionar(d.notas, id, "area", area, antes)) });
  corpo.addEventListener("pointerdown", (ev) => { const k = ev.target.closest(".dreq-nota"); if (k && !ehCampo(ev.target)) { selNota = k.dataset.id; corpo.querySelectorAll(".dreq-nota").forEach((x) => x.classList.toggle("dreq-sel", x === k)); } });
  return {
    render,
    tecla(ev) { if (ev.key === "Delete" && selNota) { ev.preventDefault(); const id = selNota; selNota = null; ctx.alterar((d) => { d.notas = d.notas.filter((x) => x.id !== id); }); } },
    acao(a, b) {
      if (a === "addNota") { let x; ctx.alterar((d) => { x = { id: novoId("n"), area: b.dataset.a, txt: "" }; reposicionar((d.notas.push(x), d.notas), x.id, "area", x.area, null); }, () => `[data-ref="notas:${x.id}:txt"]`); }
      else if (a === "notaDel") ctx.alterar((d) => { d.notas = d.notas.filter((x) => x.id !== b.dataset.id); });
    }
  };
}

const EDITORES = {
  "casos-de-uso": { barra: barraGrafico, criar: criarGrafico },
  atividades: { barra: barraGrafico, criar: criarGrafico },
  rastreabilidade: { barra: barraMatriz, criar: criarMatriz },
  requisitos: { barra: barraRequisitos, criar: criarRequisitos },
  kanban: { barra: barraKanban, criar: criarKanban },
  historias: { barra: barraHistorias, criar: criarHistorias },
  empatia: { barra: barraEmpatia, criar: criarEmpatia }
};
