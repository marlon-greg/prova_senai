// Tema (assunto) do banco → capacidades técnicas do plano de curso ("bd.ct9"…).
// Guardado no banco: bancos/{id}.capacidadesPorTema = { "DDL — CREATE TABLE": ["bd.ct9"], ... }
// A Nova somativa mostra só os temas ligados às capacidades marcadas; tema sem ligação aparece como "sem capacidade definida".
// proporCapacidades sugere a ligação sem IA: palavras-chave do assunto + palavras em comum com o texto da capacidade.

const sem = s => String(s || "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
const PARADAS = new Set("de da do das dos e em para com por a o as os um uma na no nas nos ao aos utilizar aplicar identificar elaborar realizar desenvolver acordo conforme sistema sistemas dados base meio".split(" "));
const palavras = s => sem(s).split(/[^a-z0-9]+/).filter(p => p.length >= 3 && !PARADAS.has(p)).map(p => p.slice(0, 6));

// assunto → trechos que aparecem no texto da capacidade (vale para qualquer matéria)
const PISTAS = [
  [/\b(select|consulta|join|where|order by|group by|having|insert|update|delete|dml|subconsulta)\b/, ["manipulacao", "dml"]],
  [/\b(create|alter|drop|ddl|table|tabela|index|indice|constraint|restricao|chave primaria|foreign)\b/, ["linguagem de definicao", "(ddl)"]],
  [/\b(grant|revoke|dcl|usuario|permiss|privilegio)/, ["permiss", "usuario"]],
  [/\b(backup|dump|mysqldump|import|export|restaur)/, ["importacao", "exportacao"]],
  [/\b(mer|der|conceitual|logico|entidade|relacionamento|modelagem|brmodelo|cardinalidade|diagrama)/, ["diagrama", "modelagem", "relacionamento"]],
  [/\b(normaliza|forma normal|1fn|2fn|3fn)/, ["normaliz"]],
  [/\b(count|sum|avg|max|min|funcao|funcoes|agregacao|agrupamento)\b/, ["funcoes nativas", "manipulacao"]],
  [/\b(procedure|trigger|gatilho|evento|function)\b/, ["procedures", "triggers"]],
  [/\b(dicionario)/, ["dicionario"]],
  [/\b(tipo de dado|tipos de dados|varchar|int|date)\b/, ["tipos de dados"]],
  [/\b(caso de uso|casos de uso|requisito|rf|rnf|regra de negocio|rastreab|versao|mudanca)/, ["registrar requisitos"]],
  [/\b(atividade|processo|fluxo|necessidade)/, ["levantamento das necessidades"]],
  [/\b(scrum|kanban|agil|sprint|backlog|historia)/, ["ageis", "agil"]],
  [/\b(design thinking|empatia|persona|prototip)/, ["design thinking"]],
  [/\b(entrevista|briefing|brainstorm|etnografia|levantamento)/, ["levantamento", "tecnicas"]],
  [/\b(html|css|flex|grid|tag|semantic)/, ["marcacao", "estilo", "html", "css"]],
  [/\b(decisao|condicional|if|else|switch)\b/, ["decisao", "condic"]],
  [/\b(repeticao|laco|loop|for|while)\b/, ["repeticao"]],
  [/\b(variave|operador|aritmetic|logic)/, ["variave", "operador"]],
  [/\b(fluxograma)/, ["fluxograma"]]
];

// u = unidade do plano de curso (plano-curso.js). Devolve ids das capacidades técnicas sugeridas (pode ser vazio)
export function proporCapacidades(tema, u) {
  if (!u) return [];
  const t = sem(tema), out = new Set();
  for (const [re, trechos] of PISTAS) if (re.test(t)) for (const [id, txt] of u.tec) if (trechos.some(x => sem(txt).includes(x))) out.add(id);
  if (!out.size) {   // sem pista: a capacidade com mais palavras em comum (pelo menos 2)
    const pt = new Set(palavras(tema));
    let melhor = null, nota = 1;
    for (const [id, txt] of u.tec) { const n = palavras(txt).filter(p => pt.has(p)).length; if (n > nota) { nota = n; melhor = id; } }
    if (melhor) out.add(melhor);
  }
  return [...out];
}

// ligação gravada (null = nunca revisada)
export const capsDoTema = (banco, tema) => Array.isArray(banco?.capacidadesPorTema?.[tema]) ? banco.capacidadesPorTema[tema] : null;
