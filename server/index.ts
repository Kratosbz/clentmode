// import express, { type Request, Response, NextFunction } from "express";
// import session from "express-session";
// import MongoStore from 'connect-mongo';
// import { registerRoutes } from "./routes";
// import { serveStatic } from "./static";
// import { createServer } from "http";
// import cors from "cors";
// // or: const cors = require("cors");
// const path = require('path');

// const app = express();
// const httpServer = createServer(app);
// declare module "http" {
//   interface IncomingMessage {
//     rawBody: unknown;
//   }
// }

// app.use(cors({
//   origin: [
   
//     "http://localhost:5000"
//   ],
//   credentials: true,
// }));

// // Session middleware
// // app.use(session({
// //   secret: process.env.SESSION_SECRET || 'vaultorx-dev-secret-key-2024',
// //   resave: false,
// //   saveUninitialized: false,
// //   cookie: {
// //     secure: process.env.NODE_ENV === 'production',
// //     httpOnly: true,
// //     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
// //   }
// // }));
// app.set("trust proxy", 1); // REQUIRED in prod

// app.use(
//   session({
//     name: "setson",
//     secret: process.env.SESSION_SECRET!,
//     resave: false,
//     saveUninitialized: false,

//     store: MongoStore.create({
//       mongoUrl: process.env.MONGODB_URI!,
//     }),

//     cookie: {
//       httpOnly: true,
//       secure: false,
//       sameSite: "lax",
//       maxAge: 7 * 24 * 60 * 60 * 1000,
//     },
//   })
// );

// app.use(
//   express.json({
//     verify: (req, _res, buf) => {
//       req.rawBody = buf;
//     },
//   }),
// );

// app.use(express.urlencoded({ extended: false }));

// export function log(message: string, source = "express") {
//   const formattedTime = new Date().toLocaleTimeString("en-US", {
//     hour: "numeric",
//     minute: "2-digit",
//     second: "2-digit",
//     hour12: true,
//   });

//   console.log(`${formattedTime} [${source}] ${message}`);
// }

// app.use((req, res, next) => {
//   const start = Date.now();
//   const path = req.path;
//   let capturedJsonResponse: Record<string, any> | undefined = undefined;

//   const originalResJson = res.json;
//   res.json = function (bodyJson, ...args) {
//     capturedJsonResponse = bodyJson;
//     return originalResJson.apply(res, [bodyJson, ...args]);
//   };

//   res.on("finish", () => {
//     const duration = Date.now() - start;
//     if (path.startsWith("/api")) {
//       let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
//       if (capturedJsonResponse) {
//         logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
//       }

//       log(logLine);
//     }
//   });

//   next();
// });

// (async () => {
//   await registerRoutes(httpServer, app);

//   app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
//     const status = err.status || err.statusCode || 500;
//     const message = err.message || "Internal Server Error";

//     res.status(status).json({ message });
//     throw err;
//   });

//   // Serve static HTML files (no Vite/React - pure HTML, CSS, JS)
//   serveStatic(app);

//   // ALWAYS serve the app on the port specified in the environment variable PORT
//   // Other ports are firewalled. Default to 5000 if not specified.
//   // this serves both the API and the client.
//   // It is the only port that is not firewalled.
//   const port = parseInt(process.env.PORT || "5000", 10);
//   httpServer.listen(
//     {
//       port,
//       host: "0.0.0.0",
//       reusePort: true,
//     },
//     () => {
//       log(`serving on port ${port}`);
//     },
//   );

//    // For any route that isn't /api/*, serve index.html
// app.get('*', (req, res) => {
//   if (!req.path.startsWith('/api')) {
//     res.sendFile(path.join(__dirname, '../client/index.html'));
//   }
// });
// })();
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import MongoStore from 'connect-mongo';
import { registerRoutes } from "./routes.ts";
import { serveStatic } from "./static.ts";
import { createServer } from "http";


import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


import cors from "cors";
// or: const cors = require("cors");

console.log("MONGODB_URI:", process.env.MONGODB_URI);


const app = express();
const httpServer = createServer(app);
// Serve static files (HTML, CSS, JS) from the 'client' folder
app.use(express.static(path.join(__dirname, '../client')));

app.use(cors({
  origin: [
   
    "http://localhost:5000"
  ],
  credentials: true,
}));

// Session middleware
// app.use(session({
//   secret: process.env.SESSION_SECRET || 'vaultorx-dev-secret-key-2024',
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     secure: process.env.NODE_ENV === 'production',
//     httpOnly: true,
//     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
//   }
// }));

// app.use(session({
//   secret: process.env.SESSION_SECRET || 'devSecret123!', // must be long and random in production
//   resave: false,          // don't save session if unmodified
//   saveUninitialized: false, // only save session when something is stored
//   store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }), // optional
//   cookie: {
//     httpOnly: true,
//     maxAge: 1000 * 60 * 60 * 24 // 1 day
//   }
// }));
app.set("trust proxy",1)
app.use(
  session({
    name:"setson",
    secret: process.env.SESSION_SECRET || "devSecret123",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI, // ✅ must be valid
    }),
   cookie: {
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 1 day
  httpOnly: true,
  secure:false,
  sameSite:'lax',
}

  })
);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
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
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve static HTML files (no Vite/React - pure HTML, CSS, JS)
  serveStatic(app);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
  // For any route that isn't /api/*, serve index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  }
});
})();
