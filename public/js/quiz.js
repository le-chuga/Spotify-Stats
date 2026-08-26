/**
 * quiz.js — Lógica del modo "Guess the Song"
 * Separado del HTML para mantener una arquitectura limpia.
 * Usa la iTunes Search API para búsqueda de artistas y previews de audio.
 */

// ═══════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ═══════════════════════════════════════════════════════
let selectedArtist = null;
let quizTracks = [];
let currentQ = 0;
let timerInterval = null;
let startTime = 0;
let elapsedMs = 0;
let correctCount = 0;
let currentAudio = null;

// ═══════════════════════════════════════════════════════
//  FONDO ANIMADO: artistas famosos como mosaico
// ═══════════════════════════════════════════════════════
const BACKGROUND_ARTISTS = [
  "Taylor Swift", "Bad Bunny", "Drake", "The Weeknd", "Billie Eilish",
  "Kendrick Lamar", "Doja Cat", "Post Malone", "Ariana Grande", "Ed Sheeran",
  "Harry Styles", "SZA", "Olivia Rodrigo", "Morgan Wallen", "Travis Scott",
  "Peso Pluma", "Karol G", "Lil Durk", "21 Savage", "Metro Boomin",
];

async function loadSearchBackground() {
  const bg = document.getElementById("search-bg");
  for (const name of BACKGROUND_ARTISTS.slice(0, 15)) {
    try {
      // Usamos entity=song porque artworkUrl100 de álbumes carga siempre,
      // mientras que en entity=musicArtist frecuentemente viene vacío.
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=1`
      );
      const data = await res.json();
      const track = data.results.find((r) => r.wrapperType === "track" && r.artworkUrl100);
      if (track?.artworkUrl100) {
        const img = document.createElement("img");
        img.src = track.artworkUrl100.replace("100x100", "400x400");
        img.alt = "";
        bg.appendChild(img);
      }
    } catch { /* ignorar errores individuales */ }
  }
}

// ═══════════════════════════════════════════════════════
//  BÚSQUEDA DE ARTISTAS (iTunes Search API)
// ═══════════════════════════════════════════════════════
const searchInput = document.getElementById("artist-search-input");
const searchResults = document.getElementById("search-results");
let searchTimeout = null;

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  if (q.length < 2) { searchResults.hidden = true; return; }
  searchTimeout = setTimeout(() => searchArtists(q), 350);
});

async function searchArtists(q) {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicArtist&limit=8`
    );
    const data = await res.json();
    renderSearchResults(data.results);
  } catch { searchResults.hidden = true; }
}

function renderSearchResults(results) {
  searchResults.innerHTML = "";
  if (!results.length) { searchResults.hidden = true; return; }
  results.forEach((r) => {
    const div = document.createElement("div");
    div.className = "search-result-item";
    const img = document.createElement("img");
    img.alt = "";

    // artworkUrl100 en entity=musicArtist viene vacío frecuentemente.
    // Usamos la URL si existe, si no dejamos un placeholder y la rellenamos al seleccionar.
    if (r.artworkUrl100) {
      img.src = r.artworkUrl100;
    } else {
      img.src = "";
      img.style.background = "#2a2d33";
    }

    const span = document.createElement("span");
    span.textContent = r.artistName;
    div.append(img, span);
    div.addEventListener("click", () => selectArtist(r));
    searchResults.appendChild(div);
  });
  searchResults.hidden = false;
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-input-wrap")) searchResults.hidden = true;
});

async function selectArtist(artist) {
  searchResults.hidden = true;
  searchInput.value = artist.artistName;

  // Intentar obtener imagen del artista; si artworkUrl100 viene vacío,
  // usamos la portada de su primera canción como representación visual.
  let imageUrl = artist.artworkUrl100?.replace("100x100", "300x300") || "";

  if (!imageUrl) {
    try {
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${artist.artistId}&entity=song&limit=1`
      );
      const data = await res.json();
      const firstTrack = data.results.find((r) => r.wrapperType === "track");
      if (firstTrack?.artworkUrl100) {
        imageUrl = firstTrack.artworkUrl100.replace("100x100", "300x300");
      }
    } catch { /* mantener vacío si falla */ }
  }

  selectedArtist = {
    name: artist.artistName,
    imageUrl,
    itunesArtistId: artist.artistId,
  };
  document.getElementById("modal-artist-img").src = selectedArtist.imageUrl;
  document.getElementById("modal-artist-name").textContent = selectedArtist.name;
  document.getElementById("modal-artist-meta").textContent = "Guess the Song";
  document.getElementById("quiz-artist-modal").hidden = false;
}

// ═══════════════════════════════════════════════════════
//  START → cargar canciones → cuenta atrás → juego
// ═══════════════════════════════════════════════════════
document.getElementById("btn-start-quiz").addEventListener("click", async () => {
  document.getElementById("quiz-artist-modal").hidden = true;
  const tracks = await fetchArtistTracks(selectedArtist.itunesArtistId);
  if (tracks.length < 4) {
    alert("No se encontraron suficientes canciones con preview. Prueba con otro artista.");
    document.getElementById("quiz-artist-modal").hidden = false;
    return;
  }
  quizTracks = shuffle(tracks).slice(0, 10);
  currentQ = 0;
  correctCount = 0;
  showScreen("countdown");
  startCountdown();
});

async function fetchArtistTracks(artistId) {
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=50`
  );
  const data = await res.json();
  return data.results
    .filter((r) => r.wrapperType === "track" && r.previewUrl)
    .map((r) => ({
      trackName: r.trackName,
      albumImg: r.artworkUrl100?.replace("100x100", "400x400") || "",
      previewUrl: r.previewUrl,
    }));
}

// ═══════════════════════════════════════════════════════
//  CUENTA ATRÁS 3 → 2 → 1 → GO!
// ═══════════════════════════════════════════════════════
function startCountdown() {
  const el = document.getElementById("countdown-number");
  let n = 3;
  el.textContent = n;

  const iv = setInterval(() => {
    n--;
    if (n > 0) {
      el.textContent = n;
      el.style.animation = "none";
      el.getBoundingClientRect();
      el.style.animation = "countPulse 0.9s ease-in-out";
    } else {
      clearInterval(iv);
      el.textContent = "GO!";
      setTimeout(() => {
        showScreen("game");
        startTime = Date.now();
        startTimer();
        showQuestion(0);
      }, 600);
    }
  }, 1000);
}

// ═══════════════════════════════════════════════════════
//  TIMER: MM:SS:MMM
// ═══════════════════════════════════════════════════════
function startTimer() {
  timerInterval = setInterval(() => {
    elapsedMs = Date.now() - startTime;
    document.getElementById("game-timer").textContent = formatTime(elapsedMs);
  }, 17);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function formatTime(ms) {
  const mins = Math.floor(ms / 60000).toString().padStart(2, "0");
  const secs = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
  const millis = Math.floor(ms % 1000).toString().padStart(3, "0");
  return `${mins}:${secs}:${millis}`;
}

// ═══════════════════════════════════════════════════════
//  PREGUNTA
// ═══════════════════════════════════════════════════════
function showQuestion(index) {
  if (index >= quizTracks.length) { endQuiz(); return; }

  document.getElementById("game-progress").textContent = `${index + 1} / 10`;
  const track = quizTracks[index];

  document.getElementById("game-album-img").src = track.albumImg;

  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  currentAudio = new Audio(track.previewUrl);
  currentAudio.volume = 0.8;
  currentAudio.play().catch(() => {});

  const wrongPool = quizTracks.filter((_, i) => i !== index);
  const wrongs = shuffle(wrongPool).slice(0, 3).map((t) => t.trackName);
  const options = shuffle([track.trackName, ...wrongs]);

  const container = document.getElementById("game-options");
  container.innerHTML = "";
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "game-option";
    btn.textContent = opt;
    btn.addEventListener("click", () =>
      handleAnswer(btn, opt, track.trackName, container)
    );
    container.appendChild(btn);
  });
}

function handleAnswer(clickedBtn, chosen, correct, container) {
  // Deshabilitar todos los botones inmediatamente
  container.querySelectorAll(".game-option").forEach((b) => (b.disabled = true));

  const isCorrect = chosen === correct;
  if (isCorrect) correctCount++;

  // Colorear: correcta en verde, la pulsada en rojo si era incorrecta
  container.querySelectorAll(".game-option").forEach((b) => {
    if (b.textContent === correct) b.classList.add("correct");
    else if (b === clickedBtn && !isCorrect) b.classList.add("wrong");
  });

  // Tanto si acierta como si falla, continúa a la siguiente pregunta tras 3 segundos
  setTimeout(() => {
    currentQ++;
    if (currentQ >= 10) endQuiz();
    else showQuestion(currentQ);
  }, 800);
}

// ═══════════════════════════════════════════════════════
//  FIN DEL QUIZ
// ═══════════════════════════════════════════════════════
async function endQuiz() {
  stopTimer();
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }

  try {
    await fetch("/api/quiz/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistName: selectedArtist.name,
        timeMs: elapsedMs,
        correctAnswers: correctCount,
      }),
    });
  } catch { /* continuar aunque falle el guardado */ }

  const lb = await fetch(
    `/api/quiz/leaderboard?artist=${encodeURIComponent(selectedArtist.name)}`
  );
  const lbData = await lb.json();
  showLeaderboard(lbData.leaderboard || []);
}

function showLeaderboard(leaderboard) {
  document.getElementById("lb-artist-title").textContent = selectedArtist.name;
  document.getElementById("lb-my-time").textContent = formatTime(elapsedMs);
  document.getElementById("lb-my-sub").textContent =
    correctCount === 10
      ? "¡10/10 correctas!"
      : `${correctCount}/10 correctas — necesitas 10/10 para entrar en el top`;

  const tbody = document.getElementById("lb-body");
  tbody.innerHTML = "";

  if (!leaderboard.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3" style="color:var(--muted);text-align:center;padding:20px;">
      Sé el primero en el leaderboard con 10/10
    </td>`;
    tbody.appendChild(tr);
  } else {
    leaderboard.forEach((row, i) => {
      const tr = document.createElement("tr");
      if (i === 0) tr.className = "lb-rank-1";
      else if (i === 1) tr.className = "lb-rank-2";
      else if (i === 2) tr.className = "lb-rank-3";
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
      tr.innerHTML = `
        <td>${medal}</td>
        <td>${row.account_id}</td>
        <td class="lb-time-cell">${formatTime(row.best_time)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  showScreen("leaderboard");
}

document.getElementById("btn-play-again").addEventListener("click", () => {
  showScreen("search");
});

// ═══════════════════════════════════════════════════════
//  UTILIDADES
// ═══════════════════════════════════════════════════════
function showScreen(name) {
  document.querySelectorAll(".quiz-screen").forEach((s) => (s.hidden = true));
  document.getElementById("screen-" + name).hidden = false;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Arrancar fondo al cargar
loadSearchBackground();
