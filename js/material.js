// Material de consulta enviado como arquivo (PDF): guardado no próprio Firestore, em pedaços,
// para funcionar no plano gratuito do Firebase (o Storage exige plano pago).
// materiais/{id}            -> { titulo, arquivo, tamanho, nPartes, tipo: "pdf", criadoEm, criadoPor }  (até 20 MB)
// materiais/{id}/partes/{n} -> { i, dados: Bytes }   (n = "000", "001", ...; 900 KB cada, gravados com writeBatch)
import { db } from "./common.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, writeBatch, query, orderBy, Bytes, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const PARTE = 900 * 1024;     // cada documento do Firestore aceita até 1 MiB
export const MAX_MB = 20;
const LOTE_PARTES = 20, LOTE_BYTES = 4 * 1024 * 1024;   // writeBatch: até 20 pedaços e ~4 MB por envio (o SDK manda em base64, +33%; o limite do pedido é 10 MiB)

const idParte = i => String(i).padStart(3, "0");

// Confere se é PDF de verdade (assinatura "%PDF-" no começo do arquivo)
async function ehPdf(file) {
  const ini = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...ini) === "%PDF-";
}

// base = caminho da coleção (padrão "materiais"; laudos: "acessibilidadePrivado/<email>/laudos")
const col = base => base.split("/");
// Envia o arquivo. progresso(enviadas, total) é chamado a cada pedaço. Devolve { id, ...dados }.
export async function enviarMaterial(file, titulo, email, progresso = () => {}, base = "materiais") {
  if (!file) throw new Error("Escolha um arquivo.");
  if (!(await ehPdf(file)))
    throw new Error("O arquivo não é PDF. No PowerPoint: Arquivo → Exportar → PDF. No Google Slides: Arquivo → Fazer download → PDF.");
  if (file.size > MAX_MB * 1024 * 1024)
    throw new Error(`O PDF tem ${(file.size / 1048576).toFixed(1)} MB; o limite é ${MAX_MB} MB. Exporte com qualidade menor (PowerPoint: Arquivo → Exportar → PDF → "Tamanho mínimo") ou divida o arquivo.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ref = doc(collection(db, ...col(base)));
  const n = Math.ceil(bytes.length / PARTE);
  progresso(0, n);
  try {
    let lote = writeBatch(db), noLote = 0, bytesLote = 0;
    for (let i = 0; i < n; i++) {
      const pedaco = bytes.subarray(i * PARTE, (i + 1) * PARTE);
      if (noLote && (noLote >= LOTE_PARTES || bytesLote + pedaco.length > LOTE_BYTES)) {
        await lote.commit(); progresso(i, n);
        lote = writeBatch(db); noLote = 0; bytesLote = 0;
      }
      lote.set(doc(db, ...col(base), ref.id, "partes", idParte(i)), { i, dados: Bytes.fromUint8Array(pedaco) });
      noLote++; bytesLote += pedaco.length;
    }
    await lote.commit(); progresso(n, n);
  } catch (e) {
    // envio interrompido: tenta apagar os pedaços já gravados (sem o documento principal ele não aparece na lista)
    getDocs(collection(db, ...col(base), ref.id, "partes")).then(s => Promise.all(s.docs.map(d => deleteDoc(d.ref)))).catch(() => {});
    throw e;
  }
  // o documento principal só é gravado no fim: envio interrompido não aparece na lista
  const dados = { titulo: String(titulo || "").trim() || file.name.replace(/\.pdf$/i, ""), arquivo: file.name, tamanho: bytes.length, nPartes: n, tipo: "pdf",
                  criadoEm: serverTimestamp(), criadoPor: email };
  await setDoc(ref, dados);
  return { id: ref.id, ...dados };
}

// Baixa e remonta o arquivo. Devolve { meta, bytes: Uint8Array }.
const cache = new Map();
export async function baixarMaterial(id, base = "materiais") {
  const chave = base + "/" + id;
  if (cache.has(chave)) return cache.get(chave);
  const p = (async () => {
    const m = await getDoc(doc(db, ...col(base), id));
    if (!m.exists()) throw new Error("O material foi apagado. Avise o professor.");
    const meta = m.data();
    const partes = await getDocs(query(collection(db, ...col(base), id, "partes"), orderBy("i")));
    if (partes.size !== meta.nPartes) throw new Error("O material está incompleto. Avise o professor para enviar de novo.");
    const bytes = new Uint8Array(meta.tamanho);
    let pos = 0;
    partes.forEach(d => { const b = d.data().dados.toUint8Array(); bytes.set(b, pos); pos += b.length; });
    return { meta, bytes };
  })();
  cache.set(chave, p);
  p.catch(() => cache.delete(chave));   // erro: tenta de novo na próxima
  return p;
}

export async function listarMateriais(base = "materiais") {
  const s = await getDocs(collection(db, ...col(base)));
  return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
}

export async function apagarMaterial(id, base = "materiais") {
  const partes = await getDocs(collection(db, ...col(base), id, "partes"));
  let lote = writeBatch(db), n = 0;
  for (const d of partes.docs) {   // lotes pequenos: cada pedaço pesa ~900 KB
    lote.delete(d.ref);
    if (++n % 50 === 0) { await lote.commit(); lote = writeBatch(db); }
  }
  await lote.commit();
  await deleteDoc(doc(db, ...col(base), id));
  cache.delete(base + "/" + id);
}

export const tamanhoTexto = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

// mensagem específica quando as regras publicadas não cobrem a coleção materiais
export function erroMaterial(e, traduzir) {
  return String(e?.code || "").endsWith("permission-denied")
    ? "As regras do Firestore não permitem gravar materiais. Publique a versão atual do firestore.rules no Firebase Console."
    : traduzir(e);
}
// abre o PDF numa aba nova (a aba é aberta já no clique, para o navegador não bloquear)
export async function abrirMaterialEmAba(id, traduzir, base = "materiais") {
  const w = window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site.");
  w.document.write("<p style='font-family:sans-serif'>Carregando o PDF…</p>");
  try {
    const { bytes } = await baixarMaterial(id, base);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    w.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (e) { w.document.body.innerHTML = `<p style='font-family:sans-serif'>Não foi possível abrir o PDF. ${String(traduzir(e)).replace(/</g, "&lt;")}</p>`; }
}
