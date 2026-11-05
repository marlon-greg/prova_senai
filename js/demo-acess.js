// Prova de DEMONSTRAÇÃO de acessibilidade (demo-acessibilidade.html): escolhe um perfil fictício e faz a prova
// com as adaptações dele (visual, tempo, vidas, leitura em voz, apoios e formatos). Nada é gravado: tudo fica na memória.
import { PROVA_DEMO, QUESTOES_DEMO, PERFIS_DEMO } from "./demo-acess-dados.js";
import { aplicarVisual, completar, FONTES, TEMAS } from "./acessibilidade.js";
import { montarFormato, rotuloFormato, textoParaFalar, FORMATOS, temFormato } from "./formatos-ui.js";
import { montarDeOpcao, corrigirFormato, textoResposta, textoChave } from "../servidor/formatos.js";
import { htmlMascote, dadosMascote } from "./guia.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const negrito = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
const semMarcas = s => String(s || "").replace(/\*\*/g, "");
const LETRAS = "ABCDE";
const ORIGINAL = { id: "original", nome: "Prova original", resumo: "Sem adaptação (para comparar)", e: "📄", cor: "#6b7280",
  descricao: "A mesma prova, do jeito que está no banco de questões, sem nenhuma adaptação.", visual: null, prova: {}, adapta: {} };

let perfil = null, cfg = null, questoes = [], respostas = {}, indice = 0, controle = null;
let fimEm = 0, timer = null, vidas = 0, saidas = 0, bastidores = false, apoioVez = {};

// ---------- 1. escolha do perfil ----------
function chipsDoPerfil(p) {
  if (p.id === "original") return `<span class="chip">sem adaptações</span>`;
  const c = completar(p), v = c.visual, r = c.prova, l = [];
  if (v.escala !== 100) l.push(`🔠 letra ${v.escala}%`);
  if (v.fonte !== "padrao") l.push(`✒ ${FONTES[v.fonte].nome.split(" (")[0]}`);
  if (v.tema !== "padrao") l.push(`🎨 ${TEMAS[v.tema].nome}`);
  if (v.linhaCurta) l.push("📏 linhas curtas");
  if (v.regua) l.push("📐 régua de leitura");
  if (v.semAnimacao) l.push("🧘 sem animações");
  if (r.tempoExtraMin) l.push(`⏱ +${r.tempoExtraMin} min`);
  if (r.ocultarCronometro) l.push("🙈 relógio escondido");
  if (r.vidasExtras) l.push(`❤️ +${r.vidasExtras} vidas`);
  if (r.semPunicao) l.push("🛡 sair não tira vida");
  if (r.lerEmVoz) l.push("🔊 ler em voz alta");
  if (r.mostrarDica) l.push("💡 apoios");
  const fs = [...new Set(Object.values(p.adapta).map(a => a.formato))].map(f => `${FORMATOS[f].icone} ${FORMATOS[f].nome}`);
  return l.map(x => `<span class="chip">${x}</span>`).join("") + fs.map(x => `<span class="chip info">${x}</span>`).join("");
}
function telaEscolha() {
  pararTudo(); aplicarVisual($("#palco"), null);
  $("#palco").innerHTML = `<section class="card demo-intro"><h2>🧪 Prova de demonstração de acessibilidade</h2>
      <p>Escolha um <b>perfil fictício</b> e faça a prova como se fosse esse aluno. Cada perfil tem adaptações diferentes: visual, tempo, vidas, leitura em voz alta, apoios e <b>formatos de questão</b>.
      As 6 questões de SQL são as mesmas para todos; só muda a adaptação. <b>Nada é gravado</b> e os perfis não são alunos reais.</p></section>
    <div class="demo-perfis">${[...PERFIS_DEMO, ORIGINAL].map(p => `<article class="card demo-perfil" style="--cor:${p.cor}">
      <div class="dp-cab"><span class="dp-e">${p.e}</span><div><h3>${esc(p.nome)}</h3><span class="pequeno">${esc(p.resumo)}</span></div></div>
      <p class="pequeno">${esc(p.descricao)}</p><div class="dp-chips">${chipsDoPerfil(p)}</div>
      <button type="button" data-perfil="${p.id}">${p.id === "original" ? "Fazer a prova original" : `Fazer a prova como ${esc(p.nome.split(" ")[0])}`} →</button></article>`).join("")}</div>`;
  $("#palco").querySelectorAll("[data-perfil]").forEach(b => b.onclick = () => comecar(b.dataset.perfil));
}

// ---------- 2. prova ----------
// questão do perfil: original ou adaptada (com o gabarito montado na hora)
function questaoDoPerfil(o) {
  const a = perfil.adapta[o.id];
  if (!a) return { o, q: { ...o, formato: null }, chave: null, adaptada: false };
  if (a.formato === "texto" || a.formato === "escritaApoio") {
    const { adaptada } = montarDeOpcao(a, perfil.id + o.id);
    return { o, adaptada: true, motivo: a.motivo, chave: null, q: { ...o, enunciado: a.enunciado, alternativas: a.alternativas || o.alternativas, apoios: adaptada.apoios, formato: a.formato, dados: adaptada.dados } };
  }
  const { adaptada, chave } = montarDeOpcao(a, perfil.id + o.id);
  return { o, adaptada: true, motivo: a.motivo, chave: { formato: a.formato, chave }, q: { ...o, ...adaptada } };
}
function comecar(id) {
  perfil = id === "original" ? ORIGINAL : PERFIS_DEMO.find(p => p.id === id);
  cfg = completar(perfil);
  questoes = QUESTOES_DEMO.map(questaoDoPerfil);
  respostas = {}; indice = 0; saidas = 0; apoioVez = {};
  vidas = PROVA_DEMO.vidas + (cfg.prova.vidasExtras || 0);
  fimEm = Date.now() + (PROVA_DEMO.tempoMinutos + (cfg.prova.tempoExtraMin || 0)) * 60000;
  aplicarVisual($("#palco"), perfil.visual ? cfg.visual : null);
  $("#palco").innerHTML = `<div class="card hud demo-hud">
      <div class="dh-l"><span class="chip" style="background:${perfil.cor};color:#fff">${perfil.e} ${esc(perfil.nome)}</span><b>${esc(PROVA_DEMO.titulo)}</b></div>
      <div class="dh-r"><span id="dmTempo" class="chip"></span><span id="dmVidas" class="chip vidas"></span>
        <label class="check dm-bast"><input type="checkbox" id="dmBast"${bastidores ? " checked" : ""}> <span>👀 Bastidores</span></label>
        <button type="button" class="leve mini" id="dmTrocar">↺ Trocar perfil</button></div>
      <div class="progresso"><div id="dmBarra"></div></div>
      <div id="dmFaixa" class="q-faixa" role="navigation" aria-label="Ir para a questão"></div></div>
    <div id="dmQuestao"></div>
    <div class="acoes-questao dm-nav"><button type="button" class="leve grande" id="dmAnt">← Anterior</button><button type="button" class="grande direita" id="dmProx">Próxima →</button>
      <button type="button" class="ok grande direita oculto" id="dmFim">Finalizar prova ✔</button></div>`;
  $("#dmTrocar").onclick = telaEscolha;
  $("#dmBast").onchange = e => { bastidores = e.target.checked; desenharQuestao(); };
  $("#dmAnt").onclick = () => irPara(indice - 1);
  $("#dmProx").onclick = () => irPara(indice + 1);
  $("#dmFim").onclick = finalizar;
  timer = setInterval(relogio, 1000); relogio();
  document.addEventListener("visibilitychange", aoSair);
  desenharQuestao();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function guardar() { if (controle) { const v = controle.valor(); if (v !== null && v !== undefined && v !== "") respostas[questoes[indice].o.id] = v; else delete respostas[questoes[indice].o.id]; } }
function irPara(i) { guardar(); pararFala(); indice = Math.max(0, Math.min(questoes.length - 1, i)); desenharQuestao(); }

function desenharQuestao() {
  const x = questoes[indice], q = x.q, n = questoes.length, fmt = temFormato(q);
  $("#dmBarra").style.width = `${Object.keys(respostas).length / n * 100}%`;
  $("#dmFaixa").innerHTML = questoes.map((y, i) => `<button type="button" class="mini ${respostas[y.o.id] !== undefined ? "respondida" : "pendente"}${i === indice ? " atual" : ""}" data-ir="${i}" aria-label="Questão ${i + 1}">${i + 1}</button>`).join("");
  $("#dmFaixa").querySelectorAll("[data-ir]").forEach(b => b.onclick = () => irPara(Number(b.dataset.ir)));
  const tipo = fmt ? FORMATOS[q.formato].nome.toLowerCase() : q.tipo === "alternativa" ? "múltipla escolha" : "resposta escrita";
  const temApoio = cfg.prova.mostrarDica && q.apoios?.length;
  $("#dmQuestao").innerHTML = `<div class="card questao">
    <div class="q-cab"><span class="q-num">Questão ${indice + 1}<small> de ${n}</small></span><span class="tag">${tipo}</span>${x.adaptada ? `<span class="tag nota">♿ adaptada</span>` : ""}
      ${cfg.prova.lerEmVoz && "speechSynthesis" in window ? `<button type="button" class="leve mini b-ouvir">🔊 Ouvir</button>` : ""}</div>
    ${bastidores && x.adaptada ? `<div class="dm-bastidor"><b>👀 Bastidores (o aluno não vê):</b> ${FORMATOS[q.formato]?.icone || ""} ${esc(FORMATOS[q.formato]?.nome || "")} · ${esc(x.motivo || "")}
      <details><summary>Ver a questão original</summary><p>${esc(x.o.enunciado)}</p>${x.o.alternativas ? `<ol type="A">${x.o.alternativas.map(a => `<li>${esc(a)}</li>`).join("")}</ol>` : ""}</details></div>` : ""}
    <div class="q-corpo">
      <div class="enunciado">${negrito(q.enunciado)}</div>
      ${temApoio ? `<div class="apoio-mascote">${htmlMascote("feliz", { classe: "apoio-m", animado: !cfg.visual.semAnimacao })}<button type="button" class="leve b-apoio">💡 Pedir ajuda ao ${esc(dadosMascote().nome)}</button></div><div class="dm-fala oculto" role="status"></div>` : ""}
      ${q.formato === "escritaApoio" && q.dados ? `<div class="escrita-apoio">${q.dados.comecoResposta ? `<p><b>✏ Comece assim:</b> ${esc(q.dados.comecoResposta)}</p>` : ""}${q.dados.checklist?.length ? `<p><b>✅ Não esqueça:</b></p><ul>${q.dados.checklist.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}</div>` : ""}
      <div class="q-rotulo">${fmt ? rotuloFormato(q) : q.tipo === "alternativa" ? "Escolha uma alternativa" : "Sua resposta"}</div>
      <div class="q-area"></div>
    </div></div>`;
  const area = $("#dmQuestao .q-area"), salvo = respostas[x.o.id];
  if (fmt) controle = montarFormato(area, q, { nome: "dm" + x.o.id });
  else if (q.tipo === "alternativa") controle = montarFormato(area, { formato: "menosAlt", dados: { alternativas: q.alternativas } }, { nome: "dm" + x.o.id });
  else {
    area.innerHTML = `<textarea class="dm-texto" rows="6" placeholder="Escreva sua resposta…" aria-label="Sua resposta">${esc(salvo || (q.dados?.comecoResposta || ""))}</textarea>`;
    const t = $("textarea", area); controle = { valor: () => t.value.trim(), preencher: () => {} };
  }
  if (salvo !== undefined && controle.preencher) controle.preencher(salvo);
  $("#dmQuestao .b-ouvir")?.addEventListener("click", e => ouvir(q, e.currentTarget));
  $("#dmQuestao .b-apoio")?.addEventListener("click", () => {
    const k = (apoioVez[x.o.id] || 0) % q.apoios.length; apoioVez[x.o.id] = k + 1;
    const f = $("#dmQuestao .dm-fala"); f.classList.remove("oculto"); f.innerHTML = `<b>${esc(dadosMascote().nome)}:</b> ${esc(q.apoios[k])}`;
    if (cfg.prova.lerEmVoz) falar(q.apoios[k]);
  });
  $("#dmAnt").disabled = indice === 0;
  $("#dmProx").classList.toggle("oculto", indice === n - 1);
  $("#dmFim").classList.toggle("oculto", indice !== n - 1);
}

// ---------- leitura em voz alta ----------
function falar(texto, aoAcabar) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(semMarcas(texto)); u.lang = "pt-BR";
  const voz = speechSynthesis.getVoices().find(v => /^pt(-|_)BR/i.test(v.lang)); if (voz) u.voice = voz;
  u.onend = u.onerror = () => aoAcabar?.();
  speechSynthesis.speak(u);
}
const pararFala = () => { if ("speechSynthesis" in window) speechSynthesis.cancel(); };
function ouvir(q, b) {
  if (b.classList.contains("ativo")) { pararFala(); b.classList.remove("ativo"); b.textContent = "🔊 Ouvir"; return; }
  const alts = temFormato(q) ? textoParaFalar(q) : q.tipo === "alternativa" ? q.alternativas.map((a, i) => `Alternativa ${LETRAS[i]}: ${a}.`).join(" ") : "";
  b.classList.add("ativo"); b.textContent = "⏹ Parar";
  falar(`${q.enunciado}. ${alts}`, () => { b.classList.remove("ativo"); b.textContent = "🔊 Ouvir"; });
}

// ---------- tempo e vidas ----------
function relogio() {
  const resta = Math.max(0, fimEm - Date.now()), m = Math.floor(resta / 60000), s = Math.floor(resta / 1000) % 60;
  $("#dmTempo").textContent = cfg.prova.ocultarCronometro ? (resta < 60000 ? "⏱ falta 1 minuto!" : "⏱ relógio escondido (avisamos no último minuto)") : `⏱ ${m}:${String(s).padStart(2, "0")}${cfg.prova.tempoExtraMin ? ` (com +${cfg.prova.tempoExtraMin} min)` : ""}`;
  $("#dmVidas").textContent = cfg.prova.semPunicao ? `🛡 saídas registradas: ${saidas} (sem perder vida)` : `${"❤️".repeat(Math.max(0, vidas))}${"🖤".repeat(Math.max(0, PROVA_DEMO.vidas + (cfg.prova.vidasExtras || 0) - vidas))} ${vidas} vida(s)`;
  if (!resta) finalizar();
}
function aoSair() {
  if (document.visibilityState !== "hidden") return;
  saidas++;
  if (!cfg.prova.semPunicao) vidas--;
  relogio();
  setTimeout(() => {
    aviso(cfg.prova.semPunicao ? "🛡 Você saiu da prova" : "💔 Você perdeu 1 vida",
      cfg.prova.semPunicao ? "Neste perfil sair só fica registrado para o professor: não tira vida." : vidas > 0 ? `Restam ${vidas}. Na prova de verdade, sair da tela cheia ou trocar de aba tira vida.` : "As vidas acabaram: a prova é finalizada.");
    if (!cfg.prova.semPunicao && vidas <= 0) finalizar();
  }, 300);
}
function aviso(titulo, texto) {
  const f = document.createElement("div"); f.className = "sobreposicao";
  f.innerHTML = `<div class="sobre-caixa"><h2>${esc(titulo)}</h2><p>${esc(texto)}</p><button type="button" class="grande">Voltar para a prova</button></div>`;
  document.body.append(f); f.querySelector("button").onclick = () => f.remove(); f.querySelector("button").focus();
}
function pararTudo() { clearInterval(timer); timer = null; pararFala(); document.removeEventListener("visibilitychange", aoSair); }

// ---------- 3. resultado (com a comparação original × adaptada) ----------
function corrigirDemo(x, r) {
  const q = x.q;
  if (x.chave) return corrigirFormato(q, x.chave, r, 1);
  if (r === undefined || r === null || r === "") return { pontos: 0, status: "em_branco" };
  if (q.tipo === "alternativa") return Number(r) === Number(x.o.correta) ? { pontos: 1, status: "certa" } : { pontos: 0, status: "errada" };
  const t = String(r).toLowerCase(), achou = x.o.palavrasChave.filter(p => t.includes(p)).length, tot = x.o.palavrasChave.length;
  return { pontos: Math.round(achou / tot * 100) / 100, status: achou === tot ? "certa" : achou ? "parcial" : "errada" };
}
// as opções como o aluno viu (para comparar com a original)
function opcoesAdaptadas(x) {
  if (!x.adaptada) return "";
  const q = x.q, d = q.dados || {}, lista = l => `<ol type="A">${l.map(a => `<li>${esc(a)}</li>`).join("")}</ol>`;
  if (q.formato === "texto") return q.alternativas ? lista(q.alternativas) : "";
  if (q.formato === "menosAlt") return lista(d.alternativas);
  if (q.formato === "vf") return `<ul>${d.afirmacoes.map(a => `<li>V ou F: ${esc(a)}</li>`).join("")}</ul>`;
  if (q.formato === "ligar") return `<p class="pequeno">Ligar: ${d.esquerda.map(esc).join(" · ")} ⟷ ${d.direita.map(esc).join(" · ")}</p>`;
  if (q.formato === "ordenar") return `<p class="pequeno">Ordenar: ${d.passos.map(esc).join(" · ")}</p>`;
  if (q.formato === "lacunas") return `<p class="pequeno">${esc(String(d.texto).replace(/\[\[\d+\]\]/g, "____"))}<br>Palavras: ${d.banco.map(esc).join(", ")}</p>`;
  if (q.formato === "etapas") return `<ol>${d.etapas.map(e => `<li>${esc(e.pergunta)} <span class="pequeno">(${e.alternativas.map(esc).join(" / ")})</span></li>`).join("")}</ol>`;
  if (q.formato === "escritaApoio") return `<p class="pequeno">✏ ${esc(d.comecoResposta || "")} · ✅ ${(d.checklist || []).map(esc).join("; ")}</p>`;
  return "";
}
function finalizar() {
  if (!timer) return;
  guardar(); pararTudo();
  const linhas = questoes.map(x => ({ x, c: corrigirDemo(x, respostas[x.o.id]) }));
  const pts = linhas.reduce((s, l) => s + l.c.pontos, 0), nota = Math.round(pts / linhas.length * 1000) / 10;
  const rot = { certa: ["ok", "✅ Certa"], errada: ["erro", "❌ Errada"], parcial: ["aviso", "🟡 Parcial"], em_branco: ["erro", "⬜ Em branco"], revisar: ["aviso", "🟡 Revisar"] };
  const sua = (x, r) => r === undefined ? "<i>não respondida</i>" : temFormato(x.q) ? esc(textoResposta(x.q, r)).replace(/\n/g, "<br>") : x.q.tipo === "alternativa" ? `${LETRAS[r]}) ${esc(x.q.alternativas[r])}` : esc(r);
  const certa = x => x.chave ? esc(textoChave(x.q, x.chave)).replace(/\n/g, "<br>") : x.q.tipo === "alternativa" ? `${LETRAS[x.o.correta]}) ${esc(x.q.alternativas[x.o.correta])}` : esc(x.o.respostaModelo);
  $("#palco").innerHTML = `<section class="card demo-res"><div class="card-cab"><h2>${perfil.e} Resultado — ${esc(perfil.nome)}</h2>
      <div class="cc-acoes"><button type="button" class="leve" id="dmDeNovo">↻ Fazer de novo</button><button type="button" id="dmOutro">Escolher outro perfil</button></div></div>
      <div class="stats"><div class="stat ${nota >= 70 ? "ok" : nota >= 50 ? "aviso" : "erro"}"><b>${nota}<small>/100</small></b><span>nota</span></div>
        <div class="stat"><b>${linhas.filter(l => l.c.status === "certa").length}<small>/${linhas.length}</small></b><span>certas</span></div>
        <div class="stat"><b>${saidas}</b><span>saídas da prova</span></div></div>
      <p class="pequeno">Na demonstração, a resposta escrita é corrigida por palavras-chave (na prova de verdade, o professor ou a IA corrige).</p></section>
    ${linhas.map(({ x, c }, i) => `<article class="card dm-res-q"><div class="q-topo"><span class="q-numero">Questão ${i + 1}</span><span class="tag ${rot[c.status][0]}">${rot[c.status][1]} · ${c.pontos}/1</span>
        ${x.adaptada ? `<span class="tag nota">${FORMATOS[x.q.formato]?.icone || "♿"} ${esc(FORMATOS[x.q.formato]?.nome || "adaptada")}</span>` : ""}</div>
      <div class="dm-compara${x.adaptada ? "" : " so-uma"}">
        ${x.adaptada ? `<div class="dm-col"><span class="dm-rot">📄 Original</span><p>${esc(x.o.enunciado)}</p>${x.o.alternativas ? `<ol type="A">${x.o.alternativas.map(a => `<li>${esc(a)}</li>`).join("")}</ol>` : ""}</div>` : ""}
        <div class="dm-col adapt"><span class="dm-rot">${x.adaptada ? "♿ Como o aluno viu" : "📄 Questão"}</span><p>${negrito(x.q.enunciado)}</p>
          ${opcoesAdaptadas(x)}
          ${x.adaptada && x.motivo ? `<p class="pequeno">💭 <b>Por que adaptar assim:</b> ${esc(x.motivo)}</p>` : ""}</div></div>
      <p><b>Resposta:</b> ${sua(x, respostas[x.o.id])}</p>
      ${c.status !== "certa" ? `<p><b>Resposta certa:</b> ${certa(x)}</p>` : ""}
      <div class="feedback ${c.status === "certa" ? "certa" : "errada"}"><span class="icone" aria-hidden="true">💡</span><div><b>Por quê:</b> ${esc(x.o.explicacao)}</div></div></article>`).join("")}`;
  $("#dmDeNovo").onclick = () => comecar(perfil.id);
  $("#dmOutro").onclick = telaEscolha;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

telaEscolha();
