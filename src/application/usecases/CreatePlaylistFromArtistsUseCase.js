/**
 * Caso de uso: Crear una nueva playlist a partir de los artistas seleccionados.
 *
 * Lógica de negocio:
 *  1. Obtiene todas las "Canciones que te gustan" del usuario (Liked Songs).
 *  2. Filtra las que pertenecen a alguno de los artistas indicados
 *     (comparación case-insensitive para evitar errores de mayúsculas).
 *  3. Crea una nueva playlist privada con el nombre "Frecuencia: <artistas>".
 *  4. Añade las canciones filtradas a la nueva playlist.
 */
class CreatePlaylistFromArtistsUseCase {
  /**
   * @param {import('../../domain/repositories/UserRepository')} userRepository
   * @param {import('../../infrastructure/spotify/SpotifyClient')} spotifyClient
   */
  constructor(userRepository, spotifyClient) {
    this.userRepository = userRepository;
    this.spotifyClient = spotifyClient;
  }

  /**
   * @param {string} accountId
   * @param {string[]} artistNames - Nombres de artistas seleccionados por el usuario
   * @returns {Promise<{success:boolean, error?:string, playlistName?:string, trackCount?:number}>}
   */
  async execute(accountId, artistNames, playlistTitle) {
    if (!artistNames || artistNames.length === 0) {
      return { success: false, error: "Debes seleccionar al menos un artista" };
    }

    const user = await this.userRepository.findByAccountId(accountId);
    if (!user || !user.spotifyTokens) {
      return { success: false, error: "No tienes Spotify vinculado" };
    }

    let { accessToken, refreshToken, expiresAt } = user.spotifyTokens;

    // Refrescar token si está caducado
    if (!accessToken || Date.now() > Number(expiresAt) - 60000) {
      const refreshed = await this.spotifyClient.refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      await this.userRepository.saveSpotifyTokens(accountId, refreshed);
    }

    try {
      // Normalizar artistas a minúsculas para comparación case-insensitive
      const normalizedArtists = artistNames.map((n) => n.toLowerCase().trim());

      // 1) Obtener todas las liked songs
      const likedSongs = await this.spotifyClient.getAllLikedSongs(accessToken);

      // 2) Filtrar las que son de alguno de los artistas seleccionados
      const matchingTracks = likedSongs.filter((track) =>
        track.artistNames.some((artistName) =>
          normalizedArtists.includes(artistName.toLowerCase().trim())
        )
      );

      if (matchingTracks.length === 0) {
        return {
          success: false,
          error:
            "No encontramos canciones de esos artistas en tu playlist de 'Canciones que te gustan'",
        };
      }

      // 3) Crear la playlist con el título elegido por el usuario
      const name = playlistTitle ||
        "Frecuencia: " + artistNames.slice(0, 3).join(", ") +
        (artistNames.length > 3 ? ` +${artistNames.length - 3}` : "");

      const playlistId = await this.spotifyClient.createPlaylist(accessToken, name);

      // 4) Añadir las canciones
      const uris = matchingTracks.map((t) => t.uri);
      await this.spotifyClient.addTracksToPlaylist(accessToken, playlistId, uris);

      return {
        success: true,
        playlistName: name,
        trackCount: matchingTracks.length,
      };
    } catch (err) {
      const status = err?.response?.data?.error?.status;
      const errData = err?.response?.data;
      console.error("[CreatePlaylist] Status:", status);
      console.error("[CreatePlaylist] Headers enviados:", err?.config?.headers);
      console.error("[CreatePlaylist] URL llamada:", err?.config?.url);
      console.error("[CreatePlaylist] Body enviado:", err?.config?.data);
      console.error("[CreatePlaylist] Respuesta Spotify:", JSON.stringify(errData, null, 2));

      if (status === 403) {
        return {
          success: false,
          error:
            "Spotify no permite crear playlists desde apps en modo desarrollo (restricción de Spotify desde febrero 2026). " +
            "Para solucionarlo, ve al dashboard de Spotify → tu app → 'User Management' y añade tu email de Spotify como usuario de prueba.",
        };
      }

      return {
        success: false,
        error: "No se pudo crear la playlist. Comprueba los permisos de Spotify e inténtalo de nuevo.",
      };
    }
  }
}

module.exports = CreatePlaylistFromArtistsUseCase;
