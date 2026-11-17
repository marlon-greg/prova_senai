// 🚩 Revisão das questões apontadas pelos alunos (tela Erros e sugestões + lembrete nos Resultados da prova).
// Uma revisão por QUESTÃO (revisoesQuestoes/{qid}), juntando todos os apontamentos dela:
//  1. sugestão de decisão (análise pronta ou da IA): dar o ponto, não dar, ou só para quem foi prejudicado;
//  2. correção do enunciado no banco (para os próximos alunos não pegarem o erro);
//  3. lista de quem ERROU esta questão em qualquer prova (não só quem reportou), com a sugestão aluno por aluno;
//  4. a decisão do professor vale para todos os marcados: grava a correção (ponto cheio) na tentativa de cada um,
//     atualiza a nota que o aluno vê e responde todos os apontamentos da questão. Dá para desfazer.
import { db, esc, toast, confirmar, traduzirErro, dataBR, corrigir, contaAcerto, bancoDaQuestao, letra } from "./common.js";
import { analisarApontamentoIA } from "./ia.js?v=20261116b";
import { drawer, collapsible, vazio, pl } from "./ui.js";
import { PRONTAS } from "./revisoes-prontas.js?v=20261116b";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp, deleteField }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let ctx = null;   // { eu, podeEditar, iaCfg }
export function iniciarRevisoes(c) { ctx = c; }

const TIPOS = { duasCertas: "Mais de uma resposta certa", nenhumaCerta: "Nenhuma resposta certa", erroTexto: "Erro de digitação ou no texto", confusa: "Enunciado confuso", gabarito: "Acho que o gabarito está errado", outro: "Outro" };
const VEREDITO = { ponto: ["ok", "✅ Dar o ponto a quem errou"], semPonto: ["off", "❌ Não dar o ponto"], parcial: ["warn", "⚖ Dar o ponto só a quem foi prejudicado"] };
const abertoAp = a => ["aberto", "aberta"].includes(a.status);
const ts = x => x?.seconds || 0;

// ---------- leitura ----------
// grupos por questão: { qid, aps: [apontamentos], rev: revisoesQuestoes/{qid} | null, pendente }
export async function lerRevisoes() {
  const [a, r] = await Promise.all([getDocs(collection(db, "apontamentos")), getDocs(collection(db, "revisoesQuestoes")).catch(() => null)]);
  const revs = {}; r?.forEach(d => revs[d.id] = d.data());
  const grupos = new Map();
  a.forEach(d => {
    const x = { id: d.id, ...d.data() }; if (!x.qid) return;
    if (!grupos.has(x.qid)) grupos.set(x.qid, { qid: x.qid, aps: [], rev: revs[x.qid] || null });
    grupos.get(x.qid).aps.push(x);
  });
  grupos.forEach(g => { g.aps.sort((x, y) => ts(y.criadoEm) - ts(x.criadoEm)); g.pendente = !g.rev?.decisao && g.aps.some(abertoAp); });
  return grupos;
}
// análise que vale: a gravada, ou a pronta (Claude Code), ou nenhuma
const analiseDe = g => g.rev?.analise || (PRONTAS[g.qid] ? { ...PRONTAS[g.qid], origem: "pronta" } : null);

// questão, gabarito e TODAS as tentativas (finalizadas, de alunos de verdade) que tiveram esta questão
const cacheQ = new Map();
async function lerQuestao(qid, padrao) {
  if (cacheQ.has(qid)) return cacheQ.get(qid);
  const b = bancoDaQuestao(qid, padrao);
  const [q, g] = await Promise.all([getDoc(doc(db, "bancos", b, "questoes", qid)).catch(() => null), getDoc(doc(db, "bancos", b, "gabaritos", qid)).catch(() => null)]);
  const v = { bancoId: b, q: q?.exists() ? q.data() : null, g: g?.exists() ? g.data() : {} };
  cacheQ.set(qid, v); return v;
}
async function carregarAfetados(g, forcar = false) {
  if (g.todos && !forcar) return;
  if (forcar) cacheQ.delete(g.qid);
  const { bancoId, q, g: gab } = await lerQuestao(g.qid);
  Object.assign(g, { bancoId, q, gab });
  const tents = (await getDocs(query(collection(db, "tentativas"), where("questoesIds", "array-contains", g.qid)))).docs
    .map(d => ({ id: d.id, ...d.data() })).filter(t => t.finalizadaEm && t.teste !== true && t.simulado !== true);
  const peso = Number(q?.peso || 1);
  g.todos = await Promise.all(tents.map(async t => {
    const [r, c] = await Promise.all([getDoc(doc(db, "tentativas", t.id, "respostas", g.qid)).catch(() => null), getDoc(doc(db, "tentativas", t.id, "correcoes", g.qid)).catch(() => null)]);
    const resp = r?.exists() ? r.data() : null, corr = c?.exists() ? c.data() : null, perdida = resp?.perdida === true;
    let res = q ? corrigir(q, gab, resp?.resposta ?? undefined, perdida) : { pontos: 0, status: "revisar" };
    if (!perdida && corr?.pontos !== undefined) { const p = Number(corr.pontos); res = { pontos: p, status: p >= peso ? "certa" : p > 0 ? "parcial" : "errada" }; }
    return { t, resp, corr, peso, ...res, reportou: g.aps.some(a => a.uid === t.uid) };
  }));
  // quem errou (ou ganhou o ponto nesta revisão); perdida por sair da prova não conta
  g.erraram = g.todos.filter(x => x.corr?.revisao || (x.pontos < x.peso && x.status !== "perdida"))
    .sort((a, b) => (b.reportou - a.reportou) || String(a.t.nome || a.t.email).localeCompare(String(b.t.nome || b.t.email)));
  const an = analiseDe(g), ben = g.rev?.beneficiados || {};
  g.sel = new Set(g.rev?.decisao ? Object.keys(ben) : g.erraram.filter(x => prejudicadoPadrao(x, an)).map(x => x.t.id));
}
function prejudicadoPadrao(x, an) {
  if (!an) return false;
  if (an.porAluno?.[x.t.id]) return an.porAluno[x.t.id].prejudicado === true;
  return an.veredito === "ponto" && x.status !== "em_branco";
}
const textoResp = (g, x) => {
  const r = x.resp?.resposta;
  if (x.resp?.perdida) return "(perdida por sair da prova)";
  if (r === undefined || r === null || r === "") return "(em branco)";
  if (g.q?.tipo === "alternativa") return `${letra(Number(r))}) ${g.q.alternativas?.[r] ?? r}`;
  return typeof r === "string" ? r : JSON.stringify(r);
};

// ---------- cartão de uma questão ----------
function situacaoHTML(g) {
  const d = g.rev?.decisao;
  if (d === "ponto") return `<span class="chip ok">✅ ponto dado a ${pl(Object.keys(g.rev.beneficiados || {}).length, "aluno")}</span>`;
  if (d === "semPonto") return `<span class="chip off">❌ sem ponto</span>`;
  return g.pendente ? `<span class="chip warn">⏳ aguardando sua decisão</span>` : `<span class="chip off">respondido</span>`;
}
export function cartaoHTML(g) {
  const ap0 = g.aps[0] || {}, provas = [...new Set(g.aps.map(a => a.provaTitulo || "Prova"))];
  return `<article class="card ret-item rev-card${g.pendente ? " aberto" : ""}" data-rev="${esc(g.qid)}">
    <div class="ret-cab"><span class="chip err"><span class="e" aria-hidden="true">🚩</span>${pl(g.aps.length, "apontamento")}</span>${situacaoHTML(g)}
      <span class="meta-txt">${esc(provas.join(" · "))} · questão <span class="mono">${esc(g.qid)}</span></span></div>
    <blockquote class="ret-enun rev-enun">${esc(String(g.q?.enunciado || ap0.enunciado || "")).replace(/\n/g, "<br>")}</blockquote>
    <div class="rev-aps">${g.aps.map(a => `<div class="rev-ap"><b>${esc(a.nome || a.email)}</b> <span class="meta-txt">· ${dataBR(a.criadoEm)} · ${esc(TIPOS[a.tipo] || a.tipo || "Apontamento")}${a.provaTitulo ? ` · ${esc(a.provaTitulo)}` : ""}</span><br>“${esc(a.texto).replace(/\n/g, "<br>")}”</div>`).join("")}</div>
    <div class="rev-corpo"><p class="pequeno">Carregando a questão e quem errou…</p></div></article>`;
}
function corpoHTML(g) {
  const an = analiseDe(g), dec = g.rev?.decisao, editar = ctx.podeEditar(), temIA = !!ctx.iaCfg?.();
  const sug = an ? `<div class="rev-ia"><div class="linha acoes"><b>${an.origem === "pronta" ? "🤖 Sugestão (análise do Claude Code)" : "🤖 Sugestão da IA"}</b><span class="chip ${VEREDITO[an.veredito]?.[0] || ""}">${VEREDITO[an.veredito]?.[1] || esc(an.veredito)}</span></div>
      <p style="margin:6px 0">${esc(an.motivo)}</p></div>`
    : `<div class="rev-ia"><p class="pequeno" style="margin:0">Ainda sem análise.${temIA ? "" : " (A análise automática usa a chave da IA, que só o administrador principal tem. Você pode decidir marcando abaixo quem foi prejudicado.)"}</p></div>`;
  // correção do enunciado: a sugerida (trecho trocado ou texto inteiro da IA), editável antes de salvar
  const atual = String(g.q?.enunciado || "");
  let novo = an?.enunciadoCorrigido || (an?.correcao && atual.includes(an.correcao.de) ? atual.replace(an.correcao.de, an.correcao.para) : "");
  const aplicada = g.rev?.correcaoAplicadaEm;
  const corr = !g.q ? `<p class="pequeno erro-texto">A questão não foi encontrada no banco (foi apagada?). Dá para decidir o ponto, mas não para corrigir o texto.</p>`
    : aplicada ? `<p class="pequeno ret-resp">✏️ Enunciado corrigido no banco por ${esc(g.rev.correcaoAplicadaPor || "equipe")} em ${dataBR(aplicada)}. Os próximos alunos já recebem o texto novo.</p>`
    : novo || an?.correcao ? `<details class="rev-corr" ${novo ? "open" : ""}><summary><b>✏️ Correção sugerida para a questão</b> <span class="meta-txt">para os próximos alunos não pegarem o erro</span></summary>
        ${an?.correcao && !novo ? `<p class="pequeno">O trecho sugerido não foi achado no texto atual (a questão já mudou?). Edite abaixo se quiser.</p>` : ""}
        ${an?.correcao && novo ? `<p class="pequeno">Troca: <s>${esc(an.correcao.de)}</s> → <b>${esc(an.correcao.para)}</b></p>` : ""}
        ${editar ? `<textarea class="rev-novo" rows="6" aria-label="Enunciado corrigido">${esc(novo || atual)}</textarea>
        <div class="linha acoes"><button type="button" class="leve mini" data-rev-corrigir>Salvar a correção no banco</button></div>` : ""}</details>`
    : `<p class="pequeno">Sem correção de texto sugerida para esta questão.</p>`;
  const ben = g.rev?.beneficiados || {};
  const linhas = g.erraram.map(x => {
    const ia = an?.porAluno?.[x.t.id];
    return `<tr><td><input type="checkbox" data-rev-sel="${esc(x.t.id)}" ${g.sel.has(x.t.id) ? "checked" : ""} ${editar && !dec ? "" : "disabled"} aria-label="${esc(x.t.nome || x.t.email)} foi prejudicado"></td>
      <td><b>${esc(x.t.nome || x.t.email)}</b>${x.reportou ? ` <span class="chip err" title="Reportou o erro">🚩 reportou</span>` : ""}${ben[x.t.id] ? ` <span class="chip ok">✅ ganhou o ponto</span>` : ""}</td>
      <td class="mono rev-resp">${esc(textoResp(g, x)).replace(/\n/g, "<br>")}</td>
      <td>${ben[x.t.id] ? `${ben[x.t.id].ptsAntes}→${x.peso}` : `${x.pontos}/${x.peso}`}</td>
      <td class="pequeno">${ia ? `${ia.prejudicado ? "🤖 prejudicado" : "🤖 não prejudicado"}: ${esc(ia.motivo)}` : ""}</td></tr>`;
  }).join("");
  const n = g.todos.length;
  const lista = `<h4 style="margin:12px 0 4px">Quem errou esta questão <span class="meta-txt">(${g.erraram.length} de ${pl(n, "aluno")} que a receberam)</span></h4>
    ${g.erraram.length ? `<div class="tabela-rolagem"><table class="rev-tab"><thead><tr><th title="Prejudicado: ganha o ponto se você confirmar">✔</th><th>Aluno</th><th>Resposta</th><th>Pontos</th><th>Sugestão</th></tr></thead><tbody>${linhas}</tbody></table></div>
      ${!dec ? `<p class="pequeno">Marque quem foi <b>prejudicado</b> pelo erro: só os marcados ganham o ponto. ${editar && g.erraram.length > 1 ? `<button type="button" class="discreto mini" data-rev-todos>marcar todos</button> <button type="button" class="discreto mini" data-rev-nenhum>desmarcar todos</button>` : ""}</p>` : ""}`
      : `<p class="pequeno">Ninguém errou esta questão até agora.</p>`}`;
  const resp = g.rev?.resposta ?? an?.respostaAluno ?? "";
  const acoes = !editar ? "" : dec
    ? `<div class="linha acoes rev-acoes"><span class="pequeno">Decidido por ${esc(g.rev.decididoPor || "equipe")} em ${dataBR(g.rev.decididoEm)}.</span><button type="button" class="leve mini" data-rev-desfazer>↺ Desfazer decisão</button></div>`
    : `<label class="pequeno" for="revResp_${esc(g.qid)}">Observação para quem reportou (aparece na questão dele, no resultado da prova)</label>
       <textarea id="revResp_${esc(g.qid)}" class="rev-resposta" rows="3">${esc(resp)}</textarea>
       <div class="linha acoes rev-acoes">
         <button type="button" class="ok" data-rev-decidir="ponto">✅ Confirmar: dar o ponto <span data-rev-n>(${g.sel.size})</span></button>
         <button type="button" class="leve" data-rev-decidir="semPonto">❌ Confirmar: não dar o ponto</button>
         ${temIA ? `<button type="button" class="discreto mini" data-rev-ia>${an && an.origem !== "pronta" ? "🤖 Refazer análise da IA" : an ? "🤖 Analisar as respostas com a IA" : "🤖 Pedir análise da IA"}</button>` : ""}
       </div>`;
  return sug + corr + lista + acoes;
}

// liga um cartão já na tela: carrega quem errou, desenha o corpo e os botões. aoMudar() depois de gravar algo.
export async function ligarCartao(el, g, aoMudar = () => {}) {
  const corpo = el.querySelector(".rev-corpo");
  try { await carregarAfetados(g); } catch (e) { corpo.innerHTML = `<p class="erro-texto">${esc(traduzirErro(e))} (Publique o firestore.rules atual.)</p>`; return; }
  el.querySelector(".rev-enun").innerHTML = esc(String(g.q?.enunciado || g.aps[0]?.enunciado || "")).replace(/\n/g, "<br>");
  corpo.innerHTML = corpoHTML(g);
  const contar = () => { const s = corpo.querySelector("[data-rev-n]"); if (s) s.textContent = `(${g.sel.size})`; };
  corpo.querySelectorAll("[data-rev-sel]").forEach(c => c.onchange = () => { c.checked ? g.sel.add(c.dataset.revSel) : g.sel.delete(c.dataset.revSel); contar(); });
  corpo.querySelector("[data-rev-todos]")?.addEventListener("click", () => { g.erraram.forEach(x => g.sel.add(x.t.id)); corpo.querySelectorAll("[data-rev-sel]").forEach(c => c.checked = true); contar(); });
  corpo.querySelector("[data-rev-nenhum]")?.addEventListener("click", () => { g.sel.clear(); corpo.querySelectorAll("[data-rev-sel]").forEach(c => c.checked = false); contar(); });
  const refazer = async () => { await carregarAfetados(g, true); await ligarCartao(el, g, aoMudar); };
  corpo.querySelector("[data-rev-corrigir]")?.addEventListener("click", async b => {
    const novo = corpo.querySelector(".rev-novo").value.trim();
    if (!novo || novo === g.q.enunciado) { toast("O texto está igual ao atual.", "info"); return; }
    if (!(await confirmar("Salvar o enunciado corrigido no banco? Os próximos alunos já recebem o texto novo. Quem já fez a prova continua vendo a questão como estava.", { titulo: "Corrigir a questão", ok: "Salvar" }))) return;
    try {
      await updateDoc(doc(db, "bancos", g.bancoId, "questoes", g.qid), { enunciado: novo });
      await setDoc(doc(db, "revisoesQuestoes", g.qid), { qid: g.qid, bancoId: g.bancoId, enunciadoAntes: g.q.enunciado, correcaoAplicadaEm: serverTimestamp(), correcaoAplicadaPor: ctx.eu.nome || ctx.eu.email }, { merge: true });
      g.rev = { ...(g.rev || {}), correcaoAplicadaEm: { seconds: Date.now() / 1000, toDate: () => new Date() }, correcaoAplicadaPor: ctx.eu.nome || ctx.eu.email };
      toast("Questão corrigida no banco.", "ok"); await refazer(); aoMudar();
    } catch (e) { toast(traduzirErro(e), "erro"); }
  });
  corpo.querySelector("[data-rev-ia]")?.addEventListener("click", async ev => {
    const b = ev.currentTarget; b.disabled = true; b.textContent = "🤖 Analisando…";
    try { await analisarIA(g); toast("Análise pronta. Confira e confirme.", "ok"); await ligarCartao(el, g, aoMudar); }
    catch (e) { toast(e.message || traduzirErro(e), "erro"); b.disabled = false; b.textContent = "🤖 Tentar a análise de novo"; }
  });
  corpo.querySelectorAll("[data-rev-decidir]").forEach(b => b.onclick = async () => {
    const ponto = b.dataset.revDecidir === "ponto", resposta = corpo.querySelector(".rev-resposta")?.value.trim() || "";
    if (await decidir(g, ponto, resposta)) { await refazer(); aoMudar(); }
  });
  corpo.querySelector("[data-rev-desfazer]")?.addEventListener("click", async () => { if (await desfazer(g)) { await refazer(); aoMudar(); } });
}

// ---------- IA ----------
async function analisarIA(g) {
  const cfg = ctx.iaCfg?.(); if (!cfg) throw new Error("A análise usa a chave da IA (Configuração), que só o administrador principal tem.");
  await carregarAfetados(g);
  if (!g.q) throw new Error("A questão não está mais no banco.");
  const erradas = g.erraram.filter(x => !x.corr?.revisao).slice(0, 120).map(x => ({ id: x.t.id, resposta: textoResp(g, x) }));
  const r = await analisarApontamentoIA({ chave: cfg.chave, modelo: cfg.modelo, q: g.q, g: g.gab, apontamentos: g.aps.map(a => ({ tipo: TIPOS[a.tipo] || a.tipo, texto: a.texto })), erradas });
  const pronta = PRONTAS[g.qid] && !g.rev?.analise;
  // análise pronta: a IA só completa o "aluno por aluno" (a decisão sugerida e o texto continuam os da análise pronta)
  const analise = pronta ? { ...PRONTAS[g.qid], origem: "pronta", porAluno: r.porAluno } : { ...r, origem: "ia" };
  await setDoc(doc(db, "revisoesQuestoes", g.qid), { qid: g.qid, bancoId: g.bancoId, analise: { ...analise, em: serverTimestamp(), modelo: cfg.modelo } }, { merge: true });
  g.rev = { ...(g.rev || {}), analise };
  g.sel = new Set(g.erraram.filter(x => prejudicadoPadrao(x, analise)).map(x => x.t.id));
}
// telas abertas: analisa sozinha as questões pendentes ainda sem análise (uma vez; fica gravada)
export async function analisarPendentes(grupos, aoCada = () => {}) {
  if (!ctx.iaCfg?.()) return;
  for (const g of grupos) if (g.pendente && !analiseDe(g)) { try { await analisarIA(g); aoCada(g); } catch (e) { console.warn("análise IA", g.qid, e); if (e.fatal) return; } }
}

// ---------- decisão (vale para todos os marcados) ----------
async function pesoTotal(t) {
  const qs = await Promise.all((t.questoesIds || []).map(q => lerQuestao(q, t.bancoId)));
  return qs.reduce((s, x) => s + Number(x.q?.peso || 1), 0);
}
// placar que o aluno vê, mexendo só na diferença desta questão (igual ao que o painel de Resultados recalcula depois)
async function ajustarPlacar(t, ganho, acertoAntes, acertoDepois, revisarAntes) {
  const d = (await getDoc(doc(db, "tentativas", t.id))).data() || {};
  if (typeof d.notaPrevia !== "number") return;   // placar ainda não gravado: o painel de Resultados calcula com a correção
  const max = await pesoTotal(d); if (!max) return;
  const pts = d.notaPrevia / 100 * max + ganho, nova = Math.round(Math.max(0, pts) / max * 1000) / 10;
  const p = { notaPrevia: nova, acertos: Math.max(0, (d.acertos || 0) + (acertoDepois - acertoAntes)) };
  if (revisarAntes) p.aguardandoCorrecao = Math.max(0, (d.aguardandoCorrecao || 0) - 1);
  if (d.nota !== undefined) p.nota = nova;
  await updateDoc(doc(db, "tentativas", t.id), p);
}
async function responderApontamentos(g, status, resposta) {
  const lote = writeBatch(db);
  g.aps.forEach(a => lote.update(doc(db, "apontamentos", a.id), { status, resposta, respondidoPor: ctx.eu.nome || ctx.eu.email, respondidoEm: serverTimestamp() }));
  await lote.commit();
}
async function decidir(g, ponto, resposta) {
  const alvo = ponto ? g.erraram.filter(x => g.sel.has(x.t.id) && !x.corr?.revisao) : [];
  if (ponto && !alvo.length) { toast("Marque quem foi prejudicado (quem ganha o ponto).", "erro"); return false; }
  const nomes = alvo.slice(0, 8).map(x => x.t.nome || x.t.email).join(", ") + (alvo.length > 8 ? ` e mais ${alvo.length - 8}` : "");
  const msg = ponto ? `Dar o ponto desta questão a ${pl(alvo.length, "aluno")} (${nomes})? A nota de cada um é recalculada e ${pl(g.aps.length, "apontamento")} recebe${g.aps.length > 1 ? "m" : ""} a observação como "procede".`
    : `Não dar o ponto? Ninguém tem a nota mudada e ${pl(g.aps.length, "apontamento")} recebe${g.aps.length > 1 ? "m" : ""} a observação como "não procede".`;
  if (!(await confirmar(msg + (resposta ? "" : "\n\nA observação para quem reportou está vazia."), { titulo: ponto ? "Dar o ponto" : "Não dar o ponto", ok: "Confirmar" }))) return false;
  try {
    const beneficiados = {};
    for (const x of alvo) {
      await setDoc(doc(db, "tentativas", x.t.id, "correcoes", g.qid), { pontos: x.peso, comentario: "✅ Ponto dado na revisão da questão (o professor confirmou o problema apontado).",
        corrigidoPor: ctx.eu.email, corrigidoEm: serverTimestamp(), revisao: true, antes: x.corr ? { pontos: x.corr.pontos ?? null, comentario: x.corr.comentario || "", corrigidoPor: x.corr.corrigidoPor || "" } : null });
      await ajustarPlacar(x.t, x.peso - x.pontos, contaAcerto(x) ? 1 : 0, 1, x.status === "revisar" && !x.corr);
      beneficiados[x.t.id] = { nome: x.t.nome || x.t.email, ptsAntes: x.pontos, statusAntes: x.status, revisarAntes: x.status === "revisar" && !x.corr };
    }
    await responderApontamentos(g, ponto ? "procede" : "nao-procede", resposta);
    const analise = analiseDe(g);
    await setDoc(doc(db, "revisoesQuestoes", g.qid), { qid: g.qid, bancoId: g.bancoId || bancoDaQuestao(g.qid), decisao: ponto ? "ponto" : "semPonto", resposta, beneficiados,
      decididoPor: ctx.eu.nome || ctx.eu.email, decididoEm: serverTimestamp(), ...(analise && !g.rev?.analise ? { analise: { ...analise, em: serverTimestamp() } } : {}) }, { merge: true });
    g.rev = { ...(g.rev || {}), decisao: ponto ? "ponto" : "semPonto", resposta, beneficiados, decididoPor: ctx.eu.nome || ctx.eu.email, decididoEm: { seconds: Date.now() / 1000, toDate: () => new Date() }, analise: g.rev?.analise || analise };
    g.aps.forEach(a => Object.assign(a, { status: ponto ? "procede" : "nao-procede", resposta })); g.pendente = false;
    toast(ponto ? `Ponto dado a ${pl(alvo.length, "aluno")}.` : "Decidido: sem ponto.", "ok");
    return true;
  } catch (e) { toast(traduzirErro(e), "erro"); return false; }
}
async function desfazer(g) {
  const ben = g.rev?.beneficiados || {}, n = Object.keys(ben).length;
  if (!(await confirmar(`Desfazer a decisão desta questão?${n ? ` O ponto dado a ${pl(n, "aluno")} é retirado e a nota volta ao que era.` : ""} Os apontamentos voltam a ficar abertos.`, { titulo: "Desfazer decisão", ok: "Desfazer", perigo: true }))) return false;
  try {
    for (const [tid, b] of Object.entries(ben)) {
      const x = g.todos.find(y => y.t.id === tid); if (!x) continue;
      const ref = doc(db, "tentativas", tid, "correcoes", g.qid), antes = x.corr?.antes;
      if (antes && antes.pontos !== null) await setDoc(ref, { pontos: antes.pontos, comentario: antes.comentario, corrigidoPor: antes.corrigidoPor || ctx.eu.email, corrigidoEm: serverTimestamp() });
      else await deleteDoc(ref);
      await ajustarPlacar(x.t, Number(b.ptsAntes) - x.peso, 1, contaAcerto({ status: b.statusAntes, pontos: b.ptsAntes, peso: x.peso }) ? 1 : 0, false);
      if (b.revisarAntes) { const d = (await getDoc(doc(db, "tentativas", tid))).data() || {}; if (typeof d.aguardandoCorrecao === "number") await updateDoc(doc(db, "tentativas", tid), { aguardandoCorrecao: d.aguardandoCorrecao + 1 }); }
    }
    await responderApontamentos(g, "aberto", g.rev?.resposta || "");
    await updateDoc(doc(db, "revisoesQuestoes", g.qid), { decisao: deleteField(), beneficiados: deleteField(), decididoPor: deleteField(), decididoEm: deleteField() });
    g.rev = { ...g.rev, decisao: null, beneficiados: {} }; g.aps.forEach(a => a.status = "aberto"); g.pendente = true;
    toast("Decisão desfeita.", "ok"); return true;
  } catch (e) { toast(traduzirErro(e), "erro"); return false; }
}

// ---------- lista da tela Erros e sugestões ----------
export function desenharListaRevisoes(box, grupos, { busca = "", status = "aberto", aoMudar = () => {} } = {}) {
  const b = busca.toLowerCase();
  const lista = [...grupos.values()]
    .filter(g => !status || (status === "aberto" ? g.pendente : !g.pendente))
    .filter(g => !b || `${g.qid} ${g.aps.map(a => `${a.nome} ${a.email} ${a.texto} ${a.provaTitulo || ""} ${a.enunciado || ""}`).join(" ")}`.toLowerCase().includes(b))
    .sort((x, y) => (y.pendente - x.pendente) || (ts(y.aps[0]?.criadoEm) - ts(x.aps[0]?.criadoEm)));
  const porProva = new Map();
  lista.forEach(g => { const p = g.aps[0]?.provaTitulo || "Prova sem nome"; if (!porProva.has(p)) porProva.set(p, []); porProva.get(p).push(g); });
  box.innerHTML = lista.length ? [...porProva].map(([p, l]) => collapsible({ chave: `rev:${p}`, aberto: true, classe: "ret-grupo", titulo: esc(p),
      resumoHTML: `<span class="meta-txt">${pl(l.length, "questão", "questões")}</span>${l.filter(g => g.pendente).length ? `<span class="chip warn">${l.filter(g => g.pendente).length} aguardando decisão</span>` : ""}`,
      corpoHTML: l.map(cartaoHTML).join("") })).join("")
    : vazio({ e: "🚩", texto: `Nenhum erro reportado${b || status ? " com esses filtros" : " ainda"}.` });
  lista.forEach(g => { const el = box.querySelector(`[data-rev="${CSS.escape(g.qid)}"]`); if (el) ligarCartao(el, g, aoMudar); });
  return lista;
}

// ---------- lembrete nos Resultados da prova ----------
// grupos que tocam esta prova: { qid -> g } só das questões que caíram para alguém nesta prova
export function revisoesDaProva(grupos, tentativas) {
  const qids = new Set(tentativas.flatMap(t => t.questoesIds || [])), m = new Map();
  grupos?.forEach((g, qid) => { if (qids.has(qid)) m.set(qid, g); });
  return m;
}
// faixa no topo dos Resultados: questões desta prova com erro reportado ainda sem decisão
export function faixaRevisoesHTML(m, numeroDe = () => "") {
  const pend = [...m.values()].filter(g => g.pendente);
  if (!pend.length) return "";
  return `<div class="card rev-faixa" role="status"><b>⚠ ${pl(pend.length, "questão", "questões")} desta prova com erro reportado, aguardando sua decisão</b>
    ${pend.map(g => `<div class="linha acoes"><span>${esc(numeroDe(g.qid))}<span class="mono">${esc(g.qid)}</span> · reportado por ${esc([...new Set(g.aps.map(a => a.nome || a.email))].join(", "))}</span>
      <button type="button" class="leve mini" data-revisar="${esc(g.qid)}">Ver e decidir</button></div>`).join("")}</div>`;
}
// aviso dentro da questão, no detalhe do aluno
export function avisoQuestaoHTML(g, t, errou) {
  if (!g) return "";
  const ben = g.rev?.beneficiados?.[t.id], reportou = g.aps.some(a => a.uid === t.uid);
  if (g.rev?.decisao) return ben ? `<p class="pequeno ret-resp">✅ Ponto dado na revisão desta questão (${esc(g.rev.decididoPor || "equipe")}).</p>`
    : reportou || errou ? `<p class="pequeno">🚩 Questão revisada: ${g.rev.decisao === "ponto" ? "ponto dado só a quem foi prejudicado" : "sem ponto"}.</p>` : "";
  if (!g.pendente || (!reportou && !errou)) return "";
  return `<div class="rev-aviso" role="note"><b>⚠ ${reportou ? "Este aluno reportou um erro nesta questão" : "Questão com erro reportado (este aluno errou)"}</b> · aguardando sua decisão
    <button type="button" class="leve mini" data-revisar="${esc(g.qid)}">Ver e decidir</button></div>`;
}
// abre o mesmo cartão da tela de erros num painel lateral
export function abrirRevisao(g, aoMudar = () => {}) {
  const d = drawer({ titulo: "🚩 Erro reportado na questão", largo: true, corpoHTML: cartaoHTML(g) });
  ligarCartao(d.corpo.querySelector("[data-rev]"), g, aoMudar);
  return d;
}
