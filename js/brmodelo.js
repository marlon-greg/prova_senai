// brModelo do sistema: editor de diagramas de banco de dados no jeito do brModelo 3 (UFSC), para a matéria de
// Banco de Dados. Modelo conceitual (MER: entidade, relacionamento, atributos, especialização...) e modelo lógico
// (tabelas com PK/FK), "Gerar modelo lógico" a partir do conceitual e "Gerar script SQL" (MySQL).
// Nada de prompt()/alert()/confirm(): na prova isso sai da tela cheia. Tudo é editado no próprio desenho
// (duplo clique), no Inspetor ou em janelinhas próprias.
//
// API:
//   montarBRModelo(container, { valor, modelo: "conceitual"|"logico"|"ambos", onMudar(valorString), somenteLeitura, ferramentas })
//        → { valor(): string (JSON; "" se vazio), destruir() }
//        ferramentas:false (prova) esconde Abrir/Salvar/Exportar; conversao:false esconde "Gerar lógico" e "Script SQL"
//        (para a questão em que o aluno precisa fazer o lógico na mão).
//   svgBRModelo(valor) → SVG (texto) só para ver (gabarito, tela do professor, exportar)
//
// A lógica pura (formato guardado, conversão, SQL, texto para a IA, comparação) fica em servidor/brmodelo-modelo.js.

import * as M from "../servidor/brmodelo-modelo.js";

const FONTE = "Arial, Helvetica, sans-serif";
const AZUL = "#1a73e8";
const GRADE = 10;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r1 = (n) => Math.round(n * 10) / 10;

// ---------- CSS ----------
function garantirCss() {
  if (typeof document === "undefined" || document.querySelector("link[data-brm-css]")) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = new URL("../css/brmodelo.css", import.meta.url).href;
  l.dataset.brmCss = "1";
  document.head.appendChild(l);
}

// ---------- desenho (texto SVG; o mesmo para o editor e para exportar) ----------
const linha = (x1, y1, x2, y2, cor = "#000", larg = 1.2) => `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${cor}" stroke-width="${larg}"/>`;
const texto = (x, y, s, extra = "") => `<text x="${r1(x)}" y="${r1(y)}" font-family="${FONTE}" font-size="12" fill="#000"${extra}>${esc(s)}</text>`;

// de que lado fica o nome do atributo (direita, a não ser que ele esteja à esquerda do dono)
// nome do atributo composto: em cima da elipse, ou embaixo se o dono está acima dela (para a linha não cortar o nome)
function nomeEmBaixo(a, ids, d) {
  const dono = ids.get(a.dono);
  return !!dono && M.geo(dono, d).cy < a.y - 12;
}
function ladoAtributo(a, ids, d) {
  const dono = ids.get(a.dono);
  if (!dono) return 1;
  const g = M.geo(dono, d);
  return a.x < g.cx - 4 ? -1 : 1;
}
const rotuloAtributo = (a) => a.nome + (a.card ? " " + a.card : "");

// caixa de cada elemento contando o nome do atributo
function caixa(e, d, ids) {
  const g = M.geo(e, d);
  if (e.t !== "atributo") return { x: g.x, y: g.y, w: g.w, h: g.h };
  const lw = rotuloAtributo(e).length * 6.6 + 6, lado = ladoAtributo(e, ids, d);
  if (g.composto) { const w = Math.max(lw, g.w); return nomeEmBaixo(e, ids, d) ? { x: g.cx - w / 2, y: g.y, w, h: g.h + 17 } : { x: g.cx - w / 2, y: g.y - 17, w, h: g.h + 17 }; }
  const x = lado > 0 ? g.x : g.x - lw;
  return { x, y: g.y - 3, w: g.w + lw, h: Math.max(g.h, 14) + 3 };
}

export function limites(d) {
  if (!d || !d.el.length) return { x: 0, y: 0, w: 0, h: 0 };
  const ids = new Map(d.el.map((e) => [e.id, e]));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of d.el) { const c = caixa(e, d, ids); x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y + c.h); }
  return { x: x0 - 24, y: y0 - 24, w: x1 - x0 + 48, h: y1 - y0 + 48 };
}

// ícone de chave (PK dourada, FK azul) do modelo lógico
function chave(x, y, cor) {
  return `<g transform="translate(${r1(x)},${r1(y)})"><circle cx="3.5" cy="0" r="3.2" fill="${cor}" stroke="#5a4a00" stroke-width=".7"/><path d="M6.5 -1 H13 V2 H11.6 V0.9 H10.2 V2.4 H8.8 V1 H6.5 Z" fill="${cor}" stroke="#5a4a00" stroke-width=".6"/><circle cx="2.6" cy="0" r="1" fill="#fff"/></g>`;
}
function iconeColuna(c, x, y) {
  if (c.pk && c.fk) return chave(x, y - 2.5, "#e8b923") + chave(x + 2, y + 2.5, "#4f86d6");
  if (c.pk) return chave(x, y, "#e8b923");
  if (c.fk) return chave(x, y, "#4f86d6");
  return `<circle cx="${r1(x + 5)}" cy="${r1(y)}" r="3" fill="#fff" stroke="#7a8699" stroke-width="1"/>`;
}

// vetores de uma ligação entre duas caixas (com deslocamento quando há várias entre as mesmas duas)
function trecho(ga, gb, off) {
  let dx = gb.cx - ga.cx, dy = gb.cy - ga.cy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const oa = [ga.cx + nx * off, ga.cy + ny * off], ob = [gb.cx + nx * off, gb.cy + ny * off];
  const pa = M.ponta(ga, ob[0], ob[1], oa[0], oa[1]);
  const pb = M.ponta(gb, oa[0], oa[1], ob[0], ob[1]);
  dx = pb[0] - pa[0]; dy = pb[1] - pa[1];
  const l2 = Math.hypot(dx, dy) || 1;
  return { pa, pb, ux: dx / l2, uy: dy / l2, nx, ny, len: l2 };
}
// cardinalidade escrita perto da ponta p (u aponta para dentro da linha)
function rotuloCard(p, ux, uy, nx, ny, s, valor, attrs, papel, dist = 20) {
  const lx = p[0] + ux * dist + nx * s * 7, ly = p[1] + uy * dist + ny * s * 10;
  const v = nx * s;
  const anchor = v > 0.35 ? "start" : v < -0.35 ? "end" : "middle";
  const w = Math.max(28, (valor || "( , )").length * 6.4);
  const rx = anchor === "start" ? lx - 2 : anchor === "end" ? lx - w + 2 : lx - w / 2;
  let s2 = `<g ${attrs} style="cursor:pointer"><rect x="${r1(rx)}" y="${r1(ly - 7)}" width="${r1(w)}" height="15" fill="#fff" fill-opacity="0.01"/>` +
    `<text x="${r1(lx)}" y="${r1(ly + 4)}" font-family="${FONTE}" font-size="11.5" fill="${valor ? "#000" : "#b00"}" text-anchor="${anchor}">${esc(valor || "( , )")}</text></g>`;
  const py = Math.abs(ny) > 0.5 ? ly + ny * s * 13 + 4 : ly + 17;
  if (papel) s2 += `<text x="${r1(lx)}" y="${r1(py)}" font-family="${FONTE}" font-size="11" font-style="italic" fill="#333" text-anchor="${anchor}">${esc(papel)}</text>`;
  return s2;
}

// grupos de ligações entre o mesmo par (para separar as paralelas do auto-relacionamento)
function grupos(li) {
  const m = new Map();
  for (const l of li) { const k = [l.a, l.b].sort().join("|"); if (!m.has(k)) m.set(k, []); m.get(k).push(l); }
  return (l) => { const g = m.get([l.a, l.b].sort().join("|")); const i = g.indexOf(l); return { i, k: g.length, off: (i - (g.length - 1) / 2) * 18 }; };
}

// ed = null (só desenho) ou { sel:Set, origem:id } (editor: marca seleção e põe data-*)
function desenhar(d, tipo, ed) {
  const ids = new Map(d.el.map((e) => [e.id, e]));
  const G = new Map(d.el.map((e) => [e.id, M.geo(e, d)]));
  const sel = ed?.sel || new Set();
  const cor = (id) => (sel.has(id) ? AZUL : "#000");
  const fundo = [], frente = [], rotulos = [];
  const par = grupos(d.li);

  if (tipo === "logico") {
    for (const l of d.li) {
      const ga = G.get(l.a), gb = G.get(l.b);
      if (!ga || !gb) continue;
      const c = cor(l.id);
      let t;
      if (l.a === l.b) {
        // auto-referência: alça do lado direito
        const x = ga.x + ga.w, y1 = ga.y + 14, y2 = ga.y + ga.h - 10;
        fundo.push(`<g data-li="${l.id}"><path d="M${x} ${y1} H${x + 30} V${y2} H${x}" fill="none" stroke="${c}" stroke-width="1.2"/><path d="M${x} ${y1} H${x + 30} V${y2} H${x}" fill="none" stroke="transparent" stroke-width="10"/></g>`);
        rotulos.push(rotuloCard([x, y1], 1, 0, 0, -1, 1, l.ca, `data-card="${l.id}" data-lado="a"`) + rotuloCard([x, y2], 1, 0, 0, 1, 1, l.cb, `data-card="${l.id}" data-lado="b"`));
        continue;
      }
      const { off } = par(l);
      t = trecho(ga, gb, off);
      const pe = (p, ux, uy, card) => {
        // pé de galinha para "n", traço para "1"
        if (!card) return "";
        const q = [p[0] + ux * 11, p[1] + uy * 11];
        let s = "";
        if (M.maxN(card)) s += linha(q[0], q[1], p[0] + t.nx * 6, p[1] + t.ny * 6, c) + linha(q[0], q[1], p[0] - t.nx * 6, p[1] - t.ny * 6, c);
        else s += linha(p[0] + ux * 6 + t.nx * 5, p[1] + uy * 6 + t.ny * 5, p[0] + ux * 6 - t.nx * 5, p[1] + uy * 6 - t.ny * 5, c);
        if (M.minCard(card) === 0) s += `<circle cx="${r1(p[0] + ux * 16)}" cy="${r1(p[1] + uy * 16)}" r="3" fill="#fff" stroke="${c}" stroke-width="1"/>`;
        else s += linha(p[0] + ux * 15 + t.nx * 5, p[1] + uy * 15 + t.ny * 5, p[0] + ux * 15 - t.nx * 5, p[1] + uy * 15 - t.ny * 5, c);
        return s;
      };
      fundo.push(`<g data-li="${l.id}">${linha(t.pa[0], t.pa[1], t.pb[0], t.pb[1], c)}${linha(t.pa[0], t.pa[1], t.pb[0], t.pb[1], "transparent", 10)}${pe(t.pa, t.ux, t.uy, l.ca)}${pe(t.pb, -t.ux, -t.uy, l.cb)}</g>`);
      const s = off < 0 ? -1 : 1;
      rotulos.push(rotuloCard(t.pa, t.ux, t.uy, t.nx, t.ny, s, l.ca, `data-card="${l.id}" data-lado="a"`, "", 30) + rotuloCard(t.pb, -t.ux, -t.uy, t.nx, t.ny, s, l.cb, `data-card="${l.id}" data-lado="b"`, "", 30));
    }
    for (const e of d.el) {
      const g = G.get(e.id), c = cor(e.id);
      if (e.t === "texto") { frente.push(desenharTexto(e, g, c)); continue; }
      const cols = e.cols || [];
      let s = `<g data-id="${e.id}"><rect x="${g.x}" y="${g.y}" width="${r1(g.w)}" height="${r1(g.h)}" fill="#fff" stroke="${c}" stroke-width="${sel.has(e.id) ? 2 : 1.2}"/>` +
        `<rect x="${g.x}" y="${g.y}" width="${r1(g.w)}" height="24" fill="#dfe7f2" stroke="${c}" stroke-width="${sel.has(e.id) ? 2 : 1.2}"/>` +
        texto(g.cx, g.y + 16.5, e.nome, ' font-weight="bold" text-anchor="middle"');
      cols.forEach((col, i) => {
        const y = g.y + 26 + i * 19;
        s += `<g data-col="${i}"><rect x="${g.x + 1}" y="${y}" width="${r1(g.w - 2)}" height="19" fill="#fff" fill-opacity="0.01"/>${iconeColuna(col, g.x + 7, y + 9.5)}` +
          texto(g.x + 24, y + 13.5, col.nome, col.pk ? ' font-weight="bold"' : col.nn ? "" : ' font-style="italic"') +
          `<text x="${r1(g.x + g.w - 7)}" y="${r1(y + 13.5)}" font-family="${FONTE}" font-size="10.5" fill="#666" text-anchor="end">${esc(col.tipo)}${col.nn || col.pk ? "" : " ?"}</text></g>`;
      });
      if (!cols.length) s += `<text x="${r1(g.cx)}" y="${g.y + 40}" font-family="${FONTE}" font-size="11" fill="#999" text-anchor="middle">(sem colunas)</text>`;
      frente.push(s + "</g>");
    }
  } else {
    // ligações entidade—relacionamento e especialização
    for (const l of d.li) {
      const A = ids.get(l.a), ga = G.get(l.a), gb = G.get(l.b);
      if (!A || !ga || !gb) continue;
      const c = cor(l.id);
      if (A.t === "especializacao") {
        const bx = ga.cx, by = ga.y + ga.h, p = M.ponta(gb, bx, by);
        fundo.push(`<g data-li="${l.id}">${linha(bx, by, p[0], p[1], c)}${linha(bx, by, p[0], p[1], "transparent", 10)}</g>`);
        continue;
      }
      const { off } = par(l);
      const t = trecho(ga, gb, off);
      fundo.push(`<g data-li="${l.id}">${linha(t.pa[0], t.pa[1], t.pb[0], t.pb[1], c)}${linha(t.pa[0], t.pa[1], t.pb[0], t.pb[1], "transparent", 10)}</g>`);
      rotulos.push(rotuloCard(t.pa, t.ux, t.uy, t.nx, t.ny, off < 0 ? -1 : 1, l.card, `data-card="${l.id}" data-lado="card"`, l.papel));
    }
    // linha do pai da especialização (sai da ponta do triângulo)
    for (const e of d.el.filter((e) => e.t === "especializacao" && ids.get(e.pai))) {
      const g = G.get(e.id), gp = G.get(e.pai), p = M.ponta(gp, g.cx, g.y);
      fundo.push(linha(g.cx, g.y, p[0], p[1], cor(e.id)));
    }
    // linhas dos atributos
    for (const a of d.el.filter((e) => e.t === "atributo")) {
      const g = G.get(a.id), gd = G.get(a.dono);
      if (!gd) continue;
      const p1 = M.ponta(gd, g.cx, g.cy), p2 = M.ponta(g, gd.cx, gd.cy);
      fundo.push(linha(p1[0], p1[1], p2[0], p2[1], cor(a.id)));
    }
    const ordem = ["texto", "entidade", "associativa", "relacionamento", "especializacao", "atributo"];
    for (const e of d.el.slice().sort((x, y) => ordem.indexOf(x.t) - ordem.indexOf(y.t))) {
      const g = G.get(e.id), c = cor(e.id), sw = sel.has(e.id) ? 2 : 1.2;
      let s = `<g data-id="${e.id}">`;
      if (e.t === "entidade") s += `<rect x="${g.x}" y="${g.y}" width="${r1(g.w)}" height="${g.h}" fill="#fff" stroke="${c}" stroke-width="${sw}"/>` + texto(g.cx, g.cy + 4.5, e.nome, ' text-anchor="middle"');
      else if (e.t === "associativa") {
        const p = M.poligono({ ...g, x: g.x + 8, y: g.y + 8, w: g.w - 16, h: g.h - 16, forma: "losango" });
        s += `<rect x="${g.x}" y="${g.y}" width="${r1(g.w)}" height="${g.h}" fill="#fff" stroke="${c}" stroke-width="${sw}"/><polygon points="${p.map((q) => q.map(r1).join(",")).join(" ")}" fill="#fff" stroke="${c}" stroke-width="${sw}"/>` + texto(g.cx, g.cy + 4.5, e.nome, ' text-anchor="middle"');
      } else if (e.t === "relacionamento") {
        s += `<polygon points="${M.poligono(g).map((q) => q.map(r1).join(",")).join(" ")}" fill="#fff" stroke="${c}" stroke-width="${sw}"/>` + texto(g.cx, g.cy + 4.5, e.nome, ' text-anchor="middle"');
      } else if (e.t === "especializacao") {
        s += `<polygon points="${M.poligono(g).map((q) => q.map(r1).join(",")).join(" ")}" fill="#fff" stroke="${c}" stroke-width="${sw}"/>` +
          `<text x="${r1(g.cx)}" y="${r1(g.y + g.h - 7)}" font-family="${FONTE}" font-size="11" fill="#000" text-anchor="middle">${e.total ? "t" : "p"},${e.exclusiva ? "x" : "c"}</text>`;
      } else if (e.t === "atributo") {
        const lado = ladoAtributo(e, ids, d);
        s += g.composto
          ? `<ellipse cx="${g.cx}" cy="${g.cy}" rx="${g.rx}" ry="${g.ry}" fill="${e.chave ? "#000" : "#fff"}" stroke="${c}" stroke-width="${sw}"/>`
          : `<circle cx="${g.cx}" cy="${g.cy}" r="${g.rx}" fill="${e.chave ? "#000" : "#fff"}" stroke="${c}" stroke-width="${sw}"/>`;
        s += g.composto ? texto(g.cx, nomeEmBaixo(e, ids, d) ? g.y + g.h + 13 : g.y - 5, rotuloAtributo(e), ' text-anchor="middle"') : texto(lado > 0 ? g.x + g.w + 4 : g.x - 4, g.cy + 4, rotuloAtributo(e), lado > 0 ? "" : ' text-anchor="end"');
        if (ed) { const b = caixa(e, d, ids); s += `<rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}" fill="#fff" fill-opacity="0.01"/>`; }
      } else if (e.t === "texto") { frente.push(desenharTexto(e, g, c)); continue; }
      frente.push(s + "</g>");
    }
  }
  // seleção: contorno tracejado e alça de ligar
  const marcas = [];
  if (ed) {
    for (const id of sel) {
      const e = ids.get(id);
      if (!e) continue;
      const b = caixa(e, d, ids);
      marcas.push(`<rect x="${r1(b.x - 4)}" y="${r1(b.y - 4)}" width="${r1(b.w + 8)}" height="${r1(b.h + 8)}" fill="none" stroke="${AZUL}" stroke-dasharray="4 3" stroke-width="1" pointer-events="none"/>`);
    }
    if (ed.origem && ids.get(ed.origem)) {
      const b = caixa(ids.get(ed.origem), d, ids);
      marcas.push(`<rect x="${r1(b.x - 5)}" y="${r1(b.y - 5)}" width="${r1(b.w + 10)}" height="${r1(b.h + 10)}" fill="none" stroke="#12805c" stroke-width="2" pointer-events="none"/>`);
    }
    if (sel.size === 1 && !ed.somenteLeitura) {
      const e = ids.get([...sel][0]);
      if (e && e.t !== "texto") {
        const b = caixa(e, d, ids), hx = b.x + b.w + 9, hy = b.y - 9;
        marcas.push(`<g data-handle="${e.id}" style="cursor:crosshair"><title>Arraste até outro objeto para ligar</title><circle cx="${r1(hx)}" cy="${r1(hy)}" r="8" fill="${AZUL}"/><path d="M${r1(hx - 4)} ${r1(hy + 4)} L${r1(hx + 4)} ${r1(hy - 4)} M${r1(hx)} ${r1(hy - 4)} H${r1(hx + 4)} V${r1(hy)}" stroke="#fff" stroke-width="1.6" fill="none"/></g>`);
      }
    }
  }
  return fundo.join("") + frente.join("") + rotulos.join("") + marcas.join("");
}

function desenharTexto(e, g, c) {
  const linhas = String(e.nome || "").split("\n");
  return `<g data-id="${e.id}"><rect x="${g.x}" y="${g.y}" width="${r1(g.w)}" height="${g.h}" fill="#fffbe0" stroke="${c === "#000" ? "#c9b458" : c}" stroke-width="1"/>` +
    linhas.map((l, i) => `<text x="${g.x + 7}" y="${g.y + 16 + i * 15}" font-family="${FONTE}" font-size="11.5" fill="#333">${esc(l)}</text>`).join("") + "</g>";
}

// SVG completo (só leitura): os dois diagramas, um embaixo do outro, se houver os dois
export function svgBRModelo(valor) {
  const m = M.lerModelo(valor);
  const partes = [];
  if (m?.conceitual && !M.modeloVazio(m.conceitual)) partes.push(["conceitual", m.conceitual, "Modelo conceitual"]);
  if (m?.logico && !M.modeloVazio(m.logico)) partes.push(["logico", m.logico, "Modelo lógico"]);
  if (!partes.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="60" viewBox="0 0 240 60"><rect width="240" height="60" fill="#fff"/><text x="120" y="35" font-family="${FONTE}" font-size="13" fill="#888" text-anchor="middle">(diagrama em branco)</text></svg>`;
  const titulos = partes.length > 1;
  let y = 0, w = 0, corpo = "";
  for (const [tipo, d, nome] of partes) {
    const b = limites(d);
    if (titulos) { corpo += `<text x="12" y="${y + 20}" font-family="${FONTE}" font-size="13" font-weight="bold" fill="#14213d">${nome}</text>`; y += 28; }
    corpo += `<g transform="translate(${r1(-b.x)},${r1(y - b.y)})">${desenhar(d, tipo, null)}</g>`;
    y += b.h + 12; w = Math.max(w, b.w);
  }
  w = Math.ceil(Math.max(w, 200)); y = Math.ceil(y);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${y}" viewBox="0 0 ${w} ${y}"><rect width="${w}" height="${y}" fill="#fff"/>${corpo}</svg>`;
}

// ---------- ícones (SVG) ----------
const IC = {
  sel: '<path d="M6 3 L6 19 L10 15 L13 21 L15.5 20 L12.6 14 L18 14 Z" fill="#fff" stroke="#222" stroke-width="1.3" stroke-linejoin="round"/>',
  entidade: '<rect x="3" y="7" width="18" height="11" fill="#fff" stroke="#222" stroke-width="1.4"/>',
  relacionamento: '<path d="M12 5 L21 12 L12 19 L3 12 Z" fill="#fff" stroke="#222" stroke-width="1.4"/>',
  associativa: '<rect x="2" y="5" width="20" height="14" fill="#fff" stroke="#222" stroke-width="1.3"/><path d="M12 7 L19 12 L12 17 L5 12 Z" fill="#fff" stroke="#222" stroke-width="1.2"/>',
  atributo: '<path d="M3 19 L10 12" stroke="#222" stroke-width="1.3"/><circle cx="12.5" cy="9.5" r="3.4" fill="#fff" stroke="#222" stroke-width="1.4"/>',
  identificador: '<path d="M3 19 L10 12" stroke="#222" stroke-width="1.3"/><circle cx="12.5" cy="9.5" r="3.4" fill="#111" stroke="#111" stroke-width="1.4"/>',
  composto: '<path d="M2 20 L7 15" stroke="#222" stroke-width="1.2"/><ellipse cx="10" cy="13" rx="5" ry="2.8" fill="#fff" stroke="#222" stroke-width="1.3"/><path d="M14 11.5 L18 6 M15 13 L20 14" stroke="#222" stroke-width="1"/><circle cx="18.5" cy="5.5" r="2" fill="#fff" stroke="#222"/><circle cx="20.5" cy="14.2" r="2" fill="#fff" stroke="#222"/>',
  multivalorado: '<path d="M2 20 L7 15" stroke="#222" stroke-width="1.3"/><circle cx="9" cy="13" r="3.2" fill="#fff" stroke="#222" stroke-width="1.4"/><text x="13" y="11" font-size="7.5" font-family="Arial" fill="#222">1,n</text>',
  especializacao: '<path d="M12 4 L20 18 L4 18 Z" fill="#fff" stroke="#222" stroke-width="1.4"/>',
  autorel: '<rect x="2" y="9" width="9" height="7" fill="#fff" stroke="#222" stroke-width="1.3"/><path d="M17 6 L22 12 L17 18 L12 12 Z" fill="#fff" stroke="#222" stroke-width="1.2"/><path d="M8 9 Q10 4 15 7.5 M8 16 Q10 21 15 16.5" stroke="#222" fill="none" stroke-width="1.1"/>',
  ligar: '<circle cx="5" cy="18" r="2.4" fill="#fff" stroke="#222" stroke-width="1.3"/><circle cx="19" cy="6" r="2.4" fill="#fff" stroke="#222" stroke-width="1.3"/><path d="M7 16 L17 8" stroke="#222" stroke-width="1.4"/>',
  texto: '<rect x="3" y="4" width="18" height="16" fill="#fffbe0" stroke="#b9a440"/><path d="M8 8 H16 M12 8 V17" stroke="#222" stroke-width="1.8"/>',
  tabela: '<rect x="3" y="4" width="18" height="16" fill="#fff" stroke="#222" stroke-width="1.3"/><rect x="3" y="4" width="18" height="4.5" fill="#dfe7f2" stroke="#222" stroke-width="1.3"/><path d="M5.5 12 H18 M5.5 15.5 H18" stroke="#888" stroke-width="1"/>',
  campo: '<rect x="3" y="7" width="18" height="10" fill="#fff" stroke="#222" stroke-width="1.2"/><circle cx="7" cy="12" r="1.8" fill="#e8b923" stroke="#5a4a00" stroke-width=".6"/><path d="M10.5 12 H18" stroke="#444" stroke-width="1.3"/><path d="M19 2 V7 M16.5 4.5 H21.5" stroke="#12805c" stroke-width="1.6"/>',
  relacao: '<rect x="2" y="3" width="8" height="7" fill="#fff" stroke="#222" stroke-width="1.2"/><rect x="14" y="14" width="8" height="7" fill="#fff" stroke="#222" stroke-width="1.2"/><path d="M6 10 V17.5 H14" stroke="#222" stroke-width="1.3" fill="none"/><path d="M11 15 L14 17.5 L11 20" stroke="#222" fill="none"/>',
  novo: '<path d="M6 3 H14 L19 8 V21 H6 Z" fill="#fff" stroke="#333" stroke-width="1.3"/><path d="M14 3 V8 H19" fill="none" stroke="#333" stroke-width="1.2"/>',
  desfazer: '<path d="M9 7 L4 11 L9 15" fill="none" stroke="#333" stroke-width="1.6"/><path d="M4.5 11 H14 A5 5 0 0 1 14 21 H10" fill="none" stroke="#333" stroke-width="1.6"/>',
  refazer: '<path d="M15 7 L20 11 L15 15" fill="none" stroke="#333" stroke-width="1.6"/><path d="M19.5 11 H10 A5 5 0 0 0 10 21 H14" fill="none" stroke="#333" stroke-width="1.6"/>',
  excluir: '<path d="M5 7 H19 M9 7 V4 H15 V7 M7 7 L8 21 H16 L17 7" fill="none" stroke="#b3261e" stroke-width="1.5"/>',
  menos: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="#333" stroke-width="1.5"/><path d="M15 15 L20 20" stroke="#333" stroke-width="2"/><path d="M7.5 10.5 H13.5" stroke="#333" stroke-width="1.5"/>',
  mais: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="#333" stroke-width="1.5"/><path d="M15 15 L20 20" stroke="#333" stroke-width="2"/><path d="M7.5 10.5 H13.5 M10.5 7.5 V13.5" stroke="#333" stroke-width="1.5"/>',
  grade: '<path d="M4 4 H20 V20 H4 Z M9.3 4 V20 M14.6 4 V20 M4 9.3 H20 M4 14.6 H20" fill="none" stroke="#555" stroke-width="1"/>',
  alinhar: '<path d="M4 3 V21" stroke="#333" stroke-width="1.6"/><rect x="6" y="6" width="12" height="4" fill="#fff" stroke="#333"/><rect x="6" y="14" width="8" height="4" fill="#fff" stroke="#333"/>',
  logico: '<rect x="2" y="4" width="8" height="6" fill="#fff" stroke="#222"/><path d="M6 10 L6 14 L3 12 Z" fill="#222"/><rect x="2" y="15" width="9" height="6" fill="#fff" stroke="#222"/><rect x="2" y="15" width="9" height="2" fill="#dfe7f2" stroke="#222"/><path d="M13 12 H20 M17 9 L20 12 L17 15" stroke="#12805c" stroke-width="1.6" fill="none"/>',
  sql: '<path d="M5 6 C5 3 19 3 19 6 V18 C19 21 5 21 5 18 Z" fill="#fff" stroke="#333" stroke-width="1.3"/><path d="M5 6 C5 9 19 9 19 6" fill="none" stroke="#333" stroke-width="1.3"/><text x="7" y="17" font-size="6.5" font-family="Arial" font-weight="bold" fill="#1f3160">SQL</text>',
  abrir: '<path d="M3 7 H9 L11 9 H20 V19 H3 Z" fill="#ffe9a8" stroke="#8a6d00" stroke-width="1.2"/>',
  salvar: '<path d="M4 4 H17 L20 7 V20 H4 Z" fill="#fff" stroke="#333" stroke-width="1.3"/><rect x="7" y="4" width="9" height="5" fill="#dfe7f2" stroke="#333"/><rect x="7" y="13" width="10" height="7" fill="#fff" stroke="#333"/>',
  png: '<rect x="3" y="5" width="18" height="14" fill="#fff" stroke="#333" stroke-width="1.2"/><path d="M5 17 L10 11 L13 14 L15 12 L19 17 Z" fill="#7fb3e8"/><circle cx="16" cy="8.5" r="1.6" fill="#f5a524"/>',
  svgi: '<path d="M4 19 C8 5 16 19 20 5" fill="none" stroke="#1f3160" stroke-width="1.6"/><circle cx="4" cy="19" r="1.8" fill="#fff" stroke="#333"/><circle cx="20" cy="5" r="1.8" fill="#fff" stroke="#333"/>',
  insp: '<rect x="3" y="4" width="18" height="16" fill="#fff" stroke="#333" stroke-width="1.2"/><path d="M14 4 V20" stroke="#333"/><path d="M15.5 8 H19.5 M15.5 11 H19.5 M15.5 14 H19.5" stroke="#555"/>'
};
const icone = (k) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${IC[k] || ""}</svg>`;

const FERR_CONC = [
  ["sel", "Selecionar e mover (Esc)"], ["entidade", "Entidade"], ["relacionamento", "Relacionamento"], ["associativa", "Entidade associativa"],
  ["atributo", "Atributo (clique numa entidade ou relacionamento)"], ["identificador", "Atributo identificador (chave)"], ["composto", "Atributo composto"],
  ["multivalorado", "Atributo multivalorado (1,n)"], ["especializacao", "Especialização / generalização (clique na entidade genérica)"],
  ["autorel", "Auto-relacionamento (clique numa entidade)"], ["ligar", "Ligar dois objetos (clique num e depois no outro)"], ["texto", "Texto / anotação"]
];
const FERR_LOG = [
  ["sel", "Selecionar e mover (Esc)"], ["tabela", "Tabela"], ["campo", "Novo campo (clique numa tabela)"],
  ["relacao", "Relação: clique na tabela que recebe a FK e depois na tabela referenciada"], ["texto", "Texto / anotação"]
];
const NOMES_TIPO = { entidade: "Entidade", relacionamento: "Relacionamento", associativa: "Entidade associativa", atributo: "Atributo", especializacao: "Especialização", texto: "Texto", tabela: "Tabela" };

// ---------- editor ----------
export function montarBRModelo(container, opts = {}) {
  garantirCss();
  const modo = ["conceitual", "logico", "ambos"].includes(opts.modelo) ? opts.modelo : "conceitual";
  const ro = !!opts.somenteLeitura;
  const comArquivos = opts.ferramentas !== false && !ro;
  const lido = M.lerModelo(opts.valor) || {};
  const st = {
    doc: { conceitual: lido.conceitual || M.novoDiagrama(), logico: lido.logico || M.novoDiagrama() },
    aba: modo === "logico" ? "logico" : "conceitual",
    sel: new Set(), ferr: "sel", origem: null, zoom: 1, grade: true,
    hist: [], fut: [], arrasto: null, clique: null, editInsp: false, inspAberto: true
  };
  if (modo === "ambos" && M.modeloVazio(st.doc.conceitual) && !M.modeloVazio(st.doc.logico)) st.aba = "logico";
  const D = () => st.doc[st.aba];
  const porId = (id) => D().el.find((e) => e.id === id);
  const ligPorId = (id) => D().li.find((l) => l.id === id);

  // ----- estrutura -----
  const raiz = document.createElement("div");
  raiz.className = "brm" + (ro ? " brm-ro" : "");
  raiz.tabIndex = 0;
  const botao = (acao, ic, rot, dica, extra = "") => `<button type="button" class="brm-bt" data-acao="${acao}" title="${esc(dica || rot)}"${extra}>${icone(ic)}<span>${esc(rot)}</span></button>`;
  raiz.innerHTML = `
    <div class="brm-topo" role="toolbar" aria-label="Ferramentas do diagrama">
      ${ro ? "" : botao("novo", "novo", "Novo", "Apagar este diagrama e começar outro") + '<span class="brm-sep"></span>' +
        botao("desfazer", "desfazer", "Desfazer", "Desfazer (Ctrl+Z)") + botao("refazer", "refazer", "Refazer", "Refazer (Ctrl+Y)") +
        botao("excluir", "excluir", "Excluir", "Excluir o que está selecionado (Del)") + '<span class="brm-sep"></span>'}
      ${botao("zoomMenos", "menos", "", "Diminuir zoom (Ctrl + roda do mouse)")}<button type="button" class="brm-bt brm-zoom" data-acao="zoom100" title="Zoom 100%">100%</button>${botao("zoomMais", "mais", "", "Aumentar zoom")}
      ${ro ? "" : '<span class="brm-sep"></span>' + botao("grade", "grade", "Grade", "Encaixar na grade ao mover", ' aria-pressed="true"') + botao("alinhar", "alinhar", "Alinhar", "Alinhar os objetos selecionados")}
      <span class="brm-sep"></span>
      ${modo === "ambos" && !ro && opts.conversao !== false ? botao("gerarLogico", "logico", "Gerar lógico", "Converter o modelo conceitual em modelo lógico (como no brModelo)") : ""}
      ${modo !== "conceitual" && opts.conversao !== false ? botao("sql", "sql", "Script SQL", "Ver o esquema físico (script SQL para o MySQL)") : ""}
      ${comArquivos ? '<span class="brm-sep"></span>' + botao("abrir", "abrir", "Abrir", "Abrir um arquivo .json") + botao("salvar", "salvar", "Salvar", "Baixar o diagrama em .json") + botao("png", "png", "PNG", "Exportar imagem PNG") + botao("svg", "svgi", "SVG", "Exportar imagem SVG") : ""}
      <span class="brm-esp"></span>
      ${ro ? "" : botao("insp", "insp", "Inspetor", "Mostrar/esconder o Inspetor", ' aria-pressed="true"')}
    </div>
    ${modo === "ambos" ? '<div class="brm-abas" role="tablist"><button type="button" role="tab" data-aba="conceitual">Conceitual</button><button type="button" role="tab" data-aba="logico">Lógico</button></div>' : ""}
    <div class="brm-corpo">
      ${ro ? "" : '<div class="brm-ferr" role="toolbar" aria-orientation="vertical" aria-label="Elementos"></div>'}
      <div class="brm-area"><svg class="brm-svg" xmlns="http://www.w3.org/2000/svg"></svg></div>
      ${ro ? "" : '<aside class="brm-insp" aria-label="Inspetor"><div class="brm-insp-tit">Inspetor</div><div class="brm-insp-corpo"></div></aside>'}
    </div>
    <div class="brm-status" aria-live="polite"></div>
    ${comArquivos ? '<input type="file" accept=".json,application/json" hidden class="brm-arq">' : ""}`;
  container.appendChild(raiz);
  const $ = (s) => raiz.querySelector(s);
  const area = $(".brm-area"), svg = $(".brm-svg"), insp = $(".brm-insp-corpo"), ferrBox = $(".brm-ferr"), status = $(".brm-status");

  // ----- histórico e aviso de mudança -----
  const foto = () => JSON.stringify(st.doc);
  function antes() { st.hist.push(foto()); if (st.hist.length > 120) st.hist.shift(); st.fut = []; }
  function avisar() { try { opts.onMudar?.(valor()); } catch (e) { console.error(e); } }
  function restaurar(json) {
    st.doc = JSON.parse(json);
    const d = D();
    st.sel = new Set([...st.sel].filter((id) => d.el.some((e) => e.id === id) || d.li.some((l) => l.id === id)));
    render(); avisar();
  }
  const desfazer = () => { if (!st.hist.length) return dizer("Nada para desfazer."); st.fut.push(foto()); restaurar(st.hist.pop()); };
  const refazer = () => { if (!st.fut.length) return dizer("Nada para refazer."); st.hist.push(foto()); restaurar(st.fut.pop()); };

  function valor() {
    const out = { v: 1 };
    if (modo !== "logico" && !M.modeloVazio(st.doc.conceitual)) out.conceitual = st.doc.conceitual;
    if (modo !== "conceitual" && !M.modeloVazio(st.doc.logico)) out.logico = st.doc.logico;
    return out.conceitual || out.logico ? JSON.stringify(out) : "";
  }

  let tempoStatus = 0;
  function dizer(msg, ms = 4000) {
    status.textContent = msg;
    status.classList.add("brm-status-msg");
    clearTimeout(tempoStatus);
    tempoStatus = setTimeout(() => { status.classList.remove("brm-status-msg"); dica(); }, ms);
  }
  function dica() {
    if (status.classList.contains("brm-status-msg")) return;
    const f = st.ferr;
    const msgs = {
      sel: ro ? "Somente leitura. Ctrl + roda do mouse = zoom." : "Clique para selecionar, arraste para mover. Duplo clique renomeia. Clique numa cardinalidade para trocar.",
      entidade: "Clique no desenho para pôr a entidade.", relacionamento: "Clique no desenho para pôr o relacionamento. Depois ligue as entidades nele.",
      associativa: "Clique no desenho para pôr a entidade associativa.", atributo: "Clique numa entidade, relacionamento ou atributo (vira composto).",
      identificador: "Clique na entidade que vai receber o identificador.", composto: "Clique na entidade: cria o atributo composto com 2 partes.",
      multivalorado: "Clique na entidade que vai receber o atributo multivalorado.", especializacao: "Clique na entidade genérica (a 'mãe').",
      autorel: "Clique na entidade que se relaciona com ela mesma.", texto: "Clique no desenho para pôr a anotação.",
      tabela: "Clique no desenho para pôr a tabela.", campo: "Clique numa tabela para criar um campo.",
      ligar: st.origem ? "Agora clique no segundo objeto (Esc cancela)." : "Clique no primeiro objeto.",
      relacao: st.origem ? "Agora clique na tabela referenciada (a que tem a PK)." : "Clique na tabela que vai receber a chave estrangeira (FK)."
    };
    status.textContent = msgs[f] || "";
  }

  // ----- coordenadas -----
  function ponto(ev) {
    const r = svg.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / st.zoom, y: (ev.clientY - r.top) / st.zoom };
  }
  const enc = (v) => (st.grade ? Math.round(v / GRADE) * GRADE : Math.round(v));

  // ----- desenho -----
  function renderSvg() {
    const d = D();
    const b = limites(d);
    const w = Math.max(area.clientWidth / st.zoom - 1, b.x + b.w + 300), h = Math.max(area.clientHeight / st.zoom - 1, b.y + b.h + 200);
    svg.setAttribute("viewBox", `0 0 ${Math.ceil(w)} ${Math.ceil(h)}`);
    svg.setAttribute("width", Math.ceil(w * st.zoom));
    svg.setAttribute("height", Math.ceil(h * st.zoom));
    let extra = "";
    const a = st.arrasto;
    if (a?.tipo === "selecao") {
      const x = Math.min(a.x0, a.x1), y = Math.min(a.y0, a.y1);
      extra += `<rect x="${x}" y="${y}" width="${Math.abs(a.x1 - a.x0)}" height="${Math.abs(a.y1 - a.y0)}" fill="rgba(26,115,232,.08)" stroke="${AZUL}" stroke-dasharray="4 3" pointer-events="none"/>`;
    }
    if (a?.tipo === "ligar") {
      const e = porId(a.de);
      if (e) { const g = M.geo(e, d); extra += `<line x1="${g.cx}" y1="${g.cy}" x2="${a.x}" y2="${a.y}" stroke="${AZUL}" stroke-width="1.5" stroke-dasharray="5 3" pointer-events="none"/>`; }
    }
    svg.innerHTML = `<defs><pattern id="brmG1" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0 H0 V10" fill="none" stroke="#eef1f6" stroke-width="1"/></pattern>` +
      `<pattern id="brmG5" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#brmG1)"/><path d="M50 0 H0 V50" fill="none" stroke="#e1e6ee" stroke-width="1"/></pattern></defs>` +
      `<rect class="brm-fundo" width="100%" height="100%" fill="${st.grade && !ro ? "url(#brmG5)" : "#fff"}"/>` +
      desenhar(d, st.aba, { sel: st.sel, origem: st.origem, somenteLeitura: ro }) + extra;
    if (!d.el.length) {
      svg.insertAdjacentHTML("beforeend", `<text x="${Math.max(200, area.clientWidth / st.zoom / 2)}" y="120" text-anchor="middle" font-family="${FONTE}" font-size="14" fill="#9aa3b2" pointer-events="none">${ro ? "(diagrama em branco)" : st.aba === "logico" ? "Escolha “Tabela” na barra da esquerda e clique aqui" : "Escolha “Entidade” na barra da esquerda e clique aqui"}</text>`);
    }
  }
  function renderFerr() {
    if (!ferrBox) return;
    const lista = st.aba === "logico" ? FERR_LOG : FERR_CONC;
    ferrBox.innerHTML = lista.map(([k, dica]) => `<button type="button" class="brm-fbt" data-ferr="${k}" title="${esc(dica)}" aria-label="${esc(dica)}" aria-pressed="${st.ferr === k}">${icone(k)}</button>`).join("");
    area.classList.toggle("brm-cursor-mira", st.ferr !== "sel");
  }
  function renderTopo() {
    const z = $(".brm-zoom"); if (z) z.textContent = Math.round(st.zoom * 100) + "%";
    const g = $('[data-acao="grade"]'); if (g) g.setAttribute("aria-pressed", String(st.grade));
    const i = $('[data-acao="insp"]'); if (i) i.setAttribute("aria-pressed", String(st.inspAberto));
    raiz.classList.toggle("brm-sem-insp", !st.inspAberto);
    raiz.querySelectorAll("[data-aba]").forEach((b) => { b.setAttribute("aria-selected", String(b.dataset.aba === st.aba)); });
    const gl = $('[data-acao="gerarLogico"]'); if (gl) gl.hidden = modo === "ambos" ? st.aba !== "conceitual" : false;
    const sq = $('[data-acao="sql"]'); if (sq) sq.hidden = modo === "ambos" && st.aba !== "logico";
    const u = $('[data-acao="desfazer"]'); if (u) u.disabled = !st.hist.length;
    const rf = $('[data-acao="refazer"]'); if (rf) rf.disabled = !st.fut.length;
    const ex = $('[data-acao="excluir"]'); if (ex) ex.disabled = !st.sel.size;
  }
  // nada fica com coordenada negativa (fora do desenho): empurra tudo e rola junto
  function ajustarOrigem() {
    const d = D(), b = limites(d);
    const dx = b.x < 0 ? Math.ceil(-b.x / GRADE) * GRADE : 0, dy = b.y < 0 ? Math.ceil(-b.y / GRADE) * GRADE : 0;
    if (!dx && !dy) return;
    for (const e of d.el) { e.x += dx; e.y += dy; }
    area.scrollLeft += dx * st.zoom; area.scrollTop += dy * st.zoom;
  }
  function render() { ajustarOrigem(); renderSvg(); renderFerr(); renderTopo(); renderInsp(); dica(); }

  // ----- criar elementos -----
  let seqId = 0; // contador da sessão: dois ids pedidos antes do push não repetem
  function novoId(p) {
    const usados = new Set([...st.doc.conceitual.el, ...st.doc.conceitual.li, ...st.doc.logico.el, ...st.doc.logico.li].map((x) => x.id));
    let n = ++seqId;
    while (usados.has(p + n)) n = ++seqId;
    return p + n;
  }
  function nomeNovo(base) {
    let n = 1;
    while (D().el.some((e) => e.nome === base + n)) n++;
    return base + n;
  }
  const donoValido = (e) => e && ["entidade", "relacionamento", "associativa", "atributo"].includes(e.t);
  function ladoDoClique(dono, p) {
    const g = M.geo(dono, D());
    const dx = (p.x - g.cx) / (g.w / 2 || 1), dy = (p.y - g.cy) / (g.h / 2 || 1);
    if (dono.t === "atributo") return p.x < g.cx ? "e" : "d";
    return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "e" : "d") : (dy < 0 ? "c" : "b");
  }
  function novoAtributo(dono, lado, extra = {}) {
    const d = D();
    const pos = M.posicaoNovoAtributo(d, dono, lado);
    const a = { id: novoId("a"), t: "atributo", nome: extra.nome || nomeNovo("atributo"), x: pos.x, y: pos.y, dono: dono.id };
    if (extra.chave) a.chave = true;
    if (extra.card) a.card = extra.card;
    d.el.push(a);
    return a;
  }
  // coloca o elemento da ferramenta atual no ponto p (alvo = objeto clicado, se houver)
  function colocar(p, alvo) {
    const d = D(), f = st.ferr;
    let novo = null;
    const centro = (w, h) => ({ x: enc(p.x - w / 2), y: enc(p.y - h / 2) });
    if (["entidade", "relacionamento", "associativa", "texto", "tabela"].includes(f) && (!alvo || f === "texto" || alvo.t === "texto")) {
      antes();
      const base = { entidade: "Entidade", relacionamento: "Rel", associativa: "Associativa", texto: "", tabela: "Tabela" }[f];
      novo = { id: novoId({ entidade: "e", relacionamento: "r", associativa: "s", texto: "x", tabela: "t" }[f]), t: f, nome: f === "texto" ? "Anotação" : nomeNovo(base), x: 0, y: 0 };
      if (f === "tabela") novo.cols = [{ nome: "id", tipo: "INT", pk: true, fk: "", ref: "", nn: true }];
      const g = M.geo(novo, d);
      Object.assign(novo, centro(g.w, g.h));
      d.el.push(novo);
    } else if (["entidade", "relacionamento", "associativa", "tabela"].includes(f)) {
      return dizer("Clique num lugar vazio do desenho.");
    } else if (["atributo", "identificador", "composto", "multivalorado"].includes(f)) {
      if (!donoValido(alvo)) return dizer("Clique sobre uma entidade, um relacionamento ou um atributo.");
      if (f !== "atributo" && alvo.t === "atributo") return dizer("Esse tipo de atributo vai numa entidade ou relacionamento.");
      antes();
      const lado = ladoDoClique(alvo, p);
      if (f === "atributo") novo = novoAtributo(alvo, lado);
      else if (f === "identificador") novo = novoAtributo(alvo, lado, { chave: true, nome: alvo.t === "entidade" ? "id_" + M.sqlNome(alvo.nome).toLowerCase() : nomeNovo("codigo") });
      else if (f === "multivalorado") novo = novoAtributo(alvo, lado, { card: "(1,n)", nome: nomeNovo("telefone") });
      else {
        novo = novoAtributo(alvo, lado, { nome: nomeNovo("endereco") });
        const l2 = lado === "e" ? "e" : "d";
        novoAtributo(novo, l2, { nome: "rua" }); novoAtributo(novo, l2, { nome: "numero" });
      }
    } else if (f === "especializacao") {
      antes();
      const pai = alvo && (alvo.t === "entidade" || alvo.t === "associativa") ? alvo : null;
      novo = { id: novoId("h"), t: "especializacao", x: 0, y: 0, pai: pai ? pai.id : "", total: false, exclusiva: true };
      if (pai) { const g = M.geo(pai, d); novo.x = enc(g.cx - 23); novo.y = enc(g.y + g.h + 40); }
      else Object.assign(novo, centro(46, 38));
      d.el.push(novo);
      if (!pai) dizer("Ligue o triângulo à entidade genérica e às filhas (ou escolha no Inspetor).");
    } else if (f === "autorel") {
      if (!alvo || alvo.t !== "entidade") return dizer("Clique numa entidade.");
      antes();
      const g = M.geo(alvo, d);
      novo = { id: novoId("r"), t: "relacionamento", nome: nomeNovo("Rel"), x: 0, y: 0 };
      const gr = M.geo(novo, d);
      novo.x = enc(g.x + g.w + 70); novo.y = enc(g.cy - gr.h / 2);
      d.el.push(novo);
      d.li.push({ id: novoId("l"), a: alvo.id, b: novo.id, card: "(0,1)", papel: "papel1" }, { id: novoId("l"), a: alvo.id, b: novo.id, card: "(0,n)", papel: "papel2" });
    } else if (f === "campo") {
      if (!alvo || alvo.t !== "tabela") return dizer("Clique numa tabela.");
      antes();
      let n = alvo.cols.length + 1;
      while (alvo.cols.some((c) => c.nome === "campo" + n)) n++;
      alvo.cols.push({ nome: "campo" + n, tipo: "VARCHAR(100)", pk: false, fk: "", ref: "", nn: false });
      st.sel = new Set([alvo.id]);
      render(); avisar();
      editarNome(alvo.id, alvo.cols.length - 1);
      return;
    }
    if (!novo) return;
    st.sel = new Set([novo.id]);
    st.ferr = "sel";
    render(); avisar();
    if (novo.t !== "especializacao") editarNome(novo.id);
  }

  // ----- ligar dois objetos -----
  function descendente(d, a, b) { // b está dentro de a (atributo filho)?
    let x = d.el.find((e) => e.id === b.dono);
    while (x) { if (x.id === a.id) return true; x = x.t === "atributo" ? d.el.find((e) => e.id === x.dono) : null; }
    return false;
  }
  function conectar(idA, idB) {
    const d = D(), A = porId(idA), B = porId(idB);
    if (!A || !B) return;
    const ok = (msg) => { st.sel = new Set([...st.sel].filter((id) => porId(id) || ligPorId(id))); render(); avisar(); if (msg) dizer(msg); };
    if (st.aba === "logico") {
      if (A.t !== "tabela" || B.t !== "tabela") return dizer("No modelo lógico só dá para relacionar tabelas.");
      antes();
      const pks = B.cols.filter((c) => c.pk);
      for (const c of pks) {
        let nome = c.nome, k = 2;
        if (A === B) nome = c.nome + "_pai";
        while (A.cols.some((x) => x.nome.toLowerCase() === nome.toLowerCase())) nome = c.nome + "_" + k++;
        A.cols.push({ nome, tipo: c.tipo, pk: false, fk: B.id, ref: c.nome, nn: A !== B });
      }
      const l = { id: novoId("l"), a: A.id, b: B.id, ca: "(0,n)", cb: A === B ? "(0,1)" : "(1,1)" };
      d.li.push(l);
      st.sel = new Set([l.id]);
      return ok(pks.length ? `${A.nome} recebeu a chave estrangeira de ${B.nome}.` : `${B.nome} não tem chave primária: marque a PK para a FK aparecer.`);
    }
    const ent = (e) => e.t === "entidade" || e.t === "associativa";
    if (A.t === "texto" || B.t === "texto") return dizer("Anotações não se ligam a nada.");
    if (A.t === "atributo" || B.t === "atributo") {
      const [at, dono] = A.t === "atributo" ? [A, B] : [B, A];
      if (!donoValido(dono) || dono === at || descendente(d, at, dono)) return dizer("Atributo só se liga a entidade, relacionamento ou outro atributo.");
      antes();
      at.dono = dono.id;
      const pos = M.posicaoNovoAtributo(d, dono, at.x < M.geo(dono, d).cx ? "e" : "d");
      at.x = pos.x; at.y = pos.y;
      return ok(dono.t === "atributo" ? `${dono.nome} agora é um atributo composto.` : "");
    }
    if (A.t === "especializacao" || B.t === "especializacao") {
      const [s, e] = A.t === "especializacao" ? [A, B] : [B, A];
      if (!ent(e)) return dizer("A especialização liga entidades.");
      antes();
      if (!s.pai) { s.pai = e.id; return ok(`${e.nome} é a entidade genérica. Agora ligue as filhas.`); }
      if (s.pai === e.id || d.li.some((l) => l.a === s.id && l.b === e.id)) { st.hist.pop(); return dizer("Essa ligação já existe."); }
      d.li.push({ id: novoId("l"), a: s.id, b: e.id });
      return ok();
    }
    if (A.t === "relacionamento" && B.t === "relacionamento") return dizer("Relacionamento não se liga direto a outro relacionamento.");
    let a = A, b = B;
    if (A.t === "relacionamento" || (A.t === "associativa" && B.t === "entidade")) { a = B; b = A; }
    if (a.t === "entidade" && b.t === "entidade") {
      // entidade com entidade: cria o losango no meio (como atalho)
      antes();
      const ga = M.geo(a, d), gb = M.geo(b, d);
      const r = { id: novoId("r"), t: "relacionamento", nome: nomeNovo("Rel"), x: 0, y: 0 };
      const gr = M.geo(r, d);
      if (a === b) { r.x = enc(ga.x + ga.w + 70); r.y = enc(ga.cy - gr.h / 2); }
      else { r.x = enc((ga.cx + gb.cx) / 2 - gr.w / 2); r.y = enc((ga.cy + gb.cy) / 2 - gr.h / 2); }
      d.el.push(r);
      d.li.push({ id: novoId("l"), a: a.id, b: r.id, card: "(0,n)" }, { id: novoId("l"), a: b.id, b: r.id, card: "(0,n)" });
      st.sel = new Set([r.id]);
      ok("Relacionamento criado entre as duas entidades. Dê um nome e acerte as cardinalidades.");
      editarNome(r.id);
      return;
    }
    if (!ent(a) || !["relacionamento", "associativa"].includes(b.t) || a === b) return dizer("Essa ligação não existe no modelo conceitual.");
    const ja = d.li.filter((l) => l.a === a.id && l.b === b.id).length;
    if (ja >= 2) return dizer("Já há duas ligações entre esses objetos.");
    antes();
    const l = { id: novoId("l"), a: a.id, b: b.id, card: "(0,n)" };
    if (ja) { l.papel = "papel2"; const o = d.li.find((x) => x.a === a.id && x.b === b.id); if (!o.papel) o.papel = "papel1"; }
    d.li.push(l);
    st.sel = new Set([l.id]);
    ok(ja ? "Auto-relacionamento: dê nome aos papéis no Inspetor." : "Clique na cardinalidade para trocar.");
  }

  // ----- excluir -----
  // FK que perde a tabela referenciada: some, a não ser que também seja PK (aí vira só PK)
  const soltarFK = (cols, cond) => cols.filter((c) => !cond(c) || c.pk).map((c) => (cond(c) ? { ...c, fk: "", ref: "" } : c));
  function excluir() {
    if (ro || !st.sel.size) return;
    antes();
    const d = D();
    const fora = new Set(st.sel);
    // atributos de quem sai também saem
    let mudou = true;
    while (mudou) { mudou = false; for (const e of d.el) if (e.t === "atributo" && fora.has(e.dono) && !fora.has(e.id)) { fora.add(e.id); mudou = true; } }
    for (const l of d.li) if (fora.has(l.a) || fora.has(l.b)) fora.add(l.id);
    // ligação lógica que sai leva junto a FK (se não sobrar outra ligação igual)
    if (st.aba === "logico") {
      for (const l of d.li.filter((l) => fora.has(l.id))) {
        const A = d.el.find((e) => e.id === l.a);
        if (!A || fora.has(A.id)) continue;
        if (d.li.some((o) => !fora.has(o.id) && o.a === l.a && o.b === l.b)) continue;
        A.cols = soltarFK(A.cols, (c) => c.fk === l.b);
      }
      for (const t of d.el) if (t.t === "tabela" && !fora.has(t.id)) t.cols = soltarFK(t.cols, (c) => fora.has(c.fk));
    }
    d.el = d.el.filter((e) => !fora.has(e.id));
    d.li = d.li.filter((l) => !fora.has(l.id));
    for (const e of d.el) if (e.t === "especializacao" && fora.has(e.pai)) e.pai = "";
    st.sel.clear();
    render(); avisar();
  }

  // ----- edição no próprio desenho -----
  let editor = null;
  function fecharEditor(salvar = true) {
    if (!editor) return;
    const ed = editor; editor = null;
    if (salvar) ed.salvar(ed.el.value);
    ed.el.remove();
    raiz.focus({ preventScroll: true });
  }
  function editarNome(id, col = null) {
    if (ro) return;
    fecharEditor();
    const d = D(), e = porId(id);
    if (!e || e.t === "especializacao") return;
    const g = M.geo(e, d);
    let x, y, w, h = 22, atual;
    if (col !== null && e.t === "tabela") { const c = e.cols[col]; if (!c) return; atual = c.nome; x = g.x + 20; y = g.y + 25; y += col * 19; w = g.w - 70; h = 20; }
    else if (e.t === "tabela") { atual = e.nome; x = g.x + 3; y = g.y + 2; w = g.w - 6; h = 21; }
    else if (e.t === "atributo" && g.composto) { atual = e.nome; w = Math.max(110, e.nome.length * 7.5 + 30); x = g.cx - w / 2; y = nomeEmBaixo(e, new Map(d.el.map((q) => [q.id, q])), d) ? g.y + g.h : g.y - 22; }
    else if (e.t === "atributo") { atual = e.nome; const lado = ladoAtributo(e, new Map(d.el.map((q) => [q.id, q])), d); w = Math.max(110, e.nome.length * 7.5 + 30); x = lado > 0 ? g.x + g.w + 2 : g.x - 2 - w; y = g.cy - 11; }
    else if (e.t === "texto") { atual = e.nome; x = g.x; y = g.y; w = Math.max(160, g.w); h = Math.max(48, g.h + 20); }
    else { atual = e.nome; w = Math.max(110, g.w - 16); x = g.cx - w / 2; y = g.cy - 11; }
    const el = document.createElement(e.t === "texto" ? "textarea" : "input");
    el.className = "brm-inline";
    el.value = atual;
    el.spellcheck = false;
    el.setAttribute("aria-label", col !== null ? "Nome do campo" : "Nome");
    Object.assign(el.style, { left: x * st.zoom + "px", top: y * st.zoom + "px", width: w * st.zoom + "px", height: h * st.zoom + "px", fontSize: 12 * st.zoom + "px" });
    area.appendChild(el);
    editor = {
      el,
      salvar: (v) => {
        v = e.t === "texto" ? v.slice(0, 600) : v.replace(/\s+/g, " ").trim().slice(0, 80);
        if (!v || v === atual) return;
        const alvo = porId(id);
        if (!alvo) return;
        antes();
        if (col !== null) { const c = alvo.cols[col]; if (c) { renomearRefs(alvo, c.nome, v); c.nome = v; } }
        else {
          // tabela nova: a PK "id" ganha o nome da tabela (id_cliente)
          if (alvo.t === "tabela" && alvo.cols.length === 1 && alvo.cols[0].nome === "id" && alvo.cols[0].pk) { renomearRefs(alvo, "id", "id_" + M.sqlNome(v).toLowerCase()); alvo.cols[0].nome = "id_" + M.sqlNome(v).toLowerCase(); }
          alvo.nome = v;
        }
        render(); avisar();
      }
    };
    el.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Escape") { ev.preventDefault(); fecharEditor(false); }
      else if (ev.key === "Enter" && !(e.t === "texto" && ev.shiftKey)) {
        ev.preventDefault();
        if (e.t === "texto" && !ev.ctrlKey && ev.shiftKey) return;
        fecharEditor(true);
        // Enter num campo da tabela: já abre o próximo campo (Tab também)
      } else if (ev.key === "Tab" && col !== null) {
        ev.preventDefault(); fecharEditor(true);
        const t = porId(id); if (t && t.cols[col + 1]) editarNome(id, col + 1);
      }
    });
    el.addEventListener("blur", () => { if (editor?.el === el) fecharEditor(true); });
    el.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    setTimeout(() => { el.focus(); el.select(); }, 0);
  }
  // coluna PK renomeada: as FKs que apontam para ela acompanham o ref
  function renomearRefs(tab, antigo, novo) {
    for (const t of D().el) if (t.t === "tabela") for (const c of t.cols) if (c.fk === tab.id && c.ref === antigo) c.ref = novo;
  }

  // ----- menuzinho flutuante (cardinalidade, alinhar) -----
  let menu = null;
  function fecharMenu() { menu?.remove(); menu = null; }
  function abrirMenu(x, y, itens, noTopo = false) {
    fecharMenu();
    menu = document.createElement("div");
    menu.className = "brm-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = itens.map((it, i) => it === "-" ? '<hr>' : `<button type="button" role="menuitem" data-i="${i}"${it.atual ? ' class="brm-atual"' : ""}>${esc(it.rotulo)}</button>`).join("");
    (noTopo ? raiz : area).appendChild(menu);
    Object.assign(menu.style, { left: x + "px", top: y + "px" });
    menu.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    menu.addEventListener("click", (ev) => { const b = ev.target.closest("[data-i]"); if (!b) return; const it = itens[Number(b.dataset.i)]; fecharMenu(); it.acao(); });
    menu.querySelector("button")?.focus();
    menu.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Escape") { fecharMenu(); raiz.focus(); } });
  }
  function menuCard(liId, lado, p) {
    const l = ligPorId(liId);
    if (!l || ro) return;
    const campo = lado === "card" ? "card" : lado === "a" ? "ca" : "cb";
    abrirMenu(p.x * st.zoom, p.y * st.zoom + 10, [...M.CARDS.map((c) => ({ rotulo: c, atual: l[campo] === c, acao: () => { antes(); l[campo] = c; render(); avisar(); } }))]);
  }
  function alinhar(como) {
    const d = D(), els = [...st.sel].map(porId).filter(Boolean);
    if (como === "grade") { antes(); for (const e of d.el) { e.x = Math.round(e.x / GRADE) * GRADE; e.y = Math.round(e.y / GRADE) * GRADE; } render(); avisar(); return; }
    if (els.length < 2) return dizer("Selecione dois ou mais objetos (Shift + clique ou arrastando uma caixa).");
    antes();
    const G = els.map((e) => [e, M.geo(e, d)]);
    const ref = G[0][1];
    for (const [e, g] of G) {
      if (como === "esq") e.x += Math.round(ref.x - g.x);
      if (como === "topo") e.y += Math.round(ref.y - g.y);
      if (como === "ch") e.x += Math.round(ref.cx - g.cx);
      if (como === "cv") e.y += Math.round(ref.cy - g.cy);
    }
    render(); avisar();
  }

  // ----- janela própria (no lugar de alert/confirm) -----
  function janela({ titulo, html, botoes }) {
    const fundo = document.createElement("div");
    fundo.className = "brm-modal";
    fundo.innerHTML = `<div class="brm-modal-caixa" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="brm-modal-tit">${esc(titulo)}</div><div class="brm-modal-corpo">${html}</div><div class="brm-modal-bts">${botoes.map((b, i) => `<button type="button" class="brm-mbt${b.forte ? " brm-forte" : ""}" data-i="${i}">${esc(b.rotulo)}</button>`).join("")}</div></div>`;
    raiz.appendChild(fundo);
    const fechar = () => { fundo.remove(); raiz.focus({ preventScroll: true }); };
    fundo.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-i]");
      if (b) { const bt = botoes[Number(b.dataset.i)]; if (bt.acao?.(fundo) !== false) fechar(); }
      else if (ev.target === fundo) fechar();
    });
    fundo.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Escape") fechar(); });
    fundo.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    (fundo.querySelector(".brm-forte") || fundo.querySelector("button"))?.focus();
    return fundo;
  }

  // ----- ações da barra de cima -----
  function gerarLogico() {
    if (M.modeloVazio(st.doc.conceitual)) return dizer("O modelo conceitual está vazio.");
    const fazer = () => {
      antes();
      st.doc.logico = M.gerarLogico(st.doc.conceitual);
      if (modo === "ambos") { st.aba = "logico"; st.sel.clear(); st.ferr = "sel"; st.origem = null; }
      render(); avisar();
      if (modo === "ambos") dizer("Modelo lógico gerado. Confira os tipos das colunas no Inspetor.", 6000);
      else janelaSql(M.gerarSQL(st.doc.logico), "Modelo lógico gerado (prévia em SQL)");
    };
    if (modo === "ambos" && !M.modeloVazio(st.doc.logico)) {
      janela({ titulo: "Gerar modelo lógico", html: "<p>A aba <b>Lógico</b> já tem um diagrama. Ele será trocado pelo gerado a partir do conceitual (dá para desfazer com Ctrl+Z).</p>", botoes: [{ rotulo: "Cancelar" }, { rotulo: "Substituir", forte: true, acao: fazer }] });
    } else fazer();
  }
  function janelaSql(sql, titulo = "Esquema físico — script SQL (MySQL)") {
    janela({
      titulo,
      html: `<p class="brm-pequeno">Gerado a partir do modelo lógico. Os tipos (INT, VARCHAR...) saem do Inspetor de cada tabela.</p><pre class="brm-sql">${esc(sql)}</pre>`,
      botoes: [{ rotulo: "Copiar", acao: (f) => { navigator.clipboard?.writeText(sql).then(() => { f.querySelector(".brm-pequeno").textContent = "Copiado!"; }).catch(() => {}); return false; } }, { rotulo: "Fechar", forte: true }]
    });
  }
  function baixar(nome, conteudo, tipo) {
    const url = URL.createObjectURL(conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo }));
    const a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const svgAtual = () => svgBRModelo({ v: 1, [st.aba]: D() });
  function exportarPng() {
    if (M.modeloVazio(D())) return dizer("O diagrama está vazio.");
    const s = svgAtual(), img = new Image();
    const w = Number(s.match(/width="(\d+)"/)[1]), h = Number(s.match(/height="(\d+)"/)[1]);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w * 2; c.height = h * 2;
      const ctx = c.getContext("2d"); ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
      c.toBlob((b) => b && baixar(`diagrama-${st.aba}.png`, b, "image/png"), "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  }
  function abrirArquivo(arq) {
    const fr = new FileReader();
    fr.onload = () => {
      const m = M.lerModelo(String(fr.result || ""));
      if (!m) return janela({ titulo: "Abrir", html: "<p>Esse arquivo não é um diagrama válido (.json salvo por este brModelo).</p>", botoes: [{ rotulo: "OK", forte: true }] });
      antes();
      st.doc = { conceitual: m.conceitual || M.novoDiagrama(), logico: m.logico || M.novoDiagrama() };
      if (modo === "ambos") st.aba = m.conceitual ? "conceitual" : "logico";
      st.sel.clear(); render(); avisar();
      dizer("Diagrama aberto: " + arq.name);
    };
    fr.readAsText(arq);
  }
  function mudarZoom(z, cx, cy) {
    const antigo = st.zoom;
    st.zoom = Math.min(3, Math.max(0.3, Math.round(z * 100) / 100));
    if (st.zoom === antigo) return;
    const r = area.getBoundingClientRect();
    const px = cx ?? r.width / 2, py = cy ?? r.height / 2;
    const mx = (area.scrollLeft + px) / antigo, my = (area.scrollTop + py) / antigo;
    fecharEditor(); fecharMenu();
    renderSvg(); renderTopo();
    area.scrollLeft = mx * st.zoom - px; area.scrollTop = my * st.zoom - py;
  }

  const acoes = {
    novo: () => janela({
      titulo: "Novo diagrama", html: `<p>Apagar ${modo === "ambos" ? `a aba <b>${st.aba === "logico" ? "Lógico" : "Conceitual"}</b>` : "o diagrama"} e começar do zero? (Ctrl+Z desfaz.)</p>`,
      botoes: [{ rotulo: "Cancelar" }, { rotulo: "Apagar", forte: true, acao: () => { antes(); st.doc[st.aba] = M.novoDiagrama(); st.sel.clear(); render(); avisar(); } }]
    }),
    desfazer, refazer, excluir,
    zoomMenos: () => mudarZoom(st.zoom - 0.1), zoomMais: () => mudarZoom(st.zoom + 0.1), zoom100: () => mudarZoom(1),
    grade: () => { st.grade = !st.grade; renderSvg(); renderTopo(); },
    alinhar: (bt) => {
      const r = bt.getBoundingClientRect(), rr = raiz.getBoundingClientRect();
      abrirMenu(r.left - rr.left, r.bottom - rr.top + 2, [
        { rotulo: "Alinhar à esquerda", acao: () => alinhar("esq") }, { rotulo: "Alinhar pelo topo", acao: () => alinhar("topo") },
        { rotulo: "Centralizar na vertical (mesma coluna)", acao: () => alinhar("ch") }, { rotulo: "Centralizar na horizontal (mesma linha)", acao: () => alinhar("cv") },
        "-", { rotulo: "Encaixar tudo na grade", acao: () => alinhar("grade") }
      ], true);
    },
    gerarLogico,
    sql: () => janelaSql(M.gerarSQL(st.doc.logico)),
    abrir: () => $(".brm-arq")?.click(),
    salvar: () => { const v = valor(); if (!v) return dizer("O diagrama está vazio."); baixar("diagrama-brmodelo.json", JSON.stringify(JSON.parse(v), null, 1), "application/json"); },
    png: exportarPng,
    svg: () => { if (M.modeloVazio(D())) return dizer("O diagrama está vazio."); baixar(`diagrama-${st.aba}.svg`, svgAtual(), "image/svg+xml"); },
    insp: () => { st.inspAberto = !st.inspAberto; renderTopo(); renderSvg(); }
  };
  raiz.querySelector(".brm-topo").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-acao]");
    if (!b || b.disabled) return;
    fecharEditor(); if (b.dataset.acao !== "alinhar") fecharMenu();
    acoes[b.dataset.acao]?.(b);
  });
  $(".brm-arq")?.addEventListener("change", (ev) => { const f = ev.target.files?.[0]; if (f) abrirArquivo(f); ev.target.value = ""; });
  raiz.querySelector(".brm-abas")?.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-aba]");
    if (!b || b.dataset.aba === st.aba) return;
    fecharEditor(); fecharMenu();
    st.aba = b.dataset.aba; st.sel.clear(); st.ferr = "sel"; st.origem = null;
    render();
  });
  ferrBox?.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-ferr]");
    if (!b) return;
    fecharEditor(); fecharMenu();
    st.ferr = b.dataset.ferr; st.origem = null;
    // com algo selecionado, as ferramentas de atributo já aplicam nele (como no brModelo)
    const s = st.sel.size === 1 ? porId([...st.sel][0]) : null;
    if (s && ["atributo", "identificador", "composto", "multivalorado", "especializacao", "autorel", "campo"].includes(st.ferr) && (["entidade", "relacionamento", "associativa", "tabela"].includes(s.t))) {
      const g = M.geo(s, D());
      colocar({ x: g.x + g.w + 1, y: g.cy }, s);
      if (st.ferr !== "sel") { st.ferr = "sel"; render(); }
      return;
    }
    renderFerr(); renderSvg(); dica();
  });

  // ----- mouse / toque no desenho -----
  function capturar(ev) { try { svg.setPointerCapture(ev.pointerId); } catch { /* ponteiro já solto */ } }
  function alvoDe(ev) {
    const t = ev.target.closest?.("[data-handle],[data-card],[data-col],[data-id],[data-li]");
    if (!t || !svg.contains(t)) return {};
    if (t.dataset.handle) return { handle: t.dataset.handle };
    if (t.dataset.card) return { card: t.dataset.card, lado: t.dataset.lado };
    const g = t.closest("[data-id]");
    if (t.dataset.col !== undefined && g) return { id: g.dataset.id, col: Number(t.dataset.col) };
    if (t.dataset.id) return { id: t.dataset.id };
    if (t.dataset.li) return { li: t.dataset.li };
    return {};
  }
  function idsMovidos() {
    const d = D(), ids = new Set([...st.sel].filter((id) => porId(id)));
    let mudou = true;
    while (mudou) { mudou = false; for (const e of d.el) if (e.t === "atributo" && ids.has(e.dono) && !ids.has(e.id)) { ids.add(e.id); mudou = true; } }
    return [...ids];
  }
  svg.addEventListener("pointerdown", (ev) => {
    if (ev.button === 2) return;
    fecharEditor(); fecharMenu();
    raiz.focus({ preventScroll: true });
    const p = ponto(ev), alvo = alvoDe(ev);
    const pan = () => { st.arrasto = { tipo: "pan", cx: ev.clientX, cy: ev.clientY, sl: area.scrollLeft, stp: area.scrollTop }; capturar(ev); };
    if (ev.button === 1 || (ro && !alvo.card)) { ev.preventDefault(); return pan(); }
    // ferramentas de colocar
    if (!["sel", "ligar", "relacao"].includes(st.ferr)) { ev.preventDefault(); return colocar(p, alvo.id ? porId(alvo.id) : null); }
    if (st.ferr === "ligar" || st.ferr === "relacao") {
      ev.preventDefault();
      if (!alvo.id) { st.origem = null; st.ferr = "sel"; render(); return; }
      if (!st.origem) { st.origem = alvo.id; renderSvg(); dica(); return; }
      const de = st.origem; st.origem = null; st.ferr = "sel";
      conectar(de, alvo.id);
      renderFerr(); renderSvg(); dica();
      return;
    }
    if (alvo.handle) { ev.preventDefault(); st.arrasto = { tipo: "ligar", de: alvo.handle, x: p.x, y: p.y }; capturar(ev); return; }
    if (alvo.card) { ev.preventDefault(); st.sel = new Set([alvo.card]); render(); menuCard(alvo.card, alvo.lado, p); return; }
    if (alvo.id) {
      ev.preventDefault();
      const agora = performance.now(), c = st.clique;
      if (c && c.id === alvo.id && c.col === alvo.col && agora - c.t < 450 && Math.hypot(c.x - ev.clientX, c.y - ev.clientY) < 8) {
        st.clique = null;
        return editarNome(alvo.id, alvo.col ?? null);
      }
      st.clique = { id: alvo.id, col: alvo.col, t: agora, x: ev.clientX, y: ev.clientY };
      if (ev.shiftKey || ev.ctrlKey || ev.metaKey) { if (st.sel.has(alvo.id)) st.sel.delete(alvo.id); else st.sel.add(alvo.id); }
      else if (!st.sel.has(alvo.id)) st.sel = new Set([alvo.id]);
      const ids = idsMovidos();
      st.arrasto = { tipo: "mover", x0: p.x, y0: p.y, cx: ev.clientX, cy: ev.clientY, prim: alvo.id, ids, orig: new Map(ids.map((id) => { const e = porId(id); return [id, { x: e.x, y: e.y }]; })), moveu: false };
      capturar(ev);
      render();
      return;
    }
    if (alvo.li) { ev.preventDefault(); if (ev.shiftKey) st.sel.add(alvo.li); else st.sel = new Set([alvo.li]); render(); return; }
    // fundo: toque arrasta a tela; mouse faz a caixa de seleção
    if (ev.pointerType === "touch") { st.sel.clear(); render(); return pan(); }
    ev.preventDefault();
    if (!ev.shiftKey) st.sel.clear();
    st.arrasto = { tipo: "selecao", x0: p.x, y0: p.y, x1: p.x, y1: p.y, base: new Set(st.sel) };
    capturar(ev);
    render();
  });
  svg.addEventListener("pointermove", (ev) => {
    const a = st.arrasto;
    if (!a) return;
    const p = ponto(ev);
    if (a.tipo === "pan") { area.scrollLeft = a.sl - (ev.clientX - a.cx); area.scrollTop = a.stp - (ev.clientY - a.cy); return; }
    if (a.tipo === "mover") {
      if (!a.moveu && Math.hypot(ev.clientX - a.cx, ev.clientY - a.cy) < 3) return;
      if (!a.moveu) { antes(); a.moveu = true; st.clique = null; }
      const o = a.orig.get(a.prim) || { x: 0, y: 0 };
      let dx = p.x - a.x0, dy = p.y - a.y0;
      if (st.grade) { dx = enc(o.x + dx) - o.x; dy = enc(o.y + dy) - o.y; }
      for (const id of a.ids) { const e = porId(id), q = a.orig.get(id); if (e && q) { const m = e.t === "atributo" ? 8 : 0; e.x = Math.max(m, Math.round(q.x + dx)); e.y = Math.max(m, Math.round(q.y + dy)); } }
      renderSvg();
      autoRolar(ev);
      return;
    }
    if (a.tipo === "selecao") {
      a.x1 = p.x; a.y1 = p.y;
      const d = D(), ids = new Map(d.el.map((e) => [e.id, e]));
      const x0 = Math.min(a.x0, a.x1), x1 = Math.max(a.x0, a.x1), y0 = Math.min(a.y0, a.y1), y1 = Math.max(a.y0, a.y1);
      st.sel = new Set(a.base);
      for (const e of d.el) { const b = caixa(e, d, ids); if (b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0) st.sel.add(e.id); }
      renderSvg(); autoRolar(ev);
      return;
    }
    if (a.tipo === "ligar") { a.x = p.x; a.y = p.y; renderSvg(); autoRolar(ev); }
  });
  function fimArrasto(ev) {
    const a = st.arrasto;
    if (!a) return;
    st.arrasto = null;
    try { svg.releasePointerCapture(ev.pointerId); } catch { /* já solto */ }
    if (a.tipo === "mover") { render(); if (a.moveu) avisar(); return; }
    if (a.tipo === "ligar") {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const g = el?.closest?.("[data-id]");
      if (g && svg.contains(g) && g.dataset.id !== a.de) conectar(a.de, g.dataset.id);
      else if (g && g.dataset.id === a.de && porId(a.de)?.t === "entidade") conectar(a.de, a.de);
      else render();
      return;
    }
    if (a.tipo === "selecao") render();
  }
  svg.addEventListener("pointerup", fimArrasto);
  svg.addEventListener("pointercancel", fimArrasto);
  svg.addEventListener("contextmenu", (ev) => ev.preventDefault());
  // rola sozinho quando arrasta perto da borda
  function autoRolar(ev) {
    const r = area.getBoundingClientRect(), m = 24, v = 12;
    if (ev.clientX > r.right - m) area.scrollLeft += v; else if (ev.clientX < r.left + m) area.scrollLeft -= v;
    if (ev.clientY > r.bottom - m) area.scrollTop += v; else if (ev.clientY < r.top + m) area.scrollTop -= v;
  }
  area.addEventListener("wheel", (ev) => {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    const r = area.getBoundingClientRect();
    mudarZoom(st.zoom * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });

  // ----- teclado -----
  raiz.addEventListener("keydown", (ev) => {
    if (ev.target.matches?.("input, textarea, select")) return;
    const ctrl = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
    if (ctrl && (k === "+" || k === "=")) { ev.preventDefault(); return mudarZoom(st.zoom + 0.1); }
    if (ctrl && k === "-") { ev.preventDefault(); return mudarZoom(st.zoom - 0.1); }
    if (ctrl && k === "0") { ev.preventDefault(); return mudarZoom(1); }
    if (ro) return;
    if (ctrl && k === "z" && !ev.shiftKey) { ev.preventDefault(); return desfazer(); }
    if (ctrl && (k === "y" || (k === "z" && ev.shiftKey))) { ev.preventDefault(); return refazer(); }
    if (ctrl && k === "a") { ev.preventDefault(); st.sel = new Set(D().el.map((e) => e.id)); return render(); }
    if (ev.key === "Delete" || ev.key === "Backspace") { if (st.sel.size) { ev.preventDefault(); excluir(); } return; }
    if (ev.key === "Escape") { st.ferr = "sel"; st.origem = null; st.sel.clear(); fecharMenu(); return render(); }
    if (ev.key === "F2" && st.sel.size === 1) { ev.preventDefault(); return editarNome([...st.sel][0]); }
    const passos = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (passos[ev.key] && st.sel.size) {
      ev.preventDefault();
      const [dx, dy] = passos[ev.key].map((v) => v * (ev.shiftKey ? 10 : 1));
      st.hist.push(foto()); st.fut = [];
      for (const id of idsMovidos()) { const e = porId(id); e.x += dx; e.y += dy; }
      renderSvg(); avisar();
    }
  });

  // ----- Inspetor -----
  const opcoesCard = (atual, vazio = "") => `${vazio ? `<option value=""${!atual ? " selected" : ""}>${esc(vazio)}</option>` : ""}${M.CARDS.map((c) => `<option${c === atual ? " selected" : ""}>${c}</option>`).join("")}`;
  const prop = (rot, html) => `<label class="brm-prop"><span>${esc(rot)}</span>${html}</label>`;
  const nomeDe = (id) => esc(porId(id)?.nome || "?");
  function renderInsp() {
    if (!insp) return;
    if (insp.contains(document.activeElement) && st.editInsp) return; // não atrapalha quem está digitando
    const d = D();
    let h = "";
    const itens = [...st.sel];
    if (!itens.length) {
      const n = (t) => d.el.filter((e) => e.t === t).length;
      h = st.aba === "logico"
        ? `<div class="brm-insp-tipo">Modelo lógico</div><p class="brm-pequeno">${n("tabela")} tabela(s), ${d.li.length} relação(ões).</p>
           <p class="brm-pequeno">Selecione uma tabela para editar os campos: tipo, <b>PK</b> (chave primária), <b>FK</b> (estrangeira) e NOT NULL. A ferramenta <b>Relação</b> cria a FK sozinha.</p>
           ${!M.modeloVazio(d) ? '<button type="button" class="brm-ibt" data-acao-i="sql">Ver script SQL</button>' : ""}`
        : `<div class="brm-insp-tipo">Modelo conceitual</div><p class="brm-pequeno">${n("entidade")} entidade(s), ${n("relacionamento")} relacionamento(s), ${n("atributo")} atributo(s).</p>
           <ul class="brm-ajuda"><li>Escolha um elemento na barra da esquerda e clique no desenho.</li><li>Atributos: clique na entidade com a ferramenta de atributo.</li><li>Ligar: arraste a bolinha azul do objeto selecionado até outro.</li><li>Clique na cardinalidade, ex. <b>(0,n)</b>, para trocar.</li><li>Duplo clique renomeia. Del exclui. Ctrl+Z desfaz.</li></ul>
           ${modo !== "conceitual" && !M.modeloVazio(d) ? '<button type="button" class="brm-ibt" data-acao-i="gerarLogico">Gerar modelo lógico</button>' : ""}`;
    } else if (itens.length > 1) {
      h = `<div class="brm-insp-tipo">${itens.length} objetos selecionados</div>
        <div class="brm-ibts"><button type="button" class="brm-ibt" data-acao-i="al:esq">Alinhar à esquerda</button><button type="button" class="brm-ibt" data-acao-i="al:topo">Alinhar pelo topo</button>
        <button type="button" class="brm-ibt" data-acao-i="al:ch">Mesma coluna</button><button type="button" class="brm-ibt" data-acao-i="al:cv">Mesma linha</button>
        <button type="button" class="brm-ibt brm-perigo" data-acao-i="excluir">Excluir</button></div>`;
    } else {
      const id = itens[0], e = porId(id), l = ligPorId(id);
      if (l) {
        const A = porId(l.a), B = porId(l.b);
        if (st.aba === "logico") {
          h = `<div class="brm-insp-tipo">Relação</div><p class="brm-pequeno"><b>${esc(A?.nome)}</b> tem a FK que aponta para <b>${esc(B?.nome)}</b>.</p>
            ${prop("Junto de " + (A?.nome || ""), `<select data-k="ca">${opcoesCard(l.ca, "—")}</select>`)}${prop("Junto de " + (B?.nome || ""), `<select data-k="cb">${opcoesCard(l.cb, "—")}</select>`)}`;
        } else if (A?.t === "especializacao") {
          h = `<div class="brm-insp-tipo">Ligação da especialização</div><p class="brm-pequeno">Filha: <b>${esc(B?.nome)}</b></p>`;
        } else {
          h = `<div class="brm-insp-tipo">Ligação</div><p class="brm-pequeno"><b>${esc(A?.nome)}</b> — ${esc(B?.nome)}</p>
            ${prop("Cardinalidade", `<select data-k="card">${opcoesCard(l.card, "( , ) sem")}</select>`)}
            ${prop("Papel", `<input data-k="papel" value="${esc(l.papel || "")}" placeholder="(auto-relacionamento)">`)}
            <p class="brm-pequeno">A cardinalidade fica junto de <b>${esc(A?.nome)}</b>: quantos ${esc(A?.nome)} se ligam a cada ${esc(d.li.filter((x) => x.b === l.b && x.id !== l.id).map((x) => porId(x.a)?.nome).join("/") || "outro")}.</p>`;
        }
        h += '<div class="brm-ibts"><button type="button" class="brm-ibt brm-perigo" data-acao-i="excluir">Excluir ligação</button></div>';
      } else if (e) {
        h = `<div class="brm-insp-tipo">${NOMES_TIPO[e.t] || e.t}</div>`;
        if (e.t === "texto") h += prop("Texto", `<textarea data-k="nome" rows="4">${esc(e.nome)}</textarea>`);
        else if (e.t !== "especializacao") h += prop("Nome", `<input data-k="nome" value="${esc(e.nome)}">`);
        if (e.t === "entidade" || e.t === "associativa" || e.t === "relacionamento") {
          const liga = e.t === "relacionamento" ? d.li.filter((x) => x.b === e.id) : d.li.filter((x) => x.a === e.id && porId(x.b)?.t !== "especializacao" || (e.t === "associativa" && x.b === e.id));
          if (liga.length) {
            h += `<div class="brm-sub">${e.t === "entidade" ? "Participa de" : "Ligações"}</div>` + liga.map((x) => {
              const outro = x.a === e.id ? porId(x.b) : porId(x.a);
              return `<div class="brm-linha2"><span title="${esc(outro?.nome)}">${esc(outro?.nome)}${x.papel ? ` <i>(${esc(x.papel)})</i>` : ""}</span><select data-k="lcard:${x.id}" aria-label="Cardinalidade">${opcoesCard(x.card, "( , )")}</select></div>`;
            }).join("") + (e.t === "relacionamento" ? '<p class="brm-pequeno">Cardinalidade escrita junto de cada entidade.</p>' : "");
          }
          const ats = d.el.filter((x) => x.t === "atributo" && x.dono === e.id);
          if (ats.length) h += `<div class="brm-sub">Atributos</div><div class="brm-chips">${ats.map((a) => `<button type="button" class="brm-chip${a.chave ? " brm-chave" : ""}" data-acao-i="ir:${a.id}">${esc(a.nome)}${a.card ? " " + a.card : ""}</button>`).join("")}</div>`;
          h += `<div class="brm-ibts"><button type="button" class="brm-ibt" data-acao-i="addAt">+ Atributo</button>${e.t !== "relacionamento" ? '<button type="button" class="brm-ibt" data-acao-i="addId">+ Identificador</button>' : ""}</div>`;
        }
        if (e.t === "atributo") {
          const tipoAt = e.card ? (M.maxN(e.card) ? "multi" : "opc") : "simples";
          h += prop("Identificador", `<input type="checkbox" data-k="chave"${e.chave ? " checked" : ""}>`) +
            prop("Tipo", `<select data-k="tipoAt"><option value="simples"${tipoAt === "simples" ? " selected" : ""}>Simples (1,1)</option><option value="opc"${tipoAt === "opc" ? " selected" : ""}>Opcional (0,1)</option><option value="multi"${tipoAt === "multi" ? " selected" : ""}>Multivalorado</option></select>`);
          if (tipoAt === "multi") h += prop("Cardinalidade", `<select data-k="acard"><option${e.card === "(0,n)" ? " selected" : ""}>(0,n)</option><option${e.card === "(1,n)" ? " selected" : ""}>(1,n)</option></select>`);
          const filhos = d.el.filter((x) => x.t === "atributo" && x.dono === e.id);
          h += `<p class="brm-pequeno">Dono: <b>${nomeDe(e.dono)}</b>${filhos.length ? ` · composto de ${filhos.map((f) => esc(f.nome)).join(", ")}` : ""}</p>`;
          h += '<div class="brm-ibts"><button type="button" class="brm-ibt" data-acao-i="addSub">+ Parte (composto)</button><button type="button" class="brm-ibt" data-acao-i="irDono">Ir para o dono</button></div>';
        }
        if (e.t === "especializacao") {
          const ents = d.el.filter((x) => x.t === "entidade" || x.t === "associativa");
          h += prop("Genérica", `<select data-k="pai"><option value="">—</option>${ents.map((x) => `<option value="${x.id}"${x.id === e.pai ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}</select>`) +
            prop("Cobertura", `<select data-k="total"><option value="0"${!e.total ? " selected" : ""}>Parcial (p)</option><option value="1"${e.total ? " selected" : ""}>Total (t)</option></select>`) +
            prop("Disjunção", `<select data-k="exclusiva"><option value="1"${e.exclusiva ? " selected" : ""}>Exclusiva (x)</option><option value="0"${!e.exclusiva ? " selected" : ""}>Compartilhada (c)</option></select>`) +
            `<p class="brm-pequeno">Filhas: ${d.li.filter((x) => x.a === e.id).map((x) => nomeDe(x.b)).join(", ") || "nenhuma"}</p>` +
            '<div class="brm-ibts"><button type="button" class="brm-ibt" data-acao-i="addFilha">+ Entidade filha</button></div>';
        }
        if (e.t === "tabela") {
          const tabs = d.el.filter((x) => x.t === "tabela");
          h += `<div class="brm-sub">Campos</div><datalist id="brmTipos">${M.TIPOS_SQL.map((t) => `<option value="${t}">`).join("")}</datalist>` +
            e.cols.map((c, i) => `<div class="brm-col">
              <div class="brm-col-l1"><input data-k="col:${i}:nome" value="${esc(c.nome)}" aria-label="Nome do campo"><input data-k="col:${i}:tipo" value="${esc(c.tipo)}" list="brmTipos" aria-label="Tipo"></div>
              <div class="brm-col-l2"><label title="Chave primária"><input type="checkbox" data-k="col:${i}:pk"${c.pk ? " checked" : ""}>PK</label><label title="NOT NULL (obrigatório)"><input type="checkbox" data-k="col:${i}:nn"${c.nn || c.pk ? " checked" : ""}${c.pk ? " disabled" : ""}>NN</label><label title="UNIQUE"><input type="checkbox" data-k="col:${i}:un"${c.un ? " checked" : ""}>UQ</label>
              <select data-k="col:${i}:fk" title="Chave estrangeira: tabela referenciada" aria-label="FK para"><option value="">FK —</option>${tabs.map((t) => `<option value="${t.id}"${t.id === c.fk ? " selected" : ""}>FK→${esc(t.nome)}</option>`).join("")}</select>
              <button type="button" class="brm-mini" data-acao-i="sobe:${i}" title="Subir"${i ? "" : " disabled"}>↑</button><button type="button" class="brm-mini brm-perigo" data-acao-i="tira:${i}" title="Excluir campo">✕</button></div></div>`).join("") +
            '<div class="brm-ibts"><button type="button" class="brm-ibt" data-acao-i="addCol">+ Campo</button></div>';
        }
        h += '<div class="brm-ibts"><button type="button" class="brm-ibt brm-perigo" data-acao-i="excluir">Excluir</button></div>';
      }
    }
    insp.innerHTML = h;
  }
  function selecionado() { return st.sel.size === 1 ? [...st.sel][0] : null; }
  // aplica um campo do Inspetor
  function aplicar(k, alvo) {
    const id = selecionado(), e = porId(id), l = ligPorId(id), v = alvo.type === "checkbox" ? alvo.checked : alvo.value;
    if (l) {
      if (k === "card" || k === "ca" || k === "cb") l[k] = v;
      if (k === "papel") { if (v.trim()) l.papel = v.trim().slice(0, 40); else delete l.papel; }
      return;
    }
    if (!e) return;
    if (k === "nome") { e.nome = e.t === "texto" ? v.slice(0, 600) : v.slice(0, 80); return; }
    if (k.startsWith("lcard:")) { const x = ligPorId(k.slice(6)); if (x) x.card = v; return; }
    if (k === "chave") { if (v) e.chave = true; else delete e.chave; return; }
    if (k === "tipoAt") { if (v === "simples") delete e.card; else e.card = v === "opc" ? "(0,1)" : "(1,n)"; return; }
    if (k === "acard") { e.card = v; return; }
    if (k === "pai") { e.pai = v; D().li = D().li.filter((x) => !(x.a === e.id && x.b === v)); return; }
    if (k === "total") { e.total = v === "1"; return; }
    if (k === "exclusiva") { e.exclusiva = v === "1"; return; }
    const m = k.match(/^col:(\d+):(\w+)$/);
    if (m && e.t === "tabela") {
      const c = e.cols[Number(m[1])];
      if (!c) return;
      const campo = m[2];
      if (campo === "nome") { renomearRefs(e, c.nome, v); c.nome = v.slice(0, 64); }
      else if (campo === "tipo") c.tipo = v.slice(0, 40).toUpperCase();
      else if (campo === "pk") { c.pk = v; if (v) c.nn = true; }
      else if (campo === "nn") c.nn = v;
      else if (campo === "un") { if (v) c.un = true; else delete c.un; }
      else if (campo === "fk") {
        c.fk = v;
        const ref = porId(v);
        const pk = ref?.cols.find((x) => x.pk);
        c.ref = pk ? pk.nome : "";
        if (pk && c.tipo === "VARCHAR(100)") c.tipo = pk.tipo;
        // garante a linha da relação no desenho
        if (v && !D().li.some((x) => x.a === e.id && x.b === v)) D().li.push({ id: novoId("l"), a: e.id, b: v, ca: "(0,n)", cb: "(1,1)" });
        if (!v) c.ref = "";
        limparRelacoes(e);
      }
    }
  }
  // relação lógica sem nenhuma FK correspondente sai
  function limparRelacoes(t) {
    D().li = D().li.filter((x) => x.a !== t.id || t.cols.some((c) => c.fk === x.b));
  }
  if (insp) {
    insp.addEventListener("focusin", () => { st.editInsp = false; });
    insp.addEventListener("input", (ev) => {
      const k = ev.target.dataset?.k;
      if (!k || !ev.target.matches("input:not([type=checkbox]), textarea")) return;
      if (!st.editInsp) { antes(); st.editInsp = true; }
      aplicar(k, ev.target);
      renderSvg();
    });
    insp.addEventListener("change", (ev) => {
      const k = ev.target.dataset?.k;
      if (!k) return;
      if (ev.target.matches("input:not([type=checkbox]), textarea")) { st.editInsp = false; renderTopo(); avisar(); return; }
      antes();
      aplicar(k, ev.target);
      st.editInsp = false;
      render(); avisar();
    });
    insp.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter" && ev.target.matches("input:not([type=checkbox])")) { ev.target.blur(); }
      if (ev.key === "Escape") raiz.focus();
    });
    insp.addEventListener("focusout", () => { if (st.editInsp) { st.editInsp = false; renderTopo(); renderInsp(); } });
    insp.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-acao-i]");
      if (!b) return;
      const [acao, arg] = b.dataset.acaoI.split(":");
      const id = selecionado(), e = porId(id), d = D();
      if (acao === "sql") return janelaSql(M.gerarSQL(st.doc.logico));
      if (acao === "gerarLogico") return gerarLogico();
      if (acao === "excluir") return excluir();
      if (acao === "al") return alinhar(arg);
      if (acao === "ir") { st.sel = new Set([arg]); return render(); }
      if (acao === "irDono" && e) { st.sel = new Set([e.dono]); return render(); }
      if (!e) return;
      antes();
      let editar = null;
      if (acao === "addAt" || acao === "addId") editar = novoAtributo(e, "d", acao === "addId" ? { chave: true, nome: e.t === "entidade" ? "id_" + M.sqlNome(e.nome).toLowerCase() : nomeNovo("codigo") } : {});
      if (acao === "addSub") editar = novoAtributo(e, e.x < (M.geo(porId(e.dono), d)?.cx ?? 0) ? "e" : "d", { nome: nomeNovo("parte") });
      if (acao === "addFilha") {
        const g = M.geo(e, d), n = d.li.filter((x) => x.a === e.id).length;
        const f = { id: novoId("e"), t: "entidade", nome: nomeNovo("Entidade"), x: enc(g.cx - 50 + (n % 2 ? 1 : -1) * (70 + Math.floor(n / 2) * 140)), y: enc(g.y + g.h + 50) };
        d.el.push(f); d.li.push({ id: novoId("l"), a: e.id, b: f.id });
        editar = f;
      }
      if (acao === "addCol") { let n = e.cols.length + 1; while (e.cols.some((c) => c.nome === "campo" + n)) n++; e.cols.push({ nome: "campo" + n, tipo: "VARCHAR(100)", pk: false, fk: "", ref: "", nn: false }); }
      if (acao === "tira") { e.cols.splice(Number(arg), 1); limparRelacoes(e); }
      if (acao === "sobe") { const i = Number(arg); if (i > 0) [e.cols[i - 1], e.cols[i]] = [e.cols[i], e.cols[i - 1]]; }
      render(); avisar();
      if (acao === "addCol") insp.querySelector(`[data-k="col:${e.cols.length - 1}:nome"]`)?.select();
      if (editar) { if (acao !== "addFilha") st.sel = new Set([e.id]); render(); editarNome(editar.id); }
    });
  }

  // tela estreita: o Inspetor vira painel por cima
  const ro2 = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
    const estreito = raiz.clientWidth < 760;
    if (estreito !== raiz.classList.contains("brm-estreito")) { raiz.classList.toggle("brm-estreito", estreito); if (estreito) st.inspAberto = false; renderTopo(); }
    renderSvg();
  }) : null;
  ro2?.observe(raiz);

  render();
  return {
    valor,
    destruir() { ro2?.disconnect(); fecharEditor(false); fecharMenu(); clearTimeout(tempoStatus); raiz.remove(); },
    _teste: { st, conectar, colocar: (f, p, id) => { st.ferr = f; colocar(p, id ? porId(id) : null); }, excluir, desfazer, refazer, render }
  };
}
