export class D1SnapshotRepository {
  constructor(db) { this.db = db; }

  async save(id, accountId, statsJson, avatarBase64) {
    await this.db
      .prepare(`INSERT OR REPLACE INTO snapshots (id, account_id, stats_json, avatar_base64)
                VALUES (?, ?, ?, ?)`)
      .bind(id, accountId, statsJson, avatarBase64 || null)
      .run();
  }

  async findById(id) {
    const row = await this.db
      .prepare("SELECT * FROM snapshots WHERE id = ? LIMIT 1")
      .bind(id)
      .first();
    if (!row) return null;
    return {
      id: row.id,
      accountId: row.account_id,
      stats: stripEmail(JSON.parse(row.stats_json)), // snapshots antiguas pueden traer el email
      avatarBase64: row.avatar_base64 || null,
      createdAt: row.created_at,
    };
  }
}

function stripEmail(stats) {
  if (stats?.profile) delete stats.profile.email;
  return stats;
}
