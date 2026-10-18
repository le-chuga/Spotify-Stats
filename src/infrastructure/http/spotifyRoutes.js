import { Hono } from "hono";
import { SpotifyClient, SpotifyApiError } from "../spotify/SpotifyClient.js";
import { extractPlaylistId, findCommonTracks } from "../../domain/commonTracks.js";
import { D1UserRepository } from "../repositories/D1UserRepository.js";
import { getSession, saveSession, setSessionCookie } from "../session.js";

export const spotifyRoutes = new Hono();

const MAX_ARTISTS = 50;

async function getAuthedUser(c) {
  const { id: sessionId, data } = await getSession(c);
  if (!data.accountId) return { sessionId, accountId: null, user: null, repo: null, spotify: null };
  const repo = new D1UserRepository(c.env.DB);
  const user = await repo.findByAccountId(data.accountId);
  const spotify = new SpotifyClient(c.env);
  return { sessionId, accountId: data.accountId, user, repo, spotify };
}

export async function getFreshToken(user, repo, spotify, accountId) {
  let { accessToken, refreshToken, expiresAt } = user.spotifyTokens;
  if (!accessToken || Date.now() > Number(expiresAt) - 60000) {
    const refreshed = await spotify.refreshAccessToken(refreshToken);
    accessToken = refreshed.accessToken;
    await repo.saveSpotifyTokens(accountId, refreshed);
  }
  return accessToken;
}

// GET /api/spotify/login
spotifyRoutes.get("/login", async (c) => {
  const { accountId } = (await getSession(c)).data;
  if (!accountId) return c.json({ error: "No autenticado" }, 401);
  const spotify = new SpotifyClient(c.env);
  return c.redirect(spotify.buildAuthorizeUrl(accountId));
});

// GET /api/spotify/callback
spotifyRoutes.get("/callback", async (c) => {
  const { code, state, error } = c.req.query();
  if (error) return c.redirect("/?spotify_error=" + encodeURIComponent(error));
  const repo = new D1UserRepository(c.env.DB);
  const spotify = new SpotifyClient(c.env);
  try {
    const tokens = await spotify.exchangeCodeForTokens(code);
    await repo.saveSpotifyTokens(state, tokens);
  } catch {
    return c.redirect("/?spotify_error=No+se+pudo+autenticar+con+Spotify");
  }
  return c.redirect("/?spotify_linked=1");
});

// GET /api/spotify/stats
spotifyRoutes.get("/stats", async (c) => {
  const { accountId, user, repo, spotify } = await getAuthedUser(c);
  if (!accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  if (!user?.spotifyTokens) return c.json({ success: false, error: "Esta cuenta no tiene Spotify vinculado todavía" }, 400);
  try {
    const accessToken = await getFreshToken(user, repo, spotify, accountId);
    const stats = await spotify.fetchListeningStats(accessToken);
    return c.json({ success: true, stats });
  } catch {
    return c.json({ success: false, error: "No se pudieron obtener las estadísticas de Spotify." }, 400);
  }
});

// GET /api/spotify/search/artists?q=...
spotifyRoutes.get("/search/artists", async (c) => {
  const { accountId, user, repo, spotify } = await getAuthedUser(c);
  if (!accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  if (!user?.spotifyTokens) return c.json({ success: false, error: "No tienes Spotify vinculado" }, 400);
  const q = (c.req.query("q") || "").trim().slice(0, 100);
  if (!q) return c.json({ success: true, artists: [] });
  try {
    const accessToken = await getFreshToken(user, repo, spotify, accountId);
    return c.json({ success: true, artists: await spotify.searchArtists(accessToken, q) });
  } catch (err) {
    if (err?.status === 429) return c.json({ success: false, error: "Spotify está limitando las búsquedas. Espera unos segundos." }, 429);
    if (err?.status === 401) return c.json({ success: false, error: "Tu sesión de Spotify ha caducado. Vuelve a conectar tu cuenta." }, 401);
    return c.json({ success: false, error: "No se pudo buscar en Spotify." }, 400);
  }
});

// POST /api/spotify/playlist
spotifyRoutes.post("/playlist", async (c) => {
  const { accountId, user, repo, spotify } = await getAuthedUser(c);
  if (!accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  if (!user?.spotifyTokens) return c.json({ success: false, error: "No tienes Spotify vinculado" }, 400);
  const { artistNames, playlistTitle } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(artistNames) || artistNames.length === 0) return c.json({ success: false, error: "Selecciona al menos un artista" }, 400);
  if (artistNames.length > MAX_ARTISTS || !artistNames.every((n) => typeof n === "string" && n.trim() && n.length <= 100)) {
    return c.json({ success: false, error: `Elige entre 1 y ${MAX_ARTISTS} artistas` }, 400);
  }
  try {
    const accessToken = await getFreshToken(user, repo, spotify, accountId);
    const wanted = artistNames.map((n) => ({ name: n.trim(), key: n.trim().toLowerCase() }));
    const likedSongs = await spotify.getAllLikedSongs(accessToken);
    const hit = new Set();
    const matching = likedSongs.filter((t) => {
      let ok = false;
      for (const a of t.artistNames) {
        const key = a.toLowerCase().trim();
        if (wanted.some((w) => w.key === key)) { hit.add(key); ok = true; }
      }
      return ok;
    });
    const missingArtists = wanted.filter((w) => !hit.has(w.key)).map((w) => w.name);
    if (!matching.length) {
      const who = wanted.map((w) => w.name).join(", ");
      return c.json({ success: false, error: `No encontramos canciones de ${who} en tus Canciones que te gustan` }, 400);
    }
    const title = typeof playlistTitle === "string" ? playlistTitle.trim().slice(0, 100) : "";
    const name = title || "Frecuencia: " + artistNames.slice(0, 3).join(", ") + (artistNames.length > 3 ? ` +${artistNames.length - 3}` : "");
    const playlistId = await spotify.createPlaylist(accessToken, name);
    await spotify.addTracksToPlaylist(accessToken, playlistId, matching.map(t => t.uri));
    return c.json({ success: true, playlistName: name, trackCount: matching.length, missingArtists });
  } catch (err) {
    const status = err?.status;
    if (status === 403) return c.json({ success: false, error: "Spotify no permite crear playlists desde apps en modo desarrollo. Añade tu email en User Management del dashboard de Spotify." }, 400);
    if (status === 429) return c.json({ success: false, error: "Spotify está limitando las peticiones. Espera un minuto e inténtalo de nuevo." }, 429);
    return c.json({ success: false, error: "No se pudo crear la playlist." }, 400);
  }
});

/* ----------------------------------------------------------
   Canciones en común entre varias playlists
   ---------------------------------------------------------- */
const MAX_PLAYLISTS = 6;
const MAX_TITLE = 100;
const MAX_URIS = 10000;
const TRACK_URI_RE = /^spotify:track:[A-Za-z0-9]{22}$/;

/** Error con mensaje listo para mostrar al usuario. */
class CommonError extends Error {
  constructor(message, { status = 400, index = null, reconnect = false } = {}) {
    super(message);
    this.status = status;
    this.index = index;
    this.reconnect = reconnect;
  }
}

function commonFailure(c, err) {
  if (err instanceof CommonError) {
    return c.json({ success: false, error: err.message, errorIndex: err.index, reconnect: err.reconnect }, err.status);
  }
  const status = err?.status;
  if (status === 401) return c.json({ success: false, error: "Tu sesión de Spotify ha caducado. Vuelve a conectar tu cuenta.", reconnect: true }, 401);
  if (status === 429) return c.json({ success: false, error: "Spotify está limitando las peticiones. Espera un minuto e inténtalo de nuevo." }, 429);
  if (status === 413) return c.json({ success: false, error: "Una de las playlists es demasiado grande para compararla (máximo 3000 canciones)." }, 400);
  return null;
}

/** Descarga info y canciones de una playlist y traduce los fallos a mensajes comprensibles. */
async function loadPlaylist(spotify, accessToken, id, index) {
  const label = `la playlist ${index + 1}`;
  let info;
  try {
    info = await spotify.getPlaylistInfo(accessToken, id);
  } catch (err) {
    if (err?.status === 404) throw new CommonError(`No encontramos ${label}. Revisa el enlace.`, { index });
    throw err;
  }

  try {
    const tracks = await spotify.getPlaylistTracks(accessToken, id);
    return { id, name: info.name, ownerName: info.ownerName, tracks };
  } catch (err) {
    if (err?.status !== 403 && err?.status !== 404) throw err;
    // Spotify solo entrega el contenido de playlists propias o colaborativas.
    let isMine = false;
    try { isMine = (await spotify.getCurrentUserId(accessToken)) === info.ownerId; } catch {}
    if (isMine || info.collaborative) {
      throw new CommonError(
        `No hemos podido leer «${info.name}». Falta el permiso de lectura de playlists: vuelve a conectar Spotify y acéptalo.`,
        { index, reconnect: true }
      );
    }
    throw new CommonError(
      `No podemos leer «${info.name}»${info.ownerName ? ` (de ${info.ownerName})` : ""}. Spotify solo permite a esta app leer playlists tuyas o en las que colaboras.`,
      { index }
    );
  }
}

// POST /api/spotify/common/preview  { urls: string[] }
spotifyRoutes.post("/common/preview", async (c) => {
  const { accountId, user, repo, spotify } = await getAuthedUser(c);
  if (!accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  if (!user?.spotifyTokens) return c.json({ success: false, error: "No tienes Spotify vinculado" }, 400);

  const { urls } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(urls) || urls.length < 2) return c.json({ success: false, error: "Introduce al menos 2 playlists" }, 400);
  if (urls.length > MAX_PLAYLISTS) return c.json({ success: false, error: `Puedes comparar como máximo ${MAX_PLAYLISTS} playlists a la vez` }, 400);

  const ids = [];
  for (let i = 0; i < urls.length; i++) {
    const id = extractPlaylistId(urls[i]);
    if (!id) return c.json({ success: false, error: `El enlace ${i + 1} no es una playlist de Spotify`, errorIndex: i }, 400);
    const dup = ids.indexOf(id);
    if (dup !== -1) return c.json({ success: false, error: `Los enlaces ${dup + 1} y ${i + 1} son la misma playlist`, errorIndex: i }, 400);
    ids.push(id);
  }

  try {
    const accessToken = await getFreshToken(user, repo, spotify, accountId);
    const playlists = await Promise.all(ids.map((id, i) => loadPlaylist(spotify, accessToken, id, i)));
    const common = findCommonTracks(playlists);
    return c.json({
      success: true,
      playlists: playlists.map((p) => ({ name: p.name, ownerName: p.ownerName, trackCount: p.tracks.length })),
      commonCount: common.length,
      uris: common.map((t) => t.uri),
      preview: common.slice(0, 4).map((t) => ({ name: t.name, artist: t.artists.join(", ") })),
    });
  } catch (err) {
    return commonFailure(c, err) ?? c.json({ success: false, error: "No se pudieron leer las playlists." }, 400);
  }
});

// POST /api/spotify/common/create  { uris: string[], title: string, playlistCount: number }
spotifyRoutes.post("/common/create", async (c) => {
  const { accountId, user, repo, spotify } = await getAuthedUser(c);
  if (!accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  if (!user?.spotifyTokens) return c.json({ success: false, error: "No tienes Spotify vinculado" }, 400);

  const { uris, title, playlistCount } = await c.req.json().catch(() => ({}));
  const name = typeof title === "string" ? title.trim() : "";
  if (!name) return c.json({ success: false, error: "Escribe un título para la playlist" }, 400);
  if (name.length > MAX_TITLE) return c.json({ success: false, error: `El título no puede pasar de ${MAX_TITLE} caracteres` }, 400);
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_URIS || !uris.every((u) => typeof u === "string" && TRACK_URI_RE.test(u))) {
    return c.json({ success: false, error: "No hay canciones válidas que añadir" }, 400);
  }
  const unique = [...new Set(uris)];
  const n = Number.isInteger(playlistCount) && playlistCount >= 2 && playlistCount <= MAX_PLAYLISTS ? playlistCount : null;

  try {
    const accessToken = await getFreshToken(user, repo, spotify, accountId);
    const description = `${n ? `Canciones en común de ${n} playlists. ` : ""}Creada por Frecuencia`;
    const playlistId = await spotify.createPlaylist(accessToken, name, description);
    await spotify.addTracksToPlaylist(accessToken, playlistId, unique);
    return c.json({
      success: true,
      playlistName: name,
      trackCount: unique.length,
      playlistUrl: `https://open.spotify.com/playlist/${playlistId}`,
    });
  } catch (err) {
    if (err?.status === 403) return c.json({ success: false, error: "Spotify no permite crear playlists desde apps en modo desarrollo. Añade tu email en User Management del dashboard de Spotify." }, 400);
    return commonFailure(c, err) ?? c.json({ success: false, error: "No se pudo crear la playlist." }, 400);
  }
});
