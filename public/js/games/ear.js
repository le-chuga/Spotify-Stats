/**
 * ¿Sube o baja? Suenan dos notas: ¿la segunda es más aguda o más grave?
 * Cada ronda el salto es más pequeño. Todos los jugadores oyen las mismas notas.
 */
import { h, seeded, newSeed, icon } from "./dom.js";
import { tone, midiToFreq, buzz, chime } from "./audio.js";

// Saltos en semitonos, de fácil a difícil
const STEPS = [7, 6, 5, 4, 3, 3, 2, 2, 1, 1];

export default {
  id: "ear",
  name: "¿Sube o baja?",
  tagline: "Entrena el oído: ¿la segunda nota es más aguda?",
  icon: '<path d="M48 128c0-44 36-80 80-80s80 36 80 80c0 28-14 40-28 52-10 9-12 18-12 30a26 26 0 0 1-52 0"/><path d="M96 128a32 32 0 0 1 64 0c0 20-20 22-20 40"/>',
  duration: "2-4 min",
  rules: `Sonarán dos notas seguidas. Di si la segunda es más aguda o más grave que la primera. Son ${STEPS.length} rondas y cada vez la diferencia es más pequeña. Puedes volver a escucharlas cuantas veces quieras. Gana quien acierte más.`,
  format: (n) => `${n} / ${STEPS.length}`,

  async run(ctx) {
    const rng = seeded(newSeed());
    const rounds = STEPS.map((step) => {
      const base = 55 + Math.floor(rng() * 14); // Sol3 … Fa#4
      const up = rng() < 0.5;
      return { base, next: up ? base + step : base - step, up };
    });
    const scores = [];

    for (let p = 0; p < ctx.players.length; p++) {
      ctx.setTurn(p);
      await ctx.gate(p, `Acierta si la segunda nota sube o baja (${STEPS.length} rondas).`);
      let correct = 0;
      for (let r = 0; r < rounds.length; r++) {
        if (await playRound(ctx, rounds[r], r)) correct++;
        ctx.setScore(p, correct);
      }
      scores.push(correct);
      await ctx.pause({
        title: `${correct} / ${STEPS.length}`,
        text: correct === STEPS.length ? "¡Oído absoluto!" : "Se acabó tu turno.",
        button: p < ctx.players.length - 1 ? "Siguiente jugador" : "Ver resultados",
      });
    }
    return scores;
  },
};

function playPair(round) {
  tone(midiToFreq(round.base), { dur: 0.6, type: "sine", gain: 0.3 });
  tone(midiToFreq(round.next), { dur: 0.6, type: "sine", gain: 0.3, delay: 0.8 });
  return 1500; // ms hasta que acaba de sonar
}

async function playRound(ctx, round, index) {
  const status = h("p", { class: "game-status", role: "status" }, `Ronda ${index + 1} de ${STEPS.length} · escucha…`);
  const bar = h("div", { class: "round-bar", "aria-hidden": "true" },
    STEPS.map((_, i) => h("span", { class: i < index ? "is-done" : i === index ? "is-now" : "" })));
  const replay = h("button", { type: "button", class: "btn btn--outline" }, icon('<path d="M40 128h24l40-40v80l-40-40"/><path d="M148 100a40 40 0 0 1 0 56M172 80a72 72 0 0 1 0 96"/>'), " Volver a escuchar");
  const higher = h("button", { type: "button", class: "btn btn--primary btn--lg", disabled: true }, "↑ Más aguda");
  const lower = h("button", { type: "button", class: "btn btn--primary btn--lg", disabled: true }, "↓ Más grave");
  ctx.show(h("div", { class: "game-card-view" }, bar, status, replay, h("div", { class: "answer-row" }, lower, higher)));

  const answer = new Promise((resolve) => {
    higher.addEventListener("click", () => resolve(true));
    lower.addEventListener("click", () => resolve(false));
  });

  const listen = async () => {
    higher.disabled = lower.disabled = replay.disabled = true;
    await ctx.sleep(300);
    const ms = playPair(round);
    await ctx.sleep(ms);
    higher.disabled = lower.disabled = replay.disabled = false;
    status.textContent = "¿La segunda nota es más aguda o más grave?";
    ctx.say(status.textContent);
  };
  replay.addEventListener("click", listen);
  listen();

  const saidUp = await answer;
  higher.disabled = lower.disabled = replay.disabled = true;
  const ok = saidUp === round.up;
  (ok ? chime : buzz)();
  status.textContent = ok ? "¡Correcto!" : `Era más ${round.up ? "aguda" : "grave"}`;
  status.classList.add(ok ? "is-good" : "is-bad");
  ctx.say(status.textContent);
  await ctx.sleep(1100);
  return ok;
}
