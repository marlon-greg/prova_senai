// Desenho dos formatos de questão adaptada (prova do aluno e prévia no painel). Regras em servidor/formatos.js.
// montarFormato(area, q, { aoMudar, chave }) -> { valor(): resposta | null, preencher(v), travar() }
//   chave (só no painel) = gabarito privado: a prévia mostra a resposta certa.
import { FORMATOS } from "../servidor/formatos.js";
export { FORMATOS, FORMATOS_INTERATIVOS, temFormato, textoResposta, textoChave } from "../servidor/formatos.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LETRAS = "ABCDEFGH";
const CORES = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#dc2626"];

export const rotuloFormato = q => ({ menosAlt: "Escolha uma alternativa", vf: "Marque V (verdadeiro) ou F (falso) em cada frase", ligar: "Toque num item da esquerda e depois no par dele na direita",
  lacunas: "Escolha a palavra de cada espaço", ordenar: "Use ↑ e ↓ para pôr os passos na ordem certa", etapas: "Responda uma etapa de cada vez" }[q.formato] || "Sua resposta");
export const textoParaFalar = q => {
  const d = q.dados || {};
  if (q.formato === "menosAlt") return d.alternativas.map((a, i) => `Alternativa ${LETRAS[i]}: ${a}.`).join(" ");
  if (q.formato === "vf") return d.afirmacoes.map((a, i) => `Frase ${i + 1}: ${a}.`).join(" ");
  if (q.formato === "ligar") return `Coluna da esquerda: ${d.esquerda.map((a, i) => `${i + 1}, ${a}`).join("; ")}. Coluna da direita: ${d.direita.map((a, i) => `${LETRAS[i]}, ${a}`).join("; ")}.`;
  if (q.formato === "lacunas") return `${String(d.texto).replace(/\[\[\d+\]\]/g, " espaço em branco ")}. Palavras: ${d.banco.join(", ")}.`;
  if (q.formato === "ordenar") return d.passos.map((p, i) => `Passo ${i + 1}: ${p}.`).join(" ");
  if (q.formato === "etapas") return d.etapas.map((e, i) => `Etapa ${i + 1}: ${e.pergunta}. ${e.alternativas.map((a, k) => `${LETRAS[k]}: ${a}`).join(". ")}.`).join(" ");
  return "";
};

export function montarFormato(area, q, { aoMudar = () => {}, chave = null, nome = "f" } = {}) {
  const d = q.dados || {}, k = chave?.chave || null;
  let travado = false, mexeu = false;
  const muda = () => { mexeu = true; aoMudar(); };
  area.classList.add("fmt", "fmt-" + q.formato);

  if (q.formato === "menosAlt") {
    area.innerHTML = d.alternativas.map((a, i) => `<label class="alt${k && k.correta === i ? " gab-certa" : ""}"><input type="radio" name="${nome}" value="${i}"><span class="alt-letra">${LETRAS[i]}</span><span class="alt-texto">${esc(a)}</span></label>`).join("");
    area.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => { area.querySelectorAll(".alt").forEach(x => x.classList.toggle("sel", x.contains(inp))); muda(); }));
    return { valor: () => { const m = area.querySelector("input:checked"); return m ? Number(m.value) : null; },
      preencher: v => area.querySelectorAll("input").forEach(inp => { inp.checked = v !== null && Number(inp.value) === Number(v); inp.closest(".alt").classList.toggle("sel", inp.checked); }),
      travar: () => { travado = true; area.querySelectorAll("input").forEach(i => i.disabled = true); } };
  }

  if (q.formato === "vf") {
    const val = d.afirmacoes.map(() => null);
    area.innerHTML = `<div class="vf-lista">${d.afirmacoes.map((a, i) => `<div class="vf-linha" data-i="${i}"><span class="vf-n">${i + 1}</span><span class="vf-texto">${esc(a)}</span>
      <span class="vf-botoes" role="radiogroup" aria-label="Frase ${i + 1}"><button type="button" class="vf-b v" data-v="1" aria-pressed="false">V</button><button type="button" class="vf-b f" data-v="0" aria-pressed="false">F</button></span>
      ${k ? `<span class="tag ${k.valores[i] ? "ok" : "erro"}">gabarito: ${k.valores[i] ? "V" : "F"}</span>` : ""}</div>`).join("")}</div>`;
    const pintar = () => area.querySelectorAll(".vf-linha").forEach(l => { const i = Number(l.dataset.i); l.querySelectorAll(".vf-b").forEach(b => { const on = val[i] === (b.dataset.v === "1"); b.classList.toggle("sel", on); b.setAttribute("aria-pressed", on); }); });
    area.querySelectorAll(".vf-b").forEach(b => b.onclick = () => { if (travado) return; const i = Number(b.closest(".vf-linha").dataset.i), v = b.dataset.v === "1"; val[i] = val[i] === v ? null : v; pintar(); muda(); });
    return { valor: () => val.some(x => x !== null) ? [...val] : null, preencher: v => { (v || []).forEach((x, i) => val[i] = x ?? null); pintar(); },
      travar: () => { travado = true; area.querySelectorAll("button").forEach(b => b.disabled = true); } };
  }

  if (q.formato === "ligar") {
    const pares = d.esquerda.map(() => null); let sel = null;
    area.innerHTML = `<div class="ligar"><div class="lig-col">${d.esquerda.map((t, i) => `<button type="button" class="lig-item esq" data-e="${i}"><span class="lig-n">${i + 1}</span><span class="lig-t">${esc(t)}</span><span class="lig-par"></span></button>`).join("")}</div>
      <div class="lig-col">${d.direita.map((t, j) => `<button type="button" class="lig-item dir" data-d="${j}"><span class="lig-n">${LETRAS[j]}</span><span class="lig-t">${esc(t)}</span><span class="lig-par"></span></button>`).join("")}</div></div>
      ${k ? `<p class="pequeno gab-texto">Gabarito: ${d.esquerda.map((t, i) => `${i + 1}→${LETRAS[k.pares[i]]}`).join(" · ")}</p>` : ""}`;
    const pintar = () => {
      area.querySelectorAll(".esq").forEach(b => { const i = Number(b.dataset.e), p = pares[i]; b.classList.toggle("ativo", sel === i); b.classList.toggle("feito", p !== null);
        b.style.setProperty("--cor", p !== null ? CORES[i % CORES.length] : ""); b.querySelector(".lig-par").textContent = p !== null ? `→ ${LETRAS[p]}` : ""; b.setAttribute("aria-pressed", sel === i); });
      area.querySelectorAll(".dir").forEach(b => { const j = Number(b.dataset.d), i = pares.indexOf(j); b.classList.toggle("feito", i >= 0);
        b.style.setProperty("--cor", i >= 0 ? CORES[i % CORES.length] : ""); b.querySelector(".lig-par").textContent = i >= 0 ? `← ${i + 1}` : ""; b.classList.toggle("alvo", sel !== null); });
    };
    area.querySelectorAll(".esq").forEach(b => b.onclick = () => { if (travado) return; const i = Number(b.dataset.e); sel = sel === i ? null : i; pintar(); });
    area.querySelectorAll(".dir").forEach(b => b.onclick = () => {
      if (travado || sel === null) return;
      const j = Number(b.dataset.d), antes = pares.indexOf(j);
      if (pares[sel] === j) pares[sel] = null; else { if (antes >= 0) pares[antes] = null; pares[sel] = j; }
      sel = null; pintar(); muda();
    });
    pintar();
    return { valor: () => pares.some(x => x !== null) ? [...pares] : null, preencher: v => { (v || []).forEach((x, i) => pares[i] = x ?? null); pintar(); },
      travar: () => { travado = true; area.querySelectorAll("button").forEach(b => b.disabled = true); } };
  }

  if (q.formato === "lacunas") {
    const n = (String(d.texto).match(/\[\[\d+\]\]/g) || []).length;
    area.innerHTML = `<div class="lac-banco" aria-label="Palavras para usar">${d.banco.map(p => `<span class="lac-palavra">${esc(p)}</span>`).join("")}</div>
      <p class="lac-texto">${esc(d.texto).replace(/\[\[(\d+)\]\]/g, (_, i) => `<select class="lac-sel" data-i="${i - 1}" aria-label="Espaço ${i}"><option value="">— ${i} —</option>${d.banco.map(p => `<option>${esc(p)}</option>`).join("")}</select>${k ? `<span class="tag ok">${esc(k.respostas[i - 1])}</span>` : ""}`).replace(/\n/g, "<br>")}</p>`;
    const sels = [...area.querySelectorAll(".lac-sel")];
    const marcarUsadas = () => { const us = sels.map(s => s.value); area.querySelectorAll(".lac-palavra").forEach(p => p.classList.toggle("usada", us.includes(p.textContent))); };
    sels.forEach(s => s.onchange = () => { s.classList.toggle("ok", !!s.value); marcarUsadas(); muda(); });
    return { valor: () => sels.some(s => s.value) ? sels.map(s => s.value || null) : null,
      preencher: v => { sels.forEach((s, i) => { s.value = v?.[i] || ""; s.classList.toggle("ok", !!s.value); }); marcarUsadas(); },
      travar: () => { travado = true; sels.forEach(s => s.disabled = true); }, total: n };
  }

  if (q.formato === "ordenar") {
    let ordem = d.passos.map((_, i) => i);
    const desenhar = () => {
      area.innerHTML = `<ol class="ord-lista">${ordem.map((i, pos) => `<li class="ord-item"><span class="ord-n">${pos + 1}</span><span class="ord-t">${esc(d.passos[i])}</span>
        <span class="ord-bts"><button type="button" class="leve mini" data-sobe="${pos}" ${pos === 0 || travado ? "disabled" : ""} aria-label="Subir: ${esc(d.passos[i])}">↑</button><button type="button" class="leve mini" data-desce="${pos}" ${pos === ordem.length - 1 || travado ? "disabled" : ""} aria-label="Descer: ${esc(d.passos[i])}">↓</button></span></li>`).join("")}</ol>
        ${!mexeu && !travado ? `<button type="button" class="leve mini ord-ok">✓ Esta já é a minha ordem</button>` : ""}
        ${k ? `<p class="pequeno gab-texto">Ordem certa: ${k.ordem.map(i => esc(d.passos[i])).join(" → ")}</p>` : ""}`;
      area.querySelectorAll("[data-sobe]").forEach(b => b.onclick = () => { const p = Number(b.dataset.sobe); [ordem[p - 1], ordem[p]] = [ordem[p], ordem[p - 1]]; mexeu = true; desenhar(); muda(); area.querySelector(`[data-sobe="${p - 1}"]`)?.focus(); });
      area.querySelectorAll("[data-desce]").forEach(b => b.onclick = () => { const p = Number(b.dataset.desce); [ordem[p + 1], ordem[p]] = [ordem[p], ordem[p + 1]]; mexeu = true; desenhar(); muda(); area.querySelector(`[data-desce="${p + 1}"]`)?.focus(); });
      area.querySelector(".ord-ok")?.addEventListener("click", () => { mexeu = true; desenhar(); muda(); });
    };
    desenhar();
    return { valor: () => mexeu ? [...ordem] : null, preencher: v => { if (Array.isArray(v) && v.length === ordem.length) { ordem = v.map(Number); mexeu = true; } desenhar(); },
      travar: () => { travado = true; desenhar(); } };
  }

  if (q.formato === "etapas") {
    const val = d.etapas.map(() => null);
    area.innerHTML = d.etapas.map((e, i) => `<fieldset class="etapa" data-i="${i}"><legend><span class="etapa-n">Etapa ${i + 1} de ${d.etapas.length}</span> ${esc(e.pergunta)}</legend>
      ${e.alternativas.map((a, j) => `<label class="alt${k && k.corretas[i] === j ? " gab-certa" : ""}"><input type="radio" name="${nome}_e${i}" value="${j}"><span class="alt-letra">${LETRAS[j]}</span><span class="alt-texto">${esc(a)}</span></label>`).join("")}</fieldset>`).join("");
    area.querySelectorAll("fieldset").forEach(fs => fs.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
      const i = Number(fs.dataset.i); val[i] = Number(inp.value); fs.querySelectorAll(".alt").forEach(x => x.classList.toggle("sel", x.contains(inp))); fs.classList.add("respondida"); muda();
    })));
    return { valor: () => val.some(x => x !== null) ? [...val] : null,
      preencher: v => (v || []).forEach((x, i) => { const fs = area.querySelector(`fieldset[data-i="${i}"]`); fs.querySelectorAll("input").forEach(inp => { inp.checked = x !== null && Number(inp.value) === x; inp.closest(".alt").classList.toggle("sel", inp.checked); }); val[i] = x ?? null; if (x !== null) fs.classList.add("respondida"); }),
      travar: () => { travado = true; area.querySelectorAll("input").forEach(i => i.disabled = true); } };
  }
  area.innerHTML = `<p class="pequeno">Formato desconhecido.</p>`;
  return { valor: () => null, preencher: () => {}, travar: () => {} };
}
