/* ============================================================
   FRECUENCIA — sistema de diseño
   Paleta:
     --bg        #0B0D10  (casi negro, base)
     --surface   #15181D  (tarjetas)
     --line      #272B31  (bordes sutiles)
     --ink       #F4F6F2  (texto principal, blanco roto)
     --muted     #8B939E  (texto secundario)
     --accent    #C8FF4D  (verde lima eléctrico — señal/onda)
     --accent-2  #FF5C8A  (magenta — error / contraste)
   Tipografía:
     Display: "Space Grotesk" (geométrica, con carácter)
     Mono/datos: "JetBrains Mono" (para Ids, números, ecualizador)
   ============================================================ */

@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --bg: #0B0D10;
  --surface: #15181D;
  --surface-2: #1B1F25;
  --line: #272B31;
  --ink: #F4F6F2;
  --muted: #8B939E;
  --accent: #C8FF4D;
  --accent-2: #FF5C8A;

  --font-display: "Space Grotesk", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;

  --radius: 14px;
  --radius-sm: 8px;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-display);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

html { height: 100%; }
body { height: 100vh; }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ----------------------------------------------------------
   Fondo decorativo: ecualizador ambiental
   ---------------------------------------------------------- */
.eq-background {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 4px;
  padding: 0 4px;
  z-index: 0;
  opacity: 0.18;
  pointer-events: none;
}

.eq-bar {
  flex: 1;
  background: linear-gradient(to top, var(--accent), transparent);
  border-radius: 4px 4px 0 0;
  animation: eq-pulse 2.4s ease-in-out infinite;
}

.eq-bar:nth-child(odd) { animation-duration: 1.8s; }
.eq-bar:nth-child(3n) { animation-duration: 2.6s; background: linear-gradient(to top, var(--accent-2), transparent); }
.eq-bar:nth-child(2) { animation-delay: -0.4s; }
.eq-bar:nth-child(4) { animation-delay: -1.1s; }
.eq-bar:nth-child(5) { animation-delay: -0.6s; }
.eq-bar:nth-child(7) { animation-delay: -1.7s; }
.eq-bar:nth-child(8) { animation-delay: -0.3s; }
.eq-bar:nth-child(10) { animation-delay: -1.2s; }
.eq-bar:nth-child(11) { animation-delay: -0.8s; }
.eq-bar:nth-child(13) { animation-delay: -1.9s; }
.eq-bar:nth-child(14) { animation-delay: -0.2s; }
.eq-bar:nth-child(16) { animation-delay: -1.4s; }
.eq-bar:nth-child(17) { animation-delay: -0.9s; }
.eq-bar:nth-child(19) { animation-delay: -1.6s; }

@keyframes eq-pulse {
  0%, 100% { height: 6%; }
  50% { height: 85%; }
}

@media (prefers-reduced-motion: reduce) {
  .eq-bar { animation: none; height: 30%; }
}

/* ----------------------------------------------------------
   Layout general de pantallas
   ---------------------------------------------------------- */
.screen {
  position: relative;
  z-index: 1;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
}

/* Cuando la pantalla activa es stats, el body puede hacer scroll */
body.screen-stats-active {
  overflow-y: auto;
}

body.screen-stats-active .screen--stats {
  height: auto;
  min-height: 100vh;
  overflow-y: visible;
}

/* [hidden] debe ganar siempre sobre .screen (misma especificidad,
   pero .screen se declara despues en este archivo y pisaria
   [hidden] sin esta regla explicita). Sin esto, las 4 pantallas
   quedan visibles y apiladas, aunque su atributo `hidden` cambie. */
.screen[hidden] {
  display: none;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 10px;
}

/* ----------------------------------------------------------
   Tarjetas comunes
   ---------------------------------------------------------- */
.auth-card,
.connect-card,
.loading-card {
  width: 100%;
  max-width: 420px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 36px;
  box-shadow: 0 24px 60px -24px rgba(0,0,0,0.7);
}

.auth-title {
  font-size: 2.4rem;
  font-weight: 700;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}

.auth-subtitle,
.connect-subtitle {
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.5;
  margin: 0 0 28px;
}

/* ----------------------------------------------------------
   Formularios
   ---------------------------------------------------------- */
.auth-form { display: flex; flex-direction: column; gap: 18px; }
.auth-form--hidden { display: none; }

.field { display: flex; flex-direction: column; gap: 6px; }

.field label {
  font-size: 0.8rem;
  font-family: var(--font-mono);
  color: var(--muted);
  letter-spacing: 0.04em;
}

.field input {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  color: var(--ink);
  transition: border-color 0.15s ease;
}

.field input::placeholder { color: #4d535c; }

.field input:focus {
  border-color: var(--accent);
}

.field input.input--error {
  border-color: var(--accent-2);
}

.field-error {
  margin: 0;
  font-size: 0.78rem;
  color: var(--accent-2);
  min-height: 1em;
}

.form-error {
  margin: -6px 0 0;
  font-size: 0.85rem;
  color: var(--accent-2);
  background: rgba(255, 92, 138, 0.08);
  border: 1px solid rgba(255, 92, 138, 0.25);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: none;
}
.form-error.visible { display: block; }

.form-success {
  margin: -6px 0 0;
  font-size: 0.85rem;
  color: var(--accent);
  background: rgba(200, 255, 77, 0.08);
  border: 1px solid rgba(200, 255, 77, 0.25);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: none;
}
.form-success.visible { display: block; }

.auth-note {
  margin: 18px 0 0;
  font-size: 0.8rem;
  color: var(--accent-2);
  text-align: center;
  min-height: 1em;
}

/* ----------------------------------------------------------
   Botones
   ---------------------------------------------------------- */
.auth-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.btn {
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  padding: 12px 18px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: transform 0.08s ease, background 0.15s ease, border-color 0.15s ease;
}

.btn:active { transform: scale(0.98); }

.btn--primary {
  flex: 1;
  background: var(--accent);
  color: #0B0D10;
}
.btn--primary:hover { background: #d8ffaa; }

.btn--ghost {
  background: transparent;
  color: var(--ink);
  border-color: var(--line);
}
.btn--ghost:hover { border-color: var(--accent); color: var(--accent); }

.btn--text {
  background: transparent;
  color: var(--muted);
  padding: 8px 0;
  font-size: 0.85rem;
}
.btn--text:hover { color: var(--ink); }

.btn--spotify {
  width: 100%;
  background: var(--accent);
  color: #0B0D10;
  margin-bottom: 14px;
}
.btn--spotify:hover { background: #d8ffaa; }

.spotify-icon { display: inline-flex; }

/* ----------------------------------------------------------
   Pantalla: Conectar
   ---------------------------------------------------------- */
.connect-card {
  text-align: center;
}
.connect-title {
  font-size: 1.6rem;
  margin: 0 0 10px;
}
#btn-skip-connect { width: 100%; margin-bottom: 12px; }

/* ----------------------------------------------------------
   Pantalla: Cargando
   ---------------------------------------------------------- */
.loading-card {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
}

.loading-text {
  font-family: var(--font-mono);
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0;
}

.loading-spinner {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 48px;
}

.loading-spinner span {
  width: 8px;
  background: var(--accent);
  border-radius: 4px;
  animation: bar-bounce 1s ease-in-out infinite;
}
.loading-spinner span:nth-child(1) { height: 18px; animation-delay: 0s; }
.loading-spinner span:nth-child(2) { height: 38px; animation-delay: 0.15s; background: var(--accent-2); }
.loading-spinner span:nth-child(3) { height: 28px; animation-delay: 0.3s; }
.loading-spinner span:nth-child(4) { height: 44px; animation-delay: 0.45s; background: var(--accent-2); }

@keyframes bar-bounce {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

/* ----------------------------------------------------------
   Pantalla: Estadísticas
   ---------------------------------------------------------- */
.screen--stats {
  align-items: stretch;
  justify-content: flex-start;
  max-width: 1080px;
  margin: 0 auto;
  width: 100%;
  padding-top: 48px;
  padding-bottom: 48px;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
}

.stats-header-left {
  display: flex;
  align-items: center;
  gap: 18px;
}

/* ----------------------------------------------------------
   Avatar de perfil
   ---------------------------------------------------------- */
.avatar-wrapper {
  position: relative;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 50%;
}

.avatar-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #2a2d33;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: transform 0.2s ease, filter 0.2s ease;
  border: 2px solid var(--line);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

/* Overlay con icono de cámara, visible al hacer hover */
.avatar-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease, background 0.2s ease;
}

/* Al hover: contenido se encoge y oscurece, overlay aparece */
.avatar-wrapper:hover .avatar-circle {
  transform: scale(0.88);
  filter: brightness(0.55);
}

.avatar-wrapper:hover .avatar-overlay {
  opacity: 1;
  background: rgba(0, 0, 0, 0.25);
}

.stats-title {
  font-size: 2rem;
  margin: 0;
}

.stats-error {
  background: rgba(255, 92, 138, 0.08);
  border: 1px solid rgba(255, 92, 138, 0.25);
  color: var(--accent-2);
  border-radius: var(--radius-sm);
  padding: 14px;
  font-size: 0.9rem;
  margin-bottom: 20px;
}

.profile-meta {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--muted);
  margin: 2px 0 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.stats-block {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 22px;
}

.stats-block--wide { grid-column: 1 / -1; }

.stats-block-title {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 16px;
}

.stats-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 340px;
  overflow-y: auto;
  /* Scrollbar fina y discreta, acorde al tema oscuro */
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
}

.stats-list::-webkit-scrollbar { width: 6px; }
.stats-list::-webkit-scrollbar-track { background: transparent; }
.stats-list::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 3px;
}
.stats-list::-webkit-scrollbar-thumb:hover { background: var(--muted); }

.stats-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.stats-list li:last-child { border-bottom: none; padding-bottom: 0; }

.stats-list img {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--surface-2);
  flex-shrink: 0;
}

.stats-list .item-text { display: flex; flex-direction: column; min-width: 0; }

.stats-list .item-title {
  font-weight: 600;
  font-size: 0.92rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats-list .item-subtitle {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats-empty {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.85rem;
}

/* ----------------------------------------------------------
   Crear playlist: botón principal
   ---------------------------------------------------------- */
.playlist-action {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.btn--playlist {
  width: auto;
  flex: none;
  padding: 14px 28px;
}

/* ----------------------------------------------------------
   Modal: seleccionar artistas para la playlist
   ---------------------------------------------------------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(11, 13, 16, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal-overlay[hidden] { display: none; }

.modal-card {
  width: 100%;
  max-width: 460px;
  max-height: 85vh;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 24px 60px -24px rgba(0,0,0,0.8);
}

.modal-title {
  font-size: 1.3rem;
  margin: 0;
}

.modal-subtitle {
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.5;
  margin: 0;
}

.artist-select-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  max-height: 280px;
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
}

.artist-select-list::-webkit-scrollbar { width: 6px; }
.artist-select-list::-webkit-scrollbar-track { background: transparent; }
.artist-select-list::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 3px;
}

.artist-select-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.12s ease;
}

.artist-select-option:hover { background: var(--surface-2); }

.artist-select-option input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  flex-shrink: 0;
  cursor: pointer;
}

.artist-select-option img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--surface-2);
  flex-shrink: 0;
}

.artist-select-option span {
  font-size: 0.92rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modal-error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--accent-2);
  background: rgba(255, 92, 138, 0.08);
  border: 1px solid rgba(255, 92, 138, 0.25);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: none;
}
.modal-error.visible { display: block; }

.modal-success {
  margin: 0;
  font-size: 0.85rem;
  color: var(--accent);
  background: rgba(200, 255, 77, 0.08);
  border: 1px solid rgba(200, 255, 77, 0.25);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: none;
}
.modal-success.visible { display: block; }

.modal-success-icon {
  font-size: 2.5rem;
  text-align: center;
  margin: 0 0 12px;
}

.modal-success-msg {
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  color: var(--ink);
  margin: 0 0 20px;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

/* ----------------------------------------------------------
   Responsive
   ---------------------------------------------------------- */
@media (max-width: 720px) {
  .stats-grid { grid-template-columns: 1fr; }
  .auth-card, .connect-card, .loading-card { padding: 26px; }
  .auth-title { font-size: 2rem; }
}

/* ----------------------------------------------------------
   Botón hamburguesa
   ---------------------------------------------------------- */
.btn-hamburger {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s ease;
  flex-shrink: 0;
}

.btn-hamburger:hover { border-color: var(--accent); }

.btn-hamburger span {
  display: block;
  width: 18px;
  height: 2px;
  background: var(--ink);
  border-radius: 2px;
  transition: background 0.15s ease;
}

.btn-hamburger:hover span { background: var(--accent); }

/* ----------------------------------------------------------
   Panel lateral
   ---------------------------------------------------------- */
.side-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(11, 13, 16, 0.5);
  opacity: 0;
  transition: opacity 0.28s ease;
  pointer-events: none;
}

.side-panel-overlay.overlay-open {
  opacity: 1;
  pointer-events: all;
}

.side-panel-overlay[hidden] { display: none; }

.side-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 280px;
  z-index: 41;
  background: var(--surface);
  border-left: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 32px rgba(0,0,0,0.4);
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.side-panel[hidden] {
  display: flex !important;
  visibility: hidden;
  pointer-events: none;
}

.side-panel.panel-open {
  transform: translateX(0);
  visibility: visible;
  pointer-events: all;
}

.side-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--line);
}

.btn-panel-close {
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
}
.btn-panel-close:hover { color: var(--ink); }

.btn-panel-back {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 0.88rem;
  font-family: var(--font-display);
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.15s;
}
.btn-panel-back:hover { color: var(--ink); }

.side-panel-nav {
  display: flex;
  flex-direction: column;
  padding: 12px 0;
}

.side-panel-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  border: none;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 500;
  padding: 14px 20px;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
}
.side-panel-item:hover { background: var(--surface-2); }
.side-panel-item--danger { color: var(--accent-2); }
.side-panel-item--danger:hover { background: rgba(255,92,138,0.08); }

/* ----------------------------------------------------------
   Modal de apps: animación scale + fade
   ---------------------------------------------------------- */
.modal-animated {
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}
.modal-animated.modal-visible {
  opacity: 1;
  pointer-events: all;
}
.modal-animated[hidden] { display: none !important; }

.modal-card-animated {
  transform: scale(0.92);
  transition: transform 0.25s ease, opacity 0.25s ease;
  opacity: 0;
}
.modal-visible .modal-card-animated {
  transform: scale(1);
  opacity: 1;
}
.share-apps-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.share-app-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 8px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
  font-size: 0.78rem;
  font-family: var(--font-display);
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
}

.share-app-btn:hover {
  background: var(--surface);
  border-color: var(--accent);
  transform: translateY(-2px);
}

.share-app-btn:active { transform: scale(0.96); }
.share-link-box {
  display: flex;
  gap: 8px;
  align-items: center;
}

.share-link-box input {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  color: var(--ink);
  min-width: 0;
}

.share-qr-box {
  display: flex;
  justify-content: center;
  padding: 16px;
  background: white;
  border-radius: var(--radius-sm);
}

.share-qr-box canvas,
.share-qr-box img {
  border-radius: 4px;
}
