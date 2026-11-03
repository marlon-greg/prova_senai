// Página do aluno: login, lista de provas, prova (uma questão por vez ou todas na página), resultado.
import { db, entrar, sair, aoMudarLogin, identificar, corrigir, embaralhar, sortearAleatorio, esc, $, toast, dataBR, letra,
         idTentativaTeste, apagarTentativaTeste, confirmar, traduzirErro, iniciais, fecharModais, temaDe, chaveNome, placar }
  from "./common.js";
import { baixarMaterial } from "./material.js";
import { abrirLeitorPdf } from "./leitor-pdf.js";
import { collection, doc, getDoc, getDocFromServer, getDocs, setDoc, updateDoc, query, where, serverTimestamp, increment, arrayUnion, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let eu = null;            // { uid, email, nome }
let provaAtual = null;    // { id, ...dados }
let tentativa = null;     // { id, ...dados }
let questoes = {};        // qid -> questão (enunciado, alternativas...)
let respostas = {};       // qid -> { resposta, segundos }
let ordemAlternativas = {}; // qid -> índices embaralhados

// ---------- opções da prova ----------
const modoTodas = () => provaAtual?.modoExibicao === "todas";          // todas as questões na mesma página
const trocaAbaPermitida = () => provaAtual?.permitirTrocaAba === true; // sem tela cheia e sem aviso (só conta)
const colarPermitido = () => provaAtual?.permitirColar === true;
const podeVoltar = () => provaAtual?.permitirVoltar === true;          // ir e voltar, alterando as respostas até finalizar
const temConsulta = () => !!(provaAtual?.materialConsultaArquivoId || provaAtual?.materialConsultaUrl);
// código de acesso (o modo teste da equipe não pede)
const pedeCodigo = () => !modoTeste && !!String(provaAtual?.codigoAcesso || "").trim();
const normalizarCodigo = c => String(c || "").toUpperCase().replace(/\s+/g, "");
// limite de saídas (aba/janela ou tela cheia); com troca de aba permitida não há limite
const limiteSaidas = () => trocaAbaPermitida() ? 0 : Math.max(0, Math.round(Number(provaAtual?.maxTrocasDeAba || 0)));
// "perder a questão" só existe no modo uma por vez sem voltar; nos outros a prova é encerrada
const acaoAoExceder = () => !modoTodas() && !podeVoltar() && provaAtual?.acaoAoExceder === "perderQuestao" ? "perderQuestao" : "encerrar";
const textoPena = p => (p.modoExibicao !== "todas" && p.permitirVoltar !== true && p.acaoAoExceder === "perderQuestao") ? "você perde a questão atual" : "a prova é encerrada";

// ---------- modo teste (equipe vê a prova como o aluno: index.html?teste=<provaId>) ----------
const provaTeste = new URLSearchParams(location.search).get("teste");
let modoTeste = false;
// id da tentativa: real = uid_prova · teste = teste_uid_prova
function idTentativa(provaId) { return modoTeste ? idTentativaTeste(eu.uid, provaId) : `${eu.uid}_${provaId}`; }

const telas = ["telaLogin", "telaProvas", "telaInicio", "telaQuestao", "telaFim", "telaResultado", "telaAviso"];
function mostrar(id) {
  telas.forEach(t => $("#" + t).classList.toggle("oculto", t !== id));
  document.body.classList.toggle("em-prova", id === "telaQuestao");   // ativa os bloqueios e avisos da prova
  document.body.classList.toggle("com-consulta", id === "telaQuestao" && temConsulta());
  if (id !== "telaQuestao") { esconderSobreposicao(); $("#painelConsulta").classList.remove("aberto"); }
  if (id !== "telaFim") pararOuvinteFim();
  atualizarBanner();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

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
  // chave do nome da conta Google (vem do token, o mesmo que as regras usam) para o vínculo com a turma
  const tok = await user.getIdTokenResult().catch(() => null);
  eu = { uid: user.uid, email: id.email, nome: id.nome, nomeConta: tok?.claims?.name || "", chave: chaveNome(tok?.claims?.name || "") };
  await listarProvas();
});

// ---------- lista de provas ----------
let provasDaLista = {};   // id -> prova (para saber, no clique, se a prova pede tela cheia)
async function listarProvas() {
  mostrar("telaProvas");
  const box = $("#listaProvas"); box.innerHTML = "<p class='pequeno'>Carregando…</p>";
  // delegação: os botões funcionam assim que aparecem, mesmo com o resto da lista ainda carregando
  box.onclick = e => {
    const btn = e.target.closest("button[data-acao]");
    if (!btn) return;
    if (btn.dataset.acao === "continuar") pedirTelaCheia(provasDaLista[btn.dataset.id]?.permitirTrocaAba === true);   // direto no clique (exigência do navegador)
    abrirProva(btn.dataset.id, btn.dataset.acao);
  };
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
  provasDaLista = Object.fromEntries(lista.map(p => [p.id, p]));
  if (!lista.length) { box.innerHTML = `<div class="vazio"><div class="icone">📭</div><p><b>Nenhuma prova liberada no momento.</b></p><p class="pequeno">Quando o professor liberar, ela aparece aqui. Se a prova já começou na sala, recarregue a página.</p></div>`; return; }
  box.innerHTML = "";
  let mostradas = 0;
  for (const p of lista) {
    const t = await getDoc(doc(db, "tentativas", idTentativa(p.id)));
    const td = t.exists() ? t.data() : null;
    if (!td && !(await alunoNaTurma(p))) continue;   // prova de outra turma: não aparece
    mostradas++;
    const podeFazer = modoTeste || p.liberada, podeVerResultado = modoTeste || p.resultadosLiberados;
    const andamento = p.modoExibicao === "todas" ? `${td?.indiceAtual || 0} de ${p.nQuestoes} enviadas` : `questão ${(td?.indiceAtual || 0) + 1} de ${p.nQuestoes}`;
    let status, acao;
    if (!td)                    { status = `<span class="tag">○ não iniciada</span>`; acao = podeFazer ? `<button data-acao="inicio" data-id="${p.id}">Fazer a prova</button>` : `<span class="pequeno">prova encerrada</span>`; }
    else if (!td.finalizadaEm)  { status = `<span class="tag aviso">◐ em andamento (${andamento})</span>`; acao = podeFazer ? `<button data-acao="continuar" data-id="${p.id}">Continuar</button>` : `<span class="pequeno">prova encerrada</span>`; }
    else                        { status = `<span class="tag ok">✓ finalizada em ${dataBR(td.finalizadaEm)}</span> <span class="tag nota" data-placar="${p.id}">…</span>`; acao = podeVerResultado ? `<button class="sec" data-acao="resultado" data-id="${p.id}">Ver gabarito e resultado</button>` : `<span class="pequeno">gabarito ainda não liberado</span>`; }
    box.insertAdjacentHTML("beforeend", `<div class="prova-item"><div class="info"><b>${esc(p.titulo)}</b><br><span class="pequeno">${esc(p.turma || "")} · ${p.nQuestoes} questões</span><div style="margin-top:4px">${status}</div></div><div class="acao">${acao}</div></div>`);
    if (td?.finalizadaEm) {   // placar sem esperar: a lista não fica travada lendo gabaritos
      const el = box.querySelector(`[data-placar="${p.id}"]`);
      placarDaTentativa({ id: t.id, ...td }).then(r => { el.innerHTML = textoPlacarCurto(r); }).catch(() => { el.textContent = "placar indisponível"; });
    }
  }
  if (!mostradas) box.innerHTML = `<div class="vazio"><div class="icone">📭</div><p><b>Nenhuma prova liberada para você no momento.</b></p><p class="pequeno">Quando o professor liberar uma prova da sua turma, ela aparece aqui. Se a prova já começou na sala, recarregue a página; se continuar sem aparecer, mostre ao professor o nome e o e-mail da sua conta: <b>${esc(eu.nomeConta || "(conta sem nome)")}</b> · <b>${esc(eu.email)}</b>. O nome cadastrado na turma precisa ser igual ao da conta.</p>${avisoVinculo ? `<p class="pequeno erro-texto">${esc(avisoVinculo)}</p>` : ""}</div>`;
}
// turma da prova: sem turma = qualquer aluno; com turma = o e-mail precisa estar na lista
// (o aluno só consegue ler a turma em que está; a proteção de verdade é a regra do create da tentativa)
// Turma cadastrada pelo NOME: se o nome da conta Google bater com um nome ainda sem e-mail,
// o próprio aluno grava o vínculo (nome -> e-mail) e entra na lista. As regras só permitem o próprio nome/e-mail.
const turmasLidas = {};
let avisoVinculo = "";
async function alunoNaTurma(p) {
  if (modoTeste || !p.turmaId) return true;
  if (!(p.turmaId in turmasLidas)) turmasLidas[p.turmaId] = await verificarTurma(p.turmaId);
  return turmasLidas[p.turmaId];
}
async function verificarTurma(turmaId) {
  const meu = String(eu.email || "").toLowerCase();
  let d;
  try { d = await getDoc(doc(db, "turmas", turmaId)); } catch (e) { return false; }   // sem permissão = não está na turma
  if (!d.exists()) return false;
  const t = d.data();
  if ((t.emails || []).includes(meu)) return true;
  if (!eu.chave || !(t.nomesChave || []).includes(eu.chave)) return false;
  const ja = (t.vinculos || {})[eu.chave];
  if (ja && ja !== meu) { avisoVinculo = `O nome "${eu.nomeConta}" da turma ${t.nome || ""} já foi vinculado a outra conta (${ja}). Avise o professor.`; return false; }
  try {
    await updateDoc(d.ref, { [`vinculos.${eu.chave}`]: meu, emails: arrayUnion(meu) });
    return true;
  } catch (e) { console.warn("vínculo com a turma", e); avisoVinculo = "Não foi possível vincular sua conta à turma. " + traduzirErro(e); return false; }
}
$("#btnVoltar1").onclick = $("#btnVoltar2").onclick = $("#btnVoltar3").onclick = listarProvas;
$("#btnImprimir").onclick = () => window.print();

// ---------- abrir prova ----------
// regras mostradas antes de começar: só o que vale para esta prova
function regrasDaProva(p) {
  const r = ["A prova só pode ser feita <b>uma vez</b>. Depois de clicar em Começar, não dá para reiniciar."];
  const voltar = p.permitirVoltar === true;
  if (p.modoExibicao === "todas") r.push(voltar
    ? "Todas as questões aparecem <b>nesta página</b>. Salve cada resposta pelo botão <b>Salvar resposta</b>: dá para alterar e salvar de novo até clicar em <b>Finalizar prova</b>."
    : "Todas as questões aparecem <b>nesta página</b>. Envie cada resposta pelo botão <b>Enviar resposta</b> dela: depois de enviada, ela fica travada. No fim, clique em <b>Finalizar prova</b>.");
  else r.push(voltar
    ? "As questões aparecem <b>uma por vez</b>, mas você pode <b>ir e voltar</b> (← Anterior / Próxima → ou os números no topo) e alterar as respostas até clicar em <b>Finalizar prova</b>. Ao trocar de questão, o que você marcou ou escreveu é salvo sozinho."
    : "As questões aparecem <b>uma por vez</b>. Depois de enviar uma resposta, não é possível voltar.");
  r.push("A ordem das questões e das alternativas é diferente para cada aluno.");
  r.push("No final você vê <b>quantas acertou e a nota</b>. Quais acertou e o gabarito aparecem só quando o professor liberar.");
  if (!p.permitirColar) r.push("<b>Colar texto está desativado</b> nos campos de resposta: digite. As tentativas de colar ficam registradas.");
  if (!p.permitirTrocaAba) r.push("A prova abre em <b>tela cheia</b>. Sair da tela cheia e trocar de aba ou de janela <b>ficam registrados</b> para o professor.");
  if (!p.permitirTrocaAba && Number(p.maxTrocasDeAba) > 0) r.push(`<b>Limite de saídas da prova: ${Number(p.maxTrocasDeAba)}.</b> Trocar de aba/janela ou sair da tela cheia conta como saída. Ao chegar a ${Number(p.maxTrocasDeAba)}, ${textoPena(p)}.`);
  r.push("Copiar e selecionar o enunciado, imprimir e atalhos como Ctrl+C e Ctrl+P ficam desativados durante a prova.");
  if (Number(p.tempoMinutos) > 0) r.push(`<b>Tempo limite: ${Number(p.tempoMinutos)} min.</b> O cronômetro começa ao clicar em Começar; quando zerar, a prova é finalizada com as respostas já enviadas.`);
  if (String(p.codigoAcesso || "").trim() && !modoTeste) r.push("Esta prova pede um <b>código de acesso</b>, informado pelo professor na sala.");
  if (p.materialConsultaArquivoId || p.materialConsultaUrl) r.push(`Consulta permitida: <b>${esc(p.materialConsultaTitulo || "material de consulta")}</b>, aberto ao lado das questões (no celular, pelo botão <b>📖 Consulta</b>).`);
  r.push(`Se a página fechar sem querer, entre de novo: você continua de onde parou${p.modoExibicao === "todas" ? ", com as respostas já enviadas" : ""}.`);
  return r;
}
async function abrirProva(id, acao) {
  const p = await getDoc(doc(db, "provas", id));
  if (!p.exists()) return toast("Prova não encontrada", "erro");
  provaAtual = { id, ...p.data() };
  const t = await getDoc(doc(db, "tentativas", idTentativa(id)));
  tentativa = t.exists() ? { id: t.id, ...t.data() } : null;
  if (acao === "resultado") return verResultado();
  if (!tentativa) {
    const min = Number(provaAtual.tempoMinutos || 0);
    $("#inicioTitulo").textContent = provaAtual.titulo;
    $("#inicioInfo").innerHTML = `<p>${provaAtual.nQuestoes} questões sorteadas do banco · ${esc(provaAtual.turma || "")}</p>` +
      (min > 0 ? `<p><span class="tag aviso">⏱ Tempo limite: ${min} min</span></p>` : "") +
      (temConsulta() ? `<p class="pequeno">📖 Esta prova permite consultar: <b>${esc(provaAtual.materialConsultaTitulo || "material de consulta")}</b>, dentro da própria tela.</p>` : "");
    $("#inicioRegras").innerHTML = regrasDaProva(provaAtual).map(x => `<li>${x}</li>`).join("");
    $("#inicioCodigoBox").classList.toggle("oculto", !pedeCodigo());
    $("#inicioCodigo").value = ""; $("#inicioCodigoErro").textContent = "";
    $("#btnComecar").disabled = pedeCodigo();   // só habilita depois de digitar o código
    mostrar("telaInicio"); return;
  }
  await carregarTentativa();
}

$("#inicioCodigo").oninput = () => {
  const el = $("#inicioCodigo"), v = normalizarCodigo(el.value);
  if (el.value !== v) el.value = v;
  $("#inicioCodigoErro").textContent = "";
  $("#btnComecar").disabled = pedeCodigo() && !v;
};
$("#inicioCodigo").onkeydown = e => { if (e.key === "Enter" && !$("#btnComecar").disabled) $("#btnComecar").click(); };
$("#btnComecar").onclick = async () => {
  const codigo = pedeCodigo() ? normalizarCodigo($("#inicioCodigo").value) : null;
  if (pedeCodigo() && !codigo) return;
  // confere já no navegador para responder na hora; as regras do Firestore conferem de novo ao criar a tentativa
  if (codigo && codigo !== normalizarCodigo(provaAtual.codigoAcesso)) {
    $("#inicioCodigoErro").textContent = "Código incorreto. Confira com o professor e digite de novo."; $("#inicioCodigo").select(); return;
  }
  pedirTelaCheia();   // precisa ser chamado direto no clique, antes de qualquer await
  $("#btnComecar").disabled = true;
  try {
    // sorteia nQuestoes do banco (ids) — cada aluno recebe um conjunto diferente
    // só entram questões dos temas da prova (sem prova.temas = todas; questão sem tema = "Geral")
    const temas = Array.isArray(provaAtual.temas) && provaAtual.temas.length ? new Set(provaAtual.temas) : null;
    const qs = await getDocs(collection(db, "bancos", provaAtual.bancoId, "questoes"));
    const ids = [], diss = [], alt = [];
    qs.forEach(d => {
      if (temas && !temas.has(temaDe(d.data()))) return;
      ids.push(d.id); (d.data().tipo === "dissertativa" ? diss : alt).push(d.id);
    });
    if (ids.length < provaAtual.nQuestoes) throw new Error("O banco não tem questões suficientes nos temas escolhidos. Avise o professor.");
    let sorteadas;
    const nD = Number(provaAtual.nDissertativas || 0);
    if (provaAtual.nAlternativas !== undefined && provaAtual.nAlternativas !== null) {
      // cota fixa: exatamente nAlternativas alternativas + nDissertativas dissertativas
      const nA = Number(provaAtual.nAlternativas || 0);
      if (diss.length < nD || alt.length < nA) throw new Error("O banco não tem questões suficientes de cada tipo nos temas escolhidos. Avise o professor.");
      sorteadas = sortearAleatorio([...sortearAleatorio(diss, nD), ...sortearAleatorio(alt, nA)], nA + nD);
    } else if (nD > 0 && diss.length >= nD && alt.length >= provaAtual.nQuestoes - nD)
      sorteadas = sortearAleatorio([...sortearAleatorio(diss, nD), ...sortearAleatorio(alt, provaAtual.nQuestoes - nD)], provaAtual.nQuestoes);
    else sorteadas = sortearAleatorio(ids, provaAtual.nQuestoes);
    const tid = idTentativa(provaAtual.id);
    const dados = {
      uid: eu.uid, email: eu.email, nome: eu.nome, provaId: provaAtual.id, bancoId: provaAtual.bancoId,
      questoesIds: sorteadas, iniciadaEm: serverTimestamp(), finalizadaEm: null, indiceAtual: 0, trocasDeAba: 0, notaPrevia: null, aguardandoCorrecao: 0,
      saidasTelaCheia: 0, tentativasColar: 0
    };
    if (modoTeste) dados.teste = true;
    if (codigo) dados.codigoInformado = codigo;   // as regras conferem com o código da prova
    try { await setDoc(doc(db, "tentativas", tid), dados); }
    catch (e) {
      if (codigo && e?.code === "permission-denied") throw Object.assign(new Error("Código incorreto. Confira com o professor e digite de novo."), { codigoErrado: true });
      throw e;
    }
    const t = await getDoc(doc(db, "tentativas", tid));
    tentativa = { id: tid, ...t.data() };
    await carregarTentativa();
  } catch (e) {
    sairTelaCheia();
    if (e.codigoErrado) { $("#inicioCodigoErro").textContent = e.message; $("#inicioCodigo").select(); }
    else { toast("Não foi possível começar. " + traduzirErro(e), "erro"); console.error(e); }
  }
  $("#btnComecar").disabled = pedeCodigo() && !normalizarCodigo($("#inicioCodigo").value);
};

async function carregarTentativa() {
  questoes = {}; respostas = {}; tentouEnviar.clear(); erroEnvio = false;
  const docsQ = await Promise.all(tentativa.questoesIds.map(q => getDoc(doc(db, "bancos", tentativa.bancoId, "questoes", q))));
  docsQ.forEach(d => { if (d.exists()) questoes[d.id] = { id: d.id, ...d.data() }; });
  const rs = await getDocs(collection(db, "tentativas", tentativa.id, "respostas"));
  rs.forEach(d => respostas[d.id] = d.data());
  if (tentativa.finalizadaEm) { mostrarFim(); return; }
  if (tempoAcabou()) return finalizar({ tempoEsgotado: true });
  if (modoTodas()) { iniciarCronometro(); mostrarTodas(); return; }
  const total = tentativa.questoesIds.length;
  let i = tentativa.indiceAtual || 0;
  if (podeVoltar()) i = Math.min(Math.max(0, i), total - 1);   // ir e voltar: volta para a questão em que estava
  else {
    // sem voltar: retoma na primeira questão sem resposta (o índice salvo pode ter ficado para trás)
    while (i < total && respostas[tentativa.questoesIds[i]]) i++;
    if (i >= total) return finalizar();
  }
  tentativa.indiceAtual = i;
  iniciarCronometro();
  mostrarQuestao();
}

// =====================================================================
// QUESTÕES — o mesmo cartão e o mesmo envio nos dois modos
// =====================================================================
let enviando = 0;              // gravações em andamento (o fim do tempo espera por elas)
const enviandoQ = new Set();   // questões sendo gravadas agora (evita duplo envio)
let marcoTempo = 0;            // início da contagem dos "segundos" da próxima resposta

// Monta o cartão de uma questão. unica = modo "uma" (mantém os ids btnEnviar/txtResposta/qChars).
function criarCartaoQuestao(qid, i, unica) {
  const q = questoes[qid], card = document.createElement("div");
  card.className = "card questao"; card.dataset.qid = qid;
  if (!unica) card.id = "q_" + qid;
  if (!q) { card.innerHTML = `<p class="pequeno">Questão ${i + 1} indisponível. Avise o professor.</p>`; return card; }
  const tipo = q.tipo === "alternativa" ? "múltipla escolha" : "resposta escrita", colar = colarPermitido(), voltar = podeVoltar();
  card.innerHTML = `${unica ? "" : `<div class="q-topo"><span class="q-numero q-numero-p">Questão ${i + 1}</span><span class="tag">${tipo}</span><span class="tag ok q-enviada oculto">✓ ${voltar ? "salva" : "enviada"}</span></div>`}
    <div class="enunciado">${formatarEnunciado(q.enunciado)}</div>
    <div class="q-area"></div>
    <div class="acoes-questao"><button class="ok grande b-enviar"${unica ? ' id="btnEnviar"' : ""}>${voltar ? "Salvar resposta" : "Enviar resposta"}</button></div>
    <p class="pequeno q-dica">${voltar ? "Você pode alterar e salvar de novo até clicar em Finalizar prova." : "Confira antes de enviar: depois de enviada, a resposta não pode ser alterada."}</p>
    <p class="pequeno q-salva oculto" role="status"></p>
    <div class="q-feedback oculto" role="status"></div>`;
  const area = card.querySelector(".q-area");
  if (q.tipo === "alternativa") {
    // sempre embaralhadas, estável para o aluno (semente uid + qid); o valor gravado é o índice ORIGINAL
    const ordem = embaralhar(q.alternativas.map((_, k) => k), eu.uid + qid);
    ordemAlternativas[qid] = ordem;
    area.innerHTML = ordem.map((k, pos) => `<label class="alt"><input type="radio" name="alt_${qid}" value="${k}"><span class="alt-letra">${letra(pos)}</span><span class="alt-texto">${esc(q.alternativas[k])}</span></label>`).join("");
    // "change" cobre clique e teclado (setas) na escolha da alternativa
    area.querySelectorAll(".alt input").forEach(inp => inp.addEventListener("change", () => {
      area.querySelectorAll(".alt").forEach(x => x.classList.toggle("sel", x.contains(inp)));
      marcarAlterada(card, qid);
    }));
  } else {
    const idTxt = unica ? "txtResposta" : "txt_" + qid;
    area.innerHTML = `<label for="${idTxt}" class="pequeno">Sua resposta</label>
      <textarea id="${idTxt}" placeholder="Digite sua resposta aqui.${colar ? "" : " Colar está desativado."}" spellcheck="false"></textarea>
      <div class="contador"><span class="q-chars"${unica ? ' id="qChars"' : ""}>0</span> caracteres${colar ? "" : " · Ctrl+V, botão direito e arrastar texto não funcionam neste campo."}</div>`;
    const txt = area.querySelector("textarea");
    txt.addEventListener("input", () => { area.querySelector(".q-chars").textContent = txt.value.length; marcarAlterada(card, qid); });
    if (!colar) bloquearColar(txt);
  }
  card.querySelector(".b-enviar").onclick = () => enviarResposta(qid, card);
  if (respostas[qid]) {   // já gravada (ex.: página recarregada)
    preencherCartao(card, qid, respostas[qid].resposta);
    if (voltar && !respostas[qid].perdida) marcarSalva(card);
    else travarCartao(card);
  }
  if (respostas[qid]?.perdida) { const fb = card.querySelector(".q-feedback"); fb.className = "q-feedback feedback perdida"; fb.innerHTML = `<span class="icone" aria-hidden="true">⛔</span><div><b>Questão perdida</b> por sair da prova.</div>`; }
  return card;
}

// coloca a resposta gravada no cartão
function preencherCartao(card, qid, resposta) {
  if (questoes[qid]?.tipo === "alternativa")
    card.querySelectorAll(".alt input").forEach(inp => { inp.checked = resposta !== null && Number(inp.value) === Number(resposta); inp.closest(".alt").classList.toggle("sel", inp.checked); });
  else { const t = card.querySelector("textarea"); if (t) { t.value = resposta ?? ""; card.querySelector(".q-chars").textContent = t.value.length; } }
}
// sem voltar: trava o cartão depois de enviado
function travarCartao(card) {
  card.querySelectorAll(".q-area input, .q-area textarea").forEach(c => c.disabled = true);
  card.querySelector(".b-enviar")?.classList.add("oculto"); card.querySelector(".q-dica")?.classList.add("oculto");
  card.querySelector(".q-enviada")?.classList.remove("oculto");
  card.classList.add("enviada");
}
// ir e voltar: o cartão continua editável; mostra que está salvo
function marcarSalva(card) {
  card.querySelector(".q-enviada")?.classList.remove("oculto");
  const el = card.querySelector(".q-salva"); el.textContent = "✓ Resposta salva."; el.classList.remove("oculto", "erro-texto");
  card.classList.add("enviada");
}
function marcarAlterada(card, qid) {
  if (!podeVoltar() || !respostas[qid]) return;
  const el = card.querySelector(".q-salva");
  if (mudou(card, qid)) { el.textContent = "Alteração ainda não salva."; el.classList.add("erro-texto"); }
  else marcarSalva(card);
}
// valor que está no cartão (null = nada escolhido/escrito)
function valorDoCartao(card, qid) {
  if (questoes[qid]?.tipo === "alternativa") { const m = card.querySelector(".alt input:checked"); return m ? Number(m.value) : null; }
  const v = (card.querySelector("textarea")?.value || "").trim();
  return v || null;
}
// o cartão tem algo diferente do que está gravado?
function mudou(card, qid) {
  const v = valorDoCartao(card, qid);
  return v !== null && v !== (respostas[qid]?.resposta ?? null);
}

// modo "uma": um cartão por vez
function mostrarQuestao() {
  const i = tentativa.indiceAtual, total = tentativa.questoesIds.length, qid = tentativa.questoesIds[i], q = questoes[qid], voltar = podeVoltar();
  $("#qTitulo").textContent = provaAtual.titulo;
  $("#qContador").textContent = `Questão ${i + 1} de ${total}`;
  $("#qTipo").textContent = q?.tipo === "alternativa" ? "múltipla escolha" : "resposta escrita"; $("#qTipo").classList.remove("oculto");
  $("#qBarra").style.width = `${((voltar ? enviadas() : i) / total) * 100}%`;
  // os botões de navegação ficam dentro do cartão: tira do cartão anterior antes de trocar
  $("#qNav").append($("#btnAnterior"), $("#btnProxima"), $("#btnFinalizar"));
  $("#btnAnterior").classList.toggle("oculto", !voltar || i === 0);
  $("#btnProxima").classList.toggle("oculto", !voltar || i >= total - 1);
  $("#btnFinalizar").classList.toggle("oculto", !voltar);
  const card = criarCartaoQuestao(qid, i, true);
  $("#qLista").replaceChildren(card);
  card.querySelector(".acoes-questao").append($("#btnAnterior"), $("#btnProxima"), $("#btnFinalizar"));
  // sem voltar: questão já enviada (ex.: o tempo de mostrar o botão passou) mostra o próximo passo
  if (!voltar && respostas[qid]) (i >= total - 1 ? $("#btnFinalizar") : $("#btnProxima")).classList.remove("oculto");
  desenharFaixa();
  entrarNaTelaDaProva();
}

// modo "todas": todos os cartões em sequência
function mostrarTodas() {
  $("#qTitulo").textContent = provaAtual.titulo; $("#qTipo").classList.add("oculto");
  $("#qNav").append($("#btnAnterior"), $("#btnProxima"), $("#btnFinalizar"));
  $("#btnAnterior").classList.add("oculto"); $("#btnProxima").classList.add("oculto"); $("#btnFinalizar").classList.remove("oculto");
  const cards = tentativa.questoesIds.map((qid, i) => criarCartaoQuestao(qid, i, false));
  $("#qLista").replaceChildren(...cards);
  atualizarResumoTodas();
  entrarNaTelaDaProva();
}
function enviadas() { return tentativa.questoesIds.filter(q => respostas[q]).length; }
function atualizarResumoTodas() {
  const total = tentativa.questoesIds.length, env = enviadas();
  $("#qContador").textContent = `${podeVoltar() ? "Salvas" : "Enviadas"}: ${env} de ${total}`;
  $("#qBarra").style.width = `${(env / total) * 100}%`;
  desenharFaixa();
}
// ir e voltar: números das questões no topo (respondida / pendente / atual)
function desenharFaixa() {
  const box = $("#qFaixa");
  box.classList.toggle("oculto", !podeVoltar());
  if (!podeVoltar()) { box.innerHTML = ""; return; }
  const atual = modoTodas() ? -1 : tentativa.indiceAtual;
  box.innerHTML = tentativa.questoesIds.map((qid, i) =>
    `<button type="button" class="mini ${respostas[qid] ? "respondida" : "pendente"}${i === atual ? " atual" : ""}" data-ir="${i}"
       aria-label="Questão ${i + 1}: ${respostas[qid] ? "respondida" : "sem resposta"}"${i === atual ? ' aria-current="step"' : ""}>${i + 1}</button>`).join("");
  box.querySelectorAll("[data-ir]").forEach(b => b.onclick = () => {
    const i = Number(b.dataset.ir);
    if (modoTodas()) $("#q_" + tentativa.questoesIds[i])?.scrollIntoView({ behavior: "smooth", block: "start" });
    else irPara(i);
  });
}

function entrarNaTelaDaProva() {
  mostrar("telaQuestao");
  prepararConsulta();
  marcoTempo = Date.now();
  // entrou na prova sem tela cheia (recarregou a página, modo teste...): pede para entrar, sem registrar como saída
  if (!trocaAbaPermitida() && suportaTelaCheia() && !document.fullscreenElement) mostrarSobreposicao("entrar");
}

// enunciado: quebra de linha preservada; ```bloco``` (ou `trecho com quebra de linha`) vira bloco de código; `trecho` vira código na linha
function formatarEnunciado(t) {
  return esc(t)
    .replace(/```\w*\n?([\s\S]+?)\n?```/g, '<pre class="codigo">$1</pre>')
    .replace(/`([^`]+)`/g, (_, c) => c.includes("\n") ? `<pre class="codigo">${c}</pre>` : `<code>${c}</code>`);
}

// campo de resposta: colar/arrastar bloqueado, e cada tentativa fica registrada
function bloquearColar(el) {
  const tentouColar = e => { e.preventDefault(); registrar("tentativasColar"); toast("Colar está desativado nesta prova. A tentativa fica registrada.", "erro"); };
  el.addEventListener("paste", tentouColar);
  el.addEventListener("drop", tentouColar);
  el.addEventListener("keydown", e => {
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") || (e.shiftKey && e.key === "Insert")) tentouColar(e);
  });
  el.addEventListener("beforeinput", e => { if (e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop") e.preventDefault(); });
}

// Envia/salva a resposta de uma questão (os dois modos usam esta função).
// silencioso = salvamento automático ao trocar de questão (sem modal nem aviso de "escolha uma alternativa").
// Devolve true se a resposta está gravada (ou não havia nada a gravar).
async function enviarResposta(qid, card, { silencioso = false } = {}) {
  const voltar = podeVoltar();
  if (enviandoQ.has(qid) || tentativa.finalizadaEm) return false;
  if (!voltar && respostas[qid]) return true;
  const q = questoes[qid], i = tentativa.questoesIds.indexOf(qid);
  if (!q) return true;
  const resposta = valorDoCartao(card, qid);
  if (resposta === null) {
    if (silencioso) return true;
    toast(q.tipo === "alternativa" ? "Escolha uma alternativa." : "Escreva a resposta antes de enviar.", "erro"); return false;
  }
  if (voltar && !mudou(card, qid)) { if (!silencioso) toast("Esta resposta já está salva.", "ok"); return true; }
  if (!voltar) {
    const pergunta = modoTodas() ? `Enviar a resposta da questão ${i + 1}? Depois não dá para alterar.` : "Enviar esta resposta? Depois não dá para alterar.";
    if (!(await confirmar(pergunta, { titulo: "Enviar resposta", ok: "Enviar" }))) return false;
    if (respostas[qid] || enviandoQ.has(qid) || tentativa.finalizadaEm) return !!respostas[qid];   // o tempo pode ter acabado com o modal aberto
  }
  const segundos = (respostas[qid]?.segundos || 0) + Math.max(0, Math.round((Date.now() - marcoTempo) / 1000));
  const btn = card.querySelector(".b-enviar"), campos = [...card.querySelectorAll(".q-area input, .q-area textarea")];
  enviandoQ.add(qid); enviando++; btn.disabled = true; btn.textContent = voltar ? "Salvando…" : "Enviando…";
  if (!voltar) campos.forEach(c => c.disabled = true);
  try {
    const gravada = await gravarResposta(qid, resposta, segundos);
    const final = gravada ? gravada.resposta : resposta;   // sem voltar: se uma tentativa anterior já tinha chegado ao servidor, vale ela
    respostas[qid] = { resposta: final, segundos: gravada ? gravada.segundos : segundos };
    marcoTempo = Date.now();
    erroEnvio = false; atualizarBanner();
    preencherCartao(card, qid, final);
    if (voltar) marcarSalva(card); else travarCartao(card);
    if (modoTodas()) {
      atualizarResumoTodas();
      tentativa.indiceAtual = enviadas();   // na lista de provas aparece "X de N enviadas"
      updateDoc(doc(db, "tentativas", tentativa.id), { indiceAtual: tentativa.indiceAtual }).catch(() => {});
    } else if (voltar) {
      desenharFaixa();
      $("#qBarra").style.width = `${(enviadas() / tentativa.questoesIds.length) * 100}%`;
    } else {
      const ultima = tentativa.indiceAtual >= tentativa.questoesIds.length - 1;
      (ultima ? $("#btnFinalizar") : $("#btnProxima")).classList.remove("oculto");
    }
    return true;
  } catch (e) {
    console.error(e);
    // a resposta digitada continua na tela; o aluno tenta de novo
    erroEnvio = true; atualizarBanner();
    campos.forEach(c => c.disabled = false);
    toast(`Sua resposta${silencioso ? ` da questão ${i + 1}` : ""} NÃO foi ${voltar ? "salva" : "enviada"}. ` + traduzirErro(e), "erro");
    return false;
  } finally {
    enviandoQ.delete(qid); enviando--; btn.disabled = false; btn.textContent = voltar ? "Salvar resposta" : "Enviar resposta";
  }
}

// Grava a resposta. Os marcadores (que liberam o gabarito) só são gravados depois de finalizar.
// Sem voltar: se uma tentativa anterior desta questão deu erro/tempo esgotado, ela pode ter chegado ao servidor
// mesmo assim: confere no servidor antes de gravar de novo (resposta não pode ser sobrescrita).
// Ir e voltar: a 1ª gravação cria (enviadaEm); as seguintes atualizam resposta, segundos e atualizadaEm.
const tentouEnviar = new Set();
async function gravarResposta(qid, resposta, segundos) {
  if (!navigator.onLine) throw Object.assign(new Error("Sem conexão com a internet."), { code: "unavailable" });
  const ref = doc(db, "tentativas", tentativa.id, "respostas", qid);
  let existe = !!respostas[qid];
  if (!existe && tentouEnviar.has(qid)) {
    const ja = await getDocFromServer(ref).catch(() => null);
    if (ja && ja.exists()) { if (!podeVoltar()) return ja.data(); existe = true; }
  }
  tentouEnviar.add(qid);
  const gravar = existe ? updateDoc(ref, { resposta, segundos, atualizadaEm: serverTimestamp() })
                        : setDoc(ref, { resposta, enviadaEm: serverTimestamp(), segundos });
  await comLimiteDeTempo(gravar, 15000);   // sem internet o SDK espera para sempre: limita a 15 s
  return null;
}
function comLimiteDeTempo(promessa, ms) {
  let h;
  const limite = new Promise((_, rej) => { h = setTimeout(() => rej(Object.assign(new Error("O servidor não respondeu."), { code: "deadline-exceeded" })), ms); });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(h));
}

// ir e voltar (modo "uma"): salva a questão atual se mudou e vai para a questão i
async function irPara(i) {
  const total = tentativa.questoesIds.length;
  if (i < 0 || i >= total || i === tentativa.indiceAtual) return;
  const card = $("#qLista .questao");
  if (card && !(await enviarResposta(tentativa.questoesIds[tentativa.indiceAtual], card, { silencioso: true }))) return;   // não salvou: fica
  tentativa.indiceAtual = i;
  updateDoc(doc(db, "tentativas", tentativa.id), { indiceAtual: i }).catch(() => {});
  mostrarQuestao();
}
$("#btnAnterior").onclick = () => irPara(tentativa.indiceAtual - 1);
$("#btnProxima").onclick = async () => {
  if (podeVoltar()) return irPara(tentativa.indiceAtual + 1);
  tentativa.indiceAtual++;
  updateDoc(doc(db, "tentativas", tentativa.id), { indiceAtual: tentativa.indiceAtual }).catch(() => {});
  mostrarQuestao();
};
// "2, 5 e 7"
const listaHumana = ns => ns.length > 1 ? ns.slice(0, -1).join(", ") + " e " + ns[ns.length - 1] : String(ns[0]);
$("#btnFinalizar").onclick = async () => {
  if (podeVoltar()) {
    // salva o que estiver alterado na tela antes de conferir as pendentes
    for (const card of document.querySelectorAll("#qLista .questao"))
      if (!(await enviarResposta(card.dataset.qid, card, { silencioso: true }))) return;
  }
  if (modoTodas() || podeVoltar()) {
    const faltam = tentativa.questoesIds.map((q, i) => respostas[q] ? null : i + 1).filter(Boolean);
    const verbo = podeVoltar() ? ["foi salva", "foram salvas", "salva"] : ["foi enviada", "foram enviadas", "enviada"];
    const ok = faltam.length
      ? await confirmar(`${faltam.length === 1 ? "A questão" : "As questões"} ${listaHumana(faltam)} ainda não ${faltam.length === 1 ? verbo[0] : verbo[1]}. Resposta não ${verbo[2]} não conta.\n\nFinalizar mesmo assim? As que faltam ficam em branco.`,
          { titulo: "Questões sem resposta", ok: "Finalizar mesmo assim", cancelar: "Voltar para a prova", perigo: true })
      : !podeVoltar() || await confirmar("Finalizar a prova? Depois disso as respostas não podem mais ser alteradas.", { titulo: "Finalizar prova", ok: "Finalizar", cancelar: "Voltar para a prova" });
    if (!ok) {
      if (faltam.length) { if (modoTodas()) $("#q_" + tentativa.questoesIds[faltam[0] - 1])?.scrollIntoView({ behavior: "smooth", block: "start" }); else irPara(faltam[0] - 1); }
      return;
    }
  }
  finalizar();
};

let finalizando = false;
async function finalizar(opc = {}) {
  if (finalizando || !tentativa || tentativa.finalizadaEm) return;
  finalizando = true;
  try {
    const fim = { finalizadaEm: serverTimestamp(), indiceAtual: tentativa.questoesIds.length };
    if (opc.encerradaPor) fim.encerradaPor = opc.encerradaPor;   // ex.: "trocasDeAba" (limite de saídas)
    if (tentativa.iniciadaEm?.toMillis) fim.tempoTotalSegundos = Math.max(0, Math.round((Date.now() - tentativa.iniciadaEm.toMillis()) / 1000));
    await comLimiteDeTempo(updateDoc(doc(db, "tentativas", tentativa.id), fim), 20000);
    tentativa.finalizadaEm = new Date();
    tentativa.tempoTotalSegundos = fim.tempoTotalSegundos; tentativa.tempoEsgotado = !!opc.tempoEsgotado;
    if (opc.encerradaPor) tentativa.encerradaPor = opc.encerradaPor;
    tentativa.avisoPerda = opc.avisoPerda || null;
    pararCronometro();
    sairTelaCheia();
    await gravarMarcadores();
    mostrarFim();
  } catch (e) { toast("Não foi possível finalizar. " + traduzirErro(e), "erro"); console.error(e); }
  finally { finalizando = false; }
}
// marcadores de todas as questões (liberam a leitura do gabarito para o placar).
// Um por gravação: marcador que já existe (de uma tentativa de antes) dá erro sozinho, sem derrubar os outros.
async function gravarMarcadores() {
  if (modoTeste || !tentativa) return;   // a equipe já lê os gabaritos
  await Promise.allSettled(tentativa.questoesIds.map(qid =>
    setDoc(doc(db, "marcadores", `${eu.uid}_${qid}`), { uid: eu.uid, qid, provaId: tentativa.provaId, criadoEm: serverTimestamp() })));
}

// ---------- placar (o aluno vê só quantas acertou e a nota) ----------
// O painel do professor grava o placar oficial na tentativa (com as correções da IA/manuais);
// enquanto isso não acontece, calcula aqui com o gabarito (liberado pelos marcadores depois de finalizar).
async function placarDaTentativa(t) {
  if (typeof t.acertos === "number") return { acertos: t.acertos, totalQuestoes: t.totalQuestoes, nota: t.nota ?? t.notaPrevia, pendentes: t.aguardandoCorrecao || 0 };
  const ids = t.questoesIds, banco = t.bancoId;
  const [qs, gs, rs] = await Promise.all([
    Promise.all(ids.map(q => questoes[q] && tentativa?.id === t.id ? { data: () => questoes[q] } : getDoc(doc(db, "bancos", banco, "questoes", q)))),
    Promise.all(ids.map(q => getDoc(doc(db, "bancos", banco, "gabaritos", q)).catch(() => null))),
    getDocs(collection(db, "tentativas", t.id, "respostas"))
  ]);
  const resp = {}; rs.forEach(d => resp[d.id] = d.data());
  const itens = ids.map((qid, i) => {
    const q = qs[i]?.data?.() || { peso: 1 }, peso = Number(q.peso || 1);
    if (!gs[i]?.exists?.()) return { pontos: 0, peso, status: resp[qid] ? "revisar" : "em_branco" };   // sem gabarito legível: conta como em correção
    return { peso, ...corrigir(q, gs[i].data(), resp[qid]?.resposta ?? undefined, resp[qid]?.perdida === true) };
  });
  const p = placar(itens);
  return { acertos: p.acertos, totalQuestoes: p.totalQuestoes, nota: t.nota ?? p.notaPrevia, pendentes: p.aguardandoCorrecao };
}
function textoPlacarCurto(r) {
  return `acertou <b>${r.acertos}</b> de ${r.totalQuestoes} · nota <b>${r.nota}</b>${r.pendentes ? ` <span class="pequeno">(${r.pendentes} em correção)</span>` : ""}`;
}

let ouvinteFim = null, desenhoFim = 0;
function pararOuvinteFim() { if (ouvinteFim) { ouvinteFim(); ouvinteFim = null; } }
function mostrarFim() {
  pararCronometro();
  mostrar("telaFim");
  $("#fimNota").innerHTML = "";
  desenharFim();
  // o painel do professor grava o placar na tentativa quando corrige: a tela troca os números sozinha
  pararOuvinteFim();
  const id = tentativa.id;
  ouvinteFim = onSnapshot(doc(db, "tentativas", id), d => {
    if (!d.exists() || tentativa?.id !== id) return;
    const novo = d.data();
    if (["acertos", "notaPrevia", "aguardandoCorrecao", "nota"].some(k => novo[k] !== tentativa[k])) { Object.assign(tentativa, novo); desenharFim(); }
  }, e => console.warn("placar ao vivo parou", e));
}
async function desenharFim() {
  const n = ++desenhoFim;
  const avisos = (tentativa.encerradaPor === "trocasDeAba" ? `<div class="aviso-box erro">⛔ <b>Prova encerrada: limite de saídas da prova atingido.</b> As questões não enviadas valem zero.</div>` : "") +
    (tentativa.avisoPerda ? `<div class="aviso-box erro">⛔ ${esc(tentativa.avisoPerda)}</div>` : "") +
    (tentativa.tempoEsgotado ? `<div class="aviso-box">⏰ <b>O tempo acabou.</b> A prova foi finalizada com as respostas já enviadas.</div>` : "");
  if (!$("#fimNota").innerHTML) $("#fimNota").innerHTML = avisos + `<p class="pequeno">Calculando o resultado…</p>`;
  const liberado = modoTeste || provaAtual?.resultadosLiberados === true;
  let r;
  try { r = await placarDaTentativa(tentativa); } catch (e) { console.warn("placar", e); r = null; }
  if (n !== desenhoFim) return;   // outro desenho começou depois deste
  $("#fimNota").innerHTML = avisos + (r ? `
    <p class="placar">Você acertou <b>${r.acertos}</b> de <b>${r.totalQuestoes}</b></p>
    <p class="placar-nota">Nota: <b>${r.nota}</b> / 100</p>
    ${r.pendentes ? `<p class="aviso-box">✍ ${r.pendentes === 1 ? "1 resposta escrita ainda vai ser corrigida" : `${r.pendentes} respostas escritas ainda vão ser corrigidas`}; o total pode mudar. Esta tela atualiza sozinha.</p>` : ""}` : `<p class="pequeno">Não foi possível calcular o resultado agora. Volte para a lista de provas e abra de novo.</p>`) +
    (liberado ? "" : `<p class="pequeno">Quais você acertou e o gabarito aparecem quando o professor liberar.</p>`);
  $("#btnVerResultadoTeste").classList.toggle("oculto", !liberado);
}

$("#btnVerResultadoTeste").onclick = () => verResultado();

$("#btnReiniciarTeste").onclick = async () => {
  if (!modoTeste || !(await confirmar("Apagar a sua tentativa de teste e recomeçar do zero?", { titulo: "Reiniciar teste", ok: "Reiniciar", perigo: true }))) return;
  $("#btnReiniciarTeste").disabled = true;
  try {
    pararCronometro(); sairTelaCheia();
    tentativa = null;   // antes de apagar: assim a saída da tela cheia não é registrada
    await apagarTentativaTeste(eu.uid, provaTeste);
    await abrirProva(provaTeste, "inicio");
    toast("Teste reiniciado.", "ok");
  } catch (e) { toast("Não foi possível reiniciar o teste. " + traduzirErro(e), "erro"); console.error(e); }
  $("#btnReiniciarTeste").disabled = false;
};

// =====================================================================
// MATERIAL DE CONSULTA (coluna à direita no computador, gaveta no celular)
// =====================================================================
// Dois tipos: PDF enviado ao sistema (leitor próprio, dentro da página) ou link externo (iframe).
let consultaUrlAtual = null, consultaTimer = null, leitorAtual = null, leitorArquivoId = null;
function prepararConsulta() {
  const tem = temConsulta(), fr = $("#consultaFrame");
  $("#provaLayout").classList.toggle("com-consulta", tem);
  $("#painelConsulta").classList.toggle("oculto", !tem); $("#btnConsulta").classList.toggle("oculto", !tem);
  const arquivo = tem ? provaAtual.materialConsultaArquivoId || "" : "";
  if (!arquivo && leitorAtual) { leitorAtual.destruir(); leitorAtual = null; leitorArquivoId = null; }
  if (!tem || arquivo) { if (consultaUrlAtual) { fr.removeAttribute("src"); consultaUrlAtual = null; } }
  if (!tem) return;
  $("#consultaTitulo").textContent = provaAtual.materialConsultaTitulo || "material de consulta";
  fr.classList.toggle("oculto", !!arquivo); $("#consultaLeitor").classList.toggle("oculto", !arquivo);
  if (arquivo) { if (leitorArquivoId !== arquivo) carregarArquivoConsulta(arquivo); return; }   // não recarrega a cada questão
  if (consultaUrlAtual !== provaAtual.materialConsultaUrl) carregarConsulta(provaAtual.materialConsultaUrl);
}
async function carregarArquivoConsulta(id) {
  leitorArquivoId = id;
  const box = $("#consultaLeitor"), erro = $("#consultaErro");
  erro.classList.add("oculto");
  if (leitorAtual) { leitorAtual.destruir(); leitorAtual = null; }
  box.innerHTML = `<p class="pequeno leitor-carregando">Carregando o material…</p>`;
  try {
    const { bytes } = await baixarMaterial(id);
    if (leitorArquivoId !== id) return;   // trocou de prova enquanto carregava
    const leitor = await abrirLeitorPdf(box, bytes);
    if (leitorArquivoId !== id) { leitor.destruir(); return; }
    leitorAtual = leitor;
  } catch (e) {
    console.warn("material de consulta", e);
    if (leitorArquivoId !== id) return;
    leitorArquivoId = null; box.innerHTML = "";
    $("#consultaErroMsg").textContent = "Não foi possível carregar o material; avise o professor. " + traduzirErro(e);
    erro.classList.remove("oculto");
  }
}
function carregarConsulta(url) {
  consultaUrlAtual = url; clearTimeout(consultaTimer);
  const fr = $("#consultaFrame"), erro = $("#consultaErro");
  $("#consultaErroMsg").textContent = "Não foi possível carregar o material; avise o professor.";
  erro.classList.add("oculto");
  if (!/^https:\/\//.test(url)) { fr.removeAttribute("src"); erro.classList.remove("oculto"); return; }
  let carregou = false;
  fr.onload = () => { carregou = true; clearTimeout(consultaTimer); erro.classList.add("oculto"); };
  // o navegador não avisa quando um site de fora recusa abrir no iframe; se não carregar em 15 s, avisa
  consultaTimer = setTimeout(() => { if (!carregou) erro.classList.remove("oculto"); }, 15000);
  fr.src = url;
}
$("#btnRecarregarConsulta").onclick = () => provaAtual.materialConsultaArquivoId ? carregarArquivoConsulta(provaAtual.materialConsultaArquivoId) : carregarConsulta(provaAtual.materialConsultaUrl);
$("#btnConsulta").onclick = () => $("#painelConsulta").classList.toggle("aberto");
$("#btnFecharConsulta").onclick = () => $("#painelConsulta").classList.remove("aberto");

// =====================================================================
// ANTIFRAUDE (só durante a prova, na telaQuestao) — tudo fica registrado na tentativa
// =====================================================================
function emProvaAtiva() { return !!(tentativa && !tentativa.finalizadaEm && document.body.classList.contains("em-prova")); }

// incrementa um contador da tentativa (trocasDeAba, saidasTelaCheia, tentativasColar)
function registrar(campo) {
  if (!tentativa || tentativa.finalizadaEm) return;
  tentativa[campo] = (tentativa[campo] || 0) + 1;
  updateDoc(doc(db, "tentativas", tentativa.id), { [campo]: increment(1) }).catch(e => console.warn("não registrou " + campo, e));
}

// ---------- tela cheia (não é pedida quando a prova permite trocar de aba) ----------
function suportaTelaCheia() { return !!(document.documentElement.requestFullscreen && document.fullscreenEnabled); }
function pedirTelaCheia(permitida = trocaAbaPermitida()) {
  if (!permitida && suportaTelaCheia() && !document.fullscreenElement)
    document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
}
function sairTelaCheia() { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) { if (!sobreposicaoFixa) esconderSobreposicao(); return; }
  if (!emProvaAtiva() || trocaAbaPermitida()) return;
  registrar("saidasTelaCheia");                   // só registro
  const punido = registrarSaida();                // conta para o limite
  if (!punido && emProvaAtiva()) mostrarSobreposicao("telaCheia");
});

// ---------- limite de saídas da prova (maxTrocasDeAba) ----------
// uma "saída" = trocar de aba/janela ou sair da tela cheia; um único contador (trocasDeAba) para a punição
let ultimaSaida = 0;
function registrarSaida() {
  if (!emProvaAtiva()) return false;
  const agora = Date.now();
  if (agora - ultimaSaida < 1000) return false;   // o mesmo movimento dispara mais de um evento (ex.: trocar de aba em tela cheia)
  ultimaSaida = agora;
  registrar("trocasDeAba");
  const lim = limiteSaidas();
  if (lim > 0 && (tentativa.trocasDeAba || 0) >= lim) { aplicarPunicao(); return true; }
  return false;
}
const esperarMs = ms => new Promise(res => setTimeout(res, ms));
let punindo = false, avisoPendente = null;
async function aplicarPunicao() {
  if (punindo || !tentativa || tentativa.finalizadaEm) return;
  punindo = true;
  try {
    fecharModais();
    while (enviando > 0) await esperarMs(200);   // deixa terminar uma resposta que já estava sendo enviada
    if (tentativa.finalizadaEm) return;
    if (acaoAoExceder() === "encerrar") await finalizar({ encerradaPor: "trocasDeAba" });
    else await perderQuestao();
  } finally { punindo = false; }
}
// perde a questão atual (ou a próxima, se a atual já foi enviada), zera o contador e avança
async function perderQuestao() {
  const ids = tentativa.questoesIds, total = ids.length, ref = doc(db, "tentativas", tentativa.id);
  let i = tentativa.indiceAtual || 0;
  while (i < total && respostas[ids[i]]) i++;
  const n = tentativa.trocasDeAba || 0;
  tentativa.trocasDeAba = 0; tentativa.trocasDeAbaTotal = (tentativa.trocasDeAbaTotal || 0) + n;
  updateDoc(ref, { trocasDeAba: 0, trocasDeAbaTotal: increment(n) }).catch(e => console.warn("não zerou o contador", e));
  if (i >= total) { await finalizar(); return; }
  const qid = ids[i], segundos = Math.max(0, Math.round((Date.now() - marcoTempo) / 1000));
  respostas[qid] = { resposta: null, perdida: true, segundos }; tentouEnviar.add(qid);
  setDoc(doc(db, "tentativas", tentativa.id, "respostas", qid), { resposta: null, perdida: true, enviadaEm: serverTimestamp(), segundos })
    .catch(e => console.warn("não gravou a questão perdida", e));   // sem esperar: sem internet, o SDK grava quando ela voltar
  const aviso = `Você perdeu a questão ${i + 1} por sair da prova.`;
  if (i >= total - 1) { await finalizar({ avisoPerda: aviso }); return; }   // era a última: finaliza
  tentativa.indiceAtual = i + 1;
  updateDoc(ref, { indiceAtual: tentativa.indiceAtual }).catch(() => {});
  mostrarQuestao();
  if (foraDaProva || document.hidden) avisoPendente = aviso;   // mostra quando o aluno voltar
  else mostrarSobreposicao("perdeu", aviso);
}

// ---------- sobreposição de aviso ----------
const AVISOS = {
  entrar:    ["Prova em tela cheia", "Esta prova é feita em tela cheia. Sair da tela cheia, trocar de aba ou de janela e tentar colar fica registrado para o professor.", "Entrar em tela cheia"],
  telaCheia: ["Você saiu da tela cheia", "Isso fica registrado para o professor. Clique para voltar.", "Voltar para a prova"],
  aba:       ["Você saiu da página da prova", "A troca de aba ou de janela fica registrada para o professor. Clique para voltar.", "Voltar para a prova"]
};
// "Saídas da prova: 2 de 3. Na próxima, a prova é encerrada."
function textoPlacar() {
  const lim = limiteSaidas();
  if (!lim || !tentativa) return "";
  const n = Math.min(tentativa.trocasDeAba || 0, lim), pena = acaoAoExceder() === "encerrar" ? "a prova é encerrada" : "você perde a questão atual";
  return `Saídas da prova: ${n} de ${lim}. ${n >= lim - 1 ? "Na próxima" : `Ao chegar a ${lim}`}, ${pena}.`;
}
let sobreposicaoFixa = false;   // aviso de questão perdida: só fecha com o clique do aluno
function mostrarSobreposicao(tipo, texto = null) {
  const [titulo, txt, botao] = tipo === "perdeu" ? ["⛔ Questão perdida", texto, "Continuar na próxima questão"] : AVISOS[tipo];
  sobreposicaoFixa = tipo === "perdeu";
  $("#sobreTitulo").textContent = titulo; $("#sobreTexto").textContent = txt; $("#btnVoltarProva").textContent = botao;
  const placar = textoPlacar();
  $("#sobrePlacar").textContent = placar; $("#sobrePlacar").classList.toggle("oculto", !placar);
  $("#sobreposicao").classList.remove("oculto");
  $("#btnVoltarProva").focus();
}
function esconderSobreposicao() { $("#sobreposicao").classList.add("oculto"); sobreposicaoFixa = false; }
$("#btnVoltarProva").onclick = () => { pedirTelaCheia(); esconderSobreposicao(); };

// ---------- troca de aba / janela (contada uma vez por saída; com troca permitida, só conta) ----------
let foraDaProva = false;
const focoNoMaterial = () => document.activeElement === $("#consultaFrame");
function contarSaida() { if (!emProvaAtiva() || foraDaProva) return; foraDaProva = true; registrarSaida(); }
function saiuDaProva(e) {
  if (!emProvaAtiva() || foraDaProva) return;
  // clicar dentro do material de consulta tira o foco da página, mas não é troca de aba
  if (e?.type === "blur") {
    setTimeout(() => {
      if (focoNoMaterial() && !document.hidden) return;
      contarSaida();
      if (document.hasFocus() && !document.hidden) voltouParaProva();   // o foco já voltou antes desta conferência
    }, 0);
    return;
  }
  contarSaida();
}
function voltouParaProva() {
  if (!foraDaProva) return;
  foraDaProva = false;
  if (!emProvaAtiva() || trocaAbaPermitida()) return;
  if (avisoPendente) { mostrarSobreposicao("perdeu", avisoPendente); avisoPendente = null; }   // perdeu a questão enquanto estava fora
  else if (!punindo) mostrarSobreposicao("aba");
}
document.addEventListener("visibilitychange", () => document.hidden ? saiuDaProva() : voltouParaProva());
window.addEventListener("blur", saiuDaProva);
window.addEventListener("focus", voltouParaProva);
// com o foco dentro do material, a janela não recebe outro "blur" se o aluno trocar de janela: confere o foco a cada segundo
setInterval(() => {
  if (!emProvaAtiva() || !temConsulta()) return;
  if (!document.hasFocus()) contarSaida();
  else if (foraDaProva && focoNoMaterial()) voltouParaProva();
}, 1000);

// ---------- bloqueios na área da questão ----------
["copy", "cut", "contextmenu", "dragstart", "selectstart"].forEach(ev => $("#telaQuestao").addEventListener(ev, e => {
  const el = e.target.nodeType === 1 ? e.target : e.target.parentElement;
  if (ev === "selectstart" && el?.closest("textarea")) return;   // no campo de resposta o aluno pode selecionar o próprio texto
  if (ev === "contextmenu" && colarPermitido() && el?.closest("textarea")) return;   // colar permitido: botão direito → Colar
  e.preventDefault();
}));
document.addEventListener("keydown", e => {
  if (!emProvaAtiva()) return;
  const k = (e.key || "").toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (e.key === "F12" || (ctrl && ["c", "a", "p", "s", "u"].includes(k)) || (ctrl && e.shiftKey && ["i", "j", "c"].includes(k))) {
    e.preventDefault(); e.stopPropagation();
    toast("Este atalho está desativado durante a prova.", "erro");
  }
}, true);

// ---------- cronômetro (prova com tempoMinutos > 0) ----------
let relogio = null;
function fimDoTempo() {
  const min = Number(provaAtual?.tempoMinutos || 0), ini = tentativa?.iniciadaEm;
  return min > 0 && ini?.toMillis ? ini.toMillis() + min * 60000 : null;
}
function tempoAcabou() { const f = fimDoTempo(); return f !== null && Date.now() >= f; }
function iniciarCronometro() {
  pararCronometro();
  const fim = fimDoTempo(), el = $("#qTimer");
  if (fim === null) { el.classList.add("oculto"); return; }
  el.classList.remove("oculto");
  let avisou = fim - Date.now() <= 60000;   // não avisa "falta 1 minuto" se já entrou com menos que isso
  const tic = () => {
    const resta = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
    el.textContent = `⏱ ${String(Math.floor(resta / 60)).padStart(2, "0")}:${String(resta % 60).padStart(2, "0")}`;
    el.classList.toggle("alerta", resta <= 60);
    if (resta <= 60 && !avisou) { avisou = true; toast("Falta 1 minuto para o fim da prova.", "erro"); }
    if (resta <= 0) { pararCronometro(); tempoEsgotado(); }
  };
  tic(); relogio = setInterval(tic, 1000);
}
function pararCronometro() { clearInterval(relogio); relogio = null; $("#qTimer").classList.add("oculto"); }
async function tempoEsgotado() {
  if (!tentativa || tentativa.finalizadaEm) return;
  fecharModais();
  while (enviando > 0) await new Promise(r => setTimeout(r, 200));   // deixa terminar respostas que já estavam sendo enviadas
  await finalizar({ tempoEsgotado: true });
}

// ---------- conexão ----------
let erroEnvio = false;   // a última tentativa de enviar falhou
function atualizarBanner() {
  const b = $("#bannerConexao");
  const naProva = tentativa && !tentativa.finalizadaEm && !$("#telaQuestao").classList.contains("oculto");
  let msg = "";
  if (naProva && erroEnvio) msg = navigator.onLine ? "Sua resposta NÃO foi enviada. A conexão voltou: clique em Enviar resposta de novo."
                                                   : "Sem conexão: sua resposta NÃO foi enviada, tente de novo.";
  else if (naProva && !navigator.onLine) msg = "Sem conexão com a internet. Não feche nem recarregue a página: quando a conexão voltar, continue normalmente.";
  b.textContent = msg; b.classList.toggle("oculto", !msg);
}
window.addEventListener("offline", atualizarBanner);
window.addEventListener("online", atualizarBanner);

// avisa antes de fechar/recarregar a aba no meio da prova
window.addEventListener("beforeunload", e => { if (emProvaAtiva()) { e.preventDefault(); e.returnValue = ""; } });

// ---------- resultado ----------
async function verResultado() {
  if (!tentativa) return toast("Você não fez esta prova.", "erro");
  if (!modoTeste && provaAtual.resultadosLiberados !== true) return toast("O gabarito desta prova ainda não foi liberado.", "erro");
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
  let total = 0, max = 0, certas = 0, html = "";
  ids.forEach((qid, i) => {
    const q = { id: qid, ...(qs[i].data() || {}) }, g = (gs[i] && gs[i].exists()) ? gs[i].data() : {};
    const r = resp[qid]?.resposta ?? undefined, perdida = resp[qid]?.perdida === true, peso = Number(q.peso || 1); max += peso;
    let c = corrigir(q, g, r, perdida);
    let obs = "";
    if (!perdida && corr[qid] && corr[qid].pontos !== undefined) { c = { pontos: Number(corr[qid].pontos), status: Number(corr[qid].pontos) >= peso ? "certa" : Number(corr[qid].pontos) > 0 ? "parcial" : "errada" }; obs = corr[qid].comentario || ""; }
    total += c.pontos; if (c.status === "certa") certas++;
    const rot = { certa: ["ok", "✅ Certa"], errada: ["erro", "❌ Errada"], parcial: ["aviso", "🟡 Parcial"], revisar: ["aviso", "🟡 Em correção"], em_branco: ["erro", "⬜ Em branco"], perdida: ["erro", "⛔ Perdida (saiu da prova)"] }[c.status];
    let sua = perdida ? "<i>perdida por sair da prova</i>" : r === undefined ? "<i>não respondida</i>" : q.tipo === "alternativa" ? esc(q.alternativas[r]) : `<span class="mono">${esc(r)}</span>`;
    let certa = q.tipo === "alternativa" ? esc(q.alternativas?.[g.correta] ?? "—") : (g.respostasAceitas?.length ? `<span class="mono">${esc(g.respostasAceitas[0])}</span>` : "—");
    html += `<div class="card"><div class="q-topo"><span class="q-numero" style="font-size:1.1em">Questão ${i + 1}</span><span class="tag ${rot[0]}">${rot[1]} · ${c.pontos}/${peso}</span></div>
      <div class="enunciado">${formatarEnunciado(q.enunciado)}</div>
      <p><b>Sua resposta:</b> ${sua}</p>
      ${c.status !== "certa" && certa !== "—" ? `<p><b>Resposta correta:</b> ${certa}</p>` : ""}
      ${g.explicacao ? `<div class="feedback ${c.status === "certa" ? "certa" : "errada"}"><span class="icone" aria-hidden="true">💡</span><div><b>Por quê:</b> ${esc(g.explicacao)}</div></div>` : ""}
      ${obs ? `<p class="pequeno"><b>Comentário do professor:</b> ${esc(obs)}</p>` : ""}</div>`;
  });
  const nota = max ? Math.round((total / max) * 1000) / 10 : 0;
  $("#resResumo").innerHTML = `<p style="font-family:var(--fonte-titulo);font-size:1.4em;font-weight:600;margin:8px 0">Você acertou ${certas} de ${ids.length} · Nota: ${tentativa.nota ?? nota} / 100 <span class="pequeno">(${total} de ${max} pontos)</span></p>`;
  $("#resLista").innerHTML = html;
}
