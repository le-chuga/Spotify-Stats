/**
 * Controlador HTTP: Spotify.
 * Gestiona el flujo OAuth (redirección + callback) y el endpoint
 * de estadísticas. Delega toda la lógica en los casos de uso.
 */
class SpotifyController {
  /**
   * @param {import('../../spotify/SpotifyClient')} spotifyClient
   * @param {import('../../../application/usecases/LinkSpotifyAccountUseCase')} linkSpotifyAccountUseCase
   * @param {import('../../../application/usecases/GetSpotifyStatsUseCase')} getSpotifyStatsUseCase
   * @param {import('../../../application/usecases/CreatePlaylistFromArtistsUseCase')} createPlaylistFromArtistsUseCase
   */
  constructor(spotifyClient, linkSpotifyAccountUseCase, getSpotifyStatsUseCase, createPlaylistFromArtistsUseCase) {
    this.spotifyClient = spotifyClient;
    this.linkSpotifyAccountUseCase = linkSpotifyAccountUseCase;
    this.getSpotifyStatsUseCase = getSpotifyStatsUseCase;
    this.createPlaylistFromArtistsUseCase = createPlaylistFromArtistsUseCase;
  }

  /** GET /api/spotify/login -> redirige a Spotify para pedir credenciales */
  redirectToSpotify = (req, res) => {
    if (!req.session.accountId) {
      return res.status(401).json({ success: false, error: "Debes iniciar sesión primero" });
    }
    const url = this.spotifyClient.buildAuthorizeUrl(req.session.accountId);
    res.redirect(url);
  };

  /** GET /api/spotify/callback -> Spotify redirige aquí tras el login */
  callback = async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect("/?spotify_error=" + encodeURIComponent(error));
    }

    const accountId = state || req.session.accountId;
    const result = await this.linkSpotifyAccountUseCase.execute(accountId, code);

    if (!result.success) {
      return res.redirect("/?spotify_error=" + encodeURIComponent(result.error));
    }

    // Volvemos a la app; el frontend mostrará la pantalla de "Cargando..."
    // y luego pedirá /api/spotify/stats
    res.redirect("/?spotify_linked=1");
  };

  /** GET /api/spotify/stats -> devuelve estadísticas reales del usuario */
  stats = async (req, res) => {
    if (!req.session.accountId) {
      return res.status(401).json({ success: false, error: "Debes iniciar sesión primero" });
    }

    const result = await this.getSpotifyStatsUseCase.execute(req.session.accountId);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({ success: true, stats: result.stats });
  };

  /** POST /api/spotify/playlist -> crea playlist a partir de artistas seleccionados */
  createPlaylist = async (req, res) => {
    if (!req.session.accountId) {
      return res.status(401).json({ success: false, error: "Debes iniciar sesión primero" });
    }

    const { artistNames, playlistTitle } = req.body || {};

    if (!Array.isArray(artistNames) || artistNames.length === 0) {
      return res.status(400).json({ success: false, error: "Debes seleccionar al menos un artista" });
    }

    const result = await this.createPlaylistFromArtistsUseCase.execute(
      req.session.accountId,
      artistNames,
      playlistTitle
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      playlistName: result.playlistName,
      trackCount: result.trackCount,
    });
  };
}

module.exports = SpotifyController;
