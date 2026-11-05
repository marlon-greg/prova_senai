// mascotes.js — mascotes cartoon dos professores (SVG puro, sem dependências).
//
// Uso:
//   import { MASCOTES, svgMascote, CSS_MASCOTE } from "./mascotes.js";
//   el.innerHTML = `<div class="mascote-anim">${svgMascote("feh", "comemorando")}</div>`;
//   (injete CSS_MASCOTE uma vez num <style>)
//
// Humores: "feliz" | "falando" | "surpreso" | "triste" | "comemorando".
// Grupos com classe: .m-corpo, .m-olhos (piscar), .m-boca (falar).

export const MASCOTES = {
  marlin:  { nome: "Marlin",  professor: "Marlon", cor: "#7a4a32", bordao: "Respira, lê de novo e manda ver!" },
  daniboy: { nome: "DaniBoy", professor: "Daniel", cor: "#1fb8a6", bordao: "Suave! Dá pra fazer de boa." },
  feh:     { nome: "Feh",     professor: "Felipe", cor: "#1565c0", bordao: "Bora, que tu manda muito bem!" },
  xelxo:   { nome: "Xelxo",   professor: "Celso",  cor: "#8a2238", bordao: "Calma, tô de olho... por trás dos óculos." },
};

const HUMORES = ["feliz", "falando", "surpreso", "triste", "comemorando"];
const OUT = "#2a1a14"; // contorno
const SW = 3;          // espessura do contorno

// ---------------------------------------------------------------- paletas
const PAL = {
  marlin: {
    pele: "#f4cdb0", peleSombra: "#dc9f80", cabelo: "#2a1c16", cabeloLuz: "#4d362b",
    barba: "#4b2f22", barbaLuz: "#6e4632", iris: "#4a2a1a",
    camisa: "#2c2b33", camisaLuz: "#45434f", w: 57,
  },
  daniboy: {
    pele: "#efc19e", peleSombra: "#d39a74", cabelo: "#3b261b", cabeloLuz: "#6a4532",
    barba: "#3b261b", barbaLuz: "#5a3a2a", iris: "#3d2516",
    camisa: "#2a2c33", camisaLuz: "#434652", detalhe: "#3fe0c5", w: 55,
  },
  feh: {
    pele: "#f2c4a0", peleSombra: "#d89c78", cabelo: "#1f1a18", cabeloLuz: "#45403c",
    barba: "#2e2420", barbaLuz: "#4f423b", iris: "#4b2e1c",
    camisa: "#f6f6f4", camisaLuz: "#ffffff", camisaSombra: "#d5d9df", w: 56,
  },
  xelxo: {
    pele: "#f3c6a3", peleSombra: "#d99d7a", cabelo: "#221a17", cabeloLuz: "#4a3d36",
    barba: "#3a2a22", barbaLuz: "#5c4436", iris: "#3a2418",
    camisa: "#7a2236", camisaLuz: "#a23a52", w: 63,
  },
};

// ---------------------------------------------------------------- utilidades
const sufixo = () => Math.random().toString(36).slice(2, 9);
const f = (n) => +n.toFixed(1);

function cabecaPath(w, top = 30, chin = 152, cy = 96) {
  const l = 100 - w, r = 100 + w;
  return `M${l} ${cy} C${l} ${top + 14} ${f(100 - w * 0.6)} ${top} 100 ${top} ` +
         `C${f(100 + w * 0.6)} ${top} ${r} ${top + 14} ${r} ${cy} ` +
         `C${r} ${cy + 36} ${f(100 + w * 0.55)} ${chin} 100 ${chin} ` +
         `C${f(100 - w * 0.55)} ${chin} ${l} ${cy + 36} ${l} ${cy} Z`;
}

function estrela(cx, cy, r, cor) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    d += (i ? "L" : "M") + f(cx + rr * Math.cos(a)) + " " + f(cy + rr * Math.sin(a));
  }
  return `<path d="${d}Z" fill="${cor}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
}

// ---------------------------------------------------------------- olhos
function olho(ex, ey, humor, p, lado) {
  if (humor === "comemorando") {
    return `<path d="M${ex - 10} ${ey + 3} Q${ex} ${ey - 10} ${ex + 10} ${ey + 3}" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`;
  }
  const sur = humor === "surpreso";
  const ry = sur ? 14 : 12.5, rx = sur ? 11.5 : 10.5;
  const ir = sur ? 5.6 : 7.6;
  const dy = humor === "triste" ? 3 : 1;
  let s = `<ellipse cx="${ex}" cy="${ey}" rx="${rx}" ry="${ry}" fill="#fff" stroke="${OUT}" stroke-width="${SW}"/>`;
  s += `<ellipse cx="${ex + 0.5}" cy="${ey + dy}" rx="${ir}" ry="${ir + 1.4}" fill="${p.iris}"/>`;
  s += `<circle cx="${ex + 0.5}" cy="${ey + dy + 0.5}" r="${sur ? 2.8 : 4.3}" fill="#140c08"/>`;
  s += `<circle cx="${ex - 2.6}" cy="${ey + dy - 3.6}" r="${sur ? 2 : 2.8}" fill="#fff"/>`;
  s += `<circle cx="${ex + 3.2}" cy="${ey + dy + 3.6}" r="1.3" fill="#fff" opacity=".9"/>`;
  if (humor === "triste") {
    // pálpebra caída para fora
    const o = lado < 0 ? -1 : 1; // -1 = olho esquerdo (lado de fora à esquerda)
    const xa = ex - 13, xb = ex + 13;
    const ya = o < 0 ? ey - 3 : ey - 10, yb = o < 0 ? ey - 10 : ey - 3;
    s += `<path d="M${xa} ${ey - 16} L${xb} ${ey - 16} L${xb} ${yb} L${xa} ${ya} Z" fill="${p.pele}"/>`;
    s += `<path d="M${xa + 2} ${f(ya + (o < 0 ? 0.6 : 0.3))} L${xb - 2} ${f(yb + (o < 0 ? 0.3 : 0.6))}" stroke="${OUT}" stroke-width="${SW}" stroke-linecap="round"/>`;
  } else {
    // cílio superior mais grosso
    s += `<path d="M${ex - rx + 0.5} ${ey - 2} Q${ex} ${ey - ry - 3.5} ${ex + rx - 0.5} ${ey - 2}" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`;
  }
  return s;
}

function olhos(humor, p, ey = 98, dx = 23) {
  return `<g class="m-olhos">${olho(100 - dx, ey, humor, p, -1)}${olho(100 + dx, ey, humor, p, 1)}</g>`;
}

// ---------------------------------------------------------------- sobrancelhas
function sobrancelhas(humor, cor, by, esp, dx = 23) {
  const um = (ex, lado) => {
    // lado -1 = esquerda (parte interna à direita)
    const xo = ex + 11 * lado, xi = ex - 11 * lado; // xo = externa, xi = interna
    let yo = by + 1, yi = by + 1, yc = by - 5;
    if (humor === "surpreso") { yo = by - 5; yi = by - 6; yc = by - 13; }
    else if (humor === "triste") { yo = by + 3; yi = by - 6; yc = by - 4; }
    else if (humor === "comemorando") { yo = by - 3; yi = by - 2; yc = by - 10; }
    else if (humor === "falando") { yo = by; yi = by - 1; yc = by - 6; }
    return `<path d="M${xo} ${yo} Q${ex} ${yc} ${xi} ${yi}" fill="none" stroke="${OUT}" stroke-width="${esp + 3}" stroke-linecap="round"/>` +
           `<path d="M${xo} ${yo} Q${ex} ${yc} ${xi} ${yi}" fill="none" stroke="${cor}" stroke-width="${esp}" stroke-linecap="round"/>`;
  };
  return `<g class="m-sobrancelhas">${um(100 - dx, -1)}${um(100 + dx, 1)}</g>`;
}

// ---------------------------------------------------------------- boca
function boca(humor, my, opt = {}) {
  const lar = opt.largura || 1; // fator de largura
  const L = (v) => f(100 + (v - 100) * lar);
  const dentes = opt.dentes;
  const escuro = "#5c1616", lingua = "#ee7d7d";
  let s = "";
  if (humor === "feliz") {
    if (dentes) {
      s += `<path d="M${L(84)} ${my - 3} Q100 ${my + 1} ${L(116)} ${my - 3} Q${L(113)} ${my + 13} 100 ${my + 13} Q${L(87)} ${my + 13} ${L(84)} ${my - 3} Z" fill="${escuro}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>`;
      s += `<path d="M${L(86.5)} ${my - 1.6} Q100 ${my + 2} ${L(113.5)} ${my - 1.6} L${L(112)} ${my + 4.5} Q100 ${my + 7} ${L(88)} ${my + 4.5} Z" fill="#fff"/>`;
      s += `<path d="M${L(92)} ${my + 10} Q100 ${my + 6} ${L(108)} ${my + 10} Q100 ${my + 13} ${L(92)} ${my + 10} Z" fill="${lingua}"/>`;
    } else {
      s += `<path d="M${L(88)} ${my - 2} Q100 ${my + 1} ${L(112)} ${my - 2} Q${L(110)} ${my + 10} 100 ${my + 10} Q${L(90)} ${my + 10} ${L(88)} ${my - 2} Z" fill="${escuro}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>`;
      s += `<path d="M${L(90)} ${my - 0.6} Q100 ${my + 2} ${L(110)} ${my - 0.6} L${L(109)} ${my + 2.6} Q100 ${my + 4.5} ${L(91)} ${my + 2.6} Z" fill="#fff"/>`;
      s += `<path d="M${L(94)} ${my + 7.6} Q100 ${my + 4.5} ${L(106)} ${my + 7.6} Q100 ${my + 10} ${L(94)} ${my + 7.6} Z" fill="${lingua}"/>`;
    }
  } else if (humor === "falando") {
    s += `<ellipse cx="100" cy="${my + 4}" rx="${f(8 * lar)}" ry="7" fill="${escuro}" stroke="${OUT}" stroke-width="2.6"/>`;
    s += `<path d="M${L(93.5)} ${my + 1} Q100 ${my - 1.5} ${L(106.5)} ${my + 1} L${L(106)} ${my + 0.5} Z" fill="#fff"/>`;
    s += `<path d="M${L(94)} ${my + 8.5} Q100 ${my + 4} ${L(106)} ${my + 8.5} Q100 ${my + 11} ${L(94)} ${my + 8.5} Z" fill="${lingua}"/>`;
  } else if (humor === "surpreso") {
    s += `<ellipse cx="100" cy="${my + 4}" rx="5.5" ry="7" fill="${escuro}" stroke="${OUT}" stroke-width="2.6"/>`;
    s += `<ellipse cx="100" cy="${my + 8}" rx="3.2" ry="2" fill="${lingua}"/>`;
  } else if (humor === "triste") {
    s += `<path d="M${L(89)} ${my + 7} Q100 ${my - 2} ${L(111)} ${my + 7}" fill="none" stroke="${OUT}" stroke-width="3.4" stroke-linecap="round"/>`;
  } else { // comemorando
    s += `<path d="M${L(84)} ${my - 3} Q100 ${my} ${L(116)} ${my - 3} Q${L(115)} ${my + 17} 100 ${my + 17} Q${L(85)} ${my + 17} ${L(84)} ${my - 3} Z" fill="${escuro}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>`;
    s += `<path d="M${L(86.5)} ${my - 1.8} Q100 ${my + 1.2} ${L(113.5)} ${my - 1.8} L${L(112.5)} ${my + 3.4} Q100 ${my + 5.6} ${L(87.5)} ${my + 3.4} Z" fill="#fff"/>`;
    s += `<path d="M${L(91)} ${my + 13.5} Q100 ${my + 7} ${L(109)} ${my + 13.5} Q100 ${my + 17.5} ${L(91)} ${my + 13.5} Z" fill="${lingua}"/>`;
  }
  if (opt.labio) {
    // contorno rosado para a boca destacar sobre a barba escura
    const aro = s.replace(/fill="[^"]*"/g, 'fill="none"').replace(/stroke="[^"]*"/g, `stroke="${opt.labio}"`)
      .replace(/stroke-width="[^"]*"/g, 'stroke-width="7"').replace(/<circle[^>]*\/>/g, "");
    const aroSemDetalhe = aro.split("/>").filter(t => t.includes("stroke=")).join("/>") + "/>";
    s = `<g opacity=".95">${humor === "triste" || humor === "surpreso" || humor === "falando" ? aro : aroSemDetalhe}</g>` + s;
  }
  return `<g class="m-boca">${s}</g>`;
}

// ---------------------------------------------------------------- partes comuns
function nariz(p, y = 111) {
  return `<path d="M95 ${y + 1} Q100 ${y + 5} 106 ${y}" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>` +
         `<ellipse cx="101" cy="${y - 4}" rx="4.5" ry="3.4" fill="${p.peleSombra}" opacity=".55"/>` +
         `<circle cx="99" cy="${y - 5}" r="1.4" fill="#fff" opacity=".6"/>`;
}

function bochechas(y = 113, dx = 34, op = 0.42) {
  return `<ellipse cx="${100 - dx}" cy="${y}" rx="8" ry="4.6" fill="#ff7f7a" opacity="${op}"/>` +
         `<ellipse cx="${100 + dx}" cy="${y}" rx="8" ry="4.6" fill="#ff7f7a" opacity="${op}"/>`;
}

function orelhas(p, w, y = 102) {
  const um = (cx, s) =>
    `<ellipse cx="${cx}" cy="${y}" rx="9" ry="13" fill="${p.pele}" stroke="${OUT}" stroke-width="${SW}"/>` +
    `<path d="M${cx + s * 2} ${y - 6} Q${cx - s * 3} ${y} ${cx + s * 1} ${y + 7}" fill="none" stroke="${p.peleSombra}" stroke-width="2.6" stroke-linecap="round"/>`;
  return um(100 - w - 1, 1) + um(100 + w + 1, -1);
}

function pescoco(p, id) {
  return `<path d="M84 136 L84 168 Q100 178 116 168 L116 136 Z" fill="${p.pele}" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
         `<path d="M85.5 140 L85.5 158 Q100 166 114.5 158 L114.5 140 Z" fill="${p.peleSombra}" opacity=".75"/>`;
}

function camisa(p, id, largura = 0) {
  const a = largura;
  return `<path d="M${10 - a} 222 C${12 - a} 190 ${32 - a} 171 ${70 - a / 2} 163 Q100 178 ${130 + a / 2} 163 C${168 + a} 171 ${188 + a} 190 ${190 + a} 222 Z" fill="url(#cam-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`;
}

function golaCareca(p) {
  return `<path d="M71 164 Q100 184 129 164" fill="none" stroke="${OUT}" stroke-width="${SW}" stroke-linecap="round"/>` +
         `<path d="M75 167.5 Q100 185 125 167.5" fill="none" stroke="${p.camisaLuz}" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
}

function dobrasCamisa(cor, op = 0.5) {
  return `<path d="M42 200 Q48 210 46 222" fill="none" stroke="${cor}" stroke-width="2.4" stroke-linecap="round" opacity="${op}"/>` +
         `<path d="M158 200 Q152 210 154 222" fill="none" stroke="${cor}" stroke-width="2.4" stroke-linecap="round" opacity="${op}"/>`;
}

function bracoLevantado(p, id) {
  const corM = p.camisa;
  return `<g class="m-braco">` +
    `<path d="M150 190 Q172 166 178 118" fill="none" stroke="${OUT}" stroke-width="21" stroke-linecap="round"/>` +
    `<path d="M150 190 Q172 166 178 118" fill="none" stroke="${p.pele}" stroke-width="15" stroke-linecap="round"/>` +
    `<path d="M148 196 Q160 182 166 168" fill="none" stroke="${OUT}" stroke-width="27" stroke-linecap="round"/>` +
    `<path d="M148 196 Q160 182 166 168" fill="none" stroke="${corM}" stroke-width="21" stroke-linecap="round"/>` +
    maoAberta(p) + `</g>`;
}
// mão aberta acenando: palma, quatro dedos separados e o polegar (contorno por baixo, pele por cima, para as juntas ficarem limpas)
function maoAberta(p) {
  const dedos = [["171 101", "166.5 85", 8.6], ["177.5 99", "176 80.5", 9], ["184 100", "186 82.5", 8.8], ["189.5 104", "195 91", 7.6], ["171 114", "158.5 105", 8.6]];
  const traco = (cor, extra) => dedos.map(([a, b, w]) => `<path d="M${a} L${b}" stroke="${cor}" stroke-width="${w + extra}" stroke-linecap="round"/>`).join("");
  return traco(OUT, 5.2) +
    `<ellipse cx="180" cy="108.5" rx="12" ry="12.5" fill="${p.pele}" stroke="${OUT}" stroke-width="${SW}"/>` +
    traco(p.pele, 0) +
    `<ellipse cx="180" cy="110" rx="7" ry="6.5" fill="${p.peleSombra}" opacity=".35"/>` +
    `<path d="M170.5 112 Q175 115 177 120" fill="none" stroke="${p.peleSombra}" stroke-width="2" stroke-linecap="round"/>` +
    [["166.8 87.5", "167.6 84.6"], ["176.1 83", "176.2 80"], ["185.8 85", "186.2 82"], ["194.4 93", "195 90.6"]].map(([a, b]) =>
      `<path d="M${a} L${b}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>`).join("");
}

function extrasHumor(humor, rosto) {
  if (humor === "comemorando") {
    return estrela(26, 40, 11, "#ffd23f") + estrela(170, 36, 8, "#ffd23f") + estrela(16, 96, 6, "#ff8fb1") +
      `<circle cx="44" cy="20" r="3" fill="#4fd1c5" stroke="${OUT}" stroke-width="1.5"/>` +
      `<circle cx="152" cy="16" r="2.6" fill="#ff8fb1" stroke="${OUT}" stroke-width="1.5"/>` +
      `<rect x="183" y="64" width="6" height="6" rx="1" transform="rotate(25 186 67)" fill="#7cc6ff" stroke="${OUT}" stroke-width="1.5"/>`;
  }
  if (humor === "surpreso") {
    return `<g stroke="${OUT}" stroke-width="3" stroke-linecap="round">` +
      `<path d="M170 30 L178 20"/><path d="M176 44 L188 40"/><path d="M160 22 L162 10"/></g>`;
  }
  if (humor === "triste") {
    const x = rosto.lagrimaX || 64, y = rosto.lagrimaY || 112;
    return `<path d="M${x} ${y} Q${x - 6} ${y + 10} ${x} ${y + 13} Q${x + 6} ${y + 10} ${x} ${y} Z" fill="#7cc6ff" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>` +
           `<circle cx="${x - 1.5}" cy="${y + 8}" r="1.3" fill="#fff"/>`;
  }
  return "";
}

// ---------------------------------------------------------------- defs
function defs(p, id) {
  const cs = p.camisaSombra || p.camisa;
  return `<defs>` +
    `<radialGradient id="pele-${id}" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="${p.pele}"/><stop offset=".7" stop-color="${p.pele}"/><stop offset="1" stop-color="${p.peleSombra}"/></radialGradient>` +
    `<linearGradient id="cab-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.cabeloLuz}"/><stop offset=".55" stop-color="${p.cabelo}"/></linearGradient>` +
    `<linearGradient id="bar-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.barbaLuz}"/><stop offset="1" stop-color="${p.barba}"/></linearGradient>` +
    `<linearGradient id="cam-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.camisaLuz}"/><stop offset=".6" stop-color="${p.camisa}"/><stop offset="1" stop-color="${cs}"/></linearGradient>` +
    `<linearGradient id="lente-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a525e"/><stop offset=".55" stop-color="#1c2027"/><stop offset="1" stop-color="#0d0f13"/></linearGradient>` +
    `</defs>`;
}

// ---------------------------------------------------------------- personagens
const PERSONAGENS = {
  // ------------------------------------------------ Marlin (Marlon)
  marlin(p, id, humor) {
    const w = p.w;
    const tras =
      `<path d="M36 92 C30 36 66 14 100 14 C134 14 170 36 164 92 C166 130 170 170 172 212 L28 212 C30 170 34 130 36 92 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    const corpo = pescoco(p, id) + camisa(p, id) + golaCareca(p) + dobrasCamisa("#17161b", 0.7);
    const barba =
      `<path d="M44 92 C45 106 52 118 62 122 C72 124 80 116 88 116 Q100 112 112 116 C120 116 128 124 138 122 C148 118 155 106 156 92 C162 128 154 160 136 180 C124 194 112 200 100 202 C88 200 76 194 64 180 C46 160 38 128 44 92 Z" fill="url(#bar-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<g fill="none" stroke="${p.barbaLuz}" stroke-width="2" stroke-linecap="round" opacity=".9">` +
      `<path d="M62 140 Q66 160 76 176"/><path d="M80 150 Q84 170 90 188"/><path d="M120 150 Q116 170 110 188"/><path d="M138 140 Q134 160 124 176"/><path d="M100 160 L100 192"/></g>` +
      `<g fill="none" stroke="#2c1a12" stroke-width="1.8" stroke-linecap="round" opacity=".6">` +
      `<path d="M70 150 Q74 168 82 182"/><path d="M130 150 Q126 168 118 182"/><path d="M92 166 Q94 182 96 194"/><path d="M108 166 Q106 182 104 194"/></g>`;
    const bigode =
      `<path d="M74 132 C78 118 92 114 100 119 C108 114 122 118 126 132 C118 126 108 125 100 127 C92 125 82 126 74 132 Z" fill="${p.barba}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<path d="M84 121 Q92 119 97 121" fill="none" stroke="${p.barbaLuz}" stroke-width="1.8" stroke-linecap="round"/>`;
    const frente =
      // topo com risca no meio
      `<path d="M38 104 C32 46 66 22 100 22 C134 22 168 46 162 104 C158 84 150 70 138 62 C126 56 110 54 101 40 C92 54 74 56 62 62 C50 70 42 84 38 104 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      // mechas laterais caindo sobre os ombros
      `<path d="M40 72 C33 116 36 160 24 212 Q32 204 38 214 Q44 204 50 212 Q54 206 58 210 C58 178 52 150 52 122 C52 104 50 88 46 76 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M160 72 C167 116 164 160 176 212 Q168 204 162 214 Q156 204 150 212 Q146 206 142 210 C142 178 148 150 148 122 C148 104 150 88 154 76 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<g fill="none" stroke="${p.cabeloLuz}" stroke-width="2.2" stroke-linecap="round" opacity=".95">` +
      `<path d="M94 32 Q74 36 58 54"/><path d="M106 32 Q126 36 142 54"/><path d="M42 120 Q42 160 36 196"/><path d="M158 120 Q158 160 164 196"/></g>` +
      `<path d="M80 30 Q90 26 98 30" fill="none" stroke="#7a5e4f" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`;
    return {
      tras, corpo, barba, bigode, frente, orelhas: false,
      face: { by: 80, esp: 7, my: 132, labio: "#c98572", bochechaY: 110, lagrimaX: 64, lagrimaY: 110 },
    };
  },

  // ------------------------------------------------ DaniBoy (Daniel)
  daniboy(p, id, humor) {
    const tras =
      `<path d="M38 96 C32 38 68 14 102 14 C136 14 170 38 162 96 C164 128 168 152 178 172 C168 182 152 178 146 172 Q100 150 54 172 C48 178 32 182 22 172 C32 152 36 128 38 96 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    const logo =
      // pequeno emblema verde-água no peito
      `<g fill="none" stroke="${p.detalhe}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M118 196 L118 206 L124 206"/><path d="M128 194 L128 206 L134 206 L134 198 L130 198"/><path d="M122 194 L132 194"/></g>`;
    const corpo = pescoco(p, id) + camisa(p, id) + golaCareca(p) + dobrasCamisa("#16171c", 0.7) + logo;
    const barba =
      // cavanhaque pequeno
      `<path d="M93.5 143 Q100 140 106.5 143 Q106 153 100 156 Q94 153 93.5 143 Z" fill="${p.barba}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>` ;
    const bigode =
      `<path d="M82 127 C88 118 95 118 100 120.5 C105 118 112 118 118 127 C112 123.5 106 123 100 124.5 C94 123 88 123.5 82 127 Z" fill="${p.barba}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
    const tufo = d => `<path d="${d}" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    const baguncado =
      tufo("M56 52 C46 40 34 36 24 40 C36 42 44 50 48 60Z") + tufo("M74 36 C70 22 60 14 50 14 C60 20 64 30 64 42Z") + tufo("M96 26 C98 14 108 6 120 6 C110 12 106 20 108 30Z") +
      tufo("M124 28 C134 18 148 16 156 20 C146 22 138 30 136 38Z") + tufo("M150 58 C162 52 174 54 180 62 C170 60 162 64 156 72Z") + tufo("M86 30 C80 20 82 12 88 8 C88 16 92 22 96 28Z");
    const fiosSoltos = `<g fill="none" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"><path d="M70 72 Q74 82 70 90"/><path d="M134 76 Q128 86 132 94"/></g>`;
    const frente =
      baguncado +
      // topo
      `<path d="M40 100 C34 46 68 22 102 22 C136 22 168 46 160 100 C156 80 146 64 132 56 C120 50 112 46 108 36 C100 48 80 54 66 60 C52 68 44 82 40 100 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      // franja repartida: mecha para a esquerda
      `<path d="M108 30 C88 32 64 44 52 70 C50 78 48 88 50 96 C54 84 62 76 70 72 C70 80 66 86 64 92 C76 82 84 70 88 58 C94 48 100 40 108 34 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      // mecha para a direita, caindo sobre o rosto
      `<path d="M106 30 C124 30 148 42 156 66 C160 78 160 90 158 102 C152 90 146 82 140 78 C142 88 140 96 134 102 C134 88 128 74 120 64 C114 54 108 44 106 34 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      // mechas laterais na altura dos ombros
      `<path d="M44 80 C36 112 40 146 20 168 C30 178 48 178 58 166 C56 146 54 118 52 96 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M156 80 C164 112 160 146 180 168 C170 178 152 178 142 166 C144 146 146 118 148 96 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<g fill="none" stroke="${p.cabeloLuz}" stroke-width="2.2" stroke-linecap="round">` +
      `<path d="M100 38 Q80 46 66 66"/><path d="M114 38 Q136 46 148 72"/><path d="M46 110 Q46 140 38 164"/><path d="M154 110 Q154 140 162 164"/></g>` +
      `<path d="M78 34 Q88 28 98 30" fill="none" stroke="#9a6e55" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>` + fiosSoltos;
    return {
      tras, corpo, barba, bigode, frente, orelhas: false,
      face: { caido: true, by: 81, esp: 5.6, my: 130, bochechaY: 116, blush: 0.22, lagrimaX: 64, lagrimaY: 112 },
    };
  },

  // ------------------------------------------------ Feh (Felipe)
  feh(p, id, humor) {
    const w = p.w;
    const cordao =
      `<path d="M76 166 L94 224 L106 224 L88 166 Z" fill="#1d1d1f" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M124 166 L106 224 L118 224 L136 166 Z" fill="#1d1d1f" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>` +
      `<text x="0" y="0" transform="translate(84.6 184) rotate(72.8)" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="7.2" letter-spacing=".4" fill="#fff">SENAI</text>` +
      `<text x="0" y="0" transform="translate(117.8 212) rotate(-72.8)" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="7.2" letter-spacing=".4" fill="#fff">SENAI</text>`;
    const corpo = pescoco(p, id) + camisa(p, id) +
      `<path d="M71 164 Q100 184 129 164" fill="none" stroke="${OUT}" stroke-width="${SW}" stroke-linecap="round"/>` +
      dobrasCamisa("#b9bec6", 0.9) + cordao;
    const barba =
      `<path d="M${100 - w} 94 C${100 - w + 1} 106 ${100 - w + 6} 116 64 120 C72 124 80 116 88 117 Q100 113 112 117 C120 116 128 124 136 120 C${100 + w - 6} 116 ${100 + w - 1} 106 ${100 + w} 94 C${100 + w + 3} 124 ${100 + w - 10} 150 126 162 C116 168 108 170 100 170 C92 170 84 168 74 162 C${100 - w + 10} 150 ${100 - w - 3} 124 ${100 - w} 94 Z" fill="url(#bar-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<g fill="none" stroke="${p.barbaLuz}" stroke-width="1.8" stroke-linecap="round"><path d="M60 136 Q66 150 76 158"/><path d="M140 136 Q134 150 124 158"/><path d="M96 158 L98 166"/><path d="M104 158 L102 166"/></g>`;
    const bigode =
      `<path d="M78 130 C82 119 94 115 100 119.5 C106 115 118 119 122 130 C114 125 106 124 100 126 C94 124 86 125 78 130 Z" fill="${p.barba}" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/>`;
    const frente =
      // cabelo curto com volume no topo
      // laterais degradê (raspadas)
      `<path d="M44.5 98 C42 80 44 64 52 54 L60 62 C54 70 51 82 51 98 Z" fill="#5a524d" opacity=".75"/>` +
      `<path d="M155.5 98 C158 80 156 64 148 54 L140 62 C146 70 149 82 149 98 Z" fill="#5a524d" opacity=".75"/>` +
      // topete com volume
      `<path d="M48 76 C42 50 52 30 70 22 C80 8 106 2 126 8 C146 12 160 28 158 50 C158 62 156 70 152 78 C150 68 144 62 136 59 C114 52 88 52 68 58 C58 62 52 68 48 76 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<g fill="none" stroke="${p.cabeloLuz}" stroke-width="2.4" stroke-linecap="round">` +
      `<path d="M62 44 Q78 22 108 16"/><path d="M72 52 Q96 32 132 30"/><path d="M118 12 Q144 16 150 36"/><path d="M140 44 Q150 50 152 62"/></g>` +
      `<path d="M86 16 Q98 10 112 12" fill="none" stroke="#8a8580" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>`;
    // óculos de armação preta retangular
    const oculos =
      `<g fill="none" stroke="#151515" stroke-linejoin="round">` +
      `<rect x="60" y="85" width="34" height="26" rx="6" fill="#dff1ff" fill-opacity=".18" stroke-width="4.4"/>` +
      `<rect x="106" y="85" width="34" height="26" rx="6" fill="#dff1ff" fill-opacity=".18" stroke-width="4.4"/>` +
      `<path d="M94 93 Q100 89 106 93" stroke-width="3.6"/>` +
      `<path d="M60 92 L${100 - w - 2} 95" stroke-width="3.6"/><path d="M140 92 L${100 + w + 2} 95" stroke-width="3.6"/></g>` +
      `<path d="M65 106 L72 90 M70 106 L75 95" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/>` +
      `<path d="M111 106 L118 90 M116 106 L121 95" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/>`;
    const brinco =
      `<circle cx="${100 - w - 3}" cy="116" r="3.2" fill="none" stroke="#c9ced6" stroke-width="2.2"/>` +
      `<circle cx="${100 - w - 3}" cy="116" r="3.2" fill="none" stroke="${OUT}" stroke-width=".8" opacity=".6"/>`;
    return {
      tras: "", corpo, barba, bigode, frente, oculos, orelhas: true, brinco,
      face: { by: 78, esp: 6, my: 132, labio: "#c98572", bochechaY: 112, dentes: true, largura: 1.15, lagrimaX: 62, lagrimaY: 112 },
    };
  },

  // ------------------------------------------------ Xelxo (Celso)
  xelxo(p, id, humor) {
    const w = p.w;
    const corpo = pescoco(p, id) + camisa(p, id, 6) +
      // gola polo
      `<path d="M72 162 L64 180 L92 178 L100 172 Z" fill="${p.camisaLuz}" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M128 162 L136 180 L108 178 L100 172 Z" fill="${p.camisaLuz}" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      // carcela com botões
      `<path d="M94 176 L94 212 L106 212 L106 176" fill="none" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<circle cx="100" cy="188" r="2.6" fill="#f2e6dd" stroke="${OUT}" stroke-width="1.4"/>` +
      `<circle cx="100" cy="202" r="2.6" fill="#f2e6dd" stroke="${OUT}" stroke-width="1.4"/>` +
      dobrasCamisa("#4f1121", 0.8);
    const barba =
      `<path d="M${100 - w} 94 C${100 - w + 1} 108 ${100 - w + 8} 116 62 120 C72 124 80 116 88 117 Q100 113 112 117 C120 116 128 124 138 120 C${100 + w - 8} 116 ${100 + w - 1} 108 ${100 + w} 94 C${100 + w + 4} 128 ${100 + w - 10} 156 128 168 C118 174 108 176 100 176 C92 176 82 174 72 168 C${100 - w + 10} 156 ${100 - w - 4} 128 ${100 - w} 94 Z" fill="url(#bar-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<g fill="none" stroke="${p.barbaLuz}" stroke-width="1.8" stroke-linecap="round"><path d="M54 136 Q60 152 72 162"/><path d="M146 136 Q140 152 128 162"/><path d="M96 162 L98 172"/><path d="M104 162 L102 172"/></g>`;
    const bigode =
      `<path d="M76 131 C80 119 94 115 100 119.5 C106 115 120 119 124 131 C116 126 106 125 100 127 C94 125 84 126 76 131 Z" fill="${p.barba}" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/>`;
    const frente =
      // curto penteado para trás
      `<path d="M${100 - w} 90 C${100 - w - 4} 40 70 20 104 20 C140 20 ${100 + w + 4} 40 ${100 + w} 90 L${100 + w - 6} 84 C${100 + w - 8} 66 146 56 132 52 C110 46 82 48 64 56 C${100 - w + 10} 64 ${100 - w + 6} 76 ${100 - w + 5} 86 Z" fill="url(#cab-${id})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<g fill="none" stroke="${p.cabeloLuz}" stroke-width="2.4" stroke-linecap="round">` +
      `<path d="M66 50 Q86 34 120 32"/><path d="M80 46 Q104 36 140 42"/><path d="M128 28 Q150 36 156 56"/><path d="M50 70 Q54 48 74 36"/></g>`;
    const oculos =
      `<g stroke="#3a3e46" stroke-linejoin="round">` +
      `<path d="M58 86 L96 86 L94 106 Q93 110 88 110 L64 110 Q59 110 58 105 Z" fill="url(#lente-${id})" stroke-width="3.6"/>` +
      `<path d="M104 86 L142 86 L142 105 Q141 110 136 110 L112 110 Q107 110 106 106 Z" fill="url(#lente-${id})" stroke-width="3.6"/>` +
      `<path d="M96 88 Q100 86 104 88" fill="none" stroke-width="3.6"/>` +
      `<path d="M58 88 L${100 - w - 2} 92 M142 88 L${100 + w + 2} 92" fill="none" stroke-width="3.6"/></g>` +
      `<path d="M58 85 L96 85 M104 85 L142 85" stroke="${OUT}" stroke-width="1.2" opacity=".6"/>` +
      `<path d="M64 104 L74 90 M70 105 L78 94" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".45"/>` +
      `<path d="M110 104 L120 90 M116 105 L124 94" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".45"/>`;
    return {
      tras: "", corpo, barba, bigode, frente, oculos, orelhas: true,
      face: { by: 77, esp: 6.5, my: 133, labio: "#c98572", bochechaY: 116, olhosOcultos: true, lagrimaX: 66, lagrimaY: 112 },
    };
  },
};

// ---------------------------------------------------------------- API

// ---------------------------------------------------------------- estilo editável (professor)
// O desenho de cada mascote é fixo; o professor muda cores e põe um acessório. Estilo vazio = o PADRÃO (o original).
// Os estilos em uso ficam em Firestore mascotes/{id}.ativo; a página carrega e chama definirEstilos().
export const OPCOES_ESTILO = {
  pele: ["#f9d7c0", "#f4cdb0", "#efc19e", "#e0ac69", "#c68642", "#a0662f", "#8d5524", "#5c3a1e"],
  cabelo: ["#1f1a18", "#2a1c16", "#3b261b", "#6b4423", "#8b5a2b", "#b5482f", "#d9a441", "#e8d5a3", "#9ca3af", "#e5e7eb", "#2563eb", "#7c3aed"],
  barba: ["#1f1a18", "#2e2420", "#3a2a22", "#4b2f22", "#6b4423", "#8b5a2b", "#b5482f", "#9ca3af", "#e5e7eb"],
  iris: ["#3a2418", "#4a2a1a", "#5b3a1a", "#1d4ed8", "#047857", "#6b7280", "#7c3aed"],
  camisa: ["#2c2b33", "#2a2c33", "#f6f6f4", "#7a2236", "#c1272d", "#1d4ed8", "#059669", "#0e7490", "#7c3aed", "#f59e0b", "#db2777", "#111827", "#92400e", "#64748b"],
  acessorio: [["nenhum", "Nenhum"], ["bone", "Boné"], ["gorro", "Gorro"], ["fone", "Fone de ouvido"], ["gravata", "Gravata-borboleta"], ["cracha", "Crachá SENAI"], ["estrela", "Broche de estrela"]],
  corAcessorio: ["#c1272d", "#1d4ed8", "#059669", "#111827", "#f59e0b", "#7c3aed", "#db2777", "#f8fafc"]
};
export const NOMES_ESTILO = { pele: "Pele", cabelo: "Cabelo", barba: "Barba e bigode", iris: "Olhos", camisa: "Roupa", acessorio: "Acessório", corAcessorio: "Cor do acessório" };
const hex = h => { h = String(h || "#888").replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0); };
const tom = (c, t) => { const A = hex(c), B = t > 0 ? [255, 255, 255] : [0, 0, 0], k = Math.abs(t); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
let ESTILOS = {};
export function definirEstilos(mapa) { ESTILOS = mapa || {}; }
export const estiloDe = id => ESTILOS[String(id || "").toLowerCase()] || {};
function aplicarEstilo(p, e = {}) {
  const q = { ...p };
  if (e.pele) { q.pele = e.pele; q.peleSombra = tom(e.pele, -.14); }
  if (e.cabelo) { q.cabelo = e.cabelo; q.cabeloLuz = tom(e.cabelo, .22); }
  if (e.barba) { q.barba = e.barba; q.barbaLuz = tom(e.barba, .22); }
  if (e.iris) q.iris = e.iris;
  if (e.camisa) { q.camisa = e.camisa; q.camisaLuz = tom(e.camisa, .18); q.camisaSombra = tom(e.camisa, -.14); }
  return q;
}
// acessório desenhado por cima de qualquer mascote (coordenadas do desenho: 200 x 220, rosto no centro)
function acessorioSvg(e = {}) {
  const c = e.corAcessorio || "#c1272d", cs = tom(c, -.3);
  const tr = d => `<path d="${d}" fill="${c}" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`;
  return ({
    bone: tr("M36 66 C36 24 64 8 100 8 C136 8 164 24 164 66 C140 56 120 54 100 54 C80 54 60 56 36 66 Z") + tr("M100 56 C132 52 162 56 186 70 C172 80 150 76 132 70 C120 66 110 64 100 62 Z") +
      `<circle cx="100" cy="10" r="5" fill="${cs}" stroke="${OUT}" stroke-width="2"/><path d="M100 12 L100 52 M70 18 L76 56 M130 18 L124 56" stroke="${cs}" stroke-width="2" opacity=".6"/>`,
    gorro: tr("M34 70 C34 20 64 2 100 2 C136 2 166 20 166 70 Z") + `<rect x="30" y="56" width="140" height="20" rx="10" fill="${tom(c, .55)}" stroke="${OUT}" stroke-width="${SW}"/><circle cx="100" cy="0" r="12" fill="${tom(c, .55)}" stroke="${OUT}" stroke-width="${SW}"/>`,
    fone: `<path d="M34 104 C30 30 66 6 100 6 C134 6 170 30 166 104" fill="none" stroke="${OUT}" stroke-width="12" stroke-linecap="round"/><path d="M34 104 C30 30 66 6 100 6 C134 6 170 30 166 104" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>` +
      `<rect x="22" y="88" width="24" height="38" rx="11" fill="${c}" stroke="${OUT}" stroke-width="${SW}"/><rect x="154" y="88" width="24" height="38" rx="11" fill="${c}" stroke="${OUT}" stroke-width="${SW}"/>`,
    gravata: `<path d="M100 178 L80 166 L80 190 Z M100 178 L120 166 L120 190 Z" fill="${c}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="100" cy="178" r="6" fill="${cs}" stroke="${OUT}" stroke-width="2.4"/>`,
    cracha: `<path d="M80 168 L118 200 M120 168 L126 200" stroke="#c1272d" stroke-width="5" stroke-linecap="round"/><rect x="108" y="196" width="34" height="24" rx="4" fill="#fff" stroke="${OUT}" stroke-width="2.4"/>` +
      `<rect x="108" y="196" width="34" height="8" rx="3" fill="#c1272d"/><text x="125" y="214" font-size="7" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#111">SENAI</text>`,
    estrela: estrela(132, 190, 9, c)
  })[e.acessorio] || "";
}

export function svgMascote(id, humor = "feliz", estilo = null) {
  const chave = String(id || "").toLowerCase();
  if (!PERSONAGENS[chave]) throw new Error(`Mascote desconhecido: ${id}`);
  if (!HUMORES.includes(humor)) humor = "feliz";
  const est = estilo || ESTILOS[chave] || {}, p = aplicarEstilo(PAL[chave], est);
  const uid = `${chave}-${sufixo()}`;
  const c = PERSONAGENS[chave](p, uid, humor);
  const fz = c.face;
  const m = MASCOTES[chave];

  const corpoExtra = humor === "comemorando" ? bracoLevantado(p, uid) : "";

  let olhosSvg = olhos(humor, p);
  if (fz.caido && !["comemorando", "triste"].includes(humor)) {
    const palp = (ex, lado) => { const fora = ex + lado * 13, dentro = ex - lado * 13, ey = 98;
      return `<path d="M${fora} ${ey - 17} L${dentro} ${ey - 17} L${dentro} ${ey - 9} Q${ex} ${ey - 8.5} ${fora} ${ey - 1.5}Z" fill="${p.pele}"/>` +
        `<path d="M${dentro + lado * 2} ${ey - 8.6} Q${ex} ${ey - 8.2} ${fora - lado * 1.5} ${ey - 2}" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M${dentro + lado * 1} ${ey - 12.5} Q${ex} ${ey - 12.5} ${fora - lado * 2} ${ey - 6.5}" fill="none" stroke="${p.peleSombra}" stroke-width="2" stroke-linecap="round"/>`; };
    olhosSvg = olhosSvg.replace(/<\/g>$/, palp(77, -1) + palp(123, 1) + "</g>");
  }
  if (fz.olhosOcultos) {
    // olhos atrás das lentes escuras (aparecem levemente por transparência)
    olhosSvg = olhosSvg.replace('class="m-olhos"', 'class="m-olhos" opacity=".22"');
  }

  const partes = [
    defs(p, uid),
    c.tras,
    `<g class="m-corpo">${c.corpo}</g>`,
    c.orelhas ? orelhas(p, p.w) : "",
    c.brinco || "",
    `<path d="${cabecaPath(p.w)}" fill="url(#pele-${uid})" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`,
    bochechas(fz.bochechaY, 35, fz.blush ?? (fz.olhosOcultos ? 0.3 : 0.42)),
    c.barba,
    boca(humor, fz.my, { dentes: fz.dentes, largura: fz.largura, labio: fz.labio }),
    c.bigode,
    nariz(p),
    olhosSvg,
    c.oculos || "",
    sobrancelhas(humor, p.cabelo, fz.by, fz.esp),
    c.frente,
    acessorioSvg(est),
    corpoExtra,
    extrasHumor(humor, fz),
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" class="mascote-svg mascote-${chave} m-${humor}" role="img" aria-label="${m.nome} (${humor})"><title>${m.nome}</title>${partes.join("")}</svg>`;
}

export const CSS_MASCOTE = `
.mascote-anim{display:inline-block;animation:m-flutuar 3.4s ease-in-out infinite;will-change:transform}
@keyframes m-flutuar{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.mascote-svg{overflow:visible}
.mascote-svg .m-olhos{transform-box:fill-box;transform-origin:center;animation:m-piscar 4.6s ease-in-out infinite}
@keyframes m-piscar{0%,91%,97%,100%{transform:scaleY(1)}94%{transform:scaleY(.08)}}
.m-falando .m-boca{transform-box:fill-box;transform-origin:50% 25%;animation:m-falar .34s ease-in-out infinite alternate}
@keyframes m-falar{from{transform:scaleY(1)}to{transform:scaleY(.45)}}
.m-comemorando .m-braco{transform-box:fill-box;transform-origin:20% 95%;animation:m-acenar .6s ease-in-out infinite alternate}
@keyframes m-acenar{from{transform:rotate(-4deg)}to{transform:rotate(6deg)}}
@media (prefers-reduced-motion: reduce){
  .mascote-anim,.mascote-svg .m-olhos,.m-falando .m-boca,.m-comemorando .m-braco{animation:none!important}
}
`;
