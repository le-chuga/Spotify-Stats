/**
 * Simón musical: repite la melodía que suena. Cada ronda añade una nota.
 * Todos los jugadores reciben la misma melodía; gana quien repite más notas.
 */
import { h, seeded, newSeed } from "./dom.js";
import { tone, buzz } from "./audio.js";

const PADS = [
  { name: "Do", freq: 261.63 },
  { name: "Mi", freq: 329.63 },
  { name: "Sol", freq: 392.0 },
  { name: "Do agudo", freq: 523.25 },
];
const MAX_NOTES = 40;

export default {
  id: "simon",
  name: "Simón musical",
  tagline: "Escucha la melodía y repítela sin fallar.",
  icon: '<rect x="40" y="40" width="68" height="68" rx="14"/><rect x="148" y="40" width="68" height="68" rx="14"/><rect x="40" y="148" width="68" height="68" rx="14"/><rect x="148" y="148" width="68" height="68" rx="14"/>',
  duration: "3-6 min",
  rules: "Sonará una melodía de notas de colores. Cuando acabe, repítela pulsando las mismas notas (o las teclas 1 a 4). Cada acierto añade una nota más. En cuanto fallas, pasa el turno. Gana quien repita más notas.",
  format: (n) => `${n} ${n === 1 ? "nota" : "notas"}`,

  async run(ctx) {
    const rng = seeded(newSeed());
    const sequence = Array.from({ length: MAX_NOTES }, () => Math.floor(rng() * PADS.length));
    const scores = [];

    for (let p = 0; p < ctx.players.length; p++) {
      ctx.setTurn(p);
      await ctx.gate(p, "Repite la melodía lo más lejos que puedas.");
      const reached = await playTurn(ctx, sequence);
      scores.push(reached);
      ctx.setScore(p, reached);
      await ctx.pause({
        title: reached === 0 ? "Ni una nota…" : `${reached} ${reached === 1 ? "nota" : "notas"}`,
        text: reached >= MAX_NOTES ? "¡Te la sabías entera!" : "Se acabó tu turno.",
        button: p < ctx.players.length - 1 ? "Siguiente jugador" : "Ver resultados",
      });
    }
    return scores;
  },
};

async function playTurn(ctx, sequence) {
  const status = h("p", { class: "game-status", role: "status" });
  const padEls = PADS.map((pad, i) =>
    h("button", { type: "button", class: `pad pad--${i + 1}`, "data-pad": i, "aria-label": `${pad.name} (tecla ${i + 1})` },
      h("span", { class: "pad-name" }, pad.name),
      h("span", { class: "pad-key", "aria-hidden": "true" }, i + 1)
    )
  );
  const grid = h("div", { class: "pad-grid" }, padEls);
  ctx.show(h("div", { class: "game-card-view" }, status, grid));

  let accepting = false;
  let onPress = null;

  const light = async (i, ms) => {
    padEls[i].classList.add("is-lit");
    tone(PADS[i].freq, { dur: ms / 1000 + 0.1 });
    await ctx.sleep(ms);
    padEls[i].classList.remove("is-lit");
  };

  const press = (i) => {
    if (!accepting) return;
    light(i, 220);
    onPress?.(i);
  };

  grid.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-pad]");
    if (btn) { e.preventDefault(); press(Number(btn.dataset.pad)); }
  });
  // Teclado: Enter/Espacio sobre un botón (click sin puntero) y teclas 1-4
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pad]");
    if (btn && e.detail === 0) press(Number(btn.dataset.pad));
  });
  const onKey = (e) => {
    const i = "1234".indexOf(e.key);
    if (i >= 0 && !e.repeat) press(i);
  };
  document.addEventListener("keydown", onKey);
  ctx.onCleanup(() => document.removeEventListener("keydown", onKey));

  const listen = (n) =>
    new Promise((resolve) => {
      let step = 0;
      onPress = (i) => {
        if (i !== sequence[step]) { onPress = null; resolve(false); return; }
        step++;
        status.textContent = `Repite: ${step} de ${n}`;
        if (step === n) { onPress = null; resolve(true); }
      };
    });

  for (let n = 1; n <= sequence.length; n++) {
    accepting = false;
    status.textContent = `Escucha… (${n} ${n === 1 ? "nota" : "notas"})`;
    ctx.say(status.textContent);
    await ctx.sleep(700);
    const ms = Math.max(240, 500 - n * 12);
    for (let i = 0; i < n; i++) {
      await light(sequence[i], ms);
      await ctx.sleep(110);
    }
    status.textContent = `Tu turno: repite ${n === 1 ? "la nota" : `las ${n} notas`}`;
    ctx.say(status.textContent);
    accepting = true;
    const ok = await listen(n);
    accepting = false;
    if (!ok) {
      buzz();
      status.textContent = "¡Fallaste!";
      await ctx.sleep(900);
      return n - 1;
    }
    await ctx.sleep(450);
  }
  return sequence.length;
}
