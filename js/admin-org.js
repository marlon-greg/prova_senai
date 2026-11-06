// Painel → aba "🏫 Organização": Turma → Semestre → Matéria → Tópicos.
// planos/{id} = uma matéria de uma turma num semestre (o "plano de ensino"):
//   { turmaId, turma, semestre: "2026-2", materia, professores: [email], topicos: [{ nome, inicio, fim }],
//     provas: [{ titulo, data, topicos: [nome] }], observacoes, criadoEm, atualizadoEm, atualizadoPor }
// planos/{id}/arquivos/{a} (+ partes) = o PDF do plano (mesmo formato de js/material.js).
// A prova liga na matéria por turma + semestre + matéria (prova.semestre / prova.materia; provas antigas: data de criação e matéria do banco).
// O tópico de uma questão é o campo "tema" dela (o mesmo que filtra o sorteio da prova).
import { db, esc, $, toast, modal, confirmar, traduzirErro, temaDe, ordenarTemas, bancosDaProva, temasDoBanco,
         semestreDe, rotuloSemestre, semestreVizinho, chaveTexto, semestreDaProva, materiaDaProva, dataCurta, nomeTurma, semestreCursoAtual } from "./common.js";
import { enviarMaterial, listarMateriais, apagarMaterial, baixarMaterial, abrirMaterialEmAba, tamanhoTexto, erroMaterial } from "./material.js";
import { lerPlanoIA, classificarTopicosIA, lerCursoIA } from "./ia.js";
import { menuHTML, itemMenu, vazio, collapsible, tarefa, pl, semestreLongo, seta, drawerForm } from "./ui.js";
import { ic } from "./icones.js";
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let ctx = null;
// ctx = { eu, podeEditar, ehAdmin, auth, iaCfg, urlCorretor, listarTurmas, alunosDaTurma, listarBancos, questoesDoBanco,
//         invalidarBanco, novaProva({ turmaId, semestre, materia, data, titulo }), abrirResultados(provaId) }
let planos = [], provas = [], bancos = [], turmas = [], equipe = [], cursos = [];
const arquivosCurso = new Map();   // cursoId -> [arquivos]
const baseCurso = id => `cursos/${id}/arquivos`;
const arquivosPlano = new Map();   // planoId -> [arquivos]
const abertos = new Set(), fechados = new Set();   // grupos que o professor abriu/fechou
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ordemNatural = (a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
const basePlano = id => `planos/${id}/arquivos`;

export function iniciarOrganizacao(c) {
  ctx = c;
  ["#orgBusca", "#orgTurma", "#orgSemestre"].forEach(id => $(id).addEventListener(id === "#orgBusca" ? "input" : "change", desenhar));
  $("#orgNovo").onclick = () => editarPlano(null, { turmaId: $("#orgTurma").value, semestre: $("#orgSemestre").value || semestreDe() });
}

// ---------- dados ----------
export async function listarPlanos() {
  const s = await getDocs(collection(db, "planos"));
  planos = s.docs.map(d => ({ id: d.id, ...d.data() }));
  return planos;
}
export const planosCache = () => planos;
export async function listarCursos() {
  cursos = (await getDocs(collection(db, "cursos"))).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ordemNatural(a.nome, b.nome));
  return cursos;
}
// matéria do plano de curso da turma (ou de qualquer curso, sem turma)
export function materiaDoCurso(materia, turmaId = null) {
  const t = turmas.find(x => x.id === turmaId), k = chaveTexto(materia);
  const lista = t?.cursoId ? cursos.filter(c => c.id === t.cursoId) : cursos;
  for (const c of lista) { const m = (c.materias || []).find(m => chaveTexto(m.nome) === k); if (m) return { ...m, curso: c }; }
  return null;
}
// tópicos de uma matéria: os do plano de ensino; senão os do plano de curso
export function topicosDaMateria(materia, turmaId = null, semestre = null) {
  const out = [], v = new Set(), add = n => { const k = chaveTexto(n); if (k && !v.has(k)) { v.add(k); out.push(n); } };
  planos.filter(p => chaveTexto(p.materia) === chaveTexto(materia) && (!turmaId || p.turmaId === turmaId) && (!semestre || p.semestre === semestre)).forEach(p => (p.topicos || []).forEach(t => add(t.nome)));
  (materiaDoCurso(materia, turmaId)?.topicos || []).forEach(add);
  return out;
}
// matérias sugeridas para uma turma/semestre (planos primeiro, depois as dos bancos)
export function materiasSugeridas(turmaId, semestre) {
  const dos = planos.filter(p => (!turmaId || p.turmaId === turmaId) && (!semestre || p.semestre === semestre)).map(p => p.materia);
  const out = [], vistos = new Set();
  const doCurso = cursos.filter(c => !turmaId || turmas.find(t => t.id === turmaId)?.cursoId === c.id).flatMap(c => (c.materias || []).map(m => m.nome));
  for (const m of [...dos, ...doCurso, ...planos.map(p => p.materia), ...cursos.flatMap(c => (c.materias || []).map(m => m.nome)), ...bancos.map(b => b.materia)]) {
    const k = chaveTexto(m); if (k && !vistos.has(k)) { vistos.add(k); out.push(String(m).trim()); }
  }
  return out;
}

export async function carregarOrganizacao() {
  $("#orgArvore").innerHTML = `<p class="pequeno">Carregando…</p>`;
  try {
    const [ts, bs, , ps, eq] = await Promise.all([ctx.listarTurmas(), ctx.listarBancos(), listarPlanos().then(() => listarCursos().catch(() => [])),
      getDocs(collection(db, "provas")), getDocs(collection(db, "equipe")).catch(() => null)]);
    turmas = ts; bancos = bs; provas = ps.docs.map(d => ({ id: d.id, ...d.data() }));
    equipe = eq ? eq.docs.map(d => ({ email: d.id, ...d.data() })) : [];
    await Promise.all(bancos.map(b => ctx.questoesDoBanco(b.id).catch(() => [])));
    await Promise.all(planos.map(p => listarMateriais(basePlano(p.id)).then(l => arquivosPlano.set(p.id, l)).catch(() => arquivosPlano.set(p.id, []))));
    await Promise.all(cursos.map(c => listarMateriais(baseCurso(c.id)).then(l => arquivosCurso.set(c.id, l)).catch(() => arquivosCurso.set(c.id, []))));
  } catch (e) { $("#orgArvore").innerHTML = `<p class="pequeno erro-texto">${esc(traduzirErro(e))}</p>`; return; }
  // filtros
  const selT = $("#orgTurma"), antesT = selT.value;
  selT.innerHTML = `<option value="">👥 Todas as turmas</option>` + turmas.map(t => `<option value="${t.id}">${esc(nomeTurma(t))}</option>`).join("");
  selT.value = turmas.some(t => t.id === antesT) ? antesT : "";
  const sems = new Set([semestreDe(), ...planos.map(p => p.semestre), ...provas.filter(p => p.turmaId).map(semestreDaProva)]);
  const selS = $("#orgSemestre"), antesS = selS.value;
  selS.innerHTML = `<option value="">📅 Todos os semestres</option>` + [...sems].filter(Boolean).sort().reverse().map(s => `<option value="${s}">${rotuloSemestre(s)}${s === semestreDe() ? " (atual)" : ""}</option>`).join("");
  selS.value = [...sems].includes(antesS) ? antesS : "";
  desenhar();
}

// questões de um banco por tópico: { chaveTopico: n }
function contagemTopicos(bancoId) {
  const c = {};
  for (const q of ctx.questoesDoBancoCache(bancoId) || []) { const k = chaveTexto(temaDe(q)); c[k] = (c[k] || 0) + 1; }
  return c;
}
// tópicos que podem cair na prova (chaves): os marcados de cada banco, ou todos os do banco
function topicosDaProva(p) {
  const out = new Set();
  for (const b of bancosDaProva(p)) {
    const s = temasDoBanco(p, b);
    if (s) s.forEach(t => out.add(chaveTexto(t)));
    else for (const q of ctx.questoesDoBancoCache(b) || []) out.add(chaveTexto(temaDe(q)));
  }
  return out;
}

// árvore: turmaId -> semestre -> chaveMatéria -> { plano, materia, provas }
function montar() {
  const arv = new Map();
  const no = (t, s, m) => {
    if (!arv.has(t)) arv.set(t, new Map());
    const sm = arv.get(t); if (!sm.has(s)) sm.set(s, new Map());
    const mm = sm.get(s), k = chaveTexto(m) || "__sem";
    if (!mm.has(k)) mm.set(k, { plano: null, materia: m || "", provas: [] });
    return mm.get(k);
  };
  for (const p of planos) { const n = no(p.turmaId, p.semestre, p.materia); n.plano = p; n.materia = p.materia; }
  for (const p of provas) if (p.turmaId && turmas.some(t => t.id === p.turmaId)) no(p.turmaId, semestreDaProva(p), materiaDaProva(p, bancos)).provas.push(p);
  return arv;
}

function desenhar() {
  desenharCursos();
  const box = $("#orgArvore");
  if (!turmas.length) { box.innerHTML = vazio({ e: "🏫", texto: "Cadastre as turmas na aba <b>Turmas</b> primeiro." }); $("#orgContagem").textContent = ""; return; }
  const fT = $("#orgTurma").value, fS = $("#orgSemestre").value, busca = chaveTexto($("#orgBusca").value);
  const arv = montar(), atual = semestreDe(), alvo = fS || atual;
  let nMat = 0, nTop = 0;
  const filtradas = turmas.filter(t => !fT || t.id === fT);
  const bate = n => !busca || chaveTexto(n.materia).includes(busca) || (n.plano?.topicos || []).some(x => chaveTexto(x.nome).includes(busca)) || n.provas.some(p => chaveTexto(p.titulo).includes(busca));
  // Semestre → Turma → Matéria. O semestre atual (ou o filtrado) lista todas as turmas, para dar para criar matéria mesmo sem nenhuma ainda
  const sems = [...new Set([...filtradas.flatMap(t => [...(arv.get(t.id)?.keys() || [])]), ...(busca ? [] : [alvo])])].filter(s => !fS || s === fS).sort().reverse();
  const html = sems.map(s => {
    let matS = 0, provS = 0, turS = 0;
    const blocos = filtradas.map(t => {
      const sm = arv.get(t.id) || new Map();
      const cards = [...(sm.get(s)?.values() || [])].filter(bate).sort((a, b) => ordemNatural(a.materia || "~", b.materia || "~"));
      if (!cards.length && (busca || s !== alvo)) return "";
      turS++; matS += cards.length; provS += cards.reduce((x, n) => x + n.provas.length, 0);
      nMat += cards.length; nTop += cards.reduce((x, n) => x + (n.plano?.topicos?.length || 0), 0);
      const id = `t:${t.id}:${s}`, aberto = busca || fT || abertos.has(id), sc = semestreCursoAtual(t);
      const resumo = [pl(ctx.alunosDaTurma(t).length, "aluno"), sc?.rotulo, pl(cards.length, "matéria")].filter(Boolean).join(" · ");
      return `<details class="card sem-padding" data-g="${id}" ${aberto ? "open" : ""}>
        <summary class="sub-cab"><span class="sc-tile sc-navy">${ic("users", { size: 20 })}</span><span class="sc-texto"><span class="sc-titulo">${esc(nomeTurma(t))}</span><span class="sc-resumo">${esc(resumo)}</span></span>
          ${ctx.podeEditar() ? `<span class="sc-fim"><button class="leve mini" data-novo-t="${t.id}" data-sem="${esc(s)}" type="button">${ic("plus", { size: 16 })}Matéria</button></span>` : ""}${seta()}</summary>
        <div class="org-corpo">${s === alvo ? cursoDaTurmaHTML(t, sm) : ""}${cards.length ? `<div class="cartoes-materias">${cards.map(n => cartaoMateria(t, s, n)).join("")}</div>` : `<p class="help">Nenhuma matéria em ${esc(rotuloSemestre(s))}. Use <b>Matéria</b> (ou as matérias do plano de curso, acima).</p>`}</div></details>`;
    }).join("");
    if (!blocos) return "";
    const id = `s:${s}`, aberto = busca || fS || (fechados.has(id) ? false : abertos.has(id) || s === atual);
    return `<details class="faixa" data-g="${id}" ${aberto ? "open" : ""}>
      <summary class="secao-faixa"><span class="sf-tile">${ic("cal", { size: 20 })}</span><h3 class="sf-titulo">${esc(semestreLongo(s))}</h3>${s === atual ? `<span class="chip ok">atual</span>` : ""}
        <span class="sf-resumo">${pl(turS, "turma")} · ${pl(matS, "matéria")} · ${pl(provS, "prova")}</span><span class="sf-fim sf-tile">${seta()}</span></summary>
      <div class="faixa-corpo">${blocos}</div></details>`;
  }).join("");
  $("#orgContagem").textContent = `${pl(nMat, "matéria")} · ${pl(nTop, "tópico")} nos planos`;
  box.innerHTML = html || vazio({ e: "🔎", texto: "Nada encontrado com esses filtros." });
  ligarArvore(box);
}

function estadoTopico(x) {
  const h = hoje();
  if (!x.inicio && !x.fim) return "";
  if (x.inicio && h < x.inicio) return "previsto";
  if (x.fim && h > x.fim) return "dado";
  return "andamento";
}
const ROT_ESTADO = { previsto: "previsto", andamento: "em andamento", dado: "dado" };
const periodo = x => x.inicio || x.fim ? `${dataCurta(x.inicio) || "?"}${x.fim && x.fim !== x.inicio ? ` – ${dataCurta(x.fim)}` : ""}` : "";

function cartaoMateria(t, s, n) {
  const p = n.plano, chaveM = chaveTexto(n.materia);
  // bancos da matéria: os de mesma matéria + os usados pelas provas dela
  const bIds = new Set([...bancos.filter(b => chaveM && chaveTexto(b.materia) === chaveM).map(b => b.id), ...n.provas.flatMap(bancosDaProva)]);
  const cont = {}; for (const b of bIds) for (const [k, v] of Object.entries(contagemTopicos(b))) cont[k] = (cont[k] || 0) + v;
  const emProva = {}; for (const pr of n.provas) for (const k of topicosDaProva(pr)) (emProva[k] ||= []).push(pr.titulo);
  const doCurso = materiaDoCurso(n.materia, t.id);
  const topicos = p?.topicos?.length ? p.topicos : (doCurso?.topicos || []).map(nome => ({ nome, inicio: "", fim: "" }));
  const origemCurso = !p?.topicos?.length && topicos.length;
  const doPlano = new Set(topicos.map(x => chaveTexto(x.nome)));
  const soBanco = Object.keys(cont).filter(k => !doPlano.has(k));
  const nomeDe = k => { for (const b of bIds) { const q = (ctx.questoesDoBancoCache(b) || []).find(q => chaveTexto(temaDe(q)) === k); if (q) return temaDe(q); } return k; };
  const dados = topicos.filter(x => estadoTopico(x) === "dado").length;
  const profs = (p?.professores || []).map(e => equipe.find(x => x.email === e)?.nome || e);
  const arqs = p ? arquivosPlano.get(p.id) || [] : [];
  const prevs = p?.provas || [];
  const pode = ctx.podeEditar();
  const linhaProva = pr => `<li><span class="chip ${pr.liberada ? "ok" : "off"}">${pr.liberada ? "● liberada" : "○ fechada"}</span>
      <b>${esc(pr.titulo)}</b> ${pr.dataProva ? `<span class="pequeno">${dataCurta(pr.dataProva)}</span>` : ""}
      <button class="discreto mini" data-res="${pr.id}" type="button" title="Abrir os resultados">${ic("resultados", { size: 16 })}Resultados</button></li>`;
  const feita = pv => n.provas.some(pr => chaveTexto(pr.titulo) === chaveTexto(pv.titulo) || (pv.data && pr.dataProva === pv.data));
  return `<article class="cartao-materia${p ? "" : " sem-plano"}">
    <div class="cm-topo">
      <div><h3>${esc(n.materia || "Sem matéria")}</h3>
        <span class="pequeno">${profs.length ? profs.map(esc).join(", ") : p ? "sem professor definido" : doCurso ? "do plano de curso · sem plano de ensino (opcional)" : "sem plano de ensino cadastrado"}</span></div>
      ${topicos.length && !origemCurso ? `<div class="cm-progresso" title="Tópicos já dados, pelas datas do plano"><span><b>${dados}/${topicos.length}</b> tópicos dados</span>
        <div class="barra"><i style="width:${Math.round(dados / topicos.length * 100)}%"></i></div></div>` : ""}
    </div>
    ${origemCurso ? `<p class="help" style="margin:0;max-width:none">Tópicos do plano de curso (${esc(doCurso.curso.nome)}), sem datas. As datas e as provas ficam no plano de ensino, se quiser.</p>` : ""}
    ${topicos.length ? `<details class="bb-topicos"><summary>${seta(16)}${ic("tag", { size: 15 })}${pl(topicos.length, "tópico")}${!origemCurso && topicos.some(x => estadoTopico(x) === "andamento") ? `<span class="chip info">em andamento</span>` : ""}</summary>
      <div><ol class="lista-topicos">${topicos.map(x => {
      const k = chaveTexto(x.nome), e = estadoTopico(x), nq = cont[k] || 0, ep = emProva[k] || [];
      return `<li class="topico${e ? " e-" + e : ""}"><span class="tp-nome">${esc(x.nome)}</span>
        ${periodo(x) ? `<span class="pequeno">${periodo(x)}</span>` : ""}${e ? `<span class="chip ${e === "dado" ? "ok" : e === "andamento" ? "info" : "off"}">${ROT_ESTADO[e]}</span>` : ""}
        <span class="meta-txt${nq ? "" : " falta"}" title="Questões com este tópico nos bancos da matéria">${pl(nq, "questão", "questões")}</span>
        ${ep.length ? `<span class="chip info" title="${esc(ep.join(" · "))}">em ${pl(ep.length, "prova")}</span>` : ""}</li>`;
    }).join("")}</ol></div></details>` : p ? `<p class="pequeno">Nenhum tópico ainda. ${pode ? "Use <b>✎ Editar</b> ou envie o PDF do plano e peça para a IA ler." : ""}</p>` : ""}
    ${soBanco.length ? collapsible({ chave: `org:banco:${t.id}|${s}|${chaveM}`, classe: "leve cm-extra-rc",
      titulo: `🗂 ${soBanco.length} tópico(s) ${p ? "nos bancos, fora do plano" : "nos bancos"}`,
      resumoHTML: `<span class="chip">📝 ${soBanco.reduce((a, k) => a + cont[k], 0)} questões</span>${soBanco.includes("geral") ? `<span class="chip aviso">sem tópico: ${cont.geral}</span>` : ""}`,
      corpoHTML: `<div class="cm-extra">${soBanco.map(k => `<span class="tag${k === "geral" ? " aviso" : ""}" title="${k === "geral" ? "Questões sem tópico: use 🏷 Tópicos na aba Bancos" : ""}">${esc(nomeDe(k))} · ${cont[k]}</span>`).join("")}</div>` }) : ""}
    <div class="cm-provas">${n.provas.length || prevs.length ? `<span class="rotulo">Provas${n.provas.length ? ` · ${n.provas.length}` : ""}</span>` : ""}
      ${n.provas.length ? `<ul>${n.provas.sort((a, b) => String(a.dataProva || "").localeCompare(String(b.dataProva || "")) || ordemNatural(a.titulo, b.titulo)).map(linhaProva).join("")}</ul>` : ""}
      ${prevs.filter(pv => !feita(pv)).map(pv => `<div class="prevista"><span class="chip off" title="${esc((pv.topicos || []).join(", "))}">${ic("cal", { size: 14 })}${esc(pv.titulo)}${pv.data ? ` · ${dataCurta(pv.data)}` : ""}</span>
        ${pode ? `<button class="leve mini" type="button" data-criar="${p.id}" data-titulo="${esc(pv.titulo)}" data-data="${pv.data || ""}" data-tops="${esc(JSON.stringify(pv.topicos || []))}">${ic("plus", { size: 16 })}Criar</button>` : ""}</div>`).join("")}
    </div>
    ${p?.observacoes ? `<p class="pequeno cm-obs">📝 ${esc(p.observacoes)}</p>` : ""}
    <div class="cm-acoes">
      ${arqs.map(a => `<span class="item-arq"><button class="leve mini" type="button" data-verarq="${p.id}" data-arq="${a.id}" title="Abrir o PDF">${ic("provas", { size: 16 })}${esc(a.titulo)}</button>${pode ? `<button class="discreto mini perigo-txt" type="button" data-delarq="${p.id}" data-arq="${a.id}" aria-label="Apagar o PDF ${esc(a.titulo)}">✕</button>` : ""}</span>`).join("")}
      ${pode && p ? `<span class="cm-principais"><button class="leve mini" type="button" data-editar="${p.id}">${ic("edit", { size: 16 })}Editar</button>
        <button class="leve mini" type="button" data-criar="${p.id}">${ic("plus", { size: 16 })}Nova prova</button>
        ${menuHTML({ aria: `Mais ações: ${n.materia || "matéria"}`, itensHTML:
          `<label class="menu-item botao-arquivo" role="menuitem" tabindex="0">${ic("upload", { size: 16 })}<span>Enviar PDF do plano</span><input type="file" accept="application/pdf,.pdf" hidden data-enviar="${p.id}"></label>`
          + (arqs.length ? itemMenu({ i: "bot", t: "Ler plano com IA", attrs: `data-ler="${p.id}" title="A IA lê o PDF e preenche os tópicos e as provas previstas (você revisa antes de salvar)"` }) : "")
          + (ctx.ehAdmin() ? "<hr>" + itemMenu({ i: "trash", t: "Apagar o plano", perigo: true, attrs: `data-delplano="${p.id}"` }) : "") })}
        <button data-ajuda-item="planoEnsino"></button></span>` : ""}
      ${pode && !p ? `<button class="leve mini" type="button" data-cadastrar="${t.id}|${s}|${esc(n.materia)}">${ic(doCurso ? "cal" : "plus", { size: 16 })}${doCurso ? "Datas das provas (plano de ensino)" : "Plano de ensino"}</button>` : ""}
    </div></article>`;
}

function ligarArvore(box) {
  box.querySelectorAll("details[data-g]").forEach(d => d.ontoggle = () => {
    if ($("#orgBusca").value || $("#orgTurma").value || $("#orgSemestre").value) return;
    const id = d.dataset.g; if (d.open) { fechados.delete(id); abertos.add(id); } else { fechados.add(id); abertos.delete(id); }
  });
  const plano = id => planos.find(p => p.id === id);
  box.querySelectorAll("[data-novo-t]").forEach(b => b.onclick = e => { e.preventDefault(); editarPlano(null, { turmaId: b.dataset.novoT, semestre: b.dataset.sem || $("#orgSemestre").value || semestreDe() }); });
  box.querySelectorAll("[data-matcurso]").forEach(b => b.onclick = () => { const [turmaId, semestre, materia] = b.dataset.matcurso.split("|"); editarPlano(null, { turmaId, semestre, materia }); });
  box.querySelectorAll("[data-cadastrar]").forEach(b => b.onclick = () => { const [turmaId, semestre, materia] = b.dataset.cadastrar.split("|"); editarPlano(null, { turmaId, semestre, materia }); });
  box.querySelectorAll("[data-editar]").forEach(b => b.onclick = () => editarPlano(plano(b.dataset.editar)));
  box.querySelectorAll("[data-res]").forEach(b => b.onclick = () => ctx.abrirResultados(b.dataset.res));
  box.querySelectorAll("[data-criar]").forEach(b => b.onclick = () => {
    const p = plano(b.dataset.criar);
    ctx.novaProva({ turmaId: p.turmaId, semestre: p.semestre, materia: p.materia, titulo: b.dataset.titulo || "", data: b.dataset.data || "", topicos: JSON.parse(b.dataset.tops || "[]") });
  });
  box.querySelectorAll("[data-verarq]").forEach(b => b.onclick = () => abrirMaterialEmAba(b.dataset.arq, traduzirErro, basePlano(b.dataset.verarq)).catch(e => toast(e.message, "erro")));
  box.querySelectorAll("[data-delarq]").forEach(b => b.onclick = async () => {
    if (!(await confirmar("Apagar este PDF do plano?", { titulo: "Apagar PDF", ok: "Apagar", perigo: true }))) return;
    try { await apagarMaterial(b.dataset.arq, basePlano(b.dataset.delarq)); arquivosPlano.set(b.dataset.delarq, (arquivosPlano.get(b.dataset.delarq) || []).filter(a => a.id !== b.dataset.arq)); desenhar(); }
    catch (e) { toast(traduzirErro(e), "erro"); }
  });
  box.querySelectorAll("[data-enviar]").forEach(inp => inp.onchange = async () => {
    const f = inp.files[0], id = inp.dataset.enviar; inp.value = ""; if (!f) return;
    try {
      toast(`Enviando ${f.name}…`);
      const a = await enviarMaterial(f, f.name.replace(/\.pdf$/i, ""), ctx.eu.email, () => {}, basePlano(id));
      arquivosPlano.set(id, [a, ...(arquivosPlano.get(id) || [])]); desenhar();
      if (temIA() && await confirmar("PDF enviado. Quer que a IA leia o plano agora e preencha os tópicos e as provas previstas? Você revisa antes de salvar.", { titulo: "🤖 Ler plano com IA", ok: "Ler com IA", cancelar: "Agora não" })) lerPlano(plano(id), a.id);
    } catch (e) { toast(erroMaterial(e, traduzirErro), "erro"); }
  });
  box.querySelectorAll("[data-ler]").forEach(b => b.onclick = () => lerPlano(plano(b.dataset.ler)));
  box.querySelectorAll("[data-delplano]").forEach(b => b.onclick = async () => {
    const p = plano(b.dataset.delplano);
    if (!(await confirmar(`Apagar o plano de ${p.materia} (${rotuloSemestre(p.semestre)})? As provas e os bancos não mudam.`, { titulo: "Apagar plano", ok: "Apagar", perigo: true }))) return;
    try {
      for (const a of arquivosPlano.get(p.id) || []) await apagarMaterial(a.id, basePlano(p.id));
      await deleteDoc(doc(db, "planos", p.id)); toast("Plano apagado.", "ok"); carregarOrganizacao();
    } catch (e) { toast(traduzirErro(e), "erro"); }
  });
}

// ---------- texto ⇄ tópicos/provas (uma linha por item; campos separados por "|") ----------
// "AAAA-MM-DD", "dd/mm/aaaa" ou "dd/mm" (ano do semestre) -> "AAAA-MM-DD"
function lerData(txt, semestre) {
  const s = String(txt || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(s);
  if (!m) return null;
  const ano = m[3] ? (m[3].length === 2 ? "20" + m[3] : m[3]) : String(semestre || semestreDe()).slice(0, 4);
  const d = Number(m[1]), me = Number(m[2]);
  if (d < 1 || d > 31 || me < 1 || me > 12) return null;
  return `${ano}-${String(me).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const linhas = txt => String(txt || "").split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
function lerTopicos(txt, semestre) {
  const out = [], erros = [], vistos = new Set();
  linhas(txt).forEach((l, i) => {
    const [nome, ini, fim] = l.split("|").map(x => x.trim());
    const inicio = lerData(ini, semestre), fimD = lerData(fim, semestre);
    if (!nome) return;
    if (inicio === null || fimD === null) erros.push(`Tópico ${i + 1} (${nome}): data inválida. Use dd/mm/aaaa.`);
    if (vistos.has(chaveTexto(nome))) return erros.push(`Tópico repetido: ${nome}.`);
    vistos.add(chaveTexto(nome));
    out.push({ nome: nome.slice(0, 120), inicio: inicio || "", fim: fimD || "" });
  });
  return { topicos: out, erros };
}
function lerProvasPrevistas(txt, semestre) {
  const out = [], erros = [];
  linhas(txt).forEach((l, i) => {
    const [titulo, data, tops] = l.split("|").map(x => x.trim());
    const d = lerData(data, semestre);
    if (!titulo) return;
    if (d === null) erros.push(`Prova ${i + 1} (${titulo}): data inválida.`);
    out.push({ titulo: titulo.slice(0, 120), data: d || "", topicos: String(tops || "").split(";").map(x => x.trim()).filter(Boolean) });
  });
  return { provas: out, erros };
}
const textoTopicos = l => (l || []).map(x => [x.nome, dataCurta(x.inicio), dataCurta(x.fim)].join(" | ").replace(/( \| )+$/, "")).join("\n");
const textoProvas = l => (l || []).map(x => [x.titulo, dataCurta(x.data), (x.topicos || []).join("; ")].join(" | ").replace(/( \| )+$/, "")).join("\n");

// ---------- cadastrar / editar o plano ----------
async function editarPlano(p, pre = {}) {
  if (!ctx.podeEditar()) return;
  if (!equipe.length) equipe = (await getDocs(collection(db, "equipe")).catch(() => null))?.docs.map(d => ({ email: d.id, ...d.data() })) || [];
  const v = p || { turmaId: pre.turmaId || "", semestre: pre.semestre || semestreDe(), materia: pre.materia || "", professores: [ctx.eu.email], topicos: [], provas: [] };
  const sems = [...new Set([-2, -1, 0, 1, 2].map(d => semestreVizinho(semestreDe(), d)).concat(v.semestre))].sort().reverse();
  const profs = equipe.filter(e => ["admin", "professor"].includes(e.papel) || (v.professores || []).includes(e.email));
  if (!profs.some(e => e.email === ctx.eu.email)) profs.unshift({ email: ctx.eu.email, nome: ctx.eu.nome || ctx.eu.email });
  const html = `
    <div class="grade">
      <div><label for="plTurma">Turma</label><select id="plTurma"><option value="">— escolha —</option>${turmas.map(t => `<option value="${t.id}"${t.id === v.turmaId ? " selected" : ""}>${esc(nomeTurma(t))}</option>`).join("")}</select></div>
      <div><label for="plSemestre">Semestre</label><select id="plSemestre">${sems.map(s => `<option value="${s}"${s === v.semestre ? " selected" : ""}>${rotuloSemestre(s)}${s === semestreDe() ? " (atual)" : ""}</option>`).join("")}</select></div>
      <div class="col-2"><label for="plMateria">Matéria (unidade curricular)</label><input type="text" id="plMateria" list="plMaterias" value="${esc(v.materia)}" placeholder="Banco de Dados">
        <datalist id="plMaterias">${materiasSugeridas().map(m => `<option value="${esc(m)}">`).join("")}</datalist>
        <p class="pequeno" style="margin:4px 0 0">Use o mesmo nome do campo "matéria" do banco de questões: é assim que o sistema junta bancos, provas e tópicos.</p></div>
    </div>
    <fieldset class="temas-box"><legend>Professor(es) da matéria</legend><div class="lista-temas">${profs.map(e => `<label class="check"><input type="checkbox" value="${esc(e.email)}"${(v.professores || []).includes(e.email) ? " checked" : ""}> <span>${esc(e.nome || e.email)} <span class="pequeno">${esc(e.email)}</span></span></label>`).join("")}</div></fieldset>
    <label for="plProvas">Provas previstas — uma por linha: <span class="mono">Título | data | tópicos separados por ;</span></label>
    <textarea id="plProvas" style="min-height:80px" placeholder="Avaliação 1 — DDL | 29/08 | DDL - CREATE TABLE e tipos de dados; Chave primária e estrangeira">${esc(textoProvas(v.provas))}</textarea>
    <p class="pequeno" style="margin:4px 0 12px">O plano de ensino é <b>opcional</b> e não precisa estar completo: o principal aqui são as datas das provas.</p>
    <div class="linha" style="justify-content:space-between;align-items:end"><label for="plTopicos" style="margin:0">Tópicos com datas (opcional) — <span class="mono">Tópico | início | fim</span></label>
      <button type="button" class="leve mini" id="plPuxar">📘 Puxar tópicos do plano de curso</button></div>
    <textarea id="plTopicos" style="min-height:180px" placeholder="DDL - CREATE DATABASE e USE | 04/08 | 08/08
DDL - CREATE TABLE e tipos de dados | 11/08 | 22/08
Chave primária e estrangeira | 25/08 | 29/08
DCL - GRANT e REVOKE | 01/09">${esc(textoTopicos(v.topicos))}</textarea>
    <p class="pequeno" style="margin:4px 0 12px">Sem tópicos aqui, a matéria usa os do <b>plano de curso</b>. Os nomes dos tópicos viram os <b>tópicos das questões</b> (aba Bancos → 🏷 Tópicos) e o filtro do sorteio da prova. Dica: envie o PDF do plano no cartão da matéria e peça para a IA preencher.</p>
    <label for="plObs" style="margin-top:12px">Observações (opcional)</label>
    <textarea id="plObs" style="min-height:60px" placeholder="Ex.: o plano pode mudar; recuperação em dezembro.">${esc(v.observacoes || "")}</textarea>`;
  const salvou = await drawerForm({ titulo: p ? `Editar plano — ${p.materia}` : "Nova matéria / plano de ensino", conteudo: html, ok: "Salvar",
    aoAbrir: caixa => {
      $("#plPuxar", caixa).onclick = () => {
        const m = materiaDoCurso($("#plMateria", caixa).value, $("#plTurma", caixa).value) || materiaDoCurso($("#plMateria", caixa).value);
        if (!m?.topicos?.length) return toast("Esta matéria não está em nenhum plano de curso (confira o nome).", "erro");
        const atuais = lerTopicos($("#plTopicos", caixa).value, $("#plSemestre", caixa).value).topicos, ja = new Set(atuais.map(x => chaveTexto(x.nome)));
        $("#plTopicos", caixa).value = textoTopicos([...atuais, ...m.topicos.filter(t => !ja.has(chaveTexto(t))).map(nome => ({ nome, inicio: "", fim: "" }))]);
        toast(`📘 ${m.topicos.length} tópico(s) de ${m.curso.nome}.`, "ok");
      };
    },
    antesDeConfirmar: async caixa => {
      const turmaId = $("#plTurma", caixa).value, semestre = $("#plSemestre", caixa).value, materia = $("#plMateria", caixa).value.trim();
      if (!turmaId) { toast("Escolha a turma.", "erro"); return false; }
      if (!materia) { toast("Escreva o nome da matéria.", "erro"); return false; }
      const dup = planos.find(x => x.id !== p?.id && x.turmaId === turmaId && x.semestre === semestre && chaveTexto(x.materia) === chaveTexto(materia));
      if (dup) { toast(`Já existe o plano de ${dup.materia} nesta turma e semestre. Edite aquele.`, "erro"); return false; }
      const t = lerTopicos($("#plTopicos", caixa).value, semestre), pv = lerProvasPrevistas($("#plProvas", caixa).value, semestre);
      const erros = [...t.erros, ...pv.erros];
      if (erros.length) { toast(erros[0], "erro"); return false; }
      const dados = { turmaId, turma: turmas.find(x => x.id === turmaId)?.nome || "", semestre, materia,
        professores: [...caixa.querySelectorAll("fieldset input:checked")].map(c => c.value), topicos: t.topicos, provas: pv.provas,
        observacoes: $("#plObs", caixa).value.trim().slice(0, 2000), atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email };
      if (p && !(await confirmar(`Salvar as alterações no plano de ${materia} (${rotuloSemestre(semestre)})?`, { titulo: "Salvar plano", ok: "Salvar" }))) return false;
      try {
        if (p) await updateDoc(doc(db, "planos", p.id), dados);
        else await addDoc(collection(db, "planos"), { ...dados, criadoEm: serverTimestamp(), criadoPor: ctx.eu.email });
      } catch (e) { toast(regrasErro(e), "erro"); return false; }
      return true;
    } });
  if (salvou) { toast("Plano salvo.", "ok"); carregarOrganizacao(); }
}
const regrasErro = e => String(e?.code || "").endsWith("permission-denied") ? "Sem permissão. Publique o firestore.rules atual no Firebase (regra de planos)." : traduzirErro(e);

// ---------- IA: no navegador (administrador principal, com a chave) ou no servidor (Cloudflare Worker) ----------
const temIA = () => !!ctx.iaCfg() || !!ctx.urlCorretor();
async function pedirIA(corpoServidor, noNavegador) {
  const cfg = ctx.iaCfg();
  if (cfg) return noNavegador(cfg);
  if (!ctx.urlCorretor()) throw new Error("A IA não está configurada: o administrador principal precisa salvar a chave ou o endereço do servidor em Configuração.");
  const token = await ctx.auth.currentUser.getIdToken();
  const r = await fetch(ctx.urlCorretor(), { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify({ acao: "organizar", ...corpoServidor }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || `Erro ${r.status} no servidor.`);
  return d;
}

async function lerPlano(p, arqId = null) {
  const arqs = arquivosPlano.get(p.id) || [];
  const a = arqs.find(x => x.id === arqId) || arqs[0];
  if (!a) return toast("Envie o PDF do plano primeiro.", "erro");
  if (!temIA()) return toast("A IA não está configurada (Configuração).", "erro");
  const tf = tarefa({ titulo: `Lendo o plano de ensino`, icone: "🤖", estimativaSeg: 60, texto: a.titulo });
  let r;
  try {
    r = await pedirIA({ tipo: "plano", planoId: p.id, arquivoId: a.id },
      async cfg => lerPlanoIA({ chave: cfg.chave, modelo: cfg.modelo, pdf: (await baixarMaterial(a.id, basePlano(p.id))).bytes, titulo: a.titulo, materia: p.materia, semestre: p.semestre }));
    tf.fim(`${r.topicos?.length || 0} tópico(s) encontrados: revise`);
  } catch (e) { tf.erro(e.message || traduzirErro(e)); return toast("🤖 " + (e.message || traduzirErro(e)), "erro"); }
  const juntar = (p.topicos || []).length > 0;
  const html = `<p class="pequeno" style="margin-top:0">A IA leu <b>${esc(a.titulo)}</b>${r.materia && chaveTexto(r.materia) !== chaveTexto(p.materia) ? ` (no PDF a matéria se chama <b>${esc(r.materia)}</b>; o nome cadastrado continua <b>${esc(p.materia)}</b>)` : ""}. <b>Revise e corrija</b> antes de salvar: a IA pode errar datas e nomes.</p>
    <label for="iaTop">Tópicos encontrados (${r.topicos.length}) — <span class="mono">Tópico | início | fim</span></label>
    <textarea id="iaTop" style="min-height:220px">${esc(textoTopicos(r.topicos))}</textarea>
    <label for="iaProv" style="margin-top:12px">Provas previstas (${r.provas.length}) — <span class="mono">Título | data | tópicos ;</span></label>
    <textarea id="iaProv" style="min-height:80px">${esc(textoProvas(r.provas))}</textarea>
    ${juntar ? `<label class="check" style="margin-top:12px"><input type="checkbox" id="iaSubst" checked> <span>Substituir os ${p.topicos.length} tópicos atuais <span class="pequeno">— desmarcado: junta os novos no fim, sem repetir</span></span></label>` : ""}`;
  const ok = await modal({ titulo: `🤖 Plano de ensino — ${p.materia}`, conteudo: html, ok: "Salvar no plano", cancelar: "Descartar", largo: true,
    antesDeConfirmar: async caixa => {
      const t = lerTopicos($("#iaTop", caixa).value, p.semestre), pv = lerProvasPrevistas($("#iaProv", caixa).value, p.semestre);
      if (t.erros.length || pv.erros.length) { toast([...t.erros, ...pv.erros][0], "erro"); return false; }
      const subst = !juntar || $("#iaSubst", caixa).checked;
      const atuais = subst ? [] : p.topicos || [], ja = new Set(atuais.map(x => chaveTexto(x.nome)));
      const topicos = [...atuais, ...t.topicos.filter(x => !ja.has(chaveTexto(x.nome)))];
      const provasPrev = subst ? pv.provas : [...(p.provas || []), ...pv.provas.filter(x => !(p.provas || []).some(y => chaveTexto(y.titulo) === chaveTexto(x.titulo)))];
      if (!(await confirmar(`${subst ? "Substituir" : "Juntar"} os tópicos e as provas previstas do plano de ${p.materia}? Fica com ${topicos.length} tópico(s) e ${provasPrev.length} prova(s) prevista(s).`, { titulo: "Salvar no plano", ok: "Salvar", perigo: subst && (p.topicos || []).length > 0 }))) return false;
      try { await updateDoc(doc(db, "planos", p.id), { topicos, provas: provasPrev, lidoPorIAEm: serverTimestamp(), atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email }); }
      catch (e) { toast(regrasErro(e), "erro"); return false; }
      return true;
    } });
  if (ok) { toast("Plano atualizado.", "ok"); carregarOrganizacao(); }
}

// ---------- tópicos das questões de um banco (aba Bancos → 🏷 Tópicos) ----------
export async function editarTopicosBanco(bancoId, aoSalvar = () => {}) {
  if (!ctx.podeEditar()) return;
  await listarPlanos().catch(() => {});
  if (!bancos.length) bancos = await ctx.listarBancos();
  const banco = bancos.find(b => b.id === bancoId);
  const qs = [...await ctx.questoesDoBanco(bancoId, true)].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  await listarCursos().catch(() => {});
  const topicosPlano = m => topicosDaMateria(m);
  const html = `
    <div class="grade">
      <div><label for="tbSemestre">Semestre do banco</label><select id="tbSemestre">${[...new Set([-2, -1, 0, 1, 2].map(d => semestreVizinho(semestreDe(), d)).concat(banco?.semestre || semestreDe(banco?.criadoEm || new Date())))].sort().reverse()
        .map(x => `<option value="${x}"${x === (banco?.semestre || semestreDe(banco?.criadoEm || new Date())) ? " selected" : ""}>${rotuloSemestre(x)}</option>`).join("")}</select></div>
      <div><label for="tbMateria">Matéria do banco</label><input type="text" id="tbMateria" list="tbMaterias" value="${esc(banco?.materia || "")}">
        <datalist id="tbMaterias">${materiasSugeridas().map(m => `<option value="${esc(m)}">`).join("")}</datalist></div>
      <div><label for="tbAplicar">Tópico para as marcadas</label>
        <div class="linha" style="flex-wrap:nowrap"><input type="text" id="tbAplicar" list="tbLista" placeholder="Escolha ou escreva"><button type="button" class="leve mini" id="tbAplicarBtn" style="flex:0 0 auto">Aplicar</button></div></div>
    </div>
    <div id="tbChips" class="cm-extra"></div>
    <div class="linha acoes" style="align-items:center;margin:8px 0">
      ${temIA() ? `<button type="button" class="leve mini" id="tbIA">🤖 Sugerir tópicos com IA</button><label class="check" style="margin:0"><input type="checkbox" id="tbIASo" checked> <span>só as sem tópico ("Geral")</span></label>` : `<span class="pequeno">IA não configurada: escreva os tópicos à mão.</span>`}
      <span id="tbMsg" class="pequeno" aria-live="polite"></span>
    </div>
    <datalist id="tbLista"></datalist>
    <div class="tabela tb-questoes"><table><tr><th><input type="checkbox" id="tbTodas" aria-label="Marcar todas"></th><th>#</th><th>Questão</th><th style="min-width:220px">Tópico</th></tr>
      ${qs.map(q => `<tr data-q="${q.id}"><td><input type="checkbox" data-marca="${q.id}" aria-label="Marcar a questão ${q.ordem}"></td><td class="pequeno">${q.ordem || ""}<br>${q.tipo === "dissertativa" ? "✍" : "🔘"}</td>
        <td class="pequeno tb-enun">${esc(String(q.enunciado || "").replace(/\s+/g, " ").slice(0, 180))}${String(q.enunciado || "").length > 180 ? "…" : ""}</td>
        <td><input type="text" data-tema="${q.id}" list="tbLista" value="${esc(String(q.tema || "").trim())}" placeholder="Geral"></td></tr>`).join("")}</table></div>
    <p class="pequeno">Mudar o tópico de questões que já estão em provas atualiza também o filtro de temas dessas provas, para o sorteio continuar com as mesmas questões. As tentativas já feitas não mudam.</p>`;
  const salvou = await modal({ titulo: `🏷 Tópicos — ${banco?.nome || bancoId}`, conteudo: html, ok: "Salvar tópicos", cancelar: "Cancelar", largo: true,
    aoAbrir: caixa => {
      const atualizarLista = () => {
        const doPlano = topicosPlano($("#tbMateria", caixa).value);
        const usados = [...caixa.querySelectorAll("[data-tema]")].map(i => i.value.trim()).filter(Boolean);
        $("#tbLista", caixa).innerHTML = ordenarTemas([...doPlano, ...usados]).map(t => `<option value="${esc(t)}">`).join("");
        $("#tbChips", caixa).innerHTML = doPlano.length ? `<span class="pequeno">Tópicos do plano de ensino / de curso (clique para usar):</span>` + doPlano.map(t => `<button type="button" class="tag tag-botao" data-chip="${esc(t)}">${esc(t)}</button>`).join("")
          : `<span class="pequeno">Nenhum plano de curso ou de ensino com esta matéria (aba Organização). A IA cria os tópicos a partir das questões.</span>`;
        caixa.querySelectorAll("[data-chip]").forEach(b => b.onclick = () => { $("#tbAplicar", caixa).value = b.dataset.chip; });
      };
      atualizarLista();
      $("#tbMateria", caixa).onchange = atualizarLista;
      $("#tbTodas", caixa).onchange = e => caixa.querySelectorAll("[data-marca]").forEach(c => c.checked = e.target.checked);
      $("#tbAplicarBtn", caixa).onclick = () => {
        const v = $("#tbAplicar", caixa).value.trim(), marc = [...caixa.querySelectorAll("[data-marca]:checked")];
        if (!marc.length) return toast("Marque as questões primeiro.", "erro");
        marc.forEach(c => { const i = caixa.querySelector(`[data-tema="${c.dataset.marca}"]`); i.value = v; i.classList.add("mudou"); });
        atualizarLista();
      };
      caixa.querySelectorAll("[data-tema]").forEach(i => i.oninput = () => i.classList.add("mudou"));
      const btn = $("#tbIA", caixa);
      if (btn) btn.onclick = async () => {
        const so = $("#tbIASo", caixa).checked, materia = $("#tbMateria", caixa).value.trim();
        const alvo = qs.filter(q => !so || !String(caixa.querySelector(`[data-tema="${q.id}"]`).value || "").trim() || chaveTexto(caixa.querySelector(`[data-tema="${q.id}"]`).value) === "geral");
        if (!alvo.length) return toast("Todas as questões já têm tópico. Desmarque \"só as sem tópico\" para refazer todas.", "info");
        btn.disabled = true; $("#tbMsg", caixa).textContent = `🤖 Classificando ${alvo.length} questão(ões)…`;
        const tf = tarefa({ titulo: "Classificando questões por tópico", icone: "🏷", total: alvo.length });
        try {
          const tops = topicosPlano(materia);
          const r = await pedirIA({ tipo: "topicos", bancoId, materia, topicos: tops, qids: alvo.map(q => q.id) },
            async cfg => ({ topicos: await classificarTopicosIA({ chave: cfg.chave, modelo: cfg.modelo, materia, topicos: tops, questoes: alvo.map(q => ({ id: q.id, tipo: q.tipo, enunciado: q.enunciado, tema: temaDe(q) })),
              progresso: (i, n) => { $("#tbMsg", caixa).textContent = `🤖 Classificando… ${i} de ${n}`; tf.total(n).passo(i); } }) }));
          let n = 0;
          for (const [id, t] of Object.entries(r.topicos || {})) { const i = caixa.querySelector(`[data-tema="${id}"]`); if (i && i.value.trim() !== t) { i.value = t; i.classList.add("mudou", "ia"); n++; } }
          $("#tbMsg", caixa).textContent = `🤖 ${n} tópico(s) sugerido(s), destacados em azul. Revise e salve.`; tf.fim(`${n} tópico(s) sugerido(s)`);
          atualizarLista();
        } catch (e) { tf.erro(e.message || traduzirErro(e)); $("#tbMsg", caixa).textContent = ""; toast("🤖 " + (e.message || traduzirErro(e)), "erro"); }
        btn.disabled = false;
      };
    },
    antesDeConfirmar: async caixa => {
      const novo = Object.fromEntries([...caixa.querySelectorAll("[data-tema]")].map(i => [i.dataset.tema, i.value.trim().slice(0, 120)]));
      const materia = $("#tbMateria", caixa).value.trim();
      const mudou = qs.filter(q => chaveTexto(novo[q.id] || "") !== chaveTexto(temaDe(q))).length;
      if (!(await confirmar(`Salvar os tópicos do banco${mudou ? ` (${mudou} questão(ões) mudam de tópico)` : ""}? As provas que usam estes tópicos são ajustadas junto.`, { titulo: "Salvar tópicos", ok: "Salvar" }))) return false;
      try { await salvarTopicos(bancoId, qs, novo, { materia, semestre: $("#tbSemestre", caixa).value }); }
      catch (e) { toast(regrasErro(e), "erro"); return false; }
      return true;
    } });
  if (salvou) { toast("Tópicos salvos.", "ok"); ctx.invalidarBanco(bancoId); aoSalvar(); }
}
// grava os temas mudados, a matéria e a lista de temas do banco, e corrige o filtro de temas das provas que usam o banco
async function salvarTopicos(bancoId, qs, novo, extra) {
  const mudadas = qs.filter(q => (novo[q.id] ?? "") !== String(q.tema || "").trim());
  const depois = qs.map(q => ({ ...q, tema: novo[q.id] ?? q.tema }));
  const ops = mudadas.map(q => [doc(db, "bancos", bancoId, "questoes", q.id), { tema: novo[q.id] }]);
  ops.push([doc(db, "bancos", bancoId), { ...extra, temas: ordenarTemas(depois.map(temaDe)) }]);
  if (mudadas.length) {
    const antesTema = Object.fromEntries(qs.map(q => [q.id, temaDe(q)])), depoisTema = Object.fromEntries(depois.map(q => [q.id, temaDe(q)]));
    const ps = (await getDocs(collection(db, "provas"))).docs.map(d => ({ id: d.id, ...d.data() })).filter(p => bancosDaProva(p).includes(bancoId));
    for (const p of ps) {
      const s = temasDoBanco(p, bancoId);
      if (!s) continue;   // prova com todos os temas: continua com todos
      const nova = ordenarTemas(qs.filter(q => s.has(antesTema[q.id])).map(q => depoisTema[q.id]));
      if (nova.join("\u0000") === ordenarTemas([...s]).join("\u0000")) continue;
      const upd = { [`temasPorBanco.${bancoId}`]: nova };
      if (p.bancoId === bancoId) upd.temas = nova;
      ops.push([doc(db, "provas", p.id), upd]);
    }
  }
  for (let i = 0; i < ops.length; i += 400) {
    const lote = writeBatch(db);
    ops.slice(i, i + 400).forEach(([ref, d]) => lote.update(ref, d));
    await lote.commit();
  }
}

// ---------- plano de curso (todas as matérias do curso) ----------
// cursos/{id} = { nome, materias: [{ nome, modulo, cargaHoraria, topicos: [nome] }], ... }; turmas/{id}.cursoId liga a turma
const textoCurso = ms => (ms || []).map(m => `# ${[m.nome, m.modulo || "", m.cargaHoraria ? m.cargaHoraria + "h" : ""].join(" | ").replace(/( \| )+$/, "")}\n${(m.topicos || []).join("\n")}`).join("\n\n");
function lerTextoCurso(txt) {
  const ms = [], erros = []; let atual = null;
  for (const l of String(txt || "").split("\n").map(x => x.trim()).filter(Boolean)) {
    if (l.startsWith("#")) {
      const [nome, modulo, ch] = l.replace(/^#+\s*/, "").split("|").map(x => x.trim());
      if (!nome) continue;
      if (ms.some(m => chaveTexto(m.nome) === chaveTexto(nome))) erros.push(`Matéria repetida: ${nome}.`);
      atual = { nome: nome.slice(0, 120), modulo: (modulo || "").slice(0, 60), cargaHoraria: Math.max(0, parseInt(ch) || 0), topicos: [] }; ms.push(atual);
    } else if (!atual) erros.push(`"${l}": comece a matéria com # (ex.: # Banco de Dados | 2º semestre | 80h).`);
    else if (!atual.topicos.some(t => chaveTexto(t) === chaveTexto(l))) atual.topicos.push(l.replace(/^[-•*]\s*/, "").slice(0, 120));
  }
  return { materias: ms, erros };
}
function desenharCursos() {
  const box = $("#orgCursos"); if (!box) return;
  const pode = ctx.podeEditar();
  const aberto = box.querySelector("details.bloco-linha")?.open ? "open" : "";
  box.innerHTML = `<details class="card sem-padding bloco-linha" ${aberto}><summary class="sub-cab"><span class="ch ch-esq" aria-hidden="true">${ic("chev")}</span><span class="sc-tile">${ic("book", { size: 20 })}</span><span class="sc-texto"><span class="sc-titulo">Planos de curso</span><span class="sc-resumo">${pl(cursos.length, "plano")} · trazem todas as matérias com os tópicos</span></span>
      ${pode ? `<span class="sc-fim"><button class="leve mini" id="cursoNovo" type="button">${ic("plus", { size: 16 })}Plano de curso</button></span>` : ""}</summary><div class="bloco-linha-corpo">
    <p class="help" style="max-width:none">Com o plano de curso, cada matéria já nasce com os tópicos; o plano de ensino (opcional) fica para as <b>datas das provas</b>.</p>` +
    (cursos.length ? cursos.map(c => {
      const ts = turmas.filter(t => t.cursoId === c.id), arqs = arquivosCurso.get(c.id) || [];
      return `<details class="grupo-semestre curso-item"><summary><span class="gs-nome">📘 ${esc(c.nome)}</span><span class="tag">${(c.materias || []).length} matéria(s)</span>
          <span class="tag">${(c.materias || []).reduce((n, m) => n + (m.topicos || []).length, 0)} tópicos</span>${ts.length ? `<span class="pequeno">👥 ${ts.map(t => esc(t.nome)).join(", ")}</span>` : `<span class="tag aviso">nenhuma turma ligada</span>`}</summary>
        <div class="gt-corpo"><div class="cursos-materias">${(c.materias || []).map(m => `<div class="curso-mat"><b>${esc(m.nome)}</b> <span class="pequeno">${[m.modulo, m.cargaHoraria ? m.cargaHoraria + "h" : ""].filter(Boolean).map(esc).join(" · ")}</span>
            <div>${(m.topicos || []).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div></div>`).join("") || `<p class="pequeno">Nenhuma matéria ainda. Envie o PDF e peça para a IA ler, ou use ✎ Editar.</p>`}</div>
          <div class="cm-acoes">${arqs.map(a => `<span class="item-arq"><button class="leve mini" type="button" data-vercurso="${c.id}" data-arq="${a.id}">📄 ${esc(a.titulo)}</button>${pode ? `<button class="discreto mini perigo-txt" type="button" data-delarqcurso="${c.id}" data-arq="${a.id}" aria-label="Apagar o PDF">✕</button>` : ""}</span>`).join("")}
            ${pode ? `<button class="leve mini" type="button" data-editcurso="${c.id}">✎ Editar</button>
            <button data-ajuda-item="planoCurso"></button><label class="botao-arquivo leve mini">⬆ PDF do plano de curso<input type="file" accept="application/pdf,.pdf" hidden data-enviarcurso="${c.id}"></label>
            ${arqs.length ? `<button class="leve mini" type="button" data-lercurso="${c.id}">🤖 Ler plano de curso com IA</button>` : ""}
            ${ctx.ehAdmin() ? `<button class="discreto mini perigo-txt" type="button" data-delcurso="${c.id}" aria-label="Apagar o plano de curso">🗑</button>` : ""}` : ""}</div></div></details>`;
    }).join("") : `<p class="help">Nenhum plano de curso ainda.${pode ? " Clique em <b>Plano de curso</b>, dê o nome do curso e envie o PDF (pode ser só a parte das matérias)." : ""}</p>`) + `</div></details>`;
  const curso = id => cursos.find(c => c.id === id);
  $("#cursoNovo")?.addEventListener("click", () => editarCurso(null));
  box.querySelectorAll("[data-editcurso]").forEach(b => b.onclick = () => editarCurso(curso(b.dataset.editcurso)));
  box.querySelectorAll("[data-vercurso]").forEach(b => b.onclick = () => abrirMaterialEmAba(b.dataset.arq, traduzirErro, baseCurso(b.dataset.vercurso)).catch(e => toast(e.message, "erro")));
  box.querySelectorAll("[data-delarqcurso]").forEach(b => b.onclick = async () => {
    if (!(await confirmar("Apagar este PDF do plano de curso?", { titulo: "Apagar PDF", ok: "Apagar", perigo: true }))) return;
    try { await apagarMaterial(b.dataset.arq, baseCurso(b.dataset.delarqcurso)); arquivosCurso.set(b.dataset.delarqcurso, (arquivosCurso.get(b.dataset.delarqcurso) || []).filter(a => a.id !== b.dataset.arq)); desenhar(); }
    catch (e) { toast(traduzirErro(e), "erro"); }
  });
  box.querySelectorAll("[data-enviarcurso]").forEach(inp => inp.onchange = async () => {
    const f = inp.files[0], id = inp.dataset.enviarcurso; inp.value = ""; if (!f) return;
    try {
      toast(`Enviando ${f.name}…`);
      const a = await enviarMaterial(f, f.name.replace(/\.pdf$/i, ""), ctx.eu.email, () => {}, baseCurso(id));
      arquivosCurso.set(id, [a, ...(arquivosCurso.get(id) || [])]); desenhar();
      if (temIA() && await confirmar("PDF enviado. Quer que a IA leia agora e liste as matérias com os tópicos? Você revisa antes de salvar.", { titulo: "🤖 Ler plano de curso", ok: "Ler com IA", cancelar: "Agora não" })) lerCurso(curso(id), a.id);
    } catch (e) { toast(erroMaterial(e, traduzirErro), "erro"); }
  });
  box.querySelectorAll("[data-lercurso]").forEach(b => b.onclick = () => lerCurso(curso(b.dataset.lercurso)));
  box.querySelectorAll("[data-delcurso]").forEach(b => b.onclick = async () => {
    const c = curso(b.dataset.delcurso);
    if (!(await confirmar(`Apagar o plano de curso ${c.nome}? Planos de ensino, provas e bancos não mudam.`, { titulo: "Apagar plano de curso", ok: "Apagar", perigo: true }))) return;
    try {
      for (const a of arquivosCurso.get(c.id) || []) await apagarMaterial(a.id, baseCurso(c.id));
      for (const t of turmas.filter(t => t.cursoId === c.id)) await updateDoc(doc(db, "turmas", t.id), { cursoId: null });
      await deleteDoc(doc(db, "cursos", c.id)); toast("Plano de curso apagado.", "ok"); carregarOrganizacao();
    } catch (e) { toast(regrasErro(e), "erro"); }
  });
}
async function editarCurso(c) {
  const html = `<div class="grade"><div class="col-2"><label for="cuNome">Nome do curso</label><input type="text" id="cuNome" value="${esc(c?.nome || "")}" placeholder="Técnico em Desenvolvimento de Sistemas"></div></div>
    <fieldset class="temas-box"><legend>Turmas deste curso</legend><div class="lista-temas">${turmas.map(t => `<label class="check"><input type="checkbox" value="${t.id}"${t.cursoId && t.cursoId === c?.id ? " checked" : ""}> <span>${esc(nomeTurma(t))}${t.cursoId && t.cursoId !== c?.id ? ` <span class="pequeno">(hoje em ${esc(cursos.find(x => x.id === t.cursoId)?.nome || "outro curso")})</span>` : ""}</span></label>`).join("") || `<p class="pequeno">Nenhuma turma.</p>`}</div></fieldset>
    <label for="cuMaterias">Matérias e tópicos — a matéria começa com <span class="mono">#</span>: <span class="mono"># Matéria | módulo | carga horária</span>, e os tópicos vêm um por linha embaixo</label>
    <textarea id="cuMaterias" style="min-height:260px" placeholder="# Banco de Dados | 2º semestre | 80h
Modelo conceitual (DER)
DDL - CREATE TABLE
Chave estrangeira

# Front-End | 1º semestre | 60h
HTML semântico
CSS - Flexbox">${esc(textoCurso(c?.materias))}</textarea>
    <p class="pequeno">Mais fácil: salve só o nome e as turmas, envie o PDF do plano de curso no cartão e clique em 🤖 Ler plano de curso com IA.</p>`;
  const ok = await modal({ titulo: c ? `Editar plano de curso — ${c.nome}` : "Novo plano de curso", conteudo: html, ok: "Salvar", cancelar: "Cancelar", largo: true,
    antesDeConfirmar: async caixa => {
      const nome = $("#cuNome", caixa).value.trim(), { materias, erros } = lerTextoCurso($("#cuMaterias", caixa).value);
      if (!nome) { toast("Dê o nome do curso.", "erro"); return false; }
      if (erros.length) { toast(erros[0], "erro"); return false; }
      const marcadas = new Set([...caixa.querySelectorAll("fieldset input:checked")].map(x => x.value));
      try {
        let id = c?.id;
        const dados = { nome, materias, atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email };
        if (id && !(await confirmar(`Salvar as alterações no plano de curso ${nome}?`, { titulo: "Salvar plano de curso", ok: "Salvar" }))) return false;
        if (id) await updateDoc(doc(db, "cursos", id), dados);
        else id = (await addDoc(collection(db, "cursos"), { ...dados, criadoEm: serverTimestamp(), criadoPor: ctx.eu.email })).id;
        for (const t of turmas) {
          const quer = marcadas.has(t.id);
          if (quer && t.cursoId !== id) await updateDoc(doc(db, "turmas", t.id), { cursoId: id });
          if (!quer && t.cursoId === id) await updateDoc(doc(db, "turmas", t.id), { cursoId: null });
        }
      } catch (e) { toast(regrasErro(e), "erro"); return false; }
      return true;
    } });
  if (ok) { toast("Plano de curso salvo.", "ok"); carregarOrganizacao(); }
}
async function lerCurso(c, arqId = null) {
  const arqs = arquivosCurso.get(c.id) || [], a = arqs.find(x => x.id === arqId) || arqs[0];
  if (!a) return toast("Envie o PDF do plano de curso primeiro.", "erro");
  if (!temIA()) return toast("A IA não está configurada (Configuração).", "erro");
  const tf = tarefa({ titulo: "Lendo o plano de curso", icone: "🤖", estimativaSeg: 90, texto: a.titulo });
  let r;
  try {
    r = await pedirIA({ tipo: "curso", cursoId: c.id, arquivoId: a.id },
      async cfg => lerCursoIA({ chave: cfg.chave, modelo: cfg.modelo, pdf: (await baixarMaterial(a.id, baseCurso(c.id))).bytes, titulo: a.titulo, nome: c.nome }));
    tf.fim(`${r.materias?.length || 0} matéria(s) encontradas: revise`);
  } catch (e) { tf.erro(e.message || traduzirErro(e)); return toast("🤖 " + (e.message || traduzirErro(e)), "erro"); }
  const tem = (c.materias || []).length > 0;
  const html = `<p class="pequeno" style="margin-top:0">A IA achou <b>${r.materias.length} matéria(s)</b> em <b>${esc(a.titulo)}</b>. <b>Revise</b> antes de salvar: corrija nomes de matéria para ficarem iguais aos dos bancos de questões.</p>
    <textarea id="iaCurso" style="min-height:340px">${esc(textoCurso(r.materias))}</textarea>
    ${tem ? `<label class="check" style="margin-top:12px"><input type="checkbox" id="iaCursoSubst"> <span>Substituir as ${c.materias.length} matérias atuais <span class="pequeno">— desmarcado: junta (matéria que já existe ganha os tópicos novos)</span></span></label>` : ""}`;
  const ok = await modal({ titulo: `🤖 Plano de curso — ${c.nome}`, conteudo: html, ok: "Salvar no plano de curso", cancelar: "Descartar", largo: true,
    antesDeConfirmar: async caixa => {
      const { materias, erros } = lerTextoCurso($("#iaCurso", caixa).value);
      if (erros.length) { toast(erros[0], "erro"); return false; }
      let final = materias;
      if (tem && !$("#iaCursoSubst", caixa).checked) {
        final = (c.materias || []).map(m => ({ ...m, topicos: [...m.topicos] }));
        for (const m of materias) {
          const x = final.find(y => chaveTexto(y.nome) === chaveTexto(m.nome));
          if (!x) final.push(m); else m.topicos.forEach(t => { if (!x.topicos.some(y => chaveTexto(y) === chaveTexto(t))) x.topicos.push(t); });
        }
      }
      if (!(await confirmar(`Salvar ${final.length} matéria(s) no plano de curso ${c.nome}${tem && $("#iaCursoSubst", caixa).checked ? ", substituindo as atuais" : ""}?`, { titulo: "Salvar plano de curso", ok: "Salvar", perigo: !!(tem && $("#iaCursoSubst", caixa).checked) }))) return false;
      try { await updateDoc(doc(db, "cursos", c.id), { materias: final, lidoPorIAEm: serverTimestamp(), atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email }); }
      catch (e) { toast(regrasErro(e), "erro"); return false; }
      return true;
    } });
  if (ok) { toast("Plano de curso atualizado.", "ok"); carregarOrganizacao(); }
}
// dentro da turma: o curso dela e as matérias do curso que ainda não têm cartão no semestre
function cursoDaTurmaHTML(t, sm) {
  const c = cursos.find(x => x.id === t.cursoId);
  if (!c) return ctx.podeEditar() && cursos.length ? `<p class="pequeno" style="margin:0 4px 10px">📘 Turma sem plano de curso: ligue em <b>📘 Planos de curso → ✎ Editar</b>.</p>` : "";
  const sem = $("#orgSemestre").value || semestreDe();
  const usadas = new Set([...(sm.get(sem)?.keys() || [])]);
  const livres = (c.materias || []).filter(m => !usadas.has(chaveTexto(m.nome)));
  return `<details class="curso-turma"><summary>📘 <b>${esc(c.nome)}</b> <span class="pequeno">· ${(c.materias || []).length} matérias no plano de curso${livres.length ? ` · ${livres.length} sem cartão em ${rotuloSemestre(sem)}` : ""}</span></summary>
    <div class="op-pilulas" style="margin:8px 0">${livres.map(m => `<button type="button" data-matcurso="${t.id}|${sem}|${esc(m.nome)}" title="${esc((m.topicos || []).join(" · "))}">+ ${esc(m.nome)}${m.modulo ? ` <span class="pequeno">(${esc(m.modulo)})</span>` : ""}</button>`).join("") || `<span class="pequeno">Todas as matérias do curso já têm cartão neste semestre.</span>`}</div>
    <p class="pequeno">Clique na matéria para criar o cartão dela em ${rotuloSemestre(sem)} (já com os tópicos do plano de curso; as datas das provas você coloca depois).</p></details>`;
}
