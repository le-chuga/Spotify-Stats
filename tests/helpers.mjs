// Entorno de pruebas: D1 sobre node:sqlite, KV en memoria y ASSETS de mentira.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function makeDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const stmt = (sql, binds = []) => ({
    bind: (...b) => stmt(sql, b),
    first: async () => sqlite.prepare(sql).get(...binds) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...binds) }),
    run: async () => { sqlite.prepare(sql).run(...binds); return { success: true }; },
  });
  return {
    sqlite,
    prepare: (sql) => stmt(sql),
    batch: async (list) => { for (const s of list) await s.run(); return []; },
  };
}

export function makeKv() {
  const map = new Map();
  return { map, get: async (k) => map.get(k) ?? null, put: async (k, v) => void map.set(k, v), delete: async (k) => void map.delete(k) };
}

export function makeEnv(extra = {}) {
  return {
    DB: makeDb(),
    SESSIONS: makeKv(),
    ASSETS: { fetch: async () => new Response("<html></html>", { headers: { "Content-Type": "text/html" } }) },
    SPOTIFY_CLIENT_ID: "client-id",
    SPOTIFY_CLIENT_SECRET: "client-secret",
    SPOTIFY_REDIRECT_URI: "https://app.test/api/spotify/callback",
    ...extra,
  };
}

export const KEY = Buffer.alloc(32, 7).toString("base64");
const ORIGIN = "https://app.test";

/** Cliente mínimo con cookie jar. */
export function client(app, env, { ip = "1.2.3.4" } = {}) {
  let cookie = "";
  const call = async (method, path, body, headers = {}) => {
    const res = await app.request(ORIGIN + path, {
      method,
      headers: { Origin: ORIGIN, "CF-Connecting-IP": ip, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    }, env);
    const set = res.headers.get("Set-Cookie");
    if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    return res;
  };
  return { call, get cookie() { return cookie; }, set cookie(v) { cookie = v; } };
}
