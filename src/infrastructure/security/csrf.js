/**
 * Defensa CSRF para la API: una petición que cambia datos (POST/PUT/PATCH/DELETE) solo se
 * acepta si viene de esta misma web. Los navegadores envían Origin en esas peticiones y
 * Sec-Fetch-Site siempre; ninguna página de otro sitio puede falsificarlos.
 * Es una segunda capa sobre la cookie SameSite=Lax.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function sameOriginOnly() {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    const expected = new URL(c.req.url).origin;
    const origin = c.req.header("Origin");
    const site = c.req.header("Sec-Fetch-Site");
    const foreign = origin ? origin !== expected : site ? site !== "same-origin" && site !== "none" : false;
    if (foreign) return c.json({ success: false, error: "Petición no permitida desde otro sitio." }, 403);
    return next();
  };
}
