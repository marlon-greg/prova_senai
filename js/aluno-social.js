// Parte social (2ª parte, só com config/gamificacao.social ligado): o aluno escolhe o que mostrar na VITRINE
// (conquistas e, se o admin permitir e ele quiser, notas). Colegas da mesma turma veem no MURAL e reagem
// com ❤️ curtida ou 👏 parabéns — sem comentários. Sem marcar nada, o aluno não aparece para ninguém.
import { db, esc, $, toast, modal, traduzirErro } from "./common.js";
import { svgAvatar } from "./avatar.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

async function minhaTurma(eu) {
  const s = await getDocs(query(collection(db, "turmas"), where("emails", "array-contains", eu.email.toLowerCase()))).catch(() => null);
  return s?.docs[0]?.id || null;
}

// botões no cartão do perfil
export function botoesSocial(box, { eu, cq, gami, perfil, simulacao }) {
  if (!gami.social || !box) return;
  const acoes = box.querySelector(".pa-info .acoes");
  acoes.insertAdjacentHTML("beforeend", `<button type="button" class="leve" data-soc="mostrar">🔓 O que eu mostro</button><button type="button" class="leve" data-soc="mural">❤️ Mural da turma</button>`);
  acoes.querySelector("[data-soc=mostrar]").onclick = () => escolherVitrine({ eu, cq, gami, perfil, simulacao });
  acoes.querySelector("[data-soc=mural]").onclick = () => abrirMural({ eu, simulacao });
}

async function escolherVitrine({ eu, cq, gami, perfil, simulacao }) {
  const atual = simulacao ? JSON.parse(localStorage.getItem("sim:vitrine") || "null") : (await getDoc(doc(db, "vitrine", eu.uid)).catch(() => null))?.data();
  const marcadas = new Set((atual?.conquistas || []).map(c => c.t)), notasMarc = new Set((atual?.notas || []).map(n => n.id));
  const provas = (cq?.provas || []).filter(p => Number.isFinite(p.nota));
  const html = `<p class="pequeno" style="margin-top:0">Escolha o que os colegas da sua turma podem ver no mural. <b>O que você não marcar, ninguém vê.</b> Você pode mudar ou tirar tudo quando quiser.</p>
    <h3 class="conq-h3">🏅 Conquistas</h3><div class="lista-temas">${(cq?.ganhas || []).map(m => `<label class="check"><input type="checkbox" data-c="${esc(m.t)}"${marcadas.has(m.t) ? " checked" : ""}> <span>${m.e} ${esc(m.t)}</span></label>`).join("") || `<p class="pequeno">Você ainda não tem conquistas.</p>`}</div>
    ${gami.socialNotas ? `<h3 class="conq-h3">📊 Notas <span class="pequeno">(opcional)</span></h3><div class="lista-temas">${provas.map(p => `<label class="check"><input type="checkbox" data-n="${esc(p.id)}"${notasMarc.has(p.id) ? " checked" : ""}> <span>${esc(p.titulo)}${p.materia ? ` · ${esc(p.materia)}` : ""}: <b>${Math.round(p.nota)}</b></span></label>`).join("") || `<p class="pequeno">Nenhuma nota ainda.</p>`}</div>` : ""}
    <p class="pequeno">No mural aparece só o seu personagem, ${esc(perfil?.apelido || String(eu.nome || "").split(/\s+/)[0])} e o que você marcar.</p>`;
  await modal({ titulo: "🔓 O que eu mostro no mural", conteudo: html, ok: "Salvar", cancelar: "Cancelar", largo: true,
    antesDeConfirmar: async c => {
      const conquistas = (cq?.ganhas || []).filter(m => c.querySelector(`[data-c="${CSS.escape(m.t)}"]`)?.checked).map(m => ({ e: m.e, t: m.t }));
      const notas = gami.socialNotas ? provas.filter(p => c.querySelector(`[data-n="${CSS.escape(p.id)}"]`)?.checked).map(p => ({ id: p.id, titulo: p.titulo, materia: p.materia || "", nota: Math.round(p.nota) })) : [];
      const dados = { nome: String(eu.nome || "").split(/\s+/)[0], apelido: perfil?.apelido || "", avatar: perfil?.avatar || null, status: perfil?.status || "", turmaId: simulacao ? "sim" : await minhaTurma(eu),
        conquistas, notas, nivel: cq?.nivel || 1, atualizadoEm: serverTimestamp() };
      try {
        if (simulacao) localStorage.setItem("sim:vitrine", JSON.stringify({ ...dados, atualizadoEm: null }));
        else if (!conquistas.length && !notas.length) await deleteDoc(doc(db, "vitrine", eu.uid));   // nada marcado: some do mural
        else await setDoc(doc(db, "vitrine", eu.uid), dados);
      } catch (e) { toast(traduzirErro(e), "erro"); return false; }
      toast(conquistas.length || notas.length ? "Pronto! Seus colegas veem só o que você marcou." : "Você não aparece mais no mural.", "ok"); return true;
    } });
}

async function abrirMural({ eu, simulacao }) {
  let itens = [];
  if (simulacao) { const v = JSON.parse(localStorage.getItem("sim:vitrine") || "null"); if (v) itens = [{ uid: eu.uid, ...v, reacoes: [] }]; }
  else {
    const turma = await minhaTurma(eu);
    if (!turma) return toast("Não achei a sua turma.", "erro");
    const s = await getDocs(query(collection(db, "vitrine"), where("turmaId", "==", turma))).catch(e => { toast(traduzirErro(e), "erro"); return null; });
    itens = await Promise.all((s?.docs || []).map(async d => ({ uid: d.id, ...d.data(), reacoes: (await getDocs(collection(db, "vitrine", d.id, "reacoes")).catch(() => null))?.docs.map(r => ({ de: r.id, ...r.data() })) || [] })));
  }
  const html = `<p class="pequeno" style="margin-top:0">Só aparece quem escolheu mostrar alguma coisa. Sem comentários: só ❤️ e 👏.</p><div id="muralLista" class="mural"></div>`;
  const desenhar = c => {
    $("#muralLista", c).innerHTML = itens.length ? itens.map(v => {
      const minha = v.reacoes.find(r => r.de === eu.uid), cur = v.reacoes.filter(r => r.tipo === "curtida").length, par = v.reacoes.filter(r => r.tipo === "parabens").length, eu_ = v.uid === eu.uid;
      return `<article class="mural-item"><div class="mi-av">${svgAvatar(v.avatar, 84)}</div><div class="mi-info"><b>${esc(v.apelido || v.nome)}</b>${eu_ ? ` <span class="tag">você</span>` : ""} <span class="pequeno">nível ${v.nivel || 1}</span>${v.status ? ` <span class="tag">${esc(v.status)}</span>` : ""}
        <div class="mi-conq">${(v.conquistas || []).map(m => `<span class="tag" title="${esc(m.t)}">${m.e} ${esc(m.t)}</span>`).join("")}</div>
        ${(v.notas || []).length ? `<div class="mi-conq">${v.notas.map(n => `<span class="tag nota">📊 ${esc(n.titulo)}${n.materia ? ` (${esc(n.materia)})` : ""}: ${n.nota}</span>`).join("")}</div>` : ""}
        <div class="mi-reacoes">${eu_ ? `<span class="pequeno">❤️ ${cur} · 👏 ${par}</span>` : `<button type="button" class="leve mini${minha?.tipo === "curtida" ? " sel" : ""}" data-r="curtida" data-u="${v.uid}">❤️ ${cur}</button><button type="button" class="leve mini${minha?.tipo === "parabens" ? " sel" : ""}" data-r="parabens" data-u="${v.uid}">👏 Parabéns · ${par}</button>`}</div></div></article>`;
    }).join("") : `<div class="vazio"><div class="icone">❤️</div><p>Ninguém da turma mostrou nada ainda. Que tal ser o primeiro? Use <b>🔓 O que eu mostro</b>.</p></div>`;
    c.querySelectorAll("[data-r]").forEach(b => b.onclick = async () => {
      const v = itens.find(x => x.uid === b.dataset.u), minha = v.reacoes.find(r => r.de === eu.uid);
      try {
        if (minha?.tipo === b.dataset.r) { await deleteDoc(doc(db, "vitrine", v.uid, "reacoes", eu.uid)); v.reacoes = v.reacoes.filter(r => r.de !== eu.uid); }
        else { await setDoc(doc(db, "vitrine", v.uid, "reacoes", eu.uid), { tipo: b.dataset.r, item: "perfil", em: serverTimestamp() }); v.reacoes = [...v.reacoes.filter(r => r.de !== eu.uid), { de: eu.uid, tipo: b.dataset.r }]; }
        desenhar(c);
      } catch (e) { toast(traduzirErro(e), "erro"); }
    });
  };
  modal({ titulo: "❤️ Mural da turma", conteudo: html, ok: "Fechar", largo: true, aoAbrir: desenhar });
}
