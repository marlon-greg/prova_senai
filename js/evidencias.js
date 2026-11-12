// CONTRATO DO ECOSSISTEMA (aulas · autoavaliação · provas): EVIDÊNCIAS por aluno e por critério.
// Arquivo sem dependências: os 3 sistemas copiam ESTE arquivo (fonte da verdade: prova_senai/js/evidencias.js).
// Decisões e coleções: prova_senai/docs/ECOSSISTEMA.md.
//
// Ideia: tudo que acontece com o aluno vira uma EVIDÊNCIA no mesmo formato, gravada em evidencias/{id}.
// Cruzando as 3 vertentes (participou da aula? disse que sabe? comprovou na prova?) cada critério ganha
// uma SITUAÇÃO justificável, e as socioemocionais ganham evidência concreta (prazo, presença, iniciativa).
//
// evidencias/{id}  — UM documento por aluno por evento (lê pouco: 1 doc traz todos os critérios do evento)
//   id      = `${fonte}__${ref}__${email}`           (determinístico: regravar o mesmo evento não duplica)
//   email   : e-mail do aluno em minúsculas (chave entre os sistemas)   uid: uid do Firebase Auth (mesmo projeto)
//   turma   : "1A" | "1B" … (codigoTurma de plano-ensino.js)          turmaId: id do doc em turmas/ (se houver)
//   unidade : "bd" …   periodo: "2026-2"   data: "AAAA-MM-DD"
//   fonte   : ver FONTES    ref: id do evento na fonte (aulaId, atividadeId, provaId, autoavaliacaoId…)
//   titulo  : texto curto para o professor ("MS5 — SQL prático", "Aula 76-80 JOINs")
//   criterios: { "bd.cr25": { valor: 0..1 | null, nivel?: NIVEL, trabalhado?: true, obs?: "…" }, … }
//       valor = desempenho normalizado (prova/atividade/simulado) ou declaração (autoavaliação); null = só "trabalhado".
//   participacao?: { presente, minutos, respostas, acertos, duvidas, anotacoes, entregue, noPrazo, espontaneo }
//   gravadoPor: "aulas" | "autoavaliacao" | "provas" | "servidor"     em: timestamp do servidor
export const FONTES = {
  aula:          { nome: "Aula", vertente: "participacao", desc: "Presença e participação na aula ao vivo; marca os critérios trabalhados." },
  atividade:     { nome: "Atividade", vertente: "participacao", desc: "Atividade lançada pelo professor (formativa, sem nota): entrega, prazo e desempenho." },
  treino:        { nome: "Treino", vertente: "participacao", desc: "Treino que o aluno fez por conta própria (aba Atividades/Simulado)." },
  simulado:      { nome: "Simulado", vertente: "participacao", desc: "Simulado (sem nota): desempenho por critério." },
  autoavaliacao: { nome: "Autoavaliação", vertente: "declaracao", desc: "O aluno diz se consegue fazer o que o critério pede." },
  prova:         { nome: "Prova", vertente: "comprovacao", desc: "Avaliação com nota (MS/SOM): nível da rubrica por critério." }
};
export const VERTENTES = { participacao: "Participou", declaracao: "Disse que sabe", comprovacao: "Comprovou" };

// níveis da rubrica (prova) e da autoavaliação, com o valor normalizado
export const NIVEIS_PROVA = { ms: { nome: "Mais que Satisfatório", valor: 1 }, s: { nome: "Satisfatório", valor: 0.7 }, ps: { nome: "Parcialmente Satisfatório", valor: 0.35 }, ns: { nome: "Não Satisfatório", valor: 0 } };
export const NIVEIS_AUTO = { sim: { nome: "Consigo fazer", valor: 1 }, parcial: { nome: "Consigo em parte", valor: 0.5 }, nao: { nome: "Ainda não consigo", valor: 0 } };
// critério ATINGIDO na prova = Satisfatório ou mais (é o que conta na tabela "% de critérios atingidos" → nota)
export const ATINGIDO = 0.6;
export const DECLAROU_SABER = 0.75;

export const chaveEmail = e => String(e || "").trim().toLowerCase();
export const idEvidencia = (fonte, ref, email) => `${fonte}__${String(ref).replace(/\//g, "_")}__${chaveEmail(email)}`;
// valor a partir do que a fonte tem: pontos/máximo, nível da rubrica ou nível da autoavaliação
export function valorDe({ pontos, max, nivel } = {}) {
  if (Number.isFinite(pontos) && Number(max) > 0) return Math.max(0, Math.min(1, pontos / max));
  if (nivel && NIVEIS_PROVA[nivel]) return NIVEIS_PROVA[nivel].valor;
  if (nivel && NIVEIS_AUTO[nivel]) return NIVEIS_AUTO[nivel].valor;
  return null;
}
// monta (e confere) uma evidência pronta para gravar; devolve { id, dados } ou lança erro com a mensagem
export function montarEvidencia({ fonte, ref, email, uid = "", turma, turmaId = "", unidade, periodo = "", data, titulo = "", criterios = {}, participacao = null, gravadoPor }) {
  if (!FONTES[fonte]) throw new Error(`fonte inválida: ${fonte}`);
  if (!ref || !email || !turma || !unidade || !/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) throw new Error("evidência sem ref, email, turma, unidade ou data (AAAA-MM-DD)");
  for (const [id, c] of Object.entries(criterios)) {
    if (!/^[a-z]+\.cr\d{2,}$/.test(id)) throw new Error(`critério com ID inválido: ${id}`);
    if (c.valor != null && !(c.valor >= 0 && c.valor <= 1)) throw new Error(`valor fora de 0..1 em ${id}`);
  }
  const dados = { email: chaveEmail(email), uid, turma, turmaId, unidade, periodo, data, fonte, ref: String(ref), titulo, criterios, gravadoPor: gravadoPor || fonte };
  if (participacao) dados.participacao = participacao;
  return { id: idEvidencia(fonte, ref, email), dados };
}

// ---------- socioemocionais a partir da participação ----------
// Cada critério socioemocional pode ter extras.sinal no plano-ensino.js. Estes sinais viram evidência automática:
//   prazo     ← atividades entregues no prazo        tempo    ← presença/tempo nas aulas
//   busca     ← treinos feitos por conta própria     iniciativa ← atividades/treinos além do pedido
//   coopera   ← entregas em grupo (só avaliação em grupo)
// O resto das socioemocionais é observação do professor (na prova/atividade, pela rubrica).
export function sinaisDaParticipacao(evs) {
  const p = evs.filter(e => e.participacao);
  const aulas = p.filter(e => e.fonte === "aula"), ativ = p.filter(e => e.fonte === "atividade"), treinos = p.filter(e => e.fonte === "treino" || e.participacao?.espontaneo);
  const taxa = (l, f) => l.length ? l.filter(f).length / l.length : null;
  return {
    tempo: taxa(aulas, e => e.participacao.presente),
    prazo: taxa(ativ, e => e.participacao.entregue && e.participacao.noPrazo),
    busca: treinos.length ? Math.min(1, treinos.length / 5) : null,          // 5 treinos por conta própria = cheio
    iniciativa: treinos.length ? Math.min(1, treinos.filter(e => e.participacao.espontaneo).length / 3) : null,
    coopera: null
  };
}

// ---------- o cruzamento: situação de UM aluno em UM critério ----------
// evs = evidências do aluno (de todas as fontes) já filtradas pela unidade; devolve o resumo das 3 vertentes.
export function situacaoCriterio(evs, criterio) {
  const com = evs.filter(e => e.criterios && criterio in e.criterios).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const ult = f => [...com].reverse().find(e => e.fonte === f && e.criterios[criterio].valor != null);
  const aulas = com.filter(e => e.fonte === "aula");
  const praticas = com.filter(e => ["atividade", "treino", "simulado"].includes(e.fonte) && e.criterios[criterio].valor != null);
  const auto = ult("autoavaliacao"), prova = ult("prova");
  const r = {
    criterio,
    ensinado: aulas.length > 0,                                    // a turma teve aula com este critério
    participou: aulas.some(e => e.participacao?.presente) || praticas.length > 0,
    aulas: aulas.length, presencas: aulas.filter(e => e.participacao?.presente).length,
    pratica: praticas.length ? praticas.reduce((s, e) => s + e.criterios[criterio].valor, 0) / praticas.length : null,
    declarado: auto ? auto.criterios[criterio].valor : null,
    comprovado: prova ? prova.criterios[criterio].valor : null,
    atingido: prova ? prova.criterios[criterio].valor >= ATINGIDO : null
  };
  r.situacao = classificar(r);
  return r;
}
// situações (o que o professor faz com cada uma)
export const SITUACOES = {
  dominio:       { nome: "Domínio confirmado", acao: "Segue em frente." },
  ilusao:        { nome: "Ilusão de saber", acao: "Disse que sabe e não comprovou: mostrar o erro e reforçar o conteúdo." },
  subconfianca:  { nome: "Sabe e não acredita", acao: "Comprovou, mas disse que não sabe: trabalhar a confiança." },
  dificuldade:   { nome: "Dificuldade real", acao: "Não sabe e reconhece: reforço de conteúdo prioritário." },
  semAula:       { nome: "Cobrado sem aula", acao: "A prova cobrou um critério que a turma não teve em aula: rever o plano ou a prova." },
  ausente:       { nome: "Faltou às aulas do critério", acao: "Teve aula, mas o aluno não participou: recuperar o conteúdo antes de cobrar." },
  semDeclaracao: { nome: "Sem autoavaliação", acao: "Comprovado ou não, falta o aluno dizer como se sente: pedir a autoavaliação." },
  pendente:      { nome: "Ainda não avaliado", acao: "Sem prova deste critério ainda." }
};
export function classificar(r) {
  if (r.comprovado == null) return "pendente";
  if (!r.ensinado) return "semAula";
  if (!r.participou && !r.atingido) return "ausente";
  if (r.declarado == null) return "semDeclaracao";
  const sabe = r.declarado >= DECLAROU_SABER;
  return r.atingido ? (sabe ? "dominio" : "subconfianca") : (sabe ? "ilusao" : "dificuldade");
}
// boletim de um aluno numa unidade: todos os critérios com a situação
export const boletimAluno = (evs, criteriosIds) => criteriosIds.map(c => situacaoCriterio(evs, c));
