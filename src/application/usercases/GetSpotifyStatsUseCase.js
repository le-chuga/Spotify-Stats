/**
 * Caso de uso: Obtener las estadísticas reales de escucha de Spotify
 * del usuario actualmente logueado en la app.
 *
 * Orquesta: repositorio (para leer/refrescar tokens) + cliente Spotify
 * (para llamar a la Web API real). No conoce detalles HTTP de Spotify
 * ni detalles de SQL: solo coordina los puertos.
 */
class GetSpotifyStatsUseCase {
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
   * @returns {Promise<{success:boolean, error?:string, stats?:object}>}
   */
  async execute(accountId) {
    const user = await this.userRepository.findByAccountId(accountId);

    if (!user || !user.spotifyTokens) {
      return {
        success: false,
        error: "Esta cuenta no tiene Spotify vinculado todavía",
      };
    }

    let { accessToken, refreshToken, expiresAt } = user.spotifyTokens;

    // Si el token caducó (o caduca en menos de 60s), lo refrescamos.
    if (!accessToken || Date.now() > Number(expiresAt) - 60000) {
      const refreshed = await this.spotifyClient.refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      await this.userRepository.saveSpotifyTokens(accountId, refreshed);
    }

    try {
      const stats = await this.spotifyClient.fetchListeningStats(accessToken);
      return { success: true, stats };
    } catch (err) {
      return {
        success: false,
        error: "No se pudieron obtener las estadísticas de Spotify. Inténtalo de nuevo.",
      };
    }
  }
}

module.exports = GetSpotifyStatsUseCase;
