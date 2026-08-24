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

  // Cargar stats y avatar en paralelo
  const [statsRes, avatarRes] = await Promise.all([
    api.spotifyStats(),
    api.getAvatar(),
  ]);

  ui.showScreen("stats");

  if (!statsRes.ok) {
    ui.showStatsError(statsRes.data.error || "No se pudieron cargar las estadísticas.");
  } else {
    ui.renderSpotifyStats(statsRes.data.stats);
    if (statsRes.data.stats?.topArtists?.length > 0) {
      ui.showPlaylistButton(statsRes.data.stats.topArtists);
    }
  }

  // Renderizar avatar (puede ser null si no tiene)
  if (avatarRes.ok) {
    ui.renderAvatar(avatarRes.data.avatarBase64);
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

/* ----------------------------------------------------------
   7) Avatar de perfil
   ---------------------------------------------------------- */
document.getElementById("avatar-wrapper").addEventListener("click", () => {
  document.getElementById("avatar-input").click();
});

document.getElementById("avatar-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    const base64 = evt.target.result;
    ui.renderAvatar(base64);
    const { ok, data } = await api.saveAvatar(base64);
    if (!ok) console.error("Error guardando avatar:", data?.error);
  };
  reader.readAsDataURL(file);
  e.target.value = "";
});

/* ----------------------------------------------------------
   8) Panel lateral
   ---------------------------------------------------------- */
function openPanel(panelId, overlayId) {
  const overlay = document.getElementById(overlayId);
  const panel = document.getElementById(panelId);
  overlay.hidden = false;
  panel.hidden = false;
  // Forzar reflow para que la transición arranque desde translateX(100%)
  panel.getBoundingClientRect();
  overlay.classList.add("overlay-open");
  panel.classList.add("panel-open");
}

function closePanel(panelId, overlayId) {
  const overlay = document.getElementById(overlayId);
  const panel = document.getElementById(panelId);
  overlay.classList.remove("overlay-open");
  panel.classList.remove("panel-open");
  // Esperar a que termine la animación (280ms) antes de ocultar
  setTimeout(() => {
    panel.hidden = true;
    overlay.hidden = true;
  }, 290);
}

document.getElementById("btn-menu").addEventListener("click", () => {
  openPanel("side-panel", "side-panel-overlay");
});

document.getElementById("btn-close-panel").addEventListener("click", () => {
  closePanel("side-panel", "side-panel-overlay");
});

document.getElementById("side-panel-overlay").addEventListener("click", () => {
  closePanel("side-panel", "side-panel-overlay");
});

/* ----------------------------------------------------------
   9) Subpanel: Compartir
   ---------------------------------------------------------- */
/* ----------------------------------------------------------
   9) Modal: Compartir
   ---------------------------------------------------------- */
async function openShareModal() {
  closePanel("side-panel", "side-panel-overlay");

  document.getElementById("share-loading-view").hidden = false;
  document.getElementById("share-ready-view").hidden = true;
  document.getElementById("share-error-view").hidden = true;
  document.getElementById("share-qr").innerHTML = "";
  document.getElementById("share-copy-feedback").textContent = "";
  document.getElementById("share-modal-overlay").hidden = false;

  // Obtener IP local del servidor para que el QR funcione en la misma red
  let baseUrl = location.origin;
  try {
    const infoRes = await fetch("/api/server-info");
    const info = await infoRes.json();
    const h = location.hostname;
    // Sustituir si estamos en local: localhost, 127.x, o IP privada (192.168.x, 10.x, 172.16-31.x)
    const isLocal = h === "localhost" || h === "127.0.0.1" ||
      /^192\.168\./.test(h) || /^10\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
    if (isLocal) {
      baseUrl = `http://${info.ip}:${info.port}`;
    }
  } catch { /* usar origin por defecto */ }

  const { ok, data } = await api.createShare();
  document.getElementById("share-loading-view").hidden = true;

  if (!ok) {
    document.getElementById("share-error-msg").textContent = data?.error || "No se pudo generar el enlace";
    document.getElementById("share-error-view").hidden = false;
    return;
  }

  const shareUrl = `${baseUrl}/share/${data.id}`;
  document.getElementById("share-link-input").value = shareUrl;

  new QRCode(document.getElementById("share-qr"), {
    text: shareUrl,
    width: 180,
    height: 180,
    colorDark: "#0B0D10",
    colorLight: "#ffffff",
  });

  document.getElementById("share-ready-view").hidden = false;
}

/* Animación para abrir/cerrar modales con scale+fade */
function animateModalIn(overlayId) {
  const overlay = document.getElementById(overlayId);
  overlay.hidden = false;
  // Forzar reflow para que la transición arranque desde el estado inicial
  overlay.getBoundingClientRect();
  overlay.classList.add("modal-visible");
}

function animateModalOut(overlayId, cb) {
  const overlay = document.getElementById(overlayId);
  overlay.classList.remove("modal-visible");
  setTimeout(() => {
    overlay.hidden = true;
    if (cb) cb();
  }, 260);
}

/* Botón Compartir dentro del modal QR → abre modal de apps */
document.getElementById("btn-open-share-apps").addEventListener("click", () => {
  const shareUrl = document.getElementById("share-link-input").value;
  const text = encodeURIComponent("Mira mis estadísticas de escucha en Frecuencia: " + shareUrl);
  const url = encodeURIComponent(shareUrl);

  document.getElementById("share-whatsapp").href = `https://wa.me/?text=${text}`;
  document.getElementById("share-telegram").href = `https://t.me/share/url?url=${url}&text=${encodeURIComponent("Mira mis estadísticas de escucha en Frecuencia")}`;
  document.getElementById("share-twitter").href = `https://twitter.com/intent/tweet?text=${text}`;

  // Nativo (Web Share API si está disponible)
  const nativeBtn = document.getElementById("share-native");
  nativeBtn.onclick = () => {
    if (navigator.share) {
      navigator.share({ title: "Frecuencia · Estadísticas", url: shareUrl });
    } else {
      navigator.clipboard.writeText(shareUrl);
      nativeBtn.querySelector("span").textContent = "¡Copiado!";
      setTimeout(() => nativeBtn.querySelector("span").textContent = "Más", 1500);
    }
  };

  // Cerrar modal QR con hidden, luego abrir modal de apps con animación
  document.getElementById("share-modal-overlay").hidden = true;
  animateModalIn("share-apps-overlay");
});

/* Volver: cerrar apps → abrir QR */
document.getElementById("btn-close-share-apps").addEventListener("click", () => {
  animateModalOut("share-apps-overlay", () => {
    document.getElementById("share-modal-overlay").hidden = false;
  });
});

/* Cerrar modal de apps al hacer click fuera */
document.getElementById("share-apps-overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    animateModalOut("share-apps-overlay", null);
  }
});

document.getElementById("btn-quizzes-panel").addEventListener("click", () => {
  closePanel("side-panel", "side-panel-overlay");
  setTimeout(() => { location.href = "/quiz"; }, 300);
});

document.getElementById("btn-share-panel").addEventListener("click", openShareModal);

document.getElementById("btn-close-share-modal").addEventListener("click", () => {
  document.getElementById("share-modal-overlay").hidden = true;
});

document.getElementById("share-modal-overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById("share-modal-overlay").hidden = true;
  }
});

document.getElementById("btn-copy-link").addEventListener("click", () => {
  const input = document.getElementById("share-link-input");
  navigator.clipboard.writeText(input.value).then(() => {
    document.getElementById("share-copy-feedback").textContent = "¡Enlace copiado!";
    setTimeout(() => {
      document.getElementById("share-copy-feedback").textContent = "";
    }, 2000);
  });
});

init().catch((err) => {
  console.error("Error al inicializar la app:", err);
});
