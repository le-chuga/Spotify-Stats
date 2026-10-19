/**
 * worker.js — Entry point de Cloudflare Workers
 * Hono + D1 + KV + Assets estáticos
 */

import { Hono } from "hono";
import { authRoutes } from "./infrastructure/http/authRoutes.js";
import { spotifyRoutes } from "./infrastructure/http/spotifyRoutes.js";
import { avatarRoutes } from "./infrastructure/http/avatarRoutes.js";
import { shareRoutes } from "./infrastructure/http/shareRoutes.js";
import { quizRoutes } from "./infrastructure/http/quizRoutes.js";
import { friendRoutes } from "./infrastructure/http/friendRoutes.js";
import { deezerRoutes } from "./infrastructure/http/deezerRoutes.js";

const app = new Hono();

// Cabeceras de seguridad. Las imágenes y el audio vienen de Spotify, Deezer y Apple (previews del quiz).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "media-src 'self' https:",
  "font-src 'self'",
  "connect-src 'self' https://itunes.apple.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

app.use("*", async (c, next) => {
  await next();
  const res = new Response(c.res.body, c.res); // las respuestas de ASSETS tienen cabeceras inmutables
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  c.res = res;
});

// ── Rutas API ──────────────────────────────────────────
app.route("/api/auth", authRoutes);
app.route("/api/spotify", spotifyRoutes);
app.route("/api/avatar", avatarRoutes);
app.route("/api/share", shareRoutes);
app.route("/api/quiz", quizRoutes);
app.route("/api/deezer", deezerRoutes);
app.route("/api/friends", friendRoutes);

// ── server-info ────────────────────────────────────────
app.get("/api/server-info", (c) => {
  const url = new URL(c.req.url);
  return c.json({ ip: url.hostname, port: 443 });
});

app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 301));

// ── SPA: rutas especiales que sirven HTML ──────────────
app.get("/share/:id", async (c) => {
  const asset = await c.env.ASSETS.fetch(new Request(new URL("/share.html", c.req.url)));
  return asset;
});

app.get("/quiz", async (c) => {
  const asset = await c.env.ASSETS.fetch(new Request(new URL("/quiz.html", c.req.url)));
  return asset;
});

app.get("/games", async (c) => {
  const asset = await c.env.ASSETS.fetch(new Request(new URL("/games.html", c.req.url)));
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
