// Página do aluno: cartão do perfil (personagem + nível + conquistas), editor do personagem com skins
// liberadas pelas conquistas, download do cartão (PNG, JPG, PDF) e o painel da simulação (equipe, ?simular=1).
import { db, esc, $, toast, modal } from "./common.js";
import { CATALOGO, CORES, ORDEM_PELES, NOMES_PARTES, PELES, labioNatural, svgAvatar, liberado, textoTrava, avatarValido, avatarAleatorio } from "./avatar.js";
// status do dia: só frases prontas (ninguém escreve texto livre)
export const STATUS = ["😊 Animado(a)", "📚 Estudando", "🎯 Focado(a)", "💪 Pronto(a) para a prova", "🚀 Motivado(a)", "🧘 Tranquilo(a)", "🤔 Pensativo(a)",
  "😴 Com sono", "☕ Precisando de café", "🎧 Ouvindo música", "🤝 Ajudando os colegas", "💻 Programando", "🎮 Modo jogo", "🏃 Na correria", "🌟 Dia incrível", "🙂 De boa"];
import { botoesSocial } from "./aluno-social.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// editor em abas: cada aba junta as partes e as cores que combinam
const GRUPOS = [
  { nome: "🙂 Rosto e corpo", partes: ["corpo", "rosto", "orelha", "nariz", "bochecha", "detalhe"], cores: [["pele", "Pele"]] },
  { nome: "💇 Cabelo e barba", partes: ["cabelo", "sobrancelha", "barba"], cores: [["corCabelo", "Cabelo, sobrancelha e barba"]] },
  { nome: "👀 Olhos e boca", partes: ["olhos", "cilios", "maquiagem", "boca"], cores: [["corOlhos", "Olhos"], ["corLabios", "Lábios"]] },
  { nome: "👕 Roupa e acessórios", partes: ["roupa", "pescoco", "oculos", "brinco", "acessorio"],
    cores: [["corRoupa", "Roupa"], ["corAcessorio", "Chapéu, laço, cachecol"], ["corOculos", "Armação dos óculos"], ["corJoia", "Brincos e colares"]] },
  { nome: "🖼 Fundo e moldura", partes: ["fundo", "adesivo", "moldura"], cores: [] }
];

// perfil: Firestore (perfis/{uid}) ou, na simulação, o navegador
async function lerPerfil(eu, sim) {
  if (sim) { try { return JSON.parse(localStorage.getItem("sim:perfil") || "null") || {}; } catch (e) { return {}; } }
  return (await getDoc(doc(db, "perfis", eu.uid)).catch(() => null))?.data() || {};
}
async function gravarPerfil(eu, sim, dados) {
  if (sim) { localStorage.setItem("sim:perfil", JSON.stringify(dados)); return; }
  await setDoc(doc(db, "perfis", eu.uid), { avatar: dados.avatar, apelido: String(dados.apelido || "").slice(0, 30), status: STATUS.includes(dados.status) ? dados.status : "", atualizadoEm: serverTimestamp() });
}

// cq = resultado de desenharConquistas ({ ganhas, todas, nivel }); gami = config da gamificação
export async function desenharPerfil(box, { eu, cq, gami, simulacao = false }) {
  if (!box) return;
  if (!gami.personagem) { box.classList.add("oculto"); return; }
  const perfil = await lerPerfil(eu, simulacao), titulos = cq?.ganhas || [];
  const av = avatarValido(perfil.avatar, titulos), nome = perfil.apelido || String(eu.nome || "").split(/\s+/)[0] || "Aluno";
  const liberadas = Object.values(CATALOGO).flat().filter(i => i.trava && liberado(i, titulos)).length, travadas = Object.values(CATALOGO).flat().filter(i => i.trava).length;
  box.classList.remove("oculto"); box.className = "card perfil-aluno";
  box.innerHTML = `<div class="pa-avatar">${svgAvatar(av, 150)}</div>
    <div class="pa-info"><h2>${esc(nome)}</h2><span class="pequeno">${esc(eu.nome || "")}</span>
      <button type="button" class="pa-status" id="paStatus" title="Como você está hoje? Toque para mudar">${perfil.status ? esc(perfil.status) : "＋ Como você está hoje?"}</button>
      <div class="pa-nivel"><b>Nível ${cq?.nivel || 1}</b> · ${(cq?.ganhas || []).length} conquista(s) · 🎨 ${liberadas}/${travadas} skins liberadas</div>
      <div class="pa-medalhas">${(cq?.ganhas || []).slice(-8).map(m => `<span title="${esc(m.t)}">${m.e}</span>`).join("") || `<span class="pequeno">Ganhe conquistas para liberar skins novas!</span>`}</div>
      <div class="linha acoes"><button type="button" id="paEditar">🎨 Editar meu personagem</button>
        ${gami.download ? `<button type="button" class="leve" id="paBaixar">⬇ Baixar meu cartão</button>` : ""}</div></div>`;
  $("#paStatus", box).onclick = () => {
    let escolha = perfil.status || "";
    modal({ titulo: "Como você está hoje?", conteudo: `<p class="pequeno" style="margin-top:0">Escolha uma frase: ela aparece no seu perfil${gami.social ? " e no mural da turma, se você estiver lá" : ""}.</p>
        <div class="op-pilulas status-op">${STATUS.map(t => `<button type="button" data-st="${esc(t)}" class="${t === escolha ? "sel" : ""}">${esc(t)}</button>`).join("")}<button type="button" data-st="" class="${!escolha ? "sel" : ""}">Sem status</button></div>`,
      ok: "Salvar", cancelar: "Cancelar",
      aoAbrir: c => c.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { escolha = b.dataset.st; c.querySelectorAll("[data-st]").forEach(x => x.classList.toggle("sel", x === b)); }),
      antesDeConfirmar: async () => {
        try { await gravarPerfil(eu, simulacao, { ...perfil, avatar: av, status: escolha }); } catch (e) { toast("Não foi possível salvar.", "erro"); return false; }
        perfil.status = escolha; $("#paStatus", box).textContent = escolha || "＋ Como você está hoje?"; return true;
      } });
  };
  $("#paEditar", box).onclick = () => editarPersonagem({ eu, perfil, titulos, simulacao, aoSalvar: () => desenharPerfil(box, { eu, cq, gami, simulacao }) });
  $("#paBaixar", box)?.addEventListener("click", () => baixarCartao({ eu, av, nome, cq }));
  botoesSocial(box, { eu, cq, gami, perfil: { ...perfil, avatar: av }, simulacao });
}

function editarPersonagem({ eu, perfil, titulos, simulacao, aoSalvar }) {
  const inicial = avatarValido(perfil.avatar, titulos);
  let av = { ...inicial }, grupo = 0, parte = GRUPOS[0].partes[0];
  const html = `<div class="ed-perso"><div class="ep-previa"><div id="epPrevia"></div>
        <div class="linha acoes" style="justify-content:center"><button type="button" class="leve" id="epSorte">🎲 Aleatório</button><button type="button" class="leve" id="epDesfaz">↺ Desfazer</button></div>
        <label for="epApelido">Como quer ser chamado(a)</label><input type="text" id="epApelido" maxlength="30" value="${esc(perfil.apelido || "")}" placeholder="${esc(String(eu.nome || "").split(/\s+/)[0] || "")}"></div>
      <div class="ep-controles"><div class="ep-grupos" role="tablist">${GRUPOS.map((g, i) => `<button type="button" role="tab" data-grupo="${i}">${g.nome}</button>`).join("")}</div>
        <div class="ep-abas" id="epPartes"></div><div class="ep-cores" id="epCores"></div><div class="ep-itens" id="epItens"></div></div></div>
    <p class="pequeno">Qualquer corpo pode usar qualquer cabelo, barba, maquiagem, roupa ou acessório. 🔒 Itens com cadeado são <b>skins</b>: liberam com as conquistas. Você tem ${titulos.length} conquista(s).</p>`;
  // cores na ordem de mostrar (a pele vai da mais clara para a mais escura)
  const swatches = k => (k === "pele" ? ORDEM_PELES : CORES[k].map((_, i) => i)).map(i => {
    const c = CORES[k][i] || labioNatural(PELES[av.pele] || PELES[1]), nat = k === "corLabios" && i === 0;
    return `<button type="button" class="sw${nat ? " sw-nat" : ""}" data-cor="${k}" data-i="${i}" style="background:${c}" title="${nat ? "Natural" : ""}" aria-label="${nat ? "Natural" : `cor ${i + 1}`}"></button>`; }).join("");
  const desenhar = c => {
    const g = GRUPOS[grupo];
    $("#epPrevia", c).innerHTML = svgAvatar(av, 220);
    c.querySelectorAll("[data-grupo]").forEach(b => { const on = Number(b.dataset.grupo) === grupo; b.classList.toggle("ativa", on); b.setAttribute("aria-selected", on); });
    $("#epPartes", c).innerHTML = g.partes.map(k => `<button type="button" data-parte="${k}" class="${k === parte ? "ativa" : ""}" aria-pressed="${k === parte}">${esc(NOMES_PARTES[k] || k)}</button>`).join("");
    $("#epCores", c).innerHTML = g.cores.map(([k, r]) => `<div><span class="pequeno">${r}</span><div class="ep-swatches">${swatches(k)}</div></div>`).join("");
    c.querySelectorAll("[data-cor]").forEach(b => { b.classList.toggle("sel", Number(av[b.dataset.cor]) === Number(b.dataset.i)); b.onclick = () => { av[b.dataset.cor] = Number(b.dataset.i); desenhar(c); }; });
    c.querySelectorAll("[data-parte]").forEach(b => b.onclick = () => { parte = b.dataset.parte; desenhar(c); });
    $("#epItens", c).innerHTML = CATALOGO[parte].map(it => { const ok = liberado(it, titulos);
      return `<button type="button" class="ep-item${av[parte] === it.id ? " sel" : ""}${ok ? "" : " travado"}" data-item="${esc(it.id)}" ${ok ? "" : "disabled"} title="${esc(ok ? it.nome : textoTrava(it.trava))}">
        ${svgAvatar({ ...av, [parte]: it.id }, 74, { parte })}<span>${esc(it.nome)}</span>${ok ? (it.trava ? `<small class="ep-novo">✨ skin</small>` : "") : `<small>${esc(textoTrava(it.trava))}</small>`}</button>`; }).join("");
    c.querySelectorAll("[data-item]").forEach(b => b.onclick = () => { av[parte] = b.dataset.item; desenhar(c); });
  };
  return modal({ titulo: "🎨 Meu personagem", conteudo: html, ok: "Salvar personagem", cancelar: "Cancelar", largo: true,
    aoAbrir: c => {
      c.querySelectorAll("[data-grupo]").forEach(b => b.onclick = () => { grupo = Number(b.dataset.grupo); parte = GRUPOS[grupo].partes[0]; desenhar(c); });
      $("#epSorte", c).onclick = () => { av = avatarValido(avatarAleatorio(titulos, { fundo: av.fundo, adesivo: av.adesivo, moldura: av.moldura }), titulos); desenhar(c); };
      $("#epDesfaz", c).onclick = () => { av = { ...inicial }; desenhar(c); };
      desenhar(c);
    },
    antesDeConfirmar: async c => {
      try { await gravarPerfil(eu, simulacao, { avatar: av, apelido: $("#epApelido", c).value.trim(), status: perfil.status || "" }); }
      catch (e) { toast("Não foi possível salvar o personagem.", "erro"); return false; }
      toast(simulacao ? "🧪 Personagem salvo (só neste navegador)." : "Personagem salvo! 🎉", "ok"); aoSalvar(); return true;
    } });
}

// ---------- cartão para baixar ----------
function svgCartao({ av, nome, cq }) {
  const ganhas = cq?.ganhas || [], W = 1080, H = 1350;
  const esc2 = s => esc(s).replace(/&#39;/g, "'");
  const avatar = svgAvatar(av, 520).replace("<svg ", `<svg x="280" y="170" `);
  const meds = ganhas.slice(0, 12);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14213d"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#cg)"/>
    <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="48" fill="#fff" opacity=".06"/>
    <rect x="70" y="80" width="170" height="64" rx="12" fill="#c1272d"/><text x="155" y="124" font-family="Arial" font-weight="bold" font-size="34" fill="#fff" text-anchor="middle" letter-spacing="4">SENAI</text>
    <text x="${W - 80}" y="124" font-family="Arial" font-size="30" fill="#c9d3e6" text-anchor="end">Prova online</text>
    ${avatar}
    <text x="${W / 2}" y="790" font-family="Arial" font-weight="bold" font-size="72" fill="#fff" text-anchor="middle">${esc2(nome)}</text>
    <rect x="${W / 2 - 180}" y="820" width="360" height="70" rx="35" fill="#f59e0b"/><text x="${W / 2}" y="868" font-family="Arial" font-weight="bold" font-size="40" fill="#14213d" text-anchor="middle">Nível ${cq?.nivel || 1}</text>
    <text x="${W / 2}" y="950" font-family="Arial" font-size="34" fill="#c9d3e6" text-anchor="middle">${ganhas.length} conquista(s)</text>
    ${meds.map((m, i) => { const porLinha = Math.min(6, meds.length), col = i % 6, lin = Math.floor(i / 6), x = W / 2 - porLinha * 75 + col * 150, y = 1010 + lin * 150;
      return `<circle cx="${x + 75}" cy="${y + 60}" r="62" fill="#fff" opacity=".12"/><text x="${x + 75}" y="${y + 86}" font-size="72" text-anchor="middle">${m.e}</text>`; }).join("")}
    ${!meds.length ? `<text x="${W / 2}" y="1100" font-family="Arial" font-size="36" fill="#c9d3e6" text-anchor="middle">As conquistas aparecem aqui 🏅</text>` : ""}
  </svg>`;
}
async function svgParaImagem(svg, tipo) {
  const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  await new Promise((ok, falha) => { img.onload = ok; img.onerror = falha; img.src = url; });
  const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350;
  const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  return cv.toDataURL(tipo, .92);
}
function baixar(href, nome) { const a = document.createElement("a"); a.href = href; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); }
function baixarCartao({ eu, av, nome, cq }) {
  const svg = svgCartao({ av, nome, cq }), arq = `meu-perfil-${String(nome).toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-")}`;
  modal({ titulo: "⬇ Baixar meu cartão", conteudo: `<div class="cartao-previa">${svg.replace(/width="1080" height="1350"/, 'width="100%"')}</div>
      <div class="linha acoes" style="justify-content:center"><button type="button" data-f="png">🖼 PNG</button><button type="button" data-f="jpg" class="leve">📷 JPG</button><button type="button" data-f="pdf" class="leve">📄 PDF da página com as conquistas</button></div>
      <p class="pequeno" style="text-align:center">O cartão mostra só o seu personagem, o nível e as medalhas: <b>nenhuma nota</b>.</p>`, ok: "Fechar", largo: true,
    aoAbrir: c => c.querySelectorAll("[data-f]").forEach(b => b.onclick = async () => {
      try {
        if (b.dataset.f === "pdf") return pdfPerfil({ svg, nome, cq });
        baixar(await svgParaImagem(svg, b.dataset.f === "png" ? "image/png" : "image/jpeg"), `${arq}.${b.dataset.f}`);
      } catch (e) { toast("Não foi possível gerar a imagem neste navegador.", "erro"); console.error(e); }
    }) });
}
function pdfPerfil({ svg, nome, cq }) {
  const w = window.open("", "_blank");
  if (!w) return toast("O navegador bloqueou a janela. Libere pop-ups.", "erro");
  const ganhas = cq?.ganhas || [], faltam = (cq?.todas || []).filter(m => !m.ok);
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Perfil — ${esc(nome)}</title>
    <style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#111;margin:0}.top{text-align:center}.top svg{width:300px;height:auto}
    h1{margin:6px 0 2px}h2{font-size:14pt;border-bottom:2px solid #c1272d;padding-bottom:4px;margin-top:18px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .m{border:1px solid #ddd;border-radius:10px;padding:8px;page-break-inside:avoid}.m b{display:block}.e{font-size:26px}.f{opacity:.5}.pq{color:#555;font-size:9pt}</style></head>
    <body><div class="top">${svg.replace(/width="1080" height="1350"/, 'width="300" height="375"')}</div>
    <h2>🏅 Conquistas (${ganhas.length})</h2><div class="g">${ganhas.map(m => `<div class="m"><span class="e">${m.e}</span><b>${esc(m.t)}</b><span class="pq">${esc(m.d)}</span></div>`).join("") || "<p>Nenhuma ainda.</p>"}</div>
    ${faltam.length ? `<h2>🎯 Próximas conquistas</h2><div class="g">${faltam.slice(0, 9).map(m => `<div class="m f"><span class="e">${m.e}</span><b>${esc(m.t)}</b><span class="pq">${esc(m.d)}${m.prog ? ` · ${m.prog[0]}/${m.prog[1]}` : ""}</span></div>`).join("")}</div>` : ""}
    <p class="pq" style="text-align:center;margin-top:16px">SENAI · Prova online · ${new Date().toLocaleDateString("pt-BR")}</p>
    <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);
  w.document.close();
}

// ---------- simulação (equipe): notas de mentira, medalhas dadas e diário, tudo só no navegador ----------
export function lerSimulacao() {
  try { return { notas: "Banco de Dados | 85\nFront-End | 90\nBanco de Dados | 92\nLógica | 70", acess: false, dados: [], ...JSON.parse(localStorage.getItem("sim:config") || "{}") }; }
  catch (e) { return { notas: "", acess: false, dados: [] }; }
}
export function provasSimuladas(cfg) {
  return String(cfg.notas || "").split("\n").map(l => l.split("|").map(x => x.trim())).filter(x => x[0] && x[1] !== undefined && x[1] !== "")
    .map(([materia, nota, vidas], i) => ({ id: "sim" + i, titulo: `Prova ${i + 1}`, materia, nota: Math.max(0, Math.min(100, Number(nota) || 0)), data: Date.now() - (50 - i) * 86400000, vidasPerdidas: Number(vidas) || 0 }));
}
export const RESUMO_SIMULADO = { aulas: 12, sequencia: 5, estrelas: 30, autonomia: 6, foco: 3, compreensao: 4, vitorias: 4, topicos: 6 };
export function painelSimulacao(box, todas, aoAplicar) {
  const cfg = lerSimulacao();
  box.classList.remove("oculto");
  box.innerHTML = `<h2>🧪 Painel da simulação</h2>
    <p class="pequeno" style="margin-top:0">Isto só existe para a equipe testar. <b>Nada é gravado no sistema</b> (fica só neste navegador) e nenhum aluno vê.</p>
    <label for="simNotas">Notas de mentira — uma prova por linha: <span class="mono">Matéria | nota | vidas perdidas (opcional)</span></label>
    <textarea id="simNotas" style="min-height:110px">${esc(cfg.notas)}</textarea>
    <label class="check"><input type="checkbox" id="simAcess"${cfg.acess ? " checked" : ""}> <span>Simular aluno com acessibilidade (medalhas da sala de aula, a partir do diário)</span></label>
    <details class="ajuda-extra"${cfg.dados?.length ? " open" : ""}><summary>🏅 Me dar conquistas (marque para ganhar na hora)</summary>
      <div class="lista-temas" style="margin-top:8px">${(todas || []).map(m => `<label class="check"><input type="checkbox" data-dar="${esc(m.t)}"${cfg.dados?.includes(m.t) ? " checked" : ""}> <span>${m.e} ${esc(m.t)}</span></label>`).join("")}</div></details>
    <div class="linha acoes" style="margin-top:10px"><button type="button" id="simAplicar">Aplicar e ver</button><button type="button" class="leve" id="simTudo">🏆 Me dar todas</button><button type="button" class="leve" id="simZerar">↺ Zerar simulação</button></div>`;
  const salvar = c => { localStorage.setItem("sim:config", JSON.stringify(c)); aoAplicar(); };
  $("#simAplicar", box).onclick = () => salvar({ notas: $("#simNotas", box).value, acess: $("#simAcess", box).checked, dados: [...box.querySelectorAll("[data-dar]:checked")].map(x => x.dataset.dar) });
  $("#simTudo", box).onclick = () => salvar({ notas: $("#simNotas", box).value, acess: true, dados: (todas || []).map(m => m.t) });
  $("#simZerar", box).onclick = () => { localStorage.removeItem("sim:config"); localStorage.removeItem("sim:perfil"); localStorage.removeItem("conquistas:sim:" + "x"); aoAplicar(); };
}
