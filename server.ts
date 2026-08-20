import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { app, ensureTablesInit } from "./server/app";
import { syncAllLocalToSupabase } from "./server/supabase";

async function startServer() {
  const PORT = 3000;

  // Initialize DB tables and sync all data on startup
  try {
    await ensureTablesInit();
    const syncResult = await syncAllLocalToSupabase();
    console.log(`[Startup Supabase Sync] ${syncResult.message}`);
  } catch (err) {
    console.warn('[Startup Supabase Sync] Warning during startup initialization:', err);
  }

  // Vite middleware for development vs Static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
