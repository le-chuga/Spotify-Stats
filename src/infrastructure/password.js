/**
 * Hash de contraseñas con PBKDF2 (Web Crypto nativo).
 * Sustituye a bcryptjs: al ser nativo no consume el límite de CPU
 * del plan gratuito de Workers. 100000 es el máximo de iteraciones
 * que permite Cloudflare.
 *
 * Formato guardado: pbkdf2$<iteraciones>$<salt_hex>$<hash_hex>
 */
const ITERATIONS = 100000;

const toHex = (buf) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex) =>
  new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, saltHex, hashHex] = (stored || "").split("$");
  if (scheme !== "pbkdf2") return false;
  const hash = await derive(password, fromHex(saltHex), Number(iterations));
  // Comparación en tiempo constante
  const a = toHex(hash);
  if (a.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}
