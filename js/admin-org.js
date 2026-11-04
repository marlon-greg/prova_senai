// Painel → aba "🏫 Organização": Turma → Semestre → Matéria → Tópicos.
// planos/{id} = uma matéria de uma turma num semestre (o "plano de ensino"):
//   { turmaId, turma, semestre: "2026-2", materia, professores: [email], topicos: [{ nome, inicio, fim }],
//     provas: [{ titulo, data, topicos: [nome] }], observacoes, criadoEm, atualizadoEm, atualizadoPor }
// planos/{id}/arquivos/{a} (+ partes) = o PDF do plano (mesmo formato de js/material.js).
// A prova liga na matéria por turma + semestre + matéria (prova.semestre / prova.materia; provas antigas: data de criação e matéria do banco).
// O tópico de uma questão é o campo "tema" dela (o mesmo que filtra o sorteio da prova).
import { db, esc, $, toast, modal, confirmar, traduzirErro, temaDe, ordenarTemas, bancosDaProva, temasDoBanco,
         semestreDe, rotuloSemestre, semestreVizinho, chaveTexto, semestreDaProva, materiaDaProva, dataCurta, nomeTurma } from "./common.js";
import { enviarMaterial, listarMateriais, apagarMaterial, baixarMaterial, abrirMaterialEmAba, tamanhoTexto, erroMaterial } from "./material.js";
import { lerPlanoIA, classificarTopicosIA } from "./ia.js";
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let ctx = null;
// ctx = { eu, podeEditar, ehAdmin, auth, iaCfg, urlCorretor, listarTurmas, alunosDaTurma, listarBancos, questoesDoBanco,
//         invalidarBanco, novaProva({ turmaId, semestre, materia, data, titulo }), abrirResultados(provaId) }
let planos = [], provas = [], bancos = [], turmas = [], equipe = [];
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
// matérias sugeridas para uma turma/semestre (planos primeiro, depois as dos bancos)
export function materiasSugeridas(turmaId, semestre) {
  const dos = planos.filter(p => (!turmaId || p.turmaId === turmaId) && (!semestre || p.semestre === semestre)).map(p => p.materia);
  const out = [], vistos = new Set();
  for (const m of [...dos, ...planos.map(p => p.materia), ...bancos.map(b => b.materia)]) {
    const k = chaveTexto(m); if (k && !vistos.has(k)) { vistos.add(k); out.push(String(m).trim()); }
  }
  return out;
}

export async function carregarOrganizacao() {
  $("#orgArvore").innerHTML = `<p class="pequeno">Carregando…</p>`;
  try {
    const [ts, bs, , ps, eq] = await Promise.all([ctx.listarTurmas(), ctx.listarBancos(), listarPlanos(),
      getDocs(collection(db, "provas")), getDocs(collection(db, "equipe")).catch(() => null)]);
    turmas = ts; bancos = bs; provas = ps.docs.map(d => ({ id: d.id, ...d.data() }));
    equipe = eq ? eq.docs.map(d => ({ email: d.id, ...d.data() })) : [];
    await Promise.all(bancos.map(b => ctx.questoesDoBanco(b.id).catch(() => [])));
    await Promise.all(planos.map(p => listarMateriais(basePlano(p.id)).then(l => arquivosPlano.set(p.id, l)).catch(() => arquivosPlano.set(p.id, []))));
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
  const box = $("#orgArvore");
  if (!turmas.length) { box.innerHTML = `<div class="vazio"><div class="icone">🏫</div><p>Cadastre as turmas na aba <b>Turmas</b> primeiro.</p></div>`; $("#orgContagem").textContent = ""; return; }
  const fT = $("#orgTurma").value, fS = $("#orgSemestre").value, busca = chaveTexto($("#orgBusca").value);
  const arv = montar(), atual = semestreDe();
  let nMat = 0, nTop = 0;
  const html = turmas.filter(t => !fT || t.id === fT).map(t => {
    const sm = arv.get(t.id) || new Map();
    const sems = [...sm.keys()].filter(s => !fS || s === fS).sort().reverse();
    const blocos = sems.map(s => {
      const cards = [...sm.get(s).values()].filter(n => !busca || chaveTexto(n.materia).includes(busca)
        || (n.plano?.topicos || []).some(x => chaveTexto(x.nome).includes(busca)) || n.provas.some(p => chaveTexto(p.titulo).includes(busca)))
        .sort((a, b) => ordemNatural(a.materia || "~", b.materia || "~"));
      if (!cards.length) return "";
      nMat += cards.length; nTop += cards.reduce((x, n) => x + (n.plano?.topicos?.length || 0), 0);
      const id = `s:${t.id}:${s}`, aberto = busca || fS || (s === atual ? !fechados.has(id) : abertos.has(id));
      return `<details class="grupo-semestre" data-g="${id}" ${aberto ? "open" : ""}>
        <summary><span class="gs-nome">📅 ${rotuloSemestre(s)}</span>${s === atual ? `<span class="tag on">atual</span>` : ""}
          <span class="tag">${cards.length} matéria(s)</span><span class="tag">${cards.reduce((x, n) => x + n.provas.length, 0)} prova(s)</span></summary>
        <div class="cartoes-materias">${cards.map(n => cartaoMateria(t, s, n)).join("")}</div></details>`;
    }).join("");
    if ((fS || busca) && !blocos) return "";
    const id = `t:${t.id}`, aberto = busca || fT || !fechados.has(id);
    return `<details class="grupo-turma" data-g="${id}" ${aberto ? "open" : ""}>
      <summary><span class="gt-nome">👥 ${esc(nomeTurma(t))}</span><span class="pequeno">${ctx.alunosDaTurma(t).length} alunos</span>
        ${ctx.podeEditar() ? `<button class="leve mini" data-novo-t="${t.id}" type="button">+ Matéria</button>` : ""}</summary>
      <div class="gt-corpo">${blocos || `<p class="pequeno" style="margin:0 16px 14px">Nenhuma matéria ${fS ? `em ${rotuloSemestre(fS)}` : "ainda"}. Use <b>+ Matéria</b> para cadastrar o plano de ensino.</p>`}</div></details>`;
  }).join("");
  $("#orgContagem").textContent = `${nMat} matéria(s) · ${nTop} tópico(s) nos planos`;
  box.innerHTML = html || `<div class="vazio"><div class="icone">🔎</div><p>Nada encontrado com esses filtros.</p></div>`;
  ligarArvore(box);
}

function estadoTopico(x) {
  const h = hoje();
  if (!x.inicio && !x.fim) return "";
  if (x.inicio && h < x.inicio) return "previsto";
  if (x.fim && h > x.fim) return "dado";
  return "andamento";
}
const ROT_ESTADO = { previsto: "🗓 previsto", andamento: "▶ em andamento", dado: "✓ dado" };
const periodo = x => x.inicio || x.fim ? `${dataCurta(x.inicio) || "?"}${x.fim && x.fim !== x.inicio ? ` – ${dataCurta(x.fim)}` : ""}` : "";

function cartaoMateria(t, s, n) {
  const p = n.plano, chaveM = chaveTexto(n.materia);
  // bancos da matéria: os de mesma matéria + os usados pelas provas dela
  const bIds = new Set([...bancos.filter(b => chaveM && chaveTexto(b.materia) === chaveM).map(b => b.id), ...n.provas.flatMap(bancosDaProva)]);
  const cont = {}; for (const b of bIds) for (const [k, v] of Object.entries(contagemTopicos(b))) cont[k] = (cont[k] || 0) + v;
  const emProva = {}; for (const pr of n.provas) for (const k of topicosDaProva(pr)) (emProva[k] ||= []).push(pr.titulo);
  const topicos = p?.topicos || [];
  const doPlano = new Set(topicos.map(x => chaveTexto(x.nome)));
  const soBanco = Object.keys(cont).filter(k => !doPlano.has(k));
  const nomeDe = k => { for (const b of bIds) { const q = (ctx.questoesDoBancoCache(b) || []).find(q => chaveTexto(temaDe(q)) === k); if (q) return temaDe(q); } return k; };
  const dados = topicos.filter(x => estadoTopico(x) === "dado").length;
  const profs = (p?.professores || []).map(e => equipe.find(x => x.email === e)?.nome || e);
  const arqs = p ? arquivosPlano.get(p.id) || [] : [];
  const prevs = p?.provas || [];
  const pode = ctx.podeEditar();
  const linhaProva = pr => `<li><span class="tag ${pr.liberada ? "on" : "off"}">${pr.liberada ? "● liberada" : "○ fechada"}</span>
      <b>${esc(pr.titulo)}</b> ${pr.dataProva ? `<span class="pequeno">${dataCurta(pr.dataProva)}</span>` : ""}
      <button class="discreto mini" data-res="${pr.id}" type="button" title="Abrir os resultados">📊 Resultados</button></li>`;
  const feita = pv => n.provas.some(pr => chaveTexto(pr.titulo) === chaveTexto(pv.titulo) || (pv.data && pr.dataProva === pv.data));
  return `<article class="cartao-materia${p ? "" : " sem-plano"}">
    <div class="cm-topo">
      <div><h3>📚 ${esc(n.materia || "Sem matéria")}</h3>
        <span class="pequeno">${profs.length ? `👤 ${profs.map(esc).join(", ")}` : p ? "sem professor definido" : "⚠ sem plano de ensino cadastrado"}</span></div>
      ${topicos.length ? `<div class="cm-progresso" title="Tópicos já dados, pelas datas do plano"><b>${dados}/${topicos.length}</b><span>tópicos dados</span>
        <div class="barra"><i style="width:${Math.round(dados / topicos.length * 100)}%"></i></div></div>` : ""}
    </div>
    ${topicos.length ? `<ol class="lista-topicos">${topicos.map(x => {
      const k = chaveTexto(x.nome), e = estadoTopico(x), nq = cont[k] || 0, ep = emProva[k] || [];
      return `<li class="topico${e ? " e-" + e : ""}"><span class="tp-nome">${esc(x.nome)}</span>
        ${periodo(x) ? `<span class="pequeno">${periodo(x)}</span>` : ""}${e ? `<span class="tag ${e === "dado" ? "ok" : e === "andamento" ? "nota" : "off"}">${ROT_ESTADO[e]}</span>` : ""}
        <span class="tag ${nq ? "" : "aviso"}" title="Questões com este tópico nos bancos da matéria">📝 ${nq} questão(ões)</span>
        ${ep.length ? `<span class="tag nota" title="${esc(ep.join(" · "))}">🧪 em ${ep.length} prova(s)</span>` : ""}</li>`;
    }).join("")}</ol>` : p ? `<p class="pequeno">Nenhum tópico ainda. ${pode ? "Use <b>✎ Editar</b> ou envie o PDF do plano e peça para a IA ler." : ""}</p>` : ""}
    ${soBanco.length ? `<div class="cm-extra"><span class="pequeno">${p ? "Tópicos nos bancos, fora do plano:" : "Tópicos nos bancos:"}</span>
      ${soBanco.map(k => `<span class="tag${k === "geral" ? " aviso" : ""}" title="${k === "geral" ? "Questões sem tópico: use 🏷 Tópicos na aba Bancos" : ""}">${esc(nomeDe(k))} · ${cont[k]}</span>`).join("")}</div>` : ""}
    <div class="cm-provas"><span class="rotulo">Provas</span>
      ${n.provas.length ? `<ul>${n.provas.sort((a, b) => String(a.dataProva || "").localeCompare(String(b.dataProva || "")) || ordemNatural(a.titulo, b.titulo)).map(linhaProva).join("")}</ul>` : `<p class="pequeno" style="margin:2px 0">Nenhuma prova criada.</p>`}
      ${prevs.filter(pv => !feita(pv)).map(pv => `<div class="prevista">🗓 <b>Prevista:</b> ${esc(pv.titulo)}${pv.data ? ` · ${dataCurta(pv.data)}` : ""}${pv.topicos?.length ? ` <span class="pequeno">(${pv.topicos.map(esc).join(", ")})</span>` : ""}
        ${pode ? `<button class="leve mini" type="button" data-criar="${p.id}" data-titulo="${esc(pv.titulo)}" data-data="${pv.data || ""}" data-tops="${esc(JSON.stringify(pv.topicos || []))}">+ Criar</button>` : ""}</div>`).join("")}
    </div>
    ${p?.observacoes ? `<p class="pequeno cm-obs">📝 ${esc(p.observacoes)}</p>` : ""}
    <div class="cm-acoes">
      ${arqs.map(a => `<span class="item-arq"><button class="leve mini" type="button" data-verarq="${p.id}" data-arq="${a.id}" title="Abrir o PDF">📄 ${esc(a.titulo)}</button>${pode ? `<button class="discreto mini perigo-txt" type="button" data-delarq="${p.id}" data-arq="${a.id}" aria-label="Apagar o PDF ${esc(a.titulo)}">✕</button>` : ""}</span>`).join("")}
      ${pode && p ? `<button class="leve mini" type="button" data-editar="${p.id}">✎ Editar</button>
        <label class="botao-arquivo leve mini">⬆ PDF do plano<input type="file" accept="application/pdf,.pdf" hidden data-enviar="${p.id}"></label>
        ${arqs.length ? `<button class="leve mini" type="button" data-ler="${p.id}" title="A IA lê o PDF e preenche os tópicos e as provas previstas (você revisa antes de salvar)">🤖 Ler plano com IA</button>` : ""}
        <button class="leve mini" type="button" data-criar="${p.id}">+ Nova prova</button>
        ${ctx.ehAdmin() ? `<button class="discreto mini perigo-txt" type="button" data-delplano="${p.id}" aria-label="Apagar o plano">🗑</button>` : ""}` : ""}
      ${pode && !p ? `<button class="mini" type="button" data-cadastrar="${t.id}|${s}|${esc(n.materia)}">+ Cadastrar plano desta matéria</button>` : ""}
    </div></article>`;
}

function ligarArvore(box) {
  box.querySelectorAll("details[data-g]").forEach(d => d.ontoggle = () => {
    if ($("#orgBusca").value || $("#orgTurma").value || $("#orgSemestre").value) return;
    const id = d.dataset.g; if (d.open) { fechados.delete(id); abertos.add(id); } else { fechados.add(id); abertos.delete(id); }
  });
  const plano = id => planos.find(p => p.id === id);
  box.querySelectorAll("[data-novo-t]").forEach(b => b.onclick = e => { e.preventDefault(); editarPlano(null, { turmaId: b.dataset.novoT, semestre: $("#orgSemestre").value || semestreDe() }); });
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
    <label for="plTopicos">Tópicos, na ordem do plano — um por linha: <span class="mono">Tópico | início | fim</span> (datas opcionais)</label>
    <textarea id="plTopicos" style="min-height:180px" placeholder="DDL - CREATE DATABASE e USE | 04/08 | 08/08
DDL - CREATE TABLE e tipos de dados | 11/08 | 22/08
Chave primária e estrangeira | 25/08 | 29/08
DCL - GRANT e REVOKE | 01/09">${esc(textoTopicos(v.topicos))}</textarea>
    <p class="pequeno" style="margin:4px 0 12px">Os nomes dos tópicos viram os <b>tópicos das questões</b> (aba Bancos → 🏷 Tópicos) e o filtro do sorteio da prova. Dica: envie o PDF do plano no cartão da matéria e peça para a IA preencher.</p>
    <label for="plProvas">Provas previstas — uma por linha: <span class="mono">Título | data | tópicos separados por ;</span></label>
    <textarea id="plProvas" style="min-height:80px" placeholder="Avaliação 1 — DDL | 29/08 | DDL - CREATE TABLE e tipos de dados; Chave primária e estrangeira">${esc(textoProvas(v.provas))}</textarea>
    <label for="plObs" style="margin-top:12px">Observações (opcional)</label>
    <textarea id="plObs" style="min-height:60px" placeholder="Ex.: o plano pode mudar; recuperação em dezembro.">${esc(v.observacoes || "")}</textarea>`;
  const salvou = await modal({ titulo: p ? `Editar plano — ${p.materia}` : "Nova matéria / plano de ensino", conteudo: html, ok: "Salvar", cancelar: "Cancelar", largo: true,
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
  toast(`🤖 Lendo ${a.titulo}… pode levar até 1 minuto.`);
  let r;
  try {
    r = await pedirIA({ tipo: "plano", planoId: p.id, arquivoId: a.id },
      async cfg => lerPlanoIA({ chave: cfg.chave, modelo: cfg.modelo, pdf: (await baixarMaterial(a.id, basePlano(p.id))).bytes, titulo: a.titulo, materia: p.materia, semestre: p.semestre }));
  } catch (e) { return toast("🤖 " + (e.message || traduzirErro(e)), "erro"); }
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
  const topicosPlano = m => { const out = [], v = new Set(); for (const p of planos.filter(p => chaveTexto(p.materia) === chaveTexto(m))) for (const t of p.topicos || []) if (!v.has(chaveTexto(t.nome))) { v.add(chaveTexto(t.nome)); out.push(t.nome); } return out; };
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
        $("#tbChips", caixa).innerHTML = doPlano.length ? `<span class="pequeno">Tópicos do plano de ensino (clique para usar):</span>` + doPlano.map(t => `<button type="button" class="tag tag-botao" data-chip="${esc(t)}">${esc(t)}</button>`).join("")
          : `<span class="pequeno">Nenhum plano de ensino com esta matéria (aba Organização). A IA cria os tópicos a partir das questões.</span>`;
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
        try {
          const tops = topicosPlano(materia);
          const r = await pedirIA({ tipo: "topicos", bancoId, materia, topicos: tops, qids: alvo.map(q => q.id) },
            async cfg => ({ topicos: await classificarTopicosIA({ chave: cfg.chave, modelo: cfg.modelo, materia, topicos: tops, questoes: alvo.map(q => ({ id: q.id, tipo: q.tipo, enunciado: q.enunciado, tema: temaDe(q) })),
              progresso: (i, n) => { $("#tbMsg", caixa).textContent = `🤖 Classificando… ${i} de ${n}`; } }) }));
          let n = 0;
          for (const [id, t] of Object.entries(r.topicos || {})) { const i = caixa.querySelector(`[data-tema="${id}"]`); if (i && i.value.trim() !== t) { i.value = t; i.classList.add("mudou", "ia"); n++; } }
          $("#tbMsg", caixa).textContent = `🤖 ${n} tópico(s) sugerido(s), destacados em azul. Revise e salve.`;
          atualizarLista();
        } catch (e) { $("#tbMsg", caixa).textContent = ""; toast("🤖 " + (e.message || traduzirErro(e)), "erro"); }
        btn.disabled = false;
      };
    },
    antesDeConfirmar: async caixa => {
      const novo = Object.fromEntries([...caixa.querySelectorAll("[data-tema]")].map(i => [i.dataset.tema, i.value.trim().slice(0, 120)]));
      const materia = $("#tbMateria", caixa).value.trim();
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
