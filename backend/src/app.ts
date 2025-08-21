// backend/src/app.ts
import Fastify, { FastifyInstance } from "fastify";
import fastifyJwt from "fastify-jwt";
import fastifyMultipart from "fastify-multipart";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import errorPlugin from "./middlewares/error.middleware";
import authPlugin from "./middlewares/auth.middleware";
import routes from "./routes/index";

dotenv.config();

/**
 * buildApp - create & configure Fastify instance
 */
export default function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  // read allowed origins from env (comma separated). Example:
  // ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
  const allowedOriginsEnv = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, "")) // strip trailing slash
    .filter(Boolean);

  // Register CORS BEFORE routes & other plugins that rely on preHandlers
  app.register(cors, {
    origin: true, // reflect any origin
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true, // only if you actually need cookies/sessions
  });

  // JWT plugin (register before auth middleware so req.jwtVerify() is available)
  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "dev",
    sign: { expiresIn: process.env.ACCESS_TOKEN_TTL || "7d" },
  });

  // multipart MUST be registered before routes (handlers will use it)
  app.register(fastifyMultipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  });

  // global plugins / middlewares
  app.register(errorPlugin);
  app.register(authPlugin);

  // application routes
  app.register(routes);

  return app;
}
