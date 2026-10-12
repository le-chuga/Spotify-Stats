const snapshotId = location.pathname.split("/share/")[1];
const app = document.getElementById("app");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderItem(imageUrl, title, subtitle) {
  const li = element("li");
  if (imageUrl) {
    const image = element("img");
    image.src = imageUrl;
    image.alt = "";
    image.loading = "lazy";
    li.appendChild(image);
  }
  const text = element("div", "item-text");
  text.append(element("p", "item-title", title || "Sin título"));
  text.append(element("p", "item-subtitle", subtitle || ""));
  li.appendChild(text);
  return li;
}

function renderList(items, mapItem) {
  const list = element("ol", "stats-list");
  if (!Array.isArray(items) || items.length === 0) {
    list.append(element("li", "stats-empty", "No hay datos disponibles para este apartado."));
    return list;
  }
  items.forEach((item) => list.appendChild(mapItem(item)));
  return list;
}

function renderSection(label, title, number, list) {
  const section = element("article", "stats-block");
  const heading = element("div", "stats-block-heading");
  const copy = document.createElement("div");
  copy.append(element("p", "eyebrow", label));
  copy.append(element("h2", "stats-block-title", title));
  heading.append(copy, element("span", "section-number", number));
  section.append(heading, list);
  return section;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function showError(message) {
  const brand = app.querySelector(".share-brand");
  app.replaceChildren(brand, element("p", "share-error", message));
}

async function load() {
  try {
    const response = await fetch(`/api/share/${encodeURIComponent(snapshotId)}`);
    const json = await response.json();
    if (!response.ok || !json.success || !json.snapshot) {
      showError(json.error || "Este enlace no existe o ya no está disponible.");
      return;
    }

    const { stats = {}, avatarBase64, createdAt } = json.snapshot;
    const brand = app.querySelector(".share-brand");
    const profile = stats.profile || {};
    const header = element("header", "share-header");
    if (avatarBase64) {
      const avatar = element("img", "share-avatar");
      avatar.src = avatarBase64;
      avatar.alt = "";
      header.appendChild(avatar);
    } else {
      header.appendChild(element("div", "share-avatar-placeholder", "F"));
    }
    const profileCopy = document.createElement("div");
    profileCopy.append(element("h1", "share-name", profile.displayName || "Resumen de escucha"));
    profileCopy.append(element("p", "share-meta", `${profile.followers ?? 0} seguidores`));
    profileCopy.append(element("p", "share-badge", `Escuchado · ${formatDate(createdAt)}`));
    header.appendChild(profileCopy);

    const grid = element("div", "share-grid");
    grid.append(
      renderSection("Lo que vuelve", "Canciones favoritas", "01", renderList(stats.topTracks, (track) =>
        renderItem(track.imageUrl, track.name, track.artist))),
      renderSection("Tu constelación", "Artistas favoritos", "02", renderList(stats.topArtists, (artist) =>
        renderItem(artist.imageUrl, artist.name, artist.genres?.slice(0, 2).join(", ") || "")))
    );
    const recent = renderSection("Ahora mismo", "Escuchado hace poco", "03", renderList(stats.recentlyPlayed, (item) =>
      renderItem(item.imageUrl, item.name, [item.artist, formatDate(item.playedAt)].filter(Boolean).join(" · "))));
    recent.classList.add("share-block--wide");
    grid.appendChild(recent);
    app.replaceChildren(brand, header, grid);
  } catch {
    showError("No se pudo cargar este resumen. Comprueba tu conexión e inténtalo de nuevo.");
  }
}

load();
