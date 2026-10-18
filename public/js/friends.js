/**
 * friends.js
 * "Top con amigos": enlace de invitación propio, lista de amigos y vista en directo
 * de las estadísticas de cada uno (se refrescan solas mientras la vista está abierta).
 * Todo el texto de otros usuarios y de Spotify se pinta con textContent.
 */
import { api } from "./api.js";
import { renderList, buildListItem } from "./list-item.js";
import { timeAgo } from "./format.js";

const REFRESH_MS = 20000;
const CODE_RE = /[a-f0-9]{18}/i;
const PENDING_KEY = "pendingFriendCode";

const $ = (id) => document.getElementById(id);
const el = {
  overlay: $("friends-modal-overlay"),
  main: $("friends-view-main"),
  detail: $("friends-view-detail"),
  invite: $("friends-invite-input"),
  copy: $("btn-friends-copy"),
  copyFeedback: $("friends-copy-feedback"),
  reset: $("btn-friends-reset"),
  joinForm: $("friends-join-form"),
  joinInput: $("friends-join-input"),
  joinBtn: $("btn-friends-join"),
  error: $("friends-error"),
  list: $("friends-list"),
  close: $("btn-friends-close"),
  avatar: $("friend-detail-avatar"),
  name: $("friend-detail-name"),
  live: $("friend-live-status"),
  detailError: $("friend-detail-error"),
  now: $("friend-now"),
  tracks: $("friend-top-tracks"),
  artists: $("friend-top-artists"),
  recent: $("friend-recent"),
  back: $("btn-friend-back"),
  remove: $("btn-friend-remove"),
};

let current = null; // amigo abierto en la vista de detalle
let timer = null;
let tick = null;
let fetchSeq = 0;
let lastFetchedAt = 0;

/* ---------- Utilidades ---------- */
function setMsg(node, text) {
  node.textContent = text || "";
  node.classList.toggle("visible", Boolean(text));
}

function showView(name) {
  el.main.hidden = name !== "main";
  el.detail.hidden = name !== "detail";
  const node = name === "main" ? el.main : el.detail;
  node.classList.remove("view-enter");
  void node.offsetWidth;
  node.classList.add("view-enter");
}

function fillAvatar(node, accountId, avatarBase64) {
  node.replaceChildren();
  if (avatarBase64) {
    const img = document.createElement("img");
    img.src = avatarBase64;
    img.alt = "";
    node.appendChild(img);
  } else {
    node.textContent = (accountId || "?").trim().charAt(0).toUpperCase();
  }
}

const inviteUrl = (code) => `${location.origin}/?amigo=${code}`;

/* ---------- Pantalla principal ---------- */
function renderFriends(friends) {
  el.list.replaceChildren();
  if (!friends.length) {
    const li = document.createElement("li");
    li.className = "stats-empty";
    li.textContent = "Todavía no tienes amigos añadidos. Comparte tu enlace para empezar.";
    el.list.appendChild(li);
    return;
  }
  friends.forEach((f) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "friend-row";
    const av = document.createElement("span");
    av.className = "friend-avatar";
    av.setAttribute("aria-hidden", "true");
    fillAvatar(av, f.accountId, null);
    const name = document.createElement("span");
    name.className = "friend-row__name";
    name.textContent = f.accountId;
    const go = document.createElement("span");
    go.className = "friend-row__go";
    go.textContent = "Ver en directo";
    btn.append(av, name, go);
    btn.addEventListener("click", () => openDetail(f));
    li.appendChild(btn);
    el.list.appendChild(li);
  });
}

async function loadMain() {
  try {
    const { ok, data } = await api.friends();
    if (!ok) return setMsg(el.error, data.error || "No se pudo cargar tu lista de amigos.");
    el.invite.value = inviteUrl(data.code);
    renderFriends(data.friends);
  } catch (err) {
    setMsg(el.error, "Error de red: " + err.message);
  }
}

export function openFriendsModal() {
  stopLive();
  el.joinInput.value = "";
  el.copyFeedback.textContent = "";
  el.invite.value = "";
  setMsg(el.error, "");
  showView("main");
  el.overlay.hidden = false;
  loadMain();
}

function closeModal() {
  stopLive();
  el.overlay.hidden = true;
}

async function joinWith(raw) {
  const code = (raw.match(CODE_RE) || [])[0];
  if (!code) {
    setMsg(el.error, "Ese enlace no parece una invitación válida.");
    return;
  }
  el.joinBtn.disabled = true;
  try {
    const { ok, data } = await api.joinFriend(code.toLowerCase());
    if (!ok) {
      setMsg(el.error, data.error || "No se pudo añadir al amigo.");
      return;
    }
    el.joinInput.value = "";
    setMsg(el.error, "");
    await loadMain();
  } catch (err) {
    setMsg(el.error, "Error de red: " + err.message);
  } finally {
    el.joinBtn.disabled = false;
  }
}

/** Si el usuario llegó con un enlace de invitación, lo acepta y abre la lista. */
export async function checkPendingInvite() {
  let code = null;
  try {
    code = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
  } catch {}
  if (!code) return;
  openFriendsModal();
  await joinWith(code);
}

/* ---------- Vista de un amigo en directo ---------- */
function stopLive() {
  clearTimeout(timer);
  clearInterval(tick);
  timer = tick = null;
  current = null;
  fetchSeq++;
}

function updateLiveLabel() {
  if (!lastFetchedAt) return;
  const secs = Math.max(0, Math.round((Date.now() - lastFetchedAt) / 1000));
  el.live.textContent = secs < 5 ? "En directo · actualizado ahora" : `En directo · actualizado hace ${secs} s`;
}

function renderNow(np) {
  el.now.hidden = !np;
  if (!np) return;
  el.now.replaceChildren();
  if (np.imageUrl) {
    const img = document.createElement("img");
    img.src = np.imageUrl;
    img.alt = "";
    el.now.appendChild(img);
  }
  const text = document.createElement("div");
  text.className = "item-text";
  const tag = document.createElement("p");
  tag.className = "friend-now__tag";
  tag.textContent = np.isPlaying ? "Escuchando ahora" : "En pausa";
  const title = document.createElement("p");
  title.className = "item-title";
  title.textContent = np.name;
  const sub = document.createElement("p");
  sub.className = "item-subtitle";
  sub.textContent = np.artist;
  text.append(tag, title, sub);
  el.now.appendChild(text);
  if (np.durationMs) {
    const bar = document.createElement("div");
    bar.className = "friend-now__bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.min(100, (np.progressMs / np.durationMs) * 100)}%`;
    bar.appendChild(fill);
    el.now.appendChild(bar);
  }
}

function renderStats(stats) {
  renderList(el.tracks, stats.topTracks, (t) =>
    buildListItem({ imageUrl: t.imageUrl, title: t.name, subtitle: t.artist }));
  renderList(el.artists, stats.topArtists, (a) =>
    buildListItem({ imageUrl: a.imageUrl, title: a.name, subtitle: (a.genres || []).slice(0, 2).join(", ") }));
  renderList(el.recent, stats.recentlyPlayed, (r) =>
    buildListItem({ imageUrl: r.imageUrl, title: r.name, subtitle: r.artist, meta: timeAgo(r.playedAt) }));
}

function scheduleRefresh(friend, mine) {
  timer = setTimeout(() => {
    if (mine !== fetchSeq) return;
    // Con la pestaña en segundo plano no se gastan peticiones: se reintenta pronto
    if (document.hidden) return scheduleRefresh(friend, mine);
    refreshDetail(friend);
  }, document.hidden ? 2000 : REFRESH_MS);
}

async function refreshDetail(friend) {
  const mine = ++fetchSeq;
  try {
    const { ok, data } = await api.friendStats(friend.accountId);
    if (mine !== fetchSeq) return;
    if (!ok) {
      setMsg(el.detailError, data.error || "No se pudieron cargar las estadísticas.");
    } else {
      fillAvatar(el.avatar, friend.accountId, data.friend.avatarBase64);
      if (!data.linked) {
        el.live.textContent = "";
        setMsg(el.detailError, `${friend.accountId} todavía no ha conectado Spotify.`);
        return;
      }
      setMsg(el.detailError, "");
      renderNow(data.nowPlaying);
      renderStats(data.stats);
      lastFetchedAt = data.fetchedAt;
      updateLiveLabel();
    }
  } catch (err) {
    if (mine !== fetchSeq) return;
    setMsg(el.detailError, "Error de red: " + err.message);
  }
  scheduleRefresh(friend, mine);
}

function openDetail(friend) {
  stopLive();
  current = friend;
  lastFetchedAt = 0;
  el.name.textContent = friend.accountId;
  fillAvatar(el.avatar, friend.accountId, null);
  el.live.textContent = "Conectando…";
  setMsg(el.detailError, "");
  el.now.hidden = true;
  [el.tracks, el.artists, el.recent].forEach((l) => l.replaceChildren());
  showView("detail");
  tick = setInterval(updateLiveLabel, 1000);
  refreshDetail(friend);
}

/* ---------- Eventos ---------- */
el.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(el.invite.value);
    el.copyFeedback.textContent = "¡Enlace copiado!";
  } catch {
    el.invite.select();
    el.copyFeedback.textContent = "Selecciona el enlace y cópialo.";
  }
  setTimeout(() => (el.copyFeedback.textContent = ""), 2000);
});

el.reset.addEventListener("click", async () => {
  if (!confirm("El enlace anterior dejará de funcionar. Tus amigos actuales se mantienen. ¿Continuar?")) return;
  const { ok, data } = await api.resetFriendInvite();
  if (ok) el.invite.value = inviteUrl(data.code);
  else setMsg(el.error, data.error || "No se pudo crear un enlace nuevo.");
});

el.joinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = el.joinInput.value.trim();
  if (!raw) return setMsg(el.error, "Pega el enlace que te ha pasado tu amigo.");
  await joinWith(raw);
});

el.back.addEventListener("click", () => {
  stopLive();
  showView("main");
  loadMain();
});

el.remove.addEventListener("click", async () => {
  if (!current) return;
  if (!confirm(`¿Quitar a ${current.accountId} de tus amigos? Dejaréis de veros las estadísticas.`)) return;
  const id = current.accountId;
  stopLive();
  await api.removeFriend(id);
  showView("main");
  loadMain();
});

el.close.addEventListener("click", closeModal);
el.overlay.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !el.overlay.hidden) closeModal();
});
