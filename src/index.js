require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const axios = require("axios");

// --- Infraestructura: Base de datos ---
const { initDatabase } = require("./infrastructure/db/database");
const SqliteUserRepository = require("./infrastructure/repositories/SqliteUserRepository");

// --- Infraestructura: Spotify ---
const SpotifyClient = require("./infrastructure/spotify/SpotifyClient");

// --- Aplicación: Casos de uso ---
const RegisterUserUseCase = require("./application/usecases/RegisterUserUseCase");
const LoginUserUseCase = require("./application/usecases/LoginUserUseCase");
const LinkSpotifyAccountUseCase = require("./application/usecases/LinkSpotifyAccountUseCase");
const GetSpotifyStatsUseCase = require("./application/usecases/GetSpotifyStatsUseCase");
const CreatePlaylistFromArtistsUseCase = require("./application/usecases/CreatePlaylistFromArtistsUseCase");
const AvatarUseCase = require("./application/usecases/AvatarUseCase");
const SnapshotUseCase = require("./application/usecases/SnapshotUseCase");

// --- Infraestructura: HTTP (controladores + rutas) ---
const AuthController = require("./infrastructure/http/controllers/AuthController");
const SpotifyController = require("./infrastructure/http/controllers/SpotifyController");
const AvatarController = require("./infrastructure/http/controllers/AvatarController");
const SnapshotController = require("./infrastructure/http/controllers/SnapshotController");
const QuizController = require("./infrastructure/http/controllers/QuizController");
const authRoutes = require("./infrastructure/http/routes/authRoutes");
const spotifyRoutes = require("./infrastructure/http/routes/spotifyRoutes");
const avatarRoutes = require("./infrastructure/http/routes/avatarRoutes");
const snapshotRoutes = require("./infrastructure/http/routes/snapshotRoutes");

// --- Infraestructura: Repositorios adicionales ---
const SqliteSnapshotRepository = require("./infrastructure/repositories/SqliteSnapshotRepository");

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  // 1) Inicializar la base de datos (crea las tablas si no existen)
  await initDatabase();

  // 2) Construir repositorios (implementaciones concretas de los puertos)
  const userRepository = new SqliteUserRepository();

  // 3) Construir clientes de servicios externos
  const spotifyClient = new SpotifyClient();

  // 4) Construir casos de uso, inyectando los puertos/repositorios
  const registerUserUseCase = new RegisterUserUseCase(userRepository);
  const loginUserUseCase = new LoginUserUseCase(userRepository);
  const linkSpotifyAccountUseCase = new LinkSpotifyAccountUseCase(userRepository, spotifyClient);
  const getSpotifyStatsUseCase = new GetSpotifyStatsUseCase(userRepository, spotifyClient);
  const createPlaylistFromArtistsUseCase = new CreatePlaylistFromArtistsUseCase(userRepository, spotifyClient);
  const avatarUseCase = new AvatarUseCase(userRepository);
  const snapshotRepository = new SqliteSnapshotRepository();
  const snapshotUseCase = new SnapshotUseCase(snapshotRepository, userRepository, spotifyClient);

  // 5) Construir controladores
  const authController = new AuthController(registerUserUseCase, loginUserUseCase, userRepository);
  const spotifyController = new SpotifyController(
    spotifyClient, linkSpotifyAccountUseCase, getSpotifyStatsUseCase, createPlaylistFromArtistsUseCase
  );
  const avatarController = new AvatarController(avatarUseCase);
  const snapshotController = new SnapshotController(snapshotUseCase);
  const quizController = new QuizController();

  // 6) Configurar Express
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  // Logger simple: muestra cada petición que llega al servidor (útil para depurar)
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "clave-secreta-de-desarrollo-cambia-esto",
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 día
    })
  );

  // Archivos estáticos del frontend
  app.use(express.static(path.join(__dirname, "..", "public")));

  // 7) Montar rutas
  app.use("/api/auth", authRoutes(authController));
  app.use("/api/spotify", spotifyRoutes(spotifyController));
  app.use("/api/avatar", avatarRoutes(avatarController));
  app.use("/api/share", snapshotRoutes(snapshotController));
  app.use("/api/quiz/result", (req, res, next) => {
    if (req.method === "POST") return quizController.saveResult(req, res);
    next();
  });
  app.use("/api/quiz/leaderboard", (req, res) => quizController.getLeaderboard(req, res));

  const os = require("os");

  function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
    return "127.0.0.1";
  }

  app.get("/api/server-info", (req, res) => {
    res.json({ ip: getLocalIP(), port: PORT });
  });

  // Proxy para Deezer: fotos reales de artistas sin problemas de CORS
  app.get("/api/deezer/artists", async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Falta q" });
    try {
      const response = await axios.get(
        `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=8`
      );
      res.json(response.data);
    } catch {
      res.status(500).json({ data: [] });
    }
  });
  app.get("/share/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "share.html"));
  });

  // Ruta del quiz
  app.get("/quiz", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "quiz.html"));
  });

  // Cualquier otra ruta sirve el index.html (SPA simple)
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`\n🎧 Servidor escuchando en http://localhost:${PORT}\n`);
  });
}

bootstrap().catch((err) => {
  console.error("Error fatal al arrancar la aplicación:", err);
  process.exit(1);
});
