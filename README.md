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
- **Trocas de aba** durante a prova são contadas e aparecem para o professor.
- Se a aba fechar, o aluno entra de novo e **continua de onde parou**.
- O aluno só consegue ler a resposta certa de uma questão **depois** de responder (regra do Firestore, não só da tela).

## Depois da prova — corrigir e divulgar

1. Aba **Resultados** → escolha a prova → **Carregar**.
2. Alternativas são corrigidas sozinhas. Dissertativas que o sistema reconheceu também. As que ele não reconheceu ficam como **revisar**: clique em **Ver** no aluno, dê os pontos e um comentário → **Salvar**.
3. **Fechar notas** grava a nota final (0–100) em cada tentativa. **Baixar CSV** exporta para a planilha.
4. Aba **Bancos → Gabarito p/ Classroom**: gera o texto com todas as questões, respostas e explicações → copie e poste no Classroom.
5. Aba **Provas → Liberar resultados**: o aluno passa a ver, questão por questão, o que respondeu, o que era o certo, **por quê**, e o comentário do professor.

---

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
| enunciado | aceita quebras de linha e trechos entre crases para aparecer como código: `` `SELECT * FROM x;` `` |

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
- Não há cronômetro. Se quiser limite de tempo, encerre a prova pelo painel na hora combinada.

## Testar antes do dia (recomendado)
1. Entre em `admin.html` com a sua conta, importe o modelo, crie uma prova de teste e libere.
2. Entre em `index.html` com uma conta `@edu.senai.br` (peça a um aluno ou use uma conta de teste) e faça a prova.
3. Teste também com um Gmail comum: deve aparecer **"Conta não autorizada"**.
4. Volte ao painel, confira Resultados, corrija uma dissertativa, feche as notas, libere o resultado e veja como aluno.

Se quiser rodar tudo localmente sem gastar o Firebase: `npm install -g firebase-tools`, mude `USAR_EMULADOR` para `true` em `js/firebase-config.js`, rode `firebase emulators:start` nesta pasta e abra `http://localhost:5000`. (Volte para `false` antes de publicar.)
