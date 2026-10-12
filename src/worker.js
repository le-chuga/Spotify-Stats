/**
 * worker.js — Entry point de Cloudflare Workers
 * Hono + D1 + KV + Assets estáticos
 */

import { Hono } from "hono";
import { authRoutes } from "./infrastructure/http/routes/authRoutes.js";
import { spotifyRoutes } from "./infrastructure/http/routes/spotifyRoutes.js";
import { avatarRoutes } from "./infrastructure/http/routes/avatarRoutes.js";
import { shareRoutes } from "./infrastructure/http/routes/shareRoutes.js";
import { quizRoutes } from "./infrastructure/http/routes/quizRoutes.js";
import { deezerRoutes } from "./infrastructure/http/routes/deezerRoutes.js";

const app = new Hono();

// ── Rutas API ──────────────────────────────────────────
app.route("/api/auth", authRoutes);
app.route("/api/spotify", spotifyRoutes);
app.route("/api/avatar", avatarRoutes);
app.route("/api/share", shareRoutes);
app.route("/api/quiz", quizRoutes);
app.route("/api/deezer", deezerRoutes);

// ── server-info ────────────────────────────────────────
app.get("/api/server-info", (c) => {
  const url = new URL(c.req.url);
  return c.json({ ip: url.hostname, port: 443 });
});

// ── SPA: rutas especiales que sirven HTML ──────────────
app.get("/share/:id", async (c) => {
  const asset = await c.env.ASSETS.fetch(new Request(new URL("/share.html", c.req.url)));
  return asset;
});

app.get("/quiz", async (c) => {
  const asset = await c.env.ASSETS.fetch(new Request(new URL("/quiz.html", c.req.url)));
  return asset;
});

// ── Fallback: todo lo demás → index.html ───────────────
app.get("*", async (c) => {
  try {
    // Intentar servir el asset estático
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    if (asset.status !== 404) return asset;
  } catch {}
  // Si no existe como asset, servir index.html (SPA)
  const asset = await c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url)));
  return asset;
});

export default app;

