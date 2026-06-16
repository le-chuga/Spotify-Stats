const express = require("express");

/**
 * @param {import('../controllers/SpotifyController')} spotifyController
 */
function spotifyRoutes(spotifyController) {
  const router = express.Router();

  router.get("/login", spotifyController.redirectToSpotify);
  router.get("/callback", spotifyController.callback);
  router.get("/stats", spotifyController.stats);
  router.post("/playlist", spotifyController.createPlaylist);

  return router;
}

module.exports = spotifyRoutes;
