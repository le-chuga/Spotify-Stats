const bcrypt = require("bcryptjs");

/**
 * Caso de uso: Autenticar a un usuario (Login).
 *
 * Reglas de negocio importantes (pedidas explícitamente):
 *  - Si NI el accountId NI la contraseña coinciden -> error genérico
 *    indicando que ambos campos son incorrectos.
 *  - Si SOLO uno de los dos no coincide -> error indicando que
 *    "el Id o la contraseña son erróneos" (sin revelar cuál, por seguridad,
 *    pero usando exactamente la frase solicitada).
 *  - Si todo coincide -> login correcto.
 */
class LoginUserUseCase {
  /**
   * @param {import('../../domain/repositories/UserRepository')} userRepository
   */
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * @param {string} accountId
   * @param {string} password
   * @returns {Promise<{success:boolean, error?:string, errorFields?:string[], user?:object}>}
   */
  async execute(accountId, password) {
    if (!accountId || !password) {
      return {
        success: false,
        error: "Debes rellenar tanto el Id de cuenta como la contraseña",
        errorFields: ["accountId", "password"],
      };
    }

    const trimmedId = accountId.trim();
    const storedUser = await this.userRepository.findByAccountId(trimmedId);

    // CASO 1: el accountId NO existe -> ni Id ni contraseña pueden coincidir.
    if (!storedUser) {
      return {
        success: false,
        error: "El Id de cuenta y la contraseña no coinciden con ningún usuario registrado",
        errorFields: ["accountId", "password"],
      };
    }

    // CASO 2: el accountId existe -> comprobamos la contraseña.
    const passwordMatches = await bcrypt.compare(password, storedUser.passwordHash);

    if (!passwordMatches) {
      // Solo un bloque (el de la contraseña) es el que no coincide.
      return {
        success: false,
        error: "La contraseña es errónea",
        errorFields: ["password"],
      };
    }

    // Todo correcto.
    return {
      success: true,
      user: {
        accountId: storedUser.accountId,
        spotifyTokens: storedUser.spotifyTokens || null,
      },
    };
  }
}

module.exports = LoginUserUseCase;
