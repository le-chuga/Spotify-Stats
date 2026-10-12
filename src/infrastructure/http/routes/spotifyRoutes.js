import { Hono } from "hono";
import { SpotifyClient } from "../../spotify/SpotifyClient.js";
import { D1UserRepository } from "../../repositories/D1UserRepository.js";
import { getSession, saveSession, setSessionCookie } from "../../session.js";

export const spotifyRoutes = new Hono();

async function getAuthedUser(c) {
  const { id: sessionId, data } = await getSession(c);
  if (!data.accountId) return { sessionId, accountId: null, user: null, repo: null, spotify: null };
  const repo = new D1UserRepository(c.env.DB);
  const user = await repo.findByAccountId(data.accountId);
  const spotify = new SpotifyClient(c.env);
  return { sessionId, accountId: data.accountId, user, repo, spotify };
}

async function getFreshToken(user, repo, spotify, accountId) {
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

// POST /api/spotify/playlist
spotifyRoutes.post("/playlist", async (c) => {
  const { accountId, user, repo, spotify } = await getAuthedUser(c);
  if (!accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  if (!user?.spotifyTokens) return c.json({ success: false, error: "No tienes Spotify vinculado" }, 400);
  const { artistNames, playlistTitle } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(artistNames) || artistNames.length === 0) return c.json({ success: false, error: "Selecciona al menos un artista" }, 400);
  try {
    const accessToken = await getFreshToken(user, repo, spotify, accountId);
    const normalized = artistNames.map(n => n.toLowerCase().trim());
    const likedSongs = await spotify.getAllLikedSongs(accessToken);
    const matching = likedSongs.filter(t => t.artistNames.some(a => normalized.includes(a.toLowerCase().trim())));
    if (!matching.length) return c.json({ success: false, error: "No encontramos canciones de esos artistas en tus Canciones que te gustan" }, 400);
    const name = playlistTitle || "Frecuencia: " + artistNames.slice(0, 3).join(", ") + (artistNames.length > 3 ? ` +${artistNames.length - 3}` : "");
    const playlistId = await spotify.createPlaylist(accessToken, name);
    await spotify.addTracksToPlaylist(accessToken, playlistId, matching.map(t => t.uri));
    return c.json({ success: true, playlistName: name, trackCount: matching.length });
  } catch (err) {
    const status = err?.status || err?.response?.data?.error?.status;
    if (status === 403) return c.json({ success: false, error: "Spotify no permite crear playlists desde apps en modo desarrollo. Añade tu email en User Management del dashboard de Spotify." }, 400);
    return c.json({ success: false, error: "No se pudo crear la playlist." }, 400);
  }
});

