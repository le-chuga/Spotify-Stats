class SnapshotController {
  constructor(snapshotUseCase) {
    this.snapshotUseCase = snapshotUseCase;
  }

  /** POST /api/share -> crea snapshot y devuelve el ID */
  create = async (req, res) => {
    if (!req.session.accountId) {
      return res.status(401).json({ success: false, error: "No autenticado" });
    }
    const result = await this.snapshotUseCase.createSnapshot(req.session.accountId);
    if (!result.success) return res.status(400).json(result);
    return res.json({ success: true, id: result.id });
  };

  /** GET /api/share/:id -> devuelve los datos de una snapshot pública */
  get = async (req, res) => {
    const result = await this.snapshotUseCase.getSnapshot(req.params.id);
    if (!result.success) return res.status(404).json(result);
    return res.json({ success: true, snapshot: result.snapshot });
  };
}

module.exports = SnapshotController;
