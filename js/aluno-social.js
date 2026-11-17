// Parte social (2ª parte, só com config/gamificacao.social ligado): o aluno escolhe o que mostrar na VITRINE
// (conquistas e, se o admin permitir e ele quiser, notas). Só quem COMPARTILHA entra no MURAL da turma (estímulo a participar),
// e só vê colegas da MESMA turma (as regras do Firestore conferem). Reações: ❤️ curtida e 👏 parabéns, sem comentários. O mural é a aba Turma (desenharTurma).
// O status do dia vai junto e se atualiza sozinho; os status difíceis (triste, ansioso…) nunca vão para o mural: só a equipe vê.
// Na simulação da equipe (?simular=1) tudo funciona com colegas FICTÍCIOS e fica só no navegador.
import { db, esc, $, toast, modal, confirmar, traduzirErro } from "./common.js";
import { svgAvatar, avatarValido } from "./avatar.js";
import { ehDificil } from "./status-aluno.js";
import { irParaAba } from "./aluno-nav.js";
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
// copia campos do perfil para a vitrine (só se ele já está no mural)
async function sincronizar(eu, campos, simulacao) {
  if (simulacao) { const v = JSON.parse(localStorage.getItem("sim:vitrine") || "null"); if (v) localStorage.setItem("sim:vitrine", JSON.stringify({ ...v, ...campos })); return; }
  if (!(await lerMinhaVitrine(eu, false))) return;
  await updateDoc(doc(db, "vitrine", eu.uid), { ...campos, atualizadoEm: serverTimestamp() }).catch(e => console.warn("sincronizar mural", e));
}
// trocou o status no perfil: atualiza o do mural (sem os difíceis)
export const sincronizarStatus = (eu, status, simulacao) => sincronizar(eu, { status: statusPublico(status) }, simulacao);
// salvou o personagem: o mural passa a mostrar a skin e o apelido atuais
export const sincronizarVisual = (eu, { avatar, apelido }, simulacao) => sincronizar(eu, { avatar: avatar || null, apelido: String(apelido || "").slice(0, 30) }, simulacao);

// ---------- colegas fictícios da simulação ----------
const COLEGAS_SIM = [
  { uid: "sim-lucas", apelido: "Lucas", nivel: 4, status: "💻 Programando", av: { corpo: "masculino", cabelo: "topete", corCabelo: 1, pele: 2, olhos: "amendoado", roupa: "moletom", corRoupa: 1, fundo: "verde" },
    conquistas: [{ e: "🎓", t: "Primeira prova" }, { e: "🥇", t: "Trinca de ouro" }, { e: "⭐", t: "Mandou bem em Banco de Dados" }], notas: [{ id: "n1", titulo: "MS3 - DDL", materia: "Banco de Dados", nota: 92 }], cur: 5, par: 3 },
  { uid: "sim-julia", apelido: "Juh", nivel: 3, status: "📚 Estudando", av: { corpo: "feminino", cabelo: "cacheado", corCabelo: 0, pele: 4, olhos: "grandes", roupa: "listrada", corRoupa: 6, fundo: "rosa", oculos: "oculos" },
    conquistas: [{ e: "💯", t: "Nota alta" }, { e: "📈", t: "Em evolução" }], notas: [], cur: 8, par: 6 },
  { uid: "sim-pedro", apelido: "Pedro", nivel: 2, status: "🎮 Modo jogo", av: { corpo: "masculino", cabelo: "afrocurto", corCabelo: 0, pele: 5, olhos: "pesado", barba: "cavanhaque", roupa: "time", corRoupa: 2, fundo: "azul" },
    conquistas: [{ e: "🎓", t: "Primeira prova" }], notas: [], cur: 2, par: 1 },
  { uid: "sim-bia", apelido: "Bia", nivel: 5, status: "🚀 Motivado(a)", av: { corpo: "feminino", cabelo: "rabo", corCabelo: 3, pele: 0, olhos: "normal", roupa: "jaqueta", corRoupa: 5, fundo: "lilas", brinco: "argola" },
    conquistas: [{ e: "🏅", t: "Veterano" }, { e: "❤️", t: "Coração intacto" }, { e: "🧩", t: "Mestre em Lógica" }], notas: [{ id: "n2", titulo: "Lógica 2", materia: "Lógica", nota: 88 }], cur: 11, par: 9 }
].map(c => ({ ...c, avatar: avatarValido(c.av, Array.from({ length: 20 }, (_, i) => ({ id: "x" + i }))) }));
const reacoesSim = () => JSON.parse(localStorage.getItem("sim:reacoes") || "{}");

// nomes FICTÍCIOS de quem reagiu na simulação (reações de "f0", "g1"… que não estão no mural)
const NOMES_SIM = ["Ana", "Caio", "Duda", "Enzo", "Gabi", "Hugo", "Isa", "João", "Kaique", "Lara", "Mel", "Nina", "Otávio", "Rafa", "Sofia", "Théo", "Vivi"];

// botões no cartão do perfil ("Mural da turma" leva para a aba Turma)
export function botoesSocial(box, { eu, cq, gami, perfil, simulacao }) {
  if (!gami.social || !box) return;
  const acoes = box.querySelector(".pa-info .acoes");
  acoes.insertAdjacentHTML("beforeend", `<button type="button" class="leve" data-soc="mostrar">🔓 O que eu mostro</button><button type="button" class="leve" data-soc="mural">❤️ Mural da turma</button>`);
  acoes.querySelector("[data-soc=mostrar]").onclick = () => escolherVitrine({ eu, cq, gami, perfil, simulacao });
  acoes.querySelector("[data-soc=mural]").onclick = () => irParaAba("turma");
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
      if (!conquistas.length && !notas.length) return atual ? await sairDoMural(eu, simulacao) : true;   // nada marcado: sai do mural (se estava)
      if (!dados.turmaId) { toast("Você ainda não está em nenhuma turma: peça para a equipe te colocar numa turma para entrar no mural.", "erro"); return false; }
      try {
        if (simulacao) localStorage.setItem("sim:vitrine", JSON.stringify({ ...dados, atualizadoEm: null }));
        else await setDoc(doc(db, "vitrine", eu.uid), dados);
      } catch (e) { toast(traduzirErro(e), "erro"); return false; }
      toast("Pronto! Você entrou no mural: os colegas veem só o que você marcou.", "ok"); return true;
    } });
  depois?.();
}

// sair do mural: apaga a vitrine (com confirmação); true = saiu
async function sairDoMural(eu, simulacao) {
  if (!(await confirmar("Sair do mural da turma? Os colegas deixam de ver o que você mostrava, e você deixa de ver o mural deles. Dá para voltar quando quiser.", { titulo: "Sair do mural", ok: "Sair do mural", perigo: true }))) return false;
  try { if (simulacao) localStorage.removeItem("sim:vitrine"); else await deleteDoc(doc(db, "vitrine", eu.uid)); }
  catch (e) { toast(traduzirErro(e), "erro"); return false; }
  toast("Você saiu do mural (e não vê mais o dos colegas).", "ok"); return true;
}

// cartão público (o que um colega vê ao abrir o perfil de alguém no mural)
const cartaoPublico = (v, eu_) => `<div class="perfil-publico"><div class="pp-av">${svgAvatar(v.avatar, 170)}</div>
  <div class="pp-info"><h2>${esc(v.apelido || v.nome)}${eu_ ? ` <span class="tag">você</span>` : ""}</h2><span class="pequeno">nível ${v.nivel || 1}</span>
    ${v.status ? `<div class="pp-status">${esc(v.status)}</div>` : ""}
    <h3 class="conq-h3">🏅 Conquistas que ${eu_ ? "você mostra" : "mostra"}</h3><div class="mi-conq">${(v.conquistas || []).map(m => `<span class="tag">${m.e} ${esc(m.nome || m.t)}</span>`).join("") || `<span class="pequeno">—</span>`}</div>
    ${(v.notas || []).length ? `<h3 class="conq-h3">📊 Notas que ${eu_ ? "você mostra" : "mostra"}</h3><div class="mi-conq">${v.notas.map(n => `<span class="tag nota">${esc(n.titulo)}${n.materia ? ` (${esc(n.materia)})` : ""}: ${n.nota}</span>`).join("")}</div>` : ""}
    <p class="pequeno pp-nota">🔒 Só isto aparece${eu_ ? " de você" : ""} para os colegas. Notas, provas, cartão, e-mail e o resto do perfil ficam privados.</p></div></div>`;

// perfil do aluno (avatar e apelido atuais) para a vitrine: mesmo jeito do cartão do perfil
async function lerPerfilSocial(eu, cq, simulacao) {
  let p = {};
  if (simulacao) { try { p = JSON.parse(localStorage.getItem("sim:perfil") || "null") || {}; } catch (e) { p = {}; } }
  else p = (await getDoc(doc(db, "perfis", eu.uid)).catch(() => null))?.data() || {};
  return { ...p, avatar: avatarValido(p.avatar, cq?.ganhas || []) };
}

// ---------- PÁGINA Turma (aba da página do aluno): o mural da turma ----------
// Mesmas regras de antes: só quem escolheu mostrar aparece (e só vê quem também mostra), só a mesma turma,
// só ❤️ curtida e 👏 parabéns (sem comentários), status difíceis nunca aparecem, simulação com colegas fictícios.
// Novo: cada publicação mostra QUEM curtiu e quem deu parabéns (apelido/nome da vitrine de quem reagiu).
export async function desenharTurma(box, { eu, cq, gami, simulacao }) {
  if (!box || !eu) return;
  if (!gami.social) { box.innerHTML = `<h2>👥 Turma</h2><p class="pequeno">O mural da turma está desligado no momento.</p>`; return; }
  const meu = ++box._versao || (box._versao = 1);   // abriu a aba de novo enquanto carregava: só a última desenha
  box.innerHTML = `<h2>👥 Mural da turma</h2><p class="pequeno">Carregando…</p>`;
  const perfil = await lerPerfilSocial(eu, cq, simulacao);
  const minha = await lerMinhaVitrine(eu, simulacao);
  if (meu !== box._versao) return;
  const ctx = { eu, cq, gami, perfil, simulacao };
  const deNovo = () => desenharTurma(box, { eu, cq, gami, simulacao });
  const avisoSim = simulacao ? `<p class="aviso-sim">🧪 Simulação: os colegas são <b>fictícios</b> e as reações ficam só neste navegador.${gami.socialReal === false ? " Para os alunos de verdade a parte social está <b>desligada</b> (ligue em Gamificação)." : ""}</p>` : "";
  // só quem compartilha entra
  if (!minha) {
    box.innerHTML = `<h2>👥 Mural da turma</h2>${avisoSim}<div class="mural-trava"><div class="mt-e">❤️🔒</div>
        <p><b>O mural é de quem participa.</b> Escolha pelo menos uma conquista para mostrar aos colegas e o mural da sua turma abre na hora.</p>
        <p class="pequeno">Você decide o que aparece e pode sair quando quiser. Quem não mostra nada também não vê o dos colegas.</p>
        <button type="button" id="muralEntrar">🔓 Escolher o que mostro</button></div>`;
    $("#muralEntrar", box).onclick = () => escolherVitrine({ ...ctx, depois: deNovo });
    return;
  }
  // vitrine gravada antes de trocar o personagem: atualiza para a skin atual antes de montar o mural
  if (perfil?.avatar && (JSON.stringify(minha.avatar) !== JSON.stringify(perfil.avatar) || (minha.apelido || "") !== (perfil.apelido || ""))) {
    await sincronizarVisual(eu, perfil, simulacao); minha.avatar = perfil.avatar; minha.apelido = String(perfil.apelido || "").slice(0, 30);
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
  if (meu !== box._versao) return;
  itens = itens.map(v => ({ ...v, status: statusPublico(v.status) })).sort((a, b) => (b.uid === eu.uid) - (a.uid === eu.uid));   // status difíceis nunca aparecem
  // nome de quem reagiu: vem da vitrine dele (todos que reagem estão no mural da mesma turma)
  const nomes = new Map(itens.map(v => [v.uid, v.apelido || v.nome || "Colega"]));
  const nomeDe = de => de === eu.uid ? "você" : nomes.get(de) || (simulacao && /^[fg]\d+$/.test(de) ? NOMES_SIM[(Number(de.slice(1)) + (de[0] === "g" ? 7 : 0)) % NOMES_SIM.length] : null);
  const quem = (l, tipo) => {
    const ns = l.filter(r => r.tipo === tipo).map(r => nomeDe(r.de)), conhecidos = ns.filter(Boolean).sort((a, b) => (b === "você") - (a === "você")), fora = ns.length - conhecidos.length;
    return [...conhecidos.map(esc), ...(fora ? [`${fora} colega${fora > 1 ? "s" : ""} que saiu do mural`] : [])].join(", ");
  };
  box.innerHTML = `<div class="card-cab"><h2>👥 Mural da turma</h2><div class="cc-acoes"><button type="button" class="leve" id="muralMostrar">🔓 O que eu mostro</button></div></div>${avisoSim}
    <p class="pequeno" style="margin-top:0">Só aparece quem escolheu mostrar alguma coisa, e só da sua turma. Toque num colega para ver o perfil dele. Sem comentários: só ❤️ e 👏.</p><div id="muralLista" class="mural"></div>
    <p class="pequeno" style="text-align:right"><button type="button" class="leve mini" id="muralSair">🚪 Sair do mural</button></p>`;
  const desenhar = () => {
    $("#muralLista", box).innerHTML = itens.map((v, i) => {
      const minhaR = v.reacoes.find(r => r.de === eu.uid), cur = v.reacoes.filter(r => r.tipo === "curtida").length, par = v.reacoes.filter(r => r.tipo === "parabens").length, eu_ = v.uid === eu.uid;
      const qc = quem(v.reacoes, "curtida"), qp = quem(v.reacoes, "parabens");
      return `<article class="mural-item${eu_ ? " mi-eu" : ""}"><button type="button" class="mi-av" data-ver="${i}" title="Ver o perfil">${svgAvatar(v.avatar, 84)}</button><div class="mi-info"><button type="button" class="mi-nome" data-ver="${i}"><b>${esc(v.apelido || v.nome)}</b></button>${eu_ ? ` <span class="tag">você</span>` : ""} <span class="pequeno">nível ${v.nivel || 1}</span>${v.status ? ` <span class="tag">${esc(v.status)}</span>` : ""}
        <div class="mi-conq">${(v.conquistas || []).map(m => `<span class="tag" title="${esc(m.t)}">${m.e} ${esc(m.nome || m.t)}</span>`).join("")}</div>
        ${(v.notas || []).length ? `<div class="mi-conq">${v.notas.map(n => `<span class="tag nota">📊 ${esc(n.titulo)}${n.materia ? ` (${esc(n.materia)})` : ""}: ${n.nota}</span>`).join("")}</div>` : ""}
        <div class="mi-reacoes">${eu_ ? `<span class="pequeno">❤️ ${cur} · 👏 ${par}</span>` : `<button type="button" class="leve mini${minhaR?.tipo === "curtida" ? " sel" : ""}" data-r="curtida" data-u="${esc(v.uid)}" aria-pressed="${minhaR?.tipo === "curtida"}" title="Curtir">❤️ ${cur}</button><button type="button" class="leve mini${minhaR?.tipo === "parabens" ? " sel" : ""}" data-r="parabens" data-u="${esc(v.uid)}" aria-pressed="${minhaR?.tipo === "parabens"}" title="Dar parabéns">👏 ${par}</button>`}</div>
        ${qc || qp ? `<div class="mi-quem">${qc ? `<span><span aria-hidden="true">❤️</span> <b>Curtiram:</b> ${qc}</span>` : ""}${qp ? `<span><span aria-hidden="true">👏</span> <b>Deram parabéns:</b> ${qp}</span>` : ""}</div>` : `<div class="mi-quem"><span class="pequeno">Ninguém reagiu ainda.</span></div>`}</div></article>`;
    }).join("");
    box.querySelectorAll("[data-ver]").forEach(b => b.onclick = () => { const v = itens[b.dataset.ver]; modal({ titulo: v.uid === eu.uid ? "👀 Como os colegas me veem" : `👤 Perfil de ${v.apelido || v.nome}`, conteudo: cartaoPublico(v, v.uid === eu.uid), ok: "Fechar", largo: true }); });
    box.querySelectorAll("#muralLista [data-r]").forEach(b => b.onclick = async () => {
      const v = itens.find(x => x.uid === b.dataset.u), minhaR = v.reacoes.find(r => r.de === eu.uid), tirar = minhaR?.tipo === b.dataset.r;
      try {
        if (simulacao) { const r = reacoesSim(); if (tirar) delete r[v.uid]; else r[v.uid] = b.dataset.r; localStorage.setItem("sim:reacoes", JSON.stringify(r)); }
        else if (tirar) await deleteDoc(doc(db, "vitrine", v.uid, "reacoes", eu.uid));
        else await setDoc(doc(db, "vitrine", v.uid, "reacoes", eu.uid), { tipo: b.dataset.r, item: "perfil", em: serverTimestamp() });
        v.reacoes = [...v.reacoes.filter(r => r.de !== eu.uid), ...(tirar ? [] : [{ de: eu.uid, tipo: b.dataset.r }])];
        desenhar();
      } catch (e) { toast(traduzirErro(e), "erro"); }
    });
  };
  desenhar();
  $("#muralMostrar", box).onclick = () => escolherVitrine({ ...ctx, depois: deNovo });
  $("#muralSair", box).onclick = async () => { if (await sairDoMural(eu, simulacao)) deNovo(); };   // saiu: volta para a tela de entrar no mural
}
