/**
 * list-item.js: Filas de las listas de estadísticas.
 * Compartido por la app (ui.js) y la página pública (share.js).
 * Todo el texto entra por textContent: nada de HTML construido con datos de usuario.
 */

export function renderList(container, items, mapFn) {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.className = "stats-empty";
    li.textContent = "No hay datos disponibles todavía.";
    container.appendChild(li);
    return;
  }
  items.forEach((item) => container.appendChild(mapFn(item)));
}

export function buildListItem({ imageUrl, title, subtitle, meta }) {
  const li = document.createElement("li");

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    li.appendChild(img);
  }

  const textWrap = document.createElement("div");
  textWrap.className = "item-text";

  const titleEl = document.createElement("p");
  titleEl.className = "item-title";
  titleEl.textContent = title;
  textWrap.appendChild(titleEl);

  // El subtítulo solo se pinta si hay algo que decir (p. ej. artistas sin géneros)
  if (subtitle) {
    const subtitleEl = document.createElement("p");
    subtitleEl.className = "item-subtitle";
    subtitleEl.textContent = subtitle;
    textWrap.appendChild(subtitleEl);
  }
  li.appendChild(textWrap);

  if (meta) {
    const metaEl = document.createElement("span");
    metaEl.className = "item-meta";
    metaEl.textContent = meta;
    li.appendChild(metaEl);
  }
  return li;
}
