# Contrato: AUTOAVALIAÇÃO (Stacktrace) ↔ sistema de provas

> **Decidido em 12/11/2026.** Substitui a versão anterior (Supabase + webhook, escala de 3 níveis): o sistema do colega
> é o Stacktrace, com API e banco próprios, e a integração é por **busca** (o Worker lê a API dele).
> O texto abaixo é o mesmo que foi enviado ao mantenedor para virar issues no repositório dele.

> **Para o Claude do terminal do mantenedor do Stacktrace.** Leia antes o `CLAUDE.md` e o `docs/ARQUITETURA.md` deste
> repositório. A tarefa é **só criar as issues** no GitHub (com `gh issue create`), uma por item abaixo, com título,
> descrição, critérios de aceite e os labels sugeridos. **Não implemente nada agora.**

## Contexto (por que isso existe)

O professor Marlon (colaborador deste repositório) usa três sistemas no curso Técnico em Desenvolvimento de Sistemas:

1. **Sistema de aulas** (Firebase): presença, participação e atividades **sem nota**.
2. **Stacktrace (este):** autoavaliação **Consigo / Não consigo** logo depois da aula, com pendências que o professor atende.
3. **Sistema de provas** (Firebase + Cloudflare Worker `prova-senai`): microsomativas **com nota**, corrigidas por critério.

O objetivo é que o professor e o coordenador vejam, **por aluno e por critério**, uma linha do tempo:
**teve a aula → apontou "Não consigo" → o professor atendeu (observação) → resultado na prova**. Isso mostra que a
dificuldade foi vista e tratada **antes** da prova.

**O Stacktrace não muda de papel nem de regras.** Ele continua sendo a autoavaliação, inteiro:
- a resposta é binária (RN01);
- não existe certo, errado ou nota (RN10);
- socioemocional não entra na autoavaliação (RN12);
- o professor só vê as próprias turmas (RN06).

A integração é **somente leitura, de dentro para fora**:
- o servidor do sistema de provas **busca** as respostas e as pendências por duas rotas novas, protegidas por uma chave;
- nada é gravado no Stacktrace por fora;
- nenhuma tela do Stacktrace muda;
- o comparativo com a prova aparece **só no sistema de provas** e **só para a equipe**: admin, professor, coordenador e auxiliar (o aluno não vê).

## Como os critérios se casam (sem mudar o banco)

O sistema de provas usa IDs `bd.cr01` … `bd.cr51` (critérios do plano de ensino de Banco de Dados).

O professor vai importar o arquivo `stacktrace-importacao-BD.json`, já no formato do `POST /importacao` deste sistema:
- UC `BD`;
- 13 capacidades técnicas;
- 39 critérios.

Cada critério entra com o **mesmo número que tem no plano**: o C25 entra como critério nº 25 da capacidade técnica 9.

Assim a chave natural deste sistema, (sigla da UC, tipo, nº da capacidade, nº do critério), vira o ID do outro lado
sem campo novo: `BD / TECNICA / 9 / 25` ↔ `bd.cr25`. Os critérios C40–C51 são socioemocionais e ficam de fora (RN12).

Para outras UCs vale a mesma regra: o número do critério é o número do plano de ensino.

---

## Issue 1 — Autenticação de integração por chave (servidor com servidor)

**Labels:** `integracao`, `api`, `seguranca`

- Nova variável de ambiente `INTEGRACAO_CHAVE` (texto longo e aleatório), documentada no `.env.example`. Se ela estiver vazia, as rotas `/integracao/*` respondem `503` (integração desligada).
- As rotas `/integracao/*` **não usam sessão do Better Auth**. Elas exigem o cabeçalho `x-chave` igual à `INTEGRACAO_CHAVE`:
  - a comparação é em **tempo constante** (`crypto.timingSafeEqual` sobre hashes);
  - chave errada ou ausente → `401` no formato `ErroResponse`.
- Escopo **somente leitura**: a chave não dá acesso a nenhuma outra rota.
- Logs: nunca registrar a chave. E-mails de alunos seguem a redação do Pino que já existe.
- Sugestão: um plugin/`preHandler` no módulo novo `apps/api/src/modules/integracao/`, seguindo as camadas routes/controller/service/repository.

**Aceite:**
- teste de integração com `app.inject()`: sem chave → 401; chave errada → 401; chave certa → 200; variável vazia → 503;
- `pnpm lint` e `pnpm typecheck` limpos.

## Issue 2 — `GET /integracao/respostas` (respostas da autoavaliação, incremental)

**Labels:** `integracao`, `api`

Query (schema Zod `ListarRespostasIntegracaoQuery` em `packages/contracts/src/integracao.schemas.ts`):
- `desde` (ISO 8601, opcional): devolve as respostas com `respondidoEm` **maior ou igual** a esta data;
- `depoisDe` (uuid, opcional): desempate do cursor;
- `limite` (1–1000, padrão 500).

Ordenação: `respondidoEm` crescente, depois `id` crescente.

Resposta (`RespostasIntegracaoResponse`):
```json
{
  "itens": [
    {
      "id": "uuid-da-resposta",
      "respondidoEm": "2026-11-17T10:02:00.000Z",
      "aluno": { "email": "aluno@exemplo" },
      "turma": { "id": "uuid", "nome": "DETS-I-1A-26CT-S" },
      "uc": { "sigla": "BD" },
      "capacidade": { "tipo": "TECNICA", "numero": 9 },
      "criterio": { "numero": 25, "texto": "…" },
      "resposta": "CONSIGO",
      "aplicacao": { "id": "uuid", "aulaId": "uuid-ou-null", "ativadaEm": "…" }
    }
  ],
  "proximo": { "desde": "…", "depoisDe": "uuid" }
}
```
`proximo` é `null` quando acabou.

Regras:
- **Só o e-mail** do aluno. Nada de nome nem de outros campos pessoais.
- Todas as turmas (é servidor com servidor; a RN06 vale para pessoas).
- A resposta continua **imutável** (RN03), então `respondidoEm` serve de marca d'água.
- Use TypedSQL ou uma consulta Prisma com `include` mínimo, no repository.

**Aceite:**
- testes com dados **fictícios**: paginação com `desde` + `depoisDe` sem perder nem repetir itens, `limite` respeitado e campos fora do schema nunca saem;
- a rota aparece no Swagger (`/docs`).

## Issue 3 — `GET /integracao/pendencias` (pendências e atendimento, incremental)

**Labels:** `integracao`, `api`, `banco`

- **Migration:** adicionar `atualizadoEm DateTime @updatedAt` em `Pendencia`, porque a pendência muda de ABERTA para ATENDIDA. Preencher as linhas que já existem com `coalesce(atendidoEm, criadoEm)`.
- Query: `desde` (sobre `atualizadoEm`), `depoisDe`, `limite` (iguais aos da Issue 2).
- Resposta (`PendenciasIntegracaoResponse`):
```json
{
  "itens": [
    {
      "id": "uuid",
      "aluno": { "email": "aluno@exemplo" },
      "uc": { "sigla": "BD" },
      "capacidade": { "tipo": "TECNICA", "numero": 9 },
      "criterio": { "numero": 25 },
      "aplicacaoId": "uuid",
      "status": "ATENDIDA",
      "criadoEm": "…",
      "atendidoEm": "…",
      "atualizadoEm": "…",
      "observacao": "texto que o professor registrou no atendimento"
    }
  ],
  "proximo": null
}
```
- A `observacao` vai junto porque é ela que mostra **o que o professor fez** para ajudar o aluno. Lá ela só aparece para a equipe.
- Não mudar nenhuma regra da pendência (RN05, RN09).

**Aceite:**
- teste: atender uma pendência faz ela voltar na próxima busca com `desde` = a última marca;
- migration aplicada no banco de teste;
- lint e typecheck limpos.

## Issue 4 — Importar a UC de Banco de Dados com a numeração do plano

**Labels:** `integracao`, `conteudo`

- Usar o `POST /importacao` que já existe, com o arquivo `stacktrace-importacao-BD.json` (o professor anexa à issue).
- Conferir no preview: 13 capacidades técnicas e 39 critérios (numeração de 1 a 39, igual ao plano).
- **Não renumerar.** O número do critério é a ponte com o sistema de provas.

**Aceite:** os critérios aparecem nas aplicações com o mesmo número do plano de ensino.

## Issue 5 — Publicar a API com HTTPS e passar o endereço ao professor

**Labels:** `integracao`, `infra`

- O servidor do sistema de provas (Cloudflare Worker) vai chamar `https://<api-do-stacktrace>/integracao/...` a cada 15 minutos. A API precisa estar publicada com HTTPS e responder sem cookie.
- O CORS não muda, porque a chamada vem de um servidor e não de um navegador.
- Combinar com o professor:
  - o valor da `INTEGRACAO_CHAVE` (o mesmo fica guardado como segredo na Cloudflare);
  - a URL pública da API.

## (Futuro, não criar agora como prioridade) Issue 6 — Mostrar ao professor o que aconteceu na prova

**Labels:** `integracao`, `futuro`

Na pendência ATENDIDA, mostrar ao professor/coordenador o resultado do aluno naquele critério na prova seguinte.
O dado vem de `GET https://<worker prova-senai>/integracao/situacao?unidade=bd&turma=1A&email=…` (com a mesma chave).
Só depois que as Issues 1–5 estiverem no ar. Respeitar a RN10: para o aluno, nenhuma linguagem de acerto ou nota.

---

### Resumo para o mantenedor

- **2 rotas de leitura** + 1 chave + 1 migration pequena + importar 1 arquivo.
- Nenhuma tela muda e nenhuma regra muda.
- O Stacktrace continua sendo **a** autoavaliação. O sistema de provas só lê.
