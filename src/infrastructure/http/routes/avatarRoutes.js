const express = require("express");

function avatarRoutes(avatarController) {
  const router = express.Router();
  router.get("/", avatarController.get);
  router.post("/", avatarController.save);
  return router;
}

module.exports = avatarRoutes;
