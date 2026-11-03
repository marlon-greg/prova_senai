// Painel do professor: provas, bancos (import JSON), resultados/correção, equipe, configuração.
import { db, auth, entrar, sair, aoMudarLogin, identificar, corrigir, esc, $, toast, dataBR, letra, SUPER_ADMIN, apagarTentativaTeste,
         confirmar, modal, traduzirErro, iniciais, temaDe, ordenarTemas } from "./common.js";
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

// ============================================================ PROVAS
let bancosCache = [];
async function listarBancos() {
  const s = await getDocs(collection(db, "bancos"));
  bancosCache = []; s.forEach(d => bancosCache.push({ id: d.id, ...d.data() }));
  bancosCache.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  return bancosCache;
}
const opcoesBancos = () => bancosCache.map(b => `<option value="${b.id}">${esc(b.nome)} (${b.nQuestoes} questões)</option>`).join("") || "<option value=''>— importe um banco primeiro —</option>";

// ---------- formulário da prova (o mesmo para "Nova prova" e para o modal "Editar") ----------
// f = prefixo dos ids: "p" (nova prova) ou "e" (editar)
const AJUDA_MATERIAL = "Google Drive: Compartilhar → Qualquer pessoa com o link → copiar link. Google Slides: Arquivo → Compartilhar → Publicar na web. Cole o link aqui.";
function formProvaHTML(f) {
  return `
  <div class="grade">
    <div><label for="${f}Titulo">Título</label><input type="text" id="${f}Titulo" placeholder="MS5 — DML"></div>
    <div><label for="${f}Turma">Turma (texto livre)</label><input type="text" id="${f}Turma" placeholder="DETS-1A"></div>
    <div><label for="${f}Banco">Banco de questões</label><select id="${f}Banco"></select></div>
  </div>
  <p id="${f}Trava" class="aviso-box oculto" role="note"></p>
  <fieldset class="temas-box">
    <legend>Temas que entram no sorteio</legend>
    <div id="${f}Temas" class="lista-temas"><p class="pequeno">Escolha um banco para ver os temas.</p></div>
    <p id="${f}TemasResumo" class="pequeno temas-resumo" role="status" aria-live="polite"></p>
  </fieldset>
  <div class="grade">
    <div><label for="${f}N">Questões por aluno</label><input type="number" id="${f}N" value="10" min="1"></div>
    <div><label for="${f}NDiss">Das quais dissertativas (0 = sorteio livre)</label><input type="number" id="${f}NDiss" value="3" min="0"></div>
    <div><label for="${f}Feedback">Feedback ao enviar cada resposta</label>
      <select id="${f}Feedback"><option value="acerto">Só diz se acertou ou errou</option><option value="completo">Mostra a resposta certa e a explicação</option><option value="nenhum">Nenhum (só no resultado final)</option></select></div>
  </div>
  <div class="grade">
    <div><label for="${f}Tempo">Tempo limite (min, 0 = sem limite)</label><input type="number" id="${f}Tempo" value="0" min="0" step="5"></div>
    <div><label for="${f}Modo">Exibição das questões</label>
      <select id="${f}Modo"><option value="uma">Uma por vez, sem voltar</option><option value="todas">Todas na mesma página (cada uma com seu botão Enviar)</option></select></div>
  </div>
  <fieldset class="temas-box">
    <legend>Regras da prova</legend>
    <label class="check"><input type="checkbox" id="${f}Embaralhar" checked> Embaralhar a ordem das alternativas para cada aluno</label>
    <label class="check"><input type="checkbox" id="${f}PermitirTrocaAba"> <span>Permitir trocar de aba/janela <span class="pequeno">— sem tela cheia e sem aviso; as trocas continuam contadas, marcadas como "permitido"</span></span></label>
    <label class="check"><input type="checkbox" id="${f}PermitirColar"> <span>Permitir colar nos campos de resposta <span class="pequeno">— colar e arrastar liberados, sem registro</span></span></label>
  </fieldset>
  <fieldset class="temas-box">
    <legend>Material de consulta (opcional)</legend>
    <div class="grade">
      <div><label for="${f}MatTitulo">Título do material</label><input type="text" id="${f}MatTitulo" placeholder="Slides da aula 8"></div>
      <div class="col-2"><label for="${f}MatUrl">Link do material</label><input type="url" id="${f}MatUrl" placeholder="https://drive.google.com/file/d/…/view"></div>
    </div>
    <p class="pequeno">${AJUDA_MATERIAL}</p>
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

// Controla um formulário de prova: temas do banco, resumo ao vivo, validação, leitura e preenchimento.
function controleProva(f) {
  const $f = s => $("#" + f + s);
  let contagem = {}, bancoDesenhado = null, travado = false;
  const disponiveis = () => temasMarcados($f("Temas")).reduce((s, t) => ({ alternativa: s.alternativa + (contagem[t]?.alternativa || 0), dissertativa: s.dissertativa + (contagem[t]?.dissertativa || 0) }), { alternativa: 0, dissertativa: 0 });
  // devolve a mensagem de erro (ou "") para o pedido atual
  function problema() {
    const n = Number($f("N").value || 0), nDiss = Number($f("NDiss").value || 0), d = disponiveis();
    if (travado || !Object.keys(contagem).length) return "";
    if (!temasMarcados($f("Temas")).length) return "Marque pelo menos um tema.";
    if (nDiss > 0) {
      if (n - nDiss > d.alternativa) return `Faltam questões de alternativa: a prova pede ${n - nDiss} (${n} − ${nDiss} dissertativas), mas os temas marcados só têm ${d.alternativa}. Marque mais temas ou diminua o número de questões.`;
      if (nDiss > d.dissertativa) return `Faltam dissertativas: a prova pede ${nDiss}, mas os temas marcados só têm ${d.dissertativa}. Marque mais temas ou diminua o número de dissertativas.`;
    } else if (n > d.alternativa + d.dissertativa) {
      return `Faltam questões: a prova pede ${n}, mas os temas marcados só têm ${d.alternativa + d.dissertativa}. Marque mais temas ou diminua o número de questões.`;
    }
    return "";
  }
  function atualizar() {
    const el = $f("TemasResumo");
    if (!Object.keys(contagem).length) { el.textContent = ""; el.classList.remove("erro"); return; }
    const prob = problema();
    el.textContent = `Disponíveis com os temas marcados: ${textoContagem(disponiveis())}.` + (prob ? " ⚠ " + prob : "");
    el.classList.toggle("erro", !!prob);
  }
  // desenha os temas do banco escolhido; marcados = null -> todos marcados
  async function carregarTemas(marcados = null) {
    const bancoId = $f("Banco").value, box = $f("Temas");
    contagem = {}; bancoDesenhado = bancoId;
    if (!bancoId) { box.innerHTML = `<p class="pequeno">Escolha um banco para ver os temas.</p>`; atualizar(); return; }
    box.innerHTML = `<p class="pequeno">Carregando temas…</p>`;
    try {
      const qs = await questoesDoBanco(bancoId);
      if ($f("Banco").value !== bancoId) return;   // trocou de banco enquanto carregava
      contagem = contarPorTema(qs);
      desenharChecksTemas(box, contagem, atualizar);
      if (Array.isArray(marcados) && marcados.length) box.querySelectorAll("input[type=checkbox]").forEach(c => c.checked = marcados.includes(c.value));
      if (travado) box.querySelectorAll("input, button").forEach(x => x.disabled = true);
    } catch (e) { box.innerHTML = `<p class="pequeno">Não foi possível carregar os temas. ${esc(traduzirErro(e))}</p>`; }
    atualizar();
  }
  function previaMaterial() {
    const url = $f("MatUrl").value.trim(), conv = converterLinkMaterial(url), el = $f("MatPrevia");
    if (!url) { el.textContent = ""; return; }
    if (!/^https:\/\//.test(conv)) { el.innerHTML = `⚠ Use um link que comece com <b>https://</b>.`; return; }
    el.innerHTML = conv !== url ? `Será salvo no formato para exibir na prova: <span class="mono">${esc(conv)}</span>` : `Link salvo como está.`;
  }
  // liga os eventos (chamar depois que o HTML estiver na página)
  function ligar() {
    $f("Banco").onchange = () => carregarTemas();
    $f("N").oninput = $f("NDiss").oninput = atualizar;
    $f("MatUrl").oninput = previaMaterial;
  }
  // trava banco, número de questões, dissertativas e temas (prova que já tem tentativas de alunos)
  function travar(motivo) {
    travado = true;
    ["Banco", "N", "NDiss"].forEach(s => $f(s).disabled = true);
    $f("Temas").querySelectorAll("input, button").forEach(x => x.disabled = true);
    $f("Trava").innerHTML = motivo; $f("Trava").classList.remove("oculto");
    atualizar();
  }
  function preencher(p) {
    $f("Titulo").value = p.titulo || ""; $f("Turma").value = p.turma || "";
    $f("Banco").value = p.bancoId || ""; $f("N").value = p.nQuestoes ?? 10; $f("NDiss").value = p.nDissertativas ?? 0;
    $f("Feedback").value = p.feedbackImediato || "acerto"; $f("Tempo").value = p.tempoMinutos || 0;
    $f("Modo").value = p.modoExibicao === "todas" ? "todas" : "uma";
    $f("Embaralhar").checked = p.embaralharAlternativas !== false;
    $f("PermitirTrocaAba").checked = p.permitirTrocaAba === true; $f("PermitirColar").checked = p.permitirColar === true;
    $f("MatTitulo").value = p.materialConsultaTitulo || ""; $f("MatUrl").value = p.materialConsultaUrl || "";
    previaMaterial();
  }
  // lê e valida; devolve { erro } ou { dados }
  async function ler() {
    const titulo = $f("Titulo").value.trim(), bancoId = $f("Banco").value, n = Number($f("N").value), nDiss = Number($f("NDiss").value || 0);
    if (!titulo) return { erro: "Preencha o título." };
    if (!travado && (!bancoId || !n)) return { erro: "Preencha banco e número de questões." };
    if (nDiss > n) return { erro: "O número de dissertativas não pode passar do total de questões." };
    if (!travado && (bancoDesenhado !== bancoId || !Object.keys(contagem).length)) await carregarTemas();   // garante a contagem do banco escolhido
    const prob = problema();
    if (prob) { atualizar(); return { erro: prob }; }
    const urlBruta = $f("MatUrl").value.trim(), url = converterLinkMaterial(urlBruta);
    if (url && !/^https:\/\//.test(url)) return { erro: "O link do material de consulta precisa começar com https://." };
    const dados = {
      titulo, turma: $f("Turma").value.trim(),
      feedbackImediato: $f("Feedback").value, embaralharAlternativas: $f("Embaralhar").checked,
      tempoMinutos: Math.max(0, Math.round(Number($f("Tempo").value || 0))),
      modoExibicao: $f("Modo").value === "todas" ? "todas" : "uma",
      permitirTrocaAba: $f("PermitirTrocaAba").checked, permitirColar: $f("PermitirColar").checked,
      materialConsultaUrl: url, materialConsultaTitulo: url ? ($f("MatTitulo").value.trim() || "Material de consulta") : ""
    };
    // campos do sorteio: só entram se não estiverem travados
    if (!travado) Object.assign(dados, { bancoId, nQuestoes: n, nDissertativas: nDiss, temas: temasMarcados($f("Temas")) });   // todos marcados = lista completa
    return { dados };
  }
  return { carregarTemas, atualizar, ligar, travar, preencher, ler, get bancoDesenhado() { return bancoDesenhado; } };
}

$("#formNovaProva").innerHTML = formProvaHTML("p");
const formNova = controleProva("p");
formNova.ligar();

// resumo das opções de uma prova (tabela "Provas criadas")
function opcoesDaProvaHTML(p) {
  const t = [];
  t.push(p.modoExibicao === "todas" ? `<span class="tag">▤ todas na página</span>` : `<span class="tag">▭ uma por vez</span>`);
  if (p.permitirTrocaAba) t.push(`<span class="tag aviso" title="Sem tela cheia e sem aviso; as trocas continuam contadas">🔀 troca de aba permitida</span>`);
  if (p.permitirColar) t.push(`<span class="tag aviso">📋 colar permitido</span>`);
  if (p.materialConsultaUrl) t.push(`<span class="tag nota" title="${esc(p.materialConsultaUrl)}">📖 ${esc(p.materialConsultaTitulo || "consulta")}</span>`);
  return t.join(" ");
}

async function carregarProvas() {
  await listarBancos();
  const bancoAntes = $("#pBanco").value;
  $("#pBanco").innerHTML = opcoesBancos();
  if (bancoAntes && bancosCache.some(b => b.id === bancoAntes)) $("#pBanco").value = bancoAntes;
  // só redesenha os temas se o banco mudou (mantém as marcações do professor e não "pula" a tela)
  if ($("#pBanco").value !== formNova.bancoDesenhado) formNova.carregarTemas();
  const s = await getDocs(collection(db, "provas"));
  const provas = []; s.forEach(d => provas.push({ id: d.id, ...d.data() }));
  provas.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  const box = $("#listaProvas");
  if (!provas.length) { box.innerHTML = `<div class="vazio"><div class="icone">📝</div><p>Nenhuma prova ainda. Crie a primeira no formulário acima.</p></div>`; return; }
  box.innerHTML = `<div class="tabela"><table><tr><th>Prova</th><th>Banco</th><th>Questões</th><th>Temas</th><th>Opções</th><th>Status</th><th>Resultados</th><th></th></tr>` + provas.map(p => {
    const b = bancosCache.find(x => x.id === p.bancoId);
    return `<tr><td><b>${esc(p.titulo)}</b><br><span class="pequeno">${esc(p.turma || "")}</span></td><td>${esc(b?.nome || p.bancoId)}<br><span class="pequeno">${esc(b?.materia || "")}</span></td><td>${p.nQuestoes}${p.nDissertativas ? `<br><span class="pequeno">${p.nDissertativas} dissert.</span>` : ""}${p.tempoMinutos > 0 ? `<br><span class="pequeno">⏱ ${p.tempoMinutos} min</span>` : ""}</td>
      <td class="pequeno">${temasDaProvaTexto(p, b)}</td>
      <td class="td-opcoes">${opcoesDaProvaHTML(p)}</td>
      <td><span class="tag ${p.liberada ? "on" : "off"}">${p.liberada ? "● liberada" : "○ fechada"}</span></td>
      <td><span class="tag ${p.resultadosLiberados ? "on" : "off"}">${p.resultadosLiberados ? "● liberados" : "○ ocultos"}</span></td>
      <td class="td-acoes">${podeEditar() ? `<button class="mini ${p.liberada ? "leve" : "ok"}" data-tg="liberada" data-id="${p.id}">${p.liberada ? "Encerrar" : "Liberar prova"}</button>
        <button class="leve mini" data-tg="resultadosLiberados" data-id="${p.id}">${p.resultadosLiberados ? "Ocultar resultados" : "Liberar resultados"}</button>
        <button class="leve mini" data-editar="${p.id}">✎ Editar</button><br>` : ""}
        <button class="leve mini" data-testar="${p.id}" title="Abre a prova em nova aba, como o aluno vê (não vale nota)">Testar como aluno</button>
        <button class="perigo mini" data-apagarteste="${p.id}" title="Apaga a sua tentativa de teste desta prova">Apagar meu teste</button>
        ${podeEditar() && ehAdmin() ? `<button class="perigo mini" data-del="${p.id}" title="Apagar prova" aria-label="Apagar prova">🗑 Apagar</button>` : ""}</td></tr>`;
  }).join("") + "</table></div>";
  box.querySelectorAll("[data-tg]").forEach(b => b.onclick = async () => {
    const p = provas.find(x => x.id === b.dataset.id);
    await updateDoc(doc(db, "provas", p.id), { [b.dataset.tg]: !p[b.dataset.tg] });
    toast("Prova atualizada", "ok"); carregarProvas();
  });
  box.querySelectorAll("[data-editar]").forEach(b => b.onclick = () => editarProva(provas.find(x => x.id === b.dataset.editar)));
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
// "todos" quando a prova não filtra ou marcou todos os temas do banco
function temasDaProvaTexto(p, b) {
  if (!Array.isArray(p.temas) || !p.temas.length) return "todos";
  if (Array.isArray(b?.temas) && b.temas.length && b.temas.every(t => p.temas.includes(t))) return "todos";
  return p.temas.map(esc).join("<br>");
}

$("#btnCriarProva").onclick = async () => {
  if (!podeEditar()) return toast("Seu papel não permite criar provas.", "erro");
  const r = await formNova.ler();
  if (r.erro) return toast(r.erro, "erro");
  await addDoc(collection(db, "provas"), { ...r.dados, liberada: false, resultadosLiberados: false, criadoEm: serverTimestamp(), criadoPor: eu.email });
  $("#pTitulo").value = ""; toast("Prova criada (ainda fechada). Libere quando for aplicar.", "ok"); carregarProvas();
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
  const ctl = controleProva("e");
  const salvou = await modal({
    titulo: "Editar prova", conteudo: formProvaHTML("e"), ok: "Salvar alterações", cancelar: "Cancelar", largo: true,
    aoAbrir: () => {
      $("#eBanco").innerHTML = opcoesBancos();
      ctl.ligar(); ctl.preencher(p);
      if (nTentativas) ctl.travar(`🔒 <b>${nTentativas} aluno(s) já começaram esta prova.</b> Banco, número de questões, dissertativas e temas não podem mudar: isso mudaria o sorteio de quem já começou e a correção. As outras opções podem ser alteradas.`);
      ctl.carregarTemas(Array.isArray(p.temas) ? p.temas : null);
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
  const ref = await addDoc(collection(db, "bancos"), { nome: b.nome, materia: b.materia || "", nQuestoes: b.questoes.length, temas, criadoEm: serverTimestamp(), criadoPor: eu.email });
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
async function carregarBancos() {
  await listarBancos();
  const box = $("#listaBancos");
  if (!bancosCache.length) { box.innerHTML = `<div class="vazio"><div class="icone">📚</div><p>Nenhum banco ainda. Importe o <b>modelo_banco.json</b> acima para começar.</p></div>`; return; }
  const contagens = await Promise.all(bancosCache.map(b => questoesDoBanco(b.id).then(contarPorTema).catch(() => null)));
  box.innerHTML = `<div class="tabela"><table><tr><th>Banco</th><th>Matéria</th><th>Questões</th><th>Temas</th><th></th></tr>` + bancosCache.map((b, i) =>
    `<tr><td><b>${esc(b.nome)}</b><br><span class="pequeno">${b.id}</span></td><td>${esc(b.materia || "")}</td><td>${b.nQuestoes}</td>
     <td>${contagens[i] ? `<ul class="temas-banco">${Object.entries(contagens[i]).map(([t, n]) => `<li><b>${esc(t)}</b>: ${textoContagem(n)}</li>`).join("")}</ul>` : "—"}</td>
     <td class="td-acoes"><button class="leve mini" data-gab="${b.id}">Gabarito p/ Classroom</button> ${ehAdmin() ? `<button class="perigo mini" data-delb="${b.id}" aria-label="Apagar banco">🗑 Apagar</button>` : ""}</td></tr>`).join("") + "</table></div>";
  box.querySelectorAll("[data-gab]").forEach(x => x.onclick = () => gerarGabarito(x.dataset.gab));
  box.querySelectorAll("[data-delb]").forEach(x => x.onclick = async () => {
    if (!(await confirmar("Apagar o banco e todas as suas questões?", { titulo: "Apagar banco", ok: "Apagar", perigo: true }))) return;
    const id = x.dataset.delb, lote = writeBatch(db);
    (await getDocs(collection(db, "bancos", id, "questoes"))).forEach(d => lote.delete(d.ref));
    (await getDocs(collection(db, "bancos", id, "gabaritos"))).forEach(d => lote.delete(d.ref));
    lote.delete(doc(db, "bancos", id)); await lote.commit(); delete questoesCache[id]; carregarBancos();
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
  const s = { abas: t.trocasDeAba || 0, telaCheia: t.saidasTelaCheia || 0, colar: t.tentativasColar || 0, abasPermitido: prova?.permitirTrocaAba === true };
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
    const sinais = sinaisDe(t, prova);
    linhas.push({ t, itens, max, pts, nota: max ? Math.round(pts / max * 1000) / 10 : 0, revisar: itens.filter(x => x.status === "revisar").length,
                  tempo: tempoTotal(t), sinais, temSinal: sinais.total > 0,
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
    fmtTempo(l.tempo), l.tempo ?? "", abasTexto(l.sinais), l.sinais.telaCheia, l.sinais.colar, l.rapidas, String(l.nota).replace(".", ","),
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
  h += `<div class="peq">Tempo total: ${fmtTempo(l.tempo)} · Trocas de aba: ${abasTexto(l.sinais)} · Saídas da tela cheia: ${l.sinais.telaCheia} · Tentativas de colar: ${l.sinais.colar}</div>`;
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
