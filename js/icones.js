// Ícones monocromáticos em traço (estilo Lucide), sem CDN. Menu, botões, toolbar e metadados usam estes;
// emoji fica só no conteúdo (conquistas, humor, vidas, mascotes, situação do aluno).
//   ic("provas")                    → SVG 18 px na cor do texto
//   ic("plus", { size: 16 })        → menor, para botões
const P = {
  org: `<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"/>`,
  provas: `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>`,
  bancos: `<path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
  turmas: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>`,
  resultados: `<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>`,
  relatorios: `<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>`,
  diario: `<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5z"/><path d="M5 21.5A2.5 2.5 0 0 0 7.5 22H20v-3M9 7h7"/>`,
  acess: `<circle cx="12" cy="4.5" r="2"/><path d="M4.5 9c5 1.3 10 1.3 15 0M12 10.5V15M8.5 21.5 12 15l3.5 6.5"/>`,
  adapt: `<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>`,
  retorno: `<path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.5-5A8 8 0 1 1 21 12z"/>`,
  gami: `<circle cx="12" cy="15" r="6"/><path d="M8.5 10 6 3h4l2 5M15.5 10 18 3h-4l-2 5M12 12.5l.8 1.7 1.9.2-1.4 1.3.4 1.8-1.7-.9-1.7.9.4-1.8-1.4-1.3 1.9-.2z"/>`,
  mascote: `<circle cx="12" cy="12" r="9"/><path d="M8 14.5a4.5 4.5 0 0 0 8 0M9 9.5h.01M15 9.5h.01"/>`,
  itens: `<path d="M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>`,
  simulacao: `<path d="M9 3h6M10 3v6.5L4.6 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.8L14 9.5V3M7.5 15h9"/>`,
  equipe: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5a6 6 0 0 1 11 0"/>`,
  config: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,
  search: `<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`,
  filter: `<path d="M3 6h18M7 12h10M10 18h4"/>`,
  chev: `<path d="m6 9 6 6 6-6"/>`,
  chevr: `<path d="m9 6 6 6-6 6"/>`,
  dots: `<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>`,
  play: `<path d="M7 4.5v15l12-7.5z"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  stop: `<rect x="6" y="6" width="12" height="12" rx="1.5"/>`,
  x: `<path d="M6 6l12 12M18 6 6 18"/>`,
  download: `<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>`,
  upload: `<path d="M12 16V5M7 9l5-5 5 5M4 20h16"/>`,
  check: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
  edit: `<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>`,
  cal: `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  users: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>`,
  book: `<path d="M12 6.5C10 5 7 4.5 3 4.5v14.5c4 0 7 .5 9 2 2-1.5 5-2 9-2V4.5c-4 0-7 .5-9 2zM12 6.5V21"/>`,
  tag: `<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><path d="M8 8h.01"/>`,
  bot: `<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 13.5h.01M15 13.5h.01M9.5 17h5M2 13v3M22 13v3"/>`,
  sparkle: `<path d="M12 3l1.9 5.6L19.5 10.5 13.9 12.4 12 18l-1.9-5.6L4.5 10.5l5.6-1.9zM19 3v4M21 5h-4M5 17v4M7 19H3"/>`,
  eye: `<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`,
  trash: `<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>`,
  copy: `<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>`,
  alert: `<path d="M12 3 2 20h20zM12 10v4.5M12 17.5h.01"/>`,
  heart: `<path d="M12 20.5S3 15.5 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 11.5-9 11.5z"/>`,
  lock: `<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
  unlock: `<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>`,
  refresh: `<path d="M20 11a8 8 0 0 0-14-4.5L3 9M3 4v5h5M4 13a8 8 0 0 0 14 4.5L21 15M21 20v-5h-5"/>`,
  external: `<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`
};
export const ICONES = Object.keys(P);
export function ic(nome, { size = 18, cor = "currentColor", sw = 1.8 } = {}) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto">${P[nome] || P.info}</svg>`;
}
