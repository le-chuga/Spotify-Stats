/**
 * Mantén el pulso: suena un metrónomo y se calla; hay que seguir el mismo ritmo
 * dando toques. Se puntúa lo regular que sea cada intervalo respecto al tempo.
 */
import { h } from "./dom.js";
import { tick } from "./audio.js";

const TEMPOS = [90, 120]; // una ronda por tempo
const LEAD_IN = 4; // tics de metrónomo que se oyen antes
const TAPS = 8;

export default {
  id: "pulse",
  name: "Mantén el pulso",
  tagline: "Sigue el ritmo del metrónomo cuando se calle.",
  icon: '<path d="M96 216 120 40h16l24 176Z"/><path d="M128 176 176 64"/><path d="M84 216h88"/>',
  duration: "2-5 min",
  rules: `Oirás ${LEAD_IN} tics de metrónomo. Después se calla: da ${TAPS} toques en el círculo manteniendo el mismo ritmo. Hay dos rondas con tempos distintos y se puntúa de 0 a 100 lo constante que seas.`,
  format: (n) => `${n} pts`,

  async run(ctx) {
    const points = ctx.players.map(() => []);
    for (let r = 0; r < TEMPOS.length; r++) {
      for (let p = 0; p < ctx.players.length; p++) {
        ctx.setTurn(p);
        await ctx.gate(p, `Ronda ${r + 1} de ${TEMPOS.length} · ${TEMPOS[r]} pulsaciones por minuto`);
        const result = await playRound(ctx, TEMPOS[r]);
        points[p].push(result.points);
        ctx.setScore(p, average(points[p]));
        const last = r === TEMPOS.length - 1 && p === ctx.players.length - 1;
        await ctx.pause({
          title: `${result.points} / 100`,
          text: result.text,
          button: last ? "Ver resultados" : "Continuar",
        });
      }
    }
    return points.map(average);
  },
};

const average = (list) => Math.round(list.reduce((a, b) => a + b, 0) / list.length);

async function playRound(ctx, bpm) {
  const beat = 60000 / bpm;
  const status = h("p", { class: "game-status", role: "status" }, "Escucha el pulso…");
  const dots = h("div", { class: "tap-dots", "aria-hidden": "true" }, Array.from({ length: TAPS }, () => h("span")));
  const pad = h("button", { type: "button", class: "pulse-pad", disabled: true, "aria-label": "Tocar al ritmo" }, "Toca");
  ctx.show(h("div", { class: "game-card-view" }, status, pad, dots));

  // Metrónomo: audio programado con el reloj de audio, destellos con temporizadores
  for (let i = 0; i < LEAD_IN; i++) {
    tick(i === 0, (i * beat) / 1000 + 0.05);
    setTimeout(() => {
      pad.classList.add("is-beat");
      setTimeout(() => pad.classList.remove("is-beat"), 110);
    }, i * beat + 50);
  }
  await ctx.sleep(LEAD_IN * beat + 50);

  status.textContent = `Ahora tú: ${TAPS} toques al mismo ritmo`;
  ctx.say(status.textContent);
  pad.disabled = false;
  pad.focus({ preventScroll: true });

  const taps = await new Promise((resolve) => {
    let times = [];
    const hit = (t) => {
      // Si te quedas parado demasiado, se vuelve a empezar la cuenta
      if (times.length && t - times[times.length - 1] > beat * 2.2) {
        times = [];
        status.textContent = "Te quedaste parado: empieza otra vez";
      }
      times.push(t);
      tick(false);
      dots.childNodes.forEach((d, i) => d.classList.toggle("is-on", i < times.length));
      if (times.length === TAPS) resolve(times);
    };
    pad.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(e.timeStamp); });
    pad.addEventListener("click", (e) => { if (e.detail === 0) hit(performance.now()); });
  });
  pad.disabled = true;

  const gaps = taps.slice(1).map((t, i) => t - taps[i]);
  const meanErr = gaps.reduce((s, g) => s + Math.abs(g - beat), 0) / gaps.length;
  const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const points = Math.round(100 * Math.max(0, 1 - meanErr / (beat * 0.35)));

  const drift = meanGap - beat;
  let tendency = "Muy cerca del tempo.";
  if (drift > beat * 0.04) tendency = "Fuiste algo más lento que el metrónomo.";
  else if (drift < -beat * 0.04) tendency = "Fuiste algo más rápido que el metrónomo.";
  return { points, text: `Desvío medio de ${Math.round(meanErr)} ms por toque. ${tendency}` };
}
