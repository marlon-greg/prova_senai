# Andamento: módulo "Atividades e Avaliações" (sistema de aulas da faculdade)

Última atualização: 17/11/2026.

## O que é
Levar o sistema de provas deste repositório, em versão **profissional e sem gamificação**, para o **sistema de aulas da faculdade** (outro sistema, que hoje não tem login de aluno). O modelo completo está em [`MODELO-AVALIACOES-FACULDADE.md`](MODELO-AVALIACOES-FACULDADE.md): é ele que o outro sistema (ou a IA que for construir) deve ler.

## Decisões já tomadas
- Botão **"Atividades e Avaliações"** na tela da matéria, ao lado de Drive e Teams.
- Materiais continuam sem login; **só o módulo pede login**.
- **Login: Microsoft (Entra ID, single tenant), fixo.** Sem Google, sem e-mail/senha.
- **Tolerância zero:** Alt (exceto AltGr), tecla Windows, Esc/sair da tela cheia, trocar de janela → encerra a avaliação na hora.
- **Colar:** bloqueado por completo, **sem** tirar ponto nem encerrar (só contador para o professor).
- Nada de vidas, mascotes, XP, conquistas, emojis.
- Construção em etapas, com **aprovação do professor** antes de qualquer coisa ir para os alunos (seção 10 do modelo).

## Onde parou
- [x] Documento-modelo escrito (cópia também em `C:\Users\marli\Downloads` do PC de casa).
- [x] Login definido como Microsoft.
- [ ] Entregar o documento ao sistema de aulas e começar a **Etapa 1** (cara inicial navegável, só em pré-visualização).
- [ ] Aprovação 1: visual, textos das regras, encerramento, AltGr no teclado ABNT2, escala da nota (0–10 ou 0–100).

## Pendências para decidir/levantar
- ID do tenant e ID do aplicativo no Entra ID (precisa da TI da faculdade; necessário na Etapa 2).
- Escala da nota (0–10 ou 0–100).
- Se F12/Ctrl+Shift+I encerram ou só são bloqueados.
- Recarregar/fechar a página: padrão "encerrar" ou permitir retomar (opção por avaliação).
