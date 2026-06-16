/**
 * ui.js
 * Capa de presentación del frontend: todo lo que toca el DOM vive aquí.
 * app.js orquesta el flujo y llama a estas funciones; estas funciones
 * no conocen la API ni la lógica de negocio.
 */

const screens = {
  auth: document.getElementById("screen-auth"),
  connect: document.getElementById("screen-connect"),
  loading: document.getElementById("screen-loading"),
  stats: document.getElementById("screen-stats"),
};

/**
 * Muestra una pantalla y oculta el resto.
 * @param {'auth'|'connect'|'loading'|'stats'} name
 */
export function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
  // La pantalla de stats puede necesitar más altura que el viewport:
  // activamos scroll de página solo para ella.
  document.body.classList.toggle("screen-stats-active", name === "stats");
}

/* ----------------------------------------------------------
   Formularios de autenticación
   ---------------------------------------------------------- */

const els = {
  formLogin: document.getElementById("form-login"),
  formRegister: document.getElementById("form-register"),

  loginId: document.getElementById("login-id"),
  loginPassword: document.getElementById("login-password"),
  errorLoginId: document.getElementById("error-login-id"),
  errorLoginPassword: document.getElementById("error-login-password"),
  formErrorLogin: document.getElementById("form-error-login"),
  formSuccessLogin: document.getElementById("form-success-login"),

  registerId: document.getElementById("register-id"),
  registerPassword: document.getElementById("register-password"),
  errorRegisterId: document.getElementById("error-register-id"),
  errorRegisterPassword: document.getElementById("error-register-password"),
  formErrorRegister: document.getElementById("form-error-register"),
  formSuccessRegister: document.getElementById("form-success-register"),

  btnShowRegister: document.getElementById("btn-show-register"),
  btnBackToLogin: document.getElementById("btn-back-to-login"),

  spotifyLinkError: document.getElementById("spotify-link-error"),
};

/** Limpia todos los mensajes de error/éxito de ambos formularios */
export function clearAuthMessages() {
  [
    els.errorLoginId,
    els.errorLoginPassword,
    els.errorRegisterId,
    els.errorRegisterPassword,
  ].forEach((el) => (el.textContent = ""));

  [els.formErrorLogin, els.formErrorRegister].forEach((el) => {
    el.textContent = "";
    el.classList.remove("visible");
  });

  [els.formSuccessLogin, els.formSuccessRegister].forEach((el) => {
    el.textContent = "";
    el.classList.remove("visible");
  });

  [els.loginId, els.loginPassword, els.registerId, els.registerPassword].forEach((el) =>
    el.classList.remove("input--error")
  );
}

/**
 * Muestra los errores de login devueltos por el backend.
 * - Si errorFields incluye 'accountId' y 'password' -> ambos bloques marcados,
 *   mensaje general indicando que ninguno coincide.
 * - Si solo incluye 'password' -> solo ese bloque marcado, "contraseña errónea".
 * - Si solo incluye 'accountId' -> solo ese bloque marcado, "Id erróneo".
 */
export function showLoginError(message, errorFields = []) {
  els.formErrorLogin.textContent = message;
  els.formErrorLogin.classList.add("visible");

  if (errorFields.includes("accountId")) {
    els.loginId.classList.add("input--error");
    els.errorLoginId.textContent = errorFields.length > 1 ? "Id incorrecto" : "Este Id es erróneo";
  }
  if (errorFields.includes("password")) {
    els.loginPassword.classList.add("input--error");
    els.errorLoginPassword.textContent =
      errorFields.length > 1 ? "Contraseña incorrecta" : "Esta contraseña es errónea";
  }
}

export function showLoginSuccess(message) {
  els.formSuccessLogin.textContent = message;
  els.formSuccessLogin.classList.add("visible");
}

export function showRegisterError(message) {
  els.formErrorRegister.textContent = message;
  els.formErrorRegister.classList.add("visible");

  if (message.toLowerCase().includes("id de cuenta ya existe")) {
    els.registerId.classList.add("input--error");
  }
}

export function showRegisterSuccess(message) {
  els.formSuccessRegister.textContent = message;
  els.formSuccessRegister.classList.add("visible");
}

/** Cambia entre el formulario de login y el de registro */
export function toggleRegisterForm(showRegister) {
  clearAuthMessages();
  els.formLogin.classList.toggle("auth-form--hidden", showRegister);
  els.formRegister.classList.toggle("auth-form--hidden", !showRegister);
}

export function getLoginValues() {
  return { accountId: els.loginId.value, password: els.loginPassword.value };
}

export function getRegisterValues() {
  return { accountId: els.registerId.value, password: els.registerPassword.value };
}

export function resetRegisterForm() {
  els.registerId.value = "";
  els.registerPassword.value = "";
}

export function showSpotifyLinkError(message) {
  els.spotifyLinkError.textContent = message;
}

/* ----------------------------------------------------------
   Pantalla de estadísticas
   ---------------------------------------------------------- */

const statsEls = {
  error: document.getElementById("stats-error"),
  profileSection: document.getElementById("profile-summary"),
  avatar: document.getElementById("profile-avatar"),
  name: document.getElementById("profile-name"),
  meta: document.getElementById("profile-meta"),
  topTracks: document.getElementById("list-top-tracks"),
  topArtists: document.getElementById("list-top-artists"),
  recent: document.getElementById("list-recent"),
};

export function showStatsError(message) {
  statsEls.error.textContent = message;
  statsEls.error.hidden = false;
}

function renderList(container, items, mapFn) {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.className = "stats-empty";
    li.textContent = "No hay datos disponibles todavía.";
    container.appendChild(li);
    return;
  }
  items.forEach((item) => container.appendChild(mapFn(item)));
}

function buildListItem({ imageUrl, title, subtitle }) {
  const li = document.createElement("li");

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "";
    li.appendChild(img);
  }

  const textWrap = document.createElement("div");
  textWrap.className = "item-text";

  const titleEl = document.createElement("p");
  titleEl.className = "item-title";
  titleEl.textContent = title;

  const subtitleEl = document.createElement("p");
  subtitleEl.className = "item-subtitle";
  subtitleEl.textContent = subtitle;

  textWrap.append(titleEl, subtitleEl);
  li.appendChild(textWrap);
  return li;
}

/**
 * Renderiza las estadísticas reales de Spotify en la pantalla de stats.
 * @param {object} stats - tal y como lo devuelve GetSpotifyStatsUseCase
 */
export function renderSpotifyStats(stats) {
  statsEls.error.hidden = true;

  if (stats.profile) {
    statsEls.profileSection.hidden = false;
    statsEls.avatar.src = stats.profile.avatarUrl || "";
    statsEls.name.textContent = stats.profile.displayName || "Tu perfil de Spotify";
    statsEls.meta.textContent = `${stats.profile.followers} seguidores`;
  }

  renderList(statsEls.topTracks, stats.topTracks, (t) =>
    buildListItem({ imageUrl: t.imageUrl, title: t.name, subtitle: t.artist })
  );

  renderList(statsEls.topArtists, stats.topArtists, (a) =>
    buildListItem({
      imageUrl: a.imageUrl,
      title: a.name,
      subtitle: a.genres?.slice(0, 2).join(", ") || "Sin géneros listados",
    })
  );

  renderList(statsEls.recent, stats.recentlyPlayed, (r) =>
    buildListItem({
      imageUrl: r.imageUrl,
      title: r.name,
      subtitle: `${r.artist} · ${new Date(r.playedAt).toLocaleString("es-ES")}`,
    })
  );
}

const modalEls = {
  overlay: document.getElementById("playlist-modal-overlay"),
  artistList: document.getElementById("artist-select-list"),
  titleInput: document.getElementById("playlist-title-input"),
  btnOpen: document.getElementById("btn-open-playlist-modal"),
  btnConfirm: document.getElementById("btn-confirm-playlist"),
  btnCancel: document.getElementById("btn-cancel-playlist"),
  btnCloseSuccess: document.getElementById("btn-close-playlist-success"),
  error: document.getElementById("playlist-modal-error"),
  success: document.getElementById("playlist-modal-success"),
  viewSelect: document.getElementById("modal-view-select"),
  viewSuccess: document.getElementById("modal-view-success"),
};

export function showPlaylistButton(artists) {
  modalEls.btnOpen.hidden = false;
  modalEls.btnOpen._artists = artists;
}

export function openPlaylistModal() {
  const artists = modalEls.btnOpen._artists || [];
  modalEls.artistList.innerHTML = "";
  modalEls.error.textContent = "";
  modalEls.error.classList.remove("visible");
  modalEls.titleInput.value = "";
  modalEls.viewSelect.hidden = false;
  modalEls.viewSuccess.hidden = true;

  artists.forEach((artist) => {
    const li = document.createElement("li");
    const label = document.createElement("label");
    label.className = "artist-select-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = artist.name;

    const img = document.createElement("img");
    img.src = artist.imageUrl || "";
    img.alt = "";

    const name = document.createElement("span");
    name.textContent = artist.name;

    label.append(checkbox, img, name);
    li.appendChild(label);
    modalEls.artistList.appendChild(li);
  });

  modalEls.overlay.hidden = false;
  setTimeout(() => modalEls.titleInput.focus(), 100);
}

export function closePlaylistModal() {
  modalEls.overlay.hidden = true;
}

export function getSelectedArtists() {
  return [...modalEls.artistList.querySelectorAll("input[type='checkbox']:checked")]
    .map((cb) => cb.value);
}

export function getPlaylistTitle() {
  return modalEls.titleInput.value.trim();
}

export function showPlaylistModalError(message) {
  modalEls.error.textContent = message;
  modalEls.error.classList.add("visible");
}

export function showPlaylistModalSuccess(message) {
  modalEls.viewSelect.hidden = true;
  modalEls.viewSuccess.hidden = false;
  modalEls.success.textContent = message;
}

export function resetPlaylistModal() {
  modalEls.btnConfirm.disabled = false;
  modalEls.btnConfirm.textContent = "Crear playlist";
  modalEls.viewSelect.hidden = false;
  modalEls.viewSuccess.hidden = true;
}

export const modal = modalEls;
export const elements = els;

