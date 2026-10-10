/**
 * Sesiones usando Cloudflare KV.
 * Reemplaza express-session: la cookie contiene el sessionId,
 * y el valor se guarda en KV con TTL de 24 horas.
 */

const SESSION_TTL = 60 * 60 * 24; // 24h en segundos

function randomId() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function getSession(c) {
  const cookie = c.req.header("Cookie") || "";
  const match = cookie.match(/sid=([a-f0-9]{32})/);
  if (!match) return { id: null, data: {} };
  const id = match[1];
  const raw = await c.env.SESSIONS.get(id);
  if (!raw) return { id: null, data: {} };
  try {
    return { id, data: JSON.parse(raw) };
  } catch {
    return { id: null, data: {} };
  }
}

export async function saveSession(c, sessionId, data) {
  const id = sessionId || randomId();
  await c.env.SESSIONS.put(id, JSON.stringify(data), { expirationTtl: SESSION_TTL });
  return id;
}

export async function destroySession(c, sessionId) {
  if (sessionId) await c.env.SESSIONS.delete(sessionId);
}

export function setSessionCookie(c, sessionId) {
  c.header("Set-Cookie", `sid=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`);
}

export function clearSessionCookie(c) {
  c.header("Set-Cookie", "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}
