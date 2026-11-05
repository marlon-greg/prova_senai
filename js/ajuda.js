// Ajuda "?" de cada tela do painel e de cada lugar onde se envia algo.
// Botão flutuante "?" abre a ajuda da aba aberta; botões "?" pequenos (data-ajuda-item) explicam um envio específico.
import { modal, esc } from "./common.js";

const PDF_SLIDES = `<ul>
  <li><b>Só PDF.</b> PowerPoint: <i>Arquivo → Exportar → Criar PDF</i>. Google Slides: <i>Arquivo → Fazer download → PDF</i>. Word/Docs: <i>Salvar como PDF</i>.</li>
  <li>Slides em <b>paisagem</b> (deitado), uma página por slide. Não use "folheto" com vários slides por página.</li>
  <li>Até <b>20 MB</b>. Se passar: PowerPoint → Exportar → PDF → <i>Tamanho mínimo</i>; ou divida em dois arquivos.</li>
  <li>Dê títulos com número ("Aula 02 — DDL"): as abas ficam em ordem.</li>
  <li>Animações e vídeos não vão para o PDF.</li></ul>`;
const PDF_DOC = `<ul>
  <li><b>PDF</b> com texto (não foto do papel). Documento escaneado também serve, mas a IA lê melhor PDF gerado no computador.</li>
  <li>Retrato (em pé) é o normal para documentos. Até <b>20 MB</b>.</li>
  <li><b>Não precisa ser o documento inteiro</b>: pode enviar só as páginas que importam (ex.: a parte das matérias e conteúdos).</li></ul>`;

export const AJUDA_ITENS = {
  slides: { t: "Como enviar slides e material de consulta", h: PDF_SLIDES },
  laudo: { t: "Como enviar laudos e documentos", h: `${PDF_DOC}<p>Os laudos ficam numa área que <b>o aluno nunca vê</b>. A IA usa até 3 laudos para adaptar as questões. Prefira o laudo mais recente e o relatório do especialista (psicólogo, neuro, AEE).</p>` },
  planoEnsino: { t: "Como enviar o plano de ensino", h: `${PDF_DOC}<p>O plano de ensino é <b>opcional</b>. O mais útil dele são as <b>datas das provas</b> e, se quiser, as datas de cada tópico. A IA lê o PDF e você revisa antes de salvar.</p>` },
  planoCurso: { t: "Como enviar o plano de curso", h: `${PDF_DOC}<p>O plano de curso traz <b>todas as matérias</b> com os conteúdos. Pode ser grande: se der erro, envie só as páginas das unidades curriculares. A IA lista matéria, módulo, carga horária e tópicos.</p><p>Confira se o nome de cada matéria ficou <b>igual</b> ao campo "matéria" dos bancos de questões: é assim que o sistema junta tudo.</p>` },
  banco: { t: "Como importar um banco de questões", h: `<ul><li>Arquivo <b>.json</b> no formato do <span class="mono">modelo_banco.json</span> (ou cole o texto).</li>
    <li><b>Mais fácil:</b> abra <b>🤖 Não tem o JSON? Gere as questões numa IA</b>, escolha a matéria e os tópicos (vêm do plano de curso) e quantas questões; clique em <b>📋 Copiar prompt</b>, cole no Claude/ChatGPT/Gemini e cole o JSON que ela devolver na caixa. O <b>⬇ modelo JSON</b> também está ali.</li>
    <li>Use o campo <span class="mono">"tema"</span> em cada questão com o nome do <b>tópico</b> (igual ao do plano de curso). Sem tema, a questão fica como "Geral" e você ajusta depois em 🏷 Tópicos.</li>
    <li>Escolha o <b>semestre</b> e confira a <b>matéria</b> antes de importar.</li></ul>` },
  turmaLista: { t: "Como colar a lista de alunos", h: `<ul><li>Um aluno por linha: só o nome completo, nome + e-mail (<span class="mono">Maria Silva &lt;maria@edu.senai.br&gt;</span>) ou só o e-mail.</li>
    <li>Dá para colar direto da planilha (coluna de nome e de e-mail).</li><li>Quem está só com o nome é vinculado sozinho no 1º login, se o nome da conta Google for igual.</li>
    <li>Marque os <b>dias de aula</b> da turma: o diário e as conquistas contam só esses dias.</li></ul>` }
};

export const AJUDA_ABAS = {
  organizacao: { t: "Organização", h: `<p>Tudo em <b>Turma → Semestre → Matéria → Tópicos</b>.</p><ol>
    <li><b>📘 Plano de curso</b> (uma vez por curso): crie, marque as turmas do curso, envie o PDF e clique em 🤖 Ler com IA. Ele traz todas as matérias e tópicos.</li>
    <li>Em cada turma, clique na matéria do curso para criar o cartão dela no semestre.</li>
    <li><b>Plano de ensino</b> (opcional): datas das provas e, se quiser, datas dos tópicos. Pode enviar o PDF e pedir para a IA ler.</li>
    <li>O cartão mostra os tópicos, quantas questões há de cada um, em quais provas caíram e as provas previstas (botão <b>+ Criar</b>).</li></ol>` , itens: ["planoCurso", "planoEnsino"] },
  provas: { t: "Provas", h: `<ol><li><b>+ Criar nova prova</b>: título, turma, semestre, matéria, data, bancos e tópicos que entram no sorteio, quantas alternativas e dissertativas, regras e material de consulta.</li>
    <li>A prova nasce <b>fechada</b>. Na hora: <b>▶ Liberar prova</b>. No fim: <b>⏹ Encerrar</b>.</li>
    <li><b>🧪 Testar</b> abre a prova como o aluno vê (não vale nota).</li><li>Depois de corrigir: <b>Liberar gabarito</b>.</li></ol>
    <p>As provas ficam agrupadas por turma → semestre · matéria. Use a pesquisa e os filtros.</p>`, itens: ["slides"] },
  diario: { t: "Diário", h: `<ol><li>Escolha o aluno e clique em <b>✍ Registrar a aula de hoje</b>: 5 etapas rápidas (uns 3 minutos). Os campos com * são os principais.</li>
    <li><b>Outro dia</b>: use os botões (ontem, aulas sem registro) ou 📆 Escolher data. O sistema pergunta o motivo (atrasado, faltou, sem aula…) e se você quer preencher ou só justificar.</li>
    <li>Professores leem e comentam cada dia; eles não mudam o registro.</li>
    <li><b>📄 Relatório formal</b>: PDF do período para coordenação, direção ou sede.</li></ol>
    <p>As medalhas são da <b>aluna</b>: ela vê na página dela só coisas positivas (contagens), nunca os textos do diário.</p>` },
  historico: { t: "Provas adaptadas", h: `<p>O histórico de tudo o que foi adaptado: para cada aluno e cada prova, o <b>formato</b> de cada questão (texto simplificado, V/F, ligar colunas, lacunas…), o <b>porquê</b>, quem adaptou e quando.</p>
    <p>Em <b>🕘 Histórico de escolhas</b> aparece cada escolha feita entre as opções da IA (e se foi ajustada à mão). A auxiliar vê só os alunos dela; professores e admin veem todos.</p><p>Para mudar uma adaptação, clique em <b>♿ Abrir na Acessibilidade</b>.</p>` },
  retorno: { t: "Erros e sugestões dos alunos", h: `<p>Os alunos mandam daqui: <b>🚩 apontamentos</b> numa questão (botão na própria questão, na prova ou no gabarito: duas respostas certas, nenhuma certa, erro de texto…) e <b>💡 sugestões</b> para o sistema (na página deles).</p><p>Escreva uma resposta e marque como <b>procede / não procede</b> (ou feita / analisada). O aluno vê a resposta na página dele.</p>` },
  gamificacao: { t: "Gamificação", h: `<p>Liga e desliga: conquistas, personagem e skins, download do cartão, apontamentos, sugestões e a <b>parte social</b> (2ª parte, começa desligada).</p><p>Na parte social o aluno só mostra o que ele escolher; sem comentários, só ❤️ curtidas e 👏 parabéns. Notas só aparecem se você ligar "Permitir compartilhar notas" <b>e</b> o aluno marcar a nota.</p><p><b>🧪 Ver como aluno</b>: abre a página do aluno com a sua conta, em simulação, para você se dar conquistas e ver como fica. Nada é gravado.</p>` },
  relatorios: { t: "Relatórios", h: `<ul><li>Filtre por turma, semestre, matéria ou aluno.</li><li><b>⚠ Risco de reprovação</b>: alunos com média abaixo de 50 numa matéria (cada prova vale o mesmo) e quanto precisam tirar na próxima prova.</li>
    <li><b>Médias por aluno e matéria</b> (vermelho &lt; 50, amarelo &lt; 70) e <b>por turma</b>.</li><li><b>📊 Calcular por tópico</b>: o acerto em cada tópico (tema das questões), para saber onde fazer reforço.</li><li><b>⬇ CSV</b> com todas as notas filtradas.</li></ul><p>Usa a nota fechada; sem ela, a nota prévia.</p>` },
  resultados: { t: "Resultados", h: `<ol><li>Escolha turma, semestre, matéria e a prova; clique em <b>Carregar</b> (ou ligue <b>Ao vivo</b> durante a prova).</li>
    <li>Pesquise o aluno ou filtre por situação (a revisar, com sinais, nota abaixo de 50…).</li>
    <li>Corrija as dissertativas (IA ou à mão), depois <b>Fechar notas</b>. Exporte CSV ou PDF.</li>
    <li>No cartão do aluno: restaurar vidas, +1 vida, reabrir a prova.</li></ol>` },
  acessibilidade: { t: "Acessibilidade", h: `<ol><li>Marque o aluno (turma → aluno) e vincule a auxiliar de inclusão.</li>
    <li>Ajuste o visual, o tempo extra e as vidas.</li><li>Escreva a descrição das necessidades e envie os laudos.</li>
    <li>Na prova adaptada: sorteie as questões do aluno e adapte com a IA. <b>Revise antes da prova.</b></li></ol>`, itens: ["laudo"] },
  bancos: { t: "Bancos de questões", h: `<p>Organizados em <b>Semestre → Matéria → Banco → Tópicos</b>. Importe o JSON no topo; em cada banco, <b>🏷 Tópicos</b> mostra todas as questões para escolher o tópico de cada uma (com sugestão da IA) e muda o semestre e a matéria do banco.</p>
    <p>Mais abaixo, envie os <b>slides em PDF</b> para usar como material de consulta nas provas.</p>`, itens: ["banco", "slides"] },
  turmas: { t: "Turmas", h: `<ol><li>Nome da turma, <b>dias de aula</b> e a lista de alunos.</li><li>O horário (entrada, intervalos, saída) é o mesmo para todas e muda em Configuração.</li>
    <li>Pesquise turma ou aluno; filtre por dia de aula, semestre ou matéria.</li></ol>`, itens: ["turmaLista"] },
  equipe: { t: "Equipe", h: `<p><b>admin</b> = tudo · <b>professor</b> = bancos, provas, correção, resultados, organização e comentários no diário · <b>auxiliar</b> = só vê resultados · <b>auxiliar de inclusão</b> = só os alunos vinculados a ela: diário, acessibilidade e resultados.</p><p>Cadastre com o e-mail da conta Google da pessoa.</p>` },
  config: { t: "Configuração", h: `<ul><li><b>Domínios</b> de e-mail aceitos para alunos.</li><li><b>Servidor de correção</b> (Cloudflare Worker): corrige e adapta mesmo com o painel fechado.</li>
    <li><b>Horário das turmas</b>: entrada, saída e intervalos (um por linha: <span class="mono">Nome | início | fim</span>).</li><li><b>Correção por IA</b>: só o administrador principal vê a chave.</li></ul>` }
};

export function abrirAjuda(chave) {
  const a = AJUDA_ABAS[chave] || AJUDA_ITENS[chave];
  if (!a) return;
  const extras = (a.itens || []).map(k => `<details class="ajuda-extra"><summary>📎 ${esc(AJUDA_ITENS[k].t)}</summary>${AJUDA_ITENS[k].h}</details>`).join("");
  modal({ titulo: `❓ ${a.t}`, conteudo: `<div class="ajuda-corpo">${a.h}${extras}</div>`, ok: "Entendi", largo: true });
}

// botão flutuante da aba atual + os "?" pequenos (data-ajuda-item="slides")
export function ligarAjuda(abaAtual) {
  let b = document.getElementById("btnAjuda");
  if (!b) {
    b = document.createElement("button");
    b.id = "btnAjuda"; b.type = "button"; b.className = "ajuda-flutuante"; b.innerHTML = `<span aria-hidden="true">?</span>`;
    b.onclick = () => abrirAjuda(abaAtual());
    document.body.appendChild(b);
  }
  b.setAttribute("aria-label", `Ajuda: ${AJUDA_ABAS[abaAtual()]?.t || "esta tela"}`); b.title = b.getAttribute("aria-label");
  ligarItens();
  if (!observando) { observando = true; new MutationObserver(() => ligarItens()).observe(document.body, { childList: true, subtree: true }); }
}
let observando = false;
function ligarItens() {
  document.querySelectorAll("[data-ajuda-item]:not([data-ligado])").forEach(x => {
    x.dataset.ligado = "1"; x.type = "button"; x.classList.add("ajuda-mini"); x.textContent = "?";
    x.setAttribute("aria-label", AJUDA_ITENS[x.dataset.ajudaItem]?.t || "Ajuda");
    x.title = x.getAttribute("aria-label");
    x.onclick = e => { e.preventDefault(); e.stopPropagation(); abrirAjuda(x.dataset.ajudaItem); };
  });
}
