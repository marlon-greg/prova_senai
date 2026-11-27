# Pedido padrão: banco de 150 questões de UM tema (para agentes)

Você vai ESCREVER um banco de 150 questões novas para um sistema de provas do SENAI (curso técnico em Desenvolvimento de
Sistemas, alunos de 15 a 18 anos). Repositório: /mnt/d/DOCUMENTOS/GITHUB/prova_senai (WSL; não há node Linux: use
"/mnt/c/Program Files/nodejs/node.exe" rodando na pasta do repo, com caminhos relativos).

1. LEIA PRIMEIRO docs/PADRAO-QUESTOES.md (padrão obrigatório; dissertativa NUNCA pede para escrever comando/código nem
   desenhar — mostre o comando/código pronto e pergunte o que faz, por que, qual o risco, qual a diferença; termina com
   "Na sua resposta:\n1. …\n2. …").
2. Leia os bancos indicados no pedido só para NÃO repetir questões. Pode ler (sem copiar, sem alterar) os bancos teóricos da
   FATEC em ../FATEC_MATERIAIS_AULAS_ADS/netlify/bancos/ para ideias de estilo.
3. COMPOSIÇÃO: exatamente 150 questões: 105 alternativas + 45 dissertativas. Dificuldade: 60 facil, 60 media, 30 dificil.
   Todas com o "tema" EXATO do pedido, "revisao": "pendente", peso 1 (alternativa) / 2 (dissertativa), "capacidade" do
   pedido. Posição da correta equilibrada (0–3). Contextos variados (escola, padaria, clínica, oficina, academia, biblioteca,
   pet shop, cinema, hotel, loja de games…), sem marcas reais. Tabelas citadas descritas no enunciado. Cada questão cobra uma
   coisa diferente (variações só com "grupo" igual, no máximo 3 por grupo). A resposta certa não pode ser a mais longa de
   propósito.
4. ARQUIVO no formato:
   { "nome": "<Matéria> — <tema> (a revisar)", "materia": "<Matéria EXATA>", "revisao": "pendente", "versao": "2026-11-27",
     "contexto": "150 questões novas (105 alternativas + 45 dissertativas), padrão de 27/11.", "questoes": [ ... ] }
   Escreva em partes (3 × 50) numa pasta temporária ao lado do arquivo final (_tmp_<nome>/), junte com node e apague a pasta
   temporária no fim. JSON com 2 espaços.
5. VALIDE: "/mnt/c/Program Files/nodejs/node.exe" bancos/validar.mjs <arquivo> --tema "<tema>" --min 150 --contra <bancos do pedido, separados por vírgula>
   Corrija até "✔ sem erros" e com poucos avisos. Confira o conteúdo: cada correta certa de verdade, distratores errados de
   verdade. Não faça commit.
6. No fim, responda em português, curto: total por tipo e dificuldade, resultado do validador, 1 exemplo de cada tipo e o que
   você não tem certeza (para o professor conferir).
