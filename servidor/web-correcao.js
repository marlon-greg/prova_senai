// Correção das questões "web" (Bancada Web: HTML/CSS no estilo do VS Code). Sem imports: usado pelo navegador
// (js/bancada-web.js, js/common.js, admin) e pelo servidor (Worker). Determinístico, nunca precisa de IA.
//
// Modos (questao.modo):
//   "blocos"    (padrão) modelos com espaços [[s:id|dica]]; o aluno encaixa blocos do banco (certos + distratores)
//   "completar" mesmos modelos, mas o aluno DIGITA o comando em cada espaço (aceita variações equivalentes)
//   "livre"     o aluno escreve o projeto inteiro; a correção usa as verificações de cada etapa (hashes SHA-256
//               calculados no navegador do aluno e comparados com os do gabarito)
//
// Sintaxe dos modelos (etapas[].html / etapas[].css):
//   [[s:id|dica]] espaço para o aluno   [[c:id]] fechamento automático da tag aberta no espaço "id"
//   [[BODY]]      conteúdo das outras etapas (na ordem)   [[E3]] conteúdo da etapa de id 3 (ex.: menu dentro do header)
// Declarações CSS da MESMA regra formam um grupo sem ordem (ex.: grupo "e2_r1" = espaços da 1ª regra da etapa 2).
//
// Gabarito guardado (calcularGabaritoWeb em js/bancada-web.js):
//   { slots: { id: [aceitos normalizados] }, grupos: { grupo: [[aceitos], ...] }, verificacoes: { id: sha256 } }
// Resposta do aluno (montarBancadaWeb().valor()):
//   { modo, slots?: { id: texto }, arquivos?: { caminho: conteúdo }, verificacoes?: { id: sha256 },
//     git?: { commits: [{ id, msg, em, arquivos, del? }], pushes, remoto, head, stage }, etapasVistas?: [...] }

const RE_TOKEN = () => /\[\[(s|c):([\w-]+)(?:\|([^\]]*))?\]\]|\[\[(BODY|E[\w-]+)\]\]/g;
const VAZIAS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

// ---------------------------------------------------------------------------------------------
// Modelos (parser compatível com o da prova original: mesmos ids de grupo "e<etapa>_r<regra>")
// ---------------------------------------------------------------------------------------------
export function analisarModelo(src, etapaId, tipo) {
  const linhas = [], slots = [];
  let regra = 0, dentroRegra = false;
  const texto0 = String(src || "").replace(/\r/g, "").replace(/^\n+/, "").replace(/\s+$/, "");
  if (!texto0) return { linhas, slots };
  texto0.split("\n").forEach(bruta => {
    const espacos = bruta.match(/^ */)[0].length;
    const texto = bruta.trim();
    const partes = [];
    const re = RE_TOKEN();
    let ultimo = 0, m;
    const abreRegra = tipo === "css" && texto.includes("{") && !texto.includes("}");
    if (abreRegra) regra++;
    while ((m = re.exec(texto))) {
      if (m.index > ultimo) partes.push({ k: "t", v: texto.slice(ultimo, m.index) });
      if (m[4]) partes.push({ k: "m", v: m[4] });
      else if (m[1] === "c") partes.push({ k: "c", id: m[2] });
      else {
        const grupo = tipo === "css" && !abreRegra && dentroRegra ? "e" + etapaId + "_r" + regra : null;
        const tipoSlot = tipo === "html" ? "html" : grupo ? "css" : "seletor";
        partes.push({ k: "s", id: m[2], ph: m[3] || "", tipo: tipoSlot });
        slots.push({ id: m[2], ph: m[3] || "", grupo, tipo: tipoSlot, arquivo: tipo, etapa: etapaId });
      }
      ultimo = m.index + m[0].length;
    }
    if (ultimo < texto.length) partes.push({ k: "t", v: texto.slice(ultimo) });
    if (abreRegra) dentroRegra = true;
    if (tipo === "css" && texto.includes("}") && !texto.includes("{")) dentroRegra = false;
    linhas.push({ ind: Math.floor(espacos / 2), partes });
  });
  return { linhas, slots };
}

const cacheEtapas = new WeakMap();
// etapas com os modelos já analisados: [{ etapa, id, htmlP, cssP, slots }]
export function prepararEtapas(questao) {
  if (questao && typeof questao === "object" && cacheEtapas.has(questao)) return cacheEtapas.get(questao);
  const lista = (Array.isArray(questao?.etapas) ? questao.etapas : []).map((e, i) => {
    const id = String(e?.id ?? i + 1);
    const htmlP = analisarModelo(e?.html, id, "html"), cssP = analisarModelo(e?.css, id, "css");
    return { etapa: e || {}, id, htmlP, cssP, slots: htmlP.slots.concat(cssP.slots) };
  });
  if (questao && typeof questao === "object") cacheEtapas.set(questao, lista);
  return lista;
}

// estrutura do index.html: qual etapa é a raiz ([[BODY]]) e quem fica dentro de quem ([[E3]])
export function estruturaHtml(questao) {
  const pe = prepararEtapas(questao);
  const pai = {}, filhos = {};
  let raiz = null;
  const marcas = (p) => p.htmlP.linhas.flatMap(l => l.partes.filter(x => x.k === "m").map(x => x.v));
  for (const p of pe) for (const m of marcas(p)) {
    if (m === "BODY") { if (raiz === null) raiz = p.id; }
    else { const alvo = m.slice(1); if (pe.some(q => q.id === alvo) && alvo !== p.id) { pai[alvo] = p.id; (filhos[p.id] ||= []).push(alvo); } }
  }
  const corpo = raiz === null ? [] : pe.filter(p => p.id !== raiz && !(p.id in pai) && p.htmlP.linhas.length).map(p => p.id);
  for (const id of corpo) pai[id] = raiz;
  return { raiz, pai, corpo };
}

export function fechamentoDe(abertura) {
  const m = String(abertura || "").match(/^\s*<\s*([a-zA-Z][\w-]*)/);
  if (!m) return "";
  const tag = m[1].toLowerCase();
  if (VAZIAS.has(tag)) return "";
  if (new RegExp("</\\s*" + tag + "\\s*>\\s*$", "i").test(abertura)) return "";   // bloco já fechado na mesma linha
  return `</${tag}>`;
}

// texto que vai para o código final (declaração CSS sem ";" ganha o ";", para o CSS não quebrar)
function textoDoSlot(valor, tipo) {
  let v = String(valor ?? "").replace(/\r?\n/g, " ").trim();
  if (v && tipo === "css" && !/[;}]\s*$/.test(v)) v += ";";
  return v;
}

// monta index.html e style.css a partir dos espaços preenchidos → { html, css }
export function montarCodigo(questao, slots = {}) {
  const pe = prepararEtapas(questao);
  const porId = Object.fromEntries(pe.map(p => [p.id, p]));
  const { raiz, corpo } = estruturaHtml(questao);
  const linhaDe = (l) => l.partes.map(p => p.k === "t" ? p.v : p.k === "s" ? textoDoSlot(slots[p.id], p.tipo) : p.k === "c" ? fechamentoDe(slots[p.id]) : "").join("");
  const html = [];
  const visitados = new Set();
  function etapaHtml(id, base) {
    const p = porId[id];
    if (!p || visitados.has(id)) return;
    visitados.add(id);
    for (const l of p.htmlP.linhas) {
      const marca = l.partes.find(x => x.k === "m");
      if (marca) {
        const ids = marca.v === "BODY" ? corpo : [marca.v.slice(1)];
        ids.forEach((f, i) => { if (i && marca.v === "BODY") html.push(""); etapaHtml(f, base + l.ind); });
        continue;
      }
      const t = linhaDe(l);
      html.push(t.trim() ? "  ".repeat(base + l.ind) + t : "");
    }
  }
  if (raiz !== null) etapaHtml(raiz, 0);
  else pe.forEach(p => { etapaHtml(p.id, 0); });
  const css = [];
  for (const p of pe) {
    if (!p.cssP.linhas.length) continue;
    for (const l of p.cssP.linhas) { const t = linhaDe(l); css.push(t.trim() ? "  ".repeat(l.ind) + t : ""); }
    css.push("");
  }
  return { html: html.join("\n").replace(/\n{3,}/g, "\n\n") + "\n", css: css.join("\n") };
}

// ---------------------------------------------------------------------------------------------
// Normalização dos trechos (modo "completar" aceita variações equivalentes)
// ---------------------------------------------------------------------------------------------
const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", reg: "®", trade: "™", hellip: "…", ndash: "–", mdash: "—" };
function decodificar(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (t, c) => {
    if (c[0] === "#") { const n = c[1] === "x" || c[1] === "X" ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : t; }
    return ENTIDADES[c.toLowerCase()] ?? t;
  });
}
// minúsculas fora das aspas
function minusculasForaDeAspas(s) { return s.replace(/("[^"]*")|([^"]+)/g, (t, q, r) => q || r.toLowerCase()); }

function normalizarCss(s, seletor) {
  s = s.replace(/'/g, '"').replace(/\s+/g, " ");
  s = s.replace(/\s*([:;,(){}>+~])\s*/g, "$1").replace(/\s*!\s*important/gi, "!important");
  s = s.replace(/;+$/g, "").trim();
  if (seletor) return s.replace(/\s*\{$/, "");
  s = minusculasForaDeAspas(s);
  s = s.replace(/(^|[^\w.#-])0(?:px|em|rem|pt|vh|vw|vmin|vmax|ch|ex)(?![\w%])/g, "$10");
  s = s.replace(/(^|[^\w.])\.(\d)/g, "$10.$2");
  s = s.replace(/#([0-9a-f])([0-9a-f])([0-9a-f])(?![0-9a-f])/g, "#$1$1$2$2$3$3");
  return s;
}

function normalizarTag(tag) {
  if (/^<!--/.test(tag)) return tag.replace(/\s+/g, " ");
  const m = tag.match(/^<\s*(\/?)\s*([a-zA-Z!][\w:-]*)([\s\S]*?)\/?\s*>$/);
  if (!m) return tag.replace(/\s+/g, " ");
  const nome = m[2].toLowerCase();
  if (m[1]) return `</${nome}>`;
  if (nome === "!doctype") return "<!doctype html>";
  const attrs = [];
  const re = /([^\s=\/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let a;
  while ((a = re.exec(m[3]))) {
    const n = a[1].toLowerCase();
    const temValor = a[2] !== undefined || a[3] !== undefined || a[4] !== undefined;
    let v = decodificar(String(a[2] ?? a[3] ?? a[4] ?? "")).replace(/\s+/g, " ").trim();
    if (n === "class") v = v.split(" ").filter(Boolean).join(" ");
    attrs.push(temValor ? `${n}="${v}"` : n);
  }
  attrs.sort();
  return `<${nome}${attrs.length ? " " + attrs.join(" ") : ""}>`;
}

function normalizarHtml(s) {
  const partes = [];
  let ultimo = 0;
  const re = /<!--[\s\S]*?-->|<[^<>]*>/g;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > ultimo) partes.push(decodificar(s.slice(ultimo, m.index)).replace(/\s+/g, " ").trim());
    partes.push(normalizarTag(m[0]));
    ultimo = m.index + m[0].length;
  }
  if (ultimo < s.length) partes.push(decodificar(s.slice(ultimo)).replace(/\s+/g, " ").trim());
  return partes.filter(Boolean).join("");
}

// tipo: "html" (tag/trecho HTML) · "css" (declaração) · "seletor"
export function normalizarTrecho(texto, tipo = "css") {
  let s = String(texto ?? "").replace(/ /g, " ").replace(/[‘’´`]/g, "'").replace(/[“”]/g, '"').trim();
  if (!s) return "";
  if (tipo === "html") return normalizarHtml(s);
  return normalizarCss(s, tipo === "seletor");
}

// valor observado numa verificação do modo livre (antes do hash)
export function normalizarObservado(v) { return String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase(); }

// hash curto (FNV-1a) — ids de commit e conferência de conteúdo dos arquivos no git simulado
export function hashCurto(s) {
  let h = 0x811c9dc5;
  const t = String(s ?? "");
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------------------------
// Arquivos e git
// ---------------------------------------------------------------------------------------------
// questao.arquivos: [{ caminho, conteudo?, asset?: true }] (ou { caminho: "conteúdo" | { asset: true } })
export function arquivosDaQuestao(questao) {
  const textos = {}, assets = [], pastas = [];
  const lista = Array.isArray(questao?.arquivos) ? questao.arquivos
    : questao?.arquivos && typeof questao.arquivos === "object" ? Object.entries(questao.arquivos).map(([caminho, v]) => typeof v === "string" ? { caminho, conteudo: v } : { caminho, ...(v || {}) }) : [];
  for (const a of lista) {
    const c = String(a?.caminho || "").replace(/^\.?\/+/, "").trim();
    if (!c) continue;
    if (c.endsWith("/")) { pastas.push(c.replace(/\/+$/, "")); continue; }
    if (a.asset) assets.push(c); else textos[c] = String(a.conteudo ?? "");
  }
  return { textos, assets, pastas };
}

export function modoDe(questao) { return ["blocos", "completar", "livre"].includes(questao?.modo) ? questao.modo : "blocos"; }
export function gitAtivo(questao) { return questao?.git?.ativo !== false; }

// situação dos requisitos de git → { commits, exigidos, push: 0 | 0.5 | 1, fracao }
export function situacaoGit(questao, git) {
  const ex = questao?.git?.exigir || {};
  const commits = Array.isArray(git?.commits) ? git.commits.length : 0;
  const ultimo = commits ? git.commits[commits - 1].id : null;
  const exigidos = Math.max(0, Number(ex.commits) || 0);
  const push = !commits ? 0 : git?.remoto && git.remoto === ultimo ? 1 : Number(git?.pushes) > 0 ? 0.5 : 0;
  const partes = [];
  if (exigidos) partes.push(Math.min(1, commits / exigidos));
  if (ex.push) partes.push(push);
  const fracao = partes.length ? partes.reduce((a, b) => a + b, 0) / partes.length : commits > 0 ? 1 : 0;
  return { commits, exigidos, push, exigePush: !!ex.push, fracao };
}

// ---------------------------------------------------------------------------------------------
// Correção
// ---------------------------------------------------------------------------------------------
const arred = (n) => Math.round(n * 100) / 100;
const listaAceitos = (v) => (Array.isArray(v) ? v : [v]).map(x => String(x ?? ""));

export function corrigirWeb(questao, gabarito, resposta, peso = Number(questao?.peso || 1)) {
  const modo = modoDe(questao);
  const r = resposta && typeof resposta === "object" ? resposta : {};
  const g = gabarito && typeof gabarito === "object" ? gabarito : {};
  const pe = prepararEtapas(questao);
  const usarGit = gitAtivo(questao) && Number(questao?.git?.pontos) > 0;
  const ptsGit = usarGit ? Number(questao.git.pontos) : 0;
  const ptsEtapa = (p) => { const n = Number(p.etapa.pontos); return Number.isFinite(n) && n >= 0 ? n : 1; };
  const total = pe.reduce((s, p) => s + ptsEtapa(p), 0) + ptsGit;
  const fator = total > 0 ? Number(peso) / total : 0;
  const porEtapa = {};
  let soma = 0;

  if (modo === "livre") {
    const rv = r.verificacoes || {}, gv = g.verificacoes || {};
    for (const p of pe) {
      const vs = Array.isArray(p.etapa.verificacoes) ? p.etapa.verificacoes : [];
      let certos = 0, ptsOk = 0, ptsTot = 0;
      for (const v of vs) {
        const w = Number.isFinite(Number(v.pontos)) && Number(v.pontos) >= 0 ? Number(v.pontos) : 1;
        ptsTot += w;
        if (gv[v.id] && rv[v.id] === gv[v.id]) { certos++; ptsOk += w; }
      }
      const pts = ptsTot > 0 ? ptsEtapa(p) * ptsOk / ptsTot : 0;
      soma += pts;
      porEtapa[p.id] = { pontos: arred(pts * fator), max: arred(ptsEtapa(p) * fator), certos, total: vs.length };
    }
  } else {
    const rs = r.slots || {};
    const gs = g.slots || {}, gg = g.grupos || {};
    for (const p of pe) {
      let certos = 0;
      const grupos = {};
      for (const s of p.slots) {
        if (s.grupo) { (grupos[s.grupo] ||= []).push(s); continue; }
        const v = normalizarTrecho(rs[s.id], s.tipo);
        if (v && gs[s.id] !== undefined && listaAceitos(gs[s.id]).includes(v)) certos++;
      }
      for (const [nome, sls] of Object.entries(grupos)) {
        const pool = (Array.isArray(gg[nome]) ? gg[nome] : []).map(listaAceitos);
        for (const s of sls) {
          const v = normalizarTrecho(rs[s.id], s.tipo);
          if (!v) continue;
          const i = pool.findIndex(alts => alts.includes(v));
          if (i >= 0) { certos++; pool.splice(i, 1); }
        }
      }
      const tot = p.slots.length;
      const pts = tot ? ptsEtapa(p) * certos / tot : 0;
      soma += pts;
      porEtapa[p.id] = { pontos: arred(pts * fator), max: arred(ptsEtapa(p) * fator), certos, total: tot };
    }
  }

  const sg = situacaoGit(questao, r.git);
  let git = null;
  if (usarGit) {
    const pts = ptsGit * sg.fracao;
    soma += pts;
    git = { pontos: arred(pts * fator), max: arred(ptsGit * fator), commits: sg.commits, exigidos: sg.exigidos, push: sg.push };
  }

  if (respostaEmBranco(questao, r)) return { pontos: 0, status: "em_branco", porEtapa, git };
  const pontos = Math.min(arred(soma * fator), Number(peso));
  const status = pontos >= Number(peso) - 0.005 ? "certa" : pontos > 0 ? "parcial" : "errada";
  return { pontos, status, porEtapa, git };
}

export function respostaEmBranco(questao, resposta) {
  const r = resposta || {};
  if (Array.isArray(r.git?.commits) && r.git.commits.length) return false;
  if (modoDe(questao) === "livre") {
    const ini = arquivosDaQuestao(questao).textos;
    const arqs = r.arquivos && typeof r.arquivos === "object" ? r.arquivos : null;
    if (!arqs) return true;
    const limpa = (s) => String(s ?? "").replace(/\r/g, "").trim();
    const chaves = new Set([...Object.keys(ini), ...Object.keys(arqs)]);
    for (const k of chaves) if (limpa(ini[k]) !== limpa(arqs[k]) || !(k in arqs) !== !(k in ini)) return false;
    return true;
  }
  return !Object.values(r.slots || {}).some(v => String(v ?? "").trim());
}

// arquivos finais do aluno (tela de resultado / prévia do professor)
export function montarArquivosWeb(questao, resposta) {
  const r = resposta || {};
  if (modoDe(questao) === "livre") return { ...(r.arquivos || arquivosDaQuestao(questao).textos) };
  const { html, css } = montarCodigo(questao, r.slots || {});
  return { [questao?.arquivoHtml || "index.html"]: html, [questao?.arquivoCss || "style.css"]: css };
}

// resposta em texto simples (telas de resultado, PDF, relatórios)
export function textoRespostaWeb(questao, resposta) {
  const r = resposta || {};
  const modo = modoDe(questao);
  const partes = [];
  if (modo === "livre") {
    const arqs = r.arquivos || {};
    const nomes = Object.keys(arqs).sort();
    if (!nomes.length) partes.push("(nenhum arquivo)");
    for (const n of nomes) {
      const c = String(arqs[n] ?? "");
      partes.push(`── ${n} ──\n${c.length > 6000 ? c.slice(0, 6000) + "\n… (cortado)" : c || "(vazio)"}`);
    }
  } else {
    const rs = r.slots || {};
    prepararEtapas(questao).forEach((p, i) => {
      const linhas = p.slots.map(s => `  • ${s.ph || s.id}: ${String(rs[s.id] ?? "").trim() || "(vazio)"}`);
      partes.push(`Etapa ${i + 1}${p.etapa.titulo ? " — " + p.etapa.titulo : ""}\n${linhas.join("\n") || "  (sem espaços)"}`);
    });
  }
  if (gitAtivo(questao) && r.git) {
    const cs = Array.isArray(r.git.commits) ? r.git.commits : [];
    const sg = situacaoGit(questao, r.git);
    partes.push(`Git: ${cs.length} commit(s)${cs.length ? "\n" + cs.map(c => `  ${String(c.id).slice(0, 7)} ${c.msg}`).join("\n") : ""}\nPush: ${sg.push === 1 ? "sim (tudo enviado ao GitHub)" : sg.push ? "parcial (há commits não enviados)" : "não"}`);
  }
  return partes.join("\n\n");
}
