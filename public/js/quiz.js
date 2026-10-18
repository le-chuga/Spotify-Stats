/**
 * quiz.js: Lógica del modo "Adivina la canción"
 * - Fotos de artistas: Deezer API (fotos reales de artistas, sin API key)
 * - Previews de audio: iTunes Search API (30s, gratuito)
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
//  BÚSQUEDA DE ARTISTAS
//  Usa Deezer para fotos reales + iTunes para el ID de artista
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
    // Usamos el proxy del servidor para evitar posibles bloqueos CORS
    const res = await fetch(
      `/api/deezer/artists?q=${encodeURIComponent(q)}`
    );
    const data = await res.json();
    renderSearchResults(data.data || []);
  } catch {
    searchResults.hidden = true;
  }
}

function renderSearchResults(results) {
  searchResults.innerHTML = "";
  if (!results.length) { searchResults.hidden = true; return; }

  results.forEach((r) => {
    const div = document.createElement("div");
    div.className = "search-result-item";

    const span = document.createElement("span");
    span.textContent = r.name;

    // picture_small es la foto real del artista en Deezer
    if (r.picture_small) {
      const img = document.createElement("img");
      img.src = r.picture_small;
      img.alt = "";
      div.append(img, span);
    } else {
      div.append(span);
    }
    div.addEventListener("click", () => selectArtist(r));
    searchResults.appendChild(div);
  });
  searchResults.hidden = false;
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-input-wrap")) searchResults.hidden = true;
});

async function selectArtist(deezerArtist) {
  searchResults.hidden = true;
  searchInput.value = deezerArtist.name;

  // Foto real del artista desde Deezer (picture_medium o picture_big)
  const imageUrl = deezerArtist.picture_medium || deezerArtist.picture_small || "";

  // Buscar el ID de iTunes del artista para los previews de audio
  let itunesArtistId = null;
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(deezerArtist.name)}&entity=musicArtist&limit=1`
    );
    const data = await res.json();
    if (data.results[0]) itunesArtistId = data.results[0].artistId;
  } catch { /* continuar sin ID, fetchArtistTracks buscará por nombre */ }

  selectedArtist = {
    name: deezerArtist.name,
    imageUrl,
    itunesArtistId,
  };

  const artistImg = document.getElementById("modal-artist-img");
  artistImg.hidden = !imageUrl;
  if (imageUrl) artistImg.src = imageUrl;
  document.getElementById("modal-artist-error").classList.remove("visible");
  document.getElementById("modal-artist-name").textContent = deezerArtist.name;
  document.getElementById("modal-artist-meta").textContent = "Guess the Song";
  document.getElementById("quiz-artist-modal").hidden = false;
}

// ═══════════════════════════════════════════════════════
//  START → cargar canciones → cuenta atrás → juego
// ═══════════════════════════════════════════════════════
const artistModal = document.getElementById("quiz-artist-modal");
const artistError = document.getElementById("modal-artist-error");
const startBtn = document.getElementById("btn-start-quiz");

startBtn.addEventListener("click", async () => {
  artistError.classList.remove("visible");
  startBtn.disabled = true;
  startBtn.textContent = "Cargando canciones…";

  let tracks = [];
  try {
    tracks = await fetchArtistTracks();
  } catch { /* se trata como "sin canciones" */ }

  startBtn.disabled = false;
  startBtn.textContent = "Start";

  if (tracks.length < 4) {
    artistError.textContent =
      "No encontramos suficientes canciones con preview de este artista. Prueba con otro.";
    artistError.classList.add("visible");
    return;
  }

  artistModal.hidden = true;
  quizTracks = shuffle(tracks).slice(0, 10);
  currentQ = 0;
  correctCount = 0;
  showScreen("countdown");
  startCountdown();
});

document.getElementById("btn-cancel-artist").addEventListener("click", () => {
  artistModal.hidden = true;
  searchInput.focus();
});

async function fetchArtistTracks() {
  // Buscar por ID si lo tenemos, si no por nombre
  let url;
  if (selectedArtist.itunesArtistId) {
    url = `https://itunes.apple.com/lookup?id=${selectedArtist.itunesArtistId}&entity=song&limit=50`;
  } else {
    url = `https://itunes.apple.com/search?term=${encodeURIComponent(selectedArtist.name)}&entity=song&limit=50`;
  }

  const res = await fetch(url);
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
  container.querySelectorAll(".game-option").forEach((b) => (b.disabled = true));

  const isCorrect = chosen === correct;
  if (isCorrect) correctCount++;

  container.querySelectorAll(".game-option").forEach((b) => {
    if (b.textContent === correct) b.classList.add("correct");
    else if (b === clickedBtn && !isCorrect) b.classList.add("wrong");
  });

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
      : `${correctCount}/10 correctas. Necesitas 10/10 para entrar en el top`;

  const tbody = document.getElementById("lb-body");
  tbody.replaceChildren();

  if (!leaderboard.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.className = "lb-empty";
    td.textContent = "Sé el primero en el ranking con 10/10.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    leaderboard.forEach((row, i) => {
      const tr = document.createElement("tr");
      if (i === 0) tr.className = "lb-rank-1";

      const rank = document.createElement("td");
      rank.className = "lb-rank";
      rank.textContent = String(i + 1);

      const user = document.createElement("td");
      user.textContent = row.account_id;

      const time = document.createElement("td");
      time.className = "lb-time-cell";
      time.textContent = formatTime(row.best_time);

      tr.append(rank, user, time);
      tbody.appendChild(tr);
    });
  }

  showScreen("leaderboard");
}

document.getElementById("btn-play-again").addEventListener("click", () => {
  searchInput.value = "";
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


