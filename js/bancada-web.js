// Bancada Web: IDE no estilo do VS Code para as questões do tipo "web" (HTML/CSS), com prévia ao vivo,
// explorador de arquivos e git simulado (commit, push e um "GitHub" de mentira). Três modos (questao.modo):
//   "blocos"    o aluno encaixa comandos do banco (certos + distratores) nos espaços tracejados dos modelos
//   "completar" mesmos modelos, mas o aluno digita o comando em cada espaço
//   "livre"     o aluno escreve o projeto todo (pastas, arquivos, editor com realce)
// A prova (js/aluno.js) cuida de tela cheia, teclado, colar e envio; aqui é só a IDE.
//
// API:
//   montarBancadaWeb(container, { questao, valor, onMudar, somenteLeitura, abrirJanela })
//        → { valor(): Promise<Resposta>, destruir(), ultimoSinalPrevia() }
//   avaliarVerificacoes(questao, arquivos)      → { id: sha256("id|valor") } (modo livre)
//   observarVerificacoes(questao, arquivos)     → { id: valor normalizado } (para conferência)
//   calcularGabaritoWeb(questao, fonteGabarito) → gabarito guardado { slots?, grupos?, verificacoes?, esperados? }
//   montarDocumentoWeb(arquivos, caminhoHtml, baseAbs) → HTML pronto para a prévia (CSS ligado embutido + <base>)
//
// Sem dependências além de servidor/web-correcao.js (lógica pura, também usada pelo Worker).

import {
  prepararEtapas, estruturaHtml, montarCodigo, normalizarTrecho, normalizarObservado, fechamentoDe, hashCurto,
  arquivosDaQuestao, modoDe, gitAtivo, situacaoGit
} from "../servidor/web-correcao.js";

const LARGURA_AVALIACAO = 1280, ALTURA_AVALIACAO = 800;
const VAZIAS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const OPCIONAIS = new Set(["html", "head", "body", "p", "li", "option", "tr", "td", "th", "thead", "tbody", "tfoot", "dt", "dd", "colgroup"]);
const EXT_IMG = /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp)$/i;

const escHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
// texto do professor com poucas tags permitidas (passos e dicas): entidades ficam, tags fora da lista viram texto
function htmlSeguro(s) {
  return String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(code|strong|em|b|i|u|br|kbd|small|mark)\s*\/?&gt;/gi, "<$1$2>");
}
const pad2 = (n) => String(n).padStart(2, "0");
const hora = (t = Date.now()) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
function quando(t) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return "agora mesmo";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  const d = new Date(t);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------------------------
// Caminhos e documento da prévia
// ---------------------------------------------------------------------------------------------
const dirDe = (p) => { const i = String(p).lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i + 1); };
const nomeDe = (p) => String(p).split("/").filter(Boolean).pop() || "";
const extDe = (p) => { const m = String(p).match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : ""; };
function resolver(dir, rel) {
  rel = String(rel || "").split("#")[0].split("?")[0];
  try { rel = decodeURIComponent(rel); } catch { /* mantém */ }
  const partes = (rel.startsWith("/") ? rel : dir + rel).split("/");
  const out = [];
  for (const p of partes) { if (!p || p === ".") continue; if (p === "..") out.pop(); else out.push(p); }
  return out.join("/");
}
const externo = (u) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(String(u).trim());
function atributo(tag, nome) {
  const m = tag.match(new RegExp("\\s" + nome + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}
function reescreverUrls(css, dirCss, base) {
  return String(css).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (t, q, u) => {
    if (externo(u) || u.startsWith("#") || u.startsWith("data:")) return t;
    return `url("${base}${resolver(dirCss, u)}")`;
  });
}
export function baseAbsoluta(assetsBase) {
  let b = String(assetsBase || "./");
  if (!b.endsWith("/")) b += "/";
  try { return new URL(b, typeof document !== "undefined" ? document.baseURI : "http://localhost/").href; } catch { return b; }
}
// HTML final da prévia: <link rel=stylesheet> para arquivo do projeto vira <style> (link errado = página sem estilo,
// como no navegador de verdade); <base> aponta para a pasta das imagens da questão.
export function montarDocumentoWeb(arquivos, caminhoHtml, base) {
  const html0 = arquivos?.[caminhoHtml];
  const baseTag = `<base href="${escHtml(base + dirDe(caminhoHtml))}">`;
  if (html0 == null) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${baseTag}</head><body style="font:14px system-ui,sans-serif;color:#5d6b82;padding:24px">`
      + `Arquivo <b>${escHtml(caminhoHtml)}</b> não encontrado no projeto.</body></html>`;
  }
  const dir = dirDe(caminhoHtml);
  let html = String(html0).replace(/<link\b[^>]*>/gi, tag => {
    const rel = atributo(tag, "rel"), href = atributo(tag, "href");
    if (!rel || !/(^|\s)stylesheet(\s|$)/i.test(rel) || !href || externo(href)) return tag;
    const alvo = resolver(dir, href);
    if (arquivos[alvo] == null) return tag;
    return `<style data-arquivo="${escHtml(alvo)}">\n${reescreverUrls(arquivos[alvo], dirDe(alvo), base).replace(/<\/style/gi, "<\\/style")}\n</style>`;
  });
  if (/<head\b[^>]*>/i.test(html)) html = html.replace(/<head\b[^>]*>/i, m => m + baseTag);
  else if (/<html\b[^>]*>/i.test(html)) html = html.replace(/<html\b[^>]*>/i, m => m + "<head>" + baseTag + "</head>");
  else html = baseTag + html;
  return html;
}

// ---------------------------------------------------------------------------------------------
// Verificações do modo livre (página renderizada num iframe escondido, sem scripts)
// ---------------------------------------------------------------------------------------------
function renderizarOculto(docHtml) {
  return new Promise(ok => {
    const f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-same-origin");
    f.setAttribute("aria-hidden", "true");
    f.tabIndex = -1;
    f.style.cssText = `position:fixed;left:-40000px;top:0;width:${LARGURA_AVALIACAO}px;height:${ALTURA_AVALIACAO}px;border:0;opacity:0;pointer-events:none`;
    let feito = false;
    const fim = () => { if (feito) return; feito = true; ok(f); };
    f.addEventListener("load", fim);
    setTimeout(fim, 5000);
    f.srcdoc = docHtml;
    document.body.appendChild(f);
  });
}
const normSel = (s) => String(s || "").replace(/\s+/g, " ").replace(/\s*([>+~,])\s*/g, "$1").trim().toLowerCase();
function regrasDe(doc) {
  const out = [];
  const visitar = (lista) => { for (const r of lista) { if (r.selectorText !== undefined) out.push(r); else if (r.cssRules) { try { visitar(r.cssRules); } catch { /* */ } } } };
  for (const sh of doc.styleSheets) { try { visitar(sh.cssRules); } catch { /* folha externa */ } }
  return out;
}
function contarTrilhas(v) {
  let n = 0, prof = 0, tem = false;
  for (const ch of String(v).trim()) {
    if (ch === "(") prof++;
    if (ch === ")") prof--;
    if (/\s/.test(ch) && prof === 0) { if (tem) n++; tem = false; } else tem = true;
  }
  return v.trim() && v.trim() !== "none" ? n + (tem ? 1 : 0) : 0;
}
function observarUma(doc, v, arquivos) {
  const q = (sel) => { try { return doc.querySelector(sel); } catch { return undefined; } };
  const qa = (sel) => { try { return [...doc.querySelectorAll(sel)]; } catch { return null; } };
  switch (v.tipo) {
    case "arquivo": {
      const c = String(v.caminho || "").replace(/^\.?\/+/, "");
      if (c.endsWith("/")) return Object.keys(arquivos).some(k => k.startsWith(c)) ? "sim" : "nao";
      return arquivos[c] != null ? "sim" : "nao";
    }
    case "existe": { const e = q(v.seletor); return e === undefined ? "(seletor inválido)" : e ? "sim" : "nao"; }
    case "quantidade": { const l = qa(v.seletor); return l ? String(l.length) : "(seletor inválido)"; }
    case "texto": { const e = q(v.seletor); return e ? e.textContent : "(ausente)"; }
    case "atributo": {
      const e = q(v.seletor);
      if (!e) return "(ausente)";
      const a = e.getAttribute(v.atributo);
      return a === null ? "(sem atributo)" : a.trim().replace(/^\.\//, "");
    }
    case "css": {
      const e = q(v.seletor);
      if (!e) return "(ausente)";
      const val = doc.defaultView.getComputedStyle(e, v.pseudo || null).getPropertyValue(v.propriedade);
      return v.contar ? String(contarTrilhas(val)) : val;
    }
    case "regra": {
      const alvo = normSel(v.seletor);
      let val = null;
      for (const r of regrasDe(doc)) if (normSel(r.selectorText) === alvo) { const x = r.style.getPropertyValue(v.propriedade); if (x) val = x; }
      return val === null ? "(ausente)" : val;
    }
    default: return "(tipo desconhecido)";
  }
}
const verificacoesDe = (questao) => (questao?.etapas || []).flatMap(e => Array.isArray(e?.verificacoes) ? e.verificacoes : []);
export async function observarVerificacoes(questao, arquivos) {
  const base = baseAbsoluta(questao?.assetsBase);
  const entrada = questao?.entrada || "index.html";
  const vs = verificacoesDe(questao);
  const porPagina = new Map();
  for (const v of vs) { const p = v.tipo === "arquivo" ? null : (v.pagina || entrada); if (!porPagina.has(p)) porPagina.set(p, []); porPagina.get(p).push(v); }
  const out = {};
  for (const [pagina, lista] of porPagina) {
    if (pagina === null) { for (const v of lista) out[v.id] = normalizarObservado(observarUma(null, v, arquivos)); continue; }
    if (arquivos[pagina] == null) { for (const v of lista) out[v.id] = normalizarObservado("(página ausente)"); continue; }
    const f = await renderizarOculto(montarDocumentoWeb(arquivos, pagina, base));
    try {
      const doc = f.contentDocument;
      for (const v of lista) {
        let val;
        try { val = doc ? observarUma(doc, v, arquivos) : "(sem documento)"; } catch (e) { val = "(erro)"; }
        out[v.id] = normalizarObservado(val);
      }
    } finally { f.remove(); }
  }
  return out;
}
async function sha256(txt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function avaliarVerificacoes(questao, arquivos) {
  const valores = await observarVerificacoes(questao, arquivos);
  const out = {};
  for (const [id, v] of Object.entries(valores)) out[id] = await sha256(id + "|" + v);
  return out;
}

// gabarito guardado a partir da fonte do professor ({ slots } e/ou { solucao: { caminho: conteúdo }, verificacoes?: { id: valor } })
export async function calcularGabaritoWeb(questao, fonte = {}) {
  const modo = modoDe(questao);
  if (modo !== "livre") {
    const fs = fonte?.slots || {};
    const slots = {}, grupos = {}, faltando = [], semBloco = [];
    const pe = prepararEtapas(questao);
    if (!pe.some(p => p.slots.length)) throw new Error("Questão web sem espaços [[s:id|dica]] nos modelos das etapas.");
    const banco = modo === "blocos" ? Object.values(questao?.blocos || {}).flat().map(String) : null;
    for (const p of pe) for (const s of p.slots) {
      const val = fs[s.id];
      const lista = (Array.isArray(val) ? val : [val]).map(x => String(x ?? "").trim()).filter(Boolean);
      if (!lista.length) { faltando.push(s.id); continue; }
      const aceitos = [...new Set(lista.map(x => normalizarTrecho(x, s.tipo)).filter(Boolean))];
      if (banco && banco.length && !banco.some(b => aceitos.includes(normalizarTrecho(b, s.tipo)))) semBloco.push(s.id);
      if (s.grupo) (grupos[s.grupo] ||= []).push(aceitos); else slots[s.id] = aceitos;
    }
    if (faltando.length) throw new Error(`Gabarito da questão web: faltam as respostas dos espaços ${faltando.join(", ")}.`);
    if (semBloco.length) throw new Error(`Gabarito da questão web: a resposta dos espaços ${semBloco.join(", ")} não está no banco de blocos.`);
    return { slots, grupos };
  }
  const vs = verificacoesDe(questao);
  if (!vs.length) throw new Error("Questão web (modo livre) sem verificações nas etapas.");
  const ids = new Set();
  for (const v of vs) { if (!v.id || ids.has(v.id)) throw new Error(`Verificação com id vazio ou repetido: "${v.id || ""}".`); ids.add(v.id); }
  const arquivos = { ...arquivosDaQuestao(questao).textos, ...(fonte?.solucao || {}) };
  const esperados = await observarVerificacoes(questao, arquivos);
  for (const [id, v] of Object.entries(fonte?.verificacoes || {})) if (ids.has(id)) esperados[id] = normalizarObservado(v);
  const verificacoes = {};
  for (const [id, v] of Object.entries(esperados)) verificacoes[id] = await sha256(id + "|" + v);
  return { verificacoes, esperados };
}

// ---------------------------------------------------------------------------------------------
// Realce de sintaxe (HTML e CSS, tema claro no estilo do VS Code)
// ---------------------------------------------------------------------------------------------
export function realcarCss(src, estado = { dentro: false }) {
  let out = "", i = 0;
  const s = String(src);
  while (i < s.length) {
    if (s.startsWith("/*", i)) { const f = s.indexOf("*/", i + 2); const fim = f < 0 ? s.length : f + 2; out += `<span class="c">${escHtml(s.slice(i, fim))}</span>`; i = fim; continue; }
    const ch = s[i];
    if (ch === "{") { estado.dentro = true; out += `<span class="p">{</span>`; i++; continue; }
    if (ch === "}") { estado.dentro = false; out += `<span class="p">}</span>`; i++; continue; }
    if (!estado.dentro) {
      let j = i;
      while (j < s.length && s[j] !== "{" && s[j] !== "}" && !s.startsWith("/*", j)) j++;
      const t = s.slice(i, j);
      out += /^\s*@/.test(t) ? `<span class="k">${escHtml(t)}</span>` : `<span class="sel">${escHtml(t)}</span>`;
      i = j; continue;
    }
    // dentro da regra: propriedade: valor;
    let j = i;
    while (j < s.length && !"{};".includes(s[j]) && !s.startsWith("/*", j)) j++;
    const t = s.slice(i, j);
    const dp = t.indexOf(":");
    if (dp >= 0) {
      out += `<span class="pr">${escHtml(t.slice(0, dp))}</span><span class="p">:</span>` + realcarValor(t.slice(dp + 1));
    } else out += `<span class="pr">${escHtml(t)}</span>`;
    if (s[j] === ";") { out += `<span class="p">;</span>`; j++; }
    i = j;
  }
  return out;
}
function realcarValor(v) {
  return escHtml(v).replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)|(#[0-9a-fA-F]{3,8}\b)|(-?\d*\.?\d+(?:px|em|rem|%|vh|vw|fr|s|ms|deg|ch)?)|(!important)/g,
    (t, str, cor, num, imp) => str ? `<span class="s">${str}</span>` : cor ? `<span class="n">${cor}</span>` : num ? `<span class="n">${num}</span>` : `<span class="k">${imp}</span>`);
}
function realcarTag(tag) {
  const m = tag.match(/^(<\/?)([a-zA-Z!][\w:-]*)([\s\S]*?)(\/?>)?$/);
  if (!m) return escHtml(tag);
  let attrs = escHtml(m[3]).replace(/([^\s=]+)(\s*=\s*)?(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;|[^\s&]+)?/g,
    (t, nome, igual, valor) => `<span class="at">${nome}</span>${igual ? `<span class="p">${igual}</span>` : ""}${valor ? `<span class="s">${valor}</span>` : ""}`);
  return `<span class="p">${escHtml(m[1])}</span><span class="tg">${escHtml(m[2])}</span>${attrs}<span class="p">${escHtml(m[4] || "")}</span>`;
}
export function realcarHtml(src) {
  const s = String(src);
  let out = "", i = 0;
  const re = /<!--[\s\S]*?(?:-->|$)|<\/?[a-zA-Z!][^<>]*>?/g;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > i) out += realcarTexto(s.slice(i, m.index));
    const t = m[0];
    if (t.startsWith("<!--")) out += `<span class="c">${escHtml(t)}</span>`;
    else {
      out += realcarTag(t);
      if (/^<style\b/i.test(t) && t.endsWith(">")) {
        const f = s.toLowerCase().indexOf("</style", re.lastIndex);
        const fim = f < 0 ? s.length : f;
        out += realcarCss(s.slice(re.lastIndex, fim));
        re.lastIndex = fim;
      }
    }
    i = re.lastIndex;
  }
  if (i < s.length) out += realcarTexto(s.slice(i));
  return out;
}
const realcarTexto = (t) => escHtml(t).replace(/&amp;[#\w]+;/g, x => `<span class="en">${x}</span>`);

// ---------------------------------------------------------------------------------------------
// Problemas (lint simples, neutro: não diz o que está certo ou errado na prova)
// ---------------------------------------------------------------------------------------------
function linhaDaPosicao(txt, pos) { let n = 1; for (let i = 0; i < pos && i < txt.length; i++) if (txt.charCodeAt(i) === 10) n++; return n; }
function problemasHtml(caminho, txt, existe) {
  const out = [];
  if (!/^\s*<!doctype html>/i.test(txt)) out.push({ arquivo: caminho, linha: 1, nivel: "aviso", msg: "Falta <!DOCTYPE html> no início do arquivo." });
  const pilha = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)\b([^<>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(txt))) {
    if (!m[2]) continue;
    const nome = m[2].toLowerCase(), linha = linhaDaPosicao(txt, m.index);
    if (!m[1]) {
      if (nome === "img" || nome === "link" || nome === "script" || nome === "source") {
        const ref = atributo(m[0], nome === "link" ? "href" : "src");
        const rel = atributo(m[0], "rel");
        if (ref && !externo(ref) && !ref.startsWith("#") && !ref.startsWith("data:") && (nome !== "link" || /stylesheet/i.test(rel || "")) && !existe(resolver(dirDe(caminho), ref)))
          out.push({ arquivo: caminho, linha, nivel: "erro", msg: `${nome === "link" ? "Arquivo de estilo" : nome === "img" ? "Imagem" : "Arquivo"} não encontrado: ${ref}` });
      }
      if (VAZIAS.has(nome) || m[4]) continue;
      if (nome === "script" || nome === "style") { const f = txt.toLowerCase().indexOf("</" + nome, re.lastIndex); if (f >= 0) re.lastIndex = f; }
      pilha.push({ nome, linha });
    } else {
      let k = pilha.length - 1;
      while (k >= 0 && pilha[k].nome !== nome) k--;
      if (k < 0) { out.push({ arquivo: caminho, linha, nivel: "erro", msg: `Fechamento </${nome}> sem a tag de abertura.` }); continue; }
      for (let j = pilha.length - 1; j > k; j--) if (!OPCIONAIS.has(pilha[j].nome)) out.push({ arquivo: caminho, linha: pilha[j].linha, nivel: "erro", msg: `A tag <${pilha[j].nome}> não foi fechada antes de </${nome}>.` });
      pilha.length = k;
    }
  }
  for (const p of pilha) if (!OPCIONAIS.has(p.nome)) out.push({ arquivo: caminho, linha: p.linha, nivel: "erro", msg: `A tag <${p.nome}> não foi fechada.` });
  return out;
}
function problemasCss(caminho, txt) {
  const out = [];
  const semCom = txt.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
  let prof = 0;
  const linhas = semCom.split("\n");
  linhas.forEach((l, i) => {
    const t = l.trim();
    for (const ch of t) { if (ch === "{") prof++; else if (ch === "}") { prof--; if (prof < 0) { out.push({ arquivo: caminho, linha: i + 1, nivel: "erro", msg: "Chave } sem a { correspondente." }); prof = 0; } } }
    if (prof > 0 && t && !t.includes("{") && !t.includes("}")) {
      if (!t.includes(":")) out.push({ arquivo: caminho, linha: i + 1, nivel: "erro", msg: `Declaração sem ":" — "${t.slice(0, 40)}"` });
      else if (!t.endsWith(";")) {
        let k = i + 1; while (k < linhas.length && !linhas[k].trim()) k++;
        if (k < linhas.length && !linhas[k].trim().startsWith("}")) out.push({ arquivo: caminho, linha: i + 1, nivel: "erro", msg: `Falta ";" no fim da declaração — "${t.slice(0, 40)}"` });
      }
    }
  });
  if (prof > 0) out.push({ arquivo: caminho, linha: linhas.length, nivel: "erro", msg: "Falta fechar uma regra com }." });
  return out;
}

// diferença linha a linha (LCS) para a aba "alterações" do git
function diferenca(a, b) {
  const A = String(a).replace(/\r/g, "").split("\n"), B = String(b).replace(/\r/g, "").split("\n");
  if (A.length * B.length > 2500000) return null;
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: " ", v: A[i], a: i + 1, b: j + 1 }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ t: "-", v: A[i], a: i + 1 }); i++; }
    else { out.push({ t: "+", v: B[j], b: j + 1 }); j++; }
  }
  while (i < n) { out.push({ t: "-", v: A[i], a: i + 1 }); i++; }
  while (j < m) { out.push({ t: "+", v: B[j], b: j + 1 }); j++; }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Estilos (injetados uma vez)
// ---------------------------------------------------------------------------------------------
const ESTILOS = `
.bweb{--bw-marinho:var(--marinho,#14213d);--bw-marinho2:var(--marinho-2,#1f3160);--bw-claro:var(--marinho-claro,#e9eef8);--bw-borda:#d7dde8;--bw-borda2:#e8ecf3;
  --bw-fundo:#f4f6fb;--bw-suave:#5d6b82;--bw-texto:#1a2233;--bw-verm:var(--vermelho,#c8102e);--bw-info:#2459c7;--bw-ambar:#f5a524;
  --bw-mono:Consolas,"Cascadia Mono","Courier New",monospace;--bw-lado:250px;--bw-dir:38%;--bw-painel:34%;
  position:relative;display:flex;flex-direction:column;height:min(780px,calc(100vh - 110px));min-height:560px;border:1px solid var(--bw-borda);border-radius:10px;overflow:hidden;
  background:#fff;color:var(--bw-texto);font:13px/1.4 var(--fonte-texto,"Inter","Segoe UI",system-ui,Arial,sans-serif);text-align:left}
.bweb *{box-sizing:border-box}
.bweb button{background:transparent;color:inherit;border:0;border-radius:0;padding:0;margin:0;font:inherit;min-height:0;line-height:inherit;font-weight:inherit;
  cursor:pointer;transform:none;box-shadow:none;text-align:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;letter-spacing:normal}
.bweb button:hover{background:transparent}
.bweb button:active{transform:none}
.bweb button:disabled,.bweb button:disabled:hover{background:transparent;opacity:.45;cursor:default}
.bweb button:focus-visible,.bweb [tabindex]:focus-visible{outline:2px solid var(--bw-info);outline-offset:-2px;box-shadow:none}
.bweb input,.bweb textarea{width:auto;min-height:0;margin:0;padding:0;border:0;border-radius:0;box-shadow:none;background:transparent;font:inherit;color:inherit;line-height:inherit}
.bweb input:focus,.bweb textarea:focus{box-shadow:none;outline:none}
.bweb ol,.bweb ul{margin:0;padding:0}
.bweb code{font-family:var(--bw-mono);font-size:.92em;background:#eef1f7;border-radius:4px;padding:0 4px;color:#3f4c63}
.bweb-topo{flex:none;display:flex;align-items:center;gap:8px;height:38px;padding:0 8px 0 12px;background:var(--bw-marinho);color:#c9d3e6;border-bottom:1px solid #0b1428}
.bweb-topo .tit{font-weight:600;color:#fff;font-family:var(--fonte-titulo,"Poppins","Segoe UI",sans-serif);font-size:13px}
.bweb-topo .sub{font-size:12px;color:#9fb0d4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bweb-topo .esp{flex:1}
.bweb .bweb-tb{height:28px;padding:0 10px;border-radius:6px;border:1px solid rgba(255,255,255,.18);color:#e8edf7;font-size:12.5px}
.bweb .bweb-tb:hover:not(:disabled){background:rgba(255,255,255,.12)}
.bweb-corpo{flex:1;display:flex;min-height:0}
.bweb-atv{flex:none;width:46px;display:flex;flex-direction:column;align-items:center;gap:2px;padding-top:4px;background:#1b2a4a}
.bweb .bweb-atv button{position:relative;width:46px;height:44px;justify-content:center;color:#8d9cc0;font-size:19px;border-left:2px solid transparent}
.bweb .bweb-atv button:hover{color:#fff}
.bweb .bweb-atv button[aria-pressed="true"]{color:#fff;border-left-color:#fff}
.bweb-atv .badge{position:absolute;right:5px;bottom:6px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--bw-info);color:#fff;font:600 10px/16px var(--fonte-texto,sans-serif);text-align:center}
.bweb-lado{flex:none;width:var(--bw-lado);display:flex;flex-direction:column;min-height:0;background:var(--bw-fundo);border-right:1px solid var(--bw-borda)}
.bweb-lado[hidden]{display:none}
.bweb-lado-tit{flex:none;display:flex;align-items:center;gap:4px;height:34px;padding:0 6px 0 14px;font-size:11px;font-weight:700;letter-spacing:.06em;color:#3f4c63;text-transform:uppercase}
.bweb-lado-tit .esp{flex:1}
.bweb .bweb-ic{width:24px;height:24px;justify-content:center;border-radius:5px;color:#3f4c63;font-size:14px}
.bweb .bweb-ic:hover:not(:disabled){background:#e1e7f2}
.bweb-lado-corpo{flex:1;overflow:auto;min-height:0;padding:0 0 12px}
.bweb-centro{flex:1;display:flex;flex-direction:column;min-width:260px;min-height:0}
.bweb-abas{flex:none;display:flex;height:35px;background:#eef1f7;border-bottom:1px solid var(--bw-borda);overflow-x:auto;overflow-y:hidden}
.bweb .bweb-aba{height:35px;padding:0 6px 0 12px;border-right:1px solid var(--bw-borda);color:#5d6b82;font-size:12.5px;background:#eef1f7}
.bweb .bweb-aba:hover{background:#f6f8fc}
.bweb .bweb-aba[aria-selected="true"]{background:#fff;color:var(--bw-texto);box-shadow:inset 0 2px 0 var(--bw-marinho2)}
.bweb-aba .x{display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;border-radius:4px;color:#8a95a8;font-size:13px}
.bweb-aba .x:hover{background:#dfe5f0;color:#1a2233}
.bweb-aba .m{color:#b35900;font-size:11px;font-weight:700}
.bweb-trilha{flex:none;display:flex;align-items:center;gap:8px;height:26px;padding:0 12px;font-size:12px;color:#7f8db0;border-bottom:1px solid var(--bw-borda2);white-space:nowrap;overflow:hidden}
.bweb-trilha .dica{margin-left:auto;color:#8a95a8;overflow:hidden;text-overflow:ellipsis}
.bweb-editor{flex:1 1 auto;position:relative;min-height:80px;background:#fff}
.bweb-cod{position:absolute;inset:0;overflow:auto;padding:6px 0 40px;font:13px/21px var(--bw-mono);color:#1f2328}
.bweb-l{display:flex;min-height:21px;white-space:pre}
.bweb-l .n,.bweb-dobra .n{flex:none;width:44px;padding-right:12px;text-align:right;color:#a3acbd;user-select:none}
.bweb-l .t{flex:1;padding-right:16px}
.bweb-l.anc .t{opacity:.55}
.bweb-l.anc .n{color:#c9cfdb}
.bweb .bweb-dobra{display:flex;width:100%;height:23px;margin:1px 0;color:#7f8db0;font:italic 12px/23px var(--fonte-texto,sans-serif);background:#f6f8fc;border-top:1px dashed #dfe5f0;border-bottom:1px dashed #dfe5f0}
.bweb .bweb-dobra:hover{background:#eef3fc;color:var(--bw-marinho2)}
.bweb .bweb-slot{display:inline-flex;align-items:center;gap:6px;max-width:100%;min-height:19px;margin:0 1px;padding:0 6px;border:1px dashed #7d9be0;border-radius:4px;background:#f2f6fe;
  color:#2f56b0;font:italic 12px/19px var(--fonte-texto,sans-serif);vertical-align:top;white-space:nowrap}
.bweb .bweb-slot:hover{background:#e6eefc}
.bweb .bweb-slot.cheio{border:1px solid #d7dde8;background:#f4f6fb;color:#1f2328;font:13px/19px var(--bw-mono);font-style:normal}
.bweb .bweb-slot.cheio:hover{border-color:#9fb0d4}
.bweb .bweb-slot.sel{border:1px solid var(--bw-ambar);background:#fff4dc;box-shadow:0 0 0 2px rgba(245,165,36,.35)}
.bweb .bweb-slot.alvo{border-color:var(--bw-info);box-shadow:0 0 0 2px rgba(36,89,199,.35)}
.bweb .bweb-slot.inativo{cursor:pointer;opacity:.8}
.bweb-slot .x{display:inline-flex;width:15px;height:15px;align-items:center;justify-content:center;border-radius:3px;color:#8a95a8;font:12px/1 var(--fonte-texto,sans-serif)}
.bweb-slot .x:hover{background:#dfe5f0;color:var(--bw-verm)}
.bweb .bweb-in{display:inline-block;min-width:6ch;max-width:100%;height:19px;margin:0 1px;padding:0 4px;border:1px dashed #7d9be0;border-radius:4px;background:#f2f6fe;color:#1f2328;
  font:13px/17px var(--bw-mono);vertical-align:top}
.bweb .bweb-in::placeholder{color:#6f8bc9;font:italic 12px var(--fonte-texto,sans-serif)}
.bweb .bweb-in:focus{border:1px solid var(--bw-ambar);background:#fffaf0;box-shadow:0 0 0 2px rgba(245,165,36,.3)}
.bweb .bweb-in.cheio{border-style:solid;border-color:#d7dde8;background:#f8f9fc}
.bweb .bweb-in:read-only{cursor:default}
.bweb-fecha{color:#800000}
.bweb-fecha.vazio{color:#b8c0cf}
.bweb-cod .c,.bweb-area pre .c{color:#008000}.bweb-cod .tg,.bweb-area pre .tg{color:#800000}.bweb-cod .at,.bweb-area pre .at{color:#e50000}
.bweb-cod .s,.bweb-area pre .s{color:#0451a5}.bweb-cod .p,.bweb-area pre .p{color:#5d6b82}.bweb-cod .sel,.bweb-area pre .sel{color:#800000}
.bweb-cod .pr,.bweb-area pre .pr{color:#e50000}.bweb-cod .n,.bweb-area pre .n{color:#098658}.bweb-cod .k,.bweb-area pre .k{color:#af00db}.bweb-cod .en,.bweb-area pre .en{color:#b35900}
.bweb-cod .bweb-l .n{color:#a3acbd}
.bweb-ed{position:absolute;inset:0;display:flex}
.bweb-ed[hidden]{display:none}
.bweb-num{flex:none;min-width:44px;overflow:hidden;padding:6px 12px 40px 6px;color:#a3acbd;text-align:right;font:13px/21px var(--bw-mono);white-space:pre;user-select:none}
.bweb-area{position:relative;flex:1;min-width:0}
.bweb .bweb-area pre,.bweb .bweb-area textarea{position:absolute;top:0;left:0;margin:0;padding:6px 10px 40px 4px;border:0;border-radius:0;font:13px/21px var(--bw-mono);letter-spacing:0;
  white-space:pre;overflow-wrap:normal;word-wrap:normal;tab-size:2;-moz-tab-size:2;font-variant-ligatures:none;box-shadow:none}
.bweb .bweb-area pre{right:0;bottom:0;overflow:hidden;pointer-events:none;color:#1f2328;background:transparent}
.bweb .bweb-area textarea{width:100%;height:100%;min-height:0;resize:none;outline:none;overflow:auto;background:transparent;color:transparent;caret-color:#111;-webkit-text-fill-color:transparent}
.bweb .bweb-area textarea::selection{background:rgba(36,89,199,.25);-webkit-text-fill-color:transparent}
.bweb-img{position:absolute;inset:0;overflow:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;
  background:repeating-conic-gradient(#f0f2f6 0 25%,#fff 0 50%) 0 0/18px 18px;color:#5d6b82;font-size:12px}
.bweb-img img{max-width:100%;max-height:85%;box-shadow:0 2px 12px rgba(20,33,61,.18);background:#fff}
.bweb-diff{position:absolute;inset:0;overflow:auto;font:13px/20px var(--bw-mono);padding:6px 0}
.bweb-diff div{white-space:pre;padding:0 12px 0 0;display:flex}
.bweb-diff .n{flex:none;width:76px;color:#a3acbd;text-align:right;padding-right:10px;user-select:none}
.bweb-diff .mais{background:#e6f6ec}.bweb-diff .menos{background:#fdecef}
.bweb-diff .info{padding:12px 16px;color:#5d6b82;font-family:var(--fonte-texto,sans-serif);white-space:normal}
.bweb-vazio{padding:14px;color:#7f8db0;font-size:12.5px}
.bweb-div-h{flex:none;height:5px;cursor:row-resize;background:var(--bw-borda2);border-top:1px solid var(--bw-borda)}
.bweb-div-v{flex:none;width:5px;cursor:col-resize;background:var(--bw-borda2);border-left:1px solid var(--bw-borda)}
.bweb-div-h:hover,.bweb-div-v:hover,.bweb-div-h.ativo,.bweb-div-v.ativo{background:#9fb0d4}
.bweb-painel{flex:0 0 var(--bw-painel);display:flex;flex-direction:column;min-height:34px;background:#fff}
.bweb-painel.fechado{flex-basis:34px}
.bweb-painel-abas{flex:none;display:flex;align-items:center;gap:2px;height:34px;padding:0 6px 0 8px;border-bottom:1px solid var(--bw-borda2)}
.bweb .bweb-pa{height:33px;padding:0 9px;font-size:11px;font-weight:600;letter-spacing:.05em;color:#7f8db0;text-transform:uppercase;border-bottom:1px solid transparent}
.bweb .bweb-pa:hover{color:var(--bw-texto)}
.bweb .bweb-pa[aria-selected="true"]{color:var(--bw-texto);border-bottom-color:var(--bw-marinho2)}
.bweb-pa .cont{display:inline-block;min-width:16px;padding:0 5px;border-radius:8px;background:#dfe5f0;color:#3f4c63;font-size:10px;line-height:16px;text-align:center}
.bweb-painel-abas .esp{flex:1}
.bweb-painel-corpo{flex:1;min-height:0;overflow:auto}
.bweb[data-modo="blocos"]{--bw-painel:42%}
.bweb-painel-corpo:has(.bweb-banco){overflow:hidden}
.bweb-painel.fechado .bweb-painel-corpo{display:none}
.bweb-banco{display:grid;grid-template-columns:minmax(150px,180px) minmax(0,1fr);height:100%}
.bweb-banco-barra{display:flex;flex-direction:column;gap:2px;min-height:0;overflow:auto;padding:6px;border-right:1px solid var(--bw-borda2);background:#fafbfd}
.bweb .bweb-filtro{width:100%;height:26px;margin:0 0 4px;padding:0 8px;border:1px solid var(--bw-borda);border-radius:6px;background:#fff;font-size:12.5px}
.bweb .bweb-filtro:focus{border-color:var(--bw-marinho2)}
.bweb .bweb-chip{flex:none;width:100%;height:24px;padding:0 8px;border-radius:5px;color:#3f4c63;font-size:12px;overflow:hidden;text-overflow:ellipsis}
.bweb .bweb-chip:hover{background:#e7ecf5}
.bweb .bweb-chip[aria-pressed="true"]{background:var(--bw-marinho2);color:#fff}
.bweb-chip .q{margin-left:auto;font-size:10.5px;opacity:.7}
.bweb-banco-dir{display:flex;flex-direction:column;min-height:0;min-width:0}
.bweb-banco-info{flex:none;padding:5px 10px;font-size:11.5px;color:#7f8db0;border-bottom:1px solid var(--bw-borda2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bweb-banco-info b{color:#8a5600}
.bweb-blocos{flex:1;overflow:auto;padding:2px 10px 10px}
.bweb-grupo{margin-top:6px}
.bweb-grupo h5{margin:4px 0 5px;font:700 10.5px/1.2 var(--fonte-texto,sans-serif);letter-spacing:.06em;text-transform:uppercase;color:#7f8db0}
.bweb-grupo .lista{display:flex;flex-wrap:wrap;gap:5px}
.bweb .bweb-bloco{max-width:100%;padding:3px 8px;border:1px solid var(--bw-borda);border-left:3px solid #e37933;border-radius:5px;background:#fff;color:#1f2328;
  font:12.5px/18px var(--bw-mono);white-space:pre-wrap;word-break:break-word;text-align:left;user-select:none;touch-action:none}
.bweb .bweb-bloco.css{border-left-color:#2459c7}
.bweb .bweb-bloco:hover:not(:disabled){border-color:#9fb0d4;background:#f6f8fc}
.bweb .bweb-bloco:disabled{opacity:.6}
.bweb-fantasma{position:fixed;z-index:2147483000;pointer-events:none;padding:3px 8px;border:1px solid var(--bw-info,#2459c7);border-radius:5px;background:#fff;
  font:12.5px/18px Consolas,monospace;box-shadow:0 6px 18px rgba(20,33,61,.25);opacity:.95;white-space:pre}
.bweb-lista-prob{list-style:none}
.bweb-lista-prob li{display:flex;gap:8px;align-items:baseline;padding:3px 12px;font-size:12.5px;cursor:pointer}
.bweb-lista-prob li:hover{background:#f4f6fb}
.bweb-lista-prob .ic{flex:none;width:16px;text-align:center}
.bweb-lista-prob .onde{color:#8a95a8;font-size:11.5px;margin-left:auto;white-space:nowrap}
.bweb-saida{padding:4px 12px;font:12px/19px var(--bw-mono);color:#3f4c63;white-space:pre-wrap}
.bweb-saida .h{color:#a3acbd}
.bweb-term{display:flex;flex-direction:column;min-height:100%;padding:4px 12px 8px;font:12.5px/19px var(--bw-mono);background:#fff;color:#1f2328;cursor:text}
.bweb-term .linhas{white-space:pre-wrap;word-break:break-word}
.bweb-term .pr{color:#12805c}.bweb-term .dir{color:#2459c7}.bweb-term .er{color:#c8102e}.bweb-term .ok{color:#12805c}.bweb-term .am{color:#8a5600}
.bweb-term .entrada{display:flex;gap:6px;align-items:center}
.bweb .bweb-term input{flex:1;min-width:60px;height:19px;font:12.5px/19px var(--bw-mono)}
.bweb-dir{flex:0 0 var(--bw-dir);display:flex;flex-direction:column;min-width:240px;min-height:0;background:#fff}
.bweb-dir[hidden]{display:none}
.bweb-dir-abas{flex:none;display:flex;align-items:center;height:35px;background:#eef1f7;border-bottom:1px solid var(--bw-borda)}
.bweb-dir-abas .esp{flex:1}
.bweb-end{flex:none;display:flex;align-items:center;gap:6px;height:32px;padding:0 8px;border-bottom:1px solid var(--bw-borda2);background:#fafbfd}
.bweb-end .url{flex:1;min-width:0;height:22px;padding:0 10px;border-radius:11px;background:#eef1f7;color:#5d6b82;font:12px/22px var(--fonte-texto,sans-serif);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bweb .bweb-larg{height:22px;padding:0 6px;border-radius:5px;font-size:11.5px;color:#5d6b82}
.bweb .bweb-larg[aria-pressed="true"]{background:var(--bw-claro);color:var(--bw-marinho2);font-weight:600}
.bweb-quadro{flex:1;min-height:0;display:flex;justify-content:center;background:#e9edf4;overflow:auto}
.bweb-quadro iframe{display:block;width:100%;height:100%;border:0;background:#fff}
.bweb-quadro.estreito iframe{box-shadow:0 0 0 1px #d7dde8;flex:none}
.bweb-quadro.escala{justify-content:flex-start;overflow:hidden}
.bweb-quadro.escala iframe{flex:none;transform-origin:0 0}
.bweb-gh{flex:1;min-height:0;overflow:auto;background:#fff;color:#1f2328;font-size:13px}
.bweb-gh-topo{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f6f8fa;border-bottom:1px solid #d0d7de}
.bweb-gh-topo b{color:#0969da;font-weight:600}
.bweb-gh-sec{margin:12px 14px;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
.bweb-gh-sec .cab{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f6f8fa;border-bottom:1px solid #d0d7de;font-size:12.5px}
.bweb-gh-sec .lin{display:flex;align-items:center;gap:8px;padding:6px 12px;border-top:1px solid #eaeef2;font-size:12.5px}
.bweb-gh-sec .lin:first-of-type{border-top:0}
.bweb-gh-sec .lin .nm{min-width:110px;color:#1f2328}
.bweb-gh-sec .lin .msg{flex:1;color:#57606a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bweb-gh-sec .lin .tp{color:#57606a;font-size:12px;white-space:nowrap}
.bweb-gh-sec .hash{font-family:var(--bw-mono);font-size:12px;color:#0969da}
.bweb-gh-aviso{margin:10px 14px;font-size:11.5px;color:#57606a}
.bweb-status{flex:none;display:flex;align-items:center;gap:14px;height:24px;padding:0 10px;background:var(--bw-marinho2);color:#e8edf7;font-size:12px;white-space:nowrap;overflow:hidden}
.bweb .bweb-status button{height:24px;padding:0 4px;color:#e8edf7}
.bweb .bweb-status button:hover{background:rgba(255,255,255,.12)}
.bweb-status .esp{flex:1}
.bweb-etapas-nav{display:grid;grid-template-columns:repeat(auto-fill,minmax(36px,1fr));gap:5px;padding:2px 12px 10px}
.bweb .bweb-en{position:relative;height:32px;justify-content:center;border:1px solid var(--bw-borda);border-radius:7px;background:#fff;font-weight:600;color:#3f4c63}
.bweb .bweb-en:hover{border-color:#9fb0d4}
.bweb .bweb-en[aria-current="step"]{background:var(--bw-marinho2);border-color:var(--bw-marinho2);color:#fff}
.bweb-en .pt{position:absolute;right:3px;top:3px;width:6px;height:6px;border-radius:50%;background:#b8c0cf}
.bweb-en .pt.meio{background:var(--bw-ambar)}.bweb-en .pt.cheio{background:var(--bw-info)}
.bweb-en[aria-current="step"] .pt{box-shadow:0 0 0 1px #fff}
.bweb-etapa{padding:0 12px}
.bweb-etapa .selo{display:inline-block;padding:1px 8px;border-radius:999px;background:var(--bw-claro);color:var(--bw-marinho2);font-size:11px;font-weight:600}
.bweb-etapa h3{margin:6px 0 6px;font:600 15px/1.3 var(--fonte-titulo,"Poppins",sans-serif);color:var(--bw-marinho)}
.bweb-etapa .enun{margin:0 0 10px;color:#3f4c63;font-size:12.5px;line-height:1.5}
.bweb-cartao{margin:0 0 10px;padding:10px 10px 8px;border:1px solid var(--bw-borda);border-radius:8px;background:#fff}
.bweb-cartao h4{margin:0 0 6px;font:600 12px/1.3 var(--fonte-texto,sans-serif);color:var(--bw-marinho)}
.bweb-cartao ol,.bweb-cartao ul{padding-left:18px;font-size:12.5px;line-height:1.5;color:#3f4c63}
.bweb-cartao li{margin:0 0 4px}
.bweb-prog{margin:4px 0 10px;font-size:12px;color:#3f4c63}
.bweb-prog .barra{height:6px;margin-top:4px;border-radius:3px;background:#dfe5f0;overflow:hidden}
.bweb-prog .barra i{display:block;height:100%;background:var(--bw-info)}
.bweb-etapa-pe{display:flex;gap:6px;justify-content:space-between}
.bweb .bweb-bt{height:28px;padding:0 10px;border:1px solid var(--bw-borda);border-radius:6px;background:#fff;color:#1a2233;font-size:12.5px;font-weight:500}
.bweb .bweb-bt:hover:not(:disabled){background:#f6f8fc;border-color:#b9c3d6}
.bweb .bweb-bt.prim{background:var(--bw-marinho2);border-color:var(--bw-marinho2);color:#fff;justify-content:center}
.bweb .bweb-bt.prim:hover:not(:disabled){background:var(--bw-marinho)}
.bweb .bweb-bt.prim:disabled{background:var(--bw-marinho2);opacity:.45}
.bweb-arqs-etapa{display:flex;flex-wrap:wrap;gap:5px}
.bweb-arvore{padding:2px 0;font-size:13px;user-select:none}
.bweb-no{display:flex;align-items:center;gap:5px;height:24px;padding-right:8px;cursor:pointer;white-space:nowrap;color:#1a2233}
.bweb-no:hover{background:#e7ecf5}
.bweb-no.sel{background:#dbe4f5}
.bweb-no.ativo .nm{font-weight:600}
.bweb-no .seta{width:12px;color:#7f8db0;font-size:10px;text-align:center}
.bweb-no .ico{width:16px;text-align:center;font:700 10px/1 var(--bw-mono)}
.bweb-no .ico.html{color:#e37933}.bweb-no .ico.css{color:#2459c7}.bweb-no .ico.img{color:#a335c4;font-size:12px}.bweb-no .ico.pasta{font-size:13px}.bweb-no .ico.txt{color:#7f8db0}
.bweb-no .nm{overflow:hidden;text-overflow:ellipsis}
.bweb-no .gm{margin-left:auto;font:700 11px/1 var(--bw-mono)}
.bweb-no .gm.M{color:#b35900}.bweb-no .gm.A,.bweb-no .gm.U{color:#12805c}.bweb-no .gm.D{color:#c8102e}
.bweb-no .ro{margin-left:auto;font-size:10px;color:#a3acbd}
.bweb-no.novo{cursor:default}
.bweb .bweb-nome{flex:1;min-width:0;height:20px;padding:0 4px;border:1px solid var(--bw-info);background:#fff;font-size:12.5px}
.bweb-erro-nome{margin:2px 12px 4px 28px;font-size:11.5px;color:#a00d25}
.bweb-conf{margin:6px 10px;padding:8px;border:1px solid #f2c4cc;border-radius:7px;background:#fdecef;font-size:12px;color:#a00d25}
.bweb-conf .bt{display:flex;gap:6px;margin-top:6px}
.bweb-git{padding:0 10px}
.bweb .bweb-msg{display:block;width:100%;min-height:54px;max-height:120px;padding:6px 8px;border:1px solid var(--bw-borda);border-radius:6px;background:#fff;font:12.5px/1.4 var(--fonte-texto,sans-serif);resize:vertical}
.bweb .bweb-msg:focus{border-color:var(--bw-marinho2)}
.bweb-git .acoes{display:flex;gap:6px;margin:6px 0 8px}
.bweb-git .acoes .bweb-bt{flex:1}
.bweb-git-sec{margin:6px 0 2px;display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;letter-spacing:.05em;color:#3f4c63;text-transform:uppercase}
.bweb-git-sec .esp{flex:1}
.bweb-git-sec .cont{padding:0 6px;border-radius:8px;background:#dfe5f0;font-size:10px;line-height:16px}
.bweb-mud{display:flex;align-items:center;gap:6px;height:24px;padding:0 2px 0 6px;border-radius:5px;font-size:12.5px;cursor:pointer}
.bweb-mud:hover{background:#e7ecf5}
.bweb-mud .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bweb-mud .pasta{color:#8a95a8;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bweb-mud .esp{flex:1}
.bweb-mud .gm{font:700 11px/1 var(--bw-mono);width:12px;text-align:center}
.bweb-mud .gm.M{color:#b35900}.bweb-mud .gm.A{color:#12805c}.bweb-mud .gm.D{color:#c8102e}
.bweb-sync{display:flex;align-items:center;gap:6px;margin:8px 0;padding:7px 8px;border:1px solid var(--bw-borda);border-radius:7px;background:#fff;font-size:12px}
.bweb-sync .esp{flex:1}
.bweb-req{margin:8px 0;padding:8px;border:1px dashed #b9c3d6;border-radius:7px;font-size:12px;color:#3f4c63}
.bweb-req b{display:block;margin-bottom:4px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#5d6b82}
.bweb-req div{display:flex;gap:6px;align-items:center;margin:2px 0}
.bweb-req .ok{color:#12805c}
.bweb-hist{position:relative;margin:4px 0 0}
.bweb-hist .cm{position:relative;display:flex;gap:8px;padding:5px 0 5px 22px;font-size:12px}
.bweb-hist .cm::before{content:"";position:absolute;left:7px;top:0;bottom:0;width:2px;background:#c9d3e6}
.bweb-hist .cm:first-child::before{top:12px}
.bweb-hist .cm:last-child::before{bottom:calc(100% - 12px)}
.bweb-hist .cm i{position:absolute;left:3px;top:8px;width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid var(--bw-marinho2)}
.bweb-hist .cm.remoto i{background:var(--bw-marinho2)}
.bweb-hist .tx{min-width:0;flex:1}
.bweb-hist .tx .m{display:block;color:#1a2233;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bweb-hist .tx .d{display:block;color:#8a95a8;font-size:11px}
.bweb-hist .tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}
.bweb-hist .tag{display:inline-block;padding:0 5px;border-radius:4px;font-size:10px;line-height:15px;font-weight:600;background:var(--bw-claro);color:var(--bw-marinho2)}
.bweb-hist .tag.r{background:#e3f5ed;color:#0e6b4c}
.bweb-sobre{position:fixed;inset:0;z-index:390;display:flex;flex-direction:column;background:rgba(20,33,61,.55)}
.bweb-sobre[hidden]{display:none}
.bweb-sobre-cab{flex:none;display:flex;align-items:center;gap:10px;height:42px;padding:0 10px 0 16px;background:var(--bw-marinho);color:#fff;font-weight:600}
.bweb-sobre-cab .esp{flex:1}
.bweb-sobre-corpo{flex:1;min-height:0;display:flex;justify-content:center;background:#e9edf4;overflow:auto}
.bweb-sobre-corpo iframe{width:100%;height:100%;border:0;background:#fff}
.bweb-sobre-corpo .modelo{max-width:min(1200px,100%);height:auto;align-self:flex-start;margin:16px;box-shadow:0 4px 24px rgba(20,33,61,.25)}
.bweb[data-ro="1"] .bweb-bloco{cursor:default}
@media (max-width:900px){
  .bweb{height:auto;min-height:0}
  .bweb-corpo{flex-direction:column}
  .bweb-atv{flex-direction:row;width:auto;height:44px;padding:0 4px}
  .bweb-lado{width:auto;max-height:240px;border-right:0;border-bottom:1px solid var(--bw-borda)}
  .bweb-centro{min-height:520px}
  .bweb-div-v{display:none}
  .bweb-dir{flex:none;height:420px;border-top:1px solid var(--bw-borda)}
}
`;
function injetarCss() {
  if (typeof document === "undefined" || document.getElementById("bweb-css")) return;
  const st = document.createElement("style");
  st.id = "bweb-css";
  st.textContent = ESTILOS;
  document.head.appendChild(st);
}

// ---------------------------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------------------------
export function montarBancadaWeb(container, opcoes = {}) {
  injetarCss();
  const questao = opcoes.questao || {};
  const salvo = opcoes.valor && typeof opcoes.valor === "object" ? opcoes.valor : null;
  const onMudar = typeof opcoes.onMudar === "function" ? opcoes.onMudar : null;
  const ro = !!opcoes.somenteLeitura;
  const abrirJanela = typeof opcoes.abrirJanela === "function" ? opcoes.abrirJanela : (u) => window.open(u, "_blank");
  const modo = modoDe(questao);
  const comGit = gitAtivo(questao);
  const pe = prepararEtapas(questao);
  const porId = Object.fromEntries(pe.map(p => [p.id, p]));
  const estrutura = estruturaHtml(questao);
  const arqHtml = questao.arquivoHtml || "index.html", arqCss = questao.arquivoCss || "style.css";
  const base = baseAbsoluta(questao.assetsBase);
  const repo = String(questao.git?.repo || "meu-site").replace(/[^\w.-]+/g, "-");
  const daQuestao = arquivosDaQuestao(questao);
  const assets = daQuestao.assets.slice();
  const entrada = questao.entrada || (modo === "livre" ? (Object.keys(daQuestao.textos).find(k => k === "index.html") || Object.keys(daQuestao.textos).find(k => /\.html?$/i.test(k)) || "index.html") : arqHtml);
  const uid = "bw" + Math.random().toString(36).slice(2, 8);

  // ---------- estado ----------
  const st = {
    etapa: 0, visao: "etapas", ladoAberto: true, painel: modo === "blocos" ? "comandos" : "problemas", painelAberto: true,
    direita: "previa", abas: [], aba: null, slotSel: null, filtroCat: "todas", filtroTxt: "",
    slots: {}, arquivos: {}, pastas: new Set(daQuestao.pastas), abertas: new Set(), selExpl: null, criando: null, renomeando: null, excluindo: null, erroNome: "",
    vistas: new Set(), previaCaminho: entrada, largura: "ajustar", saida: [], term: [], termHist: [], termPos: -1, versao: 0
  };
  if (modo === "livre") st.arquivos = { ...daQuestao.textos };
  if (salvo) {
    if (modo !== "livre" && salvo.slots && typeof salvo.slots === "object") for (const [k, v] of Object.entries(salvo.slots)) if (typeof v === "string") st.slots[k] = v;
    if (modo === "livre" && salvo.arquivos && typeof salvo.arquivos === "object") {
      st.arquivos = {};
      for (const [k, v] of Object.entries(salvo.arquivos)) if (typeof v === "string") st.arquivos[k] = v;
    }
    if (Array.isArray(salvo.pastas)) salvo.pastas.forEach(p => st.pastas.add(String(p)));
    if (Array.isArray(salvo.etapasVistas)) salvo.etapasVistas.forEach(e => st.vistas.add(String(e)));
  }
  // pastas abertas no explorador: todas as que têm arquivos (projetos pequenos)
  const todasPastas = () => {
    const s = new Set(st.pastas);
    for (const p of [...Object.keys(textosAtuais()), ...assets]) { const partes = p.split("/"); for (let i = 1; i < partes.length; i++) s.add(partes.slice(0, i).join("/")); }
    return s;
  };

  let cacheTextos = null, cacheVersao = -1;
  function textosAtuais() {
    if (cacheVersao === st.versao && cacheTextos) return cacheTextos;
    if (modo === "livre") cacheTextos = st.arquivos;
    else { const { html, css } = montarCodigo(questao, st.slots); cacheTextos = { [arqHtml]: html, [arqCss]: css }; }
    cacheVersao = st.versao;
    return cacheTextos;
  }
  const existeNoProjeto = (c) => textosAtuais()[c] != null || assets.includes(c);

  // ---------- git simulado ----------
  const hashes = (arqs) => Object.fromEntries(Object.entries(arqs).map(([k, v]) => [k, hashCurto(v)]));
  const textosIniciais = modo === "livre" ? { ...daQuestao.textos } : (() => { const c = montarCodigo(questao, {}); return { [arqHtml]: c.html, [arqCss]: c.css }; })();
  const idInicial = hashCurto("inicial|" + JSON.stringify(hashes(textosIniciais))).slice(0, 7);
  const inicioEm = Date.now();
  const git = { commits: [], pushes: 0, remoto: idInicial, head: hashes(textosIniciais), stage: new Set(), headConteudo: { ...textosIniciais } };
  if (salvo?.git && comGit) {
    const g = salvo.git;
    if (Array.isArray(g.commits)) git.commits = g.commits.filter(c => c && c.id).map(c => ({ id: String(c.id), msg: String(c.msg || ""), em: Number(c.em) || 0, arquivos: Array.isArray(c.arquivos) ? c.arquivos.map(String) : [], ...(Array.isArray(c.del) && c.del.length ? { del: c.del.map(String) } : {}) }));
    git.pushes = Number(g.pushes) || 0;
    if (g.remoto) git.remoto = String(g.remoto);
    if (g.head && typeof g.head === "object") {
      git.head = { ...g.head };
      const atuais = textosAtuais();
      git.headConteudo = {};
      for (const [k, h] of Object.entries(git.head)) {
        if (textosIniciais[k] != null && hashCurto(textosIniciais[k]) === h) git.headConteudo[k] = textosIniciais[k];
        else if (atuais[k] != null && hashCurto(atuais[k]) === h) git.headConteudo[k] = atuais[k];
      }
    }
    if (Array.isArray(g.stage)) g.stage.forEach(p => git.stage.add(String(p)));
  }
  function mudancasGit() {
    const atuais = textosAtuais(), out = [];
    for (const [k, v] of Object.entries(atuais)) { if (!(k in git.head)) out.push({ caminho: k, st: "A" }); else if (git.head[k] !== hashCurto(v)) out.push({ caminho: k, st: "M" }); }
    for (const k of Object.keys(git.head)) if (!(k in atuais)) out.push({ caminho: k, st: "D" });
    return out.sort((a, b) => a.caminho.localeCompare(b.caminho));
  }
  const ultimoCommit = () => git.commits.length ? git.commits[git.commits.length - 1].id : idInicial;
  function aFrente() { const i = git.commits.findIndex(c => c.id === git.remoto); return git.remoto === idInicial ? git.commits.length : i < 0 ? git.commits.length : git.commits.length - 1 - i; }
  function fazerCommit(msg) {
    msg = String(msg || "").trim();
    if (!msg) return { erro: "Escreva a mensagem do commit (o que você fez nesta etapa)." };
    const mud = mudancasGit();
    if (!mud.length) return { erro: "Nada para enviar no commit: nenhuma alteração desde o último commit." };
    let incl = mud.filter(m => git.stage.has(m.caminho));
    let tudo = false;
    if (!incl.length) { incl = mud; tudo = true; }
    const atuais = textosAtuais();
    for (const m of incl) {
      if (m.st === "D") { delete git.head[m.caminho]; delete git.headConteudo[m.caminho]; }
      else { git.head[m.caminho] = hashCurto(atuais[m.caminho]); git.headConteudo[m.caminho] = atuais[m.caminho]; }
      git.stage.delete(m.caminho);
    }
    const em = Date.now();
    const id = hashCurto(msg + "|" + em + "|" + JSON.stringify(git.head) + "|" + git.commits.length).slice(0, 7);
    const del = incl.filter(m => m.st === "D").map(m => m.caminho);
    const c = { id, msg: msg.slice(0, 200), em, arquivos: incl.filter(m => m.st !== "D").map(m => m.caminho), ...(del.length ? { del } : {}) };
    git.commits.push(c);
    return { commit: c, tudo, n: incl.length };
  }
  function fazerPush() {
    const n = aFrente();
    if (!n) return { nada: true };
    const de = git.remoto;
    git.remoto = ultimoCommit();
    git.pushes++;
    return { n, de, para: git.remoto };
  }
  // árvore do remoto (o que foi enviado com push)
  function arvoreRemota() {
    const arquivos = new Map(Object.keys(textosIniciais).map(k => [k, { msg: "Commit inicial (arquivos da prova)", em: inicioEm }]));
    assets.forEach(a => arquivos.set(a, { msg: "Commit inicial (arquivos da prova)", em: inicioEm }));
    if (git.remoto !== idInicial) {
      for (const c of git.commits) {
        c.arquivos.forEach(a => arquivos.set(a, { msg: c.msg, em: c.em }));
        (c.del || []).forEach(a => arquivos.delete(a));
        if (c.id === git.remoto) break;
      }
    }
    return arquivos;
  }

  // ---------- DOM ----------
  const raiz = document.createElement("div");
  raiz.className = "bweb";
  raiz.dataset.modo = modo;
  if (ro) raiz.dataset.ro = "1";
  const temModelo = !!questao.imagemModelo;
  raiz.innerHTML = `
    <div class="bweb-topo">
      <span class="tit">Bancada Web</span>
      <span class="sub">${escHtml(repo)} · ${modo === "blocos" ? "encaixe os comandos" : modo === "completar" ? "complete os comandos" : "projeto livre"}</span>
      <span class="esp"></span>
      ${temModelo ? `<button type="button" class="bweb-tb" data-acao="modelo" title="Ver a imagem do resultado esperado">🖼 Ver modelo</button>` : ""}
      <button type="button" class="bweb-tb" data-acao="tela" title="Mostrar a prévia ocupando a tela toda (sem sair da prova)">⛶ Prévia em tela inteira</button>
      ${questao.previa === "aba" ? `<button type="button" class="bweb-tb" data-acao="aba" title="Abre a prévia ao vivo em outra aba do navegador">↗ Abrir prévia em outra aba</button>` : ""}
    </div>
    <div class="bweb-corpo">
      <nav class="bweb-atv" aria-label="Visões">
        <button type="button" data-visao="etapas" title="Etapas da prova" aria-label="Etapas">📋</button>
        <button type="button" data-visao="explorador" title="Explorador de arquivos" aria-label="Explorador">📁</button>
        ${comGit ? `<button type="button" data-visao="git" title="Controle de código-fonte (git)" aria-label="Controle de código-fonte"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="8" r="2.2"/><path d="M6 7.2v9.6M18 10.2c0 4-6 3.2-11 6.6"/></svg><span class="badge" data-r="badge" hidden></span></button>` : ""}
      </nav>
      <aside class="bweb-lado" data-r="lado"></aside>
      <div class="bweb-centro">
        <div class="bweb-abas" role="tablist" aria-label="Arquivos abertos" data-r="abas"></div>
        <div class="bweb-trilha" data-r="trilha"></div>
        <div class="bweb-editor" data-r="editor"></div>
        <div class="bweb-div-h" data-r="divh" title="Arraste para redimensionar"></div>
        <div class="bweb-painel" data-r="painel">
          <div class="bweb-painel-abas" role="tablist" aria-label="Painel" data-r="pabas"></div>
          <div class="bweb-painel-corpo" data-r="pcorpo"></div>
        </div>
      </div>
      <div class="bweb-div-v" data-r="divv" title="Arraste para redimensionar"></div>
      <section class="bweb-dir" data-r="dir">
        <div class="bweb-dir-abas" role="tablist">
          <button type="button" class="bweb-aba" role="tab" data-dir="previa">🌐 Prévia ao vivo</button>
          ${comGit ? `<button type="button" class="bweb-aba" role="tab" data-dir="github">🐙 GitHub</button>` : ""}
          <span class="esp"></span>
        </div>
        <div data-r="vprevia" style="flex:1;display:flex;flex-direction:column;min-height:0">
          <div class="bweb-end">
            <button type="button" class="bweb-ic" data-acao="inicio" title="Voltar para ${escHtml(entrada)}">⌂</button>
            <button type="button" class="bweb-ic" data-acao="recarregar" title="Recarregar a prévia">⟳</button>
            <span class="url" data-r="url"></span>
            <button type="button" class="bweb-larg" data-larg="ajustar" title="Mostra a página como num computador (1280 px), reduzida para caber">Ajustar</button>
            <button type="button" class="bweb-larg" data-larg="100%" title="Largura real do painel, sem reduzir">Real</button>
            <button type="button" class="bweb-larg" data-larg="768px" title="Tablet (768 px)">768</button>
            <button type="button" class="bweb-larg" data-larg="375px" title="Celular (375 px)">375</button>
          </div>
          <div class="bweb-quadro" data-r="quadro"><iframe sandbox="allow-same-origin" title="Prévia ao vivo do site" data-r="frame"></iframe></div>
        </div>
        <div class="bweb-gh" data-r="vgithub" hidden></div>
      </section>
    </div>
    <footer class="bweb-status" data-r="status"></footer>
    <div class="bweb-sobre" data-r="sobre" hidden role="dialog" aria-modal="true">
      <div class="bweb-sobre-cab"><span data-r="sobretit"></span><span class="esp"></span><button type="button" class="bweb-tb" data-acao="fechar-sobre">✕ Fechar</button></div>
      <div class="bweb-sobre-corpo" data-r="sobrecorpo"></div>
    </div>`;
  container.innerHTML = "";
  container.appendChild(raiz);
  const $r = (n) => raiz.querySelector(`[data-r="${n}"]`);
  const el = {
    lado: $r("lado"), abas: $r("abas"), trilha: $r("trilha"), editor: $r("editor"), painel: $r("painel"), pabas: $r("pabas"), pcorpo: $r("pcorpo"),
    dir: $r("dir"), vprevia: $r("vprevia"), vgithub: $r("vgithub"), url: $r("url"), quadro: $r("quadro"), frame: $r("frame"), status: $r("status"),
    sobre: $r("sobre"), sobretit: $r("sobretit"), sobrecorpo: $r("sobrecorpo"), badge: $r("badge")
  };
  let destruido = false, timerMudar = null, timerPrevia = null, timerGit = null;

  function mudou({ previa = true, git: g = true, codigo = true } = {}) {
    if (codigo) st.versao++;
    if (previa) agendarPrevia();
    if (g) { clearTimeout(timerGit); timerGit = setTimeout(() => { if (!destruido) { atualizarBadge(); if (st.visao === "git" || st.visao === "explorador") renderLado(); renderStatus(); if (st.painel === "problemas") renderPainel(); else atualizarContPainel(); } }, 250); }
    if (!onMudar || ro) return;
    clearTimeout(timerMudar);
    timerMudar = setTimeout(() => { timerMudar = null; if (!destruido) onMudar(); }, 800);
  }
  function log(msg) {
    st.saida.push({ t: Date.now(), msg });
    if (st.saida.length > 200) st.saida.shift();
    if (st.painel === "saida") renderPainel();
  }

  // ---------- etapas ----------
  const etapaAtual = () => pe[st.etapa];
  function ancestraisDe(id) { const s = new Set(); let p = estrutura.pai[id]; while (p != null && !s.has(p)) { s.add(p); p = estrutura.pai[p]; } return s; }
  function contagemEtapa(p) {
    const tot = p.slots.length;
    const cheios = p.slots.filter(s => String(st.slots[s.id] ?? "").trim()).length;
    return { tot, cheios };
  }
  function irEtapa(i, { focar = false } = {}) {
    if (i < 0 || i >= pe.length) return;
    st.etapa = i;
    st.slotSel = null;
    const id = pe[i].id;
    if (!st.vistas.has(id)) { st.vistas.add(id); mudou({ previa: false, git: false, codigo: false }); }
    if (st.visao === "etapas") renderLado();
    if (modo !== "livre") {
      // abre o arquivo que tem espaços nesta etapa, se o atual não tiver
      const ab = abaAtual();
      const tipo = ab?.caminho === arqCss ? "css" : "html";
      const temNoAtual = tipo === "html" ? pe[i].htmlP.slots.length : pe[i].cssP.slots.length;
      if (!temNoAtual) abrir(tipo === "html" ? arqCss : arqHtml);
      else renderEditor();
      rolarParaEtapa(focar);
    }
    renderStatus();
    if (st.painel === "comandos") renderPainel();
  }

  // ---------- abas do editor ----------
  const abaAtual = () => st.abas.find(a => a.chave === st.aba) || null;
  function abrir(caminho, tipo = null) {
    tipo = tipo || (EXT_IMG.test(caminho) && assets.includes(caminho) ? "img" : "arq");
    const chave = tipo + ":" + caminho;
    if (!st.abas.some(a => a.chave === chave)) st.abas.push({ chave, tipo, caminho });
    st.aba = chave;
    st.cursor = null;
    if (tipo === "arq" && /\.html?$/i.test(caminho) && st.previaCaminho !== caminho) { st.previaCaminho = caminho; agendarPrevia(); }
    renderAbas(); renderEditor(); renderTrilha(); renderStatus();
    if (st.visao === "explorador") renderLado();
    if (st.painel === "comandos") renderPainel();
  }
  function fecharAba(chave) {
    const i = st.abas.findIndex(a => a.chave === chave);
    if (i < 0) return;
    const [a] = st.abas.splice(i, 1);
    if (a.tipo === "arq" && editores.has(a.caminho)) { editores.get(a.caminho).el.remove(); editores.delete(a.caminho); }
    if (st.aba === chave) st.aba = st.abas[Math.max(0, i - 1)]?.chave || null;
    renderAbas(); renderEditor(); renderTrilha(); renderStatus();
  }
  function iconeArq(c) {
    const e = extDe(c);
    if (e === "html" || e === "htm") return `<span class="ico html">&lt;&gt;</span>`;
    if (e === "css") return `<span class="ico css">#</span>`;
    if (EXT_IMG.test(c)) return `<span class="ico img">▣</span>`;
    return `<span class="ico txt">≡</span>`;
  }
  function renderAbas() {
    const mud = comGit ? new Map(mudancasGit().map(m => [m.caminho, m.st])) : new Map();
    el.abas.innerHTML = st.abas.map(a => {
      const fixa = modo !== "livre" && a.tipo === "arq";
      const rot = a.tipo === "diff" ? `${nomeDe(a.caminho)} (alterações)` : nomeDe(a.caminho);
      const m = a.tipo === "arq" && mud.get(a.caminho) === "M" ? `<span class="m" title="Alterado desde o último commit">M</span>` : "";
      return `<button type="button" class="bweb-aba" role="tab" aria-selected="${a.chave === st.aba}" data-aba="${escHtml(a.chave)}" title="${escHtml(a.caminho)}">`
        + `${a.tipo === "diff" ? `<span class="ico">⇄</span>` : iconeArq(a.caminho)} ${escHtml(rot)} ${m}${fixa ? "" : `<span class="x" data-fechar="${escHtml(a.chave)}" title="Fechar">×</span>`}</button>`;
    }).join("") || `<span class="bweb-vazio" style="padding:9px 12px">Abra um arquivo no Explorador.</span>`;
  }
  el.abas.addEventListener("click", ev => {
    const x = ev.target.closest("[data-fechar]");
    if (x) { ev.stopPropagation(); fecharAba(x.dataset.fechar); return; }
    const b = ev.target.closest("[data-aba]");
    if (b) { const a = st.abas.find(z => z.chave === b.dataset.aba); if (a) abrir(a.caminho, a.tipo); }
  });
  function renderTrilha() {
    const a = abaAtual();
    const partes = a ? [repo, ...a.caminho.split("/")] : [repo];
    let dica = "";
    if (a?.tipo === "arq" && modo === "blocos") dica = ro ? "" : "Clique num espaço tracejado e depois num comando do painel COMANDOS (ou arraste o comando até o espaço).";
    else if (a?.tipo === "arq" && modo === "completar") dica = ro ? "" : "Digite o comando em cada espaço tracejado. As tags de fechamento aparecem sozinhas.";
    else if (a?.tipo === "img") dica = "Imagem da prova (somente leitura)";
    else if (a?.tipo === "diff") dica = "Alterações desde o último commit (somente leitura)";
    el.trilha.innerHTML = partes.map(escHtml).join(' <span aria-hidden="true">›</span> ') + (dica ? `<span class="dica" title="${escHtml(dica)}">${escHtml(dica)}</span>` : "");
  }

  // ---------- editor dos modelos (blocos/completar) ----------
  function linhasModelo(tipo) {
    const out = [];
    if (tipo === "css") {
      pe.forEach((p, i) => {
        if (!p.cssP.linhas.length) return;
        p.cssP.linhas.forEach(l => out.push({ etapa: p.id, ind: l.ind, partes: l.partes, cadeia: [p.id] }));
        if (i < pe.length - 1) out.push({ etapa: p.id, ind: 0, partes: [], cadeia: [p.id] });
      });
      return out;
    }
    const vis = new Set();
    const rec = (id, base, cadeia) => {
      const p = porId[id];
      if (!p || vis.has(id)) return;
      vis.add(id);
      for (const l of p.htmlP.linhas) {
        const marca = l.partes.find(x => x.k === "m");
        if (marca) { (marca.v === "BODY" ? estrutura.corpo : [marca.v.slice(1)]).forEach(f => rec(f, base + l.ind, [...cadeia, f])); continue; }
        out.push({ etapa: id, ind: base + l.ind, partes: l.partes, cadeia });
      }
    };
    if (estrutura.raiz !== null) rec(estrutura.raiz, 0, [estrutura.raiz]);
    else pe.forEach(p => rec(p.id, 0, [p.id]));
    return out;
  }
  const cacheLinhas = {};
  const linhasDe = (tipo) => (cacheLinhas[tipo] ||= linhasModelo(tipo));
  function tituloEtapa(id) { const i = pe.findIndex(p => p.id === id); return `Etapa ${i + 1}${pe[i]?.etapa?.titulo ? " · " + pe[i].etapa.titulo : ""}`; }
  function htmlSlot(parte, ativa) {
    const v = String(st.slots[parte.id] ?? "");
    const cheio = !!v.trim();
    const titulo = escHtml(parte.ph || "espaço");
    if (modo === "completar") {
      if (!ativa) return `<button type="button" class="bweb-slot inativo${cheio ? " cheio" : ""}" data-slot="${escHtml(parte.id)}" data-ir="1" title="${titulo}">${cheio ? escHtml(v) : "[ " + titulo + " ]"}</button>`;
      const larg = Math.min(90, Math.max((parte.ph || "").length + 4, v.length + 2, 8));
      return `<input type="text" class="bweb-in${cheio ? " cheio" : ""}" data-slot="${escHtml(parte.id)}" data-campo-resposta value="${escHtml(v)}" placeholder="${titulo}" title="${titulo}"`
        + ` style="width:${larg}ch" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="${titulo}"${ro ? " readonly" : ""}>`;
    }
    const sel = st.slotSel === parte.id ? " sel" : "";
    if (!ativa) return `<button type="button" class="bweb-slot inativo${cheio ? " cheio" : ""}" data-slot="${escHtml(parte.id)}" data-ir="1" title="${titulo}">${cheio ? escHtml(v) : "[ " + titulo + " ]"}</button>`;
    if (cheio) return `<button type="button" class="bweb-slot cheio${sel}" data-slot="${escHtml(parte.id)}" title="${titulo} — clique para trocar; Delete apaga">${escHtml(v)}${ro ? "" : `<span class="x" data-tirar="${escHtml(parte.id)}" title="Tirar o comando deste espaço">×</span>`}</button>`;
    return `<button type="button" class="bweb-slot${sel}" data-slot="${escHtml(parte.id)}" title="Espaço: ${titulo}">[ ${titulo} ]</button>`;
  }
  function htmlLinha(l, tipo, ativa) {
    const estado = { dentro: l.ind > 0 };
    return l.partes.map(p => {
      if (p.k === "t") return tipo === "css" ? realcarCss(p.v, estado) : realcarHtml(p.v);
      if (p.k === "s") return htmlSlot(p, ativa);
      if (p.k === "c") { const f = fechamentoDe(st.slots[p.id]); return `<span class="bweb-fecha${f ? "" : " vazio"}" data-fecha="${escHtml(p.id)}">${escHtml(f || "</…>")}</span>`; }
      return "";
    }).join("");
  }
  function renderModelo(container, caminho) {
    const tipo = caminho === arqCss ? "css" : "html";
    const linhas = linhasDe(tipo);
    const cur = etapaAtual()?.id;
    const anc = tipo === "html" ? ancestraisDe(cur) : new Set();
    let h = "", n = 0, i = 0;
    while (i < linhas.length) {
      const l = linhas[i];
      const visivel = l.etapa === cur || anc.has(l.etapa);
      if (visivel) {
        n++;
        h += `<div class="bweb-l${l.etapa === cur ? " atual" : " anc"}" data-etapa="${escHtml(l.etapa)}"><span class="n">${n}</span><span class="t" style="padding-left:${l.ind * 2}ch">${htmlLinha(l, tipo, l.etapa === cur)}</span></div>`;
        i++;
        continue;
      }
      // dobra: linhas seguidas da mesma etapa "de fora" (a mais externa que não está visível)
      const chave = l.cadeia.find(e => e !== cur && !anc.has(e)) || l.etapa;
      const ini = n + 1;
      let j = i;
      while (j < linhas.length && !(linhas[j].etapa === cur || anc.has(linhas[j].etapa)) && (linhas[j].cadeia.find(e => e !== cur && !anc.has(e)) || linhas[j].etapa) === chave) j++;
      const qtd = j - i, ind = l.ind;
      n += qtd;
      if (linhas.slice(i, j).every(x => !x.partes.length)) { for (let k = 0; k < qtd; k++) h += `<div class="bweb-l anc"><span class="n">${ini + k}</span><span class="t"></span></div>`; i = j; continue; }
      h += `<button type="button" class="bweb-dobra" data-ir-etapa="${escHtml(chave)}" title="Abrir ${escHtml(tituloEtapa(chave))}"><span class="n">${ini}</span><span style="padding-left:${ind * 2}ch">⋯ ${escHtml(tituloEtapa(chave))} — ${qtd} linha${qtd > 1 ? "s" : ""} (clique para abrir)</span></button>`;
      i = j;
    }
    container.innerHTML = h;
  }
  function rolarParaEtapa(focar) {
    const cod = el.editor.querySelector(".bweb-cod");
    if (!cod) return;
    const alvo = cod.querySelector(".bweb-l.atual");
    if (alvo) cod.scrollTop = Math.max(0, alvo.offsetTop - 40);
    if (focar) cod.querySelector(".bweb-l.atual [data-slot]")?.focus();
  }
  function slotsDaEtapaNoArquivo(tipo) { const p = etapaAtual(); return p ? (tipo === "css" ? p.cssP.slots : p.htmlP.slots) : []; }
  function tipoAbaAtual() { const a = abaAtual(); return a?.tipo === "arq" ? (a.caminho === arqCss ? "css" : a.caminho === arqHtml ? "html" : null) : null; }
  function encaixar(slotId, texto) {
    if (ro) return;
    st.slots[slotId] = texto;
    // próximo espaço vazio da etapa neste arquivo
    const lista = slotsDaEtapaNoArquivo(tipoAbaAtual());
    const i = lista.findIndex(s => s.id === slotId);
    const prox = [...lista.slice(i + 1), ...lista.slice(0, Math.max(0, i))].find(s => !String(st.slots[s.id] ?? "").trim());
    st.slotSel = prox ? prox.id : null;
    renderEditorPreservando(prox ? prox.id : slotId);
    mudou();
    if (st.visao === "etapas") renderLado();
  }
  function tirar(slotId) {
    if (ro) return;
    delete st.slots[slotId];
    st.slotSel = slotId;
    renderEditorPreservando(slotId);
    mudou();
    if (st.visao === "etapas") renderLado();
  }
  function renderEditorPreservando(focoSlot) {
    const cod = el.editor.querySelector(".bweb-cod");
    const top = cod ? cod.scrollTop : 0;
    const tinhaFoco = raiz.contains(document.activeElement) && document.activeElement.closest?.(".bweb-cod");
    renderEditor();
    const novo = el.editor.querySelector(".bweb-cod");
    if (novo) novo.scrollTop = top;
    if (focoSlot && tinhaFoco) novo?.querySelector(`[data-slot="${CSS.escape(focoSlot)}"]`)?.focus({ preventScroll: true });
    const s = focoSlot && novo?.querySelector(`[data-slot="${CSS.escape(focoSlot)}"]`);
    if (s && novo) { const r = s.getBoundingClientRect(), rc = novo.getBoundingClientRect(); if (r.top < rc.top + 10 || r.bottom > rc.bottom - 10) novo.scrollTop += r.top - rc.top - rc.height / 3; }
  }

  // ---------- editores de texto (livre) ----------
  const editores = new Map();
  function criarEditor(caminho) {
    const ed = document.createElement("div");
    ed.className = "bweb-ed";
    ed.innerHTML = `<div class="bweb-num" aria-hidden="true">1</div><div class="bweb-area"><pre aria-hidden="true"></pre>`
      + `<textarea data-campo-resposta autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" wrap="off" aria-label="Editor de ${escHtml(caminho)}"${ro ? " readonly" : ""}></textarea></div>`;
    const o = { el: ed, ta: ed.querySelector("textarea"), pre: ed.querySelector("pre"), num: ed.querySelector(".bweb-num"), caminho, nLinhas: 0 };
    o.ta.value = st.arquivos[caminho] ?? "";
    const sincronizar = () => {
      o.pre.style.right = (o.ta.offsetWidth - o.ta.clientWidth) + "px";
      o.pre.style.bottom = (o.ta.offsetHeight - o.ta.clientHeight) + "px";
      o.pre.scrollTop = o.ta.scrollTop; o.pre.scrollLeft = o.ta.scrollLeft; o.num.scrollTop = o.ta.scrollTop;
    };
    o.atualizar = () => {
      const v = o.ta.value, e = extDe(o.caminho);
      o.pre.innerHTML = (e === "css" ? realcarCss(v) : e === "html" || e === "htm" ? realcarHtml(v) : escHtml(v)) + "\n ";
      const n = v.split("\n").length;
      if (n !== o.nLinhas) { o.nLinhas = n; o.num.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n"); }
      sincronizar();
    };
    o.sincronizar = sincronizar;
    o.ta.addEventListener("input", () => {
      st.arquivos[o.caminho] = o.ta.value;
      o.atualizar();
      mudou();
    });
    o.ta.addEventListener("scroll", sincronizar);
    const cursor = () => { const antes = o.ta.value.slice(0, o.ta.selectionStart); const ln = antes.split("\n").length; st.cursor = { ln, col: antes.length - antes.lastIndexOf("\n") }; renderStatus(); };
    o.ta.addEventListener("keyup", cursor);
    o.ta.addEventListener("click", cursor);
    o.ta.addEventListener("keydown", ev => {
      if (o.ta.readOnly || ev.ctrlKey || ev.altKey || ev.metaKey) return;
      if (ev.key === "Tab" && !ev.shiftKey) { ev.preventDefault(); inserirTexto(o.ta, "  "); return; }
      if (ev.key === "Enter" && !ev.shiftKey) {
        const antes = o.ta.value.slice(0, o.ta.selectionStart);
        const linha = antes.slice(antes.lastIndexOf("\n") + 1);
        let ind = linha.match(/^[ \t]*/)[0];
        const tag = linha.match(/<([a-zA-Z][\w-]*)(?:\s[^<>]*)?>\s*$/);
        if (/\{\s*$/.test(linha) || (tag && !VAZIAS.has(tag[1].toLowerCase()) && !new RegExp("</" + tag[1] + "\\s*>\\s*$", "i").test(linha))) ind += "  ";
        if (ind) { ev.preventDefault(); inserirTexto(o.ta, "\n" + ind); }
      }
    });
    o.atualizar();
    return o;
  }
  function inserirTexto(ta, txt) {
    ta.focus();
    let ok = false;
    try { ok = document.execCommand && document.execCommand("insertText", false, txt); } catch { ok = false; }
    if (!ok) { ta.setRangeText(txt, ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input", { bubbles: true })); }
  }

  // ---------- render do editor ----------
  function renderEditor() {
    const a = abaAtual();
    // esconde tudo, mostra só o da aba
    for (const o of editores.values()) o.el.hidden = true;
    el.editor.querySelectorAll(":scope > :not(.bweb-ed)").forEach(n => n.remove());
    if (!a) { el.editor.insertAdjacentHTML("beforeend", `<div class="bweb-vazio">Nenhum arquivo aberto.</div>`); return; }
    if (a.tipo === "img") {
      el.editor.insertAdjacentHTML("beforeend", `<div class="bweb-img"><img src="${escHtml(base + a.caminho)}" alt="${escHtml(a.caminho)}"><span>${escHtml(a.caminho)} · imagem da prova (somente leitura)</span></div>`);
      const img = el.editor.querySelector(".bweb-img img");
      img.addEventListener("load", () => { const s = el.editor.querySelector(".bweb-img span"); if (s) s.textContent = `${a.caminho} · ${img.naturalWidth} × ${img.naturalHeight} px · imagem da prova (somente leitura)`; });
      img.draggable = false;
      return;
    }
    if (a.tipo === "diff") {
      const atual = textosAtuais()[a.caminho], antes = git.headConteudo[a.caminho];
      let h;
      if (atual == null && antes == null) h = `<div class="info">Sem alterações.</div>`;
      else if (antes === undefined && a.caminho in git.head) h = `<div class="info">O conteúdo do último commit deste arquivo não está disponível nesta sessão (a página foi recarregada). O arquivo está marcado como alterado.</div>`;
      else {
        const d = diferenca(antes ?? "", atual ?? "");
        if (!d) h = `<div class="info">Arquivo grande demais para comparar.</div>`;
        else h = d.map(x => `<div class="${x.t === "+" ? "mais" : x.t === "-" ? "menos" : ""}"><span class="n">${x.a ?? ""} ${x.b ?? ""}</span>${x.t} ${escHtml(x.v)}</div>`).join("");
      }
      el.editor.insertAdjacentHTML("beforeend", `<div class="bweb-diff">${h}</div>`);
      return;
    }
    if (modo !== "livre") {
      const cod = document.createElement("div");
      cod.className = "bweb-cod";
      cod.setAttribute("role", "group");
      cod.setAttribute("aria-label", `Código de ${a.caminho}`);
      el.editor.appendChild(cod);
      renderModelo(cod, a.caminho);
      return;
    }
    let o = editores.get(a.caminho);
    if (!o) { o = criarEditor(a.caminho); editores.set(a.caminho, o); el.editor.appendChild(o.el); }
    o.el.hidden = false;
    o.atualizar();
  }
  // eventos do editor de modelos
  el.editor.addEventListener("click", ev => {
    const dobra = ev.target.closest("[data-ir-etapa]");
    if (dobra) { const i = pe.findIndex(p => p.id === dobra.dataset.irEtapa); if (i >= 0) irEtapa(i); return; }
    const x = ev.target.closest("[data-tirar]");
    if (x && !ro) { ev.stopPropagation(); tirar(x.dataset.tirar); return; }
    const s = ev.target.closest("[data-slot]");
    if (!s) return;
    if (s.dataset.ir) {
      const id = s.dataset.slot;
      const i = pe.findIndex(p => p.slots.some(z => z.id === id));
      if (i >= 0) { irEtapa(i); if (modo === "blocos") { st.slotSel = id; renderEditorPreservando(id); } else el.editor.querySelector(`input[data-slot="${CSS.escape(id)}"]`)?.focus(); }
      return;
    }
    if (modo === "blocos" && !ro) { st.slotSel = st.slotSel === s.dataset.slot ? null : s.dataset.slot; renderEditorPreservando(s.dataset.slot); if (st.painel !== "comandos") { st.painel = "comandos"; st.painelAberto = true; renderPainel(); } }
  });
  el.editor.addEventListener("keydown", ev => {
    const s = ev.target.closest?.("button[data-slot]");
    if (s && modo === "blocos" && !ro && !s.dataset.ir && (ev.key === "Delete" || ev.key === "Backspace")) { ev.preventDefault(); tirar(s.dataset.slot); return; }
    const inp = ev.target.closest?.("input[data-slot]");
    if (inp && ev.key === "Enter") {
      ev.preventDefault();
      const todos = [...el.editor.querySelectorAll("input[data-slot]")];
      const prox = todos[todos.indexOf(inp) + 1];
      if (prox) prox.focus();
    }
  });
  el.editor.addEventListener("input", ev => {
    const inp = ev.target.closest?.("input[data-slot]");
    if (!inp || ro) return;
    const id = inp.dataset.slot;
    st.slots[id] = inp.value;
    if (!inp.value.trim()) delete st.slots[id];
    inp.classList.toggle("cheio", !!inp.value.trim());
    const p = pe.flatMap(x => x.slots).find(z => z.id === id);
    inp.style.width = Math.min(90, Math.max((p?.ph || "").length + 4, inp.value.length + 2, 8)) + "ch";
    el.editor.querySelectorAll(`[data-fecha="${CSS.escape(id)}"]`).forEach(f => { const t = fechamentoDe(inp.value); f.textContent = t || "</…>"; f.classList.toggle("vazio", !t); });
    mudou();
    if (st.visao === "etapas") atualizarProgressoLado();
  });

  // ---------- painel inferior ----------
  const blocos = (() => {
    const cats = questao.categorias || {};
    const tipoCat = {};
    (cats.html || []).forEach(c => { tipoCat[c.id] = "html"; });
    (cats.css || []).forEach(c => { tipoCat[c.id] = "css"; });
    const out = [];
    for (const [cat, lista] of Object.entries(questao.blocos || {})) {
      const tipo = tipoCat[cat] || (/^h/i.test(cat) ? "html" : "css");
      (Array.isArray(lista) ? lista : []).forEach(t => out.push({ texto: String(t), cat, tipo }));
    }
    out.forEach((b, i) => { b.i = i; });
    return out;
  })();
  const nomesCat = Object.fromEntries([...(questao.categorias?.html || []), ...(questao.categorias?.css || [])].map(c => [c.id, c.nome]));
  const abasPainel = () => [
    ...(modo === "blocos" ? [["comandos", "Comandos HTML/CSS"]] : []),
    ["problemas", "Problemas"], ["saida", "Saída"],
    ...(comGit ? [["terminal", "Terminal"]] : [])
  ];
  function listaProblemas() {
    if (modo !== "livre") {
      return pe.map((p, i) => ({ p, i, ...contagemEtapa(p) })).filter(x => x.tot && x.cheios < x.tot)
        .map(x => ({ nivel: "info", etapa: x.i, msg: `Etapa ${x.i + 1}: ${x.tot - x.cheios} de ${x.tot} espaço${x.tot - x.cheios > 1 ? "s" : ""} ainda vazio${x.tot - x.cheios > 1 ? "s" : ""}` }));
    }
    const out = [];
    for (const [c, v] of Object.entries(st.arquivos)) {
      const e = extDe(c);
      if (e === "html" || e === "htm") out.push(...problemasHtml(c, v, existeNoProjeto));
      else if (e === "css") out.push(...problemasCss(c, v));
    }
    return out;
  }
  function atualizarContPainel() {
    const n = listaProblemas().length;
    const c = el.pabas.querySelector('[data-pa="problemas"] .cont');
    if (c) c.textContent = n;
  }
  function renderPainel() {
    const ab = abasPainel();
    if (!ab.some(([k]) => k === st.painel)) st.painel = ab[0][0];
    const probs = listaProblemas();
    el.pabas.innerHTML = ab.map(([k, rot]) => `<button type="button" class="bweb-pa" role="tab" data-pa="${k}" aria-selected="${st.painel === k}">${rot}${k === "problemas" ? ` <span class="cont">${probs.length}</span>` : ""}</button>`).join("")
      + `<span class="esp"></span><button type="button" class="bweb-ic" data-acao="painel" title="${st.painelAberto ? "Minimizar o painel" : "Abrir o painel"}">${st.painelAberto ? "▾" : "▴"}</button>`;
    el.painel.classList.toggle("fechado", !st.painelAberto);
    if (!st.painelAberto) return;
    const c = el.pcorpo;
    if (st.painel === "comandos") { renderBanco(); return; }
    if (st.painel === "problemas") {
      c.innerHTML = probs.length ? `<ul class="bweb-lista-prob">${probs.map((p, i) => `<li data-prob="${i}"><span class="ic">${p.nivel === "erro" ? "⛔" : p.nivel === "aviso" ? "⚠️" : "ℹ️"}</span><span>${escHtml(p.msg)}</span>${p.arquivo ? `<span class="onde">${escHtml(p.arquivo)} [Ln ${p.linha}]</span>` : ""}</li>`).join("")}</ul>`
        : `<div class="bweb-vazio">${modo === "livre" ? "Nenhum problema encontrado no código." : "Todos os espaços estão preenchidos."}</div>`;
      c._probs = probs;
      return;
    }
    if (st.painel === "saida") {
      c.innerHTML = `<div class="bweb-saida">${st.saida.length ? st.saida.map(s => `<span class="h">[${hora(s.t)}]</span> ${escHtml(s.msg)}`).join("\n") : '<span class="h">Nada por enquanto.</span>'}</div>`;
      c.scrollTop = c.scrollHeight;
      return;
    }
    if (st.painel === "terminal") renderTerminal();
  }
  el.pabas.addEventListener("click", ev => {
    const b = ev.target.closest("[data-pa]");
    if (b) { st.painel = b.dataset.pa; st.painelAberto = true; renderPainel(); if (st.painel === "terminal") el.pcorpo.querySelector("input")?.focus(); return; }
    if (ev.target.closest('[data-acao="painel"]')) { st.painelAberto = !st.painelAberto; renderPainel(); }
  });
  el.pcorpo.addEventListener("click", ev => {
    const li = ev.target.closest("[data-prob]");
    if (li) {
      const p = el.pcorpo._probs?.[Number(li.dataset.prob)];
      if (!p) return;
      if (p.etapa !== undefined) { irEtapa(p.etapa, { focar: true }); return; }
      if (p.arquivo) { abrir(p.arquivo); irParaLinha(p.arquivo, p.linha); }
      return;
    }
    if (st.painel === "terminal" && !ev.target.closest("input") && !window.getSelection()?.toString()) el.pcorpo.querySelector(".bweb-term input")?.focus();
  });
  function irParaLinha(caminho, linha) {
    const o = editores.get(caminho);
    if (!o) return;
    const linhas = o.ta.value.split("\n");
    const pos = linhas.slice(0, Math.max(0, linha - 1)).reduce((s, l) => s + l.length + 1, 0);
    o.ta.focus();
    o.ta.setSelectionRange(pos, pos);
    o.ta.scrollTop = Math.max(0, (linha - 4) * 21);
    o.sincronizar();
  }

  // banco de blocos
  function renderBanco() {
    const tipo = tipoAbaAtual() || "html";
    const cats = (questao.categorias?.[tipo] || []).map(c => c.id).filter(id => blocos.some(b => b.cat === id));
    if (st.filtroCat !== "todas" && !cats.includes(st.filtroCat)) st.filtroCat = "todas";
    const termo = st.filtroTxt.trim().toLowerCase();
    let lista = blocos.filter(b => b.tipo === tipo && (st.filtroCat === "todas" || b.cat === st.filtroCat) && (!termo || b.texto.toLowerCase().includes(termo)));
    const grupos = new Map();
    for (const b of lista.sort((a, z) => a.texto.localeCompare(z.texto, "pt-BR"))) { if (!grupos.has(b.cat)) grupos.set(b.cat, []); grupos.get(b.cat).push(b); }
    const ordem = [...cats, ...[...grupos.keys()].filter(k => !cats.includes(k))];
    const alvo = st.slotSel ? (pe.flatMap(p => p.slots).find(s => s.id === st.slotSel)?.ph || "") : "";
    const info = ro ? "" : st.slotSel ? `Espaço selecionado: <b>${escHtml(alvo)}</b>` : "Clique num comando para encaixar no próximo espaço vazio";
    const qtd = (id) => blocos.filter(b => b.tipo === tipo && (id === "todas" || b.cat === id)).length;
    const barraHtml = `<div class="bweb-banco-barra" role="group" aria-label="Divisões de comandos">
        <input type="text" class="bweb-filtro" data-r="filtro" placeholder="🔍 Filtrar (flex, img…)" value="${escHtml(st.filtroTxt)}" data-campo-resposta autocomplete="off" spellcheck="false" aria-label="Filtrar comandos">
        <button type="button" class="bweb-chip" data-cat="todas" aria-pressed="${st.filtroCat === "todas"}">Todas <span class="q">${qtd("todas")}</span></button>
        ${cats.map(id => `<button type="button" class="bweb-chip" data-cat="${escHtml(id)}" aria-pressed="${st.filtroCat === id}" title="${escHtml(nomesCat[id] || id)}">${escHtml(nomesCat[id] || id)} <span class="q">${qtd(id)}</span></button>`).join("")}
      </div>`;
    const listaHtml = `<div class="bweb-blocos" data-r="blocos">${ordem.filter(k => grupos.has(k)).map(k => `<div class="bweb-grupo"><h5>${escHtml(nomesCat[k] || k)} · ${tipo === "css" ? "CSS" : "HTML"}</h5><div class="lista">${grupos.get(k).map(b => `<button type="button" class="bweb-bloco ${b.tipo}" data-b="${b.i}"${ro ? " disabled" : ""}>${escHtml(b.texto)}</button>`).join("")}</div></div>`).join("") || `<div class="bweb-vazio">Nenhum comando ${termo ? "com esse filtro" : "para este arquivo"}.</div>`}</div>`;
    const existente = el.pcorpo.querySelector(".bweb-banco");
    if (existente && existente.dataset.tipo === tipo && raiz.contains(document.activeElement) && document.activeElement.dataset?.r === "filtro") {
      // não recria o campo de filtro enquanto o aluno digita
      existente.querySelector('[data-r="blocos"]').outerHTML = listaHtml;
      existente.querySelector('[data-r="bancoinfo"]').innerHTML = info;
      existente.querySelectorAll("[data-cat]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cat === st.filtroCat)));
      return;
    }
    el.pcorpo.innerHTML = `<div class="bweb-banco" data-tipo="${tipo}">${barraHtml}<div class="bweb-banco-dir"><div class="bweb-banco-info" data-r="bancoinfo">${info}</div>${listaHtml}</div></div>`;
  }
  el.pcorpo.addEventListener("input", ev => { if (ev.target.dataset?.r === "filtro") { st.filtroTxt = ev.target.value; renderBanco(); } });
  el.pcorpo.addEventListener("click", ev => {
    const c = ev.target.closest("[data-cat]");
    if (c) { st.filtroCat = c.dataset.cat; renderBanco(); return; }
    const b = ev.target.closest("[data-b]");
    if (b && !ro) {
      if (arrastou) { arrastou = false; return; }
      usarBloco(blocos[Number(b.dataset.b)]);
    }
  });
  function usarBloco(b) {
    if (!b || ro) return;
    const tipo = tipoAbaAtual();
    if (!tipo) return;
    let alvo = st.slotSel && slotsDaEtapaNoArquivo(tipo).some(s => s.id === st.slotSel) ? st.slotSel : null;
    if (!alvo) alvo = slotsDaEtapaNoArquivo(tipo).find(s => !String(st.slots[s.id] ?? "").trim())?.id || null;
    if (!alvo) { log(`Todos os espaços da ${tituloEtapa(etapaAtual()?.id)} em ${tipo === "css" ? arqCss : arqHtml} já têm comando. Clique num espaço para trocar o comando dele.`); flashInfo("Todos os espaços desta etapa neste arquivo já estão preenchidos. Clique num espaço para trocá-lo."); return; }
    encaixar(alvo, b.texto);
  }
  function flashInfo(msg) { const i = el.pcorpo.querySelector('[data-r="bancoinfo"]'); if (i) { i.textContent = msg; i.style.color = "#a00d25"; setTimeout(() => { if (i.isConnected) { i.style.color = ""; } }, 2500); } }

  // arrastar com o ponteiro (sem o drag & drop nativo, que a prova bloqueia)
  let arrastou = false, arr = null;
  el.pcorpo.addEventListener("pointerdown", ev => {
    const b = ev.target.closest("[data-b]");
    if (!b || ro || ev.button !== 0) return;
    ev.preventDefault();   // não começa seleção de texto na página
    arr = { b, x: ev.clientX, y: ev.clientY, fantasma: null, id: ev.pointerId, alvo: null };
    arrastou = false;
  });
  const aoMover = (ev) => {
    if (!arr || ev.pointerId !== arr.id) return;
    if (!arr.fantasma) {
      if (Math.hypot(ev.clientX - arr.x, ev.clientY - arr.y) < 6) return;
      arr.fantasma = document.createElement("div");
      arr.fantasma.className = "bweb-fantasma";
      arr.fantasma.textContent = blocos[Number(arr.b.dataset.b)]?.texto || "";
      document.body.appendChild(arr.fantasma);
      try { arr.b.setPointerCapture(ev.pointerId); } catch { /* */ }
    }
    ev.preventDefault();
    arr.fantasma.style.left = ev.clientX + 12 + "px";
    arr.fantasma.style.top = ev.clientY + 10 + "px";
    const sob = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.(".bweb-cod button[data-slot]:not([data-ir])");
    if (arr.alvo && arr.alvo !== sob) arr.alvo.classList.remove("alvo");
    arr.alvo = sob && raiz.contains(sob) ? sob : null;
    arr.alvo?.classList.add("alvo");
  };
  const aoSoltar = (ev) => {
    if (!arr || ev.pointerId !== arr.id) return;
    const a = arr;
    arr = null;
    if (!a.fantasma) return;
    a.fantasma.remove();
    arrastou = true;
    setTimeout(() => { arrastou = false; }, 50);
    a.alvo?.classList.remove("alvo");
    if (a.alvo && ev.type === "pointerup") encaixar(a.alvo.dataset.slot, blocos[Number(a.b.dataset.b)]?.texto || "");
  };
  document.addEventListener("pointermove", aoMover, { passive: false });
  document.addEventListener("pointerup", aoSoltar);
  document.addEventListener("pointercancel", aoSoltar);

  // terminal (git)
  const promptHtml = () => `<span class="pr">aluno@prova</span>:<span class="dir">~/${escHtml(repo)}</span> <span class="am">(main)</span>$`;
  function termEscrever(txt, cls = "") { st.term.push({ txt, cls }); if (st.term.length > 300) st.term.shift(); }
  function renderTerminal() {
    const ativo = document.activeElement?.dataset?.r === "term";
    el.pcorpo.innerHTML = `<div class="bweb-term"><div class="linhas">${st.term.map(l => l.html ?? `<span class="${l.cls}">${escHtml(l.txt)}</span>`).join("\n")}</div>`
      + `<div class="entrada">${promptHtml()}<input type="text" data-r="term" data-campo-resposta autocomplete="off" spellcheck="false" aria-label="Terminal (comandos git)"${ro ? " disabled" : ""}></div></div>`;
    el.pcorpo.scrollTop = el.pcorpo.scrollHeight;
    if (ativo) el.pcorpo.querySelector('[data-r="term"]')?.focus();
  }
  el.pcorpo.addEventListener("keydown", ev => {
    const inp = ev.target.closest?.('[data-r="term"]');
    if (!inp) return;
    if (ev.key === "Enter") {
      ev.preventDefault();
      const cmd = inp.value;
      st.term.push({ html: `${promptHtml()} ${escHtml(cmd)}` });
      if (cmd.trim()) { st.termHist.push(cmd); st.termPos = st.termHist.length; }
      executarTerminal(cmd.trim());
      renderTerminal();
      el.pcorpo.querySelector('[data-r="term"]')?.focus();
    } else if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      if (!st.termHist.length) return;
      ev.preventDefault();
      st.termPos = Math.max(0, Math.min(st.termHist.length, st.termPos + (ev.key === "ArrowUp" ? -1 : 1)));
      inp.value = st.termHist[st.termPos] ?? "";
    }
  });
  function argsDe(cmd) { const out = []; const re = /"([^"]*)"|'([^']*)'|(\S+)/g; let m; while ((m = re.exec(cmd))) out.push(m[1] ?? m[2] ?? m[3]); return out; }
  function executarTerminal(cmd) {
    if (!cmd) return;
    const a = argsDe(cmd);
    if (a[0] === "clear" || a[0] === "cls") { st.term = []; return; }
    if (a[0] === "help" || a[0] === "ajuda") { termEscrever("Comandos: git status · git add <arquivo> | git add . · git restore --staged <arquivo> · git commit -m \"mensagem\" · git push · git log [--oneline] · git branch · git remote -v · ls · pwd · clear"); return; }
    if (a[0] === "pwd") { termEscrever(`/home/aluno/${repo}`); return; }
    if (a[0] === "ls" || a[0] === "dir") { termEscrever([...new Set([...Object.keys(textosAtuais()), ...assets].map(p => p.split("/")[0] + (p.includes("/") ? "/" : "")))].sort().join("  ")); return; }
    if (a[0] !== "git") { termEscrever(`${a[0]}: comando não encontrado (digite help)`, "er"); return; }
    if (ro) return;
    const sub = a[1];
    const mud = mudancasGit();
    if (!sub) { termEscrever("uso: git <comando> [<args>]   (digite help)"); return; }
    if (sub === "init") { termEscrever(`Repositório Git existente reinicializado em /home/aluno/${repo}/.git/`); return; }
    if (sub === "status") {
      const n = aFrente();
      termEscrever("No ramo main");
      termEscrever(n ? `Seu ramo está à frente de 'origin/main' por ${n} commit${n > 1 ? "s" : ""}.\n  (use "git push" para publicar seus commits locais)` : "Seu ramo está atualizado com 'origin/main'.");
      const prep = mud.filter(m => git.stage.has(m.caminho)), nao = mud.filter(m => !git.stage.has(m.caminho));
      const rot = { M: "modificado:", A: "novo arquivo:", D: "removido:" };
      if (prep.length) { termEscrever("\nMudanças a serem submetidas:\n  (use \"git restore --staged <arquivo>...\" para retirar do stage)"); prep.forEach(m => termEscrever(`\t${rot[m.st]}   ${m.caminho}`, "ok")); }
      if (nao.length) { termEscrever("\nMudanças não preparadas para commit:\n  (use \"git add <arquivo>...\" para preparar)"); nao.forEach(m => termEscrever(`\t${rot[m.st]}   ${m.caminho}`, "er")); }
      if (!mud.length) termEscrever("\nnada para enviar, árvore de trabalho limpa");
      return;
    }
    if (sub === "add") {
      const alvos = a.slice(2);
      if (!alvos.length) { termEscrever("Nada especificado, nada adicionado.\nDica: talvez você quisesse dizer 'git add .'?", "am"); return; }
      let n = 0;
      for (const alvo of alvos) {
        const lim = alvo.replace(/^\.\//, "");
        const sel = alvo === "." || alvo === "-A" || alvo === "--all" ? mud : mud.filter(m => m.caminho === lim || m.caminho.startsWith(lim.replace(/\/?$/, "/")));
        if (!sel.length && alvo !== "." && alvo !== "-A" && alvo !== "--all") { termEscrever(`fatal: o caminho '${alvo}' não corresponde a nenhum arquivo alterado`, "er"); continue; }
        sel.forEach(m => { git.stage.add(m.caminho); n++; });
      }
      if (n) mudou({ previa: false, codigo: false });
      return;
    }
    if (sub === "restore" || sub === "reset") {
      const alvos = a.slice(2).filter(x => x !== "--staged" && x !== "HEAD");
      if (sub === "restore" && !a.includes("--staged")) { termEscrever("Nesta prova o 'git restore' só tira arquivos do stage: use git restore --staged <arquivo>.", "am"); return; }
      (alvos.length ? alvos : [...git.stage]).forEach(x => git.stage.delete(x.replace(/^\.\//, "")));
      if (alvos.includes(".")) git.stage.clear();
      mudou({ previa: false, codigo: false });
      return;
    }
    if (sub === "commit") {
      const i = a.findIndex(x => x === "-m" || x === "-am" || x === "-a");
      const msg = a.includes("-m") ? a[a.indexOf("-m") + 1] : a.includes("-am") ? a[a.indexOf("-am") + 1] : "";
      if (a.includes("-a") || a.includes("-am")) mud.filter(m => m.st !== "A").forEach(m => git.stage.add(m.caminho));
      if (i < 0 || !msg) { termEscrever("Use: git commit -m \"mensagem do commit\"", "am"); return; }
      if (!mud.some(m => git.stage.has(m.caminho))) { termEscrever(mud.length ? "nenhuma mudança adicionada ao commit (use \"git add\")" : "nada para enviar, árvore de trabalho limpa", "am"); return; }
      const r = fazerCommit(msg);
      if (r.erro) { termEscrever(r.erro, "er"); return; }
      termEscrever(`[main ${r.commit.id}] ${r.commit.msg}\n ${r.n} arquivo${r.n > 1 ? "s" : ""} alterado${r.n > 1 ? "s" : ""}`);
      log(`git commit ${r.commit.id}: ${r.commit.msg}`);
      depoisDoGit();
      return;
    }
    if (sub === "push") {
      const r = fazerPush();
      if (r.nada) { termEscrever("Everything up-to-date"); return; }
      termEscrever(`Enumerando objetos... pronto.\nPara github.com:turma/${repo}.git\n   ${r.de}..${r.para}  main -> main`);
      log(`git push: ${r.n} commit(s) enviados para origin/main`);
      depoisDoGit();
      return;
    }
    if (sub === "pull" || sub === "fetch") { termEscrever("Já está atualizado."); return; }
    if (sub === "log") {
      const lista = [...git.commits].reverse();
      const linhas = lista.map(c => a.includes("--oneline") ? `${c.id} ${c.id === ultimoCommit() ? "(HEAD -> main" + (c.id === git.remoto ? ", origin/main" : "") + ") " : c.id === git.remoto ? "(origin/main) " : ""}${c.msg}`
        : `commit ${c.id}${c.id === ultimoCommit() ? " (HEAD -> main" + (c.id === git.remoto ? ", origin/main" : "") + ")" : c.id === git.remoto ? " (origin/main)" : ""}\nData:   ${new Date(c.em).toLocaleString("pt-BR")}\n\n    ${c.msg}\n`);
      linhas.push(a.includes("--oneline") ? `${idInicial} ${git.remoto === idInicial && !git.commits.length ? "(HEAD -> main, origin/main) " : git.remoto === idInicial ? "(origin/main) " : ""}Commit inicial (arquivos da prova)` : `commit ${idInicial}${git.remoto === idInicial ? " (origin/main)" : ""}\n\n    Commit inicial (arquivos da prova)`);
      termEscrever(linhas.join("\n"));
      return;
    }
    if (sub === "branch") { termEscrever("* main"); return; }
    if (sub === "remote") { termEscrever(`origin\thttps://github.com/turma/${repo}.git (fetch)\norigin\thttps://github.com/turma/${repo}.git (push)`); return; }
    if (sub === "diff") { mud.forEach(m => termEscrever(`${m.st}\t${m.caminho}`)); if (!mud.length) termEscrever("(sem diferenças)"); return; }
    termEscrever(`git: '${sub}' não é um comando disponível nesta prova. Digite help.`, "er");
  }
  function depoisDoGit() { mudou({ previa: false, codigo: false }); renderAbas(); if (st.direita === "github") renderGithub(); }

  // ---------- barra lateral ----------
  function renderLado() {
    el.lado.hidden = !st.ladoAberto;
    raiz.querySelectorAll("[data-visao]").forEach(b => b.setAttribute("aria-pressed", String(st.ladoAberto && b.dataset.visao === st.visao)));
    if (!st.ladoAberto) return;
    const rolagem = el.lado.querySelector(".bweb-lado-corpo")?.scrollTop || 0;
    const ativo = document.activeElement;
    const foco = ativo && el.lado.contains(ativo) ? (ativo.dataset?.r || null) : null;
    if (foco === "msg" || foco === "nome") return;   // não recria o campo enquanto o aluno digita
    if (st.visao === "etapas") el.lado.innerHTML = visaoEtapas();
    else if (st.visao === "explorador") el.lado.innerHTML = visaoExplorador();
    else el.lado.innerHTML = visaoGit();
    const corpo = el.lado.querySelector(".bweb-lado-corpo");
    if (corpo) corpo.scrollTop = rolagem;
    el.lado.querySelector('[data-r="nome"]')?.focus();
  }
  function atualizarProgressoLado() {
    const p = etapaAtual(); if (!p) return;
    const box = el.lado.querySelector('[data-r="prog"]');
    if (box) box.outerHTML = progressoHtml(p);
    el.lado.querySelectorAll(".bweb-en[data-etapa-i]").forEach(b => { const q = pe[Number(b.dataset.etapaI)]; if (!q) return; const c = contagemEtapa(q); const pt = b.querySelector(".pt"); if (pt) pt.className = "pt" + (c.tot && c.cheios === c.tot ? " cheio" : c.cheios ? " meio" : ""); });
  }
  function progressoHtml(p) {
    if (modo === "livre") return `<div data-r="prog"></div>`;
    const { tot, cheios } = contagemEtapa(p);
    const pct = tot ? Math.round(cheios / tot * 100) : 0;
    return `<div class="bweb-prog" data-r="prog" aria-live="polite">${cheios === tot && tot ? "Etapa completa" : "Etapa em andamento"}: <b>${cheios} de ${tot}</b> espaços preenchidos<div class="barra"><i style="width:${pct}%"></i></div></div>`;
  }
  function visaoEtapas() {
    const p = etapaAtual();
    if (!p) return `<div class="bweb-lado-tit">Etapas</div><div class="bweb-vazio">Esta questão não tem etapas.</div>`;
    const e = p.etapa;
    const nav = pe.map((q, i) => {
      const c = contagemEtapa(q);
      const pt = modo === "livre" ? (st.vistas.has(q.id) ? " cheio" : "") : c.tot && c.cheios === c.tot ? " cheio" : c.cheios ? " meio" : "";
      return `<button type="button" class="bweb-en" data-etapa-i="${i}" ${i === st.etapa ? 'aria-current="step"' : ""} title="${escHtml(tituloEtapa(q.id))}">${i + 1}<span class="pt${pt}"></span></button>`;
    }).join("");
    const arqs = modo === "livre" && Array.isArray(e.arquivos) && e.arquivos.length
      ? `<div class="bweb-cartao"><h4>📁 Arquivos desta etapa</h4><div class="bweb-arqs-etapa">${e.arquivos.map(c => `<button type="button" class="bweb-bt" data-abrir="${escHtml(c)}">${iconeArq(c)} ${escHtml(c)}</button>`).join("")}</div></div>` : "";
    return `<div class="bweb-lado-tit">Etapas da prova<span class="esp"></span>${temModelo ? `<button type="button" class="bweb-ic" data-acao="modelo" title="Ver modelo">🖼</button>` : ""}</div>
      <div class="bweb-lado-corpo">
        <div class="bweb-etapas-nav">${nav}</div>
        <div class="bweb-etapa">
          <span class="selo">Etapa ${st.etapa + 1} de ${pe.length}${Number.isFinite(Number(e.pontos)) ? ` · ${Number(e.pontos)} pts` : ""}</span>
          <h3>${escHtml(e.titulo || "Etapa " + (st.etapa + 1))}</h3>
          ${e.enunciado ? `<p class="enun">${htmlSeguro(e.enunciado)}</p>` : ""}
          ${progressoHtml(p)}
          ${Array.isArray(e.passos) && e.passos.length ? `<div class="bweb-cartao"><h4>📋 Passo a passo</h4><ol>${e.passos.map(x => `<li>${htmlSeguro(x)}</li>`).join("")}</ol></div>` : ""}
          ${Array.isArray(e.dicas) && e.dicas.length ? `<div class="bweb-cartao"><h4>💡 Dicas</h4><ul>${e.dicas.map(x => `<li>${htmlSeguro(x)}</li>`).join("")}</ul></div>` : ""}
          ${arqs}
          <div class="bweb-etapa-pe">
            <button type="button" class="bweb-bt" data-etapa-i="${st.etapa - 1}" ${st.etapa === 0 ? "disabled" : ""}>◀ Anterior</button>
            <button type="button" class="bweb-bt" data-etapa-i="${st.etapa + 1}" ${st.etapa === pe.length - 1 ? "disabled" : ""}>Próxima ▶</button>
          </div>
        </div>
      </div>`;
  }
  function visaoExplorador() {
    const livre = modo === "livre" && !ro;
    const ferr = livre ? `<button type="button" class="bweb-ic" data-acao="novo-arq" title="Novo arquivo">📄</button><button type="button" class="bweb-ic" data-acao="nova-pasta" title="Nova pasta">📁</button>`
      + `<button type="button" class="bweb-ic" data-acao="renomear" title="Renomear o item selecionado" ${st.selExpl ? "" : "disabled"}>✎</button><button type="button" class="bweb-ic" data-acao="excluir" title="Excluir o item selecionado" ${st.selExpl ? "" : "disabled"}>🗑</button>` : "";
    const mud = comGit ? new Map(mudancasGit().map(m => [m.caminho, m.st])) : new Map();
    const textos = textosAtuais();
    const pastas = todasPastas();
    const filhos = (dir) => {
      const prefixo = dir ? dir + "/" : "";
      const subs = [...pastas].filter(p => p.startsWith(prefixo) && p !== dir && !p.slice(prefixo.length).includes("/")).sort((a, b) => a.localeCompare(b));
      const arqs = [...Object.keys(textos), ...assets].filter(p => p.startsWith(prefixo) && !p.slice(prefixo.length).includes("/")).sort((a, b) => a.localeCompare(b));
      return { subs, arqs };
    };
    const linhaNovo = (dir, nivel) => st.criando && st.criando.dir === dir
      ? `<div class="bweb-no novo" style="padding-left:${8 + nivel * 12}px"><span class="seta"></span>${st.criando.tipo === "pasta" ? `<span class="ico pasta">📁</span>` : `<span class="ico txt">≡</span>`}<input type="text" class="bweb-nome" data-r="nome" data-campo-resposta placeholder="${st.criando.tipo === "pasta" ? "nome-da-pasta" : "arquivo.html"}" autocomplete="off" spellcheck="false" aria-label="Nome do novo ${st.criando.tipo === "pasta" ? "pasta" : "arquivo"}"></div>${st.erroNome ? `<div class="bweb-erro-nome">${escHtml(st.erroNome)}</div>` : ""}` : "";
    const nomeOuInput = (c, nome) => st.renomeando === c ? `<input type="text" class="bweb-nome" data-r="nome" data-campo-resposta value="${escHtml(nome)}" autocomplete="off" spellcheck="false" aria-label="Novo nome">` : `<span class="nm">${escHtml(nome)}</span>`;
    const rec = (dir, nivel) => {
      const { subs, arqs } = filhos(dir);
      let h = linhaNovo(dir, nivel);
      for (const s of subs) {
        const aberta = !st.abertas.has("-" + s);
        h += `<div class="bweb-no${st.selExpl === s + "/" ? " sel" : ""}" data-pasta="${escHtml(s)}" tabindex="0" role="treeitem" aria-expanded="${aberta}" style="padding-left:${8 + nivel * 12}px"><span class="seta">${aberta ? "▾" : "▸"}</span><span class="ico pasta">📁</span>${nomeOuInput(s + "/", nomeDe(s))}</div>`;
        if (st.renomeando === s + "/" && st.erroNome) h += `<div class="bweb-erro-nome">${escHtml(st.erroNome)}</div>`;
        if (aberta) h += rec(s, nivel + 1);
      }
      for (const c of arqs) {
        const ehAsset = assets.includes(c) && textos[c] == null;
        const gm = mud.get(c);
        const ativo = abaAtual()?.caminho === c;
        h += `<div class="bweb-no${st.selExpl === c ? " sel" : ""}${ativo ? " ativo" : ""}" data-arq="${escHtml(c)}" tabindex="0" role="treeitem" style="padding-left:${20 + nivel * 12}px">${iconeArq(c)}${nomeOuInput(c, nomeDe(c))}`
          + `${gm ? `<span class="gm ${gm}" title="${gm === "M" ? "Modificado" : "Novo"}">${gm === "A" ? "U" : gm}</span>` : ehAsset ? `<span class="ro" title="Imagem da prova (somente leitura)">🔒</span>` : ""}</div>`;
        if (st.renomeando === c && st.erroNome) h += `<div class="bweb-erro-nome">${escHtml(st.erroNome)}</div>`;
      }
      return h;
    };
    const conf = st.excluindo ? `<div class="bweb-conf">Excluir <b>${escHtml(st.excluindo)}</b>${st.excluindo.endsWith("/") ? " e tudo que está dentro" : ""}?<div class="bt"><button type="button" class="bweb-bt prim" data-acao="excluir-sim">Excluir</button><button type="button" class="bweb-bt" data-acao="excluir-nao">Cancelar</button></div></div>` : "";
    return `<div class="bweb-lado-tit">Explorador<span class="esp"></span>${ferr}</div><div class="bweb-lado-corpo">${conf}
      <div class="bweb-no" style="padding-left:6px;font-weight:700;font-size:11px;letter-spacing:.05em;text-transform:uppercase;cursor:default" data-raiz="1"><span class="seta">▾</span>${escHtml(repo)}</div>
      <div class="bweb-arvore" role="tree">${rec("", 0)}</div>
      ${modo !== "livre" ? `<div class="bweb-vazio">Os arquivos ${escHtml(arqHtml)} e ${escHtml(arqCss)} são montados com os comandos das etapas. As imagens são da prova.</div>` : ""}
    </div>`;
  }
  function visaoGit() {
    const mud = mudancasGit();
    const prep = mud.filter(m => git.stage.has(m.caminho)), nao = mud.filter(m => !git.stage.has(m.caminho));
    const n = aFrente();
    const sg = situacaoGit(questao, { commits: git.commits, pushes: git.pushes, remoto: git.remoto });
    const ex = questao.git?.exigir || {};
    const item = (m, prep) => {
      const pasta = dirDe(m.caminho).replace(/\/$/, "");
      return `<div class="bweb-mud" data-diff="${escHtml(m.caminho)}" title="${escHtml(m.caminho)} — clique para ver as alterações">${iconeArq(m.caminho)}<span class="nm">${escHtml(nomeDe(m.caminho))}</span><span class="pasta">${escHtml(pasta)}</span><span class="esp"></span>`
        + (ro ? "" : `<button type="button" class="bweb-ic" data-${prep ? "unstage" : "stage"}="${escHtml(m.caminho)}" title="${prep ? "Tirar do stage (−)" : "Preparar para o commit (+)"}">${prep ? "−" : "+"}</button>`)
        + `<span class="gm ${m.st}">${m.st}</span></div>`;
    };
    const reqs = (ex.commits || ex.push) ? `<div class="bweb-req"><b>Pedido nesta questão</b>
        ${ex.commits ? `<div class="${sg.commits >= sg.exigidos ? "ok" : ""}">${sg.commits >= sg.exigidos ? "☑" : "☐"} Fazer pelo menos ${sg.exigidos} commit${sg.exigidos > 1 ? "s" : ""} (${Math.min(sg.commits, sg.exigidos)}/${sg.exigidos})</div>` : ""}
        ${ex.push ? `<div class="${sg.push === 1 ? "ok" : ""}">${sg.push === 1 ? "☑" : "☐"} Enviar tudo para o GitHub (push)</div>` : ""}
      </div>` : "";
    const hist = [...git.commits].reverse().map(c => `<div class="cm${c.id === git.remoto || remotoInclui(c.id) ? " remoto" : ""}"><i></i><div class="tx"><span class="m" title="${escHtml(c.msg)}">${escHtml(c.msg)}</span>`
      + `<span class="d">${c.id} · ${quando(c.em)} · ${c.arquivos.length + (c.del?.length || 0)} arquivo(s)</span>${c.id === ultimoCommit() || c.id === git.remoto ? `<span class="tags">${c.id === ultimoCommit() ? '<span class="tag">HEAD → main</span>' : ""}${c.id === git.remoto ? '<span class="tag r">origin/main</span>' : ""}</span>` : ""}</div></div>`).join("")
      + `<div class="cm remoto"><i></i><div class="tx"><span class="m">Commit inicial (arquivos da prova)</span><span class="d">${idInicial} · professor</span>${!git.commits.length || git.remoto === idInicial ? `<span class="tags">${!git.commits.length ? '<span class="tag">HEAD → main</span>' : ""}${git.remoto === idInicial ? '<span class="tag r">origin/main</span>' : ""}</span>` : ""}</div></div>`;
    return `<div class="bweb-lado-tit" title="Controle de código-fonte">Código-fonte (git)<span class="esp"></span>
        ${ro ? "" : `<button type="button" class="bweb-ic" data-acao="stage-tudo" title="Preparar todas as alterações (git add .)">+</button><button type="button" class="bweb-ic" data-acao="unstage-tudo" title="Tirar tudo do stage">−</button>`}</div>
      <div class="bweb-lado-corpo"><div class="bweb-git">
        <textarea class="bweb-msg" data-r="msg" data-campo-resposta placeholder="Mensagem do commit (ex.: Etapa 1: estrutura base)" aria-label="Mensagem do commit"${ro ? " readonly" : ""}>${escHtml(st.msgCommit || "")}</textarea>
        <div class="acoes"><button type="button" class="bweb-bt prim" data-acao="commit" ${ro || !mud.length ? "disabled" : ""} title="${prep.length ? "Commit das alterações preparadas" : "Commit de todas as alterações"}">✔ Commit</button></div>
        <div class="bweb-sync"><span>⑂ main</span><span title="Commits que ainda não foram para o GitHub">↑${n}</span><span title="Commits do GitHub que não estão aqui">↓0</span><span class="esp"></span>
          <button type="button" class="bweb-bt" data-acao="push" ${ro || !n ? "disabled" : ""} title="Enviar os commits para origin/main (git push)">⇧ Push${n ? " (" + n + ")" : ""}</button></div>
        ${reqs}
        ${prep.length ? `<div class="bweb-git-sec">Alterações preparadas <span class="cont">${prep.length}</span></div>${prep.map(m => item(m, true)).join("")}` : ""}
        <div class="bweb-git-sec">Alterações <span class="cont">${nao.length}</span></div>
        ${nao.length ? nao.map(m => item(m, false)).join("") : `<div class="bweb-vazio" style="padding:4px 6px">Nenhuma alteração desde o último commit.</div>`}
        <div class="bweb-git-sec" style="margin-top:12px">Histórico</div>
        <div class="bweb-hist">${hist}</div>
      </div></div>`;
  }
  const remotoInclui = (id) => { const ir = git.commits.findIndex(c => c.id === git.remoto), ic = git.commits.findIndex(c => c.id === id); return ir >= 0 && ic >= 0 && ic <= ir; };
  function atualizarBadge() {
    if (!el.badge) return;
    const n = mudancasGit().length;
    el.badge.hidden = !n;
    el.badge.textContent = n;
  }

  // ações da barra lateral
  el.lado.addEventListener("click", ev => {
    const t = ev.target;
    const be = t.closest("[data-etapa-i]");
    if (be && !be.disabled) { irEtapa(Number(be.dataset.etapaI)); return; }
    const ab = t.closest("[data-abrir]");
    if (ab) { const c = ab.dataset.abrir; if (existeNoProjeto(c)) abrir(c); else log(`O arquivo ${c} ainda não existe no projeto. Crie-o no Explorador.`); return; }
    const acao = t.closest("[data-acao]")?.dataset.acao;
    if (acao) { acaoLado(acao); return; }
    const sg = t.closest("[data-stage]"), ug = t.closest("[data-unstage]");
    if (sg) { ev.stopPropagation(); git.stage.add(sg.dataset.stage); depoisDoGit(); renderLado(); return; }
    if (ug) { ev.stopPropagation(); git.stage.delete(ug.dataset.unstage); depoisDoGit(); renderLado(); return; }
    const df = t.closest("[data-diff]");
    if (df) { abrir(df.dataset.diff, "diff"); return; }
    if (t.closest('[data-r="nome"]')) return;
    const pasta = t.closest("[data-pasta]");
    if (pasta) { const p = pasta.dataset.pasta; st.selExpl = p + "/"; if (st.abertas.has("-" + p)) st.abertas.delete("-" + p); else st.abertas.add("-" + p); renderLado(); return; }
    const arq = t.closest("[data-arq]");
    if (arq) { st.selExpl = arq.dataset.arq; abrir(arq.dataset.arq); return; }
    if (t.closest("[data-raiz]")) { st.selExpl = null; renderLado(); }
  });
  el.lado.addEventListener("keydown", ev => {
    const nome = ev.target.closest?.('[data-r="nome"]');
    if (nome) {
      if (ev.key === "Enter") { ev.preventDefault(); confirmarNome(nome.value); }
      return;
    }
    const no = ev.target.closest?.("[data-arq],[data-pasta]");
    if (no && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); no.click(); }
    if (no && ev.key === "F2") ev.preventDefault();
  });
  el.lado.addEventListener("focusout", ev => {
    const nome = ev.target.closest?.('[data-r="nome"]');
    if (!nome) return;
    setTimeout(() => {
      if (destruido || el.lado.contains(document.activeElement) && document.activeElement.dataset?.r === "nome") return;
      if (nome.value.trim() && (st.criando || st.renomeando)) confirmarNome(nome.value, true);
      else { st.criando = null; st.renomeando = null; st.erroNome = ""; renderLado(); }
    }, 120);
  });
  el.lado.addEventListener("input", ev => { if (ev.target.dataset?.r === "msg") st.msgCommit = ev.target.value; });
  function acaoLado(acao) {
    if (acao === "modelo") { abrirModelo(); return; }
    if (acao === "novo-arq" || acao === "nova-pasta") {
      const s = st.selExpl;
      const dir = !s ? "" : s.endsWith("/") ? s.slice(0, -1) : dirDe(s).replace(/\/$/, "");
      if (dir) st.abertas.delete("-" + dir);
      st.criando = { tipo: acao === "nova-pasta" ? "pasta" : "arq", dir };
      st.renomeando = null; st.erroNome = ""; st.excluindo = null;
      renderLado();
      return;
    }
    if (acao === "renomear" && st.selExpl) {
      if (assets.includes(st.selExpl) || (st.selExpl.endsWith("/") && assets.some(a => a.startsWith(st.selExpl)))) { log("As imagens da prova (e as pastas delas) não podem ser renomeadas."); return; }
      st.renomeando = st.selExpl; st.criando = null; st.erroNome = ""; renderLado();
      const inp = el.lado.querySelector('[data-r="nome"]');
      if (inp) { const v = inp.value; const p = v.lastIndexOf("."); inp.setSelectionRange(0, p > 0 && !st.renomeando.endsWith("/") ? p : v.length); }
      return;
    }
    if (acao === "excluir" && st.selExpl) {
      if (assets.includes(st.selExpl) || (st.selExpl.endsWith("/") && assets.some(a => a.startsWith(st.selExpl)))) { log("As imagens da prova (e as pastas delas) não podem ser excluídas."); return; }
      st.excluindo = st.selExpl; renderLado(); return;
    }
    if (acao === "excluir-nao") { st.excluindo = null; renderLado(); return; }
    if (acao === "excluir-sim" && st.excluindo) { excluir(st.excluindo); st.excluindo = null; renderLado(); return; }
    if (acao === "stage-tudo") { mudancasGit().forEach(m => git.stage.add(m.caminho)); depoisDoGit(); renderLado(); return; }
    if (acao === "unstage-tudo") { git.stage.clear(); depoisDoGit(); renderLado(); return; }
    if (acao === "commit") {
      const r = fazerCommit(st.msgCommit);
      if (r.erro) { log(r.erro); mostrarAvisoGit(r.erro); return; }
      st.msgCommit = "";
      log(`Commit ${r.commit.id}: "${r.commit.msg}" (${r.n} arquivo${r.n > 1 ? "s" : ""}${r.tudo ? "; nada estava preparado, então todas as alterações entraram" : ""})`);
      termEscrever(`[main ${r.commit.id}] ${r.commit.msg}`);
      depoisDoGit();
      const ta = el.lado.querySelector('[data-r="msg"]'); if (ta) ta.blur();
      renderLado();
      return;
    }
    if (acao === "push") {
      const r = fazerPush();
      if (r.nada) { log("Push: nada novo para enviar (origin/main já está atualizado)."); return; }
      log(`Push: ${r.n} commit(s) enviados para origin/main (${r.de}..${r.para}).`);
      termEscrever(`Para github.com:turma/${repo}.git\n   ${r.de}..${r.para}  main -> main`);
      depoisDoGit();
      renderLado();
    }
  }
  function mostrarAvisoGit(msg) {
    const ta = el.lado.querySelector('[data-r="msg"]');
    if (!ta) return;
    let av = el.lado.querySelector(".bweb-erro-nome.git");
    if (!av) { av = document.createElement("div"); av.className = "bweb-erro-nome git"; av.style.margin = "4px 0 0"; ta.after(av); }
    av.textContent = msg;
  }
  const NOME_OK = /^[\w\-. ()À-ÿ]+$/;
  function confirmarNome(valor, saindo = false) {
    const nome = String(valor || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    const erro = (m) => { st.erroNome = m; if (saindo) { st.criando = null; st.renomeando = null; st.erroNome = ""; log(m); } renderLado(); };
    if (!nome) return erro("Digite um nome.");
    if (nome.split("/").some(p => !p || p === "." || p === ".." || !NOME_OK.test(p))) return erro("Use só letras, números, ponto, traço e sublinhado.");
    if (st.criando) {
      const dir = st.criando.dir ? st.criando.dir + "/" : "";
      const c = dir + nome;
      if (existeNoProjeto(c) || todasPastas().has(c)) return erro("Já existe um item com esse nome aqui.");
      if (st.criando.tipo === "pasta") { st.pastas.add(c); st.abertas.delete("-" + c); st.selExpl = c + "/"; log(`Pasta criada: ${c}/`); }
      else {
        if (EXT_IMG.test(c)) return erro("Não dá para criar imagens aqui; use as imagens da pasta da prova.");
        st.arquivos[c] = "";
        st.selExpl = c;
        log(`Arquivo criado: ${c}`);
        st.criando = null; st.erroNome = "";
        mudou();
        abrir(c);
        return;
      }
      st.criando = null; st.erroNome = "";
      mudou({ previa: false, git: false });
      renderLado();
      return;
    }
    if (st.renomeando) {
      const velho = st.renomeando;
      const pasta = velho.endsWith("/");
      const antigo = pasta ? velho.slice(0, -1) : velho;
      const novo = dirDe(antigo) + nome;
      if (novo === antigo) { st.renomeando = null; st.erroNome = ""; renderLado(); return; }
      if (existeNoProjeto(novo) || todasPastas().has(novo)) return erro("Já existe um item com esse nome aqui.");
      if (!pasta && EXT_IMG.test(novo)) return erro("Um arquivo de texto não pode virar imagem.");
      const trocar = (c) => pasta ? (c.startsWith(antigo + "/") ? novo + c.slice(antigo.length) : c) : (c === antigo ? novo : c);
      const novos = {};
      for (const [k, v] of Object.entries(st.arquivos)) novos[trocar(k)] = v;
      st.arquivos = novos;
      st.pastas = new Set([...st.pastas].map(p => p === antigo ? novo : trocar(p + "/").replace(/\/$/, "")));
      for (const a of st.abas) { const n2 = trocar(a.caminho); if (n2 !== a.caminho) { if (editores.has(a.caminho)) { const o = editores.get(a.caminho); editores.delete(a.caminho); o.caminho = n2; editores.set(n2, o); } a.caminho = n2; a.chave = a.tipo + ":" + n2; } }
      if (st.aba) { const a = st.abas.find(z => z.chave.endsWith(":" + trocar(st.aba.slice(st.aba.indexOf(":") + 1)))); if (a) st.aba = a.chave; }
      st.previaCaminho = trocar(st.previaCaminho);
      st.selExpl = pasta ? novo + "/" : novo;
      log(`Renomeado: ${velho} → ${pasta ? novo + "/" : novo}`);
      st.renomeando = null; st.erroNome = "";
      mudou();
      renderAbas(); renderTrilha(); renderLado();
    }
  }
  function excluir(alvo) {
    const pasta = alvo.endsWith("/");
    const lista = pasta ? Object.keys(st.arquivos).filter(k => k.startsWith(alvo)) : [alvo];
    lista.forEach(k => { delete st.arquivos[k]; const a = st.abas.find(z => z.caminho === k && z.tipo === "arq"); if (a) fecharAba(a.chave); });
    if (pasta) { const p = alvo.slice(0, -1); st.pastas = new Set([...st.pastas].filter(x => x !== p && !x.startsWith(alvo))); }
    if (st.selExpl === alvo) st.selExpl = null;
    if (lista.includes(st.previaCaminho)) st.previaCaminho = entrada;
    log(`Excluído: ${alvo}`);
    mudou();
    renderAbas(); renderEditor();
  }

  // ---------- atividade (barra da esquerda) ----------
  raiz.querySelector(".bweb-atv").addEventListener("click", ev => {
    const b = ev.target.closest("[data-visao]");
    if (!b) return;
    if (st.visao === b.dataset.visao && st.ladoAberto) st.ladoAberto = false;
    else { st.visao = b.dataset.visao; st.ladoAberto = true; }
    renderLado();
  });

  // ---------- prévia ----------
  let ultimoDoc = "", frameCarregado = false;
  function docPrevia(caminho = st.previaCaminho) { return montarDocumentoWeb(textosAtuais(), caminho, base); }
  function agendarPrevia() { clearTimeout(timerPrevia); timerPrevia = setTimeout(() => atualizarPrevia(), 300); }
  function atualizarPrevia(forcar = false) {
    if (destruido) return;
    const doc = docPrevia();
    el.url.textContent = `localhost:5500/${st.previaCaminho}`;
    el.url.title = "Prévia ao vivo de " + st.previaCaminho;
    if (doc !== ultimoDoc || forcar) {
      let y = 0;
      try { y = el.frame.contentWindow?.scrollY || 0; } catch { /* */ }
      el.frame._rolar = forcar ? 0 : y;
      ultimoDoc = doc;
      el.frame.srcdoc = doc;
      const ov = el.sobrecorpo.querySelector("iframe");
      if (ov && !el.sobre.hidden) { ov._rolar = 0; try { ov._rolar = ov.contentWindow?.scrollY || 0; } catch { /* */ } ov.srcdoc = doc; }
      enviarAba();
    }
  }
  function instrumentar(frame) {
    frame.addEventListener("load", () => {
      let d;
      try { d = frame.contentDocument; } catch { return; }
      if (!d) return;
      if (frame._rolar) { try { frame.contentWindow.scrollTo(0, frame._rolar); } catch { /* */ } }
      d.addEventListener("click", ev => {
        const a = ev.target.closest?.("a[href]");
        if (!a) return;
        ev.preventDefault();
        const href = a.getAttribute("href") || "";
        if (href.startsWith("#")) {
          const id = decodeURIComponent(href.slice(1));
          const alvo = id ? (d.getElementById(id) || d.querySelector(`[name="${CSS.escape(id)}"]`)) : null;
          if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
          else if (!id || id === "top" || id === "topo") frame.contentWindow.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (externo(href) || href.startsWith("mailto:") || href.startsWith("tel:")) { log(`Link externo bloqueado na prévia: ${href}`); return; }
        const alvo = resolver(dirDe(st.previaCaminho), href);
        if (textosAtuais()[alvo] != null && /\.html?$/i.test(alvo)) { st.previaCaminho = alvo; atualizarPrevia(true); log(`Prévia: abrindo ${alvo}`); }
        else log(`Link para um arquivo que não existe no projeto: ${href}`);
      }, true);
      d.addEventListener("submit", ev => ev.preventDefault(), true);
      ["dragstart", "copy", "cut", "contextmenu", "drop"].forEach(t => d.addEventListener(t, ev => ev.preventDefault(), true));
      // atalhos dentro da prévia passam pelo bloqueio da prova (o teclado do iframe não chega na página)
      d.addEventListener("keydown", ev => {
        if (ev.ctrlKey || ev.metaKey || ev.altKey || /^F\d{1,2}$/.test(ev.key) || ev.key === "Escape" || ev.key === "ContextMenu") {
          ev.preventDefault();
          frame.dispatchEvent(new KeyboardEvent("keydown", { key: ev.key, code: ev.code, ctrlKey: ev.ctrlKey, altKey: ev.altKey, shiftKey: ev.shiftKey, metaKey: ev.metaKey, bubbles: true, cancelable: true }));
        }
      }, true);
    });
  }
  instrumentar(el.frame);
  el.frame.addEventListener("load", () => { frameCarregado = true; });
  function aplicarLargura() {
    const f = el.frame;
    let esc = 1;
    if (st.largura === "ajustar") { const w = el.quadro.clientWidth; if (w > 0 && w < 1280) esc = w / 1280; }
    if (esc < 1) {
      f.style.width = "1280px"; f.style.height = (el.quadro.clientHeight / esc) + "px"; f.style.transform = `scale(${esc})`;
    } else { f.style.transform = ""; f.style.height = "100%"; f.style.width = st.largura === "ajustar" ? "100%" : st.largura; }
    el.quadro.classList.toggle("escala", esc < 1);
    el.quadro.classList.toggle("estreito", st.largura !== "100%" && st.largura !== "ajustar");
    raiz.querySelectorAll("[data-larg]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.larg === st.largura)));
  }

  // ---------- GitHub simulado ----------
  function renderGithub() {
    const arv = arvoreRemota();
    const raizes = new Map();
    for (const [c, info] of arv) {
      const topo = c.split("/")[0], pasta = c.includes("/");
      const atual = raizes.get(topo);
      if (!atual || info.em > atual.em) raizes.set(topo, { ...info, pasta });
    }
    const ultimo = git.remoto === idInicial ? { id: idInicial, msg: "Commit inicial (arquivos da prova)", em: inicioEm } : git.commits.find(c => c.id === git.remoto);
    const enviados = git.remoto === idInicial ? [] : git.commits.slice(0, git.commits.findIndex(c => c.id === git.remoto) + 1).reverse();
    const lista = [...raizes.entries()].sort((a, b) => (b[1].pasta - a[1].pasta) || a[0].localeCompare(b[0]));
    el.vgithub.innerHTML = `
      <div class="bweb-gh-topo">🐙 <span>turma / <b>${escHtml(repo)}</b></span><span style="margin-left:auto;font-size:12px;color:#57606a">Público · simulado</span></div>
      <div class="bweb-gh-sec">
        <div class="cab"><b>⑂ main</b><span style="color:#57606a">${enviados.length + 1} commit${enviados.length ? "s" : ""}</span><span style="margin-left:auto" class="hash">${escHtml(ultimo?.id || "")}</span><span style="color:#57606a">${ultimo ? quando(ultimo.em) : ""}</span></div>
        <div class="lin" style="background:#f6f8fa"><span class="msg" style="color:#1f2328">${escHtml(ultimo?.msg || "")}</span></div>
        ${lista.map(([nome, info]) => `<div class="lin"><span>${info.pasta ? "📁" : "📄"}</span><span class="nm">${escHtml(nome)}</span><span class="msg">${escHtml(info.msg)}</span><span class="tp">${quando(info.em)}</span></div>`).join("")}
      </div>
      <div class="bweb-gh-sec">
        <div class="cab"><b>Commits</b></div>
        ${enviados.map(c => `<div class="lin"><span class="hash">${c.id}</span><span class="msg" style="color:#1f2328">${escHtml(c.msg)}</span><span class="tp">${quando(c.em)}</span></div>`).join("")}
        <div class="lin"><span class="hash">${idInicial}</span><span class="msg" style="color:#1f2328">Commit inicial (arquivos da prova)</span><span class="tp">professor</span></div>
      </div>
      <p class="bweb-gh-aviso">${aFrente() ? `⚠ Há ${aFrente()} commit(s) no seu computador que ainda não foram enviados (push).` : "Tudo o que você fez commit já está aqui."} Este GitHub é uma simulação dentro da prova: nada sai do seu computador.</p>`;
  }
  function mostrarDireita() {
    el.vprevia.style.display = st.direita === "previa" ? "flex" : "none";
    el.vgithub.hidden = st.direita !== "github";
    raiz.querySelectorAll("[data-dir]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.dir === st.direita)));
    if (st.direita === "github") renderGithub();
  }
  el.dir.addEventListener("click", ev => {
    const d = ev.target.closest("[data-dir]");
    if (d) { st.direita = d.dataset.dir; mostrarDireita(); return; }
    const l = ev.target.closest("[data-larg]");
    if (l) { st.largura = l.dataset.larg; aplicarLargura(); return; }
    const a = ev.target.closest("[data-acao]")?.dataset.acao;
    if (a === "inicio") { st.previaCaminho = entrada; atualizarPrevia(true); }
    if (a === "recarregar") atualizarPrevia(true);
  });

  // ---------- sobreposições (prévia em tela inteira / modelo) ----------
  function abrirSobre(titulo, html) {
    el.sobretit.textContent = titulo;
    el.sobrecorpo.innerHTML = html;
    el.sobre.hidden = false;
    el.sobre.querySelector('[data-acao="fechar-sobre"]').focus();
  }
  function fecharSobre() { el.sobre.hidden = true; el.sobrecorpo.innerHTML = ""; }
  function abrirTelaCheia() {
    abrirSobre(`Prévia em tela inteira — ${st.previaCaminho}`, `<iframe sandbox="allow-same-origin" title="Prévia do site em tela inteira"></iframe>`);
    const f = el.sobrecorpo.querySelector("iframe");
    instrumentar(f);
    f.srcdoc = docPrevia();
  }
  function abrirModelo() {
    if (!questao.imagemModelo) return;
    abrirSobre("Modelo de referência (resultado esperado)", `<img class="modelo" src="${escHtml(new URL(questao.imagemModelo, document.baseURI).href)}" alt="Imagem do site modelo" draggable="false">`);
  }
  raiz.querySelector(".bweb-topo").addEventListener("click", ev => {
    const a = ev.target.closest("[data-acao]")?.dataset.acao;
    if (a === "modelo") abrirModelo();
    if (a === "tela") abrirTelaCheia();
    if (a === "aba") abrirAba();
  });
  el.sobre.addEventListener("click", ev => { if (ev.target.closest('[data-acao="fechar-sobre"]')) fecharSobre(); });
  el.sobrecorpo.addEventListener("dragstart", ev => ev.preventDefault());

  // ---------- prévia em outra aba (BroadcastChannel + batimentos) ----------
  const canalId = uid + Date.now().toString(36);
  let canal = null, sinal = { ts: 0, foco: false, visivel: false }, timerPing = null;
  function abrirAba() {
    if (!canal && typeof BroadcastChannel === "function") {
      canal = new BroadcastChannel("bancada-web-" + canalId);
      canal.onmessage = (ev) => {
        const m = ev.data || {};
        if (m.tipo === "pronta") enviarAba(true);
        if (m.tipo === "presenca" || m.tipo === "pronta" || m.tipo === "fechada") {
          const agora = Date.now();
          if (m.tipo === "fechada") sinal = { ts: sinal.ts, foco: false, visivel: false };
          else sinal = { ts: m.foco ? agora : sinal.ts, foco: !!m.foco, visivel: !!m.visivel, ultimo: agora };
          window.dispatchEvent(new CustomEvent("bancada-web:previa", { detail: { canal: canalId, tipo: m.tipo, foco: !!m.foco, visivel: !!m.visivel, ts: agora } }));
        }
      };
      timerPing = setInterval(() => { try { canal?.postMessage({ tipo: "ping", ts: Date.now() }); } catch { /* */ } }, 2000);
    }
    const w = abrirJanela(`previa-web.html#${canalId}`);
    if (w === null) log("A prévia em outra aba não pôde ser aberta. Use a prévia ao lado ou a prévia em tela inteira.");
    setTimeout(() => enviarAba(true), 600);
  }
  let ultimoEnviado = "";
  function enviarAba(forcar = false) {
    if (!canal) return;
    const arquivos = textosAtuais();
    const chave = st.previaCaminho + "|" + st.versao;
    if (!forcar && chave === ultimoEnviado) return;
    ultimoEnviado = chave;
    try { canal.postMessage({ tipo: "projeto", arquivos: { ...arquivos }, entrada: st.previaCaminho, base, titulo: repo }); } catch { /* */ }
  }

  // ---------- divisórias ----------
  function divisoria(alca, aoMover) {
    alca.addEventListener("pointerdown", ev => {
      ev.preventDefault();
      alca.setPointerCapture(ev.pointerId);
      alca.classList.add("ativo");
      const mover = (e) => aoMover(e);
      const fim = () => { alca.classList.remove("ativo"); alca.removeEventListener("pointermove", mover); alca.removeEventListener("pointerup", fim); alca.removeEventListener("pointercancel", fim); for (const o of editores.values()) o.sincronizar(); };
      alca.addEventListener("pointermove", mover);
      alca.addEventListener("pointerup", fim);
      alca.addEventListener("pointercancel", fim);
    });
  }
  divisoria($r("divh"), (e) => {
    const c = raiz.querySelector(".bweb-centro").getBoundingClientRect();
    const h = Math.max(34, Math.min(c.height - 140, c.bottom - e.clientY));
    raiz.style.setProperty("--bw-painel", h + "px");
    st.painelAberto = true; el.painel.classList.remove("fechado");
  });
  divisoria($r("divv"), (e) => {
    const c = raiz.querySelector(".bweb-corpo").getBoundingClientRect();
    const w = Math.max(240, Math.min(c.width - 420, c.right - e.clientX));
    raiz.style.setProperty("--bw-dir", w + "px");
  });

  // ---------- barra de status ----------
  function renderStatus() {
    const n = comGit ? aFrente() : 0;
    const mud = comGit ? mudancasGit().length : 0;
    const a = abaAtual();
    const p = etapaAtual();
    let meio = "";
    if (modo !== "livre" && p) {
      const tot = pe.reduce((s, q) => s + q.slots.length, 0), cheios = pe.reduce((s, q) => s + contagemEtapa(q).cheios, 0);
      meio = `<span>Etapa ${st.etapa + 1} de ${pe.length}</span><span title="Espaços preenchidos na prova toda">Espaços: ${cheios}/${tot}</span>`;
    } else if (p) meio = `<span>Etapa ${st.etapa + 1} de ${pe.length}</span>`;
    const ling = a?.tipo === "arq" ? (extDe(a.caminho) === "css" ? "CSS" : /^html?$/.test(extDe(a.caminho)) ? "HTML" : "Texto") : "";
    el.status.innerHTML = (comGit ? `<button type="button" data-acao="ver-git" title="Controle de código-fonte">⑂ main${mud ? "*" : ""}</button><span title="Commits ainda não enviados ao GitHub">↑${n} ↓0</span>` : "")
      + meio + `<span class="esp"></span>`
      + (modo === "livre" && st.cursor && a?.tipo === "arq" ? `<span>Ln ${st.cursor.ln}, Col ${st.cursor.col}</span>` : "")
      + (ling ? `<span>Espaços: 2</span><span>UTF-8</span><span>${ling}</span>` : "")
      + `<span title="A prévia atualiza sozinha">● Prévia ao vivo</span>`;
  }
  el.status.addEventListener("click", ev => { if (ev.target.closest('[data-acao="ver-git"]')) { st.visao = "git"; st.ladoAberto = true; renderLado(); } });

  // ---------- início ----------
  if (modo === "livre") {
    const prim = [entrada, ...Object.keys(st.arquivos).filter(k => /\.css$/i.test(k))].filter((c, i, a) => st.arquivos[c] != null && a.indexOf(c) === i).slice(0, 2);
    prim.forEach(c => st.abas.push({ chave: "arq:" + c, tipo: "arq", caminho: c }));
    st.aba = st.abas[0]?.chave || null;
  } else {
    st.abas.push({ chave: "arq:" + arqHtml, tipo: "arq", caminho: arqHtml }, { chave: "arq:" + arqCss, tipo: "arq", caminho: arqCss });
    st.aba = "arq:" + arqHtml;
  }
  if (pe[0]) st.vistas.add(pe[0].id);
  aplicarLargura();
  mostrarDireita();
  renderLado(); renderAbas(); renderTrilha(); renderEditor(); renderPainel(); renderStatus(); atualizarBadge();
  log(modo === "livre" ? "Projeto aberto. A prévia mostra o arquivo HTML que você está editando." : "Prova aberta. A prévia ao lado atualiza a cada comando encaixado.");
  if (modo !== "livre") { const p = pe[0]; if (p && !p.htmlP.slots.length && p.cssP.slots.length) abrir(arqCss); }
  atualizarPrevia(true);
  const obs = typeof ResizeObserver === "function" ? new ResizeObserver(() => { for (const o of editores.values()) if (!o.el.hidden) o.sincronizar(); }) : null;
  obs?.observe(raiz);
  const obsQuadro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { if (st.largura === "ajustar") aplicarLargura(); }) : null;
  obsQuadro?.observe(el.quadro);
  const relogio = setInterval(() => { if (st.visao === "git" && st.ladoAberto) { const foco = document.activeElement; if (!(foco && el.lado.contains(foco))) renderLado(); } }, 30000);

  // ---------- resposta ----------
  let cacheVerif = { chave: null, p: null };
  function verificacoesComCache(arqs) {
    const chave = hashCurto(JSON.stringify(Object.entries(arqs).sort()));
    if (cacheVerif.chave !== chave) { cacheVerif = { chave, p: avaliarVerificacoes(questao, arqs) }; cacheVerif.p.catch(() => { cacheVerif = { chave: null, p: null }; }); }
    return cacheVerif.p;
  }

  return {
    async valor() {
      const arqs = { ...textosAtuais() };
      const out = { modo };
      if (modo !== "livre") {
        out.slots = {};
        for (const [k, v] of Object.entries(st.slots)) if (String(v ?? "").trim()) out.slots[k] = String(v);
      }
      out.arquivos = arqs;
      if (modo === "livre") {
        const vazias = [...st.pastas].filter(p => !Object.keys(arqs).some(k => k.startsWith(p + "/")) && !assets.some(k => k.startsWith(p + "/")));
        if (vazias.length) out.pastas = vazias;
        try { out.verificacoes = await verificacoesComCache(arqs); } catch { out.verificacoes = {}; }
      }
      if (comGit) {
        const mud = new Set(mudancasGit().map(m => m.caminho));
        out.git = { commits: git.commits.map(c => ({ ...c })), pushes: git.pushes, remoto: git.remoto, head: { ...git.head }, stage: [...git.stage].filter(p => mud.has(p)) };
      }
      out.etapasVistas = [...st.vistas];
      return out;
    },
    ultimoSinalPrevia() { return sinal.ts; },
    destruir() {
      destruido = true;
      clearTimeout(timerMudar); clearTimeout(timerPrevia); clearTimeout(timerGit); clearInterval(timerPing); clearInterval(relogio);
      document.removeEventListener("pointermove", aoMover);
      document.removeEventListener("pointerup", aoSoltar);
      document.removeEventListener("pointercancel", aoSoltar);
      arr?.fantasma?.remove();
      obs?.disconnect();
      obsQuadro?.disconnect();
      try { canal?.postMessage({ tipo: "encerrar" }); canal?.close(); } catch { /* */ }
      raiz.remove();
    },
    // usado pela página de demonstração e pelos testes automatizados
    _teste: {
      preencherSlots(mapa) { Object.assign(st.slots, mapa); mudou(); renderEditor(); renderLado(); },
      definirArquivos(mapa) { st.arquivos = { ...mapa }; for (const o of editores.values()) o.el.remove(); editores.clear(); mudou(); renderEditor(); renderLado(); },
      commit(msg) { const r = fazerCommit(msg); depoisDoGit(); renderLado(); return r; },
      push() { const r = fazerPush(); depoisDoGit(); renderLado(); return r; },
      irEtapa, abrir, estado: st, git
    }
  };
}
