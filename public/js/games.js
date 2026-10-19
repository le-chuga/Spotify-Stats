/**
 * games.js
 * Pantalla "Games": elegir cuántos jugáis (1 a 4) y a qué, y el motor común de
 * las partidas por turnos (turnos, marcador, resultados, récord personal).
 * Cada juego vive en js/games/ y solo implementa run(ctx).
 */
import { h, icon, store } from "./games/dom.js";
import { unlock } from "./games/audio.js";
import simon from "./games/simon.js";
import pulse from "./games/pulse.js";
import ear from "./games/ear.js";

const GAMES = [simon, pulse, ear];
const MAX_PLAYERS = 4;

const $ = (id) => document.getElementById(id);
const hub = $("screen-hub");
const play = $("screen-play");
const stage = $("game-stage");
const scoreboard = $("scoreboard");
const live = $("game-live");
const backLink = $("btn-back");
const backLabel = $("back-label");

let playerCount = clampPlayers(Number(store.get("frecuencia.games.players")) || 1);
let run = null; // partida en curso

function clampPlayers(n) {
  return Math.min(MAX_PLAYERS, Math.max(1, Math.round(n)));
}

/* ----------------------------------------------------------
   Lista de juegos
   ---------------------------------------------------------- */
const bestKey = (game) => `frecuencia.games.best.${game.id}`;
const getBest = (game) => {
  const raw = store.get(bestKey(game));
  return raw == null ? null : Number(raw);
};

function renderPlayersPicker() {
  const picker = $("players-picker");
  picker.replaceChildren(
    ...Array.from({ length: MAX_PLAYERS }, (_, i) => {
      const n = i + 1;
      const input = h("input", { type: "radio", name: "players", value: n, checked: n === playerCount });
      input.addEventListener("change", () => {
        playerCount = n;
        store.set("frecuencia.games.players", String(n));
      });
      return h("label", { class: "seg-opt" }, input,
        h("span", {}, h("strong", {}, n), h("small", {}, n === 1 ? "jugador" : "jugadores")));
    })
  );
}

function renderGameList() {
  $("game-list").replaceChildren(
    ...GAMES.map((game) => {
      const best = getBest(game);
      const btn = h("button", { type: "button", class: "game-card" },
        h("span", { class: "game-card-icon" }, icon(game.icon)),
        h("span", { class: "game-card-body" },
          h("span", { class: "game-card-name" }, game.name),
          h("span", { class: "game-card-desc" }, game.tagline),
          h("span", { class: "game-card-meta" },
            `1-4 jugadores · ${game.duration}`, best != null ? ` · Tu récord: ${game.format(best)}` : "")
        )
      );
      btn.addEventListener("click", () => startGame(game));
      return h("li", {}, btn);
    })
  );
}

/* ----------------------------------------------------------
   Motor de partida
   ---------------------------------------------------------- */
function makePlayers(count) {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    name: count === 1 ? "Tú" : `Jugador ${i + 1}`,
  }));
}

const badge = (p, extra = "") => h("span", { class: `pbadge p${p.index + 1} ${extra}`.trim(), "aria-hidden": "true" }, p.index + 1);

function showScreen(name) {
  hub.hidden = name !== "hub";
  play.hidden = name !== "play";
  backLabel.textContent = name === "hub" ? "Volver" : "Juegos";
  window.scrollTo(0, 0);
}

function exitGame() {
  if (run) {
    run.cancelled = true;
    run.cleanups.forEach((fn) => fn());
    run = null;
  }
  renderGameList();
  showScreen("hub");
}

backLink.addEventListener("click", (e) => {
  if (!run) return; // en la lista, el enlace lleva a la página principal
  e.preventDefault();
  exitGame();
});

function startGame(game) {
  unlock();
  const players = makePlayers(playerCount);
  const state = { cancelled: false, cleanups: [], game, players };
  run = state;

  const scoreCells = players.map((p) => h("span", { class: "pscore" }, "0"));
  const rows = players.map((p, i) => h("li", { class: `pl p${p.index + 1}` }, badge(p), h("span", { class: "pname" }, p.name), scoreCells[i]));
  scoreboard.replaceChildren(...rows);
  scoreboard.hidden = false;

  /** Pausa que no se reanuda si se ha salido de la partida. */
  const alive = (value) => (state.cancelled ? new Promise(() => {}) : value);

  const ctx = {
    players,
    sleep: (ms) => new Promise((res) => setTimeout(res, ms)).then(alive),
    say: (text) => { live.textContent = ""; live.textContent = text; },
    onCleanup: (fn) => state.cleanups.push(fn),
    setTurn(i) { rows.forEach((r, j) => { r.classList.toggle("is-turn", j === i); if (j === i) r.setAttribute("aria-current", "true"); else r.removeAttribute("aria-current"); }); },
    setScore(i, value) { scoreCells[i].textContent = game.format(value); },
    show(...nodes) {
      stage.replaceChildren(...nodes);
      stage.querySelector("[data-autofocus]")?.focus({ preventScroll: true });
    },
    /** Tarjeta con un título y un botón; se resuelve al pulsarlo. */
    pause({ title, text, button, who }) {
      return new Promise((resolve) => {
        const btn = h("button", { type: "button", class: "btn btn--primary btn--lg btn--block", "data-autofocus": true }, button);
        btn.addEventListener("click", () => { unlock(); resolve(); });
        ctx.show(h("div", { class: "game-card-view game-card-view--center" },
          who ? badge(who, "pbadge--lg") : null,
          h("h2", { class: "game-heading" }, title),
          text ? h("p", { class: "muted" }, text) : null,
          btn));
        ctx.say(`${title}. ${text ?? ""}`);
      }).then(alive);
    },
    /** Pasa el dispositivo al siguiente jugador. */
    gate(i, text) {
      const p = players[i];
      return ctx.pause({
        who: players.length > 1 ? p : null,
        title: players.length > 1 ? `Turno de ${p.name}` : "¿Listo?",
        text,
        button: "Estoy listo",
      });
    },
  };

  showScreen("play");
  (async () => {
    await ctx.pause({ title: game.name, text: game.rules, button: "Empezar" });
    ctx.setTurn(0);
    const scores = await game.run(ctx);
    if (state.cancelled) return;
    showResults(game, players, scores);
  })();
}

function showResults(game, players, scores) {
  scoreboard.querySelectorAll(".is-turn").forEach((r) => r.classList.remove("is-turn"));
  const ranking = players
    .map((p, i) => ({ p, score: scores[i] }))
    .sort((a, b) => b.score - a.score);
  const top = ranking[0].score;
  const winners = ranking.filter((r) => r.score === top);

  let headline;
  let sub = "";
  if (players.length === 1) {
    const previous = getBest(game);
    const isRecord = previous == null || top > previous;
    if (isRecord) store.set(bestKey(game), String(top));
    headline = game.format(top);
    sub = isRecord ? (previous == null ? "¡Primera marca guardada!" : "¡Nuevo récord personal!") : `Tu récord es ${game.format(previous)}.`;
  } else {
    headline = winners.length === 1 ? `¡Gana ${winners[0].p.name}!` : "¡Empate!";
    sub = winners.length === 1 ? `con ${game.format(top)}` : `${winners.map((w) => w.p.name).join(" y ")} con ${game.format(top)}`;
  }

  const list = players.length > 1
    ? h("ol", { class: "ranking" }, ranking.map((r, i) =>
        h("li", { class: r.score === top ? "is-winner" : "" },
          h("span", { class: "rank-pos" }, i + 1),
          badge(r.p),
          h("span", { class: "pname" }, r.p.name),
          h("span", { class: "pscore" }, game.format(r.score)))))
    : null;

  const again = h("button", { type: "button", class: "btn btn--primary btn--lg btn--block", "data-autofocus": true }, "Jugar de nuevo");
  const other = h("button", { type: "button", class: "btn btn--outline btn--block" }, "Otros juegos");
  again.addEventListener("click", () => { exitGame(); startGame(game); });
  other.addEventListener("click", exitGame);

  stage.replaceChildren(h("div", { class: "game-card-view game-card-view--center" },
    h("p", { class: "quiz-name" }, game.name),
    h("h2", { class: "game-heading" }, headline),
    h("p", { class: "muted" }, sub),
    list, again, other));
  stage.querySelector("[data-autofocus]").focus({ preventScroll: true });
  live.textContent = `${headline}. ${sub}`;
}

/* ----------------------------------------------------------
   Arranque + modo sin conexión
   ---------------------------------------------------------- */
renderPlayersPicker();
renderGameList();

// El service worker guarda la página y los scripts para poder jugar sin wifi
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/games-sw.js", { scope: "/games" }).catch(() => {});
}
