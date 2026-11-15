import { encryptToken, decryptToken, isEncrypted } from "../security/tokenCrypto.js";

let warnedNoKey = false;

/** Crea el repositorio de usuarios con la clave de cifrado del entorno. */
export const userRepository = (c) => new D1UserRepository(c.env.DB, c.env.TOKEN_ENCRYPTION_KEY);

export class D1UserRepository {
  /**
   * @param db  binding de D1
   * @param tokenKey  secreto TOKEN_ENCRYPTION_KEY (base64, 32 bytes). Sin él los tokens
   *                  se guardan en claro, como antes: configúralo (ver SECURITY.md).
   */
  constructor(db, tokenKey) {
    this.db = db;
    this.tokenKey = tokenKey || null;
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
      spotifyTokens: await this.#readTokens(row),
    };
  }

  async #readTokens(row) {
    if (!row.spotify_access_token) return null;
    try {
      const tokens = {
        accessToken: await decryptToken(row.spotify_access_token, this.tokenKey, row.account_id),
        refreshToken: await decryptToken(row.spotify_refresh_token, this.tokenKey, row.account_id),
        expiresAt: row.spotify_expires_at,
      };
      // Tokens guardados en claro antes de activar el cifrado: se cifran en cuanto se leen
      if (this.tokenKey && (!isEncrypted(row.spotify_access_token) || !isEncrypted(row.spotify_refresh_token))) {
        await this.saveSpotifyTokens(row.account_id, tokens).catch((err) => console.error("[Tokens] migración", err?.message));
      }
      return tokens;
    } catch (err) {
      // Clave equivocada o dato manipulado: se trata como cuenta sin Spotify vinculado
      console.error("[Tokens] no se pudieron descifrar", err?.message);
      return null;
    }
  }

  async create(user) {
    await this.db
      .prepare("INSERT INTO users (account_id, password_hash) VALUES (?, ?)")
      .bind(user.accountId, user.passwordHash)
      .run();
  }

  async saveSpotifyTokens(accountId, tokens) {
    if (!this.tokenKey && !warnedNoKey) {
      warnedNoKey = true;
      console.warn("[Tokens] TOKEN_ENCRYPTION_KEY no está configurada: los tokens de Spotify se guardan sin cifrar");
    }
    const enc = (v) => (this.tokenKey ? encryptToken(v, this.tokenKey, accountId) : v);
    await this.db
      .prepare(
        `UPDATE users SET spotify_access_token=?, spotify_refresh_token=?, spotify_expires_at=?
         WHERE account_id=?`
      )
      .bind(await enc(tokens.accessToken), await enc(tokens.refreshToken), tokens.expiresAt, accountId)
      .run();
  }

  async saveAvatar(accountId, avatarBase64) {
    await this.db
      .prepare("UPDATE users SET avatar_base64=? WHERE account_id=?")
      .bind(avatarBase64, accountId)
      .run();
  }
}
