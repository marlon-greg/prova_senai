// Leitor de slides/PDF dentro da página (PDF.js): uma página por vez, ◀ ▶, número da página e zoom.
// Uso: const leitor = await abrirLeitorPdf(elemento, bytes, { pagina: 1 }); ... leitor.pagina; leitor.destruir();
const VERSAO = "4.10.38";
const BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${VERSAO}/build`;
let pdfjs = null;
async function carregarPdfjs() {
  if (!pdfjs) {
    pdfjs = await import(`${BASE}/pdf.min.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${BASE}/pdf.worker.min.mjs`;
  }
  return pdfjs;
}

export async function abrirLeitorPdf(el, bytes, { pagina: paginaInicial = 1 } = {}) {
  const lib = await carregarPdfjs();
  // PDF.js transfere o buffer para o worker: passa uma cópia para o cache continuar usável
  const pdf = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  el.innerHTML = `
    <div class="leitor" tabindex="0" aria-label="Leitor de slides. Use as setas para trocar de página.">
      <div class="leitor-barra">
        <button type="button" class="leve mini" data-l="ant" aria-label="Página anterior">◀</button>
        <span class="leitor-pag"><input type="number" min="1" max="${pdf.numPages}" value="1" aria-label="Página"> / ${pdf.numPages}</span>
        <button type="button" class="leve mini" data-l="prox" aria-label="Próxima página">▶</button>
        <span class="leitor-sep"></span>
        <button type="button" class="leve mini" data-l="menos" aria-label="Diminuir zoom">−</button>
        <span class="leitor-zoom">100%</span>
        <button type="button" class="leve mini" data-l="mais" aria-label="Aumentar zoom">+</button>
        <button type="button" class="leve mini" data-l="ajustar" title="Ajustar à largura">⤢</button>
        <button type="button" class="leve mini leitor-roda" data-l="roda" aria-pressed="false" title="Zoom com a roda do mouse: liga/desliga (Ctrl + roda sempre dá zoom)">🖱 Zoom na roda</button>
      </div>
      <div class="leitor-area"><canvas></canvas></div>
    </div>`;
  const raiz = el.querySelector(".leitor"), area = el.querySelector(".leitor-area"), canvas = el.querySelector("canvas");
  const campo = el.querySelector(".leitor-pag input"), rotZoom = el.querySelector(".leitor-zoom");
  let pagina = Math.min(pdf.numPages, Math.max(1, Math.round(Number(paginaInicial) || 1))), zoom = 1, tarefa = null, vivo = true, ocupado = false, pendente = false;

  // um desenho por vez no mesmo canvas; pedido no meio de outro cancela o atual e redesenha no fim
  async function desenhar() {
    if (!vivo) return;
    if (ocupado) { pendente = true; tarefa?.cancel(); return; }
    ocupado = true;
    try { await desenharAgora(); } finally { ocupado = false; tarefa = null; }
    if (pendente && vivo) { pendente = false; desenhar(); }
  }
  async function desenharAgora() {
    const pg = await pdf.getPage(pagina);
    const base = pg.getViewport({ scale: 1 });
    const largura = Math.max(100, area.clientWidth - 16);
    const escala = (largura / base.width) * zoom;
    const vp = pg.getViewport({ scale: escala });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width = Math.floor(vp.width) + "px"; canvas.style.height = Math.floor(vp.height) + "px";
    tarefa = pg.render({ canvasContext: canvas.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
    try { await tarefa.promise; } catch (e) { if (e?.name !== "RenderingCancelledException") console.warn(e); }
    campo.value = pagina; rotZoom.textContent = Math.round(zoom * 100) + "%";
    el.querySelector("[data-l=ant]").disabled = pagina <= 1;
    el.querySelector("[data-l=prox]").disabled = pagina >= pdf.numPages;
  }
  const irPara = n => { n = Math.min(pdf.numPages, Math.max(1, Math.round(Number(n) || 1))); if (n !== pagina) { pagina = n; area.scrollTop = 0; } desenhar(); };
  const mudarZoom = z => { zoom = Math.min(4, Math.max(0.4, z)); desenhar(); };

  el.querySelector("[data-l=ant]").onclick = () => irPara(pagina - 1);
  el.querySelector("[data-l=prox]").onclick = () => irPara(pagina + 1);
  el.querySelector("[data-l=menos]").onclick = () => mudarZoom(zoom - 0.25);
  el.querySelector("[data-l=mais]").onclick = () => mudarZoom(zoom + 0.25);
  el.querySelector("[data-l=ajustar]").onclick = () => mudarZoom(1);
  // zoom com a roda do mouse: ligado = a roda aumenta/diminui; desligado = a roda rola o slide.
  // Ctrl + roda (e o gesto de pinça do touchpad) sempre dá zoom no slide, nunca na página inteira.
  const btnRoda = el.querySelector("[data-l=roda]");
  let roda = localStorage.getItem("leitorZoomRoda") === "1", esperaRoda = null;
  const mostrarRoda = () => { btnRoda.setAttribute("aria-pressed", roda ? "true" : "false"); btnRoda.classList.toggle("ativo", roda); };
  btnRoda.onclick = () => { roda = !roda; localStorage.setItem("leitorZoomRoda", roda ? "1" : "0"); mostrarRoda(); };
  mostrarRoda();
  area.addEventListener("wheel", e => {
    if (!roda && !e.ctrlKey) return;   // rolagem normal
    e.preventDefault();
    const passo = Math.min(0.25, Math.max(0.05, Math.abs(e.deltaY) / 400));
    zoom = Math.min(4, Math.max(0.4, zoom + (e.deltaY < 0 ? passo : -passo)));
    rotZoom.textContent = Math.round(zoom * 100) + "%";
    clearTimeout(esperaRoda); esperaRoda = setTimeout(desenhar, 80);   // junta vários giros num desenho só
  }, { passive: false });
  campo.onchange = () => irPara(campo.value);
  raiz.addEventListener("keydown", e => {
    if (e.target === campo) return;
    if (["ArrowRight", "PageDown", "ArrowDown"].includes(e.key)) { e.preventDefault(); irPara(pagina + 1); }
    if (["ArrowLeft", "PageUp", "ArrowUp"].includes(e.key)) { e.preventDefault(); irPara(pagina - 1); }
    if (e.key === "Home") { e.preventDefault(); irPara(1); }
    if (e.key === "End") { e.preventDefault(); irPara(pdf.numPages); }
  });
  // painel redimensionado (arrastar o canto, girar o celular): redesenha na nova largura
  let espera = null, larguraAntes = area.clientWidth;
  const obs = new ResizeObserver(() => {
    if (Math.abs(area.clientWidth - larguraAntes) < 4) return;
    larguraAntes = area.clientWidth; clearTimeout(espera); espera = setTimeout(desenhar, 120);
  });
  obs.observe(area);
  await desenhar();
  return {
    destruir() { vivo = false; obs.disconnect(); tarefa?.cancel(); pdf.destroy(); el.innerHTML = ""; },
    get paginas() { return pdf.numPages; },
    get pagina() { return pagina; }
  };
}
