const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

const SCOPES = [
  "user-top-read",
  "user-read-recently-played",
  "user-read-email",
  "user-read-private",
  "user-library-read",
  "playlist-modify-private",
  "playlist-modify-public",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

/** Error de la API de Spotify con el código HTTP, para que las rutas lo traduzcan. */
export class SpotifyApiError extends Error {
  constructor(status, message) {
    super(message || `Spotify respondió ${status}`);
    this.name = "SpotifyApiError";
    this.status = status;
  }
}

// Tope de páginas por playlist (100 canciones por página): evita agotar el límite de
// peticiones de un Worker. Si se supera, se avisa en vez de comparar con datos a medias.
const MAX_PLAYLIST_PAGES = 30;

export class SpotifyClient {
  constructor(env) {
    this.clientId = env.SPOTIFY_CLIENT_ID;
    this.clientSecret = env.SPOTIFY_CLIENT_SECRET;
    this.redirectUri = env.SPOTIFY_REDIRECT_URI;
  }

  buildAuthorizeUrl(state) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      scope: SCOPES,
      redirect_uri: this.redirectUri,
      state,
    });
    return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
  }

  #basicAuth() {
    return "Basic " + btoa(`${this.clientId}:${this.clientSecret}`);
  }

  async exchangeCodeForTokens(code) {
    const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: this.redirectUri });
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: this.#basicAuth() },
      body: body.toString(),
    });
    const d = await res.json();
    return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: Date.now() + d.expires_in * 1000 };
  }

  async refreshAccessToken(refreshToken) {
    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: this.#basicAuth() },
      body: body.toString(),
    });
    const d = await res.json();
    return { accessToken: d.access_token, refreshToken: d.refresh_token || refreshToken, expiresAt: Date.now() + d.expires_in * 1000 };
  }

  async fetchListeningStats(accessToken) {
    const h = { Authorization: `Bearer ${accessToken}` };
    const [profile, topTracks, topArtists, recentlyPlayed] = await Promise.all([
      fetch(`${SPOTIFY_API_BASE}/me`, { headers: h }).then(r => r.json()),
      fetch(`${SPOTIFY_API_BASE}/me/top/tracks?limit=10&time_range=medium_term`, { headers: h }).then(r => r.json()),
      fetch(`${SPOTIFY_API_BASE}/me/top/artists?limit=10&time_range=medium_term`, { headers: h }).then(r => r.json()),
      fetch(`${SPOTIFY_API_BASE}/me/player/recently-played?limit=10`, { headers: h }).then(r => r.json()),
    ]);
    return {
      profile: { displayName: profile.display_name, email: profile.email, followers: profile.followers?.total ?? 0, avatarUrl: profile.images?.[0]?.url || null },
      topTracks: (topTracks.items || []).map(t => ({ name: t.name, artist: t.artists.map(a => a.name).join(", "), album: t.album?.name, imageUrl: t.album?.images?.[0]?.url || null, popularity: t.popularity })),
      topArtists: (topArtists.items || []).map(a => ({ name: a.name, genres: a.genres, imageUrl: a.images?.[0]?.url || null, popularity: a.popularity })),
      recentlyPlayed: (recentlyPlayed.items || []).map(r => ({ name: r.track.name, artist: r.track.artists.map(a => a.name).join(", "), playedAt: r.played_at, imageUrl: r.track.album?.images?.[0]?.url || null })),
    };
  }

  async getAllLikedSongs(accessToken) {
    const h = { Authorization: `Bearer ${accessToken}` };
    const tracks = [];
    let url = `${SPOTIFY_API_BASE}/me/tracks?limit=50`;
    while (url) {
      const res = await fetch(url, { headers: h });
      if (!res.ok) throw new SpotifyApiError(res.status);
      const data = await res.json();
      for (const item of (data.items || [])) {
        const t = item.track ?? item.item;
        if (!t) continue;
        tracks.push({ uri: t.uri, name: t.name, artistNames: (t.artists || []).map(a => a.name) });
      }
      url = data.next || null;
    }
    return tracks;
  }

  /**
   * Busca artistas por nombre (máximo 10: es el tope de Spotify para apps en modo desarrollo).
   * Devuelve nombre, foto pequeña y hasta 2 géneros para distinguir artistas con el mismo nombre.
   */
  async searchArtists(accessToken, query) {
    const params = new URLSearchParams({ q: query, type: "artist", limit: "10" });
    const res = await fetch(`${SPOTIFY_API_BASE}/search?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new SpotifyApiError(res.status);
    const data = await res.json();
    const seen = new Set();
    const artists = [];
    for (const a of data.artists?.items || []) {
      if (!a?.id || !a.name) continue;
      const key = a.name.trim().toLowerCase();
      if (seen.has(key)) continue; // la playlist se arma por nombre: dos con el mismo nombre serían una sola opción
      seen.add(key);
      // las fotos vienen de mayor a menor: nos vale la más pequeña que aún se ve nítida a 40 px
      const imgs = (a.images || []).filter((i) => i?.url);
      const small = [...imgs].reverse().find((i) => (i.width || 0) >= 80) || imgs[imgs.length - 1];
      artists.push({ id: a.id, name: a.name, imageUrl: small?.url || null, genres: (a.genres || []).slice(0, 2) });
    }
    return artists;
  }

  async createPlaylist(accessToken, name, description = "Creada por Frecuencia") {
    const res = await fetch(`${SPOTIFY_API_BASE}/me/playlists`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, public: false, description }),
    });
    if (!res.ok) throw new SpotifyApiError(res.status);
    const d = await res.json();
    return d.id;
  }

  async addTracksToPlaylist(accessToken, playlistId, uris) {
    for (let i = 0; i < uris.length; i += 100) {
      const res = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/items`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
      });
      if (!res.ok) throw new SpotifyApiError(res.status);
    }
  }

  async getCurrentUserId(accessToken) {
    const res = await fetch(`${SPOTIFY_API_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new SpotifyApiError(res.status);
    return (await res.json()).id;
  }

  /** Datos básicos de una playlist (no incluye sus canciones). */
  async getPlaylistInfo(accessToken, playlistId) {
    const fields = "id,name,collaborative,owner(id,display_name)";
    const res = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}?fields=${encodeURIComponent(fields)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new SpotifyApiError(res.status);
    const d = await res.json();
    return {
      id: d.id,
      name: d.name,
      collaborative: Boolean(d.collaborative),
      ownerId: d.owner?.id ?? null,
      ownerName: d.owner?.display_name || d.owner?.id || null,
    };
  }

  /**
   * Todas las canciones de una playlist. Salta episodios de podcast, archivos locales
   * y entradas vacías. Spotify solo devuelve el contenido de playlists propias o colaborativas.
   */
  async getPlaylistTracks(accessToken, playlistId) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const tracks = [];
    let url = `${SPOTIFY_API_BASE}/playlists/${playlistId}/items?limit=100`;
    let pages = 0;
    while (url) {
      if (++pages > MAX_PLAYLIST_PAGES) throw new SpotifyApiError(413, "Playlist demasiado grande");
      const res = await fetch(url, { headers });
      if (!res.ok) throw new SpotifyApiError(res.status);
      const data = await res.json();
      for (const entry of data.items || []) {
        const t = entry?.item ?? entry?.track; // "item" es el nombre actual; "track", el antiguo
        if (!t || t.is_local || t.type !== "track" || !t.id || !t.uri) continue;
        tracks.push({ id: t.id, uri: t.uri, name: t.name, artists: (t.artists || []).map((a) => a.name) });
      }
      url = data.next || null;
    }
    return tracks;
  }
}
