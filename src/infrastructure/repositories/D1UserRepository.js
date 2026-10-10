export class D1UserRepository {
  constructor(db) {
    this.db = db;
  }

  async findByAccountId(accountId) {
    const row = await this.db
      .prepare("SELECT * FROM users WHERE account_id = ? LIMIT 1")
      .bind(accountId)
      .first();
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
    await this.db
      .prepare("INSERT INTO users (account_id, password_hash) VALUES (?, ?)")
      .bind(user.accountId, user.passwordHash)
      .run();
  }

  async saveSpotifyTokens(accountId, tokens) {
    await this.db
      .prepare(
        `UPDATE users SET spotify_access_token=?, spotify_refresh_token=?, spotify_expires_at=?
         WHERE account_id=?`
      )
      .bind(tokens.accessToken, tokens.refreshToken, tokens.expiresAt, accountId)
      .run();
  }

  async saveAvatar(accountId, avatarBase64) {
    await this.db
      .prepare("UPDATE users SET avatar_base64=? WHERE account_id=?")
      .bind(avatarBase64, accountId)
      .run();
  }
}
