const axios = require("axios");

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// IMPORTANTE:
// Estas credenciales hay que crearlas en https://developer.spotify.com/dashboard
// Desde abril 2025, Spotify ya NO permite "localhost" como redirect URI:
// solo se permiten direcciones loopback literales (127.0.0.1).
// Añade como Redirect URI exactamente: http://127.0.0.1:3000/api/spotify/callback
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "TU_SPOTIFY_CLIENT_ID";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "TU_SPOTIFY_CLIENT_SECRET";
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:3000/api/spotify/callback";

const SCOPES = [
  "user-top-read",
  "user-read-recently-played",
  "user-read-email",
  "user-read-private",
  "user-library-read",
  "playlist-modify-private",
  "playlist-modify-public",
].join(" ");

/**
 * Adaptador de infraestructura para la API de Spotify.
 * Encapsula toda la comunicación HTTP con Spotify: nada de esto
 * "se filtra" hacia la capa de aplicación o dominio.
 */
class SpotifyClient {
  /**
   * Construye la URL a la que se debe redirigir al usuario para
   * que inicie sesión con sus credenciales de Spotify (OAuth).
   * @param {string} state - valor anti-CSRF (p.ej. el accountId interno)
   */
  buildAuthorizeUrl(state) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state,
    });
    return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Intercambia el "code" recibido en el callback por tokens de acceso.
   * @param {string} code
   * @returns {Promise<{accessToken:string, refreshToken:string, expiresAt:number}>}
   */
  async exchangeCodeForTokens(code) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    });

    const response = await axios.post(SPOTIFY_TOKEN_URL, body.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      },
    });

    const { access_token, refresh_token, expires_in } = response.data;
    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
    };
  }

  /**
   * Renueva el access token usando el refresh token guardado.
   */
  async refreshAccessToken(refreshToken) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const response = await axios.post(SPOTIFY_TOKEN_URL, body.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      },
    });

    const { access_token, expires_in } = response.data;
    return {
      accessToken: access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresAt: Date.now() + expires_in * 1000,
    };
  }

  /**
   * Llama a varios endpoints de Spotify para recoger estadísticas
   * reales de escucha del usuario autenticado.
   * @param {string} accessToken
   */
  async fetchListeningStats(accessToken) {
    const headers = { Authorization: `Bearer ${accessToken}` };

    const [profile, topTracks, topArtists, recentlyPlayed] = await Promise.all([
      axios.get(`${SPOTIFY_API_BASE}/me`, { headers }),
      axios.get(`${SPOTIFY_API_BASE}/me/top/tracks?limit=10&time_range=medium_term`, { headers }),
      axios.get(`${SPOTIFY_API_BASE}/me/top/artists?limit=10&time_range=medium_term`, { headers }),
      axios.get(`${SPOTIFY_API_BASE}/me/player/recently-played?limit=10`, { headers }),
    ]);

    return {
      profile: {
        displayName: profile.data.display_name,
        email: profile.data.email,
        followers: profile.data.followers?.total ?? 0,
        avatarUrl: profile.data.images?.[0]?.url || null,
      },
      topTracks: topTracks.data.items.map((t) => ({
        name: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        album: t.album?.name,
        imageUrl: t.album?.images?.[0]?.url || null,
        popularity: t.popularity,
      })),
      topArtists: topArtists.data.items.map((a) => ({
        name: a.name,
        genres: a.genres,
        imageUrl: a.images?.[0]?.url || null,
        popularity: a.popularity,
      })),
      recentlyPlayed: recentlyPlayed.data.items.map((r) => ({
        name: r.track.name,
        artist: r.track.artists.map((a) => a.name).join(", "),
        playedAt: r.played_at,
        imageUrl: r.track.album?.images?.[0]?.url || null,
      })),
    };
  }

  /**
   * Obtiene TODAS las canciones de "Canciones que te gustan" (Liked Songs).
   * Itera todas las páginas (la API devuelve máx 50 por página).
   * @param {string} accessToken
   * @returns {Promise<Array<{uri:string, name:string, artistNames:string[]}>>}
   */
  async getAllLikedSongs(accessToken) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const tracks = [];
    let url = `${SPOTIFY_API_BASE}/me/tracks?limit=50`;

    while (url) {
      const res = await axios.get(url, { headers });
      for (const item of res.data.items) {
        if (!item.track) continue;
        tracks.push({
          uri: item.track.uri,
          name: item.track.name,
          artistNames: item.track.artists.map((a) => a.name),
        });
      }
      url = res.data.next || null;
    }

    return tracks;
  }

  /**
   * Crea una nueva playlist privada en la cuenta del usuario.
   * Usa POST /me/playlists (el endpoint POST /users/{id}/playlists
   * fue eliminado en febrero de 2026).
   * @param {string} accessToken
   * @param {string} name - Nombre de la nueva playlist
   * @returns {Promise<string>} ID de la playlist creada
   */
  async createPlaylist(accessToken, name) {
    const res = await axios.post(
      `${SPOTIFY_API_BASE}/me/playlists`,
      { name, public: false, description: "Creada por Frecuencia" },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );
    return res.data.id;
  }

  /**
   * Añade canciones a una playlist en lotes de 100 (límite de la API).
   * @param {string} accessToken
   * @param {string} playlistId
   * @param {string[]} uris - URIs de Spotify de las canciones
   */
  async addTracksToPlaylist(accessToken, playlistId, uris) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    // La API admite máx 100 URIs por petición.
    // Nota: desde febrero 2026 el endpoint cambió de /tracks a /items
    for (let i = 0; i < uris.length; i += 100) {
      const batch = uris.slice(i, i + 100);
      await axios.post(
        `${SPOTIFY_API_BASE}/playlists/${playlistId}/items`,
        { uris: batch },
        { headers }
      );
    }
  }
}

module.exports = SpotifyClient;
