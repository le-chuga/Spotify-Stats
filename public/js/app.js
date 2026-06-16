/**
 * app.js
 * Orquestador de la aplicación frontend (capa "controlador").
 * Coordina ui.js (presentación) y api.js (datos), sin mezclar
 * lógica de DOM con lógica de peticiones.
 */
import { api } from "./api.js";
import * as ui from "./ui.js";

/* ----------------------------------------------------------
   1) Comprobar al cargar si ya hay sesión / Spotify vinculado
   ---------------------------------------------------------- */
async function init() {
  // Si Spotify acaba de redirigir aquí tras vincular la cuenta...
  const params = new URLSearchParams(window.location.search);
  if (params.get("spotify_error")) {
    ui.showSpotifyLinkError("No se pudo vincular Spotify: " + params.get("spotify_error"));
  }

  const { data } = await api.session();

  if (!data.loggedIn) {
    ui.showScreen("auth");
    return;
  }

  if (params.get("spotify_linked")) {
    // Acaba de volver del callback de Spotify -> cargar stats directamente.
    window.history.replaceState({}, "", window.location.pathname);
    await loadStats();
    return;
  }

  // Sesión activa pero sin venir del callback: mostrar pantalla de conexión.
  ui.showScreen("connect");
}

/* ----------------------------------------------------------
   2) Login
   ---------------------------------------------------------- */
ui.elements.formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  ui.clearAuthMessages();

  const { accountId, password } = ui.getLoginValues();

  if (!accountId.trim() || !password) {
    const fields = [];
    if (!accountId.trim()) fields.push("accountId");
    if (!password) fields.push("password");
    ui.showLoginError("Debes rellenar tanto el Id de cuenta como la contraseña", fields);
    return;
  }

  const submitBtn = ui.elements.formLogin.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Entrando…";

  try {
    const { ok, data } = await api.login(accountId, password);

    if (!ok) {
      ui.showLoginError(data.error || "No se pudo iniciar sesión", data.errorFields || []);
      return;
    }

    ui.showLoginSuccess("¡Bienvenido! Redirigiendo…");

    setTimeout(() => {
      if (data.hasSpotifyLinked) {
        loadStats();
      } else {
        ui.showScreen("connect");
      }
    }, 600);
  } catch (err) {
    console.error("Error en login:", err);
    ui.showLoginError(
      "No se pudo conectar con el servidor (" + err.message + "). Revisa que npm start siga corriendo.",
      []
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar";
  }
});

/* ----------------------------------------------------------
   3) Registro
   ---------------------------------------------------------- */
ui.elements.btnShowRegister.addEventListener("click", () => ui.toggleRegisterForm(true));
ui.elements.btnBackToLogin.addEventListener("click", () => ui.toggleRegisterForm(false));

ui.elements.formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  ui.clearAuthMessages();

  const { accountId, password } = ui.getRegisterValues();
  const { ok, data } = await api.register(accountId, password);

  if (!ok) {
    ui.showRegisterError(data.error || "No se pudo crear la cuenta");
    return;
  }

  ui.showRegisterSuccess(data.message || "Cuenta creada correctamente");
  ui.resetRegisterForm();

  setTimeout(() => ui.toggleRegisterForm(false), 1200);
});

/* ----------------------------------------------------------
   4) Conectar Spotify / continuar sin conectar / logout
   ---------------------------------------------------------- */
document.getElementById("btn-skip-connect").addEventListener("click", () => {
  loadStats();
});

document.getElementById("btn-logout-connect").addEventListener("click", doLogout);
document.getElementById("btn-logout-stats").addEventListener("click", doLogout);

async function doLogout() {
  await api.logout();
  window.location.reload();
}

/* ----------------------------------------------------------
   5) Cargar estadísticas (con pantalla "Cargando…")
   ---------------------------------------------------------- */
async function loadStats() {
  ui.showScreen("loading");

  const { ok, data } = await api.spotifyStats();

  if (!ok) {
    ui.showScreen("stats");
    ui.showStatsError(data.error || "No se pudieron cargar las estadísticas.");
    return;
  }

  ui.showScreen("stats");
  ui.renderSpotifyStats(data.stats);

  // Mostrar botón "Crear playlist de..." si hay artistas disponibles
  if (data.stats?.topArtists?.length > 0) {
    ui.showPlaylistButton(data.stats.topArtists);
  }
}

/* ----------------------------------------------------------
   6) Modal de crear playlist
   ---------------------------------------------------------- */
document.getElementById("btn-open-playlist-modal").addEventListener("click", () => {
  ui.resetPlaylistModal();
  ui.openPlaylistModal();
});

document.getElementById("btn-cancel-playlist").addEventListener("click", () => {
  ui.closePlaylistModal();
});

document.getElementById("btn-close-playlist-success").addEventListener("click", () => {
  ui.closePlaylistModal();
});

// Cerrar modal al hacer click fuera de la tarjeta (solo en vista de selección)
document.getElementById("playlist-modal-overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) ui.closePlaylistModal();
});

document.getElementById("btn-confirm-playlist").addEventListener("click", async () => {
  const selectedArtists = ui.getSelectedArtists();
  const playlistTitle = ui.getPlaylistTitle();

  if (selectedArtists.length === 0) {
    ui.showPlaylistModalError("Selecciona al menos un artista");
    return;
  }

  if (!playlistTitle) {
    ui.showPlaylistModalError("Escribe un título para la playlist");
    return;
  }

  const btn = document.getElementById("btn-confirm-playlist");
  btn.disabled = true;
  btn.textContent = "Creando playlist…";

  try {
    const { ok, data } = await api.createPlaylist(selectedArtists, playlistTitle);

    if (!ok) {
      ui.showPlaylistModalError(data.error || "No se pudo crear la playlist");
      btn.disabled = false;
      btn.textContent = "Crear playlist";
      return;
    }

    ui.showPlaylistModalSuccess(
      `Playlist "${data.playlistName}" creada con ${data.trackCount} canciones 🎵`
    );
  } catch (err) {
    ui.showPlaylistModalError("Error de red: " + err.message);
    btn.disabled = false;
    btn.textContent = "Crear playlist";
  }
});

init().catch((err) => {
  console.error("Error al inicializar la app:", err);
});
