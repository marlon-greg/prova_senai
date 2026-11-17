// Página do aluno: barra de seções (Somativas · Resultados · Estudos · Turma · Perfil).
// No computador fica no topo (abaixo do cabeçalho); no celular fica FIXA EMBAIXO da tela (css/aluno-nav.css).
// Cada item mostra só a sua seção (sem rolar a página); lembra a última aba (localStorage) e usa o endereço (#somativas…)
// para o botão voltar do navegador funcionar. A barra só aparece na lista (body.com-abas): na prova, no início,
// no fim e no resultado ela some (a prova tem regras de saída e vidas).
export const ABAS = [
  { id: "somativas", e: "📝", t: "Somativas" },
  { id: "resultados", e: "📊", t: "Resultados" },
  { id: "estudos", e: "📚", t: "Estudos" },
  { id: "turma", e: "👥", t: "Turma" },
  { id: "perfil", e: "👤", t: "Perfil" }
];
const CHAVE = "aluno:aba";
let atual = "", visiveis = new Set(ABAS.map(a => a.id)), aoMudar = null, iniciada = false;
const nav = () => document.getElementById("abasAluno");
const valida = id => ABAS.some(a => a.id === id) && visiveis.has(id);
const doEndereco = () => decodeURIComponent(location.hash.replace(/^#/, ""));

function desenharBarra() {
  const n = nav(); if (!n) return;
  n.innerHTML = ABAS.map(a => `<button type="button" class="aba-aluno${a.id === atual ? " ativa" : ""}" data-aba="${a.id}"${a.id === atual ? ` aria-current="page"` : ""}${visiveis.has(a.id) ? "" : " hidden"}>
    <span class="aa-e" aria-hidden="true">${a.e}</span><span class="aa-t">${a.t}</span></button>`).join("");
}
// mostra a seção (sem mexer no endereço)
function aplicar(id, { rolar = true } = {}) {
  if (!valida(id)) id = "somativas";
  const mudou = id !== atual;
  atual = id;
  document.querySelectorAll("[data-secao]").forEach(s => s.classList.toggle("oculto", s.dataset.secao !== id));
  nav()?.querySelectorAll("[data-aba]").forEach(b => { const on = b.dataset.aba === id; b.classList.toggle("ativa", on); on ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"); });
  try { localStorage.setItem(CHAVE, id); } catch (e) { /* só não lembra */ }
  if (rolar && !document.getElementById("telaProvas")?.classList.contains("oculto")) window.scrollTo({ top: 0 });
  if (mudou || rolar) aoMudar?.(id);
}
// vai para a aba e grava no histórico (o botão voltar volta para a aba anterior)
export function irParaAba(id) {
  if (!valida(id)) return;
  if (doEndereco() !== id) location.hash = id;   // o hashchange chama aplicar
  else aplicar(id);
}
export const abaAtual = () => atual;

// opc.aoMudar(id) = chamado quando uma aba aparece (ex.: recarregar o mural da Turma)
export function iniciarAbas(opc = {}) {
  aoMudar = opc.aoMudar || aoMudar;
  if (iniciada) return;
  iniciada = true;
  desenharBarra();
  nav()?.addEventListener("click", e => { const b = e.target.closest("[data-aba]"); if (b) irParaAba(b.dataset.aba); });
  // botão voltar/avançar: troca a seção só se a lista estiver na tela (durante a prova nada muda)
  addEventListener("hashchange", () => { const id = doEndereco(); if (ABAS.some(a => a.id === id)) aplicar(id); });
  // a barra fica logo abaixo do cabeçalho (que pode quebrar em duas linhas)
  const altura = () => document.documentElement.style.setProperty("--altura-cab", (document.querySelector("header")?.offsetHeight || 64) + "px");
  altura(); addEventListener("resize", altura);
  let inicial = doEndereco();
  if (!ABAS.some(a => a.id === inicial)) { try { inicial = localStorage.getItem(CHAVE) || ""; } catch (e) { inicial = ""; } }
  if (!ABAS.some(a => a.id === inicial)) inicial = "somativas";
  // grava a aba no endereço sem criar uma entrada nova no histórico (não troca links como #simPainel)
  if (!doEndereco() || ABAS.some(a => a.id === doEndereco())) history.replaceState(history.state, "", `${location.pathname}${location.search}#${inicial}`);
  aplicar(inicial, { rolar: false });
}
// esconde abas que não valem para este aluno (ex.: Turma com a parte social desligada)
export function definirAbasVisiveis(ids) {
  visiveis = new Set(["somativas", ...ids]);
  desenharBarra();
  if (!visiveis.has(atual)) { if (ABAS.some(a => a.id === doEndereco())) history.replaceState(history.state, "", `${location.pathname}${location.search}#somativas`); aplicar("somativas", { rolar: false }); }
  else aplicar(atual, { rolar: false });
}
