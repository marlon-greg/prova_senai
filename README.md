# Prova Online — SENAI (Firebase + GitHub Pages)

Sistema de prova prática: o aluno entra com a conta Google do SENAI, recebe **10 questões sorteadas** de um banco maior, responde **uma por vez** (sem voltar, sem colar), e o professor corrige, fecha as notas, gera o gabarito para o Classroom e libera o resultado com a explicação de cada erro.

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
4. Aba **Provas**: crie a prova (título, turma, banco, 10 questões, tipo de feedback) → ela nasce **fechada**.

---

## No dia da prova

| Quando | O quê |
|---|---|
| Antes | Aba Provas → **Liberar prova** |
| Durante | Aluno abre o link, entra com `@edu.senai.br` ou `@aluno.senai.br`, clica **Fazer a prova** |
| Depois | Aba Provas → **Encerrar** (quem não começou não consegue mais) |

Regras que o sistema aplica sozinho:
- **Uma tentativa por aluno** (ID da tentativa = aluno + prova). Para deixar alguém refazer, o admin apaga a tentativa em Resultados (botão ↺) e o aluno recebe um sorteio novo.
- **Questões sorteadas e alternativas embaralhadas** por aluno.
- **Uma questão por vez**: a resposta é gravada ao clicar em Enviar e não pode ser alterada; só então aparece a próxima.
- **Colar desativado** nos campos de texto (Ctrl+V, botão direito, arrastar).
- **Tela cheia, trocas de aba e tentativas de colar** são registradas e aparecem para o professor (veja [Antifraude](#antifraude)).
- Se a aba fechar, o aluno entra de novo e **continua de onde parou**.
- O aluno só consegue ler a resposta certa de uma questão **depois** de responder (regra do Firestore, não só da tela).
- **Ao finalizar, o aluno já vê a nota prévia** (0–100), sem ver respostas nem explicações. Dissertativas não reconhecidas entram como "aguardando correção" e a nota pode subir depois.

## Depois da prova — corrigir e divulgar

1. Aba **Resultados** → escolha a prova → **Carregar**.
2. Alternativas são corrigidas sozinhas. Dissertativas que o sistema reconheceu também. As que ele não reconheceu ficam como **revisar**: clique em **Ver** no aluno, dê os pontos e um comentário → **Salvar**.
3. **Fechar notas** grava a nota final (0–100) em cada tentativa; ela substitui a nota prévia na tela do aluno.
   Exportações: **CSV** (planilha) · **PDF — notas da turma** (lista) · **PDF — boletim de todos** (um boletim por aluno, com resposta, correta e explicação, pronto para subir no Drive) · **PDF deste aluno** (dentro do Ver). Os PDFs abrem a janela de impressão do navegador: escolha *Salvar como PDF*.
4. Aba **Bancos → Gabarito p/ Classroom**: gera o texto com todas as questões, respostas e explicações → copie e poste no Classroom.
5. Aba **Provas → Liberar resultados**: o aluno passa a ver, questão por questão, o que respondeu, o que era o certo, **por quê**, e o comentário do professor.

---

## Várias matérias e várias provas
Cada **banco** tem um campo `materia`. Importe um banco por tema (DML, Normalização, Front-End, IoT…) e crie quantas provas quiser apontando para o banco certo. Um banco pode servir a várias provas (1A e 1B, por exemplo) — o sorteio é diferente para cada aluno.

## Formato do banco de questões (JSON)

```json
{
  "nome": "MS5 — DML",
  "materia": "Banco de Dados",
  "questoes": [
    { "tipo": "alternativa", "enunciado": "Pergunta...", "alternativas": ["a", "b", "c", "d"],
      "correta": 1, "explicacao": "Por que a b é a certa", "peso": 1 },
    { "tipo": "dissertativa", "enunciado": "Escreva o comando...",
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
| enunciado | aceita quebras de linha. Trecho entre crases vira código na linha: `` `SELECT * FROM x;` ``. Entre três crases (```` ``` ````) vira bloco de código. |

Dica: peça ao Claude/ChatGPT "gere um banco de questões no formato do modelo_banco.json sobre o tema X" e cole o resultado em **Validar**.

---

## Segurança — o que as regras garantem

| Risco | Como está tratado |
|---|---|
| Aluno ler o gabarito antes de responder | `gabaritos/` só pode ser lido pelo aluno depois que existe o marcador da resposta dele (`marcadores/uid_questao`), criado no mesmo lote que grava a resposta |
| Aluno mudar uma resposta enviada | `respostas/` é só criação; update é negado para todos (admin pode apagar) |
| Aluno fazer a prova duas vezes | o ID da tentativa é fixo (`uid_prova`); só admin apaga |
| Aluno trocar as questões sorteadas | `questoesIds` não pode ser alterado depois de criado |
| Aluno de fora (gmail etc.) | só domínios de `config/geral.dominiosAlunos` passam nas regras |
| Aluno ver tentativa de outro | leitura restrita ao dono e à equipe |
| Auxiliar mexer em prova/banco | só `admin` e `professor` escrevem; `auxiliar` só lê |

Limites conhecidos (sem Cloud Functions, para ficar no plano gratuito):
- O **sorteio** das 10 questões é feito no navegador do aluno. Um aluno com conhecimento técnico poderia escolher quais 10 vai receber, mas **nunca** consegue ler a resposta antes de enviar a sua.
- A correção automática também roda no navegador; a nota "fechada" é gravada **pelo professor**, nunca pelo aluno.
- O cronômetro (campo **Tempo limite**) usa o relógio do computador do aluno. Para um limite rígido, encerre também a prova pelo painel na hora combinada.

## Antifraude

Durante a prova (tela das questões) o sistema **impede** algumas coisas e **registra** outras. Tudo o que é registrado aparece em **Resultados** (colunas *Tempo* e *Sinais*, detalhe do aluno, CSV e PDFs).

**O que o sistema impede**
| O quê | Como |
|---|---|
| Ler a resposta certa antes de responder | regra do Firestore (`gabaritos/` só abre depois do marcador da resposta) |
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
Na aba **Provas** do painel, cada prova tem o botão **Testar como aluno**: ele abre `index.html?teste=<id da prova>` em nova aba e você faz a prova exatamente como o aluno (uma questão por vez, sem voltar, colar bloqueado, mesmo feedback), **mesmo com a prova ainda fechada**.
- Uma faixa amarela **MODO TESTE** fica no topo; o botão **Reiniciar teste** apaga a tentativa e recomeça.
- A tentativa de teste (`teste_<seu uid>_<prova>`, campo `teste: true`) **não aparece** em Resultados, média, CSV, PDFs nem em "Fechar notas".
- Ao finalizar, aparece a nota prévia e o botão **Ver resultado** (sempre, no teste), para conferir a tela que o aluno verá.
- **Apagar meu teste** (na aba Provas) apaga a sua tentativa de teste daquela prova, para testar de novo.

> ⚠ Depois de alterar `firestore.rules`, cole as regras de novo no **Firebase Console → Firestore → Regras → Publicar**. O GitHub Pages publica só o site, não as regras.

## Testar antes do dia (recomendado)
1. Entre em `admin.html` com a sua conta, importe o modelo, crie uma prova de teste e libere.
2. Entre em `index.html` com uma conta `@edu.senai.br` (peça a um aluno ou use uma conta de teste) e faça a prova.
3. Teste também com um Gmail comum: deve aparecer **"Conta não autorizada"**.
4. Volte ao painel, confira Resultados, corrija uma dissertativa, feche as notas, libere o resultado e veja como aluno.

Se quiser rodar tudo localmente sem gastar o Firebase: `npm install -g firebase-tools`, mude `USAR_EMULADOR` para `true` em `js/firebase-config.js`, rode `firebase emulators:start` nesta pasta e abra `http://localhost:5000`. (Volte para `false` antes de publicar.)
