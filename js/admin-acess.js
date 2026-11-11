// Painel → aba "♿ Acessibilidade": adaptações da prova por aluno.
// Professor/admin: marca o aluno, vincula a auxiliar de inclusão, ajusta o visual e as regras da prova, descreve
// as necessidades, sobe laudos e adapta as questões (manual ou pela IA). Auxiliar de inclusão: só os alunos
// vinculados a ela — edita as adaptações, sobe laudos e deixa sugestões.
import { db, esc, $, toast, confirmar, modal, traduzirErro, dataBR, iniciais, temaDe, letra, sortearQuestoes, bancoDaQuestao, questoesDisponiveis, cotaDaProva } from "./common.js";
import { drawer, chips, vazio } from "./ui.js";
import { ic } from "./icones.js";
import { VISUAL_PADRAO, PROVA_PADRAO, FONTES, TEMAS, completar, aplicarVisual, apoiosDe } from "./acessibilidade.js";
import { enviarMaterial, listarMateriais, apagarMaterial, baixarMaterial, abrirMaterialEmAba, tamanhoTexto, erroMaterial } from "./material.js";
import { adaptarQuestao } from "./ia.js";
import { abrirOpcoes, editarFormato, previaAplicada, gerarOpcoes, lerOpcoes, aplicarOpcao } from "./admin-formatos.js?v=20261111a";
import { perfilIA } from "./ia.js";
import { tarefa } from "./ui.js";
import { contextoDiario } from "../servidor/formatos.js";
import { FORMATOS, temFormato, textoChave } from "./formatos-ui.js";
// como a questão aparece impressa para o aluno (sem resposta)
function textoVazio(q) {
  const d = q.dados || {}, L = "ABCDEFGH";
  if (q.formato === "menosAlt") return d.alternativas.map((a, i) => `( ) ${L[i]}) ${a}`).join("\n");
  if (q.formato === "vf") return d.afirmacoes.map(a => `(  ) ${a}`).join("\n");
  if (q.formato === "ligar") return d.esquerda.map((e, i) => `${i + 1}. ${e}${" ".repeat(4)}(   ) ${L[i]}. ${d.direita[i] || ""}`).join("\n") + d.direita.slice(d.esquerda.length).map((x, k) => `\n(   ) ${L[d.esquerda.length + k]}. ${x}`).join("");
  if (q.formato === "lacunas") return `Palavras: ${d.banco.join(" · ")}\n\n${String(d.texto).replace(/\[\[\d+\]\]/g, "__________")}`;
  if (q.formato === "ordenar") return d.passos.map(p => `(   ) ${p}`).join("\n");
  if (q.formato === "etapas") return d.etapas.map((e, i) => `Etapa ${i + 1}: ${e.pergunta}\n${e.alternativas.map((a, k) => `   ( ) ${L[k]}) ${a}`).join("\n")}`).join("\n");
  return "";
}
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, serverTimestamp, orderBy, FieldPath }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let ctx = null;          // { eu, podeEditar(), souDono(), iaCfg(), urlCorretor(), auth, alunosDasTurmas() }
let lista = [];          // [{ email, ...acessibilidade }]
let aberto = null;       // email em edição
// abrir um aluno direto (ex.: vindo da aba Provas adaptadas): a próxima carga da lista abre o cadastro dele
export function abrirDepois(email) { aberto = email; }
export function iniciarAcessibilidade(c) {
  ctx = c;
  $("#acFiltroBusca").oninput = $("#acFiltroTurma").onchange = $("#acFiltroSit").onchange = () => desenharLista();
}
const ehInclusao = () => ctx.eu.papel === "inclusao";
const priv = e => `acessibilidadePrivado/${e}`;

// ---------- lista de alunos com acessibilidade ----------
export async function carregarAcessibilidade() {
  const box = $("#acessLista");
  box.innerHTML = "<p class='pequeno'>Carregando…</p>";
  $("#btnAcessNovo").classList.toggle("oculto", !ctx.podeEditar());
  try {
    const q = ehInclusao() ? query(collection(db, "acessibilidade"), where("auxiliares", "array-contains", ctx.eu.email)) : collection(db, "acessibilidade");
    const s = await getDocs(q);
    lista = s.docs.map(d => ({ email: d.id, ...d.data() })).sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR"));
  } catch (e) { box.innerHTML = `<p class="erro-texto">Não foi possível ler a lista. ${esc(traduzirErro(e))} (Publique o firestore.rules atualizado.)</p>`; return; }
  // turma(s) de cada aluno, para o filtro
  const al = await ctx.alunosDasTurmas().catch(() => []);
  turmasDe = new Map(); al.forEach(x => { if (x.email) (turmasDe.get(x.email) || turmasDe.set(x.email, []).get(x.email)).push({ id: x.turmaId, nome: x.turma }); });
  const selT = $("#acFiltroTurma"), tAntes = selT.value, ts = new Map(); lista.forEach(a => (turmasDe.get(a.email) || []).forEach(t => ts.set(t.id, t.nome)));
  selT.innerHTML = `<option value="">👥 Todas as turmas</option>` + [...ts].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "pt-BR", { numeric: true })).map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("");
  selT.value = ts.has(tAntes) ? tAntes : "";
  $("#acFiltros").classList.toggle("oculto", lista.length < 2);
  desenharLista();
  if (aberto && lista.some(a => a.email === aberto)) abrirAluno(aberto, false);
}
let turmasDe = new Map();
function desenharLista() {
  const box = $("#acessLista");
  const b = String($("#acFiltroBusca").value || "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().trim(), fT = $("#acFiltroTurma").value, fA = $("#acFiltroSit").value;
  const vis = lista.filter(a => (!b || `${a.nome || ""} ${a.email} ${(a.auxiliares || []).join(" ")}`.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().includes(b))
    && (!fT || (turmasDe.get(a.email) || []).some(t => t.id === fT)) && (!fA || (fA === "ativa" ? a.ativo !== false : a.ativo === false)));
  $("#acFiltroContagem").textContent = lista.length > 1 ? `${vis.length} de ${lista.length} aluno(s)` : "";
  if (lista.length && !vis.length) { box.innerHTML = vazio({ e: "🔎", texto: "Nenhum aluno com esses filtros." }); return; }
  if (!lista.length) box.innerHTML = vazio({ e: "♿", texto: ehInclusao() ? "<b>Nenhum aluno vinculado a você ainda.</b> Peça ao professor para vincular você ao aluno." : "<b>Nenhum aluno com acessibilidade.</b> Use <b>Marcar acessibilidade</b>, no alto da tela." });
  else box.innerHTML = `<div class="diario-alunos">` + vis.map(a => `
    <button type="button" class="diario-aluno${a.ativo === false ? " inativo" : ""}${a.email === aberto ? " ativo" : ""}" data-acess="${esc(a.email)}">
      <span class="avatar">${esc(iniciais(a.nome || a.email))}</span><span class="da-info"><b>${esc(a.nome || a.email)}</b><span class="da-sub">${esc((turmasDe.get(a.email) || []).map(t => t.nome).join(", ") || a.email)}${a.uid ? "" : " · ainda não entrou"}</span></span>
      <span class="chip ${a.ativo === false ? "off" : "ok"}">${a.ativo === false ? "desligada" : "ativa"}</span></button>`).join("") + `</div>`;
  box.querySelectorAll("[data-acess]").forEach(b => b.onclick = () => abrirAluno(b.dataset.acess));
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
// formulário "Marcar acessibilidade" num drawer (o bloco #acessNovo, com os mesmos ids)
let drawerNovo = null;
$("#btnAcessNovo").onclick = () => {
  if (!ctx.podeEditar()) return;
  drawerNovo = drawer({ titulo: "♿ Marcar acessibilidade", corpo: $("#acessNovo"), aoFechar: () => { $("#acessNovo").classList.add("oculto"); drawerNovo = null; },
    acoes: [{ t: "Cancelar", classe: "leve" }, { t: "♿ Marcar acessibilidade", onClick: () => { $("#btnAcessAdicionar").click(); return false; } }] });
};
$("#btnAcessAdicionar").onclick = async () => {
  const email = $("#acessEmail").value.trim().toLowerCase(), nome = $("#acessNome").value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("Informe o e-mail do aluno.", "erro");
  if (lista.some(a => a.email === email)) { drawerNovo?.fechar(); abrirAluno(email); return toast("Este aluno já tem acessibilidade: abri o cadastro.", "info"); }
  if (!(await confirmar(`Marcar acessibilidade para ${nome || email}? O aluno passa a fazer as provas com as adaptações que você configurar.`, { titulo: "Marcar acessibilidade", ok: "Marcar" }))) return;
  try {
    await setDoc(doc(db, "acessibilidade", email), { email, nome, ativo: true, auxiliares: [], visual: { ...VISUAL_PADRAO }, prova: { ...PROVA_PADRAO },
      criadoEm: serverTimestamp(), criadoPor: ctx.eu.email });
    await setDoc(doc(db, "acessibilidadePrivado", email), { descricao: "", criadoEm: serverTimestamp() });
    $("#acessEmail").value = ""; $("#acessNome").value = ""; $("#acessAlunoSel").value = ""; prepararNovo();
    aberto = email; toast("Aluno marcado com acessibilidade ♿", "ok"); drawerNovo?.fechar(); carregarAcessibilidade();
  } catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); }
};

// ---------- cadastro de um aluno ----------
async function abrirAluno(email, rolar = true) {
  aberto = email;
  document.querySelectorAll("[data-acess]").forEach(b => b.classList.toggle("ativo", b.dataset.acess === email));
  const box = $("#acessDetalhe");
  box.innerHTML = "<div class='card'><p class='pequeno'>Carregando…</p></div>";
  const [d, p, equipe, todasProvas, alunosT] = await Promise.all([
    getDoc(doc(db, "acessibilidade", email)), getDoc(doc(db, "acessibilidadePrivado", email)).catch(() => null),
    ctx.podeEditar() ? getDocs(collection(db, "equipe")).then(s => s.docs.map(x => ({ email: x.id, ...x.data() }))).catch(() => []) : [],
    getDocs(collection(db, "provas")).then(s => s.docs.map(x => ({ id: x.id, ...x.data() }))).catch(() => []),
    ctx.alunosDasTurmas().catch(() => [])
  ]);
  // só as provas da(s) turma(s) deste aluno: prova de outra turma não aparece aqui (nem para o aluno)
  const turmasDele = alunosT.filter(x => x.email === email);
  const provas = todasProvas.filter(x => x.turmaId && turmasDele.some(t => t.turmaId === x.turmaId));
  if (!d.exists()) { box.innerHTML = ""; return; }
  const a = completar(d.data()), v = a.visual, pr = a.prova, descricao = p?.data()?.descricao || "";
  const inclusoes = equipe.filter(x => x.papel === "inclusao");
  const faixa = (id, rot, min, max, passo, val, un = "") => `<div class="faixa"><label for="${id}">${rot} <output id="${id}Val">${val}${un}</output></label><input type="range" id="${id}" min="${min}" max="${max}" step="${passo}" value="${val}" data-un="${un}"></div>`;
  provas.sort((x, y) => (y.criadoEm?.seconds || 0) - (x.criadoEm?.seconds || 0));
  box.innerHTML = `
  <div class="card acess-cab">
    <span class="avatar ac-avatar">${esc(iniciais(a.nome || email))}</span>
    <div class="ac-id"><h2>${esc(a.nome || email)}</h2><span>${[...turmasDele.map(t => esc(t.turma)), esc(email)].join(" · ")}</span></div>
    <span class="chip" id="acChipAtivo"></span>
    <div class="ac-aux"><span class="meta-txt">Auxiliar:</span><span id="acChipsAux"></span><button type="button" class="leve mini" id="acEditarCab" aria-haspopup="dialog">${ic("edit", { size: 16 })}Editar</button></div>
    <!-- situação e auxiliares: abrem num drawer -->
    <div id="acCabForm" class="oculto">
      <label class="check"><input type="checkbox" id="acAtivo" ${a.ativo !== false ? "checked" : ""}> <span><b>Acessibilidade ativa</b> <span class="pequeno">— as adaptações valem em todas as provas deste aluno</span></span></label>
      ${ctx.podeEditar() ? `<div style="margin-top:16px"><span class="rotulo">Auxiliares de inclusão com acesso a este aluno</span>
        ${inclusoes.length ? `<div class="ac-aux-lista">${inclusoes.map(x => `<label class="check" style="margin:0"><input type="checkbox" data-aux="${esc(x.email)}" data-nome="${esc(x.nome || x.email)}" ${(a.auxiliares || []).includes(x.email) ? "checked" : ""}> ${esc(x.nome || x.email)}</label>`).join("")}</div>`
          : `<p class="help">Nenhuma auxiliar cadastrada. Cadastre em <b>Equipe</b> com o papel <b>auxiliar de inclusão</b>.</p>`}</div>` : ""}
      <p class="help" style="margin-top:16px">Estas mudanças são gravadas ao clicar em <b>Salvar adaptações</b>.</p>
      ${ctx.podeEditar() ? `<hr class="div"><button class="discreto vermelho mini" id="acRemover">${ic("trash", { size: 16 })}Remover acessibilidade</button>` : ""}
    </div>
  </div>
  <div class="ac-grade">
    <div class="card ac-adapt">
      <div id="acAbas"></div>
      <div data-painel="visual">
        <div class="ac-faixas">
        ${faixa("acEscala", "Tamanho da letra", 80, 250, 10, v.escala, "%")}
        ${faixa("acLetras", "Espaço entre letras", 0, 0.4, 0.02, v.letras, "em")}
        ${faixa("acPalavras", "Espaço entre palavras", 0, 1, 0.05, v.palavras, "em")}
        ${faixa("acLinhas", "Altura da linha", 1.2, 3, 0.1, v.linhas, "")}
        <div><label for="acFonte">Fonte</label><select id="acFonte">${Object.entries(FONTES).map(([k, f]) => `<option value="${k}" ${v.fonte === k ? "selected" : ""}>${esc(f.nome)}</option>`).join("")}</select></div>
        <div><label for="acTema">Cores</label><select id="acTema">${Object.entries(TEMAS).map(([k, t]) => `<option value="${k}" ${v.tema === k ? "selected" : ""}>${esc(t.nome)}</option>`).join("")}</select></div>
        </div>
        <label class="check"><input type="checkbox" id="acMaiusculas" ${v.maiusculas ? "checked" : ""}> Texto em CAIXA ALTA (enunciado e alternativas)</label>
        <label class="check"><input type="checkbox" id="acLinhaCurta" ${v.linhaCurta ? "checked" : ""}> Linhas curtas (coluna estreita)</label>
        <label class="check"><input type="checkbox" id="acRegua" ${v.regua ? "checked" : ""}> Régua de leitura (acompanha o mouse)</label>
        <label class="check"><input type="checkbox" id="acSemAnim" ${v.semAnimacao ? "checked" : ""}> Sem animações (confete, mascote parado)</label>
      </div>
      <div data-painel="tempo" hidden>
        <p class="help" style="max-width:none">⏱❤️ <b>Aluno com acessibilidade faz a prova SEM limite de tempo e SEM vidas</b>, sempre (automático). Sair da tela ou tentar colar fica só registrado. Os campos abaixo não são usados enquanto a acessibilidade estiver ativa.</p>
        <div class="ac-faixas" style="opacity:.55">
          <div><label for="acTempo">Tempo extra (min)</label><input type="number" id="acTempo" min="0" step="5" value="${pr.tempoExtraMin}"></div>
          <div><label for="acVidas">Vidas extras</label><input type="number" id="acVidas" min="0" max="10" step="1" value="${pr.vidasExtras}"></div>
        </div>
        <label class="check"><input type="checkbox" id="acSemPunicao" ${pr.semPunicao ? "checked" : ""}> <span>Sem perder vidas <span class="pequeno">— sair da tela ou colar só fica registrado (bom para TEA)</span></span></label>
        <label class="check"><input type="checkbox" id="acOcultarTempo" ${pr.ocultarCronometro ? "checked" : ""}> <span>Esconder o cronômetro <span class="pequeno">— o tempo vale, mas não aparece (menos ansiedade)</span></span></label>
      </div>
      <div data-painel="voz" hidden>
        <label class="check"><input type="checkbox" id="acVoz" ${pr.lerEmVoz !== false ? "checked" : ""}> Botão Ouvir em cada questão (leitura em voz alta)</label>
      </div>
      <div data-painel="reescritas" hidden>
        <p class="help" style="max-width:none">As questões reescritas (sorteio, adaptação com IA e revisão) ficam em <b>Prova adaptada</b>, mais abaixo nesta tela.</p>
        <button type="button" class="leve mini" id="acIrProva">${ic("adapt", { size: 16 })}Ir para a prova adaptada</button>
      </div>
      <div data-painel="apoios" hidden>
        <label class="check"><input type="checkbox" id="acDica" ${pr.mostrarDica !== false ? "checked" : ""}> Mostrar o apoio (💡) das questões adaptadas</label>
      </div>
      <hr class="div">
      <div class="ac-rodape"><button id="acSalvar" class="ok">Salvar adaptações</button><button id="acVerComo" class="leve">${ic("eye", { size: 16 })}Abrir a prova como o aluno</button></div>
    </div>
    <div class="card ac-previa">
      <div class="ac-previa-cab"><h2>Pré-visualização</h2><label class="ac-comovê"><span>como o aluno vê ·</span><select id="acProvaTeste" aria-label="Prova">${provas.map(x => `<option value="${x.id}">${esc(x.titulo)}</option>`).join("") || `<option value="">sem provas nesta turma</option>`}</select></label></div>
      <div id="acPrevia" class="previa-acess">
        <div class="previa-chips"><span class="chip navy">Questão 3 de 10</span><span class="chip off">DDL</span></div>
        <div class="questao"><div class="enunciado">Escreva o comando que mostra <b>todos os clientes</b> da tabela <code>cliente</code> que moram em <b>Curitiba</b>.</div>
          <div class="apoio"><span aria-hidden="true">💡</span><div><b>Apoio:</b> primeiro ache a tabela; depois pense na condição (onde moram).</div></div>
          <label class="alt"><span class="alt-letra">A</span><span class="alt-texto">SELECT * FROM cliente WHERE cidade = 'Curitiba';</span></label>
          <label class="alt"><span class="alt-letra">B</span><span class="alt-texto">DELETE FROM cliente WHERE cidade = 'Curitiba';</span></label></div>
      </div>
      <p class="help" style="max-width:none;margin-top:12px">A prévia usa a fonte escolhida de verdade; se ela não carregar, cai em Inter.</p>
    </div>
  </div>

  <div class="acess-grade">
    <div class="card">
      <h2>Sobre o aluno <span class="pequeno">(não aparece para o aluno)</span></h2>
      <label for="acDescricao">Descrição das necessidades e do que funciona (a IA usa isto para adaptar as questões)</label>
      <textarea id="acDescricao" style="font-family:inherit;min-height:140px" placeholder="Ex.: aluna com TEA nível 1 e TDAH. Entende melhor frases curtas e uma instrução por vez. Perde o foco com textos longos. Ajuda: negrito no que é pedido, exemplos concretos.">${esc(descricao)}</textarea>
      <div class="linha acoes" style="margin-top:8px"><button id="acSalvarDesc" class="leve">Salvar descrição</button></div>
      <h2 style="margin-top:16px">🧠 Perfil para a IA <span class="pequeno">— aprende com o diário, os comentários dos professores e as adaptações</span></h2>
      <p class="pequeno" id="acPerfilInfo">${p?.data()?.perfilIA?.atualizadoEm ? `Atualizado em ${dataBR(p.data().perfilIA.atualizadoEm)} por ${esc(p.data().perfilIA.por || "")}.` : "Ainda não montado. Clique em 🤖 para a IA montar a partir do que já existe; depois revise."}</p>
      <textarea id="acPerfil" style="font-family:inherit;min-height:180px" placeholder="Resumo, pontos fortes, dificuldades, o que funciona, o que evitar e recomendações para as provas.">${esc(p?.data()?.perfilIA?.texto || "")}</textarea>
      <div class="linha acoes" style="margin-top:8px"><button id="acPerfilIA" type="button">🤖 Atualizar com o diário e as provas</button><button id="acPerfilSalvar" type="button" class="leve">Salvar perfil</button></div>
      <p class="pequeno">A IA usa este perfil (junto com a descrição) ao sugerir formatos e adaptar as questões. Revise: é você quem decide o que fica.</p>
      <h2 style="margin-top:16px">Laudos e documentos (PDF) <button data-ajuda-item="laudo"></button></h2>
      <p class="pequeno">Ficam guardados só para a equipe que cuida deste aluno. A IA lê até 3 PDFs ao adaptar.</p>
      <div class="linha acoes"><label class="botao-arquivo leve">${ic("upload", { size: 16 })}Enviar PDF(s)<input type="file" id="acLaudoArq" accept="application/pdf,.pdf" multiple hidden></label><span id="acLaudoMsg" class="pequeno" aria-live="polite"></span></div>
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
    <h2>Prova adaptada</h2>
    <p class="pequeno"><b>1.</b> Escolha a prova. <b>2.</b> 🎲 Escolha quantas alternativas e dissertativas e sorteie as questões deste aluno.
      <b>3.</b> 🤖 Adapte com a IA: ela adapta <b>só as questões sorteadas</b>. Na hora da prova o aluno recebe exatamente essas questões.
      Se a descrição ou os laudos mudarem, as adaptações antigas ficam marcadas como <b>⚠ desatualizadas</b> e dá para refazer.
      A resposta certa não muda: as alternativas ficam na mesma ordem e quantidade.</p>
    <p class="pequeno">👥 Turma: <b>${turmasDele.length ? turmasDele.map(t => esc(t.turma)).join(", ") : "nenhuma"}</b> — aparecem só as provas ${turmasDele.length > 1 ? "dessas turmas" : "desta turma"}.</p>
    <div class="linha acoes"><select id="acProvaQ" aria-label="Prova" style="width:auto;flex:1 1 280px">${provas.map(x => `<option value="${x.id}">${esc(x.titulo)}${turmasDele.length > 1 ? ` · ${esc(x.turma || "")}` : ""}</option>`).join("")}</select></div>
    <div id="acSorteioBox" style="margin-top:10px"></div>
    <label for="acOrientacao" style="margin-top:12px">Orientação extra para a IA (opcional)</label>
    <input type="text" id="acOrientacao" placeholder="Ex.: use exemplos com lojas e clientes; destaque em negrito a ação pedida">
    <div id="acResumo" style="margin-top:12px"></div>
    <p id="acIAMsg" class="pequeno" aria-live="polite"></p>
    <div id="acQuestoes"></div>
  </div>`;
  if (rolar) box.scrollIntoView({ behavior: "smooth", block: "start" });

  // cabeçalho: situação e auxiliares (editados no drawer; gravados com Salvar adaptações)
  const pintarCab = () => {
    const on = $("#acAtivo").checked, marcadas = [...$("#acCabForm").querySelectorAll("[data-aux]:checked")];
    const nomes = ctx.podeEditar() ? marcadas.map(x => x.dataset.nome) : (a.auxiliares || []);
    $("#acChipAtivo").className = "chip " + (on ? "ok" : "off"); $("#acChipAtivo").innerHTML = on ? `<span class="e" aria-hidden="true">♿</span>acessibilidade ativa` : "acessibilidade desligada";
    $("#acChipsAux").innerHTML = nomes.length ? nomes.map(n => `<span class="chip navy">${esc(n)}</span>`).join(" ") : `<span class="meta-txt">nenhuma</span>`;
  };
  pintarCab();
  let drawerCab = null;
  $("#acEditarCab").onclick = () => { drawerCab = drawer({ titulo: "Situação e auxiliares", corpo: $("#acCabForm"), aoFechar: () => { $("#acCabForm").classList.add("oculto"); drawerCab = null; pintarCab(); }, acoes: [{ t: "Aplicar" }] }); };
  // abas de adaptações: cada uma mostra só o seu grupo
  chips($("#acAbas"), [{ v: "visual", t: "Visual" }, { v: "tempo", t: "Tempo e vidas" }, { v: "voz", t: "Leitura em voz" }, { v: "reescritas", t: "Questões reescritas" }, { v: "apoios", t: "Apoios" }],
    { valor: "visual", aria: "Grupo de adaptações", aoMudar: v => box.querySelectorAll("[data-painel]").forEach(p => { p.hidden = p.dataset.painel !== v; }) });
  $("#acIrProva").onclick = () => $("#acProvaQ").closest(".card").scrollIntoView({ behavior: "smooth", block: "start" });

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
    if (!(await confirmar(`Salvar as alterações nas adaptações de ${a.nome || email}?${dados.ativo ? "" : " A acessibilidade fica DESLIGADA: o aluno volta a fazer a prova sem adaptações."}`, { titulo: "Salvar adaptações", ok: "Salvar" }))) return;
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
      aberto = null; drawerCab?.fechar(); $("#acessDetalhe").innerHTML = ""; toast("Acessibilidade removida.", "ok"); carregarAcessibilidade();
    } catch (e) { toast("Não foi possível remover. " + traduzirErro(e), "erro"); }
  });
  $("#acSalvarDesc").onclick = async () => {
    if (!(await confirmar("Salvar a descrição do aluno? As adaptações feitas antes desta mudança passam a aparecer como desatualizadas.", { titulo: "Salvar descrição", ok: "Salvar" }))) return;
    try { await setDoc(doc(db, "acessibilidadePrivado", email), { descricao: $("#acDescricao").value.trim(), atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email, infoAtualizadaEm: serverTimestamp() }, { merge: true });
      toast("Descrição salva. Adaptações feitas antes desta mudança aparecem como ⚠ desatualizadas.", "ok"); recarregarSeAberta(email); }
    catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); }
  };
  // 🧠 perfil para a IA: avisa quando há registros novos no diário desde a última atualização
  const perfilEm = p?.data()?.perfilIA?.atualizadoEm?.toMillis?.() || 0;
  getDocs(collection(db, "acessibilidadePrivado", email, "diario")).then(s => {
    const novos = s.docs.filter(d => (d.data().atualizadoEm?.toMillis?.() || 0) > perfilEm).length;
    if (novos && perfilEm) $("#acPerfilInfo").insertAdjacentHTML("beforeend", ` <span class="tag aviso">⚠ ${novos} registro(s) novo(s) no diário desde então: vale atualizar</span>`);
  }).catch(() => {});
  $("#acPerfilSalvar").onclick = async () => {
    if (!(await confirmar("Salvar o perfil do aluno? As próximas adaptações por IA passam a usar este texto.", { titulo: "Salvar perfil", ok: "Salvar" }))) return;
    try { await setDoc(doc(db, "acessibilidadePrivado", email), { perfilIA: { texto: $("#acPerfil").value.trim().slice(0, 6000), atualizadoEm: serverTimestamp(), por: ctx.eu.email }, infoAtualizadaEm: serverTimestamp() }, { merge: true });
      $("#acPerfilInfo").textContent = `Atualizado agora por ${ctx.eu.email}.`; toast("Perfil salvo. As próximas adaptações já usam este perfil.", "ok"); recarregarSeAberta(email); }
    catch (e) { toast(traduzirErro(e), "erro"); }
  };
  $("#acPerfilIA").onclick = async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = "🤖 Montando o perfil…";
    const tf = tarefa({ titulo: "Montando o perfil do aluno", icone: "🤖", estimativaSeg: 40, texto: "Lendo o diário, os comentários e as provas adaptadas…" });
    try {
      const qs = await getDocs(collection(db, "acessibilidade", email, "questoes")).catch(() => null);
      const fmts = {}; (qs?.docs || []).forEach(d => { const f = d.data().formato || "texto"; fmts[f] = (fmts[f] || 0) + 1; });
      const formatos = Object.entries(fmts).map(([f, n]) => `${f}: ${n} questão(ões)`).join("; ") + "\n" + (qs?.docs || []).slice(0, 10).map(d => `- ${d.data().formato || "texto"}: ${String(d.data().motivo || "").slice(0, 200)}`).join("\n");
      let texto;
      const cfg = ctx.iaCfg();
      if (cfg) {
        const regs = (await getDocs(collection(db, "acessibilidadePrivado", email, "diario")).catch(() => null))?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
        const coms = (await Promise.all(regs.filter(r => r.nComentarios > 0).slice(0, 6).map(r => getDocs(collection(db, "acessibilidadePrivado", email, "diario", r.id, "comentarios")).catch(() => null)))).flatMap(s => s?.docs.map(d => d.data()) || []);
        texto = await perfilIA({ chave: cfg.chave, modelo: cfg.modelo, descricao: $("#acDescricao").value.trim(), diario: contextoDiario(regs, coms), formatos, desempenho: "" });
      } else {
        if (!ctx.urlCorretor()) throw new Error("A IA não está configurada (Configuração).");
        const token = await ctx.auth.currentUser.getIdToken();
        const r = await fetch(ctx.urlCorretor(), { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify({ acao: "perfil", email, formatos }) });
        const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`); texto = d.texto;
      }
      $("#acPerfil").value = texto; tf.fim("Perfil montado. Revise e salve."); toast("🤖 Perfil montado. Revise e clique em Salvar perfil.", "ok");
    } catch (err) { tf.erro(err.message || traduzirErro(err)); toast("🤖 " + (err.message || traduzirErro(err)), "erro"); }
    b.disabled = false; b.textContent = "🤖 Atualizar com o diário e as provas";
  };
  desenharLaudos(email);
  $("#acLaudoArq").onchange = async e => {
    const arqs = [...e.target.files]; e.target.value = "";
    for (const f of arqs) {
      try { await enviarMaterial(f, f.name.replace(/\.pdf$/i, ""), ctx.eu.email, (i, n) => { $("#acLaudoMsg").textContent = `Enviando ${f.name}… ${Math.round(i / Math.max(1, n) * 100)}%`; }, `${priv(email)}/laudos`); }
      catch (er) { toast(erroMaterial(er, traduzirErro), "erro"); }
    }
    $("#acLaudoMsg").textContent = ""; desenharLaudos(email); if (arqs.length) infoMudou(email);
  };
  desenharSugestoes(email);
  $("#acSugEnviar").onclick = async () => {
    const texto = $("#acSugTexto").value.trim(); if (!texto) return;
    try { await addDoc(collection(db, "acessibilidadePrivado", email, "sugestoes"), { texto, autor: ctx.eu.email, autorNome: ctx.eu.nome || "", papel: ctx.eu.papel, criadoEm: serverTimestamp(), resolvida: false });
      $("#acSugTexto").value = ""; toast("Sugestão registrada.", "ok"); desenharSugestoes(email); }
    catch (e) { toast("Não foi possível enviar. " + traduzirErro(e), "erro"); }
  };
  const provaSel = () => provas.find(x => x.id === $("#acProvaQ").value);
  $("#acProvaQ").onchange = () => carregarQuestoes(email, provaSel());
  carregarQuestoes(email, provaSel());
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
    try { await apagarMaterial(b.dataset.dell, `${priv(email)}/laudos`); desenharLaudos(email); infoMudou(email); } catch (e) { toast(traduzirErro(e), "erro"); }
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
    if (!(await confirmar(s.resolvida ? "Reabrir esta sugestão?" : "Marcar esta sugestão como resolvida?", { titulo: "Sugestão", ok: s.resolvida ? "Reabrir" : "Marcar resolvida" }))) return;
    try { await updateDoc(doc(db, "acessibilidadePrivado", email, "sugestoes", s.id), { resolvida: !s.resolvida }); desenharSugestoes(email); } catch (e) { toast(traduzirErro(e), "erro"); }
  });
}

// ---------- prova adaptada: só as questões sorteadas para o aluno ----------
// qAtual = { email, prova, itens: [{ qid, q, g, ad }], ids, travada, sorteio, disp: { alt, diss, tipo }, infoEm }
let qAtual = null, ocupado = false;
const ms = t => (t?.toMillis ? t.toMillis() : null);
// adaptação feita antes da última mudança na descrição/laudos do aluno
const desatualizada = x => !!x.ad && ms(x.ad.atualizadoEm) !== null && qAtual?.infoEm !== null && ms(x.ad.atualizadoEm) < qAtual.infoEm;

// descrição/laudos mudaram: marca a data (as adaptações anteriores ficam "desatualizadas")
async function infoMudou(email) {
  laudosCache = null;
  await setDoc(doc(db, "acessibilidadePrivado", email), { infoAtualizadaEm: serverTimestamp() }, { merge: true }).catch(e => console.warn("infoAtualizadaEm", e));
  recarregarSeAberta(email);
}
function recarregarSeAberta(email) { laudosCache = null; if (qAtual?.email === email) carregarQuestoes(email, qAtual.prova); }

// questões do aluno nesta prova: a tentativa (se já começou) ou o sorteio guardado em acessibilidade/{email}.sorteios
async function questoesDoAluno(email, prova) {
  const a = (await getDoc(doc(db, "acessibilidade", email))).data() || {};
  if (a.uid) {
    const t = await getDoc(doc(db, "tentativas", `${a.uid}_${prova.id}`)).catch(() => null);
    if (t?.exists()) return { ids: t.data().questoesIds || [], travada: true, plano: a.planos?.[prova.id] || null };
  }
  const s = a.sorteios?.[prova.id];
  return { ids: Array.isArray(s?.ids) ? s.ids : [], travada: false, sorteio: s, plano: a.planos?.[prova.id] || null };
}
async function carregarQuestoes(email, prova) {
  const box = $("#acQuestoes"), sbox = $("#acSorteioBox");
  qAtual = null; $("#acResumo").innerHTML = "";
  if (!prova) { box.innerHTML = ""; sbox.innerHTML = "<p class='pequeno'>Nenhuma prova para a turma deste aluno. Crie a prova em <b>Provas</b> escolhendo a turma dele(a) (ou cadastre o aluno na turma em <b>Turmas</b>).</p>"; return; }
  box.innerHTML = "<p class='pequeno'>Carregando…</p>"; sbox.innerHTML = "";
  try {
    const [{ ids, travada, sorteio, plano }, disp, pv] = await Promise.all([questoesDoAluno(email, prova), questoesDisponiveis(prova),
      getDoc(doc(db, "acessibilidadePrivado", email)).catch(() => null)]);
    const pd = pv?.data() || {};
    const banco = q => bancoDaQuestao(q, prova.bancoId);
    const [qs, gs, ads] = await Promise.all([
      Promise.all(ids.map(q => getDoc(doc(db, "bancos", banco(q), "questoes", q)))),
      Promise.all(ids.map(q => getDoc(doc(db, "bancos", banco(q), "gabaritos", q)).catch(() => null))),
      Promise.all(ids.map(q => getDoc(doc(db, "acessibilidade", email, "questoes", q)).catch(() => null)))
    ]);
    const itens = ids.map((qid, i) => qs[i].exists() ? { qid, q: qs[i].data(), g: gs[i]?.data() || {}, ad: ads[i]?.exists() ? ads[i].data() : null } : null).filter(Boolean);
    qAtual = { email, prova, itens, ids, travada, sorteio, disp, plano: { ...(plano || {}) }, infoEm: ms(pd.infoAtualizadaEm) ?? ms(pd.atualizadoEm) };
    desenharSorteio(); desenharQuestoes();
  } catch (e) { box.innerHTML = `<p class="erro-texto">${esc(traduzirErro(e))}</p>`; }
}
function desenharSorteio() {
  const { prova, ids, travada, sorteio, disp } = qAtual, sbox = $("#acSorteioBox");
  if (travada) { sbox.innerHTML = `<p class="pequeno">🔒 O aluno <b>já começou esta prova</b>: abaixo estão as questões dele. Não dá mais para sortear nem trocar.</p>`; return; }
  const padrao = sorteio?.cota || cotaDaProva(prova);
  const nA = Math.min(padrao.nA, disp.alt.length), nD = Math.min(padrao.nD, disp.diss.length);
  sbox.innerHTML = `<div class="linha acoes" style="align-items:flex-end">
      <div style="flex:0 0 150px"><label for="acNA">Alternativas</label><input type="number" id="acNA" min="0" max="${disp.alt.length}" value="${nA}"><span class="pequeno">de ${disp.alt.length} disponíveis</span></div>
      <div style="flex:0 0 150px"><label for="acND">Dissertativas</label><input type="number" id="acND" min="0" max="${disp.diss.length}" value="${nD}"><span class="pequeno">de ${disp.diss.length} disponíveis</span></div>
      <button id="acSortear" class="leve" style="flex:0 0 auto">${ids.length ? "🎲 Sortear de novo" : "🎲 Sortear questões"}</button></div>
    <p class="pequeno" style="margin-top:6px">${ids.length
      ? `🎲 <b>${ids.length} questões sorteadas</b>${sorteio?.sorteadoEm ? ` em ${dataBR(sorteio.sorteadoEm)}` : ""}. Padrão da prova: ${cotaDaProva(prova).nA} alternativas + ${cotaDaProva(prova).nD} dissertativas.`
      : `Ainda não há questões sorteadas para este aluno. Padrão da prova: ${cotaDaProva(prova).nA} alternativas + ${cotaDaProva(prova).nD} dissertativas (pode mudar acima).`}</p>`;
  $("#acSortear").onclick = () => sortearParaAluno();
}
// extra = { removidas } (trocar/tirar/adicionar mantêm o histórico; sortear de novo começa do zero)
async function gravarSorteio(ids, cota, extra = null) {
  const removidas = extra?.removidas ?? (extra === null && qAtual.sorteio?.removidas) ?? [];
  await updateDoc(doc(db, "acessibilidade", qAtual.email), new FieldPath("sorteios", qAtual.prova.id),
    { ids, cota, removidas: removidas || [], sorteadoEm: serverTimestamp(), sorteadoPor: ctx.eu.email });
}
async function sortearParaAluno() {
  const { email, prova, ids } = qAtual;
  const cota = { nA: Math.max(0, Math.round(+$("#acNA").value || 0)), nD: Math.max(0, Math.round(+$("#acND").value || 0)) };
  if (ids.length && !(await confirmar(`Sortear de novo (${cota.nA} alternativas + ${cota.nD} dissertativas)? O aluno vai receber as NOVAS questões. As adaptações das questões que saírem ficam guardadas, mas não serão usadas.`, { titulo: "🎲 Sortear de novo", ok: "Sortear" }))) return;
  try {
    const novos = await sortearQuestoes(prova, cota);
    await gravarSorteio(novos, cota, { removidas: [] });
    toast(`🎲 ${novos.length} questões sorteadas. Agora adapte com a IA.`, "ok");
  } catch (e) { return toast("Não foi possível sortear. " + traduzirErro(e), "erro"); }
  carregarQuestoes(email, prova);
}
// troca UMA questão por outra do mesmo tipo (dos temas da prova) que ainda não está no sorteio
async function trocarQuestao(x) {
  const { email, prova, ids, disp, sorteio } = qAtual, tipo = disp.tipo[x.qid] || (x.q.tipo === "dissertativa" ? "dissertativa" : "alternativa");
  const livres = (tipo === "dissertativa" ? disp.diss : disp.alt).filter(q => !ids.includes(q));
  if (!livres.length) return toast(`Não há outra questão ${tipo} disponível nos temas da prova.`, "info");
  if (!(await confirmar(`Trocar a questão ${ids.indexOf(x.qid) + 1} por outra ${tipo} sorteada?`, { titulo: "🔁 Trocar questão", ok: "Trocar" }))) return;
  const nova = livres[Math.floor(Math.random() * livres.length)];
  const novos = ids.map(q => (q === x.qid ? nova : q));
  try { await gravarSorteio(novos, cotaDe(novos)); toast("🔁 Questão trocada. A nova ainda não está adaptada.", "ok"); }
  catch (e) { return toast("Não foi possível trocar. " + traduzirErro(e), "erro"); }
  carregarQuestoes(email, prova);
}

// tira UMA questão só da prova deste aluno (o banco não muda). Fica registrado para o relatório.
async function removerQuestao(x) {
  const { email, prova, ids, sorteio } = qAtual, n = ids.indexOf(x.qid) + 1;
  if (ids.length <= 1) return toast("A prova precisa ter pelo menos 1 questão.", "info");
  if (!(await confirmar(`Tirar a questão ${n} da prova deste aluno? Ela continua no banco; só não cai para ele(a). A prova fica com ${ids.length - 1} questões. Depois você pode adicionar outra (➕) se quiser.`, { titulo: "✕ Tirar questão", ok: "Tirar", perigo: true }))) return;
  const novos = ids.filter(q => q !== x.qid);
  const removidas = [...(sorteio?.removidas || []), { qid: x.qid, enunciado: String(x.q.enunciado || "").slice(0, 200), por: ctx.eu.email, em: new Date().toISOString() }];
  try { await gravarSorteio(novos, cotaDe(novos), { removidas }); toast("Questão tirada da prova deste aluno.", "ok"); }
  catch (e) { return toast("Não foi possível tirar. " + traduzirErro(e), "erro"); }
  carregarQuestoes(email, prova);
}
// acrescenta UMA questão sorteada do tipo escolhido (dos temas da prova), que ainda não esteja na prova dele
async function adicionarQuestao(tipo) {
  const { email, prova, ids, disp } = qAtual;
  const livres = (tipo === "dissertativa" ? disp.diss : disp.alt).filter(q => !ids.includes(q));
  if (!livres.length) return toast(`Não há outra questão ${tipo} disponível nos temas da prova.`, "info");
  const novos = [...ids, livres[Math.floor(Math.random() * livres.length)]];
  if (!(await confirmar(`Adicionar mais uma questão ${tipo} sorteada à prova deste aluno? A prova fica com ${novos.length} questões.`, { titulo: "➕ Adicionar questão", ok: "Adicionar" }))) return;
  try { await gravarSorteio(novos, cotaDe(novos)); toast(`➕ Questão ${tipo} adicionada. Ela ainda não está adaptada.`, "ok"); }
  catch (e) { return toast("Não foi possível adicionar. " + traduzirErro(e), "erro"); }
  carregarQuestoes(email, prova);
}
const cotaDe = ids => ({ nA: ids.filter(q => qAtual.disp.tipo[q] !== "dissertativa").length, nD: ids.filter(q => qAtual.disp.tipo[q] === "dissertativa").length });

function desenharQuestoes() {
  const { itens, travada } = qAtual, box = $("#acQuestoes"), resumo = $("#acResumo");
  if (!itens.length) { box.innerHTML = ""; resumo.innerHTML = ""; return; }   // (sem sorteio: só o quadro de sortear)
  const ia = podeIA();
  const nFaltam = itens.filter(x => !x.ad).length, nVelhas = itens.filter(desatualizada).length,
        nFeitas = itens.length - nFaltam, nManuais = itens.filter(x => x.ad?.origem === "manual").length;
  resumo.innerHTML = `<div class="linha acoes" style="gap:6px">
      <span class="tag nota">📝 ${itens.length} sorteadas</span>
      <span class="tag ok">✓ ${nFeitas - nVelhas} adaptadas em dia</span>
      ${nVelhas ? `<span class="tag aviso">⚠ ${nVelhas} desatualizadas</span>` : ""}
      <span class="tag">○ ${nFaltam} sem adaptação</span></div>
    <details class="montar-prova" id="acMontar"><summary>🧩 <b>Montar a prova</b> — escolha o formato de cada questão (ligar colunas, completar lacunas…) e gere tudo de uma vez</summary><div class="mp-corpo"></div></details>
    <div class="linha acoes" style="margin-top:8px">
      <button data-lote="faltam" ${!ia || !nFaltam || ocupado ? "disabled" : ""}>🤖 Adaptar as que faltam${nFaltam ? ` (${nFaltam})` : ""}</button>
      ${nVelhas ? `<button data-lote="velhas" class="leve" ${!ia || ocupado ? "disabled" : ""}>🔄 Refazer as desatualizadas (${nVelhas})</button>` : ""}
      <button data-lote="todas" class="leve" ${!ia || ocupado ? "disabled" : ""}>🔄 Refazer todas com IA</button>
      <button data-lote="apagar" class="perigo" ${!nFeitas || ocupado ? "disabled" : ""}>🗑 Apagar adaptações desta prova</button></div>
    <div class="linha acoes" style="margin-top:8px"><button data-formatos-todas class="leve" ${!ia || ocupado ? "disabled" : ""} title="A IA prepara várias opções de formato para cada questão; depois você escolhe em cada uma">🎨 Sugerir formatos para todas</button>
      <span class="pequeno">Liga-pontos, V/F, lacunas, ordenar, etapas… a IA propõe as opções, da mais indicada para a menos; você escolhe em cada questão (🎨 Formatos).</span></div>
    <div class="linha acoes" style="margin-top:8px">
      ${travada ? "" : `<button class="leve" data-add="alternativa" ${ocupado ? "disabled" : ""}>➕ Adicionar alternativa</button><button class="leve" data-add="dissertativa" ${ocupado ? "disabled" : ""}>➕ Adicionar dissertativa</button>`}
      <button class="ok" data-pdf ${ocupado ? "disabled" : ""}>📄 Baixar PDF da prova adaptada</button></div>
    ${ia ? "" : `<p class="pequeno">A IA precisa da chave (administrador principal) ou do servidor de correção configurado.</p>`}
    ${nManuais ? `<p class="pequeno">✍ ${nManuais} adaptada(s) à mão: “Refazer” pergunta antes de substituir.</p>` : ""}`;
  desenharMontar(ia);
  resumo.querySelectorAll("[data-lote]").forEach(b => b.onclick = () => acaoEmLote(b.dataset.lote));
  resumo.querySelectorAll("[data-add]").forEach(b => b.onclick = () => adicionarQuestao(b.dataset.add));
  resumo.querySelector("[data-pdf]").onclick = () => baixarPdf();
  resumo.querySelector("[data-formatos-todas]").onclick = () => sugerirTodas();

  box.innerHTML = itens.map((x, i) => {
    const alt = x.q.tipo === "alternativa", ad = x.ad || {}, velha = desatualizada(x);
    const status = !x.ad ? `<span class="tag">○ original</span>`
      : `${ad.formato && FORMATOS[ad.formato] ? `<span class="tag nota" title="Formato">${FORMATOS[ad.formato].icone} ${esc(FORMATOS[ad.formato].nome)}</span>` : ""}<span class="tag ${velha ? "aviso" : "ok"}">${ad.origem === "ia" ? "🤖 IA" : "✍ manual"}${ms(ad.atualizadoEm) ? ` · ${new Date(ms(ad.atualizadoEm)).toLocaleDateString("pt-BR")}` : ""}</span>${velha ? `<span class="tag aviso">⚠ desatualizada</span>` : ""}`;
    return `<details class="q-adapt${x.ad ? " feita" : ""}" data-i="${i}"><summary><b>Q${i + 1}</b><span class="tag">${alt ? "alternativa" : "dissertativa"}</span>${status}
        <span class="pequeno">${esc(temaDe(x.q))}</span> ${esc(String(x.q.enunciado || "").slice(0, 110))}${String(x.q.enunciado || "").length > 110 ? "…" : ""}</summary>
      <div class="q-adapt-corpo">
        <div class="q-orig"><span class="rotulo">Original</span><div class="enunciado pequeno">${esc(x.q.enunciado)}</div>
          ${alt ? `<ol type="A" class="pequeno">${x.q.alternativas.map((a, k) => `<li>${esc(a)}${k === x.g.correta ? " <b>✓</b>" : ""}</li>`).join("")}</ol>` : ""}</div>
        <div class="q-nova">
          <div class="fmt-barra"><span>🎨 Formato: <b>${ad.formato && FORMATOS[ad.formato] ? `${FORMATOS[ad.formato].icone} ${esc(FORMATOS[ad.formato].nome)}` : x.ad ? "📝 Texto simplificado" : "original"}</b></span>
            ${ia ? `<button type="button" class="mini" data-formatos ${ocupado ? "disabled" : ""}>🎨 Opções de formato (IA)</button>` : ""}<button type="button" class="leve mini" data-editfmt>✎ Escolher / editar formato</button>
            <span class="pequeno" data-temopcoes></span></div>
          ${temFormato(ad) ? `<div class="fmt-previa" data-previa><p class="pequeno">Carregando a prévia…</p></div>` : ""}
          <label>Enunciado adaptado</label><textarea data-campo="enunciado" style="font-family:inherit">${esc(ad.enunciado || "")}</textarea>
          ${alt && !temFormato(ad) ? x.q.alternativas.map((a, k) => `<label>Alternativa ${letra(k)}${k === x.g.correta ? " ✓" : ""}</label><input type="text" data-alt="${k}" value="${esc(ad.alternativas?.[k] ?? "")}" placeholder="${esc(a)}">`).join("") : ""}
          <label>💡 Apoios que o mascote fala na prova <span class="pequeno">(um por vez; nunca podem entregar a resposta)</span></label>
          <div data-apoios>${apoiosDe(ad).map(a => linhaApoio(a)).join("")}</div>
          <button type="button" class="leve mini" data-maisapoio>+ Adicionar apoio</button>
          <label style="margin-top:8px">📋 O que foi adaptado e por quê <span class="pequeno">(vai no PDF para a coordenação; o aluno não vê)</span></label>
          <textarea data-campo="motivo" style="font-family:inherit;min-height:70px">${esc(ad.motivo || "")}</textarea>
          <div class="linha acoes" style="margin-top:8px"><button class="ok mini" data-salvarq>Salvar</button>
            ${ia ? `<button class="mini" data-iaq ${ocupado ? "disabled" : ""}>🤖 ${x.ad ? "Refazer" : "Adaptar"} com IA</button>` : ""}
            ${x.ad ? `<button class="perigo mini" data-apagarq>Voltar ao original</button>` : ""}
            ${travada ? "" : `<button class="leve mini" data-trocarq ${ocupado ? "disabled" : ""}>🔁 Trocar questão</button><button class="perigo mini" data-removerq ${ocupado ? "disabled" : ""}>✕ Tirar da prova dele(a)</button>`}<span class="pequeno" data-msg></span></div></div>
      </div></details>`;
  }).join("");
  box.querySelectorAll(".q-adapt").forEach(el => {
    const x = qAtual.itens[+el.dataset.i];
    el.querySelector("[data-salvarq]").onclick = () => salvarQuestao(x, el);
    const aplicado = d => { x.ad = { ...d, atualizadoEm: { toMillis: () => Date.now(), seconds: Date.now() / 1000 } }; desenharQuestoes(); document.querySelector(`.q-adapt[data-i="${el.dataset.i}"]`)?.setAttribute("open", ""); };
    el.querySelector("[data-formatos]")?.addEventListener("click", () => abrirOpcoes({ ctx, email: qAtual.email, prova: qAtual.prova, x, laudos: () => laudosDoAluno(qAtual.email), aoAplicar: aplicado }));
    el.querySelector("[data-editfmt]").onclick = () => editarFormato({ ctx, email: qAtual.email, prova: qAtual.prova, x, aoAplicar: aplicado });
    el.addEventListener("toggle", () => {
      if (!el.open || el.dataset.carregou) return; el.dataset.carregou = "1";
      const pv = el.querySelector("[data-previa]"); if (pv) previaAplicada(pv, qAtual.email, x);
      lerOpcoes(qAtual.email, x.qid).then(o => { if (o?.opcoes?.length) el.querySelector("[data-temopcoes]").textContent = `${o.opcoes.length} opções prontas`; });
    });
    el.querySelector("[data-iaq]")?.addEventListener("click", () => adaptarUma(x, el));
    el.querySelector("[data-trocarq]")?.addEventListener("click", () => trocarQuestao(x));
    el.querySelector("[data-removerq]")?.addEventListener("click", () => removerQuestao(x));
    const lista = el.querySelector("[data-apoios]");
    const ligarApoios = () => lista.querySelectorAll("[data-tiraapoio]").forEach(b => b.onclick = () => b.closest(".linha-apoio").remove());
    el.querySelector("[data-maisapoio]").onclick = () => { lista.insertAdjacentHTML("beforeend", linhaApoio("")); ligarApoios(); lista.lastElementChild.querySelector("input").focus(); };
    ligarApoios();
    el.querySelector("[data-apagarq]")?.addEventListener("click", async () => {
      if (!(await confirmar("Apagar a adaptação desta questão? Ela volta ao original para o aluno.", { titulo: "Voltar ao original", ok: "Apagar adaptação", perigo: true }))) return;
      try { await deleteDoc(doc(db, "acessibilidade", qAtual.email, "questoes", x.qid)); await deleteDoc(doc(db, "acessibilidadePrivado", qAtual.email, "gabaritos", x.qid)).catch(() => {}); x.ad = null; desenharQuestoes(); } catch (e) { toast(traduzirErro(e), "erro"); }
    });
  });
}
const linhaApoio = t => `<div class="linha-apoio linha" style="gap:6px;margin:4px 0"><input type="text" data-apoio value="${esc(t)}" placeholder="Ex.: Primeiro ache o nome da tabela." style="flex:1">
  <button type="button" class="perigo mini" data-tiraapoio title="Remover este apoio" style="flex:0 0 auto">✕</button></div>`;
async function salvarQuestao(x, el) {
  const enunciado = el.querySelector("[data-campo=enunciado]").value.trim();
  const apoios = [...el.querySelectorAll("[data-apoio]")].map(i => i.value.trim()).filter(Boolean);
  const motivo = el.querySelector("[data-campo=motivo]").value.trim();
  if (!enunciado && !apoios.length) return toast("Escreva o enunciado adaptado ou pelo menos um apoio (ou use Voltar ao original).", "erro");
  const fmt = temFormato(x.ad || {});
  const alts = x.q.tipo === "alternativa" && !fmt ? [...el.querySelectorAll("[data-alt]")].map((inp, k) => inp.value.trim() || x.q.alternativas[k]) : null;
  // quem só mexe nos apoios/motivo de uma adaptação da IA não a transforma em "manual"
  const mexeuNoTexto = !x.ad || enunciado !== (x.ad.enunciado || "") || JSON.stringify(alts) !== JSON.stringify(x.ad.alternativas ?? null);
  const dados = { enunciado, alternativas: alts, apoios, dica: apoios[0] || "", motivo, origem: mexeuNoTexto ? "manual" : (x.ad.origem || "manual"),
                  provaId: qAtual.prova.id, adaptadoPor: mexeuNoTexto ? ctx.eu.email : (x.ad.adaptadoPor || ctx.eu.email),
                  editadoPor: ctx.eu.email, atualizadoEm: serverTimestamp() };
  if (!mexeuNoTexto && x.ad.modelo) dados.modelo = x.ad.modelo;
  if (fmt) Object.assign(dados, { formato: x.ad.formato, dados: x.ad.dados, opcaoTitulo: x.ad.opcaoTitulo || "" });   // o formato (e o gabarito privado) continuam
  if (!(await confirmar(x.ad ? "Salvar as alterações na questão adaptada? O aluno passa a ver esta versão." : "Salvar esta adaptação? O aluno passa a ver esta versão da questão.", { titulo: "Salvar questão adaptada", ok: "Salvar" }))) return;
  try { await setDoc(doc(db, "acessibilidade", qAtual.email, "questoes", x.qid), dados); x.ad = { ...dados, atualizadoEm: null }; toast("Questão adaptada salva ✅", "ok"); desenharQuestoes(); }
  catch (e) { toast("Não foi possível salvar. " + traduzirErro(e), "erro"); }
}

// ---------- 🧩 Montar a prova: o professor escolhe o formato de cada questão (ou quantas de cada) e a IA gera tudo ----------
// plano = { qid: "manter" | "auto" | formato } (fica em acessibilidade/{email}.planos.{provaId}; o aluno não usa)
const formatosDa = x => Object.keys(FORMATOS).filter(f => !(f === "escritaApoio" && x.q.tipo === "alternativa"));
const planoDe = x => qAtual.plano[x.qid] || (x.ad ? "manter" : "auto");
const NOME_PLANO = f => f === "manter" ? "— manter como está —" : f === "auto" ? "🤖 A IA escolhe o melhor formato" : `${FORMATOS[f].icone} ${FORMATOS[f].nome}`;
function desenharMontar(ia) {
  const box = $("#acMontar .mp-corpo"), { itens } = qAtual; if (!box) return;
  const ordemF = ["ligar", "lacunas", "vf", "menosAlt", "ordenar", "etapas", "escritaApoio", "texto"];
  const contar = f => itens.filter(x => planoDe(x) === f).length;
  const nGerar = itens.filter(x => planoDe(x) !== "manter").length;
  box.innerHTML = `<div class="mp-secao"><h4>1. Quantas questões de cada formato <span class="pequeno">(depois dá para mudar uma por uma no passo 2)</span></h4>
      <div class="mp-cotas">${ordemF.map(f => `<label class="mp-cota" title="${esc(FORMATOS[f].desc)}"><span>${FORMATOS[f].icone} ${esc(FORMATOS[f].nome)}</span>
        <input type="number" min="0" max="${itens.length}" value="${contar(f)}" data-cota="${f}" aria-label="Quantas questões em ${esc(FORMATOS[f].nome)}"></label>`).join("")}</div>
      <div class="linha acoes" style="margin-top:8px"><button type="button" class="leve mini" data-distribuir>↻ Distribuir nas questões</button>
        <span class="pequeno">As que sobrarem ficam com <b>🤖 a IA escolhe</b>. Resposta escrita com apoio só vale para dissertativa.</span></div></div>
    <div class="mp-secao"><h4>2. Formato de cada questão</h4>
      <div class="mp-lista">${itens.map((x, i) => `<div class="mp-linha"><b>Q${i + 1}</b><span class="tag">${x.q.tipo === "alternativa" ? "alternativa" : "dissertativa"}</span>
        <span class="mp-enun pequeno" title="${esc(x.q.enunciado)}">${esc(String(x.q.enunciado || "").slice(0, 90))}${String(x.q.enunciado || "").length > 90 ? "…" : ""}</span>
        <select data-plano="${x.qid}" aria-label="Formato da questão ${i + 1}">${["manter", "auto", ...formatosDa(x)].map(f => `<option value="${f}"${planoDe(x) === f ? " selected" : ""}>${esc(NOME_PLANO(f))}${f === "manter" && x.ad?.formato && FORMATOS[x.ad.formato] ? ` (hoje: ${esc(FORMATOS[x.ad.formato].nome)})` : f === "manter" && !x.ad ? " (original)" : ""}</option>`).join("")}</select></div>`).join("")}</div>
      <div class="linha acoes" style="margin-top:6px"><button type="button" class="leve mini" data-todas="auto">Todas: 🤖 a IA escolhe</button><button type="button" class="leve mini" data-todas="manter">Todas: manter</button></div></div>
    <div class="mp-secao"><h4>3. Gerar</h4>
      <div class="linha acoes"><button type="button" class="ok" data-gerar ${!ia || !nGerar || ocupado ? "disabled" : ""}>⚙ Gerar a prova adaptada (${nGerar} questão(ões))</button>
        <span class="pequeno">A IA monta cada questão no formato escolhido, com a descrição, o perfil e os laudos do aluno. Depois revise em cada questão abaixo (dá para editar à mão).</span></div>
      ${ia ? "" : `<p class="pequeno erro-texto">A IA precisa da chave (administrador principal) ou do servidor de correção configurado.</p>`}</div>`;
  const atualizar = () => { const aberto = $("#acMontar").open; desenharMontar(ia); $("#acMontar").open = aberto; };
  box.querySelectorAll("[data-plano]").forEach(s => s.onchange = () => { qAtual.plano[s.dataset.plano] = s.value; atualizar(); });
  box.querySelectorAll("[data-todas]").forEach(b => b.onclick = () => { itens.forEach(x => qAtual.plano[x.qid] = b.dataset.todas); atualizar(); });
  box.querySelector("[data-distribuir]").onclick = () => {
    const cotas = Object.fromEntries([...box.querySelectorAll("[data-cota]")].map(i => [i.dataset.cota, Math.max(0, Math.round(+i.value || 0))]));
    const total = Object.values(cotas).reduce((s, n) => s + n, 0);
    if (total > itens.length) return toast(`A soma (${total}) passa das ${itens.length} questões da prova.`, "erro");
    const livres = new Set(itens.map(x => x.qid)), novo = {};
    // primeiro o que tem restrição (escrita com apoio só em dissertativa), depois o resto, na ordem das questões
    for (const f of ["escritaApoio", ...ordemF.filter(f => f !== "escritaApoio")]) for (let n = 0; n < cotas[f]; n++) {
      const x = itens.find(x => livres.has(x.qid) && formatosDa(x).includes(f));
      if (!x) { toast(`Não há questão que aceite ${FORMATOS[f].nome} para todas as que você pediu.`, "erro"); break; }
      novo[x.qid] = f; livres.delete(x.qid);
    }
    itens.forEach(x => qAtual.plano[x.qid] = novo[x.qid] || "auto");
    toast("Formatos distribuídos. Confira no passo 2 e clique em ⚙ Gerar.", "ok"); atualizar();
  };
  box.querySelector("[data-gerar]").onclick = () => gerarMontada();
}
async function gerarMontada() {
  const { email, prova, itens } = qAtual;
  let alvo = itens.filter(x => planoDe(x) !== "manter");
  const resumo = Object.entries(alvo.reduce((c, x) => (c[planoDe(x)] = (c[planoDe(x)] || 0) + 1, c), {})).map(([f, n]) => `${n}× ${NOME_PLANO(f)}`).join(", ");
  if (!(await confirmar(`Gerar a prova adaptada de ${prova.titulo}? A IA vai montar ${alvo.length} questão(ões): ${resumo}. Leva cerca de 30 segundos por questão. O aluno passa a ver estas versões.`, { titulo: "⚙ Gerar a prova adaptada", ok: "Gerar" }))) return;
  const manuais = alvo.filter(x => x.ad?.origem === "manual");
  if (manuais.length && !(await confirmar(`${manuais.length} dessas questões foram adaptadas à mão. Substituir também essas?`, { titulo: "Adaptadas à mão", ok: "Substituir também", cancelar: "Manter as feitas à mão" })))
    alvo = alvo.filter(x => x.ad?.origem !== "manual");
  if (!alvo.length) return toast("Nada para gerar.", "info");
  try { await updateDoc(doc(db, "acessibilidade", email), new FieldPath("planos", prova.id), { ...qAtual.plano, ...Object.fromEntries(itens.map(x => [x.qid, planoDe(x)])) }); }
  catch (e) { console.warn("plano", e); }
  ocupado = true; desenharQuestoes();
  const tf = tarefa({ titulo: "Gerando a prova adaptada", icone: "🧩", total: alvo.length });
  let feitas = 0; const erros = [];
  for (const [n, x] of alvo.entries()) {
    const f = planoDe(x);
    tf.passo(n, `Questão ${itens.indexOf(x) + 1}: ${f === "auto" ? "a IA escolhe" : FORMATOS[f].nome}`);
    $("#acIAMsg").textContent = `🧩 Gerando ${n + 1} de ${alvo.length}…`;
    try {
      const opcoes = await gerarOpcoes({ ctx, email, prova, x, orientacao: $("#acOrientacao")?.value.trim() || "", laudos: () => laudosDoAluno(email), formatoAlvo: f === "auto" ? "" : f });
      const op = (f === "auto" ? opcoes?.[0] : opcoes?.find(o => o.formato === f)) || null;
      if (!op) throw new Error(`a IA não devolveu o formato ${FORMATOS[f]?.nome || f}`);
      await aplicarOpcao({ ctx, email, prova, x, opcao: op, origem: "ia", oferecidas: opcoes.length }); feitas++;
    } catch (e) { erros.push(`Q${itens.indexOf(x) + 1}: ${e.message || traduzirErro(e)}`); console.warn("montar", x.qid, e); if (/chave|crédito|configurad/i.test(e.message || "")) break; }
  }
  $("#acIAMsg").textContent = "";
  erros.length && !feitas ? tf.erro(erros[0]) : tf.fim(`${feitas} questão(ões) prontas${erros.length ? ` · ${erros.length} com erro` : ""}`);
  toast(`🧩 Prova adaptada: ${feitas} questão(ões) geradas${erros.length ? ` · erro em ${erros.join("; ")}` : ""}. Revise cada uma e use 👁 Abrir a prova como o aluno.`, erros.length ? "erro" : "ok");
  ocupado = false;
  await carregarQuestoes(email, prova);
}

// 🎨 prepara as opções de formato de todas as sorteadas que ainda não têm (a escolha é feita em cada questão)
async function sugerirTodas() {
  const itens = qAtual.itens, msg = $("#acIAMsg");
  ocupado = true; desenharQuestoes();
  let feitas = 0, erros = 0;
  const tf = tarefa({ titulo: "Preparando os formatos da prova adaptada", icone: "🎨", total: itens.length });
  for (const [n, x] of itens.entries()) {
    tf.passo(n, `Questão ${n + 1} de ${itens.length}`);
    if (await lerOpcoes(qAtual.email, x.qid)) continue;
    if (msg) msg.textContent = `🎨 Preparando formatos: questão ${n + 1} de ${itens.length}…`;
    try { await gerarOpcoes({ ctx, email: qAtual.email, prova: qAtual.prova, x, orientacao: $("#acOrientacao")?.value.trim() || "", laudos: () => laudosDoAluno(qAtual.email) }); feitas++; }
    catch (e) { erros++; console.warn("formatos", x.qid, e); if (/chave|crédito|configurad/i.test(e.message)) { toast(e.message, "erro"); break; } }
  }
  if (msg) msg.textContent = "";
  erros && !feitas ? tf.erro(`${erros} questão(ões) com erro`) : tf.fim(`${feitas} questão(ões) com opções prontas${erros ? ` · ${erros} com erro` : ""}`);
  ocupado = false; desenharQuestoes();
  toast(`🎨 Opções prontas em ${feitas} questão(ões)${erros ? ` · ${erros} com erro` : ""}. Abra cada questão e clique em 🎨 Opções de formato para escolher.`, erros ? "erro" : "ok");
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
// adapta os itens com a IA (substitui o que já existir neles, inclusive os feitos à mão: quem chama já filtrou/confirmou)
async function adaptarComIA(itens) {
  const email = qAtual.email, orientacao = $("#acOrientacao").value.trim(), cfg = ctx.iaCfg();
  const res = { adaptadas: 0, erros: [] };
  const tf = tarefa({ titulo: "Adaptando a prova com IA", icone: "🤖", total: itens.length, texto: "Lendo o perfil e os laudos…" });
  try {
  if (cfg) {   // navegador
    const pv = (await getDoc(doc(db, "acessibilidadePrivado", email)).catch(() => null))?.data() || {};
    const descricao = [pv.descricao, pv.perfilIA?.texto ? `PERFIL REVISADO PELA EQUIPE:\n${pv.perfilIA.texto}` : ""].filter(Boolean).join("\n\n");
    const laudos = await laudosDoAluno(email);
    for (const [n, x] of itens.entries()) {
      $("#acIAMsg").textContent = `🤖 Adaptando ${n + 1} de ${itens.length}…`; tf.passo(n, `Questão ${n + 1} de ${itens.length}`);
      try {
        const r = await adaptarQuestao({ chave: cfg.chave, modelo: cfg.modelo.includes("haiku") ? "claude-sonnet-5-5" : cfg.modelo, q: x.q, g: x.g, descricao, orientacao, laudos });
        const dados = { ...r, dica: r.apoios[0] || "", origem: "ia", modelo: cfg.modelo, provaId: qAtual.prova.id, adaptadoPor: ctx.eu.email, atualizadoEm: serverTimestamp() };
        await setDoc(doc(db, "acessibilidade", email, "questoes", x.qid), dados); res.adaptadas++;
      } catch (e) { res.erros.push({ qid: x.qid, erro: e.message }); if (e.fatal) break; }
    }
  } else {   // servidor: lotes de até 15
    const token = await ctx.auth.currentUser.getIdToken();
    for (let i = 0; i < itens.length; i += 15) {
      const lote = itens.slice(i, i + 15);
      $("#acIAMsg").textContent = `🤖 Adaptando ${i + 1}–${i + lote.length} de ${itens.length} (servidor)…`; tf.passo(i, `Questões ${i + 1} a ${i + lote.length} (no servidor)`);
      const r = await fetch(ctx.urlCorretor(), { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({ acao: "adaptar", email, provaId: qAtual.prova.id, qids: lote.map(x => x.qid), orientacao, refazer: true }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { res.erros.push({ erro: d.erro || `erro ${r.status}` }); break; }
      res.adaptadas += d.adaptadas || 0; res.erros.push(...(d.erros || []));
    }
  }
  } catch (e) { tf.erro(e.message || "Erro na adaptação"); throw e; }
  $("#acIAMsg").textContent = "";
  res.erros.length && !res.adaptadas ? tf.erro(res.erros[0].erro) : tf.fim(`${res.adaptadas} adaptada(s)${res.erros.length ? ` · ${res.erros.length} com erro` : ""}`);
  return res;
}
async function rodarIA(itens) {
  ocupado = true; desenharQuestoes();
  try {
    const r = await adaptarComIA(itens);
    toast(`🤖 ${r.adaptadas} adaptada(s)${r.erros.length ? ` · ${r.erros.length} com erro: ${r.erros[0].erro}` : ""}. Revise antes da prova.`, r.erros.length ? "erro" : "ok");
  } catch (e) { toast(traduzirErro(e), "erro"); }
  ocupado = false;
  await carregarQuestoes(qAtual.email, qAtual.prova);   // relê do banco (datas certas)
}
async function adaptarUma(x) {
  if (x.ad?.origem === "manual" && !(await confirmar("Esta questão foi adaptada à mão. Substituir pela versão da IA?", { titulo: "Adaptar com IA", ok: "Substituir" }))) return;
  await rodarIA([x]);
}
async function acaoEmLote(tipo) {
  const itens = qAtual.itens;
  if (tipo === "apagar") {
    const feitas = itens.filter(x => x.ad);
    if (!(await confirmar(`Apagar as ${feitas.length} adaptação(ões) das questões sorteadas desta prova (inclusive as feitas à mão)? As questões continuam sorteadas, só voltam ao original.`, { titulo: "🗑 Apagar adaptações", ok: "Apagar", perigo: true }))) return;
    try { await Promise.all(feitas.map(x => deleteDoc(doc(db, "acessibilidade", qAtual.email, "questoes", x.qid)))); toast("Adaptações apagadas.", "ok"); }
    catch (e) { toast(traduzirErro(e), "erro"); }
    return carregarQuestoes(qAtual.email, qAtual.prova);
  }
  let alvo = tipo === "faltam" ? itens.filter(x => !x.ad) : tipo === "velhas" ? itens.filter(desatualizada) : itens.slice();
  const manuais = alvo.filter(x => x.ad?.origem === "manual");
  const titulo = { faltam: "🤖 Adaptar as que faltam", velhas: "🔄 Refazer as desatualizadas", todas: "🔄 Refazer todas com IA" }[tipo];
  if (!(await confirmar(`${titulo}: a IA vai adaptar ${alvo.length} questão(ões) com a descrição e os laudos atuais do aluno. Leva alguns segundos por questão.`, { titulo, ok: "Adaptar" }))) return;
  if (manuais.length && !(await confirmar(`${manuais.length} dessas questões foram adaptadas à mão. Substituir também essas pela versão da IA?`, { titulo: "Adaptadas à mão", ok: "Substituir também", cancelar: "Manter as feitas à mão" })))
    alvo = alvo.filter(x => x.ad?.origem !== "manual");
  if (!alvo.length) return toast("Nada para adaptar.", "info");
  await rodarIA(alvo);
}

// ---------- 📄 PDF da prova adaptada (para professor, auxiliar e coordenação) ----------
// Abre um relatório pronto para imprimir: o navegador salva como PDF ("Salvar como PDF" no destino da impressão).
const fmtTexto = t => esc(String(t || ""))
  .replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, c) => `<pre>${c}</pre>`)
  .replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
const MOTIVOS_PROVA = {
  tempoExtraMin: v => v > 0 && [`Tempo extra de ${v} minutos`, "mais tempo para ler, organizar o raciocínio e revisar, sem a pressão do relógio."],
  vidasExtras: v => v > 0 && [`${v} vida(s) extra(s)`, "tolera saídas acidentais da tela da prova sem encerrar a avaliação."],
  semPunicao: v => v && ["Sem perder vidas", "sair da tela ou tentar colar fica apenas registrado, para que comportamentos involuntários não encerrem a prova."],
  ocultarCronometro: v => v && ["Cronômetro escondido", "o tempo continua valendo, mas não aparece na tela, para reduzir a ansiedade."],
  lerEmVoz: v => v !== false && ["Botão 🔊 Ouvir", "leitura em voz alta do enunciado, das alternativas e dos apoios."],
  mostrarDica: v => v !== false && ["Apoios do mascote", "dicas curtas de leitura e organização faladas pelo mascote da prova, uma por vez (nunca revelam a resposta)."]
};
function ajustesVisuais(v) {
  const P = VISUAL_PADRAO, l = [];
  if (v.escala !== P.escala) l.push(`letra em ${v.escala}%`);
  if (v.fonte !== P.fonte) l.push(`fonte ${FONTES[v.fonte]?.nome || v.fonte}`);
  if (v.letras !== P.letras) l.push(`espaço entre letras ${v.letras}em`);
  if (v.palavras !== P.palavras) l.push(`espaço entre palavras ${v.palavras}em`);
  if (v.linhas !== P.linhas) l.push(`altura da linha ${v.linhas}`);
  if (v.tema !== P.tema) l.push(`cores: ${TEMAS[v.tema]?.nome || v.tema}`);
  if (v.maiusculas) l.push("texto em caixa alta");
  if (v.linhaCurta) l.push("linhas curtas");
  if (v.regua) l.push("régua de leitura");
  if (v.semAnimacao) l.push("sem animações");
  return l;
}
async function baixarPdf() {
  // gabaritos privados das questões em outro formato (V/F, ligar…), para o PDF mostrar a resposta esperada
  const gabFmt = {};
  await Promise.all((qAtual?.itens || []).filter(x => temFormato(x.ad || {})).map(async x => {
    gabFmt[x.qid] = (await getDoc(doc(db, "acessibilidadePrivado", qAtual.email, "gabaritos", x.qid)).catch(() => null))?.data() || null;
  }));
  const w = window.open("", "_blank");   // abre já no clique (senão o navegador bloqueia)
  if (!w) return toast("O navegador bloqueou a janela. Libere pop-ups para este site.", "erro");
  w.document.write("<p style='font-family:sans-serif'>Montando o relatório…</p>");
  try {
    const { email, prova, itens, sorteio, travada } = qAtual;
    const [d, pv, laudos, alunos] = await Promise.all([
      getDoc(doc(db, "acessibilidade", email)), getDoc(doc(db, "acessibilidadePrivado", email)).catch(() => null),
      listarMateriais(`${priv(email)}/laudos`).catch(() => []), ctx.alunosDasTurmas().catch(() => [])]);
    const a = completar(d.data() || {}), descricao = pv?.data()?.descricao || "";
    const turma = alunos.find(x => x.email === email)?.turma || prova.turma || "";
    const nome = a.nome || email;
    // tempo e vidas: aluno com acessibilidade sempre faz a prova sem limite de tempo e sem vidas
    const geral = [["Sem limite de tempo e sem vidas", "a prova não tem cronômetro nem perde vidas; sair da tela ou tentar colar fica apenas registrado, para que a pressão do tempo e comportamentos involuntários não prejudiquem a avaliação."],
      ...Object.entries(MOTIVOS_PROVA).filter(([k]) => k === "lerEmVoz" || k === "mostrarDica").map(([k, f]) => f(a.prova[k])).filter(Boolean)];
    const vis = ajustesVisuais(a.visual);
    if (vis.length) geral.push(["Ajustes visuais (" + vis.join(", ") + ")", "facilitam a leitura e reduzem o cansaço visual, conforme a necessidade do aluno."]);
    const nIA = itens.filter(x => x.ad?.origem === "ia").length, nMan = itens.filter(x => x.ad && x.ad.origem !== "ia").length;
    const nAlt = itens.filter(x => x.q.tipo === "alternativa").length;
    const removidas = sorteio?.removidas || [];
    const quest = itens.map((x, i) => {
      const ad = x.ad, alt = x.q.tipo === "alternativa", apoios = apoiosDe(ad);
      const enun = ad?.enunciado || x.q.enunciado, alts = alt ? (ad?.alternativas?.length === x.q.alternativas.length ? ad.alternativas : x.q.alternativas) : null;
      const origem = !ad ? "versão original (sem adaptação)" : ad.origem === "ia" ? `adaptada pela IA${ad.editadoPor ? `, revisada por ${esc(ad.editadoPor)}` : ""}` : `adaptada por ${esc(ad.adaptadoPor || ad.editadoPor || "equipe")}`;
      return `<section class="q">
        <h3>Questão ${i + 1} <span>${ad?.formato && FORMATOS[ad.formato] ? esc(FORMATOS[ad.formato].nome) : alt ? "múltipla escolha" : "resposta escrita"} · ${esc(temaDe(x.q))} · ${origem}</span></h3>
        <div class="bloco aplicada"><div class="rot">Versão aplicada ao aluno</div><div>${fmtTexto(enun)}</div>
          ${temFormato(ad || {}) ? `<div class="rot">${FORMATOS[ad.formato].icone} ${esc(FORMATOS[ad.formato].nome)}</div><div>${esc(textoVazio(ad)).replace(/\n/g, "<br>")}</div>${gabFmt[x.qid] ? `<div class="rot" style="margin-top:6px">Resposta esperada</div><div>${esc(textoChave(ad, gabFmt[x.qid])).replace(/\n/g, "<br>")}</div>` : ""}`
            : ad?.formato === "escritaApoio" && ad.dados ? `${ad.dados.comecoResposta ? `<p><b>Comece assim:</b> ${esc(ad.dados.comecoResposta)}…</p>` : ""}${ad.dados.checklist?.length ? `<p><b>Não esqueça:</b> ${ad.dados.checklist.map(esc).join(" · ")}</p>` : ""}<div class="linhas"></div>`
            : alts ? `<ol type="A">${alts.map(t => `<li>${fmtTexto(t)}</li>`).join("")}</ol>` : `<div class="linhas"></div>`}</div>
        ${ad ? `<div class="bloco original"><div class="rot">Versão original do banco</div><div>${fmtTexto(x.q.enunciado)}</div>
          ${alt ? `<ol type="A">${x.q.alternativas.map(t => `<li>${fmtTexto(t)}</li>`).join("")}</ol>` : ""}</div>` : ""}
        ${apoios.length && a.prova.mostrarDica !== false ? `<div class="bloco apoio"><div class="rot">💡 Apoios falados pelo mascote</div><ul>${apoios.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
        ${ad ? `<div class="bloco motivo"><div class="rot">📋 O que foi adaptado e por quê</div>${ad.motivo ? fmtTexto(ad.motivo) : "<i>Justificativa não registrada. Escreva no campo “O que foi adaptado e por quê” da questão no painel.</i>"}</div>` : ""}
      </section>`;
    }).join("");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Prova adaptada - ${esc(nome)} - ${esc(prova.titulo)}</title>
<style>
  @page { size:A4; margin:16mm 14mm; }
  body { font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; color:#1d2433; font-size:11.5pt; line-height:1.45; margin:0 auto; max-width:820px; padding:16px; }
  .barra { position:sticky; top:0; background:#fff7e6; border:1px solid #f3d58f; border-radius:10px; padding:10px 14px; margin-bottom:16px; display:flex; gap:12px; align-items:center; }
  .barra button { background:#c1272d; color:#fff; border:0; border-radius:8px; padding:8px 16px; font-weight:700; cursor:pointer; }
  header { border-bottom:3px solid #c1272d; padding-bottom:8px; margin-bottom:14px; }
  header .marca { display:inline-block; background:#c1272d; color:#fff; font-weight:800; letter-spacing:2px; padding:2px 10px; border-radius:4px; }
  h1 { font-size:18pt; margin:8px 0 2px; } h2 { font-size:13pt; color:#14213d; border-bottom:1px solid #d9dde5; padding-bottom:3px; margin:20px 0 8px; }
  h3 { font-size:12pt; margin:0 0 6px; } h3 span { font-weight:400; color:#5b6474; font-size:9.5pt; }
  table.dados td { padding:2px 12px 2px 0; vertical-align:top; } table.dados td:first-child { color:#5b6474; white-space:nowrap; }
  .caixa { border:1px solid #d9dde5; border-radius:8px; padding:8px 12px; background:#fafbfc; white-space:pre-wrap; }
  ul.geral li { margin:3px 0; }
  .q { border:1px solid #d9dde5; border-radius:10px; padding:10px 14px; margin:12px 0; break-inside:avoid-page; }
  .bloco { margin:8px 0; } .rot { font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#5b6474; margin-bottom:2px; }
  .original { color:#5b6474; font-size:10pt; border-left:3px solid #d9dde5; padding-left:10px; }
  .apoio { background:#eef6ff; border-left:4px solid #2f6db5; padding:6px 10px; border-radius:6px; }
  .motivo { background:#fff7e6; border-left:4px solid #e0a100; padding:6px 10px; border-radius:6px; }
  .apoio ul { margin:2px 0; padding-left:18px; } ol { margin:4px 0; }
  pre { background:#f3f4f6; padding:6px 8px; border-radius:6px; white-space:pre-wrap; font-size:10pt; } code { background:#f3f4f6; padding:0 3px; border-radius:3px; }
  .linhas { height:60px; border-bottom:1px dashed #c9ced8; }
  .assin { display:grid; grid-template-columns:1fr 1fr 1fr; gap:24px; margin-top:48px; text-align:center; font-size:10pt; }
  .assin div { border-top:1px solid #1d2433; padding-top:4px; }
  .rodape { margin-top:18px; font-size:9pt; color:#5b6474; }
  @media print { .barra { display:none; } body { padding:0; } }
</style></head><body>
<div class="barra"><button onclick="print()">📄 Salvar como PDF</button><span>Na janela de impressão, escolha <b>Salvar como PDF</b> no destino.</span></div>
<header><span class="marca">SENAI</span><h1>Prova adaptada — relatório de acessibilidade</h1>
<table class="dados"><tr><td>Aluno(a)</td><td><b>${esc(nome)}</b> · ${esc(email)}</td></tr>
${turma ? `<tr><td>Turma</td><td>${esc(turma)}</td></tr>` : ""}
<tr><td>Prova</td><td><b>${esc(prova.titulo)}</b></td></tr>
<tr><td>Questões</td><td>${itens.length} (${nAlt} de múltipla escolha, ${itens.length - nAlt} de resposta escrita) · ${nIA} adaptada(s) pela IA, ${nMan} pela equipe, ${itens.length - nIA - nMan} na versão original${travada ? " · <b>prova já iniciada pelo aluno</b>" : ""}</td></tr>
<tr><td>Auxiliar(es)</td><td>${(a.auxiliares || []).map(esc).join(", ") || "—"}</td></tr>
<tr><td>Gerado em</td><td>${new Date().toLocaleString("pt-BR")} por ${esc(ctx.eu.email)}</td></tr></table></header>

<h2>1. Sobre o aluno (base das adaptações)</h2>
<div class="caixa">${descricao ? esc(descricao) : "<i>Sem descrição registrada.</i>"}</div>
<p><b>Laudos e documentos considerados:</b> ${laudos.length ? laudos.map(l => esc(l.titulo)).join("; ") : "nenhum enviado"}${laudos.length > 3 ? " (a IA lê os 3 primeiros)" : ""}.</p>

<h2>2. Adaptações gerais da prova</h2>
${geral.length ? `<ul class="geral">${geral.map(([o, p]) => `<li><b>${esc(o)}:</b> ${esc(p)}</li>`).join("")}</ul>` : "<p>Nenhuma adaptação geral marcada.</p>"}
<p>As questões foram sorteadas dos mesmos temas da prova da turma. O conteúdo avaliado e a resposta correta de cada questão não mudam: a adaptação muda a forma de apresentar. Na prova, a ordem das alternativas é embaralhada.</p>
${removidas.length ? `<p><b>Questões tiradas da prova deste aluno:</b></p><ul>${removidas.map(r => `<li>${esc(r.enunciado || r.qid)}… <span style="color:#5b6474">(${esc(r.por || "")}, ${r.em ? new Date(r.em).toLocaleDateString("pt-BR") : ""})</span></li>`).join("")}</ul>` : ""}

<h2>3. Questões</h2>
${quest}

<div class="assin"><div>Professor(a)</div><div>Auxiliar de inclusão</div><div>Coordenação</div></div>
<p class="rodape">As justificativas marcadas como “adaptada pela IA” foram escritas pela inteligência artificial a partir da descrição e dos laudos acima e devem ser revisadas pela equipe. Documento interno: contém informações do aluno; não entregue ao aluno.</p>
</body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 500);
  } catch (e) { w.close(); toast("Não foi possível montar o PDF. " + traduzirErro(e), "erro"); }
}
