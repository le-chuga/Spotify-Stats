const crypto = require("crypto");

/**
 * Caso de uso: Gestionar snapshots compartibles de estadísticas.
 * Al crear una snapshot, se guarda el estado actual de las estadísticas
 * con un ID único. Cualquiera con el ID puede verla sin autenticarse.
 */
class SnapshotUseCase {
  constructor(snapshotRepository, userRepository, spotifyClient) {
    this.snapshotRepository = snapshotRepository;
    this.userRepository = userRepository;
    this.spotifyClient = spotifyClient;
  }

  /**
   * Crea una snapshot de las estadísticas actuales del usuario.
   * @param {string} accountId
   * @returns {Promise<{success:boolean, id?:string, error?:string}>}
   */
  async createSnapshot(accountId) {
    const user = await this.userRepository.findByAccountId(accountId);
    if (!user || !user.spotifyTokens) {
      return { success: false, error: "No tienes Spotify vinculado" };
    }

    let { accessToken, refreshToken, expiresAt } = user.spotifyTokens;

    if (!accessToken || Date.now() > Number(expiresAt) - 60000) {
      const refreshed = await this.spotifyClient.refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      await this.userRepository.saveSpotifyTokens(accountId, refreshed);
    }

    try {
      const stats = await this.spotifyClient.fetchListeningStats(accessToken);
      const id = crypto.randomBytes(8).toString("hex"); // 16 chars, suficiente para URLs
      await this.snapshotRepository.save(
        id,
        accountId,
        JSON.stringify(stats),
        user.avatarBase64 || null
      );
      return { success: true, id };
    } catch (err) {
      console.error("[Snapshot] Error:", err.message);
      return { success: false, error: "No se pudo generar la snapshot" };
    }
  }

  /**
   * Obtiene una snapshot por su ID (acceso público, sin autenticación).
   * @param {string} id
   */
  async getSnapshot(id) {
    const snapshot = await this.snapshotRepository.findById(id);
    if (!snapshot) return { success: false, error: "Enlace no encontrado o caducado" };
    return { success: true, snapshot };
  }
}

module.exports = SnapshotUseCase;
