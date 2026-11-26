// Página do aluno: login, lista de provas, prova (uma questão por vez ou todas na página), resultado.
import { ic } from "./icones.js";
import { db, auth, entrar, sair, aoMudarLogin, identificar, corrigir, embaralhar, sortearAleatorio, esc, $, toast, dataBR, letra,
         idTentativaTeste, apagarTentativaTeste, confirmar, avisar, traduzirErro, iniciais, fecharModais, temaDe, chaveNome, placar, idsConsulta, bancosDaProva, temasDoBanco, bancoDaQuestao, sortearQuestoes }
  from "./common.js?v=20261126f";
import { baixarMaterial } from "./material.js";
import { desenharConquistas } from "./aluno-conquistas.js?v=20261126a";
import { regraDoTipo, calcNotaFinal } from "./nota-final.js";
import { apontar, desenharFaleConosco } from "./aluno-retorno.js?v=20261116c";
import { desenharPerfil, painelSimulacao, lerSimulacao, provasSimuladas, RESUMO_SIMULADO } from "./aluno-perfil.js";
import { iniciarAbas, definirAbasVisiveis, irParaAba, abaAtual } from "./aluno-nav.js";
import { desenharTurma } from "./aluno-social.js";
import { desenharRecompensas } from "./aluno-recompensas.js";
let simulacao = false;   // equipe vendo a página como aluno (?simular=1): nada é gravado
import { lerGamificacao, GAMI_PADRAO } from "./common.js?v=20261126f";
let gami = { ...GAMI_PADRAO };   // o que está ligado na gamificação (config/gamificacao)
import { montarFormato, temFormato, FORMATOS, rotuloFormato, textoParaFalar, textoResposta, textoChave } from "./formatos-ui.js";
const controles = {};   // qid -> controle do formato adaptado (valor, preencher, travar)
import { abrirLeitorPdf } from "./leitor-pdf.js";
import { topicosDaProva, htmlConhecimentos, rotuloTec, nivelK } from "./plano-curso.js?v=20261112d";
import { criteriosDaProva, NIVEIS_RUBRICA, carregarCriteriosOficiais } from "./plano-ensino.js?v=20261116a";
import { toolbar, collapsible, vazio, statTiles, chips } from "./ui.js";
import { completar, aplicarVisual, mesclarQuestao } from "./acessibilidade.js";
import { textoRespostaSql } from "../servidor/sql-correcao.js?v=20261126a";
import { montarBancada } from "./workbench.js?v=20261126a";
import { montarBancadaWeb } from "./bancada-web.js?v=20261125a";
import { textoRespostaWeb, respostaEmBranco } from "../servidor/web-correcao.js?v=20261125a";
import { textoRespostaDiagrama, textoGabaritoDiagrama, respostaVaziaDiagrama, NOMES_DIAGRAMA } from "../servidor/diagrama-correcao.js?v=20261126a";
import { montarDiagramaProva } from "./diagrama-prova.js?v=20261126a";
import { conferirExtensoes, textoExtensoes, vigiarExtensoes, extensoesIA } from "./extensoes.js?v=20261125a";
import { definirEstilos } from "./mascotes.js";
import { usarItensCustom } from "./avatar.js";
import { mascoteLigado, ligarMascote, dadosMascote, htmlMascote, htmlEscolha, ligarEscolha, montarGuia, pararFala } from "./guia.js";
import { collection, doc, addDoc, getDoc, getDocFromServer, getDocs, setDoc, updateDoc, query, where, serverTimestamp, increment, arrayUnion, onSnapshot, runTransaction }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let eu = null;            // { uid, email, nome }
let provaAtual = null;    // { id, ...dados }
let tentativa = null;     // { id, ...dados }
let questoes = {};        // qid -> questão (enunciado, alternativas...)
let respostas = {};       // qid -> { resposta, segundos }
let ordemAlternativas = {}; // qid -> índices embaralhados
// acessibilidade do aluno (acessibilidade/{email}, marcada pelo professor): visual, tempo/vidas extras, questões adaptadas
let acess = null;           // { visual, prova, email } ou null
const ap = () => acess?.prova || {};

// ---------- opções da prova ----------
const modoTodas = () => provaAtual?.modoExibicao === "todas";          // todas as questões na mesma página
const trocaAbaPermitida = () => provaAtual?.permitirTrocaAba === true; // sem tela cheia e sem aviso (só conta)
const colarPermitido = () => provaAtual?.permitirColar === true;
// ir e voltar, alterando as respostas até finalizar. Aluno com ACESSIBILIDADE: sempre (padrão; acessibilidade.prova.navegacaoLivre = false desliga)
const voltarNaProva = p => p?.permitirVoltar === true || (!!acess && ap().navegacaoLivre !== false);
const podeVoltar = () => voltarNaProva(provaAtual);
const temConsulta = () => !!(idsConsulta(provaAtual).length || provaAtual?.materialConsultaUrl);
// código de acesso (o modo teste da equipe não pede)
const pedeCodigo = () => !modoTeste && !!String(provaAtual?.codigoAcesso || "").trim();
const normalizarCodigo = c => String(c || "").toUpperCase().replace(/\s+/g, "");
// VIDAS = limite de saídas da prova (aba/janela, tela cheia e, se a prova quiser, colar); com troca de aba permitida não há vidas.
// O professor pode dar vidas extras ao aluno (tentativa.vidasExtras) e restaurar as vidas (zera trocasDeAba).
const vidasBase = () => trocaAbaPermitida() ? 0 : Math.max(0, Math.round(Number(provaAtual?.maxTrocasDeAba || 0)));
// acessibilidade: sempre SEM vidas e SEM limite de tempo (não conta para o aluno com adaptações ativas)
const semLimites = () => !!acess;
const limiteSaidas = () => vidasBase() && !semLimites()
  ? vidasBase() + Math.max(0, Number(tentativa?.vidasExtras || 0)) + Math.max(0, Number(ap().vidasExtras || 0)) : 0;
// tentar colar também tira vida (padrão das provas com vidas; o professor pode desligar)
const colarTiraVida = () => !colarPermitido() && provaAtual?.colarTiraVida !== false;
// "perder a questão" só existe no modo uma por vez sem voltar; nos outros a prova é encerrada
const acaoAoExceder = () => !modoTodas() && !podeVoltar() && provaAtual?.acaoAoExceder === "perderQuestao" ? "perderQuestao" : "encerrar";
const textoPena = p => (p.modoExibicao !== "todas" && !voltarNaProva(p) && p.acaoAoExceder === "perderQuestao") ? "você perde a questão atual" : "a prova é encerrada";

// ---------- modo teste (equipe vê a prova como o aluno: index.html?teste=<provaId>) ----------
const provaTeste = new URLSearchParams(location.search).get("teste");
let modoTeste = false;
// id da tentativa: real = uid_prova · teste = teste_uid_prova
function idTentativa(provaId) { return modoTeste ? idTentativaTeste(eu.uid, provaId) : `${eu.uid}_${provaId}`; }

const telas = ["telaLogin", "telaProvas", "telaInicio", "telaQuestao", "telaFim", "telaResultado", "telaAviso"];
function mostrar(id) {
  telas.forEach(t => $("#" + t).classList.toggle("oculto", t !== id));
  document.body.classList.toggle("em-prova", id === "telaQuestao");   // ativa os bloqueios e avisos da prova
  document.body.classList.toggle("com-abas", id === "telaProvas");    // barra de seções (js/aluno-nav.js): só na lista, nunca na prova
  document.body.classList.toggle("com-consulta", id === "telaQuestao" && temConsulta());
  document.body.classList.toggle("com-sql", id === "telaQuestao" && !!tentativa?.questoesIds?.some(q => ["sql", "web", "diagrama"].includes(questoes[q]?.tipo)));   // Bancada SQL e diagramas: tela mais larga
  if (id !== "telaQuestao") { esconderSobreposicao(); $("#painelConsulta").classList.remove("aberto"); }
  if (id !== "telaFim") pararOuvinteFim();
  if (id !== "telaQuestao") { pararOuvinteProva(); try { pararTimerFora(); foraDaProva = false; if (pararVigia) { pararVigia(); pararVigia = null; } } catch { /* ainda carregando o módulo */ } }
  if (id !== "telaInicio") pararFala();
  atualizarBanner();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- fonte maior (acessibilidade) ----------
if (localStorage.getItem("fonteGrande") === "1") document.body.classList.add("grande");
$("#btnFonte").onclick = () => { document.body.classList.toggle("grande"); localStorage.setItem("fonteGrande", document.body.classList.contains("grande") ? "1" : "0"); };

// ---------- mascote guia (liga/desliga no cabeçalho; fica guardado no navegador) ----------
function marcarBotaoMascote() {
  const on = mascoteLigado(), b = $("#btnMascote");
  b.setAttribute("aria-pressed", on); b.textContent = on ? "🙂 Mascote: ligado" : "🙂 Mascote: desligado";
}
marcarBotaoMascote();
$("#btnMascote").onclick = () => {
  ligarMascote(!mascoteLigado()); marcarBotaoMascote();
  toast(mascoteLigado() ? `${dadosMascote().nome} voltou para te ajudar! 👋` : "Mascote desligado. As regras aparecem em lista.", "ok");
  redesenharMascotes();
};
// redesenha o que mostra o mascote na tela atual (depois de ligar/desligar ou trocar de mascote)
function redesenharMascotes() {
  if (!$("#telaProvas").classList.contains("oculto")) desenharSaudacao();
  if (!$("#telaInicio").classList.contains("oculto") && provaAtual) desenharGuia(provaAtual);
  if (!$("#telaFim").classList.contains("oculto")) desenharFim();
  humorHud = "feliz"; desenharHudMascote();
}

// ---------- login ----------
$("#btnEntrar").onclick = async () => {
  $("#msgLogin").textContent = "";
  try { await entrar(); } catch (e) { $("#msgLogin").textContent = "Não foi possível entrar. " + traduzirErro(e); }
};
$("#btnSair").onclick = () => sair();

aoMudarLogin(async user => {
  if (!user) { eu = null; modoTeste = false; $("#faixaTeste").classList.add("oculto"); $("#quem").textContent = ""; $("#avatar").classList.add("oculto"); $("#btnSair").classList.add("oculto"); mostrar("telaLogin"); return; }
  const id = await identificar(user);
  $("#quem").textContent = (user.displayName || id.email.split("@")[0]).trim().split(/[\s._-]+/)[0]; $("#quem").title = id.email; $("#btnSair").classList.remove("oculto");
  await carregarCriteriosOficiais(db, { collection, getDocs });   // critérios de avaliação: vêm do sistema de autoavaliação
  await getDocs(collection(db, "itensCustom")).then(r => usarItensCustom(r.docs.map(d => ({ id: d.id, ...d.data() })))).catch(() => {});   // itens criados pela equipe
  await getDocs(collection(db, "mascotes")).then(r => { const m = {}; r.forEach(d => { m[d.id] = d.data().ativo || {}; }); definirEstilos(m); }).catch(() => {});   // visuais que os professores escolheram
  $("#avatar").textContent = iniciais(user.displayName || id.email); $("#avatar").title = user.displayName || id.email; $("#avatar").classList.remove("oculto");
  if (id.tipo === "bloqueado") {
    $("#avisoTexto").innerHTML = `<h2>Conta não autorizada</h2><p>A conta <b>${esc(id.email)}</b> não é de aluno do SENAI.<br>Entre com o e-mail <b>@${esc(id.dominios.join("</b> ou <b>@"))}</b>.</p>`;
    mostrar("telaAviso"); return;
  }
  if (id.tipo === "equipe" && provaTeste) {
    modoTeste = true;
    eu = { uid: user.uid, email: id.email, nome: id.nome };
    $("#faixaTeste").classList.remove("oculto");
    // ?como=<email do aluno>: a equipe vê a prova com as adaptações de acessibilidade daquele aluno
    const como = new URLSearchParams(location.search).get("como");
    if (como) {
      await carregarAcessibilidade(como.toLowerCase(), false);
      $("#faixaTeste span").innerHTML = `<b>MODO TESTE</b> — vendo como <b>${esc(como)}</b>${acess ? " (♿ com adaptações)" : " (sem adaptações ativas)"}; não vale nota`;
    }
    await abrirProva(provaTeste, "inicio");
    return;
  }
  if (id.tipo === "equipe" && new URLSearchParams(location.search).has("simular")) {
    simulacao = true;
    // aluno FICTÍCIO (nada de nome real na simulação); o uid continua o da equipe só para separar o que fica no navegador
    eu = { uid: "sim-" + user.uid, email: "aluno.ficticio@simulacao.teste", nome: "Alex Fictício", nomeConta: "Alex Fictício" };
    $("#faixaTeste").classList.remove("oculto"); $("#btnReiniciarTeste")?.classList.add("oculto"); $("#quem").textContent = "Alex"; $("#quem").title = eu.email; $("#avatar").textContent = "AF";
    $("#faixaTeste span").innerHTML = `<b>🧪 SIMULAÇÃO</b> — você está vendo a página de um aluno <b>fictício</b> (Alex). Nada é gravado e nenhum aluno vê. <a href="#simPainel">⚙ Ir para o painel da simulação</a>`;
    gami = await lerGamificacao();
    return desenharSimulacao();
  }
  if (id.tipo === "equipe") {
    // professor, admin e auxiliares vão direto para o painel (o login vale nas duas páginas)
    $("#avisoTexto").innerHTML = `<h2>Olá, ${esc(id.nome)}</h2><p>Abrindo o seu painel…</p>`;
    mostrar("telaAviso"); location.replace("admin.html"); return;
  }
  // chave do nome da conta Google (vem do token, o mesmo que as regras usam) para o vínculo com a turma
  const tok = await user.getIdTokenResult().catch(() => null);
  eu = { uid: user.uid, email: id.email, nome: id.nome, nomeConta: tok?.claims?.name || "", chave: chaveNome(tok?.claims?.name || "") };
  await carregarAcessibilidade(id.email, true);
  gami = await lerGamificacao();
  await listarProvas();
});

// ---------- acessibilidade ----------
// nº de questões do aluno: a tentativa, o sorteio feito pelo professor na acessibilidade ou o padrão da prova
function nQ(p, t = null) { return t?.questoesIds?.length || acess?.sorteios?.[p.id]?.ids?.length || p.nQuestoes; }
async function carregarAcessibilidade(email, gravarUid) {
  acess = null;
  try {
    const d = await getDoc(doc(db, "acessibilidade", email));
    if (d.exists() && d.data().ativo !== false) {
      acess = { email, ...completar(d.data()) };
      // grava o uid do aluno no cadastro: assim a auxiliar de inclusão encontra as tentativas dele
      if (gravarUid && d.data().uid !== eu.uid) updateDoc(d.ref, { uid: eu.uid }).catch(e => console.warn("uid na acessibilidade", e));
    }
  } catch (e) { console.warn("acessibilidade", e); }
  aplicarVisual(document.body, acess?.visual || null);
}
// troca as questões pelas versões adaptadas (mesmo gabarito: alternativas na mesma ordem e quantidade)
async function aplicarQuestoesAdaptadas() {
  if (!acess) return;
  const ads = await Promise.all(Object.keys(questoes).map(q => getDoc(doc(db, "acessibilidade", acess.email, "questoes", q)).catch(() => null)));
  ads.forEach(a => { if (a?.exists() && questoes[a.id]) questoes[a.id] = mesclarQuestao(questoes[a.id], a.data()); });
}
// 🔊 lê a questão em voz alta (enunciado + alternativas)
function lerQuestao(qid, botao) {
  if (!("speechSynthesis" in window)) return;
  if (speechSynthesis.speaking && botao.classList.contains("ativo")) { speechSynthesis.cancel(); return; }
  const q = questoes[qid];
  const alts = temFormato(q) ? textoParaFalar(q) : q.tipo === "alternativa" ? (ordemAlternativas[qid] || []).map((k, pos) => `Alternativa ${letra(pos)}: ${q.alternativas[k]}.`).join(" ") : "";
  const u = new SpeechSynthesisUtterance(`${q.enunciado}. ${temApoio(q) ? "Apoio: " + q.apoios.join(". ") + ". " : ""}${alts}`.replace(/`/g, ""));
  u.lang = "pt-BR"; u.rate = 0.95;
  const voz = speechSynthesis.getVoices().find(v => /^pt(-|_)BR/i.test(v.lang)); if (voz) u.voice = voz;
  document.querySelectorAll(".b-ouvir.ativo").forEach(b => { b.classList.remove("ativo"); b.textContent = "🔊 Ouvir"; });
  u.onend = u.onerror = () => { botao.classList.remove("ativo"); botao.textContent = "🔊 Ouvir"; };
  speechSynthesis.cancel(); speechSynthesis.speak(u);
  botao.classList.add("ativo"); botao.textContent = "⏹ Parar";
}

// ---------- simulação da equipe: perfil, personagem e conquistas com dados de mentira ----------
async function desenharSimulacao() {
  mostrar("telaProvas"); desenharSaudacao(); prepararAbas();
  $("#listaProvas").innerHTML = `<p class="pequeno">🧪 Na simulação a lista de provas fica vazia. Use o <b>Painel da simulação</b> para inventar notas e ganhar conquistas.</p>`;
  $("#listaFeitas").innerHTML = `<p class="pequeno">🧪 Na simulação não há provas feitas de verdade. As notas inventadas no <b>Painel da simulação</b> aparecem em <b>Estudos</b> e nas conquistas.</p>`;
  const cfg = lerSimulacao(), forcar = new Set(cfg.dados || []);
  const cq = await desenharConquistas(gami.conquistas ? $("#conquistas") : null, eu, cfg.acess ? RESUMO_SIMULADO : null, { provas: provasSimuladas(cfg), forcar, simulacao: true });
  if (!gami.conquistas) $("#conquistas").classList.add("oculto");
  // na simulação a parte social aparece sempre (para a equipe ver como fica), mesmo desligada para os alunos
  await desenharAbasDoPerfil(cq, gamiTurma());
  painelSimulacao($("#simPainel"), cq?.todas || [], desenharSimulacao);
  desenharFaleConosco($("#faleConosco"), eu, gami, true);
}
// ---------- lista de provas ----------
let provasDaLista = {};   // id -> prova (para saber, no clique, se a prova pede tela cheia)
function desenharSaudacao() {
  const box = $("#provasSaudacao"), on = mascoteLigado(), m = dadosMascote();
  const nome = String(eu?.nome || "").split(/\s+/)[0];
  box.classList.toggle("sem", !on);
  box.innerHTML = on
    ? `<div class="saudacao-linha">${htmlMascote("feliz", { classe: "saudacao-mascote" })}
         <div class="balao"><div class="balao-nome">${esc(m.nome)} <span>prof. ${esc(m.professor)}</span></div>
           <div class="balao-texto">Oi${nome ? `, <b>${esc(nome)}</b>` : ""}! ${esc(m.bordao)}<br>Escolha uma prova aqui embaixo que eu te explico tudo antes de começar.</div></div></div>
       ${collapsible({ chave: "aluno:trocarGuia", classe: "leve saudacao-troca", titulo: "Trocar o guia", corpoHTML: `<div class="saudacao-escolha">${htmlEscolha(m.id)}</div>` })}`
    : `<p class="pequeno" style="margin:0">Mascote guia desligado. Para ligar, use o botão <b>🙂 Mascote</b> no topo da página.</p>`;
  ligarEscolha(box, () => { desenharSaudacao(); humorHud = "feliz"; });
}
async function listarProvas() {
  mostrar("telaProvas");
  desenharSaudacao();
  // Somativas (#listaProvas: para fazer) e Resultados (#listaFeitas: já feitas) são abas da mesma tela (js/aluno-nav.js)
  const box = $("#listaProvas"), boxF = $("#listaFeitas"); box.innerHTML = boxF.innerHTML = "<p class='pequeno'>Carregando…</p>";
  // delegação: os botões funcionam assim que aparecem, mesmo com o resto da lista ainda carregando
  box.onclick = boxF.onclick = e => {
    const ir = e.target.closest("[data-ir]");
    if (ir) return irParaAba(ir.dataset.ir);
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
  prepararAbas();
  if (!modoTeste) desenharConquistas(gami.conquistas ? $("#conquistas") : null, eu, acess?.diarioResumo || null)
    .then(cq => desenharAbasDoPerfil(cq, gami)).catch(e => console.warn("conquistas", e));
  if (modoTeste || !gami.conquistas) $("#conquistas").classList.add("oculto");
  if (!modoTeste) desenharFaleConosco($("#faleConosco"), eu, gami).catch(e => console.warn("fale conosco", e));
  provasDaLista = Object.fromEntries(lista.map(p => [p.id, p]));
  const semFeitas = `<p class="pequeno lp-nada">Você ainda não terminou nenhuma prova. Quando terminar, o resultado aparece aqui.</p>`;
  if (!lista.length) { box.innerHTML = vazio({ e: "📭", texto: `<b>Nenhuma prova liberada no momento.</b></p><p class="pequeno">Quando o professor liberar, ela aparece aqui. Se a prova já começou na sala, recarregue a página.` }); boxF.innerHTML = semFeitas; return; }
  // Somativas: "Para fazer" (em andamento primeiro) · Resultados: "Já feitas"; busca só com muitas provas
  box.innerHTML = (lista.length > 6 ? toolbar({ buscaId: "lpBusca", placeholder: "Buscar prova…", contagemId: "lpContagem" }) : "") + `<div id="lpFazer"></div>`;
  boxF.innerHTML = (lista.length > 6 ? toolbar({ buscaId: "lfBusca", placeholder: "Buscar resultado…", contagemId: "lfContagem" }) : "") + `<div id="lpFeitas"></div>`;
  const fazer = $("#lpFazer"), feitas = $("#lpFeitas");
  const buscar = (lugar, contagem) => e => {
    const t = normBusca(e.target.value), itens = [...lugar.querySelectorAll(".prova-item")];
    let n = 0;
    itens.forEach(el => { const ok = !t || el.dataset.busca.includes(t); el.classList.toggle("oculto", !ok); n += ok; });
    $(contagem).textContent = t ? `${n} de ${itens.length}` : "";
  };
  $("#lpBusca")?.addEventListener("input", buscar(box, "#lpContagem"));
  $("#lfBusca")?.addEventListener("input", buscar(boxF, "#lfContagem"));
  let mostradas = 0, nFazer = 0, nFeitas = 0;
  for (const p of lista) {
    const t = await getDoc(doc(db, "tentativas", idTentativa(p.id)));
    const td = t.exists() ? t.data() : null;
    if (!td && !(await alunoNaTurma(p))) continue;   // prova de outra turma: não aparece
    mostradas++;
    const podeFazer = modoTeste || p.liberada, podeVerResultado = modoTeste || p.resultadosLiberados;
    const andamento = p.modoExibicao === "todas" ? `${td?.indiceAtual || 0} de ${nQ(p, td)} enviadas` : `questão ${(td?.indiceAtual || 0) + 1} de ${nQ(p, td)}`;
    let status, acao;
    if (!td)                    { status = `<span class="chip off">○ não iniciada</span>`; acao = podeFazer ? `<button class="ok" data-acao="inicio" data-id="${p.id}">Fazer a prova</button>` : `<span class="pequeno">prova encerrada</span>`; }
    else if (!td.finalizadaEm)  { status = `<span class="chip warn">em andamento · ${andamento}</span>`; acao = podeFazer ? `<button class="leve" data-acao="continuar" data-id="${p.id}">Continuar</button>` : `<span class="pequeno">prova encerrada</span>`; }
    else                        { status = `<span class="chip ok">✓ ${dataBR(td.finalizadaEm)}</span><span class="chip navy" data-placar="${p.id}">…</span>`; acao = podeVerResultado ? `<button class="leve" data-acao="resultado" data-id="${p.id}">Ver resultado</button>` : `<span class="pequeno">gabarito ainda não liberado</span>`; }
    const item = `<div class="prova-item" data-busca="${esc(normBusca(`${p.titulo} ${p.turma || ""} ${p.materia || ""}`))}"><div class="info"><b>${esc(p.titulo)}</b>
      <div class="pi-meta">${status}</div><div class="pi-dados">${[p.materia, `${nQ(p, td)} questões`, p.tempoMinutos > 0 && !semLimites() ? `${p.tempoMinutos} min` : ""].filter(Boolean).map(esc).join(" · ")}${!p.permitirTrocaAba && Number(p.maxTrocasDeAba) > 0 && !semLimites() ? ` · <span class="e" aria-hidden="true">${"❤️".repeat(Math.min(5, Number(p.maxTrocasDeAba)))}</span>` : ""}</div></div><div class="acao">${acao}</div></div>`;
    if (td?.finalizadaEm) { feitas.insertAdjacentHTML("beforeend", item); nFeitas++; }
    else { fazer.insertAdjacentHTML(td ? "afterbegin" : "beforeend", item); nFazer++; }   // em andamento vai para o topo
    if (td?.finalizadaEm) {   // placar sem esperar: a lista não fica travada lendo gabaritos
      const el = boxF.querySelector(`[data-placar="${p.id}"]`);
      placarDaTentativa({ id: t.id, ...td }).then(r => { el.innerHTML = textoPlacarCurto(r, p); }).catch(() => { el.textContent = "placar indisponível"; });
    }
  }
  if (!mostradas) { box.innerHTML = vazio({ e: "📭", texto: `<b>Nenhuma prova liberada para você no momento.</b></p><p class="pequeno">Quando o professor liberar uma prova da sua turma, ela aparece aqui. Se a prova já começou na sala, recarregue a página; se continuar sem aparecer, mostre ao professor o nome e o e-mail da sua conta: <b>${esc(eu.nomeConta || "(conta sem nome)")}</b> · <b>${esc(eu.email)}</b>. O nome cadastrado na turma precisa ser igual ao da conta.</p>${avisoVinculo ? `<p class="pequeno erro-texto">${esc(avisoVinculo)}` : ""}` }); boxF.innerHTML = semFeitas; return; }
  if (!nFazer) fazer.innerHTML = `<p class="pequeno lp-nada">🎉 Nenhuma prova para fazer agora.${nFeitas ? ` <button type="button" class="leve mini" data-ir="resultados">📊 Ver as que você já fez</button>` : ""}</p>`;
  if (!nFeitas) feitas.innerHTML = semFeitas;
}

// ---------- abas da lista (Somativas · Resultados · Estudos · Turma · Perfil) ----------
let cqAtual = null;   // conquistas calculadas (Estudos, Turma, Recompensas)
const gamiTurma = () => simulacao ? { ...gami, personagem: true, social: true, socialNotas: true, socialReal: gami.social } : gami;
function prepararAbas() {
  iniciarAbas({ aoMudar: id => { if (id === "turma" && cqAtual) desenharTurma($("#turmaMural"), { eu, cq: cqAtual, gami: gamiTurma(), simulacao }); } });
  const g = gamiTurma();
  definirAbasVisiveis(modoTeste ? ["resultados"] : ["resultados", "estudos", ...(g.social ? ["turma"] : []), ...(g.conquistas || g.personagem ? ["perfil"] : [])]);
}
// depois das conquistas: perfil, recompensas, estudos e (se a aba estiver aberta) o mural
async function desenharAbasDoPerfil(cq, g) {
  cqAtual = cq;
  desenharEstudos(cq);
  desenharRecompensas($("#recompensas"), { eu, cq, gami: g, simulacao }).catch(e => console.warn("recompensas", e));
  if (abaAtual() === "turma") desenharTurma($("#turmaMural"), { eu, cq, gami: gamiTurma(), simulacao });
  await desenharPerfil($("#perfilAluno"), { eu, cq, gami: g, simulacao });
}
// 📚 Estudos: como o aluno está em cada matéria (média das provas) e onde revisar
function desenharEstudos(cq) {
  const box = $("#estudosMaterias"), ms = cq?.materias || [];
  const nota = n => Math.round(n), tom = n => n >= 80 ? "ok" : n >= 60 ? "navy" : "warn";
  const dica = n => n >= 80 ? "Mandando bem! Continue assim." : n >= 60 ? "No caminho certo. Revise o que errou para subir mais." : "Vale reforçar: revise o gabarito e tire as dúvidas com o professor.";
  box.innerHTML = `<h2>📚 Como você está em cada matéria</h2>
    <p class="pequeno" style="margin-top:0">A média das suas provas em cada matéria. Para estudar uma prova, abra <b>Resultados</b> e toque em <b>Ver resultado</b> (quando o professor liberar o gabarito).</p>
    ${ms.length ? `<div class="estudo-lista">${ms.map(m => {
      const l = [...m.provas].sort((a, b) => a.data - b.data), ult = l[l.length - 1], ant = l[l.length - 2];
      const seta = ant ? (ult.nota > ant.nota ? `<span class="chip ok">▲ subiu</span>` : ult.nota < ant.nota ? `<span class="chip warn">▼ caiu</span>` : `<span class="chip off">= igual</span>`) : "";
      return `<div class="estudo-item"><div class="ei-info"><b>${esc(m.materia)}</b><span class="pequeno">${m.provas.length} prova${m.provas.length > 1 ? "s" : ""} · última: ${esc(ult.titulo)} (${nota(ult.nota)})</span><span class="pequeno">${dica(m.media)}</span></div>
        <div class="ei-nota"><span class="chip ${tom(m.media)}">média ${nota(m.media)}</span>${seta}</div></div>`; }).join("")}</div>
      <div class="linha acoes"><button type="button" class="leve" id="estudosResultados">📊 Ver meus resultados</button></div>`
    : `<p class="pequeno lp-nada">Faça a sua primeira prova para ver aqui como você está em cada matéria.</p>`}`;
  $("#estudosResultados", box)?.addEventListener("click", () => irParaAba("resultados"));
}
const normBusca = t => String(t || "").toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "");
// turma da prova: sem turma = qualquer aluno; com turma = o e-mail precisa estar na lista
// (o aluno só consegue ler a turma em que está; a proteção de verdade é a regra do create da tentativa)
// Turma cadastrada pelo NOME: se o nome da conta Google bater com um nome ainda sem e-mail,
// o próprio aluno grava o vínculo (nome -> e-mail) e entra na lista. As regras só permitem o próprio nome/e-mail.
const turmasLidas = {};
let avisoVinculo = "";
async function alunoNaTurma(p) {
  if (modoTeste) return true;
  if (!p.turmaId) return false;   // prova sem turma não aparece para aluno nenhum: cada prova é de UMA turma
  // recuperação: só os alunos escolhidos pelo professor (abaixo da nota de corte)
  if (Array.isArray(p.alunosEmails) && !p.alunosEmails.includes(String(eu.email || "").toLowerCase())) return false;
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
  const voltar = voltarNaProva(p);
  if (p.modoExibicao === "todas") r.push(voltar
    ? "Todas as questões aparecem <b>nesta página</b>. Salve cada resposta pelo botão <b>Salvar resposta</b>: dá para alterar e salvar de novo até clicar em <b>Finalizar prova</b>."
    : "Todas as questões aparecem <b>nesta página</b>. Envie cada resposta pelo botão <b>Enviar resposta</b> dela: depois de enviada, ela fica travada. No fim, clique em <b>Finalizar prova</b>.");
  else r.push(voltar
    ? "As questões aparecem <b>uma por vez</b>, mas você pode <b>ir e voltar</b> (← Anterior / Próxima → ou os números no topo) e alterar as respostas até clicar em <b>Finalizar prova</b>. Ao trocar de questão, o que você marcou ou escreveu é salvo sozinho."
    : "As questões aparecem <b>uma por vez</b>. Depois de enviar uma resposta, não é possível voltar.");
  r.push("A ordem das questões e das alternativas é diferente para cada aluno.");
  if (Number(p.dicasMax || 0) > 0) r.push(`💡 Você pode pedir <b>até ${Number(p.dicasMax)} dica(s) para a prova toda</b>, clicando no mascote (ou em 💡 Dica, no topo). É só uma dica, não a resposta, e o professor vê que você pediu.`);
  r.push("No final você vê <b>quantas acertou e a nota</b>. Quais acertou e o gabarito aparecem só quando o professor liberar.");
  const base = !p.permitirTrocaAba && !semLimites() ? Math.max(0, Number(p.maxTrocasDeAba || 0)) : 0;
  const vidas = base ? base + Math.max(0, Number(ap().vidasExtras || 0)) : 0, colarCusta = vidas > 0 && !p.permitirColar && p.colarTiraVida !== false;
  if (!p.permitirColar) r.push(`<b>Colar texto está desativado</b> nos campos de resposta: digite. As tentativas de colar ficam registradas${colarCusta ? " e <b>custam 1 vida</b>" : ""}.`);
  if (!p.permitirTrocaAba) {
    r.push("Use o <b>Google Chrome ou o Microsoft Edge</b> num computador. A prova abre em <b>tela cheia</b> com o teclado travado: <b>Alt, Alt+Tab, tecla Windows, Esc, F1–F12 e os atalhos com Ctrl</b> não funcionam (dentro da resposta continuam valendo Ctrl+Z, Ctrl+A e Ctrl+setas; o AltGr do teclado também). Desligue antes as <b>extensões de IA/escrita</b> e o <b>bloqueador de anúncios</b>.");
    r.push("Sair da tela da prova <b>conta como saída</b>: sair da tela cheia, trocar de janela, clicar em outro monitor e também <b>recarregar ou fechar a página</b>. O que o navegador não consegue bloquear (Ctrl+Alt+Del, Win+L) é percebido e conta igual. Enquanto você estiver fora, as questões ficam escondidas.");
    if (!semLimites() && Number(p.maxTrocasDeAba || 0) > 0 && Number(p.segundosVolta ?? 5) > 0) r.push(`<b>Saiu? Volte rápido:</b> fora da prova você perde <b>mais 1 vida a cada ${Number(p.segundosVolta ?? 5)} segundos</b> (conta até com a página fechada).`);
    r.push("Apertou <b>Shift várias vezes</b> e o Windows abriu a janela das Teclas de Aderência? Clique em <b>Não</b> e volte: na primeira vez é só um aviso.");
    r.push("A prova só funciona <b>no computador em que você começou</b>. Trocou de computador? Chame o professor para liberar.");
  }
  if (vidas) r.push(`<b>Você tem ${vidas === 1 ? "1 vida" : `${vidas} vidas`}: ${"❤️".repeat(Math.min(vidas, 10))}</b><br>Perde 1 vida ao trocar de aba ou de janela (Alt+Tab), sair da tela cheia${colarCusta ? " ou tentar colar (Ctrl+V)" : ""}. Se as vidas acabarem, ${textoPena(p)}.<br>Saiu sem querer? Calma: chame o professor, ele pode devolver suas vidas.`);
  r.push("Copiar e selecionar o enunciado, imprimir e atalhos como Ctrl+C e Ctrl+P ficam desativados durante a prova.");
  if (semLimites()) r.push("<b>Sem limite de tempo e sem vidas para você.</b> Faça com calma: sair da tela fica só registrado.");
  else if (Number(p.tempoMinutos) > 0) r.push(`<b>Tempo limite: ${Number(p.tempoMinutos) + Math.max(0, Number(ap().tempoExtraMin || 0))} min${ap().tempoExtraMin > 0 ? ` (com ${ap().tempoExtraMin} min a mais para você)` : ""}.</b>${ap().ocultarCronometro ? " O relógio fica escondido para você ficar tranquilo; avisamos quando faltar 1 minuto." : ""} O cronômetro começa ao clicar em Começar; quando zerar, a prova é finalizada com as respostas já enviadas.`);
  if (String(p.codigoAcesso || "").trim() && !modoTeste) r.push("Esta prova pede um <b>código de acesso</b>, informado pelo professor na sala.");
  const nPdfs = idsConsulta(p).length;
  if (nPdfs || p.materialConsultaUrl) r.push(`Consulta permitida: <b>${esc(p.materialConsultaTitulo || "material de consulta")}</b>${nPdfs > 1 ? ` (${nPdfs} PDFs: troque pelas abas no topo do painel)` : ""}, aberto ao lado das questões (no celular, pelo botão <b>📖 Consulta</b>).`);
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
  const meuEmail = String(eu.email || "").toLowerCase();
  if (!modoTeste && !tentativa?.finalizadaEm && (provaAtual.bloqueados || []).includes(meuEmail))
    return avisoEntrada("🚫 Você não pode fazer esta prova", "O professor bloqueou o seu acesso a esta prova. Se acha que é engano, fale com ele.");
  if (!tentativa && !modoTeste && entradaFechada(provaAtual) && !(provaAtual.liberadosEntrada || []).includes(meuEmail))
    return avisoEntrada("🚪 A entrada desta prova já foi fechada", "A prova já começou e o professor fechou a entrada. Se você chegou atrasado, peça para ele deixar você entrar.");
  if (!tentativa) {
    const min = semLimites() ? 0 : Number(provaAtual.tempoMinutos || 0) + (Number(provaAtual.tempoMinutos || 0) > 0 ? Math.max(0, Number(ap().tempoExtraMin || 0)) : 0);
    $("#inicioTitulo").textContent = provaAtual.titulo;
    const vidas = limiteSaidas();
    $("#inicioInfo").innerHTML = `<span class="chip">📝 ${nQ(provaAtual)} questões</span>` +
      (provaAtual.turma ? `<span class="chip">👥 ${esc(provaAtual.turma)}</span>` : "") +
      (min > 0 ? `<span class="chip aviso">⏱ ${min} min</span>` : `<span class="chip">⏱ sem limite de tempo</span>`) +
      (vidas ? `<span class="chip vidas" title="Vidas">${"❤️".repeat(Math.min(vidas, 10))} ${vidas} ${vidas === 1 ? "vida" : "vidas"}</span>` : "") +
      (podeVoltar() ? `<span class="chip">↔ pode ir e voltar</span>` : "") +
      (temConsulta() ? `<span class="chip info">📖 consulta: ${esc(provaAtual.materialConsultaTitulo || "material")}</span>` : "");
    $("#inicioRegras").innerHTML = regrasDaProva(provaAtual).map(x => `<li>${x}</li>`).join("");
    desenharTopicos(provaAtual);
    desenharGuia(provaAtual);
    $("#inicioCodigoBox").classList.toggle("oculto", !pedeCodigo());
    $("#inicioCodigo").value = ""; $("#inicioCodigoErro").textContent = "";
    $("#btnComecar").disabled = pedeCodigo();   // só habilita depois de digitar o código
    mostrar("telaInicio"); conferirRequisitos(); return;
  }
  if (!tentativa.finalizadaEm && !(await conferirSessao())) return;
  await carregarTentativa({ retomando: true });
}

// ---------- entrada na prova: barrado, entrada fechada, sessão única ----------
function entradaFechada(p) { return p?.entradaFechada === true || (p?.entradaAte?.toMillis && Date.now() >= p.entradaAte.toMillis()); }
async function avisoEntrada(titulo, texto) {
  await avisar(texto, { titulo, ok: "Entendi" }).catch(() => {});
  listarProvas();
}
// cada navegador ganha um código; a tentativa guarda o do computador em que o aluno começou (o professor pode liberar)
const ID_DISPOSITIVO = (() => {
  let x = null;
  try { x = localStorage.getItem("provaDispositivo"); if (!x) { x = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()); localStorage.setItem("provaDispositivo", x); } }
  catch { x = "sem-armazenamento"; }
  return x;
})();
async function conferirSessao() {
  if (modoTeste || simulacao) return true;
  if (tentativa.sessao && tentativa.sessao !== ID_DISPOSITIVO) {
    avisoEntrada("💻 Sua prova está aberta em outro computador", "Por segurança, a prova só funciona no computador em que você começou. Se trocou de computador, peça ao professor para clicar em \"Liberar login\" e depois entre de novo.");
    return false;
  }
  try {
    const ref = doc(db, "tentativas", tentativa.id), antes = Date.now();
    await updateDoc(ref, { ...(tentativa.sessao ? {} : { sessao: ID_DISPOSITIVO }), vistoEm: serverTimestamp() });
    const d = await getDocFromServer(ref);
    const visto = d.data()?.vistoEm?.toMillis?.();
    if (visto) desvioRelogio = visto - Math.round((antes + Date.now()) / 2);   // relógio do servidor (timer de volta)
    if (d.data()?.sessao && d.data().sessao !== ID_DISPOSITIVO) { avisoEntrada("💻 Sua prova está aberta em outro computador", "Peça ao professor para clicar em \"Liberar login\"."); return false; }
    tentativa = { ...tentativa, ...d.data(), id: tentativa.id };
  } catch (e) { console.warn("sessão da prova", e); }
  return true;
}

// ---------- requisitos para começar: Chrome/Edge no computador, sem extensão de IA e sem bloqueador ----------
let requisitosOk = true;
async function conferirRequisitos() {
  let box = $("#inicioRequisitos");
  if (!box) { $("#btnComecar").insertAdjacentHTML("beforebegin", `<div id="inicioRequisitos" class="inicio-requisitos oculto" role="alert"></div>`); box = $("#inicioRequisitos"); }
  if (trocaAbaPermitida()) { requisitosOk = true; box.classList.add("oculto"); return true; }
  const prob = [];
  if (!suportaModoProva() || !ehComputador()) prob.push("Esta prova precisa do <b>Google Chrome</b> ou do <b>Microsoft Edge</b> num <b>computador</b> (é o que permite travar o teclado em tela cheia). Abra o site por um deles.");
  const ext = await conferirExtensoes();
  const tx = textoExtensoes(ext);
  if (tx) prob.push(tx);
  requisitosOk = !prob.length || modoTeste;
  box.classList.toggle("oculto", !prob.length);
  box.innerHTML = prob.length ? `<b>⚠ Antes de começar:</b><ul>${prob.map(p => `<li>${p}</li>`).join("")}</ul>${modoTeste ? "<p class='pequeno'>(Modo teste da equipe: você pode começar mesmo assim.)</p>" : ""}<button type="button" class="leve" id="btnReconferir">Conferir de novo</button>` : "";
  if (prob.length) $("#btnReconferir").onclick = () => conferirRequisitos();
  return requisitosOk;
}

// o que a prova avalia, do plano de curso: três blocos recolhidos (capacidades técnicas, socioemocionais, conhecimentos)
function desenharTopicos(p) {
  const box = $("#inicioTopicos"); if (!box) return;   // index.html antigo no cache
  const c = criteriosDaProva(p);
  if (c) { box.classList.remove("oculto"); box.innerHTML = htmlCriterios(c); return; }
  const t = topicosDaProva(p);
  box.classList.toggle("oculto", !t);
  if (!t) { box.innerHTML = ""; return; }
  // conta os itens de 2º nível (e os de 1º nível sem subitens), que são as linhas da lista
  const nK = t.con.filter(([id]) => nivelK(id) === 2 || (nivelK(id) === 1 && !t.con.some(([o]) => o.startsWith(id + ".")))).length;
  const bloco = (chave, titulo, n, corpo) => n ? collapsible({ chave, titulo, resumoHTML: `<span class="chip">${n}</span>`, corpoHTML: corpo }) : "";
  const lista = l => `<ol class="pc-lista">${l.map(([, x]) => `<li>${esc(x)}</li>`).join("")}</ol>`;
  box.innerHTML = `<h3 class="pc-titulo">🎯 O que esta prova avalia</h3>
    <p class="pequeno pc-origem">Unidade curricular <b>${esc(t.unidade.nome)}</b>, do plano de curso${t.inteira ? " (a unidade inteira)" : ""}. Toque em cada bloco para ver.</p>` +
    bloco("pc-tec", `🛠 ${rotuloTec(t.unidade)}`, t.tec.length, lista(t.tec)) +
    bloco("pc-soc", "🤝 Capacidades socioemocionais", t.soc.length, lista(t.soc)) +
    bloco("pc-con", "📚 Conhecimentos", nK, htmlConhecimentos(t.con, esc));
}

// critérios de avaliação do plano de ensino, agrupados pela capacidade, cada um com a explicação para o aluno
function htmlCriterios(c) {
  const n = l => l.reduce((x, g) => x + g.criterios.length, 0);
  const grupo = g => `<div class="cr-cap"><p class="cr-cap-nome">Capacidade: ${esc(g.nome)}</p><ul class="cr-lista">${g.criterios.map(k => `<li>
      <p class="cr-texto"><span class="cr-cod">${k.codigo}</span>${esc(k.texto)}</p>
      <p class="cr-expl"><b>O que você precisa mostrar:</b> ${esc(k.explicacao)}</p>
    </li>`).join("")}</ul></div>`;
  const bloco = (chave, titulo, l) => l.length ? collapsible({ chave, titulo, resumoHTML: `<span class="chip">${n(l)}</span>`, corpoHTML: l.map(grupo).join("") }) : "";
  return `<h3 class="pc-titulo">🎯 O que vai ser avaliado</h3>
    <p class="pequeno pc-origem">${c.avaliacao ? `<b>${esc(c.avaliacao.nome)}</b> · ` : ""}${esc(c.unidade.nome)}. Estes são os critérios do plano de ensino que o professor vai observar na sua prova. Toque em cada bloco para ver.</p>` +
    bloco("cr-tec", "🛠 Critérios técnicos", c.tec) + bloco("cr-soc", "🤝 Critérios socioemocionais", c.soc) +
    `<p class="pequeno cr-niveis">Em cada critério você fica em um nível: ${NIVEIS_RUBRICA.map(x => `<b>${x}</b>`).join(", ")}.</p>`;
}

function aoFimGuia() { $("#btnComecar").scrollIntoView({ behavior: "smooth", block: "center" }); (pedeCodigo() ? $("#inicioCodigo") : $("#btnComecar")).focus({ preventScroll: true }); }
// Guia do mascote: as regras da prova, uma fala por vez. Com o mascote desligado, só a lista.
function desenharGuia(p) {
  const on = mascoteLigado(), box = $("#inicioGuia"), m = dadosMascote();
  box.classList.toggle("oculto", !on);
  $("#inicioRegrasBox").open = !on;
  $("#inicioRegrasTitulo").textContent = on ? "Ver todas as regras de uma vez" : "Leia antes de começar";
  if (!on) { box.innerHTML = ""; pararFala(); return; }
  const nome = String(eu?.nome || "").split(/\s+/)[0], regras = regrasDaProva(p);
  const passos = [
    { humor: "feliz", texto: `Oi${nome ? `, <b>${esc(nome)}</b>` : ""}! Eu sou o <b>${esc(m.nome)}</b> e vou te explicar como funciona a prova <b>${esc(p.titulo)}</b>.<br>São ${regras.length} dicas rápidas. Use <b>Próximo ▶</b> (ou a seta →) para passar.` },
    ...regras.map(t => ({ humor: /vida/.test(t) ? "surpreso" : "falando", texto: t })),
    { humor: "comemorando", texto: `Pronto, é isso! Leia cada questão com calma. Quando quiser, clique em <b>▶ Começar a prova</b>, aqui embaixo.<br>Boa prova! 🍀` }
  ];
  montarGuia(box, passos);
  box.removeEventListener("guia-fim", aoFimGuia); box.addEventListener("guia-fim", aoFimGuia);
  box.insertAdjacentHTML("beforeend", `<div class="guia-rodape"><span class="pequeno">Trocar de guia:</span>${htmlEscolha(m.id)}</div>`);
  ligarEscolha(box.querySelector(".guia-rodape"), () => desenharGuia(p));
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
  if (!requisitosOk || (!trocaAbaPermitida() && !modoTeste && (!suportaModoProva() || extensoesIA().length))) {
    conferirRequisitos(); $("#inicioRequisitos")?.scrollIntoView({ behavior: "smooth", block: "center" }); return;
  }
  pedirTelaCheia();   // precisa ser chamado direto no clique, antes de qualquer await (entra em tela cheia e trava o teclado)
  $("#btnComecar").disabled = true;
  try {
    // sorteia nQuestoes dos bancos da prova (ids) — cada aluno recebe um conjunto diferente.
    // Acessibilidade: se o professor já sorteou as questões deste aluno no painel (para adaptar só essas), usa as mesmas.
    const pre = acess?.sorteios?.[provaAtual.id]?.ids;
    const sorteadas = Array.isArray(pre) && pre.length ? pre.slice() : await sortearQuestoes(provaAtual, null, { incluirRevisar: modoTeste });
    const tid = idTentativa(provaAtual.id);
    const dados = {
      uid: eu.uid, email: eu.email, nome: eu.nome, provaId: provaAtual.id, bancoId: provaAtual.bancoId,
      questoesIds: sorteadas, iniciadaEm: serverTimestamp(), finalizadaEm: null, indiceAtual: 0, trocasDeAba: 0, notaPrevia: null, aguardandoCorrecao: 0,
      saidasTelaCheia: 0, tentativasColar: 0
    };
    if (!modoTeste) dados.sessao = ID_DISPOSITIVO;   // sessão única: este computador
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

async function carregarTentativa(opc = {}) {
  await carregarTentativaBase();
  if (!tentativa || tentativa.finalizadaEm || !emProvaAtiva()) return;
  vigiarExtensoesNaProva();
  if (conferirPunicao()) return;   // as vidas acabaram enquanto a página estava fechada (timer de volta no servidor)
  if (opc.retomando && !modoTeste) retomarSaida();
}
async function carregarTentativaBase() {
  questoes = {}; respostas = {}; tentouEnviar.clear(); rascunhos.clear(); erroEnvio = false;
  const docsQ = await Promise.all(tentativa.questoesIds.map(q => getDoc(doc(db, "bancos", bancoDaQuestao(q, tentativa.bancoId), "questoes", q))));
  docsQ.forEach(d => { if (d.exists()) questoes[d.id] = { id: d.id, ...d.data() }; });
  await aplicarQuestoesAdaptadas();
  const rs = await getDocs(collection(db, "tentativas", tentativa.id, "respostas"));
  rs.forEach(d => respostas[d.id] = d.data());
  if (tentativa.finalizadaEm) { mostrarFim(); return; }
  if (tempoAcabou()) return finalizar({ tempoEsgotado: true });
  ouvirTentativa();
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

// ---------- tentativa ao vivo durante a prova ----------
// O professor pode, pelo painel: restaurar as vidas (zera trocasDeAba e devolve questões perdidas),
// dar vida extra (vidasExtras) e tempo extra (minutosExtras). A tela do aluno acompanha sem recarregar.
let ouvinteProva = null;
function pararOuvinteProva() { if (ouvinteProva) { ouvinteProva(); ouvinteProva = null; } }
function ouvirTentativa() {
  pararOuvinteProva();
  if (!tentativa || tentativa.finalizadaEm) return;
  const id = tentativa.id;
  ouvinteProva = onSnapshot(doc(db, "tentativas", id), d => {
    if (!d.exists() || tentativa?.id !== id || tentativa.finalizadaEm) return;
    const novo = d.data();
    if (novo.finalizadaEm) {   // o professor encerrou/barrou ou o servidor encerrou pelas vidas
      tentativa = { ...tentativa, ...novo, id }; pararTimerFora(); foraDaProva = false; sairTelaCheia(); pararOuvinteProva();
      toast(novo.encerradaPor === "barrado" ? "O professor encerrou a sua prova." : "Sua prova foi encerrada.", "erro");
      mostrarFim(); return;
    }
    if (!modoTeste && novo.sessao && novo.sessao !== ID_DISPOSITIVO) {   // o professor liberou e outro computador assumiu
      pararTimerFora(); foraDaProva = false; sairTelaCheia(); pararOuvinteProva(); tentativa = null;
      avisoEntrada("💻 A prova foi aberta em outro computador", "Este computador deixou de valer para a sua prova."); return;
    }
    if (Number(novo.foraCobradas || 0) > foraCobradas && foraDaProva) foraCobradas = Number(novo.foraCobradas);
    const vidasAntes = limiteSaidas() - (tentativa.trocasDeAba || 0), minAntes = Number(tentativa.minutosExtras || 0);
    const restAntes = tentativa.vidasRestauradasEm?.toMillis?.() || 0, restDepois = novo.vidasRestauradasEm?.toMillis?.() || 0;
    ["trocasDeAba", "trocasDeAbaTotal", "vidasExtras", "minutosExtras", "vidasRestauradasEm", "dicas"].forEach(k => { tentativa[k] = novo[k]; });
    atualizarDica();
    const vidasDepois = limiteSaidas() - (tentativa.trocasDeAba || 0);
    desenharVidas();
    if (vidasDepois < vidasAntes && conferirPunicao()) return;
    if (Number(novo.minutosExtras || 0) !== minAntes) {
      iniciarCronometro();
      if (Number(novo.minutosExtras || 0) > minAntes) toast(`⏱ O professor deu mais ${Number(novo.minutosExtras) - minAntes} min para você.`, "ok");
    }
    if (vidasDepois > vidasAntes) {
      reagirMascote("comemorando");
      toast(`❤️ O professor restaurou suas vidas! Agora você tem ${vidasDepois === 1 ? "1 vida" : `${vidasDepois} vidas`}.`, "ok");
    }
    // restaurou e havia questão perdida: o painel apagou a "perdida"; recarrega para voltar nela
    if (restDepois && restDepois !== restAntes && Object.values(respostas).some(r => r?.perdida)) {
      carregarTentativa().then(() => toast("❤️ O professor devolveu a questão que você tinha perdido.", "ok")).catch(e => console.warn(e));
    }
  }, e => console.warn("acompanhamento da tentativa parou", e));
}
// O professor reabriu a prova (ex.: aluno com TEA encerrado pelo limite de vidas): volta para as questões.
async function provaReaberta(novo) {
  pararOuvinteFim();
  tentativa = { id: tentativa.id, ...novo };
  chamouCorretor.delete(tentativa.id); marcadoresConferidos.delete(tentativa.id);
  if (provaAtual?.liberada === false && !modoTeste) { toast("O professor reabriu sua prova, mas ela está encerrada. Avise o professor.", "erro"); return; }
  try {
    await carregarTentativa();
    if (!tentativa.finalizadaEm && !$("#telaQuestao").classList.contains("oculto")) mostrarSobreposicao("reaberta");
  } catch (e) { toast("Não foi possível voltar para a prova. " + traduzirErro(e), "erro"); console.error(e); }
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
  if (!q) { card.innerHTML = `<p class="pequeno">Questão ${i + 1} indisponível. Avise o professor.</p><div class="acoes-questao"></div>`; return card; }
  const tipo = temFormato(q) ? FORMATOS[q.formato].nome.toLowerCase() : q.tipo === "alternativa" ? "múltipla escolha" : q.tipo === "sql" ? "SQL na Bancada" : q.tipo === "web" ? "projeto web" : q.tipo === "diagrama" ? (NOMES_DIAGRAMA[q.diagrama] || "diagrama").toLowerCase() : "resposta escrita", colar = colarPermitido(), voltar = podeVoltar();
  if (q.tipo === "sql" || q.tipo === "web" || q.tipo === "diagrama") card.classList.add("questao-sql");
  // cartão em três partes: cabeçalho (número e tipo) · corpo (enunciado e resposta) · rodapé (enviar)
  card.innerHTML = `<div class="q-cab"><span class="q-num">Questão ${i + 1}<small> de ${tentativa.questoesIds.length}</small></span><span class="tag">${tipo}</span>${q.adaptada ? `<span class="tag nota">♿ adaptada</span>` : ""}<span class="tag ok q-enviada oculto">✓ ${voltar ? "salva" : "enviada"}</span>
      ${acess && ap().lerEmVoz !== false && "speechSynthesis" in window ? `<button type="button" class="leve mini b-ouvir">🔊 Ouvir</button>` : ""}</div>
    <div class="q-corpo">
      <div class="enunciado">${formatarEnunciado(q.enunciado)}</div>
      ${htmlApoios(q)}
      ${q.formato === "escritaApoio" && q.dados ? `<div class="escrita-apoio">${q.dados.comecoResposta ? `<p><b>✏ Comece assim:</b> ${esc(q.dados.comecoResposta)}…</p>` : ""}${q.dados.checklist?.length ? `<p><b>✅ Não esqueça:</b></p><ul>${q.dados.checklist.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}</div>` : ""}
      <div class="q-rotulo">${temFormato(q) ? rotuloFormato(q) : q.tipo === "alternativa" ? "Escolha uma alternativa" : q.tipo === "diagrama" ? "Monte a resposta no editor abaixo: adicione as peças pela barra, ligue-as e dê dois cliques para escrever os nomes. Ctrl+Z desfaz." : q.tipo === "sql" ? "Escreva o SQL de cada tarefa na aba dela e execute (⚡) para conferir. Cada tarefa é corrigida a partir da base original." : q.tipo === "web" ? "Siga as etapas (à esquerda) e veja o resultado na prévia ao vivo. Use o git para salvar o progresso (commit e push)." : "Sua resposta"}</div>
      <div class="q-area"></div>
      <p class="pequeno q-salva oculto" role="status"></p>
    </div>
    <div class="q-rodape">
      <p class="pequeno q-dica">${voltar ? "Você pode alterar e salvar de novo até clicar em Finalizar prova." : "Confira antes de enviar: depois de enviada, a resposta não pode ser alterada."}</p>
      <div class="acoes-questao">${gami.apontamentos && !modoTeste ? `<button type="button" class="discreto mini b-apontar" title="Avisar o professor sobre um problema nesta questão">🚩 Algo errado nesta questão?</button>` : ""}<button class="ok grande b-enviar"${unica ? ' id="btnEnviar"' : ""}>${voltar ? "Salvar resposta" : "Enviar resposta"} →</button></div>
    </div>
    <div class="q-feedback oculto" role="status"></div>`;
  const area = card.querySelector(".q-area");
  card.querySelector(".b-ouvir")?.addEventListener("click", e => lerQuestao(qid, e.currentTarget));
  card.querySelector(".b-apoio")?.addEventListener("click", e => { falarApoio(qid); e.currentTarget.textContent = rotuloApoio(qid); });
  if (temFormato(q)) {
    controles[qid] = montarFormato(area, q, { aoMudar: () => marcarAlterada(card, qid), nome: "f_" + qid });
  } else if (q.tipo === "alternativa") {
    // sempre embaralhadas, estável para o aluno (semente uid + qid); o valor gravado é o índice ORIGINAL
    const ordem = embaralhar(q.alternativas.map((_, k) => k), eu.uid + qid);
    ordemAlternativas[qid] = ordem;
    area.innerHTML = ordem.map((k, pos) => `<label class="alt"><input type="radio" name="alt_${qid}" value="${k}"><span class="alt-letra">${letra(pos)}</span><span class="alt-texto">${esc(q.alternativas[k])}</span></label>`).join("");
    // "change" cobre clique e teclado (setas) na escolha da alternativa
    area.querySelectorAll(".alt input").forEach(inp => inp.addEventListener("change", () => {
      area.querySelectorAll(".alt").forEach(x => x.classList.toggle("sel", x.contains(inp)));
      marcarAlterada(card, qid);
    }));
  } else if (q.tipo === "web") {
    // Bancada Web (parecida com o VS Code): etapas, explorador, git simulado, comandos HTML/CSS e prévia ao vivo
    bancadas[qid]?.destruir?.();
    const ini = rascunhos.get(qid) || respostas[qid]?.resposta || null;
    valoresWeb[qid] = ini;
    bancadas[qid] = montarBancadaWeb(area, { questao: q, valor: ini, abrirJanela: abrirPreviaPermitida,
      onMudar: () => bancadas[qid]?.valor().then(v => { valoresWeb[qid] = respostaEmBranco(q, v) ? null : v; marcarAlterada(card, qid); }).catch(e => console.warn("bancada web", e)) });
  } else if (q.tipo === "diagrama") {
    // editor de diagramas: casos de uso, matriz de rastreabilidade, Kanban… ou modelo conceitual/lógico (brModelo)
    bancadas[qid]?.destruir?.();
    const ini = rascunhos.get(qid) || respostas[qid]?.resposta || q.inicial || null;
    valoresDiag[qid] = respostaVaziaDiagrama(q, ini) ? null : ini;
    bancadas[qid] = montarDiagramaProva(area, { questao: q, valor: ini,
      onMudar: v => { valoresDiag[qid] = respostaVaziaDiagrama(q, v) ? null : v; marcarAlterada(card, qid); } });
  } else if (q.tipo === "sql") {
    // Bancada SQL (parecida com o MySQL Workbench): o SQL roda aqui no navegador; o resultado de cada tarefa vai junto da resposta
    bancadas[qid]?.destruir?.();
    bancadas[qid] = montarBancada(area, { questao: q, valor: rascunhos.get(qid) || respostas[qid]?.resposta || null, onMudar: () => marcarAlterada(card, qid) });
  } else {
    const idTxt = unica ? "txtResposta" : "txt_" + qid;
    area.innerHTML = `<label for="${idTxt}" class="sr-only">Sua resposta</label>
      <textarea id="${idTxt}" placeholder="Digite sua resposta aqui.${colar ? "" : " Colar está desativado."}" spellcheck="false"></textarea>
      <div class="contador"><span class="q-chars"${unica ? ' id="qChars"' : ""}>0</span> caracteres${colar ? "" : " · Ctrl+V, botão direito e arrastar texto não funcionam neste campo."}</div>`;
    const txt = area.querySelector("textarea");
    txt.addEventListener("input", () => { area.querySelector(".q-chars").textContent = txt.value.length; marcarAlterada(card, qid); });
    if (!colar) bloquearColar(txt);
  }
  card.querySelector(".b-enviar").onclick = () => enviarResposta(qid, card);
  card.querySelector(".b-apontar")?.addEventListener("click", () => apontar(eu, { provaId: provaAtual.id, provaTitulo: provaAtual.titulo, qid, enunciado: q.enunciado }));
  if (respostas[qid]) {   // já gravada (ex.: página recarregada)
    preencherCartao(card, qid, respostas[qid].resposta);
    if (voltar && !respostas[qid].perdida) marcarSalva(card);
    else travarCartao(card);
  }
  if (voltar && rascunhos.has(qid)) {   // alterada e não salva (ex.: sem internet ao trocar de questão)
    preencherCartao(card, qid, rascunhos.get(qid));
    const el = card.querySelector(".q-salva"); el.textContent = "⚠ Alteração ainda não salva."; el.classList.remove("oculto"); el.classList.add("erro-texto");
  }
  if (respostas[qid]?.perdida) { const fb = card.querySelector(".q-feedback"); fb.className = "q-feedback feedback perdida"; fb.innerHTML = `<span class="icone" aria-hidden="true">⛔</span><div><b>Questão perdida</b> por sair da prova.</div>`; }
  return card;
}

// Bancada SQL de cada questão SQL (qid -> { valor(), destruir() })
const bancadas = {};
const textosSql = card => { const o = { tarefas: {} }; card.querySelectorAll("textarea[data-tarefa]").forEach(t => { o.tarefas[t.dataset.tarefa] = { sql: t.value }; }); return o; };
const valoresDiag = {};   // último valor (JSON) de cada editor de diagrama
const valoresWeb = {};   // último valor de cada Bancada Web (o valor dela é calculado de forma assíncrona)
const essencialWeb = v => JSON.stringify(v ? { s: v.slots || null, a: v.arquivos || null, p: v.pastas || null, g: v.git?.commits?.length || 0, u: v.git?.pushes || 0 } : null);
const soTextosSql = v => JSON.stringify(Object.fromEntries(Object.entries(v?.tarefas || {}).map(([k, x]) => [k, String(x?.sql || "")])));
// coloca a resposta gravada no cartão
function preencherCartao(card, qid, resposta) {
  if (["sql", "web", "diagrama"].includes(questoes[qid]?.tipo)) return;   // a Bancada/editor já abriu com o texto salvo
  if (controles[qid] && temFormato(questoes[qid])) return controles[qid].preencher(resposta);
  if (questoes[qid]?.tipo === "alternativa")
    card.querySelectorAll(".alt input").forEach(inp => { inp.checked = resposta !== null && Number(inp.value) === Number(resposta); inp.closest(".alt").classList.toggle("sel", inp.checked); });
  else { const t = card.querySelector("textarea"); if (t) { t.value = resposta ?? ""; card.querySelector(".q-chars").textContent = t.value.length; } }
}
// sem voltar: trava o cartão depois de enviado
function travarCartao(card) {
  controles[card.dataset.qid]?.travar?.();
  if (questoes[card.dataset.qid]?.tipo === "diagrama") bancadas[card.dataset.qid]?.travar?.();
  card.querySelectorAll(".q-area input, .q-area textarea, .q-area select, .q-area button").forEach(c => c.disabled = true);
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
  if (valorDoCartao(card, qid) === null) { el.textContent = "⚠ Em branco não é salvo: continua valendo a resposta salva antes."; el.classList.add("erro-texto"); }
  else if (mudou(card, qid)) { el.textContent = "Alteração ainda não salva."; el.classList.add("erro-texto"); }
  else marcarSalva(card);
}
// valor que está no cartão (null = nada escolhido/escrito)
function valorDoCartao(card, qid) {
  if (questoes[qid]?.tipo === "web") return valoresWeb[qid] ?? null;
  if (questoes[qid]?.tipo === "diagrama") return valoresDiag[qid] ?? null;
  if (questoes[qid]?.tipo === "sql") { const v = textosSql(card); return Object.values(v.tarefas).some(x => x.sql.trim()) ? v : null; }
  if (controles[qid] && temFormato(questoes[qid])) return controles[qid].valor();
  if (questoes[qid]?.tipo === "alternativa") { const m = card.querySelector(".alt input:checked"); return m ? Number(m.value) : null; }
  const v = (card.querySelector("textarea")?.value || "").trim();
  return v || null;
}
// o cartão tem algo diferente do que está gravado?
function mudou(card, qid) {
  const v = valorDoCartao(card, qid);
  if (v !== null && questoes[qid]?.tipo === "web") return essencialWeb(v) !== essencialWeb(respostas[qid]?.resposta);
  if (v !== null && questoes[qid]?.tipo === "sql") {
    const salvas = Object.values(respostas[qid]?.resposta?.tarefas || {}).reduce((s, x) => s + (x?.execucoes?.length || 0), 0);
    return soTextosSql(v) !== soTextosSql(respostas[qid]?.resposta) || (bancadas[qid]?.nExecucoes?.() || 0) !== salvas;   // execuções novas também salvam (histórico de erros)
  }
  return v !== null && JSON.stringify(v) !== JSON.stringify(respostas[qid]?.resposta ?? null);
}

// modo "uma": um cartão por vez
function mostrarQuestao() {
  const i = tentativa.indiceAtual, total = tentativa.questoesIds.length, qid = tentativa.questoesIds[i], q = questoes[qid], voltar = podeVoltar();
  $("#qTitulo").textContent = provaAtual.titulo;
  $("#qContador").textContent = `Questão ${i + 1} de ${total}`;
  $("#qTipo").classList.add("oculto");   // o tipo aparece no cabeçalho do cartão
  $("#qBarra").style.width = `${((voltar ? enviadas() : i) / total) * 100}%`;
  // os botões de navegação ficam dentro do cartão: tira do cartão anterior antes de trocar
  $("#qNav").append($("#btnAnterior"), $("#btnProxima"), $("#btnFinalizar"));
  $("#btnAnterior").classList.toggle("oculto", !voltar || i === 0);
  $("#btnProxima").classList.toggle("oculto", !voltar || i >= total - 1);
  $("#btnFinalizar").classList.toggle("oculto", !voltar);
  clearTimeout(timerApoio);
  const card = criarCartaoQuestao(qid, i, true);
  $("#qLista").replaceChildren(card);
  card.querySelector(".acoes-questao")?.append($("#btnAnterior"), $("#btnProxima"), $("#btnFinalizar"));
  // sem voltar: questão já enviada (ex.: o tempo de mostrar o botão passou) mostra o próximo passo
  if (!voltar && respostas[qid]) (i >= total - 1 ? $("#btnFinalizar") : $("#btnProxima")).classList.remove("oculto");
  desenharFaixa();
  entrarNaTelaDaProva();
  // acessibilidade: o mascote já fala o 1º apoio da questão (depois da fala de abertura, se ela acabou de aparecer)
  if (temApoio(questoes[qid]) && mascoteLigado() && !respostas[qid]) {
    apoioVez[qid] = 0;
    timerApoio = setTimeout(() => { if (tentativa?.questoesIds[tentativa.indiceAtual] === qid) { falarApoio(qid); const b = $("#qLista .b-apoio"); if (b) b.textContent = rotuloApoio(qid); } },
                            Math.max(500, fimFalaInicio - Date.now()));
  }
}

// ---------- HUD da prova: vidas (corações), questões respondidas e o mascote reagindo ----------
function desenharVidas(perdeu = false) {
  const el = $("#hudVidas"), lim = limiteSaidas();
  el.classList.toggle("oculto", !lim || !tentativa);
  if (!lim || !tentativa) return;
  const restam = Math.max(0, lim - (tentativa.trocasDeAba || 0));
  el.innerHTML = Array.from({ length: lim }, (_, k) => `<span class="coracao${k < restam ? "" : " apagado"}${perdeu && k === restam ? " quebrando" : ""}">${k < restam ? "❤️" : "🖤"}</span>`).join("");
  el.title = `${restam} de ${lim} vidas`;
  el.setAttribute("aria-label", `Vidas: ${restam} de ${lim}`);
  el.classList.toggle("ultima", restam === 1);
  if (perdeu) {
    el.classList.remove("tremendo"); void el.offsetWidth; el.classList.add("tremendo"); reagirMascote("triste");
    falarHud(restam ? `Opa! Você perdeu 1 vida. ${restam === 1 ? "Resta só 1" : `Restam ${restam}`}: fique nesta tela, tá? ❤️` : "Suas vidas acabaram. 💔", 6000);
  }
}
function atualizarXp() {
  if (!tentativa) return;
  const total = tentativa.questoesIds.length, n = enviadas();
  $("#hudXp").innerHTML = `<b>${n}</b><small>/${total}</small>`;
}
let humorHud = "feliz", timerHumor = null;
function desenharHudMascote() {
  const el = $("#hudMascote");
  el.innerHTML = mascoteLigado() ? htmlMascote(humorHud, { classe: "hud-m", animado: false }) : "";
}
// ---------- DICAS (prova.dicasMax > 0): o aluno pede uma dica clicando no mascote (ou no botão 💡) ----------
// Vale para a prova toda (ex.: 3 dicas). Quem dá é o servidor (confere o limite e grava na tentativa: fica registrado
// para o professor). A dica é curta e não entrega a resposta (diferente dos apoios da acessibilidade).
const dicasMax = () => Math.max(0, Math.round(Number(provaAtual?.dicasMax || 0)));
const dicasUsadas = () => Object.keys(tentativa?.dicas || {}).length;
function qidEmFoco() {
  if (!tentativa) return null;
  if (!modoTodas()) return tentativa.questoesIds[tentativa.indiceAtual] || null;
  const cards = [...document.querySelectorAll("#qLista .questao[data-qid]")];
  const foco = document.activeElement?.closest?.(".questao[data-qid]");
  if (foco) return foco.dataset.qid;
  return (cards.find(c => c.getBoundingClientRect().bottom > 120) || cards[0])?.dataset.qid || null;
}
function atualizarDica() {
  const b = $("#btnDica"), m = $("#hudMascote"), max = dicasMax(), on = max > 0 && !!tentativa && !tentativa.finalizadaEm;
  if (b) { b.classList.toggle("oculto", !on); if (on) { const r = Math.max(0, max - dicasUsadas()); b.innerHTML = `💡 Dica <b>${r}</b>`; b.title = `Pedir uma dica para a questão (${r} de ${max} para a prova toda)`; } }
  if (m) { m.classList.toggle("clicavel", on); m.title = on ? "Clique para pedir uma dica" : ""; m.setAttribute("aria-hidden", on ? "false" : "true"); if (on) { m.setAttribute("role", "button"); m.tabIndex = 0; } else { m.removeAttribute("role"); m.removeAttribute("tabindex"); } }
  pintarDicas();
}
// a dica já recebida aparece dentro da questão (para reler)
function pintarDicas() {
  const ds = tentativa?.dicas || {};
  document.querySelectorAll("#qLista .questao[data-qid]").forEach(card => {
    const d = ds[card.dataset.qid];
    let box = card.querySelector(".dica-box");
    if (!d) { box?.remove(); return; }
    if (!box) { box = document.createElement("div"); box.className = "dica-box"; (card.querySelector(".q-enunciado") || card.querySelector(".q-cab"))?.after(box); }
    box.innerHTML = `<span aria-hidden="true">💡</span><div><b>Dica:</b> ${esc(d.texto || "")}</div>`;
  });
}
let pedindoDica = false;
async function pedirDica() {
  if (!emProvaAtiva() || pedindoDica) return;
  const max = dicasMax(), qid = qidEmFoco();
  if (!max || !qid) return;
  const n = tentativa.questoesIds.indexOf(qid) + 1, ja = tentativa.dicas?.[qid];
  if (ja) { falarHud(`💡 ${esc(ja.texto)}`, 12000); pintarDicas(); return; }
  const restam = max - dicasUsadas();
  if (restam <= 0) { falarHud(`Você já usou as ${max} dicas desta prova. Agora é com você! 💪`, 6000); toast(`Você já usou as ${max} dicas da prova.`, "erro"); return; }
  if (!(await confirmar(`Pedir uma dica para a questão ${n}?\n\nVocê tem ${restam} de ${max} dica(s) para a prova TODA. O professor vê que você pediu.`, { titulo: "💡 Pedir dica", ok: "Quero a dica" }))) return;
  pedindoDica = true;
  falarHud("Deixa eu pensar numa dica… 🤔", 15000);
  try {
    if (urlCorretor === undefined) { const c = await getDoc(doc(db, "config", "geral")).catch(() => null); urlCorretor = String(c?.data()?.urlCorretor || "").trim(); }
    if (!urlCorretor) throw new Error("as dicas precisam do servidor de correção (avise o professor)");
    const token = await auth.currentUser.getIdToken();
    const r = await fetch(urlCorretor, { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify({ acao: "dica", tentativaId: tentativa.id, qid }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || "erro " + r.status);
    tentativa.dicas = { ...(tentativa.dicas || {}), [qid]: { texto: d.texto } };
    reagirMascote("falando");
    falarHud(`💡 ${esc(d.texto)}`, 15000);
    atualizarDica();
  } catch (e) { falarHud("", 1); toast("Não deu para pegar a dica: " + e.message, "erro"); }
  finally { pedindoDica = false; }
}
$("#hudMascote").addEventListener("click", () => { if (dicasMax() > 0) pedirDica(); });
$("#hudMascote").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && dicasMax() > 0) { e.preventDefault(); pedirDica(); } });
$("#btnDica")?.addEventListener("click", pedirDica);

// balão do mascote na barra da prova: dicas curtas (nunca diz se acertou)
let timerFala = null;
function falarHud(texto, ms = 5000) {
  const el = $("#hudFala");
  if (!mascoteLigado() || !texto) { el.classList.add("oculto"); return; }
  el.innerHTML = `<b>${esc(dadosMascote().nome)}:</b> ${texto}`;
  el.classList.remove("oculto", "entrando"); void el.offsetWidth; el.classList.add("entrando");
  clearTimeout(timerFala); timerFala = setTimeout(() => el.classList.add("oculto"), ms);
}
// ---------- apoios das questões adaptadas: quem mostra é o MASCOTE (balão da barra da prova) ----------
// Com o mascote desligado, os apoios aparecem num quadro dentro da questão.
let timerApoio = null;
const apoioVez = {};   // qid -> índice do próximo apoio a falar
function temApoio(q) { return !!q && Array.isArray(q.apoios) && q.apoios.length > 0 && ap().mostrarDica !== false; }
function htmlApoios(q) {
  if (!temApoio(q)) return "";
  if (mascoteLigado()) return `<div class="apoio-mascote">${htmlMascote("feliz", { classe: "apoio-m", animado: false })}
      <button type="button" class="leve b-apoio">💡 Pedir ajuda ao ${esc(dadosMascote().nome)}</button></div>`;
  return `<div class="apoio"><span aria-hidden="true">💡</span><div><b>Apoio:</b> ${q.apoios.length > 1 ? `<ul>${q.apoios.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` : esc(q.apoios[0])}</div></div>`;
}
function rotuloApoio(qid) {
  const n = questoes[qid]?.apoios?.length || 0;
  return n > 1 ? `💡 Outra ajuda (${(apoioVez[qid] || 0) % n + 1} de ${n})` : `💡 Ouvir a ajuda de novo`;
}
function falarApoio(qid) {
  const l = questoes[qid]?.apoios || []; if (!l.length) return;
  const k = (apoioVez[qid] || 0) % l.length;
  apoioVez[qid] = k + 1;
  reagirMascote("feliz");
  falarHud(`💡 ${esc(l[k])}${l.length > 1 ? ` <small>(${k + 1} de ${l.length})</small>` : ""}`, Math.max(9000, l[k].length * 90));
  $("#hudFala")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
const FRASES_ENVIO = ["Resposta enviada! Bora pra próxima. 💪", "Boa! Uma a menos.", "Enviada! Continue no seu ritmo.", "Feito! Respira e segue."];
function reagirMascote(humor) {
  humorHud = humor; desenharHudMascote();
  clearTimeout(timerHumor);
  timerHumor = setTimeout(() => { humorHud = "feliz"; desenharHudMascote(); }, 2500);
}
// mascote na sobreposição de aviso (saiu da tela cheia, trocou de aba, perdeu a questão)
function mostrarMascoteAviso(box, icone, humor) {
  const on = mascoteLigado();
  box.innerHTML = on ? htmlMascote(humor, { classe: "aviso-m" }) : "";
  icone.classList.toggle("oculto", on);
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
    `<button type="button" class="mini ${rascunhos.has(qid) ? "rascunho" : respostas[qid] ? "respondida" : "pendente"}${i === atual ? " atual" : ""}" data-ir="${i}"
       aria-label="Questão ${i + 1}: ${rascunhos.has(qid) ? "alteração não salva" : respostas[qid] ? "respondida" : "sem resposta"}"${i === atual ? ' aria-current="step"' : ""}>${i + 1}</button>`).join("");
  box.querySelectorAll("[data-ir]").forEach(b => b.onclick = () => {
    const i = Number(b.dataset.ir);
    if (modoTodas()) $("#q_" + tentativa.questoesIds[i])?.scrollIntoView({ behavior: "smooth", block: "start" });
    else irPara(i);
  });
}

// relógio da prova: data e hora completas (com segundos), além do tempo restante
setInterval(() => {
  const el = $("#hudRelogio"); if (!el || !document.body.classList.contains("em-prova")) return;
  const d = new Date(agoraServidor());
  el.textContent = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) + " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}, 1000);
let falouInicio = null, fimFalaInicio = 0;
function entrarNaTelaDaProva() {
  mostrar("telaQuestao");
  desenharVidas(); atualizarXp(); desenharHudMascote();
  if (falouInicio !== tentativa.id) {   // uma vez por prova: o mascote dá a dica de abertura
    falouInicio = tentativa.id;
    const lim = limiteSaidas();
    falarHud(`Leia cada questão com calma.${lim ? ` Você tem ${lim === 1 ? "1 vida" : `${lim} vidas`}: não saia desta tela!` : ""} Boa prova! 🍀`, 7000);
    fimFalaInicio = Date.now() + 7000;
  }
  prepararConsulta();
  atualizarDica();
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

// campo de resposta: colar/arrastar bloqueado, e cada tentativa fica registrada (e tira uma vida, se a prova tiver vidas)
let ultimoColar = 0;
function tentativaDeColar(e) {
  e.preventDefault();
  const agora = Date.now();
  if (agora - ultimoColar < 800) return;   // o mesmo gesto dispara mais de um evento
  ultimoColar = agora;
  registrar("tentativasColar");
  registrarSaida("colar");
  if (limiteSaidas() && colarTiraVida()) { perderVida("colar"); return; }
  toast("Colar está desativado nesta prova. A tentativa fica registrada.", "erro");
}
function bloquearColar(el) {
  const tentouColar = tentativaDeColar;
  el.setAttribute("data-colar-protegido", "");
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
  let resposta = valorDoCartao(card, qid);
  if (resposta === null) {
    if (silencioso) return true;
    toast(temFormato(q) ? "Responda a questão antes de enviar." : q.tipo === "alternativa" ? "Escolha uma alternativa." : q.tipo === "web" ? "Comece o projeto (preencha pelo menos um espaço) antes de enviar." : q.tipo === "diagrama" ? "Monte o diagrama antes de enviar." : q.tipo === "sql" ? "Escreva o SQL de pelo menos uma tarefa antes de enviar." : "Escreva a resposta antes de enviar.", "erro"); return false;
  }
  // SQL: roda cada tarefa numa cópia nova da base e guarda a "impressão" do resultado (o servidor compara com o gabarito)
  if (q.tipo === "sql" && bancadas[qid]) { try { resposta = await bancadas[qid].valor(); } catch (e) { console.warn("bancada", e); } }
  if (q.tipo === "web" && bancadas[qid]) { try { const v = await bancadas[qid].valor(); if (!respostaEmBranco(q, v)) resposta = valoresWeb[qid] = v; } catch (e) { console.warn("bancada web", e); } }
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
    rascunhos.delete(qid);
    marcoTempo = Date.now();
    erroEnvio = false; atualizarBanner();
    preencherCartao(card, qid, final);
    if (voltar) marcarSalva(card); else travarCartao(card);
    atualizarXp(); reagirMascote("comemorando");   // comemora o ENVIO (nunca diz se acertou)
    if (!voltar) falarHud(enviadas() >= tentativa.questoesIds.length ? "Última enviada! Agora é só finalizar. 🎉" : FRASES_ENVIO[enviadas() % FRASES_ENVIO.length], 3500);
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
    enviandoQ.delete(qid); enviando--; btn.disabled = false; btn.textContent = voltar ? "Salvar resposta →" : "Enviar resposta →";
  }
}

// Grava a resposta. Os marcadores (que liberam o gabarito) só são gravados depois de finalizar.
// Sem voltar: se uma tentativa anterior desta questão deu erro/tempo esgotado, ela pode ter chegado ao servidor
// mesmo assim: confere no servidor antes de gravar de novo (resposta não pode ser sobrescrita).
// Ir e voltar: a 1ª gravação cria (enviadaEm); as seguintes atualizam resposta, segundos e atualizadaEm.
const tentouEnviar = new Set();
const rascunhos = new Map();   // ir e voltar: qid -> valor alterado que ainda não foi salvo
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
  const card = $("#qLista .questao"), qidAtual = tentativa.questoesIds[tentativa.indiceAtual];
  if (card && !(await enviarResposta(qidAtual, card, { silencioso: true }))) {
    // não salvou (sem internet?): guarda o que estava na tela e deixa trocar; salva depois
    if (tentativa.finalizadaEm) return;
    const v = valorDoCartao(card, qidAtual);
    if (v !== null) rascunhos.set(qidAtual, v);
  }
  if (tentativa.finalizadaEm) return;
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
// ir e voltar: salva o que estiver alterado (na tela e os rascunhos). Devolve false se algo não foi salvo.
async function salvarTudo() {
  let ok = true;
  for (const card of document.querySelectorAll("#qLista .questao"))
    if (!(await enviarResposta(card.dataset.qid, card, { silencioso: true }))) ok = false;
  for (const [qid, v] of [...rascunhos]) {
    if (tentativa.finalizadaEm) break;
    if (document.querySelector(`#qLista .questao[data-qid="${qid}"]`)) continue;   // já tentou pelo cartão
    try {
      const segundos = respostas[qid]?.segundos || 0;
      await gravarResposta(qid, v, segundos);
      respostas[qid] = { resposta: v, segundos }; rascunhos.delete(qid);
    } catch (e) { ok = false; }
  }
  desenharFaixa();
  return ok;
}
$("#btnFinalizar").onclick = async () => {
  if (podeVoltar() && !(await salvarTudo())) {
    if (tentativa.finalizadaEm) return;
    toast("Algumas respostas alteradas NÃO foram salvas (sem internet?). Tente Finalizar de novo quando a conexão voltar.", "erro"); return;
  }
  if (tentativa.finalizadaEm) return;   // o tempo pode ter acabado enquanto salvava
  if (modoTodas() || podeVoltar()) {
    const faltam = tentativa.questoesIds.map((q, i) => respostas[q] ? null : i + 1).filter(Boolean);
    const verbo = podeVoltar() ? ["foi salva", "foram salvas", "salva"] : ["foi enviada", "foram enviadas", "enviada"];
    const ok = faltam.length
      ? await confirmar(`${faltam.length === 1 ? "A questão" : "As questões"} ${listaHumana(faltam)} ainda não ${faltam.length === 1 ? verbo[0] : verbo[1]}. Resposta não ${verbo[2]} não conta.\n\nFinalizar mesmo assim? As que faltam ficam em branco.`,
          { titulo: "Questões sem resposta", ok: "Finalizar mesmo assim", cancelar: "Voltar para a prova", perigo: true })
      : !podeVoltar() || await confirmar("Finalizar a prova? Depois disso as respostas não podem mais ser alteradas.", { titulo: "Finalizar prova", ok: "Finalizar", cancelar: "Voltar para a prova" });
    if (tentativa.finalizadaEm) return;
    if (!ok) {
      if (faltam.length) { if (modoTodas()) $("#q_" + tentativa.questoesIds[faltam[0] - 1])?.scrollIntoView({ behavior: "smooth", block: "start" }); else irPara(faltam[0] - 1); }
      return;
    }
  }
  finalizar();
};

// Encerrar a prova a qualquer momento (em qualquer modo): o que não foi respondido fica em branco e vale zero
$("#btnEncerrar").onclick = async () => {
  if (!tentativa || tentativa.finalizadaEm) return;
  if (podeVoltar()) await salvarTudo();   // salva o que der; o que não salvar fica em branco
  if (tentativa.finalizadaEm) return;
  const faltam = tentativa.questoesIds.map((q, i) => respostas[q] ? null : i + 1).filter(Boolean);
  const total = tentativa.questoesIds.length;
  const msg = !faltam.length
    ? "Todas as questões já foram respondidas. Encerrar a prova agora? Depois disso nada pode ser alterado."
    : (faltam.length === total ? `Você ainda não respondeu nenhuma das ${total} questões.` : `${faltam.length === 1 ? "A questão" : "As questões"} ${listaHumana(faltam)} ${faltam.length === 1 ? "está" : "estão"} sem resposta.`) +
      `\n\n${faltam.length === 1 ? "Ela fica" : "Elas ficam"} EM BRANCO e ${faltam.length === 1 ? "vale" : "valem"} zero.` +
      (podeVoltar() ? "" : " O que está na tela e ainda não foi enviado também não conta.") +
      "\n\nEncerrar a prova mesmo assim? Não dá para voltar depois.";
  const ok = await confirmar(msg, { titulo: "Encerrar a prova", ok: "Encerrar a prova", cancelar: "Continuar fazendo", perigo: true });
  if (!ok || tentativa.finalizadaEm) return;
  finalizar({ encerradaPor: faltam.length ? "aluno" : undefined });
};

let finalizando = false;
async function finalizar(opc = {}) {
  if (finalizando || !tentativa || tentativa.finalizadaEm) return;
  finalizando = true;
  try {
    const fim = { finalizadaEm: serverTimestamp(), indiceAtual: tentativa.questoesIds.length };
    if (opc.encerradaPor) fim.encerradaPor = opc.encerradaPor;   // ex.: "trocasDeAba" (limite de saídas)
    if (tentativa.iniciadaEm?.toMillis) fim.tempoTotalSegundos = Math.max(0, Math.round((Date.now() - tentativa.iniciadaEm.toMillis()) / 1000));
    try { await comLimiteDeTempo(updateDoc(doc(db, "tentativas", tentativa.id), fim), 20000); }
    catch (e) {
      // pode ter chegado ao servidor mesmo com erro/tempo esgotado: confere antes de mostrar erro
      const ja = await getDocFromServer(doc(db, "tentativas", tentativa.id)).catch(() => null);
      if (!ja?.data()?.finalizadaEm) throw e;
    }
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

// garante os marcadores (se a finalização foi interrompida antes de gravá-los) — uma vez por tentativa nesta página
const marcadoresConferidos = new Set();
async function marcadoresAntes() {
  if (modoTeste || !tentativa?.finalizadaEm || marcadoresConferidos.has(tentativa.id)) return;
  marcadoresConferidos.add(tentativa.id);
  const faltam = (await Promise.all(tentativa.questoesIds.map(qid => getDoc(doc(db, "marcadores", `${eu.uid}_${qid}`)).then(d => d.exists() ? null : qid).catch(() => qid)))).filter(Boolean);
  if (faltam.length) await Promise.allSettled(faltam.map(qid =>
    setDoc(doc(db, "marcadores", `${eu.uid}_${qid}`), { uid: eu.uid, qid, provaId: tentativa.provaId, criadoEm: serverTimestamp() })));
}

// ---------- placar (o aluno vê só quantas acertou e a nota) ----------
// O painel do professor grava o placar oficial na tentativa (com as correções da IA/manuais);
// enquanto isso não acontece, calcula aqui com o gabarito (liberado pelos marcadores depois de finalizar).
// questão (com a adaptação do aluno, se houver) e gabarito: o do banco, ou o privado do formato adaptado
// (os dois só abrem depois de finalizar a prova, pelos marcadores)
async function questaoEGabarito(qid, bancoId, usarCache = false) {
  let q = usarCache && questoes[qid] ? questoes[qid] : (await getDoc(doc(db, "bancos", bancoDaQuestao(qid, bancoId), "questoes", qid)).catch(() => null))?.data() || null;
  if (q && acess && !usarCache) { const ad = await getDoc(doc(db, "acessibilidade", acess.email, "questoes", qid)).catch(() => null); if (ad?.exists()) q = mesclarQuestao(q, ad.data()); }
  const gd = q && temFormato(q) && acess ? await getDoc(doc(db, "acessibilidadePrivado", acess.email, "gabaritos", qid)).catch(() => null)
                                         : await getDoc(doc(db, "bancos", bancoDaQuestao(qid, bancoId), "gabaritos", qid)).catch(() => null);
  return { q, g: gd?.exists?.() ? gd.data() : null };
}
async function placarDaTentativa(t) {
  if (typeof t.acertos === "number") return { acertos: t.acertos, totalQuestoes: t.totalQuestoes, nota: t.nota ?? t.notaPrevia, pendentes: t.aguardandoCorrecao || 0 };
  const ids = t.questoesIds, banco = t.bancoId;
  const [qgs, rs] = await Promise.all([Promise.all(ids.map(q => questaoEGabarito(q, banco, tentativa?.id === t.id))), getDocs(collection(db, "tentativas", t.id, "respostas"))]);
  const resp = {}; rs.forEach(d => resp[d.id] = d.data());
  const itens = ids.map((qid, i) => {
    const q = qgs[i].q || { peso: 1 }, peso = Number(q.peso || 1);
    if (!qgs[i].g) return { pontos: 0, peso, status: resp[qid] ? "revisar" : "em_branco" };   // sem gabarito legível: conta como em correção
    return { peso, ...corrigir(q, qgs[i].g, resp[qid]?.resposta ?? undefined, resp[qid]?.perdida === true) };
  });
  const p = placar(itens);
  return { acertos: p.acertos, totalQuestoes: p.totalQuestoes, nota: t.nota ?? p.notaPrevia, pendentes: p.aguardandoCorrecao };
}
function notaFinalAluno(prova, nota) {
  const v = Number(prova?.valeAte?.[String(eu?.email || "").toLowerCase()]);
  if (!(v > 0) || nota === undefined || nota === null) return null;
  const sub = prova?.tipoPorAluno?.[String(eu.email).toLowerCase()] === "substitutiva", tipo = sub ? "substitutiva" : "recuperação";
  const br = n => String(n).replace(".", ",");
  return { texto: `${br(calcNotaFinal(nota, v, regraDoTipo(prova, sub ? "substitutiva" : "recuperacao")))} de ${br(v)}`, tipo };
}
function textoPlacarCurto(r, prova = null) {
  const f = notaFinalAluno(prova, r.nota);
  return `acertou <b>${r.acertos}</b> de ${r.totalQuestoes} · nota <b>${r.nota}</b>${f ? ` · <b>nota final (${f.tipo}): ${f.texto}</b>` : ""}${r.pendentes ? ` <span class="pequeno">(${r.pendentes} em correção)</span>` : ""}`;
}

let ouvinteFim = null, ouvinteProvaFim = null, desenhoFim = 0;
function pararOuvinteFim() {
  if (ouvinteFim) { ouvinteFim(); ouvinteFim = null; }
  if (ouvinteProvaFim) { ouvinteProvaFim(); ouvinteProvaFim = null; }
}
function mostrarFim() {
  pararCronometro();
  mostrar("telaFim");
  $("#fimNota").innerHTML = "";
  marcadoresAntes().then(desenharFim);
  // o painel do professor grava o placar na tentativa quando corrige: a tela troca os números sozinha
  pararOuvinteFim();
  const id = tentativa.id;
  ouvinteFim = onSnapshot(doc(db, "tentativas", id), d => {
    if (!d.exists() || tentativa?.id !== id) return;
    const novo = d.data();
    if (!novo.finalizadaEm && tentativa.finalizadaEm) { provaReaberta(novo); return; }   // o professor reabriu a prova
    if (["acertos", "notaPrevia", "aguardandoCorrecao", "nota"].some(k => novo[k] !== tentativa[k])) { Object.assign(tentativa, novo); desenharFim(); }
  }, e => console.warn("placar ao vivo parou", e));
  // o professor pode liberar o gabarito com esta tela aberta (prova encerrada e sem gabarito: sem permissão, ignora)
  if (!modoTeste) ouvinteProvaFim = onSnapshot(doc(db, "provas", tentativa.provaId), d => {
    if (!d.exists() || provaAtual?.id !== d.id) return;
    const lib = d.data().resultadosLiberados === true;
    if (lib !== (provaAtual.resultadosLiberados === true)) { provaAtual.resultadosLiberados = lib; desenharFim(); }
  }, () => {});
}
// ---------- servidor de correção automática (Cloudflare Worker, opcional: config/geral.urlCorretor) ----------
// Ao finalizar, pede ao servidor para corrigir as dissertativas desta tentativa. A chave da IA fica no servidor;
// daqui só vai o "crachá" do login. A resposta não importa: a tela atualiza pela tentativa (onSnapshot).
let urlCorretor;   // undefined = ainda não leu
const chamouCorretor = new Set();
async function pedirCorrecao() {
  if (!tentativa?.finalizadaEm || chamouCorretor.has(tentativa.id)) return;
  chamouCorretor.add(tentativa.id);
  try {
    if (urlCorretor === undefined) {
      const c = await getDoc(doc(db, "config", "geral")).catch(() => null);
      urlCorretor = String(c?.data()?.urlCorretor || "").trim();
    }
    if (!urlCorretor) return;
    const token = await auth.currentUser.getIdToken();
    const r = await fetch(urlCorretor, { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
                                         body: JSON.stringify({ tentativaId: tentativa.id }) });
    if (!r.ok) console.warn("servidor de correção", r.status, await r.text().catch(() => ""));
  } catch (e) { console.warn("servidor de correção", e); }
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
  if (r?.pendentes) pedirCorrecao();   // dissertativas sem correção: chama o servidor (uma vez por tentativa nesta página)
  desenharCelebracao(r);
  $("#fimNota").innerHTML = avisos + (r ? `
    <p class="placar">Você acertou <b>${r.acertos}</b> de <b>${r.totalQuestoes}</b></p>
    <p class="placar-nota">Nota: <b>${r.nota}</b> / 100</p>
    ${(f => f ? `<p class="placar-nota">Nota final da ${f.tipo}: <b>${f.texto}</b></p>` : "")(notaFinalAluno(provaAtual, r.nota))}
    ${r.pendentes ? `<p class="aviso-box">✍ ${r.pendentes === 1 ? "1 resposta ainda vai ser corrigida" : `${r.pendentes} respostas ainda vão ser corrigidas`}; o total pode mudar. Esta tela atualiza sozinha.</p>` : ""}` : `<p class="pequeno">Não foi possível calcular o resultado agora. Volte para a lista de provas e abra de novo.</p>`) +
    (liberado ? "" : `<p class="pequeno">Quais você acertou e o gabarito aparecem quando o professor liberar.</p>`);
  $("#btnVerResultadoTeste").classList.toggle("oculto", !liberado);
}

$("#btnVerResultadoTeste").onclick = () => verResultado();

// Tela final gamificada: estrelas pela nota, mascote comemorando (ou dando força) e confete.
// Com respostas ainda em correção, as estrelas esperam a nota.
function estrelasDa(nota) { return nota >= 90 ? 3 : nota >= 70 ? 2 : nota >= 50 ? 1 : 0; }
function desenharCelebracao(r) {
  const on = mascoteLigado(), m = dadosMascote();
  const nota = Number(r?.nota ?? 0), pend = !!r?.pendentes, n = r ? estrelasDa(nota) : 0;
  const humor = !r || pend ? "feliz" : n >= 2 ? "comemorando" : n === 1 ? "feliz" : "triste";
  const frase = !r ? "Terminou! Suas respostas foram registradas."
    : pend ? "Mandou bem em terminar! Algumas respostas escritas ainda vão ser corrigidas, então as estrelas podem mudar."
    : n === 3 ? "UAU! Que prova! Você arrasou! 🏆"
    : n === 2 ? "Muito bem! Mandou bem demais! 🎉"
    : n === 1 ? "Boa! Você passou desta fase. Dá pra subir mais na próxima! 💪"
    : "Essa foi difícil, né? Revise o conteúdo com calma que na próxima vai melhor. 💪";
  $("#fimMascote").innerHTML = on ? `<div class="saudacao-linha centro-m">${htmlMascote(humor, { classe: "fim-m" })}
      <div class="balao"><div class="balao-nome">${esc(m.nome)}</div><div class="balao-texto">${frase}</div></div></div>` : "";
  $("#fimTitulo").textContent = tentativa?.encerradaPor === "trocasDeAba" ? "Prova encerrada" : "Prova finalizada ✅";
  $("#fimEstrelas").innerHTML = r && !pend ? [0, 1, 2].map(k => `<span class="estrela${k < n ? " on" : ""}" style="animation-delay:${0.25 + k * 0.3}s">★</span>`).join("") : "";
  const conf = $("#fimConfete");
  conf.innerHTML = "";
  if (r && !pend && n >= 2 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const cores = ["#c1272d", "#f4b400", "#1f7a4d", "#1d5fa8", "#9b59b6"];
    conf.innerHTML = Array.from({ length: 40 }, (_, k) => `<i style="left:${Math.random() * 100}%;background:${cores[k % cores.length]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2.2 + Math.random() * 1.6}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join("");
  }
}

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
// Dois tipos: PDFs enviados ao sistema (leitor próprio, dentro da página; vários, com abas) ou link externo (iframe).
let consultaUrlAtual = null, consultaTimer = null, leitorAtual = null, leitorArquivoId = null;
let consultaIds = [], consultaAtiva = null;
const titulosMaterial = {}, paginaMaterial = {};   // id -> título / página em que o aluno parou
function prepararConsulta() {
  const tem = temConsulta(), fr = $("#consultaFrame");
  $("#provaLayout").classList.toggle("com-consulta", tem);
  $("#painelConsulta").classList.toggle("oculto", !tem); $("#btnConsulta").classList.toggle("oculto", !tem);
  const ids = tem ? idsConsulta(provaAtual) : [];
  if (!ids.length && leitorAtual) fecharLeitor();
  if (!tem || ids.length) { if (consultaUrlAtual) { fr.removeAttribute("src"); consultaUrlAtual = null; } }
  if (!ids.length) { consultaIds = []; consultaAtiva = null; $("#consultaAbas").classList.add("oculto"); }
  if (!tem) return;
  $("#consultaTitulo").textContent = provaAtual.materialConsultaTitulo || "material de consulta";
  fr.classList.toggle("oculto", ids.length > 0); $("#consultaLeitor").classList.toggle("oculto", !ids.length);
  if (ids.length) {
    if (consultaIds.join() !== ids.join()) { consultaIds = ids; desenharAbasConsulta(); }
    $("#consultaAbas").classList.toggle("oculto", ids.length < 2);
    const alvo = ids.includes(consultaAtiva) ? consultaAtiva : ids[0];
    if (leitorArquivoId !== alvo) carregarArquivoConsulta(alvo);   // não recarrega a cada questão
    return;
  }
  if (consultaUrlAtual !== provaAtual.materialConsultaUrl) carregarConsulta(provaAtual.materialConsultaUrl);
}
// abas com o título de cada PDF (só o PDF aberto é baixado; os outros só quando o aluno clicar)
async function desenharAbasConsulta() {
  const box = $("#consultaAbas"), ids = consultaIds;
  box.innerHTML = ids.map((id, i) => `<button type="button" role="tab" class="mini" data-mat="${esc(id)}">${esc(titulosMaterial[id] || `PDF ${i + 1}`)}</button>`).join("");
  box.querySelectorAll("[data-mat]").forEach(b => b.onclick = () => { if (b.dataset.mat !== leitorArquivoId) carregarArquivoConsulta(b.dataset.mat); });
  marcarAbaAtiva();
  await Promise.all(ids.filter(id => !(id in titulosMaterial)).map(id => getDoc(doc(db, "materiais", id))
    .then(d => { titulosMaterial[id] = d.exists() ? d.data().titulo || "PDF" : "PDF apagado"; }).catch(() => {})));
  if (consultaIds !== ids) return;
  box.querySelectorAll("[data-mat]").forEach(b => { if (titulosMaterial[b.dataset.mat]) { b.textContent = titulosMaterial[b.dataset.mat]; b.title = b.textContent; } });
}
function marcarAbaAtiva() {
  $("#consultaAbas").querySelectorAll("[data-mat]").forEach(b => { const on = b.dataset.mat === consultaAtiva; b.classList.toggle("ativa", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
}
function fecharLeitor() {
  if (leitorAtual && leitorArquivoId) paginaMaterial[leitorArquivoId] = leitorAtual.pagina;   // volta na mesma página depois
  leitorAtual?.destruir(); leitorAtual = null; leitorArquivoId = null;
}
async function carregarArquivoConsulta(id) {
  if (leitorAtual) fecharLeitor();
  leitorArquivoId = id; consultaAtiva = id; marcarAbaAtiva();
  const box = $("#consultaLeitor"), erro = $("#consultaErro");
  erro.classList.add("oculto");
  box.innerHTML = `<p class="pequeno leitor-carregando">Carregando o material…</p>`;
  try {
    const { bytes } = await baixarMaterial(id);   // fica em memória: trocar de aba ou de questão não baixa de novo
    if (leitorArquivoId !== id) return;   // trocou de PDF/prova enquanto carregava
    const leitor = await abrirLeitorPdf(box, bytes, { pagina: paginaMaterial[id] || 1 });
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
$("#btnRecarregarConsulta").onclick = () => consultaIds.length ? carregarArquivoConsulta(consultaAtiva || consultaIds[0]) : carregarConsulta(provaAtual.materialConsultaUrl);
// ---------- espaço dos slides x espaço das questões (computador) ----------
// a largura escolhida fica guardada neste navegador e vale para as próximas provas
const LARGURA_MIN = 280, largMax = () => Math.round(window.innerWidth * 0.75);
function aplicarLarguraConsulta(px, salvar = true) {
  const w = Math.min(largMax(), Math.max(LARGURA_MIN, Math.round(px)));
  $("#painelConsulta").style.setProperty("--largura-consulta", w + "px");
  const div = $("#divisorConsulta");
  div.setAttribute("aria-valuemin", LARGURA_MIN); div.setAttribute("aria-valuemax", largMax()); div.setAttribute("aria-valuenow", w);
  if (salvar) localStorage.setItem("larguraConsulta", String(w));
}
const larguraAtual = () => $("#painelConsulta").getBoundingClientRect().width;
if (Number(localStorage.getItem("larguraConsulta")) > 0) aplicarLarguraConsulta(Number(localStorage.getItem("larguraConsulta")), false);
$("#btnConsultaMais").onclick = () => aplicarLarguraConsulta(larguraAtual() + window.innerWidth * 0.1);
$("#btnConsultaMenos").onclick = () => aplicarLarguraConsulta(larguraAtual() - window.innerWidth * 0.1);
(() => {
  const div = $("#divisorConsulta");
  div.addEventListener("pointerdown", e => {
    e.preventDefault(); div.setPointerCapture(e.pointerId); document.body.classList.add("arrastando");
    const mover = ev => aplicarLarguraConsulta($("#painelConsulta").getBoundingClientRect().right - ev.clientX, false);
    const soltar = () => {
      div.removeEventListener("pointermove", mover); div.removeEventListener("pointerup", soltar); div.removeEventListener("pointercancel", soltar);
      document.body.classList.remove("arrastando"); aplicarLarguraConsulta(larguraAtual());
    };
    div.addEventListener("pointermove", mover); div.addEventListener("pointerup", soltar); div.addEventListener("pointercancel", soltar);
  });
  div.addEventListener("keydown", e => {   // ← mais espaço para os slides, → menos
    if (e.key === "ArrowLeft") { e.preventDefault(); aplicarLarguraConsulta(larguraAtual() + 40); }
    if (e.key === "ArrowRight") { e.preventDefault(); aplicarLarguraConsulta(larguraAtual() - 40); }
  });
  window.addEventListener("resize", () => { const w = Number(localStorage.getItem("larguraConsulta")); if (w > 0) aplicarLarguraConsulta(w, false); });
})();
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

// ---------- log de saídas por questão (subcoleção saidas) ----------
let _saidaRef = null, _saidaTs = null;
function registrarSaida(motivo) {
  if (!tentativa || tentativa.finalizadaEm) return;
  if (!["colar", "extensao"].includes(motivo) && _saidaTs !== null) return;   // já saiu; evita duplo log (ex.: telaCheia + aba simultâneos)
  const i = tentativa.indiceAtual || 0;
  const qid = (tentativa.questoesIds || [])[i] || null;
  if (!["colar", "extensao"].includes(motivo)) { _saidaTs = Date.now(); _saidaRef = null; _voltaPendente = null; }
  addDoc(collection(db, "tentativas", tentativa.id, "saidas"), {
    questaoId: qid, indice: i + 1, motivo, saidaEm: serverTimestamp()
  }).then(ref => { if (!["colar", "extensao"].includes(motivo)) _depoisDaSaida(ref); })
    .catch(e => console.warn("não registrou saída", e));
}
function registrarVolta(vidasTimer = 0) {
  if (!_saidaTs) return;
  const segundosFora = Math.round((Date.now() - _saidaTs) / 1000), ts = _saidaTs;
  _saidaTs = null;
  const gravar = ref => updateDoc(ref, { voltouEm: serverTimestamp(), segundosFora, ...(vidasTimer ? { vidasTimer } : {}) }).catch(() => {});
  if (_saidaRef) { const r = _saidaRef; _saidaRef = null; gravar(r); }
  else _voltaPendente = { ts, gravar };   // o registro da saída ainda está a caminho
}
let _voltaPendente = null;
function _depoisDaSaida(ref) {
  if (_voltaPendente) { const v = _voltaPendente; _voltaPendente = null; v.gravar(ref); return; }
  _saidaRef = ref;
}

// ---------- MODO PROVA: tela cheia + trava de teclado (Keyboard Lock do Chrome/Edge) ----------
// Com a trava, Alt+Tab, tecla Windows, Esc e Alt+F4 chegam à página e são bloqueados (não trocam de janela).
// O que o navegador não deixa bloquear (Ctrl+Alt+Del, Win+L, clicar em outro monitor) é PERCEBIDO e conta como saída.
// Prova com troca de aba permitida: sem trava e sem tela cheia (como antes).
const naoTrava = () => trocaAbaPermitida();
function suportaTelaCheia() { return !!(document.documentElement.requestFullscreen && document.fullscreenEnabled); }
function suportaModoProva() { return suportaTelaCheia() && !!navigator.keyboard?.lock; }
function ehComputador() { const mm = window.matchMedia; return !mm || !(mm("(pointer: coarse)").matches && !mm("(any-pointer: fine)").matches); }
function travarTeclado() { try { navigator.keyboard?.lock?.()?.catch?.(() => {}); } catch { /* sem suporte */ } }
function destravarTeclado() { try { navigator.keyboard?.unlock?.(); } catch { /* sem suporte */ } }
function pedirTelaCheia(permitida = trocaAbaPermitida()) {
  if (permitida || !suportaTelaCheia()) return;
  if (document.fullscreenElement) { travarTeclado(); return; }
  document.documentElement.requestFullscreen({ navigationUI: "hide" }).then(travarTeclado).catch(() => {});
}
function sairTelaCheia() { destravarTeclado(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }

// relógio do servidor (o timer de volta compara com foraDesde, gravado pelo servidor): desvio medido ao abrir a prova
let desvioRelogio = 0;
const agoraServidor = () => Date.now() + desvioRelogio;

// ---------- VIDAS (limite de saídas da prova: maxTrocasDeAba + vidas extras do professor) ----------
// perde uma vida: sair da prova (aba/janela, tela cheia, recarregar), o timer de volta ou (se a prova quiser) tentar colar.
// Um único contador (trocasDeAba) para a punição; o professor pode zerar ("restaurar vidas") pelo painel.
let ultimaSaida = 0;
function perderVida(motivo = "saida") {
  if (!emProvaAtiva()) return false;
  const agora = Date.now();
  if (agora - ultimaSaida < 1000) return false;   // o mesmo movimento dispara mais de um evento
  ultimaSaida = agora;
  registrar("trocasDeAba");
  desenharVidas(true);
  if (conferirPunicao()) return true;
  if (limiteSaidas() > 0 && motivo === "colar") {
    const restam = limiteSaidas() - (tentativa.trocasDeAba || 0);
    reagirMascote("triste");
    toast(`💔 Colar está desativado e custou 1 vida. ${restam === 1 ? "Resta 1 vida" : `Restam ${restam} vidas`}.`, "erro");
  }
  return false;
}
// acabaram as vidas (aqui, pelo timer, pelo painel ou pelo servidor)? aplica a pena
function conferirPunicao() {
  const lim = limiteSaidas();
  if (lim > 0 && emProvaAtiva() && (tentativa.trocasDeAba || 0) >= lim) { pararTimerFora(); aplicarPunicao(); return true; }
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
    if (podeVoltar()) await comLimiteDeTempo(salvarTudo(), 15000).catch(() => {});   // ir e voltar: salva o que estava alterado
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
  entrar:     ["Prova em tela cheia", "Esta prova é feita em tela cheia. Sair da tela cheia, trocar de aba ou de janela e tentar colar fica registrado para o professor.", "Entrar em tela cheia"],
  telaCheia:  ["Você saiu da tela cheia", "Isso fica registrado para o professor. Clique para voltar.", "Voltar para a prova"],
  aba:        ["Você saiu da página da prova", "A troca de aba ou de janela fica registrada para o professor. Clique para voltar.", "Voltar para a prova"],
  recarregou: ["A página da prova foi fechada ou recarregada", "Isso conta como uma saída da prova e fica registrado para o professor. Clique para voltar.", "Voltar para a prova"],
  sistema:    ["Uma janela do sistema abriu por cima da prova", "Parece a janela das Teclas de Aderência (Shift apertado várias vezes). Desta vez é só um aviso, sem perder vida. Feche a janela do Windows (Não/Cancelar) e clique para voltar.", "Voltar para a prova"],
  extensao:   ["Extensão do navegador detectada", "", "Já desliguei: conferir de novo"],
  reaberta:   ["O professor liberou você de novo", "Suas vidas foram restauradas. Respire fundo e continue com calma. 💪", "Continuar a prova"]
};
// "💔 Você perdeu 1 vida. Resta 1 de 3: na próxima, a prova é encerrada."
function textoPlacar() {
  const lim = limiteSaidas();
  if (!lim || !tentativa) return "";
  const restam = Math.max(0, lim - (tentativa.trocasDeAba || 0)), pena = acaoAoExceder() === "encerrar" ? "a prova é encerrada" : "você perde a questão atual";
  return `${coracoes(restam, lim)}  ${restam === 1 ? "Resta 1 vida" : `Restam ${restam} vidas`} de ${lim}. ${restam <= 1 ? "Se perder mais uma" : "Se acabarem"}, ${pena}.`;
}
const coracoes = (restam, lim) => "❤️".repeat(Math.max(0, restam)) + "🖤".repeat(Math.max(0, lim - restam));
let sobreposicaoFixa = false;   // aviso de questão perdida: só fecha com o clique do aluno
let tipoSobreposicao = null;
function mostrarSobreposicao(tipo, texto = null) {
  const [titulo, txt, botao] = tipo === "perdeu" ? ["⛔ Questão perdida", texto, "Continuar na próxima questão"] : AVISOS[tipo];
  sobreposicaoFixa = tipo === "perdeu"; tipoSobreposicao = tipo;
  $("#sobreTitulo").textContent = titulo;
  if (tipo === "extensao") $("#sobreTexto").innerHTML = texto || ""; else $("#sobreTexto").textContent = texto && tipo !== "perdeu" ? texto : txt;
  $("#btnVoltarProva").textContent = botao;
  const placar = tipo === "extensao" ? "" : textoPlacar();
  $("#sobrePlacar").textContent = placar; $("#sobrePlacar").classList.toggle("oculto", !placar);
  mostrarMascoteAviso($("#sobreMascote"), $("#sobreIcone"), tipo === "perdeu" ? "triste" : tipo === "entrar" || tipo === "reaberta" ? "falando" : "surpreso");
  $("#sobreposicao").classList.remove("oculto");
  document.body.classList.add("prova-coberta");   // as questões ficam escondidas por baixo
  $("#btnVoltarProva").focus();
}
function esconderSobreposicao() { $("#sobreposicao").classList.add("oculto"); sobreposicaoFixa = false; tipoSobreposicao = null; document.body.classList.remove("prova-coberta"); }
$("#btnVoltarProva").onclick = () => {
  if (tipoSobreposicao === "extensao") return reconferirExtensoes();
  pedirTelaCheia();   // no clique (gesto do aluno): volta para a tela cheia e trava o teclado de novo
  if (foraDaProva && !naoTrava()) { setTimeout(tentarVoltar, 150); return; }   // volta de verdade quando a tela cheia entrar
  esconderSobreposicao();
};

// ---------- SAÍDA DA PROVA: um estado só ("fora") para todos os sinais ----------
// Sinais: a janela perdeu o foco (conferido ~60 ms depois), aba oculta, saiu da tela cheia, conferência de 1 em 1 s
// e recarregar/fechar a página. Vários sinais da mesma saída contam UMA vez. Volta = foco + aba visível + tela cheia.
let foraDaProva = false;
const focoNoMaterial = () => document.activeElement === $("#consultaFrame");
const dentroDaProva = () => document.hasFocus() && !document.hidden && (naoTrava() || !suportaTelaCheia() || !!document.fullscreenElement);

// TECLAS DE ADERÊNCIA (falso positivo da FATEC): Shift 5x abre uma janela do Windows que rouba o foco.
// Saída logo depois de Shift repetido (4+ em 4 s) ou segurado (6 s+) vira AVISO: registrada, sem perder vida e sem timer.
// Até 3 avisos por prova; depois conta normal (para não virar desculpa).
const shiftTempos = []; let shiftDesde = 0;
function pareceJanelaDoSistema() {
  const agora = Date.now();
  const n = shiftTempos.filter(t => agora - t < 4000).length;
  return n >= 4 || (shiftDesde > 0 && agora - shiftDesde >= 6000);
}
const chaveAvisos = () => `avisosSistema_${tentativa?.id}`;
const avisosSistema = () => Number(localStorage.getItem(chaveAvisos()) || 0);

// a página está fechando/recarregando: a saída da tela cheia que vem junto não conta (ao voltar, conta "recarregou", uma vez só)
let paginaFechando = false;
window.addEventListener("pagehide", () => { paginaFechando = true; });
window.addEventListener("pageshow", e => { if (e.persisted) paginaFechando = false; });
let previaAbertaEm = 0, previaFocadaEm = 0;
window.addEventListener("bancada-web:previa", e => { if (e.detail?.foco) previaFocadaEm = Date.now(); });
const temPreviaEmAba = () => !!tentativa?.questoesIds?.some(q => questoes[q]?.tipo === "web" && questoes[q]?.previa === "aba");
const naPrevia = () => temPreviaEmAba() && Date.now() - previaFocadaEm < 2500;
let conferindoPrevia = null;
function saida(motivo, e = null) {
  if (!emProvaAtiva() || foraDaProva || paginaFechando) return;
  // a prova tem prévia em outra aba: espera 1,5 s para saber se o aluno foi para a aba da prévia (aí não é saída)
  if (temPreviaEmAba() && (motivo === "aba" || motivo === "telaCheia") && !e?.semEspera) {
    if (conferindoPrevia) return;
    conferindoPrevia = setTimeout(() => {
      conferindoPrevia = null;
      if (naPrevia() || (document.hasFocus() && !document.hidden && motivo === "telaCheia" && Date.now() - previaFocadaEm < 6000)) {
        if (!document.fullscreenElement && document.hasFocus()) mostrarSobreposicao("entrar");   // voltou da prévia: só pede a tela cheia, sem punir
        return;
      }
      if (!document.hasFocus() || document.hidden || !document.fullscreenElement) saida(motivo, { semEspera: true });
    }, 1500);
    return;
  }
  if (naoTrava()) {   // troca de aba permitida: só conta, como antes
    if (motivo === "telaCheia") return;
    foraDaProva = true; registrarSaida("aba"); perderVida("aba"); return;
  }
  foraDaProva = true;
  const sistema = motivo !== "recarregou" && pareceJanelaDoSistema() && avisosSistema() < 3;
  if (sistema) localStorage.setItem(chaveAvisos(), String(avisosSistema() + 1));
  if (motivo === "telaCheia") registrar("saidasTelaCheia");
  registrarSaida(sistema ? "sistema" : motivo);
  let punido = false;
  if (!sistema) { punido = perderVida(motivo === "telaCheia" ? "telaCheia" : "aba"); if (!punido) iniciarTimerFora(); }
  if (!punido && emProvaAtiva()) mostrarSobreposicao(sistema ? "sistema" : motivo === "recarregou" ? "recarregou" : motivo === "telaCheia" ? "telaCheia" : "aba");
}
// voltou: só quando está mesmo dentro (com tela cheia); cobra o que o timer deve e fecha a saída
function tentarVoltar() {
  if (!foraDaProva || !emProvaAtiva()) return;
  if (!dentroDaProva()) return;
  voltouParaProva();
}
async function voltouParaProva() {
  if (!foraDaProva) return;
  foraDaProva = false;
  const vidasTimer = await fecharTimerFora();
  registrarVolta(vidasTimer);
  if (!emProvaAtiva() || naoTrava()) return;
  if (avisoPendente) { mostrarSobreposicao("perdeu", avisoPendente); avisoPendente = null; }   // perdeu a questão enquanto estava fora
  else if (!punindo && !["extensao", "recarregou"].includes(tipoSobreposicao)) esconderSobreposicao();   // recarregou: o aviso fica até o clique (o aluno vê por que perdeu a vida)
}

// ---------- TIMER DE VOLTA: fora da prova, perde mais 1 vida a cada prova.segundosVolta s ----------
// A tentativa guarda foraDesde (hora do servidor) e foraCobradas: a página, o painel do professor e o servidor
// (de 1 em 1 min) cobram pela mesma conta, em transação, então vale mesmo se o aluno fechar a página.
const segundosVolta = () => limiteSaidas() > 0 && !naoTrava() ? Math.max(0, Number(provaAtual?.segundosVolta ?? 5)) : 0;
let timerFora = null, foraInicio = 0, foraCobradas = 0, cobrandoFora = false;
function iniciarTimerFora(desdeServidor = null, jaCobradas = 0) {
  pararTimerFora();
  const n = segundosVolta();
  if (!n || !tentativa) return;
  foraInicio = desdeServidor || agoraServidor(); foraCobradas = jaCobradas;
  if (!desdeServidor) updateDoc(doc(db, "tentativas", tentativa.id), { foraDesde: serverTimestamp(), foraCobradas: 0, fora: true }).catch(e => console.warn("timer de volta", e));
  timerFora = setInterval(tickFora, 250); tickFora();
}
function pararTimerFora() { clearInterval(timerFora); timerFora = null; const c = $("#sobreContagem"); if (c) c.classList.add("oculto"); }
function tickFora() {
  const n = segundosVolta(); if (!n || !foraDaProva) return;
  const passou = Math.max(0, (agoraServidor() - foraInicio) / 1000), devidas = Math.floor(passou / n);
  const c = $("#sobreContagem");
  if (c && limiteSaidas() > 0) {
    c.classList.remove("oculto");
    c.innerHTML = `<span class="num">${Math.max(1, Math.ceil(n - (passou % n)))}</span><span>segundos para voltar antes de perder mais 1 vida</span>`;
  }
  if (devidas > foraCobradas) cobrarFora(devidas);
}
async function cobrarFora(devidas) {
  if (cobrandoFora || !tentativa) return;
  cobrandoFora = true;
  try {
    const ref = doc(db, "tentativas", tentativa.id);
    const k = await runTransaction(db, async tx => {
      const d = (await tx.get(ref)).data();
      if (!d || d.finalizadaEm) return 0;
      const ja = Number(d.foraCobradas || 0);
      if (devidas <= ja) { foraCobradas = ja; return 0; }
      tx.update(ref, { foraCobradas: devidas, trocasDeAba: increment(devidas - ja) });
      return devidas - ja;
    });
    foraCobradas = Math.max(foraCobradas, devidas);
    if (k > 0) {
      tentativa.trocasDeAba = (tentativa.trocasDeAba || 0) + k;
      desenharVidas(true);
      const p = $("#sobrePlacar"); if (p && tipoSobreposicao) { p.textContent = textoPlacar(); p.classList.toggle("oculto", !p.textContent); }
      conferirPunicao();
    }
  } catch (e) { console.warn("timer de volta: não cobrou", e); }
  finally { cobrandoFora = false; }
}
// ao voltar: cobra o que falta e apaga foraDesde (as regras conferem que nada ficou sem cobrar). Devolve as vidas do timer.
async function fecharTimerFora() {
  const tinha = !!timerFora;
  pararTimerFora();
  if (!tinha || !tentativa) return 0;
  const n = segundosVolta(), devidas = n ? Math.floor(Math.max(0, agoraServidor() - foraInicio) / 1000 / n) : 0;
  if (devidas > foraCobradas) await cobrarFora(devidas);
  const total = foraCobradas;
  updateDoc(doc(db, "tentativas", tentativa.id), { foraDesde: null, fora: false, foraCobradas: total }).catch(e => console.warn("timer de volta: não fechou", e));
  return total;
}

// recarregou ou fechou a página no meio da prova: conta como saída (ou continua a saída que já estava aberta)
function retomarSaida() {
  if (!emProvaAtiva() || naoTrava()) return;
  const desde = tentativa.foraDesde?.toMillis?.();
  if (desde) {
    foraDaProva = true;
    iniciarTimerFora(desde, Number(tentativa.foraCobradas || 0));
    mostrarSobreposicao("recarregou");
  } else saida("recarregou");
}

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) { travarTeclado(); if (foraDaProva) tentarVoltar(); else if (!sobreposicaoFixa && tipoSobreposicao === "entrar") esconderSobreposicao(); return; }
  destravarTeclado();
  if (!emProvaAtiva() || naoTrava()) return;
  saida("telaCheia");
});
document.addEventListener("visibilitychange", () => { if (document.hidden) saida("aba"); else tentarVoltarOuContar(); });
window.addEventListener("blur", () => {
  if (!emProvaAtiva() || foraDaProva) return;
  // clicar dentro do material de consulta tira o foco da página, mas não é troca de janela
  setTimeout(() => {
    if (focoNoMaterial() && !document.hidden && document.hasFocus()) return;
    if (!document.hasFocus() || document.hidden) saida("aba");
  }, 60);
});
window.addEventListener("focus", () => tentarVoltarOuContar());
function tentarVoltarOuContar() { if (naoTrava()) { if (foraDaProva) voltouParaProva(); } else tentarVoltar(); }
// conferência de 1 em 1 s (o foco no material ou um evento perdido não deixam passar a saída)
setInterval(() => {
  if (!emProvaAtiva()) return;
  if (foraDaProva) { tentarVoltarOuContar(); return; }
  if (!document.hasFocus() && !focoNoMaterial()) { if (!naPrevia()) saida("aba"); }
  else if (!naoTrava() && suportaTelaCheia() && !document.fullscreenElement && tipoSobreposicao !== "entrar") { if (temPreviaEmAba() && Date.now() - previaFocadaEm < 6000) mostrarSobreposicao("entrar"); else saida("telaCheia"); }
}, 1000);

// ---------- TECLAS ----------
// Bloqueia (com a trava, até Alt+Tab, Win e Esc): Alt e Alt+tecla, tecla Windows, Esc, F1–F12, menu, Ctrl+qualquer coisa
// e Shift+Insert. Libera: AltGr do ABNT2 (/ ? ° ª º), e DENTRO do campo de resposta Ctrl+Z/Y, Ctrl+A, Ctrl+setas,
// Ctrl+Backspace/Delete/Home/End e Ctrl+Enter (Bancada SQL). Cada atalho bloqueado é registrado em silêncio.
let ultimoAvisoTecla = 0, atalhosPend = 0, atalhosTimer = null, ultimaTeclaDigitada = 0;
function contarAtalho() {
  atalhosPend++;
  if (atalhosTimer || !tentativa || tentativa.finalizadaEm || simulacao) return;
  atalhosTimer = setTimeout(() => {
    const n = atalhosPend; atalhosPend = 0; atalhosTimer = null;
    if (n && tentativa && !tentativa.finalizadaEm) updateDoc(doc(db, "tentativas", tentativa.id), { atalhosBloqueados: increment(n) }).catch(() => {});
  }, 3000);
}
function teclaBloqueada(e, msg, registrarAtalho = true) {
  e.preventDefault(); e.stopPropagation();
  if (registrarAtalho) contarAtalho();
  if (msg && Date.now() - ultimoAvisoTecla > 1500) { ultimoAvisoTecla = Date.now(); toast(msg, "erro"); }
}
const CTRL_NO_CAMPO = new Set(["z", "y", "a", "arrowleft", "arrowright", "arrowup", "arrowdown", "backspace", "delete", "home", "end"]);
document.addEventListener("keydown", e => {
  const k = e.key || "", kl = k.toLowerCase();
  if (k === "Shift") { if (!e.repeat) { shiftTempos.push(Date.now()); if (shiftTempos.length > 8) shiftTempos.shift(); } if (!shiftDesde) shiftDesde = Date.now(); }
  if (k.length === 1 || k === "Enter" || k === "Backspace" || k === "Delete" || k === "Tab" || k === "Process" || k === "Dead") ultimaTeclaDigitada = Date.now();
  if (!emProvaAtiva()) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (naoTrava()) {   // troca de aba permitida: só os atalhos de copiar/imprimir/devtools, como antes
    if (k === "F12" || (ctrl && ["c", "a", "p", "s", "u"].includes(kl)) || (ctrl && e.shiftKey && ["i", "j", "c"].includes(kl))) teclaBloqueada(e, "Este atalho está desativado durante a prova.", false);
    return;
  }
  const campo = e.target?.closest?.("textarea, input:not([type=radio]):not([type=checkbox]), [data-campo-resposta]");
  const altGr = k === "AltGraph" || e.getModifierState?.("AltGraph") || (e.ctrlKey && e.altKey && !e.metaKey);
  if (altGr && k !== "Delete") return;                                   // AltGr do ABNT2: liberado
  if (k === "Control" || k === "Shift" || k === "CapsLock") return;       // só a tecla modificadora, sem atalho
  if (k === "Alt" || e.altKey) return teclaBloqueada(e, "Alt está bloqueado durante a prova (Alt+Tab não troca de janela).");
  if (["Meta", "OS", "Super", "Hyper"].includes(k) || e.metaKey) return teclaBloqueada(e, "A tecla Windows está bloqueada durante a prova.");
  if (k === "Escape") return teclaBloqueada(e, "Esc está bloqueado durante a prova.");
  if (/^F\d{1,2}$/.test(k)) return teclaBloqueada(e, k === "F12" ? "As ferramentas do desenvolvedor estão bloqueadas." : `A tecla ${k} está bloqueada durante a prova.`);
  if (k === "ContextMenu") return teclaBloqueada(e, "");
  if (e.ctrlKey) {
    if (kl === "v") { if (colarPermitido()) return; if (campo) { e.preventDefault(); return; } return teclaBloqueada(e, "Colar está desativado nesta prova.", false); }   // no campo: o próprio campo registra a tentativa
    if (campo && CTRL_NO_CAMPO.has(kl)) return;
    if (campo && (kl === "c" || kl === "x") && colarPermitido()) return;
    if (k === "Enter" && e.target?.closest?.("[data-campo-resposta]")) return;   // Bancada SQL: executar
    return teclaBloqueada(e, "Atalho bloqueado durante a prova.");
  }
  if (e.shiftKey && k === "Insert") { if (colarPermitido()) return; if (campo) { e.preventDefault(); colarFora(e); return; } return teclaBloqueada(e, "Colar está desativado nesta prova.", false); }
}, true);
document.addEventListener("keyup", e => { if (e.key === "Shift") shiftDesde = 0; }, true);

// colar/soltar em campos que não passaram por bloquearColar (ex.: editores da Bancada SQL)
function colarFora(e) { if (e.target?.closest?.("[data-colar-protegido]")) return; tentativaDeColar(e); }
["paste", "drop"].forEach(ev => document.addEventListener(ev, e => {
  if (!emProvaAtiva() || colarPermitido()) return;
  if (!e.target?.closest?.("[data-colar-protegido]")) tentativaDeColar(e);
}, true));

// TEXTO QUE NÃO FOI DIGITADO (extensão de IA preenchendo o campo, texto "injetado"): desfaz e registra
const antesDoInput = new WeakMap(), ultimoBom = new WeakMap();   // último valor aceito de cada campo
document.addEventListener("focusin", e => { const el = e.target; if ((el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) && !ultimoBom.has(el)) ultimoBom.set(el, el.value); }, true);
document.addEventListener("beforeinput", e => { if (emProvaAtiva()) antesDoInput.set(e.target, { v: e.target.value, s: e.target.selectionStart, f: e.target.selectionEnd }); }, true);
document.addEventListener("input", e => {
  const el = e.target;
  if (!emProvaAtiva() || colarPermitido() || !(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) || el.type === "radio" || el.type === "checkbox") return;
  const antes = antesDoInput.get(el); antesDoInput.delete(el);
  if (!antes) { if (!e.isTrusted) bloquearInjetado(el, { v: ultimoBom.get(el) ?? "", s: 0, f: 0 }); else ultimoBom.set(el, el.value); return; }
  const cresceu = el.value.length - antes.v.length;
  const semTecla = Date.now() - ultimaTeclaDigitada > 400;
  if (!e.isTrusted || (cresceu > 3 && semTecla) || (e.inputType === "insertReplacementText" && cresceu > 3)) bloquearInjetado(el, antes);
  else ultimoBom.set(el, el.value);
}, true);
let ultimoInjetado = 0;
function bloquearInjetado(el, antes) {
  if (antes) { el.value = antes.v; try { el.setSelectionRange(antes.s, antes.f); } catch { /* campo sem seleção */ } }
  if (Date.now() - ultimoInjetado < 1500) return;
  ultimoInjetado = Date.now();
  registrar("textoInjetado");
  toast("Apareceu texto que não foi digitado (extensão ou IA). Ele foi apagado e isso fica registrado para o professor.", "erro");
}

// nada de abrir outra janela, imprimir ou seguir links externos durante a prova
const abrirJanelaOriginal = window.open.bind(window);
function abrirPreviaPermitida(url) { if (!/^previa-web\.html/.test(String(url))) return null; previaAbertaEm = Date.now(); return abrirJanelaOriginal(url, "_blank"); }
{
  const abrir = abrirJanelaOriginal, imprimir = window.print.bind(window);
  window.open = (...a) => { if (emProvaAtiva()) { toast("Abrir outras janelas está desativado durante a prova.", "erro"); return null; } return abrir(...a); };
  window.print = () => { if (emProvaAtiva()) return; imprimir(); };
  document.addEventListener("click", e => {
    if (!emProvaAtiva()) return;
    const a = e.target?.closest?.("a[href]"); if (!a) return;
    const href = a.getAttribute("href") || "";
    if (a.target === "_blank" || (/^(https?:)?\/\//i.test(href) && a.host !== location.host) || /^(mailto|tel|javascript):/i.test(href)) {
      e.preventDefault(); e.stopPropagation(); toast("Links externos estão desativados durante a prova.", "erro");
    }
  }, true);
}

// ---------- EXTENSÕES (IA que preenche campos, bloqueador de anúncios) ----------
let pararVigia = null;
function vigiarExtensoesNaProva() {
  if (pararVigia) pararVigia();
  pararVigia = vigiarExtensoes((todas, novas) => {
    if (!emProvaAtiva()) return;
    updateDoc(doc(db, "tentativas", tentativa.id), { extensoes: arrayUnion(...novas.slice(0, 5)) }).catch(() => {});
    registrarSaida("extensao");
    mostrarSobreposicao("extensao", textoExtensoes({ bloqueador: false, ia: todas }));
  });
}
async function reconferirExtensoes() {
  const r = await conferirExtensoes();
  if (r.ia.length || r.bloqueador) { $("#sobreTexto").innerHTML = textoExtensoes(r); toast("Ainda está ligada. Desligue e confira de novo.", "erro"); return; }
  esconderSobreposicao();
  pedirTelaCheia();
}

// ---------- bloqueios na área da questão ----------
["copy", "cut", "contextmenu", "dragstart", "selectstart"].forEach(ev => $("#telaQuestao").addEventListener(ev, e => {
  const el = e.target.nodeType === 1 ? e.target : e.target.parentElement;
  if (ev === "selectstart" && el?.closest("textarea, input[data-campo-resposta], [data-campo-resposta]")) return;   // no campo de resposta o aluno pode selecionar o próprio texto
  if (ev === "contextmenu" && colarPermitido() && el?.closest("textarea")) return;   // colar permitido: botão direito → Colar
  e.preventDefault();
}));
// botão direito em QUALQUER lugar da página durante a prova (cabeçalho, margens, material de consulta):
// o menu do navegador tem "Pesquisar com o Google Lens"/Gemini, que abre um painel de IA ao lado da prova
document.addEventListener("contextmenu", e => {
  if (!emProvaAtiva()) return;
  const el = e.target?.nodeType === 1 ? e.target : e.target?.parentElement;
  if (colarPermitido() && el?.closest?.("textarea")) return;
  e.preventDefault();
}, true);

// ---------- cronômetro (prova com tempoMinutos > 0) ----------
let relogio = null;
function fimDoTempo() {
  const min = Number(provaAtual?.tempoMinutos || 0), ini = tentativa?.iniciadaEm;
  const extra = Math.max(0, Number(tentativa?.minutosExtras || 0))     // tempo a mais dado pelo professor (ex.: ao reabrir a prova)
              + Math.max(0, Number(ap().tempoExtraMin || 0));            // acessibilidade: tempo extra do aluno
  return min > 0 && !semLimites() && ini?.toMillis ? ini.toMillis() + (min + extra) * 60000 : null;
}
function tempoAcabou() { const f = fimDoTempo(); return f !== null && Date.now() >= f; }
function iniciarCronometro() {
  pararCronometro();
  const fim = fimDoTempo(), el = $("#qTimer");
  if (fim === null) { el.classList.add("oculto"); return; }
  el.classList.toggle("oculto", !!ap().ocultarCronometro);   // acessibilidade: o tempo vale, mas não aparece
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
  if (podeVoltar() && !tentativa.finalizadaEm) await comLimiteDeTempo(salvarTudo(), 15000).catch(() => {});   // ir e voltar: salva o que estava alterado
  await finalizar({ tempoEsgotado: true });
}

// ---------- conexão ----------
let erroEnvio = false;   // a última tentativa de enviar falhou
function atualizarBanner() {
  const b = $("#bannerConexao");
  const naProva = tentativa && !tentativa.finalizadaEm && !$("#telaQuestao").classList.contains("oculto");
  let msg = "";
  const acao = podeVoltar() ? ["salva", "Salvar resposta"] : ["enviada", "Enviar resposta"];
  if (naProva && erroEnvio) msg = navigator.onLine ? `Sua resposta NÃO foi ${acao[0]}. A conexão voltou: clique em ${acao[1]} de novo.`
                                                   : `Sem conexão: sua resposta NÃO foi ${acao[0]}, tente de novo.`;
  else if (naProva && !navigator.onLine) msg = "Sem conexão com a internet. Não feche nem recarregue a página: quando a conexão voltar, continue normalmente.";
  b.textContent = msg; b.classList.toggle("oculto", !msg);
}
window.addEventListener("offline", atualizarBanner);
window.addEventListener("online", atualizarBanner);

// avisa antes de fechar/recarregar a aba no meio da prova
window.addEventListener("beforeunload", e => { if (emProvaAtiva()) { e.preventDefault(); e.returnValue = ""; } });

// ---------- resultado ----------
// observação na questão que o aluno apontou: a resposta do professor (ou o aviso de que ainda vai conferir)
function obsApontamento(l) {
  if (!l?.length) return "";
  const resp = l.find(a => a.resposta && !["aberto", "aberta"].includes(a.status));
  if (resp) return `<div class="feedback obs-apontamento"><span class="icone" aria-hidden="true">📝</span><div><b>Observação sobre esta questão:</b> ${esc(resp.resposta)}</div></div>`;
  if (l.some(a => !["aberto", "aberta"].includes(a.status))) return `<p class="pequeno">📝 O professor conferiu o problema que você avisou nesta questão.</p>`;
  return `<p class="pequeno">🚩 Você avisou um problema nesta questão. O professor ainda vai conferir.</p>`;
}
async function verResultado() {
  if (!tentativa) return toast("Você não fez esta prova.", "erro");
  if (!modoTeste && provaAtual.resultadosLiberados !== true) return toast("O gabarito desta prova ainda não foi liberado.", "erro");
  mostrar("telaResultado");
  $("#resTitulo").textContent = provaAtual.titulo;
  $("#resResumo").innerHTML = "<p class='pequeno'>Carregando…</p>"; $("#resLista").innerHTML = "";
  const ids = tentativa.questoesIds;
  const [qgs, rs, cs, aps] = await Promise.all([
    Promise.all(ids.map(q => questaoEGabarito(q, tentativa.bancoId))),
    getDocs(collection(db, "tentativas", tentativa.id, "respostas")),
    getDocs(collection(db, "tentativas", tentativa.id, "correcoes")).catch(() => ({ forEach() {} })),
    // 🚩 o que este aluno apontou nesta prova: a resposta do professor aparece como observação na própria questão
    gami.apontamentos && !modoTeste ? getDocs(query(collection(db, "apontamentos"), where("uid", "==", eu.uid))).catch(() => null) : null
  ]);
  const resp = {}; rs.forEach(d => resp[d.id] = d.data());
  const corr = {}; cs.forEach(d => corr[d.id] = d.data());
  const meusAps = {}; (aps?.docs || []).map(d => d.data()).filter(a => a.provaId === provaAtual.id).forEach(a => (meusAps[a.qid] ||= []).push(a));
  let total = 0, max = 0, certas = 0, html = "";
  const grupoSt = st => st === "certa" ? "certas" : ["parcial", "revisar"].includes(st) ? "parciais" : "erradas";
  const contagem = { certas: 0, parciais: 0, erradas: 0 };
  ids.forEach((qid, i) => {
    const q = { id: qid, ...(qgs[i].q || {}) }, g = qgs[i].g || {};
    const r = resp[qid]?.resposta ?? undefined, perdida = resp[qid]?.perdida === true, peso = Number(q.peso || 1); max += peso;
    let c = corrigir(q, g, r, perdida);
    let obs = "";
    if (!perdida && corr[qid] && corr[qid].pontos !== undefined) { c = { pontos: Number(corr[qid].pontos), status: Number(corr[qid].pontos) >= peso ? "certa" : Number(corr[qid].pontos) > 0 ? "parcial" : "errada" }; obs = corr[qid].comentario || ""; }
    total += c.pontos; if (c.status === "certa" || Number(c.pontos) > peso / 2) certas++;
    const rot = { certa: ["ok", "✅ Certa"], errada: ["erro", "❌ Errada"], parcial: ["aviso", "🟡 Parcial"], revisar: ["aviso", "🟡 Em correção"], em_branco: ["erro", "⬜ Em branco"], perdida: ["erro", "⛔ Perdida (saiu da prova)"] }[c.status];
    const fmt = temFormato(q), bloco = t => `<span class="resp-formato">${esc(t).replace(/\n/g, "<br>")}</span>`;
    let sua = perdida ? "<i>perdida por sair da prova</i>" : r === undefined ? "<i>não respondida</i>" : q.tipo === "sql" ? bloco(textoRespostaSql(q, r)) : q.tipo === "web" ? bloco(textoRespostaWeb(q, r)) : q.tipo === "diagrama" ? bloco(textoRespostaDiagrama(q, r)) : fmt ? bloco(textoResposta(q, r)) : q.tipo === "alternativa" ? esc(q.alternativas[r]) : `<span class="mono">${esc(r)}</span>`;
    let certa = q.tipo === "web" ? "—" : q.tipo === "diagrama" ? (g.diagrama ? bloco(textoGabaritoDiagrama(q, g)) : "—") : q.tipo === "sql" ? (g.tarefas ? bloco((q.tarefas || []).map((t, k) => `Tarefa ${k + 1}: ${g.tarefas[t.id]?.sql || "—"}`).join("\n")) : "—") : fmt ? (g.chave ? bloco(textoChave(q, g)) : "—") : q.tipo === "alternativa" ? esc(q.alternativas?.[g.correta] ?? "—") : (g.respostasAceitas?.length ? `<span class="mono">${esc(g.respostasAceitas[0])}</span>` : "—");
    contagem[grupoSt(c.status)]++;
    html += `<details class="card res-q" data-grupo="${grupoSt(c.status)}"${c.status === "certa" ? "" : " open"}><summary class="q-topo"><span class="ch" aria-hidden="true">${ic("chev")}</span><span class="q-numero">Questão ${i + 1}</span><span class="chip ${({ ok: "ok", erro: "err", aviso: "warn" })[rot[0]]}">${rot[1]} · ${c.pontos}/${peso}</span></summary>
      <div class="enunciado">${formatarEnunciado(q.enunciado)}</div>
      <p><b>Sua resposta:</b> ${sua}</p>
      ${c.status !== "certa" && certa !== "—" ? `<p><b>Resposta correta:</b> ${certa}</p>` : ""}
      ${g.explicacao ? `<div class="feedback ${c.status === "certa" ? "certa" : "errada"}"><span class="icone" aria-hidden="true">💡</span><div><b>Por quê:</b> ${esc(g.explicacao)}</div></div>` : ""}
      ${obs ? `<p class="pequeno"><b>${corr[qid]?.revisao ? "Observação" : "Comentário do professor"}:</b> ${esc(obs)}</p>` : ""}
      ${obsApontamento(meusAps[qid])}
      ${gami.apontamentos && !modoTeste ? `<button type="button" class="discreto mini b-apontar-res" data-qid="${esc(qid)}">🚩 Algo errado nesta questão?</button>` : ""}</details>`;
  });
  const nota = max ? Math.round((total / max) * 1000) / 10 : 0;
  const notaFinal = tentativa.nota ?? nota, tom = notaFinal >= 70 ? "ok" : notaFinal >= 50 ? "aviso" : "erro";
  $("#resResumo").innerHTML = statTiles([{ v: `${notaFinal}<small>/100</small>`, r: "sua nota", tom }, { v: `${certas}<small>/${ids.length}</small>`, r: "questões certas" },
    { v: `${total}<small>/${max}</small>`, r: "pontos" }]);
  // filtro por situação (só aparece quando há o que separar); a impressão mostra todas
  const opcoes = [{ v: "todas", t: `Todas · ${ids.length}` }, { v: "erradas", t: `❌ Erradas · ${contagem.erradas}` }, { v: "parciais", t: `🟡 Parciais · ${contagem.parciais}` }, { v: "certas", t: `✅ Certas · ${contagem.certas}` }]
    .filter(o => o.v === "todas" || contagem[o.v]);
  $("#resLista").innerHTML = (opcoes.length > 2 ? `<div id="resFiltro" class="res-filtro"></div>` : "") + html;
  if (opcoes.length > 2) chips($("#resFiltro"), opcoes, { valor: "todas", aria: "Mostrar as questões", aoMudar: v =>
    $("#resLista").querySelectorAll(".res-q").forEach(c => c.classList.toggle("res-escondida", v !== "todas" && c.dataset.grupo !== v)) });
  // o PDF mostra todas as questões, abertas
  window.onbeforeprint = () => { $("#resLista").querySelectorAll("details.res-q").forEach(d => { d.dataset.antes = d.open ? "1" : ""; d.open = true; }); };
  window.onafterprint = () => { $("#resLista").querySelectorAll("details.res-q").forEach(d => { d.open = d.dataset.antes === "1"; }); };
  $("#resLista").querySelectorAll(".b-apontar-res").forEach(b => b.onclick = () => { const qid = b.dataset.qid; apontar(eu, { provaId: provaAtual.id, provaTitulo: provaAtual.titulo, qid, enunciado: qgs[ids.indexOf(qid)]?.q?.enunciado || "" }); });
}
