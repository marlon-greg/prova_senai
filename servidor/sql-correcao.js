// Correção das questões SQL (Bancada SQL). Sem imports: usado pelo navegador (js/common.js) e pelo servidor (Worker).
//
// A resposta do aluno = { tarefas: { t1: { sql, impressao, conjunto, erro }, ... } } (js/workbench.js valor()).
// O gabarito (bancos/{b}/gabaritos/{qid}) = { tarefas: { t1: { sql, ordemImporta, impressao, conjunto } } }, calculado
// na importação do banco rodando o SQL do professor na mesma Bancada.
// Tarefa com o MESMO resultado do gabarito = certa, sem gastar IA. Resultado diferente (ou erro) = "revisar":
// a IA do servidor (ou o professor) dá a nota parcial dessa tarefa. Cada tarefa vale peso ÷ nº de tarefas.

export function corrigirSql(questao, gabarito, resposta, peso = Number(questao?.peso || 1)) {
  const tarefas = Array.isArray(questao?.tarefas) ? questao.tarefas : [];
  const gt = gabarito?.tarefas || {};
  const r = resposta && typeof resposta === "object" ? (resposta.tarefas || {}) : {};
  if (!tarefas.length) return { pontos: 0, status: "revisar", porTarefa: {} };
  const porTarefa = {};
  let certas = 0, revisar = 0, brancas = 0;
  for (const t of tarefas) {
    const a = r[t.id] || {}, g = gt[t.id] || {};
    let st;
    if (!String(a.sql || "").trim()) { st = "em_branco"; brancas++; }
    else if (tarefaCerta(a, g)) { st = "certa"; certas++; }
    else { st = "revisar"; revisar++; }
    porTarefa[t.id] = st;
  }
  if (brancas === tarefas.length) return { pontos: 0, status: "em_branco", porTarefa };
  const pontos = Math.round(certas * (peso / tarefas.length) * 100) / 100;
  const status = revisar ? "revisar" : certas === tarefas.length ? "certa" : certas ? "parcial" : "errada";
  return { pontos, status, porTarefa };
}

// mesmo resultado do gabarito: com ORDER BY pedido compara a ordem; senão, só o conjunto de linhas.
// Não vale só o último comando: a.candidatos traz o resultado de CADA SELECT do editor e de cada comando que o aluno
// EXECUTOU sem erro na Bancada (ex.: rodou a consulta certa e depois um SELECT * só para conferir). Se algum bater, está certa.
// Com muitos resultados diferentes (chute em massa) não vale automático: vai para a IA/professor.
export const MAX_CANDIDATOS = 6;
export function tarefaCerta(a, g) { return !!comoAcertou(a, g); }
// "final" (o script do editor), "editor" (outro SELECT do editor), "executado" (comando executado) ou "" (não bateu)
export function comoAcertou(a, g) {
  if (!g || !(g.impressao || g.conjunto)) return "";
  const bate = x => g.ordemImporta ? !!x?.impressao && x.impressao === g.impressao : !!x?.conjunto && x.conjunto === g.conjunto;
  if (!a?.erro && bate(a)) return "final";
  const c = Array.isArray(a?.candidatos) ? a.candidatos : [];
  if (!c.length || c.length > MAX_CANDIDATOS) return "";
  return c.find(bate)?.de || "";
}

// texto para a IA corrigir as tarefas que não bateram com o gabarito
export function textoParaIA(questao, gabarito, resposta, peso) {
  const tarefas = questao.tarefas || [], gt = gabarito?.tarefas || {}, r = resposta?.tarefas || {};
  const valor = Math.round(peso / tarefas.length * 100) / 100;
  const limpa = s => String(s ?? "").replace(/<\/?sql_do_aluno/gi, "‹sql_do_aluno").slice(0, 4000);
  return `Questão prática de SQL (sintaxe MySQL). Cada tarefa vale ${valor} ponto(s).\n\n<enunciado>\n${questao.enunciado || ""}\n</enunciado>\n\n` +
    `<banco_inicial>\n${String(questao.banco?.setup || "").slice(0, 6000)}\n</banco_inicial>\n\n` +
    tarefas.map((t, i) => {
      const a = r[t.id] || {}, g = gt[t.id] || {};
      const muitos = (a.candidatos?.length || 0) > MAX_CANDIDATOS ? ` (o aluno executou/escreveu ${a.candidatos.length} consultas com resultados diferentes: confira se não foi chute)` : "";
      const st = !String(a.sql || "").trim() ? "EM BRANCO (vale 0)" : tarefaCerta(a, g) ? "RESULTADO IGUAL AO DO GABARITO (já vale a nota cheia)" : a.erro ? `DEU ERRO AO RODAR: ${a.erro}` : "RODOU, MAS O RESULTADO FICOU DIFERENTE DO GABARITO";
      const exec = (Array.isArray(a.execucoes) ? a.execucoes : []).filter(x => !x.erro && String(x.sql || "").trim()).slice(-8);
      const execTxt = exec.length ? `\nComandos que o aluno EXECUTOU sem erro na Bancada (também valem como resposta se algum resolver a tarefa):\n<sql_do_aluno>\n${exec.map(x => limpa(x.sql)).join("\n---\n")}\n</sql_do_aluno>` : "";
      return `### Tarefa ${t.id} (${i + 1})\n${t.texto}\nGabarito do professor:\n${g.sql || "(sem gabarito)"}\nSituação: ${st}${muitos}\n<sql_do_aluno>\n${limpa(a.sql)}\n</sql_do_aluno>${execTxt}`;
    }).join("\n\n");
}

// resposta da questão SQL em texto (telas de resultado, PDF, relatórios), com as tentativas que deram erro na Bancada
export function textoRespostaSql(questao, resposta) {
  const r = resposta?.tarefas || {};
  return (questao?.tarefas || []).map((t, i) => {
    const a = r[t.id] || {}, ex = Array.isArray(a.execucoes) ? a.execucoes : [], erros = ex.filter(x => x.erro);
    const hist = ex.length ? `\n▶ Executou ${ex.length} vez(es)${erros.length ? `, ${erros.length} com erro:` : ", sem erros."}` +
      erros.slice(-8).map(x => `\n   ✖ ${x.h || ""}  ${String(x.sql || "").replace(/\s+/g, " ").slice(0, 160)}\n      → ${x.erro}`).join("") : "";
    return `Tarefa ${i + 1}: ${t.texto}\n${String(a.sql || "").trim() || "(em branco)"}${a.erro ? `\n⚠ Na versão enviada: ${a.erro}` : ""}${hist}`;
  }).join("\n\n");
}
