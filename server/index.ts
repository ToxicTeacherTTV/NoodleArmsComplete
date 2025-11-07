import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { elevenlabsService } from "./services/elevenlabs";
import { discordBotService } from "./services/discordBot";
import { prometheusMetrics } from "./services/prometheusMetrics.js";
import { contextPrewarmer } from "./services/contextPrewarmer";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Normalize route to prevent cardinality explosion in metrics
function normalizeRoute(path: string): string {
  if (!path.startsWith("/api")) return "/";
  
  // Replace UUIDs and numeric IDs with placeholders
  let normalized = path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
  
  // Remove query strings
  const queryIndex = normalized.indexOf('?');
  if (queryIndex !== -1) {
    normalized = normalized.substring(0, queryIndex);
  }
  
  return normalized;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    // 📊 Track HTTP metrics with normalized route (prevent cardinality explosion)
    const normalizedRoute = normalizeRoute(path);
    prometheusMetrics.trackHttpRequest({
      method: req.method,
      route: normalizedRoute,
      status: res.statusCode,
      durationSeconds: duration / 1000
    });
    
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Unhandled application error:", err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Initialize voice settings and Discord bot with active profile
    try {
      const activeProfile = await storage.getActiveProfile();
      if (activeProfile && activeProfile.voiceId) {
        elevenlabsService.setVoiceId(activeProfile.voiceId);
        log(`🎵 Initialized voice: ${activeProfile.voiceId} for profile: ${activeProfile.name}`);
      }

      // Initialize Discord bot if token is available
      const discordToken = process.env.DISCORD_BOT_TOKEN;
      if (discordToken && activeProfile) {
        try {
          await discordBotService.start(discordToken);
          log(`🤖 Discord bot initialized for profile: ${activeProfile.name}`);
        } catch (error) {
          log(`⚠️ Failed to start Discord bot: ${error}`);
        }
      } else {
        log(`ℹ️ Discord bot not started - missing token or active profile`);
      }

      // 🔥 Pre-warm context cache for instant responses
      if (activeProfile) {
        try {
          await contextPrewarmer.warmContext(activeProfile.id, storage);
          log(`🔥 Context pre-warming complete for profile: ${activeProfile.name}`);
        } catch (error) {
          log(`⚠️ Failed to pre-warm context: ${error}`);
        }
      }
    } catch (error) {
      log(`⚠️ Failed to initialize services: ${error}`);
    }
  });
})();
