// Parte social (2ª parte, só com config/gamificacao.social ligado): o aluno escolhe o que mostrar na VITRINE
// (conquistas e, se o admin permitir e ele quiser, notas). Só quem COMPARTILHA entra no MURAL da turma (estímulo a participar),
// e só vê colegas da MESMA turma (as regras do Firestore conferem). Reações: ❤️ curtida e 👏 parabéns, sem comentários.
// O status do dia vai junto e se atualiza sozinho; os status difíceis (triste, ansioso…) nunca vão para o mural: só a equipe vê.
// Na simulação da equipe (?simular=1) tudo funciona com colegas FICTÍCIOS e fica só no navegador.
import { db, esc, $, toast, modal, confirmar, traduzirErro } from "./common.js";
import { svgAvatar, avatarValido } from "./avatar.js";
import { ehDificil } from "./status-aluno.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const statusPublico = s => s && !ehDificil(s) ? s : "";
async function minhaTurma(eu) {
  const s = await getDocs(query(collection(db, "turmas"), where("emails", "array-contains", eu.email.toLowerCase()))).catch(() => null);
  return s?.docs[0]?.id || null;
}
// vitrine do próprio aluno (null = não compartilha)
async function lerMinhaVitrine(eu, simulacao) {
  const v = simulacao ? JSON.parse(localStorage.getItem("sim:vitrine") || "null") : (await getDoc(doc(db, "vitrine", eu.uid)).catch(() => null))?.data();
  return v && ((v.conquistas || []).length || (v.notas || []).length) ? v : null;
}
// trocou o status no perfil: atualiza o do mural (sem os difíceis)
export async function sincronizarStatus(eu, status, simulacao) {
  const novo = statusPublico(status);
  if (simulacao) { const v = JSON.parse(localStorage.getItem("sim:vitrine") || "null"); if (v) localStorage.setItem("sim:vitrine", JSON.stringify({ ...v, status: novo })); return; }
  if (!(await lerMinhaVitrine(eu, false))) return;
  await updateDoc(doc(db, "vitrine", eu.uid), { status: novo, atualizadoEm: serverTimestamp() }).catch(e => console.warn("status no mural", e));
}

// ---------- colegas fictícios da simulação ----------
const COLEGAS_SIM = [
  { uid: "sim-lucas", apelido: "Lucas", nivel: 4, status: "💻 Programando", av: { corpo: "masculino", cabelo: "topete", corCabelo: 1, pele: 2, olhos: "amendoado", roupa: "moletom", corRoupa: 1, fundo: "verde" },
    conquistas: [{ e: "🎓", t: "Primeira prova" }, { e: "🥇", t: "Trinca de ouro" }, { e: "⭐", t: "Mandou bem em Banco de Dados" }], notas: [{ id: "n1", titulo: "MS3 - DDL", materia: "Banco de Dados", nota: 92 }], cur: 5, par: 3 },
  { uid: "sim-julia", apelido: "Juh", nivel: 3, status: "📚 Estudando", av: { corpo: "feminino", cabelo: "cacheado", corCabelo: 0, pele: 4, olhos: "grandes", roupa: "listrada", corRoupa: 6, fundo: "rosa", oculos: "oculos" },
    conquistas: [{ e: "💯", t: "Gabaritou!" }, { e: "📈", t: "Em evolução" }], notas: [], cur: 8, par: 6 },
  { uid: "sim-pedro", apelido: "Pedro", nivel: 2, status: "🎮 Modo jogo", av: { corpo: "masculino", cabelo: "afrocurto", corCabelo: 0, pele: 5, olhos: "pesado", barba: "cavanhaque", roupa: "time", corRoupa: 2, fundo: "azul" },
    conquistas: [{ e: "🎓", t: "Primeira prova" }], notas: [], cur: 2, par: 1 },
  { uid: "sim-bia", apelido: "Bia", nivel: 5, status: "🚀 Motivado(a)", av: { corpo: "feminino", cabelo: "rabo", corCabelo: 3, pele: 0, olhos: "normal", roupa: "jaqueta", corRoupa: 5, fundo: "lilas", brinco: "argola" },
    conquistas: [{ e: "🏅", t: "Veterano" }, { e: "❤️", t: "Coração intacto" }, { e: "🧩", t: "Mestre em Lógica" }], notas: [{ id: "n2", titulo: "Lógica 2", materia: "Lógica", nota: 88 }], cur: 11, par: 9 }
].map(c => ({ ...c, avatar: avatarValido(c.av, Array.from({ length: 20 }, (_, i) => ({ id: "x" + i }))) }));
const reacoesSim = () => JSON.parse(localStorage.getItem("sim:reacoes") || "{}");

// botões no cartão do perfil
export function botoesSocial(box, { eu, cq, gami, perfil, simulacao }) {
  if (!gami.social || !box) return;
  const acoes = box.querySelector(".pa-info .acoes");
  acoes.insertAdjacentHTML("beforeend", `<button type="button" class="leve" data-soc="mostrar">🔓 O que eu mostro</button><button type="button" class="leve" data-soc="mural">❤️ Mural da turma</button>`);
  acoes.querySelector("[data-soc=mostrar]").onclick = () => escolherVitrine({ eu, cq, gami, perfil, simulacao });
  acoes.querySelector("[data-soc=mural]").onclick = () => abrirMural({ eu, cq, gami, perfil, simulacao });
}

async function escolherVitrine({ eu, cq, gami, perfil, simulacao, depois }) {
  const atual = await lerMinhaVitrine(eu, simulacao);
  const marcadas = new Set((atual?.conquistas || []).map(c => c.t)), notasMarc = new Set((atual?.notas || []).map(n => n.id));
  const provas = (cq?.provas || []).filter(p => Number.isFinite(p.nota));
  const st = statusPublico(perfil?.status);
  const secao = (n, titulo, dica, corpo) => `<section class="pc-secao"><div class="pc-secao-cab"><span class="pc-n">${n}</span><div class="pc-secao-tit"><h3>${titulo}</h3><span class="pequeno">${dica}</span></div></div>${corpo}</section>`;
  const caixa = (attr, marcado, conteudo) => `<label class="pc-fixa${marcado ? " sel" : ""}"><input type="checkbox" ${attr}${marcado ? " checked" : ""}><span class="pc-fixa-e">${conteudo}</label>`;
  const html = `<p class="pequeno" style="margin-top:0">Escolha o que os colegas da <b>sua turma</b> podem ver. <b>O que você não marcar, ninguém vê.</b> Só quem mostra alguma coisa entra no mural e vê o dos colegas.</p>
    ${secao(1, "🏅 Conquistas", "Marque as que quer mostrar.", (cq?.ganhas || []).length ? `<div class="pc-fixas">${cq.ganhas.map(m => caixa(`data-c="${esc(m.t)}"`, marcadas.has(m.t), `${m.e}</span><span>${esc(m.nivelNome || m.t)}</span>`)).join("")}</div>` : `<p class="pequeno">Você ainda não tem conquistas.</p>`)}
    ${gami.socialNotas ? secao(2, "📊 Notas", "Opcional: só aparece a nota que você marcar.", provas.length ? `<div class="pc-fixas">${provas.map(p => caixa(`data-n="${esc(p.id)}"`, notasMarc.has(p.id), `📊</span><span>${esc(p.titulo)}${p.materia ? ` · ${esc(p.materia)}` : ""}: <b>${Math.round(p.nota)}</b></span>`)).join("")}</div>` : `<p class="pequeno">Sem notas ainda.</p>`) : ""}
    ${secao(gami.socialNotas ? 3 : 2, "👀 Também aparece", "Sempre junto, para quem está no mural.", `<ul class="lista-mostra"><li>🧑 Seu personagem e ${esc(perfil?.apelido || String(eu.nome || "").split(/\s+/)[0])}</li><li>⭐ Seu nível</li><li>💬 O status do dia${st ? ` (agora: ${esc(st)})` : ""}: <b>triste, ansioso, estressado e parecidos nunca aparecem</b> (só a equipe vê)</li></ul>`)}`;
  await modal({ titulo: "🔓 O que eu mostro no mural", conteudo: html, ok: "Salvar", cancelar: "Cancelar", largo: true,
    aoAbrir: c => c.querySelectorAll(".pc-fixa input").forEach(i => i.onchange = () => i.closest(".pc-fixa").classList.toggle("sel", i.checked)),
    antesDeConfirmar: async c => {
      const conquistas = (cq?.ganhas || []).filter(m => c.querySelector(`[data-c="${CSS.escape(m.t)}"]`)?.checked).map(m => ({ e: m.e, t: m.t, ...(m.nivelNome ? { nome: m.nivelNome } : {}) }));
      const notas = gami.socialNotas ? provas.filter(p => c.querySelector(`[data-n="${CSS.escape(p.id)}"]`)?.checked).map(p => ({ id: p.id, titulo: p.titulo, materia: p.materia || "", nota: Math.round(p.nota) })) : [];
      const dados = { nome: String(eu.nome || "").split(/\s+/)[0], apelido: perfil?.apelido || "", avatar: perfil?.avatar || null, status: st, turmaId: simulacao ? "sim" : await minhaTurma(eu),
        conquistas, notas, nivel: cq?.nivel || 1, atualizadoEm: serverTimestamp() };
      if (atual && !conquistas.length && !notas.length && !(await confirmar("Sair do mural da turma? Os colegas deixam de ver o que você mostrava, e você deixa de ver o mural deles.", { titulo: "Sair do mural", ok: "Sair do mural", perigo: true }))) return false;
      try {
        if (simulacao) { if (!conquistas.length && !notas.length) localStorage.removeItem("sim:vitrine"); else localStorage.setItem("sim:vitrine", JSON.stringify({ ...dados, atualizadoEm: null })); }
        else if (!conquistas.length && !notas.length) await deleteDoc(doc(db, "vitrine", eu.uid));   // nada marcado: sai do mural
        else await setDoc(doc(db, "vitrine", eu.uid), dados);
      } catch (e) { toast(traduzirErro(e), "erro"); return false; }
      toast(conquistas.length || notas.length ? "Pronto! Você entrou no mural: os colegas veem só o que você marcou." : "Você saiu do mural (e não vê mais o dos colegas).", "ok"); return true;
    } });
  depois?.();
}

// cartão público (o que um colega vê ao abrir o perfil de alguém no mural)
const cartaoPublico = (v, eu_) => `<div class="perfil-publico"><div class="pp-av">${svgAvatar(v.avatar, 170)}</div>
  <div class="pp-info"><h2>${esc(v.apelido || v.nome)}${eu_ ? ` <span class="tag">você</span>` : ""}</h2><span class="pequeno">nível ${v.nivel || 1}</span>
    ${v.status ? `<div class="pp-status">${esc(v.status)}</div>` : ""}
    <h3 class="conq-h3">🏅 Conquistas que ${eu_ ? "você mostra" : "mostra"}</h3><div class="mi-conq">${(v.conquistas || []).map(m => `<span class="tag">${m.e} ${esc(m.nome || m.t)}</span>`).join("") || `<span class="pequeno">—</span>`}</div>
    ${(v.notas || []).length ? `<h3 class="conq-h3">📊 Notas que ${eu_ ? "você mostra" : "mostra"}</h3><div class="mi-conq">${v.notas.map(n => `<span class="tag nota">${esc(n.titulo)}${n.materia ? ` (${esc(n.materia)})` : ""}: ${n.nota}</span>`).join("")}</div>` : ""}
    <p class="pequeno pp-nota">🔒 Só isto aparece${eu_ ? " de você" : ""} para os colegas. Notas, provas, cartão, e-mail e o resto do perfil ficam privados.</p></div></div>`;

async function abrirMural({ eu, cq, gami, perfil, simulacao }) {
  const minha = await lerMinhaVitrine(eu, simulacao);
  // só quem compartilha entra
  if (!minha) {
    const ok = await modal({ titulo: "🔒 Mural da turma", conteudo: `<div class="mural-trava"><div class="mt-e">❤️🔒</div>
        <p><b>O mural é de quem participa.</b> Escolha pelo menos uma conquista para mostrar aos colegas e o mural da sua turma abre na hora.</p>
        <p class="pequeno">Você decide o que aparece e pode sair quando quiser. Quem não mostra nada também não vê o dos colegas.</p></div>`,
      ok: "🔓 Escolher o que mostro", cancelar: "Agora não" });
    if (ok) escolherVitrine({ eu, cq, gami, perfil, simulacao, depois: async () => { if (await lerMinhaVitrine(eu, simulacao)) abrirMural({ eu, cq, gami, perfil, simulacao }); } });
    return;
  }
  let itens = [];
  if (simulacao) {
    const r = reacoesSim();
    itens = [{ uid: eu.uid, ...minha, reacoes: [{ de: "sim-lucas", tipo: "curtida" }, { de: "sim-bia", tipo: "parabens" }] },
      ...COLEGAS_SIM.map(c => ({ ...c, reacoes: [...Array(c.cur).fill(0).map((_, i) => ({ de: "f" + i, tipo: "curtida" })), ...Array(c.par).fill(0).map((_, i) => ({ de: "g" + i, tipo: "parabens" })), ...(r[c.uid] ? [{ de: eu.uid, tipo: r[c.uid] }] : [])] }))];
  } else {
    const s = await getDocs(query(collection(db, "vitrine"), where("turmaId", "==", minha.turmaId))).catch(e => { toast(traduzirErro(e), "erro"); return null; });
    itens = await Promise.all((s?.docs || []).map(async d => ({ uid: d.id, ...d.data(), reacoes: (await getDocs(collection(db, "vitrine", d.id, "reacoes")).catch(() => null))?.docs.map(r => ({ de: r.id, ...r.data() })) || [] })));
  }
  itens.sort((a, b) => (b.uid === eu.uid) - (a.uid === eu.uid));
  const html = `${simulacao ? `<p class="aviso-sim">🧪 Simulação: os colegas são <b>fictícios</b> e as reações ficam só neste navegador.${gami.socialReal === false ? " Para os alunos de verdade a parte social está <b>desligada</b> (ligue em Gamificação)." : ""}</p>` : ""}
    <p class="pequeno" style="margin-top:0">Só aparece quem escolheu mostrar alguma coisa, e só da sua turma. Toque num colega para ver o perfil dele. Sem comentários: só ❤️ e 👏.</p><div id="muralLista" class="mural"></div>`;
  const desenhar = c => {
    $("#muralLista", c).innerHTML = itens.map((v, i) => {
      const minhaR = v.reacoes.find(r => r.de === eu.uid), cur = v.reacoes.filter(r => r.tipo === "curtida").length, par = v.reacoes.filter(r => r.tipo === "parabens").length, eu_ = v.uid === eu.uid;
      return `<article class="mural-item${eu_ ? " mi-eu" : ""}"><button type="button" class="mi-av" data-ver="${i}" title="Ver o perfil">${svgAvatar(v.avatar, 84)}</button><div class="mi-info"><button type="button" class="mi-nome" data-ver="${i}"><b>${esc(v.apelido || v.nome)}</b></button>${eu_ ? ` <span class="tag">você</span>` : ""} <span class="pequeno">nível ${v.nivel || 1}</span>${v.status ? ` <span class="tag">${esc(v.status)}</span>` : ""}
        <div class="mi-conq">${(v.conquistas || []).map(m => `<span class="tag" title="${esc(m.t)}">${m.e} ${esc(m.nome || m.t)}</span>`).join("")}</div>
        ${(v.notas || []).length ? `<div class="mi-conq">${v.notas.map(n => `<span class="tag nota">📊 ${esc(n.titulo)}${n.materia ? ` (${esc(n.materia)})` : ""}: ${n.nota}</span>`).join("")}</div>` : ""}
        <div class="mi-reacoes">${eu_ ? `<span class="pequeno">❤️ ${cur} · 👏 ${par}</span>` : `<button type="button" class="leve mini${minhaR?.tipo === "curtida" ? " sel" : ""}" data-r="curtida" data-u="${v.uid}">❤️ ${cur}</button><button type="button" class="leve mini${minhaR?.tipo === "parabens" ? " sel" : ""}" data-r="parabens" data-u="${v.uid}">👏 ${par}</button>`}</div></div></article>`;
    }).join("");
    c.querySelectorAll("[data-ver]").forEach(b => b.onclick = () => { const v = itens[b.dataset.ver]; modal({ titulo: v.uid === eu.uid ? "👀 Como os colegas me veem" : `👤 Perfil de ${v.apelido || v.nome}`, conteudo: cartaoPublico(v, v.uid === eu.uid), ok: "Fechar", largo: true }); });
    c.querySelectorAll("[data-r]").forEach(b => b.onclick = async () => {
      const v = itens.find(x => x.uid === b.dataset.u), minhaR = v.reacoes.find(r => r.de === eu.uid), tirar = minhaR?.tipo === b.dataset.r;
      try {
        if (simulacao) { const r = reacoesSim(); if (tirar) delete r[v.uid]; else r[v.uid] = b.dataset.r; localStorage.setItem("sim:reacoes", JSON.stringify(r)); }
        else if (tirar) await deleteDoc(doc(db, "vitrine", v.uid, "reacoes", eu.uid));
        else await setDoc(doc(db, "vitrine", v.uid, "reacoes", eu.uid), { tipo: b.dataset.r, item: "perfil", em: serverTimestamp() });
        v.reacoes = [...v.reacoes.filter(r => r.de !== eu.uid), ...(tirar ? [] : [{ de: eu.uid, tipo: b.dataset.r }])];
        desenhar(c);
      } catch (e) { toast(traduzirErro(e), "erro"); }
    });
  };
  modal({ titulo: "❤️ Mural da turma", conteudo: html, ok: "Fechar", largo: true, aoAbrir: desenhar });
}
