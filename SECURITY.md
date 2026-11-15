# Seguridad

## Avisar de una vulnerabilidad

Si encuentras un fallo de seguridad, **no abras un issue público**. Usa
[Report a vulnerability](https://github.com/le-chuga/Spotify-Stats/security/advisories/new) en la pestaña Security de este repositorio.
Responderé lo antes posible.

## Qué protege la app

| Zona | Medida |
|---|---|
| Contraseñas | PBKDF2-SHA256 con sal propia; mínimo 8 caracteres y sin las contraseñas más comunes |
| Inicio de sesión | Límite de intentos por IP, por IP+cuenta y por cuenta; mismo mensaje y mismo tiempo para Id inexistente y contraseña errónea |
| Sesión | Identificador aleatorio de 256 bits, cookie `__Host-sid` (`HttpOnly`, `Secure`, `SameSite=Lax`), se renueva al entrar y caduca a las 24 h |
| Conexión con Spotify | `state` OAuth aleatorio, de un solo uso y ligado a tu sesión; los tokens se vinculan siempre a la cuenta de la sesión |
| Tokens de Spotify | Cifrados en la base de datos con AES-256-GCM (clave en el secreto `TOKEN_ENCRYPTION_KEY`) |
| CSRF | Las peticiones que cambian datos solo se aceptan desde el mismo origen (`Origin` / `Sec-Fetch-Site`) además de `SameSite` |
| Navegador | CSP sin `unsafe-inline` ni `unsafe-eval`, HSTS, `nosniff`, `X-Frame-Options`, `COOP`, `CORP`, `Referrer-Policy`, `Permissions-Policy`; la API responde con `Cache-Control: no-store` |
| Datos | Todas las consultas SQL llevan parámetros; las fotos de perfil solo admiten PNG, JPEG, WebP o GIF; los enlaces compartidos no incluyen el email |
| Abuso | Límites por cuenta en compartir, quiz, playlists y amistades |

## Configuración que no está en el código

Estos pasos se hacen una vez, fuera del repositorio:

1. **Clave de cifrado de tokens**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   npx wrangler secret put TOKEN_ENCRYPTION_KEY
   ```
   Sin este secreto la app funciona, pero guarda los tokens sin cifrar. Cuando existe, los tokens
   antiguos se cifran solos la primera vez que se leen. **Guarda la clave en un gestor de contraseñas:**
   si la pierdes, cada persona tendrá que volver a conectar Spotify.
2. **Secreto de Spotify**: los secretos van en `wrangler secret put` (producción) o en `.dev.vars`
   (local, ignorado por Git). Nunca en el repositorio. Hay una plantilla en `.dev.vars.example`.
3. **Activar el hook local** que bloquea commits con secretos: `npm run setup:hooks`.

## Si un secreto se ha subido a Git

Borrar el archivo en un commit nuevo **no basta**: sigue en el historial y quien lo haya clonado ya lo tiene.

1. **Rota el secreto primero** (es lo que de verdad lo invalida):
   - Spotify: dashboard de desarrolladores → tu app → Settings → *View client secret* → *Reset*.
     Después `npx wrangler secret put SPOTIFY_CLIENT_SECRET`.
2. Opcional, para limpiar el historial público: `git filter-repo --invert-paths --path <archivo>` y
   `git push --force --all`. Es destructivo (reescribe commits y obliga a todos los clones a
   volver a clonar), así que hazlo solo después de rotar.
3. Para buscar más secretos en todo el historial: `gitleaks git .`

## Comprobaciones automáticas

- `npm test`: pruebas de login, límites, sesión, OAuth, CSRF, cifrado y cabeceras.
- `npm run check:security`: `public/_headers` sincronizado con el código y búsqueda de secretos.
- GitHub Actions: las mismas pruebas más `npm audit`, en cada push y pull request.
- CodeQL analiza el código cada semana y en cada pull request.
- Dependabot propone actualizaciones de dependencias y de acciones, con 7 días de espera.

## Límites conocidos

- El resultado del quiz lo envía el navegador: el servidor descarta valores imposibles, pero no puede
  demostrar que las respuestas fueran reales, así que la clasificación se puede falsear.
- El Id de cuenta es también el nombre que aparece en la clasificación y entre amigos. Si algún día quieres
  que el Id de acceso sea privado, hace falta un nombre público aparte.
- Los enlaces compartidos son públicos para quien tenga el enlace y no caducan solos (así lo dice la política
  de privacidad). Cada cuenta puede borrarlos borrando su cuenta.
