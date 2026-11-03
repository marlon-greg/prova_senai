// Código comum (aluno + admin): Firebase, login, correção automática, utilidades.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, connectAuthEmulator }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, writeBatch, deleteDoc }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, SUPER_ADMIN, DOMINIOS_ALUNOS_PADRAO, USAR_EMULADOR } from "./firebase-config.js";

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export { SUPER_ADMIN };

if (USAR_EMULADOR) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

// ---------------- login ----------------
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export function entrar() { return signInWithPopup(auth, provider); }
export function sair()   { return signOut(auth); }
export function aoMudarLogin(cb) { return onAuthStateChanged(auth, cb); }

// Descobre quem é o usuário: superadmin / membro da equipe (papel) / aluno (domínio permitido) / bloqueado
export async function identificar(user) {
  const email = (user.email || "").toLowerCase();
  if (email === SUPER_ADMIN.toLowerCase()) return { tipo: "equipe", papel: "admin", email, nome: user.displayName || email };
  const eq = await getDoc(doc(db, "equipe", email)).catch(() => null);
  if (eq && eq.exists()) return { tipo: "equipe", papel: eq.data().papel || "auxiliar", email, nome: user.displayName || email };
  let dominios = DOMINIOS_ALUNOS_PADRAO;
  const cfg = await getDoc(doc(db, "config", "geral")).catch(() => null);
  if (cfg && cfg.exists() && Array.isArray(cfg.data().dominiosAlunos)) dominios = cfg.data().dominiosAlunos;
  const dom = email.split("@")[1] || "";
  if (dominios.includes(dom)) return { tipo: "aluno", email, nome: user.displayName || email };
  return { tipo: "bloqueado", email, dominios };
}

// ---------------- modo teste (equipe) ----------------
// id da tentativa de teste de um membro da equipe para uma prova
export function idTentativaTeste(uid, provaId) { return `teste_${uid}_${provaId}`; }

// Apaga a tentativa de teste (respostas + correções + documento). Devolve false se não existia.
export async function apagarTentativaTeste(uid, provaId) {
  const tid = idTentativaTeste(uid, provaId), ref = doc(db, "tentativas", tid);
  const t = await getDoc(ref);
  if (!t.exists()) return false;
  // subcoleções primeiro (as regras consultam a tentativa para autorizar), depois o documento
  const lote = writeBatch(db);
  for (const sub of ["respostas", "correcoes"])
    (await getDocs(collection(db, "tentativas", tid, sub))).forEach(d => lote.delete(d.ref));
  await lote.commit();
  await deleteDoc(ref);
  return true;
}

// ---------------- correção automática ----------------
// Normaliza um comando/texto: minúsculas, espaços únicos, sem espaço perto de ( ) , = ; e sem ; final
export function normalizar(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),=;<>])\s*/g, "$1")
    .replace(/;+$/g, "")
    .trim();
}

// Devolve { pontos, status: 'certa' | 'errada' | 'revisar' | 'em_branco' }
export function corrigir(questao, gabarito, resposta) {
  const peso = Number(questao.peso || 1);
  if (resposta === undefined || resposta === null || resposta === "") return { pontos: 0, status: "em_branco" };
  if (questao.tipo === "alternativa") {
    const ok = Number(resposta) === Number(gabarito.correta);
    return { pontos: ok ? peso : 0, status: ok ? "certa" : "errada" };
  }
  // dissertativa
  const r = normalizar(resposta);
  const aceitas = (gabarito.respostasAceitas || []).map(normalizar);
  if (aceitas.includes(r)) return { pontos: peso, status: "certa" };
  const chaves = (gabarito.palavrasChave || []).map(normalizar).filter(Boolean);
  if (chaves.length && chaves.every(k => r.includes(k))) return { pontos: peso, status: "certa" };
  return { pontos: 0, status: "revisar" };   // o professor confirma/ajusta na correção manual
}

// ---------------- utilidades ----------------
// embaralha com semente (mesma semente = mesma ordem; usado para alternativas por aluno)
export function embaralhar(lista, semente) {
  let h = 2166136261;
  for (const c of String(semente)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function sortearAleatorio(lista, n) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
export function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
export function $(sel, root = document) { return root.querySelector(sel); }
export function toast(msg, tipo = "info") {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.className = "toast " + tipo; t.style.display = "block";
  clearTimeout(t._h); t._h = setTimeout(() => (t.style.display = "none"), 4000);
}
export function dataBR(ts) {
  const d = ts && ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
  return d ? d.toLocaleString("pt-BR") : "—";
}
export function letra(i) { return "ABCDEFGH"[i] || String(i + 1); }
