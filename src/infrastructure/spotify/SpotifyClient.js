/**
 * Cliente HTTP de Spotify compatible con Cloudflare Workers.
 * Usa el binding env recibido por Hono y APIs web estándar.
 */
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const DEFAULT_REDIRECT_URI = "https://frecuencia.le-chugassubdomain.workers.dev/api/spotify/callback";

const SCOPES = [
  "user-top-read",
  "user-read-recently-played",
  "user-read-email",
  "user-read-private",
  "user-library-read",
  "playlist-modify-private",
  "playlist-modify-public",
].join(" ");

export class SpotifyClient {
  constructor(env = {}) {
    this.clientId = env.SPOTIFY_CLIENT_ID || "";
    this.clientSecret = env.SPOTIFY_CLIENT_SECRET || "";
    this.redirectUri = env.SPOTIFY_REDIRECT_URI || DEFAULT_REDIRECT_URI;
  }

  assertConfigured() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("Configura SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET como secretos del Worker.");
    }
  }

  async request(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!response.ok) {
      const detail = data?.error?.message || data?.error_description || data?.error || response.statusText;
      const error = new Error(`Spotify devolvió ${response.status}: ${detail}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  buildAuthorizeUrl(state) {
    this.assertConfigured();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      scope: SCOPES,
      redirect_uri: this.redirectUri,
      state,
    });
    return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code) {
    this.assertConfigured();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
    });
    const data = await this.request(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      },
      body,
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }

  async refreshAccessToken(refreshToken) {
    this.assertConfigured();
    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
    const data = await this.request(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      },
      body,
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }

  async apiRequest(url, accessToken, options = {}) {
    return this.request(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers || {}),
      },
    });
  }

  async fetchListeningStats(accessToken) {
    const [profile, topTracks, topArtists, recentlyPlayed] = await Promise.all([
      this.apiRequest(`${SPOTIFY_API_BASE}/me`, accessToken),
      this.apiRequest(`${SPOTIFY_API_BASE}/me/top/tracks?limit=10&time_range=medium_term`, accessToken),
      this.apiRequest(`${SPOTIFY_API_BASE}/me/top/artists?limit=10&time_range=medium_term`, accessToken),
      this.apiRequest(`${SPOTIFY_API_BASE}/me/player/recently-played?limit=10`, accessToken),
    ]);
    return {
      profile: {
        displayName: profile.display_name,
        email: profile.email,
        followers: profile.followers?.total ?? 0,
        avatarUrl: profile.images?.[0]?.url || null,
      },
      topTracks: topTracks.items.map((track) => ({
        name: track.name,
        artist: track.artists.map((artist) => artist.name).join(", "),
        album: track.album?.name,
        imageUrl: track.album?.images?.[0]?.url || null,
        popularity: track.popularity,
      })),
      topArtists: topArtists.items.map((artist) => ({
        name: artist.name,
        genres: artist.genres,
        imageUrl: artist.images?.[0]?.url || null,
        popularity: artist.popularity,
      })),
      recentlyPlayed: recentlyPlayed.items.map((item) => ({
        name: item.track.name,
        artist: item.track.artists.map((artist) => artist.name).join(", "),
        playedAt: item.played_at,
        imageUrl: item.track.album?.images?.[0]?.url || null,
      })),
    };
  }

  async getAllLikedSongs(accessToken) {
    const tracks = [];
    let url = `${SPOTIFY_API_BASE}/me/tracks?limit=50`;
    while (url) {
      const data = await this.apiRequest(url, accessToken);
      for (const item of data.items) {
        if (!item.track) continue;
        tracks.push({
          uri: item.track.uri,
          name: item.track.name,
          artistNames: item.track.artists.map((artist) => artist.name),
        });
      }
      url = data.next || null;
    }
    return tracks;
  }

  async createPlaylist(accessToken, name) {
    const data = await this.apiRequest(`${SPOTIFY_API_BASE}/me/playlists`, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, public: false, description: "Creada por Frecuencia" }),
    });
    return data.id;
  }

  async addTracksToPlaylist(accessToken, playlistId, uris) {
    for (let i = 0; i < uris.length; i += 100) {
      await this.apiRequest(`${SPOTIFY_API_BASE}/playlists/${playlistId}/items`, accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
      });
    }
  }
}
