/**
 * commonTracks.js
 * Lógica pura (sin red ni DOM) de la función "Canciones en común":
 * leer la URL de una playlist y calcular qué canciones comparten varias.
 */

const ID_RE = /^[A-Za-z0-9]{22}$/;

/**
 * Extrae el Id de una playlist de Spotify a partir de lo que pegue el usuario.
 * Acepta:
 *   https://open.spotify.com/playlist/<id>?si=...
 *   https://open.spotify.com/intl-es/playlist/<id>
 *   https://open.spotify.com/embed/playlist/<id>
 *   spotify:playlist:<id>
 *   <id> (22 caracteres)
 * @param {string} input
 * @returns {string|null} el Id, o null si no parece una playlist de Spotify
 */
export function extractPlaylistId(input) {
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (!text) return null;

  if (ID_RE.test(text)) return text;

  const uri = text.match(/^spotify:(?:user:[^:]+:)?playlist:([A-Za-z0-9]{22})$/);
  if (uri) return uri[1];

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.hostname !== "open.spotify.com" && url.hostname !== "play.spotify.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const at = parts.indexOf("playlist");
  const id = at >= 0 ? parts[at + 1] : null;
  return id && ID_RE.test(id) ? id : null;
}

/** Quita lo que cambia entre ediciones de una misma canción ("- Remastered 2011", "(Mono)"…). */
function cleanTitle(name) {
  return String(name ?? "")
    .replace(/\s*[-–]\s*(?:\d{4}\s+)?(?:remaster(?:ed)?|mono|stereo)(?:\s+version)?(?:\s+\d{4})?\s*$/i, "")
    .replace(/\s*\((?:\d{4}\s+)?(?:remaster(?:ed)?|mono|stereo)(?:\s+version)?(?:\s+\d{4})?\)\s*$/i, "");
}

function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clave "título + artista principal". La misma canción suele estar en Spotify
 * con Ids distintos (álbum, single, recopilatorio) y aun así es la misma canción.
 */
export function trackKey(track) {
  const artist = Array.isArray(track.artists) ? track.artists[0] : "";
  return `${normalize(cleanTitle(track.name))}|${normalize(artist)}`;
}

/**
 * Canciones que aparecen en TODAS las playlists.
 * Una canción cuenta como coincidente si tiene el mismo Id o la misma clave título+artista.
 * El resultado sigue el orden de la primera playlist y no repite canciones.
 *
 * @param {Array<{ tracks: Array<{id:string, uri:string, name:string, artists:string[]}> }>} playlists
 * @returns {Array<{id:string, uri:string, name:string, artists:string[]}>}
 */
export function findCommonTracks(playlists) {
  if (!Array.isArray(playlists) || playlists.length < 2) return [];

  const others = playlists.slice(1).map((p) => ({
    ids: new Set(p.tracks.map((t) => t.id)),
    keys: new Set(p.tracks.map(trackKey)),
  }));

  const seen = new Set();
  const common = [];
  for (const track of playlists[0].tracks) {
    const key = trackKey(track);
    if (seen.has(key)) continue;
    const inAll = others.every((o) => o.ids.has(track.id) || o.keys.has(key));
    if (!inAll) continue;
    seen.add(key);
    common.push(track);
  }
  return common;
}
