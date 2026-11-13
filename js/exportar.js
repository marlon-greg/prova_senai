// Exportar uma lista (erros, sugestões…) em PDF, TXT ou CSV — para guardar ou mandar para outra IA.
// Módulo sem dependências: o MESMO arquivo existe em aulas_senai/site/js e em prova_senai/js.
//   exportarLista({ titulo, subtitulo, campos: [{ k, t, longo? }], linhas: [{...}], arquivo, formato: "pdf"|"txt"|"csv" })
// PDF: abre a impressão do navegador num quadro escondido (escolha "Salvar como PDF").
const limpa = v => (v === null || v === undefined ? "" : String(v)).replace(/\r/g, "").trim();
const escH = s => limpa(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hoje = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const nomeArq = s => String(s || "lista").normalize("NFD").replace(/\p{M}+/gu, "").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();

function baixar(nome, conteudo, tipo) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function paraCSV(campos, linhas) {
  const q = v => `"${limpa(v).replace(/"/g, '""')}"`;
  return "﻿" + [campos.map(c => q(c.t)), ...linhas.map(l => campos.map(c => q(l[c.k])))].map(r => r.join(";")).join("\r\n");
}

export function paraTXT({ titulo, subtitulo = "" }, campos, linhas) {
  const cab = [titulo, subtitulo, `Gerado em ${hoje()} · ${linhas.length} item(ns)`].filter(Boolean);
  const blocos = linhas.map((l, i) => [`#${i + 1}`, ...campos.filter(c => limpa(l[c.k])).map(c => c.longo ? `${c.t}:\n${limpa(l[c.k])}` : `${c.t}: ${limpa(l[c.k])}`)].join("\n"));
  return [cab.join("\n"), "=".repeat(60), blocos.join("\n\n" + "-".repeat(60) + "\n\n") || "(nenhum item)"].join("\n\n") + "\n";
}

function paraHTML({ titulo, subtitulo = "" }, campos, linhas) {
  const curtos = campos.filter(c => !c.longo), longos = campos.filter(c => c.longo);
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escH(titulo)}</title><style>
    body{font:11pt/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#111;margin:18mm 14mm}
    h1{font-size:16pt;margin:0 0 2px}.sub{color:#555;margin:0 0 14px;font-size:10pt}
    .it{border:1px solid #ccc;border-radius:6px;padding:8px 10px;margin:0 0 10px;break-inside:avoid}
    .n{font-weight:700;color:#0b4f8a}.meta{font-size:9.5pt;color:#333;margin:2px 0 6px}.meta b{color:#000}
    .rot{font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em;color:#666;margin-top:6px}
    .tx{white-space:pre-wrap}@page{size:A4;margin:0}</style></head><body>
    <h1>${escH(titulo)}</h1><p class="sub">${subtitulo ? escH(subtitulo) + " · " : ""}Gerado em ${escH(hoje())} · ${linhas.length} item(ns)</p>
    ${linhas.map((l, i) => `<div class="it"><span class="n">#${i + 1}</span>
      <div class="meta">${curtos.filter(c => limpa(l[c.k])).map(c => `<b>${escH(c.t)}:</b> ${escH(l[c.k])}`).join(" · ")}</div>
      ${longos.filter(c => limpa(l[c.k])).map(c => `<div class="rot">${escH(c.t)}</div><div class="tx">${escH(l[c.k])}</div>`).join("")}</div>`).join("") || "<p>(nenhum item)</p>"}
    </body></html>`;
}

function imprimir(html) {
  const f = document.createElement("iframe");
  f.setAttribute("aria-hidden", "true");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentWindow.document; d.open(); d.write(html); d.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 300);
}

export function exportarLista({ titulo, subtitulo = "", campos, linhas, arquivo, formato }) {
  const base = `${nomeArq(arquivo || titulo)}_${new Date().toISOString().slice(0, 10)}`;
  if (formato === "csv") return baixar(base + ".csv", paraCSV(campos, linhas), "text/csv;charset=utf-8");
  if (formato === "txt") return baixar(base + ".txt", paraTXT({ titulo, subtitulo }, campos, linhas), "text/plain;charset=utf-8");
  return imprimir(paraHTML({ titulo, subtitulo }, campos, linhas));
}

// Botão "Baixar" (menu com os 3 formatos) + caixa "sem nomes dos alunos". Devolve o HTML; ligue com ligarBotaoExportar.
export const botaoExportarHTML = (id = "btnExportar") => `<span class="exp-wrap" style="display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap">
  <label class="check pequeno" style="margin:0;font-weight:400"><input type="checkbox" id="${id}Anon" checked> sem nomes dos alunos</label>
  <select id="${id}" aria-label="Baixar a lista" style="width:auto"><option value="">⬇ Baixar…</option><option value="pdf">PDF</option><option value="txt">TXT (para IA)</option><option value="csv">CSV (planilha)</option></select></span>`;
// obterDados(anonimo) → { titulo, subtitulo, campos, linhas, arquivo }
export function ligarBotaoExportar(raiz, obterDados, id = "btnExportar") {
  const sel = raiz.querySelector("#" + id); if (!sel) return;
  sel.onchange = () => {
    const formato = sel.value; sel.value = ""; if (!formato) return;
    const anon = !!raiz.querySelector(`#${id}Anon`)?.checked;
    exportarLista({ ...obterDados(anon), formato });
  };
}
