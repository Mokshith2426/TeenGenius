import express from "express";
import path from "path";
import { app, uploadsDir } from "./app";

const PORT = 3000;

async function startServer() {
  // Serve uploaded files statically
  app.use("/uploads", express.static(uploadsDir));

  if (process.env.NODE_ENV !== "production") {
    // Dynamically load Vite only in development to prevent bundling/require errors on serverless deploys
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files with smart Cache-Control rules
    app.use(express.static(distPath, {
      maxAge: "1d",
      setHeaders: (res, filePath) => {
        const lowerPath = filePath.toLowerCase();
        if (lowerPath.endsWith(".html") || lowerPath.endsWith("manifest.json") || lowerPath.includes("sw.js")) {
          // SPA entrypoints must NEVER be cached to enable immediate checkout of new code
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else if (lowerPath.includes("/assets/")) {
          // Vite compiled production assets with unique content-hashes can be safely cached long-term
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));

    app.get("*", (req, res) => {
      // Avoid raw browser caches on direct navigations or reloads
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Only bootstrap the web server immediately if we are running in standalone mode (not Netlify function/lambda)
if (!process.env.NETLIFY && !process.env.LAMBDA_TASK_ROOT) {
  startServer();
}

export { app, startServer };
