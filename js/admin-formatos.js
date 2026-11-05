// Painel → Acessibilidade → questão sorteada → 🎨 Formatos.
// A IA propõe várias formas de cobrar o mesmo conteúdo (V/F, ligar colunas, lacunas…), da mais indicada para a menos,
// com o porquê e a base técnica. A pessoa vê a prévia (como o aluno vê, com o gabarito), escolhe, ajusta e aplica.
import { db, esc, $, toast, modal, confirmar, traduzirErro } from "./common.js";
import { tarefa } from "./ui.js";
import { FORMATOS, montarDeOpcao, opcaoParaTexto, textoParaOpcao, AJUDA_TEXTO, contextoDiario } from "../servidor/formatos.js";
import { montarFormato, temFormato } from "./formatos-ui.js";
import { formatosIA } from "./ia.js";
import { doc, getDoc, getDocs, setDoc, deleteDoc, addDoc, collection, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const priv = e => `acessibilidadePrivado/${e}`;
const estrelas = n => "★".repeat(n) + `<span class="apagada">${"★".repeat(5 - n)}</span>`;

// prévia de uma opção (como o aluno vê, com o gabarito marcado). Devolve o elemento ou a mensagem de erro.
export function previaOpcao(box, opcao, sem) {
  let m;
  try { m = montarDeOpcao(opcao, sem); } catch (e) { box.innerHTML = `<p class="pequeno erro-texto">⚠ ${esc(e.message)}</p>`; return false; }
  const a = m.adaptada, f = a.formato;
  box.innerHTML = `<div class="previa-aluno"><div class="enunciado">${esc(a.enunciado).replace(/\n/g, "<br>")}</div>
    ${f === "escritaApoio" ? `<div class="escrita-apoio">${a.dados.comecoResposta ? `<p><b>✏ Comece assim:</b> ${esc(a.dados.comecoResposta)}…</p>` : ""}${a.dados.checklist?.length ? `<p><b>✅ Não esqueça:</b></p><ul>${a.dados.checklist.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}</div><div class="pequeno">[campo de resposta escrita]</div>` : ""}
    ${f === "texto" ? (a.alternativas ? `<ol type="A" class="pequeno">${a.alternativas.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : `<div class="pequeno">[campo de resposta escrita]</div>`) : ""}
    <div class="q-area"></div>${a.apoios?.length ? `<p class="pequeno">💡 Apoios do mascote: ${a.apoios.map(esc).join(" · ")}</p>` : ""}</div>`;
  if (temFormato(a)) montarFormato(box.querySelector(".q-area"), a, { chave: { chave: m.chave }, nome: "prev_" + Math.random().toString(36).slice(2) });
  return true;
}

// grava a escolha: questão adaptada (o aluno lê, sem resposta) + gabarito privado + histórico
export async function aplicarOpcao({ ctx, email, prova, x, opcao, origem = "ia", oferecidas = 0 }) {
  const { adaptada, chave } = montarDeOpcao(opcao, `${email}_${x.qid}`);
  const motivo = [opcao.porque, opcao.referencia ? `Base: ${opcao.referencia}.` : ""].filter(Boolean).join(" ") || x.ad?.motivo || "";
  const dados = { formato: adaptada.formato, enunciado: adaptada.enunciado, alternativas: adaptada.alternativas ?? null, dados: adaptada.dados ?? null,
    apoios: adaptada.apoios || [], dica: adaptada.apoios?.[0] || "", motivo, origem, provaId: prova.id, adaptadoPor: ctx.eu.email, editadoPor: ctx.eu.email,
    opcaoTitulo: opcao.titulo || FORMATOS[adaptada.formato].nome, indicacao: opcao.indicacao || null, atualizadoEm: serverTimestamp() };
  await setDoc(doc(db, "acessibilidade", email, "questoes", x.qid), dados);
  if (chave) await setDoc(doc(db, ...priv(email).split("/"), "gabaritos", x.qid), { formato: adaptada.formato, chave, atualizadoEm: serverTimestamp(), por: ctx.eu.email });
  else await deleteDoc(doc(db, ...priv(email).split("/"), "gabaritos", x.qid)).catch(() => {});
  await addDoc(collection(db, ...priv(email).split("/"), "historico"), { qid: x.qid, provaId: prova.id, provaTitulo: prova.titulo || "", formato: adaptada.formato,
    titulo: dados.opcaoTitulo, porque: opcao.porque || "", referencia: opcao.referencia || "", indicacao: opcao.indicacao || null, origem, oferecidas,
    enunciadoOriginal: String(x.q.enunciado || "").slice(0, 600), enunciado: adaptada.enunciado.slice(0, 600), por: ctx.eu.email, porNome: ctx.eu.nome || ctx.eu.email, papel: ctx.eu.papel, em: serverTimestamp() }).catch(e => console.warn("histórico", e));
  return dados;
}

// opções guardadas (privado) ou novas da IA (navegador ou servidor)
export async function lerOpcoes(email, qid) {
  const d = await getDoc(doc(db, ...priv(email).split("/"), "opcoes", qid)).catch(() => null);
  if (!d?.exists()) return null;
  try { return { opcoes: JSON.parse(d.data().opcoes || "[]"), geradoEm: d.data().geradoEm }; } catch (e) { return null; }
}
export async function gerarOpcoes({ ctx, email, prova, x, orientacao = "", laudos }) {
  const cfg = ctx.iaCfg();
  if (cfg) {
    const [p, regs] = await Promise.all([getDoc(doc(db, "acessibilidadePrivado", email)).catch(() => null), getDocs(collection(db, ...priv(email).split("/"), "diario")).catch(() => null)]);
    const rs = regs?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
    const coms = (await Promise.all(rs.filter(r => r.nComentarios > 0).slice(0, 6).map(r => getDocs(collection(db, ...priv(email).split("/"), "diario", r.id, "comentarios")).catch(() => null))))
      .flatMap(s => s?.docs.map(d => d.data()) || []);
    const opcoes = await formatosIA({ chave: cfg.chave, modelo: cfg.modelo, q: x.q, g: x.g, descricao: p?.data()?.descricao || "", perfil: p?.data()?.perfilIA?.texto || "", orientacao, diario: contextoDiario(rs, coms), laudos: await laudos() });
    await setDoc(doc(db, ...priv(email).split("/"), "opcoes", x.qid), { opcoes: JSON.stringify(opcoes), provaId: prova.id, geradoPor: ctx.eu.email, geradoEm: serverTimestamp() });
    return opcoes;
  }
  if (!ctx.urlCorretor()) throw new Error("A IA não está configurada: chave do administrador principal ou servidor de correção (Configuração).");
  const token = await ctx.auth.currentUser.getIdToken();
  const r = await fetch(ctx.urlCorretor(), { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify({ acao: "formatos", email, qid: x.qid, provaId: prova.id, orientacao }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || `Erro ${r.status} no servidor.`);
  return d.opcoes;
}

// modal com as opções (da mais indicada para a menos), prévia e "Usar este"
export async function abrirOpcoes({ ctx, email, prova, x, laudos, aoAplicar }) {
  let salvas = await lerOpcoes(email, x.qid), opcoes = salvas?.opcoes || null, fechar = null;
  const html = `<div id="fmtTopo" class="linha" style="justify-content:space-between;align-items:center;gap:8px">
      <p class="pequeno" style="margin:0">A IA propõe formas diferentes de cobrar <b>o mesmo conteúdo</b>, já aplicadas ao que sabemos do aluno (descrição, laudos, diário e comentários dos professores), <b>da mais indicada para a menos</b>. Veja a prévia, escolha uma e ajuste se quiser.</p>
      <button type="button" class="leve mini" id="fmtGerar">🤖 ${opcoes ? "Gerar de novo" : "Gerar opções"}</button></div>
    <label for="fmtOrient" style="margin-top:8px">Orientação extra para a IA (opcional)</label><input type="text" id="fmtOrient" placeholder="Ex.: ela trava com texto longo; prefira formatos visuais">
    <div id="fmtLista" style="margin-top:12px"></div>`;
  const desenhar = caixa => {
    const box = $("#fmtLista", caixa);
    if (!opcoes) { box.innerHTML = `<div class="vazio"><div class="icone">🎨</div><p>Clique em <b>🤖 Gerar opções</b> (leva uns 30 segundos).</p></div>`; return; }
    const cartao = (o, i) => `<article class="opcao-fmt${i === 0 ? " melhor" : ""}">
      <div class="of-cab"><span class="of-rank">${i + 1}º</span><span class="of-icone">${FORMATOS[o.formato].icone}</span><div><b>${esc(FORMATOS[o.formato].nome)}</b>${o.titulo && o.titulo !== FORMATOS[o.formato].nome ? ` <span class="pequeno">— ${esc(o.titulo)}</span>` : ""}
        <div class="of-estrelas" title="Indicação para este aluno: ${o.indicacao} de 5">${estrelas(o.indicacao)}${i === 0 ? ` <span class="tag ok">⭐ mais indicado</span>` : ""}</div></div></div>
      <p class="of-porque">💬 ${esc(o.porque)}</p>${o.referencia ? `<p class="pequeno of-ref">📚 ${esc(o.referencia)}</p>` : ""}
      <details class="of-prev"${i < 2 ? " open" : ""}><summary>👁 Prévia — como o aluno vê (com o gabarito)</summary><div data-prev="${i}"></div></details>
      <div class="linha acoes"><button type="button" class="ok mini" data-usar="${i}">✅ Usar este</button><button type="button" class="leve mini" data-ajustar="${i}">✎ Ajustar e usar</button></div></article>`;
    box.innerHTML = `<p class="pequeno">Gerado ${salvas?.geradoEm?.toDate ? "em " + salvas.geradoEm.toDate().toLocaleString("pt-BR") : "agora"} · ${opcoes.length} opções</p>` +
      opcoes.slice(0, 2).map(cartao).join("") +
      (opcoes.length > 2 ? `<details class="mais-opcoes"><summary>Ver mais ${opcoes.length - 2} opção(ões)</summary>${opcoes.slice(2).map((o, k) => cartao(o, k + 2)).join("")}</details>` : "");
    box.querySelectorAll("[data-prev]").forEach(el => previaOpcao(el, opcoes[+el.dataset.prev], `${email}_${x.qid}`));
    box.querySelectorAll("[data-usar]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { const d = await aplicarOpcao({ ctx, email, prova, x, opcao: opcoes[+b.dataset.usar], origem: "ia", oferecidas: opcoes.length }); toast(`${FORMATOS[d.formato].icone} Formato aplicado: ${FORMATOS[d.formato].nome}.`, "ok"); fechar?.(); aoAplicar(d); }
      catch (e) { b.disabled = false; toast(traduzirErro(e), "erro"); }
    });
    box.querySelectorAll("[data-ajustar]").forEach(b => b.onclick = () => { fechar?.(); editarFormato({ ctx, email, prova, x, opcao: opcoes[+b.dataset.ajustar], oferecidas: opcoes.length, aoAplicar }); });
  };
  await modal({ titulo: `🎨 Formatos — ${String(x.q.enunciado || "").slice(0, 60)}${String(x.q.enunciado || "").length > 60 ? "…" : ""}`, conteudo: html, ok: "Fechar", largo: true,
    aoAbrir: caixa => {
      fechar = () => caixa.querySelector("[data-r='1']")?.click();
      desenhar(caixa);
      $("#fmtGerar", caixa).onclick = async e => {
        const b = e.currentTarget; b.disabled = true; $("#fmtLista", caixa).innerHTML = `<div class="espera-ia"><span class="tf-ampulheta" aria-hidden="true">⏳</span><b>A IA está pensando nos formatos para este aluno…</b><span class="pequeno">costuma levar até 1 minuto</span><div class="tf-barra indet"><i></i></div></div>`;
        const tf = tarefa({ titulo: "Pensando nos formatos da questão", icone: "🎨", estimativaSeg: 50 });
        try { opcoes = await gerarOpcoes({ ctx, email, prova, x, orientacao: $("#fmtOrient", caixa).value.trim(), laudos }); salvas = null; tf.fim(`${opcoes?.length || 0} opção(ões) de formato`); }
        catch (err) { tf.erro(err.message || traduzirErro(err)); toast("🤖 " + (err.message || traduzirErro(err)), "erro"); }
        b.disabled = false; b.textContent = "🤖 Gerar de novo"; desenhar(caixa);
      };
      if (!opcoes) $("#fmtGerar", caixa).click();
    } });
}

// editor: formato + enunciado + o conteúdo do formato em texto, com prévia ao vivo
export async function editarFormato({ ctx, email, prova, x, opcao = null, oferecidas = 0, aoAplicar }) {
  const ehAlt = x.q.tipo === "alternativa";
  let o = opcao ? structuredClone(opcao) : { formato: temFormato(x.ad || {}) ? x.ad.formato : "vf", enunciado: x.ad?.enunciado || x.q.enunciado, apoios: x.ad?.apoios || [] };
  if (!opcao && x.ad?.formato && x.ad.dados) o = await opcaoDaAdaptacao(email, x) || o;
  const opcoesF = Object.entries(FORMATOS).filter(([k]) => !(k === "escritaApoio" && ehAlt));
  const html = `<div class="grade"><div><label for="efFormato">Formato</label><select id="efFormato">${opcoesF.map(([k, f]) => `<option value="${k}"${k === o.formato ? " selected" : ""}>${f.icone} ${esc(f.nome)}</option>`).join("")}</select>
      <p class="pequeno" id="efDesc" style="margin:4px 0 0"></p></div></div>
    <label for="efEnun">Enunciado (o que o aluno deve fazer)</label><textarea id="efEnun" style="min-height:70px;font-family:inherit">${esc(o.enunciado || "")}</textarea>
    <label for="efTexto">Conteúdo do formato <span class="pequeno" id="efAjuda"></span></label><textarea id="efTexto" class="mono" style="min-height:140px">${esc(opcaoParaTexto(o))}</textarea>
    <label for="efApoios">💡 Apoios do mascote (um por linha; nunca podem dar a resposta)</label><textarea id="efApoios" style="min-height:60px;font-family:inherit">${esc((o.apoios || []).join("\n"))}</textarea>
    <label for="efPorque">📋 Por que este formato (vai para o PDF e o histórico)</label><textarea id="efPorque" style="min-height:50px;font-family:inherit">${esc(o.porque || "")}</textarea>
    <h4 style="margin:14px 0 6px">👁 Prévia (como o aluno vê, com o gabarito marcado)</h4><div id="efPrev" class="ef-previa"></div>
    <p class="pequeno">O original: ${esc(String(x.q.enunciado || "").slice(0, 300))}${ehAlt ? ` — certa: ${esc(x.q.alternativas?.[x.g.correta] ?? "?")}` : x.g.respostasAceitas?.length ? ` — resposta: ${esc(x.g.respostasAceitas[0])}` : ""}</p>`;
  let atual = null;
  const ler = c => textoParaOpcao($("#efFormato", c).value, $("#efTexto", c).value, { enunciado: $("#efEnun", c).value, apoios: $("#efApoios", c).value.split("\n").map(s => s.trim()).filter(Boolean),
    porque: $("#efPorque", c).value.trim(), referencia: o.referencia || "", titulo: o.titulo || "", indicacao: o.indicacao || null });
  await modal({ titulo: "✎ Formato da questão", conteudo: html, ok: "Aplicar este formato", cancelar: "Cancelar", largo: true,
    aoAbrir: c => {
      const atualizar = () => { const f = $("#efFormato", c).value; $("#efDesc", c).textContent = FORMATOS[f].desc; $("#efAjuda", c).textContent = "— " + AJUDA_TEXTO[f]; atual = ler(c); previaOpcao($("#efPrev", c), atual, `${email}_${x.qid}`); };
      $("#efFormato", c).onchange = () => { const f = $("#efFormato", c).value; if (f !== o.formato) { $("#efTexto", c).value = f === "texto" && ehAlt ? x.q.alternativas.map(a => `- ${a}`).join("\n") : ""; o.formato = f; } atualizar(); };
      ["#efTexto", "#efEnun", "#efApoios"].forEach(id => $(id, c).oninput = atualizar);
      atualizar();
    },
    antesDeConfirmar: async c => {
      const op = ler(c);
      if (op.formato === "texto" && ehAlt && (op.alternativas || []).length !== x.q.alternativas.length) { toast(`Texto simplificado: mantenha as ${x.q.alternativas.length} alternativas na mesma ordem.`, "erro"); return false; }
      try { montarDeOpcao(op, "v"); } catch (e) { toast(e.message, "erro"); return false; }
      try { const d = await aplicarOpcao({ ctx, email, prova, x, opcao: op, origem: opcao && opcaoParaTexto(opcao) === opcaoParaTexto(op) && opcao.enunciado === op.enunciado ? "ia" : "manual", oferecidas }); toast("Formato aplicado.", "ok"); aoAplicar(d); }
      catch (e) { toast(traduzirErro(e), "erro"); return false; }
      return true;
    } });
}

// reconstrói a "opção" a partir da adaptação gravada + gabarito privado (para editar o que já está aplicado)
async function opcaoDaAdaptacao(email, x) {
  const a = x.ad, d = a.dados || {};
  const g = (await getDoc(doc(db, ...priv(email).split("/"), "gabaritos", x.qid)).catch(() => null))?.data()?.chave;
  const base = { formato: a.formato, enunciado: a.enunciado, apoios: a.apoios || [], porque: a.motivo || "" };
  if (a.formato === "escritaApoio") return { ...base, comecoResposta: d.comecoResposta, checklist: d.checklist };
  if (!g) return null;
  if (a.formato === "menosAlt") return { ...base, alternativas: d.alternativas, correta: g.correta };
  if (a.formato === "vf") return { ...base, afirmacoes: d.afirmacoes.map((t, i) => ({ texto: t, verdadeira: g.valores[i] })) };
  if (a.formato === "ligar") return { ...base, pares: d.esquerda.map((e, i) => ({ esquerda: e, direita: d.direita[g.pares[i]] })) };
  if (a.formato === "lacunas") return { ...base, lacunas: { texto: String(d.texto).replace(/\[\[(\d+)\]\]/g, (_, n) => `[[${g.respostas[n - 1]}]]`), distratores: d.banco.filter(p => !g.respostas.includes(p)) } };
  if (a.formato === "ordenar") return { ...base, passos: g.ordem.map(i => d.passos[i]) };
  if (a.formato === "etapas") return { ...base, etapas: d.etapas.map((e, i) => ({ pergunta: e.pergunta, alternativas: e.alternativas, correta: g.corretas[i] })) };
  return null;
}

// prévia da adaptação já aplicada, dentro do cartão da questão
export async function previaAplicada(box, email, x) {
  if (!temFormato(x.ad || {})) { box.innerHTML = ""; return; }
  const g = (await getDoc(doc(db, ...priv(email).split("/"), "gabaritos", x.qid)).catch(() => null))?.data() || null;
  box.innerHTML = `<div class="q-area"></div>${g ? "" : `<p class="pequeno erro-texto">⚠ Sem gabarito: aplique o formato de novo.</p>`}`;
  montarFormato(box.querySelector(".q-area"), x.ad, { chave: g, nome: "apl_" + x.qid });
}
