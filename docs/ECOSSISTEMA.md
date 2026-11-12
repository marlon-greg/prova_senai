# Ecossistema SENAI: aulas · autoavaliação · provas

> **Registro de decisões (12/11/2026).** Substitui a parte de "tópicos" de `docs/INTEGRACOES.md`: a ponte entre
> os sistemas agora são os **critérios de avaliação** do plano de ensino (IDs estáveis), não nomes de tópico.
> Este arquivo e os três módulos citados abaixo ficam **neste repositório** (`prova_senai`), que é a fonte da verdade.

## 1. A ideia: três vertentes que se conversam

| Vertente | Sistema | Pergunta | Evidência |
|---|---|---|---|
| **Participação** | Aulas | O aluno teve a aula, participou, treinou, entregou as atividades no prazo? | presença, respostas e acertos na aula, dúvidas, anotações, entregas, treinos |
| **Declaração** | Autoavaliação | O aluno diz que consegue fazer o que o critério pede? | Consigo / Consigo em parte / Ainda não consigo |
| **Comprovação** | Provas | O aluno comprovou na avaliação com nota? | nível da rubrica por critério |

Cruzando as três (`situacaoCriterio` em `js/evidencias.js`), cada aluno, em cada critério, cai numa situação com ação:

| Situação | Quando | Ação do professor |
|---|---|---|
| Domínio confirmado | comprovou e disse que sabe | segue em frente |
| Ilusão de saber | disse que sabe e não comprovou | mostrar o erro, reforçar o conteúdo |
| Sabe e não acredita | comprovou e disse que não sabe | trabalhar a confiança |
| Dificuldade real | não comprovou e reconhece | reforço de conteúdo prioritário |
| Faltou às aulas do critério | não participou e não comprovou | recuperar o conteúdo antes de cobrar |
| Cobrado sem aula | a prova cobrou um critério que a turma não teve em aula | rever o plano ou a prova |
| Sem autoavaliação | falta a declaração | pedir a autoavaliação |

As **socioemocionais** ganham evidência concreta da participação (`extras.sinal` nos critérios de `plano-ensino.js`):
prazo (C40) ← atividades entregues no prazo; tempo (C42) ← presença; busca (C49) e iniciativa (C50) ← treinos por conta
própria; coopera (C47) ← trabalho em grupo. As demais são observação do professor, pela rubrica.

## 2. Decisões

1. **Aulas e provas no mesmo projeto Firebase: `prova-senai-3e983`.** Mesmo login (o aluno é o mesmo `uid` e e-mail
   em todos), mesmas **turmas** (`turmas/`), mesma **equipe** (`equipe/{email}.papel`: admin, professor, auxiliar,
   inclusao; superadmin `marlon.frodrigues@docente.senai.br`), mesmos domínios de aluno (`config/geral.dominiosAlunos`).
   Nada de sincronizar dados entre projetos.
   - O **Revisão SAEP** (`revisao-saep`, projeto Firebase próprio) continua como está: é outro produto.
   - O **sistema de aulas** é um repositório novo feito a partir do código do Revisão SAEP, mas ligado a **este** projeto.
   - A **autoavaliação** (do colega) **fica no Supabase**, onde já está no ar. A ligação é por uma **ponte no Worker**
     `prova-senai` (`servidor/integracao.js`), automática e sem exportar nada:
     - **ida:** um Database Webhook do Supabase chama `POST /integracao/autoavaliacao` a cada resposta, e o Worker grava a
       evidência `autoavaliacao` aqui;
     - **volta:** `GET /integracao/situacao` devolve a situação por aluno e critério;
     - **segurança:** cabeçalho `x-chave` = segredo `INTEGRACAO_CHAVE` (Cloudflare), só servidor com servidor.
     Detalhes em `docs/CONTRATO-AUTOAVALIACAO.md`.
2. **Regras do Firestore: um arquivo só**, `prova_senai/firestore.rules`, publicado sozinho pelo GitHub Actions a cada
   push na `main` (se não compilar, o Firebase recusa e as regras antigas continuam). Cada sistema edita **só a sua
   seção**, entre os marcadores `// >>> AULAS` … `// <<< AULAS` e `// >>> AUTOAVALIACAO` … `// <<< AUTOAVALIACAO`
   (antes: `git pull`; depois: commit pequeno "Regras: …").
3. **Coleções com dono** (ninguém escreve na coleção do outro, a não ser `evidencias`):

   | Coleção | Dono | Quem grava | Quem lê |
   |---|---|---|---|
   | `turmas`, `equipe`, `config` | provas | professor/admin | todos os sistemas |
   | `provas`, `tentativas`, `bancos`, `materiais`… | provas | provas | provas |
   | `aulas`, `aulasAtividades`, `aulasEntregas`, `aulasSessoes` | aulas | aulas | aulas; provas lê `aulas` |
   | (respostas, recuperações) | autoavaliação | no **Supabase** dele | só a evidência resumida vem para cá |
   | **`evidencias`** | **comum** | cada sistema, só as suas fontes | equipe; o aluno lê as dele |

4. **Contrato comum em 3 módulos, importados direto do site publicado** (nada de cópia, nada de sincronizar):
   - `js/plano-curso.js`: as 12 UCs, as capacidades, as socioemocionais e os conhecimentos (IDs `bd`, `bd.ct9`, `bd.cs2`, `bd.k2.4`).
   - `js/plano-ensino.js`: os critérios (`bd.cr25`) com a explicação para o aluno e as avaliações previstas por turma.
   - `js/evidencias.js`: o formato das evidências, as escalas, os sinais socioemocionais e o cruzamento das três vertentes.

   Os outros sistemas fazem `import { … } from "https://marlon-greg.github.io/prova_senai/js/plano-ensino.js"` (o GitHub Pages libera CORS).
   Mudou o plano aqui, com push, os três sistemas passam a usar a versão nova sozinhos. Ninguém edita esses módulos fora daqui.
5. **Quem grava cada evidência** (`evidencias/{fonte}__{ref}__{email}`):

   | Fonte | Quando | Quem grava | Conteúdo |
   |---|---|---|---|
   | `aula` | ao encerrar a sessão ao vivo (ou marcar a aula como dada) | professor, no sistema de aulas | critérios trabalhados (`trabalhado: true`, `valor` = acerto nas questões da aula ligadas ao critério) + participação |
   | `atividade` | ao fechar o prazo ou devolver | professor, no sistema de aulas | entregue, no prazo, desempenho por critério (sem nota) |
   | `treino`, `simulado` | ao terminar | o próprio aluno | desempenho por critério; `espontaneo: true` se não foi pedido |
   | `autoavaliacao` | ao enviar (webhook do Supabase) | o Worker, pela ponte | nível declarado por critério (`origem: "supabase"`) |
   | `prova` | após a correção | sistema de provas (painel ou Worker) | nível da rubrica por critério |

   Nenhuma nota depende do que o próprio aluno gravou.
6. **Login igual ao do sistema de provas.** O login usa o Google Identity Services, com token e
   `signInWithCredential` (ver `entrar()` em `js/common.js` e o `GOOGLE_CLIENT_ID` em `js/firebase-config.js`).
   O motivo é que a rede do SENAI bloqueia `*.firebaseapp.com`.
7. **Hospedagem:** provas no GitHub Pages; aulas no **Netlify ou Vercel** (site estático). Ao publicar:
   - Firebase → Authentication → Authorized domains: adicionar o domínio;
   - Google Cloud → Credentials → OAuth Client: adicionar a origem;
   - se usar o Worker: incluir o domínio em `ORIGENS` (`wrangler.toml` e painel da Cloudflare).

   O domínio próprio, com um subdomínio por sistema, continua recomendado (`docs/INTEGRACOES.md`, seção 1).
8. **Servidor:** já existe o Cloudflare Worker `prova-senai` (conta de serviço + IA). O que precisar de privilégio
   (gravar em nome do sistema, IA) vira uma nova `acao` no Worker, pedida ao mantenedor deste repositório. Não crie
   outra conta de serviço.
9. **Design:** o mesmo design system do sistema de provas (seção 3).

## 3. Design system (seguir em todas as telas fora do slide projetado)

Fonte: `css/style.css` (tokens em `:root` e componentes), `js/ui.js` (componentes), `js/icones.js` (ícones SVG) e
`ui-demo.html` (vitrine de todos os componentes; abrir no navegador).

- **Cores:** marinho `#14213d` (títulos, menu lateral) e marinho-2 `#1f3160` (links, foco); **vermelho `#c8102e` só
  para a ação primária e para erro**; verde `#12805c` sucesso; azul `#2459c7` informação; âmbar `#f5a524` pendência.
  Fundo `#f4f6fb`, cartão branco, bloco interno `#f4f6fb`, borda `#e8ecf3`, texto `#1a2233`, texto suave `#5d6b82`.
- **Tipografia:** Poppins nos títulos, Inter no texto, Consolas no código. Escala 12/13/14/15/17/20/26 px.
- **Forma:** raio 16 px (cartão), 12 px e 10 px (campos e botões), pílula nos chips; sombra suave; anel de foco marinho.
- **Componentes:**
  - menu lateral marinho;
  - cartões (`.card`) com blocos internos;
  - seções numeradas (`.pc-secao`);
  - `collapsible` sempre começando **fechado**;
  - `chips` e `statTiles`;
  - `drawer` para formulários;
  - `toolbar` com busca e filtros;
  - `toast` e `confirmar()` antes de toda gravação ou exclusão;
  - estado vazio com `vazio()`.
- **Slides projetados** (deck ao vivo) podem manter o visual próprio do Revisão SAEP (`deck.css`). Painel, listas,
  atividades, relatórios e telas do aluno seguem este design.
- Temas claro/escuro/alto contraste e tamanho de letra (acessibilidade) seguem as mesmas variáveis.

## 4. Ordem de construção

1. Aulas: login e turmas deste projeto; estrutura das aulas de BD (1A e 1B) a partir dos planos de ensino.
2. Aulas: "O que vamos aprender hoje" (critérios explicados), sessão ao vivo e evidência `aula` ao encerrar.
3. Aulas: aba Atividades (treino e lançadas) com `aulasEntregas` e evidências `atividade`/`treino`.
4. Autoavaliação: perguntas com os IDs dos critérios + webhook do Supabase para a ponte (`docs/CONTRATO-AUTOAVALIACAO.md`).
5. Provas: ligar questões/rubrica aos critérios, gravar a evidência `prova` e montar o **boletim por critério**
   (aluno e turma) com as três vertentes.
