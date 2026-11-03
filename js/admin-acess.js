// Painel → aba "♿ Acessibilidade": adaptações da prova por aluno.
// Professor/admin: marca o aluno, vincula a auxiliar de inclusão, ajusta o visual e as regras da prova, descreve
// as necessidades, sobe laudos e adapta as questões (manual ou pela IA). Auxiliar de inclusão: só os alunos
// vinculados a ela — edita as adaptações, sobe laudos e deixa sugestões.
import { db, esc, $, toast, confirmar, modal, traduzirErro, dataBR, iniciais, bancosDaProva, temasDoBanco, temaDe, letra } from "./common.js";
import { VISUAL_PADRAO, PROVA_PADRAO, FONTES, TEMAS, completar, aplicarVisual } from "./acessibilidade.js";
import { enviarMaterial, listarMateriais, apagarMaterial, baixarMaterial, abrirMaterialEmAba, tamanhoTexto, erroMaterial } from "./material.js";
import { adaptarQuestao } from "./ia.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, serverTimestamp, orderBy }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let ctx = null;          // { eu, podeEditar(), souDono(), iaCfg(), urlCorretor(), auth, alunosDasTurmas() }
let lista = [];          // [{ email, ...acessibilidade }]
let aberto = null;       // email em edição
export function iniciarAcessibilidade(c) { ctx = c; }
const ehInclusao = () => ctx.eu.papel === "inclusao";
const priv = e => `acessibilidadePrivado/${e}`;

// ---------- lista de alunos com acessibilidade ----------
export async function carregarAcessibilidade() {
  const box = $("#acessLista");
  box.innerHTML = "<p class='pequeno'>Carregando…</p>";
  $("#acessNovo").classList.toggle("oculto", !ctx.podeEditar());
  try {
    const q = ehInclusao() ? query(collection(db, "acessibilidade"), where("auxiliares", "array-contains", ctx.eu.email)) : collection(db, "acessibilidade");
    const s = await getDocs(q);
    lista = s.docs.map(d => ({ email: d.id, ...d.data() })).sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR"));
  } catch (e) { box.innerHTML = `<p class="erro-texto">Não foi possível ler a lista. ${esc(traduzirErro(e))} (Publique o firestore.rules atualizado.)</p>`; return; }
  if (!lista.length) {
    box.innerHTML = `<div class="vazio"><div class="icone">♿</div><p><b>${ehInclusao() ? "Nenhum aluno vinculado a você ainda." : "Nenhum aluno com acessibilidade."}</b></p>
      <p class="pequeno">${ehInclusao() ? "Peça ao professor para vincular você ao aluno." : "Use o formulário acima para marcar um aluno."}</p></div>`;
  } else box.innerHTML = `<div class="cartoes-alunos">` + lista.map(a => `
    <button type="button" class="cartao-aluno cartao-acess${a.ativo === false ? " inativo" : ""}${a.email === aberto ? " selecionado" : ""}" data-acess="${esc(a.email)}">
      <div class="ca-topo"><span class="avatar">${esc(iniciais(a.nome || a.email))}</span>
        <div class="ca-nome"><b>${esc(a.nome || a.email)}</b><span class="pequeno">${esc(a.email)}</span></div>
        <span class="tag ${a.ativo === false ? "off" : "ok"}">${a.ativo === false ? "○ desligada" : "♿ ativa"}</span></div>
      <div class="pequeno">${(a.auxiliares || []).length ? `🤝 ${a.auxiliares.map(esc).join(", ")}` : "sem auxiliar vinculada"}${a.uid ? "" : " · ainda não entrou no sistema"}</div>
    </button>`).join("") + `</div>`;
  box.querySelectorAll("[data-acess]").forEach(b => b.onclick = () => abrirAluno(b.dataset.acess));
  if (aberto && lista.some(a => a.email === aberto)) abrirAluno(aberto, false);
}

// marcar aluno: escolhe de uma turma ou digita o e-mail
// marcar aluno: 1º escolhe a turma, 2º o aluno daquela turma (ou digita o e-mail direto)
export async function prepararNovo() {
  const selT = $("#acessTurmaSel"), selA = $("#acessAlunoSel");
  const alunos = await ctx.alunosDasTurmas();   // [{ nome, email, turma }]
  const porTurma = new Map();
  alunos.forEach(a => { if (!porTurma.has(a.turma)) porTurma.set(a.turma, []); porTurma.get(a.turma).push(a); });
  const turmas = [...porTurma.keys()].sort((x, y) => String(x).localeCompare(String(y), "pt-BR", { numeric: true }));
  const antes = selT.value;
  selT.innerHTML = `<option value="">— escolha a turma —</option>` +
    turmas.map(t => `<option value="${esc(t)}">${esc(t)} (${porTurma.get(t).length} alunos)</option>`).join("");
  if (turmas.includes(antes)) selT.value = antes;
  const desenharAlunos = () => {
    const daTurma = (porTurma.get(selT.value) || []).slice().sort((x, y) => (x.nome || x.email).localeCompare(y.nome || y.email, "pt-BR"));
    selA.disabled = !selT.value;
    if (!selT.value) { selA.innerHTML = `<option value="">— escolha a turma primeiro —</option>`; return; }
    const ja = new Set(lista.map(a => a.email));
    selA.innerHTML = `<option value="">— escolha o aluno —</option>` + daTurma.map(a => !a.email
      ? `<option value="" disabled>${esc(a.nome)} — ainda não entrou no sistema (sem e-mail)</option>`
      : `<option value="${esc(a.email)}" data-nome="${esc(a.nome || "")}">${ja.has(a.email) ? "♿ " : ""}${esc(a.nome || a.email)}${a.nome ? ` · ${esc(a.email)}` : ""}${ja.has(a.email) ? " (já marcado)" : ""}</option>`).join("");
  };
  selT.onchange = () => { desenharAlunos(); $("#acessEmail").value = ""; $("#acessNome").value = ""; if (selT.value) selA.focus(); };
  selA.onchange = () => { const o = selA.selectedOptions[0]; $("#acessEmail").value = selA.value; $("#acessNome").value = o?.dataset.nome || ""; };
  desenharAlunos();
}
$("#btnAcessAdicionar").onclick = async () => {
  const email = $("#acessEmail").value.trim().toLowerCase(), nome = $("#acessNome").value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("Informe o e-mail do aluno.", "erro");
  if (lista.some(a => a.email === email)) { abrirAluno(email); return toast("Este aluno já tem acessibilidade: abri o cadastro.", "info"); }
  try {
    await setDoc(doc(db, "acessibilidade", email), { email, nome, ativo: true, auxiliares: [], visual: { ...VISUAL_PADRAO }, prova: { ...PROVA_PADRAO },
      criadoEm: serverTimestamp(), criadoPor: ctx.eu.email });
    await setDoc(doc(db, "acessibilidadePrivado", email), { descricao: "", criadoEm: serverTimestamp() });
    $("#acessEmail").value = ""; $("#acessNome").value = ""; $("#acessAlunoSel").value = ""; prepararNovo();
    aberto = email; toast("Aluno marcado com acessibilidade ♿", "ok"); carregarAcessibilidade();
  } catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); }
};

// ---------- cadastro de um aluno ----------
async function abrirAluno(email, rolar = true) {
  aberto = email;
  document.querySelectorAll("[data-acess]").forEach(b => b.classList.toggle("selecionado", b.dataset.acess === email));
  const box = $("#acessDetalhe");
  box.innerHTML = "<div class='card'><p class='pequeno'>Carregando…</p></div>";
  const [d, p, equipe, provas] = await Promise.all([
    getDoc(doc(db, "acessibilidade", email)), getDoc(doc(db, "acessibilidadePrivado", email)).catch(() => null),
    ctx.podeEditar() ? getDocs(collection(db, "equipe")).then(s => s.docs.map(x => ({ email: x.id, ...x.data() }))).catch(() => []) : [],
    getDocs(collection(db, "provas")).then(s => s.docs.map(x => ({ id: x.id, ...x.data() }))).catch(() => [])
  ]);
  if (!d.exists()) { box.innerHTML = ""; return; }
  const a = completar(d.data()), v = a.visual, pr = a.prova, descricao = p?.data()?.descricao || "";
  const inclusoes = equipe.filter(x => x.papel === "inclusao");
  const faixa = (id, rot, min, max, passo, val, un = "") => `<div class="faixa"><label for="${id}">${rot} <output id="${id}Val">${val}${un}</output></label><input type="range" id="${id}" min="${min}" max="${max}" step="${passo}" value="${val}" data-un="${un}"></div>`;
  provas.sort((x, y) => (y.criadoEm?.seconds || 0) - (x.criadoEm?.seconds || 0));
  box.innerHTML = `
  <div class="card acess-cab">
    <div class="linha"><h2 style="flex:3">♿ ${esc(a.nome || email)} <span class="pequeno">${esc(email)}</span></h2>
      ${ctx.podeEditar() ? `<button class="perigo mini" id="acRemover" style="flex:0 0 auto">Remover acessibilidade</button>` : ""}</div>
    <label class="check"><input type="checkbox" id="acAtivo" ${a.ativo !== false ? "checked" : ""}> <span><b>Acessibilidade ativa</b> <span class="pequeno">— as adaptações abaixo valem em todas as provas deste aluno</span></span></label>
    ${ctx.podeEditar() ? `<div style="margin-top:12px"><span class="rotulo">🤝 Auxiliar(es) de inclusão com acesso a este aluno</span>
      ${inclusoes.length ? `<div class="linha acoes">${inclusoes.map(x => `<label class="check" style="margin:0"><input type="checkbox" data-aux="${esc(x.email)}" ${(a.auxiliares || []).includes(x.email) ? "checked" : ""}> ${esc(x.nome || x.email)}</label>`).join("")}</div>`
        : `<p class="pequeno">Nenhuma auxiliar cadastrada. Cadastre em <b>Equipe</b> com o papel <b>auxiliar de inclusão</b>.</p>`}</div>` : ""}
  </div>
  <div class="acess-grade">
    <div class="card">
      <h2>Visual</h2>
      <div class="grade">
        ${faixa("acEscala", "Tamanho da letra", 80, 250, 10, v.escala, "%")}
        ${faixa("acLetras", "Espaço entre letras", 0, 0.4, 0.02, v.letras, "em")}
        ${faixa("acPalavras", "Espaço entre palavras", 0, 1, 0.05, v.palavras, "em")}
        ${faixa("acLinhas", "Altura da linha", 1.2, 3, 0.1, v.linhas, "")}
        <div><label for="acFonte">Fonte</label><select id="acFonte">${Object.entries(FONTES).map(([k, f]) => `<option value="${k}" ${v.fonte === k ? "selected" : ""}>${esc(f.nome)}</option>`).join("")}</select></div>
        <div><label for="acTema">Cores</label><select id="acTema">${Object.entries(TEMAS).map(([k, t]) => `<option value="${k}" ${v.tema === k ? "selected" : ""}>${esc(t.nome)}</option>`).join("")}</select></div>
      </div>
      <label class="check"><input type="checkbox" id="acMaiusculas" ${v.maiusculas ? "checked" : ""}> TEXTO EM CAIXA ALTA (enunciado e alternativas)</label>
      <label class="check"><input type="checkbox" id="acLinhaCurta" ${v.linhaCurta ? "checked" : ""}> Linhas curtas (texto numa coluna estreita)</label>
      <label class="check"><input type="checkbox" id="acRegua" ${v.regua ? "checked" : ""}> Régua de leitura (faixa que acompanha o mouse)</label>
      <label class="check"><input type="checkbox" id="acSemAnim" ${v.semAnimacao ? "checked" : ""}> Sem animações (confete, mascote parado)</label>
    </div>
    <div class="card">
      <h2>Pré-visualização</h2>
      <div id="acPrevia" class="previa-acess">
        <div class="card questao"><div class="enunciado">Escreva o comando que mostra <b>todos os clientes</b> da tabela <code>cliente</code> que moram em <b>Curitiba</b>.</div>
          <div class="apoio"><span aria-hidden="true">💡</span><div><b>Apoio:</b> primeiro ache a tabela; depois pense na condição (onde moram).</div></div>
          <label class="alt"><span class="alt-letra">A</span><span class="alt-texto">SELECT * FROM cliente WHERE cidade = 'Curitiba';</span></label>
          <label class="alt"><span class="alt-letra">B</span><span class="alt-texto">DELETE FROM cliente WHERE cidade = 'Curitiba';</span></label></div>
      </div>
      <h2 style="margin-top:16px">Na prova</h2>
      <div class="grade">
        <div><label for="acTempo">Tempo extra (min)</label><input type="number" id="acTempo" min="0" step="5" value="${pr.tempoExtraMin}"></div>
        <div><label for="acVidas">Vidas extras ❤️</label><input type="number" id="acVidas" min="0" max="10" step="1" value="${pr.vidasExtras}"></div>
      </div>
      <label class="check"><input type="checkbox" id="acSemPunicao" ${pr.semPunicao ? "checked" : ""}> <span>Sem perder vidas <span class="pequeno">— sair da tela/colar só fica registrado (bom para TEA)</span></span></label>
      <label class="check"><input type="checkbox" id="acOcultarTempo" ${pr.ocultarCronometro ? "checked" : ""}> <span>Esconder o cronômetro <span class="pequeno">— o tempo vale, mas não aparece (menos ansiedade)</span></span></label>
      <label class="check"><input type="checkbox" id="acVoz" ${pr.lerEmVoz !== false ? "checked" : ""}> Botão 🔊 Ouvir em cada questão (leitura em voz alta)</label>
      <label class="check"><input type="checkbox" id="acDica" ${pr.mostrarDica !== false ? "checked" : ""}> Mostrar o 💡 apoio das questões adaptadas</label>
    </div>
  </div>
  <div class="linha acoes barra-salvar"><button id="acSalvar" class="ok">Salvar adaptações</button>
    <span class="pequeno">Ver como o aluno vê:</span><select id="acProvaTeste" style="width:auto;flex:0 1 320px">${provas.map(x => `<option value="${x.id}">${esc(x.titulo)}</option>`).join("")}</select>
    <button id="acVerComo" class="leve">👁 Abrir a prova como o aluno</button></div>

  <div class="acess-grade">
    <div class="card">
      <h2>Sobre o aluno <span class="pequeno">(não aparece para o aluno)</span></h2>
      <label for="acDescricao">Descrição das necessidades e do que funciona (a IA usa isto para adaptar as questões)</label>
      <textarea id="acDescricao" style="font-family:inherit;min-height:140px" placeholder="Ex.: aluna com TEA nível 1 e TDAH. Entende melhor frases curtas e uma instrução por vez. Perde o foco com textos longos. Ajuda: negrito no que é pedido, exemplos concretos.">${esc(descricao)}</textarea>
      <div class="linha acoes" style="margin-top:8px"><button id="acSalvarDesc" class="leve">Salvar descrição</button></div>
      <h2 style="margin-top:16px">Laudos e documentos (PDF)</h2>
      <p class="pequeno">Ficam guardados só para a equipe que cuida deste aluno. A IA lê até 3 PDFs ao adaptar.</p>
      <div class="linha acoes"><label class="botao-arquivo">⬆ Enviar PDF(s)<input type="file" id="acLaudoArq" accept="application/pdf,.pdf" multiple hidden></label><span id="acLaudoMsg" class="pequeno" aria-live="polite"></span></div>
      <div id="acLaudos" class="lista-materiais" style="margin-top:8px"></div>
    </div>
    <div class="card">
      <h2>Sugestões da equipe</h2>
      <p class="pequeno">A auxiliar de inclusão e os professores registram aqui o que observaram e o que sugerem mudar.</p>
      <textarea id="acSugTexto" style="font-family:inherit;min-height:80px" placeholder="Ex.: na última prova ela travou nas questões com dois comandos juntos; sugiro dividir em duas partes."></textarea>
      <div class="linha acoes" style="margin-top:8px"><button id="acSugEnviar" class="leve">Enviar sugestão</button></div>
      <div id="acSugLista" class="sugestoes"></div>
    </div>
  </div>

  <div class="card">
    <h2>Questões adaptadas</h2>
    <p class="pequeno">Escolha a prova: aparecem as questões que podem ser sorteadas para ela. Adapte uma a uma ou todas com a IA e revise. A resposta certa continua a mesma: as alternativas ficam na mesma ordem e quantidade.</p>
    <div class="linha acoes"><select id="acProvaQ" style="width:auto;flex:1 1 280px">${provas.map(x => `<option value="${x.id}">${esc(x.titulo)}</option>`).join("")}</select>
      <button id="acCarregarQ" class="leve">Carregar questões</button></div>
    <label for="acOrientacao" style="margin-top:12px">Orientação extra para a IA (opcional)</label>
    <input type="text" id="acOrientacao" placeholder="Ex.: use exemplos com lojas e clientes; destaque em negrito a ação pedida">
    <div class="linha acoes" style="margin-top:8px"><button id="acAdaptarTodas" disabled>🤖 Adaptar todas com IA</button><label class="check" style="margin:0"><input type="checkbox" id="acRefazer"> refazer as já adaptadas</label><span id="acIAMsg" class="pequeno" aria-live="polite"></span></div>
    <div id="acQuestoes"></div>
  </div>`;
  if (rolar) box.scrollIntoView({ behavior: "smooth", block: "start" });

  // pré-visualização ao vivo
  const lerVisual = () => ({ escala: +$("#acEscala").value, letras: +$("#acLetras").value, palavras: +$("#acPalavras").value, linhas: +$("#acLinhas").value,
    fonte: $("#acFonte").value, tema: $("#acTema").value, maiusculas: $("#acMaiusculas").checked, linhaCurta: $("#acLinhaCurta").checked,
    regua: $("#acRegua").checked, semAnimacao: $("#acSemAnim").checked });
  const previa = () => { aplicarVisual($("#acPrevia"), lerVisual()); box.querySelectorAll("input[type=range]").forEach(r => { $("#" + r.id + "Val").textContent = r.value + (r.dataset.un || ""); }); };
  box.querySelectorAll("#acEscala, #acLetras, #acPalavras, #acLinhas, #acFonte, #acTema, #acMaiusculas, #acLinhaCurta, #acRegua, #acSemAnim").forEach(el => el.oninput = el.onchange = previa);
  previa();

  $("#acSalvar").onclick = async () => {
    const dados = { ativo: $("#acAtivo").checked, visual: lerVisual(),
      prova: { tempoExtraMin: Math.max(0, Math.round(+$("#acTempo").value || 0)), vidasExtras: Math.min(10, Math.max(0, Math.round(+$("#acVidas").value || 0))),
               semPunicao: $("#acSemPunicao").checked, ocultarCronometro: $("#acOcultarTempo").checked, lerEmVoz: $("#acVoz").checked, mostrarDica: $("#acDica").checked },
      atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email };
    if (ctx.podeEditar()) dados.auxiliares = [...box.querySelectorAll("[data-aux]:checked")].map(x => x.dataset.aux);
    try { await updateDoc(doc(db, "acessibilidade", email), dados); toast("Adaptações salvas ✅", "ok"); carregarAcessibilidade(); }
    catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); }
  };
  $("#acVerComo").onclick = () => { const pid = $("#acProvaTeste").value; if (pid) window.open(`index.html?teste=${encodeURIComponent(pid)}&como=${encodeURIComponent(email)}`, "_blank"); };
  $("#acRemover")?.addEventListener("click", async () => {
    if (!(await confirmar(`Remover a acessibilidade de ${a.nome || email}? As questões adaptadas também são apagadas. (Laudos e sugestões continuam guardados.)`, { titulo: "Remover acessibilidade", ok: "Remover", perigo: true }))) return;
    try {
      const qs = await getDocs(collection(db, "acessibilidade", email, "questoes"));
      await Promise.all(qs.docs.map(x => deleteDoc(x.ref)));
      await deleteDoc(doc(db, "acessibilidade", email));
      aberto = null; $("#acessDetalhe").innerHTML = ""; toast("Acessibilidade removida.", "ok"); carregarAcessibilidade();
    } catch (e) { toast("Não foi possível remover. " + traduzirErro(e), "erro"); }
  });
  $("#acSalvarDesc").onclick = async () => {
    try { await setDoc(doc(db, "acessibilidadePrivado", email), { descricao: $("#acDescricao").value.trim(), atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email }, { merge: true }); toast("Descrição salva.", "ok"); }
    catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); }
  };
  desenharLaudos(email);
  $("#acLaudoArq").onchange = async e => {
    const arqs = [...e.target.files]; e.target.value = "";
    for (const f of arqs) {
      try { await enviarMaterial(f, f.name.replace(/\.pdf$/i, ""), ctx.eu.email, (i, n) => { $("#acLaudoMsg").textContent = `Enviando ${f.name}… ${Math.round(i / Math.max(1, n) * 100)}%`; }, `${priv(email)}/laudos`); }
      catch (er) { toast(erroMaterial(er, traduzirErro), "erro"); }
    }
    $("#acLaudoMsg").textContent = ""; desenharLaudos(email);
  };
  desenharSugestoes(email);
  $("#acSugEnviar").onclick = async () => {
    const texto = $("#acSugTexto").value.trim(); if (!texto) return;
    try { await addDoc(collection(db, "acessibilidadePrivado", email, "sugestoes"), { texto, autor: ctx.eu.email, autorNome: ctx.eu.nome || "", papel: ctx.eu.papel, criadoEm: serverTimestamp(), resolvida: false });
      $("#acSugTexto").value = ""; toast("Sugestão registrada.", "ok"); desenharSugestoes(email); }
    catch (e) { toast("Não foi possível enviar. " + traduzirErro(e), "erro"); }
  };
  $("#acCarregarQ").onclick = () => carregarQuestoes(email, provas.find(x => x.id === $("#acProvaQ").value));
  $("#acAdaptarTodas").onclick = () => adaptarVarias(email);
}

async function desenharLaudos(email) {
  const box = $("#acLaudos"); if (!box) return;
  let ls = [];
  try { ls = await listarMateriais(`${priv(email)}/laudos`); } catch (e) { box.innerHTML = `<p class="pequeno erro-texto">${esc(traduzirErro(e))}</p>`; return; }
  box.innerHTML = ls.length ? ls.map(l => `<div class="item-material"><span>📄 ${esc(l.titulo)} <span class="pequeno">${tamanhoTexto(l.tamanho || 0)} · ${esc(l.criadoPor || "")}</span></span>
    <span><button class="leve mini" data-verl="${l.id}">Abrir</button> <button class="perigo mini" data-dell="${l.id}">🗑</button></span></div>`).join("") : `<p class="pequeno">Nenhum documento enviado.</p>`;
  box.querySelectorAll("[data-verl]").forEach(b => b.onclick = () => abrirMaterialEmAba(b.dataset.verl, traduzirErro, `${priv(email)}/laudos`).catch(e => toast(e.message, "erro")));
  box.querySelectorAll("[data-dell]").forEach(b => b.onclick = async () => {
    if (!(await confirmar("Apagar este documento?", { titulo: "Apagar documento", ok: "Apagar", perigo: true }))) return;
    try { await apagarMaterial(b.dataset.dell, `${priv(email)}/laudos`); desenharLaudos(email); } catch (e) { toast(traduzirErro(e), "erro"); }
  });
}
async function desenharSugestoes(email) {
  const box = $("#acSugLista"); if (!box) return;
  let ss = [];
  try { ss = (await getDocs(query(collection(db, "acessibilidadePrivado", email, "sugestoes"), orderBy("criadoEm", "desc")))).docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { box.innerHTML = `<p class="pequeno erro-texto">${esc(traduzirErro(e))}</p>`; return; }
  box.innerHTML = ss.length ? ss.map(s => `<div class="sugestao${s.resolvida ? " resolvida" : ""}"><div class="pequeno"><b>${esc(s.autorNome || s.autor)}</b>${s.papel === "inclusao" ? " · auxiliar de inclusão" : ""} · ${dataBR(s.criadoEm)}</div>
    <p>${esc(s.texto)}</p>${ctx.podeEditar() ? `<button class="leve mini" data-res="${s.id}">${s.resolvida ? "↺ Reabrir" : "✓ Resolvida"}</button>` : s.resolvida ? `<span class="tag ok">✓ resolvida</span>` : ""}</div>`).join("") : `<p class="pequeno">Nenhuma sugestão ainda.</p>`;
  box.querySelectorAll("[data-res]").forEach(b => b.onclick = async () => {
    const s = ss.find(x => x.id === b.dataset.res);
    try { await updateDoc(doc(db, "acessibilidadePrivado", email, "sugestoes", s.id), { resolvida: !s.resolvida }); desenharSugestoes(email); } catch (e) { toast(traduzirErro(e), "erro"); }
  });
}

// ---------- questões adaptadas ----------
let qAtual = null;   // { email, prova, itens: [{ qid, q, g, ad }] }
async function carregarQuestoes(email, prova) {
  const box = $("#acQuestoes");
  if (!prova) return;
  box.innerHTML = "<p class='pequeno'>Carregando questões…</p>";
  try {
    const bancos = bancosDaProva(prova), itens = [];
    for (const b of bancos) {
      const temas = temasDoBanco(prova, b);
      const [qs, gs] = await Promise.all([getDocs(collection(db, "bancos", b, "questoes")), getDocs(collection(db, "bancos", b, "gabaritos")).catch(() => ({ docs: [] }))]);
      const gab = Object.fromEntries(gs.docs.map(d => [d.id, d.data()]));
      qs.docs.forEach(d => { if (!temas || temas.has(temaDe(d.data()))) itens.push({ qid: d.id, q: d.data(), g: gab[d.id] || {} }); });
    }
    const ads = await Promise.all(itens.map(x => getDoc(doc(db, "acessibilidade", email, "questoes", x.qid)).catch(() => null)));
    ads.forEach((d, i) => { itens[i].ad = d?.exists() ? d.data() : null; });
    qAtual = { email, prova, itens };
    $("#acAdaptarTodas").disabled = !podeIA();
    $("#acIAMsg").textContent = podeIA() ? "" : "A IA precisa da chave (administrador principal) ou do servidor de correção configurado.";
    desenharQuestoes();
  } catch (e) { box.innerHTML = `<p class="erro-texto">${esc(traduzirErro(e))}</p>`; }
}
function desenharQuestoes() {
  const { itens } = qAtual, box = $("#acQuestoes");
  const feitas = itens.filter(x => x.ad).length;
  box.innerHTML = `<p class="pequeno"><b>${feitas}</b> de ${itens.length} questões adaptadas.</p>` + itens.map((x, i) => {
    const alt = x.q.tipo === "alternativa", ad = x.ad || {};
    return `<details class="q-adapt${x.ad ? " feita" : ""}" data-i="${i}"><summary><span class="tag ${x.ad ? "ok" : ""}">${x.ad ? (ad.origem === "ia" ? "🤖 IA" : "✍ manual") : "○ original"}</span>
        <span class="pequeno">${esc(temaDe(x.q))}</span> ${esc(String(x.q.enunciado || "").slice(0, 110))}${String(x.q.enunciado || "").length > 110 ? "…" : ""}</summary>
      <div class="q-adapt-corpo">
        <div class="q-orig"><span class="rotulo">Original</span><div class="enunciado pequeno">${esc(x.q.enunciado)}</div>
          ${alt ? `<ol type="A" class="pequeno">${x.q.alternativas.map((a, k) => `<li>${esc(a)}${k === x.g.correta ? " <b>✓</b>" : ""}</li>`).join("")}</ol>` : ""}</div>
        <div class="q-nova"><label>Enunciado adaptado</label><textarea data-campo="enunciado" style="font-family:inherit">${esc(ad.enunciado || "")}</textarea>
          ${alt ? x.q.alternativas.map((a, k) => `<label>Alternativa ${letra(k)}${k === x.g.correta ? " ✓" : ""}</label><input type="text" data-alt="${k}" value="${esc(ad.alternativas?.[k] ?? "")}" placeholder="${esc(a)}">`).join("") : ""}
          <label>💡 Apoio (não pode entregar a resposta)</label><input type="text" data-campo="dica" value="${esc(ad.dica || "")}">
          <div class="linha acoes" style="margin-top:8px"><button class="ok mini" data-salvarq>Salvar</button>${podeIA() ? `<button class="mini" data-iaq>🤖 Adaptar com IA</button>` : ""}${x.ad ? `<button class="perigo mini" data-apagarq>Voltar ao original</button>` : ""}<span class="pequeno" data-msg></span></div></div>
      </div></details>`;
  }).join("");
  box.querySelectorAll(".q-adapt").forEach(el => {
    const x = qAtual.itens[+el.dataset.i];
    el.querySelector("[data-salvarq]").onclick = () => salvarQuestao(x, el);
    el.querySelector("[data-iaq]")?.addEventListener("click", () => adaptarUma(x, el));
    el.querySelector("[data-apagarq]")?.addEventListener("click", async () => {
      try { await deleteDoc(doc(db, "acessibilidade", qAtual.email, "questoes", x.qid)); x.ad = null; desenharQuestoes(); } catch (e) { toast(traduzirErro(e), "erro"); }
    });
  });
}
async function salvarQuestao(x, el) {
  const enunciado = el.querySelector("[data-campo=enunciado]").value.trim();
  if (!enunciado) return toast("Escreva o enunciado adaptado (ou use Voltar ao original).", "erro");
  const alts = x.q.tipo === "alternativa" ? [...el.querySelectorAll("[data-alt]")].map((inp, k) => inp.value.trim() || x.q.alternativas[k]) : null;
  const dados = { enunciado, alternativas: alts, dica: el.querySelector("[data-campo=dica]").value.trim(), origem: "manual", provaId: qAtual.prova.id,
                  adaptadoPor: ctx.eu.email, atualizadoEm: serverTimestamp() };
  try { await setDoc(doc(db, "acessibilidade", qAtual.email, "questoes", x.qid), dados); x.ad = dados; toast("Questão adaptada salva ✅", "ok"); desenharQuestoes(); }
  catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); }
}

// IA: no navegador do administrador principal (chave em config/ia) ou pelo servidor (Cloudflare Worker, acao "adaptar")
const podeIA = () => !!(ctx.iaCfg() || ctx.urlCorretor());
let laudosCache = null;
async function laudosDoAluno(email) {
  if (laudosCache?.email === email) return laudosCache.lista;
  const ls = (await listarMateriais(`${priv(email)}/laudos`).catch(() => [])).slice(0, 3);
  const lista = [];
  for (const l of ls) { try { lista.push({ titulo: l.titulo, bytes: (await baixarMaterial(l.id, `${priv(email)}/laudos`)).bytes }); } catch (e) { console.warn("laudo", e); } }
  laudosCache = { email, lista };
  return lista;
}
async function adaptarComIA(itens) {
  const email = qAtual.email, orientacao = $("#acOrientacao").value.trim(), cfg = ctx.iaCfg();
  const res = { adaptadas: 0, erros: [] };
  if (cfg) {   // navegador
    const descricao = (await getDoc(doc(db, "acessibilidadePrivado", email)).catch(() => null))?.data()?.descricao || "";
    const laudos = await laudosDoAluno(email);
    for (const [n, x] of itens.entries()) {
      $("#acIAMsg").textContent = `🤖 Adaptando ${n + 1} de ${itens.length}…`;
      try {
        const r = await adaptarQuestao({ chave: cfg.chave, modelo: cfg.modelo.includes("haiku") ? "claude-sonnet-5-5" : cfg.modelo, q: x.q, g: x.g, descricao, orientacao, laudos });
        const dados = { ...r, origem: "ia", modelo: cfg.modelo, provaId: qAtual.prova.id, adaptadoPor: ctx.eu.email, atualizadoEm: serverTimestamp() };
        await setDoc(doc(db, "acessibilidade", email, "questoes", x.qid), dados); x.ad = dados; res.adaptadas++;
      } catch (e) { res.erros.push({ qid: x.qid, erro: e.message }); if (e.fatal) break; }
    }
    return res;
  }
  // servidor: lotes de até 15
  const token = await ctx.auth.currentUser.getIdToken();
  for (let i = 0; i < itens.length; i += 15) {
    const lote = itens.slice(i, i + 15);
    $("#acIAMsg").textContent = `🤖 Adaptando ${i + 1}–${i + lote.length} de ${itens.length} (servidor)…`;
    const r = await fetch(ctx.urlCorretor(), { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: JSON.stringify({ acao: "adaptar", email, provaId: qAtual.prova.id, qids: lote.map(x => x.qid), orientacao, refazer: $("#acRefazer").checked }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { res.erros.push({ erro: d.erro || `erro ${r.status}` }); break; }
    res.adaptadas += d.adaptadas || 0; res.erros.push(...(d.erros || []));
  }
  const ads = await Promise.all(itens.map(x => getDoc(doc(db, "acessibilidade", email, "questoes", x.qid)).catch(() => null)));
  ads.forEach((d, k) => { itens[k].ad = d?.exists() ? d.data() : itens[k].ad; });
  return res;
}
async function adaptarUma(x, el) {
  const msg = el.querySelector("[data-msg]"); msg.textContent = "🤖 Adaptando…";
  try {
    if (x.ad?.origem === "manual" && !(await confirmar("Esta questão foi adaptada à mão. Substituir pela versão da IA?", { titulo: "Adaptar com IA", ok: "Substituir" }))) { msg.textContent = ""; return; }
    const ref = $("#acRefazer").checked; $("#acRefazer").checked = true;
    const r = await adaptarComIA([x]); $("#acRefazer").checked = ref;
    if (r.erros.length) toast("IA: " + r.erros[0].erro, "erro"); else toast("Questão adaptada pela IA — revise antes da prova.", "ok");
  } catch (e) { toast(traduzirErro(e), "erro"); }
  $("#acIAMsg").textContent = ""; desenharQuestoes();
}
async function adaptarVarias() {
  const refazer = $("#acRefazer").checked;
  const alvo = qAtual.itens.filter(x => refazer ? x.ad?.origem !== "manual" : !x.ad);
  if (!alvo.length) return toast(refazer ? "Nada a refazer (as adaptadas à mão não são substituídas)." : "Todas já estão adaptadas. Marque “refazer” para gerar de novo.", "info");
  if (!(await confirmar(`Adaptar ${alvo.length} questão(ões) com a IA? Leva alguns segundos por questão. Adaptações feitas à mão não são substituídas.`, { titulo: "🤖 Adaptar com IA", ok: "Adaptar" }))) return;
  $("#acAdaptarTodas").disabled = true;
  try {
    const r = await adaptarComIA(alvo);
    toast(`🤖 ${r.adaptadas} adaptada(s)${r.erros.length ? ` · ${r.erros.length} com erro: ${r.erros[0].erro}` : ""}. Revise antes da prova.`, r.erros.length ? "erro" : "ok");
  } catch (e) { toast(traduzirErro(e), "erro"); }
  $("#acAdaptarTodas").disabled = false; $("#acIAMsg").textContent = "";
  desenharQuestoes();
}
