/**
 * Caso de uso: Vincular la cuenta de Spotify (tokens OAuth) a la cuenta
 * interna de la aplicación, tras el flujo de autorización.
 */
class LinkSpotifyAccountUseCase {
  /**
   * @param {import('../../domain/repositories/UserRepository')} userRepository
   * @param {import('../../infrastructure/spotify/SpotifyClient')} spotifyClient
   */
  constructor(userRepository, spotifyClient) {
    this.userRepository = userRepository;
    this.spotifyClient = spotifyClient;
  }

  /**
   * @param {string} accountId - cuenta interna del usuario logueado
   * @param {string} code - "code" devuelto por Spotify en el callback
   * @returns {Promise<{success:boolean, error?:string}>}
   */
  async execute(accountId, code) {
    const user = await this.userRepository.findByAccountId(accountId);
    if (!user) {
      return { success: false, error: "Usuario no encontrado" };
    }

    try {
      const tokens = await this.spotifyClient.exchangeCodeForTokens(code);
      await this.userRepository.saveSpotifyTokens(accountId, tokens);
      return { success: true };
    } catch (err) {
      return { success: false, error: "No se pudo completar la autenticación con Spotify" };
    }
  }
}

module.exports = LinkSpotifyAccountUseCase;
