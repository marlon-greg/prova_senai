// Monta o editor certo para uma questão do tipo "diagrama" (na prova, no gabarito e no painel do professor).
//   montarDiagramaProva(container, { questao, valor, onMudar(valorString), somenteLeitura })
//     → { valor(): string, travar(), destruir() }   (o editor é baixado só quando a questão aparece)
// Requisitos (casos de uso, matriz…): js/diagramas-req.js · Banco de Dados (brModelo): js/brmodelo.js
import { ehER, modeloER } from "../servidor/diagrama-correcao.js?v=20261126a";

export function montarDiagramaProva(container, { questao, valor = null, onMudar = null, somenteLeitura = false } = {}) {
  let api = null, atual = typeof valor === "string" ? valor : valor ? JSON.stringify(valor) : "", destruido = false, ro = somenteLeitura;
  const host = document.createElement("div");
  host.className = "diag-prova" + (ehER(questao?.diagrama) ? " diag-prova-er" : "");
  host.setAttribute("data-campo-resposta", "");   // na prova: Ctrl+Z / Ctrl+Y / Delete liberados dentro do editor
  host.innerHTML = '<p class="pequeno diag-carregando">Abrindo o editor de diagramas…</p>';
  container.replaceChildren(host);

  async function montar() {
    api?.destruir?.();
    host.replaceChildren();
    const mudou = v => { atual = v || ""; onMudar?.(atual); };
    if (ehER(questao.diagrama)) {
      const { montarBRModelo } = await import("./brmodelo.js?v=20261126a");
      if (destruido) return;
      api = montarBRModelo(host, { valor: atual || null, modelo: modeloER(questao.diagrama), onMudar: mudou, somenteLeitura: ro, ferramentas: false, conversao: questao.conversao !== false });
    } else {
      const { montarDiagramaReq } = await import("./diagramas-req.js?v=20261126a");
      if (destruido) return;
      api = montarDiagramaReq(host, { tipo: questao.diagrama, valor: atual || null, onMudar: mudou, somenteLeitura: ro });
    }
  }
  montar().catch(e => { host.innerHTML = `<p class="erro-texto">Não foi possível abrir o editor de diagramas. Recarregue a página. (${String(e?.message || e)})</p>`; console.error(e); });

  return {
    valor() { try { const v = api?.valor?.(); if (typeof v === "string") atual = v; } catch { /* usa o último */ } return atual; },
    travar() { if (ro) return; this.valor(); ro = true; montar().catch(() => {}); },
    destruir() { destruido = true; api?.destruir?.(); api = null; host.remove(); }
  };
}
