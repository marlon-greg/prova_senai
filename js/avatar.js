// Personagem do aluno: desenho em SVG montado por partes (pele, rosto, cabelo, olhos, boca, roupa, acessório, fundo, moldura).
// Algumas partes são SKINS liberadas por conquistas (desbloqueio por número de conquistas ou por uma medalha específica).

export const PELES = ["#f9d7c0", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5c3a1e"];
export const CORES_CABELO = ["#1f1a17", "#4a2c1a", "#8b5a2b", "#d9a441", "#e8d5a3", "#b5482f", "#6b7280", "#2563eb", "#db2777", "#7c3aed"];
export const CORES_ROUPA = ["#c1272d", "#1d4ed8", "#059669", "#111827", "#f59e0b", "#7c3aed", "#db2777", "#0e7490", "#f3f4f6"];

// catálogo: cada item pode ter { trava: { n } (nº de conquistas) ou { medalha: "título" } }
export const CATALOGO = {
  rosto: [{ id: "redondo", nome: "Redondo" }, { id: "oval", nome: "Oval" }, { id: "quadrado", nome: "Quadrado" }],
  cabelo: [{ id: "curto", nome: "Curto" }, { id: "longo", nome: "Longo" }, { id: "cacheado", nome: "Cacheado" }, { id: "black", nome: "Black power" },
    { id: "rabo", nome: "Rabo de cavalo" }, { id: "coque", nome: "Coque" }, { id: "raspado", nome: "Raspado" }, { id: "moicano", nome: "Moicano", trava: { n: 3 } },
    { id: "trancas", nome: "Tranças", trava: { n: 5 } }, { id: "careca", nome: "Careca" }],
  olhos: [{ id: "normal", nome: "Normal" }, { id: "feliz", nome: "Feliz" }, { id: "piscando", nome: "Piscando", trava: { n: 2 } }, { id: "estrela", nome: "Olhos de estrela", trava: { medalha: "Gabaritou!" } }],
  boca: [{ id: "sorriso", nome: "Sorriso" }, { id: "grande", nome: "Sorrisão" }, { id: "neutra", nome: "Tranquila" }, { id: "lingua", nome: "Língua", trava: { n: 4 } }],
  roupa: [{ id: "camiseta", nome: "Camiseta" }, { id: "moletom", nome: "Moletom" }, { id: "gola", nome: "Camisa polo" },
    { id: "jaleco", nome: "Jaleco SENAI", trava: { medalha: "Primeira prova" } }, { id: "capa", nome: "Capa de herói", trava: { medalha: "Fiz sozinha!" } },
    { id: "terno", nome: "Terno de formatura", trava: { medalha: "Veterano" } }],
  acessorio: [{ id: "nenhum", nome: "Nenhum" }, { id: "oculos", nome: "Óculos" }, { id: "bone", nome: "Boné", trava: { n: 1 } },
    { id: "fone", nome: "Fone de ouvido", trava: { n: 3 } }, { id: "escuros", nome: "Óculos escuros", trava: { medalha: "Trinca de ouro" } },
    { id: "headset", nome: "Headset gamer", trava: { n: 8 } }, { id: "coroa", nome: "Coroa", trava: { n: 12 } }, { id: "aureola", nome: "Auréola de estrelas", trava: { medalha: "Chuva de estrelas" } }],
  fundo: [{ id: "azul", nome: "Céu", cor: "#dbeafe" }, { id: "verde", nome: "Menta", cor: "#d1fae5" }, { id: "rosa", nome: "Rosa", cor: "#fce7f3" }, { id: "cinza", nome: "Neutro", cor: "#f1f5f9" },
    { id: "senai", nome: "SENAI", cor: "#c1272d", trava: { n: 2 } }, { id: "por-do-sol", nome: "Pôr do sol", grad: ["#f97316", "#db2777"], trava: { n: 4 } },
    { id: "galaxia", nome: "Galáxia", grad: ["#1e1b4b", "#7c3aed"], trava: { n: 7 } }, { id: "ouro", nome: "Dourado", grad: ["#fde68a", "#f59e0b"], trava: { medalha: "Trinca de ouro" } },
    { id: "arco-iris", nome: "Arco-íris", grad: ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"], trava: { n: 10 } }],
  moldura: [{ id: "nenhuma", nome: "Nenhuma" }, { id: "bronze", nome: "Bronze", cor: "#b45309", trava: { n: 1 } }, { id: "prata", nome: "Prata", cor: "#94a3b8", trava: { n: 5 } },
    { id: "ouro", nome: "Ouro", cor: "#f59e0b", trava: { n: 9 } }, { id: "diamante", nome: "Diamante", cor: "#22d3ee", trava: { n: 15 } }, { id: "fogo", nome: "Fogo", cor: "#ef4444", trava: { medalha: "Em chamas" } }]
};
export const AVATAR_PADRAO = { pele: 1, rosto: "redondo", cabelo: "curto", corCabelo: 1, olhos: "normal", boca: "sorriso", roupa: "camiseta", corRoupa: 0, acessorio: "nenhum", fundo: "azul", moldura: "nenhuma" };

// item liberado? ganhas = títulos das conquistas ganhas
export function liberado(item, ganhas) {
  if (!item?.trava) return true;
  if (item.trava.n) return ganhas.length >= item.trava.n;
  return ganhas.includes(item.trava.medalha);
}
export const textoTrava = t => !t ? "" : t.n ? `🔒 ${t.n} conquista(s)` : `🔒 medalha “${t.medalha}”`;
// troca o que estiver travado pelo padrão (ex.: perdeu a medalha ou o perfil veio de outro lugar)
export function avatarValido(a, ganhas) {
  const v = { ...AVATAR_PADRAO, ...(a || {}) };
  for (const parte of Object.keys(CATALOGO)) { const it = CATALOGO[parte].find(x => x.id === v[parte]); if (!it || !liberado(it, ganhas)) v[parte] = AVATAR_PADRAO[parte]; }
  v.pele = Math.max(0, Math.min(PELES.length - 1, Number(v.pele) || 0)); v.corCabelo = Math.max(0, Math.min(CORES_CABELO.length - 1, Number(v.corCabelo) || 0));
  v.corRoupa = Math.max(0, Math.min(CORES_ROUPA.length - 1, Number(v.corRoupa) || 0));
  return v;
}

let seq = 0;
export function svgAvatar(av, tam = 200) {
  const a = { ...AVATAR_PADRAO, ...(av || {}) }, id = "av" + (++seq);
  const pele = PELES[a.pele] || PELES[1], cab = CORES_CABELO[a.corCabelo] || CORES_CABELO[1], roupa = CORES_ROUPA[a.corRoupa] || CORES_ROUPA[0];
  const fundo = CATALOGO.fundo.find(f => f.id === a.fundo) || CATALOGO.fundo[0], mold = CATALOGO.moldura.find(m => m.id === a.moldura);
  const rx = { redondo: 50, oval: 45, quadrado: 50 }[a.rosto] || 50, ry = { redondo: 54, oval: 60, quadrado: 52 }[a.rosto] || 54;
  const cabeca = a.rosto === "quadrado" ? `<rect x="${100 - rx}" y="${96 - ry}" width="${rx * 2}" height="${ry * 2}" rx="26" fill="${pele}"/>` : `<ellipse cx="100" cy="96" rx="${rx}" ry="${ry}" fill="${pele}"/>`;
  const grad = fundo.grad ? `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">${fundo.grad.map((c, i) => `<stop offset="${i / (fundo.grad.length - 1)}" stop-color="${c}"/>`).join("")}</linearGradient>` : "";
  const sombraCab = `opacity=".18" fill="#000"`;
  // cabelo atrás da cabeça (longo, tranças, rabo)
  const tras = { longo: `<path d="M44 92 Q42 40 100 34 Q158 40 156 92 L162 170 Q100 182 38 170Z" fill="${cab}"/>`,
    trancas: `<path d="M48 90 Q46 42 100 36 Q154 42 152 90 L150 150 Q100 160 50 150Z" fill="${cab}"/><g fill="${cab}">${[0, 1, 2, 3].map(i => `<ellipse cx="56" cy="${150 + i * 11}" rx="9" ry="7"/><ellipse cx="144" cy="${150 + i * 11}" rx="9" ry="7"/>`).join("")}</g>`,
    rabo: `<path d="M140 70 Q178 92 160 150 Q150 128 146 100Z" fill="${cab}"/>`, black: `<circle cx="100" cy="78" r="70" fill="${cab}"/>`,
    cacheado: `<g fill="${cab}">${[[50, 70], [62, 46], [86, 34], [114, 34], [138, 46], [150, 70], [46, 96], [154, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20"/>`).join("")}</g>` }[a.cabelo] || "";
  const frente = { curto: `<path d="M48 84 Q50 40 100 38 Q150 40 152 84 Q134 62 100 62 Q66 62 48 84Z" fill="${cab}"/>`,
    longo: `<path d="M48 90 Q50 40 100 38 Q150 40 152 90 Q132 58 100 60 Q70 60 48 90Z" fill="${cab}"/>`,
    cacheado: `<path d="M52 80 Q60 50 100 48 Q140 50 148 80 Q126 64 100 66 Q74 64 52 80Z" fill="${cab}"/>`,
    black: `<path d="M50 84 Q56 52 100 50 Q144 52 150 84 Q128 70 100 70 Q72 70 50 84Z" fill="${cab}"/>`,
    rabo: `<path d="M48 84 Q50 40 100 38 Q150 40 152 84 Q130 60 100 60 Q70 60 48 84Z" fill="${cab}"/>`,
    coque: `<circle cx="100" cy="34" r="20" fill="${cab}"/><path d="M48 84 Q50 44 100 42 Q150 44 152 84 Q130 62 100 62 Q70 62 48 84Z" fill="${cab}"/>`,
    raspado: `<path d="M50 80 Q52 44 100 42 Q148 44 150 80 Q128 62 100 62 Q72 62 50 80Z" fill="${cab}" opacity=".45"/>`,
    moicano: `<path d="M86 66 L90 22 L100 30 L110 22 L114 66Z" fill="${cab}"/><path d="M50 80 Q52 46 100 44 Q148 46 150 80" fill="none" stroke="${cab}" stroke-width="3" opacity=".4"/>`,
    trancas: `<path d="M48 86 Q50 42 100 40 Q150 42 152 86 Q130 62 100 62 Q70 62 48 86Z" fill="${cab}"/><path d="M100 40 L100 62" stroke="#0003" stroke-width="2"/>`,
    careca: `<ellipse cx="82" cy="58" rx="12" ry="6" fill="#fff" opacity=".35"/>` }[a.cabelo] || "";
  const olhos = { normal: `<circle cx="80" cy="100" r="6" fill="#1f2937"/><circle cx="120" cy="100" r="6" fill="#1f2937"/><circle cx="82" cy="98" r="2" fill="#fff"/><circle cx="122" cy="98" r="2" fill="#fff"/>`,
    feliz: `<path d="M72 102 Q80 92 88 102" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M112 102 Q120 92 128 102" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    piscando: `<circle cx="80" cy="100" r="6" fill="#1f2937"/><circle cx="82" cy="98" r="2" fill="#fff"/><path d="M112 101 L128 101" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>`,
    estrela: `${[80, 120].map(x => `<path d="M${x} 90 L${x + 3} 97 L${x + 10} 98 L${x + 5} 103 L${x + 6} 110 L${x} 106 L${x - 6} 110 L${x - 5} 103 L${x - 10} 98 L${x - 3} 97Z" fill="#f59e0b"/>`).join("")}` }[a.olhos] || "";
  const boca = { sorriso: `<path d="M84 124 Q100 138 116 124" stroke="#7f1d1d" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    grande: `<path d="M80 120 Q100 146 120 120Z" fill="#7f1d1d"/><path d="M86 122 Q100 128 114 122" fill="#fff"/>`,
    neutra: `<path d="M88 128 L112 128" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round"/>`,
    lingua: `<path d="M84 122 Q100 136 116 122" stroke="#7f1d1d" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M96 130 Q100 142 106 130Z" fill="#f472b6"/>` }[a.boca] || "";
  const corpo = { camiseta: `<path d="M34 200 Q36 160 100 154 Q164 160 166 200Z" fill="${roupa}"/>`,
    moletom: `<path d="M30 200 Q32 156 100 150 Q168 156 170 200Z" fill="${roupa}"/><path d="M70 154 Q100 178 130 154" stroke="#0003" stroke-width="5" fill="none"/><path d="M92 170 L90 196 M108 170 L110 196" stroke="#fff8" stroke-width="3"/>`,
    gola: `<path d="M34 200 Q36 160 100 154 Q164 160 166 200Z" fill="${roupa}"/><path d="M80 156 L100 176 L120 156 L110 154 L100 166 L90 154Z" fill="#fff"/>`,
    jaleco: `<path d="M32 200 Q34 158 100 152 Q166 158 168 200Z" fill="#f8fafc" stroke="#cbd5e1"/><path d="M100 160 L100 200" stroke="#cbd5e1" stroke-width="2"/><path d="M84 154 L100 180 L116 154" fill="${roupa}"/><rect x="118" y="174" width="26" height="10" rx="2" fill="#c1272d"/><text x="131" y="182" font-size="7" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="bold">SENAI</text>`,
    capa: `<path d="M24 200 Q30 150 100 146 Q170 150 176 200Z" fill="#dc2626"/><path d="M40 200 Q42 162 100 156 Q158 162 160 200Z" fill="${roupa}"/><circle cx="100" cy="178" r="11" fill="#fde047"/><text x="100" y="183" font-size="13" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#dc2626">★</text>`,
    terno: `<path d="M32 200 Q34 158 100 152 Q166 158 168 200Z" fill="#111827"/><path d="M86 154 L100 196 L114 154Z" fill="#fff"/><path d="M96 162 L100 158 L104 162 L100 186Z" fill="${roupa}"/>` }[a.roupa] || "";
  const acess = { nenhum: "",
    oculos: `<g fill="none" stroke="#111827" stroke-width="3.5"><circle cx="80" cy="100" r="13"/><circle cx="120" cy="100" r="13"/><path d="M93 100 L107 100"/></g>`,
    escuros: `<g><rect x="64" y="90" width="30" height="20" rx="8" fill="#111827"/><rect x="106" y="90" width="30" height="20" rx="8" fill="#111827"/><path d="M94 98 L106 98" stroke="#111827" stroke-width="4"/><path d="M70 94 L80 94" stroke="#fff6" stroke-width="3"/></g>`,
    bone: `<path d="M50 70 Q54 34 100 32 Q146 34 150 70Z" fill="${roupa}"/><path d="M100 64 Q150 62 172 74 Q150 80 100 72Z" fill="${roupa}" opacity=".85"/><circle cx="100" cy="34" r="5" fill="#0004"/>`,
    fone: `<path d="M46 96 Q46 30 100 30 Q154 30 154 96" fill="none" stroke="#111827" stroke-width="8"/><rect x="36" y="86" width="18" height="30" rx="8" fill="#111827"/><rect x="146" y="86" width="18" height="30" rx="8" fill="#111827"/>`,
    headset: `<path d="M46 96 Q46 30 100 30 Q154 30 154 96" fill="none" stroke="#7c3aed" stroke-width="8"/><rect x="34" y="84" width="20" height="34" rx="9" fill="#7c3aed"/><rect x="146" y="84" width="20" height="34" rx="9" fill="#7c3aed"/><path d="M44 112 Q50 136 80 132" fill="none" stroke="#111827" stroke-width="4"/><circle cx="82" cy="132" r="5" fill="#22d3ee"/>`,
    coroa: `<path d="M62 46 L70 18 L86 38 L100 12 L114 38 L130 18 L138 46Z" fill="#facc15" stroke="#b45309" stroke-width="2"/><circle cx="100" cy="30" r="4" fill="#ef4444"/><circle cx="78" cy="38" r="3" fill="#3b82f6"/><circle cx="122" cy="38" r="3" fill="#22c55e"/>`,
    aureola: `<ellipse cx="100" cy="30" rx="40" ry="9" fill="none" stroke="#facc15" stroke-width="5"/>${[64, 100, 136].map(x => `<text x="${x}" y="22" font-size="14" text-anchor="middle">⭐</text>`).join("")}` }[a.acessorio] || "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${tam}" height="${tam}" role="img" aria-label="Personagem">
    <defs>${grad}<clipPath id="${id}c"><circle cx="100" cy="100" r="98"/></clipPath></defs>
    <g clip-path="url(#${id}c)"><rect width="200" height="200" fill="${fundo.grad ? `url(#${id}g)` : fundo.cor}"/>
      ${fundo.id === "galaxia" ? [[30, 40], [160, 30], [150, 150], [40, 160], [100, 20], [175, 95]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff"/>`).join("") : ""}
      ${tras}<rect x="88" y="138" width="24" height="22" fill="${pele}"/><path d="M88 150 Q100 158 112 150 L112 140 L88 140Z" ${sombraCab}/>${corpo}
      <ellipse cx="${100 - rx - 1}" cy="100" rx="8" ry="11" fill="${pele}"/><ellipse cx="${100 + rx + 1}" cy="100" rx="8" ry="11" fill="${pele}"/>
      ${cabeca}<ellipse cx="72" cy="118" rx="9" ry="5" fill="#f87171" opacity=".25"/><ellipse cx="128" cy="118" rx="9" ry="5" fill="#f87171" opacity=".25"/>
      ${frente}${olhos}${boca}${acess}</g>
    ${mold && mold.id !== "nenhuma" ? `<circle cx="100" cy="100" r="95" fill="none" stroke="${mold.cor}" stroke-width="8"/>${mold.id === "diamante" ? `<circle cx="100" cy="100" r="88" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 8"/>` : ""}${mold.id === "fogo" ? `<circle cx="100" cy="100" r="95" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="10 6"/>` : ""}` : ""}
  </svg>`;
}
