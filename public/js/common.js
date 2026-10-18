/**
 * common.js
 * Función "Canciones en común": el usuario pega 2 o más enlaces de playlists,
 * ve cuántas canciones comparten, elige un título y se crea la playlist nueva
 * en su cuenta de Spotify.
 *
 * Pasos del modal: 1) enlaces → 2) resultado y título → 3) playlist creada.
 * Todo el texto del usuario y de Spotify se pinta con textContent, nunca como HTML.
 */
import { api } from "./api.js";

const MIN_ROWS = 2;
const MAX_ROWS = 6;
const SPOTIFY_LINK_RE = /https?:\/\/open\.spotify\.com\/\S+|spotify:(?:user:[^:\s]+:)?playlist:[A-Za-z0-9]{22}/g;

const $ = (id) => document.getElementById(id);

const el = {
  overlay: $("common-modal-overlay"),
  formUrls: $("common-form-urls"),
  formResult: $("common-form-result"),
  viewSuccess: $("common-view-success"),
  rows: $("common-url-rows"),
  btnAdd: $("btn-common-add"),
  btnSearch: $("btn-common-search"),
  btnCancel: $("btn-common-cancel"),
  errorUrls: $("common-error-urls"),
  reconnectUrls: $("common-reconnect-urls"),
  count: $("common-count"),
  countLabel: $("common-count-label"),
  sources: $("common-sources"),
  preview: $("common-preview"),
  more: $("common-more"),
  titleInput: $("common-title-input"),
  errorResult: $("common-error-result"),
  reconnectResult: $("common-reconnect-result"),
  btnCreate: $("btn-common-create"),
  btnBack: $("btn-common-back"),
  successMsg: $("common-success-msg"),
  openSpotify: $("common-open-spotify"),
  btnDone: $("btn-common-done"),
};

/** Estado del flujo. Se descarta al cerrar el modal. */
let state = { uris: [], playlistCount: 0, busy: false };
let rowSeq = 0;

/* ----------------------------------------------------------
   Pasos y mensajes
   ---------------------------------------------------------- */
function showStep(step) {
  const views = { urls: el.formUrls, result: el.formResult, success: el.viewSuccess };
  Object.entries(views).forEach(([name, node]) => {
    const active = name === step;
    node.hidden = !active;
    // Reinicia la animación de entrada para que se vea también al volver atrás.
    node.classList.remove("view-enter");
    if (active) {
      void node.offsetWidth;
      node.classList.add("view-enter");
    }
  });
}

function showError(target, reconnect, message, needsReconnect = false) {
  target.textContent = message || "";
  target.classList.toggle("visible", Boolean(message));
  reconnect.hidden = !(message && needsReconnect);
  // En pantallas bajas la hoja hace scroll: el error no puede quedar fuera de vista.
  if (message) target.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function setBusy(busy, button, idleText, busyText) {
  state.busy = busy;
  button.disabled = busy;
  button.textContent = busy ? busyText : idleText;
  [el.btnCancel, el.btnBack, el.btnAdd].forEach((b) => (b.disabled = busy));
  el.rows.querySelectorAll("input, button").forEach((n) => (n.disabled = busy));
}

/* ----------------------------------------------------------
   Filas de enlaces
   ---------------------------------------------------------- */
function rowCount() {
  return el.rows.querySelectorAll(".url-row").length;
}

function refreshRows() {
  const rows = [...el.rows.querySelectorAll(".url-row")];
  rows.forEach((row, i) => {
    row.querySelector("label").textContent = `Playlist ${i + 1}`;
    const remove = row.querySelector(".url-row__remove");
    remove.hidden = rows.length <= MIN_ROWS;
    remove.setAttribute("aria-label", `Quitar la playlist ${i + 1}`);
  });
  el.btnAdd.hidden = rows.length >= MAX_ROWS;
}

function addRow(value = "", { animate = false } = {}) {
  if (rowCount() >= MAX_ROWS) return null;
  const n = ++rowSeq;

  const row = document.createElement("div");
  row.className = "url-row" + (animate ? " url-row--new" : "");

  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  label.htmlFor = `common-url-${n}`;

  const input = document.createElement("input");
  input.type = "text";
  input.id = `common-url-${n}`;
  input.value = value;
  input.inputMode = "url";
  input.autocomplete = "off";
  input.autocapitalize = "none";
  input.spellcheck = false;
  input.setAttribute("autocorrect", "off");
  input.setAttribute("enterkeyhint", "next");
  input.placeholder = "https://open.spotify.com/playlist/…";
  input.addEventListener("input", () => clearRowError(row));

  const error = document.createElement("p");
  error.className = "field-error";
  error.setAttribute("role", "alert");

  field.append(label, input, error);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "icon-btn url-row__remove";
  remove.innerHTML =
    '<svg class="icon" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>';
  remove.addEventListener("click", () => {
    if (rowCount() <= MIN_ROWS || state.busy) return;
    row.remove();
    refreshRows();
    el.btnAdd.focus({ preventScroll: true });
  });

  row.append(field, remove);
  el.rows.appendChild(row);
  refreshRows();
  return input;
}

function clearRowError(row) {
  row.querySelector("input").classList.remove("input--error");
  row.querySelector(".field-error").textContent = "";
}

function markRowError(index, message) {
  const row = el.rows.querySelectorAll(".url-row")[index];
  if (!row) return;
  row.querySelector("input").classList.add("input--error");
  row.querySelector(".field-error").textContent = message;
  row.querySelector("input").focus({ preventScroll: false });
}

function clearAllRowErrors() {
  el.rows.querySelectorAll(".url-row").forEach(clearRowError);
}

/** Si pegan varios enlaces de golpe en un campo, los reparte en filas. */
function onPaste(e) {
  const input = e.target.closest?.("input");
  if (!input || !el.rows.contains(input)) return;
  const text = e.clipboardData?.getData("text") || "";
  const links = text.match(SPOTIFY_LINK_RE) || [];
  if (links.length < 2) return;

  e.preventDefault();
  const inputs = [...el.rows.querySelectorAll("input")];
  const start = Math.max(0, inputs.indexOf(input));
  links.forEach((link, i) => {
    const target = inputs[start + i] || addRow("", { animate: true });
    if (target) {
      target.value = link;
      clearRowError(target.closest(".url-row"));
    }
  });
}

/* ----------------------------------------------------------
   Paso 1 → 2: buscar canciones en común
   ---------------------------------------------------------- */
async function search(e) {
  e.preventDefault();
  if (state.busy) return;
  showError(el.errorUrls, el.reconnectUrls, "");
  clearAllRowErrors();

  // Solo las filas con contenido; guardamos de qué fila viene cada enlace.
  const entries = [...el.rows.querySelectorAll("input")]
    .map((input, rowIndex) => ({ rowIndex, value: input.value.trim() }))
    .filter((x) => x.value);

  if (entries.length < MIN_ROWS) {
    showError(el.errorUrls, el.reconnectUrls, "Pega los enlaces de al menos 2 playlists.");
    return;
  }

  setBusy(true, el.btnSearch, "Buscar canciones en común", "Buscando…");
  try {
    const { ok, data } = await api.previewCommonTracks(entries.map((x) => x.value));
    if (!ok) {
      if (Number.isInteger(data.errorIndex) && entries[data.errorIndex]) {
        markRowError(entries[data.errorIndex].rowIndex, data.error);
      } else {
        showError(el.errorUrls, el.reconnectUrls, data.error || "No se pudieron leer las playlists.", data.reconnect);
      }
      return;
    }
    if (data.commonCount === 0) {
      showError(el.errorUrls, el.reconnectUrls, "Esas playlists no tienen ninguna canción en común.");
      return;
    }
    state = { ...state, uris: data.uris, playlistCount: data.playlists.length };
    renderResult(data);
    showStep("result");
    setTimeout(() => el.titleInput.focus({ preventScroll: true }), 60);
  } catch (err) {
    showError(el.errorUrls, el.reconnectUrls, "Error de red: " + err.message);
  } finally {
    setBusy(false, el.btnSearch, "Buscar canciones en común", "Buscando…");
  }
}

function renderResult(data) {
  el.count.textContent = String(data.commonCount);
  el.countLabel.textContent = data.commonCount === 1 ? "canción en común" : "canciones en común";

  el.sources.replaceChildren(
    ...data.playlists.map((p) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = p.name;
      const total = document.createElement("span");
      total.className = "common-sources__n";
      total.textContent = `${p.trackCount} ${p.trackCount === 1 ? "canción" : "canciones"}`;
      li.append(name, total);
      return li;
    })
  );

  el.preview.replaceChildren(
    ...data.preview.map((t) => {
      const li = document.createElement("li");
      const title = document.createElement("span");
      title.className = "common-tracks__title";
      title.textContent = t.name;
      const artist = document.createElement("span");
      artist.className = "common-tracks__artist";
      artist.textContent = t.artist;
      li.append(title, artist);
      return li;
    })
  );

  const rest = data.commonCount - data.preview.length;
  el.more.hidden = rest <= 0;
  el.more.textContent = rest > 0 ? `y ${rest} más` : "";

  el.titleInput.value = "";
  showError(el.errorResult, el.reconnectResult, "");
}

/* ----------------------------------------------------------
   Paso 2 → 3: título y creación
   ---------------------------------------------------------- */
async function create(e) {
  e.preventDefault();
  if (state.busy) return;
  const title = el.titleInput.value.trim();
  if (!title) {
    showError(el.errorResult, el.reconnectResult, "Escribe un título para la playlist.");
    el.titleInput.focus();
    return;
  }
  showError(el.errorResult, el.reconnectResult, "");

  setBusy(true, el.btnCreate, "Crear playlist", "Creando playlist…");
  try {
    const { ok, data } = await api.createCommonPlaylist(state.uris, title, state.playlistCount);
    if (!ok) {
      showError(el.errorResult, el.reconnectResult, data.error || "No se pudo crear la playlist.", data.reconnect);
      return;
    }
    const n = data.trackCount;
    el.successMsg.textContent = `Playlist «${data.playlistName}» creada con ${n} ${n === 1 ? "canción" : "canciones"}.`;
    el.openSpotify.href = data.playlistUrl;
    showStep("success");
  } catch (err) {
    showError(el.errorResult, el.reconnectResult, "Error de red: " + err.message);
  } finally {
    setBusy(false, el.btnCreate, "Crear playlist", "Creando playlist…");
  }
}

/* ----------------------------------------------------------
   Abrir y cerrar
   ---------------------------------------------------------- */
function reset() {
  state = { uris: [], playlistCount: 0, busy: false };
  el.rows.replaceChildren();
  for (let i = 0; i < MIN_ROWS; i++) addRow();
  showError(el.errorUrls, el.reconnectUrls, "");
  showError(el.errorResult, el.reconnectResult, "");
  el.titleInput.value = "";
}

export function openCommonModal() {
  reset();
  showStep("urls");
  el.overlay.hidden = false;
  setTimeout(() => el.rows.querySelector("input")?.focus({ preventScroll: true }), 100);
}

function closeCommonModal() {
  if (state.busy) return;
  el.overlay.hidden = true;
}

el.formUrls.addEventListener("submit", search);
el.formResult.addEventListener("submit", create);
el.btnAdd.addEventListener("click", () => addRow("", { animate: true })?.focus());
el.btnCancel.addEventListener("click", closeCommonModal);
el.btnDone.addEventListener("click", closeCommonModal);
el.btnBack.addEventListener("click", () => {
  if (state.busy) return;
  showStep("urls");
});
el.rows.addEventListener("paste", onPaste);

// Clic fuera: cierra, salvo en el paso del título para no perder el resultado sin querer.
el.overlay.addEventListener("click", (e) => {
  if (e.target === e.currentTarget && el.formResult.hidden) closeCommonModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !el.overlay.hidden) closeCommonModal();
});
