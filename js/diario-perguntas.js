// Perguntas do diário da aluna (auxiliar de inclusão) e do comentário do professor.
// Ficam aqui, como dados, para o formulário, a leitura, os relatórios e a IA usarem o mesmo modelo.
// tipos: emoji (1–5 com carinhas) · escala (1–5 com rótulos) · escolha (uma opção) · chips (várias) · texto · estrelas (1–5) · materias
export const HUMOR = [
  { v: 1, e: "😢", r: "Muito mal" }, { v: 2, e: "😟", r: "Chateada" }, { v: 3, e: "😐", r: "Neutra" },
  { v: 4, e: "🙂", r: "Bem" }, { v: 5, e: "😄", r: "Muito bem" }
];
export const humorEmoji = v => HUMOR.find(h => h.v === Number(v))?.e || "";

export const SECOES_AUX = [
  { id: "humor", icone: "😊", titulo: "Humor e energia", cor: "#f59e0b", itens: [
    { id: "humorChegada", tipo: "emoji", rot: "Como ela chegou?", obrig: true },
    { id: "humorSaida", tipo: "emoji", rot: "Como ela saiu?", obrig: true },
    { id: "energia", tipo: "escolha", rot: "Energia / disposição", opcoes: [["baixa", "🪫 Baixa"], ["media", "🔋 Normal"], ["alta", "⚡ Alta"], ["agitada", "🌪 Agitada"]] },
    { id: "humorTexto", tipo: "texto", rot: "Algo marcou o humor dela hoje?", dica: "Ex.: chegou chateada por causa do ônibus e melhorou depois do intervalo." }
  ] },
  { id: "atividades", icone: "📚", titulo: "Atividades do dia", cor: "#2563eb", itens: [
    { id: "materias", tipo: "materias", rot: "Matérias e tópicos trabalhados", dica: "Toque na matéria e depois nos tópicos. Isso alimenta os relatórios por matéria e por tópico." },
    { id: "atividades", tipo: "texto", rot: "O que foi feito hoje?", obrig: true, dica: "As atividades, exercícios e como foram propostos." },
    { id: "compreensao", tipo: "escala", icone: "🧠", rot: "Compreensão do conteúdo", rotulos: ["Não entendeu", "Entendeu pouco", "Entendeu com ajuda", "Entendeu bem", "Dominou"] },
    { id: "autonomia", tipo: "escala", icone: "🦸", rot: "Autonomia nas atividades", rotulos: ["Ajuda o tempo todo", "Muita ajuda", "Alguma ajuda", "Pouca ajuda", "Fez sozinha"] },
    { id: "foco", tipo: "escala", icone: "🎯", rot: "Foco e atenção", rotulos: ["Muito disperso", "Disperso", "Oscilou", "Focado", "Muito focado"] }
  ] },
  { id: "convivencia", icone: "🤝", titulo: "Comportamento e convivência", cor: "#7c3aed", itens: [
    { id: "interacao", tipo: "chips", rot: "Com quem ela interagiu?", opcoes: ["Ficou mais sozinha", "Com a auxiliar", "Com colegas", "Com o professor", "Trabalhou em grupo"] },
    { id: "comunicacao", tipo: "escala", icone: "💬", rot: "Comunicação (pedir ajuda, se expressar)", rotulos: ["Não se comunicou", "Pouco", "Com incentivo", "Bem", "Muito bem"] },
    { id: "sobrecarga", tipo: "escolha", rot: "Teve sinais de sobrecarga ou crise?", opcoes: [["nao", "🟢 Não"], ["leve", "🟡 Leve"], ["sim", "🔴 Sim"]] },
    { id: "gatilhos", tipo: "chips", rot: "O que pode ter causado?", seCampo: ["sobrecarga", ["leve", "sim"]],
      opcoes: ["Barulho", "Mudança de rotina", "Cansaço", "Frustração com a atividade", "Muita gente / agitação", "Fome ou sono", "Cobrança / avaliação", "Não sei"] },
    { id: "comportamentoTexto", tipo: "texto", rot: "Como foi o comportamento e a convivência?", dica: "O que você observou: reações, combinados, como lidou com as situações." }
  ] },
  { id: "estrategias", icone: "🧩", titulo: "O que funcionou", cor: "#059669", itens: [
    { id: "estrategias", tipo: "chips", rot: "Estratégias que ajudaram hoje", opcoes: ["Instrução passo a passo", "Apoio visual / imagem", "Exemplo concreto", "Atividade dividida em partes",
      "Pausa / intervalo", "Ambiente calmo / fone", "Reforço positivo", "Tempo extra", "Leitura em voz alta", "Material adaptado", "Mediação da auxiliar", "Ajuda de colega"] },
    { id: "funcionou", tipo: "texto", rot: "O que funcionou bem?", dica: "Vale ouro para as próximas provas." },
    { id: "dificil", tipo: "texto", rot: "O que foi difícil?", dica: "Conteúdos, formatos de atividade ou situações." }
  ] },
  { id: "fechamento", icone: "🏆", titulo: "Fechamento do dia", cor: "#c1272d", itens: [
    { id: "estrelas", tipo: "estrelas", rot: "Como foi o dia, no geral?", obrig: true },
    { id: "conquista", tipo: "texto", rot: "🏆 Vitória do dia", dica: "Uma conquista, por menor que seja: ela merece ser lembrada." },
    { id: "paraProvas", tipo: "texto", rot: "📝 Dica para as próximas provas", dica: "Vai para a IA que adapta as provas dela. Ex.: entende melhor com tabela desenhada; trava com texto longo." },
    { id: "foraRotina", tipo: "texto", rot: "🩺 Algo fora da rotina?", dica: "Saúde, sono, medicação, família… Só a equipe vê." }
  ] }
];
export const ITENS_AUX = SECOES_AUX.flatMap(s => s.itens);

// comentário do professor no registro do dia: nada é obrigatório, mas precisa de pelo menos um campo
export const ITENS_PROF = [
  { id: "materia", tipo: "materia1", rot: "Sua matéria" },
  { id: "humorAula", tipo: "emoji", rot: "Como ela estava na sua aula?" },
  { id: "participacao", tipo: "escala", icone: "🙋", rot: "Participação", rotulos: ["Não participou", "Pouco", "Com incentivo", "Participou", "Participou muito"] },
  { id: "comentario", tipo: "texto", rot: "Seu comentário sobre o registro" },
  { id: "sugestao", tipo: "texto", rot: "Sugestão para a auxiliar ou para as próximas provas" }
];

// o item aparece? (ex.: "gatilhos" só com sobrecarga leve ou sim)
export const visivel = (it, r) => !it.seCampo || it.seCampo[1].includes(r?.[it.seCampo[0]]);
// respondido?
export function respondido(it, r) {
  const v = r?.[it.id];
  if (it.tipo === "materias") return Array.isArray(v) && v.length > 0;
  if (it.tipo === "chips") return Array.isArray(v) && v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== "";
}
// % do registro preenchido (só os itens visíveis)
export function completude(r) {
  const vis = ITENS_AUX.filter(it => visivel(it, r));
  return Math.round(vis.filter(it => respondido(it, r)).length / vis.length * 100);
}
