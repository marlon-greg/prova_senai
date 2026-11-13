// Código comum (aluno + admin): Firebase, login, correção automática, utilidades.
import { ic } from "./icones.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut, onAuthStateChanged, connectAuthEmulator }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, writeBatch, deleteDoc }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { temFormato, corrigirFormato } from "../servidor/formatos.js";
import { firebaseConfig, SUPER_ADMIN, DOMINIOS_ALUNOS_PADRAO, USAR_EMULADOR, GOOGLE_CLIENT_ID } from "./firebase-config.js";

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

// Login pelo Google Identity Services (accounts.google.com + googleapis.com).
// Evita a janela do Firebase em *.firebaseapp.com, que o firewall do SENAI bloqueia.
let gisPronto = null;
function carregarGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPronto) gisPronto = new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => ok(); s.onerror = () => { gisPronto = null; falha(new Error("gis-indisponivel")); };
    document.head.appendChild(s);
  });
  return gisPronto;
}
if (GOOGLE_CLIENT_ID && !USAR_EMULADOR) carregarGIS().catch(() => {});   // já deixa pronto para o clique abrir a janela na hora

function tokenGoogle() {
  return new Promise((ok, falha) => {
    const cliente = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      prompt: "select_account",
      callback: r => r.error ? falha(Object.assign(new Error(r.error), { code: "gis/" + r.error })) : ok(r.access_token),
      error_callback: e => falha(Object.assign(new Error(e.type), { code: e.type === "popup_failed_to_open" ? "auth/popup-blocked" : "auth/popup-closed-by-user" })),
    });
    cliente.requestAccessToken();
  });
}

export function entrar() {
  if (!GOOGLE_CLIENT_ID || USAR_EMULADOR) return signInWithPopup(auth, provider);
  // GIS já carregado → chama requestAccessToken de forma síncrona dentro do clique do usuário.
  // Nunca usar await antes de abrir popup: qualquer await (mesmo Promise.resolve) pode anular
  // a "transient user activation" do browser e o popup é bloqueado silenciosamente.
  if (window.google?.accounts?.oauth2) {
    return tokenGoogle().then(token =>
      signInWithCredential(auth, GoogleAuthProvider.credential(null, token))
    );
  }
  // GIS ainda não carregou (rede lenta): fallback imediato para o popup do Firebase.
  return signInWithPopup(auth, provider);
}
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

// Devolve { pontos, status: 'certa' | 'errada' | 'revisar' | 'em_branco' | 'perdida' }
// perdida = true: questão perdida por sair da prova (limite de saídas) -> 0 pontos
export function corrigir(questao, gabarito, resposta, perdida = false) {
  if (perdida) return { pontos: 0, status: "perdida" };
  const peso = Number(questao.peso || 1);
  // questão adaptada em outro formato (V/F, ligar, lacunas…): gabarito privado da acessibilidade, com pontos parciais
  if (temFormato(questao)) return corrigirFormato(questao, gabarito, resposta, peso);
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

// Placar que o aluno vê: acertos (pontos cheios) de total, nota 0–100 e dissertativas ainda sem correção.
// itens = [{ pontos, peso, status }] (status de corrigir() ou da correção manual/IA)
// ACERTO = nota cheia ou MAIS DA METADE do peso (ex.: 1,5 de 2). Parcial até a metade não conta como acerto.
export const contaAcerto = x => x.status === "certa" || Number(x.pontos) > Number(x.peso || 1) / 2;
export function placar(itens) {
  const max = itens.reduce((s, x) => s + x.peso, 0), pts = itens.reduce((s, x) => s + x.pontos, 0);
  return { acertos: itens.filter(contaAcerto).length, totalQuestoes: itens.length,
           notaPrevia: max ? Math.round(pts / max * 1000) / 10 : 0, aguardandoCorrecao: itens.filter(x => x.status === "revisar").length };
}

// PDFs de consulta da prova (vários). Provas antigas têm um só, em materialConsultaArquivoId.
export function idsConsulta(p) {
  const a = Array.isArray(p?.materiaisConsultaIds) ? p.materiaisConsultaIds.filter(Boolean) : [];
  return a.length ? a : (p?.materialConsultaArquivoId ? [p.materialConsultaArquivoId] : []);
}

// ---------------- utilidades ----------------
// embaralha com semente (mesma semente = mesma ordem; usado para alternativas por aluno: semente = uid + qid)
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
  t.innerHTML = ic(tipo === "ok" ? "check" : tipo === "erro" ? "alert" : "info", { size: 18 }) + `<span>${esc(msg)}</span>`; t.className = "toast " + tipo; t.style.display = "inline-flex";
  clearTimeout(t._h); t._h = setTimeout(() => (t.style.display = "none"), 4000);
}
export function dataBR(ts) {
  const d = ts && ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
  return d ? d.toLocaleString("pt-BR") : "—";
}
export function letra(i) { return "ABCDEFGH"[i] || String(i + 1); }
// tema da questão; vazio ou ausente (bancos antigos) = "Geral"
export function temaDe(q) { return String(q?.tema ?? "").trim() || "Geral"; }
// ---------- vários bancos por prova ----------
// bancos da prova: bancoIds (novo) ou só bancoId (provas antigas)
export function bancosDaProva(p) {
  return Array.isArray(p?.bancoIds) && p.bancoIds.length ? p.bancoIds : (p?.bancoId ? [p.bancoId] : []);
}
// temas marcados de um banco na prova (Set) ou null = todos os temas
export function temasDoBanco(p, bancoId) {
  const l = p?.temasPorBanco?.[bancoId] ?? (bancoId === p?.bancoId ? p?.temas : null);
  return Array.isArray(l) && l.length ? new Set(l) : null;
}
// o id da questão já leva o banco: "<bancoId>_q001". Ids antigos/fora do padrão usam o banco da tentativa
export function bancoDaQuestao(qid, padrao) {
  const i = String(qid).lastIndexOf("_q");
  return i > 0 ? String(qid).slice(0, i) : padrao;
}
// questões que podem cair na prova (só temas marcados de cada banco): todas, alternativas e dissertativas
export async function questoesDisponiveis(prova) {
  const bancos = bancosDaProva(prova);
  const lotes = await Promise.all(bancos.map(b => getDocs(collection(db, "bancos", b, "questoes"))));
  const ids = [], diss = [], alt = [], tipo = {}, dados = {};
  lotes.forEach((qs, i) => {
    const temas = temasDoBanco(prova, bancos[i]);
    qs.forEach(d => {
      if (temas && !temas.has(temaDe(d.data()))) return;
      const t = d.data().tipo === "dissertativa" ? "dissertativa" : "alternativa";
      ids.push(d.id); (t === "dissertativa" ? diss : alt).push(d.id); tipo[d.id] = t; dados[d.id] = d.data();
    });
  });
  return { ids, alt, diss, tipo, dados };
}
// QUESTÕES IRMÃS: a mesma pergunta com outro enunciado (ou a mesma questão em dois bancos).
// Podem cair para pessoas diferentes, nunca duas na prova da mesma pessoa.
// São irmãs quando: têm o mesmo "grupo" (campo opcional no banco), as mesmas alternativas (em qualquer ordem,
// 3 de 4 já bastam) ou enunciados com a maioria das palavras em comum.
const PARADAS = new Set("que qual quais como para por com sem uma uns umas dos das nos nas num numa pelo pela pelos pelas sobre entre quando onde quem cujo isso este esta esse essa aquele aquela seu sua seus suas mais menos muito ser sao esta estao tem ter abaixo acima seguinte seguintes correta corretamente certo errado alternativa opcao assinale marque indique responda explique descreva cite exemplo voce".split(" "));
const normTexto = t => String(t ?? "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const palavrasDe = t => new Set(normTexto(t).split(" ").filter(p => p.length >= 3 && !PARADAS.has(p)));
function parecidos(a, b) {   // fração de itens em comum (sobre o maior conjunto)
  if (!a.size || !b.size) return 0;
  let n = 0; a.forEach(x => { if (b.has(x)) n++; });
  return n / Math.max(a.size, b.size);
}
// mesmo contexto no começo (ex.: "Contexto: a empresa X..."): compara só a pergunta, o que vem depois do trecho igual
function perguntasParecidas(a, b) {
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i >= 40) { const corte = a.lastIndexOf(" ", i); a = a.slice(corte + 1); b = b.slice(corte + 1); }
  const pa = palavrasDe(a), pb = palavrasDe(b);
  return pa.size >= 4 && pb.size >= 4 && parecidos(pa, pb) >= 0.6;
}
export function gruposDeIrmas(dados) {
  const ids = Object.keys(dados), pai = {}, raiz = x => pai[x] === x ? x : (pai[x] = raiz(pai[x]));
  const info = ids.map(id => {
    const q = dados[id] || {}; pai[id] = id;
    const alts = Array.isArray(q.alternativas) ? new Set(q.alternativas.map(normTexto).filter(Boolean)) : new Set();
    return { id, grupo: String(q.grupo || "").trim().toLowerCase(), alts, txt: normTexto(q.enunciado) };
  });
  for (let i = 0; i < info.length; i++) for (let j = i + 1; j < info.length; j++) {
    const a = info[i], b = info[j];
    const irmas = (a.grupo && a.grupo === b.grupo)
      || (a.txt && a.txt === b.txt)
      || (a.alts.size >= 3 && b.alts.size >= 3 && parecidos(a.alts, b.alts) >= 0.75)
      || perguntasParecidas(a.txt, b.txt);
    if (irmas) pai[raiz(a.id)] = raiz(b.id);
  }
  const g = {}; ids.forEach(id => g[id] = raiz(id));
  return g;   // id -> id do grupo
}
// cota padrão da prova: quantas alternativas e dissertativas cada aluno recebe
export function cotaDaProva(p) {
  const nD = Number(p.nDissertativas || 0);
  return { nA: p.nAlternativas !== undefined && p.nAlternativas !== null ? Number(p.nAlternativas || 0) : Math.max(0, Number(p.nQuestoes || 0) - nD), nD };
}
// sorteia as questões da prova (ids), igual para todo aluno: só temas marcados, respeitando a cota de tipos.
// cota = { nA, nD } opcional (acessibilidade: o professor escolhe quantas de cada tipo).
export async function sortearQuestoes(prova, cota = null) {
  const { ids, alt, diss, dados } = await questoesDisponiveis(prova);
  // no máximo uma questão de cada grupo de irmãs; se o banco não tiver grupos suficientes, completa com as que sobraram
  // (a prova nunca deixa de abrir por causa deste filtro)
  let grupo = {};
  try { grupo = gruposDeIrmas(dados); } catch (e) { console.warn("grupos de questões irmãs", e); }
  const usados = new Set();
  const pegar = (lista, n) => {
    const ordem = sortearAleatorio(lista, lista.length), sai = [], resto = [];
    for (const id of ordem) {
      const g = grupo[id] || id;
      if (sai.length < n && !usados.has(g)) { usados.add(g); sai.push(id); } else resto.push(id);
    }
    while (sai.length < n && resto.length) sai.push(resto.shift());
    return sai;
  };
  if (cota) {
    if (cota.nA + cota.nD < 1) throw new Error("Escolha pelo menos 1 questão.");
    if (diss.length < cota.nD || alt.length < cota.nA) throw new Error(`Não há questões suficientes: ${alt.length} alternativas e ${diss.length} dissertativas disponíveis nos temas da prova.`);
    return sortearAleatorio([...pegar(diss, cota.nD), ...pegar(alt, cota.nA)], cota.nA + cota.nD);
  }
  if (ids.length < prova.nQuestoes) throw new Error("O banco não tem questões suficientes nos temas escolhidos. Avise o professor.");
  const nD = Number(prova.nDissertativas || 0);
  if (prova.nAlternativas !== undefined && prova.nAlternativas !== null) {
    // cota fixa: exatamente nAlternativas alternativas + nDissertativas dissertativas
    const nA = Number(prova.nAlternativas || 0);
    if (diss.length < nD || alt.length < nA) throw new Error("O banco não tem questões suficientes de cada tipo nos temas escolhidos. Avise o professor.");
    return sortearAleatorio([...pegar(diss, nD), ...pegar(alt, nA)], nA + nD);
  }
  if (nD > 0 && diss.length >= nD && alt.length >= prova.nQuestoes - nD)
    return sortearAleatorio([...pegar(diss, nD), ...pegar(alt, prova.nQuestoes - nD)], prova.nQuestoes);
  return pegar(ids, prova.nQuestoes);
}
export function ordenarTemas(lista) { return [...new Set(lista)].sort((a, b) => a.localeCompare(b, "pt-BR")); }
// chave do nome completo para vincular aluno cadastrado só pelo nome (IGUAL à chaveNome do firestore.rules):
// minúsculas, sem acento, só letras, palavras separadas por "_"  ("José  da Silva" -> "jose_da_silva")
export function chaveNome(nome) {
  return String(nome || "").toLowerCase().replace(/\p{M}+/gu, "")
    .replace(/[áàâãäÁÀÂÃÄ]/g, "a").replace(/[éèêëÉÈÊË]/g, "e").replace(/[íìîïÍÌÎÏ]/g, "i")
    .replace(/[óòôõöÓÒÔÕÖ]/g, "o").replace(/[úùûüÚÙÛÜ]/g, "u").replace(/[çÇ]/g, "c").replace(/[ñÑ]/g, "n")
    .replace(/[^a-z]+/g, " ").trim().replace(/ /g, "_");
}
// iniciais para o avatar do cabeçalho ("Maria da Silva" -> "MS")
export function iniciais(nome) {
  const p = String(nome || "?").replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((p[0]?.[0] || "?") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

// ---------------- erros em português ----------------
const ERROS = {
  "auth/popup-blocked": "O navegador bloqueou a janela de login. Libere pop-ups para este site (ícone na barra de endereço) e clique em Entrar de novo.",
  "auth/popup-closed-by-user": "A janela de login foi fechada antes de terminar. Clique em Entrar de novo.",
  "auth/cancelled-popup-request": "A janela de login foi fechada antes de terminar. Clique em Entrar de novo.",
  "auth/unauthorized-domain": "Este endereço do site não está autorizado no Firebase. Avise o professor (Authentication → Settings → Authorized domains).",
  "auth/network-request-failed": "Sem conexão com o servidor de login. Verifique a rede e tente de novo (se a rede da escola bloquear, avise o professor).",
  "permission-denied": "Sem permissão para esta ação. Confira se entrou com a conta certa e se a prova está liberada; se continuar, avise o professor.",
  "unavailable": "Sem conexão com o servidor. Verifique a internet e tente de novo.",
  "deadline-exceeded": "O servidor demorou demais para responder. Verifique a internet e tente de novo.",
  "failed-precondition": "O banco de dados recusou a operação neste momento. Recarregue a página e tente de novo; se continuar, avise o professor.",
  "not-found": "O registro não foi encontrado. Recarregue a página."
};
export function traduzirErro(e) {
  const c = String(e?.code || "").replace(/^firestore\//, "");
  return ERROS[c] || e?.message || String(e);
}

// ---------------- modal (substitui confirm/alert nativos) ----------------
const modaisAbertos = new Set();
// Devolve uma Promise<boolean>: true = OK/confirmar, false = cancelar/Esc/clique fora.
// Formulário: passe `conteudo` (HTML confiável, montado pelo próprio sistema) no lugar de `mensagem`;
// `aoAbrir(caixa)` liga os campos e `antesDeConfirmar(caixa)` valida (devolva false para manter aberto).
export function modal({ titulo = "", mensagem = "", conteudo = null, ok = "OK", cancelar = null, perigo = false, largo = false,
                        aoAbrir = null, antesDeConfirmar = null } = {}) {
  return new Promise(resolve => {
    const fundo = document.createElement("div");
    fundo.className = "modal-fundo";
    fundo.innerHTML = `<div class="modal${largo ? " largo" : ""}" role="dialog" aria-modal="true" ${titulo ? 'aria-labelledby="modalTitulo"' : ""}>
      ${titulo ? `<h2 id="modalTitulo">${esc(titulo)}</h2>` : ""}
      ${conteudo !== null ? `<div class="modal-corpo">${conteudo}</div>` : `<p class="modal-msg">${esc(mensagem)}</p>`}
      <div class="modal-acoes">${cancelar ? `<button type="button" class="leve" data-r="0">${esc(cancelar)}</button>` : ""}
        <button type="button" class="${perigo ? "perigo" : ""}" data-r="1">${esc(ok)}</button></div></div>`;
    const caixa = fundo.querySelector(".modal"), anterior = document.activeElement;
    const focaveis = () => [...fundo.querySelectorAll("button, input, select, textarea, a[href]")].filter(el => !el.disabled && el.offsetParent !== null);
    const noTopo = () => [...document.querySelectorAll(".modal-fundo")].pop() === fundo;   // modal sobre modal: só o de cima responde
    const tecla = e => {
      if (!noTopo()) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(!cancelar); }
      if (e.key === "Tab") {   // mantém o foco dentro do modal
        const fs = focaveis(), i = fs.indexOf(document.activeElement);
        e.preventDefault(); fs[(i + (e.shiftKey ? -1 : 1) + fs.length) % fs.length]?.focus();
      }
    };
    const fechar = r => {
      if (!modaisAbertos.has(fechar)) return;
      modaisAbertos.delete(fechar); fundo.remove(); document.removeEventListener("keydown", tecla, true);
      anterior?.focus?.(); resolve(r);
    };
    modaisAbertos.add(fechar);
    // clique fora fecha só os avisos simples (num formulário perderia o que foi digitado)
    fundo.addEventListener("mousedown", e => { if (e.target === fundo && cancelar && conteudo === null) fechar(false); });
    fundo.querySelector("[data-r='0']")?.addEventListener("click", () => fechar(false));
    const btnOk = fundo.querySelector("[data-r='1']");
    btnOk.onclick = async () => {
      if (antesDeConfirmar) {
        btnOk.disabled = true;
        try { if ((await antesDeConfirmar(caixa)) === false) return; }
        finally { btnOk.disabled = false; }
      }
      fechar(true);
    };
    document.addEventListener("keydown", tecla, true);
    document.body.appendChild(fundo);
    if (aoAbrir) aoAbrir(caixa);
    (conteudo !== null ? focaveis()[0] : btnOk)?.focus();
  });
}
export const confirmar = (mensagem, opc = {}) => modal({ titulo: "Confirmar", mensagem, ok: "Confirmar", cancelar: "Cancelar", ...opc });
export const avisar = (mensagem, opc = {}) => modal({ titulo: "Aviso", mensagem, ...opc });
// fecha todos os modais abertos como "cancelar" (ex.: tempo da prova acabou)
export function fecharModais() { [...modaisAbertos].forEach(f => f(false)); }

// ---------- organização: turma → semestre → matéria → tópicos ----------
// semestre = "2026-1" (jan–jun) ou "2026-2" (jul–dez). d = Date, Timestamp do Firestore ou "AAAA-MM-DD"
export function semestreDe(d = new Date()) {
  const x = d?.toDate ? d.toDate() : typeof d === "string" ? new Date(d + "T12:00:00") : d instanceof Date ? d : new Date();
  const dt = isNaN(x) ? new Date() : x;
  return `${dt.getFullYear()}-${dt.getMonth() < 6 ? 1 : 2}`;
}
export const rotuloSemestre = s => /^\d{4}-[12]$/.test(String(s || "")) ? `${s.slice(0, 4)}/${s.slice(5)}º sem.` : (s || "sem semestre");
// ---------- semestre do CURSO da turma (1º ao 4º) ----------
// Período letivo: 1º = janeiro a julho (julho é férias, ainda conta o 1º), 2º = agosto a dezembro.
// A turma guarda o semestre do curso escolhido no cadastro (semestreCurso) e o período em que foi escolhido
// (semestreCursoRef). O semestre atual é calculado: avança SOZINHO em 1º de agosto e em 1º de janeiro.
export const SEMESTRES_CURSO = 4;
export function periodoLetivo(d = new Date()) { return `${d.getFullYear()}-${d.getMonth() <= 6 ? 1 : 2}`; }
const indicePeriodo = p => { const [a, n] = String(p || "").split("-").map(Number); return a * 2 + (n - 1); };
// devolve { n, concluida, rotulo } ou null (turma sem semestre informado)
export function semestreCursoAtual(t, hoje = new Date()) {
  const base = Number(t?.semestreCurso);
  if (!base) return null;
  const ref = /^\d{4}-[12]$/.test(t.semestreCursoRef || "") ? t.semestreCursoRef : periodoLetivo(hoje);
  const n = base + Math.max(0, indicePeriodo(periodoLetivo(hoje)) - indicePeriodo(ref));
  return { n, concluida: n > SEMESTRES_CURSO, rotulo: n > SEMESTRES_CURSO ? "Curso concluído" : `${n}º semestre` };
}
// semestres em volta de um semestre: deslocamento -1 = o anterior, +1 = o próximo
export function semestreVizinho(s, desloc) {
  let [a, n] = String(s || semestreDe()).split("-").map(Number);
  let i = a * 2 + (n - 1) + desloc;
  return `${Math.floor(i / 2)}-${(i % 2) + 1}`;
}
// texto para comparar nomes de matéria/tópico: sem acento, minúsculo, espaços simples
export const chaveTexto = s => String(s || "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
// semestre da prova: o gravado; senão o da data da prova; senão o da criação
export const semestreDaProva = p => p?.semestre || semestreDe(p?.dataProva || p?.criadoEm || new Date());
// matéria da prova: a gravada; senão a do 1º banco
export function materiaDaProva(p, bancos = []) {
  if (String(p?.materia || "").trim()) return String(p.materia).trim();
  const b = bancos.find(x => x.id === bancosDaProva(p)[0]);
  return String(b?.materia || "").trim();
}
// "AAAA-MM-DD" -> "dd/mm/aaaa"
export const dataCurta = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "";

// ---------- dias de aula e horário das turmas ----------
export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const DIAS_SEMANA_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
// [1, 3] -> "seg/qua"
export const rotuloDias = l => Array.isArray(l) && l.length ? [...l].map(Number).sort().map(d => DIAS_SEMANA[d]).join("/") : "";
// "DETS-1A · seg/qua"
export const nomeTurma = t => t ? `${t.nome || ""}${rotuloDias(t.diasAula) ? ` · ${rotuloDias(t.diasAula)}` : ""}` : "";
// o dia (AAAA-MM-DD) é dia de aula de alguma das turmas? Turma sem dias cadastrados = segunda a sexta
export function diaDeAula(turmas, iso) {
  const dw = new Date(iso + "T12:00:00").getDay();
  const dias = turmas.flatMap(t => Array.isArray(t.diasAula) && t.diasAula.length ? t.diasAula.map(Number) : [1, 2, 3, 4, 5]);
  return (dias.length ? dias : [1, 2, 3, 4, 5]).includes(dw);
}
// horário padrão de todas as turmas (config/geral.horario muda)
export const HORARIO_PADRAO = { inicio: "07:00", fim: "16:00", intervalos: [
  { nome: "Café da manhã", inicio: "09:10", fim: "09:25" }, { nome: "Almoço", inicio: "11:00", fim: "12:00" }, { nome: "Café da tarde", inicio: "14:50", fim: "15:05" }] };
export const textoHorario = h => { const x = h?.inicio ? h : HORARIO_PADRAO; return `${x.inicio}–${x.fim}` + (x.intervalos || []).map(i => ` · ${i.nome} ${i.inicio}–${i.fim}`).join(""); };

// ---------- gamificação: o que está ligado (config/gamificacao; só admin muda) ----------
export const GAMI_PADRAO = { conquistas: true, personagem: true, apontamentos: true, sugestoes: true, download: true,
  social: false, socialNotas: false };
export async function lerGamificacao() {
  const d = await getDoc(doc(db, "config", "gamificacao")).catch(() => null);
  return { ...GAMI_PADRAO, ...(d?.exists() ? d.data() : {}) };
}
