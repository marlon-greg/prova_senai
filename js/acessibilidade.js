// Acessibilidade: adaptações da prova por aluno (marcado pelo professor como "Acessibilidade").
// acessibilidade/{email}            -> { email, nome, ativo, uid, auxiliares: [emails], visual: {...}, prova: {...} }   (o aluno lê)
// acessibilidade/{email}/questoes/q -> { enunciado, alternativas|null, dica, origem: "ia"|"manual" }                   (o aluno lê)
// acessibilidadePrivado/{email}     -> { descricao } + laudos/{id} (PDF em pedaços) + sugestoes/{id}                    (só equipe)
// Usado pela página do aluno (aplica na prova) e pelo painel (pré-visualização ao vivo).

export const VISUAL_PADRAO = {
  escala: 100,          // tamanho da letra (%)
  letras: 0,            // espaçamento entre letras (em)
  palavras: 0,          // espaçamento entre palavras (em)
  linhas: 1.6,          // altura da linha
  fonte: "padrao",      // padrao | atkinson | lexend | comic | arial
  tema: "padrao",       // padrao | creme | azul | contraste | escuro
  maiusculas: false,    // CAIXA ALTA no enunciado e nas alternativas
  linhaCurta: false,    // texto em coluna estreita (~60 caracteres)
  regua: false,         // régua de leitura que acompanha o mouse
  semAnimacao: false    // sem confete/mascote animado
};
export const PROVA_PADRAO = {
  tempoExtraMin: 0,     // minutos a mais (somados ao tempo da prova)
  vidasExtras: 0,       // vidas a mais
  semPunicao: false,    // saídas e colar só ficam registrados: não tiram vida
  ocultarCronometro: false,   // o tempo continua valendo, mas não aparece (reduz ansiedade)
  lerEmVoz: true,       // botão 🔊 em cada questão
  mostrarDica: true     // mostra o apoio ("dica") das questões adaptadas
};
export const FONTES = {
  padrao:   { nome: "Padrão do sistema (Inter)", css: "" },
  atkinson: { nome: "Atkinson Hyperlegible (baixa visão)", css: "'Atkinson Hyperlegible', Inter, sans-serif", google: "Atkinson+Hyperlegible:wght@400;700" },
  lexend:   { nome: "Lexend (leitura fluida / dislexia)", css: "'Lexend', Inter, sans-serif", google: "Lexend:wght@400;600" },
  comic:    { nome: "Comic Neue (letras arredondadas)", css: "'Comic Neue', 'Comic Sans MS', Inter, sans-serif", google: "Comic+Neue:wght@400;700" },
  arial:    { nome: "Arial / Verdana (simples)", css: "Verdana, Arial, Inter, sans-serif" }
};
export const TEMAS = {
  padrao:    { nome: "Padrão (branco)" },
  creme:     { nome: "Creme (menos brilho)" },
  azul:      { nome: "Azul claro" },
  contraste: { nome: "Alto contraste (preto e amarelo)" },
  escuro:    { nome: "Escuro" }
};

export const completar = (cfg = {}) => ({ ...cfg, visual: { ...VISUAL_PADRAO, ...(cfg.visual || {}) }, prova: { ...PROVA_PADRAO, ...(cfg.prova || {}) } });

const fontesCarregadas = new Set();
function carregarFonte(id) {
  const f = FONTES[id];
  if (!f?.google || fontesCarregadas.has(id)) return;
  fontesCarregadas.add(id);
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
  document.head.append(l);
}

// Aplica o visual num elemento (body na prova; caixa de pré-visualização no painel). null = tira tudo.
const CLASSES = ["acess", "acess-maiusculas", "acess-linha-curta", "acess-sem-animacao", ...Object.keys(TEMAS).map(t => "tema-" + t)];
export function aplicarVisual(el, visual) {
  el.classList.remove(...CLASSES);
  ["--a-escala", "--a-letras", "--a-palavras", "--a-linhas", "--a-fonte"].forEach(v => el.style.removeProperty(v));
  if (!visual) { ligarRegua(el, false); return; }
  const v = { ...VISUAL_PADRAO, ...visual };
  el.classList.add("acess", "tema-" + (TEMAS[v.tema] ? v.tema : "padrao"));
  el.classList.toggle("acess-maiusculas", !!v.maiusculas);
  el.classList.toggle("acess-linha-curta", !!v.linhaCurta);
  el.classList.toggle("acess-sem-animacao", !!v.semAnimacao);
  el.style.setProperty("--a-escala", Math.min(250, Math.max(80, Number(v.escala) || 100)) / 100);
  el.style.setProperty("--a-letras", `${Math.min(0.4, Math.max(0, Number(v.letras) || 0))}em`);
  el.style.setProperty("--a-palavras", `${Math.min(1, Math.max(0, Number(v.palavras) || 0))}em`);
  el.style.setProperty("--a-linhas", Math.min(3, Math.max(1.2, Number(v.linhas) || 1.6)));
  if (FONTES[v.fonte]?.css) { carregarFonte(v.fonte); el.style.setProperty("--a-fonte", FONTES[v.fonte].css); }
  ligarRegua(el, !!v.regua);
}

// ---------- régua de leitura: faixa que acompanha o mouse e escurece o resto ----------
const reguas = new WeakMap();
function ligarRegua(el, ligar) {
  const atual = reguas.get(el);
  if (!ligar) { if (atual) { atual.remove(); reguas.delete(el); } return; }
  if (atual) return;
  const r = document.createElement("div");
  r.className = "regua-leitura"; r.setAttribute("aria-hidden", "true");
  r.innerHTML = `<div class="regua-cima"></div><div class="regua-faixa"></div><div class="regua-baixo"></div>`;
  const dentroDeBody = el === document.body;
  if (!dentroDeBody) { el.style.position ||= "relative"; r.classList.add("local"); }
  el.append(r);
  const mover = e => {
    const box = dentroDeBody ? { top: 0 } : el.getBoundingClientRect();
    r.style.setProperty("--y", `${(e.clientY - box.top)}px`);
  };
  el.addEventListener("mousemove", mover);
  r.remove = (orig => () => { el.removeEventListener("mousemove", mover); orig.call(r); })(r.remove);
  reguas.set(el, r);
}

// ---------- questão adaptada: troca enunciado/alternativas (mesma quantidade e ordem) ----------
export function mesclarQuestao(original, adaptada) {
  if (!adaptada) return original;
  const alt = Array.isArray(adaptada.alternativas) && Array.isArray(original.alternativas) && adaptada.alternativas.length === original.alternativas.length
    ? adaptada.alternativas : original.alternativas;
  const fmt = adaptada.formato && adaptada.formato !== "texto" && adaptada.dados ? { formato: adaptada.formato, dados: adaptada.dados } : {};
  return { ...original, enunciado: String(adaptada.enunciado || "").trim() || original.enunciado, alternativas: alt,
           apoios: apoiosDe(adaptada), adaptada: true, ...fmt };
}
// apoios (dicas) da questão adaptada: lista nova (apoios) ou a dica única das adaptações antigas
export function apoiosDe(ad) {
  const l = Array.isArray(ad?.apoios) ? ad.apoios : (ad?.dica ? [ad.dica] : []);
  return l.map(x => String(x || "").trim()).filter(Boolean);
}
