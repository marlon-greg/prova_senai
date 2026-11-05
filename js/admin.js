// Painel do professor: provas, bancos (import JSON), resultados/correção, equipe, configuração.
import { db, auth, entrar, sair, aoMudarLogin, identificar, corrigir, esc, $, toast, dataBR, letra, SUPER_ADMIN, apagarTentativaTeste,
         confirmar, modal, traduzirErro, iniciais, temaDe, ordenarTemas, chaveNome, placar, idsConsulta, bancosDaProva, temasDoBanco,
         rotuloDias, nomeTurma, HORARIO_PADRAO, textoHorario, DIAS_SEMANA_LONGO,
         semestreDe, rotuloSemestre, semestreVizinho, semestreDaProva, materiaDaProva, chaveTexto, dataCurta } from "./common.js";
import { enviarMaterial, listarMateriais, apagarMaterial, baixarMaterial, tamanhoTexto, MAX_MB, erroMaterial, abrirMaterialEmAba } from "./material.js";
import { MODELOS_IA, MODELO_PADRAO, lerConfigIA, salvarConfigIA, apagarConfigIA, finalChave, testarChave, corrigirDissertativa } from "./ia.js";
import { abrirLeitorPdf } from "./leitor-pdf.js";
import { iniciarOrganizacao, carregarOrganizacao, listarPlanos, listarCursos, materiasSugeridas, editarTopicosBanco, topicosDaMateria } from "./admin-org.js";
import { iniciarDiario, carregarDiario } from "./admin-diario.js";
import { ligarAjuda } from "./ajuda.js";
import { iniciarRelatorios, carregarRelatorios } from "./admin-relatorios.js";
import { iniciarGamificacao, carregarGamificacao, carregarRetorno } from "./admin-gamificacao.js";
import { mesclarQuestao } from "./acessibilidade.js";
import { temFormato, textoResposta, textoChave, FORMATOS } from "./formatos-ui.js";
import { iniciarAcessibilidade, carregarAcessibilidade, prepararNovo as prepararNovoAcess, abrirDepois } from "./admin-acess.js";
import { iniciarHistorico, carregarHistorico } from "./admin-historico.js";
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp, onSnapshot, increment, deleteField }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let eu = null;   // { email, nome, papel }
const podeEditar = () => ["admin", "professor"].includes(eu?.papel);
const ehAdmin = () => eu?.papel === "admin";
// auxiliar de inclusão: só vê os alunos vinculados a ela (aba Acessibilidade e Resultados deles)
const ehInclusao = () => eu?.papel === "inclusao";
// pode mexer nas vidas / reabrir: professor, admin e a auxiliar de inclusão (nos alunos dela; as regras conferem)
const podeCuidar = () => podeEditar() || ehInclusao();
let urlCorretorCfg = "", horarioCfg = HORARIO_PADRAO;   // servidor de correção/adaptação (config/geral.urlCorretor)
const ABAS_INCLUSAO = ["diario", "acessibilidade", "historico", "resultados"];
// administrador principal: o único que vê e usa a chave da IA (as regras também só deixam ele ler config/ia)
const souDono = () => !!eu && eu.email === SUPER_ADMIN.toLowerCase();

// ---------- login ----------
$("#btnEntrar").onclick = async () => { try { await entrar(); } catch (e) { $("#msgLogin").textContent = "Não foi possível entrar. " + traduzirErro(e); } };
$("#btnSair").onclick = () => sair();
aoMudarLogin(async user => {
  if (!user) { eu = null; $("#btnSair").classList.add("oculto"); $("#avatar").classList.add("oculto"); $("#quem").textContent = ""; trocar("telaLogin"); return; }
  const id = await identificar(user);
  $("#quem").textContent = `${id.email}${id.papel ? " · " + id.papel : ""}`; $("#btnSair").classList.remove("oculto");
  $("#avatar").textContent = iniciais(user.displayName || id.email); $("#avatar").title = user.displayName || id.email; $("#avatar").classList.remove("oculto");
  if (id.tipo === "aluno") { location.replace("index.html"); return; }   // aluno no painel: vai para a página dele
  if (id.tipo !== "equipe") {
    $("#avisoTexto").innerHTML = `<h2>Sem acesso ao painel</h2><p>A conta <b>${esc(id.email)}</b> não está na equipe. Peça ao administrador para cadastrar.</p><p><a href="index.html">Ir para a página do aluno</a></p>`;
    trocar("telaAviso"); return;
  }
  eu = id;
  await garantirConfig();
  await carregarIA();
  getDoc(doc(db, "config", "geral")).then(c => { urlCorretorCfg = String(c.data()?.urlCorretor || "").trim(); if (c.data()?.horario?.inicio) horarioCfg = c.data().horario; $("#tHorario").textContent = textoHorario(horarioCfg); }).catch(() => {});
  iniciarAcessibilidade({ eu, podeEditar, souDono, auth, iaCfg: () => iaCfg, urlCorretor: () => urlCorretorCfg,
    alunosDasTurmas: async () => { await listarTurmas().catch(() => {}); return turmasCache.flatMap(t => alunosDaTurma(t).map(a => ({ ...a, turma: t.nome, turmaId: t.id, diasAula: t.diasAula || [] }))); } });
  iniciarDiario({ eu, podeEditar, souDono, horario: () => horarioCfg,
    alunosDasTurmas: async () => { await listarTurmas().catch(() => {}); return turmasCache.flatMap(t => alunosDaTurma(t).map(a => ({ ...a, turma: t.nome, turmaId: t.id, diasAula: t.diasAula || [] }))); } });
  iniciarHistorico({ eu, abrirAluno: email => { abrirDepois(email); abrirAba("acessibilidade"); },
    alunosDasTurmas: async () => { await listarTurmas().catch(() => {}); return turmasCache.flatMap(t => alunosDaTurma(t).map(a => ({ ...a, turma: t.nome, turmaId: t.id }))); } });
  iniciarRelatorios({ listarTurmas, listarBancos });
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
  document.body.classList.toggle("papel-inclusao", ehInclusao());
  abrirAba(ehInclusao() ? "diario" : "provas");
});
function trocar(id) { ["telaLogin", "telaPainel", "telaAviso"].forEach(t => $("#" + t).classList.toggle("oculto", t !== id)); }
let abaAtual = "provas";
function abrirAba(a) {
  abaAtual = a; ligarAjuda(() => abaAtual);
  if (a !== "resultados" && $("#rAoVivo").checked) { $("#rAoVivo").checked = false; pararAoVivo(); }   // sair da aba desliga o ao vivo
  document.querySelectorAll("[data-aba]").forEach(b => b.classList.toggle("ativa", b.dataset.aba === a));
  ["organizacao", "diario", "historico", "retorno", "relatorios", "gamificacao", "provas", "bancos", "turmas", "resultados", "acessibilidade", "equipe", "config"].forEach(x => $("#aba-" + x).classList.toggle("oculto", x !== a));
  return ({ organizacao: carregarOrganizacao, diario: carregarDiario, historico: carregarHistorico, retorno: carregarRetorno, relatorios: carregarRelatorios, gamificacao: carregarGamificacao, provas: carregarProvas, bancos: () => { carregarBancos(); carregarMateriais(); }, turmas: carregarTurmas, resultados: prepararResultados,
     acessibilidade: () => { carregarAcessibilidade(); if (podeEditar()) prepararNovoAcess(); }, equipe: carregarEquipe, config: carregarConfig })[a]();
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
  for (const tema of ordenarTemas(questoes.map(temaDe))) c[tema] = { alternativa: 0, dissertativa: 0 };
  questoes.forEach(q => { const k = q.tipo === "dissertativa" ? "dissertativa" : "alternativa"; c[temaDe(q)][k]++; });
  return c;
}
const textoContagem = n => `${n.alternativa} alternativa, ${n.dissertativa} dissertativa`;
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
$("#ftBusca").oninput = $("#ftSemestre").onchange = $("#ftMateria").onchange = $("#ftDia").onchange = () => desenharTurmas();
const marcarDias = l => document.querySelectorAll("#tDias input").forEach(c => c.checked = (l || []).map(Number).includes(Number(c.value)));
const diasMarcados = () => [...document.querySelectorAll("#tDias input:checked")].map(c => Number(c.value));
function limparFormTurma() {
  turmaEditando = null; $("#tNome").value = ""; $("#tEmails").value = ""; previaTurma(); marcarDias([]);
  $("#tFormTitulo").textContent = "Nova turma"; $("#btnCancelarTurma").classList.add("oculto");
}
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
  const dados = { nome, diasAula: diasMarcados(), alunos: alunos.map(a => ({ nome: a.nome || "", email: a.email || null })), emails, nomesChave, vinculos: {} };
  if (!dados.diasAula.length && !(await confirmar("Nenhum dia de aula marcado. Sem os dias, o diário considera segunda a sexta. Salvar assim?", { titulo: "Dias de aula", ok: "Salvar assim", cancelar: "Voltar e marcar" }))) return;
  try {
    if (turmaEditando) await updateDoc(doc(db, "turmas", turmaEditando), { ...dados, atualizadoEm: serverTimestamp(), atualizadoPor: eu.email });
    else await addDoc(collection(db, "turmas"), { ...dados, criadoEm: serverTimestamp(), criadoPor: eu.email });
  } catch (e) { return toast("Não foi possível salvar a turma. " + traduzirErro(e), "erro"); }
  toast(`Turma ${nome} salva com ${alunos.length} aluno(s)` + (nomesChave.length ? ` (${nomesChave.length} aguardando o 1º login).` : "."), "ok");
  limparFormTurma(); carregarTurmas();
};
let provasPorTurma = {}, turmaSemMat = {};   // turmaId -> [{ id, titulo, liberada }]
async function carregarTurmas() {
  const [, ps, pls] = await Promise.all([listarTurmas(), getDocs(collection(db, "provas")).catch(() => null), listarPlanos().catch(() => []), listarBancos().catch(() => [])]);
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
  if (!turmasCache.length) { $("#ftContagem").textContent = ""; box.innerHTML = `<div class="vazio"><div class="icone">👥</div><p>Nenhuma turma ainda. Cadastre a primeira acima colando os nomes completos (ou e-mails) dos alunos.</p></div>`; return; }
  const busca = semAcento($("#ftBusca").value.trim()), fS = $("#ftSemestre").value, fM = chaveTexto($("#ftMateria").value), fD = $("#ftDia").value;
  // pesquisa no nome da turma ou nos alunos (nome/e-mail); achou aluno = abre a lista com só quem bateu
  const linhas = turmasCache.filter(t => !fD || (t.diasAula || []).map(String).includes(fD)).filter(t => (!fS && !fM) || (turmaSemMat[t.id] || []).some(x => (!fS || x.sem === fS) && (!fM || x.mat === fM))).map(t => {
    const al = alunosDaTurma(t);
    if (!busca || semAcento(`${t.nome} ${(t.diasAula || []).map(d => DIAS_SEMANA_LONGO[d]).join(" ")} ${rotuloDias(t.diasAula)}`).includes(busca)) return { t, al, achados: null };
    const achados = al.filter(a => semAcento(`${a.nome} ${a.email || ""}`).includes(busca));
    return achados.length ? { t, al, achados } : null;
  }).filter(Boolean);
  $("#ftContagem").textContent = busca || fS || fM || fD ? `${linhas.length} de ${turmasCache.length} turma(s)` + (linhas.some(l => l.achados) ? ` · ${linhas.reduce((n, l) => n + (l.achados?.length || 0), 0)} aluno(s) encontrado(s)` : "") : `${turmasCache.length} turma(s)`;
  if (!linhas.length) { box.innerHTML = `<div class="vazio"><div class="icone">🔎</div><p>Nenhuma turma ou aluno com esses filtros.</p></div>`; return; }
  box.innerHTML = `<div class="tabela"><table><tr><th>Turma</th><th>Alunos</th><th>Provas</th><th>Atualizada</th><th></th></tr>` + linhas.map(({ t, al, achados }) => {
    const pend = al.filter(a => !a.email), auto = al.filter(a => a.auto), mostrar = achados || al;
    const lista = mostrar.map(a => `<li>${a.email ? "✅" : "⏳"} ${esc(a.nome || a.email)}${a.nome && a.email ? ` <span class="pequeno">${esc(a.email)}${a.auto ? " · vinculado no login" : ""}</span>` : ""}${!a.email ? ` <span class="pequeno">— aguardando o 1º login</span>` : ""}</li>`).join("");
    const pv = provasPorTurma[t.id] || [];
    return `<tr><td><b>${esc(t.nome)}</b><br>${rotuloDias(t.diasAula) ? `<span class="tag nota" title="Dias de aula">📆 ${rotuloDias(t.diasAula)}</span>` : `<span class="tag aviso" title="Edite a turma e marque os dias de aula">📆 sem dias</span>`}<br><span class="pequeno">${t.id}</span></td>
     <td>${al.length}${pend.length ? `<br><span class="tag aviso">⏳ ${pend.length} sem login ainda</span>` : ""}${auto.length ? `<br><span class="pequeno">${auto.length} vinculado(s) pelo nome</span>` : ""}
       <details class="lista-alunos" ${achados ? "open" : ""}><summary class="pequeno">${achados ? `${achados.length} encontrado(s)` : "ver alunos"}</summary><ul>${lista}</ul></details></td>
     <td>${pv.length ? `<button class="leve mini" data-vprovas="${t.id}" title="${esc(pv.map(p => p.titulo).join(" · "))}">📝 ${pv.length} prova(s)</button>${pv.some(p => p.liberada) ? `<br><span class="tag on">● ${pv.filter(p => p.liberada).length} liberada(s)</span>` : ""}` : `<span class="pequeno">nenhuma</span>`}</td>
     <td class="pequeno">${dataBR(t.atualizadoEm || t.criadoEm)}</td>
     <td class="td-acoes">${podeEditar() ? `<button class="leve mini" data-edt="${t.id}">✎ Editar</button>` : ""} ${ehAdmin() ? `<button class="perigo mini" data-delt="${t.id}">🗑 Apagar</button>` : ""}</td></tr>`;
  }).join("") + "</table></div>";
  box.querySelectorAll("[data-vprovas]").forEach(b => b.onclick = () => { filtroTurmaPendente = b.dataset.vprovas; $("#fpBusca").value = ""; $("#fpStatus").value = ""; abrirAba("provas"); });
  box.querySelectorAll("[data-edt]").forEach(b => b.onclick = () => {
    const t = turmasCache.find(x => x.id === b.dataset.edt);
    turmaEditando = t.id; $("#tNome").value = t.nome || ""; $("#tEmails").value = alunosDaTurma(t).map(linhaAluno).join("\n"); previaTurma(); marcarDias(t.diasAula);
    $("#tFormTitulo").textContent = `Editar turma ${t.nome}`; $("#btnCancelarTurma").classList.remove("oculto");
    $("#tNome").scrollIntoView({ behavior: "smooth", block: "center" }); $("#tNome").focus();
  });
  box.querySelectorAll("[data-delt]").forEach(b => b.onclick = async () => {
    const t = turmasCache.find(x => x.id === b.dataset.delt);
    const usadas = (await getDocs(query(collection(db, "provas"), where("turmaId", "==", t.id)))).size;
    if (!(await confirmar(`Apagar a turma ${t.nome}?` + (usadas ? `\n\n${usadas} prova(s) usam esta turma: elas deixam de aceitar qualquer aluno até você escolher outra turma.` : ""), { titulo: "Apagar turma", ok: "Apagar", perigo: true }))) return;
    await deleteDoc(doc(db, "turmas", t.id)); if (turmaEditando === t.id) limparFormTurma(); carregarTurmas();
  });
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
  if (!materiaisCache.length) { box.innerHTML = `<p class="pequeno">Nenhum PDF enviado ainda.</p>`; return; }
  box.innerHTML = `<div class="tabela"><table><tr><th>Material</th><th>Tamanho</th><th>Enviado</th><th></th></tr>` + materiaisCache.map(m =>
    `<tr><td><b>${esc(m.titulo)}</b><br><span class="pequeno">${esc(m.arquivo || "")}</span></td><td>${tamanhoTexto(m.tamanho)}</td><td class="pequeno">${dataBR(m.criadoEm)}<br>${esc(m.criadoPor || "")}</td>
     <td class="td-acoes"><button class="leve mini" data-vermat="${m.id}" title="Abre o PDF numa aba nova">👁 Ver</button> ${podeEditar() ? `<button class="perigo mini" data-delmat="${m.id}">🗑 Apagar</button>` : ""}</td></tr>`).join("") + "</table></div>";
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
    <div><label for="${f}Materia">Matéria</label><input type="text" id="${f}Materia" list="${f}Materias" placeholder="vazio = a do 1º banco"><datalist id="${f}Materias"></datalist></div>
    <div><label for="${f}Data">Data da prova</label><input type="date" id="${f}Data">
      <p class="pequeno" style="margin:4px 0 0">Organiza a prova em Turma → Semestre → Matéria (aba Organização) e nos relatórios.</p></div>
  </div>
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
    <legend>Regras da prova</legend>
    <p class="pequeno" style="margin-top:0">A ordem das questões e das alternativas é sempre embaralhada para cada aluno. Durante a prova o aluno não vê se acertou; no fim vê só quantas acertou e a nota.</p>
    <label class="check"><input type="checkbox" id="${f}Voltar"> <span>Permitir ir e voltar entre as questões <span class="pequeno">— o aluno pode alterar as respostas até clicar em Finalizar; sem isso, cada resposta enviada fica travada</span></span></label>
    <label class="check"><input type="checkbox" id="${f}PermitirTrocaAba"> <span>Permitir trocar de aba/janela <span class="pequeno">— sem tela cheia e sem aviso; as trocas continuam contadas, marcadas como "permitido"</span></span></label>
    <label class="check"><input type="checkbox" id="${f}PermitirColar"> <span>Permitir colar nos campos de resposta <span class="pequeno">— colar e arrastar liberados, sem registro</span></span></label>
    <div class="grade" style="margin:12px 0 0">
      <div><label for="${f}MaxTrocas">❤️ Vidas do aluno (0 = sem vidas)</label><input type="number" id="${f}MaxTrocas" value="0" min="0" max="10" step="1"></div>
      <div><label for="${f}AcaoExceder">Quando as vidas acabam</label>
        <select id="${f}AcaoExceder"><option value="encerrar">Encerrar a prova</option><option value="perderQuestao">Perder a questão atual (só em "uma por vez" sem ir e voltar)</option></select></div>
    </div>
    <label class="check"><input type="checkbox" id="${f}ColarVida" checked> <span>Tentar colar (Ctrl+V) também custa 1 vida</span></label>
    <p class="pequeno" id="${f}LimiteDica">Perde 1 vida: trocar de aba/janela (Alt+Tab) ou sair da tela cheia.</p>
    <p class="pequeno" style="margin:4px 0 0">Aluno perdeu vidas sem querer (ex.: TEA)? Em <b>Resultados</b> você restaura as vidas, dá vida extra ou reabre a prova dele.</p>
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
  // sel: bancoId -> Set de temas marcados (null = "todos", resolvido quando os temas do banco carregam)
  // contagens: bancoId -> { tema: {alternativa, dissertativa} } ou "erro"; abertos: bancos expandidos na visão por banco
  let sel = new Map(), contagens = {}, abertos = new Set(), carregando = null;
  const temasDe = b => contagens[b] && contagens[b] !== "erro" ? Object.keys(contagens[b]) : [];
  const bancosMarcados = () => bancosCache.map(b => b.id).filter(b => sel.get(b)?.size && temasDe(b).length);
  const disponiveis = () => {
    const d = { alternativa: 0, dissertativa: 0 };
    for (const b of bancosMarcados()) for (const t of sel.get(b)) { const c = contagens[b][t]; if (c) { d.alternativa += c.alternativa; d.dissertativa += c.dissertativa; } }
    return d;
  };
  const carregado = () => bancosCache.some(b => contagens[b.id]);
  // devolve a mensagem de erro (ou "") para o pedido atual
  function problema() {
    const nAlt = Number($f("NAlt").value || 0), nDiss = Number($f("NDiss").value || 0), d = disponiveis();
    if (travado || !carregado()) return "";
    if (!bancosMarcados().length) return "Marque pelo menos um banco (ou um tema de algum banco).";
    if (nAlt > d.alternativa) return `Faltam questões de alternativa: a prova pede ${nAlt}, mas os bancos/temas marcados só têm ${d.alternativa}. Marque mais temas ou diminua as alternativas.`;
    if (nDiss > d.dissertativa) return `Faltam dissertativas: a prova pede ${nDiss}, mas os bancos/temas marcados só têm ${d.dissertativa}. Marque mais temas ou diminua as dissertativas.`;
    return "";
  }
  function atualizar() {
    const nAlt = Number($f("NAlt").value || 0), nDiss = Number($f("NDiss").value || 0);
    $f("NTotal").textContent = `Total: ${nAlt + nDiss} questões por aluno.`;
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
        desenharTemas();
      });
    return carregando;
  }
  const marcadoTema = (b, t) => !!sel.get(b)?.has?.(t);
  const casa = (txt, busca) => !busca || txt.toLocaleLowerCase("pt-BR").includes(busca);
  // temas visíveis com os filtros atuais: [{ b, t }]
  function temasVisiveis() {
    const busca = $f("TemasBusca").value.trim().toLocaleLowerCase("pt-BR"), so = $f("TemasSoMarcados").checked, r = [];
    for (const banco of bancosCache) {
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
      for (const banco of bancosCache) {
        const b = banco.id, c = contagens[b], dele = vis.filter(v => v.b === b);
        // com filtro, só aparecem bancos com algum tema visível (ou que ainda carregam)
        if ((busca || so) && c && !dele.length) continue;
        if (so && !c && !sel.get(b)?.size && sel.get(b) !== null) continue;
        const todos = temasDe(b), n = sel.get(b)?.size || 0, aberto = abertos.has(b) || !!busca;
        const tot = c && c !== "erro" ? Object.values(c).reduce((s, x) => ({ alternativa: s.alternativa + x.alternativa, dissertativa: s.dissertativa + x.dissertativa }), { alternativa: 0, dissertativa: 0 }) : null;
        h += `<div class="grupo-banco${n ? " marcado" : ""}" data-grupo="${b}">
          <div class="banco-cab">
            <label class="check"><input type="checkbox" data-banco="${b}"${todos.length && n === todos.length ? " checked" : ""}${!todos.length || travado ? " disabled" : ""}>
              <span><b>${esc(banco.nome)}</b> <span class="pequeno">${esc(banco.materia || "")}</span></span></label>
            <span class="pequeno banco-info">${!c ? "carregando…" : c === "erro" ? "⚠ não carregou" : `${n}/${todos.length} temas · ${textoContagem(tot)}`}</span>
            ${todos.length ? `<button type="button" class="leve mini" data-abrir="${b}" aria-expanded="${aberto}" aria-label="${aberto ? "Recolher" : "Mostrar"} temas de ${esc(banco.nome)}">${aberto ? "▾ temas" : "▸ temas"}</button>` : ""}
          </div>
          ${aberto && dele.length ? `<div class="lista-temas">${dele.map(({ t }) => checkTema(b, t)).join("")}</div>` : ""}
        </div>`;
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
    $f("MaxTrocas").disabled = troca; $f("AcaoExceder").disabled = troca;
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
    $f("NAlt").oninput = $f("NDiss").oninput = atualizar;
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
    $f("Semestre").onchange = () => { semestreMexido = true; opcoesMateria(); };
    $f("Turma").addEventListener("change", opcoesMateria);
    $f("Materia").onfocus = opcoesMateria;
    $f("Data").onchange = () => { const d = $f("Data").value; if (d && !semestreMexido) { opcoesSemestre(semestreDe(d)); opcoesMateria(); } };
  }
  // semestre (os de perto do atual + o da prova) e matérias sugeridas (planos da turma/semestre, depois as dos bancos)
  let semestreMexido = false;
  function opcoesSemestre(atual) {
    const base = semestreDe(), lista = [...new Set([-2, -1, 0, 1, 2].map(d => semestreVizinho(base, d)).concat(atual || base))].sort().reverse();
    $f("Semestre").innerHTML = lista.map(s => `<option value="${s}">${rotuloSemestre(s)}${s === base ? " (atual)" : ""}</option>`).join("");
    $f("Semestre").value = atual || base;
  }
  function opcoesMateria() {
    const sug = materiasSugeridas($f("Turma").value, $f("Semestre").value);
    $f("Materias").innerHTML = sug.map(m => `<option value="${esc(m)}">`).join("");
    const b = bancosCache.find(x => x.id === bancosMarcados()[0]);
    $f("Materia").placeholder = b?.materia ? `vazio = ${b.materia} (do banco)` : "vazio = a do 1º banco";
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
    ["NAlt", "NDiss", "TemasMarcar", "TemasDesmarcar"].forEach(s => $f(s).disabled = true);
    $f("Temas").querySelectorAll("input").forEach(x => x.disabled = true);
    $f("Trava").innerHTML = motivo; $f("Trava").classList.remove("oculto");
    atualizar();
  }
  let dadosAtuais = {};   // prova em edição (para achar a matéria do banco quando o sorteio está travado)
  function preencher(p) {
    dadosAtuais = p;
    $f("Titulo").value = p.titulo || ""; opcoesTurma(p); $f("Codigo").value = p.codigoAcesso || "";
    opcoesSemestre(semestreDaProva(p)); semestreMexido = !!p.semestre; $f("Materia").value = p.materia || ""; $f("Data").value = p.dataProva || ""; opcoesMateria();
    // provas antigas só têm o total (nQuestoes) e as dissertativas
    $f("NDiss").value = p.nDissertativas ?? 0; $f("NAlt").value = p.nAlternativas ?? Math.max(0, (p.nQuestoes ?? 10) - (p.nDissertativas ?? 0));
    $f("Tempo").value = p.tempoMinutos || 0;
    $f("Modo").value = p.modoExibicao === "todas" ? "todas" : "uma";
    $f("Voltar").checked = p.permitirVoltar === true;
    $f("PermitirTrocaAba").checked = p.permitirTrocaAba === true; $f("PermitirColar").checked = p.permitirColar === true;
    $f("MatTitulo").value = p.materialConsultaTitulo || ""; $f("MatUrl").value = p.materialConsultaUrl || "";
    opcoesMaterial(idsConsulta(p));
    $f("MaxTrocas").value = p.maxTrocasDeAba || 0; $f("AcaoExceder").value = p.acaoAoExceder === "perderQuestao" ? "perderQuestao" : "encerrar";
    $f("ColarVida").checked = p.colarTiraVida !== false;
    previaMaterial(); atualizarLimite();
  }
  // lê e valida; devolve { erro } ou { dados }
  async function ler() {
    const titulo = $f("Titulo").value.trim();
    const nAlt = Math.max(0, Math.round(Number($f("NAlt").value || 0))), nDiss = Math.max(0, Math.round(Number($f("NDiss").value || 0))), n = nAlt + nDiss;
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
    const materia = $f("Materia").value.trim() || (bancosCache.find(x => x.id === (bancoIds[0] || bancosDaProva(dadosAtuais)[0]))?.materia || "").trim();
    const dados = {
      titulo, ...turmaEscolhida(), codigoAcesso: normalizarCodigo($f("Codigo").value),
      semestre: $f("Semestre").value || semestreDe(), materia, dataProva: $f("Data").value || "",
      permitirVoltar: $f("Voltar").checked,
      tempoMinutos: Math.max(0, Math.round(Number($f("Tempo").value || 0))),
      modoExibicao: $f("Modo").value === "todas" ? "todas" : "uma",
      permitirTrocaAba: $f("PermitirTrocaAba").checked, permitirColar: $f("PermitirColar").checked,
      maxTrocasDeAba: $f("PermitirTrocaAba").checked ? 0 : Math.min(10, Math.max(0, Math.round(Number($f("MaxTrocas").value || 0)))),
      colarTiraVida: $f("ColarVida").checked,
      acaoAoExceder: $f("Modo").value !== "todas" && !$f("Voltar").checked && $f("AcaoExceder").value === "perderQuestao" ? "perderQuestao" : "encerrar",
      // vários PDFs em materiaisConsultaIds; materialConsultaArquivoId (um PDF só) fica para provas antigas
      materialConsultaUrl: url, materiaisConsultaIds: arquivos, materialConsultaArquivoId: null,
      materialConsultaTitulo: url || arquivos.length ? ($f("MatTitulo").value.trim() || (arquivos.length === 1 ? materiaisCache.find(m => m.id === arquivos[0])?.titulo : "") || "Material de consulta") : ""
    };
    // campos do sorteio: só entram se não estiverem travados
    // bancoId = o primeiro (as regras do Firestore e as tentativas antigas usam); temas = os do primeiro banco (compatibilidade)
    if (!travado) {
      const temasPorBanco = Object.fromEntries(bancoIds.map(b => [b, ordenarTemas([...sel.get(b)])]));   // todos marcados = lista completa
      Object.assign(dados, { bancoId: bancoIds[0], bancoIds, temasPorBanco, temas: temasPorBanco[bancoIds[0]], nQuestoes: n, nAlternativas: nAlt, nDissertativas: nDiss });
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
    opcoesMateria();
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
const gruposFechados = new Set();   // turmas recolhidas pelo professor (fica enquanto a página estiver aberta)
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
  if (!provasCache.length) { $("#fpContagem").textContent = ""; box.innerHTML = `<div class="vazio"><div class="icone">📝</div><p>Nenhuma prova ainda. Crie a primeira em ➕ Nova prova, acima.</p></div>`; return; }
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
  $("#fpContagem").textContent = `${lista.length} de ${provasCache.length} prova(s)` + (lista.length ? ` · ${lista.filter(p => p.liberada).length} liberada(s)` : "");
  if (!lista.length) { box.innerHTML = `<div class="vazio"><div class="icone">🔎</div><p>Nenhuma prova com esses filtros.</p></div>`; return; }
  // agrupa por turma (na ordem das turmas cadastradas; "sem turma" por último)
  const grupos = new Map();
  lista.forEach(p => { const k = p.turmaId && turmasCache.some(t => t.id === p.turmaId) ? p.turmaId : "__sem"; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); });
  const chaves = [...turmasCache.map(t => t.id).filter(id => grupos.has(id)), ...(grupos.has("__sem") ? ["__sem"] : [])];
  box.innerHTML = chaves.map(k => {
    const ps = grupos.get(k), t = turmasCache.find(x => x.id === k), lib = ps.filter(p => p.liberada).length;
    const aberto = busca || turma || fSem || fMat || !gruposFechados.has(k);
    // dentro da turma: semestre (mais recente primeiro) → matéria
    const sub = new Map();
    ps.forEach(p => { const sm = semestreDaProva(p), m = materiaDaProva(p, bancosCache) || "Sem matéria", ch = `${sm}|${chaveTexto(m)}`; if (!sub.has(ch)) sub.set(ch, { sm, m, ps: [] }); sub.get(ch).ps.push(p); });
    const subs = [...sub.values()].sort((a, b) => b.sm.localeCompare(a.sm) || a.m.localeCompare(b.m, "pt-BR"));
    return `<details class="grupo-turma${k === "__sem" ? " sem-turma" : ""}" data-grupo="${k}" ${aberto ? "open" : ""}>
      <summary><span class="gt-nome">${k === "__sem" ? "⚠ Sem turma" : `👥 ${esc(nomeTurma(t))}`}</span>
        <span class="tag">${ps.length} prova(s)</span>${lib ? `<span class="tag on">● ${lib} liberada(s)</span>` : ""}
        ${t ? `<span class="pequeno">${alunosDaTurma(t).length} alunos</span>` : `<span class="pequeno">nenhum aluno vê estas provas: use ✎ Editar e escolha a turma</span>`}</summary>
      ${subs.map(g => `<div class="sub-grupo"><h4 class="sg-titulo">📅 ${rotuloSemestre(g.sm)} <span aria-hidden="true">·</span> 📚 ${esc(g.m)} <span class="tag">${g.ps.length}</span></h4>
        <div class="cartoes-provas">${g.ps.map(cartaoProvaHTML).join("")}</div></div>`).join("")}</details>`;
  }).join("");
  box.querySelectorAll("[data-grupo]").forEach(d => d.ontoggle = () => { if (busca || turma || fSem || fMat) return; d.open ? gruposFechados.delete(d.dataset.grupo) : gruposFechados.add(d.dataset.grupo); });
  box.querySelectorAll("[data-alunos]").forEach(b => b.onclick = async () => {
    abrirAba("resultados"); $("#rTurma").value = ""; await prepararResultados();
    $("#rProva").value = b.dataset.alunos; $("#rAoVivo").checked = true; carregarResultados();
  });
  box.querySelectorAll("[data-tg]").forEach(b => b.onclick = async () => {
    const p = provasCache.find(x => x.id === b.dataset.id);
    await updateDoc(doc(db, "provas", p.id), { [b.dataset.tg]: !p[b.dataset.tg] });
    toast("Prova atualizada", "ok"); carregarProvas();
  });
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
    if (!(await confirmar("Apagar a prova? As tentativas dos alunos continuam no banco de dados, mas ficam órfãs.", { titulo: "Apagar prova", ok: "Apagar", perigo: true }))) return;
    await deleteDoc(doc(db, "provas", b.dataset.del)); carregarProvas();
  });
}
function cartaoProvaHTML(p) {
    const bs = bancosDaProva(p).map(id => bancosCache.find(x => x.id === id) || { id, nome: id });
    const qtd = p.nAlternativas !== undefined && p.nAlternativas !== null ? `${p.nAlternativas} alt. + ${p.nDissertativas || 0} dissert.` : p.nDissertativas ? `${p.nDissertativas} dissert.` : "";
    return `<article class="cartao-prova${p.liberada ? " aberta" : ""}">
      <header class="cp-topo">
        <div class="cp-titulo"><h3>${esc(p.titulo)}</h3><span class="pequeno">${p.turmaId ? "👥 " : ""}${esc(p.turma || "sem turma")} · 📚 ${esc(materiaDaProva(p, bancosCache) || "sem matéria")}${p.dataProva ? ` · 🗓 ${dataCurta(p.dataProva)}` : ""}</span></div>
        <div class="cp-status"><span class="tag ${p.liberada ? "on" : "off"}">${p.liberada ? "● liberada" : "○ fechada"}</span><span class="tag ${p.resultadosLiberados ? "on" : "off"}">${p.resultadosLiberados ? "● gabarito liberado" : "○ só o placar"}</span></div>
      </header>
      <div class="cp-numeros">
        <div><b>${p.nQuestoes}</b><span>questões${qtd ? ` · ${qtd}` : ""}</span></div>
        <div><b>${p.tempoMinutos > 0 ? `${p.tempoMinutos} min` : "∞"}</b><span>tempo</span></div>
        <div><b>${!p.permitirTrocaAba && Number(p.maxTrocasDeAba) > 0 ? "❤️".repeat(Math.min(5, Number(p.maxTrocasDeAba))) : "—"}</b><span>${!p.permitirTrocaAba && Number(p.maxTrocasDeAba) > 0 ? `${p.maxTrocasDeAba} vida(s)` : "sem vidas"}</span></div>
      </div>
      <dl class="cp-detalhes">
        <div><dt>Banco(s)</dt><dd>${bs.map(b => esc(b.nome)).join(" · ")}</dd></div>
        <div><dt>Temas</dt><dd class="pequeno">${temasDaProvaTexto(p, bs)}</dd></div>
        <div><dt>Opções</dt><dd class="td-opcoes">${opcoesDaProvaHTML(p)}</dd></div>
      </dl>
      <footer class="cp-acoes">
        <button class="mini" data-alunos="${p.id}" title="Ver aluno por aluno (ao vivo): vidas, progresso e nota">👥 Alunos</button>
        ${podeEditar() ? `<button class="mini ${p.liberada ? "leve" : "ok"}" data-tg="liberada" data-id="${p.id}">${p.liberada ? "⏹ Encerrar" : "▶ Liberar prova"}</button>
        <button class="leve mini" data-tg="resultadosLiberados" data-id="${p.id}" title="O aluno vê quais acertou, o gabarito e baixa o PDF da prova">${p.resultadosLiberados ? "Ocultar gabarito" : "Liberar gabarito"}</button>
        <button class="leve mini" data-editar="${p.id}">✎ Editar</button>` : ""}
        <button class="leve mini" data-testar="${p.id}" title="Abre a prova em nova aba, como o aluno vê (não vale nota)">🧪 Testar</button>
        <button class="discreto mini" data-apagarteste="${p.id}" title="Apaga a sua tentativa de teste desta prova">Apagar meu teste</button>
        ${podeEditar() && ehAdmin() ? `<button class="discreto mini perigo-txt" data-del="${p.id}" title="Apagar prova" aria-label="Apagar prova">🗑</button>` : ""}
      </footer></article>`;
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
  $("#cardNovaProva").open = true; $("#cardNovaProva").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("#btnCriarProva").onclick = async () => {
  if (!podeEditar()) return toast("Seu papel não permite criar provas.", "erro");
  const r = await formNova.ler();
  if (r.erro) return toast(r.erro, "erro");
  await addDoc(collection(db, "provas"), { ...r.dados, liberada: false, resultadosLiberados: false, criadoEm: serverTimestamp(), criadoPor: eu.email });
  $("#pTitulo").value = ""; $("#pCodigo").value = ""; $("#pData").value = ""; $("#cardNovaProva").open = false; toast("Prova criada (ainda fechada). Libere quando for aplicar.", "ok"); carregarProvas();
};

// ---------- editar prova ----------
async function editarProva(p) {
  if (!podeEditar()) return toast("Seu papel não permite editar provas.", "erro");
  // tentativas de alunos (as de teste não contam) travam os campos do sorteio
  let nTentativas = 0;
  try {
    const ts = await getDocs(query(collection(db, "tentativas"), where("provaId", "==", p.id)));
    nTentativas = ts.docs.filter(d => d.data().teste !== true).length;
  } catch (e) { return toast("Não foi possível conferir as tentativas da prova. " + traduzirErro(e), "erro"); }
  await listarTurmas();
  const ctl = controleProva("e");
  const salvou = await modal({
    titulo: "Editar prova", conteudo: formProvaHTML("e"), ok: "Salvar alterações", cancelar: "Cancelar", largo: true,
    aoAbrir: () => {
      ctl.ligar(); ctl.preencher(p);
      if (nTentativas) ctl.travar(`🔒 <b>${nTentativas} aluno(s) já começaram esta prova.</b> Bancos, número de questões, dissertativas e temas não podem mudar: isso mudaria o sorteio de quem já começou e a correção. As outras opções podem ser alteradas.`);
      ctl.carregarTemas(ctl.selecaoDaProva(p));
    },
    antesDeConfirmar: async () => {
      const r = await ctl.ler();
      if (r.erro) { toast(r.erro, "erro"); return false; }
      try { await updateDoc(doc(db, "provas", p.id), r.dados); }
      catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); return false; }
      return true;
    }
  });
  if (salvou) { toast("Prova atualizada.", "ok"); carregarProvas(); }
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
    if (!["alternativa", "dissertativa"].includes(q.tipo)) throw new Error(`Questão ${n}: tipo deve ser alternativa ou dissertativa.`);
    if (!q.enunciado) throw new Error(`Questão ${n}: falta o enunciado.`);
    if (q.tema !== undefined && q.tema !== null && typeof q.tema !== "string") throw new Error(`Questão ${n}: "tema" deve ser um texto (ex.: "DML - UPDATE").`);
    if (q.tipo === "alternativa") {
      if (!Array.isArray(q.alternativas) || q.alternativas.length < 2) throw new Error(`Questão ${n}: precisa de pelo menos 2 alternativas.`);
      if (!Number.isInteger(q.correta) || q.correta < 0 || q.correta >= q.alternativas.length) throw new Error(`Questão ${n}: "correta" deve ser o índice da alternativa certa (0 = primeira).`);
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
  let b; try { b = validarBanco($("#txtBanco").value); } catch (e) { return $("#msgBanco").innerHTML = `❌ ${esc(e.message)}`; }
  const temas = ordenarTemas(b.questoes.map(temaDe));
  const ref = await addDoc(collection(db, "bancos"), { nome: b.nome, materia: $("#bMateria").value.trim() || b.materia || "", semestre: $("#bSemestre").value || semestreDe(),
    nQuestoes: b.questoes.length, temas, criadoEm: serverTimestamp(), criadoPor: eu.email });
  const lote = writeBatch(db);
  b.questoes.forEach((q, i) => {
    const qid = `${ref.id}_q${String(i + 1).padStart(3, "0")}`;
    const pub = { ordem: i + 1, tipo: q.tipo, enunciado: q.enunciado, peso: Number(q.peso || 1), tema: temaDe(q) };
    if (q.tipo === "alternativa") pub.alternativas = q.alternativas;
    lote.set(doc(db, "bancos", ref.id, "questoes", qid), pub);
    const gab = { explicacao: q.explicacao || "" };
    if (q.tipo === "alternativa") gab.correta = q.correta; else { gab.respostasAceitas = q.respostasAceitas || []; gab.palavrasChave = q.palavrasChave || []; }
    lote.set(doc(db, "bancos", ref.id, "gabaritos", qid), gab);
  });
  await lote.commit();
  $("#msgBanco").innerHTML = `✅ Banco <b>${esc(b.nome)}</b> importado com ${b.questoes.length} questões em ${temas.length} tema(s): ${temas.map(esc).join(", ")}.`; $("#txtBanco").value = "";
  carregarBancos();
};
// semestre do banco: o gravado; senão o da criação
const semestreDoBanco = b => b.semestre || semestreDe(b.criadoEm || new Date());
let bancosContagem = {};   // bancoId -> { tema: { alternativa, dissertativa } }
const bancosFechados = new Set();
async function carregarBancos() {
  await Promise.all([listarBancos(), listarPlanos().catch(() => []), listarCursos().catch(() => [])]);
  // formulário de importação: semestre e matérias sugeridas
  const sAntes = $("#bSemestre").value, base = semestreDe();
  $("#bSemestre").innerHTML = [-2, -1, 0, 1, 2].map(d => semestreVizinho(base, d)).reverse().map(x => `<option value="${x}">${rotuloSemestre(x)}${x === base ? " (atual)" : ""}</option>`).join("");
  $("#bSemestre").value = sAntes || base;
  $("#bMaterias").innerHTML = materiasSugeridas().map(m => `<option value="${esc(m)}">`).join("");
  const box = $("#listaBancos");
  if (!bancosCache.length) { $("#fbContagem").textContent = ""; box.innerHTML = `<div class="vazio"><div class="icone">📚</div><p>Nenhum banco ainda. Importe o <b>modelo_banco.json</b> acima para começar.</p></div>`; return; }
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
  $("#fbContagem").textContent = `${lista.length} de ${bancosCache.length} banco(s) · ${lista.reduce((n, b) => n + Number(b.nQuestoes || 0), 0)} questões`;
  if (!lista.length) { box.innerHTML = `<div class="vazio"><div class="icone">🔎</div><p>Nenhum banco com esses filtros.</p></div>`; return; }
  const arv = new Map();
  for (const b of lista) {
    const s = semestreDoBanco(b), m = matDe(b);
    if (!arv.has(s)) arv.set(s, new Map());
    const mm = arv.get(s), k = chaveTexto(m); if (!mm.has(k)) mm.set(k, { m, bs: [] }); mm.get(k).bs.push(b);
  }
  const filtrando = busca || fS || fM, atual = semestreDe();
  const usos = id => provasCache.filter(p => bancosDaProva(p).includes(id));
  box.innerHTML = [...arv.keys()].sort().reverse().map(s => {
    const mats = [...arv.get(s).values()].sort((a, b) => a.m.localeCompare(b.m, "pt-BR")), ids = `bs:${s}`;
    const nB = mats.reduce((n, x) => n + x.bs.length, 0);
    return `<details class="grupo-turma" data-gb="${ids}" ${filtrando || !bancosFechados.has(ids) ? "open" : ""}>
      <summary><span class="gt-nome">📅 ${rotuloSemestre(s)}</span>${s === atual ? `<span class="tag on">atual</span>` : ""}<span class="tag">${mats.length} matéria(s)</span><span class="tag">${nB} banco(s)</span></summary>
      <div class="gt-corpo">${mats.map(({ m, bs }) => {
        const idm = `bm:${s}:${chaveTexto(m)}`;
        return `<details class="grupo-semestre" data-gb="${idm}" ${filtrando || !bancosFechados.has(idm) ? "open" : ""}>
          <summary><span class="gs-nome">📚 ${esc(m)}</span><span class="tag">${bs.length} banco(s)</span><span class="tag">${bs.reduce((n, b) => n + Number(b.nQuestoes || 0), 0)} questões</span></summary>
          <div class="cartoes-materias">${bs.map(b => {
            const c = bancosContagem[b.id], tot = c ? Object.values(c).reduce((x, y) => ({ alternativa: x.alternativa + y.alternativa, dissertativa: x.dissertativa + y.dissertativa }), { alternativa: 0, dissertativa: 0 }) : null;
            const u = usos(b.id), geral = c?.Geral ? (c.Geral.alternativa + c.Geral.dissertativa) : 0;
            return `<article class="cartao-materia cartao-banco">
              <div class="cm-topo"><div><h3>🗂 ${esc(b.nome)}</h3><span class="pequeno">${b.nQuestoes} questões${tot ? ` · ${textoContagem(tot)}` : ""}${achados[b.id] ? ` · <b>${achados[b.id]} questão(ões) com “${esc($("#fbBusca").value.trim())}”</b>` : ""}</span></div>
                ${u.length ? `<span class="tag nota" title="${esc(u.map(p => p.titulo).join(" · "))}">🧪 em ${u.length} prova(s)</span>` : `<span class="tag off">sem prova</span>`}</div>
              ${c ? `<ul class="lista-topicos lista-topicos-banco">${Object.entries(c).map(([t, n]) => `<li class="topico${t === "Geral" ? " e-geral" : ""}"><span class="tp-nome">${esc(t)}</span><span class="tag">🔘 ${n.alternativa}</span><span class="tag">✍ ${n.dissertativa}</span></li>`).join("")}</ul>` : `<p class="pequeno">⚠ não foi possível ler as questões.</p>`}
              ${geral ? `<p class="pequeno aviso-texto">⚠ ${geral} questão(ões) sem tópico ("Geral"): use 🏷 Tópicos.</p>` : ""}
              <div class="cm-acoes">${podeEditar() ? `<button class="leve mini" data-topicos="${b.id}" title="Tópico de cada questão, matéria e semestre do banco (com sugestão da IA)">🏷 Tópicos</button>` : ""}
                <button class="leve mini" data-gab="${b.id}">Gabarito p/ Classroom</button>
                ${ehAdmin() ? `<button class="discreto mini perigo-txt" data-delb="${b.id}" aria-label="Apagar banco ${esc(b.nome)}">🗑</button>` : ""}</div></article>`;
          }).join("")}</div></details>`;
      }).join("")}</div></details>`;
  }).join("");
  box.querySelectorAll("[data-gb]").forEach(d => d.ontoggle = () => { if (filtrando) return; d.open ? bancosFechados.delete(d.dataset.gb) : bancosFechados.add(d.dataset.gb); });
  box.querySelectorAll("[data-gab]").forEach(x => x.onclick = () => gerarGabarito(x.dataset.gab));
  box.querySelectorAll("[data-topicos]").forEach(x => x.onclick = () => editarTopicosBanco(x.dataset.topicos, carregarBancos));
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
const MODELO_JSON = { nome: "MS5 — DML", materia: "Banco de Dados", questoes: [
  { tipo: "alternativa", tema: "DML - UPDATE", enunciado: "Qual comando altera o e-mail do cliente de id 3?", alternativas: ["UPDATE cliente SET email = 'novo@x.com' WHERE id_cliente = 3;", "UPDATE cliente SET email = 'novo@x.com';", "ALTER TABLE cliente SET email = 'novo@x.com' WHERE id_cliente = 3;", "INSERT INTO cliente (email) VALUES ('novo@x.com');"], correta: 0, explicacao: "UPDATE com WHERE altera só a linha do id 3. Sem WHERE mudaria todos; ALTER muda a estrutura; INSERT cria linha nova.", peso: 1 },
  { tipo: "dissertativa", tema: "DML - SELECT", enunciado: "Escreva o comando que conta quantos clientes existem na tabela cliente.", respostasAceitas: ["SELECT COUNT(*) FROM cliente;", "SELECT COUNT(id_cliente) FROM cliente;"], palavrasChave: ["select count(", "from cliente"], explicacao: "COUNT(*) conta as linhas da tabela.", peso: 2 },
  { tipo: "dissertativa", tema: "Modelagem", enunciado: "Explique, em 2 linhas, para que serve a chave estrangeira.", correcaoManual: true, explicacao: "Ela liga uma tabela a outra e garante que o valor exista na tabela de origem.", peso: 2 }] };
function giMontar() {
  const materia = $("#giMateria").value.trim() || "(a matéria)", tops = [...$("#giTopicos").querySelectorAll("input:checked")].map(c => c.value);
  const nA = Math.max(0, Number($("#giAlt").value) || 0), nD = Math.max(0, Number($("#giDiss").value) || 0), op = Number($("#giOpcoes").value) || 4;
  const nome = $("#giNome").value.trim() || `${materia} — banco gerado`, extra = $("#giContexto").value.trim(), total = tops.length * (nA + nD);
  $("#giPrompt").value = `Você é professor de ${materia} em um curso técnico do SENAI. Crie um banco de questões de prova, nível ${$("#giNivel").value}, em português do Brasil.

TÓPICOS (use exatamente estes nomes no campo "tema"):
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
  $("#cardGabarito").classList.remove("oculto"); $("#cardGabarito").scrollIntoView({ behavior: "smooth" });
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
const RAPIDO = 5;   // resposta enviada em menos de 5 s: destacar
// sinais de cola; com troca de aba permitida na prova, as trocas aparecem em cinza ("permitido") e não destacam a linha
function sinaisDe(t, prova) {
  const atual = t.trocasDeAba || 0, acumulado = t.trocasDeAbaTotal || 0;   // "perder questão" zera trocasDeAba e acumula em trocasDeAbaTotal
  const s = { abas: atual + acumulado, abasAtual: atual, abasAcumulado: acumulado, telaCheia: t.saidasTelaCheia || 0, colar: t.tentativasColar || 0, abasPermitido: prova?.permitirTrocaAba === true };
  s.total = (s.abasPermitido ? 0 : s.abas) + s.telaCheia + s.colar;
  return s;
}
function sinaisHTML(s) {
  const item = (ic, n, tit) => `<span class="${n ? "" : "zero"}" title="${tit}">${ic} ${n}</span>`;
  const abas = s.abasPermitido ? `<span class="permitido" title="Troca de aba permitida nesta prova">🔀 ${s.abas} permitido</span>` : item("🔀", s.abas, "Trocas de aba/janela");
  return `<span class="sinais">${abas}${item("⛶", s.telaCheia, "Saídas da tela cheia")}${item("📋", s.colar, "Tentativas de colar")}</span>`;
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
$("#rProva").onchange = () => { pararAoVivo(); resDados = null; $("#resResumo").innerHTML = ""; $("#resTabela").innerHTML = ""; if ($("#rAoVivo").checked) carregarResultados(); };
$("#rTestes").onchange = () => { if (resDados) desenharResultados(); };
$("#rAoVivo").onchange = () => { if ($("#rAoVivo").checked) carregarResultados(); else pararAoVivo(); };

// cancela todos os listeners do "ao vivo"
function pararAoVivo() {
  ouvintes.forEach(u => u()); ouvintes = [];
  if (ouvinteDetalhe) { ouvinteDetalhe(); ouvinteDetalhe = null; }
  $("#aoVivo").classList.add("oculto");
}

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
  gravarPlacares(todas);
  if ($("#iaAuto").checked && $("#rAoVivo").checked) corrigirPendentesIA({ auto: true });
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
  if (!base) return null;
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
function saidasHTML(l) {
  const v = vidasDe(l.t);
  return v ? `<br>${coracoesHTML(v)}${l.t.vidasRestauradas ? ` <span class="pequeno" title="Vezes que o professor restaurou as vidas">↺${l.t.vidasRestauradas}</span>` : ""}` : "";
}
// botões de vida/reabrir de um aluno (professor e admin)
function acoesVidaHTML(l) {
  if (!podeCuidar()) return "";
  const v = vidasDe(l.t), b = [];
  if (!l.t.finalizadaEm) {
    if (v) b.push(`<button class="ok mini" data-vrest="${l.t.id}" title="Devolve todas as vidas${l.perdidas ? " e as questões perdidas" : ""}"${v.usadas || l.perdidas ? "" : " disabled"}>❤️ Restaurar vidas</button>`,
                  `<button class="leve mini" data-vmais="${l.t.id}" title="Dá uma vida a mais só para este aluno">+1 ❤️</button>`);
  } else b.push(`<button class="leve mini${l.t.encerradaPor === "trocasDeAba" ? " destaque" : ""}" data-reabrir="${l.t.id}" title="Volta a prova para o aluno continuar de onde parou">↩ Reabrir prova</button>`);
  return b.join(" ");
}
// questões perdidas por sair da prova (respostas com perdida: true) — o professor pode devolver
const perdidasDe = id => Object.entries(cacheTent.get(id)?.resp || {}).filter(([, r]) => r?.perdida === true).map(([q]) => q);
function lotePerdidas(lote, id) { perdidasDe(id).forEach(q => lote.delete(doc(db, "tentativas", id, "respostas", q))); }
async function restaurarVidas(l) {
  const v = vidasDe(l.t), perd = perdidasDe(l.t.id), nome = l.t.nome || l.t.email;
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
async function vidaExtra(l) {
  try {
    await updateDoc(doc(db, "tentativas", l.t.id), { vidasExtras: increment(1) });
    toast(`+1 vida para ${l.t.nome || l.t.email} ❤️`, "ok");
    await recarregarTentativa(l.t.id);
  } catch (e) { toast("Não foi possível dar a vida extra. " + traduzirErro(e), "erro"); console.error(e); }
}
async function reabrirProva(l) {
  const p = resDados.prova, nome = l.t.nome || l.t.email, perd = perdidasDe(l.t.id), temTempo = Number(p.tempoMinutos) > 0;
  const motivo = l.t.encerradaPor === "trocasDeAba" ? "A prova foi encerrada porque as vidas acabaram." : "O aluno já tinha finalizado a prova (ou o tempo acabou).";
  const ok = await modal({
    titulo: `↩ Reabrir a prova de ${nome}`, ok: "Reabrir prova", cancelar: "Cancelar",
    conteudo: `<p>${esc(motivo)} Reabrindo, o aluno <b>continua de onde parou</b>, com as respostas já enviadas, e recebe as vidas de volta. A tela dele atualiza sozinha (se fechou, é só abrir a prova de novo e clicar em Continuar).</p>
      ${perd.length ? `<label class="check"><input type="checkbox" id="rbPerdidas" checked> Devolver as ${perd.length} questão(ões) perdida(s) por sair da prova</label>` : ""}
      ${temTempo ? `<label for="rbMin" style="margin-top:12px">Tempo para terminar, a partir de agora (min)</label><input type="number" id="rbMin" min="1" step="1" value="${Math.max(5, Math.min(Number(p.tempoMinutos), 30))}">` : ""}
      ${p.liberada ? "" : `<div class="aviso-box erro" style="margin-top:12px">A prova está <b>encerrada</b> na aba Provas: o aluno só consegue continuar depois que você liberar de novo.</div>`}
      ${l.t.encerradaPor !== "trocasDeAba" ? `<p class="pequeno">Atenção: depois de finalizar, o sistema libera o gabarito para o aluno ler. Ao reabrir, o gabarito volta a ficar fechado, mas use isto só quando fizer sentido (ex.: aluno com TEA, queda de internet).</p>` : ""}`
  });
  if (!ok) return;
  try {
    const dados = { finalizadaEm: null, encerradaPor: deleteField(), indiceAtual: 0, trocasDeAba: 0, trocasDeAbaTotal: increment(l.t.trocasDeAba || 0),
      tempoTotalSegundos: deleteField(), acertos: deleteField(), totalQuestoes: deleteField(), nota: deleteField(), notaPrevia: null, aguardandoCorrecao: 0,
      reabertaEm: serverTimestamp(), reabertaPor: eu.email, vidasRestauradasEm: serverTimestamp(), vidasRestauradasPor: eu.email };
    if (temTempo) {
      const min = Math.max(1, Math.round(Number(document.getElementById("rbMin")?.value || 10)));
      const ini = l.t.iniciadaEm?.toMillis?.() || Date.now(), fimNovo = Date.now() + min * 60000;
      dados.minutosExtras = Math.max(0, Math.ceil((fimNovo - ini) / 60000) - Number(p.tempoMinutos));
    }
    const lote = writeBatch(db);
    lote.update(doc(db, "tentativas", l.t.id), dados);
    l.t.questoesIds.forEach(q => lote.delete(doc(db, "marcadores", `${l.t.uid}_${q}`)));   // o gabarito volta a ficar fechado
    if (perd.length && document.getElementById("rbPerdidas")?.checked !== false) lotePerdidas(lote, l.t.id);
    await lote.commit();
    toast(`Prova de ${nome} reaberta ↩`, "ok");
    await recarregarTentativa(l.t.id);
  } catch (e) { toast("Não foi possível reabrir a prova. " + traduzirErro(e), "erro"); console.error(e); }
}
// relê uma tentativa (sem o "ao vivo", a tela não atualiza sozinha)
async function recarregarTentativa(id) {
  if ($("#rAoVivo").checked) return;
  const d = await getDoc(doc(db, "tentativas", id));
  if (d.exists()) await atualizarCache(d); else cacheTent.delete(id);
  montarResultados();
}
function ligarAcoesVida(raiz) {
  const achar = id => [...resDados.linhas, ...resDados.testes].find(x => x.t.id === id);
  raiz.querySelectorAll("[data-vrest]").forEach(b => b.onclick = () => restaurarVidas(achar(b.dataset.vrest)));
  raiz.querySelectorAll("[data-vmais]").forEach(b => b.onclick = () => vidaExtra(achar(b.dataset.vmais)));
  raiz.querySelectorAll("[data-reabrir]").forEach(b => b.onclick = () => reabrirProva(achar(b.dataset.reabrir)));
}

// ---------- visão em cartões: um cartão por aluno (bom para acompanhar a prova ao vivo) ----------
function cartoesHTML(lista) {
  const total = resDados.prova.nQuestoes || 0;
  return `<div class="cartoes-alunos">` + lista.map(l => {
    const v = vidasDe(l.t), feitas = l.itens.filter(x => x.r !== undefined || x.perdida).length, fin = !!l.t.finalizadaEm;
    const estado = l.t.encerradaPor === "trocasDeAba" ? ["erro", "⛔ sem vidas"] : fin ? ["ok", "✓ finalizou"] : ["aviso", "fazendo"];
    const alerta = (v && !fin && v.restam <= 1) || l.t.encerradaPor === "trocasDeAba";
    const tempo = l.tempo ?? (l.t.iniciadaEm?.toMillis ? (Date.now() - l.t.iniciadaEm.toMillis()) / 1000 : null);
    return `<div class="cartao-aluno${alerta ? " alerta" : ""}${fin ? " fim" : ""}">
      <div class="ca-topo"><span class="avatar">${esc(iniciais(l.t.nome || l.t.email))}</span>
        <div class="ca-nome"><b>${esc(l.t.nome || l.t.email)}</b><span class="pequeno">${esc(l.t.email)}</span></div>
        <span class="tag ${estado[0]}">${estado[1]}</span></div>
      <div class="ca-meio">
        <div class="ca-prog"><div class="progresso"><div style="width:${(l.itens.length || total) ? feitas / (l.itens.length || total) * 100 : 0}%"></div></div><span class="pequeno">⭐ ${feitas}/${l.itens.length || total} questões · ⏱ ${fmtTempo(tempo)}</span></div>
        <div class="ca-vidas">${v ? coracoesHTML(v) : `<span class="pequeno">sem vidas</span>`}</div>
      </div>
      <div class="ca-sinais">${sinaisHTML(l.sinais)}${l.perdidas ? ` <span class="tag erro">⛔ ${l.perdidas} perdida(s)</span>` : ""}${l.rapidas ? ` <span class="tag erro" title="Respostas em menos de ${RAPIDO} s">⚡ ${l.rapidas}</span>` : ""}</div>
      <div class="ca-rodape"><span class="ca-nota" title="Nota (0–100)">${fin ? `<b>${l.nota}</b><span class="pequeno">/100</span>` : `<span class="pequeno">parcial: ${l.nota}</span>`}${l.revisar ? ` <span class="tag aviso">${l.revisar} a revisar</span>` : ""}</span>
        <span class="ca-acoes">${acoesVidaHTML(l)} <button class="leve mini" data-ver="${l.t.id}">Ver</button></span></div>
    </div>`;
  }).join("") + `</div>`;
}
function situacaoHTML(l) {
  const t = l.t;
  let h = t.finalizadaEm ? `<span class="pequeno">${dataBR(t.finalizadaEm)}</span>` : "<span class='tag aviso'>em andamento</span>";
  if (t.encerradaPor === "trocasDeAba") h += `<br><span class="tag erro">⛔ encerrada: limite de saídas</span>`;
  if (l.perdidas) h += `<br><span class="tag erro">⛔ ${l.perdidas} perdida(s)</span>`;
  return h;
}
function tabelaHTML(lista, prefixo) {
  return `<div class="tabela"><table><tr><th>Aluno</th><th>Início</th><th>Fim</th><th>Tempo</th><th>Sinais · vidas</th><th>Nota</th><th>Revisar</th><th></th></tr>` +
    lista.map(l => `<tr class="${l.temSinal ? "com-sinal" : ""}"><td><b>${esc(l.t.nome || "")}</b><br><span class="pequeno">${esc(l.t.email)}</span></td><td class="pequeno">${dataBR(l.t.iniciadaEm)}</td><td>${situacaoHTML(l)}</td>
      <td>${fmtTempo(l.tempo)}${l.rapidas ? `<br><span class="tag erro" title="Respostas enviadas em menos de ${RAPIDO} segundos">⚡ ${l.rapidas} rápida(s)</span>` : ""}</td><td>${sinaisHTML(l.sinais)}${saidasHTML(l)}</td><td><b>${l.nota}</b>${l.t.nota !== undefined ? ` <span class="pequeno">(fechada: ${l.t.nota})</span>` : l.t.notaPrevia !== null && l.t.notaPrevia !== undefined ? ` <span class="pequeno">(prévia: ${l.t.notaPrevia})</span>` : ""}</td><td>${l.revisar ? `<span class="tag aviso">${l.revisar}</span>` : "—"}</td>
      <td class="td-acoes"><button class="leve mini" data-ver="${l.t.id}">Ver</button> ${acoesVidaHTML(l)} ${ehAdmin() && prefixo === "aluno" ? `<button class="perigo mini" data-reset="${l.t.id}" title="Apagar a tentativa (o aluno pode refazer)">↺ Apagar</button>` : ""}</td></tr>`).join("") + `</table></div>`;
}
function desenharResultados() {
  const { linhas, testes } = resDados;
  const fin = linhas.filter(l => l.t.finalizadaEm), comSinal = linhas.filter(l => l.temSinal).length, media = fin.length ? (fin.reduce((s, l) => s + l.nota, 0) / fin.length).toFixed(1) : "—";
  const revisar = linhas.reduce((s, l) => s + l.revisar, 0);
  $("#resResumo").innerHTML = `<div class="numeros">
      <div class="numero"><b>${linhas.length}</b><span>alunos iniciaram</span></div>
      <div class="numero"><b>${fin.length}</b><span>finalizaram</span></div>
      <div class="numero"><b>${media}</b><span>média (0–100)</span></div>
      <div class="numero ${revisar ? "aviso" : ""}"><b>${revisar}</b><span>respostas a revisar</span></div>
      <div class="numero ${comSinal ? "aviso" : ""}"><b>${comSinal}</b><span>com sinais (aba, tela cheia, colar)</span></div></div>`;
  const mostrarTestes = $("#rTestes").checked;
  const emCartoes = (localStorage.getItem("visaoResultados") || "cartoes") === "cartoes";
  const vis = filtrarLinhas(linhas), filtrado = vis.length !== linhas.length;
  let html = linhas.length ? `<div class="card"><div class="linha acoes visao-res" role="group" aria-label="Visão"><b style="flex:1">Alunos (${filtrado ? `${vis.length} de ${linhas.length}` : linhas.length})</b>
      <button class="mini ${emCartoes ? "" : "leve"}" data-visao="cartoes" aria-pressed="${emCartoes}">▦ Cartões</button><button class="mini ${emCartoes ? "leve" : ""}" data-visao="tabela" aria-pressed="${!emCartoes}">☰ Tabela</button></div>
      ${!vis.length ? `<p class="pequeno">Nenhum aluno com esse filtro.</p>` : emCartoes ? cartoesHTML(vis) : tabelaHTML(vis, "aluno")}</div>` : `<div class="card vazio"><div class="icone">⏳</div><p>Nenhum aluno fez esta prova ainda.</p></div>`;
  if (resDados.turma) {
    const fizeram = new Set(linhas.map(l => String(l.t.email || "").toLowerCase()));
    const todos = alunosDaTurma(resDados.turma), faltam = todos.filter(a => !a.email || !fizeram.has(a.email));
    html += `<div class="card secao-faltam"><h2>Não fizeram <span class="pequeno">(${faltam.length} de ${todos.length} da turma ${esc(resDados.turma.nome)})</span></h2>` +
      (faltam.length ? `<ul class="lista-faltam">${faltam.map(a => `<li>${esc(a.nome || a.email)}${a.nome && a.email ? ` <span class="pequeno">${esc(a.email)}</span>` : ""}${!a.email ? ` <span class="pequeno">— ainda não entrou no sistema</span>` : ""}</li>`).join("")}</ul>` : `<p class="pequeno">Todos os alunos da turma começaram a prova. ✅</p>`) + `</div>`;
  } else if (resDados.prova.turmaId) html += `<div class="card"><p class="pequeno">A turma desta prova não foi encontrada (apagada?). Escolha outra em Provas → Editar.</p></div>`;
  if (mostrarTestes) html += `<div class="card secao-testes"><h2>Testes da equipe <span class="pequeno">(não entram na média, no CSV, nos PDFs nem em "Fechar notas")</span></h2>${testes.length ? tabelaHTML(testes, "teste") : `<p class="pequeno">Nenhuma tentativa de teste nesta prova. Abra <b>Testar como aluno</b> na aba Provas.</p>`}</div>`;
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
  document.querySelectorAll("[data-visao]").forEach(b => b.onclick = () => { localStorage.setItem("visaoResultados", b.dataset.visao); desenharResultados(); });
  ligarAcoesVida($("#resTabela"));
  document.querySelectorAll("[data-reset]").forEach(b => b.onclick = async () => {
    const l = linhas.find(x => x.t.id === b.dataset.reset);
    if (!(await confirmar(`Apagar a tentativa de ${l.t.nome || l.t.email}? A pessoa poderá fazer a prova de novo (com novo sorteio).`, { titulo: "Apagar tentativa", ok: "Apagar", perigo: true }))) return;
    const lote = writeBatch(db);
    (await getDocs(collection(db, "tentativas", l.t.id, "respostas"))).forEach(d => lote.delete(d.ref));
    (await getDocs(collection(db, "tentativas", l.t.id, "correcoes"))).forEach(d => lote.delete(d.ref));
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
  box.innerHTML = `<div class="card"><div class="linha"><h2 style="flex:3">${l.t.teste ? "🧪 " : ""}${esc(l.t.nome || l.t.email)} — ${l.nota}/100 (${l.pts} de ${l.max} pontos)</h2><button class="leve mini" id="btnPDFAluno" style="flex:0 0 auto">PDF deste aluno</button></div>
    ${vidasDe(l.t) || podeEditar() ? `<div class="linha acoes detalhe-vidas">${vidasDe(l.t) ? `<span>Vidas: ${coracoesHTML(vidasDe(l.t))}</span>` : ""}${acoesVidaHTML(l)}</div>` : ""}
    <p class="pequeno">Tempo total: <b>${fmtTempo(l.tempo)}</b> · ${sinaisHTML(l.sinais)}${lim ? ` · vidas perdidas <b>${l.sinais.abas}</b>${l.t.vidasRestauradas ? ` · restauradas ${l.t.vidasRestauradas}×` : ""}` : ""}${l.t.reabertaEm ? ` · <span class="tag nota">↩ reaberta por ${esc(l.t.reabertaPor || "professor")}</span>` : ""}
      ${l.t.encerradaPor === "trocasDeAba" ? ` · <span class="tag erro">⛔ encerrada: limite de saídas atingido</span>` : ""}${l.perdidas ? ` · <span class="tag erro">⛔ ${l.perdidas} questão(ões) perdida(s)</span>` : ""}</p>` + l.itens.map(x => {
    const rapida = x.r !== undefined && !x.perdida && typeof x.segundos === "number" && x.segundos < RAPIDO;
    const tempo = typeof x.segundos === "number" ? `<span class="tag ${rapida ? "erro" : ""}" title="Tempo entre a questão aparecer e a resposta ser enviada">⏱ ${fmtTempo(x.segundos)}${rapida ? ` · menos de ${RAPIDO} s` : ""}</span>` : "";
    const fmt = temFormato(x.q), bloco = t => `<span class="resp-formato">${esc(t).replace(/\n/g, "<br>")}</span>`;
    const sua = x.perdida ? "<i>perdida por sair da prova</i>" : x.r === undefined ? "<i>não respondida</i>" : fmt ? bloco(textoResposta(x.q, x.r)) : x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.r] ?? x.r) : `<span class="mono">${esc(x.r)}</span>`;
    const certa = fmt ? (x.g.chave ? bloco(textoChave(x.q, x.g)) + ` <span class="tag nota">${FORMATOS[x.q.formato].icone} ${esc(FORMATOS[x.q.formato].nome)}</span>` : "—") : x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.g.correta] ?? "—") : esc((x.g.respostasAceitas || [])[0] || (x.g.palavrasChave || []).join(" + "));
    const manual = podeEditar() && x.q.tipo === "dissertativa" && !x.perdida ? `<div class="linha" style="margin-top:6px"><div style="flex:0 0 120px"><label>Pontos (0–${x.peso})</label><input type="number" min="0" max="${x.peso}" step="0.5" value="${x.pontos}" id="pt_${x.qid}"></div><div><label>Comentário para o aluno</label><input type="text" id="cm_${x.qid}" value="${esc(x.comentario)}"></div><div style="flex:0 0 120px;align-self:flex-end"><button class="mini" data-corr="${x.qid}">Salvar</button></div></div>` : "";
    const rot = ROTULOS[x.status] || ROTULOS.revisar;
    return `<div class="feedback bloco ${x.status === "certa" ? "certa" : ["errada", "perdida", "em_branco"].includes(x.status) ? "errada" : "revisar"}"><div class="linha acoes"><b>Q${x.n}</b> <span class="tag ${rot[0]}">${rot[1]} · ${x.pontos}/${x.peso}${x.manual ? " · manual" : ""}</span>${x.ia ? `<span class="tag nota" title="Corrigida pela IA — confira e ajuste se precisar">🤖 IA</span>` : ""}${errosIA.has(l.t.id + "/" + x.qid) ? `<span class="tag erro ia-erro">⚠ IA: ${esc(errosIA.get(l.t.id + "/" + x.qid))}</span>` : ""}${tempo}</div>
      <div class="enunciado pequeno">${esc(x.q.enunciado)}</div><p><b>Resposta do aluno:</b> ${sua}<br><b>Esperada:</b> ${certa}</p>${manual}</div>`;
  }).join("") + "</div>";
  if (rolar) box.scrollIntoView({ behavior: "smooth" });
  $("#btnPDFAluno").onclick = () => abrirImpressao(`Boletim — ${resDados.prova.titulo}`, boletimHTML(l));
  ligarAcoesVida(box);
  box.querySelectorAll("[data-corr]").forEach(b => b.onclick = async () => {
    const qid = b.dataset.corr, pontos = Number($("#pt_" + qid).value), comentario = $("#cm_" + qid).value.trim();
    await setDoc(doc(db, "tentativas", l.t.id, "correcoes", qid), { pontos, comentario, corrigidoPor: eu.email, corrigidoEm: serverTimestamp() });
    toast("Correção salva", "ok");
    document.activeElement?.blur?.();
    const d = await getDoc(doc(db, "tentativas", l.t.id)); await atualizarCache(d); montarResultados(); verAluno(id, false);
  });
}
$("#btnFecharNotas").onclick = async () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  if (!podeEditar()) return toast("Seu papel não permite fechar notas.", "erro");
  const pend = resDados.linhas.reduce((s, l) => s + l.revisar, 0);
  if (pend && !(await confirmar(`Ainda há ${pend} resposta(s) marcada(s) como "revisar" (valem 0 até você corrigir). Fechar mesmo assim?`, { titulo: "Fechar notas", ok: "Fechar mesmo assim" }))) return;
  const lote = writeBatch(db);
  resDados.linhas.forEach(l => lote.update(doc(db, "tentativas", l.t.id), { nota: l.nota, notaMaxima: 100, corrigidaEm: serverTimestamp(), corrigidaPor: eu.email }));
  await lote.commit(); toast("Notas gravadas. Para o aluno ver o gabarito, clique em “Liberar gabarito/resultado” na aba Provas.", "ok"); carregarResultados();
};
$("#btnCSV").onclick = () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  const n = Math.max(resDados.prova.nQuestoes || 0, ...resDados.linhas.map(l => l.itens.length));
  const cab = ["Nome", "E-mail", "Início", "Fim", "Tempo", "Tempo (segundos)", "Trocas de aba", "Saídas da tela cheia", "Tentativas de colar", `Respostas < ${RAPIDO}s`, "Encerrada por", "Questões perdidas", "Nota",
               ...Array.from({ length: n }, (_, i) => `Q${i + 1}`)];
  const rows = resDados.linhas.map(l => [l.t.nome || "", l.t.email, dataBR(l.t.iniciadaEm), l.t.finalizadaEm ? dataBR(l.t.finalizadaEm) : "em andamento",
    fmtTempo(l.tempo), l.tempo ?? "", abasTexto(l.sinais), l.sinais.telaCheia, l.sinais.colar, l.rapidas, l.t.encerradaPor === "trocasDeAba" ? "limite de saídas" : "", l.perdidas, String(l.nota).replace(".", ","),
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
  $("#feContagem").textContent = `${lista.length} de ${equipeCache.length} pessoa(s)`;
  $("#listaEquipe").innerHTML = `<div class="tabela"><table><tr><th>E-mail</th><th>Nome</th><th>Papel</th><th></th></tr>
    ${!b && !fp ? `<tr><td>${esc(SUPER_ADMIN)}</td><td>—</td><td><span class="tag on">admin principal</span></td><td class="pequeno">fixo nas regras</td></tr>` : ""}` +
    lista.map(m => `<tr><td>${esc(m.id)}</td><td>${esc(m.nome || "")}</td><td><span class="tag">${esc(ROT_PAPEL[m.papel] || m.papel)}</span></td><td>${ehAdmin() ? `<button class="perigo mini" data-rm="${m.id}">Remover</button>` : ""}</td></tr>`).join("") + "</table></div>";
  document.querySelectorAll("[data-rm]").forEach(b => b.onclick = async () => { if (await confirmar("Remover " + b.dataset.rm + " da equipe?", { titulo: "Remover membro", ok: "Remover", perigo: true })) { await deleteDoc(doc(db, "equipe", b.dataset.rm)); carregarEquipe(); } });
}
$("#feBusca").oninput = $("#fePapel").onchange = () => desenharEquipe();
$("#btnAddEquipe").onclick = async () => {
  if (!ehAdmin()) return toast("Só admin cadastra equipe.", "erro");
  const email = $("#eEmail").value.trim().toLowerCase(); if (!email.includes("@")) return toast("E-mail inválido.", "erro");
  await setDoc(doc(db, "equipe", email), { email, nome: $("#eNome").value.trim(), papel: $("#ePapel").value, criadoEm: serverTimestamp(), criadoPor: eu.email });
  $("#eEmail").value = ""; $("#eNome").value = ""; toast("Cadastrado", "ok"); carregarEquipe();
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
  h += `<h2>Nota: ${l.nota} / 100 <span class="peq">(${l.pts} de ${l.max} pontos)</span></h2>`;
  if (l.t.encerradaPor === "trocasDeAba") h += `<div class="rapida">⛔ Prova encerrada: limite de saídas da prova atingido.</div>`;
  h += `<div class="peq">Tempo total: ${fmtTempo(l.tempo)} · Trocas de aba: ${abasTexto(l.sinais)} · Saídas da tela cheia: ${l.sinais.telaCheia} · Tentativas de colar: ${l.sinais.colar}</div>`;
  h += l.itens.map(x => {
    const fmt = temFormato(x.q), bloco = t => esc(t).replace(/\n/g, "<br>");
    const sua = x.perdida ? "<i>perdida por sair da prova</i>" : x.r === undefined ? "<i>não respondida</i>" : fmt ? bloco(textoResposta(x.q, x.r)) : x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.r] ?? x.r) : `<span class="mono">${esc(x.r)}</span>`;
    const certa = fmt ? bloco(textoChave(x.q, x.g) || "—") : x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.g.correta] ?? "—") : esc((x.g.respostasAceitas || [])[0] || "—");
    const cls = x.status === "certa" ? "certa" : ["errada", "em_branco", "perdida"].includes(x.status) ? "errada" : "outra";
    const rapida = x.r !== undefined && typeof x.segundos === "number" && x.segundos < RAPIDO;
    const tempo = typeof x.segundos === "number" ? ` · <span class="${rapida ? "rapida" : ""}">⏱ ${fmtTempo(x.segundos)}${rapida ? ` (menos de ${RAPIDO} s)` : ""}</span>` : "";
    return `<div class="q ${cls}"><b>Questão ${x.n}</b> — ${rot[x.status]} · ${x.pontos}/${x.peso}${tempo}<div style="white-space:pre-wrap;margin:4px 0">${esc(x.q.enunciado)}</div>
      <div><b>Resposta do aluno:</b> ${sua}</div>${x.status !== "certa" && certa !== "—" ? `<div><b>Resposta correta:</b> ${certa}</div>` : ""}
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
    resDados.linhas.map((l, i) => `<tr class="${l.temSinal ? "sinal" : ""}"><td>${i + 1}</td><td>${esc(l.t.nome || "")}</td><td>${esc(l.t.email)}</td><td>${l.t.finalizadaEm ? dataBR(l.t.finalizadaEm) : "em andamento"}</td><td>${fmtTempo(l.tempo)}${l.rapidas ? `<br><span class="rapida">${l.rapidas} resp. &lt; ${RAPIDO} s</span>` : ""}</td><td>${sinaisTexto(l.sinais)}${l.t.encerradaPor === "trocasDeAba" ? `<br><span class="rapida">encerrada: limite de saídas</span>` : ""}${l.perdidas ? `<br><span class="rapida">${l.perdidas} perdida(s)</span>` : ""}</td><td><b>${l.nota}</b></td></tr>`).join("") + "</table>" +
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
function atualizarControlesIA() {
  const ok = souDono() && !!iaCfg;
  $("#btnCorrigirIA").disabled = !ok || rodandoIA; $("#iaAuto").disabled = !ok; $("#iaRefazer").disabled = !ok;
  if (!ok) $("#iaAuto").checked = false;
  $("#iaAviso").textContent = ok ? `Modelo: ${iaCfg.modelo}. A IA pode errar: confira as marcadas com 🤖 IA.` : "Configure a chave em Configuração.";
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
function corrigirPendentesIA({ auto = false } = {}) {
  if (!souDono() || !iaCfg) return;
  let itens = pendentesIA({ refazer: !auto && $("#iaRefazer").checked });
  if (auto) itens = itens.filter(it => !tentadasAutoIA.has(it.tid + "/" + it.qid));   // ao vivo: nunca repete (nem as que deram erro)
  let novos = 0;
  for (const it of itens) {
    const k = it.tid + "/" + it.qid;
    if (emFilaIA.has(k)) continue;
    emFilaIA.add(k); if (auto) tentadasAutoIA.add(k); filaIA.push(it); novos++;
  }
  if (!auto && !novos && !rodandoIA) { toast("Nenhuma dissertativa pendente nesta prova.", "info"); return; }
  processarFilaIA();
}
function mostrarProgressoIA(atual) {
  const total = iaFeitas + iaErros + filaIA.length + (atual ? 1 : 0);
  const el = $("#iaProgresso");
  if (!total) { el.innerHTML = ""; return; }
  const feitos = iaFeitas + iaErros;
  el.innerHTML = `<progress class="barra" max="${total}" value="${feitos}"></progress> ` +
    (atual ? `Corrigindo ${feitos + 1} de ${total} — ${esc(atual.nome)}, Q${atual.n}` : `Concluído: ${iaFeitas} corrigida(s)`) + (iaErros ? ` · <span class="erro-texto">${iaErros} com erro</span>` : "");
}
// uma chamada por vez
async function processarFilaIA() {
  if (rodandoIA) return;
  rodandoIA = true; iaFeitas = 0; iaErros = 0; atualizarControlesIA();
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
        await setDoc(ref, { pontos: r.pontos, comentario: r.justificativa, corrigidoPor: "ia:" + iaCfg.modelo, corrigidoEm: serverTimestamp() });
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
    rodandoIA = false; atualizarControlesIA(); mostrarProgressoIA(null);
    if (iaFeitas || iaErros) toast(`IA: ${iaFeitas} corrigida(s)${iaErros ? `, ${iaErros} com erro (veja no detalhe do aluno)` : ""}.`, iaErros ? "erro" : "ok");
  }
}
$("#btnCorrigirIA").onclick = () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  corrigirPendentesIA();
};
$("#iaAuto").onchange = () => {
  if (!$("#iaAuto").checked) return;
  if (!$("#rAoVivo").checked) { $("#rAoVivo").checked = true; carregarResultados(); }   // a correção automática precisa do ao vivo
  else corrigirPendentesIA({ auto: true });
};
