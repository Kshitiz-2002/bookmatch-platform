import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { collectDefaultMetrics, register as promRegister, Counter } from "prom-client";

import authRoutes from "./routes/v1/auth.routes";
import usersRoutes from "./routes/v1/users.routes";
import booksRoutes from "./routes/v1/books.routes";
import ratingsRoutes from "./routes/v1/ratings.routes";
import recsRoutes from "./routes/v1/recs.gateway.routes";

// Initialize metrics collection
collectDefaultMetrics({ prefix: "bookmatch_" });
const httpRequestsTotal = new Counter({
  name: "bookmatch_http_requests_total",
  help: "Count of all HTTP requests",
  labelNames: ["method", "route", "statusCode"]
});

const app = express();

// Security + performance middlewares
app.use(helmet());
app.use(cors({ origin: true })); // in prod restrict origins
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Rate limiter (basic)
app.use(
  rateLimit({
    windowMs: 60_000, // 1 minute
    max: 120, // per IP
    standardHeaders: true,
    legacyHeaders: false
  })
);

// attach a simple metrics middleware to label counters
app.use((req, res, next) => {
  res.on("finish", () => {
    const route = req.route && (req.route.path || req.route.stack?.[0]?.name) ? String(req.route.path) : req.path;
    httpRequestsTotal.inc({ method: req.method, route, statusCode: res.statusCode.toString() }, 1);
  });
  next();
});

// Mount API v1 routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/books", booksRoutes);
app.use("/api/v1/ratings", ratingsRoutes);
app.use("/api/v1/recs", recsRoutes);

// Health & metrics
app.get("/api/v1/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.get("/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", promRegister.contentType);
    res.end(await promRegister.metrics());
  } catch (err) {
    res.status(500).end(err as string);
  }
});

// centralized error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Unhandled error:", err);
  const status = err?.status || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
});

export default app;
