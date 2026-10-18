/**
 * api.js
 * Capa de acceso a datos del frontend: única responsable de hablar
 * con el backend (fetch). El resto del frontend no usa `fetch` directamente.
 */

const BASE = "/api";
const TIMEOUT_MS = 10000;
const SLOW_TIMEOUT_MS = 45000; // leer varias playlists grandes tarda más que una petición normal

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timeoutId) };
}

async function postJson(path, body, timeoutMs = TIMEOUT_MS) {
  const { signal, clear } = withTimeout(null, timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`La petición tardó demasiado (más de ${Math.round(timeoutMs / 1000)}s) y se canceló`);
    }
    throw err;
  } finally {
    clear();
  }
}

async function getJson(path) {
  const { signal, clear } = withTimeout(null, TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("La petición tardó demasiado (más de 10s) y se canceló");
    }
    throw err;
  } finally {
    clear();
  }
}

export const api = {
  register(accountId, password) {
    return postJson("/auth/register", { accountId, password });
  },
  login(accountId, password) {
    return postJson("/auth/login", { accountId, password });
  },
  logout() {
    return postJson("/auth/logout", {});
  },
  session() {
    return getJson("/auth/session");
  },
  spotifyStats() {
    return getJson("/spotify/stats");
  },
  createPlaylist(artistNames, playlistTitle) {
    return postJson("/spotify/playlist", { artistNames, playlistTitle });
  },
  previewCommonTracks(urls) {
    return postJson("/spotify/common/preview", { urls }, SLOW_TIMEOUT_MS);
  },
  createCommonPlaylist(uris, title, playlistCount) {
    return postJson("/spotify/common/create", { uris, title, playlistCount }, SLOW_TIMEOUT_MS);
  },
  getAvatar() {
    return getJson("/avatar");
  },
  saveAvatar(avatarBase64) {
    return postJson("/avatar", { avatarBase64 });
  },
  createShare() {
    return postJson("/share", {});
  },
};
