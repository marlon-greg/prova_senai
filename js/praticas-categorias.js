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

// ---------- TAREFAS POR PERGUNTA (SQL) ----------
// Cada cenário SQL (base + várias tarefas) é um "banco de tarefas". Na Nova somativa o professor monta cada pergunta:
// quantas tarefas ela tem e de que tipo é cada uma (prova.sqlPerguntas = [{ tarefas: ["consulta", "estrutura", "qualquer"] }, …]).
// O sorteio escolhe um cenário que tenha tarefas suficientes de cada tipo e sorteia as tarefas dentro dele.
// As tarefas são independentes: cada uma é corrigida a partir da base original do cenário.
export const TIPOS_TAREFA = {
  consulta: { curto: "Consulta (SELECT)", nome: "Consulta", cmd: "SELECT", sigla: "DML", desc: "SELECT, WHERE, ORDER BY, JOIN, GROUP BY" },
  dados: { curto: "Dados (INSERT, UPDATE, DELETE)", nome: "Inserir, alterar ou apagar dados", cmd: "INSERT, UPDATE, DELETE", sigla: "DML", desc: "INSERT, UPDATE, DELETE" },
  estrutura: { curto: "Tabela (CREATE, ALTER)", nome: "Criar ou alterar tabela", cmd: "CREATE, ALTER, DROP", sigla: "DDL", desc: "CREATE TABLE, ALTER TABLE, chaves, índices" },
  permissao: { curto: "Permissões (GRANT, REVOKE)", nome: "Usuários e permissões", cmd: "GRANT, REVOKE", sigla: "DCL", desc: "CREATE USER, GRANT, REVOKE" }
};
export const QUALQUER_TAREFA = "qualquer";
// tipo da tarefa: campo "cat" (se o banco já diz) ou pelo jeito da tarefa (consulta/alteração, verificação e texto)
export function tipoTarefa(t) {
  if (TIPOS_TAREFA[t?.cat]) return t.cat;
  if (t?.tipo !== "alteracao") return "consulta";
  const v = sem(t.verificacao), txt = sem(t.texto);
  if (/^\s*show grants\b|mysql\.user/.test(v) || /\b(grant|revoke|create user|drop user)\b|permiss|privilegi/.test(txt)) return "permissao";
  if (/^\s*(describe|desc|show (full )?columns|show create|show index|show tables)\b|information_schema/.test(v)) return "estrutura";
  if (catDeTexto(t.texto) === "DDL") return "estrutura";
  return "dados";
}
// quantas tarefas de cada tipo o cenário tem: { consulta: 4, dados: 3, … }
export function tarefasPorTipo(q) {
  const c = {};
  for (const t of q?.tarefas || []) { const k = tipoTarefa(t); c[k] = (c[k] || 0) + 1; }
  return c;
}
// lista de pedidos de uma pergunta → { consulta: 1, qualquer: 2 }
const contarPedido = pedido => (pedido || []).reduce((o, k) => (o[TIPOS_TAREFA[k] ? k : QUALQUER_TAREFA] = (o[TIPOS_TAREFA[k] ? k : QUALQUER_TAREFA] || 0) + 1, o), {});
// o cenário consegue atender a pergunta? (tipos pedidos e o total)
export function cenarioAtende(q, pedido) {
  const tem = tarefasPorTipo(q), quer = contarPedido(pedido);
  const total = (q?.tarefas || []).length;
  for (const [k, n] of Object.entries(quer)) if (k !== QUALQUER_TAREFA && (tem[k] || 0) < n) return false;
  return total >= (pedido || []).length;
}
// sorteia as tarefas do cenário para a pergunta (ids na ordem do pedido); null se não der.
// rnd: função () => [0,1) (Math.random por padrão)
export function escolherTarefas(q, pedido, rnd = Math.random) {
  if (!cenarioAtende(q, pedido)) return null;
  const embaralha = l => { const a = [...l]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const livres = embaralha(q.tarefas || []), usados = new Set(), sai = [];
  // primeiro os tipos definidos, depois "qualquer" (preferindo um tipo que ainda não saiu, para variar)
  const ordem = (pedido || []).map((k, i) => ({ k: TIPOS_TAREFA[k] ? k : QUALQUER_TAREFA, i })).sort((a, b) => (a.k === QUALQUER_TAREFA) - (b.k === QUALQUER_TAREFA));
  const porPos = [];
  for (const { k, i } of ordem) {
    const jaSaiu = new Set(sai.map(t => tipoTarefa(t)));
    const cand = livres.filter(t => !usados.has(t.id) && (k === QUALQUER_TAREFA || tipoTarefa(t) === k));
    const t = k === QUALQUER_TAREFA ? (cand.find(x => !jaSaiu.has(tipoTarefa(x))) || cand[0]) : cand[0];
    if (!t) return null;
    usados.add(t.id); sai.push(t); porPos[i] = t.id;
  }
  // a ordem final segue a ordem das tarefas no cenário (fica mais natural de ler)
  const pos = Object.fromEntries((q.tarefas || []).map((t, i) => [t.id, i]));
  return porPos.filter(Boolean).sort((a, b) => pos[a] - pos[b]);
}
// texto curto do pedido de uma pergunta: "3 tarefas: consulta, criar tabela, qualquer"
export function textoPedido(pedido) {
  const n = (pedido || []).length;
  const nomes = (pedido || []).map(k => TIPOS_TAREFA[k] ? TIPOS_TAREFA[k].curto : "qualquer tipo");
  return `${n} tarefa${n === 1 ? "" : "s"}${n ? ` (${nomes.join(" · ")})` : ""}`;
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

// "O que a página precisa cobrar": etiquetas (só assuntos que dá para conferir na página) → subtópicos do plano
const PISTA_FLEXGRID = /display\s*:\s*(inline-)?(flex|grid)|grid-template|flex-(direction|wrap)|justify-content|align-items/i;
export const TAGS_WEB = {
  HTML: [
    { k: "estrutura", nome: "Estrutura da página", ids: ["marc.k4.3", "marc.k4.4"] },
    { k: "textos", nome: "Textos e listas", ids: ["marc.k4.5", "marc.k4.9"] },
    { k: "imagens", nome: "Imagens e links", ids: ["marc.k4.6", "marc.k4.8"] },
    { k: "cores", nome: "Cores (hexadecimal, RGB)", ids: ["marc.k4.7"] },
    { k: "tabelas", nome: "Tabelas", ids: ["marc.k4.10"] },
    { k: "formularios", nome: "Formulários", ids: ["marc.k4.11"] }
  ],
  CSS: [
    { k: "seletores", nome: "Seletores", ids: ["marc.k5.4"] },
    { k: "formatacao", nome: "Formatação de elementos", ids: ["marc.k5.5"] },
    { k: "menus", nome: "Menus e submenus", ids: ["marc.k5.6"] },
    { k: "box", nome: "Box model", ids: ["marc.k5.7"] },
    { k: "posicionamento", nome: "Posicionamento", ids: ["marc.k5.8"] },
    { k: "pseudo", nome: "Pseudo classes", ids: ["marc.k5.9"] },
    { k: "efeitos", nome: "Efeitos", ids: ["marc.k5.10"] },
    { k: "flexgrid", nome: "Flexbox e Grid", ids: [], re: PISTA_FLEXGRID },
    { k: "svg", nome: "Imagens e SVG", ids: ["marc.k5.11"] }
  ]
};
const TAG_POR_K = Object.fromEntries([...TAGS_WEB.HTML, ...TAGS_WEB.CSS].map(t => [t.k, t]));
// a página tem TODAS as etiquetas marcadas? (cada etiqueta vale se qualquer subtópico dela aparece)
export function cobreTags(q, tags) {
  if (!tags?.length) return true;
  const c = coberturaWeb(q), txt = JSON.stringify(q || {});
  return tags.every(k => { const t = TAG_POR_K[k]; return !t || t.ids.some(id => c.has(id)) || (t.re && t.re.test(txt)); });
}
export const nTagsCobertas = (q, tags) => (tags || []).filter(k => cobreTags(q, [k])).length;
