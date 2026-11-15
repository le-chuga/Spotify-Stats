/**
 * Cifrado de los tokens de Spotify en reposo (AES-256-GCM).
 * Si alguien consigue leer la base de datos (copia, error de permisos, acceso al panel),
 * sin la clave los tokens no sirven. La clave vive en un secreto del Worker
 * (TOKEN_ENCRYPTION_KEY), nunca en la base de datos ni en el repositorio.
 *
 * Formato: enc1:<iv_base64>:<cifrado_base64>
 * El "contexto" (el Id de cuenta) va como dato autenticado: un valor cifrado copiado
 * a la fila de otra cuenta no se puede descifrar.
 */
const PREFIX = "enc1:";
const keyCache = new Map();

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

async function importKey(secret) {
  if (!keyCache.has(secret)) {
    const raw = unb64(secret);
    if (raw.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY debe ser una clave de 32 bytes en base64");
    keyCache.set(secret, crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]));
  }
  return keyCache.get(secret);
}

export const isEncrypted = (value) => typeof value === "string" && value.startsWith(PREFIX);

export async function encryptToken(plain, secret, context) {
  if (plain == null) return plain;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) },
    await importKey(secret),
    new TextEncoder().encode(plain)
  );
  return `${PREFIX}${b64(iv)}:${b64(cipher)}`;
}

/** Descifra. Un valor sin prefijo es un token antiguo guardado en claro y se devuelve tal cual. */
export async function decryptToken(stored, secret, context) {
  if (!isEncrypted(stored)) return stored;
  if (!secret) throw new Error("Falta TOKEN_ENCRYPTION_KEY para leer los tokens cifrados");
  const [ivPart, dataPart] = stored.slice(PREFIX.length).split(":");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivPart), additionalData: new TextEncoder().encode(context) },
    await importKey(secret),
    unb64(dataPart)
  );
  return new TextDecoder().decode(plain);
}
