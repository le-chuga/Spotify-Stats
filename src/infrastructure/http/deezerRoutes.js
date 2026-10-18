import { Hono } from "hono";
import { getSession } from "../session.js";

export const deezerRoutes = new Hono();

// GET /api/deezer/artists?q=... — proxy para evitar CORS
deezerRoutes.get("/artists", async (c) => {
  const { data: session } = await getSession(c);
  if (!session.accountId) return c.json({ error: "No autenticado" }, 401);
  const q = (c.req.query("q") || "").trim().slice(0, 100);
  if (!q) return c.json({ error: "Falta q" }, 400);
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=8`
    );
    const data = await res.json();
    return c.json(data);
  } catch {
    return c.json({ data: [] });
  }
});
