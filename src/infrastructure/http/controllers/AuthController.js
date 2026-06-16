/**
 * Controlador HTTP: Autenticación.
 * Traduce peticiones/respuestas Express <-> casos de uso de aplicación.
 * No contiene lógica de negocio: solo valida la forma de la petición
 * y delega en los casos de uso.
 */
class AuthController {
  /**
   * @param {import('../../../application/usecases/RegisterUserUseCase')} registerUserUseCase
   * @param {import('../../../application/usecases/LoginUserUseCase')} loginUserUseCase
   */
  constructor(registerUserUseCase, loginUserUseCase) {
    this.registerUserUseCase = registerUserUseCase;
    this.loginUserUseCase = loginUserUseCase;
  }

  /** POST /api/auth/register */
  register = async (req, res) => {
    const { accountId, password } = req.body || {};
    const result = await this.registerUserUseCase.execute(accountId, password);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, message: "Cuenta creada correctamente. Ya puedes iniciar sesión." });
  };

  /** POST /api/auth/login */
  login = async (req, res) => {
    const { accountId, password } = req.body || {};
    const result = await this.loginUserUseCase.execute(accountId, password);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error,
        errorFields: result.errorFields || [],
      });
    }

    // Guardamos la sesión del usuario.
    req.session.accountId = result.user.accountId;

    return res.status(200).json({
      success: true,
      message: "Inicio de sesión correcto",
      hasSpotifyLinked: !!result.user.spotifyTokens,
    });
  };

  /** POST /api/auth/logout */
  logout = (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  };

  /** GET /api/auth/session */
  session = (req, res) => {
    if (req.session && req.session.accountId) {
      return res.json({ loggedIn: true, accountId: req.session.accountId });
    }
    return res.json({ loggedIn: false });
  };
}

module.exports = AuthController;
