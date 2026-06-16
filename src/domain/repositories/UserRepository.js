/**
 * Puerto (interfaz) del repositorio de usuarios.
 * La capa de dominio/aplicación depende de ESTA abstracción,
 * no de la implementación concreta (SQLite, Mongo, etc).
 *
 * Cualquier implementación en infrastructure/ debe cumplir este contrato.
 */
class UserRepository {
  /**
   * @param {string} accountId
   * @returns {Promise<{accountId:string, passwordHash:string, spotifyTokens:object|null}|null>}
   */
  async findByAccountId(accountId) {
    throw new Error("Método no implementado: findByAccountId");
  }

  /**
   * @param {object} user - { accountId, passwordHash }
   * @returns {Promise<void>}
   */
  async create(user) {
    throw new Error("Método no implementado: create");
  }

  /**
   * Guarda/actualiza los tokens de Spotify asociados a una cuenta.
   * @param {string} accountId
   * @param {object} tokens - { accessToken, refreshToken, expiresAt }
   * @returns {Promise<void>}
   */
  async saveSpotifyTokens(accountId, tokens) {
    throw new Error("Método no implementado: saveSpotifyTokens");
  }
}

module.exports = UserRepository;
