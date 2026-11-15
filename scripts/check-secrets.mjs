// Busca secretos en los archivos que Git rastrea (o solo en los preparados con --staged).
// Uso: npm run check:secrets   |   node scripts/check-secrets.mjs --staged  (lo usa el hook pre-commit)
// Para el historial completo usa gitleaks (ver SECURITY.md): este script mira solo el estado actual.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const staged = process.argv.includes("--staged");
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const files = (staged ? git("diff", "--cached", "--name-only", "--diff-filter=ACMR") : git("ls-files"))
  .split("\n").filter(Boolean);

// Archivos que nunca deben subirse, aunque estén vacíos
const FORBIDDEN_NAME = /(^|\/)(\.env(\.[^/]*)?|[^/]*\.env|\.dev\.vars(\.[^/]*)?|[^/]*\.pem|[^/]*\.key|[^/]*\.p12|id_rsa|id_ed25519)$/i;
const ALLOWED_NAME = /(^|\/)(\.env\.example|\.dev\.vars\.example)$/i;

const PATTERNS = [
  ["clave privada", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["token de GitHub", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["token de GitHub (fine-grained)", /\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ["token de API de Cloudflare", /\b(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[=:]\s*["']?[A-Za-z0-9_-]{35,}/],
  ["clave de AWS", /\bAKIA[0-9A-Z]{16}\b/],
  ["secreto de Spotify", /SPOTIFY_CLIENT_SECRET\s*[=:]\s*["']?[a-f0-9]{32}\b/i],
  ["secreto de sesión", /\b(?:SESSION_SECRET|TOKEN_ENCRYPTION_KEY|JWT_SECRET)\s*[=:]\s*["']?(?!tu_|your_|changeme|<)[A-Za-z0-9+/=_-]{16,}/],
  ["token de Slack", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
];

const problems = [];
for (const file of files) {
  if (FORBIDDEN_NAME.test(file) && !ALLOWED_NAME.test(file)) problems.push(`${file}: tipo de archivo que no debe subirse`);
  if (/\.(woff2?|png|jpe?g|gif|ico|webp|zip|gz)$/i.test(file) || file === "package-lock.json") continue;
  let text;
  try {
    text = staged ? git("show", `:${file}`) : readFileSync(file, "utf8");
  } catch { continue; }
  // se omite este propio archivo y los tests, que contienen los patrones como ejemplos
  if (file === "scripts/check-secrets.mjs" || file.startsWith("tests/")) continue;
  for (const [name, re] of PATTERNS) {
    const m = text.match(re);
    if (m) problems.push(`${file}: parece contener ${name} (${m[0].slice(0, 12)}…)`);
  }
}

if (problems.length) {
  console.error("\nPosibles secretos encontrados:\n");
  problems.forEach((p) => console.error("  - " + p));
  console.error("\nSi son reales: no los subas, rótalos en su servicio y guárdalos con `wrangler secret put`.\n");
  process.exit(1);
}
console.log(`Sin secretos en ${files.length} archivos.`);
