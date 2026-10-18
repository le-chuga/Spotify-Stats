import { Hono } from "hono";
import { hashPassword, verifyPassword } from "../password.js";
import { D1UserRepository } from "../repositories/D1UserRepository.js";
import { getSession, saveSession, destroySession, setSessionCookie, clearSessionCookie } from "../session.js";

export const authRoutes = new Hono();

authRoutes.post("/register", async (c) => {
  const { accountId, password } = await c.req.json().catch(() => ({}));
  if (!accountId || !password) return c.json({ success: false, error: "Faltan campos" }, 400);
  const trimmed = accountId.trim();
  if (trimmed.length < 3) return c.json({ success: false, error: "Id debe tener al menos 3 caracteres" }, 400);
  if (password.length < 4) return c.json({ success: false, error: "Contraseña debe tener al menos 4 caracteres" }, 400);
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
