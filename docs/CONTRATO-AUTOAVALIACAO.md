# Contrato: sistema de AUTOAVALIAÇÃO ↔ aulas e provas

> Para o colega que mantém o sistema de autoavaliação (já no ar, banco no **Supabase**). Decisões gerais em `docs/ECOSSISTEMA.md`.
> Fonte da verdade: repositório `prova_senai`.

## Resumo em 30 segundos

A autoavaliação **continua no Supabase, do jeito que está.** A ligação com os outros dois sistemas é automática, sem
exportar arquivo nenhum:

```
 Supabase (autoavaliação)                      Worker "prova-senai" (Cloudflare)              Firebase (aulas + provas)
 aluno responde ── Database Webhook (INSERT) ──▶ POST /integracao/autoavaliacao ──grava──▶ evidencias/autoavaliacao__…
 tela do professor ◀──────── JSON ─────────────── GET  /integracao/situacao     ◀──lê──── evidencias (aulas + provas)
```

1. **Ida (Supabase → nós):** um **Database Webhook** do Supabase, configurado no painel, sem escrever código. A cada
   resposta gravada, o Supabase avisa o Worker, e a resposta aparece na hora no boletim do sistema de provas e no
   sistema de aulas.
2. **Volta (nós → Supabase):** uma chamada `GET` devolve a situação de cada aluno em cada critério (ilusão de saber,
   dificuldade real…). A autoavaliação usa isso para direcionar as ações de recuperação.
3. **As perguntas** usam os critérios do plano de ensino, importados direto do site publicado (nada de copiar):
   `import { criteriosDaUnidade, criterioPorId } from "https://marlon-greg.github.io/prova_senai/js/plano-ensino.js"`.

## O que a autoavaliação precisa ter (o mínimo)

1. **E-mail institucional do aluno** em cada resposta (é a chave entre os sistemas; o aluno precisa estar numa turma do
   sistema de provas).
2. **Cada pergunta ligada a 1 critério** pelo código estável (`bd.cr33` etc.; lista em `plano-ensino.js`).
   Pode haver várias perguntas por critério (vale a última que chegar).
3. **Escala de 3 níveis:** `sim` = Consigo fazer · `parcial` = Consigo em parte · `nao` = Ainda não consigo.
   (A ponte também entende "Consigo em parte", "Ainda não consigo", `0/1/2` e `true/false`, mas prefira o texto.)
4. **Socioemocional junto:** pelo menos uma pergunta de critério socioemocional em cada autoavaliação.
5. Opcional: `turma` (1A, 1B…; se faltar, a ponte descobre pelo e-mail), `titulo`, `aula_id`, `atividade_id`.

## Ida: configurar o webhook (5 minutos, sem código)

No Supabase: **Database → Webhooks → Create a new hook**:
- **Table:** a tabela das respostas · **Events:** `Insert` (e `Update`, se o aluno puder mudar a resposta)
- **Type:** HTTP Request · **Method:** POST
- **URL:** `https://prova-senai.<conta>.workers.dev/integracao/autoavaliacao` (o professor passa o endereço exato)
- **HTTP Headers:** `x-chave` = a chave combinada com o professor (`Content-type: application/json` já vem)

A ponte aceita qualquer um destes formatos de linha (nomes de coluna alternativos entre parênteses):

```js
// A) uma linha por resposta (o mais comum)
{ email, criterio, nivel, autoavaliacao_id, created_at }
//   (email: aluno_email · criterio: criterio_id · nivel: resposta · autoavaliacao_id: avaliacao_id, formulario_id, sessao_id)
//   autoavaliacao_id junta as linhas da mesma autoavaliação; sem ele, junta pelo dia.
// B) uma linha por autoavaliação, com as respostas numa coluna JSON
{ id, email, respostas: [ { criterio: "bd.cr33", nivel: "parcial" }, … ], titulo, created_at }
```

Se preferir chamar pelo código (Edge Function), mande o mesmo JSON com `POST` e o cabeçalho `x-chave`.
Respostas: `200 { ok, id, criterios, ignorados }`; `400` sem resposta válida; `401` chave errada;
`422` e-mail fora das turmas.

## Volta: situação dos alunos

```
GET https://prova-senai.<conta>.workers.dev/integracao/situacao?unidade=bd&turma=1A[&email=aluno@…]
x-chave: <a mesma chave>
→ { unidade, turma, geradoEm, alunos: [ { email, criterios: { "bd.cr33": { situacao: "ilusao", nome: "Ilusão de saber",
     acao: "…", ensinado, participou, declarado, comprovado, atingido }, … } } ] }
```

Situações: `dominio`, `ilusao`, `subconfianca`, `dificuldade`, `semAula`, `ausente`, `semDeclaracao`, `pendente`
(descrição de cada uma em `SITUACOES`, `js/evidencias.js`).

**A chave é segredo.** Chame só de servidor (webhook ou Edge Function do Supabase), nunca do navegador do aluno.

## O que fica de cada lado

- **No Supabase (dele):** as respostas completas, os textos de dificuldade do aluno e as ações de recuperação.
- **No Firebase (nosso):** só a evidência resumida por aluno e critério (`evidencias/autoavaliacao__{ref}__{email}`,
  `origem: "supabase"`). É ela que entra no cruzamento com as aulas e as provas.
