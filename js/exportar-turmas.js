// Exportar turmas (nome e e-mail dos alunos) em Excel (.xlsx de verdade, sem biblioteca) e em PDF (janela de impressão).
// Excel: aba "Resumo" + aba "Todos os alunos" + uma aba por turma (título, cabeçalho fixo, filtro, linhas zebradas).
// PDF: sumário (quando há mais de uma turma) e cada turma começando numa página nova.
// turmas = [{ nome, alunos: [{ nome, email }], info: "texto curto (dias, semestre do curso)" }]

const escXml = s => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escHtml = escXml;
const ordenar = l => [...l].sort((a, b) => (a.nome || a.email || "").localeCompare(b.nome || b.email || "", "pt-BR", { sensitivity: "base" }));
const agora = () => new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const nomeArquivo = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "turmas";
const SEM_EMAIL = "aguardando o 1º login";
const tituloTurma = n => /^turma\b/i.test(n) ? n : `Turma ${n}`;   // "Turma B" não vira "Turma Turma B"

// ------------------------------------------------------------ ZIP (sem compressão) para o .xlsx
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(arquivos) {   // [{ nome, texto }] -> Blob
  const enc = new TextEncoder(), partes = [], central = [];
  const d = new Date(), hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let pos = 0;
  for (const a of arquivos) {
    const nome = enc.encode(a.nome), dados = enc.encode(a.texto), crc = crc32(dados);
    const loc = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, hora, 2], [12, dia, 2], [14, crc, 4], [18, dados.length, 4], [22, dados.length, 4], [26, nome.length, 2], [28, 0, 2]]
      .forEach(([o, v, n]) => n === 4 ? loc.setUint32(o, v, true) : loc.setUint16(o, v, true));
    const cen = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, hora, 2], [14, dia, 2], [16, crc, 4], [20, dados.length, 4], [24, dados.length, 4], [28, nome.length, 2],
     [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, pos, 4]].forEach(([o, v, n]) => n === 4 ? cen.setUint32(o, v, true) : cen.setUint16(o, v, true));
    partes.push(loc, nome, dados); central.push(cen, nome);
    pos += 30 + nome.length + dados.length;
  }
  const tamCentral = central.reduce((s, x) => s + x.byteLength, 0), fim = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, arquivos.length, 2], [10, arquivos.length, 2], [12, tamCentral, 4], [16, pos, 4], [20, 0, 2]]
    .forEach(([o, v, n]) => n === 4 ? fim.setUint32(o, v, true) : fim.setUint16(o, v, true));
  return new Blob([...partes, ...central, fim], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ------------------------------------------------------------ planilha
// estilos (índice em cellXfs): 1 título · 2 subtítulo · 3 cabeçalho · 4 texto · 5 texto zebra · 6 nº · 7 nº zebra · 8 sem e-mail · 9 sem e-mail zebra · 10 total
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="6"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF1F2A44"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF5F6673"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF8A8F99"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF1F2A44"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC1272D"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6E9EF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD0D5DD"/></left><right style="thin"><color rgb="FFD0D5DD"/></right><top style="thin"><color rgb="FFD0D5DD"/></top><bottom style="thin"><color rgb="FFD0D5DD"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
const col = i => { let s = ""; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
const celula = (ref, v, s) => typeof v === "number" ? `<c r="${ref}" s="${s}"><v>${v}</v></c>` : v === "" || v == null ? `<c r="${ref}" s="${s}"/>` : `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escXml(v)}</t></is></c>`;
// folha = { titulo, sub, cab: [..], larguras: [..], linhas: [{ v: [..], s: [estilo normal..], sz: [estilo zebra..] }], total: [..] }
function folhaXml(f) {
  const n = f.cab.length, ult = col(n - 1), rows = [];
  rows.push(`<row r="1" ht="24" customHeight="1">${celula("A1", f.titulo, 1)}</row>`);
  rows.push(`<row r="2">${celula("A2", f.sub, 2)}</row>`);
  rows.push(`<row r="4" ht="20" customHeight="1">${f.cab.map((c, i) => celula(col(i) + 4, c, f.centro?.includes(i) ? 12 : 3)).join("")}</row>`);
  f.linhas.forEach((l, k) => { const r = 5 + k, z = k % 2 === 1; rows.push(`<row r="${r}" ht="18" customHeight="1">${l.v.map((v, i) => celula(col(i) + r, v, (z ? l.sz : l.s)[i])).join("")}</row>`); });
  const fimDados = 4 + Math.max(f.linhas.length, 1);
  if (f.total) { const r = fimDados + 1; rows.push(`<row r="${r}" ht="18" customHeight="1">${f.total.map((v, i) => celula(col(i) + r, v, typeof v === "number" ? 11 : 10)).join("")}</row>`); }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${f.larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rows.join("")}</sheetData>
${f.linhas.length ? `<autoFilter ref="A4:${ult}${fimDados}"/>` : ""}
<mergeCells count="2"><mergeCell ref="A1:${ult}1"/><mergeCell ref="A2:${ult}2"/></mergeCells>
<printOptions horizontalCentered="1"/>
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>&amp;L${escXml(f.titulo)}&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter>
</worksheet>`;
}
const largura = (vals, min, max) => Math.min(max, Math.max(min, ...vals.map(v => String(v ?? "").length + 2)));
function nomesDeAba(nomes) {
  const usados = new Set();
  return nomes.map(n => {
    let base = String(n || "Turma").replace(/[[\]:*?/\\]/g, "-").replace(/^'+|'+$/g, "").trim().slice(0, 31) || "Turma", s = base, i = 2;
    while (usados.has(s.toLowerCase())) { const suf = ` (${i++})`; s = base.slice(0, 31 - suf.length) + suf; }
    usados.add(s.toLowerCase()); return s;
  });
}

export function exportarExcel(turmas, titulo = "Turmas") {
  const quando = agora(), folhas = [];
  const totAl = turmas.reduce((s, t) => s + t.alunos.length, 0), totEm = turmas.reduce((s, t) => s + t.alunos.filter(a => a.email).length, 0);
  if (turmas.length > 1) {
    folhas.push({ aba: "Resumo", titulo: `${titulo} — resumo`, sub: `${turmas.length} turmas · ${totAl} alunos · gerado em ${quando}`,
      cab: ["Turma", "Alunos", "Com e-mail", "Aguardando 1º login", "Informações"], centro: [1, 2, 3],
      larguras: [largura(turmas.map(t => t.nome), 18, 40), 10, 13, 21, largura(turmas.map(t => t.info), 20, 60)],
      linhas: turmas.map(t => { const c = t.alunos.filter(a => a.email).length; return { v: [t.nome, t.alunos.length, c, t.alunos.length - c, t.info || ""], s: [4, 6, 6, 6, 4], sz: [5, 7, 7, 7, 5] }; }),
      total: ["Total", totAl, totEm, totAl - totEm, ""] });
    const todos = turmas.flatMap(t => ordenar(t.alunos).map(a => ({ t: t.nome, a })));
    folhas.push({ aba: "Todos os alunos", titulo: `${titulo} — todos os alunos`, sub: `${todos.length} alunos de ${turmas.length} turmas · filtre pela coluna Turma · gerado em ${quando}`,
      cab: ["Nº", "Turma", "Nome", "E-mail"], centro: [0],
      larguras: [6, largura(turmas.map(t => t.nome), 14, 34), largura(todos.map(x => x.a.nome), 24, 48), largura(todos.map(x => x.a.email || SEM_EMAIL), 26, 48)],
      linhas: todos.map((x, i) => ({ v: [i + 1, x.t, x.a.nome || "", x.a.email || SEM_EMAIL], s: [6, 4, 4, x.a.email ? 4 : 8], sz: [7, 5, 5, x.a.email ? 5 : 9] })) });
  }
  for (const t of turmas) {
    const al = ordenar(t.alunos);
    folhas.push({ aba: t.nome, titulo: tituloTurma(t.nome), sub: [`${al.length} aluno(s)`, t.info, `gerado em ${quando}`].filter(Boolean).join(" · "),
      cab: ["Nº", "Nome", "E-mail"], centro: [0],
      larguras: [6, largura(al.map(a => a.nome), 28, 50), largura(al.map(a => a.email || SEM_EMAIL), 30, 50)],
      linhas: al.map((a, i) => ({ v: [i + 1, a.nome || "", a.email || SEM_EMAIL], s: [6, 4, a.email ? 4 : 8], sz: [7, 5, a.email ? 5 : 9] })) });
  }
  const abas = nomesDeAba(folhas.map(f => f.aba));
  const arquivos = [
    { nome: "[Content_Types].xml", texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${folhas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
    { nome: "_rels/.rels", texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nome: "xl/workbook.xml", texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((a, i) => `<sheet name="${escXml(a)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames>${abas.map((a, i) => `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${escXml(a.replace(/'/g, "''"))}'!$4:$4</definedName>`).join("")}${folhas.map((f, i) => f.linhas.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${escXml(abas[i].replace(/'/g, "''"))}'!$A$4:$${col(f.cab.length - 1)}$${4 + f.linhas.length}</definedName>` : "").join("")}</definedNames></workbook>` },
    { nome: "xl/_rels/workbook.xml.rels", texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${folhas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${folhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nome: "xl/styles.xml", texto: ESTILOS },
    ...folhas.map((f, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, texto: folhaXml(f) })),
  ];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(zip(arquivos));
  a.download = `${nomeArquivo(turmas.length === 1 ? `turma_${turmas[0].nome}` : titulo)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ------------------------------------------------------------ PDF
const CSS_PDF = `@page{size:A4;margin:14mm 14mm 16mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#1a1d24;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pagina{page-break-after:always;break-after:page}.pagina:last-child{page-break-after:auto;break-after:auto}
.topo{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #c1272d;padding-bottom:8px;margin-bottom:12px}
.topo h1{font-size:18pt;margin:0;color:#1f2a44}.topo .marca{font-size:8.5pt;color:#c1272d;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px}
.topo .quando{font-size:8.5pt;color:#6b7280;text-align:right;white-space:nowrap}
.fichas{display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap}.ficha{border:1px solid #d0d5dd;border-radius:6px;padding:6px 12px;background:#f8f9fb}.ficha b{display:block;font-size:14pt;color:#1f2a44}.ficha span{font-size:8.5pt;color:#6b7280}
table{width:100%;border-collapse:collapse}thead{display:table-header-group}tr{page-break-inside:avoid;break-inside:avoid}
th{background:#c1272d;color:#fff;text-align:left;padding:7px 9px;font-size:9.5pt;text-transform:uppercase;letter-spacing:.04em}
td{padding:6px 9px;border-bottom:1px solid #e3e6eb;vertical-align:middle}tbody tr:nth-child(even) td{background:#f3f4f6}
td.n,th.n{width:38px;text-align:center}td.n{color:#6b7280}th{white-space:nowrap}td.num,th.num{text-align:center;width:110px}td.mail{font-family:Consolas,"Courier New",monospace;font-size:9.5pt}
td.falta{color:#8a8f99;font-style:italic;font-family:inherit}tfoot td{font-weight:bold;background:#e6e9ef;border-top:2px solid #1f2a44}
.rodape{margin-top:10px;font-size:8.5pt;color:#6b7280}`;
function topo(titulo, quando) { return `<div class="topo"><div><div class="marca">Lista de alunos</div><h1>${escHtml(titulo)}</h1></div><div class="quando">gerado em<br>${escHtml(quando)}</div></div>`; }

export function exportarPDF(turmas, titulo = "Turmas") {
  const quando = agora(), paginas = [];
  if (turmas.length > 1) {
    const tot = turmas.reduce((s, t) => s + t.alunos.length, 0), em = turmas.reduce((s, t) => s + t.alunos.filter(a => a.email).length, 0);
    paginas.push(`<section class="pagina">${topo(`${titulo} — resumo`, quando)}
      <div class="fichas"><div class="ficha"><b>${turmas.length}</b><span>turmas</span></div><div class="ficha"><b>${tot}</b><span>alunos</span></div><div class="ficha"><b>${em}</b><span>com e-mail</span></div>${tot - em ? `<div class="ficha"><b>${tot - em}</b><span>aguardando o 1º login</span></div>` : ""}</div>
      <table><thead><tr><th class="n">Nº</th><th>Turma</th><th class="num">Alunos</th><th class="num">Com e-mail</th><th>Informações</th></tr></thead><tbody>
      ${turmas.map((t, i) => `<tr><td class="n">${i + 1}</td><td><b>${escHtml(t.nome)}</b></td><td class="num">${t.alunos.length}</td><td class="num">${t.alunos.filter(a => a.email).length}</td><td>${escHtml(t.info || "")}</td></tr>`).join("")}
      </tbody><tfoot><tr><td></td><td>Total</td><td class="num">${tot}</td><td class="num">${em}</td><td></td></tr></tfoot></table>
      <p class="rodape">Cada turma vem a seguir, em página própria, com os alunos em ordem alfabética.</p></section>`);
  }
  for (const t of turmas) {
    const al = ordenar(t.alunos), em = al.filter(a => a.email).length;
    paginas.push(`<section class="pagina">${topo(tituloTurma(t.nome), quando)}
      <div class="fichas"><div class="ficha"><b>${al.length}</b><span>aluno(s)</span></div>${al.length - em ? `<div class="ficha"><b>${al.length - em}</b><span>aguardando o 1º login</span></div>` : ""}${t.info ? `<div class="ficha"><b style="font-size:10.5pt">${escHtml(t.info)}</b><span>informações</span></div>` : ""}</div>
      <table><thead><tr><th class="n">Nº</th><th>Nome</th><th>E-mail</th></tr></thead><tbody>
      ${al.map((a, i) => `<tr><td class="n">${i + 1}</td><td>${escHtml(a.nome || "—")}</td>${a.email ? `<td class="mail">${escHtml(a.email)}</td>` : `<td class="falta">${SEM_EMAIL}</td>`}</tr>`).join("") || `<tr><td colspan="3" class="falta">Nenhum aluno nesta turma.</td></tr>`}
      </tbody></table></section>`);
  }
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escHtml(turmas.length === 1 ? tituloTurma(turmas[0].nome) : titulo)}</title><style>${CSS_PDF}</style></head>
  <body>${paginas.join("")}<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
  w.document.close();
  return true;
}
