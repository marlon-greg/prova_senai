// Formato dos critérios de avaliação: o MESMO da importação do sistema de autoavaliação (Stacktrace,
// packages/contracts/src/importacao.schemas.ts, ImportarConteudoBody). Usado pelo Worker (o que vem da API de lá)
// e pela importação manual do administrador principal (último caso). Sem dependências: roda no navegador e no Worker.
//
// { "uc": { "sigla": "BD", "nome": "Banco de Dados" },
//   "capacidades": [
//     { "tipo": "TECNICA", "numero": 9, "descricao": "…",
//       "criterios": [ { "numero": 25, "texto": "…", "explicacao": "…" } ] } ] }
//
// Regras (iguais às de lá): sigla 1–20 caracteres, nome 1–200, tipo TECNICA ou SOCIOEMOCIONAL, números inteiros ≥ 1,
// descrição 1–500, texto 1–500, explicação até 5000, pelo menos 1 capacidade e 1 critério por capacidade.
// Regra a mais (daqui): o número do critério não se repete na UC, porque vira o ID (BD nº 25 → bd.cr25).

export const TIPOS = ["TECNICA", "SOCIOEMOCIONAL"];
const txt = (v, min, max) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
const inteiro = v => Number.isInteger(Number(v)) && Number(v) >= 1;

// aceita um plano ou uma lista de planos (ou { ucs: [...] }); devolve { planos, erros }
export function validarPlanos(entrada) {
  const lista = Array.isArray(entrada) ? entrada : Array.isArray(entrada?.ucs) ? entrada.ucs : [entrada];
  const erros = [], planos = [];
  lista.forEach((p, i) => {
    const onde = lista.length > 1 ? `UC ${i + 1}: ` : "";
    const e = [];
    if (!p || typeof p !== "object") { erros.push(onde + "não é um objeto JSON."); return; }
    if (!txt(p.uc?.sigla, 1, 20)) e.push("uc.sigla precisa ter de 1 a 20 caracteres.");
    if (!txt(p.uc?.nome, 1, 200)) e.push("uc.nome precisa ter de 1 a 200 caracteres.");
    if (!Array.isArray(p.capacidades) || !p.capacidades.length) e.push("capacidades precisa ser uma lista com pelo menos 1 capacidade.");
    const numeros = new Map();
    (Array.isArray(p.capacidades) ? p.capacidades : []).forEach((c, j) => {
      const cap = `capacidade ${c?.tipo || "?"} ${c?.numero ?? j + 1}`;
      if (!TIPOS.includes(c?.tipo)) e.push(`${cap}: tipo precisa ser TECNICA ou SOCIOEMOCIONAL.`);
      if (!inteiro(c?.numero)) e.push(`${cap}: numero precisa ser inteiro, 1 ou mais.`);
      if (!txt(c?.descricao, 1, 500)) e.push(`${cap}: descricao precisa ter de 1 a 500 caracteres.`);
      if (!Array.isArray(c?.criterios) || !c.criterios.length) e.push(`${cap}: precisa de pelo menos 1 critério.`);
      (Array.isArray(c?.criterios) ? c.criterios : []).forEach(k => {
        const cr = `${cap}, critério ${k?.numero ?? "?"}`;
        if (!inteiro(k?.numero)) e.push(`${cr}: numero precisa ser inteiro, 1 ou mais.`);
        if (!txt(k?.texto, 1, 500)) e.push(`${cr}: texto precisa ter de 1 a 500 caracteres.`);
        if (k?.explicacao != null && (typeof k.explicacao !== "string" || k.explicacao.length > 5000)) e.push(`${cr}: explicacao precisa ser texto de até 5000 caracteres.`);
        if (inteiro(k?.numero)) {
          const n = Number(k.numero);
          if (numeros.has(n)) e.push(`${cr}: o número ${n} já aparece em ${numeros.get(n)}. Na UC cada critério tem número único (C${String(n).padStart(2, "0")}).`);
          else numeros.set(n, cap);
        }
      });
    });
    if (e.length) erros.push(...e.map(x => onde + x)); else planos.push(normalizar(p));
  });
  return { planos, erros };
}

// só os campos do formato, com tipos certos
export function normalizar(p) {
  return {
    uc: { sigla: p.uc.sigla.trim().toUpperCase(), nome: p.uc.nome.trim() },
    capacidades: p.capacidades.map(c => ({
      tipo: c.tipo, numero: Number(c.numero), descricao: c.descricao.trim(),
      criterios: c.criterios.map(k => ({ numero: Number(k.numero), texto: k.texto.trim(),
        ...(k.explicacao?.trim() ? { explicacao: k.explicacao.trim() } : {}), ...(k.manual ? { manual: true } : {}) }))
    }))
  };
}

const chaveCap = c => `${c.tipo}|${c.numero}`;
const ordenar = l => l.sort((a, b) => TIPOS.indexOf(a.tipo) - TIPOS.indexOf(b.tipo) || a.numero - b.numero);

// Junta o que já está gravado (atual) com o que chegou (novo).
//  origem "autoavaliacao": o que veio de lá é a verdade; dos critérios manuais antigos, só ficam os que lá não existem.
//  origem "manual": cria ou atualiza (como a importação de lá: casa por tipo+número e por número), marcado manual.
// Devolve { plano, contagem: { capacidadesCriadas, capacidadesAtualizadas, criteriosCriados, criteriosAtualizados } }
export function mesclarPlano(atual, novo, origem) {
  const contagem = { capacidadesCriadas: 0, capacidadesAtualizadas: 0, criteriosCriados: 0, criteriosAtualizados: 0 };
  const antes = (atual?.capacidades || []).map(c => ({ ...c, criterios: (c.criterios || []).map(k => ({ ...k })) }));
  let caps;
  if (origem === "autoavaliacao") {
    caps = novo.capacidades.map(c => ({ ...c, criterios: c.criterios.map(({ manual, ...k }) => k) }));
    const numerosLa = new Set(caps.flatMap(c => c.criterios.map(k => k.numero)));
    for (const c of antes) {
      const sobra = c.criterios.filter(k => k.manual && !numerosLa.has(k.numero));
      if (!sobra.length) continue;
      const alvo = caps.find(x => chaveCap(x) === chaveCap(c));
      if (alvo) alvo.criterios.push(...sobra); else caps.push({ ...c, criterios: sobra });
    }
  } else {
    caps = antes;
    for (const c of novo.capacidades) {
      let alvo = caps.find(x => chaveCap(x) === chaveCap(c));
      if (alvo) { alvo.descricao = c.descricao; contagem.capacidadesAtualizadas++; }
      else { alvo = { tipo: c.tipo, numero: c.numero, descricao: c.descricao, criterios: [] }; caps.push(alvo); contagem.capacidadesCriadas++; }
      for (const k of c.criterios) {
        // o número é único na UC: se estava em outra capacidade, sai de lá
        for (const x of caps) if (x !== alvo) x.criterios = x.criterios.filter(y => y.numero !== k.numero);
        const i = alvo.criterios.findIndex(y => y.numero === k.numero);
        const item = { numero: k.numero, texto: k.texto, ...(k.explicacao ? { explicacao: k.explicacao } : {}), manual: true };
        if (i >= 0) { alvo.criterios[i] = item; contagem.criteriosAtualizados++; } else { alvo.criterios.push(item); contagem.criteriosCriados++; }
      }
    }
    caps = caps.filter(c => c.criterios.length);
  }
  caps.forEach(c => c.criterios.sort((a, b) => a.numero - b.numero));
  const manuais = caps.some(c => c.criterios.some(k => k.manual));
  const daLa = origem === "autoavaliacao" || atual?.origem === "autoavaliacao" || atual?.origem === "misto";
  return { plano: { uc: novo.uc, capacidades: ordenar(caps), origem: manuais ? (daLa ? "misto" : "manual") : "autoavaliacao" }, contagem };
}

// Prompt que o administrador cola numa IA junto com o plano de ensino, para sair o JSON no formato certo.
export const PROMPT_CRITERIOS = `Você vai converter um PLANO DE ENSINO do SENAI em JSON, no formato exato abaixo. Responda SÓ com o JSON, sem comentário e sem markdown.

{
  "uc": { "sigla": "BD", "nome": "Banco de Dados" },
  "capacidades": [
    {
      "tipo": "TECNICA",
      "numero": 1,
      "descricao": "texto da capacidade, igual ao plano",
      "criterios": [
        { "numero": 1, "texto": "critério de avaliação, igual ao plano", "explicacao": "o que o aluno precisa mostrar, em linguagem simples, falando com ele (você)" }
      ]
    },
    {
      "tipo": "SOCIOEMOCIONAL",
      "numero": 1,
      "descricao": "texto da capacidade socioemocional",
      "criterios": [ { "numero": 40, "texto": "…", "explicacao": "…" } ]
    }
  ]
}

Regras:
1. "tipo" é só "TECNICA" ou "SOCIOEMOCIONAL". Capacidade técnica e socioemocional têm numeração própria, começando em 1, na ordem do plano.
2. O "numero" do critério é o número dele no plano de ensino (C01 = 1, C25 = 25, C40 = 40). Ele NUNCA se repete na unidade curricular, nem entre técnicas e socioemocionais.
3. "texto" é o critério de avaliação como está no plano (até 500 caracteres). Não invente critério que não está no plano.
4. "explicacao" é opcional (até 5000 caracteres): diga ao aluno, de forma curta e concreta, o que ele precisa conseguir fazer.
5. "sigla" tem até 20 caracteres (ex.: BD, LPA, FRONT) e "nome" é o nome da unidade curricular como está no plano.
6. Toda capacidade precisa ter pelo menos 1 critério. Use números inteiros, sem aspas.

Plano de ensino:
[COLE AQUI O PLANO DE ENSINO OU A ABA DE CRITÉRIOS]`;
