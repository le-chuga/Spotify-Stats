const { getDatabase, persist } = require("../../db/database");

class QuizController {
  /** POST /api/quiz/result — guarda resultado al terminar el quiz */
  saveResult = (req, res) => {
    if (!req.session.accountId) {
      return res.status(401).json({ success: false, error: "No autenticado" });
    }
    const { artistName, timeMs, correctAnswers } = req.body || {};
    if (!artistName || timeMs == null || correctAnswers == null) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }

    const db = getDatabase();
    db.run(
      `INSERT INTO quiz_leaderboard (account_id, artist_name, time_ms, correct_answers)
       VALUES (:accountId, :artist, :time, :correct)`,
      {
        ":accountId": req.session.accountId,
        ":artist": artistName,
        ":time": timeMs,
        ":correct": correctAnswers,
      }
    );
    persist();
    return res.json({ success: true });
  };

  /** GET /api/quiz/leaderboard?artist=X — top 20 para un artista */
  getLeaderboard = (req, res) => {
    const { artist } = req.query;
    if (!artist) return res.status(400).json({ success: false, error: "Falta artist" });

    const db = getDatabase();
    // Un resultado por usuario: el mejor tiempo con 10 correctas
    const stmt = db.prepare(`
      SELECT account_id, MIN(time_ms) as best_time, correct_answers
      FROM quiz_leaderboard
      WHERE artist_name = :artist AND correct_answers = 10
      GROUP BY account_id
      ORDER BY best_time ASC
      LIMIT 20
    `);
    stmt.bind({ ":artist": artist });

    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();

    return res.json({ success: true, leaderboard: rows });
  };
}

module.exports = QuizController;
