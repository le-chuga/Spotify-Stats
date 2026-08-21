/**
 * share.js — Lógica de la página pública de snapshot compartida.
 * Carga los datos de la snapshot desde la API y los renderiza en el DOM.
 */

const snapshotId = location.pathname.split("/share/")[1];

async function load() {
  const res = await fetch(`/api/share/${snapshotId}`);
  const json = await res.json();
  const app = document.getElementById("app");

  if (!json.success) {
    app.innerHTML = `<p class="share-error">Este enlace no existe o ha caducado.</p>`;
    return;
  }

  const { stats, avatarBase64, createdAt } = json.snapshot;

  const date = new Date(createdAt).toLocaleDateString("es-ES", {
    day: "numeric", month: "long", year: "numeric",
  });

  app.innerHTML = `
    <div class="share-header">
      ${
        avatarBase64
          ? `<img class="share-avatar" src="${avatarBase64}" alt="" />`
          : `<div class="share-avatar-placeholder">
               <svg viewBox="0 0 56 56" width="32" height="32" fill="none">
                 <line x1="28" y1="16" x2="28" y2="40" stroke="#9CA3AF" stroke-width="3" stroke-linecap="round"/>
                 <line x1="16" y1="28" x2="40" y2="28" stroke="#9CA3AF" stroke-width="3" stroke-linecap="round"/>
               </svg>
             </div>`
      }
      <h1 class="share-name">${stats.profile?.displayName || "Usuario"}</h1>
      <p class="share-meta">${stats.profile?.followers ?? 0} seguidores</p>
      <p class="share-badge">Estadísticas · ${date}</p>
    </div>

    <div class="share-grid">
      <article class="stats-block">
        <h3 class="stats-block-title">Canciones más escuchadas</h3>
        <ol class="stats-list">${renderTracks(stats.topTracks)}</ol>
      </article>
      <article class="stats-block">
        <h3 class="stats-block-title">Artistas favoritos</h3>
        <ol class="stats-list">${renderArtists(stats.topArtists)}</ol>
      </article>
      <article class="stats-block share-block--wide">
        <h3 class="stats-block-title">Reproducido recientemente</h3>
        <ol class="stats-list">${renderRecent(stats.recentlyPlayed)}</ol>
      </article>
    </div>
  `;
}

function item(imageUrl, title, subtitle) {
  return `<li>
    ${imageUrl ? `<img src="${imageUrl}" alt="" />` : ""}
    <div class="item-text">
      <p class="item-title">${title}</p>
      <p class="item-subtitle">${subtitle}</p>
    </div>
  </li>`;
}

function renderTracks(tracks = []) {
  if (!tracks.length) return `<li class="stats-empty">Sin datos</li>`;
  return tracks.map((t) => item(t.imageUrl, t.name, t.artist)).join("");
}

function renderArtists(artists = []) {
  if (!artists.length) return `<li class="stats-empty">Sin datos</li>`;
  return artists
    .map((a) => item(a.imageUrl, a.name, a.genres?.slice(0, 2).join(", ") || "Sin géneros"))
    .join("");
}

function renderRecent(recent = []) {
  if (!recent.length) return `<li class="stats-empty">Sin datos</li>`;
  return recent
    .map((r) =>
      item(r.imageUrl, r.name, `${r.artist} · ${new Date(r.playedAt).toLocaleString("es-ES")}`)
    )
    .join("");
}

load();
