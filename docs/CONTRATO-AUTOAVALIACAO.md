# Contrato: sistema de AUTOAVALIAÇÃO ↔ aulas e provas

> Para o colega que está construindo o sistema de autoavaliação. Decisões gerais em `docs/ECOSSISTEMA.md`.
> Fonte da verdade: repositório `prova_senai` (caminho local do professor: `C:\Users\marli\Documents\github\prova_senai`).

## O que a autoavaliação é no ciclo

Depois da aula (ou de uma atividade formativa), o aluno diz se **consegue fazer** o que cada critério pede.
As perguntas cobrem os critérios **sem citar a capacidade** (o aluno não entende capacidades). O professor registra
**ações de recuperação** para os gaps: orientação, outra forma de explicar, divulgação de conteúdo (não é aula particular).
O sistema de provas depois **comprova ou não** cada critério e cruza com o que o aluno declarou.

## O que precisamos da autoavaliação (o mínimo)

1. **Mesmo login e mesmas turmas:** projeto Firebase `prova-senai-3e983` (aluno = mesmo `uid`/e-mail; turmas em `turmas/`).
2. **Cada pergunta ligada a 1 critério** pelo ID estável (`bd.cr25` etc., lista em `js/plano-ensino.js`).
   Pode haver várias perguntas por critério; o nível do critério é o pior/médio delas (decisão do sistema, documentada).
3. **Escala de 3 níveis** (igual nos três sistemas): `sim` = Consigo fazer · `parcial` = Consigo em parte · `nao` = Ainda não consigo.
4. **A que se refere:** a aula (`aulas/{id}` do sistema de aulas) ou a atividade, mais turma, unidade e data.
5. **Socioemocional junto:** pelo menos uma pergunta de critério socioemocional em cada autoavaliação.

## O que gravar

```js
// respostas completas (coleção da autoavaliação)
autoavaliacoes/{id} = {
  email, uid, turma: "1A", turmaId, unidade: "bd", periodo: "2026-2", data: "2026-11-17",
  aulaId: "…" | null, atividadeId: "…" | null,
  respostas: [ { pergunta: "Consigo juntar duas tabelas com INNER JOIN?", criterio: "bd.cr33", nivel: "parcial" }, … ],
  dificuldade: "texto livre do aluno",
  enviadaEm: serverTimestamp()
}
// evidência resumida (contrato comum: js/evidencias.js → montarEvidencia({ fonte: "autoavaliacao", … }))
evidencias/autoavaliacao__{id}__{email} = {
  email, uid, turma, turmaId, unidade, periodo, data, fonte: "autoavaliacao", ref: id, titulo: "Autoavaliação — JOINs",
  criterios: { "bd.cr33": { valor: 0.5, nivel: "parcial" }, "bd.cr43": { valor: 1, nivel: "sim" } },
  gravadoPor: "autoavaliacao"
}
// ações de recuperação do professor
recuperacoes/{id} = { turmaId, turma, unidade, criterios: ["bd.cr33"], alunos: [emails] | [], tipo: "orientacao" | "explicacao" | "conteudo",
  texto, link?, criadaPor, criadaEm }
```

As regras já estão publicadas no `firestore.rules` (seção `>>> AUTOAVALIACAO`):
- o aluno grava só a própria autoavaliação;
- a equipe lê tudo;
- o professor grava as recuperações.

## O que a autoavaliação recebe dos outros

- **Das aulas:** quais critérios a aula trabalhou (`aulas/{id}.criterios`) → é daí que saem as perguntas do dia.
- **Das provas:** a situação de cada aluno em cada critério (`situacaoCriterio` em `js/evidencias.js`): ilusão de saber,
  dificuldade real etc. Com isso as ações de recuperação vão direto para quem precisa.

## Vínculo real, sem exportar nada

Os três sistemas leem e gravam no **mesmo banco**, em tempo real. O aluno responde a autoavaliação e, no mesmo instante,
ela já aparece no boletim do sistema de provas e no painel das aulas. **Não existe exportação, importação nem planilha
intermediária.** Por isso, usar o projeto Firebase `prova-senai-3e983` é condição, não opção.

Os critérios também não são copiados: importe direto do site publicado,
`import { criteriosDaUnidade, criterioPorId } from "https://marlon-greg.github.io/prova_senai/js/plano-ensino.js"` e
`import { montarEvidencia, idEvidencia } from "https://marlon-greg.github.io/prova_senai/js/evidencias.js"`.
