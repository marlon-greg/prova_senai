// Logo oficial: tenta os arquivos em ordem (data-alt, separados por |) e, se nenhum existir, mostra o texto SENAI.
function logoFalhou(img) {
  const resto = (img.dataset.alt || "").split("|").filter(Boolean);
  if (resto.length) { img.dataset.alt = resto.slice(1).join("|"); img.src = resto[0]; return; }
  const t = document.createElement("span");
  t.className = "logo-texto"; t.textContent = "SENAI";
  img.replaceWith(t);
}
