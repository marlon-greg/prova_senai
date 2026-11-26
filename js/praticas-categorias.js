// Categorias das questões práticas, para a Nova somativa escolher "quantos de cada" e o sorteio respeitar.
// Sem DOM e sem Firebase: usado pelo painel (js/admin.js) e pelo sorteio (js/common.js).
//
// SQL físico: DDL, DML, DCL (pelo tema da questão e pelo texto das tarefas); cenário com mais de uma = "misto".
// Página web: subtópicos de HTML e CSS do plano de curso (Linguagem de Marcação, conhecimentos marc.k4.* e marc.k5.*);
//   cada projeto "cobre" os subtópicos cujas tags/propriedades aparecem no conteúdo dele.
import { unidadePorId, nivelK } from "./plano-curso.js?v=20261113a";

export const CATEGORIAS_SQL = {
  DDL: { nome: "DDL", resumo: "Definição da estrutura: CREATE, ALTER, DROP (banco, tabelas, chaves, índices)" },
  DML: { nome: "DML", resumo: "Manipulação dos dados: SELECT, INSERT, UPDATE, DELETE (consultas, JOIN, GROUP BY)" },
  DCL: { nome: "DCL", resumo: "Controle de acesso: GRANT, REVOKE (usuários e permissões)" },
  misto: { nome: "Cenário completo", resumo: "Várias tarefas no mesmo cenário, misturando DDL e DML" }
};
const sem = s => String(s || "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
const catDeTexto = t => {
  t = sem(t);
  if (/\b(grant|revoke|dcl)\b|permiss|privilegi|create user|drop user/.test(t)) return "DCL";
  if (/\b(ddl|create table|create database|alter table|drop table|drop database|create index|truncate)\b|crie a tabela|crie o banco|adicione (a|uma) coluna|acrescente (a|uma) coluna|altere a estrutura|apague a tabela/.test(t)) return "DDL";
  return "DML";
};
export function categoriaSql(q) {
  const tema = sem(q?.tema);
  if (/^dcl\b/.test(tema)) return "DCL";
  if (/^ddl\b/.test(tema)) return "DDL";
  if (/^dml\b|consulta|join|agrupamento|group by|select/.test(tema)) return "DML";
  const cats = new Set((q?.tarefas || []).map(t => catDeTexto(t.texto)));
  return cats.size > 1 ? "misto" : [...cats][0] || "DML";
}

// subtópicos (nível 2) de HTML (marc.k4) e CSS (marc.k5), com os itens de nível 3 como dica
const PISTAS_WEB = {
  "marc.k4.3": /<(html|head|title|body|meta)\b/i, "marc.k4.4": /<(header|nav|main|section|article|footer|aside)\b/i,
  "marc.k4.5": /<(p|h[1-6]|br|strong|em|b|i|sub|sup)\b/i, "marc.k4.6": /<img\b|background-image/i, "marc.k4.7": /#[0-9a-f]{3,6}\b|rgba?\(/i,
  "marc.k4.8": /<a\s/i, "marc.k4.9": /<(ul|ol|dl|li)\b/i, "marc.k4.10": /<table\b/i, "marc.k4.11": /<(form|input|select|textarea|button)\b/i,
  "marc.k5.4": /(^|[}\s])[.#][a-z][\w-]*\s*\{/im, "marc.k5.5": /font-|color\s*:|text-(align|decoration|transform)|line-height/i,
  "marc.k5.6": /submenu|dropdown|menu/i, "marc.k5.7": /\b(margin|padding|border)\s*:/i, "marc.k5.8": /\b(position|float|z-index|display)\s*:/i,
  "marc.k5.9": /:(hover|focus|active|nth-|first-child|last-child)/i, "marc.k5.10": /\b(transition|animation|transform|gradient|opacity|border-radius)\b/i,
  "marc.k5.11": /<svg\b|\.(png|jpe?g|webp|svg)\b/i
};
export function subtopicosWeb() {
  const u = unidadePorId("marc"); if (!u) return { HTML: [], CSS: [] };
  const filhos = id => u.con.filter(([c]) => c.startsWith(id + ".") && nivelK(c) === nivelK(id) + 1).map(([, t]) => t);
  const lista = pai => u.con.filter(([id]) => id.startsWith(pai + ".") && nivelK(id) === 2).map(([id, nome]) => ({ id, nome, itens: filhos(id), automatico: !!PISTAS_WEB[id] }));
  return { HTML: lista("marc.k4"), CSS: lista("marc.k5") };
}
// subtópicos que o projeto web cobre (pelo conteúdo público da questão: etapas, modelos, comandos)
export function coberturaWeb(q) {
  const txt = JSON.stringify(q || {}).replace(/\\n/g, "\n").replace(/\\"/g, '"');
  return new Set(Object.entries(PISTAS_WEB).filter(([, re]) => re.test(txt)).map(([id]) => id));
}

// só os subtópicos que dá para conferir no conteúdo do projeto (os teóricos, como "Definição", não filtram)
export const subtopicosConferiveis = ids => (ids || []).filter(id => PISTAS_WEB[id]);
export const MODELOS_WEB = { blocos: "Encaixar blocos (comandos prontos)", completar: "Completar digitando", livre: "Projeto livre (pastas e arquivos)" };
export const modeloWeb = q => MODELOS_WEB[q?.modo] ? q.modo : "blocos";
