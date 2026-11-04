# Integrações futuras e domínio próprio

> **Registro de decisão (04/11/2026):** este sistema de provas **vai ser ligado** a outros dois sistemas do mesmo autor:
> 1. **Sistema de aulas interativas**
> 2. **Sistema de autoavaliação**: o aluno responde depois das atividades **formativas** em sala, dizendo onde sente dificuldade, e o professor aplica **reforço** nesses pontos.
>
> Tudo o que for construído aqui deve facilitar essa ligação (ver "Regras para o código de hoje", no fim).

---

## 1. Domínio próprio (recomendação)

Hoje o site está em `marlon-greg.github.io/prova_senai`. Para ficar profissional e servir aos 3 sistemas:

- **Um domínio só para o "ecossistema"**, com um subdomínio por sistema. Exemplo (o nome é só ilustração):
  - `provas.NOME.com.br` → este sistema
  - `aulas.NOME.com.br` → aulas interativas
  - `autoavaliacao.NOME.com.br` → autoavaliação
  - `NOME.com.br` → página inicial com o login único e os atalhos para os três
- **Onde registrar:** `.com.br` no Registro.br (≈ R$ 40/ano). O DNS pode ficar na **Cloudflare** (grátis), que já hospeda o servidor de correção.
- **Login único (SSO):** os três sistemas usando **o mesmo projeto Firebase** (ou pelo menos o mesmo Firebase Auth). Assim o aluno entra uma vez com a conta Google do SENAI e é reconhecido nos três, com o mesmo `uid` e e-mail.
- **Firewall do SENAI:** com domínio próprio dá para usar um `authDomain` próprio (ex.: `login.NOME.com.br`) em vez de `*.firebaseapp.com`, que a rede do SENAI bloqueia.

**Checklist quando trocar o domínio deste sistema:**
1. GitHub → Settings → Pages → **Custom domain** (`provas.NOME.com.br`) + registro CNAME no DNS + "Enforce HTTPS".
2. Firebase Console → Authentication → Settings → **Authorized domains**: adicionar o domínio novo.
3. Google Cloud → APIs & Services → Credentials → o **OAuth Client** do login (GOOGLE_CLIENT_ID): adicionar a origem `https://provas.NOME.com.br`.
4. Cloudflare Worker: variável **`ORIGENS`** com o domínio novo (pode manter o antigo, separado por vírgula, durante a transição).
5. `wrangler.toml`: atualizar `ORIGENS`.
6. Deixar o endereço antigo funcionando por um tempo (o GitHub redireciona sozinho para o domínio próprio).

---

## 2. A ideia central: somativa × autoavaliação (calibração)

O aluno diz, depois das formativas, **o quanto acha que sabe** cada tópico. As provas somativas daqui mostram **o quanto ele realmente acerta** nesse mesmo tópico. Cruzando os dois (calibração metacognitiva):

| | **Acertou na somativa** | **Errou na somativa** |
|---|---|---|
| **Disse que sabe** | ✅ **Domínio confirmado**: segue em frente | ⚠ **Ilusão de saber** (excesso de confiança): reforço de conteúdo + mostrar o erro com feedback |
| **Disse que não sabe** | 💡 **Sabe e não acredita** (subconfiança): trabalhar autoconfiança; menos reforço de conteúdo | 🔴 **Dificuldade real**: reforço de conteúdo prioritário |

Isso responde exatamente a pergunta: *"ele estava com dificuldade mesmo, ou só achava que não sabia?"*

O que esse cruzamento permite:
- **Mapa da turma por tópico**: em quais tópicos há dificuldade real (reforço para todos) e em quais há só insegurança.
- **Lista de reforço por aluno**: só os tópicos de "dificuldade real" e "ilusão de saber".
- **Índice de calibração** do aluno ao longo do semestre: ele está aprendendo a se avaliar melhor?
- Para alunos com acessibilidade: entra no **perfil** usado pela IA das adaptações, junto com o diário.

## 3. A ponte entre os sistemas: os TÓPICOS

A chave que liga os três sistemas é **turma + matéria + tópico**, e este sistema já tem isso organizado:
- **Plano de curso** (`cursos/{id}.materias[].topicos`) → a lista oficial de tópicos de cada matéria.
- **Questões** com o campo `tema` = o tópico.
- **Provas** com `turmaId`, `semestre`, `materia`.
- **Diário** com as matérias e tópicos trabalhados em cada aula.

Os outros dois sistemas devem usar **os mesmos nomes de tópico** (de preferência lendo o plano de curso daqui), e não uma lista própria.

## 4. Contrato de dados proposto (a combinar quando for integrar)

Mesmo projeto Firebase, coleções novas (nomes sugeridos):

```text
autoavaliacoes/{id}
  uid, email            // o mesmo login dos três sistemas
  turmaId, semestre, materia, topico   // a ponte (nomes iguais ao plano de curso)
  confianca: 1..5       // "quanto eu acho que sei" (1 = não sei nada, 5 = sei explicar para um colega)
  dificuldade: texto    // o que o próprio aluno disse
  atividadeId, data     // a atividade formativa que gerou a autoavaliação
  origem: "autoavaliacao"

aulas/{id}               // sistema de aulas (o que foi dado e a participação)
  turmaId, materia, topicos[], data
  participacao/{uid}: { presente, interacoes, acertosNaAula, ... }

reforcos/{id}            // gerado pelo cruzamento (pode ser calculado aqui ou no sistema de autoavaliação)
  uid, turmaId, materia, topico
  quadrante: "dominio" | "ilusao" | "subconfianca" | "dificuldade"
  confianca, desempenho (0–100 nas questões do tópico), provasIds[]
  sugerido: texto, status: "aberto" | "feito"
```

Do lado deste sistema, o **desempenho por tópico** sai das tentativas: para cada questão respondida, o `tema` da questão é o tópico, e a pontuação conta (inclusive parcial, nos formatos adaptados).

**Alternativas de ligação**, se os sistemas ficarem em projetos Firebase separados:
- Um **endpoint no Worker** (`acao: "desempenhoPorTopico"`) que devolve, para uma turma/matéria, o acerto por aluno e tópico, autenticado pelo mesmo login Google.
- Ou uma exportação periódica (CSV/JSON) por turma.

## 5. Regras para o código de hoje (para não fechar portas)

1. Tópico é **texto igual ao do plano de curso**: não inventar listas paralelas.
2. Toda informação de aluno é identificada por **e-mail** (e `uid` quando houver).
3. Toda prova tem **turma, semestre e matéria**.
4. Os relatórios por tópico (próxima etapa) devem ter a conta "desempenho por tópico" numa função reaproveitável, que depois vai virar o endpoint/consulta usado pela autoavaliação.
5. Nada de nota ou dado do aluno aparece para outros alunos sem ele escolher (ver a parte social, em Gamificação).
