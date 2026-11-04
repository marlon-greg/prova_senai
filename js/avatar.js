// Personagem do aluno: desenho em SVG montado por partes (pele, rosto, cabelo, olhos, boca, roupa, acessório, fundo, moldura).
// Algumas partes são SKINS liberadas por conquistas (desbloqueio por número de conquistas ou por uma medalha específica).

export const PELES = ["#f9d7c0", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5c3a1e"];
export const CORES_CABELO = ["#1f1a17", "#4a2c1a", "#8b5a2b", "#d9a441", "#e8d5a3", "#b5482f", "#6b7280", "#2563eb", "#db2777", "#7c3aed"];
export const CORES_ROUPA = ["#c1272d", "#1d4ed8", "#059669", "#111827", "#f59e0b", "#7c3aed", "#db2777", "#0e7490", "#f3f4f6"];

// catálogo: cada item pode ter { trava: { n } (nº de conquistas) ou { medalha: "id da conquista" } }
export const CATALOGO = {
  rosto: [{ id: "redondo", nome: "Redondo" }, { id: "oval", nome: "Oval" }, { id: "quadrado", nome: "Quadrado" }],
  cabelo: [{ id: "curto", nome: "Curto" }, { id: "longo", nome: "Longo" }, { id: "cacheado", nome: "Cacheado" }, { id: "black", nome: "Black power" },
    { id: "rabo", nome: "Rabo de cavalo" }, { id: "coque", nome: "Coque" }, { id: "raspado", nome: "Raspado" }, { id: "moicano", nome: "Moicano", trava: { n: 3 } },
    { id: "trancas", nome: "Tranças", trava: { n: 5 } }, { id: "careca", nome: "Careca" }, { id: "franja", nome: "Franja" }, { id: "ondulado", nome: "Ondulado" },
    { id: "lateral", nome: "Lado raspado" }, { id: "espetado", nome: "Espetado", trava: { n: 2 } }, { id: "maria", nome: "Maria-chiquinha" }, { id: "dread", nome: "Dreads", trava: { n: 6 } }],
  sobrancelha: [{ id: "normal", nome: "Normal" }, { id: "grossa", nome: "Grossas" }, { id: "arqueada", nome: "Arqueadas" }, { id: "brava", nome: "Determinada" }, { id: "nenhuma", nome: "Sem" }],
  barba: [{ id: "nenhuma", nome: "Nenhuma" }, { id: "bigode", nome: "Bigode" }, { id: "cavanhaque", nome: "Cavanhaque" }, { id: "curta", nome: "Barba curta" }, { id: "cheia", nome: "Barba cheia" }],
  detalhe: [{ id: "nenhum", nome: "Nenhum" }, { id: "sardas", nome: "Sardas" }, { id: "pinta", nome: "Pinta" }, { id: "corado", nome: "Bochechas coradas" }, { id: "curativo", nome: "Curativo" },
    { id: "pintura", nome: "Pintura de torcida", trava: { n: 3 } }, { id: "brilho", nome: "Brilhinhos", trava: { n: 6 } }],
  olhos: [{ id: "normal", nome: "Normal" }, { id: "feliz", nome: "Feliz" }, { id: "grandes", nome: "Grandes" }, { id: "sono", nome: "Sonolentos" }, { id: "surpresa", nome: "Surpresos" },
    { id: "piscando", nome: "Piscando", trava: { n: 2 } }, { id: "coracao", nome: "Apaixonados", trava: { n: 4 } }, { id: "estrela", nome: "Olhos de estrela", trava: { medalha: "gabaritou" } }],
  boca: [{ id: "sorriso", nome: "Sorriso" }, { id: "grande", nome: "Sorrisão" }, { id: "neutra", nome: "Tranquila" }, { id: "lado", nome: "Sorriso de lado" }, { id: "o", nome: "Uau" },
    { id: "dentes", nome: "Dentuço" }, { id: "lingua", nome: "Língua", trava: { n: 4 } }],
  roupa: [{ id: "camiseta", nome: "Camiseta" }, { id: "moletom", nome: "Moletom" }, { id: "gola", nome: "Camisa polo" },
    { id: "jaleco", nome: "Jaleco SENAI", trava: { medalha: "primeira-prova" } }, { id: "capa", nome: "Capa de herói", trava: { medalha: "fiz-sozinha" } },
    { id: "terno", nome: "Terno de formatura", trava: { medalha: "veterano" } }, { id: "regata", nome: "Regata" }, { id: "jaqueta", nome: "Jaqueta" },
    { id: "listrada", nome: "Listrada" }, { id: "time", nome: "Uniforme de time", trava: { n: 4 } }, { id: "astronauta", nome: "Astronauta", trava: { n: 10 } }],
  acessorio: [{ id: "nenhum", nome: "Nenhum" }, { id: "oculos", nome: "Óculos" }, { id: "bone", nome: "Boné", trava: { n: 1 } },
    { id: "fone", nome: "Fone de ouvido", trava: { n: 3 } }, { id: "escuros", nome: "Óculos escuros", trava: { medalha: "trinca-de-ouro" } },
    { id: "headset", nome: "Headset gamer", trava: { n: 8 } }, { id: "coroa", nome: "Coroa", trava: { n: 12 } }, { id: "aureola", nome: "Auréola de estrelas", trava: { medalha: "chuva-de-estrelas" } },
    { id: "laco", nome: "Laço" }, { id: "flor", nome: "Flor" }, { id: "faixa", nome: "Faixa ninja", trava: { n: 2 } }, { id: "gorro", nome: "Gorro" }, { id: "tiara", nome: "Tiara", trava: { n: 5 } },
    { id: "mago", nome: "Chapéu de mago", trava: { n: 9 } }, { id: "monoculo", nome: "Monóculo", trava: { n: 7 } }],
  fundo: [{ id: "azul", nome: "Céu", cor: "#dbeafe" }, { id: "verde", nome: "Menta", cor: "#d1fae5" }, { id: "rosa", nome: "Rosa", cor: "#fce7f3" }, { id: "cinza", nome: "Neutro", cor: "#f1f5f9" },
    { id: "senai", nome: "SENAI", cor: "#c1272d", trava: { n: 2 } }, { id: "por-do-sol", nome: "Pôr do sol", grad: ["#f97316", "#db2777"], trava: { n: 4 } },
    { id: "galaxia", nome: "Galáxia", grad: ["#1e1b4b", "#7c3aed"], trava: { n: 7 } }, { id: "ouro", nome: "Dourado", grad: ["#fde68a", "#f59e0b"], trava: { medalha: "trinca-de-ouro" } },
    { id: "arco-iris", nome: "Arco-íris", grad: ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"], trava: { n: 10 } },
    { id: "amarelo", nome: "Sol", cor: "#fef3c7" }, { id: "lilas", nome: "Lilás", cor: "#ede9fe" }, { id: "bolinhas", nome: "Bolinhas", cor: "#e0f2fe", padrao: "bolinhas" },
    { id: "listras", nome: "Listras", cor: "#fef9c3", padrao: "listras", trava: { n: 1 } }, { id: "codigo", nome: "Código", cor: "#0f172a", padrao: "codigo", trava: { n: 3 } },
    { id: "oceano", nome: "Oceano", grad: ["#0ea5e9", "#1e3a8a"], trava: { n: 5 } }, { id: "floresta", nome: "Floresta", grad: ["#86efac", "#166534"], trava: { n: 6 } }],
  adesivo: [{ id: "nenhum", nome: "Nenhum" }, { id: "⭐", nome: "Estrela" }, { id: "💻", nome: "Computador" }, { id: "🎮", nome: "Videogame" }, { id: "⚽", nome: "Futebol" },
    { id: "🎵", nome: "Música" }, { id: "🐱", nome: "Gato" }, { id: "🐶", nome: "Cachorro" }, { id: "📚", nome: "Livros" }, { id: "🚀", nome: "Foguete", trava: { n: 2 } },
    { id: "🔥", nome: "Fogo", trava: { medalha: "em-chamas" } }, { id: "🏆", nome: "Troféu", trava: { n: 8 } }, { id: "💎", nome: "Diamante", trava: { n: 14 } }],
  moldura: [{ id: "nenhuma", nome: "Nenhuma" }, { id: "bronze", nome: "Bronze", cor: "#b45309", trava: { n: 1 } }, { id: "prata", nome: "Prata", cor: "#94a3b8", trava: { n: 5 } },
    { id: "ouro", nome: "Ouro", cor: "#f59e0b", trava: { n: 9 } }, { id: "diamante", nome: "Diamante", cor: "#22d3ee", trava: { n: 15 } }, { id: "fogo", nome: "Fogo", cor: "#ef4444", trava: { medalha: "em-chamas" } }]
};
export const AVATAR_PADRAO = { pele: 1, rosto: "redondo", cabelo: "curto", corCabelo: 1, sobrancelha: "normal", olhos: "normal", corOlhos: 0, boca: "sorriso", barba: "nenhuma", detalhe: "nenhum",
  roupa: "camiseta", corRoupa: 0, acessorio: "nenhum", corAcessorio: 0, fundo: "azul", adesivo: "nenhum", moldura: "nenhuma" };
export const CORES_OLHOS = ["#1f2937", "#5b3a1a", "#1d4ed8", "#047857", "#6b7280", "#7c3aed"];
export const CORES_ACESSORIO = ["#111827", "#c1272d", "#2563eb", "#f59e0b", "#db2777", "#059669", "#7c3aed", "#f8fafc"];

import { CONQUISTAS_PADRAO } from "./conquistas.js";
// item liberado? ganhas = conquistas ganhas [{ id, t }] (a trava por medalha usa o id da conquista)
export function liberado(item, ganhas) {
  if (!item?.trava) return true;
  if (item.trava.n) return ganhas.length >= item.trava.n;
  return ganhas.some(g => g.id === item.trava.medalha || String(g.id || "").startsWith(item.trava.medalha + ":"));
}
const nomeMedalha = id => CONQUISTAS_PADRAO.find(c => c.id === id)?.t || id;
export const textoTrava = t => !t ? "" : t.n ? `🔒 ${t.n} conquista(s)` : `🔒 medalha “${nomeMedalha(t.medalha)}”`;
// troca o que estiver travado pelo padrão (ex.: perdeu a medalha ou o perfil veio de outro lugar)
export function avatarValido(a, ganhas) {
  const v = { ...AVATAR_PADRAO, ...(a || {}) };
  for (const parte of Object.keys(CATALOGO)) { const it = CATALOGO[parte].find(x => x.id === v[parte]); if (!it || !liberado(it, ganhas)) v[parte] = AVATAR_PADRAO[parte]; }
  v.pele = Math.max(0, Math.min(PELES.length - 1, Number(v.pele) || 0)); v.corCabelo = Math.max(0, Math.min(CORES_CABELO.length - 1, Number(v.corCabelo) || 0));
  v.corRoupa = Math.max(0, Math.min(CORES_ROUPA.length - 1, Number(v.corRoupa) || 0));
  v.corOlhos = Math.max(0, Math.min(CORES_OLHOS.length - 1, Number(v.corOlhos) || 0)); v.corAcessorio = Math.max(0, Math.min(CORES_ACESSORIO.length - 1, Number(v.corAcessorio) || 0));
  return v;
}

let seq = 0;
export function svgAvatar(av, tam = 200) {
  const a = { ...AVATAR_PADRAO, ...(av || {}) }, id = "av" + (++seq);
  const pele = PELES[a.pele] || PELES[1], cab = CORES_CABELO[a.corCabelo] || CORES_CABELO[1], roupa = CORES_ROUPA[a.corRoupa] || CORES_ROUPA[0];
  const olho = CORES_OLHOS[a.corOlhos] || CORES_OLHOS[0], ac = CORES_ACESSORIO[a.corAcessorio] || CORES_ACESSORIO[0];
  const fundo = CATALOGO.fundo.find(f => f.id === a.fundo) || CATALOGO.fundo[0], mold = CATALOGO.moldura.find(m => m.id === a.moldura);
  const rx = { redondo: 50, oval: 45, quadrado: 50 }[a.rosto] || 50, ry = { redondo: 54, oval: 60, quadrado: 52 }[a.rosto] || 54;
  const cabeca = a.rosto === "quadrado" ? `<rect x="${100 - rx}" y="${96 - ry}" width="${rx * 2}" height="${ry * 2}" rx="26" fill="${pele}"/>` : `<ellipse cx="100" cy="96" rx="${rx}" ry="${ry}" fill="${pele}"/>`;
  const grad = fundo.grad ? `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">${fundo.grad.map((c, i) => `<stop offset="${i / (fundo.grad.length - 1)}" stop-color="${c}"/>`).join("")}</linearGradient>` : "";
  const sombraCab = `opacity=".18" fill="#000"`;
  // cabelo atrás da cabeça (longo, tranças, rabo)
  const tras = { longo: `<path d="M44 92 Q42 40 100 34 Q158 40 156 92 L162 170 Q100 182 38 170Z" fill="${cab}"/>`,
    trancas: `<path d="M48 90 Q46 42 100 36 Q154 42 152 90 L150 150 Q100 160 50 150Z" fill="${cab}"/><g fill="${cab}">${[0, 1, 2, 3].map(i => `<ellipse cx="56" cy="${150 + i * 11}" rx="9" ry="7"/><ellipse cx="144" cy="${150 + i * 11}" rx="9" ry="7"/>`).join("")}</g>`,
    rabo: `<path d="M140 70 Q178 92 160 150 Q150 128 146 100Z" fill="${cab}"/>`, black: `<circle cx="100" cy="78" r="70" fill="${cab}"/>`,
    cacheado: `<g fill="${cab}">${[[50, 70], [62, 46], [86, 34], [114, 34], [138, 46], [150, 70], [46, 96], [154, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20"/>`).join("")}</g>`,
    ondulado: `<path d="M44 92 Q40 40 100 34 Q160 40 156 92 Q164 120 150 150 Q140 128 146 110 Q100 140 54 110 Q60 128 50 150 Q36 120 44 92Z" fill="${cab}"/>`,
    maria: `<circle cx="40" cy="80" r="17" fill="${cab}"/><circle cx="160" cy="80" r="17" fill="${cab}"/><circle cx="34" cy="100" r="13" fill="${cab}"/><circle cx="166" cy="100" r="13" fill="${cab}"/>`,
    dread: `<path d="M48 90 Q46 40 100 36 Q154 40 152 90Z" fill="${cab}"/><g stroke="${cab}" stroke-width="9" stroke-linecap="round">${[52, 64, 136, 148].map(x => `<path d="M${x} 80 L${x + (x < 100 ? -4 : 4)} 160"/>`).join("")}</g>` }[a.cabelo] || "";
  const frente = { curto: `<path d="M48 84 Q50 40 100 38 Q150 40 152 84 Q134 62 100 62 Q66 62 48 84Z" fill="${cab}"/>`,
    longo: `<path d="M48 90 Q50 40 100 38 Q150 40 152 90 Q132 58 100 60 Q70 60 48 90Z" fill="${cab}"/>`,
    cacheado: `<path d="M52 80 Q60 50 100 48 Q140 50 148 80 Q126 64 100 66 Q74 64 52 80Z" fill="${cab}"/>`,
    black: `<path d="M50 84 Q56 52 100 50 Q144 52 150 84 Q128 70 100 70 Q72 70 50 84Z" fill="${cab}"/>`,
    rabo: `<path d="M48 84 Q50 40 100 38 Q150 40 152 84 Q130 60 100 60 Q70 60 48 84Z" fill="${cab}"/>`,
    coque: `<circle cx="100" cy="34" r="20" fill="${cab}"/><path d="M48 84 Q50 44 100 42 Q150 44 152 84 Q130 62 100 62 Q70 62 48 84Z" fill="${cab}"/>`,
    raspado: `<path d="M50 80 Q52 44 100 42 Q148 44 150 80 Q128 62 100 62 Q72 62 50 80Z" fill="${cab}" opacity=".45"/>`,
    moicano: `<path d="M86 66 L90 22 L100 30 L110 22 L114 66Z" fill="${cab}"/><path d="M50 80 Q52 46 100 44 Q148 46 150 80" fill="none" stroke="${cab}" stroke-width="3" opacity=".4"/>`,
    trancas: `<path d="M48 86 Q50 42 100 40 Q150 42 152 86 Q130 62 100 62 Q70 62 48 86Z" fill="${cab}"/><path d="M100 40 L100 62" stroke="#0003" stroke-width="2"/>`,
    careca: `<ellipse cx="82" cy="58" rx="12" ry="6" fill="#fff" opacity=".35"/>`,
    franja: `<path d="M48 88 Q48 40 100 38 Q152 40 152 88 Q150 70 132 74 L128 62 Q114 76 100 66 Q86 78 72 64 L68 76 Q52 70 48 88Z" fill="${cab}"/>`,
    ondulado: `<path d="M48 86 Q50 40 100 38 Q150 40 152 86 Q140 66 124 70 Q112 58 100 66 Q88 58 76 70 Q60 66 48 86Z" fill="${cab}"/>`,
    lateral: `<path d="M60 74 Q64 40 104 38 Q150 40 152 84 Q136 60 104 58 Q80 58 60 74Z" fill="${cab}"/><path d="M48 84 Q50 64 60 74" fill="none" stroke="${cab}" stroke-width="3" opacity=".4"/>`,
    espetado: `<path d="M48 82 L52 50 L62 60 L68 32 L80 52 L90 24 L100 48 L110 24 L120 52 L132 32 L138 60 L148 50 L152 82 Q130 62 100 62 Q70 62 48 82Z" fill="${cab}"/>`,
    maria: `<path d="M48 84 Q50 40 100 38 Q150 40 152 84 Q130 60 100 60 Q70 60 48 84Z" fill="${cab}"/><path d="M100 38 L100 60" stroke="#0003" stroke-width="2"/>`,
    dread: `<path d="M50 84 Q52 44 100 42 Q148 44 150 84 Q128 62 100 62 Q72 62 50 84Z" fill="${cab}"/>` }[a.cabelo] || "";
  const olhos = { normal: `<circle cx="80" cy="100" r="6" fill="${olho}"/><circle cx="120" cy="100" r="6" fill="${olho}"/><circle cx="82" cy="98" r="2" fill="#fff"/><circle cx="122" cy="98" r="2" fill="#fff"/>`,
    feliz: `<path d="M72 102 Q80 92 88 102" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M112 102 Q120 92 128 102" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    grandes: `<ellipse cx="80" cy="99" rx="9" ry="11" fill="#fff"/><ellipse cx="120" cy="99" rx="9" ry="11" fill="#fff"/><circle cx="81" cy="101" r="6" fill="${olho}"/><circle cx="121" cy="101" r="6" fill="${olho}"/><circle cx="83" cy="98" r="2" fill="#fff"/><circle cx="123" cy="98" r="2" fill="#fff"/>`,
    sono: `<path d="M72 102 Q80 108 88 102" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M112 102 Q120 108 128 102" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/><text x="140" y="80" font-size="14" font-family="Arial" font-weight="bold" fill="#64748b">z</text>`,
    surpresa: `<circle cx="80" cy="100" r="8" fill="#fff" stroke="#1f2937" stroke-width="2"/><circle cx="120" cy="100" r="8" fill="#fff" stroke="#1f2937" stroke-width="2"/><circle cx="80" cy="100" r="3.5" fill="${olho}"/><circle cx="120" cy="100" r="3.5" fill="${olho}"/>`,
    coracao: `${[80, 120].map(x => `<path d="M${x} 108 L${x - 9} 98 Q${x - 9} 90 ${x - 4} 90 Q${x} 90 ${x} 95 Q${x} 90 ${x + 4} 90 Q${x + 9} 90 ${x + 9} 98Z" fill="#ef4444"/>`).join("")}`,
    piscando: `<circle cx="80" cy="100" r="6" fill="${olho}"/><circle cx="82" cy="98" r="2" fill="#fff"/><path d="M112 101 L128 101" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>`,
    estrela: `${[80, 120].map(x => `<path d="M${x} 90 L${x + 3} 97 L${x + 10} 98 L${x + 5} 103 L${x + 6} 110 L${x} 106 L${x - 6} 110 L${x - 5} 103 L${x - 10} 98 L${x - 3} 97Z" fill="#f59e0b"/>`).join("")}` }[a.olhos] || "";
  const sobr = { normal: `<g stroke="${cab}" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M70 86 Q80 81 90 85"/><path d="M110 85 Q120 81 130 86"/></g>`,
    grossa: `<g stroke="${cab}" stroke-width="6.5" stroke-linecap="round" fill="none"><path d="M70 85 Q80 80 90 84"/><path d="M110 84 Q120 80 130 85"/></g>`,
    arqueada: `<g stroke="${cab}" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M70 88 Q80 76 90 84"/><path d="M110 84 Q120 76 130 88"/></g>`,
    brava: `<g stroke="${cab}" stroke-width="4.5" stroke-linecap="round" fill="none"><path d="M70 82 L90 88"/><path d="M110 88 L130 82"/></g>`, nenhuma: "" }[a.sobrancelha] || "";
  const barba = { nenhuma: "", bigode: `<path d="M84 118 Q92 112 100 117 Q108 112 116 118 Q108 122 100 119 Q92 122 84 118Z" fill="${cab}"/>`,
    cavanhaque: `<path d="M92 134 Q100 150 108 134 Q100 138 92 134Z" fill="${cab}"/><path d="M86 118 Q100 112 114 118" stroke="${cab}" stroke-width="4" fill="none"/>`,
    curta: `<path d="M52 104 Q54 146 100 152 Q146 146 148 104 Q140 130 100 136 Q60 130 52 104Z" fill="${cab}" opacity=".55"/>`,
    cheia: `<path d="M50 100 Q50 156 100 160 Q150 156 150 100 Q142 126 120 128 Q100 120 80 128 Q58 126 50 100Z" fill="${cab}"/><path d="M84 119 Q100 112 116 119" stroke="${cab}" stroke-width="5" fill="none"/>` }[a.barba] || "";
  const detalhe = { nenhum: "", sardas: `<g fill="#b45309" opacity=".5">${[[68, 112], [74, 116], [64, 118], [126, 112], [132, 116], [136, 110]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`).join("")}</g>`,
    pinta: `<circle cx="128" cy="120" r="2.4" fill="#3f2a1d"/>`, corado: `<ellipse cx="70" cy="116" rx="11" ry="6" fill="#f43f5e" opacity=".35"/><ellipse cx="130" cy="116" rx="11" ry="6" fill="#f43f5e" opacity=".35"/>`,
    curativo: `<g transform="rotate(-20 128 116)"><rect x="116" y="111" width="24" height="9" rx="4" fill="#fcd9a8"/><rect x="125" y="111" width="6" height="9" fill="#f5c08a"/></g>`,
    pintura: `<g><rect x="62" y="110" width="14" height="4" fill="${roupa}"/><rect x="62" y="116" width="14" height="4" fill="#fff"/><rect x="124" y="110" width="14" height="4" fill="${roupa}"/><rect x="124" y="116" width="14" height="4" fill="#fff"/></g>`,
    brilho: `<g fill="#fde047">${[[60, 84], [144, 84], [140, 130]].map(([x, y]) => `<path d="M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2}Z"/>`).join("")}</g>` }[a.detalhe] || "";
  const boca = { sorriso: `<path d="M84 124 Q100 138 116 124" stroke="#7f1d1d" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    grande: `<path d="M80 120 Q100 146 120 120Z" fill="#7f1d1d"/><path d="M86 122 Q100 128 114 122" fill="#fff"/>`,
    neutra: `<path d="M88 128 L112 128" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round"/>`,
    lingua: `<path d="M84 122 Q100 136 116 122" stroke="#7f1d1d" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M96 130 Q100 142 106 130Z" fill="#f472b6"/>`,
    lado: `<path d="M88 128 Q104 132 116 120" stroke="#7f1d1d" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    o: `<ellipse cx="100" cy="127" rx="7" ry="9" fill="#7f1d1d"/>`,
    dentes: `<path d="M84 122 Q100 134 116 122" stroke="#7f1d1d" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="94" y="124" width="12" height="9" rx="2" fill="#fff" stroke="#e5e7eb"/>` }[a.boca] || "";
  const corpo = { camiseta: `<path d="M34 200 Q36 160 100 154 Q164 160 166 200Z" fill="${roupa}"/>`,
    moletom: `<path d="M30 200 Q32 156 100 150 Q168 156 170 200Z" fill="${roupa}"/><path d="M70 154 Q100 178 130 154" stroke="#0003" stroke-width="5" fill="none"/><path d="M92 170 L90 196 M108 170 L110 196" stroke="#fff8" stroke-width="3"/>`,
    gola: `<path d="M34 200 Q36 160 100 154 Q164 160 166 200Z" fill="${roupa}"/><path d="M80 156 L100 176 L120 156 L110 154 L100 166 L90 154Z" fill="#fff"/>`,
    jaleco: `<path d="M32 200 Q34 158 100 152 Q166 158 168 200Z" fill="#f8fafc" stroke="#cbd5e1"/><path d="M100 160 L100 200" stroke="#cbd5e1" stroke-width="2"/><path d="M84 154 L100 180 L116 154" fill="${roupa}"/><rect x="118" y="174" width="26" height="10" rx="2" fill="#c1272d"/><text x="131" y="182" font-size="7" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="bold">SENAI</text>`,
    capa: `<path d="M24 200 Q30 150 100 146 Q170 150 176 200Z" fill="#dc2626"/><path d="M40 200 Q42 162 100 156 Q158 162 160 200Z" fill="${roupa}"/><circle cx="100" cy="178" r="11" fill="#fde047"/><text x="100" y="183" font-size="13" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#dc2626">★</text>`,
    terno: `<path d="M32 200 Q34 158 100 152 Q166 158 168 200Z" fill="#111827"/><path d="M86 154 L100 196 L114 154Z" fill="#fff"/><path d="M96 162 L100 158 L104 162 L100 186Z" fill="${roupa}"/>`,
    regata: `<path d="M56 200 Q58 160 78 154 Q100 170 122 154 Q142 160 144 200Z" fill="${roupa}"/>`,
    jaqueta: `<path d="M30 200 Q32 156 100 150 Q168 156 170 200Z" fill="${roupa}"/><path d="M100 158 L100 200" stroke="#0004" stroke-width="3"/><path d="M80 154 L100 172 L120 154" fill="#fff"/><circle cx="92" cy="182" r="2" fill="#0005"/><circle cx="108" cy="182" r="2" fill="#0005"/>`,
    listrada: `<path d="M34 200 Q36 160 100 154 Q164 160 166 200Z" fill="${roupa}"/><g stroke="#fff" stroke-width="5" opacity=".75">${[168, 180, 192].map(y => `<path d="M30 ${y} L170 ${y}"/>`).join("")}</g>`,
    time: `<path d="M34 200 Q36 160 100 154 Q164 160 166 200Z" fill="${roupa}"/><path d="M60 166 L60 200 M140 166 L140 200" stroke="#fff" stroke-width="7"/><text x="100" y="192" font-size="22" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#fff">10</text>`,
    astronauta: `<path d="M28 200 Q30 152 100 146 Q170 152 172 200Z" fill="#e5e7eb" stroke="#94a3b8"/><rect x="82" y="168" width="36" height="22" rx="4" fill="#64748b"/><circle cx="92" cy="179" r="3" fill="#22c55e"/><circle cx="102" cy="179" r="3" fill="#ef4444"/><circle cx="112" cy="179" r="3" fill="#3b82f6"/>` }[a.roupa] || "";
  const acess = { nenhum: "",
    oculos: `<g fill="none" stroke="#111827" stroke-width="3.5"><circle cx="80" cy="100" r="13"/><circle cx="120" cy="100" r="13"/><path d="M93 100 L107 100"/></g>`,
    escuros: `<g><rect x="64" y="90" width="30" height="20" rx="8" fill="#111827"/><rect x="106" y="90" width="30" height="20" rx="8" fill="#111827"/><path d="M94 98 L106 98" stroke="#111827" stroke-width="4"/><path d="M70 94 L80 94" stroke="#fff6" stroke-width="3"/></g>`,
    bone: `<path d="M50 70 Q54 34 100 32 Q146 34 150 70Z" fill="${ac}"/><path d="M100 64 Q150 62 172 74 Q150 80 100 72Z" fill="${ac}" opacity=".85"/><circle cx="100" cy="34" r="5" fill="#0004"/>`,
    fone: `<path d="M46 96 Q46 30 100 30 Q154 30 154 96" fill="none" stroke="#111827" stroke-width="8"/><rect x="36" y="86" width="18" height="30" rx="8" fill="#111827"/><rect x="146" y="86" width="18" height="30" rx="8" fill="#111827"/>`,
    headset: `<path d="M46 96 Q46 30 100 30 Q154 30 154 96" fill="none" stroke="#7c3aed" stroke-width="8"/><rect x="34" y="84" width="20" height="34" rx="9" fill="#7c3aed"/><rect x="146" y="84" width="20" height="34" rx="9" fill="#7c3aed"/><path d="M44 112 Q50 136 80 132" fill="none" stroke="#111827" stroke-width="4"/><circle cx="82" cy="132" r="5" fill="#22d3ee"/>`,
    coroa: `<path d="M62 46 L70 18 L86 38 L100 12 L114 38 L130 18 L138 46Z" fill="#facc15" stroke="#b45309" stroke-width="2"/><circle cx="100" cy="30" r="4" fill="#ef4444"/><circle cx="78" cy="38" r="3" fill="#3b82f6"/><circle cx="122" cy="38" r="3" fill="#22c55e"/>`,
    laco: `<g fill="${ac}"><path d="M120 46 L100 56 L120 66Z" transform="translate(16 -10)"/><path d="M152 46 L172 56 L152 66Z" transform="translate(-16 -10)"/><circle cx="136" cy="46" r="6"/></g>`,
    flor: `<g transform="translate(140 50)">${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-9" rx="6" ry="9" fill="${ac}" transform="rotate(${r})"/>`).join("")}<circle r="5" fill="#fde047"/></g>`,
    faixa: `<rect x="48" y="66" width="104" height="12" rx="4" fill="${ac}"/><path d="M150 70 L172 62 M150 74 L170 84" stroke="${ac}" stroke-width="6" stroke-linecap="round"/>`,
    gorro: `<path d="M50 74 Q50 26 100 24 Q150 26 150 74Z" fill="${ac}"/><rect x="46" y="66" width="108" height="14" rx="7" fill="#fff" opacity=".9"/><circle cx="100" cy="22" r="10" fill="#fff"/>`,
    tiara: `<path d="M56 70 Q100 40 144 70" fill="none" stroke="${ac}" stroke-width="6"/>${[76, 100, 124].map((x, i) => `<circle cx="${x}" cy="${[56, 49, 56][i]}" r="4" fill="#fff"/>`).join("")}`,
    mago: `<path d="M56 64 L100 0 L144 64Z" fill="${ac === "#f8fafc" ? "#4c1d95" : ac}"/><ellipse cx="100" cy="64" rx="56" ry="8" fill="${ac === "#f8fafc" ? "#4c1d95" : ac}"/><text x="100" y="44" font-size="16" text-anchor="middle">⭐</text>`,
    monoculo: `<circle cx="120" cy="100" r="13" fill="none" stroke="#b45309" stroke-width="3.5"/><path d="M132 106 Q140 130 136 150" fill="none" stroke="#b45309" stroke-width="1.5"/>`,
    aureola: `<ellipse cx="100" cy="30" rx="40" ry="9" fill="none" stroke="#facc15" stroke-width="5"/>${[64, 100, 136].map(x => `<text x="${x}" y="22" font-size="14" text-anchor="middle">⭐</text>`).join("")}` }[a.acessorio] || "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${tam}" height="${tam}" role="img" aria-label="Personagem">
    <defs>${grad}<clipPath id="${id}c"><circle cx="100" cy="100" r="98"/></clipPath></defs>
    <g clip-path="url(#${id}c)"><rect width="200" height="200" fill="${fundo.grad ? `url(#${id}g)` : fundo.cor}"/>
      ${fundo.padrao === "bolinhas" ? [20, 60, 100, 140, 180].flatMap(x => [20, 60, 100, 140, 180].map(y => `<circle cx="${x + (y / 20 % 2 ? 20 : 0)}" cy="${y}" r="6" fill="#fff" opacity=".7"/>`)).join("") : ""}
      ${fundo.padrao === "listras" ? [0, 30, 60, 90, 120, 150, 180].map(x => `<rect x="${x}" y="0" width="14" height="200" fill="#fde68a" opacity=".7"/>`).join("") : ""}
      ${fundo.padrao === "codigo" ? ["</>", "{ }", "01", "SQL", "if", "=>", "[]"].map((t, i) => `<text x="${(i * 53) % 180 + 10}" y="${(i * 37) % 170 + 22}" font-size="14" font-family="monospace" fill="#22c55e" opacity=".6">${t}</text>`).join("") : ""}
      ${fundo.id === "galaxia" ? [[30, 40], [160, 30], [150, 150], [40, 160], [100, 20], [175, 95]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff"/>`).join("") : ""}
      ${tras}<rect x="88" y="138" width="24" height="22" fill="${pele}"/><path d="M88 150 Q100 158 112 150 L112 140 L88 140Z" ${sombraCab}/>${corpo}
      <ellipse cx="${100 - rx - 1}" cy="100" rx="8" ry="11" fill="${pele}"/><ellipse cx="${100 + rx + 1}" cy="100" rx="8" ry="11" fill="${pele}"/>
      ${cabeca}<ellipse cx="72" cy="118" rx="9" ry="5" fill="#f87171" opacity=".25"/><ellipse cx="128" cy="118" rx="9" ry="5" fill="#f87171" opacity=".25"/>
      ${detalhe}${barba}${frente}${sobr}${olhos}${boca}${acess}</g>
    ${a.adesivo && a.adesivo !== "nenhum" ? `<circle cx="164" cy="164" r="24" fill="#fff" stroke="#e5e7eb" stroke-width="2"/><text x="164" y="173" font-size="26" text-anchor="middle">${a.adesivo}</text>` : ""}
    ${mold && mold.id !== "nenhuma" ? `<circle cx="100" cy="100" r="95" fill="none" stroke="${mold.cor}" stroke-width="8"/>${mold.id === "diamante" ? `<circle cx="100" cy="100" r="88" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 8"/>` : ""}${mold.id === "fogo" ? `<circle cx="100" cy="100" r="95" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="10 6"/>` : ""}` : ""}
  </svg>`;
}
