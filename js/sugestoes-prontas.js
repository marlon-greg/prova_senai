// Respostas já escritas (Claude Code, 16/11/2026) para as 24 sugestões abertas até essa data.
// Na tela 💡 Sugestões elas aparecem no campo de resposta; o professor envia todas de uma vez (com confirmação) ou uma a uma.
// status: "feita" = aplicada (o aluno vê "✅ aplicada"); "analisada" = não aplicada (o aluno vê "não aplicada por enquanto").
// A chave é o começo do texto do aluno, sem acentos, maiúsculas e pontuação: vale a sugestão cujo texto começa com ela.
export const chaveSugestao = t => String(t || "").toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "").replace(/[^a-z0-9]+/g, "");

const MODO_ESCURO = { status: "analisada", resposta: "Obrigado pela ideia! O modo escuro não foi aplicado por enquanto. Ele ficou anotado para uma próxima versão do site." };
const FOTO_FUNDO = { status: "analisada", resposta: "Obrigado pela ideia! Por enquanto não dá para usar uma foto do computador no fundo do cartão, por isso não foi aplicada. A sugestão ficou anotada." };

const LISTA = [
  ["Boa tarde Dev!!! Só queria informar sobre a falta de um formato de rosto triangular", { status: "feita", resposta: "Feito! Agora existe o rosto triangular no editor do personagem. Obrigado pela sugestão!" }],
  ["Na parte de mudar o cartão poderia deixar adicionar uma já do computador", { status: "analisada", resposta: "Obrigado pela ideia! Não foi aplicada por enquanto: o fundo do cartão continua sendo escolhido entre as opções do site. A sugestão ficou anotada." }],
  ["Deixar o cabelo da raiz mais solta", { status: "feita", resposta: "Feito! Os cabelos ganharam volume na raiz e não ficam mais grudados na cabeça. Que bom que gostou do site!" }],
  ["Adicionar uma boca com a língua para fora", { status: "feita", resposta: "A boca com a língua para fora foi aplicada: agora ela é liberada para todos. A opção de tampar as orelhas não foi aplicada, mas entraram 3 orelhas novas: de abano, alongada e lóbulo grande." }],
  ["Boa tarde Dev!!! POr obséquio, poderia adicionar mais cores para a pele", { status: "feita", resposta: "Feito! Entraram 6 tons de pele novos no editor do personagem. Obrigado pela sugestão!" }],
  ["Opção de sair do mural", { status: "feita", resposta: "Feito! Agora existe o botão 🚪 Sair do mural." }],
  ["Algumas pupilas parecem estar", { status: "feita", resposta: "Corrigido! As pupilas agora ficam dentro do olho. Obrigado pelo aviso!" }],
  ["Modo escuro para os usuarios", MODO_ESCURO],
  ["Mostrar quem te enviou o coração e as palminhas", { status: "feita", resposta: "Feito! Na nova página Turma, cada publicação mostra quem curtiu e quem deu parabéns." }],
  ["Por opção, colocar os BOAS PRÁTICAS", { status: "analisada", resposta: "Obrigado pela ideia! Não foi aplicada por enquanto. A sugestão ficou anotada." }],
  ["Modo noturno para alguns usuários", MODO_ESCURO],
  ["O formato dos rostos estão um pouco errados", { status: "feita", resposta: "Corrigido! O rosto redondo agora é redondo de verdade. Obrigado pelo aviso!" }],
  ["Mais opções de cabelo", { status: "feita", resposta: "Feito! Entraram 8 cabelos novos: curtos, com franja, ondulados e cacheados." }],
  ["Como sugestão, acho que vc deveria implementar mais opções de modificações do rosto", { status: "feita", resposta: "Feito! Agora dá para escolher uma cor para o cabelo, outra para a sobrancelha e outra para a barba (o bigode faz parte da barba). Também entraram ajustes novos no rosto: orelha, queixo, boca, altura do nariz, sobrancelha e pescoço." }],
  ["O mural da sala não acompanha a skin atual", { status: "feita", resposta: "Corrigido! O mural agora mostra o personagem atual assim que você salva. Obrigado pelo aviso!" }],
  ["Seria bem interessante o site possuir a opção de fazer o upload", { status: "feita", resposta: "Obrigado pelo elogio! Parte da sugestão foi aplicada: entraram 8 cabelos novos (masculinos e femininos) e as skins prontas, que o professor cria e libera na aba ✨ Prontos do editor. O envio de imagem para o fundo do cartão e as roupas novas não foram aplicados por enquanto." }],
  ["Deixar escolher o o fundo com fotos de fora", FOTO_FUNDO],
  ["poder deixar o cabelo e a barba de cores diferentes", { status: "feita", resposta: "Feito! Agora o cabelo, a sobrancelha e a barba podem ter cores diferentes, e existe uma cor livre para escolher manualmente. A cor da listra da camisa não foi aplicada por enquanto." }],
  ["colocar opção de modo escuro no site", MODO_ESCURO],
  ["Erro no Mural da Turma", { status: "feita", resposta: "Corrigido! O erro do mural foi resolvido. Obrigado pelo aviso!" }],
  ["As fotos de fundo, dava pra salvar do próprio computador", FOTO_FUNDO],
  ["Mais variações de cabelo, como os mesmos cabelos que tem", { status: "feita", resposta: "Feito! Entraram cabelos ondulados e cacheados novos, entre eles o ondulado médio, um pouco mais longo que o chanel." }],
  ["Deixe eu deformar o rosto do bonequinho", { status: "feita", resposta: "Feito, em parte: agora dá para aumentar ou diminuir partes do rosto (orelha, queixo, boca, nariz, sobrancelha e pescoço). A variação é pequena, para o personagem não ficar estranho demais." }],
  ["Colocar opções de franja e mais opções de cabelo", { status: "feita", resposta: "Feito! Entraram cabelos curtos e com franja, inclusive para o personagem feminino." }]
];
export const SUGESTOES_PRONTAS = new Map(LISTA.map(([t, r]) => [chaveSugestao(t), r]));
export const respostaPronta = texto => { const k = chaveSugestao(texto); let melhor = null;
  for (const [c, r] of SUGESTOES_PRONTAS) if (k.startsWith(c) && (!melhor || c.length > melhor[0].length)) melhor = [c, r];
  return melhor ? melhor[1] : null; };
