/**
 * Adivina la canción: eliges un artista y suena el inicio de una de sus canciones.
 * Cada fallo (o salto) alarga el fragmento. Cuantos menos segundos necesites, más puntos.
 * Los fragmentos vienen de la API pública de iTunes (30 s), igual que el quiz.
 * Todos los jugadores adivinan las mismas canciones.
 */
import { h, icon } from "./dom.js";
import { buzz, chime } from "./audio.js";

const CLIPS = [1, 2, 4, 7, 11, 16]; // segundos de audio en cada intento
const SONGS = 3;
const MIN_TRACKS = 8;
const MAX_SUGGESTIONS = 6;

export default {
  id: "guess",
  name: "Adivina la canción",
  tagline: "Reconoce la canción con fragmentos cada vez más largos.",
  icon: '<circle cx="128" cy="128" r="88"/><circle cx="128" cy="128" r="24"/><path d="M128 40v-8M216 128h8"/>',
  duration: "4-8 min",
  rules: `Elige un artista. Sonará el inicio de una de sus canciones, empezando por ${CLIPS[0]} segundo. Escríbela o elígela de la lista: si fallas o saltas, el fragmento se alarga (${CLIPS.join(", ")} s). Son ${SONGS} canciones: aciertas al primer intento = ${CLIPS.length} puntos, al último = 1. Necesita conexión a internet.`,
  format: (n) => `${n} pts`,

  async run(ctx) {
    const pool = await chooseArtist(ctx);
    const songs = shuffle(pool.filter((t) => t.previewUrl)).slice(0, SONGS);
    const scores = ctx.players.map(() => 0);

    for (let p = 0; p < ctx.players.length; p++) {
      ctx.setTurn(p);
      await ctx.gate(p, `${SONGS} canciones de ${pool.artist}. ¡Adivina cada una con el mínimo de segundos!`);
      for (let s = 0; s < songs.length; s++) {
        scores[p] += await playSong(ctx, songs[s], pool, s);
        ctx.setScore(p, scores[p]);
      }
      await ctx.pause({
        title: `${scores[p]} / ${SONGS * CLIPS.length}`,
        text: "Se acabó tu turno.",
        button: p < ctx.players.length - 1 ? "Siguiente jugador" : "Ver resultados",
      });
    }
    return scores;
  },
};

/* ----------------------------------------------------------
   Artista y canciones (iTunes)
   ---------------------------------------------------------- */
const normalize = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Quita "(feat. …)", "- Remastered 2011", etc. */
const cleanTitle = (s) => s.replace(/\s*[([][^)\]]*[)\]]/g, "").replace(/\s+-\s+.*$/, "").trim() || s;

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function itunes(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("itunes");
  return (await res.json()).results ?? [];
}

async function fetchTracks(name) {
  const artists = await itunes(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=1`);
  const artist = artists[0];
  const url = artist
    ? `https://itunes.apple.com/lookup?id=${artist.artistId}&entity=song&limit=60`
    : `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=60`;
  const seen = new Set();
  const tracks = [];
  for (const r of await itunes(url)) {
    if (r.wrapperType !== "track" || !r.trackName) continue;
    const title = cleanTitle(r.trackName);
    const key = normalize(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    tracks.push({ title, key, previewUrl: r.previewUrl || null, art: r.artworkUrl100?.replace("100x100", "300x300") || "" });
  }
  const list = tracks;
  list.artist = artist?.artistName ?? name;
  return list;
}

/** Pide un artista hasta que tenga suficientes canciones con fragmento. */
async function chooseArtist(ctx) {
  let message = "";
  for (;;) {
    const name = await new Promise((resolve) => {
      const input = h("input", {
        type: "text", class: "guess-input", placeholder: "Nombre del artista", autocomplete: "off",
        autocapitalize: "words", "aria-label": "Nombre del artista", "data-autofocus": true,
      });
      const go = h("button", { type: "submit", class: "btn btn--primary btn--lg btn--block" }, "Buscar canciones");
      const form = h("form", { class: "game-card-view game-card-view--center" },
        h("h2", { class: "game-heading" }, "¿De qué artista?"),
        h("p", { class: "muted" }, "Escribe un artista que conozcáis todos."),
        input, go,
        message ? h("p", { class: "game-status is-bad", role: "alert" }, message) : null);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (input.value.trim()) resolve(input.value.trim());
      });
      ctx.show(form);
    });

    ctx.show(h("div", { class: "game-card-view game-card-view--center" },
      h("p", { class: "game-status", role: "status" }, "Buscando canciones…")));
    try {
      const tracks = await ctx.sleep(0).then(() => fetchTracks(name));
      if (tracks.filter((t) => t.previewUrl).length >= MIN_TRACKS) return tracks;
      message = "Ese artista no tiene suficientes canciones con fragmento. Prueba con otro.";
    } catch {
      message = "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.";
    }
  }
}

/* ----------------------------------------------------------
   Una canción: hasta CLIPS.length intentos. Devuelve los puntos.
   ---------------------------------------------------------- */
async function playSong(ctx, song, pool, index) {
  const audio = new Audio(song.previewUrl);
  audio.preload = "auto";
  let stopTimer = null;
  const stop = () => { clearTimeout(stopTimer); audio.pause(); };
  ctx.onCleanup(() => { stop(); audio.removeAttribute("src"); audio.load(); });

  const bar = h("div", { class: "round-bar", "aria-hidden": "true" }, CLIPS.map(() => h("span")));
  const status = h("p", { class: "game-status", role: "status" });
  const listen = h("button", { type: "button", class: "btn btn--primary btn--lg btn--block", "data-autofocus": true });
  const input = h("input", {
    type: "text", class: "guess-input", placeholder: "Escribe el título…", autocomplete: "off",
    "aria-label": "Título de la canción",
  });
  const list = h("ul", { class: "guess-list" });
  const skip = h("button", { type: "button", class: "btn btn--outline btn--block" });
  ctx.show(h("div", { class: "game-card-view" }, bar, status, listen, input, list, skip));

  let attempt = 0;
  const refresh = () => {
    bar.childNodes.forEach((s, i) => { s.className = i < attempt ? "is-done" : i === attempt ? "is-now" : ""; });
    const secs = CLIPS[attempt];
    listen.replaceChildren(icon('<path d="M80 56v144l112-72Z"/>'), ` Escuchar ${secs} ${secs === 1 ? "segundo" : "segundos"}`);
    status.textContent = `Canción ${index + 1} de ${SONGS} · intento ${attempt + 1} de ${CLIPS.length}`;
    skip.textContent = attempt < CLIPS.length - 1 ? `Saltar (+${CLIPS[attempt + 1] - CLIPS[attempt]} s)` : "Rendirme";
  };

  const playClip = () => {
    stop();
    audio.currentTime = 0;
    audio.play().catch(() => { status.textContent = "No se pudo reproducir el audio."; });
    stopTimer = setTimeout(() => audio.pause(), CLIPS[attempt] * 1000);
  };
  listen.addEventListener("click", playClip);

  const suggest = () => {
    const q = normalize(input.value);
    const matches = q ? pool.filter((t) => t.key.includes(q)).slice(0, MAX_SUGGESTIONS) : [];
    list.replaceChildren(...matches.map((t) => {
      const b = h("button", { type: "button", class: "guess-option" }, t.title);
      b.addEventListener("click", () => submit(t));
      return h("li", {}, b);
    }));
  };
  input.addEventListener("input", suggest);

  let resolveRound;
  const done = new Promise((res) => { resolveRound = res; });
  const miss = () => {
    input.value = "";
    list.replaceChildren();
    if (attempt < CLIPS.length - 1) {
      attempt++;
      refresh();
      playClip();
    } else {
      resolveRound(0);
    }
  };
  const submit = (track) => {
    if (track.key === song.key) {
      resolveRound(CLIPS.length - attempt);
    } else {
      buzz();
      miss();
    }
  };
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = normalize(input.value);
    const pick = pool.find((t) => t.key === q) ?? pool.filter((t) => t.key.includes(q))[0];
    if (pick) submit(pick);
  });
  skip.addEventListener("click", miss);

  refresh();
  const points = await done;
  stop();

  const art = song.art ? h("img", { class: "guess-art", src: song.art, alt: "" }) : null;
  (points > 0 ? chime : buzz)();
  const text = points > 0 ? `¡Era «${song.title}»! +${points} ${points === 1 ? "punto" : "puntos"}` : `Era «${song.title}»`;
  const next = h("button", { type: "button", class: "btn btn--primary btn--lg btn--block", "data-autofocus": true },
    index < SONGS - 1 ? "Siguiente canción" : "Continuar");
  ctx.show(h("div", { class: "game-card-view game-card-view--center" },
    art, h("p", { class: `game-status ${points > 0 ? "is-good" : "is-bad"}`, role: "status" }, text), next));
  ctx.say(text);
  // Se oye el resto del fragmento mientras se lee el resultado
  audio.currentTime = 0;
  audio.play().catch(() => {});
  await new Promise((resolve) => next.addEventListener("click", resolve));
  stop();
  return points;
}
