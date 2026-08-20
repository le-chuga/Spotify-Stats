const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const DB_DIR = path.join(__dirname, "..", "..", "..", "data");
const DB_FILE = path.join(DB_DIR, "app.sqlite");

let SQL = null;
let dbInstance = null;

/**
 * Persiste el contenido actual de la base de datos en disco.
 * sql.js trabaja en memoria, así que tras cada escritura
 * volcamos los bytes al fichero .sqlite para que sea persistente
 * entre reinicios del servidor.
 */
function persist() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

/**
 * Crea (si no existen) las tablas necesarias para la aplicación.
 * Este es el "script de creación de la base de datos" que se ejecuta
 * al arrancar la página/servidor.
 */
function runMigrations(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      spotify_access_token TEXT,
      spotify_refresh_token TEXT,
      spotify_expires_at INTEGER,
      avatar_base64 TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migración: añadir columna avatar si no existe (para BDs ya creadas)
  try { db.run(`ALTER TABLE users ADD COLUMN avatar_base64 TEXT;`); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS quiz_leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      correct_answers INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_leaderboard ON quiz_leaderboard(artist_name, time_ms);`);

  db.run(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      avatar_base64 TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Inicializa la base de datos: carga sql.js (WASM), abre/crea el fichero
 * y ejecuta las migraciones. Debe llamarse una sola vez al arrancar el servidor.
 * @returns {Promise<import('sql.js').Database>}
 */
async function initDatabase() {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
    console.log(`[DB] Base de datos cargada desde ${DB_FILE}`);
  } else {
    dbInstance = new SQL.Database();
    console.log(`[DB] Nueva base de datos creada en memoria`);
  }

  runMigrations(dbInstance);
  persist();

  console.log("[DB] Migraciones aplicadas correctamente (tabla 'users' lista)");

  return dbInstance;
}

/**
 * Devuelve la instancia activa de la base de datos.
 * Lanza error si initDatabase() no se ha llamado antes.
 */
function getDatabase() {
  if (!dbInstance) {
    throw new Error("La base de datos no está inicializada. Llama a initDatabase() primero.");
  }
  return dbInstance;
}

module.exports = { initDatabase, getDatabase, persist, DB_FILE };
