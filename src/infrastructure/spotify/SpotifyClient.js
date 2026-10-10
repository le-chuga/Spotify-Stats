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
].join(" ");

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
      const data = await res.json();
      for (const item of (data.items || [])) {
        if (!item.track) continue;
        tracks.push({ uri: item.track.uri, name: item.track.name, artistNames: item.track.artists.map(a => a.name) });
      }
      url = data.next || null;
    }
    return tracks;
  }

  async createPlaylist(accessToken, name) {
    const res = await fetch(`${SPOTIFY_API_BASE}/me/playlists`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, public: false, description: "Creada por Frecuencia" }),
    });
    const d = await res.json();
    return d.id;
  }

  async addTracksToPlaylist(accessToken, playlistId, uris) {
    for (let i = 0; i < uris.length; i += 100) {
      await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/items`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
      });
    }
  }
}
