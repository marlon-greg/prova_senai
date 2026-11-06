// Página do aluno → "🏅 Minhas conquistas": gerais (todas as matérias), por matéria e, para quem tem
// acessibilidade, as do diário da sala (resumo positivo gravado pela auxiliar). Regras em js/conquistas.js.
import { db, esc, $, modal } from "./common.js";
import { conquistasNotas, medalhasDiario, medalhaHTML, pontosConquistas } from "./conquistas.js";
import { seta } from "./ui.js";
export async function lerListaConquistas() { return (await getDoc(doc(db, "config", "conquistas")).catch(() => null))?.data()?.lista || null; }
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
  const cfgLista = opc.lista !== undefined ? opc.lista : await lerListaConquistas();
  const c = conquistasNotas(provas, cfgLista);
  const diario = resumoDiario ? medalhasDiario(resumoDiario, cfgLista) : [];
  if (opc.forcar?.size) [...c.gerais, ...c.materias.flatMap(m => m.conquistas), ...diario].forEach(m => { if (opc.forcar.has(m.t) && !m.ok) { const u = m.niveis.length - 1; Object.assign(m, { ok: true, nivelAtual: u, nivelNome: String(m.niveis[u].nome || m.t).replaceAll("{materia}", String(m.id).split(":")[1] || ""), proximo: null, maximo: true }); } });
  const todas = [...c.gerais, ...c.materias.flatMap(m => m.conquistas), ...diario];
  const ganhas = todas.filter(m => m.ok);
  // medalha nova ou nível novo desde a última visita: comemora
  const chave = `conquistas-niveis:${opc.simulacao ? "sim:" : ""}${eu.uid}`, marca = m => `${m.id}#${m.nivelAtual}`;
  let vistas = new Set(); try { vistas = new Set(JSON.parse(localStorage.getItem(chave) || "[]")); } catch (e) { /* começa do zero */ }
  const novas = ganhas.filter(m => !vistas.has(marca(m)));
  try { localStorage.setItem(chave, JSON.stringify(ganhas.map(marca))); } catch (e) { /* só não lembra */ }
  const pontos = pontosConquistas(ganhas), nivel = Math.floor(pontos / 3) + 1, prox = 3 - (pontos % 3);
  let idx = 0; const lista = [];
  const bloco = ms => `<div class="medalhas-n">${ms.map(m => { lista.push(m); return medalhaHTML(m, { i: idx++, nova: novas.includes(m) }); }).join("")}</div>`;
  const grupo = (titulo, ms, extra = "") => `<details class="conq-grupo"><summary class="grupo-cab">${seta()}<h3 class="gc-titulo">${titulo}</h3><span class="chip navy">${ms.filter(x => x.ok).length}/${ms.length}</span>${extra}</summary>${bloco(ms)}</details>`;
  box.classList.remove("oculto");
  box.innerHTML = `<div class="conq-topo"><div><h2>🏅 Minhas conquistas</h2><span class="pequeno">${ganhas.length} de ${todas.length} conquistadas · cada 3 níveis de conquista sobem 1 nível do perfil</span></div>
      <div class="conq-nivel" title="Faltam ${prox} para o próximo nível"><b>Nível ${nivel}</b><div class="barra"><i style="width:${Math.round(((pontos % 3) / 3) * 100)}%"></i></div><span class="pequeno">faltam ${prox} para o nível ${nivel + 1}</span></div></div>
    <details class="recolhivel leve conq-todas" data-chave="aluno:conquistas">
    <summary><span class="rc-titulo">Ver todas as conquistas</span>${novas.length && vistas.size ? `<span class="rc-resumo"><span class="chip ok">✨ ${novas.length} nova(s)</span></span>` : ""}</summary><div class="rc-corpo conq-grupos">
    ${grupo("🌟 Gerais", c.gerais)}
    ${c.materias.length ? c.materias.map(m => grupo(`📚 ${esc(m.materia)}`, m.conquistas, `<span class="meta-txt">média ${Math.round(m.media)} · ${m.provas.length} prova(s)</span>`)).join("") : `<p class="help">Faça a sua primeira prova para começar a ganhar conquistas por matéria.</p>`}
    ${diario.length ? grupo("📔 Na sala de aula", diario, `<span class="meta-txt">registradas pela sua auxiliar</span>`) : ""}
    </div></details>`;
  box.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
    const m = lista[Number(b.dataset.m)];
    modal({ titulo: `${m.e} ${m.nivelNome || m.t}`, conteudo: `<p style="margin-top:0">${m.nivelNome && m.nivelNome !== m.t ? `<b>${esc(m.t)}</b>: ` : ""}${esc(m.d)}</p>
      ${m.maximo ? `<p class="tag ok">✓ Nível máximo!</p>` : m.prog ? `<p>Progresso: <b>${m.prog[0]} de ${m.prog[1]}</b>${m.proximo ? ` para <b>${esc(m.proximo.nome)}</b>` : ""}</p><div class="m-barra" style="width:100%;height:10px"><i style="width:${Math.round(m.prog[0] / m.prog[1] * 100)}%"></i></div>` : ""}
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
    `<div class="festa-caixa"><div class="festa-grande">${novas[0].e}</div><b>${novas.length > 1 ? `${novas.length} conquistas novas!` : "Conquista nova!"}</b>${novas.map(m => `<p><b>${esc(m.nivelNome || m.t)}</b> — ${esc(m.d)}</p>`).join("")}</div>`;
  document.body.appendChild(f);
  f.onclick = () => f.remove(); setTimeout(() => f.remove(), 5000);
}
