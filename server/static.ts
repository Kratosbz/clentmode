// // import express, { type Express } from "express";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// export function serveStatic(app: Express) {
//   const clientPath = path.resolve(__dirname, "..", "client");

//   // Serve static files from client directory
//   app.use(express.static(clientPath));

//   // Serve specific HTML pages for routes
//   app.get("/", (_req, res) => {
//     res.sendFile(path.resolve(clientPath, "index.html"));
//   });

//   app.get("/marketplace", (_req, res) => {
//     res.sendFile(path.resolve(clientPath, "marketplace.html"));
//   });

//   app.get("/admin", (_req, res) => {
//     res.sendFile(path.resolve(clientPath, "admin.html"));
//   });

//   // Fallback to index.html for any unmatched routes (not API routes)
//   app.use("*", (req, res, next) => {
//     // Don't intercept API routes
//     if (req.originalUrl.startsWith('/api/')) {
//       return next();
//     }
//     res.sendFile(path.resolve(clientPath, "index.html"));
//   });
// }


import express, { type Express } from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: Express) {
  const clientPath = path.resolve(__dirname, "..", "client");

  // Serve static files from client directory
  app.use(express.static(clientPath));

  // Serve specific HTML pages for routes
  app.get("/", (_req, res) => {
    res.sendFile(path.resolve(clientPath, "index.html"));
  });

  app.get("/marketplace", (_req, res) => {
    res.sendFile(path.resolve(clientPath, "marketplace.html"));
  });

  app.get("/admin", (_req, res) => {
    res.sendFile(path.resolve(clientPath, "admin.html"));
  });

  // Fallback to index.html for any unmatched routes (not API routes)
  app.use("*", (req, res, next) => {
    // Don't intercept API routes
    if (req.originalUrl.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.resolve(clientPath, "index.html"));
  });
}
