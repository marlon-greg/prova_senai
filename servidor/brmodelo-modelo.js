// brModelo do sistema: lógica pura (sem DOM) dos diagramas de banco de dados. Usada pelo editor (js/brmodelo.js),
// pela tela do professor e pelo servidor (Worker). Segue a notação do brModelo 3 (Peter Chen, como no livro do Heuser).
//
// Valor guardado (JSON):
//   { v:1, conceitual?: Diagrama, logico?: Diagrama }      (um ou os dois diagramas; as questões "er-ambos" usam os dois)
//   lerModelo() também aceita o formato curto { v:1, modelo:"conceitual"|"logico", el:[...], li:[...] }.
//
// Diagrama = { el:[Elemento], li:[Ligacao] }. Coordenadas em px do desenho; x,y = canto superior esquerdo
// (no atributo, x,y = centro da bolinha).
//
// Conceitual (MER):
//   { id, t:"entidade",       nome, x, y }
//   { id, t:"relacionamento", nome, x, y }                     losango
//   { id, t:"associativa",    nome, x, y }                     entidade associativa (retângulo em volta do losango)
//   { id, t:"atributo",       nome, x, y, dono, chave?, card? } dono = entidade/relacionamento/associativa/atributo
//        chave:true = identificador (bolinha preta); card "(1,n)" = multivalorado; "(0,1)" = opcional;
//        atributo com atributos filhos (dono = ele) = atributo composto
//   { id, t:"especializacao", x, y, pai, total, exclusiva }   triângulo; pai = entidade genérica
//   { id, t:"texto",          nome, x, y }                     anotação
//   Ligações: { id, a, b, card?, papel? }
//        entidade/associativa (a) ↔ relacionamento (b): card = cardinalidade (mín,máx) escrita junto da entidade a,
//          como no brModelo: Cliente (1,1) —faz— (0,n) Pedido = cada pedido tem 1 cliente, cada cliente tem 0..n pedidos.
//        associativa (b) ↔ entidade (a): participantes do relacionamento que a associativa representa.
//        especializacao (a) → entidade filha (b).
//
// Lógico:
//   { id, t:"tabela", nome, x, y, cols:[{ nome, tipo, pk, fk, ref, nn, un }] }
//        fk = id da tabela referenciada ("" se não é FK), ref = coluna referenciada, nn = NOT NULL, un = UNIQUE
//   { id, t:"texto", nome, x, y }
//   Ligações: { id, a, b, ca, cb }  a = tabela que tem a FK, b = tabela referenciada; ca/cb = cardinalidade junto de a/b
//
// API:
//   lerModelo(valor)                  → valor normalizado { v:1, conceitual?, logico? } ou null se inválido/vazio
//   modeloVazio(m)                    → true se não há nenhum elemento (aceita valor ou diagrama)
//   novoDiagrama()                    → { el:[], li:[] }
//   gerarLogico(conceitual)           → diagrama lógico (conversão do brModelo: entidade→tabela, 1:N→FK no lado N...)
//   gerarSQL(logico)                  → script MySQL (CREATE TABLE ... PRIMARY KEY, FOREIGN KEY ... REFERENCES)
//   textoModelo(valor)                → descrição em texto, determinística (é o que a IA corretora lê)
//   compararModelos(gabarito, resposta) → { nota: 0..1, itens:[{ ok, texto, peso }] } comparação estrutural local
//   montarExemplo(spec)               → diagrama conceitual a partir de uma descrição curta (bancos, exemplos)
//   geo(el, diag), ponta(...), normCard(c), sqlNome(s), tipoPorNome(s), posicaoNovoAtributo(diag, dono, lado)

export const CARDS = ["(0,1)", "(1,1)", "(0,n)", "(1,n)"];
export const TIPOS_SQL = ["INT", "BIGINT", "VARCHAR(100)", "VARCHAR(50)", "VARCHAR(255)", "CHAR(11)", "TEXT", "DATE", "DATETIME", "TIME", "DECIMAL(10,2)", "FLOAT", "BOOLEAN"];
const TIPOS_CONC = ["entidade", "relacionamento", "associativa", "atributo", "especializacao", "texto"];
const TIPOS_LOG = ["tabela", "texto"];
const MAX_EL = 600;

// ---------- utilidades ----------
export const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const txt = (s, n = 80) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
const ordenar = (arr, f) => arr.slice().sort((a, b) => f(a).localeCompare(f(b), "pt-BR"));

// "(1,N)", "1,n", "1..n", "(1, *)" → "(1,n)"; inválido → ""
export function normCard(c) {
  const m = String(c ?? "").trim().match(/^\(?\s*(\d+)\s*(?:,|;|\.\.|\.)\s*(\d+|[nN*])\s*\)?$/);
  if (!m) return "";
  const max = /[nN*]/.test(m[2]) ? "n" : String(Number(m[2]));
  return `(${Number(m[1])},${max})`;
}
export const minCard = (c) => (normCard(c) ? Number(normCard(c).slice(1).split(",")[0]) : 0);
export const maxN = (c) => { const n = normCard(c); if (!n) return true; const mx = n.slice(1, -1).split(",")[1]; return mx === "n" || Number(mx) > 1; };

// nome válido em SQL: sem acento, sem espaço, sem símbolo
export function sqlNome(s) {
  let r = semAcento(s).trim().replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!r) r = "sem_nome";
  if (/^\d/.test(r)) r = "_" + r;
  return r.slice(0, 64);
}

// tipo provável pelo nome da coluna (a pessoa troca no Inspetor)
export function tipoPorNome(nome) {
  const n = semAcento(nome).toLowerCase();
  if (/^(id|cod|codigo|num|numero|qtd|quantidade|ano|idade|matricula|nr|n_)(_|$)|^id[a-z]|_id$/.test(n) || /^(id|qtd|quantidade|idade|ano|estoque|numero|andar|carga_horaria|duracao)$/.test(n)) return "INT";
  if (/(^|_)(data|dt|nascimento|vencimento)(_|$)|^data/.test(n)) return "DATE";
  if (/(^|_)(hora|horario)(_|$)/.test(n)) return "TIME";
  if (/(preco|valor|salario|total|saldo|desconto|peso|altura|nota|media|bonus|comissao|taxa|mensalidade)/.test(n)) return "DECIMAL(10,2)";
  if (/(^|_)(cpf)(_|$)/.test(n)) return "CHAR(11)";
  if (/(^|_)(telefone|celular|fone|cep)(_|$)/.test(n)) return "VARCHAR(20)";
  if (/(descricao|observacao|obs|sinopse|texto)/.test(n)) return "TEXT";
  if (/^(ativo|pago|disponivel)$/.test(n)) return "BOOLEAN";
  return "VARCHAR(100)";
}

// ---------- normalização ----------
export function novoDiagrama() { return { el: [], li: [] }; }

export function lerModelo(valor) {
  let o = valor;
  if (typeof o === "string") {
    if (!o.trim()) return null;
    try { o = JSON.parse(o); } catch { return null; }
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const out = { v: 1 };
  if (Array.isArray(o.el)) {
    const tipo = o.modelo === "logico" || o.el.some((e) => e && e.t === "tabela") ? "logico" : "conceitual";
    out[tipo] = normDiagrama(o, tipo);
  }
  if (o.conceitual && typeof o.conceitual === "object") out.conceitual = normDiagrama(o.conceitual, "conceitual");
  if (o.logico && typeof o.logico === "object") out.logico = normDiagrama(o.logico, "logico");
  if (!out.conceitual && !out.logico) return null;
  return out;
}

export function modeloVazio(m) {
  if (!m) return true;
  if (Array.isArray(m.el)) return !m.el.length;
  return modeloVazio(m.conceitual) && modeloVazio(m.logico);
}

function normDiagrama(d, tipo) {
  const validos = tipo === "logico" ? TIPOS_LOG : TIPOS_CONC;
  const el = [], ids = new Set();
  for (const e of (Array.isArray(d.el) ? d.el : []).slice(0, MAX_EL)) {
    if (!e || typeof e !== "object" || !validos.includes(e.t)) continue;
    let id = txt(e.id, 40) || "n" + (el.length + 1);
    while (ids.has(id)) id += "_";
    ids.add(id);
    const n = { id, t: e.t, nome: txt(e.nome, e.t === "texto" ? 600 : 80), x: num(e.x), y: num(e.y) };
    if (e.t === "texto") n.nome = String(e.nome ?? "").slice(0, 600);
    if (e.t === "atributo") {
      n.dono = txt(e.dono, 40);
      if (e.chave) n.chave = true;
      const c = normCard(e.card);
      if (c && c !== "(1,1)") n.card = c;
    }
    if (e.t === "especializacao") {
      delete n.nome;
      n.pai = txt(e.pai, 40);
      n.total = !!e.total;
      n.exclusiva = e.exclusiva !== false;
    }
    if (e.t === "tabela") {
      n.cols = (Array.isArray(e.cols) ? e.cols : []).slice(0, 80).filter((c) => c && typeof c === "object").map((c) => {
        const col = { nome: txt(c.nome, 64) || "coluna", tipo: txt(c.tipo, 40) || "VARCHAR(100)", pk: !!c.pk, fk: txt(c.fk, 40), ref: txt(c.ref, 64), nn: !!(c.nn || c.pk) };
        if (c.un) col.un = true;
        return col;
      });
    }
    el.push(n);
  }
  const por = new Map(el.map((e) => [e.id, e]));
  // atributo sem dono válido sai (e os filhos dele em seguida)
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (let i = el.length - 1; i >= 0; i--) {
      const e = el[i];
      if (e.t !== "atributo") continue;
      const d = por.get(e.dono);
      if (!d || !["entidade", "relacionamento", "associativa", "atributo"].includes(d.t) || d === e) { el.splice(i, 1); por.delete(e.id); mudou = true; }
    }
  }
  for (const e of el) {
    if (e.t === "especializacao" && !(por.get(e.pai)?.t === "entidade" || por.get(e.pai)?.t === "associativa")) e.pai = "";
    if (e.t === "tabela") for (const c of e.cols) { if (c.fk && por.get(c.fk)?.t !== "tabela") { c.fk = ""; c.ref = ""; } if (!c.fk) c.ref = ""; }
  }
  const li = [], lids = new Set();
  for (const l of (Array.isArray(d.li) ? d.li : []).slice(0, MAX_EL)) {
    if (!l || typeof l !== "object") continue;
    const a = por.get(txt(l.a, 40)), b = por.get(txt(l.b, 40));
    if (!a || !b) continue;
    let id = txt(l.id, 40) || "l" + (li.length + 1);
    while (lids.has(id) || ids.has(id)) id += "_";
    lids.add(id);
    if (tipo === "logico") {
      if (a.t !== "tabela" || b.t !== "tabela") continue;
      li.push({ id, a: a.id, b: b.id, ca: normCard(l.ca), cb: normCard(l.cb) });
    } else {
      const ok = (["entidade", "associativa"].includes(a.t) && ["relacionamento", "associativa"].includes(b.t) && a !== b) ||
        (a.t === "especializacao" && ["entidade", "associativa"].includes(b.t));
      if (!ok) continue;
      const n = { id, a: a.id, b: b.id };
      if (a.t !== "especializacao") { n.card = normCard(l.card); const p = txt(l.papel, 40); if (p) n.papel = p; }
      li.push(n);
    }
  }
  return { el, li };
}

// ---------- geometria (compartilhada pelo editor e pelo desenho) ----------
const largTexto = (s, px = 7) => String(s || "").length * px;

// caixa de cada elemento: { x, y, w, h, cx, cy, forma }
export function geo(el, diag) {
  const nome = el.nome || "";
  let w, h;
  switch (el.t) {
    case "entidade": w = Math.max(100, largTexto(nome, 7.4) + 30); h = 44; break;
    case "associativa": w = Math.max(170, largTexto(nome, 7.4) + 100); h = 84; break;
    case "relacionamento": w = Math.max(104, largTexto(nome, 7.4) + 60); h = 58; break;
    case "especializacao": w = 46; h = 38; break;
    case "atributo": {
      const composto = !!diag && diag.el.some((f) => f.t === "atributo" && f.dono === el.id);
      const rx = composto ? 14 : 5.5, ry = composto ? 7 : 5.5;
      return { x: el.x - rx, y: el.y - ry, w: rx * 2, h: ry * 2, cx: el.x, cy: el.y, rx, ry, forma: "circ", composto };
    }
    case "texto": {
      const linhas = String(nome || "").split("\n");
      w = Math.max(40, Math.max(...linhas.map((l) => largTexto(l, 6.6))) + 14); h = linhas.length * 15 + 9; break;
    }
    case "tabela": {
      const cols = el.cols || [];
      const maior = Math.max(0, ...cols.map((c) => largTexto(c.nome, 7) + largTexto(c.tipo, 6.2) + 14));
      w = Math.max(160, largTexto(nome, 8) + 36, maior + 40);
      h = 26 + Math.max(1, cols.length) * 19 + 6;
      break;
    }
    default: w = 40; h = 20;
  }
  const forma = el.t === "relacionamento" ? "losango" : el.t === "especializacao" ? "tri" : "ret";
  return { x: el.x, y: el.y, w, h, cx: el.x + w / 2, cy: el.y + h / 2, forma };
}

export function poligono(g) {
  const { x, y, w, h, cx, cy } = g;
  if (g.forma === "losango") return [[cx, y], [x + w, cy], [cx, y + h], [x, cy]];
  if (g.forma === "tri") return [[cx, y], [x + w, y + h], [x, y + h]];
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

// ponto da borda da forma g na direção de (tx,ty), saindo de (ox,oy) (padrão: o centro)
export function ponta(g, tx, ty, ox = g.cx, oy = g.cy) {
  const dx = tx - ox, dy = ty - oy;
  if (!dx && !dy) return [ox, oy];
  if (g.forma === "circ") {
    const t = 1 / Math.sqrt((dx / g.rx) ** 2 + (dy / g.ry) ** 2);
    return [g.cx + dx * t, g.cy + dy * t];
  }
  const p = poligono(g);
  let melhor = null;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((x1 - ox) * ey - (y1 - oy) * ex) / den;
    const u = ((x1 - ox) * dy - (y1 - oy) * dx) / den;
    if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6 && (melhor === null || t < melhor)) melhor = t;
  }
  if (melhor === null) return [ox, oy];
  return [ox + dx * melhor, oy + dy * melhor];
}

// largura aproximada do nome do atributo (Arial 12px) + a bolinha
export const larguraRotulo = (a) => (String(a.nome || "") + (a.card ? " " + a.card : "")).length * 7.2 + 14;

// lugar livre para um atributo novo ao lado do dono ("d" direita, "e" esquerda, "c" cima, "b" baixo)
export function posicaoNovoAtributo(diag, dono, lado = "d") {
  const g = geo(dono, diag);
  const ats = diag.el.filter((e) => e.t === "atributo");
  const ocupado = (x, y) => ats.some((e) => Math.abs(e.x - x) < 14 && Math.abs(e.y - y) < 15);
  // em cima/embaixo: uma fileira para a direita a partir do meio, cada um depois do nome do anterior
  if ((lado === "c" || lado === "b") && dono.t !== "atributo") {
    const y = lado === "c" ? g.y - 34 : g.y + g.h + 34;
    const fim = Math.max(g.cx - 16, ...ats.filter((e) => e.dono === dono.id && Math.abs(e.y - y) < 10).map((e) => e.x + larguraRotulo(e)));
    return { x: Math.round(fim + 18), y: Math.round(y) };
  }
  const cands = [];
  for (let i = 0; i < 30; i++) {
    const k = i % 2 ? -Math.ceil(i / 2) : Math.ceil(i / 2); // 0, -1, 1, -2, 2... alternando em volta do meio
    if (dono.t === "atributo") cands.push([g.cx + (lado === "e" ? -44 : 44), g.cy + k * 16]); // partes do composto
    else if (lado === "e") cands.push([g.x - 34, g.cy + k * 18]);
    else cands.push([g.x + g.w + 34, g.cy + k * 18]);
  }
  const livre = cands.find(([x, y]) => !ocupado(x, y)) || cands[0];
  return { x: Math.round(livre[0]), y: Math.round(livre[1]) };
}

// ---------- consultas no diagrama ----------
const porId = (d) => new Map(d.el.map((e) => [e.id, e]));
const atributosDe = (d, id) => d.el.filter((e) => e.t === "atributo" && e.dono === id);
// participantes de um relacionamento (ou da associativa): [{ ent, card, papel, li }]
function participantes(d, rel, ids) {
  return d.li.filter((l) => l.b === rel.id && ids.get(l.a) && ids.get(l.a).t !== "especializacao")
    .map((l) => ({ ent: ids.get(l.a), card: normCard(l.card), papel: l.papel || "", li: l }));
}
// relacionamentos de que a associativa participa como entidade ficam com a=associativa; os de dentro dela, b=associativa
const ehMulti = (a) => !!a.card && maxN(a.card);
const ehOpcional = (a) => !!a.card && minCard(a.card) === 0;

// ---------- conceitual → lógico ----------
export function gerarLogico(valor) {
  const d = valor?.conceitual || (Array.isArray(valor?.el) ? valor : null);
  const out = { el: [], li: [] };
  if (!d) return out;
  const ids = porId(d);
  let seq = 0;
  const novoId = (p) => p + ++seq;
  const tabDe = new Map();      // id da entidade/associativa/relacionamento → tabela
  const nomesUsados = new Set();
  const nomeTabela = (s) => { let n = sqlNome(s), k = 2; while (nomesUsados.has(n.toLowerCase())) n = sqlNome(s) + "_" + k++; nomesUsados.add(n.toLowerCase()); return n; };
  const novaTabela = (nome, x, y) => { const t = { id: novoId("t"), t: "tabela", nome: nomeTabela(nome), x: Math.round(x), y: Math.round(y), cols: [] }; out.el.push(t); return t; };
  const nomeLivre = (t, base) => { let n = sqlNome(base), k = 2; while (t.cols.some((c) => c.nome.toLowerCase() === n.toLowerCase())) n = sqlNome(base) + "_" + k++; return n; };
  const pks = (t) => t.cols.filter((c) => c.pk);
  const multis = [];

  // atributos simples viram colunas; composto vira as colunas dos filhos; multivalorado vira tabela à parte
  function colunas(donoId, t, chaveHerdada = false, opcionalHerdado = false) {
    for (const a of atributosDe(d, donoId)) {
      if (ehMulti(a)) { multis.push({ a, t }); continue; }
      const filhos = atributosDe(d, a.id);
      const pk = chaveHerdada || !!a.chave, opc = opcionalHerdado || ehOpcional(a);
      if (filhos.length) { colunas(a.id, t, pk, opc); continue; }
      t.cols.push({ nome: nomeLivre(t, a.nome), tipo: tipoPorNome(a.nome), pk, fk: "", ref: "", nn: pk || !opc });
    }
  }
  // copia a PK de ref para t como FK (papel distingue auto-relacionamento)
  function addFK(t, ref, { pk = false, nn = true, papel = "", un = false } = {}) {
    const novas = [];
    for (const c of pks(ref)) {
      let base = c.nome;
      if (papel) base = /^(id|cod|codigo)_/i.test(c.nome) ? c.nome.replace(/_.*/, "") + "_" + papel : c.nome + "_" + papel;
      const col = { nome: nomeLivre(t, base), tipo: c.tipo === "SERIAL" ? "INT" : c.tipo, pk, fk: ref.id, ref: c.nome, nn: pk || nn };
      if (un) col.un = true;
      t.cols.push(col); novas.push(col);
    }
    return novas;
  }
  const ligar = (a, b, ca, cb) => out.li.push({ id: novoId("l"), a: a.id, b: b.id, ca: ca || "", cb: cb || "" });
  const garantirPK = (t, nome) => { if (!pks(t).length) t.cols.unshift({ nome: nomeLivre(t, "id_" + sqlNome(nome).toLowerCase()), tipo: "INT", pk: true, fk: "", ref: "", nn: true }); };

  const ents = d.el.filter((e) => e.t === "entidade");
  const esps = d.el.filter((e) => e.t === "especializacao" && e.pai && ids.get(e.pai));
  const paiDe = new Map(); // filha → { pai, esp }
  for (const s of esps) for (const l of d.li.filter((l) => l.a === s.id)) { const f = ids.get(l.b); if (f && f.id !== s.pai) paiDe.set(f.id, { pai: ids.get(s.pai), esp: s }); }

  // 1) entidades
  for (const e of ents) { const t = novaTabela(e.nome, e.x * 1.5, e.y * 1.7); tabDe.set(e.id, t); colunas(e.id, t); }
  // 2) PK de quem não é filha de especialização
  for (const e of ents) if (!paiDe.has(e.id)) garantirPK(tabDe.get(e.id), e.nome);
  // 3) especialização: a filha usa a PK da mãe (que também é FK)
  const feitas = new Set();
  const fazerFilha = (e, pilha = new Set()) => {
    if (feitas.has(e.id) || pilha.has(e.id)) return;
    pilha.add(e.id);
    const { pai, esp } = paiDe.get(e.id);
    if (paiDe.has(pai.id)) fazerFilha(pai, pilha);
    const t = tabDe.get(e.id), tp = tabDe.get(pai.id);
    if (!t || !tp) return;
    if (!pks(tp).length) garantirPK(tp, pai.nome);
    for (const c of t.cols) c.pk = false; // identificador próprio da filha vira coluna comum
    const novas = addFK(t, tp, { pk: true });
    t.cols = [...novas, ...t.cols.filter((c) => !novas.includes(c))];
    ligar(t, tp, "(0,1)", "(1,1)");
    feitas.add(e.id);
  };
  for (const e of ents) if (paiDe.has(e.id)) fazerFilha(e);

  // relacionamento N:N (ou de 3+ entidades, ou associativa) → tabela com as FKs; PK = FKs (se não tem identificador)
  function tabelaAssociativa(rel, parts, nomeBase) {
    const g = geo(rel, d);
    const t = novaTabela(nomeBase, g.x * 1.5, g.y * 1.7);
    colunas(rel.id, t);
    const temPK = pks(t).length > 0;
    const novasTodas = [];
    for (const p of parts) {
      const ref = tabDe.get(p.ent.id);
      if (!ref) continue;
      const auto = parts.filter((q) => q.ent.id === p.ent.id).length > 1;
      const novas = addFK(t, ref, { pk: !temPK, papel: auto && p.papel ? sqlNome(p.papel).toLowerCase() : "" });
      novasTodas.push(...novas);
      const outra = parts.find((q) => q !== p);
      ligar(t, ref, (parts.length === 2 && outra?.card) || "(0,n)", "(1,1)");
    }
    t.cols = [...novasTodas, ...t.cols.filter((c) => !novasTodas.includes(c))];
    tabDe.set(rel.id, t);
    return t;
  }

  // 4) entidades associativas (a tabela delas é referenciada pelos relacionamentos de que participam)
  for (const s of d.el.filter((e) => e.t === "associativa")) {
    const parts = participantes(d, s, ids).filter((p) => p.ent.t === "entidade");
    tabelaAssociativa(s, parts, s.nome);
  }
  // 5) relacionamentos
  for (const r of d.el.filter((e) => e.t === "relacionamento")) {
    const parts = participantes(d, r, ids).filter((p) => tabDe.get(p.ent.id));
    if (parts.length < 2) continue;
    if (parts.length > 2 || (maxN(parts[0].card) && maxN(parts[1].card))) { tabelaAssociativa(r, parts, r.nome); continue; }
    const [p1, p2] = parts;
    let fkP, refP;
    if (maxN(p1.card) !== maxN(p2.card)) { fkP = maxN(p1.card) ? p1 : p2; refP = fkP === p1 ? p2 : p1; }   // 1:N → FK no lado N
    else if (minCard(p2.card) >= 1) { fkP = p1; refP = p2; }    // 1:1 → FK em quem sempre tem o outro
    else if (minCard(p1.card) >= 1) { fkP = p2; refP = p1; }
    else { fkP = p1; refP = p2; }
    const t = tabDe.get(fkP.ent.id), ref = tabDe.get(refP.ent.id);
    const auto = p1.ent.id === p2.ent.id;
    const papel = auto ? sqlNome(refP.papel || r.nome).toLowerCase() : "";
    addFK(t, ref, { nn: minCard(refP.card) >= 1, papel, un: !maxN(fkP.card) && !maxN(refP.card) });
    colunas(r.id, t, false, true); // atributos do relacionamento 1:N/1:1 vão para a tabela da FK
    ligar(t, ref, fkP.card, refP.card);
  }
  // 6) atributos multivalorados → tabela própria (FK do dono + o valor; PK composta)
  for (const { a, t } of multis) {
    const nt = novaTabela(t.nome + "_" + sqlNome(a.nome), t.x + 260, t.y);
    const fks = addFK(nt, t, { pk: true });
    const filhos = atributosDe(d, a.id);
    const vals = filhos.length ? filhos : [a];
    for (const f of vals) nt.cols.push({ nome: nomeLivre(nt, f.nome), tipo: tipoPorNome(f.nome), pk: true, fk: "", ref: "", nn: true });
    if (!fks.length) nt.cols.forEach((c) => (c.pk = true));
    ligar(nt, t, a.card || "(0,n)", "(1,1)");
  }
  arrumarTabelas(out);
  return out;
}

// espalha as tabelas para não ficarem uma em cima da outra
function arrumarTabelas(d) {
  const tabs = d.el.filter((e) => e.t === "tabela").sort((a, b) => a.y - b.y || a.x - b.x);
  const minX = Math.min(...tabs.map((t) => t.x)), minY = Math.min(...tabs.map((t) => t.y));
  for (const t of tabs) { t.x = Math.round(t.x - minX + 40); t.y = Math.round(t.y - minY + 40); }
  const feitas = [];
  for (const t of tabs) {
    for (let i = 0; i < 200; i++) {
      const g = geo(t);
      const bate = feitas.find((o) => { const h = geo(o); return g.x < h.x + h.w + 100 && h.x < g.x + g.w + 100 && g.y < h.y + h.h + 60 && h.y < g.y + g.h + 60; });
      if (!bate) break;
      t.x = Math.round(geo(bate).x + geo(bate).w + 110);
      if (t.x > 1500) { t.x = 40; t.y += 60; }
    }
    feitas.push(t);
  }
}

// ---------- lógico → SQL (MySQL) ----------
export function gerarSQL(valor) {
  const d = valor?.logico || (Array.isArray(valor?.el) ? valor : null);
  if (!d) return "";
  const tabs = d.el.filter((e) => e.t === "tabela");
  if (!tabs.length) return "-- O modelo lógico está vazio.";
  const ids = porId(d);
  // FKs agrupadas: colunas seguidas que apontam para a mesma tabela formam uma FK (PK composta = várias colunas)
  const fksDe = (t) => {
    const grupos = [];
    for (const c of t.cols.filter((c) => c.fk && ids.get(c.fk))) {
      const ref = ids.get(c.fk), tam = Math.max(1, ref.cols.filter((x) => x.pk).length);
      let g = grupos.find((g) => g.ref === ref && g.cols.length < tam && !g.cols.some((x) => (x.ref || "") === (c.ref || "") && c.ref));
      if (!g) { g = { ref, cols: [] }; grupos.push(g); }
      g.cols.push(c);
    }
    return grupos.map((g) => {
      const pkRef = g.ref.cols.filter((x) => x.pk);
      const refs = g.cols.map((c, i) => sqlNome(c.ref && g.ref.cols.some((x) => x.nome === c.ref) ? c.ref : (pkRef[i] || pkRef[0] || { nome: "id" }).nome));
      return { ref: g.ref, cols: g.cols.map((c) => sqlNome(c.nome)), refs };
    });
  };
  // ordem: quem é referenciado vem antes; ciclos viram ALTER TABLE no fim
  const ordem = [], feitas = new Set(), alter = [];
  const pend = tabs.slice();
  while (pend.length) {
    const i = pend.findIndex((t) => fksDe(t).every((f) => f.ref === t || feitas.has(f.ref.id)));
    const t = pend.splice(i >= 0 ? i : 0, 1)[0];
    ordem.push({ t, ciclo: i < 0 });
    feitas.add(t.id);
  }
  const linhas = ["-- Script gerado pelo brModelo do sistema (MySQL)", ""];
  for (const { t } of ordem) {
    const corpo = t.cols.map((c) => `  ${sqlNome(c.nome)} ${c.tipo || "VARCHAR(100)"}${c.nn || c.pk ? " NOT NULL" : ""}${c.un && !c.pk ? " UNIQUE" : ""}`);
    const pk = t.cols.filter((c) => c.pk).map((c) => sqlNome(c.nome));
    if (pk.length) corpo.push(`  PRIMARY KEY (${pk.join(", ")})`);
    for (const f of fksDe(t)) {
      const txtFk = `FOREIGN KEY (${f.cols.join(", ")}) REFERENCES ${sqlNome(f.ref.nome)} (${f.refs.join(", ")})`;
      if (f.ref === t || feitas.has(f.ref.id) && ordem.findIndex((o) => o.t === f.ref) < ordem.findIndex((o) => o.t === t)) corpo.push("  " + txtFk);
      else alter.push(`ALTER TABLE ${sqlNome(t.nome)} ADD ${txtFk};`);
    }
    if (!t.cols.length) corpo.push("  -- tabela sem colunas");
    linhas.push(`CREATE TABLE ${sqlNome(t.nome)} (`, corpo.join(",\n"), ");", "");
  }
  if (alter.length) linhas.push(...alter, "");
  return linhas.join("\n").trimEnd() + "\n";
}

// ---------- texto para a IA / relatórios ----------
export function textoModelo(valor) {
  const m = lerModelo(valor);
  if (!m || modeloVazio(m)) return "(diagrama em branco)";
  const partes = [];
  if (m.conceitual && !modeloVazio(m.conceitual)) partes.push(textoConceitual(m.conceitual));
  if (m.logico && !modeloVazio(m.logico)) partes.push(textoLogico(m.logico));
  return partes.join("\n\n") || "(diagrama em branco)";
}

function descAtributo(d, a) {
  const filhos = ordenar(atributosDe(d, a.id), (f) => f.nome);
  const marcas = [];
  if (a.chave) marcas.push("identificador");
  if (ehMulti(a)) marcas.push(`multivalorado ${a.card}`);
  else if (ehOpcional(a)) marcas.push(`opcional ${a.card}`);
  if (filhos.length) marcas.push(`composto: ${filhos.map((f) => descAtributo(d, f)).join(", ")}`);
  return `${a.nome || "(sem nome)"}${marcas.length ? ` [${marcas.join("; ")}]` : ""}`;
}
const listaAtributos = (d, id) => {
  const at = atributosDe(d, id);
  const ord = [...ordenar(at.filter((a) => a.chave), (a) => a.nome), ...ordenar(at.filter((a) => !a.chave), (a) => a.nome)];
  return ord.map((a) => descAtributo(d, a)).join(", ");
};
function tipoRel(parts) {
  if (parts.length > 2) return `${parts.length} entidades (ternário ou mais)`;
  if (parts.length < 2) return "incompleto (menos de 2 entidades ligadas)";
  const [a, b] = parts.map((p) => maxN(p.card));
  const base = a && b ? "N:N" : a || b ? "1:N" : "1:1";
  return parts[0].ent.id === parts[1].ent.id ? `auto-relacionamento ${base}` : base;
}

function textoConceitual(d) {
  const ids = porId(d), L = ["MODELO CONCEITUAL (MER, notação do brModelo; a cardinalidade (mín,máx) fica escrita junto de cada entidade)"];
  const ents = ordenar(d.el.filter((e) => e.t === "entidade"), (e) => e.nome);
  L.push(`Entidades (${ents.length}):`);
  for (const e of ents) L.push(`- ${e.nome || "(sem nome)"}: ${listaAtributos(d, e.id) || "sem atributos"}`);
  const assocs = ordenar(d.el.filter((e) => e.t === "associativa"), (e) => e.nome);
  const descParts = (parts) => parts.map((p) => `${p.ent.nome || "(sem nome)"}${p.papel ? ` (papel: ${p.papel})` : ""} ${p.card || "(sem cardinalidade)"}`).join(" e ");
  if (assocs.length) {
    L.push(`Entidades associativas (${assocs.length}):`);
    for (const s of assocs) {
      const parts = ordenar(participantes(d, s, ids).filter((p) => p.ent.t === "entidade"), (p) => p.ent.nome + p.card);
      L.push(`- ${s.nome || "(sem nome)"} (${tipoRel(parts)}) entre ${descParts(parts) || "nenhuma entidade"}; atributos: ${listaAtributos(d, s.id) || "nenhum"}`);
    }
  }
  const rels = ordenar(d.el.filter((e) => e.t === "relacionamento"), (e) => e.nome + participantes(d, e, ids).map((p) => p.ent.nome).sort().join());
  L.push(`Relacionamentos (${rels.length}):`);
  for (const r of rels) {
    const parts = ordenar(participantes(d, r, ids), (p) => p.ent.nome + p.card + p.papel);
    const at = listaAtributos(d, r.id);
    L.push(`- ${r.nome || "(sem nome)"} (${tipoRel(parts)}) entre ${descParts(parts) || "nenhuma entidade"}${at ? `; atributos do relacionamento: ${at}` : ""}`);
  }
  const esps = d.el.filter((e) => e.t === "especializacao");
  if (esps.length) {
    L.push(`Especializações/generalizações (${esps.length}):`);
    const linhas = esps.map((s) => {
      const filhas = ordenar(d.li.filter((l) => l.a === s.id).map((l) => ids.get(l.b)).filter(Boolean), (f) => f.nome).map((f) => f.nome);
      return `- ${ids.get(s.pai)?.nome || "(sem entidade genérica)"} especializada em ${filhas.join(", ") || "(nenhuma)"} (${s.total ? "total" : "parcial"}, ${s.exclusiva ? "exclusiva" : "compartilhada"})`;
    });
    L.push(...linhas.sort());
  }
  const textos = d.el.filter((e) => e.t === "texto" && e.nome.trim());
  if (textos.length) L.push("Anotações: " + textos.map((t) => `"${t.nome.replace(/\s+/g, " ")}"`).sort().join("; "));
  return L.join("\n");
}

function textoLogico(d) {
  const ids = porId(d), L = ["MODELO LÓGICO (relacional)"];
  const tabs = ordenar(d.el.filter((e) => e.t === "tabela"), (t) => t.nome);
  L.push(`Tabelas (${tabs.length}):`);
  for (const t of tabs) {
    const cols = t.cols.map((c) => {
      const m = [];
      if (c.pk) m.push("PK");
      if (c.fk) m.push(`FK → ${ids.get(c.fk)?.nome || "?"}${c.ref ? "." + c.ref : ""}`);
      m.push(c.nn || c.pk ? "NOT NULL" : "NULL");
      if (c.un) m.push("UNIQUE");
      return `${c.nome} ${c.tipo} [${m.join(", ")}]`;
    });
    L.push(`- ${t.nome}: ${cols.join("; ") || "sem colunas"}`);
  }
  if (d.li.length) {
    L.push(`Relações desenhadas (${d.li.length}):`);
    L.push(...d.li.map((l) => `- ${ids.get(l.a)?.nome} ${l.ca || ""} → ${ids.get(l.b)?.nome} ${l.cb || ""}`.replace(/\s+/g, " ")).sort());
  }
  const textos = d.el.filter((e) => e.t === "texto" && e.nome.trim());
  if (textos.length) L.push("Anotações: " + textos.map((t) => `"${t.nome.replace(/\s+/g, " ")}"`).sort().join("; "));
  return L.join("\n");
}

// ---------- comparação local com o gabarito ----------
export function chaveNome(s) {
  let k = semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (k.length > 3 && k.endsWith("s")) k = k.slice(0, -1);
  return k;
}
export function mesmoNome(a, b) {
  const x = chaveNome(a), y = chaveNome(b);
  return !!x && (x === y || x + "e" === y || y + "e" === x);
}

// casa cada item do gabarito com um da resposta (nome parecido), sem repetir
function casar(gs, rs, nomeDe = (e) => e.nome) {
  const mapa = new Map(), usados = new Set();
  for (const g of gs) {
    const r = rs.find((r) => !usados.has(r) && mesmoNome(nomeDe(g), nomeDe(r)));
    if (r) { mapa.set(g, r); usados.add(r); }
  }
  return { mapa, usados };
}

export function compararModelos(gabarito, resposta) {
  const g = lerModelo(gabarito), r = lerModelo(resposta) || { v: 1 };
  const itens = [];
  const add = (ok, texto, peso = 1) => itens.push({ ok: !!ok, texto, peso });
  if (!g) return { nota: 0, itens: [{ ok: false, texto: "Gabarito inválido", peso: 1 }] };
  if (g.conceitual && !modeloVazio(g.conceitual)) compararConceitual(g.conceitual, r.conceitual || novoDiagrama(), add);
  if (g.logico && !modeloVazio(g.logico)) compararLogico(g.logico, r.logico || novoDiagrama(), add);
  const total = itens.reduce((s, i) => s + i.peso, 0);
  const nota = total ? Math.round((itens.reduce((s, i) => s + (i.ok ? i.peso : 0), 0) / total) * 1000) / 1000 : 0;
  return { nota, itens };
}

// todos os atributos (com os filhos dos compostos) de um dono
function todosAtributos(d, id) {
  const out = [];
  for (const a of atributosDe(d, id)) { out.push(a); out.push(...todosAtributos(d, a.id)); }
  return out;
}

function compararConceitual(G, R, add) {
  const gi = porId(G), ri = porId(R);
  const gEnts = G.el.filter((e) => e.t === "entidade" || e.t === "associativa");
  const rEnts = R.el.filter((e) => e.t === "entidade" || e.t === "associativa");
  const { mapa: me, usados } = casar(gEnts, rEnts);
  for (const ge of gEnts) {
    const re = me.get(ge);
    const rotulo = ge.t === "associativa" ? "Entidade associativa" : "Entidade";
    add(re, `${rotulo} ${ge.nome}${re ? "" : " não encontrada"}`);
    const gat = todosAtributos(G, ge.id), rat = re ? todosAtributos(R, re.id) : [];
    const gId = gat.filter((a) => a.chave), rId = rat.filter((a) => a.chave);
    if (gId.length && ge.t === "entidade") {
      const nomesOk = gId.every((a) => rId.some((b) => mesmoNome(a.nome, b.nome)));
      const ok = re && (nomesOk || rId.length === gId.length);
      add(ok, `${ge.nome}: identificador ${gId.map((a) => a.nome).join(" + ")}${ok && !nomesOk ? ` (marcado como ${rId.map((a) => a.nome).join(" + ")})` : ok ? "" : re ? (rId.length ? ` (resposta marcou ${rId.map((a) => a.nome).join(" + ")})` : " não marcado") : ""}`);
    }
    for (const a of gat.filter((a) => !a.chave)) {
      const b = rat.find((b) => mesmoNome(a.nome, b.nome));
      const composto = atributosDe(G, a.id).length > 0;
      let ok = !!b, nota = b ? "" : " ausente";
      if (b && ehMulti(a) && !ehMulti(b)) { ok = false; nota = " (devia ser multivalorado)"; }
      if (b && composto && !atributosDe(R, b.id).length) { ok = false; nota = " (devia ser composto)"; }
      add(ok, `${ge.nome}: atributo ${a.nome}${ehMulti(a) ? " multivalorado" : composto ? " composto" : ""}${nota}`, 0.5);
    }
  }
  for (const re of rEnts) if (!usados.has(re)) add(false, `Entidade a mais na resposta: ${re.nome}`, 0.5);

  // relacionamentos: casados pelas entidades ligadas (o nome do losango pode variar)
  const rels = (D, ids) => D.el.filter((e) => e.t === "relacionamento" || e.t === "associativa").map((e) => ({ e, parts: participantes(D, e, ids).filter((p) => p.ent.t !== "especializacao") })).filter((x) => x.parts.length);
  const gRels = rels(G, gi), rRels = rels(R, ri);
  const usadosR = new Set();
  const chaveParts = (parts, traduz) => parts.map((p) => traduz(p.ent)).sort().join("|");
  for (const gr of gRels) {
    if (gr.e.t === "associativa" && !gr.parts.length) continue;
    const alvo = chaveParts(gr.parts, (e) => (me.get(e) ? me.get(e).id : "?" + e.id));
    let rr = rRels.find((x) => !usadosR.has(x) && chaveParts(x.parts, (e) => e.id) === alvo && mesmoNome(x.e.nome, gr.e.nome));
    if (!rr) rr = rRels.find((x) => !usadosR.has(x) && chaveParts(x.parts, (e) => e.id) === alvo);
    const nomes = gr.parts.map((p) => p.ent.nome).join(" e ");
    add(rr, `Relacionamento ${gr.e.nome} entre ${nomes}${rr ? "" : " não encontrado"}`);
    if (!rr) { add(false, `Cardinalidades de ${gr.e.nome}`); continue; }
    usadosR.add(rr);
    // cardinalidade por entidade (auto-relacionamento: compara o conjunto)
    const gc = gr.parts.map((p) => (me.get(p.ent)?.id || "") + "=" + (p.card || "(0,n)")).sort().join(" ");
    const rc = rr.parts.map((p) => p.ent.id + "=" + (p.card || "(0,n)")).sort().join(" ");
    const gMax = gr.parts.map((p) => (me.get(p.ent)?.id || "") + "=" + maxN(p.card)).sort().join(" ");
    const rMax = rr.parts.map((p) => p.ent.id + "=" + maxN(p.card)).sort().join(" ");
    const esperado = gr.parts.map((p) => `${p.ent.nome} ${p.card}`).join(", ");
    add(gMax === rMax, `${gr.e.nome}: tipo ${tipoRel(gr.parts)} (máximas: ${esperado})`);
    add(gc === rc, `${gr.e.nome}: cardinalidades mínimas e máximas (${esperado})`, 0.5);
    for (const a of todosAtributos(G, gr.e.id)) {
      const ok = todosAtributos(R, rr.e.id).some((b) => mesmoNome(a.nome, b.nome));
      add(ok, `${gr.e.nome}: atributo do relacionamento ${a.nome}${ok ? "" : " ausente"}`, 0.5);
    }
  }
  // especializações
  for (const s of G.el.filter((e) => e.t === "especializacao")) {
    const pai = gi.get(s.pai), filhas = G.li.filter((l) => l.a === s.id).map((l) => gi.get(l.b)).filter(Boolean);
    const rp = pai && me.get(pai);
    const rs = rp && R.el.find((x) => x.t === "especializacao" && x.pai === rp.id && filhas.every((f) => me.get(f) && R.li.some((l) => l.a === x.id && l.b === me.get(f).id)));
    add(rs, `Especialização de ${pai?.nome || "?"} em ${filhas.map((f) => f.nome).join(", ")}${rs ? "" : " não encontrada"}`);
    add(rs && rs.total === s.total && rs.exclusiva === s.exclusiva, `Especialização de ${pai?.nome || "?"}: ${s.total ? "total" : "parcial"} e ${s.exclusiva ? "exclusiva" : "compartilhada"}`, 0.5);
  }
}

function compararLogico(G, R, add) {
  const gi = porId(G), ri = porId(R);
  const gT = G.el.filter((e) => e.t === "tabela"), rT = R.el.filter((e) => e.t === "tabela");
  const { mapa, usados } = casar(gT, rT);
  // tabela associativa com outro nome: casa pelas tabelas que ela referencia
  const alvos = (t, ids, traduz) => [...new Set(t.cols.filter((c) => c.fk).map((c) => traduz(ids.get(c.fk))))].sort().join("|");
  for (const gt of gT) {
    if (mapa.has(gt)) continue;
    const alvo = alvos(gt, gi, (x) => (x && mapa.get(x) ? mapa.get(x).id : "?"));
    if (!alvo || alvo.includes("?")) continue;
    const rt = rT.find((x) => !usados.has(x) && alvos(x, ri, (y) => y?.id) === alvo);
    if (rt) { mapa.set(gt, rt); usados.add(rt); }
  }
  for (const gt of gT) {
    const rt = mapa.get(gt);
    add(rt, `Tabela ${gt.nome}${rt ? (mesmoNome(gt.nome, rt.nome) ? "" : ` (na resposta: ${rt.nome})`) : " não encontrada"}`);
    const gpk = gt.cols.filter((c) => c.pk), rpk = rt ? rt.cols.filter((c) => c.pk) : [];
    const pkOk = rt && gpk.length === rpk.length && gpk.every((c) => rpk.some((d) => mesmoNome(c.nome, d.nome) || (c.fk && d.fk && mapa.get(gi.get(c.fk))?.id === d.fk)));
    add(pkOk, `${gt.nome}: chave primária ${gpk.map((c) => c.nome).join(" + ") || "(nenhuma)"}${pkOk || !rt ? "" : ` (resposta: ${rpk.map((c) => c.nome).join(" + ") || "sem PK"})`}`);
    for (const c of gt.cols.filter((c) => !c.pk && !c.fk)) {
      const ok = rt && rt.cols.some((d) => mesmoNome(c.nome, d.nome));
      add(ok, `${gt.nome}: coluna ${c.nome}${ok ? "" : " ausente"}`, 0.5);
    }
    // FKs agrupadas por tabela referenciada (conta quantas vezes cada uma aparece)
    const conta = (t, ids, traduz) => { const m = new Map(); for (const c of t.cols.filter((c) => c.fk)) { const k = traduz(ids.get(c.fk)); m.set(k, (m.get(k) || 0) + 1); } return m; };
    const gf = conta(gt, gi, (x) => x), rf = rt ? conta(rt, ri, (x) => x?.id) : new Map();
    for (const [ref, n] of gf) {
      const alvo = mapa.get(ref);
      const ok = rt && alvo && (rf.get(alvo.id) || 0) >= n;
      add(ok, `${gt.nome}: chave estrangeira para ${ref?.nome || "?"}${n > 1 ? ` (${n} colunas)` : ""}${ok ? "" : " ausente"}`);
    }
  }
  for (const rt of rT) if (!usados.has(rt)) add(false, `Tabela a mais na resposta: ${rt.nome}`, 0.5);
}

// ---------- montar diagrama a partir de uma descrição curta ----------
// spec = { entidades:[{ nome, x, y, lado?, atributos:[ "*id", "nome", "telefone(1,n)", "email(0,1)", { nome, filhos:[...] } ] }],
//          associativas:[{ nome, x, y, liga:[["Ent","(1,n)"]], atributos }],
//          relacionamentos:[{ nome, x, y, liga:[["Ent","(0,n)","papel?"], ...], atributos, lado? }],
//          especializacoes:[{ pai, filhas:["A","B"], total, exclusiva, x?, y? }], textos:[{ nome, x, y }] }
// "*nome" = identificador. lado = onde ficam os atributos ("d","e","c","b").
export function montarExemplo(spec) {
  const d = novoDiagrama();
  let seq = 0;
  const id = (p) => p + ++seq;
  const porNome = new Map();
  const addAtributos = (dono, lista, lado) => {
    for (const it of lista || []) {
      const o = typeof it === "string" ? { nome: it } : it;
      let nome = String(o.nome).trim(), chave = !!o.chave, card = o.card || "";
      if (nome.startsWith("*")) { chave = true; nome = nome.slice(1); }
      const m = nome.match(/^(.*?)\s*(\(\s*\d\s*,\s*[\dnN]\s*\))$/);
      if (m) { nome = m[1]; card = m[2]; }
      const p = posicaoNovoAtributo(d, dono, o.lado || lado);
      const a = { id: id("a"), t: "atributo", nome, x: p.x, y: p.y, dono: dono.id };
      if (chave) a.chave = true;
      if (normCard(card)) a.card = normCard(card);
      d.el.push(a);
      if (o.filhos) addAtributos(a, o.filhos, (o.lado || lado) === "e" ? "e" : "d");
    }
  };
  for (const e of spec.entidades || []) {
    const n = { id: id("e"), t: "entidade", nome: e.nome, x: e.x, y: e.y };
    d.el.push(n); porNome.set(e.nome, n);
  }
  for (const s of spec.associativas || []) {
    const n = { id: id("s"), t: "associativa", nome: s.nome, x: s.x, y: s.y };
    d.el.push(n); porNome.set(s.nome, n);
  }
  for (const e of spec.entidades || []) addAtributos(porNome.get(e.nome), e.atributos, e.lado || "d");
  const ligar = (dono, liga) => {
    for (const [nome, card, papel] of liga || []) {
      const ent = porNome.get(nome);
      if (!ent) throw new Error("Entidade não existe: " + nome);
      const l = { id: id("l"), a: ent.id, b: dono.id, card: normCard(card) };
      if (papel) l.papel = papel;
      d.li.push(l);
    }
  };
  for (const s of spec.associativas || []) { const n = porNome.get(s.nome); ligar(n, s.liga); addAtributos(n, s.atributos, s.lado || "c"); }
  for (const r of spec.relacionamentos || []) {
    const n = { id: id("r"), t: "relacionamento", nome: r.nome, x: r.x, y: r.y };
    d.el.push(n); porNome.set("#" + r.nome, n);
    ligar(n, r.liga);
    addAtributos(n, r.atributos, r.lado || "c");
  }
  for (const s of spec.especializacoes || []) {
    const pai = porNome.get(s.pai), g = geo(pai);
    const n = { id: id("h"), t: "especializacao", x: s.x ?? Math.round(g.cx - 23), y: s.y ?? g.y + g.h + 36, pai: pai.id, total: !!s.total, exclusiva: s.exclusiva !== false };
    d.el.push(n);
    for (const f of s.filhas) d.li.push({ id: id("l"), a: n.id, b: porNome.get(f).id });
  }
  for (const t of spec.textos || []) d.el.push({ id: id("x"), t: "texto", nome: t.nome, x: t.x, y: t.y });
  return d;
}
