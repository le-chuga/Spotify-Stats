/* Service worker de /games: guarda la página y sus archivos para jugar sin conexión.
   Solo controla /games (scope), el resto de la app no pasa por aquí. */
const CACHE = "frecuencia-games-v1";
const FILES = [
  "/games",
  "/css/styles.css",
  "/css/games.css",
  "/fonts/unbounded-latin-wght-normal.woff2",
  "/fonts/instrument-sans-latin-wght-normal.woff2",
  "/favicon.svg",
  "/js/a11y.js",
  "/js/games.js",
  "/js/games/audio.js",
  "/js/games/dom.js",
  "/js/games/simon.js",
  "/js/games/pulse.js",
  "/js/games/ear.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero la red (para recibir cambios); si no hay conexión, lo guardado
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && FILES.includes(url.pathname)) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});
