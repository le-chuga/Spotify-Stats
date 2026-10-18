/**
 * a11y.js
 * Comportamiento accesible común a todos los diálogos (.modal y el menú lateral):
 *  - al abrirse, el foco entra en el diálogo y el resto de la página queda inerte
 *    (no se puede tabular fuera ni leerla con un lector de pantalla);
 *  - al cerrarse, el foco vuelve al control que lo abrió;
 *  - Escape cierra el diálogo activo.
 * Observa el atributo "hidden", así que no hace falta tocar cada módulo.
 */

const DIALOG_SELECTOR = ".modal, .drawer";
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Botón que cierra cada diálogo con Escape (si no tiene su propio manejador)
const CLOSE_BUTTONS = [
  "#btn-cancel-playlist",
  "#btn-close-playlist-success",
  "#btn-close-share-modal",
  "#btn-close-share-apps",
  "#btn-close-panel",
  "#btn-account-close",
  "#btn-cancel-artist",
];

let opener = null;
let inertSet = [];

const openDialogs = () => [...document.querySelectorAll(DIALOG_SELECTOR)].filter((d) => !d.hidden);

function releasePage() {
  inertSet.forEach((node) => node.removeAttribute("inert"));
  inertSet = [];
}

function isolate(dialog) {
  releasePage();
  // El telón del menú lateral sigue activo para poder cerrarlo con un clic
  for (const child of document.body.children) {
    if (child === dialog || child.contains(dialog) || child.tagName === "SCRIPT" || child.classList.contains("scrim")) continue;
    if (!child.hasAttribute("inert")) {
      child.setAttribute("inert", "");
      inertSet.push(child);
    }
  }
}

function onOpen(dialog) {
  if (!opener || !document.body.contains(opener)) opener = document.activeElement;
  isolate(dialog);
  // Espera un frame: algunos diálogos se muestran con una transición
  requestAnimationFrame(() => {
    const inner = dialog.querySelector(".sheet") || dialog;
    const target = inner.querySelector("[autofocus]") || inner.querySelector(FOCUSABLE);
    if (target && !target.closest("[hidden]")) target.focus({ preventScroll: true });
    else {
      inner.setAttribute("tabindex", "-1");
      inner.focus({ preventScroll: true });
    }
  });
}

function onClose() {
  const still = openDialogs();
  if (still.length) {
    isolate(still[still.length - 1]);
    return;
  }
  releasePage();
  if (opener && document.body.contains(opener)) opener.focus({ preventScroll: true });
  opener = null;
}

const observer = new MutationObserver((records) => {
  for (const r of records) {
    const node = r.target;
    if (!(node instanceof Element) || !node.matches(DIALOG_SELECTOR)) continue;
    const wasHidden = r.oldValue !== null;
    if (wasHidden && !node.hidden) onOpen(node);
    else if (!wasHidden && node.hidden) onClose();
  }
});

function watch() {
  document.querySelectorAll(DIALOG_SELECTOR).forEach((d) => {
    observer.observe(d, { attributes: true, attributeFilter: ["hidden"], attributeOldValue: true });
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const dialogs = openDialogs();
  const top = dialogs[dialogs.length - 1];
  if (!top) return;
  for (const sel of CLOSE_BUTTONS) {
    const btn = top.querySelector(sel);
    if (btn && !btn.hidden) {
      btn.click();
      return;
    }
  }
});

// Enlace "Saltar al contenido": lleva el foco a la pantalla visible
document.getElementById("skip-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  const main = document.querySelector("main:not([hidden])");
  if (!main) return;
  main.setAttribute("tabindex", "-1");
  main.focus();
});

watch();
