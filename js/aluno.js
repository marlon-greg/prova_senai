// Página do aluno: login, lista de provas, prova (uma questão por vez), resultado.
import { db, entrar, sair, aoMudarLogin, identificar, corrigir, embaralhar, sortearAleatorio, esc, $, toast, dataBR, letra }
  from "./common.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, writeBatch, serverTimestamp, increment }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let eu = null;            // { uid, email, nome }
let provaAtual = null;    // { id, ...dados }
let tentativa = null;     // { id, ...dados }
let questoes = {};        // qid -> questão (enunciado, alternativas...)
let respostas = {};       // qid -> { resposta }
let ordemAlternativas = {}; // qid -> índices embaralhados

const telas = ["telaLogin", "telaProvas", "telaInicio", "telaQuestao", "telaFim", "telaResultado", "telaAviso"];
function mostrar(id) { telas.forEach(t => $("#" + t).classList.toggle("oculto", t !== id)); window.scrollTo({ top: 0, behavior: "smooth" }); }

// ---------- fonte maior (acessibilidade) ----------
if (localStorage.getItem("fonteGrande") === "1") document.body.classList.add("grande");
$("#btnFonte").onclick = () => { document.body.classList.toggle("grande"); localStorage.setItem("fonteGrande", document.body.classList.contains("grande") ? "1" : "0"); };

// ---------- login ----------
$("#btnEntrar").onclick = async () => {
  $("#msgLogin").textContent = "";
  try { await entrar(); } catch (e) { $("#msgLogin").textContent = "Não foi possível entrar: " + (e.code || e.message); }
};
$("#btnSair").onclick = () => sair();

aoMudarLogin(async user => {
  if (!user) { eu = null; $("#quem").textContent = ""; $("#btnSair").classList.add("oculto"); mostrar("telaLogin"); return; }
  const id = await identificar(user);
  $("#quem").textContent = id.email; $("#btnSair").classList.remove("oculto");
  if (id.tipo === "bloqueado") {
    $("#avisoTexto").innerHTML = `<h2>Conta não autorizada</h2><p>A conta <b>${esc(id.email)}</b> não é de aluno do SENAI.<br>Entre com o e-mail <b>@${esc(id.dominios.join("</b> ou <b>@"))}</b>.</p>`;
    mostrar("telaAviso"); return;
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
  const [a, b] = await Promise.all([
    getDocs(query(collection(db, "provas"), where("liberada", "==", true))),
    getDocs(query(collection(db, "provas"), where("resultadosLiberados", "==", true)))
  ]);
  const provas = {};
  a.forEach(d => provas[d.id] = { id: d.id, ...d.data() });
  b.forEach(d => provas[d.id] = { id: d.id, ...d.data() });
  const lista = Object.values(provas).sort((x, y) => (y.criadoEm?.seconds || 0) - (x.criadoEm?.seconds || 0));
  if (!lista.length) { box.innerHTML = "<p>Nenhuma prova liberada para você agora.</p>"; return; }
  box.innerHTML = "";
  for (const p of lista) {
    const t = await getDoc(doc(db, "tentativas", `${eu.uid}_${p.id}`));
    const td = t.exists() ? t.data() : null;
    let status, acao;
    if (!td)                    { status = `<span class="tag">não iniciada</span>`; acao = p.liberada ? `<button data-acao="inicio" data-id="${p.id}">Fazer a prova</button>` : `<span class="pequeno">prova encerrada</span>`; }
    else if (!td.finalizadaEm)  { status = `<span class="tag aviso">em andamento (questão ${(td.indiceAtual || 0) + 1} de ${p.nQuestoes})</span>`; acao = p.liberada ? `<button data-acao="continuar" data-id="${p.id}">Continuar</button>` : `<span class="pequeno">prova encerrada</span>`; }
    else                        { status = `<span class="tag ok">finalizada em ${dataBR(td.finalizadaEm)}</span>`; acao = p.resultadosLiberados ? `<button class="sec" data-acao="resultado" data-id="${p.id}">Ver resultado</button>` : `<span class="pequeno">resultado ainda não liberado</span>`; }
    box.insertAdjacentHTML("beforeend", `<div class="card" style="margin:8px 0"><div class="linha"><div style="flex:3"><b>${esc(p.titulo)}</b><br><span class="pequeno">${esc(p.turma || "")} · ${p.nQuestoes} questões</span><br>${status}</div><div style="flex:1;text-align:right">${acao}</div></div></div>`);
  }
  box.querySelectorAll("button[data-acao]").forEach(btn => btn.onclick = () => abrirProva(btn.dataset.id, btn.dataset.acao));
}
$("#btnVoltar1").onclick = $("#btnVoltar2").onclick = $("#btnVoltar3").onclick = listarProvas;

// ---------- abrir prova ----------
async function abrirProva(id, acao) {
  const p = await getDoc(doc(db, "provas", id));
  if (!p.exists()) return toast("Prova não encontrada", "erro");
  provaAtual = { id, ...p.data() };
  const t = await getDoc(doc(db, "tentativas", `${eu.uid}_${id}`));
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
    const ids = []; qs.forEach(d => ids.push(d.id));
    if (ids.length < provaAtual.nQuestoes) throw new Error("O banco tem menos questões do que a prova pede. Avise o professor.");
    const sorteadas = sortearAleatorio(ids, provaAtual.nQuestoes);
    const tid = `${eu.uid}_${provaAtual.id}`;
    await setDoc(doc(db, "tentativas", tid), {
      uid: eu.uid, email: eu.email, nome: eu.nome, provaId: provaAtual.id, bancoId: provaAtual.bancoId,
      questoesIds: sorteadas, iniciadaEm: serverTimestamp(), finalizadaEm: null, indiceAtual: 0, trocasDeAba: 0
    });
    const t = await getDoc(doc(db, "tentativas", tid));
    tentativa = { id: tid, ...t.data() };
    await carregarTentativa();
  } catch (e) { toast("Não foi possível começar: " + (e.code || e.message), "erro"); console.error(e); }
  $("#btnComecar").disabled = false;
};

async function carregarTentativa() {
  questoes = {}; respostas = {};
  const docsQ = await Promise.all(tentativa.questoesIds.map(q => getDoc(doc(db, "bancos", tentativa.bancoId, "questoes", q))));
  docsQ.forEach(d => { if (d.exists()) questoes[d.id] = { id: d.id, ...d.data() }; });
  const rs = await getDocs(collection(db, "tentativas", tentativa.id, "respostas"));
  rs.forEach(d => respostas[d.id] = d.data());
  if (tentativa.finalizadaEm) { mostrar("telaFim"); return; }
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
      area.insertAdjacentHTML("beforeend", `<label class="alt"><input type="radio" name="alt" value="${k}"> <b>${letra(pos)})</b> ${esc(q.alternativas[k])}</label>`);
    });
    area.querySelectorAll(".alt").forEach(l => l.onclick = () => { area.querySelectorAll(".alt").forEach(x => x.classList.remove("sel")); l.classList.add("sel"); });
  } else {
    area.innerHTML = `<textarea id="txtResposta" placeholder="Digite sua resposta aqui. Colar está desativado." spellcheck="false"></textarea>
                      <p class="pequeno">Ctrl+V, botão direito e arrastar texto não funcionam neste campo.</p>`;
    bloquearColar($("#txtResposta"));
  }
  mostrar("telaQuestao");
}

// enunciado: quebra de linha preservada; trechos entre crases viram código
function formatarEnunciado(t) { return esc(t).replace(/`([^`]+)`/g, "<code>$1</code>"); }

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
  if (!confirm("Enviar esta resposta? Depois não dá para alterar.")) return;
  $("#btnEnviar").disabled = true;
  try {
    const lote = writeBatch(db);
    lote.set(doc(db, "tentativas", tentativa.id, "respostas", qid), { resposta, enviadaEm: serverTimestamp() });
    lote.set(doc(db, "marcadores", `${eu.uid}_${qid}`), { uid: eu.uid, qid, provaId: provaAtual.id, criadoEm: serverTimestamp() });
    await lote.commit();
    enviada = true; respostas[qid] = { resposta };
    await mostrarFeedback(qid, q, resposta);
  } catch (e) {
    $("#btnEnviar").disabled = false;
    toast("Não foi possível enviar. Verifique a internet e tente de novo. (" + (e.code || e.message) + ")", "erro"); console.error(e);
  }
};

async function mostrarFeedback(qid, q, resposta) {
  const modo = provaAtual.feedbackImediato || "acerto";   // nenhum | acerto | completo
  const fb = $("#qFeedback");
  if (modo !== "nenhum") {
    try {
      const g = (await getDoc(doc(db, "bancos", tentativa.bancoId, "gabaritos", qid))).data() || {};
      const r = corrigir(q, g, resposta);
      let html = r.status === "certa" ? "✅ <b>Resposta correta.</b>" : r.status === "errada" ? "❌ <b>Resposta incorreta.</b>" : "🟡 <b>Resposta registrada.</b> Vai para a correção do professor.";
      if (modo === "completo") {
        if (q.tipo === "alternativa") html += `<br>Correta: <b>${esc(q.alternativas[g.correta])}</b>`;
        else if (g.respostasAceitas?.length) html += `<br>Resposta esperada: <span class="mono">${esc(g.respostasAceitas[0])}</span>`;
        if (g.explicacao) html += `<br><span class="pequeno">${esc(g.explicacao)}</span>`;
      }
      fb.className = "feedback " + r.status; fb.innerHTML = html; fb.classList.remove("oculto");
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
    const lote = writeBatch(db);
    lote.update(doc(db, "tentativas", tentativa.id), { finalizadaEm: serverTimestamp(), indiceAtual: tentativa.questoesIds.length });
    // garante o marcador de todas as questões (libera a leitura do gabarito no resultado)
    for (const qid of tentativa.questoesIds)
      if (!respostas[qid]) lote.set(doc(db, "marcadores", `${eu.uid}_${qid}`), { uid: eu.uid, qid, provaId: provaAtual.id, criadoEm: serverTimestamp() });
    await lote.commit();
    tentativa.finalizadaEm = new Date();
    mostrar("telaFim");
  } catch (e) { toast("Não foi possível finalizar: " + (e.code || e.message), "erro"); console.error(e); }
}

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
    html += `<div class="card"><div class="linha"><b>Questão ${i + 1}</b><span class="tag ${rot[0]}">${rot[1]} · ${c.pontos}/${peso}</span></div>
      <div class="enunciado">${formatarEnunciado(q.enunciado)}</div>
      <p><b>Sua resposta:</b> ${sua}</p>
      ${c.status !== "certa" && certa !== "—" ? `<p><b>Resposta correta:</b> ${certa}</p>` : ""}
      ${g.explicacao ? `<div class="feedback ${c.status === "certa" ? "certa" : "errada"}"><b>Por quê:</b> ${esc(g.explicacao)}</div>` : ""}
      ${obs ? `<p class="pequeno"><b>Comentário do professor:</b> ${esc(obs)}</p>` : ""}</div>`;
  });
  const nota = max ? Math.round((total / max) * 1000) / 10 : 0;
  $("#resResumo").innerHTML = `<p style="font-size:1.3em"><b>Nota: ${nota} / 100</b> <span class="pequeno">(${total} de ${max} pontos)</span></p>`;
  $("#resLista").innerHTML = html;
}
