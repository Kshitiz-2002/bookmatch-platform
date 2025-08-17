import { Request, Response, NextFunction } from "express";
import { log } from "../utils/logger.js";

/**
 * Centralized error middleware.
 * Expect thrown errors in the shape { status?: number, message?: string, details?: any }.
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  log.error(err);
  const status = err?.status && Number(err.status) >= 400 ? Number(err.status) : 500;
  const message = err?.message || (status === 500 ? "Internal server error" : "Unexpected error");
  const payload: any = { error: message };
  if (err?.details) payload.details = err.details;
  // don't leak stack in prod
  if (process.env.NODE_ENV !== "production" && err?.stack) payload.stack = err.stack;
  res.status(status).json(payload);
}
