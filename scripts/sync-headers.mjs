// Genera public/_headers desde src/infrastructure/security/headers.js (única fuente de verdad).
// Uso: npm run sync:headers        escribe el archivo
//      npm run check:headers       solo comprueba; falla si está desactualizado
import { readFileSync, writeFileSync } from "node:fs";
import { renderHeadersFile } from "../src/infrastructure/security/headers.js";

const target = new URL("../public/_headers", import.meta.url);
const expected = renderHeadersFile();

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(target, "utf8"); } catch {}
  if (current !== expected) {
    console.error("public/_headers no coincide con src/infrastructure/security/headers.js. Ejecuta: npm run sync:headers");
    process.exit(1);
  }
  console.log("public/_headers está sincronizado.");
} else {
  writeFileSync(target, expected);
  console.log("public/_headers actualizado.");
}
