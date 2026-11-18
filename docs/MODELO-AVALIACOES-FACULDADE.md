# Modelo de referência: módulo "Atividades e Avaliações"

> **Para quem este documento foi escrito:** para a IA ou o desenvolvedor que vai **acrescentar provas online a um sistema de aulas que já existe** (um sistema de faculdade). Ele descreve como funciona o sistema de provas que já usamos ("Prova Online — SENAI") e diz **o que copiar, o que mudar e o que não trazer**.
>
> Leia o documento inteiro antes de começar. As seções 1 a 3 são obrigatórias. A seção 10 diz **em que ordem construir** e **onde parar para o professor aprovar**.

---

## 0. Resumo em 10 linhas

1. O sistema de aulas ganha **mais um botão na tela de cada matéria**: **"Atividades e Avaliações"**, ao lado dos botões que já existem (Drive e Teams).
2. Os materiais continuam abertos como hoje. **Só a área de Atividades e Avaliações pede login do aluno** (conta institucional).
3. Cada aluno recebe **questões sorteadas** de um banco, em **ordem embaralhada** (questões e alternativas).
4. A prova é feita em **tela cheia**, com **tolerância zero**: **sair da tela, trocar de janela ou só tentar (Alt+Tab, tecla Windows, Esc da tela cheia) encerra a prova na hora.** Não existe "você tem 3 chances".
5. **Colar não funciona** nos campos de resposta. Como não funciona, **não tira ponto nem encerra**: só é bloqueado (e registrado em silêncio para o professor).
6. **Nenhum feedback durante a prova.** O gabarito só pode ser lido **depois de finalizar**, e isso é garantido **no servidor**, não só na tela.
7. Uma tentativa por aluno por avaliação. Se a página fechar por queda de energia ou internet, ele continua de onde parou (**mas sair da tela durante a prova encerra**; ver 3.6).
8. O professor corrige as dissertativas, fecha as notas, e escolhe quando liberar o gabarito comentado.
9. O professor pode **reabrir** a prova de um aluno encerrado por engano, e isso fica registrado (quem, quando, por quê).
10. **Visual sóbrio e acadêmico. Nada de gamificação.**

---

## 1. Tom e visual: profissional, NÃO gamificado

O sistema de origem foi feito para um curso técnico com adolescentes e tem muitos elementos de jogo. **Nada disso deve ir para o sistema da faculdade.**

**NÃO trazer:**

| Elemento do sistema de origem | Situação no sistema da faculdade |
|---|---|
| Vidas (corações ❤️/🖤) | **Não existe.** Substituído por tolerância zero (seção 3). |
| Mascotes, falas, voz, comemoração | Não existe. As regras aparecem num texto formal antes de começar. |
| XP, níveis, conquistas, recompensas, estrelas | Não existe. |
| Avatar, skins, cartão, fundos de perfil | Não existe. |
| Emojis em botões, avisos e mensagens | Não usar. Usar ícones discretos (linha simples) só onde ajudam. |
| Mensagens no estilo "Boa prova! 🍀", "Respire fundo 💪" | Trocar por linguagem institucional e neutra. |
| "Perder a questão" como punição alternativa | Não existe. A única consequência é o encerramento. |

**Diretrizes visuais:**
- Seguir a identidade visual do sistema de aulas que já existe (cores, fontes, cabeçalho). O módulo deve parecer parte dele, não um site à parte.
- Tipografia legível, contraste bom, muito espaço em branco. Cores fortes só para estados (erro, aviso, concluído).
- Mensagens curtas, na terceira pessoa ou impessoais. Exemplos:
  - "Avaliação encerrada. Foi detectada a saída da janela da avaliação às 19h42."
  - "Respostas registradas. O resultado será divulgado pelo professor."
  - "Colar está desativado nesta avaliação."
- Termos: **Avaliação** (vale nota), **Atividade** (exercício, pode ou não valer nota), **Tentativa**, **Encerrada**, **Finalizada**, **Gabarito comentado**.

---

## 2. Onde o módulo entra no sistema de aulas

### 2.1 O botão

Na **tela da matéria**, onde hoje ficam os botões de acesso ao **Drive** e ao **Teams**, entra um terceiro botão, com o mesmo estilo dos outros:

```
┌───────────────────────────────────────────────────────────────┐
│  Banco de Dados II · Prof. Marlon · 2026/2                    │
│                                                               │
│  [ Drive ]   [ Teams ]   [ Atividades e Avaliações ]          │
│                                                               │
│  Materiais                                                    │
│   • Aula 01 — Modelagem ...                                   │
│   • Aula 02 — ...                                             │
└───────────────────────────────────────────────────────────────┘
```

- O botão aparece em **todas as matérias** que tiverem o módulo ligado (opção por matéria, desligada por padrão).
- Pode mostrar um indicador discreto quando houver avaliação aberta naquela matéria (ex.: um ponto ou "1 aberta"), **sem** contagem regressiva chamativa.

### 2.2 Login: só onde é preciso

Hoje o sistema de aulas **não tem login do aluno**. Isso **não muda para os materiais**. O login é pedido **só quando o aluno clica em "Atividades e Avaliações"**.

- **Login Microsoft (decidido, fixo).** O login é **somente com a conta Microsoft institucional** (Microsoft Entra ID, antigo Azure AD), a mesma que o aluno usa no Teams. **Não oferecer** login Google, e-mail/senha próprios nem outros provedores.
  - Registrar o app no **Entra ID** da instituição (tipo de conta: **somente este diretório / single tenant**), para que só contas do tenant da faculdade consigam entrar. Isso já barra contas pessoais da Microsoft (`@outlook.com`, `@hotmail.com`, `@live.com`).
  - No navegador: **MSAL.js** (`@azure/msal-browser`) com `loginPopup`/`loginRedirect`, ou, se o sistema usar Firebase, o provedor `OAuthProvider("microsoft.com")` com `tenant` fixo no ID do tenant da faculdade.
  - Identificador do aluno: use o **`oid`** (ID do objeto no Entra) como `uid` estável, e o `preferred_username`/`email` para conferir com a lista da turma. Nome vem do `name` do token.
  - **O servidor confere o token** (assinatura, `tid` = tenant da faculdade, `aud` = o app) em toda gravação. Não confiar só no que a página diz.
- **Recusar contas de fora do domínio/tenant**, com a mensagem "Use a sua conta institucional Microsoft (a mesma do Teams)".
- O sistema de origem usa **Firebase Authentication + Google** e as regras do banco conferem o domínio do e-mail. Na faculdade, a mesma lógica vale trocando Google por **Microsoft**: o que importa é **o servidor saber quem é o aluno** em cada gravação.
- **Quem pode fazer cada avaliação:** a avaliação pertence a **uma turma**, e a turma tem a **lista de e-mails** dos alunos. Aluno fora da lista não vê a avaliação e **o servidor recusa** a tentativa dele.
  - No sistema de origem, o professor cola a lista (um aluno por linha: "Nome", "Nome <email>" ou só "email"). Quem foi cadastrado só pelo nome é vinculado no primeiro login, se o nome da conta bater com o da lista. Isso é útil, mas **opcional**: na faculdade, a lista de e-mails costuma vir da secretaria.
- **Código de acesso (opcional):** a avaliação pode ter um código (ex.: `AET-7K3Q`) que o professor diz em sala na hora. Serve para garantir que quem começa está presente. É uma camada a mais, não a principal (o código fica legível para quem souber mexer no navegador; a barreira forte é a turma).

### 2.3 Telas do aluno dentro do módulo

1. **Lista** da matéria: avaliações e atividades, cada uma com situação (Aberta, Agendada, Encerrada, Finalizada, Resultado disponível), prazo e duração.
2. **Instruções** (antes de começar): regras **só daquela avaliação** (tempo, número de questões, se pode voltar, se tem material de consulta, a política de tolerância zero). Caixa "Li e concordo com as regras" + campo do código (se houver) + botão **Iniciar avaliação**.
3. **Prova** em tela cheia.
4. **Fim**: "Respostas registradas" ou "Avaliação encerrada (motivo, horário)". Opcionalmente, quantas acertou e a nota prévia (o professor decide se mostra).
5. **Resultado** (só quando o professor liberar): questão por questão, a resposta do aluno, a correta, a explicação e o comentário do professor. Botão para baixar em PDF.

---

## 3. Regras de integridade (o coração do módulo)

### 3.1 Princípio

> **Durante a avaliação, o aluno fica na janela da avaliação, em tela cheia, do início ao fim. Qualquer saída, ou tentativa de saída, encerra a avaliação na hora, com as respostas já salvas.**

Diferença para o sistema de origem: lá existe um **limite configurável de saídas** ("vidas"), e só ao passar do limite a prova é encerrada. **Aqui o limite é zero e não é configurável pelo aluno nem aparece como "chances".** (O professor pode, se quiser, ter um campo de tolerância por avaliação, **padrão 0**; mas a interface do aluno nunca mostra contagem de chances.)

### 3.2 O que encerra a avaliação na hora

| Evento | Como detectar no navegador | Observação |
|---|---|---|
| **Tentar Alt+Tab** | `keydown` com `e.key === "Alt"` (ou `e.altKey`) enquanto a prova está ativa | Encerra **antes** de a troca acontecer. Ver exceção do AltGr em 3.3. |
| **Tecla Windows / Command** (abre menu Iniciar, Win+Tab, Win+D, Win+V…) | `keydown` com `e.key === "Meta"` ou `e.key === "OS"` | Win+V é o histórico da área de transferência do Windows: também é coberto aqui. |
| **Trocar de janela/aba, clicar fora do navegador** | `window` `blur` **e** `document` `visibilitychange` (`document.hidden`) | É a rede de segurança: pega tudo o que passar pelas teclas (touchpad, gesto, notificação clicada, outro monitor). |
| **Sair da tela cheia** (Esc, F11) | `fullscreenchange` com `document.fullscreenElement == null` | O Esc **sai da tela cheia antes** de o site conseguir impedir; o encerramento acontece no evento. |
| **Fechar ou recarregar a aba** no meio da prova | `beforeunload` mostra a confirmação do navegador; se ele sair mesmo, ao voltar a tentativa é encerrada (ver 3.6) | |
| **Abrir ferramentas do desenvolvedor / imprimir / salvar / ver código** | `keydown`: F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+P, Ctrl+S | No sistema de origem esses atalhos são **bloqueados** (não encerram). Recomendação para a faculdade: **bloquear e registrar**; encerrar só F12/Ctrl+Shift+I (tentativa clara de burlar). Deixe isso configurável e pergunte ao professor. |

**Seja honesto com o professor e no texto das regras:** um site **não consegue impedir** o sistema operacional de trocar de janela. O Alt+Tab é tratado pelo Windows, não pelo navegador. O que o site consegue é **perceber na hora e encerrar**:

- ao apertar **Alt** (ou a tecla Windows), a página recebe o `keydown` **antes** da troca, e a avaliação é encerrada nesse momento ("nem tentar");
- se a troca vier por outro caminho, o `blur`/`visibilitychange` chega em milissegundos e encerra do mesmo jeito.

Na prática, para o aluno, o efeito é exatamente o pedido: **tentou, encerrou.**

### 3.3 Cuidados para não encerrar por engano

Encerrar é uma consequência séria. Estes casos **não podem** encerrar:

1. **AltGr do teclado ABNT2.** No Windows, o AltGr chega como `Ctrl + Alt` e é usado para digitar `/`, `?`, `°`, `ª`, `º`, `¹ ² ³`, `£`, `¢`, `¬`. Digitar isso numa dissertativa **não é tentativa de Alt+Tab**. Regra:
   - `e.key === "AltGraph"` → **ignorar**;
   - `e.getModifierState("AltGraph") === true` → **ignorar**;
   - `e.ctrlKey && e.altKey` (combinação AltGr no Windows) → **ignorar**;
   - só `Alt` sozinho (sem Ctrl) → **encerrar**.
   - **Teste isso num teclado ABNT2 real antes de soltar para os alunos.**
2. **Clique no material de consulta** (quando a avaliação tem um PDF ou leitor embutido num `iframe`). Clicar dentro do `iframe` tira o foco da janela principal e dispara `blur`, mas **não é saída**. O sistema de origem resolve assim: no `blur`, espera um tique (`setTimeout(…, 0)`) e confere se `document.activeElement` é o `iframe` do material **e** `document.hidden === false`; se for, não conta. E, como com o foco no `iframe` a janela não recebe outro `blur` se o aluno trocar de janela, **confere `document.hasFocus()` a cada 1 segundo** enquanto houver material.
3. **Antes de começar e depois de finalizar**, nada disso vale. Só existe "prova ativa" na tela das questões, com a tentativa aberta.
4. **Modais do próprio sistema** (confirmação de "Finalizar avaliação?") não podem ser `window.confirm`/`alert` nativos, porque alguns navegadores tiram o foco da página com eles. Use modais em HTML.
5. **Um movimento, um evento.** Sair da tela cheia e trocar de aba ao mesmo tempo disparam vários eventos; garanta que o encerramento rode **uma vez só** (trava `encerrando = true`).
6. **Pedido de tela cheia na entrada não é saída.** Se o aluno recarregar a página e voltar sem tela cheia, mostra a tela "Entrar em tela cheia para continuar" **sem** encerrar (ver 3.6 para quando encerra).

### 3.4 Colar: bloqueado, sem punição

**Regra pedida:** colar **não tira ponto e não encerra**, **desde que o sistema realmente não deixe colar nada**. Então o bloqueio precisa ser completo:

Em **todo** campo de resposta (`textarea`, `input`, editor de código, etc.):

```js
function bloquearColar(el) {
  const barrar = e => { e.preventDefault(); registrarSilencioso("tentativaColar"); avisoDiscreto("Colar está desativado nesta avaliação."); };
  el.addEventListener("paste", barrar);
  el.addEventListener("drop", barrar);                                     // arrastar texto para dentro
  el.addEventListener("beforeinput", e => {                                // cobre o menu do botão direito, teclados virtuais etc.
    if (["insertFromPaste", "insertFromDrop", "insertFromYank", "insertReplacementText"].includes(e.inputType)) e.preventDefault();
  });
  el.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (((e.ctrlKey || e.metaKey) && k === "v") || (e.shiftKey && e.key === "Insert")) barrar(e);
  });
  el.setAttribute("autocomplete", "off");     // sem sugestões do navegador
  el.setAttribute("autocorrect", "off");
  el.setAttribute("autocapitalize", "off");
  el.setAttribute("spellcheck", "false");     // o corretor do navegador não sugere texto
}
```

Na **área da questão** (enunciado e alternativas), bloquear `copy`, `cut`, `contextmenu`, `dragstart` e `selectstart` (exceto dentro do campo de resposta, onde o aluno pode selecionar o próprio texto), e os atalhos Ctrl+C / Ctrl+A. Assim o aluno também não copia o enunciado para levar a outro lugar.

**Conferência extra no servidor (recomendada):** como um aluno técnico pode desligar o JavaScript ou mexer no console, registre também o **tempo de digitação**. Se uma resposta longa aparecer de uma vez (ex.: 400 caracteres entre dois salvamentos de 1 s), marque como "**inserção suspeita**" para o professor conferir. Não punir automaticamente.

> Registrar em silêncio = gravar o contador `tentativasColar` na tentativa, visível só para o professor. Não aparece para o aluno como "falta" nem conta para nada.

Win+V (histórico de colagem do Windows) não precisa de tratamento especial: a tecla Windows já encerra (3.2). E mesmo que o histórico abrisse, o que ele faz é um "colar", que já está barrado.

### 3.5 O que acontece no encerramento

Ordem exata (o sistema de origem faz assim, e funciona):

1. Trava a tela (cobre tudo com uma camada "Encerrando…"), para o aluno não continuar digitando.
2. Espera terminar um envio de resposta que já estava em andamento.
3. Se a avaliação permite **ir e voltar**, salva o que estava alterado e ainda não salvo (com limite de tempo de ~15 s).
4. Grava na tentativa: `finalizadaEm = horário do servidor`, `encerradaPor = "saida"` (ou `"altTab"`, `"telaCheia"`, `"teclaSistema"`…), `encerradaEm`, e o tempo total.
5. Grava um registro em `eventos` (ver seção 5) com o motivo, a questão em que ele estava e o horário.
6. Sai da tela cheia.
7. Mostra: **"Avaliação encerrada. Motivo: saída da janela da avaliação (19h42). Suas respostas salvas até este momento foram registradas. Em caso de problema técnico, procure o professor."**

**Questões não respondidas valem zero.** As respostas já salvas **continuam valendo** e são corrigidas normalmente.

Se a gravação falhar por falta de internet, a camada continua na tela com "Sem conexão. Não feche a página." e tenta de novo. O Firestore (e outros SDKs com fila offline) grava sozinho quando a conexão volta. **Ao finalizar com erro, confira no servidor se já não foi gravado antes de mostrar erro** (pode ter chegado mesmo com o tempo esgotado).

### 3.6 Queda de energia, internet, navegador que travou

O sistema de origem deixa o aluno **voltar e continuar** se a aba fechar. Com tolerância zero, fechar a aba **é** uma saída. Recomendação, com uma opção para o professor escolher:

- **Padrão: encerrar.** Quando a página fecha de repente (recarregou, fechou, o computador desligou), o navegador nem sempre consegue gravar o encerramento a tempo, então a tentativa pode continuar "aberta" no servidor. Por isso, **ao abrir a página e encontrar uma tentativa aberta**, o sistema mostra "A avaliação foi interrompida" e **encerra** com `encerradaPor = "interrompida"`. O professor vê e decide se reabre.
- **Alternativa (configurável por avaliação): "Permitir retomar após interrupção".** Ao voltar, o aluno continua, e o evento fica registrado como `interrupcao` com o tempo fora. Útil em laboratório com energia instável.

Use um **sinal de vida (heartbeat)**: a página grava `ultimoSinal` na tentativa a cada 20–30 s. Assim o professor vê, ao vivo, quem está com a prova aberta e quem sumiu, e sabe por quanto tempo ficou fora.

### 3.7 Reabertura pelo professor

Encerramento por engano vai acontecer (notificação que roubou o foco, aluno que encostou no Alt). O professor precisa de:

- **Reabrir avaliação** (por aluno): volta a tentativa para aberta, **exige um motivo escrito** ("notificação do Windows", "queda de energia na sala"), grava `reabertaPor`, `reabertaEm`, `motivoReabertura`, e mantém o histórico de encerramentos anteriores (nunca apaga).
- Se a avaliação tem tempo, o professor escolhe **quantos minutos** o aluno ainda tem.
- A tela do aluno, se estiver aberta, **atualiza sozinha** (escuta a tentativa em tempo real) e mostra "O professor reabriu a sua avaliação. Clique para continuar em tela cheia."
- Ao reabrir, **o gabarito volta a ficar fechado** para aquele aluno (ver 4.2: apagar os marcadores dele).

### 3.8 Celular e tablet

A API de tela cheia **não funciona no iPhone** e o controle de foco é fraco em celulares. Recomendação: **avaliações valendo nota só em computador**. Na tela de instruções, se o aparelho não suportar tela cheia (`document.fullscreenEnabled === false`), mostrar "Esta avaliação precisa ser feita em computador" e não deixar iniciar. Para **atividades** sem nota, o professor pode liberar celular (opção "Permitir em dispositivos móveis", que desliga a exigência de tela cheia).

### 3.9 O que o navegador não alcança (escrever isso para o professor)

Nenhuma página web impede: celular na mão, segundo computador, colega do lado, máquina virtual, alguém que desliga o JavaScript. **O módulo não substitui a fiscalização em sala.** O que é garantido de verdade é o que o **servidor** confere (seção 4). Os registros (saídas, tempos, colagens) são **indícios para o professor avaliar**.

---

## 4. Segurança no servidor (o que não pode ficar só na tela)

Tudo o que é "regra" precisa ser conferido no servidor. No sistema de origem isso é feito com as **regras do Firestore**; em outra stack, faça o equivalente na API.

### 4.1 Regras obrigatórias

| Regra | Como o sistema de origem garante |
|---|---|
| Só aluno da turma começa | ao criar a tentativa, o e-mail do usuário logado precisa estar em `turmas/{turma}.emails` |
| Uma tentativa por aluno por avaliação | o ID da tentativa é **fixo**: `{uid}_{avaliacaoId}`. Criar de novo dá erro. |
| Só com a avaliação aberta | a avaliação tem `liberada == true` (e, se tiver janela de horário, `agora` entre início e fim) |
| Código de acesso | `codigoInformado` precisa ser igual ao da avaliação |
| Horário de início é do servidor | `iniciadaEm == request.time` (o aluno não manda o próprio horário) |
| Número de questões certo | `questoesIds.size() == avaliacao.nQuestoes` |
| Aluno não troca as questões sorteadas | no update do aluno, só podem mudar: `finalizadaEm`, `indiceAtual`, contadores de eventos, `encerradaPor`, `tempoTotal`, `ultimoSinal` |
| Aluno não "desfaz" um encerramento | depois de `finalizadaEm != null`, o aluno não grava mais nada na tentativa nem nas respostas |
| Aluno não zera contadores | contadores só aumentam (o sistema de origem confere que a soma nova é ≥ a antiga) |
| Resposta gravada uma vez | sem "ir e voltar", a resposta é **create** sem **update**. Com "ir e voltar", update só até finalizar. |
| Resposta só para questões dele | o ID da questão precisa estar em `questoesIds` da tentativa |
| Gabarito fechado durante a prova | ver 4.2 |
| Placar e nota só o professor grava | campos `nota`, `acertos`, `notaPrevia` fora da lista do aluno |

### 4.2 Como o gabarito fica fechado até o fim

A questão é guardada **em dois lugares**:

- `bancos/{banco}/questoes/{q}`: enunciado, alternativas, tipo, tema, peso. **O aluno lê.**
- `bancos/{banco}/gabaritos/{q}`: índice da alternativa correta, respostas aceitas, palavras-chave, explicação. **O aluno só lê se existir o documento `marcadores/{uid}_{q}`.**

O **marcador** só pode ser criado pelo aluno se a tentativa dele **já estiver finalizada** e a questão **for uma das dele**. Ou seja: nem com "ir e voltar", nem mexendo no console, ele lê a resposta antes de terminar. Ao reabrir a prova, o professor **apaga os marcadores** daquele aluno.

Com uma API própria (sem Firestore), fica mais simples: o endpoint do gabarito confere `tentativa.finalizadaEm != null` antes de responder. **Nunca mande a resposta certa junto com a questão.**

### 4.3 Sorteio

- O sistema de origem sorteia **no navegador** e as regras conferem quantidade e banco. Funciona, mas um aluno técnico poderia escolher as próprias questões. **Na faculdade, prefira sortear no servidor** (função ou endpoint que cria a tentativa).
- Sorteio por **tema** e por **tipo**: a avaliação define "N alternativas + M dissertativas, dos temas X, Y, Z". O sistema não deixa criar a avaliação se os temas não tiverem questões suficientes.
- A ordem das questões e das alternativas é embaralhada **por aluno**, com semente fixa (ex.: hash do `uid + avaliacaoId`), para não mudar se ele recarregar.

---

## 5. Modelo de dados (referência)

Nomes em português, como no sistema de origem. Adapte à stack.

```text
materias/{materiaId}
  nome, professores[], avaliacoesAtivas: bool      ← liga o botão "Atividades e Avaliações"

turmas/{turmaId}
  nome, materiaId, emails[]                         ← quem pode fazer

bancos/{bancoId}
  nome, materiaId
  questoes/{qId}   tipo: "alternativa" | "dissertativa", tema, enunciado, alternativas[], peso
  gabaritos/{qId}  correta (índice, 0 = primeira), respostasAceitas[], palavrasChave[], correcaoManual, explicacao

avaliacoes/{avaliacaoId}
  titulo, tipo: "avaliacao" | "atividade", materiaId, turmaId, bancoId, temas[]
  nAlternativas, nDissertativas, nQuestoes
  tempoMinutos (0 = sem limite), abreEm, fechaEm, liberada: bool
  modoExibicao: "uma-por-vez" | "todas"
  permitirVoltar: bool
  exigirTelaCheia: bool (padrão true)
  toleranciaSaidas: int (padrão 0)                  ← 0 = encerra na primeira
  permitirRetomarAposInterrupcao: bool (padrão false)
  permitirMovel: bool (padrão false)
  materialConsulta: [ids de PDF] | url | null
  codigoAcesso: string | null
  mostrarNotaAoFinalizar: bool
  resultadosLiberados: bool                         ← gabarito comentado visível ao aluno

tentativas/{uid}_{avaliacaoId}
  uid, email, nome, avaliacaoId, bancoId, questoesIds[]
  iniciadaEm (servidor), finalizadaEm (servidor) | null, indiceAtual
  encerradaPor: null | "altTab" | "teclaSistema" | "saidaJanela" | "telaCheia" | "interrompida" | "tempo"
  tempoTotalSegundos, ultimoSinal
  tentativasColar, saidas                           ← contadores (só aumentam)
  minutosExtras, reabertaEm, reabertaPor, motivoReabertura
  acertos, totalQuestoes, notaPrevia, nota, corrigidaEm, corrigidaPor
  respostas/{qId}   resposta, enviadaEm (servidor), atualizadaEm, segundos
  correcoes/{qId}   pontos, comentario, por, em, origem: "manual" | "ia"
  eventos/{id}      tipo, questaoIndice, em (servidor), detalhe, segundosFora   ← linha do tempo

marcadores/{uid}_{qId}                              ← libera o gabarito daquela questão
```

---

## 6. Correção e resultado

- **Alternativas:** corrigidas na hora, comparando o índice escolhido com `correta` (lembrando que a ordem foi embaralhada: guarde o índice **original**).
- **Dissertativas automáticas:** a resposta é normalizada (sem maiúsculas, sem espaços extras, sem espaços perto de `( ) , = ;`, sem `;` final) e comparada com `respostasAceitas`. Se não bater, confere se **todas** as `palavrasChave` aparecem. Se nada bater, vai para **revisar**.
- **Dissertativas manuais** (`correcaoManual: true`): vão direto para revisar.
- **Correção por IA (opcional):** o sistema de origem usa a API da Anthropic (Claude) para sugerir pontos e comentário nas que ficaram em revisar. A chave **nunca** fica no código nem na página do aluno: fica num documento que só o administrador lê, ou num servidor (Cloudflare Worker) com a chave em segredo. **A correção manual sempre vale mais que a da IA**, e a da IA aparece marcada para o professor conferir.
- **Nota:** soma dos pesos acertados, convertida para a escala da faculdade (0–10 ou 0–100; pergunte).
- **Fechar notas:** grava a nota final em cada tentativa.
- **Liberar resultado:** o aluno passa a ver, por questão, a resposta dele, a certa, a explicação e o comentário do professor, e baixa o PDF.
- **Exportar:** CSV para a planilha/sistema acadêmico e PDF da turma.

---

## 7. Painel do professor (mínimo)

Dentro da mesma matéria, visível só para o professor:

1. **Bancos de questões:** importar JSON (formato abaixo), ver temas e quantidades por tipo.
2. **Avaliações:** criar, editar, abrir, encerrar. Depois que algum aluno começou, **banco, número de questões e temas ficam travados** (mudariam o sorteio de quem já começou). Título, horários, tempo e opções podem mudar.
3. **Testar como aluno:** abre a avaliação em modo teste (faixa "MODO TESTE" no topo), mesmo fechada. A tentativa de teste tem ID separado (`teste_{uid}_{avaliacao}`) e **nunca entra** em notas, médias ou exportações.
4. **Acompanhar ao vivo:** lista dos alunos com situação (não começou / em andamento / finalizou / encerrado), questão atual, último sinal de vida, e a **linha do tempo de eventos** de cada um.
5. **Resultados:** por aluno, respostas, correção, eventos e tempos (respostas em menos de 5 s destacadas). Botões: **Reabrir** (com motivo), **Dar minutos extras**, **Corrigir**, **Fechar notas**, **Liberar resultado**, **Exportar**.
6. **"Não fizeram":** quem está na turma e não começou.

Formato do banco (JSON), igual ao do sistema de origem:

```json
{
  "nome": "BD II — Normalização",
  "materia": "Banco de Dados II",
  "questoes": [
    { "tipo": "alternativa", "tema": "2FN", "enunciado": "…", "alternativas": ["a", "b", "c", "d"],
      "correta": 1, "explicacao": "Por que a b é a certa", "peso": 1 },
    { "tipo": "dissertativa", "tema": "SQL", "enunciado": "Escreva o comando…",
      "respostasAceitas": ["SELECT COUNT(*) FROM aluno;"], "palavrasChave": ["select count(*)", "from aluno"],
      "explicacao": "…", "peso": 2 },
    { "tipo": "dissertativa", "enunciado": "Explique…", "correcaoManual": true, "explicacao": "…", "peso": 2 }
  ]
}
```

---

## 8. Detalhes de experiência que valem copiar

- **Instruções antes de começar** listam **só as regras daquela avaliação** e deixam a tolerância zero explícita: "Ao iniciar, a avaliação entra em tela cheia. Sair da tela cheia, trocar de janela ou pressionar Alt, Windows ou Esc **encerra a avaliação imediatamente**. Colar está desativado." O aluno marca "Li e concordo".
- **`requestFullscreen()` precisa ser chamado direto no clique de "Iniciar"**, antes de qualquer `await`, senão o navegador recusa.
- **Uma por vez** ou **todas na página**; com ou sem **ir e voltar**. Sem ir e voltar, a resposta enviada trava. Com ir e voltar, salva sozinho ao trocar de questão e só "Finalizar" trava tudo; "Finalizar" avisa quais questões estão sem resposta.
- **Botão de enviar trava enquanto grava** (evita duplo envio).
- **Queda de internet:** a resposta fica na tela, aparece uma faixa "Sem conexão. Não feche a página." e o aluno reenvia quando voltar.
- **Cronômetro regressivo** (se tiver tempo). Ao zerar, finaliza com o que já foi salvo, `encerradaPor = "tempo"`. O cronômetro conta a partir do `iniciadaEm` **do servidor**, mais minutos extras do professor ou de acessibilidade.
- **Material de consulta** (opcional) dentro da própria tela, numa coluna redimensionável. Use **PDF** (não PPT): o sistema de origem tem um leitor de PDF embutido. Clicar no material não conta como saída (ver 3.3).
- **Sem feedback por questão.** Ao finalizar, no máximo "Você acertou X de N" e a nota prévia, se o professor quiser. Dissertativas pendentes: "N respostas dissertativas ainda serão corrigidas; a nota pode mudar."
- **Acessibilidade institucional (sem gamificação):** por aluno, tempo extra, fonte maior, alto contraste, e (se o professor quiser) tolerância de saídas diferente de zero para alunos com laudo. Isso fica no painel e o aluno não vê o laudo.

---

## 9. Esboço do módulo de integridade (referência de código)

Ponto de partida, a partir do que funciona no sistema de origem, já adaptado para tolerância zero. Ajuste nomes e a camada de gravação.

```js
let ativa = false, encerrando = false;

function provaAtiva() { return ativa && !encerrando && tentativa && !tentativa.finalizadaEm; }

async function encerrar(motivo, detalhe = "") {
  if (!provaAtiva()) return;
  encerrando = true;
  mostrarCamada("Encerrando a avaliação…");
  await registrarEvento(motivo, detalhe);                 // eventos/{id}: tipo, questaoIndice, em: serverTimestamp()
  await aguardarEnviosEmAndamento();
  if (avaliacao.permitirVoltar) await comLimite(salvarAlteradas(), 15000).catch(() => {});
  await finalizarNoServidor({ encerradaPor: motivo });    // confere no servidor se falhar
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  mostrarTelaEncerrada(motivo);
}

// 1) Teclas: Alt sozinho, Windows/Command, F12, Ctrl+Shift+I → encerra. AltGr → ignora.
document.addEventListener("keydown", e => {
  if (!provaAtiva()) return;
  const k = e.key;
  const altGr = k === "AltGraph" || e.getModifierState?.("AltGraph") || (e.ctrlKey && e.altKey);
  if (altGr) return;
  if (k === "Alt" || e.altKey)        { e.preventDefault(); encerrar("altTab"); return; }
  if (k === "Meta" || k === "OS")     { e.preventDefault(); encerrar("teclaSistema"); return; }
  if (k === "F12" || (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(k.toLowerCase()))) { e.preventDefault(); encerrar("ferramentasDev"); return; }
  const ctrl = e.ctrlKey || e.metaKey, kk = k.toLowerCase();
  if (ctrl && ["c", "a", "p", "s", "u"].includes(kk)) { e.preventDefault(); avisoDiscreto("Atalho desativado durante a avaliação."); }
}, true);   // captura: roda antes de qualquer outro tratador

// 2) Rede de segurança: perdeu o foco ou a aba ficou oculta → encerra.
const focoNoMaterial = () => document.activeElement === document.querySelector("#materialFrame");
window.addEventListener("blur", () => setTimeout(() => {
  if (focoNoMaterial() && !document.hidden) return;       // clicou no PDF de consulta: não é saída
  encerrar("saidaJanela");
}, 0));
document.addEventListener("visibilitychange", () => { if (document.hidden) encerrar("saidaJanela"); });
setInterval(() => { if (provaAtiva() && temMaterial() && !document.hasFocus()) encerrar("saidaJanela"); }, 1000);

// 3) Tela cheia
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) encerrar("telaCheia"); });

// 4) Fechar/recarregar: pede confirmação. Se sair mesmo, ao voltar a tentativa aberta é tratada como "interrompida" (3.6).
window.addEventListener("beforeunload", e => { if (provaAtiva()) { e.preventDefault(); e.returnValue = ""; } });

// 5) Sinal de vida
setInterval(() => { if (provaAtiva()) gravarUltimoSinal(); }, 25000);
```

> Se o professor configurar `toleranciaSaidas > 0` para algum aluno (acessibilidade), troque `encerrar(...)` por "contar a saída e só encerrar ao passar do limite", **sem** mostrar corações ou "chances" ao aluno: só "Saída registrada (1 de 2). Na próxima, a avaliação será encerrada."

---

## 10. Como construir: incremental, com aprovação antes de soltar para os alunos

**Regra de ouro: nada fica visível para os alunos até o professor aprovar.** Use uma chave por matéria (`avaliacoesAtivas`) **desligada** por padrão, e um modo de pré-visualização só para o professor.

Construa nesta ordem e **pare nos pontos de aprovação** (⏸), mostrando ao professor o que foi feito.

### Etapa 1: cara inicial (protótipo navegável, sem dados reais)
- O botão **"Atividades e Avaliações"** na tela da matéria, ao lado de Drive e Teams, **visível só em modo de pré-visualização** (ex.: `?previa=1` ou só para o e-mail do professor).
- Telas estáticas, com dados fictícios: lista de avaliações, instruções, uma prova com 3 questões (uma alternativa, duas dissertativas), tela de "Avaliação encerrada", tela de resultado.
- A prova do protótipo **já com o módulo de integridade funcionando** (tela cheia, Alt, Windows, blur, Esc, colar bloqueado), porque é a parte mais sensível e o professor precisa sentir como fica.
- Seguindo o visual do sistema de aulas, sóbrio, sem gamificação.

⏸ **Aprovação 1:** mandar ao professor o link da pré-visualização + capturas das telas. Perguntar: visual, textos das regras, comportamento do encerramento, AltGr no teclado dele e escala da nota (0–10 ou 0–100). (O login já está decidido: Microsoft.)

### Etapa 2: login e turmas
- Login **Microsoft (Entra ID, single tenant)** só na área do módulo. Para isso, o professor ou a TI da faculdade precisa registrar o app no Entra ID e passar o **ID do tenant** e o **ID do aplicativo (client ID)**; peça isso no início desta etapa. Recusa de contas de fora do domínio.
- Turmas com lista de e-mails. Regras no servidor.

⏸ **Aprovação 2:** professor entra com a conta dele e com uma conta de aluno de teste.

### Etapa 3: banco, avaliação, tentativa (servidor de verdade)
- Importar banco JSON, criar avaliação, sorteio, tentativa, respostas, finalização, encerramento, gabarito fechado.
- **Testar como aluno** e **acompanhar ao vivo**.

⏸ **Aprovação 3:** professor faz uma avaliação de teste completa, tenta Alt+Tab, Esc, colar, recarregar, e confere o que aparece no painel.

### Etapa 4: correção, notas, resultado, reabertura, exportação

⏸ **Aprovação 4:** ciclo completo com uma turma pequena ou com contas de teste.

### Etapa 5: liberar para os alunos
- Só depois das quatro aprovações o professor liga `avaliacoesAtivas` na matéria.
- Primeira avaliação real: de preferência uma **atividade sem nota**, para os alunos conhecerem as regras.

**Em cada entrega, diga ao professor com clareza:** o que foi feito, o que foi testado (e como), o que **não** foi testado, e o que depende de configuração dele (publicar regras do banco, chaves, domínio).

---

## 11. Checklist de testes antes de liberar

- [ ] Alt sozinho encerra; **AltGr + Q (`/`) e AltGr + W (`?`) não encerram** (teclado ABNT2).
- [ ] Tecla Windows encerra. Win+V encerra.
- [ ] Alt+Tab, clicar na barra de tarefas, clicar em outro monitor: encerra.
- [ ] Esc / F11 (sair da tela cheia): encerra.
- [ ] Ctrl+V, Shift+Insert, botão direito → Colar, arrastar texto: **nada entra no campo**, a avaliação continua, o contador do professor sobe.
- [ ] Ctrl+C no enunciado não copia. Selecionar o enunciado não funciona.
- [ ] Clicar e rolar o PDF de consulta **não** encerra.
- [ ] Recarregar a página no meio: comportamento conforme 3.6 (encerra ou retoma, conforme a opção).
- [ ] Desligar o Wi-Fi no meio, responder, ligar de novo: a resposta é gravada.
- [ ] Encerramento com resposta sendo enviada: a resposta não se perde.
- [ ] Pelo console do navegador, tentar ler o gabarito antes de finalizar: **recusado pelo servidor**.
- [ ] Pelo console, tentar criar uma segunda tentativa, mudar `questoesIds`, apagar `finalizadaEm`, zerar contadores: **recusado**.
- [ ] Aluno fora da turma: não vê e não consegue começar.
- [ ] Conta de fora do domínio: recusada.
- [ ] Reabrir pelo professor: a tela do aluno atualiza sozinha; gabarito volta a ficar fechado; motivo fica registrado.
- [ ] Tentativa de teste do professor não aparece nas notas nem no CSV.
- [ ] Celular: avaliação com nota não deixa iniciar.
- [ ] Nenhum emoji, mascote, vida, XP ou conquista em lugar nenhum.

---

## 12. Referência: arquivos do sistema de origem

Se você tiver acesso ao repositório `prova_senai`, estes são os trechos que valem ler:

| Arquivo | O que tem |
|---|---|
| `js/aluno.js`, seção "ANTIFRAUDE" | tela cheia, blur/visibilitychange, foco no material de consulta, bloqueio de colar e atalhos, encerramento |
| `js/aluno.js`, `btnComecar` e `finalizar()` | criação da tentativa, sorteio, finalização com conferência no servidor, marcadores |
| `firestore.rules`, `tentativas`, `respostas`, `gabaritos`, `marcadores` | todas as regras de servidor da seção 4 |
| `js/common.js` | normalização e correção automática das dissertativas |
| `README.md`, seções "No dia da prova", "Opções de cada prova", "Antifraude", "Testar como aluno" | comportamento descrito do ponto de vista do professor |

**Lembre de não trazer:** `js/mascotes*.js`, `js/conquistas.js`, `js/aluno-conquistas.js`, `js/aluno-recompensas.js`, `js/avatar.js`, `js/fundos-perfil.js`, `js/admin-gamificacao.js`, e toda a lógica de "vidas" e "perder a questão".
