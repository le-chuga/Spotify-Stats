/**
 * format.js — Utilidades de formato compartidas por la app y la página pública.
 */

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "hace 3 horas", "ayer"… a partir de una fecha ISO. */
export function timeAgo(iso, now = Date.now()) {
  const diff = Math.round((new Date(iso).getTime() - now) / 1000);
  if (Number.isNaN(diff)) return "";
  const abs = Math.abs(diff);
  if (abs < 60) return "ahora mismo";
  for (const [unit, secs] of UNITS) {
    if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "";
}

/** "20 de agosto de 2026" */
export function longDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}
