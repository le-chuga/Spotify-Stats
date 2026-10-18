import { Hono } from "hono";

export const deezerRoutes = new Hono();

// GET /api/deezer/artists?q=... — proxy para evitar CORS
deezerRoutes.get("/artists", async (c) => {
  const q = c.req.query("q");
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
