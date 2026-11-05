// Itens criados pela equipe (PNG enviado ou desenhado no painel): estampas, roupas, chapéus, óculos, colares, adesivos e fundos.
// Firestore itensCustom/{id} = { nome, categoria, png (data URL, até ~300 KB), ajuste { dx, dy, escala }, trava { n } | null, ativo, criadoPor }.
// Viram itens do catálogo do personagem (id "cx-<id>") e acessórios dos mascotes. Sem dependência do Firebase aqui.

// cat: em que parte do personagem entra · av: caixa no personagem (0..200) · masc: caixa no mascote (200 x 220) · w = largura base
export const CATEGORIAS_ITEM = {
  estampa: { nome: "Estampa de camiseta", icone: "👕", parte: "estampa", av: { x: 100, y: 186, w: 44 }, masc: { x: 100, y: 200, w: 50 } },
  roupa:   { nome: "Roupa inteira", icone: "🧥", parte: "roupa", av: { x: 100, y: 186, w: 150 }, masc: { x: 100, y: 196, w: 184 } },
  cabeca:  { nome: "Cabeça (boné, chapéu, laço…)", icone: "🧢", parte: "acessorio", av: { x: 100, y: 40, w: 130 }, masc: { x: 100, y: 34, w: 140 } },
  oculos:  { nome: "Óculos", icone: "👓", parte: "oculos", av: { x: 100, y: 98, w: 84 }, masc: { x: 100, y: 98, w: 96 } },
  pescoco: { nome: "Pescoço (colar, gravata…)", icone: "📿", parte: "pescoco", av: { x: 100, y: 166, w: 50 }, masc: { x: 100, y: 176, w: 56 } },
  adesivo: { nome: "Adesivo do cartão", icone: "🏷", parte: "adesivo", av: null, masc: null },
  fundo:   { nome: "Fundo do personagem", icone: "🖼", parte: "fundo", av: null, masc: null }
};
export const PARA_MASCOTE = ["estampa", "roupa", "cabeca", "oculos", "pescoco"];

let ITENS = {};   // "cx-<id>" -> item
export const itemCustom = id => ITENS[id] || null;
export const listaItensCustom = () => Object.values(ITENS);
// guarda os itens e põe no catálogo do personagem (sem repetir)
export function registrarItensCustom(lista, CATALOGO) {
  ITENS = {};
  Object.keys(CATALOGO).forEach(p => { CATALOGO[p] = CATALOGO[p].filter(i => !String(i.id).startsWith("cx-")); });
  for (const it of lista || []) {
    if (it.ativo === false || !it.png || !CATEGORIAS_ITEM[it.categoria]) continue;
    const id = "cx-" + it.id, parte = CATEGORIAS_ITEM[it.categoria].parte;
    ITENS[id] = { ...it, idCat: id };
    if (CATALOGO[parte]) CATALOGO[parte].push({ id, nome: `${it.nome} ✨`, custom: true, ...(it.trava?.n ? { trava: { n: it.trava.n } } : {}) });
  }
}
// <image> do item numa caixa (com o ajuste fino da equipe)
export function imagemItem(it, caixa, extra = "") {
  if (!it || !caixa) return "";
  const a = it.ajuste || {}, w = caixa.w * (Number(a.escala) || 1), x = caixa.x + (Number(a.dx) || 0) - w / 2, y = caixa.y + (Number(a.dy) || 0) - w / 2;
  return `<image href="${it.png}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${w.toFixed(1)}" preserveAspectRatio="xMidYMid meet" ${extra}/>`;
}
