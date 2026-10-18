import { Hono } from "hono";
import { SpotifyClient } from "../spotify/SpotifyClient.js";
import { D1UserRepository } from "../repositories/D1UserRepository.js";
import { getSession } from "../session.js";
import { getFreshToken } from "./spotifyRoutes.js";

export const friendRoutes = new Hono();

const newCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function authed(c) {
  const { data } = await getSession(c);
  return data.accountId || null;
}

async function getOrCreateCode(db, accountId) {
  const row = await db.prepare("SELECT code FROM friend_invites WHERE account_id = ?").bind(accountId).first();
  if (row) return row.code;
  const code = newCode();
  await db.prepare("INSERT OR IGNORE INTO friend_invites (code, account_id) VALUES (?, ?)").bind(code, accountId).run();
  const again = await db.prepare("SELECT code FROM friend_invites WHERE account_id = ?").bind(accountId).first();
  return again.code;
}

const areFriends = async (db, a, b) =>
  Boolean(await db.prepare("SELECT 1 AS ok FROM friendships WHERE account_id = ? AND friend_id = ?").bind(a, b).first());

// GET /api/friends — mi código de invitación y mi lista de amigos
friendRoutes.get("/", async (c) => {
  const me = await authed(c);
  if (!me) return c.json({ success: false, error: "No autenticado" }, 401);
  const code = await getOrCreateCode(c.env.DB, me);
  const { results } = await c.env.DB.prepare(
    "SELECT friend_id FROM friendships WHERE account_id = ? ORDER BY created_at DESC"
  ).bind(me).all();
  return c.json({ success: true, code, friends: results.map((r) => ({ accountId: r.friend_id })) });
});

// POST /api/friends/invite/reset — invalida el enlace anterior y crea uno nuevo
friendRoutes.post("/invite/reset", async (c) => {
  const me = await authed(c);
  if (!me) return c.json({ success: false, error: "No autenticado" }, 401);
  await c.env.DB.prepare("DELETE FROM friend_invites WHERE account_id = ?").bind(me).run();
  return c.json({ success: true, code: await getOrCreateCode(c.env.DB, me) });
});

// POST /api/friends/join { code } — aceptar una invitación (la amistad es mutua)
friendRoutes.post("/join", async (c) => {
  const me = await authed(c);
  if (!me) return c.json({ success: false, error: "No autenticado" }, 401);
  const { code } = await c.req.json().catch(() => ({}));
  if (typeof code !== "string" || !/^[a-f0-9]{18}$/.test(code.trim().toLowerCase())) {
    return c.json({ success: false, error: "Ese enlace de invitación no es válido." }, 400);
  }
  const invite = await c.env.DB.prepare("SELECT account_id FROM friend_invites WHERE code = ?").bind(code.trim().toLowerCase()).first();
  if (!invite) return c.json({ success: false, error: "Ese enlace ya no existe o fue renovado." }, 404);
  const friend = invite.account_id;
  if (friend === me) return c.json({ success: false, error: "Ese es tu propio enlace. Envíaselo a un amigo." }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT OR IGNORE INTO friendships (account_id, friend_id) VALUES (?, ?)").bind(me, friend),
    c.env.DB.prepare("INSERT OR IGNORE INTO friendships (account_id, friend_id) VALUES (?, ?)").bind(friend, me),
  ]);
  return c.json({ success: true, friend: { accountId: friend } });
});

// DELETE /api/friends/:id — dejar de ser amigos (en ambos sentidos)
friendRoutes.delete("/:id", async (c) => {
  const me = await authed(c);
  if (!me) return c.json({ success: false, error: "No autenticado" }, 401);
  const other = c.req.param("id");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM friendships WHERE account_id = ? AND friend_id = ?").bind(me, other),
    c.env.DB.prepare("DELETE FROM friendships WHERE account_id = ? AND friend_id = ?").bind(other, me),
  ]);
  return c.json({ success: true });
});

// GET /api/friends/:id/stats — estadísticas en directo de un amigo
friendRoutes.get("/:id/stats", async (c) => {
  const me = await authed(c);
  if (!me) return c.json({ success: false, error: "No autenticado" }, 401);
  const friendId = c.req.param("id");
  if (!(await areFriends(c.env.DB, me, friendId))) {
    return c.json({ success: false, error: "No eres amigo de esa cuenta." }, 403);
  }
  const repo = new D1UserRepository(c.env.DB);
  const friend = await repo.findByAccountId(friendId);
  if (!friend) return c.json({ success: false, error: "Esa cuenta ya no existe." }, 404);
  if (!friend.spotifyTokens) {
    return c.json({ success: true, friend: { accountId: friendId, avatarBase64: friend.avatarBase64 }, linked: false });
  }
  const spotify = new SpotifyClient(c.env);
  try {
    const token = await getFreshToken(friend, repo, spotify, friendId);
    const [stats, nowPlaying] = await Promise.all([spotify.fetchListeningStats(token), spotify.fetchNowPlaying(token)]);
    // El email es privado: a los amigos solo se les enseña lo que ya es público en el perfil.
    const { email, ...profile } = stats.profile;
    return c.json({
      success: true,
      linked: true,
      friend: { accountId: friendId, avatarBase64: friend.avatarBase64 },
      stats: { ...stats, profile },
      nowPlaying,
      fetchedAt: Date.now(),
    });
  } catch {
    return c.json({ success: false, error: "No se pudieron leer las estadísticas de tu amigo." }, 400);
  }
});
