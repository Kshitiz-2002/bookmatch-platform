import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";

import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import booksRoutes from "./routes/books.routes";
import ratingsRoutes from "./routes/v1/ratings.routes";
import recsRoutes from "./routes/v1/recs.gateway.routes";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// mount v1 routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/books", booksRoutes);
app.use("/api/v1/ratings", ratingsRoutes);
app.use("/api/v1/recs", recsRoutes);

// health
app.get("/api/v1/health", (req, res) => res.json({ ok: true, now: new Date().toISOString() }));

// centralized error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`BookMatch API listening on port ${PORT}`);
});
