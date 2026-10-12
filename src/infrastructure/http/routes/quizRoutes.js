import { Hono } from "hono";
import { getSession } from "../../session.js";

export const quizRoutes = new Hono();

// POST /api/quiz/result — guarda resultado
quizRoutes.post("/result", async (c) => {
  const { data } = await getSession(c);
  if (!data.accountId) return c.json({ success: false, error: "No autenticado" }, 401);
  const { artistName, timeMs, correctAnswers } = await c.req.json().catch(() => ({}));
  if (!artistName || timeMs == null || correctAnswers == null) {
    return c.json({ success: false, error: "Datos incompletos" }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO quiz_leaderboard (account_id, artist_name, time_ms, correct_answers)
     VALUES (?, ?, ?, ?)`
  ).bind(data.accountId, artistName, timeMs, correctAnswers).run();
  return c.json({ success: true });
});

// GET /api/quiz/leaderboard?artist=X — top 20 para un artista
quizRoutes.get("/leaderboard", async (c) => {
  const artist = c.req.query("artist");
  if (!artist) return c.json({ success: false, error: "Falta artist" }, 400);
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
