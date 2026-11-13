// PONTE com a AUTOAVALIAÇÃO (Stacktrace do colega) — integração por BUSCA (pull).
// O Worker chama a API do Stacktrace a cada 15 min (cron) e quando o professor abre a comparação.
// Os critérios casam por número: BD / TECNICA / * / 25 → bd.cr25.
// Contrato e issues: docs/CONTRATO-AUTOAVALIACAO.md. Decisões: docs/ECOSSISTEMA.md.
//
// Variáveis no Cloudflare (além das da correção):
//   STACKTRACE_URL   (texto)   URL base da API do Stacktrace, ex.: https://api.stacktrace.example.com
//   INTEGRACAO_CHAVE (segredo) chave compartilhada com o Stacktrace (mesmo valor nos dois sistemas)
//
// HTTP (servidor com servidor, cabeçalho x-chave = INTEGRACAO_CHAVE):
//   GET  /integracao/situacao?unidade=bd&turma=1A[&email=…]
//        devolve, por aluno e por critério, o cruzamento das 3 vertentes
//   POST /integracao/buscar
//        força uma busca imediata no Stacktrace (mesma coisa que o cron faz de 15 em 15 min)
//
// Acesso autenticado por Firebase (professor/admin, sem x-chave):
//   acao "buscarAutoavaliacao" no endpoint principal do Worker (corretor-worker.js)

import { montarEvidencia, situacaoCriterio, SITUACOES, NIVEIS_AUTO, chaveEmail } from "../js/evidencias.js";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CRITERIO = /^[a-z]+\.cr\d{2,}$/;
const CURSOR_DOC = "config/integracao-stacktrace";

export async function integracao(req, env, url, getFs) {
  const json = (dados, status = 200) => new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });
  try {
    if (!env.INTEGRACAO_CHAVE) return json({ erro: "Integração desligada: falta o segredo INTEGRACAO_CHAVE na Cloudflare." }, 503);
    if (!(await mesmaChave(req.headers.get("x-chave") || "", env.INTEGRACAO_CHAVE))) return json({ erro: "Chave de integração inválida." }, 401);
    const rota = url.pathname.replace(/\/+$/, "");
    if (rota === "/integracao/situacao" && req.method === "GET") return json(await situacao(await getFs(), url.searchParams));
    if (rota === "/integracao/buscar" && req.method === "POST") return json(await buscarEGravar(env, await getFs()));
    return json({ erro: "Rota desconhecida. Use GET /integracao/situacao ou POST /integracao/buscar." }, 404);
  } catch (e) {
    return json({ erro: e.message || String(e) }, e.status || 400);
  }
}

// chamado pelo cron (scheduled), por POST /integracao/buscar e pela ação "buscarAutoavaliacao" (Firebase auth)
export async function buscarEGravar(env, fs) {
  if (!env.STACKTRACE_URL) throw erro("STACKTRACE_URL não configurado na Cloudflare.", 503);
  const cursor = (await fs.ler(CURSOR_DOC)) || {};
  const [respostas, pendencias] = await Promise.all([
    buscarPaginas(env, "/integracao/respostas", cursor.respostas || {}),
    buscarPaginas(env, "/integracao/pendencias", cursor.pendencias || {})
  ]);
  const stats = { respostas: 0, pendencias: 0, erros: [] };
  if (respostas.itens.length) {
    const r = await processarRespostas(respostas.itens, fs);
    stats.respostas = r.gravadas;
    if (r.erros.length) stats.erros.push(...r.erros.slice(0, 10));
  }
  if (pendencias.itens.length) {
    const r = await processarPendencias(pendencias.itens, fs);
    stats.pendencias = r.atualizadas;
    if (r.erros.length) stats.erros.push(...r.erros.slice(0, 10));
  }
  // salva o novo cursor (ou mantém o anterior se não houve progresso)
  const novoCursor = {
    ...(respostas.proximo  ? { respostas:  respostas.proximo  } : cursor.respostas  ? { respostas:  cursor.respostas  } : {}),
    ...(pendencias.proximo ? { pendencias: pendencias.proximo } : cursor.pendencias ? { pendencias: cursor.pendencias } : {})
  };
  if (Object.keys(novoCursor).length) await fs.gravar(CURSOR_DOC, novoCursor);
  return { ok: true, buscadoEm: new Date().toISOString(), ...stats };
}

// ---------- busca paginada na API do Stacktrace ----------
async function buscarPaginas(env, rota, cursorInicial, limite = 500) {
  const base = String(env.STACKTRACE_URL).replace(/\/$/, "");
  let cursor = { ...cursorInicial }, itens = [];
  for (let pagina = 0; pagina < 20; pagina++) {   // 20 páginas × 500 = 10 000 itens por cron
    const qs = new URLSearchParams({ limite: String(limite) });
    if (cursor.desde) qs.set("desde", cursor.desde);
    if (cursor.depoisDe) qs.set("depoisDe", cursor.depoisDe);
    let r;
    try {
      r = await fetch(`${base}${rota}?${qs}`, { headers: { "x-chave": env.INTEGRACAO_CHAVE } });
    } catch (e) {
      console.log("Stacktrace indisponível:", rota, e.message);
      break;
    }
    if (!r.ok) {
      if (r.status === 404 || r.status >= 500) { console.log("Stacktrace", r.status, rota); break; }
      throw erro(`Stacktrace ${r.status}: ${(await r.text()).slice(0, 200)}`, r.status);
    }
    const d = await r.json();
    itens.push(...(d.itens || []));
    if (!d.proximo) { cursor = null; break; }
    cursor = d.proximo;
    if ((d.itens || []).length < limite) break;   // menos que o limite: chegou ao fim
  }
  return { itens, proximo: cursor };
}

// ---------- converte respostas do Stacktrace → evidências ----------
// Agrupa por aplicação × aluno (uma evidência por sessão de autoavaliação).
async function processarRespostas(itens, fs) {
  const grupos = {};
  for (const item of itens) {
    const email = chaveEmail(item.aluno?.email);
    if (!EMAIL.test(email)) continue;
    const aplicacaoId = String(item.aplicacao?.id || "");
    if (!aplicacaoId) continue;
    const criterioId = idCriterio(item);
    const nivel = nivelStacktrace(item.resposta);
    if (!criterioId || !nivel) continue;
    const chave = `${aplicacaoId}##${email}`;
    if (!grupos[chave]) grupos[chave] = { aplicacaoId, email, item0: item, criterios: {} };
    grupos[chave].criterios[criterioId] = { valor: NIVEIS_AUTO[nivel].valor, nivel };
  }
  let gravadas = 0; const erros = [];
  for (const { aplicacaoId, email, item0, criterios } of Object.values(grupos)) {
    if (!Object.keys(criterios).length) continue;
    try {
      const turma = codigoTurmaDoItem(item0);
      if (!turma) { erros.push(`sem turma: ${email}`); continue; }
      const data = isoData(item0.aplicacao?.ativadaEm || item0.respondidoEm);
      const unidade = String(item0.uc?.sigla || "").toLowerCase();
      if (!/^[a-z]+$/.test(unidade)) { erros.push(`unidade inválida: ${unidade}`); continue; }
      const { id, dados } = montarEvidencia({
        fonte: "autoavaliacao", ref: aplicacaoId, email, turma, unidade,
        periodo: periodoDe(data), data,
        titulo: `Autoavaliação ${unidade.toUpperCase()} (Stacktrace)`,
        criterios, gravadoPor: "autoavaliacao"
      });
      dados.origem = "stacktrace";
      if (item0.aplicacao?.aulaId) dados.aulaId = String(item0.aplicacao.aulaId);
      const campos = Object.keys(dados).filter(k => k !== "criterios")
        .concat(Object.keys(criterios).map(c => "criterios.`" + c + "`"));
      await fs.mesclar(`evidencias/${id}`, dados, campos, "em");
      gravadas++;
    } catch (e) { erros.push(e.message.slice(0, 120)); }
  }
  return { gravadas, erros };
}

// ---------- converte pendências do Stacktrace → atualiza campo nas evidências ----------
// Registra a observação do professor (atendimento) no critério correspondente.
async function processarPendencias(itens, fs) {
  let atualizadas = 0; const erros = [];
  for (const item of itens) {
    try {
      const email = chaveEmail(item.aluno?.email);
      if (!EMAIL.test(email)) continue;
      const criterioId = idCriterio(item);
      if (!criterioId) continue;
      const aplicacaoId = String(item.aplicacaoId || "");
      if (!aplicacaoId) continue;
      const refId = `autoavaliacao__${aplicacaoId.replace(/\//g, "_")}__${email}`;
      const ev = await fs.ler(`evidencias/${refId}`);
      if (!ev) continue;   // evidência ainda não chegou; vai ser atualizada no próximo cron
      const atual = ev.criterios?.[criterioId] || {};
      const pendencia = {
        ...atual,
        pendencia: {
          status: String(item.status || "").toLowerCase() || "aberta",
          obs:        String(item.observacao || "").slice(0, 500) || null,
          criadoEm:   item.criadoEm   || null,
          atendidoEm: item.atendidoEm || null
        }
      };
      const campo = "criterios.`" + criterioId + "`";
      await fs.mesclar(`evidencias/${refId}`, { criterios: { [criterioId]: pendencia } }, [campo], "em");
      atualizadas++;
    } catch (e) { erros.push(e.message.slice(0, 120)); }
  }
  return { atualizadas, erros };
}

// ---------- helpers ----------
// BD + critério.numero 25 → "bd.cr25"
function idCriterio(item) {
  const sigla = String(item.uc?.sigla || "").toLowerCase();
  const num = Number(item.criterio?.numero);
  if (!sigla || !Number.isFinite(num) || num <= 0) return null;
  const id = `${sigla}.cr${String(num).padStart(2, "0")}`;
  return CRITERIO.test(id) ? id : null;
}

// Stacktrace é binário (RN01): CONSIGO → "sim", NAO_CONSIGO → "nao"
function nivelStacktrace(resposta) {
  const s = String(resposta || "").toUpperCase().replace(/\s|_/g, "");
  if (s === "CONSIGO" || s === "SIM" || s === "YES") return "sim";
  if (s === "NAOCONSIGO" || s === "NAO" || s === "NO") return "nao";
  return null;
}

// "DETS-I-1A-26CT-S" → "1A"
function codigoTurmaDoItem(item) {
  const nome = String(item.turma?.nome || "");
  return (nome.toUpperCase().match(/(?:^|[^0-9A-Z])(\d[A-Z])(?=[^0-9A-Z]|$)/) || [])[1] || "";
}

const isoData = v => { const s = String(v || ""); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date().toISOString().slice(0, 10); };
const periodoDe = d => `${d.slice(0, 4)}-${Number(d.slice(5, 7)) <= 6 ? 1 : 2}`;

// compara sem vazar pelo tempo de resposta
async function mesmaChave(a, b) {
  const h = async s => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0 && a.length > 0;
}
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });

// ---------- cruzamento das 3 vertentes ----------
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
