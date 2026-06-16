/**
 * api.js
 * Capa de acceso a datos del frontend: única responsable de hablar
 * con el backend (fetch). El resto del frontend no usa `fetch` directamente.
 */

const BASE = "/api";
const TIMEOUT_MS = 10000;

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timeoutId) };
}

async function postJson(path, body) {
  const { signal, clear } = withTimeout(null, TIMEOUT_MS);
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
      throw new Error("La petición tardó demasiado (más de 10s) y se canceló");
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
};
