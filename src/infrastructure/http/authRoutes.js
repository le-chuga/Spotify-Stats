import { Hono } from "hono";
import { hashPassword, verifyPassword } from "../password.js";
import { D1UserRepository } from "../repositories/D1UserRepository.js";
import { getSession, saveSession, destroySession, setSessionCookie, clearSessionCookie } from "../session.js";

export const authRoutes = new Hono();

authRoutes.post("/register", async (c) => {
  const { accountId, password, acceptTerms } = await c.req.json().catch(() => ({}));
  if (typeof accountId !== "string" || typeof password !== "string" || !accountId || !password) {
    return c.json({ success: false, error: "Faltan campos" }, 400);
  }
  if (acceptTerms !== true) {
    return c.json({ success: false, error: "Debes aceptar los términos y la política de privacidad para crear la cuenta.", errorFields: ["acceptTerms"] }, 400);
  }
  const trimmed = accountId.trim();
  if (trimmed.length < 3) return c.json({ success: false, error: "El Id debe tener al menos 3 caracteres" }, 400);
  if (trimmed.length > 32) return c.json({ success: false, error: "El Id no puede tener más de 32 caracteres" }, 400);
  if (password.length < 8) return c.json({ success: false, error: "La contraseña debe tener al menos 8 caracteres" }, 400);
  if (password.length > 200) return c.json({ success: false, error: "La contraseña es demasiado larga" }, 400);
  const repo = new D1UserRepository(c.env.DB);
  const existing = await repo.findByAccountId(trimmed);
  if (existing) return c.json({ success: false, error: "Esa Id de cuenta ya existe. Elige otra." }, 400);
  const passwordHash = await hashPassword(password);
  await repo.create({ accountId: trimmed, passwordHash });
  return c.json({ success: true, message: "Cuenta creada correctamente. Ya puedes iniciar sesión." }, 201);
});

authRoutes.post("/login", async (c) => {
  const { accountId, password } = await c.req.json().catch(() => ({}));
  if (!accountId || !password) return c.json({ success: false, error: "Debes rellenar ambos campos", errorFields: ["accountId", "password"] }, 401);
  const repo = new D1UserRepository(c.env.DB);
  const user = await repo.findByAccountId(accountId.trim());
  if (!user) return c.json({ success: false, error: "El Id de cuenta y la contraseña no coinciden con ningún usuario registrado", errorFields: ["accountId", "password"] }, 401);
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return c.json({ success: false, error: "La contraseña es errónea", errorFields: ["password"] }, 401);
  const { id: oldId } = await getSession(c);
  const sessionId = await saveSession(c, oldId, { accountId: user.accountId });
  setSessionCookie(c, sessionId);
  return c.json({ success: true, message: "Inicio de sesión correcto", hasSpotifyLinked: !!user.spotifyTokens });
});

authRoutes.post("/logout", async (c) => {
  const { id } = await getSession(c);
  await destroySession(c, id);
  clearSessionCookie(c);
  return c.json({ success: true });
});

authRoutes.get("/session", async (c) => {
  const { data } = await getSession(c);
  if (!data.accountId) return c.json({ loggedIn: false });
  const repo = new D1UserRepository(c.env.DB);
  const user = await repo.findByAccountId(data.accountId);
  return c.json({ loggedIn: true, accountId: data.accountId, hasSpotifyLinked: !!(user?.spotifyTokens) });
});

// GET /api/auth/export — descarga de todos los datos personales de la cuenta (portabilidad, art. 20 RGPD)
authRoutes.get("/export", async (c) => {
  const { data } = await getSession(c);
  if (!data.accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  const db = c.env.DB;
  const id = data.accountId;
  const repo = new D1UserRepository(db);
  const user = await repo.findByAccountId(id);
  const safeAll = async (sql, ...binds) => {
    try {
      return (await db.prepare(sql).bind(...binds).all()).results;
    } catch {
      return []; // tabla que aún no existe: no hay datos
    }
  };
  const snapshots = (await safeAll("SELECT id, stats_json, created_at FROM snapshots WHERE account_id = ?", id)).map((r) => {
    const stats = JSON.parse(r.stats_json);
    if (stats?.profile) delete stats.profile.email;
    return { id: r.id, createdAt: r.created_at, stats };
  });
  const body = {
    exportedAt: new Date().toISOString(),
    account: { accountId: id, hasAvatar: Boolean(user?.avatarBase64), spotifyLinked: Boolean(user?.spotifyTokens) },
    avatarBase64: user?.avatarBase64 || null,
    quizResults: await safeAll("SELECT artist_name, time_ms, correct_answers, created_at FROM quiz_leaderboard WHERE account_id = ?", id),
    sharedSnapshots: snapshots,
    friends: (await safeAll("SELECT friend_id, created_at FROM friendships WHERE account_id = ?", id)),
  };
  c.header("Content-Disposition", 'attachment; filename="frecuencia-mis-datos.json"');
  return c.json(body);
});

// POST /api/auth/delete — borra la cuenta y todos sus datos (supresión, art. 17 RGPD)
authRoutes.post("/delete", async (c) => {
  const { id: sessionId, data } = await getSession(c);
  if (!data.accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  const { password } = await c.req.json().catch(() => ({}));
  const repo = new D1UserRepository(c.env.DB);
  const user = await repo.findByAccountId(data.accountId);
  if (!user || typeof password !== "string" || !(await verifyPassword(password, user.passwordHash))) {
    return c.json({ success: false, error: "La contraseña no es correcta." }, 403);
  }
  const db = c.env.DB;
  const id = data.accountId;
  const statements = [
    db.prepare("DELETE FROM snapshots WHERE account_id = ?").bind(id),
    db.prepare("DELETE FROM quiz_leaderboard WHERE account_id = ?").bind(id),
    db.prepare("DELETE FROM users WHERE account_id = ?").bind(id),
  ];
  await db.batch(statements);
  // Estas tablas se crean bajo demanda: si no existen, no hay nada que borrar
  for (const [sql, ...binds] of [
    ["DELETE FROM friendships WHERE account_id = ? OR friend_id = ?", id, id],
    ["DELETE FROM friend_invites WHERE account_id = ?", id],
  ]) {
    try { await db.prepare(sql).bind(...binds).run(); } catch {}
  }
  await destroySession(c, sessionId);
  clearSessionCookie(c);
  return c.json({ success: true });
});
