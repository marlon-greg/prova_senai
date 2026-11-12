// PONTE com sistemas de FORA do Firebase (hoje: a AUTOAVALIAÇÃO do colega, no Supabase).
// Contrato e passo a passo: docs/CONTRATO-AUTOAVALIACAO.md. Decisões: docs/ECOSSISTEMA.md.
//
// Conversa servidor-com-servidor, sem login do Google: quem chama manda o cabeçalho  x-chave: <INTEGRACAO_CHAVE>
// (segredo criado no painel da Cloudflare; o mesmo valor fica guardado no Supabase). Nunca use a chave no navegador.
//
//   POST /integracao/autoavaliacao   recebe a autoavaliação e grava evidencias/autoavaliacao__{ref}__{email}
//        Aceita o WEBHOOK do Supabase sem código nenhum ({ type: "INSERT", table, record }) ou um POST próprio.
//        O registro pode ter as respostas todas (respostas: [{ criterio, nivel }]) ou UMA resposta por linha
//        (criterio + nivel): as linhas da mesma autoavaliação (mesmo ref) se juntam no mesmo documento.
//   GET  /integracao/situacao?unidade=bd&turma=1A[&email=…]
//        devolve, por aluno e por critério, o cruzamento das 3 vertentes (situacaoCriterio de js/evidencias.js):
//        é daí que a autoavaliação sabe quem está em "ilusão de saber", "dificuldade real" etc.
// Os critérios (perguntas) a autoavaliação importa direto de https://marlon-greg.github.io/prova_senai/js/plano-ensino.js.

import { montarEvidencia, situacaoCriterio, SITUACOES, NIVEIS_AUTO, chaveEmail } from "../js/evidencias.js";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CRITERIO = /^[a-z]+\.cr\d{2,}$/;

export async function integracao(req, env, url, fs) {
  const json = (dados, status = 200) => new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });
  try {
    if (!env.INTEGRACAO_CHAVE) return json({ erro: "Integração desligada: falta o segredo INTEGRACAO_CHAVE na Cloudflare." }, 503);
    if (!(await mesmaChave(req.headers.get("x-chave") || "", env.INTEGRACAO_CHAVE))) return json({ erro: "Chave de integração inválida." }, 401);
    const rota = url.pathname.replace(/\/+$/, "");
    if (rota === "/integracao/autoavaliacao" && req.method === "POST") return json(await receberAutoavaliacao(await fs(), await req.json().catch(() => null)));
    if (rota === "/integracao/situacao" && req.method === "GET") return json(await situacao(await fs(), url.searchParams));
    return json({ erro: "Rota desconhecida. Use POST /integracao/autoavaliacao ou GET /integracao/situacao." }, 404);
  } catch (e) {
    return json({ erro: e.message || String(e) }, e.status || 400);
  }
}

// compara sem vazar pelo tempo de resposta
async function mesmaChave(a, b) {
  const h = async s => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0 && a.length > 0;
}
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });

// ---------- nível: aceita o formato do contrato e os jeitos mais comuns de gravar ----------
export function nivelAuto(v) {
  if (v == null) return null;
  if (typeof v === "boolean") return v ? "sim" : "nao";
  if (typeof v === "number") return v >= 2 ? "sim" : v >= 1 ? "parcial" : "nao";            // 0/1/2 (ou 3 = sim)
  const s = String(v).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  if (NIVEIS_AUTO[s]) return s;
  if (/^\d+$/.test(s)) return nivelAuto(Number(s));
  if (/parte|parcial|mais ou menos|medio/.test(s)) return "parcial";
  if (/^(nao|ainda nao|nao consigo|no)/.test(s)) return "nao";
  if (/^(sim|consigo|yes|consigo fazer)/.test(s)) return "sim";
  return null;
}
const pega = (o, ...nomes) => { for (const n of nomes) if (o[n] != null && o[n] !== "") return o[n]; return null; };
const dia = v => { const s = String(v || ""); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date().toISOString().slice(0, 10); };
const periodoDe = d => `${d.slice(0, 4)}-${Number(d.slice(5, 7)) <= 6 ? 1 : 2}`;

// lê o registro (webhook do Supabase ou POST próprio) e devolve as respostas normalizadas
export function lerRegistro(corpo) {
  if (!corpo || typeof corpo !== "object") throw erro("Corpo vazio ou não é JSON.");
  if (corpo.type === "DELETE") return { ignorar: "DELETE não apaga evidência (o professor apaga no painel, se precisar)." };
  const r = corpo.record && typeof corpo.record === "object" ? corpo.record : corpo;
  const email = chaveEmail(pega(r, "email", "aluno_email", "email_aluno", "student_email"));
  if (!EMAIL.test(email)) throw erro("Registro sem e-mail do aluno (campo email).");
  let lista = pega(r, "respostas", "answers", "itens");
  if (typeof lista === "string") { try { lista = JSON.parse(lista); } catch { lista = null; } }
  if (!Array.isArray(lista)) {
    const c = pega(r, "criterio", "criterio_id", "criterion");
    lista = c ? [{ criterio: c, nivel: pega(r, "nivel", "resposta", "level", "answer", "valor") }] : [];
  }
  const criterios = {}, ignorados = [];
  for (const x of lista) {
    const id = String(pega(x, "criterio", "criterio_id", "criterion") || "").trim().toLowerCase();
    const nivel = nivelAuto(pega(x, "nivel", "resposta", "level", "answer", "valor"));
    if (!CRITERIO.test(id) || !nivel) { ignorados.push(x); continue; }
    criterios[id] = { valor: NIVEIS_AUTO[nivel].valor, nivel };
  }
  if (!Object.keys(criterios).length) throw erro("Nenhuma resposta válida: cada resposta precisa de criterio (ex.: bd.cr33) e nivel (sim, parcial ou nao).");
  const data = dia(pega(r, "data", "created_at", "enviada_em", "criado_em"));
  const ref = String(pega(r, "autoavaliacao_id", "avaliacao_id", "formulario_id", "sessao_id") || (Array.isArray(pega(r, "respostas", "answers", "itens")) ? pega(r, "id") : null) || data).replace(/[^\w.-]/g, "_").slice(0, 80);
  return {
    email, ref, data, criterios, ignorados: ignorados.length,
    unidade: String(pega(r, "unidade", "uc") || Object.keys(criterios)[0].split(".")[0]).toLowerCase(),
    turma: String(pega(r, "turma") || "").toUpperCase().match(/\d[A-Z]/)?.[0] || "",
    titulo: String(pega(r, "titulo", "title", "tema") || "Autoavaliação").slice(0, 120),
    aulaId: pega(r, "aula_id", "aulaId"), atividadeId: pega(r, "atividade_id", "atividadeId")
  };
}

// turma do aluno pelo e-mail (turmas/ do sistema de provas); cache curto por instância
let cacheTurmas = null, cacheAte = 0;
async function turmaDoAluno(fs, email) {
  if (!cacheTurmas || Date.now() > cacheAte) { cacheTurmas = await fs.listar("turmas"); cacheAte = Date.now() + 5 * 60 * 1000; }
  for (const [id, t] of Object.entries(cacheTurmas)) {
    const emails = [...(t.emails || []), ...(t.alunos || []).map(a => a.email), ...Object.values(t.vinculos || {})].map(chaveEmail);
    if (emails.includes(email)) return { turmaId: id, turma: (String(t.nome || t.codigo || id).toUpperCase().match(/(^|[^0-9A-Z])(\d[A-Z])(?=[^0-9A-Z]|$)/) || [])[2] || "" };
  }
  return null;
}

async function receberAutoavaliacao(fs, corpo) {
  const r = lerRegistro(corpo);
  if (r.ignorar) return { ok: true, ignorado: r.ignorar };
  const t = await turmaDoAluno(fs, r.email);
  if (!t) throw erro(`O e-mail ${r.email} não está em nenhuma turma do sistema de provas. Confira se é o e-mail institucional.`, 422);
  const turma = r.turma || t.turma;
  if (!turma) throw erro("Não deu para saber o código da turma (1A, 1B…): mande o campo turma.", 422);
  const { id, dados } = montarEvidencia({ fonte: "autoavaliacao", ref: r.ref, email: r.email, turma, turmaId: t.turmaId, unidade: r.unidade,
    periodo: periodoDe(r.data), data: r.data, titulo: r.titulo, criterios: r.criterios, gravadoPor: "autoavaliacao" });
  dados.origem = "supabase";
  if (r.aulaId) dados.aulaId = String(r.aulaId);
  if (r.atividadeId) dados.atividadeId = String(r.atividadeId);
  // mescla: cada critério é um campo próprio, então respostas que chegam juntas (uma linha por resposta) não se apagam
  const campos = Object.keys(dados).filter(k => k !== "criterios").concat(Object.keys(dados.criterios).map(c => "criterios.`" + c + "`"));
  await fs.mesclar(`evidencias/${id}`, dados, campos, "em");
  return { ok: true, id, criterios: Object.keys(r.criterios).length, ignorados: r.ignorados };
}

async function situacao(fs, q) {
  const unidade = String(q.get("unidade") || "").toLowerCase(), turma = String(q.get("turma") || "").toUpperCase(), so = chaveEmail(q.get("email"));
  if (!/^[a-z]+$/.test(unidade) || !/^\d[A-Z]$/.test(turma)) throw erro("Informe unidade (ex.: bd) e turma (ex.: 1A).");
  const evs = (await fs.consultar("evidencias", "turma", turma)).filter(e => e.unidade === unidade && (!so || e.email === so));
  const porAluno = {};
  for (const e of evs) (porAluno[e.email] ||= []).push(e);
  const alunos = Object.entries(porAluno).map(([email, lista]) => {
    const ids = [...new Set(lista.flatMap(e => Object.keys(e.criterios || {})))].sort();
    const criterios = {};
    for (const c of ids) { const s = situacaoCriterio(lista, c); criterios[c] = { ...s, nome: SITUACOES[s.situacao].nome, acao: SITUACOES[s.situacao].acao }; }
    return { email, criterios };
  });
  return { unidade, turma, geradoEm: new Date().toISOString(), alunos };
}
