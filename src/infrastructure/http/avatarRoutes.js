import { Hono } from "hono";
import { userRepository } from "../repositories/D1UserRepository.js";
import { getSession } from "../session.js";

export const avatarRoutes = new Hono();

avatarRoutes.get("/", async (c) => {
  const { data } = await getSession(c);
  if (!data.accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  const repo = userRepository(c);
  const user = await repo.findByAccountId(data.accountId);
  return c.json({ success: true, avatarBase64: user?.avatarBase64 || null });
});

avatarRoutes.post("/", async (c) => {
  const { data } = await getSession(c);
  if (!data.accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  const { avatarBase64 } = await c.req.json().catch(() => ({}));
  if (avatarBase64 != null && typeof avatarBase64 !== "string") return c.json({ success: false, error: "Formato de imagen no válido" }, 400);
  if (avatarBase64 && avatarBase64.length > 2800000) return c.json({ success: false, error: "Imagen demasiado grande (máx 2MB)" }, 400);
  // Solo PNG, JPEG, WebP o GIF en data URL con base64 válido. SVG queda fuera: puede llevar scripts.
  if (avatarBase64 && !/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(avatarBase64)) {
    return c.json({ success: false, error: "Formato de imagen no válido" }, 400);
  }
  const repo = userRepository(c);
  await repo.saveAvatar(data.accountId, avatarBase64);
  return c.json({ success: true });
});
