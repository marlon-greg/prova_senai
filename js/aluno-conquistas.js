// Página do aluno → "🏅 Minhas conquistas": gerais (todas as matérias), por matéria e, para quem tem
// acessibilidade, as do diário da sala (resumo positivo gravado pela auxiliar). Regras em js/conquistas.js.
import { db, esc, $, modal } from "./common.js";
import { conquistasNotas, medalhasDiario } from "./conquistas.js";
import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const nota = t => Number.isFinite(Number(t.nota)) && t.nota !== null ? Number(t.nota) : (t.notaPrevia !== null && t.notaPrevia !== undefined && Number.isFinite(Number(t.notaPrevia)) ? Number(t.notaPrevia) : null);

// eu = { uid, email, nome }; resumoDiario = acessibilidade.diarioResumo (ou null)
// opc = { provas (lista pronta, simulação), forcar (Set de títulos dados na simulação), simulacao }
// devolve { ganhas, todas, nivel, provas } para o cartão do perfil
export async function desenharConquistas(box, eu, resumoDiario = null, opc = {}) {
  const visivel = !!box;
  box = box || document.createElement("div");   // conquistas desligadas: calcula (para as skins) sem mostrar
  let provas = opc.provas || [];
  if (!opc.provas) try {
    const ts = (await getDocs(query(collection(db, "tentativas"), where("uid", "==", eu.uid)))).docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.teste !== true && t.finalizadaEm && nota(t) !== null);
    const bancos = {}, cacheProva = {};
    const lerProva = async id => cacheProva[id] ??= (await getDoc(doc(db, "provas", id)).catch(() => null))?.data() || null;
    const lerBanco = async id => bancos[id] ??= (await getDoc(doc(db, "bancos", id)).catch(() => null))?.data() || null;
    provas = await Promise.all(ts.map(async t => {
      const p = await lerProva(t.provaId), b = t.bancoId ? await lerBanco(t.bancoId) : null;
      return { id: t.provaId, titulo: p?.titulo || "Prova", materia: String(p?.materia || b?.materia || "").trim(), nota: nota(t),
        data: (t.finalizadaEm?.seconds || 0) * 1000, vidasPerdidas: Number(t.trocasDeAba || 0) + Number(t.trocasDeAbaTotal || 0) };
    }));
  } catch (e) { console.warn("conquistas", e); }
  const c = conquistasNotas(provas);
  const diario = resumoDiario ? medalhasDiario(resumoDiario) : [];
  if (opc.forcar?.size) [...c.gerais, ...c.materias.flatMap(m => m.conquistas), ...diario].forEach(m => { if (opc.forcar.has(m.t)) m.ok = true; });
  const todas = [...c.gerais, ...c.materias.flatMap(m => m.conquistas), ...diario];
  const ganhas = todas.filter(m => m.ok);
  // medalha nova desde a última visita: comemora
  const chave = `conquistas:${opc.simulacao ? "sim:" : ""}${eu.uid}`, vistas = new Set(JSON.parse(localStorage.getItem(chave) || "[]"));
  const novas = ganhas.filter(m => !vistas.has(m.t));
  localStorage.setItem(chave, JSON.stringify(ganhas.map(m => m.t)));
  const nivel = Math.floor(ganhas.length / 3) + 1, prox = 3 - (ganhas.length % 3);
  const medalha = (m, i) => `<button type="button" class="medalha medalha-aluno${m.ok ? " ganha" : ""}${novas.includes(m) ? " nova" : ""}" data-m="${i}" title="${esc(m.d)}">
      <span class="m-emoji">${m.e}</span><b>${esc(m.t)}</b><span class="pequeno">${m.ok ? "conquistada!" : m.prog ? `${m.prog[0]}/${m.prog[1]}` : esc(m.d)}</span>
      ${!m.ok && m.prog ? `<i class="m-barra"><i style="width:${Math.round(m.prog[0] / m.prog[1] * 100)}%"></i></i>` : ""}</button>`;
  let idx = 0; const lista = [];
  const bloco = ms => ms.map(m => { lista.push(m); return medalha(m, idx++); }).join("");
  box.classList.remove("oculto");
  box.innerHTML = `<div class="conq-topo"><div><h2>🏅 Minhas conquistas</h2><span class="pequeno">${ganhas.length} de ${todas.length} conquistadas · cada 3 conquistas sobem 1 nível</span></div>
      <div class="conq-nivel" title="Faltam ${prox} conquista(s) para o próximo nível"><b>Nível ${nivel}</b><div class="barra"><i style="width:${Math.round(((ganhas.length % 3) / 3) * 100)}%"></i></div><span class="pequeno">faltam ${prox} para o nível ${nivel + 1}</span></div></div>
    <h3 class="conq-h3">🌟 Gerais <span class="pequeno">— todas as matérias</span></h3>
    <div class="medalhas">${bloco(c.gerais)}</div>
    ${c.materias.length ? `<h3 class="conq-h3">📚 Por matéria</h3>${c.materias.map(m => `<details class="conq-materia"${m.conquistas.some(x => x.ok) ? " open" : ""}><summary><b>${esc(m.materia)}</b>
        <span class="tag ${m.media >= 80 ? "ok" : m.media >= 50 ? "nota" : "aviso"}">média ${Math.round(m.media)}</span><span class="pequeno">${m.provas.length} prova(s) · ${m.conquistas.filter(x => x.ok).length}/${m.conquistas.length} conquistas</span></summary>
        <div class="medalhas">${bloco(m.conquistas)}</div></details>`).join("")}` : `<p class="pequeno">Faça a sua primeira prova para começar a ganhar conquistas por matéria.</p>`}
    ${diario.length ? `<h3 class="conq-h3">📔 Na sala de aula</h3><p class="pequeno" style="margin-top:-4px">Conquistas das suas aulas, registradas pela sua auxiliar.</p><div class="medalhas">${bloco(diario)}</div>` : ""}`;
  box.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
    const m = lista[Number(b.dataset.m)];
    modal({ titulo: `${m.e} ${m.t}`, conteudo: `<p style="margin-top:0">${esc(m.d)}</p>
      ${m.ok ? `<p class="tag ok">✓ Conquistada!</p>` : m.prog ? `<p>Progresso: <b>${m.prog[0]} de ${m.prog[1]}</b></p><div class="m-barra" style="width:100%;height:10px"><i style="width:${Math.round(m.prog[0] / m.prog[1] * 100)}%"></i></div>` : ""}
      ${m.detalhe?.length ? `<p class="pequeno" style="margin-bottom:4px">${m.ok ? "Como você conquistou:" : "Até agora:"}</p><ul>${m.detalhe.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`, ok: "Legal!" });
  });
  if (visivel && novas.length && vistas.size) festejar(novas);   // na 1ª visita não comemora tudo de uma vez
  return { ganhas, todas, nivel, provas, materias: c.materias };
}

function festejar(novas) {
  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const f = document.createElement("div");
  f.className = "festa-diario"; f.setAttribute("role", "status");
  f.innerHTML = (reduz ? "" : Array.from({ length: 30 }, (_, i) => `<span class="conf" style="left:${Math.random() * 100}%;animation-delay:${Math.random() * .6}s;font-size:${18 + Math.random() * 22}px">${["🎉", "⭐", "✨", novas[0].e][i % 4]}</span>`).join("")) +
    `<div class="festa-caixa"><div class="festa-grande">${novas[0].e}</div><b>${novas.length > 1 ? `${novas.length} conquistas novas!` : "Conquista nova!"}</b>${novas.map(m => `<p><b>${esc(m.t)}</b> — ${esc(m.d)}</p>`).join("")}</div>`;
  document.body.appendChild(f);
  f.onclick = () => f.remove(); setTimeout(() => f.remove(), 5000);
}
