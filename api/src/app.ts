import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import "express-async-errors"; // monkeypatch for async route errors
import dotenv from "dotenv";

import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/api/v1", routes);

// simple health
app.get("/health", (_req, res) => res.json({ ok: true }));

// global error handler
app.use(errorHandler);

export default app;
