import { Hono } from "hono";
import { D1UserRepository } from "../../repositories/D1UserRepository.js";
import { getSession } from "../../session.js";

export const avatarRoutes = new Hono();

avatarRoutes.get("/", async (c) => {
  const { data } = await getSession(c);
  if (!data.accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  const repo = new D1UserRepository(c.env.DB);
  const user = await repo.findByAccountId(data.accountId);
  return c.json({ success: true, avatarBase64: user?.avatarBase64 || null });
});

avatarRoutes.post("/", async (c) => {
  const { data } = await getSession(c);
  if (!data.accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  const { avatarBase64 } = await c.req.json().catch(() => ({}));
  if (avatarBase64 && avatarBase64.length > 2800000) return c.json({ success: false, error: "Imagen demasiado grande (máx 2MB)" }, 400);
  const repo = new D1UserRepository(c.env.DB);
  await repo.saveAvatar(data.accountId, avatarBase64);
  return c.json({ success: true });
});
