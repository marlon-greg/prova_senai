// Painel → "🧵 Itens e estampas": a equipe cria itens para o personagem dos alunos e para os mascotes,
// enviando um PNG (fundo transparente fica transparente) ou DESENHANDO na tela. Ajusta posição e tamanho com prévia ao vivo.
import { db, esc, $, toast, confirmar, traduzirErro } from "./common.js";
import { drawer, vazio } from "./ui.js";
import { CATEGORIAS_ITEM, PARA_MASCOTE } from "./itens-custom.js";
import { svgAvatar, avatarValido, usarItensCustom } from "./avatar.js";
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
  box.innerHTML = itens.length ? `<div class="it-grade">${itens.map(it => { const cat = CATEGORIAS_ITEM[it.categoria] || {};
    return `<article class="it-card${it.ativo === false ? " desligado" : ""}"><div class="it-prev">${cat.av || it.categoria === "fundo" || it.categoria === "adesivo" ? svgAvatar(comItem(BASE_M, it), 110) : ""}
      ${PARA_MASCOTE.includes(it.categoria) ? `<span class="it-masc">${svgMascote("marlin", "feliz", { acessorio: "cx-" + it.id })}</span>` : ""}</div>
      <div class="it-info"><b>${esc(it.nome)}</b><span class="pequeno">${cat.icone || ""} ${esc(cat.nome || it.categoria)}${it.trava?.n ? ` · 🔒 ${it.trava.n} conquista(s)` : " · livre"}${it.ativo === false ? " · desligado" : ""}</span></div>
      ${pode ? `<div class="it-acoes"><button type="button" class="leve mini" data-edit="${it.id}">✎ Editar</button><button type="button" class="perigo mini" data-del="${it.id}">🗑</button></div>` : ""}</article>`; }).join("")}</div>`
    : vazio({ e: "🧵", texto: "Nenhum item ainda. Crie o primeiro: envie um PNG ou desenhe.", acao: pode ? `<button type="button" data-novo>+ Novo item</button>` : "" });
  box.querySelector("[data-novo]")?.addEventListener("click", () => editarItem(null));
  box.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editarItem(itens.find(x => x.id === b.dataset.edit)));
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

function editarItem(orig) {
  let it = orig ? { ...orig, ajuste: { dx: 0, dy: 0, escala: 1, ...(orig.ajuste || {}) } } : { nome: "", categoria: "estampa", png: "", ajuste: { dx: 0, dy: 0, escala: 1 }, trava: null, ativo: true };
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
        toast("Item salvo! 🧵", "ok"); carregarAbaItens(); }
      catch (e) { toast(traduzirErro(e), "erro"); return false; }
    } }] });
}
