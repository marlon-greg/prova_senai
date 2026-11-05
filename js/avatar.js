// Personagem do aluno: desenho em SVG montado por partes, com sombra e contorno.
// O corpo (feminino, masculino ou neutro) só muda os ombros e o pescoço: QUALQUER corpo pode usar QUALQUER cabelo,
// barba, maquiagem, roupa ou acessório. Algumas partes são SKINS liberadas por conquistas (nº de conquistas ou uma medalha).

// ---------- cores ----------
export const PELES = ["#f9d7c0", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5c3a1e", "#fde7d6", "#e8b48a", "#a0662f", "#3d2614"];
export const ORDEM_PELES = [6, 0, 1, 7, 2, 3, 8, 4, 5, 9]; // do mais claro ao mais escuro (só para mostrar)
export const CORES_CABELO = ["#1f1a17", "#4a2c1a", "#8b5a2b", "#d9a441", "#e8d5a3", "#b5482f", "#6b7280", "#2563eb", "#db2777", "#7c3aed",
  "#f5f0e1", "#d9661f", "#0d9488", "#f9a8d4", "#e5e7eb", "#a78bfa"];
export const CORES_ROUPA = ["#c1272d", "#1d4ed8", "#059669", "#111827", "#f59e0b", "#7c3aed", "#db2777", "#0e7490", "#f3f4f6",
  "#fda4af", "#84cc16", "#92400e", "#fde047", "#60a5fa", "#6b7280"];
export const CORES_OLHOS = ["#1f2937", "#5b3a1a", "#1d4ed8", "#047857", "#6b7280", "#7c3aed", "#8a6a2b", "#b7791f", "#0891b2", "#be123c"];
export const CORES_ACESSORIO = ["#111827", "#c1272d", "#2563eb", "#f59e0b", "#db2777", "#059669", "#7c3aed", "#f8fafc", "#0e7490", "#92400e"];
export const CORES_LABIOS = [null, "#e11d48", "#f472b6", "#9f1239", "#ea580c", "#b9836b", "#7c3aed", "#111827"]; // 0 = natural (vem da pele)
export const CORES_OCULOS = ["#111827", "#7c2d12", "#c1272d", "#2563eb", "#db2777", "#e5b84b", "#cbd5e1", "#7c3aed", "#059669"];
export const CORES_JOIA = ["#e5b84b", "#cbd5e1", "#e7a29b", "#111827", "#f8fafc", "#22d3ee", "#c1272d", "#7c3aed"];

// ---------- catálogo ----------
// cada item pode ter { trava: { n } (nº de conquistas) ou { medalha: "id da conquista" } }
export const CATALOGO = {
  corpo: [{ id: "masculino", nome: "Masculino" }, { id: "feminino", nome: "Feminino" }],
  rosto: [{ id: "redondo", nome: "Redondo" }, { id: "oval", nome: "Oval" }, { id: "quadrado", nome: "Quadrado" }, { id: "coracao", nome: "Coração" },
    { id: "longo", nome: "Comprido" }, { id: "diamante", nome: "Diamante" }],
  orelha: [{ id: "normal", nome: "Normal" }, { id: "pequena", nome: "Pequena" }, { id: "grande", nome: "Grande" }, { id: "redonda", nome: "Redonda" },
    { id: "pontuda", nome: "Pontuda (elfo)", trava: { n: 3 } }],
  nariz: [{ id: "botao", nome: "Botão" }, { id: "redondo", nome: "Redondo" }, { id: "pontudo", nome: "Pontudo" }, { id: "largo", nome: "Largo" },
    { id: "arrebitado", nome: "Arrebitado" }, { id: "linha", nome: "Traço" }, { id: "pontinhos", nome: "Pontinhos" }],
  bochecha: [{ id: "nada", nome: "Nada" }, { id: "rosada", nome: "Rosada" }, { id: "corada", nome: "Bem corada" }, { id: "pessego", nome: "Pêssego" },
    { id: "sardas", nome: "Sardas" }, { id: "sardas-rosada", nome: "Sardas e rosada" }, { id: "covinhas", nome: "Covinhas" }, { id: "brilho", nome: "Brilho" }],
  detalhe: [{ id: "nenhum", nome: "Nenhum" }, { id: "pinta", nome: "Pinta" }, { id: "curativo", nome: "Curativo" }, { id: "cicatriz", nome: "Cicatriz" },
    { id: "piercing", nome: "Piercing no nariz" }, { id: "pintura", nome: "Pintura de torcida", trava: { n: 3 } }, { id: "brilho", nome: "Brilhinhos", trava: { n: 6 } }],
  cabelo: [{ id: "curto", nome: "Curto" }, { id: "social", nome: "Repartido" }, { id: "topete", nome: "Topete" }, { id: "pixie", nome: "Joãozinho" },
    { id: "chanel", nome: "Chanel" }, { id: "longo", nome: "Longo liso" }, { id: "franja", nome: "Franja" }, { id: "ondulado", nome: "Ondulado" },
    { id: "cacheado", nome: "Cacheado" }, { id: "cachos-longos", nome: "Cachos longos" }, { id: "afrocurto", nome: "Crespo curto" }, { id: "black", nome: "Black power" },
    { id: "puffs", nome: "Puffs" }, { id: "rabo", nome: "Rabo de cavalo" }, { id: "coque", nome: "Coque" }, { id: "meio-coque", nome: "Meio preso" },
    { id: "maria", nome: "Maria-chiquinha" }, { id: "mullet", nome: "Mullet" }, { id: "nago", nome: "Nagô" }, { id: "raspado", nome: "Raspado" },
    { id: "lateral", nome: "Lado raspado" }, { id: "careca", nome: "Careca" }, { id: "espetado", nome: "Espetado", trava: { n: 2 } },
    { id: "moicano", nome: "Moicano", trava: { n: 3 } }, { id: "trancas", nome: "Tranças", trava: { n: 5 } }, { id: "dread", nome: "Dreads", trava: { n: 6 } }],
  sobrancelha: [{ id: "normal", nome: "Normal" }, { id: "fina", nome: "Fina" }, { id: "grossa", nome: "Grossas" }, { id: "arqueada", nome: "Arqueadas" },
    { id: "reta", nome: "Retas" }, { id: "brava", nome: "Determinada" }, { id: "preocupada", nome: "Preocupada" }, { id: "nenhuma", nome: "Sem" }],
  barba: [{ id: "nenhuma", nome: "Nenhuma" }, { id: "porfazer", nome: "Por fazer" }, { id: "bigode", nome: "Bigode" }, { id: "bigode-fino", nome: "Bigode fino" },
    { id: "cavanhaque", nome: "Cavanhaque" }, { id: "costeleta", nome: "Costeletas" }, { id: "curta", nome: "Barba curta" }, { id: "cheia", nome: "Barba cheia" },
    { id: "longa", nome: "Barba longa", trava: { n: 4 } }],
  olhos: [{ id: "normal", nome: "Normal" }, { id: "amendoado", nome: "Amendoados" }, { id: "grandes", nome: "Grandes" }, { id: "bolinha", nome: "Bolinha" },
    { id: "feliz", nome: "Feliz" }, { id: "sereno", nome: "Serenos" }, { id: "sono", nome: "Sonolentos" }, { id: "surpresa", nome: "Surpresos" },
    { id: "determinado", nome: "Determinados" }, { id: "lado", nome: "Olhar de lado" }, { id: "piscando", nome: "Piscando", trava: { n: 2 } },
    { id: "coracao", nome: "Apaixonados", trava: { n: 4 } }, { id: "estrela", nome: "Olhos de estrela", trava: { medalha: "gabaritou" } }],
  cilios: [{ id: "nenhum", nome: "Discretos" }, { id: "curtos", nome: "Curtos" }, { id: "longos", nome: "Longos" }, { id: "volumosos", nome: "Volumosos" },
    { id: "delineado", nome: "Delineado" }],
  maquiagem: [{ id: "nenhuma", nome: "Nenhuma" }, { id: "rosa", nome: "Sombra rosa" }, { id: "dourada", nome: "Sombra dourada" }, { id: "azul", nome: "Sombra azul" },
    { id: "roxa", nome: "Sombra roxa" }, { id: "esfumada", nome: "Esfumada" }, { id: "glitter", nome: "Glitter", trava: { n: 4 } }],
  boca: [{ id: "sorriso", nome: "Sorriso" }, { id: "grande", nome: "Sorrisão" }, { id: "risada", nome: "Risada" }, { id: "labios", nome: "Lábios cheios" },
    { id: "neutra", nome: "Tranquila" }, { id: "lado", nome: "Sorriso de lado" }, { id: "timido", nome: "Tímido" }, { id: "o", nome: "Uau" },
    { id: "beijo", nome: "Beijinho" }, { id: "dentes", nome: "Dentuço" }, { id: "lingua", nome: "Língua", trava: { n: 4 } }],
  roupa: [{ id: "camiseta", nome: "Camiseta" }, { id: "decote", nome: "Gola V" }, { id: "regata", nome: "Regata" }, { id: "gola", nome: "Camisa polo" },
    { id: "social", nome: "Camisa e gravata" }, { id: "golaalta", nome: "Gola alta" }, { id: "moletom", nome: "Moletom" }, { id: "sueter", nome: "Suéter" },
    { id: "jaqueta", nome: "Jaqueta" }, { id: "listrada", nome: "Listrada" }, { id: "jardineira", nome: "Jardineira" }, { id: "quimono", nome: "Quimono" },
    { id: "jaleco", nome: "Jaleco SENAI", trava: { medalha: "primeira-prova" } }, { id: "capa", nome: "Capa de herói", trava: { medalha: "fiz-sozinha" } },
    { id: "terno", nome: "Terno de formatura", trava: { medalha: "veterano" } }, { id: "time", nome: "Uniforme de time", trava: { n: 4 } },
    { id: "astronauta", nome: "Astronauta", trava: { n: 10 } }],
  pescoco: [{ id: "nenhum", nome: "Nada" }, { id: "colar", nome: "Correntinha" }, { id: "pingente", nome: "Pingente" }, { id: "perolas", nome: "Pérolas" },
    { id: "choker", nome: "Gargantilha" }, { id: "gravata", nome: "Gravata-borboleta" }, { id: "cachecol", nome: "Cachecol" }, { id: "cracha", nome: "Crachá SENAI" },
    { id: "medalha", nome: "Medalha", trava: { n: 5 } }],
  oculos: [{ id: "nenhum", nome: "Nenhum" }, { id: "oculos", nome: "Redondos" }, { id: "quadrado", nome: "Quadrados" }, { id: "nerd", nome: "Armação grossa" },
    { id: "gatinho", nome: "Gatinho" }, { id: "aviador", nome: "Aviador" }, { id: "coracoes", nome: "Corações", trava: { n: 3 } },
    { id: "monoculo", nome: "Monóculo", trava: { n: 7 } }, { id: "escuros", nome: "Óculos escuros", trava: { medalha: "trinca-de-ouro" } }],
  brinco: [{ id: "nenhum", nome: "Nenhum" }, { id: "ponto", nome: "Pontinho" }, { id: "perola", nome: "Pérola" }, { id: "argola", nome: "Argola" },
    { id: "argola-grande", nome: "Argolona" }, { id: "pendente", nome: "Gota" }, { id: "varios", nome: "Vários" }, { id: "alargador", nome: "Alargador" },
    { id: "estrela", nome: "Estrela", trava: { n: 2 } }],
  acessorio: [{ id: "nenhum", nome: "Nenhum" }, { id: "presilha", nome: "Presilhas" }, { id: "arco", nome: "Arco" }, { id: "laco", nome: "Laço" },
    { id: "flor", nome: "Flor" }, { id: "bandana", nome: "Bandana" }, { id: "gorro", nome: "Gorro" }, { id: "boina", nome: "Boina" },
    { id: "chapeu", nome: "Chapéu" }, { id: "bone", nome: "Boné", trava: { n: 1 } }, { id: "faixa", nome: "Faixa ninja", trava: { n: 2 } },
    { id: "gatinho", nome: "Orelhas de gato", trava: { n: 3 } }, { id: "fone", nome: "Fone de ouvido", trava: { n: 3 } }, { id: "tiara", nome: "Tiara", trava: { n: 5 } },
    { id: "headset", nome: "Headset gamer", trava: { n: 8 } }, { id: "mago", nome: "Chapéu de mago", trava: { n: 9 } }, { id: "coroa", nome: "Coroa", trava: { n: 12 } },
    { id: "aureola", nome: "Auréola de estrelas", trava: { medalha: "chuva-de-estrelas" } }],
  fundo: [{ id: "azul", nome: "Céu", cor: "#dbeafe" }, { id: "verde", nome: "Menta", cor: "#d1fae5" }, { id: "rosa", nome: "Rosa", cor: "#fce7f3" }, { id: "cinza", nome: "Neutro", cor: "#f1f5f9" },
    { id: "amarelo", nome: "Sol", cor: "#fef3c7" }, { id: "lilas", nome: "Lilás", cor: "#ede9fe" }, { id: "pessego", nome: "Pêssego", cor: "#ffedd5" },
    { id: "bolinhas", nome: "Bolinhas", cor: "#e0f2fe", padrao: "bolinhas" }, { id: "nuvens", nome: "Nuvens", grad: ["#bae6fd", "#e0f2fe"], padrao: "nuvens" },
    { id: "confete", nome: "Confete", cor: "#fdf4ff", padrao: "confete" },
    { id: "senai", nome: "SENAI", cor: "#c1272d", trava: { n: 2 } }, { id: "listras", nome: "Listras", cor: "#fef9c3", padrao: "listras", trava: { n: 1 } },
    { id: "codigo", nome: "Código", cor: "#0f172a", padrao: "codigo", trava: { n: 3 } }, { id: "por-do-sol", nome: "Pôr do sol", grad: ["#f97316", "#db2777"], trava: { n: 4 } },
    { id: "oceano", nome: "Oceano", grad: ["#0ea5e9", "#1e3a8a"], trava: { n: 5 } }, { id: "floresta", nome: "Floresta", grad: ["#86efac", "#166534"], trava: { n: 6 } },
    { id: "galaxia", nome: "Galáxia", grad: ["#1e1b4b", "#7c3aed"], trava: { n: 7 } }, { id: "ouro", nome: "Dourado", grad: ["#fde68a", "#f59e0b"], trava: { medalha: "trinca-de-ouro" } },
    { id: "arco-iris", nome: "Arco-íris", grad: ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"], trava: { n: 10 } }],
  adesivo: [{ id: "nenhum", nome: "Nenhum" }, { id: "⭐", nome: "Estrela" }, { id: "💻", nome: "Computador" }, { id: "🎮", nome: "Videogame" }, { id: "⚽", nome: "Futebol" },
    { id: "🎵", nome: "Música" }, { id: "🐱", nome: "Gato" }, { id: "🐶", nome: "Cachorro" }, { id: "📚", nome: "Livros" }, { id: "🌈", nome: "Arco-íris" },
    { id: "🎨", nome: "Arte" }, { id: "🌻", nome: "Girassol" }, { id: "🚀", nome: "Foguete", trava: { n: 2 } },
    { id: "🔥", nome: "Fogo", trava: { medalha: "em-chamas" } }, { id: "🏆", nome: "Troféu", trava: { n: 8 } }, { id: "💎", nome: "Diamante", trava: { n: 14 } }],
  moldura: [{ id: "nenhuma", nome: "Nenhuma" }, { id: "bronze", nome: "Bronze", cor: "#b45309", trava: { n: 1 } }, { id: "prata", nome: "Prata", cor: "#94a3b8", trava: { n: 5 } },
    { id: "ouro", nome: "Ouro", cor: "#f59e0b", trava: { n: 9 } }, { id: "diamante", nome: "Diamante", cor: "#22d3ee", trava: { n: 15 } }, { id: "fogo", nome: "Fogo", cor: "#ef4444", trava: { medalha: "em-chamas" } }]
};
export const NOMES_PARTES = { corpo: "Corpo", rosto: "Formato do rosto", orelha: "Orelhas", nariz: "Nariz", bochecha: "Bochechas", detalhe: "Detalhes",
  cabelo: "Cabelo", sobrancelha: "Sobrancelhas", barba: "Barba e bigode", olhos: "Olhos", cilios: "Cílios", maquiagem: "Maquiagem", boca: "Boca",
  roupa: "Roupa", pescoco: "Pescoço", oculos: "Óculos", brinco: "Brincos", acessorio: "Cabeça", fundo: "Fundo", adesivo: "Adesivo", moldura: "Moldura" };
export const CORES = { pele: PELES, corCabelo: CORES_CABELO, corOlhos: CORES_OLHOS, corLabios: CORES_LABIOS, corRoupa: CORES_ROUPA,
  corAcessorio: CORES_ACESSORIO, corOculos: CORES_OCULOS, corJoia: CORES_JOIA };
// ---------- o que é de cada sexo ----------
// m = só masculino, f = só feminino; o resto serve aos dois. Assim o personagem masculino de cabelo comprido
// continua com cara de homem (sem cílios, maquiagem, batom, laço...) e o feminino não ganha barba.
const SO = {
  cabelo: { curto: "m", social: "m", topete: "m", raspado: "m", careca: "m", espetado: "m", moicano: "m", mullet: "m", lateral: "m", afrocurto: "m",
    pixie: "f", chanel: "f", franja: "f", puffs: "f", maria: "f" },
  barba: { porfazer: "m", bigode: "m", "bigode-fino": "m", cavanhaque: "m", costeleta: "m", curta: "m", cheia: "m", longa: "m" },
  sobrancelha: { grossa: "m", fina: "f", arqueada: "f" },
  olhos: { grandes: "f", coracao: "f" },
  cilios: { curtos: "f", longos: "f", volumosos: "f", delineado: "f" },
  maquiagem: { rosa: "f", dourada: "f", azul: "f", roxa: "f", esfumada: "f", glitter: "f" },
  boca: { labios: "f", beijo: "f" },
  bochecha: { rosada: "f", corada: "f", brilho: "f" },
  roupa: { social: "m", decote: "f" },
  pescoco: { gravata: "m", perolas: "f", choker: "f", pingente: "f" },
  oculos: { gatinho: "f", coracoes: "f" },
  brinco: { perola: "f", "argola-grande": "f", pendente: "f", varios: "f", estrela: "f" },
  acessorio: { presilha: "f", arco: "f", laco: "f", flor: "f", tiara: "f", gatinho: "f" }
};
for (const [parte, m] of Object.entries(SO)) CATALOGO[parte].forEach(i => { if (m[i.id]) i.so = m[i.id]; });
CATALOGO.cilios[0].nome = "Sem cílios";
const sexo = corpo => corpo === "feminino" ? "f" : "m";
// o item serve para este corpo?
export const permitido = (item, corpo) => !item?.so || item.so === sexo(corpo);
// partes que não aparecem no editor para o sexo (ficam no padrão)
export const PARTES_OCULTAS = { m: ["cilios", "maquiagem"], f: ["barba"] };

export const AVATAR_PADRAO = { corpo: "masculino", pele: 1, rosto: "redondo", orelha: "normal", nariz: "botao", bochecha: "rosada", detalhe: "nenhum",
  cabelo: "curto", corCabelo: 1, sobrancelha: "normal", barba: "nenhuma", olhos: "normal", corOlhos: 0, cilios: "nenhum", maquiagem: "nenhuma",
  boca: "sorriso", corLabios: 0, roupa: "camiseta", corRoupa: 0, pescoco: "nenhum", oculos: "nenhum", corOculos: 0, brinco: "nenhum", corJoia: 0,
  acessorio: "nenhum", corAcessorio: 0, fundo: "azul", adesivo: "nenhum", moldura: "nenhuma" };

import { CONQUISTAS_PADRAO } from "./conquistas.js";
// item liberado? ganhas = conquistas ganhas [{ id, t }] (a trava por medalha usa o id da conquista)
export function liberado(item, ganhas) {
  if (!item?.trava) return true;
  if (item.trava.n) return ganhas.length >= item.trava.n;
  return ganhas.some(g => g.id === item.trava.medalha || String(g.id || "").startsWith(item.trava.medalha + ":"));
}
const nomeMedalha = id => CONQUISTAS_PADRAO.find(c => c.id === id)?.t || id;
export const textoTrava = t => !t ? "" : t.n ? `🔒 ${t.n} conquista(s)` : `🔒 medalha “${nomeMedalha(t.medalha)}”`;

// personagens salvos na versão anterior: sardas/corado viraram "bochecha"; óculos saíram de "acessório"
function migrar(a) {
  const v = { ...a };
  if (!a.bochecha && (a.detalhe === "sardas" || a.detalhe === "corado")) { v.bochecha = a.detalhe === "sardas" ? "sardas-rosada" : "corada"; v.detalhe = "nenhum"; }
  if (!a.oculos && ["oculos", "escuros", "monoculo"].includes(a.acessorio)) { v.oculos = a.acessorio; v.acessorio = "nenhum"; }
  // o corpo "neutro" saiu: vira feminino se o personagem já usava coisas femininas, senão masculino
  if (!["masculino", "feminino"].includes(v.corpo)) {
    const fem = ["cabelo", "cilios", "maquiagem", "boca", "acessorio", "brinco", "pescoco"].some(p => SO[p]?.[v[p]] === "f") || Number(v.corLabios) > 0;
    v.corpo = fem ? "feminino" : "masculino";
  }
  return { ...padraoDo(v.corpo), ...v };
}
// padrão de cada sexo (o que entra quando uma peça não serve)
const PADRAO_SEXO = { m: {}, f: { cabelo: "longo", cilios: "curtos", sobrancelha: "arqueada", bochecha: "rosada" } };
const padraoDo = corpo => ({ ...AVATAR_PADRAO, bochecha: "nada", ...PADRAO_SEXO[sexo(corpo)], corpo: corpo === "feminino" ? "feminino" : "masculino" });
// troca o que estiver travado (ou que não serve para o sexo) pelo padrão
export function avatarValido(a, ganhas) {
  const v = migrar(a || {}), pad = padraoDo(v.corpo);
  for (const parte of Object.keys(CATALOGO)) { const it = CATALOGO[parte].find(x => x.id === v[parte]); if (!it || !liberado(it, ganhas) || !permitido(it, v.corpo)) v[parte] = pad[parte]; }
  for (const [k, lista] of Object.entries(CORES)) v[k] = Math.max(0, Math.min(lista.length - 1, Math.round(Number(v[k]) || 0)));
  if (v.corpo === "masculino") v.corLabios = 0;   // sem batom no masculino
  return v;
}
// trocou o sexo no editor: mantém o que serve e troca o resto pelo padrão do novo sexo
export const trocarSexo = (av, corpo, ganhas) => avatarValido({ ...av, corpo }, ganhas);

// o Aleatório só usa peças "sérias" e cores naturais (nada de coração no olho, língua de fora, cabelo rosa...)
const BRINCADEIRA = {
  olhos: ["coracao", "estrela", "piscando", "surpresa", "sono", "lado", "bolinha"], boca: ["lingua", "dentes", "beijo", "o", "risada"],
  sobrancelha: ["preocupada", "brava", "nenhuma"], nariz: ["pontinhos", "linha"], orelha: ["pontuda", "grande"],
  detalhe: ["pintura", "brilho", "curativo", "cicatriz", "piercing"], cabelo: ["moicano", "espetado", "puffs", "maria", "careca"],
  oculos: ["coracoes", "monoculo", "escuros", "nerd"], roupa: ["astronauta", "capa", "quimono", "time", "jaleco", "terno"],
  acessorio: ["mago", "gatinho", "coroa", "aureola", "faixa", "headset", "fone", "chapeu", "boina", "bandana", "gorro", "bone"],
  pescoco: ["medalha", "cracha", "cachecol", "choker"], maquiagem: ["glitter", "azul", "roxa"], brinco: ["estrela", "varios", "alargador"],
  cilios: ["volumosos", "delineado"], barba: ["longa", "costeleta"], bochecha: ["corada", "brilho"]
};
const NATURAIS = { corCabelo: [0, 1, 2, 3, 4, 5, 6], corOlhos: [0, 1, 2, 3, 4, 6], corLabios: [0, 0, 0, 1, 2, 5] };
// sorteia um personagem do MESMO sexo de base.corpo (ou sorteia o sexo, se não vier), só com o que está liberado
export function avatarAleatorio(ganhas, base = {}) {
  const sorte = l => l[Math.floor(Math.random() * l.length)], chance = p => Math.random() < p;
  const corpo = ["masculino", "feminino"].includes(base.corpo) ? base.corpo : sorte(["masculino", "feminino"]), m = corpo === "masculino";
  const v = { ...base, corpo };
  for (const parte of Object.keys(CATALOGO)) {
    if (parte === "corpo" || (["fundo", "adesivo", "moldura"].includes(parte) && base[parte])) continue; // o fundo e a moldura ficam
    const ops = CATALOGO[parte].filter(i => liberado(i, ganhas) && permitido(i, corpo) && !BRINCADEIRA[parte]?.includes(i.id));
    v[parte] = (ops.length ? sorte(ops) : CATALOGO[parte][0]).id;
  }
  for (const [k, lista] of Object.entries(CORES)) v[k] = NATURAIS[k] ? sorte(NATURAIS[k]) : Math.floor(Math.random() * lista.length);
  if (m && !["curto", "social", "topete", "afrocurto", "raspado", "lateral", "mullet", "longo", "black", "cacheado", "rabo"].includes(v.cabelo) || m && chance(.7))
    v.cabelo = sorte(["curto", "social", "topete", "afrocurto", "raspado", "lateral"].filter(c => liberado(CATALOGO.cabelo.find(i => i.id === c), ganhas)));
  v.barba = m && chance(.45) ? v.barba : "nenhuma";
  v.cilios = m ? "nenhum" : v.cilios === "nenhum" ? "curtos" : v.cilios;
  v.maquiagem = !m && chance(.35) ? v.maquiagem : "nenhuma";
  if (m) { v.corLabios = 0; if (chance(.6)) v.bochecha = "nada"; if (chance(.7)) v.brinco = "nenhum"; }
  if (chance(.6)) v.oculos = "nenhum";
  if (chance(.65)) v.acessorio = "nenhum";
  if (chance(.7)) v.detalhe = "nenhum";
  if (chance(.5)) v.pescoco = "nenhum";
  if (!m && chance(.4)) v.brinco = "nenhum";
  return v;
}

// ---------- cores auxiliares ----------
const rgb = h => { h = String(h || "#888888").replace("#", ""); if (h.length === 3) h = [...h].map(c => c + c).join(""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0); };
const mistura = (a, b, t) => { const A = rgb(a), B = rgb(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const escuro = (c, t = .3) => mistura(c, "#000000", t), claro = (c, t = .3) => mistura(c, "#ffffff", t);
export const labioNatural = pele => mistura(pele, "#b4535a", .5);
const pega = (lista, i, pad = 0) => lista[Number(i)] ?? lista[pad];
const espelho = s => `${s}<g transform="matrix(-1 0 0 1 200 0)">${s}</g>`;

// formatos do rosto (centro x=100, olhos em y=98) e meia largura na altura das orelhas
// w = meia largura (altura das orelhas), top/chin = alto da cabeça e queixo, jaw = largura do queixo (o masculino é mais quadrado)
const ROSTOS = {
  redondo: { w: 53, top: 42, chin: 150, jaw: .62 }, oval: { w: 50, top: 40, chin: 152, jaw: .52 }, quadrado: { w: 52, top: 40, chin: 150, jaw: .8 },
  coracao: { w: 52, top: 40, chin: 153, jaw: .38 }, longo: { w: 47, top: 36, chin: 158, jaw: .55 }, diamante: { w: 50, top: 42, chin: 152, jaw: .42, testa: .45 }
};
const OUT = "#2a1a14";   // contorno escuro, igual ao dos mascotes
function caminhoRosto(r, fem) {
  const w = r.w, cy = 98, jaw = Math.min(.9, r.jaw + (fem ? -.08 : .16)), baixo = fem ? .62 : .82, tw = r.testa || .6, chin = r.chin + (fem ? 0 : 2);
  const f = n => +n.toFixed(1);
  return `M${100 - w} ${cy} C${100 - w} ${r.top + 14} ${f(100 - w * tw)} ${r.top} 100 ${r.top} C${f(100 + w * tw)} ${r.top} ${100 + w} ${r.top + 14} ${100 + w} ${cy} ` +
    `C${100 + w} ${f(cy + (chin - cy) * baixo)} ${f(100 + w * jaw)} ${chin} 100 ${chin} C${f(100 - w * jaw)} ${chin} ${100 - w} ${f(cy + (chin - cy) * baixo)} ${100 - w} ${cy}Z`;
}
const CORPOS = { feminino: { S: 62, N: 10, topo: 160 }, masculino: { S: 80, N: 15, topo: 156 } };
// o personagem é desenhado num espaço 0..200 e depois um pouco reduzido e subido, para a roupa aparecer
const ENCAIXE = "translate(100 94) scale(.92) translate(-100 -104)";
const encaixa = vb => { const [x, y, w, h] = vb.split(" ").map(Number); return [100 + (x - 100) * .92, 94 + (y - 104) * .92, w * .92, h * .92].map(n => +n.toFixed(1)).join(" "); };
const ZOOM = { olhos: "58 66 84 84", cilios: "58 66 84 84", maquiagem: "58 66 84 84", sobrancelha: "58 62 84 84", nariz: "58 74 84 84", boca: "58 86 84 84",
  bochecha: "48 68 104 104", detalhe: "40 52 120 120", barba: "36 66 128 128", orelha: "28 50 144 144", brinco: "28 56 144 144", rosto: "24 24 152 152",
  oculos: "40 54 120 120", cabelo: "0 0 200 200" };

let seq = 0;
// opcoes.parte: usado nas miniaturas do editor (aproxima a parte do rosto que está sendo escolhida)
export function svgAvatar(av, tam = 200, opcoes = {}) {
  const a = migrar(av || {}), id = "av" + (++seq);
  const pele = pega(PELES, a.pele, 1), cab = pega(CORES_CABELO, a.corCabelo, 1), roupa = pega(CORES_ROUPA, a.corRoupa), olho = pega(CORES_OLHOS, a.corOlhos);
  const ac = pega(CORES_ACESSORIO, a.corAcessorio), joia = pega(CORES_JOIA, a.corJoia), arm = pega(CORES_OCULOS, a.corOculos);
  const lab = CORES_LABIOS[Number(a.corLabios)] || labioNatural(pele), labS = escuro(lab, .35);
  const fem = a.corpo === "feminino";
  const peleS = escuro(pele, .16), linha = OUT, cabS = OUT, cabL = claro(cab, .38);
  const fundo = CATALOGO.fundo.find(f => f.id === a.fundo) || CATALOGO.fundo[0], mold = CATALOGO.moldura.find(m => m.id === a.moldura);
  const formato = ROSTOS[a.rosto] || ROSTOS.redondo, rostoD = caminhoRosto(formato, fem), hw = formato.w, { S, N, topo } = CORPOS[a.corpo] || CORPOS.masculino;
  const ex = 100 - hw - 1; // x da orelha esquerda

  // ----- traços reutilizados -----
  const H = d => `<path d="${d}" fill="url(#${id}hc)" stroke="${cabS}" stroke-width="2.4" stroke-linejoin="round"/>`;
  const Hb = d => `<path d="${d}" fill="none" stroke="${cabL}" stroke-width="1.8" stroke-linecap="round" opacity=".5"/>`;
  const bolas = (pts, r) => pts.map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr || r}" fill="url(#${id}hc)" stroke="${cabS}" stroke-width="1.9"/>`).join("");
  const pano = (d, cor, extra = "") => `<path d="${d}" fill="${cor}" stroke="${OUT}" stroke-width="2.3" stroke-linejoin="round" ${extra}/>`;
  const golaRedonda = `L${100 - N - 6} ${topo - 1} Q100 ${topo + 13} ${100 + N + 6} ${topo - 1}`;
  const golaV = `L${100 - N - 5} ${topo - 1} L100 ${topo + 24} L${100 + N + 5} ${topo - 1}`;
  const T = (gola = golaRedonda) => `M${100 - S} 212 L${100 - S} 196 C${100 - S} ${topo + 12} ${100 - S + 12} ${topo} ${100 - S + 34} ${topo - 1} ${gola} L${100 + S - 34} ${topo - 1} C${100 + S - 12} ${topo} ${100 + S} ${topo + 12} ${100 + S} 196 L${100 + S} 212Z`;
  const bracos = cor => espelho(`<path d="M${100 - S + 18} ${topo + 16} Q${100 - S + 22} 192 ${100 - S + 20} 212" fill="none" stroke="${escuro(cor, .28)}" stroke-width="1.5" opacity=".7"/>`);
  const roupaS = escuro(roupa, .35);

  // ----- fundo -----
  const grad = fundo.grad ? `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">${fundo.grad.map((c, i) => `<stop offset="${i / (fundo.grad.length - 1)}" stop-color="${c}"/>`).join("")}</linearGradient>` : "";
  const padrao = {
    bolinhas: [20, 60, 100, 140, 180].flatMap(x => [20, 60, 100, 140, 180].map(y => `<circle cx="${x + (y / 20 % 2 ? 20 : 0)}" cy="${y}" r="6" fill="#fff" opacity=".7"/>`)).join(""),
    listras: [0, 30, 60, 90, 120, 150, 180].map(x => `<rect x="${x}" y="0" width="14" height="200" fill="#fde68a" opacity=".7"/>`).join(""),
    codigo: ["</>", "{ }", "01", "SQL", "if", "=>", "[]"].map((t, i) => `<text x="${(i * 53) % 180 + 10}" y="${(i * 37) % 170 + 22}" font-size="14" font-family="monospace" fill="#22c55e" opacity=".6">${t}</text>`).join(""),
    nuvens: [[40, 40], [150, 60], [60, 150], [165, 150]].map(([x, y]) => `<g fill="#fff" opacity=".85"><circle cx="${x}" cy="${y}" r="12"/><circle cx="${x + 13}" cy="${y - 5}" r="14"/><circle cx="${x + 26}" cy="${y}" r="11"/><rect x="${x}" y="${y}" width="26" height="11" rx="5"/></g>`).join(""),
    confete: Array.from({ length: 26 }, (_, i) => `<rect x="${(i * 47) % 190}" y="${(i * 71) % 190}" width="7" height="3" rx="1.5" fill="${["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"][i % 5]}" transform="rotate(${(i * 37) % 180} ${(i * 47) % 190 + 3} ${(i * 71) % 190 + 1})"/>`).join("")
  }[fundo.padrao] || "";
  const estrelas = fundo.id === "galaxia" ? [[30, 40], [160, 30], [150, 150], [40, 160], [100, 20], [175, 95], [20, 110]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff"/>`).join("") : "";

  // ----- cabelo: B = atrás da cabeça, F = na frente (franja/topo), O = mechas por cima dos ombros -----
  const capa = "M46 98 C40 50 66 26 100 26 C134 26 160 50 154 98";
  const longoTras = `${capa} L160 178 Q100 190 40 178Z`;
  const repartido = "M47 100 C42 52 66 28 100 28 C134 28 158 52 153 100 C150 78 138 58 102 46 C66 58 50 78 47 100Z";
  const preso = "M48 92 C44 50 68 28 100 28 C132 28 156 50 152 92 C148 70 130 56 100 56 C70 56 52 70 48 92Z";
  const mechas = espelho(`<path d="M47 92 C44 128 42 158 48 186 Q56 190 64 186 C58 158 56 126 57 100Z" fill="url(#${id}hc)" stroke="${cabS}" stroke-width="2.4"/>`) + espelho(Hb("M51 110 C50 136 50 160 54 180"));
  const curvaCachos = (cx, cy, r, n, r2) => Array.from({ length: n }, (_, i) => { const t = Math.PI * (1 + i / (n - 1)); return [Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), r2]; });
  const curtoF = H("M47 96 C42 52 66 28 100 28 C136 28 158 52 153 96 C150 84 148 74 142 66 C130 62 116 58 104 52 C96 60 80 64 62 66 C54 74 50 84 47 96Z") + Hb("M70 44 Q84 36 100 37") + Hb("M114 36 Q132 40 142 54");
  const C = {
    curto: { F: curtoF },
    social: { F: H("M47 96 C42 52 66 28 100 28 C134 28 158 52 153 96 C150 82 146 72 140 66 C120 56 96 58 78 52 C70 60 58 62 54 72 C50 80 48 88 47 96Z") + `<path d="M78 52 Q80 40 92 32" fill="none" stroke="${cabS}" stroke-width="1.4"/>` + Hb("M98 36 Q124 36 140 52") },
    topete: { F: H("M48 94 C44 58 58 40 72 36 C74 18 108 8 134 20 C150 28 158 52 152 94 C148 78 142 68 134 64 C116 60 96 60 72 64 C62 68 52 80 48 94Z") + Hb("M80 30 Q100 16 126 22") + Hb("M74 44 Q96 32 132 38") },
    pixie: { F: H("M48 100 C42 52 66 28 100 28 C134 28 158 52 152 94 C150 82 146 72 140 66 C124 72 104 76 84 84 C70 90 58 86 52 94 Z") + Hb("M70 42 Q96 32 130 40") + Hb("M128 60 Q110 70 88 76") },
    chanel: { B: H("M44 96 C40 50 66 26 100 26 C134 26 160 50 156 96 L158 134 Q146 142 134 136 L66 136 Q54 142 42 134Z"),
      F: H("M46 100 C42 52 66 28 100 28 C134 28 158 52 154 100 L157 134 Q150 140 141 135 C146 110 146 86 136 68 C120 60 100 56 84 50 C76 62 62 66 58 78 C54 92 54 112 59 135 Q50 140 43 134Z") + Hb("M64 46 Q86 32 116 34") + Hb("M146 80 Q150 104 148 126") },
    longo: { B: H(longoTras), F: H(repartido) + Hb("M64 50 Q80 36 98 34") + Hb("M106 34 Q126 38 140 54"), O: mechas },
    franja: { B: H(`${capa} L158 150 Q100 160 42 150Z`),
      F: H("M46 104 C40 52 66 28 100 28 C134 28 160 52 154 104 L150 104 C150 92 149 84 147 78 L140 82 L134 76 L127 82 L120 76 L113 82 L106 76 L99 82 L92 76 L85 82 L78 76 L71 82 L64 76 L57 82 L53 78 C51 84 50 92 50 104Z") + Hb("M66 44 Q100 30 134 44") },
    ondulado: { B: H("M46 96 C40 50 66 26 100 26 C134 26 160 50 154 96 C164 116 150 132 160 150 C166 166 152 178 144 180 L56 180 C48 178 34 166 40 150 C50 132 36 116 46 96Z"),
      F: H("M47 100 C42 52 66 28 100 28 C134 28 158 52 153 100 C150 82 140 66 118 58 C108 70 88 60 76 66 C62 72 54 84 47 100Z") + Hb("M62 48 Q84 34 112 36"),
      O: espelho(`<path d="M47 94 C40 116 54 132 44 152 C38 166 48 182 58 184 Q64 176 60 164 C66 146 52 128 58 104Z" fill="url(#${id}hc)" stroke="${cabS}" stroke-width="2.4"/>`) },
    cacheado: { B: bolas([[52, 70], [60, 48], [80, 34], [100, 30], [120, 34], [140, 48], [148, 70], [46, 96], [154, 96], [50, 120], [150, 120]], 18),
      F: bolas([[58, 64, 12], [72, 52, 12], [88, 46, 12], [104, 44, 12], [120, 48, 12], [134, 56, 12], [144, 68, 11]]) + Hb("M84 40 q4 -4 8 0") + Hb("M116 42 q4 -4 8 0") },
    "cachos-longos": { B: H(longoTras) + bolas([[42, 100], [40, 124], [42, 148], [46, 172], [158, 100], [160, 124], [158, 148], [154, 172], [70, 180], [100, 184], [130, 180]], 14),
      F: bolas([[56, 70, 13], [66, 54, 13], [82, 44, 13], [100, 40, 13], [118, 44, 13], [134, 54, 13], [146, 70, 13]]),
      O: espelho(bolas([[50, 112], [48, 134], [52, 156], [56, 176]], 11)) },
    afrocurto: { F: bolas(curvaCachos(100, 74, 46, 13, 11)) + bolas([[76, 44, 13], [100, 38, 14], [124, 44, 13], [88, 52, 12], [112, 52, 12]]) },
    black: { B: `<circle cx="100" cy="74" r="66" fill="url(#${id}hc)"/>` + bolas(Array.from({ length: 22 }, (_, i) => { const t = 2 * Math.PI * i / 22; return [Math.round(100 + 64 * Math.cos(t)), Math.round(74 + 64 * Math.sin(t))]; }).filter(([, y]) => y < 130), 14),
      F: bolas([[54, 80, 11], [60, 66, 12], [72, 56, 12], [86, 50, 12], [100, 48, 12], [114, 50, 12], [128, 56, 12], [140, 66, 12], [146, 80, 11]]) },
    puffs: { B: bolas(curvaCachos(42, 50, 20, 8, 12).concat(curvaCachos(158, 50, 20, 8, 12)).concat([[36, 46, 22], [164, 46, 22], [44, 60, 16], [156, 60, 16]])),
      F: H(preso) + `<path d="M100 28 L100 56" stroke="${cabS}" stroke-width="1.4"/>` + `<rect x="54" y="48" width="10" height="8" rx="3" fill="${ac}" transform="rotate(-40 59 52)"/><rect x="136" y="48" width="10" height="8" rx="3" fill="${ac}" transform="rotate(40 141 52)"/>` },
    rabo: { B: H("M138 46 C176 56 182 108 168 154 C160 134 158 112 148 96Z") + Hb("M160 70 Q172 100 166 136"), F: H(preso) + Hb("M70 46 Q100 36 136 46") + `<circle cx="144" cy="52" r="6" fill="${ac}" stroke="${escuro(ac)}"/>` },
    coque: { B: `<circle cx="100" cy="24" r="19" fill="url(#${id}hc)" stroke="${cabS}" stroke-width="2.4"/>` + Hb("M90 14 Q100 8 110 14"), F: H(preso) + Hb("M70 46 Q100 36 130 46") },
    "meio-coque": { B: H(longoTras) + `<circle cx="100" cy="24" r="15" fill="url(#${id}hc)" stroke="${cabS}" stroke-width="2.4"/>`, F: H(repartido) + Hb("M64 50 Q80 36 98 34"), O: mechas },
    maria: { B: `<ellipse cx="34" cy="86" rx="15" ry="24" fill="url(#${id}hc)" stroke="${cabS}" stroke-width="2.4" transform="rotate(18 34 86)"/><ellipse cx="166" cy="86" rx="15" ry="24" fill="url(#${id}hc)" stroke="${cabS}" stroke-width="2.4" transform="rotate(-18 166 86)"/>`,
      F: H(repartido) + `<circle cx="46" cy="66" r="5" fill="${ac}"/><circle cx="154" cy="66" r="5" fill="${ac}"/>` + Hb("M64 50 Q80 36 98 34") },
    mullet: { B: H("M50 96 L44 156 Q72 166 100 162 Q128 166 156 156 L150 96Z"), F: curtoF },
    nago: { F: H("M48 92 C44 52 68 32 100 32 C132 32 156 52 152 92 C148 74 138 64 126 60 C110 56 90 56 74 60 C62 64 52 74 48 92Z") +
      [-36, -20, -6, 6, 20, 36].map(d => `<path d="M${100 + d} 58 Q${100 + d * 1.15} 44 ${100 + d * .7} 33" fill="none" stroke="${cabL}" stroke-width="2.2" stroke-dasharray="3 2" opacity=".6"/>`).join("") },
    raspado: { F: `<path d="M50 92 C46 54 68 36 100 36 C132 36 154 54 150 92 C146 76 140 66 132 62 C112 58 88 58 68 62 C60 66 54 76 50 92Z" fill="${cab}" opacity=".55"/>` },
    lateral: { F: `<path d="M48 92 C46 70 50 58 58 52 L64 78 C56 80 52 86 48 92Z" fill="${cab}" opacity=".45"/>` + H("M58 70 C60 38 84 26 106 26 C136 26 158 48 153 96 C150 80 146 70 138 64 C118 62 96 70 74 78 C66 78 60 76 58 70Z") + Hb("M76 40 Q104 28 136 44") },
    careca: { F: `<ellipse cx="82" cy="56" rx="13" ry="6" fill="#fff" opacity=".3" transform="rotate(-20 82 56)"/>` },
    espetado: { F: H("M48 88 L44 56 L58 62 L60 34 L76 50 L84 20 L98 44 L110 16 L120 44 L136 26 L138 56 L156 52 L152 88 C146 72 130 62 100 62 C70 62 54 72 48 88Z") + Hb("M84 30 L92 46") + Hb("M110 26 L114 44") },
    moicano: { F: `<path d="M50 90 C46 54 68 36 100 36 C132 36 154 54 150 90 C144 72 130 62 100 62 C70 62 56 72 50 90Z" fill="${cab}" opacity=".35"/>` + H("M86 66 L80 30 L92 38 L94 14 L104 30 L112 12 L114 34 L124 24 L116 66Z") },
    trancas: { F: H(repartido) + `<path d="M100 28 L102 46" stroke="${cabS}" stroke-width="1.4"/>`,
      B: H("M48 96 C44 50 66 28 100 28 C134 28 156 50 152 96 L150 120 L50 120Z"),
      O: espelho(`<g>${[0, 1, 2, 3, 4, 5, 6].map(i => `<ellipse cx="${52 - i * .4}" cy="${104 + i * 12}" rx="8" ry="7.5" fill="url(#${id}hc)" stroke="${cabS}" stroke-width="1.3"/>`).join("")}<rect x="45" y="184" width="12" height="6" rx="3" fill="${ac}"/></g>`) },
    dread: { B: H("M48 96 C44 50 66 28 100 28 C134 28 156 50 152 96 L150 126 Q100 140 50 126Z"),
      F: H("M48 92 C44 52 68 30 100 30 C132 30 156 52 152 92 C148 74 132 62 100 60 C68 62 52 74 48 92Z") + [70, 86, 100, 114, 130].map(x => `<path d="M${x} 36 L${x + (x - 100) * .3} 60" stroke="${cabS}" stroke-width="1.3" opacity=".6"/>`).join(""),
      O: espelho(`<path d="M50 96 L46 182" stroke="${cabS}" stroke-width="10" stroke-linecap="round"/><path d="M50 96 L46 182" stroke="${cab}" stroke-width="7.5" stroke-linecap="round" stroke-dasharray="5 1.5"/>`) }
  };
  const cabelo = C[a.cabelo] || {};

  // ----- orelhas e brincos -----
  const orelha = {
    normal: `<path d="M${ex + 6} 88 C${ex - 6} 84 ${ex - 12} 94 ${ex - 9} 104 C${ex - 7} 112 ${ex - 2} 116 ${ex + 6} 114Z"/>`,
    pequena: `<path d="M${ex + 6} 92 C${ex - 3} 89 ${ex - 8} 96 ${ex - 6} 103 C${ex - 5} 108 ${ex - 1} 111 ${ex + 6} 110Z"/>`,
    grande: `<path d="M${ex + 6} 84 C${ex - 9} 78 ${ex - 17} 92 ${ex - 13} 106 C${ex - 10} 116 ${ex - 3} 120 ${ex + 6} 117Z"/>`,
    redonda: `<path d="M${ex + 6} 88 C${ex - 10} 84 ${ex - 13} 112 ${ex + 6} 113Z"/>`,
    pontuda: `<path d="M${ex + 6} 90 L${ex - 16} 72 C${ex - 14} 88 ${ex - 10} 100 ${ex - 8} 106 C${ex - 6} 112 ${ex - 1} 116 ${ex + 6} 114Z"/>`
  }[a.orelha] || "";
  const orelhas = espelho(`<g fill="${pele}" stroke="${linha}" stroke-width="2.4" stroke-linejoin="round">${orelha}</g><path d="M${ex + 2} 96 C${ex - 4} 96 ${ex - 5} 104 ${ex} 107" fill="none" stroke="${peleS}" stroke-width="2.2" stroke-linecap="round"/>`);
  const ly = { grande: 116, pequena: 109 }[a.orelha] || 112, lx = ex - 3; // lóbulo
  const brinco = {
    ponto: `<circle cx="${lx}" cy="${ly}" r="2.4" fill="${joia}" stroke="${escuro(joia)}" stroke-width=".8"/>`,
    perola: `<circle cx="${lx}" cy="${ly + 1}" r="3.3" fill="#f8fafc" stroke="#cbd5e1"/><circle cx="${lx - 1}" cy="${ly}" r="1" fill="#fff"/>`,
    argola: `<circle cx="${lx}" cy="${ly + 5}" r="5" fill="none" stroke="${joia}" stroke-width="2"/>`,
    "argola-grande": `<circle cx="${lx - 1}" cy="${ly + 10}" r="9.5" fill="none" stroke="${joia}" stroke-width="2.3"/>`,
    pendente: `<path d="M${lx} ${ly} L${lx} ${ly + 6}" stroke="${joia}" stroke-width="1.2"/><path d="M${lx} ${ly + 5} C${lx - 4} ${ly + 11} ${lx - 3} ${ly + 15} ${lx} ${ly + 15} C${lx + 3} ${ly + 15} ${lx + 4} ${ly + 11} ${lx} ${ly + 5}Z" fill="${joia}" stroke="${escuro(joia)}" stroke-width=".8"/>`,
    varios: `<circle cx="${lx}" cy="${ly}" r="2" fill="${joia}"/><circle cx="${lx - 5}" cy="${ly - 7}" r="1.8" fill="${joia}"/><circle cx="${lx - 7}" cy="${ly - 15}" r="1.8" fill="${joia}"/>`,
    alargador: `<circle cx="${lx}" cy="${ly}" r="4" fill="${escuro(pele, .6)}" stroke="${joia}" stroke-width="1.6"/>`,
    estrela: `<path d="M${lx} ${ly - 1} l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.8-3.3 1.8.8-3.6-2.7-2.4 3.6-.4z" fill="${joia}" stroke="${escuro(joia)}" stroke-width=".6"/>`
  }[a.brinco] || "";

  // ----- pescoço e roupa -----
  const pescoco = `<path d="M${100 - N} 118 L${100 - N} ${topo - 4} Q${100 - N} ${topo + 2} ${100 - N - 12} ${topo + 4} L${100 - N - 12} ${topo + 34} L${100 + N + 12} ${topo + 34} L${100 + N + 12} ${topo + 4} Q${100 + N} ${topo + 2} ${100 + N} ${topo - 4} L${100 + N} 118Z" fill="${pele}" stroke="${linha}" stroke-width="2.4"/>
    <path d="M${100 - N} 140 L${100 - N} 148 Q100 164 ${100 + N} 148 L${100 + N} 140Z" fill="${peleS}" opacity=".8"/>`;
  const pomo = fem ? "" : `<path d="M96.5 ${topo - 15} Q100 ${topo - 10} 103.5 ${topo - 15}" fill="none" stroke="${OUT}" stroke-width="1.6" stroke-linecap="round" opacity=".35"/>`;
  const ombrosPele = `<path d="${T(`L${100 - N - 12} ${topo - 1} Q100 ${topo + 30} ${100 + N + 12} ${topo - 1}`)}" fill="${pele}" stroke="${linha}" stroke-width="2.4"/>`;
  const R = {
    camiseta: () => pano(T(), roupa) + bracos(roupa) + `<path d="M${100 - N - 6} ${topo - 1} Q100 ${topo + 13} ${100 + N + 6} ${topo - 1}" fill="none" stroke="${roupaS}" stroke-width="3"/>`,
    decote: () => pano(T(golaV), roupa) + bracos(roupa) + `<path d="M${100 - N - 5} ${topo - 1} L100 ${topo + 24} L${100 + N + 5} ${topo - 1}" fill="none" stroke="${roupaS}" stroke-width="3" stroke-linejoin="round"/>`,
    regata: () => ombrosPele + pano(`M${100 - S * .55} ${topo + 2} L${100 - N - 8} ${topo + 2} Q100 ${topo + 26} ${100 + N + 8} ${topo + 2} L${100 + S * .55} ${topo + 2} Q${100 + S * .6} 190 ${100 + S * .72} 212 L${100 - S * .72} 212 Q${100 - S * .6} 190 ${100 - S * .55} ${topo + 2}Z`, roupa),
    gola: () => pano(T(), roupa) + bracos(roupa) + `<path d="M${100 - N - 8} ${topo - 3} L${100 - 4} ${topo + 16} L${100 - N - 18} ${topo + 10}Z M${100 + N + 8} ${topo - 3} L${100 + 4} ${topo + 16} L${100 + N + 18} ${topo + 10}Z" fill="${claro(roupa, .15)}" stroke="${roupaS}" stroke-width="1.5" stroke-linejoin="round"/><path d="M100 ${topo + 12} L100 ${topo + 30}" stroke="${roupaS}" stroke-width="1.5"/><circle cx="100" cy="${topo + 20}" r="1.6" fill="#fff"/><circle cx="100" cy="${topo + 27}" r="1.6" fill="#fff"/>`,
    social: () => pano(T(golaV), roupa) + bracos(roupa) + `<path d="M${100 - N - 7} ${topo - 3} L100 ${topo + 18} L${100 - N - 16} ${topo + 12}Z M${100 + N + 7} ${topo - 3} L100 ${topo + 18} L${100 + N + 16} ${topo + 12}Z" fill="#fff" stroke="#cbd5e1" stroke-width="1.4" stroke-linejoin="round"/><path d="M96 ${topo + 14} L104 ${topo + 14} L102 ${topo + 18} L106 ${topo + 44} L100 ${topo + 50} L94 ${topo + 44} L98 ${topo + 18}Z" fill="${roupa === "#111827" ? "#c1272d" : "#111827"}"/>`,
    golaalta: () => pano(T(), roupa) + bracos(roupa) + pano(`M${100 - N - 3} ${topo - 20} Q100 ${topo - 14} ${100 + N + 3} ${topo - 20} L${100 + N + 6} ${topo + 4} Q100 ${topo + 10} ${100 - N - 6} ${topo + 4}Z`, claro(roupa, .08)) + [-6, 0, 6].map(d => `<path d="M${100 + d} ${topo - 14} L${100 + d * 1.2} ${topo + 6}" stroke="${roupaS}" stroke-width="1" opacity=".5"/>`).join(""),
    moletom: () => pano(`M${100 - N - 22} ${topo + 4} Q100 ${topo - 20} ${100 + N + 22} ${topo + 4} L${100 + N + 14} ${topo + 14} Q100 ${topo} ${100 - N - 14} ${topo + 14}Z`, escuro(roupa, .12)) + pano(T(), roupa) + bracos(roupa) +
      `<path d="M${100 - N - 8} ${topo - 1} Q100 ${topo + 16} ${100 + N + 8} ${topo - 1}" fill="none" stroke="${roupaS}" stroke-width="3.5"/><path d="M94 ${topo + 10} L92 ${topo + 32} M106 ${topo + 10} L108 ${topo + 32}" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M${100 - S * .45} 212 L${100 - S * .38} 196 L${100 + S * .38} 196 L${100 + S * .45} 212" fill="none" stroke="${roupaS}" stroke-width="1.6"/>`,
    sueter: () => pano(T(), roupa) + bracos(roupa) + `<clipPath id="${id}r"><path d="${T()}"/></clipPath><g clip-path="url(#${id}r)"><path d="M0 ${topo + 26} ${Array.from({ length: 21 }, (_, i) => `L${i * 10} ${topo + 20 + (i % 2) * 8}`).join(" ")}" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>${Array.from({ length: 10 }, (_, i) => `<circle cx="${i * 20 + 5}" cy="${topo + 34}" r="2" fill="#fff" opacity=".8"/>`).join("")}</g>` +
      `<path d="M${100 - N - 6} ${topo - 1} Q100 ${topo + 13} ${100 + N + 6} ${topo - 1}" fill="none" stroke="${roupaS}" stroke-width="5" stroke-dasharray="2 1.5"/>`,
    jaqueta: () => pano(T(golaV), roupa) + bracos(roupa) + `<path d="M${100 - N - 6} ${topo - 3} L100 ${topo + 24} L${100 - N - 20} ${topo + 18}Z M${100 + N + 6} ${topo - 3} L100 ${topo + 24} L${100 + N + 20} ${topo + 18}Z" fill="${escuro(roupa, .15)}" stroke="${roupaS}" stroke-width="1.4"/><path d="M100 ${topo + 24} L100 212" stroke="${roupaS}" stroke-width="2"/><path d="M100 ${topo + 26} L100 212" stroke="#d1d5db" stroke-width="1" stroke-dasharray="2 2"/><path d="M${100 - S * .5} 198 L${100 - S * .2} 198 M${100 + S * .2} 198 L${100 + S * .5} 198" stroke="${roupaS}" stroke-width="1.5"/>`,
    listrada: () => pano(T(), roupa) + `<clipPath id="${id}r"><path d="${T()}"/></clipPath><g clip-path="url(#${id}r)" stroke="#fff" stroke-width="5" opacity=".75">${[topo + 10, topo + 22, topo + 34, topo + 46].map(y => `<path d="M0 ${y} L200 ${y}"/>`).join("")}</g>` + bracos(roupa) + `<path d="M${100 - N - 6} ${topo - 1} Q100 ${topo + 13} ${100 + N + 6} ${topo - 1}" fill="none" stroke="${roupaS}" stroke-width="3"/>`,
    jardineira: () => pano(T(), "#f8fafc") + bracos("#f8fafc") + `<path d="M${100 - N - 6} ${topo - 1} Q100 ${topo + 13} ${100 + N + 6} ${topo - 1}" fill="none" stroke="#cbd5e1" stroke-width="2.5"/>` +
      pano(`M${100 - S * .42} 212 L${100 - S * .36} ${topo + 22} L${100 + S * .36} ${topo + 22} L${100 + S * .42} 212Z`, roupa) + `<path d="M${100 - S * .34} ${topo + 24} L${100 - S * .56} ${topo + 2} M${100 + S * .34} ${topo + 24} L${100 + S * .56} ${topo + 2}" stroke="${roupa}" stroke-width="6" stroke-linecap="round"/><circle cx="${100 - S * .3}" cy="${topo + 27}" r="2.6" fill="#facc15"/><circle cx="${100 + S * .3}" cy="${topo + 27}" r="2.6" fill="#facc15"/><rect x="92" y="${topo + 30}" width="16" height="10" rx="2" fill="none" stroke="${roupaS}" stroke-width="1.4"/>`,
    quimono: () => pano(T(golaV), roupa) + bracos(roupa) + `<path d="M${100 - N - 5} ${topo - 1} L${100 + 6} ${topo + 32} M${100 + N + 5} ${topo - 1} L100 ${topo + 22}" stroke="#fff" stroke-width="5" stroke-linecap="round"/><rect x="${100 - S}" y="${topo + 34}" width="${2 * S}" height="8" fill="${escuro(roupa, .3)}"/>`,
    jaleco: () => pano(T(golaV), "#f8fafc") + bracos("#f8fafc") + `<path d="M${100 - N - 5} ${topo - 1} L100 ${topo + 24} L${100 + N + 5} ${topo - 1}" fill="${roupa}"/><path d="M${100 - N - 6} ${topo - 3} L100 ${topo + 26} L${100 - N - 22} ${topo + 22}Z M${100 + N + 6} ${topo - 3} L100 ${topo + 26} L${100 + N + 22} ${topo + 22}Z" fill="#fff" stroke="#cbd5e1" stroke-width="1.4"/><path d="M100 ${topo + 26} L100 212" stroke="#cbd5e1" stroke-width="2"/><rect x="${100 + S * .3}" y="${topo + 26}" width="26" height="10" rx="2" fill="#c1272d"/><text x="${100 + S * .3 + 13}" y="${topo + 34}" font-size="7" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="bold">SENAI</text>`,
    capa: () => pano(T(), roupa) + bracos(roupa) + `<path d="M${100 - N - 6} ${topo - 1} Q100 ${topo + 13} ${100 + N + 6} ${topo - 1}" fill="none" stroke="${roupaS}" stroke-width="3"/><circle cx="100" cy="${topo + 26}" r="11" fill="#fde047" stroke="#ca8a04"/><text x="100" y="${topo + 31}" font-size="13" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#dc2626">★</text><path d="M${100 - N - 14} ${topo + 2} Q${100 - N - 6} ${topo + 10} ${100 - N - 4} ${topo + 2} M${100 + N + 14} ${topo + 2} Q${100 + N + 6} ${topo + 10} ${100 + N + 4} ${topo + 2}" fill="#dc2626"/>`,
    terno: () => pano(T(golaV), "#111827") + bracos("#334155") + `<path d="M${100 - N - 5} ${topo - 1} L100 ${topo + 24} L${100 + N + 5} ${topo - 1}" fill="#fff"/><path d="M${100 - N - 6} ${topo - 3} L100 ${topo + 34} L${100 - N - 24} ${topo + 24}Z M${100 + N + 6} ${topo - 3} L100 ${topo + 34} L${100 + N + 24} ${topo + 24}Z" fill="#1f2937" stroke="#000" stroke-width="1"/><path d="M96 ${topo + 4} L104 ${topo + 4} L102 ${topo + 8} L104 ${topo + 26} L100 ${topo + 30} L96 ${topo + 26} L98 ${topo + 8}Z" fill="${roupa}"/><path d="M${100 + S * .45} ${topo + 22} l4 -4 l4 4" fill="none" stroke="#fff" stroke-width="2"/>`,
    time: () => pano(T(), roupa) + `<clipPath id="${id}r"><path d="${T()}"/></clipPath><g clip-path="url(#${id}r)"><path d="M${100 - S + 18} ${topo} L${100 - S + 18} 212 M${100 + S - 18} ${topo} L${100 + S - 18} 212" stroke="#fff" stroke-width="7"/></g><text x="100" y="${Math.min(206, topo + 36)}" font-size="22" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#fff" stroke="${roupaS}" stroke-width=".8">10</text><path d="M${100 - N - 6} ${topo - 1} Q100 ${topo + 13} ${100 + N + 6} ${topo - 1}" fill="none" stroke="#fff" stroke-width="3"/>`,
    astronauta: () => pano(T(), "#e5e7eb") + bracos("#e5e7eb") + `<path d="M${100 - N - 14} ${topo - 1} Q100 ${topo + 18} ${100 + N + 14} ${topo - 1}" fill="none" stroke="#94a3b8" stroke-width="6"/><rect x="82" y="${topo + 16}" width="36" height="22" rx="4" fill="#64748b"/><circle cx="92" cy="${topo + 27}" r="3" fill="#22c55e"/><circle cx="102" cy="${topo + 27}" r="3" fill="#ef4444"/><circle cx="112" cy="${topo + 27}" r="3" fill="#3b82f6"/><rect x="${100 - S + 22}" y="${topo + 14}" width="14" height="9" fill="${roupa}"/>`
  };
  const capaTras = a.roupa === "capa" ? `<path d="M${100 - S - 12} 212 Q${100 - S} ${topo - 6} 100 ${topo - 10} Q${100 + S} ${topo - 6} ${100 + S + 12} 212Z" fill="#dc2626" stroke="#991b1b" stroke-width="1.8"/>` : "";
  const corpo = (R[a.roupa] || R.camiseta)();

  const colar = {
    colar: `<path d="M${100 - N - 3} ${topo - 3} Q100 ${topo + 17} ${100 + N + 3} ${topo - 3}" fill="none" stroke="${joia}" stroke-width="1.8" stroke-dasharray="2 1.2"/>`,
    pingente: `<path d="M${100 - N - 3} ${topo - 3} Q100 ${topo + 15} ${100 + N + 3} ${topo - 3}" fill="none" stroke="${joia}" stroke-width="1.4"/><path d="M100 ${topo + 18} l-5 -5 a3 3 0 0 1 5 -3 a3 3 0 0 1 5 3z" fill="${joia}" stroke="${escuro(joia)}" stroke-width=".8"/>`,
    perolas: Array.from({ length: 9 }, (_, i) => { const t = i / 8, x = (1 - t) * (1 - t) * (100 - N - 3) + 2 * (1 - t) * t * 100 + t * t * (100 + N + 3), y = (1 - t) * (1 - t) * (topo - 3) + 2 * (1 - t) * t * (topo + 15) + t * t * (topo - 3);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="#f8fafc" stroke="#cbd5e1" stroke-width=".7"/>`; }).join(""),
    choker: `<path d="M${100 - N} ${topo - 12} Q100 ${topo - 6} ${100 + N} ${topo - 12}" fill="none" stroke="${joia === "#f8fafc" ? "#111827" : joia}" stroke-width="3.5"/><circle cx="100" cy="${topo - 6}" r="2" fill="${joia}"/>`,
    gravata: `<path d="M100 ${topo + 2} L88 ${topo - 5} L88 ${topo + 9}Z M100 ${topo + 2} L112 ${topo - 5} L112 ${topo + 9}Z" fill="${ac}" stroke="${escuro(ac)}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="100" cy="${topo + 2}" r="3.2" fill="${escuro(ac, .15)}"/>`,
    cachecol: pano(`M${100 - N - 14} ${topo - 10} Q100 ${topo + 4} ${100 + N + 14} ${topo - 10} L${100 + N + 16} ${topo + 2} Q100 ${topo + 18} ${100 - N - 16} ${topo + 2}Z`, ac) + pano(`M${100 + 4} ${topo + 6} L${100 + 16} ${topo + 6} L${100 + 18} ${topo + 40} L${100 + 6} ${topo + 40}Z`, escuro(ac, .08)) + `<path d="M${100 + 7} ${topo + 40} l0 4 M${100 + 11} ${topo + 40} l0 4 M${100 + 15} ${topo + 40} l0 4" stroke="${ac}" stroke-width="1.5"/>`,
    cracha: `<path d="M${100 - N - 4} ${topo - 2} L${100 + S * .25} ${topo + 24} M${100 + N + 4} ${topo - 2} L${100 + S * .25 + 6} ${topo + 24}" stroke="#c1272d" stroke-width="2.6"/><rect x="${100 + S * .25 - 8}" y="${topo + 22}" width="22" height="28" rx="3" fill="#fff" stroke="#94a3b8"/><rect x="${100 + S * .25 - 8}" y="${topo + 22}" width="22" height="8" rx="2" fill="#c1272d"/><circle cx="${100 + S * .25 + 3}" cy="${topo + 38}" r="4" fill="#cbd5e1"/>`,
    medalha: `<path d="M${100 - N - 2} ${topo - 4} L96 ${topo + 18} M${100 + N + 2} ${topo - 4} L104 ${topo + 18}" stroke="#1d4ed8" stroke-width="4"/><circle cx="100" cy="${topo + 24}" r="8" fill="#facc15" stroke="#b45309" stroke-width="1.5"/><text x="100" y="${topo + 28}" font-size="9" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#b45309">1</text>`
  }[a.pescoco] || "";

  // ----- rosto -----
  const cabeca = `<path d="${rostoD}" fill="url(#${id}pg)" stroke="${linha}" stroke-width="2.8"/>`;
  const sardas = `<g fill="${escuro(pele, .4)}" opacity=".55">${[[66, 112], [72, 116], [62, 117], [70, 121], [76, 111], [134, 112], [128, 116], [138, 117], [130, 121], [124, 111]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4"/>`).join("")}</g>`;
  const blush = (cor, op) => (op = fem ? op : op * .5, `<ellipse cx="70" cy="117" rx="10" ry="6" fill="${cor}" opacity="${op}"/><ellipse cx="130" cy="117" rx="10" ry="6" fill="${cor}" opacity="${op}"/>`);
  const bochecha = {
    rosada: blush("#f472b6", .28), corada: blush("#ef4444", .42), pessego: blush("#fb923c", .35), sardas, "sardas-rosada": blush("#f472b6", .25) + sardas,
    covinhas: blush("#f472b6", .15) + `<path d="M82 126 q-2 3 0 6 M118 126 q2 3 0 6" fill="none" stroke="${linha}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>`,
    brilho: blush("#f472b6", .2) + `<ellipse cx="66" cy="112" rx="5" ry="2.5" fill="#fff" opacity=".55"/><ellipse cx="134" cy="112" rx="5" ry="2.5" fill="#fff" opacity=".55"/>`
  }[a.bochecha] || "";
  const detalhe = {
    pinta: `<circle cx="128" cy="124" r="2.2" fill="${escuro(pele, .65)}"/>`,
    curativo: `<g transform="rotate(-20 128 114)"><rect x="116" y="109" width="24" height="9" rx="4" fill="#fcd9a8" stroke="#e7b37c" stroke-width=".8"/><rect x="125" y="109" width="6" height="9" fill="#f5c08a"/></g>`,
    cicatriz: `<path d="M124 76 L132 96" stroke="${escuro(pele, .3)}" stroke-width="2" stroke-linecap="round"/><path d="M125 82 l5 -2 M127 88 l5 -2" stroke="${escuro(pele, .3)}" stroke-width="1.2"/>`,
    piercing: `<circle cx="106" cy="116" r="2.6" fill="none" stroke="${joia}" stroke-width="1.4"/>`,
    pintura: `<g><rect x="62" y="110" width="14" height="4" fill="${roupa}"/><rect x="62" y="116" width="14" height="4" fill="#fff"/><rect x="124" y="110" width="14" height="4" fill="${roupa}"/><rect x="124" y="116" width="14" height="4" fill="#fff"/></g>`,
    brilho: `<g fill="#fde047" stroke="#f59e0b" stroke-width=".6">${[[60, 84], [144, 84], [140, 130]].map(([x, y]) => `<path d="M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2}Z"/>`).join("")}</g>`
  }[a.detalhe] || "";
  const sombraCor = { rosa: "#f472b6", dourada: "#eab308", azul: "#3b82f6", roxa: "#8b5cf6", esfumada: "#374151", glitter: "#c084fc" }[a.maquiagem];
  const maquiagem = sombraCor ? `<g fill="${sombraCor}" opacity="${a.maquiagem === "esfumada" ? .4 : .45}"><ellipse cx="80" cy="93" rx="11" ry="5.5"/><ellipse cx="120" cy="93" rx="11" ry="5.5"/></g>` +
    (a.maquiagem === "glitter" ? `<g fill="#fff">${[[74, 91], [80, 89], [86, 92], [114, 92], [120, 89], [126, 91]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9"/>`).join("")}</g>` : "") : "";
  const nariz = {
    botao: `<ellipse cx="101" cy="111" rx="${fem ? 4.2 : 5.2}" ry="${fem ? 3.2 : 4}" fill="${peleS}" opacity=".6"/><circle cx="99" cy="109.5" r="1.4" fill="#fff" opacity=".6"/>` +
      `<path d="M${fem ? 95 : 93.5} 115 Q100 ${fem ? 119 : 120} ${fem ? 106 : 107.5} 114" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`,
    redondo: `<ellipse cx="100" cy="113" rx="6.5" ry="5" fill="${peleS}" opacity=".55"/><path d="M95 116 q2 1.6 3 0 M102 116 q1 1.6 3 0" fill="none" stroke="${linha}" stroke-width="1.5" stroke-linecap="round"/>`,
    pontudo: `<path d="M101 100 L95 116 L102 117" fill="none" stroke="${linha}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    largo: `<path d="M92 115 Q93 109 97 110 M108 115 Q107 109 103 110 M93 116 Q100 121 107 116" fill="none" stroke="${linha}" stroke-width="1.7" stroke-linecap="round"/><path d="M98 100 L97 108" stroke="${peleS}" stroke-width="2" stroke-linecap="round"/>`,
    arrebitado: `<path d="M98 104 Q105 113 101 116 Q98 118 95 115" fill="none" stroke="${linha}" stroke-width="1.8" stroke-linecap="round"/>`,
    linha: `<path d="M100 104 L100 114" stroke="${linha}" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`,
    pontinhos: `<circle cx="97" cy="114" r="1.5" fill="${linha}"/><circle cx="103" cy="114" r="1.5" fill="${linha}"/>`
  }[a.nariz] || "";

  // olhos: cada estilo desenha um olho em (x, 98); "topo" = altura da pálpebra para os cílios
  // estilo dos mascotes: branco com contorno, íris oval com dois brilhos e pálpebra grossa.
  // masculino: olho mais estreito, pálpebra mais baixa e reta, sem cílios · feminino: olho maior e um cílio no canto de fora
  const eRx = fem ? 9.2 : 8.8, eRy = fem ? 10 : 7.4, iR = fem ? 5.4 : 4.6;
  const brilhoOlho = (x, y, r = 1.6) => `<circle cx="${x - r * .9}" cy="${y - r * 1.1}" r="${r}" fill="#fff"/>`;
  const iris = (x, y, r, dx = 0) => `<ellipse cx="${x + dx}" cy="${y + .6}" rx="${r}" ry="${+(r + .9).toFixed(1)}" fill="${olho}"/><ellipse cx="${x + dx}" cy="${y + .6}" rx="${+(r * .9).toFixed(1)}" ry="${+(r * .5).toFixed(1)}" fill="${escuro(olho, .25)}" opacity=".5" transform="translate(0 ${-r * .45})"/>` +
    `<circle cx="${x + dx}" cy="${y + 1}" r="${+(r * .52).toFixed(1)}" fill="#140c08"/><circle cx="${+(x + dx - r * .38).toFixed(1)}" cy="${+(y - r * .42).toFixed(1)}" r="${+(r * .36).toFixed(1)}" fill="#fff"/><circle cx="${+(x + dx + r * .42).toFixed(1)}" cy="${+(y + r * .55).toFixed(1)}" r="${+(r * .17).toFixed(1)}" fill="#fff" opacity=".9"/>`;
  const oval = (x, y) => `M${x - eRx} ${y} A${eRx} ${eRy} 0 0 1 ${x + eRx} ${y} A${eRx} ${eRy} 0 0 1 ${x - eRx} ${y}Z`;
  const palp = (x, y, lado = -1) => (fem
      ? `<path d="M${x - eRx + .4} ${y - 1.5} Q${x} ${y - eRy - 4} ${x + eRx - .4} ${y - 1.5}" fill="none" stroke="${OUT}" stroke-width="3.4" stroke-linecap="round"/>` +
        `<path d="M${x + lado * (eRx - 1)} ${y - 3} l${lado * 3.6} -3.2" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>`
      : `<path d="M${x - eRx - 1} ${y - 1} Q${x} ${y - eRy - 2.6} ${x + eRx + 1} ${y - 1.6}" fill="none" stroke="${OUT}" stroke-width="3.8" stroke-linecap="round"/>`);
  const palpebra = (x, y, w = 8, h = 8, larg = 3) => `<path d="M${x - w} ${y} Q${x} ${y - h} ${x + w} ${y}" fill="none" stroke="${OUT}" stroke-width="${larg}" stroke-linecap="round"/>`;
  const branco = d => `<path d="${d}" fill="#fff" stroke="${OUT}" stroke-width="1.8"/>`;
  const amendoa = (x, y, w = 8.8) => `M${x - w} ${y} Q${x} ${y - (fem ? 9 : 7)} ${x + w} ${y - 1} Q${x} ${y + 6.5} ${x - w} ${y}Z`;
  const arco = (x, y, up = true) => `<path d="M${x - 8} ${y + (up ? 2 : -2)} Q${x} ${y + (up ? -8 : 6)} ${x + 8} ${y + (up ? 2 : -2)}" fill="none" stroke="${OUT}" stroke-width="3.4" stroke-linecap="round"/>`;
  const OLHO = {
    normal: [(x, y, lado) => branco(oval(x, y)) + iris(x, y, iR) + palp(x, y, lado), fem ? 9 : 6],
    amendoado: [(x, y, lado) => branco(amendoa(x, y)) + iris(x, y - .5, iR - .4) + `<path d="M${x - 8.8} ${y} Q${x} ${y - (fem ? 9 : 7)} ${x + 8.8} ${y - 1}" fill="none" stroke="${OUT}" stroke-width="3.2" stroke-linecap="round"/>` +
      (fem ? `<path d="M${x + lado * 7.8} ${y - 2} l${lado * 3.6} -3" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>` : ""), 5],
    grandes: [(x, y, lado) => branco(`M${x} ${y - 11} A9.5 11 0 1 1 ${x - .1} ${y - 11}Z`) + iris(x, y + 1, 6.6) + palpebra(x, y - 4.5, 9.5, 8, 3.4) +
      `<path d="M${x + lado * 8.6} ${y - 5} l${lado * 3.8} -3.4" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>`, 10],
    bolinha: [(x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="${escuro(olho, .45)}"/>${brilhoOlho(x - .3, y + .3, 1.7)}`, 5],
    feliz: [(x, y) => arco(x, y + 1), 4],
    sereno: [(x, y) => arco(x, y - 1, false), 2],
    sono: [(x, y) => branco(`M${x - 8} ${y} A8 6 0 0 0 ${x + 8} ${y}Z`) + `<circle cx="${x}" cy="${y + 1.5}" r="3.6" fill="${olho}"/><path d="M${x - 9} ${y} L${x + 9} ${y}" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>`, 1],
    surpresa: [(x, y) => `<circle cx="${x}" cy="${y}" r="8.5" fill="#fff" stroke="${OUT}" stroke-width="1.8"/><circle cx="${x}" cy="${y}" r="3.2" fill="${olho}"/><circle cx="${x}" cy="${y}" r="1.5" fill="#111"/>`, 9],
    determinado: [(x, y, lado) => branco(oval(x, y)) + iris(x, y + .5, iR - .2) +
      `<path d="M${x - 9} ${y - (lado < 0 ? 6 : 1)} L${x + 9} ${y - (lado < 0 ? 1 : 6)} L${x + 9} ${y - 12} L${x - 9} ${y - 12}Z" fill="${pele}"/><path d="M${x - 9} ${y - (lado < 0 ? 6 : 1)} L${x + 9} ${y - (lado < 0 ? 1 : 6)}" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>`, 3],
    lado: [(x, y, lado) => branco(oval(x, y)) + iris(x, y, iR - .3, 3) + palp(x, y, lado), fem ? 9 : 6],
    piscando: [(x, y, lado) => lado > 0 ? `<path d="M${x - 8} ${y} Q${x} ${y + 5} ${x + 8} ${y}" fill="none" stroke="${OUT}" stroke-width="3.2" stroke-linecap="round"/><path d="M${x + 8} ${y} l4 -3" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/>`
      : branco(oval(x, y)) + iris(x, y, iR) + palp(x, y, lado), fem ? 9 : 6],
    coracao: [(x, y) => `<path d="M${x} ${y + 9} L${x - 9} ${y} Q${x - 10} ${y - 8} ${x - 4} ${y - 8} Q${x} ${y - 8} ${x} ${y - 3} Q${x} ${y - 8} ${x + 4} ${y - 8} Q${x + 10} ${y - 8} ${x + 9} ${y}Z" fill="#ef4444" stroke="#b91c1c" stroke-width="1"/><circle cx="${x - 4}" cy="${y - 4}" r="1.6" fill="#fff"/>`, 8],
    estrela: [(x, y) => `<path d="M${x} ${y - 9} L${x + 3} ${y - 2} L${x + 10} ${y - 1} L${x + 5} ${y + 4} L${x + 6} ${y + 11} L${x} ${y + 7} L${x - 6} ${y + 11} L${x - 5} ${y + 4} L${x - 10} ${y - 1} L${x - 3} ${y - 2}Z" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>`, 9]
  };
  const [desOlho, topoOlho] = OLHO[a.olhos] || OLHO.normal;
  const olhos = desOlho(80, 98, -1) + desOlho(120, 98, 1);
  const cilio = {
    curtos: `<path d="M71 ${98 - topoOlho + 4} l-3 -2 M73 ${98 - topoOlho + 1} l-2 -3" stroke="${OUT}" stroke-width="1.5" stroke-linecap="round"/>`,
    longos: `<path d="M72 ${98 - topoOlho + 4} q-4 -1 -6 -4 M74 ${98 - topoOlho + 1} q-3 -2 -4 -6 M77 ${98 - topoOlho} q-1 -3 -1 -6" fill="none" stroke="${OUT}" stroke-width="1.6" stroke-linecap="round"/>`,
    volumosos: `<path d="M71 ${98 - topoOlho + 4} q-5 -1 -7 -4 M73 ${98 - topoOlho + 1} q-4 -2 -5 -6 M76 ${98 - topoOlho} q-2 -3 -2 -7 M80 ${98 - topoOlho} q0 -3 1 -6" fill="none" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/><path d="M71 ${98 - topoOlho + 4} Q80 ${98 - topoOlho - 3} 89 ${98 - topoOlho + 4}" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`,
    delineado: `<path d="M71 ${98 - topoOlho + 4} L63 ${98 - topoOlho - 1} L72 ${98 - topoOlho + 2}Z" fill="${OUT}" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>`
  }[a.cilios];
  const cilios = cilio && !["sereno", "feliz"].includes(a.olhos) ? espelho(cilio) : cilio ? espelho(`<path d="M72 98 l-4 -1 M73 100 l-4 1" stroke="${OUT}" stroke-width="1.4" stroke-linecap="round"/>`) : "";

  const corSobr = escuro(cab, .12);
  const sobr = {
    normal: [3.5, "M70 86 Q80 80 90 84"], fina: [2, "M70 85 Q80 80 90 84"], grossa: [6.5, "M70 85 Q80 79 90 84"], arqueada: [3.5, "M70 88 Q78 76 90 84"],
    reta: [4.5, "M70 84 L90 84"], brava: [4.5, "M70 81 L90 87"], preocupada: [3.5, "M70 86 Q80 84 90 79"]
  }[a.sobrancelha];
  // masculino: mais grossa, mais baixa e mais reta (o arco cai pela metade) · contorno escuro como nos mascotes
  const sobrD = d => fem ? d : d.replace(/M70 (\d+) Q(\d+) (\d+) 90 (\d+)/, (_, a, qx, qy, b) => `M69 ${+a + 1.5} Q${qx} ${+(((+qy) + (+a + 1.5)) / 2 + 1).toFixed(1)} 91 ${+b + 1.5}`).replace(/M70 (\d+) L90 (\d+)/, (_, a, b) => `M69 ${+a + 1.5} L91 ${+b + 1.5}`);
  const sobrW = sobr ? sobr[0] + (fem ? 0 : 2.4) : 0;
  const sobrancelhas = sobr ? espelho(`<path d="${sobrD(sobr[1])}" fill="none" stroke="${OUT}" stroke-width="${sobrW + 2.4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${sobrD(sobr[1])}" fill="none" stroke="${corSobr}" stroke-width="${sobrW}" stroke-linecap="round" stroke-linejoin="round"/>`) : "";

  const barbaArea = d => `<g clip-path="url(#${id}h)">${d}</g>`;
  const queixo = "M30 106 Q52 130 84 124 Q100 120 116 124 Q148 130 170 106 L170 170 L30 170Z";
  const bigode = `<path d="M84 123 Q92 116 100 120 Q108 116 116 123 Q108 126 100 123 Q92 126 84 123Z" fill="${cab}" stroke="${cabS}" stroke-width="1"/>`;
  const barba = {
    porfazer: barbaArea(`<path d="${queixo}" fill="${cab}" opacity=".22"/>`),
    bigode, "bigode-fino": `<path d="M88 122 Q100 117 112 122" fill="none" stroke="${cab}" stroke-width="2.4" stroke-linecap="round"/>`,
    cavanhaque: bigode + `<path d="M91 136 Q100 152 109 136 Q100 140 91 136Z" fill="${cab}" stroke="${cabS}" stroke-width="1"/>`,
    costeleta: barbaArea(`<path d="M44 80 L58 80 L58 116 Q52 112 44 104Z M156 80 L142 80 L142 116 Q148 112 156 104Z" fill="${cab}"/>`),
    curta: barbaArea(`<path d="${queixo}" fill="${cab}" opacity=".6"/>`) + bigode,
    cheia: barbaArea(`<path d="${queixo}" fill="url(#${id}hc)"/>`) + `<path d="${rostoD}" fill="none" stroke="${linha}" stroke-width="2.8"/>` + bigode,
    longa: `<path d="M64 136 Q100 194 136 136Z" fill="url(#${id}hc)" stroke="${cabS}" stroke-width="1.4"/>` + barbaArea(`<path d="${queixo}" fill="url(#${id}hc)"/>`) + Hb("M92 150 Q96 166 100 176") + bigode
  }[a.barba] || "";

  const boca = {
    sorriso: `<path d="M86 127 Q100 133 114 127 Q100 141 86 127Z" fill="${lab}" stroke="${labS}" stroke-width="1"/><path d="M86 127 Q100 134 114 127" fill="none" stroke="${labS}" stroke-width="1.8" stroke-linecap="round"/>`,
    grande: `<path d="M83 124 Q100 128 117 124 Q115 145 100 145 Q85 145 83 124Z" fill="#5b1a1a" stroke="${lab}" stroke-width="2.4" stroke-linejoin="round"/><path d="M86 125.5 Q100 129 114 125.5 L113 130 Q100 133 87 130Z" fill="#fff"/><ellipse cx="100" cy="140" rx="8" ry="4" fill="#f472b6"/>`,
    risada: `<path d="M80 122 Q100 126 120 122 Q118 150 100 150 Q82 150 80 122Z" fill="#5b1a1a" stroke="${lab}" stroke-width="2.4" stroke-linejoin="round"/><path d="M83 123.5 Q100 127 117 123.5 L116 129 Q100 132 84 129Z" fill="#fff"/><ellipse cx="100" cy="144" rx="10" ry="5" fill="#f472b6"/>`,
    labios: `<path d="M86 128 Q92 121 97 123 Q100 124.5 103 123 Q108 121 114 128 Q100 130 86 128Z" fill="${escuro(lab, .08)}" stroke="${labS}" stroke-width="1"/><path d="M86 128 Q100 130 114 128 Q108 138 100 138 Q92 138 86 128Z" fill="${lab}" stroke="${labS}" stroke-width="1"/><ellipse cx="102" cy="133" rx="4" ry="1.4" fill="#fff" opacity=".4"/>`,
    neutra: `<path d="M89 129 Q100 127 111 129 Q100 133 89 129Z" fill="${lab}" stroke="${labS}" stroke-width="1"/><path d="M89 129 L111 129" stroke="${labS}" stroke-width="1.6" stroke-linecap="round"/>`,
    lado: `<path d="M88 130 Q104 133 116 123 Q106 138 88 130Z" fill="${lab}" stroke="${labS}" stroke-width="1"/><path d="M88 130 Q104 133 116 123" fill="none" stroke="${labS}" stroke-width="1.8" stroke-linecap="round"/>`,
    timido: `<path d="M90 130 Q95 127 100 130 Q105 133 110 130" fill="none" stroke="${labS}" stroke-width="2.2" stroke-linecap="round"/>`,
    o: `<ellipse cx="100" cy="130" rx="6.5" ry="8" fill="#5b1a1a" stroke="${lab}" stroke-width="2.6"/>`,
    beijo: `<ellipse cx="100" cy="130" rx="5" ry="5.5" fill="${lab}" stroke="${labS}" stroke-width="1"/><path d="M96 130 L104 130" stroke="${labS}" stroke-width="1.4" stroke-linecap="round"/><path d="M118 124 l-3 -3 a2 2 0 0 1 3 -2 a2 2 0 0 1 3 2z" fill="#ef4444"/>`,
    dentes: `<path d="M86 126 Q100 136 114 126" fill="none" stroke="${labS}" stroke-width="2.6" stroke-linecap="round"/><rect x="94.5" y="129" width="5.5" height="7" rx="1.5" fill="#fff" stroke="#cbd5e1"/><rect x="100" y="129" width="5.5" height="7" rx="1.5" fill="#fff" stroke="#cbd5e1"/>`,
    lingua: `<path d="M86 126 Q100 136 114 126" fill="none" stroke="${labS}" stroke-width="2.6" stroke-linecap="round"/><path d="M95 131 Q96 142 101 142 Q106 142 106 131Z" fill="#f472b6" stroke="#db2777" stroke-width="1"/>`
  }[a.boca] || "";

  // ----- óculos -----
  const lente = `fill="#fff" fill-opacity=".18"`;
  const hastes = `<path d="M${ex + 4} 95 L66 96 M${200 - ex - 4} 95 L134 96" stroke="${arm}" stroke-width="2.4"/>`;
  const reflexo = (x, y) => `<path d="M${x - 6} ${y - 2} l5 -5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
  const oculos = {
    oculos: hastes + `<g fill="none" stroke="${arm}" stroke-width="2.8"><circle cx="80" cy="98" r="12.5" ${lente}/><circle cx="120" cy="98" r="12.5" ${lente}/><path d="M92.5 97 Q100 93 107.5 97"/></g>` + reflexo(80, 98) + reflexo(120, 98),
    quadrado: hastes + `<g stroke="${arm}" stroke-width="2.8"><rect x="66" y="88" width="28" height="20" rx="4" ${lente}/><rect x="106" y="88" width="28" height="20" rx="4" ${lente}/><path d="M94 96 L106 96" fill="none"/></g>` + reflexo(80, 98) + reflexo(120, 98),
    nerd: hastes + `<g stroke="${arm}" stroke-width="5"><rect x="64" y="87" width="31" height="22" rx="6" ${lente}/><rect x="105" y="87" width="31" height="22" rx="6" ${lente}/><path d="M95 95 L105 95" fill="none"/></g>`,
    gatinho: hastes + `<g stroke="${arm}" stroke-width="2.8" stroke-linejoin="round"><path d="M64 88 Q80 86 94 92 Q94 108 80 108 Q68 108 66 96 Z" ${lente}/><path d="M136 88 Q120 86 106 92 Q106 108 120 108 Q132 108 134 96 Z" ${lente}/><path d="M94 95 L106 95" fill="none"/></g><path d="M64 88 l-4 -5 M136 88 l4 -5" stroke="${arm}" stroke-width="3" stroke-linecap="round"/>`,
    aviador: hastes + `<g stroke="${arm}" stroke-width="2"><path d="M66 90 L94 90 Q96 110 82 110 Q66 110 66 90Z" fill="#4b5563" fill-opacity=".55"/><path d="M134 90 L106 90 Q104 110 118 110 Q134 110 134 90Z" fill="#4b5563" fill-opacity=".55"/><path d="M94 91 Q100 88 106 91" fill="none"/></g>` + reflexo(82, 99) + reflexo(122, 99),
    coracoes: hastes + [80, 120].map(x => `<path d="M${x} 110 L${x - 13} 97 Q${x - 14} 86 ${x - 6} 86 Q${x} 86 ${x} 92 Q${x} 86 ${x + 6} 86 Q${x + 14} 86 ${x + 13} 97Z" fill="#ef4444" fill-opacity=".8" stroke="${arm}" stroke-width="2.2"/>`).join("") + `<path d="M93 92 L107 92" stroke="${arm}" stroke-width="2.4"/>`,
    escuros: hastes + `<g fill="#111827" stroke="${arm}" stroke-width="2"><rect x="64" y="89" width="30" height="19" rx="8"/><rect x="106" y="89" width="30" height="19" rx="8"/></g><path d="M94 96 L106 96" stroke="${arm}" stroke-width="3"/><path d="M70 93 L80 93 M112 93 L122 93" stroke="#fff6" stroke-width="2.6" stroke-linecap="round"/>`,
    monoculo: `<circle cx="120" cy="98" r="12.5" fill="#fff" fill-opacity=".18" stroke="#b45309" stroke-width="3"/><path d="M131 104 Q140 130 136 152" fill="none" stroke="#b45309" stroke-width="1.5"/>` + reflexo(120, 98)
  }[a.oculos] || "";

  // ----- cabeça (chapéus etc.) -----
  const acS = escuro(ac, .35);
  const acess = {
    presilha: `<rect x="60" y="56" width="16" height="5" rx="2.5" fill="${ac}" stroke="${acS}" transform="rotate(-30 68 58)"/><rect x="64" y="66" width="16" height="5" rx="2.5" fill="${claro(ac, .3)}" stroke="${acS}" transform="rotate(-30 72 68)"/>`,
    arco: `<path d="M50 74 C52 36 76 26 100 26 C124 26 148 36 150 74" fill="none" stroke="${acS}" stroke-width="9" stroke-linecap="round"/><path d="M50 74 C52 36 76 26 100 26 C124 26 148 36 150 74" fill="none" stroke="${ac}" stroke-width="6.5" stroke-linecap="round"/>`,
    laco: `<g fill="${ac}" stroke="${acS}" stroke-width="1.4" stroke-linejoin="round"><path d="M136 44 L116 32 Q112 44 116 56Z"/><path d="M136 44 L156 32 Q160 44 156 56Z"/><circle cx="136" cy="44" r="6"/></g>`,
    flor: `<g transform="translate(140 50)">${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-9" rx="6" ry="9" fill="${ac}" stroke="${acS}" stroke-width="1" transform="rotate(${r})"/>`).join("")}<circle r="5" fill="#fde047" stroke="#ca8a04"/></g>`,
    bandana: pano("M46 76 C46 40 70 28 100 28 C130 28 154 40 154 76 Q100 62 46 76Z", ac) + `<g fill="#fff" opacity=".8">${[[70, 50], [90, 40], [112, 40], [132, 50], [100, 56]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2"/>`).join("")}</g>` + pano("M150 66 L170 58 L166 76Z M150 70 L168 84 L152 84Z", ac),
    gorro: pano("M48 76 Q48 22 100 20 Q152 22 152 76Z", ac) + `<g stroke="${acS}" stroke-width="1.2" opacity=".6">${[64, 80, 100, 120, 136].map(x => `<path d="M${x} ${x === 100 ? 22 : 30} L${x + (x - 100) * .1} 66"/>`).join("")}</g><rect x="44" y="64" width="112" height="16" rx="8" fill="${claro(ac, .75)}" stroke="${acS}" stroke-width="1.4"/><circle cx="100" cy="18" r="10" fill="${claro(ac, .75)}" stroke="${acS}" stroke-width="1.4"/>`,
    boina: pano("M44 62 C40 34 80 22 112 26 C150 30 168 50 154 64 Q100 52 44 62Z", ac) + `<path d="M98 24 l2 -6" stroke="${acS}" stroke-width="3" stroke-linecap="round"/>`,
    chapeu: pano("M24 68 Q100 50 176 68 Q178 78 160 76 Q100 66 40 76 Q22 78 24 68Z", ac) + pano("M60 66 L64 24 Q100 16 136 24 L140 66 Q100 58 60 66Z", ac) + `<path d="M62 56 Q100 48 138 56 L139 64 Q100 56 61 64Z" fill="${claro(ac, .6)}"/>`,
    bone: pano("M48 74 Q48 30 100 28 Q152 30 152 74Z", ac) + pano("M100 70 Q150 64 176 76 Q160 86 100 78Z", escuro(ac, .1)) + `<circle cx="100" cy="30" r="4.5" fill="${acS}"/><path d="M100 30 L100 72 M74 36 L80 72 M126 36 L120 72" stroke="${acS}" stroke-width="1.2" opacity=".5"/>`,
    faixa: `<rect x="47" y="64" width="106" height="13" rx="4" fill="${ac}" stroke="${acS}" stroke-width="1.2"/><circle cx="100" cy="70" r="4" fill="#fff"/><path d="M151 68 L174 58 M151 74 L172 86" stroke="${ac}" stroke-width="6" stroke-linecap="round"/>`,
    gatinho: `<path d="M50 74 C52 36 76 26 100 26 C124 26 148 36 150 74" fill="none" stroke="${ac}" stroke-width="5" stroke-linecap="round"/>` + espelho(`<path d="M56 50 L52 16 L82 34Z" fill="${ac}" stroke="${acS}" stroke-width="1.4" stroke-linejoin="round"/><path d="M59 42 L57 24 L74 34Z" fill="#f9a8d4"/>`),
    fone: `<path d="M46 96 Q46 28 100 28 Q154 28 154 96" fill="none" stroke="#111827" stroke-width="7"/><rect x="34" y="84" width="18" height="30" rx="8" fill="${ac}" stroke="#111827" stroke-width="2"/><rect x="148" y="84" width="18" height="30" rx="8" fill="${ac}" stroke="#111827" stroke-width="2"/>`,
    tiara: `<path d="M54 70 Q100 38 146 70" fill="none" stroke="${ac}" stroke-width="5"/>` + [[74, 56], [100, 46], [126, 56]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#fff" stroke="${acS}"/>`).join(""),
    headset: `<path d="M46 96 Q46 28 100 28 Q154 28 154 96" fill="none" stroke="#7c3aed" stroke-width="8"/><rect x="32" y="82" width="20" height="34" rx="9" fill="#7c3aed" stroke="#4c1d95" stroke-width="2"/><rect x="148" y="82" width="20" height="34" rx="9" fill="#7c3aed" stroke="#4c1d95" stroke-width="2"/><path d="M42 112 Q48 136 80 134" fill="none" stroke="#111827" stroke-width="4"/><circle cx="82" cy="134" r="5" fill="#22d3ee"/>`,
    mago: pano("M56 64 L100 0 L144 64Z", ac === "#f8fafc" ? "#4c1d95" : ac) + pano("M40 66 Q100 52 160 66 Q100 80 40 66Z", ac === "#f8fafc" ? "#4c1d95" : ac) + `<text x="100" y="44" font-size="16" text-anchor="middle">⭐</text>`,
    coroa: `<path d="M62 46 L70 18 L86 38 L100 12 L114 38 L130 18 L138 46Z" fill="#facc15" stroke="#b45309" stroke-width="2" stroke-linejoin="round"/><circle cx="100" cy="30" r="4" fill="#ef4444"/><circle cx="78" cy="38" r="3" fill="#3b82f6"/><circle cx="122" cy="38" r="3" fill="#22c55e"/>`,
    aureola: `<ellipse cx="100" cy="22" rx="40" ry="9" fill="none" stroke="#facc15" stroke-width="5"/>${[64, 100, 136].map(x => `<text x="${x}" y="16" font-size="14" text-anchor="middle">⭐</text>`).join("")}`
  }[a.acessorio] || "";

  const cheio = !(opcoes.parte && ZOOM[opcoes.parte] && opcoes.parte !== "cabelo"), vb = cheio ? "0 0 200 200" : encaixa(ZOOM[opcoes.parte]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${tam}" height="${tam}" role="img" aria-label="Personagem">
    <defs>${grad}<clipPath id="${id}c"><circle cx="100" cy="100" r="98"/></clipPath><clipPath id="${id}h"><path d="${rostoD}"/></clipPath>
      <radialGradient id="${id}pg" cx=".45" cy=".38" r=".75"><stop offset="0" stop-color="${claro(pele, .1)}"/><stop offset=".65" stop-color="${pele}"/><stop offset="1" stop-color="${escuro(pele, .1)}"/></radialGradient>
      <linearGradient id="${id}hc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${claro(cab, .18)}"/><stop offset=".6" stop-color="${cab}"/><stop offset="1" stop-color="${escuro(cab, .15)}"/></linearGradient></defs>
    <g clip-path="url(#${id}c)"><rect x="-20" y="-20" width="240" height="240" fill="${fundo.grad ? `url(#${id}g)` : fundo.cor}"/>${padrao}${estrelas}<g transform="${ENCAIXE}">
      ${cabelo.B || ""}${capaTras}${pescoco}${pomo}${corpo}${colar}${cabelo.O || ""}
      ${orelhas}${cabeca}${bochecha}${detalhe}${maquiagem}${barba}${nariz}${boca}${olhos}${cilios}${sobrancelhas}${brinco ? espelho(brinco) : ""}
      ${cabelo.F || ""}${oculos}${acess}</g></g>
    ${cheio && a.adesivo && a.adesivo !== "nenhum" ? `<circle cx="164" cy="164" r="24" fill="#fff" stroke="#e5e7eb" stroke-width="2"/><text x="164" y="173" font-size="26" text-anchor="middle">${a.adesivo}</text>` : ""}
    ${cheio && mold && mold.id !== "nenhuma" ? `<circle cx="100" cy="100" r="95" fill="none" stroke="${mold.cor}" stroke-width="8"/>${mold.id === "diamante" ? `<circle cx="100" cy="100" r="88" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 8"/>` : ""}${mold.id === "fogo" ? `<circle cx="100" cy="100" r="95" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="10 6"/>` : ""}` : ""}
  </svg>`;
}
