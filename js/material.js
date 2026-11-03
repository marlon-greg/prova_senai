// Material de consulta enviado como arquivo (PDF): guardado no próprio Firestore, em pedaços,
// para funcionar no plano gratuito do Firebase (o Storage exige plano pago).
// materiais/{id}            -> { titulo, arquivo, tamanho, nPartes, tipo: "pdf", criadoEm, criadoPor }
// materiais/{id}/partes/{n} -> { i, dados: Bytes }   (n = "000", "001", ...)
import { db } from "./common.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, writeBatch, query, orderBy, Bytes, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const PARTE = 900 * 1024;     // cada documento do Firestore aceita até 1 MiB
export const MAX_MB = 25;

const idParte = i => String(i).padStart(3, "0");

// Confere se é PDF de verdade (assinatura "%PDF-" no começo do arquivo)
async function ehPdf(file) {
  const ini = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...ini) === "%PDF-";
}

// Envia o arquivo. progresso(enviadas, total) é chamado a cada pedaço. Devolve { id, ...dados }.
export async function enviarMaterial(file, titulo, email, progresso = () => {}) {
  if (!file) throw new Error("Escolha um arquivo.");
  if (!(await ehPdf(file)))
    throw new Error("O arquivo não é PDF. No PowerPoint: Arquivo → Exportar → PDF. No Google Slides: Arquivo → Fazer download → PDF.");
  if (file.size > MAX_MB * 1024 * 1024)
    throw new Error(`O PDF tem ${(file.size / 1048576).toFixed(1)} MB; o limite é ${MAX_MB} MB. Exporte com qualidade menor (PowerPoint: Arquivo → Exportar → PDF → "Tamanho mínimo") ou divida o arquivo.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ref = doc(collection(db, "materiais"));
  const n = Math.ceil(bytes.length / PARTE);
  for (let i = 0; i < n; i++) {
    await setDoc(doc(db, "materiais", ref.id, "partes", idParte(i)), { i, dados: Bytes.fromUint8Array(bytes.subarray(i * PARTE, (i + 1) * PARTE)) });
    progresso(i + 1, n);
  }
  // o documento principal só é gravado no fim: envio interrompido não aparece na lista
  const dados = { titulo: String(titulo || "").trim() || file.name.replace(/\.pdf$/i, ""), arquivo: file.name, tamanho: bytes.length, nPartes: n, tipo: "pdf",
                  criadoEm: serverTimestamp(), criadoPor: email };
  await setDoc(ref, dados);
  return { id: ref.id, ...dados };
}

// Baixa e remonta o arquivo. Devolve { meta, bytes: Uint8Array }.
const cache = new Map();
export async function baixarMaterial(id) {
  if (cache.has(id)) return cache.get(id);
  const p = (async () => {
    const m = await getDoc(doc(db, "materiais", id));
    if (!m.exists()) throw new Error("O material foi apagado. Avise o professor.");
    const meta = m.data();
    const partes = await getDocs(query(collection(db, "materiais", id, "partes"), orderBy("i")));
    if (partes.size !== meta.nPartes) throw new Error("O material está incompleto. Avise o professor para enviar de novo.");
    const bytes = new Uint8Array(meta.tamanho);
    let pos = 0;
    partes.forEach(d => { const b = d.data().dados.toUint8Array(); bytes.set(b, pos); pos += b.length; });
    return { meta, bytes };
  })();
  cache.set(id, p);
  p.catch(() => cache.delete(id));   // erro: tenta de novo na próxima
  return p;
}

export async function listarMateriais() {
  const s = await getDocs(collection(db, "materiais"));
  return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
}

export async function apagarMaterial(id) {
  const partes = await getDocs(collection(db, "materiais", id, "partes"));
  let lote = writeBatch(db), n = 0;
  for (const d of partes.docs) {   // lotes pequenos: cada pedaço pesa ~900 KB
    lote.delete(d.ref);
    if (++n % 50 === 0) { await lote.commit(); lote = writeBatch(db); }
  }
  await lote.commit();
  await deleteDoc(doc(db, "materiais", id));
  cache.delete(id);
}

export const tamanhoTexto = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
