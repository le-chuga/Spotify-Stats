const express = require("express");

/**
 * @param {import('../controllers/AuthController')} authController
 */
function authRoutes(authController) {
  const router = express.Router();

  router.post("/register", authController.register);
  router.post("/login", authController.login);
  router.post("/logout", authController.logout);
  router.get("/session", authController.session);

  return router;
}

module.exports = authRoutes;
