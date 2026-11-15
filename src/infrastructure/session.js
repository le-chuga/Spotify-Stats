/**
 * Sesiones usando Cloudflare KV.
 * La cookie contiene solo un identificador aleatorio de 256 bits; los datos viven en KV
 * con TTL de 24 horas. En HTTPS la cookie se llama __Host-sid: el navegador solo la acepta
 * con Secure, Path=/ y sin Domain, así que ningún subdominio puede plantarla.
 */

const SESSION_TTL = 60 * 60 * 24; // 24h en segundos

const isHttps = (c) => new URL(c.req.url).protocol === "https:";
const cookieName = (c) => (isHttps(c) ? "__Host-sid" : "sid");

function randomId() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getSession(c) {
  const cookie = c.req.header("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${cookieName(c)}=([a-f0-9]{64})(?:;|$)`));
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

/**
 * Inicio de sesión: borra la sesión anterior (si la había) y crea una con identificador nuevo.
 * Así un identificador conocido antes de entrar no sirve después (session fixation).
 */
export async function startSession(c, oldSessionId, data) {
  if (oldSessionId) await c.env.SESSIONS.delete(oldSessionId);
  return saveSession(c, null, data);
}

export async function destroySession(c, sessionId) {
  if (sessionId) await c.env.SESSIONS.delete(sessionId);
}

const attrs = (c, maxAge) => `HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${isHttps(c) ? "; Secure" : ""}`;

export function setSessionCookie(c, sessionId) {
  c.header("Set-Cookie", `${cookieName(c)}=${sessionId}; ${attrs(c, SESSION_TTL)}`);
}

export function clearSessionCookie(c) {
  c.header("Set-Cookie", `${cookieName(c)}=; ${attrs(c, 0)}`);
}
