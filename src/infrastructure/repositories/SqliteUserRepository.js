const UserRepository = require("../../domain/repositories/UserRepository");
const { getDatabase, persist } = require("../db/database");

/**
 * Implementación concreta del repositorio de usuarios usando sql.js (SQLite/WASM).
 * Esta es la única capa que "sabe" que estamos usando SQLite: si en el futuro
 * se cambia a otra BD, solo hay que reescribir esta clase manteniendo el contrato.
 */
class SqliteUserRepository extends UserRepository {
  async findByAccountId(accountId) {
    const db = getDatabase();
    const stmt = db.prepare("SELECT * FROM users WHERE account_id = :id LIMIT 1");
    stmt.bind({ ":id": accountId });

    let row = null;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();

    if (!row) return null;

    return {
      accountId: row.account_id,
      passwordHash: row.password_hash,
      avatarBase64: row.avatar_base64 || null,
      spotifyTokens: row.spotify_access_token
        ? {
            accessToken: row.spotify_access_token,
            refreshToken: row.spotify_refresh_token,
            expiresAt: row.spotify_expires_at,
          }
        : null,
    };
  }

  async create(user) {
    const db = getDatabase();
    db.run(
      "INSERT INTO users (account_id, password_hash) VALUES (:id, :pass)",
      { ":id": user.accountId, ":pass": user.passwordHash }
    );
    persist();
  }

  async saveAvatar(accountId, avatarBase64) {
    const db = getDatabase();
    db.run(
      "UPDATE users SET avatar_base64 = :avatar WHERE account_id = :id",
      { ":avatar": avatarBase64, ":id": accountId }
    );
    persist();
  }

  async saveSpotifyTokens(accountId, tokens) {
    const db = getDatabase();
    db.run(
      `UPDATE users
       SET spotify_access_token = :at,
           spotify_refresh_token = :rt,
           spotify_expires_at = :exp
       WHERE account_id = :id`,
      {
        ":at": tokens.accessToken,
        ":rt": tokens.refreshToken,
        ":exp": tokens.expiresAt,
        ":id": accountId,
      }
    );
    persist();
  }
}

module.exports = SqliteUserRepository;
