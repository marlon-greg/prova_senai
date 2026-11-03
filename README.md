# Prova Online — SENAI (Firebase + GitHub Pages)

Sistema de prova prática: o aluno entra com a conta Google do SENAI, recebe **10 questões sorteadas** de um banco maior, responde (uma por vez ou todas na página, com ou sem **ir e voltar**, sem colar), vê no fim só **quantas acertou e a nota**, e o professor corrige as dissertativas (à mão ou pela **IA**), fecha as notas, gera o gabarito para o Classroom e libera o gabarito com a explicação de cada erro.

| Arquivo | O que é |
|---|---|
| `index.html` + `js/aluno.js` | página do aluno |
| `admin.html` + `js/admin.js` | painel do professor |
| `js/common.js` | login, correção automática, utilidades |
| `js/firebase-config.js` | **onde você cola a configuração do seu Firebase** |
| `firestore.rules` | regras de segurança (cole no Firebase) |
| `modelo_banco.json` | modelo de banco de questões (já vem com 16 questões de DML) |
| `firebase.json` / `.firebaserc` | só para quem quiser rodar o emulador local (opcional) |

---

## Passo a passo (uma vez só, ~15 min)

### 1. Firebase — criar o projeto
1. Acesse https://console.firebase.google.com → **Adicionar projeto** → nome `prova-senai` → pode desligar o Analytics → Criar.
2. Menu **Build → Authentication → Começar** → aba **Sign-in method** → **Google** → Ativar → escolha o e-mail de suporte → Salvar.
3. Ainda em Authentication → aba **Settings → Authorized domains → Add domain** → adicione `SEU-USUARIO.github.io` (o domínio do seu GitHub Pages, sem `https://`).
4. Menu **Build → Firestore Database → Criar banco de dados** → local `southamerica-east1 (São Paulo)` → **modo de produção** → Criar.
5. Aba **Regras** do Firestore → apague tudo → cole o conteúdo de `firestore.rules` → **Publicar**.
6. Engrenagem ⚙ → **Configurações do projeto** → role até **Seus apps** → ícone **`</>` (Web)** → apelido `prova-senai` → **não** marque Hosting → Registrar app → copie o objeto `firebaseConfig`.
7. Abra `js/firebase-config.js` e cole o objeto no lugar do que está lá. Confira que `SUPER_ADMIN` é o seu e-mail (`marlon.frodrigues@docente.senai.br`).

### 2. GitHub — publicar
1. Crie um repositório (ex.: `prova-senai`), **público**.
2. Suba todos os arquivos desta pasta (arraste no site do GitHub ou `git push`).
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/(root)` → Save.**
4. Em 1–2 min o site fica em `https://SEU-USUARIO.github.io/prova-senai/`.
   - Aluno: `https://SEU-USUARIO.github.io/prova-senai/`
   - Professor: `https://SEU-USUARIO.github.io/prova-senai/admin.html`

### 3. Primeiro acesso
1. Abra `admin.html` e entre com `marlon.frodrigues@docente.senai.br`. O sistema cria a configuração inicial sozinho (domínios `edu.senai.br` e `aluno.senai.br`).
2. Aba **Equipe**: cadastre outros professores (`professor`), coordenação (`admin`) ou apoio (`auxiliar`, só vê resultados — ex.: acompanhante de aluno com TEA).
3. Aba **Bancos de questões**: cole o conteúdo de `modelo_banco.json` → **Validar** → **Importar**.
4. Aba **Provas**: crie a prova (título, turma, banco, **temas**, quantas **alternativas** e quantas **dissertativas**, se pode **ir e voltar**) → ela nasce **fechada**.

---

## No dia da prova

| Quando | O quê |
|---|---|
| Antes | Aba Provas → **Liberar prova** |
| Durante | Aluno abre o link, entra com `@edu.senai.br` ou `@aluno.senai.br`, clica **Fazer a prova** |
| Depois | Aba Provas → **Encerrar** (quem não começou não consegue mais) |

Regras que o sistema aplica sozinho:
- **Uma tentativa por aluno** (ID da tentativa = aluno + prova). Para deixar alguém refazer, o admin apaga a tentativa em Resultados (botão ↺) e o aluno recebe um sorteio novo.
- **Questões sorteadas, com a ordem das questões e das alternativas embaralhada** para cada aluno (sempre ligado; a ordem não muda se ele recarregar a página).
- **Sem ir e voltar** (padrão): a resposta é gravada ao clicar em Enviar e não pode ser alterada. **Com ir e voltar** (opção da prova): o aluno navega entre as questões e altera as respostas até clicar em **Finalizar prova**.
- **Nenhum feedback durante a prova**: o aluno não sabe se acertou cada questão.
- **Colar desativado** nos campos de texto (Ctrl+V, botão direito, arrastar).
- **Tela cheia, trocas de aba e tentativas de colar** são registradas e aparecem para o professor (veja [Antifraude](#antifraude)).
- Se a aba fechar, o aluno entra de novo e **continua de onde parou**.
- O aluno só consegue ler a resposta certa **depois de finalizar a prova** (regra do Firestore, não só da tela).
- **Ao finalizar, o aluno vê só "Você acertou X de N" e a nota (0–100)**, sem saber quais acertou. Dissertativas ainda sem correção aparecem como "N respostas escritas ainda vão ser corrigidas; o total pode mudar", e a tela **atualiza sozinha** quando você corrige (pela IA ou à mão). A lista de provas mostra o mesmo placar.

## Depois da prova — corrigir e divulgar

1. Aba **Resultados** → escolha a prova → **Carregar**.
2. Alternativas são corrigidas sozinhas. Dissertativas que o sistema reconheceu (respostas aceitas / palavras-chave) também. As que ele não reconheceu ficam como **revisar**: clique em **🤖 Corrigir dissertativas com IA** (veja [Correção por IA](#correção-das-dissertativas-por-ia)) ou clique em **Ver** no aluno, dê os pontos e um comentário → **Salvar**. A cada correção o painel atualiza o placar que o aluno vê.
3. **Fechar notas** grava a nota final (0–100) em cada tentativa; ela substitui a nota prévia na tela do aluno.
   Exportações: **CSV** (planilha) · **PDF — notas da turma** (lista) · **PDF — boletim de todos** (um boletim por aluno, com resposta, correta e explicação, pronto para subir no Drive) · **PDF deste aluno** (dentro do Ver). Os PDFs abrem a janela de impressão do navegador: escolha *Salvar como PDF*.
4. Aba **Bancos → Gabarito p/ Classroom**: gera o texto com todas as questões, respostas e explicações → copie e poste no Classroom.
5. Aba **Provas → Liberar gabarito/resultado**: o aluno passa a ver, questão por questão, o que respondeu, o que era o certo, **por quê**, o comentário do professor, e ganha o botão **Baixar PDF da minha prova**. Sem liberar, ele vê só quantas acertou e a nota. **Ocultar gabarito** volta atrás.

---

## Correção das dissertativas por IA

A correção usa a API da Anthropic (Claude) e roda **no navegador do administrador principal**, no painel aberto. Não precisa de servidor nem do plano pago do Firebase.

**A chave nunca vaza:**
- fica no documento `config/ia` do Firestore, que as regras deixam ler e gravar **só** com a conta do administrador principal (o e-mail fixo nas regras). Outros admins, professores e alunos recebem "sem permissão";
- não está no repositório, nem no `js/firebase-config.js`, nem na página do aluno;
- a seção **Correção por IA** e os botões só aparecem para o administrador principal; depois de salva, a tela mostra só os 8 últimos caracteres;
- do seu navegador ela só vai para `api.anthropic.com`.

**Configurar (uma vez):**
1. Entre em <https://console.anthropic.com> com a sua conta (crie se precisar) → **Billing**: adicione crédito (US$ 5 rende muitas provas).
2. **Settings → Limits**: defina um **limite de gasto mensal** baixo (ex.: US$ 5). Se a chave vazar, o prejuízo fica limitado.
3. **API Keys → Create Key**: dê um nome (ex.: `prova-senai`) e copie a chave (`sk-ant-…`). Ela só aparece uma vez.
4. No painel: **Configuração → Correção por IA** → cole a chave → **Testar chave** → **Salvar**.
5. Publique o `firestore.rules` atual no Firebase Console (a regra de `config/ia` está nele).

**Usar:** aba **Resultados** → carregue a prova → **🤖 Corrigir dissertativas com IA** (barra de progresso; pula as já corrigidas; marque *Refazer as que a IA já corrigiu* para corrigir de novo). Ou marque **Corrigir automaticamente ao vivo**: cada prova finalizada é corrigida assim que chega, uma chamada por vez, enquanto o painel estiver aberto.
- A correção manual nunca é sobrescrita pela IA; a sua correção manual depois substitui a da IA.
- No detalhe do aluno, as notas dadas pela IA têm a tag **🤖 IA**, com a justificativa no comentário. **A IA pode errar: confira.**
- Erros (chave inválida, sem crédito, limite, sobrecarga) aparecem em português; limite e sobrecarga são tentados de novo sozinhos até 3 vezes.

**Modelo e custo aproximado** (escolha em Configuração → Correção por IA → Modelo; cada resposta usa ~1.000–2.000 tokens):

| Modelo | Preço (milhão de tokens, entrada / saída) | Por resposta | Turma de 30 alunos × 3 dissertativas |
|---|---|---|---|
| Claude Sonnet 5.5 (mais criterioso) | US$ 2 / US$ 10 | ≈ US$ 0,01 | ≈ US$ 1 |
| Claude Opus 5.5 (o mais criterioso) | US$ 4 / US$ 20 | ≈ US$ 0,02 | ≈ US$ 2 |
| **Claude Haiku 5.5** (padrão, o mais barato) | US$ 0,10 / US$ 0,50 | ≈ US$ 0,001 | menos de US$ 0,10 |

Com Sonnet e Opus, se o filtro de segurança da API recusar uma resposta, ela é refeita sozinha em outro modelo.

**Trocar ou revogar a chave:** **Apagar chave** no painel e, para invalidar de vez, apague-a também em console.anthropic.com → API Keys.

---

## Várias matérias e várias provas
Cada **banco** tem um campo `materia`, e cada questão pode ter um `tema`. Dá para ter um banco por matéria (DML, Normalização, Front-End, IoT…) ou um banco grande dividido em temas, e criar quantas provas quiser apontando para o banco certo. Um banco pode servir a várias provas (1A e 1B, por exemplo) — o sorteio é diferente para cada aluno.

### Filtrar a prova por tema
- Ao importar, a aba **Bancos** mostra os temas de cada banco com a contagem por tipo (ex.: *DCL - permissoes: 10 alternativa, 7 dissertativa*).
- Em **Nova prova**, ao escolher o banco aparecem os temas com caixas de seleção (todos marcados) e a quantidade de questões de cada um. Desmarque os temas que ainda não foram dados. O resumo embaixo mostra, ao vivo, quantas questões ficam disponíveis.
- **Alternativas por aluno** e **Dissertativas por aluno** são dois campos separados; o total aparece embaixo (ex.: 7 + 3 = 10 questões). Com 0 dissertativas, a prova sai só com alternativas (e vice-versa).
- O sistema **não deixa criar** a prova se os temas marcados não tiverem questões suficientes de cada tipo.
- O sorteio de cada aluno usa só as questões dos temas marcados, com exatamente a quantidade escolhida de cada tipo. Provas antigas (criadas com "questões por aluno" + "dissertativas", em que 0 dissertativas era sorteio livre) continuam sorteando como antes. A tabela de provas mostra os temas de cada prova ("todos" quando nenhum foi desmarcado).
- O **Gabarito p/ Classroom** sai agrupado por tema, com caixas para gerar só dos temas que a prova usou.

## Quem pode fazer cada prova: turmas e código de acesso

Os dois jeitos podem ser usados juntos.

### Turmas
Aba **Turmas** → dê um nome (ex.: `DETS-1A-26CT-S`) e cole os alunos, **um por linha**, de qualquer destes jeitos:

```
Maria Eduarda da Silva Souza                      ← só o nome completo
João Pedro Lima <joao.lima@edu.senai.br>          ← nome + e-mail
ana.costa@edu.senai.br                            ← só o e-mail
```

Dá para colar direto da planilha (coluna de nome e coluna de e-mail). Numeração no começo da linha ("12.") é ignorada. Uma linha com vários e-mails (lista antiga separada por vírgula) vira um aluno por e-mail.

**Aluno cadastrado só pelo nome:** no primeiro login, o sistema compara o **nome da conta Google** com a lista — sem diferenciar maiúsculas, acentos, hífens e espaços extras ("JOSÉ  da Silva" = "Jose da silva") — e, se bater, grava o e-mail dele na turma sozinho. A partir daí vale como se você tivesse digitado o e-mail.
- O nome precisa ser **completo e igual** ao da conta (nome abreviado ou faltando um sobrenome não bate). Quando não bate, o aluno não vê a prova e a tela mostra o nome e o e-mail da conta dele: escreva o e-mail na linha do aluno (**✎ Editar**) e salve.
- Dois alunos com **o mesmo nome**: o sistema não deixa salvar sem o e-mail de cada um.
- Cada nome só pode ser vinculado **uma vez**. Se outra conta com o mesmo nome entrou antes, o aluno vê o aviso "já foi vinculado a outra conta"; corrija em **✎ Editar** (o vínculo aparece como `Nome <e-mail>` e pode ser trocado).
- As regras do Firestore garantem que o aluno só vincula **o próprio nome ao próprio e-mail**, sem conseguir mexer no resto da turma.
- Na lista de turmas, **ver alunos** mostra ✅ quem já tem e-mail (e "vinculado no login") e ⏳ quem ainda não entrou.

**✎ Editar** reabre a lista para incluir ou tirar alunos; **🗑 Apagar** (só admin).

Na prova, escolha a turma no campo **Turma** (ou *— sem turma (qualquer aluno) —*). Com turma:
- o aluno **só vê a prova na lista** se o e-mail dele estiver na turma;
- as **regras do Firestore** recusam a tentativa de quem não está na lista, mesmo que tente pelo console do navegador;
- em **Resultados** aparece a seção **Não fizeram**, com quem está na turma e não começou a prova (incluindo quem ainda nem entrou no sistema).

Provas antigas, com a turma escrita como texto, continuam funcionando como "qualquer aluno" e mantêm o nome.

### Código de acesso
Campo **Código de acesso** na prova (botão **Gerar** cria algo como `AET-7K3Q`; o código aparece na tabela de provas). O aluno precisa digitar o código na tela de instruções antes de **Começar a prova** (maiúsculas e espaços são ajustados sozinhos); código errado mostra *"Código incorreto"*. Serve para garantir que quem começa está na sala: **informe o código só na hora**.

> O código fica no documento da prova, que o aluno consegue ler. Um aluno com conhecimento técnico pode descobri-lo pelo navegador. A barreira forte é a **turma**; o código é uma camada a mais.

O **modo teste** da equipe ignora turma e código. Turma e código podem ser trocados a qualquer momento em **✎ Editar**.

## Opções de cada prova

Definidas em **Nova prova** e alteráveis depois pelo botão **✎ Editar** na tabela "Provas criadas". A tela de instruções do aluno lista só as regras que valem para aquela prova.

| Opção | Padrão | O que faz |
|---|---|---|
| **Exibição das questões** (`modoExibicao`) | uma por vez | **Uma por vez** ou **Todas na mesma página** (em sequência, cada uma com seu botão; o topo mostra "Enviadas: X de 10"; *Finalizar prova* avisa quais faltam). |
| **Permitir ir e voltar** (`permitirVoltar`) | não | **Não**: a resposta enviada fica travada (uma por vez: só então aparece a próxima). **Sim**: botões **← Anterior / Próxima →** e os números das questões no topo (verde = respondida); o botão vira **Salvar resposta** e pode ser usado várias vezes (ao trocar de questão, salva sozinho); só **Finalizar prova** trava tudo. Ao recarregar, volta na questão em que estava. Com ir e voltar, "perder a questão" não existe: ao atingir o limite de saídas a prova é encerrada. |
| **Permitir trocar de aba/janela** (`permitirTrocaAba`) | não | Não pede tela cheia e não mostra o aviso ao trocar de aba. As trocas continuam contadas e aparecem em **cinza, "permitido"**, em Resultados (a linha não fica amarela). |
| **Permitir colar** (`permitirColar`) | não | Libera colar e arrastar nos campos de resposta e não registra tentativas de colar. Copiar o enunciado continua bloqueado. |
| **Material de consulta** (`materialConsultaTitulo`, `materiaisConsultaIds` ou `materialConsultaUrl`) | nenhum | Um ou **vários PDFs enviados ao sistema** (recomendado) ou um link. Mostra o material **dentro da tela da prova**: no computador, numa coluna à direita; o aluno muda o espaço dos slides × questões **arrastando a barra entre os dois** (ou pelos botões **◀ Ampliar / Reduzir ▶** e as setas do teclado com a barra selecionada), e a largura fica guardada no navegador dele; no celular, pelo botão **📖 Consulta**, numa gaveta por cima da questão. Clicar no material não conta como troca de aba. |

### Limite de saídas da prova
Em **Regras da prova**, só quando a troca de aba **não** é permitida:

| Campo | Padrão | O que faz |
|---|---|---|
| **Limite de saídas** (`maxTrocasDeAba`) | 0 (sem limite) | Quantas vezes o aluno pode sair da prova. Conta como saída **trocar de aba/janela ou sair da tela cheia** (um único contador; dois avisos do mesmo movimento, em menos de 1 s, contam uma vez). A cada saída, o aviso mostra o placar: *"Saídas da prova: 2 de 3. Na próxima, …"*. |
| **Ao atingir o limite** (`acaoAoExceder`) | encerrar | **Encerrar a prova**: finaliza na hora (`encerradaPor: "trocasDeAba"`); as questões não enviadas valem zero e o aluno vê *"Prova encerrada: limite de saídas da prova atingido"*. **Perder a questão atual** (só em "uma por vez"): a questão vira **⛔ perdida (saiu da prova)**, vale zero, o contador volta a zero (o total fica em `trocasDeAbaTotal`) e a prova avança; se a questão atual já tinha sido enviada, perde a próxima; na última questão, a prova é finalizada. Com "todas na página", a opção é sempre encerrar. |

Em **Resultados** aparecem as saídas com o limite (ex.: 🚪 3/3), o motivo do encerramento e as questões perdidas (também no detalhe, no CSV e nos PDFs).

**Editar uma prova:** depois que algum aluno começou (tentativas de teste não contam), **banco, número de questões, dissertativas e temas ficam travados**, porque mudariam o sorteio de quem já começou e a correção. Título, turma, tempo e as opções acima podem mudar a qualquer momento.

### Slides em PDF (recomendado)
Use **PDF**, não PPT/PPTX: o navegador não abre arquivo do PowerPoint sozinho, e o PDF mantém o visual de cada slide igual em qualquer computador ou celular. Para gerar: **PowerPoint → Arquivo → Exportar → Criar PDF** (ou *Salvar como → PDF*); **Google Slides → Arquivo → Fazer download → PDF**. Animações e vídeos não vão para o PDF.

1. Aba **Bancos → Slides e material de consulta (PDF)**: título + arquivo → **Enviar PDF** (ou, no formulário da prova, **⬆ Enviar PDF(s)**, que aceita **vários arquivos de uma vez**; cada um recebe o nome do arquivo como título e já entra marcado).
2. Na prova, em **Material de consulta**, **marque um ou vários PDFs** (ex.: as 3 aulas do tema). **👁** abre cada PDF exatamente como o aluno vai ver. As abas aparecem em ordem pelo título ("Aula 2" antes de "Aula 10"), então dê títulos com número.
3. Na prova, o aluno vê os slides num **leitor dentro da própria tela** (coluna à direita; no celular, botão **📖 Consulta**): com mais de um PDF, ele troca pelas **abas no topo do painel**, e cada PDF volta na página em que ele parou. ◀ ▶ para passar, número da página, zoom − / + e ⤢ para ajustar à largura, e **🖱 Zoom na roda** (liga/desliga: com ele ligado, a roda do mouse aumenta e diminui o slide; desligado, a roda rola o slide; Ctrl + roda sempre dá zoom no slide); com o leitor selecionado, as setas do teclado também passam os slides. Só o PDF aberto é baixado (os outros, quando ele clicar). Como não sai da página, mexer no leitor não conta como troca de aba.

Limite de **20 MB** por arquivo (acima disso o envio é recusado com aviso; o envio mostra a barra de progresso). O PDF fica guardado no próprio Firestore, em pedaços de ~900 KB (funciona no plano gratuito do Firebase, que não inclui o Storage). Cada aluno baixa o arquivo uma vez por prova; para economizar, prefira PDFs menores (PowerPoint: *Exportar → PDF → Tamanho mínimo*). PDFs que nenhuma prova usa podem ser apagados na mesma aba (🗑).

> Faça a atualização das **regras do Firestore** (copie de novo o `firestore.rules` e publique): elas liberam a leitura dos PDFs para alunos e o vínculo da turma pelo nome.

### Como obter o link do material de consulta
- **PDF ou arquivo no Google Drive:** botão direito no arquivo → **Compartilhar** → em "Acesso geral" escolha **Qualquer pessoa com o link** → **Copiar link**.
- **Google Slides:** **Arquivo → Compartilhar → Publicar na web** → **Publicar** → copie o link. (Um link de edição também funciona, desde que o acesso seja "Qualquer pessoa com o link".)
- **Google Docs:** Compartilhar → Qualquer pessoa com o link → Copiar link.

Cole o link no campo. O sistema converte sozinho para o formato que abre dentro da prova (Drive → `/preview`, Slides → `/embed`, Docs → `/preview`) e mostra a prévia antes de salvar. Outros sites ficam como estão, mas muitos **não deixam ser abertos dentro de outra página**; nesse caso o aluno vê "Não foi possível carregar o material; avise o professor". Use sempre um link `https://` e teste com **Testar como aluno** antes da prova.

## Formato do banco de questões (JSON)

```json
{
  "nome": "MS5 — DML",
  "materia": "Banco de Dados",
  "questoes": [
    { "tipo": "alternativa", "tema": "DML - UPDATE", "enunciado": "Pergunta...", "alternativas": ["a", "b", "c", "d"],
      "correta": 1, "explicacao": "Por que a b é a certa", "peso": 1 },
    { "tipo": "dissertativa", "tema": "DML - SELECT", "enunciado": "Escreva o comando...",
      "respostasAceitas": ["SELECT COUNT(*) FROM personagem;"],
      "palavrasChave": ["select count(*)", "from personagem"],
      "explicacao": "...", "peso": 2 },
    { "tipo": "dissertativa", "enunciado": "Explique em 2 linhas...", "correcaoManual": true,
      "explicacao": "O que se espera (vai para o aluno no resultado)", "peso": 2 }
  ]
}
```

| Campo | Observação |
|---|---|
| `correta` | índice da alternativa certa: **0 = primeira**, 1 = segunda… |
| `respostasAceitas` | lista de respostas exatas. A comparação ignora maiúsculas, espaços extras, espaços perto de `( ) , = ;` e o `;` final. Coloque as variações válidas (ex.: colunas em outra ordem). |
| `palavrasChave` | se a resposta não bater com nenhuma aceita, o sistema confere se **todas** as palavras-chave aparecem (mesma normalização). É mais tolerante; use trechos bem específicos. |
| `correcaoManual: true` | sem correção automática: vai direto para **revisar**. Use em perguntas de "explique". |
| `peso` | pontos da questão (padrão 1). A nota final é convertida para 0–100. |
| `tema` | **opcional**. Texto livre que agrupa as questões (ex.: `"DCL - permissoes"`). Sem tema (ou vazio), a questão entra como **Geral**. Escreva sempre igual: `"DML"` e `"dml"` viram dois temas diferentes. Bancos antigos, sem tema, continuam funcionando. |
| enunciado | aceita quebras de linha. Trecho entre crases vira código na linha: `` `SELECT * FROM x;` ``. Entre três crases (```` ``` ````) vira bloco de código. |

Dica: peça ao Claude/ChatGPT "gere um banco de questões no formato do modelo_banco.json sobre o tema X" e cole o resultado em **Validar**.

---

## Segurança — o que as regras garantem

| Risco | Como está tratado |
|---|---|
| Aluno ler o gabarito durante a prova | `gabaritos/` só pode ser lido pelo aluno depois que existe o marcador dele (`marcadores/uid_questao`), e o marcador só pode ser criado com a tentativa **finalizada** |
| Aluno mudar uma resposta enviada | sem ir e voltar, `respostas/` é só criação; com `permitirVoltar`, o aluno só altera `resposta`, `segundos` e `atualizadaEm`, e só antes de finalizar |
| Aluno inventar o próprio placar | `acertos`, `notaPrevia`, `aguardandoCorrecao` e `nota` só são gravados pelo professor (painel) |
| Alguém ler a chave da IA | `config/ia` só pode ser lido/gravado pelo administrador principal |
| Aluno fazer a prova duas vezes | o ID da tentativa é fixo (`uid_prova`); só admin apaga |
| Aluno trocar as questões sorteadas | `questoesIds` não pode ser alterado depois de criado |
| Aluno de fora (gmail etc.) | só domínios de `config/geral.dominiosAlunos` passam nas regras |
| Aluno de outra turma | se a prova tem turma, o create da tentativa exige o e-mail na lista `turmas/{id}.emails`; o aluno só lê a turma em que está |
| Começar sem o código de acesso | o create da tentativa exige `codigoInformado` igual ao código da prova |
| Aluno ver tentativa de outro | leitura restrita ao dono e à equipe |
| Auxiliar mexer em prova/banco | só `admin` e `professor` escrevem; `auxiliar` só lê |

Limites conhecidos (sem Cloud Functions, para ficar no plano gratuito):
- O **sorteio** das 10 questões é feito no navegador do aluno. Um aluno com conhecimento técnico poderia escolher quais 10 vai receber, mas **nunca** consegue ler a resposta antes de finalizar a prova.
- O marcador que libera o gabarito é por **aluno + questão** (não por prova). Se o mesmo banco for usado em duas provas (ex.: prova e recuperação), quem já finalizou a primeira consegue, com conhecimento técnico, ler o gabarito das questões repetidas durante a segunda. Para recuperação, prefira um banco (ou temas) diferente.
- A correção automática também roda no navegador; o placar e a nota "fechada" são gravados **pelo professor**, nunca pelo aluno. A correção por IA só acontece com o painel do administrador principal aberto.
- O cronômetro (campo **Tempo limite**) usa o relógio do computador do aluno. Para um limite rígido, encerre também a prova pelo painel na hora combinada.

## Antifraude

Durante a prova (tela das questões) o sistema **impede** algumas coisas e **registra** outras. Tudo o que é registrado aparece em **Resultados** (colunas *Tempo* e *Sinais*, detalhe do aluno, CSV e PDFs).

**O que o sistema impede**
| O quê | Como |
|---|---|
| Ler a resposta certa durante a prova | regra do Firestore (`gabaritos/` só abre depois do marcador, criado só com a prova finalizada) |
| Alterar uma resposta enviada / fazer a prova duas vezes | regras do Firestore |
| Colar ou arrastar texto no campo de resposta | Ctrl+V, Shift+Insert, botão direito e arrastar são bloqueados |
| Copiar e selecionar o enunciado | seleção, botão direito, arrastar e Ctrl+C/Ctrl+A bloqueados na área da questão |
| Atalhos de imprimir, salvar, ver código e DevTools | Ctrl+P, Ctrl+S, Ctrl+U, F12, Ctrl+Shift+I/J/C bloqueados (e a impressão da prova em andamento sai em branco) |
| Enviar a mesma resposta duas vezes | o botão trava enquanto grava |
| Perder a resposta por queda de internet | a resposta fica na tela, aparece o banner vermelho "Sem conexão" e dá para reenviar; fechar/recarregar a aba pede confirmação |
| Passar do tempo (se a prova tiver tempo limite) | cronômetro regressivo; ao zerar, a prova é finalizada com as respostas já enviadas |

**O que o sistema só registra** (não dá para impedir num navegador comum)
| Sinal | Campo na tentativa |
|---|---|
| Sair da tela cheia (Esc, F11…) | `saidasTelaCheia`; aparece um aviso para voltar |
| Trocar de aba ou de janela, ou clicar fora do navegador | `trocasDeAba`; aparece o mesmo aviso ao voltar |
| Tentar colar/arrastar no campo de resposta | `tentativasColar` |
| Tempo total e tempo de cada resposta | `tempoTotalSegundos` e `segundos` em cada resposta; respostas em menos de 5 s ficam em vermelho |

Para criar uma prova com tempo, preencha **Tempo limite (min)** no formulário de nova prova (0 = sem limite).

> ⚠ **Nada disso substitui a fiscalização em sala.** Celular, segundo computador, colega do lado, ou um aluno que sabe desligar o JavaScript ficam fora do alcance de uma página web. Os sinais são **indícios para você conferir**, não prova de cola: uma troca de aba pode ser uma notificação do sistema, e uma resposta rápida pode ser só um aluno que sabia. O cronômetro e os contadores rodam no navegador do aluno; o que é garantido de verdade é o que está nas regras do Firestore.
>
> Depois de atualizar o sistema, **publique de novo o `firestore.rules`** no Firebase Console (Firestore → Regras → Publicar): os campos novos (`saidasTelaCheia`, `tentativasColar`, `tempoTotalSegundos`, `segundos`) são recusados pelas regras antigas.

## Testar como aluno
Na aba **Provas** do painel, cada prova tem o botão **Testar como aluno**: ele abre `index.html?teste=<id da prova>` em nova aba e você faz a prova exatamente como o aluno (mesmas opções da prova: ir e voltar ou não, colar bloqueado, sem feedback por questão), **mesmo com a prova ainda fechada**.
- Uma faixa amarela **MODO TESTE** fica no topo; o botão **Reiniciar teste** apaga a tentativa e recomeça.
- A tentativa de teste (`teste_<seu uid>_<prova>`, campo `teste: true`) **não aparece** em Resultados, média, CSV, PDFs nem em "Fechar notas".
- Ao finalizar, aparece o placar ("acertou X de N" e a nota) e o botão **Ver gabarito e resultado** (sempre, no teste), para conferir a tela que o aluno verá.
- **Apagar meu teste** (na aba Provas) apaga a sua tentativa de teste daquela prova, para testar de novo.

> ⚠ Depois de alterar `firestore.rules`, cole as regras de novo no **Firebase Console → Firestore → Regras → Publicar**. O GitHub Pages publica só o site, não as regras.

### Acompanhar um teste ao vivo
1. Aba **Provas** → **Testar como aluno**: a prova abre numa aba nova, em modo teste.
2. Na aba do painel, vá em **Resultados**, escolha a prova e marque **Mostrar tentativas de teste** e **Atualizar ao vivo** (aparece o pontinho verde *● ao vivo*).
3. Faça a prova na outra aba: a tentativa aparece na seção **Testes da equipe** e se atualiza sozinha (questões, saídas, encerramento, questões perdidas). Clique em **Ver** para acompanhar as respostas.

As tentativas de teste nunca entram na média, no CSV, nos PDFs nem em "Fechar notas". O ao vivo também serve no dia da prova, com os alunos; ele é desligado ao trocar de prova ou sair da aba Resultados.

## Testar antes do dia (recomendado)
1. Entre em `admin.html` com a sua conta, importe o modelo, crie uma prova de teste e libere.
2. Entre em `index.html` com uma conta `@edu.senai.br` (peça a um aluno ou use uma conta de teste) e faça a prova.
3. Teste também com um Gmail comum: deve aparecer **"Conta não autorizada"**.
4. Volte ao painel, confira Resultados, corrija uma dissertativa, feche as notas, libere o resultado e veja como aluno.

Se quiser rodar tudo localmente sem gastar o Firebase: `npm install -g firebase-tools`, mude `USAR_EMULADOR` para `true` em `js/firebase-config.js`, rode `firebase emulators:start` nesta pasta e abra `http://localhost:5000`. (Volte para `false` antes de publicar.)
