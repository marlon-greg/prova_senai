// Confere os cenários SQL (tipo "sql") de um banco RODANDO o gabarito de cada tarefa no motor da Bancada (js/workbench.js),
// igual à importação no painel. Também confere o "banco de tarefas": 8 a 12 tarefas, tipos variados (cat).
// Uso: node bancos/validar-sql.mjs <arquivo.json> [--motor <pasta com sql-wasm.js e sql-wasm.wasm>] [--min-tarefas 8]
// O motor (sql.js) padrão fica em %TEMP%\chk\m (cópia local do sql-wasm.js/.wasm do CDN usado pela Bancada).
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : null; };
const arq = args[0];
const motor = opt("motor") || path.join(process.env.TEMP || process.env.TMP || ".", "chk", "m");
const minT = Number(opt("min-tarefas") || 8);
const require = createRequire(import.meta.url);
globalThis.initSqlJs = cfg => require(path.join(motor, "sql-wasm.js"))({ ...cfg, locateFile: f => path.join(motor, f) });
const W = await import(pathToFileURL(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..", "js", "workbench.js")).href);

const CATS = ["consulta", "dados", "estrutura", "permissao"];
const d = JSON.parse(fs.readFileSync(arq, "utf8"));
const erros = [], avisos = [];
let n = 0;
for (const [i, q] of (d.questoes || []).entries()) {
  if (q.tipo !== "sql") continue;
  n++;
  const nome = `#${i + 1} (${q.banco?.nome || "?"})`;
  const ts = q.tarefas || [];
  if (ts.length < minT) avisos.push(`${nome}: só ${ts.length} tarefas (banco de tarefas: 8 a 12)`);
  const porCat = {};
  for (const t of ts) {
    if (!CATS.includes(t.cat)) erros.push(`${nome} ${t.id}: "cat" deve ser ${CATS.join("/")}`);
    porCat[t.cat] = (porCat[t.cat] || 0) + 1;
    if (t.cat === "consulta" && t.tipo !== "consulta") erros.push(`${nome} ${t.id}: cat consulta precisa de "tipo": "consulta"`);
    if (t.cat !== "consulta" && (t.tipo !== "alteracao" || !t.verificacao)) erros.push(`${nome} ${t.id}: cat ${t.cat} precisa de "tipo": "alteracao" e "verificacao"`);
    if (t.cat === "estrutura" && !/^\s*describe\b/i.test(t.verificacao || "")) avisos.push(`${nome} ${t.id}: estrutura costuma conferir com DESCRIBE tabela;`);
    if (t.cat === "permissao" && !/^\s*show grants for\b/i.test(t.verificacao || "")) avisos.push(`${nome} ${t.id}: permissão costuma conferir com SHOW GRANTS FOR ...;`);
  }
  if (ts.length >= minT) for (const c of ["consulta", "dados", "estrutura"]) if ((porCat[c] || 0) < 2) avisos.push(`${nome}: só ${porCat[c] || 0} tarefa(s) de ${c} (o ideal é 2 ou mais)`);
  try { await W.calcularGabarito(q, q.gabarito); }
  catch (e) { erros.push(`${nome}: ${e.message}`); continue; }
  // alteração que não muda nada (o resultado "sem fazer nada" = gabarito) aceitaria resposta vazia/errada
  for (const t of ts.filter(t => t.tipo === "alteracao")) {
    const g = await W.avaliarTarefa(q, t, q.gabarito.tarefas[t.id].sql);
    const nada = await W.avaliarTarefa(q, t, "SELECT 1;");
    if (!nada.erro && nada.impressao === g.impressao) erros.push(`${nome} ${t.id}: o gabarito não muda nada que a verificação veja (a tarefa ficaria certa sem fazer nada)`);
  }
  console.log(`${nome}: ${ts.length} tarefas ${JSON.stringify(porCat)} ✔ gabarito roda`);
}
avisos.forEach(a => console.log("  aviso:", a));
erros.forEach(e => console.log("  ERRO:", e));
console.log(`${n} cenário(s) SQL · ${erros.length ? `✖ ${erros.length} erro(s)` : "✔ sem erros"}`);
process.exit(erros.length ? 1 : 0);
