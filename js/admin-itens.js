// Painel → "🧵 Itens e estampas": a equipe cria itens para o personagem dos alunos e para os mascotes,
// enviando um PNG (fundo transparente fica transparente) ou DESENHANDO na tela. Ajusta posição e tamanho com prévia ao vivo.
// Também monta SKINS PRONTAS (categoria "skin"): um personagem inteiro (peças + cores) que o aluno veste com um clique.
import { db, esc, $, toast, confirmar, traduzirErro } from "./common.js";
import { drawer, vazio, menuHTML, itemMenu } from "./ui.js";
import { CATEGORIAS_ITEM, PARA_MASCOTE, CATEGORIA_SKIN } from "./itens-custom.js";
import { svgAvatar, avatarValido, usarItensCustom, CATALOGO, CORES, NOMES_PARTES, PARTES_OCULTAS, AJUSTES, CORES_LIVRES, hexValido, labioNatural, PELES, ORDEM_PELES,
  permitido, trocarSexo, avatarAleatorio, textoTrava, TUDO } from "./avatar.js";
import { CONQUISTAS_PADRAO, niveisDe } from "./conquistas.js";
import { svgMascote } from "./mascotes.js";
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let ctx = null, itens = [];
export function iniciarItens(c) { ctx = c; }
// lê e registra no catálogo (personagem e mascotes); usado também na abertura do painel e da página do aluno
export async function carregarItensCustom() {
  const s = await getDocs(collection(db, "itensCustom")).catch(() => null);
  itens = (s?.docs || []).map(d => ({ id: d.id, ...d.data() }));
  usarItensCustom(itens);
  return itens;
}
const BASE_M = avatarValido({ corpo: "masculino", cabelo: "curto", pele: 1, corRoupa: 1 }, []), BASE_F = avatarValido({ corpo: "feminino", cabelo: "longo", pele: 3, corRoupa: 4 }, []);
const comItem = (base, it) => ({ ...base, [CATEGORIAS_ITEM[it.categoria].parte]: "cx-" + (it.id || "previa") });

export async function carregarAbaItens() {
  await carregarItensCustom();
  const box = $("#itensLista"), pode = ctx.podeEditar();
  $("#btnNovoItem").classList.toggle("oculto", !pode);
  $("#btnNovoItem").onclick = () => editarItem(null);
  const pecas = itens.filter(x => x.categoria !== CATEGORIA_SKIN), skins = itens.filter(x => x.categoria === CATEGORIA_SKIN);
  const menuDe = it => pode ? `<div class="it-acoes">${menuHTML({ aria: `Mais ações: ${it.nome}`, itensHTML: itemMenu({ i: "edit", t: "Editar", attrs: `data-edit="${it.id}"` }) + itemMenu({ i: it.ativo === false ? "check" : "x", t: it.ativo === false ? "Ligar" : "Desligar", attrs: `data-ligar="${it.id}"` }) + "<hr>" + itemMenu({ i: "trash", t: "Apagar", perigo: true, attrs: `data-del="${it.id}"` }) })}</div>` : "";
  const secaoSkins = `<section class="sk-secao" style="margin-top:22px"><div class="linha" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><h3 style="margin:0">✨ Skins prontas</h3>${pode ? `<button type="button" data-nova-skin>+ Nova skin pronta</button>` : ""}</div>
    <p class="pequeno">Personagens inteiros montados pela equipe (ex.: Hacker, Astronauta, Mago). O aluno veste com um clique no editor do personagem (aba “✨ Prontos”) e depois pode continuar mudando.</p>
    ${skins.length ? `<div class="it-grade">${skins.map(sk => `<article class="it-card${sk.ativo === false ? " desligado" : ""}"><div class="it-prev">${svgAvatar(avatarValido(sk.avatar, TUDO), 110)}</div>
      <div class="it-info"><b>${esc(sk.nome)}</b><div class="it-chips"><span class="chip off">${sk.avatar?.corpo === "feminino" ? "Feminino" : "Masculino"}</span><span class="chip ${sk.ativo === false ? "off" : "ok"}">${sk.ativo === false ? "desligada" : "ativa"}</span>${sk.trava ? `<span class="chip off">${esc(textoTrava(sk.trava))}</span>` : `<span class="chip off">livre</span>`}</div></div>
      ${menuDe(sk)}</article>`).join("")}</div>`
      : vazio({ e: "✨", texto: "Nenhuma skin pronta ainda. Monte um personagem temático para os alunos vestirem.", acao: pode ? `<button type="button" data-nova-skin>+ Nova skin pronta</button>` : "" })}</section>`;
  box.innerHTML = (pecas.length ? `<div class="it-grade">${pecas.map(it => { const cat = CATEGORIAS_ITEM[it.categoria] || {};
    return `<article class="it-card${it.ativo === false ? " desligado" : ""}"><div class="it-prev">${cat.av || it.categoria === "fundo" || it.categoria === "adesivo" ? svgAvatar(comItem(BASE_M, it), 110) : ""}
      ${PARA_MASCOTE.includes(it.categoria) ? `<span class="it-masc">${svgMascote("marlin", "feliz", { acessorio: "cx-" + it.id })}</span>` : ""}</div>
      <div class="it-info"><b>${esc(it.nome)}</b><div class="it-chips"><span class="chip off">${esc(cat.nome || it.categoria)}</span><span class="chip ${it.ativo === false ? "off" : "ok"}">${it.ativo === false ? "desligado" : "ativo"}</span>${it.trava?.n ? `<span class="chip off">🔒 ${it.trava.n}</span>` : ""}</div></div>
      ${menuDe(it)}</article>`; }).join("")}</div>`
    : vazio({ e: "🧵", texto: "Nenhum item ainda. Crie o primeiro: envie um PNG ou desenhe.", acao: pode ? `<button type="button" data-novo>+ Novo item</button>` : "" })) + secaoSkins;
  box.querySelectorAll("[data-nova-skin]").forEach(b => b.onclick = () => editarSkin(null));
  box.querySelector("[data-novo]")?.addEventListener("click", () => editarItem(null));
  box.querySelectorAll("[data-ligar]").forEach(b => b.onclick = async () => {
    const it = itens.find(x => x.id === b.dataset.ligar), ligar = it.ativo === false;
    if (!(await confirmar(ligar ? `Ligar o item “${it.nome}”? Ele volta a aparecer no editor.` : `Desligar o item “${it.nome}”? Ele some do editor; quem estiver usando volta ao item padrão daquela parte.`, { titulo: ligar ? "Ligar item" : "Desligar item", ok: ligar ? "Ligar" : "Desligar" }))) return;
    try { await setDoc(doc(db, "itensCustom", it.id), { ativo: ligar, atualizadoEm: serverTimestamp() }, { merge: true }); toast(ligar ? "Item ligado." : "Item desligado.", "ok"); carregarAbaItens(); } catch (e) { toast(traduzirErro(e), "erro"); }
  });
  box.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { const it = itens.find(x => x.id === b.dataset.edit); (it?.categoria === CATEGORIA_SKIN ? editarSkin : editarItem)(it); });
  box.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    const it = itens.find(x => x.id === b.dataset.del);
    if (!(await confirmar(`Apagar o item “${it.nome}”?\n\nQuem estiver usando volta ao item padrão daquela parte.`, { titulo: "Apagar item", ok: "Apagar", perigo: true }))) return;
    try { await deleteDoc(doc(db, "itensCustom", it.id)); toast("Item apagado.", "ok"); carregarAbaItens(); } catch (e) { toast(traduzirErro(e), "erro"); }
  });
}

// PNG → data URL reduzida (até 360 px), mantendo a transparência
function reduzirPng(arquivo, max = 360) {
  return new Promise((ok, falha) => {
    const img = new Image(), url = URL.createObjectURL(arquivo);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); ok(cv.toDataURL("image/png")); };
    img.onerror = () => falha(new Error("Não consegui ler a imagem. Use PNG, JPG ou WEBP."));
    img.src = url;
  });
}

// opcoes = { categoria (de um item novo), aoSalvar() }: usado também pelo Meu mascote
export function editarItem(orig, opcoes = {}) {
  let it = orig ? { ...orig, ajuste: { dx: 0, dy: 0, escala: 1, ...(orig.ajuste || {}) } } : { nome: "", categoria: opcoes.categoria || "estampa", png: "", ajuste: { dx: 0, dy: 0, escala: 1 }, trava: null, ativo: true };
  const CORES = ["#111827", "#ffffff", "#c1272d", "#f59e0b", "#facc15", "#059669", "#1d4ed8", "#7c3aed", "#db2777", "#92400e", "#6b7280", "#22d3ee"];
  const corpo = document.createElement("div");
  corpo.innerHTML = `<div class="it-ed">
    <section class="pc-secao"><div class="pc-secao-cab"><span class="pc-n">1</span><div class="pc-secao-tit"><h3>Nome e tipo</h3></div></div>
      <label for="itNome">Nome do item</label><input type="text" id="itNome" maxlength="40" value="${esc(it.nome)}" placeholder="Ex.: Estampa SENAI, Boné do time, Óculos 3D">
      <label for="itCat" style="margin-top:10px">Onde ele entra</label><select id="itCat">${Object.entries(CATEGORIAS_ITEM).map(([k, c]) => `<option value="${k}"${it.categoria === k ? " selected" : ""}>${c.icone} ${c.nome}${PARA_MASCOTE.includes(k) ? " (personagem e mascote)" : " (personagem)"}</option>`).join("")}</select></section>
    <section class="pc-secao"><div class="pc-secao-cab"><span class="pc-n">2</span><div class="pc-secao-tit"><h3>Imagem</h3><span class="pequeno">Envie um PNG (o fundo transparente continua transparente) ou desenhe aqui.</span></div></div>
      <div class="grupo-chips" id="itModo"><button type="button" class="chip sel" data-modo="png">📁 Enviar imagem</button><button type="button" class="chip" data-modo="desenho">✏ Desenhar</button></div>
      <div id="itPng" style="margin-top:10px"><label class="dropzone compacta"><input type="file" id="itArq" accept="image/png,image/webp,image/jpeg"><span class="dz-icone" aria-hidden="true">🖼</span><span class="dz-texto">Escolha ou arraste um PNG</span><span class="dz-arquivo"></span></label></div>
      <div id="itDesenho" class="oculto" style="margin-top:10px"><div class="it-tela-caixa"><canvas id="itTela" width="320" height="320" aria-label="Tela de desenho"></canvas></div>
        <div class="it-ferr"><div class="ep-swatches">${CORES.map((c, i) => `<button type="button" class="sw${i === 0 ? " sel" : ""}" data-cor="${c}" style="background:${c}" aria-label="cor ${c}"></button>`).join("")}</div>
          <label class="it-tam">Pincel <input type="range" id="itPincel" min="2" max="40" value="10"></label>
          <button type="button" class="leve mini" id="itBorracha">🧽 Borracha</button><button type="button" class="leve mini" id="itDesfaz">↺ Desfazer</button><button type="button" class="leve mini" id="itLimpa">🗑 Limpar</button>
          <button type="button" class="mini" id="itUsarDesenho">✔ Usar o desenho</button></div></div></section>
    <section class="pc-secao"><div class="pc-secao-cab"><span class="pc-n">3</span><div class="pc-secao-tit"><h3>Ajuste e prévia</h3><span class="pequeno">Mexa até ficar no lugar certo.</span></div></div>
      <div class="it-previas" id="itPrevias"></div>
      <label class="ep-aj"><span>Para os lados</span><input type="range" id="itDx" min="-40" max="40" value="${it.ajuste.dx}"><output></output></label>
      <label class="ep-aj"><span>Para cima / baixo</span><input type="range" id="itDy" min="-40" max="40" value="${it.ajuste.dy}"><output></output></label>
      <label class="ep-aj"><span>Tamanho</span><input type="range" id="itEsc" min="40" max="200" value="${Math.round(it.ajuste.escala * 100)}"><output></output></label></section>
    <section class="pc-secao"><div class="pc-secao-cab"><span class="pc-n">4</span><div class="pc-secao-tit"><h3>Quem pode usar</h3></div></div>
      <label for="itTrava">Liberação</label><select id="itTrava"><option value="0">Livre para todos</option>${[1, 2, 3, 5, 8, 10].map(n => `<option value="${n}"${it.trava?.n === n ? " selected" : ""}>Skin: libera com ${n} conquista(s)</option>`).join("")}</select>
      <label class="check" style="margin-top:8px"><input type="checkbox" id="itAtivo"${it.ativo !== false ? " checked" : ""}> <span>Ligado (aparece no editor dos alunos e dos mascotes)</span></label></section></div>`;
  const previa = () => {
    usarItensCustom([...itens.filter(x => x.id !== it.id), { ...it, id: it.id || "previa", ativo: true }]);
    const c = CATEGORIAS_ITEM[it.categoria];
    $("#itPrevias", corpo).innerHTML = it.png ? `<div>${svgAvatar(comItem(BASE_M, { ...it, id: it.id || "previa" }), 120)}<small>masculino</small></div><div>${svgAvatar(comItem(BASE_F, { ...it, id: it.id || "previa" }), 120)}<small>feminino</small></div>
      ${PARA_MASCOTE.includes(it.categoria) ? ["marlin", "feh"].map(m => `<div class="it-pm">${svgMascote(m, "feliz", { acessorio: "cx-" + (it.id || "previa") })}<small>mascote</small></div>`).join("") : ""}`
      : `<p class="pequeno">Envie ou desenhe a imagem para ver a prévia.</p>`;
    ["Dx", "Dy", "Esc"].forEach(k => { const r = $("#it" + k, corpo); r.nextElementSibling.textContent = k === "Esc" ? r.value + "%" : r.value; });
    if (!c.av && c.parte !== "fundo" && c.parte !== "adesivo") return;
  };
  // tela de desenho (fundo transparente)
  const tela = $("#itTela", corpo), g = tela.getContext("2d"), hist = [];
  let cor = "#111827", borracha = false, desenhando = false;
  const pos = e => { const r = tela.getBoundingClientRect(), p = e.touches?.[0] || e; return [(p.clientX - r.left) * tela.width / r.width, (p.clientY - r.top) * tela.height / r.height]; };
  const ini = e => { e.preventDefault(); desenhando = true; hist.push(g.getImageData(0, 0, tela.width, tela.height)); if (hist.length > 30) hist.shift(); const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); traco(e); };
  const traco = e => { if (!desenhando) return; e.preventDefault(); const [x, y] = pos(e); g.lineCap = g.lineJoin = "round"; g.lineWidth = Number($("#itPincel", corpo).value);
    g.globalCompositeOperation = borracha ? "destination-out" : "source-over"; g.strokeStyle = cor; g.lineTo(x, y); g.stroke(); };
  const fim = () => { desenhando = false; };
  tela.addEventListener("pointerdown", ini); tela.addEventListener("pointermove", traco); addEventListener("pointerup", fim);
  corpo.querySelectorAll("[data-cor]").forEach(b => b.onclick = () => { cor = b.dataset.cor; borracha = false; corpo.querySelectorAll("[data-cor]").forEach(x => x.classList.toggle("sel", x === b)); $("#itBorracha", corpo).classList.remove("sel"); });
  $("#itBorracha", corpo).onclick = e => { borracha = !borracha; e.currentTarget.classList.toggle("sel", borracha); };
  $("#itDesfaz", corpo).onclick = () => { const h = hist.pop(); if (h) g.putImageData(h, 0, 0); };
  $("#itLimpa", corpo).onclick = () => { hist.push(g.getImageData(0, 0, tela.width, tela.height)); g.clearRect(0, 0, tela.width, tela.height); };
  $("#itUsarDesenho", corpo).onclick = () => { it.png = tela.toDataURL("image/png"); previa(); toast("Desenho aplicado na prévia.", "ok"); };
  if (it.png) { const im = new Image(); im.onload = () => g.drawImage(im, 0, 0, tela.width, tela.height); im.src = it.png; }
  corpo.querySelectorAll("[data-modo]").forEach(b => b.onclick = () => { corpo.querySelectorAll("[data-modo]").forEach(x => x.classList.toggle("sel", x === b));
    $("#itPng", corpo).classList.toggle("oculto", b.dataset.modo !== "png"); $("#itDesenho", corpo).classList.toggle("oculto", b.dataset.modo !== "desenho"); });
  $("#itArq", corpo).onchange = async e => { const f = e.target.files?.[0]; if (!f) return; try { it.png = await reduzirPng(f); previa(); } catch (err) { toast(err.message, "erro"); } };
  $("#itCat", corpo).onchange = e => { it.categoria = e.target.value; previa(); };
  $("#itNome", corpo).oninput = e => { it.nome = e.target.value; };
  ["Dx", "Dy", "Esc"].forEach(k => $("#it" + k, corpo).oninput = () => { it.ajuste = { dx: Number($("#itDx", corpo).value), dy: Number($("#itDy", corpo).value), escala: Number($("#itEsc", corpo).value) / 100 }; previa(); });
  previa();
  drawer({ titulo: orig ? `Editar item: ${orig.nome}` : "Novo item", corpo, largo: true, aoFechar: () => { removeEventListener("pointerup", fim); usarItensCustom(itens); },
    acoes: [{ t: "Cancelar", classe: "leve" }, { t: orig ? "Salvar item" : "Criar item", onClick: async () => {
      it.nome = $("#itNome", corpo).value.trim(); it.trava = Number($("#itTrava", corpo).value) ? { n: Number($("#itTrava", corpo).value) } : null; it.ativo = $("#itAtivo", corpo).checked;
      if (!it.nome) { toast("Dê um nome para o item.", "erro"); return false; }
      if (!it.png) { toast("Envie uma imagem ou use o desenho.", "erro"); return false; }
      if (it.png.length > 600000) { toast("A imagem ficou grande demais. Use um PNG menor ou mais simples.", "erro"); return false; }
      if (!(await confirmar(`${orig ? "Salvar as alterações no" : "Criar o"} item “${it.nome}”?${it.ativo ? " Ele aparece para os alunos no editor do personagem." : ""}`, { titulo: "Itens e estampas", ok: orig ? "Salvar" : "Criar" }))) return false;
      const id = orig?.id || "it-" + Date.now().toString(36);
      try { await setDoc(doc(db, "itensCustom", id), { nome: it.nome, categoria: it.categoria, png: it.png, ajuste: it.ajuste, trava: it.trava, ativo: it.ativo, atualizadoEm: serverTimestamp(), criadoPor: orig?.criadoPor || ctx.eu.email });
        toast("Item salvo! 🧵", "ok"); await carregarAbaItens(); opcoes.aoSalvar?.(); }
      catch (e) { toast(traduzirErro(e), "erro"); return false; }
    } }] });
}

// ---------- skins prontas: o admin monta um personagem inteiro (peças, cores e ajustes) ----------
// Firestore itensCustom/{id} = { nome, categoria: "skin", avatar {...}, png: "" (as regras exigem o campo png), trava, ativo, criadoPor }
const NOME_COR_SKIN = { pele: "Pele", corCabelo: "Cabelo", corSobrancelha: "Sobrancelhas (1ª = igual ao cabelo)", corBarba: "Barba (1ª = igual ao cabelo)", corOlhos: "Olhos",
  corLabios: "Lábios", corRoupa: "Roupa", corJoia: "Joias", corAcessorio: "Acessório", corOculos: "Armação" };
// liberação: livre, nº de conquistas ou uma medalha (as conquistas "por matéria" ficam de fora: o nome depende da matéria)
const OPCOES_TRAVA = [["0", "Livre para todos"], ...[1, 2, 3, 5, 8, 10].map(n => ["n:" + n, `Libera com ${n} conquista(s)`]),
  ...CONQUISTAS_PADRAO.filter(c => c.grupo !== "materia").flatMap(c => niveisDe(c).map((nv, i) => [`m:${c.id}:${i + 1}`, `Medalha: ${c.e} ${nv.nome || c.t}`]))];
const travaParaValor = t => t?.n ? "n:" + t.n : t?.medalha ? `m:${t.medalha}:${t.nivel || 1}` : "0";
const valorParaTrava = v => { const [tipo, a, b] = String(v).split(":"); return tipo === "n" ? { n: Number(a) } : tipo === "m" ? { medalha: a, nivel: Number(b) || 1 } : null; };

export function editarSkin(orig) {
  // TUDO: no painel o admin usa qualquer peça (as travadas também); o aluno recebe a skin inteira quando ela estiver liberada para ele
  let av = avatarValido(orig?.avatar || { corpo: "masculino", cabelo: "curto", corRoupa: 3 }, TUDO);
  delete av.skin;
  const corpo = document.createElement("div");
  corpo.innerHTML = `<div class="it-ed">
    <section class="pc-secao"><div class="pc-secao-cab"><span class="pc-n">1</span><div class="pc-secao-tit"><h3>Nome e liberação</h3></div></div>
      <label for="skNome">Nome da skin</label><input type="text" id="skNome" maxlength="30" value="${esc(orig?.nome || "")}" placeholder="Ex.: Hacker, Astronauta, Mago">
      <label for="skTrava" style="margin-top:10px">Quem pode usar</label><select id="skTrava">${OPCOES_TRAVA.map(([v, t]) => `<option value="${v}"${travaParaValor(orig?.trava) === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
      <label class="check" style="margin-top:8px"><input type="checkbox" id="skAtivo"${orig?.ativo !== false ? " checked" : ""}> <span>Ligada (aparece no editor dos alunos)</span></label></section>
    <section class="pc-secao"><div class="pc-secao-cab"><span class="pc-n">2</span><div class="pc-secao-tit"><h3>Monte o personagem</h3><span class="pequeno">Escolha o corpo primeiro: as peças se ajustam a ele.</span></div></div>
      <div class="sk-ed"><div class="sk-previa"><div id="skPrevia"></div>
        <div class="grupo-chips" style="justify-content:center;margin-top:6px">${["masculino", "feminino"].map(c => `<button type="button" class="chip" data-sk-corpo="${c}">${c === "masculino" ? "Masculino" : "Feminino"}</button>`).join("")}</div>
        <button type="button" class="leve mini" id="skSorte" style="margin-top:8px">🎲 Sortear um ponto de partida</button></div>
        <div><div class="sk-pecas" id="skPecas"></div><div class="sk-cores" id="skCores"></div>
          <details class="ajuda-extra" style="margin-top:8px"><summary>🎚 Ajustes finos do rosto</summary><div id="skAjustes"></div></details></div></div></section></div>`;
  const previa = () => { $("#skPrevia", corpo).innerHTML = svgAvatar(av, 200); };
  const corCab = () => hexValido(av.corCabeloHex) || CORES.corCabelo[Number(av.corCabelo)] || CORES.corCabelo[1];
  const desenharCores = () => {
    const fem = av.corpo === "feminino";
    $("#skCores", corpo).innerHTML = Object.keys(CORES).filter(k => fem || k !== "corLabios").map(k => {
      const ordem = k === "pele" ? ORDEM_PELES : CORES[k].map((_, i) => i), livre = CORES_LIVRES[k], hex = hexValido(av[livre]);
      return `<div><span class="pequeno">${NOME_COR_SKIN[k] || k}</span><div class="ep-swatches">${ordem.map(i => { const c = CORES[k][i] || (k === "corLabios" ? labioNatural(PELES[av.pele] || PELES[1]) : corCab());
        return `<button type="button" class="sw${CORES[k][i] ? "" : " sw-nat"}${!hex && Number(av[k]) === i ? " sel" : ""}" data-cor="${k}" data-i="${i}" style="background:${c}" aria-label="${NOME_COR_SKIN[k] || k}: cor ${i + 1}"></button>`; }).join("")}
        ${livre ? `<label class="sw sw-livre${hex ? " sel" : ""}" title="Escolher qualquer cor" style="${hex ? `background:${hex}` : ""}"><input type="color" data-livre="${livre}" value="${hex || corCab()}" aria-label="${NOME_COR_SKIN[k]}: qualquer cor"></label>` : ""}</div></div>`; }).join("");
    corpo.querySelectorAll("#skCores [data-cor]").forEach(b => b.onclick = () => { av = { ...av, [b.dataset.cor]: Number(b.dataset.i) }; if (CORES_LIVRES[b.dataset.cor]) delete av[CORES_LIVRES[b.dataset.cor]]; previa(); desenharCores(); });
    corpo.querySelectorAll("#skCores [data-livre]").forEach(inp => { inp.oninput = () => { av = { ...av, [inp.dataset.livre]: hexValido(inp.value) }; inp.parentElement.style.background = inp.value; previa(); }; inp.onchange = desenharCores; });
  };
  const desenharTudo = () => {
    const oculta = PARTES_OCULTAS[av.corpo === "feminino" ? "f" : "m"];
    corpo.querySelectorAll("[data-sk-corpo]").forEach(b => { const on = b.dataset.skCorpo === av.corpo; b.classList.toggle("sel", on); b.setAttribute("aria-pressed", on); });
    $("#skPecas", corpo).innerHTML = Object.keys(CATALOGO).filter(p => !["corpo", "moldura", "adesivo"].includes(p) && !oculta.includes(p) && CATALOGO[p].length > 1).map(p =>
      `<label>${esc(NOMES_PARTES[p] || p)}<select data-peca="${p}">${CATALOGO[p].filter(i => permitido(i, av.corpo)).map(i => `<option value="${esc(i.id)}"${av[p] === i.id ? " selected" : ""}>${esc(i.nome)}${i.trava ? " 🔒" : ""}</option>`).join("")}</select></label>`).join("");
    corpo.querySelectorAll("[data-peca]").forEach(sel => sel.onchange = () => { av = { ...av, [sel.dataset.peca]: sel.value }; previa(); });
    const aj = av.ajustes || {};
    $("#skAjustes", corpo).innerHTML = AJUSTES.map(([k, r]) => `<label class="ep-aj"><span>${r}</span><input type="range" min="-3" max="3" step="1" value="${aj[k] || 0}" data-sk-aj="${k}" aria-label="${r}"><output>${aj[k] > 0 ? "+" : ""}${aj[k] || 0}</output></label>`).join("");
    corpo.querySelectorAll("[data-sk-aj]").forEach(r => r.oninput = () => { av = { ...av, ajustes: { ...(av.ajustes || {}), [r.dataset.skAj]: Number(r.value) } }; r.nextElementSibling.textContent = (r.value > 0 ? "+" : "") + r.value; previa(); });
    desenharCores(); previa();
  };
  corpo.querySelectorAll("[data-sk-corpo]").forEach(b => b.onclick = () => { if (b.dataset.skCorpo !== av.corpo) { av = trocarSexo(av, b.dataset.skCorpo, TUDO); desenharTudo(); } });
  $("#skSorte", corpo).onclick = () => { av = avatarValido(avatarAleatorio(TUDO, { corpo: av.corpo, fundo: av.fundo }), TUDO); desenharTudo(); };
  desenharTudo();
  drawer({ titulo: orig ? `Editar skin: ${orig.nome}` : "Nova skin pronta", corpo, largo: true,
    acoes: [{ t: "Cancelar", classe: "leve" }, { t: orig ? "Salvar skin" : "Criar skin", onClick: async () => {
      const nome = $("#skNome", corpo).value.trim(), trava = valorParaTrava($("#skTrava", corpo).value), ativo = $("#skAtivo", corpo).checked;
      if (!nome) { toast("Dê um nome para a skin.", "erro"); return false; }
      if (!(await confirmar(`${orig ? "Salvar as alterações na" : "Criar a"} skin pronta “${nome}”?${ativo ? ` Ela aparece para os alunos no editor do personagem (${trava ? textoTrava(trava).replace("🔒 ", "libera com ") : "livre para todos"}).` : ""}`, { titulo: "Skins prontas", ok: orig ? "Salvar" : "Criar" }))) return false;
      const avatar = JSON.parse(JSON.stringify(avatarValido(av, TUDO))); delete avatar.skin;
      const id = orig?.id || "skin-" + Date.now().toString(36);
      try { await setDoc(doc(db, "itensCustom", id), { nome, categoria: CATEGORIA_SKIN, png: "", avatar, trava, ativo, atualizadoEm: serverTimestamp(), criadoPor: orig?.criadoPor || ctx.eu.email });
        toast("Skin salva! ✨", "ok"); await carregarAbaItens(); }
      catch (e) { toast(traduzirErro(e), "erro"); return false; }
    } }] });
}
