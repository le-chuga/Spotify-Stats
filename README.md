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
public/                              # Frontend estático (sin cambios)
schema.sql                           # Schema de D1
wrangler.toml                        # Config de Cloudflare
```
