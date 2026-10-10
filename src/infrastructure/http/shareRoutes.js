import { Hono } from "hono";
import { D1UserRepository } from "../repositories/D1UserRepository.js";
import { D1SnapshotRepository } from "../repositories/D1SnapshotRepository.js";
import { SpotifyClient } from "../spotify/SpotifyClient.js";
import { getSession } from "../session.js";

export const shareRoutes = new Hono();

// POST /api/share — crea snapshot y devuelve el ID
shareRoutes.post("/", async (c) => {
  const { data } = await getSession(c);
  if (!data.accountId) return c.json({ success: false, error: "No autenticado" }, 401);

  const repo = new D1UserRepository(c.env.DB);
  const user = await repo.findByAccountId(data.accountId);
  if (!user?.spotifyTokens) return c.json({ success: false, error: "No tienes Spotify vinculado" }, 400);

  let { accessToken, refreshToken, expiresAt } = user.spotifyTokens;
  const spotify = new SpotifyClient(c.env);

  if (!accessToken || Date.now() > Number(expiresAt) - 60000) {
    const refreshed = await spotify.refreshAccessToken(refreshToken);
    accessToken = refreshed.accessToken;
    await repo.saveSpotifyTokens(data.accountId, refreshed);
  }

  try {
    const stats = await spotify.fetchListeningStats(accessToken);
    const id = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const snapshotRepo = new D1SnapshotRepository(c.env.DB);
    await snapshotRepo.save(id, data.accountId, JSON.stringify(stats), user.avatarBase64 || null);
    return c.json({ success: true, id });
  } catch (err) {
    console.error("[Snapshot]", err.message);
    return c.json({ success: false, error: "No se pudo generar la snapshot" }, 400);
  }
});

// GET /api/share/:id — devuelve snapshot pública
shareRoutes.get("/:id", async (c) => {
  const snapshotRepo = new D1SnapshotRepository(c.env.DB);
  const snapshot = await snapshotRepo.findById(c.req.param("id"));
  if (!snapshot) return c.json({ success: false, error: "Enlace no encontrado o caducado" }, 404);
  return c.json({ success: true, snapshot });
});
