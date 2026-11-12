// Formulário da prova: escolher a unidade curricular do plano e marcar o que a prova avalia
// (capacidades técnicas/básicas, socioemocionais e conhecimentos). O aluno vê isso antes de começar.
// Grava prova.planoCurso = { unidade, itens } (ver topicosDaProva em plano-curso.js).
import { PLANO_CURSO, unidadePorId, unidadeDaMateria, rotuloTec, nivelK } from "./plano-curso.js";
import { esc, $ } from "./common.js";

const NENHUMA = "nenhuma";
const semTxt = u => Object.keys(u.semestres).map(s => s + "º").join(", ") + " sem.";

export function htmlEditorTopicos(f) {
  const grupos = [...new Set(PLANO_CURSO.unidades.map(u => u.modulo))];
  return `<fieldset class="temas-box pc-editor">
    <legend>Tópicos do plano de curso</legend>
    <p class="pequeno" style="margin-top:0">O aluno vê estes tópicos antes de começar a prova. Sem escolha, vale a unidade inteira da matéria.</p>
    <div class="grade"><div><label for="${f}PcUnidade">Unidade curricular</label><select id="${f}PcUnidade">
      <option value="">Automática, pela matéria</option>
      ${grupos.map(g => `<optgroup label="Módulo ${esc(g)}">${PLANO_CURSO.unidades.filter(u => u.modulo === g).map(u => `<option value="${u.id}">${esc(u.nome)} (${semTxt(u)})</option>`).join("")}</optgroup>`).join("")}
      <option value="${NENHUMA}">Nenhuma (não mostrar tópicos)</option>
    </select></div></div>
    <p class="pequeno" id="${f}PcResumo" aria-live="polite"></p>
    <div id="${f}PcBlocos"></div>
  </fieldset>`;
}

// materia(): texto atual do campo Matéria (ou a do banco)
export function editorTopicos(f, materia) {
  const $f = s => $("#" + f + s);
  let marcados = new Set();
  const unidade = () => { const v = $f("PcUnidade").value; return v === NENHUMA ? null : unidadePorId(v) || unidadeDaMateria(materia()); };
  const k12 = u => u.con.filter(([id]) => nivelK(id) <= 2);
  const filhos = (u, id) => u.con.filter(([c]) => c.startsWith(id + ".") && nivelK(c) === nivelK(id) + 1);
  const todos = u => [...u.tec, ...u.soc, ...k12(u)].map(([id]) => id);

  function resumo() {
    const v = $f("PcUnidade").value, u = unidade();
    if (v === NENHUMA) return $f("PcResumo").textContent = "O aluno não vê tópicos nesta prova.";
    if (!u) return $f("PcResumo").innerHTML = `Nenhuma unidade do plano bate com a matéria <b>${esc(materia() || "(vazia)")}</b>. Escolha a unidade acima para mostrar os tópicos ao aluno.`;
    const n = l => l.filter(([id]) => marcados.has(id)).length;
    $f("PcResumo").innerHTML = `${v ? "" : "Pela matéria: "}<b>${esc(u.nome)}</b> · ${n(u.tec)}/${u.tec.length} ${rotuloTec(u).toLowerCase()} · ${n(u.soc)}/${u.soc.length} socioemocionais · ${n(k12(u))}/${k12(u).length} conhecimentos. Desmarque o que a prova não cobre.`;
  }
  function desenhar() {
    const u = unidade(), box = $f("PcBlocos");
    if (!u) { box.innerHTML = ""; return resumo(); }
    const ck = (id, t, cls = "") => `<label class="check ${cls}"><input type="checkbox" value="${id}"${marcados.has(id) ? " checked" : ""}> <span>${esc(t)}</span></label>`;
    const acoes = b => `<div class="pc-acoes"><button type="button" class="leve mini" data-pc-tudo="${b}">Marcar tudo</button><button type="button" class="leve mini" data-pc-nada="${b}">Desmarcar tudo</button></div>`;
    const bloco = (b, titulo, corpo) => `<details class="recolhivel pc-bloco" data-pc-bloco="${b}"><summary><span class="rc-titulo">${titulo}</span></summary><div class="rc-corpo">${acoes(b)}${corpo}</div></details>`;
    const con = u.con.filter(([id]) => nivelK(id) === 1).map(([id, t]) =>
      ck(id, t, "pc-k1") + filhos(u, id).map(([id2, t2]) => {
        const f3 = filhos(u, id2).map(([, t3]) => t3).join(", ");
        return `<div class="pc-k2">${ck(id2, t2)}${f3 ? `<div class="pc-k3" style="margin-left:26px">${esc(f3)}</div>` : ""}</div>`;
      }).join("")).join("");
    box.innerHTML = bloco("tec", "🛠 " + rotuloTec(u), u.tec.map(([id, t]) => ck(id, t)).join("")) +
      bloco("soc", "🤝 Capacidades socioemocionais", u.soc.map(([id, t]) => ck(id, t)).join("")) +
      bloco("con", "📚 Conhecimentos", con);
    sincronizarPais(); resumo();
  }
  // nível 1 marcado = todos os filhos; parcial = indeterminado
  function sincronizarPais() {
    const u = unidade(); if (!u) return;
    for (const [id] of u.con.filter(([c]) => nivelK(c) === 1)) {
      const fs = filhos(u, id); if (!fs.length) continue;
      const n = fs.filter(([c]) => marcados.has(c)).length, el = $f("PcBlocos").querySelector(`input[value="${id}"]`);
      if (n === fs.length) marcados.add(id); else marcados.delete(id);
      if (el) { el.checked = n === fs.length; el.indeterminate = n > 0 && n < fs.length; }
    }
  }
  function ligar() {
    $f("PcUnidade").onchange = () => { const u = unidade(); marcados = new Set(u ? todos(u) : []); desenhar(); };
    $f("PcBlocos").addEventListener("change", e => {
      const x = e.target; if (!x.matches("input[type=checkbox]")) return;
      const u = unidade(), id = x.value;
      x.checked ? marcados.add(id) : marcados.delete(id);
      if (id.includes(".k") && nivelK(id) === 1) for (const [c] of filhos(u, id)) { x.checked ? marcados.add(c) : marcados.delete(c); const el = $f("PcBlocos").querySelector(`input[value="${c}"]`); if (el) el.checked = x.checked; }
      sincronizarPais(); resumo();
    });
    $f("PcBlocos").addEventListener("click", e => {
      const b = e.target.closest("[data-pc-tudo],[data-pc-nada]"); if (!b) return;
      const u = unidade(), qual = b.dataset.pcTudo || b.dataset.pcNada, on = !!b.dataset.pcTudo;
      const ids = (qual === "tec" ? u.tec : qual === "soc" ? u.soc : k12(u)).map(([id]) => id);
      ids.forEach(id => on ? marcados.add(id) : marcados.delete(id));
      const aberto = [...$f("PcBlocos").querySelectorAll("details[open]")].map(d => d.dataset.pcBloco);
      desenhar(); aberto.forEach(k => $f("PcBlocos").querySelector(`[data-pc-bloco="${k}"]`).open = true);
    });
  }
  // a matéria mudou: no modo automático, a unidade pode ter mudado
  let ultima = null;
  function aoMudarMateria() {
    if ($f("PcUnidade").value) return resumo();
    const u = unidade(); if ((u?.id || null) === ultima) return resumo();
    ultima = u?.id || null; marcados = new Set(u ? todos(u) : []); desenhar();
  }
  // carrega o que a prova tem salvo (planoCurso ausente = automático, tudo marcado)
  function definir(pc = {}) {
    const sel = $f("PcUnidade");
    sel.value = pc.unidade === NENHUMA || unidadePorId(pc.unidade) ? pc.unidade : "";
    const u = unidade(); ultima = u?.id || null;
    const itens = Array.isArray(pc.itens) ? pc.itens : [];
    if (!u) marcados = new Set();
    else if (!itens.length) marcados = new Set(todos(u));
    else marcados = new Set(todos(u).filter(id => itens.some(i => id === i || (id.includes(".k") && id.startsWith(i + ".")))));
    desenhar();
  }
  // { erro } ou { valor } para gravar em prova.planoCurso
  function ler() {
    const v = $f("PcUnidade").value;
    if (v === NENHUMA) return { valor: { unidade: NENHUMA, itens: [] } };
    const u = unidade();
    if (!u) return { valor: { unidade: "", itens: [] } };
    const tudo = todos(u);
    if (!tudo.some(id => marcados.has(id))) return { erro: "Tópicos do plano de curso: marque pelo menos um item, ou escolha Nenhuma na unidade curricular." };
    if (tudo.every(id => marcados.has(id))) return { valor: { unidade: u.id, itens: [] } };
    // conhecimento de nível 1 completo vai sozinho (inclui os filhos)
    const itens = [...u.tec, ...u.soc].map(([id]) => id).filter(id => marcados.has(id));
    for (const [id] of u.con.filter(([c]) => nivelK(c) === 1)) {
      if (marcados.has(id)) itens.push(id); else itens.push(...filhos(u, id).map(([c]) => c).filter(c => marcados.has(c)));
    }
    return { valor: { unidade: u.id, itens } };
  }
  return { ligar, definir, ler, aoMudarMateria };
}
