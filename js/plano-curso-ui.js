// Formulário da prova: o que a prova avalia, pelo plano de curso e pelo plano de ensino.
// Unidade com critérios (vindos da AUTOAVALIAÇÃO, ver plano-ensino.js): escolhe a avaliação prevista (MS1…, SOM);
// os critérios dela vêm marcados e o professor só tira ou põe. Aqui não se cria nem se edita critério.
// Unidade sem critérios: marca capacidades e conhecimentos (plano-curso.js), como antes.
// Grava prova.planoCurso = { unidade, avaliacao, criterios, instrumento } ou { unidade, itens }.
import { PLANO_CURSO, unidadePorId, unidadeDaMateria, rotuloTec, nivelK } from "./plano-curso.js?v=20261112d";
import { criteriosDaUnidade, planoDaTurma, criteriosSugeridos, avaliacaoDaProva, proximaAvaliacao, codigoCriterio } from "./plano-ensino.js?v=20261116a";
import { esc, $ } from "./common.js";

const NENHUMA = "nenhuma";
const semTxt = u => Object.keys(u.semestres).map(s => s + "º").join(", ") + " sem.";
const dataBr = d => d ? d.split("-").reverse().slice(0, 2).join("/") : "";

export function htmlEditorTopicos(f) {
  const grupos = [...new Set(PLANO_CURSO.unidades.map(u => u.modulo))];
  return `<fieldset class="temas-box pc-editor">
    <legend>O que a prova avalia</legend>
    <p class="pequeno" style="margin-top:0">Os critérios vêm do sistema de autoavaliação (plano de ensino). Os da avaliação prevista já vêm marcados: aqui você só tira ou põe. O aluno vê os critérios antes de começar, cada um explicado.</p>
    <div class="grade">
      <div id="${f}PcUnidadeBox"><label for="${f}PcUnidade">Unidade curricular</label><select id="${f}PcUnidade">
        <option value="">Automática, pela matéria</option>
        ${grupos.map(g => `<optgroup label="Módulo ${esc(g)}">${PLANO_CURSO.unidades.filter(u => u.modulo === g).map(u => `<option value="${u.id}">${esc(u.nome)} (${semTxt(u)})${criteriosDaUnidade(u.id).length ? "" : " · sem critérios ainda"}</option>`).join("")}</optgroup>`).join("")}
        <option value="${NENHUMA}">Nenhuma (não mostrar nada ao aluno)</option>
      </select></div>
      <div id="${f}PcAvBox"><label for="${f}PcAv">Avaliação do plano de ensino</label><select id="${f}PcAv"></select></div>
      <div><label for="${f}PcInstrumento">Por qual meio</label><select id="${f}PcInstrumento">
        <option value="escrita">Prova escrita (alternativas + dissertativas)</option>
        <option value="seminario">Seminário (apresentação oral)</option>
      </select></div>
    </div>
    <p class="pequeno" id="${f}PcResumo" aria-live="polite"></p>
    <div id="${f}PcBlocos"></div>
  </fieldset>`;
}

// materia(): texto da matéria; ctx(): { turma, titulo, data } do formulário
export function editorTopicos(f, materia, ctx = () => ({}), aoMudarCaps = () => {}) {
  const $f = s => $("#" + f + s);
  let marcados = new Set(), ultima = null;
  const unidade = () => { const v = $f("PcUnidade").value; return v === NENHUMA ? null : unidadePorId(v) || unidadeDaMateria(materia()); };
  const comCriterios = u => !!(u && criteriosDaUnidade(u.id).length);
  const plano = u => u ? planoDaTurma(u.id, ctx().turma) : null;
  const avAtual = u => plano(u)?.avaliacoes.find(a => a.id === $f("PcAv").value) || null;
  const abertos = () => [...$f("PcBlocos").querySelectorAll("details[open]")].map(d => d.dataset.pcBloco);
  const reabrir = l => l.forEach(k => { const d = $f("PcBlocos").querySelector(`[data-pc-bloco="${k}"]`); if (d) d.open = true; });
  const bloco = (b, titulo, corpo, acoes = true) => `<details class="recolhivel pc-bloco" data-pc-bloco="${b}"><summary><span class="rc-titulo">${titulo}</span></summary><div class="rc-corpo">${acoes ? `<div class="pc-acoes"><button type="button" class="leve mini" data-pc-tudo="${b}">Marcar tudo</button><button type="button" class="leve mini" data-pc-nada="${b}">Desmarcar tudo</button></div>` : ""}${corpo}</div></details>`;
  const ck = (id, html, cls = "") => `<label class="check ${cls}"><input type="checkbox" value="${id}"${marcados.has(id) ? " checked" : ""}> <span>${html}</span></label>`;

  const isSeminario = () => $f("PcInstrumento")?.value === "seminario";
  // ---------- modo capacidades (unidade sem critérios cadastrados) ----------
  const k12 = u => u.con.filter(([id]) => nivelK(id) <= 2);
  const filhos = (u, id) => u.con.filter(([c]) => c.startsWith(id + ".") && nivelK(c) === nivelK(id) + 1);
  const todosCap = u => [...u.tec, ...u.soc, ...k12(u)].map(([id]) => id);
  function desenharCapacidades(u) {
    const sem = isSeminario();
    const con = u.con.filter(([id]) => nivelK(id) === 1).map(([id, t]) =>
      ck(id, esc(t), "pc-k1") + filhos(u, id).map(([id2, t2]) => {
        const f3 = filhos(u, id2).map(([, t3]) => t3).join(", ");
        return `<div class="pc-k2">${ck(id2, esc(t2))}${f3 ? `<div class="pc-k3" style="margin-left:26px">${esc(f3)}</div>` : ""}</div>`;
      }).join("")).join("");
    $f("PcBlocos").innerHTML = bloco("tec", sem ? "🗣 Conteúdos a apresentar" : "🛠 " + rotuloTec(u), u.tec.map(([id, t]) => ck(id, esc(t))).join("")) +
      bloco("soc", sem ? "🎤 Postura e comunicação oral" : "🤝 Capacidades socioemocionais", u.soc.map(([id, t]) => ck(id, esc(t))).join("")) +
      bloco("con", "📚 Conhecimentos", con);
    sincronizarPais(u);
  }
  function sincronizarPais(u) {
    for (const [id] of u.con.filter(([c]) => nivelK(c) === 1)) {
      const fs = filhos(u, id); if (!fs.length) continue;
      const n = fs.filter(([c]) => marcados.has(c)).length, el = $f("PcBlocos").querySelector(`input[value="${id}"]`);
      if (n === fs.length) marcados.add(id); else marcados.delete(id);
      if (el) { el.checked = n === fs.length; el.indeterminate = n > 0 && n < fs.length; }
    }
  }

  // ---------- modo critérios ----------
  function opcoesAv(u, valor) {
    const p = plano(u), hoje = new Date().toISOString().slice(0, 10), prox = proximaAvaliacao(p);
    $f("PcAvBox").classList.toggle("oculto", !comCriterios(u));
    if (!p) { $f("PcAv").innerHTML = `<option value="">Turma sem plano de ensino cadastrado</option>`; $f("PcAv").value = ""; return; }
    $f("PcAv").innerHTML = `<option value="">Nenhuma (escolher os critérios à mão)</option>` + p.avaliacoes.map(a =>
      `<option value="${a.id}">${esc(a.nome)} · ${dataBr(a.data)}${a === prox ? " (próxima)" : a.data < hoje ? " (já aplicada)" : ""}</option>`).join("");
    $f("PcAv").value = valor && p.avaliacoes.some(a => a.id === valor) ? valor : "";
  }
  function desenharCriterios(u) {
    const crit = criteriosDaUnidade(u.id);
    const sem = isSeminario();
    const lista = caps => caps.filter(([cid]) => crit.some(c => c[1] === cid)).map(([cid, nome]) =>
      `<p class="pc-cap">${esc(nome)}</p>` + crit.filter(c => c[1] === cid).map(([id, , t, , x]) =>
        ck(id, `<b>${codigoCriterio(id)}</b> ${esc(t)}${x?.grupo ? ` <span class="pequeno">(trabalho em grupo)</span>` : ""}`, "pc-cr")).join("")).join("");
    const nSoc = crit.filter(c => c[1].includes(".cs")).length;
    $f("PcBlocos").innerHTML = bloco("tec", sem ? "🗣 Conteúdos a apresentar (domínio técnico)" : "🛠 Critérios técnicos", lista(u.tec)) +
      (nSoc ? bloco("soc", sem ? "🎤 Postura e comunicação oral" : "🤝 Critérios socioemocionais", lista(u.soc))
        : `<p class="pequeno erro-texto">A autoavaliação ainda não tem critérios socioemocionais desta unidade. Cadastre lá no plano de ensino.</p>`);
  }

  function resumo() {
    const v = $f("PcUnidade").value, u = unidade();
    if (v === NENHUMA) return $f("PcResumo").textContent = "O aluno não vê o que a prova avalia.";
    if (!u) return $f("PcResumo").innerHTML = `Nenhuma unidade do plano bate com a matéria <b>${esc(materia() || "(vazia)")}</b>. Escolha a unidade acima.`;
    if (comCriterios(u)) {
      const crit = criteriosDaUnidade(u.id), nT = crit.filter(c => c[1].includes(".ct") && marcados.has(c[0])).length, nS = crit.filter(c => c[1].includes(".cs") && marcados.has(c[0])).length;
      const p = plano(u);
      return $f("PcResumo").innerHTML = `<b>${esc(u.nome)}</b>${p ? ` · plano de ensino: ${esc(p.planilha)}` : ""} · <b>${nT}</b> critério(s) técnico(s) · <b>${nS}</b> socioemocional(is)${nS ? "" : ` <span class="erro-texto">— sem socioemocional</span>`} · critérios do sistema de autoavaliação.`;
    }
    const n = l => l.filter(([id]) => marcados.has(id)).length;
    $f("PcResumo").innerHTML = `<b>${esc(u.nome)}</b> (ainda sem critérios do plano de ensino: o aluno vê as capacidades) · ${n(u.tec)}/${u.tec.length} ${rotuloTec(u).toLowerCase()} · ${n(u.soc)}/${u.soc.length} socioemocionais · ${n(k12(u))}/${k12(u).length} conhecimentos.`;
  }
  function desenhar() {
    const u = unidade(), ab = abertos();
    // a matéria é escolhida no topo: a unidade só aparece para escolher quando a matéria não bate com nenhuma (ou "Nenhuma")
    $f("PcUnidadeBox").classList.toggle("oculto", !!unidadeDaMateria(materia()) && $f("PcUnidade").value !== NENHUMA && (!$f("PcUnidade").value || $f("PcUnidade").value === unidadeDaMateria(materia())?.id));
    setTimeout(() => aoMudarCaps(capacidades()), 0);
    $f("PcAvBox").classList.toggle("oculto", !comCriterios(u));
    if (!u) $f("PcBlocos").innerHTML = "";
    else if (comCriterios(u)) desenharCriterios(u); else desenharCapacidades(u);
    reabrir(ab); resumo();
  }
  // escolhe a avaliação: os critérios dela vêm marcados
  function aplicarAv() {
    const u = unidade(), av = avAtual(u);
    if (av) marcados = new Set(criteriosSugeridos(u.id, av));
    desenhar();
  }
  // padrão de uma unidade (nova escolha ou matéria mudou)
  function padrao() {
    const u = unidade(); ultima = u?.id || null;
    if (comCriterios(u)) { const av = avaliacaoDaProva({ titulo: ctx().titulo, dataProva: ctx().data }, plano(u)); opcoesAv(u, av?.id); aplicarAv(); return; }
    marcados = new Set(u ? todosCap(u) : []); desenhar();
  }
  // re-tenta casar avaliação quando data ou título mudam (somente se nenhuma foi escolhida à mão)
  function aoMudarDataTitulo() {
    const u = unidade();
    if (!comCriterios(u)) return;
    const p = plano(u); if (!p) return;
    if ($f("PcAv").value) return;   // professor já escolheu manualmente
    const av = avaliacaoDaProva({ titulo: ctx().titulo, dataProva: ctx().data }, p);
    if (av?.id) { opcoesAv(u, av.id); aplicarAv(); }
  }
  function ligar() {
    $f("PcUnidade").onchange = padrao;
    $f("PcAv").onchange = aplicarAv;
    $f("PcInstrumento").onchange = () => { resumo(); desenhar(); };
    $f("PcBlocos").addEventListener("change", e => {
      const x = e.target, u = unidade();
      if (!x.matches("input[type=checkbox]")) return;
      const id = x.value;
      x.checked ? marcados.add(id) : marcados.delete(id);
      if (!comCriterios(u) && id.includes(".k") && nivelK(id) === 1) for (const [c] of filhos(u, id)) { x.checked ? marcados.add(c) : marcados.delete(c); const el = $f("PcBlocos").querySelector(`input[value="${c}"]`); if (el) el.checked = x.checked; }
      if (comCriterios(u)) desenhar(); else { sincronizarPais(u); resumo(); aoMudarCaps(capacidades()); }
    });
    $f("PcBlocos").addEventListener("click", e => {
      const u = unidade();
      const b = e.target.closest("[data-pc-tudo],[data-pc-nada]"); if (!b) return;
      const qual = b.dataset.pcTudo || b.dataset.pcNada, on = !!b.dataset.pcTudo;
      const ids = comCriterios(u)
        ? criteriosDaUnidade(u.id).filter(c => c[1].includes(qual === "tec" ? ".ct" : ".cs")).map(c => c[0])
        : (qual === "tec" ? u.tec : qual === "soc" ? u.soc : k12(u)).map(([id]) => id);
      ids.forEach(id => on ? marcados.add(id) : marcados.delete(id));
      desenhar();
    });
  }
  // matéria ou turma mudou: no automático, a unidade (ou o plano da turma) pode ter mudado
  let turmaAntes = null;
  function aoMudarMateria() {
    const u = unidade(), t = ctx().turma || "";
    if (!$f("PcUnidade").value && (u?.id || null) !== ultima) { turmaAntes = t; return padrao(); }
    if (comCriterios(u) && t !== turmaAntes) { turmaAntes = t; const v = $f("PcAv").value; opcoesAv(u, v); if (!v) return padrao(); }
    resumo();
  }
  // carrega o que a prova tem salvo (sem planoCurso = automático)
  function definir(pc = null) {
    $f("PcUnidade").value = pc && (pc.unidade === NENHUMA || unidadePorId(pc.unidade)) ? pc.unidade : "";
    $f("PcInstrumento").value = pc?.instrumento || "escrita";
    turmaAntes = ctx().turma || "";
    const u = unidade(); ultima = u?.id || null;
    if (!pc || !u) return padrao();
    if (comCriterios(u)) {
      if (!Array.isArray(pc.criterios) || !pc.criterios.length) return padrao();
      opcoesAv(u, pc.avaliacao);
      // só os que existem na autoavaliação; se nenhum sobrou, volta ao padrão da avaliação
      marcados = new Set(pc.criterios.filter(id => criteriosDaUnidade(u.id).some(c => c[0] === id)));
      if (!marcados.size) return padrao();
      return desenhar();
    }
    const itens = Array.isArray(pc.itens) ? pc.itens : [];
    marcados = new Set(!itens.length ? todosCap(u) : todosCap(u).filter(id => itens.some(i => id === i || (id.includes(".k") && id.startsWith(i + ".")))));
    desenhar();
  }
  // { erro } ou { valor } para gravar em prova.planoCurso
  function ler() {
    const v = $f("PcUnidade").value;
    if (v === NENHUMA) return { valor: { unidade: NENHUMA } };
    const u = unidade();
    if (!u) return { valor: { unidade: "" } };
    if (comCriterios(u)) {
      const crit = criteriosDaUnidade(u.id), ids = crit.map(c => c[0]).filter(id => marcados.has(id));
      if (!crit.some(c => c[1].includes(".ct") && marcados.has(c[0]))) return { erro: "O que a prova avalia: marque pelo menos um critério técnico." };
      // socioemocional obrigatória só quando a autoavaliação já tem critérios socioemocionais da unidade
      if (crit.some(c => c[1].includes(".cs")) && !crit.some(c => c[1].includes(".cs") && marcados.has(c[0]))) return { erro: "O que a prova avalia: a capacidade socioemocional vai junto. Marque pelo menos um critério socioemocional." };
      const instrumento = $f("PcInstrumento").value || "escrita";
      return { valor: { unidade: u.id, avaliacao: $f("PcAv").value || "", criterios: ids, instrumento } };
    }
    const tudo = todosCap(u), instrumento = $f("PcInstrumento").value || "escrita";
    if (!tudo.some(id => marcados.has(id))) return { erro: "O que a prova avalia: marque pelo menos um item, ou escolha Nenhuma na unidade curricular." };
    if (tudo.every(id => marcados.has(id))) return { valor: { unidade: u.id, itens: [], instrumento } };
    const itens = [...u.tec, ...u.soc].map(([id]) => id).filter(id => marcados.has(id));
    for (const [id] of u.con.filter(([c]) => nivelK(c) === 1)) {
      if (marcados.has(id)) itens.push(id); else itens.push(...filhos(u, id).map(([c]) => c).filter(c => marcados.has(c)));
    }
    return { valor: { unidade: u.id, itens, instrumento } };
  }
  // capacidades técnicas marcadas (ids "bd.ct9"); no modo critérios, as capacidades dos critérios marcados
  function capacidades() {
    const u = unidade(); if (!u) return new Set();
    if (comCriterios(u)) return new Set(criteriosDaUnidade(u.id).filter(c => marcados.has(c[0]) && c[1].includes(".ct")).map(c => c[1]));
    return new Set([...marcados].filter(id => id.includes(".ct")));
  }
  return { ligar, definir, ler, aoMudarMateria, aoMudarDataTitulo, capacidades, unidade };
}
