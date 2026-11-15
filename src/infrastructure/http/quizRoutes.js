import { Hono } from "hono";
import { getSession } from "../session.js";
import { enforce, RULES } from "../security/rateLimit.js";

export const quizRoutes = new Hono();

// POST /api/quiz/result — guarda resultado
quizRoutes.post("/result", async (c) => {
  const { data } = await getSession(c);
  if (!data.accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  const { artistName, timeMs, correctAnswers } = await c.req.json().catch(() => ({}));
  if (!artistName || timeMs == null || correctAnswers == null) {
    return c.json({ success: false, error: "Datos incompletos" }, 400);
  }
  // El servidor no ve las respuestas, así que solo puede descartar valores imposibles
  if (
    typeof artistName !== "string" || artistName.trim().length === 0 || artistName.length > 100 ||
    !Number.isInteger(timeMs) || timeMs < 2000 || timeMs > 3_600_000 ||
    !Number.isInteger(correctAnswers) || correctAnswers < 0 || correctAnswers > 10
  ) {
    return c.json({ success: false, error: "Datos no válidos" }, 400);
  }
  const limited = await enforce(c, `quiz:${data.accountId}`, RULES.quizResult, "resultados");
  if (limited) return limited;
  await c.env.DB.prepare(
    `INSERT INTO quiz_leaderboard (account_id, artist_name, time_ms, correct_answers)
     VALUES (?, ?, ?, ?)`
  ).bind(data.accountId, artistName, timeMs, correctAnswers).run();
  return c.json({ success: true });
});

// GET /api/quiz/leaderboard?artist=X — top 20 para un artista
quizRoutes.get("/leaderboard", async (c) => {
  const artist = c.req.query("artist");
  if (!artist || artist.length > 100) return c.json({ success: false, error: "Falta artist" }, 400);
  const { results } = await c.env.DB.prepare(
    `SELECT account_id, MIN(time_ms) as best_time, correct_answers
     FROM quiz_leaderboard
     WHERE artist_name = ? AND correct_answers = 10
     GROUP BY account_id
     ORDER BY best_time ASC
     LIMIT 20`
  ).bind(artist).all();
  return c.json({ success: true, leaderboard: results });
});
