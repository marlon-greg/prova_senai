// Catálogo de acessórios dos mascotes, por encaixe (dá para usar um de cada encaixe ao mesmo tempo).
// Coordenadas do desenho: 200 x 220 (olhos em y=98, x=77 e 123; rosto de x=40 a 160; pescoço em y=170).
// Cada desenho recebe k = { c (cor), cs (cor escura), cl (cor clara), t(d) = forma com contorno, OUT, SW, estrela }.

// ancora: centro para mover/aumentar · vb: recorte da miniatura · tras: desenhado atrás do corpo
export const ENCAIXES = {
  cabeca:      { nome: "Cabeça", icone: "🎩", ancora: [100, 40], vb: "10 -24 180 110" },
  rosto:       { nome: "Rosto", icone: "👓", ancora: [100, 100], vb: "30 60 140 90" },
  ouvido:      { nome: "Orelhas", icone: "🎧", ancora: [100, 105], vb: "10 0 180 150" },
  pescoco:     { nome: "Pescoço", icone: "👔", ancora: [100, 178], vb: "40 150 120 80" },
  peito:       { nome: "Peito", icone: "📛", ancora: [128, 196], vb: "85 165 90 60" },
  costas:      { nome: "Costas", icone: "🎒", ancora: [100, 150], vb: "-10 40 220 190", tras: true },
  companheiro: { nome: "Companheiro", icone: "🦜", ancora: [34, 150], vb: "0 105 70 70" },
  efeito:      { nome: "Efeitos", icone: "✨", ancora: [100, 60], vb: "0 -10 200 130" },
  roupa:       { nome: "Roupa", icone: "👕", ancora: [100, 196], vb: "0 140 200 90" }
};

const circ = (x, y, r, fill, k, sw = 2.4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${k.OUT}" stroke-width="${sw}"/>`;
const linha = (d, cor, w) => `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const contornada = (d, cor, w, k) => linha(d, k.OUT, w + 5) + linha(d, cor, w);
const lente = (x, y, rx, ry, fill, k) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${k.OUT}" stroke-width="3.4"/>`;
const hastes = k => linha("M61 95 L42 92 M139 95 L158 92", k.OUT, 3.4);
const ponte = (k, cor) => linha("M93 96 Q100 92 107 96", cor || k.OUT, 3.4);
const coracao = (x, y, s, cor, k) => `<path d="M${x} ${y + 7 * s} C${x - 11 * s} ${y - 2 * s} ${x - 6 * s} ${y - 9 * s} ${x} ${y - 3 * s} C${x + 6 * s} ${y - 9 * s} ${x + 11 * s} ${y - 2 * s} ${x} ${y + 7 * s} Z" fill="${cor}" stroke="${k.OUT}" stroke-width="2.2" stroke-linejoin="round"/>`;
const nota = (x, y, cor, k) => `<path d="M${x} ${y} L${x} ${y - 16} L${x + 10} ${y - 19} L${x + 10} ${y - 4}" fill="none" stroke="${k.OUT}" stroke-width="2.6" stroke-linejoin="round"/>${circ(x - 3, y, 4, cor, k, 2)}${circ(x + 7, y - 4, 4, cor, k, 2)}`;
const raio = (x, y, cor, k) => `<path d="M${x} ${y} l-7 13 h6 l-3 11 l11 -15 h-6 l4 -9 Z" fill="${cor}" stroke="${k.OUT}" stroke-width="2.2" stroke-linejoin="round"/>`;

// [id, nome, encaixe, desenho, cor sugerida (opcional)]
const L = [
  // ---------- cabeça ----------
  ["bone", "Boné", "cabeca", k => k.t("M36 66 C36 24 64 8 100 8 C136 8 164 24 164 66 C140 56 120 54 100 54 C80 54 60 56 36 66 Z") + k.t("M100 56 C132 52 162 56 186 70 C172 80 150 76 132 70 C120 66 110 64 100 62 Z") + circ(100, 10, 5, k.cs, k, 2) + linha("M100 12 L100 52 M70 18 L76 56 M130 18 L124 56", k.cs, 2)],
  ["bone-tras", "Boné para trás", "cabeca", k => k.t("M36 66 C36 24 64 8 100 8 C136 8 164 24 164 66 C140 58 120 56 100 56 C80 56 60 58 36 66 Z") + circ(100, 10, 5, k.cs, k, 2) + `<path d="M84 56 Q100 40 116 56 Z" fill="#f3d9c0" stroke="${k.OUT}" stroke-width="2.6"/>` + linha("M70 18 L76 54 M130 18 L124 54", k.cs, 2)],
  ["gorro", "Gorro", "cabeca", k => k.t("M34 70 C34 20 64 2 100 2 C136 2 166 20 166 70 Z") + `<rect x="30" y="56" width="140" height="20" rx="10" fill="${k.cl}" stroke="${k.OUT}" stroke-width="${k.SW}"/>` + circ(100, 0, 12, k.cl, k, k.SW)],
  ["cartola", "Cartola", "cabeca", k => k.t("M62 56 L66 -8 L134 -8 L138 56 Z") + `<rect x="62" y="38" width="76" height="12" fill="${k.cl}"/>` + k.t("M30 62 Q100 44 170 62 Q100 74 30 62 Z"), "#111827"],
  ["capelo", "Capelo de formatura", "cabeca", k => k.t("M58 40 L58 62 Q100 76 142 62 L142 40 Z") + k.t("M100 8 L182 38 L100 62 L18 38 Z") + linha("M100 36 L160 50 L160 72", "#f59e0b", 3) + circ(160, 74, 4, "#f59e0b", k, 2), "#111827"],
  ["coroa", "Coroa", "cabeca", k => k.t("M50 58 L42 12 L72 34 L100 2 L128 34 L158 12 L150 58 Q100 68 50 58 Z") + circ(100, 20, 5, "#ef4444", k, 2) + circ(66, 42, 4, "#3b82f6", k, 2) + circ(134, 42, 4, "#10b981", k, 2), "#f59e0b"],
  ["tiara", "Tiara", "cabeca", k => contornada("M44 66 Q100 18 156 66", k.c, 6, k) + `<path d="M84 40 L92 22 L100 36 L108 22 L116 40 Z" fill="${k.c}" stroke="${k.OUT}" stroke-width="2.6" stroke-linejoin="round"/>` + circ(100, 34, 4, "#f8fafc", k, 2), "#db2777"],
  ["bandana", "Bandana", "cabeca", k => k.t("M38 66 C42 26 70 12 100 12 C130 12 158 26 162 66 C130 52 70 52 38 66 Z") + k.t("M160 58 L186 48 L180 66 L190 80 L164 70 Z") + circ(80, 34, 3, "#fff", k, 0) + circ(104, 26, 3, "#fff", k, 0) + circ(126, 38, 3, "#fff", k, 0)],
  ["faixa", "Faixa de cabeça", "cabeca", k => k.t("M38 58 Q100 36 162 58 L160 74 Q100 54 40 74 Z") + linha("M46 60 Q100 42 154 60", k.cl, 2)],
  ["mago", "Chapéu de mago", "cabeca", k => k.t("M52 56 C72 40 94 8 118 -22 C122 6 136 34 148 56 Z") + k.estrela(104, 28, 7, "#facc15") + k.estrela(124, 8, 4, "#facc15") + k.t("M28 62 Q100 42 172 62 Q100 76 28 62 Z"), "#7c3aed"],
  ["capacete", "Capacete de obra", "cabeca", k => k.t("M42 60 C42 20 70 6 100 6 C130 6 158 20 158 60 Z") + `<rect x="92" y="6" width="16" height="50" rx="6" fill="${k.cl}" stroke="${k.OUT}" stroke-width="2.6"/>` + k.t("M30 58 L170 58 Q174 70 164 70 L36 70 Q26 70 30 58 Z"), "#f59e0b"],
  ["chef", "Chapéu de chef", "cabeca", k => `<path d="M54 56 L54 30 C34 26 36 -4 62 2 C68 -16 92 -18 100 -4 C110 -18 134 -16 138 2 C164 -4 166 26 146 30 L146 56 Z" fill="${k.cl}" stroke="${k.OUT}" stroke-width="${k.SW}" stroke-linejoin="round"/>` + linha("M78 28 L78 50 M100 26 L100 50 M122 28 L122 50", "#cbd5e1", 2), "#f8fafc"],
  ["boina", "Boina", "cabeca", k => k.t("M34 58 C26 22 66 6 104 8 C146 10 176 30 164 54 C150 64 60 66 34 58 Z") + circ(104, 8, 4, k.cs, k, 2) + `<rect x="42" y="54" width="116" height="10" rx="5" fill="${k.cs}" stroke="${k.OUT}" stroke-width="2.6"/>`],
  ["festa", "Chapéu de festa", "cabeca", k => k.t("M66 58 L102 -14 L138 58 Q102 70 66 58 Z") + linha("M84 24 L122 30 M74 44 L132 50", k.cl, 4) + circ(102, -16, 7, "#facc15", k, 2.4), "#db2777"],
  ["cowboy", "Chapéu de caubói", "cabeca", k => k.t("M60 54 C60 14 72 4 88 12 C96 18 104 18 112 12 C128 4 140 14 140 54 Z") + k.t("M16 44 C34 64 68 66 100 66 C132 66 166 64 184 44 C176 74 130 80 100 80 C70 80 24 74 16 44 Z") + linha("M60 52 Q100 62 140 52", k.cl, 5), "#92400e"],
  ["palha", "Chapéu de palha", "cabeca", k => k.t("M60 52 C60 20 78 10 100 10 C122 10 140 20 140 52 Z") + k.t("M18 58 Q100 40 182 58 Q100 78 18 58 Z") + linha("M60 50 Q100 60 140 50", "#c1272d", 6), "#eab308"],
  ["viseira", "Viseira", "cabeca", k => k.t("M40 56 Q100 36 160 56 L158 68 Q100 50 42 68 Z") + k.t("M52 64 Q100 50 148 64 Q152 84 100 78 Q48 84 52 64 Z")],
  ["pirata", "Chapéu de pirata", "cabeca", k => k.t("M22 58 C40 44 56 8 100 6 C144 8 160 44 178 58 C150 68 50 68 22 58 Z") + circ(100, 34, 9, "#f8fafc", k, 2) + linha("M90 48 L110 54 M110 48 L90 54", "#f8fafc", 3), "#111827"],
  ["viking", "Capacete viking", "cabeca", k => `<path d="M44 48 C22 40 18 16 28 4 C32 22 44 30 60 32 Z M156 48 C178 40 182 16 172 4 C168 22 156 30 140 32 Z" fill="#f8fafc" stroke="${k.OUT}" stroke-width="${k.SW}" stroke-linejoin="round"/>` + k.t("M42 62 C42 22 70 8 100 8 C130 8 158 22 158 62 Z") + `<rect x="38" y="52" width="124" height="14" rx="6" fill="${k.cs}" stroke="${k.OUT}" stroke-width="2.6"/>`, "#64748b"],
  ["gato", "Orelhas de gato", "cabeca", k => contornada("M44 62 Q100 14 156 62", k.c, 5, k) + k.t("M50 44 L46 8 L82 26 Z") + k.t("M150 44 L154 8 L118 26 Z") + `<path d="M56 36 L54 18 L72 28 Z M144 36 L146 18 L128 28 Z" fill="#fda4af"/>`, "#111827"],
  ["coelho", "Orelhas de coelho", "cabeca", k => contornada("M44 62 Q100 14 156 62", k.c, 5, k) + k.t("M62 32 C46 2 52 -30 66 -30 C80 -30 84 2 80 26 Z") + k.t("M138 32 C154 2 148 -30 134 -30 C120 -30 116 2 120 26 Z") + `<path d="M66 20 C58 2 60 -18 66 -18 C72 -18 74 2 72 18 Z M134 20 C142 2 140 -18 134 -18 C128 -18 126 2 128 18 Z" fill="#fda4af"/>`, "#f8fafc"],
  ["aureola", "Auréola", "cabeca", k => `<ellipse cx="100" cy="0" rx="40" ry="10" fill="none" stroke="${k.OUT}" stroke-width="9"/><ellipse cx="100" cy="0" rx="40" ry="10" fill="none" stroke="${k.c}" stroke-width="4.6"/>`, "#facc15"],
  ["antena", "Antena de robô", "cabeca", k => contornada("M44 62 Q100 14 156 62", "#64748b", 5, k) + linha("M100 34 L100 2", k.OUT, 5) + circ(100, -4, 8, k.c, k) + `<path d="M78 -6 Q70 -4 72 8 M122 -6 Q130 -4 128 8" fill="none" stroke="${k.c}" stroke-width="2.4" stroke-linecap="round"/>`],
  ["laco", "Laço", "cabeca", k => k.t("M124 34 L96 16 L96 52 Z") + k.t("M124 34 L152 16 L152 52 Z") + circ(124, 34, 7, k.cs, k), "#db2777"],
  ["flor", "Flor no cabelo", "cabeca", k => [0, 72, 144, 216, 288].map(a => `<circle cx="136" cy="26" r="9" fill="${k.c}" stroke="${k.OUT}" stroke-width="2.2" transform="rotate(${a} 136 40)"/>`).join("") + circ(136, 40, 7, "#facc15", k, 2.2), "#db2777"],
  ["noel", "Gorro de Natal", "cabeca", k => k.t("M42 60 C40 18 80 -6 118 2 C150 8 166 26 176 56 C160 42 150 36 142 34 C150 44 156 52 158 60 Z") + circ(178, 60, 10, "#f8fafc", k) + `<rect x="34" y="50" width="128" height="20" rx="10" fill="#f8fafc" stroke="${k.OUT}" stroke-width="${k.SW}"/>`, "#c1272d"],
  ["astronauta", "Capacete de astronauta", "cabeca", k => `<path d="M100 -10 C160 -10 186 40 182 100 C180 146 150 168 100 168 C50 168 20 146 18 100 C14 40 40 -10 100 -10 Z" fill="#bae6fd" fill-opacity=".22" stroke="${k.OUT}" stroke-width="5"/>` + linha("M38 66 Q50 22 92 8", "#fff", 5) + k.t("M42 158 Q100 186 158 158 L164 176 Q100 202 36 176 Z"), "#f8fafc"],

  // ---------- rosto ----------
  ["redondo", "Óculos redondos", "rosto", k => hastes(k) + lente(77, 97, 16, 16, "rgba(186,230,253,.28)", k) + lente(123, 97, 16, 16, "rgba(186,230,253,.28)", k) + ponte(k), "#111827"],
  ["quadrado", "Óculos quadrados", "rosto", k => hastes(k) + `<rect x="59" y="84" width="34" height="27" rx="5" fill="rgba(186,230,253,.28)" stroke="${k.c}" stroke-width="4"/><rect x="107" y="84" width="34" height="27" rx="5" fill="rgba(186,230,253,.28)" stroke="${k.c}" stroke-width="4"/>` + ponte(k, k.c), "#111827"],
  ["sol", "Óculos escuros", "rosto", k => hastes(k) + `<path d="M58 86 L94 86 Q95 110 77 111 Q58 110 58 86 Z M106 86 L142 86 Q142 110 123 111 Q105 110 106 86 Z" fill="${k.c}" stroke="${k.OUT}" stroke-width="3.4" stroke-linejoin="round"/>` + ponte(k) + linha("M66 92 L74 100 M114 92 L122 100", "#fff", 2.4), "#111827"],
  ["aviador", "Óculos aviador", "rosto", k => hastes(k) + `<path d="M58 88 Q76 82 92 88 Q96 110 76 112 Q56 110 58 88 Z M108 88 Q124 82 142 88 Q144 110 124 112 Q104 110 108 88 Z" fill="${k.c}" fill-opacity=".85" stroke="#b08d3c" stroke-width="3"/>` + linha("M92 90 L108 90", "#b08d3c", 3), "#475569"],
  ["3d", "Óculos 3D", "rosto", k => hastes(k) + `<rect x="56" y="84" width="88" height="28" rx="4" fill="#f8fafc" stroke="${k.OUT}" stroke-width="3.4"/><rect x="62" y="89" width="30" height="18" rx="2" fill="#ef4444" fill-opacity=".8"/><rect x="108" y="89" width="30" height="18" rx="2" fill="#22d3ee" fill-opacity=".8"/>`],
  ["coracao", "Óculos de coração", "rosto", k => hastes(k) + coracao(77, 97, 2, k.c, k) + coracao(123, 97, 2, k.c, k) + ponte(k), "#db2777"],
  ["estrelas-o", "Óculos de estrela", "rosto", k => hastes(k) + k.estrela(77, 97, 19, k.c) + k.estrela(123, 97, 19, k.c) + ponte(k), "#f59e0b"],
  ["nerd", "Óculos de nerd", "rosto", k => hastes(k) + lente(77, 97, 17, 15, "rgba(255,255,255,.3)", k) + lente(123, 97, 17, 15, "rgba(255,255,255,.3)", k) + `<rect x="92" y="90" width="16" height="11" rx="2" fill="#f8fafc" stroke="${k.OUT}" stroke-width="2.4"/>`],
  ["monoculo", "Monóculo", "rosto", k => lente(123, 97, 16, 16, "rgba(186,230,253,.28)", k) + linha("M136 108 Q150 130 142 160", "#b08d3c", 2)],
  ["tapa", "Tapa-olho", "rosto", k => linha("M46 74 L154 106", k.OUT, 4) + `<path d="M108 84 L140 84 Q142 110 124 112 Q106 110 108 84 Z" fill="${k.c}" stroke="${k.OUT}" stroke-width="3"/>`, "#111827"],
  ["heroi", "Máscara de herói", "rosto", k => `<path d="M46 86 C60 76 86 78 100 90 C114 78 140 76 154 86 C156 104 142 116 122 114 C112 112 106 106 100 104 C94 106 88 112 78 114 C58 116 44 104 46 86 Z M62 92 C60 104 90 106 90 96 C86 90 68 86 62 92 Z M138 92 C140 104 110 106 110 96 C114 90 132 86 138 92 Z" fill="${k.c}" fill-rule="evenodd" stroke="${k.OUT}" stroke-width="3" stroke-linejoin="round"/>`],
  ["visor", "Visor futurista", "rosto", k => hastes(k) + `<path d="M48 84 L152 84 Q156 110 138 112 L62 112 Q44 110 48 84 Z" fill="${k.c}" fill-opacity=".75" stroke="${k.OUT}" stroke-width="3.4" stroke-linejoin="round"/>` + linha("M58 92 L100 92", "#fff", 2.6), "#0e7490"],
  ["palhaco", "Nariz de palhaço", "rosto", k => circ(100, 116, 11, k.c, k) + `<circle cx="96" cy="112" r="3" fill="#fff" opacity=".8"/>`],
  ["bigode", "Bigode de mentira", "rosto", k => `<path d="M100 124 C90 116 74 118 62 132 C76 130 88 134 100 130 C112 134 124 130 138 132 C126 118 110 116 100 124 Z" fill="${k.c}" stroke="${k.OUT}" stroke-width="2.4" stroke-linejoin="round"/>`, "#111827"],
  ["mascara-h", "Máscara cirúrgica", "rosto", k => `<path d="M60 112 Q100 104 140 112 L138 142 Q100 160 62 142 Z" fill="${k.c}" stroke="${k.OUT}" stroke-width="3" stroke-linejoin="round"/>` + linha("M62 120 L42 104 M138 120 L158 104 M70 122 Q100 116 130 122 M70 132 Q100 126 130 132", "#94a3b8", 2), "#bae6fd"],

  // ---------- orelhas ----------
  ["fone", "Fone de ouvido", "ouvido", k => contornada("M34 104 C30 30 66 6 100 6 C134 6 170 30 166 104", k.c, 7, k) + `<rect x="22" y="88" width="24" height="38" rx="11" fill="${k.c}" stroke="${k.OUT}" stroke-width="${k.SW}"/><rect x="154" y="88" width="24" height="38" rx="11" fill="${k.c}" stroke="${k.OUT}" stroke-width="${k.SW}"/>`],
  ["headset", "Headset com microfone", "ouvido", k => contornada("M34 104 C30 30 66 6 100 6 C134 6 170 30 166 104", k.c, 7, k) + `<rect x="24" y="90" width="20" height="34" rx="9" fill="${k.c}" stroke="${k.OUT}" stroke-width="${k.SW}"/><rect x="156" y="90" width="20" height="34" rx="9" fill="${k.c}" stroke="${k.OUT}" stroke-width="${k.SW}"/>` + contornada("M38 124 Q44 146 72 146", k.cs, 2.4, k) + circ(76, 146, 5, k.cs, k), "#111827"],
  ["argola", "Brincos de argola", "ouvido", k => `<circle cx="36" cy="128" r="10" fill="none" stroke="${k.OUT}" stroke-width="6"/><circle cx="36" cy="128" r="10" fill="none" stroke="${k.c}" stroke-width="3"/><circle cx="164" cy="128" r="10" fill="none" stroke="${k.OUT}" stroke-width="6"/><circle cx="164" cy="128" r="10" fill="none" stroke="${k.c}" stroke-width="3"/>`, "#f59e0b"],
  ["brinco-e", "Brincos de estrela", "ouvido", k => k.estrela(36, 126, 9, k.c) + k.estrela(164, 126, 9, k.c), "#f59e0b"],
  ["lapis", "Lápis na orelha", "ouvido", k => `<g transform="rotate(-24 162 86)"><rect x="132" y="80" width="46" height="11" fill="${k.c}" stroke="${k.OUT}" stroke-width="2.4"/><path d="M178 80 L190 85.5 L178 91 Z" fill="#f3d9c0" stroke="${k.OUT}" stroke-width="2.4" stroke-linejoin="round"/><rect x="124" y="80" width="9" height="11" rx="2" fill="#fda4af" stroke="${k.OUT}" stroke-width="2.4"/></g>`, "#facc15"],
  ["sem-fio", "Fone sem fio", "ouvido", k => `<rect x="30" y="96" width="14" height="24" rx="7" fill="${k.c}" stroke="${k.OUT}" stroke-width="2.6"/><rect x="156" y="96" width="14" height="24" rx="7" fill="${k.c}" stroke="${k.OUT}" stroke-width="2.6"/>`, "#f8fafc"],

  // ---------- pescoço ----------
  ["gravata", "Gravata-borboleta", "pescoco", k => `<path d="M100 178 L80 166 L80 190 Z M100 178 L120 166 L120 190 Z" fill="${k.c}" stroke="${k.OUT}" stroke-width="2.6" stroke-linejoin="round"/>` + circ(100, 178, 6, k.cs, k)],
  ["gravata-l", "Gravata", "pescoco", k => k.t("M90 170 L110 170 L106 184 L116 216 L100 226 L84 216 L94 184 Z") + linha("M92 184 L108 184", k.cs, 2.4)],
  ["cachecol", "Cachecol", "pescoco", k => k.t("M62 164 Q100 186 138 164 L142 182 Q100 204 58 182 Z") + k.t("M112 190 L134 186 L138 226 L114 226 Z") + linha("M60 174 Q100 196 140 174", k.cl, 3)],
  ["perolas", "Colar de pérolas", "pescoco", k => [[72, 174], [80, 181], [89, 186], [100, 188], [111, 186], [120, 181], [128, 174]].map(([x, y]) => circ(x, y, 5, k.c, k, 2)).join(""), "#f8fafc"],
  ["corrente", "Corrente", "pescoco", k => `<path d="M70 168 Q100 208 130 168" fill="none" stroke="${k.OUT}" stroke-width="6"/><path d="M70 168 Q100 208 130 168" fill="none" stroke="${k.c}" stroke-width="3" stroke-dasharray="5 3"/>` + circ(100, 194, 7, k.c, k), "#f59e0b"],
  ["medalha", "Medalha", "pescoco", k => `<path d="M74 164 L100 204 L126 164 L114 164 L100 186 L86 164 Z" fill="#1d4ed8" stroke="${k.OUT}" stroke-width="2.4" stroke-linejoin="round"/>` + circ(100, 208, 12, k.c, k) + k.estrela(100, 208, 7, k.cl), "#f59e0b"],
  ["apito", "Apito", "pescoco", k => linha("M72 166 Q100 206 128 166", k.c, 3) + `<path d="M90 192 L112 192 A10 10 0 1 1 96 206 L88 198 Z" fill="#94a3b8" stroke="${k.OUT}" stroke-width="2.4" stroke-linejoin="round"/>`],
  ["estetoscopio", "Estetoscópio", "pescoco", k => contornada("M72 166 Q72 200 100 200 Q128 200 128 166", k.c, 3, k) + linha("M100 200 L100 212", k.OUT, 5) + circ(100, 216, 8, "#94a3b8", k), "#111827"],
  ["lenco", "Lenço", "pescoco", k => k.t("M66 168 Q100 186 134 168 L100 212 Z") + circ(92, 184, 2.4, "#fff", k, 0) + circ(108, 184, 2.4, "#fff", k, 0) + circ(100, 196, 2.4, "#fff", k, 0)],
  ["gola", "Gola de palhaço", "pescoco", k => [62, 80, 100, 120, 138].map((x, i) => `<path d="M${x - 12} ${172 + (i % 4 ? 8 : 0)} Q${x} ${202 + (i % 4 ? 6 : 0)} ${x + 12} ${172 + (i % 4 ? 8 : 0)} Z" fill="${i % 2 ? k.cl : k.c}" stroke="${k.OUT}" stroke-width="2.4" stroke-linejoin="round"/>`).join("")],
  ["cordao", "Cordão SENAI", "pescoco", k => `<path d="M76 166 L94 224 L106 224 L88 166 Z M124 166 L106 224 L118 224 L136 166 Z" fill="${k.c}" stroke="${k.OUT}" stroke-width="2" stroke-linejoin="round"/>`],

  // ---------- peito ----------
  ["cracha", "Crachá SENAI", "peito", k => `<path d="M80 168 L118 200 M120 168 L126 200" stroke="#c1272d" stroke-width="5" stroke-linecap="round"/><rect x="108" y="196" width="34" height="24" rx="4" fill="#fff" stroke="${k.OUT}" stroke-width="2.4"/><rect x="108" y="196" width="34" height="8" rx="3" fill="#c1272d"/><text x="125" y="214" font-size="7" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#111">SENAI</text>`],
  ["estrela", "Broche de estrela", "peito", k => k.estrela(132, 190, 9, k.c), "#f59e0b"],
  ["broche-c", "Broche de coração", "peito", k => coracao(132, 190, 1.1, k.c, k), "#db2777"],
  ["broche-r", "Broche de raio", "peito", k => raio(132, 178, k.c, k), "#facc15"],
  ["caneta", "Caneta no bolso", "peito", k => `<rect x="124" y="176" width="6" height="22" rx="2" fill="${k.c}" stroke="${k.OUT}" stroke-width="2"/><rect x="134" y="180" width="6" height="18" rx="2" fill="#c1272d" stroke="${k.OUT}" stroke-width="2"/><rect x="118" y="194" width="28" height="22" rx="3" fill="#f8fafc" stroke="${k.OUT}" stroke-width="2.4"/>`, "#1d4ed8"],
  ["smile", "Botton sorriso", "peito", k => circ(132, 192, 10, k.c, k) + `<circle cx="128" cy="189" r="1.6" fill="${k.OUT}"/><circle cx="136" cy="189" r="1.6" fill="${k.OUT}"/>` + linha("M127 195 Q132 200 137 195", k.OUT, 1.8), "#facc15"],
  ["escudo", "Escudo de herói", "peito", k => k.t("M72 186 L128 186 L136 198 L100 226 L64 198 Z") + raio(100, 192, "#facc15", k)],
  ["engrenagem", "Engrenagem", "peito", k => [0, 45, 90, 135].map(a => `<rect x="127" y="176" width="10" height="32" rx="2" fill="${k.c}" stroke="${k.OUT}" stroke-width="2" transform="rotate(${a} 132 192)"/>`).join("") + circ(132, 192, 10, k.c, k) + circ(132, 192, 4, "#f8fafc", k, 2), "#64748b"],
  ["codigo", "Etiqueta de código", "peito", k => `<rect x="110" y="182" width="44" height="22" rx="5" fill="${k.c}" stroke="${k.OUT}" stroke-width="2.4"/><text x="132" y="198" font-size="13" font-family="Consolas,monospace" font-weight="bold" text-anchor="middle" fill="#fff">&lt;/&gt;</text>`, "#111827"],
  ["pendrive", "Pendrive", "peito", k => `<rect x="124" y="186" width="16" height="26" rx="3" fill="${k.c}" stroke="${k.OUT}" stroke-width="2.4"/><rect x="127" y="176" width="10" height="10" fill="#cbd5e1" stroke="${k.OUT}" stroke-width="2.4"/>`, "#1d4ed8"],
  ["lapela", "Flor na lapela", "peito", k => [0, 72, 144, 216, 288].map(a => `<circle cx="132" cy="181" r="5.5" fill="${k.c}" stroke="${k.OUT}" stroke-width="1.8" transform="rotate(${a} 132 190)"/>`).join("") + circ(132, 190, 4, "#facc15", k, 1.8), "#c1272d"],

  // ---------- costas ----------
  ["capa", "Capa de herói", "costas", k => k.t("M60 146 C20 164 -8 190 -14 226 L214 226 C208 190 180 164 140 146 Z")],
  ["asas", "Asas de anjo", "costas", k => `<path d="M64 170 C30 150 2 120 -6 84 C14 96 30 96 36 92 C32 106 40 116 48 118 C46 130 54 144 72 154 Z M136 170 C170 150 198 120 206 84 C186 96 170 96 164 92 C168 106 160 116 152 118 C154 130 146 144 128 154 Z" fill="${k.c}" stroke="${k.OUT}" stroke-width="${k.SW}" stroke-linejoin="round"/>`, "#f8fafc"],
  ["morcego", "Asas de morcego", "costas", k => k.t("M64 172 C36 140 8 110 -8 66 C2 84 16 94 24 96 C22 108 26 118 34 124 C34 134 40 146 50 150 C54 158 60 164 72 158 Z") + k.t("M136 172 C164 140 192 110 208 66 C198 84 184 94 176 96 C178 108 174 118 166 124 C166 134 160 146 150 150 C146 158 140 164 128 158 Z"), "#111827"],
  ["mochila", "Mochila", "costas", k => k.t("M18 150 C18 118 50 108 100 108 C150 108 182 118 182 150 L188 224 L12 224 Z") + linha("M20 176 L6 176 M180 176 L194 176", k.cs, 5)],
  ["jetpack", "Jetpack", "costas", k => `<rect x="14" y="120" width="34" height="80" rx="14" fill="${k.c}" stroke="${k.OUT}" stroke-width="${k.SW}"/><rect x="152" y="120" width="34" height="80" rx="14" fill="${k.c}" stroke="${k.OUT}" stroke-width="${k.SW}"/><path d="M22 200 Q31 228 40 200 Z M160 200 Q169 228 178 200 Z" fill="#f59e0b" stroke="${k.OUT}" stroke-width="2.4"/>`, "#64748b"],

  // ---------- companheiro (no ombro) ----------
  ["papagaio", "Papagaio", "companheiro", k => k.t("M22 170 C12 146 24 124 40 126 C56 128 58 150 50 170 Z") + k.t("M26 168 L16 190 L32 174 Z") + circ(44, 138, 4, "#fff", k, 2) + `<circle cx="45" cy="138" r="1.6" fill="${k.OUT}"/><path d="M52 136 C62 138 62 148 52 148 Z" fill="#f59e0b" stroke="${k.OUT}" stroke-width="2.2" stroke-linejoin="round"/>`, "#059669"],
  ["gatinho", "Gatinho", "companheiro", k => k.t("M14 172 C10 150 16 132 32 132 C48 132 56 150 52 172 Z") + k.t("M18 138 L16 118 L32 130 Z") + k.t("M48 138 L50 118 L34 130 Z") + `<circle cx="26" cy="146" r="2" fill="${k.OUT}"/><circle cx="40" cy="146" r="2" fill="${k.OUT}"/>` + linha("M30 153 Q33 156 36 153", k.OUT, 1.8), "#f59e0b"],
  ["coruja", "Coruja", "companheiro", k => k.t("M12 172 C8 142 18 126 33 126 C48 126 58 142 54 172 Z") + k.t("M16 132 L18 118 L28 128 Z") + k.t("M50 132 L48 118 L38 128 Z") + circ(25, 142, 7, "#fff", k, 2) + circ(41, 142, 7, "#fff", k, 2) + `<circle cx="25" cy="142" r="3" fill="${k.OUT}"/><circle cx="41" cy="142" r="3" fill="${k.OUT}"/><path d="M29 150 L37 150 L33 157 Z" fill="#f59e0b" stroke="${k.OUT}" stroke-width="1.8"/>`, "#92400e"],
  ["robozinho", "Robozinho", "companheiro", k => `<rect x="14" y="130" width="38" height="28" rx="6" fill="${k.c}" stroke="${k.OUT}" stroke-width="${k.SW}"/><rect x="20" y="158" width="26" height="14" rx="3" fill="${k.cs}" stroke="${k.OUT}" stroke-width="2.6"/>` + linha("M33 130 L33 118", k.OUT, 3) + circ(33, 116, 4, "#ef4444", k, 2) + circ(25, 143, 4, "#22d3ee", k, 2) + circ(41, 143, 4, "#22d3ee", k, 2), "#94a3b8"],
  ["patinho", "Patinho", "companheiro", k => k.t("M12 172 C8 152 22 146 30 148 C26 132 50 126 52 146 C60 156 54 172 44 172 Z") + `<circle cx="42" cy="140" r="2" fill="${k.OUT}"/><path d="M52 142 C60 142 60 150 50 150 Z" fill="#f97316" stroke="${k.OUT}" stroke-width="2" stroke-linejoin="round"/>`, "#facc15"],
  ["python", "Cobrinha", "companheiro", k => contornada("M10 170 C30 156 8 146 28 138 C42 132 50 140 44 148", k.c, 8, k) + `<circle cx="46" cy="144" r="1.8" fill="${k.OUT}"/>`, "#059669"],

  // ---------- efeitos ----------
  ["fx-estrelas", "Estrelas", "efeito", k => k.estrela(24, 30, 11, k.c) + k.estrela(176, 24, 9, k.c) + k.estrela(14, 84, 6, k.c) + k.estrela(188, 76, 7, k.c), "#facc15"],
  ["fx-coracoes", "Corações", "efeito", k => coracao(22, 34, 1.4, k.c, k) + coracao(178, 26, 1.2, k.c, k) + coracao(14, 88, .9, k.c, k) + coracao(188, 80, 1, k.c, k), "#db2777"],
  ["fx-notas", "Notas musicais", "efeito", k => nota(20, 44, k.c, k) + nota(170, 36, k.c, k) + nota(180, 90, k.c, k), "#7c3aed"],
  ["fx-raios", "Raios", "efeito", k => raio(22, 18, k.c, k) + raio(178, 12, k.c, k) + raio(186, 70, k.c, k), "#facc15"],
  ["fx-bolhas", "Bolhas", "efeito", k => [[20, 40, 9], [34, 18, 5], [178, 30, 8], [166, 10, 4], [188, 76, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${k.c}" fill-opacity=".35" stroke="${k.OUT}" stroke-width="2"/>`).join(""), "#22d3ee"],
  ["fx-codigo", "Código no ar", "efeito", k => [[8, 40, "{ }"], [158, 28, "</>"], [164, 84, "=="], [4, 92, "()"]].map(([x, y, s]) => `<text x="${x}" y="${y}" font-size="17" font-family="Consolas,monospace" font-weight="bold" fill="${k.c}" stroke="${k.OUT}" stroke-width=".6">${s}</text>`).join(""), "#059669"],
  ["fx-livro", "Livro flutuando", "efeito", k => `<path d="M6 30 Q20 22 32 30 Q44 22 58 30 L58 56 Q44 48 32 56 Q20 48 6 56 Z" fill="${k.c}" stroke="${k.OUT}" stroke-width="2.6" stroke-linejoin="round"/>` + linha("M32 30 L32 56", k.OUT, 2.2) + linha("M12 36 Q20 32 27 36 M38 36 Q44 32 52 36", "#fff", 1.8), "#1d4ed8"],
  ["fx-lampada", "Ideia (lâmpada)", "efeito", k => `<path d="M170 44 C154 44 148 22 160 10 C168 2 182 2 188 12 C196 24 186 36 182 44 Z" fill="${k.c}" stroke="${k.OUT}" stroke-width="2.6" stroke-linejoin="round"/><rect x="168" y="44" width="16" height="9" rx="2" fill="#94a3b8" stroke="${k.OUT}" stroke-width="2.2"/>`, "#facc15"],
  ["fx-nuvem", "Nuvem de pensamento", "efeito", k => `<path d="M136 34 C128 18 150 6 160 16 C170 2 194 12 188 28 C200 38 188 52 176 46 C166 56 146 50 148 42 C140 44 134 40 136 34 Z" fill="#f8fafc" stroke="${k.OUT}" stroke-width="2.6" stroke-linejoin="round"/>` + circ(138, 58, 4, "#f8fafc", k, 2) + circ(128, 68, 2.6, "#f8fafc", k, 2)]
];

export const ACESSORIOS = Object.fromEntries(L.map(([id, nome, encaixe, svg, cor]) => [id, { id, nome, encaixe, svg, cor }]));
export const TOTAL_ACESSORIOS = L.length;
export const acessoriosDo = encaixe => L.filter(x => x[2] === encaixe).map(x => ACESSORIOS[x[0]]);
export const CORES_ACESSORIO = ["#c1272d", "#db2777", "#f97316", "#f59e0b", "#facc15", "#059669", "#0e7490", "#22d3ee", "#1d4ed8", "#7c3aed", "#92400e", "#64748b", "#111827", "#f8fafc"];
// em que encaixe entra um item criado pela equipe
export const ENCAIXE_DA_CATEGORIA = { cabeca: "cabeca", oculos: "rosto", pescoco: "pescoco", estampa: "peito", roupa: "roupa" };
export const CATEGORIA_DO_ENCAIXE = { cabeca: "cabeca", rosto: "oculos", pescoco: "pescoco", peito: "estampa", roupa: "roupa" };
