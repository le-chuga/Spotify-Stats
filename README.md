# Estadísticas de Spotify (Clean Architecture)

He creado esta web cmo proyecto personal y etamo mejorandola poco a poco, le estoy metiend mas fncionalidades a memdida que pasa el tiempo, es posible que 
haga un minijuego de adivinar la canción/grupo/artista o algo así pero aún no tengo muy claro como lo voy a hacer o donde implementarlo

---

## Despliegue en Cloudflare Workers

App migrada de Express + SQLite a **Hono + D1 + KV**.

## Pasos para desplegar

### 1. Instalar Wrangler
```bash
npm install
npm install -g wrangler
wrangler login
```

### 2. Crear la base de datos D1
```bash
npm run db:create
```
Copia el `database_id` que te devuelve y pégalo en `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "frecuencia-db"
database_id = "PEGA_AQUI_EL_ID"
```

### 3. Crear el namespace KV para sesiones
```bash
npm run kv:create
```
Copia el `id` que te devuelve y pégalo en `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "PEGA_AQUI_EL_ID"
```

### 4. Ejecutar las migraciones SQL
```bash
npm run db:migrate:remote
```

### 5. Añadir variables de entorno secretas
```bash
wrangler secret put SPOTIFY_CLIENT_ID
wrangler secret put SPOTIFY_CLIENT_SECRET
```

### 6. Actualizar el Redirect URI de Spotify
En `wrangler.toml` actualiza:
```toml
[vars]
SPOTIFY_REDIRECT_URI = "https://frecuencia.TU_SUBDOMINIO.workers.dev/api/spotify/callback"
```
Y añade esa misma URL en el dashboard de Spotify → Settings → Redirect URIs.

### 7. Desplegar
```bash
npm run deploy
```

### 8. (Opcional) Dominio personalizado
En el dashboard de Cloudflare → Workers → tu worker → Settings → Domains & Routes → Add Custom Domain.

## Estructura
```
src/
  worker.js                          # Entry point (Hono)
  domain/
    commonTracks.js                  # Lógica pura: leer URLs de playlists y calcular canciones en común
  infrastructure/
    session.js                       # Sesiones con KV
    repositories/
      D1UserRepository.js            # Usuarios en D1
      D1SnapshotRepository.js        # Snapshots en D1
    spotify/
      SpotifyClient.js               # API de Spotify (fetch nativo)
    http/
      authRoutes.js                  # /api/auth/*
      spotifyRoutes.js               # /api/spotify/*
      avatarRoutes.js                # /api/avatar/*
      shareRoutes.js                 # /api/share/*
      quizRoutes.js                  # /api/quiz/*
      deezerRoutes.js                # /api/deezer/*
public/                              # Frontend estático
  js/common.js                       # Modal "Canciones en común"
schema.sql                           # Schema de D1
wrangler.toml                        # Config de Cloudflare
```

## Crear playlist de artistas

El botón **Crear playlist de…** de la pantalla de estadísticas permite elegir artistas de tu lista
de más escuchados o **buscarlos por nombre** (Spotify devuelve hasta 10 resultados por búsqueda; la
selección se conserva entre búsquedas y se ve como chips). La playlist se arma con las canciones de
esos artistas que ya tienes en "Canciones que te gustan"; si de alguno no hay ninguna, la app lo
indica al terminar.

- `GET /api/spotify/search/artists?q=…` → busca artistas en Spotify.
- `POST /api/spotify/playlist` → crea la playlist; responde también con `missingArtists`.

## Canciones en común

Menú ☰ → **Canciones en común**. Se pegan los enlaces de 2 a 6 playlists (también acepta
`spotify:playlist:…` o varios enlaces pegados de golpe), se muestra cuántas canciones están en
todas, se pide un título y se crea una playlist privada nueva en la cuenta de Spotify con la sesión
iniciada. Dos ediciones de una misma canción (p. ej. "Yesterday" y "Yesterday - Remastered 2009")
cuentan como la misma.

- `POST /api/spotify/common/preview` → lee las playlists y devuelve las coincidencias.
- `POST /api/spotify/common/create` → crea la playlist con el título elegido.

**Limitación de Spotify:** desde febrero de 2026, `GET /playlists/{id}/items` solo devuelve el
contenido de playlists **propias o colaborativas** para apps en modo desarrollo. Con playlists de
otras personas la app avisa con un mensaje claro; para leerlas hace falta pedir *Extended Quota
Mode* en el dashboard de Spotify.

**Permisos nuevos:** se han añadido los scopes `playlist-read-private` y
`playlist-read-collaborative`. Quien ya tenía Spotify vinculado debe volver a conectar su cuenta una
vez (la app muestra el botón "Volver a conectar Spotify" cuando hace falta).

## Diseño

- **Layout:** flexbox en toda la app, mobile first (probado desde 320 px hasta escritorio).
- **Color:** tinta índigo, papel frío y un único acento mandarina. Modo oscuro automático
  (`prefers-color-scheme`); el verde y el frambuesa solo marcan acierto y fallo en el quiz.
- **Tipografía:** Unbounded (títulos y cifras) e Instrument Sans (texto), autoalojadas en `public/fonts`.
- **Iconos:** Phosphor, incrustados como SVG en el HTML.
- **Móvil:** `100dvh`, áreas seguras (`env(safe-area-inset-*)`), objetivos táctiles de 44 px o más,
  campos a 16 px (iOS no hace zoom) y `:hover` solo con puntero fino.
- **Seguridad:** el nombre de Spotify, el Id de usuario y la foto se pintan con `textContent`,
  nunca como HTML, y el servidor solo acepta fotos en formato `data:image/...;base64`.
