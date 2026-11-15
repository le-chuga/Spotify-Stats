import { Hono } from "hono";
import { hashPassword, verifyPassword } from "../password.js";
import { userRepository } from "../repositories/D1UserRepository.js";
import { getSession, startSession, destroySession, setSessionCookie, clearSessionCookie } from "../session.js";
import { hit, peek, reset, clientIp, enforce, tooManyRequests, RULES } from "../security/rateLimit.js";
import { COMMON_PASSWORDS } from "../security/commonPasswords.js";

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
  // Sin caracteres de control ni invisibles (evita Ids que parecen otro o rompen la interfaz)
  if (/[\p{C}\p{Zl}\p{Zp}]/u.test(trimmed)) return c.json({ success: false, error: "El Id contiene caracteres no permitidos" }, 400);
  if (password.length < 8) return c.json({ success: false, error: "La contraseña debe tener al menos 8 caracteres" }, 400);
  if (password.length > 200) return c.json({ success: false, error: "La contraseña es demasiado larga" }, 400);
  if (COMMON_PASSWORDS.has(password.toLowerCase()) || password.toLowerCase() === trimmed.toLowerCase()) {
    return c.json({ success: false, error: "Esa contraseña es demasiado fácil de adivinar. Elige otra." }, 400);
  }
  const limited = await enforce(c, `register:${clientIp(c)}`, RULES.registerPerIp, "registros");
  if (limited) return limited;
  const repo = userRepository(c);
  const existing = await repo.findByAccountId(trimmed);
  if (existing) return c.json({ success: false, error: "Esa Id de cuenta ya existe. Elige otra." }, 400);
  const passwordHash = await hashPassword(password);
  try {
    await repo.create({ accountId: trimmed, passwordHash });
  } catch {
    // dos registros simultáneos con el mismo Id: gana uno (UNIQUE en la base de datos)
    return c.json({ success: false, error: "Esa Id de cuenta ya existe. Elige otra." }, 400);
  }
  return c.json({ success: true, message: "Cuenta creada correctamente. Ya puedes iniciar sesión." }, 201);
});

// Hash de relleno: si el Id no existe se verifica igualmente, para que tardar menos
// no delate qué Ids están registrados.
let dummyHash = null;

const LOGIN_FAILED = "El Id de cuenta o la contraseña no son correctos";

authRoutes.post("/login", async (c) => {
  const { accountId, password } = await c.req.json().catch(() => ({}));
  if (typeof accountId !== "string" || typeof password !== "string" || !accountId || !password) {
    return c.json({ success: false, error: "Debes rellenar ambos campos", errorFields: ["accountId", "password"] }, 401);
  }
  if (accountId.length > 64 || password.length > 200) {
    return c.json({ success: false, error: LOGIN_FAILED, errorFields: ["accountId", "password"] }, 401);
  }
  const id = accountId.trim();
  const ip = clientIp(c);
  const keys = {
    ip: `login:ip:${ip}`,
    pair: `login:pair:${ip}:${id.toLowerCase()}`,
    account: `login:acct:${id.toLowerCase()}`,
  };

  // Tope general por IP y bloqueo si ya hubo demasiados fallos para esta cuenta
  const total = await hit(c.env.DB, keys.ip, RULES.loginPerIp);
  if (!total.allowed) return tooManyRequests(c, total.retryAfter);
  for (const [key, rule] of [[keys.pair, RULES.loginPerIpAndAccount], [keys.account, RULES.loginPerAccount]]) {
    const state = await peek(c.env.DB, key, rule);
    if (!state.allowed) return tooManyRequests(c, state.retryAfter);
  }

  const repo = userRepository(c);
  const user = await repo.findByAccountId(id);
  dummyHash ??= await hashPassword("contraseña-de-relleno");
  const ok = await verifyPassword(password, user ? user.passwordHash : dummyHash);
  if (!user || !ok) {
    await hit(c.env.DB, keys.pair, RULES.loginPerIpAndAccount);
    await hit(c.env.DB, keys.account, RULES.loginPerAccount);
    return c.json({ success: false, error: LOGIN_FAILED, errorFields: ["accountId", "password"] }, 401);
  }

  await reset(c.env.DB, keys.pair);
  const { id: oldId } = await getSession(c);
  const sessionId = await startSession(c, oldId, { accountId: user.accountId });
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
  const repo = userRepository(c);
  const user = await repo.findByAccountId(data.accountId);
  return c.json({ loggedIn: true, accountId: data.accountId, hasSpotifyLinked: !!(user?.spotifyTokens) });
});

// GET /api/auth/export — descarga de todos los datos personales de la cuenta (portabilidad, art. 20 RGPD)
authRoutes.get("/export", async (c) => {
  const { data } = await getSession(c);
  if (!data.accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  const db = c.env.DB;
  const id = data.accountId;
  const repo = userRepository(c);
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
  const limited = await enforce(c, `delete:${data.accountId}`, RULES.deletePerAccount);
  if (limited) return limited;
  const repo = userRepository(c);
  const user = await repo.findByAccountId(data.accountId);
  if (!user || typeof password !== "string" || password.length > 200 || !(await verifyPassword(password, user.passwordHash))) {
    return c.json({ success: false, error: "La contraseña no es correcta." }, 403);
  }
  await reset(c.env.DB, `delete:${data.accountId}`);
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
