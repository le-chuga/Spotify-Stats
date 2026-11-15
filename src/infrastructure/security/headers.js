/**
 * Cabeceras de seguridad. Única fuente de verdad: public/_headers (archivos estáticos)
 * se genera desde aquí con `npm run sync:headers`, y `npm run check:security` falla si
 * se desincronizan.
 *
 * Imágenes y audio vienen de Spotify, Deezer y Apple (previews del quiz), por eso
 * img-src y media-src admiten https:. Las imágenes no ejecutan código.
 * style-src NO lleva 'unsafe-inline': no hay atributos style="" en el HTML.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https:",
  "media-src 'self' https:",
  "font-src 'self'",
  "connect-src 'self' https://itunes.apple.com",
  "frame-src 'none'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/** Devuelve una copia de la respuesta con las cabeceras de seguridad (las de ASSETS son inmutables). */
export function withSecurityHeaders(res, pathname) {
  const out = new Response(res.body, res);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) out.headers.set(name, value);
  // Las respuestas de la API llevan datos de sesión: que ningún caché las guarde
  if (pathname.startsWith("/api/")) out.headers.set("Cache-Control", "no-store");
  return out;
}

/** Contenido de public/_headers. */
export function renderHeadersFile() {
  const lines = Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`);
  return `/*\n${lines.join("\n")}\n`;
}
