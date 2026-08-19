/**
 * Caso de uso: Gestionar el avatar de perfil del usuario.
 * El avatar se almacena como string base64 en la BD.
 */
class AvatarUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Guarda el avatar (base64) del usuario.
   * Valida que no supere 2MB para no saturar la BD.
   */
  async saveAvatar(accountId, avatarBase64) {
    if (!accountId) return { success: false, error: "No autenticado" };

    // Validar tamaño (~2MB en base64 ≈ 2.7M caracteres)
    if (avatarBase64 && avatarBase64.length > 2800000) {
      return { success: false, error: "La imagen es demasiado grande (máx 2MB)" };
    }

    await this.userRepository.saveAvatar(accountId, avatarBase64);
    return { success: true };
  }

  /**
   * Obtiene el avatar del usuario actual.
   */
  async getAvatar(accountId) {
    if (!accountId) return { success: false, error: "No autenticado" };
    const user = await this.userRepository.findByAccountId(accountId);
    return { success: true, avatarBase64: user?.avatarBase64 || null };
  }
}

module.exports = AvatarUseCase;
