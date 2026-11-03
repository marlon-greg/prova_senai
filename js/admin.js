// Painel do professor: provas, bancos (import JSON), resultados/correção, equipe, configuração.
import { db, auth, entrar, sair, aoMudarLogin, identificar, corrigir, esc, $, toast, dataBR, letra, SUPER_ADMIN, apagarTentativaTeste,
         confirmar, traduzirErro, iniciais } from "./common.js";
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let eu = null;   // { email, nome, papel }
const podeEditar = () => ["admin", "professor"].includes(eu?.papel);
const ehAdmin = () => eu?.papel === "admin";

// ---------- login ----------
$("#btnEntrar").onclick = async () => { try { await entrar(); } catch (e) { $("#msgLogin").textContent = "Não foi possível entrar. " + traduzirErro(e); } };
$("#btnSair").onclick = () => sair();
aoMudarLogin(async user => {
  if (!user) { eu = null; $("#btnSair").classList.add("oculto"); $("#avatar").classList.add("oculto"); $("#quem").textContent = ""; trocar("telaLogin"); return; }
  const id = await identificar(user);
  $("#quem").textContent = `${id.email}${id.papel ? " · " + id.papel : ""}`; $("#btnSair").classList.remove("oculto");
  $("#avatar").textContent = iniciais(user.displayName || id.email); $("#avatar").title = user.displayName || id.email; $("#avatar").classList.remove("oculto");
  if (id.tipo !== "equipe") {
    $("#avisoTexto").innerHTML = `<h2>Sem acesso ao painel</h2><p>A conta <b>${esc(id.email)}</b> não está na equipe. Peça ao administrador para cadastrar.</p><p><a href="index.html">Ir para a página do aluno</a></p>`;
    trocar("telaAviso"); return;
  }
  eu = id;
  await garantirConfig();
  trocar("telaPainel");
  document.querySelectorAll("[data-aba]").forEach(b => b.onclick = () => abrirAba(b.dataset.aba));
  abrirAba("provas");
});
function trocar(id) { ["telaLogin", "telaPainel", "telaAviso"].forEach(t => $("#" + t).classList.toggle("oculto", t !== id)); }
function abrirAba(a) {
  document.querySelectorAll("[data-aba]").forEach(b => b.classList.toggle("ativa", b.dataset.aba === a));
  ["provas", "bancos", "resultados", "equipe", "config"].forEach(x => $("#aba-" + x).classList.toggle("oculto", x !== a));
  ({ provas: carregarProvas, bancos: carregarBancos, resultados: prepararResultados, equipe: carregarEquipe, config: carregarConfig })[a]();
}

// primeiro acesso do superadmin: cria config/geral (sem ele a regra dos alunos não funciona)
async function garantirConfig() {
  const c = await getDoc(doc(db, "config", "geral"));
  if (!c.exists() && ehAdmin()) await setDoc(doc(db, "config", "geral"), { dominiosAlunos: ["edu.senai.br", "aluno.senai.br"], criadoEm: serverTimestamp() });
}

// ============================================================ PROVAS
let bancosCache = [];
async function listarBancos() {
  const s = await getDocs(collection(db, "bancos"));
  bancosCache = []; s.forEach(d => bancosCache.push({ id: d.id, ...d.data() }));
  bancosCache.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  return bancosCache;
}
async function carregarProvas() {
  await listarBancos();
  $("#pBanco").innerHTML = bancosCache.map(b => `<option value="${b.id}">${esc(b.nome)} (${b.nQuestoes} questões)</option>`).join("") || "<option value=''>— importe um banco primeiro —</option>";
  const s = await getDocs(collection(db, "provas"));
  const provas = []; s.forEach(d => provas.push({ id: d.id, ...d.data() }));
  provas.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  const box = $("#listaProvas");
  if (!provas.length) { box.innerHTML = `<div class="vazio"><div class="icone">📝</div><p>Nenhuma prova ainda. Crie a primeira no formulário acima.</p></div>`; return; }
  box.innerHTML = `<div class="tabela"><table><tr><th>Prova</th><th>Banco</th><th>Questões</th><th>Status</th><th>Resultados</th><th></th></tr>` + provas.map(p => {
    const b = bancosCache.find(x => x.id === p.bancoId);
    return `<tr><td><b>${esc(p.titulo)}</b><br><span class="pequeno">${esc(p.turma || "")}</span></td><td>${esc(b?.nome || p.bancoId)}<br><span class="pequeno">${esc(b?.materia || "")}</span></td><td>${p.nQuestoes}${p.nDissertativas ? `<br><span class="pequeno">${p.nDissertativas} dissert.</span>` : ""}${p.tempoMinutos > 0 ? `<br><span class="pequeno">⏱ ${p.tempoMinutos} min</span>` : ""}</td>
      <td><span class="tag ${p.liberada ? "on" : "off"}">${p.liberada ? "● liberada" : "○ fechada"}</span></td>
      <td><span class="tag ${p.resultadosLiberados ? "on" : "off"}">${p.resultadosLiberados ? "● liberados" : "○ ocultos"}</span></td>
      <td class="td-acoes">${podeEditar() ? `<button class="mini ${p.liberada ? "leve" : "ok"}" data-tg="liberada" data-id="${p.id}">${p.liberada ? "Encerrar" : "Liberar prova"}</button>
        <button class="leve mini" data-tg="resultadosLiberados" data-id="${p.id}">${p.resultadosLiberados ? "Ocultar resultados" : "Liberar resultados"}</button><br>` : ""}
        <button class="leve mini" data-testar="${p.id}" title="Abre a prova em nova aba, como o aluno vê (não vale nota)">Testar como aluno</button>
        <button class="perigo mini" data-apagarteste="${p.id}" title="Apaga a sua tentativa de teste desta prova">Apagar meu teste</button>
        ${podeEditar() && ehAdmin() ? `<button class="perigo mini" data-del="${p.id}" title="Apagar prova" aria-label="Apagar prova">🗑 Apagar</button>` : ""}</td></tr>`;
  }).join("") + "</table></div>";
  box.querySelectorAll("[data-tg]").forEach(b => b.onclick = async () => {
    const p = provas.find(x => x.id === b.dataset.id);
    await updateDoc(doc(db, "provas", p.id), { [b.dataset.tg]: !p[b.dataset.tg] });
    toast("Prova atualizada", "ok"); carregarProvas();
  });
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
$("#btnCriarProva").onclick = async () => {
  if (!podeEditar()) return toast("Seu papel não permite criar provas.", "erro");
  const titulo = $("#pTitulo").value.trim(), bancoId = $("#pBanco").value, n = Number($("#pN").value), nDiss = Number($("#pNDiss").value || 0);
  if (nDiss > n) return toast("O número de dissertativas não pode passar do total de questões.", "erro");
  if (!titulo || !bancoId || !n) return toast("Preencha título, banco e número de questões.", "erro");
  const tempoMinutos = Math.max(0, Math.round(Number($("#pTempo").value || 0)));
  const b = bancosCache.find(x => x.id === bancoId);
  if (b && n > b.nQuestoes) return toast(`O banco só tem ${b.nQuestoes} questões.`, "erro");
  if (nDiss) { const qs = await getDocs(collection(db, "bancos", bancoId, "questoes")); let d = 0, a = 0; qs.forEach(x => x.data().tipo === "dissertativa" ? d++ : a++);
    if (nDiss > d) return toast(`O banco só tem ${d} dissertativa(s).`, "erro"); if (n - nDiss > a) return toast(`O banco só tem ${a} de alternativa.`, "erro"); }
  await addDoc(collection(db, "provas"), { titulo, turma: $("#pTurma").value.trim(), bancoId, nQuestoes: n, nDissertativas: nDiss,
    feedbackImediato: $("#pFeedback").value, embaralharAlternativas: $("#pEmbaralhar").checked, tempoMinutos,
    liberada: false, resultadosLiberados: false, criadoEm: serverTimestamp(), criadoPor: eu.email });
  $("#pTitulo").value = ""; toast("Prova criada (ainda fechada). Libere quando for aplicar.", "ok"); carregarProvas();
};

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
  try { const b = validarBanco($("#txtBanco").value); $("#msgBanco").innerHTML = `✅ OK: <b>${esc(b.nome)}</b>, ${b.questoes.length} questões (${b.questoes.filter(q => q.tipo === "alternativa").length} de alternativa, ${b.questoes.filter(q => q.tipo === "dissertativa").length} dissertativas).`; }
  catch (e) { $("#msgBanco").innerHTML = `❌ ${esc(e.message)}`; }
};
$("#btnImportarBanco").onclick = async () => {
  if (!podeEditar()) return toast("Seu papel não permite importar.", "erro");
  let b; try { b = validarBanco($("#txtBanco").value); } catch (e) { return $("#msgBanco").innerHTML = `❌ ${esc(e.message)}`; }
  const ref = await addDoc(collection(db, "bancos"), { nome: b.nome, materia: b.materia || "", nQuestoes: b.questoes.length, criadoEm: serverTimestamp(), criadoPor: eu.email });
  const lote = writeBatch(db);
  b.questoes.forEach((q, i) => {
    const qid = `${ref.id}_q${String(i + 1).padStart(3, "0")}`;
    const pub = { ordem: i + 1, tipo: q.tipo, enunciado: q.enunciado, peso: Number(q.peso || 1) };
    if (q.tipo === "alternativa") pub.alternativas = q.alternativas;
    lote.set(doc(db, "bancos", ref.id, "questoes", qid), pub);
    const gab = { explicacao: q.explicacao || "" };
    if (q.tipo === "alternativa") gab.correta = q.correta; else { gab.respostasAceitas = q.respostasAceitas || []; gab.palavrasChave = q.palavrasChave || []; }
    lote.set(doc(db, "bancos", ref.id, "gabaritos", qid), gab);
  });
  await lote.commit();
  $("#msgBanco").innerHTML = `✅ Banco <b>${esc(b.nome)}</b> importado com ${b.questoes.length} questões.`; $("#txtBanco").value = "";
  carregarBancos();
};
async function carregarBancos() {
  await listarBancos();
  const box = $("#listaBancos");
  if (!bancosCache.length) { box.innerHTML = `<div class="vazio"><div class="icone">📚</div><p>Nenhum banco ainda. Importe o <b>modelo_banco.json</b> acima para começar.</p></div>`; return; }
  box.innerHTML = `<div class="tabela"><table><tr><th>Banco</th><th>Matéria</th><th>Questões</th><th></th></tr>` + bancosCache.map(b =>
    `<tr><td><b>${esc(b.nome)}</b><br><span class="pequeno">${b.id}</span></td><td>${esc(b.materia || "")}</td><td>${b.nQuestoes}</td>
     <td class="td-acoes"><button class="leve mini" data-gab="${b.id}">Gabarito p/ Classroom</button> ${ehAdmin() ? `<button class="perigo mini" data-delb="${b.id}" aria-label="Apagar banco">🗑 Apagar</button>` : ""}</td></tr>`).join("") + "</table></div>";
  box.querySelectorAll("[data-gab]").forEach(x => x.onclick = () => gerarGabarito(x.dataset.gab));
  box.querySelectorAll("[data-delb]").forEach(x => x.onclick = async () => {
    if (!(await confirmar("Apagar o banco e todas as suas questões?", { titulo: "Apagar banco", ok: "Apagar", perigo: true }))) return;
    const id = x.dataset.delb, lote = writeBatch(db);
    (await getDocs(collection(db, "bancos", id, "questoes"))).forEach(d => lote.delete(d.ref));
    (await getDocs(collection(db, "bancos", id, "gabaritos"))).forEach(d => lote.delete(d.ref));
    lote.delete(doc(db, "bancos", id)); await lote.commit(); carregarBancos();
  });
}
async function lerBanco(bancoId) {
  const [qs, gs] = await Promise.all([getDocs(collection(db, "bancos", bancoId, "questoes")), getDocs(collection(db, "bancos", bancoId, "gabaritos"))]);
  const questoes = {}, gabaritos = {};
  qs.forEach(d => questoes[d.id] = { id: d.id, ...d.data() }); gs.forEach(d => gabaritos[d.id] = d.data());
  return { questoes, gabaritos };
}
async function gerarGabarito(bancoId) {
  const b = bancosCache.find(x => x.id === bancoId), { questoes, gabaritos } = await lerBanco(bancoId);
  const lista = Object.values(questoes).sort((a, c) => a.ordem - c.ordem);
  let t = `GABARITO — ${b.nome}\n${"=".repeat(60)}\nCada aluno recebeu um sorteio de questões deste banco: confira as suas pelo enunciado.\n\n`;
  lista.forEach(q => {
    const g = gabaritos[q.id] || {};
    t += `${q.ordem}) ${q.enunciado}\n`;
    if (q.tipo === "alternativa") { q.alternativas.forEach((a, i) => t += `   ${letra(i)}) ${a}\n`); t += `   ✔ Resposta: ${letra(g.correta)}) ${q.alternativas[g.correta]}\n`; }
    else t += `   ✔ Resposta esperada: ${(g.respostasAceitas || [])[0] || "(ver palavras-chave: " + (g.palavrasChave || []).join(", ") + ")"}\n`;
    if (g.explicacao) t += `   💡 ${g.explicacao}\n`;
    t += "\n";
  });
  $("#txtGabarito").textContent = t; $("#cardGabarito").classList.remove("oculto"); $("#cardGabarito").scrollIntoView({ behavior: "smooth" });
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
function sinaisDe(t) { return { abas: t.trocasDeAba || 0, telaCheia: t.saidasTelaCheia || 0, colar: t.tentativasColar || 0 }; }
function sinaisHTML(s) {
  const item = (ic, n, tit) => `<span class="${n ? "" : "zero"}" title="${tit}">${ic} ${n}</span>`;
  return `<span class="sinais">${item("🔀", s.abas, "Trocas de aba/janela")}${item("⛶", s.telaCheia, "Saídas da tela cheia")}${item("📋", s.colar, "Tentativas de colar")}</span>`;
}
function sinaisTexto(s) { return `abas ${s.abas} · tela cheia ${s.telaCheia} · colar ${s.colar}`; }

let resDados = null;   // { prova, questoes, gabaritos, linhas: [...] }
async function prepararResultados() {
  const s = await getDocs(collection(db, "provas"));
  const provas = []; s.forEach(d => provas.push({ id: d.id, ...d.data() }));
  $("#rProva").innerHTML = provas.map(p => `<option value="${p.id}">${esc(p.titulo)} · ${esc(p.turma || "")}</option>`).join("");
}
$("#btnCarregarRes").onclick = carregarResultados;
async function carregarResultados() {
  const provaId = $("#rProva").value; if (!provaId) return;
  $("#resTabela").innerHTML = "<p class='pequeno'>Carregando…</p>";
  const prova = { id: provaId, ...(await getDoc(doc(db, "provas", provaId))).data() };
  const { questoes, gabaritos } = await lerBanco(prova.bancoId);
  const ts = await getDocs(query(collection(db, "tentativas"), where("provaId", "==", provaId)));
  const linhas = [];
  for (const d of ts.docs) {
    const t = { id: d.id, ...d.data() };
    if (t.teste === true) continue;   // tentativas do modo teste (equipe) não entram em tabela, média, CSV, PDFs nem "Fechar notas"
    const [rs, cs] = await Promise.all([getDocs(collection(db, "tentativas", t.id, "respostas")), getDocs(collection(db, "tentativas", t.id, "correcoes"))]);
    const resp = {}; rs.forEach(x => resp[x.id] = x.data()); const corr = {}; cs.forEach(x => corr[x.id] = x.data());
    const itens = t.questoesIds.map((qid, i) => {
      const q = questoes[qid] || { tipo: "?", enunciado: "(questão removida)", peso: 1 }, g = gabaritos[qid] || {};
      const r = resp[qid]?.resposta, peso = Number(q.peso || 1);
      let c = corrigir(q, g, r);
      if (corr[qid]?.pontos !== undefined) c = { pontos: Number(corr[qid].pontos), status: Number(corr[qid].pontos) >= peso ? "certa" : Number(corr[qid].pontos) > 0 ? "parcial" : "errada", manual: true };
      return { n: i + 1, qid, q, g, r, peso, ...c, comentario: corr[qid]?.comentario || "", segundos: resp[qid]?.segundos };
    });
    const max = itens.reduce((s, x) => s + x.peso, 0), pts = itens.reduce((s, x) => s + x.pontos, 0);
    const sinais = sinaisDe(t);
    linhas.push({ t, itens, max, pts, nota: max ? Math.round(pts / max * 1000) / 10 : 0, revisar: itens.filter(x => x.status === "revisar").length,
                  tempo: tempoTotal(t), sinais, temSinal: sinais.abas + sinais.telaCheia + sinais.colar > 0,
                  rapidas: itens.filter(x => x.r !== undefined && typeof x.segundos === "number" && x.segundos < RAPIDO).length });
  }
  linhas.sort((a, b) => (a.t.nome || a.t.email).localeCompare(b.t.nome || b.t.email));
  resDados = { prova, questoes, gabaritos, linhas };
  desenharResultados();
}
function desenharResultados() {
  const { prova, linhas } = resDados;
  const fin = linhas.filter(l => l.t.finalizadaEm), comSinal = linhas.filter(l => l.temSinal).length, media = fin.length ? (fin.reduce((s, l) => s + l.nota, 0) / fin.length).toFixed(1) : "—";
  const revisar = linhas.reduce((s, l) => s + l.revisar, 0);
  $("#resResumo").innerHTML = `<div class="numeros">
      <div class="numero"><b>${linhas.length}</b><span>alunos iniciaram</span></div>
      <div class="numero"><b>${fin.length}</b><span>finalizaram</span></div>
      <div class="numero"><b>${media}</b><span>média (0–100)</span></div>
      <div class="numero ${revisar ? "aviso" : ""}"><b>${revisar}</b><span>respostas a revisar</span></div>
      <div class="numero ${comSinal ? "aviso" : ""}"><b>${comSinal}</b><span>com sinais (aba, tela cheia, colar)</span></div></div>`;
  if (!linhas.length) { $("#resTabela").innerHTML = `<div class="card vazio"><div class="icone">⏳</div><p>Ninguém fez esta prova ainda.</p></div>`; return; }
  $("#resTabela").innerHTML = `<div class="card"><div class="tabela"><table><tr><th>Aluno</th><th>Início</th><th>Fim</th><th>Tempo</th><th>Sinais</th><th>Nota</th><th>Revisar</th><th></th></tr>` +
    linhas.map((l, i) => `<tr class="${l.temSinal ? "com-sinal" : ""}"><td><b>${esc(l.t.nome || "")}</b><br><span class="pequeno">${esc(l.t.email)}</span></td><td class="pequeno">${dataBR(l.t.iniciadaEm)}</td><td class="pequeno">${l.t.finalizadaEm ? dataBR(l.t.finalizadaEm) : "<span class='tag aviso'>em andamento</span>"}</td>
      <td>${fmtTempo(l.tempo)}${l.rapidas ? `<br><span class="tag erro" title="Respostas enviadas em menos de ${RAPIDO} segundos">⚡ ${l.rapidas} rápida(s)</span>` : ""}</td><td>${sinaisHTML(l.sinais)}</td><td><b>${l.nota}</b>${l.t.nota !== undefined ? ` <span class="pequeno">(fechada: ${l.t.nota})</span>` : l.t.notaPrevia !== null && l.t.notaPrevia !== undefined ? ` <span class="pequeno">(prévia: ${l.t.notaPrevia})</span>` : ""}</td><td>${l.revisar ? `<span class="tag aviso">${l.revisar}</span>` : "—"}</td>
      <td class="td-acoes"><button class="leve mini" data-ver="${i}">Ver</button> ${ehAdmin() ? `<button class="perigo mini" data-reset="${i}" title="Apagar a tentativa (o aluno pode refazer)">↺ Apagar</button>` : ""}</td></tr>`).join("") + `</table></div></div><div id="resDetalhe"></div>`;
  document.querySelectorAll("[data-ver]").forEach(b => b.onclick = () => verAluno(Number(b.dataset.ver)));
  document.querySelectorAll("[data-reset]").forEach(b => b.onclick = async () => {
    const l = linhas[Number(b.dataset.reset)];
    if (!(await confirmar(`Apagar a tentativa de ${l.t.nome || l.t.email}? A pessoa poderá fazer a prova de novo (com novo sorteio).`, { titulo: "Apagar tentativa", ok: "Apagar", perigo: true }))) return;
    const lote = writeBatch(db);
    (await getDocs(collection(db, "tentativas", l.t.id, "respostas"))).forEach(d => lote.delete(d.ref));
    (await getDocs(collection(db, "tentativas", l.t.id, "correcoes"))).forEach(d => lote.delete(d.ref));
    for (const qid of l.t.questoesIds) lote.delete(doc(db, "marcadores", `${l.t.uid}_${qid}`));
    lote.delete(doc(db, "tentativas", l.t.id)); await lote.commit(); toast("Tentativa apagada", "ok"); carregarResultados();
  });
}
function verAluno(i) {
  const l = resDados.linhas[i], box = $("#resDetalhe");
  const rot = { certa: ["ok", "✅ certa"], errada: ["erro", "❌ errada"], parcial: ["aviso", "🟡 parcial"], revisar: ["aviso", "🟡 revisar"], em_branco: ["erro", "⬜ em branco"] };
  box.innerHTML = `<div class="card"><div class="linha"><h2 style="flex:3">${esc(l.t.nome || l.t.email)} — ${l.nota}/100 (${l.pts} de ${l.max} pontos)</h2><button class="leve mini" id="btnPDFAluno" style="flex:0 0 auto">PDF deste aluno</button></div>
    <p class="pequeno">Tempo total: <b>${fmtTempo(l.tempo)}</b> · ${sinaisHTML(l.sinais)}</p>` + l.itens.map(x => {
    const rapida = x.r !== undefined && typeof x.segundos === "number" && x.segundos < RAPIDO;
    const tempo = typeof x.segundos === "number" ? `<span class="tag ${rapida ? "erro" : ""}" title="Tempo entre a questão aparecer e a resposta ser enviada">⏱ ${fmtTempo(x.segundos)}${rapida ? ` · menos de ${RAPIDO} s` : ""}</span>` : "";
    const sua = x.r === undefined ? "<i>não respondida</i>" : x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.r] ?? x.r) : `<span class="mono">${esc(x.r)}</span>`;
    const certa = x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.g.correta] ?? "—") : esc((x.g.respostasAceitas || [])[0] || (x.g.palavrasChave || []).join(" + "));
    const manual = podeEditar() && x.q.tipo === "dissertativa" ? `<div class="linha" style="margin-top:6px"><div style="flex:0 0 120px"><label>Pontos (0–${x.peso})</label><input type="number" min="0" max="${x.peso}" step="0.5" value="${x.pontos}" id="pt_${x.qid}"></div><div><label>Comentário para o aluno</label><input type="text" id="cm_${x.qid}" value="${esc(x.comentario)}"></div><div style="flex:0 0 120px;align-self:flex-end"><button class="mini" data-corr="${x.qid}" data-i="${i}">Salvar</button></div></div>` : "";
    return `<div class="feedback bloco ${x.status === "certa" ? "certa" : x.status === "errada" ? "errada" : "revisar"}"><div class="linha acoes"><b>Q${x.n}</b> <span class="tag ${rot[x.status][0]}">${rot[x.status][1]} · ${x.pontos}/${x.peso}${x.manual ? " · manual" : ""}</span>${tempo}</div>
      <div class="enunciado pequeno">${esc(x.q.enunciado)}</div><p><b>Resposta do aluno:</b> ${sua}<br><b>Esperada:</b> ${certa}</p>${manual}</div>`;
  }).join("") + "</div>";
  box.scrollIntoView({ behavior: "smooth" });
  $("#btnPDFAluno").onclick = () => abrirImpressao(`Boletim — ${resDados.prova.titulo}`, boletimHTML(l));
  box.querySelectorAll("[data-corr]").forEach(b => b.onclick = async () => {
    const qid = b.dataset.corr, pontos = Number($("#pt_" + qid).value), comentario = $("#cm_" + qid).value.trim();
    await setDoc(doc(db, "tentativas", l.t.id, "correcoes", qid), { pontos, comentario, corrigidoPor: eu.email, corrigidoEm: serverTimestamp() });
    toast("Correção salva", "ok"); await carregarResultados(); verAluno(i);
  });
}
$("#btnFecharNotas").onclick = async () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  if (!podeEditar()) return toast("Seu papel não permite fechar notas.", "erro");
  const pend = resDados.linhas.reduce((s, l) => s + l.revisar, 0);
  if (pend && !(await confirmar(`Ainda há ${pend} resposta(s) marcada(s) como "revisar" (valem 0 até você corrigir). Fechar mesmo assim?`, { titulo: "Fechar notas", ok: "Fechar mesmo assim" }))) return;
  const lote = writeBatch(db);
  resDados.linhas.forEach(l => lote.update(doc(db, "tentativas", l.t.id), { nota: l.nota, notaMaxima: 100, corrigidaEm: serverTimestamp(), corrigidaPor: eu.email }));
  await lote.commit(); toast("Notas gravadas. Agora você pode liberar os resultados na aba Provas.", "ok"); carregarResultados();
};
$("#btnCSV").onclick = () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  const n = resDados.prova.nQuestoes;
  const cab = ["Nome", "E-mail", "Início", "Fim", "Tempo", "Tempo (segundos)", "Trocas de aba", "Saídas da tela cheia", "Tentativas de colar", `Respostas < ${RAPIDO}s`, "Nota",
               ...Array.from({ length: n }, (_, i) => `Q${i + 1}`)];
  const rows = resDados.linhas.map(l => [l.t.nome || "", l.t.email, dataBR(l.t.iniciadaEm), l.t.finalizadaEm ? dataBR(l.t.finalizadaEm) : "em andamento",
    fmtTempo(l.tempo), l.tempo ?? "", l.sinais.abas, l.sinais.telaCheia, l.sinais.colar, l.rapidas, String(l.nota).replace(".", ","),
    ...l.itens.map(x => `${x.pontos}/${x.peso} ${x.status}${typeof x.segundos === "number" ? ` (${x.segundos}s)` : ""}`)]);
  const csv = [cab, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  baixar(`resultados_${resDados.prova.titulo.replace(/\W+/g, "_")}.csv`, "﻿" + csv);
};

// ============================================================ EQUIPE
async function carregarEquipe() {
  const s = await getDocs(collection(db, "equipe"));
  const lista = []; s.forEach(d => lista.push({ id: d.id, ...d.data() }));
  $("#listaEquipe").innerHTML = `<div class="tabela"><table><tr><th>E-mail</th><th>Nome</th><th>Papel</th><th></th></tr>
    <tr><td>${esc(SUPER_ADMIN)}</td><td>—</td><td><span class="tag on">admin principal</span></td><td class="pequeno">fixo nas regras</td></tr>` +
    lista.map(m => `<tr><td>${esc(m.id)}</td><td>${esc(m.nome || "")}</td><td><span class="tag">${esc(m.papel)}</span></td><td>${ehAdmin() ? `<button class="perigo mini" data-rm="${m.id}">Remover</button>` : ""}</td></tr>`).join("") + "</table></div>";
  document.querySelectorAll("[data-rm]").forEach(b => b.onclick = async () => { if (await confirmar("Remover " + b.dataset.rm + " da equipe?", { titulo: "Remover membro", ok: "Remover", perigo: true })) { await deleteDoc(doc(db, "equipe", b.dataset.rm)); carregarEquipe(); } });
}
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
}
$("#btnSalvarConfig").onclick = async () => {
  if (!ehAdmin()) return toast("Só admin altera a configuração.", "erro");
  const dominios = $("#cDominios").value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  await setDoc(doc(db, "config", "geral"), { dominiosAlunos: dominios }, { merge: true });
  $("#msgConfig").textContent = "Salvo: " + dominios.join(", ");
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
  const rot = { certa: "✔ certa", errada: "✘ errada", parcial: "◐ parcial", revisar: "◌ em correção", em_branco: "□ em branco" };
  let h = cab(`Boletim — ${p.titulo}`, `${l.t.nome || ""} · ${l.t.email} · ${p.turma || ""} · finalizada em ${l.t.finalizadaEm ? dataBR(l.t.finalizadaEm) : "—"}`);
  h += `<h2>Nota: ${l.nota} / 100 <span class="peq">(${l.pts} de ${l.max} pontos)</span></h2>`;
  h += `<div class="peq">Tempo total: ${fmtTempo(l.tempo)} · Trocas de aba: ${l.sinais.abas} · Saídas da tela cheia: ${l.sinais.telaCheia} · Tentativas de colar: ${l.sinais.colar}</div>`;
  h += l.itens.map(x => {
    const sua = x.r === undefined ? "<i>não respondida</i>" : x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.r] ?? x.r) : `<span class="mono">${esc(x.r)}</span>`;
    const certa = x.q.tipo === "alternativa" ? esc(x.q.alternativas?.[x.g.correta] ?? "—") : esc((x.g.respostasAceitas || [])[0] || "—");
    const cls = x.status === "certa" ? "certa" : x.status === "errada" || x.status === "em_branco" ? "errada" : "outra";
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
    resDados.linhas.map((l, i) => `<tr class="${l.temSinal ? "sinal" : ""}"><td>${i + 1}</td><td>${esc(l.t.nome || "")}</td><td>${esc(l.t.email)}</td><td>${l.t.finalizadaEm ? dataBR(l.t.finalizadaEm) : "em andamento"}</td><td>${fmtTempo(l.tempo)}${l.rapidas ? `<br><span class="rapida">${l.rapidas} resp. &lt; ${RAPIDO} s</span>` : ""}</td><td>${sinaisTexto(l.sinais)}</td><td><b>${l.nota}</b></td></tr>`).join("") + "</table>" +
    `<p class="peq">Sinais = trocas de aba/janela · saídas da tela cheia · tentativas de colar. Linhas destacadas têm pelo menos um sinal. São indícios para conferir, não prova de cola.</p>`;
  abrirImpressao(`Notas — ${p.titulo}`, corpo);
};
$("#btnPDFBoletins").onclick = () => {
  if (!resDados) return toast("Carregue uma prova primeiro.", "erro");
  const ls = resDados.linhas.filter(l => l.t.finalizadaEm);
  if (!ls.length) return toast("Ninguém finalizou ainda.", "erro");
  abrirImpressao(`Boletins — ${resDados.prova.titulo}`, ls.map((l, i) => boletimHTML(l, i < ls.length - 1)).join(""));
};
