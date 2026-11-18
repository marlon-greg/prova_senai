// Nota final da recuperação/substitutiva (usada no painel, nos relatórios e no portal do aluno).
// A prova sempre vale 0–100 para o aluno. Na recuperação, prova.valeAte[email] diz quanto vale para cada aluno
// e prova.regraNota[tipo] diz como converter (tipo = "recuperacao" ou "substitutiva", em prova.tipoPorAluno[email]):
//   teto: nota limitada ao valor (padrão) · proporcional: nota × valor ÷ 100 · meta: nota × valor ÷ meta, limitada ao valor
export const REGRAS_NOTA = { teto: "Teto (nota limitada ao valor)", proporcional: "Proporcional (nota × valor ÷ 100)", meta: "Proporcional com meta (atingiu a meta = valor)" };
export function regraDoTipo(prova, tipo) {
  const r = prova?.regraNota?.[tipo] || {};
  return { modo: REGRAS_NOTA[r.modo] ? r.modo : "teto", meta: Number(r.meta) > 0 ? Number(r.meta) : 70 };
}
export function calcNotaFinal(nota, vale, regra) {
  const n = Number(nota || 0), v = Number(vale);
  const f = regra.modo === "proporcional" ? n * v / 100 : regra.modo === "meta" ? Math.min(v, n * v / regra.meta) : Math.min(v, n);
  return Math.round(f * 10) / 10;
}
export const tipoDoAluno = (prova, email) => prova?.tipoPorAluno?.[String(email || "").toLowerCase()] === "substitutiva" ? "substitutiva" : "recuperacao";
export const valeAteDo = (prova, email) => { const v = Number(prova?.valeAte?.[String(email || "").toLowerCase()]); return v > 0 ? v : null; };
// nota que conta (relatórios e médias): a final na recuperação/substitutiva; a própria nota nas provas normais
export function notaQueConta(prova, email, nota) {
  if (nota === null || nota === undefined || !Number.isFinite(Number(nota))) return nota;
  const v = valeAteDo(prova, email);
  return v ? calcNotaFinal(nota, v, regraDoTipo(prova, tipoDoAluno(prova, email))) : Number(nota);
}
