const bcrypt = require("bcryptjs");

/**
 * Caso de uso: Registrar una nueva cuenta de usuario.
 * Reglas de negocio:
 *  - El accountId no puede existir ya en el repositorio.
 *  - La contraseña se almacena siempre como hash (bcrypt), nunca en claro.
 */
class RegisterUserUseCase {
  /**
   * @param {import('../../domain/repositories/UserRepository')} userRepository
   */
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * @param {string} accountId
   * @param {string} password
   * @returns {Promise<{success:boolean, error?:string}>}
   */
  async execute(accountId, password) {
    if (!accountId || !password) {
      return { success: false, error: "Debes introducir Id de cuenta y contraseña" };
    }

    const trimmedId = accountId.trim();

    if (trimmedId.length < 3) {
      return { success: false, error: "El Id de cuenta debe tener al menos 3 caracteres" };
    }

    if (password.length < 4) {
      return { success: false, error: "La contraseña debe tener al menos 4 caracteres" };
    }

    const existing = await this.userRepository.findByAccountId(trimmedId);
    if (existing) {
      return { success: false, error: "Esa Id de cuenta ya existe. Elige otra." };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await this.userRepository.create({ accountId: trimmedId, passwordHash });

    return { success: true };
  }
}

module.exports = RegisterUserUseCase;
