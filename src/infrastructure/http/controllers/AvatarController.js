class AvatarController {
  constructor(avatarUseCase) {
    this.avatarUseCase = avatarUseCase;
  }

  /** GET /api/avatar -> devuelve el avatar del usuario en sesión */
  get = async (req, res) => {
    if (!req.session.accountId) {
      return res.status(401).json({ success: false, error: "No autenticado" });
    }
    const result = await this.avatarUseCase.getAvatar(req.session.accountId);
    return res.json(result);
  };

  /** POST /api/avatar -> guarda el avatar (base64) del usuario en sesión */
  save = async (req, res) => {
    if (!req.session.accountId) {
      return res.status(401).json({ success: false, error: "No autenticado" });
    }
    const { avatarBase64 } = req.body || {};
    const result = await this.avatarUseCase.saveAvatar(req.session.accountId, avatarBase64);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  };
}

module.exports = AvatarController;
