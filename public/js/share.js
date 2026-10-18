/**
 * share.js: Página pública de una snapshot compartida.
 * Pinta los datos con textContent / createElement: el nombre de Spotify
 * y la foto los controla cada usuario y nunca se interpretan como HTML.
 */
import { longDate, timeAgo } from "./format.js";
import { renderList, buildListItem } from "./list-item.js";

const PLUS_ICON =
  '<svg class="icon" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/></svg>';

const snapshotId = location.pathname.split("/share/")[1] || "";
const app = document.getElementById("app");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function showError() {
  app.replaceChildren();
  const box = el("div", "share-error");
  const link = el("a", "btn btn--outline", "Ir a Frecuencia");
  link.href = "/";
  box.append(el("p", null, "Este enlace no existe o ha caducado."), link);
  app.appendChild(box);
}

const SAFE_IMAGE = /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i;

function buildHeader({ stats, avatarBase64, createdAt }) {
  const header = el("header", "share-header");

  const wrapper = el("div", "avatar-wrapper");
  const circle = el("span", "avatar-circle");
  if (avatarBase64 && SAFE_IMAGE.test(avatarBase64)) {
    const img = el("img", "avatar-img");
    img.src = avatarBase64;
    img.alt = "";
    circle.appendChild(img);
  } else {
    const placeholder = el("span", "avatar-placeholder");
    placeholder.innerHTML = PLUS_ICON; // marcado fijo, sin datos de usuario
    circle.appendChild(placeholder);
  }
  wrapper.appendChild(circle);

  const followers = stats.profile?.followers ?? 0;
  header.append(
    wrapper,
    el("h1", "share-name", stats.profile?.displayName || "Usuario"),
    el("p", "share-meta", `${followers} ${followers === 1 ? "seguidor" : "seguidores"}`),
    el("p", "share-badge", `Estadísticas del ${longDate(createdAt)}`)
  );
  return header;
}

function buildBlock(modifier, title, listId, ranked) {
  const section = el("section", `block block--${modifier}`);
  const h2 = el("h2", "block-title", title);
  h2.id = `title-${listId}`;
  section.setAttribute("aria-labelledby", h2.id);
  const list = el("ol", ranked ? "rank-list rank-list--ranked" : "rank-list");
  section.append(h2, list);
  return { section, list };
}

function render(snapshot) {
  const { stats } = snapshot;
  document.title = `${stats.profile?.displayName || "Usuario"}: estadísticas en Frecuencia`;

  const tracks = buildBlock("tracks", "Canciones más escuchadas", "tracks", true);
  const artists = buildBlock("artists", "Artistas favoritos", "artists", true);
  const recent = buildBlock("recent", "Reproducido recientemente", "recent", false);

  renderList(tracks.list, stats.topTracks, (t) =>
    buildListItem({ imageUrl: t.imageUrl, title: t.name, subtitle: t.artist })
  );
  renderList(artists.list, stats.topArtists, (a) =>
    buildListItem({
      imageUrl: a.imageUrl,
      title: a.name,
      subtitle: a.genres?.slice(0, 2).join(", ") || "",
    })
  );
  renderList(recent.list, stats.recentlyPlayed, (r) =>
    buildListItem({
      imageUrl: r.imageUrl,
      title: r.name,
      subtitle: r.artist,
      meta: timeAgo(r.playedAt),
    })
  );

  const grid = el("div", "stats");
  grid.append(tracks.section, artists.section, recent.section);
  app.replaceChildren(buildHeader(snapshot), grid);
}

async function load() {
  let json = { success: false };
  try {
    const res = await fetch(`/api/share/${encodeURIComponent(snapshotId)}`);
    json = await res.json();
  } catch { /* se trata como enlace no encontrado */ }
  if (!json.success) return showError();
  render(json.snapshot);
}

load();
