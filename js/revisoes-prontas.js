// Análises já feitas (Claude Code, 16/11/2026) dos apontamentos abertos até essa data.
// Aparecem na tela Erros e sugestões como "sugestão" — nada é aplicado sem o professor confirmar.
// Depois da decisão, a análise usada fica gravada em revisoesQuestoes/{qid} e este arquivo deixa de ser lido para ela.
// correcao = { de, para }: trecho do enunciado atual que é trocado (o professor confere no texto antes de salvar).
const REPETIDA = {
  veredito: "semPonto",
  motivo: "A questão em si está certa. O aluno recebeu duas versões da MESMA pergunta, em contextos diferentes (questões irmãs). Isso não tira ponto de ninguém: cada versão vale por si. A causa era o sorteio, que não reconhecia a mesma pergunta quando o contexto mudava. O sorteio já foi corrigido e agora não junta mais essas versões na mesma prova.",
  respostaAluno: "Você tem razão: caíram duas versões da mesma pergunta, em contextos diferentes. A sua nota não mudou por causa disso, porque cada uma vale por si. Já corrigimos o sorteio para não acontecer de novo. Obrigado pelo aviso!",
  correcao: null
};
export const PRONTAS = {
  "7G5XdKJ1DJTtuez8zPJu_q068": {
    veredito: "parcial",
    motivo: "O enunciado pede \"filme texto obrigatório\", mas não diz o tamanho nem o tipo. Por isso, VARCHAR(n) com qualquer tamanho, CHAR(n) ou TEXT, sempre com NOT NULL, atendem ao pedido. Só foi prejudicado quem perdeu ponto POR CAUSA do tipo ou do tamanho do texto. Quem errou outra parte do CREATE TABLE (chave, DEFAULT, FOREIGN KEY) não ganha o ponto. Marque cada aluno olhando a resposta, ou peça à IA para analisar as respostas.",
    respostaAluno: "Boa observação! O enunciado não dizia o tamanho do texto, então qualquer VARCHAR(n), CHAR(n) ou TEXT com NOT NULL vale para o filme. Deixamos o enunciado mais claro: agora ele pede VARCHAR(100).",
    correcao: { de: "filme texto obrigatório", para: "filme VARCHAR(100) obrigatório" }
  },
  "7G5XdKJ1DJTtuez8zPJu_q042": {
    veredito: "semPonto",
    motivo: "O contexto mostra só as colunas das tabelas e nunca lista os índices. O nome do índice (idx_produto) e a tabela (encomenda) estão no próprio enunciado, então a questão podia ser respondida com DROP INDEX idx_produto ON encomenda;. Mesmo assim, dois alunos estranharam, então vale dizer no texto que o índice já existe.",
    respostaAluno: "Obrigado pelo aviso! O contexto mostra só as colunas das tabelas; os índices não aparecem nele. Por isso a questão dava o nome do índice, idx_produto, e ela podia ser respondida com DROP INDEX idx_produto ON encomenda;. Deixamos o texto mais claro, dizendo que o índice já existe.",
    correcao: { de: "Escreva o comando que apaga o índice idx_produto da tabela encomenda.", para: "O índice idx_produto já existe na coluna produto da tabela encomenda. Escreva o comando que apaga esse índice." }
  },
  "FXMXl66e8KNkvKnRXGuX_q098": {
    veredito: "semPonto",
    motivo: "Os usuários do MySQL não fazem parte do contexto, que só fala das tabelas. O nome do usuário (agente) está no enunciado, então DROP USER agente; era respondível. Vale só deixar claro que o usuário já existe.",
    respostaAluno: "Obrigado pelo aviso! O contexto fala só das tabelas; os usuários do MySQL não aparecem nele. O nome do usuário (agente) estava no enunciado, então a resposta era DROP USER agente;. Deixamos o texto mais claro, dizendo que esse usuário já existe.",
    correcao: { de: "Escreva o comando que apaga o usuário agente.", para: "O usuário agente já foi criado no MySQL. Escreva o comando que apaga esse usuário." }
  },
  "7G5XdKJ1DJTtuez8zPJu_q013": REPETIDA,
  "7G5XdKJ1DJTtuez8zPJu_q019": REPETIDA,
  "7G5XdKJ1DJTtuez8zPJu_q112": REPETIDA,
  "FXMXl66e8KNkvKnRXGuX_q099": { ...REPETIDA, motivo: "A questão está certa. O aluno recebeu outra versão da mesma pergunta, com o enunciado escrito de outro jeito e as mesmas alternativas (questões irmãs). Isso não tira ponto de ninguém. O sorteio já foi corrigido e agora reconhece as alternativas iguais mesmo quando o contexto muda." }
};
