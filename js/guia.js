// Mascote guia (página do aluno): os 4 professores em versão cartoon — Marlin, DaniBoy, Feh e Xelxo.
// O aluno escolhe o mascote e pode desligar (fica guardado no navegador). Com ele desligado, a página
// mostra as regras em lista, como antes. Os desenhos estão em js/mascotes.js.
import { MASCOTES, svgMascote, CSS_MASCOTE } from "./mascotes.js";

const IDS = Object.keys(MASCOTES);

// CSS das animações do mascote (piscar, flutuar), uma vez por página
if (!document.getElementById("cssMascote")) {
  const st = document.createElement("style"); st.id = "cssMascote"; st.textContent = CSS_MASCOTE; document.head.append(st);
}

// ---------- preferências do aluno ----------
export const mascoteLigado = () => localStorage.getItem("mascote") !== "0";
export function ligarMascote(ligado) {
  localStorage.setItem("mascote", ligado ? "1" : "0");
  document.body.classList.toggle("sem-mascote", !ligado);
  if (!ligado) pararFala();
}
export function mascoteAtual() {
  let id = localStorage.getItem("mascoteId");
  if (!IDS.includes(id)) { id = IDS[Math.floor(Math.random() * IDS.length)]; localStorage.setItem("mascoteId", id); }   // sorteado na 1ª visita
  return id;
}
export function escolherMascote(id) { if (IDS.includes(id)) localStorage.setItem("mascoteId", id); }
export const dadosMascote = (id = mascoteAtual()) => ({ id, ...MASCOTES[id] });
document.body.classList.toggle("sem-mascote", !mascoteLigado());

// SVG do mascote dentro de um "palco" com a cor dele
export function htmlMascote(humor = "feliz", { id = mascoteAtual(), classe = "", animado = true } = {}) {
  const m = MASCOTES[id];
  return `<div class="mascote ${classe}${animado ? " mascote-anim" : ""}" style="--cor-mascote:${m.cor}" role="img" aria-label="${m.nome}, mascote da prova">${svgMascote(id, humor)}</div>`;
}

// escolha do mascote: 4 botões redondos com o rosto de cada um
export function htmlEscolha(atual = mascoteAtual()) {
  return `<div class="mascote-escolha" role="radiogroup" aria-label="Escolha o seu mascote guia">` + IDS.map(id => {
    const m = MASCOTES[id];
    return `<button type="button" class="mascote-opcao${id === atual ? " ativa" : ""}" role="radio" aria-checked="${id === atual}" data-mascote="${id}"
      style="--cor-mascote:${m.cor}" title="${m.nome} (prof. ${m.professor})"><span class="mascote-mini">${svgMascote(id, "feliz")}</span><span>${m.nome}</span></button>`;
  }).join("") + `</div>`;
}
export function ligarEscolha(box, aoEscolher) {
  box.querySelectorAll("[data-mascote]").forEach(b => b.onclick = () => {
    escolherMascote(b.dataset.mascote);
    box.querySelectorAll("[data-mascote]").forEach(x => { const on = x === b; x.classList.toggle("ativa", on); x.setAttribute("aria-checked", on); });
    aoEscolher?.(b.dataset.mascote);
  });
}

// ---------- leitura em voz alta (ajuda quem prefere ouvir) ----------
const temVoz = () => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const semTags = html => { const d = document.createElement("div"); d.innerHTML = html; return (d.textContent || "").replace(/[❤️🖤💔⭐🍀💪📖⏱🔑✅⛔]/gu, "").replace(/\s+/g, " ").trim(); };
export function falar(html, aoAcabar) {
  if (!temVoz()) return false;
  pararFala();
  const u = new SpeechSynthesisUtterance(semTags(html));
  u.lang = "pt-BR"; u.rate = 1;
  const voz = speechSynthesis.getVoices().find(v => /^pt(-|_)BR/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^pt/i.test(v.lang));
  if (voz) u.voice = voz;
  u.onend = u.onerror = () => aoAcabar?.();
  speechSynthesis.speak(u);
  return true;
}
export function pararFala() { if (temVoz()) speechSynthesis.cancel(); }

// ---------- guia passo a passo (balão de fala) ----------
// passos: [{ texto: html, humor }]. Monta no box: mascote + balão + ◀ ▶ + 🔊.
export function montarGuia(box, passos, { aoMudar } = {}) {
  let i = 0, lendo = false;
  const m = dadosMascote();
  box.innerHTML = `
    <div class="guia-palco">${htmlMascote(passos[0]?.humor || "feliz", { classe: "guia-mascote" })}</div>
    <div class="guia-fala">
      <div class="balao" aria-live="polite">
        <div class="balao-nome">${m.nome} <span>prof. ${m.professor}</span></div>
        <div class="balao-texto"></div>
      </div>
      <div class="guia-controles">
        <button type="button" class="leve mini" data-g="ant" aria-label="Fala anterior">◀</button>
        <span class="guia-pontos" aria-hidden="true"></span>
        <span class="guia-passo pequeno"></span>
        <button type="button" class="mini" data-g="prox">Próximo ▶</button>
        ${temVoz() ? `<button type="button" class="leve mini" data-g="voz" title="Ouvir esta fala" aria-label="Ouvir esta fala">🔊 Ouvir</button>` : ""}
      </div>
    </div>`;
  const desenhar = () => {
    const p = passos[i];
    box.querySelector(".guia-palco").innerHTML = htmlMascote(p.humor || "falando", { classe: "guia-mascote" });
    const txt = box.querySelector(".balao-texto");
    txt.innerHTML = p.texto;
    txt.classList.remove("entrando"); void txt.offsetWidth; txt.classList.add("entrando");
    box.querySelector(".guia-passo").textContent = `${i + 1} de ${passos.length}`;
    box.querySelector(".guia-pontos").innerHTML = passos.map((_, k) => `<i class="${k === i ? "on" : k < i ? "lido" : ""}"></i>`).join("");
    box.querySelector("[data-g=ant]").disabled = i === 0;
    const prox = box.querySelector("[data-g=prox]");
    prox.textContent = i === passos.length - 1 ? "Entendi! ✔" : "Próximo ▶";
    if (lendo) falar(p.texto, () => { lendo = false; marcarVoz(); });
    aoMudar?.(i, passos.length);
  };
  const marcarVoz = () => { const b = box.querySelector("[data-g=voz]"); if (b) { b.textContent = lendo ? "⏹ Parar" : "🔊 Ouvir"; b.classList.toggle("ativo", lendo); } };
  box.querySelector("[data-g=ant]").onclick = () => { if (i > 0) { i--; desenhar(); } };
  box.querySelector("[data-g=prox]").onclick = () => {
    if (i < passos.length - 1) { i++; desenhar(); return; }
    lendo = false; pararFala(); marcarVoz();
    box.dispatchEvent(new CustomEvent("guia-fim", { bubbles: true }));
  };
  const bv = box.querySelector("[data-g=voz]");
  if (bv) bv.onclick = () => {
    lendo = !lendo; marcarVoz();
    if (lendo) falar(passos[i].texto, () => { lendo = false; marcarVoz(); }); else pararFala();
  };
  // setas do teclado passam as falas (com o foco no guia)
  box.onkeydown = e => {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); box.querySelector("[data-g=prox]").click(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); box.querySelector("[data-g=ant]").click(); }
  };
  desenhar();
}
