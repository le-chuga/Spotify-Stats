/**
 * ¿Mayor o menor? Suena un acorde: ¿suena alegre (mayor) o triste (menor)?
 * Las primeras rondas suenan en bloque; las últimas, nota a nota (más difícil).
 * Todos los jugadores oyen los mismos acordes.
 */
import { h, seeded, newSeed, icon } from "./dom.js";
import { tone, midiToFreq, buzz, chime } from "./audio.js";

const ROUNDS = 10;
const BLOCK_ROUNDS = 5; // las primeras suenan en bloque, el resto arpegiadas

export default {
  id: "chord",
  name: "¿Mayor o menor?",
  tagline: "¿Suena alegre o triste? Adivina el tipo de acorde.",
  icon: '<circle cx="84" cy="176" r="28"/><circle cx="172" cy="148" r="28"/><path d="M112 176V60l88-24v112"/>',
  duration: "2-4 min",
  rules: `Sonará un acorde. Di si es mayor (suena alegre) o menor (suena triste). Son ${ROUNDS} rondas: las ${BLOCK_ROUNDS} primeras suenan en bloque y las demás nota a nota, que es más difícil. Puedes volver a escucharlo cuantas veces quieras. Gana quien acierte más.`,
  format: (n) => `${n} / ${ROUNDS}`,

  async run(ctx) {
    const rng = seeded(newSeed());
    const rounds = Array.from({ length: ROUNDS }, (_, i) => ({
      root: 48 + Math.floor(rng() * 12), // Do3 … Si3
      major: rng() < 0.5,
      arpeggio: i >= BLOCK_ROUNDS,
    }));
    const scores = [];

    for (let p = 0; p < ctx.players.length; p++) {
      ctx.setTurn(p);
      await ctx.gate(p, `Acierta si el acorde es mayor o menor (${ROUNDS} rondas).`);
      let correct = 0;
      for (let r = 0; r < rounds.length; r++) {
        if (await playRound(ctx, rounds[r], r)) correct++;
        ctx.setScore(p, correct);
      }
      scores.push(correct);
      await ctx.pause({
        title: `${correct} / ${ROUNDS}`,
        text: correct === ROUNDS ? "¡Qué oído!" : "Se acabó tu turno.",
        button: p < ctx.players.length - 1 ? "Siguiente jugador" : "Ver resultados",
      });
    }
    return scores;
  },
};

/** Suena el acorde y devuelve los ms hasta que termina. */
function playChord(round) {
  const notes = [round.root, round.root + (round.major ? 4 : 3), round.root + 7];
  if (round.arpeggio) {
    notes.forEach((n, i) => tone(midiToFreq(n), { dur: 0.5, type: "sine", gain: 0.28, delay: i * 0.45 }));
    return 1500;
  }
  notes.forEach((n) => tone(midiToFreq(n), { dur: 1.2, type: "sine", gain: 0.2 }));
  return 1300;
}

async function playRound(ctx, round, index) {
  const status = h("p", { class: "game-status", role: "status" }, `Ronda ${index + 1} de ${ROUNDS} · escucha…`);
  const bar = h("div", { class: "round-bar", "aria-hidden": "true" },
    Array.from({ length: ROUNDS }, (_, i) => h("span", { class: i < index ? "is-done" : i === index ? "is-now" : "" })));
  const replay = h("button", { type: "button", class: "btn btn--outline" }, icon('<path d="M40 128h24l40-40v80l-40-40"/><path d="M148 100a40 40 0 0 1 0 56M172 80a72 72 0 0 1 0 96"/>'), " Volver a escuchar");
  const major = h("button", { type: "button", class: "btn btn--primary btn--lg", disabled: true }, "☀ Mayor");
  const minor = h("button", { type: "button", class: "btn btn--primary btn--lg", disabled: true }, "☁ Menor");
  ctx.show(h("div", { class: "game-card-view" }, bar, status, replay, h("div", { class: "answer-row" }, minor, major)));

  const answer = new Promise((resolve) => {
    major.addEventListener("click", () => resolve(true));
    minor.addEventListener("click", () => resolve(false));
  });

  const setBusy = (busy) => { major.disabled = minor.disabled = replay.disabled = busy; };
  const listen = async () => {
    setBusy(true);
    await ctx.sleep(300);
    const ms = playChord(round);
    await ctx.sleep(ms);
    setBusy(false);
    status.textContent = "¿El acorde es mayor o menor?";
    ctx.say(status.textContent);
  };
  replay.addEventListener("click", listen);
  listen();

  const saidMajor = await answer;
  setBusy(true);
  const ok = saidMajor === round.major;
  (ok ? chime : buzz)();
  status.textContent = ok ? "¡Correcto!" : `Era ${round.major ? "mayor" : "menor"}`;
  status.classList.add(ok ? "is-good" : "is-bad");
  ctx.say(status.textContent);
  await ctx.sleep(1100);
  return ok;
}
