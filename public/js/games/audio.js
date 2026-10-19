/**
 * audio.js
 * Sonidos de los juegos generados con Web Audio: no hay archivos que descargar,
 * así que todo suena también sin conexión.
 * El navegador solo deja sonar tras un gesto del usuario: unlock() se llama
 * desde los botones "Empezar" / "Estoy listo".
 */
let ctx = null;

export function unlock() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    return null;
  }
  return ctx;
}

/** Frecuencia (Hz) de una nota MIDI (69 = La4 = 440 Hz). */
export const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** Una nota con ataque y caída suaves. `delay` en segundos desde ahora. */
export function tone(freq, { dur = 0.35, type = "triangle", gain = 0.25, delay = 0 } = {}) {
  const c = unlock();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Tic de metrónomo; el primer tiempo del compás suena más agudo. */
export function tick(accent = false, delay = 0) {
  tone(accent ? 1500 : 1000, { dur: 0.07, type: "square", gain: 0.12, delay });
}

/** Zumbido de error. */
export function buzz() {
  tone(120, { dur: 0.45, type: "sawtooth", gain: 0.18 });
}

/** Arpegio corto de acierto. */
export function chime() {
  [523.25, 659.25, 783.99].forEach((f, i) => tone(f, { dur: 0.25, gain: 0.16, delay: i * 0.09 }));
}
