// Extensões do navegador que atrapalham a prova (usado por js/aluno.js).
//
// 1. BLOQUEADOR DE ANÚNCIOS (AdBlock, uBlock…): pode esconder partes da página e travar a gravação. A prova pede para
//    desligar antes de começar (o teste é a "isca": um bloco com cara de anúncio que o bloqueador esconde).
// 2. EXTENSÕES DE IA / ESCRITA (Grammarly, Monica, Sider, MaxAI, Merlin, HARPA, QuillBot…): leem a questão e escrevem
//    a resposta. São reconhecidas pelo que colocam na página (elementos, atributos, quadros chrome-extension://).
//    Não dá para ver a lista de extensões instaladas: só o que elas mostram na página. A dica para o aluno é a janela
//    anônima (Ctrl+Shift+N), onde as extensões ficam desligadas por padrão.

const ASSINATURAS = [
  ["Grammarly", "grammarly-desktop-integration, grammarly-extension, grammarly-popups, [data-gr-ext-installed], [data-new-gr-c-s-check-loaded], [data-grammarly-shadow-root]"],
  ["Monica (IA)", "#monica-content-root, monica-widget, [id^='monica-'], [class^='monica-']"],
  ["Sider (IA)", "#sider-root, sider-sidebar, [id^='sider-'], [class*='sider-ai']"],
  ["MaxAI", "#USE_CHAT_GPT_AI_ROOT, #USE_CHAT_GPT_AI_ROOT_Context_Menu, use-chat-gpt-ai, [id^='maxai']"],
  ["Merlin (IA)", "#merlin-root, merlin-component, [id^='merlin-'], [class*='merlin-']"],
  ["HARPA AI", "harpa-ai, #harpa-ai, [id^='harpa']"],
  ["QuillBot", "quillbot-extension-portal, [id^='quillbot'], [data-quillbot-element]"],
  ["Wordtune", "wordtune-extension, [id^='wordtune'], [data-wordtune]"],
  ["ChatGPT (extensão)", "#chatgpt-sidebar, chatgpt-sidebar, [id^='chatgpt-'], [class^='chatgpt-']"],
  ["Gemini/Copilot (extensão)", "[id^='gemini-ext'], [id^='copilot-ext']"],
  ["Compose AI", "compose-ai, [id^='compose-ai']"],
  ["AITOPIA", "[id^='aitopia'], aitopia-root"],
  ["Glarity", "#glarity-root, [id^='glarity']"],
  ["LanguageTool", "lt-toolbar, lt-highlighter, [data-lt-installed]"]
];
const PALAVRAS_IA = /(monica|sider|merlin|maxai|harpa|chatgpt|openai|copilot|gemini|claude|perplexity|quillbot|wordtune|grammarly|aitopia|glarity|compose-?ai|languagetool|writesonic|jasper|tinywow|brainly|gauth|answer-?ai|studyx|quizlet)/i;
// elementos da própria página que podem estar direto no <html> ou no <body> (não contam como extensão)
const NOSSOS = new Set(["HEAD", "BODY", "SCRIPT", "STYLE", "LINK", "NOSCRIPT", "TEMPLATE", "META"]);

/** Extensões de IA/escrita reconhecidas na página agora (lista de nomes). */
export function extensoesIA(doc = document) {
  const achadas = new Set();
  for (const [nome, sel] of ASSINATURAS) {
    try { if (doc.querySelector(sel)) achadas.add(nome); } catch { /* seletor não suportado */ }
  }
  // quadros e recursos carregados de dentro de uma extensão
  doc.querySelectorAll("iframe[src^='chrome-extension:'], iframe[src^='moz-extension:'], iframe[src^='extension:'], img[src^='chrome-extension:'], link[href^='chrome-extension:'], script[src^='chrome-extension:']")
    .forEach(el => achadas.add(nomeDoElemento(el) || "Extensão do navegador"));
  // elementos estranhos pendurados direto no <html> (é onde muitas extensões montam a barra lateral)
  [...doc.documentElement.children].forEach(el => {
    if (NOSSOS.has(el.tagName)) return;
    achadas.add(nomeDoElemento(el) || "Extensão do navegador");
  });
  // elementos com nome de IA conhecida direto no <body> (barras laterais, botões flutuantes)
  [...(doc.body?.children || [])].forEach(el => {
    if (NOSSOS.has(el.tagName) || el.id === "sobreposicao") return;
    const n = nomeDoElemento(el);
    if (n) achadas.add(n);
  });
  return [...achadas];
}
function nomeDoElemento(el) {
  const txt = `${el.tagName} ${el.id || ""} ${typeof el.className === "string" ? el.className : ""} ${el.getAttribute?.("src") || ""}`;
  const m = txt.match(PALAVRAS_IA);
  if (!m) return "";
  const k = m[1].toLowerCase();
  return ASSINATURAS.find(([nome]) => nome.toLowerCase().startsWith(k.replace(/-/g, "")))?.[0] || (k[0].toUpperCase() + k.slice(1));
}

/** true se um bloqueador de anúncios está ligado (esconde a isca). */
export function temBloqueadorDeAnuncios() {
  return new Promise(res => {
    const isca = document.createElement("div");
    isca.className = "adsbox ad-banner ad-placement pub_300x250 textads banner-ads adsbygoogle";
    isca.setAttribute("aria-hidden", "true");
    isca.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:300px;height:250px;";
    isca.innerHTML = "&nbsp;";
    document.body.appendChild(isca);
    setTimeout(() => {
      const cs = getComputedStyle(isca);
      const escondida = !isca.isConnected || isca.offsetHeight === 0 || isca.offsetParent === null && cs.position !== "fixed"
        || cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0";
      isca.remove();
      res(escondida);
    }, 150);
  });
}

/** Confere tudo: { bloqueador: bool, ia: [nomes] }. */
export async function conferirExtensoes() {
  return { bloqueador: await temBloqueadorDeAnuncios().catch(() => false), ia: extensoesIA() };
}

/** Texto para o aluno com o que desligar. */
export function textoExtensoes({ bloqueador, ia }) {
  const l = [];
  if (bloqueador) l.push("um <b>bloqueador de anúncios</b> (AdBlock, uBlock ou parecido)");
  if (ia.length) l.push(`extensão de <b>IA/escrita</b>: ${ia.map(n => `<b>${n}</b>`).join(", ")}`);
  return l.length ? `Detectamos ${l.join(" e ")} neste navegador. Desligue (clique no ícone de quebra-cabeça 🧩 ao lado da barra de endereço → Gerenciar extensões) e clique em <b>Conferir de novo</b>.<br>Dica: numa <b>janela anônima</b> (Ctrl+Shift+N, antes de começar) as extensões já ficam desligadas.` : "";
}

/** Observa a página durante a prova: chama aoDetectar(nomes) quando aparece extensão de IA nova. Devolve a função que para. */
export function vigiarExtensoes(aoDetectar) {
  let vistas = new Set(extensoesIA());
  let pendente = null;
  const conferir = () => {
    pendente = null;
    const agora = extensoesIA(), novas = agora.filter(n => !vistas.has(n));
    vistas = new Set(agora);
    if (novas.length) aoDetectar(agora, novas);
  };
  const obs = new MutationObserver(() => { if (!pendente) pendente = setTimeout(conferir, 300); });
  obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-gr-ext-installed", "data-new-gr-c-s-check-loaded", "data-lt-installed"] });
  const t = setInterval(conferir, 4000);
  return () => { obs.disconnect(); clearInterval(t); if (pendente) clearTimeout(pendente); };
}
