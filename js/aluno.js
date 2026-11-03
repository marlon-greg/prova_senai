// Página do aluno: login, lista de provas, prova (uma questão por vez), resultado.
import { db, entrar, sair, aoMudarLogin, identificar, corrigir, embaralhar, sortearAleatorio, esc, $, toast, dataBR, letra,
         idTentativaTeste, apagarTentativaTeste, confirmar, traduzirErro, iniciais }
  from "./common.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, writeBatch, serverTimestamp, increment }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let eu = null;            // { uid, email, nome }
let provaAtual = null;    // { id, ...dados }
let tentativa = null;     // { id, ...dados }
let questoes = {};        // qid -> questão (enunciado, alternativas...)
let respostas = {};       // qid -> { resposta }
let ordemAlternativas = {}; // qid -> índices embaralhados

// ---------- modo teste (equipe vê a prova como o aluno: index.html?teste=<provaId>) ----------
const provaTeste = new URLSearchParams(location.search).get("teste");
let modoTeste = false;
// id da tentativa: real = uid_prova · teste = teste_uid_prova
function idTentativa(provaId) { return modoTeste ? idTentativaTeste(eu.uid, provaId) : `${eu.uid}_${provaId}`; }

const telas = ["telaLogin", "telaProvas", "telaInicio", "telaQuestao", "telaFim", "telaResultado", "telaAviso"];
function mostrar(id) { telas.forEach(t => $("#" + t).classList.toggle("oculto", t !== id)); window.scrollTo({ top: 0, behavior: "smooth" }); }

// ---------- fonte maior (acessibilidade) ----------
if (localStorage.getItem("fonteGrande") === "1") document.body.classList.add("grande");
$("#btnFonte").onclick = () => { document.body.classList.toggle("grande"); localStorage.setItem("fonteGrande", document.body.classList.contains("grande") ? "1" : "0"); };

// ---------- login ----------
$("#btnEntrar").onclick = async () => {
  $("#msgLogin").textContent = "";
  try { await entrar(); } catch (e) { $("#msgLogin").textContent = "Não foi possível entrar. " + traduzirErro(e); }
};
$("#btnSair").onclick = () => sair();

aoMudarLogin(async user => {
  if (!user) { eu = null; modoTeste = false; $("#faixaTeste").classList.add("oculto"); $("#quem").textContent = ""; $("#avatar").classList.add("oculto"); $("#btnSair").classList.add("oculto"); mostrar("telaLogin"); return; }
  const id = await identificar(user);
  $("#quem").textContent = id.email; $("#btnSair").classList.remove("oculto");
  $("#avatar").textContent = iniciais(user.displayName || id.email); $("#avatar").title = user.displayName || id.email; $("#avatar").classList.remove("oculto");
  if (id.tipo === "bloqueado") {
    $("#avisoTexto").innerHTML = `<h2>Conta não autorizada</h2><p>A conta <b>${esc(id.email)}</b> não é de aluno do SENAI.<br>Entre com o e-mail <b>@${esc(id.dominios.join("</b> ou <b>@"))}</b>.</p>`;
    mostrar("telaAviso"); return;
  }
  if (id.tipo === "equipe" && provaTeste) {
    modoTeste = true;
    eu = { uid: user.uid, email: id.email, nome: id.nome };
    $("#faixaTeste").classList.remove("oculto");
    await abrirProva(provaTeste, "inicio");
    return;
  }
  if (id.tipo === "equipe") {
    $("#avisoTexto").innerHTML = `<h2>Olá, ${esc(id.nome)}</h2><p>Esta é a página do aluno. O seu painel é o <a href="admin.html"><b>admin.html</b></a>.</p>`;
    mostrar("telaAviso"); return;
  }
  eu = { uid: user.uid, email: id.email, nome: id.nome };
  await listarProvas();
});

// ---------- lista de provas ----------
async function listarProvas() {
  mostrar("telaProvas");
  const box = $("#listaProvas"); box.innerHTML = "<p class='pequeno'>Carregando…</p>";
  let lista;
  if (modoTeste) {
    // modo teste: só a prova em teste, mesmo que ainda não esteja liberada
    const p = await getDoc(doc(db, "provas", provaTeste));
    lista = p.exists() ? [{ id: p.id, ...p.data() }] : [];
  } else {
    const [a, b] = await Promise.all([
      getDocs(query(collection(db, "provas"), where("liberada", "==", true))),
      getDocs(query(collection(db, "provas"), where("resultadosLiberados", "==", true)))
    ]);
    const provas = {};
    a.forEach(d => provas[d.id] = { id: d.id, ...d.data() });
    b.forEach(d => provas[d.id] = { id: d.id, ...d.data() });
    lista = Object.values(provas).sort((x, y) => (y.criadoEm?.seconds || 0) - (x.criadoEm?.seconds || 0));
  }
  if (!lista.length) { box.innerHTML = `<div class="vazio"><div class="icone">📭</div><p><b>Nenhuma prova liberada no momento.</b></p><p class="pequeno">Quando o professor liberar, ela aparece aqui. Se a prova já começou na sala, recarregue a página.</p></div>`; return; }
  box.innerHTML = "";
  for (const p of lista) {
    const t = await getDoc(doc(db, "tentativas", idTentativa(p.id)));
    const td = t.exists() ? t.data() : null;
    const podeFazer = modoTeste || p.liberada, podeVerResultado = modoTeste || p.resultadosLiberados;
    let status, acao;
    if (!td)                    { status = `<span class="tag">○ não iniciada</span>`; acao = podeFazer ? `<button data-acao="inicio" data-id="${p.id}">Fazer a prova</button>` : `<span class="pequeno">prova encerrada</span>`; }
    else if (!td.finalizadaEm)  { status = `<span class="tag aviso">◐ em andamento (questão ${(td.indiceAtual || 0) + 1} de ${p.nQuestoes})</span>`; acao = podeFazer ? `<button data-acao="continuar" data-id="${p.id}">Continuar</button>` : `<span class="pequeno">prova encerrada</span>`; }
    else                        { status = `<span class="tag ok">✓ finalizada em ${dataBR(td.finalizadaEm)}</span>` + (td.nota !== undefined ? ` <span class="tag nota">nota final: <b>${td.nota}</b></span>` : td.notaPrevia !== null && td.notaPrevia !== undefined ? ` <span class="tag nota">nota prévia: <b>${td.notaPrevia}</b>${td.aguardandoCorrecao ? " (aguardando correção)" : ""}</span>` : ""); acao = podeVerResultado ? `<button class="sec" data-acao="resultado" data-id="${p.id}">Ver resultado</button>` : `<span class="pequeno">resultado ainda não liberado</span>`; }
    box.insertAdjacentHTML("beforeend", `<div class="prova-item"><div class="info"><b>${esc(p.titulo)}</b><br><span class="pequeno">${esc(p.turma || "")} · ${p.nQuestoes} questões</span><div style="margin-top:4px">${status}</div></div><div class="acao">${acao}</div></div>`);
  }
  box.querySelectorAll("button[data-acao]").forEach(btn => btn.onclick = () => abrirProva(btn.dataset.id, btn.dataset.acao));
}
$("#btnVoltar1").onclick = $("#btnVoltar2").onclick = $("#btnVoltar3").onclick = listarProvas;
$("#btnImprimir").onclick = () => window.print();

// ---------- abrir prova ----------
async function abrirProva(id, acao) {
  const p = await getDoc(doc(db, "provas", id));
  if (!p.exists()) return toast("Prova não encontrada", "erro");
  provaAtual = { id, ...p.data() };
  const t = await getDoc(doc(db, "tentativas", idTentativa(id)));
  tentativa = t.exists() ? { id: t.id, ...t.data() } : null;
  if (acao === "resultado") return verResultado();
  if (!tentativa) {
    $("#inicioTitulo").textContent = provaAtual.titulo;
    $("#inicioInfo").innerHTML = `<p>${provaAtual.nQuestoes} questões sorteadas do banco · ${esc(provaAtual.turma || "")}</p>`;
    mostrar("telaInicio"); return;
  }
  await carregarTentativa();
}

$("#btnComecar").onclick = async () => {
  $("#btnComecar").disabled = true;
  try {
    // sorteia nQuestoes do banco (ids) — cada aluno recebe um conjunto diferente
    const qs = await getDocs(collection(db, "bancos", provaAtual.bancoId, "questoes"));
    const ids = [], diss = [], alt = [];
    qs.forEach(d => { ids.push(d.id); (d.data().tipo === "dissertativa" ? diss : alt).push(d.id); });
    if (ids.length < provaAtual.nQuestoes) throw new Error("O banco tem menos questões do que a prova pede. Avise o professor.");
    let sorteadas;
    const nD = Number(provaAtual.nDissertativas || 0);
    if (nD > 0 && diss.length >= nD && alt.length >= provaAtual.nQuestoes - nD)
      sorteadas = sortearAleatorio([...sortearAleatorio(diss, nD), ...sortearAleatorio(alt, provaAtual.nQuestoes - nD)], provaAtual.nQuestoes);
    else sorteadas = sortearAleatorio(ids, provaAtual.nQuestoes);
    const tid = idTentativa(provaAtual.id);
    const dados = {
      uid: eu.uid, email: eu.email, nome: eu.nome, provaId: provaAtual.id, bancoId: provaAtual.bancoId,
      questoesIds: sorteadas, iniciadaEm: serverTimestamp(), finalizadaEm: null, indiceAtual: 0, trocasDeAba: 0, notaPrevia: null, aguardandoCorrecao: 0
    };
    if (modoTeste) dados.teste = true;
    await setDoc(doc(db, "tentativas", tid), dados);
    const t = await getDoc(doc(db, "tentativas", tid));
    tentativa = { id: tid, ...t.data() };
    await carregarTentativa();
  } catch (e) { toast("Não foi possível começar. " + traduzirErro(e), "erro"); console.error(e); }
  $("#btnComecar").disabled = false;
};

async function carregarTentativa() {
  questoes = {}; respostas = {};
  const docsQ = await Promise.all(tentativa.questoesIds.map(q => getDoc(doc(db, "bancos", tentativa.bancoId, "questoes", q))));
  docsQ.forEach(d => { if (d.exists()) questoes[d.id] = { id: d.id, ...d.data() }; });
  const rs = await getDocs(collection(db, "tentativas", tentativa.id, "respostas"));
  rs.forEach(d => respostas[d.id] = d.data());
  if (tentativa.finalizadaEm) { mostrarFim(); return; }
  // retoma na primeira questão sem resposta (o índice salvo pode ter ficado para trás)
  let i = tentativa.indiceAtual || 0;
  while (i < tentativa.questoesIds.length && respostas[tentativa.questoesIds[i]]) i++;
  if (i >= tentativa.questoesIds.length) return finalizar();
  tentativa.indiceAtual = i;
  mostrarQuestao();
}

// ---------- questão ----------
let enviada = false;
function mostrarQuestao() {
  enviada = false;
  const i = tentativa.indiceAtual, total = tentativa.questoesIds.length, qid = tentativa.questoesIds[i], q = questoes[qid];
  $("#qTitulo").textContent = provaAtual.titulo;
  $("#qContador").textContent = `Questão ${i + 1} de ${total}`;
  $("#qTipo").textContent = q.tipo === "alternativa" ? "múltipla escolha" : "resposta escrita";
  $("#qBarra").style.width = `${(i / total) * 100}%`;
  $("#qEnunciado").innerHTML = formatarEnunciado(q.enunciado);
  $("#qFeedback").classList.add("oculto"); $("#qFeedback").innerHTML = "";
  $("#btnEnviar").classList.remove("oculto"); $("#btnEnviar").disabled = false;
  $("#btnProxima").classList.add("oculto"); $("#btnFinalizar").classList.add("oculto");
  $("#qDica").classList.remove("oculto");
  const area = $("#qArea"); area.innerHTML = "";
  if (q.tipo === "alternativa") {
    let ordem = q.alternativas.map((_, k) => k);
    if (provaAtual.embaralharAlternativas !== false) ordem = embaralhar(ordem, eu.uid + qid);
    ordemAlternativas[qid] = ordem;
    ordem.forEach((k, pos) => {
      area.insertAdjacentHTML("beforeend", `<label class="alt"><input type="radio" name="alt" value="${k}"><span class="alt-letra">${letra(pos)}</span><span class="alt-texto">${esc(q.alternativas[k])}</span></label>`);
    });
    // "change" cobre clique e teclado (setas) na escolha da alternativa
    area.querySelectorAll(".alt input").forEach(inp => inp.addEventListener("change", () => {
      area.querySelectorAll(".alt").forEach(x => x.classList.toggle("sel", x.contains(inp)));
    }));
  } else {
    area.innerHTML = `<label for="txtResposta" class="pequeno">Sua resposta</label>
                      <textarea id="txtResposta" placeholder="Digite sua resposta aqui. Colar está desativado." spellcheck="false"></textarea>
                      <div class="contador"><span id="qChars">0</span> caracteres · Ctrl+V, botão direito e arrastar texto não funcionam neste campo.</div>`;
    const txt = $("#txtResposta");
    txt.addEventListener("input", () => $("#qChars").textContent = txt.value.length);
    bloquearColar(txt);
  }
  mostrar("telaQuestao");
}

// enunciado: quebra de linha preservada; ```bloco``` (ou `trecho com quebra de linha`) vira bloco de código; `trecho` vira código na linha
function formatarEnunciado(t) {
  return esc(t)
    .replace(/```\w*\n?([\s\S]+?)\n?```/g, '<pre class="codigo">$1</pre>')
    .replace(/`([^`]+)`/g, (_, c) => c.includes("\n") ? `<pre class="codigo">${c}</pre>` : `<code>${c}</code>`);
}

function bloquearColar(el) {
  ["paste", "drop", "contextmenu"].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); toast("Colar está desativado nesta prova.", "erro"); }));
  el.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && ["v", "V"].includes(e.key)) { e.preventDefault(); toast("Colar está desativado nesta prova.", "erro"); } });
  el.addEventListener("beforeinput", e => { if (e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop") e.preventDefault(); });
}

$("#btnEnviar").onclick = async () => {
  if (enviada) return;
  const qid = tentativa.questoesIds[tentativa.indiceAtual], q = questoes[qid];
  let resposta;
  if (q.tipo === "alternativa") {
    const m = document.querySelector("input[name=alt]:checked");
    if (!m) return toast("Escolha uma alternativa.", "erro");
    resposta = Number(m.value);
  } else {
    resposta = ($("#txtResposta").value || "").trim();
    if (!resposta) return toast("Escreva a resposta antes de enviar.", "erro");
  }
  if (!(await confirmar("Enviar esta resposta? Depois não dá para alterar.", { titulo: "Enviar resposta", ok: "Enviar" }))) return;
  $("#btnEnviar").disabled = true;
  try {
    const lote = writeBatch(db);
    lote.set(doc(db, "tentativas", tentativa.id, "respostas", qid), { resposta, enviadaEm: serverTimestamp() });
    // o marcador libera o gabarito para o aluno; a equipe já lê os gabaritos, então o modo teste não grava
    if (!modoTeste) lote.set(doc(db, "marcadores", `${eu.uid}_${qid}`), { uid: eu.uid, qid, provaId: provaAtual.id, criadoEm: serverTimestamp() });
    await lote.commit();
    enviada = true; respostas[qid] = { resposta };
    await mostrarFeedback(qid, q, resposta);
  } catch (e) {
    $("#btnEnviar").disabled = false;
    toast("Não foi possível enviar. " + traduzirErro(e), "erro"); console.error(e);
  }
};

async function mostrarFeedback(qid, q, resposta) {
  const modo = provaAtual.feedbackImediato || "acerto";   // nenhum | acerto | completo
  const fb = $("#qFeedback");
  if (modo !== "nenhum") {
    try {
      const g = (await getDoc(doc(db, "bancos", tentativa.bancoId, "gabaritos", qid))).data() || {};
      const r = corrigir(q, g, resposta);
      let html = r.status === "certa" ? "<b>Resposta correta.</b>" : r.status === "errada" ? "<b>Resposta incorreta.</b>" : "<b>Resposta registrada.</b> Vai para a correção do professor.";
      if (modo === "completo") {
        if (q.tipo === "alternativa") html += `<br>Correta: <b>${esc(q.alternativas[g.correta])}</b>`;
        else if (g.respostasAceitas?.length) html += `<br>Resposta esperada: <span class="mono">${esc(g.respostasAceitas[0])}</span>`;
        if (g.explicacao) html += `<br><span class="pequeno">${esc(g.explicacao)}</span>`;
      }
      const icone = { certa: "✅", errada: "❌" }[r.status] || "🟡";
      fb.className = "feedback " + r.status; fb.innerHTML = `<span class="icone" aria-hidden="true">${icone}</span><div>${html}</div>`; fb.classList.remove("oculto");
    } catch (e) { console.warn("sem feedback", e); }
  }
  $("#btnEnviar").classList.add("oculto"); $("#qDica").classList.add("oculto");
  const ultima = tentativa.indiceAtual >= tentativa.questoesIds.length - 1;
  (ultima ? $("#btnFinalizar") : $("#btnProxima")).classList.remove("oculto");
}

$("#btnProxima").onclick = async () => {
  tentativa.indiceAtual++;
  updateDoc(doc(db, "tentativas", tentativa.id), { indiceAtual: tentativa.indiceAtual }).catch(() => {});
  mostrarQuestao();
};
$("#btnFinalizar").onclick = finalizar;

async function finalizar() {
  try {
    // nota prévia: corrige na hora o que dá para corrigir (alternativas e dissertativas reconhecidas)
    let pts = 0, max = 0, pend = 0;
    for (const qid of tentativa.questoesIds) {
      const q = questoes[qid]; if (!q) continue;
      const peso = Number(q.peso || 1); max += peso;
      let g = {};
      try { g = (await getDoc(doc(db, "bancos", tentativa.bancoId, "gabaritos", qid))).data() || {}; } catch (e) { /* sem acesso: conta como pendente */ }
      const c = corrigir(q, g, respostas[qid]?.resposta);
      pts += c.pontos; if (c.status === "revisar") pend++;
    }
    const notaPrevia = max ? Math.round(pts / max * 1000) / 10 : 0;
    const lote = writeBatch(db);
    lote.update(doc(db, "tentativas", tentativa.id), { finalizadaEm: serverTimestamp(), indiceAtual: tentativa.questoesIds.length, notaPrevia, aguardandoCorrecao: pend });
    // garante o marcador de todas as questões (libera a leitura do gabarito no resultado)
    if (!modoTeste) for (const qid of tentativa.questoesIds)
      if (!respostas[qid]) lote.set(doc(db, "marcadores", `${eu.uid}_${qid}`), { uid: eu.uid, qid, provaId: provaAtual.id, criadoEm: serverTimestamp() });
    await lote.commit();
    tentativa.finalizadaEm = new Date(); tentativa.notaPrevia = notaPrevia; tentativa.aguardandoCorrecao = pend;
    mostrarFim();
  } catch (e) { toast("Não foi possível finalizar. " + traduzirErro(e), "erro"); console.error(e); }
}

function mostrarFim() {
  const n = tentativa.notaPrevia, pend = tentativa.aguardandoCorrecao || 0;
  $("#fimNota").innerHTML = n === null || n === undefined ? "" :
    `<p style="font-family:var(--fonte-titulo);font-size:1.8em;font-weight:600;margin:8px 0">Sua nota: ${n} / 100</p>` +
    (pend ? `<p class="pequeno">⚠ ${pend} resposta(s) escrita(s) ainda vão passar pela correção do professor: a nota pode subir.</p>` : "") +
    `<p class="pequeno">As respostas certas e as explicações aparecem quando o professor liberar o resultado.</p>`;
  // modo teste: a equipe pode abrir a tela de resultado mesmo com os resultados ainda ocultos
  $("#btnVerResultadoTeste").classList.toggle("oculto", !modoTeste);
  mostrar("telaFim");
}

$("#btnVerResultadoTeste").onclick = () => verResultado();

$("#btnReiniciarTeste").onclick = async () => {
  if (!modoTeste || !(await confirmar("Apagar a sua tentativa de teste e recomeçar do zero?", { titulo: "Reiniciar teste", ok: "Reiniciar", perigo: true }))) return;
  $("#btnReiniciarTeste").disabled = true;
  try {
    await apagarTentativaTeste(eu.uid, provaTeste);
    tentativa = null;
    await abrirProva(provaTeste, "inicio");
    toast("Teste reiniciado.", "ok");
  } catch (e) { toast("Não foi possível reiniciar o teste. " + traduzirErro(e), "erro"); console.error(e); }
  $("#btnReiniciarTeste").disabled = false;
};

// troca de aba / janela durante a prova: registra
document.addEventListener("visibilitychange", () => {
  if (document.hidden && tentativa && !tentativa.finalizadaEm && !$("#telaQuestao").classList.contains("oculto"))
    updateDoc(doc(db, "tentativas", tentativa.id), { trocasDeAba: increment(1) }).catch(() => {});
});

// ---------- resultado ----------
async function verResultado() {
  if (!tentativa) return toast("Você não fez esta prova.", "erro");
  mostrar("telaResultado");
  $("#resTitulo").textContent = provaAtual.titulo;
  $("#resResumo").innerHTML = "<p class='pequeno'>Carregando…</p>"; $("#resLista").innerHTML = "";
  const ids = tentativa.questoesIds;
  const [qs, gs, rs, cs] = await Promise.all([
    Promise.all(ids.map(q => getDoc(doc(db, "bancos", tentativa.bancoId, "questoes", q)))),
    Promise.all(ids.map(q => getDoc(doc(db, "bancos", tentativa.bancoId, "gabaritos", q)).catch(() => null))),
    getDocs(collection(db, "tentativas", tentativa.id, "respostas")),
    getDocs(collection(db, "tentativas", tentativa.id, "correcoes")).catch(() => ({ forEach() {} }))
  ]);
  const resp = {}; rs.forEach(d => resp[d.id] = d.data());
  const corr = {}; cs.forEach(d => corr[d.id] = d.data());
  let total = 0, max = 0, html = "";
  ids.forEach((qid, i) => {
    const q = { id: qid, ...(qs[i].data() || {}) }, g = (gs[i] && gs[i].exists()) ? gs[i].data() : {};
    const r = resp[qid]?.resposta, peso = Number(q.peso || 1); max += peso;
    let c = corrigir(q, g, r);
    let obs = "";
    if (corr[qid] && corr[qid].pontos !== undefined) { c = { pontos: Number(corr[qid].pontos), status: Number(corr[qid].pontos) >= peso ? "certa" : Number(corr[qid].pontos) > 0 ? "parcial" : "errada" }; obs = corr[qid].comentario || ""; }
    total += c.pontos;
    const rot = { certa: ["ok", "✅ Certa"], errada: ["erro", "❌ Errada"], parcial: ["aviso", "🟡 Parcial"], revisar: ["aviso", "🟡 Em correção"], em_branco: ["erro", "⬜ Em branco"] }[c.status];
    let sua = r === undefined ? "<i>não respondida</i>" : q.tipo === "alternativa" ? esc(q.alternativas[r]) : `<span class="mono">${esc(r)}</span>`;
    let certa = q.tipo === "alternativa" ? esc(q.alternativas?.[g.correta] ?? "—") : (g.respostasAceitas?.length ? `<span class="mono">${esc(g.respostasAceitas[0])}</span>` : "—");
    html += `<div class="card"><div class="q-topo"><span class="q-numero" style="font-size:1.1em">Questão ${i + 1}</span><span class="tag ${rot[0]}">${rot[1]} · ${c.pontos}/${peso}</span></div>
      <div class="enunciado">${formatarEnunciado(q.enunciado)}</div>
      <p><b>Sua resposta:</b> ${sua}</p>
      ${c.status !== "certa" && certa !== "—" ? `<p><b>Resposta correta:</b> ${certa}</p>` : ""}
      ${g.explicacao ? `<div class="feedback ${c.status === "certa" ? "certa" : "errada"}"><span class="icone" aria-hidden="true">💡</span><div><b>Por quê:</b> ${esc(g.explicacao)}</div></div>` : ""}
      ${obs ? `<p class="pequeno"><b>Comentário do professor:</b> ${esc(obs)}</p>` : ""}</div>`;
  });
  const nota = max ? Math.round((total / max) * 1000) / 10 : 0;
  $("#resResumo").innerHTML = `<p style="font-family:var(--fonte-titulo);font-size:1.4em;font-weight:600;margin:8px 0">Nota: ${nota} / 100 <span class="pequeno">(${total} de ${max} pontos)</span></p>`;
  $("#resLista").innerHTML = html;
}
