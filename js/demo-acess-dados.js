// Prova de DEMONSTRAÇÃO de acessibilidade: questões fixas e 3 perfis FICTÍCIOS (nenhum aluno real).
// Cada perfil tem o visual, as regras da prova e uma versão adaptada de cada questão, no mesmo formato
// que a IA/o professor gravam (montarDeOpcao em servidor/formatos.js). Nada daqui vai para o banco.

export const PROVA_DEMO = { titulo: "Banco de Dados — SQL básico (demonstração)", tempoMinutos: 30, vidas: 3 };

// questões originais (como estão no banco de questões)
export const QUESTOES_DEMO = [
  { id: "d1", tipo: "alternativa", enunciado: "Em SQL, qual comando é utilizado para recuperar (consultar) registros armazenados em uma ou mais tabelas do banco de dados?",
    alternativas: ["SELECT", "INSERT", "UPDATE", "DELETE", "DROP"], correta: 0,
    explicacao: "SELECT consulta (lê) os dados. INSERT inclui, UPDATE altera, DELETE apaga linhas e DROP apaga a estrutura." },
  { id: "d2", tipo: "alternativa", enunciado: "Considerando o modelo relacional, assinale a alternativa que define corretamente uma chave primária (PRIMARY KEY).",
    alternativas: ["Coluna que aceita valores repetidos para agrupar registros", "Coluna (ou conjunto de colunas) que identifica de forma única cada registro e não aceita valores nulos",
      "Coluna que faz referência à chave de outra tabela", "Índice usado apenas para ordenar consultas", "Restrição que define um valor padrão para a coluna"], correta: 1,
    explicacao: "A chave primária identifica cada linha: não repete e não pode ser nula. Quem aponta para outra tabela é a chave estrangeira." },
  { id: "d3", tipo: "alternativa", enunciado: "Em uma consulta SQL, qual é a ordem correta de escrita das cláusulas SELECT, WHERE, ORDER BY e FROM?",
    alternativas: ["FROM, SELECT, WHERE, ORDER BY", "SELECT, WHERE, FROM, ORDER BY", "SELECT, FROM, WHERE, ORDER BY", "SELECT, FROM, ORDER BY, WHERE", "WHERE, SELECT, FROM, ORDER BY"], correta: 2,
    explicacao: "Escreve-se: SELECT (o quê), FROM (de onde), WHERE (filtro) e ORDER BY (ordem)." },
  { id: "d4", tipo: "alternativa", enunciado: "Uma coluna precisa guardar nomes de alunos, que têm tamanhos diferentes. Qual tipo de dado é o mais adequado?",
    alternativas: ["INT", "DATE", "VARCHAR", "DECIMAL", "BOOLEAN"], correta: 2,
    explicacao: "VARCHAR guarda texto de tamanho variável. INT é número inteiro, DATE é data e DECIMAL é número com casas decimais." },
  { id: "d5", tipo: "dissertativa", enunciado: "Explique a diferença entre os comandos DELETE e DROP TABLE.",
    palavrasChave: ["delete", "drop", "tabela"], respostaModelo: "O DELETE apaga linhas (registros) e a tabela continua existindo; o DROP TABLE apaga a tabela inteira, com a estrutura e os dados.",
    explicacao: "DELETE remove registros; DROP TABLE remove a tabela toda." },
  { id: "d6", tipo: "alternativa", enunciado: "Qual comando concede (dá) a um usuário a permissão de executar SELECT em uma tabela?",
    alternativas: ["REVOKE", "GRANT", "COMMIT", "CREATE USER", "ALTER TABLE"], correta: 1,
    explicacao: "GRANT dá permissão; REVOKE tira a permissão." }
];

// perfis fictícios: visual + prova (mesmos campos de acessibilidade/{email}) + adaptações por questão
export const PERFIS_DEMO = [
  {
    id: "ana", nome: "Ana (fictícia)", resumo: "TEA (autismo), nível 1 de suporte", e: "🧩", cor: "#7c3aed",
    descricao: "Entende melhor instruções literais e uma coisa de cada vez. Fica ansiosa com o relógio e com textos longos; barulho e mudanças a desorganizam.",
    visual: { tema: "creme", linhaCurta: true, semAnimacao: true, linhas: 1.8 },
    prova: { tempoExtraMin: 15, semPunicao: true, ocultarCronometro: true, lerEmVoz: true, mostrarDica: true },
    adapta: {
      d1: { formato: "texto", enunciado: "Qual comando do SQL **mostra** (busca) os dados de uma tabela?", alternativas: ["SELECT", "INSERT", "UPDATE", "DELETE", "DROP"],
        apoios: ["SELECT vem de \"selecionar\": você escolhe o que quer VER."], motivo: "Linguagem literal e curta, sem termos como \"recuperar registros\"." },
      d2: { formato: "vf", enunciado: "Leia cada frase sobre a **chave primária** e marque V (verdadeiro) ou F (falso).",
        afirmacoes: [{ texto: "A chave primária identifica cada linha da tabela.", verdadeira: true }, { texto: "A chave primária pode ter valores repetidos.", verdadeira: false },
          { texto: "A chave primária não pode ficar vazia (nula).", verdadeira: true }],
        apoios: ["Pense no seu CPF: cada pessoa tem um diferente."], motivo: "Uma ideia por frase, sem precisar comparar 5 definições longas." },
      d3: { formato: "ordenar", enunciado: "Coloque as partes da consulta SQL na **ordem certa** (de cima para baixo).",
        passos: ["SELECT (o que mostrar)", "FROM (de qual tabela)", "WHERE (o filtro)", "ORDER BY (a ordem)"],
        apoios: ["Primeiro você diz O QUE quer, depois DE ONDE."], motivo: "Ordenar passos concretos em vez de comparar sequências parecidas." },
      d4: { formato: "ligar", enunciado: "Ligue cada **tipo de dado** ao que ele guarda.",
        pares: [{ esquerda: "INT", direita: "Número inteiro (ex.: 25)" }, { esquerda: "VARCHAR", direita: "Texto (ex.: um nome)" }, { esquerda: "DATE", direita: "Data (ex.: 05/11/2026)" }],
        apoios: ["VARCHAR = caracteres (letras)."], motivo: "Associação visual, com exemplos concretos." },
      d5: { formato: "etapas", enunciado: "Vamos responder em **duas partes**, uma de cada vez.",
        etapas: [{ pergunta: "O que o DELETE apaga?", alternativas: ["Só as linhas (os dados). A tabela continua.", "A tabela inteira."], correta: 0 },
          { pergunta: "O que o DROP TABLE apaga?", alternativas: ["Só algumas linhas.", "A tabela inteira, com tudo dentro."], correta: 1 }],
        apoios: ["DROP = derrubar: derruba a tabela inteira."], motivo: "Questão escrita dividida em etapas pequenas com poucas opções." },
      d6: { formato: "menosAlt", enunciado: "Qual comando **dá** permissão a um usuário?", alternativas: ["GRANT", "REVOKE", "COMMIT"], correta: 0,
        apoios: ["GRANT = garantir, dar."], motivo: "3 alternativas bem diferentes." }
    }
  },
  {
    id: "bruno", nome: "Bruno (fictício)", resumo: "Deficiência intelectual (DI)", e: "🌱", cor: "#059669",
    descricao: "Aprende com exemplos concretos e repetição. Lê devagar, se perde em enunciados longos e precisa de mais tempo e de apoio passo a passo.",
    visual: { escala: 125, fonte: "comic", linhas: 1.9, palavras: 0.1 },
    prova: { tempoExtraMin: 30, vidasExtras: 2, lerEmVoz: true, mostrarDica: true },
    adapta: {
      d1: { formato: "menosAlt", enunciado: "Qual comando **mostra** os dados da tabela?", alternativas: ["SELECT", "DELETE"], correta: 0,
        apoios: ["SELECT = selecionar = escolher para ver.", "DELETE = deletar = apagar."], motivo: "Só 2 alternativas, uma delas claramente oposta." },
      d2: { formato: "menosAlt", enunciado: "A **chave primária** é:", alternativas: ["Um número que não repete e identifica cada aluno (como a matrícula)", "Um campo que pode repetir"], correta: 0,
        apoios: ["Pense na sua matrícula: só você tem esse número."], motivo: "Exemplo do dia a dia (matrícula) e 2 opções." },
      d3: { formato: "ordenar", enunciado: "Coloque na **ordem certa**:", passos: ["SELECT nome", "FROM alunos", "WHERE idade > 18"],
        apoios: ["Comece pelo SELECT."], motivo: "Só 3 passos, com exemplo real de consulta." },
      d4: { formato: "ligar", enunciado: "**Ligue** o tipo ao exemplo:", pares: [{ esquerda: "INT", direita: "25" }, { esquerda: "VARCHAR", direita: "Maria" }, { esquerda: "DATE", direita: "05/11/2026" }],
        apoios: ["INT é número. VARCHAR é palavra. DATE é data."], motivo: "Exemplos concretos em vez de definições." },
      d5: { formato: "lacunas", enunciado: "**Complete** as frases com as palavras do quadro.",
        lacunas: { texto: "O [[DELETE]] apaga as linhas, mas a tabela continua. O [[DROP]] apaga a tabela inteira.", distratores: ["SELECT", "INSERT"] },
        apoios: ["DROP = derrubar tudo."], motivo: "Completar frases prontas em vez de escrever a explicação." },
      d6: { formato: "vf", enunciado: "Marque **V** ou **F**:", afirmacoes: [{ texto: "GRANT dá permissão.", verdadeira: true }, { texto: "REVOKE dá permissão.", verdadeira: false }],
        apoios: ["REVOKE = revogar = tirar."], motivo: "Duas frases curtas." }
    }
  },
  {
    id: "carla", nome: "Carla (fictícia)", resumo: "Baixa visão e dislexia", e: "🔎", cor: "#2563eb",
    descricao: "Precisa de letra grande, alto contraste e espaçamento; troca letras parecidas ao ler. Entende bem o conteúdo quando consegue ler ou ouvir com calma.",
    visual: { escala: 150, fonte: "lexend", tema: "contraste", letras: 0.05, palavras: 0.15, linhas: 2, regua: true },
    prova: { tempoExtraMin: 20, lerEmVoz: true, mostrarDica: true },
    adapta: {
      d1: { formato: "texto", enunciado: "Qual comando do SQL **busca** os dados de uma tabela?", alternativas: ["SELECT", "INSERT", "UPDATE", "DELETE", "DROP"],
        apoios: ["Use o 🔊 Ouvir para escutar as alternativas."], motivo: "Enunciado curto (menos leitura); mesmas alternativas." },
      d2: { formato: "menosAlt", enunciado: "O que é a **chave primária**?", alternativas: ["Identifica cada linha e não repete", "Aponta para outra tabela", "Define um valor padrão"], correta: 0,
        apoios: [], motivo: "3 alternativas curtas, menos texto para ler." },
      d3: { formato: "texto", enunciado: "Qual é a **ordem certa** das partes da consulta?", alternativas: ["FROM, SELECT, WHERE, ORDER BY", "SELECT, WHERE, FROM, ORDER BY", "SELECT, FROM, WHERE, ORDER BY", "SELECT, FROM, ORDER BY, WHERE", "WHERE, SELECT, FROM, ORDER BY"],
        apoios: ["Leia devagar: as opções são parecidas. A régua de leitura ajuda."], motivo: "Mesmo conteúdo; o visual (fonte, contraste, régua) faz a adaptação." },
      d4: { formato: "menosAlt", enunciado: "Qual tipo guarda **texto** (um nome)?", alternativas: ["VARCHAR", "INT", "DATE"], correta: 0, apoios: [], motivo: "Menos opções para comparar." },
      d5: { formato: "escritaApoio", enunciado: "Explique a diferença entre **DELETE** e **DROP TABLE**.", comecoResposta: "O DELETE apaga…",
        checklist: ["o que o DELETE apaga", "o que o DROP TABLE apaga", "se a tabela continua ou não"], apoios: [], motivo: "Resposta escrita com começo pronto e lista do que não pode faltar." },
      d6: { formato: "vf", enunciado: "Marque V ou F:", afirmacoes: [{ texto: "GRANT dá permissão.", verdadeira: true }, { texto: "REVOKE tira permissão.", verdadeira: true }, { texto: "COMMIT dá permissão.", verdadeira: false }],
        apoios: [], motivo: "Frases curtas, uma ideia por linha." }
    }
  }
];
