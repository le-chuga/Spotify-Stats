/**
 * Límite de intentos con ventana fija, guardado en D1 (el KV gratuito solo permite 1000
 * escrituras al día: un atacante lo agotaría y nadie más podría iniciar sesión).
 * El upsert es atómico: dos peticiones simultáneas no se saltan el contador.
 */
const ready = new WeakMap(); // una promesa por conexión de base de datos

function ensureTable(db) {
  if (!ready.has(db)) {
    const p = db
      .prepare("CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL)")
      .run()
      .catch((err) => {
        ready.delete(db);
        throw err;
      });
    ready.set(db, p);
  }
  return ready.get(db);
}

/** Cuenta un intento. Devuelve si sigue permitido y cuántos segundos faltan para el reinicio. */
export async function hit(db, key, { limit, windowMs }, now = Date.now()) {
  await ensureTable(db);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN reset_at <= ?3 THEN 1 ELSE count + 1 END,
         reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END
       RETURNING count, reset_at`
    )
    .bind(key, now + windowMs, now)
    .first();
  if (Math.random() < 0.01) {
    // limpieza ocasional de ventanas caducadas
    await db.prepare("DELETE FROM rate_limits WHERE reset_at <= ?").bind(now).run().catch(() => {});
  }
  return { allowed: row.count <= limit, count: row.count, retryAfter: Math.max(1, Math.ceil((row.reset_at - now) / 1000)) };
}

/** Mira el contador sin sumar. */
export async function peek(db, key, { limit }, now = Date.now()) {
  await ensureTable(db);
  const row = await db.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").bind(key).first();
  if (!row || row.reset_at <= now) return { allowed: true, count: 0, retryAfter: 0 };
  return { allowed: row.count < limit, count: row.count, retryAfter: Math.max(1, Math.ceil((row.reset_at - now) / 1000)) };
}

export async function reset(db, key) {
  await ensureTable(db);
  await db.prepare("DELETE FROM rate_limits WHERE key = ?").bind(key).run();
}

export function clientIp(c) {
  // CF-Connecting-IP lo pone Cloudflare y el cliente no puede falsificarlo
  return c.req.header("CF-Connecting-IP") || "local";
}

export function tooManyRequests(c, retryAfter, what = "intentos") {
  const mins = Math.ceil(retryAfter / 60);
  c.header("Retry-After", String(retryAfter));
  return c.json(
    { success: false, error: `Demasiados ${what}. Inténtalo de nuevo en ${mins <= 1 ? "un minuto" : mins + " minutos"}.` },
    429
  );
}

/** Cuenta un intento y devuelve la respuesta 429 si se superó el límite (o null si pasa). */
export async function enforce(c, key, rule, what) {
  const r = await hit(c.env.DB, key, rule);
  return r.allowed ? null : tooManyRequests(c, r.retryAfter, what);
}

export const RULES = {
  loginPerIp: { limit: 40, windowMs: 15 * 60_000 },
  loginPerIpAndAccount: { limit: 6, windowMs: 15 * 60_000 },
  loginPerAccount: { limit: 25, windowMs: 15 * 60_000 },
  registerPerIp: { limit: 5, windowMs: 60 * 60_000 },
  deletePerAccount: { limit: 5, windowMs: 15 * 60_000 },
  friendJoin: { limit: 20, windowMs: 10 * 60_000 },
  shareCreate: { limit: 20, windowMs: 60 * 60_000 },
  quizResult: { limit: 60, windowMs: 60 * 60_000 },
  playlistWrite: { limit: 20, windowMs: 10 * 60_000 },
};
