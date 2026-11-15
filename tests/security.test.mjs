import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/worker.js";
import { makeEnv, client, KEY } from "./helpers.mjs";
import { encryptToken, decryptToken } from "../src/infrastructure/security/tokenCrypto.js";
import { D1UserRepository } from "../src/infrastructure/repositories/D1UserRepository.js";
import { CSP, renderHeadersFile } from "../src/infrastructure/security/headers.js";
import { readFileSync } from "node:fs";

const PASS = "Una-clave-larga-9";
const register = (c, id = "ana", password = PASS) => c.call("POST", "/api/auth/register", { accountId: id, password, acceptTerms: true });
const login = (c, id = "ana", password = PASS) => c.call("POST", "/api/auth/login", { accountId: id, password });

test("registro: rechaza contraseñas comunes, cortas o iguales al Id", async () => {
  const env = makeEnv(); const c = client(app, env);
  for (const password of ["12345678", "Password", "corta1", "ana"]) {
    assert.equal((await register(c, "ana", password)).status, 400, password);
  }
  assert.equal((await register(c, "ana", "ana12345")).status, 201);
});

test("registro: rechaza Ids con caracteres invisibles", async () => {
  const c = client(app, makeEnv());
  assert.equal((await register(c, "an​a")).status, 400);
  assert.equal((await register(c, "an\u0000a")).status, 400);
});

test("login: mismo mensaje para Id inexistente y contraseña errónea", async () => {
  const env = makeEnv(); const c = client(app, env);
  await register(c);
  const a = await login(c, "nadie", "xxxxxxxxxx");
  const b = await login(c, "ana", "otra-clave-mala");
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.deepEqual(await a.json(), await b.json());
});

test("login: tras 6 fallos bloquea, incluso con la contraseña buena", async () => {
  const env = makeEnv(); const c = client(app, env);
  await register(c);
  for (let i = 0; i < 6; i++) assert.equal((await login(c, "ana", "mala-" + i)).status, 401);
  const blocked = await login(c, "ana", PASS);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
});

test("login: el bloqueo de una IP no afecta a otra IP con la contraseña buena", async () => {
  const env = makeEnv(); const a = client(app, env, { ip: "9.9.9.9" }); const b = client(app, env, { ip: "8.8.8.8" });
  await register(a);
  for (let i = 0; i < 6; i++) await login(a, "ana", "mala-" + i);
  assert.equal((await login(a, "ana", PASS)).status, 429);
  assert.equal((await login(b, "ana", PASS)).status, 200);
});

test("sesión: cookie __Host-sid con Secure/HttpOnly/SameSite y rotación al entrar", async () => {
  const env = makeEnv(); const c = client(app, env);
  await register(c);
  c.cookie = "__Host-sid=" + "a".repeat(64); // identificador que el atacante conocía
  await env.SESSIONS.put("a".repeat(64), JSON.stringify({}));
  const res = await login(c);
  const set = res.headers.get("Set-Cookie");
  assert.match(set, /^__Host-sid=[a-f0-9]{64};/);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) assert.ok(set.includes(flag), flag);
  assert.ok(!set.includes("Domain"));
  assert.ok(!set.includes("a".repeat(64)), "debe ser un identificador nuevo");
  assert.equal(await env.SESSIONS.get("a".repeat(64)), null, "el antiguo se borra");
});

test("sesión: un identificador de 32 caracteres (formato antiguo) ya no vale", async () => {
  const env = makeEnv(); const c = client(app, env);
  await env.SESSIONS.put("b".repeat(32), JSON.stringify({ accountId: "ana" }));
  c.cookie = "__Host-sid=" + "b".repeat(32);
  const res = await c.call("GET", "/api/auth/session");
  assert.equal((await res.json()).loggedIn, false);
});

test("CSRF: POST desde otro origen se rechaza; el mismo origen pasa", async () => {
  const env = makeEnv(); const c = client(app, env);
  const evil = await c.call("POST", "/api/auth/login", { accountId: "a", password: "b" }, { Origin: "https://evil.test" });
  assert.equal(evil.status, 403);
  const site = await c.call("POST", "/api/auth/login", { accountId: "a", password: "b" }, { Origin: "", "Sec-Fetch-Site": "cross-site" });
  assert.equal(site.status, 403);
  assert.equal((await c.call("POST", "/api/auth/login", { accountId: "a", password: "b" })).status, 401);
});

test("cabeceras: CSP sin unsafe-inline, HSTS, nosniff, no-store en la API", async () => {
  const c = client(app, makeEnv());
  const api = await c.call("GET", "/api/auth/session");
  assert.equal(api.headers.get("Cache-Control"), "no-store");
  assert.equal(api.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(api.headers.get("Strict-Transport-Security"), /max-age=\d+/);
  const page = await c.call("GET", "/");
  assert.equal(page.headers.get("Content-Security-Policy"), CSP);
  assert.ok(!CSP.includes("unsafe-inline") && !CSP.includes("unsafe-eval"));
  assert.equal(page.headers.get("X-Frame-Options"), "DENY");
});

test("public/_headers coincide con la fuente de verdad", () => {
  assert.equal(readFileSync(new URL("../public/_headers", import.meta.url), "utf8"), renderHeadersFile());
});

test("HTML: sin estilos en línea ni scripts de terceros", () => {
  for (const f of ["index", "quiz", "share", "games", "privacidad", "cookies", "terminos"]) {
    const html = readFileSync(new URL(`../public/${f}.html`, import.meta.url), "utf8");
    assert.ok(!/\sstyle=/.test(html), `${f}.html tiene style=""`);
    assert.ok(!/<style[\s>]/.test(html), `${f}.html tiene <style>`);
    assert.ok(!/<script[^>]+src="https?:/i.test(html), `${f}.html carga un script externo`);
    assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/i.test(html), `${f}.html tiene script en línea`);
  }
});

async function loggedIn(env, ip) {
  const c = client(app, env, { ip });
  await register(c); await login(c);
  return c;
}

test("OAuth: el state es aleatorio (no el Id de cuenta) y se guarda en la sesión", async () => {
  const env = makeEnv(); const c = await loggedIn(env);
  const res = await c.call("GET", "/api/spotify/login");
  assert.equal(res.status, 302);
  const state = new URL(res.headers.get("Location")).searchParams.get("state");
  assert.match(state, /^[a-f0-9]{64}$/);
  assert.notEqual(state, "ana");
});

test("OAuth: callback con state falso o sin sesión no guarda tokens", async () => {
  const env = makeEnv(); const c = await loggedIn(env);
  const realFetch = globalThis.fetch; let tokenCalls = 0;
  globalThis.fetch = async () => { tokenCalls++; return new Response(JSON.stringify({ access_token: "A", refresh_token: "R", expires_in: 3600 })); };
  try {
    await c.call("GET", "/api/spotify/login");
    // ataque clásico: state = Id de la víctima
    let res = await c.call("GET", "/api/spotify/callback?code=x&state=ana");
    assert.match(res.headers.get("Location"), /spotify_error/);
    // sin sesión
    const anon = client(app, env);
    res = await anon.call("GET", "/api/spotify/callback?code=x&state=ana");
    assert.match(res.headers.get("Location"), /spotify_error/);
    assert.equal(tokenCalls, 0, "no debe pedir tokens a Spotify");
    assert.equal(env.DB.sqlite.prepare("SELECT spotify_access_token a FROM users").get().a, null);
  } finally { globalThis.fetch = realFetch; }
});

test("OAuth: flujo correcto vincula la cuenta de la sesión, cifra los tokens y el state es de un solo uso", async () => {
  const env = makeEnv({ TOKEN_ENCRYPTION_KEY: KEY }); const c = await loggedIn(env);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: "ACCESS-123", refresh_token: "REFRESH-456", expires_in: 3600 }));
  try {
    const login = await c.call("GET", "/api/spotify/login");
    const state = new URL(login.headers.get("Location")).searchParams.get("state");
    const ok = await c.call("GET", `/api/spotify/callback?code=x&state=${state}`);
    assert.equal(ok.headers.get("Location"), "/?spotify_linked=1");
    const row = env.DB.sqlite.prepare("SELECT spotify_access_token a, spotify_refresh_token r FROM users").get();
    assert.match(row.a, /^enc1:/); assert.match(row.r, /^enc1:/);
    assert.ok(!JSON.stringify(row).includes("ACCESS-123") && !JSON.stringify(row).includes("REFRESH-456"));
    const again = await c.call("GET", `/api/spotify/callback?code=x&state=${state}`);
    assert.match(again.headers.get("Location"), /spotify_error/, "el state no se reutiliza");
    const session = await (await c.call("GET", "/api/auth/session")).json();
    assert.equal(session.hasSpotifyLinked, true);
  } finally { globalThis.fetch = realFetch; }
});

test("cifrado: ida y vuelta, y un valor copiado a otra cuenta no se descifra", async () => {
  const enc = await encryptToken("secreto", KEY, "ana");
  assert.equal(await decryptToken(enc, KEY, "ana"), "secreto");
  await assert.rejects(decryptToken(enc, KEY, "bea"));
  await assert.rejects(decryptToken(enc.slice(0, -4) + "AAAA", KEY, "ana"));
  assert.equal(await decryptToken("en-claro", KEY, "ana"), "en-claro");
});

test("cifrado: tokens antiguos en claro se leen y se cifran solos", async () => {
  const env = makeEnv();
  env.DB.sqlite.prepare("INSERT INTO users (account_id,password_hash,spotify_access_token,spotify_refresh_token,spotify_expires_at) VALUES ('ana','x','OLD-A','OLD-R',123)").run();
  const repo = new D1UserRepository(env.DB, KEY);
  const user = await repo.findByAccountId("ana");
  assert.deepEqual(user.spotifyTokens, { accessToken: "OLD-A", refreshToken: "OLD-R", expiresAt: 123 });
  const row = env.DB.sqlite.prepare("SELECT spotify_access_token a FROM users").get();
  assert.match(row.a, /^enc1:/);
  assert.equal((await repo.findByAccountId("ana")).spotifyTokens.accessToken, "OLD-A");
});

test("cifrado: con clave equivocada la cuenta aparece sin Spotify vinculado (sin romperse)", async () => {
  const env = makeEnv();
  env.DB.sqlite.prepare("INSERT INTO users (account_id,password_hash) VALUES ('ana','x')").run();
  await new D1UserRepository(env.DB, KEY).saveSpotifyTokens("ana", { accessToken: "A", refreshToken: "R", expiresAt: 1 });
  const other = Buffer.alloc(32, 9).toString("base64");
  assert.equal((await new D1UserRepository(env.DB, other).findByAccountId("ana")).spotifyTokens, null);
});

test("avatar: SVG y tipos raros se rechazan, PNG pasa", async () => {
  const env = makeEnv(); const c = await loggedIn(env);
  const svg = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
  assert.equal((await c.call("POST", "/api/avatar", { avatarBase64: svg })).status, 400);
  assert.equal((await c.call("POST", "/api/avatar", { avatarBase64: { x: 1 } })).status, 400);
  assert.equal((await c.call("POST", "/api/avatar", { avatarBase64: "data:image/png;base64,iVBORw0KGgo=" })).status, 200);
});

test("quiz: resultados imposibles se rechazan", async () => {
  const env = makeEnv(); const c = await loggedIn(env);
  for (const body of [
    { artistName: "x", timeMs: 1, correctAnswers: 10 },
    { artistName: "x", timeMs: 5000, correctAnswers: 99 },
    { artistName: "x".repeat(500), timeMs: 5000, correctAnswers: 10 },
    { artistName: "x", timeMs: "5000", correctAnswers: 10 },
  ]) assert.equal((await c.call("POST", "/api/quiz/result", body)).status, 400, JSON.stringify(body));
  assert.equal((await c.call("POST", "/api/quiz/result", { artistName: "x", timeMs: 45000, correctAnswers: 10 })).status, 200);
});

test("borrar cuenta: la contraseña errónea se limita a 5 intentos", async () => {
  const env = makeEnv(); const c = await loggedIn(env);
  for (let i = 0; i < 5; i++) assert.equal((await c.call("POST", "/api/auth/delete", { password: "mala" + i })).status, 403);
  assert.equal((await c.call("POST", "/api/auth/delete", { password: PASS })).status, 429);
});

test("compartir: id de 128 bits y formatos raros dan 404", async () => {
  const c = client(app, makeEnv());
  assert.equal((await c.call("GET", "/api/share/'; DROP TABLE users;--")).status, 404);
  assert.equal((await c.call("GET", "/api/share/zzzz")).status, 404);
});
