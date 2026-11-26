// Painel do professor: provas, bancos (import JSON), resultados/correção, equipe, configuração.
import { db, auth, entrar, sair, aoMudarLogin, identificar, corrigir, esc, $, toast, dataBR, letra, SUPER_ADMIN, limparTema, apagarTentativaTeste,
         confirmar, modal, traduzirErro, iniciais, temaDe, ordenarTemas, chaveNome, placar, idsConsulta, bancosDaProva, temasDoBanco,
         rotuloDias, nomeTurma, HORARIO_PADRAO, textoHorario, DIAS_SEMANA_LONGO,
         semestreDe, rotuloSemestre, semestreVizinho, semestreDaProva, materiaDaProva, chaveTexto, dataCurta, semestreCursoAtual, periodoLetivo, cotaDaProva } from "./common.js?v=20261125b";
import { enviarMaterial, listarMateriais, apagarMaterial, baixarMaterial, tamanhoTexto, MAX_MB, erroMaterial, abrirMaterialEmAba } from "./material.js";
import { MODELOS_IA, MODELO_PADRAO, lerConfigIA, salvarConfigIA, apagarConfigIA, finalChave, testarChave, corrigirDissertativa } from "./ia.js";
import { abrirLeitorPdf } from "./leitor-pdf.js";
import { htmlEditorTopicos, editorTopicos } from "./plano-curso-ui.js?v=20261113d";
import { criteriosDaUnidade, codigoCriterio, carregarCriteriosOficiais } from "./plano-ensino.js?v=20261116a";
import { PLANO_CURSO } from "./plano-curso.js?v=20261113a";
import { iniciarOrganizacao, carregarOrganizacao, listarPlanos, listarCursos, materiasSugeridas, editarTopicosBanco, editarCriteriosBanco, topicosDaMateria } from "./admin-org.js";
import { iniciarDiario, carregarDiario } from "./admin-diario.js";
import { iniciarCriterios, carregarCriterios } from "./admin-criterios.js?v=20261116a";
import { ligarAjuda } from "./ajuda.js";
import { iniciarRelatorios, carregarRelatorios } from "./admin-relatorios.js";
import { iniciarGamificacao, carregarGamificacao, carregarRetorno } from "./admin-gamificacao.js?v=20261116c";
import { lerRevisoes, revisoesDaProva, faixaRevisoesHTML, avisoQuestaoHTML, abrirRevisao } from "./admin-revisoes.js?v=20261116c";
import { mesclarQuestao } from "./acessibilidade.js";
import { temFormato, textoResposta, textoChave, FORMATOS } from "./formatos-ui.js";
import { iniciarAcessibilidade, carregarAcessibilidade, prepararNovo as prepararNovoAcess, abrirDepois } from "./admin-acess.js?v=20261118f";
import { iniciarHistorico, carregarHistorico } from "./admin-historico.js";
import { exportarExcel, exportarPDF } from "./exportar-turmas.js?v=20261110b";
import { tarefa, ligarMenuLateral } from "./ui.js";
import { ic } from "./icones.js";
import { REGRAS_NOTA, regraDoTipo, calcNotaFinal } from "./nota-final.js";
import { textoRespostaSql } from "../servidor/sql-correcao.js?v=20261125b";
import { textoRespostaWeb } from "../servidor/web-correcao.js?v=20261125a";
import { textoRespostaDiagrama, textoGabaritoDiagrama, validarQuestaoDiagrama, NOMES_DIAGRAMA } from "../servidor/diagrama-correcao.js?v=20261126a";
import { HUMOR } from "./diario-perguntas.js";
import { drawer, drawerForm, ligarFiltros, atualizarFiltros, ajudasEmPopover, menuHTML, itemMenu, vazio, chips, statTiles, pl, semestreLongo, seta } from "./ui.js";
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp, onSnapshot, increment, deleteField, Timestamp, arrayUnion, arrayRemove, runTransaction }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let eu = null;   // { email, nome, papel }
const podeEditar = () => ["admin", "professor"].includes(eu?.papel);
const ehAdmin = () => eu?.papel === "admin";
// auxiliar de inclusão: só vê os alunos vinculados a ela (aba Acessibilidade e Resultados deles)
const ehInclusao = () => eu?.papel === "inclusao";
// pode mexer nas vidas / reabrir: professor, admin e a auxiliar de inclusão (nos alunos dela; as regras conferem)
const podeCuidar = () => podeEditar() || ehInclusao();
let urlCorretorCfg = "", horarioCfg = HORARIO_PADRAO;   // servidor de correção/adaptação (config/geral.urlCorretor)
// o DIÁRIO da auxiliar mudou para o sistema de aulas (mesmos dados): aqui ela só faz o relatório de cada somativa (Resultados)
const ABAS_INCLUSAO = ["resultados", "acessibilidade", "historico"];
const URL_AULAS = "https://aulassenai.netlify.app/";
// administrador principal: o único que vê e usa a chave da IA (as regras também só deixam ele ler config/ia)
const souDono = () => !!eu && eu.email === SUPER_ADMIN.toLowerCase();

// ---------- login ----------
$("#btnEntrar").onclick = async () => { try { await entrar(); } catch (e) { $("#msgLogin").textContent = "Não foi possível entrar. " + traduzirErro(e); } };
$("#btnSair").onclick = () => sair();
$("#btnSairAviso").onclick = () => sair();
aoMudarLogin(async user => {
  if (!user) { eu = null; $("#btnSair").classList.add("oculto"); $("#avatar").classList.add("oculto"); $("#quem").textContent = ""; $("#quem").removeAttribute("title"); trocar("telaLogin"); return; }
  const id = await identificar(user);
  pintarUsuario(user, id); $("#btnSair").classList.remove("oculto");
  $("#avatar").textContent = iniciais(user.displayName || id.email); $("#avatar").title = user.displayName || id.email; $("#avatar").classList.remove("oculto");
  if (id.tipo === "aluno") { location.replace("index.html"); return; }   // aluno no painel: vai para a página dele
  if (id.tipo !== "equipe") {
    $("#avisoTexto").innerHTML = `<h2>Sem acesso ao painel</h2><p>A conta <b>${esc(id.email)}</b> não está na equipe. Peça ao administrador para cadastrar.</p><p><a href="index.html">Ir para a página do aluno</a></p>`;
    trocar("telaAviso"); return;
  }
  eu = id;
  await garantirConfig();
  await carregarCriteriosOficiais(db, { collection, getDocs });   // critérios de avaliação: vêm do sistema de autoavaliação
  await carregarIA();
  getDoc(doc(db, "config", "geral")).then(c => { urlCorretorCfg = String(c.data()?.urlCorretor || "").trim(); if (c.data()?.horario?.inicio) horarioCfg = c.data().horario; $("#tHorario").textContent = textoHorario(horarioCfg); }).catch(() => {});
  iniciarAcessibilidade({ eu, podeEditar, souDono, auth, iaCfg: () => iaCfg, urlCorretor: () => urlCorretorCfg,
    alunosDasTurmas: async () => { await listarTurmas().catch(() => {}); return turmasCache.flatMap(t => alunosDaTurma(t).map(a => ({ ...a, turma: t.nome, turmaId: t.id, diasAula: t.diasAula || [] }))); } });
  iniciarDiario({ eu, podeEditar, souDono, horario: () => horarioCfg, auth, iaCfg: () => iaCfg, urlCorretor: () => urlCorretorCfg,
    alunosDasTurmas: async () => { await listarTurmas().catch(() => {}); return turmasCache.flatMap(t => alunosDaTurma(t).map(a => ({ ...a, turma: t.nome, turmaId: t.id, diasAula: t.diasAula || [] }))); } });
  iniciarHistorico({ eu, abrirAluno: email => { abrirDepois(email); abrirAba("acessibilidade"); },
    alunosDasTurmas: async () => { await listarTurmas().catch(() => {}); return turmasCache.flatMap(t => alunosDaTurma(t).map(a => ({ ...a, turma: t.nome, turmaId: t.id }))); } });
  iniciarRelatorios({ listarTurmas, listarBancos });
  iniciarCriterios({ eu });
  iniciarMeuMascote({ eu, ehAdmin, podeEditar }); iniciarItens({ eu, podeEditar }); carregarItensCustom().then(() => carregarEstilosMascotes()).catch(() => {});
  iniciarGamificacao({ eu, ehAdmin, podeEditar, auth, iaCfg: () => iaCfg, urlCorretor: () => urlCorretorCfg });
  iniciarOrganizacao({ eu, podeEditar, ehAdmin, auth, iaCfg: () => iaCfg, urlCorretor: () => urlCorretorCfg,
    listarTurmas, alunosDaTurma, listarBancos, questoesDoBanco, questoesDoBancoCache: id => questoesCache[id],
    invalidarBanco: id => { delete questoesCache[id]; }, novaProva: abrirNovaProva,
    abrirResultados: async id => { abrirAba("resultados"); $("#rTurma").value = ""; await prepararResultados(); $("#rProva").value = id; carregarResultados(); } });
  trocar("telaPainel");
  document.querySelectorAll("[data-aba]").forEach(b => {
    b.onclick = () => abrirAba(b.dataset.aba);
    b.classList.toggle("oculto", (ehInclusao() && !ABAS_INCLUSAO.includes(b.dataset.aba)) || (["diario", "historico"].includes(b.dataset.aba) && !podeCuidar()) || (b.dataset.aba === "gamificacao" && !ehAdmin()) || (["retorno", "relatorios"].includes(b.dataset.aba) && !podeEditar()));
  });
  ligarMenuLateral($(".menu-lateral"));
  document.body.classList.toggle("papel-inclusao", ehInclusao());
  abrirAba(ehInclusao() ? "resultados" : "provas");
  if (ehInclusao()) toast("📔 O diário agora fica no sistema de aulas (aulassenai.netlify.app). Aqui você faz o relatório de cada somativa em Resultados.", "ok");
});
// cabeçalho: primeiro nome na pílula; e-mail completo e papel no menu do usuário
const ROTULO_PAPEL = { admin: "Administrador", professor: "Professor", auxiliar: "Auxiliar", inclusao: "Auxiliar de inclusão" };
function pintarUsuario(user, id) {
  const nome = (user.displayName || id.email.split("@")[0]).trim().split(/[\s._-]+/)[0];
  $("#quem").textContent = nome.charAt(0).toUpperCase() + nome.slice(1); $("#quem").title = id.email;
  $("#usuarioEmail").textContent = id.email;
  $("#usuarioPapel").textContent = id.email === SUPER_ADMIN.toLowerCase() ? "Administrador principal" : (ROTULO_PAPEL[id.papel] || id.papel || "");
}
function trocar(id) { ["telaLogin", "telaPainel", "telaAviso"].forEach(t => $("#" + t).classList.toggle("oculto", t !== id)); }
let abaAtual = "provas";
// cada aba declara o título, o ícone do menu e a ação primária do cabeçalho (o botão já existe em admin.html, com o mesmo id; a ajuda vem de ajuda.js)
const ABAS = {
  organizacao: { titulo: "Organização", icone: "org", primaria: { id: "orgNovo", rotulo: "Matéria / plano de ensino", icone: "plus" } },
  provas: { titulo: "Somativas", icone: "provas", primaria: { id: "btnNovaProva", rotulo: "Criar nova somativa", icone: "plus" } },
  bancos: { titulo: "Bancos de questões", icone: "bancos", primaria: { id: "btnImportarTopo", rotulo: "Importar banco", icone: "download" } },
  turmas: { titulo: "Turmas", icone: "turmas", primaria: { id: "btnNovaTurma", rotulo: "Nova turma", icone: "plus" } },
  resultados: { titulo: "Resultados", icone: "resultados" },
  relatorios: { titulo: "Relatórios", icone: "relatorios" },
  diario: { titulo: "Diário", icone: "diario" },
  acessibilidade: { titulo: "Acessibilidade", icone: "acess", primaria: { id: "btnAcessNovo", rotulo: "Marcar acessibilidade", icone: "plus" } },
  historico: { titulo: "Somativas adaptadas", icone: "adapt" },
  retorno: { titulo: "Erros e sugestões", icone: "retorno" },
  gamificacao: { titulo: "Gamificação", icone: "gami" },
  meumascote: { titulo: "Meu mascote", icone: "mascote" },
  itens: { titulo: "Itens e estampas", icone: "itens", primaria: { id: "btnNovoItem", rotulo: "Novo item", icone: "plus" } },
  simulacao: { titulo: "Simulação", icone: "simulacao" },
  equipe: { titulo: "Equipe", icone: "equipe", primaria: { id: "btnNovoMembro", rotulo: "Novo membro", icone: "plus" } },
  config: { titulo: "Configuração", icone: "config" }
};
document.querySelectorAll(".menu-lateral [data-aba]").forEach(b => b.insertAdjacentHTML("afterbegin", ic(ABAS[b.dataset.aba].icone)));
Object.values(ABAS).forEach(({ primaria: p }) => { if (!p) return; const b = $("#" + p.id); b.innerHTML = ic(p.icone, { size: 16 }) + `<span class="bt-texto">${esc(p.rotulo)}</span>`; b.setAttribute("aria-label", p.rotulo); b.title = p.rotulo; });
document.querySelectorAll("[data-ic]").forEach(e => { e.innerHTML = ic(e.dataset.ic, { size: Number(e.dataset.icSize) || 18 }); });
document.querySelectorAll("[data-salvar-config]").forEach(b => { b.onclick = () => $("#btnSalvarConfig").click(); });
document.querySelectorAll("[data-ir-aba]").forEach(b => { b.onclick = () => abrirAba(b.dataset.irAba); });
$("#btnAjuda").innerHTML = ic("info", { size: 16 }); $("#usuarioChev").innerHTML = ic("chev", { size: 16 });
// a importação de banco abre num drawer: #bancoImportar é movido para lá e volta ao fechar (ids e eventos continuam os mesmos)
let drawerImportar = null;
function abrirImportarBanco({ semestre = "", materia = "" } = {}) {
  if (!podeEditar()) return toast("Seu papel não permite importar.", "erro");
  if (drawerImportar) return;
  if (semestre) $("#bSemestre").value = semestre;
  if (materia) $("#bMateria").value = materia;
  $("#msgBanco").textContent = "";
  drawerImportar = drawer({ titulo: "Importar banco de questões", corpo: $("#bancoImportar"), largo: true, aoFechar: () => { drawerImportar = null; $("#bancoImportar").classList.add("oculto"); },
    acoes: [{ t: "Importar", onClick: async () => (await $("#btnImportarBanco").onclick()) === true },
            { t: "Validar", classe: "leve", onClick: () => { $("#btnValidarBanco").click(); return false; } }] });
}
$("#btnImportarTopo").onclick = () => abrirImportarBanco();
$("#btnAbrirMaterial").onclick = () => { $("#cardMateriais").open = true; $("#matTitulo").focus({ preventScroll: true }); };
function pintarTopo(a) {
  $("#topoTitulo").textContent = ABAS[a].titulo;
  // a ação principal só aparece para quem pode usá-la (as regras do Firestore continuam sendo a proteção de verdade)
  document.querySelectorAll("[data-topo]").forEach(s => { s.hidden = s.dataset.topo !== a || !(a === "equipe" ? ehAdmin() : podeEditar()); });
}
function abrirAba(a) {
  window.scrollTo({ top: 0, behavior: "instant" });   // toda aba começa no topo
  abaAtual = a; pintarTopo(a); ligarAjuda(() => abaAtual);
  if (a !== "resultados" && $("#rAoVivo").checked) { $("#rAoVivo").checked = false; pararAoVivo(); }   // sair da aba desliga o ao vivo
  document.querySelectorAll("[data-aba]").forEach(b => { const ativa = b.dataset.aba === a; b.classList.toggle("ativa", ativa); if (ativa) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); if (ativa && matchMedia("(max-width:900px)").matches) b.scrollIntoView({ inline: "center", block: "nearest" }); });
  ["organizacao", "diario", "historico", "retorno", "relatorios", "gamificacao", "provas", "bancos", "turmas", "resultados", "acessibilidade", "equipe", "config", "simulacao", "meumascote", "itens"].forEach(x => $("#aba-" + x).classList.toggle("oculto", x !== a));
  return ({ organizacao: () => { carregarCriterios(); return carregarOrganizacao(); }, diario: carregarDiario, historico: carregarHistorico, retorno: carregarRetorno, relatorios: carregarRelatorios, gamificacao: carregarGamificacao, provas: carregarProvas, bancos: () => { carregarBancos(); carregarMateriais(); }, turmas: carregarTurmas, resultados: prepararResultados,
     acessibilidade: () => { carregarAcessibilidade(); if (podeEditar()) prepararNovoAcess(); }, equipe: carregarEquipe, config: carregarConfig, simulacao: carregarSimulacao, meumascote: carregarMeuMascote, itens: carregarAbaItens })[a]();
}

// ============================================================ SIMULAÇÃO (tudo para testar e demonstrar num lugar só)
import { criarAmbiente, apagarAmbiente, existeAmbiente, SIM, ALUNOS_ACESS_SIM } from "./admin-sandbox.js";
import { iniciarMeuMascote, carregarMeuMascote, carregarEstilosMascotes } from "./admin-mascote.js";
import { iniciarItens, carregarAbaItens, carregarItensCustom } from "./admin-itens.js";
async function estadoAmbiente() {
  const tem = await existeAmbiente();
  $("#simAmbStatus").textContent = tem ? "✅ criado" : "não criado"; $("#simAmbStatus").className = "chip " + (tem ? "ok" : "");
  $("#simAmbCriar").textContent = tem ? "↻ Recriar (volta ao começo)" : "Criar ambiente de teste";
  $("#simAmbApagar").classList.toggle("oculto", !tem);
  return tem;
}
async function carregarSimulacao() {
  const tem = await estadoAmbiente();
  $("#simAmbCriar").disabled = !podeEditar();
  $("#simAmbCriar").onclick = async () => {
    const recriar = await existeAmbiente();
    if (!(await confirmar(recriar ? "Recriar o ambiente de teste?\n\nOs dados de teste voltam ao começo (o que você mudou neles é desfeito). Nada de turma ou aluno real é tocado." : "Criar o ambiente de teste?\n\nSerão criados uma turma, 8 alunos fictícios, um banco, 3 provas, respostas, notas, diário e status, todos com 🧪 TESTE no nome.", { titulo: "Ambiente de teste", ok: recriar ? "Recriar" : "Criar" }))) return;
    const tf = tarefa({ titulo: recriar ? "Recriando o ambiente de teste" : "Criando o ambiente de teste", icone: "🏗", estimativaSeg: 15 });
    try { if (recriar) await apagarAmbiente({ progresso: t => tf.texto(t) }); const r = await criarAmbiente({ eu, progresso: t => tf.texto(t) });
      tf.fim(`${r.alunos} alunos, ${r.provas} provas e ${r.questoes} questões`); toast("🏗 Ambiente de teste pronto! Veja em Provas, Resultados, Turmas, Acessibilidade e Diário.", "ok"); }
    catch (e) { tf.erro(traduzirErro(e)); toast(traduzirErro(e) + " (as regras novas do Firestore já foram publicadas?)", "erro"); }
    estadoAmbiente(); carregarSimulacao();
  };
  $("#simAmbApagar").onclick = async () => {
    if (!(await confirmar("Apagar TODO o ambiente de teste?\n\nSai a turma 🧪 TESTE, os alunos fictícios, o banco, as 3 provas, as respostas, o diário e os status de teste. Nada real é apagado.", { titulo: "Apagar ambiente de teste", ok: "Apagar", perigo: true }))) return;
    const tf = tarefa({ titulo: "Apagando o ambiente de teste", icone: "🗑", estimativaSeg: 10 });
    try { await apagarAmbiente({ progresso: t => tf.texto(t) }); tf.fim("Ambiente de teste apagado"); } catch (e) { tf.erro(traduzirErro(e)); }
    estadoAmbiente(); carregarSimulacao();
  };
  // SÓ dados fictícios aqui: as provas e os alunos do ambiente de teste (nada de prova ou aluno real)
  const sim = tem ? await Promise.all(SIM.provas.map(id => getDoc(doc(db, "provas", id)).catch(() => null))) : [];
  const provas = sim.filter(d => d?.exists()).map(d => ({ id: d.id, ...d.data() }));
  $("#simProva").innerHTML = provas.length ? provas.map(p => `<option value="${p.id}">${esc(p.titulo)}</option>`).join("") : `<option value="">Crie o ambiente de teste primeiro</option>`;
  $("#simComo").innerHTML = `<option value="">Aluno fictício sem adaptação</option>` + (tem ? ALUNOS_ACESS_SIM.map(a => `<option value="${esc(a.email)}">♿ ${esc(a.nome)} (fictício)</option>`).join("") : "");
  $("#simTestar").disabled = !provas.length;
  $("#simTestar").onclick = () => { const p = $("#simProva").value, como = $("#simComo").value; if (!p) return toast("Escolha uma prova.", "erro");
    window.open(`index.html?teste=${encodeURIComponent(p)}${como ? `&como=${encodeURIComponent(como)}` : ""}`, "_blank"); };
}

// primeiro acesso do superadmin: cria config/geral (sem ele a regra dos alunos não funciona)
async function garantirConfig() {
  const c = await getDoc(doc(db, "config", "geral"));
  if (!c.exists() && ehAdmin()) await setDoc(doc(db, "config", "geral"), { dominiosAlunos: ["edu.senai.br", "aluno.senai.br"], criadoEm: serverTimestamp() });
}

// ============================================================ TEMAS
const questoesCache = {};   // bancoId -> [questões públicas]
async function questoesDoBanco(bancoId, recarregar = false) {
  if (!questoesCache[bancoId] || recarregar) {
    const s = await getDocs(collection(db, "bancos", bancoId, "questoes"));
    questoesCache[bancoId] = s.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return questoesCache[bancoId];
}
// { tema: { alternativa: n, dissertativa: n } }, temas em ordem alfabética
function contarPorTema(questoes) {
  const c = {};
  for (const tema of ordenarTemas(questoes.map(temaDe))) c[tema] = { alternativa: 0, dissertativa: 0, sql: 0, web: 0, diagrama: 0 };
  questoes.forEach(q => { const k = ["dissertativa", "sql", "web", "diagrama"].includes(q.tipo) ? q.tipo : "alternativa"; c[temaDe(q)][k]++; });
  return c;
}
const textoContagem = n => `${n.alternativa} alternativa, ${n.dissertativa} dissertativa${n.sql ? `, ${n.sql} SQL (Bancada)` : ""}${n.web ? `, ${n.web} Web (Bancada)` : ""}${n.diagrama ? `, ${n.diagrama} diagrama${n.diagrama > 1 ? "s" : ""}` : ""}`;
// checkboxes de tema (todos marcados); onMudar é chamado a cada alteração
function desenharChecksTemas(box, contagem, onMudar) {
  const temas = Object.keys(contagem);
  box.innerHTML = (temas.length > 1 ? `<div class="acoes-temas"><button type="button" class="leve mini" data-todos="1">Marcar todos</button><button type="button" class="leve mini" data-todos="0">Desmarcar todos</button></div>` : "") +
    temas.map(t => `<label class="check"><input type="checkbox" value="${esc(t)}" checked><span><b>${esc(t)}</b> <span class="pequeno">— ${textoContagem(contagem[t])}</span></span></label>`).join("");
  box.querySelectorAll("input[type=checkbox]").forEach(c => c.onchange = onMudar);
  box.querySelectorAll("[data-todos]").forEach(b => b.onclick = () => { box.querySelectorAll("input[type=checkbox]").forEach(c => c.checked = b.dataset.todos === "1"); onMudar(); });
}
const temasMarcados = box => [...box.querySelectorAll("input[type=checkbox]:checked")].map(c => c.value);

// ============================================================ TURMAS
let turmasCache = [];
async function listarTurmas() {
  const s = await getDocs(collection(db, "turmas"));
  turmasCache = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  return turmasCache;
}
const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
// Lê a lista colada: uma pessoa por linha, com o nome completo e/ou o e-mail
// ("Maria da Silva", "Maria da Silva <maria@edu.senai.br>", "maria@edu.senai.br", "Maria da Silva;maria@...").
// Linha com vários e-mails (lista antiga separada por vírgula) = vários alunos só com e-mail.
// Devolve { alunos: [{ nome, email }], repetidos: [nomes iguais sem e-mail] }
function extrairAlunos(txt) {
  const alunos = [], porEmail = new Set(), porNome = new Map(), repetidos = new Set();
  const add = (nome, email) => {
    if (email) { if (porEmail.has(email)) return; porEmail.add(email); alunos.push({ nome, email }); return; }
    const k = chaveNome(nome);
    if (!k) return;
    if (porNome.has(k)) { repetidos.add(nome); return; }
    porNome.set(k, true); alunos.push({ nome, email: null });
  };
  for (const linha of String(txt || "").normalize("NFC").split(/\r?\n/)) {
    const emails = (linha.match(RE_EMAIL) || []).map(e => e.toLowerCase());
    if (emails.length > 1) { emails.forEach(e => add("", e)); continue; }
    const nome = linha.replace(RE_EMAIL, " ").replace(/^\s*\d+\s*[.)\-–]?\s+/, "")   // tira "12." / "3 -" do começo (numeração da planilha)
      .replace(/[<>()[\]"'|;,\t]+/g, " ").replace(/\s+/g, " ").trim();
    add(/[a-zà-ÿ]/i.test(nome) ? nome : "", emails[0] || null);
  }
  // o mesmo aluno com e-mail numa linha e só com o nome em outra: fica a linha com e-mail
  const comEmail = new Set(alunos.filter(a => a.email && a.nome).map(a => chaveNome(a.nome)));
  return { alunos: alunos.filter(a => a.email || !comEmail.has(chaveNome(a.nome))), repetidos: [...repetidos] };
}
// alunos de uma turma salva; turmas antigas só têm "emails"; nomes vinculados no 1º login ganham o e-mail
function alunosDaTurma(t) {
  const vinc = t.vinculos || {};
  if (!Array.isArray(t.alunos)) return (t.emails || []).map(e => ({ nome: "", email: e }));
  return t.alunos.map(a => a.email ? a : { nome: a.nome, email: vinc[chaveNome(a.nome)] || null, auto: !!vinc[chaveNome(a.nome)] });
}
const linhaAluno = a => a.email ? (a.nome ? `${a.nome} <${a.email}>` : a.email) : a.nome;
let turmaEditando = null;   // id da turma em edição (null = nova)
function previaTurma() {
  const txt = $("#tEmails").value, { alunos, repetidos } = extrairAlunos(txt);
  if (!txt.trim()) { $("#tPrevia").textContent = ""; return; }
  const comEmail = alunos.filter(a => a.email).length, soNome = alunos.length - comEmail;
  $("#tPrevia").innerHTML = `${alunos.length} aluno(s): ${comEmail} com e-mail` + (soNome ? `, <b>${soNome} só com o nome</b> (vinculam sozinhos no 1º login, se o nome da conta Google for igual)` : "") + "." +
    (repetidos.length ? `<br><span class="erro-texto">⚠ Nome repetido: ${repetidos.map(esc).join(", ")}. Dois alunos com o mesmo nome precisam do e-mail (escreva o e-mail na linha de cada um).</span>` : "");
}
$("#tEmails").oninput = previaTurma;
$("#ftBusca").oninput = $("#ftSemestre").onchange = $("#ftMateria").onchange = $("#ftDia").onchange = $("#ftSemCurso").onchange = () => desenharTurmas();
const marcarDias = l => document.querySelectorAll("#tDias input").forEach(c => c.checked = (l || []).map(Number).includes(Number(c.value)));
const diasMarcados = () => [...document.querySelectorAll("#tDias input:checked")].map(c => Number(c.value));
function limparFormTurma() {
  turmaEditando = null; $("#tNome").value = ""; $("#tSemCurso").value = ""; $("#tEmails").value = ""; previaTurma(); marcarDias([]);
  $("#tFormTitulo").textContent = "Nova turma"; $("#btnCancelarTurma").classList.add("oculto");
  const d = drawerTurma; drawerTurma = null; d?.fechar();
}
// formulário da turma num drawer (o mesmo bloco #formTurma, com os mesmos ids)
let drawerTurma = null;
function abrirFormTurma() {
  if (!podeEditar()) return toast("Seu papel não permite cadastrar turmas.", "erro");
  if (drawerTurma) return;
  drawerTurma = drawer({ titulo: $("#tFormTitulo").textContent, corpo: $("#formTurma"), largo: true,
    aoFechar: () => { $("#formTurma").classList.add("oculto"); if (drawerTurma) { drawerTurma = null; limparFormTurma(); } },
    acoes: [{ t: "Cancelar", classe: "leve" }, { t: "Salvar turma", onClick: () => { $("#btnSalvarTurma").click(); return false; } }] });
}
$("#btnNovaTurma").onclick = () => { limparFormTurma(); abrirFormTurma(); };
$("#btnCancelarTurma").onclick = limparFormTurma;
$("#btnSalvarTurma").onclick = async () => {
  if (!podeEditar()) return toast("Seu papel não permite cadastrar turmas.", "erro");
  const nome = $("#tNome").value.trim(), { alunos, repetidos } = extrairAlunos($("#tEmails").value);
  if (!nome) return toast("Dê um nome para a turma.", "erro");
  if (!alunos.length) return toast("Cole pelo menos um aluno (nome completo ou e-mail).", "erro");
  if (repetidos.length) return toast(`Nome repetido: ${repetidos.join(", ")}. Coloque o e-mail desses alunos.`, "erro");
  const emails = [...new Set(alunos.filter(a => a.email).map(a => a.email))].sort();
  const nomesChave = alunos.filter(a => !a.email).map(a => chaveNome(a.nome));
  // vínculos já feitos foram incorporados ao texto (nome <e-mail>) ao abrir a edição: recomeça do zero
  const semCurso = Number($("#tSemCurso").value) || null;
  // guarda o semestre escolhido e o período de agora: daqui para frente ele avança sozinho
  const dados = { nome, semestreCurso: semCurso, semestreCursoRef: semCurso ? periodoLetivo() : null, diasAula: diasMarcados(), alunos: alunos.map(a => ({ nome: a.nome || "", email: a.email || null })), emails, nomesChave, vinculos: {} };
  if (!dados.diasAula.length && !(await confirmar("Nenhum dia de aula marcado. Sem os dias, o diário considera segunda a sexta. Salvar assim?", { titulo: "Dias de aula", ok: "Salvar assim", cancelar: "Voltar e marcar" }))) return;
  if (dados.diasAula.length && turmaEditando && !(await confirmar(`Salvar as alterações na turma ${nome}? (${alunos.length} aluno(s) na lista)`, { titulo: "Salvar turma", ok: "Salvar" }))) return;
  try {
    if (turmaEditando) await updateDoc(doc(db, "turmas", turmaEditando), { ...dados, atualizadoEm: serverTimestamp(), atualizadoPor: eu.email });
    else await addDoc(collection(db, "turmas"), { ...dados, criadoEm: serverTimestamp(), criadoPor: eu.email });
  } catch (e) { return toast("Não foi possível salvar a turma. " + traduzirErro(e), "erro"); }
  toast(`Turma ${nome} salva com ${alunos.length} aluno(s)` + (nomesChave.length ? ` (${nomesChave.length} aguardando o 1º login).` : "."), "ok");
  limparFormTurma(); carregarTurmas();
};
import { lerStatusAlunos, chipStatus } from "./status-aluno.js";
const turmasAbertas = new Set();   // turmas abertas pelo professor (começam fechadas)
let statusAlunos = new Map();   // e-mail -> status do dia (perfis)
let provasPorTurma = {}, turmaSemMat = {};   // turmaId -> [{ id, titulo, liberada }]
async function carregarTurmas() {
  const [, ps, pls, , st] = await Promise.all([listarTurmas(), getDocs(collection(db, "provas")).catch(() => null), listarPlanos().catch(() => []), listarBancos().catch(() => []), lerStatusAlunos().catch(() => new Map())]);
  statusAlunos = st;
  provasPorTurma = {};
  ps?.forEach(d => { const p = d.data(); if (p.turmaId) (provasPorTurma[p.turmaId] ||= []).push({ id: d.id, ...p }); });
  // semestre/matéria de cada turma: pelos planos de ensino e pelas provas
  turmaSemMat = {};
  const marca = (t, sem, mat) => { if (t) (turmaSemMat[t] ||= []).push({ sem, mat: chaveTexto(mat), nome: mat }); };
  pls.forEach(p => marca(p.turmaId, p.semestre, p.materia));
  Object.entries(provasPorTurma).forEach(([t, l]) => l.forEach(p => marca(t, semestreDaProva(p), materiaDaProva(p, bancosCache))));
  const todas = Object.values(turmaSemMat).flat();
  const preencher = (el, primeira, vals, rot = v => v) => { const a = el.value; el.innerHTML = `<option value="">${primeira}</option>` + vals.map(v => `<option value="${esc(v)}">${esc(rot(v))}</option>`).join(""); el.value = vals.includes(a) ? a : ""; };
  preencher($("#ftSemestre"), "📅 Todos os semestres", [...new Set(todas.map(x => x.sem))].sort().reverse(), rotuloSemestre);
  const mats = new Map(); todas.forEach(x => x.mat && mats.set(x.mat, x.nome));
  preencher($("#ftMateria"), "📚 Todas as matérias", [...mats.values()].sort((a, b) => a.localeCompare(b, "pt-BR")));
  desenharTurmas();
}
function desenharTurmas() {
  const box = $("#listaTurmas");
  if (!turmasCache.length) { $("#ftContagem").textContent = ""; box.innerHTML = vazio({ e: "👥", texto: "Nenhuma turma ainda. Cadastre a primeira colando os nomes completos (ou e-mails) dos alunos.", acao: podeEditar() ? `<button type="button" data-nova-turma>+ Nova turma</button>` : "" }); box.querySelector("[data-nova-turma]")?.addEventListener("click", () => $("#btnNovaTurma").click()); return; }
  const busca = semAcento($("#ftBusca").value.trim()), fS = $("#ftSemestre").value, fM = chaveTexto($("#ftMateria").value), fD = $("#ftDia").value, fC = $("#ftSemCurso").value;
  const bateCurso = t => { if (!fC) return true; const sc = semestreCursoAtual(t); return fC === "sem" ? !sc : fC === "fim" ? !!sc?.concluida : sc && !sc.concluida && String(sc.n) === fC; };
  // pesquisa no nome da turma ou nos alunos (nome/e-mail); achou aluno = abre a lista com só quem bateu
  const linhas = turmasCache.filter(bateCurso).filter(t => !fD || (t.diasAula || []).map(String).includes(fD)).filter(t => (!fS && !fM) || (turmaSemMat[t.id] || []).some(x => (!fS || x.sem === fS) && (!fM || x.mat === fM))).map(t => {
    const al = alunosDaTurma(t);
    if (!busca || semAcento(`${t.nome} ${(t.diasAula || []).map(d => DIAS_SEMANA_LONGO[d]).join(" ")} ${rotuloDias(t.diasAula)}`).includes(busca)) return { t, al, achados: null };
    const achados = al.filter(a => semAcento(`${a.nome} ${a.email || ""}`).includes(busca));
    return achados.length ? { t, al, achados } : null;
  }).filter(Boolean);
  $("#ftContagem").textContent = busca || fS || fM || fD || fC ? `${linhas.length} de ${turmasCache.length} turma(s)` + (linhas.some(l => l.achados) ? ` · ${linhas.reduce((n, l) => n + (l.achados?.length || 0), 0)} aluno(s) encontrado(s)` : "") : `${turmasCache.length} turma(s)`;
  if (!linhas.length) { box.innerHTML = vazio({ e: "🔎", texto: "Nenhuma turma ou aluno com esses filtros." }); return; }
  box.innerHTML = linhas.map(({ t, al, achados }) => {
    const pend = al.filter(a => !a.email), mostrar = achados || al;
    const stT = al.map(a => a.email && statusAlunos.get(a.email.toLowerCase())).filter(i => i?.hoje), dificeis = stT.filter(i => i.dificil).length;
    const pv = provasPorTurma[t.id] || [], sc = semestreCursoAtual(t), libs = pv.filter(p => p.liberada).length;
    const resumo = [pl(al.length, "aluno"), rotuloDias(t.diasAula) || "sem dias de aula", sc?.rotulo, `atualizada em ${dataBR(t.atualizadoEm || t.criadoEm)}`].filter(Boolean).join(" · ");
    const vinculo = a => !a.email ? `<span class="chip warn">aguardando o 1º login</span>` : a.auto ? `<span class="chip info">vinculado no login</span>` : `<span class="chip ok">vinculado</span>`;
    return `<details class="card sem-padding" data-turma="${t.id}" ${achados || turmasAbertas.has(t.id) ? "open" : ""}>
      <summary class="sub-cab"><span class="sc-tile sc-navy">${ic("users", { size: 20 })}</span><span class="sc-texto"><span class="sc-titulo">${esc(t.nome)}</span><span class="sc-resumo">${esc(resumo)}${achados ? ` · ${pl(achados.length, "encontrado")}` : ""}</span></span>
        <span class="sc-fim">${pend.length ? `<span class="chip warn">${pend.length} sem login</span>` : ""}
          ${stT.length ? `<button type="button" class="leve mini" data-status-turma="${t.id}" title="Como os alunos disseram que estão hoje">${pl(stT.length, "status", "status")} hoje${dificeis ? ` · ${pl(dificeis, "difícil", "difíceis")}` : ""}</button>` : ""}
          ${pv.length ? `<button class="leve mini" data-vprovas="${t.id}" title="${esc(pv.map(p => p.titulo).join(" · "))}">${ic("provas", { size: 16 })}${pl(pv.length, "somativa")}${libs ? ` · ${libs} ${libs === 1 ? "liberada" : "liberadas"}` : ""}</button>` : ""}
          ${podeEditar() ? `<button class="leve mini" data-edt="${t.id}">${ic("edit", { size: 16 })}Editar</button>` : ""}
          ${menuHTML({ aria: `Mais ações: ${t.nome}`, itensHTML: itemMenu({ i: "download", t: "Exportar em Excel", attrs: `data-xls-t="${t.id}"` }) + itemMenu({ i: "provas", t: "Exportar em PDF", attrs: `data-pdf-t="${t.id}"` }) +
            (ehAdmin() ? itemMenu({ i: "trash", t: "Apagar turma", perigo: true, attrs: `data-delt="${t.id}"` }) : "") })}</span>${seta()}</summary>
      <div class="tabela sem-borda"><table class="tabela-alunos"><thead><tr><th>Aluno</th><th>E-mail</th><th>Vínculo</th><th>Status do dia</th>${podeEditar() ? `<th><span class="oculto">Ações</span></th>` : ""}</tr></thead><tbody>${mostrar.map(a => `<tr>
        <td><span class="aluno-celula"><span class="avatar-p">${esc(iniciais(a.nome || a.email))}</span>${esc(a.nome || a.email)}</span></td><td class="pequeno">${esc(a.email || "")}</td><td>${vinculo(a)}</td><td>${a.email ? chipStatus(statusAlunos.get(a.email.toLowerCase()), esc) : ""}</td>
        ${podeEditar() ? `<td style="text-align:right">${menuHTML({ aria: `Ações: ${a.nome || a.email}`, itensHTML: itemMenu({ i: "turmas", t: "Mover para outra turma", attrs: `data-mover-al="${t.id}|${al.indexOf(a)}"` }) + itemMenu({ i: "trash", t: "Tirar da turma", perigo: true, attrs: `data-tirar-al="${t.id}|${al.indexOf(a)}"` }) })}</td>` : ""}</tr>`).join("")}</tbody></table></div></details>`;
  }).join("");
  turmasVisiveis = linhas.map(l => l.t);
  box.querySelectorAll("[data-xls-t]").forEach(b => b.onclick = () => exportarTurmas("xlsx", [turmasCache.find(x => x.id === b.dataset.xlsT)]));
  box.querySelectorAll("[data-pdf-t]").forEach(b => b.onclick = () => exportarTurmas("pdf", [turmasCache.find(x => x.id === b.dataset.pdfT)]));
  box.querySelectorAll("[data-tirar-al]").forEach(b => b.onclick = () => { const [id, i] = b.dataset.tirarAl.split("|"); tirarAluno(turmasCache.find(x => x.id === id), Number(i)); });
  box.querySelectorAll("[data-mover-al]").forEach(b => b.onclick = () => { const [id, i] = b.dataset.moverAl.split("|"); moverAluno(turmasCache.find(x => x.id === id), Number(i)); });
  box.querySelectorAll("[data-turma]").forEach(d => d.ontoggle = () => { if (busca) return; d.open ? turmasAbertas.add(d.dataset.turma) : turmasAbertas.delete(d.dataset.turma); });
  box.querySelectorAll("[data-status-turma]").forEach(b => b.onclick = () => abrirStatusTurma(turmasCache.find(x => x.id === b.dataset.statusTurma)));
  box.querySelectorAll("[data-vprovas]").forEach(b => b.onclick = () => { filtroTurmaPendente = b.dataset.vprovas; $("#fpBusca").value = ""; $("#fpStatus").value = ""; abrirAba("provas"); });
  box.querySelectorAll("[data-edt]").forEach(b => b.onclick = () => {
    const t = turmasCache.find(x => x.id === b.dataset.edt);
    turmaEditando = t.id; $("#tNome").value = t.nome || ""; const sc = semestreCursoAtual(t); $("#tSemCurso").value = sc && !sc.concluida ? String(sc.n) : ""; $("#tEmails").value = alunosDaTurma(t).map(linhaAluno).join("\n"); previaTurma(); marcarDias(t.diasAula);
    $("#tFormTitulo").textContent = `Editar turma ${t.nome}`; $("#btnCancelarTurma").classList.remove("oculto");
    abrirFormTurma();
  });
  box.querySelectorAll("[data-delt]").forEach(b => b.onclick = async () => {
    const t = turmasCache.find(x => x.id === b.dataset.delt);
    const usadas = (await getDocs(query(collection(db, "provas"), where("turmaId", "==", t.id)))).size;
    if (!(await confirmar(`Apagar a turma ${t.nome}?` + (usadas ? `\n\n${usadas} prova(s) usam esta turma: elas deixam de aceitar qualquer aluno até você escolher outra turma.` : ""), { titulo: "Apagar turma", ok: "Apagar", perigo: true }))) return;
    await deleteDoc(doc(db, "turmas", t.id)); if (turmaEditando === t.id) limparFormTurma(); carregarTurmas();
  });
}

// ---------- exportar (Excel / PDF): nome e e-mail dos alunos, cada turma separada
let turmasVisiveis = [];   // turmas que passam nos filtros da aba (o botão Exportar da barra usa estas)
function exportarTurmas(tipo, lista = turmasVisiveis) {
  lista = lista.filter(Boolean);
  if (!lista.length) return toast("Nenhuma turma para exportar com esses filtros.", "erro");
  const dados = lista.map(t => ({ nome: t.nome || "Turma", alunos: alunosDaTurma(t).map(a => ({ nome: a.nome || "", email: a.email || "" })),
    info: [rotuloDias(t.diasAula), semestreCursoAtual(t)?.rotulo].filter(Boolean).join(" · ") }));
  const titulo = lista.length === turmasCache.length ? "Todas as turmas" : "Turmas";
  if (tipo === "xlsx") { exportarExcel(dados, titulo); toast(`Planilha baixada: ${pl(lista.length, "turma")}${lista.length > 1 ? " (uma aba para cada, mais o resumo)" : ""}.`, "ok"); }
  else if (!exportarPDF(dados, titulo)) toast("O navegador bloqueou a janela. Libere pop-ups para este site.", "erro");
  else toast('Na janela que abriu, escolha "Salvar como PDF".', "ok");
}
$("#btnTurmasXLS").onclick = () => exportarTurmas("xlsx");
$("#btnTurmasPDF").onclick = () => exportarTurmas("pdf");

// ---------- tirar um aluno da turma / mover para outra
// grava a lista no mesmo formato do formulário da turma (vínculos já feitos viram o e-mail na lista)
function dadosDaLista(lista) {
  const alunos = lista.map(a => ({ nome: a.nome || "", email: a.email ? a.email.toLowerCase() : null }));
  return { alunos, emails: [...new Set(alunos.filter(a => a.email).map(a => a.email))].sort(), nomesChave: alunos.filter(a => !a.email).map(a => chaveNome(a.nome)), vinculos: {} };
}
const mesmaPessoa = (a, b) => (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) || (!!a.nome && !!b.nome && chaveNome(a.nome) === chaveNome(b.nome) && (!a.email || !b.email || a.email.toLowerCase() === b.email.toLowerCase()));
const quem = a => a.nome ? `${a.nome}${a.email ? ` (${a.email})` : ""}` : a.email;
async function tirarAluno(t, i) {
  if (!t || !podeEditar()) return;
  const lista = alunosDaTurma(t), a = lista[i];
  if (!a) return;
  if (!(await confirmar(`Tirar ${quem(a)} da turma ${t.nome}?\n\nO aluno deixa de ver as provas desta turma. As notas e tentativas que ele já fez continuam guardadas.`, { titulo: "Tirar da turma", ok: "Tirar da turma", perigo: true }))) return;
  try { await updateDoc(doc(db, "turmas", t.id), { ...dadosDaLista(lista.filter((_, k) => k !== i)), atualizadoEm: serverTimestamp(), atualizadoPor: eu.email }); }
  catch (e) { return toast("Não foi possível tirar o aluno. " + traduzirErro(e), "erro"); }
  toast(`${a.nome || a.email} saiu da turma ${t.nome}.`, "ok");
  carregarTurmas();
}
async function moverAluno(t, i) {
  if (!t || !podeEditar()) return;
  const lista = alunosDaTurma(t), a = lista[i], outras = turmasCache.filter(x => x.id !== t.id);
  if (!a) return;
  if (!outras.length) return toast("Não há outra turma cadastrada. Crie a turma de destino primeiro.", "erro");
  let destinoId = "";
  const ok = await modal({ titulo: "Mover para outra turma", ok: "Mover", cancelar: "Cancelar",
    conteudo: `<p>Mover <b>${esc(quem(a))}</b> da turma <b>${esc(t.nome)}</b> para:</p>
      <label for="mvDestino">Turma de destino</label><select id="mvDestino"><option value="">— escolha a turma —</option>${outras.map(x => `<option value="${x.id}">${esc(nomeTurma(x))}</option>`).join("")}</select>
      <label class="check" style="margin-top:12px"><input type="checkbox" id="mvManter"> <span>Manter também na turma ${esc(t.nome)} (copiar em vez de mover)</span></label>
      <p class="pequeno">As notas e tentativas que o aluno já fez continuam guardadas.</p>`,
    antesDeConfirmar: async caixa => {
      destinoId = $("#mvDestino", caixa).value;
      const dest = turmasCache.find(x => x.id === destinoId), manter = $("#mvManter", caixa).checked;
      if (!dest) { toast("Escolha a turma de destino.", "erro"); return false; }
      const listaDest = alunosDaTurma(dest);
      if (listaDest.some(b => mesmaPessoa(a, b))) { toast(`${a.nome || a.email} já está na turma ${dest.nome}.`, "erro"); return false; }
      if (!(await confirmar(`${manter ? "Copiar" : "Mover"} ${quem(a)} ${manter ? "também para" : `de ${t.nome} para`} ${dest.nome}?`, { titulo: manter ? "Copiar aluno" : "Mover aluno", ok: manter ? "Copiar" : "Mover" }))) return false;
      const lote = writeBatch(db), carimbo = { atualizadoEm: serverTimestamp(), atualizadoPor: eu.email };
      lote.update(doc(db, "turmas", dest.id), { ...dadosDaLista([...listaDest, { nome: a.nome, email: a.email }]), ...carimbo });
      if (!manter) lote.update(doc(db, "turmas", t.id), { ...dadosDaLista(lista.filter((_, k) => k !== i)), ...carimbo });
      try { await lote.commit(); } catch (e) { toast("Não foi possível mover o aluno. " + traduzirErro(e), "erro"); return false; }
      toast(`${a.nome || a.email} ${manter ? "agora também está" : "agora está"} na turma ${dest.nome}.`, "ok");
      return true;
    } });
  if (ok) carregarTurmas();
}

// status do dia da turma: difíceis primeiro, depois os de hoje, depois os antigos
function abrirStatusTurma(t) {
  if (!t) return;
  const linhas = alunosDaTurma(t).filter(a => a.email).map(a => ({ a, i: statusAlunos.get(a.email.toLowerCase()) }))
    .sort((x, y) => (y.i?.hoje && y.i?.dificil) - (x.i?.hoje && x.i?.dificil) || (!!y.i?.hoje - !!x.i?.hoje) || (x.a.nome || x.a.email).localeCompare(y.a.nome || y.a.email, "pt-BR"));
  const hora = d => d ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  drawer({ titulo: `💬 Status da turma ${t.nome}`, ajuda: "<p>O aluno escolhe uma frase em “Como você está hoje?” na página dele. Os status difíceis (triste, estressado, ansioso…) aparecem primeiro: vale uma conversa. Status de outros dias aparecem com a data.</p>",
    corpoHTML: `<ul class="lista-status">${linhas.map(({ a, i }) => `<li class="${i?.hoje && i.dificil ? "dificil" : ""}"><b>${esc(a.nome || a.email)}</b> ${i ? chipStatus(i, esc) + ` <span class="pequeno">${hora(i.em)}</span>` : `<span class="pequeno">sem status</span>`}</li>`).join("")}</ul>`,
    acoes: [{ t: "Fechar", classe: "leve" }] });
}

// ============================================================ MATERIAIS DE CONSULTA (PDF)
let materiaisCache = [];
async function listarMateriaisCache() { materiaisCache = await listarMateriais(); return materiaisCache; }
// envia o PDF mostrando o andamento em `el`; devolve o material ou null
async function enviarPdf(file, titulo, el) {
  if (!podeEditar()) { toast("Seu papel não permite enviar material.", "erro"); return null; }
  el.textContent = "Preparando o envio…";
  try {
    const m = await enviarMaterial(file, titulo, eu.email, (i, n) => {
      const pct = n ? Math.round(i / n * 100) : 0;
      el.innerHTML = `<progress class="barra" max="100" value="${pct}"></progress> Enviando ${esc(file.name)}: ${pct}% (${i} de ${n} partes)`;
    });
    el.textContent = `✅ ${m.titulo} enviado (${tamanhoTexto(m.tamanho)}).`;
    await listarMateriaisCache();
    return m;
  } catch (e) { const msg = erroMaterial(e, traduzirErro); el.textContent = "⚠ " + msg; toast(msg, "erro"); return null; }
}
// abre o PDF no mesmo leitor que o aluno usa
async function verMaterial(id) {
  if (!id) return;
  let leitor = null;
  const m = materiaisCache.find(x => x.id === id);
  await modal({
    titulo: m?.titulo || "Material de consulta", largo: true, ok: "Fechar",
    conteudo: `<div class="leitor-modal"><p class="pequeno">Carregando…</p></div>`,
    aoAbrir: async caixa => {
      const box = caixa.querySelector(".leitor-modal");
      try { const { bytes } = await baixarMaterial(id); leitor = await abrirLeitorPdf(box, bytes); }
      catch (e) { box.innerHTML = `<p class="erro-texto">Não foi possível abrir o PDF. ${esc(traduzirErro(e))}</p>`; }
    }
  });
  leitor?.destruir();
}
async function carregarMateriais() {
  const box = $("#listaMateriais");
  try { await listarMateriaisCache(); } catch (e) { box.innerHTML = `<p class="pequeno">Não foi possível listar. ${esc(traduzirErro(e))}</p>`; return; }
  $("#matResumo").textContent = `${pl(materiaisCache.length, "arquivo")} · o aluno lê dentro da tela da prova`;
  if (!materiaisCache.length) { box.innerHTML = `<p class="help">Nenhum PDF enviado ainda.</p>`; return; }
  box.innerHTML = `<div class="tabela"><table><tr><th>Material</th><th>Tamanho</th><th>Enviado</th><th></th></tr>` + materiaisCache.map(m =>
    `<tr><td><b>${esc(m.titulo)}</b><br><span class="pequeno">${esc(m.arquivo || "")}</span></td><td>${tamanhoTexto(m.tamanho)}</td><td class="pequeno">${dataBR(m.criadoEm)}<br>${esc(m.criadoPor || "")}</td>
     <td class="td-acoes"><button class="leve mini" data-vermat="${m.id}" title="Abre o PDF numa aba nova">${ic("eye", { size: 16 })}Ver</button> ${podeEditar() ? menuHTML({ aria: `Mais ações: ${m.titulo}`, itensHTML: itemMenu({ i: "trash", t: "Apagar", perigo: true, attrs: `data-delmat="${m.id}"` }) }) : ""}</td></tr>`).join("") + "</table></div>";
  box.querySelectorAll("[data-vermat]").forEach(b => b.onclick = () => abrirMaterialEmAba(b.dataset.vermat, traduzirErro).catch(e => toast(e.message, "erro")));
  box.querySelectorAll("[data-delmat]").forEach(b => b.onclick = async () => {
    const m = materiaisCache.find(x => x.id === b.dataset.delmat);
    const [a, b2] = await Promise.all([   // provas novas (lista de PDFs) e antigas (um PDF só)
      getDocs(query(collection(db, "provas"), where("materiaisConsultaIds", "array-contains", m.id))),
      getDocs(query(collection(db, "provas"), where("materialConsultaArquivoId", "==", m.id)))]);
    const usadas = new Set([...a.docs, ...b2.docs].map(d => d.id)).size;
    if (!(await confirmar(`Apagar o PDF "${m.titulo}"?` + (usadas ? `\n\n${usadas} prova(s) usam este material: os alunos vão ver "Não foi possível carregar o material" neste PDF. Desmarque-o nessas provas antes.` : ""), { titulo: "Apagar material", ok: "Apagar", perigo: true }))) return;
    try { await apagarMaterial(m.id); toast("Material apagado.", "ok"); } catch (e) { toast("Não foi possível apagar. " + erroMaterial(e, traduzirErro), "erro"); }
    carregarMateriais();
  });
}
$("#btnEnviarMaterial").onclick = async () => {
  const file = $("#matArquivo").files[0];
  if (!file) return toast("Escolha o arquivo PDF.", "erro");
  const m = await enviarPdf(file, $("#matTitulo").value, $("#msgMaterial"));
  if (m) { $("#matArquivo").value = ""; $("#matTitulo").value = ""; carregarMateriais(); }
};

// ============================================================ PROVAS
let bancosCache = [];
async function listarBancos() {
  const s = await getDocs(collection(db, "bancos"));
  bancosCache = []; s.forEach(d => bancosCache.push({ id: d.id, ...d.data() }));
  bancosCache.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  return bancosCache;
}

// ---------- formulário da prova (o mesmo para "Nova prova" e para o modal "Editar") ----------
// f = prefixo dos ids: "p" (nova prova) ou "e" (editar)
const ordemNatural = (a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
const AJUDA_MATERIAL = "Google Drive: Compartilhar → Qualquer pessoa com o link → copiar link. Google Slides: Arquivo → Compartilhar → Publicar na web. Cole o link aqui.";
function formProvaHTML(f) {
  return `
  <div class="grade">
    <div><label for="${f}Titulo">Título</label><input type="text" id="${f}Titulo" placeholder="MS5 — DML"></div>
    <div><label for="${f}Turma">Turma</label><select id="${f}Turma"></select></div>
  </div>
  <div class="grade">
    <div><label for="${f}Semestre">Semestre</label><select id="${f}Semestre"></select></div>
    <div><label for="${f}Materia">Matéria</label><select id="${f}Materia" aria-label="Matéria da prova"><option value="">— Todas as matérias —</option></select>
      <p class="pequeno" style="margin:4px 0 0">Filtra os bancos abaixo; sem seleção, o campo é detectado do primeiro banco marcado.</p></div>
    <div><label for="${f}Data">Data da somativa</label><input type="date" id="${f}Data"></div>
  </div>
  ${htmlEditorTopicos(f)}
  <p id="${f}Trava" class="aviso-box oculto" role="note"></p>
  <fieldset class="temas-box">
    <legend>Bancos e temas que entram no sorteio</legend>
    <p class="pequeno" style="margin-top:0">Marque um ou vários bancos; o sorteio junta as questões de todos. Dentro de cada banco, desmarque os temas que não entram.</p>
    <div class="filtro-temas">
      <input type="search" id="${f}TemasBusca" placeholder="Filtrar bancos e temas…" aria-label="Filtrar bancos e temas">
      <select id="${f}TemasVisao" aria-label="Como mostrar os temas"><option value="banco">Agrupar por banco</option><option value="juntos">Todos os temas juntos</option></select>
      <label class="check"><input type="checkbox" id="${f}TemasSoMarcados"> <span>Só os marcados</span></label>
      <span class="filtro-acoes"><button type="button" class="leve mini" id="${f}TemasMarcar">Marcar visíveis</button><button type="button" class="leve mini" id="${f}TemasDesmarcar">Desmarcar visíveis</button></span>
    </div>
    <div id="${f}Temas" class="lista-bancos" role="group" aria-label="Bancos e temas"><p class="pequeno">Carregando bancos…</p></div>
    <p id="${f}TemasResumo" class="pequeno temas-resumo" role="status" aria-live="polite"></p>
  </fieldset>
  <div class="grade">
    <div><label for="${f}NAlt">Alternativas por aluno</label><input type="number" id="${f}NAlt" value="7" min="0"></div>
    <div><label for="${f}NDiss">Dissertativas por aluno</label><input type="number" id="${f}NDiss" value="3" min="0">
      <p class="pequeno" id="${f}NTotal" style="margin:4px 0 0" aria-live="polite"></p></div>
    <div><label for="${f}NWeb">Projetos web (Bancada Web) por aluno</label><input type="number" id="${f}NWeb" value="0" min="0" title="Prova prática de HTML/CSS num editor parecido com o VS Code, com prévia ao vivo (escolha o tema do projeto nos temas do banco)"></div>
    <div><label for="${f}NSql">Questões SQL na Bancada por aluno</label><input type="number" id="${f}NSql" value="0" min="0" title="Questões práticas: o aluno escreve e executa SQL numa bancada parecida com o MySQL Workbench (cada aluno recebe um cenário sorteado)"></div>
    <div><label for="${f}NDiag">Diagramas por aluno</label><input type="number" id="${f}NDiag" value="0" min="0" title="O aluno monta o diagrama na prova: casos de uso, matriz de rastreabilidade, Kanban… (Levantamento de Requisitos) ou modelo conceitual/lógico no estilo brModelo (Banco de Dados)"></div>
  </div>
  <div class="grade">
    <div><label for="${f}Codigo">Código de acesso (opcional)</label>
      <div class="linha" style="flex-wrap:nowrap"><input type="text" id="${f}Codigo" placeholder="sem código" autocomplete="off" spellcheck="false" style="text-transform:uppercase"><button type="button" class="leve mini" id="${f}GerarCodigo" style="flex:0 0 auto;min-width:0">Gerar</button></div>
      <p class="pequeno" style="margin:4px 0 0">O aluno digita o código antes de começar. Informe na sala.</p></div>
  </div>
  <div class="grade">
    <div><label for="${f}Tempo">Tempo limite (min, 0 = sem limite)</label><input type="number" id="${f}Tempo" value="0" min="0" step="5"></div>
    <div><label for="${f}Modo">Exibição das questões</label>
      <select id="${f}Modo"><option value="uma">Uma por vez</option><option value="todas">Todas na mesma página (cada uma com seu botão Enviar)</option></select></div>
  </div>
  <fieldset class="temas-box">
    <legend>Regras da somativa</legend>
    <p class="pequeno" style="margin-top:0">A ordem das questões e das alternativas é sempre embaralhada para cada aluno. Durante a somativa o aluno não vê se acertou; no fim vê só quantas acertou e a nota.</p>
    <label class="check"><input type="checkbox" id="${f}Voltar"> <span>Permitir ir e voltar entre as questões <span class="pequeno">— o aluno pode alterar as respostas até clicar em Finalizar; sem isso, cada resposta enviada fica travada</span></span></label>
    <label class="check"><input type="checkbox" id="${f}PermitirTrocaAba"> <span>Permitir trocar de aba/janela <span class="pequeno">— sem tela cheia e sem aviso; as trocas continuam contadas, marcadas como "permitido"</span></span></label>
    <label class="check"><input type="checkbox" id="${f}PermitirColar"> <span>Permitir colar nos campos de resposta <span class="pequeno">— colar e arrastar liberados, sem registro</span></span></label>
    <div class="grade" style="margin:12px 0 0">
      <div><label for="${f}MaxTrocas">❤️ Vidas do aluno (0 = sem vidas)</label><input type="number" id="${f}MaxTrocas" value="0" min="0" max="10" step="1"></div>
      <div><label for="${f}AcaoExceder">Quando as vidas acabam</label>
        <select id="${f}AcaoExceder"><option value="encerrar">Encerrar a somativa</option><option value="perderQuestao">Perder a questão atual (só em "uma por vez" sem ir e voltar)</option></select></div>
    </div>
    <div class="grade" style="margin:8px 0 0">
      <div><label for="${f}SegVolta">⏱ Segundos para voltar após sair (0 = sem timer)</label><input type="number" id="${f}SegVolta" value="5" min="0" max="120" step="1">
        <span class="pequeno">Fora da prova, perde mais 1 vida a cada tantos segundos (conferido também pelo servidor).</span></div>
      <div><label for="${f}EntradaAte">🚪 Fechar a entrada às (opcional)</label><input type="datetime-local" id="${f}EntradaAte">
        <span class="pequeno">Depois deste horário ninguém mais começa (quem já começou continua). Em <b>Resultados</b> você fecha na hora, barra aluno ou deixa um atrasado entrar.</span></div>
    </div>
    <label class="check"><input type="checkbox" id="${f}ColarVida" checked> <span>Tentar colar (Ctrl+V) também custa 1 vida</span></label>
    <div class="grade" style="margin:8px 0 0">
      <label class="check"><input type="checkbox" id="${f}Dicas"> <span>💡 Permitir pedir dicas ao mascote <span class="pequeno">— uma dica curta que não entrega a resposta; fica registrado quem pediu e em qual questão</span></span></label>
      <div><label for="${f}DicasMax">Dicas por aluno (para a prova toda)</label><input type="number" id="${f}DicasMax" value="3" min="1" max="10" step="1"></div>
    </div>
    <p class="pequeno" id="${f}LimiteDica">Perde 1 vida: trocar de aba/janela (Alt+Tab) ou sair da tela cheia.</p>
    <p class="pequeno" style="margin:4px 0 0">Aluno perdeu vidas sem querer (ex.: TEA)? Em <b>Resultados</b> você restaura as vidas, dá vida extra ou reabre a somativa dele.</p>
  </fieldset>
  <fieldset class="temas-box">
    <legend>Correção</legend>
    <label class="check"><input type="checkbox" id="${f}IaAuto" checked> <span>🤖 Corrigir as dissertativas com IA automaticamente</span></label>
    <p class="pequeno" style="margin:4px 0 0">Ligado: cada somativa é corrigida quando o aluno finaliza (pelo servidor de correção, ou pelo painel aberto em Resultados com o ao vivo). Desligado: você corrige à mão ou clica em Corrigir com IA quando quiser. A nota fica provisória até corrigir.</p>
  </fieldset>
  <fieldset class="temas-box">
    <legend>Material de consulta (opcional) <button data-ajuda-item="slides"></button></legend>
    <div class="grade">
      <div><label for="${f}MatTitulo">Título do material (topo do painel)</label><input type="text" id="${f}MatTitulo" placeholder="Slides das aulas 6 a 8"></div>
      <div class="col-2"><span class="rotulo">Slides em PDF — marque um ou vários (o aluno troca entre eles por abas, dentro da prova)</span>
        <div id="${f}MatLista" class="lista-materiais" role="group" aria-label="PDFs de consulta"></div>
        <div class="linha" style="margin-top:6px"><label class="botao-arquivo leve mini" style="flex:0 0 auto">⬆ Enviar PDF(s)<input type="file" id="${f}MatUpload" accept="application/pdf,.pdf" multiple hidden></label></div>
        <p class="pequeno" id="${f}MatEnvio" aria-live="polite" style="margin:4px 0 0"></p></div>
    </div>
    <div class="grade">
      <div class="col-2"><label for="${f}MatUrl">… ou link externo (Google Drive/Slides/Docs)</label><input type="url" id="${f}MatUrl" placeholder="https://drive.google.com/file/d/…/view"></div>
    </div>
    <p class="pequeno">PDF: exporte os slides em PDF (PowerPoint: Arquivo → Exportar → PDF · Google Slides: Arquivo → Fazer download → PDF), até ${MAX_MB} MB. Link: ${AJUDA_MATERIAL}</p>
    <p class="pequeno" id="${f}MatPrevia" aria-live="polite"></p>
  </fieldset>`;
}

// Converte links do Google para a versão que abre dentro de um iframe; outros links ficam como estão.
function converterLinkMaterial(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  let m;
  if ((m = /^https?:\/\/drive\.google\.com\/file\/d\/([\w-]+)/.exec(u))) return `https://drive.google.com/file/d/${m[1]}/preview`;
  if ((m = /^https?:\/\/drive\.google\.com\/open\?(?:.*&)?id=([\w-]+)/.exec(u))) return `https://drive.google.com/file/d/${m[1]}/preview`;
  // "Publicar na web" gera /d/e/<id>/pub — tratar antes do /d/<id>/ comum
  if ((m = /^https?:\/\/docs\.google\.com\/presentation\/d\/e\/([\w-]+)/.exec(u))) return `https://docs.google.com/presentation/d/e/${m[1]}/embed?start=false&loop=false`;
  if ((m = /^https?:\/\/docs\.google\.com\/presentation\/d\/([\w-]+)/.exec(u))) return `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false`;
  if ((m = /^https?:\/\/docs\.google\.com\/document\/d\/e\/([\w-]+)/.exec(u))) return `https://docs.google.com/document/d/e/${m[1]}/pub?embedded=true`;
  if ((m = /^https?:\/\/docs\.google\.com\/document\/d\/([\w-]+)/.exec(u))) return `https://docs.google.com/document/d/${m[1]}/preview`;
  return u;
}

const LEGADO = "__texto_antigo__";
// código de acesso: maiúsculas, sem espaços (ex.: AET-7K3Q)
const normalizarCodigo = c => String(c || "").toUpperCase().replace(/\s+/g, "");
function gerarCodigo() {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ", mistos = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // sem 0/O e 1/I, que confundem
  const sorteia = (base, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), x => base[x % base.length]).join("");
  return `${sorteia(letras, 3)}-${sorteia(mistos, 4)}`;
}
// Controla um formulário de prova: temas do banco, resumo ao vivo, validação, leitura e preenchimento.
function controleProva(f) {
  const $f = s => $("#" + f + s);
  let travado = false, turmaLegada = "", matMarcados = [];
  // tópicos do plano de curso: a unidade automática segue a matéria (ou a do 1º banco marcado)
  const topicosPlano = editorTopicos(f, () => $f("Materia").value.trim() || (bancosCache.find(x => x.id === bancosMarcados()[0])?.materia || ""),
    () => ({ turma: turmaEscolhida().turma, titulo: $f("Titulo").value, data: $f("Data").value }));
  // sel: bancoId -> Set de temas marcados (null = "todos", resolvido quando os temas do banco carregam)
  // contagens: bancoId -> { tema: {alternativa, dissertativa} } ou "erro"; abertos: bancos expandidos na visão por banco
  let sel = new Map(), contagens = {}, abertos = new Set(), carregando = null;
  const temasDe = b => contagens[b] && contagens[b] !== "erro" ? Object.keys(contagens[b]) : [];
  const bancosMarcados = () => bancosCache.map(b => b.id).filter(b => sel.get(b)?.size && temasDe(b).length);
  const disponiveis = () => {
    const d = { alternativa: 0, dissertativa: 0, sql: 0, web: 0, diagrama: 0 };
    for (const b of bancosMarcados()) for (const t of sel.get(b)) { const c = contagens[b][t]; if (c) { d.alternativa += c.alternativa; d.dissertativa += c.dissertativa; d.sql += c.sql || 0; d.web += c.web || 0; d.diagrama += c.diagrama || 0; } }
    return d;
  };
  const carregado = () => bancosCache.some(b => contagens[b.id]);
  // devolve a mensagem de erro (ou "") para o pedido atual
  function problema() {
    const nAlt = Number($f("NAlt").value || 0), nDiss = Number($f("NDiss").value || 0), d = disponiveis();
    if (travado || !carregado()) return "";
    if (!bancosMarcados().length) return "Marque pelo menos um banco (ou um tema de algum banco).";
    if (nAlt > d.alternativa) return `Faltam questões de alternativa: a prova pede ${nAlt}, mas os bancos/temas marcados só têm ${d.alternativa}. Marque mais temas ou diminua as alternativas.`;
    const nSql = Number($f("NSql").value || 0), nWeb = Number($f("NWeb").value || 0);
    if (nWeb > d.web) return `Faltam projetos da Bancada Web: a prova pede ${nWeb}, mas os bancos/temas marcados só têm ${d.web}. Importe o banco da Bancada Web ou marque o tema do projeto.`;
    const nDiag = Number($f("NDiag").value || 0);
    if (nDiag > d.diagrama) return `Faltam questões de diagrama: a prova pede ${nDiag}, mas os bancos/temas marcados só têm ${d.diagrama}. Importe um banco de diagramas (Bancos prontos) ou diminua.`;
    if (nSql > d.sql) return `Faltam questões SQL (Bancada): a prova pede ${nSql}, mas os bancos/temas marcados só têm ${d.sql}. Importe o banco da Bancada SQL ou diminua.`;
    if (nDiss > d.dissertativa) return `Faltam dissertativas: a prova pede ${nDiss}, mas os bancos/temas marcados só têm ${d.dissertativa}. Marque mais temas ou diminua as dissertativas.`;
    return "";
  }
  function atualizar() {
    topicosPlano.aoMudarMateria();
    const nAlt = Number($f("NAlt").value || 0), nDiss = Number($f("NDiss").value || 0);
    $f("NTotal").textContent = `Total: ${nAlt + nDiss + Number($f("NSql").value || 0) + Number($f("NWeb").value || 0) + Number($f("NDiag").value || 0)} questões por aluno.`;
    const el = $f("TemasResumo");
    if (!carregado()) { el.textContent = ""; el.classList.remove("erro"); return; }
    const prob = problema(), bs = bancosMarcados();
    const nomes = bs.map(b => bancosCache.find(x => x.id === b)?.nome || b);
    el.textContent = (bs.length ? `${bs.length === 1 ? "1 banco" : `${bs.length} bancos`} (${nomes.join(" + ")}) · disponíveis: ${textoContagem(disponiveis())}.` : "Nenhum banco marcado.") + (prob ? " ⚠ " + prob : "");
    el.classList.toggle("erro", !!prob);
  }
  // carrega os temas de todos os bancos e desenha a lista. selecao (Map bancoId -> Set|null) substitui as marcações;
  // sem selecao mantém as do professor (bancos apagados saem)
  function carregarTemas(selecao = null) {
    if (selecao) { sel = selecao; abertos = new Set(sel.keys()); }
    for (const b of [...sel.keys()]) if (!bancosCache.some(x => x.id === b)) sel.delete(b);
    if (!bancosCache.length) { $f("Temas").innerHTML = `<p class="pequeno">Nenhum banco ainda. Importe um na aba <b>Bancos de questões</b>.</p>`; atualizar(); return Promise.resolve(); }
    desenharTemas();
    carregando = Promise.all(bancosCache.map(b => questoesDoBanco(b.id)
      .then(qs => { contagens[b.id] = contarPorTema(qs); })
      .catch(() => { contagens[b.id] = "erro"; })))
      .then(() => {
        // "todos" (null) vira a lista completa de temas do banco
        for (const [b, s] of sel) if (s === null) sel.set(b, new Set(temasDe(b)));
        opcoesMateria();
        desenharTemas();
      });
    return carregando;
  }
  const marcadoTema = (b, t) => !!sel.get(b)?.has?.(t);
  const casa = (txt, busca) => !busca || txt.toLocaleLowerCase("pt-BR").includes(busca);
  // temas visíveis com os filtros atuais: [{ b, t }]
  function temasVisiveis() {
    const busca = $f("TemasBusca").value.trim().toLocaleLowerCase("pt-BR"), so = $f("TemasSoMarcados").checked, filtroMat = $f("Materia").value, r = [];
    for (const banco of bancosCache) {
      if (filtroMat && banco.materia !== filtroMat) continue;
      const nomeCasa = casa(banco.nome || "", busca);
      for (const t of temasDe(banco.id)) if ((nomeCasa || casa(t, busca)) && (!so || marcadoTema(banco.id, t))) r.push({ b: banco.id, t });
    }
    return r;
  }
  const checkTema = (b, t, extra = "") => `<label class="check"><input type="checkbox" data-b="${b}" value="${esc(t)}"${marcadoTema(b, t) ? " checked" : ""}${travado ? " disabled" : ""}><span><b>${esc(t)}</b>${extra} <span class="pequeno">— ${textoContagem(contagens[b][t])}</span></span></label>`;
  function desenharTemas() {
    const box = $f("Temas"), topo = box.scrollTop;
    const busca = $f("TemasBusca").value.trim(), so = $f("TemasSoMarcados").checked, vis = temasVisiveis();
    const nomeBanco = b => bancosCache.find(x => x.id === b)?.nome || b;
    let h = "";
    if ($f("TemasVisao").value === "juntos") {
      vis.sort((x, y) => ordemNatural(x.t, y.t) || ordemNatural(nomeBanco(x.b), nomeBanco(y.b)));
      h = vis.length ? `<div class="lista-temas">${vis.map(({ b, t }) => checkTema(b, t, ` <span class="tag banco-tag">${esc(nomeBanco(b))}</span>`)).join("")}</div>` : "";
    } else {
      const filtroMat = $f("Materia").value;
      const bancosFiltrados = bancosCache.filter(b => !filtroMat || b.materia === filtroMat);
      const bancoPorGrupo = banco => {
        const b = banco.id, c = contagens[b], dele = vis.filter(v => v.b === b);
        if ((busca || so) && c && !dele.length) return "";
        if (so && !c && !sel.get(b)?.size && sel.get(b) !== null) return "";
        const todos = temasDe(b), n = sel.get(b)?.size || 0, aberto = abertos.has(b) || !!busca;
        const tot = c && c !== "erro" ? Object.values(c).reduce((s, x) => ({ alternativa: s.alternativa + x.alternativa, dissertativa: s.dissertativa + x.dissertativa }), { alternativa: 0, dissertativa: 0 }) : null;
        const mostraMat = !filtroMat && banco.materia;   // matéria no cabeçalho do banco quando não há grupo
        return `<div class="grupo-banco${n ? " marcado" : ""}" data-grupo="${b}">
          <div class="banco-cab">
            <label class="check"><input type="checkbox" data-banco="${b}"${todos.length && n === todos.length ? " checked" : ""}${!todos.length || travado ? " disabled" : ""}>
              <span><b>${esc(banco.nome)}</b>${mostraMat ? "" : ""}</span></label>
            <span class="pequeno banco-info">${!c ? "carregando…" : c === "erro" ? "⚠ não carregou" : `${n}/${todos.length} temas · ${textoContagem(tot)}`}</span>
            ${todos.length ? `<button type="button" class="leve mini" data-abrir="${b}" aria-expanded="${aberto}" aria-label="${aberto ? "Recolher" : "Mostrar"} temas de ${esc(banco.nome)}">${aberto ? "▾ temas" : "▸ temas"}</button>` : ""}
          </div>
          ${aberto && dele.length ? `<div class="lista-temas">${dele.map(({ t }) => checkTema(b, t)).join("")}</div>` : ""}
        </div>`;
      };
      if (!filtroMat) {
        // agrupar por matéria
        const materias = [...new Set(bancosFiltrados.map(b => b.materia || ""))].sort((a, v) => a.localeCompare(v, "pt-BR"));
        for (const mat of materias) {
          const grupo = bancosFiltrados.filter(b => (b.materia || "") === mat).map(bancoPorGrupo).join("");
          if (!grupo) continue;
          if (mat) h += `<div class="grupo-materia-cab">${esc(mat)}</div>`;
          h += grupo;
        }
      } else {
        h += bancosFiltrados.map(bancoPorGrupo).join("");
      }
    }
    box.innerHTML = h || `<p class="pequeno">Nada encontrado com esse filtro.</p>`;
    box.scrollTop = topo;
    box.querySelectorAll("input[data-banco]").forEach(x => {
      const n = sel.get(x.dataset.banco)?.size || 0;
      x.indeterminate = n > 0 && n < temasDe(x.dataset.banco).length;
      x.onchange = () => {
        const b = x.dataset.banco;
        sel.set(b, x.checked ? new Set(temasDe(b)) : new Set());
        if (x.checked) abertos.add(b);
        desenharTemas();
      };
    });
    box.querySelectorAll("input[data-b]").forEach(x => x.onchange = () => {
      const b = x.dataset.b, s = sel.get(b) instanceof Set ? sel.get(b) : new Set();
      x.checked ? s.add(x.value) : s.delete(x.value); sel.set(b, s);
      sincronizarBanco(b);
    });
    box.querySelectorAll("[data-abrir]").forEach(x => x.onclick = () => {
      const b = x.dataset.abrir; abertos.has(b) ? abertos.delete(b) : abertos.add(b);
      desenharTemas(); box.querySelector(`[data-abrir="${b}"]`)?.focus();
    });
    atualizar();
  }
  // depois de marcar um tema: atualiza só o cabeçalho do banco (sem redesenhar, para não perder o foco)
  function sincronizarBanco(b) {
    const box = $f("Temas"), n = sel.get(b)?.size || 0, todos = temasDe(b);
    const cb = box.querySelector(`input[data-banco="${b}"]`);
    if (cb) { cb.checked = todos.length > 0 && n === todos.length; cb.indeterminate = n > 0 && n < todos.length; }
    const g = box.querySelector(`[data-grupo="${b}"]`);
    if (g) {
      g.classList.toggle("marcado", n > 0);
      const info = g.querySelector(".banco-info"); if (info) info.textContent = info.textContent.replace(/^\d+\/\d+ temas/, `${n}/${todos.length} temas`);
    }
    atualizar();
  }
  // marca/desmarca todos os temas visíveis com o filtro atual
  function marcarVisiveis(marcar) {
    for (const { b, t } of temasVisiveis()) {
      const s = sel.get(b) instanceof Set ? sel.get(b) : new Set();
      marcar ? s.add(t) : s.delete(t); sel.set(b, s);
      if (marcar) abertos.add(b);
    }
    desenharTemas();
  }
  // lista de PDFs enviados, com caixa de marcar (vários por prova). selecionados = null mantém as marcações
  async function opcoesMaterial(selecionados = null) {
    if (selecionados) matMarcados = [...selecionados];
    try { await listarMateriaisCache(); } catch (e) { /* sem materiais */ }
    desenharMateriais();
  }
  function desenharMateriais() {
    const box = $f("MatLista"), lista = [...materiaisCache].sort((a, b) => ordemNatural(a.titulo, b.titulo));
    const apagados = matMarcados.filter(id => !materiaisCache.some(m => m.id === id));
    box.innerHTML = !lista.length && !apagados.length ? `<p class="pequeno" style="margin:0">Nenhum PDF enviado ainda. Use <b>⬆ Enviar PDF(s)</b>.</p>` :
      lista.map(m => `<div class="item-material"><label class="check"><input type="checkbox" value="${m.id}"${matMarcados.includes(m.id) ? " checked" : ""}> <span>${esc(m.titulo)} <span class="pequeno">(${tamanhoTexto(m.tamanho)})</span></span></label>
        <button type="button" class="leve mini" data-vermat="${m.id}" title="Ver como o aluno vai ver" aria-label="Ver ${esc(m.titulo)}">👁</button></div>`).join("") +
      apagados.map(id => `<div class="item-material"><label class="check"><input type="checkbox" value="${esc(id)}" checked> <span class="erro-texto">⚠ PDF apagado — desmarque</span></label></div>`).join("");
    box.querySelectorAll("input[type=checkbox]").forEach(c => c.onchange = () => {
      matMarcados = c.checked ? [...matMarcados.filter(x => x !== c.value), c.value] : matMarcados.filter(x => x !== c.value);
      if (!c.checked && apagados.includes(c.value)) desenharMateriais(); else previaMaterial();
    });
    box.querySelectorAll("[data-vermat]").forEach(b => b.onclick = () => verMaterial(b.dataset.vermat));
    previaMaterial();
  }
  // ids marcados, na ordem em que o aluno vê as abas (título em ordem natural: "Aula 2" antes de "Aula 10")
  function idsMarcados() {
    const tit = id => materiaisCache.find(m => m.id === id)?.titulo ?? "\uffff";
    return [...matMarcados].sort((a, b) => ordemNatural(tit(a), tit(b)));
  }
  function previaMaterial() {
    const n = matMarcados.length;
    $f("MatUrl").disabled = n > 0;
    const url = n ? "" : $f("MatUrl").value.trim(), conv = converterLinkMaterial(url), el = $f("MatPrevia");
    if (n) { el.innerHTML = `📄 ${n === 1 ? "1 PDF" : `${n} PDFs`}: o aluno lê num leitor dentro da prova (◀ ▶ para passar os slides, zoom)${n > 1 ? " e troca de PDF pelas abas no topo do painel" : ""}.` + ($f("MatUrl").value.trim() ? " O link externo é ignorado." : ""); return; }
    if (!url) { el.textContent = ""; return; }
    if (!/^https:\/\//.test(conv)) { el.innerHTML = `⚠ Use um link que comece com <b>https://</b>.`; return; }
    el.innerHTML = conv !== url ? `Será salvo no formato para exibir na prova: <span class="mono">${esc(conv)}</span>` : `Link salvo como está.`;
  }
  // limite de saídas: só sem troca de aba permitida; "perder questão" só em "uma por vez"
  function atualizarLimite() {
    const troca = $f("PermitirTrocaAba").checked, todas = $f("Modo").value === "todas", semPerder = todas || $f("Voltar").checked;
    $f("MaxTrocas").disabled = troca; $f("AcaoExceder").disabled = troca; $f("SegVolta").disabled = troca;
    $f("ColarVida").disabled = troca || $f("PermitirColar").checked;
    $f("AcaoExceder").querySelector("option[value=perderQuestao]").disabled = semPerder;
    if (semPerder && $f("AcaoExceder").value === "perderQuestao") $f("AcaoExceder").value = "encerrar";
    $f("LimiteDica").textContent = troca ? "Com troca de aba permitida não há vidas nem punição (as trocas só são contadas)."
      : semPerder ? "Perde 1 vida: trocar de aba/janela (Alt+Tab) ou sair da tela cheia. Com todas as questões na página ou com ir e voltar, quando as vidas acabam a prova é encerrada."
      : "Perde 1 vida: trocar de aba/janela (Alt+Tab) ou sair da tela cheia.";
  }
  // liga os eventos (chamar depois que o HTML estiver na página)
  function ligar() {
    $f("TemasBusca").oninput = $f("TemasVisao").onchange = $f("TemasSoMarcados").onchange = desenharTemas;
    $f("TemasMarcar").onclick = () => marcarVisiveis(true);
    $f("TemasDesmarcar").onclick = () => marcarVisiveis(false);
    $f("NAlt").oninput = $f("NDiss").oninput = $f("NSql").oninput = $f("NWeb").oninput = $f("NDiag").oninput = atualizar;
    $f("MatUrl").oninput = previaMaterial;
    // vários de uma vez: cada PDF recebe o nome do arquivo como título e já entra marcado
    $f("MatUpload").onchange = async () => {
      const files = [...$f("MatUpload").files]; $f("MatUpload").value = "";
      let ok = 0;
      for (const file of files) {
        const r = await enviarPdf(file, "", $f("MatEnvio"));
        if (r) { ok++; matMarcados = [...matMarcados.filter(x => x !== r.id), r.id]; }
      }
      if (files.length > 1) $f("MatEnvio").textContent = `✅ ${ok} de ${files.length} PDFs enviados.`;
      await opcoesMaterial();
    };
    $f("PermitirTrocaAba").onchange = $f("Modo").onchange = $f("Voltar").onchange = $f("PermitirColar").onchange = atualizarLimite;
    atualizarLimite();
    $f("GerarCodigo").onclick = () => { $f("Codigo").value = gerarCodigo(); };
    $f("Codigo").onblur = () => { $f("Codigo").value = normalizarCodigo($f("Codigo").value); };
    opcoesSemestre();
    $f("Semestre").onchange = () => { semestreMexido = true; };
    $f("Turma").addEventListener("change", opcoesMateria);
    $f("Materia").onchange = () => { topicosPlano.aoMudarMateria(); desenharTemas(); };
    topicosPlano.ligar(); topicosPlano.definir();
    $f("Turma").addEventListener("change", topicosPlano.aoMudarMateria);
    $f("Titulo").addEventListener("input", () => topicosPlano.aoMudarDataTitulo());
    $f("Data").onchange = () => { const d = $f("Data").value; if (d && !semestreMexido) { opcoesSemestre(semestreDe(d)); opcoesMateria(); } topicosPlano.aoMudarDataTitulo(); };
  }
  // semestre (os de perto do atual + o da prova) e matérias sugeridas (planos da turma/semestre, depois as dos bancos)
  let semestreMexido = false;
  function opcoesSemestre(atual) {
    const base = semestreDe(), lista = [...new Set([-2, -1, 0, 1, 2].map(d => semestreVizinho(base, d)).concat(atual || base))].sort().reverse();
    $f("Semestre").innerHTML = lista.map(s => `<option value="${s}">${rotuloSemestre(s)}${s === base ? " (atual)" : ""}</option>`).join("");
    $f("Semestre").value = atual || base;
  }
  function opcoesMateria() {
    const doCurso = PLANO_CURSO.unidades.map(u => u.nome);
    const dosBancos = bancosCache.map(b => b.materia).filter(Boolean);
    const chave = s => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const vistas = new Set(doCurso.map(chave));
    const extras = dosBancos.filter(m => !vistas.has(chave(m)));
    const materias = [...doCurso, ...extras].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const atual = $f("Materia").value;
    $f("Materia").innerHTML = `<option value="">— Todas as matérias —</option>` + materias.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
    if (materias.some(m => m === atual)) $f("Materia").value = atual;
  }
  // select de turmas; prova antiga com turma em texto livre ganha uma opção própria para não perder o nome
  function opcoesTurma(p = {}) {
    let h = `<option value="">— escolha a turma —</option>` + turmasCache.map(t => `<option value="${t.id}">${esc(nomeTurma(t))} (${alunosDaTurma(t).length} alunos)</option>`).join("");
    if (!p.turmaId && p.turma) h += `<option value="${LEGADO}">${esc(p.turma)} — texto antigo, sem lista (nenhum aluno vê: escolha a turma)</option>`;
    $f("Turma").innerHTML = h;
    $f("Turma").value = p.turmaId && turmasCache.some(t => t.id === p.turmaId) ? p.turmaId : (!p.turmaId && p.turma ? LEGADO : "");
    turmaLegada = p.turma || "";
  }
  // trava bancos, número de questões, dissertativas e temas (prova que já tem tentativas de alunos)
  function travar(motivo) {
    travado = true;
    ["NAlt", "NDiss", "NSql", "NWeb", "NDiag", "TemasMarcar", "TemasDesmarcar"].forEach(s => $f(s).disabled = true);
    $f("Temas").querySelectorAll("input").forEach(x => x.disabled = true);
    $f("Trava").innerHTML = motivo; $f("Trava").classList.remove("oculto");
    atualizar();
  }
  let dadosAtuais = {};   // prova em edição (para achar a matéria do banco quando o sorteio está travado)
  function preencher(p) {
    dadosAtuais = p;
    $f("Titulo").value = p.titulo || ""; opcoesTurma(p); $f("Codigo").value = p.codigoAcesso || "";
    opcoesSemestre(semestreDaProva(p)); semestreMexido = !!p.semestre;
    const mat = p.materia || ""; $f("Materia").value = mat;
    if (mat && !$f("Materia").value) {   // matéria da prova não está no select: adiciona como opção
      const opt = document.createElement("option"); opt.value = mat; opt.textContent = mat;
      $f("Materia").appendChild(opt); $f("Materia").value = mat;
    }
    $f("Data").value = p.dataProva || ""; opcoesMateria();
    topicosPlano.definir(p.planoCurso);
    // provas antigas só têm o total (nQuestoes) e as dissertativas
    $f("NSql").value = p.nSql ?? 0; $f("NWeb").value = p.nWeb ?? 0; $f("NDiag").value = p.nDiagramas ?? 0;
    $f("NDiss").value = p.nDissertativas ?? 0; $f("NAlt").value = p.nAlternativas ?? Math.max(0, (p.nQuestoes ?? 10) - (p.nDissertativas ?? 0));
    $f("Tempo").value = p.tempoMinutos || 0;
    $f("Modo").value = p.modoExibicao === "todas" ? "todas" : "uma";
    $f("Voltar").checked = p.permitirVoltar === true;
    $f("PermitirTrocaAba").checked = p.permitirTrocaAba === true; $f("PermitirColar").checked = p.permitirColar === true;
    $f("MatTitulo").value = p.materialConsultaTitulo || ""; $f("MatUrl").value = p.materialConsultaUrl || "";
    opcoesMaterial(idsConsulta(p));
    $f("MaxTrocas").value = p.maxTrocasDeAba || 0; $f("AcaoExceder").value = p.acaoAoExceder === "perderQuestao" ? "perderQuestao" : "encerrar";
    $f("ColarVida").checked = p.colarTiraVida !== false;
    $f("SegVolta").value = p.segundosVolta ?? 5;
    $f("Dicas").checked = Number(p.dicasMax || 0) > 0; $f("DicasMax").value = Number(p.dicasMax || 0) > 0 ? p.dicasMax : 3;
    $f("EntradaAte").value = p.entradaAte?.toDate ? dataHoraLocal(p.entradaAte.toDate()) : "";
    $f("IaAuto").checked = p.iaAutomatica !== false;
    previaMaterial(); atualizarLimite();
  }
  // lê e valida; devolve { erro } ou { dados }
  async function ler() {
    const titulo = $f("Titulo").value.trim();
    const nAlt = Math.max(0, Math.round(Number($f("NAlt").value || 0))), nDiss = Math.max(0, Math.round(Number($f("NDiss").value || 0))), nSql = Math.max(0, Math.round(Number($f("NSql").value || 0))), nWeb = Math.max(0, Math.round(Number($f("NWeb").value || 0))), nDiag = Math.max(0, Math.round(Number($f("NDiag").value || 0))), n = nAlt + nDiss + nSql + nWeb + nDiag;
    if (!titulo) return { erro: "Preencha o título." };
    if (!turmaEscolhida().turmaId) return { erro: "Escolha a turma da prova. Só os alunos dessa turma veem a prova." };
    if (!travado && !n) return { erro: "A prova precisa de pelo menos uma questão (alternativas + dissertativas)." };
    if (!travado) { if (!carregando) await carregarTemas(); else await carregando; }   // garante a contagem dos bancos
    const bancoIds = bancosMarcados();
    if (!travado && !bancoIds.length) return { erro: "Marque pelo menos um banco de questões." };
    const prob = problema();
    if (prob) { atualizar(); return { erro: prob }; }
    const arquivos = idsMarcados();
    const urlBruta = arquivos.length ? "" : $f("MatUrl").value.trim(), url = converterLinkMaterial(urlBruta);
    if (url && !/^https:\/\//.test(url)) return { erro: "O link do material de consulta precisa começar com https://." };
    const tp = topicosPlano.ler();
    if (tp.erro) return { erro: tp.erro };
    const materia = $f("Materia").value.trim() || (bancosCache.find(x => x.id === (bancoIds[0] || bancosDaProva(dadosAtuais)[0]))?.materia || "").trim();
    const dados = {
      titulo, ...turmaEscolhida(), codigoAcesso: normalizarCodigo($f("Codigo").value),
      semestre: $f("Semestre").value || semestreDe(), materia, dataProva: $f("Data").value || "", planoCurso: tp.valor,
      permitirVoltar: $f("Voltar").checked,
      tempoMinutos: Math.max(0, Math.round(Number($f("Tempo").value || 0))),
      modoExibicao: $f("Modo").value === "todas" ? "todas" : "uma",
      permitirTrocaAba: $f("PermitirTrocaAba").checked, permitirColar: $f("PermitirColar").checked,
      maxTrocasDeAba: $f("PermitirTrocaAba").checked ? 0 : Math.min(10, Math.max(0, Math.round(Number($f("MaxTrocas").value || 0)))),
      colarTiraVida: $f("ColarVida").checked,
      dicasMax: $f("Dicas").checked ? Math.min(10, Math.max(1, Math.round(Number($f("DicasMax").value || 3)))) : 0,
      segundosVolta: Math.min(120, Math.max(0, Math.round(Number($f("SegVolta").value || 0)))),
      entradaAte: $f("EntradaAte").value ? Timestamp.fromDate(new Date($f("EntradaAte").value)) : null,
      iaAutomatica: $f("IaAuto").checked,
      acaoAoExceder: $f("Modo").value !== "todas" && !$f("Voltar").checked && $f("AcaoExceder").value === "perderQuestao" ? "perderQuestao" : "encerrar",
      // vários PDFs em materiaisConsultaIds; materialConsultaArquivoId (um PDF só) fica para provas antigas
      materialConsultaUrl: url, materiaisConsultaIds: arquivos, materialConsultaArquivoId: null,
      materialConsultaTitulo: url || arquivos.length ? ($f("MatTitulo").value.trim() || (arquivos.length === 1 ? materiaisCache.find(m => m.id === arquivos[0])?.titulo : "") || "Material de consulta") : ""
    };
    // campos do sorteio: só entram se não estiverem travados
    // bancoId = o primeiro (as regras do Firestore e as tentativas antigas usam); temas = os do primeiro banco (compatibilidade)
    if (!travado) {
      const temasPorBanco = Object.fromEntries(bancoIds.map(b => [b, ordenarTemas([...sel.get(b)])]));   // todos marcados = lista completa
      Object.assign(dados, { bancoId: bancoIds[0], bancoIds, temasPorBanco, temas: temasPorBanco[bancoIds[0]], nQuestoes: n, nAlternativas: nAlt, nDissertativas: nDiss, nSql, nWeb, nDiagramas: nDiag });
    }
    return { dados };
  }
  // turmaId + nome (o campo "turma" continua existindo para quem já usa p.turma)
  function turmaEscolhida() {
    const v = $f("Turma").value;
    if (v === LEGADO) return { turmaId: null, turma: turmaLegada };
    const t = turmasCache.find(x => x.id === v);
    return t ? { turmaId: t.id, turma: t.nome } : { turmaId: null, turma: "" };
  }
  // marcações da prova salva: Map bancoId -> Set de temas (null = todos)
  const selecaoDaProva = p => new Map(bancosDaProva(p).map(b => [b, temasDoBanco(p, b)]));
  // nova prova a partir da aba Organização: turma, semestre, matéria, título e data já preenchidos
  async function preencherOrganizacao({ turmaId, semestre, materia, titulo, data, topicos = [] }) {
    if (turmaId) $f("Turma").value = turmaId;
    opcoesSemestre(semestre || semestreDe()); semestreMexido = !!semestre;
    $f("Materia").value = materia || ""; if (titulo) $f("Titulo").value = titulo; $f("Data").value = data || "";
    opcoesMateria(); topicosPlano.definir();
    // marca só os bancos dessa matéria
    const daMateria = bancosCache.filter(b => materia && chaveTexto(b.materia) === chaveTexto(materia)).map(b => b.id);
    // prova prevista no plano com tópicos: marca só esses tópicos (os bancos sem nenhum deles ficam de fora)
    const tops = new Set(topicos.map(chaveTexto));
    if (!daMateria.length) return;
    if (!tops.size) return carregarTemas(new Map(daMateria.map(b => [b, null])));
    const sel = new Map();
    for (const b of daMateria) {
      const s = new Set((await questoesDoBanco(b).catch(() => [])).map(temaDe).filter(t => tops.has(chaveTexto(t))));
      if (s.size) sel.set(b, s);
    }
    carregarTemas(sel.size ? sel : new Map(daMateria.map(b => [b, null])));
  }
  return { carregarTemas, selecaoDaProva, atualizar, ligar, travar, preencher, ler, opcoesTurma, opcoesMaterial, opcoesMateria, preencherOrganizacao };
}

$("#formNovaProva").innerHTML = formProvaHTML("p");
const formNova = controleProva("p");
formNova.ligar();

// resumo das opções de uma prova (tabela "Provas criadas")
function opcoesDaProvaHTML(p) {
  const t = [];
  t.push(p.modoExibicao === "todas" ? `<span class="tag">▤ todas na página</span>` : `<span class="tag">▭ uma por vez</span>`);
  t.push(p.permitirVoltar ? `<span class="tag nota" title="O aluno pode alterar as respostas até finalizar">↔ ir e voltar</span>` : `<span class="tag" title="Cada resposta enviada fica travada">→ sem voltar</span>`);
  if (p.permitirTrocaAba) t.push(`<span class="tag aviso" title="Sem tela cheia e sem aviso; as trocas continuam contadas">🔀 troca de aba permitida</span>`);
  if (p.codigoAcesso) t.push(`<span class="tag nota" title="Código de acesso (informe na sala)">🔑 ${esc(p.codigoAcesso)}</span>`);
  if (p.permitirColar) t.push(`<span class="tag aviso">📋 colar permitido</span>`);
  if (!p.permitirTrocaAba && Number(p.maxTrocasDeAba) > 0) t.push(`<span class="tag erro" title="Vidas: perde 1 ao trocar de aba ou sair da tela cheia${!p.permitirColar && p.colarTiraVida !== false ? " ou tentar colar" : ""}">❤️ ${Number(p.maxTrocasDeAba)} vida(s) · ${p.acaoAoExceder === "perderQuestao" && p.modoExibicao !== "todas" && !p.permitirVoltar ? "perde a questão" : "encerra"}</span>`);
  const pdfs = idsConsulta(p);
  if (pdfs.length) t.push(`<span class="tag nota" title="${esc(pdfs.map(id => materiaisCache.find(m => m.id === id)?.titulo || "PDF").join(" · "))}">📄 ${esc(p.materialConsultaTitulo || "consulta")}${pdfs.length > 1 ? ` (${pdfs.length} PDFs)` : ""}</span>`);
  else if (p.materialConsultaUrl) t.push(`<span class="tag nota" title="${esc(p.materialConsultaUrl)}">📖 ${esc(p.materialConsultaTitulo || "consulta")}</span>`);
  return t.join(" ");
}

// ---------- lista de provas: pesquisa, filtros e agrupada por turma ----------
let provasCache = [], filtroTurmaPendente = null;
const gruposFechados = new Set();   // turmas que o professor fechou (fica enquanto a página estiver aberta)
async function carregarProvas() {
  await Promise.all([listarBancos(), listarTurmas(), listarPlanos().catch(() => [])]);
  const turmaAntes = $("#pTurma").value;
  formNova.opcoesTurma();
  if (turmaAntes && [...$("#pTurma").options].some(o => o.value === turmaAntes)) $("#pTurma").value = turmaAntes;
  // redesenha bancos/temas mantendo as marcações do professor (a lista tem rolagem própria, não "pula" a tela)
  formNova.carregarTemas();
  formNova.opcoesMaterial(); formNova.opcoesMateria();
  const s = await getDocs(collection(db, "provas"));
  provasCache = s.docs.map(d => ({ id: d.id, ...d.data() }));
  // filtros de semestre e matéria
  const preencherSel = (sel, primeira, valores, rot = v => v) => {
    const antes = sel.value;
    sel.innerHTML = `<option value="">${primeira}</option>` + valores.map(v => `<option value="${esc(v)}">${esc(rot(v))}</option>`).join("");
    sel.value = valores.includes(antes) ? antes : "";
  };
  preencherSel($("#fpSemestre"), "📅 Todos os semestres", [...new Set(provasCache.map(semestreDaProva))].sort().reverse(), rotuloSemestre);
  const mats = new Map(); provasCache.forEach(p => { const m = materiaDaProva(p, bancosCache); if (m) mats.set(chaveTexto(m), m); });
  preencherSel($("#fpMateria"), "📚 Todas as matérias", [...mats.values()].sort((a, b) => a.localeCompare(b, "pt-BR")));
  // filtro de turma: turmas cadastradas + "sem turma"
  const sel = $("#fpTurma"), antes = filtroTurmaPendente ?? sel.value;
  filtroTurmaPendente = null;
  sel.innerHTML = `<option value="">👥 Todas as turmas</option>` + turmasCache.map(t => `<option value="${t.id}">${esc(nomeTurma(t))}</option>`).join("") +
    (provasCache.some(p => !p.turmaId) ? `<option value="__sem">⚠ Sem turma</option>` : "");
  sel.value = [...sel.options].some(o => o.value === antes) ? antes : "";
  desenharProvas();
}
function desenharProvas() {
  const box = $("#listaProvas");
  atualizarFiltros($("#aba-provas .toolbar"));
  if (!provasCache.length) { $("#fpContagem").textContent = ""; box.innerHTML = vazio({ e: "📝", texto: "Nenhuma somativa ainda.", acao: podeEditar() ? `<button type="button" data-nova-prova>+ Criar a primeira somativa</button>` : "" }); box.querySelector("[data-nova-prova]")?.addEventListener("click", abrirFormNovaProva); return; }
  const busca = semAcento($("#fpBusca").value.trim()), turma = $("#fpTurma").value, status = $("#fpStatus").value, ordem = $("#fpOrdem").value;
  const fSem = $("#fpSemestre").value, fMat = chaveTexto($("#fpMateria").value);
  const nomeBanco = id => bancosCache.find(x => x.id === id)?.nome || id;
  let lista = provasCache.filter(p => {
    if (turma === "__sem" ? p.turmaId : turma && p.turmaId !== turma) return false;
    if (status === "liberada" && !p.liberada) return false;
    if (status === "fechada" && p.liberada) return false;
    if (status === "gabarito" && !p.resultadosLiberados) return false;
    if (fSem && semestreDaProva(p) !== fSem) return false;
    if (fMat && chaveTexto(materiaDaProva(p, bancosCache)) !== fMat) return false;
    if (busca && !semAcento([p.titulo, p.turma, materiaDaProva(p, bancosCache), ...bancosDaProva(p).map(nomeBanco)].join(" ")).includes(busca)) return false;
    return true;
  });
  const seg = p => p.criadoEm?.seconds || 0;
  lista.sort(ordem === "titulo" ? (a, b) => (a.titulo || "").localeCompare(b.titulo || "", "pt-BR", { numeric: true })
           : ordem === "antigas" ? (a, b) => seg(a) - seg(b) : (a, b) => seg(b) - seg(a));
  const nLib = lista.filter(p => p.liberada).length;
  $("#fpContagem").textContent = `${lista.length} de ${pl(provasCache.length, "somativa")} · ${nLib} ${nLib === 1 ? "liberada" : "liberadas"}`;
  if (!lista.length) { box.innerHTML = vazio({ e: "🔎", texto: "Nenhuma somativa com esses filtros." }); return; }
  // recuperação/substitutiva fica DENTRO do cartão da somativa de origem (não aparece como outra prova solta)
  const idsLista = new Set(lista.map(p => p.id)), filhasDe = new Map();
  lista.forEach(p => { if (p.provaOrigemId && idsLista.has(p.provaOrigemId)) { if (!filhasDe.has(p.provaOrigemId)) filhasDe.set(p.provaOrigemId, []); filhasDe.get(p.provaOrigemId).push(p); } });
  const cartaoComRec = p => {
    const fs = filhasDe.get(p.id);
    if (!fs) return cartaoProvaHTML(p);
    return `<div class="prova-com-rec">${cartaoProvaHTML(p)}<div class="rec-filhas"><p class="rec-tit">↳ ${fs.length === 1 ? "Recuperação / substitutiva desta somativa" : `${fs.length} recuperações / substitutivas desta somativa`}</p>${fs.map(cartaoProvaHTML).join("")}</div></div>`;
  };
  // agrupa por turma (na ordem das turmas cadastradas; "sem turma" por último)
  const grupos = new Map();
  lista.filter(p => !(p.provaOrigemId && idsLista.has(p.provaOrigemId))).forEach(p => { const k = p.turmaId && turmasCache.some(t => t.id === p.turmaId) ? p.turmaId : "__sem"; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); });
  const chaves = [...turmasCache.map(t => t.id).filter(id => grupos.has(id)), ...(grupos.has("__sem") ? ["__sem"] : [])];
  box.innerHTML = chaves.map(k => {
    const ps = grupos.get(k), t = turmasCache.find(x => x.id === k), lib = ps.filter(p => p.liberada).length;
    const aberto = busca || turma || fSem || fMat || !gruposFechados.has(k);
    // dentro da turma: semestre (mais recente primeiro) → matéria
    const sub = new Map();
    ps.forEach(p => { const sm = semestreDaProva(p), m = materiaDaProva(p, bancosCache) || "Sem matéria", ch = `${sm}|${chaveTexto(m)}`; if (!sub.has(ch)) sub.set(ch, { sm, m, ps: [] }); sub.get(ch).ps.push(p); });
    const subs = [...sub.values()].sort((a, b) => b.sm.localeCompare(a.sm) || a.m.localeCompare(b.m, "pt-BR"));
    const nRec = ps.reduce((n, p) => n + (filhasDe.get(p.id)?.length || 0), 0);
    const resumo = [pl(ps.length, "somativa") + (nRec ? ` + ${nRec === 1 ? "1 recuperação" : `${nRec} recuperações`}` : ""), lib ? `${lib} ${lib === 1 ? "liberada" : "liberadas"}` : "", t ? pl(alunosDaTurma(t).length, "aluno") : "", subs.length === 1 ? rotuloSemestre(subs[0].sm) : "", subs.length === 1 ? subs[0].m : ""].filter(Boolean).join(" · ");
    return `<details class="grupo-lista" data-grupo="${k}" ${aberto ? "open" : ""}>
      <summary class="grupo-cab">${seta()}<h3 class="gc-titulo">${k === "__sem" ? "⚠ Sem turma" : `👥 Turma ${esc(t.nome || "")}${rotuloDias(t.diasAula) ? `<span class="gc-dias"> · ${esc(rotuloDias(t.diasAula))}</span>` : ""}`}</h3>
        <span class="gc-resumo">${esc(resumo)}</span>${t ? "" : `<span class="chip warn">nenhum aluno vê estas somativas: use Editar e escolha a turma</span>`}</summary>
      <div class="grupo-corpo">${subs.map(g => `<div class="sub-grupo">${subs.length > 1 ? `<h4 class="sg-titulo">${esc(rotuloSemestre(g.sm))} · ${esc(g.m)} · ${pl(g.ps.length, "somativa")}</h4>` : ""}
        <div class="cartoes-provas">${g.ps.map(cartaoComRec).join("")}</div></div>`).join("")}</div></details>`;
  }).join("");
  box.querySelectorAll("[data-grupo]").forEach(d => d.ontoggle = () => { if (busca || turma || fSem || fMat) return; d.open ? gruposFechados.delete(d.dataset.grupo) : gruposFechados.add(d.dataset.grupo); });
  box.querySelectorAll("[data-alunos]").forEach(b => b.onclick = async () => {
    abrirAba("resultados"); $("#rTurma").value = ""; await prepararResultados();
    $("#rProva").value = b.dataset.alunos; $("#rAoVivo").checked = true; carregarResultados();
  });
  box.querySelectorAll("[data-tg]").forEach(b => b.onclick = async () => {
    const p = provasCache.find(x => x.id === b.dataset.id), campo = b.dataset.tg, novo = !p[campo];
    const txt = campo === "liberada" ? (novo ? [`Liberar a somativa "${p.titulo}"? Os alunos da turma passam a ver e podem começar.`, "Liberar somativa"] : [`Encerrar a somativa "${p.titulo}"? Os alunos não conseguem mais começar nem continuar.`, "Encerrar somativa"])
      : (novo ? [`Liberar o gabarito de "${p.titulo}"? Os alunos passam a ver quais acertaram, a resposta certa e o PDF da somativa.`, "Liberar gabarito"] : [`Ocultar o gabarito de "${p.titulo}"? Os alunos deixam de ver o resultado detalhado.`, "Ocultar gabarito"]);
    if (!(await confirmar(txt[0], { titulo: txt[1], ok: txt[1] }))) return;
    await updateDoc(doc(db, "provas", p.id), { [campo]: novo });
    toast("Prova atualizada", "ok"); carregarProvas();
  });
  box.querySelectorAll("[data-notafinal]").forEach(b => b.onclick = () => ajustarNotaFinal(provasCache.find(x => x.id === b.dataset.notafinal)));
  box.querySelectorAll("[data-recuperacao]").forEach(b => b.onclick = () => gerarRecuperacao(provasCache.find(x => x.id === b.dataset.recuperacao)));
  box.querySelectorAll("[data-editar]").forEach(b => b.onclick = () => editarProva(provasCache.find(x => x.id === b.dataset.editar)));
  box.querySelectorAll("[data-testar]").forEach(b => b.onclick = () => window.open(`index.html?teste=${encodeURIComponent(b.dataset.testar)}`, "_blank"));
  box.querySelectorAll("[data-apagarteste]").forEach(b => b.onclick = async () => {
    if (!(await confirmar("Apagar a sua tentativa de teste desta prova? Você poderá testar de novo, com novo sorteio.", { titulo: "Apagar meu teste", ok: "Apagar", perigo: true }))) return;
    try {
      const apagou = await apagarTentativaTeste(auth.currentUser.uid, b.dataset.apagarteste);
      toast(apagou ? "Tentativa de teste apagada." : "Você não tem tentativa de teste nesta prova.", apagou ? "ok" : "info");
    } catch (e) { toast("Não foi possível apagar o teste. " + traduzirErro(e), "erro"); console.error(e); }
  });
  box.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    if (!(await confirmar("Apagar a somativa? As tentativas dos alunos continuam no banco de dados, mas ficam órfãs.", { titulo: "Apagar somativa", ok: "Apagar", perigo: true }))) return;
    await deleteDoc(doc(db, "provas", b.dataset.del)); carregarProvas();
  });
}
function cartaoProvaHTML(p) {
    const bs = bancosDaProva(p).map(id => bancosCache.find(x => x.id === id) || { id, nome: id });
    const qtd = (p.nAlternativas !== undefined && p.nAlternativas !== null ? `${p.nAlternativas} alt. + ${p.nDissertativas || 0} dissert.` : p.nDissertativas ? `${p.nDissertativas} dissert.` : "") + (p.nSql ? ` + ${p.nSql} SQL` : "") + (p.nWeb ? ` + ${p.nWeb} web` : "");
    const vidas = !p.permitirTrocaAba && Number(p.maxTrocasDeAba) > 0 ? Number(p.maxTrocasDeAba) : 0;
    const itens = (podeEditar() ? itemMenu({ i: p.resultadosLiberados ? "lock" : "unlock", t: p.resultadosLiberados ? "Ocultar gabarito" : "Liberar gabarito", attrs: `data-tg="resultadosLiberados" data-id="${p.id}" title="O aluno vê quais acertou, o gabarito e baixa o PDF da prova"` })
        + itemMenu({ i: "edit", t: "Editar", attrs: `data-editar="${p.id}"` }) : "")
      + itemMenu({ i: "simulacao", t: "Testar como aluno", attrs: `data-testar="${p.id}" title="Abre a prova em nova aba, como o aluno vê (não vale nota)"` })
      + itemMenu({ i: "refresh", t: "Apagar meu teste", attrs: `data-apagarteste="${p.id}" title="Apaga a sua tentativa de teste desta prova"` })
      + (podeEditar() && ehAdmin() ? "<hr>" + itemMenu({ i: "trash", t: "Apagar somativa", perigo: true, attrs: `data-del="${p.id}"` }) : "");
    const m = 15;   // ícones dos metadados
    return `<article class="cartao-prova compacto">
      <div class="cp-info">
        <div class="cp-l1"><h3>${esc(p.titulo)}</h3><span class="chip ${p.liberada ? "ok" : "off"}">${p.liberada ? "● liberada" : "○ fechada"}</span>${p.resultadosLiberados ? `<span class="chip info">gabarito liberado</span>` : `<span class="chip off" title="O aluno vê só quantas acertou e a nota">só o placar</span>`}${p.recuperacao ? `<span class="chip warn" title="Recuperação de &quot;${esc(p.provaOrigemTitulo || "")}&quot;: só os ${(p.alunosEmails || []).length} alunos listados veem">recuperação · ${pl((p.alunosEmails || []).length, "aluno")}</span>` : ""}${p.recuperacaoIds?.length ? `<span class="chip info">recuperação gerada</span>` : ""}</div>
        <div class="cp-l2"><span>${ic(p.turmaId ? "users" : "alert", { size: m })}${esc(p.turma || "sem turma")}</span><span>${ic("book", { size: m })}${esc(materiaDaProva(p, bancosCache) || "sem matéria")}</span>${p.dataProva ? `<span>${ic("cal", { size: m })}${dataCurta(p.dataProva)}</span>` : ""}
          <span><b>${p.nQuestoes}</b> questões${qtd ? ` · ${qtd}` : ""}</span><span>${ic("clock", { size: m })}${p.tempoMinutos > 0 ? `<b>${p.tempoMinutos} min</b>` : "sem limite de tempo"}</span><span title="${vidas ? pl(vidas, "vida") : "sem vidas"}">${vidas ? `<span class="e" aria-hidden="true">${"❤️".repeat(Math.min(5, vidas))}</span>` : "sem vidas"}</span></div>
      </div>
      <div class="cp-botoes">
        ${podeEditar() ? `<button class="${p.liberada ? "leve" : "ok"}" data-tg="liberada" data-id="${p.id}">${ic(p.liberada ? "stop" : "play", { size: 16 })}${p.liberada ? "Encerrar" : "Liberar somativa"}</button>` : ""}
        ${podeEditar() && p.recuperacao ? `<button class="leve" data-notafinal="${p.id}" title="Regra da nota final e quanto vale para cada aluno">${ic("edit", { size: 16 })}Nota final</button>` : ""}
        ${podeEditar() && !p.liberada && p.resultadosLiberados ? `<button class="leve" data-recuperacao="${p.id}" title="Cria uma somativa de recuperação só para quem tirou abaixo de ${NOTA_RECUPERACAO}, com os temas em que a turma falhou">${ic("copy", { size: 16 })}${p.recuperacaoIds?.length ? "Gerar outra recuperação" : "Gerar recuperação"}</button>` : ""}
        <button class="leve" data-alunos="${p.id}" title="Ver aluno por aluno (ao vivo): vidas, progresso e nota">${ic("users", { size: 16 })}Alunos</button>
        ${menuHTML({ aria: `Mais ações: ${p.titulo}`, itensHTML: itens })}
      </div>
      <details class="cp-mais"><summary>Detalhes${seta(14)}</summary>
        <dl class="cp-detalhes">
          <div><dt>Banco(s)</dt><dd>${bs.map(b => esc(b.nome)).join(" · ")}</dd></div>
          <div><dt>Temas</dt><dd class="pequeno">${temasDaProvaTexto(p, bs)}</dd></div>
          <div><dt>Opções</dt><dd class="td-opcoes">${opcoesDaProvaHTML(p)}</dd></div>
        </dl></details></article>`;
}
// ---------- RECUPERAÇÃO: nova somativa só para quem tirou abaixo de NOTA_RECUPERACAO, com os temas em falha ----------
// Só aparece com a somativa encerrada e as notas (gabarito) liberadas. A recuperação é uma somativa normal
// (entra no histórico, nos resultados e nos relatórios), mas só os e-mails de alunosEmails conseguem fazer.
const NOTA_RECUPERACAO = 50, NOTA_SUBSTITUTIVA = 80;
// nota final do aluno na recuperação/substitutiva: a prova vale 0–100 e a nota final é a mesma, com TETO em valeAte (ex.: 70 com teto 50 = 50). null = prova normal
function notaConvertida(prova, email, nota) {
  const v = Number(prova?.valeAte?.[String(email || "").toLowerCase()]);
  return v > 0 ? calcNotaFinal(nota, v, regraDoTipo(prova, prova?.tipoPorAluno?.[String(email).toLowerCase()] === "substitutiva" ? "substitutiva" : "recuperacao")) : null;
}
// escolha da regra (no gerar e no ajustar)
function htmlRegrasNota(prova) {
  return `<fieldset class="temas-box"><legend>Regra da nota final</legend><p class="pequeno" style="margin-top:0">O aluno sempre faz a prova de 0 a 100. A regra define como vira a nota final, usando o "vale até" de cada aluno.</p>
    ${[["recuperacao", "Recuperação"], ["substitutiva", "Substitutiva"]].map(([k, nome]) => { const r = regraDoTipo(prova, k); return `<div class="grade">
      <div><label for="rgModo_${k}">${nome}</label><select id="rgModo_${k}">${Object.entries(REGRAS_NOTA).map(([m, t]) => `<option value="${m}" ${m === r.modo ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div><label for="rgMeta_${k}">Meta (só na regra com meta)</label><input id="rgMeta_${k}" type="number" min="1" max="100" value="${r.meta}"></div></div>`; }).join("")}
    <p class="pequeno" id="rgExemplo"></p></fieldset>`;
}
function lerRegrasNota(corpo) {
  const out = {};
  for (const k of ["recuperacao", "substitutiva"]) {
    const modo = corpo.querySelector(`#rgModo_${k}`).value, meta = Number(corpo.querySelector(`#rgMeta_${k}`).value);
    if (modo === "meta" && !(meta > 0 && meta <= 100)) return { erro: "A meta precisa ser de 1 a 100." };
    out[k] = { modo, meta: meta > 0 ? Math.round(meta) : 70 };
  }
  return { regraNota: out };
}
function ligarExemploRegras(corpo) {
  const ex = () => { const r = lerRegrasNota(corpo); if (r.erro) return; const p = { regraNota: r.regraNota };
    corpo.querySelector("#rgExemplo").innerHTML = `Exemplo com nota 70 — recuperação (vale ${NOTA_RECUPERACAO}): <b>${String(calcNotaFinal(70, NOTA_RECUPERACAO, regraDoTipo(p, "recuperacao"))).replace(".", ",")}</b> · substitutiva (vale ${NOTA_SUBSTITUTIVA}): <b>${String(calcNotaFinal(70, NOTA_SUBSTITUTIVA, regraDoTipo(p, "substitutiva"))).replace(".", ",")}</b>`; };
  corpo.querySelectorAll("[id^=rgModo_], [id^=rgMeta_]").forEach(i => i.addEventListener("input", ex)); ex();
}
// depois de gerada: muda a regra e o "vale até" de cada aluno (as notas finais são recalculadas na hora, em todo lugar)
async function ajustarNotaFinal(p) {
  if (!p?.recuperacao || !podeEditar()) return;
  const emails = p.alunosEmails || [];
  const conteudo = `<p class="pequeno" style="margin-top:0">Recuperação de <b>${esc(p.provaOrigemTitulo || "")}</b>. Mudar aqui recalcula a nota final de todos (painel e portal do aluno). A nota de 0 a 100 da prova não muda.</p>
    ${htmlRegrasNota(p)}
    <fieldset class="temas-box"><legend>"Vale até" por aluno (${emails.length})</legend>
    ${emails.map(e => `<div style="display:flex;gap:8px;align-items:center;padding:2px 0;flex-wrap:wrap"><span style="flex:1 1 260px">${esc(e)} <span class="chip ${tipoRec(p, e) === "substitutiva" ? "info" : "warn"}">${tipoRec(p, e)}</span></span>
      <label class="pequeno" style="display:flex;gap:6px;align-items:center;margin:0">vale até <input type="number" min="1" max="100" step="1" value="${p.valeAte?.[e] ?? (tipoRec(p, e) === "substitutiva" ? NOTA_SUBSTITUTIVA : NOTA_RECUPERACAO)}" data-aj-vale="${esc(e)}" style="width:72px"></label></div>`).join("")}</fieldset>`;
  const salvou = await drawerForm({ titulo: "Nota final da recuperação", ok: "Salvar", conteudo, aoAbrir: ligarExemploRegras,
    antesDeConfirmar: async corpo => {
      const r = lerRegrasNota(corpo); if (r.erro) { toast(r.erro, "erro"); return false; }
      const valeAte = {};
      for (const i of corpo.querySelectorAll("[data-aj-vale]")) { const v = Number(i.value); if (!(v > 0 && v <= 100)) { toast(`"Vale até" de ${i.dataset.ajVale} precisa ser de 1 a 100.`, "erro"); return false; } valeAte[i.dataset.ajVale] = Math.round(v * 10) / 10; }
      try { await updateDoc(doc(db, "provas", p.id), { valeAte, regraNota: r.regraNota, historico: [...(p.historico || []), { timestamp: new Date().toISOString(), motivo: "nota_final", editadoPor: eu.email }] }); }
      catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); return false; }
    } });
  if (salvou) { toast("Regra da nota final salva.", "ok"); carregarProvas(); }
}
const textoConvertida = (prova, email, nota) => { const c = notaConvertida(prova, email, nota); return c === null ? "" : `${String(c).replace(".", ",")} de ${String(prova.valeAte[String(email).toLowerCase()]).replace(".", ",")}`; };
const tipoRec = (prova, email) => prova?.tipoPorAluno?.[String(email || "").toLowerCase()] === "substitutiva" ? "substitutiva" : "recuperação";
async function gerarRecuperacao(p) {
  if (!p || !podeEditar()) return;
  if (p.liberada || !p.resultadosLiberados) return toast("Encerre a somativa e libere as notas (gabarito) antes de gerar a recuperação.", "erro");
  if (p.recuperacaoIds?.length && !(await confirmar(`"${p.titulo}" já tem ${pl(p.recuperacaoIds.length, "recuperação", "recuperações")}. Gerar mais uma?`, { titulo: "Gerar recuperação", ok: "Gerar outra" }))) return;
  toast("Calculando as notas da somativa…", "info");
  const bancos = bancosDaProva(p);
  let tents, lotes, turma = null;
  try {
    [tents, lotes] = await Promise.all([getDocs(query(collection(db, "tentativas"), where("provaId", "==", p.id))), Promise.all(bancos.map(lerBanco))]);
    if (p.turmaId) { const td = await getDoc(doc(db, "turmas", p.turmaId)).catch(() => null); if (td?.exists()) turma = td.data(); }
  } catch (e) { toast("Não foi possível ler as notas. " + traduzirErro(e), "erro"); console.error(e); return; }
  const questoes = {}, gabaritos = {}, bancoDe = {};
  lotes.forEach((l, i) => { Object.assign(questoes, l.questoes); Object.assign(gabaritos, l.gabaritos); Object.keys(l.questoes).forEach(q => bancoDe[q] = bancos[i]); });
  const chaveTema = (b, tema) => `${b}\u0001${tema}`;
  // nota de cada aluno (a gravada pelo painel; senão, calculada com as correções) e pontos por tema
  const alunos = (await Promise.all(tents.docs.map(async d => {
    const t = { id: d.id, ...d.data() };
    if (t.teste || t.simulado || !t.email || d.id.startsWith("teste_") || d.id.startsWith("sim_")) return null;
    const [rs, cs] = await Promise.all([getDocs(collection(db, "tentativas", t.id, "respostas")), getDocs(collection(db, "tentativas", t.id, "correcoes"))]);
    const resp = {}, corr = {}; rs.forEach(x => resp[x.id] = x.data()); cs.forEach(x => corr[x.id] = x.data());
    const porTema = {}; let pts = 0, max = 0;
    (t.questoesIds || []).forEach(qid => {
      const q = questoes[qid]; if (!q) return;
      const peso = Number(q.peso || 1), perdida = resp[qid]?.perdida === true;
      let pontos = corrigir(q, gabaritos[qid] || {}, resp[qid]?.resposta ?? undefined, perdida).pontos || 0;
      if (!perdida && corr[qid]?.pontos !== undefined) pontos = Number(corr[qid].pontos);
      pts += pontos; max += peso;
      const k = chaveTema(bancoDe[qid] || p.bancoId, temaDe(q)); (porTema[k] ||= { pts: 0, max: 0 }); porTema[k].pts += pontos; porTema[k].max += peso;
    });
    const nota = typeof t.nota === "number" ? t.nota : max ? Math.round(pts / max * 1000) / 10 : 0;
    return { email: String(t.email).toLowerCase(), nome: t.nome || t.email, nota, porTema };
  }))).filter(Boolean).sort((a, b) => a.nota - b.nota || a.nome.localeCompare(b.nome, "pt-BR"));
  const abaixo = alunos.filter(a => a.nota < NOTA_RECUPERACAO);
  const fizeram = new Set(alunos.map(a => a.email));
  const faltaram = (turma ? alunosDaTurma(turma) : []).filter(a => a.email && !fizeram.has(String(a.email).toLowerCase()))
    .map(a => ({ email: String(a.email).toLowerCase(), nome: a.nome || String(a.email).replace(/@.*/, "") }));
  if (!abaixo.length && !faltaram.length) return toast(`Ninguém tirou abaixo de ${NOTA_RECUPERACAO} nesta somativa: não há recuperação para gerar.`, "ok");
  // temas em FALHA: os que os alunos de recuperação acertaram menos da metade (soma dos pontos deles no tema)
  const temasTodos = new Map();   // chave -> { banco, tema, pts, max }
  for (const b of bancos) {
    const marcados = temasDoBanco(p, b);
    (await questoesDoBanco(b)).forEach(q => { const tema = temaDe(q); if (marcados && !marcados.has(tema)) return; const k = chaveTema(b, tema); if (!temasTodos.has(k)) temasTodos.set(k, { banco: b, tema, pts: 0, max: 0 }); });
  }
  abaixo.forEach(a => Object.entries(a.porTema).forEach(([k, v]) => { const x = temasTodos.get(k); if (x) { x.pts += v.pts; x.max += v.max; } }));
  const emFalha = x => x.max > 0 && x.pts / x.max < 0.5;
  const nenhumEmFalha = ![...temasTodos.values()].some(emFalha);
  const nomeBanco = id => bancosCache.find(x => x.id === id)?.nome || id;
  const pct = x => x.max ? `${Math.round(x.pts / x.max * 100)}% de acerto` : "não caiu para eles";
  const cota = cotaDaProva(p);
  // cada aluno: marcado ou não, tipo (recuperação ou substitutiva) e quanto a nota vale na conversão (0–100 → 0–vale)
  const linhaRec = (a, marcado, extra, tipo, vale) => `<div style="display:flex;gap:8px;align-items:center;padding:2px 0;flex-wrap:wrap"><label style="display:flex;gap:8px;align-items:center;flex:1 1 260px;margin:0"><input type="checkbox" data-rec-aluno="${esc(a.email)}" data-rec-tipo="${tipo}" ${marcado ? "checked" : ""}> <span><b>${esc(a.nome)}</b> <span class="pequeno">${esc(a.email)} · ${extra}</span></span></label>
    <label class="pequeno" style="display:flex;gap:6px;align-items:center;margin:0">vale até <input type="number" min="1" max="100" step="1" value="${vale}" data-rec-vale="${esc(a.email)}" style="width:72px" aria-label="Teto da nota de ${esc(a.nome)} na conversão"></label></div>`;
  const conteudo = `
    <p class="pequeno" style="margin-top:0">Somativa de origem: <b>${esc(p.titulo)}</b>. A recuperação é criada <b>fechada</b>: confira, edite se precisar e clique em <b>Liberar somativa</b> quando for aplicar. Só os alunos marcados abaixo conseguem ver e fazer.</p>
    <div class="grade"><div><label for="recTitulo">Título</label><input id="recTitulo" type="text" value="${esc(`Recuperação — ${p.titulo}`)}"></div>
      <div><label for="recData">Data da recuperação</label><input id="recData" type="date"></div></div>
    <fieldset class="temas-box"><legend>Recuperação: nota abaixo de ${NOTA_RECUPERACAO} (${abaixo.length})</legend><p class="pequeno" style="margin-top:0">A prova vale 0 a 100 para o aluno; a nota final é a mesma, com <b>teto de ${NOTA_RECUPERACAO}</b> (ou o valor que você puser). Ex.: tirou 40 = 40; tirou 70 = ${NOTA_RECUPERACAO}.</p>
      ${abaixo.length ? abaixo.map(a => linhaRec(a, true, `nota <b>${String(a.nota).replace(".", ",")}</b>`, "recuperacao", NOTA_RECUPERACAO)).join("") : `<p class="pequeno">Ninguém abaixo de ${NOTA_RECUPERACAO}.</p>`}</fieldset>
    ${faltaram.length ? `<fieldset class="temas-box"><legend>Substitutiva: faltaram (${faltaram.length})</legend><p class="pequeno" style="margin-top:0">Marque quem vai fazer a <b>prova substitutiva</b> junto com a recuperação. A prova vale 0 a 100; a nota final é a mesma, com <b>teto de ${NOTA_SUBSTITUTIVA}</b> (padrão, sem atestado). Ex.: tirou 70 = 70; tirou 90 = ${NOTA_SUBSTITUTIVA}. <b>Com atestado, ponha 100.</b></p>
      ${faltaram.map(a => linhaRec(a, false, "faltou", "substitutiva", NOTA_SUBSTITUTIVA)).join("")}</fieldset>` : ""}
    <fieldset class="temas-box"><legend>Temas da recuperação</legend>
      <p class="pequeno" style="margin-top:0">${nenhumEmFalha ? "Nenhum tema ficou abaixo de 50% de acerto: todos vêm marcados." : "Marcados automaticamente: os temas em <b>FALHA</b> (os alunos de recuperação acertaram menos de 50%)."}</p>
      ${[...temasTodos.entries()].map(([k, x]) => `<label style="display:flex;gap:8px;align-items:center;padding:2px 0"><input type="checkbox" data-rec-tema="${esc(k)}" ${nenhumEmFalha || emFalha(x) ? "checked" : ""}> <span>${bancos.length > 1 ? `<span class="pequeno">${esc(nomeBanco(x.banco))} ›</span> ` : ""}<b>${esc(x.tema)}</b> <span class="pequeno">${pct(x)}</span>${emFalha(x) ? ` <span class="chip warn">em falha</span>` : ""}</span></label>`).join("")}</fieldset>
    ${htmlRegrasNota(null)}
    <div class="grade"><div><label for="recNAlt">Questões de alternativa</label><input id="recNAlt" type="number" min="0" value="${cota.nA}"></div>
      <div><label for="recNDiss">Questões dissertativas</label><input id="recNDiss" type="number" min="0" value="${cota.nD}"></div></div>
    <p class="pequeno" id="recDisp"></p>`;
  let novo = null;
  const salvou = await drawerForm({ titulo: "Gerar recuperação", ok: "Gerar recuperação", conteudo,
    aoAbrir: corpo => {
      // quantas questões existem nos temas marcados (para não criar uma prova que não abre)
      const disp = async () => {
        const marc = new Set([...corpo.querySelectorAll("[data-rec-tema]:checked")].map(i => i.dataset.recTema));
        let a = 0, d = 0;
        for (const b of bancos) (await questoesDoBanco(b)).forEach(q => { if (!marc.has(chaveTema(b, temaDe(q)))) return; q.tipo === "dissertativa" ? d++ : a++; });
        corpo.querySelector("#recDisp").textContent = `Nos temas marcados há ${a} alternativa(s) e ${d} dissertativa(s).`;
        return { a, d };
      };
      corpo._disp = disp; disp(); ligarExemploRegras(corpo);
      corpo.querySelectorAll("[data-rec-tema]").forEach(i => i.addEventListener("change", disp));
    },
    antesDeConfirmar: async corpo => {
      const titulo = corpo.querySelector("#recTitulo").value.trim();
      const marcados = [...corpo.querySelectorAll("[data-rec-aluno]:checked")], emails = marcados.map(i => i.dataset.recAluno);
      const valeAte = {}, tipoPorAluno = {};
      for (const i of marcados) {
        const e = i.dataset.recAluno, v = Number(corpo.querySelector(`[data-rec-vale="${CSS.escape(e)}"]`)?.value);
        if (!(v > 0 && v <= 100)) { toast(`"Vale até" de ${e} precisa ser de 1 a 100.`, "erro"); return false; }
        valeAte[e] = Math.round(v * 10) / 10; tipoPorAluno[e] = i.dataset.recTipo;
      }
      const marc = [...corpo.querySelectorAll("[data-rec-tema]:checked")].map(i => temasTodos.get(i.dataset.recTema));
      const nA = Math.max(0, Math.round(Number(corpo.querySelector("#recNAlt").value || 0))), nD = Math.max(0, Math.round(Number(corpo.querySelector("#recNDiss").value || 0)));
      if (!titulo) { toast("Preencha o título.", "erro"); return false; }
      const rg = lerRegrasNota(corpo); if (rg.erro) { toast(rg.erro, "erro"); return false; }
      if (!emails.length) { toast("Marque pelo menos um aluno.", "erro"); return false; }
      if (!marc.length) { toast("Marque pelo menos um tema.", "erro"); return false; }
      if (nA + nD < 1) { toast("A recuperação precisa de pelo menos uma questão.", "erro"); return false; }
      const { a, d } = await corpo._disp();
      if (a < nA || d < nD) { toast(`Não há questões suficientes nos temas marcados (${a} alternativas e ${d} dissertativas). Diminua a quantidade ou marque mais temas.`, "erro"); return false; }
      const temasPorBanco = {};
      marc.forEach(x => (temasPorBanco[x.banco] ||= []).push(x.tema));
      const bancoIds = bancos.filter(b => temasPorBanco[b]);
      bancoIds.forEach(b => temasPorBanco[b] = ordenarTemas(temasPorBanco[b]));
      const copiar = ["turmaId", "turma", "semestre", "materia", "planoCurso", "permitirVoltar", "tempoMinutos", "modoExibicao", "permitirTrocaAba", "permitirColar",
        "maxTrocasDeAba", "colarTiraVida", "segundosVolta", "dicasMax", "iaAutomatica", "acaoAoExceder", "materialConsultaUrl", "materiaisConsultaIds", "materialConsultaArquivoId", "materialConsultaTitulo"];
      const dados = Object.fromEntries(copiar.filter(k => p[k] !== undefined).map(k => [k, p[k]]));
      Object.assign(dados, { titulo, dataProva: corpo.querySelector("#recData").value || "", codigoAcesso: "",
        bancoId: bancoIds[0], bancoIds, temasPorBanco, temas: temasPorBanco[bancoIds[0]], nQuestoes: nA + nD, nAlternativas: nA, nDissertativas: nD,
        recuperacao: true, provaOrigemId: p.id, provaOrigemTitulo: p.titulo || "", notaCorte: NOTA_RECUPERACAO, alunosEmails: emails, valeAte, tipoPorAluno, regraNota: rg.regraNota,
        liberada: false, resultadosLiberados: false, criadoEm: serverTimestamp(), criadoPor: eu.email,
        historico: [{ timestamp: new Date().toISOString(), motivo: "recuperacao", origem: p.id, editadoPor: eu.email }] });
      try {
        const ref = await addDoc(collection(db, "provas"), dados);
        await updateDoc(doc(db, "provas", p.id), { recuperacaoIds: [...(p.recuperacaoIds || []), ref.id] });
        novo = { titulo, n: emails.length, temas: marc.length };
      } catch (e) { toast("Não foi possível criar a recuperação. " + traduzirErro(e), "erro"); console.error(e); return false; }
    } });
  if (salvou && novo) { toast(`Recuperação "${novo.titulo}" criada (fechada) para ${pl(novo.n, "aluno")} com ${pl(novo.temas, "tema")}. Libere quando for aplicar.`, "ok"); carregarProvas(); }
}
const semAcento = t => String(t || "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
["#fpBusca", "#fpTurma", "#fpStatus", "#fpOrdem", "#fpSemestre", "#fpMateria"].forEach(id => $(id).addEventListener(id === "#fpBusca" ? "input" : "change", desenharProvas));
$("#fpLimpar").onclick = () => { $("#fpBusca").value = ""; $("#fpTurma").value = ""; $("#fpStatus").value = ""; $("#fpSemestre").value = ""; $("#fpMateria").value = ""; $("#fpOrdem").value = "recentes"; desenharProvas(); };
// por banco: "todos" quando a prova não filtra ou marcou todos os temas do banco
function temasDaProvaTexto(p, bancos) {
  const txt = b => {
    const s = temasDoBanco(p, b.id);
    if (!s || (Array.isArray(b.temas) && b.temas.length && b.temas.every(t => s.has(t)))) return "todos";
    return [...s].map(esc).join("<br>");
  };
  if (bancos.length === 1) return txt(bancos[0]);
  return bancos.map(b => `<b>${esc(b.nome)}:</b><br>${txt(b)}`).join("<hr class='sep-banco'>");
}

// nova prova vinda da aba Organização (turma, semestre e matéria já escolhidos)
async function abrirNovaProva(pre) {
  if (!podeEditar()) return;
  await abrirAba("provas");
  formNova.preencherOrganizacao(pre);
  abrirFormNovaProva();
}
// o formulário (#cardNovaProva) é movido para um drawer e volta ao fechar: ids e eventos continuam os mesmos
let drawerNovaProva = null;
function abrirFormNovaProva() {
  if (!podeEditar()) return toast("Seu papel não permite criar somativas.", "erro");
  if (drawerNovaProva) return;
  drawerNovaProva = drawer({ titulo: "Nova somativa", corpo: $("#cardNovaProva"), aoFechar: () => { drawerNovaProva = null; $("#cardNovaProva").classList.add("oculto"); },
    acoes: [{ t: "Cancelar", classe: "leve" }, { t: "Criar somativa", onClick: () => criarProva() }] });
  drawerNovaProva.el.classList.add("extra-largo");
}
async function criarProva() {
  if (!podeEditar()) { toast("Seu papel não permite criar somativas.", "erro"); return false; }
  const r = await formNova.ler();
  if (r.erro) { toast(r.erro, "erro"); return false; }
  await addDoc(collection(db, "provas"), { ...r.dados, liberada: false, resultadosLiberados: false, criadoEm: serverTimestamp(), criadoPor: eu.email });
  $("#pTitulo").value = ""; $("#pCodigo").value = ""; $("#pData").value = ""; toast("Somativa criada (ainda fechada). Libere quando for aplicar.", "ok"); carregarProvas();
  return true;
}
$("#btnCriarProva").onclick = async () => { if (await criarProva()) drawerNovaProva?.fechar(); };
$("#btnNovaProva").onclick = abrirFormNovaProva;
ligarFiltros(document);   // todas as barras de busca + Filtros do painel
ajudasEmPopover(document);

// ---------- motivo de alteração (só no editar) ----------
function htmlMotivoAlteracao(f) {
  return `<fieldset class="temas-box motivo-alter" style="border-color:var(--cor-aviso,#f59e0b)">
    <legend>⚠ Por que está alterando?</legend>
    <p class="pequeno" style="margin-top:0">Obrigatório. Fica registrado no histórico da somativa.</p>
    <div class="grade">
      <div><label for="${f}Motivo">Motivo da alteração</label>
        <select id="${f}Motivo">
          <option value="">— selecione o motivo —</option>
          <option value="nao_ministrado">Conteúdo previsto ainda não foi ministrado</option>
          <option value="mais_tempo">A turma precisou de mais tempo no conteúdo</option>
          <option value="feriado">Feriado ou evento escolar</option>
          <option value="administrativo">Decisão administrativa da instituição</option>
          <option value="erro_config">Correção de configuração (data, questões, etc.)</option>
          <option value="outro">Outro motivo</option>
        </select></div>
    </div>
    <div id="${f}TopicosBox" class="oculto" style="margin-top:12px">
      <p class="pequeno" style="margin:0 0 6px"><b>Quais tópicos ficaram de fora?</b> Marque os que a turma ainda não viu:</p>
      <div id="${f}TopicosLista" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:4px"></div>
    </div>
  </fieldset>`;
}
function ligarMotivoAlteracao(f, pc) {
  const $f2 = id => document.getElementById(f + id);
  const unidadeId = pc?.unidade;
  const criteriosSomativa = unidadeId ? criteriosDaUnidade(unidadeId).filter(c => (pc.criterios || []).includes(c[0])) : [];
  function atualizar() {
    const mot = $f2("Motivo").value, mostrar = mot === "nao_ministrado" || mot === "mais_tempo";
    $f2("TopicosBox").classList.toggle("oculto", !mostrar);
    if (mostrar && !$f2("TopicosLista").children.length) {
      $f2("TopicosLista").innerHTML = criteriosSomativa.length
        ? criteriosSomativa.map(c => `<label class="check"><input type="checkbox" value="${c[0]}"> <span><b>${codigoCriterio(c[0])}</b> ${esc(c[2].slice(0, 80))}</span></label>`).join("")
        : "<p class='pequeno'>Sem critérios do plano de ensino registrados para esta somativa.</p>";
    }
  }
  $f2("Motivo").onchange = atualizar;
}
function lerMotivo(f) {
  const $f2 = id => document.getElementById(f + id);
  const motivo = $f2("Motivo").value;
  if (!motivo) return { erro: "Informe o motivo da alteração antes de salvar." };
  const topicosNaoCobertos = [...($f2("TopicosLista")?.querySelectorAll("input:checked") || [])].map(x => x.value);
  return { motivo, topicosNaoCobertos };
}

// ---------- editar somativa ----------
async function editarProva(p) {
  if (!podeEditar()) return toast("Seu papel não permite editar somativas.", "erro");
  // tentativas de alunos (as de teste não contam) travam os campos do sorteio
  let nTentativas = 0;
  try {
    const ts = await getDocs(query(collection(db, "tentativas"), where("provaId", "==", p.id)));
    nTentativas = ts.docs.filter(d => d.data().teste !== true).length;
  } catch (e) { return toast("Não foi possível conferir as tentativas da somativa. " + traduzirErro(e), "erro"); }
  await listarTurmas();
  const ctl = controleProva("e");
  const salvou = await modal({
    titulo: "Editar somativa", conteudo: formProvaHTML("e") + htmlMotivoAlteracao("e"), ok: "Salvar alterações", cancelar: "Cancelar", largo: true,
    aoAbrir: () => {
      ctl.ligar(); ctl.preencher(p);
      if (nTentativas) ctl.travar(`🔒 <b>${nTentativas} aluno(s) já começaram esta somativa.</b> Bancos, número de questões, dissertativas e temas não podem mudar: isso mudaria o sorteio de quem já começou e a correção. As outras opções podem ser alteradas.`);
      ctl.carregarTemas(ctl.selecaoDaProva(p));
      ligarMotivoAlteracao("e", p.planoCurso);
    },
    antesDeConfirmar: async () => {
      const r = await ctl.ler();
      if (r.erro) { toast(r.erro, "erro"); return false; }
      const mot = lerMotivo("e");
      if (mot.erro) { toast(mot.erro, "erro"); return false; }
      if (!(await confirmar(`Salvar as alterações na somativa "${p.titulo}"?`, { titulo: "Salvar somativa", ok: "Salvar" }))) return false;
      const historico = [...(p.historico || []), { timestamp: new Date().toISOString(), motivo: mot.motivo, topicosNaoCobertos: mot.topicosNaoCobertos, editadoPor: eu.email }];
      try { await updateDoc(doc(db, "provas", p.id), { ...r.dados, historico }); }
      catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); return false; }
      return true;
    }
  });
  if (salvou) { toast("Somativa atualizada.", "ok"); carregarProvas(); }
}

// ============================================================ BANCOS
$("#arqBanco").onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => $("#txtBanco").value = t); };
// Erro de sintaxe do JSON com linha, coluna e o trecho (Chrome/Edge dão "position N"; Firefox dá "line L column C")
function erroSintaxeJSON(txt, e) {
  let linha = null, coluna = null;
  const pos = /position (\d+)/.exec(e.message), lc = /line (\d+) column (\d+)/.exec(e.message);
  if (lc) { linha = Number(lc[1]); coluna = Number(lc[2]); }
  else if (pos) { const antes = txt.slice(0, Number(pos[1])).split("\n"); linha = antes.length; coluna = antes[antes.length - 1].length + 1; }
  if (!linha) return `JSON com erro de sintaxe: ${e.message}. Confira vírgulas, aspas e chaves.`;
  const trecho = (txt.split("\n")[linha - 1] || "").trim().slice(0, 80);
  return `JSON com erro de sintaxe na linha ${linha}, coluna ${coluna}${trecho ? ` (perto de: ${trecho})` : ""}. Confira vírgulas, aspas e chaves nesse ponto ou logo antes.`;
}
function validarBanco(txt) {
  let b; try { b = JSON.parse(txt); } catch (e) { throw new Error(erroSintaxeJSON(txt, e)); }
  if (!b.nome) throw new Error("Falta o campo nome.");
  if (!Array.isArray(b.questoes) || !b.questoes.length) throw new Error("Falta a lista questoes.");
  b.questoes.forEach((q, i) => {
    const n = i + 1;
    if (!["alternativa", "dissertativa", "sql", "web", "diagrama"].includes(q.tipo)) throw new Error(`Questão ${n}: tipo deve ser alternativa, dissertativa, sql, web ou diagrama.`);
    if (!q.enunciado) throw new Error(`Questão ${n}: falta o enunciado.`);
    if (q.tema !== undefined && q.tema !== null && typeof q.tema !== "string") throw new Error(`Questão ${n}: "tema" deve ser um texto (ex.: "DML - UPDATE").`);
    if (typeof q.tema === "string") q.tema = limparTema(q.tema);   // o tema é o assunto: "MS4 - DDL" vira "DDL"
    if (q.tipo === "alternativa") {
      if (!Array.isArray(q.alternativas) || q.alternativas.length < 2) throw new Error(`Questão ${n}: precisa de pelo menos 2 alternativas.`);
      if (!Number.isInteger(q.correta) || q.correta < 0 || q.correta >= q.alternativas.length) throw new Error(`Questão ${n}: "correta" deve ser o índice da alternativa certa (0 = primeira).`);
    } else if (q.tipo === "diagrama") {
      const e = validarQuestaoDiagrama(q); if (e) throw new Error(`Questão ${n} (diagrama): ${e}`);
    } else if (q.tipo === "web") {
      if (!Array.isArray(q.etapas) || !q.etapas.length || !q.gabarito) throw new Error(`Questão ${n} (web): precisa de etapas e de gabarito.`);
    } else if (q.tipo === "sql") {
      if (!q.banco?.setup || !Array.isArray(q.tarefas) || !q.tarefas.length) throw new Error(`Questão ${n} (sql): precisa de banco.setup e de tarefas.`);
      q.tarefas.forEach((t, k) => { if (!t.id || !t.texto) throw new Error(`Questão ${n} (sql), tarefa ${k + 1}: precisa de id e texto.`); if (!q.gabarito?.tarefas?.[t.id]?.sql) throw new Error(`Questão ${n} (sql): falta o gabarito da tarefa ${t.id}.`); });
    } else {
      if (!(q.respostasAceitas?.length) && !(q.palavrasChave?.length) && q.correcaoManual !== true) throw new Error(`Questão ${n}: dissertativa precisa de respostasAceitas ou palavrasChave (ou "correcaoManual": true).`);
    }
  });
  return b;
}
$("#btnValidarBanco").onclick = () => {
  try {
    const b = validarBanco($("#txtBanco").value), c = contarPorTema(b.questoes);
    $("#msgBanco").innerHTML = `✅ OK: <b>${esc(b.nome)}</b>, ${b.questoes.length} questões (${b.questoes.filter(q => q.tipo === "alternativa").length} de alternativa, ${b.questoes.filter(q => q.tipo === "dissertativa").length} dissertativas).` +
      `<ul class="temas-banco">${Object.entries(c).map(([t, n]) => `<li><b>${esc(t)}</b>: ${textoContagem(n)}</li>`).join("")}</ul>`;
  }
  catch (e) { $("#msgBanco").innerHTML = `❌ ${esc(e.message)}`; }
};
$("#btnImportarBanco").onclick = async () => {
  if (!podeEditar()) return toast("Seu papel não permite importar.", "erro");
  let b; try { b = validarBanco($("#txtBanco").value); } catch (e) { $("#msgBanco").innerHTML = `❌ ${esc(e.message)}`; return false; }
  if (!(await confirmar(`Importar o banco "${b.nome}" com ${pl(b.questoes.length, "questão", "questões")}?`, { titulo: "Importar banco", ok: "Importar" }))) return false;
  const temas = ordenarTemas(b.questoes.map(temaDe));
  // questões SQL: roda o gabarito na Bancada (no navegador) e guarda a "impressão" do resultado de cada tarefa;
  // o servidor só compara (resultado igual = certa, sem gastar IA)
  const gabSql = {};
  const gabWebI = {};
  if (b.questoes.some(q => q.tipo === "web")) {
    $("#msgBanco").textContent = "Montando os gabaritos dos projetos web…";
    const { calcularGabaritoWeb } = await import("./bancada-web.js?v=20261125a");
    for (const [i, q] of b.questoes.entries()) if (q.tipo === "web") {
      const { gabarito, ...pub } = q;
      try { gabWebI[i] = await calcularGabaritoWeb(pub, gabarito); }
      catch (e) { $("#msgBanco").innerHTML = `❌ Questão ${i + 1}: ${esc(e.message)}`; return false; }
    }
  }
  if (b.questoes.some(q => q.tipo === "sql")) {
    $("#msgBanco").textContent = "Rodando os gabaritos das questões SQL…";
    const { calcularGabarito } = await import("./workbench.js?v=20261125b");
    for (const [i, q] of b.questoes.entries()) if (q.tipo === "sql") {
      try { gabSql[i] = await calcularGabarito(q, q.gabarito); }
      catch (e) { $("#msgBanco").innerHTML = `❌ Questão ${i + 1}: ${esc(e.message)}`; return false; }
    }
  }
  const ref = ultimoBancoImportado = await addDoc(collection(db, "bancos"), { nome: b.nome, materia: $("#bMateria").value.trim() || b.materia || "", semestre: $("#bSemestre").value || semestreDe(),
    nQuestoes: b.questoes.length, temas, criadoEm: serverTimestamp(), criadoPor: eu.email });
  const lote = writeBatch(db);
  b.questoes.forEach((q, i) => {
    const qid = `${ref.id}_q${String(i + 1).padStart(3, "0")}`;
    const pub = { ordem: i + 1, tipo: q.tipo, enunciado: q.enunciado, peso: Number(q.peso || 1), tema: temaDe(q) };
    if (q.tipo === "alternativa") pub.alternativas = q.alternativas;
    if (q.tipo === "diagrama") { pub.diagrama = q.diagrama; if (q.conversao === false) pub.conversao = false; if (q.inicial) pub.inicial = typeof q.inicial === "string" ? q.inicial : JSON.stringify(q.inicial); }
    if (q.tipo === "web") { const { gabarito, tipo, enunciado, peso, tema, ...resto } = q; Object.assign(pub, resto); }
    if (q.tipo === "sql") { pub.banco = { nome: String(q.banco.nome || "banco"), setup: q.banco.setup }; pub.tarefas = q.tarefas.map(t => ({ id: t.id, texto: t.texto, tipo: t.tipo === "alteracao" ? "alteracao" : "consulta", ...(t.verificacao ? { verificacao: t.verificacao } : {}) })); }
    lote.set(doc(db, "bancos", ref.id, "questoes", qid), pub);
    const gab = { explicacao: q.explicacao || "" };
    if (q.dica) gab.dica = String(q.dica).slice(0, 400);   // dica pronta (opcional): sem ela, o servidor pede uma à IA
    if (q.tipo === "alternativa") gab.correta = q.correta; else if (q.tipo === "sql") gab.tarefas = gabSql[i].tarefas; else if (q.tipo === "web") gab.web = JSON.stringify(gabWebI[i]); else if (q.tipo === "diagrama") { gab.diagrama = typeof q.gabarito === "string" ? q.gabarito : JSON.stringify(q.gabarito); gab.criterios = String(q.criterios || "").slice(0, 3000); } else { gab.respostasAceitas = q.respostasAceitas || []; gab.palavrasChave = q.palavrasChave || []; }
    lote.set(doc(db, "bancos", ref.id, "gabaritos", qid), gab);
  });
  await lote.commit();
  $("#msgBanco").textContent = ""; toast(`Banco ${b.nome} importado com ${pl(b.questoes.length, "questão", "questões")} em ${pl(temas.length, "tema")}.`, "ok"); $("#txtBanco").value = "";
  carregarBancos();
  return true;
};
// ============================================================ BANCOS PRONTOS (vêm no site, importados com um clique)
// Cada um traz somativas de exemplo já preenchidas (fechadas e sem turma: escolha a turma em Editar e libere).
let ultimoBancoImportado = null;
const BANCOS_PRONTOS = [
  { arquivo: "bancos/banco_sql_workbench.json", icone: "🗄", titulo: "Bancada SQL: 15 cenários práticos", desc: "Pet shop, biblioteca, oficina, academia, cinema, hotel… Cada aluno recebe um cenário diferente (base e tarefas), escreve e executa SQL na Bancada parecida com o MySQL Workbench. Correção automática pelo resultado; a IA só entra nas tarefas que não bateram.",
    provas: [
      { titulo: "Prática SQL na Bancada (1 cenário sorteado)", nSql: 1, tempoMinutos: 45 },
      { titulo: "Prática SQL na Bancada (2 cenários sorteados)", nSql: 2, tempoMinutos: 90 },
      { titulo: "Prática SQL na Bancada — com 3 dicas do mascote", nSql: 1, tempoMinutos: 45, dicasMax: 3 }
    ] },
  { arquivo: "bancos/banco_sql_misto.json", icone: "🧮", titulo: "SQL misto: alternativas + dissertativas + Bancada (1 tarefa)", desc: "108 questões em 11 temas (consultas, JOIN, GROUP BY, INSERT, UPDATE, DELETE, DDL, DCL, backup). Cada tema mistura múltipla escolha, dissertativas de escrever o comando e questões na Bancada SQL com UMA tarefa só. Na somativa você escolhe quantas de cada tipo.",
    provas: [
      { titulo: "SQL misto — 6 alternativas + 2 dissertativas + 2 na Bancada", nAlternativas: 6, nDissertativas: 2, nSql: 2, tempoMinutos: 60 },
      { titulo: "SQL misto — Consultas e DML (4 + 2 + 3 na Bancada)", nAlternativas: 4, nDissertativas: 2, nSql: 3, tempoMinutos: 60,
        temas: ["Consultas (SELECT, WHERE e ORDER BY)", "Consultas com JOIN", "Agrupamento (GROUP BY e HAVING)", "DML — INSERT", "DML — UPDATE", "DML — DELETE"] }
    ] },
  { arquivo: "bancos/banco_requisitos_diagramas.json", icone: "📐", titulo: "Levantamento de Requisitos: diagramas e artefatos", desc: "10 questões em que o aluno MONTA a resposta: diagrama de casos de uso, diagrama de atividades, matriz de rastreabilidade (requisito × artefato e requisito × requisito), documento de requisitos (RF/RNF/RN), quadro Kanban, histórias de usuário e mapa de empatia. Correção: igual ao gabarito vale direto; o resto a IA corrige com os critérios.",
    provas: [
      { titulo: "Requisitos — 2 diagramas sorteados", nDiagramas: 2, tempoMinutos: 60 },
      { titulo: "Requisitos — casos de uso e rastreabilidade", nDiagramas: 2, tempoMinutos: 60, temas: ["Diagrama de casos de uso", "Matriz de rastreabilidade"] }
    ] },
  { arquivo: "bancos/banco_brmodelo.json", icone: "🧩", titulo: "Banco de Dados: modelagem no brModelo (conceitual e lógico)", desc: "9 questões feitas num editor igual ao brModelo: modelo conceitual (entidades, relacionamentos, cardinalidades, atributos identificador/composto/multivalorado, especialização, entidade associativa) e modelo lógico (tabelas, PK, FK). Correção: igual ao gabarito vale direto; o resto a IA corrige com os critérios.",
    provas: [
      { titulo: "Modelagem — 1 modelo conceitual (brModelo)", nDiagramas: 1, tempoMinutos: 50 },
      { titulo: "Modelagem — 2 diagramas sorteados (conceitual/lógico)", nDiagramas: 2, tempoMinutos: 90 }
    ] },
  { arquivo: "bancos/banco_web_demon_slayer.json", icone: "🧑‍💻", titulo: "Bancada Web: site Demon Slayer + portfólio", desc: "Prova prática de HTML e CSS (Flexbox, Grid) num editor parecido com o VS Code: passo a passo à esquerda, comandos HTML/CSS no lugar do terminal, prévia ao vivo na mesma tela e git simulado (commit e push). Três jeitos: encaixar blocos (padrão), completar digitando e projeto livre com pastas e arquivos.",
    provas: [
      { titulo: "Prática Web — Demon Slayer (encaixar os blocos)", nWeb: 1, tempoMinutos: 100, tema: "Demon Slayer — encaixar blocos" },
      { titulo: "Prática Web — Demon Slayer (completar digitando)", nWeb: 1, tempoMinutos: 100, tema: "Demon Slayer — completar digitando" },
      { titulo: "Prática Web — Portfólio (projeto livre com pastas e git)", nWeb: 1, tempoMinutos: 100, tema: "Portfólio — projeto livre" }
    ] }
];
function desenharBancosProntos() {
  const box = $("#bancosProntos"); if (!box) return;
  if (!podeEditar()) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="card bancos-prontos"><h3 style="margin:0 0 4px">📦 Bancos prontos</h3><p class="pequeno" style="margin:0 0 10px">Importe com um clique. Já cria somativas de exemplo preenchidas (fechadas e sem turma): é só escolher a turma em <b>Editar</b> e liberar.</p>` +
    BANCOS_PRONTOS.map((b, i) => {
      const ja = bancosCache.find(x => x.arquivoPronto === b.arquivo);
      return `<div class="bp-item"><div><b>${b.icone} ${esc(b.titulo)}</b>${ja ? ` <span class="tag ok">importado</span>` : ""}<p class="pequeno" style="margin:2px 0 0">${esc(b.desc)}</p>
        <p class="pequeno" style="margin:2px 0 0">Somativas de exemplo: ${b.provas.map(p => esc(p.titulo)).join(" · ")}</p></div>
        <button class="${ja ? "leve" : "ok"} mini" data-pronto="${i}">${ja ? "Criar as somativas de exemplo de novo" : "Importar e criar as somativas"}</button></div>`;
    }).join("") + `</div>`;
  box.querySelectorAll("[data-pronto]").forEach(bt => bt.onclick = () => importarPronto(BANCOS_PRONTOS[Number(bt.dataset.pronto)], bt));
}
async function importarPronto(item, bt) {
  bt.disabled = true;
  try {
    let banco = bancosCache.find(x => x.arquivoPronto === item.arquivo);
    if (!banco) {
      const txt = await (await fetch(item.arquivo + "?v=" + Date.now())).text();
      $("#txtBanco").value = txt;
      ultimoBancoImportado = null;
      if (!(await $("#btnImportarBanco").onclick()) || !ultimoBancoImportado) { bt.disabled = false; return; }
      await updateDoc(doc(db, "bancos", ultimoBancoImportado.id), { arquivoPronto: item.arquivo });
      banco = { id: ultimoBancoImportado.id, ...(await getDoc(doc(db, "bancos", ultimoBancoImportado.id))).data() };
    } else if (!(await confirmar(`Criar de novo as ${item.provas.length} somativas de exemplo do banco "${banco.nome}"?`, { titulo: "Somativas de exemplo", ok: "Criar" }))) { bt.disabled = false; return; }
    for (const p of item.provas) {
      const temas = p.temas || (p.tema ? [p.tema] : (banco.temas || []));
      const n = Number(p.nSql || 0) + Number(p.nWeb || 0) + Number(p.nDiagramas || 0) + Number(p.nAlternativas || 0) + Number(p.nDissertativas || 0);
      await addDoc(collection(db, "provas"), {
        titulo: p.titulo, turmaId: null, turma: "", codigoAcesso: "", semestre: semestreDe(), materia: banco.materia || (p.nWeb ? "Desenvolvimento Web" : p.nDiagramas ? "Levantamento de Requisitos" : "Banco de Dados"), dataProva: "", planoCurso: null,
        permitirVoltar: true, tempoMinutos: p.tempoMinutos || 45, modoExibicao: "uma", permitirTrocaAba: false, permitirColar: false,
        maxTrocasDeAba: 3, colarTiraVida: true, dicasMax: p.dicasMax || 0, segundosVolta: 5, entradaAte: null, iaAutomatica: true, acaoAoExceder: "encerrar",
        materialConsultaUrl: "", materiaisConsultaIds: [], materialConsultaArquivoId: null, materialConsultaTitulo: "",
        bancoId: banco.id, bancoIds: [banco.id], temasPorBanco: { [banco.id]: temas }, temas,
        nQuestoes: n, nAlternativas: Number(p.nAlternativas || 0), nDissertativas: Number(p.nDissertativas || 0), nSql: Number(p.nSql || 0), nWeb: Number(p.nWeb || 0), nDiagramas: Number(p.nDiagramas || 0),
        liberada: false, resultadosLiberados: false, criadoEm: serverTimestamp(), criadoPor: eu.email, exemploPronto: item.arquivo
      });
    }
    toast(`Pronto: banco importado e ${item.provas.length} somativas de exemplo criadas em Somativas (fechadas, sem turma).`, "ok");
    await carregarBancos();
  } catch (e) { toast("Não foi possível importar o banco pronto. " + traduzirErro(e), "erro"); console.error(e); }
  bt.disabled = false;
}
// semestre do banco: o gravado; senão o da criação
const semestreDoBanco = b => b.semestre || semestreDe(b.criadoEm || new Date());
let bancosContagem = {};   // bancoId -> { tema: { alternativa, dissertativa } }
const bancosEstado = new Map();   // grupos que o professor abriu ou fechou (semestre atual e matérias começam abertos; semestres anteriores, fechados)
async function carregarBancos() {
  await Promise.all([listarBancos(), listarPlanos().catch(() => []), listarCursos().catch(() => [])]);
  desenharBancosProntos();
  // formulário de importação: semestre e matérias sugeridas
  const sAntes = $("#bSemestre").value, base = semestreDe();
  $("#bSemestre").innerHTML = [-2, -1, 0, 1, 2].map(d => semestreVizinho(base, d)).reverse().map(x => `<option value="${x}">${rotuloSemestre(x)}${x === base ? " (atual)" : ""}</option>`).join("");
  $("#bSemestre").value = sAntes || base;
  $("#bMaterias").innerHTML = materiasSugeridas().map(m => `<option value="${esc(m)}">`).join("");
  const box = $("#listaBancos");
  if (!bancosCache.length) { $("#fbContagem").textContent = ""; box.innerHTML = vazio({ e: "📚", texto: "Nenhum banco ainda. Use <b>Importar banco</b>, no alto da tela, para começar." }); return; }
  box.innerHTML = `<p class="pequeno">Carregando…</p>`;
  const cs = await Promise.all(bancosCache.map(b => questoesDoBanco(b.id).then(contarPorTema).catch(() => null)));
  bancosContagem = Object.fromEntries(bancosCache.map((b, i) => [b.id, cs[i]]));
  if (!provasCache.length) provasCache = (await getDocs(collection(db, "provas")).catch(() => null))?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
  const sel = (el, primeira, vals, rot = v => v) => { const a = el.value; el.innerHTML = `<option value="">${primeira}</option>` + vals.map(v => `<option value="${esc(v)}">${esc(rot(v))}</option>`).join(""); el.value = vals.includes(a) ? a : ""; };
  sel($("#fbSemestre"), "📅 Todos os semestres", [...new Set(bancosCache.map(semestreDoBanco))].sort().reverse(), rotuloSemestre);
  const mats = new Map(); bancosCache.forEach(b => mats.set(chaveTexto(b.materia) || "~", String(b.materia || "").trim() || "Sem matéria"));
  sel($("#fbMateria"), "📚 Todas as matérias", [...mats.values()].sort((a, b) => a.localeCompare(b, "pt-BR")));
  desenharBancos();
}
function desenharBancos() {
  const box = $("#listaBancos");
  const busca = semAcento($("#fbBusca").value.trim()), fS = $("#fbSemestre").value, fM = chaveTexto($("#fbMateria").value);
  const matDe = b => String(b.materia || "").trim() || "Sem matéria";
  // busca também no enunciado das questões: mostra quantas bateram
  const achados = {};
  const lista = bancosCache.filter(b => {
    if (fS && semestreDoBanco(b) !== fS) return false;
    if (fM && chaveTexto(matDe(b)) !== fM) return false;
    if (!busca) return true;
    if (semAcento([b.nome, matDe(b), ...Object.keys(bancosContagem[b.id] || {})].join(" ")).includes(busca)) return true;
    const n = (questoesCache[b.id] || []).filter(q => semAcento(q.enunciado).includes(busca)).length;
    if (n) achados[b.id] = n;
    return n > 0;
  });
  atualizarFiltros($("#aba-bancos .toolbar"));
  $("#fbContagem").textContent = `${pl(lista.length, "banco")} · ${pl(lista.reduce((n, b) => n + Number(b.nQuestoes || 0), 0), "questão", "questões")}`;
  if (!lista.length) { box.innerHTML = vazio({ e: "🔎", texto: "Nenhum banco com esses filtros." }); return; }
  const arv = new Map();
  for (const b of lista) {
    const s = semestreDoBanco(b), m = matDe(b);
    if (!arv.has(s)) arv.set(s, new Map());
    const mm = arv.get(s), k = chaveTexto(m); if (!mm.has(k)) mm.set(k, { m, bs: [] }); mm.get(k).bs.push(b);
  }
  const filtrando = busca || fS || fM, atual = semestreDe();
  const usos = id => provasCache.filter(p => bancosDaProva(p).includes(id));
  const aberto = (id, padrao) => filtrando || (bancosEstado.has(id) ? bancosEstado.get(id) : padrao);
  const somaQ = bs => bs.reduce((n, b) => n + Number(b.nQuestoes || 0), 0);
  box.innerHTML = [...arv.keys()].sort().reverse().map(s => {
    const mats = [...arv.get(s).values()].sort((a, b) => a.m.localeCompare(b.m, "pt-BR")), ids = `bs:${s}`;
    const todos = mats.flatMap(x => x.bs);
    return `<details class="faixa" data-gb="${ids}" ${aberto(ids, s === atual) ? "open" : ""}>
      <summary class="secao-faixa"><span class="sf-tile">${ic("cal", { size: 20 })}</span><h3 class="sf-titulo">${esc(semestreLongo(s))}</h3>${s === atual ? `<span class="chip ok">atual</span>` : ""}
        <span class="sf-resumo">${pl(mats.length, "matéria")} · ${pl(todos.length, "banco")} · ${pl(somaQ(todos), "questão", "questões")}</span><span class="sf-fim sf-tile">${seta()}</span></summary>
      <div class="faixa-corpo">${mats.map(({ m, bs }) => {
        const idm = `bm:${s}:${chaveTexto(m)}`;
        return `<details class="card sem-padding" data-gb="${idm}" ${aberto(idm, true) ? "open" : ""}>
          <summary class="sub-cab"><span class="sc-tile">${ic("book", { size: 20 })}</span><span class="sc-texto"><span class="sc-titulo">${esc(m)}</span><span class="sc-resumo">${pl(bs.length, "banco")} · ${pl(somaQ(bs), "questão", "questões")}</span></span>
            ${podeEditar() ? `<span class="sc-fim"><button type="button" class="leve mini" data-banco-sem="${esc(s)}" data-banco-mat="${m === "Sem matéria" ? "" : esc(m)}">${ic("plus", { size: 16 })}Banco nesta matéria</button></span>` : ""}${seta()}</summary>
          <div class="bancos-grade">${bs.map(b => {
            const c = bancosContagem[b.id], tot = c ? Object.values(c).reduce((x, y) => ({ alternativa: x.alternativa + y.alternativa, dissertativa: x.dissertativa + y.dissertativa }), { alternativa: 0, dissertativa: 0 }) : null;
            const u = usos(b.id), geral = c?.Geral ? (c.Geral.alternativa + c.Geral.dissertativa) : 0;
            const nTop = c ? Object.keys(c).length : 0;
            return `<article class="banco-bloco">
              <div class="bb-topo"><span class="bb-tile">${ic("bancos", { size: 18 })}</span>
                <div class="bb-info"><h4>${esc(b.nome)}</h4><span class="bb-resumo">${pl(Number(b.nQuestoes) || 0, "questão", "questões")}${tot ? ` · ${tot.alternativa} alternativa · ${tot.dissertativa} dissertativa` : ""}${achados[b.id] ? ` · <b>${pl(achados[b.id], "questão", "questões")} com “${esc($("#fbBusca").value.trim())}”</b>` : ""}</span></div>
                ${u.length ? `<span class="chip info" title="${esc(u.map(p => p.titulo).join(" · "))}">em ${pl(u.length, "prova")}</span>` : `<span class="chip off">sem prova</span>`}</div>
              <div class="bb-rodape">
                ${c ? `<details class="bb-topicos"><summary>${seta(16)}${ic("tag", { size: 15 })}${pl(nTop, "tópico")}${geral ? `<span class="chip warn">${geral} sem tópico</span>` : ""}</summary>
                  <ul class="lista-topicos lista-topicos-banco">${Object.entries(c).map(([t, n]) => `<li class="topico${t === "Geral" ? " e-geral" : ""}"><span class="tp-nome">${esc(t)}</span><span class="meta-txt">${n.alternativa} alt. · ${n.dissertativa} dissert.</span></li>`).join("")}</ul>
                  ${geral ? `<p class="help">${pl(geral, "questão", "questões")} sem tópico ("Geral"): use Tópicos.</p>` : ""}</details>` : `<p class="help">Não foi possível ler as questões.</p>`}
                <div class="bb-acoes">${podeEditar() ? `<button class="leve mini" data-topicos="${b.id}" title="Tópico de cada questão, matéria e semestre do banco (com sugestão da IA)">${ic("tag", { size: 16 })}Tópicos</button>` : ""}
                  ${podeEditar() ? `<button class="leve mini" data-criterios="${b.id}" title="Liga cada questão a um critério do plano de ensino (para gerar evidência da prova)">${ic("star", { size: 16 })}Critérios</button>` : ""}
                  ${menuHTML({ aria: `Mais ações: ${b.nome}`, itensHTML: itemMenu({ i: "copy", t: "Gabarito para o Classroom", attrs: `data-gab="${b.id}"` }) + (ehAdmin() ? "<hr>" + itemMenu({ i: "trash", t: "Apagar banco", perigo: true, attrs: `data-delb="${b.id}"` }) : "") })}</div>
              </div></article>`;
          }).join("")}</div></details>`;
      }).join("")}</div></details>`;
  }).join("");
  box.querySelectorAll("[data-gb]").forEach(d => d.ontoggle = () => { if (!filtrando) bancosEstado.set(d.dataset.gb, d.open); });
  box.querySelectorAll("[data-banco-sem]").forEach(x => x.onclick = () => abrirImportarBanco({ semestre: x.dataset.bancoSem, materia: x.dataset.bancoMat }));
  box.querySelectorAll("[data-gab]").forEach(x => x.onclick = () => gerarGabarito(x.dataset.gab));
  box.querySelectorAll("[data-topicos]").forEach(x => x.onclick = () => editarTopicosBanco(x.dataset.topicos, carregarBancos));
  box.querySelectorAll("[data-criterios]").forEach(x => x.onclick = () => editarCriteriosBanco(x.dataset.criterios, carregarBancos));
  box.querySelectorAll("[data-delb]").forEach(x => x.onclick = async () => {
    if (!(await confirmar("Apagar o banco e todas as suas questões?", { titulo: "Apagar banco", ok: "Apagar", perigo: true }))) return;
    const id = x.dataset.delb, lote = writeBatch(db);
    (await getDocs(collection(db, "bancos", id, "questoes"))).forEach(d => lote.delete(d.ref));
    (await getDocs(collection(db, "bancos", id, "gabaritos"))).forEach(d => lote.delete(d.ref));
    lote.delete(doc(db, "bancos", id)); await lote.commit(); delete questoesCache[id]; carregarBancos();
  });
}
// ---------- 🤖 prompt pronto para gerar o banco numa IA ----------
const giExtras = new Set(), giDesmarcados = new Set();
function giTopicosDisponiveis() {
  const m = $("#giMateria").value.trim();
  if (!m) return [];
  const dosBancos = bancosCache.filter(b => chaveTexto(b.materia) === chaveTexto(m)).flatMap(b => (questoesCache[b.id] || []).map(temaDe)).filter(t => t !== "Geral");
  return ordenarTemas([...topicosDaMateria(m), ...dosBancos, ...giExtras]).filter((t, i, l) => l.findIndex(x => chaveTexto(x) === chaveTexto(t)) === i);
}
function giDesenharTopicos() {
  const tops = giTopicosDisponiveis(), box = $("#giTopicos");
  box.innerHTML = tops.length ? tops.map(t => `<label class="check"><input type="checkbox" value="${esc(t)}"${giDesmarcados.has(t) ? "" : " checked"}> <span>${esc(t)}</span></label>`).join("")
    : `<p class="pequeno">${$("#giMateria").value.trim() ? "Nenhum tópico cadastrado para esta matéria (plano de curso/ensino ou bancos). Adicione abaixo." : "Escreva a matéria acima."}</p>`;
  box.querySelectorAll("input").forEach(c => c.onchange = () => { c.checked ? giDesmarcados.delete(c.value) : giDesmarcados.add(c.value); giMontar(); });
  giMontar();
}
const MODELO_JSON = { nome: "DML — INSERT, UPDATE, DELETE e SELECT", materia: "Banco de Dados", questoes: [
  { tipo: "alternativa", tema: "DML - UPDATE", enunciado: "Qual comando altera o e-mail do cliente de id 3?", alternativas: ["UPDATE cliente SET email = 'novo@x.com' WHERE id_cliente = 3;", "UPDATE cliente SET email = 'novo@x.com';", "ALTER TABLE cliente SET email = 'novo@x.com' WHERE id_cliente = 3;", "INSERT INTO cliente (email) VALUES ('novo@x.com');"], correta: 0, explicacao: "UPDATE com WHERE altera só a linha do id 3. Sem WHERE mudaria todos; ALTER muda a estrutura; INSERT cria linha nova.", peso: 1 },
  { tipo: "dissertativa", tema: "DML - SELECT", enunciado: "Escreva o comando que conta quantos clientes existem na tabela cliente.", respostasAceitas: ["SELECT COUNT(*) FROM cliente;", "SELECT COUNT(id_cliente) FROM cliente;"], palavrasChave: ["select count(", "from cliente"], explicacao: "COUNT(*) conta as linhas da tabela.", peso: 2 },
  { tipo: "dissertativa", tema: "Modelagem", enunciado: "Explique, em 2 linhas, para que serve a chave estrangeira.", correcaoManual: true, explicacao: "Ela liga uma tabela a outra e garante que o valor exista na tabela de origem.", peso: 2 }] };
function giMontar() {
  const materia = $("#giMateria").value.trim() || "(a matéria)", tops = [...$("#giTopicos").querySelectorAll("input:checked")].map(c => c.value);
  const nA = Math.max(0, Number($("#giAlt").value) || 0), nD = Math.max(0, Number($("#giDiss").value) || 0), op = Number($("#giOpcoes").value) || 4;
  const nome = $("#giNome").value.trim() || `${materia} — banco gerado`, extra = $("#giContexto").value.trim(), total = tops.length * (nA + nD);
  $("#giPrompt").value = `Você é professor de ${materia} em um curso técnico do SENAI. Crie um banco de questões de prova, nível ${$("#giNivel").value}, em português do Brasil.

TÓPICOS (use exatamente estes nomes no campo "tema"; o tema é o ASSUNTO, nunca o nome da avaliação como "MS4"/"MS5"):
${tops.length ? tops.map(t => `- ${t}`).join("\n") : "- (escolha os tópicos no sistema)"}

QUANTIDADE: para CADA tópico, ${nA} questão(ões) de múltipla escolha e ${nD} dissertativa(s) — ${total} questões no total.
${extra ? `\nCONTEXTO/PEDIDO: ${extra}\n` : ""}
REGRAS DAS QUESTÕES
- Múltipla escolha ("tipo": "alternativa"): exatamente ${op} alternativas, uma só correta, as erradas plausíveis (erros comuns de aluno). "correta" é o ÍNDICE da certa, começando em 0 (0 = primeira). Varie a posição da certa.
- Dissertativa de comando/código ("tipo": "dissertativa"): "respostasAceitas" com a resposta certa e as variações equivalentes (outra ordem de colunas, com e sem ponto e vírgula, maiúsculas), e "palavrasChave" com trechos bem específicos que toda resposta certa tem.
- Dissertativa de explicar/justificar: use "correcaoManual": true (sem respostasAceitas).
- "explicacao": 1 ou 2 frases dizendo por que a certa é certa (o aluno lê depois da prova).
- "peso": 1 para múltipla escolha, 2 para dissertativa.
- Enunciado claro, uma pergunta por questão, sem dupla negação e sem pegadinha. Código entre crases: \`SELECT * FROM x;\` ou bloco com três crases.

FORMATO DA RESPOSTA: devolva SOMENTE um JSON válido (sem texto antes ou depois, sem comentários), exatamente neste formato:
${JSON.stringify({ nome, materia: $("#giMateria").value.trim() || materia, questoes: MODELO_JSON.questoes.slice(0, 3).map((q, i) => ({ ...q, tema: tops[i % Math.max(1, tops.length)] || q.tema })) }, null, 2)}`;
}
["#giMateria", "#giNome", "#giNivel", "#giAlt", "#giDiss", "#giOpcoes", "#giContexto"].forEach(id => $(id).addEventListener("input", id === "#giMateria" ? giDesenharTopicos : giMontar));
$("#gerarIA").addEventListener("toggle", () => { if ($("#gerarIA").open) { if (!$("#giMateria").value) $("#giMateria").value = $("#bMateria").value; Promise.all(bancosCache.map(b => questoesDoBanco(b.id).catch(() => []))).then(giDesenharTopicos); } });
$("#giTopicoAdd").onclick = () => { const t = $("#giTopicoNovo").value.trim(); if (t) { giExtras.add(t); giDesmarcados.delete(t); $("#giTopicoNovo").value = ""; giDesenharTopicos(); } };
$("#giCopiar").onclick = () => { if (![...$("#giTopicos").querySelectorAll("input:checked")].length) return toast("Marque pelo menos um tópico.", "erro"); navigator.clipboard.writeText($("#giPrompt").value).then(() => toast("Prompt copiado! Cole na IA. 📋", "ok"), () => { $("#giPrompt").select(); toast("Selecionei o prompt: use Ctrl+C.", "info"); }); };
$("#giModelo").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(MODELO_JSON, null, 2)], { type: "application/json" })); a.download = "modelo_banco.json"; a.click(); };
["#fbBusca", "#fbSemestre", "#fbMateria"].forEach(id => $(id).addEventListener(id === "#fbBusca" ? "input" : "change", desenharBancos));
$("#fbLimpar").onclick = () => { $("#fbBusca").value = ""; $("#fbSemestre").value = ""; $("#fbMateria").value = ""; desenharBancos(); };
async function lerBanco(bancoId) {
  const [qs, gs] = await Promise.all([getDocs(collection(db, "bancos", bancoId, "questoes")), getDocs(collection(db, "bancos", bancoId, "gabaritos"))]);
  const questoes = {}, gabaritos = {};
  qs.forEach(d => questoes[d.id] = { id: d.id, ...d.data() }); gs.forEach(d => gabaritos[d.id] = d.data());
  return { questoes, gabaritos };
}
// vários bancos juntos (os ids das questões já são únicos: "<bancoId>_q001")
async function lerBancos(ids) {
  const todos = await Promise.all(ids.map(lerBanco));
  return { questoes: Object.assign({}, ...todos.map(x => x.questoes)), gabaritos: Object.assign({}, ...todos.map(x => x.gabaritos)) };
}
async function gerarGabarito(bancoId) {
  const b = bancosCache.find(x => x.id === bancoId), { questoes, gabaritos } = await lerBanco(bancoId);
  const lista = Object.values(questoes).sort((a, c) => a.ordem - c.ordem);
  let t = "";
  // monta o texto só com os temas marcados, uma seção por tema
  const montar = () => {
    const marcados = temasMarcados($("#gabTemas"));
    t = `GABARITO — ${b.nome}\n${"=".repeat(60)}\nCada aluno recebeu um sorteio de questões deste banco: confira as suas pelo enunciado.\n`;
    if (!marcados.length) t += "\n(nenhum tema marcado)\n";
    for (const tema of marcados) {
      const doTema = lista.filter(q => temaDe(q) === tema);
      t += `\n\n${"─".repeat(60)}\nTEMA: ${tema.toUpperCase()}  (${doTema.length} questões)\n${"─".repeat(60)}\n\n`;
      doTema.forEach(q => {
        const g = gabaritos[q.id] || {};
        t += `${q.ordem}) ${q.enunciado}\n`;
        if (q.tipo === "alternativa") { q.alternativas.forEach((a, i) => t += `   ${letra(i)}) ${a}\n`); t += `   ✔ Resposta: ${letra(g.correta)}) ${q.alternativas[g.correta]}\n`; }
        else t += `   ✔ Resposta esperada: ${(g.respostasAceitas || [])[0] || "(ver palavras-chave: " + (g.palavrasChave || []).join(", ") + ")"}\n`;
        if (g.explicacao) t += `   💡 ${g.explicacao}\n`;
        t += "\n";
      });
    }
    $("#txtGabarito").textContent = t;
  };
  desenharChecksTemas($("#gabTemas"), contarPorTema(lista), montar);
  montar();
  drawer({ titulo: `Gabarito para o Classroom — ${b.nome}`, corpo: $("#cardGabarito"), largo: true, aoFechar: () => $("#cardGabarito").classList.add("oculto") });
  $("#btnCopiarGab").onclick = () => navigator.clipboard.writeText(t).then(() => toast("Copiado", "ok"));
  $("#btnBaixarGab").onclick = () => baixar(`gabarito_${b.nome.replace(/\W+/g, "_")}.txt`, t);
}
function baixar(nome, conteudo) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([conteudo], { type: "text/plain;charset=utf-8" })); a.download = nome; a.click();
}

// ============================================================ RESULTADOS
// tempo legível: 75 -> "1min 15s"
function fmtTempo(seg) {
  if (seg === null || seg === undefined || isNaN(seg)) return "—";
  seg = Math.round(seg);
  const h = Math.floor(seg / 3600), m = Math.floor(seg % 3600 / 60), s = seg % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}min` : m ? `${m}min ${String(s).padStart(2, "0")}s` : `${s}s`;
}
// tempo total da tentativa (campo gravado ao finalizar; para tentativas antigas, fim − início)
function tempoTotal(t) {
  if (typeof t.tempoTotalSegundos === "number") return t.tempoTotalSegundos;
  const i = t.iniciadaEm?.toMillis?.(), f = t.finalizadaEm?.toMillis?.();
  return i && f ? Math.round((f - i) / 1000) : null;
}
// "2026-11-25T14:30" para <input type="datetime-local">
function dataHoraLocal(d) { const z = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; }
const RAPIDO = 5;   // resposta enviada em menos de 5 s: destacar
// sinais de cola; com troca de aba permitida na prova, as trocas aparecem em cinza ("permitido") e não destacam a linha
function sinaisDe(t, prova) {
  const atual = t.trocasDeAba || 0, acumulado = t.trocasDeAbaTotal || 0;   // "perder questão" zera trocasDeAba e acumula em trocasDeAbaTotal
  const s = { abas: atual + acumulado, abasAtual: atual, abasAcumulado: acumulado, telaCheia: t.saidasTelaCheia || 0, colar: t.tentativasColar || 0, abasPermitido: prova?.permitirTrocaAba === true };
  s.total = (s.abasPermitido ? 0 : s.abas) + s.telaCheia + s.colar;
  s.dicas = Object.keys(t.dicas || {}).length;
  s.atalhos = t.atalhosBloqueados || 0; s.extensoes = (t.extensoes || []).join(", ");
  return s;
}
function sinaisHTML(s) {
  const item = (ic, n, tit) => `<span class="${n ? "" : "zero"}" title="${tit}">${ic} ${n}</span>`;
  const abas = s.abasPermitido ? `<span class="permitido" title="Troca de aba permitida nesta prova">🔀 ${s.abas} permitido</span>` : item("🔀", s.abas, "Trocas de aba/janela");
  return `<span class="sinais">${abas}${item("⛶", s.telaCheia, "Saídas da tela cheia")}${item("📋", s.colar, "Tentativas de colar")}${s.dicas ? `<span title="Dicas pedidas ao mascote">💡 ${s.dicas}</span>` : ""}${s.atalhos ? `<span title="Atalhos bloqueados (Alt, Win, Ctrl…) — só registro">⌨ ${s.atalhos}</span>` : ""}${s.extensoes ? `<span title="Extensões detectadas: ${esc(s.extensoes)}">🧩 ${esc(s.extensoes)}</span>` : ""}</span>`;
}
const abasTexto = s => `${s.abas}${s.abasPermitido ? " (permitido)" : ""}`;
function sinaisTexto(s) { return `abas ${abasTexto(s)} · tela cheia ${s.telaCheia} · colar ${s.colar}`; }

// rótulos de correção usados no detalhe
const ROTULOS = { certa: ["ok", "✅ certa"], errada: ["erro", "❌ errada"], parcial: ["aviso", "🟡 parcial"], revisar: ["aviso", "🟡 revisar"], em_branco: ["erro", "⬜ em branco"], perdida: ["erro", "⛔ perdida (saiu da prova)"] };
// limite de saídas efetivo da prova (0 = sem limite; com troca de aba permitida não há limite)
const limiteSaidas = p => p?.permitirTrocaAba ? 0 : Math.max(0, Number(p?.maxTrocasDeAba || 0));

let resDados = null;          // { prova, questoes, gabaritos, linhas: [...alunos], testes: [...equipe] }
const cacheTent = new Map();  // tentativaId -> { t, resp, corr }  (base da tabela; o "ao vivo" só atualiza o que mudou)
let ouvintes = [];            // unsubscribe do "ao vivo" (tentativas da prova)
let ouvinteDetalhe = null;    // unsubscribe das respostas da tentativa aberta em "Ver"
let detalheId = null;         // tentativa aberta em "Ver"

let provasRes = [];
async function prepararResultados() {
  const [s] = await Promise.all([getDocs(collection(db, "provas")), ehInclusao() ? null : listarTurmas().catch(() => null), listarBancos().catch(() => null)]);
  provasRes = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  const preencher = (el, primeira, vals, rot = v => v) => { const a = el.value; el.innerHTML = `<option value="">${primeira}</option>` + vals.map(v => `<option value="${esc(v)}">${esc(rot(v))}</option>`).join(""); el.value = vals.includes(a) ? a : ""; };
  preencher($("#rSemestre"), "Todos", [...new Set(provasRes.map(semestreDaProva))].sort().reverse(), rotuloSemestre);
  const mats = new Map(); provasRes.forEach(p => { const m = materiaDaProva(p, bancosCache); if (m) mats.set(chaveTexto(m), m); });
  preencher($("#rMateria"), "Todas", [...mats.values()].sort((a, b) => a.localeCompare(b, "pt-BR")));
  const selT = $("#rTurma"), tAntes = selT.value;
  const turmas = [...new Map(provasRes.map(p => [p.turmaId || "__sem", p.turmaId ? (nomeTurma(turmasCache.find(t => t.id === p.turmaId)) || p.turma || "turma") : "⚠ Sem turma"])).entries()]
    .sort((a, b) => a[0] === "__sem" ? 1 : b[0] === "__sem" ? -1 : a[1].localeCompare(b[1], "pt-BR", { numeric: true }));
  selT.innerHTML = `<option value="">Todas as turmas</option>` + turmas.map(([id, nome]) => `<option value="${id}">${esc(nome)}</option>`).join("");
  selT.value = turmas.some(([id]) => id === tAntes) ? tAntes : "";
  opcoesProvaRes();
}
// provas do select de Resultados: filtradas pela turma e agrupadas (optgroup) por turma
function opcoesProvaRes() {
  const turma = $("#rTurma").value, antes = $("#rProva").value, fS = $("#rSemestre").value, fM = chaveTexto($("#rMateria").value);
  const lista = provasRes.filter(p => (!turma || (p.turmaId || "__sem") === turma) && (!fS || semestreDaProva(p) === fS) && (!fM || chaveTexto(materiaDaProva(p, bancosCache)) === fM));
  const grupos = new Map();
  lista.forEach(p => { const k = p.turmaId ? (turmasCache.find(t => t.id === p.turmaId)?.nome || p.turma || "turma") : "⚠ Sem turma"; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); });
  $("#rProva").innerHTML = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR", { numeric: true }))
    .map(([k, ps]) => `<optgroup label="${esc(k)}">${ps.map(p => `<option value="${p.id}">${esc(p.titulo)} · ${esc(materiaDaProva(p, bancosCache) || "—")} · ${rotuloSemestre(semestreDaProva(p))}${p.liberada ? " ●" : ""}</option>`).join("")}</optgroup>`).join("") || `<option value="">Nenhuma prova com esses filtros</option>`;
  if (antes && lista.some(p => p.id === antes)) $("#rProva").value = antes;
}
$("#rTurma").onchange = $("#rSemestre").onchange = $("#rMateria").onchange = () => { opcoesProvaRes(); $("#rProva").dispatchEvent(new Event("change")); };
$("#rAluno").oninput = $("#rSituacao").onchange = () => { if (resDados) desenharResultados(); };
// filtro da lista de alunos (a média e os números de cima continuam sendo da prova inteira)
function filtrarLinhas(linhas) {
  const b = semAcento($("#rAluno").value.trim()), sit = $("#rSituacao").value;
  return linhas.filter(l => {
    if (b && !semAcento(`${l.t.nome || ""} ${l.t.email || ""}`).includes(b)) return false;
    if (sit === "andamento" && l.t.finalizadaEm) return false;
    if (sit === "finalizou" && !l.t.finalizadaEm) return false;
    if (sit === "revisar" && !l.revisar) return false;
    if (sit === "sinais" && !l.temSinal) return false;
    if (sit === "abaixo" && !(l.t.finalizadaEm && Number(l.nota) < 50)) return false;
    return true;
  });
}
$("#btnCarregarRes").onclick = carregarResultados;
// situação em chips: o <select id="rSituacao"> continua sendo a fonte (fica oculto e sincronizado)
const SITUACOES = [{ v: "", t: "Todos" }, { v: "finalizou", t: "Finalizou", e: "✅" }, { v: "andamento", t: "Em andamento", e: "⏳" }, { v: "revisar", t: "A revisar", e: "🟡" },
  { v: "sinais", t: "Sinais", e: "⚠" }, { v: "abaixo", t: "< 50", e: "🔻" }];
const chipsSituacao = chips($("#rSitChips"), SITUACOES, { aria: "Filtrar alunos por situação",
  aoMudar: v => { $("#rSituacao").value = v; $("#rSituacao").dispatchEvent(new Event("change")); } });
$("#rProva").onchange = () => { pararAoVivo(); resDados = null; $("#resResumo").innerHTML = ""; $("#resTabela").innerHTML = ""; $("#resAcoes").classList.add("oculto"); if ($("#rAoVivo").checked) carregarResultados(); };
$("#rTestes").onchange = () => { if (resDados) desenharResultados(); };
$("#rAoVivo").onchange = () => { if ($("#rAoVivo").checked) carregarResultados(); else pararAoVivo(); };

// cancela todos os listeners do "ao vivo"
function pararAoVivo() {
  ouvintes.forEach(u => u()); ouvintes = [];
  if (ouvinteDetalhe) { ouvinteDetalhe(); ouvinteDetalhe = null; }
  $("#aoVivo").classList.add("oculto");
}

let provaIAPadrao = null;   // prova em que o "Automático ao vivo" já recebeu o padrão da prova (depois vale o que o professor escolher)
async function carregarResultados() {
  pararAoVivo();
  const provaId = $("#rProva").value; if (!provaId) return;
  $("#resTabela").innerHTML = "<p class='pequeno'>Carregando…</p>";
  const prova = { id: provaId, ...(await getDoc(doc(db, "provas", provaId))).data() };
  const { questoes, gabaritos } = await lerBancos(bancosDaProva(prova));
  // turma da prova: lista de e-mails para a seção "Não fizeram"
  let turma = null;
  if (prova.turmaId && !ehInclusao()) { const td = await getDoc(doc(db, "turmas", prova.turmaId)).catch(() => null); if (td?.exists()) turma = { id: td.id, ...td.data() }; }
  // alunos com acessibilidade: as questões deles podem estar em outro formato (gabarito privado)
  const acessEmails = new Set((await getDocs(ehInclusao() ? query(collection(db, "acessibilidade"), where("auxiliares", "array-contains", eu.email)) : collection(db, "acessibilidade")).catch(() => null))?.docs.map(d => d.id) || []);
  resDados = { prova, questoes, gabaritos, turma, acessEmails, linhas: [], testes: [] };
  // 🚩 questões com erro reportado (lembrete no topo e dentro da questão do aluno)
  resDados.gruposRev = podeEditar() ? await lerRevisoes().catch(e => { console.warn("revisões", e); return null; }) : null;
  // correção automática da prova: sem servidor, o painel aberto (ao vivo) faz o papel dele
  if (souDono() && iaCfg && provaIAPadrao !== provaId && $("#rAoVivo").checked) { provaIAPadrao = provaId; $("#iaAuto").checked = prova.iaAutomatica !== false && !urlCorretorCfg; }
  atualizarControlesIA();
  cacheTent.clear(); detalheId = null;
  // auxiliar de inclusão: só as tentativas dos alunos vinculados a ela (lidas pelo id: <uid do aluno>_<prova>)
  if (ehInclusao()) {
    const meus = (await getDocs(query(collection(db, "acessibilidade"), where("auxiliares", "array-contains", eu.email)))).docs.map(d => d.data()).filter(a => a.uid);
    const refs = meus.map(a => doc(db, "tentativas", `${a.uid}_${provaId}`));
    if (!$("#rAoVivo").checked) {
      const ds = await Promise.all(refs.map(r => getDoc(r).catch(() => null)));
      await Promise.all(ds.filter(d => d?.exists()).map(atualizarCache));
      montarResultados(); return;
    }
    $("#aoVivo").classList.remove("oculto");
    refs.forEach(r => ouvintes.push(onSnapshot(r, async d => {
      if (resDados?.prova.id !== provaId) return;
      if (d.exists()) await atualizarCache(d); else cacheTent.delete(d.id);
      montarResultados();
    }, e => console.warn("ao vivo", e))));
    if (!refs.length) montarResultados();
    return;
  }
  const q = query(collection(db, "tentativas"), where("provaId", "==", provaId));
  if (!$("#rAoVivo").checked) {
    const ts = await getDocs(q);
    await Promise.all(ts.docs.map(atualizarCache));
    montarResultados();
    return;
  }
  // ao vivo: a primeira leitura e cada mudança chegam pelo onSnapshot
  $("#aoVivo").classList.remove("oculto");
  ouvintes.push(onSnapshot(q, async snap => {
    if (resDados?.prova.id !== provaId) return;
    await Promise.all(snap.docChanges().map(ch => {
      if (ch.type === "removed") return cacheTent.delete(ch.doc.id);
      // mudou só o placar (gravado por este painel): não precisa reler respostas e correções
      const c = cacheTent.get(ch.doc.id), novo = ch.doc.data();
      if (ch.type === "modified" && c && [...new Set([...Object.keys(c.t), ...Object.keys(novo)])].filter(k => k !== "id")
            .every(k => SO_PLACAR.has(k) || JSON.stringify(c.t[k]) === JSON.stringify(novo[k]))) { c.t = { id: ch.doc.id, ...novo }; return; }
      return atualizarCache(ch.doc);
    }));
    montarResultados();
  }, e => { toast("O acompanhamento ao vivo parou. " + traduzirErro(e), "erro"); $("#rAoVivo").checked = false; pararAoVivo(); }));
}
const SO_PLACAR = new Set(["acertos", "totalQuestoes", "notaPrevia", "aguardandoCorrecao", "nota", "notaMaxima", "corrigidaEm", "corrigidaPor"]);
// lê respostas e correções de uma tentativa e guarda no cache
async function atualizarCache(d) {
  const t = { id: d.id, ...d.data() };
  const [rs, cs] = await Promise.all([getDocs(collection(db, "tentativas", t.id, "respostas")), getDocs(collection(db, "tentativas", t.id, "correcoes"))]);
  const resp = {}; rs.forEach(x => resp[x.id] = x.data()); const corr = {}; cs.forEach(x => corr[x.id] = x.data());
  // questões adaptadas em outro formato: a versão do aluno e o gabarito privado
  const ad = {}, email = String(t.email || "").toLowerCase();
  if (resDados?.acessEmails?.has(email)) await Promise.all((t.questoesIds || []).map(async qid => {
    const a = await getDoc(doc(db, "acessibilidade", email, "questoes", qid)).catch(() => null);
    const base = resDados.questoes[qid];
    if (!a?.exists() || !base) return;
    const q = { ...mesclarQuestao(base, a.data()), id: qid };
    if (!temFormato(q)) return;
    const g = (await getDoc(doc(db, "acessibilidadePrivado", email, "gabaritos", qid)).catch(() => null))?.data() || {};
    ad[qid] = { q, g: { ...g, explicacao: resDados.gabaritos[qid]?.explicacao || "" } };
  }));
  cacheTent.set(t.id, { t, resp, corr, ad });
}
// calcula a linha da tabela (correção, sinais, tempo) de uma tentativa
function linhaDe({ t, resp, corr, ad = {} }) {
  const { prova, questoes, gabaritos } = resDados;
  const itens = t.questoesIds.map((qid, i) => {
    const q = ad[qid]?.q || questoes[qid] || { tipo: "?", enunciado: "(questão removida)", peso: 1 }, g = ad[qid]?.g || gabaritos[qid] || {};
    const r = resp[qid]?.resposta ?? undefined, perdida = resp[qid]?.perdida === true, peso = Number(q.peso || 1);
    let c = corrigir(q, g, r, perdida);
    const porIA = String(corr[qid]?.corrigidoPor || "").startsWith("ia:");
    if (!perdida && corr[qid]?.pontos !== undefined) c = { pontos: Number(corr[qid].pontos), status: Number(corr[qid].pontos) >= peso ? "certa" : Number(corr[qid].pontos) > 0 ? "parcial" : "errada", manual: !porIA, ia: porIA };
    return { n: i + 1, qid, q, g, r, perdida, peso, ...c, comentario: corr[qid]?.comentario || "", segundos: resp[qid]?.segundos,
             temCorrecao: corr[qid]?.pontos !== undefined };
  });
  const max = itens.reduce((s, x) => s + x.peso, 0), pts = itens.reduce((s, x) => s + x.pontos, 0);
  const sinais = sinaisDe(t, prova);
  return { t, itens, max, pts, nota: max ? Math.round(pts / max * 1000) / 10 : 0, revisar: itens.filter(x => x.status === "revisar").length,
           perdidas: itens.filter(x => x.perdida).length, tempo: tempoTotal(t), sinais, temSinal: sinais.total > 0,
           rapidas: itens.filter(x => x.r !== undefined && !x.perdida && typeof x.segundos === "number" && x.segundos < RAPIDO).length };
}
function montarResultados() {
  const todas = [...cacheTent.values()].map(linhaDe).sort((a, b) => (a.t.nome || a.t.email).localeCompare(b.t.nome || b.t.email));
  // tentativas do modo teste (equipe) ficam à parte: nunca entram em média, CSV, PDFs nem "Fechar notas"
  resDados.linhas = todas.filter(l => l.t.teste !== true);
  resDados.testes = todas.filter(l => l.t.teste === true);
  desenharResultados();
  desenharFaixaRevisoes();
  gravarPlacares(todas);
  cobrarAusentes(todas);
  if ($("#iaAuto").checked && $("#rAoVivo").checked) agendarAutoIA();
}
// ⚠ faixa no topo: questões desta prova com erro reportado ainda sem decisão (abre o mesmo cartão da tela Erros e sugestões)
function desenharFaixaRevisoes() {
  if (!$("#resRevisoes")) $("#resTabela").insertAdjacentHTML("beforebegin", `<div id="resRevisoes"></div>`);
  resDados.revMap = revisoesDaProva(resDados.gruposRev, resDados.linhas.map(l => l.t));
  $("#resRevisoes").innerHTML = faixaRevisoesHTML(resDados.revMap);
  ligarRevisar($("#resRevisoes"));
}
function ligarRevisar(box) {
  box.querySelectorAll("[data-revisar]").forEach(b => b.onclick = () => {
    const g = resDados.gruposRev?.get(b.dataset.revisar);
    if (g) abrirRevisao(g, () => carregarResultados());
  });
}
// automático: junta as provas entregues nos últimos 20 s e corrige em lote, sem janelas nem avisos (só a linha da barra da IA)
let timerAutoIA = null;
function agendarAutoIA() {
  if (timerAutoIA || !pendentesIA().some(it => !tentadasAutoIA.has(it.tid + "/" + it.qid))) return;
  timerAutoIA = setTimeout(() => { timerAutoIA = null; if ($("#iaAuto").checked && $("#rAoVivo").checked) corrigirPendentesIA({ auto: true }); }, 20000);
}

// Grava na tentativa o placar que o aluno vê (acertos, nota, pendentes), com as correções manuais e da IA.
// Só grava o que mudou; a tela final do aluno escuta a tentativa e atualiza sozinha.
async function gravarPlacares(linhas) {
  if (!podeEditar()) return;
  const mudar = linhas.filter(l => l.t.finalizadaEm).map(l => {
    const p = placar(l.itens);
    // nota já fechada e corrigida depois (IA ou manual): a nota fechada acompanha a correção
    if (l.t.nota !== undefined && l.t.nota !== p.notaPrevia) p.nota = p.notaPrevia;
    return { l, p };
  }).filter(({ l, p }) => Object.keys(p).some(k => l.t[k] !== p[k]));
  if (!mudar.length) return;
  try {
    for (let i = 0; i < mudar.length; i += 400) {
      const lote = writeBatch(db);
      mudar.slice(i, i + 400).forEach(({ l, p }) => lote.update(doc(db, "tentativas", l.t.id), p));
      await lote.commit();
    }
    mudar.forEach(({ l, p }) => { Object.assign(l.t, p); const c = cacheTent.get(l.t.id); if (c) Object.assign(c.t, p); });
  } catch (e) { console.warn("não gravou o placar dos alunos", e); }
}

// ============================================================ VIDAS (por aluno)
// vidas do aluno nesta prova: limite da prova + vidas extras dadas pelo professor − vidas perdidas (trocasDeAba)
function vidasDe(t) {
  const base = limiteSaidas(resDados.prova);
  if (!base || resDados.acessEmails?.has(String(t.email || "").toLowerCase())) return null;   // acessibilidade: sem vidas
  const extras = Math.max(0, Number(t.vidasExtras || 0)), lim = base + extras, usadas = Math.min(lim, t.trocasDeAba || 0);
  return { base, extras, lim, usadas, restam: lim - usadas };
}
function coracoesHTML(v) {
  if (!v) return "";
  const max = Math.min(v.lim, 12);
  return `<span class="coracoes" title="${v.restam} de ${v.lim} vidas${v.extras ? ` (${v.extras} extra)` : ""}">` +
    Array.from({ length: max }, (_, k) => `<span class="${k < v.restam ? "" : "apagado"}">${k < v.restam ? "❤️" : "🖤"}</span>`).join("") +
    `${v.lim > max ? ` <b>${v.restam}/${v.lim}</b>` : ""}</span>`;
}
// coluna "Sinais · vidas" da tabela: corações + quantas vezes o professor restaurou
// as mesmas ações em botões, no detalhe do aluno
function acoesVidaHTML(l) {
  if (!podeCuidar()) return "";
  const v = vidasDe(l.t), b = [];
  if (!l.t.finalizadaEm) {
    if (v) b.push(`<button class="ok mini" data-vrest="${l.t.id}" title="Devolve todas as vidas${l.perdidas ? " e as questões perdidas" : ""}"${v.usadas || l.perdidas ? "" : " disabled"}>${ic("heart", { size: 16 })}Restaurar vidas</button>`,
                  `<button class="leve mini" data-vmais="${l.t.id}" title="Reacende um coração perdido; com todos cheios, dá uma vida a mais">${ic("plus", { size: 16 })}1 vida</button>`,
                  `<button class="leve mini" data-vmenos="${l.t.id}" title="${v.restam > 1 ? "Tira uma vida deste aluno" : "Resta só 1 vida: use Encerrar prova"}"${v.restam > 1 ? "" : " disabled"}>− 1 vida</button>`);
    if (Number(resDados.prova.tempoMinutos) > 0) b.push(`<button class="leve mini" data-tempo="${l.t.id}" title="Dá mais minutos só para este aluno (ex.: caiu a internet)">⏱ + tempo</button>`);
    if (l.t.sessao) b.push(`<button class="leve mini" data-liblogin="${l.t.id}" title="O aluno trocou de computador? Libera para ele abrir a prova em outro (o computador antigo deixa de valer)">🔑 Liberar login</button>`);
    b.push(`<button class="perigo mini" data-barrar="${l.t.id}" title="Encerra a prova deste aluno e impede que ele abra de novo">🚫 Barrar</button>`);
    b.push(`<button class="perigo mini" data-encerrar="${l.t.id}" title="Encerra a prova só deste aluno, com as respostas já enviadas">⛔ Encerrar prova</button>`);
  } else b.push(`<button class="leve mini" data-reabrir="${l.t.id}" title="Volta a prova para o aluno continuar de onde parou">${ic("unlock", { size: 16 })}Reabrir prova</button>`);
  if (l.sinais.total || l.sinais.abas) b.push(`<button class="leve mini" data-sinais="${l.t.id}" title="Apaga sinais registrados por engano (aba, tela cheia, colar), sem mexer nas respostas">🧹 Apagar sinais</button>`);
  return b.join(" ");
}
// ações de vidas no menu ⋯ da linha (mesmos data-*: ligarAcoesVida cuida dos cliques)
const itemSinais = l => l.sinais.total || l.sinais.abas ? itemMenu({ i: "x", t: "Apagar sinais", attrs: `data-sinais="${l.t.id}" title="Apaga sinais registrados por engano, sem mexer nas respostas"` }) : "";
function acoesVidaItens(l) {
  if (!podeCuidar()) return "";
  const v = vidasDe(l.t);
  if (l.t.finalizadaEm) return itemMenu({ i: "unlock", t: "Reabrir prova", attrs: `data-reabrir="${l.t.id}" title="Volta a prova para o aluno continuar de onde parou"` })
    + itemSinais(l);
  const extrasEntrada = (l.t.sessao ? itemMenu({ i: "unlock", t: "Liberar login", attrs: `data-liblogin="${l.t.id}" title="Libera o aluno para abrir a prova em outro computador"` }) : "")
    + itemMenu({ i: "lock", t: "Barrar aluno", attrs: `data-barrar="${l.t.id}" title="Encerra a prova deste aluno e impede que ele abra de novo"` });
  const encerrar = extrasEntrada + itemMenu({ i: "lock", t: "Encerrar prova", attrs: `data-encerrar="${l.t.id}" title="Encerra a prova só deste aluno, com as respostas já enviadas"` });
  const tempo = Number(resDados.prova.tempoMinutos) > 0 ? itemMenu({ i: "plus", t: "+ tempo", attrs: `data-tempo="${l.t.id}" title="Dá mais minutos só para este aluno"` }) : "";
  if (!v) return tempo + encerrar + itemSinais(l);
  return itemMenu({ i: "heart", t: "Restaurar vidas", attrs: `data-vrest="${l.t.id}" title="Devolve todas as vidas${l.perdidas ? " e as questões perdidas" : ""}"${v.usadas || l.perdidas ? "" : " disabled"}` })
    + itemMenu({ i: "plus", t: "+1 vida", attrs: `data-vmais="${l.t.id}" title="Reacende um coração perdido; com todos cheios, dá uma vida a mais"` })
    + itemMenu({ i: "x", t: "−1 vida", attrs: `data-vmenos="${l.t.id}" title="${v.restam > 1 ? "Tira uma vida deste aluno" : "Resta só 1 vida: use Encerrar prova"}"${v.restam > 1 ? "" : " disabled"}` })
    + tempo + encerrar + itemSinais(l);
}
function ligarAcoesVida(raiz) {
  const achar = id => [...resDados.linhas, ...resDados.testes].find(x => x.t.id === id);
  raiz.querySelectorAll("[data-vrest]").forEach(b => b.onclick = () => restaurarVidas(achar(b.dataset.vrest)));
  raiz.querySelectorAll("[data-vmais]").forEach(b => b.onclick = () => vidaExtra(achar(b.dataset.vmais)));
  raiz.querySelectorAll("[data-vmenos]").forEach(b => b.onclick = () => tirarVida(achar(b.dataset.vmenos)));
  raiz.querySelectorAll("[data-encerrar]").forEach(b => b.onclick = () => encerrarProvas([achar(b.dataset.encerrar)]));
  raiz.querySelectorAll("[data-reabrir]").forEach(b => b.onclick = () => reabrirProva(achar(b.dataset.reabrir)));
  raiz.querySelectorAll("[data-tempo]").forEach(b => b.onclick = () => maisTempo(achar(b.dataset.tempo)));
  raiz.querySelectorAll("[data-sinais]").forEach(b => b.onclick = () => apagarSinais(achar(b.dataset.sinais)));
  raiz.querySelectorAll("[data-liblogin]").forEach(b => b.onclick = () => liberarLogin(achar(b.dataset.liblogin)));
  raiz.querySelectorAll("[data-barrar]").forEach(b => b.onclick = () => barrarAluno(achar(b.dataset.barrar)));
}
// questões perdidas por sair da prova (respostas com perdida: true): o professor pode devolver
const perdidasDe = id => Object.entries(cacheTent.get(id)?.resp || {}).filter(([, r]) => r?.perdida === true).map(([q]) => q);
// apagar respostas é só do administrador nas regras: os outros papéis devolvem as vidas sem mexer nas perdidas
function lotePerdidas(lote, id) { if (ehAdmin()) perdidasDe(id).forEach(q => lote.delete(doc(db, "tentativas", id, "respostas", q))); }
// relê uma tentativa (sem o "ao vivo", a tela não atualiza sozinha)
async function recarregarTentativa(id) {
  if ($("#rAoVivo").checked) return;
  const d = await getDoc(doc(db, "tentativas", id));
  if (d.exists()) await atualizarCache(d); else cacheTent.delete(id);
  montarResultados();
}
// ============================================================ ENTRADA NA PROVA (barrar, fechar, liberar login)
// sessão única: a tentativa guarda o computador do aluno (sessao). "Liberar login" apaga e ele pode abrir em outro.
async function liberarLogin(l) {
  if (!l) return;
  const nome = l.t.nome || l.t.email;
  if (!(await confirmar(`Liberar ${nome} para abrir a prova em OUTRO computador?\n\nO computador de agora deixa de valer: o próximo que abrir a prova fica com ela.`, { titulo: "🔑 Liberar login", ok: "Liberar" }))) return;
  try { await updateDoc(doc(db, "tentativas", l.t.id), { sessao: deleteField() }); toast(`${nome} pode entrar em outro computador.`, "ok"); await recarregarTentativa(l.t.id); }
  catch (e) { toast("Não foi possível liberar. " + traduzirErro(e), "erro"); console.error(e); }
}
// barrar: o e-mail entra em prova.bloqueados (as regras não deixam começar) e, se já começou, a prova dele é encerrada
async function barrarAluno(l, email = null) {
  const em = String(email || l?.t?.email || "").toLowerCase(), nome = l?.t?.nome || em;
  if (!em || !resDados) return;
  const andando = l && !l.t.finalizadaEm;
  if (!(await confirmar(`Barrar ${nome} nesta prova?\n\n${andando ? "A prova dele é ENCERRADA agora, com as respostas já enviadas, e " : ""}ele não consegue abrir a prova de novo. Dá para desfazer em "Entrada na prova".`, { titulo: "🚫 Barrar aluno", ok: "Barrar", perigo: true }))) return;
  try {
    await updateDoc(doc(db, "provas", resDados.prova.id), { bloqueados: arrayUnion(em) });
    resDados.prova.bloqueados = [...new Set([...(resDados.prova.bloqueados || []), em])];
    if (andando) await updateDoc(doc(db, "tentativas", l.t.id), { finalizadaEm: serverTimestamp(), encerradaPor: "barrado" });
    toast(`${nome} foi barrado nesta prova.`, "ok");
    if (l) await recarregarTentativa(l.t.id); else desenharResultados();
  } catch (e) { toast("Não foi possível barrar. " + traduzirErro(e), "erro"); console.error(e); }
}
async function mudarEntrada(dados, msg) {
  try {
    await updateDoc(doc(db, "provas", resDados.prova.id), dados);
    const p = (await getDoc(doc(db, "provas", resDados.prova.id))).data();
    ["bloqueados", "liberadosEntrada", "entradaFechada", "entradaAte"].forEach(k => { resDados.prova[k] = p[k]; });
    toast(msg, "ok"); desenharResultados();
  } catch (e) { toast("Não foi possível mudar a entrada. " + traduzirErro(e), "erro"); console.error(e); }
}
function entradaFechadaAgora(p) { return p.entradaFechada === true || (p.entradaAte?.toMillis && Date.now() >= p.entradaAte.toMillis()); }
function entradaHTML() {
  if (!podeCuidar() || !resDados?.prova || ehInclusao()) return "";
  const p = resDados.prova, fechada = entradaFechadaAgora(p), blo = p.bloqueados || [], lib = p.liberadosEntrada || [];
  const nomeDe = em => alunosDaTurma(resDados.turma || { alunos: [] }).find(a => a.email === em)?.nome || em;
  const ate = p.entradaAte?.toDate ? p.entradaAte.toDate().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  return `<div class="card secao-entrada"><h2>🚪 Entrada na prova <span class="meta-txt">${fechada ? "<b>fechada</b>: ninguém mais começa" : "aberta"}${ate ? ` · fecha às ${ate}` : ""}</span></h2>
    <p class="pequeno">Quem já começou continua normalmente. Barrado não abre a prova; atrasado só entra se você deixar.</p>
    <div class="linha-botoes">${fechada ? `<button class="leve mini" data-entrada="abrir">🔓 Reabrir entrada</button>` : `<button class="perigo mini" data-entrada="fechar">🔒 Fechar entrada agora</button>`}</div>
    ${blo.length ? `<p class="pequeno" style="margin-top:8px"><b>Barrados:</b> ${blo.map(em => `${esc(nomeDe(em))} <button class="leve mini" data-desbarrar="${esc(em)}">desfazer</button>`).join(" · ")}</p>` : ""}
    ${lib.length ? `<p class="pequeno"><b>Podem entrar mesmo com a entrada fechada:</b> ${lib.map(em => `${esc(nomeDe(em))} <button class="leve mini" data-tirarlib="${esc(em)}">tirar</button>`).join(" · ")}</p>` : ""}</div>`;
}
function ligarEntrada(raiz) {
  raiz.querySelectorAll("[data-entrada]").forEach(b => b.onclick = async () => {
    if (b.dataset.entrada === "fechar") {
      if (!(await confirmar("Fechar a entrada agora? Quem ainda não começou não consegue mais começar (você pode deixar um atrasado entrar pela lista \"Não fizeram\").", { titulo: "🔒 Fechar entrada", ok: "Fechar entrada" }))) return;
      mudarEntrada({ entradaFechada: true }, "Entrada fechada 🔒");
    } else mudarEntrada({ entradaFechada: false, entradaAte: null }, "Entrada reaberta 🔓");
  });
  raiz.querySelectorAll("[data-desbarrar]").forEach(b => b.onclick = () => mudarEntrada({ bloqueados: arrayRemove(b.dataset.desbarrar) }, "Aluno liberado de novo."));
  raiz.querySelectorAll("[data-tirarlib]").forEach(b => b.onclick = () => mudarEntrada({ liberadosEntrada: arrayRemove(b.dataset.tirarlib) }, "Pronto."));
  raiz.querySelectorAll("[data-barraremail]").forEach(b => b.onclick = () => barrarAluno(null, b.dataset.barraremail));
  raiz.querySelectorAll("[data-deixarentrar]").forEach(b => b.onclick = () => mudarEntrada({ liberadosEntrada: arrayUnion(b.dataset.deixarentrar), bloqueados: arrayRemove(b.dataset.deixarentrar) }, "Pode entrar ✅"));
}
// TIMER DE VOLTA: aluno fora da prova (foraDesde) perde 1 vida a cada prova.segundosVolta s. Quem estiver com o painel
// aberto cobra também (além da página do aluno e do servidor de 1 em 1 min), sempre pela mesma conta, em transação.
const cobrando = new Set();
async function cobrarAusentes(linhas) {
  const p = resDados?.prova, n = Number(p?.segundosVolta ?? 5);
  if (!podeCuidar() || !p || !(n > 0) || p.permitirTrocaAba) return;
  for (const l of linhas) {
    const t = l.t, ms = t.foraDesde?.toMillis?.();
    if (t.finalizadaEm || !ms || t.teste || cobrando.has(t.id)) continue;
    if (Math.floor((Date.now() - ms) / 1000 / n) <= Number(t.foraCobradas || 0)) continue;
    cobrando.add(t.id);
    runTransaction(db, async tx => {
      const ref = doc(db, "tentativas", t.id), d = (await tx.get(ref)).data();
      const ini = d?.foraDesde?.toMillis?.();
      if (!d || d.finalizadaEm || !ini) return;
      const dev = Math.floor((Date.now() - ini) / 1000 / n), ja = Number(d.foraCobradas || 0);
      if (dev > ja) tx.update(ref, { foraCobradas: dev, trocasDeAba: increment(dev - ja) });
    }).catch(e => console.warn("timer de volta", e)).finally(() => cobrando.delete(t.id));
  }
}
setInterval(() => { if (resDados && $("#rAoVivo").checked) cobrarAusentes(resDados.linhas); }, 5000);
async function restaurarVidas(l) {
  if (!l) return;
  const v = vidasDe(l.t), perd = ehAdmin() ? perdidasDe(l.t.id) : [], nome = l.t.nome || l.t.email;
  const ok = await confirmar(`Devolver ${v ? `as ${v.lim} vidas` : "as vidas"} de ${nome}?${perd.length ? `\n\nAs ${perd.length} questão(ões) perdida(s) por sair da prova também voltam para o aluno responder.` : ""}\n\nA tela do aluno atualiza sozinha. O histórico de saídas continua no relatório.`,
    { titulo: "❤️ Restaurar vidas", ok: "Restaurar vidas" });
  if (!ok) return;
  try {
    const lote = writeBatch(db), n = l.t.trocasDeAba || 0;
    lote.update(doc(db, "tentativas", l.t.id), { trocasDeAba: 0, trocasDeAbaTotal: increment(n), vidasRestauradas: increment(1),
      vidasRestauradasEm: serverTimestamp(), vidasRestauradasPor: eu.email });
    lotePerdidas(lote, l.t.id);
    await lote.commit();
    toast(`Vidas de ${nome} restauradas ❤️`, "ok");
    await recarregarTentativa(l.t.id);
  } catch (e) { toast("Não foi possível restaurar as vidas. " + traduzirErro(e), "erro"); console.error(e); }
}
// mais minutos só para este aluno (ex.: caiu a internet). A tela dele atualiza o cronômetro sozinha.
async function maisTempo(l) {
  if (!l || l.t.finalizadaEm) return;
  const nome = l.t.nome || l.t.email, ja = Number(l.t.minutosExtras || 0);
  let min = 10;
  const ok = await modal({
    titulo: `⏱ Mais tempo para ${nome}`, ok: "Dar mais tempo", cancelar: "Cancelar",
    conteudo: `<label for="mtMin">Minutos a mais</label><input type="number" id="mtMin" min="1" max="240" step="1" value="10">
      <p class="pequeno">${ja ? `Já recebeu ${ja} min a mais. ` : ""}O cronômetro do aluno atualiza sozinho. Se o tempo dele já acabou e a prova foi finalizada, use <b>Reabrir prova</b>.</p>`,
    antesDeConfirmar: caixa => {
      const v = Math.round(Number(caixa.querySelector("#mtMin")?.value || 0));
      if (!(v >= 1 && v <= 240)) { toast("Escolha de 1 a 240 minutos.", "erro"); return false; }
      min = v;
    }
  });
  if (!ok) return;
  try {
    await updateDoc(doc(db, "tentativas", l.t.id), { minutosExtras: increment(min) });
    toast(`+${min} min para ${nome} ⏱`, "ok");
    await recarregarTentativa(l.t.id);
  } catch (e) { toast("Não foi possível dar mais tempo. " + traduzirErro(e), "erro"); console.error(e); }
}
// +1 vida: primeiro reacende um coração perdido; com todos cheios, dá uma vida a mais (aumenta o total).
// O coração reacendido continua no histórico (soma em trocasDeAbaTotal), como no Restaurar vidas.
async function vidaExtra(l) {
  if (!l) return;
  const v = vidasDe(l.t), nome = l.t.nome || l.t.email, reacender = !!v && v.usadas > 0 && (l.t.trocasDeAba || 0) > 0;
  try {
    await updateDoc(doc(db, "tentativas", l.t.id), reacender ? { trocasDeAba: increment(-1), trocasDeAbaTotal: increment(1) } : { vidasExtras: increment(1) });
    toast(reacender ? `+1 vida para ${nome}: ${v.restam + 1} de ${v.lim} ❤️` : `+1 vida extra para ${nome}: ${v ? `${v.lim + 1} vidas` : "1 vida"} ❤️`, "ok");
    await recarregarTentativa(l.t.id);
  } catch (e) { toast("Não foi possível dar a vida. " + traduzirErro(e), "erro"); console.error(e); }
}
// tira uma vida: primeiro as extras que o professor deu; depois conta como uma saída (o coração apaga na tela do aluno).
// A última vida não é tirada por aqui: zerar sem encerrar deixaria o aluno na prova sem vidas (use Encerrar prova).
async function tirarVida(l) {
  if (!l) return;
  const v = vidasDe(l.t), nome = l.t.nome || l.t.email;
  if (!v || v.restam <= 1) return toast("Resta só 1 vida. Para tirar a prova do aluno, use Encerrar prova.", "erro");
  if (!(await confirmar(`Tirar 1 vida de ${nome}? Fica com ${v.restam - 1} de ${v.lim - (v.extras ? 1 : 0)}.`, { titulo: "Tirar 1 vida", ok: "Tirar vida", perigo: true }))) return;
  try {
    await updateDoc(doc(db, "tentativas", l.t.id), v.extras ? { vidasExtras: increment(-1) } : { trocasDeAba: increment(1) });
    toast(`−1 vida para ${nome}`, "ok");
    await recarregarTentativa(l.t.id);
  } catch (e) { toast("Não foi possível tirar a vida. " + traduzirErro(e), "erro"); console.error(e); }
}
// encerra a prova de um ou mais alunos (as respostas já enviadas valem; as outras ficam em branco).
// Grava como se o aluno tivesse finalizado: a partir daí as regras não aceitam mais respostas dele.
async function encerrarProvas(ls, { todos = false } = {}) {
  ls = ls.filter(l => l && !l.t.finalizadaEm);
  if (!ls.length) return toast("Nenhum aluno com a prova em andamento.", "erro");
  const p = resDados.prova, nomes = ls.map(l => l.t.nome || l.t.email);
  let fecharProva = false;
  const ok = await modal({
    titulo: todos ? `⛔ Encerrar a prova de todos (${ls.length})` : `⛔ Encerrar a prova de ${nomes[0]}`, ok: "Encerrar", cancelar: "Cancelar", perigo: true,
    conteudo: `<p>${todos ? `Os <b>${ls.length} alunos</b> com a prova em andamento terminam agora` : `<b>${esc(nomes[0])}</b> termina agora`}: valem as respostas já enviadas, as outras ficam em branco.</p>
      <p class="pequeno">Se a tela do aluno ainda mostrar a questão, ao tentar enviar ou finalizar ela passa para o fim da prova. Dá para desfazer com <b>Reabrir prova</b>.</p>
      ${todos && p.liberada ? `<label class="check"><input type="checkbox" id="encFechar" checked> Fechar a prova também (ninguém mais começa)</label>` : ""}`,
    antesDeConfirmar: caixa => { fecharProva = !!caixa.querySelector("#encFechar")?.checked; }
  });
  if (!ok) return;
  try {
    for (let i = 0; i < ls.length; i += 400) {
      const lote = writeBatch(db);
      ls.slice(i, i + 400).forEach(l => {
        const dados = { finalizadaEm: serverTimestamp(), encerradaPor: "professor", indiceAtual: (l.t.questoesIds || []).length };
        const ini = l.t.iniciadaEm?.toMillis?.();
        if (ini) dados.tempoTotalSegundos = Math.max(0, Math.round((Date.now() - ini) / 1000));
        lote.update(doc(db, "tentativas", l.t.id), dados);
      });
      await lote.commit();
    }
    if (fecharProva) await updateDoc(doc(db, "provas", p.id), { liberada: false }).then(() => { p.liberada = false; })
      .catch(e => toast("As provas foram encerradas, mas não deu para fechar a prova. Feche na aba Provas. " + traduzirErro(e), "erro"));
    toast(ls.length === 1 ? `Prova de ${nomes[0]} encerrada` : `${ls.length} provas encerradas`, "ok");
    if (!$("#rAoVivo").checked) carregarResultados();
  } catch (e) { toast("Não foi possível encerrar. " + traduzirErro(e), "erro"); console.error(e); }
}
// apaga sinais registrados por engano (ex.: o carregador caiu no ESC), durante ou depois da prova, sem mexer nas respostas.
// Some do relatório, do chip "Sinais" e das conquistas do aluno, como se não tivesse acontecido.
// Vidas perdidas (trocas de aba e saídas da tela cheia contam vida): apagar devolve as vidas. Com a prova em andamento,
// a tela do aluno atualiza sozinha; se a prova foi encerrada porque as vidas acabaram, ela continua encerrada (use Reabrir prova).
async function apagarSinais(l) {
  if (!l) return;
  const nome = l.t.nome || l.t.email, s = l.sinais;
  const tipos = [
    { k: "abas", n: s.abasPermitido ? 0 : s.abas, rot: "🔀 Vidas perdidas (troca de aba/janela ou saída da tela cheia)" },
    { k: "tela", n: s.telaCheia, rot: "⛶ Saídas da tela cheia (registro)" },
    { k: "colar", n: s.colar, rot: "📋 Tentativas de colar" }
  ].filter(x => x.n > 0);
  if (!tipos.length) return toast(`${nome} não tem sinais nesta prova.`, "ok");
  const escolha = {};
  const ok = await modal({
    titulo: `🧹 Apagar sinais de ${nome}`, ok: "Apagar", cancelar: "Cancelar",
    conteudo: `<p>Os sinais apagados somem do histórico, como se não tivessem acontecido. As respostas e a nota não mudam.</p>
      ${tipos.map(x => `<label for="as_${x.k}" style="margin-top:10px">${x.rot}: <b>${x.n}</b>. Quantos apagar</label><input type="number" id="as_${x.k}" min="0" max="${x.n}" step="1" value="${x.n}">`).join("")}
      ${!l.t.finalizadaEm && tipos.some(x => x.k === "abas") ? `<p class="pequeno">A prova está em andamento: apagar vidas perdidas devolve as vidas ao aluno (a tela dele atualiza sozinha).</p>` : ""}
      ${l.t.encerradaPor === "trocasDeAba" ? `<div class="aviso-box erro" style="margin-top:12px">A prova foi <b>encerrada porque as vidas acabaram</b>. Apagar os sinais não reabre a prova: para o aluno continuar, use <b>Reabrir prova</b>.</div>` : ""}`,
    antesDeConfirmar: caixa => {
      for (const x of tipos) {
        const v = Math.round(Number(caixa.querySelector("#as_" + x.k)?.value ?? x.n));
        if (!(v >= 0 && v <= x.n)) { toast(`Escolha de 0 a ${x.n}.`, "erro"); return false; }
        escolha[x.k] = v;
      }
      if (!Object.values(escolha).some(Boolean)) { toast("Escolha pelo menos 1 sinal para apagar.", "erro"); return false; }
    }
  });
  if (!ok) return;
  const dados = {};
  if (escolha.abas) {   // tira primeiro do contador atual e depois do acumulado (o que foi zerado ao perder questão ou restaurar)
    const atual = l.t.trocasDeAba || 0, doAtual = Math.min(atual, escolha.abas), doAcum = escolha.abas - doAtual;
    dados.trocasDeAba = atual - doAtual;
    if (doAcum) dados.trocasDeAbaTotal = Math.max(0, (l.t.trocasDeAbaTotal || 0) - doAcum);
  }
  if (escolha.tela) dados.saidasTelaCheia = Math.max(0, (l.t.saidasTelaCheia || 0) - escolha.tela);
  if (escolha.colar) dados.tentativasColar = Math.max(0, (l.t.tentativasColar || 0) - escolha.colar);
  try {
    await updateDoc(doc(db, "tentativas", l.t.id), dados);
    toast(`Sinais de ${nome} apagados 🧹`, "ok");
    await recarregarTentativa(l.t.id);
  } catch (e) { toast("Não foi possível apagar os sinais. " + traduzirErro(e), "erro"); console.error(e); }
}
async function reabrirProva(l) {
  if (!l) return;
  const p = resDados.prova, nome = l.t.nome || l.t.email, perd = ehAdmin() ? perdidasDe(l.t.id) : [], temTempo = Number(p.tempoMinutos) > 0;
  const motivo = l.t.encerradaPor === "trocasDeAba" ? "A prova foi encerrada porque as vidas acabaram."
    : l.t.encerradaPor === "professor" ? "A prova foi encerrada pelo professor."
    : l.t.encerradaPor === "aluno" ? "O próprio aluno encerrou a prova com questões em branco." : "O aluno já tinha finalizado a prova (ou o tempo acabou).";
  let devolver = true, min = 10;
  const ok = await modal({
    titulo: `↩ Reabrir a prova de ${nome}`, ok: "Reabrir prova", cancelar: "Cancelar",
    conteudo: `<p>${esc(motivo)} Reabrindo, o aluno <b>continua de onde parou</b>, com as respostas já enviadas, e recebe as vidas de volta. Se a tela dele estiver no fim da prova, é só abrir a prova de novo e clicar em Continuar.</p>
      ${perd.length ? `<label class="check"><input type="checkbox" id="rbPerdidas" checked> Devolver as ${perd.length} questão(ões) perdida(s) por sair da prova</label>` : ""}
      ${temTempo ? `<label for="rbMin" style="margin-top:12px">Tempo para terminar, a partir de agora (min)</label><input type="number" id="rbMin" min="1" step="1" value="${Math.max(5, Math.min(Number(p.tempoMinutos), 30))}">` : ""}
      ${p.liberada ? "" : `<div class="aviso-box erro" style="margin-top:12px">A prova está <b>fechada</b> na aba Provas: o aluno só consegue continuar depois que você liberar de novo.</div>`}
      ${l.t.encerradaPor ? "" : `<p class="pequeno">Atenção: depois de finalizar, o sistema libera o gabarito para o aluno ler. Ao reabrir, o gabarito volta a ficar fechado, mas use isto só quando fizer sentido (ex.: aluno com TEA, queda de internet).</p>`}`,
    antesDeConfirmar: caixa => {
      devolver = caixa.querySelector("#rbPerdidas")?.checked !== false;
      min = Math.max(1, Math.round(Number(caixa.querySelector("#rbMin")?.value || 10)));
    }
  });
  if (!ok) return;
  try {
    const dados = { finalizadaEm: null, encerradaPor: deleteField(), indiceAtual: 0, trocasDeAba: 0, trocasDeAbaTotal: increment(l.t.trocasDeAba || 0),
      tempoTotalSegundos: deleteField(), acertos: deleteField(), totalQuestoes: deleteField(), nota: deleteField(), notaPrevia: null, aguardandoCorrecao: 0,
      reabertaEm: serverTimestamp(), reabertaPor: eu.email, vidasRestauradasEm: serverTimestamp(), vidasRestauradasPor: eu.email };
    if (temTempo) {
      const ini = l.t.iniciadaEm?.toMillis?.() || Date.now(), fimNovo = Date.now() + min * 60000;
      dados.minutosExtras = Math.max(0, Math.ceil((fimNovo - ini) / 60000) - Number(p.tempoMinutos));
    }
    const lote = writeBatch(db);
    lote.update(doc(db, "tentativas", l.t.id), dados);
    if (devolver) lotePerdidas(lote, l.t.id);
    await lote.commit();
    // o gabarito volta a ficar fechado (um por vez: marcador que não existe não derruba a reabertura)
    await Promise.allSettled((l.t.questoesIds || []).map(q => deleteDoc(doc(db, "marcadores", `${l.t.uid}_${q}`))));
    toast(`Prova de ${nome} reaberta ↩`, "ok");
    await recarregarTentativa(l.t.id);
  } catch (e) { toast("Não foi possível reabrir a prova. " + traduzirErro(e), "erro"); console.error(e); }
}

// ---------- visão em cartões: um cartão por aluno (bom para acompanhar a prova ao vivo) ----------
// situação do aluno na tabela: um chip só, o que mais pede atenção
function chipSituacao(l) {
  if (l.t.encerradaPor === "trocasDeAba") return `<span class="chip err"><span class="e" aria-hidden="true">⛔</span>Sem vidas</span>`;
  if (!l.t.finalizadaEm) return `<span class="chip info"><span class="e" aria-hidden="true">⏳</span>Em andamento</span>`;
  if (l.temSinal) return `<span class="chip err"><span class="e" aria-hidden="true">⚠</span>Sinais</span>`;
  if (l.revisar) return `<span class="chip warn"><span class="e" aria-hidden="true">🟡</span>A revisar${l.revisar > 1 ? ` · ${l.revisar}` : ""}</span>`;
  return `<span class="chip ok"><span class="e" aria-hidden="true">✅</span>Finalizou</span>`;
}
// o que importa acompanhar ao vivo fica logo abaixo do chip: vidas, sinais, perdidas e respostas rápidas
function extrasSituacao(l) {
  const v = vidasDe(l.t), x = [];
  if (v && !l.t.finalizadaEm) x.push(coracoesHTML(v));
  if (l.temSinal) x.push(sinaisHTML(l.sinais));
  if (l.perdidas) x.push(`<span>${pl(l.perdidas, "perdida")}</span>`);
  if (l.rapidas) x.push(`<span title="Respostas enviadas em menos de ${RAPIDO} segundos">${pl(l.rapidas, "rápida")}</span>`);
  if (l.t.vidasRestauradas) x.push(`<span title="Vezes que o professor restaurou as vidas">${pl(l.t.vidasRestauradas, "restauração", "restaurações")}</span>`);
  return x.length ? `<div class="res-extra">${x.join("")}</div>` : "";
}
function tabelaHTML(lista, prefixo) {
  return `<div class="tabela sem-borda tabela-alunos"><table><thead><tr><th>Aluno</th><th>Situação</th><th>Acertos</th><th>Nota</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>` +
    lista.map(l => {
      const acertos = l.itens.filter(x => x.status === "certa" || Number(x.pontos) > Number(x.peso || 1) / 2).length, itens = acoesVidaItens(l) + (ehAdmin() && prefixo === "aluno" ? "<hr>" + itemMenu({ i: "trash", t: "Apagar tentativa", perigo: true, attrs: `data-reset="${l.t.id}" title="Apagar a tentativa (o aluno pode refazer)"` }) : "");
      const fechada = l.t.nota !== undefined ? `fechada: ${l.t.nota}` : l.t.notaPrevia !== null && l.t.notaPrevia !== undefined ? `prévia: ${l.t.notaPrevia}` : "";
      const obsAda = l.t.obsAcessibilidade?.adaptacoes?.length;
      return `<tr><td><span class="aluno-celula"><span class="avatar-p">${esc(iniciais(l.t.nome || l.t.email))}</span><span class="ac-texto"><b>${esc(l.t.nome || l.t.email)}</b><span>${esc(l.t.email)}</span>${obsAda ? ` <span class="tag nota" title="${obsAda} adaptação(ões) registrada(s)">♿</span>` : ""}</span></span></td>
      <td>${chipSituacao(l)}${extrasSituacao(l)}</td>
      <td class="res-acertos" title="Início: ${esc(dataBR(l.t.iniciadaEm))} · tempo: ${esc(fmtTempo(l.tempo))}">${acertos} de ${l.itens.length}</td>
      <td><span class="res-nota ${l.nota >= 60 ? "boa" : "baixa"}"${fechada ? ` title="${esc(fechada)}"` : ""}>${String(l.nota).replace(".", ",")}</span>${textoConvertida(resDados.prova, l.t.email, l.nota) ? `<br><span class="pequeno" title="${tipoRec(resDados.prova, l.t.email)}: nota final">→ <b>${textoConvertida(resDados.prova, l.t.email, l.nota)}</b> (${tipoRec(resDados.prova, l.t.email)})</span>` : ""}</td>
      <td class="td-acoes"><button class="leve mini" data-ver="${l.t.id}">${ic("eye", { size: 16 })}Ver</button> ${itens ? menuHTML({ aria: `Mais ações: ${l.t.nome || l.t.email}`, itensHTML: itens }) : ""}</td></tr>`;
    }).join("") + `</tbody></table></div>`;
}
// em "Não fizeram": barrar quem faltou (não abre a prova) ou deixar um atrasado entrar com a entrada fechada
function botoesEntrada(email) {
  const p = resDados.prova, em = String(email).toLowerCase();
  if ((p.bloqueados || []).includes(em)) return ` <span class="tag erro">🚫 barrado</span> <button class="leve mini" data-desbarrar="${esc(em)}">desfazer</button>`;
  const lib = (p.liberadosEntrada || []).includes(em);
  return ` <button class="leve mini" data-barraremail="${esc(em)}" title="Este aluno não consegue abrir a prova">🚫 Barrar</button>` +
    (entradaFechadaAgora(p) && !lib ? ` <button class="leve mini" data-deixarentrar="${esc(em)}" title="Entrada fechada: deixa só este aluno começar">🚪 Deixar entrar</button>` : lib ? ` <span class="tag ok">pode entrar</span>` : "");
}
function desenharResultados() {
  const { linhas, testes } = resDados;
  const fin = linhas.filter(l => l.t.finalizadaEm), comSinal = linhas.filter(l => l.temSinal).length, media = fin.length ? (fin.reduce((s, l) => s + l.nota, 0) / fin.length).toFixed(1) : "—";
  const revisar = linhas.reduce((s, l) => s + l.revisar, 0);
  $("#resAcoes").classList.remove("oculto");
  { const andando = resDados.linhas.filter(l => !l.t.finalizadaEm).length, be = $("#btnEncerrarTodas");
    be.classList.toggle("oculto", !podeCuidar() || !andando); be.textContent = `⛔ Encerrar todas (${andando})`;
    $("#btnTempoTodas").classList.toggle("oculto", !podeCuidar() || !andando || !(Number(resDados.prova.tempoMinutos) > 0)); }
  $("#resResumo").innerHTML = statTiles([{ v: String(media).replace(".", ","), r: "média da turma" }, { v: `${fin.length} / ${linhas.length}`, r: "finalizaram" },
    { v: revisar, r: "respostas a revisar", tom: revisar ? "aviso" : "" }, { v: comSinal, r: "com sinais de aba, tela cheia ou colar", tom: comSinal ? "erro" : "" }]);
  pintarResumoIA(revisar);
  // contagem em cada chip de situação
  const nSit = { "": linhas.length, finalizou: fin.length, andamento: linhas.length - fin.length, revisar: linhas.filter(l => l.revisar).length, sinais: comSinal };
  SITUACOES.forEach(o => { o.t = o.t.split(" · ")[0] + (nSit[o.v] !== undefined ? ` · ${nSit[o.v]}` : ""); });
  chipsSituacao.definir($("#rSituacao").value);
  const mostrarTestes = $("#rTestes").checked;
  const vis = filtrarLinhas(linhas);
  const vis0 = vis;
  let html = linhas.length ? `<div class="card sem-padding">${!vis0.length ? vazio({ e: "🔎", texto: "Nenhum aluno com esse filtro." }) : tabelaHTML(vis0, "aluno")}</div>` : `<div class="card">${vazio({ e: "⏳", texto: "Nenhum aluno fez esta prova ainda." })}</div>`;
  html = entradaHTML() + html;
  if (resDados.turma) {
    const fizeram = new Set(linhas.map(l => String(l.t.email || "").toLowerCase()));
    const todos = alunosDaTurma(resDados.turma), faltam = todos.filter(a => !a.email || !fizeram.has(a.email));
    html += `<div class="card secao-faltam"><h2>Não fizeram <span class="meta-txt">${faltam.length} de ${todos.length} da turma ${esc(resDados.turma.nome)}</span></h2>` +
      (faltam.length ? `<ul class="lista-faltam">${faltam.map(a => `<li>${esc(a.nome || a.email)}${a.nome && a.email ? ` <span class="pequeno">${esc(a.email)}</span>` : ""}${!a.email ? ` <span class="pequeno">— ainda não entrou no sistema</span>` : ""}${a.email && podeCuidar() ? botoesEntrada(a.email) : ""}</li>`).join("")}</ul>` : `<p class="help">Todos os alunos da turma começaram a prova.</p>`) + `</div>`;
  } else if (resDados.prova.turmaId) html += `<div class="card"><p class="pequeno">A turma desta prova não foi encontrada (apagada?). Escolha outra em Provas → Editar.</p></div>`;
  if (mostrarTestes) html += `<div class="card secao-testes"><h2>Testes da equipe <span class="meta-txt">não entram na média, no CSV, nos PDFs nem em "Fechar notas"</span></h2>${testes.length ? tabelaHTML(testes, "teste") : `<p class="pequeno">Nenhuma tentativa de teste nesta prova. Abra <b>Testar como aluno</b> na aba Provas.</p>`}</div>`;
  // preserva o detalhe aberto (e o que o professor estiver digitando nele)
  const box = $("#resDetalhe");
  const digitando = box && box.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  const detalheAntigo = box ? box.innerHTML : "";
  $("#resTabela").innerHTML = html + `<div id="resDetalhe"></div>`;
  if (detalheId && [...linhas, ...testes].some(l => l.t.id === detalheId)) {
    if (digitando) $("#resDetalhe").innerHTML = detalheAntigo;   // não apaga a correção em andamento
    else verAluno(detalheId, false);
  }
  document.querySelectorAll("[data-ver]").forEach(b => b.onclick = () => verAluno(b.dataset.ver));
  ligarAcoesVida($("#resTabela"));
  ligarEntrada($("#resTabela"));
  document.querySelectorAll("[data-reset]").forEach(b => b.onclick = async () => {
    const l = linhas.find(x => x.t.id === b.dataset.reset);
    if (!(await confirmar(`Apagar a tentativa de ${l.t.nome || l.t.email}? A pessoa poderá fazer a prova de novo (com novo sorteio).`, { titulo: "Apagar tentativa", ok: "Apagar", perigo: true }))) return;
    const lote = writeBatch(db);
    (await getDocs(collection(db, "tentativas", l.t.id, "respostas"))).forEach(d => lote.delete(d.ref));
    (await getDocs(collection(db, "tentativas", l.t.id, "correcoes"))).forEach(d => lote.delete(d.ref));
    (await getDocs(collection(db, "tentativas", l.t.id, "saidas"))).forEach(d => lote.delete(d.ref));
    for (const qid of l.t.questoesIds) lote.delete(doc(db, "marcadores", `${l.t.uid}_${qid}`));
    lote.delete(doc(db, "tentativas", l.t.id)); await lote.commit(); toast("Tentativa apagada", "ok");
    if (!$("#rAoVivo").checked) carregarResultados();
  });
}
function verAluno(id, rolar = true) {
  const l = [...resDados.linhas, ...resDados.testes].find(x => x.t.id === id), box = $("#resDetalhe");
  if (!l || !box) return;
  // ao vivo: acompanha as respostas da tentativa aberta
  if (detalheId !== id || (!ouvinteDetalhe && $("#rAoVivo").checked)) {
    if (ouvinteDetalhe) { ouvinteDetalhe(); ouvinteDetalhe = null; }
    detalheId = id;
    if ($("#rAoVivo").checked) ouvinteDetalhe = onSnapshot(collection(db, "tentativas", id, "respostas"), snap => {
      const c = cacheTent.get(id); if (!c) return;
      c.resp = {}; snap.forEach(x => c.resp[x.id] = x.data());
      montarResultados();
    }, e => console.warn("detalhe ao vivo parou", e));
  }
  const lim = limiteSaidas(resDados.prova);
  box.innerHTML = `<div class="card"><div class="linha"><h2 style="flex:3">${l.t.teste ? "🧪 " : ""}${esc(l.t.nome || l.t.email)} — ${l.nota}/100 (${l.pts} de ${l.max} pontos)${textoConvertida(resDados.prova, l.t.email, l.nota) ? ` → ${textoConvertida(resDados.prova, l.t.email, l.nota)} (${tipoRec(resDados.prova, l.t.email)})` : ""}</h2><button class="leve mini" id="btnPDFAluno" style="flex:0 0 auto">PDF deste aluno</button></div>
    ${vidasDe(l.t) || podeEditar() ? `<div class="linha acoes detalhe-vidas">${vidasDe(l.t) ? `<span>Vidas: ${coracoesHTML(vidasDe(l.t))}</span>` : ""}${acoesVidaHTML(l)}</div>` : ""}
    <p class="pequeno">Tempo total: <b>${fmtTempo(l.tempo)}</b> · ${sinaisHTML(l.sinais)}${lim ? ` · vidas perdidas <b>${l.sinais.abas}</b>${l.t.vidasRestauradas ? ` · restauradas ${l.t.vidasRestauradas}×` : ""}` : ""}${l.t.reabertaEm ? ` · <span class="tag nota">↩ reaberta por ${esc(l.t.reabertaPor || "professor")}</span>` : ""}
      ${l.t.encerradaPor === "trocasDeAba" ? ` · <span class="tag erro">⛔ encerrada: limite de saídas atingido</span>` : ""}${l.t.encerradaPor === "professor" ? ` · <span class="tag erro">⛔ encerrada pelo professor</span>` : ""}${l.t.encerradaPor === "aluno" ? ` · <span class="tag aviso">⏹ o aluno encerrou com questões em branco</span>` : ""}${l.perdidas ? ` · <span class="tag erro">⛔ ${l.perdidas} questão(ões) perdida(s)</span>` : ""}</p>` + l.itens.map(x => {
    const rapida = x.r !== undefined && !x.perdida && typeof x.segundos === "number" && x.segundos < RAPIDO;
    const tempo = typeof x.segundos === "number" ? `<span class="tag ${rapida ? "erro" : ""}" title="Tempo entre a questão aparecer e a resposta ser enviada">⏱ ${fmtTempo(x.segundos)}${rapida ? ` · menos de ${RAPIDO} s` : ""}</span>` : "";
    const dicaTag = l.t.dicas?.[x.qid] ? ` <span class="tag aviso" title="${esc(l.t.dicas[x.qid].texto || "")}">💡 pediu dica</span>` : "";
    const fmt = temFormato(x.q), bloco = t => `<span class="resp-formato">${esc(t).replace(/\n/g, "<br>")}</span>`;
    const sua = x.perdida ? "<i>perdida por sair da prova</i>" : x.r === undefined ? "<i>não respondida</i>" : x.q.tipo === "sql" ? bloco(textoRespostaSql(x.q, x.r)) : x.q.tipo === "web" ? bloco(textoRespostaWeb(x.q, x.r)) : x.q.tipo === "diagrama" ? bloco(textoRespostaDiagrama(x.q, x.r)) + ` <button type="button" class="leve mini" data-verdiag="${x.qid}">📐 Ver diagrama</button>` : fmt ? bloco(textoResposta(x.q, x.r)) : x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.r] ?? x.r) : `<span class="mono">${esc(x.r)}</span>`;
    const certa = x.q.tipo === "diagrama" ? bloco(textoGabaritoDiagrama(x.q, x.g)) + ` <button type="button" class="leve mini" data-verdiag="${x.qid}" data-gab="1">📐 Ver gabarito</button>` : x.q.tipo === "sql" ? bloco((x.q.tarefas || []).map((t, k) => `Tarefa ${k + 1}: ${x.g.tarefas?.[t.id]?.sql || "—"}`).join("\n")) : fmt ? (x.g.chave ? bloco(textoChave(x.q, x.g)) + ` <span class="tag nota">${FORMATOS[x.q.formato].icone} ${esc(FORMATOS[x.q.formato].nome)}</span>` : "—") : x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.g.correta] ?? "—") : esc((x.g.respostasAceitas || [])[0] || (x.g.palavrasChave || []).join(" + "));
    const manual = podeEditar() && ["dissertativa", "sql", "web", "diagrama"].includes(x.q.tipo) && !x.perdida ? `<div class="linha" style="margin-top:6px"><div style="flex:0 0 120px"><label>Pontos (0–${x.peso})</label><input type="number" min="0" max="${x.peso}" step="0.25" value="${x.pontos}" id="pt_${x.qid}"></div><div><label>Comentário para o aluno</label><input type="text" id="cm_${x.qid}" value="${esc(x.comentario)}"></div><div style="flex:0 0 120px;align-self:flex-end"><button class="mini" data-corr="${x.qid}">Salvar</button></div></div>` : "";
    const rot = ROTULOS[x.status] || ROTULOS.revisar;
    return `<div class="feedback bloco ${x.status === "certa" ? "certa" : ["errada", "perdida", "em_branco"].includes(x.status) ? "errada" : "revisar"}"><div class="linha acoes"><b>Q${x.n}</b> <span class="tag ${rot[0]}">${rot[1]} · ${x.pontos}/${x.peso}${x.manual ? " · manual" : ""}</span>${x.ia ? `<span class="tag nota" title="Corrigida pela IA — confira e ajuste se precisar">🤖 IA</span>` : ""}${errosIA.has(l.t.id + "/" + x.qid) ? `<span class="tag erro ia-erro">⚠ IA: ${esc(errosIA.get(l.t.id + "/" + x.qid))}</span>` : ""}${tempo}</div>
      <div class="enunciado pequeno">${esc(x.q.enunciado)}</div>${avisoQuestaoHTML(resDados.revMap?.get(x.qid), l.t, x.status !== "certa")}<p><b>Resposta do aluno:</b> ${sua}${typeof dicaTag === "string" ? dicaTag : ""}<br><b>Esperada:</b> ${certa}</p>${manual}</div>`;
  }).join("") + `<div id="saidasDetalhe" class="bloco pequeno" style="margin-top:8px"><span class="texto-suave">Carregando saídas…</span></div>${podeCuidar() && (ehInclusao() || resDados.acessEmails?.has(String(l.t.email || "").toLowerCase()) || l.t.obsAcessibilidade) ? obsAcessHTML(l) : ""}</div>`;
  if (rolar) box.scrollIntoView({ behavior: "smooth" });
  ligarRevisar(box);
  $("#btnPDFAluno").onclick = () => abrirImpressao(`Boletim — ${resDados.prova.titulo}`, boletimHTML(l));
  ligarAcoesVida(box);
  // diagrama (casos de uso, brModelo…): abre o desenho do aluno ou o gabarito só para ver
  box.querySelectorAll("[data-verdiag]").forEach(b => b.onclick = async () => {
    const x = l.itens.find(i => i.qid === b.dataset.verdiag); if (!x) return;
    const { montarDiagramaProva } = await import("./diagrama-prova.js?v=20261126a");
    let api = null;
    await modal({ titulo: b.dataset.gab ? `Gabarito — Q${x.n}` : `Diagrama do aluno — Q${x.n}`, conteudo: '<div class="diag-modal-host"></div>', largo: true, ok: "Fechar",
      aoAbrir: c => { api = montarDiagramaProva(c.querySelector(".diag-modal-host"), { questao: x.q, valor: b.dataset.gab ? x.g.diagrama : x.r, somenteLeitura: true }); } });
    api?.destruir?.();
  });
  box.querySelectorAll("[data-corr]").forEach(b => b.onclick = async () => {
    const qid = b.dataset.corr, pontos = Number($("#pt_" + qid).value), comentario = $("#cm_" + qid).value.trim();
    if (!(await confirmar(`Salvar a correção desta questão com ${pontos} ponto(s) para ${l.t.nome || l.t.email}?`, { titulo: "Salvar correção", ok: "Salvar" }))) return;
    await setDoc(doc(db, "tentativas", l.t.id, "correcoes", qid), { pontos, comentario, corrigidoPor: eu.email, corrigidoEm: serverTimestamp() });
    toast("Correção salva", "ok");
    document.activeElement?.blur?.();
    const d = await getDoc(doc(db, "tentativas", l.t.id)); await atualizarCache(d); montarResultados(); verAluno(id, false);
  });
  if (podeCuidar()) box.querySelector(`[data-salvar-obs]`)?.addEventListener("click", async () => {
    const adaptacoes = [...box.querySelectorAll(".obs-ada:checked")].map(x => x.value);
    const dificuldades = [...box.querySelectorAll(".obs-dif:checked")].map(x => x.value);
    const txt = s => box.querySelector(s)?.value.trim() || "";
    const nota = txt(`#obsNota_${id}`), funcionou = txt(`#obsFunc_${id}`), sugestao = txt(`#obsSug_${id}`);
    const radio = c => { const v = box.querySelector(`input[name="rel_${c}_${id}"]:checked`)?.value; return v ? Number(v) : null; };
    const escalas = Object.fromEntries(["humor", ...REL_PROVA_ESCALAS.map(x => x[0])].map(c => [c, radio(c)]).filter(([, v]) => v));
    const tem = adaptacoes.length || dificuldades.length || nota || funcionou || sugestao || Object.keys(escalas).length;
    if (!(await confirmar(`Salvar o relatório desta somativa de ${l.t.nome || l.t.email}?`, { titulo: "♿ Relatório da somativa", ok: "Salvar" }))) return;
    const obsAcessibilidade = tem ? { adaptacoes, dificuldades, nota, funcionou, sugestao, ...escalas, autor: eu.email, autorNome: eu.nome || eu.email, papel: eu.papel || "", em: serverTimestamp() } : null;
    try {
      await updateDoc(doc(db, "tentativas", id), { obsAcessibilidade });
      toast("Relatório da somativa salvo.", "ok");
      const d = await getDoc(doc(db, "tentativas", id)); await atualizarCache(d); montarResultados(); verAluno(id, false);
    } catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); }
  });
  carregarSaidasDetalhe(id, l);
}
// RELATÓRIO DA SOMATIVA (acessibilidade): a auxiliar/professor registra como foi ESTA prova do aluno (não é o diário do dia)
const REL_PROVA_ESCALAS = [
  ["autonomia", "🦸 Autonomia na prova", ["Ajuda o tempo todo", "Muita ajuda", "Alguma ajuda", "Pouca ajuda", "Fez sozinha"]],
  ["compreensao", "🧠 Entendeu os enunciados", ["Não entendeu", "Entendeu pouco", "Com explicação", "Entendeu bem", "Entendeu tudo"]],
  ["foco", "🎯 Foco durante a prova", ["Muito disperso", "Disperso", "Oscilou", "Focado", "Muito focado"]]
];
const REL_PROVA_DIFIC = ["Enunciado longo", "Vocabulário técnico", "Muitas etapas", "Escrever código/comando", "Usar o computador", "Tempo", "Ansiedade com a prova", "Barulho/ambiente", "Nada foi difícil"];
const OBS_ACESS_OPTS = [
  ["lida_voz", "Questões lidas em voz alta pelo professor/auxiliar"],
  ["tech_assist", "Tecnologia assistiva (leitor de tela, ampliador, etc.)"],
  ["tempo_extra", "Tempo extra concedido"],
  ["formato_access", "Questões no formato de acessibilidade do sistema (ampliado, simplificado)"],
  ["sala_separada", "Sala ou espaço separado"],
  ["acompanhante", "Acompanhante ou auxiliar presente durante a somativa"],
  ["outra", "Outra adaptação (descreva no campo abaixo)"],
];
function obsAcessHTML(l) {
  const obs = l.t.obsAcessibilidade || {}, adas = obs.adaptacoes || [], dif = obs.dificuldades || [];
  const temObs = adas.length || obs.nota || obs.humor || obs.funcionou;
  const id = l.t.id;
  const radios = (campo, opcoes, atual) => opcoes.map(([v, t]) => `<label class="rel-op${String(atual) === String(v) ? " sel" : ""}"><input type="radio" name="rel_${campo}_${id}" value="${v}"${String(atual) === String(v) ? " checked" : ""}> <span>${t}</span></label>`).join("");
  return `<details class="bloco pequeno obs-acess-bloco" style="margin-top:8px" ${temObs ? "open" : ""}>
    <summary style="cursor:pointer"><b>♿ Relatório desta somativa</b>${temObs ? ` <span class="tag nota">preenchido${obs.autorNome ? ` por ${esc(obs.autorNome)}` : ""}</span>` : " <span class='meta-txt'>ainda não preenchido</span>"}</summary>
    <div style="padding:8px 0 0" class="rel-prova">
      <p class="pequeno" style="margin:0 0 8px">Como foi <em>esta</em> prova para o aluno: fica anexado ao resultado dele e ajuda a adaptar as próximas. (O diário do dia a dia fica no <a href="${URL_AULAS}" target="_blank" rel="noopener">sistema de aulas</a>.)</p>
      <p class="rel-rot">😊 Como estava durante a prova?</p>
      <div class="rel-linha">${radios("humor", HUMOR.map(h => [h.v, `<span class="rel-emoji" title="${esc(h.r)}">${h.e}</span>`]), obs.humor)}</div>
      ${REL_PROVA_ESCALAS.map(([c, rot, rs]) => `<p class="rel-rot">${rot}</p><div class="rel-linha">${radios(c, rs.map((r, i) => [i + 1, esc(r)]), obs[c])}</div>`).join("")}
      <p class="rel-rot">🧩 Adaptações feitas nesta somativa</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:4px">
        ${OBS_ACESS_OPTS.map(([v, t]) => `<label class="check"><input type="checkbox" class="obs-ada" value="${v}"${adas.includes(v) ? " checked" : ""}> <span>${esc(t)}</span></label>`).join("")}
      </div>
      <p class="rel-rot">🧗 O que foi difícil nesta prova?</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px">
        ${REL_PROVA_DIFIC.map(v => `<label class="check"><input type="checkbox" class="obs-dif" value="${esc(v)}"${dif.includes(v) ? " checked" : ""}> <span>${esc(v)}</span></label>`).join("")}
      </div>
      <div style="margin-top:8px"><label for="obsFunc_${id}">✅ O que funcionou nesta prova?</label>
        <textarea id="obsFunc_${id}" rows="2" style="margin-top:4px" placeholder="Ex.: ler a questão em voz alta e dividir em partes.">${esc(obs.funcionou || "")}</textarea></div>
      <div style="margin-top:8px"><label for="obsSug_${id}">📝 Sugestão para as próximas provas</label>
        <textarea id="obsSug_${id}" rows="2" style="margin-top:4px" placeholder="Ex.: entende melhor com tabela desenhada; trava com texto longo.">${esc(obs.sugestao || "")}</textarea></div>
      <div style="margin-top:8px"><label for="obsNota_${id}">Observação adicional (opcional)</label>
        <textarea id="obsNota_${id}" rows="2" style="margin-top:4px">${esc(obs.nota || "")}</textarea></div>
      ${obs.em ? `<p class="pequeno texto-suave" style="margin:6px 0 0">Última edição: ${esc(obs.autorNome || obs.autor || "")} · ${esc(dataBR(obs.em))}</p>` : ""}
      <button class="leve mini" data-salvar-obs="${id}" style="margin-top:8px">Salvar relatório da somativa</button>
    </div>
  </details>`;
}

async function carregarSaidasDetalhe(tentativaId, l) {
  const el = document.getElementById("saidasDetalhe");
  if (!el) return;
  let snap;
  try { snap = await getDocs(collection(db, "tentativas", tentativaId, "saidas")); }
  catch { el.innerHTML = ""; return; }
  if (snap.empty) { el.innerHTML = ""; return; }
  const saidas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.saidaEm?.toMillis?.() ?? 0) - (b.saidaEm?.toMillis?.() ?? 0));
  const acertouQuestoes = new Set(l.itens.filter(x => x.status === "certa").map(x => x.qid));
  const fmtTs = ts => ts?.toDate ? ts.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
  const fmtSeg = s => typeof s === "number" ? `${s}s` : "—";
  const MOTIVO = { aba: "troca de aba/janela", telaCheia: "saiu da tela cheia", colar: "tentou colar", recarregou: "recarregou/fechou a página", sistema: "janela do sistema (aviso, sem perder vida)", extensao: "extensão do navegador (aviso)" };
  const custo = s => s.anulada || ["sistema", "extensao"].includes(s.motivo) || (s.motivo === "colar" && (resDados.prova.permitirColar || resDados.prova.colarTiraVida === false)) ? 0 : 1 + Number(s.vidasTimer || 0);
  const rows = saidas.map(s => {
    const suspeita = s.questaoId && acertouQuestoes.has(s.questaoId) && s.motivo !== "colar";
    return `<tr>
      <td>${s.indice ? `Q${s.indice}` : "—"}</td>
      <td>${esc(MOTIVO[s.motivo] || s.motivo)}</td>
      <td>${fmtTs(s.saidaEm)}</td>
      <td>${s.voltouEm ? fmtTs(s.voltouEm) : "—"}</td>
      <td>${fmtSeg(s.segundosFora)}</td>
      <td>${suspeita ? '<span class="tag erro" title="O aluno saiu da prova durante esta questão e a acertou">⚠ acerto sob suspeita</span>' : ""}${s.vidasTimer ? ` <span class="tag" title="Vidas perdidas pelo timer de volta">+${s.vidasTimer} timer</span>` : ""}</td>
      <td>${s.anulada ? '<span class="tag ok">anulada</span>' : podeCuidar() && custo(s) && vidasDe(l.t) ? `<button class="leve mini" data-anular="${s.id}" title="Saída por engano (ex.: janela do Windows): devolve ${custo(s)} vida(s)">↩ anular</button>` : ""}</td>
    </tr>`;
  }).join("");
  el.innerHTML = `<details><summary style="cursor:pointer"><b>Saídas durante a prova</b> (${saidas.length})</summary>
    <table class="tabela-saidas" style="width:100%;border-collapse:collapse;margin-top:6px;font-size:12px">
      <thead><tr style="text-align:left"><th>Questão</th><th>Motivo</th><th>Saiu às</th><th>Voltou às</th><th>Fora</th><th></th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></details>`;
  el.querySelectorAll("[data-anular]").forEach(b => b.onclick = async () => {
    const s = saidas.find(x => x.id === b.dataset.anular), k = custo(s), nome = l.t.nome || l.t.email;
    if (!s || !k) return;
    const fim = l.t.finalizadaEm && l.t.encerradaPor === "trocasDeAba";
    if (!(await confirmar(`Anular esta saída de ${nome} e devolver ${k === 1 ? "1 vida" : `${k} vidas`}?${fim ? "\n\nA prova dele foi encerrada pelas vidas: depois use Reabrir prova." : ""}`, { titulo: "↩ Anular saída", ok: "Anular" }))) return;
    try {
      const atual = Number(l.t.trocasDeAba || 0), volta = Math.min(atual, k), extra = k - volta;
      const lote = writeBatch(db);
      lote.update(doc(db, "tentativas", l.t.id, "saidas", s.id), { anulada: true, anuladaPor: eu.email, anuladaEm: serverTimestamp() });
      const upd = {};
      if (volta) Object.assign(upd, { trocasDeAba: increment(-volta), trocasDeAbaTotal: increment(volta) });
      if (extra) upd.vidasExtras = increment(extra);
      lote.update(doc(db, "tentativas", l.t.id), upd);
      await lote.commit();
      toast(`Saída anulada: +${k} vida(s) para ${nome} ❤️`, "ok");
      await recarregarTentativa(l.t.id);
    } catch (e) { toast("Não foi possível anular. " + traduzirErro(e), "erro"); console.error(e); }
  });
}
// mais tempo para todos que estão fazendo a prova agora (cada um conta do próprio início; quem ainda não começou já terá o tempo inteiro)
$("#btnTempoTodas").onclick = async () => {
  if (!resDados) return;
  const ls = resDados.linhas.filter(l => !l.t.finalizadaEm);
  if (!ls.length) return toast("Nenhum aluno com a prova em andamento.", "erro");
  let min = 10;
  const ok = await modal({
    titulo: `⏱ Mais tempo para todos (${ls.length})`, ok: "Dar mais tempo", cancelar: "Cancelar",
    conteudo: `<label for="mtTodos">Minutos a mais</label><input type="number" id="mtTodos" min="1" max="240" step="1" value="10">
      <p class="pequeno">Vale para os ${ls.length} alunos com a prova em andamento; o cronômetro de cada um atualiza sozinho. Quem ainda não começou já terá o tempo inteiro da prova a partir do próprio início. Quem já finalizou não muda (use Reabrir prova).</p>`,
    antesDeConfirmar: caixa => {
      const v = Math.round(Number(caixa.querySelector("#mtTodos")?.value || 0));
      if (!(v >= 1 && v <= 240)) { toast("Escolha de 1 a 240 minutos.", "erro"); return false; }
      min = v;
    }
  });
  if (!ok) return;
  try {
    for (let i = 0; i < ls.length; i += 400) {
      const lote = writeBatch(db);
      ls.slice(i, i + 400).forEach(l => lote.update(doc(db, "tentativas", l.t.id), { minutosExtras: increment(min) }));
      await lote.commit();
    }
    toast(`+${min} min para ${ls.length} aluno(s) ⏱`, "ok");
    if (!$("#rAoVivo").checked) carregarResultados();
  } catch (e) { toast("Não foi possível dar mais tempo. " + traduzirErro(e), "erro"); console.error(e); }
};
$("#btnEncerrarTodas").onclick = () => resDados && encerrarProvas(resDados.linhas, { todos: true });
$("#btnFecharNotas").onclick = async () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  if (!podeEditar()) return toast("Seu papel não permite fechar notas.", "erro");
  const pend = resDados.linhas.reduce((s, l) => s + l.revisar, 0);
  if (pend && !(await confirmar(`Ainda há ${pend} resposta(s) marcada(s) como "revisar" (valem 0 até você corrigir). Fechar mesmo assim?`, { titulo: "Fechar notas", ok: "Fechar mesmo assim" }))) return;
  if (!pend && !(await confirmar(`Fechar as notas de ${resDados.linhas.length} aluno(s) em "${resDados.prova.titulo}"? A nota final fica gravada para cada um.`, { titulo: "Fechar notas", ok: "Fechar notas" }))) return;
  const lote = writeBatch(db);
  resDados.linhas.forEach(l => lote.update(doc(db, "tentativas", l.t.id), { nota: l.nota, notaMaxima: 100, corrigidaEm: serverTimestamp(), corrigidaPor: eu.email }));
  await lote.commit(); toast("Notas gravadas. Para o aluno ver o gabarito, clique em “Liberar gabarito/resultado” na aba Provas.", "ok"); carregarResultados();
};
$("#btnCSV").onclick = () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  const n = Math.max(resDados.prova.nQuestoes || 0, ...resDados.linhas.map(l => l.itens.length));
  const cab = ["Nome", "E-mail", "Início", "Fim", "Tempo", "Tempo (segundos)", "Trocas de aba", "Saídas da tela cheia", "Tentativas de colar", `Respostas < ${RAPIDO}s`, "Encerrada por", "Questões perdidas", "Nota", ...(resDados.prova.valeAte ? ["Tipo", "Vale até", "Nota final"] : []),
               ...Array.from({ length: n }, (_, i) => `Q${i + 1}`)];
  const rows = resDados.linhas.map(l => [l.t.nome || "", l.t.email, dataBR(l.t.iniciadaEm), l.t.finalizadaEm ? dataBR(l.t.finalizadaEm) : "em andamento",
    fmtTempo(l.tempo), l.tempo ?? "", abasTexto(l.sinais), l.sinais.telaCheia, l.sinais.colar, l.rapidas, l.t.encerradaPor === "trocasDeAba" ? "limite de saídas" : "", l.perdidas, String(l.nota).replace(".", ","),
    ...(resDados.prova.valeAte ? [resDados.prova.valeAte[String(l.t.email).toLowerCase()] ? tipoRec(resDados.prova, l.t.email) : "", String(resDados.prova.valeAte[String(l.t.email).toLowerCase()] ?? "").replace(".", ","), String(notaConvertida(resDados.prova, l.t.email, l.nota) ?? "").replace(".", ",")] : []),
    ...l.itens.map(x => `${x.pontos}/${x.peso} ${x.status}${typeof x.segundos === "number" ? ` (${x.segundos}s)` : ""}`)]);
  const csv = [cab, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  baixar(`resultados_${resDados.prova.titulo.replace(/\W+/g, "_")}.csv`, "﻿" + csv);
};

// ============================================================ EQUIPE
let equipeCache = [];
const ROT_PAPEL = { admin: "admin", professor: "professor", auxiliar: "auxiliar", inclusao: "auxiliar de inclusão" };
async function carregarEquipe() {
  const s = await getDocs(collection(db, "equipe"));
  equipeCache = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || a.id).localeCompare(b.nome || b.id, "pt-BR"));
  desenharEquipe();
}
function desenharEquipe() {
  const b = semAcento($("#feBusca").value.trim()), fp = $("#fePapel").value;
  const lista = equipeCache.filter(m => (!b || semAcento(`${m.id} ${m.nome || ""}`).includes(b)) && (!fp || m.papel === fp));
  const corPapel = { admin: "navy", professor: "info", inclusao: "warn", auxiliar: "off" };
  $("#feContagem").textContent = `${lista.length} de ${equipeCache.length} pessoa(s)`;
  $("#listaEquipe").innerHTML = `<div class="tabela sem-borda tabela-alunos"><table><thead><tr><th>E-mail</th><th>Nome</th><th>Papel</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>
    ${!b && !fp ? `<tr><td>${esc(SUPER_ADMIN)}</td><td>—</td><td><span class="chip ok">admin principal</span></td><td class="td-acoes"><span class="meta-txt eq-fixo">fixo nas regras</span></td></tr>` : ""}` +
    lista.map(m => `<tr><td>${esc(m.id)}</td><td>${esc(m.nome || "")}</td><td>${ehAdmin() && m.id !== eu.email ? `<select class="sel-papel ${corPapel[m.papel] || "off"}" data-papel="${esc(m.id)}" aria-label="Cargo de ${esc(m.nome || m.id)}">${Object.entries(ROT_PAPEL).map(([k, r]) => `<option value="${k}"${m.papel === k ? " selected" : ""}>${esc(r)}</option>`).join("")}</select>` : `<span class="chip ${corPapel[m.papel] || "off"}">${esc(ROT_PAPEL[m.papel] || m.papel)}</span>${m.id === eu.email ? ` <span class="meta-txt">(você)</span>` : ""}`}</td><td class="td-acoes">${ehAdmin() && m.id !== eu.email ? `<button class="discreto vermelho mini" data-rm="${m.id}">Remover</button>` : ""}</td></tr>`).join("") + "</tbody></table></div>";
  // trocar o cargo (só admin; ninguém muda o próprio cargo, para não se trancar fora)
  document.querySelectorAll("[data-papel]").forEach(sel => sel.onchange = async () => {
    const m = equipeCache.find(x => x.id === sel.dataset.papel), novo = sel.value;
    const efeito = { admin: "Passa a ter acesso a tudo, inclusive equipe, configuração e gamificação.", professor: "Cria e edita provas, bancos, turmas e corrige.",
      auxiliar: "Acompanha as provas e os resultados, sem editar.", inclusao: "Vê só os alunos com acessibilidade vinculados a ela e o diário deles." }[novo] || "";
    if (!(await confirmar(`Mudar o cargo de ${m.nome || m.id} de ${ROT_PAPEL[m.papel] || m.papel} para ${ROT_PAPEL[novo]}?\n\n${efeito}`, { titulo: "Mudar cargo", ok: "Mudar cargo" }))) { sel.value = m.papel; return; }
    try { await updateDoc(doc(db, "equipe", m.id), { papel: novo, atualizadoEm: serverTimestamp(), atualizadoPor: eu.email }); m.papel = novo; toast(`Cargo de ${m.nome || m.id}: ${ROT_PAPEL[novo]}. Vale a partir do próximo acesso dele(a).`, "ok"); desenharEquipe(); }
    catch (e) { sel.value = m.papel; toast(traduzirErro(e), "erro"); }
  });
  document.querySelectorAll("[data-rm]").forEach(b => b.onclick = async () => { if (await confirmar("Remover " + b.dataset.rm + " da equipe?", { titulo: "Remover membro", ok: "Remover", perigo: true })) { await deleteDoc(doc(db, "equipe", b.dataset.rm)); carregarEquipe(); } });
}
$("#feBusca").oninput = $("#fePapel").onchange = () => desenharEquipe();
let drawerEquipe = null;
$("#btnNovoMembro").onclick = () => {
  if (!ehAdmin()) return toast("Só admin cadastra equipe.", "erro");
  drawerEquipe = drawer({ titulo: "Novo membro da equipe", corpo: $("#formEquipe"), aoFechar: () => { $("#formEquipe").classList.add("oculto"); drawerEquipe = null; },
    acoes: [{ t: "Cancelar", classe: "leve" }, { t: "Adicionar", onClick: () => { $("#btnAddEquipe").click(); return false; } }] });
};
$("#btnAddEquipe").onclick = async () => {
  if (!ehAdmin()) return toast("Só admin cadastra equipe.", "erro");
  const email = $("#eEmail").value.trim().toLowerCase(); if (!email.includes("@")) return toast("E-mail inválido.", "erro");
  const jaTem = equipeCache.find(m => m.id === email), papel = ROT_PAPEL[$("#ePapel").value] || $("#ePapel").value;
  if (!(await confirmar(jaTem ? `${email} já está na equipe como ${ROT_PAPEL[jaTem.papel] || jaTem.papel}. Trocar o papel para ${papel}?` : `Adicionar ${email} à equipe como ${papel}? A pessoa passa a ter acesso ao painel com as permissões desse papel.`, { titulo: jaTem ? "Trocar papel" : "Adicionar à equipe", ok: jaTem ? "Trocar papel" : "Adicionar" }))) return;
  await setDoc(doc(db, "equipe", email), { email, nome: $("#eNome").value.trim(), papel: $("#ePapel").value, criadoEm: serverTimestamp(), criadoPor: eu.email });
  $("#eEmail").value = ""; $("#eNome").value = ""; toast("Cadastrado", "ok"); drawerEquipe?.fechar(); carregarEquipe();
};

// ============================================================ CONFIG
async function carregarConfig() {
  const c = await getDoc(doc(db, "config", "geral"));
  $("#cDominios").value = (c.exists() ? c.data().dominiosAlunos || [] : []).join(", ");
  $("#cCorretor").value = c.exists() ? c.data().urlCorretor || "" : "";
  const h = c.data()?.horario?.inicio ? c.data().horario : HORARIO_PADRAO;
  $("#cHIni").value = h.inicio; $("#cHFim").value = h.fim; $("#cHInt").value = (h.intervalos || []).map(i => `${i.nome} | ${i.inicio} | ${i.fim}`).join("\n");
}
const urlCorretorDigitada = () => $("#cCorretor").value.trim().replace(/\/+$/, "");
$("#btnTestarCorretor").onclick = async () => {
  const url = urlCorretorDigitada();
  if (!/^https:\/\//.test(url)) return toast("Cole o endereço do servidor (começa com https://).", "erro");
  $("#msgConfig").textContent = "Testando o servidor…";
  try {
    const d = await (await fetch(url)).json();
    $("#msgConfig").textContent = d.ok && d.configurado ? "✅ Servidor no ar e configurado."
      : d.ok ? "⚠ Servidor no ar, mas faltam variáveis no Cloudflare: " + (d.faltando || []).join(", ") : "⚠ Resposta inesperada do servidor.";
  } catch (e) { $("#msgConfig").textContent = "⚠ Não consegui falar com o servidor. Confira o endereço e se o Worker foi publicado (Deploy)."; }
};
$("#btnSalvarConfig").onclick = async () => {
  if (!ehAdmin()) return toast("Só admin altera a configuração.", "erro");
  const dominios = $("#cDominios").value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean), url = urlCorretorDigitada();
  if (url && !/^https:\/\/[\w.-]+(\/.*)?$/.test(url)) return toast("O endereço do servidor precisa começar com https://.", "erro");
  const hora = x => /^\d{2}:\d{2}$/.test(x) ? x : null;
  const intervalos = $("#cHInt").value.split("\n").map(l => l.split("|").map(x => x.trim())).filter(x => x[0]).map(([nome, ini, fim]) => ({ nome, inicio: hora(ini), fim: hora(fim) }));
  if (!hora($("#cHIni").value) || !hora($("#cHFim").value) || intervalos.some(i => !i.inicio || !i.fim)) return toast("Horário inválido: use HH:MM (ex.: Almoço | 11:00 | 12:00).", "erro");
  const horario = { inicio: $("#cHIni").value, fim: $("#cHFim").value, intervalos };
  if (!(await confirmar("Salvar as alterações na configuração? Domínios dos alunos, servidor da IA e horário valem para todo o sistema.", { titulo: "Salvar configuração", ok: "Salvar" }))) return;
  await setDoc(doc(db, "config", "geral"), { dominiosAlunos: dominios, urlCorretor: url, horario }, { merge: true });
  horarioCfg = horario;
  $("#msgConfig").textContent = "Salvo: " + dominios.join(", ") + (url ? ` · servidor de correção: ${url}` : " · sem servidor de correção");
};

// ============================================================ PDF (janela de impressão → "Salvar como PDF")
function abrirImpressao(titulo, corpo) {
  const w = window.open("", "_blank");
  if (!w) return toast("O navegador bloqueou a janela. Libere pop-ups para este site.", "erro");
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(titulo)}</title>
  <style>body{font-family:Arial,sans-serif;font-size:11pt;color:#111;margin:18mm 16mm}h1{font-size:16pt;border-left:5px solid #c1272d;padding-left:8px;margin:0 0 4px}h2{font-size:13pt;margin:14px 0 6px}
  .sub{color:#555;font-size:9.5pt;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:10pt}th{background:#c1272d;color:#fff;text-align:left;padding:5px}td{border-bottom:1px solid #ddd;padding:5px;vertical-align:top}
  .q{border:1px solid #ddd;border-radius:6px;padding:8px 10px;margin:8px 0;page-break-inside:avoid}.q.certa{border-left:5px solid #2e8b57}.q.errada{border-left:5px solid #c1272d}.q.outra{border-left:5px solid #b26a00}
  .mono{font-family:Consolas,monospace;background:#f2f2f2;padding:1px 4px}.exp{background:#f7f7f7;padding:6px 8px;border-radius:4px;margin-top:6px;font-size:10pt}.quebra{page-break-after:always}.peq{font-size:9.5pt;color:#555}tr.sinal td{background:#fff4c2}.rapida{color:#c1272d;font-weight:bold}</style></head>
  <body>${corpo}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}
function cab(titulo, sub) { return `<h1>${esc(titulo)}</h1><div class="sub">${esc(sub)}</div>`; }
function boletimHTML(l, quebra = false) {
  const p = resDados.prova;
  const rot = { certa: "✔ certa", errada: "✘ errada", parcial: "parcial", revisar: "◌ em correção", em_branco: "□ em branco", perdida: "⛔ perdida (saiu da prova)" };
  let h = cab(`Boletim — ${p.titulo}`, `${l.t.nome || ""} · ${l.t.email} · ${p.turma || ""} · finalizada em ${l.t.finalizadaEm ? dataBR(l.t.finalizadaEm) : "—"}`);
  h += `<h2>Nota: ${l.nota} / 100 <span class="peq">(${l.pts} de ${l.max} pontos)</span>${textoConvertida(resDados.prova, l.t.email, l.nota) ? ` → nota final: ${textoConvertida(resDados.prova, l.t.email, l.nota)} (${tipoRec(resDados.prova, l.t.email)})` : ""}</h2>`;
  if (l.t.encerradaPor === "trocasDeAba") h += `<div class="rapida">⛔ Prova encerrada: limite de saídas da prova atingido.</div>`;
  h += `<div class="peq">Tempo total: ${fmtTempo(l.tempo)} · Trocas de aba: ${abasTexto(l.sinais)} · Saídas da tela cheia: ${l.sinais.telaCheia} · Tentativas de colar: ${l.sinais.colar}</div>`;
  h += l.itens.map(x => {
    const fmt = temFormato(x.q), bloco = t => esc(t).replace(/\n/g, "<br>");
    const sua = x.perdida ? "<i>perdida por sair da prova</i>" : x.r === undefined ? "<i>não respondida</i>" : x.q.tipo === "sql" ? bloco(textoRespostaSql(x.q, x.r)) : x.q.tipo === "web" ? bloco(textoRespostaWeb(x.q, x.r)) : x.q.tipo === "diagrama" ? bloco(textoRespostaDiagrama(x.q, x.r)) : fmt ? bloco(textoResposta(x.q, x.r)) : x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.r] ?? x.r) : `<span class="mono">${esc(x.r)}</span>`;
    const certa = x.q.tipo === "diagrama" ? bloco(textoGabaritoDiagrama(x.q, x.g)) : fmt ? bloco(textoChave(x.q, x.g) || "—") : x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.g.correta] ?? "—") : esc((x.g.respostasAceitas || [])[0] || "—");
    const cls = x.status === "certa" ? "certa" : ["errada", "em_branco", "perdida"].includes(x.status) ? "errada" : "outra";
    const rapida = x.r !== undefined && typeof x.segundos === "number" && x.segundos < RAPIDO;
    const tempo = typeof x.segundos === "number" ? ` · <span class="${rapida ? "rapida" : ""}">⏱ ${fmtTempo(x.segundos)}${rapida ? ` (menos de ${RAPIDO} s)` : ""}</span>` : "";
    return `<div class="q ${cls}"><b>Questão ${x.n}</b> — ${rot[x.status]} · ${x.pontos}/${x.peso}${tempo}<div style="white-space:pre-wrap;margin:4px 0">${esc(x.q.enunciado)}</div>
      <div><b>Resposta do aluno:</b> ${sua}${typeof dicaTag === "string" ? dicaTag : ""}</div>${x.status !== "certa" && certa !== "—" ? `<div><b>Resposta correta:</b> ${certa}</div>` : ""}
      ${x.g.explicacao ? `<div class="exp"><b>Por quê:</b> ${esc(x.g.explicacao)}</div>` : ""}${x.comentario ? `<div class="peq"><b>Comentário do professor:</b> ${esc(x.comentario)}</div>` : ""}</div>`;
  }).join("");
  return h + (quebra ? `<div class="quebra"></div>` : "");
}
$("#btnPDFNotas").onclick = () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  const p = resDados.prova, fin = resDados.linhas.filter(l => l.t.finalizadaEm);
  const media = fin.length ? (fin.reduce((s, l) => s + l.nota, 0) / fin.length).toFixed(1) : "—";
  const corpo = cab(`Notas — ${p.titulo}`, `${p.turma || ""} · ${resDados.linhas.length} aluno(s) · média ${media} · gerado em ${new Date().toLocaleString("pt-BR")}`) +
    `<table><tr><th>#</th><th>Aluno</th><th>E-mail</th><th>Finalizada</th><th>Tempo</th><th>Sinais</th><th>Nota</th></tr>` +
    resDados.linhas.map((l, i) => `<tr class="${l.temSinal ? "sinal" : ""}"><td>${i + 1}</td><td>${esc(l.t.nome || "")}</td><td>${esc(l.t.email)}</td><td>${l.t.finalizadaEm ? dataBR(l.t.finalizadaEm) : "em andamento"}</td><td>${fmtTempo(l.tempo)}${l.rapidas ? `<br><span class="rapida">${l.rapidas} resp. &lt; ${RAPIDO} s</span>` : ""}</td><td>${sinaisTexto(l.sinais)}${l.t.encerradaPor === "trocasDeAba" ? `<br><span class="rapida">encerrada: limite de saídas</span>` : ""}${l.perdidas ? `<br><span class="rapida">${l.perdidas} perdida(s)</span>` : ""}</td><td><b>${l.nota}</b>${textoConvertida(resDados.prova, l.t.email, l.nota) ? `<br>→ ${textoConvertida(resDados.prova, l.t.email, l.nota)}` : ""}</td></tr>`).join("") + "</table>" +
    `<p class="peq">Sinais = trocas de aba/janela · saídas da tela cheia · tentativas de colar. Linhas destacadas têm pelo menos um sinal. São indícios para conferir, não prova de cola.</p>`;
  abrirImpressao(`Notas — ${p.titulo}`, corpo);
};
$("#btnPDFBoletins").onclick = () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  const ls = resDados.linhas.filter(l => l.t.finalizadaEm);
  if (!ls.length) return toast("Ninguém finalizou ainda.", "erro");
  abrirImpressao(`Boletins — ${resDados.prova.titulo}`, ls.map((l, i) => boletimHTML(l, i < ls.length - 1)).join(""));
};

// ============================================================ CORREÇÃO POR IA (só o administrador principal)
// A chave fica em config/ia (regra: só o superadmin lê/grava) e só sai deste navegador para api.anthropic.com.
let iaCfg = null;                 // { chave, modelo } — só em memória, nunca na tela
const filaIA = [], emFilaIA = new Set(), tentadasAutoIA = new Set(), errosIA = new Map();
let rodandoIA = false, iaFeitas = 0, iaErros = 0;

async function carregarIA() {
  $("#cardIA").classList.toggle("oculto", !souDono());
  $("#iaControles").classList.toggle("oculto", !souDono());
  if (!souDono()) { iaCfg = null; return; }
  try { iaCfg = await lerConfigIA(); } catch (e) { iaCfg = null; console.warn("config/ia", e); }
  $("#iaModelo").innerHTML = MODELOS_IA.map(m => `<option value="${m.id}">${esc(m.nome)}</option>`).join("");
  $("#iaModelo").value = iaCfg?.modelo || MODELO_PADRAO;
  $("#iaChave").value = "";
  $("#iaChaveAtual").innerHTML = iaCfg ? `Chave salva: <span class="mono">${esc(finalChave(iaCfg.chave))}</span> · atualizada em ${dataBR(iaCfg.atualizadoEm)}` : "Nenhuma chave salva.";
  atualizarControlesIA();
}
function pintarResumoIA(revisar) {
  $("#iaResumo").textContent = [iaCfg?.modelo || "configure a chave em Configuração", revisar === null ? "" : pl(revisar, "resposta a revisar", "respostas a revisar")].filter(Boolean).map(x => " · " + x).join("");
}
function atualizarControlesIA() {
  const ok = souDono() && !!iaCfg;
  $("#btnCorrigirIA").disabled = !ok || rodandoIA; $("#btnPenteFino").disabled = !ok || rodandoIA; $("#iaAuto").disabled = !ok; $("#iaRefazer").disabled = !ok;
  if (!ok) $("#iaAuto").checked = false;
  const p = resDados?.prova, estado = !p ? "" : p.iaAutomatica === false ? " Esta prova: correção automática DESLIGADA (ligue na aba Provas)." : urlCorretorCfg ? " Esta prova: corrigida pelo servidor quando o aluno finaliza." : " Esta prova: corrigida por este painel com o ao vivo ligado.";
  $("#iaAviso").textContent = (ok ? `Modelo: ${iaCfg.modelo}. A IA pode errar: confira as marcadas com 🤖 IA.` : "Configure a chave em Configuração.") + estado;
  pintarResumoIA(resDados?.linhas ? resDados.linhas.reduce((s, l) => s + l.revisar, 0) : null);
}
// chave digitada agora, ou a salva
const chaveDigitada = () => $("#iaChave").value.trim();
$("#btnTestarIA").onclick = async () => {
  const chave = chaveDigitada() || iaCfg?.chave, modelo = $("#iaModelo").value;
  if (!chave) return toast("Cole a chave da API primeiro.", "erro");
  $("#msgIA").textContent = "Testando…"; $("#btnTestarIA").disabled = true;
  try { await testarChave(chave, modelo); $("#msgIA").textContent = `✅ Chave OK com ${modelo}.`; }
  catch (e) { $("#msgIA").textContent = "⚠ " + (e.ia ? e.message : traduzirErro(e)); }
  $("#btnTestarIA").disabled = false;
};
$("#btnSalvarIA").onclick = async () => {
  if (!souDono()) return toast("Só o administrador principal configura a IA.", "erro");
  const chave = chaveDigitada() || iaCfg?.chave, modelo = $("#iaModelo").value;
  if (!chave) return toast("Cole a chave da API.", "erro");
  if (!/^sk-ant-/.test(chave)) return toast("A chave da Anthropic começa com sk-ant-. Confira se copiou inteira.", "erro");
  if (!(await confirmar(`Salvar a configuração da IA (modelo ${modelo})? A correção e as adaptações passam a usar esta chave.`, { titulo: "Salvar IA", ok: "Salvar" }))) return;
  try { await salvarConfigIA(chave, modelo, eu.email); toast("Configuração da IA salva.", "ok"); $("#msgIA").textContent = ""; await carregarIA(); }
  catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); }
};
$("#btnApagarIA").onclick = async () => {
  if (!souDono() || !iaCfg) return;
  if (!(await confirmar("Apagar a chave da API salva? A correção por IA para de funcionar até você salvar outra. (Para invalidar a chave de vez, apague-a também no console da Anthropic.)", { titulo: "Apagar chave", ok: "Apagar", perigo: true }))) return;
  try { await apagarConfigIA(); toast("Chave apagada.", "ok"); await carregarIA(); } catch (e) { toast("Não foi possível apagar. " + traduzirErro(e), "erro"); }
};

// dissertativas de tentativas FINALIZADAS que ainda precisam de correção
function pendentesIA({ refazer = false } = {}) {
  if (!resDados) return [];
  const lista = [];
  for (const l of [...resDados.linhas, ...resDados.testes]) {
    if (!l.t.finalizadaEm) continue;
    for (const x of l.itens) {
      if (x.q.tipo !== "dissertativa" || temFormato(x.q) || x.perdida || x.r === undefined || x.r === null || String(x.r).trim() === "") continue;
      if (x.manual) continue;   // correção manual do professor: a IA nunca mexe
      if (x.status === "revisar" || (refazer && x.ia)) lista.push({ tid: l.t.id, qid: x.qid, q: x.q, g: x.g, resposta: x.r, nome: l.t.nome || l.t.email, n: x.n, refazer });
    }
  }
  return lista;
}
function corrigirPendentesIA({ auto = false, refazer = null } = {}) {
  if (!souDono() || !iaCfg) return;
  let itens = pendentesIA({ refazer: refazer ?? (!auto && $("#iaRefazer").checked) });
  if (auto) itens = itens.filter(it => !tentadasAutoIA.has(it.tid + "/" + it.qid));   // ao vivo: nunca repete (nem as que deram erro)
  let novos = 0;
  for (const it of itens) {
    const k = it.tid + "/" + it.qid;
    if (emFilaIA.has(k)) continue;
    emFilaIA.add(k); if (auto) tentadasAutoIA.add(k); filaIA.push(it); novos++;
  }
  if (!auto && !novos && !rodandoIA) { toast("Nenhuma dissertativa pendente nesta prova.", "info"); return; }
  if (!novos && auto) return;
  processarFilaIA({ silencioso: auto });
}
let tarefaIA = null;   // painel de progresso da correção (canto da tela)
function mostrarProgressoIA(atual) {
  const total = iaFeitas + iaErros + filaIA.length + (atual ? 1 : 0);
  if (atual && tarefaIA) tarefaIA.total(total).passo(iaFeitas + iaErros, `${atual.nome} · questão ${atual.n}${iaErros ? ` · ${iaErros} com erro` : ""}`);
  const el = $("#iaProgresso");
  const feitos = iaFeitas + iaErros;
  if (iaSilencioso) {   // automático: uma linha só, com o total desde que o painel abriu
    el.innerHTML = `🤖 Correção automática: <b>${autoFeitas + iaFeitas}</b> dissertativa(s) corrigida(s) das provas entregues` +
      (atual ? ` · corrigindo ${feitos + 1} de ${total}…` : "") + (autoErros + iaErros ? ` · <span class="erro-texto">${autoErros + iaErros} com erro</span>` : "");
    return;
  }
  if (!total) { el.innerHTML = ""; return; }
  el.innerHTML = `<progress class="barra" max="${total}" value="${feitos}"></progress> ` +
    (atual ? `Corrigindo ${feitos + 1} de ${total} — ${esc(atual.nome)}, Q${atual.n}` : `Concluído: ${iaFeitas} corrigida(s)`) + (iaErros ? ` · <span class="erro-texto">${iaErros} com erro</span>` : "");
}
// uma chamada por vez
// DESLIZES (vírgula esquecida, letra trocada): a IA dá a nota cheia com aviso. Se acontecer em 3 ou mais questões
// da mesma prova, cada uma perde 1/4 do peso (mínimo 0,25). Uma vez ou outra não pesa. Correção manual nunca é mexida.
// Mesma regra do servidor (servidor/corretor-worker.js ajusteDeslizes).
const DESLIZES_PARA_DESCONTAR = 3;
function ajusteDeslizes(corrs) {
  const ds = Object.entries(corrs || {}).filter(([, c]) => c && c.deslize === true && String(c.corrigidoPor || "").startsWith("ia:") && Number.isFinite(Number(c.pontosBase)));
  const repetido = ds.length >= DESLIZES_PARA_DESCONTAR, out = {};
  for (const [qid, c] of ds) {
    const base = Number(c.pontosBase), peso = Number(c.peso || 1);
    const desconto = repetido ? Math.min(base, Math.max(0.25, Math.round(peso * 0.25 * 4) / 4)) : 0;
    const pontos = Math.round((base - desconto) * 100) / 100;
    const comentario = String(c.comentarioBase ?? c.comentario ?? "") + (desconto ? ` (Deslize repetido em ${ds.length} questões da prova: −${String(desconto).replace(".", ",")}.)` : "");
    if (Number(c.pontos) !== pontos || c.comentario !== comentario || Number(c.desconto || 0) !== desconto) out[qid] = { pontos, comentario, desconto };
  }
  return out;
}
async function ajustarDeslizes(tid) {
  const corrs = {}; (await getDocs(collection(db, "tentativas", tid, "correcoes"))).forEach(d => corrs[d.id] = d.data());
  await Promise.all(Object.entries(ajusteDeslizes(corrs)).map(([qid, d]) => updateDoc(doc(db, "tentativas", tid, "correcoes", qid), d)));
}
let iaSilencioso = false, autoFeitas = 0, autoErros = 0;   // automático: sem janela de progresso nem aviso no fim
async function processarFilaIA({ silencioso = false } = {}) {
  if (rodandoIA) return;
  rodandoIA = true; iaFeitas = 0; iaErros = 0; iaSilencioso = silencioso; atualizarControlesIA();
  tarefaIA = silencioso ? null : tarefa({ titulo: "Corrigindo dissertativas com IA", icone: "🤖", total: filaIA.length, texto: "Começando…" });
  const provaId = resDados?.prova.id;
  try {
    while (filaIA.length) {
      const it = filaIA[0];
      mostrarProgressoIA(it);
      const k = it.tid + "/" + it.qid, ref = doc(db, "tentativas", it.tid, "correcoes", it.qid);
      try {
        // confere de novo no servidor: o professor pode ter corrigido à mão enquanto a fila andava
        const atual = await getDoc(ref);
        const porIA = String(atual.data()?.corrigidoPor || "").startsWith("ia:");
        if (atual.exists() && (!porIA || !it.refazer)) { filaIA.shift(); emFilaIA.delete(k); continue; }
        const r = await corrigirDissertativa({ chave: iaCfg.chave, modelo: iaCfg.modelo, q: it.q, g: it.g, resposta: it.resposta });
        await setDoc(ref, { pontos: r.pontos, comentario: r.justificativa, corrigidoPor: "ia:" + iaCfg.modelo, corrigidoEm: serverTimestamp(),
                            deslize: r.deslize, pontosBase: r.pontos, comentarioBase: r.justificativa, peso: Number(it.q.peso || 1) });
        await ajustarDeslizes(it.tid).catch(e => console.warn("deslizes", e));
        errosIA.delete(k); iaFeitas++;
        if (resDados?.prova.id === provaId) { await atualizarCache(await getDoc(doc(db, "tentativas", it.tid))); montarResultados(); }
      } catch (e) {
        console.warn("IA", e);
        iaErros++; errosIA.set(k, e.ia ? e.message : traduzirErro(e));
        if (e.fatal) {   // chave/crédito/modelo: não adianta continuar; desliga o automático
          toast("Correção por IA parada: " + e.message, "erro");
          filaIA.splice(1).forEach(x => emFilaIA.delete(x.tid + "/" + x.qid));
          $("#iaAuto").checked = false; tentadasAutoIA.clear();
        }
      }
      filaIA.shift(); emFilaIA.delete(k);
    }
    if (iaErros && resDados?.prova.id === provaId) montarResultados();   // mostra os erros no detalhe
  } finally {
    rodandoIA = false; atualizarControlesIA();
    if (iaSilencioso) { autoFeitas += iaFeitas; autoErros += iaErros; iaFeitas = 0; iaErros = 0; mostrarProgressoIA(null); iaSilencioso = false; return; }
    mostrarProgressoIA(null);
    if (iaErros && !iaFeitas) tarefaIA?.erro(`${iaErros} com erro: veja no detalhe do aluno.`); else tarefaIA?.fim(`${iaFeitas} corrigida(s)${iaErros ? ` · ${iaErros} com erro` : ""}`);
    tarefaIA = null;
    if (iaFeitas || iaErros) toast(`IA: ${iaFeitas} corrigida(s)${iaErros ? `, ${iaErros} com erro (veja no detalhe do aluno)` : ""}.`, iaErros ? "erro" : "ok");
  }
}
// PENTE FINO: corrige de novo, com as regras atuais, todas as dissertativas desta prova que a IA já corrigiu (e as pendentes).
// A correção manual do professor nunca é mexida.
$("#btnPenteFino").onclick = async () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  if (rodandoIA) return toast("A IA já está corrigindo. Espere terminar.", "erro");
  const itens = pendentesIA({ refazer: true });
  if (!itens.length) return toast("Nenhuma dissertativa corrigida pela IA nesta prova.", "info");
  const alunos = new Set(itens.map(x => x.tid)).size;
  if (!(await confirmar(`Corrigir de novo ${pl(itens.length, "resposta", "respostas")} de ${pl(alunos, "aluno", "alunos")} com as regras atuais da IA?\n\nAs suas correções manuais não mudam. É uma chamada à IA por resposta (gasta créditos) e leva alguns minutos.`,
    { titulo: "🔎 Pente fino", ok: "Corrigir de novo" }))) return;
  corrigirPendentesIA({ refazer: true });
};
$("#btnCorrigirIA").onclick = () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  corrigirPendentesIA();
};
$("#iaAuto").onchange = () => {
  if (!$("#iaAuto").checked) return;
  if (!$("#rProva").value) { $("#iaAuto").checked = false; return toast("Escolha uma prova primeiro: a correção automática vale para a prova aberta em Resultados.", "erro"); }
  if (!$("#rAoVivo").checked) { $("#rAoVivo").checked = true; carregarResultados(); }   // a correção automática precisa do ao vivo
  else corrigirPendentesIA({ auto: true });
};
