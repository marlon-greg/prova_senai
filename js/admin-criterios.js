// Painel → Organização → "Critérios de avaliação".
// REGRA FIXA: os critérios vêm do sistema de AUTOAVALIAÇÃO (o professor sobe o plano de ensino lá).
// Aqui a equipe só VÊ o que veio de lá. Em último caso, SÓ o administrador principal importa ou adiciona à mão,
// no mesmo formato da importação de lá (js/criterios-formato.js); o que entra assim fica marcado "manual" e,
// quando a autoavaliação trouxer o mesmo número, o de lá substitui.
import { db, esc, $, toast, modal, confirmar, traduzirErro, SUPER_ADMIN } from "./common.js";
import { ic } from "./icones.js";
import { pl } from "./ui.js";
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { COLECAO_CRITERIOS, carregarCriteriosOficiais } from "./plano-ensino.js?v=20261116a";
import { validarPlanos, mesclarPlano, PROMPT_CRITERIOS, TIPOS } from "./criterios-formato.js?v=20261116a";

let eu = null, docs = [];
export function iniciarCriterios(c) { eu = c.eu; }
const souPrincipal = () => String(eu?.email || "").toLowerCase() === SUPER_ADMIN.toLowerCase();
const cod = n => "C" + String(n).padStart(2, "0");
const ROT_ORIGEM = { autoavaliacao: "da autoavaliação", manual: "manual (admin)", misto: "autoavaliação + manual" };
const ROT_TIPO = { TECNICA: "Técnica", SOCIOEMOCIONAL: "Socioemocional" };
const dataHora = t => t?.toDate ? t.toDate().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

export async function carregarCriterios() {
  const box = $("#orgCriterios"); if (!box) return;
  try { docs = (await getDocs(collection(db, COLECAO_CRITERIOS))).docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { box.innerHTML = `<p class="pequeno erro-texto">Critérios de avaliação: ${esc(traduzirErro(e))}</p>`; return; }
  desenhar();
}

function desenhar() {
  const box = $("#orgCriterios"), adm = souPrincipal();
  const aberto = box.querySelector("details.bloco-linha")?.open ? "open" : "";
  const total = docs.reduce((n, d) => n + (d.capacidades || []).reduce((m, c) => m + (c.criterios || []).length, 0), 0);
  const uc = d => {
    const caps = d.capacidades || [];
    const nSoc = caps.filter(c => c.tipo === "SOCIOEMOCIONAL").reduce((m, c) => m + c.criterios.length, 0);
    return `<details class="grupo-semestre"><summary><span class="gs-nome">🎯 ${esc(d.uc?.nome || d.id)} <span class="pequeno">(${esc(d.uc?.sigla || d.id)})</span></span>
        <span class="tag">${pl(caps.reduce((m, c) => m + c.criterios.length, 0), "critério")}</span>
        <span class="tag${d.origem === "autoavaliacao" ? "" : " aviso"}">${ROT_ORIGEM[d.origem] || esc(d.origem || "?")}</span>
        ${nSoc ? "" : `<span class="tag aviso">sem socioemocionais</span>`}
        ${dataHora(d.atualizadoEm) ? `<span class="pequeno">atualizado ${dataHora(d.atualizadoEm)}</span>` : ""}</summary>
      <div class="gt-corpo">${caps.map(c => `<p class="pc-cap"><b>${ROT_TIPO[c.tipo] || c.tipo} ${c.numero}</b> — ${esc(c.descricao)}</p>
        <ul class="cr-lista">${c.criterios.map(k => `<li><p class="cr-texto"><span class="cr-cod">${cod(k.numero)}</span>${esc(k.texto)}
          ${k.manual ? ` <span class="tag aviso">manual</span>${adm ? ` <button type="button" class="discreto mini" data-cr-tirar="${esc(d.id)}|${k.numero}">Remover</button>` : ""}` : ""}</p>
          ${k.explicacao ? `<p class="cr-expl pequeno">${esc(k.explicacao)}</p>` : ""}</li>`).join("")}</ul>`).join("")}</div></details>`;
  };
  box.innerHTML = `<details class="card sem-padding bloco-linha" ${aberto}><summary class="sub-cab"><span class="ch ch-esq" aria-hidden="true">${ic("chev")}</span><span class="sc-tile">${ic("check", { size: 20 })}</span><span class="sc-texto"><span class="sc-titulo">Critérios de avaliação</span><span class="sc-resumo">${docs.length ? `${pl(docs.length, "unidade")} · ${pl(total, "critério")}` : "nenhum ainda"} · vêm do sistema de autoavaliação</span></span>
      ${adm ? `<span class="sc-fim"><button class="leve mini" id="crImportar" type="button">${ic("download", { size: 16 })}Importar (admin)</button><button class="leve mini" id="crAdicionar" type="button">${ic("plus", { size: 16 })}Adicionar (admin)</button></span>` : ""}</summary><div class="bloco-linha-corpo">
    <p class="help" style="max-width:none">Os critérios são criados no <b>sistema de autoavaliação</b>, junto com o plano de ensino, e chegam aqui sozinhos. Na prova você só <b>escolhe ou tira</b> critérios.${adm ? " Importar e adicionar à mão é só para último caso: o que entra assim fica marcado <b>manual</b> e é trocado pelo de lá quando o mesmo número chegar." : " Para criar ou mudar um critério, faça no sistema de autoavaliação."}</p>
    ${docs.length ? `<div class="lista-grupos">${docs.map(uc).join("")}</div>` : `<p class="pequeno">Ainda não chegou nenhum critério da autoavaliação. Sem critérios, a prova mostra as capacidades do plano de curso.</p>`}
  </div></details>`;
  if (!adm) return;
  $("#crImportar").onclick = e => { e.preventDefault(); importar(); };
  $("#crAdicionar").onclick = e => { e.preventDefault(); adicionar(); };
  box.querySelectorAll("[data-cr-tirar]").forEach(b => b.onclick = () => remover(...b.dataset.crTirar.split("|")));
}

// prompt (só para o admin principal), com botão de copiar
const htmlPrompt = () => `<details class="recolhivel"><summary><span class="rc-titulo">🤖 Prompt para gerar o JSON no padrão da autoavaliação</span></summary><div class="rc-corpo">
    <p class="pequeno" style="margin-top:0">Cole numa IA junto com o plano de ensino (ou a aba de critérios). O resultado serve aqui <b>e</b> na importação do sistema de autoavaliação.</p>
    <textarea id="crPrompt" rows="10" readonly>${esc(PROMPT_CRITERIOS)}</textarea>
    <button type="button" class="leve mini" id="crCopiarPrompt">${ic("copy", { size: 16 })}Copiar prompt</button></div></details>`;
const ligarPrompt = caixa => caixa.querySelector("#crCopiarPrompt").onclick = () => navigator.clipboard.writeText(PROMPT_CRITERIOS)
  .then(() => toast("Prompt copiado. Cole na IA com o plano de ensino. 📋", "ok"), () => { caixa.querySelector("#crPrompt").select(); toast("Selecionei o prompt: use Ctrl+C.", "info"); });

// grava cada plano juntando com o que já existe (origem manual)
async function gravar(planos, origem = "manual") {
  const resumo = [];
  for (const novo of planos) {
    const ref = doc(db, COLECAO_CRITERIOS, novo.uc.sigla);
    const atual = (await getDoc(ref)).data() || null;
    const { contagem } = mesclarPlano(atual, novo, "manual");   // a contagem é a mesma nos dois modos
    const { plano } = mesclarPlano(atual, novo, origem);
    await setDoc(ref, { ...plano, atualizadoEm: serverTimestamp(), atualizadoPor: eu.email });
    resumo.push({ sigla: novo.uc.sigla, ...contagem });
  }
  await carregarCriteriosOficiais(db, { collection, getDocs }, { forcar: true });
  await carregarCriterios();
  return resumo;
}
const textoContagem = c => `${c.sigla}: ${c.capacidadesCriadas} capacidade(s) nova(s), ${c.capacidadesAtualizadas} atualizada(s); ${c.criteriosCriados} critério(s) novo(s), ${c.criteriosAtualizados} atualizado(s)`;
// prévia sem gravar (como a pré-visualização da importação de lá)
const previa = planos => planos.map(p => ({ sigla: p.uc.sigla, ...mesclarPlano(docs.find(d => d.id === p.uc.sigla) || null, p, "manual").contagem }));

async function importar() {
  const html = `<p class="pequeno" style="margin-top:0"><b>Último caso.</b> O certo é cadastrar no sistema de autoavaliação. Use o mesmo JSON da importação de lá: um objeto <code>{ uc, capacidades }</code> ou uma lista deles.</p>
    ${htmlPrompt()}
    <label for="crArquivo">Arquivo .json</label><input type="file" id="crArquivo" accept=".json,application/json">
    <label for="crJson">ou cole o JSON</label><textarea id="crJson" rows="10" placeholder='{ "uc": { "sigla": "BD", "nome": "Banco de Dados" }, "capacidades": [ … ] }'></textarea>
    <label class="check"><input type="checkbox" id="crDeLa"> <span>Este JSON é <b>o mesmo</b> que está no sistema de autoavaliação (grava como "da autoavaliação", não como manual)</span></label>
    <div id="crMsg" class="pequeno" aria-live="polite"></div>`;
  let planos = [];
  await modal({ titulo: "Importar critérios de avaliação (admin)", conteudo: html, ok: "Importar", cancelar: "Cancelar", largo: true,
    aoAbrir: caixa => {
      ligarPrompt(caixa);
      caixa.querySelector("#crArquivo").onchange = async e => { const a = e.target.files[0]; if (a) caixa.querySelector("#crJson").value = await a.text(); };
    },
    antesDeConfirmar: async caixa => {
      const msg = caixa.querySelector("#crMsg");
      let json;
      try { json = JSON.parse(caixa.querySelector("#crJson").value); } catch (e) { msg.innerHTML = `<span class="erro-texto">JSON inválido: ${esc(e.message)}</span>`; return false; }
      const v = validarPlanos(json);
      if (v.erros.length) { msg.innerHTML = `<span class="erro-texto">Corrija antes de importar:</span><ul>${v.erros.slice(0, 15).map(x => `<li>${esc(x)}</li>`).join("")}</ul>`; return false; }
      planos = v.planos;
      const deLa = caixa.querySelector("#crDeLa").checked;
      if (!(await confirmar(`Importar como ${deLa ? "DA AUTOAVALIAÇÃO (substitui o que não for manual)" : "MANUAL"}?\n\n${previa(planos).map(textoContagem).join("\n")}`, { titulo: "Confirmar importação", ok: "Importar" }))) return false;
      try { const r = await gravar(planos, deLa ? "autoavaliacao" : "manual"); toast(`Importado. ${r.map(textoContagem).join(" · ")}`, "ok"); }
      catch (e) { msg.innerHTML = `<span class="erro-texto">${esc(traduzirErro(e))}</span>`; return false; }
    } });
}

async function adicionar() {
  const ucs = docs.map(d => `<option value="${esc(d.id)}">${esc(d.uc?.nome || d.id)} (${esc(d.id)})</option>`).join("");
  const html = `<p class="pequeno" style="margin-top:0"><b>Último caso.</b> O certo é cadastrar no sistema de autoavaliação. Mesmo padrão de lá: UC → capacidade (tipo + número) → critério (número único na UC).</p>
    ${htmlPrompt()}
    <div class="grade">
      <div><label for="crUc">Unidade curricular</label><select id="crUc">${ucs}<option value="__nova">+ Outra (nova sigla)</option></select></div>
      <div class="cr-nova oculto"><label for="crSigla">Sigla</label><input id="crSigla" maxlength="20" placeholder="BD"></div>
      <div class="cr-nova oculto"><label for="crNomeUc">Nome da unidade</label><input id="crNomeUc" maxlength="200" placeholder="Banco de Dados"></div>
    </div>
    <div class="grade">
      <div><label for="crTipo">Tipo da capacidade</label><select id="crTipo">${TIPOS.map(t => `<option value="${t}">${ROT_TIPO[t]}</option>`).join("")}</select></div>
      <div style="max-width:140px"><label for="crCap">Nº da capacidade</label><input id="crCap" type="number" min="1" step="1"></div>
      <div style="max-width:140px"><label for="crNum">Nº do critério</label><input id="crNum" type="number" min="1" step="1"></div>
    </div>
    <label for="crDesc">Descrição da capacidade</label><input id="crDesc" maxlength="500">
    <label for="crTexto">Critério de avaliação (como está no plano)</label><textarea id="crTexto" rows="2" maxlength="500"></textarea>
    <label for="crExpl">Explicação para o aluno (opcional)</label><textarea id="crExpl" rows="2" maxlength="5000"></textarea>
    <div id="crMsg" class="pequeno" aria-live="polite"></div>`;
  await modal({ titulo: "Adicionar critério (admin)", conteudo: html, ok: "Adicionar", cancelar: "Cancelar", largo: true,
    aoAbrir: caixa => {
      ligarPrompt(caixa);
      const q = s => caixa.querySelector(s);
      const nova = () => caixa.querySelectorAll(".cr-nova").forEach(x => x.classList.toggle("oculto", q("#crUc").value !== "__nova"));
      // a descrição da capacidade que já existe vem preenchida
      const desc = () => { const d = docs.find(x => x.id === q("#crUc").value), c = d?.capacidades?.find(c => c.tipo === q("#crTipo").value && c.numero === Number(q("#crCap").value)); if (c) q("#crDesc").value = c.descricao; };
      q("#crUc").onchange = () => { nova(); desc(); }; q("#crTipo").onchange = desc; q("#crCap").oninput = desc; nova();
    },
    antesDeConfirmar: async caixa => {
      const q = s => caixa.querySelector(s).value.trim(), msg = caixa.querySelector("#crMsg");
      const novaUc = q("#crUc") === "__nova", d = docs.find(x => x.id === q("#crUc"));
      const uc = novaUc ? { sigla: q("#crSigla"), nome: q("#crNomeUc") } : { sigla: d?.uc?.sigla || q("#crUc"), nome: d?.uc?.nome || q("#crUc") };
      const v = validarPlanos({ uc, capacidades: [{ tipo: q("#crTipo"), numero: q("#crCap"), descricao: q("#crDesc"),
        criterios: [{ numero: q("#crNum"), texto: q("#crTexto"), ...(q("#crExpl") ? { explicacao: q("#crExpl") } : {}) }] }] });
      if (v.erros.length) { msg.innerHTML = `<span class="erro-texto">${v.erros.map(esc).join("<br>")}</span>`; return false; }
      const n = Number(q("#crNum")), existe = d?.capacidades?.some(c => c.criterios.some(k => k.numero === n));
      if (existe && !(await confirmar(`O ${cod(n)} já existe em ${uc.sigla}. Substituir pelo texto novo (fica marcado manual)?`, { titulo: "Substituir critério", ok: "Substituir" }))) return false;
      try { await gravar(v.planos); toast(`${cod(n)} adicionado em ${uc.sigla} (manual).`, "ok"); }
      catch (e) { msg.innerHTML = `<span class="erro-texto">${esc(traduzirErro(e))}</span>`; return false; }
    } });
}

async function remover(sigla, numero) {
  const n = Number(numero);
  if (!(await confirmar(`Remover o critério manual ${cod(n)} de ${sigla}? Provas que já usam ele deixam de mostrá-lo.`, { titulo: "Remover critério manual", ok: "Remover", perigo: true }))) return;
  try {
    const ref = doc(db, COLECAO_CRITERIOS, sigla), atual = (await getDoc(ref)).data();
    if (!atual) return;
    const capacidades = (atual.capacidades || []).map(c => ({ ...c, criterios: c.criterios.filter(k => !(k.manual && k.numero === n)) })).filter(c => c.criterios.length);
    const manuais = capacidades.some(c => c.criterios.some(k => k.manual));
    await setDoc(ref, { ...atual, capacidades, origem: manuais ? atual.origem : (atual.origem === "manual" ? "manual" : "autoavaliacao"), atualizadoEm: serverTimestamp(), atualizadoPor: eu.email });
    await carregarCriteriosOficiais(db, { collection, getDocs }, { forcar: true });
    await carregarCriterios();
    toast(`${cod(n)} removido.`, "ok");
  } catch (e) { toast(traduzirErro(e), "erro"); }
}
