// Gráfico de linhas em SVG (sem biblioteca), seguindo as regras de visualização do projeto:
// um eixo só, linhas de 2px, marcadores de 8px com anel da cor do fundo, grade discreta, rótulo direto no fim de cada
// linha, legenda quando há 2+ séries, dica (tooltip) ao passar o mouse e tabela com os mesmos dados (acessibilidade).
// Paleta do sistema (tokens --marinho-2, --info, --ok, --ambar, --vermelho), nessa ordem, sempre.
export const CORES_SERIES = ["#1f3160", "#2459c7", "#12805c", "#f5a524", "#c8102e"];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = v => (Math.round(v * 10) / 10).toLocaleString("pt-BR");

// rotulos = ["01/09", ...] (eixo x, em ordem) · series = [{ nome, cor?, valores: [número | null] }] · y = { min, max, passo, sufixo }
// ref = { valor, rotulo } (linha de referência tracejada, ex.: média mínima)
export function graficoLinhas({ titulo, rotulos, series, y, ref = null, altura = 260 }) {
  const W = 720, H = altura, m = { e: 44, d: 110, t: 16, b: 34 }, w = W - m.e - m.d, h = H - m.t - m.b;
  const X = i => m.e + (rotulos.length <= 1 ? w / 2 : i * w / (rotulos.length - 1)), Y = v => m.t + h - (v - y.min) / (y.max - y.min) * h;
  const passos = []; for (let v = y.min; v <= y.max + 1e-9; v += y.passo) passos.push(v);
  const cores = series.map((s, i) => s.cor || CORES_SERIES[i % CORES_SERIES.length]);
  const cada = Math.max(1, Math.ceil(rotulos.length / 10));   // no máximo ~10 rótulos no eixo x
  // rótulo direto no fim de cada série, sem sobrepor (empurra para baixo)
  const fins = series.map((s, i) => { const k = s.valores.map((v, j) => [v, j]).filter(([v]) => v !== null && v !== undefined).pop(); return k ? { i, y: Y(k[0]), x: X(k[1]), v: k[0] } : null; }).filter(Boolean).sort((a, b) => a.y - b.y);
  for (let k = 1; k < fins.length; k++) if (fins[k].y - fins[k - 1].y < 16) fins[k].y = fins[k - 1].y + 16;
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="graf" role="img" aria-label="${esc(titulo)}">
    ${passos.map(v => `<line x1="${m.e}" x2="${m.e + w}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e7eb" stroke-width="1"/><text x="${m.e - 8}" y="${Y(v) + 4}" text-anchor="end" class="graf-eixo">${fmt(v)}${y.sufixo || ""}</text>`).join("")}
    ${rotulos.map((r, i) => i % cada === 0 || i === rotulos.length - 1 ? `<text x="${X(i)}" y="${H - 10}" text-anchor="middle" class="graf-eixo">${esc(r)}</text>` : "").join("")}
    ${ref ? `<line x1="${m.e}" x2="${m.e + w}" y1="${Y(ref.valor)}" y2="${Y(ref.valor)}" stroke="#6b7280" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${m.e + w + 6}" y="${Y(ref.valor) + 4}" class="graf-eixo">${esc(ref.rotulo)}</text>` : ""}
    ${series.map((s, i) => {
      const pts = s.valores.map((v, j) => v === null || v === undefined ? null : [X(j), Y(v), v, j]);
      // quebra a linha onde falta valor
      const trechos = []; let atual = [];
      pts.forEach(p => { if (p) atual.push(p); else if (atual.length) { trechos.push(atual); atual = []; } }); if (atual.length) trechos.push(atual);
      return trechos.map(t => `<polyline points="${t.map(p => `${p[0]},${p[1]}`).join(" ")}" fill="none" stroke="${cores[i]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join("") +
        pts.filter(Boolean).map(p => `<g class="graf-pt" data-dica="${esc(`${s.nome} · ${rotulos[p[3]]}: ${fmt(p[2])}${y.sufixo || ""}`)}"><circle cx="${p[0]}" cy="${p[1]}" r="12" fill="transparent"/><circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${cores[i]}" stroke="#fff" stroke-width="2"/></g>`).join("");
    }).join("")}
    ${fins.map(f => `<text x="${m.e + w + 8}" y="${f.y + 4}" class="graf-rot">${esc(series[f.i].nome)}</text><line x1="${f.x + 6}" x2="${m.e + w + 4}" y1="${Y(f.v)}" y2="${f.y}" stroke="${cores[f.i]}" stroke-width="1" opacity=".6"/>`).join("")}
  </svg>`;
  const legenda = series.length > 1 ? `<div class="graf-legenda">${series.map((s, i) => `<span><i style="background:${cores[i]}"></i>${esc(s.nome)}</span>`).join("")}</div>` : "";
  const tabela = `<details class="graf-tabela"><summary>Ver os números (tabela)</summary><div class="tabela"><table><tr><th></th>${rotulos.map(r => `<th>${esc(r)}</th>`).join("")}</tr>
    ${series.map(s => `<tr><th>${esc(s.nome)}</th>${s.valores.map(v => `<td>${v === null || v === undefined ? "—" : fmt(v)}</td>`).join("")}</tr>`).join("")}</table></div></details>`;
  return `<figure class="graf-fig"><figcaption>${esc(titulo)}</figcaption>${legenda}<div class="graf-area">${svg}<div class="graf-dica" hidden></div></div>${tabela}</figure>`;
}
// liga as dicas (chamar depois de pôr o HTML na página)
export function ligarGraficos(raiz) {
  raiz.querySelectorAll(".graf-area").forEach(area => {
    const dica = area.querySelector(".graf-dica");
    area.querySelectorAll(".graf-pt").forEach(p => {
      p.onmouseenter = () => { const r = p.getBoundingClientRect(), a = area.getBoundingClientRect(); dica.textContent = p.dataset.dica; dica.hidden = false; dica.style.left = (r.left - a.left + r.width / 2) + "px"; dica.style.top = (r.top - a.top - 8) + "px"; };
      p.onmouseleave = () => { dica.hidden = true; };
    });
  });
}
