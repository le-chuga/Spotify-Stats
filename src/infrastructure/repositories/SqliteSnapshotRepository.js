const { getDatabase, persist } = require("../db/database");

class SqliteSnapshotRepository {
  async save(id, accountId, statsJson, avatarBase64) {
    const db = getDatabase();
    db.run(
      `INSERT OR REPLACE INTO snapshots (id, account_id, stats_json, avatar_base64)
       VALUES (:id, :accountId, :stats, :avatar)`,
      { ":id": id, ":accountId": accountId, ":stats": statsJson, ":avatar": avatarBase64 || null }
    );
    persist();
  }

  async findById(id) {
    const db = getDatabase();
    const stmt = db.prepare("SELECT * FROM snapshots WHERE id = :id LIMIT 1");
    stmt.bind({ ":id": id });
    let row = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    if (!row) return null;
    return {
      id: row.id,
      accountId: row.account_id,
      stats: JSON.parse(row.stats_json),
      avatarBase64: row.avatar_base64 || null,
      createdAt: row.created_at,
    };
  }
}

module.exports = SqliteSnapshotRepository;
