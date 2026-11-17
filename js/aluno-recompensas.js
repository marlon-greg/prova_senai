// Página do aluno → Perfil → "🎁 Recompensas que eu quero": o aluno escolhe 1 ou 2 recompensas que gostaria de ganhar
// (recompensas simples da sala e/ou skins do personagem ainda travadas para ele). Grava em desejos/{uid}:
// só o dono grava; a equipe lê. No painel (aba Gamificação) desenharResumoRecompensas mostra o que cada turma mais quer (só leitura).
// Na simulação da equipe (?simular=1) fica só no navegador.
import { db, esc, $, toast, confirmar, traduzirErro } from "./common.js";
import { CATALOGO, NOMES_PARTES, liberado, textoTrava } from "./avatar.js";
import { ic } from "./icones.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const MAX_RECOMPENSAS = 2;
// recompensas simples da sala (o professor decide se e quando dá; aqui é só o desejo do aluno)
export const RECOMPENSAS_SALA = [
  { id: "sala:lugar", e: "🪑", t: "Escolher onde sentar por um dia" },
  { id: "sala:musica", e: "🎵", t: "Escolher a música da aula prática" },
  { id: "sala:jogo", e: "🎮", t: "Escolher o jogo da revisão (quiz, forca, bingo)" },
  { id: "sala:tema", e: "💡", t: "Escolher o tema de um exercício" },
  { id: "sala:ordem", e: "🎤", t: "Escolher a ordem das apresentações" },
  { id: "sala:ajudante", e: "🔧", t: "Ser ajudante do professor no laboratório" },
  { id: "sala:mural", e: "📌", t: "Destaque no mural da sala" },
  { id: "sala:certificado", e: "📜", t: "Certificado de destaque da turma" },
  { id: "sala:elogio", e: "💌", t: "Elogio por escrito para a família" }
];
const ID_OK = /^(sala|skin):[\w:-]{1,60}$/;
const skinsTravadas = () => Object.entries(CATALOGO).flatMap(([parte, l]) => (l || []).filter(i => i.trava).map(i => ({ parte, item: i, id: `skin:${parte}:${i.id}` })));
// nome para mostrar (aluno e painel)
export function nomeRecompensa(id) {
  const s = RECOMPENSAS_SALA.find(r => r.id === id);
  if (s) return { e: s.e, t: s.t };
  const k = skinsTravadas().find(x => x.id === id);
  if (k) return { e: "🎨", t: `${k.item.nome} (${NOMES_PARTES[k.parte] || k.parte})` };
  return { e: "🎁", t: String(id || "").replace(/^skin:/, "Skin: ").replace(/^sala:/, "") };
}

async function minhaTurma(eu) {
  const s = await getDocs(query(collection(db, "turmas"), where("emails", "array-contains", String(eu.email || "").toLowerCase()))).catch(() => null);
  return s?.docs[0]?.id || null;
}
async function lerDesejos(eu, simulacao) {
  if (simulacao) { try { return JSON.parse(localStorage.getItem("sim:desejos") || "null")?.escolhas || []; } catch (e) { return []; } }
  return ((await getDoc(doc(db, "desejos", eu.uid)).catch(() => null))?.data()?.escolhas || []).filter(x => typeof x === "string");
}

// box = cartão na seção Perfil · cq = resultado de desenharConquistas (para saber as skins ainda travadas) · gami = config da gamificação
export async function desenharRecompensas(box, { eu, cq, gami, simulacao = false }) {
  if (!box) return;
  if (!gami.conquistas && !gami.personagem) { box.classList.add("oculto"); return; }
  const salvas = await lerDesejos(eu, simulacao);
  let escolha = [...salvas];
  const ganhas = cq?.ganhas || [];
  const skins = gami.personagem ? skinsTravadas().filter(x => !liberado(x.item, ganhas)) : [];
  const porParte = new Map(); skins.forEach(x => (porParte.get(x.parte) || porParte.set(x.parte, []).get(x.parte)).push(x));
  const botao = (id, e, t, dica = "") => `<button type="button" data-rec="${esc(id)}" aria-pressed="false"${dica ? ` title="${esc(dica)}"` : ""}><span aria-hidden="true">${e}</span> ${esc(t)}</button>`;
  const chipsSalvas = salvas.length
    ? `<div class="rec-escolhidas">${salvas.map(id => { const n = nomeRecompensa(id); return `<span class="tag"><span aria-hidden="true">${n.e}</span> ${esc(n.t)}</span>`; }).join("")}</div>`
    : `<p class="pequeno" style="margin:0">Você ainda não escolheu nenhuma.</p>`;
  box.classList.remove("oculto");
  box.innerHTML = `<h2>🎁 Recompensas que eu quero</h2>
    <p class="pequeno" style="margin-top:0">Escolha <b>1 ou 2</b> recompensas que você gostaria de ganhar. Os professores veem o que a turma mais quer e usam isso para planejar os prêmios.</p>
    ${simulacao ? `<p class="aviso-sim">🧪 Simulação: a escolha fica só neste navegador.</p>` : ""}
    <div class="rec-atual"><b class="pequeno">Minhas escolhas:</b> ${chipsSalvas}</div>
    <details class="recolhivel leve rec-menu"><summary><span class="rc-titulo">${salvas.length ? "Trocar as minhas escolhas" : "Escolher recompensas"}</span><span class="rc-resumo"><span class="chip" id="recConta">${escolha.length} de ${MAX_RECOMPENSAS}</span></span></summary>
      <div class="rc-corpo">
        <h3 class="rec-h3">🏫 Na sala de aula</h3>
        <div class="op-pilulas rec-op">${RECOMPENSAS_SALA.map(r => botao(r.id, r.e, r.t)).join("")}</div>
        ${skins.length ? `<h3 class="rec-h3">🎨 Skins do personagem que ainda estão travadas para você</h3>
          ${[...porParte].map(([parte, l]) => `<p class="pequeno rec-parte">${esc(NOMES_PARTES[parte] || parte)}</p><div class="op-pilulas rec-op">${l.map(x => botao(x.id, "🔒", x.item.nome, `${textoTrava(x.item.trava)} para liberar`)).join("")}</div>`).join("")}` : ""}
        <div class="linha acoes rec-acoes"><button type="button" id="recSalvar">Salvar minhas escolhas</button>${salvas.length ? `<button type="button" class="leve" id="recLimpar">Tirar as minhas escolhas</button>` : ""}</div>
      </div></details>`;
  const marcar = () => {
    box.querySelectorAll("[data-rec]").forEach(b => { const on = escolha.includes(b.dataset.rec); b.classList.toggle("sel", on); b.setAttribute("aria-pressed", on); });
    $("#recConta", box).textContent = `${escolha.length} de ${MAX_RECOMPENSAS}`;
  };
  marcar();
  box.querySelectorAll("[data-rec]").forEach(b => b.onclick = () => {
    const id = b.dataset.rec;
    if (escolha.includes(id)) escolha = escolha.filter(x => x !== id);
    else if (escolha.length >= MAX_RECOMPENSAS) return toast(`Você pode escolher até ${MAX_RECOMPENSAS}. Toque numa escolhida para tirar.`, "info");
    else escolha.push(id);
    marcar();
  });
  const redesenhar = () => desenharRecompensas(box, { eu, cq, gami, simulacao });
  $("#recSalvar", box).onclick = async () => {
    const lista = escolha.filter(id => ID_OK.test(id)).slice(0, MAX_RECOMPENSAS);
    if (!lista.length) return toast("Escolha pelo menos 1 recompensa.", "erro");
    if (salvas.length && (lista.length !== salvas.length || lista.some(x => !salvas.includes(x)))
      && !(await confirmar("Trocar as recompensas que você tinha escolhido pelas novas?", { titulo: "Trocar recompensas", ok: "Trocar" }))) return;
    try {
      if (simulacao) localStorage.setItem("sim:desejos", JSON.stringify({ escolhas: lista }));
      else await setDoc(doc(db, "desejos", eu.uid), { escolhas: lista, turmaId: await minhaTurma(eu), email: String(eu.email || "").toLowerCase(), atualizadoEm: serverTimestamp() });
    } catch (e) { return toast(traduzirErro(e), "erro"); }
    toast("Pronto! Suas recompensas foram salvas. 🎁", "ok"); redesenhar();
  };
  $("#recLimpar", box)?.addEventListener("click", async () => {
    if (!(await confirmar("Tirar as recompensas que você escolheu? Dá para escolher de novo quando quiser.", { titulo: "Tirar recompensas", ok: "Tirar", perigo: true }))) return;
    try { if (simulacao) localStorage.removeItem("sim:desejos"); else await deleteDoc(doc(db, "desejos", eu.uid)); }
    catch (e) { return toast(traduzirErro(e), "erro"); }
    toast("Escolhas retiradas.", "ok"); redesenhar();
  });
}

// ---------- painel (aba Gamificação): o que cada turma mais quer · só leitura ----------
export async function desenharResumoRecompensas(box) {
  if (!box) return;
  let desejos = [], turmas = new Map();
  try {
    const [d, t] = await Promise.all([getDocs(collection(db, "desejos")), getDocs(collection(db, "turmas")).catch(() => null)]);
    desejos = d.docs.map(x => x.data()).filter(x => Array.isArray(x.escolhas) && x.escolhas.length);
    t?.forEach(x => turmas.set(x.id, x.data().nome || x.id));
  } catch (e) { box.innerHTML = `<p class="pequeno erro-texto">Recompensas: ${esc(traduzirErro(e))} (publique o firestore.rules atual).</p>`; return; }
  const ranking = l => { const m = new Map(); l.forEach(x => x.escolhas.slice(0, MAX_RECOMPENSAS).forEach(id => m.set(id, (m.get(id) || 0) + 1))); return [...m].sort((a, b) => b[1] - a[1] || nomeRecompensa(a[0]).t.localeCompare(nomeRecompensa(b[0]).t, "pt-BR")); };
  const linhas = l => `<ol class="rec-ranking">${ranking(l).map(([id, n]) => { const r = nomeRecompensa(id); return `<li><span aria-hidden="true">${r.e}</span> ${esc(r.t)} <span class="chip navy">${n} aluno${n > 1 ? "s" : ""}</span></li>`; }).join("")}</ol>`;
  const porTurma = new Map(); desejos.forEach(x => { const k = x.turmaId || ""; (porTurma.get(k) || porTurma.set(k, []).get(k)).push(x); });
  const grupos = [...porTurma].sort((a, b) => String(turmas.get(a[0]) || a[0] || "~").localeCompare(String(turmas.get(b[0]) || b[0] || "~"), "pt-BR"));
  const top = ranking(desejos)[0];
  box.innerHTML = `<details class="card sem-padding bloco-linha"><summary class="sub-cab"><span class="ch ch-esq" aria-hidden="true">${ic("chev", { size: 18 })}</span><span class="sc-tile sc-navy" aria-hidden="true">${ic("gami", { size: 20 })}</span><span class="sc-texto"><span class="sc-titulo">🎁 Recompensas que os alunos querem</span>
      <span class="sc-resumo">${desejos.length ? `${desejos.length} aluno(s) escolheram · mais pedida: ${esc(nomeRecompensa(top[0]).t)}` : "nenhum aluno escolheu ainda"} · só leitura</span></span></summary>
    <div class="bloco-linha-corpo">
      <p class="pequeno" style="margin-top:0">Cada aluno escolhe 1 ou 2 no Perfil (recompensas da sala ou skins do personagem ainda travadas). Aqui aparece só a contagem, por turma.</p>
      ${desejos.length ? grupos.map(([k, l]) => `<h3 class="rec-h3">${esc(k ? turmas.get(k) || k : "Sem turma")} <span class="pequeno">· ${l.length} aluno(s)</span></h3>${linhas(l)}`).join("") : `<p class="pequeno">Quando os alunos escolherem, o resumo aparece aqui.</p>`}
    </div></details>`;
}
