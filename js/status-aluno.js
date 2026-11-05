// Status do dia do aluno ("Como você está hoje?"): frases prontas, guardadas em perfis/{uid} com o horário (statusEm).
// A equipe vê na aba Turmas (por turma) e a auxiliar vê no Diário. Os difíceis aparecem destacados para alguém conversar com o aluno.
import { db } from "./common.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const STATUS = ["😊 Animado(a)", "📚 Estudando", "🎯 Focado(a)", "💪 Pronto(a) para a prova", "🚀 Motivado(a)", "🧘 Tranquilo(a)", "🤔 Pensativo(a)",
  "😴 Com sono", "☕ Precisando de café", "🎧 Ouvindo música", "🤝 Ajudando os colegas", "💻 Programando", "🎮 Modo jogo", "🏃 Na correria", "🌟 Dia incrível", "🙂 De boa",
  "😫 Cansado(a)", "😔 Triste", "😟 Preocupado(a)", "😰 Ansioso(a)", "😣 Estressado(a)", "😠 Irritado(a)", "🤒 Não estou bem"];
export const STATUS_DIFICEIS = ["😫 Cansado(a)", "😔 Triste", "😟 Preocupado(a)", "😰 Ansioso(a)", "😣 Estressado(a)", "😠 Irritado(a)", "🤒 Não estou bem"];
export const ehDificil = s => STATUS_DIFICEIS.includes(s);

const dataDe = v => v?.toDate ? v.toDate() : v ? new Date(v) : null;
const mesmoDia = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
// { status, em: Date|null, hoje: bool, dificil: bool } de um perfil
export function infoStatus(p, agora = new Date()) {
  if (!p?.status) return null;
  const em = dataDe(p.statusEm);
  return { status: p.status, em, hoje: mesmoDia(em, agora), dificil: ehDificil(p.status) };
}
// e-mail (minúsculo) -> infoStatus, para a equipe (lê todos os perfis)
export async function lerStatusAlunos() {
  const mapa = new Map();
  (await getDocs(collection(db, "perfis"))).forEach(d => { const p = d.data(), i = infoStatus(p); if (p.email && i) mapa.set(String(p.email).toLowerCase(), i); });
  return mapa;
}
const hora = d => d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
const diaCurto = d => d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
// chip para listas da equipe
export function chipStatus(i, esc) {
  if (!i) return "";
  return `<span class="chip ${i.dificil ? "aviso" : i.hoje ? "info" : "off"}" title="Status do aluno ${i.hoje ? `hoje às ${hora(i.em)}` : i.em ? `em ${diaCurto(i.em)}` : ""}">${esc(i.status)}${i.hoje ? "" : ` <small>(${i.em ? diaCurto(i.em) : "antigo"})</small>`}</span>`;
}
