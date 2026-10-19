/**
 * dom.js
 * Utilidades pequeñas compartidas por los juegos.
 */

/** Crea un elemento. Los textos siempre se insertan como texto, nunca como HTML. */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === "class") el.className = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** Generador pseudoaleatorio con semilla (mulberry32): todos los jugadores reciben lo mismo. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 32);

/** Icono de línea (mismo estilo que el resto de iconos de la app). */
export function icon(paths) {
  const wrap = document.createElement("span");
  wrap.innerHTML =
    `<svg class="icon" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  return wrap.firstChild;
}

/** localStorage que nunca lanza (modo privado, datos bloqueados…). */
export const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* sin almacenamiento */ }
  },
};
