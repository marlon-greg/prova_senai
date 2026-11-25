// Bancada SQL: editor no estilo das IDEs de banco (navegador de schemas, abas de consulta,
// Result Grid e Output) para as questões do tipo "sql". O SQL roda NO NAVEGADOR com sql.js
// (SQLite em WebAssembly) e uma camada de tradução MySQL → SQLite, para o aluno sentir que
// está usando MySQL: mesmos comandos (SHOW, DESCRIBE, USE, AUTO_INCREMENT, ENUM...), mesmas
// mensagens ("Error Code: 1146. Table 'loja.x' doesn't exist") e o modo Safe Updates.
//
// API:
//   carregarMotor()                         → carrega o sql.js uma vez só (promessa em cache)
//   montarBancada(container, opcoes)        → monta a IDE; devolve { valor(), destruir() }
//   avaliarTarefa(questao, tarefa, sql)     → roda numa base NOVA e devolve as impressões (hashes)
//   calcularGabarito(questao, gabarito)     → preenche impressao/conjunto do gabarito
//   resumoResposta(questao, resposta)       → texto simples (tela de resultado / prompt da IA)
//
// Sem dependências de outros módulos do site (dá para testar no Node).

const CDN = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/";
const LIMITE_SESSAO = 1000;      // como o Workbench: "Limit to 1000 rows"
const LIMITE_AVALIACAO = 5000;   // linhas usadas no hash
const LINHAS_GRID = 200;         // linhas mostradas no Result Grid

// =====================================================================================
// Motor (sql.js)
// =====================================================================================
let promessaMotor = null;

export async function carregarMotor() {
  if (!promessaMotor) {
    promessaMotor = (async () => {
      let iniciar = globalThis.initSqlJs;
      if (typeof iniciar !== "function") {
        await new Promise((ok, falha) => {
          const s = document.createElement("script");
          s.src = CDN + "sql-wasm.js";
          s.async = true;
          s.onload = ok;
          s.onerror = () => falha(new Error("falha ao baixar sql-wasm.js"));
          document.head.appendChild(s);
        });
        iniciar = globalThis.initSqlJs;
      }
      if (typeof iniciar !== "function") throw new Error("initSqlJs indisponível");
      return iniciar({ locateFile: arq => CDN + arq });
    })();
    promessaMotor.catch(() => { promessaMotor = null; });   // deixa tentar de novo depois
  }
  try { return await promessaMotor; }
  catch (e) {
    throw new Error("Não foi possível carregar o motor SQL. Verifique a internet e recarregue a página. (" + (e?.message || e) + ")");
  }
}

// =====================================================================================
// Utilitários
// =====================================================================================
const idt = nome => '"' + String(nome).replace(/"/g, '""') + '"';        // identificador SQLite
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";               // texto SQLite
const crase = nome => "`" + nome + "`";                                    // identificador MySQL (mensagens)
const escHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad2 = n => String(n).padStart(2, "0");
const minusc = s => String(s).toLowerCase();

class ErroMy extends Error {
  constructor(codigo, msg) { super(`Error Code: ${codigo}. ${msg}`); this.codigo = codigo; }
}

// =====================================================================================
// Tokenizador (MySQL por padrão; modoSqlite=true para ler o SQL que o próprio SQLite guarda)
// =====================================================================================
const OPS = ["<=>", "->>", "<=", ">=", "<>", "!=", "||", "&&", ":=", "<<", ">>", "->"];
const ESCAPES = { n: "\n", t: "\t", r: "\r", "0": "\0", b: "\b", Z: "\x1a", "\\": "\\", "'": "'", '"': '"' };
const RE_PAL = /[A-Za-z_$@À-￿][A-Za-z0-9_$@À-￿]*/y;
const RE_NUM = /(?:0x[0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y;
const ehEspaco = c => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v" || c === " ";

function tokenizar(src, modoSqlite = false) {
  const out = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i], ini = i;
    if (ehEspaco(c)) {
      while (i < n && ehEspaco(src[i])) i++;
      out.push({ t: "ws", v: src.slice(ini, i), p: ini });
      continue;
    }
    if ((c === "-" && src[i + 1] === "-") || (c === "#" && !modoSqlite)) {
      while (i < n && src[i] !== "\n") i++;
      out.push({ t: "com", v: src.slice(ini, i), p: ini });
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const f = src.indexOf("*/", i + 2);
      i = f < 0 ? n : f + 2;
      out.push({ t: "com", v: src.slice(ini, i), p: ini, inc: f < 0 });
      continue;
    }
    if (c === "'" || (c === '"' && !modoSqlite)) {
      i++;
      let val = "", fechou = false;
      while (i < n) {
        const ch = src[i];
        if (ch === "\\" && !modoSqlite && i + 1 < n) {
          const e = src[i + 1];
          val += ESCAPES[e] ?? (e === "%" || e === "_" ? "\\" + e : e);
          i += 2;
          continue;
        }
        if (ch === c) {
          if (src[i + 1] === c) { val += c; i += 2; continue; }
          i++; fechou = true; break;
        }
        val += ch; i++;
      }
      out.push({ t: "str", v: src.slice(ini, i), n: val, p: ini, inc: !fechou });
      continue;
    }
    if (c === "`" || (modoSqlite && (c === '"' || c === "["))) {
      const fim = c === "[" ? "]" : c;
      i++;
      let val = "", fechou = false;
      while (i < n) {
        if (src[i] === fim) {
          if (src[i + 1] === fim && fim !== "]") { val += fim; i += 2; continue; }
          i++; fechou = true; break;
        }
        val += src[i++];
      }
      out.push({ t: "id", v: src.slice(ini, i), n: val, p: ini, inc: !fechou });
      continue;
    }
    if ((c >= "0" && c <= "9") || (c === "." && src[i + 1] >= "0" && src[i + 1] <= "9")) {
      RE_NUM.lastIndex = i;
      const m = RE_NUM.exec(src);
      i += m ? m[0].length : 1;
      out.push({ t: "num", v: src.slice(ini, i), p: ini });
      continue;
    }
    RE_PAL.lastIndex = i;
    const mp = RE_PAL.exec(src);
    if (mp) {
      i += mp[0].length;
      out.push({ t: "pal", v: mp[0], p: ini });
      continue;
    }
    const op = OPS.find(o => src.startsWith(o, i)) || c;
    i += op.length;
    out.push({ t: "op", v: op, p: ini });
  }
  return out;
}

// tira espaços/comentários; cada token guarda se tinha espaço antes (esp) e a forma maiúscula (u)
function significativos(toks) {
  const r = [];
  let esp = false;
  for (const t of toks) {
    if (t.t === "ws" || t.t === "com") { esp = true; continue; }
    r.push({ ...t, u: t.t === "pal" ? t.v.toUpperCase() : "", esp });
    esp = false;
  }
  return r;
}

function emitir(toks) {
  let s = "";
  toks.forEach((t, k) => { s += (k > 0 && t.esp ? " " : "") + t.v; });
  return s;
}
const novo = (v, t = "x") => ({ t, v, u: t === "pal" ? v.toUpperCase() : "", esp: true });
const nomeDe = t => !t ? null : t.t === "id" ? t.n : t.t === "pal" ? t.v : t.t === "str" ? t.n : null;
const ehOp = (t, v) => !!t && t.t === "op" && t.v === v;
const ehPal = (t, u) => !!t && t.t === "pal" && t.u === u;

// Divide o texto em comandos (separados por ";"), respeitando aspas e comentários.
// Cada comando: { texto, ini, fim, fimRegiao, toks, incompleto }
function dividir(texto) {
  const cmds = [];
  let atual = [];
  const fechar = fimRegiao => {
    const sig = atual.filter(t => t.t !== "ws" && t.t !== "com");
    if (sig.length) {
      const pri = sig[0], ult = sig[sig.length - 1];
      const ini = pri.p, fim = ult.p + ult.v.length;
      const desdePri = atual.slice(atual.indexOf(pri));
      cmds.push({
        texto: texto.slice(ini, fim), ini, fim, fimRegiao,
        toks: significativos(desdePri),
        incompleto: desdePri.find(t => t.inc) || null
      });
    }
    atual = [];
  };
  for (const t of tokenizar(texto)) {
    if (t.t === "op" && t.v === ";") { fechar(t.p + 1); continue; }
    atual.push(t);
  }
  fechar(texto.length);
  return cmds;
}
const temComando = texto => dividir(String(texto || "")).length > 0;

// divide uma lista de tokens nas vírgulas do nível 0
function dividirVirgulas(toks) {
  const partes = [[]];
  let prof = 0;
  for (const t of toks) {
    if (ehOp(t, "(")) prof++;
    else if (ehOp(t, ")")) prof--;
    if (prof === 0 && ehOp(t, ",")) { partes.push([]); continue; }
    partes[partes.length - 1].push(t);
  }
  return partes.filter(p => p.length);
}
// índice de uma palavra no nível 0 de parênteses (a partir de "de")
function acharNivel0(toks, u, de = 0) {
  let prof = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (ehOp(t, "(")) prof++;
    else if (ehOp(t, ")")) prof--;
    else if (i >= de && prof === 0 && ehPal(t, u)) return i;
  }
  return -1;
}
// "(a, b(10) DESC, `c`)" → ["a", "b", "c"]
function nomesColunas(toks) {
  return dividirVirgulas(toks).map(p => nomeDe(p[0])).filter(Boolean);
}
// "UPDATE t a SET" → o SQLite exige "AS" antes do apelido
function comAs(k) {
  const t = k[0];
  if (t && (t.t === "id" || (t.t === "pal" && !["SET", "WHERE", "AS"].includes(t.u)))) return [novo("AS", "pal"), ...k];
  return k;
}

// Cursor simples sobre a lista de tokens significativos
class Cur {
  constructor(toks, i = 0) { this.k = toks; this.i = i; }
  get fim() { return this.i >= this.k.length; }
  ver(o = 0) { return this.k[this.i + o]; }
  u(o = 0) { const t = this.k[this.i + o]; return t && t.t === "pal" ? t.u : ""; }
  op(v, o = 0) { return ehOp(this.k[this.i + o], v); }
  pega() { return this.k[this.i++]; }
  aceita(...ps) {
    for (let j = 0; j < ps.length; j++) if (this.u(j) !== ps[j]) return false;
    this.i += ps.length;
    return true;
  }
  nome() {
    const t = this.k[this.i];
    if (t && (t.t === "id" || (t.t === "pal" && !t.v.startsWith("@")))) { this.i++; return nomeDe(t); }
    return null;
  }
  parenteses() {
    if (!this.op("(")) return null;
    const ini = this.i;
    let prof = 0;
    for (; this.i < this.k.length; this.i++) {
      const t = this.k[this.i];
      if (ehOp(t, "(")) prof++;
      else if (ehOp(t, ")") && --prof === 0) { this.i++; return this.k.slice(ini + 1, this.i - 1); }
    }
    this.i = ini;
    throw new ErroSintaxe(null);
  }
  resto() { return this.k.slice(this.i); }
}

// erro de sintaxe: a mensagem completa é montada pela sessão (precisa do texto do comando)
class ErroSintaxe extends Error {
  constructor(tok, perto = null) { super("syntax"); this.tok = tok || null; this.perto = perto; }
}

// =====================================================================================
// Funções do MySQL que o SQLite não tem (registradas em cada banco)
// =====================================================================================
const MESES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DIAS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function lerData(v) {
  if (v === null || v === undefined) return null;
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(String(v));
  if (!m) return null;
  const d = { a: +m[1], m: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0), hora: m[4] !== undefined };
  if (d.m < 1 || d.m > 12 || d.d < 1 || d.d > 31) return null;
  return d;
}
const utc = d => Date.UTC(d.a, d.m - 1, d.d, d.h, d.mi, d.s);
const textoData = (d, hora) => `${d.a}-${pad2(d.m)}-${pad2(d.d)}` + (hora ? ` ${pad2(d.h)}:${pad2(d.mi)}:${pad2(d.s)}` : "");
function deUtc(ms) {
  const x = new Date(ms);
  return { a: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), h: x.getUTCHours(), mi: x.getUTCMinutes(), s: x.getUTCSeconds() };
}
function agora() {
  const x = new Date();
  return { a: x.getFullYear(), m: x.getMonth() + 1, d: x.getDate(), h: x.getHours(), mi: x.getMinutes(), s: x.getSeconds() };
}
function somarData(v, n, unidade) {
  const d = lerData(v);
  if (!d || n === null || n === undefined) return null;
  n = Math.trunc(Number(n));
  const u = minusc(unidade || "day");
  if (u === "month" || u === "year" || u === "quarter") {
    const meses = u === "year" ? n * 12 : u === "quarter" ? n * 3 : n;
    const total = d.a * 12 + (d.m - 1) + meses;
    const a = Math.floor(total / 12), m = total - a * 12 + 1;
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return textoData({ ...d, a, m, d: Math.min(d.d, ultimo) }, d.hora);
  }
  const seg = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 }[u];
  if (!seg) return null;
  const r = deUtc(utc(d) + n * seg * 1000);
  return textoData(r, d.hora || seg < 86400);
}
function formatarData(v, fmt) {
  const d = lerData(v);
  if (!d || fmt === null) return null;
  const sem = new Date(utc(d)).getUTCDay();
  const h12 = d.h % 12 === 0 ? 12 : d.h % 12;
  return String(fmt).replace(/%(.)/g, (_, c) => ({
    Y: String(d.a), y: String(d.a).slice(-2), m: pad2(d.m), c: String(d.m), d: pad2(d.d), e: String(d.d),
    H: pad2(d.h), k: String(d.h), h: pad2(h12), I: pad2(h12), l: String(h12), i: pad2(d.mi), s: pad2(d.s), S: pad2(d.s),
    p: d.h < 12 ? "AM" : "PM", M: MESES[d.m - 1], b: MESES[d.m - 1].slice(0, 3), W: DIAS[sem], a: DIAS[sem].slice(0, 3),
    T: `${pad2(d.h)}:${pad2(d.mi)}:${pad2(d.s)}`, "%": "%"
  }[c] ?? c));
}
const comoTexto = v => v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v);

function registrarFuncoes(db, sessao) {
  const reg = (nome, fn, variadica = false) => {
    if (variadica) Object.defineProperty(fn, "length", { value: -1 });
    db.create_function(nome, fn);
  };
  const parte = campo => v => { const d = lerData(v); return d ? d[campo] : null; };
  reg("NOW", () => textoData(agora(), true));
  reg("SYSDATE", () => textoData(agora(), true));
  reg("CURDATE", () => textoData(agora(), false));
  reg("CURTIME", () => { const a = agora(); return `${pad2(a.h)}:${pad2(a.mi)}:${pad2(a.s)}`; });
  reg("YEAR", parte("a"));
  reg("MONTH", parte("m"));
  reg("DAY", parte("d"));
  reg("HOUR", v => { const d = lerData(v); if (d) return d.h; const m = /^(\d{1,2}):/.exec(String(v ?? "")); return m ? +m[1] : null; });
  reg("MINUTE", v => { const d = lerData(v); if (d) return d.mi; const m = /^\d{1,2}:(\d{2})/.exec(String(v ?? "")); return m ? +m[1] : null; });
  reg("SECOND", v => { const d = lerData(v); if (d) return d.s; const m = /^\d{1,2}:\d{2}:(\d{2})/.exec(String(v ?? "")); return m ? +m[1] : null; });
  reg("QUARTER", v => { const d = lerData(v); return d ? Math.ceil(d.m / 3) : null; });
  reg("DAYOFWEEK", v => { const d = lerData(v); return d ? new Date(utc(d)).getUTCDay() + 1 : null; });
  reg("WEEKDAY", v => { const d = lerData(v); return d ? (new Date(utc(d)).getUTCDay() + 6) % 7 : null; });
  reg("DAYNAME", v => { const d = lerData(v); return d ? DIAS[new Date(utc(d)).getUTCDay()] : null; });
  reg("MONTHNAME", v => { const d = lerData(v); return d ? MESES[d.m - 1] : null; });
  reg("LAST_DAY", v => { const d = lerData(v); return d ? textoData({ ...d, d: new Date(Date.UTC(d.a, d.m, 0)).getUTCDate() }, false) : null; });
  reg("DATE_FORMAT", (v, f) => formatarData(v, f));
  reg("DATEDIFF", (a, b) => {
    const x = lerData(a), y = lerData(b);
    if (!x || !y) return null;
    return Math.round((Date.UTC(x.a, x.m - 1, x.d) - Date.UTC(y.a, y.m - 1, y.d)) / 86400000);
  });
  reg("TIMESTAMPDIFF", (u, a, b) => {
    const x = lerData(a), y = lerData(b);
    if (!x || !y) return null;
    const un = minusc(u);
    if (un === "month" || un === "year" || un === "quarter") {
      let meses = (y.a - x.a) * 12 + (y.m - x.m);
      const resto = (y.d * 86400 + y.h * 3600 + y.mi * 60 + y.s) - (x.d * 86400 + x.h * 3600 + x.mi * 60 + x.s);
      if (meses > 0 && resto < 0) meses--;
      if (meses < 0 && resto > 0) meses++;
      return un === "year" ? Math.trunc(meses / 12) : un === "quarter" ? Math.trunc(meses / 3) : meses;
    }
    const seg = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 }[un];
    return seg ? Math.trunc((utc(y) - utc(x)) / 1000 / seg) : null;
  });
  reg("DATE_ADD", (v, n, u) => somarData(v, n, u));
  reg("DATE_SUB", (v, n, u) => somarData(v, n === null ? null : -n, u));
  reg("ADDDATE", (v, n, u) => somarData(v, n, u || "day"), true);
  reg("SUBDATE", (v, n, u) => somarData(v, n === null ? null : -n, u || "day"), true);
  reg("CONCAT", (...a) => a.some(x => x === null) ? null : a.map(comoTexto).join(""), true);
  reg("CONCAT_WS", (sep, ...a) => sep === null ? null : a.filter(x => x !== null).map(comoTexto).join(comoTexto(sep)), true);
  reg("LCASE", s => s === null ? null : comoTexto(s).toLowerCase());
  reg("UCASE", s => s === null ? null : comoTexto(s).toUpperCase());
  reg("LEFT", (s, n) => s === null || n === null ? null : [...comoTexto(s)].slice(0, Math.max(0, n)).join(""));
  reg("RIGHT", (s, n) => {
    if (s === null || n === null) return null;
    const a = [...comoTexto(s)];
    return n <= 0 ? "" : a.slice(Math.max(0, a.length - n)).join("");
  });
  reg("TRUNCATE", (x, d) => {
    if (x === null || d === null) return null;
    const f = Math.pow(10, Math.trunc(d));
    return Math.trunc(Number(x) * f) / f;
  });
  reg("MOD", (a, b) => a === null || b === null || Number(b) === 0 ? null : Number(a) % Number(b));
  reg("LOCATE", (sub, s, pos) => {
    if (sub === null || s === null) return null;
    const p = pos === undefined || pos === null ? 1 : Math.max(1, Math.trunc(pos));
    return comoTexto(s).toLowerCase().indexOf(comoTexto(sub).toLowerCase(), p - 1) + 1;
  }, true);
  reg("LPAD", (s, n, p) => {
    if (s === null || n === null || p === null) return null;
    s = comoTexto(s); p = comoTexto(p);
    if (s.length >= n) return s.slice(0, n);
    if (!p) return null;
    return (p.repeat(Math.ceil(n / p.length)) ).slice(0, n - s.length) + s;
  });
  reg("RPAD", (s, n, p) => {
    if (s === null || n === null || p === null) return null;
    s = comoTexto(s); p = comoTexto(p);
    if (s.length >= n) return s.slice(0, n);
    if (!p) return null;
    return s + p.repeat(Math.ceil(n / p.length)).slice(0, n - s.length);
  });
  reg("REVERSE", s => s === null ? null : [...comoTexto(s)].reverse().join(""));
  reg("REPEAT", (s, n) => s === null || n === null ? null : comoTexto(s).repeat(Math.max(0, Math.trunc(n))));
  reg("SPACE", n => n === null ? null : " ".repeat(Math.max(0, Math.trunc(n))));
  reg("SUBSTRING_INDEX", (s, d, n) => {
    if (s === null || d === null || n === null) return null;
    const partes = comoTexto(s).split(comoTexto(d));
    return n >= 0 ? partes.slice(0, n).join(d) : partes.slice(n).join(d);
  });
  reg("FORMAT", (x, d) => {
    if (x === null || d === null) return null;
    const casas = Math.max(0, Math.trunc(d));
    const [int, dec] = Number(x).toFixed(casas).split(".");
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec ? "." + dec : "");
  });
  reg("MY_ISNULL", x => x === null ? 1 : 0);
  reg("RAND", () => Math.random(), true);
  reg("REGEXP", (padrao, valor) => {
    if (padrao === null || valor === null) return null;
    try { return new RegExp(comoTexto(padrao), "i").test(comoTexto(valor)) ? 1 : 0; } catch { return 0; }
  });
  reg("DATABASE", () => sessao.ativo);
  reg("SCHEMA", () => sessao.ativo);
  reg("VERSION", () => "8.0.36 (Bancada SQL)");
  reg("USER", () => "aluno@localhost");
  reg("CURRENT_USER", () => "aluno@localhost");
}

// nomes de função do MySQL trocados por equivalentes do SQLite
const FUNCOES_TROCADAS = {
  IF: "IIF", CHAR_LENGTH: "LENGTH", CHARACTER_LENGTH: "LENGTH", MID: "SUBSTR", DAYOFMONTH: "DAY",
  CURRENT_DATE: "CURDATE", CURRENT_TIME: "CURTIME", CURRENT_TIMESTAMP: "NOW", LOCALTIME: "NOW", LOCALTIMESTAMP: "NOW",
  POW: "POWER", CEILING: "CEIL", GREATEST: "MAX", LEAST: "MIN", ISNULL: "MY_ISNULL", UTC_DATE: "CURDATE", UTC_TIMESTAMP: "NOW",
  LAST_INSERT_ID: "LAST_INSERT_ROWID"
};
const UNIDADES = new Set(["SECOND", "MINUTE", "HOUR", "DAY", "WEEK", "MONTH", "QUARTER", "YEAR"]);
const TIPOS = new Set(["INT", "INTEGER", "TINYINT", "SMALLINT", "MEDIUMINT", "BIGINT", "DECIMAL", "DEC", "NUMERIC", "FIXED",
  "FLOAT", "DOUBLE", "REAL", "BIT", "BOOL", "BOOLEAN", "CHAR", "VARCHAR", "NCHAR", "NVARCHAR", "TEXT", "TINYTEXT",
  "MEDIUMTEXT", "LONGTEXT", "BINARY", "VARBINARY", "BLOB", "TINYBLOB", "MEDIUMBLOB", "LONGBLOB", "DATE", "DATETIME",
  "TIMESTAMP", "TIME", "YEAR", "ENUM", "SET", "JSON"]);
const INTEIROS = new Set(["INT", "INTEGER", "TINYINT", "SMALLINT", "MEDIUMINT", "BIGINT"]);
const TEXTUAIS = new Set(["CHAR", "VARCHAR", "NCHAR", "NVARCHAR", "TEXT", "TINYTEXT", "MEDIUMTEXT", "LONGTEXT", "ENUM", "SET"]);
const INICIO_RESTRICAO = new Set(["PRIMARY", "UNIQUE", "KEY", "INDEX", "CONSTRAINT", "FOREIGN", "CHECK", "FULLTEXT", "SPATIAL"]);

// "DECIMAL", "10,2" → "decimal(10,2)" (como o MySQL 8 mostra no DESCRIBE)
function tipoExibicao(tipo, args, unsigned, zerofill) {
  const T = minusc(tipo);
  let b;
  switch (tipo) {
    case "INT": case "INTEGER": b = "int"; break;
    case "TINYINT": b = args === "1" ? "tinyint(1)" : "tinyint"; break;
    case "BOOL": case "BOOLEAN": b = "tinyint(1)"; break;
    case "SMALLINT": case "MEDIUMINT": case "BIGINT": b = T; break;
    case "DECIMAL": case "DEC": case "NUMERIC": case "FIXED": {
      const [p = "10", s = "0"] = (args || "").split(",").map(x => x.trim()).filter(Boolean);
      b = `decimal(${p},${s})`;
      break;
    }
    case "CHAR": case "NCHAR": b = `char(${args || 1})`; break;
    case "VARCHAR": case "NVARCHAR": b = `varchar(${args})`; break;
    case "REAL": b = "double"; break;
    case "BIT": b = `bit(${args || 1})`; break;
    default: b = args ? `${T}(${args})` : T;
  }
  if (unsigned) b += " unsigned";
  if (zerofill) b += " zerofill";
  return b;
}

// =====================================================================================
// Sessão: um banco SQLite + o "estado MySQL" (bancos virtuais, banco ativo, safe updates)
// =====================================================================================
class Sessao {
  constructor(SQL, nomeBanco, { leniente = false } = {}) {
    this.SQL = SQL;
    this.principal = String(nomeBanco || "banco");
    this.leniente = leniente;   // usado na correção: CREATE DATABASE de banco existente vira aviso
    this.db = null;
    this.criarDb();
  }

  criarDb() {
    try { this.db?.close(); } catch { /* já fechado */ }
    this.db = new this.SQL.Database();
    registrarFuncoes(this.db, this);
    this.db.run("PRAGMA foreign_keys = ON");
    this.bancos = [this.principal];
    this.ativo = this.principal;
    this.seguro = true;
    this.tipos = {};      // tabela(minúsc.) → { coluna(minúsc.): "tipo como no MySQL" }
  }

  fechar() { try { this.db?.close(); } catch { /* ok */ } this.db = null; }

  // ---------- execução ----------
  executarScript(texto, { parar = true, limite = LIMITE_SESSAO } = {}) {
    const res = [];
    for (const cmd of dividir(String(texto || ""))) {
      const r = this.executar(cmd, limite);
      res.push(r);
      if (!r.ok && parar) break;
    }
    return res;
  }

  executar(cmd, limite = LIMITE_SESSAO) {
    const t0 = (globalThis.performance || Date).now();
    const r = { acao: resumoAcao(cmd.texto), texto: cmd.texto, ok: true, mensagem: "", resultado: null };
    this.cmd = cmd;
    this.ctx = {};
    try {
      if (cmd.incompleto) throw new ErroSintaxe(cmd.incompleto);
      Object.assign(r, this.despachar(new Cur(cmd.toks), limite));
    } catch (e) {
      const er = e instanceof ErroMy ? e : e instanceof ErroSintaxe ? this.erroSintaxe(e) : this.traduzirErro(e);
      r.ok = false;
      r.codigo = er.codigo;
      r.mensagem = er.message;
    }
    r.duracao = ((globalThis.performance || Date).now() - t0) / 1000;
    return r;
  }

  despachar(c, limite) {
    const t0 = c.ver();
    if (ehOp(t0, "(")) return this.consulta(c, limite);
    switch (c.u()) {
      case "SELECT": case "WITH": case "VALUES": case "TABLE": return this.consulta(c, limite);
      case "INSERT": case "REPLACE": return this.inserir(c);
      case "UPDATE": return this.atualizar(c);
      case "DELETE": return this.apagar(c);
      case "CREATE": return this.criar(c);
      case "DROP": return this.derrubar(c);
      case "ALTER": return this.alterar(c);
      case "RENAME": return this.renomearTabelas(c);
      case "TRUNCATE": return this.truncar(c);
      case "USE": return this.usar(c);
      case "SHOW": return this.mostrar(c);
      case "DESCRIBE": case "DESC": case "EXPLAIN": return this.descreverCmd(c);
      case "SET": return this.definir(c);
      case "START": case "BEGIN": case "COMMIT": case "ROLLBACK": case "SAVEPOINT": case "RELEASE": return this.transacao(c);
      case "GRANT": case "REVOKE": case "FLUSH":
        throw this.naoSuportado("usuários e permissões (GRANT, REVOKE, CREATE USER)");
      case "CALL": case "DELIMITER": case "LOAD": case "SOURCE": case "LOCK": case "UNLOCK": case "HANDLER": case "DO":
      case "PREPARE": case "EXECUTE": case "DEALLOCATE": case "OPTIMIZE": case "ANALYZE": case "CHECK": case "REPAIR": case "KILL":
        throw this.naoSuportado(c.u());
      case "PRAGMA": case "ATTACH": case "DETACH": case "VACUUM": case "REINDEX":
        throw this.erroSintaxe(new ErroSintaxe(t0));
      default:
        throw this.erroSintaxe(new ErroSintaxe(t0));
    }
  }

  // ---------- auxiliares de banco ----------
  rodar(sql, limite = Infinity) {
    const st = this.db.prepare(sql);
    try {
      const colunas = st.getColumnNames();
      const linhas = [];
      if (colunas.length) { while (linhas.length < limite && st.step()) linhas.push(st.get()); }
      else st.step();
      return { colunas, linhas };
    } finally { st.free(); }
  }
  q(sql, params = []) {
    const st = this.db.prepare(sql);
    try {
      if (params.length) st.bind(params);
      const r = [];
      while (st.step()) r.push(st.getAsObject());
      return r;
    } finally { st.free(); }
  }
  ehBanco(nome) { return this.bancos.some(b => minusc(b) === minusc(nome)); }
  exigirBanco() { if (!this.ativo) throw new ErroMy(1046, "No database selected"); }
  nomeBd() { return this.ativo || this.principal; }
  listarTabelas() {
    return this.q("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__bsql%' ORDER BY lower(name)")
      .map(r => ({ nome: r.name, tipo: r.type }));
  }
  tabela(nome, { view = true } = {}) {
    const r = this.q("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND lower(name) = lower(?) AND name NOT LIKE '__bsql%'", [String(nome)])[0];
    if (!r || (!view && r.type !== "table")) return null;
    return r.name;
  }
  exigirTabela(nome) {
    this.exigirBanco();
    const t = this.tabela(nome, { view: false });
    if (!t) throw new ErroMy(1146, `Table '${this.nomeBd()}.${nome}' doesn't exist`);
    return t;
  }
  fkLigadas() { return Number(this.q("PRAGMA foreign_keys")[0]?.foreign_keys) === 1; }

  // nome de tabela possivelmente qualificado (loja.produtos)
  nomeQualificado(c) {
    const t = c.ver();
    const a = c.nome();
    if (!a) throw new ErroSintaxe(t || null);
    if (c.op(".")) {
      c.pega();
      const t2 = c.ver();
      const b = c.nome();
      if (!b) throw new ErroSintaxe(t2 || null);
      if (!this.ehBanco(a)) throw new ErroMy(1049, `Unknown database '${a}'`);
      return b;
    }
    return a;
  }

  // Lê o CREATE TABLE que o SQLite guardou (já traduzido) e separa as definições
  analisar(tabela) {
    const r = this.q("SELECT sql FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(?)", [tabela])[0];
    if (!r) return null;
    const k = significativos(tokenizar(r.sql, true));
    const c = new Cur(k);
    while (!c.fim && !c.op("(")) c.pega();
    const dentro = c.parenteses() || [];
    const defs = dividirVirgulas(dentro).map(toks => {
      const u0 = toks[0].t === "pal" ? toks[0].u : "";
      const res = ["CONSTRAINT", "PRIMARY", "UNIQUE", "CHECK", "FOREIGN"].includes(u0);
      return { tipo: res ? "res" : "col", nome: res ? null : nomeDe(toks[0]), toks, sql: emitir(toks) };
    });
    return { sql: r.sql, defs };
  }

  // chaves estrangeiras da tabela (na ordem em que foram declaradas)
  fks(tabela) {
    const est = this.analisar(tabela);
    if (!est) return [];
    const r = [];
    for (const d of est.defs) {
      const k = d.toks;
      const j = k.findIndex(t => ehPal(t, "REFERENCES"));
      if (j < 0) continue;
      const ic = k.findIndex(t => ehPal(t, "CONSTRAINT"));
      const nome = ic >= 0 && ic < j ? nomeDe(k[ic + 1]) : null;
      let cols;
      if (d.tipo === "col") cols = [d.nome];
      else {
        const f = k.findIndex(t => ehPal(t, "FOREIGN"));
        const cf = new Cur(k, f + 2);
        cols = nomesColunas(cf.parenteses() || []);
      }
      const c = new Cur(k, j + 1);
      const ref = c.nome();
      const refCols = c.op("(") ? nomesColunas(c.parenteses()) : [];
      let onDelete = "", onUpdate = "";
      while (c.aceita("ON")) {
        const ev = c.pega()?.u;
        let acao = "";
        if (c.aceita("SET", "NULL")) acao = "SET NULL";
        else if (c.aceita("SET", "DEFAULT")) acao = "SET DEFAULT";
        else if (c.aceita("NO", "ACTION")) acao = "NO ACTION";
        else acao = c.pega()?.u || "";
        if (ev === "DELETE") onDelete = acao; else onUpdate = acao;
      }
      r.push({ nome: nome || `${tabela}_ibfk_${r.length + 1}`, cols, ref, refCols, onDelete, onUpdate, def: d });
    }
    return r;
  }
  // FKs de outras tabelas que apontam para esta
  filhas(tabela) {
    const r = [];
    for (const t of this.listarTabelas()) {
      if (t.tipo !== "table") continue;
      for (const fk of this.fks(t.nome)) if (minusc(fk.ref) === minusc(tabela)) r.push({ tabela: t.nome, fk });
    }
    return r;
  }
  indices(tabela) {
    return this.q(`PRAGMA index_list(${idt(tabela)})`).map(ix => ({
      nome: ix.name, unico: !!ix.unique, origem: ix.origin,
      cols: this.q(`PRAGMA index_info(${idt(ix.name)})`).sort((a, b) => a.seqno - b.seqno).map(x => x.name)
    }));
  }
  colunasChave(tabela) {
    const s = new Set();
    for (const c of this.q(`PRAGMA table_info(${idt(tabela)})`)) if (c.pk > 0) s.add(minusc(c.name));
    for (const ix of this.indices(tabela)) ix.cols.forEach(c => c && s.add(minusc(c)));
    for (const fk of this.fks(tabela)) fk.cols.forEach(c => s.add(minusc(c)));
    return s;
  }
  textoFk(tabela, fk) {
    return `(${crase(this.nomeBd())}.${crase(tabela)}, CONSTRAINT ${crase(fk.nome)} FOREIGN KEY (${fk.cols.map(crase).join(", ")}) REFERENCES ${crase(fk.ref)} (${fk.refCols.map(crase).join(", ")}))`;
  }

  // ---------- tradução de expressões ----------
  traduzirExpr(toks) {
    toks = [...toks];
    const out = [];
    let intervalo = -1, prof = 0;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i], prox = toks[i + 1];
      if (ehOp(t, "(")) prof++;
      else if (ehOp(t, ")")) prof--;
      if (t.t === "str") { out.push({ ...t, v: lit(t.n) }); continue; }
      if ((t.t === "id" || t.t === "pal") && ehOp(prox, ".") && !ehOp(toks[i - 1], ".") && toks[i + 2]
        && (toks[i + 2].t === "id" || toks[i + 2].t === "pal" || ehOp(toks[i + 2], "*")) && this.ehBanco(nomeDe(t))
        && (ehOp(toks[i + 3], ".") || !this.ehAliasOuTabela(toks, nomeDe(t)))) {
        // "loja.produtos" → "produtos" (o banco é um só)
        i++;
        if (toks[i + 1]) toks[i + 1] = { ...toks[i + 1], esp: t.esp };
        continue;
      }
      if (t.t === "id") { out.push({ ...t, v: idt(t.n) }); continue; }
      if (t.t === "pal") {
        const u = t.u;
        if (u.startsWith("@")) throw this.naoSuportado("variáveis (@nome)");
        if (ehOp(prox, "(")) {
          if (FUNCOES_TROCADAS[u]) { out.push({ ...t, v: FUNCOES_TROCADAS[u] }); continue; }
          if (u === "TIMESTAMPDIFF" && toks[i + 2]?.t === "pal" && UNIDADES.has(toks[i + 2].u)) {
            out.push(t, toks[i + 1], { ...toks[i + 2], v: lit(toks[i + 2].u) });
            i += 2; prof++;
            continue;
          }
          out.push(t);
          continue;
        }
        const ant = out[out.length - 1];
        if (ant && ehPal(ant, "AS") && (ehOp(prox, ")") || ehOp(prox, "(") || ehPal(prox, "INTEGER") || ehPal(prox, "INT"))) {
          // CAST(x AS SIGNED / CHAR / DATE ...)
          const mapa = { SIGNED: "INTEGER", UNSIGNED: "INTEGER", CHAR: "TEXT", NCHAR: "TEXT", DATE: "TEXT", DATETIME: "TEXT", TIME: "TEXT", BINARY: "BLOB" };
          if (mapa[u]) {
            out.push({ ...t, v: mapa[u] });
            if (ehPal(prox, "INTEGER") || ehPal(prox, "INT")) i++;
            else if (ehOp(prox, "(")) { let p = 0; do { const x = toks[++i]; if (ehOp(x, "(")) p++; else if (ehOp(x, ")")) p--; } while (p > 0 && i < toks.length - 1); }
            continue;
          }
        }
        if (u === "CURRENT_DATE") { out.push({ ...t, v: "CURDATE()" }); continue; }
        if (u === "CURRENT_TIME") { out.push({ ...t, v: "CURTIME()" }); continue; }
        if (u === "CURRENT_TIMESTAMP" || u === "LOCALTIME" || u === "LOCALTIMESTAMP") { out.push({ ...t, v: "NOW()" }); continue; }
        if (u === "DIV") { out.push({ ...t, v: "/" }); continue; }
        if (u === "MOD") { out.push({ ...t, v: "%" }); continue; }
        if (u === "SEPARATOR") { out.push({ ...t, v: "," }); continue; }
        if (u === "INTERVAL") { intervalo = prof; continue; }
        if (intervalo === prof && UNIDADES.has(u)) { out.push(novo(","), novo(lit(u))); intervalo = -1; continue; }
        if (u === "DUAL" && ehPal(ant, "FROM")) { out.pop(); continue; }
        if (u === "XOR") throw this.naoSuportado("XOR");
        out.push(t);
        continue;
      }
      if (t.t === "op") {
        if (t.v === "/") { out.push({ ...t, v: "*" }, novo("1.0"), novo("/")); continue; }   // divisão sempre decimal, como no MySQL
        if (t.v === "||") { out.push({ ...t, v: "OR" }); continue; }
        if (t.v === "&&") { out.push({ ...t, v: "AND" }); continue; }
        if (t.v === "<=>") { out.push({ ...t, v: "IS" }); continue; }
        if (t.v === ":=" || t.v === "->" || t.v === "->>") throw new ErroSintaxe(t);
      }
      out.push(t);
    }
    return out;
  }
  // o nome é usado como tabela/apelido no comando? (então "x.col" não é "banco.tabela")
  ehAliasOuTabela(toks, nome) {
    const n = minusc(nome);
    return toks.some((t, i) => i > 0 && nomeDe(t) && minusc(nomeDe(t)) === n && !ehOp(toks[i + 1], ".")
      && (ehPal(toks[i - 1], "AS") || toks[i - 1].t === "id" || (toks[i - 1].t === "pal" && !["SELECT", "WHERE", "ON", "AND", "OR", "BY", "SET", ","].includes(toks[i - 1].u))));
  }
  expr(toks) { return emitir(this.traduzirExpr(toks)); }

  // ---------- SELECT ----------
  consulta(c, limite) {
    const k = c.resto();
    if (!this.ativo && k.some(t => ehPal(t, "FROM") && !ehPal(k[k.indexOf(t) + 1], "DUAL"))) this.exigirBanco();
    if (ehPal(k[0], "TABLE")) {   // TABLE t  → SELECT * FROM t
      const cur = new Cur(k, 1);
      const t = this.nomeQualificado(cur);
      return this.consultaSql(`SELECT * FROM ${idt(t)} ${this.expr(cur.resto())}`, limite);
    }
    const res = this.consultaSql(this.expr(k), limite);
    // nomes das colunas como o MySQL mostra (o texto original de cada expressão sem apelido)
    const nomes = this.nomesOriginais(k);
    if (nomes && !nomes.includes("*") && nomes.length === res.resultado.colunas.length)
      res.resultado.colunas = res.resultado.colunas.map((c, i) => nomes[i] ?? c);
    return res;
  }
  consultaSql(sql, limite) {
    const r = this.rodar(sql, limite);
    return { mensagem: `${r.linhas.length} row(s) returned`, resultado: r, consulta: true };
  }
  nomesOriginais(k) {
    if (!ehPal(k[0], "SELECT")) return null;
    let i = 1;
    while (["DISTINCT", "ALL", "DISTINCTROW", "SQL_CALC_FOUND_ROWS", "SQL_NO_CACHE"].includes(k[i]?.u)) i++;
    let fim = k.length, prof = 0;
    for (let j = i; j < k.length; j++) {
      const t = k[j];
      if (ehOp(t, "(")) prof++;
      else if (ehOp(t, ")")) prof--;
      else if (prof === 0 && ["FROM", "WHERE", "GROUP", "HAVING", "ORDER", "LIMIT", "UNION", "INTO", "WINDOW", "EXCEPT", "INTERSECT"].includes(t.u)) { fim = j; break; }
    }
    const NAO_APELIDO = new Set(["END", "NULL", "TRUE", "FALSE", "ASC", "DESC"]);
    const OPERADORES = new Set(["LIKE", "IS", "NOT", "AND", "OR", "IN", "BETWEEN", "REGEXP", "DIV", "MOD", "XOR", "ELSE", "THEN", "WHEN", "CASE", "BINARY", "INTERVAL", "ESCAPE"]);
    const base = this.cmd?.ini || 0, texto = this.cmd?.texto || "";
    return dividirVirgulas(k.slice(i, fim)).map(it => {
      const n = it.length, ult = it[n - 1], pen = it[n - 2];
      if (ehOp(ult, "*") && (n === 1 || (n === 3 && ehOp(it[1], ".")))) return "*";
      if (n >= 2 && ehPal(pen, "AS")) return null;
      if (n >= 2 && (ult.t === "id" || ult.t === "str" || (ult.t === "pal" && !NAO_APELIDO.has(ult.u)))
        && (ehOp(pen, ")") || pen.t === "id" || pen.t === "num" || pen.t === "str" || (pen.t === "pal" && !OPERADORES.has(pen.u)))) return null;
      if (n === 1 && (ult.t === "id" || ult.t === "pal")) return null;
      if (n === 3 && ehOp(it[1], ".") && (ult.t === "id" || ult.t === "pal")) return null;
      if (n === 1 && ult.t === "str") return ult.n;
      return texto.slice(it[0].p - base, ult.p - base + ult.v.length) || null;
    });
  }

  // ---------- INSERT / REPLACE ----------
  inserir(c) {
    this.exigirBanco();
    const verbo = c.pega().u;
    let ignorar = false;
    while (["LOW_PRIORITY", "DELAYED", "HIGH_PRIORITY", "IGNORE"].includes(c.u())) if (c.pega().u === "IGNORE") ignorar = true;
    c.aceita("INTO");
    const tabela = this.exigirTabela(this.nomeQualificado(c));
    if (c.u() === "SET") throw this.naoSuportado("INSERT ... SET (use INSERT INTO tabela (colunas) VALUES (...))");
    let colunas = null;
    if (c.op("(") && !ehPal(c.ver(1), "SELECT") && !ehPal(c.ver(1), "WITH")) colunas = nomesColunas(c.parenteses());
    let resto = c.resto();
    if (ehPal(resto[0], "VALUE")) resto = [{ ...resto[0], v: "VALUES", u: "VALUES" }, ...resto.slice(1)];
    this.ctx = { tipo: "INSERT", tabela, colunas };
    let upd = null;
    const iOn = resto.findIndex((t, i) => ehPal(t, "ON") && ehPal(resto[i + 1], "DUPLICATE") && ehPal(resto[i + 2], "KEY") && ehPal(resto[i + 3], "UPDATE"));
    if (iOn >= 0) { upd = resto.slice(iOn + 4); resto = resto.slice(0, iOn); }
    let sql = (verbo === "REPLACE" ? "REPLACE" : ignorar ? "INSERT OR IGNORE" : "INSERT") + " INTO " + idt(tabela)
      + (colunas ? ` (${colunas.map(idt).join(", ")})` : "") + " " + this.expr(resto);
    if (upd) {
      const u2 = [];
      for (let i = 0; i < upd.length; i++) {
        if (ehPal(upd[i], "VALUES") && ehOp(upd[i + 1], "(") && ehOp(upd[i + 3], ")")) {
          u2.push(novo("excluded"), { ...novo("."), esp: false }, { ...upd[i + 2], esp: false });
          i += 3;
        } else u2.push(upd[i]);
      }
      sql += " ON CONFLICT DO UPDATE SET " + this.expr(u2);
    }
    this.rodar(sql);
    const n = this.db.getRowsModified();
    let tuplas = 0, prof = 0;
    for (const t of resto) { if (ehOp(t, "(")) { if (prof === 0) tuplas++; prof++; } else if (ehOp(t, ")")) prof--; }
    const varias = ehPal(resto[0], "SELECT") || tuplas > 1;
    return { mensagem: varias ? `${n} row(s) affected Records: ${n}  Duplicates: 0  Warnings: 0` : `${n} row(s) affected` };
  }

  // ---------- UPDATE ----------
  atualizar(c) {
    this.exigirBanco();
    c.pega();
    while (["LOW_PRIORITY", "IGNORE"].includes(c.u())) c.pega();
    const tabela = this.nomeQualificado(c);
    const k = c.resto();
    const iSet = acharNivel0(k, "SET");
    if (iSet < 0) throw new ErroSintaxe(k[0] || null);
    const antes = k.slice(0, iSet);
    if (antes.some(t => ehOp(t, ",") || ["JOIN", "INNER", "LEFT", "RIGHT", "CROSS"].includes(t.u)))
      throw this.naoSuportado("UPDATE com JOIN (use uma subconsulta: UPDATE t SET ... WHERE id IN (SELECT ...))");
    const real = this.exigirTabela(tabela);
    const iWhere = acharNivel0(k, "WHERE", iSet);
    if (acharNivel0(k, "LIMIT", iSet) >= 0 || acharNivel0(k, "ORDER", iSet) >= 0) throw this.naoSuportado("UPDATE com ORDER BY/LIMIT");
    const sets = dividirVirgulas(k.slice(iSet + 1, iWhere < 0 ? k.length : iWhere)).map(p => nomeDe(p[ehOp(p[1], ".") ? 2 : 0])).filter(Boolean);
    this.ctx = { tipo: "UPDATE", tabela: real, colsSet: sets };
    if (this.seguro) this.verificarSeguro(real, k, iWhere);
    this.rodar(`UPDATE ${idt(real)} ${this.expr(comAs(k))}`);
    const n = this.db.getRowsModified();
    return { mensagem: `${n} row(s) affected Rows matched: ${n}  Changed: ${n}  Warnings: 0` };
  }

  // ---------- DELETE ----------
  apagar(c) {
    this.exigirBanco();
    c.pega();
    while (["LOW_PRIORITY", "QUICK", "IGNORE"].includes(c.u())) c.pega();
    if (!c.aceita("FROM")) throw this.naoSuportado("DELETE de várias tabelas (use DELETE FROM tabela WHERE ...)");
    const tabela = this.nomeQualificado(c);
    const k = c.resto();
    if (k.some(t => ["JOIN", "USING"].includes(t.u)) || ehOp(k[0], ",")) throw this.naoSuportado("DELETE com JOIN (use uma subconsulta no WHERE)");
    const real = this.exigirTabela(tabela);
    const iWhere = acharNivel0(k, "WHERE");
    if (acharNivel0(k, "LIMIT") >= 0 || acharNivel0(k, "ORDER") >= 0) throw this.naoSuportado("DELETE com ORDER BY/LIMIT");
    this.ctx = { tipo: "DELETE", tabela: real };
    if (this.seguro) this.verificarSeguro(real, k, iWhere);
    this.rodar(`DELETE FROM ${idt(real)} ${this.expr(comAs(k))}`);
    const n = this.db.getRowsModified();
    return { mensagem: `${n} row(s) affected` };
  }

  verificarSeguro(tabela, k, iWhere) {
    const erro = () => new ErroMy(1175, "You are using safe update mode and you tried to update a table without a WHERE that uses a KEY column. To disable safe mode, run: SET SQL_SAFE_UPDATES = 0;");
    if (iWhere < 0) throw erro();
    const chaves = this.colunasChave(tabela);
    const usa = k.slice(iWhere + 1).some(t => (t.t === "id" || t.t === "pal") && chaves.has(minusc(nomeDe(t))));
    if (!usa) throw erro();
  }

  // ---------- CREATE ----------
  criar(c) {
    c.pega();
    if (c.aceita("OR", "REPLACE")) return this.criarView(c, true);
    if (c.u() === "DATABASE" || c.u() === "SCHEMA") { c.pega(); return this.criarBanco(c); }
    if (c.u() === "TEMPORARY") c.pega();
    if (c.aceita("TABLE")) return this.criarTabela(c);
    if (c.aceita("UNIQUE", "INDEX")) return this.criarIndice(c, true);
    if (c.aceita("INDEX")) return this.criarIndice(c, false);
    while (["ALGORITHM", "DEFINER", "SQL"].includes(c.u())) { c.pega(); if (c.op("=")) { c.pega(); c.pega(); } else c.pega(); }
    if (c.aceita("VIEW")) return this.criarView(c, false, true);
    if (["USER", "ROLE"].includes(c.u())) throw this.naoSuportado("usuários e permissões (CREATE USER, GRANT, REVOKE)");
    if (["PROCEDURE", "FUNCTION", "TRIGGER", "EVENT"].includes(c.u())) throw this.naoSuportado(`CREATE ${c.u()}`);
    throw new ErroSintaxe(c.ver() || null);
  }

  criarBanco(c) {
    const seNao = c.aceita("IF", "NOT", "EXISTS");
    const t = c.ver();
    const nome = c.nome();
    if (!nome) throw new ErroSintaxe(t || null);
    if (this.ehBanco(nome)) {
      if (seNao || this.leniente) return { mensagem: `1 row(s) affected, 1 warning(s): 1007 Can't create database '${nome}'; database exists` };
      throw new ErroMy(1007, `Can't create database '${nome}'; database exists`);
    }
    this.bancos.push(nome);
    return { mensagem: "1 row(s) affected" };
  }

  criarTabela(c) {
    const seNao = c.aceita("IF", "NOT", "EXISTS");
    const nome = this.nomeQualificado(c);
    this.exigirBanco();
    if (this.tabela(nome)) {
      if (seNao) return { mensagem: `0 row(s) affected, 1 warning(s): 1050 Table '${nome}' already exists` };
      throw new ErroMy(1050, `Table '${nome}' already exists`);
    }
    if (c.aceita("LIKE")) {
      const orig = this.exigirTabela(this.nomeQualificado(c));
      const est = this.analisar(orig);
      this.rodar(`CREATE TABLE ${idt(nome)} (${est.defs.map(d => d.sql).join(", ")})`);
      this.tipos[minusc(nome)] = { ...(this.tipos[minusc(orig)] || {}) };
      return { mensagem: "0 row(s) affected" };
    }
    if (c.u() === "AS" || c.u() === "SELECT") {
      c.aceita("AS");
      this.rodar(`CREATE TABLE ${idt(nome)} AS ${this.expr(c.resto())}`);
      const n = this.q(`SELECT count(*) AS n FROM ${idt(nome)}`)[0].n;
      return { mensagem: `${n} row(s) affected Records: ${n}  Duplicates: 0  Warnings: 0` };
    }
    if (!c.op("(")) throw new ErroSintaxe(c.ver() || null);
    const defs = c.parenteses();
    // depois do ")": ENGINE=..., DEFAULT CHARSET=..., COLLATE=..., AUTO_INCREMENT=... → ignorados
    while (!c.fim) {
      const t = c.pega();
      if (t.t === "pal" && (t.u === "AS" || t.u === "SELECT")) throw this.naoSuportado("CREATE TABLE (...) SELECT");
    }
    const tr = this.traduzirDefinicoes(nome, defs);
    this.rodar(`CREATE TABLE ${idt(nome)} (${tr.sql.join(", ")})`);
    for (const s of tr.indices) this.rodar(s);
    this.tipos[minusc(nome)] = tr.tipos;
    return { mensagem: "0 row(s) affected" };
  }

  // traduz a lista de definições de um CREATE TABLE (colunas + restrições)
  traduzirDefinicoes(tabela, defsToks, fkInicial = 0) {
    const cols = [], res = [], indices = [], tipos = {};
    let pk = null;
    const ctx = { nFk: fkInicial, tabela };
    for (const d of dividirVirgulas(defsToks)) {
      if (d[0].t === "pal" && INICIO_RESTRICAO.has(d[0].u)) {
        const r = this.traduzirRestricao(d, ctx);
        if (r.pk) { if (pk) throw new ErroMy(1068, "Multiple primary key defined"); pk = r.pk; }
        if (r.sql) res.push(r.sql);
        if (r.indice) indices.push(r.indice);
      } else cols.push(this.traduzirColuna(d, ctx));
    }
    if (!cols.length) throw new ErroMy(4028, "A table must have at least one visible column.");
    const inline = cols.filter(x => x.pk);
    if (inline.length > 1 || (inline.length && pk)) throw new ErroMy(1068, "Multiple primary key defined");
    const nomesPk = new Set((pk || inline.map(x => x.nome)).map(minusc));
    const sql = [];
    for (const col of cols) {
      const naPk = nomesPk.has(minusc(col.nome));
      const pkUnica = naPk && nomesPk.size === 1;
      if (col.auto && !pkUnica) throw new ErroMy(1075, "Incorrect table definition; there can be only one auto column and it must be defined as a key");
      // PRIMARY KEY na própria coluna: se foi declarada nela, ou se é a AUTO_INCREMENT (o SQLite exige)
      const pkNaColuna = pkUnica && (col.pk || col.auto);
      sql.push(this.montarColuna(col, naPk, pkNaColuna));
      tipos[minusc(col.nome)] = col.exib;
    }
    const nomes = new Set();
    for (const col of cols) {
      if (nomes.has(minusc(col.nome))) throw new ErroMy(1060, `Duplicate column name '${col.nome}'`);
      nomes.add(minusc(col.nome));
    }
    if (pk && !(pk.length === 1 && cols.find(x => minusc(x.nome) === minusc(pk[0]))?.auto)) {
      for (const p of pk) if (!nomes.has(minusc(p))) throw new ErroMy(1072, `Key column '${p}' doesn't exist in table`);
      res.unshift(`PRIMARY KEY (${pk.map(idt).join(", ")})`);
    }
    return { sql: [...sql, ...res], indices, tipos };
  }

  montarColuna(col, naPk, pkUnica) {
    const p = [idt(col.nome), col.auto ? "INTEGER" : col.tipoSqlite];
    if (TEXTUAIS.has(col.tipo)) p.push("COLLATE NOCASE");
    if (col.notnull || naPk) p.push("NOT NULL");
    if (naPk && pkUnica) p.push(col.auto ? "PRIMARY KEY AUTOINCREMENT" : "PRIMARY KEY");
    if (col.unico) p.push("UNIQUE");
    if (col.padrao !== null) p.push("DEFAULT " + col.padrao);
    if (col.gerado) p.push(`GENERATED ALWAYS AS (${col.gerado})`);
    if (col.enumVals) p.push(`CONSTRAINT ${idt("enum_" + col.nome)} CHECK (${idt(col.nome)} IN (${col.enumVals}))`);
    for (const ch of col.checks) p.push(ch);
    for (const r of col.refs) p.push(r);
    return p.join(" ");
  }

  traduzirColuna(d, ctx) {
    const c = new Cur(d);
    const nome = c.nome();
    if (!nome) throw new ErroSintaxe(d[0]);
    const tt = c.pega();
    if (!tt || tt.t !== "pal" || !TIPOS.has(tt.u)) throw new ErroSintaxe(tt || null, tt ? null : "");
    const tipo = tt.u;
    if (tipo === "DOUBLE") c.aceita("PRECISION");
    let args = null;
    if (c.op("(")) {
      const a = c.parenteses();
      args = tipo === "ENUM" || tipo === "SET"
        ? a.filter(t => t.t === "str").map(t => lit(t.n)).join(",")
        : a.map(t => t.v).join("");
    }
    if ((tipo === "VARCHAR" || tipo === "NVARCHAR") && !args) throw new ErroSintaxe(c.ver() || null, "");
    if ((tipo === "ENUM" || tipo === "SET") && !args) throw new ErroSintaxe(c.ver() || null, "");
    let unsigned = false, zerofill = false;
    while (["UNSIGNED", "SIGNED", "ZEROFILL"].includes(c.u())) {
      const x = c.pega().u;
      if (x === "UNSIGNED") unsigned = true;
      if (x === "ZEROFILL") { zerofill = true; unsigned = true; }
    }
    const col = {
      nome, tipo, exib: tipoExibicao(tipo, args, unsigned, zerofill),
      tipoSqlite: tipo === "ENUM" || tipo === "SET" || tipo === "JSON" ? "TEXT" : tipo === "REAL" ? "DOUBLE" : tipo + (args ? `(${args})` : ""),
      enumVals: tipo === "ENUM" ? args : null,
      auto: false, pk: false, notnull: false, unico: false, padrao: null, gerado: null, checks: [], refs: []
    };
    let nomeRestricao = null;
    while (!c.fim) {
      if (c.aceita("NOT", "NULL")) col.notnull = true;
      else if (c.aceita("NULL")) col.notnull = false;
      else if (c.aceita("DEFAULT")) col.padrao = this.valorPadrao(c);
      else if (c.aceita("AUTO_INCREMENT")) col.auto = true;
      else if (c.aceita("PRIMARY", "KEY") || c.aceita("KEY")) col.pk = true;
      else if (c.aceita("UNIQUE")) { c.aceita("KEY"); col.unico = true; }
      else if (c.aceita("COMMENT")) c.pega();
      else if (c.aceita("COLLATE")) c.pega();
      else if (c.aceita("CHARACTER", "SET") || c.aceita("CHARSET")) c.pega();
      else if (c.aceita("ON", "UPDATE")) { c.pega(); if (c.op("(")) c.parenteses(); }
      else if (c.aceita("VISIBLE") || c.aceita("INVISIBLE")) { /* nada */ }
      else if (c.aceita("CONSTRAINT")) { nomeRestricao = c.nome(); continue; }
      else if (c.u() === "REFERENCES") {
        ctx.nFk++;
        const ref = this.clausulaRef(c, ctx.tabela, [nome]);
        col.refs.push(`CONSTRAINT ${idt(nomeRestricao || `${ctx.tabela}_ibfk_${ctx.nFk}`)} ${ref}`);
      } else if (c.aceita("CHECK")) {
        const e = c.parenteses();
        if (!e) throw new ErroSintaxe(c.ver() || null);
        col.checks.push((nomeRestricao ? `CONSTRAINT ${idt(nomeRestricao)} ` : "") + `CHECK (${this.expr(e)})`);
        c.aceita("NOT"); c.aceita("ENFORCED");
      } else if (c.u() === "GENERATED" || c.u() === "AS") {
        c.aceita("GENERATED", "ALWAYS");
        c.aceita("AS");
        const e = c.parenteses();
        if (!e) throw new ErroSintaxe(c.ver() || null);
        col.gerado = this.expr(e);
        if (c.u() === "STORED" || c.u() === "VIRTUAL") c.pega();
      } else throw new ErroSintaxe(c.ver());
      nomeRestricao = null;
    }
    if (col.auto && !INTEIROS.has(tipo)) throw new ErroMy(1063, `Incorrect column specifier for column '${nome}'`);
    return col;
  }

  valorPadrao(c) {
    const t = c.ver();
    if (!t) throw new ErroSintaxe(null, "");
    if (c.op("(")) return "(" + this.expr(c.parenteses()) + ")";
    if (t.t === "op" && (t.v === "-" || t.v === "+")) { c.pega(); const n = c.pega(); if (!n || n.t !== "num") throw new ErroSintaxe(n || null); return t.v + n.v; }
    c.pega();
    if (t.t === "str") return lit(t.n);
    if (t.t === "num") return t.v;
    if (t.t === "pal") {
      if (["CURRENT_TIMESTAMP", "NOW", "LOCALTIMESTAMP", "LOCALTIME"].includes(t.u)) { if (c.op("(")) c.parenteses(); return "CURRENT_TIMESTAMP"; }
      if (t.u === "CURRENT_DATE" || t.u === "CURDATE") { if (c.op("(")) c.parenteses(); return "CURRENT_DATE"; }
      if (["NULL", "TRUE", "FALSE"].includes(t.u)) return t.u;
    }
    throw new ErroSintaxe(t);
  }

  // REFERENCES tabela (cols) [ON DELETE ...] [ON UPDATE ...]  → texto SQLite
  clausulaRef(c, tabelaAtual, cols) {
    c.aceita("REFERENCES");
    const ref = this.nomeQualificado(c);
    if (!c.op("(")) throw new ErroSintaxe(c.ver() || null, "");
    const refCols = nomesColunas(c.parenteses());
    let acoes = "";
    while (c.u() === "ON" || c.u() === "MATCH") {
      if (c.aceita("MATCH")) { c.pega(); continue; }
      c.pega();
      const ev = c.pega();
      if (!ev || (ev.u !== "DELETE" && ev.u !== "UPDATE")) throw new ErroSintaxe(ev || null);
      let a;
      if (c.aceita("SET", "NULL")) a = "SET NULL";
      else if (c.aceita("SET", "DEFAULT")) a = "SET DEFAULT";
      else if (c.aceita("NO", "ACTION")) a = "NO ACTION";
      else if (c.aceita("CASCADE")) a = "CASCADE";
      else if (c.aceita("RESTRICT")) a = "RESTRICT";
      else throw new ErroSintaxe(c.ver() || null);
      acoes += ` ON ${ev.u} ${a}`;
    }
    if (refCols.length !== cols.length) throw new ErroMy(1239, `Incorrect foreign key definition for '${cols[0]}': Key reference and table reference don't match`);
    if (minusc(ref) !== minusc(tabelaAtual)) {
      const real = this.tabela(ref, { view: false });
      if (!real) throw new ErroMy(1824, `Failed to open the referenced table '${ref}'`);
      // a coluna referenciada precisa ser PRIMARY KEY ou UNIQUE
      const info = this.q(`PRAGMA table_info(${idt(real)})`);
      const pkCols = info.filter(x => x.pk > 0).sort((a, b) => a.pk - b.pk).map(x => minusc(x.name));
      const alvo = refCols.map(minusc);
      const ok = (pkCols.length === alvo.length && pkCols.every((x, i) => x === alvo[i]))
        || this.indices(real).some(ix => ix.cols.length >= alvo.length && alvo.every((x, i) => minusc(ix.cols[i] || "") === x));
      if (!ok) throw new ErroMy(1822, `Failed to add the foreign key constraint. Missing index for constraint in the referenced table '${real}'`);
      for (const rc of refCols) if (!info.some(x => minusc(x.name) === minusc(rc))) throw new ErroMy(3734, `Failed to add the foreign key constraint. Missing column '${rc}' for constraint in the referenced table '${real}'`);
    }
    return `REFERENCES ${idt(ref)} (${refCols.map(idt).join(", ")})${acoes}`;
  }

  traduzirRestricao(d, ctx) {
    const c = new Cur(d);
    let nomeR = null;
    if (c.aceita("CONSTRAINT")) { if (!["PRIMARY", "UNIQUE", "FOREIGN", "CHECK"].includes(c.u())) nomeR = c.nome(); }
    if (c.aceita("PRIMARY", "KEY")) {
      if (c.aceita("USING")) c.pega();
      const p = c.parenteses();
      if (!p) throw new ErroSintaxe(c.ver() || null);
      return { pk: nomesColunas(p) };
    }
    if (c.aceita("UNIQUE")) {
      if (c.u() === "KEY" || c.u() === "INDEX") c.pega();
      if (!c.op("(")) c.nome();
      if (c.aceita("USING")) c.pega();
      const p = c.parenteses();
      if (!p) throw new ErroSintaxe(c.ver() || null);
      return { sql: `UNIQUE (${nomesColunas(p).map(idt).join(", ")})` };
    }
    if (c.u() === "KEY" || c.u() === "INDEX") {
      c.pega();
      const nm = c.op("(") ? null : c.nome();
      if (c.aceita("USING")) c.pega();
      const p = c.parenteses();
      if (!p) throw new ErroSintaxe(c.ver() || null);
      const cols = nomesColunas(p);
      return { indice: `CREATE INDEX ${idt(`${ctx.tabela}_${nm || cols.join("_")}`)} ON ${idt(ctx.tabela)} (${cols.map(idt).join(", ")})` };
    }
    if (c.u() === "FULLTEXT" || c.u() === "SPATIAL") return {};
    if (c.aceita("FOREIGN", "KEY")) {
      if (!c.op("(")) c.nome();
      const p = c.parenteses();
      if (!p) throw new ErroSintaxe(c.ver() || null);
      const cols = nomesColunas(p);
      ctx.nFk++;
      const ref = this.clausulaRef(c, ctx.tabela, cols);
      if (!c.fim) throw new ErroSintaxe(c.ver());
      return { sql: `CONSTRAINT ${idt(nomeR || `${ctx.tabela}_ibfk_${ctx.nFk}`)} FOREIGN KEY (${cols.map(idt).join(", ")}) ${ref}` };
    }
    if (c.aceita("CHECK")) {
      const e = c.parenteses();
      if (!e) throw new ErroSintaxe(c.ver() || null);
      return { sql: (nomeR ? `CONSTRAINT ${idt(nomeR)} ` : "") + `CHECK (${this.expr(e)})` };
    }
    throw new ErroSintaxe(c.ver() || d[0]);
  }

  criarIndice(c, unico) {
    this.exigirBanco();
    const nm = c.nome();
    if (!nm) throw new ErroSintaxe(c.ver() || null);
    if (c.aceita("USING")) c.pega();
    if (!c.aceita("ON")) throw new ErroSintaxe(c.ver() || null);
    const t = this.exigirTabela(this.nomeQualificado(c));
    const p = c.parenteses();
    if (!p) throw new ErroSintaxe(c.ver() || null);
    const nomeIx = `${t}_${nm}`;
    if (this.q("SELECT 1 FROM sqlite_master WHERE type='index' AND lower(name)=lower(?)", [nomeIx]).length) throw new ErroMy(1061, `Duplicate key name '${nm}'`);
    this.rodar(`CREATE ${unico ? "UNIQUE " : ""}INDEX ${idt(nomeIx)} ON ${idt(t)} (${nomesColunas(p).map(idt).join(", ")})`);
    return { mensagem: "0 row(s) affected Records: 0  Duplicates: 0  Warnings: 0" };
  }

  criarView(c, substituir, jaLeuView = false) {
    this.exigirBanco();
    if (!jaLeuView) {
      while (["ALGORITHM", "DEFINER", "SQL"].includes(c.u())) { c.pega(); if (c.op("=")) { c.pega(); c.pega(); } else c.pega(); }
      if (!c.aceita("VIEW")) throw new ErroSintaxe(c.ver() || null);
    }
    const nome = this.nomeQualificado(c);
    let cols = null;
    if (c.op("(")) cols = nomesColunas(c.parenteses());
    if (!c.aceita("AS")) throw new ErroSintaxe(c.ver() || null);
    const existe = this.tabela(nome);
    if (existe) {
      if (!substituir) throw new ErroMy(1050, `Table '${nome}' already exists`);
      if (this.tabela(nome, { view: false })) throw new ErroMy(1347, `'${this.nomeBd()}.${nome}' is not VIEW`);
      this.rodar(`DROP VIEW ${idt(existe)}`);
    }
    this.rodar(`CREATE VIEW ${idt(nome)}${cols ? ` (${cols.map(idt).join(", ")})` : ""} AS ${this.expr(c.resto())}`);
    return { mensagem: "0 row(s) affected" };
  }

  // ---------- DROP ----------
  derrubar(c) {
    c.pega();
    if (c.u() === "DATABASE" || c.u() === "SCHEMA") {
      c.pega();
      const se = c.aceita("IF", "EXISTS");
      const t = c.ver();
      const nome = c.nome();
      if (!nome) throw new ErroSintaxe(t || null);
      if (!this.ehBanco(nome)) {
        if (se) return { mensagem: `0 row(s) affected, 1 warning(s): 1008 Can't drop database '${nome}'; database doesn't exist` };
        throw new ErroMy(1008, `Can't drop database '${nome}'; database doesn't exist`);
      }
      let n = 0;
      if (this.ativo && minusc(nome) === minusc(this.ativo)) {
        const fk = this.fkLigadas();
        this.rodar("PRAGMA foreign_keys = OFF");
        try {
          for (const tb of this.listarTabelas()) { this.rodar(`DROP ${tb.tipo === "view" ? "VIEW" : "TABLE"} ${idt(tb.nome)}`); if (tb.tipo === "table") n++; }
        } finally { if (fk) this.rodar("PRAGMA foreign_keys = ON"); }
        this.tipos = {};
        this.ativo = null;
      }
      this.bancos = this.bancos.filter(b => minusc(b) !== minusc(nome));
      return { mensagem: `${n} row(s) affected` };
    }
    c.aceita("TEMPORARY");
    if (c.aceita("TABLE") || c.aceita("TABLES")) {
      const se = c.aceita("IF", "EXISTS");
      const nomes = [];
      do { nomes.push(this.nomeQualificado(c)); } while (c.op(",") && c.pega());
      c.aceita("RESTRICT"); c.aceita("CASCADE");
      if (!c.fim) throw new ErroSintaxe(c.ver());
      this.exigirBanco();
      const reais = [], faltam = [];
      for (const n of nomes) { const r = this.tabela(n, { view: false }); if (r) reais.push(r); else faltam.push(n); }
      if (faltam.length && !se) throw new ErroMy(1051, `Unknown table '${faltam.map(f => `${this.nomeBd()}.${f}`).join(",")}'`);
      if (this.fkLigadas()) {
        const caindo = new Set(reais.map(minusc));
        for (const r of reais) {
          const f = this.filhas(r).find(x => !caindo.has(minusc(x.tabela)));
          if (f) throw new ErroMy(3730, `Cannot drop table '${r}' referenced by a foreign key constraint '${f.fk.nome}' on table '${f.tabela}'.`);
        }
      }
      const fk = this.fkLigadas();
      this.rodar("PRAGMA foreign_keys = OFF");
      try { for (const r of reais) { this.rodar(`DROP TABLE ${idt(r)}`); delete this.tipos[minusc(r)]; } }
      finally { if (fk) this.rodar("PRAGMA foreign_keys = ON"); }
      return { mensagem: faltam.length ? `0 row(s) affected, ${faltam.length} warning(s): 1051 Unknown table '${faltam.map(f => `${this.nomeBd()}.${f}`).join(",")}'` : "0 row(s) affected" };
    }
    if (c.aceita("VIEW")) {
      const se = c.aceita("IF", "EXISTS");
      const nome = this.nomeQualificado(c);
      this.exigirBanco();
      const r = this.q("SELECT name FROM sqlite_master WHERE type='view' AND lower(name)=lower(?)", [nome])[0];
      if (!r) { if (se) return { mensagem: "0 row(s) affected, 1 warning(s)" }; throw new ErroMy(1051, `Unknown table '${this.nomeBd()}.${nome}'`); }
      this.rodar(`DROP VIEW ${idt(r.name)}`);
      return { mensagem: "0 row(s) affected" };
    }
    if (c.aceita("INDEX")) {
      const nm = c.nome();
      if (!nm || !c.aceita("ON")) throw new ErroSintaxe(c.ver() || null);
      const t = this.exigirTabela(this.nomeQualificado(c));
      return this.removerIndice(t, nm);
    }
    if (["USER", "ROLE"].includes(c.u())) throw this.naoSuportado("usuários e permissões (DROP USER)");
    if (["PROCEDURE", "FUNCTION", "TRIGGER", "EVENT"].includes(c.u())) throw this.naoSuportado(`DROP ${c.u()}`);
    throw new ErroSintaxe(c.ver() || null);
  }

  removerIndice(t, nm) {
    for (const cand of [`${t}_${nm}`, nm]) {
      const r = this.q("SELECT name FROM sqlite_master WHERE type='index' AND lower(name)=lower(?) AND lower(tbl_name)=lower(?)", [cand, t])[0];
      if (r) { this.rodar(`DROP INDEX ${idt(r.name)}`); return { mensagem: "0 row(s) affected Records: 0  Duplicates: 0  Warnings: 0" }; }
    }
    throw new ErroMy(1091, `Can't DROP '${nm}'; check that column/key exists`);
  }

  // ---------- TRUNCATE / RENAME / USE ----------
  truncar(c) {
    c.pega();
    c.aceita("TABLE");
    const t = this.exigirTabela(this.nomeQualificado(c));
    if (!c.fim) throw new ErroSintaxe(c.ver());
    if (this.fkLigadas()) {
      const f = this.filhas(t).find(x => minusc(x.tabela) !== minusc(t));
      if (f) throw new ErroMy(1701, `Cannot truncate a table referenced in a foreign key constraint (${crase(this.nomeBd())}.${crase(f.tabela)}, CONSTRAINT ${crase(f.fk.nome)})`);
    }
    this.rodar(`DELETE FROM ${idt(t)}`);
    if (this.q("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").length) this.rodar(`DELETE FROM sqlite_sequence WHERE lower(name) = lower(${lit(t)})`);
    return { mensagem: "0 row(s) affected" };
  }

  renomearTabelas(c) {
    c.pega();
    if (!c.aceita("TABLE")) throw new ErroSintaxe(c.ver() || null);
    do {
      const a = this.exigirTabela(this.nomeQualificado(c));
      if (!c.aceita("TO")) throw new ErroSintaxe(c.ver() || null);
      const b = this.nomeQualificado(c);
      if (this.tabela(b)) throw new ErroMy(1050, `Table '${b}' already exists`);
      this.rodar(`ALTER TABLE ${idt(a)} RENAME TO ${idt(b)}`);
      this.moverTipos(a, b);
    } while (c.op(",") && c.pega());
    if (!c.fim) throw new ErroSintaxe(c.ver());
    return { mensagem: "0 row(s) affected" };
  }
  moverTipos(a, b) {
    if (this.tipos[minusc(a)]) { this.tipos[minusc(b)] = this.tipos[minusc(a)]; if (minusc(a) !== minusc(b)) delete this.tipos[minusc(a)]; }
  }

  usar(c) {
    c.pega();
    const t = c.ver();
    const nome = c.nome();
    if (!nome || !c.fim) throw new ErroSintaxe(c.fim ? t || null : c.ver());
    const real = this.bancos.find(b => minusc(b) === minusc(nome));
    if (!real) throw new ErroMy(1049, `Unknown database '${nome}'`);
    this.ativo = real;
    return { mensagem: "0 row(s) affected" };
  }

  // ---------- SHOW / DESCRIBE ----------
  mostrar(c) {
    c.pega();
    const completo = c.aceita("FULL");
    c.aceita("EXTENDED");
    const filtro = () => {
      if (c.aceita("LIKE")) { const s = c.pega(); if (!s || s.t !== "str") throw new ErroSintaxe(s || null); return likeRegex(s.n); }
      return null;
    };
    if (c.aceita("DATABASES") || c.aceita("SCHEMAS")) {
      const f = filtro();
      const linhas = [...this.bancos].sort((a, b) => minusc(a) < minusc(b) ? -1 : 1).filter(b => !f || f.test(b)).map(b => [b]);
      return { mensagem: `${linhas.length} row(s) returned`, resultado: { colunas: ["Database"], linhas } };
    }
    if (c.aceita("TABLES")) {
      let bd = this.ativo;
      if (c.aceita("FROM") || c.aceita("IN")) {
        const t = c.ver();
        const b = c.nome();
        if (!b) throw new ErroSintaxe(t || null);
        if (!this.ehBanco(b)) throw new ErroMy(1049, `Unknown database '${b}'`);
        bd = this.bancos.find(x => minusc(x) === minusc(b));
      }
      if (!bd) this.exigirBanco();
      const f = filtro();
      const lista = minusc(bd) === minusc(this.ativo || "") ? this.listarTabelas() : [];
      const linhas = lista.filter(t => !f || f.test(t.nome)).map(t => completo ? [t.nome, t.tipo === "view" ? "VIEW" : "BASE TABLE"] : [t.nome]);
      return { mensagem: `${linhas.length} row(s) returned`, resultado: { colunas: completo ? [`Tables_in_${bd}`, "Table_type"] : [`Tables_in_${bd}`], linhas } };
    }
    if (c.aceita("COLUMNS") || c.aceita("FIELDS")) {
      if (!c.aceita("FROM") && !c.aceita("IN")) throw new ErroSintaxe(c.ver() || null);
      const t = this.nomeQualificado(c);
      if (c.aceita("FROM") || c.aceita("IN")) { const b = c.nome(); if (!b || !this.ehBanco(b)) throw new ErroMy(1049, `Unknown database '${b}'`); }
      const r = this.descrever(t);
      return { mensagem: `${r.linhas.length} row(s) returned`, resultado: r };
    }
    if (c.aceita("CREATE", "TABLE")) {
      const t = this.nomeQualificado(c);
      this.exigirBanco();
      const v = this.q("SELECT name, sql FROM sqlite_master WHERE type='view' AND lower(name)=lower(?)", [t])[0];
      if (v) return { mensagem: "1 row(s) returned", resultado: { colunas: ["View", "Create View"], linhas: [[v.name, v.sql]] } };
      const real = this.exigirTabela(t);
      return { mensagem: "1 row(s) returned", resultado: { colunas: ["Table", "Create Table"], linhas: [[real, this.criacaoMysql(real)]] } };
    }
    if (c.aceita("CREATE", "VIEW")) {
      const t = this.nomeQualificado(c);
      const v = this.q("SELECT name, sql FROM sqlite_master WHERE type='view' AND lower(name)=lower(?)", [t])[0];
      if (!v) throw new ErroMy(1146, `Table '${this.nomeBd()}.${t}' doesn't exist`);
      return { mensagem: "1 row(s) returned", resultado: { colunas: ["View", "Create View"], linhas: [[v.name, v.sql]] } };
    }
    if (c.aceita("CREATE", "DATABASE") || c.aceita("CREATE", "SCHEMA")) {
      c.aceita("IF", "NOT", "EXISTS");
      const b = c.nome();
      if (!b || !this.ehBanco(b)) throw new ErroMy(1049, `Unknown database '${b}'`);
      const real = this.bancos.find(x => minusc(x) === minusc(b));
      return { mensagem: "1 row(s) returned", resultado: { colunas: ["Database", "Create Database"], linhas: [[real, `CREATE DATABASE ${crase(real)} /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */`]] } };
    }
    if (c.aceita("INDEX") || c.aceita("INDEXES") || c.aceita("KEYS")) {
      if (!c.aceita("FROM") && !c.aceita("IN")) throw new ErroSintaxe(c.ver() || null);
      const t = this.exigirTabela(this.nomeQualificado(c));
      const linhas = [];
      const pk = this.q(`PRAGMA table_info(${idt(t)})`).filter(x => x.pk > 0).sort((a, b) => a.pk - b.pk);
      pk.forEach((x, i) => linhas.push([t, 0, "PRIMARY", i + 1, x.name]));
      for (const ix of this.indices(t)) {
        if (ix.origem === "pk") continue;
        const nome = ix.nome.startsWith("sqlite_autoindex") ? ix.cols[0] : ix.nome.startsWith(t + "_") ? ix.nome.slice(t.length + 1) : ix.nome;
        ix.cols.forEach((col, i) => linhas.push([t, ix.unico ? 0 : 1, nome, i + 1, col]));
      }
      for (const fk of this.fks(t)) if (!linhas.some(l => minusc(l[4]) === minusc(fk.cols[0]))) linhas.push([t, 1, fk.nome, 1, fk.cols[0]]);
      return { mensagem: `${linhas.length} row(s) returned`, resultado: { colunas: ["Table", "Non_unique", "Key_name", "Seq_in_index", "Column_name"], linhas } };
    }
    if (c.aceita("WARNINGS") || c.aceita("ERRORS")) return { mensagem: "0 row(s) returned", resultado: { colunas: ["Level", "Code", "Message"], linhas: [] } };
    if (["VARIABLES", "STATUS", "PROCESSLIST", "GRANTS", "ENGINES", "PRIVILEGES", "TRIGGERS", "EVENTS", "PLUGINS", "PROCEDURE", "FUNCTION", "MASTER", "SLAVE", "REPLICA", "BINARY", "GLOBAL", "SESSION"].includes(c.u()))
      throw this.naoSuportado(`SHOW ${c.u()}`);
    throw new ErroSintaxe(c.ver() || null);
  }

  descreverCmd(c) {
    const verbo = c.pega().u;
    if (verbo === "EXPLAIN" && ["SELECT", "WITH", "UPDATE", "DELETE", "INSERT", "ANALYZE", "FORMAT"].includes(c.u())) throw this.naoSuportado("EXPLAIN de consultas");
    const t = this.nomeQualificado(c);
    const r = this.descrever(t);
    if (!c.fim) {
      const col = c.pega();
      const nm = nomeDe(col);
      r.linhas = r.linhas.filter(l => nm && (col.t === "str" ? likeRegex(nm).test(l[0]) : minusc(l[0]) === minusc(nm)));
    }
    return { mensagem: `${r.linhas.length} row(s) returned`, resultado: r };
  }

  descrever(nome) {
    this.exigirBanco();
    const t = this.tabela(nome);
    if (!t) throw new ErroMy(1146, `Table '${this.nomeBd()}.${nome}' doesn't exist`);
    const info = this.q(`PRAGMA table_info(${idt(t)})`);
    const sqlT = this.q("SELECT sql FROM sqlite_master WHERE name = ?", [t])[0]?.sql || "";
    const auto = /AUTOINCREMENT/i.test(sqlT);
    const ixs = this.indices(t);
    const uni = new Set(), mul = new Set();
    for (const ix of ixs) {
      if (ix.origem === "pk" || !ix.cols[0]) continue;
      if (ix.unico && ix.cols.length === 1) uni.add(minusc(ix.cols[0])); else mul.add(minusc(ix.cols[0]));
    }
    for (const fk of this.fks(t)) mul.add(minusc(fk.cols[0]));
    const tipos = this.tipos[minusc(t)] || {};
    const linhas = info.map(col => {
      const n = minusc(col.name);
      const tipo = tipos[n] || (minusc(col.type) === "integer" ? "int" : minusc(col.type) || "text");
      let padrao = col.dflt_value;
      if (typeof padrao === "string" && /^'.*'$/s.test(padrao)) padrao = padrao.slice(1, -1).replace(/''/g, "'");
      else if (padrao !== null && padrao !== undefined) padrao = String(padrao);
      if (padrao === "NULL") padrao = null;
      const chave = col.pk > 0 ? "PRI" : uni.has(n) ? "UNI" : mul.has(n) ? "MUL" : "";
      let extra = "";
      if (col.pk > 0 && auto && minusc(col.type) === "integer") extra = "auto_increment";
      else if (/^CURRENT_(TIMESTAMP|DATE)$/i.test(padrao || "")) extra = "DEFAULT_GENERATED";
      return [col.name, tipo, col.notnull || col.pk > 0 ? "NO" : "YES", chave, padrao ?? null, extra];
    });
    return { colunas: ["Field", "Type", "Null", "Key", "Default", "Extra"], linhas };
  }

  // monta um SHOW CREATE TABLE parecido com o do MySQL
  criacaoMysql(t) {
    const desc = this.descrever(t).linhas;
    const partes = desc.map(([f, tipo, nulo, , padrao, extra]) => {
      let s = `  ${crase(f)} ${tipo}`;
      if (nulo === "NO") s += " NOT NULL";
      if (padrao !== null) s += /^CURRENT_/i.test(padrao) ? ` DEFAULT ${padrao}` : ` DEFAULT '${String(padrao).replace(/'/g, "''")}'`;
      else if (nulo === "YES") s += " DEFAULT NULL";
      if (extra === "auto_increment") s += " AUTO_INCREMENT";
      return s;
    });
    const pk = this.q(`PRAGMA table_info(${idt(t)})`).filter(x => x.pk > 0).sort((a, b) => a.pk - b.pk).map(x => crase(x.name));
    if (pk.length) partes.push(`  PRIMARY KEY (${pk.join(",")})`);
    for (const ix of this.indices(t)) {
      if (ix.origem === "pk" || !ix.cols.length) continue;
      const nome = ix.nome.startsWith("sqlite_autoindex") ? ix.cols[0] : ix.nome.startsWith(t + "_") ? ix.nome.slice(t.length + 1) : ix.nome;
      partes.push(`  ${ix.unico ? "UNIQUE KEY" : "KEY"} ${crase(nome)} (${ix.cols.map(crase).join(",")})`);
    }
    const fks = this.fks(t);
    for (const fk of fks) if (!this.indices(t).some(ix => minusc(ix.cols[0] || "") === minusc(fk.cols[0]))) partes.push(`  KEY ${crase(fk.cols[0])} (${fk.cols.map(crase).join(",")})`);
    for (const fk of fks) {
      partes.push(`  CONSTRAINT ${crase(fk.nome)} FOREIGN KEY (${fk.cols.map(crase).join(", ")}) REFERENCES ${crase(fk.ref)} (${fk.refCols.map(crase).join(", ")})`
        + (fk.onDelete && fk.onDelete !== "NO ACTION" ? ` ON DELETE ${fk.onDelete}` : "") + (fk.onUpdate && fk.onUpdate !== "NO ACTION" ? ` ON UPDATE ${fk.onUpdate}` : ""));
    }
    const seq = this.q("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").length ? this.q("SELECT seq FROM sqlite_sequence WHERE lower(name)=lower(?)", [t])[0] : null;
    return `CREATE TABLE ${crase(t)} (\n${partes.join(",\n")}\n) ENGINE=InnoDB${seq ? ` AUTO_INCREMENT=${seq.seq + 1}` : ""} DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`;
  }

  // ---------- SET ----------
  definir(c) {
    c.pega();
    for (const parte of dividirVirgulas(c.resto())) {
      const p = new Cur(parte);
      while (["SESSION", "GLOBAL", "LOCAL", "PERSIST"].includes(p.u())) p.pega();
      if (p.u().startsWith("@@")) { p.pega(); if (p.op(".")) p.pega(); else p.i--; }
      if (p.u().startsWith("@@")) { const t = p.pega(); p.k = [{ ...t, u: t.u.slice(2), v: t.v.slice(2) }, ...p.resto()]; p.i = 0; }
      if (p.u().startsWith("@")) throw this.naoSuportado("variáveis (@nome)");
      const t = p.pega();
      if (!t || t.t !== "pal") throw new ErroSintaxe(t || null);
      const nome = t.u;
      if (["NAMES", "CHARACTER", "CHARSET", "TRANSACTION"].includes(nome)) continue;
      if (!p.op("=") && !p.op(":=")) throw new ErroSintaxe(p.ver() || null, "");
      p.pega();
      const v = p.pega();
      if (!v) throw new ErroSintaxe(null, "");
      const val = v.t === "num" ? Number(v.v) : v.t === "pal" ? ({ ON: 1, TRUE: 1, OFF: 0, FALSE: 0, DEFAULT: null }[v.u] ?? v.u) : v.t === "str" ? v.n : null;
      switch (nome) {
        case "SQL_SAFE_UPDATES": this.seguro = val === null ? true : !!Number(val); break;
        case "FOREIGN_KEY_CHECKS": this.rodar(`PRAGMA foreign_keys = ${val === 0 || val === "0" ? "OFF" : "ON"}`); break;
        case "AUTOCOMMIT": case "SQL_MODE": case "TIME_ZONE": case "SQL_NOTES": case "UNIQUE_CHECKS": case "CHARACTER_SET_CLIENT":
        case "CHARACTER_SET_RESULTS": case "CHARACTER_SET_CONNECTION": case "COLLATION_CONNECTION": case "SQL_SELECT_LIMIT":
        case "MAX_EXECUTION_TIME": case "LC_TIME_NAMES": case "SQL_MODE_NO_AUTO_VALUE_ON_ZERO": case "TRANSACTION_ISOLATION":
          break;
        default: throw new ErroMy(1193, `Unknown system variable '${minusc(nome)}'`);
      }
    }
    return { mensagem: "0 row(s) affected" };
  }

  // ---------- transações ----------
  transacao(c) {
    const u = c.pega().u;
    const ignorarSemTransacao = fn => { try { fn(); } catch (e) { if (!/no transaction is active/i.test(e.message)) throw e; } };
    if (u === "START" || u === "BEGIN") {
      if (u === "START" && !c.aceita("TRANSACTION")) throw new ErroSintaxe(c.ver() || null);
      ignorarSemTransacao(() => this.rodar("COMMIT"));
      this.rodar("BEGIN");
    } else if (u === "COMMIT") ignorarSemTransacao(() => this.rodar("COMMIT"));
    else if (u === "ROLLBACK") {
      c.aceita("WORK");
      if (c.aceita("TO")) { c.aceita("SAVEPOINT"); const s = c.nome(); this.rodar(`ROLLBACK TO ${idt(s)}`); }
      else ignorarSemTransacao(() => this.rodar("ROLLBACK"));
    } else if (u === "SAVEPOINT") this.rodar(`SAVEPOINT ${idt(c.nome())}`);
    else if (u === "RELEASE") { c.aceita("SAVEPOINT"); this.rodar(`RELEASE ${idt(c.nome())}`); }
    return { mensagem: "0 row(s) affected" };
  }

  // ---------- ALTER TABLE ----------
  alterar(c) {
    c.pega();
    if (c.u() === "DATABASE" || c.u() === "SCHEMA") return { mensagem: "1 row(s) affected" };
    if (["USER", "VIEW", "PROCEDURE", "FUNCTION", "EVENT"].includes(c.u())) throw this.naoSuportado(`ALTER ${c.u()}`);
    if (!c.aceita("TABLE")) throw new ErroSintaxe(c.ver() || null);
    let t = this.exigirTabela(this.nomeQualificado(c));
    const clausulas = dividirVirgulas(c.resto());
    if (!clausulas.length) throw new ErroSintaxe(null, "");
    const fk = this.fkLigadas();
    const tiposAntes = JSON.stringify(this.tipos);
    this.rodar("PRAGMA foreign_keys = OFF");
    this.rodar("PRAGMA legacy_alter_table = ON");
    this.rodar("SAVEPOINT bsql_alter");
    try {
      for (const cl of clausulas) t = this.clausulaAlter(t, cl);
      if (fk) {
        const viol = this.q(`PRAGMA foreign_key_check(${idt(t)})`);
        if (viol.length) {
          const f = this.fks(t)[viol[0].fkid] || this.fks(t)[0];
          throw new ErroMy(1452, `Cannot add or update a child row: a foreign key constraint fails ${f ? this.textoFk(t, f) : ""}`.trim());
        }
      }
      this.rodar("RELEASE bsql_alter");
    } catch (e) {
      try { this.rodar("ROLLBACK TO bsql_alter"); this.rodar("RELEASE bsql_alter"); } catch { /* ok */ }
      this.tipos = JSON.parse(tiposAntes);
      throw e;
    } finally {
      this.rodar("PRAGMA legacy_alter_table = OFF");
      if (fk) this.rodar("PRAGMA foreign_keys = ON");
    }
    return { mensagem: "0 row(s) affected Records: 0  Duplicates: 0  Warnings: 0" };
  }

  // separa "... FIRST" / "... AFTER col" do fim de uma definição
  posicao(toks) {
    const n = toks.length;
    if (ehPal(toks[n - 1], "FIRST")) return { def: toks.slice(0, -1), pos: { primeiro: true } };
    if (n >= 2 && ehPal(toks[n - 2], "AFTER")) return { def: toks.slice(0, -2), pos: { depois: nomeDe(toks[n - 1]) } };
    return { def: toks, pos: null };
  }

  clausulaAlter(t, toks) {
    const c = new Cur(toks);
    const tipos = (this.tipos[minusc(t)] ||= {});
    if (c.aceita("ADD")) {
      const ehColuna = c.u() === "COLUMN" || c.ver()?.t === "id" || (c.ver()?.t === "pal" && !INICIO_RESTRICAO.has(c.u())) || c.op("(");
      if (ehColuna) {
        c.aceita("COLUMN");
        if (c.op("(")) { for (const d of dividirVirgulas(c.parenteses())) this.adicionarColuna(t, d, null); return t; }
        const { def, pos } = this.posicao(c.resto());
        this.adicionarColuna(t, def, pos);
        return t;
      }
      const resto = c.resto();
      const r0 = new Cur(resto);
      if (r0.aceita("CONSTRAINT") && !["PRIMARY", "UNIQUE", "FOREIGN", "CHECK"].includes(r0.u())) r0.nome();
      if (r0.u() === "UNIQUE" || r0.u() === "KEY" || r0.u() === "INDEX") {
        const unico = r0.aceita("UNIQUE");
        if (r0.u() === "KEY" || r0.u() === "INDEX") r0.pega();
        const nm = r0.op("(") ? null : r0.nome();
        const p = r0.parenteses();
        if (!p) throw new ErroSintaxe(r0.ver() || null);
        const cols = nomesColunas(p);
        const nomeIx = `${t}_${nm || cols.join("_")}`;
        if (this.q("SELECT 1 FROM sqlite_master WHERE type='index' AND lower(name)=lower(?)", [nomeIx]).length) throw new ErroMy(1061, `Duplicate key name '${nm || cols[0]}'`);
        this.rodar(`CREATE ${unico ? "UNIQUE " : ""}INDEX ${idt(nomeIx)} ON ${idt(t)} (${cols.map(idt).join(", ")})`);
        return t;
      }
      if (r0.u() === "FULLTEXT" || r0.u() === "SPATIAL") return t;
      const existentes = this.fks(t).length;
      const r = this.traduzirRestricao(resto, { nFk: existentes, tabela: t });
      if (r.pk) {
        if (this.q(`PRAGMA table_info(${idt(t)})`).some(x => x.pk > 0)) throw new ErroMy(1068, "Multiple primary key defined");
        const pkCols = r.pk;
        this.reconstruir(t, est => {
          for (const d of est.defs) if (d.tipo === "col" && pkCols.some(p => minusc(p) === minusc(d.nome)) && !/NOT\s+NULL/i.test(d.sql)) d.sql += " NOT NULL";
          est.defs.push({ tipo: "res", sql: `PRIMARY KEY (${pkCols.map(idt).join(", ")})` });
        });
        return t;
      }
      if (r.indice) { this.rodar(r.indice); return t; }
      if (r.sql) this.reconstruir(t, est => { est.defs.push({ tipo: "res", sql: r.sql }); });
      return t;
    }
    if (c.aceita("DROP")) {
      if (c.aceita("FOREIGN", "KEY") || (c.u() === "CONSTRAINT" || c.u() === "CHECK")) {
        if (c.u() === "CONSTRAINT" || c.u() === "CHECK") c.pega();
        const nm = c.nome();
        const alvo = this.fks(t).find(f => minusc(f.nome) === minusc(nm || ""));
        if (alvo) {
          this.reconstruir(t, est => {
            const d = est.defs.find(x => x.sql === alvo.def.sql);
            if (d.tipo === "res") est.defs.splice(est.defs.indexOf(d), 1);
            else d.sql = d.sql.replace(/\s*CONSTRAINT\s+"[^"]*"\s+REFERENCES[\s\S]*$/i, "");
          });
          return t;
        }
        const est = this.analisar(t);
        const ch = est.defs.find(d => d.tipo === "res" && ehPal(d.toks[0], "CONSTRAINT") && minusc(nomeDe(d.toks[1]) || "") === minusc(nm || ""));
        if (!ch) throw new ErroMy(1091, `Can't DROP '${nm}'; check that column/key exists`);
        this.reconstruir(t, e2 => { e2.defs = e2.defs.filter(d => d.sql !== ch.sql); });
        return t;
      }
      if (c.aceita("PRIMARY", "KEY")) throw this.naoSuportado("ALTER TABLE ... DROP PRIMARY KEY (recrie a tabela)");
      if (c.aceita("INDEX") || c.aceita("KEY")) { const nm = c.nome(); this.removerIndice(t, nm); return t; }
      c.aceita("COLUMN");
      const col = c.nome();
      if (!col) throw new ErroSintaxe(c.ver() || null);
      this.removerColuna(t, col);
      return t;
    }
    if (c.aceita("MODIFY")) {
      c.aceita("COLUMN");
      const { def, pos } = this.posicao(c.resto());
      this.modificarColuna(t, nomeDe(def[0]), def, pos);
      return t;
    }
    if (c.aceita("CHANGE")) {
      c.aceita("COLUMN");
      const antigo = c.nome();
      const { def, pos } = this.posicao(c.resto());
      const novoNome = nomeDe(def[0]);
      if (!antigo || !novoNome) throw new ErroSintaxe(c.ver() || null);
      const atual = this.colunaReal(t, antigo);
      if (minusc(antigo) !== minusc(novoNome)) {
        if (this.colunaExiste(t, novoNome)) throw new ErroMy(1060, `Duplicate column name '${novoNome}'`);
        this.rodar(`ALTER TABLE ${idt(t)} RENAME COLUMN ${idt(atual)} TO ${idt(novoNome)}`);
        delete tipos[minusc(atual)];
      } else if (atual !== novoNome) this.rodar(`ALTER TABLE ${idt(t)} RENAME COLUMN ${idt(atual)} TO ${idt(novoNome)}`);
      this.modificarColuna(t, novoNome, def, pos);
      return t;
    }
    if (c.aceita("RENAME")) {
      if (c.aceita("COLUMN")) {
        const a = c.nome();
        if (!c.aceita("TO")) throw new ErroSintaxe(c.ver() || null);
        const b = c.nome();
        if (!a || !b) throw new ErroSintaxe(c.ver() || null);
        const atual = this.colunaReal(t, a);
        if (minusc(a) !== minusc(b) && this.colunaExiste(t, b)) throw new ErroMy(1060, `Duplicate column name '${b}'`);
        this.rodar(`ALTER TABLE ${idt(t)} RENAME COLUMN ${idt(atual)} TO ${idt(b)}`);
        if (tipos[minusc(atual)]) { tipos[minusc(b)] = tipos[minusc(atual)]; if (minusc(atual) !== minusc(b)) delete tipos[minusc(atual)]; }
        return t;
      }
      if (c.u() === "INDEX" || c.u() === "KEY") throw this.naoSuportado("RENAME INDEX");
      if (!c.aceita("TO")) c.aceita("AS");
      const novoNome = this.nomeQualificado(c);
      if (this.tabela(novoNome) && minusc(novoNome) !== minusc(t)) throw new ErroMy(1050, `Table '${novoNome}' already exists`);
      this.rodar("PRAGMA legacy_alter_table = OFF");
      this.rodar(`ALTER TABLE ${idt(t)} RENAME TO ${idt(novoNome)}`);
      this.rodar("PRAGMA legacy_alter_table = ON");
      this.moverTipos(t, novoNome);
      return novoNome;
    }
    if (c.aceita("ALTER")) {
      c.aceita("COLUMN");
      const col = c.nome();
      const atual = this.colunaReal(t, col);
      let novoPadrao = null;
      if (c.aceita("SET", "DEFAULT")) novoPadrao = this.valorPadrao(c);
      else if (!c.aceita("DROP", "DEFAULT")) throw new ErroSintaxe(c.ver() || null);
      this.reconstruir(t, est => {
        const d = est.defs.find(x => x.tipo === "col" && minusc(x.nome) === minusc(atual));
        const k = d.toks;
        const i = k.findIndex(x => ehPal(x, "DEFAULT"));
        let semPadrao = k;
        if (i >= 0) {
          let fim = i + 2;
          if (ehOp(k[i + 1], "(")) { let p = 0; for (fim = i + 1; fim < k.length; fim++) { if (ehOp(k[fim], "(")) p++; else if (ehOp(k[fim], ")") && --p === 0) { fim++; break; } } }
          else if (ehOp(k[i + 1], "-") || ehOp(k[i + 1], "+")) fim = i + 3;
          semPadrao = [...k.slice(0, i), ...k.slice(fim)];
        }
        d.sql = emitir(semPadrao) + (novoPadrao !== null ? " DEFAULT " + novoPadrao : "");
      });
      return t;
    }
    if (["ENGINE", "DEFAULT", "CHARACTER", "CHARSET", "COLLATE", "AUTO_INCREMENT", "COMMENT", "CONVERT", "ROW_FORMAT", "ORDER", "FORCE", "ALGORITHM", "LOCK"].includes(c.u())) return t;
    throw new ErroSintaxe(c.ver() || null);
  }

  colunaExiste(t, col) { return this.q(`PRAGMA table_info(${idt(t)})`).some(x => minusc(x.name) === minusc(col)); }
  colunaReal(t, col) {
    const x = this.q(`PRAGMA table_info(${idt(t)})`).find(y => minusc(y.name) === minusc(col || ""));
    if (!x) throw new ErroMy(1054, `Unknown column '${col}' in '${t}'`);
    return x.name;
  }

  adicionarColuna(t, defToks, pos) {
    const ctx = { nFk: this.fks(t).length, tabela: t };
    const col = this.traduzirColuna(defToks, ctx);
    if (this.colunaExiste(t, col.nome)) throw new ErroMy(1060, `Duplicate column name '${col.nome}'`);
    const temPk = this.q(`PRAGMA table_info(${idt(t)})`).some(x => x.pk > 0);
    if (col.pk && temPk) throw new ErroMy(1068, "Multiple primary key defined");
    if (col.auto && !col.pk) throw new ErroMy(1075, "Incorrect table definition; there can be only one auto column and it must be defined as a key");
    const sql = this.montarColuna(col, col.pk, col.pk);
    this.reconstruir(t, (est, extras) => {
      const def = { tipo: "col", nome: col.nome, sql, novo: true };
      const colsIdx = est.defs.map((d, i) => d.tipo === "col" ? i : -1).filter(i => i >= 0);
      let onde = colsIdx[colsIdx.length - 1] + 1;
      if (pos?.primeiro) onde = 0;
      else if (pos?.depois) {
        const i = est.defs.findIndex(d => d.tipo === "col" && minusc(d.nome) === minusc(pos.depois));
        if (i < 0) throw new ErroMy(1054, `Unknown column '${pos.depois}' in '${t}'`);
        onde = i + 1;
      }
      est.defs.splice(onde, 0, def);
      // coluna NOT NULL sem DEFAULT: o MySQL preenche as linhas existentes com o valor "zero" do tipo
      if (col.notnull && col.padrao === null && !col.auto) extras.set(col.nome, TEXTUAIS.has(col.tipo) ? (col.enumVals ? col.enumVals.split(",")[0] : "''") : ["DATE"].includes(col.tipo) ? "'0000-00-00'" : ["DATETIME", "TIMESTAMP"].includes(col.tipo) ? "'0000-00-00 00:00:00'" : "0");
    });
    (this.tipos[minusc(t)] ||= {})[minusc(col.nome)] = col.exib;
  }

  modificarColuna(t, nome, defToks, pos) {
    const atual = this.colunaReal(t, nome);
    const est0 = this.analisar(t);
    const antigo = est0.defs.find(d => d.tipo === "col" && minusc(d.nome) === minusc(atual));
    const ctx = { nFk: this.fks(t).length, tabela: t };
    const col = this.traduzirColuna(defToks, ctx);
    const eraPk = /\bPRIMARY\s+KEY\b/i.test(antigo.sql);
    const pkTabela = this.q(`PRAGMA table_info(${idt(t)})`).filter(x => x.pk > 0);
    const naPk = eraPk || col.pk || pkTabela.some(x => minusc(x.name) === minusc(atual));
    const pkUnica = eraPk || (col.pk && !pkTabela.length);
    if (col.pk && pkTabela.length && !pkTabela.some(x => minusc(x.name) === minusc(atual))) throw new ErroMy(1068, "Multiple primary key defined");
    if (col.auto && !pkUnica) throw new ErroMy(1075, "Incorrect table definition; there can be only one auto column and it must be defined as a key");
    if (/\bUNIQUE\b/i.test(antigo.sql.replace(/CONSTRAINT[\s\S]*$/i, ""))) col.unico = true;
    let sql = this.montarColuna({ ...col, nome: atual }, naPk, pkUnica);
    const ref = /\s*CONSTRAINT\s+"[^"]*"\s+REFERENCES[\s\S]*$/i.exec(antigo.sql);
    if (ref && !col.refs.length) sql += ref[0];
    this.reconstruir(t, est => {
      const i = est.defs.findIndex(d => d.tipo === "col" && minusc(d.nome) === minusc(atual));
      const [d] = est.defs.splice(i, 1);
      d.sql = sql;
      let onde = i;
      if (pos?.primeiro) onde = 0;
      else if (pos?.depois) {
        const j = est.defs.findIndex(x => x.tipo === "col" && minusc(x.nome) === minusc(pos.depois));
        if (j < 0) throw new ErroMy(1054, `Unknown column '${pos.depois}' in '${t}'`);
        onde = j + 1;
      }
      est.defs.splice(onde, 0, d);
    });
    (this.tipos[minusc(t)] ||= {})[minusc(atual)] = col.exib;
  }

  removerColuna(t, col) {
    const info = this.q(`PRAGMA table_info(${idt(t)})`);
    const x = info.find(y => minusc(y.name) === minusc(col));
    if (!x) throw new ErroMy(1091, `Can't DROP '${col}'; check that column/key exists`);
    if (info.length === 1) throw new ErroMy(1090, "You can't delete all columns with ALTER TABLE; use DROP TABLE instead");
    const propria = this.fks(t).find(f => f.cols.some(c => minusc(c) === minusc(col)));
    if (propria && propria.def.tipo === "res") throw new ErroMy(1828, `Cannot drop column '${x.name}': needed in a foreign key constraint '${propria.nome}'`);
    const filha = this.filhas(t).find(f => f.fk.refCols.some(c => minusc(c) === minusc(col)) && minusc(f.tabela) !== minusc(t));
    if (filha) throw new ErroMy(1829, `Cannot drop column '${x.name}': needed in a foreign key constraint '${filha.fk.nome}' of table '${filha.tabela}'`);
    this.reconstruir(t, est => {
      est.defs = est.defs.filter(d => {
        if (d.tipo === "col") return minusc(d.nome) !== minusc(x.name);
        const u0 = d.toks?.[0]?.u;
        const cur = new Cur(d.toks || []);
        if (u0 === "CONSTRAINT") { cur.pega(); cur.pega(); }
        if (cur.aceita("PRIMARY", "KEY") || cur.aceita("UNIQUE")) {
          const cols = nomesColunas(cur.parenteses() || []);
          return !cols.some(c => minusc(c) === minusc(x.name));
        }
        return true;
      });
    });
    delete (this.tipos[minusc(t)] || {})[minusc(x.name)];
  }

  // Recria a tabela com novas definições (o jeito SQLite de fazer MODIFY/ADD FK/DROP...)
  reconstruir(t, mexer) {
    const est = this.analisar(t);
    const antigas = new Set(est.defs.filter(d => d.tipo === "col").map(d => minusc(d.nome)));
    const extras = new Map();
    mexer(est, extras);
    const cols = est.defs.filter(d => d.tipo === "col" && !d.novo && antigas.has(minusc(d.nome)));
    const indices = this.q("SELECT sql FROM sqlite_master WHERE type='index' AND lower(tbl_name)=lower(?) AND sql IS NOT NULL", [t]).map(r => r.sql);
    const tmp = "__bsql_tmp";
    this.rodar(`DROP TABLE IF EXISTS ${idt(tmp)}`);
    this.rodar(`CREATE TABLE ${idt(tmp)} (${est.defs.map(d => d.sql).join(", ")})`);
    const destino = [...cols.map(d => idt(d.nome)), ...[...extras.keys()].map(idt)];
    const origem = [...cols.map(d => idt(d.nome)), ...[...extras.values()]];
    if (destino.length) this.rodar(`INSERT INTO ${idt(tmp)} (${destino.join(", ")}) SELECT ${origem.join(", ")} FROM ${idt(t)}`);
    this.rodar(`DROP TABLE ${idt(t)}`);
    this.rodar(`ALTER TABLE ${idt(tmp)} RENAME TO ${idt(t)}`);
    for (const s of indices) { try { this.rodar(s); } catch { /* índice de coluna removida */ } }
  }

  // ---------- erros ----------
  naoSuportado(oque) {
    return new ErroMy(1235, `A Bancada SQL não simula ${oque}. Ela executa comandos de tabelas e dados: CREATE/ALTER/DROP TABLE, INSERT, UPDATE, DELETE, SELECT, SHOW e DESCRIBE.`);
  }

  erroSintaxe(e) {
    const cmd = this.cmd || { texto: "", ini: 0 };
    let pos = -1;
    if (e.tok && typeof e.tok.p === "number") pos = e.tok.p - cmd.ini;
    else if (e.perto) {
      const p = minusc(cmd.texto).indexOf(minusc(e.perto));
      if (p >= 0) pos = p;
    }
    let trecho = "";
    if (pos >= 0 && pos <= cmd.texto.length) trecho = cmd.texto.slice(pos, pos + 80);
    else if (e.perto) trecho = e.perto;
    const linha = 1 + (pos > 0 ? (cmd.texto.slice(0, pos).match(/\n/g) || []).length : 0);
    return new ErroMy(1064, `You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '${trecho}' at line ${linha}`);
  }

  traduzirErro(e) {
    const m = String(e?.message || e);
    const bd = this.nomeBd();
    const ctx = this.ctx || {};
    const tabelaDe = s => s.replace(/^(main|temp)\./, "");
    let r;
    if ((r = /^no such table: (.+)$/i.exec(m))) { const t = tabelaDe(r[1]); return new ErroMy(1146, `Table '${t.includes(".") ? t : bd + "." + t}' doesn't exist`); }
    if ((r = /^unknown database (.+)$/i.exec(m))) return new ErroMy(1049, `Unknown database '${r[1]}'`);
    if ((r = /^no such column: (.+)$/i.exec(m))) return new ErroMy(1054, `Unknown column '${r[1].replace(/"/g, "")}' in 'field list'`);
    if ((r = /^table (\S+) has no column named (.+)$/i.exec(m))) return new ErroMy(1054, `Unknown column '${r[2]}' in 'field list'`);
    if ((r = /^near "([\s\S]*)": syntax error$/i.exec(m))) return this.erroSintaxe(new ErroSintaxe(null, r[1]));
    if (/^(incomplete input|unrecognized token)/i.test(m)) {
      const t = /unrecognized token: "(.*)"/.exec(m);
      return this.erroSintaxe(new ErroSintaxe(null, t ? t[1] : ""));
    }
    if ((r = /^ambiguous column name: (.+)$/i.exec(m))) return new ErroMy(1052, `Column '${r[1]}' in field list is ambiguous`);
    if (/misuse of (aggregate|window)/i.test(m) || /aggregate functions are not allowed/i.test(m)) return new ErroMy(1111, "Invalid use of group function");
    if ((r = /^no such function: (.+)$/i.exec(m))) return new ErroMy(1305, `FUNCTION ${bd}.${minusc(r[1])} does not exist`);
    if ((r = /^wrong number of arguments to function (\w+)/i.exec(m))) return new ErroMy(1582, `Incorrect parameter count in the call to native function '${minusc(r[1])}'`);
    if (/has \d+ columns but \d+ values were supplied|\d+ values for \d+ columns|all VALUES must have the same number of terms/i.test(m)) return new ErroMy(1136, "Column count doesn't match value count at row 1");
    if ((r = /^duplicate column name: (.+)$/i.exec(m))) return new ErroMy(1060, `Duplicate column name '${r[1]}'`);
    if ((r = /^(?:table|view) (\S+) already exists$/i.exec(m))) return new ErroMy(1050, `Table '${r[1].replace(/"/g, "")}' already exists`);
    if ((r = /^index (\S+) already exists$/i.exec(m))) return new ErroMy(1061, `Duplicate key name '${r[1]}'`);
    if ((r = /^no such index: (.+)$/i.exec(m))) return new ErroMy(1091, `Can't DROP '${r[1]}'; check that column/key exists`);
    if (/datatype mismatch/i.test(m)) return new ErroMy(1366, "Incorrect integer value for column at row 1");
    if (/ORDER BY term out of range|GROUP BY term out of range/i.test(m)) { const n = /(\d+)(st|nd|rd|th) (ORDER|GROUP)/.exec(m); return new ErroMy(1054, `Unknown column '${n ? n[1] : "?"}' in '${n && n[3] === "GROUP" ? "group" : "order"} statement'`); }
    if (/sub-select returns \d+ columns|row value misused/i.test(m)) return new ErroMy(1241, "Operand should contain 1 column(s)");
    if (/do not have the same number of result columns/i.test(m)) return new ErroMy(1222, "The used SELECT statements have a different number of columns");
    if (/foreign key mismatch/i.test(m)) return new ErroMy(1822, "Failed to add the foreign key constraint. Missing index for constraint in the referenced table");
    if ((r = /^NOT NULL constraint failed: (?:[^.]+\.)?(.+)$/i.exec(m))) {
      const col = r[1];
      if (ctx.tipo === "INSERT" && ctx.colunas && !ctx.colunas.some(c => minusc(c) === minusc(col))) return new ErroMy(1364, `Field '${col}' doesn't have a default value`);
      return new ErroMy(1048, `Column '${col}' cannot be null`);
    }
    if ((r = /^UNIQUE constraint failed: (.+)$/i.exec(m))) {
      const [tb, col] = r[1].split(",")[0].trim().split(".");
      let chave = col;
      try { if (this.q(`PRAGMA table_info(${idt(tb)})`).some(x => x.pk > 0 && minusc(x.name) === minusc(col))) chave = "PRIMARY"; } catch { /* ok */ }
      return new ErroMy(1062, `Duplicate entry for key '${tb}.${chave}'`);
    }
    if ((r = /^CHECK constraint failed: (.+)$/i.exec(m))) {
      const nome = r[1].trim();
      if (/^enum_/i.test(nome)) return new ErroMy(1265, `Data truncated for column '${nome.slice(5)}' at row 1`);
      return new ErroMy(3819, `Check constraint '${nome}' is violated.`);
    }
    if (/FOREIGN KEY constraint failed/i.test(m)) {
      const t = ctx.tabela;
      if (t) {
        const proprias = this.fks(t);
        const filho = ctx.tipo === "INSERT" || (ctx.tipo === "UPDATE" && proprias.some(f => f.cols.some(c => (ctx.colsSet || []).some(s => minusc(s) === minusc(c)))));
        if (filho && proprias.length) return new ErroMy(1452, `Cannot add or update a child row: a foreign key constraint fails ${this.textoFk(t, proprias[0])}`);
        const f = this.filhas(t)[0];
        if (f) return new ErroMy(1451, `Cannot delete or update a parent row: a foreign key constraint fails ${this.textoFk(f.tabela, f.fk)}`);
      }
      return new ErroMy(1452, "Cannot add or update a child row: a foreign key constraint fails");
    }
    if (/cannot (start|commit|rollback)/i.test(m)) return new ErroMy(1105, m);
    return new ErroMy(1105, `Unknown error: ${m}`);
  }

  // estrutura para o navegador de schemas
  estrutura() {
    return this.bancos.map(b => {
      const ativo = this.ativo && minusc(b) === minusc(this.ativo);
      if (!ativo) return { nome: b, ativo: false, tabelas: [] };
      const tabelas = this.listarTabelas().map(t => {
        let colunas = [];
        try {
          const fkCols = new Set(t.tipo === "table" ? this.fks(t.nome).flatMap(f => f.cols.map(minusc)) : []);
          colunas = this.descrever(t.nome).linhas.map(l => ({ nome: l[0], tipo: l[1], pk: l[3] === "PRI", fk: fkCols.has(minusc(l[0])), nulo: l[2] === "YES" }));
        } catch { /* view quebrada */ }
        return { nome: t.nome, view: t.tipo === "view", colunas };
      });
      return { nome: b, ativo: true, tabelas };
    });
  }
}

function likeRegex(padrao) {
  let s = "";
  for (let i = 0; i < padrao.length; i++) {
    const ch = padrao[i];
    if (ch === "\\" && i + 1 < padrao.length) { s += padrao[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); continue; }
    s += ch === "%" ? ".*" : ch === "_" ? "." : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + s + "$", "is");
}

function resumoAcao(texto) {
  const s = String(texto || "").replace(/\s+/g, " ").trim();
  return s.length > 160 ? s.slice(0, 157) + "..." : s;
}

// =====================================================================================
// Correção: base nova, forma canônica e hashes
// =====================================================================================
function normalizarValor(v) {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : String(v);
  if (typeof v === "bigint") return String(v);
  if (v instanceof Uint8Array) return "0x" + [...v].map(b => b.toString(16).padStart(2, "0")).join("");
  return String(v).trim();
}

async function sha256(txt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function impressoes(linhas) {
  const norm = linhas.map(l => l.map(normalizarValor));
  const json = norm.map(l => JSON.stringify(l));
  return {
    linhas: norm,
    impressao: await sha256("[" + json.join(",") + "]"),
    conjunto: await sha256("[" + [...json].sort().join(",") + "]")
  };
}

// despejo de todas as tabelas (para tarefa de alteração sem verificação)
function despejo(s) {
  const linhas = [];
  for (const t of s.listarTabelas()) {
    if (t.tipo !== "table") continue;
    const r = s.rodar(`SELECT * FROM ${idt(t.nome)} ORDER BY rowid`, LIMITE_AVALIACAO);
    for (const l of r.linhas) linhas.push([minusc(t.nome), ...l]);
  }
  return { colunas: ["tabela"], linhas };
}

async function novaBase(questao) {
  const SQL = await carregarMotor();
  const s = new Sessao(SQL, questao?.banco?.nome, { leniente: true });
  s.seguro = false;
  const falha = s.executarScript(questao?.banco?.setup || "", { limite: 0 }).find(r => !r.ok);
  if (falha) { s.fechar(); throw new Error(`a base da questão não pôde ser montada (${falha.acao}): ${falha.mensagem}`); }
  return s;
}

export async function avaliarTarefa(questao, tarefa, sql) {
  const vazio = { impressao: "", conjunto: "", erro: "", linhas: [] };
  if (!temComando(sql)) return vazio;
  let s;
  try { s = await novaBase(questao); }
  catch (e) { return { ...vazio, erro: "Falha ao preparar a base: " + (e?.message || e) }; }
  try {
    const res = s.executarScript(sql, { limite: LIMITE_AVALIACAO });
    const falha = res.find(r => !r.ok);
    if (falha) return { ...vazio, erro: falha.mensagem };
    let conj = null;
    if (tarefa?.tipo === "alteracao") {
      if (temComando(tarefa.verificacao)) {
        s.seguro = false;
        const v = s.executarScript(tarefa.verificacao, { limite: LIMITE_AVALIACAO });
        const fv = v.find(r => !r.ok);
        if (fv) return { ...vazio, erro: "A conferência da tarefa falhou depois do seu SQL: " + fv.mensagem };
        conj = [...v].reverse().find(r => r.resultado)?.resultado || null;
        if (!conj) return { ...vazio, erro: "A verificação da tarefa não tem SELECT." };
      } else conj = despejo(s);
    } else {
      // vale o último SELECT; SHOW/DESCRIBE só contam se não houver nenhum SELECT
      conj = ([...res].reverse().find(r => r.resultado && r.consulta) || [...res].reverse().find(r => r.resultado))?.resultado || null;
      if (!conj) return { ...vazio, erro: "Nenhuma consulta (SELECT) foi executada: o resultado da tarefa precisa vir de um SELECT." };
    }
    const h = await impressoes(conj.linhas);
    return { impressao: h.impressao, conjunto: h.conjunto, erro: "", linhas: h.linhas };
  } finally { s.fechar(); }
}

export async function calcularGabarito(questao, gabarito) {
  const tarefas = questao?.tarefas || [];
  const saida = { ...(gabarito || {}), tarefas: {} };
  for (let i = 0; i < tarefas.length; i++) {
    const t = tarefas[i];
    const rotulo = `Tarefa ${i + 1} (${t.id})`;
    const g = gabarito?.tarefas?.[t.id];
    if (!g || !temComando(g.sql)) throw new Error(`Gabarito da ${rotulo}: falta o SQL da resposta.`);
    const r = await avaliarTarefa(questao, t, g.sql);
    if (r.erro) throw new Error(`Gabarito da ${rotulo} não funcionou: ${r.erro}`);
    if (!r.impressao) throw new Error(`Gabarito da ${rotulo}: ${t.tipo === "alteracao" ? "a verificação" : "a consulta"} não devolveu resultado.`);
    saida.tarefas[t.id] = { ...g, ordemImporta: !!g.ordemImporta, impressao: r.impressao, conjunto: r.conjunto };
  }
  return saida;
}

export function resumoResposta(questao, resposta) {
  const tarefas = questao?.tarefas || [];
  const partes = [];
  tarefas.forEach((t, i) => {
    const r = resposta?.tarefas?.[t.id] || {};
    const sql = String(r.sql || "").trim();
    let s = `Tarefa ${i + 1}${t.tipo === "alteracao" ? " (alteração)" : " (consulta)"}: ${t.texto || ""}\nSQL do aluno:\n${sql || "(em branco)"}`;
    if (r.erro) s += `\nErro ao executar: ${r.erro}`;
    partes.push(s);
  });
  return partes.join("\n\n");
}

// =====================================================================================
// Interface
// =====================================================================================
const PALAVRAS = new Set(("SELECT FROM WHERE AND OR NOT IN IS NULL LIKE BETWEEN ORDER BY GROUP HAVING LIMIT OFFSET AS ON JOIN INNER LEFT RIGHT "
  + "OUTER CROSS NATURAL UNION ALL DISTINCT INSERT INTO VALUES VALUE UPDATE SET DELETE CREATE TABLE DATABASE SCHEMA DROP ALTER ADD COLUMN "
  + "MODIFY CHANGE RENAME TO PRIMARY KEY FOREIGN REFERENCES CONSTRAINT UNIQUE INDEX DEFAULT AUTO_INCREMENT CHECK IF EXISTS USE SHOW "
  + "TABLES DATABASES SCHEMAS COLUMNS FIELDS DESCRIBE DESC ASC CASE WHEN THEN ELSE END TRUNCATE ENGINE CHARSET CHARACTER COLLATE CASCADE "
  + "RESTRICT ACTION NO VIEW REPLACE IGNORE DUPLICATE UNSIGNED SIGNED ZEROFILL TRUE FALSE EXPLAIN WITH RECURSIVE INTERVAL BEGIN COMMIT "
  + "ROLLBACK START TRANSACTION SAVEPOINT AFTER FIRST TEMPORARY USING EXCEPT INTERSECT ANY SOME ROWS ROW OVER PARTITION GRANT REVOKE "
  + "INT INTEGER TINYINT SMALLINT MEDIUMINT BIGINT DECIMAL NUMERIC FLOAT DOUBLE REAL BIT BOOL BOOLEAN CHAR VARCHAR TEXT TINYTEXT "
  + "MEDIUMTEXT LONGTEXT BLOB DATE DATETIME TIMESTAMP TIME YEAR ENUM JSON INNODB DIV MOD XOR REGEXP SEPARATOR CURRENT_DATE "
  + "CURRENT_TIMESTAMP CURRENT_TIME COMMENT").split(" "));
const FUNCOES_REALCE = new Set(("COUNT SUM AVG MIN MAX NOW CURDATE CURTIME CONCAT CONCAT_WS IFNULL COALESCE NULLIF UPPER LOWER UCASE LCASE "
  + "LENGTH CHAR_LENGTH SUBSTRING SUBSTR TRIM LTRIM RTRIM REPLACE ROUND TRUNCATE FLOOR CEIL CEILING ABS DATE_FORMAT DATEDIFF DATE_ADD "
  + "DATE_SUB DAY MONTH HOUR MINUTE SECOND GROUP_CONCAT CAST CONVERT LOCATE INSTR LPAD RPAD POWER POW SQRT RAND FORMAT TIMESTAMPDIFF "
  + "DAYNAME MONTHNAME DAYOFWEEK WEEKDAY LAST_DAY QUARTER GREATEST LEAST REVERSE SUBSTRING_INDEX IIF").split(" "));

function realcar(txt) {
  let h = "";
  for (const t of tokenizar(txt)) {
    const v = escHtml(t.v);
    if (t.t === "com") h += `<span class="c">${v}</span>`;
    else if (t.t === "str") h += `<span class="s">${v}</span>`;
    else if (t.t === "num") h += `<span class="n">${v}</span>`;
    else if (t.t === "id") h += `<span class="i">${v}</span>`;
    else if (t.t === "pal") {
      const u = t.v.toUpperCase();
      h += PALAVRAS.has(u) ? `<span class="k">${v}</span>` : FUNCOES_REALCE.has(u) ? `<span class="f">${v}</span>` : v;
    } else h += v;
  }
  return h;
}

const CSS = `
.bsql{--bsql-borda:#b8bcc4;--bsql-painel:#ececec;--bsql-cab:#dcdfe4;--bsql-sel:#cfe3fb;--bsql-mono:Consolas,"Cascadia Mono","Courier New",monospace;
  display:flex;flex-direction:column;height:min(660px,86vh);min-height:500px;border:1px solid var(--bsql-borda);border-radius:8px;overflow:hidden;
  background:var(--bsql-painel);color:#1f2328;font:13px/1.35 "Segoe UI",system-ui,-apple-system,Arial,sans-serif;text-align:left}
.bsql *{box-sizing:border-box}
.bsql button{font:inherit;color:inherit}
.bsql-barra{display:flex;align-items:center;gap:4px;padding:5px 8px;background:linear-gradient(#f7f7f7,#e4e4e4);border-bottom:1px solid var(--bsql-borda);flex-wrap:wrap}
.bsql-btn{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 9px;border:1px solid transparent;border-radius:4px;background:transparent;cursor:pointer;white-space:nowrap}
.bsql-btn:hover:not(:disabled){background:#fff;border-color:#c3c7cf}
.bsql-btn:focus-visible{outline:2px solid #1f6feb;outline-offset:1px}
.bsql-btn:disabled{opacity:.45;cursor:default}
.bsql-btn .ico{font-size:15px;line-height:1}
.bsql-btn.raio .ico{color:#d29a00}
.bsql-sep{width:1px;height:20px;background:#c3c7cf;margin:0 4px}
.bsql-status{margin-left:auto;display:flex;gap:10px;align-items:center;font-size:12px;color:#57606a}
.bsql-status b{color:#1f2328;font-weight:600}
.bsql-pill{padding:1px 7px;border-radius:999px;background:#fff;border:1px solid #c3c7cf}
.bsql-pill.on{background:#fff4dc;border-color:#e3b341;color:#7a4d00}
.bsql-corpo{flex:1;display:grid;grid-template-columns:200px minmax(0,1fr);min-height:0}
.bsql-nav{display:flex;flex-direction:column;min-height:0;background:#f6f6f6;border-right:1px solid var(--bsql-borda)}
.bsql-nav-tit{padding:5px 8px;font-size:11px;font-weight:700;letter-spacing:.06em;color:#4b525c;background:var(--bsql-cab);border-bottom:1px solid var(--bsql-borda)}
.bsql-nav-sub{padding:4px 8px;font-size:11px;font-weight:600;color:#57606a;border-bottom:1px solid #e1e3e6}
.bsql-arvore{flex:1;overflow:auto;padding:4px 0 8px;font-size:12.5px}
.bsql-arvore details{padding-left:12px}
.bsql-arvore>details{padding-left:4px}
.bsql-arvore summary{list-style:none;cursor:pointer;padding:1px 4px;border-radius:3px;white-space:nowrap;user-select:none}
.bsql-arvore summary::-webkit-details-marker{display:none}
.bsql-arvore summary::before{content:"▸";display:inline-block;width:12px;color:#6e7781;font-size:10px}
.bsql-arvore details[open]>summary::before{content:"▾"}
.bsql-arvore summary:hover,.bsql-col:hover{background:#e3ecf8}
.bsql-arvore .ativo>summary{font-weight:700}
.bsql-col{padding:1px 4px 1px 28px;white-space:nowrap;cursor:default;border-radius:3px}
.bsql-col .tp{color:#6e7781;font-size:11.5px;margin-left:4px}
.bsql-col .ic{display:inline-block;width:16px;text-align:center}
.bsql-ic-pk{color:#c69500}.bsql-ic-fk{color:#1f6feb}.bsql-ic-col{color:#8c959f;font-size:9px}
.bsql-vaz{padding:1px 4px 1px 28px;color:#8c959f;font-style:italic}
.bsql-principal{display:flex;flex-direction:column;min-width:0;min-height:0}
.bsql-abas{display:flex;gap:2px;padding:4px 6px 0;background:var(--bsql-cab);border-bottom:1px solid var(--bsql-borda);overflow-x:auto;flex:none}
.bsql-aba{height:27px;padding:0 12px;border:1px solid var(--bsql-borda);border-bottom:none;border-radius:5px 5px 0 0;background:#e8e9ec;cursor:pointer;white-space:nowrap;margin-bottom:-1px}
.bsql-aba[aria-selected="true"]{background:#fff;border-top:2px solid #1f6feb;font-weight:600}
.bsql-aba:focus-visible{outline:2px solid #1f6feb;outline-offset:-2px}
.bsql-tarefa{flex:none;max-height:92px;overflow:auto;padding:6px 10px;background:#fffbea;border-bottom:1px solid #e9dfae;font-size:13px}
.bsql-tarefa .rot{font-weight:700;margin-right:6px}
.bsql-tarefa .tipo{display:inline-block;font-size:11px;padding:0 6px;border-radius:999px;background:#e8effd;color:#1d4fb8;margin-right:6px;vertical-align:1px}
.bsql-tarefa .tipo.alt{background:#fdecef;color:#a00d25}
.bsql-tarefa .dica{display:block;color:#6e7781;font-size:11.5px;margin-top:2px}
.bsql-eds{flex:1 1 46%;min-height:110px;position:relative;background:#fff}
.bsql-ed{position:absolute;inset:0;display:flex}
.bsql-ed[hidden]{display:none}
.bsql-num{flex:none;min-width:38px;overflow:hidden;padding:6px 6px 40px 6px;background:#f3f3f3;border-right:1px solid #e1e3e6;color:#8c959f;text-align:right;
  font:13px/19px var(--bsql-mono);white-space:pre;user-select:none}
.bsql-area{position:relative;flex:1;min-width:0}
.bsql-area pre,.bsql-area textarea{position:absolute;top:0;left:0;margin:0;padding:6px 10px;border:0;font:13px/19px var(--bsql-mono);letter-spacing:0;
  white-space:pre;overflow-wrap:normal;word-wrap:normal;tab-size:2;-moz-tab-size:2;font-variant-ligatures:none;text-rendering:optimizeSpeed}
.bsql-area pre{right:0;bottom:0;overflow:hidden;pointer-events:none;color:#1f2328;background:transparent}
.bsql-area textarea{width:100%;height:100%;resize:none;outline:none;overflow:auto;background:transparent;color:transparent;caret-color:#111;-webkit-text-fill-color:transparent}
.bsql-area textarea::selection{background:rgba(31,111,235,.28);-webkit-text-fill-color:transparent}
.bsql-area textarea:read-only{caret-color:transparent}
.bsql-area pre .k{color:#1f3fbf}.bsql-area pre .f{color:#8250df}.bsql-area pre .s{color:#0a7a2f}.bsql-area pre .n{color:#b35900}
.bsql-area pre .c{color:#8c959f}.bsql-area pre .i{color:#953800}
.bsql-ed.foco{box-shadow:inset 0 0 0 1px #1f6feb}
.bsql-res{flex:1 1 34%;min-height:90px;display:flex;flex-direction:column;border-top:1px solid var(--bsql-borda);background:#fff}
.bsql-cab{flex:none;display:flex;align-items:center;gap:10px;height:26px;padding:0 8px;background:var(--bsql-cab);border-bottom:1px solid var(--bsql-borda);font-size:12px;font-weight:600;color:#3d444d}
.bsql-cab .info{font-weight:400;color:#57606a;margin-left:auto}
.bsql-grid{flex:1;overflow:auto;min-height:0}
.bsql table{border-collapse:collapse;font-size:12.5px}
.bsql-grid table{min-width:100%}
.bsql-grid th,.bsql-saida th{position:sticky;top:0;z-index:1;background:#f0f1f3;border:1px solid #d5d8dd;border-top:0;padding:3px 8px;text-align:left;font-weight:600;white-space:nowrap}
.bsql-grid td{border:1px solid #e3e5e8;padding:2px 8px;white-space:pre;max-width:340px;overflow:hidden;text-overflow:ellipsis;font-family:var(--bsql-mono);font-size:12.5px}
.bsql-grid td.num{text-align:right}
.bsql-grid tr:nth-child(even) td{background:#f8f9fa}
.bsql-grid tbody tr:hover td{background:var(--bsql-sel)}
.bsql-null{display:inline-block;padding:0 4px;border-radius:2px;background:#e6e6e6;color:#6e7781;font-size:11px;font-family:"Segoe UI",Arial,sans-serif}
.bsql-vazio{padding:14px;color:#6e7781}
.bsql-saida{flex:none;height:132px;display:flex;flex-direction:column;border-top:1px solid var(--bsql-borda);background:#fff}
.bsql-log{flex:1;overflow:auto;min-height:0}
.bsql-log table{width:100%;table-layout:fixed}
.bsql-log td{border-bottom:1px solid #eceef1;padding:2px 8px;vertical-align:top;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bsql-log td.msg{white-space:normal;overflow-wrap:anywhere}
.bsql-log tr.erro td.msg{color:#a40e26}
.bsql-ok,.bsql-er,.bsql-in{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;color:#fff;font-size:10px;font-weight:700}
.bsql-ok{background:#2da44e}.bsql-er{background:#cf222e}.bsql-in{background:#8c959f}
.bsql-dica{margin-left:auto;font-weight:400;color:#6e7781;font-size:11.5px}
/* blindagem contra os estilos globais do site (button, textarea, table, th, td) */
.bsql button.bsql-btn,.bsql button.bsql-aba{font:inherit;font-weight:400;color:#1f2328;min-height:0;line-height:1.2;transform:none;box-shadow:none;text-decoration:none;justify-content:flex-start}
.bsql button.bsql-btn{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 9px;border:1px solid transparent;border-radius:4px;background:transparent}
.bsql button.bsql-btn:hover:not(:disabled){background:#fff;border-color:#c3c7cf}
.bsql button.bsql-btn:disabled,.bsql button.bsql-btn:disabled:hover{background:transparent;border-color:transparent;opacity:.45;cursor:default}
.bsql button.bsql-aba{height:27px;padding:0 12px;border:1px solid var(--bsql-borda);border-bottom:none;border-radius:5px 5px 0 0;background:#e8e9ec}
.bsql button.bsql-aba:hover{background:#f4f5f7}
.bsql button.bsql-aba[aria-selected="true"],.bsql button.bsql-aba[aria-selected="true"]:hover{background:#fff;border-top:2px solid #1f6feb;font-weight:600}
.bsql button:active{transform:none}
.bsql .bsql-area textarea,.bsql .bsql-area textarea:focus{width:100%;height:100%;min-height:0;margin:0;padding:6px 10px;border:0;border-radius:0;box-shadow:none;outline:none;
  background:transparent;background-color:transparent;font:13px/19px var(--bsql-mono);resize:none;transition:none}
.bsql .bsql-area pre{font:13px/19px var(--bsql-mono);padding:6px 10px;margin:0;border:0;border-radius:0;background:transparent;box-shadow:none}
.bsql table{width:auto;border-collapse:collapse;border-spacing:0;font-size:12.5px}
.bsql .bsql-grid table{min-width:100%}
.bsql .bsql-log table{width:100%;table-layout:fixed}
.bsql .bsql-grid th,.bsql .bsql-saida th{position:sticky;top:0;z-index:1;background:#f0f1f3;color:#3d444d;border:1px solid #d5d8dd;border-top:0;padding:3px 8px;
  text-align:left;font-size:12px;font-weight:600;text-transform:none;letter-spacing:0;white-space:nowrap}
.bsql .bsql-grid tr td{border:1px solid #e3e5e8;padding:2px 8px;vertical-align:top;background:#fff}
.bsql .bsql-grid tr:nth-child(even) td{background:#f8f9fa}
.bsql .bsql-grid tbody tr:hover td{background:var(--bsql-sel)}
.bsql .bsql-log tr td{border:0;border-bottom:1px solid #eceef1;padding:2px 8px;vertical-align:top;background:#fff}
.bsql .bsql-log tr:hover td{background:#f6f8fa}
.bsql .bsql-arvore summary{font-weight:400}
.bsql .bsql-arvore .ativo>summary{font-weight:700}
@media (max-width:820px){
  .bsql{height:auto;min-height:0}
  .bsql-corpo{grid-template-columns:1fr}
  .bsql-nav{max-height:130px;border-right:0;border-bottom:1px solid var(--bsql-borda)}
  .bsql-eds{flex:none;height:220px}
  .bsql-res{flex:none;height:200px}
  .bsql-status .db{display:none}
  .bsql-btn .txt-longo{display:none}
}
`;

function injetarCss() {
  if (typeof document === "undefined" || document.getElementById("bsql-css")) return;
  const st = document.createElement("style");
  st.id = "bsql-css";
  st.textContent = CSS;
  document.head.appendChild(st);
}

function formatarCelula(v) {
  if (v === null || v === undefined) return { html: '<span class="bsql-null">NULL</span>', num: false };
  if (typeof v === "number") {
    const s = Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)));
    return { html: escHtml(s), num: true };
  }
  if (v instanceof Uint8Array) return { html: '<span class="bsql-null">BLOB</span>', num: false };
  return { html: escHtml(v), num: false };
}

export function montarBancada(container, opcoes = {}) {
  injetarCss();
  const questao = opcoes.questao || {};
  const salvo = opcoes.valor || null;
  const onMudar = typeof opcoes.onMudar === "function" ? opcoes.onMudar : null;
  const somenteLeitura = !!opcoes.somenteLeitura;
  const tarefas = Array.isArray(questao.tarefas) ? questao.tarefas : [];
  const nomeBanco = questao.banco?.nome || "banco";
  const uid = "bsql" + Math.random().toString(36).slice(2, 8);

  const raiz = document.createElement("div");
  raiz.className = "bsql";
  raiz.innerHTML = `
    <div class="bsql-barra" role="toolbar" aria-label="Ferramentas da Bancada SQL">
      <button type="button" class="bsql-btn raio" data-acao="tudo" title="Executar tudo (Ctrl+Shift+Enter)" disabled><span class="ico" aria-hidden="true">⚡</span><span>Executar tudo</span></button>
      <button type="button" class="bsql-btn raio" data-acao="atual" title="Executar a seleção ou o comando onde está o cursor (Ctrl+Enter)" disabled><span class="ico" aria-hidden="true">⚡</span><span>Executar seleção<span class="txt-longo">/linha atual</span></span></button>
      <span class="bsql-sep" aria-hidden="true"></span>
      <button type="button" class="bsql-btn" data-acao="limpar" title="Limpar o Output e o Result Grid (o seu SQL não é apagado)"><span class="ico" aria-hidden="true">🧹</span><span>Limpar</span></button>
      <button type="button" class="bsql-btn" data-acao="restaurar" title="Recriar o banco do zero, com os dados originais" disabled><span class="ico" aria-hidden="true">↺</span><span>Restaurar base</span></button>
      <div class="bsql-status" aria-live="polite">
        <span class="db">Banco ativo: <b data-r="ativo">${escHtml(nomeBanco)}</b></span>
        <span class="bsql-pill on" data-r="seguro" title="Safe Updates: UPDATE/DELETE precisam de WHERE com coluna chave. Desligue com SET SQL_SAFE_UPDATES = 0;">Safe updates</span>
      </div>
    </div>
    <div class="bsql-corpo">
      <aside class="bsql-nav" aria-label="Navegador de schemas">
        <div class="bsql-nav-tit">NAVEGADOR</div>
        <div class="bsql-nav-sub">SCHEMAS</div>
        <div class="bsql-arvore" data-r="arvore"><div class="bsql-vazio">Conectando…</div></div>
      </aside>
      <section class="bsql-principal">
        <div class="bsql-abas" role="tablist" aria-label="Tarefas">
          ${tarefas.map((t, i) => `<button type="button" class="bsql-aba" role="tab" id="${uid}-aba-${i}" aria-controls="${uid}-ed-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-i="${i}">Tarefa ${i + 1}</button>`).join("")}
        </div>
        <div class="bsql-tarefa" data-r="tarefa"></div>
        <div class="bsql-eds" data-r="eds">
          ${tarefas.map((t, i) => `
          <div class="bsql-ed" id="${uid}-ed-${i}" role="tabpanel" aria-labelledby="${uid}-aba-${i}" ${i === 0 ? "" : "hidden"}>
            <div class="bsql-num" aria-hidden="true">1</div>
            <div class="bsql-area">
              <pre class="bsql-realce" aria-hidden="true"></pre>
              <textarea data-campo-resposta data-tarefa="${escHtml(t.id)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" wrap="off"
                aria-label="SQL da Tarefa ${i + 1}" ${somenteLeitura ? "readonly" : ""}></textarea>
            </div>
          </div>`).join("")}
        </div>
        <div class="bsql-res">
          <div class="bsql-cab"><span>Result Grid</span><span class="info" data-r="resinfo"></span></div>
          <div class="bsql-grid" data-r="grid"><div class="bsql-vazio">Execute um SELECT para ver as linhas aqui.</div></div>
        </div>
      </section>
    </div>
    <div class="bsql-saida">
      <div class="bsql-cab"><span>Output</span><span style="font-weight:400">Action Output</span><span class="bsql-dica">Ctrl+Enter executa o comando atual · Ctrl+Shift+Enter executa tudo</span></div>
      <div class="bsql-log" data-r="log">
        <table><colgroup><col style="width:28px"><col style="width:34px"><col style="width:70px"><col style="width:38%"><col><col style="width:84px"></colgroup>
          <thead><tr><th></th><th>#</th><th>Hora</th><th>Ação</th><th>Mensagem</th><th>Duração</th></tr></thead><tbody></tbody></table>
      </div>
    </div>`;
  container.innerHTML = "";
  container.appendChild(raiz);

  const $r = n => raiz.querySelector(`[data-r="${n}"]`);
  const arvore = $r("arvore"), grid = $r("grid"), resinfo = $r("resinfo"), logBody = $r("log").querySelector("tbody"), logBox = $r("log");
  const caixaTarefa = $r("tarefa");
  const botoes = Object.fromEntries([...raiz.querySelectorAll("[data-acao]")].map(b => [b.dataset.acao, b]));
  const abas = [...raiz.querySelectorAll(".bsql-aba")];
  const eds = [...raiz.querySelectorAll(".bsql-ed")].map((el, i) => ({
    el, tarefa: tarefas[i], ta: el.querySelector("textarea"), pre: el.querySelector("pre"), num: el.querySelector(".bsql-num"), soltarTab: false
  }));

  let atual = 0, sessao = null, destruido = false, timer = null, nLog = 0;
  const cache = new Map();

  // ---------- editor ----------
  function sincronizar(ed) {
    const ta = ed.ta;
    ed.pre.style.right = (ta.offsetWidth - ta.clientWidth) + "px";
    ed.pre.style.bottom = (ta.offsetHeight - ta.clientHeight) + "px";
    ed.pre.scrollTop = ta.scrollTop;
    ed.pre.scrollLeft = ta.scrollLeft;
    ed.num.scrollTop = ta.scrollTop;
  }
  function atualizarEditor(ed) {
    const v = ed.ta.value;
    ed.pre.innerHTML = realcar(v) + "\n ";
    const n = v.split("\n").length;
    if (ed.nLinhas !== n) {
      ed.nLinhas = n;
      ed.num.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
    }
    sincronizar(ed);
  }
  function inserirTexto(ta, txt) {
    ta.focus();
    let ok = false;
    try { ok = document.execCommand && document.execCommand("insertText", false, txt); } catch { ok = false; }
    if (!ok) {
      ta.setRangeText(txt, ta.selectionStart, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function agendarMudanca() {
    if (!onMudar) return;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; if (!destruido) onMudar(); }, 800);
  }

  eds.forEach(ed => {
    ed.ta.value = salvo?.tarefas?.[ed.tarefa.id]?.sql || "";
    ed.ta.addEventListener("input", () => { atualizarEditor(ed); agendarMudanca(); });
    ed.ta.addEventListener("scroll", () => sincronizar(ed));
    ed.ta.addEventListener("focus", () => ed.el.classList.add("foco"));
    ed.ta.addEventListener("blur", () => ed.el.classList.remove("foco"));
    ed.ta.addEventListener("keydown", ev => {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        ev.stopPropagation();
        executar(ev.shiftKey ? "tudo" : "atual");
        return;
      }
      if (ev.key === "Escape") { ed.soltarTab = true; return; }
      if (ev.key === "Tab" && !ev.ctrlKey && !ev.altKey && !ev.metaKey && !ed.ta.readOnly && !ed.soltarTab && !ev.shiftKey) {
        ev.preventDefault();
        ev.stopPropagation();
        inserirTexto(ed.ta, "  ");
        return;
      }
      ed.soltarTab = false;
    });
  });
  const aoRedimensionar = () => eds.forEach(sincronizar);
  const obs = typeof ResizeObserver === "function" ? new ResizeObserver(aoRedimensionar) : null;
  obs?.observe(raiz);

  // ---------- abas ----------
  function mostrarTarefa() {
    const t = tarefas[atual];
    if (!t) { caixaTarefa.innerHTML = `<span class="dica">Esta questão não tem tarefas.</span>`; return; }
    const alt = t.tipo === "alteracao";
    caixaTarefa.innerHTML = `<span class="rot">Tarefa ${atual + 1}</span><span class="tipo${alt ? " alt" : ""}">${alt ? "alteração" : "consulta"}</span>${escHtml(t.texto || "")}`
      + `<span class="dica">${alt ? "Escreva o(s) comando(s) que fazem a alteração pedida." : "O resultado corrigido é o do último SELECT deste editor."} Cada tarefa é corrigida separadamente, sobre a base original.</span>`;
  }
  function trocarAba(i, focar = false) {
    if (i < 0 || i >= eds.length) { mostrarTarefa(); return; }
    atual = i;
    abas.forEach((a, j) => { a.setAttribute("aria-selected", String(j === i)); a.tabIndex = j === i ? 0 : -1; });
    eds.forEach((ed, j) => { ed.el.hidden = j !== i; });
    mostrarTarefa();
    atualizarEditor(eds[i]);
    if (focar) eds[i].ta.focus();
  }
  abas.forEach((a, i) => {
    a.addEventListener("click", () => trocarAba(i, true));
    a.addEventListener("keydown", ev => {
      if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
        ev.preventDefault();
        const j = (i + (ev.key === "ArrowRight" ? 1 : -1) + abas.length) % abas.length;
        trocarAba(j);
        abas[j].focus();
      }
    });
  });

  // ---------- saída ----------
  const hora = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
  function registrar({ ok, info = false, acao, mensagem, duracao = null }) {
    nLog++;
    const tr = document.createElement("tr");
    if (!ok && !info) tr.className = "erro";
    const icone = info ? '<span class="bsql-in" aria-label="informação">i</span>' : ok ? '<span class="bsql-ok" aria-label="sucesso">✔</span>' : '<span class="bsql-er" aria-label="erro">✖</span>';
    tr.innerHTML = `<td>${icone}</td><td>${nLog}</td><td>${hora()}</td><td title="${escHtml(acao)}">${escHtml(acao)}</td><td class="msg">${escHtml(mensagem)}</td><td>${duracao === null ? "" : duracao.toFixed(3) + " sec"}</td>`;
    logBody.appendChild(tr);
    logBox.scrollTop = logBox.scrollHeight;
  }
  function mostrarResultado(r) {
    if (!r) { grid.innerHTML = '<div class="bsql-vazio">Execute um SELECT para ver as linhas aqui.</div>'; resinfo.textContent = ""; return; }
    const linhas = r.linhas.slice(0, LINHAS_GRID);
    if (!r.colunas.length) { grid.innerHTML = '<div class="bsql-vazio">O comando não devolveu colunas.</div>'; resinfo.textContent = ""; return; }
    let h = "<table><thead><tr>" + r.colunas.map(c => `<th>${escHtml(c)}</th>`).join("") + "</tr></thead><tbody>";
    for (const l of linhas) h += "<tr>" + l.map(v => { const f = formatarCelula(v); return `<td${f.num ? ' class="num"' : ""}>${f.html}</td>`; }).join("") + "</tr>";
    h += "</tbody></table>";
    if (!r.linhas.length) h += '<div class="bsql-vazio">Nenhuma linha encontrada.</div>';
    grid.innerHTML = h;
    grid.scrollTop = 0;
    resinfo.textContent = r.linhas.length > LINHAS_GRID ? `mostrando ${LINHAS_GRID} de ${r.linhas.length} linhas` : `${r.linhas.length} ${r.linhas.length === 1 ? "linha" : "linhas"}`;
  }

  // ---------- navegador ----------
  function atualizarArvore() {
    if (!sessao) return;
    const abertos = new Set([...arvore.querySelectorAll("details[open]")].map(d => d.dataset.k));
    const primeira = !arvore.dataset.pronta;
    const aberto = (k, padrao) => (primeira ? padrao : abertos.has(k)) ? " open" : "";
    let h = "";
    for (const b of sessao.estrutura()) {
      const kb = "b:" + minusc(b.nome);
      h += `<details data-k="${escHtml(kb)}"${aberto(kb, b.ativo)} class="${b.ativo ? "ativo" : ""}"><summary title="${b.ativo ? "banco ativo" : "use USE " + escHtml(b.nome) + "; para ativar"}">🛢 ${escHtml(b.nome)}</summary>`;
      const tabs = b.tabelas.filter(t => !t.view), views = b.tabelas.filter(t => t.view);
      const grupo = (rot, lista, k) => {
        let g = `<details data-k="${escHtml(k)}"${aberto(k, rot === "Tables")}><summary>📁 ${rot}</summary>`;
        if (!lista.length) g += `<div class="bsql-vaz">${b.ativo ? "vazio" : "—"}</div>`;
        for (const t of lista) {
          const kt = k + ":" + minusc(t.nome);
          g += `<details data-k="${escHtml(kt)}"${aberto(kt, false)}><summary data-ins="${escHtml(t.nome)}" title="Clique duplo: insere o nome no editor">${t.view ? "◫" : "▦"} ${escHtml(t.nome)}</summary>`;
          for (const c of t.colunas) {
            const ic = c.pk ? '<span class="ic bsql-ic-pk" title="chave primária">🔑</span>' : c.fk ? '<span class="ic bsql-ic-fk" title="chave estrangeira">🔗</span>' : '<span class="ic bsql-ic-col">◆</span>';
            g += `<div class="bsql-col" data-ins="${escHtml(c.nome)}" title="${escHtml(c.nome)} ${escHtml(c.tipo)}${c.pk ? " · PK" : ""}${c.fk ? " · FK" : ""}${c.nulo ? "" : " · NOT NULL"}">${ic}${escHtml(c.nome)}<span class="tp">${escHtml(c.tipo)}</span></div>`;
          }
          g += "</details>";
        }
        return g + "</details>";
      };
      if (b.ativo) { h += grupo("Tables", tabs, kb + ":t"); if (views.length) h += grupo("Views", views, kb + ":v"); }
      else h += '<div class="bsql-vaz">sem tabelas</div>';
      h += "</details>";
    }
    arvore.innerHTML = h || '<div class="bsql-vazio">Nenhum banco. Use CREATE DATABASE.</div>';
    arvore.dataset.pronta = "1";
    $r("ativo").textContent = sessao.ativo || "(nenhum)";
    const pill = $r("seguro");
    pill.classList.toggle("on", sessao.seguro);
    pill.textContent = sessao.seguro ? "Safe updates: ON" : "Safe updates: OFF";
  }
  arvore.addEventListener("dblclick", ev => {
    const alvo = ev.target.closest("[data-ins]");
    const ed = eds[atual];
    if (!alvo || !ed || ed.ta.readOnly) return;
    ev.preventDefault();
    inserirTexto(ed.ta, alvo.dataset.ins);
  });

  // ---------- execução ----------
  function comandoNoCursor(texto, pos) {
    const cmds = dividir(texto);
    if (!cmds.length) return "";
    for (const c of cmds) if (pos <= c.fimRegiao) return c.texto;
    return cmds[cmds.length - 1].texto;
  }
  function executar(modo) {
    if (!sessao || destruido) return;
    const ed = eds[atual];
    if (!ed) return;
    const ta = ed.ta;
    let texto = modo === "tudo" ? ta.value
      : ta.selectionStart !== ta.selectionEnd ? ta.value.slice(ta.selectionStart, ta.selectionEnd)
      : comandoNoCursor(ta.value, ta.selectionStart);
    if (!temComando(texto)) { registrar({ info: true, ok: true, acao: "—", mensagem: "Nada para executar: escreva um comando SQL no editor." }); return; }
    const res = sessao.executarScript(texto, { limite: LIMITE_SESSAO });
    let ultimo = null;
    for (const r of res) { registrar(r); if (r.resultado) ultimo = r.resultado; }
    if (ultimo) mostrarResultado(ultimo);
    atualizarArvore();
  }
  function restaurar(registrarLog = true) {
    if (!sessao) return;
    sessao.criarDb();
    const res = sessao.executarScript(questao.banco?.setup || "", { limite: 0 });
    const falha = res.find(r => !r.ok);
    if (falha) registrar({ ok: false, acao: "Montar base " + nomeBanco, mensagem: "Erro no SQL de preparação da questão: " + falha.mensagem + " — avise o professor." });
    else if (registrarLog) registrar({ info: true, ok: true, acao: "Restaurar base", mensagem: `Banco '${nomeBanco}' recriado com os dados originais (${sessao.listarTabelas().length} tabela(s)).` });
    mostrarResultado(null);
    atualizarArvore();
  }

  botoes.tudo.addEventListener("click", () => executar("tudo"));
  botoes.atual.addEventListener("click", () => executar("atual"));
  botoes.limpar.addEventListener("click", () => { logBody.innerHTML = ""; nLog = 0; mostrarResultado(null); });
  botoes.restaurar.addEventListener("click", () => { restaurar(true); eds[atual]?.ta.focus(); });

  trocarAba(0);

  // ---------- motor ----------
  carregarMotor().then(SQL => {
    if (destruido) return;
    sessao = new Sessao(SQL, nomeBanco);
    restaurar(false);
    registrar({ info: true, ok: true, acao: "Conectar", mensagem: `Conectado. Banco '${nomeBanco}' pronto com ${sessao.listarTabelas().length} tabela(s). Safe updates ligado.` });
    Object.values(botoes).forEach(b => { b.disabled = false; });
  }).catch(e => {
    if (destruido) return;
    arvore.innerHTML = '<div class="bsql-vazio">Sem conexão com o motor SQL.</div>';
    registrar({ ok: false, acao: "Conectar", mensagem: e?.message || String(e) });
  });

  function avaliarComCache(t, sql) {
    const chave = t.id + "\u0000" + sql;
    if (!cache.has(chave)) {
      const p = avaliarTarefa(questao, t, sql);
      cache.set(chave, p);
      p.catch(() => cache.delete(chave));
      if (cache.size > 60) cache.delete(cache.keys().next().value);
    }
    return cache.get(chave);
  }

  return {
    async valor() {
      const out = { tarefas: {} };
      for (const ed of eds) {
        const sql = ed.ta.value;
        let r;
        try { r = await avaliarComCache(ed.tarefa, sql); }
        catch (e) { r = { impressao: "", conjunto: "", erro: "Não foi possível avaliar: " + (e?.message || e) }; }
        out.tarefas[ed.tarefa.id] = { sql, impressao: r.impressao, conjunto: r.conjunto, erro: r.erro };
      }
      return out;
    },
    destruir() {
      destruido = true;
      clearTimeout(timer);
      obs?.disconnect();
      sessao?.fechar();
      sessao = null;
      raiz.remove();
    }
  };
}

// usado só nos testes automatizados
export const _interno = { Sessao, dividir, tokenizar, normalizarValor, temComando };
