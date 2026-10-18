// Comprueba los requisitos de salida a producción. Falla si queda algo pendiente.
// Uso: npm run check:launch   (también se ejecuta antes de "npm run deploy")
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const pub = new URL("../public/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const problems = [];

const htmlFiles = readdirSync(pub).filter((f) => f.endsWith(".html"));
for (const f of htmlFiles) {
  const text = readFileSync(join(pub, f), "utf8");
  const pending = text.match(/\[COMPLETAR:[^\]]*\]/g);
  if (pending) pending.forEach((p) => problems.push(`${f}: dato legal pendiente ${p}`));
  if (/<script[^>]+src="https?:\/\//i.test(text)) problems.push(`${f}: carga un script de un tercero`);
  if (/<link[^>]+href="https?:\/\/[^"]*"[^>]*rel="stylesheet"|<link[^>]+rel="stylesheet"[^>]+href="https?:\/\//i.test(text)) {
    problems.push(`${f}: carga una hoja de estilos de un tercero`);
  }
}

for (const required of ["privacidad.html", "cookies.html", "terminos.html", "favicon.svg"]) {
  if (!existsSync(join(pub, required))) problems.push(`Falta public/${required}`);
}

const warnings = [];
const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
if (/workers.dev/.test(toml)) {
  warnings.push("wrangler.toml: SPOTIFY_REDIRECT_URI sigue en workers.dev. Cuando conectes un dominio propio, actualízala aquí y en el panel de Spotify.");
}

if (problems.length) {
  console.error("\nNo se puede publicar todavía:\n");
  problems.forEach((p) => console.error("  - " + p));
  console.error("");
  process.exit(1);
}
warnings.forEach((w) => console.warn("Aviso: " + w));
console.log("Todo listo para publicar.");
