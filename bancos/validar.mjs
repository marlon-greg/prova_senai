// Confere um banco de questões contra docs/PADRAO-QUESTOES.md.
// Uso: node bancos/validar.mjs <arquivo.json> [--tema "Nome do tema"] [--min 150] [--contra outro1.json,outro2.json]
// Sai com código 1 se houver erro. Avisos não bloqueiam.
import fs from "fs";

const args = process.argv.slice(2);
const arq = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true) || args[0];
const opt = k => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : null; };
const temaEsperado = opt("tema"), minimo = Number(opt("min") || 0);
const contra = (opt("contra") || "").split(",").filter(Boolean);

const erros = [], avisos = [];
const d = JSON.parse(fs.readFileSync(arq, "utf8"));
if (!d.nome || !d.materia || !Array.isArray(d.questoes)) erros.push("o arquivo precisa de nome, materia e questoes[]");
const qs = d.questoes || [];
const norm = t => String(t || "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/`[^`]*`/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const palavras = t => new Set(norm(t).split(" ").filter(p => p.length > 3));
const parecido = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; a.forEach(x => b.has(x) && n++); return n / Math.max(a.size, b.size); };
const PROIBIDO = /\b(escreva|escrever|crie|criar|monte|montar|desenhe|desenhar|elabore|construa|fa[cç]a o (comando|c[oó]digo|diagrama|select|script)|digite|reescreva o c[oó]digo|implemente|codifique)\b/i;
const CMD_PEDIDO = /\b(o|um|uma|os) (comando|c[oó]digo|script|select|insert|update|delete|create|diagrama|der|mer|tabela)\b[^.?!]*\b(que|para)\b/i;

const porDif = {}, porCorreta = [0, 0, 0, 0], porTipo = {};
qs.forEach((q, i) => {
  const n = `#${i + 1}`;
  porTipo[q.tipo] = (porTipo[q.tipo] || 0) + 1;
  if (!["alternativa", "dissertativa", "sql", "web", "diagrama"].includes(q.tipo)) erros.push(`${n}: tipo inválido`);
  if (!q.tema) erros.push(`${n}: sem tema`);
  if (temaEsperado && q.tema !== temaEsperado) erros.push(`${n}: tema "${q.tema}" ≠ "${temaEsperado}"`);
  if (!q.capacidade) avisos.push(`${n}: sem capacidade`);
  if (!["facil", "media", "dificil"].includes(q.dificuldade)) erros.push(`${n}: dificuldade deve ser facil/media/dificil`);
  else porDif[q.dificuldade] = (porDif[q.dificuldade] || 0) + 1;
  if (!String(q.enunciado || "").trim()) erros.push(`${n}: sem enunciado`);
  if (q.tipo === "alternativa") {
    if (!Array.isArray(q.alternativas) || q.alternativas.length !== 4) erros.push(`${n}: precisa de 4 alternativas`);
    else {
      if (new Set(q.alternativas.map(a => String(a).trim().toLowerCase().replace(/\s+/g, " "))).size !== 4) erros.push(`${n}: alternativas repetidas`);
      if (q.alternativas.some(a => /todas as anteriores|nenhuma das anteriores/i.test(a))) erros.push(`${n}: "todas/nenhuma das anteriores"`);
    }
    if (!Number.isInteger(q.correta) || q.correta < 0 || q.correta > 3) erros.push(`${n}: correta deve ser 0..3`); else porCorreta[q.correta]++;
    if (!q.explicacao) avisos.push(`${n}: sem explicação`);
  }
  if (q.tipo === "dissertativa") {
    const e = String(q.enunciado || "");
    const pergunta = e.split(/\n\s*Na sua resposta/i)[0];
    if (PROIBIDO.test(pergunta) || CMD_PEDIDO.test(pergunta) && /\b(escrev\w*|cri[ae]\w*|mont[ae]\w*)\b/i.test(pergunta)) erros.push(`${n}: dissertativa pedindo comando/código/desenho: "${pergunta.slice(0, 90)}…"`);
    if (!/\n\s*Na sua resposta:?\s*\n\s*1\. /i.test(e)) erros.push(`${n}: dissertativa sem a lista "Na sua resposta:\\n1. …"`);
    if (!Array.isArray(q.respostasAceitas) || !String(q.respostasAceitas[0] || "").trim()) erros.push(`${n}: sem resposta-modelo (respostasAceitas[0])`);
    if (Array.isArray(q.palavrasChave) && q.palavrasChave.length) avisos.push(`${n}: palavrasChave deveria ficar vazio`);
  }
  if (q.tipo === "sql") {
    if (!q.banco?.setup || !Array.isArray(q.tarefas) || !q.tarefas.length) erros.push(`${n}: sql sem banco.setup ou tarefas`);
    for (const t of q.tarefas || []) {
      if (!t.id || !t.texto) erros.push(`${n}: tarefa sem id/texto`);
      if (!q.gabarito?.tarefas?.[t.id]?.sql) erros.push(`${n}: falta gabarito da tarefa ${t.id}`);
      if (t.cat && !["consulta", "dados", "estrutura", "permissao"].includes(t.cat)) erros.push(`${n}: cat inválido em ${t.id}`);
      if (t.tipo === "alteracao" && !t.verificacao) avisos.push(`${n}: tarefa ${t.id} de alteração sem verificacao`);
    }
  }
});
// repetidas dentro do arquivo e contra outros
const ps = qs.map(q => palavras(q.enunciado + " " + (q.alternativas || []).join(" ")));
for (let i = 0; i < qs.length; i++) for (let j = i + 1; j < qs.length; j++) {
  if (qs[i].tipo === "sql" || qs[j].tipo === "sql") continue;
  if (norm(qs[i].enunciado) === norm(qs[j].enunciado)) erros.push(`#${i + 1} e #${j + 1}: enunciado igual`);
  else if (parecido(ps[i], ps[j]) > 0.8 && !(qs[i].grupo && qs[i].grupo === qs[j].grupo)) avisos.push(`#${i + 1} e #${j + 1}: muito parecidas (use "grupo" igual se for de propósito)`);
}
for (const f of contra) {
  const o = JSON.parse(fs.readFileSync(f, "utf8")).questoes || [];
  const po = o.map(q => palavras(q.enunciado + " " + (q.alternativas || []).join(" ")));
  qs.forEach((q, i) => po.forEach((p, j) => { if (norm(q.enunciado) === norm(o[j].enunciado) || parecido(ps[i], p) > 0.85) avisos.push(`#${i + 1} parece repetir a questão ${j + 1} de ${f}`); }));
}
const nAlt = porTipo.alternativa || 0;
if (nAlt >= 8) porCorreta.forEach((c, k) => { if (c < nAlt * 0.15) avisos.push(`correta=${k} aparece só ${c} vezes em ${nAlt} alternativas (varie a posição)`); });
const tot = qs.length;
if (tot >= 20) { const f = (porDif.dificil || 0) / tot; if (f < 0.12 || f > 0.3) avisos.push(`difíceis = ${Math.round(f * 100)}% (o padrão é ~20%)`); }
if (minimo && tot < minimo) erros.push(`só ${tot} questões (mínimo ${minimo})`);

console.log(`${arq}: ${tot} questões ${JSON.stringify(porTipo)} · dificuldade ${JSON.stringify(porDif)} · correta ${JSON.stringify(porCorreta)}`);
avisos.slice(0, 40).forEach(a => console.log("  aviso:", a)); if (avisos.length > 40) console.log(`  … mais ${avisos.length - 40} avisos`);
erros.slice(0, 60).forEach(e => console.log("  ERRO:", e)); if (erros.length > 60) console.log(`  … mais ${erros.length - 60} erros`);
console.log(erros.length ? `✖ ${erros.length} erro(s)` : "✔ sem erros");
process.exit(erros.length ? 1 : 0);
