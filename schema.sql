-- Schema para Cloudflare D1
-- Ejecutar con: wrangler d1 execute frecuencia-db --file=schema.sql

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

CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);

CREATE TABLE IF NOT EXISTS quiz_leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  time_ms INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leaderboard ON quiz_leaderboard(artist_name, time_ms);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  avatar_base64 TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Top con amigos: un enlace de invitación por usuario y amistades mutuas (una fila por sentido)
CREATE TABLE IF NOT EXISTS friend_invites (
  code TEXT PRIMARY KEY,
  account_id TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS friendships (
  account_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, friend_id)
);
