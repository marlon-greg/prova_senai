# Pedido: banco de 150 questões de um tema de qualquer matéria do plano (para agentes)

Siga docs/PEDIDO-BANCO-TEMA.md e docs/PADRAO-QUESTOES.md. Dados que o pedido do tema traz: matéria (nome EXATO do plano),
unidade (id no plano: lpa, req, proj, redes, so, front, mobile, iot, teste), tema (nome EXATO), conhecimentos (ids kN) e
arquivo de saída.

- CONTEÚDO: leia em js/plano-curso.js a unidade indicada: os conhecimentos do tema (ids kN.*) são o conteúdo; cubra todos
  os subitens, no nível do técnico (15–18 anos). Use exemplos do dia a dia do aluno e de pequenas empresas.
- CAPACIDADE: escolha para cada questão a capacidade técnica da unidade (ids <unidade>.ctN, mesmo arquivo) que ela avalia.
  Nunca invente id.
- Linguagem de código quando precisar: a mesma dos bancos existentes da matéria (bancos/gerados/banco_<unidade>.json — leia o
  "contexto" e algumas questões). Lógica (lpa): JavaScript/Node.js, como lá; Front-End: HTML/CSS/JavaScript; Mobile: o que o
  banco existente usar.
- Dissertativa NUNCA pede para escrever código/comando nem desenhar diagrama/quadro: mostre pronto e peça para explicar,
  interpretar, comparar, decidir, justificar.
- Para não repetir (--contra): bancos/gerados/banco_<unidade>.json (e, se existir, o banco "extra" da mesma matéria).
- Arquivo em bancos/gerados/<unidade>/<unidade>_NN_<slug>.json (crie a pasta se não existir); "nome":
  "<Matéria> — <tema> (a revisar)".
