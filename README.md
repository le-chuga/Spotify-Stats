#Estadísticas de Spotify (Clean Architecture)

Aplicación web con:
- Base de datos SQLite (creada automáticamente al arrancar).
- Pantalla de login / registro de cuenta propia.
- Vinculación con Spotify (OAuth) y visualización de estadísticas reales de escucha.

## Estructura (Clean Architecture)

```
src/
  domain/                  # Entidades + interfaces (puertos). Sin dependencias externas.
    entities/User.js
    repositories/UserRepository.js
  application/             # Casos de uso (reglas de negocio). Dependen solo del dominio.
    usecases/RegisterUserUseCase.js
    usecases/LoginUserUseCase.js
    usecases/LinkSpotifyAccountUseCase.js
    usecases/GetSpotifyStatsUseCase.js
  infrastructure/          # Implementaciones concretas (detalles técnicos).
    db/database.js              -> crea/migra la BD SQLite (sql.js)
    repositories/SqliteUserRepository.js -> implementa UserRepository con SQLite
    spotify/SpotifyClient.js     -> llamadas reales a la Web API de Spotify
    http/controllers/            -> traducen HTTP <-> casos de uso
    http/routes/                 -> definición de endpoints Express
  index.js                 # Composition root: conecta todas las piezas (DI manual)

public/                    # Frontend (HTML + CSS + JS modular)
  index.html               # Las 4 pantallas: login/registro, conectar, cargando, stats
  css/styles.css
  js/api.js                # acceso a la API (fetch)
  js/ui.js                 # manipulación del DOM
  js/app.js                # orquestador / flujo de pantallas
```

## 1. Instalación

```bash
npm install
```

## 2. Configurar Spotify (OBLIGATORIO para el botón "Conectar con Spotify")

> ⚠️ Desde abril de 2025, Spotify ya **no permite `localhost`** como redirect URI
> en apps nuevas: solo acepta direcciones loopback literales (`127.0.0.1`).
> Por eso usamos `127.0.0.1` en lugar de `localhost` en todo este apartado.
> **Accede también a la web por `http://127.0.0.1:3000`** (no por `localhost:3000`),
> para que la cookie de sesión sea del mismo origen que el callback de Spotify.

1. Ve a https://developer.spotify.com/dashboard y crea una app.
2. En **Redirect URIs** añade exactamente:
   ```
   http://127.0.0.1:3000/api/spotify/callback
   ```
3. Copia el **Client ID** y **Client Secret**.
4. Crea un fichero `.env` en la raíz (o exporta variables de entorno) con:

```
SPOTIFY_CLIENT_ID=tu_client_id
SPOTIFY_CLIENT_SECRET=tu_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
SESSION_SECRET=una_cadena_aleatoria_larga
```

> Si no configuras esto, el resto de la app (login, registro, BD) funciona igual,
> pero al pulsar "Conectar con Spotify" Spotify devolverá un error de redirect_uri/client_id inválido.

> Nota: si usas un `.env`, instala `dotenv` (`npm install dotenv`) y añade
> `require('dotenv').config();` como primera línea de `src/index.js`.

## 3. Arrancar

```bash
npm start
```

Abre http://localhost:3000

Al arrancar verás en consola:
```
[DB] Nueva base de datos creada en memoria   (o "cargada desde data/app.sqlite")
[DB] Migraciones aplicadas correctamente (tabla 'users' lista)
🎧 Servidor escuchando en http://localhost:3000
```

La base de datos se guarda en `data/app.sqlite` y persiste entre reinicios.

## Flujo de usuario

1. **Login / Registro**: se valida contra la BD.
   - Si ni el Id ni la contraseña existen -> error general (ambos campos marcados).
   - Si el Id existe pero la contraseña no coincide -> "La contraseña es errónea" (solo ese campo).
   - "Crear cuenta" permite registrar un nuevo Id+contraseña (hash bcrypt). Si el Id ya existe, error.
2. **Conectar Spotify**: botón que redirige al login OAuth real de Spotify.
3. **Cargando**: pantalla intermedia mientras se obtienen las estadísticas.
4. **Estadísticas**: top canciones, top artistas y reproducciones recientes reales (vía Spotify Web API).
