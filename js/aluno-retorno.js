// Página do aluno: 🚩 apontamento numa questão e 💡 sugestões para o sistema, com a resposta da equipe.
import { db, esc, $, toast, modal, traduzirErro, dataBR } from "./common.js";
import { cardCab, collapsible } from "./ui.js";
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const TIPOS_AP = { duasCertas: "Tem mais de uma resposta certa", nenhumaCerta: "Nenhuma resposta parece certa", erroTexto: "Erro de digitação ou no texto",
  confusa: "Não entendi o enunciado", gabarito: "Acho que o gabarito está errado", outro: "Outra coisa" };

// eu = { uid, email, nome }; info = { provaId, provaTitulo, qid, enunciado }; simulacao = não grava
export async function apontar(eu, info, simulacao = false) {
  let tipo = null;
  const html = `<p class="pequeno" style="margin-top:0">Achou algo estranho nesta questão? Conte para o professor. <b>Isso não muda a sua resposta nem a sua nota</b>: ele confere depois e te responde aqui no site.</p>
    <div class="op-pilulas op-motivos" role="radiogroup" aria-label="O que aconteceu">${Object.entries(TIPOS_AP).map(([k, t]) => `<button type="button" role="radio" aria-checked="false" data-t="${k}">${esc(t)}</button>`).join("")}</div>
    <label for="apTexto" style="margin-top:10px">Explique (o que você viu)</label><textarea id="apTexto" maxlength="2000" style="min-height:90px" placeholder="Ex.: as alternativas B e D dizem a mesma coisa."></textarea>`;
  return modal({ titulo: "🚩 Algo errado nesta questão?", conteudo: html, ok: "Enviar para o professor", cancelar: "Cancelar", largo: true,
    aoAbrir: c => c.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { tipo = b.dataset.t; c.querySelectorAll("[data-t]").forEach(x => { x.classList.toggle("sel", x === b); x.setAttribute("aria-checked", x === b); }); }),
    antesDeConfirmar: async c => {
      const texto = $("#apTexto", c).value.trim();
      if (!tipo) { toast("Escolha o que aconteceu.", "erro"); return false; }
      if (simulacao) { toast("🧪 Simulação: o apontamento não foi enviado.", "info"); return true; }
      try { await addDoc(collection(db, "apontamentos"), { uid: eu.uid, email: eu.email.toLowerCase(), nome: eu.nome || "", provaId: info.provaId, provaTitulo: info.provaTitulo || "",
        qid: info.qid, enunciado: String(info.enunciado || "").slice(0, 800), tipo, texto: texto.slice(0, 2000), status: "aberto", criadoEm: serverTimestamp() }); }
      catch (e) { toast(traduzirErro(e), "erro"); return false; }
      toast("Enviado! O professor vai conferir. 👍", "ok"); return true;
    } });
}

const CATEGORIAS = ["Ideia nova", "Algo não funcionou", "Ficou difícil de usar", "Acessibilidade", "Outro"];
export async function desenharFaleConosco(box, eu, cfg, simulacao = false) {
  if (!box) return;
  if (!cfg.sugestoes && !cfg.apontamentos) { box.classList.add("oculto"); return; }
  let meus = [];
  if (!simulacao) try {
    const [a, s] = await Promise.all([cfg.apontamentos ? getDocs(query(collection(db, "apontamentos"), where("uid", "==", eu.uid))) : null, cfg.sugestoes ? getDocs(query(collection(db, "sugestoesSistema"), where("uid", "==", eu.uid))) : null]);
    meus = [...(a?.docs || []).map(d => ({ ap: true, ...d.data() })), ...(s?.docs || []).map(d => d.data())].sort((x, y) => (y.criadoEm?.seconds || 0) - (x.criadoEm?.seconds || 0));
  } catch (e) { console.warn("fale conosco", e); }
  box.classList.remove("oculto");
  const aguardando = meus.filter(m => ["aberto", "aberta"].includes(m.status)).length, respondidas = meus.filter(m => m.resposta).length;
  box.innerHTML = cardCab({ titulo: "💬 Fale com a equipe",
      ajuda: !meus.length ? "" : `<p>${cfg.apontamentos ? "Viu um problema numa questão? Use o botão <b>🚩</b> na própria questão (na prova ou no gabarito). " : ""}${cfg.sugestoes ? "Tem uma ideia para o sistema ou algo não funcionou? Mande uma sugestão." : ""}</p>`,
      primaria: cfg.sugestoes ? `<button type="button" id="btnSugestao" class="leve">💡 Mandar uma sugestão</button>` : "" })
    + (meus.length ? "" : `<p class="pequeno" style="margin:0">${cfg.apontamentos ? "Achou algo errado numa questão? Toque em <b>🚩</b> nela. " : ""}${cfg.sugestoes ? "Ideias e problemas do site: <b>💡 Mandar uma sugestão</b>." : ""}</p>`)
    + (meus.length ? collapsible({ chave: "aluno:minhasMensagens", classe: "leve", titulo: `Minhas mensagens`,
      resumoHTML: `<span class="chip">${meus.length}</span>${aguardando ? `<span class="chip aviso">${aguardando} aguardando</span>` : ""}${respondidas ? `<span class="chip ok">${respondidas} com resposta</span>` : ""}`,
      corpoHTML: meus.map(m => `<div class="minha-msg"><span class="tag ${["aberto", "aberta"].includes(m.status) ? "aviso" : "ok"}">${m.ap ? "🚩" : "💡"} ${["aberto", "aberta"].includes(m.status) ? "aguardando" : esc(m.status === "procede" ? "você tinha razão!" : m.status === "nao-procede" ? "conferido" : m.status)}</span>
      <span class="pequeno">${dataBR(m.criadoEm)}${m.ap ? ` · ${esc(m.provaTitulo || "")}` : ""}</span><p style="margin:4px 0">${esc(m.ap ? TIPOS_AP[m.tipo] || "" : m.categoria || "")}${m.texto ? `: ${esc(m.texto)}` : ""}</p>
      ${m.resposta ? `<p class="ret-resp">↩ <b>${esc(m.respondidoPor || "Professor")}:</b> ${esc(m.resposta)}</p>` : ""}</div>`).join("") }) : "");
  $("#btnSugestao", box)?.addEventListener("click", () => {
    let cat = null;
    modal({ titulo: "💡 Sugestão para o sistema", conteudo: `<div class="op-pilulas" role="radiogroup" aria-label="Sobre o quê">${CATEGORIAS.map(c => `<button type="button" role="radio" aria-checked="false" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <label for="sgTexto" style="margin-top:10px">Conte para a gente</label><textarea id="sgTexto" maxlength="2000" style="min-height:110px"></textarea>`, ok: "Enviar", cancelar: "Cancelar", largo: true,
      aoAbrir: c => c.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { cat = b.dataset.c; c.querySelectorAll("[data-c]").forEach(x => { x.classList.toggle("sel", x === b); x.setAttribute("aria-checked", x === b); }); }),
      antesDeConfirmar: async c => {
        const texto = $("#sgTexto", c).value.trim();
        if (!cat || !texto) { toast("Escolha o assunto e escreva a sugestão.", "erro"); return false; }
        if (simulacao) { toast("🧪 Simulação: a sugestão não foi enviada.", "info"); return true; }
        try { await addDoc(collection(db, "sugestoesSistema"), { uid: eu.uid, email: eu.email.toLowerCase(), nome: eu.nome || "", categoria: cat, texto: texto.slice(0, 2000), status: "aberta", criadoEm: serverTimestamp() }); }
        catch (e) { toast(traduzirErro(e), "erro"); return false; }
        toast("Obrigado! Sua sugestão foi enviada. 💡", "ok"); desenharFaleConosco(box, eu, cfg); return true;
      } });
  });
}
