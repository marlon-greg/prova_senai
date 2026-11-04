# Prova Online — SENAI (Firebase + GitHub Pages)

Sistema de prova prática: o aluno entra com a conta Google do SENAI, recebe **10 questões sorteadas** de um banco maior, responde (uma por vez ou todas na página, com ou sem **ir e voltar**, sem colar), vê no fim só **quantas acertou e a nota**, e o professor corrige as dissertativas (à mão ou pela **IA**), fecha as notas, gera o gabarito para o Classroom e libera o gabarito com a explicação de cada erro.

> 🔗 **Integrações futuras:** este sistema vai ser ligado a um sistema de **aulas interativas** e a um de **autoavaliação** (cruzando o que o aluno acha que sabe com o que ele acerta nas provas), e deve ganhar um **domínio próprio**. O plano e as regras para o código de hoje estão em [`docs/INTEGRACOES.md`](docs/INTEGRACOES.md).

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

### Servidor de correção (automático, mesmo com o painel fechado)

Opcional. Um **Cloudflare Worker** gratuito (código em `servidor/corretor-worker.js`, sem nenhum segredo) corrige as dissertativas assim que o aluno finaliza. A página do aluno chama o servidor mandando só o "crachá" do login (ID token do Firebase); o servidor confere que a tentativa é **dele** e está **finalizada**, corrige com a IA e grava as correções e o placar. A tela do aluno atualiza sozinha. Chamar de novo não gasta: o que já foi corrigido não volta para a IA.

Os segredos ficam só no Cloudflare: a chave da Anthropic (crie uma chave separada, ex.: `corretor-servidor`) e a conta de serviço do Firebase (Firebase Console → ⚙ Configurações do projeto → Contas de serviço → Gerar nova chave privada). **A conta de serviço dá acesso total ao banco: nunca coloque esse arquivo no GitHub, e-mail ou chat.**

Configurar: Cloudflare → **Workers & Pages → Create → Worker** (nome `corretor-prova`) → **Edit code**: cole `servidor/corretor-worker.js` → **Deploy**. Em **Settings → Variables and Secrets**: `ANTHROPIC_API_KEY` (Secret), `FIREBASE_SA` (Secret, o JSON inteiro), `PROJECT_ID` (Text, `prova-senai-3e983`), `ORIGENS` (Text, `https://marlon-greg.github.io`), `MODELO` (Text, opcional, padrão `claude-haiku-5-5`). No painel: **Configuração → Servidor de correção automática** → cole o endereço `https://corretor-prova.<sua-conta>.workers.dev` → **Testar servidor** → **Salvar**. Vazio = desligado (volta a corrigir só pelo painel).

O plano gratuito do Cloudflare aceita 100 mil chamadas por dia, muito mais do que uma escola usa.

**Trocar ou revogar a chave:** **Apagar chave** no painel e, para invalidar de vez, apague-a também em console.anthropic.com → API Keys.

---

## Organização: Turma → Semestre → Matéria → Tópicos

**📘 Plano de curso** (no topo da aba Organização): o documento com **todas as matérias** do curso e os tópicos de cada uma. Crie com o nome do curso, marque as turmas desse curso, envie o PDF (pode ser só a parte das matérias) e clique em **🤖 Ler plano de curso com IA** — a IA lista matéria, módulo, carga horária e tópicos, e você revisa. Também dá para escrever: `# Matéria | módulo | carga horária` e os tópicos um por linha embaixo. Com o plano de curso:
- cada turma mostra as matérias do curso que ainda não têm cartão no semestre (**+ Matéria** cria o cartão já com os tópicos);
- o cartão da matéria usa os tópicos do plano de curso quando o plano de ensino não tem tópicos;
- o plano de ensino passa a ser **opcional** e focado nas **datas das provas** (botão **📘 Puxar tópicos do plano de curso** se quiser datas por tópico);
- 🏷 Tópicos (Bancos) e o diário também oferecem os tópicos do plano de curso.

Aba **Organização** (a primeira do menu). Mostra cada **turma**, dentro dela os **semestres** (o atual aberto) e, em cada semestre, um cartão por **matéria**.

- **Plano de ensino** (`planos/{id}`): uma matéria de uma turma num semestre. Tem os **tópicos** na ordem em que serão dados (com início e fim previstos), as **provas previstas** (título, data e tópicos) e o(s) professor(es). O plano é vivo: **✎ Editar** a qualquer momento.
  - Tópicos, um por linha: `Tópico | início | fim` (ex.: `DDL - CREATE TABLE | 11/08 | 22/08`; sem ano, vale o do semestre).
  - Provas previstas: `Título | data | tópico 1; tópico 2`.
- **⬆ PDF do plano** + **🤖 Ler plano com IA**: a IA lê o PDF e preenche os tópicos, as datas e as provas previstas. Você **revisa e corrige** antes de salvar (substituir ou juntar com os tópicos atuais).
- O cartão mostra, por tópico: **✓ dado / ▶ em andamento / 🗓 previsto** (pela data de hoje), quantas **questões** os bancos da matéria têm daquele tópico (em amarelo quando nenhuma) e em quantas **provas** ele já caiu. Também lista os tópicos que só existem nos bancos (fora do plano) e as provas da matéria; as **previstas** que ainda não existem têm **+ Criar**, que abre a Nova prova já com turma, semestre, matéria, data e **só os tópicos daquela prova marcados**.
- **Semestre** = `2026-1` (jan–jun) ou `2026-2` (jul–dez).

**Na prova** (Nova prova / ✎ Editar) entram **Semestre**, **Matéria** e **Data da prova**. A prova aparece na matéria pela combinação turma + semestre + matéria. Provas antigas, sem esses campos, usam a data de criação e a matéria do 1º banco. A aba **Provas** agrupa por turma → semestre · matéria e tem filtros de semestre e matéria.

**Aba Bancos** organizada em **Semestre → Matéria → Banco → Tópicos**, com pesquisa (banco, matéria, tópico e até o texto das questões) e filtros de semestre e matéria. Cada banco mostra os tópicos com quantas alternativas e dissertativas tem, em quantas provas está e um aviso das questões ainda sem tópico. Na importação você escolhe o semestre (e pode trocar a matéria do JSON); depois, semestre e matéria mudam em **🏷 Tópicos**. Bancos antigos usam o semestre da data de importação.

**Tópico das questões = o campo `tema`** (o mesmo que filtra o sorteio). Aba **Bancos → 🏷 Tópicos**: a tabela com todas as questões do banco, para trocar o tópico de cada uma, aplicar um tópico às marcadas (os tópicos do plano aparecem para clicar) e **🤖 Sugerir tópicos com IA** (usa os tópicos do plano da matéria; sem plano, a IA cria nomes curtos). Ao salvar, as provas que filtravam temas desse banco têm o filtro ajustado sozinho, para sortear as mesmas questões de antes. Também dá para mudar a matéria do banco ali.

A IA da organização roda no navegador do administrador principal (com a chave) ou no servidor (ação `organizar` do Worker, para professores). O Worker importa `servidor/organizar.js` e é publicado pela Cloudflare a cada push (colar o arquivo à mão no editor da Cloudflare não funciona mais).

## Ajuda "?" em todas as telas

O botão azul **?** (canto de baixo, à direita) explica a tela aberta, passo a passo. Os **?** pequenos ao lado de cada envio (banco JSON, slides, laudos, plano de ensino, plano de curso, lista de alunos) dizem como preparar o arquivo: só PDF, slides em paisagem, até 20 MB, como exportar do PowerPoint/Google Slides, que não precisa ser o documento inteiro etc. Os textos ficam em `js/ajuda.js`.

## Conquistas dos alunos (página do aluno)

Todo aluno vê **🏅 Minhas conquistas** embaixo das provas, com **nível** (cada 3 conquistas sobem 1). Clicar na medalha mostra o que falta ou como ele conquistou (ex.: as 3 notas, com a matéria de cada uma). Medalha nova desde a última visita aparece com comemoração.
- **Gerais** (todas as matérias): primeira prova · **Trinca de ouro** (3 notas seguidas acima de 80) · Constância (5 seguidas de 60 para cima) · Gabaritou (100) · Em evolução (melhorou 3 vezes) · Coração intacto (5 provas sem perder vida) · Veterano (10 provas).
- **Por matéria**: média da matéria e as conquistas Mandou bem (80+), Mestre (média 80+ com 2 provas) e Decolando (melhorou 2 vezes).
- **Na sala de aula** (só alunos com acessibilidade): as medalhas do diário, só positivas.
- Usa a nota fechada (ou a prévia) das provas finalizadas. As regras deixam o aluno ler a prova que ele já fez (título e matéria). As regras das conquistas ficam em `js/conquistas.js`.

## Gamificação: personagem, skins, cartão, apontamentos e simulação

Aba **Gamificação** (só admin) liga e desliga cada parte: conquistas, personagem e skins, download do cartão, apontamentos, sugestões e a parte social (2ª parte, desligada).

- **🎨 Personagem do aluno** (`perfis/{uid}`): pele, rosto, cabelo (10 estilos, 10 cores), olhos, boca, roupa, acessório, fundo e moldura. Itens com 🔒 são **skins**, liberadas por número de conquistas ou por uma medalha específica (ex.: Jaleco SENAI com “Primeira prova”, óculos escuros e fundo dourado com “Trinca de ouro”, coroa com 12 conquistas). Catálogo em `js/avatar.js`.
- **⬇ Baixar meu cartão**: PNG ou JPG (1080×1350, bom para redes sociais) com o personagem, o nome, o nível e as medalhas (nenhuma nota), e **PDF** da página com todas as conquistas e as próximas.
- **🚩 Apontamentos**: na prova e no gabarito, o aluno avisa sobre uma questão (duas respostas certas, nenhuma certa, erro de texto, enunciado confuso, gabarito errado). **💬 Fale com a equipe**: sugestões para o sistema. A equipe responde na aba **Retorno dos alunos**; o aluno vê a resposta na página dele.
- **❤️ Parte social** (desligada até o admin ligar): o aluno escolhe em **🔓 O que eu mostro** quais conquistas (e, se o admin permitir em "Permitir compartilhar notas", quais notas) aparecem para a turma. No **Mural da turma** os colegas veem só isso, com o personagem e o apelido, e reagem com ❤️ ou 👏 (sem comentários). Sem nada marcado, o aluno não aparece. As regras do Firestore só deixam ler a vitrine e reagir com a parte social ligada.
- **🏅 Editor de conquistas** (Gamificação → Conquistas, admin): cada conquista é uma **regra** com números (fez N provas, uma nota ≥ mínimo, N notas seguidas ≥ mínimo, melhorou N vezes, N provas sem perder vida, nota ≥ mínimo em N matérias, por matéria, ou contadores do diário). Edite emoji, título, descrição e regra; ligue/desligue; crie novas; **🤖 Sugerir novas com IA** (chegam desligadas para você revisar). Fica em `config/conquistas`; sem ele vale o padrão de `js/conquistas.js`. As skins ligadas a uma conquista usam o id dela (aparece "🎨 libera: …").
- **🧪 Ver como aluno** (Gamificação → Abrir a simulação, ou `index.html?simular=1`): a equipe vê a página do aluno com a própria conta, inventa notas, se dá conquistas e monta o personagem. Nada é gravado no sistema (fica só no navegador). Professor e admin que entram em `index.html` sem `?simular` vão direto para o painel.

## Relatórios (aba Relatórios)

Professor e admin. Filtros de turma, semestre, matéria e aluno. Usa a nota fechada de cada prova finalizada (sem ela, a prévia).
- **⚠ Risco de reprovação**: aluno com **média abaixo de 50** numa matéria (média simples, cada prova vale o mesmo), as notas e **quanto precisa tirar na próxima prova** para chegar a 50.
- **Médias por aluno e matéria** (vermelho abaixo de 50, amarelo abaixo de 70) e **por turma e matéria**.
- **📊 Calcular por tópico**: acerto em cada tópico (o `tema` das questões, com pontos parciais e correções), da turma e de cada aluno, para direcionar o **reforço**. A conta fica em `desempenhoPorTopico()` (`js/admin-relatorios.js`), a mesma que a integração com a autoavaliação vai usar.
- **⬇ CSV** das notas filtradas.

## Pesquisa e filtros em todas as telas

| Tela | Pesquisa | Filtros |
|---|---|---|
| Organização | matéria, tópico ou prova | turma, semestre |
| Provas | prova, turma, matéria ou banco | turma, semestre, matéria, situação, ordem |
| Bancos | banco, matéria, tópico ou texto da questão | semestre, matéria |
| Turmas | turma, nome ou e-mail do aluno | semestre, matéria (pelos planos e provas da turma) |
| Resultados | aluno (nome ou e-mail) | turma, semestre e matéria da prova; situação do aluno (em andamento, finalizou, a revisar, com sinais, nota abaixo de 50) |
| Acessibilidade | aluno, e-mail ou auxiliar | turma, ativa/desligada |
| Diário | aluno | turma |
| Equipe | nome ou e-mail | papel |

## Diário do aluno (aba Diário)

Para os alunos marcados na aba Acessibilidade. A **auxiliar de inclusão** vê só os alunos dela (o painel dela já abre no Diário); **professores e admin** veem todos.

- **Registrar o dia** em 5 etapas, com barra de progresso: 😊 humor na chegada e na saída (carinhas) e energia · 📚 matérias e **tópicos do plano de ensino** trabalhados, o que foi feito, compreensão, autonomia e foco (escalas de 1 a 5) · 🤝 interação, comunicação, sinais de sobrecarga e possíveis causas · 🧩 estratégias que ajudaram, o que funcionou e o que foi difícil · 🏆 estrelas do dia, vitória do dia, dica para as próximas provas e algo fora da rotina. Os campos com * são os principais; o rascunho fica salvo no computador enquanto ela preenche. Dá para registrar um dia que passou (escolha a data) e editar depois.
- **Outro dia**: botões rápidos (ontem e as últimas aulas sem registro) e **📆 Escolher data**. Para um dia que não é hoje (ou que não é dia de aula da turma), o sistema pergunta o **motivo** (registro atrasado, ela faltou, não teve aula, aula extra, outro) e se você quer **preencher o diário** ou **só justificar**. No calendário: 🚫 faltou, 📭 sem aula; os dias que não são de aula ficam em cinza.
- **Conquistas da aluna**: as medalhas são para a **aluna**, não para a auxiliar. O preenchimento da auxiliar vira um resumo **só positivo** (aulas registradas, aulas seguidas, estrelas, autonomia, foco, compreensão, tópicos, vitórias — contagens, nunca os textos, o humor ou as crises) gravado em `acessibilidade/{aluno}.diarioResumo`, que ela vê na página dela. No painel, **🏅 Conquistas que a aluna vê** mostra a prévia; ao salvar, a comemoração avisa se ela ganhou medalha nova.
- **📄 Relatório formal (PDF)**: para coordenação, direção ou sede. Escolha o período (semana, mês, 30 dias, semestre ou datas), se entram os comentários dos professores, o anexo dia a dia e as informações de saúde (desmarcado por padrão), as considerações finais e o destinatário. Sai com identificação, frequência (aulas previstas, registradas, faltas e justificativas), indicadores médios, conteúdos por matéria e tópico, comportamento, estratégias, recomendações para avaliações, observações dos professores e assinaturas.
- **Calendário do mês**: cada dia com a carinha do humor na saída e 💬 com o número de comentários; clique para ler.
- **Professor**: lê o registro e deixa um **comentário** com o modelo próprio (sua matéria, como ela estava na aula, participação, comentário, sugestão), nada obrigatório. Ele **não muda** o registro da auxiliar. A auxiliar pode responder.
- Fica em `acessibilidadePrivado/{aluno}/diario/{data_autor}` (+ `comentarios`), que o aluno nunca lê. As perguntas estão em `js/diario-perguntas.js`, como dados: os relatórios e a IA usam o mesmo modelo.

## Regras publicadas sozinhas (GitHub Actions)

O arquivo `.github/workflows/regras-firestore.yml` publica o `firestore.rules` no Firebase a cada push na `main` que mude as regras (e pelo botão **Actions → Publicar regras do Firestore → Run workflow**). Configurar uma vez:
1. GitHub → repositório → **Settings → Secrets and variables → Actions → New repository secret**.
2. Nome: `FIREBASE_SERVICE_ACCOUNT`. Valor: o JSON inteiro da conta de serviço (o mesmo arquivo do `FIREBASE_SA` da Cloudflare).
3. A ação usa direto a API do Firebase Rules (`.github/scripts/publicar-regras.mjs`). Se falhar com "permission denied": Google Cloud Console → IAM → na conta `firebase-adminsdk-…` adicione o papel **Firebase Rules Admin**.

Sem o segredo, a ação só falha (aparece um ❌ em Actions) e nada muda: aí publique à mão, como antes.

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

Na prova, escolha a turma no campo **Turma** (obrigatório: **cada prova é de uma turma só**). Com turma:
- o aluno **só vê a prova na lista** se o e-mail dele estiver na turma;
- as **regras do Firestore** recusam a tentativa de quem não está na lista, mesmo que tente pelo console do navegador;
- em **Resultados** aparece a seção **Não fizeram**, com quem está na turma e não começou a prova (incluindo quem ainda nem entrou no sistema).

Prova **sem turma** (inclusive as antigas, com a turma escrita como texto) **não aparece para nenhum aluno** e ninguém consegue começar (as regras do Firestore bloqueiam). Ela fica no grupo **⚠ Sem turma** da aba Provas: use **✎ Editar** e escolha a turma.

**Organização no painel:**
- **Provas**: barra de pesquisa (título, turma ou banco), filtros por turma e situação (liberada, fechada, gabarito liberado) e ordenação; as provas aparecem **agrupadas por turma** (cada grupo abre e fecha).
- **Turmas**: pesquisa por turma, nome do aluno ou e-mail; a coluna **📝 Provas** mostra quantas provas a turma tem e leva para a aba Provas já filtrada.
- **Resultados**: escolha a turma e depois a prova (as provas ficam agrupadas por turma).
- **♿ Acessibilidade**: aparecem só as provas da turma do aluno.

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

### Limite de saídas da prova (vidas ❤️)
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

## Vidas ❤️, mascote guia e acessibilidade ♿

### Vidas (limite de saídas)
Na prova, **Vidas do aluno** (0 = sem vidas) substitui o antigo "limite de saídas". O aluno perde 1 vida ao **trocar de aba/janela (Alt+Tab)**, **sair da tela cheia** e, se a opção *Tentar colar também custa 1 vida* estiver marcada (padrão), ao **tentar colar (Ctrl+V)**. Os corações aparecem no topo da prova. Quando acabam, a prova é encerrada (ou o aluno perde a questão, conforme a opção).

**Aluno perdeu vidas sem querer (ex.: TEA)?** Em **Resultados**, cada aluno tem um cartão (ou linha) com:
- **❤️ Restaurar vidas**: zera as vidas perdidas e devolve as questões perdidas. A tela do aluno atualiza na hora.
- **+1 ❤️**: dá uma vida a mais só para aquele aluno.
- **↩ Reabrir prova**: para quem já finalizou ou foi encerrado sem vidas. O aluno continua de onde parou. Se a prova tem tempo, você escolhe quantos minutos ele ainda tem.

Na aba **Provas**, o botão **👥 Alunos** abre essa visão da prova direto, ao vivo.

### Mascote guia
Antes da prova, um mascote explica as regras, uma fala por vez. Tem o botão 🔊 para ouvir. São 4 mascotes, os professores em versão cartoon: **Marlin** (Marlon), **DaniBoy** (Daniel), **Feh** (Felipe) e **Xelxo** (Celso). O aluno escolhe o guia e pode ligar ou desligar no botão **🧑‍🏫 Mascote** do topo; a escolha fica no navegador. Desligado, as regras aparecem em lista. No fim, o mascote comemora e o aluno vê de 0 a 3 estrelas pela nota. Os desenhos estão em `js/mascotes.js`.

### Acessibilidade (aba ♿ no painel)
1. **Marque o aluno**: escolha das turmas ou digite o e-mail.
2. **Visual**: tamanho da letra, espaçamento entre letras, palavras e linhas, fonte (Atkinson Hyperlegible, Lexend, Comic Neue…), cores (creme, azul, alto contraste, escuro), CAIXA ALTA, linhas curtas, régua de leitura e sem animações. A pré-visualização mostra o resultado na hora.
3. **Na prova**: tempo extra, vidas extras, *sem perder vidas* (só registra), esconder o cronômetro, botão 🔊 Ouvir em cada questão e apoio 💡.
4. **Sobre o aluno**: a sua descrição e os laudos em PDF. O aluno nunca vê essa parte.
5. **Prova adaptada**: escolha a prova, defina **quantas alternativas e quantas dissertativas** (o padrão é o da prova; pode ser só um tipo ou outra quantidade) e clique em **🎲 Sortear questões**. O sorteio fica guardado: na hora da prova o aluno recebe exatamente essas questões. Depois use **🤖 Adaptar as que faltam**: a IA adapta **só as questões sorteadas**, usando a descrição, os laudos e a orientação extra.
   - Um resumo mostra quantas estão **✓ em dia**, **⚠ desatualizadas** (adaptadas antes da última mudança na descrição ou nos laudos) e **○ sem adaptação**.
   - **🔄 Refazer as desatualizadas** / **🔄 Refazer todas com IA**: geram de novo com as informações atuais. As adaptadas à mão só são substituídas se você confirmar.
   - **🗑 Apagar adaptações desta prova**: volta todas as sorteadas ao original.
   - Em cada questão: editar à mão, **🤖 Refazer com IA**, **Voltar ao original**, **🔁 Trocar questão** (troca por outra do mesmo tipo, dos temas da prova) ou **✕ Tirar da prova dele(a)** (só da prova desse aluno; o banco não muda). **➕ Adicionar alternativa/dissertativa** sorteia mais uma.
   - **💡 Apoios**: a IA escreve de 1 a 3 apoios por questão. Na prova, quem mostra é o **mascote**: ele fala o 1º apoio quando a questão aparece, e o aluno pede os outros no botão **💡 Pedir ajuda**. Com o mascote desligado, os apoios aparecem num quadro na questão. Professor e auxiliar podem editar, remover ou adicionar apoios.
   - **📋 O que foi adaptado e por quê**: a IA escreve a justificativa de cada questão com base na descrição e nos laudos. Dá para editar.
   - **📄 Baixar PDF da prova adaptada**: relatório para a coordenação com os dados do aluno, a descrição, os laudos considerados, as adaptações gerais (tempo, vidas, visual…) e, por questão, a versão aplicada, a original, os apoios e a justificativa, com espaço para assinaturas. Abre pronto para imprimir: escolha **Salvar como PDF**.
   - Se o aluno já começou a prova, aparecem as questões da tentativa dele e não dá mais para sortear nem trocar.
   - A resposta certa não muda: as alternativas ficam na mesma ordem e quantidade. **Revise antes da prova.**
   - ⚠ Quantidade diferente da prova exige o `firestore.rules` atualizado publicado no Firebase.
6. **👁 Abrir a prova como o aluno**: o modo teste com as adaptações daquele aluno.
7. **Sugestões**: a equipe registra observações; o professor marca como resolvida.

A IA roda no seu navegador (administrador principal, com a chave salva) ou no servidor de correção (Cloudflare Worker, ação `adaptar`) para os professores e a auxiliar de inclusão. No Worker, a variável opcional `MODELO_ADAPTACAO` define o modelo (padrão `claude-sonnet-5-5`).

### 🎨 Formatos de questão adaptada
Além de reescrever o texto, a questão pode mudar de **formato** para o aluno, cobrando o mesmo conteúdo:

| Formato | Como o aluno responde | Correção |
|---|---|---|
| 📝 Texto simplificado | igual à original, com linguagem simples | gabarito do banco |
| 🔘 Menos alternativas | 2 ou 3 alternativas | automática |
| ✅ Verdadeiro ou falso | V ou F em cada frase | automática, parcial |
| 🔗 Ligar colunas | toca no item da esquerda e no par da direita (cores) | automática, parcial |
| 🧩 Completar lacunas | escolhe a palavra de cada espaço num banco de palavras | automática, parcial |
| 🔢 Ordenar passos | ↑ ↓ até a ordem certa | automática, parcial |
| 🪜 Questão em etapas | perguntas pequenas, uma por vez | automática, parcial |
| ✍ Escrita com apoio | resposta escrita com começo de frase e lista do que não pode faltar | como dissertativa |

- Na questão sorteada (aba Acessibilidade): **🎨 Opções de formato (IA)**. A IA usa a descrição, os laudos, o **diário** e os comentários dos professores e propõe de 4 a 6 opções, **da mais indicada para a menos** (estrelas), cada uma com o **porquê** e a **base técnica** (DUA/UDL, LBI 13.146/2015, PNEEPEI/AEE, ensino estruturado, linguagem simples…). Cada opção tem a **prévia de como o aluno vê**, com o gabarito. **✅ Usar este** aplica; **✎ Ajustar e usar** abre o editor (formato + texto + prévia ao vivo).
- **✎ Escolher / editar formato**: monta o formato à mão (ex.: `V | frase`, `item = par`, `O comando [[CREATE TABLE]] cria…`).
- **🎨 Sugerir formatos para todas**: prepara as opções de todas as sorteadas; depois você escolhe em cada uma.
- Segurança: a questão adaptada que o aluno lê **não tem a resposta**. O gabarito do formato fica em `acessibilidadePrivado/{aluno}/gabaritos`, que o aluno só abre depois de finalizar (marcador). A correção (painel, página do aluno e servidor) dá **pontos parciais**.
- O PDF da prova adaptada mostra o formato e a resposta esperada.

### 🗂 Provas adaptadas (histórico)
Aba com tudo o que foi adaptado, por aluno e por prova: o formato de cada questão, o porquê, quem fez e quando, e **🕘 Histórico de escolhas** (qual opção foi escolhida entre as da IA, se foi ajustada à mão). Pesquisa e filtros por turma, formato e origem (IA/manual). Auxiliar de inclusão vê só os alunos dela; professores e admin veem todos.

### Auxiliar de inclusão
Cadastre em **Equipe** com o papel **auxiliar de inclusão** e vincule no cadastro do aluno, em *Auxiliar(es) de inclusão*. Ela vê só as abas **Diário**, **Acessibilidade** e **Resultados**, e só os alunos vinculados a ela. Pode editar as adaptações e as questões, subir documentos, deixar sugestões e restaurar vidas ou reabrir a prova desses alunos. Ela não vê os outros alunos, não muda quem está vinculado e não fecha notas. O aluno precisa ter entrado no sistema pelo menos uma vez para os resultados dele aparecerem para a auxiliar.

> **Depois de atualizar o sistema, publique de novo o `firestore.rules`** (Firebase Console → Firestore → Regras). As vidas, a acessibilidade e a auxiliar de inclusão dependem das regras novas.

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

**🤖 Prompt pronto (aba Bancos → "Não tem o JSON? Gere as questões numa IA"):** escolha a matéria, os tópicos (vêm do plano de curso/ensino e dos bancos da matéria; dá para acrescentar), quantas alternativas e dissertativas por tópico, o nível e um contexto. O sistema monta o prompt com as regras e o formato exato do JSON (tema = o nome do tópico). **📋 Copiar prompt**, colar no Claude/ChatGPT/Gemini, colar o JSON na caixa → **Validar** → **Importar**. Também tem **⬇ Baixar o modelo JSON**.

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
