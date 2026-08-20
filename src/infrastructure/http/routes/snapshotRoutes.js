const express = require("express");

function snapshotRoutes(snapshotController) {
  const router = express.Router();
  router.post("/", snapshotController.create);
  router.get("/:id", snapshotController.get);
  return router;
}

module.exports = snapshotRoutes;
