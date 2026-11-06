// Painel → "🙂 Meu mascote": cada professor edita o SEU mascote (cores, roupa e acessório), com o PADRÃO (o original,
// que não se apaga) e até 4 "saves" com nome. O visual "em uso" é o que os alunos veem nas provas.
// Dono de cada mascote: config/mascotes.donos[id] = e-mail (o admin define). O admin pode editar qualquer um.
import { db, esc, $, toast, confirmar, traduzirErro, SUPER_ADMIN } from "./common.js";
import { MASCOTES, svgMascote, OPCOES_ESTILO, NOMES_ESTILO, definirEstilos, normalizarEstilo, desenhoAcessorio, encaixeDe } from "./mascotes.js";
import { listaItensCustom, itemCustom, PARA_MASCOTE } from "./itens-custom.js";
import { ENCAIXES, acessoriosDo, CORES_ACESSORIO, TOTAL_ACESSORIOS, CATEGORIA_DO_ENCAIXE } from "./mascotes-acessorios.js";
import { editarItem, carregarItensCustom } from "./admin-itens.js";
import { doc, getDoc, getDocs, setDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const IDS = Object.keys(MASCOTES), HUMORES = [["feliz", "😄"], ["falando", "💬"], ["surpreso", "😮"], ["triste", "😢"], ["comemorando", "🎉"]];
const MAX_SAVES = 4;
let ctx = null, donos = {}, dados = {}, atual = null, estilo = {}, humor = "feliz", encaixe = "cabeca";
export function iniciarMeuMascote(c) { ctx = c; }

// carrega os estilos em uso (para a prévia e para qualquer tela do painel que mostre mascote)
export async function carregarEstilosMascotes() {
  const s = await getDocs(collection(db, "mascotes")).catch(() => null), m = {};
  s?.forEach(d => { m[d.id] = d.data().ativo || {}; });
  definirEstilos(m); return m;
}
// donos sugeridos (primeira vez): o primeiro nome do professor do mascote bate com o nome na equipe
function donosSugeridos(equipe) {
  const prim = s => String(s || "").trim().split(/\s+/)[0].toLowerCase();
  return Object.fromEntries(IDS.map(id => {
    const p = prim(MASCOTES[id].professor);
    if (p === "marlon") return [id, SUPER_ADMIN];
    return [id, equipe.find(e => prim(e.nome) === p)?.id || ""];
  }));
}

export async function carregarMeuMascote() {
  const box = $("#mascoteConteudo"), eu = ctx.eu.email.toLowerCase(), admin = ctx.ehAdmin();
  box.innerHTML = `<p class="pequeno">Carregando…</p>`;
  const [cfg, eq] = await Promise.all([getDoc(doc(db, "config", "mascotes")).catch(() => null), admin ? getDocs(collection(db, "equipe")).catch(() => null) : null]);
  const equipe = (eq?.docs || []).map(d => ({ id: d.id, ...d.data() }));
  const salvos = cfg?.exists() ? cfg.data().donos || {} : null;
  donos = salvos || donosSugeridos(equipe);
  const meus = IDS.filter(id => String(donos[id] || "").toLowerCase() === eu);
  const editaveis = admin ? IDS : meus;
  (await getDocs(collection(db, "mascotes")).catch(() => null))?.forEach(d => { dados[d.id] = d.data(); });
  if (!atual || !editaveis.includes(atual)) atual = meus[0] || editaveis[0] || null;
  box.innerHTML = (admin ? donosHTML(equipe, !salvos) : "") + (editaveis.length ? `
    ${editaveis.length > 1 ? `<div class="mm-escolha" role="tablist" aria-label="Mascote">${editaveis.map(id => `<button type="button" role="tab" class="mm-tab${id === atual ? " sel" : ""}" data-mm="${id}" aria-selected="${id === atual}">
      <span class="mm-mini">${svgMascote(id, "feliz", dados[id]?.ativo || {})}</span><span>${MASCOTES[id].nome}${meus.includes(id) ? " <small>(seu)</small>" : ""}</span></button>`).join("")}</div>` : ""}
    <div id="mmEditor"></div>`
    : `<div class="vazio"><span class="vz-e">🙂</span><p><b>Nenhum mascote ligado a você.</b></p><p class="pequeno">Peça ao admin para ligar o seu mascote a você nesta tela.</p></div>`);
  box.querySelectorAll("[data-mm]").forEach(b => b.onclick = () => { atual = b.dataset.mm; estilo = normalizarEstilo(dados[atual]?.ativo); carregarMeuMascote(); });
  if (admin) ligarDonos(box, equipe);
  if (atual) { estilo = normalizarEstilo(dados[atual]?.ativo); desenharEditor(); }
}

// ---------- admin: quem é dono de cada mascote ----------
function donosHTML(equipe, sugerido) {
  const pessoas = [{ id: SUPER_ADMIN, nome: "admin principal" }, ...equipe.filter(e => e.id !== SUPER_ADMIN)];
  return `<section class="pc-secao"><div class="pc-secao-cab"><span class="pc-n">👑</span><div class="pc-secao-tit"><h3>Dono de cada mascote</h3><span class="pequeno">Só o dono (e o admin) muda o visual do mascote.${sugerido ? " <b>Sugestão pelo nome: confira e salve.</b>" : ""}</span></div></div>
    <div class="mm-donos">${IDS.map(id => `<label class="mm-dono"><span class="mm-mini">${svgMascote(id, "feliz", dados[id]?.ativo || {})}</span><span><b>${MASCOTES[id].nome}</b><small>prof. ${esc(MASCOTES[id].professor)}</small></span>
      <select data-dono="${id}"><option value="">— ninguém —</option>${pessoas.map(p => `<option value="${esc(p.id)}"${String(donos[id] || "").toLowerCase() === p.id.toLowerCase() ? " selected" : ""}>${esc(p.nome || p.id)} · ${esc(p.id)}</option>`).join("")}</select></label>`).join("")}</div>
    <button type="button" id="mmSalvarDonos" style="margin-top:10px">Salvar donos</button></section>`;
}
function ligarDonos(box) {
  $("#mmSalvarDonos", box).onclick = async () => {
    const novo = Object.fromEntries([...box.querySelectorAll("[data-dono]")].map(s => [s.dataset.dono, s.value.toLowerCase()]));
    if (!(await confirmar(`Salvar os donos dos mascotes?\n\n${IDS.map(id => `${MASCOTES[id].nome}: ${novo[id] || "ninguém"}`).join("\n")}`, { titulo: "Donos dos mascotes", ok: "Salvar" }))) return;
    try { await setDoc(doc(db, "config", "mascotes"), { donos: novo, atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email }); donos = novo; toast("Donos salvos.", "ok"); carregarMeuMascote(); }
    catch (e) { toast(traduzirErro(e), "erro"); }
  };
}

// ---------- editor ----------
// compara visuais sem depender da ordem das chaves e aceitando o formato antigo
const canon = v => Array.isArray(v) || v === null || typeof v !== "object" ? v : Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])]));
const igual = (a, b) => JSON.stringify(canon(normalizarEstilo(a))) === JSON.stringify(canon(normalizarEstilo(b)));
const itensDoEncaixe = enc => listaItensCustom().filter(i => PARA_MASCOTE.includes(i.categoria) && encaixeDe(i.idCat) === enc);
const contaEncaixe = enc => acessoriosDo(enc).length + itensDoEncaixe(enc).length;
// escolhe (ou tira) o acessório de um encaixe, sem deixar cor e ajuste órfãos
function porAcessorio(enc, id) {
  const ac = { ...estilo.ac }, acCor = { ...estilo.acCor }, acAj = { ...estilo.acAj };
  if (id) ac[enc] = id; else delete ac[enc];
  delete acCor[enc]; delete acAj[enc];
  estilo = { ...estilo, ac, acCor, acAj };
  ["ac", "acCor", "acAj"].forEach(k => { if (!Object.keys(estilo[k]).length) delete estilo[k]; });
}
function acessoriosHTML() {
  const sel = estilo.ac?.[encaixe], info = ENCAIXES[encaixe], aj = estilo.acAj?.[encaixe] || {}, usados = Object.keys(estilo.ac || {});
  const miniatura = id => `<svg viewBox="${info.vb}" aria-hidden="true">${desenhoAcessorio(id, estilo.acCor?.[encaixe])}</svg>`;
  const custom = itensDoEncaixe(encaixe), podeCriar = ctx.podeEditar() && CATEGORIA_DO_ENCAIXE[encaixe];
  return `<div class="mm-enc" role="tablist" aria-label="Partes do mascote">${Object.entries(ENCAIXES).filter(([k]) => contaEncaixe(k) || CATEGORIA_DO_ENCAIXE[k]).map(([k, e]) => `<button type="button" role="tab" aria-selected="${k === encaixe}" class="chip${k === encaixe ? " sel" : ""}" data-enc="${k}">${e.icone} ${e.nome}<small>${usados.includes(k) ? "✓" : contaEncaixe(k)}</small></button>`).join("")}</div>
    <div class="mm-itens"><button type="button" class="mm-item nenhum${sel ? "" : " sel"}" data-acess=""><span class="mm-item-img">🚫</span><span>Nenhum</span></button>
      ${acessoriosDo(encaixe).map(a => `<button type="button" class="mm-item${sel === a.id ? " sel" : ""}" data-acess="${a.id}" title="${esc(a.nome)}"><span class="mm-item-img">${miniatura(a.id)}</span><span>${esc(a.nome)}</span></button>`).join("")}
      ${custom.map(i => `<div class="mm-item-c"><button type="button" class="mm-item${sel === i.idCat ? " sel" : ""}" data-acess="${i.idCat}" title="${esc(i.nome)}"><span class="mm-item-img"><img src="${i.png}" alt=""></span><span>${esc(i.nome)} ✨</span></button>${ctx.podeEditar() ? `<button type="button" class="leve mini" data-edit-item="${i.idCat}">✎ Editar</button>` : ""}</div>`).join("")}
      ${podeCriar ? `<button type="button" class="mm-item criar" data-criar-item><span class="mm-item-img">＋</span><span>Enviar PNG ou desenhar</span></button>` : ""}</div>
    ${!podeCriar && ctx.podeEditar() ? `<p class="pequeno">Para criar um item seu com PNG ou desenho, use as partes Cabeça, Rosto, Pescoço, Peito ou Roupa.</p>` : ""}
    ${sel ? `<div class="mm-ajuste"><b>Ajustar “${esc(sel.startsWith("cx-") ? itemCustom(sel)?.nome || "" : acessoriosDo(encaixe).find(a => a.id === sel)?.nome || "")}”</b>
      ${sel.startsWith("cx-") ? "" : `<div class="ep-swatches"><span class="pequeno">Cor</span>${CORES_ACESSORIO.map(c => `<button type="button" class="sw${estilo.acCor?.[encaixe] === c ? " sel" : ""}" data-ac-cor="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join("")}</div>`}
      <label class="ep-aj"><span>Para os lados</span><input type="range" data-aj="dx" min="-60" max="60" value="${aj.dx || 0}"><output>${aj.dx || 0}</output></label>
      <label class="ep-aj"><span>Para cima / baixo</span><input type="range" data-aj="dy" min="-60" max="60" value="${aj.dy || 0}"><output>${aj.dy || 0}</output></label>
      <label class="ep-aj"><span>Tamanho</span><input type="range" data-aj="e" min="40" max="180" value="${Math.round((aj.e || 1) * 100)}"><output>${Math.round((aj.e || 1) * 100)}%</output></label>
      <button type="button" class="leve mini" data-aj-zerar>↺ Voltar à posição original</button></div>` : ""}`;
}
// atualiza só o desenho e o aviso (os controles deslizantes não podem ser redesenhados enquanto a pessoa arrasta)
function atualizarPrevia() {
  const ativo = dados[atual]?.ativo || {}, mesmo = igual(estilo, ativo);
  $("#mmPalco").innerHTML = svgMascote(atual, humor, estilo);
  $("#mmEstado").textContent = mesmo ? "✅ Este é o visual em uso nas provas." : "✏ Você mudou o visual: ainda não está valendo para os alunos.";
  $("#mmUsar").disabled = mesmo;
}
function desenharEditor() {
  const m = MASCOTES[atual], d = dados[atual] || {}, saves = (d.saves || []).slice(0, MAX_SAVES), ativo = d.ativo || {};
  const sw = (k) => `<div class="mm-cor"><span class="pequeno">${NOMES_ESTILO[k]}</span><div class="ep-swatches"><button type="button" class="sw sw-nat${!estilo[k] ? " sel" : ""}" data-k="${k}" data-v="" title="Como no padrão" aria-label="Como no padrão">↺</button>
    ${OPCOES_ESTILO[k].map(c => `<button type="button" class="sw${estilo[k] === c ? " sel" : ""}" data-k="${k}" data-v="${c}" style="background:${c}" aria-label="${NOMES_ESTILO[k]} ${c}"></button>`).join("")}</div></div>`;
  const slot = (s, i) => s ? `<div class="mm-slot${igual(s.estilo, ativo) ? " em-uso" : ""}"><span class="mm-mini g">${svgMascote(atual, "feliz", s.estilo)}</span><b>${esc(s.nome)}</b>${igual(s.estilo, ativo) ? `<span class="chip ok">em uso</span>` : ""}
      <div class="mm-slot-acoes"><button type="button" class="leve mini" data-carregar="${i}">✎ Abrir no editor</button><button type="button" class="leve mini" data-salvar="${i}">💾 Salvar aqui</button><button type="button" class="perigo mini" data-apagar="${i}" aria-label="Apagar ${esc(s.nome)}">🗑</button></div></div>`
    : `<div class="mm-slot vazio-slot"><span class="mm-vazio">＋</span><b>Espaço ${i + 1} livre</b><div class="mm-slot-acoes"><button type="button" class="leve mini" data-salvar="${i}">💾 Salvar o visual atual aqui</button></div></div>`;
  $("#mmEditor").innerHTML = `<div class="mm-grade">
    <section class="pc-secao mm-previa"><div class="pc-secao-cab"><span class="pc-n">👀</span><div class="pc-secao-tit"><h3>${m.nome} <small class="pequeno">prof. ${esc(m.professor)}</small></h3><span class="pequeno">“${esc(m.bordao)}”</span></div></div>
      <div class="mm-palco" id="mmPalco" style="--cor-mascote:${m.cor}">${svgMascote(atual, humor, estilo)}</div>
      <div class="grupo-chips" style="justify-content:center">${HUMORES.map(([h, e]) => `<button type="button" class="chip${humor === h ? " sel" : ""}" data-humor="${h}">${e} ${h}</button>`).join("")}</div>
      <p class="pequeno mm-estado" id="mmEstado">${igual(estilo, ativo) ? "✅ Este é o visual em uso nas provas." : "✏ Você mudou o visual: ainda não está valendo para os alunos."}</p>
      <div class="linha acoes" style="justify-content:center"><button type="button" id="mmUsar"${igual(estilo, ativo) ? " disabled" : ""}>✔ Usar este visual nas provas</button><button type="button" class="leve" id="mmPadrao">↺ Voltar ao padrão</button></div></section>
    <div class="mm-coluna"><section class="pc-secao"><div class="pc-secao-cab"><span class="pc-n">1</span><div class="pc-secao-tit"><h3>Cores</h3><span class="pequeno">↺ = igual ao padrão.</span></div></div>
      ${["pele", "cabelo", "barba", "iris", "camisa"].map(sw).join("")}</section>
    <section class="pc-secao"><div class="pc-secao-cab"><span class="pc-n">2</span><div class="pc-secao-tit"><h3>Acessórios</h3><span class="pequeno">${TOTAL_ACESSORIOS} prontos, mais os criados pela equipe. Use um em cada parte ao mesmo tempo, troque a cor, mova e aumente.</span></div></div>
      <div id="mmAcessorios">${acessoriosHTML()}</div></section>
    <section class="pc-secao mm-saves"><div class="pc-secao-cab"><span class="pc-n">3</span><div class="pc-secao-tit"><h3>Meus visuais salvos</h3><span class="pequeno">O padrão sempre fica guardado. Você tem mais ${MAX_SAVES} espaços.</span></div></div>
      <div class="mm-slots"><div class="mm-slot padrao${igual({}, ativo) ? " em-uso" : ""}"><span class="mm-mini g">${svgMascote(atual, "feliz", {})}</span><b>⭐ Padrão</b>${igual({}, ativo) ? `<span class="chip ok">em uso</span>` : ""}
        <div class="mm-slot-acoes"><button type="button" class="leve mini" data-carregar="padrao">✎ Abrir no editor</button></div></div>
        ${Array.from({ length: MAX_SAVES }, (_, i) => slot(saves[i], i)).join("")}</div></section></div></div>`;
  const ed = $("#mmEditor");
  ed.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { estilo = { ...estilo, [b.dataset.k]: b.dataset.v || undefined }; if (!b.dataset.v) delete estilo[b.dataset.k]; desenharEditor(); });
  ligarAcessorios();
  ed.querySelectorAll("[data-humor]").forEach(b => b.onclick = () => { humor = b.dataset.humor; desenharEditor(); });
  $("#mmUsar").onclick = () => gravar({ ativo: estilo }, `Usar este visual do ${m.nome} nas provas? Os alunos passam a ver o mascote assim.`, "Usar visual", "Visual em uso! Os alunos veem na próxima vez que abrirem a página.");
  $("#mmPadrao").onclick = () => gravar({ ativo: {} }, `Voltar o ${m.nome} ao visual padrão? Seus visuais salvos continuam guardados.`, "Voltar ao padrão", "Padrão em uso.", () => { estilo = {}; });
  ed.querySelectorAll("[data-carregar]").forEach(b => b.onclick = () => { estilo = b.dataset.carregar === "padrao" ? {} : normalizarEstilo(saves[b.dataset.carregar].estilo); desenharEditor(); toast("Aberto no editor. Para valer nas provas, clique em “Usar este visual”.", "info"); });
  ed.querySelectorAll("[data-salvar]").forEach(b => b.onclick = async () => {
    const i = Number(b.dataset.salvar), antigo = saves[i];
    const nome = prompt(antigo ? `Nome do visual (substitui “${antigo.nome}”):` : "Dê um nome para este visual:", antigo?.nome || `Visual ${i + 1}`);
    if (nome === null) return;
    const novo = [...Array(MAX_SAVES)].map((_, k) => saves[k] || null); novo[i] = { nome: nome.trim().slice(0, 30) || `Visual ${i + 1}`, estilo: { ...estilo } };
    gravar({ saves: novo }, antigo ? `Substituir o visual salvo “${antigo.nome}” pelo visual do editor?` : `Salvar o visual do editor no espaço ${i + 1}?`, antigo ? "Substituir" : "Salvar", "Visual salvo.");
  });
  ed.querySelectorAll("[data-apagar]").forEach(b => b.onclick = () => {
    const i = Number(b.dataset.apagar), novo = [...Array(MAX_SAVES)].map((_, k) => saves[k] || null); const nome = novo[i]?.nome; novo[i] = null;
    gravar({ saves: novo }, `Apagar o visual salvo “${nome}”? (Se ele estiver em uso, o mascote continua assim até você trocar.)`, "Apagar", "Visual apagado.", null, true);
  });
}
function ligarAcessorios() {
  const box = $("#mmAcessorios"), mudou = () => { box.innerHTML = acessoriosHTML(); ligarAcessorios(); atualizarPrevia(); };
  box.querySelectorAll("[data-enc]").forEach(b => b.onclick = () => { encaixe = b.dataset.enc; mudou(); });
  box.querySelectorAll("[data-acess]").forEach(b => b.onclick = () => { porAcessorio(encaixe, b.dataset.acess); mudou(); });
  box.querySelectorAll("[data-ac-cor]").forEach(b => b.onclick = () => { estilo = { ...estilo, acCor: { ...estilo.acCor, [encaixe]: b.dataset.acCor } }; mudou(); });
  box.querySelector("[data-aj-zerar]")?.addEventListener("click", () => { const acAj = { ...estilo.acAj }; delete acAj[encaixe]; estilo = { ...estilo, acAj }; if (!Object.keys(acAj).length) delete estilo.acAj; mudou(); });
  box.querySelectorAll("[data-aj]").forEach(r => r.oninput = () => {
    const v = Number(r.value), k = r.dataset.aj; r.nextElementSibling.textContent = k === "e" ? v + "%" : v;
    estilo = { ...estilo, acAj: { ...estilo.acAj, [encaixe]: { ...estilo.acAj?.[encaixe], [k]: k === "e" ? v / 100 : v } } }; atualizarPrevia();
  });
  const recarregar = async () => { await carregarItensCustom(); mudou(); };
  box.querySelector("[data-criar-item]")?.addEventListener("click", async () => { await carregarItensCustom(); editarItem(null, { categoria: CATEGORIA_DO_ENCAIXE[encaixe], aoSalvar: recarregar }); });
  box.querySelectorAll("[data-edit-item]").forEach(b => b.onclick = async () => { const itens = await carregarItensCustom(); editarItem(itens.find(x => "cx-" + x.id === b.dataset.editItem), { aoSalvar: recarregar }); });
}
async function gravar(mudanca, pergunta, ok, msg, depois = null, perigo = false) {
  if (!(await confirmar(pergunta, { titulo: `Mascote ${MASCOTES[atual].nome}`, ok, perigo }))) return;
  const d = dados[atual] || {}, novo = { ativo: d.ativo || {}, saves: d.saves || [], ...mudanca, atualizadoEm: serverTimestamp(), atualizadoPor: ctx.eu.email };
  try { await setDoc(doc(db, "mascotes", atual), novo); dados[atual] = novo; depois?.(); await carregarEstilosMascotes(); toast(msg, "ok"); carregarMeuMascote(); }
  catch (e) { toast(traduzirErro(e) + " (confira se você é o dono deste mascote)", "erro"); }
}
