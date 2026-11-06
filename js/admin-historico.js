// Painel → aba "Provas adaptadas": histórico de todas as adaptações, por aluno e por prova.
// Auxiliar de inclusão: só os alunos dela. Professor e admin: todos.
// Fontes: acessibilidade/{email}/questoes (o que está aplicado hoje) e acessibilidadePrivado/{email}/historico (cada escolha feita).
import { db, esc, $, traduzirErro, iniciais, dataBR, chaveTexto } from "./common.js";
import { ic } from "./icones.js";
import { vazio, pl } from "./ui.js";
import { FORMATOS } from "../servidor/formatos.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let ctx = null, dados = [], provas = {};
export function iniciarHistorico(c) {
  ctx = c;
  ["#hBusca", "#hTurma", "#hFormato", "#hOrigem"].forEach(id => $(id).addEventListener(id === "#hBusca" ? "input" : "change", desenhar));
}
const ms = t => t?.toMillis ? t.toMillis() : (t?.seconds ? t.seconds * 1000 : 0);

export async function carregarHistorico() {
  const box = $("#hLista"); box.innerHTML = `<p class="pequeno">Carregando…</p>`;
  try {
    const inc = ctx.eu.papel === "inclusao";
    const [as, ps, al] = await Promise.all([getDocs(inc ? query(collection(db, "acessibilidade"), where("auxiliares", "array-contains", ctx.eu.email)) : collection(db, "acessibilidade")),
      getDocs(collection(db, "provas")).catch(() => null), ctx.alunosDasTurmas().catch(() => [])]);
    provas = Object.fromEntries((ps?.docs || []).map(d => [d.id, { id: d.id, ...d.data() }]));
    dados = await Promise.all(as.docs.map(async d => {
      const email = d.id, a = d.data();
      const [qs, hs] = await Promise.all([getDocs(collection(db, "acessibilidade", email, "questoes")).catch(() => null), getDocs(collection(db, "acessibilidadePrivado", email, "historico")).catch(() => null)]);
      return { email, nome: a.nome || email, turmas: al.filter(x => x.email === email), questoes: (qs?.docs || []).map(x => ({ qid: x.id, ...x.data() })),
        historico: (hs?.docs || []).map(x => ({ id: x.id, ...x.data() })).sort((x, y) => ms(y.em) - ms(x.em)) };
    }));
  } catch (e) { box.innerHTML = `<p class="erro-texto">${esc(traduzirErro(e))}</p>`; return; }
  const ts = new Map(); dados.forEach(a => a.turmas.forEach(t => ts.set(t.turmaId, t.turma)));
  const sel = $("#hTurma"), antes = sel.value;
  sel.innerHTML = `<option value="">👥 Todas as turmas</option>` + [...ts].map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("");
  sel.value = ts.has(antes) ? antes : "";
  $("#hFormato").innerHTML = `<option value="">🎨 Todos os formatos</option>` + Object.entries(FORMATOS).map(([k, f]) => `<option value="${k}">${f.icone} ${esc(f.nome)}</option>`).join("");
  desenhar();
}

function desenhar() {
  const box = $("#hLista"), b = chaveTexto($("#hBusca").value), fT = $("#hTurma").value, fF = $("#hFormato").value, fO = $("#hOrigem").value;
  const fmtDe = q => q.formato || "texto";
  let nProvas = 0, nQ = 0;
  const html = dados.filter(a => !fT || a.turmas.some(t => t.turmaId === fT)).map(a => {
    // agrupa as questões aplicadas por prova
    const porProva = new Map();
    a.questoes.filter(q => (!fF || fmtDe(q) === fF) && (!fO || q.origem === fO)).forEach(q => { const k = q.provaId || "__sem"; if (!porProva.has(k)) porProva.set(k, []); porProva.get(k).push(q); });
    const blocos = [...porProva].filter(([pid, qs]) => !b || chaveTexto(`${a.nome} ${a.email} ${provas[pid]?.titulo || ""} ${qs.map(q => `${q.enunciado} ${q.opcaoTitulo || ""}`).join(" ")}`).includes(b))
      .sort((x, y) => Math.max(...y[1].map(q => ms(q.atualizadoEm))) - Math.max(...x[1].map(q => ms(q.atualizadoEm))));
    if (!blocos.length) return "";
    nProvas += blocos.length; nQ += blocos.reduce((s, [, qs]) => s + qs.length, 0);
    return `<section class="card hist-aluno"><div class="hist-cab"><span class="avatar">${esc(iniciais(a.nome))}</span><div><h3>${esc(a.nome)}</h3>
        <span class="pequeno">${a.turmas.map(t => esc(t.turma)).join(", ") || esc(a.email)} · ${blocos.length} prova(s) adaptada(s)</span></div></div>
      ${blocos.map(([pid, qs]) => {
        const p = provas[pid], hist = a.historico.filter(h => h.provaId === pid), ultima = Math.max(...qs.map(q => ms(q.atualizadoEm)));
        const formatos = {}; qs.forEach(q => formatos[fmtDe(q)] = (formatos[fmtDe(q)] || 0) + 1);
        const quem = [...new Set(qs.map(q => q.adaptadoPor).filter(Boolean))];
        return `<details class="hist-prova"><summary><b>${esc(p?.titulo || (pid === "__sem" ? "Sem prova definida" : "Prova apagada"))}</b>
            ${p?.turma ? `<span class="pequeno">${esc(p.turma)}</span>` : ""}<span class="pequeno">${pl(qs.length, "questão", "questões")}</span>
            ${Object.entries(formatos).map(([f, n]) => `<span class="tag nota" title="${esc(FORMATOS[f]?.nome || f)}">${FORMATOS[f]?.icone || "📝"} ${n}</span>`).join("")}
            <span class="pequeno">${ultima ? new Date(ultima).toLocaleDateString("pt-BR") : ""}${quem.length ? ` · ${quem.map(esc).join(", ")}` : ""}</span></summary>
          <div class="hist-corpo"><table class="hist-tab"><tr><th>Formato</th><th>Questão adaptada</th><th>Por quê</th><th>Quem / quando</th></tr>
            ${qs.map(q => `<tr><td>${FORMATOS[fmtDe(q)]?.icone || "📝"} ${esc(FORMATOS[fmtDe(q)]?.nome || "Texto")}${q.indicacao ? `<br><span class="of-estrelas">${"★".repeat(q.indicacao)}</span>` : ""}<br><span class="tag ${q.origem === "ia" ? "nota" : ""}">${q.origem === "ia" ? "🤖 IA" : "✍ manual"}</span></td>
              <td>${esc(String(q.enunciado || "").slice(0, 220))}</td><td class="pequeno">${esc(String(q.motivo || "—").slice(0, 400))}</td>
              <td class="pequeno">${esc(q.editadoPor || q.adaptadoPor || "—")}<br>${dataBR(q.atualizadoEm)}</td></tr>`).join("")}</table>
            ${hist.length ? `<details class="hist-linha"><summary>🕘 Histórico de escolhas (${hist.length})</summary><ul>${hist.map(h => `<li><b>${dataBR(h.em)}</b> · ${esc(h.porNome || h.por)}${h.papel === "inclusao" ? " (auxiliar de inclusão)" : ""} escolheu
              ${FORMATOS[h.formato]?.icone || ""} <b>${esc(FORMATOS[h.formato]?.nome || h.formato)}</b>${h.oferecidas ? ` entre ${h.oferecidas} opções da IA` : ""}${h.origem === "manual" ? " (ajustado à mão)" : ""}
              <br><span class="pequeno">“${esc(String(h.enunciadoOriginal || "").slice(0, 120))}” → “${esc(String(h.enunciado || "").slice(0, 120))}”</span></li>`).join("")}</ul></details>` : ""}
            <div class="linha acoes"><button type="button" class="leve mini" data-abrir="${esc(a.email)}">${ic("acess", { size: 16 })}Abrir na Acessibilidade</button></div></div></details>`;
      }).join("")}</section>`;
  }).join("");
  $("#hContagem").textContent = `${pl(nProvas, "prova adaptada", "provas adaptadas")} · ${pl(nQ, "questão", "questões")}`;
  box.innerHTML = html || vazio({ e: "🗂", texto: dados.length ? "Nada com esses filtros." : "Nenhuma prova adaptada ainda." });
  box.querySelectorAll("[data-abrir]").forEach(x => x.onclick = () => ctx.abrirAluno(x.dataset.abrir));
}
