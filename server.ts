import dotenv from "dotenv";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  brandKitHandler,
  chatHandler,
  healthHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  postsHandler,
  pushSubscribeHandler,
  registerHandler,
  runRemindersHandler,
  stateHandler,
  suggestCopyHandler,
  syncSheetsHandler,
} from "./shared/handlers";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", healthHandler);
app.get("/api/auth/me", meHandler);
app.post("/api/auth/register", registerHandler);
app.post("/api/auth/login", loginHandler);
app.post("/api/auth/logout", logoutHandler);
app.get("/api/state", stateHandler);
app.put("/api/brand-kit", brandKitHandler);
app.post("/api/posts", postsHandler);
app.patch("/api/posts", postsHandler);
app.get("/api/sync-sheets", syncSheetsHandler);
app.post("/api/sync-sheets", syncSheetsHandler);
app.post("/api/suggest-copy", suggestCopyHandler);
app.post("/api/chat", chatHandler);
app.post("/api/push-subscribe", pushSubscribeHandler);
app.get("/api/run-reminders", runRemindersHandler);
app.post("/api/run-reminders", runRemindersHandler);

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
