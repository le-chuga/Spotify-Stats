/**
 * Entidad de dominio: Usuario
 * No depende de ninguna capa externa (ni BD, ni framework web).
 */
class User {
  /**
   * @param {string} accountId - Identificador único de cuenta (login)
   * @param {string} passwordHash - Hash de la contraseña (nunca texto plano)
   * @param {object} spotifyTokens - { accessToken, refreshToken, expiresAt } o null
   */
  constructor(accountId, passwordHash, spotifyTokens = null) {
    if (!accountId || typeof accountId !== "string" || accountId.trim().length < 3) {
      throw new Error("El Id de cuenta debe tener al menos 3 caracteres");
    }
    if (!passwordHash) {
      throw new Error("La contraseña no puede estar vacía");
    }
    this.accountId = accountId.trim();
    this.passwordHash = passwordHash;
    this.spotifyTokens = spotifyTokens;
  }
}

module.exports = User;
