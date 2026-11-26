// Diagramas e documentos de Levantamento de Requisitos: catálogo, leitura, texto para a IA e comparação local.
// Lógica pura (sem DOM): usada pelo editor (js/diagramas-req.js), pela tela do professor e pelo Worker.
//
// Valor guardado (string JSON, sempre { v:1, tipo, ..., obs? }):
//   "casos-de-uso" { el:[{ id, t:"sistema"|"ator"|"caso"|"nota", x, y, w, h, txt }],
//                    li:[{ id, t:"assoc"|"include"|"extend"|"gen", de, para, txt }] }
//                    include: de = caso base → para = caso incluído; extend: de = caso que estende → para = caso base;
//                    gen: de = filho → para = pai. Peça "dentro" do limite = centro dentro do retângulo do sistema.
//   "atividades"   { el:[{ id, t:"raia"|"inicio"|"acao"|"decisao"|"fork"|"fim"|"nota", x, y, w, h, txt }],
//                    li:[{ id, t:"fluxo", de, para, txt (guarda) }] }
//   "rastreabilidade" { req:[{ id, cod, desc, tipo:"RF"|"RNF"|"RN", prio, origem, status }],
//                       col:[{ id, cod, nome, tipo:"UC"|"TL"|"CT"|"OUT" }],
//                       x:[[idReq, idCol], ...]      (marcas requisito × artefato)
//                       dep:[[idReq, idReqDeQueDepende], ...] (variante requisito × requisito),
//                       modo?: "dep" (o editor abre na visão requisito × requisito) }
//   "requisitos"   { cab:{ projeto, versao, data, autor }, hist:[{ id, versao, data, autor, desc }],
//                    itens:[{ id, cod, tipo:"RF"|"RNF"|"RN"|"RES", cat, desc, prio, origem }] }
//   "kanban"       { cols:[{ id, nome, wip }], cards:[{ id, col, txt, resp, prio }] }   (ordem do vetor = ordem na coluna)
//   "historias"    { itens:[{ id, cod, papel, acao, beneficio, criterios:[texto], prio, pontos }] } (ordem = prioridade do backlog)
//   "empatia"      { persona, notas:[{ id, area:"pensa"|"escuta"|"ve"|"fala"|"dores"|"ganhos", txt }] }
//   obs = observações / justificativa do aluno (texto livre, opcional, em todos)
//
// API: TIPOS, AREAS_EMPATIA, lerDiagrama(valor), diagramaVazio(d), novoDiagrama(tipo), textoDiagrama(valor),
//      compararDiagramas(gabarito, resposta) → { nota: 0..1, itens:[{ ok, texto }] }, dentro(e, c), similaridade(a, b)

// t = tipo da peça; w/h = tamanho inicial; cont = contêiner (fica atrás, o que está dentro pertence a ele)
export const TIPOS = {
  "casos-de-uso": {
    nome: "Diagrama de casos de uso", grafico: true,
    descricao: "Atores, casos de uso dentro do limite do sistema e os relacionamentos (associação, «include», «extend», generalização).",
    el: {
      sistema: { rot: "Limite do sistema", w: 420, h: 380, txt: "Sistema", cont: true },
      ator: { rot: "Ator", w: 70, h: 96, txt: "Ator" },
      caso: { rot: "Caso de uso", w: 180, h: 64, txt: "Caso de uso" },
      nota: { rot: "Nota", w: 170, h: 66, txt: "Nota" }
    },
    li: {
      assoc: { rot: "Associação", dica: "Ligue o ator ao caso de uso" },
      include: { rot: "«include»", estereotipo: "«include»", dica: "Do caso base para o caso incluído (sempre executado)" },
      extend: { rot: "«extend»", estereotipo: "«extend»", dica: "Do caso opcional para o caso base que ele estende" },
      gen: { rot: "Generalização", dica: "Do filho (mais específico) para o pai (mais geral)" }
    },
    ligPadrao: "assoc"
  },
  atividades: {
    nome: "Diagrama de atividades", grafico: true,
    descricao: "Fluxo do processo levantado: início, ações, decisões, fim e raias (opcionais) por responsável.",
    el: {
      raia: { rot: "Raia", w: 260, h: 560, txt: "Responsável", cont: true },
      inicio: { rot: "Início", w: 30, h: 30, txt: "" },
      acao: { rot: "Ação", w: 170, h: 54, txt: "Ação" },
      decisao: { rot: "Decisão", w: 64, h: 64, txt: "" },
      fork: { rot: "Barra (paralelo)", w: 170, h: 10, txt: "" },
      fim: { rot: "Fim", w: 32, h: 32, txt: "" },
      nota: { rot: "Nota", w: 170, h: 66, txt: "Nota" }
    },
    li: { fluxo: { rot: "Fluxo", dica: "Da etapa anterior para a seguinte; numa decisão escreva a guarda [condição]" } },
    ligPadrao: "fluxo"
  },
  rastreabilidade: {
    nome: "Matriz de rastreabilidade de requisitos",
    descricao: "Linhas = requisitos (RF/RNF/RN); colunas = artefatos (casos de uso, telas, casos de teste); ✕ = o requisito é atendido/verificado pelo artefato. Variante requisito × requisito para dependências.",
    pecas: ["Requisito", "Caso de uso (UC)", "Tela (TL)", "Caso de teste (CT)", "Marca ✕", "Dependência entre requisitos"]
  },
  requisitos: {
    nome: "Documento de requisitos",
    descricao: "Lista de requisitos funcionais, não funcionais (com categoria), regras de negócio e restrições, com prioridade, origem e controle de versões.",
    pecas: ["Cabeçalho (projeto, versão, data, autor)", "Histórico de revisões", "RF", "RNF", "RN", "Restrição"]
  },
  kanban: {
    nome: "Quadro Kanban",
    descricao: "Colunas do fluxo de trabalho com limite WIP e cartões arrastáveis (responsável e prioridade).",
    pecas: ["Coluna (com limite WIP)", "Cartão"]
  },
  historias: {
    nome: "Histórias de usuário (Product Backlog)",
    descricao: "“Como <papel>, quero <ação>, para <benefício>”, com critérios de aceitação, prioridade e pontos; a ordem é a do backlog.",
    pecas: ["História", "Critério de aceitação", "Prioridade", "Pontos"]
  },
  empatia: {
    nome: "Mapa de empatia (Design Thinking)",
    descricao: "Persona no centro e notas nas seis áreas: pensa e sente, escuta, vê, fala e faz, dores e ganhos.",
    pecas: ["Persona", "Nota adesiva"]
  }
};

export const AREAS_EMPATIA = [
  { id: "pensa", nome: "O que pensa e sente?", dica: "preocupações, sonhos, o que importa de verdade" },
  { id: "escuta", nome: "O que escuta?", dica: "amigos, chefe, influenciadores, colegas" },
  { id: "ve", nome: "O que vê?", dica: "ambiente, mercado, o que os outros fazem" },
  { id: "fala", nome: "O que fala e faz?", dica: "atitude em público, comportamento" },
  { id: "dores", nome: "Dores", dica: "medos, frustrações, obstáculos" },
  { id: "ganhos", nome: "Ganhos", dica: "desejos, necessidades, medidas de sucesso" }
];

export const TIPOS_REQ = { RF: "Requisito funcional", RNF: "Requisito não funcional", RN: "Regra de negócio", RES: "Restrição" };
export const CATEGORIAS_RNF = ["Desempenho", "Usabilidade", "Segurança", "Confiabilidade", "Disponibilidade", "Compatibilidade", "Portabilidade", "Manutenibilidade", "Legal / normativo", "Outro"];
export const PRIORIDADES = ["Alta", "Média", "Baixa", "Must", "Should", "Could", "Won't"];
export const STATUS_REQ = ["Proposto", "Aprovado", "Em desenvolvimento", "Implementado", "Validado", "Cancelado"];
export const TIPOS_COL = { UC: "Caso de uso", TL: "Tela", CT: "Caso de teste", OUT: "Outro" };

/* ── utilidades ── */
const str = (s, max = 2000) => String(s ?? "").slice(0, max);
const limpa = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const num = (n, pad = 0) => (Number.isFinite(Number(n)) ? Math.round(Number(n)) : pad);
let contId = 0;
export function novoId(p) { return p + Date.now().toString(36).slice(-4) + (++contId).toString(36) + Math.random().toString(36).slice(2, 5); }
function lista(v) { return Array.isArray(v) ? v : []; }
// ids únicos e não vazios (valor colado à mão pode repetir)
function idsUnicos(vet, p) {
  const vistos = new Set();
  vet.forEach((o) => { if (!o.id || vistos.has(o.id)) o.id = novoId(p); vistos.add(o.id); });
  return vet;
}

/** Valor (string JSON ou objeto) → diagrama normalizado (cópia) ou null. */
export function lerDiagrama(valor) {
  if (!valor) return null;
  let o = valor;
  if (typeof valor === "string") {
    const s = valor.trim();
    if (s[0] !== "{") return null;
    try { o = JSON.parse(s); } catch { return null; }
  }
  if (!o || typeof o !== "object" || o.v !== 1 || !TIPOS[o.tipo]) return null;
  const d = { v: 1, tipo: o.tipo };
  const T = TIPOS[o.tipo];
  if (T.grafico) {
    d.el = idsUnicos(lista(o.el).filter((e) => e && T.el[e.t]).map((e) => ({
      id: str(e.id, 40), t: e.t, x: num(e.x), y: num(e.y), w: Math.max(6, num(e.w, T.el[e.t].w)), h: Math.max(6, num(e.h, T.el[e.t].h)), txt: str(e.txt, 300)
    })), "e");
    const ids = new Set(d.el.map((e) => e.id));
    d.li = idsUnicos(lista(o.li).filter((l) => l && T.li[l.t] && ids.has(l.de) && ids.has(l.para)).map((l) => ({
      id: str(l.id, 40), t: l.t, de: l.de, para: l.para, txt: str(l.txt, 300)
    })), "l");
  } else if (o.tipo === "rastreabilidade") {
    d.req = idsUnicos(lista(o.req).filter(Boolean).map((r) => ({
      id: str(r.id, 40), cod: str(r.cod, 20), desc: str(r.desc, 600), tipo: ["RF", "RNF", "RN"].includes(r.tipo) ? r.tipo : "RF",
      prio: str(r.prio, 20), origem: str(r.origem, 120), status: str(r.status, 40)
    })), "r");
    d.col = idsUnicos(lista(o.col).filter(Boolean).map((c) => ({ id: str(c.id, 40), cod: str(c.cod, 20), nome: str(c.nome, 120), tipo: TIPOS_COL[c.tipo] ? c.tipo : "OUT" })), "c");
    const ir = new Set(d.req.map((r) => r.id)), ic = new Set(d.col.map((c) => c.id));
    const pares = (v, okB) => { const s = new Set(); return lista(v).filter((p) => Array.isArray(p) && ir.has(p[0]) && okB(p[1]) && !s.has(p[0] + "|" + p[1]) && s.add(p[0] + "|" + p[1])).map((p) => [p[0], p[1]]); };
    d.x = pares(o.x, (b) => ic.has(b));
    d.dep = pares(o.dep, (b) => ir.has(b)).filter((p) => p[0] !== p[1]);
    if (o.modo === "dep") d.modo = "dep"; // visão que o editor abre primeiro (requisito × requisito)
  } else if (o.tipo === "requisitos") {
    const c = o.cab || {};
    d.cab = { projeto: str(c.projeto, 160), versao: str(c.versao, 20), data: str(c.data, 20), autor: str(c.autor, 120) };
    d.hist = idsUnicos(lista(o.hist).filter(Boolean).map((h) => ({ id: str(h.id, 40), versao: str(h.versao, 20), data: str(h.data, 20), autor: str(h.autor, 120), desc: str(h.desc, 400) })), "h");
    d.itens = idsUnicos(lista(o.itens).filter(Boolean).map((r) => ({
      id: str(r.id, 40), cod: str(r.cod, 20), tipo: TIPOS_REQ[r.tipo] ? r.tipo : "RF", cat: r.tipo === "RNF" ? str(r.cat, 40) : "",
      desc: str(r.desc, 800), prio: str(r.prio, 20), origem: str(r.origem, 120)
    })), "q");
  } else if (o.tipo === "kanban") {
    d.cols = idsUnicos(lista(o.cols).filter(Boolean).map((c) => ({ id: str(c.id, 40), nome: str(c.nome, 60), wip: Math.max(0, Math.min(99, num(c.wip))) })), "k");
    const ic = new Set(d.cols.map((c) => c.id));
    d.cards = idsUnicos(lista(o.cards).filter((k) => k && ic.has(k.col)).map((k) => ({ id: str(k.id, 40), col: k.col, txt: str(k.txt, 300), resp: str(k.resp, 60), prio: str(k.prio, 20) })), "t");
  } else if (o.tipo === "historias") {
    d.itens = idsUnicos(lista(o.itens).filter(Boolean).map((h) => ({
      id: str(h.id, 40), cod: str(h.cod, 20), papel: str(h.papel, 120), acao: str(h.acao, 300), beneficio: str(h.beneficio, 300),
      criterios: (Array.isArray(h.criterios) ? h.criterios : String(h.criterios ?? "").split("\n")).map((c) => str(c, 300)).filter((c) => c.trim()).slice(0, 20),
      prio: str(h.prio, 20), pontos: str(h.pontos, 4)
    })), "u");
  } else if (o.tipo === "empatia") {
    const areas = new Set(AREAS_EMPATIA.map((a) => a.id));
    d.persona = str(o.persona, 300);
    d.notas = idsUnicos(lista(o.notas).filter((n) => n && areas.has(n.area)).map((n) => ({ id: str(n.id, 40), area: n.area, txt: str(n.txt, 300) })), "n");
  }
  d.obs = str(o.obs, 3000);
  return d;
}

/** Diagrama novo, já com o mínimo para começar (Kanban vem com as 3 colunas clássicas). */
export function novoDiagrama(tipo) {
  if (!TIPOS[tipo]) throw new Error("Tipo de diagrama desconhecido: " + tipo);
  const base = { v: 1, tipo, obs: "" };
  if (tipo === "kanban") base.cols = [["A fazer", 0], ["Fazendo", 3], ["Feito", 0]].map(([nome, wip]) => ({ id: novoId("k"), nome, wip }));
  return lerDiagrama(base);
}

/** true se não há nada da resposta (colunas padrão do Kanban sozinhas contam como vazio). */
export function diagramaVazio(d) {
  if (!d) return true;
  if (String(d.obs || "").trim()) return false;
  switch (d.tipo) {
    case "rastreabilidade": return !d.req.length && !d.col.length;
    case "requisitos": return !d.itens.length && !d.hist.length && !Object.values(d.cab).some((v) => String(v).trim());
    case "kanban": return !d.cards.length;
    case "historias": return !d.itens.length;
    case "empatia": return !d.notas.length && !d.persona.trim();
    default: return !d.el || !d.el.length;
  }
}

/** Centro da peça e se ela está dentro de um contêiner. */
export function dentro(e, c) { const x = e.x + e.w / 2, y = e.y + e.h / 2; return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h; }

/* ── texto para a IA (determinístico) ── */
const aspas = (s) => "“" + limpa(s) + "”";
const rotPrio = (p) => (limpa(p) ? limpa(p) : "sem prioridade");

/** Diagrama → texto em português, preciso, para o corretor (IA) e para quem lê sem ver o desenho. */
export function textoDiagrama(valor) {
  const d = lerDiagrama(valor);
  if (!d) return String(valor || "");
  const T = TIPOS[d.tipo], linhas = ["[Resposta montada no editor: " + T.nome + "]"];
  if (T.grafico) textoGrafico(d, linhas);
  else if (d.tipo === "rastreabilidade") textoMatriz(d, linhas);
  else if (d.tipo === "requisitos") {
    const c = d.cab;
    linhas.push("Projeto: " + (limpa(c.projeto) || "(sem nome)") + " · Versão: " + (limpa(c.versao) || "(não informada)") + " · Data: " + (limpa(c.data) || "(não informada)") + " · Autor: " + (limpa(c.autor) || "(não informado)"));
    if (d.hist.length) {
      linhas.push("Histórico de revisões:");
      d.hist.forEach((h) => linhas.push("- v" + (limpa(h.versao) || "?") + " (" + (limpa(h.data) || "sem data") + ", " + (limpa(h.autor) || "sem autor") + "): " + (limpa(h.desc) || "(sem descrição)")));
    }
    linhas.push("Requisitos (" + d.itens.length + "):");
    if (!d.itens.length) linhas.push("- (nenhum)");
    d.itens.forEach((r) => linhas.push("- " + (limpa(r.cod) || "(sem ID)") + " [" + TIPOS_REQ[r.tipo] + (r.tipo === "RNF" ? " / " + (limpa(r.cat) || "sem categoria") : "") + "; " + rotPrio(r.prio) + (limpa(r.origem) ? "; origem: " + limpa(r.origem) : "") + "] " + (limpa(r.desc) || "(sem descrição)")));
    const cont = Object.keys(TIPOS_REQ).map((t) => t + ": " + d.itens.filter((r) => r.tipo === t).length).join(" · ");
    linhas.push("Totais: " + cont);
  } else if (d.tipo === "kanban") {
    d.cols.forEach((c) => {
      const cs = d.cards.filter((k) => k.col === c.id);
      linhas.push("Coluna " + aspas(c.nome || "(sem nome)") + " — limite WIP: " + (c.wip ? c.wip : "sem limite") + " — " + cs.length + " cartão(ões)" + (c.wip && cs.length > c.wip ? " (ACIMA DO LIMITE WIP)" : "") + ":");
      if (!cs.length) linhas.push("  - (vazia)");
      cs.forEach((k) => linhas.push("  - " + (limpa(k.txt) || "(cartão sem texto)") + (limpa(k.resp) ? " [responsável: " + limpa(k.resp) + "]" : "") + (limpa(k.prio) ? " [prioridade: " + limpa(k.prio) + "]" : "")));
    });
    if (!d.cols.length) linhas.push("(sem colunas)");
  } else if (d.tipo === "historias") {
    linhas.push("Product backlog (" + d.itens.length + " história(s), na ordem de prioridade do aluno):");
    if (!d.itens.length) linhas.push("- (nenhuma)");
    d.itens.forEach((h, i) => {
      linhas.push((i + 1) + ". " + (limpa(h.cod) ? limpa(h.cod) + " — " : "") + "Como " + (limpa(h.papel) || "(papel?)") + ", quero " + (limpa(h.acao) || "(ação?)") + ", para " + (limpa(h.beneficio) || "(benefício?)") +
        " [prioridade: " + (limpa(h.prio) || "—") + "; pontos: " + (limpa(h.pontos) || "—") + "]");
      if (h.criterios.length) h.criterios.forEach((c) => linhas.push("   • Critério de aceitação: " + limpa(c)));
      else linhas.push("   • (sem critérios de aceitação)");
    });
  } else if (d.tipo === "empatia") {
    linhas.push("Persona: " + (limpa(d.persona) || "(não descrita)"));
    AREAS_EMPATIA.forEach((a) => {
      const ns = d.notas.filter((n) => n.area === a.id && limpa(n.txt));
      linhas.push(a.nome + (a.nome.endsWith("?") ? " " : ": ") + (ns.length ? ns.map((n) => aspas(n.txt)).join("; ") : "(vazio)"));
    });
  }
  if (limpa(d.obs)) linhas.push("", "Observações / justificativa do aluno:", String(d.obs).trim());
  return linhas.join("\n");
}

function textoGrafico(d, linhas) {
  const T = TIPOS[d.tipo], el = d.el, li = d.li, porId = Object.fromEntries(el.map((e) => [e.id, e]));
  const rot = (t) => T.el[t]?.rot || t;
  const doTipo = (t) => el.filter((e) => e.t === t);
  const nome = (e) => {
    if (!e) return "(peça apagada)";
    if (limpa(e.txt)) return aspas(e.txt);
    const mesmo = doTipo(e.t);
    return rot(e.t).toLowerCase() + (mesmo.length > 1 ? " " + (mesmo.indexOf(e) + 1) : "");
  };
  const desc = (e) => (e && limpa(e.txt) && e.t !== "acao" ? rot(e.t) + " " + nome(e) : e && !limpa(e.txt) ? rot(e.t) + (doTipo(e.t).length > 1 ? " " + (doTipo(e.t).indexOf(e) + 1) : "") : nome(e));
  const conts = el.filter((e) => T.el[e.t].cont);
  const donoDe = (e) => { const c = conts.filter((k) => k !== e && dentro(e, k)); return c.length ? c[c.length - 1] : null; };

  if (d.tipo === "casos-de-uso") {
    const sis = doTipo("sistema");
    if (sis.length) sis.forEach((s) => linhas.push("Limite do sistema: " + nome(s)));
    else linhas.push("Limite do sistema: (não desenhado)");
    const atores = doTipo("ator");
    linhas.push("Atores: " + (atores.length ? atores.map((a) => nome(a) + (donoDe(a) ? " (desenhado DENTRO do limite do sistema)" : "")).join(", ") : "(nenhum)"));
    const casos = doTipo("caso");
    linhas.push("Casos de uso: " + (casos.length ? casos.map((c) => nome(c) + (sis.length && !donoDe(c) ? " (FORA do limite do sistema)" : "")).join(", ") : "(nenhum)"));
    linhas.push("Relacionamentos:");
    if (!li.length) linhas.push("- (nenhum)");
    li.forEach((l) => {
      const a = porId[l.de], b = porId[l.para];
      let s;
      if (l.t === "assoc") s = "- Associação: " + nome(a) + " — " + nome(b);
      else if (l.t === "include") s = "- " + nome(a) + " «include» " + nome(b) + " (seta tracejada de " + nome(a) + " para " + nome(b) + ": " + nome(a) + " sempre inclui " + nome(b) + ")";
      else if (l.t === "extend") s = "- " + nome(a) + " «extend» " + nome(b) + " (seta tracejada de " + nome(a) + " para " + nome(b) + ": " + nome(a) + " é comportamento opcional que estende " + nome(b) + ")";
      else s = "- Generalização: " + nome(a) + " é um tipo de " + nome(b) + " (triângulo aponta para " + nome(b) + ")";
      if (limpa(l.txt)) s += " [rótulo: " + limpa(l.txt) + "]";
      linhas.push(s);
    });
    // atores sem ligação e casos sem ator (ajuda a IA a perceber peças soltas)
    const ligados = new Set(li.flatMap((l) => [l.de, l.para]));
    const soltos = el.filter((e) => (e.t === "ator" || e.t === "caso") && !ligados.has(e.id));
    if (soltos.length) linhas.push("Peças sem nenhuma ligação: " + soltos.map(nome).join(", "));
    // por ator: o que ele faz
    atores.forEach((a) => {
      const cs = li.filter((l) => l.t === "assoc" && (l.de === a.id || l.para === a.id)).map((l) => porId[l.de === a.id ? l.para : l.de]).filter((e) => e && e.t === "caso");
      if (cs.length) linhas.push("Resumo: " + nome(a) + " participa de " + cs.map(nome).join(", "));
    });
  } else {
    const raias = doTipo("raia");
    if (raias.length) {
      linhas.push("Raias (responsáveis): " + raias.slice().sort((a, b) => a.x - b.x).map(nome).join(", "));
      raias.forEach((r) => {
        const de = el.filter((e) => e !== r && !T.el[e.t].cont && e.t !== "nota" && donoDe(e) === r);
        linhas.push("- Na raia " + nome(r) + ": " + (de.length ? de.sort((a, b) => a.y - b.y).map(desc).join("; ") : "(vazia)"));
      });
      const soltos = el.filter((e) => !T.el[e.t].cont && e.t !== "nota" && !donoDe(e));
      if (soltos.length) linhas.push("Fora de qualquer raia: " + soltos.map(desc).join("; "));
    } else linhas.push("Raias: (nenhuma)");
    linhas.push("Elementos: " + ["inicio", "acao", "decisao", "fork", "fim"].map((t) => rot(t) + ": " + doTipo(t).length).join(" · "));
    linhas.push("Ações: " + (doTipo("acao").length ? doTipo("acao").map(nome).join(", ") : "(nenhuma)"));
    linhas.push("Fluxos (origem → destino):");
    if (!li.length) linhas.push("- (nenhum)");
    li.forEach((l) => linhas.push("- " + desc(porId[l.de]) + " → " + desc(porId[l.para]) + (limpa(l.txt) ? " [guarda: " + limpa(l.txt).replace(/^\[(.*)\]$/, "$1") + "]" : "")));
    const semSaida = el.filter((e) => ["acao", "decisao", "fork", "inicio"].includes(e.t) && !li.some((l) => l.de === e.id));
    if (semSaida.length) linhas.push("Sem fluxo de saída (caminho sem fim): " + semSaida.map(desc).join("; "));
    const semEntrada = el.filter((e) => ["acao", "decisao", "fork", "fim"].includes(e.t) && !li.some((l) => l.para === e.id));
    if (semEntrada.length) linhas.push("Sem fluxo de entrada (inalcançável): " + semEntrada.map(desc).join("; "));
  }
  const notas = doTipo("nota");
  if (notas.length) linhas.push("Notas: " + notas.map(nome).join(" | "));
}

function textoMatriz(d, linhas) {
  const codR = (r) => limpa(r.cod) || "(req. sem ID)";
  const codC = (c) => limpa(c.cod) || limpa(c.nome) || "(artefato sem ID)";
  linhas.push("Requisitos (linhas):");
  if (!d.req.length) linhas.push("- (nenhum)");
  d.req.forEach((r) => linhas.push("- " + codR(r) + " [" + TIPOS_REQ[r.tipo] + "; " + rotPrio(r.prio) + (limpa(r.origem) ? "; origem: " + limpa(r.origem) : "") + (limpa(r.status) ? "; status: " + limpa(r.status) : "") + "] " + (limpa(r.desc) || "(sem descrição)")));
  linhas.push("Artefatos (colunas): " + (d.col.length ? d.col.map((c) => codC(c) + (limpa(c.nome) && limpa(c.cod) ? " = " + limpa(c.nome) : "") + " (" + TIPOS_COL[c.tipo] + ")").join("; ") : "(nenhum)"));
  const porR = Object.fromEntries(d.req.map((r) => [r.id, r]));
  if (d.col.length) linhas.push("Rastreabilidade requisito → artefatos (células marcadas com ✕):");
  if (d.col.length) d.req.forEach((r) => {
    const cs = d.col.filter((c) => d.x.some((p) => p[0] === r.id && p[1] === c.id));
    linhas.push("- " + codR(r) + " → " + (cs.length ? cs.map(codC).join(", ") : "(nenhum artefato: requisito SEM rastreio)"));
  });
  const orfas = d.col.filter((c) => !d.x.some((p) => p[1] === c.id));
  if (orfas.length && d.req.length) linhas.push("Artefatos sem nenhum requisito: " + orfas.map(codC).join(", "));
  if (d.dep.length) {
    linhas.push("Dependências requisito × requisito (linha depende da coluna):");
    d.dep.forEach((p) => linhas.push("- " + codR(porR[p[0]]) + " depende de " + codR(porR[p[1]])));
  }
}

/* ── comparação local (tolerante a redação) ── */
const PARADAS = new Set("a o as os de da do das dos e em no na nos nas um uma uns umas para pra por pelo pela com ao aos se que sistema deve devera ser".split(" "));
const SINONIMOS = { efetu: "reali", fazer: "reali", faz: "reali", logar: "login", entra: "login", acess: "login", regis: "cadas", inclu: "cadas" };
export function normalizar(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
// "radical" grosseiro: os 5 primeiros caracteres (agendar ≈ agendamento, consulta ≈ consultas)
function tokens(s) {
  return normalizar(s).split(" ").filter((t) => t && !PARADAS.has(t)).map((t) => { const r = t.length > 5 ? t.slice(0, 5) : t.replace(/s$/, ""); return SINONIMOS[r] || r; });
}
function bigramas(s) { const t = normalizar(s).replace(/ /g, ""), b = []; for (let i = 0; i < t.length - 1; i++) b.push(t.slice(i, i + 2)); return b; }
function dice(a, b) {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const m = new Map(); a.forEach((x) => m.set(x, (m.get(x) || 0) + 1));
  let c = 0; b.forEach((x) => { const n = m.get(x); if (n) { c++; m.set(x, n - 1); } });
  return (2 * c) / (a.length + b.length);
}
/** 0..1: quão parecidos são dois textos (palavras com radical + pares de letras). */
export function similaridade(a, b) {
  const na = normalizar(a), nb = normalizar(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = [...new Set(tokens(a))], tb = [...new Set(tokens(b))];
  return Math.max(dice(ta, tb), 0.92 * dice(bigramas(a), bigramas(b)));
}
// casa duas listas pelo par mais parecido primeiro → Map(índice gabarito → índice resposta)
function casar(ga, re, pontuar, limiar = 0.5) {
  const pares = [];
  ga.forEach((g, i) => re.forEach((r, j) => { const s = pontuar(g, r); if (s >= limiar) pares.push([s, i, j]); }));
  pares.sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2]);
  const m = new Map(), usados = new Set();
  pares.forEach(([, i, j]) => { if (!m.has(i) && !usados.has(j)) { m.set(i, j); usados.add(j); } });
  return m;
}
const codigo = (s) => normalizar(s).replace(/ /g, "").toUpperCase().replace(/0+(\d)/g, "$1"); // "RF 01" = "rf1"

/** Compara a resposta com o gabarito → { nota 0..1, itens:[{ ok, texto }] } (uma prévia; a IA dá a nota final).
 *  inicial (opcional) = valor com que o aluno começou: o que ele já cumpria não conta (nem a favor nem contra). */
export function compararDiagramas(gabarito, resposta, inicial) {
  const g = lerDiagrama(gabarito), r = lerDiagrama(resposta);
  if (!g) return { nota: 0, itens: [{ ok: false, texto: "Gabarito inválido." }] };
  if (!r || diagramaVazio(r)) return { nota: 0, itens: [{ ok: false, texto: "Resposta em branco." }] };
  if (r.tipo !== g.tipo) return { nota: 0, itens: [{ ok: false, texto: "A resposta é de outro tipo de diagrama (" + TIPOS[r.tipo].nome + ")." }] };
  const itens = [];
  const item = (ok, texto, peso = 1) => itens.push({ ok: !!ok, texto, peso });
  ({ "casos-de-uso": compCasos, atividades: compAtividades, rastreabilidade: compMatriz, requisitos: compRequisitos, kanban: compKanban, historias: compHistorias, empatia: compEmpatia })[g.tipo](g, r, item);
  const ini = inicial ? lerDiagrama(inicial) : null;
  if (ini && ini.tipo === g.tipo) {
    const jaFeitos = new Set(compararDiagramas(gabarito, ini).itens.filter((i) => i.ok).map((i) => i.texto));
    for (let i = itens.length - 1; i >= 0; i--) if (itens[i].ok && jaFeitos.has(itens[i].texto)) itens.splice(i, 1);
  }
  const total = itens.reduce((s, i) => s + i.peso, 0), feitos = itens.reduce((s, i) => s + (i.ok ? i.peso : 0), 0);
  return { nota: total ? Math.round((feitos / total) * 1000) / 1000 : 1, itens: itens.map(({ ok, texto }) => ({ ok, texto })) };
}

// mapeia peças do gabarito → resposta pelo nome (por tipo de peça)
function casarPecas(g, r, t) {
  const ga = g.el.filter((e) => e.t === t), ra = r.el.filter((e) => e.t === t);
  const m = casar(ga, ra, (a, b) => similaridade(a.txt, b.txt));
  const ida = new Map(); // id resposta → id gabarito
  m.forEach((j, i) => ida.set(ra[j].id, ga[i].id));
  return { ga, ra, m, ida };
}

function compCasos(g, r, item) {
  const A = casarPecas(g, r, "ator"), C = casarPecas(g, r, "caso");
  const mapa = new Map([...A.ida, ...C.ida]); // resposta → gabarito
  const nomeG = Object.fromEntries(g.el.map((e) => [e.id, aspas(e.txt || e.t)]));
  const sisG = g.el.filter((e) => e.t === "sistema"), sisR = r.el.filter((e) => e.t === "sistema");
  const porIdR = Object.fromEntries(r.el.map((e) => [e.id, e]));
  A.ga.forEach((a, i) => item(A.m.has(i), A.m.has(i) ? "Ator " + aspas(a.txt) + " presente" + (limpa(A.ra[A.m.get(i)].txt) !== limpa(a.txt) ? " (como " + aspas(A.ra[A.m.get(i)].txt) + ")" : "") : "Falta o ator " + aspas(a.txt)));
  if (sisG.length) item(sisR.length, sisR.length ? "Limite do sistema desenhado" : "Falta o limite do sistema", 0.5);
  C.ga.forEach((c, i) => {
    const j = C.m.get(i);
    item(j != null, j != null ? "Caso de uso " + aspas(c.txt) + " presente" + (limpa(C.ra[j].txt) !== limpa(c.txt) ? " (como " + aspas(C.ra[j].txt) + ")" : "") : "Falta o caso de uso " + aspas(c.txt));
    if (j != null && sisG.length && sisG.some((s) => dentro(c, s))) {
      const ok = sisR.some((s) => dentro(C.ra[j], s));
      item(ok, aspas(c.txt) + (ok ? " dentro do limite do sistema" : " deveria estar DENTRO do limite do sistema"), 0.5);
    }
  });
  // atores dentro do sistema são erro comum
  A.ra.forEach((a) => { if (sisR.some((s) => dentro(a, s))) item(false, "O ator " + aspas(a.txt) + " está dentro do limite do sistema (atores ficam fora)", 0.5); });
  const chave = (t, a, b) => (t === "assoc" ? "assoc|" + [a, b].sort().join("|") : t + "|" + a + "|" + b);
  const relR = r.li.map((l) => ({ l, a: mapa.get(l.de), b: mapa.get(l.para) }));
  const chavesR = new Set(relR.filter((x) => x.a && x.b).map((x) => chave(x.l.t, x.a, x.b)));
  const ROT = { assoc: "Associação", include: "«include»", extend: "«extend»", gen: "Generalização" };
  const ehPeca = (id) => { const e = g.el.find((x) => x.id === id); return e && (e.t === "ator" || e.t === "caso"); };
  const chavesG = new Set(), paresG = new Set();
  g.li.filter((l) => ehPeca(l.de) && ehPeca(l.para)).forEach((l) => {
    const k = chave(l.t, l.de, l.para); chavesG.add(k); paresG.add([l.de, l.para].sort().join("|"));
    const desc = l.t === "assoc" ? "Associação " + nomeG[l.de] + " — " + nomeG[l.para] : nomeG[l.de] + " " + ROT[l.t] + " " + nomeG[l.para];
    if (chavesR.has(k)) return item(true, desc);
    let porque = "";
    if (l.t !== "assoc" && chavesR.has(chave(l.t, l.para, l.de))) porque = " — está com a direção invertida";
    else { const outro = ["assoc", "include", "extend", "gen"].find((t) => t !== l.t && (chavesR.has(chave(t, l.de, l.para)) || chavesR.has(chave(t, l.para, l.de)))); if (outro) porque = " — usou " + ROT[outro] + " no lugar"; }
    item(false, "Falta: " + desc + porque, l.t === "assoc" ? 1 : 1.5);
  });
  // ligações a mais entre peças que existem no gabarito (só quando o par é conhecido)
  const vistos = new Set();
  relR.forEach(({ l, a, b }) => {
    if (!a || !b) return;
    const k = chave(l.t, a, b);
    if (chavesG.has(k) || vistos.has(k) || paresG.has([a, b].sort().join("|"))) return;
    vistos.add(k);
    item(false, "Ligação a mais: " + ROT[l.t] + " entre " + aspas(porIdR[l.de].txt) + " e " + aspas(porIdR[l.para].txt), 0.5);
  });
}

// sucessores "visíveis": de cada início/ação até a próxima ação/fim, atravessando decisões e barras
function arestasFluxo(d, chaveDe) {
  const porId = Object.fromEntries(d.el.map((e) => [e.id, e])), saidas = new Map();
  d.li.forEach((l) => { if (!saidas.has(l.de)) saidas.set(l.de, []); saidas.get(l.de).push(l.para); });
  const sig = (e) => e && (e.t === "acao" || e.t === "inicio" || e.t === "fim");
  const arestas = new Set();
  d.el.filter(sig).forEach((e) => {
    const ka = chaveDe(e); if (!ka) return;
    const pilha = [...(saidas.get(e.id) || [])], vis = new Set();
    while (pilha.length) {
      const id = pilha.pop(); if (vis.has(id)) continue; vis.add(id);
      const x = porId[id]; if (!x) continue;
      if (sig(x)) { const kb = chaveDe(x); if (kb) arestas.add(ka + "→" + kb); }
      else if (x.t === "decisao" || x.t === "fork") pilha.push(...(saidas.get(id) || []));
    }
  });
  return arestas;
}
function compAtividades(g, r, item) {
  const AC = casarPecas(g, r, "acao"), RA = casarPecas(g, r, "raia");
  AC.ga.forEach((a, i) => item(AC.m.has(i), AC.m.has(i) ? "Ação " + aspas(a.txt) + " presente" : "Falta a ação " + aspas(a.txt)));
  const tem = (d, t) => d.el.some((e) => e.t === t);
  if (tem(g, "inicio")) item(tem(r, "inicio"), tem(r, "inicio") ? "Nó inicial presente" : "Falta o nó inicial", 0.5);
  if (tem(g, "fim")) item(tem(r, "fim"), tem(r, "fim") ? "Nó final presente" : "Falta o nó final", 0.5);
  const nd = g.el.filter((e) => e.t === "decisao").length, rd = r.el.filter((e) => e.t === "decisao").length;
  if (nd) item(rd >= nd, "Decisões: esperado " + nd + ", encontrado " + rd, 0.5);
  // raias
  RA.ga.forEach((ra, i) => item(RA.m.has(i), RA.m.has(i) ? "Raia " + aspas(ra.txt) + " presente" : "Falta a raia " + aspas(ra.txt), 0.5));
  if (RA.ga.length) {
    const donoG = (e) => RA.ga.filter((k) => dentro(e, k)).pop(), donoR = (e) => RA.ra.filter((k) => dentro(e, k)).pop();
    AC.m.forEach((j, i) => {
      const rg = donoG(AC.ga[i]); if (!rg) return;
      const rr = donoR(AC.ra[j]), ok = rr && RA.ida.get(rr.id) === rg.id;
      item(ok, aspas(AC.ga[i].txt) + (ok ? " na raia certa (" + aspas(rg.txt) + ")" : " deveria estar na raia " + aspas(rg.txt)), 0.5);
    });
  }
  const nomeG = Object.fromEntries(g.el.map((e) => [e.id, e.t === "inicio" ? "início" : e.t === "fim" ? "fim" : aspas(e.txt)]));
  const chaveG = (e) => (e.t === "inicio" ? "INICIO" : e.t === "fim" ? "FIM" : e.id);
  const chaveR = (e) => (e.t === "inicio" ? "INICIO" : e.t === "fim" ? "FIM" : AC.ida.get(e.id));
  const eg = arestasFluxo(g, chaveG), er = arestasFluxo(r, chaveR);
  const nomeK = (k) => (k === "INICIO" ? "início" : k === "FIM" ? "fim" : nomeG[k]);
  eg.forEach((k) => { const [a, b] = k.split("→"); item(er.has(k), (er.has(k) ? "Fluxo " : "Falta o fluxo ") + nomeK(a) + " → " + nomeK(b)); });
  er.forEach((k) => { if (!eg.has(k)) { const [a, b] = k.split("→"); item(false, "Fluxo a mais: " + nomeK(a) + " → " + nomeK(b), 0.5); } });
}

function casarReqs(gr, rr) {
  return casar(gr, rr, (a, b) => (limpa(a.cod) && codigo(a.cod) === codigo(b.cod) ? 1 + similaridade(a.desc, b.desc) : limpa(a.desc) ? similaridade(a.desc, b.desc) * 0.95 : 0), 0.45);
}
function compMatriz(g, r, item) {
  const mr = casarReqs(g.req, r.req);
  const mc = casar(g.col, r.col, (a, b) => (limpa(a.cod) && codigo(a.cod) === codigo(b.cod) ? 2 : similaridade(a.nome, b.nome)), 0.55);
  const nomeR = (x) => limpa(x.cod) || aspas(x.desc), nomeC = (c) => limpa(c.cod) || aspas(c.nome);
  g.req.forEach((q, i) => {
    const j = mr.get(i);
    item(j != null, j != null ? "Requisito " + nomeR(q) + " presente" : "Falta o requisito " + nomeR(q), 0.5);
    if (j != null) {
      const x = r.req[j];
      item(x.tipo === q.tipo, nomeR(q) + (x.tipo === q.tipo ? " classificado como " + q.tipo : " deveria ser " + q.tipo + " (está como " + x.tipo + ")"), 0.5);
      if (limpa(q.prio)) item(normalizar(x.prio) === normalizar(q.prio), nomeR(q) + " com prioridade " + q.prio + (normalizar(x.prio) === normalizar(q.prio) ? "" : " (está " + (x.prio || "vazia") + ")"), 0.25);
    }
  });
  g.col.forEach((c, i) => item(mc.has(i), mc.has(i) ? "Artefato " + nomeC(c) + " presente" : "Falta o artefato " + nomeC(c), 0.5));
  // marcas: traduz ids da resposta para o gabarito
  const ir = new Map(), ic = new Map();
  mr.forEach((j, i) => ir.set(r.req[j].id, g.req[i].id));
  mc.forEach((j, i) => ic.set(r.col[j].id, g.col[i].id));
  const porRG = Object.fromEntries(g.req.map((x) => [x.id, x])), porCG = Object.fromEntries(g.col.map((x) => [x.id, x]));
  const porRR = Object.fromEntries(r.req.map((x) => [x.id, x])), porCR = Object.fromEntries(r.col.map((x) => [x.id, x]));
  const comparaPares = (pg, pr, mapB, nomeB, nomeBR, sep) => {
    const kg = new Set(pg.map((p) => p[0] + "|" + p[1]));
    const kr = new Set(pr.map((p) => (ir.get(p[0]) || "?") + "|" + (mapB.get(p[1]) || "?")));
    pg.forEach((p) => item(kr.has(p[0] + "|" + p[1]), (kr.has(p[0] + "|" + p[1]) ? "" : "Falta marcar ") + nomeR(porRG[p[0]]) + sep + nomeB(p[1])));
    pr.forEach((p) => {
      const a = ir.get(p[0]), b = mapB.get(p[1]);
      if (a && b && !kg.has(a + "|" + b)) item(false, "Marca a mais: " + nomeR(porRR[p[0]]) + sep + nomeBR(p[1]), 0.5);
    });
  };
  comparaPares(g.x, r.x, ic, (id) => nomeC(porCG[id]), (id) => nomeC(porCR[id]), " → ");
  comparaPares(g.dep, r.dep, ir, (id) => nomeR(porRG[id]), (id) => nomeR(porRR[id]), " depende de ");
}

function compRequisitos(g, r, item) {
  const m = casar(g.itens, r.itens, (a, b) => similaridade(a.desc, b.desc) + (limpa(a.cod) && codigo(a.cod) === codigo(b.cod) ? 0.15 : 0), 0.42);
  const nome = (q) => (limpa(q.cod) ? limpa(q.cod) + " " : "") + aspas(q.desc.length > 70 ? q.desc.slice(0, 67) + "…" : q.desc);
  g.itens.forEach((q, i) => {
    const j = m.get(i);
    item(j != null, (j != null ? "Registrado: " : "Falta o requisito ") + nome(q));
    if (j == null) return;
    const x = r.itens[j];
    item(x.tipo === q.tipo, nome(q) + (x.tipo === q.tipo ? " classificado como " + TIPOS_REQ[q.tipo] : " deveria ser " + TIPOS_REQ[q.tipo] + " (está como " + TIPOS_REQ[x.tipo] + ")"));
    if (q.tipo === "RNF" && limpa(q.cat) && x.tipo === "RNF") item(normalizar(x.cat) === normalizar(q.cat), nome(q) + " na categoria " + q.cat + (normalizar(x.cat) === normalizar(q.cat) ? "" : " (está " + (x.cat || "sem categoria") + ")"), 0.5);
  });
  if (limpa(g.cab.projeto)) item(limpa(r.cab.projeto), "Cabeçalho com o nome do projeto", 0.25);
  if (limpa(g.cab.versao)) item(limpa(r.cab.versao), "Cabeçalho com a versão do documento", 0.25);
  if (g.hist.length) item(r.hist.length >= g.hist.length, "Histórico de revisões: esperado " + g.hist.length + " registro(s), encontrado " + r.hist.length, 0.5);
}

// nomes usuais de cada etapa (A fazer = To do = Backlog...)
const COLUNAS_EQUIV = [
  ["a fazer", "to do", "todo", "backlog", "pendente", "pendentes", "nao iniciado", "fila"],
  ["fazendo", "em andamento", "em progresso", "doing", "em desenvolvimento", "desenvolvendo", "in progress", "executando"],
  ["em teste", "testando", "teste", "testes", "em validacao", "validacao", "homologacao", "qa", "testing"],
  ["feito", "concluido", "concluidos", "pronto", "done", "finalizado", "entregue"]
];
function colunaCanonica(s) { const k = normalizar(s); const g = COLUNAS_EQUIV.find((l) => l.includes(k)); return g ? g[0] : s; }
function compKanban(g, r, item) {
  const mc = casar(g.cols, r.cols, (a, b) => similaridade(colunaCanonica(a.nome), colunaCanonica(b.nome)), 0.5);
  const icol = new Map(); mc.forEach((j, i) => icol.set(r.cols[j].id, g.cols[i].id));
  const nomeColG = Object.fromEntries(g.cols.map((c) => [c.id, aspas(c.nome)])), nomeColR = Object.fromEntries(r.cols.map((c) => [c.id, aspas(c.nome)]));
  g.cols.forEach((c, i) => {
    const j = mc.get(i);
    item(j != null, j != null ? "Coluna " + aspas(c.nome) + " presente" : "Falta a coluna " + aspas(c.nome), 0.5);
    if (j != null && c.wip) item(r.cols[j].wip === c.wip, "Limite WIP de " + aspas(c.nome) + ": esperado " + c.wip + ", está " + (r.cols[j].wip || "sem limite"), 0.5);
  });
  const mk = casar(g.cards, r.cards, (a, b) => similaridade(a.txt, b.txt), 0.5);
  g.cards.forEach((k, i) => {
    const j = mk.get(i);
    if (j == null) return item(false, "Falta o cartão " + aspas(k.txt));
    const x = r.cards[j], ok = icol.get(x.col) === k.col;
    item(ok, "Cartão " + aspas(k.txt) + (ok ? " em " + nomeColG[k.col] : " está em " + nomeColR[x.col] + ", esperado " + nomeColG[k.col]));
  });
  r.cols.forEach((c) => { const n = r.cards.filter((k) => k.col === c.id).length; if (c.wip && n > c.wip) item(false, "Coluna " + aspas(c.nome) + " acima do limite WIP (" + n + "/" + c.wip + ")", 0.5); });
}

function compHistorias(g, r, item) {
  const m = casar(g.itens, r.itens, (a, b) => 0.75 * similaridade(a.acao, b.acao) + 0.25 * similaridade(a.papel, b.papel), 0.42);
  g.itens.forEach((h, i) => {
    const j = m.get(i), nome = aspas("Como " + h.papel + ", quero " + h.acao);
    item(j != null, (j != null ? "História presente: " : "Falta a história ") + nome);
    if (j == null) return;
    const x = r.itens[j];
    item(limpa(x.beneficio), "Benefício (“para …”) preenchido em " + nome, 0.5);
    const min = Math.min(Math.max(1, h.criterios.length), 2);
    item(x.criterios.length >= min, "Critérios de aceitação em " + nome + ": " + x.criterios.length + " (mínimo " + min + ")", 0.5);
    if (limpa(h.prio)) item(normalizar(x.prio) === normalizar(h.prio), "Prioridade " + h.prio + " em " + nome + (normalizar(x.prio) === normalizar(h.prio) ? "" : " (está " + (x.prio || "vazia") + ")"), 0.25);
    if (limpa(h.pontos)) item(limpa(x.pontos), "Pontos estimados em " + nome, 0.25);
  });
  // ordem do backlog: pares concordantes
  const pares = [...m.entries()];
  if (pares.length >= 2) {
    let total = 0, ok = 0;
    for (let a = 0; a < pares.length; a++) for (let b = a + 1; b < pares.length; b++) { total++; if ((pares[a][0] - pares[b][0]) * (pares[a][1] - pares[b][1]) > 0) ok++; }
    item(ok / total >= 0.7, "Ordem do backlog por prioridade (" + Math.round((100 * ok) / total) + "% dos pares na ordem esperada)", 0.5);
  }
}

function compEmpatia(g, r, item) {
  const nomeA = Object.fromEntries(AREAS_EMPATIA.map((a) => [a.id, a.nome]));
  if (limpa(g.persona)) item(limpa(r.persona), "Persona descrita", 0.25);
  const m = casar(g.notas, r.notas, (a, b) => similaridade(a.txt, b.txt) + (a.area === b.area ? 0.1 : 0), 0.45);
  g.notas.forEach((n, i) => {
    const j = m.get(i);
    if (j == null) return item(false, "Falta a nota " + aspas(n.txt) + " em " + nomeA[n.area]);
    const ok = r.notas[j].area === n.area;
    item(ok, "Nota " + aspas(n.txt) + (ok ? " em " + nomeA[n.area] : " está em " + nomeA[r.notas[j].area] + ", esperado " + nomeA[n.area]));
  });
  AREAS_EMPATIA.forEach((a) => { if (g.notas.some((n) => n.area === a.id)) item(r.notas.some((n) => n.area === a.id && limpa(n.txt)), "Área " + a.nome + " preenchida", 0.25); });
}
